import fs from "node:fs";
import path from "node:path";
import type { CrimeDatasetIdentity } from "../src/types/crimeDatasetIdentity";
import type { CrimeExpedientGeographyContext } from "../src/types/crimeIncidenceGeographicResolution";
import type { CrimeIncidenceQueryRequest } from "../src/types/crimeIncidenceQueryGovernance";
import type { CanonicalCrimeIncident, CrimeIncidenceQueryEnvelope } from "../src/types/crimeIncidenceWorkspace";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { projectCrimeIncidenceAnalytics } from "../src/utils/crimeIncidenceAnalyticalProjection";
import { createCrimeIncidenceExportContract } from "../src/utils/crimeIncidenceExportGovernance";
import { resolveCrimeIncidenceGeography } from "../src/utils/crimeIncidenceGeographicResolution";
import { resolveCrimeIncidenceQuery } from "../src/utils/crimeIncidenceQueryGovernance";
import { bindCrimeIncidenceWorkspace } from "../src/utils/crimeIncidenceWorkspaceBinding";

const expedienteId = "EXP-0228I";
const geometry = {
  mode: "POINT_RADIUS" as const,
  geometry: { type: "Point" as const, coordinates: [-102.29, 21.88] as [number, number] },
  radiusMeters: 1000,
};
const lineage = {
  dataset: "crime-dataset-operational",
  querySource: "POSTGIS" as const,
  filters: { purpose: "WORKSPACE" },
  timeRange: { start: "2026-01-01", end: "2026-08-31", status: "KNOWN" as const },
  geographicFilter: {
    center: { lat: 21.88, lng: -102.29 },
    radiusMeters: 1000,
    coverageStatus: "IN_COVERAGE" as const,
  },
  recordSubset: { totalScanned: 2, matched: 2, excluded: 0, duplicates: 0, returnedRecords: 2 },
};

function incident(id: string, lat: number, lng: number): CanonicalCrimeIncident {
  return {
    id,
    incidentType: "Robo",
    occurredDate: "2026-08-01",
    occurredTime: null,
    timeRange: null,
    coordinates: { lat, lng, originalLat: lat, originalLng: lng },
    location: { municipality: "Aguascalientes" },
    source: { querySource: "POSTGIS", sourceStatus: "POSTGIS_AVAILABLE", datasetId: lineage.dataset },
    coverage: { geographic: "IN_COVERAGE" },
    geoValidation: "VALID_GEOLOCATION",
    lineage,
  };
}

function operationalChain() {
  const records = [incident("incident-1", 21.881, -102.291), incident("incident-2", 21.882, -102.292)];
  const datasetIdentity: CrimeDatasetIdentity = {
    datasetId: lineage.dataset,
    datasetName: "Incidencia operativa",
    datasetVersion: "2026.1",
    sourceType: "POSTGIS",
    sourceName: "incidencia_estadistica",
    sourceOrganization: "SSPE Aguascalientes",
    temporalCoverage: { start: "2026-01-01", end: "2026-08-31", status: "KNOWN" },
    geographicCoverage: { status: "IN_COVERAGE", scopeCompatibility: "IN_SCOPE" },
    createdAt: "2026-08-31T12:00:00.000Z",
    validationSummary: { status: "SCHEMA_VALID", schemaValid: true, recordCount: records.length },
  };
  const envelope: CrimeIncidenceQueryEnvelope = {
    records,
    querySource: "POSTGIS",
    sourceStatus: "POSTGIS_AVAILABLE",
    coverageStatus: "IN_COVERAGE",
    lineage,
    bibliography: "SSPE Aguascalientes",
    queryGeometry: geometry,
    queryParameters: {},
    warnings: [],
    errors: [],
    dataset: { datasetId: lineage.dataset, datasetVersion: "2026.1", lineage },
  };
  const request: CrimeIncidenceQueryRequest = {
    datasetIdentity,
    queryGeometry: geometry,
    temporalFilters: { start: "2026-01-01", end: "2026-08-31" },
    crimeFilters: {},
    purpose: "WORKSPACE",
    analyticLevel: "DESCRIPTIVE",
    requestProvenance: { requestedBy: "analyst-1", requestReference: "workspace-0228i" },
    queryParameters: {},
    sourceEnvelope: envelope,
  };
  const expedientGeography: CrimeExpedientGeographyContext = {
    expedienteId,
    geographyType: "INDIVIDUAL",
    point: geometry,
    source: "PROJECT_CREATION",
    createdBy: "analyst-1",
  };
  const canonicalGeography: CanonicalProjectGeography = {
    geographyId: "geo-EXP-0228I",
    type: "INDIVIDUAL",
    geometry: geometry.geometry,
    source: "PROJECT_CREATION",
    validationStatus: "VALID",
    createdAt: 1,
    updatedAt: 1,
  };
  const queryResolution = resolveCrimeIncidenceQuery(request);
  const geographicResolution = resolveCrimeIncidenceGeography(expedientGeography, queryResolution);
  const analyticalProjection = projectCrimeIncidenceAnalytics(records, geographicResolution);
  const exportContract = createCrimeIncidenceExportContract(analyticalProjection, geographicResolution.institutionalMetadata);
  const binding = bindCrimeIncidenceWorkspace({
    expedienteId,
    canonicalGeography,
    geographicResolution,
    analyticalProjection,
    exportContract,
  });
  return { records, canonicalGeography, queryResolution, geographicResolution, analyticalProjection, exportContract, binding };
}

