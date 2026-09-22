import axios from "axios";
import { executeCifaSource, summarizeCifaSourceCoverage, type CifaSourceDefinition } from "../src/utils/cifaAcquisition";
import {
  getProviderCollectionMetadata,
  getProviderCollectionStatus,
  searchBluesky,
  searchFediverse,
  searchGdeltContext,
  searchGdeltDocuments,
  searchGdeltGeo,
  searchNewsApi,
  searchOfficialCeipolSources,
} from "../src/utils/cifaExpandedProviders";
import { planCifaProviderQuery } from "../src/utils/cifaQueryPlanner";
import { deduplicateCifaRecords } from "../src/utils/cifaMultisourceDeduplication";
import { runMultiSourceCorrelation } from "../src/utils/mcmCorrelation";
import type { CifaFediverseInstance } from "../src/utils/cifaFediverseRegistry";
import type { CifaOfficialSourceDefinition } from "../src/utils/cifaOfficialSourceRegistry";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedGet = axios.get as jest.Mock;
const originalFetch = global.fetch;

function response(status: number, data: unknown) {
  return { status, data };
}

function networkError(code: string) {
  return Object.assign(new Error(code), { code });
}

function observedDefinition(execute: () => Promise<unknown>): CifaSourceDefinition {
  return {
    sourceKey: "expanded",
    sourceId: "expanded-source",
    providerId: "EXPANDED_PROVIDER",
    providerName: "Expanded provider",
    sourceType: "EXPANDED_OBSERVATION",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    sourceReference: "test:expanded",
    sourceUrl: "https://provider.example/api",
    execute,
    resolveStatus: getProviderCollectionStatus,
    providerMetadata: getProviderCollectionMetadata,
  };
}

