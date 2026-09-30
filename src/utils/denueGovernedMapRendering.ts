import { evaluateCartographicAdmission } from "@/utils/cartographicAdmissionGate";
import type { LatLngPoint } from "@/utils/canonicalProjectGeography";
import type { DenueCartographicDisplayPlan } from "@/utils/denueCartographicDisplaySelection";
import type { GovernedCartographicProduct, GovernedMapLayer } from "@/utils/governedCartographicProduct";

export interface DenueGovernedRenderMarker {
  layerId: string;
  position: LatLngPoint;
}

export interface DenueGovernedMapRendering {
  markers: DenueGovernedRenderMarker[];
  legend: {
    canonicalGeometry: string;
    denueContext: string;
    interpretationLimit: string;
    countStatement: string;
  };
  audit: {
    productId: string;
    geographyId: string;
    canonicalGeometryRendered: true;
    denueAvailableCount: number;
    denueSelectedCount: number;
    denueRenderedCount: number;
    renderedLayerIds: string[];
    sourceReferences: string[];
    traceabilityIds: string[];
    displayPolicy: string;
    displayParameters: DenueCartographicDisplayPlan["selectionParameters"];
    disclosures: string[];
  };
}

export type DenueGovernedMapRenderingResult =
  | { status: "READY"; rendering: DenueGovernedMapRendering; reasons: [] }
  | { status: "REJECTED"; rendering: null; reasons: string[] };

const REQUIRED_DISCLOSURES = [
  "DENUE_DISPLAY_SELECTION_FOR_CARTOGRAPHIC_LEGIBILITY",
  "DENUE_DISPLAY_SELECTION_NOT_ANALYTICAL_RANKING",
  "DENUE_DISPLAY_SELECTION_DOES_NOT_MODIFY_SOURCE_UNIVERSE",
];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function sameIds(left: string[], right: string[]): boolean {
  const leftSorted = [...left].sort((a, b) => a.localeCompare(b));
  const rightSorted = [...right].sort((a, b) => a.localeCompare(b));
  return leftSorted.length === rightSorted.length && leftSorted.every((value, index) => value === rightSorted[index]);
}

function reject(reasons: string[]): DenueGovernedMapRenderingResult {
  return { status: "REJECTED", rendering: null, reasons: uniqueSorted(reasons) };
}

