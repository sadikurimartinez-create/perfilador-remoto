export type IncidenceGeoJsonPosition = [number, number];

export type IncidencePointGeometry = {
  type: "Point";
  coordinates: IncidenceGeoJsonPosition;
};

export type IncidenceLineStringGeometry = {
  type: "LineString";
  coordinates: IncidenceGeoJsonPosition[];
};

export type IncidencePolygonGeometry = {
  type: "Polygon";
  coordinates: IncidenceGeoJsonPosition[][];
};

export type IncidenceMultiPolygonGeometry = {
  type: "MultiPolygon";
  coordinates: IncidenceGeoJsonPosition[][][];
};

export type IncidenceGeoJsonGeometry =
  | IncidencePointGeometry
  | IncidenceLineStringGeometry
  | IncidencePolygonGeometry
  | IncidenceMultiPolygonGeometry;

export type IncidenceSpatialMode =
  | "POINT_RADIUS"
  | "CORRIDOR_COVERAGE"
  | "POLYGON_BOUNDARY"
  | "STREET_SELECTION"
  | "VERSUS_SCENARIO";

export type IncidenceSpatialSource =
  | "EXPEDIENT"
  | "STREET_SELECTION"
  | "CUSTOM_POLYGON"
  | "VERSUS";

export type IncidenceCanonicalSpatialQueryMetadata = {
  queryId?: string | null;
  expedienteId?: string | null;
  scenarioId?: "A" | "B" | string | null;
  sourceReference?: string | null;
  sourceLabel?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  radiusMeters?: number | null;
  corridorWidthMeters?: number | null;
  territoryType?: string | null;
  limitations?: string[];
};

export type IncidenceCanonicalSpatialQuery = {
  geometry: IncidenceGeoJsonGeometry;
  mode: IncidenceSpatialMode;
  source: IncidenceSpatialSource;
  metadata: IncidenceCanonicalSpatialQueryMetadata;
};
