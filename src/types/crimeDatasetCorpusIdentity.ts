import type { CrimeDatasetGeographicCoverage } from "./crimeDatasetIdentity";

export interface CrimeCorpusInterval { start: string; end: string }
export interface CrimeDatasetCorpusComponent {
  datasetId: string;
  datasetName: string;
  datasetVersion: string;
  sourceOrganization: string;
  temporalCoverage: CrimeCorpusInterval;
  provenanceStatus: "VERIFIED";
  institutionalRegistryReference: string;
}
export interface CrimeDatasetCorpusQueryScope {
  functionalScope: string;
  temporalFilters: { start: string | null; end: string | null };
  incidentTypes: string[];
  geographicReference: string;
}
export interface CrimeDatasetCorpusTemporalCoverage {
  componentIntervals: Array<CrimeCorpusInterval & { datasetId: string }>;
  coveredIntervals: CrimeCorpusInterval[];
  /** Descriptive extremes only; never proof of continuity. */
  coverageEnvelope: CrimeCorpusInterval | null;
  coverageContinuity: "CONTINUOUS" | "DISCONTINUOUS" | "UNKNOWN";
  effectiveQueryIntervals: CrimeCorpusInterval[];
}
export interface CrimeDatasetCorpusLineage {
  queryReference: string;
  componentReferences: Array<{ datasetId: string; institutionalRegistryReference: string }>;
}
export interface CrimeDatasetCorpusValidationSummary {
  status: "VALID" | "INVALID" | "NOT_EVALUATED";
  structuralValidationOnly: true;
  codes: string[];
}
export interface CrimeDatasetCorpusIdentity {
  schemaVersion: "ADR02231_CORPUS_V1";
  components: CrimeDatasetCorpusComponent[];
  componentCount: number;
  sourceType: string;
  sourceName: string;
  queryScope: CrimeDatasetCorpusQueryScope;
  geographicCoverage: CrimeDatasetGeographicCoverage;
  temporalCoverage: CrimeDatasetCorpusTemporalCoverage;
  validationSummary: CrimeDatasetCorpusValidationSummary;
  lineage: CrimeDatasetCorpusLineage;
}
export type CrimeDatasetCorpusStructuralValidation =
  | { valid: true; codes: [] }
  | { valid: false; codes: ["CORPUS_STRUCTURE_INVALID"] };

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim();
function date(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const parsed = new Date(`${v}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
}
function interval(v: unknown): v is CrimeCorpusInterval {
  return object(v) && date(v.start) && date(v.end) && v.start <= v.end;
}
const ordered = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Structural validation only; does not admit components or a corpus for use. */
export function validateCrimeDatasetCorpusIdentity(value: unknown): CrimeDatasetCorpusStructuralValidation {
  const invalid: CrimeDatasetCorpusStructuralValidation = { valid: false, codes: ["CORPUS_STRUCTURE_INVALID"] };
  if (!object(value) || value.schemaVersion !== "ADR02231_CORPUS_V1" || !text(value.sourceType) || !text(value.sourceName)
    || !Array.isArray(value.components) || !value.components.length || value.componentCount !== value.components.length) return invalid;
  const components = value.components;
  if (components.some(c => !object(c) || ![c.datasetId, c.datasetName, c.datasetVersion, c.sourceOrganization,
    c.institutionalRegistryReference].every(text) || c.datasetId !== c.datasetId.trim()
    || c.provenanceStatus !== "VERIFIED" || !interval(c.temporalCoverage))) return invalid;
  if (new Set(components.map(c => c.datasetId)).size !== components.length) return invalid;
  const scope = value.queryScope;
  if (!object(scope) || !text(scope.functionalScope) || !text(scope.geographicReference)
    || !Array.isArray(scope.incidentTypes) || !scope.incidentTypes.every(text) || !object(scope.temporalFilters)
    || ![scope.temporalFilters.start, scope.temporalFilters.end].every(v => v === null || date(v))
    || (scope.temporalFilters.start !== null && scope.temporalFilters.end !== null
      && scope.temporalFilters.start > scope.temporalFilters.end)) return invalid;
  const geo = value.geographicCoverage;
  if (!object(geo) || !["IN_COVERAGE", "OUT_OF_COVERAGE", "UNKNOWN_COVERAGE"].includes(geo.status)
    || !["IN_SCOPE", "OUT_OF_SCOPE", "UNKNOWN"].includes(geo.scopeCompatibility)) return invalid;
  const temporal = value.temporalCoverage;
  if (!object(temporal) || !["CONTINUOUS", "DISCONTINUOUS", "UNKNOWN"].includes(temporal.coverageContinuity)
    || !Array.isArray(temporal.componentIntervals) || temporal.componentIntervals.length !== components.length
    || !Array.isArray(temporal.coveredIntervals) || !temporal.coveredIntervals.length
    || !Array.isArray(temporal.effectiveQueryIntervals)
    || !temporal.coveredIntervals.every(interval) || !temporal.effectiveQueryIntervals.every(interval)
    || (temporal.coverageEnvelope !== null && !interval(temporal.coverageEnvelope))) return invalid;
  const ids = new Set<string>();
  for (const item of temporal.componentIntervals) {
    const datasetId: unknown = object(item) ? item.datasetId : null;
    if (!interval(item) || !text(datasetId) || ids.has(datasetId)) return invalid;
    ids.add(datasetId);
    const component = components.find(c => c.datasetId === datasetId);
    if (!component || component.temporalCoverage.start !== item.start || component.temporalCoverage.end !== item.end) return invalid;
  }
  // Validate the union from the actual component intervals, never from the envelope.
  const union: CrimeCorpusInterval[] = [];
  for (const item of [...temporal.componentIntervals].sort((a, b) => ordered(a.start, b.start) || ordered(a.end, b.end))) {
    const last = union[union.length - 1];
    const adjacent = last && Date.parse(`${item.start}T00:00:00Z`) - Date.parse(`${last.end}T00:00:00Z`) <= 86400000;
    if (last && adjacent) { if (item.end > last.end) last.end = item.end; }
    else union.push({ start: item.start, end: item.end });
  }
  const covered = [...temporal.coveredIntervals].sort((a, b) => ordered(a.start, b.start));
  if (JSON.stringify(covered.map(i => [i.start, i.end])) !== JSON.stringify(union.map(i => [i.start, i.end]))) return invalid;
  if (temporal.coverageEnvelope && (temporal.coverageEnvelope.start !== union[0].start
    || temporal.coverageEnvelope.end !== union[union.length - 1].end)) return invalid;
  if (temporal.coverageContinuity !== "UNKNOWN"
    && temporal.coverageContinuity !== (union.length === 1 ? "CONTINUOUS" : "DISCONTINUOUS")) return invalid;
  if (temporal.effectiveQueryIntervals.some(i => !union.some(u => i.start >= u.start && i.end <= u.end)
    || (scope.temporalFilters.start !== null && i.start < scope.temporalFilters.start)
    || (scope.temporalFilters.end !== null && i.end > scope.temporalFilters.end))) return invalid;
  const lineage = value.lineage;
  if (!object(lineage) || !text(lineage.queryReference) || !Array.isArray(lineage.componentReferences)
    || lineage.componentReferences.length !== components.length) return invalid;
  const refs = new Set<string>();
  for (const ref of lineage.componentReferences) {
    if (!object(ref) || !text(ref.datasetId) || refs.has(ref.datasetId)) return invalid;
    refs.add(ref.datasetId);
    const component = components.find(c => c.datasetId === ref.datasetId);
    if (!component || component.institutionalRegistryReference !== ref.institutionalRegistryReference) return invalid;
  }
  const summary = value.validationSummary;
  if (!object(summary) || summary.structuralValidationOnly !== true || !["VALID", "INVALID", "NOT_EVALUATED"].includes(summary.status)
    || !Array.isArray(summary.codes) || !summary.codes.every(text)) return invalid;
  return { valid: true, codes: [] };
}

/** Returns a copy in deterministic ID order; rejects rather than dropping duplicates. */
export function normalizeCrimeDatasetCorpusIdentity(value: CrimeDatasetCorpusIdentity): CrimeDatasetCorpusIdentity {
  if (!validateCrimeDatasetCorpusIdentity(value).valid) throw new Error("CORPUS_STRUCTURE_INVALID");
  const copy: CrimeDatasetCorpusIdentity = JSON.parse(JSON.stringify(value));
  copy.components.sort((a, b) => ordered(a.datasetId, b.datasetId));
  copy.temporalCoverage.componentIntervals.sort((a, b) => ordered(a.datasetId, b.datasetId));
  copy.lineage.componentReferences.sort((a, b) => ordered(a.datasetId, b.datasetId));
  copy.temporalCoverage.coveredIntervals.sort((a, b) => ordered(a.start, b.start));
  copy.temporalCoverage.effectiveQueryIntervals.sort((a, b) => ordered(a.start, b.start) || ordered(a.end, b.end));
  return copy;
}
