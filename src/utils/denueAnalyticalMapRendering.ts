import type { Coordinate } from "@/lib/providers/spatialLayerEngine";
import type { CanonicalProjectGeography, GeoJsonPosition } from "@/utils/canonicalProjectGeography";
import {
  DENUE_ANALYTICAL_PRODUCT_TYPE,
  validateDenueAnalyticalCartographicProduct,
  type DenueAnalyticalCartographicProduct,
  type DenueAnalyticalCartographicProductResult,
} from "@/utils/denueAnalyticalCartographicProduct";
import type { DenueAnalyticalRelation, DenueAnalyticalRelationType } from "@/utils/denueAnalyticalRelation";

export const DENUE_ANALYTICAL_VISUAL_OMISSION_REASON = "CARTOGRAPHIC_LEGIBILITY_LIMIT" as const;

const RELATION_TYPE_ORDER: DenueAnalyticalRelationType[] = [
  "SPATIAL_PROXIMITY",
  "EXPLICIT_SOURCE_LINK",
  "EVIDENCE_COINCIDENCE",
  "FINDING_RELATION",
  "HYPOTHESIS_SUPPORT",
  "HYPOTHESIS_CONTRADICTION",
  "CONTEXTUAL_ASSOCIATION",
  "MULTISOURCE_CORROBORATION",
];

const FORBIDDEN_FIELDS = new Set([
  "riskScore",
  "riskLevel",
  "vulnerabilityScore",
  "dangerLevel",
  "criminogenicity",
  "priorityRank",
]);

export interface DenueAnalyticalRenderMarker {
  displayLabel: string;
  displayId: string;
  tableRowId: string;
  denueLayerId: string;
  sourceEvidenceId: string;
  coordinates: Coordinate;
  relationIds: string[];
  relationTypes: DenueAnalyticalRelationType[];
}

export interface DenueAnalyticalDistanceEntry {
  relationId: string;
  distanceMeters: number;
}

export interface DenueAnalyticalRationaleEntry {
  relationId: string;
  rationale: string;
}

export interface DenueAnalyticalMapTableRow {
  rowId: string;
  number: number;
  displayLabel: string;
  displayId: string;
  denueLayerId: string;
  sourceEvidenceId: string;
  relationIds: string[];
  establishment: string;
  activityDescriptor: string | null;
  activityCode: string | null;
  relationTypes: DenueAnalyticalRelationType[];
  distances: DenueAnalyticalDistanceEntry[];
  linkedSourceRefs: string[];
  ppcRationales: DenueAnalyticalRationaleEntry[];
  limitations: string[];
}

export interface DenueAnalyticalEligibleOmission {
  denueLayerId: string;
  sourceEvidenceIds: string[];
  relationIds: string[];
  relationTypes: DenueAnalyticalRelationType[];
  distances: DenueAnalyticalDistanceEntry[];
  linkedSourceRefs: string[];
  ppcRationales: DenueAnalyticalRationaleEntry[];
  limitations: string[];
  omissionReason: typeof DENUE_ANALYTICAL_VISUAL_OMISSION_REASON;
}

export interface DenueAnalyticalMapRenderModel {
  expedienteId: string;
  geographyId: string;
  methodologyVersion: string;
  canonicalGeography: CanonicalProjectGeography;
  markers: DenueAnalyticalRenderMarker[];
  legend: {
    canonicalGeometry: string;
    analyticalMarkers: string;
    interpretationLimit: string;
    countStatement: string;
  };
  displayedRows: DenueAnalyticalMapTableRow[];
  eligibleButNotDisplayedRows: DenueAnalyticalEligibleOmission[];
  contextualUniverseCount: number;
  contextualDisplayedCount: number;
  analyticalEligibleCount: number;
  analyticalDisplayedCount: number;
  analyticalDisplayedRelationCount: number;
  disclosures: string[];
  limitations: string[];
  style: {
    markerPalette: "INSTITUTIONAL_NEUTRAL";
    canonicalGeometryEmphasis: "PRIMARY";
    nativeMarkerLabelCapability: "SINGLE_CHARACTER_ONLY";
    labelRenderingStrategy: "POST_RENDER_OVERLAY_FOR_COMPLETE_NUMERATION";
  };
}

