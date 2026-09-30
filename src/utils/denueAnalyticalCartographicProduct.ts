import { SpatialLayerEngine, type Coordinate } from "@/lib/providers/spatialLayerEngine";
import { evaluateCartographicAdmission, type CartographicAdmissionResult } from "@/utils/cartographicAdmissionGate";
import type { CanonicalGeographyReference, DerivedGovernedMapLayer, GovernedCartographicProduct } from "@/utils/governedCartographicProduct";
import { validateDenueAnalyticalRelation, type DenueAnalyticalRelation, type DenueAnalyticalRelationType } from "@/utils/denueAnalyticalRelation";
import type { DenueGovernedMapLayer } from "@/utils/denueGovernedMapAdapter";
import {
  assessDenueAnalyticalPublication,
  type DenueAnalyticalPublicationDecision,
  type DenueAnalyticalPublicationInput,
} from "@/utils/denueAnalyticalPublicationGate";
import { fingerprintDenueAnalyticalRelation } from "@/utils/denueAnalyticalReviewLedger";
import type { CanonicalLineageNode } from "@/utils/evidenceLineage";
import {
  DEFAULT_DENUE_CARTOGRAPHIC_DISPLAY_CONFIG,
  type DenueCartographicDisplayConfig,
} from "@/utils/denueCartographicDisplaySelection";

export const DENUE_ANALYTICAL_PRODUCT_TYPE = "ANALYTICAL_DENUE" as const;
export const DENUE_ANALYTICAL_DISPLAY_POLICY = "DENUE_ANALYTICAL_SPATIAL_DISPERSION_V1" as const;

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

export interface DenueAnalyticalMapItem {
  displayId: string;
  label: string;
  relationIds: string[];
  denueLayerId: string;
  sourceEvidenceId: string;
  coordinates: Coordinate;
  establishment: string;
  activityCode: string | null;
  relationTypes: DenueAnalyticalRelationType[];
  rationaleSummaries: Array<{ relationId: string; rationale: string }>;
  limitations: string[];
}

export interface DenueAnalyticalTableRow {
  label: string;
  displayId: string;
  denueLayerId: string;
  relationIds: string[];
  establishment: string;
  activityCode: string | null;
  relationTypes: DenueAnalyticalRelationType[];
  distanceMeters: number | null;
  linkedSourceRefs: string[];
  ppcRationales: Array<{ relationId: string; rationale: string }>;
  limitations: string[];
}

export interface DenueAnalyticalDerivedLayer extends DerivedGovernedMapLayer {
  analyticalProperties: {
    analyticalProductType: typeof DENUE_ANALYTICAL_PRODUCT_TYPE;
    displayId: string;
    label: string;
    denueLayerId: string;
    sourceEvidenceId: string;
    relationIds: string[];
    relationTypes: DenueAnalyticalRelationType[];
    relations: DenueAnalyticalRelation[];
  };
}

export interface DenueAnalyticalCartographicProduct extends Omit<GovernedCartographicProduct, "layers" | "productType"> {
  productType: "THEMATIC_CONTEXT";
  analyticalProductType: typeof DENUE_ANALYTICAL_PRODUCT_TYPE;
  layers: DenueAnalyticalDerivedLayer[];
  expedienteId: string;
  methodologyVersion: string;
  contextualUniverseCount: number;
  contextualDisplayedCount: number;
  analyticalAcceptedCount: number;
  analyticalEligibleCount: number;
  analyticalDisplayedRelationCount: number;
  analyticalMapItemCount: number;
  eligibleRelations: DenueAnalyticalRelation[];
  mapItems: DenueAnalyticalMapItem[];
  tableRows: DenueAnalyticalTableRow[];
  publicationDecisions: DenueAnalyticalPublicationDecision[];
  selection: {
    policy: typeof DENUE_ANALYTICAL_DISPLAY_POLICY;
    parameters: DenueCartographicDisplayConfig;
    selectedDenueLayerIds: string[];
    omittedDenueLayerIds: string[];
    disclosure: string[];
  };
  visualRole: "SECONDARY_VISUAL_CANDIDATE";
  maxInstitutionalVisualBudget: 5;
}

