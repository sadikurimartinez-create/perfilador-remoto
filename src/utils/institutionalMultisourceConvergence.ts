import type { AcquisitionMode, EpistemicValidationStatus } from "@/types/epistemicIntegrity";
import { validateLineage, type CanonicalLineageNode, type LineageStatus } from "@/utils/evidenceLineage";
import type { InstitutionalCorrelationItem } from "@/lib/geoint/multiSourceCorrelationEngine";
import { SpatialLayerEngine, type Coordinate } from "@/lib/providers/spatialLayerEngine";

export type ConvergenceSourceKind =
  | "STREET_VIEW"
  | "PLACES"
  | "PLACES_REVIEW"
  | "VISION"
  | "ROUTES"
  | "ELEVATION"
  | "DENUE"
  | "FIELD_PHOTO"
  | "FIELD_OBSERVATION"
  | "PPC_CONTEXT";

export type ConvergenceEpistemicRole =
  | "SOURCE_FACT"
  | "OBSERVED"
  | "USER_GENERATED_CONTEXT"
  | "UNVERIFIED_USER_GENERATED_ALLEGATION"
  | "ANALYTICAL_SUGGESTION"
  | "AI_GENERATED"
  | "HUMAN_OBSERVATION"
  | "HUMAN_INTERPRETATION"
  | "HUMAN_VALIDATED_FINDING"
  | "DERIVED_RELATION";

export type ConvergenceTemporalClass = "CURRENT" | "RECENT" | "HISTORICAL" | "UNKNOWN";
export type ConvergenceSpatialCompatibility =
  | "SAME_POINT"
  | "NEARBY"
  | "SAME_CORRIDOR"
  | "SAME_POLYGON"
  | "SPATIALLY_COMPATIBLE"
  | "SPATIALLY_INCOMPATIBLE"
  | "UNKNOWN";
export type ConvergenceCompatibility = "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN";
export type SourceIndependence = "INDEPENDENT" | "PARTIALLY_DEPENDENT" | "DERIVED" | "UNKNOWN";
export type FieldSupportStatus = "fieldSupport" | "fieldContradiction" | "fieldNotObserved" | "fieldUnknown";
export type HypothesisRelation = "SUPPORTS" | "CONTRADICTS" | "NEUTRAL" | "INSUFFICIENT";

export type ConvergencePhenomenon =
  | "PHYSICAL_FEATURE_CORROBORATION"
  | "ACCESS_FEATURE_CORROBORATION"
  | "POI_IDENTITY_CORROBORATION"
  | "FUNCTIONAL_ACTIVITY_CORROBORATION"
  | "TEMPORAL_ACTIVITY_CORROBORATION"
  | "OPERATIONAL_STATUS_CONTRADICTION"
  | "PHYSICAL_STATE_CONTRADICTION"
  | "ROUTE_ACCESS_CORROBORATION"
  | "TOPOGRAPHIC_CONTEXT_CORROBORATION"
  | "FIELD_CORROBORATED_FINDING";

export interface ConvergenceSourceEntry {
  sourceKind: ConvergenceSourceKind;
  sourceId: string;
  sourceEvidenceId: string;
  traceabilityId: string;
  expedienteId: string;
  geographyId: string;
  coordinates?: Coordinate | null;
  timestamp?: string | null;
  temporalClass?: ConvergenceTemporalClass;
  epistemicRole: ConvergenceEpistemicRole;
  validationStatus?: EpistemicValidationStatus | "CONTEXTUALIZED" | "HUMAN_REVIEWED" | "UNREVIEWED";
  lineage: CanonicalLineageNode[];
  sourceReferences: string[];
  phenomenonTags: string[];
  assertion?: "PRESENT" | "ABSENT" | "UNKNOWN";
  acquisitionMode?: AcquisitionMode;
  dependsOnSourceEvidenceIds?: string[];
  visitId?: string | null;
}

export interface ConvergenceMatrixScores {
  supportScore: number;
  contradictionScore: number;
  independenceScore: number;
  spatialScore: number;
  temporalScore: number;
  traceabilityScore: number;
}

