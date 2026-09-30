import { SpatialLayerEngine, type Coordinate } from "@/lib/providers/spatialLayerEngine";
import { evaluateCartographicAdmission } from "@/utils/cartographicAdmissionGate";
import type { GovernedCartographicProduct, GovernedMapLayer } from "@/utils/governedCartographicProduct";

export const DENUE_CARTOGRAPHIC_DISPLAY_POLICY = "DENUE_SPATIAL_DISPERSION_V1";

export const DEFAULT_DENUE_CARTOGRAPHIC_DISPLAY_CONFIG = Object.freeze({
  maxDisplayedPoints: 40,
  minimumSeparationMeters: 40,
});

export const DENUE_CARTOGRAPHIC_DISPLAY_DEFAULT_RATIONALE =
  "Forty markers with forty-meter separation is the default editorial budget for a compact institutional map; renderers may provide another explicit configuration.";

export type DenueCartographicOmissionReason = "SPATIAL_DECONFLICT" | "DISPLAY_BUDGET";

export interface DenueCartographicDisplayConfig {
  maxDisplayedPoints: number;
  minimumSeparationMeters: number;
}

export interface DenueCartographicDisplayOmission {
  layerId: string;
  reason: DenueCartographicOmissionReason;
  nearestSelectedLayerId: string;
  nearestSelectedDistanceMeters: number;
}

export interface DenueCartographicDisplayPlan {
  productId: string;
  geographyId: string;
  totalEligibleLayers: number;
  selectedLayerIds: string[];
  omittedLayerIds: string[];
  selectionPolicy: typeof DENUE_CARTOGRAPHIC_DISPLAY_POLICY;
  selectionParameters: DenueCartographicDisplayConfig;
  disclosure: string[];
  audit: {
    totalEligible: number;
    selectedCount: number;
    omittedCount: number;
    inputLayerIds: string[];
    selectedLayerIds: string[];
    omittedLayerIds: string[];
    selectionSequence: string[];
    policy: typeof DENUE_CARTOGRAPHIC_DISPLAY_POLICY;
    parameters: DenueCartographicDisplayConfig;
    deterministicTieBreaker: "LAYER_ID_CANONICAL_ASC";
    omissions: DenueCartographicDisplayOmission[];
  };
}

export type DenueCartographicDisplaySelectionResult =
  | { status: "PLANNED"; plan: DenueCartographicDisplayPlan; reasons: [] }
  | { status: "REJECTED"; plan: null; reasons: string[] };

const DISCLOSURES = [
  "DENUE_DISPLAY_SELECTION_FOR_CARTOGRAPHIC_LEGIBILITY",
  "DENUE_DISPLAY_SELECTION_NOT_ANALYTICAL_RANKING",
  "DENUE_DISPLAY_SELECTION_DOES_NOT_MODIFY_SOURCE_UNIVERSE",
];

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pointFrom(layer: GovernedMapLayer): Coordinate | null {
  if (layer.layerType !== "OBSERVATION_POINTS" || layer.geometryType !== "Point" || layer.geometry.type !== "Point") {
    return null;
  }
  const [lng, lat] = layer.geometry.coordinates;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function reject(reasons: string[]): DenueCartographicDisplaySelectionResult {
  return { status: "REJECTED", plan: null, reasons: uniqueSorted(reasons) };
}

function nearestSelected(
  candidate: GovernedMapLayer,
  selected: GovernedMapLayer[],
  points: Map<string, Coordinate>
): { layerId: string; distanceMeters: number } {
  let nearestLayerId = selected[0].layerId;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const selectedLayer of selected) {
    const distance = SpatialLayerEngine.getDistance(points.get(candidate.layerId)!, points.get(selectedLayer.layerId)!);
    if (distance < nearestDistance || (distance === nearestDistance && selectedLayer.layerId.localeCompare(nearestLayerId) < 0)) {
      nearestDistance = distance;
      nearestLayerId = selectedLayer.layerId;
    }
  }
  return { layerId: nearestLayerId, distanceMeters: nearestDistance };
}

