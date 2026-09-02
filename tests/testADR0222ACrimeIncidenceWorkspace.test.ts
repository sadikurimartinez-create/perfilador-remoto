import fs from "node:fs";
import path from "node:path";
import {
  CRIME_INCIDENCE_INSTITUTIONAL_BRANDING,
  type CrimeIncidenceQueryGeometry,
} from "../src/types/crimeIncidenceWorkspace";
import {
  adaptCrimeIncidenceQueryResult,
  createCrimeIncidenceVisualProductMetadata,
  type CurrentCrimeIncidenceQueryResult,
} from "../src/utils/crimeIncidenceWorkspaceAdapter";

const lineage = {
  dataset: "incidencia_estadistica",
  querySource: "POSTGIS" as const,
  filters: { radiusMeters: 1000 },
  timeRange: { start: null, end: null, status: "TEMPORAL_COVERAGE_UNKNOWN" as const },
  geographicFilter: {
    center: { lat: 21.88, lng: -102.29 },
    radiusMeters: 1000,
    coverageStatus: "IN_COVERAGE" as const,
  },
  recordSubset: { totalScanned: 1, matched: 1, excluded: 0, duplicates: 0, returnedRecords: 1 },
};

function result(overrides: Partial<CurrentCrimeIncidenceQueryResult> = {}): CurrentCrimeIncidenceQueryResult {
  return {
    querySource: "POSTGIS",
    sourceStatus: "POSTGIS_AVAILABLE",
    coverageStatus: "IN_COVERAGE",
    data: [{
      INCIDENTE: "Robo",
      FECHA: "2026-08-01",
      lat: 21.881,
      lng: -102.291,
      originalLat: 21.881,
      originalLng: -102.291,
      fuente: "incidencia.csv",
    }],
    bibliografia: "",
    lineage,
    ...overrides,
  };
}

describe("ADR-022.2A canonical incidence workspace", () => {
  test("POSTGIS remains POSTGIS and preserves original coordinates", () => {
    const envelope = adaptCrimeIncidenceQueryResult({ result: result() });
    expect(envelope.querySource).toBe("POSTGIS");
    expect(envelope.sourceStatus).toBe("POSTGIS_AVAILABLE");
    expect(envelope.records[0].coordinates).toMatchObject({
      lat: 21.881,
      lng: -102.291,
      originalLat: 21.881,
      originalLng: -102.291,
    });
  });

  test("CSV fallback remains explicitly legacy", () => {
    const envelope = adaptCrimeIncidenceQueryResult({ result: result({
      querySource: "CSV_LEGACY_FALLBACK",
      sourceStatus: "CSV_LEGACY_FALLBACK",
      lineage: { ...lineage, querySource: "CSV_LEGACY_FALLBACK", dataset: "incidencia_csv_files" },
    }) });
    expect(envelope.querySource).toBe("CSV_LEGACY_FALLBACK");
    expect(envelope.warnings).toContain("CSV_LEGACY_FALLBACK_ACTIVE");
  });

  test("FAILED remains FAILED and OUT_OF_COVERAGE is not absence", () => {
    const failed = adaptCrimeIncidenceQueryResult({ result: result({ sourceStatus: "FAILED", data: [], error: "db unavailable" }) });
    const outside = adaptCrimeIncidenceQueryResult({ result: result({ querySource: "NONE", sourceStatus: "OUT_OF_COVERAGE", coverageStatus: "OUT_OF_COVERAGE", data: [] }) });
    expect(failed.sourceStatus).toBe("FAILED");
    expect(failed.errors).toEqual(["db unavailable"]);
    expect(outside.warnings).toContain("OUT_OF_COVERAGE_IS_NOT_CONFIRMED_ABSENCE");
  });

  test("unknown fields remain absent and no evidence or finding is created", () => {
    const envelope = adaptCrimeIncidenceQueryResult({ result: result({ data: [{ lat: 21.88, lng: -102.29 }] }) });
    expect(envelope.records[0].incidentType).toBeNull();
    expect(envelope.records[0].occurredTime).toBeNull();
    expect(envelope.records[0].location).toEqual({});
    expect((envelope.records[0] as unknown as Record<string, unknown>).evidenceRef).toBeUndefined();
    expect((envelope.records[0] as unknown as Record<string, unknown>).findingRef).toBeUndefined();
  });

  test.each<CrimeIncidenceQueryGeometry>([
    { mode: "POINT_RADIUS", geometry: { type: "Point", coordinates: [-102.29, 21.88] }, radiusMeters: 1000 },
    { mode: "CORRIDOR_COVERAGE", geometry: { type: "LineString", coordinates: [[-102.29, 21.88], [-102.28, 21.89]] }, corridorWidthMeters: 100 },
    { mode: "POLYGON_BOUNDARY", geometry: { type: "Polygon", coordinates: [[[-102.29, 21.88], [-102.28, 21.88], [-102.28, 21.89], [-102.29, 21.88]]] } },
  ])("supports query geometry $mode", (queryGeometry) => {
    const envelope = adaptCrimeIncidenceQueryResult({ result: result(), queryGeometry });
    expect(envelope.queryGeometry).toEqual(queryGeometry);
  });

  test("descriptive visual stays descriptive and receives institutional governance", () => {
    const visual = createCrimeIncidenceVisualProductMetadata({
      visualId: "crime-count-chart",
      visualType: "CHART",
      title: "Conteo observado",
      datasetReference: "incidencia_estadistica",
      variables: ["incidentType"],
      transformation: "count-by-type",
      analyticLevel: "DESCRIPTIVE",
      sourceReference: "POSTGIS",
      lineage,
    });
    expect(visual.analyticLevel).toBe("DESCRIPTIVE");
    expect(visual.analyticLevel).not.toBe("PREDICTIVE");
    expect(visual.watermark).toBe("CEIPOL");
  });

  test("institutional branding and adapter determinism are explicit", () => {
    const left = adaptCrimeIncidenceQueryResult({ result: result() });
    const right = adaptCrimeIncidenceQueryResult({ result: result() });
    const adapterSource = fs.readFileSync(path.join(process.cwd(), "src/utils/crimeIncidenceWorkspaceAdapter.ts"), "utf8");
    expect(left.records[0].id).toBe(right.records[0].id);
    expect(CRIME_INCIDENCE_INSTITUTIONAL_BRANDING).toEqual({
      institutionHeader: "Centro de Estudios en Seguridad y Política Criminal",
      institutionFooter: "Secretaría de Seguridad Pública del Estado de Aguascalientes",
      watermark: "CEIPOL",
    });
    expect(adapterSource).not.toMatch(/Date\.now|Math\.random|new Date/);
  });
});
