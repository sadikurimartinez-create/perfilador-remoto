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

export function planCifaProviderQuery(
  originalQuery: string,
  provider: CifaQueryProvider
): CifaProviderQueryPlan {
  const normalized = normalizeWhitespace(originalQuery);
  const adapted = provider === "BLUESKY" || provider === "FEDIVERSE" || provider === "OFFICIAL_CEIPOL"
    ? lexicalQuery(normalized)
    : normalized;

  return {
    originalQuery: normalized,
    providerQuery: adapted.slice(0, QUERY_LIMITS[provider]),
    provider,
  };
}