describe("CIFA expanded provider contracts", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => { global.fetch = originalFetch; });

  describe("NewsAPI", () => {
    test("normalizes data, query planning and truncated content as preview", async () => {
      mockedGet.mockResolvedValue(response(200, {
        status: "ok",
        totalResults: 2,
        articles: [{
          source: { name: "Medio" }, author: "Autora", title: "Operativo",
          description: "Descripción", url: "https://news.example/story?utm_source=x",
          publishedAt: "2026-09-20T10:00:00Z", content: "Vista previa [+20 chars]",
        }],
      }));

      const result = await searchNewsApi("Aguascalientes OR robo", "server-secret", { limit: 1 });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: "Operativo",
        sourceName: "Medio",
        publishedAt: "2026-09-20T10:00:00.000Z",
        query: "Aguascalientes OR robo",
        providerQuery: "Aguascalientes OR robo",
        contentIsTruncatedPreview: true,
      });
      expect(result.providerMetadata).toMatchObject({ returnedCount: 1, totalAvailable: 2, truncated: true });
      expect(mockedGet.mock.calls[0][1].headers).toEqual({ "X-Api-Key": "server-secret" });
      expect(JSON.stringify(mockedGet.mock.calls[0][1].params)).not.toContain("server-secret");
    });

    test("empty is NO_DATA through the acquisition contract", async () => {
      mockedGet.mockResolvedValue(response(200, { status: "ok", totalResults: 0, articles: [] }));
      const envelope = await executeCifaSource(observedDefinition(() => searchNewsApi("robo", "token")), "robo");
      expect(envelope).toMatchObject({ acquisitionStatus: "NO_DATA", resultCount: 0, isSimulated: false });
    });

    test.each([[401, "AUTH_FAILED"], [429, "RATE_LIMITED"], [503, "PROVIDER_UNAVAILABLE"]])(
      "maps HTTP %s to %s",
      async (status, reason) => {
        mockedGet.mockResolvedValue(response(status, {}));
        await expect(searchNewsApi("robo", "token")).rejects.toMatchObject({ failure: { reason } });
      }
    );

    test("rejects an invalid schema", async () => {
      mockedGet.mockResolvedValue(response(200, { status: "ok", articles: "invalid" }));
      await expect(searchNewsApi("robo", "token")).rejects.toMatchObject({ failure: { reason: "INVALID_RESPONSE" } });
    });

    test("missing key is NOT_CONFIGURED without executing", async () => {
      const execute = jest.fn();
      const definition = observedDefinition(execute);
      definition.readiness = () => ({ ready: false, code: "SOURCE_NOT_CONFIGURED" });
      const envelope = await executeCifaSource(definition, "robo");
      expect(envelope.acquisitionStatus).toBe("NOT_CONFIGURED");
      expect(execute).not.toHaveBeenCalled();
    });
  });

  describe("GDELT", () => {
    test("DOC preserves observedAt separately and does not invent publishedAt", async () => {
      mockedGet.mockResolvedValue(response(200, { articles: [{
        url: "https://media.example/a", title: "Nota", domain: "media.example",
        seendate: "20260920T101112Z", language: "Spanish",
      }] }));
      const result = await searchGdeltDocuments("robo OR detención");
      expect(result[0]).toMatchObject({
        publishedAt: null,
        observedAt: "2026-09-20T10:11:12.000Z",
        language: "Spanish",
      });
      expect(mockedGet.mock.calls[0][1]).toMatchObject({
        timeout: 21_000,
        params: { mode: "ArtList", format: "json", sort: "DateDesc", timespan: "24h" },
      });
    });

    test("Context preserves exactly the provider sentence", async () => {
      mockedGet.mockResolvedValue(response(200, { articles: [{
        url: "https://media.example/context", title: "Nota", context: "Frase exacta del proveedor.",
      }] }));
      const result = await searchGdeltContext("operativo");
      expect(result[0].contextText).toBe("Frase exacta del proveedor.");
      expect(result[0].text).toBe("Frase exacta del proveedor.");
    });

    describe.each([
      ["DOC", searchGdeltDocuments],
      ["Context", searchGdeltContext],
    ])("%s response contract", (_provider, search) => {
      test("treats omitted or empty articles as valid NO_DATA", async () => {
        mockedGet.mockResolvedValueOnce(response(200, {}))
          .mockResolvedValueOnce(response(200, { articles: [] }));
        expect(await search("sin coincidencias")).toHaveLength(0);
        expect(await search("sin coincidencias")).toHaveLength(0);
      });

      test.each([[429, "RATE_LIMITED"], [503, "PROVIDER_UNAVAILABLE"]])(
        "retries transient HTTP %s once and preserves %s",
        async (status, reason) => {
          mockedGet.mockResolvedValue(response(status, {}));
          await expect(search("robo")).rejects.toMatchObject({ failure: { reason } });
          expect(mockedGet).toHaveBeenCalledTimes(2);
        }
      );

      test("bounds timeout and retries it at most once", async () => {
        mockedGet.mockRejectedValue(networkError("ECONNABORTED"));
        await expect(search("robo")).rejects.toMatchObject({ failure: { reason: "TIMEOUT" } });
        expect(mockedGet).toHaveBeenCalledTimes(2);
      });

      test("rejects an invalid non-array articles schema without retry", async () => {
        mockedGet.mockResolvedValue(response(200, { articles: {} }));
        await expect(search("robo")).rejects.toMatchObject({ failure: { reason: "INVALID_RESPONSE" } });
        expect(mockedGet).toHaveBeenCalledTimes(1);
      });
    });

    test("GEO marks mentioned location and never promotes it to event location", async () => {
      mockedGet.mockResolvedValue(response(200, { type: "FeatureCollection", features: [{
        type: "Feature", geometry: { type: "Point", coordinates: [-102.29, 21.88] },
        properties: { name: "Aguascalientes", count: 3 },
      }] }));
      const result = await searchGdeltGeo("Aguascalientes");
      expect(result[0]).toMatchObject({
        geometry: { coordinates: [-102.29, 21.88] },
        locationRole: "MENTIONED_LOCATION",
        eventLocation: null,
        publishedAt: null,
      });
    });

    test("GEO empty FeatureCollection is valid NO_DATA", async () => {
      mockedGet.mockResolvedValue(response(200, { type: "FeatureCollection", features: [] }));
      expect(await searchGdeltGeo("sin geo")).toHaveLength(0);
    });

    test.each([[429, "RATE_LIMITED"], [503, "PROVIDER_UNAVAILABLE"]])(
      "GEO retries transient HTTP %s once and preserves %s",
      async (status, reason) => {
        mockedGet.mockResolvedValue(response(status, {}));
        await expect(searchGdeltGeo("robo")).rejects.toMatchObject({ failure: { reason } });
        expect(mockedGet).toHaveBeenCalledTimes(2);
      }
    );

    test("GEO bounds timeout and retries it at most once", async () => {
      mockedGet.mockRejectedValue(networkError("ECONNABORTED"));
      await expect(searchGdeltGeo("robo")).rejects.toMatchObject({ failure: { reason: "TIMEOUT" } });
      expect(mockedGet).toHaveBeenCalledTimes(2);
    });

    test("GEO classifies its observed endpoint 404 as provider unavailable without retry", async () => {
      mockedGet.mockResolvedValue(response(404, {}));
      await expect(searchGdeltGeo("robo")).rejects.toMatchObject({
        failure: { reason: "PROVIDER_UNAVAILABLE", technicalCode: "GDELT_GEO_ENDPOINT_UNAVAILABLE" },
      });
      expect(mockedGet).toHaveBeenCalledTimes(1);
    });

    test("GEO rejects invalid GeoJSON schema without retry", async () => {
      mockedGet.mockResolvedValue(response(200, { features: "invalid" }));
      await expect(searchGdeltGeo("robo")).rejects.toMatchObject({ failure: { reason: "INVALID_RESPONSE" } });
      expect(mockedGet).toHaveBeenCalledTimes(1);
    });
  });

  describe("Bluesky", () => {
    test("uses the working public AppView without auth and preserves post metadata", async () => {
      mockedGet.mockResolvedValue(response(200, { posts: [{
        uri: "at://did:plc:abc/app.bsky.feed.post/xyz", cid: "cid-1",
        author: { did: "did:plc:abc", handle: "analista.bsky.social", displayName: "Analista" },
        record: { text: "Reporte #Aguascalientes", createdAt: "2026-09-20T10:00:00Z", facets: [] },
        indexedAt: "2026-09-20T10:01:00Z", replyCount: 1, repostCount: 2,
      }] }));
      const result = await searchBluesky("Aguascalientes");
      expect(result[0]).toMatchObject({
        authorDid: "did:plc:abc", handle: "analista.bsky.social", geography: null,
        publishedAt: "2026-09-20T10:00:00.000Z", observedAt: "2026-09-20T10:01:00.000Z",
      });
      expect(mockedGet.mock.calls[0][0]).toBe("https://api.bsky.app/xrpc/app.bsky.feed.searchPosts");
      expect(mockedGet.mock.calls[0][1].headers).toEqual({ Accept: "application/json" });
      expect(mockedGet.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });

    test("HTTP 200 with posts=[] is valid NO_DATA", async () => {
      mockedGet.mockResolvedValue(response(200, { posts: [] }));
      expect(await searchBluesky("robo")).toHaveLength(0);
    });

    test.each([
      [400, "INVALID_REQUEST", 1],
      [401, "AUTH_FAILED", 1],
      [403, "ACCESS_RESTRICTED", 1],
      [429, "RATE_LIMITED", 2],
      [503, "PROVIDER_UNAVAILABLE", 2],
    ])("maps HTTP %s to %s with %s attempt(s)", async (status, reason, attempts) => {
      mockedGet.mockResolvedValue(response(status, {}));
      await expect(searchBluesky("robo")).rejects.toMatchObject({ failure: { reason } });
      expect(mockedGet).toHaveBeenCalledTimes(attempts);
    });

    test.each([
      ["ECONNABORTED", "TIMEOUT", 2],
      ["ENOTFOUND", "NETWORK_ERROR", 1],
    ])("maps %s to %s with bounded retry", async (code, reason, attempts) => {
      mockedGet.mockRejectedValue(networkError(code));
      await expect(searchBluesky("robo")).rejects.toMatchObject({ failure: { reason } });
      expect(mockedGet).toHaveBeenCalledTimes(attempts);
    });

    test("rejects invalid posts schema without retry", async () => {
      mockedGet.mockResolvedValue(response(200, { posts: "invalid" }));
      await expect(searchBluesky("robo")).rejects.toMatchObject({ failure: { reason: "INVALID_RESPONSE" } });
      expect(mockedGet).toHaveBeenCalledTimes(1);
    });

    test("fans out OR branches, deduplicates posts and reports restricted branches as PARTIAL", async () => {
      const post = {
        uri: "at://did:plc:abc/app.bsky.feed.post/xyz", cid: "cid-1",
        author: { did: "did:plc:abc", handle: "analista.bsky.social" },
        record: { text: "Reporte", createdAt: "2026-09-20T10:00:00Z" },
        indexedAt: "2026-09-20T10:01:00Z",
      };
      mockedGet.mockResolvedValueOnce(response(200, { posts: [post] }))
        .mockResolvedValueOnce(response(200, { posts: [] }))
        .mockResolvedValueOnce(response(200, { posts: [post] }))
        .mockResolvedValueOnce(response(200, { posts: [] }))
        .mockResolvedValueOnce(response(403, {}));

      const result = await searchBluesky("Aguascalientes operativo OR balacera OR robo OR detención OR cartel");

      expect(result).toHaveLength(1);
      expect(result.acquisitionStatus).toBe("PARTIAL");
      expect(result.providerMetadata?.providerQueries).toEqual([
        "Aguascalientes operativo",
        "Aguascalientes balacera",
        "Aguascalientes robo",
        "Aguascalientes detención",
        "Aguascalientes cartel",
      ]);
      expect(result.providerMetadata?.observations?.at(-1)).toMatchObject({
        status: "FAILED",
        failureReason: "ACCESS_RESTRICTED",
      });
      expect(result[0]).toMatchObject({ geography: null, providerQuery: "Aguascalientes operativo" });
    });
  });

  describe("Fediverse", () => {
    const publicInstance: CifaFediverseInstance = {
      instance: "https://public.example", displayName: "Public", enabled: true,
      jurisdiction: "MX", priority: 10, requiresAuth: false,
    };
    const authInstance: CifaFediverseInstance = {
      instance: "https://auth.example", displayName: "Auth", enabled: true,
      jurisdiction: "MX", priority: 5, requiresAuth: true, tokenEnv: "CIFA_TEST_MASTODON_TOKEN",
    };

    test("public instance acquires statuses without claiming global search", async () => {
      mockedGet.mockResolvedValue(response(200, { statuses: [{
        id: "1", created_at: "2026-09-20T11:00:00Z", content: "<p>Reporte local</p>",
        url: "https://public.example/@u/1", account: { id: "u", acct: "u", display_name: "U" },
      }] }));
      const result = await searchFediverse("reporte", [publicInstance]);
      expect(result[0]).toMatchObject({ instance: "https://public.example", text: "Reporte local", geography: null });
      expect(result.providerMetadata?.observations?.[0]).toMatchObject({ status: "ACQUIRED", resultCount: 1 });
    });

    test("auth-required instance without token is independently NOT_CONFIGURED", async () => {
      delete process.env.CIFA_TEST_MASTODON_TOKEN;
      const result = await searchFediverse("reporte", [authInstance]);
      expect(result.acquisitionStatus).toBe("NOT_CONFIGURED");
      expect(result.providerMetadata?.observations?.[0]).toMatchObject({ status: "NOT_CONFIGURED" });
      expect(mockedGet).not.toHaveBeenCalled();
    });

    test("one acquired and one fallen instance yields PARTIAL", async () => {
      mockedGet.mockResolvedValueOnce(response(200, { statuses: [{
        id: "1", content: "Reporte", account: { id: "u", acct: "u" }, created_at: null,
      }] })).mockResolvedValueOnce(response(503, {}));
      const second = { ...publicInstance, instance: "https://down.example", displayName: "Down", priority: 1 };
      const result = await searchFediverse("reporte", [publicInstance, second]);
      expect(result.acquisitionStatus).toBe("PARTIAL");
      expect(result).toHaveLength(1);
      expect(result.providerMetadata?.observations?.map((item) => item.status)).toEqual(["ACQUIRED", "FAILED"]);
    });

    test("valid empty instance is NO_DATA", async () => {
      mockedGet.mockResolvedValue(response(200, { statuses: [] }));
      const result = await searchFediverse("sin resultados", [publicInstance]);
      expect(result.acquisitionStatus).toBe("NO_DATA");
    });
  });

  describe("official source registry acquisition", () => {
    const base = {
      organization: "Institución oficial", jurisdiction: "Aguascalientes",
      sourceType: "OFFICIAL_BULLETIN", category: "INSTITUTIONAL_BULLETIN" as const,
      enabled: true, priority: 1,
    };
    const rss: CifaOfficialSourceDefinition = {
      ...base, id: "rss", url: "https://official.example", feedUrl: "https://official.example/feed",
      acquisitionMethod: "RSS",
    };
    const json: CifaOfficialSourceDefinition = {
      ...base, id: "json", url: "https://official.example/api", feedUrl: null,
      acquisitionMethod: "JSON_API",
    };
    const html: CifaOfficialSourceDefinition = {
      ...base, id: "html", url: "https://official.example/news", feedUrl: null,
      acquisitionMethod: "PUBLIC_HTML",
    };

    function mockFetch(values: Array<{ ok: boolean; status: number; text?: string; json?: unknown }>) {
      global.fetch = jest.fn().mockImplementation(() => {
        const next = values.shift();
        return Promise.resolve({
          ok: next?.ok, status: next?.status,
          text: async () => next?.text ?? "",
          json: async () => next?.json,
        });
      }) as jest.Mock;
    }

    test("acquires RSS, JSON and public HTML with real timestamps only", async () => {
      mockFetch([
        { ok: true, status: 200, text: "<rss><item><title>Operativo oficial</title><link>https://official.example/a</link><pubDate>2026-09-20T10:00:00Z</pubDate></item></rss>" },
        { ok: true, status: 200, json: { items: [{ title: "Operativo JSON", url: "https://official.example/b" }] } },
        { ok: true, status: 200, text: '<a href="/c">Operativo HTML</a>' },
      ]);
      const result = await searchOfficialCeipolSources("operativo", [rss, json, html]);
      expect(result).toHaveLength(3);
      expect(result.find((item) => item.officialSourceId === "rss")?.publishedAt).toBe("2026-09-20T10:00:00.000Z");
      expect(result.filter((item) => item.officialSourceId !== "rss").every((item) => item.publishedAt === null)).toBe(true);
      expect(result.every((item) => typeof item.acquiredAt === "string" && item.isSimulated === undefined)).toBe(true);
    });

    test("one failed official source preserves successful evidence as PARTIAL", async () => {
      mockFetch([
        { ok: true, status: 200, text: '<a href="/a">Operativo oficial</a>' },
        { ok: false, status: 503 },
      ]);
      const failed = { ...html, id: "failed", url: "https://down.example" };
      const result = await searchOfficialCeipolSources("operativo", [html, failed]);
      expect(result.acquisitionStatus).toBe("PARTIAL");
      expect(result).toHaveLength(1);
      expect(result.providerMetadata?.observations?.map((item) => item.status)).toEqual(["ACQUIRED", "FAILED"]);
    });
  });

  test("acquisition attaches complete observed provenance and provider metadata", async () => {
    mockedGet.mockResolvedValue(response(200, { posts: [{
      uri: "at://did:plc:a/app.bsky.feed.post/1", cid: "c",
      author: { did: "did:plc:a", handle: "a.bsky.social" },
      record: { text: "Reporte", createdAt: null }, indexedAt: null,
    }] }));
    const envelope = await executeCifaSource(observedDefinition(() => searchBluesky("robo OR detención")), "robo OR detención");
    expect(envelope.providerMetadata).toMatchObject({
      originalQuery: "robo OR detención",
      providerQuery: "robo OR detención",
      providerQueries: ["robo", "detención"],
    });
    expect((envelope.data as any[])[0]).toMatchObject({
      acquisitionMode: "OBSERVED", semanticRole: "SOURCE_FACT", isSimulated: false,
      publishedAt: null, observedAt: null,
      provenance: {
        providerId: "EXPANDED_PROVIDER", providerName: "Expanded provider",
        sourceType: "EXPANDED_OBSERVATION", query: "robo OR detención",
        providerQuery: "robo", acquisitionMode: "OBSERVED",
        semanticRole: "SOURCE_FACT", isSimulated: false,
      },
    });
  });

  test("PARTIAL remains configured, executed, responded and with data in coverage metrics", async () => {
    const partial = Object.assign([{ id: "observed" }], {
      acquisitionStatus: "PARTIAL" as const,
      providerMetadata: { originalQuery: "q", providerQuery: "q", requestedLimit: 2, returnedCount: 1, truncated: false },
    });
    const envelope = await executeCifaSource(observedDefinition(async () => partial), "q");
    expect(envelope.acquisitionStatus).toBe("PARTIAL");
    expect(summarizeCifaSourceCoverage([envelope], 1)).toMatchObject({
      sourcesRequested: 1,
      sourcesConfigured: 1,
      sourcesExecuted: 1,
      sourcesResponded: 1,
      sourcesWithData: 1,
    });
  });
});

