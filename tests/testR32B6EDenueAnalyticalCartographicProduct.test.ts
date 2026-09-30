import type { DenueAnalyticalRelation } from "../src/utils/denueAnalyticalRelation";
import {
  buildDenueAnalyticalCartographicProduct,
  validateDenueAnalyticalCartographicProduct,
  type DenueAnalyticalCartographicProductInput,
} from "../src/utils/denueAnalyticalCartographicProduct";
import type { DenueAnalyticalPublicationInput } from "../src/utils/denueAnalyticalPublicationGate";
import {
  appendDenueAnalyticalReviewEvent,
  buildDenueAnalyticalReviewEvent,
  createDenueAnalyticalReviewLedger,
} from "../src/utils/denueAnalyticalReviewLedger";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { canonicalizeDenuePoisForInstitutionalAnalysis } from "../src/utils/denueCanonicalPoi";
import {
  adaptDenueObservationToGovernedMapLayer,
  type DenueGovernedMapLayer,
} from "../src/utils/denueGovernedMapAdapter";

const EXPEDIENTE_ID = "exp-r32b6e-product";
const GEOGRAPHY_ID = "geo-r32b6e-product";
const METHODOLOGY = "ADR-026:R3.2B.6E:v1";

const canonicalGeography = buildCanonicalProjectGeography({
  projectId: EXPEDIENTE_ID,
  type: "POLYGON",
  geographyId: GEOGRAPHY_ID,
  points: [
    { lat: 21.86, lng: -102.32 },
    { lat: 21.86, lng: -102.25 },
    { lat: 21.93, lng: -102.25 },
    { lat: 21.93, lng: -102.32 },
  ],
  now: 1,
});

function denueLayer(id: string, lat: number, lng: number): DenueGovernedMapLayer {
  const pois = canonicalizeDenuePoisForInstitutionalAnalysis([{
    Id: id,
    Nombre: `Establecimiento ${id}`,
    Clase_actividad: `Actividad ${id}`,
    Domicilio: `Domicilio ${id}`,
    Latitud: lat,
    Longitud: lng,
  }], {
    expedienteId: EXPEDIENTE_ID,
    canonicalGeography,
    acquiredAt: "2026-09-29T12:00:00.000Z",
    query: "DENUE analytical product fixture",
  }).institutionalPois;
  const adapted = adaptDenueObservationToGovernedMapLayer(pois[0], { productId: "contextual-denue-product" });
  if (adapted.status !== "ADAPTED") throw new Error(adapted.reasons.join(","));
  return adapted.layer;
}

function baseRelation(
  layer: DenueGovernedMapLayer,
  relationId = `relation:${layer.layerId}`,
  overrides: Partial<DenueAnalyticalRelation> = {}
): DenueAnalyticalRelation {
  return {
    relationId,
    denueLayerId: layer.layerId,
    sourceEvidenceId: layer.layerId,
    expedienteId: EXPEDIENTE_ID,
    geographyId: GEOGRAPHY_ID,
    relationTypes: ["SPATIAL_PROXIMITY"],
    linkedEvidenceIds: [],
    linkedFindingIds: [],
    linkedHypothesisRefs: [],
    linkedSourceRefs: [layer.layerId, `field:${relationId}`],
    spatialMetrics: { unit: "METERS", method: "SpatialLayerEngine.getDistance", distanceMeters: 24 },
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
      metric: "distanceMeters",
      value: 24,
      unit: "METERS",
      sourceRefs: [layer.layerId, `field:${relationId}`],
    }],
    proposedInterpretations: [],
    limitations: [
      { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
      { code: "PROXIMITY_NOT_CAUSALITY" },
      { code: "HUMAN_VALIDATION_REQUIRED" },
    ],
    machineAssessment: { status: "DETECTED", reasonCodes: ["MEASURED_SPATIAL_RELATION"] },
    humanValidation: { status: "PENDING", validatedBy: null, validatedAt: null, rationale: null },
    publicationEligibility: "INELIGIBLE",
    methodologyVersion: METHODOLOGY,
    ...overrides,
  };
}

function reviewed(base: DenueAnalyticalRelation, rationale = `PPC acepta ${base.relationId}.`): DenueAnalyticalPublicationInput {
  const ledger = createDenueAnalyticalReviewLedger(base);
  if (ledger.status !== "VALID") throw new Error(ledger.reasons.join(","));
  const reviewEvent = buildDenueAnalyticalReviewEvent(base, {
    nextStatus: "ACCEPTED",
    reviewedBy: "ppc-product-1",
    reviewedAt: "2026-09-29T17:00:00.000Z",
    rationale,
  });
  const result = appendDenueAnalyticalReviewEvent(base, ledger.ledger, reviewEvent);
  if (result.status !== "VALID") throw new Error(result.reasons.join(","));
  return { baseRelation: base, relation: result.relation, ledger: result.ledger };
}

