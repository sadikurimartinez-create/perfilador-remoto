import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { MultiSourceCorrelationEngine } from "../src/lib/geoint/multiSourceCorrelationEngine";
import {
  adaptStreetViewToGoogleEvidence,
  approveGoogleCandidateFinding,
  createGoogleIntelligenceEvidence,
  deriveExplainableStreetViewCandidateFinding,
  isStreetViewSampleWithinCanonicalGeography,
  rejectGoogleCandidateFinding,
  resolveStreetViewCandidateType,
  toInstitutionalCorrelationItem,
  type GoogleCandidateFinding,
} from "../src/utils/googleIntelligenceContract";

const completeLineage = buildEvidenceLineage({
  sourceId: "GOOGLE_STREET_VIEW",
  sourceReference: "pano:pano-0253a",
  evidenceId: "sv-source-0253a",
  findingId: "sv-candidate-0253a",
  geographyId: "geo-0253a",
});

function streetViewEvidence(overrides: Record<string, any> = {}) {
  return adaptStreetViewToGoogleEvidence({
    evidenceId: "sv-source-0253a",
    sourceEvidenceId: "sv-source-0253a",
    traceabilityId: "trace-0253a",
    expedienteId: "exp-0253a",
    geographyId: "geo-0253a",
    coordinates: { lat: 21.8818, lng: -102.2916 },
    heading: 90,
    pitch: 0,
    fov: 90,
    lineage: completeLineage,
    streetViewMetadata: {
      panoId: "pano-0253a",
      captureDate: "2021-04",
      heading: 90,
      pitch: 0,
      fov: 90,
    },
    ...overrides,
  });
}

function candidate(overrides: Partial<GoogleCandidateFinding> = {}) {
  const base = deriveExplainableStreetViewCandidateFinding({
    evidence: streetViewEvidence(),
    findingId: "sv-candidate-0253a",
    preferredCandidateType: "POTENTIAL_CONCEALMENT_AREA",
    observableFactors: ["visual obstruction", "physical cover", "setback"],
    generatedBy: "GEOINT_CONTROLLED_SWEEP",
    spatialDistanceMeters: 24,
  });
  return { ...base, ...overrides };
}