export interface SourceDependencyRelation {
  sourceA: string;
  sourceB: string;
  independence: SourceIndependence;
  reason: string;
}

export interface ConvergenceResult {
  convergenceId: string;
  expedienteId: string;
  geographyId: string;
  phenomenon: ConvergencePhenomenon;
  supportingSources: ConvergenceSourceEntry[];
  contradictingSources: ConvergenceSourceEntry[];
  sourceEvidenceIds: string[];
  traceabilityIds: string[];
  lineage: CanonicalLineageNode[];
  lineageStatus: LineageStatus;
  spatialCompatibility: ConvergenceSpatialCompatibility;
  temporalCompatibility: ConvergenceCompatibility;
  semanticCompatibility: ConvergenceCompatibility;
  sourceDependencies: SourceDependencyRelation[];
  fieldStatus: FieldSupportStatus;
  hypothesisRelation: HypothesisRelation;
  confidence: number;
  confidenceBasis: string;
  scoreMatrix: ConvergenceMatrixScores;
  limitations: string[];
  humanReviewStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "CONTEXTUALIZED";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  blockingReasons: string[];
  producedPrediction: false;
  generatedAt: string;
}

function present(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stableToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function classifyConvergenceTemporal(timestamp?: string | null, now: Date = new Date()): ConvergenceTemporalClass {
  const raw = present(timestamp);
  if (!raw) return "UNKNOWN";
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return "UNKNOWN";
  const ageDays = Math.max(0, (now.getTime() - time) / 86400000);
  if (ageDays <= 30) return "CURRENT";
  if (ageDays <= 365) return "RECENT";
  return "HISTORICAL";
}

export function classifyConvergenceSpatialPair(a: ConvergenceSourceEntry, b: ConvergenceSourceEntry): ConvergenceSpatialCompatibility {
  if (a.geographyId && b.geographyId && a.geographyId !== b.geographyId) return "SPATIALLY_INCOMPATIBLE";
  if (!a.coordinates || !b.coordinates) return "UNKNOWN";
  const distance = SpatialLayerEngine.getDistance(a.coordinates, b.coordinates);
  if (distance <= 10) return "SAME_POINT";
  if (distance <= 100) return "NEARBY";
  if (distance <= 250) return "SPATIALLY_COMPATIBLE";
  return "SPATIALLY_INCOMPATIBLE";
}

export function classifySourceIndependence(a: ConvergenceSourceEntry, b: ConvergenceSourceEntry): SourceDependencyRelation {
  const explicitDependency =
    a.dependsOnSourceEvidenceIds?.includes(b.sourceEvidenceId) ||
    b.dependsOnSourceEvidenceIds?.includes(a.sourceEvidenceId) ||
    (a.sourceEvidenceId === b.sourceEvidenceId && a.sourceKind !== b.sourceKind);
  if (explicitDependency) {
    return { sourceA: a.sourceId, sourceB: b.sourceId, independence: "DERIVED", reason: "SOURCE_DEPENDENCY_OR_SHARED_SOURCE" };
  }
  const pair = new Set([a.sourceKind, b.sourceKind]);
  if (pair.has("STREET_VIEW") && pair.has("VISION")) {
    return { sourceA: a.sourceId, sourceB: b.sourceId, independence: "DERIVED", reason: "VISION_DERIVED_FROM_VISUAL_SOURCE_WHEN_LINKED" };
  }
  if (pair.has("PLACES") && pair.has("PLACES_REVIEW")) {
    return { sourceA: a.sourceId, sourceB: b.sourceId, independence: "PARTIALLY_DEPENDENT", reason: "PLACES_REVIEW_DEPENDS_ON_GOOGLE_PLACES_CONTEXT" };
  }
  if (pair.has("FIELD_PHOTO") && pair.has("FIELD_OBSERVATION")) {
    const sameVisit = a.visitId && b.visitId && a.visitId === b.visitId;
    return {
      sourceA: a.sourceId,
      sourceB: b.sourceId,
      independence: sameVisit ? "PARTIALLY_DEPENDENT" : "UNKNOWN",
      reason: sameVisit ? "FIELD_PHOTO_AND_OBSERVATION_SHARE_VISIT" : "FIELD_VISIT_RELATION_UNKNOWN",
    };
  }
  if (pair.has("ROUTES") && pair.has("ELEVATION")) {
    return { sourceA: a.sourceId, sourceB: b.sourceId, independence: "PARTIALLY_DEPENDENT", reason: "ROUTE_AND_ELEVATION_CAN_SHARE_MOBILITY_ANALYSIS" };
  }
  if (pair.has("DENUE") && pair.has("PLACES")) {
    return { sourceA: a.sourceId, sourceB: b.sourceId, independence: "INDEPENDENT", reason: "INDEPENDENT_PROVIDER_SOURCES" };
  }
  if (a.sourceKind === b.sourceKind) {
    return { sourceA: a.sourceId, sourceB: b.sourceId, independence: "PARTIALLY_DEPENDENT", reason: "SAME_SOURCE_KIND" };
  }
  return { sourceA: a.sourceId, sourceB: b.sourceId, independence: "INDEPENDENT", reason: "DISTINCT_SOURCE_FAMILIES" };
}

function pairwise<T>(values: T[]): Array<[T, T]> {
  const pairs: Array<[T, T]> = [];
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) pairs.push([values[i], values[j]]);
  }
  return pairs;
}

