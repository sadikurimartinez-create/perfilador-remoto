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

export type GeoEvidenceStatus =
  | "GENERATED"
  | "PENDING_REVIEW"
  | "APPROVED_EVIDENCE"
  | "REJECTED_FINDING";

export interface GeoEvidence {
  id: string;
  expedienteId: string;
  source: GeoEvidenceSource;
  coordinates: {
    lat: number;
    lng: number;
  };
  captureDate?: string;
  imageReference: string;
  metadata: GeoEvidenceMetadata;
  status: GeoEvidenceStatus;
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
