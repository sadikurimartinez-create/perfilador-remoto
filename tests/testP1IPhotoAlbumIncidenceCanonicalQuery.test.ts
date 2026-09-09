import { buildExpedientIncidenceCanonicalSpatialQuery } from "../src/lib/projectIncidenceCanonicalSpatialQuery";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import fs from "node:fs";
import path from "node:path";

const mockQueryCrimeIncidence = jest.fn();

jest.mock("../src/lib/crimeIncidenceRepository", () => ({
  queryCrimeIncidence: (input: any) => mockQueryCrimeIncidence(input),
}));

jest.mock("../src/lib/incidenceStreetCorridor", () => ({
  buildStreetAnalyticalCorridor: jest.fn(async (input: any) => ({
    corridorGeometry: {
      type: "Polygon",
      coordinates: [[
        input.geometry.coordinates[0][0],
        input.geometry.coordinates[0][1],
        input.geometry.coordinates[0][1],
        input.geometry.coordinates[0][0],
      ]],
    },
    widthMeters: input.widthMeters ?? 1000,
  })),
}));

import { POST } from "../src/app/api/incidencia/route";

const baseGeography = {
  geographyId: "geo-p1i",
  source: "PROJECT_CREATION",
  validationStatus: "VALID",
  createdAt: 1,
  updatedAt: 1,
} as const;

const pointGeography: CanonicalProjectGeography = {
  ...baseGeography,
  type: "INDIVIDUAL",
  geometry: { type: "Point", coordinates: [-102.291, 21.885] },
};

const corridorPositions: Array<[number, number]> = [
  [-102.291, 21.885],
  [-102.292, 21.886],
  [-102.293, 21.887],
];

const corridorGeography: CanonicalProjectGeography = {
  ...baseGeography,
  geographyId: "geo-p1i-corridor",
  type: "CORRIDOR",
  geometry: { type: "LineString", coordinates: corridorPositions },
};

const polygonRing: Array<[number, number]> = [
  [-102.291, 21.885],
  [-102.292, 21.885],
  [-102.292, 21.886],
  [-102.291, 21.885],
];

const polygonGeography: CanonicalProjectGeography = {
  ...baseGeography,
  geographyId: "geo-p1i-polygon",
  type: "POLYGON",
  geometry: { type: "Polygon", coordinates: [polygonRing] },
};

function response(overrides: Record<string, unknown>) {
  return {
    success: true,
    querySource: "POSTGIS",
    sourceStatus: "POSTGIS_AVAILABLE",
    coverageStatus: "IN_COVERAGE",
    data: [{ INCIDENTE: "ROBO" }],
    bibliografia: "",
    lineage: { filters: {} },
    ...overrides,
  };
}

const requestWithBody = (body: any) => ({ json: async () => body }) as any;

