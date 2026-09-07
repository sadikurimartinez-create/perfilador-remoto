import {
  buildCanonicalProjectGeography,
  CanonicalGeographyType,
  CanonicalProjectGeography,
  isValidLatLng,
  LatLngPoint,
} from "./canonicalProjectGeography";

export type HistoricalGeographyCandidateSource =
  | "IN_SITU_PHOTO_GPS"
  | "STREET_VIEW"
  | "POI"
  | "EXTERNAL"
  | "UNKNOWN";

export type HistoricalGeographyCandidateStatus =
  | "DISCOVERED"
  | "SELECTED"
  | "DISCARDED";

export type HistoricalGeographyCandidateConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export type HistoricalGeographyReconciliationStatus =
  | "DISCOVERED"
  | "CANDIDATES_READY"
  | "HUMAN_REVIEW"
  | "CONFIRMED"
  | "PERSISTED";

export interface HistoricalGeographyCandidate {
  candidateId: string;
  projectId: string;
  lat: number;
  lng: number;
  sourceType: HistoricalGeographyCandidateSource;
  sourceObjectPath?: string | null;
  sourcePhotoId?: string | null;
  sourceEvidenceId?: string | null;
  capturedAt?: number | string | null;
  status: HistoricalGeographyCandidateStatus;
  confidence: HistoricalGeographyCandidateConfidence;
  limitations: string[];
  sourceRefs: HistoricalGeographySourceRef[];
}

export interface HistoricalGeographyEvidenceInput {
  projectId: string;
  lat?: number | null;
  lng?: number | null;
  sourceType?: HistoricalGeographyCandidateSource | null;
  sourceObjectPath?: string | null;
  sourcePhotoId?: string | null;
  sourceEvidenceId?: string | null;
  capturedAt?: number | string | null;
  confidence?: HistoricalGeographyCandidateConfidence | null;
  limitations?: string[] | null;
}

export interface HistoricalGeographySourceRef {
  sourceType: HistoricalGeographyCandidateSource;
  sourceObjectPath?: string | null;
  sourcePhotoId?: string | null;
  sourceEvidenceId?: string | null;
  capturedAt?: number | string | null;
}

export interface HistoricalGeographyConfirmedPoint extends LatLngPoint {
  candidateId: string;
  order: number;
  sourceType: HistoricalGeographyCandidateSource;
  sourceObjectPath?: string | null;
  sourcePhotoId?: string | null;
  sourceEvidenceId?: string | null;
  sourceRefs: HistoricalGeographySourceRef[];
}

export interface HistoricalGeographyHumanActor {
  id?: string | number | null;
  username?: string | null;
  name?: string | null;
}

export interface HistoricalGeographyHumanConfirmation {
  confirmedBy: HistoricalGeographyHumanActor;
  confirmedAt: number | string;
}

export interface HistoricalGeographyReconciliation {
  reconciliationId: string;
  projectId: string;
  targetType: Extract<CanonicalGeographyType, "CORRIDOR">;
  status: HistoricalGeographyReconciliationStatus;
  candidates: HistoricalGeographyCandidate[];
  selectedCandidateIds: string[];
  confirmedCandidateIds: string[];
  confirmedPoints: HistoricalGeographyConfirmedPoint[];
  confirmedBy?: HistoricalGeographyHumanActor | null;
  confirmedAt?: number | string | null;
  canonicalGeographyId?: string | null;
  reconciliationType: "HISTORICAL_GEOGRAPHY_RECONCILIATION";
  limitations: string[];
}

function coordinateKey(point: LatLngPoint): string {
  return `${Number(point.lat).toFixed(7)},${Number(point.lng).toFixed(7)}`;
}