function pending(base: DenueAnalyticalRelation): DenueAnalyticalPublicationInput {
  const ledger = createDenueAnalyticalReviewLedger(base);
  if (ledger.status !== "VALID") throw new Error(ledger.reasons.join(","));
  return { baseRelation: base, relation: base, ledger: ledger.ledger };
}

function input(
  layers: DenueGovernedMapLayer[],
  relations: DenueAnalyticalPublicationInput[],
  overrides: Partial<DenueAnalyticalCartographicProductInput> = {}
): DenueAnalyticalCartographicProductInput {
  return {
    expedienteId: EXPEDIENTE_ID,
    geographyId: GEOGRAPHY_ID,
    methodologyVersion: METHODOLOGY,
    canonicalGeographyReference: {
      geographyId: GEOGRAPHY_ID,
      geographyType: "POLYGON",
      geometryType: "Polygon",
      sourceReference: "project://geo-r32b6e-product",
    },
    contextualUniverseCount: 263,
    contextualDisplayedCount: 40,
    denueLayers: layers,
    relations,
    createdAtReference: "snapshot://2026-09-29T17:00:00.000Z",
    ...overrides,
  };
}

function built(productInput: DenueAnalyticalCartographicProductInput) {
  const result = buildDenueAnalyticalCartographicProduct(productInput);
  expect(result.status).toBe("BUILT");
  if (result.status !== "BUILT") throw new Error(result.reasons.join(","));
  return result;
}

