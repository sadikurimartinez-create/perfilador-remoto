import axios from "axios";
import { getDenueData } from "../src/lib/osintActions";
import { searchOverpass } from "../src/utils/urbanProviders";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("google-auth-library", () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({
      getAccessToken: jest.fn().mockResolvedValue({ token: "test-oauth-token" }),
    }),
  })),
}));

const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;
const originalDenueToken = process.env.INEGI_DENUE_TOKEN;
const originalDiscovery = {
  project: process.env.PGP_DISCOVERY_PROJECT_ID,
  location: process.env.PGP_DISCOVERY_LOCATION,
  engine: process.env.PGP_DISCOVERY_ENGINE_ID,
  servingConfig: process.env.PGP_DISCOVERY_SERVING_CONFIG,
  gcpProject: process.env.GCP_PROJECT_ID,
};
const originalProviderEnv = {
  youtube: process.env.YOUTUBE_API_KEY,
  legacyYoutube: process.env.YPU_TUBE_API_KEY,
  redditUserAgent: process.env.REDDIT_USER_AGENT,
  pgpRedditUserAgent: process.env.PGP_REDDIT_USER_AGENT,
  redditBearer: process.env.REDDIT_BEARER_TOKEN,
  pgpRedditBearer: process.env.PGP_REDDIT_BEARER_TOKEN,
  telegramToken: process.env.PGP_TELEGRAM_BOT_TOKEN,
  mapsKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  serpApiKey: process.env.PGP_SERPAPI_API_KEY,
};

function fetchResponse(status: number, data: unknown): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  };
}

