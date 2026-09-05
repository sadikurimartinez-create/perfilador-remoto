import { buildEvidenceLineage, validateLineage, type CanonicalLineageNode } from "@/utils/evidenceLineage";
import {
  approveGoogleCandidateFinding,
  createGoogleCandidateFinding,
  createGoogleIntelligenceEvidence,
  type GoogleCandidateFinding,
  type GoogleCandidateType,
  type GoogleIntelligenceEvidence,
} from "@/utils/googleIntelligenceContract";
import type { GooglePlaceReviewSummary, PlaceSummary } from "@/lib/googlePlaces";

export type PlacesReviewContextRole = "USER_GENERATED_CONTEXT" | "UNVERIFIED_USER_GENERATED_ALLEGATION";

export type PlacesReviewSemanticTheme =
  | "TEMPORAL_ACTIVITY_REFERENCE"
  | "CROWD_ACTIVITY_REFERENCE"
  | "ACCESS_REFERENCE"
  | "PARKING_REFERENCE"
  | "LIGHTING_REFERENCE"
  | "NOISE_REFERENCE"
  | "SERVICE_AVAILABILITY_REFERENCE"
  | "BUSINESS_STATUS_REFERENCE"
  | "ENVIRONMENTAL_CONDITION_REFERENCE"
  | "SAFETY_PERCEPTION_REFERENCE"
  | "PHYSICAL_CHANGE_REFERENCE"
  | "UNVERIFIED_USER_GENERATED_ALLEGATION";

export interface PlacesReviewSemanticObservation {
  reviewId: string;
  placeId: string;
  themes: PlacesReviewSemanticTheme[];
  contextRole: PlacesReviewContextRole;
  temporalClass: "CURRENT" | "RECENT" | "HISTORICAL" | "UNKNOWN";
  text: string;
  rating?: number;
  publishedAt?: string | null;
  relativeTimeDescription?: string | null;
  sourceReference: string;
}

export interface PlacesSemanticRecurrence {
  recurrenceId: string;
  placeId: string;
  semanticTheme: PlacesReviewSemanticTheme;
  supportingReviewIds: string[];
  supportCount: number;
  timeSpan: {
    from: string | null;
    to: string | null;
    temporalClass: "CURRENT" | "RECENT" | "HISTORICAL" | "UNKNOWN";
  };
  explanation: string;
  confidence: number | "UNKNOWN";
  confidenceBasis: string;
  limitations: string[];
}

function stableHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36);
}

