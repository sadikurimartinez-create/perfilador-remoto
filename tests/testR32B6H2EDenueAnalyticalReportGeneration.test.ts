import { readFileSync } from "fs";
import { join } from "path";
import { Packer } from "docx";
import JSZip from "jszip";
import {
  integrateDenueAnalyticalPublicationForReport,
} from "@/services/denueAnalyticalReportGenerationService";
import type { DenueAnalyticalPublicationServiceResult } from "@/services/denueAnalyticalPublicationService";
import { buildCanonicalProjectGeography, type CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { canonicalizeDenuePoisForInstitutionalAnalysis } from "@/utils/denueCanonicalPoi";
import { adaptDenueObservationToGovernedMapLayer, type DenueGovernedMapLayer } from "@/utils/denueGovernedMapAdapter";
import type { DenueAnalyticalRelation } from "@/utils/denueAnalyticalRelation";
import {
  appendDenueAnalyticalReviewEvent,
  buildDenueAnalyticalReviewEvent,
  createDenueAnalyticalReviewLedger,
} from "@/utils/denueAnalyticalReviewLedger";
import type { DenueAnalyticalPublicationInput } from "@/utils/denueAnalyticalPublicationGate";
import {
  buildDenueAnalyticalCartographicProduct,
  type DenueAnalyticalCartographicProductResult,
} from "@/utils/denueAnalyticalCartographicProduct";
import { integrateDenueAnalyticalDocument } from "@/utils/denueAnalyticalDocumentIntegration";
import { buildExecutiveVisualComposition } from "@/utils/executiveVisualComposition";
import { buildExecutiveGeointReportDocumentModel } from "@/utils/executiveGeointReportDocumentModel";
import { renderExecutiveGeointWordDocument as renderExecutiveGeointWordDocumentDraft } from "@/utils/executiveGeointWordRenderer";

const PROJECT_ID = "exp-r32b6h2e";
const GEOGRAPHY_ID = "geo-r32b6h2e";
const METHODOLOGY = "ADR-026:R3.2B.6H.2E:v1";
const GENERATED_AT = "2026-09-30T20:00:00.000Z";

function geography(): CanonicalProjectGeography {
  return buildCanonicalProjectGeography({
    projectId: PROJECT_ID,
    type: "POLYGON",
    geographyId: GEOGRAPHY_ID,
    points: [
      { lat: 21.85, lng: -102.33 },
      { lat: 21.85, lng: -102.24 },
      { lat: 21.94, lng: -102.24 },
      { lat: 21.94, lng: -102.33 },
    ],
    now: 1,
  });
}

function layer(index: number, canonicalGeography: CanonicalProjectGeography): DenueGovernedMapLayer {
  const row = Math.floor(index / 4);
  const column = index % 4;
  const observation = canonicalizeDenuePoisForInstitutionalAnalysis([{
    Id: String(index + 1),
    Nombre: `Establecimiento ${index + 1}`,
    Clase_actividad: `Actividad ${index + 1}`,
    Domicilio: `Domicilio ${index + 1}`,
    Latitud: 21.87 + row * 0.018,
    Longitud: -102.315 + column * 0.02,
  }], {
    expedienteId: PROJECT_ID,
    canonicalGeography,
    acquiredAt: GENERATED_AT,
    query: "DENUE H.2E fixture",
  }).institutionalPois[0];
  const adapted = adaptDenueObservationToGovernedMapLayer(observation, {
    productId: "contextual-denue-product",
  });
  if (adapted.status !== "ADAPTED") throw new Error(adapted.reasons.join(","));
  return adapted.layer;
}

function pendingRelation(denueLayer: DenueGovernedMapLayer, index: number): DenueAnalyticalRelation {
  const relationId = `relation-${index + 1}`;
  return {
    relationId,
    denueLayerId: denueLayer.layerId,
    sourceEvidenceId: denueLayer.layerId,
    expedienteId: PROJECT_ID,
    geographyId: GEOGRAPHY_ID,
    relationTypes: ["SPATIAL_PROXIMITY"],
    linkedEvidenceIds: [],
    linkedFindingIds: [],
    linkedHypothesisRefs: [],
    linkedSourceRefs: [denueLayer.layerId, `field:${relationId}`],
    spatialMetrics: { unit: "METERS", method: "SpatialLayerEngine.getDistance", distanceMeters: 24 },
    temporalCompatibility: "COMPATIBLE",
    sourceIndependence: {
      status: "UNKNOWN",
      assessedSourceRefs: [denueLayer.layerId, `field:${relationId}`],
      independentSourceRefs: [],
      rationale: ["SIMPLE_RELATION_INDEPENDENCE_NOT_ASSERTED"],
    },
    lineage: denueLayer.lineage,
    measuredFacts: [{
      factId: `fact:${relationId}`,
      metric: "distanceMeters",
      value: 24,
      unit: "METERS",
      sourceRefs: [denueLayer.layerId],
    }],
    proposedInterpretations: [],
    limitations: [
      { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
      { code: "PROXIMITY_NOT_CAUSALITY" },
      { code: "HUMAN_VALIDATION_REQUIRED" },
    ],
    machineAssessment: { status: "DETECTED", reasonCodes: ["MEASURED_RELATION"] },
    humanValidation: { status: "PENDING", validatedBy: null, validatedAt: null, rationale: null },
    publicationEligibility: "INELIGIBLE",
    methodologyVersion: METHODOLOGY,
  };
}

function accepted(base: DenueAnalyticalRelation): DenueAnalyticalPublicationInput {
  const created = createDenueAnalyticalReviewLedger(base);
  if (created.status !== "VALID") throw new Error(created.reasons.join(","));
  const event = buildDenueAnalyticalReviewEvent(base, {
    nextStatus: "ACCEPTED",
    reviewedBy: "user:ppc-h2e",
    reviewedAt: GENERATED_AT,
    rationale: `PPC acepta ${base.relationId} para publicación gobernada.`,
  });
  const reviewed = appendDenueAnalyticalReviewEvent(base, created.ledger, event);
  if (reviewed.status !== "VALID") throw new Error(reviewed.reasons.join(","));
  return { baseRelation: base, relation: reviewed.relation, ledger: reviewed.ledger };
}

function built(count = 12): Extract<DenueAnalyticalCartographicProductResult, { status: "BUILT" }> {
  const canonicalGeography = geography();
  const layers = Array.from({ length: count }, (_, index) => layer(index, canonicalGeography));
  const result = buildDenueAnalyticalCartographicProduct({
    expedienteId: PROJECT_ID,
    geographyId: GEOGRAPHY_ID,
    methodologyVersion: METHODOLOGY,
    canonicalGeography,
    canonicalGeographyReference: {
      geographyId: GEOGRAPHY_ID,
      geographyType: "POLYGON",
      geometryType: "Polygon",
      sourceReference: `project://${GEOGRAPHY_ID}`,
    },
    contextualUniverseCount: 263,
    contextualDisplayedCount: 40,
    denueLayers: layers,
    relations: layers.map((item, index) => accepted(pendingRelation(item, index))),
    createdAtReference: `snapshot://${GENERATED_AT}`,
    displayConfig: { maxDisplayedPoints: count, minimumSeparationMeters: 40 },
  });
  if (result.status !== "BUILT") throw new Error(result.reasons.join(","));
  return result;
}

function publicationResult(result: DenueAnalyticalCartographicProductResult): DenueAnalyticalPublicationServiceResult {
  const eligibleCount = result.status === "BUILT" ? result.product.analyticalEligibleCount : 0;
  return {
    relationCount: eligibleCount,
    acceptedCount: eligibleCount,
    eligibleCount,
    excludedCount: 0,
    exclusionReasons: [],
    productStatus: result.status,
    product: result.product,
    warnings: [],
  };
}

function chart(kind: "BAR" | "LINE"): any {
  return {
    id: `adr022-${kind.toLowerCase()}`,
    visualId: `adr022-${kind.toLowerCase()}`,
    visualType: "STATISTICAL_CHART",
    kind,
    title: `Incidencia ${kind}`,
    caption: `Gráfica ${kind}`,
    visualReference: `data:image/png;base64,${kind}`,
    traceabilityIds: [`trace-${kind}`],
    datasetSourceRefs: ["incidencia-estadistica"],
    variables: ["incidentType"],
    transformation: "DESCRIPTIVE_AGGREGATION",
    publicationEligibility: "ELIGIBLE",
  };
}

function institutionalInput(extraVisuals: any[] = []): any {
  const canonicalGeography = geography();
  return {
    projectId: PROJECT_ID,
    generatedAt: GENERATED_AT,
    geography: canonicalGeography,
    hypothesis: {},
    evidence: [], findings: [], inferences: [], analyses: [], conclusions: [], osint: [],
    streetView: [], temporalComparisons: [], specializedIntelligence: [], predictiveAnalyticalProducts: [],
    predictiveAnalyticalNarrative: "",
    denuePois: Array.from({ length: 263 }, (_, index) => ({ id: `denue-${index + 1}` })),
    denueAnalyticalDocument: integrateDenueAnalyticalDocument(null),
    visualProducts: extraVisuals,
    exclusions: [], disclosures: [],
    lineageSummary: { geographyId: GEOGRAPHY_ID, sourceIds: [], evidenceIds: [], findingIds: [], analysisIds: [], conclusionIds: [], itemCount: 0 },
    traceabilityGate: {}, publicationEligibility: "ELIGIBLE", draft: false, certified: false, published: false,
  };
}

function executiveModel(): any {
  return {
    identity: { numeroExpediente: "28092026-0066-BRPD", clasificacion: "CONFIDENCIAL", fecha: GENERATED_AT, nombreExpediente: "H.2E", personaPerfiladora: "PPC" },
    panorama: { hallazgosClave: [], decisionesSugeridas: [] },
    territorialSituation: { canonicalGeography: geography(), territorialSummary: "Geografía canónica preservada.", principalMapCandidate: null, territorialFindings: [], relevantPoi: [], spatialLimitations: [] },
    findings: [], keyEvidence: [],
    multisourceAnalysis: { convergencias: ["Convergencia gobernada"], contradicciones: [], fuentesIndependientes: [], dependenciasParciales: [], brechasInformacion: [], nivelSoporte: "MEDIO", traceabilityIds: ["trace-multisource"], technicalMetadata: { sourceAnalysisIds: [], sourceEvidenceIds: [] } },
    prospectiveAnalysis: { tendencia: "NO DISPONIBLE", escenario: "NO DISPONIBLE", factoresSoporte: [], factoresContradiccion: [], nivelConfianza: "NO EVALUADO", incertidumbre: "ALTA", vigencia: "NO DISPONIBLE", limitaciones: [], relacionHipotesis: "NO EVALUADA", traceabilityIds: [], excludedProducts: [], technicalMetadata: { sourceProductIds: [] } },
    decisionImplications: [], visualCandidates: [], technicalAnnex: { references: [] }, selectionAudit: {}, presentation: { visibleText: [] }, technicalMetadata: { sourceProjectId: PROJECT_ID },
  };
}

function emptyB6E(): DenueAnalyticalCartographicProductResult {
  return {
    status: "EMPTY",
    product: null,
    validation: { accepted: true, status: "ADMITTED", reasons: [] },
    rejectedRelations: [],
    duplicateRelationCount: 0,
    reasons: [],
  };
}

async function xmlFor(input: any) {
  const composition = buildExecutiveVisualComposition(executiveModel(), input);
  const model = buildExecutiveGeointReportDocumentModel(executiveModel(), composition, input, {
    numeroExpediente: "28092026-0066-BRPD",
  });
  const analytical = input.denueAnalyticalDocument.status === "READY" ? input.denueAnalyticalDocument.unit : null;
  const assets: Record<string, any> = {
    "principal-territorial-map": { data: new Uint8Array(2048), width: 500, height: 280, type: "png" },
  };
  if (analytical) assets[analytical.visualId] = { data: new Uint8Array(2048), width: 420, height: 315, type: "png" };
  const rendered = renderExecutiveGeointWordDocument(model, { visualAssetsById: assets });
  const zip = await JSZip.loadAsync(await Packer.toBuffer(rendered.document));
  return {
    composition,
    model,
    rendered,
    xml: await zip.file("word/document.xml")!.async("string"),
  };
}

describe("R3.2B.6H.2E DENUE analytical report generation", () => {
  test("B.6E EMPTY omite mapa y tabla analíticos sin retirar BAR o LINE", async () => {
    const input = institutionalInput([chart("BAR"), chart("LINE")]);
    const result = await integrateDenueAnalyticalPublicationForReport({
      institutionalReportInput: input,
      denueLayers: [],
      contextualDisplayedCount: 40,
      createdAtReference: `report-snapshot:${GENERATED_AT}`,
    }, { buildPublicationProduct: async () => publicationResult(emptyB6E()) });
    expect(result.status).toBe("EMPTY");
    expect(result.institutionalReportInput.denueAnalyticalDocument.status).toBe("EMPTY");
    expect(result.institutionalReportInput.visualProducts.map((item: any) => item.visualId)).toEqual(["adr022-bar", "adr022-line"]);
    const word = await xmlFor(result.institutionalReportInput);
    expect(word.composition.secondaryVisuals.map((item) => item.visualId)).toEqual(["adr022-bar", "adr022-line"]);
    expect(word.xml).not.toContain("RELACIONES ANALÍTICAS DENUE ADMITIDAS");
    expect(word.xml).not.toContain("relaciones analíticas aceptadas por PPC");
    expect(word.xml).not.toContain("Establecimiento 1");
  });

  test("B.6E BUILT recorre B.6F/B.6G y Word con 12 marcadores y 12 filas", async () => {
    const productResult = built(12);
    const input = institutionalInput([chart("BAR"), chart("LINE")]);
    const inputSnapshot = JSON.stringify(input);
    const result = await integrateDenueAnalyticalPublicationForReport({
      institutionalReportInput: input,
      denueLayers: productResult.product.layers as unknown as DenueGovernedMapLayer[],
      contextualDisplayedCount: 40,
      createdAtReference: `report-snapshot:${GENERATED_AT}`,
    }, { buildPublicationProduct: async () => publicationResult(productResult) });
    expect(result.status).toBe("READY");
    if (result.documentIntegration.status !== "READY") throw new Error("READY required");
    const unit = result.documentIntegration.unit;
    expect(unit.renderModel.markers.map((marker) => marker.displayLabel)).toEqual(Array.from({ length: 12 }, (_, index) => String(index + 1)));
    expect(unit.companionTable.rows).toHaveLength(12);
    expect(unit.companionTable.rows[9][0]).toBe("10");
    expect(unit.companionTable.rows[10][0]).toBe("11");
    expect(unit.companionTable.rows[11][0]).toBe("12");
    expect(unit.companionTable.rowBindings).toEqual(unit.renderModel.markers.map((marker) => ({
      displayLabel: marker.displayLabel,
      rowId: marker.tableRowId,
      denueLayerId: marker.denueLayerId,
      relationIds: marker.relationIds,
    })));
    const word = await xmlFor(result.institutionalReportInput);
    expect(word.composition.visualBudget.used).toBeLessThanOrEqual(5);
    expect(word.composition.principalTerritorialMap.mapId).toBe("principal-territorial-map");
    expect(word.composition.secondaryVisuals.slice(0, 3).map((item) => item.visualId)).toEqual([
      unit.visualId,
      "adr022-bar",
      "adr022-line",
    ]);
    expect(word.model.visualPlacements.find((item) => item.visualId === unit.visualId)).toMatchObject({
      sectionId: "multisource-analysis",
      placementRole: "ANALYTICAL_SUPPORT",
    });
    expect(word.xml).toContain("Establecimiento 1");
    expect(word.xml).toContain("Establecimiento 12");
    expect(word.xml).toContain("relaciones analíticas aceptadas por PPC");
    expect(word.rendered.renderAudit.renderedVisualIds).toContain(unit.visualId);
    expect(JSON.stringify(input)).toBe(inputSnapshot);
  });

  test("falla de H.2D continúa el informe en modo fail-closed y elimina visual precargado", async () => {
    const stale = {
      visualId: "stale-denue-map",
      documentIntegrationKind: "DENUE_ANALYTICAL_B6G",
    };
    const result = await integrateDenueAnalyticalPublicationForReport({
      institutionalReportInput: institutionalInput([chart("BAR"), stale]),
      denueLayers: [],
      contextualDisplayedCount: 40,
      createdAtReference: `report-snapshot:${GENERATED_AT}`,
    }, { buildPublicationProduct: async () => { throw new Error("repository unavailable"); } });
    expect(result.status).toBe("FAIL_CLOSED");
    expect(result.documentIntegration.status).toBe("EMPTY");
    expect(result.institutionalReportInput.visualProducts.map((item: any) => item.visualId)).toEqual(["adr022-bar"]);
    expect(result.warnings).toEqual(["DENUE_ANALYTICAL_PUBLICATION_UNAVAILABLE:repository unavailable"]);
  });

  test("misma publicación produce mismo visualId, orden y numeración", async () => {
    const productResult = built(3);
    const execute = () => integrateDenueAnalyticalPublicationForReport({
      institutionalReportInput: institutionalInput(),
      denueLayers: productResult.product.layers as unknown as DenueGovernedMapLayer[],
      contextualDisplayedCount: 40,
      createdAtReference: `report-snapshot:${GENERATED_AT}`,
    }, { buildPublicationProduct: async () => publicationResult(productResult) });
    const [first, second] = await Promise.all([execute(), execute()]);
    expect(second).toEqual(first);
  });

  test("exportToWord delegates to the single governed DENUE integration before document construction", () => {
    const source = readFileSync(join(process.cwd(), "src/utils/institutionalGenerationModels.ts"), "utf8");
    const exporter = readFileSync(join(process.cwd(), "src/lib/exportToWord.ts"), "utf8");
    const integration = source.indexOf("await integrateDenueAnalyticalPublicationForReport");
    const executive = source.indexOf("const executiveModel =");
    expect(integration).toBeGreaterThan(-1); expect(integration).toBeLessThan(executive);
    expect(source.match(/await integrateDenueAnalyticalPublicationForReport/g)).toHaveLength(1);
    expect(exporter).toContain("await buildInstitutionalGenerationModels(payload, projectName, reportNumber, user)");
  });

  test("la salida no incorpora campos de riesgo o ranking", async () => {
    const productResult = built(2);
    const result = await integrateDenueAnalyticalPublicationForReport({
      institutionalReportInput: institutionalInput(),
      denueLayers: productResult.product.layers as unknown as DenueGovernedMapLayer[],
      contextualDisplayedCount: 40,
      createdAtReference: `report-snapshot:${GENERATED_AT}`,
    }, { buildPublicationProduct: async () => publicationResult(productResult) });
    expect(JSON.stringify(result)).not.toMatch(/riskScore|riskLevel|vulnerabilityScore|dangerLevel|priorityRank|criminogenicity/);
  });
});

// Composition-only fixtures are explicit drafts; final guards are tested in PRE-P7.
const renderExecutiveGeointWordDocument = (model: Parameters<typeof renderExecutiveGeointWordDocumentDraft>[0], options: Parameters<typeof renderExecutiveGeointWordDocumentDraft>[1] = {}) => renderExecutiveGeointWordDocumentDraft(model, { ...options, exportMode: "DRAFT" });
