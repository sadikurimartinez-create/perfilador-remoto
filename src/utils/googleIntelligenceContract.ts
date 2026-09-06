import type {
  AcquisitionMode,
  EpistemicIntegrityMetadata,
  EpistemicValidationStatus,
  IntelligenceSemanticRole,
} from "@/types/epistemicIntegrity";
import { validateLineage, type CanonicalLineageNode, type LineageStatus } from "@/utils/evidenceLineage";
import { evaluateHumanValidation } from "@/utils/humanValidationPolicy";
import type { InstitutionalCorrelationItem } from "@/lib/geoint/multiSourceCorrelationEngine";

export type GoogleProviderId =
  | "GOOGLE_MAPS"
  | "GOOGLE_STREET_VIEW"
  | "GOOGLE_PLACES"
  | "GOOGLE_VISION"
  | "GOOGLE_ROUTES"
  | "GOOGLE_ELEVATION"
  | "GOOGLE_GEOCODING"
  | "GOOGLE_DRIVE"
  | "GOOGLE_VERTEX_AI";

export type GoogleProviderFeature =
  | "STREET_VIEW_STATIC"
  | "STREET_VIEW_METADATA"
  | "STREET_VIEW_PANORAMA"
  | "PLACES_NEARBY"
  | "PLACES_DETAILS"
  | "VISION_LABEL"
  | "VISION_OCR"
  | "VISION_OBJECT"
  | "ROUTES"
  | "ROUTES_MATRIX"
  | "ELEVATION"
  | "GEOCODING"
  | "REVERSE_GEOCODING";

export type GoogleVisionApiFeature =
  | "LABEL_DETECTION"
  | "TEXT_DETECTION"
  | "DOCUMENT_TEXT_DETECTION"
  | "OBJECT_LOCALIZATION"
  | "LANDMARK_DETECTION"
  | "LOGO_DETECTION"
  | "WEB_DETECTION"
  | "IMAGE_PROPERTIES"
  | "SAFE_SEARCH_DETECTION"
  | "FACE_DETECTION";

export type GoogleVisionFeatureStatus = "ACTIVA" | "PARCIAL" | "LEGACY" | "NO_USADA";

export type GoogleVisionObservationKind =
  | "VISIBLE_TEXT"
  | "SIGNAGE"
  | "PHYSICAL_BARRIER"
  | "ACCESS_POINT"
  | "GATE"
  | "FENCE"
  | "ROAD"
  | "VEHICLE"
  | "BUILDING"
  | "VISIBLE_OBJECT"
  | "INFRASTRUCTURE"
  | "LIGHTING_ELEMENT"
  | "SURFACE_CONDITION"
  | "VEGETATION"
  | "PERSON_PRESENT"
  | "UNVERIFIED_VISUAL_CLASSIFICATION"
  | "WEB_CONTEXT_REFERENCE";

export interface GoogleVisionFeatureAuditEntry {
  feature: GoogleVisionApiFeature;
  status: GoogleVisionFeatureStatus;
  institutionalUse: string;
  enabledByDefault: boolean;
}

export interface GoogleVisionTextDetection {
  text: string;
  confidence?: number | null;
  language?: string | null;
  boundingGeometry?: unknown;
}

export interface GoogleVisionObjectDetection {
  name: string;
  score?: number | null;
  boundingGeometry?: unknown;
}

export interface GoogleVisionLabelDetection {
  description: string;
  score?: number | null;
  topicality?: number | null;
}

export interface GoogleVisionObservation {
  detectionId: string;
  feature: Extract<GoogleVisionApiFeature, "TEXT_DETECTION" | "LABEL_DETECTION" | "OBJECT_LOCALIZATION">;
  kind: GoogleVisionObservationKind;
  value: string;
  confidence: number | "UNKNOWN" | "UNAVAILABLE";
  boundingGeometry?: unknown;
  language?: string | null;
  evidence: GoogleIntelligenceEvidence;
}

export interface GoogleVisionSourceContext {
  sourceEvidenceId: string;
  traceabilityId: string;
  expedienteId: string;
  geographyId: string;
  imageReference: string;
  lineage: CanonicalLineageNode[];
  acquiredAt: string;
  observedAt?: string | null;
  coordinates?: GoogleCoordinates | null;
  imageSourceType?: "IN_SITU" | "STREET_VIEW" | "UPLOADED_EVIDENCE" | "DRIVE_GOVERNED";
  captureDate?: string | null;
}

export interface GoogleVisionFindingDerivationResult {
  observations: GoogleVisionObservation[];
  evidences: GoogleIntelligenceEvidence[];
  candidateFindings: GoogleCandidateFinding[];
  featureAudit: GoogleVisionFeatureAuditEntry[];
}

export interface GoogleVisionPoiComparisonSource {
  sourceId: string;
  providerId: "GOOGLE_PLACES" | "INEGI_DENUE";
  name?: string | null;
  activity?: string | null;
  coordinates?: GoogleCoordinates | null;
  sourceReference: string;
}

export const GOOGLE_VISION_FEATURE_AUDIT: GoogleVisionFeatureAuditEntry[] = [
  {
    feature: "LABEL_DETECTION",
    status: "ACTIVA",
    institutionalUse: "Clasificacion ML ambiental no criminologica; apoya indicadores visibles cuando hay sustento.",
    enabledByDefault: true,
  },
  {
    feature: "TEXT_DETECTION",
    status: "ACTIVA",
    institutionalUse: "OCR de texto visible como observacion ML, no como verdad semantica del contenido.",
    enabledByDefault: true,
  },
  {
    feature: "DOCUMENT_TEXT_DETECTION",
    status: "NO_USADA",
    institutionalUse: "Bajo valor para imagen territorial general; no se activa para controlar costo.",
    enabledByDefault: false,
  },
  {
    feature: "OBJECT_LOCALIZATION",
    status: "ACTIVA",
    institutionalUse: "Objetos fisicos localizados con score y geometria cuando Vision los devuelve.",
    enabledByDefault: true,
  },
  {
    feature: "LANDMARK_DETECTION",
    status: "NO_USADA",
    institutionalUse: "No hay caso gobernado actual que justifique activacion por defecto.",
    enabledByDefault: false,
  },
  {
    feature: "LOGO_DETECTION",
    status: "NO_USADA",
    institutionalUse: "Puede ser util para corroboracion POI futura, pero no se activa sin caso especifico.",
    enabledByDefault: false,
  },
  {
    feature: "WEB_DETECTION",
    status: "NO_USADA",
    institutionalUse: "Coincidencias web serian contexto de tercero no autoritativo; no se activa por costo y riesgo.",
    enabledByDefault: false,
  },
  {
    feature: "IMAGE_PROPERTIES",
    status: "NO_USADA",
    institutionalUse: "No aporta observaciones territoriales trazables suficientes para ADR-025.3C.",
    enabledByDefault: false,
  },
  {
    feature: "SAFE_SEARCH_DETECTION",
    status: "NO_USADA",
    institutionalUse: "Clasificacion tecnica de contenido; nunca indicador criminologico.",
    enabledByDefault: false,
  },
  {
    feature: "FACE_DETECTION",
    status: "LEGACY",
    institutionalUse: "Flujo historico aislado; no identifica personas ni se usa como indicador criminologico.",
    enabledByDefault: false,
  },
];

