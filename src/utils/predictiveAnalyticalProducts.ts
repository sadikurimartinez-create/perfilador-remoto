import type { CanonicalLineageNode } from "@/utils/evidenceLineage";
import type {
  ConvergencePhenomenon,
  ConvergenceResult,
  FieldSupportStatus,
  HypothesisRelation,
} from "@/utils/institutionalMultisourceConvergence";

export type PredictiveProductType =
  | "SPATIAL_PERSISTENCE_OUTLOOK"
  | "TEMPORAL_PERSISTENCE_OUTLOOK"
  | "ACCESSIBILITY_CHANGE_SCENARIO"
  | "FUNCTIONAL_ACTIVITY_SCENARIO"
  | "PHYSICAL_ENVIRONMENT_SCENARIO"
  | "OPERATIONAL_STATUS_SCENARIO"
  | "TERRITORIAL_PRESSURE_INDICATOR"
  | "CORRIDOR_ACTIVITY_OUTLOOK"
  | "FIELD_VALIDATED_TREND"
  | "CONTRADICTION_DRIVEN_UNCERTAINTY";

export type AnalyticalLevel = "DESCRIPTIVE" | "TREND" | "PROSPECTIVE_SCENARIO";
export type PredictiveTrend = "INCREASING" | "DECREASING" | "STABLE" | "INTERMITTENT" | "INSUFFICIENT_DATA" | "UNKNOWN";
export type PredictiveScenario = "PERSISTENCE" | "INTENSIFICATION" | "REDUCTION" | "DISPLACEMENT" | "RECONFIGURATION" | "INSUFFICIENT_EVIDENCE";
export type UncertaintyLevel = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
export type PredictiveProductStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "CONTEXTUALIZED" | "STALE";
export type CanonicalGeographyKind = "POINT" | "CORRIDOR" | "POLYGON" | "MULTIPOLYGON";

export interface PredictiveTemporalWindow {
  analysisWindowStart: string | null;
  analysisWindowEnd: string | null;
  generatedAt: string;
  validUntil: string;
  temporalAssumptions: string[];
}

export interface PredictiveScoreMatrix {
  trendScore: number;
  persistenceScore: number;
  contradictionPenalty: number;
  temporalDepthScore: number;
  fieldSupportScore: number;
  sourceIndependenceScore: number;
  traceabilityScore: number;
  finalConfidence: number;
}

