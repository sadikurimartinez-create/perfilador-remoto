import fs from "node:fs";
import path from "node:path";
import type { CrimeDatasetIdentity } from "../src/types/crimeDatasetIdentity";
import type { CrimeExpedientGeographyContext } from "../src/types/crimeIncidenceGeographicResolution";
import type { CrimeIncidenceQueryRequest } from "../src/types/crimeIncidenceQueryGovernance";
import type { CanonicalCrimeIncident, CrimeIncidenceQueryEnvelope } from "../src/types/crimeIncidenceWorkspace";
import { projectCrimeIncidenceAnalytics } from "../src/utils/crimeIncidenceAnalyticalProjection";
import { resolveCrimeIncidenceGeography } from "../src/utils/crimeIncidenceGeographicResolution";
import { resolveCrimeIncidenceQuery } from "../src/utils/crimeIncidenceQueryGovernance";

const geometry = {
  mode: "POINT_RADIUS" as const,
  geometry: { type: "Point" as const, coordinates: [-102.29, 21.88] as [number, number] },
  radiusMeters: 1000,
};

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
  recordSubset: { totalScanned: 3, matched: 3, excluded: 0, duplicates: 0, returnedRecords: 3 },
};

function incident(id: string, incidentType: string, municipality: string, occurredDate: string): CanonicalCrimeIncident {
  return {
    id,
    incidentType,
    occurredDate,
    occurredTime: null,
    timeRange: null,
    coordinates: { lat: 21.881, lng: -102.291, originalLat: 21.881, originalLng: -102.291 },
    location: { municipality },
    source: { querySource: "POSTGIS", sourceStatus: "POSTGIS_AVAILABLE", datasetId: "crime-dataset-2026" },
    coverage: { geographic: "IN_COVERAGE" },
    geoValidation: "VALID_GEOLOCATION",
    lineage,
  };
}

const incidents = [
  incident("incident-1", "Robo", "Aguascalientes", "2026-08-01"),
  incident("incident-2", "Robo", "Aguascalientes", "2026-08-02"),
  incident("incident-3", "Fraude", "Jesús María", "2026-08-02"),
];

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
    validationSummary: { status: "SCHEMA_VALID", schemaValid: true, recordCount: 3 },
  };
}

function geographicResolution() {
  const sourceEnvelope: CrimeIncidenceQueryEnvelope = {
    records: incidents,
    querySource: "POSTGIS",
    sourceStatus: "POSTGIS_AVAILABLE",
    coverageStatus: "IN_COVERAGE",
    lineage,
    bibliography: "SSPE Aguascalientes",
    queryGeometry: geometry,
    queryParameters: {},
    warnings: [],
    errors: [],
    dataset: {
      datasetId: "crime-dataset-2026",
      datasetVersion: "2026.1",
      sourceReference: "incidencia_estadistica",
      lineage,
      coverage: { temporal: { start: "2026-01-01", end: "2026-08-31", status: "KNOWN" } },
    },
  };
  const request: CrimeIncidenceQueryRequest = {
    datasetIdentity: dataset(),
    queryGeometry: geometry,
    temporalFilters: { start: "2026-01-01", end: "2026-08-31" },
    crimeFilters: {},
    purpose: "ANALYSIS",
    analyticLevel: "DESCRIPTIVE",
    requestProvenance: { requestedBy: "analyst-1", requestReference: "query-1" },
    queryParameters: {},
    sourceEnvelope,
  };
  const context: CrimeExpedientGeographyContext = {
    expedienteId: "EXP-0226",
    geographyType: "INDIVIDUAL",
    point: geometry,
    source: "PROJECT_CREATION",
    createdBy: "analyst-1",
  };
  return resolveCrimeIncidenceGeography(context, resolveCrimeIncidenceQuery(request));
}

describe("ADR-022.6 analytical projection", () => {
  test("generates frequency, percentage, distribution, and aggregation metrics", () => {
    const projection = projectCrimeIncidenceAnalytics(incidents, geographicResolution());
    expect(projection.metrics.frequency).toEqual({
      totalRecords: 3,
      byIncidentType: [{ value: "Fraude", count: 1 }, { value: "Robo", count: 2 }],
    });
    expect(projection.metrics.percentage.byIncidentType.map(({ value, count }) => ({ value, count }))).toEqual([
      { value: "Fraude", count: 1 },
      { value: "Robo", count: 2 },
    ]);
    expect(projection.metrics.percentage.byIncidentType[0].percentage).toBeCloseTo(100 / 3);
    expect(projection.metrics.percentage.byIncidentType[1].percentage).toBeCloseTo(200 / 3);
    expect(projection.metrics.distribution.byMunicipality).toEqual([
      { value: "Aguascalientes", count: 2 },
      { value: "Jesús María", count: 1 },
    ]);
    expect(projection.metrics.aggregation).toEqual({ matchedRecords: 3, excludedRecords: 0, recordsWithCoordinates: 3 });
  });

  test("preserves provenance, lineage, temporal reference, and geography", () => {
    const geography = geographicResolution();
    const projection = projectCrimeIncidenceAnalytics(incidents, geography);
    expect(projection.sourceQuery).toEqual(geography.queryResolution);
    expect(projection.datasetReference).toEqual(geography.datasetProvenance);
    expect(projection.geographicReference.geometry).toEqual(geometry);
    expect(projection.geographicReference.expediente).toEqual(geography.expedientGeography);
    expect(projection.temporalReference.query).toEqual({ start: "2026-01-01", end: "2026-08-31" });
    expect(projection.lineage).toEqual(lineage);
  });

  test("is strictly descriptive and leaves source records unchanged", () => {
    const before = JSON.stringify(incidents);
    const projection = projectCrimeIncidenceAnalytics(incidents, geographicResolution());
    expect(projection.projectionType).toBe("DESCRIPTIVE_SUMMARY");
    expect(projection.analyticalLevel).toBe("DESCRIPTIVE");
    expect(JSON.stringify(incidents)).toBe(before);
    expect(projection.limitations[0]).toContain("NOT_EVIDENCE_FINDING_PROOF_CAUSALITY_OR_PREDICTION");
  });

  test("does not create prohibited analytical or evidentiary fields", () => {
    const projection = projectCrimeIncidenceAnalytics(incidents, geographicResolution()) as unknown as Record<string, unknown>;
    expect(projection.evidenceRef).toBeUndefined();
    expect(projection.findingRef).toBeUndefined();
    expect(projection.causalAnalysis).toBeUndefined();
    expect(projection.prediction).toBeUndefined();
    expect(projection.riskScore).toBeUndefined();
  });

  test("implementation has no runtime identity, randomness, or unsafe type escape", () => {
    const files = [
      "src/types/crimeIncidenceAnalyticalProjection.ts",
      "src/utils/crimeIncidenceAnalyticalProjection.ts",
    ];
    const source = files.map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
    expect(source).not.toMatch(/Date\.now|new Date/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toMatch(/causalAnalysis|prediction:|riskScore/);
  });
});
