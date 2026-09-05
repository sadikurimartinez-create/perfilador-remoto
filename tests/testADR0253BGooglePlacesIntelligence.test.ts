import {
  approvePlacesCandidateForCorrelation,
  adaptGooglePlaceReviewToEvidence,
  adaptGooglePlaceToEvidence,
  buildPlacesSemanticRecurrences,
  compareGooglePlaceWithDenue,
  compareGooglePlaceWithFieldObservation,
  createPlacesCandidateFromRecurrence,
  detectOperationalHoursInconsistency,
  extractPlacesReviewSemanticObservation,
  type PlacesReviewSemanticObservation,
} from "../src/utils/googlePlacesIntelligence";
import { approveGoogleCandidateFinding, rejectGoogleCandidateFinding, toInstitutionalCorrelationItem } from "../src/utils/googleIntelligenceContract";
import { MultiSourceCorrelationEngine } from "../src/lib/geoint/multiSourceCorrelationEngine";
import type { GooglePlaceReviewSummary, PlaceSummary } from "../src/lib/googlePlaces";

const place: PlaceSummary = {
  placeId: "place-123",
  nombre: "Servicio Norte",
  direccion: "Av. Norte 100",
  lat: 21.8818,
  lng: -102.2916,
  types: ["store", "point_of_interest"],
  businessStatus: "OPERATIONAL",
  openingHours: { openNow: true, weekdayText: ["Monday: 9:00 AM - 11:00 PM"] },
  rating: 4.7,
  userRatingsTotal: 120,
  categoria: "otro",
  fuente: "GOOGLE_PLACES",
};

function review(overrides: Partial<GooglePlaceReviewSummary> = {}): GooglePlaceReviewSummary {
  return {
    reviewId: "review-1",
    placeId: "place-123",
    text: "Mucho movimiento por la noche y varios carros en el estacionamiento.",
    rating: 4,
    publishedAt: "2026-08-15T00:00:00.000Z",
    relativeTimeDescription: "hace 3 semanas",
    sourceReference: "google-place:place-123:review:1",
    ...overrides,
  };
}

function placeEvidence() {
  return adaptGooglePlaceToEvidence({ place, expedienteId: "exp-places", geographyId: "geo-places" });
}

function reviewEvidence(r = review()) {
  return adaptGooglePlaceReviewToEvidence({ review: r, place, expedienteId: "exp-places", geographyId: "geo-places" });
}

function recurrenceCandidate(observations?: PlacesReviewSemanticObservation[]) {
  const obs = observations || [
    extractPlacesReviewSemanticObservation(review()),
    extractPlacesReviewSemanticObservation(review({ reviewId: "review-2", text: "Siempre hay gente tarde en la noche.", sourceReference: "google-place:place-123:review:2" })),
  ];
  const recurrence = buildPlacesSemanticRecurrences(obs).find((item) => item.semanticTheme === "TEMPORAL_ACTIVITY_REFERENCE")!;
  return createPlacesCandidateFromRecurrence({
    recurrence,
    placeEvidence: placeEvidence(),
    reviewEvidence: [reviewEvidence(), reviewEvidence(review({ reviewId: "review-2", sourceReference: "google-place:place-123:review:2" }))],
  });
}