function networkError(code: string) {
  return Object.assign(new Error("secret token Authorization private key DATABASE_URL"), { code });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

const denueRecord = {
  CLEE: "01001721112000684",
  Id: "9321560",
  Nombre: "Establecimiento observado",
  Razon_social: "",
  Clase_actividad: "Comercio",
  Estrato: "0 a 5 personas",
  Tipo_vialidad: "CALLE",
  Calle: "Vialidad observada",
  Num_Exterior: "1",
  Num_Interior: "",
  Colonia: "Zona observada",
  CP: "20000",
  Ubicacion: "AGUASCALIENTES, Aguascalientes, AGUASCALIENTES",
  Telefono: "",
  Correo_e: "",
  Sitio_internet: "",
  Tipo: "Fijo",
  Longitud: "-102.292",
  Latitud: "21.886",
  CentroComercial: "",
  TipoCentroComercial: "",
  NumLocal: "",
};

afterAll(() => {
  restoreEnv("INEGI_DENUE_TOKEN", originalDenueToken);
  restoreEnv("PGP_DISCOVERY_PROJECT_ID", originalDiscovery.project);
  restoreEnv("PGP_DISCOVERY_LOCATION", originalDiscovery.location);
  restoreEnv("PGP_DISCOVERY_ENGINE_ID", originalDiscovery.engine);
  restoreEnv("PGP_DISCOVERY_SERVING_CONFIG", originalDiscovery.servingConfig);
  restoreEnv("GCP_PROJECT_ID", originalDiscovery.gcpProject);
  restoreEnv("YOUTUBE_API_KEY", originalProviderEnv.youtube);
  restoreEnv("YPU_TUBE_API_KEY", originalProviderEnv.legacyYoutube);
  restoreEnv("REDDIT_USER_AGENT", originalProviderEnv.redditUserAgent);
  restoreEnv("PGP_REDDIT_USER_AGENT", originalProviderEnv.pgpRedditUserAgent);
  restoreEnv("REDDIT_BEARER_TOKEN", originalProviderEnv.redditBearer);
  restoreEnv("PGP_REDDIT_BEARER_TOKEN", originalProviderEnv.pgpRedditBearer);
  restoreEnv("PGP_TELEGRAM_BOT_TOKEN", originalProviderEnv.telegramToken);
  restoreEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", originalProviderEnv.mapsKey);
  restoreEnv("PGP_SERPAPI_API_KEY", originalProviderEnv.serpApiKey);
});

describe("DENUE productive contract", () => {
  beforeEach(() => {
    process.env.INEGI_DENUE_TOKEN = "test-denue-token";
    jest.restoreAllMocks();
  });

  test("real-shaped response with POIs is observed acquisition data", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(fetchResponse(200, [denueRecord]) as Response);

    const result = await getDenueData(21.886, -102.292);
    expect(result).toMatchObject({ exito: true, denueStatus: "SUCCESS", total: 1 });
    expect(result.epistemicIntegrity).toMatchObject({ acquisitionMode: "OBSERVED", acquisitionStatus: "ACQUIRED", isSimulated: false });
  });

  test("valid empty response is NO_DATA", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(fetchResponse(200, []) as Response);
    const result = await getDenueData(21.886, -102.292);
    expect(result).toMatchObject({ exito: true, denueStatus: "EMPTY", total: 0 });
    expect(result.epistemicIntegrity.acquisitionStatus).toBe("NO_DATA");
  });

  test("HTTP 200 object or malformed array remains INVALID_RESPONSE and never becomes NO_DATA", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(fetchResponse(200, { message: "provider message" }) as Response)
      .mockResolvedValueOnce(fetchResponse(200, ["not-a-record"]) as Response);

    const objectResult = await getDenueData(21.886, -102.292);
    const malformedArrayResult = await getDenueData(21.886, -102.292);

    expect(objectResult).toMatchObject({
      exito: false,
      denueStatus: "INVALID_RESPONSE",
      sanitizedFailureReason: "INVALID_RESPONSE",
    });
    expect(malformedArrayResult).toMatchObject({
      exito: false,
      denueStatus: "INVALID_RESPONSE",
      sanitizedFailureReason: "INVALID_RESPONSE",
    });
    expect(JSON.stringify([objectResult, malformedArrayResult])).not.toContain("provider message");
  });

  test("missing token is NOT_CONFIGURED without issuing a request", async () => {
    delete process.env.INEGI_DENUE_TOKEN;
    const fetchSpy = jest.spyOn(global, "fetch");
    const result = await getDenueData(21.886, -102.292);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ denueStatus: "NOT_CONFIGURED", sanitizedFailureReason: "NOT_CONFIGURED" });
  });

  test.each([
    [401, "AUTH_FAILED"],
    [403, "AUTH_FAILED"],
    [429, "RATE_LIMITED"],
    [503, "PROVIDER_UNAVAILABLE"],
  ])("HTTP %s remains FAILED with sanitized cause %s", async (status, reason) => {
    jest.spyOn(global, "fetch").mockResolvedValue(fetchResponse(status as number, { sensitive: "must-not-leak" }) as Response);
    const result = await getDenueData(21.886, -102.292);
    expect(result).toMatchObject({ exito: false, sanitizedFailureReason: reason, httpStatus: status });
    expect(result.epistemicIntegrity.acquisitionStatus).toBe("FAILED");
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
  });

  test("TLS/network error is FAILED and redacted", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(networkError("UNABLE_TO_VERIFY_LEAF_SIGNATURE"));
    const result = await getDenueData(21.886, -102.292);
    expect(result).toMatchObject({
      exito: false,
      sanitizedFailureReason: "TLS_CERTIFICATE_ERROR",
      providerErrorCode: "TLS_CERTIFICATE_ERROR",
      nativeErrorCode: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    });
    expect(JSON.stringify(result)).not.toMatch(/secret token|Authorization|private key|DATABASE_URL/);
  });
});

