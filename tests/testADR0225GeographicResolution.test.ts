import fs from "node:fs";
import path from "node:path";
import type { CrimeDatasetIdentity } from "../src/types/crimeDatasetIdentity";
import type { CrimeExpedientGeographyContext } from "../src/types/crimeIncidenceGeographicResolution";
import type { CrimeIncidenceQueryRequest } from "../src/types/crimeIncidenceQueryGovernance";
import type { CrimeIncidenceQueryEnvelope, CrimeIncidenceQueryGeometry } from "../src/types/crimeIncidenceWorkspace";
import { resolveCrimeIncidenceGeography } from "../src/utils/crimeIncidenceGeographicResolution";
import { resolveCrimeIncidenceQuery } from "../src/utils/crimeIncidenceQueryGovernance";

const lineage = {
  dataset: "crime-dataset-2026",
  querySource: "POSTGIS" as const,
  filters: {},
  timeRange: { start: "2026-01-01", end: "2026-08-31", status: "KNOWN" as const },
  geographicFilter: {
    center: { lat: 21.88, lng: -102.29 },
    radiusMeters: 1000,
    coverageStatus: "IN_COVERAGE" as const,
  },
  recordSubset: { totalScanned: 1, matched: 1, excluded: 0, duplicates: 0, returnedRecords: 1 },
};

const pointGeometry: CrimeIncidenceQueryGeometry = {
  mode: "POINT_RADIUS",
  geometry: { type: "Point", coordinates: [-102.29, 21.88] },
  radiusMeters: 1000,
};
const corridorGeometry: CrimeIncidenceQueryGeometry = {
  mode: "CORRIDOR_COVERAGE",
  geometry: { type: "LineString", coordinates: [[-102.29, 21.88], [-102.28, 21.89]] },
  corridorWidthMeters: 250,
};
const polygonGeometry: CrimeIncidenceQueryGeometry = {
  mode: "POLYGON_BOUNDARY",
  geometry: { type: "Polygon", coordinates: [[[-102.30, 21.87], [-102.27, 21.87], [-102.27, 21.90], [-102.30, 21.90], [-102.30, 21.87]]] },
};

function dataset(): CrimeDatasetIdentity {
  return {
    datasetId: "crime-dataset-2026",
    datasetName: "Incidencia observada 2026",
    datasetVersion: "2026.1",
    sourceType: "POSTGIS",
    sourceName: "incidencia_estadistica",
    sourceOrganization: "SSPE Aguascalientes",
    temporalCoverage: { start: "2026-01-01", end: "2026-08-31", status: "KNOWN" },
    geographicCoverage: { status: "IN_COVERAGE", scopeCompatibility: "IN_SCOPE" },
    validationSummary: { status: "SCHEMA_VALID", schemaValid: true, recordCount: 1 },
  };
}

function envelope(queryGeometry: CrimeIncidenceQueryGeometry): CrimeIncidenceQueryEnvelope {
  return {
    records: [{
      id: "incident-1",
      incidentType: "Robo",
      occurredDate: "2026-08-01",
      occurredTime: null,
      timeRange: null,
      coordinates: { lat: 21.881, lng: -102.291, originalLat: 21.881, originalLng: -102.291 },
      location: {},
      source: { querySource: "POSTGIS", sourceStatus: "POSTGIS_AVAILABLE", datasetId: "crime-dataset-2026" },
      coverage: { geographic: "IN_COVERAGE" },
      geoValidation: "VALID_GEOLOCATION",
      lineage,
    }],
    querySource: "POSTGIS",
    sourceStatus: "POSTGIS_AVAILABLE",
    coverageStatus: "IN_COVERAGE",
    lineage,
    bibliography: "SSPE Aguascalientes",
    queryGeometry,
    queryParameters: {},
    warnings: [],
    errors: [],
    dataset: { datasetId: "crime-dataset-2026", datasetVersion: "2026.1", sourceReference: "incidencia_estadistica", lineage },
  };
}

