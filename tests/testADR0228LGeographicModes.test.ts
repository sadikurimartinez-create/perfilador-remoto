import fs from "node:fs";
import path from "node:path";
import type { CrimeDatasetIdentity } from "../src/types/crimeDatasetIdentity";
import type { CrimeExpedientGeographyContext } from "../src/types/crimeIncidenceGeographicResolution";
import type { CrimeIncidenceQueryRequest } from "../src/types/crimeIncidenceQueryGovernance";
import type { CanonicalCrimeIncident, CrimeIncidenceQueryEnvelope, CrimeIncidenceQueryGeometry } from "../src/types/crimeIncidenceWorkspace";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { projectCrimeIncidenceAnalytics } from "../src/utils/crimeIncidenceAnalyticalProjection";
import { createCrimeIncidenceExportContract } from "../src/utils/crimeIncidenceExportGovernance";
import { resolveCrimeIncidenceGeography } from "../src/utils/crimeIncidenceGeographicResolution";
import { resolveCrimeIncidenceQuery } from "../src/utils/crimeIncidenceQueryGovernance";
import { createCrimeIncidenceCanonicalQueryGeometry } from "../src/utils/crimeIncidenceProductionComposition";
import { bindCrimeIncidenceWorkspace } from "../src/utils/crimeIncidenceWorkspaceBinding";

const lineage = {
  dataset: "crime-dataset-geographic-modes",
  querySource: "POSTGIS" as const,
  filters: {},
  timeRange: { start: "2025-01-01", end: "2025-12-31", status: "KNOWN" as const },
  geographicFilter: {
    center: { lat: 21.88, lng: -102.29 },
    radiusMeters: 1000,
    coverageStatus: "IN_COVERAGE" as const,
  },
  recordSubset: { totalScanned: 2, matched: 1, excluded: 1, duplicates: 0, returnedRecords: 2 },
};

function incident(id: string, lat: number, lng: number): CanonicalCrimeIncident {
  return {
    id,
    incidentType: "Robo",
    occurredDate: "2025-08-01",
    occurredTime: null,
    timeRange: null,
    coordinates: { lat, lng, originalLat: lat, originalLng: lng },
    location: {},
    source: { querySource: "POSTGIS", sourceStatus: "POSTGIS_AVAILABLE", datasetId: lineage.dataset },
    coverage: { geographic: "IN_COVERAGE" },
    geoValidation: "VALID_GEOLOCATION",
    lineage,
  };
}

function dataset(): CrimeDatasetIdentity {
  return {
    datasetId: lineage.dataset,
    datasetName: "Dataset geográfico autorizado",
    datasetVersion: "VERSION-AUTORIZADA",
    sourceType: "POSTGIS",
    sourceName: lineage.dataset,
    sourceOrganization: "Organización autorizada",
    temporalCoverage: { start: "2025-01-01", end: "2025-12-31", status: "KNOWN" },
    geographicCoverage: { status: "IN_COVERAGE", scopeCompatibility: "IN_SCOPE" },
    validationSummary: { status: "SCHEMA_VALID", schemaValid: true, recordCount: 2 },
  };
}

function context(expedienteId: string, geometry: CrimeIncidenceQueryGeometry): CrimeExpedientGeographyContext {
  const base = { expedienteId, source: "PROJECT_CREATION" as const, createdBy: "analyst-l" };
  if (geometry.mode === "POINT_RADIUS") return { ...base, geographyType: "INDIVIDUAL", point: geometry };
  if (geometry.mode === "CORRIDOR_COVERAGE") return { ...base, geographyType: "CORRIDOR", corridor: geometry };
  return { ...base, geographyType: "POLYGON", polygon: geometry };
}

function resolve(geometry: CrimeIncidenceQueryGeometry, records: CanonicalCrimeIncident[]) {
  const sourceEnvelope: CrimeIncidenceQueryEnvelope = {
    records,
    querySource: "POSTGIS",
    sourceStatus: "POSTGIS_AVAILABLE",
    coverageStatus: "IN_COVERAGE",
    lineage,
    bibliography: "Referencia institucional",
    queryGeometry: geometry,
    queryParameters: {},
    warnings: [],
    errors: [],
    dataset: { datasetId: lineage.dataset, lineage },
  };
  const request: CrimeIncidenceQueryRequest = {
    datasetIdentity: dataset(),
    queryGeometry: geometry,
    temporalFilters: {},
    crimeFilters: {},
    purpose: "WORKSPACE",
    analyticLevel: "DESCRIPTIVE",
    requestProvenance: { requestedBy: "analyst-l", requestReference: "geographic-mode-l" },
    queryParameters: {},
    sourceEnvelope,
  };
  return resolveCrimeIncidenceGeography(context("EXP-0228L", geometry), resolveCrimeIncidenceQuery(request));
}

