import { buildScinceCanonicalSnapshot, evaluateScinceSnapshotFreshness, isScinceSnapshotPublishable,
  isValidScinceCanonicalSnapshot } from "../src/utils/scinceCanonicalSnapshot";
import { SCINCE_CANONICAL_SNAPSHOT_VERSION, type ScinceCanonicalSuccess } from "../src/types/scinceCanonicalSnapshot";
import { fingerprintScinceCanonicalPoint } from "../src/utils/scinceGeographyBinding";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { readFileSync } from "fs";
import { resolve } from "path";
jest.mock("server-only", () => ({}), { virtual: true });

const geography: CanonicalProjectGeography = { geographyId: "P1:INDIVIDUAL", type: "INDIVIDUAL",
  geometry: { type: "Point", coordinates: [-102.291, 21.881] }, validationStatus: "VALID",
  source: "MAP_VECTOR", createdAt: 1, updatedAt: 1 };
function observed(): ScinceCanonicalSuccess {
  return { success: true, projectId: "P1", geographyId: geography.geographyId, geographyType: "INDIVIDUAL",
    spatialMode: "CANONICAL_POINT", geographyFingerprint: fingerprintScinceCanonicalPoint(geography),
    queryCoordinate: { lat: 21.881, lng: -102.291 }, datasetId: "INEGI2020", datasetYear: 2020, datasetVersion: "v1",
    geographicLevel: "MANZANA", demographicGeographicLevel: "AGEB", sourceRowKey: "ageb-row",
    demographics: { geographicLevel: "AGEB", populationTotal: 10, housingTotal: 5, inhabitedPrivateHousing: 4,
      uninhabitedPrivateHousing: 1, marginacion: null, marginacionNote: "No disponible" },
    provenance: { datasetId: "INEGI2020", referenceYear: 2020, version: "v1", productName: "Censo",
      importedAt: "2026-01-01", completedAt: "2026-01-02", geographySourceUrl: "https://www.inegi.org.mx/geo",
      geographySha256: "a".repeat(64), censusSourceUrl: "https://www.inegi.org.mx/censo", censusSha256: "b".repeat(64),
      queryCoordinates: { lat: 21.881, lng: -102.291 }, geographicLevel: "MANZANA",
      demographicGeographicLevel: "AGEB", sourceRowKey: "ageb-row" }, limitations: ["Demografía AGEB; ubicación MANZANA"] };
}
const snapshot = () => buildScinceCanonicalSnapshot(observed());
const input = (s: unknown = snapshot(), current: CanonicalProjectGeography | null = geography) =>
  ({ snapshot: s, expectedProjectId: "P1", currentCanonicalGeography: current });

