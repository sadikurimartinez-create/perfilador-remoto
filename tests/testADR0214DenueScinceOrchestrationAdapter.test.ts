import {
  adaptDenueScinceSource,
  canAdmitSourceToInstitutionalContext,
} from "../src/services/geoint/denueScinceOrchestrationAdapter";

describe("ADR-021.4D-2B DENUE / SCINCE orchestration adapter", () => {
  test("observed acquired DENUE is authoritative and eligible", () => {
    const item = adaptDenueScinceSource({ observationReference: "denue:fixture",
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
    const item = adaptDenueScinceSource({ observationReference: "denue:fixture",
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
    const item = adaptDenueScinceSource({ observationReference: "denue:fixture",
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
    const item = adaptDenueScinceSource({ observationReference: "denue:fixture",
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
    const item = adaptDenueScinceSource({ observationReference: "denue:fixture",
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
    expect(adaptDenueScinceSource({ observationReference: "denue:fixture", integrity: null })).toBeNull();
    expect(adaptDenueScinceSource({ observationReference: "denue:fixture",
      integrity: {
        sourceId: "unknown-source",
        sourceType: "OTHER",
      },
    })).toBeNull();
  });

  test("adapter creates source item, never evidence or finding", () => {
    const item = adaptDenueScinceSource({ observationReference: "denue:fixture",
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
      observationReference: "denue:fixture",
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
    expect(left?.source.descriptorId).toContain("ADR021:SOURCE:DENUE");
    expect(left?.itemId).toContain("ADR021:DENUE_OBSERVATION:");
  });
});

import { distinctInstitutionalInputs } from '../src/utils/institutionalReportInputProjection';

describe('P8 DENUE observation identity', () => {
  const integrity = { sourceId: 'inegi-denue-api', providerId: 'INEGI_DENUE', sourceType: 'DENUE',
    acquisitionMode: 'OBSERVED', acquisitionStatus: 'ACQUIRED', query: 'synthetic-query',
    sourceReference: 'canonical-denue-source', rawSourceReference: 'canonical-raw-reference' };
  const adapt = (reference: string, changes: Partial<typeof integrity> = {}) =>
    adaptDenueScinceSource({ observationReference: reference, integrity: { ...integrity, ...changes } })!;
  test('same descriptor, distinct observations survive the certified duplicate pattern', () => {
    const a = adapt('denue:unit-a', { rawSourceReference: 'raw-a' });
    const b = adapt('denue:unit-b', { rawSourceReference: 'raw-b' });
    expect(a.source.descriptorId).toBe(b.source.descriptorId);
    expect(a.itemId).not.toBe(b.itemId);
    expect(distinctInstitutionalInputs([a,b], 'sourceOrchestrationItems',
      ['ORCHESTRATION_ADAPTED_DENUE','ORCHESTRATION_ADAPTED_DENUE'])).toHaveLength(2);
  });
  test('equivalent observation rebuilds retain identity and deduplicate', () => {
    const a = adapt('denue:unit-a'), b = adapt('denue:unit-a');
    expect(a).toEqual(b);
    expect(distinctInstitutionalInputs([a,b], 'sourceOrchestrationItems')).toHaveLength(1);
  });
  test('same observation with divergent content remains fail-closed', () => {
    expect(() => distinctInstitutionalInputs([adapt('denue:unit-a'),
      adapt('denue:unit-a', { rawSourceReference: 'divergent-reference' })], 'sourceOrchestrationItems'))
      .toThrow('REPORT_INPUT_CONFLICT_DUPLICATE_IDENTITY');
  });
  test('different query keeps observation identity and changes only the query descriptor', () => {
    const a = adapt('denue:unit-a'), b = adapt('denue:unit-a', { query: 'another-query' });
    expect(a.itemId).toBe(b.itemId);
    expect(a.source.descriptorId).not.toBe(b.source.descriptorId);
    expect(() => distinctInstitutionalInputs([a,b], 'sourceOrchestrationItems'))
      .toThrow('REPORT_INPUT_CONFLICT_DUPLICATE_IDENTITY');
  });
  test.each([undefined, null, '', 'query-only', 'denue:invalid:unit'])('missing or invalid canonical identity rejects', reference => {
    expect(() => adaptDenueScinceSource({ observationReference: reference, integrity }))
      .toThrow('DENUE_OBSERVATION_IDENTITY_UNAVAILABLE');
  });
  test('source and raw references and classification remain intact', () => {
    const item = adapt('denue:unit-a');
    expect(item.source.sourceReference).toBe(integrity.sourceReference);
    expect(item.source.rawSourceReference).toBe(integrity.rawSourceReference);
    expect(item.source.authorityClassification).toBe('AUTHORITATIVE');
    expect(item.source.integrityClassification).toBe('VERIFIED');
    expect(item.eligibility).toBe('ELIGIBLE');
  });
});
