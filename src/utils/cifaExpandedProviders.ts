import axios from "axios";
import {
  classifyExternalFailure,
  classifyHttpFailure,
  invalidProviderResponse,
} from "./externalProviderError";
import { planCifaProviderQuery, type CifaQueryProvider } from "./cifaQueryPlanner";
import {
  CIFA_FEDIVERSE_INSTANCE_REGISTRY,
  type CifaFediverseInstance,
} from "./cifaFediverseRegistry";
import {
  CIFA_OFFICIAL_SOURCE_REGISTRY,
  type CifaOfficialSourceDefinition,
} from "./cifaOfficialSourceRegistry";
import type { AcquisitionStatus } from "@/types/epistemicIntegrity";

const NEWS_API_ENDPOINT = "https://newsapi.org/v2/everything";
const GDELT_DOC_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
const GDELT_CONTEXT_ENDPOINT = "https://api.gdeltproject.org/api/v2/context/context";
const GDELT_GEO_ENDPOINT = "https://api.gdeltproject.org/api/v2/geo/geo";
const BLUESKY_SEARCH_ENDPOINT = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const DEFAULT_LIMIT = 20;

export interface ProviderCollectionMetadata {
  originalQuery: string;
  providerQuery: string;
  requestedLimit: number;
  returnedCount: number;
  totalAvailable?: number | null;
  truncated: boolean;
  observations?: Array<Record<string, unknown>>;
}

export type ProviderCollection<T> = T[] & {
  providerMetadata?: ProviderCollectionMetadata;
  acquisitionStatus?: AcquisitionStatus;
};

export interface CifaObservedRecord {
  id: string;
  title: string | null;
  description: string | null;
  text: string | null;
  author: string | null;
  sourceName: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  observedAt: string | null;
  acquiredAt: string;
  query: string;
  providerQuery: string;
  [key: string]: unknown;
}

export interface NewsApiSearchOptions {
  from?: string;
  to?: string;
  domains?: string[];
  sortBy?: "relevancy" | "popularity" | "publishedAt";
  limit?: number;
}