function canonical(type: "INDIVIDUAL" | "CORRIDOR" | "POLYGON", geometry: CanonicalProjectGeography["geometry"]): CanonicalProjectGeography {
  return {
    geographyId: `geo-${type}`,
    type,
    geometry,
    source: "PROJECT_CREATION",
    validationStatus: "VALID",
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("ADR-022.8L corridor and polygon geographic resolution", () => {
  test("keeps an individual envelope record matched", () => {
    const geometry: CrimeIncidenceQueryGeometry = {
      mode: "POINT_RADIUS", geometry: { type: "Point", coordinates: [-102.29, 21.88] }, radiusMeters: 1000,
    };
    const record = incident("individual-match", 21.881, -102.291);
    const resolution = resolve(geometry, [record]);
    expect(resolution.matchedRecords).toEqual([record]);
    expect(resolution.excludedRecords).toEqual([]);
  });

  test("classifies corridor records using only the authorized LineString width", () => {
    const geometry: CrimeIncidenceQueryGeometry = {
      mode: "CORRIDOR_COVERAGE",
      geometry: { type: "LineString", coordinates: [[-102.30, 21.88], [-102.28, 21.88]] },
      corridorWidthMeters: 100,
    };
    const matched = incident("corridor-match", 21.8805, -102.29);
    const excluded = incident("corridor-excluded", 21.885, -102.29);
    const before = JSON.stringify([matched, excluded]);
    const resolution = resolve(geometry, [matched, excluded]);
    expect(resolution.matchedRecords).toEqual([matched]);
    expect(resolution.excludedRecords).toEqual([excluded]);
    expect(resolution.geometry).toBe(geometry);
    expect(matched.coordinates).toEqual({ lat: 21.8805, lng: -102.29, originalLat: 21.8805, originalLng: -102.29 });
    expect(JSON.stringify([matched, excluded])).toBe(before);
  });

  test("classifies points inside and outside the authoritative polygon", () => {
    const geometry: CrimeIncidenceQueryGeometry = {
      mode: "POLYGON_BOUNDARY",
      geometry: { type: "Polygon", coordinates: [[[-102.30, 21.87], [-102.28, 21.87], [-102.28, 21.89], [-102.30, 21.89], [-102.30, 21.87]]] },
    };
    const matched = incident("polygon-match", 21.88, -102.29);
    const excluded = incident("polygon-excluded", 21.90, -102.29);
    const resolution = resolve(geometry, [matched, excluded]);
    expect(resolution.matchedRecords).toEqual([matched]);
    expect(resolution.excludedRecords).toEqual([excluded]);
    expect(resolution.geometry).toBe(geometry);
  });

  test("builds and binds all canonical modes without ViewModel branching", () => {
    const geographies = [
      canonical("INDIVIDUAL", { type: "Point", coordinates: [-102.29, 21.88] }),
      canonical("CORRIDOR", { type: "LineString", coordinates: [[-102.30, 21.88], [-102.28, 21.88]] }),
      canonical("POLYGON", { type: "Polygon", coordinates: [[[-102.30, 21.87], [-102.28, 21.87], [-102.28, 21.89], [-102.30, 21.89], [-102.30, 21.87]]] }),
    ];
    for (const geography of geographies) {
      const queryGeometry = createCrimeIncidenceCanonicalQueryGeometry(geography, 100);
      expect(queryGeometry).not.toBeNull();
      const record = incident(`${geography.type}-match`, 21.88, -102.29);
      const geographicResolution = resolve(queryGeometry!, [record]);
      const projection = projectCrimeIncidenceAnalytics([record], geographicResolution);
      const exportContract = createCrimeIncidenceExportContract(projection, geographicResolution.institutionalMetadata);
      const binding = bindCrimeIncidenceWorkspace({
        expedienteId: "EXP-0228L",
        canonicalGeography: geography,
        geographicResolution,
        analyticalProjection: projection,
        exportContract,
      });
      expect(binding.state).toBe("READY");
      expect(binding.viewModel?.metrics).toBe(projection.metrics);
      expect(binding.viewModel?.lineage).toBe(projection.lineage);
      expect(binding.viewModel?.exportReference).toBe(exportContract);
    }
  });

  test("requires explicit corridor width instead of hidden buffers", () => {
    const geometry: CrimeIncidenceQueryGeometry = {
      mode: "CORRIDOR_COVERAGE",
      geometry: { type: "LineString", coordinates: [[-102.30, 21.88], [-102.28, 21.88]] },
    };
    const resolution = resolve(geometry, [incident("corridor-without-width", 21.88, -102.29)]);
    expect(resolution.matchedRecords).toEqual([]);
    expect(resolution.excludedRecords).toHaveLength(1);
    expect(resolution.coverageStatus).toBe("UNKNOWN_COVERAGE");
    expect(resolution.coverageExplanation).toBe("CORRIDOR_WIDTH_REQUIRED_FOR_SPATIAL_MEMBERSHIP");
  });

  test("contains no centroid generation or prohibited analytical artifacts", () => {
    const resolutionSource = fs.readFileSync(path.join(process.cwd(), "src/utils/crimeIncidenceGeographicResolution.ts"), "utf8");
    const mapSource = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceMap.tsx"), "utf8");
    expect(resolutionSource).not.toMatch(/centroid|midpoint/);
    expect(mapSource).not.toMatch(/derived\?\.centroid|calculateCentroid|computeCentroid/);
    const result = resolve({ mode: "POLYGON_BOUNDARY", geometry: { type: "Polygon", coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]] } }, [incident("firewall", 0, 0)]) as unknown as Record<string, unknown>;
    expect(result.evidenceRef).toBeUndefined();
    expect(result.findingRef).toBeUndefined();
    expect(result.riskScore).toBeUndefined();
    expect(result.prediction).toBeUndefined();
    expect(result.causalAnalysis).toBeUndefined();
  });
});