describe("ADR-025.3A Street View analytical sweep and explainable candidate findings", () => {
  test("1. sweep respeta geographyId", () => {
    expect(streetViewEvidence().geographyId).toBe("geo-0253a");
  });

  test("2. evidencia conserva panoId", () => {
    expect(streetViewEvidence().metadata?.streetView?.panoId).toBe("pano-0253a");
  });

  test("3. evidencia conserva sourceEvidenceId", () => {
    expect(streetViewEvidence().sourceEvidenceId).toBe("sv-source-0253a");
  });

  test("4. candidate conserva traceabilityId", () => {
    expect(candidate().traceabilityId).toBe("trace-0253a");
  });

  test("5. PENDING_REVIEW por defecto", () => {
    expect(candidate().validationStatus).toBe("PENDING_REVIEW");
    expect(candidate().eligibleForCorrelation).toBe(false);
  });

  test("6. POTENTIAL_CONCEALMENT requiere factores explicables", () => {
    const resolved = resolveStreetViewCandidateType({
      preferredCandidateType: "POTENTIAL_CONCEALMENT_AREA",
      observableFactors: ["visual obstruction", "physical cover"],
    });

    expect(resolved.candidateType).toBe("POTENTIAL_CONCEALMENT_AREA");
    expect(resolved.isStrongCandidate).toBe(true);
  });

  test("7. explanation describe factores", () => {
    const c = candidate();
    expect(c.explanation).toContain("visual obstruction");
    expect(c.explanation).toContain("physical cover");
  });

  test("8. limitations niega conclusion criminal automatica", () => {
    expect(candidate().limitations.join(" ")).toMatch(/no acredita conducta criminal/i);
  });

  test("9. un solo factor debil no crea candidato fuerte", () => {
    const resolved = resolveStreetViewCandidateType({
      preferredCandidateType: "POTENTIAL_CONCEALMENT_AREA",
      observableFactors: ["visual obstruction"],
    });

    expect(resolved.candidateType).toBe("TACTICAL_OBSERVATION_POINT");
    expect(resolved.isStrongCandidate).toBe(false);
  });

  test("10. Street View historico añade limitacion temporal", () => {
    expect(candidate().limitations.join(" ")).toMatch(/historica/i);
  });

  test("11. MOCK/SIMULATED bloqueado", () => {
    const mock = approveGoogleCandidateFinding({ ...candidate(), acquisitionMode: "MOCK" as any });
    const simulated = approveGoogleCandidateFinding({ ...candidate(), acquisitionMode: "SIMULATED" as any });

    expect(toInstitutionalCorrelationItem(mock).blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:MOCK");
    expect(toInstitutionalCorrelationItem(simulated).blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:SIMULATED");
  });

  test("12. candidato no es SOURCE_FACT", () => {
    expect(candidate().semanticRole).not.toBe("SOURCE_FACT");
    expect(candidate().acquisitionMode).toBe("DERIVED");
  });

  test("13. IA visual no reemplaza observacion fuente", () => {
    const c = candidate();
    expect(c.metadata?.sourceEvidence?.semanticRole).toBe("SOURCE_FACT");
    expect(c.semanticRole).toBe("ANALYTICAL_SUGGESTION");
  });

  test("14. candidato rechazado no correlaciona", () => {
    expect(toInstitutionalCorrelationItem(rejectGoogleCandidateFinding(candidate())).item).toBeNull();
  });

  test("15. candidato pendiente no correlaciona", () => {
    expect(toInstitutionalCorrelationItem(candidate()).item).toBeNull();
  });

  test("16. aprobado + lineage completo se adapta a ADR-023.8 y correlaciona", () => {
    const item = toInstitutionalCorrelationItem(approveGoogleCandidateFinding(candidate())).item;
    expect(item).not.toBeNull();

    const denue = {
      id: "denue-0253a",
      sourceType: "DENUE",
      providerId: "INEGI_DENUE",
      sourceEvidenceId: "denue:0253a",
      traceabilityId: "trace-denue-0253a",
      expedienteId: "exp-0253a",
      geographyId: "geo-0253a",
      coordinates: { lat: 21.88181, lng: -102.29161 },
      semanticRole: "SOURCE_FACT",
      category: item?.category,
      payload: { assertion: "PRESENT", findingType: item?.category },
      epistemicIntegrity: {
        acquisitionMode: "OBSERVED",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "UNREVIEWED",
        semanticRole: "SOURCE_FACT",
        sourceType: "DENUE",
        providerId: "INEGI_DENUE",
        traceabilityId: "trace-denue-0253a",
      },
    } as any;
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [item!, denue]);

    expect(report.results).toHaveLength(1);
    expect(report.results[0].eligibleForInstitutionalAnalysis).toBe(true);
  });

  test("17. falta geographyId bloquea promocion", () => {
    const approved = approveGoogleCandidateFinding({ ...candidate(), geographyId: "" as any });
    expect(toInstitutionalCorrelationItem(approved).blockingReasons).toContain("MISSING_GEOGRAPHY_ID");
  });

  test("18. falta sourceEvidenceId bloquea promocion", () => {
    const approved = approveGoogleCandidateFinding({ ...candidate(), sourceEvidenceId: "" as any });
    expect(toInstitutionalCorrelationItem(approved).blockingReasons).toContain("MISSING_SOURCE_EVIDENCE_ID");
  });

  test("19. finding legacy sigue cargando pero no promociona si incompleto", () => {
    const legacy = approveGoogleCandidateFinding({
      ...candidate(),
      sourceEvidenceId: "" as any,
      traceabilityId: "" as any,
      geographyId: "" as any,
      lineage: [],
      lineageStatus: "LEGACY_UNCLASSIFIED",
    });
    const result = toInstitutionalCorrelationItem(legacy);

    expect(result.item).toBeNull();
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining(["MISSING_SOURCE_EVIDENCE_ID", "MISSING_TRACEABILITY_ID", "MISSING_GEOGRAPHY_ID", "MISSING_LINEAGE"])
    );
  });

  test("20. graffiti aislado no produce conclusion de pandilla o delito", () => {
    const resolved = resolveStreetViewCandidateType({ observableFactors: ["graffiti"] });
    const c = deriveExplainableStreetViewCandidateFinding({
      evidence: streetViewEvidence(),
      findingId: "graffiti-alone",
      observableFactors: ["graffiti"],
      generatedBy: "GEOINT_CONTROLLED_SWEEP",
    });

    expect(resolved.candidateType).toBe("TACTICAL_OBSERVATION_POINT");
    expect(c.explanation).toMatch(/no acredita pertenencia a pandilla/i);
    expect(c.candidateType).not.toMatch(/PANDILLA|DELITO/i);
  });

  test("21. callejon aislado no prueba emboscada", () => {
    const resolved = resolveStreetViewCandidateType({
      preferredCandidateType: "POTENTIAL_AMBUSH_POINT",
      observableFactors: ["narrow field"],
    });

    expect(resolved.candidateType).toBe("TACTICAL_OBSERVATION_POINT");
  });

  test("22. access candidate permanece POTENTIAL hasta aprobacion", () => {
    const c = deriveExplainableStreetViewCandidateFinding({
      evidence: streetViewEvidence(),
      findingId: "route-candidate",
      preferredCandidateType: "ESCAPE_ROUTE_CANDIDATE",
      observableFactors: ["secondary access", "alternate ingress egress"],
      generatedBy: "GEOINT_CONTROLLED_SWEEP",
    });

    expect(c.candidateType).toBe("ESCAPE_ROUTE_CANDIDATE");
    expect(c.validationStatus).toBe("PENDING_REVIEW");
    expect(c.eligibleForCorrelation).toBe(false);
  });

  test("23. sampling no sale de canonicalGeography", () => {
    expect(
      isStreetViewSampleWithinCanonicalGeography({
        center: { lat: 21.8818, lng: -102.2916 },
        sample: { lat: 21.882, lng: -102.2917 },
        radiusMeters: 50,
        geographyType: "INDIVIDUAL",
      })
    ).toBe(true);
    expect(
      isStreetViewSampleWithinCanonicalGeography({
        center: { lat: 21.8818, lng: -102.2916 },
        sample: { lat: 21.8918, lng: -102.2916 },
        radiusMeters: 50,
        geographyType: "INDIVIDUAL",
      })
    ).toBe(false);
  });

  test("24. no duplica sourceEvidenceId para misma captura", () => {
    const evidence = createGoogleIntelligenceEvidence({
      ...streetViewEvidence(),
      evidenceId: "local-wrapper-id",
      sourceEvidenceId: "sv-source-0253a",
      sourceReferences: ["pano:pano-0253a"],
      observableFacts: ["panoId:pano-0253a"],
      limitations: ["No prueba uso criminal."],
    });

    expect(evidence.evidenceId).toBe("local-wrapper-id");
    expect(evidence.sourceEvidenceId).toBe("sv-source-0253a");
  });
});
