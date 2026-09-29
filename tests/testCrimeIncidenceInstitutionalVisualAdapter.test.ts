import {
  buildCrimeIncidenceInstitutionalVisualCandidate,
  buildCrimeIncidenceInstitutionalVisualProduct,
} from "../src/utils/crimeIncidenceInstitutionalVisualAdapter";
import type {
  CrimeIncidenceInstitutionalChartAsset,
} from "../src/utils/crimeIncidenceInstitutionalChartMaterializer";

function assetFixture(): CrimeIncidenceInstitutionalChartAsset {
  return {
    assetVersion: "1.0",
    visualId: "crime-incidence-type-distribution:dataset-001",
    kind: "INCIDENT_TYPE_DISTRIBUTION",
    visualType: "CHART",
    mimeType: "image/png",
    width: 1200,
    height: 700,
    dataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
    title: "Distribución de incidencia por tipo",
    caption:
      "Distribución descriptiva de los registros admitidos por tipo de incidencia.",
    metadata: {
      visualId: "crime-incidence-type-distribution:dataset-001",
      visualType: "CHART",
      title: "Distribución de incidencia por tipo",
      datasetReference: "dataset-001",
      variables: ["incidentType", "count", "percentage"],
      transformation:
        "Agrupación descriptiva de registros admitidos por tipo de incidente.",
      analyticLevel: "DESCRIPTIVE",
      sourceReference: "fuente-administrativa-001",
      lineage: {
        dataset: "dataset-001",
      } as any,
      watermark: "CEIPOL",
      method: "FREQUENCY_AND_PERCENTAGE_BY_INCIDENT_TYPE",
      limitations: [
        "Cobertura limitada al dataset consultado.",
      ],
    },
  };
}

describe("crimeIncidenceInstitutionalVisualAdapter", () => {
  test("convierte PNG ADR-022 en candidato chart gobernable", () => {
    const candidate =
      buildCrimeIncidenceInstitutionalVisualCandidate(assetFixture());

    expect(candidate.kind).toBe("INCIDENT_TYPE_DISTRIBUTION");
    expect(candidate.visualType).toBe("CHART");

    expect(candidate.datasetId).toBe("dataset-001");
    expect(candidate.sourceReference).toBe(
      "fuente-administrativa-001"
    );

    expect(candidate.datasetSourceRefs).toEqual([
      "dataset-001",
      "fuente-administrativa-001",
    ]);

    expect(candidate.variables).toEqual([
      "incidentType",
      "count",
      "percentage",
    ]);

    expect(candidate.assetRef).toMatch(
      /^data:image\/png;base64,/
    );
  });

  test("marca producto como OBSERVED y nunca SIMULATED", () => {
    const candidate =
      buildCrimeIncidenceInstitutionalVisualCandidate(assetFixture());

    expect(candidate.acquisitionMode).toBe("OBSERVED");
    expect(candidate.isSimulated).toBe(false);
    expect(candidate.analyticLevel).toBe("DESCRIPTIVE");
    expect(candidate.relationKind).toBeNull();
  });

  test("preserva transformación, método y limitaciones ADR-022", () => {
    const candidate =
      buildCrimeIncidenceInstitutionalVisualCandidate(assetFixture());

    expect(candidate.transformation).toContain(
      "Agrupación descriptiva"
    );

    expect(candidate.crimeIncidenceVisualMetadata.method).toBe(
      "FREQUENCY_AND_PERCENTAGE_BY_INCIDENT_TYPE"
    );

    expect(
      candidate.crimeIncidenceVisualMetadata.limitations
    ).toEqual([
      "Cobertura limitada al dataset consultado.",
    ]);
  });

  test("entra al builder rector como InstitutionalVisualProduct CHART", () => {
    const product =
      buildCrimeIncidenceInstitutionalVisualProduct(assetFixture());

    expect(product.visualType).toBe("CHART");
    expect(product.kind).toBe("INCIDENT_TYPE_DISTRIBUTION");

    expect(product.visualId).toBe(
      "crime-incidence-type-distribution:dataset-001"
    );

    expect(product.assetRef).toMatch(
      /^data:image\/png;base64,/
    );

    expect(product.datasetSourceRefs).toContain("dataset-001");
    expect(product.datasetSourceRefs).toContain(
      "fuente-administrativa-001"
    );

    expect(product.variables).toContain("incidentType");
    expect(product.certified).toBe(false);
  });

  test("producto ADR-022 no queda INELIGIBLE en gobernanza visual", () => {
    const product =
      buildCrimeIncidenceInstitutionalVisualProduct(assetFixture());

    expect(product.publicationEligibility).not.toBe("INELIGIBLE");
  });

  test("tolera method y limitations ausentes sin fabricar metadata", () => {
    const asset = assetFixture();

    delete (asset.metadata as any).method;
    delete (asset.metadata as any).limitations;

    const candidate =
      buildCrimeIncidenceInstitutionalVisualCandidate(asset);

    expect(candidate.crimeIncidenceVisualMetadata.method).toBeUndefined();
    expect(
      candidate.crimeIncidenceVisualMetadata.limitations
    ).toEqual([]);
  });
  test("rechaza chart sin dataset", () => {
    const asset = assetFixture();
    asset.metadata.datasetReference = "";

    expect(() =>
      buildCrimeIncidenceInstitutionalVisualCandidate(asset)
    ).toThrow(
      "CRIME_INCIDENCE_INSTITUTIONAL_VISUAL_REQUIRES_DATASET_REFERENCE"
    );
  });

  test("rechaza chart sin fuente declarada", () => {
    const asset = assetFixture();
    asset.metadata.sourceReference = "";

    expect(() =>
      buildCrimeIncidenceInstitutionalVisualCandidate(asset)
    ).toThrow(
      "CRIME_INCIDENCE_INSTITUTIONAL_VISUAL_REQUIRES_SOURCE_REFERENCE"
    );
  });

  test("rechaza asset que no sea PNG institucional", () => {
    const asset = assetFixture();
    asset.dataUrl = "data:image/jpeg;base64,AAA";

    expect(() =>
      buildCrimeIncidenceInstitutionalVisualCandidate(asset)
    ).toThrow(
      "CRIME_INCIDENCE_INSTITUTIONAL_VISUAL_REQUIRES_PNG_ASSET"
    );
  });

  test("rechaza visual sin variables declaradas", () => {
    const asset = assetFixture();
    asset.metadata.variables = [];

    expect(() =>
      buildCrimeIncidenceInstitutionalVisualCandidate(asset)
    ).toThrow(
      "CRIME_INCIDENCE_INSTITUTIONAL_VISUAL_REQUIRES_VARIABLES"
    );
  });

  test("rechaza visual sin transformación declarada", () => {
    const asset = assetFixture();
    asset.metadata.transformation = "";

    expect(() =>
      buildCrimeIncidenceInstitutionalVisualCandidate(asset)
    ).toThrow(
      "CRIME_INCIDENCE_INSTITUTIONAL_VISUAL_REQUIRES_TRANSFORMATION"
    );
  });

  test("preserva subtipo institucional del chart", () => {
    const asset = assetFixture();
    asset.kind = "TEMPORAL_EVOLUTION";

    const product =
      buildCrimeIncidenceInstitutionalVisualProduct(asset);

    expect(product.kind).toBe("TEMPORAL_EVOLUTION");
    expect(product.visualType).toBe("CHART");
  });});