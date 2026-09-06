import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import {
  approveGoogleCandidateFinding,
  deriveGoogleVisionIntelligence,
  deriveVisionPoiComparisonCandidate,
  GOOGLE_VISION_FEATURE_AUDIT,
  rejectGoogleCandidateFinding,
  toInstitutionalCorrelationItem,
  type GoogleVisionSourceContext,
} from "../src/utils/googleIntelligenceContract";

const lineage = buildEvidenceLineage({
  sourceId: "field-photo-0253c",
  sourceReference: "photo://field/photo-0253c.jpg",
  evidenceId: "field-photo-0253c",
  findingId: "vision-field-photo-0253c",
  geographyId: "geo-0253c",
});

function context(overrides: Partial<GoogleVisionSourceContext> = {}): GoogleVisionSourceContext {
  return {
    sourceEvidenceId: "field-photo-0253c",
    traceabilityId: "trace-0253c",
    expedienteId: "exp-0253c",
    geographyId: "geo-0253c",
    imageReference: "photo://field/photo-0253c.jpg",
    lineage,
    acquiredAt: "2026-09-06T10:00:00.000Z",
    observedAt: "2026-09-06T09:58:00.000Z",
    coordinates: { lat: 21.8818, lng: -102.2916 },
    imageSourceType: "IN_SITU",
    ...overrides,
  };
}

function result() {
  return deriveGoogleVisionIntelligence({
    context: context(),
    texts: [{ text: "FERRETERIA LOPEZ", confidence: 0.91, language: "es", boundingGeometry: { vertices: [] } }],
    objects: [
      { name: "Gate", score: 0.88, boundingGeometry: { normalizedVertices: [] } },
      { name: "Fence", score: 0.85 },
      { name: "Vehicle", score: 0.74 },
      { name: "Person", score: 0.61 },
    ],
    labels: [
      { description: "Graffiti", score: 0.7 },
      { description: "Bar", score: 0.66 },
      { description: "Weapon", score: 0.57 },
    ],
    generatedAt: "2026-09-06T10:01:00.000Z",
  });
}

function observation(value: string) {
  return result().observations.find((item) => item.value.toLowerCase() === value.toLowerCase())!;
}

