import { evaluateCartographicAdmission } from "../src/utils/cartographicAdmissionGate";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import type { GovernedCartographicProduct, GovernedMapLayer } from "../src/utils/governedCartographicProduct";

const point = { type: "Point" as const, coordinates: [-102.29, 21.88] as [number, number] };
const line = {
  type: "LineString" as const,
  coordinates: [[-102.29, 21.88], [-102.28, 21.89]] as [number, number][],
};
const polygon = {
  type: "Polygon" as const,
  coordinates: [[
    [-102.30, 21.87],
    [-102.27, 21.87],
    [-102.27, 21.90],
    [-102.30, 21.87],
  ]] as [number, number][][],
};

const lineage = buildEvidenceLineage({
  geographyId: "geo-1",
  sourceId: "source-1",
  sourceReference: "dataset://source-1",
  evidenceId: "evidence-1",
});

function observedLayer(overrides: Record<string, unknown> = {}): GovernedMapLayer {
  return {
    layerId: "layer-observed",
    productId: "product-1",
    layerType: "OBSERVATION_POINTS",
    epistemicClass: "OBSERVED",
    geographyId: "geo-1",
    geometry: point,
    geometryType: "Point",
    sourceType: "AUTHORITATIVE_DATASET",
    sourceReference: "dataset://source-1",
    sourceItemIds: ["evidence-1"],
    datasetReference: { datasetId: "dataset-1" },
    queryReference: { queryId: "query-1", status: "EXECUTED" },
    traceabilityIds: ["trace-1"],
    lineage,
    variables: ["location"],
    transformation: null,
    method: null,
    limitations: [],
    humanReviewStatus: "NOT_REQUIRED",
    publicationEligibility: "ELIGIBLE",
    styleSpecification: { symbolizer: "MARKER" },
    disclosure: null,
    ...overrides,
  } as GovernedMapLayer;
}

function product(layer: GovernedMapLayer, overrides: Record<string, unknown> = {}): GovernedCartographicProduct {
  return {
    productId: "product-1",
    productType: "OBSERVATION_MAP",
    geographyId: "geo-1",
    canonicalGeographyReference: {
      geographyId: "geo-1",
      geographyType: "POLYGON",
      geometryType: "Polygon",
      sourceReference: "project://geo-1",
    },
    title: "Mapa gobernado",
    purpose: "Representar observaciones admitidas",
    layers: [layer],
    sourceReferences: ["dataset://source-1"],
    traceabilityIds: ["trace-1"],
    limitations: [],
    publicationEligibility: "ELIGIBLE",
    humanReviewStatus: "NOT_REQUIRED",
    createdAtReference: "snapshot://2026-09-29T00:00:00Z",
    ...overrides,
  } as GovernedCartographicProduct;
}

function derivedLayer(overrides: Record<string, unknown> = {}): GovernedMapLayer {
  return {
    ...observedLayer(),
    layerId: "layer-derived",
    layerType: "DENSITY_SURFACE",
    epistemicClass: "DERIVED",
    sourceReference: "analysis://density-1",
    observedSourceReferences: ["dataset://source-1"],
    variables: ["incident_count", "location"],
    transformation: "Aggregate admitted observations into fixed cells",
    method: "Deterministic fixed-grid count",
    limitations: ["Cell boundaries affect aggregation"],
    humanReviewStatus: "APPROVED",
    ...overrides,
  } as GovernedMapLayer;
}

function hypothesisLayer(overrides: Record<string, unknown> = {}): GovernedMapLayer {
  return {
    ...observedLayer(),
    layerId: "layer-hypothesis",
    layerType: "HYPOTHESIS_GEOMETRY",
    epistemicClass: "HYPOTHESIS",
    sourceReference: "hypothesis://human-1",
    hypothesisReference: "hypothesis://human-1",
    humanReviewStatus: "APPROVED",
    publicationEligibility: "ELIGIBLE_WITH_DISCLOSURE",
    disclosure: { code: "HUMAN_HYPOTHESIS", message: "Representación de una hipótesis humana.", visible: true },
    ...overrides,
  } as GovernedMapLayer;
}

