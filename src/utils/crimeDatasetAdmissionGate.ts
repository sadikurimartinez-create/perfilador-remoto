import type {
  CrimeDatasetAdmissionResult,
  CrimeDatasetIdentity,
} from "@/types/crimeDatasetIdentity";

function present(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function incompleteProvenanceReasons(dataset: CrimeDatasetIdentity): string[] {
  const reasons: string[] = [];
  if (!present(dataset.datasetId)) reasons.push("DATASET_ID_MISSING");
  if (!present(dataset.datasetName)) reasons.push("DATASET_NAME_MISSING");
  if (!present(dataset.datasetVersion)) reasons.push("DATASET_VERSION_MISSING");
  if (!present(dataset.sourceType)) reasons.push("SOURCE_TYPE_MISSING");
  if (!present(dataset.sourceName)) reasons.push("SOURCE_NAME_MISSING");
  if (!present(dataset.sourceOrganization)) reasons.push("SOURCE_ORGANIZATION_MISSING");
  if (!dataset.temporalCoverage || dataset.temporalCoverage.status !== "KNOWN") {
    reasons.push("TEMPORAL_COVERAGE_UNKNOWN");
  }
  if (
    !dataset.geographicCoverage ||
    dataset.geographicCoverage.status === "UNKNOWN_COVERAGE" ||
    dataset.geographicCoverage.scopeCompatibility === "UNKNOWN"
  ) {
    reasons.push("GEOGRAPHIC_COVERAGE_UNKNOWN");
  }
  return reasons;
}

function result(
  dataset: CrimeDatasetIdentity,
  status: CrimeDatasetAdmissionResult["status"],
  reasons: string[],
  warnings: string[] = []
): CrimeDatasetAdmissionResult {
  return {
    dataset,
    status,
    accepted: status === "ADMITTED",
    reasons,
    warnings,
    validationSummary: dataset.validationSummary ?? null,
  };
}

/** Admission authorizes dataset use as data only; it creates no evidence, finding, proof, or causal claim. */
export function evaluateCrimeDatasetAdmission(
  dataset: CrimeDatasetIdentity
): CrimeDatasetAdmissionResult {
  if (dataset.reviewDecision === "REJECTED") {
    return result(dataset, "REJECTED", ["DATASET_REJECTED_BY_REVIEW"]);
  }

  const incomplete = incompleteProvenanceReasons(dataset);
  if (incomplete.length > 0) {
    return result(dataset, "INCOMPLETE_PROVENANCE", incomplete);
  }

  if (
    dataset.geographicCoverage?.scopeCompatibility === "OUT_OF_SCOPE" ||
    dataset.geographicCoverage?.status === "OUT_OF_COVERAGE"
  ) {
    return result(dataset, "OUT_OF_SCOPE", ["DATASET_GEOGRAPHIC_SCOPE_INCOMPATIBLE"]);
  }

  const validation = dataset.validationSummary;
  if (!validation || validation.schemaValid === false || validation.status === "INVALID" || validation.status === "GEO_INVALID") {
    return result(dataset, "FAILED_VALIDATION", validation?.reasons || ["DATASET_STRUCTURE_INVALID"]);
  }

  if (dataset.reviewDecision === "PENDING_REVIEW" || validation.status === "PARTIAL") {
    return result(dataset, "PENDING_REVIEW", ["DATASET_REQUIRES_REVIEW"], validation.warnings || []);
  }

  return result(dataset, "ADMITTED", [], validation.warnings || []);
}
