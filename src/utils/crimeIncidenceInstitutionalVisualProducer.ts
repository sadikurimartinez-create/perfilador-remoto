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

export function resolveCrimeIncidenceVisualSource(
  projection: CrimeIncidenceAnalyticalProjection
): string {
  return (
    normalizeText(projection.sourceQuery?.request?.requestProvenance?.sourceReference) ||
    normalizeText(projection.datasetReference?.sourceReference) ||
    normalizeText(projection.lineage?.dataset) ||
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
        : Number((item.value * 100 / projection.metrics.frequency.totalRecords).toFixed(2)),
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
    sourceReference: resolveCrimeIncidenceVisualSource(projection),
    lineage: projection.lineage,
    filters: projection.sourceQuery?.request?.crimeFilters || projection.lineage.filters,
    period: projection.temporalReference || projection.sourceQuery?.request?.temporalFilters || projection.lineage.timeRange,
    geography: projection.geographicReference || projection.sourceQuery?.request?.queryGeometry || projection.lineage.geographicFilter,
    sourceIdentity: projection.sourceQuery?.request?.datasetIdentity || projection.datasetReference,
    total: projection.metrics.frequency.totalRecords,
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
    sourceReference: resolveCrimeIncidenceVisualSource(projection),
    lineage: projection.lineage,
    filters: projection.sourceQuery?.request?.crimeFilters || projection.lineage.filters,
    period: projection.temporalReference || projection.sourceQuery?.request?.temporalFilters || projection.lineage.timeRange,
    geography: projection.geographicReference || projection.sourceQuery?.request?.queryGeometry || projection.lineage.geographicFilter,
    sourceIdentity: projection.sourceQuery?.request?.datasetIdentity || projection.datasetReference,
    total: projection.metrics.frequency.totalRecords,
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
  if (projection.sourceQuery?.status !== "EXECUTED") throw new Error("CRIME_INCIDENCE_VISUAL_QUERY_NOT_EXECUTED");
  if (projection.sourceQuery?.admission?.accepted !== true) throw new Error("CRIME_INCIDENCE_VISUAL_ADMISSION_NOT_ACCEPTED");
  if (!normalizeText(projection.datasetReference?.datasetId)) throw new Error("CRIME_INCIDENCE_VISUAL_DATASET_ID_MISSING");
  if (!projection.lineage) throw new Error("CRIME_INCIDENCE_VISUAL_LINEAGE_MISSING");
  if (/MOCK|SIMULAT|SYNTHETIC/i.test(JSON.stringify(projection.sourceQuery?.request?.datasetIdentity || {}))) {
    throw new Error("CRIME_INCIDENCE_VISUAL_DATASET_IDENTITY_SIMULATED");
  }
  const total = projection.metrics.frequency.totalRecords;
  if (!Number.isInteger(total) || total < 0) throw new Error("CRIME_INCIDENCE_VISUAL_TOTAL_INVALID");
  const typeBuckets = projection.metrics.frequency.byIncidentType;
  if (Array.isArray(typeBuckets) && typeBuckets.length) {
    if (typeBuckets.some(bucket => !normalizeText(bucket.value) || !Number.isInteger(bucket.count) || bucket.count < 0) ||
      typeBuckets.reduce((sum, bucket) => sum + bucket.count, 0) !== total ||
      new Set(typeBuckets.map(bucket => normalizeText(bucket.value))).size !== typeBuckets.length) throw new Error("CRIME_INCIDENCE_VISUAL_COUNTS_INCONSISTENT");
    for (const bucket of projection.metrics.percentage?.byIncidentType || []) {
      const frequency = typeBuckets.find(item => item.value === bucket.value);
      if (!frequency || bucket.count !== frequency.count || !Number.isFinite(bucket.percentage) ||
        Math.abs(bucket.percentage - (total ? bucket.count * 100 / total : 0)) > 0.011) throw new Error("CRIME_INCIDENCE_VISUAL_PERCENTAGES_INCONSISTENT");
    }
  }
  const dates = projection.metrics.distribution?.byOccurredDate || [];
  if (projection.metrics.percentage?.basis !== undefined && projection.metrics.percentage.basis !== total) throw new Error("CRIME_INCIDENCE_VISUAL_PERCENTAGES_INCONSISTENT");
  const temporal = projection.sourceQuery?.request?.temporalFilters;
  const start = (temporal as any)?.start || (temporal as any)?.startDate;
  const end = (temporal as any)?.end || (temporal as any)?.endDate;
  if (dates.some(bucket => bucket.value && ((start && bucket.value < start.slice(0, 10)) || (end && bucket.value > end.slice(0, 10))))) throw new Error("CRIME_INCIDENCE_VISUAL_PERIOD_MISMATCH");
  if (dates.some(bucket => !bucket.value || !/^\d{4}-\d{2}-\d{2}$/.test(bucket.value) || !Number.isFinite(Date.parse(bucket.value)) ||
      new Date(bucket.value).toISOString().slice(0, 10) !== bucket.value || !Number.isInteger(bucket.count) || bucket.count < 0) ||
    new Set(dates.map(bucket => bucket.value)).size !== dates.length ||
    dates.reduce((sum, bucket) => sum + bucket.count, 0) > total) throw new Error("CRIME_INCIDENCE_VISUAL_TEMPORAL_COUNTS_INVALID");
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
