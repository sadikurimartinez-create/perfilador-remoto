import {
  MultiSourceCorrelationEngine,
  type InstitutionalCorrelationItem,
} from "../src/lib/geoint/multiSourceCorrelationEngine";

jest.mock("../src/lib/providers/orchestrator", () => ({
  ApiOrchestrator: jest.fn().mockImplementation(() => ({
    getProviders: () => [
      {
        getId: () => "google",
        getName: () => "Google Maps",
        isEnabled: () => true,
      },
      {
        getId: () => "inegi",
        getName: () => "INEGI",
        isEnabled: () => true,
      },
    ],
  })),
}));

const observedApproved = {
  acquisitionMode: "OBSERVED" as const,
  acquisitionStatus: "ACQUIRED" as const,
  validationStatus: "APPROVED" as const,
  semanticRole: "SOURCE_FACT" as const,
  isSimulated: false,
  isConnectivityOnly: false,
  observedAt: "2026-09-05T10:00:00.000Z",
};

function streetView(overrides: Partial<InstitutionalCorrelationItem> = {}): InstitutionalCorrelationItem {
  return {
    id: "sv-finding-1",
    sourceType: "STREET_VIEW",
    providerId: "GOOGLE_STREET_VIEW",
    sourceEvidenceId: "sv-source-1",
    traceabilityId: "trace-sv-1",
    expedienteId: "exp-1",
    geographyId: "geo-1",
    coordinates: { lat: 21.8818, lng: -102.2916 },
    observedAt: "2026-09-05T10:00:00.000Z",
    semanticRole: "SOURCE_FACT",
    category: "RUTA_ACCESO",
    payload: { assertion: "PRESENT", findingType: "RUTA_ACCESO" },
    epistemicIntegrity: {
      ...observedApproved,
      sourceType: "STREET_VIEW",
      providerId: "GOOGLE_STREET_VIEW",
      traceabilityId: "trace-sv-1",
    },
    ...overrides,
  };
}

function denue(overrides: Partial<InstitutionalCorrelationItem> = {}): InstitutionalCorrelationItem {
  return {
    id: "denue-poi-1",
    sourceType: "DENUE",
    providerId: "INEGI_DENUE",
    sourceEvidenceId: "denue:010010001234",
    traceabilityId: "trace-denue-1",
    expedienteId: "exp-1",
    geographyId: "geo-1",
    coordinates: { lat: 21.88182, lng: -102.29163 },
    acquiredAt: "2026-09-05T10:02:00.000Z",
    semanticRole: "SOURCE_FACT",
    category: "RUTA_ACCESO",
    payload: { assertion: "PRESENT", publicationRole: "TERRITORIAL_CONTEXT" },
    epistemicIntegrity: {
      acquisitionMode: "OBSERVED",
      acquisitionStatus: "ACQUIRED",
      validationStatus: "UNREVIEWED",
      semanticRole: "SOURCE_FACT",
      sourceType: "DENUE",
      providerId: "INEGI_DENUE",
      isSimulated: false,
      isConnectivityOnly: false,
      traceabilityId: "trace-denue-1",
    },
    ...overrides,
  };
}

