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

export const ROOT_INPUT_SOURCES = {
  evidence: "ROOT_EVIDENCE",
  evidences: "ROOT_EVIDENCES",
  photoEvidence: "ROOT_PHOTO_EVIDENCE",
  findings: "ROOT_FINDINGS",
  approvedFindings: "ROOT_APPROVED_FINDINGS",
  inferences: "ROOT_INFERENCES",
  analysisOutputs: "ROOT_ANALYSIS_OUTPUTS",
  aiAnalyticalOutputs: "ROOT_AI_ANALYTICAL_OUTPUTS",
  analyses: "ROOT_ANALYSES",
  conclusions: "ROOT_CONCLUSIONS",
  osint: "ROOT_OSINT",
  osintFindings: "ROOT_OSINT_FINDINGS",
  streetViewAnalysis: "ROOT_STREET_VIEW_ANALYSIS",
  streetView: "ROOT_STREET_VIEW",
  temporalComparisons: "ROOT_TEMPORAL_COMPARISONS",
  convergences: "ROOT_CONVERGENCES",
  sourceOrchestrationItems: "ROOT_SOURCE_ORCHESTRATION_ITEMS",
  denuePois: "ROOT_DENUE_POIS",
  pois: "ROOT_POIS",
  maps: "ROOT_MAPS",
  charts: "ROOT_CHARTS",
  visualProducts: "ROOT_VISUAL_PRODUCTS",
  predictiveAnalyticalProducts: "ROOT_PREDICTIVE_ANALYTICAL_PRODUCTS",
} as const;
const IA_INPUT_SOURCES = {
  evidence: "IA_ANALYSIS_EVIDENCE",
  evidences: "IA_ANALYSIS_EVIDENCES",
  photoEvidence: "IA_ANALYSIS_PHOTO_EVIDENCE",
  findings: "IA_ANALYSIS_FINDINGS",
  approvedFindings: "IA_ANALYSIS_APPROVED_FINDINGS",
  inferences: "IA_ANALYSIS_INFERENCES",
  analysisOutputs: "IA_ANALYSIS_ANALYSIS_OUTPUTS",
  aiAnalyticalOutputs: "IA_ANALYSIS_AI_ANALYTICAL_OUTPUTS",
  analyses: "IA_ANALYSIS_ANALYSES",
  conclusions: "IA_ANALYSIS_CONCLUSIONS",
  osint: "IA_ANALYSIS_OSINT",
  osintFindings: "IA_ANALYSIS_OSINT_FINDINGS",
  streetViewAnalysis: "IA_ANALYSIS_STREET_VIEW_ANALYSIS",
  streetView: "IA_ANALYSIS_STREET_VIEW",
  temporalComparisons: "IA_ANALYSIS_TEMPORAL_COMPARISONS",
  convergences: "IA_ANALYSIS_CONVERGENCES",
  sourceOrchestrationItems: "IA_ANALYSIS_SOURCE_ORCHESTRATION_ITEMS",
  denuePois: "IA_ANALYSIS_DENUE_POIS",
  pois: "IA_ANALYSIS_POIS",
  maps: "IA_ANALYSIS_MAPS",
  charts: "IA_ANALYSIS_CHARTS",
  visualProducts: "IA_ANALYSIS_VISUAL_PRODUCTS",
  predictiveAnalyticalProducts: "IA_ANALYSIS_PREDICTIVE_ANALYTICAL_PRODUCTS",
} as const;
export const REPORT_INPUT_SOURCE_LABELS = [
  ...Object.values(ROOT_INPUT_SOURCES), ...Object.values(IA_INPUT_SOURCES),
  "ROOT_SOURCE_ORCHESTRATION_ITEMS_NESTED", "ORCHESTRATION_ORIGINAL",
  "ORCHESTRATION_ADAPTED_OSINT", "ORCHESTRATION_ADAPTED_DENUE", "ORCHESTRATION_ADAPTED_IN_SITU_PHOTO",
] as const;
export function safeReportInputSource(value: unknown): string {
  return REPORT_INPUT_SOURCE_LABELS.find(label => label === value) ?? "UNKNOWN_SOURCE";
}
export class ReportInputDuplicateIdentityConflict extends Error {
  readonly code = "REPORT_INPUT_CONFLICT_DUPLICATE_IDENTITY";
  readonly leftSource: string;
  readonly rightSource: string;
  constructor(leftSource: unknown, rightSource: unknown) {
    super("REPORT_INPUT_CONFLICT_DUPLICATE_IDENTITY");
    this.leftSource = safeReportInputSource(leftSource);
    this.rightSource = safeReportInputSource(rightSource);
  }
}

function canonical(value: any): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

export function distinctInstitutionalInputs(items: any[], field: string, sources: readonly unknown[] = []): any[] {
  const records = new Map<string, any>();
  const recordSources = new Map<string, string>();
  let sourceIndex = 0;
  for (const item of items) {
    const source = safeReportInputSource(sources[sourceIndex++]);
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`REPORT_INPUT_INVALID:${field}`);
    const identity = item.outputId || item.analysisId || item.findingId || item.evidenceId || item.convergenceId || item.itemId || item.id;
    const key = identity ? String(identity) : canonical(item);
    const previous = records.get(key);
    if (previous && canonical(previous) !== canonical(item)) throw new ReportInputDuplicateIdentityConflict(recordSources.get(key), source);
    records.set(key, item);
    recordSources.set(key, source);
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
    const a = distinctInstitutionalInputs(top || [], field, (top || []).map(() => ROOT_INPUT_SOURCES[field])), b = distinctInstitutionalInputs(nested || [], field, (nested || []).map(() => IA_INPUT_SOURCES[field]));
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
