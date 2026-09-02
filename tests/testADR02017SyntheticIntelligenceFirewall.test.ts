import {
  classifyLegacyCompatibility,
  evaluateIntelligenceEligibility,
} from "../src/utils/syntheticIntelligenceFirewall";
import { isReportEngineEvidenceEligible } from "../src/lib/reportEngine";
import { runOSINTScan } from "../src/utils/osintEngine";

describe("ADR-020.17 FASE 1: Synthetic Intelligence Firewall", () => {
  test("TEST-01 OBSERVED + APPROVED es elegible para Report", () => {
    const result = evaluateIntelligenceEligibility({
      epistemicIntegrity: {
        acquisitionMode: "OBSERVED",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "APPROVED",
        semanticRole: "SOURCE_FACT",
        observedAt: "2026-08-28T00:00:00.000Z",
        sourceReference: "FIELD_PHOTO",
        traceabilityId: "trace-real-approved",
      },
    });

    expect(result.eligibleForReport).toBe(true);
  });

  test("TEST-02 SIMULATED + APPROVED no es elegible para Report", () => {
    const result = evaluateIntelligenceEligibility({
      epistemicIntegrity: {
        acquisitionMode: "SIMULATED",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "APPROVED",
        semanticRole: "SOURCE_FACT",
        isSimulated: true,
      },
    });

    expect(result.eligibleForReport).toBe(false);
    expect(result.blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:SIMULATED");
  });

  test("TEST-03 MOCK no es elegible para Report", () => {
    const result = evaluateIntelligenceEligibility({
      epistemicIntegrity: {
        acquisitionMode: "MOCK",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "APPROVED",
      },
    });

    expect(result.eligibleForReport).toBe(false);
  });

  test("TEST-04 CONNECTIVITY_ONLY no es elegible para Report", () => {
    const result = evaluateIntelligenceEligibility({
      epistemicIntegrity: {
        acquisitionMode: "CONNECTIVITY_ONLY",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "APPROVED",
        isConnectivityOnly: true,
      },
    });

    expect(result.eligibleForReport).toBe(false);
  });

  test("TEST-05 AI_GENERATED + PENDING_REVIEW puede ir a revision humana pero no a Report", () => {
    const result = evaluateIntelligenceEligibility({
      epistemicIntegrity: {
        acquisitionMode: "AI_GENERATED",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "PENDING_REVIEW",
        semanticRole: "ANALYTICAL_SUGGESTION",
      },
    });

    expect(result.eligibleForHumanReview).toBe(true);
    expect(result.eligibleForReport).toBe(false);
  });

  test("TEST-06 DERIVED + APPROVED + lineage real puede ser reportable", () => {
    const result = evaluateIntelligenceEligibility({
      epistemicIntegrity: {
        acquisitionMode: "DERIVED",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "APPROVED",
        semanticRole: "INFERENCE",
        isDerived: true,
        lineage: [
          {
            sourceId: "field-photo-1",
            providerId: "CEIPOL_FIELD",
            sourceType: "FIELD_PHOTO",
            acquisitionMode: "OBSERVED",
            traceabilityId: "trace-field-photo-1",
          },
        ],
      },
    });

    expect(result.eligibleForReport).toBe(true);
  });

  test("TEST-07 LEGACY_UNCLASSIFIED no se convierte automaticamente en evidencia nueva aprobada", () => {
    const unclassified = evaluateIntelligenceEligibility({ id: "without-status-or-contract" } as any);
    const newUnclassified = isReportEngineEvidenceEligible({
      id: "new-without-contract",
      createdAt: "2026-08-28T00:00:00.000Z",
    });

    expect(unclassified.eligibleForReport).toBe(false);
    expect(unclassified.normalizedMetadata.acquisitionMode).toBe("UNKNOWN");
    expect(newUnclassified).toBe(false);
  });

  test("TEST-08 productor OSINT sintetico queda etiquetado como MOCK", async () => {
    const result = await runOSINTScan({
      id: "EXP-02017",
      locationName: "Aguascalientes",
      latitude: 21.8818,
      longitude: -102.2915,
    });

    expect(result.epistemicIntegrity.acquisitionMode).toBe("MOCK");
    expect(result.epistemicIntegrity.isSimulated).toBe(true);
    expect(result.epistemicIntegrity.geolocationSource).toBe("SYNTHETIC_POINT");
  });

  test("TEST-09 resultado OSINT sintetico es bloqueado para Report", async () => {
    const result = await runOSINTScan({ locationName: "Aguascalientes" });
    const eligibility = evaluateIntelligenceEligibility(result);

    expect(eligibility.eligibleForReport).toBe(false);
    expect(isReportEngineEvidenceEligible(result)).toBe(false);
  });

  test("TEST-10 evidencia real aprobada existente atraviesa frontera Report Engine", () => {
    const approved = isReportEngineEvidenceEligible({
      id: "real-approved-evidence",
      status: "APPROVED_EVIDENCE",
      epistemicIntegrity: {
        acquisitionMode: "OBSERVED",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "APPROVED",
        semanticRole: "SOURCE_FACT",
        sourceReference: "CEIPOL_FIELD",
        traceabilityId: "trace-existing-approved",
      },
    });

    expect(approved).toBe(true);
  });

  test("TEST-A objeto nuevo sin metadata epistémica y sin timestamps no parece legacy", () => {
    const item = { id: "new-object-without-provenance" } as any;

    expect(evaluateIntelligenceEligibility(item).eligibleForReport).toBe(false);
    expect(evaluateIntelligenceEligibility(item).normalizedMetadata.acquisitionMode).toBe("UNKNOWN");
    expect(classifyLegacyCompatibility(item).compatibleForReport).toBe(false);
    expect(isReportEngineEvidenceEligible(item)).toBe(false);
  });

  test("TEST-B objeto histórico con timestamp no se clasifica como nuevo solo por timestamp", () => {
    const historical = {
      id: "historical-approved-with-created-at",
      status: "APROBADO",
      createdAt: "2024-01-10T00:00:00.000Z",
    } as any;
    const legacy = classifyLegacyCompatibility(historical);

    expect(legacy.classification).toBe("LEGACY_APPROVED_STATUS");
    expect(legacy.compatibleForReport).toBe(true);
    expect(isReportEngineEvidenceEligible(historical)).toBe(true);
  });

  test("TEST-C evidencia legacy reconocida por politica explicita mantiene compatibilidad controlada", () => {
    const legacy = classifyLegacyCompatibility({
      id: "legacy-approved-evidence",
      estado_revision: "APROBADO",
    } as any);

    expect(legacy.compatibleForReport).toBe(true);
    expect(legacy.warnings).toContain("LEGACY_STATUS_COMPATIBILITY_WITHOUT_CANONICAL_EPISTEMIC_METADATA");
  });

  test("TEST-D OBSERVED + APPROVED con metadata canonica sigue siendo reportable", () => {
    expect(
      isReportEngineEvidenceEligible({
        id: "canonical-observed-approved",
        epistemicIntegrity: {
          acquisitionMode: "OBSERVED",
          acquisitionStatus: "ACQUIRED",
          validationStatus: "APPROVED",
          semanticRole: "SOURCE_FACT",
          traceabilityId: "trace-canonical-observed-approved",
        },
      })
    ).toBe(true);
  });

  test("TEST-E MOCK/SIMULATED continuan bloqueados sin excepcion legacy", () => {
    const mockWithLegacyApproved = isReportEngineEvidenceEligible({
      id: "mock-with-approved-status",
      status: "APROBADO",
      epistemicIntegrity: {
        acquisitionMode: "MOCK",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "APPROVED",
        isSimulated: true,
      },
    });
    const simulatedWithLegacyApproved = isReportEngineEvidenceEligible({
      id: "simulated-with-approved-status",
      status: "APPROVED_EVIDENCE",
      epistemicIntegrity: {
        acquisitionMode: "SIMULATED",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "APPROVED",
        isSimulated: true,
      },
    });

    expect(mockWithLegacyApproved).toBe(false);
    expect(simulatedWithLegacyApproved).toBe(false);
  });
});
