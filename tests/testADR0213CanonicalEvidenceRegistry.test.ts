import { adaptEvidence, adaptFinding, linkFindingToEvidence } from "../src/services/geoint/canonicalEvidenceRegistry";
import { StreetViewFindingService, type StreetViewFinding } from "../src/services/streetViewFindingService";
import {
  deriveTemporalComparisonCanonicalReferences,
  UniversalEvidenceComparisonToFinding,
} from "../src/services/geoint/temporalComparisonBridge";
import { GeointGovernanceStatus } from "../src/types/geointGovernance";
import type { UniversalEvidenceComparison } from "../src/types/geointTemporalComparison";

const streetFinding = (overrides: Partial<StreetViewFinding> = {}): StreetViewFinding => ({
  id: "sv-find-1",
  expedienteId: "exp-1",
  traceabilityId: "trace-sv-1",
  sourceEvidenceId: "sv-evidence-1",
  evidenciaId: "sv-evidence-1",
  captureId: "pano-1",
  categoria: "RUTA_ACCESO",
  coordenadas: { lat: 21.88, lng: -102.29 },
  estado: GeointGovernanceStatus.PENDING_REVIEW,
  ...overrides,
});

const temporalComparison = (): UniversalEvidenceComparison => ({
  comparisonId: "cmp-1",
  expedienteId: "exp-1",
  traceabilityId: "trace-cmp-1",
  sourceEvidenceId: "source-a",
  evidenceA: {
    id: "geo-a",
    expedienteId: "exp-1",
    traceabilityId: "trace-a",
    sourceEvidenceId: "source-a",
    source: "FIELD_PHOTO",
    coordinates: { lat: 21.88, lng: -102.29 },
    imageReference: "a.jpg",
    metadata: {},
    status: GeointGovernanceStatus.PENDING_REVIEW,
  },
  evidenceB: {
    id: "geo-b",
    expedienteId: "exp-1",
    traceabilityId: "trace-b",
    sourceEvidenceId: "source-b",
    source: "STREET_VIEW_HISTORICAL",
    coordinates: { lat: 21.88, lng: -102.29 },
    imageReference: "b.jpg",
    metadata: {},
    status: GeointGovernanceStatus.PENDING_REVIEW,
  },
  comparisonType: "TEMPORAL_VISUAL_DELTA",
  spatialValidation: { isCompatible: true, distanceMeters: 1 },
  temporalValidation: { isValid: true },
  createdBy: "real-user",
  createdAt: "2026-08-31T00:00:00.000Z",
  aiAnalysis: {
    observedChanges: [],
    structuralModifications: [],
    riskDiscrepancies: [],
    confidenceScore: 0.8,
    calibratedObservation: "Observed comparison",
  },
  analystValidationStatus: GeointGovernanceStatus.PENDING_REVIEW,
});

