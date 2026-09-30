import type { StructuredTableInput } from "@/utils/documentTableRenderer";
import {
  DENUE_ANALYTICAL_PRODUCT_TYPE,
  type DenueAnalyticalCartographicProduct,
  type DenueAnalyticalCartographicProductResult,
} from "@/utils/denueAnalyticalCartographicProduct";
import {
  buildDenueAnalyticalMapRenderModel,
  type DenueAnalyticalMapRenderModel,
} from "@/utils/denueAnalyticalMapRendering";
import {
  buildDenueAnalyticalMapImagePlan,
  type DenueAnalyticalMapImagePlan,
} from "@/utils/denueAnalyticalMapImageRenderer";

export const DENUE_ANALYTICAL_DOCUMENT_KIND = "DENUE_ANALYTICAL_B6G" as const;

export interface DenueAnalyticalTraceabilityEntry {
  relationId: string;
  denueLayerId: string;
  sourceEvidenceId: string;
  relationTypes: string[];
  ppcReviewer: string;
  ppcTimestamp: string;
  ppcRationale: string;
  relationFingerprint: string;
  methodologyVersion: string;
  publicationDecision: "ELIGIBLE";
  displayStatus: "DISPLAYED" | "ELIGIBLE_NOT_DISPLAYED";
  omissionReason: string | null;
}

export interface DenueAnalyticalDocumentUnit {
  kind: typeof DENUE_ANALYTICAL_DOCUMENT_KIND;
  visualId: string;
  renderModel: DenueAnalyticalMapRenderModel;
  imagePlan: DenueAnalyticalMapImagePlan;
  visualProduct: Record<string, unknown>;
  companionTable: StructuredTableInput & {
    rowBindings: Array<{ displayLabel: string; rowId: string; denueLayerId: string; relationIds: string[] }>;
  };
  traceability: DenueAnalyticalTraceabilityEntry[];
}

export type DenueAnalyticalDocumentIntegrationResult =
  | { status: "READY"; sourcePresent: true; unit: DenueAnalyticalDocumentUnit; reasons: [] }
  | { status: "EMPTY"; sourcePresent: boolean; unit: null; reasons: [] }
  | { status: "REJECTED"; sourcePresent: true; unit: null; reasons: string[] };

type Source = DenueAnalyticalCartographicProduct | DenueAnalyticalCartographicProductResult | null | undefined;

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function textList(values: unknown[]): string {
  return values.map(String).filter(Boolean).join("; ") || "NO CONSIGNADO";
}

function isSupportedSource(value: unknown): value is Exclude<Source, null | undefined> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.analyticalProductType === DENUE_ANALYTICAL_PRODUCT_TYPE ||
    candidate.status === "BUILT" || candidate.status === "EMPTY" || candidate.status === "REJECTED";
}

function productFromSource(source: Exclude<Source, null | undefined>): DenueAnalyticalCartographicProduct | null {
  if ("status" in source) return source.status === "BUILT" ? source.product : null;
  return source;
}

