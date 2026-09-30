import { buildCanonicalProjectGeography, type CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { canonicalizeDenuePoisForInstitutionalAnalysis } from "../src/utils/denueCanonicalPoi";
import type { DenueCartographicObservation } from "../src/utils/denueGovernedMapAdapter";
import { buildDenueGovernedCartographicProduct } from "../src/utils/denueGovernedCartographicProduct";
import { selectDenueCartographicDisplay, type DenueCartographicDisplayPlan } from "../src/utils/denueCartographicDisplaySelection";
import { buildExecutiveCanonicalTerritorialMapSpec } from "../src/utils/executiveCanonicalTerritorialMap";
import type { GovernedCartographicProduct } from "../src/utils/governedCartographicProduct";

function geography(type: "INDIVIDUAL" | "CORRIDOR" | "POLYGON"): CanonicalProjectGeography {
  const points = type === "INDIVIDUAL"
    ? [{ lat: 21.89, lng: -102.29 }]
    : type === "CORRIDOR"
      ? [{ lat: 21.88, lng: -102.30 }, { lat: 21.90, lng: -102.28 }]
      : [
          { lat: 21.87, lng: -102.31 },
          { lat: 21.87, lng: -102.27 },
          { lat: 21.91, lng: -102.27 },
          { lat: 21.91, lng: -102.31 },
        ];
  return buildCanonicalProjectGeography({
    projectId: `exp-b5-${type.toLowerCase()}`,
    type,
    geographyId: `geo-b5-${type.toLowerCase()}`,
    points,
    now: 1,
  });
}

function rawPoints(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    Id: `DENUE-${String(index).padStart(2, "0")}`,
    Nombre: `Unidad económica ${index}`,
    Clase_actividad: `Actividad ${index}`,
    Domicilio: `Domicilio ${index}`,
    Latitud: 21.885 + index * 0.0005,
    Longitud: -102.295 + index * 0.0005,
  }));
}

function governedContext(type: "INDIVIDUAL" | "CORRIDOR" | "POLYGON", count: number, maxDisplayedPoints = count) {
  const canonicalGeography = geography(type);
  const observations = canonicalizeDenuePoisForInstitutionalAnalysis(rawPoints(count), {
    expedienteId: `exp-b5-${type.toLowerCase()}`,
    canonicalGeography,
    radiusMeters: 2_000,
    acquiredAt: "2026-09-29T12:00:00.000Z",
    query: "DENUE governed rendering",
  }).institutionalPois as DenueCartographicObservation[];
  const assembled = buildDenueGovernedCartographicProduct({
    projectId: `exp-b5-${type.toLowerCase()}`,
    geographyId: canonicalGeography.geographyId,
    canonicalGeographyReference: {
      geographyId: canonicalGeography.geographyId,
      geographyType: canonicalGeography.type,
      geometryType: canonicalGeography.geometry.type,
      sourceReference: `canonical-geography:${canonicalGeography.geographyId}`,
    },
    observations,
    createdAtReference: "snapshot://2026-09-29T12:00:00.000Z",
  });
  if (!assembled.product) throw new Error(assembled.admission.reasons.join(","));
  const selected = selectDenueCartographicDisplay(assembled.product, {
    maxDisplayedPoints,
    minimumSeparationMeters: 1,
  });
  if (selected.status !== "PLANNED") throw new Error(selected.reasons.join(","));
  return { geography: canonicalGeography, product: assembled.product, plan: selected.plan };
}

function render(context: ReturnType<typeof governedContext>) {
  return buildExecutiveCanonicalTerritorialMapSpec(context.geography, {
    denue: { product: context.product, displayPlan: context.plan },
  });
}

function emptyPlan(plan: DenueCartographicDisplayPlan): DenueCartographicDisplayPlan {
  const omittedLayerIds = [...plan.audit.inputLayerIds];
  return {
    ...structuredClone(plan),
    selectedLayerIds: [],
    omittedLayerIds,
    audit: {
      ...structuredClone(plan.audit),
      selectedCount: 0,
      omittedCount: omittedLayerIds.length,
      selectedLayerIds: [],
      omittedLayerIds,
      selectionSequence: [],
      omissions: omittedLayerIds.map((layerId) => ({
        layerId,
        reason: "DISPLAY_BUDGET" as const,
        nearestSelectedLayerId: "NONE",
        nearestSelectedDistanceMeters: 0,
      })),
    },
  };
}