export interface DenueAnalyticalCartographicProductInput {
  expedienteId: string;
  geographyId: string;
  methodologyVersion: string;
  canonicalGeographyReference: CanonicalGeographyReference;
  contextualUniverseCount: number;
  contextualDisplayedCount: number;
  denueLayers: DenueGovernedMapLayer[];
  relations: DenueAnalyticalPublicationInput[];
  createdAtReference: string;
  displayConfig?: DenueCartographicDisplayConfig;
}

export interface RejectedDenueAnalyticalRelation {
  relationId: string;
  reasons: string[];
}

export type DenueAnalyticalCartographicProductResult =
  | {
      status: "BUILT";
      product: DenueAnalyticalCartographicProduct;
      validation: CartographicAdmissionResult;
      rejectedRelations: RejectedDenueAnalyticalRelation[];
      duplicateRelationCount: number;
      reasons: [];
    }
  | {
      status: "EMPTY";
      product: null;
      validation: { accepted: true; status: "ADMITTED"; reasons: [] };
      rejectedRelations: RejectedDenueAnalyticalRelation[];
      duplicateRelationCount: number;
      reasons: [];
    }
  | {
      status: "REJECTED";
      product: null;
      validation: CartographicAdmissionResult;
      rejectedRelations: RejectedDenueAnalyticalRelation[];
      duplicateRelationCount: number;
      reasons: string[];
    };

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = canonicalValue((value as Record<string, unknown>)[key]);
      return result;
    }, {});
  }
  return value;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function pointFromLayer(layer: DenueGovernedMapLayer): Coordinate | null {
  if (layer.sourceType !== "DENUE" || layer.epistemicClass !== "OBSERVED" || layer.geometry.type !== "Point") return null;
  const [lng, lat] = layer.geometry.coordinates;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function relationTypes(relations: DenueAnalyticalRelation[]): DenueAnalyticalRelationType[] {
  const presentTypes = new Set(relations.flatMap((relation) => relation.relationTypes));
  return RELATION_TYPE_ORDER.filter((relationType) => presentTypes.has(relationType));
}

function mergeLineage(relations: DenueAnalyticalRelation[]): { lineage: CanonicalLineageNode[]; conflict: boolean } {
  const nodes = new Map<string, CanonicalLineageNode>();
  for (const node of relations.flatMap((relation) => relation.lineage)) {
    const key = `${node.type}:${node.id}`;
    const existing = nodes.get(key);
    if (existing && fingerprint(existing) !== fingerprint(node)) return { lineage: [], conflict: true };
    if (!existing) nodes.set(key, { ...node });
  }
  return {
    lineage: Array.from(nodes.values()).sort((left, right) => `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`)),
    conflict: false,
  };
}

function nearestDistance(candidate: DenueGovernedMapLayer, selected: DenueGovernedMapLayer[]): number {
  const point = pointFromLayer(candidate)!;
  return Math.min(...selected.map((layer) => SpatialLayerEngine.getDistance(point, pointFromLayer(layer)!)));
}

function selectLayers(
  layers: DenueGovernedMapLayer[],
  config: DenueCartographicDisplayConfig
): { selected: DenueGovernedMapLayer[]; omitted: DenueGovernedMapLayer[] } {
  const ordered = [...layers].sort((left, right) => left.layerId.localeCompare(right.layerId));
  if (ordered.length === 0) return { selected: [], omitted: [] };
  const selected = [ordered[0]];
  const remaining = new Map(ordered.slice(1).map((layer) => [layer.layerId, layer]));
  while (selected.length < config.maxDisplayedPoints && remaining.size > 0) {
    let next: DenueGovernedMapLayer | null = null;
    let nextDistance = Number.NEGATIVE_INFINITY;
    for (const candidate of remaining.values()) {
      const distance = nearestDistance(candidate, selected);
      if (distance < config.minimumSeparationMeters) continue;
      if (distance > nextDistance || (distance === nextDistance && (!next || candidate.layerId.localeCompare(next.layerId) < 0))) {
        next = candidate;
        nextDistance = distance;
      }
    }
    if (!next) break;
    selected.push(next);
    remaining.delete(next.layerId);
  }
  return { selected, omitted: Array.from(remaining.values()).sort((left, right) => left.layerId.localeCompare(right.layerId)) };
}

