import type { CrimeIncidenceAnalyticalProjection } from "@/types/crimeIncidenceAnalyticalProjection";
import type { CrimeIncidenceInstitutionalMetadata } from "@/types/crimeIncidenceGeographicResolution";
import type { CrimeIncidenceQueryResolution } from "@/types/crimeIncidenceQueryGovernance";
import type { CrimeIncidenceDatasetProvenance } from "@/types/crimeIncidenceWorkspace";
import type { CrimeQueryLineage } from "@/utils/crimeIncidenceCanonicalPipeline";

/** Institutional delivery contract for a descriptive analytical product, without evidentiary status. */
export interface CrimeIncidenceExportContract {
  exportId: string | null;
  expedienteId: string;
  projectionReference: CrimeIncidenceAnalyticalProjection;
  datasetReference: CrimeIncidenceDatasetProvenance;
  queryReference: CrimeIncidenceQueryResolution;
  geographicReference: CrimeIncidenceAnalyticalProjection["geographicReference"];
  analyticalLevel: "DESCRIPTIVE";
  createdAtReference: string | null;
  lineage: CrimeQueryLineage;
  limitations: string[];
  institutionalMetadata: CrimeIncidenceInstitutionalMetadata;
  productClassification: "DESCRIPTIVE_ANALYTICAL_PRODUCT";
}
