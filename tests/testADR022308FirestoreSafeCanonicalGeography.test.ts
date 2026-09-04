import {
  buildCanonicalProjectGeography,
  deserializeCanonicalGeographyFromFirestore,
  serializeCanonicalGeographyForFirestore,
  type CanonicalProjectGeography,
} from "../src/utils/canonicalProjectGeography";

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
});
