import {
  deduplicateStreetViewFindings,
  normalizeStreetViewFindingForPersistence,
  type StreetViewFinding,
} from "../src/services/streetViewFindingService";
import { GeointGovernanceStatus } from "../src/types/geointGovernance";

const completeFinding = (overrides: Partial<StreetViewFinding> = {}) => ({
  id: "sv-finding-1",
  expedienteId: "exp-1",
  traceabilityId: "trace-1",
  sourceEvidenceId: "source-1",
  geographyId: "geo-1",
  lineageStatus: "COMPLETE" as const,
  categoria: "RUTA_ACCESO" as const,
  coordenadas: { lat: 21.885, lng: -102.291 },
  estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
  ...overrides,
});

describe("ADR-022 FASE 2.2 - Street View finding normalization", () => {
  test("normalizes a complete StreetViewFinding", () => {
    const finding = normalizeStreetViewFindingForPersistence(completeFinding());

    expect(finding.traceabilityId).toBe("trace-1");
    expect(finding.sourceEvidenceId).toBe("source-1");
    expect(finding.geographyId).toBe("geo-1");
    expect(finding.lineageStatus).toBe("COMPLETE");
    expect(finding.coordenadas).toEqual({ lat: 21.885, lng: -102.291 });
    expect(finding.expedienteId).toBe("exp-1");
  });

  test("rejects institutional finding without geographyId", () => {
    expect(() =>
      normalizeStreetViewFindingForPersistence(completeFinding({ geographyId: null }))
    ).toThrow("STREETVIEW_FINDING_TRACEABILITY_INCOMPLETE");
  });

  test("rejects institutional finding without sourceEvidenceId", () => {
    expect(() =>
      normalizeStreetViewFindingForPersistence({
        ...completeFinding(),
        sourceEvidenceId: undefined,
        evidenciaId: undefined,
        captureId: undefined,
      })
    ).toThrow("STREETVIEW_FINDING_TRACEABILITY_INCOMPLETE");
  });

  test("preserves legacy contextual finding without institutional rejection", () => {
    const finding = normalizeStreetViewFindingForPersistence({
      id: "legacy-finding",
      expedienteId: "exp-legacy",
      traceabilityId: "trace-legacy",
      categoria: "RUTA_ACCESO",
      coordenadas: { lat: 21.885, lng: -102.291 },
      estado: GeointGovernanceStatus.PENDING_REVIEW,
      lineageStatus: "LEGACY_PARTIAL",
    });

    expect(finding.geographyId).toBeNull();
    expect(finding.sourceEvidenceId).toBeUndefined();
    expect(finding.lineageStatus).toBe("LEGACY_PARTIAL");
  });

  test("deduplicates by traceabilityId and sourceEvidenceId", () => {
    const first = normalizeStreetViewFindingForPersistence(completeFinding({ id: "a" }));
    const duplicate = normalizeStreetViewFindingForPersistence(completeFinding({ id: "b" }));
    const distinct = normalizeStreetViewFindingForPersistence(
      completeFinding({ id: "c", sourceEvidenceId: "source-2" })
    );

    const deduped = deduplicateStreetViewFindings([first, duplicate, distinct]);

    expect(deduped.map((finding) => finding.id)).toEqual(["a", "c"]);
  });
});