export interface DenueAnalyticalMapRenderValidation {
  valid: boolean;
  reasons: string[];
}

export type DenueAnalyticalMapRenderResult =
  | { status: "READY"; model: DenueAnalyticalMapRenderModel; reasons: [] }
  | { status: "EMPTY"; model: null; reasons: [] }
  | { status: "REJECTED"; model: null; reasons: string[] };

type DenueAnalyticalMapRenderInput = DenueAnalyticalCartographicProduct | DenueAnalyticalCartographicProductResult;

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function canonicalRelationTypes(relations: DenueAnalyticalRelation[]): DenueAnalyticalRelationType[] {
  const types = new Set(relations.flatMap((relation) => relation.relationTypes));
  return RELATION_TYPE_ORDER.filter((relationType) => types.has(relationType));
}

function distances(relations: DenueAnalyticalRelation[]): DenueAnalyticalDistanceEntry[] {
  return relations
    .filter((relation) => typeof relation.spatialMetrics?.distanceMeters === "number")
    .map((relation) => ({ relationId: relation.relationId, distanceMeters: relation.spatialMetrics!.distanceMeters! }))
    .sort((left, right) => left.relationId.localeCompare(right.relationId));
}

function rationales(relations: DenueAnalyticalRelation[]): DenueAnalyticalRationaleEntry[] {
  return relations
    .map((relation) => ({ relationId: relation.relationId, rationale: relation.humanValidation.rationale || "" }))
    .sort((left, right) => left.relationId.localeCompare(right.relationId));
}

function relationLimitations(relations: DenueAnalyticalRelation[]): string[] {
  return uniqueSorted(relations.flatMap((relation) => relation.limitations.map((limitation) => limitation.code)));
}

function validCoordinate(coordinate: Coordinate): boolean {
  return Number.isFinite(coordinate?.lat) && coordinate.lat >= -90 && coordinate.lat <= 90 &&
    Number.isFinite(coordinate?.lng) && coordinate.lng >= -180 && coordinate.lng <= 180 &&
    !(coordinate.lat === 0 && coordinate.lng === 0);
}

function validPosition(position: unknown): position is GeoJsonPosition {
  return Array.isArray(position) && position.length >= 2 &&
    typeof position[0] === "number" && Number.isFinite(position[0]) && position[0] >= -180 && position[0] <= 180 &&
    typeof position[1] === "number" && Number.isFinite(position[1]) && position[1] >= -90 && position[1] <= 90;
}

function validateCanonicalGeography(geography: CanonicalProjectGeography, geographyId: string, reasons: string[]): void {
  if (!geography || geography.geographyId !== geographyId) {
    reasons.push("CANONICAL_GEOGRAPHY_ID_MISMATCH");
    return;
  }
  const geometry = geography.geometry;
  if (geography.type === "INDIVIDUAL") {
    if (geometry.type !== "Point" || !validPosition(geometry.coordinates)) reasons.push("CANONICAL_INDIVIDUAL_GEOMETRY_INVALID");
    return;
  }
  if (geography.type === "CORRIDOR") {
    if (geometry.type !== "LineString" || geometry.coordinates.length < 2 || !geometry.coordinates.every(validPosition)) {
      reasons.push("CANONICAL_CORRIDOR_GEOMETRY_INVALID");
    }
    return;
  }
  if (geography.type !== "POLYGON" || geometry.type !== "Polygon" || geometry.coordinates.length === 0) {
    reasons.push("CANONICAL_POLYGON_GEOMETRY_INVALID");
    return;
  }
  const validRings = geometry.coordinates.every((ring) => ring.length >= 4 && ring.every(validPosition) &&
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]);
  if (!validRings) reasons.push("CANONICAL_POLYGON_GEOMETRY_INVALID");
}

function hasForbiddenField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => FORBIDDEN_FIELDS.has(key) || hasForbiddenField(nested));
}

