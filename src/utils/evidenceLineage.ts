export type LineageNodeType = "SOURCE" | "EVIDENCE" | "FINDING" | "INFERENCE" | "ANALYSIS" | "CONCLUSION";

export type LineageStatus =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "UNSUPPORTED"
  | "BROKEN_REFERENCE"
  | "LEGACY_UNCLASSIFIED";

export interface CanonicalLineageNode {
  id: string;
  type: LineageNodeType;
  sourceId?: string | null;
  sourceReference?: string | null;
  evidenceId?: string | null;
  findingId?: string | null;
  inferenceId?: string | null;
  analysisId?: string | null;
  conclusionId?: string | null;
  supportingEvidenceIds?: string[];
  derivedFromFindingIds?: string[];
  supportingFindingIds?: string[];
  supportingInferenceIds?: string[];
  supportingAnalysisIds?: string[];
  semanticRole?: string | null;
  lineageStatus?: LineageStatus;
}

export interface LineageValidationResult {
  status: LineageStatus;
  blockingReasons: string[];
  warnings: string[];
  forwardPath: string[];
  reversePath: string[];
  unsupportedFindingIds: string[];
  unsupportedAnalysisIds: string[];
  unsupportedConclusionIds: string[];
  brokenReferenceIds: string[];
}

export function buildEvidenceLineage(input: {
  sourceId?: string | null;
  sourceReference?: string | null;
  evidenceId: string;
  findingId?: string | null;
  inferenceId?: string | null;
  analysisId?: string | null;
  conclusionId?: string | null;
}): CanonicalLineageNode[] {
  const nodes: CanonicalLineageNode[] = [];
  if (input.sourceId || input.sourceReference) {
    nodes.push({
      id: input.sourceId || input.sourceReference!,
      type: "SOURCE",
      sourceId: input.sourceId ?? null,
      sourceReference: input.sourceReference ?? null,
    });
  }
  nodes.push({
    id: input.evidenceId,
    type: "EVIDENCE",
    evidenceId: input.evidenceId,
    sourceId: input.sourceId ?? null,
    sourceReference: input.sourceReference ?? null,
  });
  if (input.findingId) {
    nodes.push({
      id: input.findingId,
      type: "FINDING",
      findingId: input.findingId,
      supportingEvidenceIds: [input.evidenceId],
    });
  }
  if (input.inferenceId && input.findingId) {
    nodes.push({
      id: input.inferenceId,
      type: "INFERENCE",
      inferenceId: input.inferenceId,
      derivedFromFindingIds: [input.findingId],
    });
  }
  if (input.analysisId) {
    nodes.push({
      id: input.analysisId,
      type: "ANALYSIS",
      analysisId: input.analysisId,
      supportingFindingIds: input.findingId ? [input.findingId] : [],
      supportingInferenceIds: input.inferenceId ? [input.inferenceId] : [],
    });
  }
  if (input.conclusionId && input.analysisId) {
    nodes.push({
      id: input.conclusionId,
      type: "CONCLUSION",
      conclusionId: input.conclusionId,
      supportingAnalysisIds: [input.analysisId],
    });
  }
  return nodes;
}

function ids(nodes: CanonicalLineageNode[], type: LineageNodeType): Set<string> {
  return new Set(nodes.filter((node) => node.type === type).map((node) => node.id));
}

function pushUnique(target: string[], values: Array<string | null | undefined>) {
  for (const value of values) {
    if (value && !target.includes(value)) target.push(value);
  }
}