test("valid canonical result builds a valid versioned snapshot without invented observation time", () => {
  expect(isValidScinceCanonicalSnapshot(snapshot())).toBe(true);
  expect(snapshot().schemaVersion).toBe(SCINCE_CANONICAL_SNAPSHOT_VERSION);
  expect(snapshot().observedAt).toBeNull();
});
test.each(["projectId", "demographics", "provenance", "limitations"] as const)("preserves %s", key => {
  expect(snapshot()[key]).toEqual(observed()[key]);
});
test.each(["geographyId", "geographyFingerprint", "queryCoordinate"] as const)("preserves binding %s", key => {
  expect(snapshot().geographyBinding[key]).toEqual(observed()[key]);
});
test.each(["geographicLevel", "demographicGeographicLevel", "sourceRowKey"] as const)("preserves resolution %s", key => {
  expect(snapshot().territorialResolution[key]).toEqual(observed()[key]);
});
test("preserves dataset identity including historical year", () => {
  expect(snapshot().dataset).toEqual({ datasetId: "INEGI2020", year: 2020, version: "v1" });
  expect(evaluateScinceSnapshotFreshness(input())).toMatchObject({ territorialFreshness: "CURRENT", datasetIdentity: snapshot().dataset });
});
test("same geometry is CURRENT", () => expect(evaluateScinceSnapshotFreshness(input()).territorialFreshness).toBe("CURRENT"));
test.each(["lat", "lng"])("changing %s with stable project, geography ID and dataset is STALE", axis => {
  const current: CanonicalProjectGeography = { ...geography, geometry: { type: "Point",
    coordinates: axis === "lng" ? [-102.292, 21.881] : [-102.291, 21.882] } };
  expect(evaluateScinceSnapshotFreshness(input(snapshot(), current)).territorialFreshness).toBe("STALE");
});
test("geography ID change is STALE even with identical fingerprint", () => {
  expect(evaluateScinceSnapshotFreshness(input(snapshot(), { ...geography, geographyId: "other" })).territorialFreshness).toBe("STALE");
});
test("polygon modality change is STALE", () => {
  expect(evaluateScinceSnapshotFreshness(input(snapshot(), { ...geography, type: "POLYGON",
    geometry: { type: "Polygon", coordinates: [] } })).territorialFreshness).toBe("STALE");
});
test.each(["INVALID", "PARTIAL"] as const)("canonical %s is not CURRENT", validationStatus => {
  expect(evaluateScinceSnapshotFreshness(input(snapshot(), { ...geography, validationStatus })).territorialFreshness).toBe("STALE");
});
test("nonterritorial timestamps, caption, viewport and metadata preserve fingerprint and CURRENT", () => {
  const current = { ...geography, createdAt: 999, updatedAt: 1000, source: "PROJECT_CREATION" as const,
    caption: "new", metadata: { note: "new" }, derived: { centroid: { lat: 1, lng: 2, derivation: "DERIVED_FROM_POINT" as const } },
    viewport: { zoom: 10 }, limitations: ["metadata"] };
  expect(fingerprintScinceCanonicalPoint(current)).toBe(snapshot().geographyBinding.geographyFingerprint);
  expect(evaluateScinceSnapshotFreshness(input(snapshot(), current)).territorialFreshness).toBe("CURRENT");
});
test.each([null, undefined])("absent snapshot is MISSING (%#)", missing => {
  expect(evaluateScinceSnapshotFreshness({ ...input(), snapshot: missing }).territorialFreshness).toBe("MISSING");
});
test.each([
  ["fingerprint absent", (s: any) => { delete s.geographyBinding.geographyFingerprint; }],
  ["legacy", (s: any) => { delete s.schemaVersion; delete s.geographyBinding; }],
  ["fingerprint version", (s: any) => { s.geographyBinding.fingerprintVersion = "V2"; }],
  ["schema version", (s: any) => { s.schemaVersion = "V2"; }],
  ["binding incomplete", (s: any) => { delete s.geographyBinding.geographyId; }],
  ["invalid coordinate", (s: any) => { s.geographyBinding.queryCoordinate.lat = 91; }],
  ["coordinate fingerprint tampering", (s: any) => { s.geographyBinding.queryCoordinate.lng = -102.292; }],
  ["fingerprint tampering", (s: any) => { s.geographyBinding.geographyFingerprint += "0"; }],
  ["dataset lineage mismatch", (s: any) => { s.dataset.version = "v2"; }],
  ["invalid dataset year", (s: any) => { s.dataset.year = "2020"; }],
  ["missing demographics", (s: any) => { delete s.demographics; }],
  ["corrupt demographics", (s: any) => { s.demographics.populationTotal = -1; }],
  ["provenance coordinate mismatch", (s: any) => { s.provenance.queryCoordinates.lat = 22; }],
  ["resolution mismatch", (s: any) => { s.territorialResolution.sourceRowKey = "other"; }],
])("%s is INVALID without silent repair", (_name, corrupt) => {
  const s = snapshot(); corrupt(s); const before = structuredClone(s);
  expect(evaluateScinceSnapshotFreshness(input(s)).territorialFreshness).toBe("INVALID");
  expect(s).toEqual(before);
});
test("project mismatch is INVALID", () => {
  expect(evaluateScinceSnapshotFreshness({ ...input(), expectedProjectId: "P2" }).territorialFreshness).toBe("INVALID");
});
test.each(["CURRENT", "STALE", "INVALID", "MISSING"])("publication gate for %s", status => {
  const i = input();
  if (status === "STALE") i.currentCanonicalGeography = { ...geography, geographyId: "other" };
  if (status === "INVALID") i.snapshot = {};
  if (status === "MISSING") i.snapshot = null;
  expect(isScinceSnapshotPublishable(i)).toBe(status === "CURRENT");
});
test("builder rejects denied and incomplete results at runtime", () => {
  expect(() => buildScinceCanonicalSnapshot({ success: false } as any)).toThrow("SUCCESS_REQUIRED");
  expect(() => buildScinceCanonicalSnapshot({ success: true } as any)).toThrow("SNAPSHOT_INVALID");
});
test("unavailable observed fields preserve honest nulls", () => {
  const s = buildScinceCanonicalSnapshot({ ...observed(), datasetId: null, datasetYear: null, datasetVersion: null,
    geographicLevel: null, demographicGeographicLevel: null, sourceRowKey: null, demographics: null, provenance: null });
  expect(s.dataset).toEqual({ datasetId: null, year: null, version: null });
  expect(s.demographics).toBeNull();
  expect(evaluateScinceSnapshotFreshness(input(s)).territorialFreshness).toBe("CURRENT");
});
test("no observations or antecedents are mutated and no criminological fields are generated", () => {
  const result = observed(), before = structuredClone(result), s = buildScinceCanonicalSnapshot(result);
  const saved = structuredClone(s);
  evaluateScinceSnapshotFreshness(input(s, { ...geography, geographyId: "other" }));
  expect(s).toEqual(saved); expect(result).toEqual(before);
  s.limitations.push("caller change"); expect(result).toEqual(before);
  expect(Object.keys(saved).sort()).toEqual(["schemaVersion", "projectId", "geographyBinding", "dataset",
    "territorialResolution", "demographics", "provenance", "limitations", "observedAt"].sort());
  expect(JSON.stringify(saved)).not.toMatch(/riesgo|vulnerabilidad|causalidad|criminogenicidad|predicción|hallazgo|evidencia/i);
});
test("helpers expose no runtime resolver, database, persistence or writer dependency", () => {
  const source = readFileSync(resolve(__dirname, "../src/utils/scinceCanonicalSnapshot.ts"), "utf8");
  expect(source).not.toMatch(/firebase|firestore|postgres|\bpg\b|resolveInegiTerritory|setDoc|updateDoc|insertInto|Date\.now/);
  const write = jest.fn();
  isScinceSnapshotPublishable({ ...input(), write } as any);
  expect(write).not.toHaveBeenCalled();
});
test("missing or malformed current canonical geography fails closed", () => {
  expect(isScinceSnapshotPublishable(input(snapshot(), null))).toBe(false);
  expect(isScinceSnapshotPublishable(input(snapshot(), { ...geography, geometry: { type: "Point", coordinates: [181, 21] } }))).toBe(false);
});
