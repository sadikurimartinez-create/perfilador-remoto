import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { validateLineage, type CanonicalLineageNode, type LineageStatus } from "@/utils/evidenceLineage";
import type { ForensicFileIntegrity } from "@/utils/forensicFileIntegrity";
import { getReportReadyHypothesisInput } from "@/utils/hypothesisGovernance";
import { evaluateHumanValidation } from "@/utils/humanValidationPolicy";
import type { AiAnalyticalOutput } from "@/utils/aiAnalysisGovernance";

export type ReportReadyStatus = "NOT_READY" | "READY_WITH_WARNINGS" | "REPORT_READY";
export type ReportReadyDomain =
  | "GEOGRAPHY"
  | "HYPOTHESIS"
  | "EVIDENCE"
  | "FINDING"
  | "ANALYSIS"
  | "LINEAGE"
  | "HUMAN_VALIDATION"
  | "FORENSIC_INTEGRITY"
  | "SOURCE_INTEGRITY"
  | "SWEEP_LIFECYCLE"
  | "LEGACY";

export interface ReportReadyReason {
  code: string;
  message: string;
  domain: ReportReadyDomain;
  itemId?: string | null;
}

export interface ReportReadyAssessment {
  projectId: string;
  status: ReportReadyStatus;
  assessedAt: string;
  geographyReady: boolean;
  hypothesisReady: boolean;
  evidenceReady: boolean;
  findingsReady: boolean;
  analysisReady: boolean;
  lineageReady: boolean;
  humanValidationReady: boolean;
  forensicIntegrityReady: boolean;
  sourceIntegrityReady: boolean;
  blockingReasons: ReportReadyReason[];
  warnings: ReportReadyReason[];
  unresolvedItems: ReportReadyReason[];
  readyForInstitutionalReport: boolean;
  certified: false;
  published: false;
}

const CRITICAL_HASH_FAILURES = new Set(["HASH_MISMATCH"]);
const CRITICAL_MIME_FAILURES = new Set(["MIME_MISMATCH"]);
const FAILED_SWEEP_STATUSES = new Set(["FAILED", "CANCELLED", "EXPIRED"]);
const UNTRUSTED_SOURCE_STATUSES = new Set(["SIMULATED", "MOCK", "NON_AUTHORITATIVE", "LEGACY_UNCLASSIFIED"]);