function present(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function sourceEvidenceIdForPlace(place: Pick<PlaceSummary, "placeId">): string {
  return `google-place:${place.placeId}`;
}

function traceabilityIdFor(parts: Array<string | null | undefined>): string {
  return `trace:google-places:${stableHash(parts.filter(Boolean).join("|"))}`;
}

export function adaptGooglePlaceToEvidence(input: {
  place: PlaceSummary;
  expedienteId: string;
  geographyId: string;
  acquiredAt?: string;
  lineage?: CanonicalLineageNode[];
}): GoogleIntelligenceEvidence {
  const { place } = input;
  const evidenceId = sourceEvidenceIdForPlace(place);
  const lineage =
    input.lineage ||
    buildEvidenceLineage({
      sourceId: "GOOGLE_PLACES",
      sourceReference: `google-place:${place.placeId}`,
      evidenceId,
      geographyId: input.geographyId,
    });

  return createGoogleIntelligenceEvidence({
    evidenceId,
    sourceEvidenceId: evidenceId,
    traceabilityId: traceabilityIdFor([input.expedienteId, input.geographyId, place.placeId]),
    expedienteId: input.expedienteId,
    geographyId: input.geographyId,
    providerId: "GOOGLE_PLACES",
    providerFeature: "PLACES_NEARBY",
    coordinates: { lat: place.lat, lng: place.lng },
    observedAt: null,
    acquiredAt: input.acquiredAt,
    rawResponseRef: `google-place:${place.placeId}`,
    sourceReferences: [`google-place:${place.placeId}`, place.nombre],
    observableFacts: [
      `placeId:${place.placeId}`,
      `name:${place.nombre}`,
      `types:${(place.types || []).join(",") || "UNAVAILABLE"}`,
      `businessStatus:${place.businessStatus || "UNAVAILABLE"}`,
      `coordinates:${place.lat},${place.lng}`,
    ],
    limitations: [
      "Google Places describes the listed POI and API metadata; it does not establish criminal relevance.",
      "Rating and userRatingsTotal are contextual metadata and must not be used as risk or criminality.",
    ],
    lineage,
    validationStatus: "UNREVIEWED",
    metadata: {
      place: {
        placeId: place.placeId,
        name: place.nombre,
        types: place.types || [],
        businessStatus: place.businessStatus || null,
        openingHours: place.openingHours || null,
        rating: place.rating ?? null,
        userRatingsTotal: place.userRatingsTotal ?? null,
        category: place.categoria,
      },
    },
  });
}

export function classifyReviewTemporality(review: Pick<GooglePlaceReviewSummary, "publishedAt" | "relativeTimeDescription">): "CURRENT" | "RECENT" | "HISTORICAL" | "UNKNOWN" {
  if (review.publishedAt) {
    const time = Date.parse(review.publishedAt);
    if (Number.isFinite(time)) {
      const ageDays = (Date.now() - time) / 86400000;
      if (ageDays <= 30) return "CURRENT";
      if (ageDays <= 365) return "RECENT";
      return "HISTORICAL";
    }
  }
  const rel = String(review.relativeTimeDescription || "").toLowerCase();
  if (/d[ií]a|semana|day|week/.test(rel)) return "CURRENT";
  if (/mes|month/.test(rel)) return "RECENT";
  if (/a[nñ]o|year/.test(rel)) return "HISTORICAL";
  return "UNKNOWN";
}

export function extractPlacesReviewSemanticObservation(review: GooglePlaceReviewSummary): PlacesReviewSemanticObservation {
  const text = review.text || "";
  const lower = text.toLowerCase();
  const themes: PlacesReviewSemanticTheme[] = [];

  if (/noche|nocturn|madrugada|medianoche|tarde|01:|02:|after midnight/.test(lower)) themes.push("TEMPORAL_ACTIVITY_REFERENCE");
  if (/gente|lleno|multitud|mucho movimiento|crowd|busy/.test(lower)) themes.push("CROWD_ACTIVITY_REFERENCE");
  if (/entrada|salida|acceso|callej[oó]n|pasillo|access|entrance|exit/.test(lower)) themes.push("ACCESS_REFERENCE");
  if (/estacionamiento|parking|carros|veh[ií]culos|coches|autos/.test(lower)) themes.push("PARKING_REFERENCE");
  if (/luz|iluminaci[oó]n|oscuro|luminaria|lighting|dark/.test(lower)) themes.push("LIGHTING_REFERENCE");
  if (/ruido|m[uú]sica|esc[aá]ndalo|noise|loud/.test(lower)) themes.push("NOISE_REFERENCE");
  if (/cerrado|abierto|servicio|atienden|horario|closed|open/.test(lower)) themes.push("SERVICE_AVAILABILITY_REFERENCE");
  if (/clausurado|cerr[oó]|ya no existe|operando|funciona/.test(lower)) themes.push("BUSINESS_STATUS_REFERENCE");
  if (/basura|sucio|deterior|maleza|abandono|trash|dirty|abandoned/.test(lower)) themes.push("ENVIRONMENTAL_CONDITION_REFERENCE");
  if (/peligroso|mala zona|insegur|sospechos|unsafe|dangerous/.test(lower)) themes.push("SAFETY_PERCEPTION_REFERENCE");
  if (/remodel|cambi[oó]|construcci[oó]n|nuevo|antes|change/.test(lower)) themes.push("PHYSICAL_CHANGE_REFERENCE");
  if (/droga|arma|violencia|pandilla|extorsi[oó]n|robo|narco|drug|weapon|gang|robbery/.test(lower)) {
    themes.push("UNVERIFIED_USER_GENERATED_ALLEGATION");
  }

  const contextRole: PlacesReviewContextRole = themes.includes("UNVERIFIED_USER_GENERATED_ALLEGATION")
    ? "UNVERIFIED_USER_GENERATED_ALLEGATION"
    : "USER_GENERATED_CONTEXT";

  return {
    reviewId: review.reviewId,
    placeId: review.placeId,
    themes: uniq(themes),
    contextRole,
    temporalClass: classifyReviewTemporality(review),
    text,
    rating: review.rating,
    publishedAt: review.publishedAt,
    relativeTimeDescription: review.relativeTimeDescription,
    sourceReference: review.sourceReference,
  };
}

export function adaptGooglePlaceReviewToEvidence(input: {
  review: GooglePlaceReviewSummary;
  place: PlaceSummary;
  expedienteId: string;
  geographyId: string;
  acquiredAt?: string;
}): GoogleIntelligenceEvidence {
  const semantic = extractPlacesReviewSemanticObservation(input.review);
  const evidenceId = input.review.reviewId;
  const lineage = buildEvidenceLineage({
    sourceId: "GOOGLE_PLACES_REVIEW",
    sourceReference: input.review.sourceReference,
    evidenceId,
    geographyId: input.geographyId,
  });
  const lineageStatus = validateLineage(lineage).status;
  const temporalLimitation =
    semantic.temporalClass === "HISTORICAL"
      ? "Review is historical and must not be described as current without corroboration."
      : "Review temporality is contextual and requires corroboration before operational use.";

  return {
    evidenceId,
    sourceEvidenceId: evidenceId,
    traceabilityId: traceabilityIdFor([input.expedienteId, input.geographyId, input.place.placeId, input.review.reviewId]),
    expedienteId: input.expedienteId,
    geographyId: input.geographyId,
    providerId: "GOOGLE_PLACES",
    providerFeature: "PLACES_DETAILS",
    acquisitionMode: "OBSERVED",
    semanticRole: "DIAGNOSTIC",
    validationStatus: "UNREVIEWED",
    coordinates: { lat: input.place.lat, lng: input.place.lng },
    observedAt: input.review.publishedAt ?? null,
    acquiredAt: input.acquiredAt ?? new Date().toISOString(),
    rawResponseRef: input.review.sourceReference,
    sourceReferences: [input.review.sourceReference, `google-place:${input.place.placeId}`],
    observableFacts: [
      `reviewId:${input.review.reviewId}`,
      `placeId:${input.place.placeId}`,
      `themes:${semantic.themes.join(",") || "NONE"}`,
      `rating:${input.review.rating ?? "UNAVAILABLE"}`,
    ],
    limitations: [
      temporalLimitation,
      "User review text is not an authoritative source fact about criminality.",
      "Reviewer identity is intentionally not preserved or inferred.",
    ],
    lineage,
    lineageStatus,
    generatedAt: new Date().toISOString(),
    metadata: {
      review: semantic,
      reviewContextRole: semantic.contextRole,
      placeId: input.place.placeId,
    },
  };
}

function recurrenceConfidence(count: number, temporalClasses: string[]) {
  const uniqueTemporal = new Set(temporalClasses.filter((value) => value !== "UNKNOWN")).size;
  if (count >= 3 && uniqueTemporal >= 2) {
    return { confidence: 0.72, confidenceBasis: `${count} reviews compatibles y distribucion temporal observable.` };
  }
  if (count >= 2) {
    return { confidence: 0.58, confidenceBasis: `${count} reviews compatibles; independencia temporal no plenamente demostrada.` };
  }
  return { confidence: 0.35, confidenceBasis: "Un solo review; soporte bajo y contextual." };
}

export function buildPlacesSemanticRecurrences(
  observations: PlacesReviewSemanticObservation[]
): PlacesSemanticRecurrence[] {
  const byKey = new Map<string, PlacesReviewSemanticObservation[]>();
  for (const observation of observations) {
    for (const theme of observation.themes) {
      if (theme === "UNVERIFIED_USER_GENERATED_ALLEGATION") continue;
      const key = `${observation.placeId}:${theme}`;
      byKey.set(key, [...(byKey.get(key) || []), observation]);
    }
  }

  const recurrences: PlacesSemanticRecurrence[] = [];
  for (const [key, values] of byKey.entries()) {
    const deduped = Array.from(new Map(values.map((value) => [value.reviewId, value])).values());
    const [placeId, semanticTheme] = key.split(":") as [string, PlacesReviewSemanticTheme];
    const dates = deduped.map((value) => value.publishedAt).filter((value): value is string => Boolean(value)).sort();
    const confidence = recurrenceConfidence(deduped.length, deduped.map((value) => value.temporalClass));
    recurrences.push({
      recurrenceId: `places-recurrence:${stableHash(`${key}:${deduped.map((value) => value.reviewId).sort().join("|")}`)}`,
      placeId,
      semanticTheme,
      supportingReviewIds: deduped.map((value) => value.reviewId).sort(),
      supportCount: deduped.length,
      timeSpan: {
        from: dates[0] || null,
        to: dates[dates.length - 1] || null,
        temporalClass: deduped.some((value) => value.temporalClass === "HISTORICAL")
          ? "HISTORICAL"
          : deduped.some((value) => value.temporalClass === "RECENT")
            ? "RECENT"
            : deduped.some((value) => value.temporalClass === "CURRENT")
              ? "CURRENT"
              : "UNKNOWN",
      },
      explanation: `Se identifican ${deduped.length} review(s) con menciones compatibles con ${semanticTheme}. El patron se conserva como contexto generado por usuarios, no como hecho criminal.`,
      confidence: confidence.confidence,
      confidenceBasis: confidence.confidenceBasis,
      limitations: [
        "La recurrencia semantica proviene de reviews de usuarios y requiere corroboracion externa.",
        "No acredita criminalidad, ilegalidad ni identidad de personas.",
      ],
    });
  }
  return recurrences.sort((a, b) => a.recurrenceId.localeCompare(b.recurrenceId));
}

function candidateTypeForTheme(theme: PlacesReviewSemanticTheme): GoogleCandidateType {
  if (theme === "TEMPORAL_ACTIVITY_REFERENCE") return "TEMPORAL_ACTIVITY_NODE";
  if (theme === "CROWD_ACTIVITY_REFERENCE") return "HIGH_ACTIVITY_POI";
  if (theme === "SERVICE_AVAILABILITY_REFERENCE" || theme === "BUSINESS_STATUS_REFERENCE") return "SERVICE_NODE";
  return "ACTIVITY_ATTRACTOR";
}

export function createPlacesCandidateFromRecurrence(input: {
  recurrence: PlacesSemanticRecurrence;
  placeEvidence: GoogleIntelligenceEvidence;
  reviewEvidence: GoogleIntelligenceEvidence[];
  generatedBy?: string;
}): GoogleCandidateFinding {
  const supportingEvidenceIds = uniq([
    input.placeEvidence.sourceEvidenceId,
    ...input.reviewEvidence.map((evidence) => evidence.sourceEvidenceId),
  ]);
  return createGoogleCandidateFinding({
    findingId: `places-candidate:${input.recurrence.recurrenceId}`,
    candidateType: candidateTypeForTheme(input.recurrence.semanticTheme),
    providerId: "GOOGLE_PLACES",
    providerFeature: "PLACES_DETAILS",
    sourceEvidenceId: input.placeEvidence.sourceEvidenceId,
    traceabilityId: traceabilityIdFor([
      input.placeEvidence.expedienteId,
      input.placeEvidence.geographyId,
      input.recurrence.recurrenceId,
    ]),
    expedienteId: input.placeEvidence.expedienteId,
    geographyId: input.placeEvidence.geographyId,
    coordinates: input.placeEvidence.coordinates,
    explanation: `${input.recurrence.explanation} No se concluye delito ni riesgo por categoria de establecimiento, rating o percepcion aislada.`,
    observableFactors: [
      `semanticTheme:${input.recurrence.semanticTheme}`,
      `supportCount:${input.recurrence.supportCount}`,
      `supportingReviewIds:${input.recurrence.supportingReviewIds.join(",")}`,
    ],
    supportingEvidenceIds,
    sourceReferences: uniq([
      ...input.placeEvidence.sourceReferences,
      ...input.reviewEvidence.flatMap((evidence) => evidence.sourceReferences),
    ]),
    confidence: input.recurrence.confidence,
    confidenceBasis: input.recurrence.confidenceBasis,
    limitations: input.recurrence.limitations,
    lineage: buildEvidenceLineage({
      sourceId: "GOOGLE_PLACES",
      sourceReference: input.placeEvidence.rawResponseRef,
      evidenceId: input.placeEvidence.sourceEvidenceId,
      findingId: `places-candidate:${input.recurrence.recurrenceId}`,
      geographyId: input.placeEvidence.geographyId,
    }),
    generatedBy: input.generatedBy || "GOOGLE_PLACES_REVIEW_RECURRENCE",
    metadata: {
      sourceEvidence: input.placeEvidence,
      recurrence: input.recurrence,
      reviewEvidenceIds: input.reviewEvidence.map((evidence) => evidence.sourceEvidenceId),
    },
  });
}

export function detectOperationalHoursInconsistency(input: {
  placeEvidence: GoogleIntelligenceEvidence;
  recurrences: PlacesSemanticRecurrence[];
}): GoogleCandidateFinding | null {
  const place: any = input.placeEvidence.metadata?.place || {};
  const hasOpeningHours = Boolean(place.openingHours);
  const temporal = input.recurrences.find((recurrence) => recurrence.semanticTheme === "TEMPORAL_ACTIVITY_REFERENCE" && recurrence.supportCount >= 2);
  if (!hasOpeningHours || !temporal) return null;

  return createGoogleCandidateFinding({
    findingId: `places-hours-inconsistency:${stableHash(`${input.placeEvidence.sourceEvidenceId}:${temporal.recurrenceId}`)}`,
    candidateType: "OPERATIONAL_HOURS_INCONSISTENCY",
    providerId: "GOOGLE_PLACES",
    providerFeature: "PLACES_DETAILS",
    sourceEvidenceId: input.placeEvidence.sourceEvidenceId,
    traceabilityId: traceabilityIdFor([input.placeEvidence.traceabilityId, temporal.recurrenceId]),
    expedienteId: input.placeEvidence.expedienteId,
    geographyId: input.placeEvidence.geographyId,
    coordinates: input.placeEvidence.coordinates,
    explanation: "El horario oficial de Google Places y multiples reviews con referencia temporal pueden indicar una inconsistencia contextual. No se concluye ilegalidad.",
    observableFactors: ["openingHours present", `semanticTheme:${temporal.semanticTheme}`, `supportCount:${temporal.supportCount}`],
    supportingEvidenceIds: [input.placeEvidence.sourceEvidenceId, ...temporal.supportingReviewIds],
    sourceReferences: input.placeEvidence.sourceReferences,
    confidence: temporal.confidence,
    confidenceBasis: `Horario Places disponible; ${temporal.confidenceBasis}`,
    limitations: ["La inconsistencia horaria no prueba operacion ilegal.", "Requiere corroboracion PPC o fuente administrativa."],
    lineage: input.placeEvidence.lineage,
    generatedBy: "GOOGLE_PLACES_HOURS_CONTEXT",
    metadata: { sourceEvidence: input.placeEvidence, recurrence: temporal },
  });
}

export function compareGooglePlaceWithDenue(input: {
  placeEvidence: GoogleIntelligenceEvidence;
  denueEvidence: {
    sourceEvidenceId: string;
    traceabilityId: string;
    name?: string | null;
    activity?: string | null;
    coordinates?: { lat: number; lng: number } | null;
    lineage?: CanonicalLineageNode[];
  };
  classificationCompatible: boolean;
  spatiallyCompatible: boolean;
}): GoogleCandidateFinding {
  const type: GoogleCandidateType = input.classificationCompatible && input.spatiallyCompatible
    ? "POI_SOURCE_CORROBORATION"
    : "POI_CLASSIFICATION_INCONSISTENCY";
  const denueSourceId = input.denueEvidence.sourceEvidenceId;

  return createGoogleCandidateFinding({
    findingId: `places-denue:${stableHash(`${input.placeEvidence.sourceEvidenceId}:${denueSourceId}:${type}`)}`,
    candidateType: type,
    providerId: "GOOGLE_PLACES",
    providerFeature: "PLACES_NEARBY",
    sourceEvidenceId: input.placeEvidence.sourceEvidenceId,
    traceabilityId: traceabilityIdFor([input.placeEvidence.traceabilityId, input.denueEvidence.traceabilityId, type]),
    expedienteId: input.placeEvidence.expedienteId,
    geographyId: input.placeEvidence.geographyId,
    coordinates: input.placeEvidence.coordinates,
    explanation:
      type === "POI_SOURCE_CORROBORATION"
        ? "Google Places y DENUE describen POIs espacial y funcionalmente compatibles. Se conservan ambas fuentes."
        : "Google Places y DENUE presentan una discrepancia espacial o funcional. Ninguna fuente se descarta automaticamente.",
    observableFactors: [
      `googlePlace:${input.placeEvidence.sourceEvidenceId}`,
      `denueEvidence:${denueSourceId}`,
      `classificationCompatible:${input.classificationCompatible}`,
      `spatiallyCompatible:${input.spatiallyCompatible}`,
    ],
    supportingEvidenceIds: [input.placeEvidence.sourceEvidenceId, denueSourceId],
    sourceReferences: [...input.placeEvidence.sourceReferences, denueSourceId],
    confidence: input.classificationCompatible && input.spatiallyCompatible ? 0.66 : 0.52,
    confidenceBasis: "Comparacion conservadora por proximidad, nombre/actividad y coexistencia de fuentes.",
    limitations: ["No decide cual fuente tiene razon.", "No implica criminalidad ni irregularidad administrativa por si misma."],
    lineage: input.placeEvidence.lineage,
    generatedBy: "GOOGLE_PLACES_DENUE_CONTEXT",
    metadata: { sourceEvidence: input.placeEvidence, denueEvidence: input.denueEvidence },
  });
}

export function compareGooglePlaceWithFieldObservation(input: {
  placeEvidence: GoogleIntelligenceEvidence;
  fieldEvidenceId: string;
  fieldTraceabilityId: string;
  fieldObservation: string;
  contradictionType?: "BUSINESS_STATUS" | "PHYSICAL_STATUS" | "LOCATION_CONTEXT";
}): GoogleCandidateFinding {
  return createGoogleCandidateFinding({
    findingId: `places-field-contradiction:${stableHash(`${input.placeEvidence.sourceEvidenceId}:${input.fieldEvidenceId}:${input.fieldObservation}`)}`,
    candidateType: "PHYSICAL_OPERATIONAL_STATUS_INCONSISTENCY",
    providerId: "GOOGLE_PLACES",
    providerFeature: "PLACES_NEARBY",
    sourceEvidenceId: input.placeEvidence.sourceEvidenceId,
    traceabilityId: traceabilityIdFor([input.placeEvidence.traceabilityId, input.fieldTraceabilityId, input.contradictionType || "FIELD"]),
    expedienteId: input.placeEvidence.expedienteId,
    geographyId: input.placeEvidence.geographyId,
    coordinates: input.placeEvidence.coordinates,
    explanation: "La observacion de campo y Google Places se conservan como posible contradiccion contextual. Google no sobrescribe el trabajo PPC.",
    observableFactors: [
      `googlePlace:${input.placeEvidence.sourceEvidenceId}`,
      `fieldEvidence:${input.fieldEvidenceId}`,
      `contradictionType:${input.contradictionType || "LOCATION_CONTEXT"}`,
    ],
    supportingEvidenceIds: [input.placeEvidence.sourceEvidenceId, input.fieldEvidenceId],
    sourceReferences: [...input.placeEvidence.sourceReferences, input.fieldEvidenceId],
    confidence: 0.5,
    confidenceBasis: "Contraste declarativo entre metadata Places y observacion de campo; requiere revision PPC.",
    limitations: ["No resuelve la contradiccion automaticamente.", "La evidencia in situ tiene prioridad analitica tras validacion humana."],
    lineage: input.placeEvidence.lineage,
    generatedBy: "GOOGLE_PLACES_FIELD_CONTEXT",
    metadata: { sourceEvidence: input.placeEvidence, fieldObservation: input.fieldObservation },
  });
}

export function approvePlacesCandidateForCorrelation(candidate: GoogleCandidateFinding): GoogleCandidateFinding {
  return approveGoogleCandidateFinding(candidate);
}
