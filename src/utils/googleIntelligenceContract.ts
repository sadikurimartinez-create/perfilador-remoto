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
