/** Design contract only. No productive resolver, persistence or publication admission. */
export type ScinceCoverageRelation =
  | "TOUCHES_ONLY" | "INTERIOR_INTERSECTION" | "ANALYSIS_COVERS_UNIT"
  | "UNIT_COVERS_ANALYSIS" | "EQUAL_FOOTPRINT";
export type ScinceCoverageLevel = "ESTADO" | "MUNICIPIO" | "LOCALIDAD" | "AGEB" | "MANZANA";
export interface ScinceCoverageTopologyEvidence {
  /** Supplied only by a trusted engine adapter, never by UI or persisted VALID labels. */
  geometry: import("../utils/canonicalProjectGeography").CanonicalGeometry;
  crs: number;
  engine: "GEOS";
  engineVersion: string;
  isValid: boolean;
  isSimple: boolean;
  isEmpty: boolean;
  area: number;
}
export type ScinceCoverageGeometryCode =
  | "SCINCE_COVERAGE_GEOMETRY_EMPTY" | "SCINCE_COVERAGE_GEOMETRY_NON_FINITE"
  | "SCINCE_COVERAGE_GEOMETRY_STRUCTURE_INVALID" | "SCINCE_COVERAGE_COORDINATE_OUT_OF_RANGE"
  | "SCINCE_COVERAGE_CORRIDOR_NOT_SIMPLE" | "SCINCE_COVERAGE_CORRIDOR_DEGENERATE"
  | "SCINCE_COVERAGE_POLYGON_INVALID" | "SCINCE_COVERAGE_CRS_UNSUPPORTED"
  | "SCINCE_COVERAGE_PLACEHOLDER_COORDINATE" | "SCINCE_COVERAGE_TOPOLOGY_EVIDENCE_INVALID";
export type ScinceCoverageGeometryValidation =
  | { status: "INVALID"; code: ScinceCoverageGeometryCode }
  | { status: "VALID"; mode: "CORRIDOR" | "POLYGON"; geometryIdentity: string };
export interface ScinceCoverageDataset {
  datasetId: string;
  year: number;
  version: string;
  provenance: {
    productName: string;
    geographySourceUrl: string;
    censusSourceUrl: string;
    geographySha256: string;
    censusSha256: string;
    importedAt: string;
    completedAt: string;
  };
}
export interface ScinceCoverageSourceRow {
  demographicGeographicLevel: "AGEB" | "MANZANA";
  /** Importer key: ENT:MUN:LOC:AGEB[:MZA], not globally unique. */
  sourceRowKey: string;
  geographicCode: string;
  /** Must be classified against this row's own official footprint, never a child manzana. */
  relationToAnalysis: ScinceCoverageRelation;
  demographics: {
    populationTotal: number | null;
    housingTotal: number | null;
    inhabitedPrivateHousing: number | null;
    uninhabitedPrivateHousing: number | null;
    marginacion: null;
  };
  observedAt: null;
}
export interface ScinceCoverageTerritorialUnit {
  geographicLevel: ScinceCoverageLevel;
  /** Official source_cvegeo, preserving leading zeroes. */
  geographicCode: string;
  relationToAnalysis: ScinceCoverageRelation;
  /** Composite identities of sourceRows; multiple manzanas may reference one AGEB. */
  sourceRowIds: string[];
}
export interface ScinceCanonicalCoverage {
  schemaVersion: "SCINCE_CANONICAL_COVERAGE_V1";
  support: "SUPPORTED_CONTEXT_ONLY";
  aggregation: "PROHIBITED";
  projectId: string;
  geographyBinding: {
    geographyId: string;
    geographyType: "CORRIDOR" | "POLYGON";
    geographyFingerprint: string;
  };
  coverageMode: "LINE_INTERSECTION_CONTEXT" | "POLYGON_INTERSECTION_CONTEXT";
  dataset: ScinceCoverageDataset;
  territorialUnits: ScinceCoverageTerritorialUnit[];
  sourceRows: Array<ScinceCoverageSourceRow & {
    observationId: string;
    usage: "FULL_SOURCE_UNIT_CONTEXT_ONLY" | "ENUMERATION_ONLY";
  }>;
  limitations: string[];
}
