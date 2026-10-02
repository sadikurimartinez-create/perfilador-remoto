import { SpatialLayerEngine, type Coordinate } from "../providers/spatialLayerEngine";
import { evaluateIntelligenceEligibility } from "@/utils/syntheticIntelligenceFirewall";
import type { EpistemicIntegrityMetadata, IntelligenceSemanticRole } from "@/types/epistemicIntegrity";

export type InstitutionalCorrelationType =
  | "CORROBORATION"
  | "CONTRADICTION"
  | "COMPLEMENTARY"
  | "NO_RELATION";

export type InstitutionalSpatialRelation =
  | "SAME_GEOGRAPHY"
  | "SAME_GEOGRAPHY_WITH_DISTANCE"
  | "SPATIAL_CONTEXT_UNAVAILABLE"
  | "DIFFERENT_EXPEDIENTE"
  | "DIFFERENT_GEOGRAPHY"
  | "INVALID_COORDINATES";

export type InstitutionalTemporalRelation =
  | "UNKNOWN"
  | "SAME_TIMESTAMP"
  | "A_OBSERVED_BEFORE_B"
  | "B_OBSERVED_BEFORE_A";

export type InstitutionalSemanticRelation =
  | "SAME_SEMANTIC_KEY"
  | "DETERMINISTIC_CONTRADICTION"
  | "COMPLEMENTARY_SOURCE_FACT"
  | "NO_DETERMINISTIC_RELATION";

export interface InstitutionalCorrelationItem {
  id: string;
  sourceType: string;
  providerId: string;
  sourceEvidenceId?: string | null;
  traceabilityId?: string | null;
  expedienteId?: string | null;
  geographyId?: string | null;
  coordinates?: Coordinate | null;
  observedAt?: string | null;
  acquiredAt?: string | null;
  semanticRole?: IntelligenceSemanticRole | string | null;
  epistemicIntegrity?: Partial<EpistemicIntegrityMetadata> | null;
  payload?: Record<string, any> | null;
  reference?: string | null;
  lineage?: unknown[] | null;
  category?: string | null;
  categoria?: string | null;
  tags?: string[] | null;
}

export interface InstitutionalCorrelationResult {
  correlationId: string;
  expedienteId: string;
  geographyId: string;
  supportingEvidenceIds: string[];
  supportingTraceabilityIds: string[];
  sources: Array<{ id: string; sourceType: string; providerId: string }>;
  spatialRelation: InstitutionalSpatialRelation;
  distanceMeters?: number;
  temporalRelation: InstitutionalTemporalRelation;
  semanticRelation: InstitutionalSemanticRelation;
  correlationType: InstitutionalCorrelationType;
  correlationConfidence: number;
  supportStrength: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  lineage: Array<{
    itemId: string;
    sourceEvidenceId: string;
    traceabilityId: string;
    sourceType: string;
    providerId: string;
  }>;
  eligibleForInstitutionalAnalysis: boolean;
}

export interface InstitutionalCorrelationReport {
  mode: "INSTITUTIONAL_EVIDENCE_CORRELATION";
  moduleName: "pandillas" | "perfil";
  timestamp: string;
  inputCount: number;
  eligibleItemCount: number;
  excludedItems: Array<{ id?: string; sourceType?: string; providerId?: string; reasons: string[] }>;
  results: InstitutionalCorrelationResult[];
  contextOnlySourceIds: string[];
  criminalCoreSourceIds: string[];
}

const INUNDATION_PROVIDER_IDS = new Set([
  "nasa",
  "copernicus",
  "usgs",
  "conagua",
  "cenapred",
  "noaa",
  "tomorrow.io",
  "tomorrow",
  "hydrofusion",
  "hydro_fusion",
]);

function present(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readCoordinates(item: InstitutionalCorrelationItem): Coordinate | null {
  const raw = item.coordinates;
  if (!raw) return null;
  const lat = typeof raw.lat === "number" ? raw.lat : Number(raw.lat);
  const lng = typeof raw.lng === "number" ? raw.lng : Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function observedTime(item: InstitutionalCorrelationItem): number | null {
  const raw = present(item.observedAt) || present(item.acquiredAt) || present(item.epistemicIntegrity?.observedAt) || present(item.epistemicIntegrity?.acquiredAt);
  if (!raw) return null;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : null;
}

function temporalRelation(a: InstitutionalCorrelationItem, b: InstitutionalCorrelationItem): InstitutionalTemporalRelation {
  const aTime = observedTime(a);
  const bTime = observedTime(b);
  if (aTime === null || bTime === null) return "UNKNOWN";
  if (aTime === bTime) return "SAME_TIMESTAMP";
  return aTime < bTime ? "A_OBSERVED_BEFORE_B" : "B_OBSERVED_BEFORE_A";
}

function semanticKeys(item: InstitutionalCorrelationItem): string[] {
  const keys = [
    item.category,
    item.categoria,
    item.payload?.category,
    item.payload?.categoria,
    item.payload?.findingType,
    item.payload?.tipo,
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item.payload?.tags) ? item.payload.tags : []),
  ];
  return keys
    .map((key) => String(key || "").trim().toUpperCase())
    .filter(Boolean);
}