function itemId(item: any, fallback: string): string {
  return String(item?.id || item?.evidenceId || item?.findingId || item?.outputId || item?.analysisId || item?.sweepId || fallback);
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function add(target: ReportReadyReason[], domain: ReportReadyDomain, code: string, message: string, id?: string | null) {
  target.push({ domain, code, message, itemId: id ?? null });
}

function collectEvidence(project: any): any[] {
  const direct = [
    ...asArray(project?.evidence),
    ...asArray(project?.evidences),
    ...asArray(project?.photoEvidence),
    ...asArray(project?.album),
  ];
  const docs = asArray(project?.documents)
    .map((doc: any) => doc?.multimodalEvidence || doc)
    .filter(Boolean);
  return [...direct, ...docs];
}

function collectFindings(project: any): any[] {
  return [
    ...asArray(project?.findings),
    ...asArray(project?.approvedFindings),
    ...asArray(project?.streetViewAnalysis).filter((item: any) => item?.findingId || item?.usedInReport),
  ];
}

function collectAnalysis(project: any): AiAnalyticalOutput[] {
  return [
    ...asArray(project?.analysisOutputs),
    ...asArray(project?.aiAnalyticalOutputs),
    ...asArray(project?.analyses),
  ];
}

function isCriticalEvidence(evidence: any): boolean {
  return evidence?.requiredForReport === true || evidence?.usedInReport === true || evidence?.critical === true;
}

function hasEvidenceIdentity(evidence: any): boolean {
  return Boolean(evidence?.evidenceId || evidence?.id || evidence?.multimodalEvidence?.evidenceId);
}

function isEvidenceUsable(evidence: any): boolean {
  const validation = evaluateHumanValidation(evidence?.multimodalEvidence || evidence);
  return hasEvidenceIdentity(evidence) && validation.status !== "REJECTED" && validation.status !== "RETURNED_FOR_REANALYSIS";
}

function integrityOf(evidence: any): ForensicFileIntegrity | null {
  return evidence?.forensicIntegrity || evidence?.multimodalEvidence?.forensicIntegrity || null;
}

function hasCriticalIntegrityFailure(integrity: ForensicFileIntegrity | null): boolean {
  if (!integrity) return false;
  return CRITICAL_HASH_FAILURES.has(integrity.hashStatus) || CRITICAL_MIME_FAILURES.has(integrity.mimeStatus);
}

function lineageOf(item: any): CanonicalLineageNode[] {
  return asArray<CanonicalLineageNode>(item?.lineage || item?.evidenceLineage || item?.multimodalEvidence?.lineage);
}

function lineageStatusOf(item: any): LineageStatus | null {
  const lineage = lineageOf(item);
  if (lineage.length > 0) return validateLineage(lineage).status;
  return item?.lineageStatus || item?.multimodalEvidence?.lineageStatus || null;
}

function isLineageSupported(item: any): boolean {
  const status = lineageStatusOf(item);
  return status === "SUPPORTED" || status === "PARTIALLY_SUPPORTED";
}

function isPendingMandatoryHumanReview(item: any): boolean {
  const validation = evaluateHumanValidation(item?.multimodalEvidence || item);
  return validation.status === "PENDING_REVIEW" || validation.status === "UNREVIEWED";
}

function isHumanApproved(item: any): boolean {
  return evaluateHumanValidation(item?.multimodalEvidence || item).status === "APPROVED";
}

function isUntrustedSource(item: any): boolean {
  const values = [
    item?.acquisitionMode,
    item?.epistemicClass,
    item?.sourceIntegrityStatus,
    item?.sourceStatus,
    item?.sourceType,
    item?.providerType,
  ].map((value) => String(value || "").toUpperCase());
  return values.some((value) => UNTRUSTED_SOURCE_STATUSES.has(value));
}

function sweepSupportsReport(sweep: any, reportEvidenceIds: Set<string>, reportFindingIds: Set<string>): boolean {
  if (sweep?.usedInReport === true || sweep?.requiredForReport === true) return true;
  return asArray<string>(sweep?.outputEvidenceIds).some((id) => reportEvidenceIds.has(id))
    || asArray<string>(sweep?.outputFindingIds).some((id) => reportFindingIds.has(id));
}

export function assessReportReadiness(project: any, options: { assessedAt?: string } = {}): ReportReadyAssessment {
  const assessedAt = options.assessedAt || new Date().toISOString();
  const projectId = String(project?.projectId || project?.id || project?.expedienteId || "UNAVAILABLE");
  const blockingReasons: ReportReadyReason[] = [];
  const warnings: ReportReadyReason[] = [];
  const unresolvedItems: ReportReadyReason[] = [];

  const geography = project?.canonicalGeography as CanonicalProjectGeography | null | undefined;
  const geographyReady = Boolean(geography?.geographyId && geography.validationStatus === "VALID");
  if (!geographyReady) {
    add(blockingReasons, "GEOGRAPHY", "GEOGRAPHY_INVALID_OR_MISSING", "CanonicalProjectGeography VALID is required.");
  }

  const hypothesisInput = getReportReadyHypothesisInput(project);
  const hypothesisReady = hypothesisInput.hypothesisRequirementSatisfied && hypothesisInput.hypothesisStatus !== "REJECTED";
  if (!hypothesisReady) {
    add(blockingReasons, "HYPOTHESIS", "HYPOTHESIS_NOT_FORMULATED", "A human hypothesis FORMULATED or stronger is required.");
  }
  if (hypothesisInput.validationStatus === "LEGACY_UNCLASSIFIED") {
    add(warnings, "LEGACY", "LEGACY_HYPOTHESIS_METADATA_INCOMPLETE", "Legacy hypothesis text is readable but lacks full ADR-020.31 metadata.", hypothesisInput.hypothesisId);
  }

  const evidence = collectEvidence(project);
  const usableEvidence = evidence.filter(isEvidenceUsable);
  const evidenceReady = usableEvidence.length > 0;
  if (!evidenceReady) {
    add(blockingReasons, "EVIDENCE", "VALID_EVIDENCE_MISSING", "At least one usable evidence object is required; raw files alone are insufficient.");
  }

  let forensicIntegrityReady = true;
  for (const ev of evidence) {
    const integrity = integrityOf(ev);
    const id = itemId(ev, "evidence");
    if (hasCriticalIntegrityFailure(integrity)) {
      forensicIntegrityReady = false;
      add(blockingReasons, "FORENSIC_INTEGRITY", "CRITICAL_EVIDENCE_INTEGRITY_FAILURE", "Critical evidence has hash or MIME integrity failure.", id);
    } else if (integrity?.hashStatus === "HASH_UNAVAILABLE" || integrity?.hashStatus === "LEGACY_UNVERIFIED") {
      add(warnings, "FORENSIC_INTEGRITY", "EVIDENCE_HASH_NOT_FULLY_VERIFIED", "Evidence hash is unavailable or legacy-unverified.", id);
    }
  }

  const findings = collectFindings(project);
  const reportFindings = findings.filter((finding) => finding?.usedInReport !== false);
  let findingsReady = true;
  for (const finding of reportFindings) {
    const id = itemId(finding, "finding");
    if (!isLineageSupported(finding)) {
      findingsReady = false;
      add(blockingReasons, "FINDING", "FINDING_UNSUPPORTED_OR_UNTRACEABLE", "Finding used by report must be traceable and supported.", id);
    }
  }

  const analysis = collectAnalysis(project);
  const reportAnalysis = analysis.filter((item: any) => item?.usedInReport !== false);
  let analysisReady = reportAnalysis.length > 0;
  if (!analysisReady) {
    add(blockingReasons, "ANALYSIS", "SUPPORTED_ANALYSIS_MISSING", "At least one supported, human-reviewed analysis object is required.");
  }
  for (const item of reportAnalysis) {
    const id = itemId(item, "analysis");
    if (!isLineageSupported(item)) {
      analysisReady = false;
      add(blockingReasons, "ANALYSIS", "ANALYSIS_UNSUPPORTED_OR_UNTRACEABLE", "Analysis used by report must have supported lineage.", id);
    }
    if (item.acquisitionMode === "AI_GENERATED" && !isHumanApproved(item)) {
      analysisReady = false;
      add(unresolvedItems, "HUMAN_VALIDATION", "AI_ANALYSIS_PENDING_HUMAN_REVIEW", "AI analysis can warn or contextualize, but cannot satisfy readiness before human review.", id);
    }
  }

  let lineageReady = true;
  for (const item of [...reportFindings, ...reportAnalysis]) {
    const id = itemId(item, "lineage");
    const status = lineageStatusOf(item);
    if (status === "BROKEN_REFERENCE" || status === "UNSUPPORTED" || status == null) {
      lineageReady = false;
      add(blockingReasons, "LINEAGE", "REPORT_LINEAGE_UNRESOLVED", "Report consumer cannot resolve required source lineage.", id);
    }
  }

  let humanValidationReady = true;
  for (const item of [...usableEvidence.filter(isCriticalEvidence), ...reportFindings, ...reportAnalysis]) {
    const id = itemId(item, "validation");
    if (isPendingMandatoryHumanReview(item)) {
      humanValidationReady = false;
      add(unresolvedItems, "HUMAN_VALIDATION", "MANDATORY_HUMAN_REVIEW_PENDING", "A report-critical item still requires human validation.", id);
    }
  }

  let sourceIntegrityReady = true;
  for (const item of [...evidence, ...reportFindings, ...reportAnalysis, ...asArray(project?.sources)]) {
    const id = itemId(item, "source");
    if (isUntrustedSource(item)) {
      add(warnings, "SOURCE_INTEGRITY", "SOURCE_NOT_AUTHORITATIVE_FOR_INSTITUTIONAL_REQUIREMENT", "Simulated, non-authoritative, or legacy source is marked as contextual only.", id);
      if (item?.usedAsAuthoritative === true || item?.requiredForReport === true) {
        sourceIntegrityReady = false;
        add(blockingReasons, "SOURCE_INTEGRITY", "UNTRUSTED_SOURCE_USED_AS_AUTHORITATIVE", "Untrusted source cannot satisfy an authoritative institutional requirement.", id);
      }
    }
  }

  const reportEvidenceIds = new Set(usableEvidence.map((ev) => itemId(ev, "evidence")));
  const reportFindingIds = new Set(reportFindings.map((finding) => itemId(finding, "finding")));
  for (const sweep of asArray(project?.sweeps)) {
    const status = String(sweep?.lifecycleStatus || sweep?.lifecycle?.status || sweep?.status || "").toUpperCase();
    if (FAILED_SWEEP_STATUSES.has(status) && sweepSupportsReport(sweep, reportEvidenceIds, reportFindingIds)) {
      add(blockingReasons, "SWEEP_LIFECYCLE", "FAILED_SWEEP_USED_AS_REPORT_SUPPORT", "Sweep support used by report cannot be FAILED, CANCELLED, or EXPIRED.", itemId(sweep, "sweep"));
    }
  }

  const blockerCount = blockingReasons.length + unresolvedItems.length;
  const status: ReportReadyStatus = blockerCount > 0
    ? "NOT_READY"
    : warnings.length > 0
      ? "READY_WITH_WARNINGS"
      : "REPORT_READY";

  return {
    projectId,
    status,
    assessedAt,
    geographyReady,
    hypothesisReady,
    evidenceReady,
    findingsReady,
    analysisReady,
    lineageReady,
    humanValidationReady,
    forensicIntegrityReady,
    sourceIntegrityReady,
    blockingReasons,
    warnings,
    unresolvedItems,
    readyForInstitutionalReport: status === "REPORT_READY" || status === "READY_WITH_WARNINGS",
    certified: false,
    published: false,
  };
}

export function canGenerateInstitutionalReport(project: any): boolean {
  return assessReportReadiness(project).readyForInstitutionalReport;
}

export function assertInstitutionalReportReady(project: any): ReportReadyAssessment {
  const assessment = assessReportReadiness(project);
  if (!assessment.readyForInstitutionalReport) {
    const reasons = [...assessment.blockingReasons, ...assessment.unresolvedItems]
      .map((reason) => reason.code)
      .join(",");
    throw new Error(`REPORT_READY_REQUIRED:${reasons}`);
  }
  return assessment;
}

export function canGenerateDraftReport(_project: any): true {
  return true;
}
