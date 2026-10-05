import type { CrimeDatasetCorpusComponent, CrimeDatasetCorpusQueryScope, CrimeCorpusInterval } from "../types/crimeDatasetCorpusIdentity";

/** Institutional inputs only. Missing dimensions remain null, never inferred from returned incidents. */
export interface CrimeDatasetCorpusCandidate {
  datasetId: string | null;
  datasetName: string | null;
  datasetVersion: string | null;
  sourceOrganization: string | null;
  provenanceStatus: string | null;
  institutionalRegistryReference: string | null;
  temporalStart: string | null;
  temporalEnd: string | null;
  functionalScope: string | null;
  incidentTypes: string[] | null;
  geographicReferences: string[] | null;
}
export type CrimeCorpusMembershipReason = "QUERY_SCOPE_INVALID" | "SCOPE_UNKNOWN" | "TEMPORAL_INVALID"
  | "METADATA_INCOMPLETE" | "PROVENANCE_NOT_VERIFIED" | "IDENTITY_CONTRADICTORY" | "NO_ELIGIBLE_COMPONENTS";
export interface CrimeDatasetCorpusMembershipResolution {
  status: "RESOLVED" | "INVALID";
  eligibleComponents: CrimeDatasetCorpusComponent[];
  rejectedCandidates: Array<{ datasetId: string | null; reasons: CrimeCorpusMembershipReason[] }>;
  queryScope: CrimeDatasetCorpusQueryScope;
  componentCount: number;
  reasons: CrimeCorpusMembershipReason[];
  temporalResolution: Array<CrimeCorpusInterval & { datasetId: string }>;
}
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim();
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function date(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const time = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === v;
}
function signature(c: CrimeDatasetCorpusCandidate): string {
  return JSON.stringify([c.datasetName,c.datasetVersion,c.sourceOrganization,c.provenanceStatus,
    c.institutionalRegistryReference,c.temporalStart,c.temporalEnd,c.functionalScope,
    c.incidentTypes === null ? null : [...c.incidentTypes].sort(order),
    c.geographicReferences === null ? null : [...c.geographicReferences].sort(order)]);
}

/** Membership is not component/corpus admission. No rows, limits, SQL or spatial distances are accepted. */
export function resolveCrimeDatasetCorpusMembership(
  candidates: readonly CrimeDatasetCorpusCandidate[], queryScope: CrimeDatasetCorpusQueryScope
): CrimeDatasetCorpusMembershipResolution {
  const result: CrimeDatasetCorpusMembershipResolution = { status: "INVALID", eligibleComponents: [],
    rejectedCandidates: [], queryScope: JSON.parse(JSON.stringify({ functionalScope: queryScope.functionalScope,
      temporalFilters: queryScope.temporalFilters, incidentTypes: queryScope.incidentTypes,
      geographicReference: queryScope.geographicReference })), componentCount: 0, reasons: [], temporalResolution: [] };
  const temporal = queryScope?.temporalFilters;
  if (!text(queryScope?.functionalScope) || !text(queryScope?.geographicReference)
    || !Array.isArray(queryScope?.incidentTypes) || !queryScope.incidentTypes.every(text) || !temporal
    || ![temporal.start, temporal.end].every(v => v === null || date(v))
    || (temporal.start !== null && temporal.end !== null && temporal.start > temporal.end)) {
    result.reasons = ["QUERY_SCOPE_INVALID"]; return result;
  }
  const groups = new Map<string, CrimeDatasetCorpusCandidate[]>();
  for (const c of candidates) {
    const key = text(c.datasetId) ? c.datasetId : "";
    groups.set(key, [...(groups.get(key) || []), c]);
  }
  for (const [id, group] of [...groups].sort(([a], [b]) => order(a,b))) {
    const c = group[0];
    const reasons: CrimeCorpusMembershipReason[] = [];
    if (new Set(group.map(signature)).size > 1) reasons.push("IDENTITY_CONTRADICTORY");
    if (reasons.length) { result.rejectedCandidates.push({ datasetId: id || null, reasons }); continue; }
    // Exclude only demonstrably irrelevant candidates. Unknown scope cannot silently exclude one.
    if (text(c.functionalScope) && c.functionalScope !== queryScope.functionalScope) continue;
    if (!text(c.functionalScope)) reasons.push("SCOPE_UNKNOWN");
    if (!date(c.temporalStart) || !date(c.temporalEnd) || c.temporalStart > c.temporalEnd) reasons.push("TEMPORAL_INVALID");
    else if ((temporal.end !== null && c.temporalStart > temporal.end)
      || (temporal.start !== null && c.temporalEnd < temporal.start)) continue;
    if (queryScope.incidentTypes.length) {
      if (c.incidentTypes === null || !c.incidentTypes.every(text)) reasons.push("SCOPE_UNKNOWN");
      else if (!queryScope.incidentTypes.some(t => c.incidentTypes!.includes(t))) continue;
    }
    // Unknown geographic applicability remains a candidate; spatial admission is a later gate.
    if (c.geographicReferences !== null) {
      if (!c.geographicReferences.every(text)) reasons.push("SCOPE_UNKNOWN");
      else if (!c.geographicReferences.includes(queryScope.geographicReference)) continue;
    }
    if (![c.datasetId,c.datasetName,c.datasetVersion,c.sourceOrganization,c.institutionalRegistryReference].every(text)
      || (text(c.datasetId) && c.datasetId !== c.datasetId.trim())) reasons.push("METADATA_INCOMPLETE");
    if (c.provenanceStatus !== "VERIFIED") reasons.push("PROVENANCE_NOT_VERIFIED");
    if (reasons.length) { result.rejectedCandidates.push({ datasetId: id || null, reasons: [...new Set(reasons)].sort(order) }); continue; }
    result.eligibleComponents.push({ datasetId: c.datasetId!, datasetName: c.datasetName!, datasetVersion: c.datasetVersion!,
      sourceOrganization: c.sourceOrganization!, provenanceStatus: "VERIFIED", institutionalRegistryReference: c.institutionalRegistryReference!,
      temporalCoverage: { start: c.temporalStart!, end: c.temporalEnd! } });
    result.temporalResolution.push({ datasetId: c.datasetId!, start: temporal.start !== null && temporal.start > c.temporalStart! ? temporal.start : c.temporalStart!,
      end: temporal.end !== null && temporal.end < c.temporalEnd! ? temporal.end : c.temporalEnd! });
  }
  result.componentCount = result.eligibleComponents.length;
  result.reasons = [...new Set(result.rejectedCandidates.flatMap(c => c.reasons))].sort(order);
  if (!result.componentCount) result.reasons.push("NO_ELIGIBLE_COMPONENTS");
  result.status = result.reasons.length ? "INVALID" : "RESOLVED";
  return result;
}