function clampLimit(limit: number | undefined, maximum = DEFAULT_LIMIT): number {
  return Math.max(1, Math.min(maximum, Math.floor(limit ?? maximum)));
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const compactGdelt = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  const candidate = compactGdelt
    ? `${compactGdelt[1]}-${compactGdelt[2]}-${compactGdelt[3]}T${compactGdelt[4]}:${compactGdelt[5]}:${compactGdelt[6]}Z`
    : value;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collection<T>(
  items: T[],
  metadata: ProviderCollectionMetadata,
  acquisitionStatus?: AcquisitionStatus
): ProviderCollection<T> {
  return Object.assign(items, { providerMetadata: metadata, acquisitionStatus });
}

function statusForCount(count: number): AcquisitionStatus {
  return count > 0 ? "ACQUIRED" : "NO_DATA";
}

function ensureHttpStatus(status: number): void {
  if (status < 200 || status >= 300) throw classifyHttpFailure(status);
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function stripHtml(value: unknown): string | null {
  const text = stringOrNull(value);
  if (!text) return null;
  return text
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function safeUrl(value: unknown, base?: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = base ? new URL(value, base) : new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function makeBaseRecord(params: {
  id: string;
  title?: unknown;
  description?: unknown;
  text?: unknown;
  author?: unknown;
  sourceName: string;
  sourceUrl?: unknown;
  publishedAt?: unknown;
  observedAt?: unknown;
  originalQuery: string;
  providerQuery: string;
  acquiredAt: string;
}): CifaObservedRecord {
  return {
    id: params.id,
    title: stringOrNull(params.title),
    description: stripHtml(params.description),
    text: stripHtml(params.text),
    author: stringOrNull(params.author),
    sourceName: params.sourceName,
    sourceUrl: safeUrl(params.sourceUrl),
    publishedAt: normalizeDate(params.publishedAt),
    observedAt: normalizeDate(params.observedAt),
    acquiredAt: params.acquiredAt,
    query: params.originalQuery,
    providerQuery: params.providerQuery,
  };
}

export function getProviderCollectionMetadata(value: unknown): ProviderCollectionMetadata | undefined {
  return Array.isArray(value) ? (value as ProviderCollection<unknown>).providerMetadata : undefined;
}

export function getProviderCollectionStatus(value: unknown, count: number): AcquisitionStatus {
  if (Array.isArray(value) && (value as ProviderCollection<unknown>).acquisitionStatus) {
    return (value as ProviderCollection<unknown>).acquisitionStatus as AcquisitionStatus;
  }
  return statusForCount(count);
}

export async function searchNewsApi(
  originalQuery: string,
  token: string,
  options: NewsApiSearchOptions = {}
): Promise<ProviderCollection<CifaObservedRecord>> {
  const plan = planCifaProviderQuery(originalQuery, "NEWS_API");
  const limit = clampLimit(options.limit, 100);
  const response = await axios.get(NEWS_API_ENDPOINT, {
    headers: { "X-Api-Key": token },
    params: {
      q: plan.providerQuery,
      language: "es",
      from: options.from,
      to: options.to,
      domains: options.domains?.filter(Boolean).join(",") || undefined,
      sortBy: options.sortBy ?? "publishedAt",
      pageSize: limit,
      page: 1,
    },
    timeout: 10_000,
    validateStatus: () => true,
  });
  ensureHttpStatus(response.status);
  const body = asRecord(response.data);
  if (!body || body.status !== "ok" || !Array.isArray(body.articles)) throw invalidProviderResponse();
  const acquiredAt = new Date().toISOString();
  const items = body.articles.slice(0, limit).map((article: unknown, index: number) => {
    const value = asRecord(article);
    if (!value) throw invalidProviderResponse();
    const source = asRecord(value.source);
    const sourceUrl = safeUrl(value.url);
    return {
      ...makeBaseRecord({
        id: sourceUrl ?? `newsapi:${index}`,
        title: value.title,
        description: value.description,
        text: null,
        author: value.author,
        sourceName: stringOrNull(source?.name) ?? "NewsAPI",
        sourceUrl,
        publishedAt: value.publishedAt,
        observedAt: null,
        originalQuery: plan.originalQuery,
        providerQuery: plan.providerQuery,
        acquiredAt,
      }),
      contentPreview: stringOrNull(value.content),
      contentIsTruncatedPreview: Boolean(stringOrNull(value.content)),
    };
  });
  const totalAvailable = Number.isFinite(Number(body.totalResults)) ? Number(body.totalResults) : null;
  return collection(items, {
    originalQuery: plan.originalQuery,
    providerQuery: plan.providerQuery,
    requestedLimit: limit,
    returnedCount: items.length,
    totalAvailable,
    truncated: totalAvailable !== null && totalAvailable > items.length,
  });
}

function gdeltArticleCollection(
  originalQuery: string,
  provider: Extract<CifaQueryProvider, "GDELT_DOC" | "GDELT_CONTEXT">,
  body: unknown,
  limit: number
): ProviderCollection<CifaObservedRecord> {
  const plan = planCifaProviderQuery(originalQuery, provider);
  const record = asRecord(body);
  if (!record || !Array.isArray(record.articles)) throw invalidProviderResponse();
  const acquiredAt = new Date().toISOString();
  const items = record.articles.slice(0, limit).map((article: unknown, index: number) => {
    const value = asRecord(article);
    if (!value) throw invalidProviderResponse();
    const sourceUrl = safeUrl(value.url ?? value.url_mobile);
    const context = provider === "GDELT_CONTEXT"
      ? stringOrNull(value.context ?? value.snippet ?? value.sentence)
      : null;
    return {
      ...makeBaseRecord({
        id: sourceUrl ?? `${provider.toLowerCase()}:${index}`,
        title: value.title,
        description: context,
        text: context,
        author: null,
        sourceName: stringOrNull(value.domain) ?? "GDELT",
        sourceUrl,
        publishedAt: value.publishedAt,
        observedAt: value.seendate,
        originalQuery: plan.originalQuery,
        providerQuery: plan.providerQuery,
        acquiredAt,
      }),
      domain: stringOrNull(value.domain),
      language: stringOrNull(value.language),
      contextText: context,
    };
  });
  return collection(items, {
    originalQuery: plan.originalQuery,
    providerQuery: plan.providerQuery,
    requestedLimit: limit,
    returnedCount: items.length,
    truncated: record.articles.length > items.length,
  });
}

async function searchGdeltArticles(
  originalQuery: string,
  provider: Extract<CifaQueryProvider, "GDELT_DOC" | "GDELT_CONTEXT">,
  endpoint: string,
  limit = 20
): Promise<ProviderCollection<CifaObservedRecord>> {
  const plan = planCifaProviderQuery(originalQuery, provider);
  const boundedLimit = clampLimit(limit, 75);
  const response = await axios.get(endpoint, {
    params: { query: plan.providerQuery, mode: "ArtList", maxrecords: boundedLimit, format: "json", sort: "HybridRel" },
    timeout: 12_000,
    validateStatus: () => true,
  });
  ensureHttpStatus(response.status);
  return gdeltArticleCollection(originalQuery, provider, response.data, boundedLimit);
}

export function searchGdeltDocuments(originalQuery: string, limit = 20) {
  return searchGdeltArticles(originalQuery, "GDELT_DOC", GDELT_DOC_ENDPOINT, limit);
}

export function searchGdeltContext(originalQuery: string, limit = 20) {
  return searchGdeltArticles(originalQuery, "GDELT_CONTEXT", GDELT_CONTEXT_ENDPOINT, limit);
}

export async function searchGdeltGeo(
  originalQuery: string,
  limit = 20
): Promise<ProviderCollection<CifaObservedRecord>> {
  const plan = planCifaProviderQuery(originalQuery, "GDELT_GEO");
  const boundedLimit = clampLimit(limit, 50);
  const response = await axios.get(GDELT_GEO_ENDPOINT, {
    params: { query: plan.providerQuery, mode: "PointData", format: "GeoJSON", maxpoints: boundedLimit },
    timeout: 12_000,
    validateStatus: () => true,
  });
  ensureHttpStatus(response.status);
  const body = asRecord(response.data);
  if (!body || !Array.isArray(body.features)) throw invalidProviderResponse();
  const acquiredAt = new Date().toISOString();
  const items = body.features.slice(0, boundedLimit).map((feature: unknown, index: number) => {
    const value = asRecord(feature);
    const geometry = asRecord(value?.geometry);
    const properties = asRecord(value?.properties) ?? {};
    if (!value || !geometry || !Array.isArray(geometry.coordinates)) throw invalidProviderResponse();
    const coordinates = geometry.coordinates.map(Number);
    if (coordinates.length < 2 || !coordinates.slice(0, 2).every(Number.isFinite)) throw invalidProviderResponse();
    return {
      ...makeBaseRecord({
        id: stringOrNull(value.id) ?? `gdelt-geo:${index}:${coordinates[0]}:${coordinates[1]}`,
        title: properties.name ?? properties.locationname,
        description: properties.html ?? properties.context,
        text: properties.context,
        author: null,
        sourceName: "GDELT GEO",
        sourceUrl: safeUrl(properties.url),
        publishedAt: properties.publishedAt,
        observedAt: properties.seendate,
        originalQuery: plan.originalQuery,
        providerQuery: plan.providerQuery,
        acquiredAt,
      }),
      geometry: { type: stringOrNull(geometry.type) ?? "Point", coordinates },
      locationName: stringOrNull(properties.name ?? properties.locationname),
      locationRole: "MENTIONED_LOCATION",
      eventLocation: null,
      mentionCount: Number.isFinite(Number(properties.count)) ? Number(properties.count) : null,
    };
  });
  return collection(items, {
    originalQuery: plan.originalQuery,
    providerQuery: plan.providerQuery,
    requestedLimit: boundedLimit,
    returnedCount: items.length,
    truncated: body.features.length > items.length,
  });
}

function blueskyPostUrl(uri: unknown, handle: unknown): string | null {
  if (typeof uri !== "string" || typeof handle !== "string") return null;
  const match = uri.match(/^at:\/\/[^/]+\/app\.bsky\.feed\.post\/([^/]+)$/);
  return match ? `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${encodeURIComponent(match[1])}` : null;
}

export async function searchBluesky(
  originalQuery: string,
  limit = 20
): Promise<ProviderCollection<CifaObservedRecord>> {
  const plan = planCifaProviderQuery(originalQuery, "BLUESKY");
  const boundedLimit = clampLimit(limit, 100);
  const response = await axios.get(BLUESKY_SEARCH_ENDPOINT, {
    params: { q: plan.providerQuery, limit: boundedLimit, sort: "latest" },
    timeout: 10_000,
    validateStatus: () => true,
  });
  ensureHttpStatus(response.status);
  const body = asRecord(response.data);
  if (!body || !Array.isArray(body.posts)) throw invalidProviderResponse();
  const acquiredAt = new Date().toISOString();
  const items = body.posts.slice(0, boundedLimit).map((post: unknown, index: number) => {
    const value = asRecord(post);
    const record = asRecord(value?.record);
    const author = asRecord(value?.author);
    if (!value || !record || !author) throw invalidProviderResponse();
    const facets = Array.isArray(record.facets) ? record.facets : [];
    const features = facets.flatMap((facet: unknown) => {
      const item = asRecord(facet);
      return Array.isArray(item?.features) ? item.features : [];
    }).map(asRecord).filter(Boolean) as Array<Record<string, any>>;
    const links = features.map((feature) => safeUrl(feature.uri)).filter((link): link is string => Boolean(link));
    const hashtags = features.map((feature) => stringOrNull(feature.tag)).filter((tag): tag is string => Boolean(tag));
    const sourceUrl = blueskyPostUrl(value.uri, author.handle);
    return {
      ...makeBaseRecord({
        id: stringOrNull(value.uri) ?? `bluesky:${index}`,
        title: null,
        description: record.text,
        text: record.text,
        author: author.displayName ?? author.handle,
        sourceName: "Bluesky",
        sourceUrl,
        publishedAt: record.createdAt,
        observedAt: value.indexedAt,
        originalQuery: plan.originalQuery,
        providerQuery: plan.providerQuery,
        acquiredAt,
      }),
      uri: stringOrNull(value.uri),
      cid: stringOrNull(value.cid),
      authorDid: stringOrNull(author.did),
      handle: stringOrNull(author.handle),
      displayName: stringOrNull(author.displayName),
      indexedAt: normalizeDate(value.indexedAt),
      hashtags,
      links,
      replyCount: Number.isFinite(Number(value.replyCount)) ? Number(value.replyCount) : null,
      repostCount: Number.isFinite(Number(value.repostCount)) ? Number(value.repostCount) : null,
      geography: null,
    };
  });
  return collection(items, {
    originalQuery: plan.originalQuery,
    providerQuery: plan.providerQuery,
    requestedLimit: boundedLimit,
    returnedCount: items.length,
    truncated: Boolean(body.cursor) || body.posts.length > items.length,
  });
}

function envToken(name: string | undefined): string | undefined {
  return name ? process.env[name]?.trim() || undefined : undefined;
}

function aggregateStatuses(statuses: AcquisitionStatus[]): AcquisitionStatus {
  const successful = statuses.filter((status) => status === "ACQUIRED" || status === "NO_DATA");
  const degraded = statuses.filter((status) => status === "FAILED" || status === "NOT_CONFIGURED" || status === "UNAVAILABLE");
  if (successful.length > 0 && degraded.length > 0) return "PARTIAL";
  if (successful.some((status) => status === "ACQUIRED")) return "ACQUIRED";
  if (successful.length > 0) return "NO_DATA";
  if (statuses.every((status) => status === "NOT_CONFIGURED")) return "NOT_CONFIGURED";
  return "FAILED";
}

export async function searchFediverse(
  originalQuery: string,
  instances: readonly CifaFediverseInstance[] = CIFA_FEDIVERSE_INSTANCE_REGISTRY,
  limitPerInstance = 10
): Promise<ProviderCollection<CifaObservedRecord>> {
  const plan = planCifaProviderQuery(originalQuery, "FEDIVERSE");
  const boundedLimit = clampLimit(limitPerInstance, 20);
  const enabled = instances.filter((instance) => instance.enabled).sort((a, b) => b.priority - a.priority);
  const settled = await Promise.all(enabled.map(async (instance) => {
    const token = envToken(instance.tokenEnv);
    if (instance.requiresAuth && !token) {
      return { instance, status: "NOT_CONFIGURED" as AcquisitionStatus, items: [] as CifaObservedRecord[], failureReason: null };
    }
    try {
      const response = await axios.get(`${instance.instance.replace(/\/$/, "")}/api/v2/search`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: { q: plan.providerQuery, type: "statuses", resolve: false, limit: boundedLimit },
        timeout: 8_000,
        validateStatus: () => true,
      });
      if (response.status === 401 || response.status === 403) {
        return { instance, status: "NOT_CONFIGURED" as AcquisitionStatus, items: [] as CifaObservedRecord[], failureReason: "AUTH_FAILED" };
      }
      ensureHttpStatus(response.status);
      const body = asRecord(response.data);
      if (!body || !Array.isArray(body.statuses)) throw invalidProviderResponse();
      const acquiredAt = new Date().toISOString();
      const items = body.statuses.slice(0, boundedLimit).map((status: unknown, index: number) => {
        const value = asRecord(status);
        const account = asRecord(value?.account);
        if (!value || !account) throw invalidProviderResponse();
        const sourceUrl = safeUrl(value.url ?? value.uri);
        return {
          ...makeBaseRecord({
            id: stringOrNull(value.id) ?? `${instance.instance}:${index}`,
            title: value.spoiler_text,
            description: value.content,
            text: value.content,
            author: account.display_name ?? account.acct,
            sourceName: instance.displayName,
            sourceUrl,
            publishedAt: value.created_at,
            observedAt: null,
            originalQuery: plan.originalQuery,
            providerQuery: plan.providerQuery,
            acquiredAt,
          }),
          instance: instance.instance,
          accountId: stringOrNull(account.id),
          account: stringOrNull(account.acct),
          language: stringOrNull(value.language),
          geography: null,
        };
      });
      return { instance, status: statusForCount(items.length), items, failureReason: null };
    } catch (error) {
      const failure = classifyExternalFailure(error).failure;
      return { instance, status: "FAILED" as AcquisitionStatus, items: [] as CifaObservedRecord[], failureReason: failure.reason };
    }
  }));
  const items = settled.flatMap((result) => result.items);
  const acquisitionStatus = aggregateStatuses(settled.map((result) => result.status));
  return collection(items, {
    originalQuery: plan.originalQuery,
    providerQuery: plan.providerQuery,
    requestedLimit: boundedLimit * enabled.length,
    returnedCount: items.length,
    truncated: settled.some((result) => result.items.length >= boundedLimit),
    observations: settled.map((result) => ({
      instance: result.instance.instance,
      displayName: result.instance.displayName,
      jurisdiction: result.instance.jurisdiction,
      requiresAuth: result.instance.requiresAuth,
      status: result.status,
      resultCount: result.items.length,
      failureReason: result.failureReason,
    })),
  }, acquisitionStatus);
}

function xmlText(fragment: string, tag: string): string | null {
  const cdata = fragment.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"));
  const plain = fragment.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return stripHtml(cdata?.[1] ?? plain?.[1]);
}

function queryTokens(providerQuery: string): string[] {
  return providerQuery.toLocaleLowerCase("es-MX").split(/\s+/).filter((token) => token.length >= 4);
}

function htmlCandidates(html: string, source: CifaOfficialSourceDefinition): Array<Record<string, unknown>> {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ title: stripHtml(match[2]), url: safeUrl(match[1], source.url) }))
    .filter((item) => item.title && item.url);
}