export type GoogleCandidateType =
  | "POTENTIAL_CONCEALMENT_AREA"
  | "POTENTIAL_SURVEILLANCE_POINT"
  | "POTENTIAL_AMBUSH_POINT"
  | "LIMITED_VISIBILITY_AREA"
  | "SECONDARY_ACCESS"
  | "ESCAPE_ROUTE_CANDIDATE"
  | "ACCESS_CONTROL_POINT"
  | "VISUAL_OBSTRUCTION"
  | "TACTICAL_OBSERVATION_POINT"
  | "ACTIVITY_ATTRACTOR"
  | "SERVICE_NODE"
  | "HIGH_ACTIVITY_POI"
  | "TEMPORAL_ACTIVITY_NODE"
  | "FUNCTIONAL_CLUSTER"
  | "OPERATIONAL_HOURS_INCONSISTENCY"
  | "POI_SOURCE_CORROBORATION"
  | "POI_CLASSIFICATION_INCONSISTENCY"
  | "POI_EXISTENCE_MISMATCH"
  | "PHYSICAL_OPERATIONAL_STATUS_INCONSISTENCY"
  | "SERVICE_CONCENTRATION"
  | "VISIBLE_TEXT_INDICATOR"
  | "SIGNAGE_INDICATOR"
  | "INFRASTRUCTURE_INDICATOR"
  | "PHYSICAL_BARRIER_INDICATOR"
  | "VISIBLE_OBJECT_INDICATOR"
  | "ACCESSIBILITY_CORRIDOR"
  | "ALTERNATIVE_ROUTE_CANDIDATE"
  | "CONNECTIVITY_NODE"
  | "BOTTLENECK_CANDIDATE"
  | "APPROACH_ROUTE_CANDIDATE"
  | "SLOPE_INDICATOR"
  | "ELEVATION_DIFFERENCE"
  | "TOPOGRAPHIC_BARRIER_CANDIDATE"
  | "POTENTIAL_ELEVATION_ADVANTAGE";

export interface GoogleCoordinates {
  lat: number;
  lng: number;
}

export interface GoogleStreetViewMetadata {
  panoId?: string | null;
  panoramaId?: string | null;
  panoramaLat?: number | null;
  panoramaLng?: number | null;
  heading?: number | null;
  pitch?: number | null;
  fov?: number | null;
  captureDate?: string | null;
  imageReference?: string | null;
}

export interface GoogleIntelligenceEvidence {
  evidenceId: string;
  sourceEvidenceId: string;
  traceabilityId: string;
  expedienteId: string;
  geographyId: string;
  providerId: GoogleProviderId;
  providerFeature: GoogleProviderFeature;
  acquisitionMode: AcquisitionMode;
  semanticRole: IntelligenceSemanticRole;
  validationStatus: EpistemicValidationStatus;
  coordinates?: GoogleCoordinates | null;
  observedAt?: string | null;
  acquiredAt?: string | null;
  rawResponseRef?: string | null;
  sourceReferences: string[];
  observableFacts: string[];
  limitations: string[];
  lineage: CanonicalLineageNode[];
  lineageStatus: LineageStatus;
  generatedAt: string;
  metadata?: {
    streetView?: GoogleStreetViewMetadata;
    [key: string]: unknown;
  };
}

export interface GoogleCandidateFinding {
  findingId: string;
  candidateType: GoogleCandidateType;
  providerId: GoogleProviderId;
  providerFeature: GoogleProviderFeature;
  sourceEvidenceId: string;
  traceabilityId: string;
  expedienteId: string;
  geographyId: string;
  coordinates?: GoogleCoordinates | null;
  explanation: string;
  observableFactors: string[];
  supportingEvidenceIds: string[];
  sourceReferences: string[];
  confidence: number | "UNKNOWN" | "UNAVAILABLE";
  confidenceBasis: string;
  limitations: string[];
  lineage: CanonicalLineageNode[];
  lineageStatus: LineageStatus;
  validationStatus: EpistemicValidationStatus;
  acquisitionMode: "DERIVED";
  semanticRole: Extract<IntelligenceSemanticRole, "INFERENCE" | "ANALYTICAL_SUGGESTION">;
  generatedBy: string;
  generatedAt: string;
  eligibleForCorrelation: boolean;
  metadata?: {
    sourceEvidence?: GoogleIntelligenceEvidence;
    [key: string]: unknown;
  };
}

export interface GoogleCorrelationAdapterResult {
  item: InstitutionalCorrelationItem | null;
  blockingReasons: string[];
}

export type StreetViewObservableFactor =
  | "visual obstruction"
  | "physical cover"
  | "setback"
  | "enclosure"
  | "secondary access"
  | "visual dominance"
  | "broad field of view"
  | "low exposure"
  | "access corridor proximity"
  | "curvature"
  | "wall"
  | "vegetation"
  | "narrow field"
  | "alternate ingress egress"
  | "access control"
  | "barrier"
  | "intersection"
  | "graffiti"
  | "alley"
  | "vehicle"
  | "bar"
  | "person"
  | "deteriorated housing"
  | "street view panorama available"
  | "canonical geography bounded"
  | "captured heading pitch fov";

const STREET_VIEW_FACTOR_MATRIX: Partial<Record<GoogleCandidateType, StreetViewObservableFactor[]>> = {
  POTENTIAL_CONCEALMENT_AREA: ["visual obstruction", "physical cover", "setback", "enclosure", "secondary access"],
  POTENTIAL_SURVEILLANCE_POINT: ["visual dominance", "broad field of view", "low exposure", "access corridor proximity"],
  POTENTIAL_AMBUSH_POINT: ["narrow field", "curvature", "wall", "secondary access", "low exposure"],
  LIMITED_VISIBILITY_AREA: ["visual obstruction", "curvature", "wall", "vegetation", "enclosure", "narrow field"],
  SECONDARY_ACCESS: ["secondary access", "alternate ingress egress"],
  ESCAPE_ROUTE_CANDIDATE: ["secondary access", "alternate ingress egress", "access corridor proximity"],
  ACCESS_CONTROL_POINT: ["access control", "barrier", "wall"],
  VISUAL_OBSTRUCTION: ["visual obstruction", "vegetation", "wall", "barrier"],
  TACTICAL_OBSERVATION_POINT: ["street view panorama available", "canonical geography bounded", "captured heading pitch fov"],
};

function normalizeFactor(value: unknown): StreetViewObservableFactor | null {
  const normalized = String(value || "").trim().toLowerCase();
  return ([
    "visual obstruction",
    "physical cover",
    "setback",
    "enclosure",
    "secondary access",
    "visual dominance",
    "broad field of view",
    "low exposure",
    "access corridor proximity",
    "curvature",
    "wall",
    "vegetation",
    "narrow field",
    "alternate ingress egress",
    "access control",
    "barrier",
    "intersection",
    "graffiti",
    "alley",
    "vehicle",
    "bar",
    "person",
    "deteriorated housing",
    "street view panorama available",
    "canonical geography bounded",
    "captured heading pitch fov",
  ] as StreetViewObservableFactor[]).find((factor) => factor === normalized) || null;
}

