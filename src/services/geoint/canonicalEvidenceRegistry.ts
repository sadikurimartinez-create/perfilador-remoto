import type {
  CanonicalEvidenceRef,
  CanonicalFindingRef,
  CanonicalNativeType,
  CanonicalReferenceCompleteness,
} from "@/types/canonicalEvidenceRegistry";

type SourceType = CanonicalEvidenceRef["sourceType"];

export interface AdaptEvidenceInput {
  expedienteId?: string | null;
  nativeEvidenceId?: string | null;
  nativeType: CanonicalNativeType;
  sourceType: SourceType;
  sourceId?: string | null;
  sweepId?: string | null;
  operationId?: string | null;
  eventId?: string | null;
  traceabilityId?: string | null;
  geographyId?: string | null;
  legacy?: boolean;
}

export interface AdaptFindingInput {
  expedienteId?: string | null;
  nativeFindingId?: string | null;
  nativeType: CanonicalNativeType;
  sourceType: SourceType;
  sourceFindingId?: string | null;
  sourceId?: string | null;
  supportingEvidenceRefs?: CanonicalEvidenceRef[];
  requiredEvidenceRefCount?: number;
  sweepId?: string | null;
  operationId?: string | null;
  eventId?: string | null;
  traceabilityId?: string | null;
  geographyId?: string | null;
  legacy?: boolean;
}

function present(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function technicalRegistryRefId(
  entityType: "EVIDENCE" | "FINDING",
  nativeType: CanonicalNativeType,
  expedienteId: string | undefined,
  anchorId: string
): string {
  return ["registry-ref", entityType.toLowerCase(), nativeType.toLowerCase(), expedienteId || "no-expediente", anchorId]
    .map((part) => encodeURIComponent(part))
    .join("::");
}

export function evaluateLineageCompleteness(input: {
  entityType: "EVIDENCE" | "FINDING";
  expedienteId?: string;
  nativeId?: string;
  sourceId?: string;
  supportingEvidenceRefs?: CanonicalEvidenceRef[];
  requiredEvidenceRefCount?: number;
  legacy?: boolean;
}): CanonicalReferenceCompleteness {
  const hasAnchor = Boolean(input.nativeId || input.sourceId);
  if (!hasAnchor) return "UNAVAILABLE";

  const requiredEvidenceRefCount = input.requiredEvidenceRefCount || 1;
  const supportingEvidenceRefs = input.supportingEvidenceRefs || [];
  const hasRequiredCompleteEvidence =
    supportingEvidenceRefs.length >= requiredEvidenceRefCount
    && supportingEvidenceRefs
      .slice(0, requiredEvidenceRefCount)
      .every((ref) => ref.lineageStatus === "COMPLETE");

  const complete = input.entityType === "EVIDENCE"
    ? Boolean(input.expedienteId && input.nativeId && input.sourceId)
    : Boolean(
      input.expedienteId
      && input.nativeId
      && hasRequiredCompleteEvidence
    );

  if (complete) return "COMPLETE";
  return input.legacy ? "LEGACY_PARTIAL" : "PARTIAL";
}

export function adaptEvidence(input: AdaptEvidenceInput): CanonicalEvidenceRef | null {
  const expedienteId = present(input.expedienteId);
  const nativeEvidenceId = present(input.nativeEvidenceId);
  const sourceId = present(input.sourceId);
  const anchorId = nativeEvidenceId || sourceId || present(input.traceabilityId);
  if (!anchorId) return null;

  return {
    registryRefId: technicalRegistryRefId("EVIDENCE", input.nativeType, expedienteId, anchorId),
    entityType: "EVIDENCE",
    ...(expedienteId ? { expedienteId } : {}),
    ...(nativeEvidenceId ? { nativeEvidenceId } : {}),
    nativeType: input.nativeType,
    sourceType: input.sourceType,
    ...(sourceId ? { sourceId } : {}),
    ...(present(input.sweepId) ? { sweepId: present(input.sweepId) } : {}),
    ...(present(input.operationId) ? { operationId: present(input.operationId) } : {}),
    ...(present(input.eventId) ? { eventId: present(input.eventId) } : {}),
    ...(present(input.traceabilityId) ? { traceabilityId: present(input.traceabilityId) } : {}),
    ...(present(input.geographyId) ? { geographyId: present(input.geographyId) } : {}),
    lineageStatus: evaluateLineageCompleteness({
      entityType: "EVIDENCE",
      expedienteId,
      nativeId: nativeEvidenceId,
      sourceId,
      legacy: input.legacy,
    }),
  };
}

function uniqueEvidenceRefs(refs: CanonicalEvidenceRef[]): CanonicalEvidenceRef[] {
  return Array.from(new Map(refs.map((ref) => [ref.registryRefId, ref])).values());
}

export function adaptFinding(input: AdaptFindingInput): CanonicalFindingRef | null {
  const expedienteId = present(input.expedienteId);
  const nativeFindingId = present(input.nativeFindingId);
  const sourceFindingId = present(input.sourceFindingId);
  const sourceId = present(input.sourceId);
  const anchorId = nativeFindingId || sourceFindingId || sourceId || present(input.traceabilityId);
  if (!anchorId) return null;
  const supportingEvidenceRefs = uniqueEvidenceRefs(input.supportingEvidenceRefs || []);

  return {
    registryRefId: technicalRegistryRefId("FINDING", input.nativeType, expedienteId, anchorId),
    entityType: "FINDING",
    ...(expedienteId ? { expedienteId } : {}),
    ...(nativeFindingId ? { nativeFindingId } : {}),
    nativeType: input.nativeType,
    sourceType: input.sourceType,
    ...(sourceFindingId ? { sourceFindingId } : {}),
    ...(sourceId ? { sourceId } : {}),
    supportingEvidenceRefs,
    ...(present(input.sweepId) ? { sweepId: present(input.sweepId) } : {}),
    ...(present(input.operationId) ? { operationId: present(input.operationId) } : {}),
    ...(present(input.eventId) ? { eventId: present(input.eventId) } : {}),
    ...(present(input.traceabilityId) ? { traceabilityId: present(input.traceabilityId) } : {}),
    ...(present(input.geographyId) ? { geographyId: present(input.geographyId) } : {}),
    lineageStatus: evaluateLineageCompleteness({
      entityType: "FINDING",
      expedienteId,
      nativeId: nativeFindingId,
      sourceId: sourceFindingId || sourceId,
      supportingEvidenceRefs,
      requiredEvidenceRefCount: input.requiredEvidenceRefCount,
      legacy: input.legacy,
    }),
  };
}

export function linkFindingToEvidence(
  finding: CanonicalFindingRef,
  evidenceRefs: CanonicalEvidenceRef[]
): CanonicalFindingRef {
  const supportingEvidenceRefs = uniqueEvidenceRefs([...finding.supportingEvidenceRefs, ...evidenceRefs]);
  return {
    ...finding,
    supportingEvidenceRefs,
    lineageStatus: evaluateLineageCompleteness({
      entityType: "FINDING",
      expedienteId: finding.expedienteId,
      nativeId: finding.nativeFindingId,
      sourceId: finding.sourceFindingId || finding.sourceId,
      supportingEvidenceRefs,
      legacy: finding.lineageStatus === "LEGACY_PARTIAL",
    }),
  };
}
