import fs from "node:fs";
import path from "node:path";
import type { CrimeIncidenceFilterState } from "../src/types/crimeIncidenceControlledFilters";
import type { CrimeIncidenceQueryRequest } from "../src/types/crimeIncidenceQueryGovernance";
import {
  createCrimeIncidenceFilterQueryIntent,
  createCrimeIncidenceFilterState,
} from "../src/utils/crimeIncidenceControlledFilters";

function request(): CrimeIncidenceQueryRequest {
  return {
    datasetIdentity: { datasetId: "crime-dataset-2026" },
    queryGeometry: {
      mode: "POINT_RADIUS",
      geometry: { type: "Point", coordinates: [-102.29, 21.88] },
      radiusMeters: 1000,
    },
    temporalFilters: { start: "2026-01-01", end: "2026-08-31" },
    crimeFilters: { incidentTypes: ["Robo"] },
    purpose: "WORKSPACE",
    analyticLevel: "DESCRIPTIVE",
    requestProvenance: { requestedBy: "analyst-1", requestReference: "filter-0228g" },
    queryParameters: { municipality: "Aguascalientes" },
    sourceEnvelope: {
      coverageStatus: "IN_COVERAGE",
      records: [{ id: "incident-raw-reference" }],
    },
  } as unknown as CrimeIncidenceQueryRequest;
}

function filters(): CrimeIncidenceFilterState {
  return {
    temporal: { start: "2026-02-01", end: "2026-02-28" },
    incidentTypes: ["Robo a comercio"],
    geographicCoverage: "IN_COVERAGE",
  };
}

describe("ADR-022.8G controlled analytical filters", () => {
  test("creates filter state from the governed query request", () => {
    expect(createCrimeIncidenceFilterState(request())).toEqual({
      temporal: { start: "2026-01-01", end: "2026-08-31" },
      incidentTypes: ["Robo"],
      geographicCoverage: "IN_COVERAGE",
    });
  });

  test("creates an acquisition intent with temporal, incident, and coverage filters", () => {
    const intent = createCrimeIncidenceFilterQueryIntent(request(), filters());
    expect(intent.filters).toEqual(filters());
    expect(intent.analyticLevel).toBe("DESCRIPTIVE");
  });

  test("preserves dataset, provenance, and query parameters", () => {
    const source = request();
    const intent = createCrimeIncidenceFilterQueryIntent(source, filters());
    expect(intent.datasetIdentity).toBe(source.datasetIdentity);
    expect(intent.requestProvenance).toBe(source.requestProvenance);
    expect(intent.queryParameters).toBe(source.queryParameters);
  });

  test("preserves governed geometry by reference without buffers or coordinates changes", () => {
    const source = request();
    const before = JSON.stringify(source.queryGeometry);
    const intent = createCrimeIncidenceFilterQueryIntent(source, filters());
    expect(intent.queryGeometry).toBe(source.queryGeometry);
    expect(JSON.stringify(source.queryGeometry)).toBe(before);
  });

  test("does not reuse an old query envelope as filtered output", () => {
    const intent = createCrimeIncidenceFilterQueryIntent(request(), filters()) as unknown as Record<string, unknown>;
    expect(intent.sourceEnvelope).toBeUndefined();
    expect(intent.records).toBeUndefined();
    expect(intent.resolvedIncidents).toBeUndefined();
  });

  test("rejects an inverted temporal range", () => {
    const invalid = filters();
    invalid.temporal = { start: "2026-03-01", end: "2026-02-01" };
    expect(() => createCrimeIncidenceFilterQueryIntent(request(), invalid))
      .toThrow("CRIME_INCIDENCE_FILTER_INVALID_TEMPORAL_RANGE");
  });

  test("does not mutate the request or filter state", () => {
    const source = request();
    const selected = filters();
    const before = JSON.stringify({ source, selected });
    createCrimeIncidenceFilterQueryIntent(source, selected);
    expect(JSON.stringify({ source, selected })).toBe(before);
  });

  test("renders a compact horizontal filter bar before the dominant map", () => {
    const workspace = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceWorkspace.tsx"), "utf8");
    const controls = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceFilters.tsx"), "utf8");
    expect(workspace.indexOf("<CrimeIncidenceFilters")).toBeLessThan(workspace.indexOf("crime-incidence-map-container"));
    expect(controls).toContain("flex flex-wrap items-end");
    expect(controls).toContain("Dataset:");
    expect(controls).toContain("Cobertura vigente:");
  });

  test("contains no raw-data filtering, spatial derivation, or prohibited analytics", () => {
    const files = [
      "src/types/crimeIncidenceControlledFilters.ts",
      "src/utils/crimeIncidenceControlledFilters.ts",
      "src/components/crime-incidence/CrimeIncidenceFilters.tsx",
      "src/components/crime-incidence/CrimeIncidenceWorkspace.tsx",
    ];
    const source = files.map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
    expect(source).not.toMatch(/historicalCrimes|\.filter\(|distanceMeters|radiusMeters\s*[+*/-]|buffer|centroid/);
    expect(source).not.toMatch(/evidenceRef|findingRef|riskScore|causalAnalysis|prediction/);
  });
});