describe("R3.2B.6E DENUE analytical cartographic product", () => {
  test("una relacion elegible produce un item, capa derivada y fila complementaria", () => {
    const layer = denueLayer("A", 21.88, -102.30);
    const result = built(input([layer], [reviewed(baseRelation(layer))]));
    expect(result.product.analyticalProductType).toBe("ANALYTICAL_DENUE");
    expect(result.product.productType).toBe("THEMATIC_CONTEXT");
    expect(result.product.mapItems).toHaveLength(1);
    expect(result.product.layers).toHaveLength(1);
    expect(result.product.tableRows).toHaveLength(1);
    expect(result.product.layers[0].geometry).toEqual(layer.geometry);
    expect(result.product.layers[0].epistemicClass).toBe("DERIVED");
    expect(result.product.layers[0].humanReviewStatus).toBe("APPROVED");
    expect(validateDenueAnalyticalCartographicProduct(result.product).accepted).toBe(true);
  });

  test("tres relaciones del mismo DENUE consolidan un pin con tres relationIds", () => {
    const layer = denueLayer("A", 21.88, -102.30);
    const relations = ["one", "two", "three"].map((id) => reviewed(baseRelation(layer, `relation:${id}`)));
    const result = built(input([layer], relations));
    expect(result.product.mapItems).toHaveLength(1);
    expect(result.product.mapItems[0].relationIds).toEqual(["relation:one", "relation:three", "relation:two"]);
    expect(result.product.analyticalEligibleCount).toBe(3);
    expect(result.product.analyticalDisplayedRelationCount).toBe(3);
    expect(result.product.layers[0].analyticalProperties.relations).toHaveLength(3);
  });

  test("dos DENUE distintos producen dos items y labels unicos", () => {
    const first = denueLayer("A", 21.88, -102.30);
    const second = denueLayer("B", 21.91, -102.27);
    const result = built(input([first, second], [reviewed(baseRelation(first)), reviewed(baseRelation(second))]));
    expect(result.product.mapItems).toHaveLength(2);
    expect(result.product.mapItems.map((item) => item.label)).toEqual(["1", "2"]);
    expect(new Set(result.product.mapItems.map((item) => item.denueLayerId)).size).toBe(2);
  });

  test("duplicado exacto se deduplica de manera idempotente", () => {
    const layer = denueLayer("A", 21.88, -102.30);
    const relation = reviewed(baseRelation(layer));
    const result = built(input([layer], [relation, relation]));
    expect(result.duplicateRelationCount).toBe(1);
    expect(result.product.analyticalEligibleCount).toBe(1);
    expect(result.product.mapItems[0].relationIds).toHaveLength(1);
  });

  test("mismo relationId con contenido divergente invalida el producto", () => {
    const layer = denueLayer("A", 21.88, -102.30);
    const first = reviewed(baseRelation(layer, "relation:conflict"));
    const secondBase = baseRelation(layer, "relation:conflict", {
      spatialMetrics: { unit: "METERS", method: "SpatialLayerEngine.getDistance", distanceMeters: 40 },
      measuredFacts: [{ factId: "fact:conflict", metric: "distanceMeters", value: 40, unit: "METERS", sourceRefs: [layer.layerId, "field:relation:conflict"] }],
    });
    const result = buildDenueAnalyticalCartographicProduct(input([layer], [first, reviewed(secondBase)]));
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toContain("RELATION_ID_CONFLICT:relation:conflict");
  });

  test.each([
    ["expediente", { expedienteId: "exp-other" }, "EXPEDIENTE_ID_MISMATCH"],
    ["geography", { geographyId: "geo-other" }, "GEOGRAPHY_ID_MISMATCH"],
    ["methodology", { methodologyVersion: "ADR-026:R3.2B.6E:v2" }, "METHODOLOGY_VERSION_MISMATCH"],
  ])("rechaza mismatch de %s", (_label, relationOverride, expectedPrefix) => {
    const layer = denueLayer("A", 21.88, -102.30);
    const validOverride = _label === "geography"
      ? {
          ...relationOverride,
          lineage: layer.lineage.map((node) => ({ ...node, ...(node.geographyId ? { geographyId: "geo-other" } : {}) })),
        }
      : relationOverride;
    const relation = reviewed(baseRelation(layer, "relation:mismatch", validOverride));
    const result = buildDenueAnalyticalCartographicProduct(input([layer], [relation]));
    expect(result.status).toBe("REJECTED");
    expect(result.reasons.some((reason) => reason.startsWith(expectedPrefix))).toBe(true);
  });

  test("relation.denueLayerId debe corresponder a la observacion gobernada exacta", () => {
    const layer = denueLayer("A", 21.88, -102.30);
    const relation = reviewed(baseRelation(layer, "relation:wrong-layer", { denueLayerId: "denue:missing" }));
    const result = buildDenueAnalyticalCartographicProduct(input([layer], [relation]));
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toContain("RELATION_DENUE_LAYER_MISMATCH:relation:wrong-layer");
  });

  test("labels y seleccion son estables ante distinto orden de entrada", () => {
    const layers = [
      denueLayer("A", 21.87, -102.31),
      denueLayer("B", 21.90, -102.29),
      denueLayer("C", 21.92, -102.26),
    ];
    const relations = layers.map((layer) => reviewed(baseRelation(layer)));
    const first = built(input(layers, relations, { displayConfig: { maxDisplayedPoints: 2, minimumSeparationMeters: 40 } }));
    const second = built(input([layers[2], layers[0], layers[1]], [relations[1], relations[2], relations[0]], {
      displayConfig: { maxDisplayedPoints: 2, minimumSeparationMeters: 40 },
    }));
    expect(first.product.eligibleRelations).toHaveLength(3);
    expect(first.product.mapItems).toHaveLength(2);
    expect(second.product.mapItems).toEqual(first.product.mapItems);
    expect(second.product.selection).toEqual(first.product.selection);
  });

  test("nombre, actividad y rationale no crean score ni alteran seleccion espacial", () => {
    const first = denueLayer("A", 21.87, -102.31);
    const second = denueLayer("B", 21.92, -102.26);
    const baseline = built(input([first, second], [reviewed(baseRelation(first)), reviewed(baseRelation(second))]));
    const changedFirst = {
      ...first,
      observedProperties: { ...first.observedProperties, name: "Nombre completamente distinto", activityCode: "999999" },
    };
    const changedSecond = {
      ...second,
      observedProperties: { ...second.observedProperties, name: "Otro nombre", activityCode: "000001" },
    };
    const changed = built(input(
      [changedFirst, changedSecond],
      [
        reviewed(baseRelation(changedFirst), "Racional humano extenso sin ponderacion."),
        reviewed(baseRelation(changedSecond), "Racional humano breve."),
      ]
    ));
    expect(changed.product.selection.selectedDenueLayerIds).toEqual(baseline.product.selection.selectedDenueLayerIds);
    const serialized = JSON.stringify(changed.product);
    expect(serialized).not.toMatch(/riskScore|vulnerabilityScore|dangerLevel|criminogenicity|priorityRank/);
  });

  test("relaciones no elegibles producen resultado EMPTY valido sin contenido inventado", () => {
    const layer = denueLayer("A", 21.88, -102.30);
    const result = buildDenueAnalyticalCartographicProduct(input([layer], [pending(baseRelation(layer))]));
    expect(result.status).toBe("EMPTY");
    expect(result.product).toBeNull();
    expect(result.validation).toEqual({ accepted: true, status: "ADMITTED", reasons: [] });
    expect(result.rejectedRelations).toHaveLength(1);
  });

  test("preserva universos contextual y analitico, rol secundario y presupuesto institucional", () => {
    const layer = denueLayer("A", 21.88, -102.30);
    const result = built(input([layer], [reviewed(baseRelation(layer))]));
    expect(result.product.contextualUniverseCount).toBe(263);
    expect(result.product.contextualDisplayedCount).toBe(40);
    expect(result.product.analyticalEligibleCount).toBe(1);
    expect(result.product.visualRole).toBe("SECONDARY_VISUAL_CANDIDATE");
    expect(result.product.maxInstitutionalVisualBudget).toBe(5);
  });
});