function validationResult(reasons: string[]): CartographicAdmissionResult {
  const normalized = uniqueSorted(reasons);
  return { accepted: normalized.length === 0, status: normalized.length === 0 ? "ADMITTED" : "REJECTED", reasons: normalized };
}

function reject(
  reasons: string[],
  rejectedRelations: RejectedDenueAnalyticalRelation[] = [],
  duplicateRelationCount = 0
): DenueAnalyticalCartographicProductResult {
  const normalized = uniqueSorted(reasons);
  return {
    status: "REJECTED",
    product: null,
    validation: validationResult(normalized),
    rejectedRelations,
    duplicateRelationCount,
    reasons: normalized,
  };
}

function prohibitedOutputField(value: unknown): boolean {
  const prohibited = new Set(["riskScore", "vulnerabilityScore", "dangerLevel", "criminogenicity", "priorityRank"]);
  if (Array.isArray(value)) return value.some(prohibitedOutputField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => prohibited.has(key) || prohibitedOutputField(nested));
}

export function validateDenueAnalyticalCartographicProduct(product: DenueAnalyticalCartographicProduct): CartographicAdmissionResult {
  const reasons: string[] = [];
  if (!product || typeof product !== "object") return validationResult(["PRODUCT_REQUIRED"]);
  if (product.analyticalProductType !== DENUE_ANALYTICAL_PRODUCT_TYPE) reasons.push("ANALYTICAL_PRODUCT_TYPE_INVALID");
  if (product.productType !== "THEMATIC_CONTEXT") reasons.push("B1_PRODUCT_TYPE_INVALID");
  if (!present(product.expedienteId)) reasons.push("EXPEDIENTE_ID_REQUIRED");
  if (!present(product.geographyId)) reasons.push("GEOGRAPHY_ID_REQUIRED");
  if (!present(product.methodologyVersion)) reasons.push("METHODOLOGY_VERSION_REQUIRED");
  if (!Number.isInteger(product.contextualUniverseCount) || product.contextualUniverseCount < 0) reasons.push("CONTEXTUAL_UNIVERSE_COUNT_INVALID");
  if (!Number.isInteger(product.contextualDisplayedCount) || product.contextualDisplayedCount < 0 || product.contextualDisplayedCount > product.contextualUniverseCount) {
    reasons.push("CONTEXTUAL_DISPLAYED_COUNT_INVALID");
  }
  if (product.analyticalEligibleCount !== product.publicationDecisions.filter((decision) => decision.eligible).length ||
    product.analyticalEligibleCount !== product.eligibleRelations.length) reasons.push("ANALYTICAL_ELIGIBLE_COUNT_MISMATCH");
  if (product.analyticalMapItemCount !== product.mapItems.length || product.layers.length !== product.mapItems.length || product.tableRows.length !== product.mapItems.length) {
    reasons.push("ANALYTICAL_ITEM_COUNT_MISMATCH");
  }
  if (new Set(product.mapItems.map((item) => item.label)).size !== product.mapItems.length) reasons.push("DISPLAY_LABEL_DUPLICATED");
  if (new Set(product.mapItems.map((item) => item.displayId)).size !== product.mapItems.length) reasons.push("DISPLAY_ID_DUPLICATED");
  if (product.mapItems.some((item, index) => item.label !== String(index + 1))) reasons.push("DISPLAY_LABEL_SEQUENCE_INVALID");
  const representedRelations = uniqueSorted(product.mapItems.flatMap((item) => item.relationIds));
  if (representedRelations.length !== product.analyticalDisplayedRelationCount) reasons.push("DISPLAYED_RELATION_COUNT_MISMATCH");
  if (product.mapItems.flatMap((item) => item.relationIds).length !== representedRelations.length) reasons.push("RELATION_ID_REPRESENTED_MULTIPLE_TIMES");
  if (product.layers.some((layer) => layer.geographyId !== product.geographyId)) reasons.push("LAYER_GEOGRAPHY_MISMATCH");
  if (product.layers.some((layer) => layer.analyticalProperties.relations.some((relation) =>
    relation.expedienteId !== product.expedienteId || relation.geographyId !== product.geographyId || relation.methodologyVersion !== product.methodologyVersion || relation.humanValidation.status !== "ACCEPTED"
  ))) reasons.push("LAYER_RELATION_CONTEXT_INVALID");
  if (product.publicationDecisions.some((decision) => !decision.eligible)) reasons.push("INELIGIBLE_DECISION_INCLUDED");
  if (new Set(product.publicationDecisions.map((decision) => decision.relationId)).size !== product.publicationDecisions.length) {
    reasons.push("PUBLICATION_DECISION_DUPLICATED");
  }
  const decisions = new Map(product.publicationDecisions.map((decision) => [decision.relationId, decision]));
  if (new Set(product.eligibleRelations.map((relation) => relation.relationId)).size !== product.eligibleRelations.length) {
    reasons.push("ELIGIBLE_RELATION_ID_DUPLICATED");
  }
  for (const relation of product.eligibleRelations) {
    const decision = decisions.get(relation.relationId);
    if (!validateDenueAnalyticalRelation(relation).valid || relation.humanValidation.status !== "ACCEPTED") {
      reasons.push(`RELATION:${relation.relationId}:INVALID_ELIGIBLE_RELATION`);
    }
    if (!decision || !decision.eligible || decision.relationFingerprint !== fingerprintDenueAnalyticalRelation(relation)) {
      reasons.push(`RELATION:${relation.relationId}:PUBLICATION_DECISION_MISMATCH`);
    }
  }
  for (const [index, item] of product.mapItems.entries()) {
    const layer = product.layers.find((candidate) => candidate.analyticalProperties.displayId === item.displayId);
    const row = product.tableRows.find((candidate) => candidate.displayId === item.displayId);
    if (!layer || !row) {
      reasons.push(`ITEM:${item.displayId}:REPRESENTATION_INCOMPLETE`);
      continue;
    }
    if (layer.styleSpecification.label !== item.label || row.label !== item.label || item.label !== String(index + 1)) {
      reasons.push(`ITEM:${item.displayId}:LABEL_MISMATCH`);
    }
    if (layer.geometry.type !== "Point" || layer.geometry.coordinates[0] !== item.coordinates.lng || layer.geometry.coordinates[1] !== item.coordinates.lat) {
      reasons.push(`ITEM:${item.displayId}:GEOMETRY_MISMATCH`);
    }
    if (layer.analyticalProperties.denueLayerId !== item.denueLayerId ||
      layer.analyticalProperties.sourceEvidenceId !== item.sourceEvidenceId ||
      layer.analyticalProperties.relations.some((relation) => relation.denueLayerId !== item.denueLayerId || relation.sourceEvidenceId !== item.sourceEvidenceId)) {
      reasons.push(`ITEM:${item.displayId}:DENUE_TRACEABILITY_MISMATCH`);
    }
    const layerRelationIds = uniqueSorted(layer.analyticalProperties.relations.map((relation) => relation.relationId));
    if (fingerprint(layerRelationIds) !== fingerprint(uniqueSorted(item.relationIds)) || fingerprint(layerRelationIds) !== fingerprint(uniqueSorted(row.relationIds))) {
      reasons.push(`ITEM:${item.displayId}:RELATION_IDS_MISMATCH`);
    }
    for (const relation of layer.analyticalProperties.relations) {
      const decision = decisions.get(relation.relationId);
      if (!validateDenueAnalyticalRelation(relation).valid) reasons.push(`RELATION:${relation.relationId}:INVALID`);
      if (!decision || !decision.eligible) reasons.push(`RELATION:${relation.relationId}:ELIGIBLE_DECISION_REQUIRED`);
      else if (decision.relationFingerprint !== fingerprintDenueAnalyticalRelation(relation)) reasons.push(`RELATION:${relation.relationId}:FINGERPRINT_MISMATCH`);
    }
  }
  if (prohibitedOutputField(product)) reasons.push("PROHIBITED_SCORING_OR_VULNERABILITY_FIELD");
  const admission = evaluateCartographicAdmission(product);
  if (!admission.accepted) reasons.push("B1_CARTOGRAPHIC_ADMISSION_REJECTED", ...admission.reasons.map((reason) => `B1:${reason}`));
  return validationResult(reasons);
}

