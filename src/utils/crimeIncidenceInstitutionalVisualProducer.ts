import type { CrimeIncidenceAnalyticalProjection } from "@/types/crimeIncidenceAnalyticalProjection";
import {
  CRIME_INCIDENCE_INSTITUTIONAL_BRANDING,
  type CrimeIncidenceVisualProductMetadata,
} from "@/types/crimeIncidenceWorkspace";

export const CRIME_INCIDENCE_VISUAL_PRODUCER_VERSION = "1.0";

export type CrimeIncidenceInstitutionalChartKind =
  | "INCIDENT_TYPE_DISTRIBUTION"
  | "TEMPORAL_EVOLUTION";

export interface CrimeIncidenceInstitutionalChartDatum {
  label: string;
  value: number;
  percentage?: number;
}

export interface CrimeIncidenceInstitutionalChartSpecification {
  specificationVersion: typeof CRIME_INCIDENCE_VISUAL_PRODUCER_VERSION;
  kind: CrimeIncidenceInstitutionalChartKind;
  visualType: "CHART";
  chartType: "BAR" | "LINE";
  title: string;
  subtitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
  data: CrimeIncidenceInstitutionalChartDatum[];
  metadata: CrimeIncidenceVisualProductMetadata;
}

export interface CrimeIncidenceInstitutionalVisualSet {
  source: "ADR-022_CRIME_INCIDENCE";
  analyticalLevel: "DESCRIPTIVE";
  charts: CrimeIncidenceInstitutionalChartSpecification[];
  exclusions: Array<{
    kind: CrimeIncidenceInstitutionalChartKind;
    reason:
      | "NO_RECORDS"
      | "NO_INCIDENT_TYPE_DISTRIBUTION"
      | "NO_TEMPORAL_DISTRIBUTION";
  }>;
}

function normalizeText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function resolveDatasetReference(
  projection: CrimeIncidenceAnalyticalProjection
): string {
  return normalizeText(projection.datasetReference?.datasetId) || "DATASET_NO_IDENTIFICADO";
}

function resolveSourceReference(
  projection: CrimeIncidenceAnalyticalProjection
): string {
  return (
    normalizeText(projection.lineage?.dataset) ||
    normalizeText(projection.sourceQuery?.request?.requestProvenance?.sourceReference) ||
    resolveDatasetReference(projection)
  );
}