describe("ADR-022.8I operational end-to-end validation", () => {
  test("preserves expediente identity through geography, workspace, and export", () => {
    const chain = operationalChain();
    expect(chain.geographicResolution.expedientGeography.expedienteId).toBe(expedienteId);
    expect(chain.binding.viewModel?.expedienteId).toBe(expedienteId);
    expect(chain.exportContract.expedienteId).toBe(expedienteId);
  });

  test("preserves canonical geometry without recalculation", () => {
    const chain = operationalChain();
    expect(chain.geographicResolution.geometry.geometry).toBe(geometry.geometry);
    expect(chain.binding.viewModel?.geographyContext.canonicalGeography).toBe(chain.canonicalGeography);
    expect(chain.exportContract.geographicReference).toBe(chain.analyticalProjection.geographicReference);
  });

  test("preserves matched and excluded partition integrity", () => {
    const chain = operationalChain();
    expect(chain.geographicResolution.matchedRecords).toEqual(chain.records);
    expect(chain.geographicResolution.excludedRecords).toEqual([]);
    expect(chain.binding.viewModel?.incidents.matched).toBe(chain.geographicResolution.matchedRecords);
    expect(chain.binding.viewModel?.incidents.excluded).toBe(chain.geographicResolution.excludedRecords);
  });

  test("preserves metrics and lineage by governed reference", () => {
    const chain = operationalChain();
    expect(chain.analyticalProjection.metrics.aggregation).toEqual({ matchedRecords: 2, excludedRecords: 0, recordsWithCoordinates: 2 });
    expect(chain.binding.viewModel?.metrics).toBe(chain.analyticalProjection.metrics);
    expect(chain.binding.viewModel?.lineage).toBe(chain.analyticalProjection.lineage);
    expect(chain.exportContract.lineage).toBe(chain.analyticalProjection.lineage);
  });

  test("preserves institutional header, watermark, footer, and classification", () => {
    const chain = operationalChain();
    expect(chain.exportContract.institutionalMetadata).toEqual({
      header: "Centro de Estudios en Seguridad y Política Criminal",
      watermark: "CEIPOL",
      footer: "Secretaría de Seguridad Pública del Estado de Aguascalientes",
    });
    expect(chain.exportContract.productClassification).toBe("DESCRIPTIVE_ANALYTICAL_PRODUCT");
  });

  test("reaches a READY workspace with admitted data", () => {
    const chain = operationalChain();
    expect(chain.queryResolution.admission.accepted).toBe(true);
    expect(chain.queryResolution.status).toBe("EXECUTED");
    expect(chain.binding.state).toBe("READY");
  });

  test("retains loading, error, empty, and no-coverage presentation paths", () => {
    const workspace = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceWorkspace.tsx"), "utf8");
    for (const state of ["LOADING", "ERROR", "EMPTY", "NO_COVERAGE"]) expect(workspace).toContain(state);
    expect(workspace).toContain("h-[65vh]");
    expect(workspace).toContain("crime-incidence-map-container");
  });

  test("retains institutional visual and documentary markers", () => {
    const map = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceMap.tsx"), "utf8");
    const exportGovernance = fs.readFileSync(path.join(process.cwd(), "src/utils/crimeIncidenceExportGovernance.ts"), "utf8");
    expect(map).toContain("institutionalMetadata.watermark");
    expect(exportGovernance).toContain("institutionalMetadata: metadata");
  });

  test("detects the productive composition mounted by the project page", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/project/[id]/page.tsx"), "utf8");
    expect(page).toContain("<CrimeIncidenceProductionWorkspace");
    expect(page).toContain("project={project}");
    expect(page).toContain("requestedBy={user?.username}");
  });

  test("finds no prohibited data or analytical behavior in the Crime Incidence path", () => {
    const files = [
      "src/components/crime-incidence/CrimeIncidenceWorkspace.tsx",
      "src/components/crime-incidence/CrimeIncidenceMap.tsx",
      "src/components/crime-incidence/CrimeIncidenceAnalytics.tsx",
      "src/components/crime-incidence/CrimeIncidenceFilters.tsx",
      "src/components/maps/layers/CrimeIncidenceLayer.ts",
      "src/utils/crimeIncidenceWorkspaceAdapter.ts",
      "src/utils/crimeIncidenceWorkspaceBinding.ts",
      "src/utils/crimeIncidenceWorkspaceExport.ts",
      "src/utils/crimeIncidenceControlledFilters.ts",
    ];
    const source = files.map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
    expect(source).not.toMatch(/historicalCrimes|\bany\[\]|riskScore|scoring|prediction|causalAnalysis/);
    expect(source).not.toMatch(/evidenceRef|findingRef|calculateDistance|computeDistance|createBuffer/);
  });
});
