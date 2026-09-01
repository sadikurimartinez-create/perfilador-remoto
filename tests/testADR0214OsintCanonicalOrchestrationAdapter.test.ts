import fs from "fs";
import path from "path";
import { adaptOsintSource } from "../src/services/geoint/osintCanonicalOrchestrationAdapter";

const geminiTelegram = (acquisitionStatus: "ACQUIRED" | "FAILED" = "ACQUIRED") => ({
  sourceId: "telegram-gemini-osint-synthesis",
  providerId: "GEMINI",
  providerName: "Google Vertex AI Gemini",
  sourceType: "TELEGRAM_CONTEXT",
  acquisitionMode: "AI_GENERATED" as const,
  acquisitionStatus,
  semanticRole: "SYNTHESIS" as const,
  sourceReference: "src/lib/osintActions.ts:getTelegramOsintData",
  rawSourceReference: "gemini:generateContent:telegram-context-synthesis",
  query: "contexto",
});

describe("ADR-021.4D-3B canonical OSINT adapter", () => {
  test("Gemini Telegram synthesis remains non-authoritative, derived and limited", () => {
    const item = adaptOsintSource({ integrity: geminiTelegram() });

    expect(item?.source.authorityClassification).toBe("NON_AUTHORITATIVE");
    expect(item?.source.integrityClassification).toBe("READY_WITH_LIMITATIONS");
    expect(item?.dependencyClassification).toBe("DERIVED");
    expect(item?.eligibility).toBe("LIMITED");
    expect(item?.dependencyClassification).not.toBe("INDEPENDENT");
  });

  test("ACQUIRED status cannot promote Gemini Telegram synthesis", () => {
    const item = adaptOsintSource({ integrity: geminiTelegram("ACQUIRED") });

    expect(item?.source.authorityClassification).not.toBe("AUTHORITATIVE");
    expect(item?.source.integrityClassification).not.toBe("VERIFIED");
    expect(item?.eligibility).not.toBe("ELIGIBLE");
  });

  test("Telegram direct observation remains legacy with unknown dependency", () => {
    const item = adaptOsintSource({ integrity: {
      sourceId: "telegram-bot-route",
      providerId: "telegram",
      sourceType: "TELEGRAM_DIRECT_OBSERVATION",
      acquisitionMode: "LEGACY",
      acquisitionStatus: "ACQUIRED",
    } });

    expect(item?.source.authorityClassification).toBe("LEGACY_UNCLASSIFIED");
    expect(item?.dependencyClassification).toBe("UNKNOWN_DEPENDENCY");
    expect(item?.eligibility).toBe("LIMITED");
  });

  test.each([
    ["facebook", "FACEBOOK_CONNECTIVITY"],
    ["instagram", "INSTAGRAM_CONNECTIVITY"],
  ])("%s connectivity is ineligible", (providerId, sourceType) => {
    const item = adaptOsintSource({ integrity: {
      sourceId: `${providerId}-connectivity`,
      providerId,
      sourceType,
      acquisitionMode: "CONNECTIVITY_ONLY",
      acquisitionStatus: "ACQUIRED",
      semanticRole: "DIAGNOSTIC",
      isConnectivityOnly: true,
    } });

    expect(item?.source.authorityClassification).toBe("NON_AUTHORITATIVE");
    expect(item?.eligibility).toBe("INELIGIBLE");
  });

  test("missing integrity returns null and unknown provenance is not promoted", () => {
    expect(adaptOsintSource({ integrity: null })).toBeNull();
    const unknown = adaptOsintSource({ integrity: {
      sourceId: "unknown-source",
      sourceType: "UNKNOWN_OSINT",
      acquisitionMode: "UNKNOWN",
    } });

    expect(unknown?.source.authorityClassification).toBe("UNKNOWN");
    expect(unknown?.dependencyClassification).toBe("UNKNOWN_DEPENDENCY");
    expect(unknown?.eligibility).not.toBe("ELIGIBLE");
  });

  test("adapter creates neither evidence nor finding", () => {
    const item = adaptOsintSource({ integrity: geminiTelegram() });
    expect(item?.evidenceRef).toBeUndefined();
    expect(item?.findingRef).toBeUndefined();
  });

  test("technical ID is deterministic and does not use runtime time or randomness", () => {
    const left = adaptOsintSource({ integrity: geminiTelegram() });
    const right = adaptOsintSource({ integrity: geminiTelegram() });
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/services/geoint/osintCanonicalOrchestrationAdapter.ts"),
      "utf8"
    );

    expect(left?.itemId).toBe(right?.itemId);
    expect(left?.itemId).toContain("ADR021:OSINT:TELEGRAM_CONTEXT");
    expect(source).not.toMatch(/Date\.now|Math\.random|new Date/);
  });
});