describe("OpenStreetMap Overpass productive contract", () => {
  beforeEach(() => mockedPost.mockReset());

  test("elements are acquired and an empty elements array remains NO_DATA-compatible", async () => {
    mockedPost.mockResolvedValueOnce({ data: { elements: [{ id: 1 }] } } as any);
    await expect(searchOverpass(21.886, -102.292)).resolves.toEqual([{ id: 1 }]);
    const [url, body, config] = mockedPost.mock.calls[0] as any[];
    expect(url).toContain("/api/interpreter");
    expect(new URLSearchParams(body).get("data")).toContain("out center;");
    expect(config.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    });
    mockedPost.mockResolvedValueOnce({ data: { elements: [] } } as any);
    await expect(searchOverpass(21.886, -102.292)).resolves.toEqual([]);
  });

  test("HTTP 406 remains HTTP_ERROR and is not retried as a transient failure", async () => {
    mockedPost.mockRejectedValueOnce({ code: "ERR_BAD_REQUEST", response: { status: 406 } });
    await expect(searchOverpass(21.886, -102.292)).rejects.toMatchObject({
      failure: { reason: "HTTP_ERROR", httpStatus: 406, nativeErrorCode: "ERR_BAD_REQUEST" },
    });
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  test.each([
    [429, "RATE_LIMITED"],
    [503, "PROVIDER_UNAVAILABLE"],
  ])("HTTP %s tries one alternate then remains %s", async (status, reason) => {
    mockedPost.mockRejectedValueOnce({ response: { status } }).mockRejectedValueOnce({ response: { status } });
    await expect(searchOverpass(21.886, -102.292)).rejects.toMatchObject({ failure: { reason } });
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  test("network failure tries at most one alternate and remains sanitized", async () => {
    mockedPost.mockRejectedValueOnce(networkError("ECONNRESET")).mockRejectedValueOnce(networkError("ECONNRESET"));
    await expect(searchOverpass(21.886, -102.292)).rejects.toMatchObject({
      failure: { reason: "NETWORK_ERROR", technicalCode: "CONNECTION_RESET" },
    });
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  test("one controlled alternate can recover a transient primary failure", async () => {
    mockedPost
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({ data: { elements: [{ id: 2 }] } } as any);
    await expect(searchOverpass(21.886, -102.292)).resolves.toEqual([{ id: 2 }]);
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  test("TLS evidence in a nested native cause is preserved and tries only one alternate", async () => {
    const tlsError = Object.assign(new Error("sensitive transport detail"), {
      code: "ERR_NETWORK",
      cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE", name: "Error" },
    });
    mockedPost.mockRejectedValueOnce(tlsError).mockRejectedValueOnce(tlsError);

    await expect(searchOverpass(21.886, -102.292)).rejects.toMatchObject({
      failure: {
        reason: "TLS_CERTIFICATE_ERROR",
        nativeErrorCode: "ERR_NETWORK",
        nativeCauseCode: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      },
    });
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });
});

describe("Google Discovery Engine productive contract", () => {
  beforeEach(() => {
    jest.resetModules();
    mockedPost.mockReset();
    process.env.PGP_DISCOVERY_PROJECT_ID = "test-project";
    process.env.PGP_DISCOVERY_LOCATION = "global";
    process.env.PGP_DISCOVERY_ENGINE_ID = "cifa-enterprise-engine";
    process.env.PGP_DISCOVERY_SERVING_CONFIG = "default_search";
    delete process.env.GCP_PROJECT_ID;
  });

  async function search() {
    const module = await import("../src/utils/socialProviders");
    return module.buscarEnWebOSINT("Aguascalientes seguridad");
  }

  test("real REST-shaped results are preserved as observed search results", async () => {
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.post as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: {
        totalSize: 1,
        attributionToken: "test-attribution-token",
        nextPageToken: "test-next-page-token",
        summary: {
          summaryText: "Resumen generativo del proveedor",
          summarySkippedReasons: [],
        },
        queryExpansionInfo: {
          expandedQuery: true,
          pinnedResultCount: 0,
        },
        semanticState: "ENABLED",
        results: [{
          rankSignals: { score: 0.91 },
          retrievalSignals: { semanticState: "ENABLED" },
          document: {
            id: "doc-1",
            name: "projects/test-project/locations/global/collections/default_collection/dataStores/cifa-trial-content/branches/0/documents/doc-1",
            derivedStructData: {
              title: "Resultado",
              link: "https://example.test/result",
              snippets: [{ snippet: "Resumen" }],
              extractive_answers: [{ content: "Evidencia extractiva observada", pageNumber: 2 }],
            },
          },
        }],
      },
    });
    const result = await search();
    expect(result.resultadosWeb).toEqual([expect.objectContaining({
      id: "doc-1",
      title: "Resultado",
      snippet: "Resumen",
      extractiveAnswers: [{ content: "Evidencia extractiva observada", pageNumber: 2 }],
      extractive_answers: [{ content: "Evidencia extractiva observada", pageNumber: 2 }],
      rankSignals: { score: 0.91 },
      retrievalSignals: { semanticState: "ENABLED" },
      provenance: expect.objectContaining({
        project: "test-project",
        location: "global",
        engine: "cifa-enterprise-engine",
        servingConfig: "default_search",
        query: "Aguascalientes seguridad",
        sourceUrl: "https://example.test/result",
      }),
    })]);
    expect(result.resultadosWeb[0]).not.toHaveProperty("summary");
    expect(result.resultadosWeb[0]).not.toHaveProperty("semanticState");
    expect(result.discoveryMetadata).toEqual({
      semanticState: "ENABLED",
      summary: {
        summaryText: "Resumen generativo del proveedor",
        summarySkippedReasons: [],
      },
      totalSize: 1,
      attributionToken: "test-attribution-token",
      nextPageToken: "test-next-page-token",
      queryExpansionInfo: {
        expandedQuery: true,
        pinnedResultCount: 0,
      },
      summaryEpistemicIntegrity: {
        providerId: "GOOGLE_DISCOVERY_ENGINE",
        acquisitionMode: "AI_GENERATED",
        semanticRole: "SYNTHESIS",
        isSimulated: false,
      },
    });
    const [url, payload] = (dynamicAxios.post as jest.Mock).mock.calls[0];
    expect(url).toBe("https://discoveryengine.googleapis.com/v1/projects/test-project/locations/global/collections/default_collection/engines/cifa-enterprise-engine/servingConfigs/default_search:search");
    expect(payload.contentSearchSpec).toEqual({
      summarySpec: { summaryResultCount: 3 },
      extractiveContentSpec: { maxExtractiveAnswerCount: 1 },
    });
    expect(payload.contentSearchSpec).not.toHaveProperty("summaryResultCount");
  });

  test("serving config env var is reflected in the productive Search URL", async () => {
    process.env.PGP_DISCOVERY_SERVING_CONFIG = "custom_search";
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.post as jest.Mock).mockResolvedValueOnce({ status: 200, data: { results: [] } });

    await search();

    const [url] = (dynamicAxios.post as jest.Mock).mock.calls[0];
    expect(url).toBe("https://discoveryengine.googleapis.com/v1/projects/test-project/locations/global/collections/default_collection/engines/cifa-enterprise-engine/servingConfigs/custom_search:search");
  });

  test("zero provider results remains an empty observed result", async () => {
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.post as jest.Mock).mockResolvedValueOnce({ status: 200, data: { results: [] } });
    await expect(search()).resolves.toMatchObject({ resultadosWeb: [] });
  });

  test("missing results is a valid no-data response and preserves top-level metadata", async () => {
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.post as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: {
        attributionToken: "token",
        queryExpansionInfo: {},
        semanticState: "DISABLED",
        summary: { summaryText: "No se encontraron resultados relevantes" },
      },
    });

    await expect(search()).resolves.toMatchObject({
      resultadosWeb: [],
      analisisInteligencia: null,
      discoveryMetadata: {
        attributionToken: "token",
        queryExpansionInfo: {},
        semanticState: "DISABLED",
        summary: { summaryText: "No se encontraron resultados relevantes" },
      },
    });
  });

  test("present results with an unexpected type remains INVALID_RESPONSE", async () => {
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.post as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: { results: "invalid" },
    });

    await expect(search()).rejects.toMatchObject({
      failure: { reason: "INVALID_RESPONSE" },
    });
  });

  test.each([
    [401, "AUTH_FAILED"],
    [403, "AUTH_FAILED"],
    [429, "RATE_LIMITED"],
    [503, "PROVIDER_UNAVAILABLE"],
  ])("HTTP %s throws a sanitized %s failure", async (status, reason) => {
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.post as jest.Mock).mockResolvedValueOnce({ status, data: { error: { message: "secret response body" } } });
    await expect(search()).rejects.toMatchObject({ failure: { reason, httpStatus: status } });
  });

  test("configuration absence returns no provider output", async () => {
    delete process.env.PGP_DISCOVERY_ENGINE_ID;
    const result = await search();
    expect(result).toEqual({ resultadosWeb: [], analisisInteligencia: null });
  });

  test("network/TLS failure remains FAILED-compatible and redacted", async () => {
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.post as jest.Mock).mockRejectedValueOnce(networkError("UNABLE_TO_VERIFY_LEAF_SIGNATURE"));
    let failure: unknown;
    try {
      await search();
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      name: "ExternalProviderError",
      failure: {
        reason: "TLS_CERTIFICATE_ERROR",
        technicalCode: "TLS_CERTIFICATE_ERROR",
        nativeErrorCode: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      },
    });
    expect(JSON.stringify((failure as any).failure)).not.toMatch(/secret token|Authorization|private key|DATABASE_URL/);
  });

  test("OAuth TLS failure preserves native evidence and prevents Discovery search", async () => {
    const googleAuthMock = jest.requireMock("google-auth-library").GoogleAuth as jest.Mock;
    googleAuthMock.mockImplementationOnce(() => ({
      getClient: jest.fn().mockResolvedValue({
        getAccessToken: jest.fn().mockRejectedValue(Object.assign(new Error("secret credential detail"), {
          code: "ERR_NETWORK",
          cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE", name: "Error" },
        })),
      }),
    }));

    await expect(search()).rejects.toMatchObject({
      failure: {
        reason: "TLS_CERTIFICATE_ERROR",
        nativeErrorCode: "ERR_NETWORK",
        nativeCauseCode: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      },
    });
    const dynamicAxios = (await import("axios")).default;
    expect(dynamicAxios.post).not.toHaveBeenCalled();
  });
});

