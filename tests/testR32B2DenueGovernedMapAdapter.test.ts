import { evaluateCartographicAdmission } from "../src/utils/cartographicAdmissionGate";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import {
  adaptDenueObservationToGovernedMapLayer,
  type DenueCartographicObservation,
  type DenueGovernedMapLayer,
} from "../src/utils/denueGovernedMapAdapter";
import { canonicalizeDenuePoisForInstitutionalAnalysis } from "../src/utils/denueCanonicalPoi";
import type { GovernedCartographicProduct } from "../src/utils/governedCartographicProduct";

const canonicalGeography = buildCanonicalProjectGeography({
  projectId: "exp-denue-map",
  type: "POLYGON",
  geographyId: "geo-denue-map-polygon",
  points: [
    { lat: 21.87, lng: -102.31 },
    { lat: 21.87, lng: -102.27 },
    { lat: 21.91, lng: -102.27 },
    { lat: 21.91, lng: -102.31 },
  ],
  now: 1,
});

function canonicalDenue(): DenueCartographicObservation {
  const result = canonicalizeDenuePoisForInstitutionalAnalysis([{
    Id: "010010001234",
    CLEE: "CLEE010010001234",
    Nombre: "Abarrotes Observados",
    Clase_actividad: "Comercio al por menor en tiendas de abarrotes",
    Domicilio: "Calle Observada 100",
    Latitud: "21.88182",
    Longitud: "-102.29163",
  }], {
    expedienteId: "exp-denue-map",
    canonicalGeography,
    acquiredAt: "2026-09-29T00:00:00.000Z",
    query: "DENUE observed query",
  });
  return result.institutionalPois[0];
}

function productFor(layer: DenueGovernedMapLayer): GovernedCartographicProduct {
  return {
    productId: "product-denue-observations",
    productType: "OBSERVATION_MAP",
    geographyId: canonicalGeography.geographyId,
    canonicalGeographyReference: {
      geographyId: canonicalGeography.geographyId,
      geographyType: canonicalGeography.type,
      geometryType: canonicalGeography.geometry.type,
      sourceReference: "project://geo-denue-map-polygon",
    },
    title: "Observaciones DENUE",
    purpose: "Representar establecimientos DENUE observados sin inferencia criminológica",
    layers: [layer],
    sourceReferences: [layer.sourceReference],
    traceabilityIds: layer.traceabilityIds,
    limitations: layer.limitations,
    publicationEligibility: layer.publicationEligibility,
    humanReviewStatus: layer.humanReviewStatus,
    createdAtReference: "snapshot://2026-09-29T00:00:00.000Z",
  };
}

function adapt(input: DenueCartographicObservation = canonicalDenue()) {
  return adaptDenueObservationToGovernedMapLayer(input, { productId: "product-denue-observations" });
}

