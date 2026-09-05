import fs from "node:fs";
import path from "node:path";
import { canPromoteToFinding, createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import { assessReportReadiness } from "../src/utils/reportReadyGovernance";
import {
  evaluateIntelligenceEligibility,
  filterInstitutionalAnalysisEligibleIntelligence,
  isReportEligibleIntelligence,
} from "../src/utils/syntheticIntelligenceFirewall";
import { MultiSourceCorrelationEngine, type InstitutionalCorrelationItem } from "../src/lib/geoint/multiSourceCorrelationEngine";
import { runUnifiedCifaScan } from "../src/utils/cifaEngine";
import { ADVANCED_FUSION_LEGACY_DIAGNOSTIC_METADATA } from "../src/utils/advancedFusion";
import { LEGACY_OSINT_ROUTE_METADATA } from "../src/lib/route";

jest.mock("../src/utils/imfoService", () => ({
  logLearningAction: jest.fn().mockResolvedValue(undefined),
  autoDiscoverSource: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/lib/providers/orchestrator", () => ({
  ApiOrchestrator: jest.fn().mockImplementation(() => ({
    getProviders: () => [],
  })),
}));

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function institutionalCandidateFromCifa(item: any): InstitutionalCorrelationItem {
  return {
    id: item.id || "cifa-mock-item",
    sourceType: item.sourceType || "DENUE",
    providerId: item.providerId,
    sourceEvidenceId: item.id || "cifa-source",
    traceabilityId: item.epistemicIntegrity?.traceabilityId || "trace-cifa",
    expedienteId: "exp-cifa",
    geographyId: "geo-cifa",
    coordinates: { lat: 21.8818, lng: -102.2916 },
    semanticRole: item.semanticRole,
    category: "RUTA_ACCESO",
    payload: { assertion: "PRESENT" },
    epistemicIntegrity: item.epistemicIntegrity,
  };
}

describe("ADR-024.3 - Legacy/mock AI containment", () => {
  test("TEST 1 CIFA mock is not eligible for institutional analysis", async () => {
    const result = await runUnifiedCifaScan(
      { id: "EXP-CIFA", locationName: "Aguascalientes", latitude: 21.8818, longitude: -102.2916 },
      ["apis_gubernamentales"]
    );
    const mockDenue = result.rawResults.denue[0];
    const eligibility = evaluateIntelligenceEligibility(mockDenue);

    expect(mockDenue.epistemicIntegrity.acquisitionMode).toBe("MOCK");
    expect(mockDenue.epistemicIntegrity.semanticRole).toBe("DIAGNOSTIC");
    expect(mockDenue.epistemicIntegrity.isSimulated).toBe(true);
    expect(filterInstitutionalAnalysisEligibleIntelligence([mockDenue])).toHaveLength(0);
    expect(eligibility.blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:MOCK");
  });

  test("TEST 2 CIFA mock cannot enter institutional correlation", async () => {
    const result = await runUnifiedCifaScan(
      { id: "EXP-CIFA", locationName: "Aguascalientes", latitude: 21.8818, longitude: -102.2916 },
      ["apis_gubernamentales"]
    );
    const cifaItem = institutionalCandidateFromCifa(result.rawResults.denue[0]);
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [cifaItem]);

    expect(report.eligibleItemCount).toBe(0);
    expect(report.excludedItems[0].reasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:MOCK");
  });

  test("TEST 3 CIFA mock cannot be promoted to finding", async () => {
    const result = await runUnifiedCifaScan(
      { id: "EXP-CIFA", locationName: "Aguascalientes", latitude: 21.8818, longitude: -102.2916 },
      ["google_maps"]
    );
    const mockPlace = result.rawResults.googlePlaces[0];
    expect(evaluateIntelligenceEligibility(mockPlace).eligibleForApproval).toBe(false);
    expect(canPromoteToFinding(createAiAnalyticalOutput({ outputType: "ANALYSIS", sourceReferences: ["cifa"] }))).toBe(false);
  });

  test("TEST 4 CIFA mock cannot make a project report-ready as authoritative source", async () => {
    const result = await runUnifiedCifaScan(
      { id: "EXP-CIFA", locationName: "Aguascalientes", latitude: 21.8818, longitude: -102.2916 },
      ["apis_gubernamentales"]
    );
    const assessment = assessReportReadiness({
      id: "EXP-CIFA",
      canonicalGeography: { geographyId: "geo-cifa", validationStatus: "VALID" },
      hypothesis: { text: "Hipotesis humana formulada.", status: "FORMULATED" },
      evidence: [{ id: "ev-real", humanValidationStatus: "APPROVED" }],
      analysisOutputs: [{ outputId: "analysis-1", acquisitionMode: "AI_GENERATED", humanValidationStatus: "APPROVED", lineageStatus: "SUPPORTED" }],
      sources: [{ ...result.rawResults.denue[0], usedAsAuthoritative: true }],
    });

    expect(assessment.readyForInstitutionalReport).toBe(false);
    expect(assessment.blockingReasons.map((reason) => reason.code)).toContain("UNTRUSTED_SOURCE_USED_AS_AUTHORITATIVE");
  });

  test("TEST 5 item-level metadata identifies CIFA simulation", async () => {
    const result = await runUnifiedCifaScan(
      { id: "EXP-CIFA", locationName: "Aguascalientes", latitude: 21.8818, longitude: -102.2916 },
      ["telegram", "reddit"]
    );
    const items = [...result.rawResults.telegram, ...result.rawResults.reddit];

    expect(items.every((item: any) => item.acquisitionMode === "MOCK")).toBe(true);
    expect(items.every((item: any) => item.isSimulated === true)).toBe(true);
    expect(items.every((item: any) => item.validationStatus === "PENDING_REVIEW")).toBe(true);
    expect(items.every((item: any) => item.epistemicIntegrity?.providerId?.startsWith("CIFA_MOCK_"))).toBe(true);
  });

  test("TEST 6 nominal DENUE from CIFA mock is not confused with canonical real DENUE", async () => {
    const result = await runUnifiedCifaScan(
      { id: "EXP-CIFA", locationName: "Aguascalientes", latitude: 21.8818, longitude: -102.2916 },
      ["apis_gubernamentales"]
    );
    const mockDenue = result.rawResults.denue[0];

    expect(mockDenue.providerId).not.toBe("INEGI_DENUE");
    expect(mockDenue.epistemicIntegrity.providerId).not.toBe("INEGI_DENUE");
    expect(mockDenue.epistemicIntegrity.acquisitionMode).toBe("MOCK");
  });

  test("TEST 7 nominal Google Places from CIFA mock is not real acquisition", async () => {
    const result = await runUnifiedCifaScan(
      { id: "EXP-CIFA", locationName: "Aguascalientes", latitude: 21.8818, longitude: -102.2916 },
      ["google_maps"]
    );
    const mockPlace = result.rawResults.googlePlaces[0];

    expect(mockPlace.providerId).not.toBe("GOOGLE_PLACES");
    expect(mockPlace.epistemicIntegrity.providerName).toBe("Google Places");
    expect(isReportEligibleIntelligence(mockPlace)).toBe(false);
  });

  test("TEST 8 advancedFusion legacy is non-institutional without lineage", () => {
    const eligibility = evaluateIntelligenceEligibility({
      epistemicIntegrity: ADVANCED_FUSION_LEGACY_DIAGNOSTIC_METADATA,
    });

    expect(ADVANCED_FUSION_LEGACY_DIAGNOSTIC_METADATA.semanticRole).toBe("DIAGNOSTIC");
    expect(eligibility.eligibleForReport).toBe(false);
    expect(eligibility.blockingReasons).toContain("LEGACY_DIAGNOSTIC_NOT_INSTITUTIONAL");
  });

  test("TEST 9 src/lib/route legacy output is not institutionally approvable", () => {
    const eligibility = evaluateIntelligenceEligibility({
      epistemicIntegrity: LEGACY_OSINT_ROUTE_METADATA,
    });
    const source = readSource("src/lib/route.ts");

    expect(source).toContain("BLOCKED_LEGACY_DIAGNOSTIC_NO_LINEAGE");
    expect(eligibility.eligibleForApproval).toBe(false);
    expect(eligibility.eligibleForReport).toBe(false);
  });

  test("TEST 10 diagnostic UI remains available but cannot persist to institutional sweep", () => {
    const source = readSource("src/components/CifaCeipolPanel.tsx");

    expect(source).toContain("SIMULADO / NO INSTITUCIONAL");
    expect(source).toContain("Mantener Diagnóstico");
    expect(source).toContain("no se persiste en el expediente");
    expect(source).not.toContain("registerSweep({");
  });
});
