import { buildCanonicalProjectGeography, type CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildExecutiveVisualComposition, MAX_EXECUTIVE_VISUALS } from "../src/utils/executiveVisualComposition";
import { buildExecutiveGeointReportModel } from "../src/utils/executiveGeointReportModel";
import { buildExecutiveCanonicalTerritorialMapSpec } from "../src/utils/executiveCanonicalTerritorialMap";
import { DENUE_ANALYTICAL_DOCUMENT_KIND } from "../src/utils/denueAnalyticalDocumentIntegration";

const generatedAt = "2026-09-06T12:00:00.000Z";

function geography(type: "INDIVIDUAL" | "CORRIDOR" | "POLYGON"): CanonicalProjectGeography {
  const points =
    type === "INDIVIDUAL"
      ? [{ lat: 22.1, lng: -101.9 }]
      : type === "CORRIDOR"
        ? [{ lat: 22.1, lng: -101.9 }, { lat: 22.2, lng: -101.8 }]
        : [{ lat: 22.1, lng: -101.9 }, { lat: 22.2, lng: -101.9 }, { lat: 22.2, lng: -101.8 }];
  return buildCanonicalProjectGeography({ projectId: `exp-${type}`, type, points, now: 1 });
}

function multipolygonGeography(): CanonicalProjectGeography {
  return {
    ...geography("POLYGON"),
    geographyId: "geo-multipolygon",
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        [[[-101.9, 22.1], [-101.8, 22.1], [-101.8, 22.2], [-101.9, 22.1]]],
        [[[-101.7, 22.3], [-101.6, 22.3], [-101.6, 22.4], [-101.7, 22.3]]],
      ],
    },
    derived: {
      centroid: { lat: 22.25, lng: -101.75, derivation: "DERIVED_FROM_POLYGON" },
      bounds: { north: 22.4, south: 22.1, east: -101.6, west: -101.9, derivation: "DERIVED_FROM_GEOMETRY" },
      closedRing: true,
    },
  };
}

function finding(id = "finding-1") {
  return {
    findingId: id,
    title: "Concentracion gobernada en acceso oriental",
    summary: "Hallazgo gobernado de configuracion territorial",
    evidenceReferences: ["ev-1"],
    sourceTypes: ["FIELD_PHOTO"],
    supportingFactors: ["factor documentado"],
    contradictingFactors: [],
    interpretation: "Interpretacion gobernada",
    implication: "Implicacion gobernada",
    confidence: "ALTO",
    limitations: [],
    traceabilityIds: [`trace-${id}`],
    technicalMetadata: { sourceFindingIds: [id], sourceEvidenceIds: ["ev-1"], sourceAnalysisIds: ["analysis-1"] },
  };
}

function keyEvidence(overrides: any = {}) {
  return {
    evidenceId: "ev-1",
    title: "Fotografia de campo",
    summary: "Evidencia visual gobernada",
    visualReference: "asset://photo-1",
    evidenceReferences: ["ev-1"],
    sourceTypes: ["FIELD_PHOTO"],
    relatedFindingIds: ["finding-1"],
    selectionReason: "Seleccionada por trazabilidad",
    limitations: [],
    traceabilityIds: ["trace-ev-1"],
    technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: "ev-1" },
    ...overrides,
  };
}

function visualCandidate(overrides: any = {}) {
  return {
    visualId: "map-1",
    title: "Concentracion gobernada en acceso oriental",
    summary: "Mapa gobernado del area",
    visualType: "MAP",
    reference: "asset://map-1",
    relatedFindingIds: ["finding-1"],
    traceabilityIds: ["trace-map-1"],
    technicalMetadata: { sourceItemId: "map-1", sourceType: "VISUAL_CANDIDATE" },
    ...overrides,
  };
}

function executiveModel(overrides: any = {}) {
  const geo = overrides.geography ?? geography("INDIVIDUAL");
  const governedMap = visualCandidate({
    geographyId: geo.geographyId,
    technicalMetadata: { sourceItemId: "map-1", sourceType: "VISUAL_CANDIDATE", geographyId: geo.geographyId },
  });
  return {
    identity: {},
    panorama: { hallazgosClave: [], decisionesSugeridas: [] },
    territorialSituation: {
      canonicalGeography: geo,
      territorialSummary: "Resumen territorial",
      principalMapCandidate: governedMap,
      territorialFindings: [],
      relevantPoi: [],
      spatialLimitations: [],
    },
    findings: [finding()],
    keyEvidence: [keyEvidence()],
    multisourceAnalysis: {
      convergencias: ["Convergencia multifuente gobernada"],
      contradicciones: [],
      fuentesIndependientes: [],
      dependenciasParciales: [],
      brechasInformacion: [],
      nivelSoporte: "ALTO",
      traceabilityIds: ["trace-analysis-1"],
      technicalMetadata: { sourceAnalysisIds: ["analysis-1"], sourceEvidenceIds: ["ev-1"] },
    },
    prospectiveAnalysis: {
      tendencia: "PERSISTENCIA",
      escenario: "PERSISTENCIA",
      factoresSoporte: ["factor prospectivo"],
      factoresContradiccion: [],
      nivelConfianza: "ALTO",
      incertidumbre: "MODERADA",
      vigencia: "2026-12-31",
      limitaciones: [],
      relacionHipotesis: "SOPORTA LA HIPOTESIS",
      traceabilityIds: ["trace-pap-1"],
      excludedProducts: [],
      technicalMetadata: { sourceProductIds: ["pap-1"] },
    },
    decisionImplications: [{ hallazgoRelacionado: "Concentracion gobernada en acceso oriental" }],
    visualCandidates: [governedMap],
    technicalAnnex: {},
    selectionAudit: {},
    presentation: { visibleText: [] },
    technicalMetadata: { sourceProjectId: "project-technical-id" },
    ...overrides,
  };
}

