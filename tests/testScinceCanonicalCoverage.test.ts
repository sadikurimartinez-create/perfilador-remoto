import { buildScinceCanonicalCoverage, evaluateScinceCoverageFreshness,
  fingerprintScinceCoverageGeography, scinceCoverageObservationId } from "../src/utils/scinceCanonicalCoverage";
import type { ScinceCoverageDataset, ScinceCoverageSourceRow } from "../src/types/scinceCanonicalCoverage";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";

const dataset: ScinceCoverageDataset = { datasetId: "fixture-2020", year: 2020, version: "declared-v1",
  provenance: { productName: "Fixture INEGI", geographySourceUrl: "https://www.inegi.org.mx/geo-fixture",
    censusSourceUrl: "https://www.inegi.org.mx/census-fixture", geographySha256: "a".repeat(64),
    censusSha256: "b".repeat(64), importedAt: "2026-09-01T00:00:00Z", completedAt: "2026-09-02T00:00:00Z" } };
const line = (): CanonicalProjectGeography => ({ geographyId: "P1:CORRIDOR", type: "CORRIDOR",
  validationStatus: "VALID", source: "MAP_VECTOR", createdAt: 1, updatedAt: 1,
  geometry: { type: "LineString", coordinates: [[-102.291, 21.881], [-102.292, 21.882], [-102.293, 21.883]] } });
const polygon = (): CanonicalProjectGeography => ({ ...line(), geographyId: "P1:POLYGON", type: "POLYGON",
  geometry: { type: "Polygon", coordinates: [[[-102.291, 21.881], [-102.292, 21.881], [-102.292, 21.882], [-102.291, 21.881]]] } });
const source = (): ScinceCoverageSourceRow => ({ demographicGeographicLevel: "AGEB", sourceRowKey: "01:001:0001:0017",
  geographicCode: "0100100010017", relationToAnalysis: "INTERIOR_INTERSECTION", observedAt: null,
  demographics: { populationTotal: 100, housingTotal: null, inhabitedPrivateHousing: 12,
    uninhabitedPrivateHousing: null, marginacion: null } });
function fixture(g = line()) {
  const row = source(), id = scinceCoverageObservationId(dataset, row);
  return { projectId: "P1", geography: g, crs: 4326, topology: { geometry: structuredClone(g.geometry), crs: 4326,
    engine: "GEOS" as const, engineVersion: "DECLARED_PURE_FIXTURE", isValid: true, isSimple: true, isEmpty: false,
    area: g.type === "CORRIDOR" ? 0 : 1 }, dataset: structuredClone(dataset), sourceRows: [row], limitations: ["Fixture, no topología oficial certificada."],
    territorialUnits: ["001", "002"].map(mza => ({ geographicLevel: "MANZANA" as const,
      geographicCode: `0100100010017${mza}`, relationToAnalysis: "INTERIOR_INTERSECTION" as const, sourceRowIds: [id] })) };
}

