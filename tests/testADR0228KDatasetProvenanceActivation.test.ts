import fs from "node:fs";
import path from "node:path";
import { evaluateCrimeDatasetAdmission } from "../src/utils/crimeDatasetAdmissionGate";
import {
  buildCrimeIncidenceDatasetIdentity,
  missingCrimeIncidenceProvenanceConfiguration,
  readCrimeIncidenceDatasetProvenanceConfig,
} from "../src/utils/crimeIncidenceDatasetProvenance";
import { composeCrimeIncidenceProductionWorkspace } from "../src/utils/crimeIncidenceProductionComposition";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";

const lineage = {
  dataset: "incidencia_estadistica",
  querySource: "POSTGIS" as const,
  filters: { radiusMeters: 1000 },
  timeRange: { start: "2025-01-01", end: "2025-12-31", status: "KNOWN" as const },
  geographicFilter: {
    center: { lat: 21.88, lng: -102.29 },
    radiusMeters: 1000,
    coverageStatus: "IN_COVERAGE" as const,
  },
  recordSubset: { totalScanned: 1, matched: 1, excluded: 0, duplicates: 0, returnedRecords: 1 },
};

const completeEnvironment = {
  CRIME_INCIDENCE_DATASET_NAME: "Registro institucional de incidencia delictiva",
  CRIME_INCIDENCE_DATASET_VERSION: "INSTITUTIONAL-VERSION",
  CRIME_INCIDENCE_SOURCE_ORGANIZATION: "Organización institucional autorizada",
  CRIME_INCIDENCE_DATASET_TEMPORAL_START: "2025-01-01",
  CRIME_INCIDENCE_DATASET_TEMPORAL_END: "2025-12-31",
};

function identity(environment: Record<string, string | undefined>) {
  return buildCrimeIncidenceDatasetIdentity({
    config: readCrimeIncidenceDatasetProvenanceConfig(environment),
    datasetReference: "incidencia_estadistica",
    querySource: "POSTGIS",
    sourceStatus: "POSTGIS_AVAILABLE",
    coverageStatus: "IN_COVERAGE",
    recordCount: 1,
    lineage,
  });
}

describe("ADR-022.8K productive dataset provenance activation", () => {
  test("keeps a dataset without institutional metadata in INCOMPLETE_PROVENANCE", () => {
    const config = readCrimeIncidenceDatasetProvenanceConfig({});
    expect(missingCrimeIncidenceProvenanceConfiguration(config)).toHaveLength(5);
    expect(evaluateCrimeDatasetAdmission(identity({})).status).toBe("INCOMPLETE_PROVENANCE");
  });

  test("admits a complete institutionally configured dataset", () => {
    const dataset = identity(completeEnvironment);
    const admission = evaluateCrimeDatasetAdmission(dataset);
    expect(admission.status).toBe("ADMITTED");
    expect(admission.accepted).toBe(true);
    expect(dataset).toMatchObject({
      datasetName: completeEnvironment.CRIME_INCIDENCE_DATASET_NAME,
      datasetVersion: completeEnvironment.CRIME_INCIDENCE_DATASET_VERSION,
      sourceOrganization: completeEnvironment.CRIME_INCIDENCE_SOURCE_ORGANIZATION,
      reference: "incidencia_estadistica",
      temporalCoverage: { start: "2025-01-01", end: "2025-12-31", status: "KNOWN" },
      lineage,
      validationSummary: { status: "SCHEMA_VALID", schemaValid: true },
    });
  });

  test("delivers a productive workspace binding with governed artifacts", async () => {
    const datasetIdentity = identity(completeEnvironment);
    const canonicalGeography: CanonicalProjectGeography = {
      geographyId: "geo-EXP-0228K",
      type: "INDIVIDUAL",
      geometry: { type: "Point", coordinates: [-102.29, 21.88] },
      source: "PROJECT_CREATION",
      validationStatus: "VALID",
      createdAt: 1,
      updatedAt: 1,
    };
    const responsePayload = {
      success: true,
      querySource: "POSTGIS",
      sourceStatus: "POSTGIS_AVAILABLE",
      coverageStatus: "IN_COVERAGE",
      data: [{
        id: "incident-k-1",
        INCIDENTE: "Robo",
        FECHA: "2025-08-01",
        lat: 21.881,
        lng: -102.291,
        originalLat: 21.881,
        originalLng: -102.291,
        coverageStatus: "IN_COVERAGE",
      }],
      bibliografia: "Referencia institucional",
      lineage,
      datasetIdentity,
    };
    const fetcher = (async () => new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
    const binding = await composeCrimeIncidenceProductionWorkspace({
      expedienteId: "EXP-0228K",
      canonicalGeography,
      radiusMeters: 1000,
      requestedBy: "analyst-k",
      fetcher,
    });
    expect(binding.state).toBe("READY");
    expect(binding.viewModel?.incidents.matched).toHaveLength(1);
    expect(binding.viewModel?.incidents.excluded).toHaveLength(0);
    expect(binding.viewModel?.metrics).toBe(binding.viewModel?.exportReference.projectionReference.metrics);
    expect(binding.viewModel?.lineage).toBe(binding.viewModel?.exportReference.lineage);
    expect(binding.viewModel?.exportReference.productClassification).toBe("DESCRIPTIVE_ANALYTICAL_PRODUCT");
  });

  test("does not fabricate evidentiary or inferential artifacts", () => {
    const dataset = identity(completeEnvironment) as unknown as Record<string, unknown>;
    expect(dataset.evidenceRef).toBeUndefined();
    expect(dataset.findingRef).toBeUndefined();
    expect(dataset.riskScore).toBeUndefined();
    expect(dataset.prediction).toBeUndefined();
    expect(dataset.causalAnalysis).toBeUndefined();
  });

  test("documents all required server-side configuration keys without values", () => {
    const example = fs.readFileSync(path.join(process.cwd(), ".env.local.example"), "utf8");
    for (const key of Object.keys(completeEnvironment)) expect(example).toContain(`${key}=`);
    expect(example).not.toContain(completeEnvironment.CRIME_INCIDENCE_DATASET_NAME);
    const documentation = fs.readFileSync(path.join(process.cwd(), "docs/ADR-022.8K-crime-incidence-provenance.md"), "utf8");
    expect(documentation).toContain("`.env.local`");
    expect(documentation).toContain("Vercel project Environment Variables");
  });
});