function query(queryGeometry: CrimeIncidenceQueryGeometry) {
  const sourceEnvelope = envelope(queryGeometry);
  const request: CrimeIncidenceQueryRequest = {
    datasetIdentity: dataset(),
    queryGeometry,
    temporalFilters: {},
    crimeFilters: {},
    purpose: "MAP",
    analyticLevel: "DESCRIPTIVE",
    requestProvenance: { requestedBy: "analyst-1", requestReference: "query-1" },
    queryParameters: {},
    sourceEnvelope,
  };
  return resolveCrimeIncidenceQuery(request);
}

function context(queryGeometry: CrimeIncidenceQueryGeometry): CrimeExpedientGeographyContext {
  const base = { expedienteId: "EXP-0225", source: "PROJECT_CREATION" as const, createdBy: "analyst-1" };
  if (queryGeometry.mode === "POINT_RADIUS") return { ...base, geographyType: "INDIVIDUAL", point: queryGeometry };
  if (queryGeometry.mode === "CORRIDOR_COVERAGE") return { ...base, geographyType: "CORRIDOR", corridor: queryGeometry };
  return { ...base, geographyType: "POLYGON", polygon: queryGeometry };
}

describe("ADR-022.5 geographic resolution", () => {
  test.each([
    ["POINT_RADIUS", pointGeometry],
    ["CORRIDOR_COVERAGE", corridorGeometry],
    ["POLYGON_BOUNDARY", polygonGeometry],
  ] as const)("%s preserves authoritative geometry", (mode, geometry) => {
    const resolution = resolveCrimeIncidenceGeography(context(geometry), query(geometry));
    expect(resolution.geometryType).toBe(mode);
    expect(resolution.geometry).toEqual(geometry);
    expect(resolution.matchedRecords[0].coordinates).toEqual({
      lat: 21.881,
      lng: -102.291,
      originalLat: 21.881,
      originalLng: -102.291,
    });
  });

  test("does not convert or replace a mismatched expedient geometry", () => {
    const resolution = resolveCrimeIncidenceGeography(context(corridorGeometry), query(pointGeometry));
    expect(resolution.geometry).toEqual(corridorGeometry);
    expect(resolution.geometry.geometry.type).toBe("LineString");
    expect(resolution.matchedRecords).toEqual([]);
    expect(resolution.excludedRecords).toHaveLength(1);
    expect(resolution.coverageExplanation).toBe("QUERY_GEOMETRY_DOES_NOT_MATCH_EXPEDIENT_AUTHORITY");
  });

  test("preserves geography, query, dataset, and institutional provenance", () => {
    const inputContext = context(polygonGeometry);
    const inputQuery = query(polygonGeometry);
    const resolution = resolveCrimeIncidenceGeography(inputContext, inputQuery);
    expect(resolution.expedientGeography).toEqual(inputContext);
    expect(resolution.queryResolution).toEqual(inputQuery);
    expect(resolution.datasetProvenance).toEqual(inputQuery.datasetProvenance);
    expect(resolution.lineage).toEqual(inputQuery.lineage);
    expect(resolution.institutionalMetadata).toEqual({
      watermark: "CEIPOL",
      header: "Centro de Estudios en Seguridad y Política Criminal",
      footer: "Secretaría de Seguridad Pública del Estado de Aguascalientes",
    });
  });

  test("does not create evidence or finding references", () => {
    const resolution = resolveCrimeIncidenceGeography(context(pointGeometry), query(pointGeometry));
    const record = resolution as unknown as Record<string, unknown>;
    expect(record.evidenceRef).toBeUndefined();
    expect(record.findingRef).toBeUndefined();
    expect(JSON.stringify(resolution)).not.toMatch(/evidenceRef|findingRef/);
  });

  test("implementation has no runtime identity, randomness, or unsafe type escape", () => {
    const files = [
      "src/types/crimeIncidenceGeographicResolution.ts",
      "src/utils/crimeIncidenceGeographicResolution.ts",
    ];
    const source = files.map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
    expect(source).not.toMatch(/Date\.now|new Date/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/\bany\b/);
  });
});
