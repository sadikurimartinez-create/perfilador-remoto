import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { canonicalizeDenuePoisForInstitutionalAnalysis } from "../src/utils/denueCanonicalPoi";
import type { DenueCartographicObservation } from "../src/utils/denueGovernedMapAdapter";
import { buildDenueGovernedCartographicProduct } from "../src/utils/denueGovernedCartographicProduct";

const geography = buildCanonicalProjectGeography({
  projectId: "exp-denue-product",
  type: "POLYGON",
  geographyId: "geo-denue-product-polygon",
  points: [
    { lat: 21.87, lng: -102.31 },
    { lat: 21.87, lng: -102.27 },
    { lat: 21.91, lng: -102.27 },
    { lat: 21.91, lng: -102.31 },
  ],
  now: 1,
});

function observations(): DenueCartographicObservation[] {
  return canonicalizeDenuePoisForInstitutionalAnalysis([
    { Id: "DENUE-A", Nombre: "Comercio A", Clase_actividad: "Actividad A", Domicilio: "Calle A", Latitud: 21.881, Longitud: -102.291 },
    { Id: "DENUE-B", Nombre: "Comercio B", Clase_actividad: "Actividad B", Domicilio: "Calle B", Latitud: 21.882, Longitud: -102.292 },
    { Id: "DENUE-C", Nombre: "Comercio C", Clase_actividad: "Actividad C", Domicilio: "Calle C", Latitud: 21.883, Longitud: -102.293 },
  ], {
    expedienteId: "exp-denue-product",
    canonicalGeography: geography,
    acquiredAt: "2026-09-29T00:00:00.000Z",
    query: "DENUE governed collection",
  }).institutionalPois;
}

function build(inputObservations: DenueCartographicObservation[]) {
  return buildDenueGovernedCartographicProduct({
    projectId: "exp-denue-product",
    geographyId: geography.geographyId,
    canonicalGeographyReference: {
      geographyId: geography.geographyId,
      geographyType: geography.type,
      geometryType: geography.geometry.type,
      sourceReference: "project://geo-denue-product-polygon",
    },
    observations: inputObservations,
    createdAtReference: "snapshot://2026-09-29T00:00:00.000Z",
  });
}

