import type { CanonicalGeometry } from "./canonicalProjectGeography";
import type { ScinceCoverageGeometryCode, ScinceCoverageGeometryValidation,
  ScinceCoverageRelation, ScinceCoverageTopologyEvidence } from "../types/scinceCanonicalCoverage";

export const SCINCE_COVERAGE_EXPECTED_CRS = 4326;
const invalid = (code: ScinceCoverageGeometryCode): ScinceCoverageGeometryValidation => ({ status: "INVALID", code });

/** Pure preconditions over raw coordinates and trusted GEOS facts; no topology computation or repair. */
export function validateScinceCoverageGeometry(input: { mode: "CORRIDOR" | "POLYGON";
  geometry: CanonicalGeometry; crs: number; topology: ScinceCoverageTopologyEvidence }): ScinceCoverageGeometryValidation {
  if (input.crs !== SCINCE_COVERAGE_EXPECTED_CRS) return invalid("SCINCE_COVERAGE_CRS_UNSUPPORTED");
  const g = input.geometry;
  if (!g || !(input.mode === "CORRIDOR" && g.type === "LineString" || input.mode === "POLYGON" &&
    (g.type === "Polygon" || g.type === "MultiPolygon")) || !Array.isArray(g.coordinates))
    return invalid("SCINCE_COVERAGE_GEOMETRY_STRUCTURE_INVALID");
  const entirelyEmpty = (v: unknown): boolean => Array.isArray(v) && v.every(entirelyEmpty);
  if (entirelyEmpty(g.coordinates)) return invalid("SCINCE_COVERAGE_GEOMETRY_EMPTY");
  let rejection: ScinceCoverageGeometryCode | undefined;
  const position = (p: unknown): p is [number, number] => {
    if (!Array.isArray(p) || p.length !== 2) { rejection = "SCINCE_COVERAGE_GEOMETRY_STRUCTURE_INVALID"; return false; }
    if (!p.every(v => typeof v === "number" && Number.isFinite(v))) { rejection = "SCINCE_COVERAGE_GEOMETRY_NON_FINITE"; return false; }
    if (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) { rejection = "SCINCE_COVERAGE_COORDINATE_OUT_OF_RANGE"; return false; }
    if (p[0] === 0 && p[1] === 0) { rejection = "SCINCE_COVERAGE_PLACEHOLDER_COORDINATE"; return false; }
    return true;
  };
  const same = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1];
  const ring = (r: unknown): boolean => Array.isArray(r) && r.length >= 4 && r.every(position) &&
    same(r[0], r[r.length - 1]) && new Set(r.slice(0, -1).map(p => JSON.stringify(p))).size >= 3;
  const polygon = (p: unknown): boolean => Array.isArray(p) && p.length > 0 && p.every(ring);
  if (g.type === "LineString") {
    if (!g.coordinates.every(position)) return invalid(rejection!);
    if (g.coordinates.length < 2 || same(g.coordinates[0], g.coordinates[g.coordinates.length - 1]) ||
      g.coordinates.some((p, i, a) => i > 0 && same(p, a[i - 1])))
      return invalid("SCINCE_COVERAGE_CORRIDOR_DEGENERATE");
    if (new Set(g.coordinates.map(p => JSON.stringify(p))).size !== g.coordinates.length)
      return invalid("SCINCE_COVERAGE_CORRIDOR_NOT_SIMPLE");
  } else if (!(g.type === "Polygon" ? polygon(g.coordinates) : g.coordinates.every(polygon)))
    return invalid(rejection || "SCINCE_COVERAGE_POLYGON_INVALID");
  const e = input.topology;
  if (!e || e.engine !== "GEOS" || typeof e.engineVersion !== "string" || !e.engineVersion.trim() ||
    ![e.isValid, e.isSimple, e.isEmpty].every(v => typeof v === "boolean") ||
    typeof e.area !== "number" || !Number.isFinite(e.area) || e.area < 0)
    return invalid("SCINCE_COVERAGE_TOPOLOGY_EVIDENCE_INVALID");
  if (e.crs !== input.crs) return invalid("SCINCE_COVERAGE_CRS_UNSUPPORTED");
  if (!e.geometry || e.geometry.type !== g.type || JSON.stringify(e.geometry.coordinates) !== JSON.stringify(g.coordinates))
    return invalid("SCINCE_COVERAGE_TOPOLOGY_EVIDENCE_INVALID");
  if (e.isEmpty) return invalid("SCINCE_COVERAGE_GEOMETRY_EMPTY");
  if (!e.isValid) return invalid(input.mode === "CORRIDOR" ? "SCINCE_COVERAGE_CORRIDOR_DEGENERATE" : "SCINCE_COVERAGE_POLYGON_INVALID");
  if (input.mode === "CORRIDOR" && !e.isSimple) return invalid("SCINCE_COVERAGE_CORRIDOR_NOT_SIMPLE");
  if (input.mode === "POLYGON" && e.area <= 0) return invalid("SCINCE_COVERAGE_POLYGON_INVALID");
  return { status: "VALID", mode: input.mode,
    geometryIdentity: JSON.stringify({ mode: input.mode, crs: input.crs, geometry: { type: g.type, coordinates: g.coordinates } }) };
}

