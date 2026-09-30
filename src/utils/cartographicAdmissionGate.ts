import { validateLineage } from "@/utils/evidenceLineage";
import type {
  CanonicalGeographyReference,
  CartographicDisclosure,
  GovernedCartographicProduct,
  GovernedMapGeometry,
  GovernedMapLayer,
} from "@/utils/governedCartographicProduct";

export interface CartographicAdmissionResult {
  accepted: boolean;
  status: "ADMITTED" | "REJECTED";
  reasons: string[];
}

const EPISTEMIC_CLASSES = new Set(["OBSERVED", "DERIVED", "HYPOTHESIS", "PREDICTIVE"]);
const PRODUCT_TYPES = new Set([
  "TERRITORIAL_CONTEXT",
  "OBSERVATION_MAP",
  "DESCRIPTIVE_DENSITY",
  "ANALYTICAL_ROUTE",
  "THEMATIC_CONTEXT",
  "HYPOTHESIS_MAP",
]);
const LAYER_TYPES = new Set([
  "CANONICAL_GEOGRAPHY",
  "OBSERVATION_POINTS",
  "OBSERVATION_LINES",
  "OBSERVATION_AREAS",
  "DENSITY_SURFACE",
  "ANALYTICAL_ROUTE",
  "THEMATIC_AREA",
  "HYPOTHESIS_GEOMETRY",
  "PREDICTIVE_GEOMETRY",
]);
const PUBLICATION_ELIGIBILITY = new Set(["ELIGIBLE", "ELIGIBLE_WITH_DISCLOSURE", "INELIGIBLE"]);
const HUMAN_REVIEW_STATUSES = new Set([
  "UNREVIEWED",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "RETURNED_FOR_REANALYSIS",
  "LEGACY_UNCLASSIFIED",
  "NOT_REQUIRED",
]);
const SYMBOLIZERS = new Set(["MARKER", "LINE", "FILL", "HEAT_SURFACE", "LABEL"]);
const LINEAGE_NODE_TYPES = new Set(["GEOGRAPHY", "SOURCE", "EVIDENCE", "FINDING", "INFERENCE", "ANALYSIS", "CONCLUSION"]);

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(present);
}

function validPosition(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 &&
    typeof value[0] === "number" && Number.isFinite(value[0]) && value[0] >= -180 && value[0] <= 180 &&
    typeof value[1] === "number" && Number.isFinite(value[1]) && value[1] >= -90 && value[1] <= 90;
}

function samePosition(left: unknown, right: unknown): boolean {
  return validPosition(left) && validPosition(right) && left[0] === right[0] && left[1] === right[1];
}

function distinctPositionCount(positions: unknown[]): number {
  return new Set(positions.filter(validPosition).map((position) => `${position[0]},${position[1]}`)).size;
}

function validLineString(coordinates: unknown): boolean {
  return Array.isArray(coordinates) && coordinates.length >= 2 &&
    coordinates.every(validPosition) && distinctPositionCount(coordinates) >= 2;
}

function validLinearRing(ring: unknown): boolean {
  return Array.isArray(ring) && ring.length >= 4 && ring.every(validPosition) &&
    samePosition(ring[0], ring[ring.length - 1]) && distinctPositionCount(ring.slice(0, -1)) >= 3;
}

export function isGovernedMapGeometry(value: unknown): value is GovernedMapGeometry {
  if (!isRecord(value) || !present(value.type)) return false;
  const coordinates = value.coordinates;
  if (value.type === "Point") return validPosition(coordinates);
  if (value.type === "MultiPoint") return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(validPosition);
  if (value.type === "LineString") return validLineString(coordinates);
  if (value.type === "MultiLineString") return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(validLineString);
  if (value.type === "Polygon") return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(validLinearRing);
  if (value.type === "MultiPolygon") {
    return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(
      (polygon) => Array.isArray(polygon) && polygon.length > 0 && polygon.every(validLinearRing)
    );
  }
  return false;
}

function validDisclosure(value: unknown): value is CartographicDisclosure {
  return isRecord(value) && present(value.code) && present(value.message) && value.visible === true;
}

