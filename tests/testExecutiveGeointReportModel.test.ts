import {
  buildExecutiveGeointReportModel,
  EXECUTIVE_GEOINT_LIMITS,
  type ExecutiveGeointReportBuildContext,
} from "../src/utils/executiveGeointReportModel";
import type { InstitutionalReportInput } from "../src/utils/institutionalReportPublicationContract";
import type { PredictiveAnalyticalProduct } from "../src/utils/predictiveAnalyticalProducts";

const generatedAt = "2026-09-06T12:00:00.000Z";

function baseLineage(id: string) {
  return [{ type: "EVIDENCE", id, evidenceId: id, sourceId: `src-${id}`, traceabilityId: `trace-${id}`, geographyId: "geo-1" }];
}

function predictiveProduct(overrides: Partial<PredictiveAnalyticalProduct> = {}): PredictiveAnalyticalProduct {
  return {
    productId: "pap-1",
    expedienteId: "project-uuid-123",
    geographyId: "geo-1",
    canonicalGeographyType: "POINT",
    productType: "SPATIAL_PERSISTENCE_OUTLOOK",
    analyticalLevel: "PROSPECTIVE_SCENARIO",
    trend: "STABLE",
    scenario: "PERSISTENCE",
    supportingConvergences: ["conv-1"],
    contradictingConvergences: ["conv-2"],
    supportingFactors: ["convergencia territorial aprobada"],
    contradictingFactors: ["fuente de campo no observó actividad"],
    assumptions: [],
    limitations: ["No constituye certeza de ocurrencia futura."],
    confidence: 0.74,
    confidenceBasis: "basis",
    uncertaintyLevel: "MODERATE",
    uncertaintyReasons: ["brecha temporal"],
    temporalWindow: {
      analysisWindowStart: "2026-08-01T00:00:00.000Z",
      analysisWindowEnd: "2026-09-01T00:00:00.000Z",
      generatedAt,
      validUntil: "2026-11-06T00:00:00.000Z",
      temporalAssumptions: [],
    },
    validUntil: "2026-11-06T00:00:00.000Z",
    hypothesisRelation: "SUPPORTS",
    fieldStatus: "fieldSupport",
    epistemicRole: "ANALYTICAL_PROJECTION",
    humanReviewStatus: "APPROVED",
    reviewedBy: "PPC",
    reviewedAt: generatedAt,
    reviewComment: null,
    lineage: baseLineage("ev-1") as any,
    traceabilityIds: ["trace-pap-1"],
    producedFromApprovedConvergences: true,
    blockingReasons: [],
    producedPersonalPrediction: false,
    producedCrimeOccurrenceCertainty: false,
    ...overrides,
  };
}