function reject(reasons: string[]): DenueAnalyticalMapRenderResult {
  return { status: "REJECTED", model: null, reasons: uniqueSorted(reasons) };
}

export function validateDenueAnalyticalMapRenderModel(model: DenueAnalyticalMapRenderModel): DenueAnalyticalMapRenderValidation {
  const reasons: string[] = [];
  if (!model || typeof model !== "object") return { valid: false, reasons: ["RENDER_MODEL_REQUIRED"] };
  if (!present(model.expedienteId)) reasons.push("EXPEDIENTE_ID_REQUIRED");
  if (!present(model.geographyId)) reasons.push("GEOGRAPHY_ID_REQUIRED");
  if (!present(model.methodologyVersion)) reasons.push("METHODOLOGY_VERSION_REQUIRED");
  validateCanonicalGeography(model.canonicalGeography, model.geographyId, reasons);
  if (!Number.isInteger(model.contextualUniverseCount) || model.contextualUniverseCount < 0) reasons.push("CONTEXTUAL_UNIVERSE_COUNT_INVALID");
  if (!Number.isInteger(model.contextualDisplayedCount) || model.contextualDisplayedCount < 0 || model.contextualDisplayedCount > model.contextualUniverseCount) {
    reasons.push("CONTEXTUAL_DISPLAYED_COUNT_INVALID");
  }
  if (model.analyticalDisplayedCount !== model.markers.length || model.displayedRows.length !== model.markers.length) {
    reasons.push("ANALYTICAL_DISPLAYED_COUNT_MISMATCH");
  }
  if (!Number.isInteger(model.analyticalEligibleCount) || model.analyticalEligibleCount < model.analyticalDisplayedRelationCount) {
    reasons.push("ANALYTICAL_ELIGIBLE_COUNT_INVALID");
  }
  if (new Set(model.markers.map((marker) => marker.displayLabel)).size !== model.markers.length) reasons.push("MARKER_LABEL_DUPLICATED");
  if (model.markers.some((marker, index) => marker.displayLabel !== String(index + 1))) reasons.push("MARKER_LABEL_SEQUENCE_INVALID");
  const rowsById = new Map(model.displayedRows.map((row) => [row.rowId, row]));
  if (rowsById.size !== model.displayedRows.length) reasons.push("TABLE_ROW_ID_DUPLICATED");
  for (const marker of model.markers) {
    if (!validCoordinate(marker.coordinates)) reasons.push(`MARKER_COORDINATES_INVALID:${marker.displayId}`);
    const row = rowsById.get(marker.tableRowId);
    if (!row || row.displayLabel !== marker.displayLabel || row.denueLayerId !== marker.denueLayerId ||
      row.sourceEvidenceId !== marker.sourceEvidenceId || JSON.stringify(row.relationIds) !== JSON.stringify(marker.relationIds)) {
      reasons.push(`MARKER_TABLE_MISMATCH:${marker.displayId}`);
    }
  }
  const markerRowIds = new Set(model.markers.map((marker) => marker.tableRowId));
  if (model.displayedRows.some((row) => !markerRowIds.has(row.rowId))) reasons.push("TABLE_ROW_WITHOUT_MARKER");
  const displayedRelationIds = model.markers.flatMap((marker) => marker.relationIds);
  const omittedRelationIds = model.eligibleButNotDisplayedRows.flatMap((row) => row.relationIds);
  const inventoryRelationIds = [...displayedRelationIds, ...omittedRelationIds];
  if (inventoryRelationIds.length !== model.analyticalEligibleCount ||
    new Set(inventoryRelationIds).size !== model.analyticalEligibleCount) {
    reasons.push("ELIGIBLE_RELATION_INVENTORY_MISMATCH");
  }
  if (model.eligibleButNotDisplayedRows.some((row) => row.omissionReason !== DENUE_ANALYTICAL_VISUAL_OMISSION_REASON)) {
    reasons.push("VISUAL_OMISSION_REASON_INVALID");
  }
  if (!model.disclosures.includes("DENUE_NOT_CRIMINAL_EVIDENCE")) reasons.push("DENUE_NOT_CRIMINAL_EVIDENCE_DISCLOSURE_REQUIRED");
  const relationTypes = new Set([
    ...model.markers.flatMap((marker) => marker.relationTypes),
    ...model.eligibleButNotDisplayedRows.flatMap((row) => row.relationTypes),
  ]);
  if (relationTypes.has("SPATIAL_PROXIMITY") && !model.disclosures.includes("PROXIMITY_NOT_CAUSALITY")) {
    reasons.push("PROXIMITY_NOT_CAUSALITY_DISCLOSURE_REQUIRED");
  }
  if (relationTypes.has("CONTEXTUAL_ASSOCIATION") && !model.disclosures.includes("CONTEXT_NOT_CAUSALITY")) {
    reasons.push("CONTEXT_NOT_CAUSALITY_DISCLOSURE_REQUIRED");
  }
  if (!model.limitations.includes("DENUE_NOT_CRIMINAL_EVIDENCE")) reasons.push("DENUE_NOT_CRIMINAL_EVIDENCE_LIMITATION_REQUIRED");
  if (hasForbiddenField(model)) reasons.push("PROHIBITED_RISK_OR_RANKING_FIELD");
  const normalized = uniqueSorted(reasons);
  return { valid: normalized.length === 0, reasons: normalized };
}