describe("INFORMES R3.2B.2 DENUE governed map adapter", () => {
  test("A DENUE canónico completo produce OBSERVED Point y supera admission gate", () => {
    const result = adapt();
    expect(result.status).toBe("ADAPTED");
    if (result.status !== "ADAPTED") throw new Error(result.reasons.join(","));
    expect(result.layer.epistemicClass).toBe("OBSERVED");
    expect(result.layer.geometry.type).toBe("Point");
    expect(result.layer.publicationEligibility).toBe("ELIGIBLE");
    expect(result.layer.humanReviewStatus).toBe("UNREVIEWED");
    expect(result.layer.datasetReference).toBeNull();
    expect(result.layer.queryReference).toBeNull();
    expect(result.layer.lineage.map((node) => `${node.type}:${node.id}`)).toEqual(expect.arrayContaining([
      `GEOGRAPHY:${canonicalGeography.geographyId}`,
      "SOURCE:inegi-denue-api",
      "EVIDENCE:denue:010010001234",
    ]));
    expect(evaluateCartographicAdmission(productFor(result.layer))).toEqual({ accepted: true, status: "ADMITTED", reasons: [] });
  });

  test("B preserva semántica, fuente, categoría, actividad y distancia sin mutar entrada", () => {
    const input: DenueCartographicObservation = {
      ...canonicalDenue(),
      category: "Comercio minorista",
      distanceMeters: 42,
    };
    const snapshot = JSON.stringify(input);
    const result = adapt(input);
    expect(result.status).toBe("ADAPTED");
    if (result.status !== "ADAPTED") throw new Error(result.reasons.join(","));
    expect(result.layer.layerId).toBe(input.sourceEvidenceId);
    expect(result.layer.sourceType).toBe(input.source);
    expect(result.layer.sourceReference).toBe(input.sourceReference);
    expect(result.layer.sourceItemIds).toEqual([input.sourceEvidenceId]);
    expect(result.layer.traceabilityIds).toEqual([input.traceabilityId]);
    expect(result.layer.observedProperties).toMatchObject({
      name: input.name,
      activityCode: input.activityCode,
      address: input.address,
      category: "Comercio minorista",
      distanceMeters: 42,
      publicationRole: "TERRITORIAL_CONTEXT",
      semanticRole: "SOURCE_FACT",
      isCriminalEvidence: false,
    });
    expect(result.layer.limitations).toEqual(["DENUE_TERRITORIAL_CONTEXT_ONLY", "DENUE_NOT_CRIMINAL_EVIDENCE"]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  test("C usa orden GeoJSON [lng, lat] sin invertir coordenadas", () => {
    const input = canonicalDenue();
    const result = adapt(input);
    expect(result.status).toBe("ADAPTED");
    if (result.status !== "ADAPTED") throw new Error(result.reasons.join(","));
    expect(result.layer.geometry).toEqual({ type: "Point", coordinates: [input.lng, input.lat] });
  });

  test("identidad de capa es estable y no depende de reloj o aleatoriedad", () => {
    const first = adapt();
    const second = adapt();
    expect(first.status).toBe("ADAPTED");
    expect(second.status).toBe("ADAPTED");
    if (first.status !== "ADAPTED" || second.status !== "ADAPTED") throw new Error("DENUE adaptation failed");
    expect(first.layer.layerId).toBe("denue:010010001234");
    expect(second.layer.layerId).toBe(first.layer.layerId);
  });

  test.each([
    ["lat faltante", { lat: undefined }, "DENUE_LATITUDE_INVALID"],
    ["lng faltante", { lng: undefined }, "DENUE_LONGITUDE_INVALID"],
    ["lat inválida", { lat: 91, coordinates: { lat: 91, lng: -102.29163 } }, "DENUE_LATITUDE_INVALID"],
    ["lng inválida", { lng: -181, coordinates: { lat: 21.88182, lng: -181 } }, "DENUE_LONGITUDE_INVALID"],
    ["sourceReference faltante", { sourceReference: "", epistemicIntegrity: { ...canonicalDenue().epistemicIntegrity, sourceReference: "" } }, "SOURCE_REFERENCE_REQUIRED"],
    ["traceability faltante", { traceabilityId: "", epistemicIntegrity: { ...canonicalDenue().epistemicIntegrity, traceabilityId: "" } }, "TRACEABILITY_ID_REQUIRED"],
    ["geographyId faltante", { geographyId: "" }, "GEOGRAPHY_ID_REQUIRED"],
    ["id faltante", { id: "" }, "DENUE_ID_REQUIRED"],
    ["geometry preconstruida", { geometry: { type: "Point", coordinates: [-102.2, 21.8] } }, "DENUE_PRECOMPUTED_GEOMETRY_FORBIDDEN"],
    ["coordenadas 0,0", { lat: 0, lng: 0, coordinates: { lat: 0, lng: 0 } }, "DENUE_NULL_ISLAND_FORBIDDEN"],
  ])("rechaza %s antes del gate", (_label, overrides, expectedReason) => {
    const input = { ...canonicalDenue(), ...overrides } as DenueCartographicObservation;
    const result = adapt(input);
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toContain(expectedReason);
    expect(result.layer).toBeNull();
  });

  test("rechaza observación contextual y no la promueve a institucional", () => {
    const result = adapt({ ...canonicalDenue(), territorialStatus: "CONTEXTUAL_ONLY" });
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toEqual(expect.arrayContaining([
      "DENUE_NOT_INSTITUTIONAL",
      "DENUE_PUBLICATION_ELIGIBILITY_UNRESOLVED",
    ]));
  });

  test("rechaza publicationEligibility INELIGIBLE explícita", () => {
    const result = adapt({ ...canonicalDenue(), publicationEligibility: "INELIGIBLE" });
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toContain("DENUE_PUBLICATION_INELIGIBLE");
  });

  test("rechaza trazabilidad inconsistente entre POI e integridad epistemológica", () => {
    const input = canonicalDenue();
    const result = adapt({
      ...input,
      epistemicIntegrity: { ...input.epistemicIntegrity, traceabilityId: "trace:different" },
    });
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toContain("DENUE_TRACEABILITY_MISMATCH");
  });
});
