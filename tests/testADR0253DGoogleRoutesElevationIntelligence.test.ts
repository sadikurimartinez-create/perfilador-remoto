import { MultiSourceCorrelationEngine } from "../src/lib/geoint/multiSourceCorrelationEngine";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import {
  adaptGoogleElevationToEvidence,
  adaptGoogleRouteToEvidence,
  approveGoogleCandidateFinding,
  createGoogleIntelligenceEvidence,
  deriveGoogleMobilityCrossSourceCandidate,
  deriveGoogleRouteMobilityFindings,
  rejectGoogleCandidateFinding,
  toInstitutionalCorrelationItem,
  type GoogleMobilitySourceContext,
  type GoogleRouteObservation,
} from "../src/utils/googleIntelligenceContract";

const lineage = buildEvidenceLineage({
  sourceId: "google-directions-response-0253d",
  sourceReference: "google-directions:route-0253d",
  evidenceId: "route-source-0253d",
  findingId: "route-finding-0253d",
  geographyId: "geo-0253d",
});

function context(overrides: Partial<GoogleMobilitySourceContext> = {}): GoogleMobilitySourceContext {
  return {
    sourceEvidenceId: "route-source-0253d",
    traceabilityId: "trace-0253d",
    expedienteId: "exp-0253d",
    geographyId: "geo-0253d",
    lineage,
    acquiredAt: "2026-09-06T11:00:00.000Z",
    providerFeature: "ROUTES",
    coordinates: { lat: 21.8818, lng: -102.2916 },
    sourceReference: "google-directions:route-0253d",
    canonicalGeographyCompatible: true,
    ...overrides,
  };
}

function route(overrides: Partial<GoogleRouteObservation> = {}): GoogleRouteObservation {
  return {
    routeId: "route-0253d",
    origin: { lat: 21.8818, lng: -102.2916, label: "Nodo A" },
    destination: { lat: 21.884, lng: -102.294, label: "Nodo B" },
    waypoints: [{ lat: 21.8824, lng: -102.2924, label: "Intermedio" }],
    polyline: "encoded-polyline",
    distanceMeters: 850,
    durationSeconds: 420,
    staticDurationSeconds: 390,
    travelMode: "DRIVING",
    routeLabels: ["DEFAULT_ROUTE"],
    warnings: ["Use caution"],
    legs: [{ distance: { value: 850 }, duration: { value: 420 } }],
    steps: [{ maneuver: "turn-left" }],
    alternatives: [
      {
        routeId: "route-alt-0253d",
        origin: { lat: 21.8818, lng: -102.2916 },
        destination: { lat: 21.884, lng: -102.294 },
        polyline: "encoded-alt-polyline",
        distanceMeters: 1040,
        durationSeconds: 510,
        travelMode: "DRIVING",
      },
    ],
    ...overrides,
  };
}

function routeEvidence() {
  return adaptGoogleRouteToEvidence({ route: route(), context: context(), generatedAt: "2026-09-06T11:01:00.000Z" })!;
}

function elevationEvidence() {
  return adaptGoogleElevationToEvidence({
    context: context({ providerFeature: "ELEVATION", sourceEvidenceId: "elevation-source-0253d" }),
    profile: {
      sampleCoordinates: [
        { lat: 21.8818, lng: -102.2916 },
        { lat: 21.8828, lng: -102.2926 },
        { lat: 21.884, lng: -102.294 },
      ],
      elevationMeters: [1880, 1889, 1894],
    },
    generatedAt: "2026-09-06T11:02:00.000Z",
  })!;
}

function supportingEvidence(providerFeature: "STREET_VIEW_PANORAMA" | "VISION_OBJECT" | "PLACES_NEARBY" | "PLACES_DETAILS", id: string) {
  return createGoogleIntelligenceEvidence({
    evidenceId: id,
    sourceEvidenceId: id,
    traceabilityId: "trace-0253d",
    expedienteId: "exp-0253d",
    geographyId: "geo-0253d",
    providerId: providerFeature.startsWith("STREET") ? "GOOGLE_STREET_VIEW" : providerFeature.startsWith("VISION") ? "GOOGLE_VISION" : "GOOGLE_PLACES",
    providerFeature,
    coordinates: { lat: 21.88182, lng: -102.29162 },
    observedAt: "2026-09-06T10:55:00.000Z",
    acquiredAt: "2026-09-06T11:00:00.000Z",
    rawResponseRef: id,
    sourceReferences: [id],
    observableFacts: [`observed:${id}`],
    limitations: ["Fuente de soporte contextual."],
    lineage,
  });
}

