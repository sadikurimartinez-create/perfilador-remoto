import type { DenueAnalyticalRelation, DenueAnalyticalRelationType } from "../src/utils/denueAnalyticalRelation";
import {
  buildDenueAnalyticalCartographicProduct,
  type DenueAnalyticalCartographicProduct,
  type DenueAnalyticalCartographicProductInput,
  type DenueAnalyticalCartographicProductResult,
} from "../src/utils/denueAnalyticalCartographicProduct";
import type { DenueAnalyticalPublicationInput } from "../src/utils/denueAnalyticalPublicationGate";
import {
  appendDenueAnalyticalReviewEvent,
  buildDenueAnalyticalReviewEvent,
  createDenueAnalyticalReviewLedger,
} from "../src/utils/denueAnalyticalReviewLedger";
import {
  buildDenueAnalyticalMapRenderModel,
  validateDenueAnalyticalMapRenderModel,
} from "../src/utils/denueAnalyticalMapRendering";
import {
  buildCanonicalProjectGeography,
  type CanonicalGeographyType,
  type CanonicalProjectGeography,
} from "../src/utils/canonicalProjectGeography";
import { canonicalizeDenuePoisForInstitutionalAnalysis } from "../src/utils/denueCanonicalPoi";
import {
  adaptDenueObservationToGovernedMapLayer,
  type DenueGovernedMapLayer,
} from "../src/utils/denueGovernedMapAdapter";

const EXPEDIENTE_ID = "exp-r32b6f-render";
const GEOGRAPHY_ID = "geo-r32b6f-render";
const METHODOLOGY = "ADR-026:R3.2B.6F:v1";

function geography(type: CanonicalGeographyType): CanonicalProjectGeography {
  const points = type === "INDIVIDUAL"
    ? [{ lat: 21.88, lng: -102.30 }]
    : type === "CORRIDOR"
      ? [{ lat: 21.86, lng: -102.32 }, { lat: 21.90, lng: -102.28 }, { lat: 21.93, lng: -102.25 }]
      : [
          { lat: 21.86, lng: -102.32 },
          { lat: 21.86, lng: -102.25 },
          { lat: 21.93, lng: -102.25 },
          { lat: 21.93, lng: -102.32 },
        ];
  return buildCanonicalProjectGeography({
    projectId: EXPEDIENTE_ID,
    type,
    geographyId: GEOGRAPHY_ID,
    points,
    now: 1,
  });
}

function denueLayer(
  id: string,
  lat: number,
  lng: number,
  canonicalGeography = geography("POLYGON"),
  name = `Establecimiento ${id}`,
  activity = `Actividad ${id}`
): DenueGovernedMapLayer {
  const pois = canonicalizeDenuePoisForInstitutionalAnalysis([{
    Id: id,
    Nombre: name,
    Clase_actividad: activity,
    Domicilio: `Domicilio ${id}`,
    Latitud: lat,
    Longitud: lng,
  }], {
    expedienteId: EXPEDIENTE_ID,
    canonicalGeography,
    acquiredAt: "2026-09-30T12:00:00.000Z",
    query: "DENUE analytical render fixture",
  }).institutionalPois;
  const adapted = adaptDenueObservationToGovernedMapLayer(pois[0], { productId: "contextual-denue-product" });
  if (adapted.status !== "ADAPTED") throw new Error(adapted.reasons.join(","));
  return adapted.layer;
}