function cleanFrequencyBuckets(
  buckets: unknown
): Array<{ label: string; value: number }> {
  if (!Array.isArray(buckets)) return [];

  return buckets
    .map((bucket) => ({
      label: normalizeText(bucket.value) || "NO DETERMINADO",
      value: Number(bucket.count),
    }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0);
}

function buildIncidentTypeChart(
  projection: CrimeIncidenceAnalyticalProjection
): CrimeIncidenceInstitutionalChartSpecification | null {
  const frequency = cleanFrequencyBuckets(
    projection.metrics.frequency.byIncidentType
  );

  if (!frequency.length) return null;

  const percentageBuckets = Array.isArray(
    projection.metrics.percentage?.byIncidentType
  )
    ? projection.metrics.percentage.byIncidentType
    : [];

  const percentages = new Map(
    percentageBuckets.map((bucket) => [
      normalizeText(bucket.value) || "NO DETERMINADO",
      Number(bucket.percentage),
    ])
  );

  const data = frequency
    .map((item) => ({
      ...item,
      percentage: Number.isFinite(percentages.get(item.label))
        ? percentages.get(item.label)
        : undefined,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const metadata: CrimeIncidenceVisualProductMetadata = {
    visualId: `crime-incidence-type-distribution:${resolveDatasetReference(projection)}`,
    visualType: "CHART",
    title: "Distribución de incidencia por tipo",
    datasetReference: resolveDatasetReference(projection),
    variables: ["incidentType", "count", "percentage"],
    transformation:
      "Agrupación descriptiva de registros admitidos por tipo de incidente; conteo absoluto y porcentaje respecto del universo admitido.",
    analyticLevel: "DESCRIPTIVE",
    sourceReference: resolveSourceReference(projection),
    lineage: projection.lineage,
    watermark: CRIME_INCIDENCE_INSTITUTIONAL_BRANDING.watermark,
    method: "FREQUENCY_AND_PERCENTAGE_BY_INCIDENT_TYPE",
    limitations: [...projection.limitations],
  };

  return {
    specificationVersion: CRIME_INCIDENCE_VISUAL_PRODUCER_VERSION,
    kind: "INCIDENT_TYPE_DISTRIBUTION",
    visualType: "CHART",
    chartType: "BAR",
    title: metadata.title,
    subtitle: `Registros admitidos: ${projection.metrics.frequency.totalRecords}`,
    xAxisLabel: "Tipo de incidencia",
    yAxisLabel: "Número de registros",
    data,
    metadata,
  };
}

function buildTemporalEvolutionChart(
  projection: CrimeIncidenceAnalyticalProjection
): CrimeIncidenceInstitutionalChartSpecification | null {
  const data = cleanFrequencyBuckets(
    projection.metrics.distribution?.byOccurredDate
  ).sort((a, b) => a.label.localeCompare(b.label));

  if (!data.length) return null;

  const metadata: CrimeIncidenceVisualProductMetadata = {
    visualId: `crime-incidence-temporal-evolution:${resolveDatasetReference(projection)}`,
    visualType: "CHART",
    title: "Evolución temporal observada de la incidencia",
    datasetReference: resolveDatasetReference(projection),
    variables: ["occurredDate", "count"],
    transformation:
      "Agrupación descriptiva de registros admitidos por fecha de ocurrencia; conteo absoluto por fecha sin inferencia predictiva.",
    analyticLevel: "DESCRIPTIVE",
    sourceReference: resolveSourceReference(projection),
    lineage: projection.lineage,
    watermark: CRIME_INCIDENCE_INSTITUTIONAL_BRANDING.watermark,
    method: "FREQUENCY_BY_OCCURRED_DATE",
    limitations: [...projection.limitations],
  };

  return {
    specificationVersion: CRIME_INCIDENCE_VISUAL_PRODUCER_VERSION,
    kind: "TEMPORAL_EVOLUTION",
    visualType: "CHART",
    chartType: "LINE",
    title: metadata.title,
    subtitle: "Serie descriptiva basada exclusivamente en fechas observadas",
    xAxisLabel: "Fecha de ocurrencia",
    yAxisLabel: "Número de registros",
    data,
    metadata,
  };
}

export function buildCrimeIncidenceInstitutionalVisualSpecifications(
  projection: CrimeIncidenceAnalyticalProjection
): CrimeIncidenceInstitutionalVisualSet {
  const charts: CrimeIncidenceInstitutionalChartSpecification[] = [];
  const exclusions: CrimeIncidenceInstitutionalVisualSet["exclusions"] = [];

  if (projection.metrics.frequency.totalRecords <= 0) {
    return {
      source: "ADR-022_CRIME_INCIDENCE",
      analyticalLevel: "DESCRIPTIVE",
      charts,
      exclusions: [
        {
          kind: "INCIDENT_TYPE_DISTRIBUTION",
          reason: "NO_RECORDS",
        },
        {
          kind: "TEMPORAL_EVOLUTION",
          reason: "NO_RECORDS",
        },
      ],
    };
  }

  const typeChart = buildIncidentTypeChart(projection);

  if (typeChart) {
    charts.push(typeChart);
  } else {
    exclusions.push({
      kind: "INCIDENT_TYPE_DISTRIBUTION",
      reason: "NO_INCIDENT_TYPE_DISTRIBUTION",
    });
  }

  const temporalChart = buildTemporalEvolutionChart(projection);

  if (temporalChart) {
    charts.push(temporalChart);
  } else {
    exclusions.push({
      kind: "TEMPORAL_EVOLUTION",
      reason: "NO_TEMPORAL_DISTRIBUTION",
    });
  }

  return {
    source: "ADR-022_CRIME_INCIDENCE",
    analyticalLevel: "DESCRIPTIVE",
    charts,
    exclusions,
  };
}
