import type { GeoJsonPosition, CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import type { CanonicalLineageNode } from "@/utils/evidenceLineage";
import type { CanonicalHumanValidationStatus } from "@/utils/humanValidationPolicy";
import type { PublicationEligibility } from "@/utils/institutionalReportPublicationContract";

export type CartographicEpistemicClass = "OBSERVED" | "DERIVED" | "HYPOTHESIS" | "PREDICTIVE";

export type GovernedCartographicProductType =
  | "TERRITORIAL_CONTEXT"
  | "OBSERVATION_MAP"
  | "DESCRIPTIVE_DENSITY"
  | "ANALYTICAL_ROUTE"
  | "THEMATIC_CONTEXT"
  | "HYPOTHESIS_MAP";

export type GovernedMapLayerType =
  | "CANONICAL_GEOGRAPHY"
  | "OBSERVATION_POINTS"
  | "OBSERVATION_LINES"
  | "OBSERVATION_AREAS"
  | "DENSITY_SURFACE"
  | "ANALYTICAL_ROUTE"
  | "THEMATIC_AREA"
  | "HYPOTHESIS_GEOMETRY"
  | "PREDICTIVE_GEOMETRY";

export type GovernedMapGeometry =
  | { type: "Point"; coordinates: GeoJsonPosition }
  | { type: "MultiPoint"; coordinates: GeoJsonPosition[] }
  | { type: "LineString"; coordinates: GeoJsonPosition[] }
  | { type: "MultiLineString"; coordinates: GeoJsonPosition[][] }
  | { type: "Polygon"; coordinates: GeoJsonPosition[][] }
  | { type: "MultiPolygon"; coordinates: GeoJsonPosition[][][] };

export type GovernedMapGeometryType = GovernedMapGeometry["type"];

export type CartographicHumanReviewStatus = CanonicalHumanValidationStatus | "NOT_REQUIRED";

export interface CartographicDatasetReference {
  datasetId: string;
  version?: string | null;
  sourceReference?: string | null;
  temporalCoverage?: { start?: string | null; end?: string | null } | null;
}

export interface CartographicQueryReference {
  queryId: string;
  status?: string | null;
  executedAt?: string | null;
  sourceReference?: string | null;
}

export interface CartographicStyleSpecification {
  symbolizer: "MARKER" | "LINE" | "FILL" | "HEAT_SURFACE" | "LABEL";
  color?: string | null;
  fillColor?: string | null;
  opacity?: number | null;
  weight?: number | null;
  label?: string | null;
}

export interface CartographicDisclosure {
  code: string;
  message: string;
  visible: true;
}

interface GovernedMapLayerBase {
  layerId: string;
  productId: string;
  layerType: GovernedMapLayerType;
  geographyId: string;
  geometry: GovernedMapGeometry;
  geometryType: GovernedMapGeometryType;
  sourceType: string;
  sourceReference: string | null;
  sourceItemIds: string[];
  datasetReference: CartographicDatasetReference | null;
  queryReference: CartographicQueryReference | null;
  traceabilityIds: string[];
  lineage: CanonicalLineageNode[];
  variables: string[];
  transformation: string | null;
  method: string | null;
  limitations: string[];
  humanReviewStatus: CartographicHumanReviewStatus;
  publicationEligibility: PublicationEligibility;
  styleSpecification: CartographicStyleSpecification;
  disclosure: CartographicDisclosure | null;
}

export interface ObservedGovernedMapLayer extends GovernedMapLayerBase {
  epistemicClass: "OBSERVED";
  sourceReference: string;
}

export interface DerivedGovernedMapLayer extends GovernedMapLayerBase {
  epistemicClass: "DERIVED";
  observedSourceReferences: string[];
  transformation: string;
  method: string;
}

export interface HypothesisGovernedMapLayer extends GovernedMapLayerBase {
  epistemicClass: "HYPOTHESIS";
  hypothesisReference: string;
  disclosure: CartographicDisclosure;
}

export interface PredictiveGovernedMapLayer extends GovernedMapLayerBase {
  epistemicClass: "PREDICTIVE";
  predictionReference: string;
  method: string;
  disclosure: CartographicDisclosure;
  governanceAuthorizationReference?: string | null;
}

export type GovernedMapLayer =
  | ObservedGovernedMapLayer
  | DerivedGovernedMapLayer
  | HypothesisGovernedMapLayer
  | PredictiveGovernedMapLayer;

export interface CanonicalGeographyReference {
  geographyId: string;
  geographyType: CanonicalProjectGeography["type"];
  geometryType: CanonicalProjectGeography["geometry"]["type"];
  sourceReference: string;
}

export interface GovernedCartographicProduct {
  productId: string;
  productType: GovernedCartographicProductType;
  geographyId: string;
  canonicalGeographyReference: CanonicalGeographyReference;
  title: string;
  purpose: string;
  layers: GovernedMapLayer[];
  sourceReferences: string[];
  traceabilityIds: string[];
  limitations: string[];
  publicationEligibility: PublicationEligibility;
  humanReviewStatus: CartographicHumanReviewStatus;
  createdAtReference: string;
}