describe("ADR-025.3B Google Places intelligence, reviews and territorial patterns", () => {
  test("1. Place real conserva placeId", () => {
    expect((placeEvidence().metadata?.place as any).placeId).toBe("place-123");
  });

  test("2. Place real conserva coordinates", () => {
    expect(placeEvidence().coordinates).toEqual({ lat: 21.8818, lng: -102.2916 });
  });

  test("3. Place real conserva geographyId", () => {
    expect(placeEvidence().geographyId).toBe("geo-places");
  });

  test("4. Place real conserva sourceEvidenceId", () => {
    expect(placeEvidence().sourceEvidenceId).toBe("google-place:place-123");
  });

  test("5. review queda USER_GENERATED_CONTEXT", () => {
    expect((reviewEvidence().metadata as any).reviewContextRole).toBe("USER_GENERATED_CONTEXT");
  });

  test("6. review aislado no se vuelve SOURCE_FACT", () => {
    expect(reviewEvidence().semanticRole).not.toBe("SOURCE_FACT");
  });

  test("7. review aislado no genera conclusion criminal", () => {
    const semantic = extractPlacesReviewSemanticObservation(review({ text: "Se ve peligroso por la noche." }));
    expect(semantic.themes).toContain("SAFETY_PERCEPTION_REFERENCE");
    expect(semantic.contextRole).toBe("USER_GENERATED_CONTEXT");
  });

  test("8. multiples reviews compatibles producen recurrencia semantica", () => {
    const recurrences = buildPlacesSemanticRecurrences([
      extractPlacesReviewSemanticObservation(review()),
      extractPlacesReviewSemanticObservation(review({ reviewId: "review-2", text: "Se llena despues de medianoche.", sourceReference: "google-place:place-123:review:2" })),
    ]);

    expect(recurrences.some((item) => item.semanticTheme === "TEMPORAL_ACTIVITY_REFERENCE" && item.supportCount === 2)).toBe(true);
  });

  test("9. recurrence conserva supportingReviewIds", () => {
    const c = recurrenceCandidate();
    expect((c.metadata?.recurrence as any).supportingReviewIds).toEqual(["review-1", "review-2"]);
  });

  test("10. review historico añade limitation", () => {
    const historical = reviewEvidence(review({ publishedAt: "2021-01-01T00:00:00.000Z", relativeTimeDescription: "hace 5 años" }));
    expect(historical.limitations.join(" ")).toMatch(/historical/i);
  });

  test("11. horarios vs reviews puede producir inconsistencia contextual", () => {
    const recurrences = buildPlacesSemanticRecurrences([
      extractPlacesReviewSemanticObservation(review()),
      extractPlacesReviewSemanticObservation(review({ reviewId: "review-2", text: "Hay actividad a la 01:00.", sourceReference: "google-place:place-123:review:2" })),
    ]);
    const inconsistency = detectOperationalHoursInconsistency({ placeEvidence: placeEvidence(), recurrences });
    expect(inconsistency?.candidateType).toBe("OPERATIONAL_HOURS_INCONSISTENCY");
  });

  test("12. inconsistencia no concluye ilegalidad", () => {
    const c = detectOperationalHoursInconsistency({
      placeEvidence: placeEvidence(),
      recurrences: buildPlacesSemanticRecurrences([
        extractPlacesReviewSemanticObservation(review()),
        extractPlacesReviewSemanticObservation(review({ reviewId: "review-2", text: "Actividad nocturna 02:00.", sourceReference: "google-place:place-123:review:2" })),
      ]),
    })!;
    expect(c.explanation).toMatch(/No se concluye ilegalidad/i);
  });

  test("13. Places vs DENUE corroboration conserva ambas fuentes", () => {
    const c = compareGooglePlaceWithDenue({
      placeEvidence: placeEvidence(),
      denueEvidence: { sourceEvidenceId: "denue-1", traceabilityId: "trace-denue-1", name: "Servicio Norte" },
      classificationCompatible: true,
      spatiallyCompatible: true,
    });
    expect(c.candidateType).toBe("POI_SOURCE_CORROBORATION");
    expect(c.supportingEvidenceIds).toEqual(["google-place:place-123", "denue-1"]);
  });

  test("14. clasificacion discordante no descarta ninguna fuente", () => {
    const c = compareGooglePlaceWithDenue({
      placeEvidence: placeEvidence(),
      denueEvidence: { sourceEvidenceId: "denue-1", traceabilityId: "trace-denue-1", activity: "Otra actividad" },
      classificationCompatible: false,
      spatiallyCompatible: true,
    });
    expect(c.candidateType).toBe("POI_CLASSIFICATION_INCONSISTENCY");
    expect(c.explanation).toMatch(/Ninguna fuente se descarta automaticamente/i);
  });

  test("15. rating no se usa como riesgo", () => {
    const ev = placeEvidence();
    expect(ev.observableFacts).toEqual(expect.not.arrayContaining(["risk:4.7"]));
    expect(ev.limitations.join(" ")).toMatch(/Rating.*must not be used as risk/i);
  });

  test("16. acusacion criminal individual permanece UNVERIFIED", () => {
    const semantic = extractPlacesReviewSemanticObservation(review({ text: "Dicen que venden droga aqui." }));
    expect(semantic.contextRole).toBe("UNVERIFIED_USER_GENERATED_ALLEGATION");
    expect(semantic.themes).toContain("UNVERIFIED_USER_GENERATED_ALLEGATION");
  });

  test("17. acusacion individual no entra automaticamente a ADR-023.8", () => {
    const allegation = reviewEvidence(review({ text: "Dicen que venden droga aqui." }));
    expect((allegation.metadata as any).reviewContextRole).toBe("UNVERIFIED_USER_GENERATED_ALLEGATION");
    expect((allegation as any).eligibleForCorrelation).toBeUndefined();
  });

  test("18. candidate nace PENDING_REVIEW", () => {
    expect(recurrenceCandidate().validationStatus).toBe("PENDING_REVIEW");
  });

  test("19. REJECTED no correlaciona", () => {
    expect(toInstitutionalCorrelationItem(rejectGoogleCandidateFinding(recurrenceCandidate())).item).toBeNull();
  });

  test("20. APPROVED + lineage valido si adapta", () => {
    const approved = approvePlacesCandidateForCorrelation(recurrenceCandidate());
    const adapted = toInstitutionalCorrelationItem(approved);
    expect(adapted.item?.providerId).toBe("GOOGLE_PLACES");
  });

  test("20b. APPROVED Places puede entrar a MultiSourceCorrelationEngine", () => {
    const item = toInstitutionalCorrelationItem(approveGoogleCandidateFinding(recurrenceCandidate())).item!;
    const field = {
      ...item,
      id: "field-places-corroboration",
      providerId: "CEIPOL_FIELD",
      sourceType: "FIELD_OBSERVATION",
      sourceEvidenceId: "field-1",
      traceabilityId: "trace-field-1",
      semanticRole: "SOURCE_FACT",
      epistemicIntegrity: {
        acquisitionMode: "OBSERVED",
        acquisitionStatus: "ACQUIRED",
        validationStatus: "APPROVED",
        semanticRole: "SOURCE_FACT",
        providerId: "CEIPOL_FIELD",
        sourceType: "FIELD_OBSERVATION",
        traceabilityId: "trace-field-1",
      },
    } as any;
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [item, field]);
    expect(report.results.length).toBeGreaterThan(0);
  });

  test("21. MOCK/SIMULATED bloqueado", () => {
    expect(toInstitutionalCorrelationItem(approveGoogleCandidateFinding({ ...recurrenceCandidate(), acquisitionMode: "MOCK" as any })).blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:MOCK");
    expect(toInstitutionalCorrelationItem(approveGoogleCandidateFinding({ ...recurrenceCandidate(), acquisitionMode: "SIMULATED" as any })).blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:SIMULATED");
  });

  test("22. falta geographyId bloquea promocion", () => {
    expect(toInstitutionalCorrelationItem(approveGoogleCandidateFinding({ ...recurrenceCandidate(), geographyId: "" })).blockingReasons).toContain("MISSING_GEOGRAPHY_ID");
  });

  test("23. duplicate review no duplica finding", () => {
    const obs = extractPlacesReviewSemanticObservation(review());
    const recurrences = buildPlacesSemanticRecurrences([obs, obs]);
    expect(recurrences.find((item) => item.semanticTheme === "TEMPORAL_ACTIVITY_REFERENCE")?.supportCount).toBe(1);
  });

  test("24. same place no duplica evidence", () => {
    expect(placeEvidence().sourceEvidenceId).toBe(adaptGooglePlaceToEvidence({ place, expedienteId: "exp-places", geographyId: "geo-places" }).sourceEvidenceId);
  });

  test("25. actividad nocturna no implica delito", () => {
    const semantic = extractPlacesReviewSemanticObservation(review({ text: "Actividad nocturna y ruido." }));
    expect(semantic.themes).toContain("TEMPORAL_ACTIVITY_REFERENCE");
    expect(semantic.themes).not.toContain("UNVERIFIED_USER_GENERATED_ALLEGATION");
  });

  test("26. bar no implica criminalidad", () => {
    const barPlace = { ...place, types: ["bar"], categoria: "expendioAlcohol" as const };
    const ev = adaptGooglePlaceToEvidence({ place: barPlace, expedienteId: "exp-places", geographyId: "geo-places" });
    expect(ev.semanticRole).toBe("SOURCE_FACT");
    expect(ev.limitations.join(" ")).toMatch(/does not establish criminal relevance/i);
  });

  test("27. muchos carros no implica narcotrafico", () => {
    const semantic = extractPlacesReviewSemanticObservation(review({ text: "Muchos carros afuera." }));
    expect(semantic.themes).toContain("PARKING_REFERENCE");
    expect(semantic.themes).not.toContain("UNVERIFIED_USER_GENERATED_ALLEGATION");
  });

  test("28. work-field contradiction se conserva como contradiccion, no sobrescritura", () => {
    const contradiction = compareGooglePlaceWithFieldObservation({
      placeEvidence: placeEvidence(),
      fieldEvidenceId: "field-obs-1",
      fieldTraceabilityId: "trace-field-obs-1",
      fieldObservation: "PPC observo local cerrado.",
      contradictionType: "BUSINESS_STATUS",
    });
    expect(contradiction.candidateType).toBe("PHYSICAL_OPERATIONAL_STATUS_INCONSISTENCY");
    expect(contradiction.explanation).toMatch(/Google no sobrescribe el trabajo PPC/i);
  });
});