export function normalizeStreetViewObservableFactors(values: unknown[]): StreetViewObservableFactor[] {
  return Array.from(new Set(values.map(normalizeFactor).filter((value): value is StreetViewObservableFactor => Boolean(value))));
}

export function resolveStreetViewCandidateType(input: {
  observableFactors: unknown[];
  preferredCandidateType?: GoogleCandidateType | null;
}): {
  candidateType: GoogleCandidateType;
  matchedFactors: StreetViewObservableFactor[];
  isStrongCandidate: boolean;
  downgradeReason?: string;
} {
  const factors = normalizeStreetViewObservableFactors(input.observableFactors);
  const preferred = input.preferredCandidateType || null;
  const minFactorsForStrongCandidate = 2;

  if (preferred && preferred !== "TACTICAL_OBSERVATION_POINT") {
    const required = STREET_VIEW_FACTOR_MATRIX[preferred] || [];
    const matched = factors.filter((factor) => required.includes(factor));
    if (matched.length >= minFactorsForStrongCandidate) {
      return { candidateType: preferred, matchedFactors: matched, isStrongCandidate: true };
    }
    return {
      candidateType: "TACTICAL_OBSERVATION_POINT",
      matchedFactors: factors,
      isStrongCandidate: false,
      downgradeReason: `INSUFFICIENT_OBSERVABLE_FACTORS_FOR_${preferred}`,
    };
  }

  const priority: GoogleCandidateType[] = [
    "POTENTIAL_CONCEALMENT_AREA",
    "POTENTIAL_SURVEILLANCE_POINT",
    "POTENTIAL_AMBUSH_POINT",
    "LIMITED_VISIBILITY_AREA",
    "ESCAPE_ROUTE_CANDIDATE",
    "SECONDARY_ACCESS",
    "ACCESS_CONTROL_POINT",
    "VISUAL_OBSTRUCTION",
  ];

  for (const candidateType of priority) {
    const required = STREET_VIEW_FACTOR_MATRIX[candidateType] || [];
    const matched = factors.filter((factor) => required.includes(factor));
    if (matched.length >= minFactorsForStrongCandidate) {
      return { candidateType, matchedFactors: matched, isStrongCandidate: true };
    }
  }

  return {
    candidateType: "TACTICAL_OBSERVATION_POINT",
    matchedFactors: factors,
    isStrongCandidate: false,
    downgradeReason: factors.length > 0 ? "NO_STRONG_STREET_VIEW_MATRIX_MATCH" : "NO_OBSERVABLE_FACTORS",
  };
}

export function calculateStreetViewCandidateConfidence(input: {
  observableFactors: unknown[];
  hasPanoramaId?: boolean;
  hasCoordinates?: boolean;
  hasLineage?: boolean;
  captureDate?: string | null;
  spatialDistanceMeters?: number | null;
}): { confidence: number | "UNKNOWN"; confidenceBasis: string; limitations: string[] } {
  const factors = normalizeStreetViewObservableFactors(input.observableFactors);
  if (factors.length === 0) {
    return {
      confidence: "UNKNOWN",
      confidenceBasis: "No hay factores observables suficientes para calcular confianza.",
      limitations: ["No se generan inferencias fuertes sin factores visibles o metadatos verificables."],
    };
  }

  let score = Math.min(0.45 + factors.length * 0.08, 0.78);
  const basis: string[] = [`${factors.length} factor(es) observable(s)`];
  const limitations: string[] = ["La imagen Street View no acredita conducta criminal ni uso humano actual."];

  if (input.hasPanoramaId) {
    score += 0.04;
    basis.push("panoId disponible");
  } else {
    limitations.push("No se conserva panoId de Google Street View.");
  }

  if (input.hasCoordinates) {
    score += 0.04;
    basis.push("coordenadas conservadas");
  }

  if (input.hasLineage) {
    score += 0.04;
    basis.push("lineage canónico presente");
  }

  if (typeof input.spatialDistanceMeters === "number") {
    basis.push(`distancia de muestreo ${input.spatialDistanceMeters.toFixed(1)}m`);
    if (input.spatialDistanceMeters > 50) limitations.push("La captura es contextual respecto al centro; no debe tratarse como evidencia directa de punto.");
  }

  if (input.captureDate) {
    basis.push(`fecha Street View ${input.captureDate}`);
    const parsedYear = Number(String(input.captureDate).slice(0, 4));
    const currentYear = new Date().getFullYear();
    if (Number.isFinite(parsedYear) && currentYear - parsedYear >= 2) {
      limitations.push(`La imagen Street View es historica (${input.captureDate}); no acredita situacion actual sin verificacion de campo.`);
    }
  } else {
    limitations.push("Fecha Street View no disponible.");
  }

  return {
    confidence: Number(Math.min(score, 0.9).toFixed(2)),
    confidenceBasis: basis.join("; "),
    limitations,
  };
}

export function buildStreetViewCandidateExplanation(input: {
  candidateType: GoogleCandidateType;
  observableFactors: unknown[];
  downgradeReason?: string;
}): string {
  const factors = normalizeStreetViewObservableFactors(input.observableFactors);
  const factorText = factors.length > 0 ? factors.join(", ") : "sin factores suficientes";
  const downgradeText = input.downgradeReason
    ? ` La clasificacion se conserva como observacion tactica por ${input.downgradeReason}.`
    : "";
  return (
    `Se registran factores observables de Street View: ${factorText}. ` +
    `La combinacion es compatible con ${input.candidateType} en sentido analitico preliminar.${downgradeText} ` +
    "La imagen no acredita pertenencia a pandilla, conducta criminal, acecho real, emboscada real ni punto de venta."
  );
}

export function isStreetViewSampleWithinCanonicalGeography(input: {
  center: GoogleCoordinates;
  sample: GoogleCoordinates;
  radiusMeters: number;
  geographyType?: "INDIVIDUAL" | "CORRIDOR" | "POLYGON" | "MULTIPOLYGON" | null;
}): boolean {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMeters = 6371e3;
  const dLat = toRad(input.sample.lat - input.center.lat);
  const dLng = toRad(input.sample.lng - input.center.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(input.center.lat)) *
      Math.cos(toRad(input.sample.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const distanceMeters = earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const tolerance = input.geographyType === "INDIVIDUAL" ? Math.max(input.radiusMeters, 50) : input.radiusMeters;
  return distanceMeters <= tolerance;
}

function present(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => present(value)).filter((value): value is string => Boolean(value))));
}

