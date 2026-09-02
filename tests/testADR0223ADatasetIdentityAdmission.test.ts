import fs from "node:fs";
import path from "node:path";
import type { CrimeDatasetIdentity } from "../src/types/crimeDatasetIdentity";
import { evaluateCrimeDatasetAdmission } from "../src/utils/crimeDatasetAdmissionGate";

function completeDataset(overrides: Partial<CrimeDatasetIdentity> = {}): CrimeDatasetIdentity {
  return {
    datasetId: "crime-dataset-2026",
    datasetName: "Incidencia observada 2026",
    datasetVersion: "2026.1",
    sourceType: "POSTGIS",
    sourceName: "incidencia_estadistica",
    sourceOrganization: "SSPE Aguascalientes",
    temporalCoverage: { start: "2026-01-01", end: "2026-08-31", status: "KNOWN" },
    geographicCoverage: {
      status: "IN_COVERAGE",
      scopeCompatibility: "IN_SCOPE",
      jurisdiction: "Aguascalientes",
    },
    recordCount: 100,
    reference: "incidencia_estadistica",
    validationSummary: {
      status: "SCHEMA_VALID",
      schemaValid: true,
      recordCount: 100,
      acceptedCount: 100,
      rejectedCount: 0,
      deduplicatedCount: 0,
    },
    metadata: {},
    ...overrides,
  };
}

describe("ADR-022.3A dataset identity admission gate", () => {
  test("complete valid dataset is admitted", () => {
    const admission = evaluateCrimeDatasetAdmission(completeDataset());
    expect(admission.status).toBe("ADMITTED");
    expect(admission.accepted).toBe(true);
  });

  test("missing source is incomplete provenance", () => {
    const admission = evaluateCrimeDatasetAdmission(completeDataset({ sourceName: null }));
    expect(admission.status).toBe("INCOMPLETE_PROVENANCE");
    expect(admission.reasons).toContain("SOURCE_NAME_MISSING");
  });

  test("missing version is incomplete provenance", () => {
    const admission = evaluateCrimeDatasetAdmission(completeDataset({ datasetVersion: null }));
    expect(admission.status).toBe("INCOMPLETE_PROVENANCE");
  });

  test("missing coverage is incomplete provenance", () => {
    const admission = evaluateCrimeDatasetAdmission(completeDataset({ temporalCoverage: null }));
    expect(admission.status).toBe("INCOMPLETE_PROVENANCE");
  });

  test("dataset outside scope is rejected as out of scope", () => {
    const admission = evaluateCrimeDatasetAdmission(completeDataset({
      geographicCoverage: { status: "OUT_OF_COVERAGE", scopeCompatibility: "OUT_OF_SCOPE" },
    }));
    expect(admission.status).toBe("OUT_OF_SCOPE");
    expect(admission.accepted).toBe(false);
  });

  test("invalid structure fails validation", () => {
    const admission = evaluateCrimeDatasetAdmission(completeDataset({
      validationSummary: { status: "INVALID", schemaValid: false, reasons: ["SCHEMA_INVALID"] },
    }));
    expect(admission.status).toBe("FAILED_VALIDATION");
  });

  test("admission does not create evidence or findings", () => {
    const admission = evaluateCrimeDatasetAdmission(completeDataset());
    const record = admission as unknown as Record<string, unknown>;
    expect(record.evidence).toBeUndefined();
    expect(record.finding).toBeUndefined();
    expect(record.evidenceRef).toBeUndefined();
  });

  test("gate uses neither runtime time nor random identity", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/utils/crimeDatasetAdmissionGate.ts"), "utf8");
    expect(source).not.toMatch(/Date\.now|Math\.random|new Date/);
    expect(evaluateCrimeDatasetAdmission(completeDataset())).toEqual(
      evaluateCrimeDatasetAdmission(completeDataset())
    );
  });
});
