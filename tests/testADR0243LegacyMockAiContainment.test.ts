import fs from "node:fs";
import path from "node:path";
import { evaluateIntelligenceEligibility } from "../src/utils/syntheticIntelligenceFirewall";
import { runUnifiedCifaScan } from "../src/utils/cifaEngine";
import { ADVANCED_FUSION_LEGACY_DIAGNOSTIC_METADATA } from "../src/utils/advancedFusion";
import { LEGACY_OSINT_ROUTE_METADATA } from "../src/lib/route";

jest.mock("../src/utils/imfoService", () => ({
  logLearningAction: jest.fn().mockResolvedValue(undefined),
  autoDiscoverSource: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/lib/providers/orchestrator", () => ({
  ApiOrchestrator: jest.fn().mockImplementation(() => ({ getProviders: () => [] })),
}));

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("ADR-024.3 - CIFA productive migration and legacy containment", () => {
  test("historical CIFA mock artifacts remain ineligible", () => {
    const eligibility = evaluateIntelligenceEligibility({
      epistemicIntegrity: {
        acquisitionMode: "MOCK",
        acquisitionStatus: "ACQUIRED",
        semanticRole: "DIAGNOSTIC",
        validationStatus: "PENDING_REVIEW",
        isSimulated: true,
        providerId: "CIFA_MOCK_REDDIT",
        sourceId: "cifa-legacy-mock",
        sourceType: "LEGACY_MOCK_DIAGNOSTIC",
      },
    });

    expect(eligibility.eligibleForApproval).toBe(false);
    expect(eligibility.eligibleForReport).toBe(false);
    expect(eligibility.blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:MOCK");
  });

  test("Facebook, Instagram and territorial grouping do not generate fictional records", async () => {
    const result = await runUnifiedCifaScan(
      { id: "EXP-CIFA", locationName: "Aguascalientes", latitude: 21.8818, longitude: -102.2916 },
      ["facebook_public", "instagram_public", "osint_territorial"]
    );

    expect(result.sourceResults).toHaveLength(3);
    expect(result.sourceResults.every((source) => source.acquisitionStatus === "NOT_CONFIGURED")).toBe(true);
    expect(result.sourceResults.every((source) => source.resultCount === 0 && source.isSimulated === false)).toBe(true);
    expect(result.institutionalUse).toBe("NOT_CONFIGURED");
    expect(JSON.stringify(result)).not.toContain("CIFA_MOCK_");
    expect(JSON.stringify(result)).not.toContain("Policía Estatal");
    expect(JSON.stringify(result)).not.toContain("Facebook Grupo Público");
    expect(JSON.stringify(result)).not.toContain("Instagram Geotag");
  });

  test("productive CIFA source no longer contains mock generators or artificial coverage", () => {
    const source = readSource("src/utils/cifaEngine.ts");
    const redditProvider = readSource("src/lib/providers/redditProvider.ts");
    for (const identifier of [
      "getMockTelegram",
      "getMockX",
      "getMockReddit",
      "getMockYouTube",
      "getMockRSS",
      "getMockDrive",
      "getMockDENUE",
      "50 +",
      "BLOCKED_LEGACY_MOCK_DIAGNOSTIC",
    ]) {
      expect(source).not.toContain(identifier);
    }
    expect(source).toContain("getDenueData");
    expect(source).toContain("territorialCoverage: null");
    expect(redditProvider).not.toContain("Búsqueda simulada");
  });

  test("advancedFusion and legacy route protections remain active", () => {
    const advancedEligibility = evaluateIntelligenceEligibility({ epistemicIntegrity: ADVANCED_FUSION_LEGACY_DIAGNOSTIC_METADATA });
    const routeEligibility = evaluateIntelligenceEligibility({ epistemicIntegrity: LEGACY_OSINT_ROUTE_METADATA });

    expect(advancedEligibility.eligibleForReport).toBe(false);
    expect(routeEligibility.eligibleForApproval).toBe(false);
    expect(readSource("src/lib/route.ts")).toContain("BLOCKED_LEGACY_DIAGNOSTIC_NO_LINEAGE");
  });

  test("CIFA panel consumes per-source statuses and productive provenance", () => {
    const source = readSource("src/components/CifaCeipolPanel.tsx");

    expect(source).toContain("results.sourceResults.map");
    expect(source).toContain("source.acquisitionStatus");
    expect(source).toContain("Anexar con Provenance");
    expect(source).toContain("sourcesObserved");
    expect(source).not.toContain("SIMULADO / NO INSTITUCIONAL");
    expect(source).not.toContain("Mantener Diagnóstico");
  });
});
