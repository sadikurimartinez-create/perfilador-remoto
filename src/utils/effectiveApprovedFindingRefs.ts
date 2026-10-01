import { compactFindingRef } from "./projectRootReconciliation";

/** Read projection only: preserves stored refs and overlays canonically approved findings. */
export function deriveEffectiveApprovedFindingRefs(storedRefs: unknown, findings: unknown): any[] {
  const byId = new Map<string, any>();
  const stored = Array.isArray(storedRefs) ? storedRefs : [];
  for (const ref of stored) {
    const id = ref?.findingId || ref?.id || ref?.traceabilityId;
    if (id) byId.set(id, ref);
  }
  for (const finding of Array.isArray(findings) ? findings : []) {
    if (finding?.estado !== "APPROVED_EVIDENCE" &&
        String(finding?.humanValidationStatus || "").toUpperCase() !== "APPROVED") continue;
    const ref = compactFindingRef(finding);
    if (ref) byId.set(ref.findingId, ref);
  }
  return [...byId.values()];
}