describe("ADR-023.8 institutional multisource correlation", () => {
  test("valid Street View finding plus DENUE POI with same geographyId can correlate", () => {
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [streetView(), denue()]);

    expect(report.results).toHaveLength(1);
    expect(report.results[0].eligibleForInstitutionalAnalysis).toBe(true);
    expect(report.results[0].spatialRelation).toBe("SAME_GEOGRAPHY_WITH_DISTANCE");
    expect(report.results[0].correlationType).toBe("CORROBORATION");
  });

  test("different geographyId does not produce institutional correlation", () => {
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [
      streetView(),
      denue({ geographyId: "geo-2" }),
    ]);

    expect(report.eligibleItemCount).toBe(2);
    expect(report.results).toHaveLength(0);
  });

  test("MOCK item is excluded", () => {
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [
      streetView({
        id: "mock-1",
        epistemicIntegrity: {
          acquisitionMode: "MOCK",
          acquisitionStatus: "ACQUIRED",
          validationStatus: "APPROVED",
          semanticRole: "SOURCE_FACT",
        },
      }),
      denue(),
    ]);

    expect(report.excludedItems[0].reasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:MOCK");
    expect(report.results).toHaveLength(0);
  });

  test("SIMULATED item is excluded", () => {
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [
      streetView({
        id: "sim-1",
        epistemicIntegrity: {
          acquisitionMode: "SIMULATED",
          acquisitionStatus: "ACQUIRED",
          validationStatus: "APPROVED",
          semanticRole: "SOURCE_FACT",
          isSimulated: true,
        },
      }),
      denue(),
    ]);

    expect(report.excludedItems[0].reasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:SIMULATED");
    expect(report.excludedItems[0].reasons).toContain("SIMULATED_CONTENT_NOT_REPORTABLE");
    expect(report.results).toHaveLength(0);
  });

  test("item without sourceEvidenceId is not institutionally eligible", () => {
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [
      streetView({ sourceEvidenceId: null }),
      denue(),
    ]);

    expect(report.excludedItems[0].reasons).toContain("MISSING_SOURCE_EVIDENCE_ID");
    expect(report.results).toHaveLength(0);
  });

  test("DERIVED item without lineage is blocked", () => {
    const derived = streetView({
      id: "derived-1",
      sourceType: "DERIVED_FINDING",
      providerId: "CEIPOL_DERIVED",
      lineage: [],
      epistemicIntegrity: {
        acquisitionMode: "DERIVED",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "APPROVED",
        semanticRole: "INFERENCE",
        sourceType: "DERIVED_FINDING",
        providerId: "CEIPOL_DERIVED",
        traceabilityId: "trace-derived-1",
        lineage: [],
      },
    });

    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [derived, denue()]);

    expect(report.excludedItems[0].reasons).toContain("DERIVED_REQUIRES_SOURCE_LINEAGE");
    expect(report.results).toHaveLength(0);
  });

  test("corroboration preserves supporting evidence ids", () => {
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [streetView(), denue()]);

    expect(report.results[0].supportingEvidenceIds).toEqual(["sv-source-1", "denue:010010001234"]);
    expect(report.results[0].supportingTraceabilityIds).toEqual(["trace-sv-1", "trace-denue-1"]);
  });

  test("contradiction preserves both sources", () => {
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [
      streetView({ payload: { assertion: "PRESENT", findingType: "RUTA_ACCESO" } }),
      denue({ payload: { assertion: "ABSENT", findingType: "RUTA_ACCESO" } }),
    ]);

    expect(report.results[0].correlationType).toBe("CONTRADICTION");
    expect(report.results[0].sources.map((source) => source.sourceType)).toEqual(["STREET_VIEW", "DENUE"]);
    expect(report.results[0].supportingEvidenceIds).toEqual(["sv-source-1", "denue:010010001234"]);
  });

  test("DENUE alone does not produce a criminal fact", () => {
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [denue()]);

    expect(report.results).toHaveLength(0);
    expect(report.contextOnlySourceIds).toEqual(["denue-poi-1"]);
    expect(report.criminalCoreSourceIds).toEqual([]);
  });

  test("inundation providers do not appear as criminal core sources", () => {
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("pandillas", [
      streetView(),
      streetView({
        id: "nasa-1",
        sourceType: "FLOOD_MODEL",
        providerId: "nasa",
        sourceEvidenceId: "nasa-source-1",
        traceabilityId: "trace-nasa-1",
        epistemicIntegrity: {
          ...observedApproved,
          sourceType: "FLOOD_MODEL",
          providerId: "nasa",
          traceabilityId: "trace-nasa-1",
        },
      }),
    ]);

    expect(report.excludedItems[0].providerId).toBe("nasa");
    expect(report.excludedItems[0].reasons).toContain("INUNDATION_PROVIDER_NOT_CRIMINAL_CORE");
    expect(report.criminalCoreSourceIds).toEqual(["sv-finding-1"]);
  });

  test("legacy diagnostic mode remains available with provider truthScore", () => {
    const report = MultiSourceCorrelationEngine.correlate("perfil", { query: "perfil" });

    expect(report.results.length).toBeGreaterThan(0);
    expect(report.results[0]).toHaveProperty("truthScore");
    expect(report.activeUsedProviders).toContain("google");
  });
});