export interface ScinceCoveragePairPredicates {
  /** Trusted engine facts for exactly these admitted geometry identities. */
  analysisIdentity: string;
  unitIdentity: string;
  intersects: boolean;
  touches: boolean;
  coversGU: boolean;
  coversUG: boolean;
  equals: boolean;
  relate: string;
}
/** Pure decision over measured predicates, not a productive spatial classifier or query. */
export function classifyScinceCoverageRelation(analysis: ScinceCoverageGeometryValidation,
  unit: ScinceCoverageGeometryValidation, p: ScinceCoveragePairPredicates):
  { status: "INVALID"; code: "SCINCE_COVERAGE_PAIR_INVALID" } |
  { status: "DISJOINT" } | { status: "RELATED"; relation: ScinceCoverageRelation } {
  const reject = () => ({ status: "INVALID", code: "SCINCE_COVERAGE_PAIR_INVALID" } as const);
  if (analysis.status !== "VALID" || unit.status !== "VALID" || unit.mode !== "POLYGON" || !p ||
    p.analysisIdentity !== analysis.geometryIdentity || p.unitIdentity !== unit.geometryIdentity ||
    ![p.intersects, p.touches, p.coversGU, p.coversUG, p.equals].every(v => typeof v === "boolean") ||
    typeof p.relate !== "string" || !/^[F012]{9}$/.test(p.relate)) return reject();
  if (!p.intersects) return p.touches || p.coversGU || p.coversUG || p.equals ? reject() : { status: "DISJOINT" };
  if (p.touches) return p.relate[0] !== "F" || p.coversGU || p.equals ? reject() : { status: "RELATED", relation: "TOUCHES_ONLY" };
  if (p.equals) return analysis.mode !== "POLYGON" || !p.coversGU || !p.coversUG || p.relate[0] !== "2" ? reject() :
    { status: "RELATED", relation: "EQUAL_FOOTPRINT" };
  // Mutual Covers without Equals is inconsistent evidence, never an alternate route to equality.
  if (p.coversGU && p.coversUG) return reject();
  if (p.relate[0] !== (analysis.mode === "CORRIDOR" ? "1" : "2")) return reject();
  if (p.coversGU) return analysis.mode !== "POLYGON" ? reject() : { status: "RELATED", relation: "ANALYSIS_COVERS_UNIT" };
  if (p.coversUG) return { status: "RELATED", relation: "UNIT_COVERS_ANALYSIS" };
  return { status: "RELATED", relation: "INTERIOR_INTERSECTION" };
}
