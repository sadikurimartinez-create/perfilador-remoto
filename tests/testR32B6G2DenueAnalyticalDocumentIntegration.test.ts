import { Table } from "docx";
import { buildCanonicalProjectGeography, type CanonicalGeographyType, type CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { canonicalizeDenuePoisForInstitutionalAnalysis } from "../src/utils/denueCanonicalPoi";
import { adaptDenueObservationToGovernedMapLayer, type DenueGovernedMapLayer } from "../src/utils/denueGovernedMapAdapter";
import type { DenueAnalyticalRelation } from "../src/utils/denueAnalyticalRelation";
import {
  appendDenueAnalyticalReviewEvent,
  buildDenueAnalyticalReviewEvent,
  createDenueAnalyticalReviewLedger,
} from "../src/utils/denueAnalyticalReviewLedger";
import type { DenueAnalyticalPublicationInput } from "../src/utils/denueAnalyticalPublicationGate";
import {
  buildDenueAnalyticalCartographicProduct,
  type DenueAnalyticalCartographicProductResult,
} from "../src/utils/denueAnalyticalCartographicProduct";
import { integrateDenueAnalyticalDocument } from "../src/utils/denueAnalyticalDocumentIntegration";
import {
  renderDenueAnalyticalMapBitmap,
  type DenueAnalyticalBitmapBackend,
} from "../src/utils/denueAnalyticalMapImageRenderer";
import { buildExecutiveVisualComposition } from "../src/utils/executiveVisualComposition";
import { buildExecutiveGeointReportDocumentModel } from "../src/utils/executiveGeointReportDocumentModel";
import { renderExecutiveGeointWordDocument } from "../src/utils/executiveGeointWordRenderer";
import { buildExecutiveGeointTechnicalAnnexModel } from "../src/utils/executiveGeointTechnicalAnnexModel";
import { renderExecutiveGeointTechnicalAnnexWordDocument } from "../src/utils/executiveGeointTechnicalAnnexWordRenderer";

const EXPEDIENTE_ID = "exp-r32b6g2";
const METHODOLOGY = "ADR-026:R3.2B.6G.2:v1";
const GENERATED_AT = "2026-09-30T18:00:00.000Z";

function geography(type: CanonicalGeographyType): CanonicalProjectGeography {
  const points = type === "INDIVIDUAL"
    ? [{ lat: 21.88, lng: -102.30 }]
    : type === "CORRIDOR"
      ? [{ lat: 21.86, lng: -102.32 }, { lat: 21.90, lng: -102.28 }, { lat: 21.93, lng: -102.25 }]
      : [
          { lat: 21.85, lng: -102.33 },
          { lat: 21.85, lng: -102.24 },
          { lat: 21.94, lng: -102.24 },
          { lat: 21.94, lng: -102.33 },
        ];
  return buildCanonicalProjectGeography({ projectId: EXPEDIENTE_ID, type, geographyId: "geo-r32b6g2", points, now: 1 });
}

function layer(id: string, lat: number, lng: number, canonicalGeography: CanonicalProjectGeography): DenueGovernedMapLayer {
  const observation = canonicalizeDenuePoisForInstitutionalAnalysis([{
    Id: id,
    Nombre: `Establecimiento ${id}`,
    Clase_actividad: `Actividad ${id}`,
    Domicilio: `Domicilio ${id}`,
    Latitud: lat,
    Longitud: lng,
  }], {
    expedienteId: EXPEDIENTE_ID,
    canonicalGeography,
    acquiredAt: GENERATED_AT,
    query: "DENUE B.6G.2 fixture",
  }).institutionalPois[0];
  const adapted = adaptDenueObservationToGovernedMapLayer(observation, { productId: "contextual-denue-product" });
  if (adapted.status !== "ADAPTED") throw new Error(adapted.reasons.join(","));
  return adapted.layer;
}

function pendingRelation(denueLayer: DenueGovernedMapLayer, relationId: string): DenueAnalyticalRelation {
  return {
    relationId,
    denueLayerId: denueLayer.layerId,
    sourceEvidenceId: denueLayer.layerId,
    expedienteId: EXPEDIENTE_ID,
    geographyId: denueLayer.geographyId,
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
    measuredFacts: [{ factId: `fact:${relationId}`, metric: "distanceMeters", value: 24, unit: "METERS", sourceRefs: [denueLayer.layerId] }],
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
    reviewedBy: "ppc-b6g2",
    reviewedAt: GENERATED_AT,
    rationale: `PPC acepta ${base.relationId} sin atribuir riesgo ni causalidad.`,
  });
  const reviewed = appendDenueAnalyticalReviewEvent(base, created.ledger, event);
  if (reviewed.status !== "VALID") throw new Error(reviewed.reasons.join(","));
  return { baseRelation: base, relation: reviewed.relation, ledger: reviewed.ledger };
}