function institutionalInput(overrides: Partial<InstitutionalReportInput> = {}): InstitutionalReportInput {
  const findings = Array.from({ length: 7 }, (_, index) => ({
    findingId: `finding-${index + 1}`,
    title: `Hallazgo ${index + 1}`,
    summary: `Resumen gobernado ${index + 1}`,
    evidenceIds: [`ev-${index + 1}`],
    supportingFactors: [`factor soporte ${index + 1}`],
    contradictingFactors: index === 0 ? ["contradiccion conservada"] : [],
    interpretation: `Interpretacion ${index + 1}`,
    implication: `Implicacion ${index + 1}`,
    confidence: index === 0 ? 0.82 : 0.61,
    limitations: index === 0 ? ["limitacion conservada"] : [],
    traceabilityIds: [`trace-finding-${index + 1}`],
    publicationEligibility: {
      eligibility: "ELIGIBLE",
      role: "INSTITUTIONAL_FACT",
      lineageRefs: { evidenceIds: [`ev-${index + 1}`], findingIds: [`finding-${index + 1}`], analysisIds: [], sourceIds: [], conclusionIds: [] },
    },
  }));

  const evidence = Array.from({ length: 6 }, (_, index) => ({
    evidenceId: `ev-${index + 1}`,
    title: `Evidencia ${index + 1}`,
    summary: `Soporte visual ${index + 1}`,
    dataUrl: `data:image/png;base64,${index + 1}`,
    findingIds: [`finding-${index + 1}`],
    sourceType: index % 2 === 0 ? "STREET_VIEW" : "DENUE",
    traceabilityIds: [`trace-ev-${index + 1}`],
    publicationEligibility: {
      eligibility: "ELIGIBLE",
      role: "INSTITUTIONAL_FACT",
      lineageRefs: { evidenceIds: [`ev-${index + 1}`], findingIds: [`finding-${index + 1}`], analysisIds: [], sourceIds: [`src-${index + 1}`], conclusionIds: [] },
    },
  }));

  return {
    projectId: "project-uuid-123",
    reportReadyAssessment: {} as any,
    generatedAt,
    geography: {
      geographyId: "geo-1",
      type: "INDIVIDUAL",
      geometry: { type: "Point", coordinates: [-102.3, 21.88] },
      source: "PROJECT_CREATION",
      validationStatus: "VALID",
      createdAt: 1,
      updatedAt: 1,
      limitations: [],
    },
    hypothesis: {
      currentHypothesis: "Hipotesis institucional aprobada",
    } as any,
    evidence,
    findings,
    inferences: [],
    analyses: [{
      analysisId: "analysis-1",
      summary: "Analisis multifuente gobernado",
      convergences: ["convergencia conservada"],
      contradictions: ["contradiccion multifuente"],
      independentSources: ["src-a", "src-b"],
      sourceDependencies: [{ reason: "dependencia parcial documentada" }],
      informationGaps: ["brecha conservada"],
      traceabilityIds: ["trace-analysis-1"],
      evidenceIds: ["ev-1", "ev-2"],
      publicationEligibility: {
        eligibility: "ELIGIBLE",
        role: "ANALYSIS",
        lineageRefs: { evidenceIds: ["ev-1", "ev-2"], findingIds: ["finding-1"], analysisIds: ["analysis-1"], sourceIds: ["src-a", "src-b"], conclusionIds: [] },
      },
    }],
    conclusions: [],
    osint: [{ id: "poi-1", name: "POI gobernado", traceabilityIds: ["trace-poi-1"] }],
    streetView: [],
    temporalComparisons: [],
    specializedIntelligence: [],
    predictiveAnalyticalProducts: [predictiveProduct()],
    predictiveAnalyticalNarrative: "Narrativa prospectiva gobernada",
    visualProducts: [{
      visualId: "map-1",
      title: "Mapa candidato",
      visualType: "MAP",
      dataUrl: "data:image/png;base64,map",
      findingIds: ["finding-1"],
      traceabilityIds: ["trace-map-1"],
      publicationEligibility: { eligibility: "ELIGIBLE", role: "INSTITUTIONAL_FACT" },
    }],
    exclusions: [],
    disclosures: [],
    lineageSummary: {
      geographyId: "geo-1",
      sourceIds: ["src-a", "src-b", "src-c"],
      evidenceIds: ["ev-1", "ev-2", "ev-3"],
      findingIds: ["finding-1"],
      analysisIds: ["analysis-1"],
      conclusionIds: [],
      itemCount: 7,
    },
    traceabilityGate: {} as any,
    publicationEligibility: "ELIGIBLE",
    draft: false,
    certified: false,
    published: false,
    ...overrides,
  };
}

function context(overrides: Partial<ExecutiveGeointReportBuildContext> = {}): ExecutiveGeointReportBuildContext {
  return {
    documentIdentity: {
      numeroExpediente: "06092026-0007-JMG",
      ceipolId: "CEIPOL/000007/06/09/2026",
      projectId: "project-uuid-123",
      name: "Zona Centro",
    },
    nombreExpediente: "Zona Centro",
    fecha: "2026-09-06",
    personaPerfiladora: "JMG",
    clasificacion: "CONFIDENCIAL",
    vigenciaAnalisis: "2026-11-06",
    now: generatedAt,
    ...overrides,
  };
}

