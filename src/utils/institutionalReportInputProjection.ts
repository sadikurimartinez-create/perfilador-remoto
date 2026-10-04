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

const ARRAY_CONFLICT_CODES = {
  evidence: "REPORT_INPUT_CONFLICT_ARRAY_EVIDENCE",
  evidences: "REPORT_INPUT_CONFLICT_ARRAY_EVIDENCES",
  photoEvidence: "REPORT_INPUT_CONFLICT_ARRAY_PHOTO_EVIDENCE",
  findings: "REPORT_INPUT_CONFLICT_ARRAY_FINDINGS",
  approvedFindings: "REPORT_INPUT_CONFLICT_ARRAY_APPROVED_FINDINGS",
  inferences: "REPORT_INPUT_CONFLICT_ARRAY_INFERENCES",
  analysisOutputs: "REPORT_INPUT_CONFLICT_ARRAY_ANALYSIS_OUTPUTS",
  aiAnalyticalOutputs: "REPORT_INPUT_CONFLICT_ARRAY_AI_ANALYTICAL_OUTPUTS",
  analyses: "REPORT_INPUT_CONFLICT_ARRAY_ANALYSES",
  conclusions: "REPORT_INPUT_CONFLICT_ARRAY_CONCLUSIONS",
  osint: "REPORT_INPUT_CONFLICT_ARRAY_OSINT",
  osintFindings: "REPORT_INPUT_CONFLICT_ARRAY_OSINT_FINDINGS",
  streetViewAnalysis: "REPORT_INPUT_CONFLICT_ARRAY_STREET_VIEW_ANALYSIS",
  streetView: "REPORT_INPUT_CONFLICT_ARRAY_STREET_VIEW",
  temporalComparisons: "REPORT_INPUT_CONFLICT_ARRAY_TEMPORAL_COMPARISONS",
  convergences: "REPORT_INPUT_CONFLICT_ARRAY_CONVERGENCES",
  sourceOrchestrationItems: "REPORT_INPUT_CONFLICT_ARRAY_SOURCE_ORCHESTRATION_ITEMS",
  denuePois: "REPORT_INPUT_CONFLICT_ARRAY_DENUE_POIS",
  pois: "REPORT_INPUT_CONFLICT_ARRAY_POIS",
  maps: "REPORT_INPUT_CONFLICT_ARRAY_MAPS",
  charts: "REPORT_INPUT_CONFLICT_ARRAY_CHARTS",
  visualProducts: "REPORT_INPUT_CONFLICT_ARRAY_VISUAL_PRODUCTS",
  predictiveAnalyticalProducts: "REPORT_INPUT_CONFLICT_ARRAY_PREDICTIVE_ANALYTICAL_PRODUCTS",
} as const;
const OBJECT_CONFLICT_CODES = {
  crimeIncidenceExportContract: "REPORT_INPUT_CONFLICT_OBJECT_CRIME_INCIDENCE_EXPORT_CONTRACT",
  denueAnalyticalCartographicProductResult: "REPORT_INPUT_CONFLICT_OBJECT_DENUE_ANALYTICAL_CARTOGRAPHIC_PRODUCT_RESULT",
  denueAnalyticalCartographicProduct: "REPORT_INPUT_CONFLICT_OBJECT_DENUE_ANALYTICAL_CARTOGRAPHIC_PRODUCT",
  sourceOrchestration: "REPORT_INPUT_CONFLICT_OBJECT_SOURCE_ORCHESTRATION",
} as const;
export const REPORT_INPUT_CONFLICT_CODES = [
  "REPORT_INPUT_CONFLICT_DUPLICATE_IDENTITY",
  ...Object.values(ARRAY_CONFLICT_CODES), ...Object.values(OBJECT_CONFLICT_CODES),
] as const;
/** Exact closed diagnostic codes only; never parse arbitrary error content. */
export function reportInputConflictDiagnosticCode(error: unknown): string | null {
  try {
    const message = error instanceof Error ? error.message : '';
    return REPORT_INPUT_CONFLICT_CODES.find(code => code === message) ?? null;
  } catch { return null; }
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
    if (previous && canonical(previous) !== canonical(item)) throw new Error("REPORT_INPUT_CONFLICT_DUPLICATE_IDENTITY");
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
      throw new Error(ARRAY_CONFLICT_CODES[field]);
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
    if (top != null && nested != null && canonical(top) !== canonical(nested)) throw new Error(OBJECT_CONFLICT_CODES[field]);
    if (top == null && nested != null) result[field] = nested;
  }
  return { project: result, states };
}
