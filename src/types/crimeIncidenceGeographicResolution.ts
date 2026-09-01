import type { CrimeIncidenceQueryResolution } from "@/types/crimeIncidenceQueryGovernance";
import {
  CRIME_INCIDENCE_INSTITUTIONAL_BRANDING,
  type CanonicalCrimeIncident,
  type CrimeIncidenceDatasetProvenance,
  type CrimeIncidenceQueryGeometry,
} from "@/types/crimeIncidenceWorkspace";
import type { CrimeCoverageStatus, CrimeQueryLineage } from "@/utils/crimeIncidenceCanonicalPipeline";
import type { CanonicalGeographySource } from "@/utils/canonicalProjectGeography";

type PointRadiusGeometry = Extract<CrimeIncidenceQueryGeometry, { mode: "POINT_RADIUS" }>;
type CorridorCoverageGeometry = Extract<CrimeIncidenceQueryGeometry, { mode: "CORRIDOR_COVERAGE" }>;
type PolygonBoundaryGeometry = Extract<CrimeIncidenceQueryGeometry, { mode: "POLYGON_BOUNDARY" }>;

interface CrimeExpedientGeographyBase {
  expedienteId: string;
  source: CanonicalGeographySource;
  createdBy: string;
}

export type CrimeExpedientGeographyContext =
  | (CrimeExpedientGeographyBase & {
      geographyType: "INDIVIDUAL";
      point: PointRadiusGeometry;
      corridor?: never;
      polygon?: never;
    })
  | (CrimeExpedientGeographyBase & {
      geographyType: "CORRIDOR";
      point?: never;
      corridor: CorridorCoverageGeometry;
      polygon?: never;
    })
  | (CrimeExpedientGeographyBase & {
      geographyType: "POLYGON";
      point?: never;
      corridor?: never;
      polygon: PolygonBoundaryGeometry;
    });

export interface CrimeIncidenceInstitutionalMetadata {
  watermark: typeof CRIME_INCIDENCE_INSTITUTIONAL_BRANDING.watermark;
  header: typeof CRIME_INCIDENCE_INSTITUTIONAL_BRANDING.institutionHeader;
  footer: typeof CRIME_INCIDENCE_INSTITUTIONAL_BRANDING.institutionFooter;
}

/** Geographic resolution preserves territorial authority and classifies records only as queried data. */
export interface CrimeIncidenceGeographicResolution {
  geometryType: CrimeIncidenceQueryGeometry["mode"];
  geometry: CrimeIncidenceQueryGeometry;
  coverageStatus: CrimeCoverageStatus;
  matchedRecords: CanonicalCrimeIncident[];
  excludedRecords: CanonicalCrimeIncident[];
  coverageExplanation: string;
  lineage: CrimeQueryLineage;
  expedientGeography: CrimeExpedientGeographyContext;
  queryResolution: CrimeIncidenceQueryResolution;
  datasetProvenance: CrimeIncidenceDatasetProvenance;
  institutionalMetadata: CrimeIncidenceInstitutionalMetadata;
}