async function acquireOfficialSource(
  source: CifaOfficialSourceDefinition,
  originalQuery: string,
  providerQuery: string,
  limit: number
): Promise<CifaObservedRecord[]> {
  const target = source.acquisitionMethod === "RSS" ? source.feedUrl : source.url;
  if (!target) throw invalidProviderResponse();
  const response = await fetch(target, {
    headers: {
      Accept: source.acquisitionMethod === "JSON_API"
        ? "application/json"
        : source.acquisitionMethod === "RSS"
          ? "application/rss+xml,application/atom+xml,application/xml;q=0.9"
          : "text/html,application/xhtml+xml;q=0.9",
    },
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 300 },
  });
  if (!response.ok) throw classifyHttpFailure(response.status);
  const acquiredAt = new Date().toISOString();
  let candidates: Array<Record<string, any>> = [];
  if (source.acquisitionMethod === "JSON_API") {
    const body = await response.json();
    const record = asRecord(body);
    const values = Array.isArray(body) ? body : record?.items ?? record?.results ?? record?.data;
    if (!Array.isArray(values)) throw invalidProviderResponse();
    candidates = values;
  } else {
    const payload = await response.text();
    if (source.acquisitionMethod === "RSS") {
      candidates = [...payload.matchAll(/<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi)].map((match) => ({
        title: xmlText(match[1], "title"),
        description: xmlText(match[1], "description") ?? xmlText(match[1], "summary"),
        url: xmlText(match[1], "link"),
        publishedAt: xmlText(match[1], "pubDate") ?? xmlText(match[1], "published") ?? xmlText(match[1], "updated"),
      }));
    } else {
      candidates = htmlCandidates(payload, source);
    }
  }
  const tokens = queryTokens(providerQuery);
  return candidates
    .filter((candidate) => {
      if (tokens.length === 0) return true;
      const haystack = `${candidate.title ?? candidate.name ?? ""} ${candidate.description ?? candidate.summary ?? candidate.content ?? ""}`.toLocaleLowerCase("es-MX");
      return tokens.some((token) => haystack.includes(token));
    })
    .slice(0, limit)
    .map((candidate, index) => {
      const sourceUrl = safeUrl(candidate.url ?? candidate.link, source.url) ?? source.url;
      return {
        ...makeBaseRecord({
          id: stringOrNull(candidate.id) ?? sourceUrl ?? `${source.id}:${index}`,
          title: candidate.title ?? candidate.name,
          description: candidate.description ?? candidate.summary,
          text: candidate.content,
          author: candidate.author,
          sourceName: source.organization,
          sourceUrl,
          publishedAt: candidate.publishedAt ?? candidate.pubDate ?? candidate.date,
          observedAt: candidate.observedAt,
          originalQuery,
          providerQuery,
          acquiredAt,
        }),
        officialSourceId: source.id,
        organization: source.organization,
        jurisdiction: source.jurisdiction,
        officialSourceType: source.sourceType,
        officialSourceCategory: source.category,
        acquisitionMethod: source.acquisitionMethod,
      };
    });
}