describe("CIFA external provider readiness and failure semantics", () => {
  beforeEach(() => {
    jest.resetModules();
    (axios.get as jest.Mock).mockReset();
    (axios.post as jest.Mock).mockReset();
  });

  test("Reddit OAuth search operates with bearer, institutional User-Agent and valid empty data", async () => {
    delete process.env.REDDIT_USER_AGENT;
    delete process.env.PGP_REDDIT_USER_AGENT;
    process.env.PGP_REDDIT_BEARER_TOKEN = "test-reddit-token";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock).mockResolvedValueOnce({ data: { data: { children: [] } } });
    const { searchReddit } = await import("../src/utils/socialProviders");

    await expect(searchReddit("Aguascalientes")).resolves.toEqual([]);
    expect((dynamicAxios.get as jest.Mock).mock.calls[0][0]).toContain("https://oauth.reddit.com/search");
    expect((dynamicAxios.get as jest.Mock).mock.calls[0][1].headers["User-Agent"]).toBe("PERFILADOR-REMOTO-SSPE-CEIPOL/1.0");
    expect((dynamicAxios.get as jest.Mock).mock.calls[0][1].headers.Authorization).toBe("Bearer test-reddit-token");
  });

  test.each([
    [401, "AUTH_FAILED"],
    [403, "AUTH_FAILED"],
    [429, "RATE_LIMITED"],
  ])("Reddit HTTP %s preserves %s instead of returning NO_DATA", async (status, reason) => {
    process.env.PGP_REDDIT_BEARER_TOKEN = "invalid-test-token";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock).mockRejectedValueOnce({ response: { status } });
    const { searchReddit } = await import("../src/utils/socialProviders");

    await expect(searchReddit("Aguascalientes")).rejects.toMatchObject({
      failure: { reason, httpStatus: status },
    });
  });

  test("Reddit rejects malformed OAuth response schema", async () => {
    process.env.PGP_REDDIT_BEARER_TOKEN = "test-reddit-token";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock).mockResolvedValueOnce({ data: { data: { children: "invalid" } } });
    const { searchReddit } = await import("../src/utils/socialProviders");

    await expect(searchReddit("Aguascalientes")).rejects.toMatchObject({ failure: { reason: "INVALID_RESPONSE" } });
  });

  test("Reddit without OAuth credentials does not issue a provider request", async () => {
    delete process.env.REDDIT_BEARER_TOKEN;
    delete process.env.PGP_REDDIT_BEARER_TOKEN;
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    const { searchReddit } = await import("../src/utils/socialProviders");

    await expect(searchReddit("Aguascalientes")).resolves.toEqual([]);
    expect(dynamicAxios.get).not.toHaveBeenCalled();
  });

  test("Telegram matches OR terms only within updates delivered to the configured bot", async () => {
    process.env.PGP_TELEGRAM_BOT_TOKEN = "test-token";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock).mockResolvedValueOnce({
      data: {
        ok: true,
        result: [
          { message: { text: "Reporte de robo", date: 1, chat: { title: "Canal A" } } },
          { channel_post: { text: "Sin novedad", date: 1, chat: { title: "Canal B" } } },
        ],
      },
    });
    const { searchTelegram } = await import("../src/utils/socialProviders");

    await expect(searchTelegram("Aguascalientes operativo OR robo OR detención")).resolves.toEqual([
      expect.objectContaining({ texto: "Reporte de robo", chat: "Canal A" }),
    ]);
  });

  test("Telegram webhook conflict remains a classified provider failure", async () => {
    process.env.PGP_TELEGRAM_BOT_TOKEN = "test-token";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock).mockResolvedValueOnce({ data: { ok: false, error_code: 409 } });
    const { searchTelegram } = await import("../src/utils/socialProviders");

    await expect(searchTelegram("consulta")).rejects.toMatchObject({
      failure: { reason: "PROVIDER_UNAVAILABLE", technicalCode: "TELEGRAM_WEBHOOK_CONFLICT" },
    });
  });

  test("the canonical YouTube key is preferred when both names exist", async () => {
    process.env.YOUTUBE_API_KEY = "test-canonical-youtube-key";
    process.env.YPU_TUBE_API_KEY = "test-legacy-youtube-key";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock).mockResolvedValueOnce({ data: { items: [] } });
    const { searchYouTubeOSINT } = await import("../src/utils/osintProviders");

    await expect(searchYouTubeOSINT("consulta")).resolves.toEqual([]);
    expect((dynamicAxios.get as jest.Mock).mock.calls[0][1].params.key).toBe("test-canonical-youtube-key");
  });

  test("the legacy production YouTube key name is accepted by the productive adapter", async () => {
    delete process.env.YOUTUBE_API_KEY;
    process.env.YPU_TUBE_API_KEY = "test-legacy-youtube-key";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock).mockResolvedValueOnce({ data: { items: [] } });
    const { searchYouTubeOSINT } = await import("../src/utils/osintProviders");

    await expect(searchYouTubeOSINT("consulta")).resolves.toEqual([]);
    expect((dynamicAxios.get as jest.Mock).mock.calls[0][1].params.key).toBe("test-legacy-youtube-key");
  });

  test("SerpAPI missing configuration performs no request", async () => {
    delete process.env.PGP_SERPAPI_API_KEY;
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    const { searchSerpAPI } = await import("../src/utils/osintProviders");

    await expect(searchSerpAPI("consulta")).resolves.toEqual([]);
    expect(dynamicAxios.get).not.toHaveBeenCalled();
  });

  test("SerpAPI valid empty results remain NO_DATA-compatible", async () => {
    process.env.PGP_SERPAPI_API_KEY = "test-serp-key";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock).mockResolvedValueOnce({ data: { organic_results: [] } });
    const { searchSerpAPI } = await import("../src/utils/osintProviders");

    await expect(searchSerpAPI("consulta")).resolves.toEqual([]);
  });

  test.each([
    [401, "AUTH_FAILED"],
    [403, "AUTH_FAILED"],
    [429, "RATE_LIMITED"],
    [503, "PROVIDER_UNAVAILABLE"],
  ])("SerpAPI HTTP %s remains %s", async (status, reason) => {
    process.env.PGP_SERPAPI_API_KEY = "test-serp-key";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock).mockRejectedValueOnce({ response: { status } });
    const { searchSerpAPI } = await import("../src/utils/osintProviders");

    await expect(searchSerpAPI("consulta")).rejects.toMatchObject({ failure: { reason, httpStatus: status } });
  });

  test.each([
    ["REQUEST_DENIED", "AUTH_FAILED"],
    ["OVER_QUERY_LIMIT", "RATE_LIMITED"],
  ])("Google Places status %s remains a provider failure classified as %s", async (status, reason) => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock).mockResolvedValueOnce({ data: { status, error_message: "do-not-expose" } });
    const { searchGooglePlaces } = await import("../src/utils/urbanProviders");

    await expect(searchGooglePlaces(21.886, -102.292)).rejects.toMatchObject({ failure: { reason } });
  });

  test("Google Places preserves valid data and ZERO_RESULTS as successful provider responses", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock)
      .mockResolvedValueOnce({ data: { status: "OK", results: [{ place_id: "place-1" }] } })
      .mockResolvedValue({ data: { status: "ZERO_RESULTS", results: [] } });
    const { searchGooglePlaces } = await import("../src/utils/urbanProviders");

    await expect(searchGooglePlaces(21.886, -102.292)).resolves.toEqual([{ place_id: "place-1" }]);
    expect(dynamicAxios.get).toHaveBeenCalledTimes(7);
  });
});
