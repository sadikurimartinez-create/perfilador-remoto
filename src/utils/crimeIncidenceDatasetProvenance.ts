import type { CrimeDatasetIdentity } from "@/types/crimeDatasetIdentity";
import type {
  CrimeCoverageStatus,
  CrimeIncidenceQuerySource,
  CrimeIncidenceSourceStatus,
  CrimeQueryLineage,
} from "@/utils/crimeIncidenceCanonicalPipeline";

export const CRIME_INCIDENCE_PROVENANCE_ENV_KEYS = [
  "CRIME_INCIDENCE_DATASET_NAME",
  "CRIME_INCIDENCE_DATASET_VERSION",
  "CRIME_INCIDENCE_SOURCE_ORGANIZATION",
  "CRIME_INCIDENCE_DATASET_TEMPORAL_START",
  "CRIME_INCIDENCE_DATASET_TEMPORAL_END",
] as const;

export interface CrimeIncidenceDatasetProvenanceConfig {
  datasetName: string | null;
  datasetVersion: string | null;
  sourceOrganization: string | null;
  temporalStart: string | null;
  temporalEnd: string | null;
}

export interface BuildCrimeIncidenceDatasetIdentityInput {
  config: CrimeIncidenceDatasetProvenanceConfig;
  datasetReference: string | null;
  querySource: CrimeIncidenceQuerySource;
  sourceStatus: CrimeIncidenceSourceStatus;
  coverageStatus: CrimeCoverageStatus;
  recordCount: number;
  lineage: CrimeQueryLineage;
}

type EnvironmentSource = Record<string, string | undefined>;

function configured(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validIsoDate(value: string | null): boolean {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function readCrimeIncidenceDatasetProvenanceConfig(
  environment: EnvironmentSource = process.env
): CrimeIncidenceDatasetProvenanceConfig {
  return {
    datasetName: configured(environment.CRIME_INCIDENCE_DATASET_NAME),
    datasetVersion: configured(environment.CRIME_INCIDENCE_DATASET_VERSION),
    sourceOrganization: configured(environment.CRIME_INCIDENCE_SOURCE_ORGANIZATION),
    temporalStart: configured(environment.CRIME_INCIDENCE_DATASET_TEMPORAL_START),
    temporalEnd: configured(environment.CRIME_INCIDENCE_DATASET_TEMPORAL_END),
  };
}

export function missingCrimeIncidenceProvenanceConfiguration(
  config: CrimeIncidenceDatasetProvenanceConfig
): string[] {
  const missing: string[] = [];
  if (!config.datasetName) missing.push("CRIME_INCIDENCE_DATASET_NAME");
  if (!config.datasetVersion) missing.push("CRIME_INCIDENCE_DATASET_VERSION");
  if (!config.sourceOrganization) missing.push("CRIME_INCIDENCE_SOURCE_ORGANIZATION");
  if (!config.temporalStart) missing.push("CRIME_INCIDENCE_DATASET_TEMPORAL_START");
  if (!config.temporalEnd) missing.push("CRIME_INCIDENCE_DATASET_TEMPORAL_END");
  return missing;
}

/** Builds dataset provenance only; it never creates or transforms incidence records. */
export function buildCrimeIncidenceDatasetIdentity(
  input: BuildCrimeIncidenceDatasetIdentityInput
): CrimeDatasetIdentity {
  const { config } = input;
  const temporalValid = validIsoDate(config.temporalStart)
    && validIsoDate(config.temporalEnd)
    && config.temporalStart! <= config.temporalEnd!;
  const sourceValid = input.sourceStatus !== "FAILED" && input.sourceStatus !== "NOT_CONFIGURED";
  const validationReasons = [
    ...(sourceValid ? [] : ["CRIME_INCIDENCE_QUERY_SOURCE_UNAVAILABLE"]),
    ...(config.temporalStart && config.temporalEnd && !temporalValid ? ["CRIME_INCIDENCE_DATASET_TEMPORAL_CONFIGURATION_INVALID"] : []),
  ];

  return {
    datasetId: input.datasetReference,
    datasetName: config.datasetName,
    datasetVersion: config.datasetVersion,
    sourceType: input.querySource === "NONE" ? null : input.querySource,
    sourceName: input.datasetReference,
    sourceOrganization: config.sourceOrganization,
    reference: input.datasetReference,
    temporalCoverage: temporalValid
      ? { start: config.temporalStart, end: config.temporalEnd, status: "KNOWN" }
      : { start: null, end: null, status: "TEMPORAL_COVERAGE_UNKNOWN" },
    geographicCoverage: {
      status: input.coverageStatus,
      scopeCompatibility: input.coverageStatus === "UNKNOWN_COVERAGE"
        ? "UNKNOWN"
        : input.coverageStatus === "OUT_OF_COVERAGE" ? "OUT_OF_SCOPE" : "IN_SCOPE",
    },
    validationSummary: {
      status: sourceValid && temporalValid ? "SCHEMA_VALID" : "INVALID",
      schemaValid: sourceValid && temporalValid,
      recordCount: input.recordCount,
      acceptedCount: input.recordCount,
      reasons: validationReasons,
    },
    lineage: input.lineage,
  };
}
