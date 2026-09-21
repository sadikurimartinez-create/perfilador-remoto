import {
  executeCifaBatch,
  executeCifaSource,
  summarizeCifaSourceCoverage,
  type CifaSourceDefinition,
} from "../src/utils/cifaAcquisition";
import { ExternalProviderError } from "../src/utils/externalProviderError";
import {
  buildCanonicalProjectGeography,
  resolveCanonicalAcquisitionGeography,
} from "../src/utils/canonicalProjectGeography";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const originalTelegramToken = process.env.PGP_TELEGRAM_BOT_TOKEN;
const originalTelegramTokenAlias = process.env.TELEGRAM_BOT_TOKEN;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function telegramSourceDefinition(execute: () => Promise<unknown>): CifaSourceDefinition {
  return {
    sourceKey: "telegram",
    sourceId: "telegram-bot-updates",
    providerId: "TELEGRAM_BOT_API",
    providerName: "Telegram Bot API (updates recibidos)",
    sourceType: "TELEGRAM_BOT_UPDATES",
    classification: "OBSERVED_REAL",
    acquisitionMode: "OBSERVED",
    semanticRole: "SOURCE_FACT",
    sourceReference: "src/utils/socialProviders.ts:searchTelegram",
    sourceUrl: "https://api.telegram.org/",
    rawSourceReference: "telegram:getUpdates:configured-chats-only",
    readiness: () => ({
      ready: Boolean(process.env.PGP_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN),
      code: "SOURCE_NOT_CONFIGURED",
    }),
    execute,
    failureCode: "TELEGRAM_REQUEST_FAILED",
  };
}

function source(
  sourceKey: string,
  execute: () => Promise<unknown>,
  readiness?: CifaSourceDefinition["readiness"],
  acquisitionMode: "OBSERVED" | "AI_GENERATED" = "OBSERVED"
): CifaSourceDefinition {
  return {
    sourceKey,
    sourceId: `${sourceKey}-source`,
    providerId: `${sourceKey.toUpperCase()}_PROVIDER`,
    providerName: `${sourceKey} provider`,
    sourceType: `${sourceKey.toUpperCase()}_DATA`,
    classification: acquisitionMode === "AI_GENERATED" ? "AI_DERIVED" : "OBSERVED_REAL",
    acquisitionMode,
    semanticRole: acquisitionMode === "AI_GENERATED" ? "SYNTHESIS" : "SOURCE_FACT",
    sourceReference: `test:${sourceKey}`,
    sourceUrl: `https://example.test/${sourceKey}`,
    rawSourceReference: `raw:${sourceKey}`,
    readiness,
    execute,
  };
}

