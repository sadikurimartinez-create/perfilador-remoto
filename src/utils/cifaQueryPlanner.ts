export type CifaQueryProvider =
  | "NEWS_API"
  | "GDELT_DOC"
  | "GDELT_CONTEXT"
  | "GDELT_GEO"
  | "BLUESKY"
  | "FEDIVERSE"
  | "OFFICIAL_CEIPOL";

export interface CifaProviderQueryPlan {
  originalQuery: string;
  providerQuery: string;
  providerQueries?: string[];
  provider: CifaQueryProvider;
}

const QUERY_LIMITS: Record<CifaQueryProvider, number> = {
  NEWS_API: 500,
  GDELT_DOC: 500,
  GDELT_CONTEXT: 500,
  GDELT_GEO: 500,
  BLUESKY: 256,
  FEDIVERSE: 256,
  OFFICIAL_CEIPOL: 256,
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function lexicalQuery(value: string): string {
  return normalizeWhitespace(value.replace(/\s+(?:OR|AND)\s+/gi, " ").replace(/[()]/g, " "));
}

function scopedOrQueries(value: string): { booleanQuery: string; lexicalQueries: string[] } | null {
  const clauses = value.split(/\s+OR\s+/i).map((clause) => lexicalQuery(clause)).filter(Boolean);
  if (clauses.length < 2) return null;

  const firstTokens = clauses[0].split(" ").filter(Boolean);
  const hasUnambiguousScope = firstTokens.length > 1 && clauses.slice(1).every((clause) => !clause.includes(" "));
  const scope = hasUnambiguousScope ? firstTokens.slice(0, -1).join(" ") : "";
  const alternatives = hasUnambiguousScope
    ? [firstTokens.at(-1) ?? "", ...clauses.slice(1)].filter(Boolean)
    : clauses;
  const lexicalQueries = alternatives.map((alternative) => normalizeWhitespace(`${scope} ${alternative}`));
  const booleanQuery = scope
    ? `${scope} (${alternatives.join(" OR ")})`
    : `(${alternatives.join(" OR ")})`;
  return { booleanQuery, lexicalQueries };
}

export function planCifaProviderQuery(
  originalQuery: string,
  provider: CifaQueryProvider
): CifaProviderQueryPlan {
  const normalized = normalizeWhitespace(originalQuery);
  const scopedOr = scopedOrQueries(normalized);
  const isGdelt = provider === "GDELT_DOC" || provider === "GDELT_CONTEXT" || provider === "GDELT_GEO";
  const providerQueries = provider === "BLUESKY"
    ? (scopedOr?.lexicalQueries ?? [lexicalQuery(normalized)])
      .map((query) => query.slice(0, QUERY_LIMITS[provider]))
      .filter(Boolean)
      .slice(0, 5)
    : undefined;
  const adapted = isGdelt && scopedOr
    ? scopedOr.booleanQuery
    : provider === "BLUESKY"
      ? providerQueries?.join(" OR ") ?? lexicalQuery(normalized)
      : provider === "FEDIVERSE" || provider === "OFFICIAL_CEIPOL"
        ? lexicalQuery(normalized)
        : normalized;

  return {
    originalQuery: normalized,
    providerQuery: adapted.slice(0, QUERY_LIMITS[provider]),
    ...(providerQueries ? { providerQueries } : {}),
    provider,
  };
}
