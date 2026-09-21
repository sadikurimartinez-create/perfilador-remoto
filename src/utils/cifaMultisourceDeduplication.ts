export interface CifaSourceObservation {
  providerId: string | null;
  providerName: string | null;
  sourceType: string | null;
  sourceReference: string | null;
  sourceUrl: string | null;
  query: string | null;
  providerQuery: string | null;
  publishedAt: string | null;
  observedAt: string | null;
  acquiredAt: string | null;
}

export interface CifaDeduplicatedRecord extends Record<string, unknown> {
  sourceObservations: CifaSourceObservation[];
}

export interface CifaDeduplicationResult {
  records: CifaDeduplicatedRecord[];
  inputCount: number;
  outputCount: number;
  duplicatesCollapsed: number;
}

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
]);

export function canonicalizeCifaUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeCifaTitle(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function normalizedDay(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

function observation(record: Record<string, any>): CifaSourceObservation {
  const provenance = record.provenance && typeof record.provenance === "object" ? record.provenance : {};
  return {
    providerId: record.providerId ?? provenance.providerId ?? null,
    providerName: record.providerName ?? provenance.providerName ?? record.sourceName ?? null,
    sourceType: record.sourceType ?? provenance.sourceType ?? null,
    sourceReference: record.sourceReference ?? provenance.sourceReference ?? null,
    sourceUrl: record.sourceUrl ?? record.link ?? record.url ?? provenance.sourceUrl ?? null,
    query: record.query ?? provenance.query ?? null,
    providerQuery: record.providerQuery ?? provenance.providerQuery ?? null,
    publishedAt: record.publishedAt ?? null,
    observedAt: record.observedAt ?? null,
    acquiredAt: record.acquiredAt ?? provenance.acquiredAt ?? null,
  };
}

function keysFor(record: Record<string, any>, index: number): string[] {
  const canonicalUrl = canonicalizeCifaUrl(record.sourceUrl ?? record.link ?? record.url);
  const normalizedTitle = normalizeCifaTitle(record.title ?? record.titular);
  const day = normalizedDay(record.publishedAt ?? record.date);
  const keys: string[] = [];
  if (canonicalUrl) keys.push(`url:${canonicalUrl}`);
  if (normalizedTitle && day) keys.push(`title-day:${normalizedTitle}:${day}`);
  if (keys.length === 0) keys.push(`unique:${index}`);
  return keys;
}

export function deduplicateCifaRecords(collections: unknown[]): CifaDeduplicationResult {
  const input = collections.flatMap((value) => Array.isArray(value) ? value : []);
  const groups: Array<{ record: Record<string, any>; observations: CifaSourceObservation[]; keys: Set<string> }> = [];
  const keyToGroup = new Map<string, number>();

  input.forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return;
    const record = candidate as Record<string, any>;
    const keys = keysFor(record, index);
    const existingIndex = keys.map((key) => keyToGroup.get(key)).find((value) => value !== undefined);
    if (existingIndex === undefined) {
      const groupIndex = groups.length;
      groups.push({ record, observations: [observation(record)], keys: new Set(keys) });
      keys.forEach((key) => keyToGroup.set(key, groupIndex));
      return;
    }

    const group = groups[existingIndex];
    group.observations.push(observation(record));
    keys.forEach((key) => {
      group.keys.add(key);
      keyToGroup.set(key, existingIndex);
    });
  });

  const records = groups.map((group) => ({
    ...group.record,
    canonicalUrl: canonicalizeCifaUrl(group.record.sourceUrl ?? group.record.link ?? group.record.url),
    sourceObservations: group.observations,
  }));

  return {
    records,
    inputCount: input.length,
    outputCount: records.length,
    duplicatesCollapsed: Math.max(0, input.length - records.length),
  };
}
