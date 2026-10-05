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
import { ReportInputDuplicateIdentityConflict, safeReportInputSource, reportInputConflictDiagnosticCode } from '@/utils/institutionalReportInputProjection';
import { ReportModelsBoundaryError, REPORT_MODELS_BOUNDARY_CODES } from '@/utils/institutionalGenerationModels';
import { ReportDocumentModelBoundaryError, REPORT_DOCUMENT_MODEL_BOUNDARY_CODES } from '@/utils/executiveGeointReportDocumentModel';
const DOCUMENT_STRUCTURED_CODES = ['P5_BLOCKED', 'CRIME_INCIDENCE_VISUAL_SNAPSHOT_NOT_ADMITTED',
  'CRIME_INCIDENCE_VISUAL_TOTAL_INVALID', 'CRIME_INCIDENCE_VISUAL_COUNTS_INCONSISTENT',
  'CRIME_INCIDENCE_VISUAL_PERCENTAGES_INCONSISTENT', 'CRIME_INCIDENCE_VISUAL_PERIOD_MISMATCH',
  'CRIME_INCIDENCE_VISUAL_TEMPORAL_COUNTS_INVALID'] as const;
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
    const modelsWrapper=error instanceof ReportModelsBoundaryError ? error : null;
    const modelsCause=modelsWrapper ? modelsWrapper.cause : error;
    const documentWrapper=modelsCause instanceof ReportDocumentModelBoundaryError ? modelsCause : null;
    const originalError=documentWrapper ? documentWrapper.cause : modelsCause;
    const known=safeReportDiagnosticCode(originalError);
    const code=known!=='UNKNOWN_INTERNAL_ERROR'?known:Object.hasOwn(REPORT_DIAGNOSTIC_BOUNDARY_CODES,stage)
      ? REPORT_DIAGNOSTIC_BOUNDARY_CODES[stage as keyof typeof REPORT_DIAGNOSTIC_BOUNDARY_CODES] : known;
    const inputConflictCode=reportInputConflictDiagnosticCode(originalError);
    const modelsBoundaryCode=modelsWrapper && REPORT_MODELS_BOUNDARY_CODES.find(value=>value===modelsWrapper.boundaryCode);
    const documentBoundaryCode=documentWrapper && REPORT_DOCUMENT_MODEL_BOUNDARY_CODES.find(value=>value===documentWrapper.boundaryCode);
    let documentStructuredCode: string | undefined;
    try {
      const prefix=originalError instanceof Error ? originalError.message.split(':')[0] : '';
      documentStructuredCode=DOCUMENT_STRUCTURED_CODES.find(value=>value===prefix);
    } catch { /* Unreadable errors retain the closed boundary fallback. */ }
    const directCode=known!=='UNKNOWN_INTERNAL_ERROR' ? null :
      documentStructuredCode ?? inputConflictCode ?? documentBoundaryCode ?? modelsBoundaryCode;
    if(directCode) {
      try {
        if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(correlationId))
          console.error(`[REPORT DIAGNOSTIC] correlationId=${correlationId} stage=${stage} code=${directCode}${originalError instanceof ReportInputDuplicateIdentityConflict
            ? ` leftSource=${safeReportInputSource(originalError.leftSource)} rightSource=${safeReportInputSource(originalError.rightSource)}` : ""}`);
      } catch { /* Diagnostic transport must not affect the public response. */ }
    } else logReportDiagnostic(correlationId,stage,code);
    return NextResponse.json({ error: "REPORT_BOUNDARY_DENIED" }, { status: 403, headers });
  }
}