describe("INFORMES R3.2B.1 cartographic admission gate", () => {
  test("A OBSERVED válido con Point real es admitido", () => {
    expect(evaluateCartographicAdmission(product(observedLayer()))).toEqual({ accepted: true, status: "ADMITTED", reasons: [] });
  });

  test("B OBSERVED sin sourceReference es rechazado", () => {
    const result = evaluateCartographicAdmission(product(observedLayer({ sourceReference: "" })));
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toContain("LAYER:layer-observed:SOURCE_REFERENCE_REQUIRED");
  });

  test("C DERIVED válido declara fuentes observadas, método, transformación, variables y lineage", () => {
    expect(evaluateCartographicAdmission(product(derivedLayer()))).toEqual({ accepted: true, status: "ADMITTED", reasons: [] });
  });

  test("D DERIVED sin método es rechazado", () => {
    const result = evaluateCartographicAdmission(product(derivedLayer({ method: "" })));
    expect(result.reasons).toContain("LAYER:layer-derived:METHOD_REQUIRED");
  });

  test("E HYPOTHESIS sin disclosure es rechazado", () => {
    const result = evaluateCartographicAdmission(product(hypothesisLayer({ disclosure: null }), {
      publicationEligibility: "ELIGIBLE_WITH_DISCLOSURE",
      humanReviewStatus: "APPROVED",
    }));
    expect(result.reasons).toContain("LAYER:layer-hypothesis:VISIBLE_DISCLOSURE_REQUIRED");
  });

  test("F HYPOTHESIS humana aprobada con disclosure es admitida", () => {
    const result = evaluateCartographicAdmission(product(hypothesisLayer(), {
      productType: "HYPOTHESIS_MAP",
      publicationEligibility: "ELIGIBLE_WITH_DISCLOSURE",
      humanReviewStatus: "APPROVED",
    }));
    expect(result).toEqual({ accepted: true, status: "ADMITTED", reasons: [] });
  });

  test("G PREDICTIVE no se auto-promueve a ELIGIBLE", () => {
    const predictive = {
      ...derivedLayer(),
      layerId: "layer-predictive",
      layerType: "PREDICTIVE_GEOMETRY",
      epistemicClass: "PREDICTIVE",
      predictionReference: "prediction://1",
      disclosure: { code: "PREDICTIVE", message: "Proyección, no observación.", visible: true },
      publicationEligibility: "ELIGIBLE",
      governanceAuthorizationReference: null,
    } as GovernedMapLayer;
    const result = evaluateCartographicAdmission(product(predictive));
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toContain("LAYER:layer-predictive:PREDICTIVE_AUTO_PUBLICATION_FORBIDDEN");
  });

  test("PREDICTIVE INELIGIBLE se conserva en el contrato pero no supera admisión de render/publicación", () => {
    const predictive = {
      ...derivedLayer(),
      layerId: "layer-predictive",
      layerType: "PREDICTIVE_GEOMETRY",
      epistemicClass: "PREDICTIVE",
      predictionReference: "prediction://1",
      disclosure: { code: "PREDICTIVE", message: "Proyección, no observación.", visible: true },
      publicationEligibility: "INELIGIBLE",
      humanReviewStatus: "PENDING_REVIEW",
    } as GovernedMapLayer;
    const result = evaluateCartographicAdmission(product(predictive, { publicationEligibility: "INELIGIBLE" }));
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toEqual(expect.arrayContaining([
      "PRODUCT_INELIGIBLE",
      "LAYER:layer-predictive:PUBLICATION_INELIGIBLE",
    ]));
  });

  test.each([
    ["INDIVIDUAL", "Point", point],
    ["CORRIDOR", "LineString", line],
    ["POLYGON", "Polygon", polygon],
  ] as const)("H preserva %s como %s", (geographyType, geometryType, geometry) => {
    const layer = observedLayer({ layerType: "CANONICAL_GEOGRAPHY", geometryType, geometry });
    const result = evaluateCartographicAdmission(product(layer, {
      productType: "TERRITORIAL_CONTEXT",
      canonicalGeographyReference: {
        geographyId: "geo-1",
        geographyType,
        geometryType,
        sourceReference: "project://geo-1",
      },
    }));
    expect(result).toEqual({ accepted: true, status: "ADMITTED", reasons: [] });
  });

  test("I Polygon con anillo abierto es rechazado", () => {
    const openPolygon = { type: "Polygon", coordinates: [[[-102.3, 21.8], [-102.2, 21.8], [-102.2, 21.9], [-102.3, 21.9]]] };
    const result = evaluateCartographicAdmission(product(observedLayer({ geometry: openPolygon, geometryType: "Polygon" })));
    expect(result.reasons).toContain("LAYER:layer-observed:GEOMETRY_INVALID");
  });

  test("I Polygon con menos de tres vértices distintos es rechazado", () => {
    const collapsedPolygon = { type: "Polygon", coordinates: [[[-102.3, 21.8], [-102.2, 21.8], [-102.3, 21.8], [-102.3, 21.8]]] };
    const result = evaluateCartographicAdmission(product(observedLayer({ geometry: collapsedPolygon, geometryType: "Polygon" })));
    expect(result.reasons).toContain("LAYER:layer-observed:GEOMETRY_INVALID");
  });

  test("J Corridor con menos de dos puntos es rechazado", () => {
    const invalidLine = { type: "LineString", coordinates: [[-102.3, 21.8]] };
    const result = evaluateCartographicAdmission(product(observedLayer({ geometry: invalidLine, geometryType: "LineString" })));
    expect(result.reasons).toContain("LAYER:layer-observed:GEOMETRY_INVALID");
  });

  test("rechaza degradación canónica POLYGON a Point", () => {
    const canonicalPoint = observedLayer({ layerType: "CANONICAL_GEOGRAPHY" });
    const result = evaluateCartographicAdmission(product(canonicalPoint, { productType: "TERRITORIAL_CONTEXT" }));
    expect(result.reasons).toContain("CANONICAL_LAYER_GEOMETRY_DEGRADATION_FORBIDDEN");
  });

  test("rechaza geometría arbitraria sin discriminador admitido", () => {
    const result = evaluateCartographicAdmission(product(observedLayer({
      geometry: { type: "Circle", center: [-102.29, 21.88], radius: 500 },
      geometryType: "Circle",
    })));
    expect(result.reasons).toContain("LAYER:layer-observed:GEOMETRY_INVALID");
  });

  test.each([
    ["MultiPoint", { type: "MultiPoint", coordinates: [[-102.29, 21.88], [-102.28, 21.89]] }],
    ["MultiLineString", { type: "MultiLineString", coordinates: [[[-102.29, 21.88], [-102.28, 21.89]]] }],
    ["MultiPolygon", { type: "MultiPolygon", coordinates: [[[[-102.30, 21.87], [-102.27, 21.87], [-102.27, 21.90], [-102.30, 21.87]]]] }],
  ])("admite geometría GeoJSON %s estructuralmente válida", (geometryType, geometry) => {
    const result = evaluateCartographicAdmission(product(observedLayer({ geometryType, geometry })));
    expect(result).toEqual({ accepted: true, status: "ADMITTED", reasons: [] });
  });

  test("rechaza OBSERVED sin trazabilidad ni lineage soportado", () => {
    const result = evaluateCartographicAdmission(product(observedLayer({ traceabilityIds: [], lineage: [] })));
    expect(result.reasons).toEqual(expect.arrayContaining([
      "LAYER:layer-observed:TRACEABILITY_REQUIRED",
      "LAYER:layer-observed:SUPPORTED_LINEAGE_REQUIRED",
    ]));
  });

  test("rechaza DERIVED huérfano, sin transformación, variables, limitaciones ni aprobación", () => {
    const result = evaluateCartographicAdmission(product(derivedLayer({
      observedSourceReferences: [],
      transformation: "",
      variables: [],
      limitations: [],
      humanReviewStatus: "PENDING_REVIEW",
    })));
    expect(result.reasons).toEqual(expect.arrayContaining([
      "LAYER:layer-derived:OBSERVED_SOURCE_REFERENCES_REQUIRED",
      "LAYER:layer-derived:TRANSFORMATION_REQUIRED",
      "LAYER:layer-derived:VARIABLES_REQUIRED",
      "LAYER:layer-derived:LIMITATIONS_REQUIRED",
      "LAYER:layer-derived:HUMAN_APPROVAL_REQUIRED",
    ]));
  });

  test("rechaza HYPOTHESIS sin referencia humana o aprobación", () => {
    const result = evaluateCartographicAdmission(product(hypothesisLayer({
      hypothesisReference: "",
      humanReviewStatus: "PENDING_REVIEW",
    }), { publicationEligibility: "ELIGIBLE_WITH_DISCLOSURE" }));
    expect(result.reasons).toEqual(expect.arrayContaining([
      "LAYER:layer-hypothesis:HYPOTHESIS_REFERENCE_REQUIRED",
      "LAYER:layer-hypothesis:HUMAN_APPROVAL_REQUIRED",
    ]));
  });

  test("rechaza referencias dataset/query incompletas", () => {
    const result = evaluateCartographicAdmission(product(observedLayer({
      datasetReference: {},
      queryReference: { status: "EXECUTED" },
    })));
    expect(result.reasons).toEqual(expect.arrayContaining([
      "LAYER:layer-observed:DATASET_REFERENCE_INVALID",
      "LAYER:layer-observed:QUERY_REFERENCE_INVALID",
    ]));
  });

  test("rechaza producto sin identificadores, fuentes, trazabilidad o capas", () => {
    const result = evaluateCartographicAdmission({
      ...product(observedLayer()),
      productId: "",
      geographyId: "",
      sourceReferences: [],
      traceabilityIds: [],
      layers: [],
    });
    expect(result.reasons).toEqual(expect.arrayContaining([
      "PRODUCT_ID_REQUIRED",
      "GEOGRAPHY_ID_REQUIRED",
      "SOURCE_REFERENCES_REQUIRED",
      "TRACEABILITY_REQUIRED",
      "LAYERS_REQUIRED",
    ]));
  });

  test("rechaza identificadores de capa duplicados", () => {
    const duplicate = observedLayer();
    const result = evaluateCartographicAdmission(product(duplicate, { layers: [duplicate, duplicate] }));
    expect(result.reasons).toContain("LAYER:layer-observed:DUPLICATE_LAYER_ID");
  });

  test("rechaza geometryType distinto del discriminador geométrico", () => {
    const result = evaluateCartographicAdmission(product(observedLayer({ geometryType: "LineString" })));
    expect(result.reasons).toContain("LAYER:layer-observed:GEOMETRY_TYPE_MISMATCH");
  });
});