export interface PredictiveAnalyticalProduct {
  productId: string;
  expedienteId: string;
  geographyId: string;
  canonicalGeographyType: CanonicalGeographyKind;
  productType: PredictiveProductType;
  analyticalLevel: AnalyticalLevel;
  trend: PredictiveTrend;
  scenario: PredictiveScenario;
  supportingConvergences: string[];
  contradictingConvergences: string[];
  supportingFactors: string[];
  contradictingFactors: string[];
  assumptions: string[];
  limitations: string[];
  confidence: number;
  confidenceBasis: string;
  uncertaintyLevel: UncertaintyLevel;
  uncertaintyReasons: string[];
  temporalWindow: PredictiveTemporalWindow;
  validUntil: string;
  hypothesisRelation: HypothesisRelation;
  fieldStatus: FieldSupportStatus;
  epistemicRole: "ANALYTICAL_PROJECTION";
  humanReviewStatus: PredictiveProductStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  lineage: CanonicalLineageNode[];
  traceabilityIds: string[];
  producedFromApprovedConvergences: true;
  blockingReasons: string[];
  producedPersonalPrediction: false;
  producedCrimeOccurrenceCertainty: false;
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

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function convergenceTime(convergence: ConvergenceResult): number | null {
  const time = Date.parse(convergence.generatedAt);
  return Number.isFinite(time) ? time : null;
}

function temporalPeriods(convergences: ConvergenceResult[]): string[] {
  return dedupe(
    convergences
      .map((convergence) => {
        const time = convergenceTime(convergence);
        if (time === null) return null;
        const date = new Date(time);
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      })
      .filter((value): value is string => Boolean(value))
  );
}

function validateConvergences(input: {
  expedienteId: string;
  geographyId: string;
  convergences: ConvergenceResult[];
}): string[] {
  const reasons: string[] = [];
  if (!Array.isArray(input.convergences) || input.convergences.length === 0) reasons.push("MISSING_APPROVED_CONVERGENCES");
  for (const convergence of input.convergences || []) {
    if (convergence.humanReviewStatus !== "APPROVED") reasons.push(`CONVERGENCE_NOT_APPROVED:${convergence.convergenceId}`);
    if (convergence.expedienteId !== input.expedienteId) reasons.push(`DIFFERENT_EXPEDIENTE:${convergence.convergenceId}`);
    if (convergence.geographyId !== input.geographyId) reasons.push(`DIFFERENT_GEOGRAPHY:${convergence.convergenceId}`);
    if (!present(convergence.geographyId)) reasons.push(`MISSING_GEOGRAPHY_ID:${convergence.convergenceId}`);
    if (convergence.traceabilityIds.length === 0) reasons.push(`MISSING_TRACEABILITY_ID:${convergence.convergenceId}`);
    if (convergence.lineageStatus !== "SUPPORTED" || convergence.lineage.length === 0) reasons.push(`INVALID_LINEAGE:${convergence.convergenceId}`);
    if (convergence.blockingReasons.some((reason) => /MOCK|SIMULATED|TEST|CONNECTIVITY_ONLY|LEGACY|ACQUISITION_MODE_NOT_REPORTABLE/.test(reason))) {
      reasons.push(`CONVERGENCE_NOT_PRODUCTIVE:${convergence.convergenceId}`);
    }
    if (convergence.blockingReasons.length > 0) reasons.push(`CONVERGENCE_HAS_BLOCKING_REASONS:${convergence.convergenceId}`);
  }
  return dedupe(reasons);
}

function scoreTrend(convergences: ConvergenceResult[]): { trend: PredictiveTrend; trendScore: number } {
  const periods = temporalPeriods(convergences);
  if (periods.length < 2) return { trend: "INSUFFICIENT_DATA", trendScore: 0 };
  const sorted = [...convergences].sort((a, b) => (convergenceTime(a) ?? 0) - (convergenceTime(b) ?? 0));
  const first = sorted[0].confidence;
  const last = sorted[sorted.length - 1].confidence;
  const delta = last - first;
  if (Math.abs(delta) <= 0.05) return { trend: "STABLE", trendScore: 0.55 };
  if (delta > 0.05) return { trend: "INCREASING", trendScore: Math.min(0.85, 0.55 + delta) };
  return { trend: "DECREASING", trendScore: Math.min(0.85, 0.55 + Math.abs(delta)) };
}

function resolveLevel(trend: PredictiveTrend, desired?: AnalyticalLevel): AnalyticalLevel {
  if (desired === "DESCRIPTIVE") return "DESCRIPTIVE";
  if (trend === "INSUFFICIENT_DATA" || trend === "UNKNOWN") return "DESCRIPTIVE";
  return desired || "TREND";
}

function resolveScenario(input: {
  level: AnalyticalLevel;
  trend: PredictiveTrend;
  contradictionPenalty: number;
  fieldStatus: FieldSupportStatus;
  historicalOnly: boolean;
}): PredictiveScenario {
  if (input.level !== "PROSPECTIVE_SCENARIO") return input.trend === "INSUFFICIENT_DATA" ? "INSUFFICIENT_EVIDENCE" : "PERSISTENCE";
  if (input.historicalOnly || input.fieldStatus === "fieldContradiction" || input.contradictionPenalty >= 0.45) return "INSUFFICIENT_EVIDENCE";
  if (input.trend === "INCREASING") return "INTENSIFICATION";
  if (input.trend === "DECREASING") return "REDUCTION";
  if (input.trend === "STABLE") return "PERSISTENCE";
  if (input.trend === "INTERMITTENT") return "RECONFIGURATION";
  return "INSUFFICIENT_EVIDENCE";
}

function confidenceScores(convergences: ConvergenceResult[], trendScore: number, fieldStatus: FieldSupportStatus): PredictiveScoreMatrix {
  const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const persistenceScore = Math.min(1, convergences.filter((c) => c.semanticCompatibility !== "INCOMPATIBLE").length / 2);
  const contradictionPenalty = avg(convergences.map((c) => c.scoreMatrix.contradictionScore));
  const temporalDepthScore = Math.min(1, temporalPeriods(convergences).length / 3);
  const fieldSupportScore = fieldStatus === "fieldSupport" ? 0.12 : fieldStatus === "fieldContradiction" ? -0.2 : 0;
  const sourceIndependenceScore = avg(convergences.map((c) => c.scoreMatrix.independenceScore));
  const traceabilityScore = avg(convergences.map((c) => c.scoreMatrix.traceabilityScore));
  const convergenceConfidence = avg(convergences.map((c) => c.confidence));
  const raw =
    convergenceConfidence * 0.28 +
    sourceIndependenceScore * 0.18 +
    traceabilityScore * 0.16 +
    temporalDepthScore * 0.14 +
    persistenceScore * 0.12 +
    trendScore * 0.08 -
    contradictionPenalty * 0.18 +
    fieldSupportScore;
  const finalConfidence = Number(Math.max(0.05, Math.min(0.9, raw)).toFixed(2));
  return {
    trendScore: Number(trendScore.toFixed(2)),
    persistenceScore: Number(persistenceScore.toFixed(2)),
    contradictionPenalty: Number(contradictionPenalty.toFixed(2)),
    temporalDepthScore: Number(temporalDepthScore.toFixed(2)),
    fieldSupportScore: Number(fieldSupportScore.toFixed(2)),
    sourceIndependenceScore: Number(sourceIndependenceScore.toFixed(2)),
    traceabilityScore: Number(traceabilityScore.toFixed(2)),
    finalConfidence,
  };
}

function uncertainty(scores: PredictiveScoreMatrix, convergences: ConvergenceResult[]): { level: UncertaintyLevel; reasons: string[] } {
  const reasons: string[] = [];
  if (convergences.length < 2) reasons.push("data_gap");
  if (scores.temporalDepthScore < 0.67) reasons.push("temporal_gap");
  if (scores.sourceIndependenceScore < 0.5) reasons.push("source_dependency");
  if (scores.contradictionPenalty >= 0.3) reasons.push("contradiction");
  if (!convergences.some((c) => c.fieldStatus === "fieldSupport")) reasons.push("insufficient_field_validation");
  if (convergences.some((c) => c.spatialCompatibility === "UNKNOWN")) reasons.push("geography_uncertainty");
  if (convergences.every((c) => c.temporalCompatibility === "PARTIAL")) reasons.push("stale_data");
  const level: UncertaintyLevel =
    reasons.length >= 5 || scores.finalConfidence < 0.35 ? "VERY_HIGH" :
    reasons.length >= 3 || scores.finalConfidence < 0.5 ? "HIGH" :
    reasons.length >= 1 || scores.finalConfidence < 0.7 ? "MODERATE" : "LOW";
  return { level, reasons: dedupe(reasons) };
}

function productTypeFor(phenomenon: ConvergencePhenomenon, geographyType: CanonicalGeographyKind, contradictionPenalty: number): PredictiveProductType {
  if (contradictionPenalty >= 0.3) return "CONTRADICTION_DRIVEN_UNCERTAINTY";
  if (geographyType === "CORRIDOR") return "CORRIDOR_ACTIVITY_OUTLOOK";
  if (phenomenon.includes("ROUTE")) return "ACCESSIBILITY_CHANGE_SCENARIO";
  if (phenomenon.includes("FUNCTIONAL")) return "FUNCTIONAL_ACTIVITY_SCENARIO";
  if (phenomenon.includes("OPERATIONAL")) return "OPERATIONAL_STATUS_SCENARIO";
  if (phenomenon.includes("TOPOGRAPHIC")) return "TERRITORIAL_PRESSURE_INDICATOR";
  return "SPATIAL_PERSISTENCE_OUTLOOK";
}

function collectLineage(convergences: ConvergenceResult[]): CanonicalLineageNode[] {
  const seen = new Set<string>();
  const nodes: CanonicalLineageNode[] = [];
  for (const convergence of convergences) {
    for (const node of convergence.lineage) {
      const key = `${node.type}:${node.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        nodes.push(node);
      }
    }
  }
  return nodes;
}

export function buildPredictiveAnalyticalProduct(input: {
  expedienteId: string;
  geographyId: string;
  canonicalGeographyType: CanonicalGeographyKind;
  approvedConvergences: ConvergenceResult[];
  analyticalLevel?: AnalyticalLevel;
  hypothesisRelation?: HypothesisRelation;
  generatedAt?: string;
}): { product: PredictiveAnalyticalProduct | null; blockingReasons: string[] } {
  const blockingReasons = validateConvergences({
    expedienteId: input.expedienteId,
    geographyId: input.geographyId,
    convergences: input.approvedConvergences,
  });
  if (blockingReasons.length > 0) return { product: null, blockingReasons };

  const generatedAt = input.generatedAt || new Date().toISOString();
  const times = input.approvedConvergences.map(convergenceTime).filter((time): time is number => time !== null);
  const analysisWindowStart = times.length ? new Date(Math.min(...times)).toISOString() : null;
  const analysisWindowEnd = times.length ? new Date(Math.max(...times)).toISOString() : null;
  const historicalOnly = input.approvedConvergences.every((c) => c.temporalCompatibility === "PARTIAL" || c.temporalCompatibility === "UNKNOWN");
  const trend = scoreTrend(input.approvedConvergences);
  const level = resolveLevel(trend.trend, input.analyticalLevel);
  const fieldStatus = input.approvedConvergences.some((c) => c.fieldStatus === "fieldContradiction")
    ? "fieldContradiction"
    : input.approvedConvergences.some((c) => c.fieldStatus === "fieldSupport")
      ? "fieldSupport"
      : "fieldUnknown";
  const preliminaryScores = confidenceScores(input.approvedConvergences, trend.trendScore, fieldStatus);
  const scenario = resolveScenario({
    level,
    trend: trend.trend,
    contradictionPenalty: preliminaryScores.contradictionPenalty,
    fieldStatus,
    historicalOnly,
  });
  const scores = scenario === "INSUFFICIENT_EVIDENCE"
    ? { ...preliminaryScores, finalConfidence: Number(Math.min(preliminaryScores.finalConfidence, 0.45).toFixed(2)) }
    : preliminaryScores;
  const uncertaintyInfo = uncertainty(scores, input.approvedConvergences);
  const phenomenon = input.approvedConvergences[0].phenomenon;
  const validDays = historicalOnly ? 14 : uncertaintyInfo.level === "LOW" ? 90 : uncertaintyInfo.level === "MODERATE" ? 60 : 30;
  const validUntil = addDays(generatedAt, validDays);
  const supporting = input.approvedConvergences.filter((c) => c.contradictingSources.length === 0);
  const contradicting = input.approvedConvergences.filter((c) => c.contradictingSources.length > 0 || c.scoreMatrix.contradictionScore > 0);

  const product: PredictiveAnalyticalProduct = {
    productId: `pap:${stableToken(input.expedienteId)}:${stableToken(input.geographyId)}:${stableToken(phenomenon)}:${stableToken(generatedAt)}`,
    expedienteId: input.expedienteId,
    geographyId: input.geographyId,
    canonicalGeographyType: input.canonicalGeographyType,
    productType: productTypeFor(phenomenon, input.canonicalGeographyType, scores.contradictionPenalty),
    analyticalLevel: level,
    trend: trend.trend,
    scenario,
    supportingConvergences: supporting.map((c) => c.convergenceId),
    contradictingConvergences: contradicting.map((c) => c.convergenceId),
    supportingFactors: dedupe(input.approvedConvergences.flatMap((c) => [c.phenomenon, c.spatialCompatibility, c.temporalCompatibility, c.semanticCompatibility])),
    contradictingFactors: dedupe(input.approvedConvergences.flatMap((c) => c.contradictingSources.map((source) => source.sourceId))),
    assumptions: [
      "El producto se deriva exclusivamente de ConvergenceResult aprobados por PPC.",
      "La geografia canonica se mantiene como unidad de analisis y no se generan geometrias nuevas.",
      "La tendencia requiere al menos dos periodos temporales distintos.",
    ],
    limitations: [
      "Producto prospectivo, no SOURCE_FACT y no conclusion penal.",
      "No predice culpabilidad, reincidencia individual, intencion criminal ni conducta de personas identificables.",
      "No afirma que ocurrira un delito ni expresa porcentajes de probabilidad criminal.",
      ...(historicalOnly ? ["Datos historicos no sostienen escenario actual sin verificacion reciente."] : []),
      ...(scenario === "INSUFFICIENT_EVIDENCE" ? ["Evidencia insuficiente para escenario prospectivo robusto."] : []),
    ],
    confidence: scores.finalConfidence,
    confidenceBasis:
      `confidence=${scores.finalConfidence}; trend=${scores.trendScore}; persistence=${scores.persistenceScore}; ` +
      `contradictionPenalty=${scores.contradictionPenalty}; temporalDepth=${scores.temporalDepthScore}; ` +
      `fieldSupport=${scores.fieldSupportScore}; independence=${scores.sourceIndependenceScore}; traceability=${scores.traceabilityScore}.`,
    uncertaintyLevel: uncertaintyInfo.level,
    uncertaintyReasons: uncertaintyInfo.reasons,
    temporalWindow: {
      analysisWindowStart,
      analysisWindowEnd,
      generatedAt,
      validUntil,
      temporalAssumptions: [
        "CURRENT, RECENT, HISTORICAL y UNKNOWN se heredan desde las convergencias.",
        "Una observacion unica permite descripcion, no tendencia.",
      ],
    },
    validUntil,
    hypothesisRelation: input.hypothesisRelation || input.approvedConvergences[0].hypothesisRelation,
    fieldStatus,
    epistemicRole: "ANALYTICAL_PROJECTION",
    humanReviewStatus: "PENDING_REVIEW",
    lineage: collectLineage(input.approvedConvergences),
    traceabilityIds: dedupe(input.approvedConvergences.flatMap((c) => c.traceabilityIds)),
    producedFromApprovedConvergences: true,
    blockingReasons: [],
    producedPersonalPrediction: false,
    producedCrimeOccurrenceCertainty: false,
  };
  return { product, blockingReasons: [] };
}

export function approvePredictiveAnalyticalProduct(
  product: PredictiveAnalyticalProduct,
  review: { reviewedBy: string; reviewedAt?: string | null; reviewComment?: string | null }
): PredictiveAnalyticalProduct {
  return {
    ...product,
    humanReviewStatus: "APPROVED",
    reviewedBy: review.reviewedBy,
    reviewedAt: review.reviewedAt || new Date().toISOString(),
    reviewComment: review.reviewComment ?? null,
  };
}

export function rejectPredictiveAnalyticalProduct(product: PredictiveAnalyticalProduct): PredictiveAnalyticalProduct {
  return { ...product, humanReviewStatus: "REJECTED" };
}

export function getPredictiveProductStatus(product: PredictiveAnalyticalProduct, now: Date = new Date()): PredictiveProductStatus {
  if (product.humanReviewStatus === "REJECTED") return "REJECTED";
  if (Date.parse(product.validUntil) < now.getTime()) return "STALE";
  return product.humanReviewStatus;
}
