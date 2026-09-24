import {
  buildGovernedCartographicDecision,
  calculateGovernedZoom,
  CARTOGRAPHIC_INDIVIDUAL_ZOOM,
  CARTOGRAPHIC_MAX_ZOOM,
  CARTOGRAPHIC_PADDING_LOGICAL_PX,
  CARTOGRAPHIC_SCALE_ALGORITHM_VERSION,
  CARTOGRAPHIC_STATIC_MAP_SCALE,
  coordinatesFitGovernedViewport,
  formatCartographicScaleLabel,
  metersPerLogicalPixel,
  projectWebMercator,
  selectNiceScaleDistance,
  validateAndDecreaseGovernedZoom,
  WEB_MERCATOR_MAX_LATITUDE,
  wrappedWorldDeltaX,
} from "@/utils/governedCartographicScale";

describe("QA-08.2 CARTOGRAPHIC_SCALE_WEB_MERCATOR_V1", () => {
  test("proyecta el origen al centro del tile Web Mercator", () => {
    expect(projectWebMercator({ lat: 0, lng: 0 })).toEqual({ x: 128, y: 128 });
  });

  test("rechaza coordenadas no finitas y latitudes fuera de Web Mercator", () => {
    expect(() => projectWebMercator({ lat: Number.NaN, lng: 0 })).toThrow("CARTOGRAPHIC_SCALE_LATITUDE_NON_FINITE");
    expect(() => projectWebMercator({ lat: WEB_MERCATOR_MAX_LATITUDE + 0.001, lng: 0 })).toThrow("CARTOGRAPHIC_SCALE_LATITUDE_OUT_OF_RANGE");
    expect(() => projectWebMercator({ lat: 0, lng: 181 })).toThrow("CARTOGRAPHIC_SCALE_LONGITUDE_OUT_OF_RANGE");
  });

  test("resuelve el delta corto al cruzar el antimeridiano", () => {
    const east = projectWebMercator({ lat: 0, lng: 179 });
    const west = projectWebMercator({ lat: 0, lng: -179 });
    expect(Math.abs(wrappedWorldDeltaX(west.x, east.x))).toBeCloseTo(256 * 2 / 360, 10);
  });

  test("INDIVIDUAL conserva zoom 16 y padding 40", () => {
    const point = { lat: 22.1, lng: -101.9 };
    const decision = buildGovernedCartographicDecision({ center: point, points: [point], fitMode: "CENTER" });
    expect(decision.viewport.zoom).toBe(CARTOGRAPHIC_INDIVIDUAL_ZOOM);
    expect(decision.viewport.paddingLogicalPx).toBe(CARTOGRAPHIC_PADDING_LOGICAL_PX);
    expect(decision.cartographicScale.algorithmVersion).toBe(CARTOGRAPHIC_SCALE_ALGORITHM_VERSION);
  });

  test.each([
    ["corredor horizontal", { lat: 22, lng: -102 }, [{ lat: 22, lng: -102.1 }, { lat: 22, lng: -101.9 }]],
    ["corredor vertical", { lat: 22, lng: -102 }, [{ lat: 21.9, lng: -102 }, { lat: 22.1, lng: -102 }]],
    ["poligono", { lat: 22, lng: -102 }, [{ lat: 21.9, lng: -102.1 }, { lat: 21.9, lng: -101.9 }, { lat: 22.1, lng: -101.9 }]],
  ])("%s obtiene zoom entero y todos los vertices caben", (_label, center, points) => {
    const zoom = calculateGovernedZoom(center, points);
    expect(Number.isInteger(zoom)).toBe(true);
    expect(zoom).toBeGreaterThanOrEqual(0);
    expect(zoom).toBeLessThanOrEqual(CARTOGRAPHIC_MAX_ZOOM);
    expect(coordinatesFitGovernedViewport(center, points, zoom)).toBe(true);
  });

  test("un poligono de mayor extension usa un zoom menor", () => {
    const center = { lat: 22, lng: -102 };
    const local = [{ lat: 21.99, lng: -102.01 }, { lat: 22.01, lng: -101.99 }];
    const regional = [{ lat: 20, lng: -105 }, { lat: 24, lng: -99 }];
    expect(calculateGovernedZoom(center, regional)).toBeLessThan(calculateGovernedZoom(center, local));
  });

  test("la verificacion reduce zoom hasta que la geometria cabe", () => {
    const center = { lat: 22, lng: -102 };
    const points = [{ lat: 20, lng: -105 }, { lat: 24, lng: -99 }];
    const zoom = validateAndDecreaseGovernedZoom(center, points, CARTOGRAPHIC_MAX_ZOOM);
    expect(zoom).toBeLessThan(CARTOGRAPHIC_MAX_ZOOM);
    expect(coordinatesFitGovernedViewport(center, points, zoom)).toBe(true);
  });

  test("scale=2 divide exactamente los metros por pixel de salida", () => {
    const point = { lat: 22.1, lng: -101.9 };
    const decision = buildGovernedCartographicDecision({ center: point, points: [point], fitMode: "CENTER" });
    expect(decision.cartographicScale.metersPerLogicalPixel).toBeCloseTo(metersPerLogicalPixel(point.lat, 16), 12);
    expect(decision.cartographicScale.metersPerOutputPixel).toBeCloseTo(
      decision.cartographicScale.metersPerLogicalPixel / CARTOGRAPHIC_STATIC_MAP_SCALE,
      12
    );
  });

  test.each([
    [999, 500],
    [1000, 1000],
    [1999, 1000],
    [2000, 2000],
    [9000, 5000],
  ])("serie 1-2-5 para maximo %s selecciona %s", (maximum, expected) => {
    expect(selectNiceScaleDistance(maximum)).toBe(expected);
  });

  test("etiqueta determinista usa metros y kilometros sin decimales innecesarios", () => {
    expect(formatCartographicScaleLabel(500)).toEqual({ distance: 500, unit: "m", label: "500 m" });
    expect(formatCartographicScaleLabel(2000)).toEqual({ distance: 2, unit: "km", label: "2 km" });
  });

  test("inputs invalidos fallan cerradamente", () => {
    expect(() => selectNiceScaleDistance(0)).toThrow("CARTOGRAPHIC_SCALE_MAXIMUM_DISTANCE_INVALID");
    expect(() => metersPerLogicalPixel(22, 1.5)).toThrow("CARTOGRAPHIC_SCALE_ZOOM_INVALID");
    expect(() => buildGovernedCartographicDecision({ center: { lat: 22, lng: -102 }, points: [], fitMode: "BOUNDS" }))
      .toThrow("CARTOGRAPHIC_SCALE_COORDINATES_REQUIRED");
  });
});
