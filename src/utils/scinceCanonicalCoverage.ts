import { createHash } from "crypto";
import type { CanonicalProjectGeography } from "./canonicalProjectGeography";
import type { ScinceCanonicalCoverage, ScinceCoverageDataset, ScinceCoverageRelation,
  ScinceCoverageSourceRow, ScinceCoverageTerritorialUnit, ScinceCoverageTopologyEvidence } from "../types/scinceCanonicalCoverage";
import { validateScinceCoverageGeometry } from "./scinceCoveragePreconditions";

export const SCINCE_COVERAGE_FINGERPRINT_VERSION = "SCINCE_COVERAGE_FINGERPRINT_V1";
const relations: ScinceCoverageRelation[] = ["TOUCHES_ONLY", "INTERIOR_INTERSECTION",
  "ANALYSIS_COVERS_UNIT", "UNIT_COVERS_ANALYSIS", "EQUAL_FOOTPRINT"];
const fail = (): never => { throw new Error("SCINCE_COVERAGE_CONTRACT_INVALID"); };
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Structural guard only, NOT a replacement for future GEOS topology validation. */
export function fingerprintScinceCoverageGeography(g: CanonicalProjectGeography): string {
  if (!g || g.validationStatus !== "VALID" || !text(g.geographyId)) return fail();
  const position = (p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 &&
    p.every(v => typeof v === "number" && Number.isFinite(v)) && Math.abs(p[0]) <= 180 &&
    Math.abs(p[1]) <= 90 && !(p[0] === 0 && p[1] === 0);
  const same = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1];
  const ring = (r: unknown): boolean => Array.isArray(r) && r.length >= 4 && r.every(position) &&
    same(r[0], r[r.length - 1]) && new Set(r.slice(0, -1).map(p => JSON.stringify(p))).size >= 3;
  const polygon = (p: unknown): boolean => Array.isArray(p) && p.length > 0 && p.every(ring);
  const geometry = g.geometry;
  if (g.type === "CORRIDOR") {
    if (geometry?.type !== "LineString" || geometry.coordinates.length < 2 ||
      !geometry.coordinates.every(position) || geometry.coordinates.some((p, i, a) => i > 0 && same(p, a[i - 1])) ||
      same(geometry.coordinates[0], geometry.coordinates[geometry.coordinates.length - 1])) return fail();
  } else if (g.type === "POLYGON") {
    if (!(geometry?.type === "Polygon" && polygon(geometry.coordinates)) &&
      !(geometry?.type === "MultiPolygon" && geometry.coordinates.length > 0 && geometry.coordinates.every(polygon))) return fail();
  } else return fail();
  // Exact sequence identity: no rounding, sorting, ring rotation, repair or derived points.
  const payload = JSON.stringify({ version: SCINCE_COVERAGE_FINGERPRINT_VERSION,
    geographyId: g.geographyId, type: g.type, geometry: { type: geometry.type, coordinates: geometry.coordinates } });
  return `${SCINCE_COVERAGE_FINGERPRINT_VERSION}:${createHash("sha256").update(payload).digest("hex")}`;
}

export function scinceCoverageObservationId(dataset: ScinceCoverageDataset,
  row: Pick<ScinceCoverageSourceRow, "demographicGeographicLevel" | "sourceRowKey">): string {
  return JSON.stringify([dataset.datasetId, dataset.year, dataset.version, row.demographicGeographicLevel, row.sourceRowKey]);
}