function semanticCompatibility(sources: ConvergenceSourceEntry[]): ConvergenceCompatibility {
  const pairs = pairwise(sources);
  if (pairs.length === 0) return "UNKNOWN";
  const matching = pairs.filter(([a, b]) => a.phenomenonTags.some((tag) => b.phenomenonTags.includes(tag))).length;
  if (matching === pairs.length) return "COMPATIBLE";
  if (matching > 0) return "PARTIAL";
  return "INCOMPATIBLE";
}

function aggregateSpatial(sources: ConvergenceSourceEntry[]): ConvergenceSpatialCompatibility {
  const pairs = pairwise(sources);
  if (pairs.length === 0) return "UNKNOWN";
  const relations = pairs.map(([a, b]) => classifyConvergenceSpatialPair(a, b));
  if (relations.includes("SPATIALLY_INCOMPATIBLE")) return "SPATIALLY_INCOMPATIBLE";
  if (relations.includes("SAME_POINT")) return "SAME_POINT";
  if (relations.includes("NEARBY")) return "NEARBY";
  if (relations.includes("SPATIALLY_COMPATIBLE")) return "SPATIALLY_COMPATIBLE";
  return "UNKNOWN";
}

function aggregateTemporal(sources: ConvergenceSourceEntry[]): ConvergenceCompatibility {
  const classes = dedupe(sources.map((source) => source.temporalClass || classifyConvergenceTemporal(source.timestamp)));
  if (classes.length === 0 || (classes.length === 1 && classes[0] === "UNKNOWN")) return "UNKNOWN";
  if (classes.includes("CURRENT") && classes.includes("HISTORICAL")) return "PARTIAL";
  if (classes.includes("UNKNOWN")) return "PARTIAL";
  return "COMPATIBLE";
}

