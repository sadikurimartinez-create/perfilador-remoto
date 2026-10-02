import { buildCrimeIncidenceInstitutionalVisualSpecifications } from "../src/utils/crimeIncidenceInstitutionalVisualProducer";
import type { CrimeIncidenceAnalyticalProjection } from "../src/types/crimeIncidenceAnalyticalProjection";

function projectionFixture(): CrimeIncidenceAnalyticalProjection {
  const lineage = {
    dataset: "dataset-incidencia-001",
    source: "TEST",
    generatedAt: "2026-09-29T12:00:00.000Z",
  } as any;

  return {
    projectionType: "DESCRIPTIVE_SUMMARY",
    analyticalLevel: "DESCRIPTIVE",
    sourceQuery: {
      status: "EXECUTED",
      admission: { accepted: true },
      request: {
        requestProvenance: {
          sourceReference: "fuente-administrativa-001",
        },
      },
    } as any,
    datasetReference: {
      datasetId: "dataset-incidencia-001",
    } as any,
    geographicReference: {} as any,
    temporalReference: {} as any,
    metrics: {
      frequency: {
        totalRecords: 10,
        byIncidentType: [
          { value: "ROBO", count: 6 },
          { value: "DAÑO", count: 4 },
        ],
      },
      percentage: {
        basis: 10,
        byIncidentType: [
          { value: "ROBO", count: 6, percentage: 60 },
          { value: "DAÑO", count: 4, percentage: 40 },
        ],
      },
      distribution: {
        byMunicipality: [],
        byOccurredDate: [
          { value: "2026-09-27", count: 2 },
          { value: "2026-09-28", count: 3 },
          { value: "2026-09-29", count: 5 },
        ],
      },
      aggregation: {
        matchedRecords: 10,
        excludedRecords: 0,
        recordsWithCoordinates: 8,
      },
    },
    limitations: ["Cobertura limitada al dataset consultado."],
    lineage,
  };
}

describe("crimeIncidenceInstitutionalVisualProducer", () => {
  test("produce distribución por tipo con conteos y porcentajes observados", () => {
    const result = buildCrimeIncidenceInstitutionalVisualSpecifications(
      projectionFixture()
    );

    const chart = result.charts.find(
      (item) => item.kind === "INCIDENT_TYPE_DISTRIBUTION"
    );

    expect(chart).toBeDefined();
    expect(chart?.visualType).toBe("CHART");
    expect(chart?.chartType).toBe("BAR");
    expect(chart?.data).toEqual([
      { label: "ROBO", value: 6, percentage: 60 },
      { label: "DAÑO", value: 4, percentage: 40 },
    ]);
    expect(chart?.metadata.analyticLevel).toBe("DESCRIPTIVE");
    expect(chart?.metadata.datasetReference).toBe("dataset-incidencia-001");
    expect(chart?.metadata.variables).toEqual([
      "incidentType",
      "count",
      "percentage",
    ]);
  });

  test("produce evolución temporal sólo con fechas y conteos observados", () => {
    const result = buildCrimeIncidenceInstitutionalVisualSpecifications(
      projectionFixture()
    );

    const chart = result.charts.find(
      (item) => item.kind === "TEMPORAL_EVOLUTION"
    );

    expect(chart).toBeDefined();
    expect(chart?.chartType).toBe("LINE");
    expect(chart?.data).toEqual([
      { label: "2026-09-27", value: 2 },
      { label: "2026-09-28", value: 3 },
      { label: "2026-09-29", value: 5 },
    ]);
    expect(chart?.metadata.transformation).toContain(
      "sin inferencia predictiva"
    );
  });

  test("preserva lineage, fuente y limitaciones del contrato ADR-022", () => {
    const projection = projectionFixture();
    const result =
      buildCrimeIncidenceInstitutionalVisualSpecifications(projection);

    for (const chart of result.charts) {
      expect(chart.metadata.lineage).toBe(projection.lineage);
      expect(chart.metadata.sourceReference).toBe("fuente-administrativa-001");
      expect(chart.metadata.limitations).toEqual([
        "Cobertura limitada al dataset consultado.",
      ]);
      expect(chart.metadata.watermark).toBe("CEIPOL");
    }
  });

  test("no fabrica visuales cuando no existen registros", () => {
    const projection = projectionFixture();

    projection.metrics.frequency.totalRecords = 0;
    projection.metrics.percentage.basis = 0;
    projection.metrics.frequency.byIncidentType = [];
    projection.metrics.percentage.byIncidentType = [];
    projection.metrics.distribution.byOccurredDate = [];

    const result =
      buildCrimeIncidenceInstitutionalVisualSpecifications(projection);

    expect(result.charts).toHaveLength(0);
    expect(result.exclusions).toEqual([
      {
        kind: "INCIDENT_TYPE_DISTRIBUTION",
        reason: "NO_RECORDS",
      },
      {
        kind: "TEMPORAL_EVOLUTION",
        reason: "NO_RECORDS",
      },
    ]);
  });

  test("snapshot historico incompleto excluye ambas graficas sin fallar", () => {
    const projection = projectionFixture() as any;

    projection.metrics.frequency = { totalRecords: 5 };
    delete projection.metrics.percentage;
    delete projection.metrics.distribution;

    const result =
      buildCrimeIncidenceInstitutionalVisualSpecifications(projection);

    expect(result.charts).toEqual([]);
    expect(result.exclusions).toEqual([
      {
        kind: "INCIDENT_TYPE_DISTRIBUTION",
        reason: "NO_INCIDENT_TYPE_DISTRIBUTION",
      },
      {
        kind: "TEMPORAL_EVOLUTION",
        reason: "NO_TEMPORAL_DISTRIBUTION",
      },
    ]);
  });

  test("no convierte proyección descriptiva en conclusión o inferencia", () => {
    const serialized = JSON.stringify(
      buildCrimeIncidenceInstitutionalVisualSpecifications(projectionFixture())
    ).toLowerCase();

    expect(serialized).not.toContain("causa");
    expect(serialized).not.toContain("demuestra la hipótesis");
    expect(serialized).not.toContain("confirma la hipótesis");
    expect(serialized).not.toContain("predicción");
  });
});
