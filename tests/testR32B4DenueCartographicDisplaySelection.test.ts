import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { canonicalizeDenuePoisForInstitutionalAnalysis } from "../src/utils/denueCanonicalPoi";
import type { DenueCartographicObservation } from "../src/utils/denueGovernedMapAdapter";
import { buildDenueGovernedCartographicProduct } from "../src/utils/denueGovernedCartographicProduct";
import {
  DEFAULT_DENUE_CARTOGRAPHIC_DISPLAY_CONFIG,
  DENUE_CARTOGRAPHIC_DISPLAY_POLICY,
  selectDenueCartographicDisplay,
  type DenueCartographicDisplayConfig,
} from "../src/utils/denueCartographicDisplaySelection";
import type { GovernedCartographicProduct } from "../src/utils/governedCartographicProduct";

const geography = buildCanonicalProjectGeography({
  projectId: "exp-denue-display",
  type: "POLYGON",
  geographyId: "geo-denue-display-polygon",
  points: [
    { lat: 21.86, lng: -102.32 },
    { lat: 21.86, lng: -102.25 },
    { lat: 21.93, lng: -102.25 },
    { lat: 21.93, lng: -102.32 },
  ],
  now: 1,
});

function buildProduct(raw: Array<Record<string, unknown>>): GovernedCartographicProduct {
  const observations = canonicalizeDenuePoisForInstitutionalAnalysis(raw, {
    expedienteId: "exp-denue-display",
    canonicalGeography: geography,
    acquiredAt: "2026-09-29T00:00:00.000Z",
    query: "DENUE display selection",
  }).institutionalPois as DenueCartographicObservation[];
  const result = buildDenueGovernedCartographicProduct({
    projectId: "exp-denue-display",
    geographyId: geography.geographyId,
    canonicalGeographyReference: {
      geographyId: geography.geographyId,
      geographyType: geography.type,
      geometryType: geography.geometry.type,
      sourceReference: "project://geo-denue-display-polygon",
    },
    observations,
    createdAtReference: "snapshot://2026-09-29T00:00:00.000Z",
  });
  if (!result.product) throw new Error(result.admission.reasons.join(","));
  return result.product;
}

function rawPoint(id: string, lat: number, lng: number) {
  return {
    Id: id,
    Nombre: `Establecimiento ${id}`,
    Clase_actividad: `Actividad ${id}`,
    Domicilio: `Domicilio ${id}`,
    Latitud: lat,
    Longitud: lng,
  };
}

function planned(product: GovernedCartographicProduct, config?: DenueCartographicDisplayConfig) {
  const result = selectDenueCartographicDisplay(product, config);
  if (result.status !== "PLANNED") throw new Error(result.reasons.join(","));
  return result.plan;
}

