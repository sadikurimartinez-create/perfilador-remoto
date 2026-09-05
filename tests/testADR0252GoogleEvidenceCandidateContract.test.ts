import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import {
  adaptStreetViewToGoogleEvidence,
  approveGoogleCandidateFinding,
  createGoogleCandidateFinding,
  createGoogleIntelligenceEvidence,
  deriveStreetViewGoogleCandidateFinding,
  rejectGoogleCandidateFinding,
  toInstitutionalCorrelationItem,
  type GoogleCandidateFinding,
} from "../src/utils/googleIntelligenceContract";

const lineage = buildEvidenceLineage({
  sourceId: "GOOGLE_STREET_VIEW",
  sourceReference: "pano:pano-123",
  evidenceId: "sv-source-1",
  findingId: "google-candidate-1",
  geographyId: "geo-1",
});

function baseEvidence() {
  return createGoogleIntelligenceEvidence({
    evidenceId: "sv-source-1",
    sourceEvidenceId: "sv-source-1",
    traceabilityId: "trace-sv-1",
    expedienteId: "exp-1",
    geographyId: "geo-1",
    providerId: "GOOGLE_STREET_VIEW",
    providerFeature: "STREET_VIEW_PANORAMA",
    coordinates: { lat: 21.8818, lng: -102.2916 },
    observedAt: "2024-05",
    acquiredAt: "2026-09-05T12:00:00.000Z",
    rawResponseRef: "google-streetview:pano:pano-123",
    sourceReferences: ["pano:pano-123", "Google Street View"],
    observableFacts: ["panoId:pano-123", "heading:90"],
    limitations: ["No prueba uso criminal.", "Imagen historica."],
    lineage,
    metadata: {
      streetView: {
        panoId: "pano-123",
        panoramaLat: 21.8818,
        panoramaLng: -102.2916,
        heading: 90,
        pitch: 0,
        fov: 90,
        captureDate: "2024-05",
      },
    },
  });
}

function baseCandidate(overrides: Partial<GoogleCandidateFinding> = {}) {
  const evidence = baseEvidence();
  return {
    ...deriveStreetViewGoogleCandidateFinding({
      evidence,
      findingId: "google-candidate-1",
      candidateType: "POTENTIAL_CONCEALMENT_AREA",
      explanation:
        "Los factores observables son compatibles con cobertura visual parcial y requieren validacion humana.",
      observableFactors: ["visual obstruction", "partial physical cover"],
      confidence: 0.62,
      confidenceBasis: "Regla deterministica sobre metadatos Street View y factores declarados.",
      limitations: ["No prueba uso criminal.", "No se observa iluminacion nocturna."],
      generatedBy: "ADR-025.2_TEST",
    }),
    ...overrides,
  };
}