export function validateLineage(nodes: CanonicalLineageNode[] | null | undefined): LineageValidationResult {
  if (!nodes || nodes.length === 0) {
    return {
      status: "LEGACY_UNCLASSIFIED",
      blockingReasons: ["NO_LINEAGE"],
      warnings: ["LEGACY_OBJECT_WITHOUT_LINEAGE_PRESERVED"],
      forwardPath: [],
      reversePath: [],
      unsupportedFindingIds: [],
      unsupportedAnalysisIds: [],
      unsupportedConclusionIds: [],
      brokenReferenceIds: [],
    };
  }

  const evidenceIds = ids(nodes, "EVIDENCE");
  const findingIds = ids(nodes, "FINDING");
  const inferenceIds = ids(nodes, "INFERENCE");
  const analysisIds = ids(nodes, "ANALYSIS");
  const unsupportedFindingIds: string[] = [];
  const unsupportedAnalysisIds: string[] = [];
  const unsupportedConclusionIds: string[] = [];
  const brokenReferenceIds: string[] = [];

  for (const node of nodes) {
    if (node.type === "FINDING") {
      const refs = node.supportingEvidenceIds || [];
      if (refs.length === 0) unsupportedFindingIds.push(node.id);
      refs.filter((ref) => !evidenceIds.has(ref)).forEach((ref) => pushUnique(brokenReferenceIds, [ref]));
    }

    if (node.type === "INFERENCE") {
      const refs = node.derivedFromFindingIds || [];
      if (refs.length === 0) brokenReferenceIds.push(`${node.id}:MISSING_FINDING_REF`);
      refs.filter((ref) => !findingIds.has(ref)).forEach((ref) => pushUnique(brokenReferenceIds, [ref]));
    }

    if (node.type === "ANALYSIS") {
      const findingRefs = node.supportingFindingIds || [];
      const inferenceRefs = node.supportingInferenceIds || [];
      if (findingRefs.length === 0 && inferenceRefs.length === 0) unsupportedAnalysisIds.push(node.id);
      findingRefs.filter((ref) => !findingIds.has(ref)).forEach((ref) => pushUnique(brokenReferenceIds, [ref]));
      inferenceRefs.filter((ref) => !inferenceIds.has(ref)).forEach((ref) => pushUnique(brokenReferenceIds, [ref]));
    }

    if (node.type === "CONCLUSION") {
      const refs = node.supportingAnalysisIds || [];
      if (refs.length === 0) unsupportedConclusionIds.push(node.id);
      refs.filter((ref) => !analysisIds.has(ref)).forEach((ref) => pushUnique(brokenReferenceIds, [ref]));
    }
  }

  for (const node of nodes) {
    const selfRefs = [
      ...(node.supportingEvidenceIds || []),
      ...(node.derivedFromFindingIds || []),
      ...(node.supportingFindingIds || []),
      ...(node.supportingInferenceIds || []),
      ...(node.supportingAnalysisIds || []),
    ].filter((ref) => ref === node.id);
    if (selfRefs.length > 0) pushUnique(brokenReferenceIds, selfRefs);
  }

  const blockingReasons: string[] = [];
  if (unsupportedFindingIds.length > 0) blockingReasons.push("UNSUPPORTED_FINDING");
  if (unsupportedAnalysisIds.length > 0) blockingReasons.push("UNSUPPORTED_ANALYSIS");
  if (unsupportedConclusionIds.length > 0) blockingReasons.push("UNSUPPORTED_CONCLUSION");
  if (brokenReferenceIds.length > 0) blockingReasons.push("BROKEN_REFERENCE");

  const forwardPath: string[] = [];
  const reversePath: string[] = [];
  for (const type of ["SOURCE", "EVIDENCE", "FINDING", "INFERENCE", "ANALYSIS", "CONCLUSION"] as LineageNodeType[]) {
    pushUnique(forwardPath, nodes.filter((node) => node.type === type).map((node) => `${type}:${node.id}`));
  }
  for (const type of ["CONCLUSION", "ANALYSIS", "INFERENCE", "FINDING", "EVIDENCE", "SOURCE"] as LineageNodeType[]) {
    pushUnique(reversePath, nodes.filter((node) => node.type === type).map((node) => `${type}:${node.id}`));
  }

  const status =
    brokenReferenceIds.length > 0
      ? "BROKEN_REFERENCE"
      : blockingReasons.length === 0
        ? "SUPPORTED"
        : blockingReasons.length < nodes.length
          ? "PARTIALLY_SUPPORTED"
          : "UNSUPPORTED";

  return {
    status,
    blockingReasons,
    warnings: [],
    forwardPath,
    reversePath,
    unsupportedFindingIds,
    unsupportedAnalysisIds,
    unsupportedConclusionIds,
    brokenReferenceIds,
  };
}

export function buildStreetViewFindingLineage(input: {
  findingId: string;
  evidenceId?: string | null;
  sourceReference?: string | null;
}): CanonicalLineageNode[] {
  if (!input.evidenceId) {
    return [{ id: input.findingId, type: "FINDING", findingId: input.findingId, supportingEvidenceIds: [] }];
  }
  return buildEvidenceLineage({
    sourceId: input.sourceReference || "GOOGLE_STREET_VIEW",
    sourceReference: input.sourceReference || "Google Street View",
    evidenceId: input.evidenceId,
    findingId: input.findingId,
  });
}
