import fs from "node:fs";
import path from "node:path";
import {
  getCanonicalGeographyCoordinates,
  type CanonicalProjectGeography,
} from "../src/utils/canonicalProjectGeography";

const projectMapSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/ProjectMap.tsx"),
  "utf8"
);

function geography(
  type: "CORRIDOR" | "POLYGON",
  points: Array<[number, number]>
): CanonicalProjectGeography {
  return {
    geographyId: `test-${type.toLowerCase()}`,
    type,
    geometry: type === "CORRIDOR"
      ? { type: "LineString", coordinates: points }
      : { type: "Polygon", coordinates: [points] },
    source: "PROJECT_CREATION",
    validationStatus: "VALID",
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("ProjectMap canonical rector overlay render contract", () => {
  test("a valid canonical corridor reaches the Polyline render threshold", () => {
    const points = getCanonicalGeographyCoordinates(geography("CORRIDOR", [
      [-102.30, 21.88],
      [-102.29, 21.89],
    ]));

    expect(points).toHaveLength(2);
    expect(projectMapSource).toContain('geometryType === "lineal" || geometryType === "corredor"');
    expect(projectMapSource).toContain("geoShapePath.length > 1");
    expect(projectMapSource).toMatch(/\{shouldRenderCorridor && \(\s*<Polyline\s+path=\{geoShapePath\}/);
  });

  test("a valid canonical polygon reaches the Polygon render threshold", () => {
    const points = getCanonicalGeographyCoordinates(geography("POLYGON", [
      [-102.30, 21.88],
      [-102.29, 21.89],
      [-102.28, 21.88],
    ]));

    expect(points).toHaveLength(3);
    expect(projectMapSource).toContain('geometryType === "poligono"');
    expect(projectMapSource).toContain("geoShapePath.length > 2");
    expect(projectMapSource).toMatch(/\{shouldRenderPolygon && \(\s*<Polygon\s+paths=\{geoShapePath\}/);
  });

  test("the runtime diagnostic exposes both render decisions without changing data", () => {
    expect(projectMapSource).toContain("[PROJECTMAP-GEOGRAPHY-DIAGNOSTIC]");
    expect(projectMapSource).toContain("uniqueCanonicalCoordinatesLength:");
    expect(projectMapSource).toContain("uniqueCanonicalCoordinates,");
    expect(projectMapSource).toContain("shouldRenderCorridor,");
    expect(projectMapSource).toContain("shouldRenderPolygon,");
    expect(projectMapSource).not.toContain("[PROJECTMAP-GEOGRAPHY-DIAGNOSTIC] write");
  });

  test("the native Polyline lifecycle diagnostic uses Google Maps APIs", () => {
    expect(projectMapSource).toContain("[PROJECTMAP-POLYLINE-NATIVE]");
    expect(projectMapSource).toContain("polyline.getMap()");
    expect(projectMapSource).toContain("polyline.getVisible()");
    expect(projectMapSource).toContain("polyline.getPath()");
    expect(projectMapSource).toContain('polyline.get("strokeColor")');
    expect(projectMapSource).toContain('polyline.get("strokeOpacity")');
    expect(projectMapSource).toContain('polyline.get("strokeWeight")');
    expect(projectMapSource).toContain('polyline.get("zIndex")');
    expect(projectMapSource).toContain('event: "onUnmount"');
  });
});
