import {
  AcquisitionStatus,
  AcquisitionMode,
  EpistemicIntegrityCarrier,
  EpistemicIntegrityMetadata,
  EpistemicValidationStatus,
  IntelligenceSemanticRole,
} from "@/types/epistemicIntegrity";

export interface IntelligenceEligibility {
  eligibleForAnalysis: boolean;
  eligibleForHumanReview: boolean;
  eligibleForApproval: boolean;
  eligibleForReport: boolean;
  blockingReasons: string[];
  warnings: string[];
  normalizedMetadata: EpistemicIntegrityMetadata;
}

export interface LegacyCompatibilityClassification {
  compatibleForReport: boolean;
  classification: "LEGACY_APPROVED_STATUS" | "LEGACY_BLOCKED_STATUS" | "NOT_LEGACY_COMPATIBLE";
  reasons: string[];
  warnings: string[];
}

const BLOCKED_REPORT_MODES = new Set<AcquisitionMode>([
  "SIMULATED",
  "MOCK",
  "CONNECTIVITY_ONLY",
  "TEST",
  "UNKNOWN",
]);

const REPORTABLE_AI_ROLES = new Set<IntelligenceSemanticRole>([
  "INFERENCE",
  "SYNTHESIS",
  "ANALYTICAL_SUGGESTION",
]);

const LEGACY_APPROVED_STATUSES = new Set(["APPROVED_EVIDENCE", "APROBADO", "APPROVED"]);
const LEGACY_BLOCKED_STATUSES = new Set([
  "REJECTED_FINDING",
  "RECHAZADO",
  "IGNORADO",
  "PENDING_REVIEW",
  "PENDIENTE_REVISION",
  "GENERATED",
  "GENERADO",
]);

function normalizeMode(value: unknown): AcquisitionMode | null {
  const mode = typeof value === "string" ? value.toUpperCase() : "";
  const allowed: AcquisitionMode[] = [
    "OBSERVED",
    "DERIVED",
    "AI_GENERATED",
    "SIMULATED",
    "MOCK",
    "CONNECTIVITY_ONLY",
    "TEST",
    "LEGACY",
    "UNKNOWN",
  ];
  return allowed.includes(mode as AcquisitionMode) ? (mode as AcquisitionMode) : null;
}

function normalizeValidation(
  value: unknown,
  legacyStatus: string,
  acquisitionMode: AcquisitionMode
): EpistemicValidationStatus {
  const status = typeof value === "string" ? value.toUpperCase() : "";
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "PENDING_REVIEW") return "PENDING_REVIEW";
  if (status === "UNREVIEWED") return "UNREVIEWED";
  if (status === "LEGACY_UNCLASSIFIED") return "LEGACY_UNCLASSIFIED";
  if (LEGACY_APPROVED_STATUSES.has(legacyStatus)) return "APPROVED";
  if (LEGACY_BLOCKED_STATUSES.has(legacyStatus)) return legacyStatus.includes("REJECT") || legacyStatus === "RECHAZADO" || legacyStatus === "IGNORADO" ? "REJECTED" : "PENDING_REVIEW";
  if (acquisitionMode === "LEGACY") return "LEGACY_UNCLASSIFIED";
  return "UNREVIEWED";
}

function normalizeAcquisitionStatus(value: unknown): AcquisitionStatus {
  const status = typeof value === "string" ? value.toUpperCase() : "";
  const allowed: AcquisitionStatus[] = [
    "ACQUIRED",
    "NO_DATA",
    "FAILED",
    "NOT_CONFIGURED",
    "PARTIAL",
    "UNAVAILABLE",
  ];
  return allowed.includes(status as AcquisitionStatus) ? (status as AcquisitionStatus) : "ACQUIRED";
}

function normalizeSemanticRole(value: unknown): IntelligenceSemanticRole {
  const role = typeof value === "string" ? value.toUpperCase() : "";
  const allowed: IntelligenceSemanticRole[] = [
    "SOURCE_FACT",
    "INFERENCE",
    "SYNTHESIS",
    "ANALYTICAL_SUGGESTION",
    "DIAGNOSTIC",
    "UNKNOWN",
  ];
  return allowed.includes(role as IntelligenceSemanticRole) ? (role as IntelligenceSemanticRole) : "UNKNOWN";
}

export function normalizeEpistemicMetadata(item: EpistemicIntegrityCarrier | null | undefined): EpistemicIntegrityMetadata {
  const source = item || {};
  const embedded = source.epistemicIntegrity || source.epistemic || {};
  const legacyStatus = String(
    source.status || source.estado || source.estado_revision || source.analystValidationStatus || ""
  ).toUpperCase();
  const acquisitionMode =
    normalizeMode(embedded.acquisitionMode) ||
    normalizeMode(source.acquisitionMode) ||
    (source.isConnectivityOnly ? "CONNECTIVITY_ONLY" : null) ||
    (source.isSimulated ? "SIMULATED" : null) ||
    (source.isDerived ? "DERIVED" : null) ||
    (legacyStatus ? "LEGACY" : "UNKNOWN");

  return {
    sourceId: embedded.sourceId ?? source.sourceId ?? null,
    providerId: embedded.providerId ?? source.providerId ?? null,
    providerName: embedded.providerName ?? source.providerName ?? null,
    sourceType: embedded.sourceType ?? source.sourceType ?? null,
    acquisitionMode,
    acquisitionStatus: normalizeAcquisitionStatus(embedded.acquisitionStatus ?? source.acquisitionStatus),
    semanticRole: normalizeSemanticRole(embedded.semanticRole),
    validationStatus: normalizeValidation(embedded.validationStatus ?? source.validationStatus, legacyStatus, acquisitionMode),
    isSimulated: Boolean(embedded.isSimulated ?? source.isSimulated ?? (acquisitionMode === "SIMULATED")),
    isDerived: Boolean(embedded.isDerived ?? source.isDerived ?? (acquisitionMode === "DERIVED")),
    isConnectivityOnly: Boolean(embedded.isConnectivityOnly ?? source.isConnectivityOnly ?? (acquisitionMode === "CONNECTIVITY_ONLY")),
    observedAt: embedded.observedAt ?? source.observedAt ?? null,
    acquiredAt: embedded.acquiredAt ?? source.acquiredAt ?? null,
    generatedAt: embedded.generatedAt ?? source.generatedAt ?? source.createdAt ?? source.updatedAt ?? null,
    sourceReference: embedded.sourceReference ?? source.sourceReference ?? null,
    sourceUrl: embedded.sourceUrl ?? source.sourceUrl ?? null,
    rawSourceReference: embedded.rawSourceReference ?? source.rawSourceReference ?? null,
    query: embedded.query ?? source.query ?? null,
    resultCount: embedded.resultCount ?? source.resultCount ?? null,
    geolocationSource: embedded.geolocationSource ?? source.geolocationSource ?? null,
    traceabilityId: embedded.traceabilityId ?? source.traceabilityId ?? null,
    lineage: embedded.lineage ?? source.lineage ?? [],
  };
}