export async function searchOfficialCeipolSources(
  originalQuery: string,
  sources: readonly CifaOfficialSourceDefinition[] = CIFA_OFFICIAL_SOURCE_REGISTRY,
  limitPerSource = 10
): Promise<ProviderCollection<CifaObservedRecord>> {
  const plan = planCifaProviderQuery(originalQuery, "OFFICIAL_CEIPOL");
  const boundedLimit = clampLimit(limitPerSource, 15);
  const enabled = sources.filter((source) => source.enabled).sort((a, b) => b.priority - a.priority);
  const settled = await Promise.all(enabled.map(async (source) => {
    try {
      const items = await acquireOfficialSource(source, plan.originalQuery, plan.providerQuery, boundedLimit);
      return { source, status: statusForCount(items.length), items, failureReason: null };
    } catch (error) {
      const failure = classifyExternalFailure(error).failure;
      return { source, status: "FAILED" as AcquisitionStatus, items: [] as CifaObservedRecord[], failureReason: failure.reason };
    }
  }));
  const items = settled.flatMap((result) => result.items);
  const acquisitionStatus = aggregateStatuses(settled.map((result) => result.status));
  return collection(items, {
    originalQuery: plan.originalQuery,
    providerQuery: plan.providerQuery,
    requestedLimit: boundedLimit * enabled.length,
    returnedCount: items.length,
    truncated: settled.some((result) => result.items.length >= boundedLimit),
    observations: settled.map((result) => ({
      id: result.source.id,
      organization: result.source.organization,
      jurisdiction: result.source.jurisdiction,
      category: result.source.category,
      acquisitionMethod: result.source.acquisitionMethod,
      status: result.status,
      resultCount: result.items.length,
      failureReason: result.failureReason,
    })),
  }, acquisitionStatus);
}