function resolveCoordinates(input: any): GoogleCoordinates | null {
  const rawLat = input?.coordinates?.lat ?? input?.coordenadas?.lat ?? input?.lat ?? input?.geometry?.lat;
  const rawLng = input?.coordinates?.lng ?? input?.coordenadas?.lng ?? input?.lng ?? input?.geometry?.lng;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function assertString(name: string, value: unknown): string {
  const resolved = present(value);
  if (!resolved) throw new Error(`GOOGLE_CONTRACT_MISSING_${name.toUpperCase()}`);
  return resolved;
}

function assertNonEmptyArray(name: string, values: string[]): string[] {
  const resolved = nonEmpty(values);
  if (resolved.length === 0) throw new Error(`GOOGLE_CONTRACT_MISSING_${name.toUpperCase()}`);
  return resolved;
}

function normalizedLineage(nodes: CanonicalLineageNode[] | null | undefined): {
  lineage: CanonicalLineageNode[];
  lineageStatus: LineageStatus;
} {
  const lineage = Array.isArray(nodes) ? nodes : [];
  return { lineage, lineageStatus: validateLineage(lineage).status };
}

export function createGoogleIntelligenceEvidence(input: {
  evidenceId: string;
  sourceEvidenceId: string;
  traceabilityId: string;
  expedienteId: string;
  geographyId: string;
  providerId: GoogleProviderId;
  providerFeature: GoogleProviderFeature;
  coordinates?: GoogleCoordinates | null;
  observedAt?: string | null;
  acquiredAt?: string | null;
  rawResponseRef?: string | null;
  sourceReferences: string[];
  observableFacts: string[];
  limitations: string[];
  lineage: CanonicalLineageNode[];
  validationStatus?: EpistemicValidationStatus;
  generatedAt?: string;
  metadata?: GoogleIntelligenceEvidence["metadata"];
}): GoogleIntelligenceEvidence {
  const lineageInfo = normalizedLineage(input.lineage);
  return {
    evidenceId: assertString("evidenceId", input.evidenceId),
    sourceEvidenceId: assertString("sourceEvidenceId", input.sourceEvidenceId),
    traceabilityId: assertString("traceabilityId", input.traceabilityId),
    expedienteId: assertString("expedienteId", input.expedienteId),
    geographyId: assertString("geographyId", input.geographyId),
    providerId: input.providerId,
    providerFeature: input.providerFeature,
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    validationStatus: input.validationStatus || "UNREVIEWED",
    coordinates: input.coordinates ?? null,
    observedAt: input.observedAt ?? null,
    acquiredAt: input.acquiredAt ?? new Date().toISOString(),
    rawResponseRef: input.rawResponseRef ?? null,
    sourceReferences: assertNonEmptyArray("sourceReferences", input.sourceReferences),
    observableFacts: assertNonEmptyArray("observableFacts", input.observableFacts),
    limitations: assertNonEmptyArray("limitations", input.limitations),
    lineage: lineageInfo.lineage,
    lineageStatus: lineageInfo.lineageStatus,
    generatedAt: input.generatedAt || new Date().toISOString(),
    metadata: input.metadata,
  };
}

export function createGoogleCandidateFinding(input: {
  findingId: string;
  candidateType: GoogleCandidateType;
  providerId: GoogleProviderId;
  providerFeature: GoogleProviderFeature;
  sourceEvidenceId: string;
  traceabilityId: string;
  expedienteId: string;
  geographyId: string;
  coordinates?: GoogleCoordinates | null;
  explanation: string;
  observableFactors: string[];
  supportingEvidenceIds: string[];
  sourceReferences: string[];
  confidence: number | "UNKNOWN" | "UNAVAILABLE";
  confidenceBasis: string;
  limitations: string[];
  lineage: CanonicalLineageNode[];
  validationStatus?: EpistemicValidationStatus;
  generatedBy: string;
  generatedAt?: string;
  metadata?: GoogleCandidateFinding["metadata"];
}): GoogleCandidateFinding {
  const lineageInfo = normalizedLineage(input.lineage);
  return {
    findingId: assertString("findingId", input.findingId),
    candidateType: input.candidateType,
    providerId: input.providerId,
    providerFeature: input.providerFeature,
    sourceEvidenceId: assertString("sourceEvidenceId", input.sourceEvidenceId),
    traceabilityId: assertString("traceabilityId", input.traceabilityId),
    expedienteId: assertString("expedienteId", input.expedienteId),
    geographyId: assertString("geographyId", input.geographyId),
    coordinates: input.coordinates ?? null,
    explanation: assertString("explanation", input.explanation),
    observableFactors: assertNonEmptyArray("observableFactors", input.observableFactors),
    supportingEvidenceIds: assertNonEmptyArray("supportingEvidenceIds", input.supportingEvidenceIds),
    sourceReferences: assertNonEmptyArray("sourceReferences", input.sourceReferences),
    confidence: input.confidence,
    confidenceBasis: assertString("confidenceBasis", input.confidenceBasis),
    limitations: assertNonEmptyArray("limitations", input.limitations),
    lineage: lineageInfo.lineage,
    lineageStatus: lineageInfo.lineageStatus,
    validationStatus: input.validationStatus || "PENDING_REVIEW",
    acquisitionMode: "DERIVED",
    semanticRole: "ANALYTICAL_SUGGESTION",
    generatedBy: assertString("generatedBy", input.generatedBy),
    generatedAt: input.generatedAt || new Date().toISOString(),
    eligibleForCorrelation: false,
    metadata: input.metadata,
  };
}

export function adaptStreetViewToGoogleEvidence(input: any): GoogleIntelligenceEvidence {
  const sourceEvidenceId = assertString(
    "sourceEvidenceId",
    input?.sourceEvidenceId ?? input?.evidenceId ?? input?.evidenciaId ?? input?.captureId ?? input?.id
  );
  const evidenceId = present(input?.evidenceId) || sourceEvidenceId;
  const coordinates = resolveCoordinates(input);
  const streetView = input?.streetViewMetadata || input?.metadata?.streetView || input?.metadata || {};
  const panoId = present(input?.panoId) || present(streetView?.panoId) || present(streetView?.panoramaId);
  const heading = input?.heading ?? input?.geometry?.heading ?? streetView?.heading;
  const pitch = input?.pitch ?? input?.geometry?.pitch ?? streetView?.pitch;
  const fov = input?.fov ?? input?.geometry?.fov ?? streetView?.fov;
  const captureDate = present(input?.captureDate) || present(streetView?.captureDate);
  const imageReference = present(input?.imagen) || present(input?.imageReference) || present(input?.file_url) || present(input?.previewUrl);
  const sourceReferences = nonEmpty([
    panoId ? `pano:${panoId}` : null,
    captureDate ? `streetview-date:${captureDate}` : null,
    imageReference,
    "Google Street View",
  ]);

  return createGoogleIntelligenceEvidence({
    evidenceId,
    sourceEvidenceId,
    traceabilityId: assertString("traceabilityId", input?.traceabilityId),
    expedienteId: assertString("expedienteId", input?.expedienteId ?? input?.projectId),
    geographyId: assertString("geographyId", input?.geographyId),
    providerId: "GOOGLE_STREET_VIEW",
    providerFeature: panoId ? "STREET_VIEW_PANORAMA" : "STREET_VIEW_STATIC",
    coordinates,
    observedAt: captureDate ?? input?.observedAt ?? null,
    acquiredAt: input?.acquiredAt ?? input?.fechaCreacion ?? input?.createdAt ?? null,
    rawResponseRef: panoId ? `google-streetview:pano:${panoId}` : imageReference,
    sourceReferences,
    observableFacts: nonEmpty([
      coordinates ? `coordinates:${coordinates.lat},${coordinates.lng}` : null,
      panoId ? `panoId:${panoId}` : null,
      heading != null ? `heading:${heading}` : null,
      pitch != null ? `pitch:${pitch}` : null,
      fov != null ? `fov:${fov}` : null,
      captureDate ? `captureDate:${captureDate}` : null,
    ]),
    limitations: nonEmpty([
      "Google Street View imagery is remote visual context, not proof of criminal use.",
      captureDate ? `Image capture date: ${captureDate}.` : "Street View capture date may be unavailable.",
    ]),
    lineage: input?.lineage || [],
    validationStatus: input?.validationStatus || input?.humanValidationStatus || "UNREVIEWED",
    metadata: {
      streetView: {
        panoId,
        panoramaId: panoId,
        panoramaLat: input?.panoramaLat ?? streetView?.panoramaLat ?? coordinates?.lat ?? null,
        panoramaLng: input?.panoramaLng ?? streetView?.panoramaLng ?? coordinates?.lng ?? null,
        heading: heading ?? null,
        pitch: pitch ?? null,
        fov: fov ?? null,
        captureDate,
        imageReference,
      },
    },
  });
}

export function deriveStreetViewGoogleCandidateFinding(input: {
  evidence: GoogleIntelligenceEvidence;
  findingId: string;
  candidateType?: Extract<
    GoogleCandidateType,
    | "POTENTIAL_CONCEALMENT_AREA"
    | "POTENTIAL_SURVEILLANCE_POINT"
    | "POTENTIAL_AMBUSH_POINT"
    | "LIMITED_VISIBILITY_AREA"
    | "SECONDARY_ACCESS"
    | "ESCAPE_ROUTE_CANDIDATE"
    | "ACCESS_CONTROL_POINT"
    | "VISUAL_OBSTRUCTION"
    | "TACTICAL_OBSERVATION_POINT"
  >;
  explanation: string;
  observableFactors: string[];
  confidence?: number | "UNKNOWN" | "UNAVAILABLE";
  confidenceBasis: string;
  limitations: string[];
  generatedBy: string;
}): GoogleCandidateFinding {
  const evidence = input.evidence;
  return createGoogleCandidateFinding({
    findingId: input.findingId,
    candidateType: input.candidateType || "TACTICAL_OBSERVATION_POINT",
    providerId: evidence.providerId,
    providerFeature: evidence.providerFeature,
    sourceEvidenceId: evidence.sourceEvidenceId,
    traceabilityId: evidence.traceabilityId,
    expedienteId: evidence.expedienteId,
    geographyId: evidence.geographyId,
    coordinates: evidence.coordinates,
    explanation: input.explanation,
    observableFactors: input.observableFactors,
    supportingEvidenceIds: [evidence.sourceEvidenceId],
    sourceReferences: evidence.sourceReferences,
    confidence: input.confidence ?? "UNKNOWN",
    confidenceBasis: input.confidenceBasis,
    limitations: input.limitations,
    lineage: evidence.lineage,
    generatedBy: input.generatedBy,
    metadata: { sourceEvidence: evidence },
  });
}

export function deriveExplainableStreetViewCandidateFinding(input: {
  evidence: GoogleIntelligenceEvidence;
  findingId: string;
  preferredCandidateType?: GoogleCandidateType | null;
  observableFactors: unknown[];
  generatedBy: string;
  spatialDistanceMeters?: number | null;
}): GoogleCandidateFinding {
  const resolution = resolveStreetViewCandidateType({
    observableFactors: input.observableFactors,
    preferredCandidateType: input.preferredCandidateType,
  });
  const streetView = input.evidence.metadata?.streetView;
  const confidence = calculateStreetViewCandidateConfidence({
    observableFactors: resolution.matchedFactors.length > 0 ? resolution.matchedFactors : input.observableFactors,
    hasPanoramaId: Boolean(streetView?.panoId || streetView?.panoramaId),
    hasCoordinates: Boolean(input.evidence.coordinates),
    hasLineage: input.evidence.lineage.length > 0 && input.evidence.lineageStatus === "SUPPORTED",
    captureDate: streetView?.captureDate || input.evidence.observedAt || null,
    spatialDistanceMeters: input.spatialDistanceMeters ?? null,
  });

  return deriveStreetViewGoogleCandidateFinding({
    evidence: input.evidence,
    findingId: input.findingId,
    candidateType: resolution.candidateType as any,
    explanation: buildStreetViewCandidateExplanation({
      candidateType: resolution.candidateType,
      observableFactors: resolution.matchedFactors.length > 0 ? resolution.matchedFactors : input.observableFactors,
      downgradeReason: resolution.downgradeReason,
    }),
    observableFactors: normalizeStreetViewObservableFactors(
      resolution.matchedFactors.length > 0 ? resolution.matchedFactors : input.observableFactors
    ),
    confidence: confidence.confidence,
    confidenceBasis: confidence.confidenceBasis,
    limitations: confidence.limitations,
    generatedBy: input.generatedBy,
  });
}

function stableToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

function normalizeVisionValue(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function scoreOrUnknown(value: unknown): number | "UNKNOWN" {
  const score = Number(value);
  if (!Number.isFinite(score)) return "UNKNOWN";
  return Number(Math.max(0, Math.min(1, score)).toFixed(2));
}

function textLooksLikeSignage(text: string): boolean {
  const normalized = text.toLowerCase();
  return /\b(abierto|cerrado|horario|entrada|salida|privado|prohibido|alto|stop|estacionamiento|ferreteria|farmacia|bar|tienda)\b/i.test(
    normalized
  );
}

const SENSITIVE_VISUAL_LABELS = new Set(["weapon", "gun", "knife", "rifle", "pistol", "firearm"]);

function classifyVisionObject(value: string): GoogleVisionObservationKind {
  const normalized = value.toLowerCase();
  if (SENSITIVE_VISUAL_LABELS.has(normalized)) return "UNVERIFIED_VISUAL_CLASSIFICATION";
  if (/\bgate\b|\bturnstile\b/.test(normalized)) return "GATE";
  if (/\bfence\b|\bwall\b|\bbarrier\b|\bbollard\b/.test(normalized)) return "PHYSICAL_BARRIER";
  if (/\bdoor\b|\bentrance\b|\baccess\b/.test(normalized)) return "ACCESS_POINT";
  if (/\broad\b|\bstreet\b|\bsidewalk\b/.test(normalized)) return "ROAD";
  if (/\bcar\b|\bvehicle\b|\bbus\b|\btruck\b|\bmotorcycle\b|\bbicycle\b/.test(normalized)) return "VEHICLE";
  if (/\bbuilding\b|\bhouse\b|\bstore\b/.test(normalized)) return "BUILDING";
  if (/\bperson\b|\bpeople\b|\bman\b|\bwoman\b/.test(normalized)) return "PERSON_PRESENT";
  if (/\bsign\b|\bsignage\b/.test(normalized)) return "SIGNAGE";
  return "VISIBLE_OBJECT";
}

function classifyVisionLabel(value: string): GoogleVisionObservationKind {
  const normalized = value.toLowerCase();
  if (SENSITIVE_VISUAL_LABELS.has(normalized)) return "UNVERIFIED_VISUAL_CLASSIFICATION";
  if (/\bgraffiti\b|\bsign\b|\bsignage\b|\bbillboard\b/.test(normalized)) return "SIGNAGE";
  if (/\bfence\b|\bwall\b|\bbarrier\b|\bgate\b/.test(normalized)) return "PHYSICAL_BARRIER";
  if (/\bbuilding\b|\broad\b|\bstreet\b|\bsidewalk\b|\blight\b|\bstreet light\b/.test(normalized)) return "INFRASTRUCTURE";
  if (/\bdark\b|\bnight\b|\blighting\b/.test(normalized)) return "LIGHTING_ELEMENT";
  if (/\bvegetation\b|\bgrass\b|\bweed\b|\bshrub\b|\btree\b/.test(normalized)) return "VEGETATION";
  if (/\bvehicle\b|\bcar\b|\bmotorcycle\b|\bperson\b|\bbar\b/.test(normalized)) return "VISIBLE_OBJECT";
  if (/\bsurface\b|\bpavement\b|\bdirt\b|\bmud\b/.test(normalized)) return "SURFACE_CONDITION";
  return "VISIBLE_OBJECT";
}

function candidateTypeForObservation(kind: GoogleVisionObservationKind): GoogleCandidateType {
  if (kind === "VISIBLE_TEXT") return "VISIBLE_TEXT_INDICATOR";
  if (kind === "SIGNAGE") return "SIGNAGE_INDICATOR";
  if (kind === "PHYSICAL_BARRIER" || kind === "GATE" || kind === "FENCE") return "PHYSICAL_BARRIER_INDICATOR";
  if (kind === "INFRASTRUCTURE" || kind === "ROAD" || kind === "BUILDING" || kind === "LIGHTING_ELEMENT" || kind === "SURFACE_CONDITION") {
    return "INFRASTRUCTURE_INDICATOR";
  }
  return "VISIBLE_OBJECT_INDICATOR";
}

function visionProviderFeature(feature: GoogleVisionObservation["feature"]): GoogleProviderFeature {
  if (feature === "TEXT_DETECTION") return "VISION_OCR";
  if (feature === "OBJECT_LOCALIZATION") return "VISION_OBJECT";
  return "VISION_LABEL";
}

function buildVisionLimitations(input: {
  kind: GoogleVisionObservationKind;
  value: string;
  context: GoogleVisionSourceContext;
}): string[] {
  const limitations = [
    "Google Vision registra una observacion ML sobre pixeles; no acredita conducta criminal, identidad personal ni actualidad por si sola.",
    "El contenido OCR observado no se promueve como verdad semantica institucional sin validacion humana y corroboracion.",
  ];
  const value = input.value.toLowerCase();
  if (input.kind === "PERSON_PRESENT") limitations.push("La presencia de persona no identifica a nadie ni implica sospecha.");
  if (value.includes("vehicle") || value.includes("car") || value.includes("motorcycle")) limitations.push("La presencia de vehiculo no implica narcotrafico ni actividad ilicita.");
  if (value.includes("graffiti")) limitations.push("Graffiti visible no implica pertenencia a pandilla ni delito.");
  if (value === "bar" || value.includes("bar ")) limitations.push("La etiqueta bar no implica delito.");
  if (input.kind === "UNVERIFIED_VISUAL_CLASSIFICATION") {
    limitations.push("Clasificacion visual sensible o ambigua requiere revision humana, imagen fuente y corroboracion independiente.");
  }
  const date = input.context.captureDate || input.context.observedAt || null;
  if (input.context.imageSourceType === "STREET_VIEW" && date) {
    limitations.push(`La imagen fuente es historica (${date}); Vision hereda esa temporalidad y no acredita situacion actual.`);
  }
  if (input.context.imageSourceType === "IN_SITU") {
    limitations.push("La foto in situ conserva su valor como evidencia fuente humana; Vision solo agrega observaciones AI/ML.");
  }
  return Array.from(new Set(limitations));
}

function makeVisionEvidence(input: {
  context: GoogleVisionSourceContext;
  feature: GoogleVisionObservation["feature"];
  kind: GoogleVisionObservationKind;
  value: string;
  confidence: number | "UNKNOWN";
  boundingGeometry?: unknown;
  language?: string | null;
  generatedAt?: string;
}): GoogleVisionObservation {
  const token = stableToken(`${input.feature}:${input.kind}:${input.value}`);
  const detectionId = `vision-${stableToken(input.context.sourceEvidenceId)}-${token}`;
  const providerFeature = visionProviderFeature(input.feature);
  const observableFact =
    input.feature === "TEXT_DETECTION"
      ? `OBSERVED_BY_VISION:${input.kind}:detectedText:${input.value}`
      : `OBSERVED_BY_VISION:${input.kind}:${input.value}`;
  const evidence = createGoogleIntelligenceEvidence({
    evidenceId: detectionId,
    sourceEvidenceId: input.context.sourceEvidenceId,
    traceabilityId: input.context.traceabilityId,
    expedienteId: input.context.expedienteId,
    geographyId: input.context.geographyId,
    providerId: "GOOGLE_VISION",
    providerFeature,
    coordinates: input.context.coordinates ?? null,
    observedAt: input.context.observedAt ?? input.context.captureDate ?? null,
    acquiredAt: input.context.acquiredAt,
    rawResponseRef: `google-vision:${input.feature}:${input.context.imageReference}`,
    sourceReferences: [input.context.imageReference, input.context.sourceEvidenceId, "Google Cloud Vision"],
    observableFacts: [observableFact],
    limitations: buildVisionLimitations({ kind: input.kind, value: input.value, context: input.context }),
    lineage: input.context.lineage,
    validationStatus: "UNREVIEWED",
    generatedAt: input.generatedAt,
    metadata: {
      vision: {
        feature: input.feature,
        observationKind: input.kind,
        value: input.value,
        confidence: input.confidence,
        boundingGeometry: input.boundingGeometry,
        language: input.language ?? null,
        imageReference: input.context.imageReference,
        sourceEvidenceId: input.context.sourceEvidenceId,
        semanticContentStatus: "OBSERVED_BY_VISION_NOT_SOURCE_FACT",
      },
    },
  });

  return {
    detectionId,
    feature: input.feature,
    kind: input.kind,
    value: input.value,
    confidence: input.confidence,
    boundingGeometry: input.boundingGeometry,
    language: input.language ?? null,
    evidence,
  };
}

export function deriveGoogleVisionIntelligence(input: {
  context: GoogleVisionSourceContext;
  texts?: GoogleVisionTextDetection[];
  objects?: GoogleVisionObjectDetection[];
  labels?: GoogleVisionLabelDetection[];
  generatedBy?: string;
  generatedAt?: string;
}): GoogleVisionFindingDerivationResult {
  const observations = new Map<string, GoogleVisionObservation>();
  const addObservation = (observation: GoogleVisionObservation) => {
    const key = `${observation.evidence.sourceEvidenceId}:${observation.feature}:${stableToken(observation.kind)}:${stableToken(observation.value)}`;
    if (!observations.has(key)) observations.set(key, observation);
  };

  for (const text of input.texts || []) {
    const value = normalizeVisionValue(text.text);
    if (!value) continue;
    addObservation(
      makeVisionEvidence({
        context: input.context,
        feature: "TEXT_DETECTION",
        kind: textLooksLikeSignage(value) ? "SIGNAGE" : "VISIBLE_TEXT",
        value,
        confidence: scoreOrUnknown(text.confidence),
        boundingGeometry: text.boundingGeometry,
        language: text.language ?? null,
        generatedAt: input.generatedAt,
      })
    );
  }

  for (const object of input.objects || []) {
    const value = normalizeVisionValue(object.name);
    if (!value) continue;
    addObservation(
      makeVisionEvidence({
        context: input.context,
        feature: "OBJECT_LOCALIZATION",
        kind: classifyVisionObject(value),
        value,
        confidence: scoreOrUnknown(object.score),
        boundingGeometry: object.boundingGeometry,
        generatedAt: input.generatedAt,
      })
    );
  }

  for (const label of input.labels || []) {
    const value = normalizeVisionValue(label.description);
    if (!value) continue;
    addObservation(
      makeVisionEvidence({
        context: input.context,
        feature: "LABEL_DETECTION",
        kind: classifyVisionLabel(value),
        value,
        confidence: scoreOrUnknown(label.score),
        generatedAt: input.generatedAt,
      })
    );
  }

  const observationList = Array.from(observations.values());
  const candidateFindings: GoogleCandidateFinding[] = [];

  for (const observation of observationList) {
    const type =
      observation.kind === "UNVERIFIED_VISUAL_CLASSIFICATION"
        ? "VISIBLE_OBJECT_INDICATOR"
        : candidateTypeForObservation(observation.kind);
    const evidence = observation.evidence;
    candidateFindings.push(
      createGoogleCandidateFinding({
        findingId: `${observation.detectionId}-candidate`,
        candidateType: type,
        providerId: "GOOGLE_VISION",
        providerFeature: evidence.providerFeature,
        sourceEvidenceId: evidence.sourceEvidenceId,
        traceabilityId: evidence.traceabilityId,
        expedienteId: evidence.expedienteId,
        geographyId: evidence.geographyId,
        coordinates: evidence.coordinates,
        explanation:
          `Vision detecto ${observation.kind} mediante ${observation.feature}: "${observation.value}". ` +
          "Se conserva como candidato conservador sujeto a revision humana. " +
          "No permite concluir identidad, conducta criminal, afiliacion, actualidad ni veracidad semantica del texto.",
        observableFactors: [`${observation.feature}:${observation.kind}:${observation.value}`],
        supportingEvidenceIds: [evidence.evidenceId],
        sourceReferences: evidence.sourceReferences,
        confidence: observation.confidence,
        confidenceBasis:
          typeof observation.confidence === "number"
            ? `Score devuelto por Google Vision para ${observation.feature}: ${observation.confidence}.`
            : `Google Vision no devolvio score util para ${observation.feature}; se conserva confianza UNKNOWN.`,
        limitations: evidence.limitations,
        lineage: evidence.lineage,
        generatedBy: input.generatedBy || "ADR-025.3C_GOOGLE_VISION_INTELLIGENCE",
        generatedAt: input.generatedAt,
        metadata: { sourceEvidence: evidence, visionObservation: observation },
      })
    );
  }

  const hasAccess = observationList.some((o) => o.kind === "GATE" || o.kind === "ACCESS_POINT");
  const hasBarrier = observationList.some((o) => o.kind === "PHYSICAL_BARRIER" || o.kind === "FENCE");
  const hasSignage = observationList.some((o) => o.kind === "SIGNAGE");
  if (hasAccess && hasBarrier && hasSignage) {
    const supporting = observationList.filter((o) => ["GATE", "ACCESS_POINT", "PHYSICAL_BARRIER", "FENCE", "SIGNAGE"].includes(o.kind));
    const confidenceValues = supporting.map((o) => (typeof o.confidence === "number" ? o.confidence : null)).filter((v): v is number => v != null);
    const avgConfidence =
      confidenceValues.length > 0
        ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(2))
        : "UNKNOWN";
    candidateFindings.push(
      createGoogleCandidateFinding({
        findingId: `vision-${stableToken(input.context.sourceEvidenceId)}-access-control-point-candidate`,
        candidateType: "ACCESS_CONTROL_POINT",
        providerId: "GOOGLE_VISION",
        providerFeature: "VISION_OBJECT",
        sourceEvidenceId: input.context.sourceEvidenceId,
        traceabilityId: input.context.traceabilityId,
        expedienteId: input.context.expedienteId,
        geographyId: input.context.geographyId,
        coordinates: input.context.coordinates ?? null,
        explanation:
          "Vision detecto una combinacion de factores visibles compatible con punto de control de acceso: acceso, barrera fisica y senalizacion. " +
          "La combinacion permanece como candidate finding y no acredita control operativo, uso criminal ni actualidad sin revision PPC.",
        observableFactors: supporting.map((o) => `${o.feature}:${o.kind}:${o.value}`),
        supportingEvidenceIds: supporting.map((o) => o.evidence.evidenceId),
        sourceReferences: [input.context.imageReference, input.context.sourceEvidenceId, "Google Cloud Vision"],
        confidence: avgConfidence,
        confidenceBasis:
          confidenceValues.length > 0
            ? `Promedio conservador de ${confidenceValues.length} score(s) Vision en factores combinados.`
            : "Sin scores Vision suficientes; confianza UNKNOWN.",
        limitations: Array.from(
          new Set([
            "Un hallazgo multifactor Vision requiere revision humana antes de correlacion institucional.",
            "No acredita conducta criminal, identidad, intencion ni funcionamiento actual del acceso.",
            ...(input.context.imageSourceType === "STREET_VIEW" && (input.context.captureDate || input.context.observedAt)
              ? [`La imagen fuente es historica (${input.context.captureDate || input.context.observedAt}); no acredita situacion actual.`]
              : []),
          ])
        ),
        lineage: input.context.lineage,
        generatedBy: input.generatedBy || "ADR-025.3C_GOOGLE_VISION_INTELLIGENCE",
        generatedAt: input.generatedAt,
        metadata: { sourceEvidence: supporting[0]?.evidence, visionMultifactor: supporting },
      })
    );
  }

  return {
    observations: observationList,
    evidences: observationList.map((observation) => observation.evidence),
    candidateFindings,
    featureAudit: GOOGLE_VISION_FEATURE_AUDIT,
  };
}

function looseNameMatch(a: string, b: string): boolean {
  const left = stableToken(a).replace(/-/g, " ");
  const right = stableToken(b).replace(/-/g, " ");
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

function distanceMeters(a: GoogleCoordinates, b: GoogleCoordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMeters = 6371e3;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function deriveVisionPoiComparisonCandidate(input: {
  visionTextEvidence: GoogleIntelligenceEvidence;
  visibleText: string;
  comparisonSource: GoogleVisionPoiComparisonSource;
  maxDistanceMeters?: number;
  generatedAt?: string;
}): GoogleCandidateFinding | null {
  const evidence = input.visionTextEvidence;
  const sourceName = input.comparisonSource.name || input.comparisonSource.activity || "";
  if (!looseNameMatch(input.visibleText, sourceName)) return null;
  const maxDistance = input.maxDistanceMeters ?? 80;
  const distance =
    evidence.coordinates && input.comparisonSource.coordinates
      ? distanceMeters(evidence.coordinates, input.comparisonSource.coordinates)
      : null;
  if (typeof distance === "number" && distance > maxDistance) return null;
  const providerLabel = input.comparisonSource.providerId === "GOOGLE_PLACES" ? "Places" : "DENUE";

  return createGoogleCandidateFinding({
    findingId: `${evidence.evidenceId}-${stableToken(input.comparisonSource.sourceId)}-poi-corroboration`,
    candidateType: "POI_SOURCE_CORROBORATION",
    providerId: "GOOGLE_VISION",
    providerFeature: "VISION_OCR",
    sourceEvidenceId: evidence.sourceEvidenceId,
    traceabilityId: evidence.traceabilityId,
    expedienteId: evidence.expedienteId,
    geographyId: evidence.geographyId,
    coordinates: evidence.coordinates,
    explanation:
      `OCR visible observado por Vision guarda similitud textual con ${providerLabel}. ` +
      "La coincidencia es una corroboracion candidata entre fuentes y no decide automaticamente cual fuente es correcta.",
    observableFactors: [`VISION_OCR:${input.visibleText}`, `${input.comparisonSource.providerId}:${sourceName}`],
    supportingEvidenceIds: [evidence.evidenceId, input.comparisonSource.sourceId],
    sourceReferences: [...evidence.sourceReferences, input.comparisonSource.sourceReference],
    confidence: typeof distance === "number" ? 0.64 : 0.56,
    confidenceBasis:
      typeof distance === "number"
        ? `Similitud textual OCR/${providerLabel} con distancia aproximada ${distance.toFixed(1)}m.`
        : `Similitud textual OCR/${providerLabel}; distancia no disponible, por eso se conserva confianza limitada.`,
    limitations: [
      "OCR no prueba veracidad, vigencia ni titularidad del establecimiento.",
      `${providerLabel} se conserva como fuente independiente; no se modifica ni se sobreescribe.`,
    ],
    lineage: evidence.lineage,
    generatedBy: "ADR-025.3C_GOOGLE_VISION_POI_COMPARISON",
    generatedAt: input.generatedAt,
    metadata: { sourceEvidence: evidence, comparisonSource: input.comparisonSource },
  });
}

function correlationBlockingReasons(candidate: GoogleCandidateFinding): string[] {
  const reasons: string[] = [];
  const validation = evaluateHumanValidation(candidate);
  const blockedModes = new Set<AcquisitionMode>(["MOCK", "SIMULATED", "TEST", "CONNECTIVITY_ONLY", "LEGACY"]);

  if (validation.status !== "APPROVED") reasons.push(`VALIDATION_NOT_APPROVED:${validation.status}`);
  if (blockedModes.has(candidate.acquisitionMode as AcquisitionMode)) reasons.push(`ACQUISITION_MODE_NOT_REPORTABLE:${candidate.acquisitionMode}`);
  if (!present(candidate.sourceEvidenceId)) reasons.push("MISSING_SOURCE_EVIDENCE_ID");
  if (!present(candidate.traceabilityId)) reasons.push("MISSING_TRACEABILITY_ID");
  if (!present(candidate.geographyId)) reasons.push("MISSING_GEOGRAPHY_ID");
  if (!Array.isArray(candidate.lineage) || candidate.lineage.length === 0) reasons.push("MISSING_LINEAGE");
  if (candidate.lineageStatus !== "SUPPORTED") reasons.push(`INVALID_LINEAGE_STATUS:${candidate.lineageStatus}`);

  return Array.from(new Set(reasons));
}

export function canGoogleCandidateEnterCorrelation(candidate: GoogleCandidateFinding): boolean {
  return correlationBlockingReasons(candidate).length === 0;
}

export function approveGoogleCandidateFinding(
  candidate: GoogleCandidateFinding,
  validation?: { validatedAt?: string | null; validatedBy?: any | null }
): GoogleCandidateFinding {
  const approved = {
    ...candidate,
    validationStatus: "APPROVED" as const,
    validatedAt: validation?.validatedAt ?? new Date().toISOString(),
    validatedBy: validation?.validatedBy ?? null,
  };
  return {
    ...approved,
    eligibleForCorrelation: canGoogleCandidateEnterCorrelation(approved),
  };
}

export function rejectGoogleCandidateFinding(candidate: GoogleCandidateFinding): GoogleCandidateFinding {
  return {
    ...candidate,
    validationStatus: "REJECTED",
    eligibleForCorrelation: false,
  };
}

export function toInstitutionalCorrelationItem(candidate: GoogleCandidateFinding): GoogleCorrelationAdapterResult {
  const blockingReasons = correlationBlockingReasons(candidate);
  if (blockingReasons.length > 0) {
    return { item: null, blockingReasons };
  }

  const epistemicIntegrity: Partial<EpistemicIntegrityMetadata> = {
    providerId: candidate.providerId,
    sourceType: candidate.providerFeature,
    acquisitionMode: "DERIVED",
    acquisitionStatus: "ACQUIRED",
    semanticRole: "INFERENCE",
    validationStatus: "APPROVED",
    isDerived: true,
    isSimulated: false,
    isConnectivityOnly: false,
    observedAt: candidate.metadata?.sourceEvidence?.observedAt ?? null,
    acquiredAt: candidate.metadata?.sourceEvidence?.acquiredAt ?? null,
    generatedAt: candidate.generatedAt,
    sourceReference: candidate.sourceReferences.join(" | "),
    rawSourceReference: candidate.metadata?.sourceEvidence?.rawResponseRef ?? null,
    traceabilityId: candidate.traceabilityId,
    lineage: candidate.lineage.map((node) => ({
      sourceId: node.sourceId ?? node.id,
      providerId: candidate.providerId,
      sourceType: candidate.providerFeature,
      sourceReference: node.sourceReference ?? node.id,
      traceabilityId: candidate.traceabilityId,
      acquisitionMode: "DERIVED",
    })),
  };

  return {
    item: {
      id: candidate.findingId,
      sourceType: "GOOGLE_CANDIDATE_FINDING",
      providerId: candidate.providerId,
      sourceEvidenceId: candidate.sourceEvidenceId,
      traceabilityId: candidate.traceabilityId,
      expedienteId: candidate.expedienteId,
      geographyId: candidate.geographyId,
      coordinates: candidate.coordinates ?? null,
      observedAt: candidate.metadata?.sourceEvidence?.observedAt ?? null,
      acquiredAt: candidate.metadata?.sourceEvidence?.acquiredAt ?? candidate.generatedAt,
      semanticRole: "INFERENCE",
      epistemicIntegrity,
      payload: {
        candidateType: candidate.candidateType,
        providerFeature: candidate.providerFeature,
        explanation: candidate.explanation,
        observableFactors: candidate.observableFactors,
        confidence: candidate.confidence,
        confidenceBasis: candidate.confidenceBasis,
        limitations: candidate.limitations,
        assertion: "PRESENT",
        findingType: candidate.candidateType,
      },
      reference: candidate.sourceReferences.join(" | "),
      lineage: candidate.lineage,
      category: candidate.candidateType,
      tags: [candidate.providerFeature, candidate.candidateType],
    },
    blockingReasons: [],
  };
}
