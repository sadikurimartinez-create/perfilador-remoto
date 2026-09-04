import { getPool } from "@/lib/db";
import type { IncidenceStreetMultiLineStringGeometry } from "./incidenceStreetCandidateProvider";

export const STREET_CORRIDOR_ALLOWED_WIDTHS_METERS = [
  15,
  30,
  50,
] as const;

export type StreetCorridorWidthMeters =
  (typeof STREET_CORRIDOR_ALLOWED_WIDTHS_METERS)[number];

export type StreetCorridorPolygonGeometry =
  | {
      type: "Polygon";
      coordinates: Array<Array<[number, number]>>;
    }
  | {
      type: "MultiPolygon";
      coordinates: Array<Array<Array<[number, number]>>>;
    };

export type StreetCorridorResult = {
  widthMeters: StreetCorridorWidthMeters;
  sourceGeometry: IncidenceStreetMultiLineStringGeometry;
  corridorGeometry: StreetCorridorPolygonGeometry;
  method: "POSTGIS_GEOGRAPHY_BUFFER";
};

type QueryResultLike = {
  rows: Array<Record<string, unknown>>;
};

type StreetCorridorDependencies = {
  query?: (text: string, values: unknown[]) => Promise<QueryResultLike>;
};

export function normalizeStreetCorridorWidth(
  value: number | null | undefined
): StreetCorridorWidthMeters {
  const width = Number(value ?? 30);

  if (
    !STREET_CORRIDOR_ALLOWED_WIDTHS_METERS.includes(
      width as StreetCorridorWidthMeters
    )
  ) {
    throw new Error(
      `STREET_CORRIDOR_WIDTH_UNSUPPORTED: ${width}`
    );
  }

  return width as StreetCorridorWidthMeters;
}

export function buildStreetCorridorSql(): string {
  return `
    WITH street AS (
      SELECT
        ST_SetSRID(
          ST_GeomFromGeoJSON($1),
          4326
        ) AS geom
    ),
    buffered AS (
      SELECT
        ST_Buffer(
          geom::geography,
          $2
        )::geometry AS geom
      FROM street
    ),
    normalized AS (
      SELECT
        ST_CollectionExtract(
          ST_MakeValid(geom),
          3
        ) AS geom
      FROM buffered
    )
    SELECT
      ST_AsGeoJSON(
        ST_CollectionExtract(
          ST_UnaryUnion(geom),
          3
        )
      ) AS geojson
    FROM normalized
    WHERE NOT ST_IsEmpty(geom)
  `;
}

function isValidPolygonCoordinates(
  value: unknown
): value is Array<Array<[number, number]>> {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  return value.every(
    (ring) =>
      Array.isArray(ring) &&
      ring.length >= 4 &&
      ring.every(
        (position) =>
          Array.isArray(position) &&
          position.length >= 2 &&
          Number.isFinite(Number(position[0])) &&
          Number.isFinite(Number(position[1]))
      )
  );
}

function isValidMultiPolygonCoordinates(
  value: unknown
): value is Array<Array<Array<[number, number]>>> {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  return value.every(
    (polygon) =>
      Array.isArray(polygon) &&
      polygon.length > 0 &&
      isValidPolygonCoordinates(polygon)
  );
}


export async function buildStreetAnalyticalCorridor(
  input: {
    geometry: IncidenceStreetMultiLineStringGeometry;
    widthMeters?: number | null;
  },
  dependencies: StreetCorridorDependencies = {}
): Promise<StreetCorridorResult> {
  if (
    !input.geometry ||
    input.geometry.type !== "MultiLineString" ||
    !Array.isArray(input.geometry.coordinates) ||
    input.geometry.coordinates.length === 0
  ) {
    throw new Error("STREET_CORRIDOR_INVALID_SOURCE_GEOMETRY");
  }

  const widthMeters = normalizeStreetCorridorWidth(
    input.widthMeters
  );

  const query =
    dependencies.query ??
    (async (text: string, values: unknown[]) =>
      getPool().query(text, values));

  const result = await query(
    buildStreetCorridorSql(),
    [
      JSON.stringify(input.geometry),
      widthMeters,
    ]
  );

  const rawGeojson = result.rows[0]?.geojson;

  if (typeof rawGeojson !== "string") {
    throw new Error("STREET_CORRIDOR_NOT_GENERATED");
  }
  const parsed = JSON.parse(rawGeojson) as {
    type?: unknown;
    coordinates?: unknown;
  };

  if (
    parsed.type === "Polygon" &&
    isValidPolygonCoordinates(parsed.coordinates)
  ) {
    return {
      widthMeters,
      sourceGeometry: input.geometry,
      corridorGeometry: {
        type: "Polygon",
        coordinates: parsed.coordinates,
      },
      method: "POSTGIS_GEOGRAPHY_BUFFER",
    };
  }

  if (
    parsed.type === "MultiPolygon" &&
    isValidMultiPolygonCoordinates(parsed.coordinates)
  ) {
    return {
      widthMeters,
      sourceGeometry: input.geometry,
      corridorGeometry: {
        type: "MultiPolygon",
        coordinates: parsed.coordinates,
      },
      method: "POSTGIS_GEOGRAPHY_BUFFER",
    };
  }

  throw new Error("STREET_CORRIDOR_NON_POLYGON_RESULT");
}



