import "server-only";
import {randomUUID} from 'crypto';
import {logReportDiagnostic} from './scinceContextMaterializationService';
import {getCurrentScinceRelease} from '../lib/scinceObservationRepository';
import {scinceRadiusConfigurationMatches} from "../lib/scinceRadiusConfiguration";
import { readScinceCanonicalGeography } from "@/utils/scinceQueryGeometry";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";
import { deserializeCanonicalGeographyFromFirestore, type CanonicalProjectGeography,
  type FirestoreSafeCanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { isValidScinceCanonicalSnapshot, evaluateScinceSnapshotFreshness, isScinceSnapshotPublishable } from "@/utils/scinceCanonicalSnapshot";
import type { ScinceCanonicalSnapshot } from "@/types/scinceCanonicalSnapshot";
import { excludedScinceDocumentContext as excludedContext,scinceDocumentSummary, type ScinceDocumentContext } from "@/utils/scinceDocumentContext";
import {isScinceCompactSnapshotV2,buildScinceReviewView} from '../utils/scinceCompactSnapshot';
import {materializeScinceContextWithPinnedRepository,projectMaterializedScinceDocument} from './scinceContextMaterializationService';

export interface ScincePersistedDocumentSource {
  id: string;
  deleted?: unknown;
  status?: unknown;
  estado?: unknown;
  canonicalGeography?: unknown;
  iaAnalysis?: { scinceCanonicalSnapshot?: unknown; scinceDemographics?: unknown; scinceCanonicalIncorporation?: { decision?: unknown; incorporatedBy?: {institutionalUserId?: unknown; username?: unknown}; incorporatedAt?: unknown } };
}
type Dependencies = {
  authorize: typeof authorizeInstitutionalProjectAccess;
  readRelease: typeof getCurrentScinceRelease;
  readProject: (projectId: string) => Promise<ScincePersistedDocumentSource | null>;
  materialize: typeof materializeScinceContextWithPinnedRepository;
};
const defaults: Dependencies = {
  authorize: authorizeInstitutionalProjectAccess,
  readRelease:getCurrentScinceRelease,
  materialize:materializeScinceContextWithPinnedRepository,
  async readProject(projectId) {
    const document = await getInstitutionalAdminDb().collection("projects").doc(projectId).get();
    return document.exists ? { ...document.data(), id: document.id } : null;
  },
};

function canonical(raw: unknown): CanonicalProjectGeography | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as { geometry?: { type?: unknown; coordinates?: unknown; point?: { lat?: unknown; lng?: unknown } } };
  // Reject malformed persisted numeric input before the shared deserializer can coerce it.
  if (g.geometry?.type === "Point") {
    const c = Array.isArray(g.geometry.coordinates) ? g.geometry.coordinates : [g.geometry.point?.lng, g.geometry.point?.lat];
    if (c.length !== 2 || !c.every(v => typeof v === "number" && Number.isFinite(v)) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) return null;
  }
  return readScinceCanonicalGeography(raw);
}