function assertionPolarity(item: InstitutionalCorrelationItem): "PRESENT" | "ABSENT" | null {
  const raw = String(
    item.payload?.assertion ||
    item.payload?.assertionStatus ||
    item.payload?.presence ||
    item.payload?.estadoPresencia ||
    ""
  ).toUpperCase();
  if (["PRESENT", "PRESENCE", "DETECTED", "EXISTS", "TRUE"].includes(raw)) return "PRESENT";
  if (["ABSENT", "ABSENCE", "NOT_DETECTED", "NONE", "FALSE"].includes(raw)) return "ABSENT";
  return null;
}

function semanticRelation(
  a: InstitutionalCorrelationItem,
  b: InstitutionalCorrelationItem
): { relation: InstitutionalSemanticRelation; type: InstitutionalCorrelationType } {
  const aKeys = semanticKeys(a);
  const bKeys = semanticKeys(b);
  const overlap = aKeys.some((key) => bKeys.includes(key));
  const aPolarity = assertionPolarity(a);
  const bPolarity = assertionPolarity(b);

  if (overlap && aPolarity && bPolarity && aPolarity !== bPolarity) {
    return { relation: "DETERMINISTIC_CONTRADICTION", type: "CONTRADICTION" };
  }
  if (overlap) {
    return { relation: "SAME_SEMANTIC_KEY", type: "CORROBORATION" };
  }
  if ((a.semanticRole === "SOURCE_FACT" || b.semanticRole === "SOURCE_FACT") && a.sourceType !== b.sourceType) {
    return { relation: "COMPLEMENTARY_SOURCE_FACT", type: "COMPLEMENTARY" };
  }
  return { relation: "NO_DETERMINISTIC_RELATION", type: "NO_RELATION" };
}

function supportStrength(type: InstitutionalCorrelationType, distanceMeters?: number): InstitutionalCorrelationResult["supportStrength"] {
  if (type === "NO_RELATION") return "NONE";
  if (type === "CONTRADICTION") return "MEDIUM";
  if (typeof distanceMeters === "number" && distanceMeters <= 75) return "HIGH";
  if (typeof distanceMeters === "number" && distanceMeters <= 250) return "MEDIUM";
  return "LOW";
}

function confidence(type: InstitutionalCorrelationType, distanceMeters?: number): number {
  if (type === "NO_RELATION") return 0;
  const base = type === "CORROBORATION" ? 0.8 : type === "CONTRADICTION" ? 0.7 : 0.55;
  const spatialBonus = typeof distanceMeters === "number" ? Math.max(0, Math.min(0.15, (250 - Math.min(distanceMeters, 250)) / 2500)) : 0;
  return Number(Math.min(0.95, base + spatialBonus).toFixed(2));
}

function validateInstitutionalItem(
  item: InstitutionalCorrelationItem,
  moduleName: "pandillas" | "perfil"
): { eligible: boolean; reasons: string[]; coordinates: Coordinate | null } {
  const reasons: string[] = [];
  const eligibility = evaluateIntelligenceEligibility(item as any);
  const metadata = eligibility.normalizedMetadata;
  const providerId = (present(item.providerId) || present(metadata.providerId) || "").toLowerCase();
  const coordinates = readCoordinates(item);

  for (const reason of eligibility.blockingReasons) {
    if (
      reason.startsWith("ACQUISITION_MODE_NOT_REPORTABLE:") ||
      reason === "SIMULATED_CONTENT_NOT_REPORTABLE" ||
      reason === "CONNECTIVITY_ONLY_NOT_REPORTABLE" ||
      reason === "DERIVED_REQUIRES_SOURCE_LINEAGE"
    ) {
      reasons.push(reason);
    }
  }

  if (metadata.acquisitionMode === "UNKNOWN") {
    reasons.push("UNKNOWN_ACQUISITION_MODE_NOT_INSTITUTIONAL");
  }
  if (moduleName !== "perfil" && INUNDATION_PROVIDER_IDS.has(providerId)) {
    reasons.push("INUNDATION_PROVIDER_NOT_CRIMINAL_CORE");
  }
  if (moduleName === "perfil" && INUNDATION_PROVIDER_IDS.has(providerId)) {
    reasons.push("INUNDATION_PROVIDER_EXCLUDED_FROM_PROFILE_CORE");
  }
  if (!present(item.sourceEvidenceId)) reasons.push("MISSING_SOURCE_EVIDENCE_ID");
  if (!present(item.traceabilityId) && !present(metadata.traceabilityId)) reasons.push("MISSING_TRACEABILITY_ID");
  if (!present(item.expedienteId)) reasons.push("MISSING_EXPEDIENTE_ID");
  if (!present(item.geographyId)) reasons.push("MISSING_GEOGRAPHY_ID");
  if (item.coordinates !== undefined && !coordinates) reasons.push("INVALID_COORDINATES");

  return { eligible: reasons.length === 0, reasons, coordinates };
}