function validateCommonLayer(layer: Record<string, any>, product: Record<string, any>, reasons: string[]): void {
  const label = present(layer.layerId) ? layer.layerId : "UNIDENTIFIED";
  const reject = (reason: string) => reasons.push(`LAYER:${label}:${reason}`);
  if (!present(layer.layerId)) reject("LAYER_ID_REQUIRED");
  if (!present(layer.productId)) reject("PRODUCT_ID_REQUIRED");
  else if (layer.productId !== product.productId) reject("PRODUCT_ID_MISMATCH");
  if (!present(layer.geographyId)) reject("GEOGRAPHY_ID_REQUIRED");
  else if (layer.geographyId !== product.geographyId) reject("GEOGRAPHY_ID_MISMATCH");
  if (!LAYER_TYPES.has(layer.layerType)) reject("LAYER_TYPE_INVALID");
  if (!EPISTEMIC_CLASSES.has(layer.epistemicClass)) reject("EPISTEMIC_CLASS_INVALID");
  if (!isGovernedMapGeometry(layer.geometry)) reject("GEOMETRY_INVALID");
  else if (layer.geometryType !== layer.geometry.type) reject("GEOMETRY_TYPE_MISMATCH");
  if (!present(layer.sourceType)) reject("SOURCE_TYPE_REQUIRED");
  if (!Array.isArray(layer.sourceItemIds)) reject("SOURCE_ITEM_IDS_INVALID");
  if (!Array.isArray(layer.traceabilityIds)) reject("TRACEABILITY_IDS_INVALID");
  if (!Array.isArray(layer.lineage)) reject("LINEAGE_INVALID");
  if (!Array.isArray(layer.variables)) reject("VARIABLES_INVALID");
  if (!Array.isArray(layer.limitations)) reject("LIMITATIONS_INVALID");
  if (!PUBLICATION_ELIGIBILITY.has(layer.publicationEligibility)) reject("PUBLICATION_ELIGIBILITY_INVALID");
  else if (layer.publicationEligibility === "INELIGIBLE") reject("PUBLICATION_INELIGIBLE");
  if (!HUMAN_REVIEW_STATUSES.has(layer.humanReviewStatus)) reject("HUMAN_REVIEW_STATUS_INVALID");
  if (!isRecord(layer.styleSpecification) || !SYMBOLIZERS.has(layer.styleSpecification.symbolizer)) reject("STYLE_SPECIFICATION_INVALID");
  if (layer.datasetReference !== null && (!isRecord(layer.datasetReference) || !present(layer.datasetReference.datasetId))) {
    reject("DATASET_REFERENCE_INVALID");
  }
  if (layer.queryReference !== null && (!isRecord(layer.queryReference) || !present(layer.queryReference.queryId))) {
    reject("QUERY_REFERENCE_INVALID");
  }
}

function hasSupportedLineage(layer: Record<string, any>): boolean {
  if (!Array.isArray(layer.lineage) || layer.lineage.length === 0) return false;
  if (!layer.lineage.every((node: unknown) => isRecord(node) && present(node.id) && LINEAGE_NODE_TYPES.has(node.type))) return false;
  return validateLineage(layer.lineage).status === "SUPPORTED";
}

