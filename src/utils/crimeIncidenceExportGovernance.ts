import type { CrimeIncidenceAnalyticalProjection } from "@/types/crimeIncidenceAnalyticalProjection";
import type { CrimeIncidenceExportContract } from "@/types/crimeIncidenceExportContract";
import type { CrimeIncidenceInstitutionalMetadata } from "@/types/crimeIncidenceGeographicResolution";

const INSTITUTIONAL_FIREWALL =
  "DESCRIPTIVE_ANALYTICAL_PRODUCT_IS_NOT_EVIDENCE_PROOF_FINDING_ATTRIBUTION_OR_CRIMINOLOGICAL_PROFILE";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Creates a traceable delivery contract without rendering files or generating identity or time. */
export function createCrimeIncidenceExportContract(
  projection: CrimeIncidenceAnalyticalProjection,
  metadata: CrimeIncidenceInstitutionalMetadata
): CrimeIncidenceExportContract {
  const query = projection.sourceQuery;
  const requestProvenance = query.request.requestProvenance;

  return {
    exportId: requestProvenance.operationId ?? requestProvenance.requestReference ?? null,
    expedienteId: projection.geographicReference.expediente.expedienteId,
    projectionReference: projection,
    datasetReference: projection.datasetReference,
    queryReference: query,
    geographicReference: projection.geographicReference,
    analyticalLevel: projection.analyticalLevel,
    createdAtReference:
      query.datasetIdentity.ingestedAt ??
      query.datasetIdentity.createdAt ??
      projection.datasetReference.ingestedAt ??
      null,
    lineage: projection.lineage,
    limitations: unique([...projection.limitations, INSTITUTIONAL_FIREWALL]),
    institutionalMetadata: metadata,
    productClassification: "DESCRIPTIVE_ANALYTICAL_PRODUCT",
  };
}