function resolveProduct(input: DenueAnalyticalMapRenderInput): DenueAnalyticalCartographicProduct | DenueAnalyticalMapRenderResult {
  if ("status" in input) {
    if (input.status === "EMPTY") return { status: "EMPTY", model: null, reasons: [] };
    if (input.status === "REJECTED") return reject(["SOURCE_PRODUCT_REJECTED", ...input.reasons.map((reason) => `PRODUCT:${reason}`)]);
    return input.product;
  }
  return input;
}

export function buildDenueAnalyticalMapRenderModel(input: DenueAnalyticalMapRenderInput): DenueAnalyticalMapRenderResult {
  const resolved = resolveProduct(input);
  if ("status" in resolved) return resolved;
  const product = resolved;
  const productValidation = validateDenueAnalyticalCartographicProduct(product);
  if (!productValidation.accepted || product.analyticalProductType !== DENUE_ANALYTICAL_PRODUCT_TYPE) {
    return reject(["SOURCE_PRODUCT_INVALID", ...productValidation.reasons.map((reason) => `PRODUCT:${reason}`)]);
  }

  const relationsById = new Map(product.eligibleRelations.map((relation) => [relation.relationId, relation]));
  const markers: DenueAnalyticalRenderMarker[] = [];
  const displayedRows: DenueAnalyticalMapTableRow[] = [];
  const reasons: string[] = [];
  for (const item of product.mapItems) {
    if (!validCoordinate(item.coordinates)) reasons.push(`MARKER_COORDINATES_INVALID:${item.displayId}`);
    const relations = item.relationIds.map((relationId) => relationsById.get(relationId)).filter((relation): relation is DenueAnalyticalRelation => Boolean(relation));
    if (relations.length !== item.relationIds.length) reasons.push(`MARKER_RELATION_NOT_ELIGIBLE:${item.displayId}`);
    const rowId = `denue-analytical-table-row:${item.denueLayerId}`;
    const relationIds = uniqueSorted(item.relationIds);
    markers.push({
      displayLabel: item.label,
      displayId: item.displayId,
      tableRowId: rowId,
      denueLayerId: item.denueLayerId,
      sourceEvidenceId: item.sourceEvidenceId,
      coordinates: { ...item.coordinates },
      relationIds,
      relationTypes: canonicalRelationTypes(relations),
    });
    displayedRows.push({
      rowId,
      number: Number(item.label),
      displayLabel: item.label,
      displayId: item.displayId,
      denueLayerId: item.denueLayerId,
      sourceEvidenceId: item.sourceEvidenceId,
      relationIds,
      establishment: item.establishment,
      activityDescriptor: null,
      activityCode: item.activityCode,
      relationTypes: canonicalRelationTypes(relations),
      distances: distances(relations),
      linkedSourceRefs: uniqueSorted(relations.flatMap((relation) => relation.linkedSourceRefs)),
      ppcRationales: rationales(relations),
      limitations: relationLimitations(relations),
    });
  }
  if (reasons.length > 0) return reject(reasons);

  const displayedRelationIds = new Set(markers.flatMap((marker) => marker.relationIds));
  const omittedByDenue = new Map<string, DenueAnalyticalRelation[]>();
  for (const relation of product.eligibleRelations.filter((candidate) => !displayedRelationIds.has(candidate.relationId))) {
    const group = omittedByDenue.get(relation.denueLayerId) || [];
    group.push(relation);
    omittedByDenue.set(relation.denueLayerId, group);
  }
  const eligibleButNotDisplayedRows = Array.from(omittedByDenue.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([denueLayerId, unsortedRelations]) => {
      const relations = [...unsortedRelations].sort((left, right) => left.relationId.localeCompare(right.relationId));
      return {
        denueLayerId,
        sourceEvidenceIds: uniqueSorted(relations.map((relation) => relation.sourceEvidenceId)),
        relationIds: relations.map((relation) => relation.relationId),
        relationTypes: canonicalRelationTypes(relations),
        distances: distances(relations),
        linkedSourceRefs: uniqueSorted(relations.flatMap((relation) => relation.linkedSourceRefs)),
        ppcRationales: rationales(relations),
        limitations: relationLimitations(relations),
        omissionReason: DENUE_ANALYTICAL_VISUAL_OMISSION_REASON,
      } satisfies DenueAnalyticalEligibleOmission;
    });

  const allRelations = [...product.eligibleRelations];
  const presentTypes = new Set(allRelations.flatMap((relation) => relation.relationTypes));
  const disclosures = [
    "DENUE_NOT_CRIMINAL_EVIDENCE",
    ...(presentTypes.has("SPATIAL_PROXIMITY") ? ["PROXIMITY_NOT_CAUSALITY"] : []),
    ...(presentTypes.has("CONTEXTUAL_ASSOCIATION") ? ["CONTEXT_NOT_CAUSALITY"] : []),
  ];
  const model: DenueAnalyticalMapRenderModel = {
    expedienteId: product.expedienteId,
    geographyId: product.geographyId,
    methodologyVersion: product.methodologyVersion,
    canonicalGeography: structuredClone(product.canonicalGeography),
    markers,
    legend: {
      canonicalGeometry: "Geografia canonica del expediente, preservada como referencia territorial primaria.",
      analyticalMarkers: "Los marcadores numerados representan establecimientos DENUE con relaciones analiticas aceptadas por PPC y elegibles para publicacion.",
      interpretationLimit: "Los establecimientos DENUE no representan por si mismos delitos, riesgo, vulnerabilidad, peligrosidad ni causalidad.",
      countStatement: `${product.contextualUniverseCount} establecimientos DENUE en el universo contextual; ${product.contextualDisplayedCount} contextualizados; ${product.analyticalEligibleCount} relaciones analiticas elegibles; ${markers.length} establecimientos analiticos representados.`,
    },
    displayedRows,
    eligibleButNotDisplayedRows,
    contextualUniverseCount: product.contextualUniverseCount,
    contextualDisplayedCount: product.contextualDisplayedCount,
    analyticalEligibleCount: product.analyticalEligibleCount,
    analyticalDisplayedCount: product.analyticalMapItemCount,
    analyticalDisplayedRelationCount: product.analyticalDisplayedRelationCount,
    disclosures,
    limitations: uniqueSorted([...product.limitations, ...relationLimitations(allRelations)]),
    style: {
      markerPalette: "INSTITUTIONAL_NEUTRAL",
      canonicalGeometryEmphasis: "PRIMARY",
      nativeMarkerLabelCapability: "SINGLE_CHARACTER_ONLY",
      labelRenderingStrategy: "POST_RENDER_OVERLAY_FOR_COMPLETE_NUMERATION",
    },
  };
  const validation = validateDenueAnalyticalMapRenderModel(model);
  return validation.valid ? { status: "READY", model, reasons: [] } : reject(validation.reasons);
}