function institutionalInput(overrides: any = {}) {
  const geo = overrides.geography ?? geography("INDIVIDUAL");
  return {
    projectId: "project-technical-id",
    generatedAt,
    geography: geo,
    evidence: [],
    findings: [],
    analyses: [],
    osint: [],
    streetView: [],
    temporalComparisons: [],
    predictiveAnalyticalProducts: [],
    visualProducts: [],
    exclusions: [],
    disclosures: [],
    lineageSummary: { geographyId: geo?.geographyId ?? null, sourceIds: [], evidenceIds: [], findingIds: [], analysisIds: [], conclusionIds: [], itemCount: 0 },
    traceabilityGate: {},
    publicationEligibility: "ELIGIBLE",
    ...overrides,
  };
}

function analyticalDenueVisual(geo: CanonicalProjectGeography) {
  return {
    visualId: "analytical-map",
    visualType: "ANALYTICAL_DENUE_MAP",
    documentIntegrationKind: DENUE_ANALYTICAL_DOCUMENT_KIND,
    title: "Relaciones analiticas aceptadas",
    caption: "Relaciones PPC admitidas; proximidad no implica causalidad.",
    visualReference: "asset://analytical-map",
    geographyId: geo.geographyId,
    traceabilityIds: ["trace-accepted-relation"],
    publicationEligibility: "ELIGIBLE",
  };
}

function analyticalMapModel(geo: CanonicalProjectGeography, analytical: any, otherVisuals: any[] = []) {
  return executiveModel({
    geography: geo,
    keyEvidence: [],
    territorialSituation: { ...executiveModel({ geography: geo }).territorialSituation, principalMapCandidate: analytical },
    visualCandidates: [analytical, ...otherVisuals],
  });
}

describe("H.2F.1R.1 - principal B.5 y secundario B.6G", () => {
  test("B.5 sin B.6G conserva el mapa territorial principal", () => {
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [] }), institutionalInput());
    expect(composition.principalTerritorialMap.visualReference).toBe("asset://map-1");
    expect(composition.secondaryVisuals).toEqual([]);
  });

  test("B.6G primero nunca sustituye al mapa territorial compatible B.5", () => {
    const geo = geography("POLYGON");
    const analytical = analyticalDenueVisual(geo);
    const territorial = visualCandidate({ geographyId: geo.geographyId });
    const composition = buildExecutiveVisualComposition(
      analyticalMapModel(geo, analytical, [territorial]),
      institutionalInput({ geography: geo, visualProducts: [analytical] })
    );
    expect(composition.principalTerritorialMap.status).toBe("READY_FROM_GOVERNED_VISUAL");
    expect(composition.principalTerritorialMap.visualReference).toBe(territorial.reference);
    expect(composition.secondaryVisuals).toEqual([expect.objectContaining({ visualId: analytical.visualId, visualType: "SECONDARY_MAP" })]);
  });

  test("solo B.6G mantiene render principal requerido desde geografia canonica", () => {
    const geo = geography("POLYGON");
    const analytical = analyticalDenueVisual(geo);
    const composition = buildExecutiveVisualComposition(analyticalMapModel(geo, analytical), institutionalInput({ geography: geo, visualProducts: [analytical] }));
    expect(composition.principalTerritorialMap.status).toBe("MAP_RENDER_REQUIRED");
    expect(composition.principalTerritorialMap.visualReference).toBeNull();
    expect(composition.principalTerritorialMap.technicalMetadata.geometry).toEqual(geo.geometry);
    expect(composition.secondaryVisuals[0]).toEqual(expect.objectContaining({ visualId: analytical.visualId, visualType: "SECONDARY_MAP" }));
  });

  test.each(["documentIntegrationKind", "technicalMetadata"])("discriminante %s bloquea promocion incluso bajo tipo MAP", (location) => {
    const geo = geography("POLYGON");
    const analytical: any = { ...analyticalDenueVisual(geo), visualType: "MAP" };
    if (location === "technicalMetadata") {
      delete analytical.documentIntegrationKind;
      analytical.technicalMetadata = { documentIntegrationKind: DENUE_ANALYTICAL_DOCUMENT_KIND };
    }
    const composition = buildExecutiveVisualComposition(analyticalMapModel(geo, analytical), institutionalInput({ geography: geo, visualProducts: [analytical] }));
    expect(composition.principalTerritorialMap.status).toBe("MAP_RENDER_REQUIRED");
  });

  test("proyeccion MAP ligada al producto B.6G tampoco es principal", () => {
    const geo = geography("POLYGON");
    const analytical = analyticalDenueVisual(geo);
    const projection = visualCandidate({ visualId: analytical.visualId, reference: analytical.visualReference, geographyId: geo.geographyId });
    const composition = buildExecutiveVisualComposition(analyticalMapModel(geo, projection), institutionalInput({ geography: geo, visualProducts: [analytical] }));
    expect(composition.principalTerritorialMap.status).toBe("MAP_RENDER_REQUIRED");
    expect(composition.secondaryVisuals[0].visualType).toBe("SECONDARY_MAP");
  });

  test("BAR LINE B.6G photo ocupan cuatro secundarios y exceso permanece determinista", () => {
    const geo = geography("POLYGON");
    const analytical = analyticalDenueVisual(geo);
    const territorial = visualCandidate({ geographyId: geo.geographyId });
    const charts = ["BAR", "LINE"].map((kind) => ({
      visualId: kind, visualType: "CHART", kind, title: kind, visualReference: `asset://${kind}`,
      traceabilityIds: [`trace-${kind}`], publicationEligibility: "ELIGIBLE",
      datasetSourceRefs: ["dataset-adr022"], variables: ["count"], transformation: "Descriptive frequency",
    }));
    const model = analyticalMapModel(geo, analytical, [territorial]);
    model.keyEvidence = [keyEvidence()];
    const input = institutionalInput({ geography: geo, visualProducts: [...charts, analytical] });
    const composition = buildExecutiveVisualComposition(model, input);
    expect(composition.principalTerritorialMap.visualReference).toBe(territorial.reference);
    expect(composition.secondaryVisuals.map((item) => item.visualId)).toEqual(["BAR", "LINE", analytical.visualId, "ev-1"]);
    expect(composition.visualBudget.used).toBe(5);
    model.keyEvidence.push(keyEvidence({ evidenceId: "extra", title: "Visual complementario", sourceTypes: [], visualReference: "asset://extra", traceabilityIds: ["trace-extra"] }));
    const overflow = buildExecutiveVisualComposition(model, input);
    expect(overflow.secondaryVisuals).toHaveLength(4);
    expect(overflow.selectionAudit.excludedItems).toContainEqual(expect.objectContaining({ itemId: "extra", reasonCode: "VISUAL_BUDGET_EXCEEDED" }));
    expect(buildExecutiveVisualComposition(model, input)).toEqual(overflow);
    expect(overflow.principalTerritorialMap.visualReference).toBe(territorial.reference);
  });
});

