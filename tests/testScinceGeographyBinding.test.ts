import { fingerprintScinceCanonicalPoint } from "../src/utils/scinceGeographyBinding";
import { deserializeCanonicalGeographyFromFirestore, type CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
jest.mock("server-only", () => ({}), { virtual: true });
const canonical: CanonicalProjectGeography = { geographyId: "P1:INDIVIDUAL", type: "INDIVIDUAL",
  geometry: { type: "Point", coordinates: [-102, 21] }, source: "MAP_VECTOR", validationStatus: "VALID", createdAt: 1, updatedAt: 1 };
test("territorial fingerprint is deterministic and versioned", () => {
  expect(fingerprintScinceCanonicalPoint(canonical)).toBe(fingerprintScinceCanonicalPoint(JSON.parse(JSON.stringify(canonical))));
  expect(fingerprintScinceCanonicalPoint(canonical)).toMatch(/^CANONICAL_GEOGRAPHY_FINGERPRINT_V1:[0-9a-f]{64}$/);
});
test("changing canonical geometry changes the fingerprint", () => {
  expect(fingerprintScinceCanonicalPoint({ ...canonical, geometry: { type: "Point", coordinates: [-102, 22] } }))
    .not.toBe(fingerprintScinceCanonicalPoint(canonical));
});
test("timestamps, identity, source, derived center and other metadata do not change territorial fingerprint", () => {
  expect(fingerprintScinceCanonicalPoint({ ...canonical, geographyId: "other", createdAt: 99, updatedAt: 100,
    source: "PROJECT_CREATION", limitations: ["metadata"], derived: { centroid: { lat: 0, lng: 0, derivation: "DERIVED_FROM_POINT" } } }))
    .toBe(fingerprintScinceCanonicalPoint(canonical));
});
test("persisted Firestore Point and coordinate-array Point bind to the same geometry", () => {
  const rehydrated = deserializeCanonicalGeographyFromFirestore({ ...canonical, geometry: { type: "Point", point: { lat: 21, lng: -102 } } });
  expect(fingerprintScinceCanonicalPoint(rehydrated!)).toBe(fingerprintScinceCanonicalPoint(canonical));
});
