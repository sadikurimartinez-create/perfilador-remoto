import {
  executeCifaBatch,
  executeCifaSource,
  type CifaSourceDefinition,
} from "../src/utils/cifaAcquisition";
import { ExternalProviderError } from "../src/utils/externalProviderError";

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
});