describe("INFORMES R3.2B.5 DENUE governed institutional map rendering", () => {
  test("A POLYGON conserva path canónico y añade cinco DENUE seleccionados", () => {
    const context = governedContext("POLYGON", 5);
    const spec = render(context);
    expect(spec.geometryType).toBe("Polygon");
    expect(spec.paths).toHaveLength(1);
    expect(spec.paths[0][0]).toEqual(spec.paths[0][spec.paths[0].length - 1]);
    expect(new URL(spec.imageUrl, "http://localhost").searchParams.getAll("path")).toHaveLength(1);
    expect(spec.denueMarkers.map((marker) => marker.layerId)).toEqual(context.plan.selectedLayerIds);
    expect(spec.denueMarkers).toHaveLength(5);
  });

  test("B CORRIDOR conserva LineString y añade marcadores DENUE", () => {
    const context = governedContext("CORRIDOR", 5);
    const canonicalPath = context.geography.geometry.type === "LineString"
      ? context.geography.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
      : [];
    const spec = render(context);
    expect(spec.geometryType).toBe("LineString");
    expect(spec.paths[0]).toEqual(canonicalPath);
    expect(new URL(spec.imageUrl, "http://localhost").searchParams.getAll("path")).toHaveLength(1);
    expect(spec.denueMarkers).toHaveLength(5);
  });

  test("C INDIVIDUAL conserva Point canónico y añade marcadores DENUE", () => {
    const context = governedContext("INDIVIDUAL", 5);
    const spec = render(context);
    expect(spec.geometryType).toBe("Point");
    expect(spec.markers).toEqual([{ lat: 21.89, lng: -102.29 }]);
    expect(spec.denueMarkers).toHaveLength(5);
    expect(new URL(spec.imageUrl, "http://localhost").searchParams.getAll("markers")).toHaveLength(2);
  });

  test("D plan vacío conserva exactamente el mapa canónico sin DENUE", () => {
    const context = governedContext("POLYGON", 4);
    const baseline = buildExecutiveCanonicalTerritorialMapSpec(context.geography);
    const spec = buildExecutiveCanonicalTerritorialMapSpec(context.geography, {
      denue: { product: context.product, displayPlan: emptyPlan(context.plan) },
    });
    expect(spec.paths).toEqual(baseline.paths);
    expect(spec.viewport).toEqual(baseline.viewport);
    expect(spec.denueMarkers).toEqual([]);
    expect(spec.denueRenderAudit).toMatchObject({ denueAvailableCount: 4, denueRenderedCount: 0 });
  });

  test("E renderiza exclusivamente los tres selectedLayerIds de diez capas", () => {
    const context = governedContext("POLYGON", 10, 3);
    const spec = render(context);
    expect(context.product.layers).toHaveLength(10);
    expect(spec.denueMarkers).toHaveLength(3);
    expect(spec.denueRenderAudit?.renderedLayerIds).toEqual(context.plan.selectedLayerIds);
    expect(spec.denueRenderAudit?.renderedLayerIds.every((id) => context.plan.selectedLayerIds.includes(id))).toBe(true);
  });

  test("F mismatch productId falla cerrado", () => {
    const context = governedContext("POLYGON", 3);
    const displayPlan = { ...context.plan, productId: "product-other" };
    expect(() => buildExecutiveCanonicalTerritorialMapSpec(context.geography, {
      denue: { product: context.product, displayPlan },
    })).toThrow("DENUE_DISPLAY_PLAN_PRODUCT_ID_MISMATCH");
  });

  test("G mismatch geographyId falla cerrado", () => {
    const context = governedContext("POLYGON", 3);
    const displayPlan = { ...context.plan, geographyId: "geo-other" };
    expect(() => buildExecutiveCanonicalTerritorialMapSpec(context.geography, {
      denue: { product: context.product, displayPlan },
    })).toThrow("DENUE_DISPLAY_PLAN_GEOGRAPHY_ID_MISMATCH");
  });

  test("H producto no ADMITTED falla cerrado", () => {
    const context = governedContext("POLYGON", 3);
    const product = { ...context.product, title: "" } as GovernedCartographicProduct;
    expect(() => buildExecutiveCanonicalTerritorialMapSpec(context.geography, {
      denue: { product, displayPlan: context.plan },
    })).toThrow("DENUE_PRODUCT_NOT_ADMITTED");
  });

  test("I el mismo plan produce exactamente la misma especificación", () => {
    const context = governedContext("POLYGON", 10, 3);
    const permutedProduct = { ...context.product, layers: [...context.product.layers].reverse() };
    const first = buildExecutiveCanonicalTerritorialMapSpec(context.geography, {
      denue: { product: context.product, displayPlan: context.plan },
    });
    const second = buildExecutiveCanonicalTerritorialMapSpec(context.geography, {
      denue: { product: permutedProduct, displayPlan: context.plan },
    });
    expect(second).toEqual(first);
  });

  test("J URL usa un grupo tiny neutro, sin nombres, labels ni universo omitido", () => {
    const context = governedContext("POLYGON", 10, 3);
    const spec = render(context);
    const params = new URL(spec.imageUrl, "http://localhost").searchParams;
    const denueMarkerGroup = params.getAll("markers")[0];
    expect(denueMarkerGroup).toContain("size:tiny|color:0x5B6573");
    expect(denueMarkerGroup).not.toContain("label:");
    expect(denueMarkerGroup).not.toContain("Unidad económica");
    expect(denueMarkerGroup.split("|").slice(2)).toHaveLength(3);
    expect(spec.imageUrl.length).toBeLessThan(16_384);
  });

  test("K auditoría, conteos, disclosures y leyenda permanecen trazables", () => {
    const context = governedContext("POLYGON", 10, 3);
    const spec = render(context);
    expect(spec.denueRenderAudit).toMatchObject({
      productId: context.product.productId,
      geographyId: context.geography.geographyId,
      canonicalGeometryRendered: true,
      denueAvailableCount: 10,
      denueSelectedCount: 3,
      denueRenderedCount: 3,
      renderedLayerIds: context.plan.selectedLayerIds,
      displayPolicy: context.plan.selectionPolicy,
      displayParameters: context.plan.selectionParameters,
      disclosures: context.plan.disclosure,
    });
    expect(spec.denueRenderAudit?.sourceReferences).toEqual(context.product.sourceReferences);
    expect(spec.denueRenderAudit?.traceabilityIds).toEqual(context.product.traceabilityIds);
    expect(spec.legend?.countStatement).toContain("10 registros DENUE disponibles; 3 representados");
    expect(spec.legend?.interpretationLimit).toContain("DENUE no representa incidencia");
  });

  test("L DENUE no altera el viewport gobernado por geografía canónica", () => {
    const context = governedContext("POLYGON", 5);
    const baseline = buildExecutiveCanonicalTerritorialMapSpec(context.geography);
    const enriched = render(context);
    expect(enriched.viewport).toEqual(baseline.viewport);
    expect(enriched.cartographicScale).toEqual(baseline.cartographicScale);
    expect(enriched.paths).toEqual(baseline.paths);
  });
});