function lineages(sources: ConvergenceSourceEntry[]): CanonicalLineageNode[] {
  const seen = new Set<string>();
  const nodes: CanonicalLineageNode[] = [];
  for (const source of sources) {
    for (const node of source.lineage || []) {
      const key = `${node.type}:${node.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        nodes.push(node);
      }
    }
  }
  return nodes;
}

function sourceRoot(source: ConvergenceSourceEntry): string {
  return source.dependsOnSourceEvidenceIds?.[0] || source.sourceEvidenceId;
}

function calculateScores(input: {
  sources: ConvergenceSourceEntry[];
  contradictingSources: ConvergenceSourceEntry[];
  spatialCompatibility: ConvergenceSpatialCompatibility;
  temporalCompatibility: ConvergenceCompatibility;
  semanticCompatibility: ConvergenceCompatibility;
  dependencies: SourceDependencyRelation[];
  fieldStatus: FieldSupportStatus;
}): ConvergenceMatrixScores {
  const roots = dedupe(input.sources.map(sourceRoot));
  const supportScore = Math.min(1, roots.length / 4);
  const contradictionScore = Math.min(1, input.contradictingSources.length / Math.max(1, input.sources.length));
  const independentPairs = input.dependencies.filter((dependency) => dependency.independence === "INDEPENDENT").length;
  const totalPairs = Math.max(1, input.dependencies.length);
  let independenceScore = independentPairs / totalPairs;
  if (input.sources.length > 1 && roots.length === 1) independenceScore = Math.min(independenceScore, 0.25);
  const spatialScore =
    input.spatialCompatibility === "SAME_POINT" ? 1 :
    input.spatialCompatibility === "NEARBY" ? 0.85 :
    input.spatialCompatibility === "SPATIALLY_COMPATIBLE" || input.spatialCompatibility === "SAME_CORRIDOR" || input.spatialCompatibility === "SAME_POLYGON" ? 0.7 :
    input.spatialCompatibility === "UNKNOWN" ? 0.35 : 0;
  const temporalScore =
    input.temporalCompatibility === "COMPATIBLE" ? 0.85 :
    input.temporalCompatibility === "PARTIAL" ? 0.5 :
    input.temporalCompatibility === "UNKNOWN" ? 0.35 : 0;
  const traceable = input.sources.filter((source) =>
    present(source.sourceEvidenceId) && present(source.traceabilityId) && present(source.geographyId) && validateLineage(source.lineage).status === "SUPPORTED"
  ).length;
  let traceabilityScore = traceable / Math.max(1, input.sources.length);
  if (input.fieldStatus === "fieldSupport") traceabilityScore = Math.min(1, traceabilityScore + 0.08);
  return {
    supportScore: Number(supportScore.toFixed(2)),
    contradictionScore: Number(contradictionScore.toFixed(2)),
    independenceScore: Number(independenceScore.toFixed(2)),
    spatialScore: Number(spatialScore.toFixed(2)),
    temporalScore: Number(temporalScore.toFixed(2)),
    traceabilityScore: Number(traceabilityScore.toFixed(2)),
  };
}

function confidenceFromScores(scores: ConvergenceMatrixScores, fieldStatus: FieldSupportStatus): number {
  const base =
    scores.supportScore * 0.2 +
    scores.independenceScore * 0.18 +
    scores.spatialScore * 0.18 +
    scores.temporalScore * 0.14 +
    (1 - scores.contradictionScore) * 0.15 +
    scores.traceabilityScore * 0.15;
  const fieldAdjustment = fieldStatus === "fieldSupport" ? 0.08 : fieldStatus === "fieldContradiction" ? -0.15 : 0;
  return Number(Math.max(0, Math.min(0.92, base + fieldAdjustment)).toFixed(2));
}

export function buildInstitutionalConvergence(input: {
  expedienteId: string;
  geographyId: string;
  phenomenon: ConvergencePhenomenon;
  sources: ConvergenceSourceEntry[];
  hypothesisRelation?: HypothesisRelation;
  generatedAt?: string;
}): ConvergenceResult {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const usableSources = Array.isArray(input.sources) ? input.sources : [];
  const contradictingSources = usableSources.filter((source) => source.assertion === "ABSENT");
  const supportingSources = usableSources.filter((source) => source.assertion !== "ABSENT");
  const spatialCompatibility = aggregateSpatial(usableSources);
  const temporalCompatibility = aggregateTemporal(usableSources);
  const semCompatibility = semanticCompatibility(usableSources);
  const dependencies = pairwise(usableSources).map(([a, b]) => classifySourceIndependence(a, b));
  const fieldStatus: FieldSupportStatus =
    usableSources.some((source) => source.sourceKind === "FIELD_OBSERVATION" && source.assertion === "PRESENT")
      ? "fieldSupport"
      : usableSources.some((source) => source.sourceKind === "FIELD_OBSERVATION" && source.assertion === "ABSENT")
        ? "fieldContradiction"
        : usableSources.some((source) => source.sourceKind === "FIELD_PHOTO")
          ? "fieldUnknown"
          : "fieldUnknown";
  const scores = calculateScores({
    sources: usableSources,
    contradictingSources,
    spatialCompatibility,
    temporalCompatibility,
    semanticCompatibility: semCompatibility,
    dependencies,
    fieldStatus,
  });
  const lineage = lineages(usableSources);
  const lineageStatus = validateLineage(lineage).status;
  const blockingReasons: string[] = [];
  if (usableSources.some((source) => source.expedienteId !== input.expedienteId)) blockingReasons.push("DIFFERENT_EXPEDIENTE");
  if (usableSources.some((source) => source.geographyId !== input.geographyId)) blockingReasons.push("DIFFERENT_GEOGRAPHY");
  if (spatialCompatibility === "SPATIALLY_INCOMPATIBLE") blockingReasons.push("SPATIAL_INCOMPATIBILITY");
  if (semCompatibility === "INCOMPATIBLE") blockingReasons.push("SEMANTIC_INCOMPATIBILITY");
  if (usableSources.some((source) => !present(source.geographyId))) blockingReasons.push("MISSING_GEOGRAPHY_ID");
  if (usableSources.some((source) => !present(source.traceabilityId))) blockingReasons.push("MISSING_TRACEABILITY_ID");
  if (lineageStatus !== "SUPPORTED") blockingReasons.push(`INVALID_LINEAGE_STATUS:${lineageStatus}`);
  if (usableSources.some((source) => ["MOCK", "SIMULATED", "TEST", "CONNECTIVITY_ONLY"].includes(source.acquisitionMode || ""))) {
    blockingReasons.push("ACQUISITION_MODE_NOT_REPORTABLE");
  }

  const confidence = confidenceFromScores(scores, fieldStatus);
  return {
    convergenceId: `conv:${stableToken(input.expedienteId)}:${stableToken(input.geographyId)}:${stableToken(input.phenomenon)}:${stableToken(usableSources.map((s) => sourceRoot(s)).sort().join("|"))}`,
    expedienteId: input.expedienteId,
    geographyId: input.geographyId,
    phenomenon: input.phenomenon,
    supportingSources,
    contradictingSources,
    sourceEvidenceIds: dedupe(usableSources.map((source) => source.sourceEvidenceId).filter(Boolean)),
    traceabilityIds: dedupe(usableSources.map((source) => source.traceabilityId).filter(Boolean)),
    lineage,
    lineageStatus,
    spatialCompatibility,
    temporalCompatibility,
    semanticCompatibility: semCompatibility,
    sourceDependencies: dependencies,
    fieldStatus,
    hypothesisRelation: input.hypothesisRelation || "INSUFFICIENT",
    confidence,
    confidenceBasis:
      `support=${scores.supportScore}; contradiction=${scores.contradictionScore}; independence=${scores.independenceScore}; ` +
      `spatial=${scores.spatialScore}; temporal=${scores.temporalScore}; traceability=${scores.traceabilityScore}; field=${fieldStatus}.`,
    scoreMatrix: scores,
    limitations: [
      "ConvergenceResult es DERIVED_RELATION y no SOURCE_FACT.",
      "No confirma actividad criminal, ubicacion de pandilla, punto de droga, probabilidad futura ni conducta humana.",
      "Reviews se conservan como contexto generado por usuarios y requieren corroboracion externa.",
      "Fuentes dependientes o derivadas no duplican peso de confianza.",
    ],
    humanReviewStatus: "PENDING_REVIEW",
    blockingReasons: dedupe(blockingReasons),
    producedPrediction: false,
    generatedAt,
  };
}

export function approveConvergenceResult(
  result: ConvergenceResult,
  review: { reviewedBy: string; reviewedAt?: string | null; reviewComment?: string | null }
): ConvergenceResult {
  return {
    ...result,
    humanReviewStatus: "APPROVED",
    reviewedBy: review.reviewedBy,
    reviewedAt: review.reviewedAt || new Date().toISOString(),
    reviewComment: review.reviewComment ?? null,
  };
}

export function rejectConvergenceResult(result: ConvergenceResult): ConvergenceResult {
  return { ...result, humanReviewStatus: "REJECTED" };
}

export function convergenceToInstitutionalCorrelationItem(result: ConvergenceResult): {
  item: InstitutionalCorrelationItem | null;
  blockingReasons: string[];
} {
  const blockingReasons = [...result.blockingReasons];
  if (result.humanReviewStatus !== "APPROVED") blockingReasons.push(`VALIDATION_NOT_APPROVED:${result.humanReviewStatus}`);
  if (!present(result.geographyId)) blockingReasons.push("MISSING_GEOGRAPHY_ID");
  if (result.traceabilityIds.length === 0) blockingReasons.push("MISSING_TRACEABILITY_ID");
  if (result.lineageStatus !== "SUPPORTED") blockingReasons.push(`INVALID_LINEAGE_STATUS:${result.lineageStatus}`);
  if (blockingReasons.length > 0) return { item: null, blockingReasons: dedupe(blockingReasons) };

  const firstCoordinate = result.supportingSources.find((source) => source.coordinates)?.coordinates || null;
  return {
    item: {
      id: result.convergenceId,
      sourceType: "INSTITUTIONAL_CONVERGENCE_RESULT",
      providerId: "CEIPOL_MULTISOURCE_CONVERGENCE",
      sourceEvidenceId: result.sourceEvidenceIds[0],
      traceabilityId: result.traceabilityIds[0],
      expedienteId: result.expedienteId,
      geographyId: result.geographyId,
      coordinates: firstCoordinate,
      observedAt: result.generatedAt,
      acquiredAt: result.generatedAt,
      semanticRole: "INFERENCE",
      epistemicIntegrity: {
        providerId: "CEIPOL_MULTISOURCE_CONVERGENCE",
        sourceType: "INSTITUTIONAL_CONVERGENCE_RESULT",
        acquisitionMode: "DERIVED",
        acquisitionStatus: "ACQUIRED",
        semanticRole: "INFERENCE",
        validationStatus: "APPROVED",
        isDerived: true,
        isSimulated: false,
        isConnectivityOnly: false,
        observedAt: result.generatedAt,
        acquiredAt: result.generatedAt,
        generatedAt: result.generatedAt,
        traceabilityId: result.traceabilityIds[0],
        lineage: result.lineage.map((node) => ({
          sourceId: node.sourceId ?? node.id,
          providerId: "CEIPOL_MULTISOURCE_CONVERGENCE",
          sourceType: node.type,
          sourceReference: node.sourceReference ?? node.id,
          traceabilityId: result.traceabilityIds[0],
          acquisitionMode: "DERIVED",
        })),
      },
      payload: {
        assertion: "PRESENT",
        findingType: result.phenomenon,
        phenomenon: result.phenomenon,
        sourceEvidenceIds: result.sourceEvidenceIds,
        traceabilityIds: result.traceabilityIds,
        spatialCompatibility: result.spatialCompatibility,
        temporalCompatibility: result.temporalCompatibility,
        semanticCompatibility: result.semanticCompatibility,
        confidence: result.confidence,
        confidenceBasis: result.confidenceBasis,
        limitations: result.limitations,
        producedPrediction: result.producedPrediction,
      },
      reference: result.sourceEvidenceIds.join(" | "),
      lineage: result.lineage,
      category: result.phenomenon,
      tags: [result.phenomenon, "DERIVED_RELATION", "PENDING_PREDICTIVE_EXCLUSION"],
    },
    blockingReasons: [],
  };
}