describe("INFORMES R3.2B.3 DENUE governed cartographic product", () => {
  test("A tres DENUE válidos producen tres capas OBSERVED y producto ADMITTED", () => {
    const result = build(observations());
    expect(result.admission).toEqual({ accepted: true, status: "ADMITTED", reasons: [] });
    expect(result.product?.productType).toBe("OBSERVATION_MAP");
    expect(result.product?.layers).toHaveLength(3);
    expect(result.product?.layers.every((layer) => layer.epistemicClass === "OBSERVED")).toBe(true);
    expect(result.acceptedLayerIds).toEqual(["denue:DENUE-A", "denue:DENUE-B", "denue:DENUE-C"]);
    expect(result.rejectedObservations).toEqual([]);
  });

  test("B duplicado exacto por sourceEvidenceId produce una sola capa", () => {
    const [first] = observations();
    const result = build([first, structuredClone(first)]);
    expect(result.admission.status).toBe("ADMITTED");
    expect(result.product?.layers).toHaveLength(1);
    expect(result.acceptedLayerIds).toEqual([first.sourceEvidenceId]);
    expect(result.duplicateObservationCount).toBe(1);
    expect(result.rejectedObservations).toEqual([]);
  });

  test("C orden permutado produce producto y admisión equivalentes", () => {
    const [a, b, c] = observations();
    const ordered = build([a, b, c]);
    const permuted = build([c, a, b]);
    expect(permuted.product).toEqual(ordered.product);
    expect(permuted.acceptedLayerIds).toEqual(ordered.acceptedLayerIds);
    expect(permuted.admission).toEqual(ordered.admission);
    expect(permuted.rejectedObservations).toEqual(ordered.rejectedObservations);
  });

  test("D consolida fuentes, trazabilidad y limitaciones sin duplicados", () => {
    const result = build(observations());
    expect(result.product?.sourceReferences).toEqual([
      "src/utils/denueCanonicalPoi.ts:canonicalizeDenuePoisForInstitutionalAnalysis",
    ]);
    expect(result.product?.traceabilityIds).toHaveLength(3);
    expect(new Set(result.product?.traceabilityIds).size).toBe(3);
    expect(result.product?.limitations).toEqual([
      "DENUE_NO_CAUSAL_INFERENCE",
      "DENUE_NOT_CRIMINAL_EVIDENCE",
      "DENUE_NOT_FINDING",
      "DENUE_NOT_RISK_ASSESSMENT",
      "DENUE_TERRITORIAL_CONTEXT_ONLY",
    ]);
  });

  test("E todas las capas conservan geographyId sin mutar referencia canónica", () => {
    const referenceSnapshot = JSON.stringify(geography);
    const result = build(observations());
    expect(result.product?.geographyId).toBe(geography.geographyId);
    expect(result.product?.layers.every((layer) => layer.geographyId === geography.geographyId)).toBe(true);
    expect(result.product?.canonicalGeographyReference.geometryType).toBe("Polygon");
    expect(JSON.stringify(geography)).toBe(referenceSnapshot);
  });

  test("colección mixta admite dos válidos y documenta exactamente un rechazo", () => {
    const [a, b, c] = observations();
    const invalid = { ...c, traceabilityId: "", epistemicIntegrity: { ...c.epistemicIntegrity, traceabilityId: "" } };
    const result = build([a, invalid, b]);
    expect(result.admission.status).toBe("ADMITTED");
    expect(result.acceptedLayerIds).toEqual([a.sourceEvidenceId, b.sourceEvidenceId]);
    expect(result.rejectedObservations).toHaveLength(1);
    expect(result.rejectedObservations[0]).toMatchObject({
      sourceEvidenceId: c.sourceEvidenceId,
      reasons: expect.arrayContaining(["TRACEABILITY_ID_REQUIRED"]),
    });
  });

  test("geographyId distinto se rechaza sin reasignación automática", () => {
    const [a, b] = observations();
    const mismatch = { ...b, geographyId: "geo-other" };
    const result = build([a, mismatch]);
    expect(result.admission.status).toBe("ADMITTED");
    expect(result.acceptedLayerIds).toEqual([a.sourceEvidenceId]);
    expect(result.rejectedObservations[0].reasons).toContain("DENUE_GEOGRAPHY_ID_MISMATCH");
    expect(mismatch.geographyId).toBe("geo-other");
  });

  test("identidad compartida con contenido incompatible rechaza todo el grupo", () => {
    const [a] = observations();
    const conflict = {
      ...a,
      lat: a.lat + 0.001,
      coordinates: { ...a.coordinates, lat: a.coordinates.lat + 0.001 },
    };
    const result = build([a, conflict]);
    expect(result.product).toBeNull();
    expect(result.admission).toEqual({
      accepted: false,
      status: "REJECTED",
      reasons: ["DENUE_PRODUCT_NO_ADMITTED_LAYERS"],
    });
    expect(result.rejectedObservations).toHaveLength(2);
    expect(result.rejectedObservations.every((item) => item.reasons.includes("DENUE_DUPLICATE_IDENTITY_CONFLICT"))).toBe(true);
  });

  test("registro INELIGIBLE no eleva la elegibilidad del producto", () => {
    const [a] = observations();
    const result = build([{ ...a, publicationEligibility: "INELIGIBLE" }]);
    expect(result.product).toBeNull();
    expect(result.rejectedObservations[0].reasons).toContain("DENUE_PUBLICATION_INELIGIBLE");
  });

  test("ELIGIBLE_WITH_DISCLOSURE se consolida conservadoramente sin elevar a ELIGIBLE", () => {
    const [a, b] = observations();
    const result = build([a, { ...b, publicationEligibility: "ELIGIBLE_WITH_DISCLOSURE" }]);
    expect(result.admission.status).toBe("ADMITTED");
    expect(result.product?.publicationEligibility).toBe("ELIGIBLE_WITH_DISCLOSURE");
  });

  test("colección vacía es rechazada sin construir producto", () => {
    const result = build([]);
    expect(result.product).toBeNull();
    expect(result.admission).toEqual({ accepted: false, status: "REJECTED", reasons: ["DENUE_OBSERVATIONS_REQUIRED"] });
  });

  test("colección sin capas admitidas es rechazada explícitamente", () => {
    const [a] = observations();
    const result = build([{ ...a, traceabilityId: "", epistemicIntegrity: { ...a.epistemicIntegrity, traceabilityId: "" } }]);
    expect(result.product).toBeNull();
    expect(result.admission.reasons).toEqual(["DENUE_PRODUCT_NO_ADMITTED_LAYERS"]);
    expect(result.rejectedObservations).toHaveLength(1);
  });

  test("productId es determinista y no depende de timestamp u orden", () => {
    const [a, b] = observations();
    const first = build([a, b]);
    const second = build([b, a]);
    expect(first.product?.productId).toBe(`denue:observation-map:${geography.geographyId}`);
    expect(second.product?.productId).toBe(first.product?.productId);
  });
});