describe("ADR-021.3B canonical evidence/finding registry", () => {
  test("Street View complete native IDs produce complete refs", () => {
    const refs = StreetViewFindingService.deriveCanonicalReferences(streetFinding());
    expect(refs.evidenceRefs[0].lineageStatus).toBe("COMPLETE");
    expect(refs.findingRef?.lineageStatus).toBe("COMPLETE");
  });

  test("Street View missing optional source link remains partial", () => {
    const refs = StreetViewFindingService.deriveCanonicalReferences(streetFinding({ captureId: undefined }));
    expect(refs.evidenceRefs[0].lineageStatus).toBe("PARTIAL");
  });

  test("Street View with all source evidence IDs missing fabricates no provenance", () => {
    const finding = streetFinding({
      sourceEvidenceId: undefined,
      evidenciaId: undefined,
      captureId: undefined,
    });

    const refs = StreetViewFindingService.deriveCanonicalReferences(finding);

    expect(finding.id).toBe("sv-find-1");
    expect(finding.sourceEvidenceId).toBeUndefined();
    expect(finding.evidenciaId).toBeUndefined();
    expect(finding.captureId).toBeUndefined();

    expect(refs.evidenceRefs).toHaveLength(1);

    const evidenceRef = refs.evidenceRefs[0];

    expect(evidenceRef.lineageStatus).toBe("UNAVAILABLE");
    expect(evidenceRef.nativeEvidenceId).toBeUndefined();
    expect(evidenceRef.sourceId).toBeUndefined();
    expect(evidenceRef.traceabilityId).toBe("trace-sv-1");
    expect(evidenceRef.registryRefId).not.toContain("sv-find-1");

    expect(refs.findingRef?.nativeFindingId).toBe("sv-find-1");
    expect(refs.findingRef?.lineageStatus).not.toBe("COMPLETE");
  });

  test("temporal comparison with no source evidence fabricates no evidence identity", () => {
    const comparison = temporalComparison() as any;

    comparison.sourceEvidenceId = undefined;
    comparison.evidenceA = undefined;
    comparison.evidenceB = undefined;

    const finding = UniversalEvidenceComparisonToFinding(comparison);
    const refs = deriveTemporalComparisonCanonicalReferences(comparison);

    expect(finding.id).toBe("cmp-1");
    expect(finding.sourceEvidenceId).toBeUndefined();
    expect(finding.evidenciaId).toBeUndefined();
    expect(finding.captureId).toBeUndefined();

    expect(finding.supportingEvidenceIds).toHaveLength(0);

    expect(refs.evidenceRefs).toHaveLength(0);
    expect(refs.findingRef?.nativeFindingId).toBe("cmp-1");
    expect(refs.findingRef?.sourceFindingId).toBe("cmp-1");
    expect(refs.findingRef?.supportingEvidenceRefs).toHaveLength(0);
    expect(refs.findingRef?.lineageStatus).toBe("LEGACY_PARTIAL");
  });

  test("evidence can exist without a fabricated finding", () => {
    const evidence = adaptEvidence({ expedienteId: "exp-2", nativeEvidenceId: "ev-2", nativeType: "STREET_VIEW_EVIDENCE", sourceType: "STREET_VIEW", sourceId: "src-2" });
    expect(evidence?.nativeEvidenceId).toBe("ev-2");
    expect((evidence as any).nativeFindingId).toBeUndefined();
  });

  test("finding links one supporting evidence", () => {
    const evidence = adaptEvidence({ expedienteId: "exp-3", nativeEvidenceId: "ev-3", nativeType: "STREET_VIEW_EVIDENCE", sourceType: "STREET_VIEW", sourceId: "src-3" })!;
    const finding = adaptFinding({ expedienteId: "exp-3", nativeFindingId: "find-3", nativeType: "STREET_VIEW_FINDING", sourceType: "STREET_VIEW", supportingEvidenceRefs: [evidence] });
    expect(finding?.supportingEvidenceRefs).toHaveLength(1);
  });

  test("temporal finding links two distinct evidence refs", () => {
    const refs = deriveTemporalComparisonCanonicalReferences(temporalComparison());
    expect(refs.findingRef?.supportingEvidenceRefs).toHaveLength(2);
  });

  test("temporal legacy with one missing evidence remains partial", () => {
    const comparison = temporalComparison() as any;
    comparison.evidenceB = undefined;
    const refs = deriveTemporalComparisonCanonicalReferences(comparison);
    expect(refs.evidenceRefs).toHaveLength(1);
    expect(refs.findingRef?.lineageStatus).toBe("LEGACY_PARTIAL");
  });

  test("missing geography stays missing", () => {
    const refs = StreetViewFindingService.deriveCanonicalReferences(streetFinding());
    expect(refs.evidenceRefs[0].geographyId).toBeUndefined();
  });

  test("missing native evidence ID is not fabricated", () => {
    const evidence = adaptEvidence({ expedienteId: "exp-8", nativeType: "STREET_VIEW_EVIDENCE", sourceType: "STREET_VIEW", sourceId: "src-8", legacy: true });
    expect(evidence?.nativeEvidenceId).toBeUndefined();
    expect(evidence?.lineageStatus).toBe("LEGACY_PARTIAL");
  });

  test("missing native finding ID is not fabricated", () => {
    const finding = adaptFinding({ expedienteId: "exp-9", nativeType: "STREET_VIEW_FINDING", sourceType: "STREET_VIEW", sourceFindingId: "legacy-source-finding", legacy: true });
    expect(finding?.nativeFindingId).toBeUndefined();
    expect(finding?.lineageStatus).toBe("LEGACY_PARTIAL");
  });

  test("registry adds no confidence analyst timestamp or duplicate refs", () => {
    const evidence = adaptEvidence({ expedienteId: "exp-10", nativeEvidenceId: "ev-10", nativeType: "STREET_VIEW_EVIDENCE", sourceType: "STREET_VIEW", sourceId: "src-10" })!;
    const finding = adaptFinding({ expedienteId: "exp-10", nativeFindingId: "find-10", nativeType: "STREET_VIEW_FINDING", sourceType: "STREET_VIEW" })!;
    const linked = linkFindingToEvidence(finding, [evidence, evidence]);
    expect(linked.supportingEvidenceRefs).toHaveLength(1);
    expect((linked as any).confidence).toBeUndefined();
    expect((linked as any).analyst).toBeUndefined();
    expect((linked as any).timestamp).toBeUndefined();
  });
});
