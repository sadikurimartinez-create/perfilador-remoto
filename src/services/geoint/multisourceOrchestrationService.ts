import type {
  InstitutionalSourceEligibility,
  MultisourceOrchestrationEnvelope,
  MultisourceOrchestrationItem,
  MultisourceSourceDescriptor,
  SourceDependencyRelation,
  SourceDependencyType,
} from "@/types/multisourceOrchestration";

function present(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalized(value: string | undefined): string | undefined {
  return present(value)?.toUpperCase();
}

function isNonProductiveToken(value: string | undefined): boolean {
  const token = normalized(value);
  return Boolean(
    token &&
    (token.includes("SIMULAT") ||
      token.includes("MOCK") ||
      token.includes("DEMO") ||
      token.includes("FAKE") ||
      token.includes("STUB"))
  );
}

export function evaluateSourceEligibility(
  source: MultisourceSourceDescriptor
): InstitutionalSourceEligibility {
  if (
    source.authorityClassification === "SIMULATED" ||
    source.integrityClassification === "SIMULATED" ||
    source.authorityClassification === "NON_AUTHORITATIVE" ||
    isNonProductiveToken(source.sourceId) ||
    isNonProductiveToken(source.providerId) ||
    isNonProductiveToken(source.rawSourceReference)
  ) {
    return "INELIGIBLE";
  }

  if (
    source.authorityClassification === "LEGACY_UNCLASSIFIED" ||
    source.authorityClassification === "UNKNOWN" ||
    source.integrityClassification === "READY_WITH_LIMITATIONS" ||
    source.integrityClassification === "LEGACY_UNCLASSIFIED" ||
    source.integrityClassification === "UNKNOWN" ||
    source.integrityClassification === "NOT_READY"
  ) {
    return "LIMITED";
  }

  return "ELIGIBLE";
}

function same(a?: string, b?: string): boolean {
  const left = normalized(a);
  const right = normalized(b);
  return Boolean(left && right && left === right);
}

export function classifySourceDependency(
  left: MultisourceOrchestrationItem,
  right: MultisourceOrchestrationItem
): SourceDependencyType {
  if (same(left.source.captureId, right.source.captureId)) return "SAME_CAPTURE";
  if (same(left.source.operationId, right.source.operationId)) return "SAME_OPERATION";
  if (
    same(left.source.rawSourceReference, right.source.rawSourceReference) ||
    same(left.source.sourceReference, right.source.sourceReference)
  ) return "SAME_ORIGIN";
  if (same(left.source.providerId, right.source.providerId)) return "SAME_PROVIDER";
  if (same(left.source.sourceId, right.source.sourceId)) return "DERIVED";

  const leftProvider = present(left.source.providerId);
  const rightProvider = present(right.source.providerId);
  const leftOrigin = present(left.source.rawSourceReference || left.source.sourceReference);
  const rightOrigin = present(right.source.rawSourceReference || right.source.sourceReference);

  if (leftProvider && rightProvider && leftOrigin && rightOrigin) return "INDEPENDENT";
  return "UNKNOWN_DEPENDENCY";
}

function relation(
  left: MultisourceOrchestrationItem,
  right: MultisourceOrchestrationItem
): SourceDependencyRelation {
  const dependencyType = classifySourceDependency(left, right);
  return {
    leftItemId: left.itemId,
    rightItemId: right.itemId,
    dependencyType,
    countsAsIndependentCorroboration:
      dependencyType === "INDEPENDENT" &&
      left.eligibility === "ELIGIBLE" &&
      right.eligibility === "ELIGIBLE",
  };
}

export function buildMultisourceOrchestrationEnvelope(
  expedienteId: string | null | undefined,
  inputItems: Array<Omit<MultisourceOrchestrationItem, "eligibility">>
): MultisourceOrchestrationEnvelope {
  const items: MultisourceOrchestrationItem[] = inputItems.map((item) => ({
    ...item,
    eligibility: evaluateSourceEligibility(item.source),
  }));

  const dependencyRelations: SourceDependencyRelation[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      dependencyRelations.push(relation(items[i], items[j]));
    }
  }

  const eligible = items.filter((item) => item.eligibility === "ELIGIBLE");
  const eligibleIds = new Set(eligible.map((item) => item.itemId));
  const adjacency = new Map<string, Set<string>>();

  for (const item of eligible) {
    adjacency.set(item.itemId, new Set());
  }

  for (const rel of dependencyRelations) {
    if (rel.dependencyType === "INDEPENDENT") continue;
    if (!eligibleIds.has(rel.leftItemId) || !eligibleIds.has(rel.rightItemId)) continue;

    adjacency.get(rel.leftItemId)?.add(rel.rightItemId);
    adjacency.get(rel.rightItemId)?.add(rel.leftItemId);
  }

  const visited = new Set<string>();
  const groups: string[][] = [];

  for (const item of eligible) {
    if (visited.has(item.itemId)) continue;

    const component: string[] = [];
    const stack = [item.itemId];
    visited.add(item.itemId);

    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);

      for (const neighbor of adjacency.get(current) || []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        stack.push(neighbor);
      }
    }

    groups.push(component);
  }

  const corroborationGroups = groups.map((itemIds, index) => ({
    groupId: `corroboration-group-${index + 1}`,
    itemIds,
    institutionallyEligibleItemIds: [...itemIds],
  }));

  return {
    ...(present(expedienteId) ? { expedienteId: present(expedienteId) } : {}),
    items,
    dependencyRelations,
    corroborationGroups,
    totalItems: items.length,
    eligibleItems: eligible.length,
    independentEligibleSources: corroborationGroups.length,
  };
}
