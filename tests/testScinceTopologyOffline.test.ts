import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { buildScinceCanonicalCoverage, evaluateScinceCoverageFreshness,
  fingerprintScinceCoverageGeography, scinceCoverageObservationId } from "../src/utils/scinceCanonicalCoverage";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import type { ScinceCoverageDataset, ScinceCoverageRelation, ScinceCoverageSourceRow,
  ScinceCoverageTerritorialUnit } from "../src/types/scinceCanonicalCoverage";

const fixtures = JSON.parse(readFileSync(resolve(__dirname, "fixtures/scince-topology-offline.json"), "utf8"));
let run: any;
const result = (id: string): any => run.cases.find((c: any) => c.case === id);
beforeAll(() => {
  const python = process.env.SCINCE_QA_PYTHON || join(process.env.USERPROFILE || "", ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe");
  run = JSON.parse(execFileSync(python, [resolve(__dirname, "helpers/scinceGeosOffline.py")],
    { encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 }));
}, 65000);

test("installed GEOS is executed, no mock or deployed PostGIS", () => {
  expect(run.engine).toBe("GEOS C API (no PostgreSQL connection)"); expect(run.version).toMatch(/^3\./);
  expect(run.cases).toHaveLength(fixtures.length);
});
test.each(fixtures.map((f: any) => [f.case, f.expected]))("%s obtains independently declared expected classification %s", (id, expected) => {
  expect(result(id).classification).toBe(expected); expect(result(id).pass).toBe(true);
});
test("all boundary-only contacts precede Covers and grant ENUMERATION_ONLY", () => {
  const contacts = run.cases.filter((c: any) => c.touches);
  expect(contacts.length).toBeGreaterThan(0);
  contacts.forEach((c: any) => { expect(c.relate[0]).toBe("F"); expect(c.classification).toBe("TOUCHES_ONLY"); expect(c.usage).toBe("ENUMERATION_ONLY"); });
  expect(result("L10")).toMatchObject({ coversUG: true, containsUG: false, touches: true });
});
test("a contained line does not imply traversal; crossing has interior and exterior segments", () => {
  for (const id of ["L5", "L6", "L9-IN"]) expect(result(id)).toMatchObject({ lineBehavior: "CONTAINED", coversUG: true, touches: false });
  for (const id of ["L7", "L8-A", "L8-B", "L11", "L13"]) {
    expect(result(id).lineBehavior).toBe("INTERIOR_AND_EXTERIOR");
    expect(result(id).relate[0]).toBe("1"); expect(result(id).relate[2]).toBe("1");
  }
});
test("LINESTRING never covers or equals positive-area units", () => {
  run.cases.filter((c: any) => c.mode === "CORRIDOR" && c.classification !== "INVALID")
    .forEach((c: any) => { expect(c.coversGU).toBe(false); expect(c.equals).toBe(false); });
});
test("holes exclude units and a line inside the hole, despite bounding box overlap", () => {
  for (const id of ["P9", "P10", "L12"]) expect(result(id)).toMatchObject({ intersects: false, coversGU: false, classification: "DISJOINT" });
  expect(result("P11")).toMatchObject({ intersects: true, touches: false, classification: "INTERIOR_INTERSECTION" });
});
test("multipart units in both components are covered; the gap is not", () => {
  for (const id of ["P12-A", "P12-B"]) expect(result(id)).toMatchObject({ coversGU: true, containsGU: true });
  expect(result("P13")).toMatchObject({ intersects: false, coversGU: false });
  expect(result("L13")).toMatchObject({ intersects: true, coversUG: false });
});
test("equality is checked with Equals after rejecting empty/invalid geometry", () => {
  for (const id of ["P7", "P16"]) expect(result(id)).toMatchObject({ equals: true, coversGU: true, coversUG: true, classification: "EQUAL_FOOTPRINT" });
  for (const id of ["P14", "I2", "I3", "I6"]) expect(result(id)).toMatchObject({ classification: "INVALID", equals: null });
});
test("validity alone admits non-simple line and empty polygons; QA explicitly rejects both", () => {
  expect(result("L14").analysisFlags).toMatchObject({ valid: true, simple: false });
  for (const id of ["I2", "I3"]) expect(result(id).analysisFlags).toMatchObject({ valid: true, empty: true });
  for (const id of ["L14", "I2", "I3"]) expect(result(id).classification).toBe("INVALID");
});
test("invalid WKT, bow-tie, degeneracy and nonfinite coordinates fail closed without MakeValid", () => {
  for (const id of ["L15", "P14", "P15", "I1", "I4", "I5", "I6", "I7", "I8"]) {
    expect(result(id).classification).toBe("INVALID"); expect(result(id).intersects).toBeNull();
  }
});
test("EPSG:4326 is explicit; mismatch is rejected outside GEOS, which does not transform CRS", () => {
  fixtures.filter((f: any) => f.case !== "C1").forEach((f: any) => expect([f.analysisSrid, f.unitSrid]).toEqual([4326, 4326]));
  expect(result("C1")).toMatchObject({ analysisSrid: 3857, unitSrid: 4326, classification: "INVALID", intersects: null });
});

const dataset: ScinceCoverageDataset = { datasetId: "offline-fixture", year: 2020, version: "fixture-v1",
  provenance: { productName: "Synthetic test, not official dataset", geographySourceUrl: "https://www.inegi.org.mx/fixture-geo",
    censusSourceUrl: "https://www.inegi.org.mx/fixture-census", geographySha256: "a".repeat(64), censusSha256: "b".repeat(64),
    importedAt: "2026-09-01T00:00:00Z", completedAt: "2026-09-02T00:00:00Z" } };
function canonical(id: string): CanonicalProjectGeography {
  const c = result(id);
  return { geographyId: `P1:${c.mode}`, type: c.mode, geometry: structuredClone(c.analysisGeometry),
    validationStatus: "VALID", source: "MAP_VECTOR", createdAt: 1, updatedAt: 1 };
}
function input(id = "L8-A") {
  const r: ScinceCoverageSourceRow = { demographicGeographicLevel: "AGEB", geographicCode: "0100100010017",
    sourceRowKey: "01:001:0001:0017", relationToAnalysis: result(id).classification as ScinceCoverageRelation,
    demographics: { populationTotal: 100, housingTotal: null, inhabitedPrivateHousing: 10, uninhabitedPrivateHousing: null, marginacion: null }, observedAt: null };
  const rowId = scinceCoverageObservationId(dataset, r);
  const units: ScinceCoverageTerritorialUnit[] = ["001", "002"].map(mza => ({ geographicLevel: "MANZANA",
    geographicCode: `0100100010017${mza}`, relationToAnalysis: result("L8-A").classification, sourceRowIds: [rowId] }));
  const g = canonical(id), flags = result(id).analysisFlags;
  return { projectId: "P1", geography: g, crs: 4326, topology: { geometry: structuredClone(g.geometry), crs: 4326,
    engine: "GEOS" as const, engineVersion: run.version, isValid: flags.valid, isSimple: flags.simple, isEmpty: flags.empty, area: flags.area },
    dataset: structuredClone(dataset), sourceRows: [r],
    territorialUnits: units, limitations: ["Synthetic unit source totals, not totals of the analysis geometry."] };
}
test("two manzanas and repeated sourceRowKey reference one AGEB observation", () => {
  const f = input(); f.sourceRows.push(structuredClone(f.sourceRows[0]));
  const c = buildScinceCanonicalCoverage(f);
  expect(c.sourceRows).toHaveLength(1); expect(c.territorialUnits).toHaveLength(2);
  expect(c.territorialUnits[0].sourceRowIds).toEqual(c.territorialUnits[1].sourceRowIds);
});
test("identical territorial duplicates also deduplicate", () => {
  const f = input(); f.territorialUnits.push(structuredClone(f.territorialUnits[0]));
  expect(buildScinceCanonicalCoverage(f).territorialUnits).toHaveLength(2);
});
test("contradictory duplicate observation fails closed", () => {
  const f = input(), conflict = structuredClone(f.sourceRows[0]); conflict.demographics.populationTotal = 101;
  f.sourceRows.push(conflict); expect(() => buildScinceCanonicalCoverage(f)).toThrow("SCINCE_COVERAGE_CONTRACT_INVALID");
});
test("AGEB plus child rows preserve separate observations without sums", () => {
  const f = input(), r: ScinceCoverageSourceRow = { ...f.sourceRows[0], demographicGeographicLevel: "MANZANA",
    sourceRowKey: "01:001:0001:0017:001", geographicCode: "0100100010017001" };
  f.sourceRows.push(r); f.territorialUnits[0].sourceRowIds.push(scinceCoverageObservationId(dataset, r));
  const c = buildScinceCanonicalCoverage(f); expect(c.sourceRows).toHaveLength(2); expect(c.aggregation).toBe("PROHIBITED");
  for (const key of ["populationTotal", "housingTotal", "estimatedPopulation", "weightedPopulation", "areaPercentagePopulation", "totals"])
    expect(c).not.toHaveProperty(key);
});
test("partial intersection keeps full-source context, nulls and original provenance", () => {
  const f = input(), before = structuredClone(f), c = buildScinceCanonicalCoverage(f);
  expect(c.sourceRows[0].usage).toBe("FULL_SOURCE_UNIT_CONTEXT_ONLY");
  expect(c.sourceRows[0].demographics).toEqual(f.sourceRows[0].demographics);
  expect(c.dataset.provenance).toEqual(dataset.provenance); expect(c.sourceRows[0].observedAt).toBeNull(); expect(f).toEqual(before);
});
test("real boundary predicate translates to enumeration-only contract usage", () => {
  const f = input("L10"); f.territorialUnits.forEach(u => u.relationToAnalysis = "TOUCHES_ONLY");
  expect(buildScinceCanonicalCoverage(f).sourceRows[0].usage).toBe("ENUMERATION_ONLY");
});
test.each(["L7", "P7", "P12-A"])("%s actual GEOS geometry retains conceptual CURRENT and STALE", id => {
  const f = input(id), c = buildScinceCanonicalCoverage(f), g = structuredClone(f.geography);
  expect(evaluateScinceCoverageFreshness(c, "P1", g)).toBe("CURRENT");
  const walk = (coords: any): void => { if (typeof coords[0] === "number") coords[0] -= 0.00000001; else walk(coords[0]); };
  walk(g.geometry.coordinates);
  if (g.geometry.type === "Polygon") g.geometry.coordinates[0][g.geometry.coordinates[0].length - 1] = [...g.geometry.coordinates[0][0]];
  if (g.geometry.type === "MultiPolygon") g.geometry.coordinates[0][0][g.geometry.coordinates[0][0].length - 1] = [...g.geometry.coordinates[0][0][0]];
  expect(fingerprintScinceCoverageGeography(g)).not.toBe(fingerprintScinceCoverageGeography(f.geography));
  expect(evaluateScinceCoverageFreshness(c, "P1", g)).toBe("STALE");
});
test("GEOS Equals does not erase conservative ordered fingerprint differences", () => {
  const a = canonical("P7"), b = canonical("P16");
  expect(result("P16").equals).toBe(true); expect(fingerprintScinceCoverageGeography(a)).not.toBe(fingerprintScinceCoverageGeography(b));
});
test("corridor reversal, changed hole and changed component change identity", () => {
  const g = canonical("L7"), reverse = structuredClone(g);
  if (reverse.geometry.type === "LineString") reverse.geometry.coordinates.reverse();
  expect(fingerprintScinceCoverageGeography(reverse)).not.toBe(fingerprintScinceCoverageGeography(g));
  const h = canonical("P9"), h2 = structuredClone(h);
  if (h2.geometry.type === "Polygon") h2.geometry.coordinates[1][1][0] -= 0.000001;
  expect(fingerprintScinceCoverageGeography(h2)).not.toBe(fingerprintScinceCoverageGeography(h));
  const m = canonical("P12-A"), m2 = structuredClone(m);
  if (m2.geometry.type === "MultiPolygon") m2.geometry.coordinates.reverse();
  expect(fingerprintScinceCoverageGeography(m2)).not.toBe(fingerprintScinceCoverageGeography(m));
});
test("structurally invalid current geography yields contractual INVALID", () => {
  const f = input(), c = buildScinceCanonicalCoverage(f);
  const bad: any = { ...f.geography, geometry: { type: "LineString", coordinates: [] } };
  expect(evaluateScinceCoverageFreshness(c, "P1", bad)).toBe("INVALID");
});
test("QA uses no centroid/photo fallback, repair, DB or network", () => {
  const source = readFileSync(resolve(__dirname, "helpers/scinceGeosOffline.py"), "utf8");
  expect(source).not.toMatch(/GEOSMakeValid|GEOSGetCentroid|ST_Centroid|psycopg|requests\.|urllib|connect\(/);
});
