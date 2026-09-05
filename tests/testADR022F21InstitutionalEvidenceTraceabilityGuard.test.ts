import {
  isInstitutionalEvidenceTraceable,
  validateInstitutionalEvidenceTraceability,
} from "../src/utils/institutionalEvidenceTraceabilityGuard";

describe("ADR-022 FASE 2.1 - Institutional Evidence Traceability Guard", () => {
  const completeEvidence = {
    traceabilityId: "trace-001",
    sourceEvidenceId: "photo-001",
    geographyId: "geo-001",
    expedienteId: "project-001",
    lineageStatus: "SUPPORTED",
    coordinates: { lat: 21.885, lng: -102.291 },
  };

  test("accepts complete institutional evidence", () => {
    const result = validateInstitutionalEvidenceTraceability(completeEvidence);

    expect(result.eligible).toBe(true);
    expect(result.status).toBe("INSTITUTIONAL_ELIGIBLE");
    expect(result.reasons).toEqual([]);
    expect(isInstitutionalEvidenceTraceable(completeEvidence)).toBe(true);
  });

  test("rejects evidence without geographyId", () => {
    const result = validateInstitutionalEvidenceTraceability({
      ...completeEvidence,
      geographyId: null,
    });

    expect(result.eligible).toBe(false);
    expect(result.missingFields).toContain("geographyId");
    expect(result.reasons).toContain("missing geographyId");
  });

  test("rejects evidence without sourceEvidenceId", () => {
    const result = validateInstitutionalEvidenceTraceability({
      ...completeEvidence,
      sourceEvidenceId: "",
    });

    expect(result.eligible).toBe(false);
    expect(result.missingFields).toContain("sourceEvidenceId");
    expect(result.reasons).toContain("missing sourceEvidenceId");
  });

  test("keeps legacy contextual evidence out of institutional certification", () => {
    const result = validateInstitutionalEvidenceTraceability({
      id: "legacy-photo",
      projectId: "project-001",
      lat: 21.885,
      lng: -102.291,
      legacy: true,
      lineageStatus: "LEGACY_UNCLASSIFIED",
    });

    expect(result.eligible).toBe(false);
    expect(result.status).toBe("CONTEXTUAL_ONLY");
    expect(result.reasons).toContain("contextual evidence cannot be certified as institutional evidence");
  });

  test("rejects evidence with invalid coordinates", () => {
    const result = validateInstitutionalEvidenceTraceability({
      ...completeEvidence,
      coordinates: { lat: 120, lng: -102.291 },
    });

    expect(result.eligible).toBe(false);
    expect(result.invalidFields).toContain("coordinates");
    expect(result.reasons).toContain("invalid coordinates");
  });

  test("accepts valid Street View evidence using projectId and coordenadas aliases", () => {
    const result = validateInstitutionalEvidenceTraceability({
      traceabilityId: "trace-sv-001",
      sourceEvidenceId: "sv-source-001",
      geographyId: "geo-001",
      projectId: "project-001",
      lineageStatus: "SUPPORTED",
      coordenadas: { lat: "21.886", lng: "-102.292" },
      evidenceOrigin: "REMOTE",
      evidenceCategoryClass: "REMOTE_VISUAL",
      sourceType: "STREET_VIEW",
    });

    expect(result.eligible).toBe(true);
    expect(result.normalized.expedienteId).toBe("project-001");
    expect(result.normalized.coordinates).toEqual({ lat: 21.886, lng: -102.292 });
  });
});
