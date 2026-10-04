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
import {randomUUID} from 'crypto';
import {logReportDiagnostic,safeReportDiagnosticCode,REPORT_DIAGNOSTIC_BOUNDARY_CODES,type ReportDiagnosticStage} from '@/services/scinceContextMaterializationService';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let correlationId='diagnostic-unavailable';
  try{correlationId=randomUUID();}catch{/* Constant fallback; correlation failure cannot affect the request. */}
  let stage:ReportDiagnosticStage='REQUEST_VALIDATION';
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
    stage='SESSION_SOURCE';
    const sessionToken = cookies().get("ceipol_session")?.value;
    stage='REPORT_SOURCE';
    const source = await resolveAuthorizedInstitutionalReportSource({ projectId, sessionToken },{diagnosticStage:value=>{stage=value;}});
    stage='REQUEST_VALIDATION';
    const input = decodeReportBoundaryValue(body.input);
    if (body.operation === "MATERIALIZE_VISUALS") {stage='VISUALS';return NextResponse.json(await encodeReportBoundaryValue(await materializeAuthorizedVisualSnapshot(source, input.generatedAt)), { headers });}
    if (body.operation !== "GENERATE") {
      stage='SESSION_SOURCE';
      const actor = await resolveInstitutionalSessionIdentity(sessionToken);
      stage='PACKAGE_PERSISTENCE';
      return NextResponse.json(await executeInstitutionalReportDecision(body.operation, input, actor, source.projectId, source.sourceFingerprint), { headers });
    }
    const admit:NonNullable<Parameters<typeof rebuildAuthorizedInstitutionalPackage>[1]>['admit']=async(projectId,reportGeography)=>{
      const callerStage=stage;stage='SCINCE_ADMISSION';
      const context=await resolveScinceDocumentPublication({projectId,reportGeography,sessionToken,diagnosticCorrelationId:correlationId});
      stage=callerStage;return context;
    };
    if(input.contract==='SERVER_DOCUMENT_GENERATION_V1') {
      stage='REQUEST_VALIDATION';
      if(Object.keys(input).sort().join('|')!=='contract|format|projectId' || !['DOCX','PDF','ALL'].includes(input.format))throw new Error('REPORT_REQUEST_INVALID');
      stage='MODELS';
      const rebuilt=await rebuildAuthorizedInstitutionalPackage(source,{admit,visuals:async(models,generatedAt)=>{
        stage='VISUALS';const visual=await materializeAuthorizedVisualSnapshot(source,generatedAt,{models:async()=>models});
        stage='DOCX_PDF';return visual;
      }});
      stage='PACKAGE_PERSISTENCE';
      const service=new InstitutionalReportPackageService(new AdminInstitutionalReportPackageRepository(rebuilt.generationContext),new AdminInstitutionalReportPackageStorage(),
        ()=>new Date().toISOString(),async()=>source,admit,value=>{stage=value;});
      const manifest=await service.persistGeneratedPackage(rebuilt);
      return NextResponse.json(await encodeReportBoundaryValue({manifest,artifacts:{
        ...(input.format!=='PDF'?{executiveReport:rebuilt.reportBlob,technicalAnnex:rebuilt.annexBlob}:{}),
        ...(input.format!=='DOCX'?{executivePdf:rebuilt.pdfArtifacts.executive,technicalAnnexPdf:rebuilt.pdfArtifacts.annex}:{})}}),{headers});
    }
    stage='REPORT_SOURCE_RESULT_CONSUMPTION';
    if(source.project.iaAnalysis?.scinceCanonicalSnapshot?.schemaVersion==='SCINCE_COMPACT_SNAPSHOT_V2')throw new Error('SCINCE_SERVER_GENERATION_REQUIRED');
    stage='VISUALS';
    Object.assign(input.generationContext, await verifyAuthorizedVisualBytes(source, input.generationContext));
    stage='PACKAGE_PERSISTENCE';
    const service = new InstitutionalReportPackageService(new AdminInstitutionalReportPackageRepository(input.generationContext), new AdminInstitutionalReportPackageStorage(),
      () => new Date().toISOString(), async () => source,admit,value=>{stage=value;});
    const manifest = await service.persistGeneratedPackage(input);
    return NextResponse.json(manifest, { headers });
  } catch(error) {
    const known=safeReportDiagnosticCode(error);
    const code=known!=='UNKNOWN_INTERNAL_ERROR'?known:Object.hasOwn(REPORT_DIAGNOSTIC_BOUNDARY_CODES,stage)
      ? REPORT_DIAGNOSTIC_BOUNDARY_CODES[stage as keyof typeof REPORT_DIAGNOSTIC_BOUNDARY_CODES] : known;
    logReportDiagnostic(correlationId,stage,code);
    return NextResponse.json({ error: "REPORT_BOUNDARY_DENIED" }, { status: 403, headers });
  }
}
