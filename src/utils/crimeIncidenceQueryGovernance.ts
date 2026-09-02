import type {
  CrimeIncidenceQueryRequest,
  CrimeIncidenceQueryResolution,
  CrimeIncidenceQueryResolutionStatus,
} from "@/types/crimeIncidenceQueryGovernance";
import { evaluateCrimeDatasetAdmission } from "@/utils/crimeDatasetAdmissionGate";

const DATA_ONLY_LIMITATION = "QUERY_RESULTS_ARE_DATA_NOT_EVIDENCE_FINDINGS_CAUSALITY_OR_CONCLUSIONS";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Resolves governance over an already obtained canonical query envelope without performing I/O. */
export function resolveCrimeIncidenceQuery(
  request: CrimeIncidenceQueryRequest
): CrimeIncidenceQueryResolution {
  const admission = evaluateCrimeDatasetAdmission(request.datasetIdentity);
  const envelope = request.sourceEnvelope;
  let status: CrimeIncidenceQueryResolutionStatus = "EXECUTED";
  const limitations = [DATA_ONLY_LIMITATION];

  if (!admission.accepted) {
    status = "REJECTED";
    limitations.push("DATASET_NOT_ADMITTED");
  } else if (
    envelope.sourceStatus === "OUT_OF_COVERAGE" ||
    envelope.coverageStatus === "OUT_OF_COVERAGE"
  ) {
    status = "NO_COVERAGE";
    limitations.push("QUERY_OUT_OF_COVERAGE_IS_NOT_CONFIRMED_ABSENCE");
  } else if (envelope.sourceStatus === "FAILED" || envelope.sourceStatus === "NOT_CONFIGURED") {
    status = "REJECTED";
    limitations.push("QUERY_SOURCE_UNAVAILABLE");
  }

  const executed = status === "EXECUTED";
  const coverageWarning = status === "NO_COVERAGE"
    ? ["OUT_OF_COVERAGE_IS_NOT_CONFIRMED_ABSENCE"]
    : [];

  return {
    status,
    executed,
    request,
    datasetIdentity: request.datasetIdentity,
    admission,
    resolvedIncidents: executed ? envelope.records : [],
    coverage: {
      queryStatus: envelope.coverageStatus,
      datasetCoverage: envelope.dataset.coverage,
    },
    lineage: envelope.lineage,
    datasetProvenance: envelope.dataset,
    warnings: unique([...admission.warnings, ...envelope.warnings, ...coverageWarning]),
    limitations: unique([...limitations, ...admission.reasons]),
    errors: [...envelope.errors],
  };
}
