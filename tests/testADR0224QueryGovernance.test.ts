import fs from "node:fs";
import path from "node:path";
import type { CrimeDatasetIdentity } from "../src/types/crimeDatasetIdentity";
import type { CrimeIncidenceQueryRequest } from "../src/types/crimeIncidenceQueryGovernance";
import type { CrimeIncidenceQueryEnvelope } from "../src/types/crimeIncidenceWorkspace";
import { resolveCrimeIncidenceQuery } from "../src/utils/crimeIncidenceQueryGovernance";

const lineage = {
  dataset: "crime-dataset-2026",
  querySource: "POSTGIS" as const,
  filters: { incidentTypes: ["Robo"] },
  timeRange: { start: "2026-01-01", end: "2026-08-31", status: "KNOWN" as const },
  geographicFilter: {
    center: { lat: 21.88, lng: -102.29 },
    radiusMeters: 1000,
    coverageStatus: "IN_COVERAGE" as const,
  },
  recordSubset: { totalScanned: 1, matched: 1, excluded: 0, duplicates: 0, returnedRecords: 1 },
};

function dataset(overrides: Partial<CrimeDatasetIdentity> = {}): CrimeDatasetIdentity {
  return {
    datasetId: "crime-dataset-2026",
    datasetName: "Incidencia observada 2026",
    datasetVersion: "2026.1",
    sourceType: "POSTGIS",
    sourceName: "incidencia_estadistica",
    sourceOrganization: "SSPE Aguascalientes",
    temporalCoverage: { start: "2026-01-01", end: "2026-08-31", status: "KNOWN" },
    geographicCoverage: { status: "IN_COVERAGE", scopeCompatibility: "IN_SCOPE" },
    reference: "incidencia_estadistica",
    validationSummary: { status: "SCHEMA_VALID", schemaValid: true, recordCount: 1 },
    ...overrides,
  };
}

function envelope(overrides: Partial<CrimeIncidenceQueryEnvelope> = {}): CrimeIncidenceQueryEnvelope {
  return {
    records: [{
      id: "incident-1",
      incidentType: "Robo",
      occurredDate: "2026-08-01",
      occurredTime: null,
      timeRange: null,
      coordinates: { lat: 21.881, lng: -102.291, originalLat: 21.881, originalLng: -102.291 },
      location: { municipality: "Aguascalientes" },
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
    queryGeometry: { mode: "POINT_RADIUS", geometry: { type: "Point", coordinates: [-102.29, 21.88] }, radiusMeters: 1000 },
    queryParameters: { radiusMeters: 1000 },
    warnings: [],
    errors: [],
    dataset: {
      datasetId: "crime-dataset-2026",
      datasetVersion: "2026.1",
      sourceReference: "incidencia_estadistica",
      lineage,
      coverage: { geographic: "IN_COVERAGE" },
    },
    ...overrides,
  };
}

function request(overrides: Partial<CrimeIncidenceQueryRequest> = {}): CrimeIncidenceQueryRequest {
  const sourceEnvelope = envelope();
  return {
    datasetIdentity: dataset(),
    queryGeometry: sourceEnvelope.queryGeometry,
    temporalFilters: { start: "2026-01-01", end: "2026-08-31" },
    crimeFilters: { incidentTypes: ["Robo"] },
    purpose: "ANALYSIS",
    analyticLevel: "DESCRIPTIVE",
    requestProvenance: { requestedBy: "analyst-1", requestReference: "query-1" },
    queryParameters: { radiusMeters: 1000 },
    sourceEnvelope,
    ...overrides,
  };
}

describe("ADR-022.4 query governance", () => {
  test("executes a query backed by an admitted dataset", () => {
    const resolution = resolveCrimeIncidenceQuery(request());
    expect(resolution.status).toBe("EXECUTED");
    expect(resolution.admission.status).toBe("ADMITTED");
    expect(resolution.resolvedIncidents).toHaveLength(1);
  });

  test("rejects a query backed by a non-admitted dataset", () => {
    const resolution = resolveCrimeIncidenceQuery(request({ datasetIdentity: dataset({ sourceName: null }) }));
    expect(resolution.status).toBe("REJECTED");
    expect(resolution.executed).toBe(false);
    expect(resolution.resolvedIncidents).toEqual([]);
  });

  test("preserves request and dataset provenance", () => {
    const input = request();
    const resolution = resolveCrimeIncidenceQuery(input);
    expect(resolution.request.temporalFilters).toEqual(input.temporalFilters);
    expect(resolution.request.crimeFilters).toEqual(input.crimeFilters);
    expect(resolution.request.requestProvenance).toEqual(input.requestProvenance);
    expect(resolution.datasetProvenance).toEqual(input.sourceEnvelope.dataset);
    expect(resolution.lineage).toEqual(input.sourceEnvelope.lineage);
  });

  test("preserves query geometry and incident coordinates", () => {
    const input = request();
    const resolution = resolveCrimeIncidenceQuery(input);
    expect(resolution.request.queryGeometry).toEqual(input.queryGeometry);
    expect(resolution.resolvedIncidents[0].coordinates).toEqual(input.sourceEnvelope.records[0].coordinates);
  });

  test("represents no coverage without claiming confirmed absence", () => {
    const sourceEnvelope = envelope({
      records: [],
      querySource: "NONE",
      sourceStatus: "OUT_OF_COVERAGE",
      coverageStatus: "OUT_OF_COVERAGE",
    });
    const resolution = resolveCrimeIncidenceQuery(request({ sourceEnvelope }));
    expect(resolution.status).toBe("NO_COVERAGE");
    expect(resolution.executed).toBe(false);
    expect(resolution.warnings).toContain("OUT_OF_COVERAGE_IS_NOT_CONFIRMED_ABSENCE");
  });

  test("does not create evidence or finding references", () => {
    const resolution = resolveCrimeIncidenceQuery(request()) as unknown as Record<string, unknown>;
    expect(resolution.evidenceRef).toBeUndefined();
    expect(resolution.findingRef).toBeUndefined();
    expect(JSON.stringify(resolution)).not.toMatch(/evidenceRef|findingRef/);
  });

  test("implementation has no runtime identity, randomness, or unsafe type escape", () => {
    const files = [
      "src/types/crimeIncidenceQueryGovernance.ts",
      "src/utils/crimeIncidenceQueryGovernance.ts",
    ];
    const source = files.map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
    expect(source).not.toMatch(/Date\.now|new Date/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/\bany\b/);
  });
});