/** Single admission point. Read-only, authorized, and recomputed for each document generation. */
export async function resolveScinceDocumentPublication(input: {
  projectId: string; sessionToken: unknown; reportGeography: CanonicalProjectGeography | null; transportOnly?:boolean; diagnosticCorrelationId?:string;
}, overrides: Partial<Dependencies> = {}): Promise<ScinceDocumentContext> {
  const deps = { ...defaults, ...overrides };
  let correlationId=input.diagnosticCorrelationId ?? 'diagnostic-unavailable';
  if(input.diagnosticCorrelationId===undefined){try{correlationId=randomUUID();}catch{/* Keep the constant, non-sensitive fallback. */}}
  const excludedScinceDocumentContext:typeof excludedContext=(status,reason)=>{
    logReportDiagnostic(correlationId,'SCINCE_ADMISSION',reason);
    return excludedContext(status,reason);
  };
  try {
    const access = await deps.authorize({ projectId: input.projectId, sessionToken: input.sessionToken, action: "GENERATE_REPORT" });
    if (!access.allowed) return excludedScinceDocumentContext("INVALID", "SCINCE_DOCUMENT_ACCESS_DENIED");
    // Snapshot and current geography come from the same persisted document read, not from the UI.
    const project = await deps.readProject(access.projectId);
    if (!project || project.id !== access.projectId || (project.deleted !== undefined && project.deleted !== false) ||
      project.status === "ARCHIVADO" || project.estado === "ARCHIVADO")
      return excludedScinceDocumentContext("INVALID", "SCINCE_DOCUMENT_PROJECT_UNAVAILABLE");
    const snapshot = project.iaAnalysis?.scinceCanonicalSnapshot;
    if ((snapshot as any)?.schemaVersion==='SCINCE_COMPACT_SNAPSHOT_V2') {
      if(!isScinceCompactSnapshotV2(snapshot))return excludedScinceDocumentContext('INVALID','SCINCE_DOCUMENT_COMPACT_INVALID');
      const review=project.iaAnalysis?.scinceCanonicalIncorporation,ppc=snapshot.ppcReview;
      if(ppc.status!=='INCORPORATED' || ppc.decision!=='INCORPORATED' || ppc.reviewedContentFingerprint!==snapshot.audit.contentFingerprint ||
        !ppc.institutionalUserId || !ppc.incorporatedAt || review?.decision!=='INCORPORATED' ||
        review.incorporatedBy?.institutionalUserId!==ppc.institutionalUserId || review.incorporatedAt!==ppc.incorporatedAt)
        return excludedScinceDocumentContext('INVALID','SCINCE_DOCUMENT_HUMAN_REVIEW_REQUIRED');
      const current=canonical(project.canonicalGeography),release=await deps.readRelease(snapshot.datasetIdentity.datasetId);
      if(!release)return excludedScinceDocumentContext('INVALID','SCINCE_DOCUMENT_RELEASE_UNAVAILABLE');
      const binding={snapshot,currentNormalizationRelease:release,expectedProjectId:access.projectId,currentCanonicalGeography:current};
      const fresh=evaluateScinceSnapshotFreshness(binding);
      if(fresh.territorialFreshness!=='CURRENT')return excludedScinceDocumentContext(fresh.territorialFreshness,fresh.reason);
      if(snapshot.freshness.status!=='CURRENT' || !scinceRadiusConfigurationMatches(snapshot.analysisArea.configuration))
        return excludedScinceDocumentContext('STALE','SCINCE_DOCUMENT_STALE_OR_RADIUS_CHANGED');
      if(evaluateScinceSnapshotFreshness({...binding,currentCanonicalGeography:input.reportGeography}).territorialFreshness!=='CURRENT')
        return excludedScinceDocumentContext('STALE','SCINCE_DOCUMENT_REPORT_GEOGRAPHY_CHANGED');
      if(input.transportOnly)return {...excludedScinceDocumentContext('INVALID','SCINCE_SERVER_GENERATION_REQUIRED'),clientPreparation:buildScinceReviewView(snapshot)};
      const materializationAccess={...access,project:{...access.project,canonicalGeography:project.canonicalGeography}};
      const result=await (deps.materialize===materializeScinceContextWithPinnedRepository
        ? deps.materialize(snapshot,'REPORT',materializationAccess,code=>logReportDiagnostic(correlationId,'SCINCE_MATERIALIZATION',code))
        : deps.materialize(snapshot,'REPORT',materializationAccess));
      if(result.materialization!=='PASS')return excludedScinceDocumentContext('INVALID',result.code);
      const context:ScinceDocumentContext={publicationStatus:'PUBLISHABLE',territorialFreshness:'CURRENT',reason:null,
        snapshot:projectMaterializedScinceDocument(snapshot,result.context),compactVerification:{...result.context.verification,ppcReview:structuredClone(ppc)}};
      return context;
    }
    if (snapshot && typeof snapshot === "object" && (snapshot as any).schemaVersion === "SCINCE_CANONICAL_SNAPSHOT_V2") {
      const review=project.iaAnalysis?.scinceCanonicalIncorporation;
      if ((snapshot as any).multiunit?.humanReviewStatus!=="INCORPORATED" || review?.decision!=="INCORPORATED" ||
        typeof review.incorporatedBy?.institutionalUserId!=="string" || !review.incorporatedBy.institutionalUserId.trim() ||
        typeof review.incorporatedAt!=="string" || !Number.isFinite(Date.parse(review.incorporatedAt))) return excludedScinceDocumentContext("INVALID","SCINCE_DOCUMENT_HUMAN_REVIEW_REQUIRED");
    }
    if ((snapshot as any)?.multiunit?.scinceAnalysisArea && !scinceRadiusConfigurationMatches((snapshot as any).multiunit.scinceAnalysisArea.configuration))
      return excludedScinceDocumentContext('STALE','SCINCE_RADIUS_CONFIGURATION_CHANGED');
    const current = canonical(project.canonicalGeography);
    const datasetId=isValidScinceCanonicalSnapshot(snapshot) ? snapshot.dataset.datasetId : null;
    const release=datasetId ? await deps.readRelease(datasetId) : undefined;
    const binding = { snapshot, currentNormalizationRelease:release, expectedProjectId: access.projectId, currentCanonicalGeography: current };
    const freshness = evaluateScinceSnapshotFreshness(binding);
    if (!isScinceSnapshotPublishable(binding)) {
      return excludedScinceDocumentContext(freshness.territorialFreshness === "CURRENT" ? "INVALID" : freshness.territorialFreshness,
        snapshot == null && project.iaAnalysis?.scinceDemographics != null ? "SCINCE_DOCUMENT_LEGACY_ONLY" : freshness.reason);
    }
    // Do not mix an admitted current observation with a report assembled for an older geography.
    const reportBinding = { ...binding, currentCanonicalGeography: input.reportGeography };
    if (!isScinceSnapshotPublishable(reportBinding)) return excludedScinceDocumentContext("STALE", "SCINCE_DOCUMENT_REPORT_GEOGRAPHY_CHANGED");
    if(input.transportOnly && (snapshot as ScinceCanonicalSnapshot).multiunit) {
      const s=snapshot as ScinceCanonicalSnapshot;
      return {...excludedScinceDocumentContext('INVALID','SCINCE_SERVER_GENERATION_REQUIRED'),clientDocumentIdentity:{dataset:structuredClone(s.dataset),
        summary:scinceDocumentSummary({publicationStatus:'PUBLISHABLE',territorialFreshness:'CURRENT',snapshot:s,reason:null}),
        limitations:structuredClone(s.limitations),provenance:structuredClone(s.multiunit!.dataset.provenance)}};
    }
    return { publicationStatus: "PUBLISHABLE", territorialFreshness: "CURRENT",
      snapshot: structuredClone(snapshot as ScinceCanonicalSnapshot), reason: null };
  } catch {
    return excludedScinceDocumentContext("INVALID", "SCINCE_DOCUMENT_ADMISSION_UNAVAILABLE");
  }
}
