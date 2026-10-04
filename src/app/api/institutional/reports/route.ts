import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveAuthorizedInstitutionalReportSource } from "@/services/institutionalReportSourceService";
import { InstitutionalReportPackageService,rebuildAuthorizedInstitutionalPackage } from "@/services/institutionalReportPackageService";
import { AdminInstitutionalReportPackageRepository, AdminInstitutionalReportPackageStorage } from "@/services/institutionalReportAdminRepository";
import { materializeAuthorizedVisualSnapshot, verifyAuthorizedVisualBytes } from "@/services/institutionalVisualAuthorityService";
import { encodeReportBoundaryValue, decodeReportBoundaryValue } from "@/utils/institutionalReportBoundaryTransport";
import { validAuthorizationId } from "@/services/institutionalAuthorizationProjectionService";
import { executeInstitutionalReportDecision } from "@/services/institutionalReportDecisionBoundary";
import { resolveInstitutionalSessionIdentity } from "@/services/institutionalSessionIdentityService";
import {resolveScinceDocumentPublication} from '@/services/scinceDocumentPublicationService';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403, headers });
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("REPORT_REQUEST_INVALID");
    const parts: Uint8Array[] = []; let size = 0;
    for (;;) { const item = await reader.read(); if (item.done) break;
      size += item.value.byteLength; if (size > 64 * 1024 * 1024) { await reader.cancel(); throw new Error("REPORT_REQUEST_LIMIT"); } parts.push(item.value); }
    const body = JSON.parse(Buffer.concat(parts).toString("utf8"));
    const projectId = body.input?.projectId ?? body.input?.institutionalReportInput?.projectId ?? body.input?.certification?.projectId ?? body.input?.request?.projectId;
    if (!["MATERIALIZE_VISUALS", "GENERATE", "REQUEST_CERTIFICATION", "CERTIFY", "REJECT_CERTIFICATION", "REVOKE_CERTIFICATION", "REQUEST_PUBLICATION", "PUBLISH", "FAIL_PUBLICATION", "REVOKE_PUBLICATION"].includes(body.operation) || !validAuthorizationId(projectId) ||
      (body.input.packageId !== undefined && !validAuthorizationId(body.input.packageId))) throw new Error("REPORT_REQUEST_INVALID");
    const sessionToken = cookies().get("ceipol_session")?.value;
    const source = await resolveAuthorizedInstitutionalReportSource({ projectId, sessionToken });
    const input = decodeReportBoundaryValue(body.input);
    if (body.operation === "MATERIALIZE_VISUALS") return NextResponse.json(await encodeReportBoundaryValue(await materializeAuthorizedVisualSnapshot(source, input.generatedAt)), { headers });
    if (body.operation !== "GENERATE") {
      const actor = await resolveInstitutionalSessionIdentity(sessionToken);
      return NextResponse.json(await executeInstitutionalReportDecision(body.operation, input, actor, source.projectId, source.sourceFingerprint), { headers });
    }
    const admit:NonNullable<Parameters<typeof rebuildAuthorizedInstitutionalPackage>[1]>['admit']=(projectId,reportGeography)=>resolveScinceDocumentPublication({projectId,reportGeography,sessionToken});
    if(input.contract==='SERVER_DOCUMENT_GENERATION_V1') {
      if(Object.keys(input).sort().join('|')!=='contract|format|projectId' || !['DOCX','PDF','ALL'].includes(input.format))throw new Error('REPORT_REQUEST_INVALID');
      const rebuilt=await rebuildAuthorizedInstitutionalPackage(source,{admit,visuals:(models,generatedAt)=>materializeAuthorizedVisualSnapshot(source,generatedAt,{models:async()=>models})});
      const service=new InstitutionalReportPackageService(new AdminInstitutionalReportPackageRepository(rebuilt.generationContext),new AdminInstitutionalReportPackageStorage(),
        ()=>new Date().toISOString(),async()=>source,admit);
      const manifest=await service.persistGeneratedPackage(rebuilt);
      return NextResponse.json(await encodeReportBoundaryValue({manifest,artifacts:{
        ...(input.format!=='PDF'?{executiveReport:rebuilt.reportBlob,technicalAnnex:rebuilt.annexBlob}:{}),
        ...(input.format!=='DOCX'?{executivePdf:rebuilt.pdfArtifacts.executive,technicalAnnexPdf:rebuilt.pdfArtifacts.annex}:{})}}),{headers});
    }
    if(source.project.iaAnalysis?.scinceCanonicalSnapshot?.schemaVersion==='SCINCE_COMPACT_SNAPSHOT_V2')throw new Error('SCINCE_SERVER_GENERATION_REQUIRED');
    Object.assign(input.generationContext, await verifyAuthorizedVisualBytes(source, input.generationContext));
    const service = new InstitutionalReportPackageService(new AdminInstitutionalReportPackageRepository(input.generationContext), new AdminInstitutionalReportPackageStorage(),
      () => new Date().toISOString(), async () => source,admit);
    const manifest = await service.persistGeneratedPackage(input);
    return NextResponse.json(manifest, { headers });
  } catch { return NextResponse.json({ error: "REPORT_BOUNDARY_DENIED" }, { status: 403, headers }); }
}
