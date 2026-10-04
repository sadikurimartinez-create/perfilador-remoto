"use server";
import {getInstitutionalAdminDb} from './firebaseAdmin';
import {materializeScinceContextWithPinnedRepository} from '@/services/scinceContextMaterializationService';
import {isScinceCompactSnapshotV2,buildScinceReviewView,fingerprintScinceReviewView} from '@/utils/scinceCompactSnapshot';
import type {ScinceCompactSnapshotV2} from '@/types/scinceCompactSnapshot';

import {getCurrentScinceRelease} from './scinceObservationRepository';
import {scinceRadiusConfigurationMatches} from './scinceRadiusConfiguration';
import { readScinceCanonicalGeography } from "@/utils/scinceQueryGeometry";
import { scinceReviewedContent } from "@/utils/scinceMultiunitValidation";
import { cookies } from "next/headers";
import { isDeepStrictEqual } from "util";
import { getCanonicalScinceData } from "@/lib/osintActions";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { deserializeCanonicalGeographyFromFirestore, type CanonicalProjectGeography,
  type FirestoreSafeCanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { buildScinceCanonicalSnapshot, isValidScinceCanonicalSnapshot, evaluateScinceSnapshotFreshness,
  isScinceSnapshotPublishable } from "@/utils/scinceCanonicalSnapshot";
import type { ScinceCanonicalSuccess, ScinceCanonicalSnapshot, ScinceSnapshotFreshnessResult } from "@/types/scinceCanonicalSnapshot";

export type ScinceIncorporationDecision = {
  decision: "INCORPORATED";
  incorporatedBy: { institutionalUserId: string; username: string };
  incorporatedAt: string;
};
export type ScincePreparationResult =
  | { success: true; snapshot: ScinceCanonicalSnapshot; incorporation: ScinceIncorporationDecision }
  | { success:true;snapshot:ScinceCompactSnapshotV2;incorporation:ScinceIncorporationDecision;persisted:true }
  | { success: false; code: "ACCESS_DENIED" | "REVIEW_CHANGED" | "NOT_CURRENT" | "UNAVAILABLE" };
export type ScinceFreshnessResponse =
  | { success: true; freshness: ScinceSnapshotFreshnessResult }
  | { success: false; code: "ACCESS_DENIED" | "UNAVAILABLE" };

function canonical(raw: unknown): CanonicalProjectGeography | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { geometry?: { type?: unknown; coordinates?: unknown; point?: { lat?: unknown; lng?: unknown } } };
  if (value.geometry?.type === "Point") {
    const coordinates = Array.isArray(value.geometry.coordinates) ? value.geometry.coordinates :
      [value.geometry.point?.lng, value.geometry.point?.lat];
    if (coordinates.length !== 2 || !coordinates.every(v => typeof v === "number" && Number.isFinite(v)) ||
      Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return null;
  }
  return readScinceCanonicalGeography(raw);
}

/** Read-only preparation. The caller persists only after the explicit human action.
 * Reacquire the canonical observation so client-supplied demographics cannot become authoritative.
 * Any difference requires a new human review; never silently incorporate a changed observation.
 */
export async function prepareScinceContextIncorporation(projectId: string, reviewed: ScinceCanonicalSuccess): Promise<ScincePreparationResult> {
  try {
    const access = await authorizeInstitutionalProjectAccess({ projectId, action: "WRITE",
      sessionToken: cookies().get("ceipol_session")?.value });
    if (!access.allowed) return { success: false, code: "ACCESS_DENIED" };
    if(reviewed.compactSnapshot!==undefined) {
      const analyze=await authorizeInstitutionalProjectAccess({projectId:access.projectId,action:'ANALYZE_SCINCE',sessionToken:cookies().get('ceipol_session')?.value});
      if(!analyze.allowed)return {success:false,code:'ACCESS_DENIED'};
      const s=reviewed.compactSnapshot,v=reviewed.reviewView;
      if(!isScinceCompactSnapshotV2(s) || reviewed.projectId!==access.projectId || s.projectBinding.projectId!==access.projectId || !v ||
        s.ppcReview.status!=='REQUIRES_PPC_REVIEW' || s.ppcReview.reviewedContentFingerprint!==s.audit.contentFingerprint ||
        v.snapshotFingerprint!==s.audit.contentFingerprint || v.reviewFingerprint!==fingerprintScinceReviewView(v) ||
        v.reviewFingerprint!==buildScinceReviewView(s).reviewFingerprint)return {success:false,code:'REVIEW_CHANGED'};
      const fresh=await getCanonicalScinceData(access.projectId);
      if(!fresh.success)return {success:false,code:fresh.code==='SCINCE_CANONICAL_ACCESS_DENIED'?'ACCESS_DENIED':'UNAVAILABLE'};
      if(!fresh.compactSnapshot || !isScinceCompactSnapshotV2(fresh.compactSnapshot) || fresh.compactSnapshot.audit.contentFingerprint!==s.audit.contentFingerprint ||
        !fresh.reviewView || fresh.reviewView.reviewFingerprint!==v.reviewFingerprint)return {success:false,code:'REVIEW_CHANGED'};
      const currentRelease=await getCurrentScinceRelease(s.datasetIdentity.datasetId);
      const freshness=evaluateScinceSnapshotFreshness({snapshot:s,expectedProjectId:access.projectId,currentCanonicalGeography:canonical(access.project.canonicalGeography),currentNormalizationRelease:currentRelease});
      if(freshness.territorialFreshness!=='CURRENT' || !scinceRadiusConfigurationMatches(s.analysisArea.configuration))return {success:false,code:'NOT_CURRENT'};
      const verified=await materializeScinceContextWithPinnedRepository(s,'PPC',access);
      if(verified.materialization!=='PASS')return {success:false,code:'REVIEW_CHANGED'};
      const trusted=structuredClone(fresh.compactSnapshot),incorporatedAt=new Date().toISOString();
      trusted.ppcReview={status:'INCORPORATED',decision:'INCORPORATED',institutionalUserId:access.actor.institutionalUserId,incorporatedAt,
        reviewedContentFingerprint:trusted.audit.contentFingerprint};
      trusted.freshness={status:'CURRENT',evaluatedAt:incorporatedAt,reasonCode:null};
      if(!isScinceCompactSnapshotV2(trusted) || Buffer.byteLength(JSON.stringify(trusted),'utf8')>=800000)return {success:false,code:'UNAVAILABLE'};
      const incorporation:ScinceIncorporationDecision={decision:'INCORPORATED',incorporatedBy:{institutionalUserId:access.actor.institutionalUserId,username:access.actor.username},incorporatedAt};
      // Reacquire the WRITE grant immediately before the atomic geography/read/update boundary.
      const write=await authorizeInstitutionalProjectAccess({projectId:access.projectId,action:'WRITE',sessionToken:cookies().get('ceipol_session')?.value});
      if(!write.allowed || write.actor.institutionalUserId!==access.actor.institutionalUserId)return {success:false,code:'ACCESS_DENIED'};
      const db=getInstitutionalAdminDb(),ref=db.collection('projects').doc(access.projectId);
      await db.runTransaction(async transaction=>{
        const document=await transaction.get(ref),data=document.data();
        if(!document.exists || !data || data.deleted!==undefined && data.deleted!==false || data.estado==='ARCHIVADO' || data.status==='ARCHIVADO')throw new Error('SCINCE_PROJECT_UNAVAILABLE');
        if(evaluateScinceSnapshotFreshness({snapshot:trusted,expectedProjectId:access.projectId,currentCanonicalGeography:canonical(data.canonicalGeography),currentNormalizationRelease:currentRelease}).territorialFreshness!=='CURRENT')throw new Error('SCINCE_REVIEW_CHANGED');
        const analysis=data.iaAnalysis;
        if(analysis!==undefined && analysis!==null && (typeof analysis!=='object' || Array.isArray(analysis)))throw new Error('SCINCE_ANALYSIS_INVALID');
        transaction.update(ref,{iaAnalysis:{...(analysis??{}),scinceCanonicalSnapshot:trusted,scinceCanonicalIncorporation:incorporation}});
      });
      return {success:true,snapshot:trusted,incorporation,persisted:true};
    }
    const fresh = await getCanonicalScinceData(access.projectId);
    if (!fresh.success) return { success: false, code: fresh.code === "SCINCE_CANONICAL_ACCESS_DENIED" ? "ACCESS_DENIED" : "UNAVAILABLE" };
    const snapshot = buildScinceCanonicalSnapshot(fresh);
    const reviewedSnapshot = buildScinceCanonicalSnapshot(reviewed);
    if (!isDeepStrictEqual(scinceReviewedContent(snapshot), scinceReviewedContent(reviewedSnapshot))) return { success: false, code: "REVIEW_CHANGED" };
    const input = { snapshot, expectedProjectId: access.projectId, currentCanonicalGeography: canonical(access.project.canonicalGeography) };
    if (!isScinceSnapshotPublishable(input)) return { success: false, code: "NOT_CURRENT" };
    if (snapshot.multiunit) snapshot.multiunit.humanReviewStatus = "INCORPORATED";
    return { success: true, snapshot, incorporation: { decision: "INCORPORATED",
      incorporatedBy: { institutionalUserId: access.actor.institutionalUserId, username: access.actor.username },
      incorporatedAt: new Date().toISOString() } };
  } catch(error) {
    if(error instanceof Error && error.message==='SCINCE_REVIEW_CHANGED')return {success:false,code:'REVIEW_CHANGED'};
    return { success: false, code: "UNAVAILABLE" };
  }
}

/** Evaluate against authorized persisted geography, never against a client-declared fingerprint. */
export async function getScinceContextFreshness(projectId: string, snapshot: unknown,
  localCanonicalGeography?: CanonicalProjectGeography | null): Promise<ScinceFreshnessResponse> {
  try {
    const access = await authorizeInstitutionalProjectAccess({ projectId, action: "READ",
      sessionToken: cookies().get("ceipol_session")?.value });
    if (!access.allowed) return { success: false, code: "ACCESS_DENIED" };
    const compact=isScinceCompactSnapshotV2(snapshot)?snapshot:null;
    const datasetId=compact ? compact.datasetIdentity.datasetId : isValidScinceCanonicalSnapshot(snapshot) ? snapshot.dataset.datasetId : null;
    const release=datasetId ? await getCurrentScinceRelease(datasetId) : undefined;
    const freshness = evaluateScinceSnapshotFreshness({ snapshot, currentNormalizationRelease:release,
      expectedProjectId: access.projectId, currentCanonicalGeography: canonical(access.project.canonicalGeography) });
    if(compact && freshness.territorialFreshness==='CURRENT' && !scinceRadiusConfigurationMatches(compact.analysisArea.configuration))
      return {success:true,freshness:{...freshness,territorialFreshness:'STALE',reason:'SCINCE_RADIUS_CONFIGURATION_CHANGED'}};
    if (freshness.territorialFreshness==='CURRENT' && (snapshot as any)?.multiunit?.scinceAnalysisArea &&
      !scinceRadiusConfigurationMatches((snapshot as any).multiunit.scinceAnalysisArea.configuration))
      return {success:true,freshness:{...freshness,territorialFreshness:'STALE',reason:'SCINCE_RADIUS_CONFIGURATION_CHANGED'}};
    // A pending local map edit can only lower freshness; it cannot override the persisted geography gate.
    if (freshness.territorialFreshness === "CURRENT" && localCanonicalGeography !== undefined) {
      return { success: true, freshness: evaluateScinceSnapshotFreshness({ snapshot,
        expectedProjectId: access.projectId, currentNormalizationRelease:release, currentCanonicalGeography: localCanonicalGeography }) };
    }
    return { success: true, freshness };
  } catch {
    return { success: false, code: "UNAVAILABLE" };
  }
}

/** Capability is advisory UI state; every query still reacquires the explicit server grant. */
export async function getScinceQueryCapability(projectId: string): Promise<boolean> {
  try { return (await authorizeInstitutionalProjectAccess({projectId,action:"ANALYZE_SCINCE",sessionToken:cookies().get("ceipol_session")?.value})).allowed; }
  catch { return false; }
}