describe("ADR-025.3D Google Routes, Directions and Elevation intelligence", () => {
  test("1. route evidence conserva origin", () => {
    expect((routeEvidence().metadata?.route as any).origin.label).toBe("Nodo A");
  });

  test("2. route evidence conserva destination", () => {
    expect((routeEvidence().metadata?.route as any).destination.label).toBe("Nodo B");
  });

  test("3. route evidence conserva distance", () => {
    expect((routeEvidence().metadata?.route as any).distanceMeters).toBe(850);
  });

  test("4. route evidence conserva duration", () => {
    expect((routeEvidence().metadata?.route as any).durationSeconds).toBe(420);
  });

  test("5. conserva geographyId", () => {
    expect(routeEvidence().geographyId).toBe("geo-0253d");
  });

  test("6. conserva sourceEvidenceId", () => {
    expect(routeEvidence().sourceEvidenceId).toBe("route-source-0253d");
  });

  test("7. conserva traceabilityId", () => {
    expect(routeEvidence().traceabilityId).toBe("trace-0253d");
  });

  test("8. conserva lineage", () => {
    expect(routeEvidence().lineageStatus).toBe("SUPPORTED");
  });

  test("9. route nace como SOURCE_FACT del proveedor", () => {
    expect(routeEvidence().semanticRole).toBe("SOURCE_FACT");
    expect(routeEvidence().acquisitionMode).toBe("OBSERVED");
  });

  test("10. route no es finding criminal", () => {
    const finding = deriveGoogleRouteMobilityFindings({ routeEvidence: routeEvidence() })[0];
    expect(finding.candidateType).not.toMatch(/ESCAPE|AMBUSH|CRIMINAL|EVASION/);
  });

  test("11. multiple alternatives genera factor contextual", () => {
    const finding = deriveGoogleRouteMobilityFindings({ routeEvidence: routeEvidence() })[0];
    expect(finding.observableFactors).toContain("MULTIPLE_ACCESS_PATHS");
  });

  test("12. alternatives no generan escape route", () => {
    expect(deriveGoogleRouteMobilityFindings({ routeEvidence: routeEvidence() }).map((f) => f.candidateType)).not.toContain("ESCAPE_ROUTE_CANDIDATE");
  });

  test("13. direct access no implica conducta criminal", () => {
    expect(deriveGoogleRouteMobilityFindings({ routeEvidence: routeEvidence() })[0].limitations.join(" ")).toMatch(/no prueban fuga/i);
  });

  test("14. elevation conserva samples", () => {
    expect((elevationEvidence().metadata?.elevation as any).sampleCoordinates).toHaveLength(3);
  });

  test("15. slope no implica criminalidad", () => {
    expect(elevationEvidence().limitations.join(" ")).toMatch(/no acreditan riesgo criminal/i);
  });

  test("16. topographic factor queda contextual", () => {
    expect(deriveGoogleRouteMobilityFindings({ elevationEvidence: elevationEvidence() })[0].candidateType).toMatch(/TOPOGRAPHIC_/);
  });

  test("17. candidate nace PENDING_REVIEW", () => {
    expect(deriveGoogleRouteMobilityFindings({ routeEvidence: routeEvidence() })[0].validationStatus).toBe("PENDING_REVIEW");
  });

  test("18. rejected no correlaciona", () => {
    const rejected = rejectGoogleCandidateFinding(deriveGoogleRouteMobilityFindings({ routeEvidence: routeEvidence() })[0]);
    expect(toInstitutionalCorrelationItem(rejected).item).toBeNull();
  });

  test("19. approved + lineage valido si correlaciona", () => {
    const approved = approveGoogleCandidateFinding(deriveGoogleRouteMobilityFindings({ routeEvidence: routeEvidence() })[0]);
    const item = toInstitutionalCorrelationItem(approved).item!;
    const denue = {
      id: "denue-connectivity-0253d",
      sourceType: "DENUE",
      providerId: "INEGI_DENUE",
      sourceEvidenceId: "denue-source-0253d",
      traceabilityId: "trace-denue-0253d",
      expedienteId: "exp-0253d",
      geographyId: "geo-0253d",
      coordinates: { lat: 21.88181, lng: -102.29161 },
      semanticRole: "SOURCE_FACT",
      category: item.category,
      payload: { assertion: "PRESENT", findingType: item.category },
      epistemicIntegrity: { acquisitionMode: "OBSERVED", validationStatus: "UNREVIEWED", semanticRole: "SOURCE_FACT" },
    } as any;
    expect(MultiSourceCorrelationEngine.correlateInstitutionalEvidence("perfil", [item, denue]).results[0].eligibleForInstitutionalAnalysis).toBe(true);
  });

  test("20. missing geographyId bloquea promocion", () => {
    const approved = approveGoogleCandidateFinding({ ...deriveGoogleRouteMobilityFindings({ routeEvidence: routeEvidence() })[0], geographyId: "" as any });
    expect(toInstitutionalCorrelationItem(approved).blockingReasons).toContain("MISSING_GEOGRAPHY_ID");
  });

  test("21. missing traceability bloquea promocion", () => {
    const approved = approveGoogleCandidateFinding({ ...deriveGoogleRouteMobilityFindings({ routeEvidence: routeEvidence() })[0], traceabilityId: "" as any });
    expect(toInstitutionalCorrelationItem(approved).blockingReasons).toContain("MISSING_TRACEABILITY_ID");
  });

  test("22. mock/simulated bloqueado", () => {
    const base = deriveGoogleRouteMobilityFindings({ routeEvidence: routeEvidence() })[0];
    expect(toInstitutionalCorrelationItem(approveGoogleCandidateFinding({ ...base, acquisitionMode: "MOCK" as any })).blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:MOCK");
    expect(toInstitutionalCorrelationItem(approveGoogleCandidateFinding({ ...base, acquisitionMode: "SIMULATED" as any })).blockingReasons).toContain("ACQUISITION_MODE_NOT_REPORTABLE:SIMULATED");
  });

  test("23. duplicate route se deduplica", () => {
    const first = adaptGoogleRouteToEvidence({ route: route(), context: context() })!;
    const second = adaptGoogleRouteToEvidence({ route: route(), context: context() })!;
    expect(first.evidenceId).toBe(second.evidenceId);
  });

  test("24. no fabricated traffic", () => {
    expect((routeEvidence().metadata?.route as any).trafficDurationSeconds).toBeUndefined();
    expect((routeEvidence().metadata?.route as any).fabricatedTraffic).toBe(false);
  });

  test("25. no fabricated duration", () => {
    const withoutDuration = adaptGoogleRouteToEvidence({ route: route({ durationSeconds: null }), context: context() })!;
    expect(deriveGoogleRouteMobilityFindings({ routeEvidence: withoutDuration })).toHaveLength(0);
  });

  test("26. no fabricated slope", () => {
    expect((elevationEvidence().metadata?.elevation as any).fabricatedSlope).toBe(false);
  });

  test("27. Street View + route conserva ambas evidencias", () => {
    const c = deriveGoogleMobilityCrossSourceCandidate({
      routeEvidence: routeEvidence(),
      supportingEvidence: supportingEvidence("STREET_VIEW_PANORAMA", "streetview-source-0253d"),
      sourceKind: "STREET_VIEW",
    });
    expect(c.supportingEvidenceIds).toEqual(expect.arrayContaining([routeEvidence().evidenceId, "streetview-source-0253d"]));
  });

  test("28. Vision + route conserva ambas evidencias", () => {
    const c = deriveGoogleMobilityCrossSourceCandidate({
      routeEvidence: routeEvidence(),
      supportingEvidence: supportingEvidence("VISION_OBJECT", "vision-source-0253d"),
      sourceKind: "VISION",
    });
    expect(c.supportingEvidenceIds).toEqual(expect.arrayContaining([routeEvidence().evidenceId, "vision-source-0253d"]));
  });

  test("29. Places + route conserva ambas fuentes", () => {
    const c = deriveGoogleMobilityCrossSourceCandidate({
      routeEvidence: routeEvidence(),
      supportingEvidence: supportingEvidence("PLACES_NEARBY", "places-source-0253d"),
      sourceKind: "PLACES",
    });
    expect(c.sourceReferences).toEqual(expect.arrayContaining(["places-source-0253d"]));
  });

  test("30. field contradiction no se sobrescribe", () => {
    const c = deriveGoogleRouteMobilityFindings({ routeEvidence: routeEvidence(), fieldStatus: "contradictedByField" })[0];
    expect(c.metadata?.fieldStatus).toBe("contradictedByField");
  });

  test("31. route outside canonical geography no se promociona silenciosamente", () => {
    const outside = adaptGoogleRouteToEvidence({
      route: route(),
      context: context({ canonicalGeographyCompatible: false }),
    })!;
    const approved = approveGoogleCandidateFinding(deriveGoogleRouteMobilityFindings({ routeEvidence: outside })[0]);
    expect(toInstitutionalCorrelationItem(approved).blockingReasons).toContain("CANONICAL_GEOGRAPHY_INCOMPATIBLE");
  });

  test("32. fallback invalid coords no genera evidence institucional", () => {
    expect(
      adaptGoogleRouteToEvidence({
        route: route({ origin: { lat: 0, lng: 0 }, destination: { lat: 21.884, lng: -102.294 } }),
        context: context(),
      })
    ).toBeNull();
  });
});