describe("P1-I - PhotoAlbum incidencia canonical spatial query", () => {
  beforeEach(() => {
    mockQueryCrimeIncidence.mockReset();
  });

  test("T1 expediente INDIVIDUAL genera request POINT_RADIUS", () => {
    const query = buildExpedientIncidenceCanonicalSpatialQuery({
      expedienteId: "exp-p1i",
      canonicalGeography: pointGeography,
      radiusMeters: 1000,
      now: "2026-09-08T00:00:00.000Z",
    });

    expect(query).toMatchObject({
      mode: "POINT_RADIUS",
      source: "EXPEDIENT",
      geometry: { type: "Point", coordinates: [-102.291, 21.885] },
      metadata: { expedienteId: "exp-p1i", radiusMeters: 1000, territoryType: "INDIVIDUAL" },
    });
  });

  test("T2 expediente CORREDOR genera request CORRIDOR_COVERAGE", () => {
    const query = buildExpedientIncidenceCanonicalSpatialQuery({
      expedienteId: "exp-p1i",
      canonicalGeography: corridorGeography,
      corridorWidthMeters: 1000,
      now: "2026-09-08T00:00:00.000Z",
    });

    expect(query.mode).toBe("CORRIDOR_COVERAGE");
    expect(query.source).toBe("EXPEDIENT");
    expect(query.geometry).toEqual({ type: "LineString", coordinates: corridorPositions });
    expect(query.metadata.corridorWidthMeters).toBe(1000);
  });

  test("T3 expediente POLIGONO genera request POLYGON_BOUNDARY", () => {
    const query = buildExpedientIncidenceCanonicalSpatialQuery({
      expedienteId: "exp-p1i",
      canonicalGeography: polygonGeography,
      now: "2026-09-08T00:00:00.000Z",
    });

    expect(query.mode).toBe("POLYGON_BOUNDARY");
    expect(query.source).toBe("EXPEDIENT");
    expect(query.geometry.type).toBe("Polygon");
  });

  test("T4 poligono preserva vertices reales", () => {
    const query = buildExpedientIncidenceCanonicalSpatialQuery({
      canonicalGeography: polygonGeography,
      now: "2026-09-08T00:00:00.000Z",
    });

    expect(query.geometry).toEqual({ type: "Polygon", coordinates: [polygonRing] });
  });

  test("T5 corredor preserva nodos reales", () => {
    const query = buildExpedientIncidenceCanonicalSpatialQuery({
      canonicalGeography: corridorGeography,
      now: "2026-09-08T00:00:00.000Z",
    });

    expect(query.geometry).toEqual({ type: "LineString", coordinates: corridorPositions });
  });

  test("T6 PhotoAlbum no envia solo lat/lng para corredor o poligono", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoAlbum.tsx"), "utf8");
    const block = source.slice(
      source.indexOf("buildExpedientIncidenceCanonicalSpatialQuery({"),
      source.indexOf("const data = await res.json();", source.indexOf("buildExpedientIncidenceCanonicalSpatialQuery({"))
    );

    expect(block).toContain("canonicalSpatialQuery");
    expect(block).not.toContain("queryLat");
    expect(block).not.toContain("queryLng");
    expect(block).not.toContain("body: JSON.stringify({ lat:");
  });

  test("T7 geometria ausente no produce consulta default", () => {
    expect(() =>
      buildExpedientIncidenceCanonicalSpatialQuery({
        canonicalGeography: null,
        now: "2026-09-08T00:00:00.000Z",
      })
    ).toThrow("INCIDENCE_CANONICAL_GEOGRAPHY_REQUIRED");
  });

  test("T8 CSV polygon unsupported no se interpreta como cero delitos", async () => {
    mockQueryCrimeIncidence.mockResolvedValue(response({
      success: false,
      querySource: "CSV_LEGACY_FALLBACK",
      sourceStatus: "FAILED",
      data: [],
      error: "CSV_LEGACY_FALLBACK_POLYGON_NOT_SUPPORTED_NO_GEOMETRY_DEGRADATION",
    }));

    const res = await POST(requestWithBody({ canonicalSpatialQuery: buildExpedientIncidenceCanonicalSpatialQuery({ canonicalGeography: polygonGeography }) }));
    const body = await res.json();

    expect(body.resultStatus).toBe("FALLBACK_BLOCKED");
    expect(body.success).toBe(false);
    expect(body.error).toBe("CSV_LEGACY_FALLBACK_POLYGON_NOT_SUPPORTED_NO_GEOMETRY_DEGRADATION");
  });

  test("T9 respuesta valida vacia queda como SUCCESS_EMPTY explicito", async () => {
    mockQueryCrimeIncidence.mockResolvedValue(response({ data: [] }));

    const res = await POST(requestWithBody({ canonicalSpatialQuery: buildExpedientIncidenceCanonicalSpatialQuery({ canonicalGeography: pointGeography }) }));
    const body = await res.json();

    expect(body.resultStatus).toBe("SUCCESS_EMPTY");
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  test("T10 error datasource queda visible como ERROR", async () => {
    mockQueryCrimeIncidence.mockResolvedValue(response({
      success: false,
      sourceStatus: "FAILED",
      data: [],
      error: "DATABASE_URL not configured for canonical PostGIS incidence query.",
    }));

    const res = await POST(requestWithBody({ canonicalSpatialQuery: buildExpedientIncidenceCanonicalSpatialQuery({ canonicalGeography: pointGeography }) }));
    const body = await res.json();

    expect(body.resultStatus).toBe("ERROR");
    expect(body.error).toContain("DATABASE_URL");
  });

  test("T11 filtros de categorias visibles se conservan en el request", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoAlbum.tsx"), "utf8");
    const block = source.slice(
      source.indexOf("body: JSON.stringify({", source.indexOf("canonicalSpatialQuery")),
      source.indexOf("});", source.indexOf("body: JSON.stringify({", source.indexOf("canonicalSpatialQuery")))
    );

    expect(block).toContain("selectedCrimeCategoryFilters: activeDelitos");
    expect(block).toContain("allowLegacyFallback: true");
  });

  test("T12 P4-E PhotoAlbum distingue transporte completado de exito de negocio", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoAlbum.tsx"), "utf8");
    const block = source.slice(
      source.indexOf("const [mapRes, incidenciaRes] = await Promise.all"),
      source.indexOf("// Empaquetar las instrucciones de la Evidencia Multimodal")
    );

    expect(block).toContain("APIs iniciales completaron transporte");
    expect(block).not.toContain("APIs territoriales e incidencia resueltas");
    expect(block).toContain("const incidenciaStatus = incidenciaJson.resultStatus || (incidenciaRes.ok ? \"SUCCESS\" : \"ERROR\")");
    expect(block).toContain("Incidencia: ${incidenciaStatus}");
  });

  test("T13 P4-E PhotoAlbum no consume incidencia con business error como cero delitos", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoAlbum.tsx"), "utf8");
    const block = source.slice(
      source.indexOf("let incidenciaLocal: any[] = []"),
      source.indexOf("// Empaquetar las instrucciones de la Evidencia Multimodal")
    );

    expect(block).toContain("incidenciaRes.ok && incidenciaJson.success !== false");
    expect(block).toContain("incidenciaLocal = (incidenciaJson.data ?? []).slice(0, 30)");
    expect(block.indexOf("incidenciaRes.ok && incidenciaJson.success !== false")).toBeLessThan(
      block.indexOf("incidenciaLocal = (incidenciaJson.data ?? []).slice(0, 30)")
    );
    expect(block).toContain("incidenciaError: incidenciaJson.error || incidenciaRes.statusText");
  });

  test("T14 P4-E SUCCESS_EMPTY se conserva como vacio valido distinguible", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoAlbum.tsx"), "utf8");
    const block = source.slice(
      source.indexOf("let incidenciaLocal: any[] = []"),
      source.indexOf("// Empaquetar las instrucciones de la Evidencia Multimodal")
    );

    expect(block).toContain("incidenciaStatus === \"SUCCESS_EMPTY\"");
    expect(block).toContain("incidenciaStatus,");
  });
});