export function integrateDenueAnalyticalDocument(source: Source): DenueAnalyticalDocumentIntegrationResult {
  if (source == null) return { status: "EMPTY", sourcePresent: false, unit: null, reasons: [] };
  if (!isSupportedSource(source)) return { status: "REJECTED", sourcePresent: true, unit: null, reasons: ["B6E_CARTOGRAPHIC_PRODUCT_REQUIRED"] };
  if ("status" in source && source.status === "EMPTY" && source.rejectedRelations.length > 0) {
    return {
      status: "REJECTED",
      sourcePresent: true,
      unit: null,
      reasons: source.rejectedRelations.flatMap((entry) => entry.reasons.map((reason) => `${entry.relationId}:${reason}`)),
    };
  }
  const renderResult = buildDenueAnalyticalMapRenderModel(source);
  if (renderResult.status === "EMPTY") return { status: "EMPTY", sourcePresent: true, unit: null, reasons: [] };
  if (renderResult.status === "REJECTED") return { status: "REJECTED", sourcePresent: true, unit: null, reasons: renderResult.reasons };

  const product = productFromSource(source);
  if (!product) return { status: "REJECTED", sourcePresent: true, unit: null, reasons: ["B6E_PRODUCT_REQUIRED"] };
  const model = renderResult.model;
  const decisionByRelationId = new Map(product.publicationDecisions.map((decision) => [decision.relationId, decision]));
  const displayedRelationIds = new Set(model.markers.flatMap((marker) => marker.relationIds));
  const traceability = product.eligibleRelations.map((relation) => {
    const decision = decisionByRelationId.get(relation.relationId);
    if (!decision?.eligible) throw new Error(`DENUE_ANALYTICAL_DOCUMENT_REJECTED:PUBLICATION_DECISION_REQUIRED:${relation.relationId}`);
    return {
      relationId: relation.relationId,
      denueLayerId: relation.denueLayerId,
      sourceEvidenceId: relation.sourceEvidenceId,
      relationTypes: [...relation.relationTypes],
      ppcReviewer: relation.humanValidation.validatedBy || "NO CONSIGNADO",
      ppcTimestamp: relation.humanValidation.validatedAt || "NO CONSIGNADO",
      ppcRationale: relation.humanValidation.rationale || "NO CONSIGNADO",
      relationFingerprint: decision.relationFingerprint,
      methodologyVersion: relation.methodologyVersion,
      publicationDecision: "ELIGIBLE" as const,
      displayStatus: displayedRelationIds.has(relation.relationId) ? "DISPLAYED" as const : "ELIGIBLE_NOT_DISPLAYED" as const,
      omissionReason: displayedRelationIds.has(relation.relationId) ? null : "CARTOGRAPHIC_LEGIBILITY_LIMIT",
    };
  });
  const identityMaterial = [
    model.expedienteId,
    model.geographyId,
    model.methodologyVersion,
    ...model.markers.flatMap((marker) => [marker.denueLayerId, ...marker.relationIds]),
  ].join("|");
  const visualId = `denue-analytical-map-${stableHash(identityMaterial)}`;
  const imagePlan = buildDenueAnalyticalMapImagePlan(model);
  const traceabilityIds = Array.from(new Set(traceability.flatMap((entry) => [
    entry.relationId,
    entry.denueLayerId,
    entry.sourceEvidenceId,
    entry.relationFingerprint,
  ]))).sort();
  const companionTable: DenueAnalyticalDocumentUnit["companionTable"] = {
    headers: ["No.", "Establecimiento", "Actividad DENUE", "Relación", "Distancia", "Fuentes", "Rationale PPC", "Limitaciones"],
    rows: model.displayedRows.map((row) => [
      row.displayLabel,
      row.establishment,
      row.activityDescriptor || row.activityCode || "NO CONSIGNADA",
      textList(row.relationTypes),
      row.distances.length ? row.distances.map((entry) => `${entry.distanceMeters} m`).join("; ") : "NO APLICA",
      textList(row.linkedSourceRefs),
      textList(row.ppcRationales.map((entry) => entry.rationale)),
      textList(row.limitations),
    ]),
    rowBindings: model.displayedRows.map((row) => ({
      displayLabel: row.displayLabel,
      rowId: row.rowId,
      denueLayerId: row.denueLayerId,
      relationIds: [...row.relationIds],
    })),
  };
  const caption = "Establecimientos DENUE con relaciones analíticas aceptadas por PPC y admitidas para publicación. No representan por sí mismos delito, riesgo, vulnerabilidad ni peligrosidad.";
  const visualProduct = {
    id: visualId,
    visualId,
    visualType: "ANALYTICAL_DENUE_MAP",
    documentIntegrationKind: DENUE_ANALYTICAL_DOCUMENT_KIND,
    title: "RELACIONES ANALÍTICAS DENUE ADMITIDAS",
    caption,
    summary: caption,
    visualReference: imagePlan.baseMapUrl,
    geographyId: model.geographyId,
    traceabilityIds,
    relatedEvidenceIds: Array.from(new Set(traceability.map((entry) => entry.sourceEvidenceId))).sort(),
    sourceItemIds: traceabilityIds,
    publicationEligibility: "ELIGIBLE",
    presentation: { visibleSourceLabel: "INEGI DENUE / revisión PPC" },
    technicalMetadata: {
      sourceItemId: visualId,
      geographyId: model.geographyId,
      methodologyVersion: model.methodologyVersion,
      visualRole: "SECONDARY_VISUAL_CANDIDATE",
      documentIntegrationKind: DENUE_ANALYTICAL_DOCUMENT_KIND,
    },
  };
  return {
    status: "READY",
    sourcePresent: true,
    unit: { kind: DENUE_ANALYTICAL_DOCUMENT_KIND, visualId, renderModel: model, imagePlan, visualProduct, companionTable, traceability },
    reasons: [],
  };
}
