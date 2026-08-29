import type { EpistemicValidationStatus } from "@/types/epistemicIntegrity";

export type CanonicalHumanValidationStatus =
  | "UNREVIEWED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED_FOR_REANALYSIS"
  | "LEGACY_UNCLASSIFIED";

export type HumanValidationAction = "APPROVE" | "REJECT" | "RETURN_FOR_REANALYSIS";

export type HumanValidationSource =
  | "ADR_020_24_HUMAN_ACTION"
  | "CANONICAL_FIELD"
  | "LEGACY_COMPATIBILITY"
  | "TECHNICAL_BOOLEAN"
  | "AI_READY"
  | "ABSENT";

export interface HumanValidationDecision {
  status: CanonicalHumanValidationStatus;
  source: HumanValidationSource;
  isInstitutionalApproval: boolean;
  isLegacyCompatibleApproval: boolean;
  reportEligibilityLabel: "REPORT_ELIGIBLE" | "NOT_REPORT_ELIGIBLE";
  validatedBy: any | null;
  validatedAt: string | null;
  warnings: string[];
}

const CANONICAL_STATUSES = new Set([
  "UNREVIEWED",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "RETURNED_FOR_REANALYSIS",
  "LEGACY_UNCLASSIFIED",
]);

const LEGACY_APPROVED_STATUSES = new Set(["APPROVED_EVIDENCE", "APROBADO", "APPROVED"]);
const LEGACY_REJECTED_STATUSES = new Set(["REJECTED_FINDING", "RECHAZADO", "IGNORADO"]);
const LEGACY_PENDING_STATUSES = new Set(["PENDING_REVIEW", "PENDIENTE_REVISION", "GENERATED", "GENERADO"]);

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function hasRealValidator(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some((v) => typeof v === "string" ? v.trim().length > 0 : v != null);
}

export function evaluateHumanValidation(input: any): HumanValidationDecision {
  const item = input || {};
  const explicit = normalizeString(item.humanValidationStatus ?? item.validationStatus ?? item.epistemicIntegrity?.validationStatus ?? item.epistemic?.validationStatus);
  const legacy = normalizeString(item.status ?? item.estado ?? item.estado_revision ?? item.analystValidationStatus);
  const validatedBy = item.validatedBy ?? item.validatorIdentity ?? item.validator ?? null;
  const validatedAt = item.validatedAt ?? item.validationDate ?? null;

  if (CANONICAL_STATUSES.has(explicit)) {
    const status = explicit as CanonicalHumanValidationStatus;
    return {
      status,
      source: "CANONICAL_FIELD",
      isInstitutionalApproval: status === "APPROVED",
      isLegacyCompatibleApproval: false,
      reportEligibilityLabel: status === "APPROVED" ? "REPORT_ELIGIBLE" : "NOT_REPORT_ELIGIBLE",
      validatedBy: hasRealValidator(validatedBy) ? validatedBy : null,
      validatedAt: typeof validatedAt === "string" && validatedAt.trim() ? validatedAt : null,
      warnings: [],
    };
  }

  if (LEGACY_APPROVED_STATUSES.has(legacy)) {
    return {
      status: "APPROVED",
      source: "LEGACY_COMPATIBILITY",
      isInstitutionalApproval: false,
      isLegacyCompatibleApproval: true,
      reportEligibilityLabel: "REPORT_ELIGIBLE",
      validatedBy: null,
      validatedAt: null,
      warnings: ["LEGACY_APPROVAL_COMPATIBILITY_NOT_ADR_020_24_INSTITUTIONAL_APPROVAL"],
    };
  }

  if (LEGACY_REJECTED_STATUSES.has(legacy)) {
    return {
      status: "REJECTED",
      source: "LEGACY_COMPATIBILITY",
      isInstitutionalApproval: false,
      isLegacyCompatibleApproval: false,
      reportEligibilityLabel: "NOT_REPORT_ELIGIBLE",
      validatedBy: null,
      validatedAt: null,
      warnings: ["LEGACY_REJECTION_COMPATIBILITY"],
    };
  }

  if (LEGACY_PENDING_STATUSES.has(legacy)) {
    return {
      status: "PENDING_REVIEW",
      source: "LEGACY_COMPATIBILITY",
      isInstitutionalApproval: false,
      isLegacyCompatibleApproval: false,
      reportEligibilityLabel: "NOT_REPORT_ELIGIBLE",
      validatedBy: null,
      validatedAt: null,
      warnings: ["LEGACY_PENDING_COMPATIBILITY"],
    };
  }

  if (item.validado === true || item.isAudited === true) {
    return {
      status: "LEGACY_UNCLASSIFIED",
      source: "TECHNICAL_BOOLEAN",
      isInstitutionalApproval: false,
      isLegacyCompatibleApproval: false,
      reportEligibilityLabel: "NOT_REPORT_ELIGIBLE",
      validatedBy: null,
      validatedAt: null,
      warnings: ["TECHNICAL_BOOLEAN_IS_NOT_HUMAN_APPROVAL"],
    };
  }

  if (normalizeString(item.analysisStatus) === "READY_FOR_HUMAN_REVIEW") {
    return {
      status: "PENDING_REVIEW",
      source: "AI_READY",
      isInstitutionalApproval: false,
      isLegacyCompatibleApproval: false,
      reportEligibilityLabel: "NOT_REPORT_ELIGIBLE",
      validatedBy: null,
      validatedAt: null,
      warnings: ["AI_READY_IS_NOT_HUMAN_APPROVAL"],
    };
  }

  return {
    status: "UNREVIEWED",
    source: "ABSENT",
    isInstitutionalApproval: false,
    isLegacyCompatibleApproval: false,
    reportEligibilityLabel: "NOT_REPORT_ELIGIBLE",
    validatedBy: null,
    validatedAt: null,
    warnings: [],
  };
}

export function canonicalToEpistemicValidationStatus(
  status: CanonicalHumanValidationStatus
): EpistemicValidationStatus {
  return status;
}

export function applyHumanValidationAction(input: {
  action: HumanValidationAction;
  validatorIdentity?: any | null;
  validatedAt?: string | null;
}) {
  const statusByAction: Record<HumanValidationAction, CanonicalHumanValidationStatus> = {
    APPROVE: "APPROVED",
    REJECT: "REJECTED",
    RETURN_FOR_REANALYSIS: "RETURNED_FOR_REANALYSIS",
  };
  const validatedBy = hasRealValidator(input.validatorIdentity) ? input.validatorIdentity : null;

  return {
    humanValidationStatus: statusByAction[input.action],
    validatedAt: input.validatedAt ?? new Date().toISOString(),
    validatedBy,
    validationSource: "ADR_020_24_HUMAN_ACTION" as const,
  };
}
