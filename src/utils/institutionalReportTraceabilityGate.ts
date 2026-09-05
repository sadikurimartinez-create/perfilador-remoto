import {
  validateInstitutionalEvidenceTraceability,
  type InstitutionalEvidenceTraceabilityInput,
} from "@/utils/institutionalEvidenceTraceabilityGuard";
import { validateLineage, type CanonicalLineageNode } from "@/utils/evidenceLineage";

export type InstitutionalReportTraceabilityStatus =
  | "INSTITUTIONAL_PUBLICATION_ELIGIBLE"
  | "CONTEXTUAL_ONLY"
  | "INSTITUTIONAL_PUBLICATION_BLOCKED";

export type InstitutionalReportTraceabilityItemType =
  | "EVIDENCE"
  | "FINDING"
  | "ANALYSIS"
  | "STREET_VIEW";

export interface InstitutionalReportTraceabilityExclusion {
  itemId: string;
  itemType: InstitutionalReportTraceabilityItemType;
  reasonCode: string;
  reason: string;
}

export interface InstitutionalReportTraceabilityItemResult {
  itemId: string;
  itemType: InstitutionalReportTraceabilityItemType;
  eligible: boolean;
  contextualOnly: boolean;
  reasons: string[];
  missingFields: string[];
  exclusionCodes: string[];
}

export interface InstitutionalReportTraceabilityGateInput {
  projectId?: string | null;
  evidence?: any[];
  findings?: any[];
  analyses?: any[];
  streetView?: any[];
}

export interface InstitutionalReportTraceabilityGateResult {
  eligibleForInstitutionalPublication: boolean;
  eligibleForDraft: true;
  status: InstitutionalReportTraceabilityStatus;
  exclusions: InstitutionalReportTraceabilityExclusion[];
  reasons: string[];
  evidenceSummary: {
    total: number;
    eligible: number;
    contextualOnly: number;
    excluded: number;
  };
  findingSummary: {
    total: number;
    eligible: number;
    contextualOnly: number;
    excluded: number;
  };
  analysisSummary: {
    total: number;
    eligible: number;
    contextualOnly: number;
    excluded: number;
  };
  streetViewSummary: {
    total: number;
    eligible: number;
    contextualOnly: number;
    excluded: number;
  };
  itemResults: InstitutionalReportTraceabilityItemResult[];
}

const ACCEPTED_LINEAGE_STATUSES = new Set(["SUPPORTED", "COMPLETE"]);
const CONTEXTUAL_MARKERS = new Set([
  "LEGACY",
  "LEGACY_UNCLASSIFIED",
  "LEGACY_PARTIAL",
  "CONTEXTUAL",
  "CONTEXTUAL_EVIDENCE",
  "MOCK",
  "SIMULATED",
  "NON_AUTHORITATIVE",
]);

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function itemId(item: any, type: InstitutionalReportTraceabilityItemType): string {
  return String(
    item?.id ||
    item?.evidenceId ||
    item?.findingId ||
    item?.analysisId ||
    item?.outputId ||
    item?.traceabilityId ||
    `${type}-UNAVAILABLE`
  );
}

function lineage(item: any): CanonicalLineageNode[] {
  return asArray<CanonicalLineageNode>(item?.lineage || item?.evidenceLineage || item?.multimodalEvidence?.lineage);
}

function lineageStatus(item: any): string | null {
  const explicit = clean(item?.lineageStatus || item?.multimodalEvidence?.lineageStatus);
  if (explicit) return explicit;
  const nodes = lineage(item);
  return nodes.length ? validateLineage(nodes).status : null;
}

function lineageRefs(item: any) {
  const nodes = lineage(item);
  return {
    geographyId: clean(item?.geographyId || item?.multimodalEvidence?.geographyId)
      || clean(nodes.find((node) => node.geographyId)?.geographyId),
    evidenceIds: [
      ...asArray<string>(item?.evidenceIds),
      ...asArray<string>(item?.supportingEvidenceIds),
      ...asArray<string>(item?.sourceEvidenceIds),
      clean(item?.sourceEvidenceId),
      clean(item?.evidenceId),
      clean(item?.multimodalEvidence?.evidenceId),
      ...nodes.flatMap((node) => [
        node.evidenceId,
        ...(node.supportingEvidenceIds || []),
      ]),
    ].filter(Boolean) as string[],
    sourceIds: [
      clean(item?.sourceId),
      clean(item?.sourceEvidenceId),
      ...asArray<string>(item?.sourceIds),
      ...asArray<string>(item?.sourceEvidenceIds),
      ...nodes.map((node) => node.sourceId).filter(Boolean),
    ].filter(Boolean) as string[],
  };
}

function hasContextualMarker(item: any): boolean {
  if (item?.legacy === true || item?.contextual === true) return true;
  const markers = [
    item?.sourceStatus,
    item?.sourceType,
    item?.sourceIntegrityStatus,
    item?.lineageStatus,
    item?.evidenceClass,
    item?.evidenceCategoryClass,
    item?.acquisitionMode,
    item?.publicationRole,
  ];
  return markers.some((marker) => CONTEXTUAL_MARKERS.has(String(marker || "").toUpperCase()));
}

