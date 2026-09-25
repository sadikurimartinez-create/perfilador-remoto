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

  test("canonical fitBounds waits for a reactive loaded map instance", () => {
    expect(projectMapSource).toContain("const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)");
    expect(projectMapSource).toContain("mapRef.current !== mapInstance");
    expect(projectMapSource).toContain("setMapInstance(map)");
    expect(projectMapSource).toContain("setMapInstance(null)");
    expect(projectMapSource).toContain("const CANONICAL_VIEWPORT_PADDING_PX = 48");
    expect(projectMapSource).toContain("mapInstance.fitBounds(bounds, CANONICAL_VIEWPORT_PADDING_PX)");
    expect(projectMapSource).toMatch(/useEffect\(\(\) => \{[\s\S]*?mapInstance\.fitBounds\(bounds, CANONICAL_VIEWPORT_PADDING_PX\);[\s\S]*?\}, \[[\s\S]*?mapInstance,[\s\S]*?canonicalViewport,[\s\S]*?canonicalCoordinates,/);
  });

  test("temporary viewport and overlay diagnostics are absent", () => {
    const temporaryPrefixes = [
      "[PROJECTMAP-GEOGRAPHY-DIAGNOSTIC]",
      "[PROJECTMAP-POLYLINE-NATIVE]",
      "[PROJECTMAP-VIEWPORT-EFFECT]",
      "[PROJECTMAP-VIEWPORT-FITBOUNDS]",
      "[PROJECTMAP-VIEWPORT-IDLE]",
      "[PROJECTMAP-VIEWPORT-BEFORE]",
      "[PROJECTMAP-VIEWPORT-EVENT]",
      "[PROJECTMAP-VIEWPORT-AFTER-IMMEDIATE]",
      "[PROJECTMAP-VIEWPORT-AFTER-RAF]",
    ];

    temporaryPrefixes.forEach((prefix) => expect(projectMapSource).not.toContain(prefix));
  });

  test("viewport readiness does not change or deduplicate the rendered canonical path", () => {
    expect(projectMapSource).toMatch(/const geoShapePath = useMemo\(\(\) => \{\s*if \(canonicalCoordinates\.length > 0\) return canonicalCoordinates;/);
    expect(projectMapSource).toContain("if (!canonicalGeography && coordinates.length > 0) return coordinates;");
    expect(projectMapSource).not.toContain("uniqueCanonicalCoordinates");
    expect(projectMapSource).toContain("path={geoShapePath}");
    expect(projectMapSource).toContain("paths={geoShapePath}");
  });
});
