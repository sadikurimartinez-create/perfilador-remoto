import { validateLineage } from "@/utils/evidenceLineage";
import {
  getPredictiveProductStatus,
  type CanonicalGeographyKind,
  type PredictiveAnalyticalProduct,
  type PredictiveProductStatus,
} from "@/utils/predictiveAnalyticalProducts";

export type ContextualizedPredictivePolicy = "BLOCK" | "WARN";

export interface PredictiveProductAdmissionContext {
  expedienteId?: string | null;
  geographyId?: string | null;
  canonicalGeographyType?: CanonicalGeographyKind | null;
  now?: Date;
  contextualizedPolicy?: ContextualizedPredictivePolicy;
}

export interface PredictiveProductAdmissionResult {
  productId: string;
  admissible: boolean;
  status: PredictiveProductStatus;
  reasons: string[];
  warnings: string[];
}

export interface PersistedPredictiveProductRecord {
  productId: string;
  expedienteId: string;
  geographyId: string;
  canonicalGeographyType: PredictiveAnalyticalProduct["canonicalGeographyType"];
  productType: PredictiveAnalyticalProduct["productType"];
  analyticalLevel: PredictiveAnalyticalProduct["analyticalLevel"];
  trend: PredictiveAnalyticalProduct["trend"];
  scenario: PredictiveAnalyticalProduct["scenario"];
  supportingFactors: string[];
  contradictingFactors: string[];
  limitations: string[];
  confidence: number;
  uncertaintyLevel: PredictiveAnalyticalProduct["uncertaintyLevel"];
  validUntil: string;
  hypothesisRelation: PredictiveAnalyticalProduct["hypothesisRelation"];
  fieldStatus: PredictiveAnalyticalProduct["fieldStatus"];
  humanReviewStatus: PredictiveAnalyticalProduct["humanReviewStatus"];
  reviewedBy: string;
  reviewedAt: string;
  reviewComment: string | null;
  traceabilityIds: string[];
  lineage: PredictiveAnalyticalProduct["lineage"];
  supportingConvergences: string[];
  generatedAt: string;
  persistedAt: string;
  epistemicRole: "ANALYTICAL_PROJECTION";
  producedFromApprovedConvergences: true;
}

export interface PredictiveReportSelection {
  products: PredictiveAnalyticalProduct[];
  exclusions: Array<{ productId: string; reasonCode: string; reason: string }>;
}

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function productId(product: any): string {
  return String(product?.productId || product?.id || "PREDICTIVE_PRODUCT_UNAVAILABLE");
}

function hasBlockedSourceMarker(product: any): boolean {
  const markers = [
    product?.sourceStatus,
    product?.sourceType,
    product?.acquisitionMode,
    product?.lineageStatus,
    product?.evidenceClass,
  ].map((value) => String(value || "").toUpperCase());
  return markers.some((value) => /MOCK|SIMULATED|TEST|CONNECTIVITY_ONLY|LEGACY/.test(value));
}

function normalizeGeographyType(value: unknown): CanonicalGeographyKind | null {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "INDIVIDUAL" || normalized === "POINT") return "POINT";
  if (normalized === "CORRIDOR") return "CORRIDOR";
  if (normalized === "POLYGON") return "POLYGON";
  if (normalized === "MULTIPOLYGON") return "MULTIPOLYGON";
  return null;
}