export function selectDenueCartographicDisplay(
  product: GovernedCartographicProduct | null,
  config: DenueCartographicDisplayConfig = DEFAULT_DENUE_CARTOGRAPHIC_DISPLAY_CONFIG
): DenueCartographicDisplaySelectionResult {
  if (!product) return reject(["PRODUCT_REQUIRED"]);

  const reasons: string[] = [];
  if (product.productType !== "OBSERVATION_MAP") reasons.push("DENUE_OBSERVATION_MAP_REQUIRED");
  if (!present(product.geographyId)) reasons.push("GEOGRAPHY_ID_REQUIRED");
  if (!Number.isInteger(config?.maxDisplayedPoints) || config.maxDisplayedPoints <= 0) reasons.push("MAX_DISPLAYED_POINTS_INVALID");
  if (!Number.isFinite(config?.minimumSeparationMeters) || config.minimumSeparationMeters <= 0) {
    reasons.push("MINIMUM_SEPARATION_METERS_INVALID");
  }

  const layerIds = new Set<string>();
  const points = new Map<string, Coordinate>();
  for (const layer of Array.isArray(product.layers) ? product.layers : []) {
    if (!present(layer.layerId)) {
      reasons.push("LAYER_ID_REQUIRED");
      continue;
    }
    if (layerIds.has(layer.layerId)) reasons.push(`LAYER:${layer.layerId}:DUPLICATE_LAYER_ID`);
    layerIds.add(layer.layerId);
    if (layer.sourceType !== "DENUE") reasons.push(`LAYER:${layer.layerId}:DENUE_SOURCE_REQUIRED`);
    if (layer.epistemicClass !== "OBSERVED") reasons.push(`LAYER:${layer.layerId}:OBSERVED_LAYER_REQUIRED`);
    const point = pointFrom(layer);
    if (!point) reasons.push(`LAYER:${layer.layerId}:VALID_POINT_REQUIRED`);
    else points.set(layer.layerId, point);
  }

  const admission = evaluateCartographicAdmission(product);
  if (admission.status !== "ADMITTED" || !admission.accepted) {
    reasons.push("PRODUCT_NOT_ADMITTED", ...admission.reasons.map((reason) => `ADMISSION:${reason}`));
  }
  if (reasons.length > 0) return reject(reasons);

  const layers = [...product.layers].sort((left, right) => left.layerId.localeCompare(right.layerId));
  const selected: GovernedMapLayer[] = [layers[0]];
  const remaining = new Map(layers.slice(1).map((layer) => [layer.layerId, layer]));

  while (selected.length < config.maxDisplayedPoints && remaining.size > 0) {
    let next: GovernedMapLayer | null = null;
    let nextNearestDistance = Number.NEGATIVE_INFINITY;
    for (const candidate of remaining.values()) {
      const nearest = nearestSelected(candidate, selected, points);
      if (nearest.distanceMeters < config.minimumSeparationMeters) continue;
      if (
        nearest.distanceMeters > nextNearestDistance ||
        (nearest.distanceMeters === nextNearestDistance && (!next || candidate.layerId.localeCompare(next.layerId) < 0))
      ) {
        next = candidate;
        nextNearestDistance = nearest.distanceMeters;
      }
    }
    if (!next) break;
    selected.push(next);
    remaining.delete(next.layerId);
  }

  const omissions: DenueCartographicDisplayOmission[] = Array.from(remaining.values())
    .map((layer) => {
      const nearest = nearestSelected(layer, selected, points);
      return {
        layerId: layer.layerId,
        reason: nearest.distanceMeters < config.minimumSeparationMeters
          ? "SPATIAL_DECONFLICT" as const
          : "DISPLAY_BUDGET" as const,
        nearestSelectedLayerId: nearest.layerId,
        nearestSelectedDistanceMeters: nearest.distanceMeters,
      };
    })
    .sort((left, right) => left.layerId.localeCompare(right.layerId));
  const inputLayerIds = layers.map((layer) => layer.layerId);
  const selectedLayerIds = selected.map((layer) => layer.layerId).sort((left, right) => left.localeCompare(right));
  const omittedLayerIds = omissions.map((omission) => omission.layerId);
  const parameters = { ...config };

  return {
    status: "PLANNED",
    reasons: [],
    plan: {
      productId: product.productId,
      geographyId: product.geographyId,
      totalEligibleLayers: layers.length,
      selectedLayerIds,
      omittedLayerIds,
      selectionPolicy: DENUE_CARTOGRAPHIC_DISPLAY_POLICY,
      selectionParameters: parameters,
      disclosure: [...DISCLOSURES],
      audit: {
        totalEligible: layers.length,
        selectedCount: selectedLayerIds.length,
        omittedCount: omittedLayerIds.length,
        inputLayerIds,
        selectedLayerIds: [...selectedLayerIds],
        omittedLayerIds: [...omittedLayerIds],
        selectionSequence: selected.map((layer) => layer.layerId),
        policy: DENUE_CARTOGRAPHIC_DISPLAY_POLICY,
        parameters: { ...parameters },
        deterministicTieBreaker: "LAYER_ID_CANONICAL_ASC",
        omissions,
      },
    },
  };
}