export function buildDenueAnalyticalCartographicProduct(
  input: DenueAnalyticalCartographicProductInput
): DenueAnalyticalCartographicProductResult {
  const reasons: string[] = [];
  if (!present(input?.expedienteId)) reasons.push("EXPEDIENTE_ID_REQUIRED");
  if (!present(input?.geographyId)) reasons.push("GEOGRAPHY_ID_REQUIRED");
  if (!present(input?.methodologyVersion)) reasons.push("METHODOLOGY_VERSION_REQUIRED");
  if (!present(input?.createdAtReference)) reasons.push("CREATED_AT_REFERENCE_REQUIRED");
  if (!input?.canonicalGeographyReference || input.canonicalGeographyReference.geographyId !== input.geographyId) reasons.push("CANONICAL_GEOGRAPHY_REFERENCE_MISMATCH");
  if (!Number.isInteger(input?.contextualUniverseCount) || input.contextualUniverseCount < 0) reasons.push("CONTEXTUAL_UNIVERSE_COUNT_INVALID");
  if (!Number.isInteger(input?.contextualDisplayedCount) || input.contextualDisplayedCount < 0 || input.contextualDisplayedCount > input.contextualUniverseCount) {
    reasons.push("CONTEXTUAL_DISPLAYED_COUNT_INVALID");
  }
  const config = input?.displayConfig || DEFAULT_DENUE_CARTOGRAPHIC_DISPLAY_CONFIG;
  if (!Number.isInteger(config.maxDisplayedPoints) || config.maxDisplayedPoints <= 0) reasons.push("MAX_DISPLAYED_POINTS_INVALID");
  if (!Number.isFinite(config.minimumSeparationMeters) || config.minimumSeparationMeters <= 0) reasons.push("MINIMUM_SEPARATION_METERS_INVALID");
  if (reasons.length > 0) return reject(reasons);

  const layerGroups = new Map<string, DenueGovernedMapLayer[]>();
  for (const layer of input.denueLayers || []) {
    const group = layerGroups.get(layer.layerId) || [];
    group.push(layer);
    layerGroups.set(layer.layerId, group);
  }
  const layersById = new Map<string, DenueGovernedMapLayer>();
  for (const [layerId, layers] of layerGroups) {
    const variants = uniqueSorted(layers.map(fingerprint));
    if (variants.length > 1) reasons.push(`DENUE_LAYER_IDENTITY_CONFLICT:${layerId}`);
    else layersById.set(layerId, layers[0]);
  }

  const relationGroups = new Map<string, DenueAnalyticalPublicationInput[]>();
  const rejectedRelations: RejectedDenueAnalyticalRelation[] = [];
  for (const entry of input.relations || []) {
    const relationId = entry?.relation?.relationId || "UNAVAILABLE";
    const group = relationGroups.get(relationId) || [];
    group.push(entry);
    relationGroups.set(relationId, group);
  }
  const uniqueEntries: DenueAnalyticalPublicationInput[] = [];
  let duplicateRelationCount = 0;
  for (const relationId of Array.from(relationGroups.keys()).sort()) {
    const entries = relationGroups.get(relationId)!;
    const variants = uniqueSorted(entries.map(fingerprint));
    if (variants.length > 1) reasons.push(`RELATION_ID_CONFLICT:${relationId}`);
    else {
      uniqueEntries.push(entries[0]);
      duplicateRelationCount += entries.length - 1;
    }
  }
  if (reasons.length > 0) return reject(reasons, rejectedRelations, duplicateRelationCount);

  const eligible: Array<{ entry: DenueAnalyticalPublicationInput; decision: DenueAnalyticalPublicationDecision; layer: DenueGovernedMapLayer }> = [];
  for (const entry of uniqueEntries) {
    const relation = entry.relation;
    const decision = assessDenueAnalyticalPublication(entry);
    if (relation.expedienteId !== input.expedienteId) reasons.push(`EXPEDIENTE_ID_MISMATCH:${relation.relationId}`);
    if (relation.geographyId !== input.geographyId) reasons.push(`GEOGRAPHY_ID_MISMATCH:${relation.relationId}`);
    if (relation.methodologyVersion !== input.methodologyVersion) reasons.push(`METHODOLOGY_VERSION_MISMATCH:${relation.relationId}`);
    const layer = layersById.get(relation.denueLayerId);
    if (!layer || relation.sourceEvidenceId !== layer.layerId || !layer.sourceItemIds.includes(relation.sourceEvidenceId)) {
      reasons.push(`RELATION_DENUE_LAYER_MISMATCH:${relation.relationId}`);
    } else if (!pointFromLayer(layer)) reasons.push(`DENUE_LAYER_GEOMETRY_INVALID:${relation.denueLayerId}`);
    if (!decision.eligible) rejectedRelations.push({ relationId: relation.relationId, reasons: decision.reasons });
    else if (layer) eligible.push({ entry, decision, layer });
  }
  if (reasons.length > 0) return reject(reasons, rejectedRelations, duplicateRelationCount);
  if (eligible.length === 0) {
    return {
      status: "EMPTY",
      product: null,
      validation: { accepted: true, status: "ADMITTED", reasons: [] },
      rejectedRelations,
      duplicateRelationCount,
      reasons: [],
    };
  }

  const byDenue = new Map<string, typeof eligible>();
  for (const item of eligible) {
    const group = byDenue.get(item.layer.layerId) || [];
    group.push(item);
    byDenue.set(item.layer.layerId, group);
  }
  const eligibleLayers = Array.from(byDenue.values()).map((group) => group[0].layer);
  const selection = selectLayers(eligibleLayers, config);
  const productId = `denue:analytical-map:${input.expedienteId}:${input.geographyId}:${encodeURIComponent(input.methodologyVersion)}`;
  const mapItems: DenueAnalyticalMapItem[] = [];
  const tableRows: DenueAnalyticalTableRow[] = [];
  const layers: DenueAnalyticalDerivedLayer[] = [];

  for (let index = 0; index < selection.selected.length; index += 1) {
    const denueLayer = selection.selected[index];
    const group = byDenue.get(denueLayer.layerId)!.sort((left, right) => left.entry.relation.relationId.localeCompare(right.entry.relation.relationId));
    const relations = group.map((item) => item.entry.relation);
    const mergedLineage = mergeLineage(relations);
    if (mergedLineage.conflict) return reject([`RELATION_LINEAGE_CONFLICT:${denueLayer.layerId}`], rejectedRelations, duplicateRelationCount);
    const relationIds = relations.map((relation) => relation.relationId);
    const types = relationTypes(relations);
    const limitations = uniqueSorted(relations.flatMap((relation) => relation.limitations.map((limitation) => limitation.code)));
    const rationaleSummaries = relations.map((relation) => ({ relationId: relation.relationId, rationale: relation.humanValidation.rationale! }));
    const displayId = `denue-analytical-item:${denueLayer.layerId}`;
    const label = String(index + 1);
    const point = pointFromLayer(denueLayer)!;
    const mapItem: DenueAnalyticalMapItem = {
      displayId,
      label,
      relationIds,
      denueLayerId: denueLayer.layerId,
      sourceEvidenceId: denueLayer.sourceItemIds[0],
      coordinates: point,
      establishment: denueLayer.observedProperties.name,
      activityCode: present(denueLayer.observedProperties.activityCode) ? denueLayer.observedProperties.activityCode : null,
      relationTypes: types,
      rationaleSummaries,
      limitations,
    };
    mapItems.push(mapItem);
    tableRows.push({
      label,
      displayId,
      denueLayerId: denueLayer.layerId,
      relationIds,
      establishment: mapItem.establishment,
      activityCode: mapItem.activityCode,
      relationTypes: types,
      distanceMeters: relations.map((relation) => relation.spatialMetrics?.distanceMeters).find((value): value is number => typeof value === "number") ?? null,
      linkedSourceRefs: uniqueSorted(relations.flatMap((relation) => relation.linkedSourceRefs)),
      ppcRationales: rationaleSummaries,
      limitations,
    });
    layers.push({
      layerId: `denue:analytical-layer:${denueLayer.layerId}`,
      productId,
      layerType: "OBSERVATION_POINTS",
      epistemicClass: "DERIVED",
      geographyId: input.geographyId,
      geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      geometryType: "Point",
      sourceType: "DENUE_ANALYTICAL_RELATION",
      sourceReference: null,
      sourceItemIds: relationIds,
      datasetReference: null,
      queryReference: null,
      traceabilityIds: uniqueSorted(denueLayer.traceabilityIds),
      lineage: mergedLineage.lineage,
      variables: ["relationIds", "relationTypes", "measuredFacts", "humanValidation", "limitations"],
      transformation: "PPC-accepted DENUE analytical relations consolidated by governed DENUE layer identity",
      method: DENUE_ANALYTICAL_DISPLAY_POLICY,
      limitations,
      humanReviewStatus: "APPROVED",
      publicationEligibility: "ELIGIBLE_WITH_DISCLOSURE",
      styleSpecification: { symbolizer: "MARKER", label },
      disclosure: { code: "DENUE_ANALYTICAL_RELATION_DISCLOSURE", message: "Relacion analitica aceptada por PPC; DENUE no constituye evidencia criminal, causalidad, vulnerabilidad ni riesgo.", visible: true },
      observedSourceReferences: uniqueSorted([denueLayer.sourceReference, ...relations.flatMap((relation) => relation.linkedSourceRefs)]),
      analyticalProperties: {
        analyticalProductType: DENUE_ANALYTICAL_PRODUCT_TYPE,
        displayId,
        label,
        denueLayerId: denueLayer.layerId,
        sourceEvidenceId: denueLayer.sourceItemIds[0],
        relationIds,
        relationTypes: types,
        relations,
      },
    });
  }

  const selectedIds = new Set(selection.selected.map((layer) => layer.layerId));
  const displayedRelationCount = eligible.filter((item) => selectedIds.has(item.layer.layerId)).length;
  const product: DenueAnalyticalCartographicProduct = {
    productId,
    productType: "THEMATIC_CONTEXT",
    analyticalProductType: DENUE_ANALYTICAL_PRODUCT_TYPE,
    expedienteId: input.expedienteId,
    geographyId: input.geographyId,
    methodologyVersion: input.methodologyVersion,
    canonicalGeographyReference: { ...input.canonicalGeographyReference },
    title: "RELACIONES ANALITICAS DENUE VALIDADAS POR PPC",
    purpose: "Representar relaciones analiticas DENUE elegibles sin convertir observaciones territoriales en evidencia criminal",
    layers,
    sourceReferences: uniqueSorted(layers.flatMap((layer) => layer.observedSourceReferences)),
    traceabilityIds: uniqueSorted(layers.flatMap((layer) => layer.traceabilityIds)),
    limitations: uniqueSorted(["DENUE_NOT_CRIMINAL_EVIDENCE", ...layers.flatMap((layer) => layer.limitations)]),
    publicationEligibility: "ELIGIBLE_WITH_DISCLOSURE",
    humanReviewStatus: "APPROVED",
    createdAtReference: input.createdAtReference,
    contextualUniverseCount: input.contextualUniverseCount,
    contextualDisplayedCount: input.contextualDisplayedCount,
    analyticalAcceptedCount: uniqueEntries.filter((entry) => entry.relation.humanValidation.status === "ACCEPTED").length,
    analyticalEligibleCount: eligible.length,
    analyticalDisplayedRelationCount: displayedRelationCount,
    analyticalMapItemCount: mapItems.length,
    eligibleRelations: eligible.map((item) => item.entry.relation).sort((left, right) => left.relationId.localeCompare(right.relationId)),
    mapItems,
    tableRows,
    publicationDecisions: eligible.map((item) => item.decision).sort((left, right) => left.relationId.localeCompare(right.relationId)),
    selection: {
      policy: DENUE_ANALYTICAL_DISPLAY_POLICY,
      parameters: { ...config },
      selectedDenueLayerIds: selection.selected.map((layer) => layer.layerId),
      omittedDenueLayerIds: selection.omitted.map((layer) => layer.layerId),
      disclosure: [
        "DENUE_ANALYTICAL_SELECTION_FOR_CARTOGRAPHIC_LEGIBILITY",
        "DENUE_ANALYTICAL_SELECTION_NOT_CRIMINOLOGICAL_RANKING",
        "CONTEXTUAL_AND_ANALYTICAL_UNIVERSES_REMAIN_DISTINCT",
      ],
    },
    visualRole: "SECONDARY_VISUAL_CANDIDATE",
    maxInstitutionalVisualBudget: 5,
  };
  const validation = validateDenueAnalyticalCartographicProduct(product);
  return validation.accepted
    ? { status: "BUILT", product, validation, rejectedRelations, duplicateRelationCount, reasons: [] }
    : reject(validation.reasons, rejectedRelations, duplicateRelationCount);
}