export function evaluatePredictiveProductAdmission(
  product: PredictiveAnalyticalProduct | any,
  context: PredictiveProductAdmissionContext = {}
): PredictiveProductAdmissionResult {
  const now = context.now || new Date();
  const status = getPredictiveProductStatus(product as PredictiveAnalyticalProduct, now);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (product?.humanReviewStatus === "CONTEXTUALIZED") {
    if ((context.contextualizedPolicy || "BLOCK") === "WARN") {
      warnings.push("CONTEXTUALIZED_REQUIRES_DISCLOSURE");
    } else {
      reasons.push("CONTEXTUALIZED_NOT_REPORTABLE_WITHOUT_NEW_APPROVAL");
    }
  } else if (product?.humanReviewStatus !== "APPROVED") {
    reasons.push(`PREDICTIVE_PRODUCT_NOT_APPROVED:${product?.humanReviewStatus || "UNKNOWN"}`);
  }

  if (status === "STALE") reasons.push("PREDICTIVE_PRODUCT_STALE");
  if (status === "REJECTED") reasons.push("PREDICTIVE_PRODUCT_REJECTED");
  if (product?.epistemicRole !== "ANALYTICAL_PROJECTION") reasons.push("PREDICTIVE_PRODUCT_INVALID_EPISTEMIC_ROLE");
  if (product?.producedFromApprovedConvergences !== true) reasons.push("PREDICTIVE_PRODUCT_WITHOUT_APPROVED_CONVERGENCES");
  if (!clean(product?.reviewedBy)) reasons.push("PREDICTIVE_PRODUCT_MISSING_REVIEWER");
  if (!clean(product?.reviewedAt)) reasons.push("PREDICTIVE_PRODUCT_MISSING_REVIEWED_AT");
  if (!clean(product?.geographyId)) reasons.push("PREDICTIVE_PRODUCT_MISSING_GEOGRAPHY");
  if (context.geographyId && product?.geographyId !== context.geographyId) reasons.push("PREDICTIVE_PRODUCT_WRONG_GEOGRAPHY");
  if (context.expedienteId && product?.expedienteId !== context.expedienteId) reasons.push("PREDICTIVE_PRODUCT_WRONG_EXPEDIENTE");
  const contextGeographyType = normalizeGeographyType(context.canonicalGeographyType);
  const productGeographyType = normalizeGeographyType(product?.canonicalGeographyType);
  if (contextGeographyType && productGeographyType !== contextGeographyType) {
    reasons.push("PREDICTIVE_PRODUCT_GEOGRAPHY_TYPE_MISMATCH");
  }
  if (asArray(product?.traceabilityIds).length === 0) reasons.push("PREDICTIVE_PRODUCT_MISSING_TRACEABILITY");
  if (asArray(product?.lineage).length === 0 || validateLineage(product?.lineage).status !== "SUPPORTED") {
    reasons.push("PREDICTIVE_PRODUCT_INVALID_LINEAGE");
  }
  if (asArray(product?.blockingReasons).length > 0) reasons.push("PREDICTIVE_PRODUCT_HAS_BLOCKING_REASONS");
  if (hasBlockedSourceMarker(product)) reasons.push("PREDICTIVE_PRODUCT_UNTRUSTED_SOURCE_MARKER");

  const validUntil = Date.parse(product?.validUntil || "");
  if (!Number.isFinite(validUntil)) reasons.push("PREDICTIVE_PRODUCT_INVALID_VALID_UNTIL");
  if (Number.isFinite(validUntil) && validUntil < now.getTime()) reasons.push("PREDICTIVE_PRODUCT_EXPIRED");

  return {
    productId: productId(product),
    admissible: reasons.length === 0,
    status,
    reasons: Array.from(new Set(reasons)),
    warnings: Array.from(new Set(warnings)),
  };
}

export function toPersistedPredictiveProductRecord(
  product: PredictiveAnalyticalProduct,
  options: { persistedAt?: string } = {}
): PersistedPredictiveProductRecord {
  const admission = evaluatePredictiveProductAdmission(product, { now: new Date(options.persistedAt || Date.now()) });
  if (!admission.admissible) {
    throw new Error(`PREDICTIVE_PRODUCT_PERSISTENCE_BLOCKED:${admission.reasons.join(",")}`);
  }
  return {
    productId: product.productId,
    expedienteId: product.expedienteId,
    geographyId: product.geographyId,
    canonicalGeographyType: product.canonicalGeographyType,
    productType: product.productType,
    analyticalLevel: product.analyticalLevel,
    trend: product.trend,
    scenario: product.scenario,
    supportingFactors: [...product.supportingFactors],
    contradictingFactors: [...product.contradictingFactors],
    limitations: [...product.limitations],
    confidence: product.confidence,
    uncertaintyLevel: product.uncertaintyLevel,
    validUntil: product.validUntil,
    hypothesisRelation: product.hypothesisRelation,
    fieldStatus: product.fieldStatus,
    humanReviewStatus: product.humanReviewStatus,
    reviewedBy: product.reviewedBy as string,
    reviewedAt: product.reviewedAt as string,
    reviewComment: product.reviewComment ?? null,
    traceabilityIds: [...product.traceabilityIds],
    lineage: [...product.lineage],
    supportingConvergences: [...product.supportingConvergences],
    generatedAt: product.temporalWindow.generatedAt,
    persistedAt: options.persistedAt || new Date().toISOString(),
    epistemicRole: "ANALYTICAL_PROJECTION",
    producedFromApprovedConvergences: true,
  };
}