describe("CIFA query planning and multisource deduplication", () => {
  test("keeps original query while adapting scoped OR queries per provider", () => {
    expect(planCifaProviderQuery("Aguascalientes operativo OR robo", "BLUESKY")).toEqual({
      originalQuery: "Aguascalientes operativo OR robo",
      providerQuery: "Aguascalientes operativo OR Aguascalientes robo",
      providerQueries: ["Aguascalientes operativo", "Aguascalientes robo"],
      provider: "BLUESKY",
    });
    expect(planCifaProviderQuery("Aguascalientes operativo OR robo", "GDELT_DOC").providerQuery)
      .toBe("Aguascalientes (operativo OR robo)");
    expect(planCifaProviderQuery("Aguascalientes operativo OR robo", "NEWS_API").providerQuery)
      .toBe("Aguascalientes operativo OR robo");
  });

  test("collapses the same article deterministically and preserves every observation", () => {
    const result = deduplicateCifaRecords([[
      { title: "Mismo artículo", sourceUrl: "https://www.media.mx/a?utm_source=rss", publishedAt: "2026-09-20T01:00:00Z", providerId: "RSS" },
      { title: "Mismo articulo", sourceUrl: "https://media.mx/a", publishedAt: "2026-09-20T09:00:00Z", providerId: "NEWS_API" },
      { title: "Mismo artículo", sourceUrl: "https://mirror.mx/b", publishedAt: "2026-09-20T12:00:00Z", providerId: "GDELT_DOC" },
    ]]);
    expect(result).toMatchObject({ inputCount: 3, outputCount: 1, duplicatesCollapsed: 2 });
    expect(result.records[0].sourceObservations.map((item) => item.providerId)).toEqual(["RSS", "NEWS_API", "GDELT_DOC"]);
  });

  test("missing publishedAt stays null and does not over-collapse title-only records", () => {
    const result = deduplicateCifaRecords([[
      { title: "Título común", publishedAt: null, providerId: "A" },
      { title: "Título común", publishedAt: null, providerId: "B" },
    ]]);
    expect(result.outputCount).toBe(2);
    expect(result.records.every((record) => record.publishedAt === null)).toBe(true);
  });

  test("correlation keeps GDELT geography as a mentioned place with nullable chronology", async () => {
    const result = await runMultiSourceCorrelation({
      gdeltGeo: [{
        locationName: "Jesús María", locationRole: "MENTIONED_LOCATION", eventLocation: null,
        description: "Mención territorial", publishedAt: null, observedAt: null,
        sourceName: "GDELT GEO",
      }],
    }, { locationName: "Aguascalientes", nombre: "Expediente" });
    expect(result.correlatedEntities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "LUGAR_MENCIONADO", value: "Jesús María" }),
    ]));
    expect(result.chronology[0].date).toBeNull();
  });
});
