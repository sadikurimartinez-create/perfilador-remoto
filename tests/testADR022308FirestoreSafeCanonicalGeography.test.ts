import {
  buildCanonicalProjectGeography,
  deserializeCanonicalGeographyFromFirestore,
  serializeCanonicalGeographyForFirestore,
  rehydrateCanonicalProjectGeography,
  getCanonicalMapViewport,
  resolveCanonicalAcquisitionGeography,
  adaptLegacyProjectGeography,
  type CanonicalProjectGeography,
} from "../src/utils/canonicalProjectGeography";
import { buildExecutiveCanonicalTerritorialMapSpec } from "../src/utils/executiveCanonicalTerritorialMap";

const p1 = { lat: 21.881, lng: -102.291 };
const p2 = { lat: 21.882, lng: -102.292 };
const p3 = { lat: 21.883, lng: -102.293 };

function containsNestedArray(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => Array.isArray(item) || containsNestedArray(item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some(containsNestedArray);
  }
  return false;
}

function expectRoundTrip(geography: CanonicalProjectGeography) {
  const serialized = serializeCanonicalGeographyForFirestore(geography);
  expect(serialized).not.toBeNull();
  expect(containsNestedArray(serialized)).toBe(false);
  expect(deserializeCanonicalGeographyFromFirestore(serialized)).toEqual(geography);
}

describe("ADR-022.30.8 - Firestore-safe canonical project geography persistence", () => {
  test("INDIVIDUAL domain -> serialize -> deserialize -> domain", () => {
    expectRoundTrip(buildCanonicalProjectGeography({ projectId: "EXP-FS-POINT", type: "INDIVIDUAL", points: [p1], now: 10 }));
  });

  test("CORRIDOR domain -> serialize -> deserialize -> domain", () => {
    expectRoundTrip(buildCanonicalProjectGeography({ projectId: "EXP-FS-CORRIDOR", type: "CORRIDOR", points: [p1, p2], now: 20 }));
  });

  test("POLYGON domain -> serialize -> deserialize -> domain", () => {
    expectRoundTrip(buildCanonicalProjectGeography({ projectId: "EXP-FS-POLYGON", type: "POLYGON", points: [p1, p2, p3], now: 30 }));
  });

  test("legacy Point coordinates remain readable", () => {
    const legacy = buildCanonicalProjectGeography({ projectId: "EXP-FS-LEGACY", type: "INDIVIDUAL", points: [p1], now: 40 });
    expect(deserializeCanonicalGeographyFromFirestore(legacy)).toEqual(legacy);
  });

  test("empty Individual stays INVALID through build, rehydration and storage round trip", () => {
    const empty = buildCanonicalProjectGeography({ projectId: "EMPTY", type: "INDIVIDUAL", points: [], now: 1 });
    expect(empty.validationStatus).toBe("INVALID");
    expect(empty.limitations).toContain("INCOMPLETE_CANONICAL_GEOMETRY");
    expect(rehydrateCanonicalProjectGeography(empty)?.validationStatus).toBe("INVALID");
    expect(deserializeCanonicalGeographyFromFirestore(serializeCanonicalGeographyForFirestore(empty))?.validationStatus).toBe("INVALID");
  });

  test("historical invalid sentinel is preserved without creating derived coordinates", () => {
    const historic = buildCanonicalProjectGeography({ projectId: "HISTORIC", type: "INDIVIDUAL", points: [], now: 2 });
    const rehydrated = rehydrateCanonicalProjectGeography(historic)!;
    expect(rehydrated).toEqual(historic);
    expect(rehydrated.geometry).toEqual({ type: "Point", coordinates: [0, 0] });
    expect(rehydrated.derived?.centroid).toBeUndefined();
    expect(rehydrated.derived?.bounds).toBeUndefined();
  });

  test("empty sentinel has no public viewport, acquisition point or B5 spec", () => {
    const empty = buildCanonicalProjectGeography({ projectId: "BLOCKED", type: "INDIVIDUAL", points: [], now: 3 });
    const rehydrated = rehydrateCanonicalProjectGeography(empty)!;
    expect(getCanonicalMapViewport(rehydrated)).toMatchObject({ center: undefined, bounds: undefined });
    expect(resolveCanonicalAcquisitionGeography({ id: "BLOCKED", canonicalGeography: rehydrated })).toBeNull();
    expect(() => buildExecutiveCanonicalTerritorialMapSpec(rehydrated)).toThrow("CANONICAL_MAP_VALID_GEOGRAPHY_REQUIRED");
  });

  test("explicit valid coordinates at and near zero retain validity", () => {
    for (const point of [{ lat: 0, lng: 0 }, { lat: 0.0001, lng: -0.0001 }]) {
      const valid = buildCanonicalProjectGeography({ projectId: "REAL", type: "INDIVIDUAL", points: [point], now: 4 });
      expectRoundTrip(valid);
      expect(rehydrateCanonicalProjectGeography(valid)?.validationStatus).toBe("VALID");
      expect(getCanonicalMapViewport(valid).center).toEqual(point);
    }
  });

  test("ambiguous or unresolved historic states are never automatically reconciled", () => {
    const empty = buildCanonicalProjectGeography({ projectId: "AMBIGUOUS", type: "INDIVIDUAL", points: [], now: 5 });
    const variants = [
      { ...empty, validationStatus: "VALID" as const },
      { ...empty, validationStatus: "PARTIAL" as const },
      { ...empty, validationStatus: undefined } as unknown as CanonicalProjectGeography,
      { ...empty, validationStatus: "PARTIAL" as const, limitations: [] },
    ];
    for (const historic of variants) {
      expect(rehydrateCanonicalProjectGeography(historic)?.validationStatus).not.toBe("VALID");
      expect(getCanonicalMapViewport(historic).center).toBeUndefined();
      expect(adaptLegacyProjectGeography({ id: "AMBIGUOUS", canonicalGeography: historic, latitude: p1.lat, longitude: p1.lng })?.validationStatus).not.toBe("VALID");
    }
  });

  test("valid MultiPolygon round trip preserves all coordinates and metadata", () => {
    const polygon = buildCanonicalProjectGeography({ projectId: "MULTI", type: "POLYGON", points: [p1, p2, p3], now: 6 });
    if (polygon.geometry.type !== "Polygon") throw new Error("Expected polygon fixture");
    expectRoundTrip({ ...polygon, geometry: { type: "MultiPolygon", coordinates: [polygon.geometry.coordinates] } });
  });
});