describe("ADR-025.2 Google Evidence / Candidate Finding contract", () => {
  test("1. Google evidence real conserva sourceEvidenceId", () => {
    expect(baseEvidence().sourceEvidenceId).toBe("sv-source-1");
  });

  test("2. Google evidence real conserva traceabilityId", () => {
    expect(baseEvidence().traceabilityId).toBe("trace-sv-1");
  });

  test("3. Google evidence real conserva geographyId", () => {
    expect(baseEvidence().geographyId).toBe("geo-1");
  });

  test("4. Google evidence real conserva lineage", () => {
    expect(baseEvidence().lineage).toEqual(lineage);
    expect(baseEvidence().lineageStatus).toBe("SUPPORTED");
  });

  test("5. candidate finding nace PENDING_REVIEW", () => {
    expect(baseCandidate().validationStatus).toBe("PENDING_REVIEW");
    expect(baseCandidate().eligibleForCorrelation).toBe(false);
  });

  test("6. candidate finding no es SOURCE_FACT", () => {
    expect(baseCandidate().semanticRole).not.toBe("SOURCE_FACT");
    expect(baseCandidate().acquisitionMode).toBe("DERIVED");
  });

  test("7. candidate finding requiere explanation", () => {
    expect(() => createGoogleCandidateFinding({ ...baseCandidate(), explanation: "" })).toThrow(
      "GOOGLE_CONTRACT_MISSING_EXPLANATION"
    );
  });

  test("8. candidate finding requiere observableFactors", () => {
    expect(() => createGoogleCandidateFinding({ ...baseCandidate(), observableFactors: [] })).toThrow(
      "GOOGLE_CONTRACT_MISSING_OBSERVABLEFACTORS"
    );
  });

  test("9. candidate finding requiere confidenceBasis", () => {
    expect(() => createGoogleCandidateFinding({ ...baseCandidate(), confidenceBasis: "" })).toThrow(
      "GOOGLE_CONTRACT_MISSING_CONFIDENCEBASIS"
    );
  });

  test("10. candidate finding requiere limitations", () => {
    expect(() => createGoogleCandidateFinding({ ...baseCandidate(), limitations: [] })).toThrow(
      "GOOGLE_CONTRACT_MISSING_LIMITATIONS"
    );
  });

  test("11. PENDING_REVIEW no entra a correlacion", () => {
    const result = toInstitutionalCorrelationItem(baseCandidate());
    expect(result.item).toBeNull();
    expect(result.blockingReasons).toContain("VALIDATION_NOT_APPROVED:PENDING_REVIEW");
  });

  test("12. REJECTED no entra a correlacion", () => {
    const result = toInstitutionalCorrelationItem(rejectGoogleCandidateFinding(baseCandidate()));
    expect(result.item).toBeNull();
    expect(result.blockingReasons).toContain("VALIDATION_NOT_APPROVED:REJECTED");
  });

  test("13. APPROVED + trazabilidad completa puede adaptarse", () => {
    const approved = approveGoogleCandidateFinding(baseCandidate(), {
      validatedBy: { id: "analyst-1" },
      validatedAt: "2026-09-05T12:30:00.000Z",
    });
    const result = toInstitutionalCorrelationItem(approved);
    expect(approved.eligibleForCorrelation).toBe(true);
    expect(result.item?.sourceEvidenceId).toBe("sv-source-1");
  });

  test("14. MOCK/SIMULATED queda bloqueado", () => {
    const mockCandidate = approveGoogleCandidateFinding({
      ...baseCandidate(),
      acquisitionMode: "MOCK" as any,
    });
    const simulatedCandidate = approveGoogleCandidateFinding({
      ...baseCandidate(),
      acquisitionMode: "SIMULATED" as any,
    });

    expect(toInstitutionalCorrelationItem(mockCandidate).blockingReasons).toContain(
      "ACQUISITION_MODE_NOT_REPORTABLE:MOCK"
    );
    expect(toInstitutionalCorrelationItem(simulatedCandidate).blockingReasons).toContain(
      "ACQUISITION_MODE_NOT_REPORTABLE:SIMULATED"
    );
  });

  test("15. Street View conserva panoId, coords y metadata", () => {
    const evidence = adaptStreetViewToGoogleEvidence({
      evidenceId: "sv-source-1",
      sourceEvidenceId: "sv-source-1",
      traceabilityId: "trace-sv-1",
      expedienteId: "exp-1",
      geographyId: "geo-1",
      coordinates: { lat: 21.8818, lng: -102.2916 },
      lineage,
      streetViewMetadata: {
        panoId: "pano-123",
        heading: 90,
        pitch: 0,
        fov: 90,
        captureDate: "2024-05",
      },
    });

    expect(evidence.metadata?.streetView?.panoId).toBe("pano-123");
    expect(evidence.coordinates).toEqual({ lat: 21.8818, lng: -102.2916 });
    expect(evidence.providerFeature).toBe("STREET_VIEW_PANORAMA");
  });

  test("16. sourceEvidenceId Street View no se duplica", () => {
    const evidence = adaptStreetViewToGoogleEvidence({
      evidenceId: "different-local-id",
      sourceEvidenceId: "sv-source-1",
      traceabilityId: "trace-sv-1",
      expedienteId: "exp-1",
      geographyId: "geo-1",
      coordinates: { lat: 21.8818, lng: -102.2916 },
      lineage,
      streetViewMetadata: { panoId: "pano-123" },
    });

    expect(evidence.sourceEvidenceId).toBe("sv-source-1");
    expect(evidence.evidenceId).toBe("different-local-id");
  });

  test("17. adapter produce InstitutionalCorrelationItem valido", () => {
    const result = toInstitutionalCorrelationItem(approveGoogleCandidateFinding(baseCandidate()));

    expect(result.item).toMatchObject({
      id: "google-candidate-1",
      sourceType: "GOOGLE_CANDIDATE_FINDING",
      providerId: "GOOGLE_STREET_VIEW",
      sourceEvidenceId: "sv-source-1",
      traceabilityId: "trace-sv-1",
      expedienteId: "exp-1",
      geographyId: "geo-1",
      semanticRole: "INFERENCE",
    });
    expect(result.item?.epistemicIntegrity?.acquisitionMode).toBe("DERIVED");
    expect(result.item?.payload?.candidateType).toBe("POTENTIAL_CONCEALMENT_AREA");
  });

  test("18. ausencia de geographyId bloquea promocion a correlacion", () => {
    const approved = approveGoogleCandidateFinding({
      ...baseCandidate(),
      geographyId: "" as any,
    });
    const result = toInstitutionalCorrelationItem(approved);

    expect(approved.eligibleForCorrelation).toBe(false);
    expect(result.item).toBeNull();
    expect(result.blockingReasons).toContain("MISSING_GEOGRAPHY_ID");
  });
});