function validateEpistemicLayer(layer: Record<string, any>, reasons: string[]): void {
  const label = present(layer.layerId) ? layer.layerId : "UNIDENTIFIED";
  const reject = (reason: string) => reasons.push(`LAYER:${label}:${reason}`);

  if (layer.epistemicClass === "OBSERVED") {
    if (!present(layer.sourceReference)) reject("SOURCE_REFERENCE_REQUIRED");
    if (!nonEmptyStrings(layer.sourceItemIds)) reject("SOURCE_ITEM_IDS_REQUIRED");
    if (!nonEmptyStrings(layer.traceabilityIds)) reject("TRACEABILITY_REQUIRED");
    if (!hasSupportedLineage(layer)) reject("SUPPORTED_LINEAGE_REQUIRED");
    return;
  }

  if (layer.epistemicClass === "DERIVED") {
    if (!nonEmptyStrings(layer.observedSourceReferences)) reject("OBSERVED_SOURCE_REFERENCES_REQUIRED");
    if (!present(layer.method)) reject("METHOD_REQUIRED");
    if (!present(layer.transformation)) reject("TRANSFORMATION_REQUIRED");
    if (!nonEmptyStrings(layer.variables)) reject("VARIABLES_REQUIRED");
    if (!nonEmptyStrings(layer.traceabilityIds)) reject("TRACEABILITY_REQUIRED");
    if (!hasSupportedLineage(layer)) reject("SUPPORTED_LINEAGE_REQUIRED");
    if (!nonEmptyStrings(layer.limitations)) reject("LIMITATIONS_REQUIRED");
    if (layer.publicationEligibility !== "INELIGIBLE" && layer.humanReviewStatus !== "APPROVED") reject("HUMAN_APPROVAL_REQUIRED");
    return;
  }

  if (layer.epistemicClass === "HYPOTHESIS") {
    if (!present(layer.hypothesisReference)) reject("HYPOTHESIS_REFERENCE_REQUIRED");
    if (!validDisclosure(layer.disclosure)) reject("VISIBLE_DISCLOSURE_REQUIRED");
    if (!nonEmptyStrings(layer.traceabilityIds)) reject("TRACEABILITY_REQUIRED");
    if (!hasSupportedLineage(layer)) reject("SUPPORTED_LINEAGE_REQUIRED");
    if (layer.publicationEligibility !== "INELIGIBLE" && layer.humanReviewStatus !== "APPROVED") reject("HUMAN_APPROVAL_REQUIRED");
    return;
  }

  if (layer.epistemicClass === "PREDICTIVE") {
    if (!present(layer.predictionReference)) reject("PREDICTION_REFERENCE_REQUIRED");
    if (!present(layer.method)) reject("METHOD_REQUIRED");
    if (!validDisclosure(layer.disclosure)) reject("VISIBLE_DISCLOSURE_REQUIRED");
    if (!nonEmptyStrings(layer.traceabilityIds)) reject("TRACEABILITY_REQUIRED");
    if (!hasSupportedLineage(layer)) reject("SUPPORTED_LINEAGE_REQUIRED");
    if (layer.publicationEligibility !== "INELIGIBLE" && !present(layer.governanceAuthorizationReference)) reject("PREDICTIVE_AUTO_PUBLICATION_FORBIDDEN");
    if (layer.publicationEligibility !== "INELIGIBLE" && layer.humanReviewStatus !== "APPROVED") reject("HUMAN_APPROVAL_REQUIRED");
  }
}

function expectedCanonicalGeometry(reference: CanonicalGeographyReference): string {
  if (reference.geographyType === "INDIVIDUAL") return "Point";
  if (reference.geographyType === "CORRIDOR") return "LineString";
  return reference.geometryType === "MultiPolygon" ? "MultiPolygon" : "Polygon";
}

function validateCanonicalReference(product: Record<string, any>, reasons: string[]): void {
  const reference = product.canonicalGeographyReference;
  if (!isRecord(reference)) {
    reasons.push("CANONICAL_GEOGRAPHY_REFERENCE_REQUIRED");
    return;
  }
  if (!present(reference.geographyId) || reference.geographyId !== product.geographyId) reasons.push("CANONICAL_GEOGRAPHY_ID_MISMATCH");
  if (!new Set(["INDIVIDUAL", "CORRIDOR", "POLYGON"]).has(reference.geographyType)) reasons.push("CANONICAL_GEOGRAPHY_TYPE_INVALID");
  if (!present(reference.sourceReference)) reasons.push("CANONICAL_GEOGRAPHY_SOURCE_REQUIRED");
  if (present(reference.geographyType) && present(reference.geometryType) && expectedCanonicalGeometry(reference as CanonicalGeographyReference) !== reference.geometryType) {
    reasons.push("CANONICAL_GEOMETRY_DEGRADATION_FORBIDDEN");
  }
}

