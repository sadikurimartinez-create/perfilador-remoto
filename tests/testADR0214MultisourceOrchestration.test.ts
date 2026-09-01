import {
  buildMultisourceOrchestrationEnvelope,
  classifySourceDependency,
  evaluateSourceEligibility,
} from "../src/services/geoint/multisourceOrchestrationService";
import type { MultisourceOrchestrationItem, MultisourceSourceDescriptor } from "../src/types/multisourceOrchestration";

function source(overrides: Partial<MultisourceSourceDescriptor> = {}): MultisourceSourceDescriptor {
  return {
    descriptorId: "src-1",
    sourceType: "TEST",
    providerId: "PROVIDER-A",
    sourceId: "source-a",
    sourceReference: "ref-a",
    rawSourceReference: "raw-a",
    authorityClassification: "AUTHORITATIVE",
    integrityClassification: "VERIFIED",
    ...overrides,
  };
}

function item(id: string, src: MultisourceSourceDescriptor): MultisourceOrchestrationItem {
  return { itemId: id, source: src, eligibility: evaluateSourceEligibility(src) };
}

describe("ADR-021.4 multisource orchestration", () => {
  test("authoritative verified source is institutionally eligible", () => {
    expect(evaluateSourceEligibility(source())).toBe("ELIGIBLE");
  });

  test("SCINCE local simulator cannot become institutional corroboration", () => {
    expect(evaluateSourceEligibility(source({
      sourceId: "SCINCE_LOCAL_SIMULATOR",
      providerId: "SCINCE_LOCAL_SIMULATOR",
      rawSourceReference: "local-simulator:scince-demographic-seed",
    }))).toBe("INELIGIBLE");
  });

  test("non-authoritative source is ineligible", () => {
    expect(evaluateSourceEligibility(source({ authorityClassification: "NON_AUTHORITATIVE" }))).toBe("INELIGIBLE");
  });

  test("legacy unclassified source is limited, never fully eligible", () => {
    expect(evaluateSourceEligibility(source({ authorityClassification: "LEGACY_UNCLASSIFIED" }))).toBe("LIMITED");
  });

  test("same capture is not independent", () => {
    const left = item("a", source({ descriptorId: "a", captureId: "capture-1" }));
    const right = item("b", source({ descriptorId: "b", providerId: "PROVIDER-B", sourceId: "source-b", sourceReference: "ref-b", rawSourceReference: "raw-b", captureId: "capture-1" }));
    expect(classifySourceDependency(left, right)).toBe("SAME_CAPTURE");
  });

  test("same operation is not independent", () => {
    const left = item("a", source({ descriptorId: "a", operationId: "op-1" }));
    const right = item("b", source({ descriptorId: "b", providerId: "PROVIDER-B", sourceId: "source-b", sourceReference: "ref-b", rawSourceReference: "raw-b", operationId: "op-1" }));
    expect(classifySourceDependency(left, right)).toBe("SAME_OPERATION");
  });

  test("same raw origin is not independent", () => {
    const left = item("a", source({ descriptorId: "a" }));
    const right = item("b", source({ descriptorId: "b", providerId: "PROVIDER-B", sourceId: "source-b" }));
    expect(classifySourceDependency(left, right)).toBe("SAME_ORIGIN");
  });

  test("same provider is not independent", () => {
    const left = item("a", source({ descriptorId: "a" }));
    const right = item("b", source({ descriptorId: "b", sourceId: "source-b", sourceReference: "ref-b", rawSourceReference: "raw-b" }));
    expect(classifySourceDependency(left, right)).toBe("SAME_PROVIDER");
  });

  test("missing dependency evidence remains unknown, not independent", () => {
    const left = item("a", source({ descriptorId: "a", providerId: undefined, rawSourceReference: undefined, sourceReference: undefined }));
    const right = item("b", source({ descriptorId: "b", providerId: undefined, sourceId: "source-b", rawSourceReference: undefined, sourceReference: undefined }));
    expect(classifySourceDependency(left, right)).toBe("UNKNOWN_DEPENDENCY");
  });

  test("different grounded provider and origins may be independent", () => {
    const left = item("a", source({ descriptorId: "a" }));
    const right = item("b", source({ descriptorId: "b", providerId: "PROVIDER-B", sourceId: "source-b", sourceReference: "ref-b", rawSourceReference: "raw-b" }));
    expect(classifySourceDependency(left, right)).toBe("INDEPENDENT");
  });

  test("two results from same provider count as one independent eligible source group", () => {
    const envelope = buildMultisourceOrchestrationEnvelope("EXP-1", [
      { itemId: "a", source: source({ descriptorId: "a", sourceId: "a", sourceReference: "ref-a", rawSourceReference: "raw-a" }) },
      { itemId: "b", source: source({ descriptorId: "b", sourceId: "b", sourceReference: "ref-b", rawSourceReference: "raw-b" }) },
    ]);
    expect(envelope.eligibleItems).toBe(2);
    expect(envelope.independentEligibleSources).toBe(1);
  });

  test("simulated source never increases independent eligible source count", () => {
    const envelope = buildMultisourceOrchestrationEnvelope("EXP-1", [
      { itemId: "real", source: source({ descriptorId: "real" }) },
      { itemId: "sim", source: source({ descriptorId: "sim", providerId: "SCINCE_LOCAL_SIMULATOR", sourceId: "SCINCE_LOCAL_SIMULATOR" }) },
    ]);
    expect(envelope.totalItems).toBe(2);
    expect(envelope.eligibleItems).toBe(1);
    expect(envelope.independentEligibleSources).toBe(1);
  });

  test("transitive dependency bridge merges previously separate groups", () => {
    const envelope = buildMultisourceOrchestrationEnvelope("EXP-1", [
      {
        itemId: "a",
        source: source({
          descriptorId: "a",
          providerId: "PROVIDER-AB",
          sourceId: "source-a",
          sourceReference: "origin-a",
          rawSourceReference: "raw-a",
        }),
      },
      {
        itemId: "b",
        source: source({
          descriptorId: "b",
          providerId: "PROVIDER-AB",
          sourceId: "source-b",
          sourceReference: "origin-b",
          rawSourceReference: "raw-b",
          operationId: "bridge-op",
        }),
      },
      {
        itemId: "c",
        source: source({
          descriptorId: "c",
          providerId: "PROVIDER-CD",
          sourceId: "source-c",
          sourceReference: "origin-c",
          rawSourceReference: "shared-cd",
          captureId: "bridge-capture",
        }),
      },
      {
        itemId: "d",
        source: source({
          descriptorId: "d",
          providerId: "PROVIDER-D",
          sourceId: "source-d",
          sourceReference: "origin-d",
          rawSourceReference: "shared-cd",
        }),
      },
      {
        itemId: "e",
        source: source({
          descriptorId: "e",
          providerId: "PROVIDER-E",
          sourceId: "source-e",
          sourceReference: "origin-e",
          rawSourceReference: "raw-e",
          operationId: "bridge-op",
          captureId: "bridge-capture",
        }),
      },
    ]);

    expect(envelope.eligibleItems).toBe(5);
    expect(envelope.independentEligibleSources).toBe(1);
    expect(envelope.corroborationGroups).toHaveLength(1);
    expect(new Set(envelope.corroborationGroups[0].itemIds)).toEqual(
      new Set(["a", "b", "c", "d", "e"])
    );
  });
});
