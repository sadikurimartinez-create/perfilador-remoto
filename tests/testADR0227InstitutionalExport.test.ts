import fs from "node:fs";
import path from "node:path";
import type { CrimeDatasetIdentity } from "../src/types/crimeDatasetIdentity";
import type {
  CrimeExpedientGeographyContext,
  CrimeIncidenceInstitutionalMetadata,
} from "../src/types/crimeIncidenceGeographicResolution";
import type { CrimeIncidenceQueryRequest } from "../src/types/crimeIncidenceQueryGovernance";
import type { CanonicalCrimeIncident, CrimeIncidenceQueryEnvelope } from "../src/types/crimeIncidenceWorkspace";
import { projectCrimeIncidenceAnalytics } from "../src/utils/crimeIncidenceAnalyticalProjection";
import { createCrimeIncidenceExportContract } from "../src/utils/crimeIncidenceExportGovernance";
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

const institutionalMetadata: CrimeIncidenceInstitutionalMetadata = {
  watermark: "CEIPOL",
  header: "Centro de Estudios en Seguridad y Política Criminal",
  footer: "Secretaría de Seguridad Pública del Estado de Aguascalientes",
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

function projection() {
  const sourceEnvelope: CrimeIncidenceQueryEnvelope = {
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
    dataset: {
      datasetId: "crime-dataset-2026",
      datasetVersion: "2026.1",
      sourceReference: "incidencia_estadistica",
      lineage,
    },
  };
  const request: CrimeIncidenceQueryRequest = {
    datasetIdentity: dataset(),
    queryGeometry: geometry,
    temporalFilters: { start: "2026-01-01", end: "2026-08-31" },
    crimeFilters: {},
    purpose: "REPORT",
    analyticLevel: "DESCRIPTIVE",
    requestProvenance: { requestedBy: "analyst-1", requestReference: "export-0227" },
    queryParameters: {},
    sourceEnvelope,
  };
  const geography: CrimeExpedientGeographyContext = {
    expedienteId: "EXP-0227",
    geographyType: "INDIVIDUAL",
    point: geometry,
    source: "PROJECT_CREATION",
    createdBy: "analyst-1",
  };
  const geographicResolution = resolveCrimeIncidenceGeography(
    geography,
    resolveCrimeIncidenceQuery(request)
  );
  return projectCrimeIncidenceAnalytics([incident], geographicResolution);
}

describe("ADR-022.7 institutional export contract", () => {
  test("creates a traceable descriptive export contract", () => {
    const sourceProjection = projection();
    const contract = createCrimeIncidenceExportContract(sourceProjection, institutionalMetadata);
    expect(contract.exportId).toBe("export-0227");
    expect(contract.expedienteId).toBe("EXP-0227");
    expect(contract.projectionReference).toEqual(sourceProjection);
    expect(contract.queryReference).toEqual(sourceProjection.sourceQuery);
    expect(contract.createdAtReference).toBe("2026-08-31T12:00:00.000Z");
    expect(contract.productClassification).toBe("DESCRIPTIVE_ANALYTICAL_PRODUCT");
  });

  test("preserves lineage, dataset reference, and authoritative geography", () => {
    const sourceProjection = projection();
    const contract = createCrimeIncidenceExportContract(sourceProjection, institutionalMetadata);
    expect(contract.lineage).toEqual(sourceProjection.lineage);
    expect(contract.datasetReference).toEqual(sourceProjection.datasetReference);
    expect(contract.geographicReference).toEqual(sourceProjection.geographicReference);
  });

  test("includes governed CEIPOL metadata and descriptive level", () => {
    const contract = createCrimeIncidenceExportContract(projection(), institutionalMetadata);
    expect(contract.institutionalMetadata).toEqual(institutionalMetadata);
    expect(contract.analyticalLevel).toBe("DESCRIPTIVE");
  });

  test("does not create evidentiary or institutional overclaim fields", () => {
    const contract = createCrimeIncidenceExportContract(projection(), institutionalMetadata) as unknown as Record<string, unknown>;
    expect(contract.evidenceRef).toBeUndefined();
    expect(contract.findingRef).toBeUndefined();
    expect(contract.attribution).toBeUndefined();
    expect(contract.criminologicalProfile).toBeUndefined();
    expect(JSON.stringify(contract)).toContain("IS_NOT_EVIDENCE_PROOF_FINDING_ATTRIBUTION_OR_CRIMINOLOGICAL_PROFILE");
  });

  test("implementation has no runtime identity, randomness, or unsafe type escape", () => {
    const files = [
      "src/types/crimeIncidenceExportContract.ts",
      "src/utils/crimeIncidenceExportGovernance.ts",
    ];
    const source = files.map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
    expect(source).not.toMatch(/Date\.now|new Date/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/\bany\b/);
  });
});