describe("INFORMES R3.2B.4 DENUE governed cartographic display selection", () => {
  test("A colección pequeña conserva cuatro puntos separados", () => {
    const product = buildProduct([
      rawPoint("A", 21.87, -102.31),
      rawPoint("B", 21.87, -102.27),
      rawPoint("C", 21.91, -102.31),
      rawPoint("D", 21.91, -102.27),
    ]);
    const plan = planned(product);
    expect(plan.totalEligibleLayers).toBe(4);
    expect(plan.selectedLayerIds).toEqual(["denue:A", "denue:B", "denue:C", "denue:D"]);
    expect(plan.omittedLayerIds).toEqual([]);
    expect(plan.audit.omissions).toEqual([]);
  });

  test("B colisiones espaciales escogen representante por layerId y preservan fuente", () => {
    const product = buildProduct([
      rawPoint("A", 21.89, -102.29),
      rawPoint("B", 21.89001, -102.29001),
      rawPoint("C", 21.89, -102.29),
    ]);
    const before = structuredClone(product);
    const plan = planned(product, { maxDisplayedPoints: 10, minimumSeparationMeters: 50 });
    expect(plan.selectedLayerIds).toEqual(["denue:A"]);
    expect(plan.omittedLayerIds).toEqual(["denue:B", "denue:C"]);
    expect(plan.audit.omissions).toEqual([
      expect.objectContaining({ layerId: "denue:B", reason: "SPATIAL_DECONFLICT", nearestSelectedLayerId: "denue:A" }),
      expect.objectContaining({ layerId: "denue:C", reason: "SPATIAL_DECONFLICT", nearestSelectedLayerId: "denue:A" }),
    ]);
    expect(product).toEqual(before);
    expect(product.layers).toHaveLength(3);
  });

  test("C orden permutado produce exactamente el mismo plan y auditoría", () => {
    const product = buildProduct([
      rawPoint("A", 21.871, -102.311),
      rawPoint("B", 21.872, -102.292),
      rawPoint("C", 21.901, -102.301),
      rawPoint("D", 21.919, -102.269),
    ]);
    const permuted = { ...product, layers: [product.layers[3], product.layers[1], product.layers[0], product.layers[2]] };
    expect(planned(permuted, { maxDisplayedPoints: 3, minimumSeparationMeters: 40 }))
      .toEqual(planned(product, { maxDisplayedPoints: 3, minimumSeparationMeters: 40 }));
  });

  test("D 263 capas producen reducción controlada y dejan intacto el universo", () => {
    const raw = Array.from({ length: 263 }, (_, index) => {
      const row = Math.floor(index / 17);
      const column = index % 17;
      return rawPoint(`LARGE-${String(index).padStart(3, "0")}`, 21.875 + row * 0.0002, -102.31 + column * 0.0002);
    });
    const product = buildProduct(raw);
    const snapshot = structuredClone(product);
    const plan = planned(product);
    expect(plan.totalEligibleLayers).toBe(263);
    expect(plan.selectedLayerIds.length).toBeLessThan(263);
    expect(plan.selectedLayerIds.length).toBeLessThanOrEqual(DEFAULT_DENUE_CARTOGRAPHIC_DISPLAY_CONFIG.maxDisplayedPoints);
    expect(plan.omittedLayerIds).toHaveLength(263 - plan.selectedLayerIds.length);
    expect(plan.audit.selectedCount + plan.audit.omittedCount).toBe(263);
    expect(product).toEqual(snapshot);
    expect(product.layers).toHaveLength(263);
  });

  test("E atributos semánticos no alteran la selección espacial", () => {
    const product = buildProduct([
      rawPoint("A", 21.87, -102.31),
      rawPoint("B", 21.871, -102.309),
      rawPoint("C", 21.90, -102.28),
      rawPoint("D", 21.91, -102.27),
    ]);
    const changed = structuredClone(product) as GovernedCartographicProduct & {
      layers: Array<GovernedCartographicProduct["layers"][number] & { observedProperties: Record<string, unknown> }>;
    };
    changed.layers.forEach((layer, index) => {
      layer.observedProperties.name = `Nombre alterado ${index}`;
      layer.observedProperties.category = `Categoría alterada ${index}`;
      layer.observedProperties.activityCode = `Actividad alterada ${index}`;
      layer.observedProperties.distanceMeters = 999999 - index;
    });
    const config = { maxDisplayedPoints: 2, minimumSeparationMeters: 40 };
    expect(planned(changed, config)).toEqual(planned(product, config));
  });

  test("F conserva referencia canónica y funciona con los tres tipos rectores", () => {
    const product = buildProduct([rawPoint("A", 21.89, -102.29), rawPoint("B", 21.90, -102.28)]);
    const references = [
      { geographyType: "INDIVIDUAL" as const, geometryType: "Point" as const },
      { geographyType: "CORRIDOR" as const, geometryType: "LineString" as const },
      { geographyType: "POLYGON" as const, geometryType: "Polygon" as const },
    ];
    for (const reference of references) {
      const candidate = structuredClone(product);
      candidate.canonicalGeographyReference = { ...candidate.canonicalGeographyReference, ...reference };
      const before = structuredClone(candidate.canonicalGeographyReference);
      expect(planned(candidate).selectedLayerIds).toHaveLength(2);
      expect(candidate.canonicalGeographyReference).toEqual(before);
    }
  });

  test("G contrato declara política, parámetros, disclosures y auditoría completa", () => {
    const product = buildProduct([rawPoint("A", 21.89, -102.29), rawPoint("B", 21.89, -102.29)]);
    const plan = planned(product);
    expect(plan.selectionPolicy).toBe(DENUE_CARTOGRAPHIC_DISPLAY_POLICY);
    expect(plan.selectionParameters).toEqual(DEFAULT_DENUE_CARTOGRAPHIC_DISPLAY_CONFIG);
    expect(plan.disclosure).toEqual([
      "DENUE_DISPLAY_SELECTION_FOR_CARTOGRAPHIC_LEGIBILITY",
      "DENUE_DISPLAY_SELECTION_NOT_ANALYTICAL_RANKING",
      "DENUE_DISPLAY_SELECTION_DOES_NOT_MODIFY_SOURCE_UNIVERSE",
    ]);
    expect(plan.audit).toMatchObject({
      totalEligible: 2,
      selectedCount: 1,
      omittedCount: 1,
      deterministicTieBreaker: "LAYER_ID_CANONICAL_ASC",
      policy: DENUE_CARTOGRAPHIC_DISPLAY_POLICY,
    });
  });

  test.each([
    ["product null", null, undefined, "PRODUCT_REQUIRED"],
    ["product no ADMITTED", () => ({ ...buildProduct([rawPoint("A", 21.89, -102.29)]), title: "" }), undefined, "PRODUCT_NOT_ADMITTED"],
    ["tipo incorrecto", () => ({ ...buildProduct([rawPoint("A", 21.89, -102.29)]), productType: "THEMATIC_CONTEXT" as const }), undefined, "DENUE_OBSERVATION_MAP_REQUIRED"],
    ["geographyId ausente", () => ({ ...buildProduct([rawPoint("A", 21.89, -102.29)]), geographyId: "" }), undefined, "GEOGRAPHY_ID_REQUIRED"],
    ["Point inválido", () => {
      const product = buildProduct([rawPoint("A", 21.89, -102.29)]);
      return { ...product, layers: [{ ...product.layers[0], geometry: { type: "Point" as const, coordinates: [999, 21.89] as [number, number] } }] };
    }, undefined, "LAYER:denue:A:VALID_POINT_REQUIRED"],
    ["budget cero", () => buildProduct([rawPoint("A", 21.89, -102.29)]), { maxDisplayedPoints: 0, minimumSeparationMeters: 40 }, "MAX_DISPLAYED_POINTS_INVALID"],
    ["separación inválida", () => buildProduct([rawPoint("A", 21.89, -102.29)]), { maxDisplayedPoints: 5, minimumSeparationMeters: Number.NaN }, "MINIMUM_SEPARATION_METERS_INVALID"],
    ["IDs duplicados", () => {
      const product = buildProduct([rawPoint("A", 21.89, -102.29), rawPoint("B", 21.90, -102.28)]);
      return { ...product, layers: [product.layers[0], { ...product.layers[1], layerId: product.layers[0].layerId }] };
    }, undefined, "LAYER:denue:A:DUPLICATE_LAYER_ID"],
  ])("H falla cerrado: %s", (_label, productFactory, config, expectedReason) => {
    const product = typeof productFactory === "function" ? productFactory() : productFactory;
    const result = selectDenueCartographicDisplay(product as GovernedCartographicProduct | null, config as DenueCartographicDisplayConfig | undefined);
    expect(result.status).toBe("REJECTED");
    expect(result.plan).toBeNull();
    expect(result.reasons).toContain(expectedReason);
  });
});
