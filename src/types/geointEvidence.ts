import {
  GeointGovernanceStatus,
  GeointGovernanceStatusValue,
} from "./geointGovernance";
import type { CanonicalLineageNode, LineageStatus } from "@/utils/evidenceLineage";

/**
 * ADR-019.13 — Fundación Arquitectónica GEOINT
 * Contratos de datos unificados para evidencias geoespaciales y comparación temporal.
 */

export type GeoEvidenceSource =
  | "FIELD_PHOTO"
  | "STREET_VIEW_AUTOMATIC"
  | "STREET_VIEW_MANUAL"
  | "STREET_VIEW_HISTORICAL";

export interface GeoEvidenceMetadata {
  heading?: number;
  pitch?: number;
  fov?: number;
  panoramaId?: string;
  investigator?: string;
  sourceProvider?:
    | "CEIPOL_FIELD"
    | "GOOGLE_STREET_VIEW"
    | "SATELLITE_ARCHIVE";
  category?: string;
  originalFindingId?: string;
}

export type GeoEvidenceStatus = GeointGovernanceStatusValue;

export { GeointGovernanceStatus };

export interface GeoEvidence {
  id: string;
  expedienteId: string;
  traceabilityId: string;
  sourceEvidenceId: string;
  source: GeoEvidenceSource;
  coordinates: {
    lat: number | null;
    lng: number | null;
  };
  captureDate?: string;
  imageReference: string;
  metadata: GeoEvidenceMetadata;
  status: GeoEvidenceStatus;
  lineage?: CanonicalLineageNode[];
  lineageStatus?: LineageStatus;
}

/**
 * Contrato de compatibilidad geoespacial devuelto por el GeoResolver.
 */
export interface GeoLocationCompatibilityResult {
  isCompatible: boolean;
  distanceMeters: number;
  reason?: string;
}

/**
 * Contrato de comparación temporal entre dos evidencias universales GeoEvidence.
 */
export interface UniversalGeoEvidenceComparison {
  comparisonId: string;
  expedienteId: string;
  evidenceA: GeoEvidence;
  evidenceB: GeoEvidence;
  distanceMeters: number;
  isSameLocation: boolean;
  temporalDeltaDays?: number;
  temporalDeltaFormatted?: string;
  createdBy: string;
  createdAt: string;
  status: GeoEvidenceStatus;
  validationComment?: string;
}
