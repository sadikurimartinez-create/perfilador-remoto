import {
  adaptDenueScinceSource,
  canAdmitSourceToInstitutionalContext,
} from "../src/services/geoint/denueScinceOrchestrationAdapter";

describe("ADR-021.4D-2B DENUE / SCINCE orchestration adapter", () => {
  test("observed acquired DENUE is authoritative and eligible", () => {
    const item = adaptDenueScinceSource({
      expedienteId: "EXP-1",
      integrity: {
        sourceId: "inegi-denue-api",
        providerId: "INEGI_DENUE",
        providerName: "INEGI DENUE API Publica",
        sourceType: "DENUE",
        acquisitionMode: "OBSERVED",
        acquisitionStatus: "ACQUIRED",
        semanticRole: "SOURCE_FACT",
        sourceReference: "src/lib/osintActions.ts:getDenueData",
        rawSourceReference: "denue:v1:consulta:Buscar:todos",
        query: "21.88,-102.29,500",
        resultCount: 4,
      },
    });

    expect(item?.source.authorityClassification).toBe("AUTHORITATIVE");
    expect(item?.source.integrityClassification).toBe("VERIFIED");
    expect(item?.eligibility).toBe("ELIGIBLE");
    expect(item?.evidenceRef).toBeUndefined();
    expect(item?.findingRef).toBeUndefined();
  });

  test("DENUE NO_DATA is an observed query result, not confirmed absence", () => {
    const item = adaptDenueScinceSource({
      integrity: {
        sourceId: "inegi-denue-api",
        providerId: "INEGI_DENUE",
        sourceType: "DENUE",
        acquisitionMode: "OBSERVED",
        acquisitionStatus: "NO_DATA",
        semanticRole: "SOURCE_FACT",
        query: "21.88,-102.29,500",
      },
    });

    expect(item?.source.authorityClassification).toBe("AUTHORITATIVE");
    expect(item?.source.integrityClassification).toBe("VERIFIED");
    expect(item?.eligibility).toBe("ELIGIBLE");
  });

  test("DENUE not configured cannot become institutionally eligible", () => {
    const item = adaptDenueScinceSource({
      integrity: {
        sourceId: "inegi-denue-api",
        providerId: "INEGI_DENUE",
        sourceType: "DENUE",
        acquisitionMode: "OBSERVED",
        acquisitionStatus: "NOT_CONFIGURED",
        semanticRole: "SOURCE_FACT",
        query: "21.88,-102.29,500",
      },
    });

    expect(item?.source.integrityClassification).toBe("NOT_READY");
    expect(item?.eligibility).not.toBe("ELIGIBLE");
  });

  test("SCINCE local simulator is always simulated and ineligible", () => {
    const item = adaptDenueScinceSource({
      integrity: {
        sourceId: "SCINCE_LOCAL_SIMULATOR",
        providerId: "SCINCE_LOCAL_SIMULATOR",
        providerName: "SCINCE Local Simulator",
        sourceType: "SCINCE",
        acquisitionMode: "SIMULATED",
        acquisitionStatus: "ACQUIRED",
        semanticRole: "DIAGNOSTIC",
        isSimulated: true,
        rawSourceReference: "local-simulator:scince-demographic-seed",
        query: "21.88,-102.29",
      },
    });

    expect(item?.source.authorityClassification).toBe("SIMULATED");
    expect(item?.source.integrityClassification).toBe("SIMULATED");
    expect(item?.eligibility).toBe("INELIGIBLE");
    expect(canAdmitSourceToInstitutionalContext(item)).toBe(false);
  });

  test("SCINCE cannot escape simulator firewall by changing acquisition status", () => {
    const item = adaptDenueScinceSource({
      integrity: {
        sourceId: "SCINCE_LOCAL_SIMULATOR",
        providerId: "SCINCE_LOCAL_SIMULATOR",
        sourceType: "SCINCE",
        acquisitionMode: "SIMULATED",
        acquisitionStatus: "FAILED",
        isSimulated: true,
      },
    });

    expect(item?.eligibility).toBe("INELIGIBLE");
  });

  test("unknown or unsupported source is not promoted", () => {
    expect(adaptDenueScinceSource({ integrity: null })).toBeNull();
    expect(adaptDenueScinceSource({
      integrity: {
        sourceId: "unknown-source",
        sourceType: "OTHER",
      },
    })).toBeNull();
  });

  test("adapter creates source item, never evidence or finding", () => {
    const item = adaptDenueScinceSource({
      integrity: {
        sourceId: "inegi-denue-api",
        providerId: "INEGI_DENUE",
        sourceType: "DENUE",
        acquisitionMode: "OBSERVED",
        acquisitionStatus: "ACQUIRED",
        query: "q",
      },
    });

    expect(item?.evidenceRef).toBeUndefined();
    expect(item?.findingRef).toBeUndefined();
  });

  test("technical descriptor id is deterministic and contains no timestamp/randomness", () => {
    const input = {
      integrity: {
        sourceId: "inegi-denue-api",
        providerId: "INEGI_DENUE",
        sourceType: "DENUE",
        acquisitionMode: "OBSERVED",
        acquisitionStatus: "ACQUIRED",
        query: "21.88,-102.29,500",
      },
    };

    const left = adaptDenueScinceSource(input);
    const right = adaptDenueScinceSource(input);

    expect(left?.itemId).toBe(right?.itemId);
    expect(left?.itemId).toContain("ADR021:SOURCE:DENUE");
  });
});