export function classifyLegacyCompatibility(
  item: EpistemicIntegrityCarrier | null | undefined
): LegacyCompatibilityClassification {
  if (!item) {
    return {
      compatibleForReport: false,
      classification: "NOT_LEGACY_COMPATIBLE",
      reasons: ["EMPTY_ITEM"],
      warnings: [],
    };
  }

  const status = String(item.status || item.estado || item.estado_revision || item.analystValidationStatus || "").toUpperCase();

  if (LEGACY_BLOCKED_STATUSES.has(status)) {
    return {
      compatibleForReport: false,
      classification: "LEGACY_BLOCKED_STATUS",
      reasons: [`LEGACY_STATUS_NOT_REPORTABLE:${status}`],
      warnings: [],
    };
  }

  if (LEGACY_APPROVED_STATUSES.has(status)) {
    return {
      compatibleForReport: true,
      classification: "LEGACY_APPROVED_STATUS",
      reasons: [],
      warnings: ["LEGACY_STATUS_COMPATIBILITY_WITHOUT_CANONICAL_EPISTEMIC_METADATA"],
    };
  }

  return {
    compatibleForReport: false,
    classification: "NOT_LEGACY_COMPATIBLE",
    reasons: ["NO_EXPLICIT_LEGACY_COMPATIBILITY_SIGNAL"],
    warnings: [],
  };
}

export function evaluateIntelligenceEligibility(
  item: EpistemicIntegrityCarrier | null | undefined
): IntelligenceEligibility {
  const metadata = normalizeEpistemicMetadata(item);
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (BLOCKED_REPORT_MODES.has(metadata.acquisitionMode)) {
    blockingReasons.push(`ACQUISITION_MODE_NOT_REPORTABLE:${metadata.acquisitionMode}`);
  }

  if (metadata.isSimulated) {
    blockingReasons.push("SIMULATED_CONTENT_NOT_REPORTABLE");
  }

  if (metadata.isConnectivityOnly) {
    blockingReasons.push("CONNECTIVITY_ONLY_NOT_REPORTABLE");
  }

  if (metadata.validationStatus === "PENDING_REVIEW" || metadata.validationStatus === "UNREVIEWED") {
    blockingReasons.push(`VALIDATION_NOT_APPROVED:${metadata.validationStatus}`);
  }

  if (metadata.validationStatus === "REJECTED") {
    blockingReasons.push("VALIDATION_REJECTED");
  }

  if (metadata.validationStatus === "LEGACY_UNCLASSIFIED") {
    warnings.push("LEGACY_UNCLASSIFIED_COMPATIBILITY_READ_ONLY");
  }

  if (metadata.acquisitionMode === "AI_GENERATED" && !REPORTABLE_AI_ROLES.has(metadata.semanticRole || "UNKNOWN")) {
    blockingReasons.push("AI_GENERATED_REQUIRES_EXPLICIT_ANALYTICAL_ROLE");
  }

  if (metadata.acquisitionMode === "DERIVED" && (!metadata.lineage || metadata.lineage.length === 0)) {
    blockingReasons.push("DERIVED_REQUIRES_SOURCE_LINEAGE");
  }

  const eligibleForHumanReview =
    metadata.validationStatus !== "REJECTED" &&
    metadata.acquisitionMode !== "MOCK" &&
    metadata.acquisitionMode !== "TEST" &&
    metadata.acquisitionMode !== "CONNECTIVITY_ONLY";

  const eligibleForApproval =
    eligibleForHumanReview &&
    metadata.validationStatus !== "LEGACY_UNCLASSIFIED" &&
    metadata.acquisitionMode !== "SIMULATED" &&
    metadata.acquisitionMode !== "UNKNOWN";

  return {
    eligibleForAnalysis: metadata.acquisitionMode !== "CONNECTIVITY_ONLY" && metadata.acquisitionMode !== "TEST",
    eligibleForHumanReview,
    eligibleForApproval,
    eligibleForReport: metadata.validationStatus === "APPROVED" && blockingReasons.length === 0,
    blockingReasons,
    warnings,
    normalizedMetadata: metadata,
  };
}

export function isReportEligibleIntelligence(item: EpistemicIntegrityCarrier | null | undefined): boolean {
  return evaluateIntelligenceEligibility(item).eligibleForReport;
}