function exclusion(
  item: any,
  type: InstitutionalReportTraceabilityItemType,
  reasonCode: string,
  reason: string
): InstitutionalReportTraceabilityExclusion {
  return { itemId: itemId(item, type), itemType: type, reasonCode, reason };
}

function codeForEvidenceReason(reason: string): string {
  if (reason.includes("missing geographyId")) return "EVIDENCE_EXCLUDED_MISSING_GEOGRAPHY";
  if (reason.includes("missing sourceEvidenceId")) return "EVIDENCE_EXCLUDED_MISSING_SOURCE";
  if (reason.includes("missing traceabilityId")) return "EVIDENCE_EXCLUDED_MISSING_TRACEABILITY";
  if (reason.includes("missing expedienteId")) return "EVIDENCE_EXCLUDED_MISSING_EXPEDIENTE";
  if (reason.includes("missing lineageStatus") || reason.includes("invalid lineageStatus")) return "EVIDENCE_EXCLUDED_INCOMPLETE_LINEAGE";
  if (reason.includes("coordinates")) return "EVIDENCE_EXCLUDED_INVALID_COORDINATES";
  if (reason.includes("contextual evidence")) return "EVIDENCE_EXCLUDED_CONTEXTUAL_ONLY";
  return "EVIDENCE_EXCLUDED_TRACEABILITY_INCOMPLETE";
}

function evaluateEvidence(item: any, type: "EVIDENCE" | "STREET_VIEW"): InstitutionalReportTraceabilityItemResult {
  const traceability = validateInstitutionalEvidenceTraceability(item as InstitutionalEvidenceTraceabilityInput);
  const contextualOnly = traceability.status === "CONTEXTUAL_ONLY" || hasContextualMarker(item);
  const reasons = [...traceability.reasons];
  const missingFields = [...traceability.missingFields];
  const exclusionCodes = traceability.reasons.map(codeForEvidenceReason);

  if (!clean(item?.sourceEvidenceId)) {
    if (!missingFields.includes("sourceEvidenceId")) missingFields.push("sourceEvidenceId");
    reasons.push("missing explicit sourceEvidenceId");
    exclusionCodes.push("EVIDENCE_EXCLUDED_MISSING_SOURCE");
  }

  return {
    itemId: itemId(item, type),
    itemType: type,
    eligible: traceability.eligible && Boolean(clean(item?.sourceEvidenceId)),
    contextualOnly,
    reasons,
    missingFields,
    exclusionCodes: Array.from(new Set(exclusionCodes)),
  };
}

function evaluateFinding(item: any): InstitutionalReportTraceabilityItemResult {
  const refs = lineageRefs(item);
  const status = lineageStatus(item);
  const missingFields: string[] = [];
  const reasons: string[] = [];
  const exclusionCodes: string[] = [];

  if (!clean(item?.id) && !clean(item?.findingId)) missingFields.push("id");
  if (!clean(item?.traceabilityId)) missingFields.push("traceabilityId");
  if (!clean(item?.sourceEvidenceId) && refs.evidenceIds.length === 0) missingFields.push("sourceEvidenceId");
  if (!clean(item?.expedienteId) && !clean(item?.projectId)) missingFields.push("expedienteId");
  if (!refs.geographyId) missingFields.push("geographyId");
  if (!status || !ACCEPTED_LINEAGE_STATUSES.has(status)) missingFields.push("lineageStatus");

  for (const field of missingFields) {
    reasons.push(`missing ${field}`);
  }
  if (missingFields.includes("sourceEvidenceId")) exclusionCodes.push("FINDING_EXCLUDED_MISSING_SOURCE");
  if (missingFields.includes("geographyId")) exclusionCodes.push("FINDING_EXCLUDED_MISSING_GEOGRAPHY");
  if (missingFields.includes("traceabilityId")) exclusionCodes.push("FINDING_EXCLUDED_MISSING_TRACEABILITY");
  if (missingFields.includes("lineageStatus")) exclusionCodes.push("FINDING_EXCLUDED_INCOMPLETE_LINEAGE");
  if (missingFields.includes("id") || missingFields.includes("expedienteId")) exclusionCodes.push("FINDING_EXCLUDED_TRACEABILITY_INCOMPLETE");

  const contextualOnly = hasContextualMarker(item);
  if (contextualOnly) {
    reasons.push("contextual finding cannot be certified as institutional finding");
    exclusionCodes.push("FINDING_EXCLUDED_CONTEXTUAL_ONLY");
  }

  return {
    itemId: itemId(item, "FINDING"),
    itemType: "FINDING",
    eligible: reasons.length === 0,
    contextualOnly,
    reasons,
    missingFields,
    exclusionCodes: Array.from(new Set(exclusionCodes)),
  };
}