describe("ExecutiveGeointReportModel", () => {
  test("1 identidad documental correcta", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.identity.numeroExpediente).toBe("06092026-0007-JMG");
    expect(model.identity.nombreExpediente).toBe("Zona Centro");
  });

  test("2 no usa projectId como numero visible", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context({ documentIdentity: { projectId: "project-uuid-123" } }));
    expect(model.identity.numeroExpediente).toBe("NO ASIGNADO");
    expect(model.presentation.visibleText.join("\n")).not.toContain("project-uuid-123");
  });

  test("3 maximo 5 hallazgos clave", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.panorama.hallazgosClave).toHaveLength(EXECUTIVE_GEOINT_LIMITS.hallazgosClave);
  });

  test("4 maximo 5 decisiones", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.decisionImplications).toHaveLength(EXECUTIVE_GEOINT_LIMITS.decisionesSugeridas);
  });

  test("5 maximo 4 evidencias clave", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.keyEvidence).toHaveLength(EXECUTIVE_GEOINT_LIMITS.evidenciasClave);
  });

  test("6 agrupa por hallazgo y no por proveedor", () => {
    const input = institutionalInput({
      findings: [
        { findingId: "finding-shared", title: "Hallazgo compartido", sourceType: "STREET_VIEW", traceabilityIds: ["t1"] },
        { findingId: "finding-shared", title: "Hallazgo compartido", sourceType: "DENUE", traceabilityIds: ["t2"] },
      ],
    });
    const model = buildExecutiveGeointReportModel(input, context());
    expect(model.findings).toHaveLength(1);
    expect(model.findings[0].sourceTypes).toEqual(expect.arrayContaining(["STREET_VIEW", "DENUE"]));
  });

  test("7 conserva traceabilityIds internamente", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.findings[0].traceabilityIds).toContain("trace-finding-1");
    expect(model.keyEvidence[0].traceabilityIds.length).toBeGreaterThan(0);
  });

  test("8 producto predictivo no aprobado se excluye", () => {
    const model = buildExecutiveGeointReportModel(
      institutionalInput({ predictiveAnalyticalProducts: [predictiveProduct({ humanReviewStatus: "PENDING_REVIEW" })] }),
      context()
    );
    expect(model.prospectiveAnalysis.technicalMetadata.sourceProductIds).toHaveLength(0);
    expect(model.prospectiveAnalysis.excludedProducts[0].reasonCode).toContain("PREDICTIVE_PRODUCT_NOT_APPROVED");
  });

  test("9 producto vigente aprobado se admite", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.prospectiveAnalysis.technicalMetadata.sourceProductIds).toContain("pap-1");
    expect(model.prospectiveAnalysis.escenario).toBe("PERSISTENCIA");
  });

  test("10 no aparecen enums ingleses en labels visibles", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(Object.values(model.presentation.labels)).toContain("APROBADO");
    expect(model.presentation.visibleText.join("\n")).not.toMatch(/\b(APPROVED|PENDING_REVIEW|STALE|ANALYTICAL_PROJECTION)\b/);
  });

  test("11 no aparece ADR en texto visible", () => {
    const model = buildExecutiveGeointReportModel(
      institutionalInput({ findings: [{ findingId: "f-adr", summary: "Referencia ADR-025 interna", traceabilityIds: ["t"] }] }),
      context()
    );
    expect(model.presentation.visibleText.join("\n")).not.toMatch(/ADR-\d+/);
  });

  test("12 no aparece nombre de motor en texto visible", () => {
    const model = buildExecutiveGeointReportModel(
      institutionalInput({ findings: [{ findingId: "f-engine", summary: "Emitido por ReportEngine", traceabilityIds: ["t"] }] }),
      context()
    );
    expect(model.presentation.visibleText.join("\n")).not.toContain("ReportEngine");
  });

  test("13 no aparece version interna en texto visible", () => {
    const model = buildExecutiveGeointReportModel(
      institutionalInput({ findings: [{ findingId: "f-version", summary: "Resultado v1.2.3", traceabilityIds: ["t"] }] }),
      context()
    );
    expect(model.presentation.visibleText.join("\n")).not.toMatch(/\bv\d+\.\d+\.\d+\b/);
  });

  test("14 no produce porcentaje criminal", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(JSON.stringify(model.prospectiveAnalysis)).not.toMatch(/\d+%/);
  });

  test("15 no produce prediccion individual", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(JSON.stringify(model.prospectiveAnalysis).toLowerCase()).not.toMatch(/predicci[oó]n individual|culpabilidad|reincidencia individual/);
  });

  test("16 legacy ceipolId funciona", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context({ documentIdentity: { ceipolId: "CEIPOL/000001/06/09/2026" } }));
    expect(model.identity.numeroExpediente).toBe("CEIPOL/000001/06/09/2026");
  });

  test("17 NO ASIGNADO funciona", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context({ documentIdentity: {} }));
    expect(model.identity.numeroExpediente).toBe("NO ASIGNADO");
  });

  test("18 contradicciones se conservan", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.findings[0].contradictingFactors).toContain("contradiccion conservada");
    expect(model.multisourceAnalysis.contradicciones).toContain("contradiccion multifuente");
  });

  test("19 limitaciones se conservan", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.findings[0].limitations).toContain("limitacion conservada");
    expect(model.prospectiveAnalysis.limitaciones).toContain("No constituye certeza de ocurrencia futura.");
  });

  test("20 fuente tecnica se conserva como metadata", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.technicalMetadata.sourceProjectId).toBe("project-uuid-123");
    expect(model.identity.technicalMetadata.projectId).toBe("project-uuid-123");
  });

  test("21 salida es determinista", () => {
    const input = institutionalInput();
    expect(buildExecutiveGeointReportModel(input, context())).toEqual(buildExecutiveGeointReportModel(input, context()));
  });

  test("22 no llamadas externas", () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => { throw new Error("external call"); }) as any;
    expect(() => buildExecutiveGeointReportModel(institutionalInput(), context())).not.toThrow();
    global.fetch = originalFetch;
  });

  test("23 regresion ADR-022: evidencia base no se reevalua ni se elimina", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.technicalAnnex.references.find((item) => item.kind === "ALBUM_COMPLETO")?.itemCount).toBe(6);
    expect(model.keyEvidence.length).toBeLessThan(6);
  });

  test("24 regresion ADR-025: solo prospectiva admitida entra al resumen", () => {
    const model = buildExecutiveGeointReportModel(
      institutionalInput({
        predictiveAnalyticalProducts: [
          predictiveProduct(),
          predictiveProduct({ productId: "pap-rejected", humanReviewStatus: "REJECTED" }),
        ],
      }),
      context()
    );
    expect(model.prospectiveAnalysis.technicalMetadata.sourceProductIds).toEqual(["pap-1"]);
    expect(model.prospectiveAnalysis.excludedProducts.map((item) => item.productId)).toContain("pap-rejected");
  });

  test("25 TypeScript cubierto por contrato tipado", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    const typedId: string = model.identity.numeroExpediente;
    expect(typedId).toBe("06092026-0007-JMG");
  });

  test("26 build soporta densidad ejecutiva 7 a 9 paginas sin layout fisico", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.selectionAudit.limits).toEqual(EXECUTIVE_GEOINT_LIMITS);
    expect(model.findings.length + model.keyEvidence.length + model.decisionImplications.length).toBeLessThanOrEqual(14);
  });

  test("27 supportingFactor por si solo no genera accion", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    expect(model.decisionImplications[0].accionSugerida).toBe("ACCION SUGERIDA NO DISPONIBLE EN EL INSUMO INSTITUCIONAL");
    expect(model.decisionImplications[0].accionSugerida).not.toContain("factor soporte 1");
  });

  test("28 recommendation gobernada se reutiliza", () => {
    const model = buildExecutiveGeointReportModel(
      institutionalInput({
        findings: [{
          findingId: "finding-action",
          summary: "Hallazgo con accion gobernada",
          recommendation: "Coordinar inspeccion gobernada ya aprobada.",
          traceabilityIds: ["trace-action"],
        }],
      }),
      context()
    );
    expect(model.decisionImplications[0].accionSugerida).toBe("Coordinar inspeccion gobernada ya aprobada.");
  });

  test("29 ausencia de recommendation produce fallback neutro", () => {
    const model = buildExecutiveGeointReportModel(
      institutionalInput({ findings: [{ findingId: "finding-no-action", summary: "Sin accion", traceabilityIds: ["trace-no-action"] }] }),
      context()
    );
    expect(model.decisionImplications[0].accionSugerida).toBe("ACCION SUGERIDA NO DISPONIBLE EN EL INSUMO INSTITUCIONAL");
  });

  test("30 prospectiva por si sola no genera accion operativa nueva", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput({ findings: [] }), context());
    expect(model.prospectiveAnalysis.technicalMetadata.sourceProductIds).toEqual(["pap-1"]);
    expect(model.decisionImplications).toHaveLength(0);
    expect(model.panorama.decisionesSugeridas).toHaveLength(0);
  });

  test("31 confianza 0-1 se normaliza correctamente", () => {
    expect(buildExecutiveGeointReportModel(institutionalInput({ findings: [{ findingId: "f-082", confidence: 0.82 }] }), context()).findings[0].confidence).toBe("ALTO");
    expect(buildExecutiveGeointReportModel(institutionalInput({ findings: [{ findingId: "f-061", confidence: 0.61 }] }), context()).findings[0].confidence).toBe("MEDIO");
    expect(buildExecutiveGeointReportModel(institutionalInput({ findings: [{ findingId: "f-030", confidence: 0.30 }] }), context()).findings[0].confidence).toBe("BAJO");
  });

  test("32 confianza 0-100 se normaliza correctamente", () => {
    expect(buildExecutiveGeointReportModel(institutionalInput({ findings: [{ findingId: "f-82", confidence: 82 }] }), context()).findings[0].confidence).toBe("ALTO");
    expect(buildExecutiveGeointReportModel(institutionalInput({ findings: [{ findingId: "f-61", confidence: 61 }] }), context()).findings[0].confidence).toBe("MEDIO");
    expect(buildExecutiveGeointReportModel(institutionalInput({ findings: [{ findingId: "f-30", confidence: 30 }] }), context()).findings[0].confidence).toBe("BAJO");
  });

  test("33 confianza fuera de rango es no disponible", () => {
    expect(buildExecutiveGeointReportModel(institutionalInput({ findings: [{ findingId: "f-101", confidence: 101 }] }), context()).findings[0].confidence).toBe("NO DISPONIBLE");
    expect(buildExecutiveGeointReportModel(institutionalInput({ findings: [{ findingId: "f-neg", confidence: -1 }] }), context()).findings[0].confidence).toBe("NO DISPONIBLE");
  });

  test("34 sanitizacion directa de campos visibles", () => {
    const model = buildExecutiveGeointReportModel(
      institutionalInput({
        findings: [{
          findingId: "f-visible",
          title: "APPROVED por ReportEngine",
          summary: "SOURCE_FACT con ADR-025 y v1.2.3 en payload mock legacy claim",
          interpretation: "PublicationGate PENDING_REVIEW",
          implication: "STALE ANALYTICAL_PROJECTION",
          recommendation: "Accion APPROVED desde payload",
          traceabilityIds: ["trace-visible"],
        }],
        evidence: [{
          evidenceId: "ev-visible",
          title: "mock evidence",
          summary: "legacy payload",
          dataUrl: "data:image/png;base64,visible",
          findingIds: ["f-visible"],
          traceabilityIds: ["trace-ev-visible"],
        }],
        visualProducts: [{
          visualId: "map-visible",
          title: "ReportEngine map",
          summary: "ADR-022 visual",
          dataUrl: "data:image/png;base64,map",
          findingIds: ["f-visible"],
          traceabilityIds: ["trace-map-visible"],
        }],
      }),
      context({ nombreExpediente: "payload legacy", personaPerfiladora: "APPROVED", clasificacion: "v1.2.3" })
    );
    const visibleFields = [
      model.identity.nombreExpediente,
      model.identity.personaPerfiladora,
      model.identity.clasificacion,
      model.findings[0].title,
      model.findings[0].summary,
      model.findings[0].interpretation,
      model.findings[0].implication,
      model.decisionImplications[0].accionSugerida,
      model.keyEvidence[0].title,
      model.keyEvidence[0].summary,
      model.visualCandidates[0].title,
      model.visualCandidates[0].summary,
    ].join("\n");
    expect(visibleFields).not.toMatch(/SOURCE_FACT|PENDING_REVIEW|APPROVED|STALE|ANALYTICAL_PROJECTION|ReportEngine|PublicationGate|ADR-\d+|v\d+\.\d+\.\d+|payload|claim|mock|legacy/);
  });

  test("35 metadata tecnica permanece intacta", () => {
    const model = buildExecutiveGeointReportModel(
      institutionalInput({
        findings: [{
          findingId: "f-tech",
          summary: "SOURCE_FACT visible",
          sourceType: "SOURCE_FACT",
          traceabilityIds: ["trace-tech"],
        }],
      }),
      context()
    );
    expect(model.identity.technicalMetadata.projectId).toBe("project-uuid-123");
    expect(model.technicalMetadata.modelName).toBe("ExecutiveGeointReportModel");
    expect(model.findings[0].sourceTypes).toContain("SOURCE_FACT");
    expect(model.findings[0].traceabilityIds).toContain("trace-tech");
  });

  test("36 label de Street View visible en espanol institucional", () => {
    const model = buildExecutiveGeointReportModel(
      institutionalInput({
        streetView: [{ evidenceId: "sv-1", traceabilityIds: ["trace-sv-1"] }],
      }),
      context()
    );
    const reference = model.technicalAnnex.references.find((item) => item.kind === "STREET_VIEW_DETALLADO");
    expect(reference?.label).toBe("IMAGENES PANORAMICAS DE GOOGLE - DETALLE TECNICO");
  });

  test("37 IDs tecnicos no aparecen en presentation", () => {
    const model = buildExecutiveGeointReportModel(institutionalInput(), context());
    const text = model.presentation.visibleText.join("\n");
    expect(text).not.toContain("project-uuid-123");
    expect(text).not.toContain("trace-finding-1");
    expect(text).not.toContain("ev-1");
  });
});