function point(layer: GovernedMapLayer): LatLngPoint | null {
  if (layer.geometry.type !== "Point" || layer.geometryType !== "Point" || layer.layerType !== "OBSERVATION_POINTS") return null;
  const [lng, lat] = layer.geometry.coordinates;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function adaptDenueDisplayPlanToMapRendering(
  product: GovernedCartographicProduct,
  displayPlan: DenueCartographicDisplayPlan
): DenueGovernedMapRenderingResult {
  const reasons: string[] = [];
  const admission = evaluateCartographicAdmission(product);
  if (!admission.accepted || admission.status !== "ADMITTED") {
    reasons.push("DENUE_PRODUCT_NOT_ADMITTED", ...admission.reasons.map((reason) => `ADMISSION:${reason}`));
  }
  if (product.productType !== "OBSERVATION_MAP") reasons.push("DENUE_OBSERVATION_MAP_REQUIRED");
  if (displayPlan.productId !== product.productId) reasons.push("DENUE_DISPLAY_PLAN_PRODUCT_ID_MISMATCH");
  if (displayPlan.geographyId !== product.geographyId) reasons.push("DENUE_DISPLAY_PLAN_GEOGRAPHY_ID_MISMATCH");

  const productLayerIds = product.layers.map((layer) => layer.layerId);
  for (const layer of product.layers) {
    if (layer.sourceType !== "DENUE" || layer.epistemicClass !== "OBSERVED" || !point(layer)) {
      reasons.push(`DENUE_PRODUCT_LAYER_INVALID:${layer.layerId}`);
    }
  }
  const selectedIds = Array.isArray(displayPlan.selectedLayerIds) ? displayPlan.selectedLayerIds : [];
  const omittedIds = Array.isArray(displayPlan.omittedLayerIds) ? displayPlan.omittedLayerIds : [];
  if (new Set(selectedIds).size !== selectedIds.length) reasons.push("DENUE_DISPLAY_PLAN_SELECTED_IDS_DUPLICATED");
  if (new Set(omittedIds).size !== omittedIds.length) reasons.push("DENUE_DISPLAY_PLAN_OMITTED_IDS_DUPLICATED");
  if (selectedIds.some((layerId) => omittedIds.includes(layerId))) reasons.push("DENUE_DISPLAY_PLAN_PARTITION_OVERLAP");
  if (!sameIds([...selectedIds, ...omittedIds], productLayerIds)) reasons.push("DENUE_DISPLAY_PLAN_UNIVERSE_MISMATCH");
  if (displayPlan.totalEligibleLayers !== product.layers.length) reasons.push("DENUE_DISPLAY_PLAN_TOTAL_ELIGIBLE_MISMATCH");
  if (!sameIds(displayPlan.audit?.selectedLayerIds || [], selectedIds)) reasons.push("DENUE_DISPLAY_PLAN_SELECTED_AUDIT_MISMATCH");
  if (!sameIds(displayPlan.audit?.omittedLayerIds || [], omittedIds)) reasons.push("DENUE_DISPLAY_PLAN_OMITTED_AUDIT_MISMATCH");
  if (!sameIds(displayPlan.audit?.inputLayerIds || [], productLayerIds)) reasons.push("DENUE_DISPLAY_PLAN_INPUT_AUDIT_MISMATCH");
  if (displayPlan.audit?.totalEligible !== product.layers.length) reasons.push("DENUE_DISPLAY_PLAN_TOTAL_AUDIT_MISMATCH");
  if (displayPlan.audit?.selectedCount !== selectedIds.length || displayPlan.audit?.omittedCount !== omittedIds.length) {
    reasons.push("DENUE_DISPLAY_PLAN_COUNT_AUDIT_MISMATCH");
  }
  if (displayPlan.audit?.policy !== displayPlan.selectionPolicy) reasons.push("DENUE_DISPLAY_PLAN_POLICY_AUDIT_MISMATCH");
  if (JSON.stringify(displayPlan.audit?.parameters) !== JSON.stringify(displayPlan.selectionParameters)) {
    reasons.push("DENUE_DISPLAY_PLAN_PARAMETERS_AUDIT_MISMATCH");
  }
  if (!REQUIRED_DISCLOSURES.every((disclosure) => displayPlan.disclosure?.includes(disclosure))) {
    reasons.push("DENUE_DISPLAY_PLAN_DISCLOSURES_REQUIRED");
  }

  const layersById = new Map(product.layers.map((layer) => [layer.layerId, layer]));
  const markers: DenueGovernedRenderMarker[] = [];
  for (const layerId of selectedIds) {
    const layer = layersById.get(layerId);
    if (!layer) {
      reasons.push(`DENUE_SELECTED_LAYER_NOT_FOUND:${layerId}`);
      continue;
    }
    if (layer.sourceType !== "DENUE" || layer.epistemicClass !== "OBSERVED") {
      reasons.push(`DENUE_SELECTED_LAYER_IDENTITY_INVALID:${layerId}`);
      continue;
    }
    const position = point(layer);
    if (!position) reasons.push(`DENUE_SELECTED_LAYER_POINT_INVALID:${layerId}`);
    else markers.push({ layerId, position });
  }
  if (reasons.length > 0) return reject(reasons);

  return {
    status: "READY",
    reasons: [],
    rendering: {
      markers,
      legend: {
        canonicalGeometry: "Geografía canónica del expediente.",
        denueContext: "Puntos de contexto: unidades económicas observadas DENUE seleccionadas exclusivamente para legibilidad cartográfica.",
        interpretationLimit: "DENUE no representa incidencia, evidencia criminal, hallazgo ni riesgo.",
        countStatement: `${product.layers.length} registros DENUE disponibles; ${markers.length} representados mediante política de legibilidad cartográfica.`,
      },
      audit: {
        productId: product.productId,
        geographyId: product.geographyId,
        canonicalGeometryRendered: true,
        denueAvailableCount: product.layers.length,
        denueSelectedCount: selectedIds.length,
        denueRenderedCount: markers.length,
        renderedLayerIds: markers.map((marker) => marker.layerId),
        sourceReferences: [...product.sourceReferences],
        traceabilityIds: [...product.traceabilityIds],
        displayPolicy: displayPlan.selectionPolicy,
        displayParameters: { ...displayPlan.selectionParameters },
        disclosures: [...displayPlan.disclosure],
      },
    },
  };
}