function uniqueStringList(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function normalizeLimitations(limitations: string[] | null | undefined): string[] {
  return uniqueStringList(limitations || []);
}

function buildSourceRef(input: HistoricalGeographyEvidenceInput | HistoricalGeographyCandidate): HistoricalGeographySourceRef {
  return {
    sourceType: input.sourceType || "UNKNOWN",
    sourceObjectPath: input.sourceObjectPath ?? null,
    sourcePhotoId: input.sourcePhotoId ?? null,
    sourceEvidenceId: input.sourceEvidenceId ?? null,
    capturedAt: input.capturedAt ?? null,
  };
}

function mergeSourceRefs(candidates: HistoricalGeographyCandidate[]): HistoricalGeographySourceRef[] {
  const seen = new Set<string>();
  const refs: HistoricalGeographySourceRef[] = [];
  candidates.flatMap((candidate) => candidate.sourceRefs?.length ? candidate.sourceRefs : [buildSourceRef(candidate)]).forEach((ref) => {
    const key = [
      ref.sourceType,
      ref.sourceObjectPath || "",
      ref.sourcePhotoId || "",
      ref.sourceEvidenceId || "",
      ref.capturedAt || "",
    ].join("|");
    if (!seen.has(key)) {
      seen.add(key);
      refs.push(ref);
    }
  });
  return refs;
}

function hasHumanActorIdentity(actor: HistoricalGeographyHumanActor | null | undefined): boolean {
  if (!actor) return false;
  return [actor.id, actor.username, actor.name].some((value) => String(value ?? "").trim().length > 0);
}

export function isValidHistoricalGeographyCandidate(candidate: unknown): candidate is HistoricalGeographyCandidate {
  const value = candidate as HistoricalGeographyCandidate;
  return Boolean(value?.candidateId)
    && Boolean(value?.projectId)
    && isValidLatLng({ lat: value?.lat, lng: value?.lng });
}

export function createHistoricalGeographyCandidate(
  input: HistoricalGeographyEvidenceInput & { candidateId: string }
): HistoricalGeographyCandidate | null {
  const point = { lat: Number(input.lat), lng: Number(input.lng) };
  if (!isValidLatLng(point)) return null;

  return {
    candidateId: input.candidateId,
    projectId: input.projectId,
    lat: point.lat,
    lng: point.lng,
    sourceType: input.sourceType || "UNKNOWN",
    sourceObjectPath: input.sourceObjectPath ?? null,
    sourcePhotoId: input.sourcePhotoId ?? null,
    sourceEvidenceId: input.sourceEvidenceId ?? null,
    capturedAt: input.capturedAt ?? null,
    status: "DISCOVERED",
    confidence: input.confidence || "MEDIUM",
    limitations: normalizeLimitations(input.limitations),
    sourceRefs: [buildSourceRef(input)],
  };
}

export function normalizeHistoricalGeographyCandidates(
  candidates: HistoricalGeographyCandidate[]
): HistoricalGeographyCandidate[] {
  return candidates
    .filter(isValidHistoricalGeographyCandidate)
    .map((candidate) => ({
      ...candidate,
      status: candidate.status === "DISCARDED" ? "DISCARDED" : "DISCOVERED",
      limitations: normalizeLimitations(candidate.limitations),
      sourceRefs: candidate.sourceRefs?.length ? candidate.sourceRefs : [buildSourceRef(candidate)],
    }));
}

export function deduplicateHistoricalGeographyCandidates(
  candidates: HistoricalGeographyCandidate[]
): HistoricalGeographyCandidate[] {
  const groups = new Map<string, HistoricalGeographyCandidate[]>();
  normalizeHistoricalGeographyCandidates(candidates).forEach((candidate) => {
    const key = coordinateKey(candidate);
    groups.set(key, [...(groups.get(key) || []), candidate]);
  });

  return Array.from(groups.values()).map((group) => {
    const primary = group[0];
    return {
      ...primary,
      status: group.every((candidate) => candidate.status === "DISCARDED") ? "DISCARDED" : "DISCOVERED",
      limitations: normalizeLimitations(group.flatMap((candidate) => candidate.limitations)),
      sourceRefs: mergeSourceRefs(group),
    };
  });
}

export function buildHistoricalGeographyCandidatesFromEvidence(
  evidence: HistoricalGeographyEvidenceInput[]
): HistoricalGeographyCandidate[] {
  return evidence
    .map((item, index) => createHistoricalGeographyCandidate({
      ...item,
      candidateId: `hgc-${item.projectId}-${index + 1}`,
    }))
    .filter((candidate): candidate is HistoricalGeographyCandidate => Boolean(candidate));
}

export function createHistoricalGeographyReconciliation(params: {
  reconciliationId: string;
  projectId: string;
  candidates: HistoricalGeographyCandidate[];
  limitations?: string[] | null;
}): HistoricalGeographyReconciliation {
  const candidates = normalizeHistoricalGeographyCandidates(params.candidates)
    .filter((candidate) => candidate.projectId === params.projectId)
    .map((candidate) => ({ ...candidate, status: candidate.status || "DISCOVERED" as const }));

  return {
    reconciliationId: params.reconciliationId,
    projectId: params.projectId,
    targetType: "CORRIDOR",
    status: candidates.length > 0 ? "CANDIDATES_READY" : "DISCOVERED",
    candidates,
    selectedCandidateIds: [],
    confirmedCandidateIds: [],
    confirmedPoints: [],
    confirmedBy: null,
    confirmedAt: null,
    canonicalGeographyId: null,
    reconciliationType: "HISTORICAL_GEOGRAPHY_RECONCILIATION",
    limitations: normalizeLimitations(params.limitations),
  };
}

export function selectHistoricalGeographyCandidates(
  reconciliation: HistoricalGeographyReconciliation,
  candidateIds: string[]
): HistoricalGeographyReconciliation {
  const selectedCandidateIds = uniqueStringList(candidateIds);
  const knownCandidateIds = new Set(reconciliation.candidates.map((candidate) => candidate.candidateId));
  const unknownCandidateIds = selectedCandidateIds.filter((candidateId) => !knownCandidateIds.has(candidateId));
  if (unknownCandidateIds.length > 0) {
    throw new Error("HISTORICAL_GEOGRAPHY_UNKNOWN_CANDIDATE_ID");
  }

  return {
    ...reconciliation,
    status: "HUMAN_REVIEW",
    selectedCandidateIds,
    confirmedCandidateIds: [],
    confirmedPoints: [],
    confirmedBy: null,
    confirmedAt: null,
    candidates: reconciliation.candidates.map((candidate) => ({
      ...candidate,
      status: selectedCandidateIds.includes(candidate.candidateId) ? "SELECTED" : candidate.status,
    })),
  };
}

export function discardHistoricalGeographyCandidates(
  reconciliation: HistoricalGeographyReconciliation,
  candidateIds: string[]
): HistoricalGeographyReconciliation {
  const discardedCandidateIds = new Set(uniqueStringList(candidateIds));
  return {
    ...reconciliation,
    candidates: reconciliation.candidates.map((candidate) => ({
      ...candidate,
      status: discardedCandidateIds.has(candidate.candidateId) ? "DISCARDED" : candidate.status,
    })),
    selectedCandidateIds: reconciliation.selectedCandidateIds.filter((candidateId) => !discardedCandidateIds.has(candidateId)),
    confirmedCandidateIds: [],
    confirmedPoints: [],
    status: "HUMAN_REVIEW",
  };
}

export function confirmHistoricalGeographyReconciliation(params: {
  reconciliation: HistoricalGeographyReconciliation;
  confirmedCandidateIds: string[];
  confirmation: HistoricalGeographyHumanConfirmation;
}): HistoricalGeographyReconciliation {
  const confirmedCandidateIds = params.confirmedCandidateIds.map((candidateId) => String(candidateId || "").trim()).filter(Boolean);
  if (confirmedCandidateIds.length !== new Set(confirmedCandidateIds).size) {
    throw new Error("HISTORICAL_GEOGRAPHY_DUPLICATE_CONFIRMED_IDS");
  }
  if (!hasHumanActorIdentity(params.confirmation.confirmedBy) || !params.confirmation.confirmedAt) {
    throw new Error("HISTORICAL_GEOGRAPHY_HUMAN_CONFIRMATION_REQUIRED");
  }

  const candidatesById = new Map(params.reconciliation.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const confirmedCandidates = confirmedCandidateIds.map((candidateId) => candidatesById.get(candidateId));
  if (confirmedCandidates.some((candidate) => !candidate)) {
    throw new Error("HISTORICAL_GEOGRAPHY_UNKNOWN_CANDIDATE_ID");
  }
  if (confirmedCandidates.some((candidate) => !isValidHistoricalGeographyCandidate(candidate))) {
    throw new Error("HISTORICAL_GEOGRAPHY_INVALID_CANDIDATE");
  }

  const uniqueCoordinateCount = new Set(
    confirmedCandidates.map((candidate) => coordinateKey({ lat: candidate!.lat, lng: candidate!.lng }))
  ).size;
  if (confirmedCandidates.length < 2 || uniqueCoordinateCount < 2) {
    throw new Error("HISTORICAL_GEOGRAPHY_INSUFFICIENT_POINTS");
  }

  const confirmedPoints = confirmedCandidates.map((candidate, index) => ({
    candidateId: candidate!.candidateId,
    lat: candidate!.lat,
    lng: candidate!.lng,
    order: index + 1,
    sourceType: candidate!.sourceType,
    sourceObjectPath: candidate!.sourceObjectPath ?? null,
    sourcePhotoId: candidate!.sourcePhotoId ?? null,
    sourceEvidenceId: candidate!.sourceEvidenceId ?? null,
    sourceRefs: candidate!.sourceRefs?.length ? candidate!.sourceRefs : [buildSourceRef(candidate!)],
  }));

  return {
    ...params.reconciliation,
    status: "CONFIRMED",
    selectedCandidateIds: confirmedCandidateIds,
    confirmedCandidateIds,
    confirmedPoints,
    confirmedBy: params.confirmation.confirmedBy,
    confirmedAt: params.confirmation.confirmedAt,
    candidates: params.reconciliation.candidates.map((candidate) => ({
      ...candidate,
      status: confirmedCandidateIds.includes(candidate.candidateId)
        ? "SELECTED"
        : candidate.status === "SELECTED"
          ? "DISCOVERED"
          : candidate.status,
    })),
  };
}

export function canonicalizeConfirmedHistoricalGeographyReconciliation(params: {
  reconciliation: HistoricalGeographyReconciliation;
  now?: number;
}): CanonicalProjectGeography {
  if (params.reconciliation.status !== "CONFIRMED" || params.reconciliation.confirmedPoints.length < 2) {
    throw new Error("HISTORICAL_GEOGRAPHY_NOT_CONFIRMED");
  }

  const geography = buildCanonicalProjectGeography({
    projectId: params.reconciliation.projectId,
    type: params.reconciliation.targetType,
    points: params.reconciliation.confirmedPoints.map((point) => ({ lat: point.lat, lng: point.lng })),
    source: "HISTORICAL_RECONCILIATION",
    now: params.now,
  });

  if (geography.validationStatus !== "VALID") {
    throw new Error("HISTORICAL_GEOGRAPHY_INVALID_CANONICAL_RESULT");
  }

  return {
    ...geography,
    limitations: normalizeLimitations([
      ...(geography.limitations || []),
      ...params.reconciliation.limitations,
      "HISTORICAL_GEOGRAPHY_RECONCILED_BY_HUMAN_VALIDATION",
    ]),
  };
}
