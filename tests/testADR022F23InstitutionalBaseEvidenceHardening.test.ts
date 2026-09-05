import { normalizeInstitutionalBaseEvidence } from "../src/utils/institutionalBaseEvidenceNormalizer";
import { isInstitutionalEvidenceTraceable } from "../src/utils/institutionalEvidenceTraceabilityGuard";
import type { GeoEvidence } from "../src/types/geointEvidence";
import { GeointGovernanceStatus } from "../src/types/geointGovernance";

describe("ADR-022 FASE 2.3 - Institutional base evidence hardening", () => {
  test("accepts complete institutional photo evidence", () => {
    const result = normalizeInstitutionalBaseEvidence({
      id: "photo-1",
      evidenceId: "photo-1",
      sourceEvidenceId: "photo-1",
      expedienteId: "exp-1",
      geographyId: "geo-1",
      geographyType: "INDIVIDUAL",
      lat: 21.885,
      lng: -102.291,
    });

    expect(result.evidenceClass).toBe("INSTITUTIONAL_EVIDENCE");
    expect(result.traceability.eligible).toBe(true);
    expect(result.fields.traceabilityId).toBeTruthy();
    expect(result.fields.lineageStatus).toBe("SUPPORTED");
    expect(result.fields.coordinates).toEqual({ lat: 21.885, lng: -102.291 });
  });

  test("classifies photo without geographyId as contextual", () => {
    const result = normalizeInstitutionalBaseEvidence({
      id: "photo-2",
      sourceEvidenceId: "photo-2",
      expedienteId: "exp-1",
      lat: 21.885,
      lng: -102.291,
    });

    expect(result.evidenceClass).toBe("CONTEXTUAL_EVIDENCE");
    expect(result.traceability.eligible).toBe(false);
    expect(result.traceability.missingFields).toContain("geographyId");
  });

  test("classifies photo without sourceEvidenceId as contextual", () => {
    const result = normalizeInstitutionalBaseEvidence({
      expedienteId: "exp-1",
      geographyId: "geo-1",
      lat: 21.885,
      lng: -102.291,
    });

    expect(result.evidenceClass).toBe("CONTEXTUAL_EVIDENCE");
    expect(result.traceability.eligible).toBe(false);
    expect(result.traceability.missingFields).toContain("sourceEvidenceId");
  });

  test("preserves legacy contextual evidence compatibility", () => {
    const result = normalizeInstitutionalBaseEvidence({
      id: "legacy-photo",
      projectId: "exp-legacy",
      lat: 21.885,
      lng: -102.291,
      legacy: true,
      lineageStatus: "LEGACY_UNCLASSIFIED",
    });

    expect(result.evidenceClass).toBe("CONTEXTUAL_EVIDENCE");
    expect(result.fields.expedienteId).toBe("exp-legacy");
    expect(result.fields.lineageStatus).toBe("LEGACY_UNCLASSIFIED");
  });

  test("accepts valid GeoEvidence with geographyId", () => {
    const evidence: GeoEvidence = {
      id: "geo-evidence-1",
      expedienteId: "exp-1",
      traceabilityId: "trace-geo-1",
      sourceEvidenceId: "source-geo-1",
      geographyId: "geo-1",
      source: "FIELD_PHOTO",
      coordinates: { lat: 21.885, lng: -102.291 },
      imageReference: "gs://project/photo.jpg",
      metadata: {},
      status: GeointGovernanceStatus.APPROVED_EVIDENCE,
      lineageStatus: "SUPPORTED",
    };

    expect(isInstitutionalEvidenceTraceable(evidence)).toBe(true);
  });
});
