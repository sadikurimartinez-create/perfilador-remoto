import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import {
  deserializeCanonicalGeographyFromFirestore,
  FirestoreSafeCanonicalProjectGeography,
} from "@/utils/canonicalProjectGeography";
import {
  canonicalizeConfirmedHistoricalGeographyReconciliation,
  HistoricalGeographyReconciliation,
} from "@/utils/historicalGeographyReconciliation";

export function buildHistoricalGeographyPersistencePatch(params: {
  reconciliation: HistoricalGeographyReconciliation;
  now?: number;
}) {
  const canonicalGeography = canonicalizeConfirmedHistoricalGeographyReconciliation({
    reconciliation: params.reconciliation,
    now: params.now,
  });
  return {
    canonicalGeography,
    geographyId: canonicalGeography.geographyId,
    geographyValidationStatus: canonicalGeography.validationStatus,
    historicalGeographyReconciliation: {
      ...params.reconciliation,
      status: "CONFIRMED" as const,
      canonicalGeographyId: canonicalGeography.geographyId,
    },
  };
}

export const buildHistoricalGeographyReconciliationPersistencePatch = buildHistoricalGeographyPersistencePatch;

export function buildHistoricalGeographyReconciliationAuditDetails(params: {
  reconciliation: HistoricalGeographyReconciliation;
}) {
  return {
    reconciliationId: params.reconciliation.reconciliationId,
    projectId: params.reconciliation.projectId,
    reconciliationType: params.reconciliation.reconciliationType,
    targetType: params.reconciliation.targetType,
    source: "HISTORICAL_RECONCILIATION" as const,
    confirmedCandidateIds: params.reconciliation.confirmedCandidateIds,
    confirmedPoints: params.reconciliation.confirmedPoints.map((point) => ({
      candidateId: point.candidateId,
      order: point.order,
      lat: point.lat,
      lng: point.lng,
      sourceType: point.sourceType,
      sourceObjectPath: point.sourceObjectPath ?? null,
      sourcePhotoId: point.sourcePhotoId ?? null,
      sourceEvidenceId: point.sourceEvidenceId ?? null,
      sourceRefs: point.sourceRefs,
    })),
    confirmedBy: params.reconciliation.confirmedBy ?? null,
    confirmedAt: params.reconciliation.confirmedAt ?? null,
    limitations: params.reconciliation.limitations,
    forensicDeclaration: "GPS photos were treated as HISTORICAL_GEOGRAPHY_CANDIDATE, not VERTEX.",
  };
}

export async function persistHistoricalGeographyReconciliation(params: {
  projectId: string;
  reconciliation: HistoricalGeographyReconciliation;
  now?: number;
}) {
  if (params.reconciliation.status !== "CONFIRMED") {
    throw new Error("HISTORICAL_GEOGRAPHY_NOT_CONFIRMED");
  }
  if (params.reconciliation.projectId !== params.projectId) {
    throw new Error("HISTORICAL_GEOGRAPHY_PROJECT_ID_MISMATCH");
  }

  const firestore = getDb();
  const projectRef = doc(firestore, "projects", params.projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) {
    throw new Error("HISTORICAL_GEOGRAPHY_PROJECT_NOT_FOUND");
  }

  const projectData = projectSnap.data() as {
    canonicalGeography?: FirestoreSafeCanonicalProjectGeography | null;
  };
  const existingCanonicalGeography = deserializeCanonicalGeographyFromFirestore(projectData.canonicalGeography);
  if (existingCanonicalGeography?.validationStatus === "VALID") {
    throw new Error("HISTORICAL_GEOGRAPHY_EXISTING_CANONICAL_VALID");
  }

  const patch = buildHistoricalGeographyPersistencePatch({
    reconciliation: params.reconciliation,
    now: params.now,
  });
  await updateDoc(projectRef, patch);

  const persistedReconciliation: HistoricalGeographyReconciliation = {
    ...patch.historicalGeographyReconciliation,
    status: "PERSISTED",
  };

  return {
    projectId: params.projectId,
    reconciliationId: persistedReconciliation.reconciliationId,
    geographyId: patch.geographyId,
    geographyValidationStatus: patch.geographyValidationStatus,
    canonicalGeography: patch.canonicalGeography,
    confirmedCandidateIds: persistedReconciliation.confirmedCandidateIds,
    confirmedBy: persistedReconciliation.confirmedBy ?? null,
    confirmedAt: persistedReconciliation.confirmedAt ?? null,
    sourceRefs: persistedReconciliation.confirmedPoints.flatMap((point) => point.sourceRefs),
    limitations: persistedReconciliation.limitations,
    historicalGeographyReconciliation: persistedReconciliation,
  };
}