function evaluateAnalysis(item: any): InstitutionalReportTraceabilityItemResult {
  const refs = lineageRefs(item);
  const status = lineageStatus(item);
  const missingFields: string[] = [];
  const reasons: string[] = [];
  const exclusionCodes: string[] = [];

  if (!clean(item?.id) && !clean(item?.analysisId) && !clean(item?.outputId)) missingFields.push("analysisId");
  if (!clean(item?.traceabilityId) && !clean(item?.traceabilityReference)) missingFields.push("traceabilityId");
  if (!clean(item?.expedienteId) && !clean(item?.projectId)) missingFields.push("expedienteId");
  if (!status || !ACCEPTED_LINEAGE_STATUSES.has(status)) missingFields.push("lineageStatus");
  if (refs.evidenceIds.length === 0 && refs.sourceIds.length === 0) missingFields.push("evidenceReferences");

  for (const field of missingFields) {
    reasons.push(`missing ${field}`);
  }
  if (missingFields.includes("lineageStatus") || missingFields.includes("evidenceReferences")) {
    exclusionCodes.push("ANALYSIS_EXCLUDED_INCOMPLETE_LINEAGE");
  }
  if (missingFields.includes("traceabilityId")) exclusionCodes.push("ANALYSIS_EXCLUDED_MISSING_TRACEABILITY");
  if (missingFields.includes("analysisId") || missingFields.includes("expedienteId")) exclusionCodes.push("ANALYSIS_EXCLUDED_TRACEABILITY_INCOMPLETE");

  const contextualOnly = hasContextualMarker(item);
  if (contextualOnly) {
    reasons.push("contextual analysis cannot be certified as institutional analysis");
    exclusionCodes.push("ANALYSIS_EXCLUDED_CONTEXTUAL_ONLY");
  }

  return {
    itemId: itemId(item, "ANALYSIS"),
    itemType: "ANALYSIS",
    eligible: reasons.length === 0,
    contextualOnly,
    reasons,
    missingFields,
    exclusionCodes: Array.from(new Set(exclusionCodes)),
  };
}

function summarize(
  results: InstitutionalReportTraceabilityItemResult[],
  type: InstitutionalReportTraceabilityItemType
) {
  const typed = results.filter((item) => item.itemType === type);
  return {
    total: typed.length,
    eligible: typed.filter((item) => item.eligible).length,
    contextualOnly: typed.filter((item) => item.contextualOnly).length,
    excluded: typed.filter((item) => !item.eligible).length,
  };
}

function exclusionsFrom(results: InstitutionalReportTraceabilityItemResult[]): InstitutionalReportTraceabilityExclusion[] {
  return results
    .filter((item) => !item.eligible)
    .flatMap((item) =>
      (item.exclusionCodes.length ? item.exclusionCodes : [`${item.itemType}_EXCLUDED_TRACEABILITY_INCOMPLETE`])
        .map((code) => ({
          itemId: item.itemId,
          itemType: item.itemType,
          reasonCode: code,
          reason: item.reasons.join("; ") || "Item does not satisfy institutional traceability.",
        }))
    );
}

export function validateInstitutionalReportTraceability(
  input: InstitutionalReportTraceabilityGateInput
): InstitutionalReportTraceabilityGateResult {
  const evidence = asArray(input.evidence);
  const findings = asArray(input.findings);
  const analyses = asArray(input.analyses);
  const streetView = asArray(input.streetView);

  const itemResults = [
    ...evidence.map((item) => evaluateEvidence(item, "EVIDENCE")),
    ...findings.map(evaluateFinding),
    ...analyses.map(evaluateAnalysis),
    ...streetView.map((item) => evaluateEvidence(item, "STREET_VIEW")),
  ];

  const exclusions = exclusionsFrom(itemResults);
  const eligibleEvidenceCount = itemResults.filter((item) =>
    (item.itemType === "EVIDENCE" || item.itemType === "STREET_VIEW") && item.eligible
  ).length;
  const eligibleFindingCount = itemResults.filter((item) => item.itemType === "FINDING" && item.eligible).length;
  const eligibleAnalysisCount = itemResults.filter((item) => item.itemType === "ANALYSIS" && item.eligible).length;

  const reasons: string[] = [];
  if (evidence.length + streetView.length > 0 && eligibleEvidenceCount === 0) {
    reasons.push("institutional evidence traceability missing");
  }
  if (findings.length > 0 && eligibleFindingCount === 0) {
    reasons.push("institutional finding traceability missing");
  }
  if (analyses.length > 0 && eligibleAnalysisCount === 0) {
    reasons.push("institutional analysis lineage missing");
  }

  const eligibleForInstitutionalPublication = reasons.length === 0;
  const onlyContextual = itemResults.length > 0 && itemResults.every((item) => item.contextualOnly || !item.eligible);

  return {
    eligibleForInstitutionalPublication,
    eligibleForDraft: true,
    status: eligibleForInstitutionalPublication
      ? "INSTITUTIONAL_PUBLICATION_ELIGIBLE"
      : onlyContextual
        ? "CONTEXTUAL_ONLY"
        : "INSTITUTIONAL_PUBLICATION_BLOCKED",
    exclusions,
    reasons,
    evidenceSummary: summarize(itemResults, "EVIDENCE"),
    findingSummary: summarize(itemResults, "FINDING"),
    analysisSummary: summarize(itemResults, "ANALYSIS"),
    streetViewSummary: summarize(itemResults, "STREET_VIEW"),
    itemResults,
  };
}