describe("Fase C - ExecutiveVisualComposition", () => {
  test("1 mapa principal siempre existe como candidato o render instruction", () => {
    expect(buildExecutiveVisualComposition(executiveModel(), institutionalInput()).principalTerritorialMap.status).toBe("READY_FROM_GOVERNED_VISUAL");
    const noMap = executiveModel({ visualCandidates: [], territorialSituation: { ...executiveModel().territorialSituation, principalMapCandidate: null } });
    expect(buildExecutiveVisualComposition(noMap, institutionalInput()).principalTerritorialMap.renderInstruction).toBe("MAP_RENDER_REQUIRED");
  });

  test("2 canonical POINT se conserva", () => {
    const geo = geography("INDIVIDUAL");
    const composition = buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo }));
    expect(composition.principalTerritorialMap.technicalMetadata.geometry?.type).toBe("Point");
    expect(composition.principalTerritorialMap.technicalMetadata.geographyId).toBe(geo.geographyId);
  });

  test("3 canonical CORRIDOR se conserva", () => {
    const geo = geography("CORRIDOR");
    expect(buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo })).principalTerritorialMap.technicalMetadata.geometry?.type).toBe("LineString");
  });

  test("4 POLYGON se conserva", () => {
    const geo = geography("POLYGON");
    expect(buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo })).principalTerritorialMap.technicalMetadata.geometry?.type).toBe("Polygon");
  });

  test("5 MULTIPOLYGON se conserva", () => {
    const geo = multipolygonGeography();
    const composition = buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo }));
    expect(composition.principalTerritorialMap.technicalMetadata.geometry?.type).toBe("MultiPolygon");
    expect(composition.principalTerritorialMap.technicalMetadata.geographyType).toBe("MULTIPOLYGON");
  });

  test("6 no usa center hardcoded", () => {
    const geo = geography("INDIVIDUAL");
    const center = buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo })).principalTerritorialMap.technicalMetadata.center;
    expect(center).toEqual({ lat: 22.1, lng: -101.9 });
    expect(center).not.toEqual({ lat: 21.885, lng: -102.291 });
  });

  test("7 no crea circulo desde pins", () => {
    const geo = geography("POLYGON");
    const metadata = buildExecutiveVisualComposition(executiveModel({ geography: geo }), institutionalInput({ geography: geo })).principalTerritorialMap.technicalMetadata as any;
    expect(metadata.geometry.type).toBe("Polygon");
    expect(metadata.radiusMeters).toBeUndefined();
  });

  test("8 maximo 5 visuales", () => {
    const visuals = Array.from({ length: 8 }, (_, index) => keyEvidence({
      evidenceId: `ev-${index}`,
      visualReference: `asset://photo-${index}`,
      traceabilityIds: [`trace-${index}`],
      relatedFindingIds: ["finding-1"],
      technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: `ev-${index}` },
    }));
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: visuals }), institutionalInput());
    expect(composition.visualBudget.used).toBeLessThanOrEqual(MAX_EXECUTIVE_VISUALS);
  });

  test("9 no rellena hasta 5 artificialmente", () => {
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [] }), institutionalInput());
    expect(composition.visualBudget.used).toBe(1);
    expect(composition.visualBudget.filledArtificially).toBe(false);
  });

  test("10 evidencia sin trazabilidad se excluye", () => {
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [keyEvidence({ traceabilityIds: [] })] }), institutionalInput());
    expect(composition.selectionAudit.reasonCodes).toContain("NO_TRACEABILITY");
  });

  test("11 visual sin relacion ejecutiva se excluye", () => {
    const unrelatedEvidence = keyEvidence({
      evidenceId: "ev-unrelated",
      evidenceReferences: ["ev-unrelated-ref"],
      relatedFindingIds: ["other"],
      technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: "ev-unrelated" },
    });
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [unrelatedEvidence] }), institutionalInput());
    expect(composition.selectionAudit.reasonCodes).toContain("NO_EXECUTIVE_RELATION");
  });

  test("12 duplicados se excluyen", () => {
    const duplicate = keyEvidence({ evidenceId: "ev-dup", visualReference: "asset://dup", traceabilityIds: ["trace-dup"], technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: "ev-dup" } });
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [duplicate, { ...duplicate, evidenceId: "ev-dup-2" }] }), institutionalInput());
    expect(composition.selectionAudit.reasonCodes).toContain("DUPLICATE");
  });

  test("13 diversidad visual preservada", () => {
    const visuals = Array.from({ length: 4 }, (_, index) => keyEvidence({
      evidenceId: `ev-photo-${index}`,
      visualReference: `asset://photo-${index}`,
      traceabilityIds: [`trace-photo-${index}`],
      relatedFindingIds: ["finding-1"],
      technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: `ev-photo-${index}` },
    }));
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: visuals }), institutionalInput());
    expect(composition.secondaryVisuals.filter((item) => item.visualType === "EVIDENCE_IMAGE").length).toBeLessThanOrEqual(2);
  });

  test("14 un titulo panoramico no reclasifica fotografia de campo como Street View", () => {
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [keyEvidence({ title: "Street View panorama" })] }), institutionalInput());
    expect(composition.secondaryVisuals[0]?.visualType).toBe("FIELD_PHOTOGRAPH");
    expect(composition.secondaryVisuals[0]?.presentation.visibleSourceLabel).toBe("Fotografía de campo");
    const visible = JSON.stringify([composition.principalTerritorialMap.presentation, ...composition.secondaryVisuals.map((item) => item.presentation)]);
    expect(visible).not.toContain("STREET VIEW INTELLIGENCE");
  });

  test("15 Street View exige procedencia estructurada y conserva fuente visible", () => {
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [keyEvidence({
      title: "Captura territorial",
      sourceTypes: ["STREET_VIEW"],
      presentation: { visibleSourceLabel: "Google Street View" },
    })] }), institutionalInput());
    expect(composition.secondaryVisuals[0]?.visualType).toBe("STREET_VIEW_CAPTURE");
    expect(composition.secondaryVisuals[0]?.presentation.visibleSourceLabel).toBe("Google Street View");
  });

  test("16 prospective visual solo con producto admitido", () => {
    const prospective = visualCandidate({
      visualId: "prospective-1",
      visualType: "PROSPECTIVE_SCENARIO",
      reference: "asset://prospective",
      traceabilityIds: ["trace-pap-1"],
      technicalMetadata: { sourceItemId: "pap-1", sourceType: "VISUAL_CANDIDATE" },
    });
    const blocked = executiveModel({ visualCandidates: [prospective], prospectiveAnalysis: { ...executiveModel().prospectiveAnalysis, technicalMetadata: { sourceProductIds: [] } } });
    expect(buildExecutiveVisualComposition(blocked, institutionalInput()).selectionAudit.reasonCodes).toContain("CONTEXT_ONLY");
    expect(buildExecutiveVisualComposition(executiveModel({ visualCandidates: [prospective] }), institutionalInput()).secondaryVisuals.some((item) => item.visualType === "PROSPECTIVE_SCENARIO")).toBe(true);
  });

  test("17 no genera probabilidades criminales", () => {
    const text = JSON.stringify(buildExecutiveVisualComposition(executiveModel(), institutionalInput())).toLowerCase();
    expect(text).not.toMatch(/probabilidad criminal|probabilidad de delito|%/);
  });

  test("18 no genera prediccion individual", () => {
    const text = JSON.stringify(buildExecutiveVisualComposition(executiveModel(), institutionalInput())).toLowerCase();
    expect(text).not.toMatch(/predicci[oó]n individual|culpabilidad|reincidencia individual|ocurrir[aá] el delito/);
  });

  test("19 headline procede de hallazgo gobernado o fallback neutro", () => {
    expect(buildExecutiveVisualComposition(executiveModel(), institutionalInput()).principalTerritorialMap.executiveHeadline).toBe("Concentracion gobernada en acceso oriental");
    expect(buildExecutiveVisualComposition(executiveModel({ findings: [] }), institutionalInput()).principalTerritorialMap.executiveHeadline).toBe("CONFIGURACIÓN TERRITORIAL DEL ÁREA ANALIZADA");
    const base = executiveModel();
    expect(buildExecutiveVisualComposition(executiveModel({
      findings: [],
      visualCandidates: [],
      territorialSituation: { ...base.territorialSituation, principalMapCandidate: null },
    }), institutionalInput()).principalTerritorialMap.caption)
      .toBe("Representación territorial derivada de la geografía canónica.");
  });

  test("20 visual conserva traceabilityIds internamente", () => {
    const composition = buildExecutiveVisualComposition(executiveModel(), institutionalInput());
    expect(composition.secondaryVisuals[0]?.technicalMetadata.traceabilityIds).toContain("trace-ev-1");
  });

  test("21 IDs tecnicos no aparecen en presentacion", () => {
    const composition = buildExecutiveVisualComposition(executiveModel(), institutionalInput());
    const visible = JSON.stringify([composition.principalTerritorialMap.presentation, ...composition.secondaryVisuals.map((item) => item.presentation)]);
    expect(visible).not.toContain("project-technical-id");
    expect(visible).not.toContain("trace-ev-1");
    expect(visible).not.toContain("ev-1");
  });

  test("22 deterministic output", () => {
    expect(buildExecutiveVisualComposition(executiveModel(), institutionalInput())).toEqual(buildExecutiveVisualComposition(executiveModel(), institutionalInput()));
  });

  test("23 no llamadas externas", () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => { throw new Error("external call"); }) as any;
    expect(() => buildExecutiveVisualComposition(executiveModel(), institutionalInput())).not.toThrow();
    global.fetch = originalFetch;
  });

  test("24 Fase B regresion pasa", () => {
    const input = institutionalInput({
      findings: [],
      evidence: [],
      visualProducts: [],
      predictiveAnalyticalProducts: [],
    });
    const model = buildExecutiveGeointReportModel(input as any, { documentIdentity: { numeroExpediente: "06092026-0001-PPC" }, now: generatedAt });
    expect(model.identity.numeroExpediente).toBe("06092026-0001-PPC");
  });

  test("25A ADR-022 admite dos charts descriptivos gobernados", () => {
    const chart = (
      visualId: string,
      kind: string,
      title: string,
      variables: string[]
    ) => ({
      id: visualId,
      visualId,
      visualType: "CHART",
      kind,
      title,
      caption: title,
      sourceType: "ADR-022_CRIME_INCIDENCE",
      sourceItemIds: ["dataset-adr022"],
      datasetSourceRefs: ["dataset-adr022"],
      variables,
      transformation: `ADR-022:${kind}`,
      assetRef: `data:image/png;base64,${visualId}`,
      findingIds: [],
      evidenceIds: [],
      analysisIds: [],
      assertionIds: [],
      publicationEligibility: "ELIGIBLE",
    });

    const input = institutionalInput({
      visualProducts: [
        chart(
          "crime-incidence-type-distribution:dataset-adr022",
          "INCIDENT_TYPE_DISTRIBUTION",
          "Distribucion de incidencia por tipo",
          ["incidentType", "count", "percentage"]
        ),
        chart(
          "crime-incidence-temporal-evolution:dataset-adr022",
          "TEMPORAL_EVOLUTION",
          "Evolucion temporal de la incidencia",
          ["occurredDate", "count"]
        ),
      ],
    });

    const composition = buildExecutiveVisualComposition(
      executiveModel({
        keyEvidence: [],
        visualCandidates: [],
      }),
      input
    );

    const chartVisuals = composition.secondaryVisuals.filter(
      (item) => item.visualType === "STATISTICAL_CHART"
    );

    expect(chartVisuals.map((item) => item.visualId)).toEqual(
      expect.arrayContaining([
        "crime-incidence-type-distribution:dataset-adr022",
        "crime-incidence-temporal-evolution:dataset-adr022",
      ])
    );

    expect(chartVisuals).toHaveLength(2);

    expect(
      chartVisuals.find(
        (item) =>
          item.visualId ===
          "crime-incidence-type-distribution:dataset-adr022"
      )?.executiveHeadline
    ).toBe("Distribucion de incidencia por tipo");

    expect(
      chartVisuals.every((item) =>
        item.technicalMetadata.traceabilityIds.includes(
          "dataset-adr022"
        )
      )
    ).toBe(true);
  });

  test("25A.1 ADR-022 reserva BAR + LINE aunque existan visuales previos", () => {
    const priorVisuals = Array.from({ length: 12 }, (_, index) => ({
      id: `prior-visual-${index + 1}`,
      visualId: `prior-visual-${index + 1}`,
      visualType: "CHART",
      kind: `LEGACY_CHART_${index + 1}`,
      title: `Visual previo ${index + 1}`,
      caption: `Visual previo ${index + 1}`,
      sourceItemIds: [`legacy-source-${index + 1}`],
      datasetSourceRefs: [],
      variables: [],
      transformation: null,
      assetRef: `data:image/png;base64,prior-${index + 1}`,
      publicationEligibility: "ELIGIBLE",
    }));
    const governedChart = (
      visualId: string,
      kind: "INCIDENT_TYPE_DISTRIBUTION" | "TEMPORAL_EVOLUTION"
    ) => ({
      id: visualId,
      visualId,
      visualType: "CHART",
      kind,
      title: kind === "INCIDENT_TYPE_DISTRIBUTION"
        ? "Distribución de incidencia por tipo"
        : "Evolución temporal observada de la incidencia",
      caption: "Producto descriptivo ADR-022",
      sourceItemIds: ["incidencia_estadistica"],
      datasetSourceRefs: ["incidencia_estadistica"],
      variables: kind === "INCIDENT_TYPE_DISTRIBUTION"
        ? ["incidentType", "count", "percentage"]
        : ["occurredDate", "count"],
      transformation: `ADR-022:${kind}`,
      assetRef: `data:image/png;base64,${visualId}`,
      publicationEligibility: "ELIGIBLE",
    });
    const chartIds = [
      "crime-incidence-type-distribution:incidencia_estadistica",
      "crime-incidence-temporal-evolution:incidencia_estadistica",
    ];
    const input = institutionalInput({
      visualProducts: [
        ...priorVisuals,
        governedChart(chartIds[0], "INCIDENT_TYPE_DISTRIBUTION"),
        governedChart(chartIds[1], "TEMPORAL_EVOLUTION"),
      ],
    });

    const composition = buildExecutiveVisualComposition(
      executiveModel({
        keyEvidence: Array.from({ length: 4 }, (_, index) => ({
          evidenceId: `priority-evidence-${index + 1}`,
          title: `Evidencia prioritaria ${index + 1}`,
          summary: "Evidencia gobernada",
          visualReference: `data:image/png;base64,evidence-${index + 1}`,
          traceabilityIds: [`trace-evidence-${index + 1}`],
          relatedFindingIds: ["finding-1"],
          evidenceReferences: [`priority-evidence-${index + 1}`],
          technicalMetadata: {
            sourceItemId: `priority-evidence-${index + 1}`,
          },
        })),
        visualCandidates: [],
      }),
      input
    );

    expect(composition.selectionAudit.selectedIds).toEqual(
      expect.arrayContaining(chartIds)
    );
    expect(composition.secondaryVisuals).toHaveLength(4);
  });

  test("25B ADR-022 no admite chart sin contrato descriptivo trazable", () => {
    const input = institutionalInput({
      visualProducts: [
        {
          id: "chart-orphan",
          visualId: "chart-orphan",
          visualType: "CHART",
          kind: "INCIDENT_TYPE_DISTRIBUTION",
          title: "Chart sin dataset",
          caption: "Chart sin dataset",
          sourceType: "ADR-022_CRIME_INCIDENCE",
          sourceItemIds: [],
          datasetSourceRefs: [],
          variables: ["incidentType", "count"],
          transformation: "groupBy incidentType",
          assetRef: "data:image/png;base64,orphan",
          findingIds: [],
          evidenceIds: [],
          analysisIds: [],
          assertionIds: [],
          publicationEligibility: "ELIGIBLE",
        },
      ],
    });

    const composition = buildExecutiveVisualComposition(
      executiveModel({
        keyEvidence: [],
        visualCandidates: [],
      }),
      input
    );

    expect(
      composition.secondaryVisuals.some(
        (item) => item.visualId === "chart-orphan"
      )
    ).toBe(false);

    expect(
      composition.selectionAudit.excludedItems.some(
        (item) =>
          item.itemId === "chart-orphan" &&
          (
            item.reasonCode === "NO_TRACEABILITY" ||
            item.reasonCode === "NO_EXECUTIVE_RELATION"
          )
      )
    ).toBe(true);
  });

  test("25C ADR-022 no duplica el mismo subtipo estadistico", () => {
    const base = {
      visualType: "CHART",
      kind: "INCIDENT_TYPE_DISTRIBUTION",
      sourceType: "ADR-022_CRIME_INCIDENCE",
      sourceItemIds: ["dataset-adr022"],
      datasetSourceRefs: ["dataset-adr022"],
      variables: ["incidentType", "count"],
      transformation: "groupBy incidentType",
      findingIds: [],
      evidenceIds: [],
      analysisIds: [],
      assertionIds: [],
      publicationEligibility: "ELIGIBLE",
    };

    const input = institutionalInput({
      visualProducts: [
        {
          ...base,
          id: "chart-type-1",
          visualId: "chart-type-1",
          title: "Distribucion 1",
          caption: "Distribucion 1",
          assetRef: "data:image/png;base64,chart1",
        },
        {
          ...base,
          id: "chart-type-2",
          visualId: "chart-type-2",
          title: "Distribucion 2",
          caption: "Distribucion 2",
          assetRef: "data:image/png;base64,chart2",
        },
      ],
    });

    const composition = buildExecutiveVisualComposition(
      executiveModel({
        keyEvidence: [],
        visualCandidates: [],
      }),
      input
    );

    const selected = composition.secondaryVisuals.filter(
      (item) => item.visualType === "STATISTICAL_CHART"
    );

    expect(selected).toHaveLength(1);

    expect(
      composition.selectionAudit.excludedItems.some(
        (item) =>
          item.reasonCode === "LOW_EXECUTIVE_VALUE"
      )
    ).toBe(true);
  });
  test("25 ADR-022 regresion pasa", () => {
    const input = institutionalInput({ evidence: [{ evidenceId: "ev-governed", traceabilityIds: ["trace-governed"] }] });
    expect(buildExecutiveVisualComposition(executiveModel(), input).technicalMetadata.source).toBe("ExecutiveGeointReportModel+InstitutionalReportInput");
  });

  test("26 ADR-025 regresion pasa", () => {
    const prospective = visualCandidate({
      visualId: "prospective-1",
      visualType: "PROSPECTIVE_SCENARIO",
      reference: "asset://prospective",
      traceabilityIds: ["trace-pap-1"],
      technicalMetadata: { sourceItemId: "pap-1", sourceType: "VISUAL_CANDIDATE" },
    });
    const model = executiveModel({ visualCandidates: [prospective] });
    expect(model.prospectiveAnalysis.technicalMetadata.sourceProductIds).toContain("pap-1");
    expect(buildExecutiveVisualComposition(model, institutionalInput()).secondaryVisuals.some((item) => item.visualType === "PROSPECTIVE_SCENARIO")).toBe(true);
  });

  test("27 TypeScript pasa mediante contrato tipado", () => {
    const used: number = buildExecutiveVisualComposition(executiveModel(), institutionalInput()).visualBudget.used;
    expect(used).toBeGreaterThanOrEqual(1);
  });

  test("28 build pasa con contrato sin render final", () => {
    const composition = buildExecutiveVisualComposition(executiveModel(), institutionalInput());
    expect(composition.technicalMetadata.rendersFinalAssets).toBe(false);
    expect(composition.technicalMetadata.externalCalls).toBe(false);
  });

  test("29 mapa con geographyId correcto entra", () => {
    const geo = geography("POLYGON");
    const map = visualCandidate({ geographyId: geo.geographyId, technicalMetadata: { sourceItemId: "map-compatible", sourceType: "VISUAL_CANDIDATE", geographyId: geo.geographyId } });
    const model = executiveModel({ geography: geo, territorialSituation: { ...executiveModel({ geography: geo }).territorialSituation, principalMapCandidate: map }, visualCandidates: [map] });
    expect(buildExecutiveVisualComposition(model, institutionalInput({ geography: geo })).principalTerritorialMap.status).toBe("READY_FROM_GOVERNED_VISUAL");
  });

  test("30 mapa con geographyId distinto se rechaza", () => {
    const geo = geography("POLYGON");
    const map = visualCandidate({ geographyId: "geo-ajena", technicalMetadata: { sourceItemId: "map-mismatch", sourceType: "VISUAL_CANDIDATE", geographyId: "geo-ajena" } });
    const model = executiveModel({ geography: geo, territorialSituation: { ...executiveModel({ geography: geo }).territorialSituation, principalMapCandidate: map }, visualCandidates: [map] });
    const composition = buildExecutiveVisualComposition(model, institutionalInput({ geography: geo }));
    expect(composition.principalTerritorialMap.renderInstruction).toBe("MAP_RENDER_REQUIRED");
    expect(composition.selectionAudit.reasonCodes).toContain("GEOGRAPHY_MISMATCH");
  });

  test("31 mapa sin vinculacion territorial verificable cae a MAP_RENDER_REQUIRED", () => {
    const geo = geography("POLYGON");
    const map = visualCandidate({ technicalMetadata: { sourceItemId: "map-no-geo", sourceType: "VISUAL_CANDIDATE" } });
    const model = executiveModel({ geography: geo, territorialSituation: { ...executiveModel({ geography: geo }).territorialSituation, principalMapCandidate: map }, visualCandidates: [map] });
    const composition = buildExecutiveVisualComposition(model, institutionalInput({ geography: geo }));
    expect(composition.principalTerritorialMap.status).toBe("MAP_RENDER_REQUIRED");
    expect(composition.selectionAudit.reasonCodes).toContain("MAP_RENDER_REQUIRED");
  });

  test("32 visual sin finding relacionado usa fallback neutro", () => {
    const secondary = visualCandidate({
      visualId: "temporal-no-finding",
      visualType: "TEMPORAL_COMPARISON",
      reference: "asset://temporal-no-finding",
      relatedFindingIds: [],
      traceabilityIds: ["trace-temporal"],
      technicalMetadata: { sourceItemId: "temporal-no-finding", sourceType: "VISUAL_CANDIDATE" },
    });
    const composition = buildExecutiveVisualComposition(executiveModel({ visualCandidates: [secondary] }), institutionalInput());
    expect(composition.secondaryVisuals.find((item) => item.visualId === "temporal-no-finding")?.executiveHeadline).toBe("CONFIGURACIÓN TERRITORIAL DEL ÁREA ANALIZADA");
    expect(buildExecutiveVisualComposition(executiveModel({ findings: [] }), institutionalInput()).principalTerritorialMap.executiveHeadline).toBe("CONFIGURACIÓN TERRITORIAL DEL ÁREA ANALIZADA");
  });

  test("33 relatedFinding valido usa headline correcto", () => {
    const findings = [finding("finding-1"), { ...finding("finding-2"), title: "Hallazgo territorial occidental" }];
    const visual = keyEvidence({ relatedFindingIds: ["finding-2"], evidenceReferences: ["ev-1"] });
    const composition = buildExecutiveVisualComposition(executiveModel({ findings, keyEvidence: [visual] }), institutionalInput());
    expect(composition.secondaryVisuals[0]?.executiveHeadline).toBe("Hallazgo territorial occidental");
  });

  test("34 no usa primer finding como fallback", () => {
    const findings = [finding("finding-primero"), { ...finding("finding-segundo"), title: "Hallazgo segundo" }];
    const visual = visualCandidate({
      visualId: "trend-1",
      visualType: "TREND_VISUAL",
      reference: "asset://trend",
      relatedFindingIds: ["finding-inexistente"],
      traceabilityIds: ["trace-trend"],
      technicalMetadata: { sourceItemId: "trend-1", sourceType: "VISUAL_CANDIDATE" },
    });
    const composition = buildExecutiveVisualComposition(executiveModel({ findings, visualCandidates: [visual] }), institutionalInput());
    expect(composition.secondaryVisuals.find((item) => item.visualId === "trend-1")?.executiveHeadline).toBe("CONFIGURACIÓN TERRITORIAL DEL ÁREA ANALIZADA");
  });

  test("35 prospective visual relacionado entra", () => {
    const prospective = visualCandidate({
      visualId: "prospective-linked",
      visualType: "PROSPECTIVE_SCENARIO",
      reference: "asset://prospective-linked",
      traceabilityIds: ["trace-pap-1"],
      technicalMetadata: { sourceItemId: "pap-1", sourceType: "VISUAL_CANDIDATE" },
    });
    expect(buildExecutiveVisualComposition(executiveModel({ visualCandidates: [prospective] }), institutionalInput()).secondaryVisuals.some((item) => item.visualId === "prospective-linked")).toBe(true);
  });

  test("36 prospective visual no relacionado no entra", () => {
    const prospective = visualCandidate({
      visualId: "prospective-unlinked",
      visualType: "PROSPECTIVE_SCENARIO",
      reference: "asset://prospective-unlinked",
      traceabilityIds: ["trace-other"],
      technicalMetadata: { sourceItemId: "pap-other", sourceType: "VISUAL_CANDIDATE" },
    });
    const composition = buildExecutiveVisualComposition(executiveModel({ visualCandidates: [prospective] }), institutionalInput());
    expect(composition.secondaryVisuals.some((item) => item.visualId === "prospective-unlinked")).toBe(false);
    expect(composition.selectionAudit.reasonCodes).toContain("CONTEXT_ONLY");
  });

  test("37 producto prospectivo A no habilita visual prospectivo B", () => {
    const prospective = visualCandidate({
      visualId: "prospective-b",
      visualType: "PROSPECTIVE_SCENARIO",
      reference: "asset://prospective-b",
      traceabilityIds: ["trace-pap-b"],
      technicalMetadata: { sourceItemId: "pap-b", sourceType: "VISUAL_CANDIDATE" },
    });
    const model = executiveModel({
      visualCandidates: [prospective],
      prospectiveAnalysis: { ...executiveModel().prospectiveAnalysis, traceabilityIds: ["trace-pap-a"], technicalMetadata: { sourceProductIds: ["pap-a"] } },
    });
    expect(buildExecutiveVisualComposition(model, institutionalInput()).secondaryVisuals.some((item) => item.visualId === "prospective-b")).toBe(false);
  });

  test("38 presupuesto total sigue en cinco visuales maximo", () => {
    const visuals = Array.from({ length: 10 }, (_, index) => keyEvidence({
      evidenceId: `ev-budget-${index}`,
      visualReference: `asset://budget-${index}`,
      traceabilityIds: [`trace-budget-${index}`],
      relatedFindingIds: ["finding-1"],
      technicalMetadata: { originalItemType: "EVIDENCE", sourceItemId: `ev-budget-${index}` },
    }));
    const composition = buildExecutiveVisualComposition(executiveModel({ keyEvidence: visuals }), institutionalInput());
    expect(1 + composition.secondaryVisuals.length).toBeLessThanOrEqual(5);
  });

  test("39 conserva visibleSourceLabel explicito sin exponer referencias tecnicas", () => {
    const visual = keyEvidence({ presentation: { visibleSourceLabel: "Unidad de Análisis Territorial CEIPOL" } });
    const selected = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [visual] }), institutionalInput()).secondaryVisuals[0];
    expect(selected.presentation.visibleSourceLabel).toBe("Unidad de Análisis Territorial CEIPOL");
  });

  test("40 un visual generico sin fuente no recibe procedencia inventada", () => {
    const visual = keyEvidence({ sourceTypes: [], title: "Visual complementario" });
    const selected = buildExecutiveVisualComposition(executiveModel({ keyEvidence: [visual] }), institutionalInput()).secondaryVisuals[0];
    expect(selected.visualType).toBe("EVIDENCE_IMAGE");
    expect(selected.presentation.visibleSourceLabel).toBeNull();
  });

  test("41 mapa generado declara fuente, geometria y leyenda derivables sin fabricar escala", () => {
    const geo = geography("CORRIDOR");
    const noMap = executiveModel({
      geography: geo,
      visualCandidates: [],
      territorialSituation: { ...executiveModel({ geography: geo }).territorialSituation, principalMapCandidate: null },
    });
    const map = buildExecutiveVisualComposition(noMap, institutionalInput({ geography: geo })).principalTerritorialMap;
    expect(map.status).toBe("MAP_RENDER_REQUIRED");
    expect(map.presentation.visibleSourceLabel).toContain("Google Maps");
    expect(map.presentation.cartographicMetadata).toEqual({
      geometryLabel: "Corredor territorial",
      legendLabel: "Trazo azul: corredor territorial analizado",
      scaleLabel: null,
      orientationLabel: null,
    });
  });

  test("42 mapa raster sin metadata editorial no inventa fuente leyenda escala u orientacion", () => {
    const geo = geography("POLYGON");
    const mapCandidate = visualCandidate({
      geographyId: geo.geographyId,
      technicalMetadata: { sourceItemId: "map-incomplete", sourceType: "VISUAL_CANDIDATE", geographyId: geo.geographyId },
    });
    const model = executiveModel({
      geography: geo,
      territorialSituation: { ...executiveModel({ geography: geo }).territorialSituation, principalMapCandidate: mapCandidate },
      visualCandidates: [mapCandidate],
    });
    const map = buildExecutiveVisualComposition(model, institutionalInput({ geography: geo })).principalTerritorialMap;
    expect(map.status).toBe("READY_FROM_GOVERNED_VISUAL");
    expect(map.presentation.visibleSourceLabel).toBeNull();
    expect(map.presentation.cartographicMetadata).toEqual(expect.objectContaining({
      geometryLabel: "Polígono territorial",
      legendLabel: null,
      scaleLabel: null,
      orientationLabel: null,
    }));
  });

  test("43 mapa generado deriva scaleLabel exclusivamente del spec gobernado", () => {
    const geo = geography("CORRIDOR");
    const noMap = executiveModel({
      geography: geo,
      visualCandidates: [],
      territorialSituation: { ...executiveModel({ geography: geo }).territorialSituation, principalMapCandidate: null },
    });
    const spec = buildExecutiveCanonicalTerritorialMapSpec(geo);
    const map = buildExecutiveVisualComposition(noMap, institutionalInput({ geography: geo }), { principalMapSpec: spec }).principalTerritorialMap;
    expect(map.presentation.cartographicMetadata?.scaleLabel).toBe(spec.cartographicScale.label);
    expect(map.technicalMetadata.cartographicScale).toEqual(spec.cartographicScale);
  });
});