describe("CIFA productive source execution", () => {
  afterAll(() => {
    restoreEnv("PGP_TELEGRAM_BOT_TOKEN", originalTelegramToken);
    restoreEnv("TELEGRAM_BOT_TOKEN", originalTelegramTokenAlias);
  });

  test("calls the configured provider and preserves its lineage", async () => {
    const searchFunc = jest.fn().mockResolvedValue([{ id: "real-1", title: "Observed result" }]);
    const result = await executeCifaSource(source("reddit", searchFunc), "consulta real");

    expect(searchFunc).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      acquisitionStatus: "ACQUIRED",
      acquisitionMode: "OBSERVED",
      providerId: "REDDIT_PROVIDER",
      resultCount: 1,
      isSimulated: false,
    });
    expect((result.data as any[])[0].epistemicIntegrity).toMatchObject({
      providerId: "REDDIT_PROVIDER",
      acquisitionMode: "OBSERVED",
      sourceUrl: "https://example.test/reddit",
      query: "consulta real",
    });
    expect((result.data as any[])[0]).toMatchObject({
      source: "reddit provider",
      providerId: "REDDIT_PROVIDER",
      sourceUrl: "https://example.test/reddit",
      query: "consulta real",
      acquisitionMode: "OBSERVED",
      semanticRole: "SOURCE_FACT",
      isSimulated: false,
      provenance: expect.objectContaining({ providerId: "REDDIT_PROVIDER", query: "consulta real" }),
    });
  });

  test.each([
    ["youtube", "YOUTUBE_DATA_API_V3"],
    ["google-places", "GOOGLE_PLACES"],
  ])("keeps %s productive results observed and non-simulated", async (sourceKey, providerId) => {
    const searchFunc = jest.fn().mockResolvedValue([{ id: `${sourceKey}-1` }]);
    const definition = source(sourceKey, searchFunc);
    definition.providerId = providerId;

    const result = await executeCifaSource(definition, "consulta real");

    expect(searchFunc).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      acquisitionStatus: "ACQUIRED",
      acquisitionMode: "OBSERVED",
      providerId,
      resultCount: 1,
      isSimulated: false,
    });
  });

  test("provider failure is FAILED and never creates substitute records", async () => {
    const result = await executeCifaSource(
      source("youtube", jest.fn().mockRejectedValue(new Error("secret-bearing provider error"))),
      "consulta"
    );

    expect(result.acquisitionStatus).toBe("FAILED");
    expect(result.data).toEqual([]);
    expect(result.resultCount).toBe(0);
    expect(result.errorMessage).not.toContain("secret-bearing");
    expect(JSON.stringify(result)).not.toContain("CIFA_MOCK_");
  });

  test("provider causal category is preserved without exposing the original error", async () => {
    const result = await executeCifaSource(
      source("discovery", jest.fn().mockRejectedValue(new ExternalProviderError({
        reason: "AUTH_FAILED",
        httpStatus: 403,
        technicalCode: "HTTP_403",
        nativeErrorCode: "ERR_BAD_REQUEST",
      }))),
      "consulta"
    );

    expect(result).toMatchObject({
      acquisitionStatus: "FAILED",
      sanitizedFailureReason: "AUTH_FAILED",
      providerErrorCode: "HTTP_403",
      httpStatus: 403,
      nativeErrorCode: "ERR_BAD_REQUEST",
    });
    expect(result.errorMessage).not.toMatch(/token|Authorization|private key|DATABASE_URL/);
  });

  test("empty provider response is NO_DATA", async () => {
    const result = await executeCifaSource(source("rss", jest.fn().mockResolvedValue([])), "consulta");
    expect(result.acquisitionStatus).toBe("NO_DATA");
    expect(result.data).toEqual([]);
  });

  test("coverage distinguishes execution, valid response, data and non-applicable sources", async () => {
    const unsupported = source("unsupported", jest.fn(), () => ({ ready: false, status: "UNAVAILABLE", code: "UNSUPPORTED_PROVIDER" }));
    unsupported.applicable = false;
    const results = await executeCifaBatch([
      source("with-data", jest.fn().mockResolvedValue([{ id: "1" }])) as any,
      source("without-data", jest.fn().mockResolvedValue([])) as any,
      source("failed", jest.fn().mockRejectedValue(new Error("provider down"))) as any,
      source("missing", jest.fn(), () => ({ ready: false })) as any,
      unsupported as any,
    ], "consulta");

    expect(summarizeCifaSourceCoverage(results, 5)).toEqual({
      sourcesRequested: 5,
      sourcesConfigured: 3,
      sourcesExecuted: 3,
      sourcesResponded: 2,
      sourcesWithData: 1,
      sourcesApplicable: 4,
      sourcesNotApplicable: 1,
      sourcesUnavailable: 0,
      executionCoveragePercent: 75,
    });
    expect(results[1]).toMatchObject({ acquisitionStatus: "NO_DATA", selectedForProductiveAcquisition: true });
    expect(results.every((result) => result.isSimulated === false)).toBe(true);
  });

  test("global coverage reports the exact 15/2/10/8/6/3 contract", async () => {
    const definitions: CifaSourceDefinition[] = [];
    for (let index = 0; index < 3; index += 1) {
      definitions.push(source(`data-${index}`, jest.fn().mockResolvedValue([{ id: index }])));
      definitions.push(source(`empty-${index}`, jest.fn().mockResolvedValue([])));
    }
    for (let index = 0; index < 2; index += 1) {
      definitions.push(source(`failed-${index}`, jest.fn().mockRejectedValue(new ExternalProviderError({
        reason: "PROVIDER_UNAVAILABLE",
        httpStatus: 503,
      }))));
      definitions.push(source(`geo-blocked-${index}`, jest.fn(), () => ({
        ready: false,
        configured: true,
        status: "UNAVAILABLE",
        code: "INVALID_COORDINATES",
      })));
    }
    for (let index = 0; index < 3; index += 1) {
      definitions.push(source(`missing-${index}`, jest.fn(), () => ({ ready: false, code: "SOURCE_NOT_CONFIGURED" })));
    }
    const aggregator = source("aggregator", jest.fn(), () => ({
      ready: false,
      status: "UNAVAILABLE",
      code: "NOT_APPLICABLE_AGGREGATOR",
    }));
    aggregator.applicable = false;
    const unsupported = source("unsupported", jest.fn(), () => ({
      ready: false,
      status: "UNAVAILABLE",
      code: "UNSUPPORTED_PROVIDER",
    }));
    unsupported.applicable = false;
    definitions.push(aggregator, unsupported);

    const results = await executeCifaBatch(definitions, "consulta");

    expect(summarizeCifaSourceCoverage(results, 15)).toEqual({
      sourcesRequested: 15,
      sourcesConfigured: 10,
      sourcesExecuted: 8,
      sourcesResponded: 6,
      sourcesWithData: 3,
      sourcesApplicable: 13,
      sourcesNotApplicable: 2,
      sourcesUnavailable: 2,
      executionCoveragePercent: 62,
    });
  });

  test("missing configuration is governed and does not call the provider", async () => {
    const searchFunc = jest.fn().mockResolvedValue([{ id: "must-not-run" }]);
    const result = await executeCifaSource(
      source("x", searchFunc, () => ({ ready: false, code: "SOURCE_NOT_CONFIGURED" })),
      "consulta"
    );

    expect(searchFunc).not.toHaveBeenCalled();
    expect(result.acquisitionStatus).toBe("NOT_CONFIGURED");
    expect(result.data).toEqual([]);
  });

  test("batch keeps two acquired, one empty, one failed and one unconfigured", async () => {
    const results = await executeCifaBatch([
      source("rss", jest.fn().mockResolvedValue([{ id: "rss-1" }])) as any,
      source("reddit", jest.fn().mockResolvedValue([{ id: "reddit-1" }])) as any,
      source("telegram", jest.fn().mockResolvedValue([])) as any,
      source("youtube", jest.fn().mockRejectedValue(new Error("provider down"))) as any,
      source("x", jest.fn(), () => ({ ready: false })) as any,
    ], "consulta");

    expect(results.map((result) => result.acquisitionStatus)).toEqual([
      "ACQUIRED",
      "ACQUIRED",
      "NO_DATA",
      "FAILED",
      "NOT_CONFIGURED",
    ]);
    expect(results.filter((result) => result.resultCount > 0)).toHaveLength(2);
  });

  test("AI output remains AI_GENERATED and is never relabeled OBSERVED", async () => {
    const result = await executeCifaSource(
      source("gemini-analysis", jest.fn().mockResolvedValue({ summary: "derived" }), undefined, "AI_GENERATED"),
      "consulta"
    );

    expect(result.acquisitionMode).toBe("AI_GENERATED");
    expect(result.semanticRole).toBe("SYNTHESIS");
    expect((result.data as any).epistemicIntegrity.isDerived).toBe(true);
  });

  test("Telegram without token is NOT_CONFIGURED and never executes", async () => {
    delete process.env.PGP_TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    const execute = jest.fn().mockResolvedValue([]);

    const result = await executeCifaSource(telegramSourceDefinition(execute), "consulta");

    expect(result).toMatchObject({
      acquisitionStatus: "NOT_CONFIGURED",
      configuredForProductiveAcquisition: false,
      selectedForProductiveAcquisition: false,
      errorCode: "SOURCE_NOT_CONFIGURED",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  test("Telegram matched updates are ACQUIRED with complete observed provenance", async () => {
    process.env.PGP_TELEGRAM_BOT_TOKEN = "test-token";
    delete process.env.TELEGRAM_BOT_TOKEN;
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock)
      .mockResolvedValueOnce({ status: 200, data: { ok: true, result: { id: 1 } } })
      .mockResolvedValueOnce({ status: 200, data: { ok: true, result: { url: "" } } })
      .mockResolvedValueOnce({
        status: 200,
        data: { ok: true, result: [{ message: { text: "Reporte de robo", date: 1, chat: { title: "Canal" } } }] },
      });
    const { searchTelegram } = await import("../src/utils/socialProviders");

    const result = await executeCifaSource(
      telegramSourceDefinition(() => searchTelegram("robo")),
      "robo"
    );

    expect(result).toMatchObject({
      acquisitionStatus: "ACQUIRED",
      resultCount: 1,
      providerId: "TELEGRAM_BOT_API",
      providerName: "Telegram Bot API (updates recibidos)",
      sourceType: "TELEGRAM_BOT_UPDATES",
      acquisitionMode: "OBSERVED",
      semanticRole: "SOURCE_FACT",
      isSimulated: false,
    });
    expect((result.data as any[])[0]).toMatchObject({
      providerId: "TELEGRAM_BOT_API",
      source: "Telegram Bot API (updates recibidos)",
      sourceUrl: "https://api.telegram.org/",
      query: "robo",
      acquisitionMode: "OBSERVED",
      semanticRole: "SOURCE_FACT",
      isSimulated: false,
      acquiredAt: expect.any(String),
      provenance: expect.objectContaining({ providerId: "TELEGRAM_BOT_API", query: "robo" }),
    });
  });

  test("Telegram successful polling without matches is NO_DATA", async () => {
    process.env.PGP_TELEGRAM_BOT_TOKEN = "test-token";
    jest.resetModules();
    const dynamicAxios = (await import("axios")).default;
    (dynamicAxios.get as jest.Mock)
      .mockResolvedValueOnce({ status: 200, data: { ok: true, result: { id: 1 } } })
      .mockResolvedValueOnce({ status: 200, data: { ok: true, result: { url: "" } } })
      .mockResolvedValueOnce({ status: 200, data: { ok: true, result: [] } });
    const { searchTelegram } = await import("../src/utils/socialProviders");

    const result = await executeCifaSource(
      telegramSourceDefinition(() => searchTelegram("consulta")),
      "consulta"
    );

    expect(result).toMatchObject({
      acquisitionStatus: "NO_DATA",
      resultCount: 0,
      configuredForProductiveAcquisition: true,
      selectedForProductiveAcquisition: true,
      isSimulated: false,
    });
  });

  test("Telegram webhook failure metadata reaches the CIFA envelope sanitized", async () => {
    process.env.PGP_TELEGRAM_BOT_TOKEN = "test-token";
    const result = await executeCifaSource(
      telegramSourceDefinition(jest.fn().mockRejectedValue(new ExternalProviderError({
        reason: "WEBHOOK_CONFLICT",
        httpStatus: 409,
        technicalCode: "TELEGRAM_WEBHOOK_CONFLICT",
        nativeErrorCode: "409",
        providerDescription: "Conflict: webhook activo.",
      }))),
      "consulta"
    );

    expect(result).toMatchObject({
      acquisitionStatus: "FAILED",
      sanitizedFailureReason: "WEBHOOK_CONFLICT",
      providerErrorCode: "TELEGRAM_WEBHOOK_CONFLICT",
      nativeErrorCode: "409",
      httpStatus: 409,
      providerDescription: "Conflict: webhook activo.",
      data: [],
      isSimulated: false,
    });
  });
});

describe("CIFA canonical geographic acquisition contract", () => {
  test.each([
    ["INDIVIDUAL", [{ lat: 21.886, lng: -102.292 }], { lat: 21.886, lng: -102.292 }, "CANONICAL_POINT"],
    ["CORRIDOR", [
      { lat: 21.88, lng: -102.30 },
      { lat: 21.89, lng: -102.29 },
      { lat: 21.90, lng: -102.28 },
    ], { lat: 21.89, lng: -102.29 }, "CORRIDOR_NODE"],
    ["POLYGON", [
      { lat: 21.88, lng: -102.30 },
      { lat: 21.90, lng: -102.30 },
      { lat: 21.90, lng: -102.28 },
      { lat: 21.88, lng: -102.28 },
    ], { lat: 21.89, lng: -102.29 }, "POLYGON_CENTROID"],
  ])("derives %s provider coordinates without discarding canonical geometry", (type, points, expectedPoint, derivation) => {
    const canonicalGeography = buildCanonicalProjectGeography({
      projectId: `test-${String(type).toLowerCase()}`,
      type: type as string,
      points: points as Array<{ lat: number; lng: number }>,
      now: 1,
    });

    const context = resolveCanonicalAcquisitionGeography({ id: "project", canonicalGeography });

    expect(context).toMatchObject({
      geographyType: type,
      queryPointDerivation: derivation,
      source: "PROJECT_CREATION",
    });
    expect(context?.queryPoint.lat).toBeCloseTo((expectedPoint as { lat: number }).lat, 8);
    expect(context?.queryPoint.lng).toBeCloseTo((expectedPoint as { lng: number }).lng, 8);
    expect(context?.coordinates).toEqual(points);
    expect(context?.geometry).toEqual(canonicalGeography.geometry);
  });

  test("never promotes legacy scalar coordinates into corridor or polygon fallback geometry", () => {
    expect(resolveCanonicalAcquisitionGeography({
      id: "lineal-no-canonical",
      geometryType: "LINEAL",
      latitude: 21.885,
      longitude: -102.291,
    })).toBeNull();
    expect(resolveCanonicalAcquisitionGeography({
      id: "polygon-no-canonical",
      geometryType: "POLIGONO",
      latitude: 21.885,
      longitude: -102.291,
    })).toBeNull();
  });

  test("rejects an invalid canonical draft instead of querying the internal zero marker", () => {
    const invalidCanonical = buildCanonicalProjectGeography({
      projectId: "invalid-point",
      type: "INDIVIDUAL",
      points: [],
      now: 1,
    });

    expect(invalidCanonical.validationStatus).toBe("INVALID");
    expect(resolveCanonicalAcquisitionGeography({
      id: "invalid-point",
      canonicalGeography: invalidCanonical,
    })).toBeNull();
  });

  test("recomputes polygon centroid from geometry instead of trusting stale derived metadata", () => {
    const canonicalGeography = buildCanonicalProjectGeography({
      projectId: "stale-centroid",
      type: "POLYGON",
      points: [
        { lat: 21.88, lng: -102.30 },
        { lat: 21.90, lng: -102.30 },
        { lat: 21.90, lng: -102.28 },
      ],
      now: 1,
    });
    canonicalGeography.derived = {
      ...canonicalGeography.derived,
      centroid: { lat: 0, lng: 0, derivation: "DERIVED_FROM_POLYGON" },
    };

    const context = resolveCanonicalAcquisitionGeography({ id: "project", canonicalGeography });

    expect(context?.queryPoint.lat).toBeCloseTo(21.8933333333, 8);
    expect(context?.queryPoint.lng).toBeCloseTo(-102.2933333333, 8);
    expect(context?.queryPoint).not.toEqual({ lat: 0, lng: 0 });
  });
});
