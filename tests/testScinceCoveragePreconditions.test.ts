import { execFileSync } from "child_process";
import { join, resolve } from "path";
import { validateScinceCoverageGeometry, classifyScinceCoverageRelation } from "../src/utils/scinceCoveragePreconditions";
import { buildScinceCanonicalCoverage, evaluateScinceCoverageFreshness, fingerprintScinceCoverageGeography } from "../src/utils/scinceCanonicalCoverage";
import type { CanonicalGeometry, CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import type { ScinceCoverageDataset, ScinceCoverageTopologyEvidence } from "../src/types/scinceCanonicalCoverage";

let run: any;
beforeAll(() => {
  const python = process.env.SCINCE_QA_PYTHON || join(process.env.USERPROFILE || "", ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe");
  run = JSON.parse(execFileSync(python, [resolve(__dirname, "helpers/scinceGeosOffline.py")], { encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 }));
}, 65000);
const row = (id: string): any => run.cases.find((c: any) => c.case === id);
const simpleLine = (): CanonicalGeometry => ({ type: "LineString", coordinates: [[-102, 21], [-101.99, 21.01], [-101.98, 21.02]] });
function declared(g: CanonicalGeometry): ScinceCoverageTopologyEvidence {
  return { geometry: structuredClone(g), crs: 4326, engine: "GEOS", engineVersion: "PURE_DECLARED_FIXTURE",
    isValid: true, isSimple: true, isEmpty: false, area: g.type === "LineString" ? 0 : 1 };
}
function validation(id: string, unit = false) {
  const c = row(id), geometry = unit ? c.unitGeometry : c.analysisGeometry, f = unit ? c.unitFlags : c.analysisFlags;
  return validateScinceCoverageGeometry({ mode: unit ? "POLYGON" : c.mode, geometry,
    crs: unit ? c.unitSrid : c.analysisSrid, topology: { geometry: structuredClone(geometry), crs: unit ? c.unitSrid : c.analysisSrid,
      engine: "GEOS", engineVersion: run.version, isValid: f.valid, isSimple: f.simple, isEmpty: f.empty, area: f.area } });
}
function classify(id: string, override: object = {}) {
  const c = row(id), a = validation(id), u = validation(id, true);
  return classifyScinceCoverageRelation(a, u, { analysisIdentity: a.status === "VALID" ? a.geometryIdentity : "",
    unitIdentity: u.status === "VALID" ? u.geometryIdentity : "", intersects: c.intersects, touches: c.touches,
    coversGU: c.coversGU, coversUG: c.coversUG, equals: c.equals, relate: c.relate, ...override });
}
const dataset: ScinceCoverageDataset = { datasetId: "fixture", year: 2020, version: "v1", provenance: {
  productName: "fixture", geographySourceUrl: "https://www.inegi.org.mx/fixture", censusSourceUrl: "https://www.inegi.org.mx/fixture",
  geographySha256: "a".repeat(64), censusSha256: "b".repeat(64), importedAt: "2026-09-01T00:00:00Z", completedAt: "2026-09-02T00:00:00Z" } };
function coverageInput(g: CanonicalGeometry, topology = declared(g), mode: "CORRIDOR" | "POLYGON" = "CORRIDOR") {
  const geography: CanonicalProjectGeography = { geographyId: `P1:${mode}`, type: mode, geometry: g,
    validationStatus: "VALID", source: "MAP_VECTOR", createdAt: 1, updatedAt: 1 };
  return { projectId: "P1", geography, crs: 4326, topology, dataset, territorialUnits: [], sourceRows: [], limitations: ["fixture"] };
}

test.each([
  ["C1", "simple", "VALID"], ["C2", "bow", "SCINCE_COVERAGE_CORRIDOR_NOT_SIMPLE"],
  ["C3", "repeated", "SCINCE_COVERAGE_CORRIDOR_NOT_SIMPLE"], ["C4", "zeroSegment", "SCINCE_COVERAGE_CORRIDOR_DEGENERATE"],
  ["C5", "identical", "SCINCE_COVERAGE_CORRIDOR_DEGENERATE"], ["C6", "one", "SCINCE_COVERAGE_CORRIDOR_DEGENERATE"],
  ["C7", "empty", "SCINCE_COVERAGE_GEOMETRY_EMPTY"], ["C8", "nan", "SCINCE_COVERAGE_GEOMETRY_NON_FINITE"],
  ["C9", "infinity", "SCINCE_COVERAGE_GEOMETRY_NON_FINITE"], ["C10", "placeholder", "SCINCE_COVERAGE_PLACEHOLDER_COORDINATE"],
  ["C11", "reversed", "VALID"], ["C12", "closed", "SCINCE_COVERAGE_CORRIDOR_DEGENERATE"],
])("%s corridor precondition %s", (_case, kind, expected) => {
  let g = simpleLine(), topology = declared(g);
  if (g.type !== "LineString") throw new Error("fixture");
  if (kind === "bow") { const c = row("L14"); g = c.analysisGeometry; topology = { ...declared(g), isValid: c.analysisFlags.valid, isSimple: c.analysisFlags.simple, area: c.analysisFlags.area }; }
  else {
    if (kind === "repeated") g.coordinates = [[-102, 21], [-101.99, 21], [-101.98, 21], [-101.99, 21], [-101.97, 21]];
    if (kind === "zeroSegment") g.coordinates.splice(1, 0, [...g.coordinates[0]]);
    if (kind === "identical") g.coordinates = [[-102, 21], [-102, 21]];
    if (kind === "one") g.coordinates = [[-102, 21]];
    if (kind === "empty") g.coordinates = [];
    if (kind === "nan") g.coordinates[1][0] = NaN;
    if (kind === "infinity") g.coordinates[1][0] = Infinity;
    if (kind === "placeholder") g.coordinates[1] = [0, 0];
    if (kind === "reversed") g.coordinates.reverse();
    if (kind === "closed") g.coordinates.push([...g.coordinates[0]]);
    topology = declared(g);
  }
  const input = coverageInput(g, topology), before = structuredClone(input);
  const v = validateScinceCoverageGeometry({ mode: "CORRIDOR", geometry: g, crs: 4326, topology });
  if (expected === "VALID") { expect(v.status).toBe("VALID"); expect(buildScinceCanonicalCoverage(input).aggregation).toBe("PROHIBITED"); }
  else { expect(v).toEqual({ status: "INVALID", code: expected }); expect(() => buildScinceCanonicalCoverage(input)).toThrow(expected); }
  expect(input).toEqual(before);
});
test("key GEOS regression: valid true/simple false is institutionally INVALID", () => {
  expect(row("L14").analysisFlags).toMatchObject({ valid: true, simple: false });
  expect(validation("L14")).toEqual({ status: "INVALID", code: "SCINCE_COVERAGE_CORRIDOR_NOT_SIMPLE" });
});
test.each(["P14", "I6", "I8"])("%s invalid analytic or official areal geometry rejected", id => {
  expect(validation(id, id === "I8")).toEqual({ status: "INVALID", code: "SCINCE_COVERAGE_POLYGON_INVALID" });
});
test.each(["I2", "I3"])("%s empty polygon/multipart rejected even when GEOS-valid", id => {
  expect(row(id).analysisFlags.valid).toBe(true);
  expect(validation(id)).toEqual({ status: "INVALID", code: "SCINCE_COVERAGE_GEOMETRY_EMPTY" });
});
test("open ring, invalid hole and invalid component fail closed", () => {
  const g: any = structuredClone(row("P7").analysisGeometry); g.coordinates[0].pop();
  expect(validateScinceCoverageGeometry({ mode: "POLYGON", geometry: g, crs: 4326, topology: declared(g) }).status).toBe("INVALID");
  for (const type of ["Polygon", "MultiPolygon"]) {
    const geometry: any = type === "Polygon" ? row("P9").analysisGeometry : row("P12-A").analysisGeometry;
    expect(validateScinceCoverageGeometry({ mode: "POLYGON", geometry, crs: 4326,
      topology: { ...declared(geometry), isValid: false } })).toEqual({ status: "INVALID", code: "SCINCE_COVERAGE_POLYGON_INVALID" });
  }
});
test("CRS incompatible, absent proof and proof for another geometry reject", () => {
  const g = simpleLine(), e = declared(g);
  expect(validateScinceCoverageGeometry({ mode: "CORRIDOR", geometry: g, crs: 3857, topology: e })).toEqual({ status: "INVALID", code: "SCINCE_COVERAGE_CRS_UNSUPPORTED" });
  expect(validateScinceCoverageGeometry({ mode: "CORRIDOR", geometry: g, crs: 4326, topology: undefined as any }).status).toBe("INVALID");
  const changed: any = structuredClone(g); changed.coordinates[1][0] -= 0.000001;
  expect(validateScinceCoverageGeometry({ mode: "CORRIDOR", geometry: changed, crs: 4326, topology: e })).toEqual({ status: "INVALID", code: "SCINCE_COVERAGE_TOPOLOGY_EVIDENCE_INVALID" });
});
test("topology-invalid input precedes even true equality/covers assertions", () => {
  expect(classify("P14", { equals: true, coversGU: true, coversUG: true }).status).toBe("INVALID");
});
test("Equals is mandatory; mutual Covers without Equals cannot produce equality", () => {
  expect(classify("P7")).toEqual({ status: "RELATED", relation: "EQUAL_FOOTPRINT" });
  expect(classify("P7", { equals: false }).status).toBe("INVALID");
});
test("Touches precedes Covers for boundary-only line and contract usage is enumeration", () => {
  expect(row("L10")).toMatchObject({ touches: true, coversUG: true });
  expect(classify("L10")).toEqual({ status: "RELATED", relation: "TOUCHES_ONLY" });
  expect(row("L10").usage).toBe("ENUMERATION_ONLY");
});
test.each(["L1", "L5", "L7", "L10", "P1", "P4", "P5", "P6", "P7", "P9", "P12-A", "P13", "P16"])("formal precedence preserves experimental classification %s", id => {
  const expected = row(id).classification;
  expect(classify(id)).toEqual(expected === "DISJOINT" ? { status: "DISJOINT" } : { status: "RELATED", relation: expected });
});
test("pair evidence cannot be reused for another admitted geometry identity", () => {
  expect(classify("P7", { analysisIdentity: "other" }).status).toBe("INVALID");
});
test("Equals true/order different remains EQUAL_FOOTPRINT, distinct fingerprint and STALE", () => {
  expect(row("P16").equals).toBe(true); expect(classify("P16")).toEqual({ status: "RELATED", relation: "EQUAL_FOOTPRINT" });
  const a = coverageInput(row("P7").analysisGeometry, { ...declared(row("P7").analysisGeometry), area: row("P7").analysisFlags.area }, "POLYGON");
  const b = { ...a.geography, geometry: row("P16").analysisGeometry };
  const c = buildScinceCanonicalCoverage(a);
  expect(fingerprintScinceCoverageGeography(a.geography)).not.toBe(fingerprintScinceCoverageGeography(b));
  expect(evaluateScinceCoverageFreshness(c, "P1", b)).toBe("STALE");
});