export function evaluateCartographicAdmission(input: unknown): CartographicAdmissionResult {
  const reasons: string[] = [];
  if (!isRecord(input)) return { accepted: false, status: "REJECTED", reasons: ["PRODUCT_INVALID"] };

  if (!present(input.productId)) reasons.push("PRODUCT_ID_REQUIRED");
  if (!PRODUCT_TYPES.has(input.productType)) reasons.push("PRODUCT_TYPE_INVALID");
  if (!present(input.geographyId)) reasons.push("GEOGRAPHY_ID_REQUIRED");
  if (!present(input.title)) reasons.push("TITLE_REQUIRED");
  if (!present(input.purpose)) reasons.push("PURPOSE_REQUIRED");
  if (!nonEmptyStrings(input.sourceReferences)) reasons.push("SOURCE_REFERENCES_REQUIRED");
  if (!nonEmptyStrings(input.traceabilityIds)) reasons.push("TRACEABILITY_REQUIRED");
  if (!Array.isArray(input.limitations)) reasons.push("LIMITATIONS_INVALID");
  if (!PUBLICATION_ELIGIBILITY.has(input.publicationEligibility)) reasons.push("PUBLICATION_ELIGIBILITY_INVALID");
  else if (input.publicationEligibility === "INELIGIBLE") reasons.push("PRODUCT_INELIGIBLE");
  if (!HUMAN_REVIEW_STATUSES.has(input.humanReviewStatus)) reasons.push("HUMAN_REVIEW_STATUS_INVALID");
  if (!present(input.createdAtReference)) reasons.push("CREATED_AT_REFERENCE_REQUIRED");
  validateCanonicalReference(input, reasons);

  if (!Array.isArray(input.layers) || input.layers.length === 0) {
    reasons.push("LAYERS_REQUIRED");
  } else {
    const layerIds = new Set<string>();
    for (const candidate of input.layers) {
      if (!isRecord(candidate)) {
        reasons.push("LAYER_INVALID");
        continue;
      }
      validateCommonLayer(candidate, input, reasons);
      validateEpistemicLayer(candidate, reasons);
      if (present(candidate.layerId)) {
        if (layerIds.has(candidate.layerId)) reasons.push(`LAYER:${candidate.layerId}:DUPLICATE_LAYER_ID`);
        layerIds.add(candidate.layerId);
      }
      if (input.publicationEligibility === "ELIGIBLE" && candidate.publicationEligibility !== "ELIGIBLE") {
        reasons.push(`LAYER:${candidate.layerId || "UNIDENTIFIED"}:PRODUCT_ELIGIBILITY_EXCEEDS_LAYER`);
      }
    }
  }

  if (input.productType === "TERRITORIAL_CONTEXT" && Array.isArray(input.layers)) {
    const canonicalLayers = input.layers.filter((layer: any) => isRecord(layer) && layer.layerType === "CANONICAL_GEOGRAPHY");
    if (canonicalLayers.length !== 1) reasons.push("TERRITORIAL_CONTEXT_REQUIRES_ONE_CANONICAL_LAYER");
    const canonicalLayer = canonicalLayers[0];
    const reference = input.canonicalGeographyReference;
    if (canonicalLayer && isRecord(reference) && canonicalLayer.geometry?.type !== expectedCanonicalGeometry(reference as CanonicalGeographyReference)) {
      reasons.push("CANONICAL_LAYER_GEOMETRY_DEGRADATION_FORBIDDEN");
    }
  }

  if (input.productType === "HYPOTHESIS_MAP" && input.publicationEligibility !== "INELIGIBLE" && input.humanReviewStatus !== "APPROVED") {
    reasons.push("HYPOTHESIS_PRODUCT_HUMAN_APPROVAL_REQUIRED");
  }

  const uniqueReasons = Array.from(new Set(reasons));
  return {
    accepted: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "ADMITTED" : "REJECTED",
    reasons: uniqueReasons,
  };
}

export function admitCartographicProduct(product: GovernedCartographicProduct): CartographicAdmissionResult {
  return evaluateCartographicAdmission(product);
}