function baseRelation(
  layer: DenueGovernedMapLayer,
  relationId = `relation:${layer.layerId}`,
  relationTypes: DenueAnalyticalRelationType[] = ["SPATIAL_PROXIMITY"],
  overrides: Partial<DenueAnalyticalRelation> = {}
): DenueAnalyticalRelation {
  const limitations = [
    { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
    ...(relationTypes.includes("SPATIAL_PROXIMITY") ? [{ code: "PROXIMITY_NOT_CAUSALITY" }] : []),
    ...(relationTypes.includes("CONTEXTUAL_ASSOCIATION") ? [{ code: "CONTEXT_NOT_CAUSALITY" }] : []),
    { code: "HUMAN_VALIDATION_REQUIRED" },
  ];
  return {
    relationId,
    denueLayerId: layer.layerId,
    sourceEvidenceId: layer.layerId,
    expedienteId: EXPEDIENTE_ID,
    geographyId: GEOGRAPHY_ID,
    relationTypes,
    linkedEvidenceIds: [],
    linkedFindingIds: [],
    linkedHypothesisRefs: [],
    linkedSourceRefs: [layer.layerId, `field:${relationId}`],
    spatialMetrics: relationTypes.includes("SPATIAL_PROXIMITY")
      ? { unit: "METERS", method: "SpatialLayerEngine.getDistance", distanceMeters: 24 }
      : null,
    temporalCompatibility: "COMPATIBLE",
    sourceIndependence: {
      status: "UNKNOWN",
      assessedSourceRefs: [layer.layerId, `field:${relationId}`],
      independentSourceRefs: [],
      rationale: ["SIMPLE_RELATION_INDEPENDENCE_NOT_ASSERTED"],
    },
    lineage: layer.lineage,
    measuredFacts: [{
      factId: `fact:${relationId}`,
      metric: relationTypes.includes("SPATIAL_PROXIMITY") ? "distanceMeters" : "contextObserved",
      value: relationTypes.includes("SPATIAL_PROXIMITY") ? 24 : true,
      unit: relationTypes.includes("SPATIAL_PROXIMITY") ? "METERS" : null,
      sourceRefs: [layer.layerId, `field:${relationId}`],
    }],
    proposedInterpretations: [],
    limitations,
    machineAssessment: { status: "DETECTED", reasonCodes: ["MEASURED_RELATION"] },
    humanValidation: { status: "PENDING", validatedBy: null, validatedAt: null, rationale: null },
    publicationEligibility: "INELIGIBLE",
    methodologyVersion: METHODOLOGY,
    ...overrides,
  };
}

function reviewed(base: DenueAnalyticalRelation, rationale = `PPC acepta ${base.relationId}.`): DenueAnalyticalPublicationInput {
  const ledger = createDenueAnalyticalReviewLedger(base);
  if (ledger.status !== "VALID") throw new Error(ledger.reasons.join(","));
  const event = buildDenueAnalyticalReviewEvent(base, {
    nextStatus: "ACCEPTED",
    reviewedBy: "ppc-render-1",
    reviewedAt: "2026-09-30T17:00:00.000Z",
    rationale,
  });
  const result = appendDenueAnalyticalReviewEvent(base, ledger.ledger, event);
  if (result.status !== "VALID") throw new Error(result.reasons.join(","));
  return { baseRelation: base, relation: result.relation, ledger: result.ledger };
}

function productInput(
  canonicalGeography: CanonicalProjectGeography,
  layers: DenueGovernedMapLayer[],
  relations: DenueAnalyticalPublicationInput[],
  overrides: Partial<DenueAnalyticalCartographicProductInput> = {}
): DenueAnalyticalCartographicProductInput {
  return {
    expedienteId: EXPEDIENTE_ID,
    geographyId: GEOGRAPHY_ID,
    methodologyVersion: METHODOLOGY,
    canonicalGeography,
    canonicalGeographyReference: {
      geographyId: GEOGRAPHY_ID,
      geographyType: canonicalGeography.type,
      geometryType: canonicalGeography.geometry.type,
      sourceReference: `project://${GEOGRAPHY_ID}`,
    },
    contextualUniverseCount: 263,
    contextualDisplayedCount: 40,
    denueLayers: layers,
    relations,
    createdAtReference: "snapshot://2026-09-30T17:00:00.000Z",
    ...overrides,
  };
}

function built(
  canonicalGeography = geography("POLYGON"),
  layers = [denueLayer("A", 21.88, -102.30, canonicalGeography)],
  relations = layers.map((layer) => reviewed(baseRelation(layer))),
  overrides: Partial<DenueAnalyticalCartographicProductInput> = {}
): Extract<DenueAnalyticalCartographicProductResult, { status: "BUILT" }> {
  const result = buildDenueAnalyticalCartographicProduct(productInput(canonicalGeography, layers, relations, overrides));
  expect(result.status).toBe("BUILT");
  if (result.status !== "BUILT") throw new Error(result.reasons.join(","));
  return result;
}

function ready(result = built()) {
  const rendered = buildDenueAnalyticalMapRenderModel(result);
  expect(rendered.status).toBe("READY");
  if (rendered.status !== "READY") throw new Error(rendered.reasons.join(","));
  return rendered.model;
}

describe("R3.2B.6F DENUE analytical map rendering", () => {
  test.each(["INDIVIDUAL", "CORRIDOR", "POLYGON"] as CanonicalGeographyType[])(
    "preserva exactamente la geografia canonica %s",
    (type) => {
      const canonicalGeography = geography(type);
      const layer = denueLayer("A", 21.88, -102.30, geography("POLYGON"));
      const model = ready(built(canonicalGeography, [layer], [reviewed(baseRelation(layer))]));
      expect(model.canonicalGeography).toEqual(canonicalGeography);
      expect(model.canonicalGeography).not.toBe(canonicalGeography);
    }
  );

  test("un establecimiento produce label 1 y correspondencia exacta mapa-tabla", () => {
    const model = ready();
    expect(model.markers).toHaveLength(1);
    expect(model.markers[0].displayLabel).toBe("1");
    expect(model.displayedRows[0].displayLabel).toBe(model.markers[0].displayLabel);
    expect(model.displayedRows[0].denueLayerId).toBe(model.markers[0].denueLayerId);
    expect(model.markers[0].tableRowId).toBe(model.displayedRows[0].rowId);
    expect(validateDenueAnalyticalMapRenderModel(model)).toEqual({ valid: true, reasons: [] });
  });

  test("tres establecimientos producen labels 1, 2 y 3", () => {
    const canonicalGeography = geography("POLYGON");
    const layers = [
      denueLayer("A", 21.87, -102.31, canonicalGeography),
      denueLayer("B", 21.90, -102.29, canonicalGeography),
      denueLayer("C", 21.92, -102.26, canonicalGeography),
    ];
    const model = ready(built(canonicalGeography, layers, layers.map((layer) => reviewed(baseRelation(layer)))));
    expect(model.markers.map((marker) => marker.displayLabel)).toEqual(["1", "2", "3"]);
  });

  test("el orden incidental del input no cambia numeracion ni render model", () => {
    const canonicalGeography = geography("POLYGON");
    const layers = [
      denueLayer("A", 21.87, -102.31, canonicalGeography),
      denueLayer("B", 21.90, -102.29, canonicalGeography),
      denueLayer("C", 21.92, -102.26, canonicalGeography),
    ];
    const relations = layers.map((layer) => reviewed(baseRelation(layer)));
    const first = ready(built(canonicalGeography, layers, relations));
    const second = ready(built(canonicalGeography, [layers[2], layers[0], layers[1]], [relations[1], relations[2], relations[0]]));
    expect(second).toEqual(first);
  });

  test("un DENUE con tres relaciones conserva un marcador y tres relationIds", () => {
    const canonicalGeography = geography("POLYGON");
    const layer = denueLayer("A", 21.88, -102.30, canonicalGeography);
    const relations = ["one", "two", "three"].map((id) => reviewed(baseRelation(layer, `relation:${id}`)));
    const model = ready(built(canonicalGeography, [layer], relations));
    expect(model.markers).toHaveLength(1);
    expect(model.markers[0].relationIds).toEqual(["relation:one", "relation:three", "relation:two"]);
    expect(model.displayedRows[0].ppcRationales).toHaveLength(3);
    expect(model.displayedRows[0].distances).toHaveLength(3);
  });

  test.each([
    ["latitud fuera de rango", { lat: 91, lng: -102.30 }],
    ["longitud fuera de rango", { lat: 21.88, lng: -181 }],
    ["NaN", { lat: Number.NaN, lng: -102.30 }],
    ["Infinity", { lat: 21.88, lng: Number.POSITIVE_INFINITY }],
    ["Null Island", { lat: 0, lng: 0 }],
    ["coordenada faltante", { lng: -102.30 }],
  ])("rechaza marcador con %s", (_label, coordinates) => {
    const result = built();
    const product = structuredClone(result.product);
    product.mapItems[0].coordinates = coordinates as { lat: number; lng: number };
    const rendered = buildDenueAnalyticalMapRenderModel(product);
    expect(rendered.status).toBe("REJECTED");
  });

  test("rechaza mismatch de conteos sin corregirlo silenciosamente", () => {
    const product = structuredClone(built().product);
    product.analyticalMapItemCount = 4;
    const rendered = buildDenueAnalyticalMapRenderModel(product);
    expect(rendered.status).toBe("REJECTED");
    expect(rendered.reasons).toContain("PRODUCT:ANALYTICAL_ITEM_COUNT_MISMATCH");
  });

  test("EMPTY se conserva sin mapa ni tabla inventados", () => {
    const rendered = buildDenueAnalyticalMapRenderModel({
      status: "EMPTY",
      product: null,
      validation: { accepted: true, status: "ADMITTED", reasons: [] },
      rejectedRelations: [],
      duplicateRelationCount: 0,
      reasons: [],
    });
    expect(rendered).toEqual({ status: "EMPTY", model: null, reasons: [] });
  });

  test("conserva disclosures y limitaciones epistemicas aplicables", () => {
    const canonicalGeography = geography("POLYGON");
    const layer = denueLayer("A", 21.88, -102.30, canonicalGeography);
    const relation = reviewed(baseRelation(layer, "relation:limits", ["SPATIAL_PROXIMITY", "CONTEXTUAL_ASSOCIATION"]));
    const model = ready(built(canonicalGeography, [layer], [relation]));
    expect(model.disclosures).toEqual([
      "DENUE_NOT_CRIMINAL_EVIDENCE",
      "PROXIMITY_NOT_CAUSALITY",
      "CONTEXT_NOT_CAUSALITY",
    ]);
    expect(model.limitations).toEqual(expect.arrayContaining([
      "DENUE_NOT_CRIMINAL_EVIDENCE",
      "PROXIMITY_NOT_CAUSALITY",
      "CONTEXT_NOT_CAUSALITY",
    ]));
  });

  test("el validator rechaza campos de scoring o riesgo agregados", () => {
    const model = ready() as unknown as Record<string, unknown>;
    model.riskScore = 99;
    expect(validateDenueAnalyticalMapRenderModel(model as unknown as ReturnType<typeof ready>)).toEqual({
      valid: false,
      reasons: ["PROHIBITED_RISK_OR_RANKING_FIELD"],
    });
  });

  test("nombre, actividad y rationale no alteran el orden tecnico", () => {
    const canonicalGeography = geography("POLYGON");
    const first = denueLayer("A", 21.87, -102.31, canonicalGeography);
    const second = denueLayer("B", 21.92, -102.26, canonicalGeography);
    const baseline = ready(built(canonicalGeography, [first, second]));
    const changedFirst = denueLayer("A", 21.87, -102.31, canonicalGeography, "ZZZ", "999999");
    const changedSecond = denueLayer("B", 21.92, -102.26, canonicalGeography, "AAA", "000001");
    const changed = ready(built(
      canonicalGeography,
      [changedSecond, changedFirst],
      [
        reviewed(baseRelation(changedSecond), "Rationale breve."),
        reviewed(baseRelation(changedFirst), "Rationale humano extenso sin ponderacion."),
      ]
    ));
    expect(changed.markers.map((marker) => [marker.displayLabel, marker.denueLayerId])).toEqual(
      baseline.markers.map((marker) => [marker.displayLabel, marker.denueLayerId])
    );
  });

  test("elegibles omitidos por legibilidad permanecen trazables con razon tecnica", () => {
    const canonicalGeography = geography("POLYGON");
    const first = denueLayer("A", 21.87, -102.31, canonicalGeography);
    const second = denueLayer("B", 21.92, -102.26, canonicalGeography);
    const result = built(
      canonicalGeography,
      [first, second],
      [reviewed(baseRelation(first)), reviewed(baseRelation(second))],
      { displayConfig: { maxDisplayedPoints: 1, minimumSeparationMeters: 40 } }
    );
    const model = ready(result);
    expect(model.analyticalEligibleCount).toBe(2);
    expect(model.analyticalDisplayedCount).toBe(1);
    expect(model.eligibleButNotDisplayedRows).toHaveLength(1);
    expect(model.eligibleButNotDisplayedRows[0].omissionReason).toBe("CARTOGRAPHIC_LEGIBILITY_LIMIT");
    const allRelationIds = [
      ...model.markers.flatMap((marker) => marker.relationIds),
      ...model.eligibleButNotDisplayedRows.flatMap((row) => row.relationIds),
    ].sort();
    expect(allRelationIds).toEqual(result.product.eligibleRelations.map((relation) => relation.relationId).sort());
  });

  test("rechaza divergencia entre marcador y fila", () => {
    const model = structuredClone(ready());
    model.displayedRows[0].displayLabel = "9";
    const validation = validateDenueAnalyticalMapRenderModel(model);
    expect(validation.valid).toBe(false);
    expect(validation.reasons).toContain(`MARKER_TABLE_MISMATCH:${model.markers[0].displayId}`);
  });

  test("rechaza producto de tipo analitico invalido", () => {
    const product = structuredClone(built().product) as DenueAnalyticalCartographicProduct;
    (product as unknown as { analyticalProductType: string }).analyticalProductType = "OTHER";
    const rendered = buildDenueAnalyticalMapRenderModel(product);
    expect(rendered.status).toBe("REJECTED");
    expect(rendered.reasons).toContain("SOURCE_PRODUCT_INVALID");
  });

  test("expone estrategia neutral y numeracion completa independiente del label nativo", () => {
    const model = ready();
    expect(model.style).toEqual({
      markerPalette: "INSTITUTIONAL_NEUTRAL",
      canonicalGeometryEmphasis: "PRIMARY",
      nativeMarkerLabelCapability: "SINGLE_CHARACTER_ONLY",
      labelRenderingStrategy: "POST_RENDER_OVERLAY_FOR_COMPLETE_NUMERATION",
    });
    expect(model.legend.interpretationLimit).toContain("no representan por si mismos delitos");
  });
});