export function correlateInstitutionalEvidence(
    moduleName: "pandillas" | "perfil",
    items: InstitutionalCorrelationItem[], generatedAt?: string
  ): InstitutionalCorrelationReport {
    const timestamp = generatedAt || new Date().toISOString();
    const eligibleItems: Array<InstitutionalCorrelationItem & { coordinates: Coordinate | null }> = [];
    const excludedItems: InstitutionalCorrelationReport["excludedItems"] = [];

    for (const item of Array.isArray(items) ? items : []) {
      const validation = validateInstitutionalItem(item, moduleName);
      if (!validation.eligible) {
        excludedItems.push({
          id: item?.id,
          sourceType: item?.sourceType,
          providerId: item?.providerId,
          reasons: Array.from(new Set(validation.reasons)),
        });
        continue;
      }
      eligibleItems.push({ ...item, coordinates: validation.coordinates });
    }

    const results: InstitutionalCorrelationResult[] = [];
    for (let i = 0; i < eligibleItems.length; i += 1) {
      for (let j = i + 1; j < eligibleItems.length; j += 1) {
        const a = eligibleItems[i];
        const b = eligibleItems[j];

        if (a.expedienteId !== b.expedienteId || !a.expedienteId) continue;
        if (a.geographyId !== b.geographyId || !a.geographyId) continue;

        let spatialRelation: InstitutionalSpatialRelation = "SAME_GEOGRAPHY";
        let distanceMeters: number | undefined;
        if (a.coordinates && b.coordinates) {
          distanceMeters = Number(SpatialLayerEngine.getDistance(a.coordinates, b.coordinates).toFixed(1));
          spatialRelation = "SAME_GEOGRAPHY_WITH_DISTANCE";
        } else if (!a.coordinates && !b.coordinates) {
          spatialRelation = "SPATIAL_CONTEXT_UNAVAILABLE";
        }

        const semantic = semanticRelation(a, b);
        const supportingEvidenceIds = [a.sourceEvidenceId, b.sourceEvidenceId].filter(Boolean) as string[];
        const supportingTraceabilityIds = [
          a.traceabilityId || a.epistemicIntegrity?.traceabilityId,
          b.traceabilityId || b.epistemicIntegrity?.traceabilityId,
        ].filter(Boolean) as string[];

        results.push({
          correlationId: `corr:${a.expedienteId}:${a.geographyId}:${supportingEvidenceIds.join(":")}`,
          expedienteId: a.expedienteId,
          geographyId: a.geographyId,
          supportingEvidenceIds,
          supportingTraceabilityIds,
          sources: [
            { id: a.id, sourceType: a.sourceType, providerId: a.providerId },
            { id: b.id, sourceType: b.sourceType, providerId: b.providerId },
          ],
          spatialRelation,
          ...(distanceMeters !== undefined ? { distanceMeters } : {}),
          temporalRelation: temporalRelation(a, b),
          semanticRelation: semantic.relation,
          correlationType: semantic.type,
          correlationConfidence: confidence(semantic.type, distanceMeters),
          supportStrength: supportStrength(semantic.type, distanceMeters),
          lineage: [
            {
              itemId: a.id,
              sourceEvidenceId: a.sourceEvidenceId as string,
              traceabilityId: (a.traceabilityId || a.epistemicIntegrity?.traceabilityId) as string,
              sourceType: a.sourceType,
              providerId: a.providerId,
            },
            {
              itemId: b.id,
              sourceEvidenceId: b.sourceEvidenceId as string,
              traceabilityId: (b.traceabilityId || b.epistemicIntegrity?.traceabilityId) as string,
              sourceType: b.sourceType,
              providerId: b.providerId,
            },
          ],
          eligibleForInstitutionalAnalysis: true,
        });
      }
    }

    return {
      mode: "INSTITUTIONAL_EVIDENCE_CORRELATION",
      moduleName,
      timestamp,
      inputCount: Array.isArray(items) ? items.length : 0,
      eligibleItemCount: eligibleItems.length,
      excludedItems,
      results,
      contextOnlySourceIds: eligibleItems
        .filter((item) => item.sourceType === "DENUE" || item.providerId === "INEGI_DENUE")
        .map((item) => item.id),
      criminalCoreSourceIds: eligibleItems
        .filter((item) => item.sourceType !== "DENUE" && item.providerId !== "INEGI_DENUE")
        .filter((item) => !INUNDATION_PROVIDER_IDS.has(item.providerId.toLowerCase()))
        .map((item) => item.id),
    };
  }