describe("ADR-025.3C Google Vision intelligence, OCR, objects and explainable observations", () => {
  test("1. Vision evidence conserva sourceEvidenceId", () => {
    expect(observation("FERRETERIA LOPEZ").evidence.sourceEvidenceId).toBe("field-photo-0253c");
  });

  test("2. Vision evidence conserva geographyId", () => {
    expect(observation("Gate").evidence.geographyId).toBe("geo-0253c");
  });

  test("3. Vision evidence conserva traceabilityId", () => {
    expect(observation("Fence").evidence.traceabilityId).toBe("trace-0253c");
  });

  test("4. Vision evidence conserva lineage", () => {
    expect(observation("Vehicle").evidence.lineageStatus).toBe("SUPPORTED");
    expect(observation("Vehicle").evidence.lineage).toEqual(lineage);
  });

  test("5. OCR queda como observacion ML", () => {
    const ocr = observation("FERRETERIA LOPEZ");
    expect(ocr.evidence.providerFeature).toBe("VISION_OCR");
    expect(ocr.evidence.observableFacts[0]).toContain("OBSERVED_BY_VISION");
  });

  test("6. OCR no se vuelve SOURCE_FACT semantico", () => {
    const ocr = observation("FERRETERIA LOPEZ");
    expect((ocr.evidence.metadata?.vision as any).semanticContentStatus).toBe("OBSERVED_BY_VISION_NOT_SOURCE_FACT");
  });

  test("7. object detection conserva label y confidence", () => {
    const gate = observation("Gate");
    expect(gate.feature).toBe("OBJECT_LOCALIZATION");
    expect(gate.confidence).toBe(0.88);
  });

  test("8. label detection no criminaliza", () => {
    const graffiti = observation("Graffiti");
    expect(graffiti.evidence.limitations.join(" ")).toMatch(/no implica pertenencia a pandilla/i);
  });

  test("9. vehicle no implica narcotrafico", () => {
    expect(observation("Vehicle").evidence.limitations.join(" ")).toMatch(/no implica narcotrafico/i);
  });

  test("10. person no implica sospechoso", () => {
    expect(observation("Person").evidence.limitations.join(" ")).toMatch(/no identifica a nadie ni implica sospecha/i);
  });

  test("11. graffiti no implica pandilla", () => {
    expect(observation("Graffiti").evidence.limitations.join(" ")).toMatch(/pandilla/i);
  });

  test("12. bar no implica delito", () => {
    expect(observation("Bar").evidence.limitations.join(" ")).toMatch(/bar no implica delito/i);
  });

  test("13. single object no crea candidato fuerte", () => {
    const single = deriveGoogleVisionIntelligence({
      context: context(),
      objects: [{ name: "Gate", score: 0.88 }],
    });
    expect(single.candidateFindings.map((c) => c.candidateType)).not.toContain("ACCESS_CONTROL_POINT");
    expect(single.candidateFindings[0].candidateType).toBe("PHYSICAL_BARRIER_INDICATOR");
  });

  test("14. multifactor puede crear candidato conservador", () => {
    const multi = deriveGoogleVisionIntelligence({
      context: context(),
      texts: [{ text: "ENTRADA PRIVADA", confidence: 0.82 }],
      objects: [
        { name: "Gate", score: 0.88 },
        { name: "Fence", score: 0.85 },
      ],
    });
    expect(multi.candidateFindings.map((c) => c.candidateType)).toContain("ACCESS_CONTROL_POINT");
  });

  test("15. candidate nace PENDING_REVIEW", () => {
    expect(result().candidateFindings[0].validationStatus).toBe("PENDING_REVIEW");
  });

  test("16. rejected no correlaciona", () => {
    expect(toInstitutionalCorrelationItem(rejectGoogleCandidateFinding(result().candidateFindings[0])).item).toBeNull();
  });

  test("17. approved + lineage valido si adapta", () => {
    const approved = approveGoogleCandidateFinding(result().candidateFindings[0]);
    expect(toInstitutionalCorrelationItem(approved).item?.sourceEvidenceId).toBe("field-photo-0253c");
  });

  test("18. historical image anade temporal limitation", () => {
    const historical = deriveGoogleVisionIntelligence({
      context: context({ imageSourceType: "STREET_VIEW", captureDate: "2021-04", observedAt: "2021-04" }),
      objects: [{ name: "Gate", score: 0.88 }],
    });
    expect(historical.evidences[0].limitations.join(" ")).toMatch(/historica/i);
  });

  test("19. mock/simulated bloqueado", () => {
    const mock = approveGoogleCandidateFinding({ ...result().candidateFindings[0], acquisitionMode: "MOCK" as any });
    const simulated = approveGoogleCandidateFinding({ ...result().candidateFindings[0], acquisitionMode: "SIMULATED" as any });
    expect(toInstitutionalCorrelationItem(mock).blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:MOCK");
    expect(toInstitutionalCorrelationItem(simulated).blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:SIMULATED");
  });

  test("20. duplicate detection no duplica evidence", () => {
    const deduped = deriveGoogleVisionIntelligence({
      context: context(),
      objects: [
        { name: "Gate", score: 0.88 },
        { name: "Gate", score: 0.88 },
      ],
    });
    expect(deduped.evidences).toHaveLength(1);
  });

  test("21. OCR + Places corroboration conserva ambas fuentes", () => {
    const ocr = observation("FERRETERIA LOPEZ").evidence;
    const candidate = deriveVisionPoiComparisonCandidate({
      visionTextEvidence: ocr,
      visibleText: "FERRETERIA LOPEZ",
      comparisonSource: {
        sourceId: "places-1",
        providerId: "GOOGLE_PLACES",
        name: "Ferreteria Lopez",
        coordinates: { lat: 21.88181, lng: -102.29161 },
        sourceReference: "google-place:places-1",
      },
    })!;
    expect(candidate.supportingEvidenceIds).toEqual(expect.arrayContaining([ocr.evidenceId, "places-1"]));
    expect(candidate.sourceReferences).toEqual(expect.arrayContaining(["google-place:places-1"]));
  });

  test("22. OCR + DENUE corroboration conserva ambas fuentes", () => {
    const ocr = observation("FERRETERIA LOPEZ").evidence;
    const candidate = deriveVisionPoiComparisonCandidate({
      visionTextEvidence: ocr,
      visibleText: "FERRETERIA LOPEZ",
      comparisonSource: {
        sourceId: "denue-1",
        providerId: "INEGI_DENUE",
        name: "Ferreteria Lopez",
        activity: "Comercio al por menor",
        coordinates: { lat: 21.88181, lng: -102.29161 },
        sourceReference: "denue:denue-1",
      },
    })!;
    expect(candidate.supportingEvidenceIds).toEqual(expect.arrayContaining([ocr.evidenceId, "denue-1"]));
  });

  test("23. ambiguous weapon label permanece UNVERIFIED", () => {
    expect(observation("Weapon").kind).toBe("UNVERIFIED_VISUAL_CLASSIFICATION");
  });

  test("24. face detection no identifica persona", () => {
    const faceAudit = GOOGLE_VISION_FEATURE_AUDIT.find((entry) => entry.feature === "FACE_DETECTION")!;
    expect(faceAudit.status).toBe("LEGACY");
    expect(faceAudit.enabledByDefault).toBe(false);
  });

  test("25. Vision no reemplaza evidencia in situ", () => {
    expect(observation("Gate").evidence.limitations.join(" ")).toMatch(/foto in situ conserva/i);
  });

  test("26. Street View + Vision conserva mismo sourceEvidenceId", () => {
    const streetVision = deriveGoogleVisionIntelligence({
      context: context({ sourceEvidenceId: "sv-source-0253c", imageSourceType: "STREET_VIEW", captureDate: "2021-04" }),
      objects: [{ name: "Fence", score: 0.85 }],
    });
    expect(streetVision.evidences[0].sourceEvidenceId).toBe("sv-source-0253c");
  });

  test("27. falta geographyId bloquea promocion", () => {
    const approved = approveGoogleCandidateFinding({ ...result().candidateFindings[0], geographyId: "" as any });
    expect(toInstitutionalCorrelationItem(approved).blockingReasons).toContain("MISSING_GEOGRAPHY_ID");
  });

  test("28. falta traceabilityId bloquea promocion", () => {
    const approved = approveGoogleCandidateFinding({ ...result().candidateFindings[0], traceabilityId: "" as any });
    expect(toInstitutionalCorrelationItem(approved).blockingReasons).toContain("MISSING_TRACEABILITY_ID");
  });
});
