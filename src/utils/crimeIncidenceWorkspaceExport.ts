import type { CrimeIncidenceExportContract } from "@/types/crimeIncidenceExportContract";
import type { CrimeIncidenceAnalyticalProjection } from "@/types/crimeIncidenceAnalyticalProjection";
import type { CrimeIncidenceInstitutionalMetadata } from "@/types/crimeIncidenceGeographicResolution";
import type { CrimeIncidenceDatasetProvenance } from "@/types/crimeIncidenceWorkspace";
import { CRIME_INCIDENCE_INSTITUTIONAL_BRANDING } from "@/types/crimeIncidenceWorkspace";
import type { CrimeQueryLineage } from "@/utils/crimeIncidenceCanonicalPipeline";

export interface CrimeIncidenceInstitutionalDocumentProduct {
  exportContract: CrimeIncidenceExportContract;
  exportId: string | null;
  expedienteId: string;
  productClassification: "DESCRIPTIVE_ANALYTICAL_PRODUCT";
  analyticalLevel: "DESCRIPTIVE";
  institutionalMetadata: CrimeIncidenceInstitutionalMetadata;
  geographicReference: CrimeIncidenceAnalyticalProjection["geographicReference"];
  datasetReference: CrimeIncidenceDatasetProvenance;
  metrics: CrimeIncidenceAnalyticalProjection["metrics"];
  lineage: CrimeQueryLineage;
  limitations: string[];
  createdAtReference: string | null;
}

function assertInstitutionalContract(contract: CrimeIncidenceExportContract): void {
  const branding = CRIME_INCIDENCE_INSTITUTIONAL_BRANDING;
  if (
    contract.productClassification !== "DESCRIPTIVE_ANALYTICAL_PRODUCT" ||
    contract.analyticalLevel !== "DESCRIPTIVE" ||
    contract.projectionReference.analyticalLevel !== "DESCRIPTIVE"
  ) {
    throw new Error("CRIME_INCIDENCE_EXPORT_REQUIRES_DESCRIPTIVE_CONTRACT");
  }
  if (
    contract.institutionalMetadata.header !== branding.institutionHeader ||
    contract.institutionalMetadata.watermark !== branding.watermark ||
    contract.institutionalMetadata.footer !== branding.institutionFooter
  ) {
    throw new Error("CRIME_INCIDENCE_EXPORT_INSTITUTIONAL_METADATA_MISMATCH");
  }
  if (
    contract.projectionReference.datasetReference !== contract.datasetReference ||
    contract.projectionReference.geographicReference !== contract.geographicReference ||
    contract.projectionReference.lineage !== contract.lineage
  ) {
    throw new Error("CRIME_INCIDENCE_EXPORT_GOVERNANCE_CHAIN_MISMATCH");
  }
}

/** Prepares a renderer-neutral institutional product exclusively from the governed ADR-022.7 contract. */
export function prepareCrimeIncidenceInstitutionalExport(
  contract: CrimeIncidenceExportContract
): CrimeIncidenceInstitutionalDocumentProduct {
  assertInstitutionalContract(contract);
  return {
    exportContract: contract,
    exportId: contract.exportId,
    expedienteId: contract.expedienteId,
    productClassification: contract.productClassification,
    analyticalLevel: contract.analyticalLevel,
    institutionalMetadata: contract.institutionalMetadata,
    geographicReference: contract.geographicReference,
    datasetReference: contract.datasetReference,
    metrics: contract.projectionReference.metrics,
    lineage: contract.lineage,
    limitations: contract.limitations,
    createdAtReference: contract.createdAtReference,
  };
}