function built(type: CanonicalGeographyType = "POLYGON", count = 1): Extract<DenueAnalyticalCartographicProductResult, { status: "BUILT" }> {
  const canonicalGeography = geography(type);
  const observationGeography = geography("POLYGON");
  const layers = Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / 4);
    const column = index % 4;
    return layer(String(index + 1), 21.87 + row * 0.018, -102.315 + column * 0.02, observationGeography);
  });
  const result = buildDenueAnalyticalCartographicProduct({
    expedienteId: EXPEDIENTE_ID,
    geographyId: canonicalGeography.geographyId,
    methodologyVersion: METHODOLOGY,
    canonicalGeography,
    canonicalGeographyReference: {
      geographyId: canonicalGeography.geographyId,
      geographyType: canonicalGeography.type,
      geometryType: canonicalGeography.geometry.type,
      sourceReference: `project://${canonicalGeography.geographyId}`,
    },
    contextualUniverseCount: 263,
    contextualDisplayedCount: 40,
    denueLayers: layers,
    relations: layers.map((item, index) => accepted(pendingRelation(item, `relation-${index + 1}`))),
    createdAtReference: `snapshot://${GENERATED_AT}`,
    displayConfig: { maxDisplayedPoints: count, minimumSeparationMeters: 40 },
  });
  if (result.status !== "BUILT") throw new Error(result.reasons.join(","));
  return result;
}

