/** Persisted top-level inputs precede iaAnalysis. Empty arrays are not tombstones.
 * Conflicting non-empty copies require reconciliation, never an implicit merge.
 * This projection does not admit or promote an item; publication gates still apply.
 */
export const REPORT_INPUT_ARRAY_FIELDS = [
  "evidence", "evidences", "photoEvidence", "findings", "approvedFindings",
  "inferences", "analysisOutputs", "aiAnalyticalOutputs", "analyses", "conclusions",
  "osint", "osintFindings", "streetViewAnalysis", "streetView", "temporalComparisons",
  "convergences", "sourceOrchestrationItems", "denuePois", "pois", "maps", "charts",
  "visualProducts", "predictiveAnalyticalProducts",
] as const;
export type ReportInputArrayField = typeof REPORT_INPUT_ARRAY_FIELDS[number];
export type ReportInputAvailability = "MISSING" | "EXCLUDED" | "ACCESS_DENIED" | "NOT_EXECUTED" | "EMPTY_VALID" | "INVALID" | "AVAILABLE";
export interface ReportInputProjectionState {
  state: ReportInputAvailability;
  source: "TOP_LEVEL" | "IA_ANALYSIS" | null;
  count: number;
}

function canonical(value: any): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

export function distinctInstitutionalInputs(items: any[], field: string): any[] {
  const records = new Map<string, any>();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`REPORT_INPUT_INVALID:${field}`);
    const identity = item.outputId || item.analysisId || item.findingId || item.evidenceId || item.convergenceId || item.itemId || item.id;
    const key = identity ? String(identity) : canonical(item);
    const previous = records.get(key);
    if (previous && canonical(previous) !== canonical(item)) throw new Error(`REPORT_INPUT_CONFLICT:${field}:${key}`);
    records.set(key, item);
  }
  return [...records.values()];
}

export function projectPersistedInstitutionalInputs(project: any): {
  project: any; states: Partial<Record<ReportInputArrayField, ReportInputProjectionState>>;
} {
  const result = { ...project };
  const states: Partial<Record<ReportInputArrayField, ReportInputProjectionState>> = {};
  for (const field of REPORT_INPUT_ARRAY_FIELDS) {
    const top = project?.[field], nested = project?.iaAnalysis?.[field];
    if ((top != null && !Array.isArray(top)) || (nested != null && !Array.isArray(nested))) {
      throw new Error(`REPORT_INPUT_INVALID:${field}`);
    }
    const a = distinctInstitutionalInputs(top || [], field), b = distinctInstitutionalInputs(nested || [], field);
    if (a.length && b.length && canonical(a.map(canonical).sort()) !== canonical(b.map(canonical).sort())) {
      throw new Error(`REPORT_INPUT_CONFLICT:${field}:TOP_LEVEL_IA_ANALYSIS`);
    }
    const source = a.length ? "TOP_LEVEL" : b.length ? "IA_ANALYSIS" : top != null ? "TOP_LEVEL" : nested != null ? "IA_ANALYSIS" : null;
    const chosen = a.length ? a : b;
    if (source) result[field] = chosen;
    const acquisition = project?.inputAcquisitionStates?.[field];
    const absentState: ReportInputAvailability = ["ACCESS_DENIED", "NOT_EXECUTED", "INVALID", "EXCLUDED"].includes(acquisition)
      ? acquisition : source ? "EMPTY_VALID" : "MISSING";
    states[field] = { source, count: chosen.length, state: chosen.length ? "AVAILABLE" : absentState };
  }
  for (const field of ["crimeIncidenceExportContract", "denueAnalyticalCartographicProductResult", "denueAnalyticalCartographicProduct", "sourceOrchestration"] as const) {
    const top = project?.[field], nested = project?.iaAnalysis?.[field];
    if (top != null && nested != null && canonical(top) !== canonical(nested)) throw new Error(`REPORT_INPUT_CONFLICT:${field}`);
    if (top == null && nested != null) result[field] = nested;
  }
  return { project: result, states };
}