test.each([line, polygon])("identical full canonical geometry is conceptually CURRENT", make => {
  const f = fixture(make()), c = buildScinceCanonicalCoverage(f);
  expect(evaluateScinceCoverageFreshness(c, "P1", structuredClone(f.geography))).toBe("CURRENT");
});
test.each([line, polygon])("changed geometry with identical geographyId is STALE", make => {
  const f = fixture(make()), c = buildScinceCanonicalCoverage(f), changed = structuredClone(f.geography);
  if (changed.geometry.type === "LineString") changed.geometry.coordinates[1][0] -= 0.00000001;
  if (changed.geometry.type === "Polygon") changed.geometry.coordinates[0][1][0] -= 0.00000001;
  expect(evaluateScinceCoverageFreshness(c, "P1", changed)).toBe("STALE");
});
test("ordered corridor reversal is conservatively STALE", () => {
  const f = fixture(), c = buildScinceCanonicalCoverage(f), g = line();
  if (g.geometry.type === "LineString") g.geometry.coordinates.reverse();
  expect(evaluateScinceCoverageFreshness(c, "P1", g)).toBe("STALE");
});
test("ring rotation is not silently normalized", () => {
  const f = fixture(polygon()), c = buildScinceCanonicalCoverage(f), g = polygon();
  if (g.geometry.type === "Polygon") { const r = g.geometry.coordinates[0]; g.geometry.coordinates[0] = [r[1], r[2], r[0], r[1]]; }
  expect(evaluateScinceCoverageFreshness(c, "P1", g)).toBe("STALE");
});
test("holes and multipart geometry participate in fingerprint", () => {
  const a = polygon(), b = polygon();
  if (a.geometry.type !== "Polygon" || b.geometry.type !== "Polygon") throw new Error("fixture");
  b.geometry.coordinates.push([[-102.2912, 21.8811], [-102.2913, 21.8811], [-102.2913, 21.8812], [-102.2912, 21.8811]]);
  expect(fingerprintScinceCoverageGeography(b)).not.toBe(fingerprintScinceCoverageGeography(a));
  const multi = { ...a, geometry: { type: "MultiPolygon" as const, coordinates: [a.geometry.coordinates] } };
  expect(fingerprintScinceCoverageGeography(multi)).not.toBe(fingerprintScinceCoverageGeography(a));
});
test("timestamps, derived centroid, bounds and photos never participate", () => {
  const a = line(), b: any = { ...line(), updatedAt: 55, createdAt: 99,
    derived: { centroid: { lat: 0, lng: 0 }, bounds: { north: 0 } }, photographs: [{ lat: 10, lng: 10 }], lat: 1, lng: 2 };
  expect(fingerprintScinceCoverageGeography(b)).toBe(fingerprintScinceCoverageGeography(a));
});
test("project and geography identities are bound separately from exact coordinates", () => {
  const f = fixture(), c = buildScinceCanonicalCoverage(f);
  expect(evaluateScinceCoverageFreshness(c, "other", f.geography)).toBe("STALE");
  expect(evaluateScinceCoverageFreshness(c, "P1", { ...f.geography, geographyId: "other" })).toBe("STALE");
});
test.each(["centroid", "photos", "projectCoordinates", "placeholder", "unclosed", "partial", "nan"])("rejects %s without repair/fallback", mode => {
  const g: any = line();
  if (mode === "centroid") g.geometry = { type: "Point", coordinates: [-102, 21] };
  if (mode === "photos") { g.geometry = null; g.photos = [{ lat: 21, lng: -102 }]; }
  if (mode === "projectCoordinates") { g.geometry = null; g.lat = 21; g.lng = -102; }
  if (mode === "placeholder") g.geometry.coordinates[1] = [0, 0];
  if (mode === "unclosed") { Object.assign(g, polygon()); g.geometry.coordinates[0].pop(); }
  if (mode === "partial") g.validationStatus = "PARTIAL";
  if (mode === "nan") g.geometry.coordinates[1] = [NaN, 21];
  expect(() => fingerprintScinceCoverageGeography(g)).toThrow();
});
test("two manzanas share exactly one AGEB observation without aggregating it", () => {
  const f = fixture(); f.sourceRows.push(structuredClone(f.sourceRows[0]));
  const c = buildScinceCanonicalCoverage(f);
  expect(c.territorialUnits).toHaveLength(2); expect(c.sourceRows).toHaveLength(1);
  expect(c.territorialUnits[0].sourceRowIds).toEqual(c.territorialUnits[1].sourceRowIds);
  expect(c.aggregation).toBe("PROHIBITED"); expect(c.support).toBe("SUPPORTED_CONTEXT_ONLY");
  expect(c).not.toHaveProperty("populationTotal"); expect(c).not.toHaveProperty("totals");
});
test("conflicting duplicate source observation is rejected, never first-wins", () => {
  const f = fixture(), duplicate = structuredClone(f.sourceRows[0]); duplicate.demographics.populationTotal = 200;
  f.sourceRows.push(duplicate); expect(() => buildScinceCanonicalCoverage(f)).toThrow();
});
test("row identity includes dataset, year, version and demographic level", () => {
  const id = scinceCoverageObservationId(dataset, source());
  for (const d of [{ ...dataset, datasetId: "other" }, { ...dataset, year: 2021 }, { ...dataset, version: "v2" }])
    expect(scinceCoverageObservationId(d, source())).not.toBe(id);
  expect(scinceCoverageObservationId(dataset, { ...source(), demographicGeographicLevel: "MANZANA" })).not.toBe(id);
});
test("MANZANA and parent AGEB remain separate context rows and are never summed", () => {
  const f = fixture(), r: ScinceCoverageSourceRow = { ...source(), demographicGeographicLevel: "MANZANA",
    sourceRowKey: "01:001:0001:0017:001", geographicCode: "0100100010017001" };
  f.sourceRows.push(r); f.territorialUnits[0].sourceRowIds.push(scinceCoverageObservationId(f.dataset, r));
  const c = buildScinceCanonicalCoverage(f); expect(c.sourceRows).toHaveLength(2); expect(c.aggregation).toBe("PROHIBITED");
});
test("nulls, provenance, original limitations and inputs are preserved", () => {
  const f = fixture(), before = structuredClone(f), c = buildScinceCanonicalCoverage(f);
  expect(c.sourceRows[0].demographics).toEqual(f.sourceRows[0].demographics);
  expect(c.sourceRows[0].observedAt).toBeNull(); expect(c.dataset.provenance).toEqual(f.dataset.provenance);
  expect(c.limitations).toEqual(expect.arrayContaining(f.limitations)); expect(f).toEqual(before);
  c.dataset.provenance.productName = "changed"; expect(f).toEqual(before);
});
test("touching the source unit is enumeration only", () => {
  const f = fixture(); f.sourceRows[0].relationToAnalysis = "TOUCHES_ONLY";
  f.territorialUnits.forEach(u => { (u as any).relationToAnalysis = "TOUCHES_ONLY"; });
  const c = buildScinceCanonicalCoverage(f); expect(c.sourceRows[0].usage).toBe("ENUMERATION_ONLY");
});
test("AGEB interior relation is not replaced by a child manzana boundary contact", () => {
  const f = fixture(); (f.territorialUnits[0] as any).relationToAnalysis = "TOUCHES_ONLY";
  const c = buildScinceCanonicalCoverage(f);
  expect(c.sourceRows[0].relationToAnalysis).toBe("INTERIOR_INTERSECTION");
  expect(c.territorialUnits[0].relationToAnalysis).toBe("TOUCHES_ONLY");
});
test.each(["ANALYSIS_COVERS_UNIT", "EQUAL_FOOTPRINT"] as const)("a zero-width line cannot %s an areal unit", relation => {
  const f = fixture(); f.sourceRows[0].relationToAnalysis = relation;
  expect(() => buildScinceCanonicalCoverage(f)).toThrow();
});
test("polygon covering whole units still grants no aggregate", () => {
  const f = fixture(polygon()); f.sourceRows[0].relationToAnalysis = "ANALYSIS_COVERS_UNIT";
  expect(buildScinceCanonicalCoverage(f).aggregation).toBe("PROHIBITED");
});
test.each(["unknownRow", "wrongParent", "badCode", "negative", "inferredDate", "hash"])("rejects inconsistent %s", mode => {
  const f = fixture();
  if (mode === "unknownRow") f.territorialUnits[0].sourceRowIds = ["unknown"];
  if (mode === "wrongParent") f.territorialUnits[0].geographicCode = "0100100019999001";
  if (mode === "badCode") f.sourceRows[0].geographicCode = "missing";
  if (mode === "negative") f.sourceRows[0].demographics.populationTotal = -1;
  if (mode === "inferredDate") (f.sourceRows[0] as any).observedAt = f.dataset.provenance.importedAt;
  if (mode === "hash") f.dataset.provenance.censusSha256 = "invalid";
  expect(() => buildScinceCanonicalCoverage(f)).toThrow();
});
test("no productive connections or documentary consumers are added", () => {
  const fs = require("fs"), path = require("path");
  const code = fs.readFileSync(path.resolve(__dirname, "../src/utils/scinceCanonicalCoverage.ts"), "utf8");
  expect(code).not.toMatch(/getPool|firebase|\.query\(|ST_Centroid|ST_Buffer|ST_Intersects/);
});