/** Pure assembly of already classified fixture observations; computes NO spatial predicates. */
export function buildScinceCanonicalCoverage(input: {
  projectId: string;
  geography: CanonicalProjectGeography;
  crs: number;
  topology: ScinceCoverageTopologyEvidence;
  dataset: ScinceCoverageDataset;
  territorialUnits: ScinceCoverageTerritorialUnit[];
  sourceRows: ScinceCoverageSourceRow[];
  limitations: string[];
}): ScinceCanonicalCoverage {
  const admission = validateScinceCoverageGeometry({ mode: input.geography?.type as "CORRIDOR" | "POLYGON",
    geometry: input.geography?.geometry, crs: input.crs, topology: input.topology });
  if (admission.status === "INVALID") throw new Error(admission.code);
  const fingerprint = fingerprintScinceCoverageGeography(input.geography);
  const d = input.dataset, p = d?.provenance;
  if (!text(input.projectId) || !text(d?.datasetId) || !Number.isInteger(d.year) || d.year < 1900 ||
    !text(d.version) || !p || !text(p.productName) ||
    ![p.geographySourceUrl, p.censusSourceUrl].every(v => typeof v === "string" && /^https:\/\/www\.inegi\.org\.mx\//.test(v)) ||
    ![p.geographySha256, p.censusSha256].every(v => /^[0-9a-f]{64}$/.test(v)) ||
    ![p.importedAt, p.completedAt].every(v => text(v) && Number.isFinite(Date.parse(v))) ||
    !Array.isArray(input.limitations) || !input.limitations.length || !input.limitations.every(text)) return fail();
  const rows = new Map<string, ScinceCanonicalCoverage["sourceRows"][number]>();
  for (const r of input.sourceRows) {
    const pattern = r.demographicGeographicLevel === "AGEB" ? /^\d{2}:\d{3}:\d{4}:[0-9A-Z]{4}$/ :
      r.demographicGeographicLevel === "MANZANA" ? /^\d{2}:\d{3}:\d{4}:[0-9A-Z]{4}:\d{3}$/ : null;
    if (!pattern || !pattern.test(r.sourceRowKey) || r.geographicCode !== r.sourceRowKey.replace(/:/g, "") ||
      !relations.includes(r.relationToAnalysis) || r.observedAt !== null || !r.demographics || r.demographics.marginacion !== null ||
      ![r.demographics.populationTotal, r.demographics.housingTotal, r.demographics.inhabitedPrivateHousing,
        r.demographics.uninhabitedPrivateHousing].every(v => v === null || Number.isSafeInteger(v) && v >= 0) ||
      input.geography.type === "CORRIDOR" && ["ANALYSIS_COVERS_UNIT", "EQUAL_FOOTPRINT"].includes(r.relationToAnalysis)) return fail();
    const id = scinceCoverageObservationId(d, r);
    const row = { demographicGeographicLevel: r.demographicGeographicLevel, sourceRowKey: r.sourceRowKey,
      geographicCode: r.geographicCode, relationToAnalysis: r.relationToAnalysis,
      demographics: structuredClone(r.demographics), observedAt: null,
      observationId: id, usage: r.relationToAnalysis === "TOUCHES_ONLY" ? "ENUMERATION_ONLY" : "FULL_SOURCE_UNIT_CONTEXT_ONLY" } as const;
    if (rows.has(id) && JSON.stringify(rows.get(id)) !== JSON.stringify(row)) return fail();
    rows.set(id, row);
  }
  const units = new Map<string, ScinceCoverageTerritorialUnit>();
  const lengths = { ESTADO: 2, MUNICIPIO: 5, LOCALIDAD: 9, AGEB: 13, MANZANA: 16 };
  for (const u of input.territorialUnits) {
    if (!(u.geographicLevel in lengths) || typeof u.geographicCode !== "string" ||
      u.geographicCode.length !== lengths[u.geographicLevel] || !/^[0-9A-Z]+$/.test(u.geographicCode) ||
      !relations.includes(u.relationToAnalysis) || !Array.isArray(u.sourceRowIds) ||
      input.geography.type === "CORRIDOR" && ["ANALYSIS_COVERS_UNIT", "EQUAL_FOOTPRINT"].includes(u.relationToAnalysis)) return fail();
    const ids = [...new Set(u.sourceRowIds)].sort();
    for (const id of ids) {
      const r = rows.get(id);
      if (!r || !(u.geographicLevel === r.demographicGeographicLevel && u.geographicCode === r.geographicCode ||
        u.geographicLevel === "MANZANA" && r.demographicGeographicLevel === "AGEB" &&
        u.geographicCode.slice(0, 13) === r.geographicCode)) return fail();
    }
    const unit = { geographicLevel: u.geographicLevel, geographicCode: u.geographicCode,
      relationToAnalysis: u.relationToAnalysis, sourceRowIds: ids };
    const id = JSON.stringify([u.geographicLevel, u.geographicCode]);
    if (units.has(id) && JSON.stringify(units.get(id)) !== JSON.stringify(unit)) return fail();
    units.set(id, unit);
  }
  if ([...rows.keys()].some(id => ![...units.values()].some(u => u.sourceRowIds.includes(id)))) return fail();
  return { schemaVersion: "SCINCE_CANONICAL_COVERAGE_V1", support: "SUPPORTED_CONTEXT_ONLY", aggregation: "PROHIBITED",
    projectId: input.projectId, geographyBinding: { geographyId: input.geography.geographyId,
      geographyType: input.geography.type as "CORRIDOR" | "POLYGON", geographyFingerprint: fingerprint },
    coverageMode: input.geography.type === "CORRIDOR" ? "LINE_INTERSECTION_CONTEXT" : "POLYGON_INTERSECTION_CONTEXT",
    dataset: structuredClone(d), territorialUnits: [...units.values()], sourceRows: [...rows.values()],
    limitations: [...input.limitations, "Cifras completas de cada unidad fuente; no estiman población ni viviendas de la geometría analítica.",
      "Sin agregación, ponderación o prorrateo; contacto de borde sólo permite enumeración."] };
}

/** Conceptual freshness for trusted design-contract objects, not a publication gate. */
export function evaluateScinceCoverageFreshness(coverage: ScinceCanonicalCoverage, projectId: string,
  geography: CanonicalProjectGeography): "CURRENT" | "STALE" | "INVALID" {
  if (!coverage || coverage.schemaVersion !== "SCINCE_CANONICAL_COVERAGE_V1") return "INVALID";
  try {
    return coverage.projectId === projectId && coverage.geographyBinding.geographyId === geography.geographyId &&
      coverage.geographyBinding.geographyType === geography.type &&
      coverage.geographyBinding.geographyFingerprint === fingerprintScinceCoverageGeography(geography) ? "CURRENT" : "STALE";
  } catch { return "INVALID"; }
}
