import { buildCrimeQueryInputFromCanonicalSpatialQuery } from "../src/lib/incidenceSpatialQueryAdapter";
import type { IncidenceCanonicalSpatialQuery } from "../src/lib/incidenceSpatialTypes";

const closedRing: Array<[number, number]> = [
  [-102.30, 21.88],
  [-102.29, 21.88],
  [-102.29, 21.89],
  [-102.30, 21.88],
];

describe("ADR-INC-001 - Incidence spatial query adapter", () => {
  test("POINT_RADIUS produces a compatible CrimeQueryInput", () => {
    const query: IncidenceCanonicalSpatialQuery = {
      geometry: { type: "Point", coordinates: [-102.30, 21.88] },
      mode: "POINT_RADIUS",
      source: "EXPEDIENT",
      metadata: {
        expedienteId: "exp-001",
        radiusMeters: 1000,
      },
    };

    const result = buildCrimeQueryInputFromCanonicalSpatialQuery(query, {
      allowLegacyFallback: false,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      incidentTypes: ["ROBO"],
      requestedCoverage: "IN_COVERAGE",
    });

    expect(result.crimeQueryInput).toEqual({
      lat: 21.88,
      lng: -102.30,
      radiusMeters: 1000,
      spatialFilter: {
        type: "RADIUS",
        lat: 21.88,
        lng: -102.30,
        radiusMeters: 1000,
      },
      allowLegacyFallback: false,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      incidentTypes: ["ROBO"],
      requestedCoverage: "IN_COVERAGE",
    });
    expect(result.metadata).toMatchObject({
      expedienteId: "exp-001",
      mode: "POINT_RADIUS",
      source: "EXPEDIENT",
    });
  });

  test("POLYGON_BOUNDARY with closed ring produces a POLYGON spatialFilter", () => {
    const query: IncidenceCanonicalSpatialQuery = {
      geometry: { type: "Polygon", coordinates: [closedRing] },
      mode: "POLYGON_BOUNDARY",
      source: "CUSTOM_POLYGON",
      metadata: {
        queryId: "poly-001",
      },
    };

    const result = buildCrimeQueryInputFromCanonicalSpatialQuery(query);

    expect(result.crimeQueryInput).toMatchObject({
      lat: 21.88,
      lng: -102.30,
      radiusMeters: 0,
      spatialFilter: {
        type: "POLYGON",
        coordinates: closedRing,
      },
    });
    expect(result.metadata).toMatchObject({
      queryId: "poly-001",
      mode: "POLYGON_BOUNDARY",
      source: "CUSTOM_POLYGON",
    });
  });

  test("CORRIDOR_COVERAGE with valid corridor Polygon produces a POLYGON spatialFilter", () => {
    const query: IncidenceCanonicalSpatialQuery = {
      geometry: { type: "Polygon", coordinates: [closedRing] },
      mode: "CORRIDOR_COVERAGE",
      source: "STREET_SELECTION",
      metadata: {
        corridorWidthMeters: 30,
        sourceLabel: "Av. Convencion",
      },
    };

    const result = buildCrimeQueryInputFromCanonicalSpatialQuery(query);

    expect(result.crimeQueryInput.spatialFilter).toEqual({
      type: "POLYGON",
      coordinates: closedRing,
    });
    expect(result.crimeQueryInput.radiusMeters).toBe(30);
    expect(result.metadata).toMatchObject({
      corridorWidthMeters: 30,
      sourceLabel: "Av. Convencion",
      mode: "CORRIDOR_COVERAGE",
      source: "STREET_SELECTION",
    });
  });

  test("complex multipart MultiPolygon is rejected instead of silently losing geometry", () => {
    const query: IncidenceCanonicalSpatialQuery = {
      geometry: {
        type: "MultiPolygon",
        coordinates: [[closedRing], [closedRing]],
      },
      mode: "CORRIDOR_COVERAGE",
      source: "STREET_SELECTION",
      metadata: {
        corridorWidthMeters: 30,
      },
    };

    expect(() => buildCrimeQueryInputFromCanonicalSpatialQuery(query)).toThrow(
      "CORRIDOR_COVERAGE_MULTIPOLYGON_MULTIPART_NOT_SUPPORTED_BY_CRIME_QUERY_INPUT"
    );
  });

  test("invalid coordinates are rejected", () => {
    const query: IncidenceCanonicalSpatialQuery = {
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-102.30, 21.88],
          [-102.29, 91],
          [-102.29, 21.89],
          [-102.30, 21.88],
        ]],
      },
      mode: "POLYGON_BOUNDARY",
      source: "CUSTOM_POLYGON",
      metadata: {},
    };

    expect(() => buildCrimeQueryInputFromCanonicalSpatialQuery(query)).toThrow(
      "POLYGON_BOUNDARY_INVALID_COORDINATES"
    );
  });
});