function executiveModel(canonicalGeography: CanonicalProjectGeography): any {
  return {
    identity: { numeroExpediente: "28092026-0066-BRPD", clasificacion: "CONFIDENCIAL", fecha: GENERATED_AT, nombreExpediente: "B.6G.2", personaPerfiladora: "PPC" },
    panorama: { hallazgosClave: [], decisionesSugeridas: [] },
    territorialSituation: { canonicalGeography, territorialSummary: "Geografía canónica preservada.", principalMapCandidate: null, territorialFindings: [], relevantPoi: [], spatialLimitations: [] },
    findings: [{ findingId: "finding-1", title: "Hallazgo gobernado", summary: "Hallazgo gobernado", evidenceReferences: ["ev-1"], sourceTypes: ["FIELD_PHOTO"], supportingFactors: [], contradictingFactors: [], interpretation: "Interpretación", implication: "Implicación", confidence: "MEDIO", limitations: [], traceabilityIds: ["trace-finding-1"], technicalMetadata: { sourceFindingIds: ["finding-1"], sourceEvidenceIds: ["ev-1"], sourceAnalysisIds: [] } }],
    keyEvidence: [],
    multisourceAnalysis: { convergencias: ["Convergencia gobernada"], contradicciones: [], fuentesIndependientes: [], dependenciasParciales: [], brechasInformacion: [], nivelSoporte: "MEDIO", traceabilityIds: ["trace-multisource"], technicalMetadata: { sourceAnalysisIds: [], sourceEvidenceIds: [] } },
    prospectiveAnalysis: { tendencia: "NO DISPONIBLE", escenario: "NO DISPONIBLE", factoresSoporte: [], factoresContradiccion: [], nivelConfianza: "NO EVALUADO", incertidumbre: "ALTA", vigencia: "NO DISPONIBLE", limitaciones: [], relacionHipotesis: "NO EVALUADA", traceabilityIds: [], excludedProducts: [], technicalMetadata: { sourceProductIds: [] } },
    decisionImplications: [],
    visualCandidates: [],
    technicalAnnex: { references: [] },
    selectionAudit: {},
    presentation: { visibleText: [] },
    technicalMetadata: { sourceProjectId: EXPEDIENTE_ID },
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

function institutionalInput(integration: ReturnType<typeof integrateDenueAnalyticalDocument>, extraVisuals: any[] = [], denuePois: any[] = []): any {
  if (integration.status === "REJECTED") throw new Error(integration.reasons.join(","));
  const canonicalGeography = integration.status === "READY" ? integration.unit.renderModel.canonicalGeography : geography("POLYGON");
  return {
    projectId: EXPEDIENTE_ID,
    generatedAt: GENERATED_AT,
    geography: canonicalGeography,
    hypothesis: {}, evidence: [], findings: [], inferences: [], analyses: [], conclusions: [], osint: [], streetView: [], temporalComparisons: [], specializedIntelligence: [], predictiveAnalyticalProducts: [], predictiveAnalyticalNarrative: "",
    denuePois,
    denueAnalyticalDocument: integration,
    visualProducts: [...extraVisuals, ...(integration.status === "READY" ? [integration.unit.visualProduct] : [])],
    exclusions: [], disclosures: [],
    lineageSummary: { geographyId: canonicalGeography.geographyId, sourceIds: [], evidenceIds: [], findingIds: [], analysisIds: [], conclusionIds: [], itemCount: 0 },
    traceabilityGate: {}, publicationEligibility: "ELIGIBLE", draft: false, certified: false, published: false,
  };
}

describe("R3.2B.6G.2 DENUE analytical document integration", () => {
  test("READY produce visual estable, tabla y 12 labels mediante overlay bitmap", async () => {
    const integration = integrateDenueAnalyticalDocument(built("POLYGON", 12));
    expect(integration.status).toBe("READY");
    if (integration.status !== "READY") return;
    expect(integration.unit.renderModel.markers.map((item) => item.displayLabel)).toEqual(Array.from({ length: 12 }, (_, index) => String(index + 1)));
    expect(integration.unit.imagePlan.overlayMarkers.map((item) => item.displayLabel)).toEqual(Array.from({ length: 12 }, (_, index) => String(index + 1)));
    expect(integration.unit.imagePlan.baseMapUrl).not.toContain("label%3A");
    expect(integration.unit.imagePlan.overlayMarkers.every((marker) =>
      marker.y <= integration.unit.imagePlan.height - integration.unit.imagePlan.attributionSafeBottomLogicalPx
    )).toBe(true);
    const repeated = integrateDenueAnalyticalDocument(built("POLYGON", 12));
    expect(repeated.status === "READY" ? repeated.unit.visualId : "").toBe(integration.unit.visualId);
    const labels: string[] = [];
    const context: any = {
      drawImage: jest.fn(), beginPath: jest.fn(), arc: jest.fn(), fill: jest.fn(), stroke: jest.fn(),
      fillText: (label: string) => labels.push(label), fillStyle: "", strokeStyle: "", lineWidth: 0, font: "", textAlign: "center", textBaseline: "middle",
    };
    const backend: DenueAnalyticalBitmapBackend = {
      loadBaseMap: async () => ({ source: {}, width: 1280, height: 960 }),
      createCanvas: () => ({ context, toPngArrayBuffer: async () => new ArrayBuffer(2048) }),
    };
    const bitmap = await renderDenueAnalyticalMapBitmap(integration.unit.imagePlan, backend);
    expect(bitmap.data.byteLength).toBe(2048);
    expect(labels).toEqual(Array.from({ length: 12 }, (_, index) => String(index + 1)));
  });

  test.each(["INDIVIDUAL", "CORRIDOR", "POLYGON"] as CanonicalGeographyType[])("preserva geografía canónica %s", (type) => {
    const integration = integrateDenueAnalyticalDocument(built(type));
    expect(integration.status).toBe("READY");
    if (integration.status !== "READY") return;
    expect(integration.unit.renderModel.canonicalGeography.type).toBe(type);
    expect(integration.unit.imagePlan.geometryType).toBe(type === "INDIVIDUAL" ? "Point" : type === "CORRIDOR" ? "LineString" : "Polygon");
  });

  test("mapa y tabla conservan la misma secuencia e identidades", () => {
    const integration = integrateDenueAnalyticalDocument(built("POLYGON", 12));
    if (integration.status !== "READY") throw new Error("READY required");
    expect(integration.unit.companionTable.rowBindings).toEqual(integration.unit.renderModel.markers.map((marker) => ({
      displayLabel: marker.displayLabel,
      rowId: marker.tableRowId,
      denueLayerId: marker.denueLayerId,
      relationIds: marker.relationIds,
    })));
    expect(integration.unit.companionTable.rows[9][0]).toBe("10");
  });

  test("EMPTY legítimo omite mapa y tabla", () => {
    expect(integrateDenueAnalyticalDocument({ status: "EMPTY", product: null, validation: { accepted: true, status: "ADMITTED", reasons: [] }, rejectedRelations: [], duplicateRelationCount: 0, reasons: [] })).toEqual({
      status: "EMPTY", sourcePresent: true, unit: null, reasons: [],
    });
  });

  test("INVALID y bypass sin B.6E fallan cerrados", () => {
    expect(integrateDenueAnalyticalDocument({ status: "EMPTY", product: null, validation: { accepted: true, status: "ADMITTED", reasons: [] }, rejectedRelations: [{ relationId: "pending", reasons: ["HUMAN_VALIDATION_NOT_ACCEPTED:PENDING"] }], duplicateRelationCount: 0, reasons: [] }).status).toBe("REJECTED");
    expect(integrateDenueAnalyticalDocument({ markers: [] } as any)).toEqual({ status: "REJECTED", sourcePresent: true, unit: null, reasons: ["B6E_CARTOGRAPHIC_PRODUCT_REQUIRED"] });
    const inconsistent = structuredClone(built().product);
    inconsistent.mapItems[0].coordinates.lat = 91;
    expect(integrateDenueAnalyticalDocument(inconsistent).status).toBe("REJECTED");
  });

  test("BAR y LINE preceden al mapa analítico sin exceder cinco visuales", () => {
    const integration = integrateDenueAnalyticalDocument(built());
    if (integration.status !== "READY") throw new Error("READY required");
    const input = institutionalInput(integration, [chart("BAR"), chart("LINE")]);
    const model = executiveModel(input.geography);
    model.keyEvidence = Array.from({ length: 3 }, (_, index) => ({
      evidenceId: `photo-${index}`, title: `Foto ${index}`, summary: "Fotografía gobernada", visualReference: `asset://photo-${index}`,
      evidenceReferences: [`photo-${index}`], sourceTypes: ["FIELD_PHOTO"], relatedFindingIds: ["finding-1"], selectionReason: "Trazabilidad", limitations: [], traceabilityIds: [`trace-photo-${index}`], technicalMetadata: { sourceItemId: `photo-${index}`, originalItemType: "EVIDENCE" },
    }));
    const composition = buildExecutiveVisualComposition(model, input);
    expect(composition.visualBudget.used).toBe(5);
    expect(composition.secondaryVisuals.slice(0, 3).map((item) => item.visualId)).toEqual(["adr022-bar", "adr022-line", integration.unit.visualId]);
    expect(composition.secondaryVisuals.map((item) => item.visualType)).toContain("SECONDARY_MAP");
  });

  test("B.5 permanece en el principal y B.6F consume exactamente un slot secundario", () => {
    const integration = integrateDenueAnalyticalDocument(built());
    if (integration.status !== "READY") throw new Error("READY required");
    const input = institutionalInput(integration);
    const composition = buildExecutiveVisualComposition(executiveModel(input.geography), input);
    expect(composition.principalTerritorialMap.mapId).toBe("principal-territorial-map");
    expect(composition.secondaryVisuals).toHaveLength(1);
    expect(composition.visualBudget.used).toBe(2);
  });

  test("document model coloca mapa y tabla en multisource-analysis y Word los renderiza", () => {
    const integration = integrateDenueAnalyticalDocument(built());
    if (integration.status !== "READY") throw new Error("READY required");
    const input = institutionalInput(integration);
    const model = executiveModel(input.geography);
    const composition = buildExecutiveVisualComposition(model, input);
    const documentModel = buildExecutiveGeointReportDocumentModel(model, composition, input, { numeroExpediente: "28092026-0066-BRPD" });
    const placement = documentModel.visualPlacements.find((item) => item.visualId === integration.unit.visualId);
    expect(placement).toMatchObject({ sectionId: "multisource-analysis", placementRole: "ANALYTICAL_SUPPORT" });
    expect(placement?.companionTable?.rowBindings[0].displayLabel).toBe("1");
    const rendered = renderExecutiveGeointWordDocument(documentModel, {
      visualAssetsById: {
        "principal-territorial-map": { data: new Uint8Array(2048), width: 500, height: 280, type: "png" },
        [integration.unit.visualId]: { data: new Uint8Array(2048), width: 420, height: 315, type: "png" },
      },
    });
    expect(rendered.renderAudit.renderedVisualIds).toContain(integration.unit.visualId);
    expect(rendered.children.some((child) => child instanceof Table)).toBe(true);
  });

  test("263 DENUE se resumen sin 263 filas y conservan trazabilidad analítica", () => {
    const integration = integrateDenueAnalyticalDocument(built("POLYGON", 2));
    if (integration.status !== "READY") throw new Error("READY required");
    const denuePois = Array.from({ length: 263 }, (_, index) => ({ id: `poi-${index}`, source: "DENUE", provider: "INEGI_DENUE" }));
    const input = institutionalInput(integration, [], denuePois);
    const model = executiveModel(input.geography);
    const composition = buildExecutiveVisualComposition(model, input);
    const documentModel = buildExecutiveGeointReportDocumentModel(model, composition, input);
    const annex = buildExecutiveGeointTechnicalAnnexModel(input, model, composition, documentModel);
    const contextual = annex.sections.find((section) => section.sectionId === "denue");
    const analytical = annex.sections.find((section) => section.sectionId === "denue-analytical");
    expect(contextual?.records).toHaveLength(0);
    expect(contextual?.facts).toEqual(expect.arrayContaining([{ label: "Universo contextual", value: "263" }]));
    expect(analytical?.tables[0].rows).toHaveLength(2);
    expect(annex.technicalMetadata.traceabilityIds).toEqual(expect.arrayContaining(integration.unit.traceability.map((entry) => entry.relationFingerprint)));
    const renderedAnnex = renderExecutiveGeointTechnicalAnnexWordDocument(annex);
    expect(renderedAnnex.children.some((child) => child instanceof Table)).toBe(true);
  });

  test("la integración no introduce semántica de riesgo o ranking", () => {
    const integration = integrateDenueAnalyticalDocument(built("POLYGON", 2));
    const serialized = JSON.stringify(integration);
    for (const forbidden of ["riskScore", "riskLevel", "vulnerabilityScore", "dangerLevel", "priorityRank", "criminogenicity"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