export function persistApprovedPredictiveProductToExpediente<T extends Record<string, any>>(
  project: T,
  product: PredictiveAnalyticalProduct,
  options: { persistedAt?: string } = {}
): T & {
  predictiveAnalyticalProducts: PersistedPredictiveProductRecord[];
  predictiveAnalyticalProductHistory: PersistedPredictiveProductRecord[];
} {
  const record = toPersistedPredictiveProductRecord(product, options);
  const current = asArray<PersistedPredictiveProductRecord>(project.predictiveAnalyticalProducts)
    .filter((item) => item.productId !== record.productId);
  const history = asArray<PersistedPredictiveProductRecord>(project.predictiveAnalyticalProductHistory);
  return {
    ...project,
    predictiveAnalyticalProducts: [...current, record],
    predictiveAnalyticalProductHistory: [...history, record],
  };
}

export function selectPredictiveProductsForInstitutionalReport(
  project: any,
  context: PredictiveProductAdmissionContext = {}
): PredictiveReportSelection {
  const products = [
    ...asArray<PredictiveAnalyticalProduct>(project?.predictiveAnalyticalProducts),
    ...asArray<PredictiveAnalyticalProduct>(project?.analyticalProducts),
    ...asArray<PredictiveAnalyticalProduct>(project?.approvedPredictiveProducts),
  ];
  const seen = new Set<string>();
  const selected: PredictiveAnalyticalProduct[] = [];
  const exclusions: PredictiveReportSelection["exclusions"] = [];

  for (const product of products) {
    const id = productId(product);
    if (seen.has(id)) continue;
    seen.add(id);
    const admission = evaluatePredictiveProductAdmission(product, {
      expedienteId: context.expedienteId ?? project?.expedienteId ?? project?.projectId ?? project?.id ?? null,
      geographyId: context.geographyId ?? project?.geographyId ?? project?.canonicalGeography?.geographyId ?? null,
      canonicalGeographyType: context.canonicalGeographyType ?? project?.canonicalGeography?.type ?? null,
      now: context.now,
      contextualizedPolicy: context.contextualizedPolicy,
    });
    if (admission.admissible) {
      selected.push(product);
    } else {
      admission.reasons.forEach((reason) => exclusions.push({ productId: id, reasonCode: reason, reason }));
    }
  }

  return { products: selected, exclusions };
}

export function renderPredictiveProductsForInstitutionalReport(products: PredictiveAnalyticalProduct[]): string {
  if (products.length === 0) return "";
  return products.map((product) => [
    `ANALISIS PROSPECTIVO - ${product.productType}`,
    `El analisis prospectivo identifica un escenario ${product.scenario} con tendencia ${product.trend}.`,
    `Los datos disponibles son compatibles con nivel ${product.analyticalLevel}, confianza ${product.confidence} e incertidumbre ${product.uncertaintyLevel}.`,
    `Factores de soporte: ${product.supportingFactors.join("; ") || "sin factores adicionales"}.`,
    `Contradicciones: ${product.contradictingFactors.join("; ") || "sin contradicciones registradas"}.`,
    `Limitaciones: ${product.limitations.join("; ")}.`,
    `Vigencia: ${product.validUntil}. Revision PPC: ${product.reviewedBy || "N/D"} ${product.reviewedAt || ""}.`,
  ].join("\n")).join("\n\n");
}
