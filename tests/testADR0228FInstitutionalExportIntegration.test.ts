import fs from "node:fs";
import path from "node:path";
import type { CrimeIncidenceExportContract } from "../src/types/crimeIncidenceExportContract";
import type { CrimeIncidenceInstitutionalDocumentProduct } from "../src/utils/crimeIncidenceWorkspaceExport";
import { prepareCrimeIncidenceInstitutionalExport } from "../src/utils/crimeIncidenceWorkspaceExport";

function contract(): CrimeIncidenceExportContract {
  const lineage = { dataset: "crime-dataset-2026" };
  const datasetReference = { datasetId: "crime-dataset-2026", lineage };
  const geographicReference = {
    expediente: { expedienteId: "EXP-0228F" },
    coverageStatus: "IN_COVERAGE",
  };
  const metrics = {
    frequency: { totalRecords: 2, byIncidentType: [{ value: "Robo", count: 2 }] },
    percentage: { basis: 2, byIncidentType: [{ value: "Robo", count: 2, percentage: 100 }] },
    distribution: { byMunicipality: [], byOccurredDate: [] },
    aggregation: { matchedRecords: 2, excludedRecords: 0, recordsWithCoordinates: 2 },
  };
  const projectionReference = {
    analyticalLevel: "DESCRIPTIVE",
    datasetReference,
    geographicReference,
    metrics,
    lineage,
  };
  return {
    exportId: "export-0228f",
    expedienteId: "EXP-0228F",
    projectionReference,
    datasetReference,
    queryReference: {},
    geographicReference,
    analyticalLevel: "DESCRIPTIVE",
    createdAtReference: "2026-08-31T12:00:00.000Z",
    lineage,
    limitations: ["Producto descriptivo"],
    institutionalMetadata: {
      header: "Centro de Estudios en Seguridad y Política Criminal",
      watermark: "CEIPOL",
      footer: "Secretaría de Seguridad Pública del Estado de Aguascalientes",
    },
    productClassification: "DESCRIPTIVE_ANALYTICAL_PRODUCT",
  } as unknown as CrimeIncidenceExportContract;
}

describe("ADR-022.8F institutional export integration", () => {
  test("prepares a renderer-neutral document product from the ADR-022.7 contract", () => {
    const source = contract();
    const product = prepareCrimeIncidenceInstitutionalExport(source);
    expect(product.exportContract).toBe(source);
    expect(product.expedienteId).toBe("EXP-0228F");
    expect(product.productClassification).toBe("DESCRIPTIVE_ANALYTICAL_PRODUCT");
  });

  test("preserves governed geography, dataset, metrics, lineage, and limitations by reference", () => {
    const source = contract();
    const product = prepareCrimeIncidenceInstitutionalExport(source);
    expect(product.geographicReference).toBe(source.geographicReference);
    expect(product.datasetReference).toBe(source.datasetReference);
    expect(product.metrics).toBe(source.projectionReference.metrics);
    expect(product.lineage).toBe(source.lineage);
    expect(product.limitations).toBe(source.limitations);
  });

  test("preserves mandatory institutional metadata and descriptive classification", () => {
    const product = prepareCrimeIncidenceInstitutionalExport(contract());
    expect(product.institutionalMetadata).toEqual({
      header: "Centro de Estudios en Seguridad y Política Criminal",
      watermark: "CEIPOL",
      footer: "Secretaría de Seguridad Pública del Estado de Aguascalientes",
    });
    expect(product.analyticalLevel).toBe("DESCRIPTIVE");
  });

  test("rejects altered institutional branding", () => {
    const source = contract() as unknown as { institutionalMetadata: { header: string } };
    source.institutionalMetadata.header = "Otra institución";
    expect(() => prepareCrimeIncidenceInstitutionalExport(source as unknown as CrimeIncidenceExportContract))
      .toThrow("CRIME_INCIDENCE_EXPORT_INSTITUTIONAL_METADATA_MISMATCH");
  });

  test("rejects a broken governed reference chain", () => {
    const source = contract();
    const altered = { ...source, datasetReference: { ...source.datasetReference } };
    expect(() => prepareCrimeIncidenceInstitutionalExport(altered))
      .toThrow("CRIME_INCIDENCE_EXPORT_GOVERNANCE_CHAIN_MISMATCH");
  });

  test("does not mutate the export contract", () => {
    const source = contract();
    const before = JSON.stringify(source);
    prepareCrimeIncidenceInstitutionalExport(source);
    expect(JSON.stringify(source)).toBe(before);
  });

  test("does not create prohibited analytical or evidentiary fields", () => {
    const product = prepareCrimeIncidenceInstitutionalExport(contract()) as CrimeIncidenceInstitutionalDocumentProduct & Record<string, unknown>;
    expect(product.evidenceRef).toBeUndefined();
    expect(product.findingRef).toBeUndefined();
    expect(product.riskScore).toBeUndefined();
    expect(product.prediction).toBeUndefined();
    expect(product.causalAnalysis).toBeUndefined();
  });

  test("workspace delegates the governed product through an injected renderer boundary", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceWorkspace.tsx"), "utf8");
    expect(source).toContain("prepareCrimeIncidenceInstitutionalExport(viewModel.exportReference)");
    expect(source).toContain("onExportProduct");
    expect(source).not.toMatch(/exportToWord|jsPDF|historicalCrimes/);
  });

  test("adapter creates no identity, time, document engine, or unsafe values", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/utils/crimeIncidenceWorkspaceExport.ts"), "utf8");
    expect(source).not.toMatch(/Date\.now|new Date|Math\.random/);
    expect(source).not.toMatch(/DocumentEngine|exportToWord|jsPDF|historicalCrimes/);
    expect(source).not.toMatch(/\bany\b/);
  });
});
