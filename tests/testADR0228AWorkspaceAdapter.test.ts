import fs from "node:fs";
import path from "node:path";
import type { CrimeDatasetIdentity } from "../src/types/crimeDatasetIdentity";
import type { CrimeExpedientGeographyContext, CrimeIncidenceInstitutionalMetadata } from "../src/types/crimeIncidenceGeographicResolution";
import type { CrimeIncidenceQueryRequest } from "../src/types/crimeIncidenceQueryGovernance";
import type { CanonicalCrimeIncident, CrimeIncidenceQueryEnvelope } from "../src/types/crimeIncidenceWorkspace";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { projectCrimeIncidenceAnalytics } from "../src/utils/crimeIncidenceAnalyticalProjection";
import { createCrimeIncidenceExportContract } from "../src/utils/crimeIncidenceExportGovernance";
import { resolveCrimeIncidenceGeography } from "../src/utils/crimeIncidenceGeographicResolution";
import { resolveCrimeIncidenceQuery } from "../src/utils/crimeIncidenceQueryGovernance";
import { buildCrimeIncidenceWorkspace } from "../src/utils/crimeIncidenceWorkspaceAdapter";

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
  recordSubset: { totalScanned: 1, matched: 1, excluded: 0, duplicates: 0, returnedRecords: 1 },
};

const incident: CanonicalCrimeIncident = {
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
    createdAt: "2026-08-31T12:00:00.000Z",
    validationSummary: { status: "SCHEMA_VALID", schemaValid: true, recordCount: 1 },
  };
}

function chain() {
  const envelope: CrimeIncidenceQueryEnvelope = {
    records: [incident],
    querySource: "POSTGIS",
    sourceStatus: "POSTGIS_AVAILABLE",
    coverageStatus: "IN_COVERAGE",
    lineage,
    bibliography: "SSPE Aguascalientes",
    queryGeometry: geometry,
    queryParameters: {},
    warnings: [],
    errors: [],
    dataset: { datasetId: "crime-dataset-2026", datasetVersion: "2026.1", sourceReference: "incidencia_estadistica", lineage },
  };
  const request: CrimeIncidenceQueryRequest = {
    datasetIdentity: dataset(),
    queryGeometry: geometry,
    temporalFilters: { start: "2026-01-01", end: "2026-08-31" },
    crimeFilters: {},
    purpose: "WORKSPACE",
    analyticLevel: "DESCRIPTIVE",
    requestProvenance: { requestedBy: "analyst-1", requestReference: "workspace-0228a" },
    queryParameters: {},
    sourceEnvelope: envelope,
  };
  const geographyContext: CrimeExpedientGeographyContext = {
    expedienteId: "EXP-0228A",
    geographyType: "INDIVIDUAL",
    point: geometry,
    source: "PROJECT_CREATION",
    createdBy: "analyst-1",
  };
  const canonicalGeography: CanonicalProjectGeography = {
    geographyId: "geo-EXP-0228A-individual",
    type: "INDIVIDUAL",
    geometry: geometry.geometry,
    source: "PROJECT_CREATION",
    validationStatus: "VALID",
    createdAt: 1,
    updatedAt: 1,
  };
  const geographicResolution = resolveCrimeIncidenceGeography(geographyContext, resolveCrimeIncidenceQuery(request));
  const analyticalProjection = projectCrimeIncidenceAnalytics([incident], geographicResolution);
  const metadata: CrimeIncidenceInstitutionalMetadata = {
    watermark: "CEIPOL",
    header: "Centro de Estudios en Seguridad y Política Criminal",
    footer: "Secretaría de Seguridad Pública del Estado de Aguascalientes",
  };
  const exportContract = createCrimeIncidenceExportContract(analyticalProjection, metadata);
  return { canonicalGeography, geographicResolution, analyticalProjection, exportContract };
}

describe("ADR-022.8A crime incidence workspace adapter", () => {
  test("builds a valid workspace and preserves the expediente", () => {
    const input = chain();
    const workspace = buildCrimeIncidenceWorkspace({ expedienteId: "EXP-0228A", ...input });
    expect(workspace.workspaceId).toBe("workspace-0228a");
    expect(workspace.expedienteId).toBe("EXP-0228A");
    expect(workspace.incidents.matched).toEqual([incident]);
    expect(workspace.incidents.table).toEqual([{ classification: "MATCHED", incident }]);
  });

  test("preserves geography, metrics, provenance, and lineage", () => {
    const input = chain();
    const workspace = buildCrimeIncidenceWorkspace({ expedienteId: "EXP-0228A", ...input });
    expect(workspace.geographyContext.canonicalGeography).toBe(input.canonicalGeography);
    expect(workspace.geographyContext.geographicResolution).toBe(input.geographicResolution);
    expect(workspace.metrics).toBe(input.analyticalProjection.metrics);
    expect(workspace.datasetReference).toBe(input.analyticalProjection.datasetReference);
    expect(workspace.queryReference).toBe(input.analyticalProjection.sourceQuery);
    expect(workspace.exportReference).toBe(input.exportContract);
    expect(workspace.lineage).toBe(input.analyticalProjection.lineage);
  });

  test("rejects a geographically unresolved chain", () => {
    const input = chain();
    const mismatchedGeography: CanonicalProjectGeography = {
      ...input.canonicalGeography,
      geometry: { type: "Point", coordinates: [-102.3, 21.9] },
    };
    expect(() => buildCrimeIncidenceWorkspace({
      expedienteId: "EXP-0228A",
      ...input,
      canonicalGeography: mismatchedGeography,
    })).toThrow("CRIME_INCIDENCE_WORKSPACE_GEOGRAPHY_MISMATCH");
  });

  test("does not mutate or recalculate incident coordinates", () => {
    const input = chain();
    const before = JSON.stringify(incident);
    const workspace = buildCrimeIncidenceWorkspace({ expedienteId: "EXP-0228A", ...input });
    expect(workspace.incidents.matched[0]).toBe(incident);
    expect(workspace.incidents.matched[0].coordinates).toBe(incident.coordinates);
    expect(JSON.stringify(incident)).toBe(before);
  });

  test("does not create evidentiary or inferential fields", () => {
    const workspace = buildCrimeIncidenceWorkspace({ expedienteId: "EXP-0228A", ...chain() }) as unknown as Record<string, unknown>;
    expect(workspace.evidenceRef).toBeUndefined();
    expect(workspace.findingRef).toBeUndefined();
    expect(workspace.causality).toBeUndefined();
    expect(workspace.criminologicalProfile).toBeUndefined();
  });

  test("adapter has no runtime identity, randomness, or unsafe type escape", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/utils/crimeIncidenceWorkspaceAdapter.ts"), "utf8");
    expect(source).not.toMatch(/Date\.now|new Date/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/\bany\b/);
  });
});
