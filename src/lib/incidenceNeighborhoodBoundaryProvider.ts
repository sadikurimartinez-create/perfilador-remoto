import { getPool } from "@/lib/db";
import type { CrimeIncidenceResolvedGeometry } from "./incidenceComparisonTypes";

export type IncidenceNeighborhoodBoundaryLookupInput = {
  neighborhood: string;
  municipality?: string | null;
  municipalityCode?: string | null;
};

export type IncidenceNeighborhoodBoundaryMatch = {
  gid: number;
  cvegeo: string;
  cveMun: string;
  nomAsen: string;
  tipo: string | null;
  geometry: Extract<CrimeIncidenceResolvedGeometry, { type: "Polygon" }>;
};

export type IncidenceNeighborhoodBoundaryAmbiguousMatch = Omit<
  IncidenceNeighborhoodBoundaryMatch,
  "geometry"
>;

export type IncidenceNeighborhoodBoundaryLookupResult =
  | {
      status: "RESOLVED";
      match: IncidenceNeighborhoodBoundaryMatch;
    }
  | {
      status: "NOT_FOUND";
      matches: [];
    }
  | {
      status: "AMBIGUOUS";
      matches: IncidenceNeighborhoodBoundaryAmbiguousMatch[];
    };

export type IncidenceNeighborhoodBoundaryProvider = {
  resolveNeighborhoodBoundary(
    input: IncidenceNeighborhoodBoundaryLookupInput
  ): Promise<IncidenceNeighborhoodBoundaryLookupResult>;
};

const DCAH_TEXT_TRANSLATION_FROM = "ÁÉÍÓÚÜÑáéíóúüñ";
const DCAH_TEXT_TRANSLATION_TO = "AEIOUUNaeiouun";

const SUPPORTED_DCAH_MUNICIPALITY_CODES: Record<string, string> = {
  AGUASCALIENTES: "001",
};

export function normalizeDcahLookupText(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function resolveSupportedDcahMunicipalityCode(
  municipality?: string | null
): string | null | undefined {
  if (!municipality?.trim()) {
    return null;
  }

  return SUPPORTED_DCAH_MUNICIPALITY_CODES[normalizeDcahLookupText(municipality)];
}

export function buildDcahNeighborhoodBoundaryQuery(input: {
  normalizedNeighborhood: string;
  municipalityCode?: string | null;
}): { text: string; values: unknown[] } {
  const values: unknown[] = [input.normalizedNeighborhood];
  const municipalityFilter = input.municipalityCode
    ? "AND cve_mun = $2"
    : "";

  if (input.municipalityCode) {
    values.push(input.municipalityCode);
  }

  return {
    text: `
      SELECT
        gid,
        cvegeo,
        cve_mun,
        nom_asen,
        tipo,
        ST_AsGeoJSON(ST_GeometryN(geom_operativa, 1)) AS geometry_geojson
      FROM public.dcah_asentamientos_2025_ags
      WHERE UPPER(regexp_replace(translate(nom_asen, '${DCAH_TEXT_TRANSLATION_FROM}', '${DCAH_TEXT_TRANSLATION_TO}'), '\\s+', ' ', 'g')) = $1
      ${municipalityFilter}
      ORDER BY cve_mun ASC, nom_asen ASC, cvegeo ASC, gid ASC
      LIMIT 25
    `,
    values,
  };
}

function parsePolygonGeometry(value: unknown): Extract<CrimeIncidenceResolvedGeometry, { type: "Polygon" }> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || parsed.type !== "Polygon" || !Array.isArray(parsed.coordinates)) {
    throw new Error("DCAH_NEIGHBORHOOD_INVALID_GEOMETRY");
  }

  return {
    type: "Polygon",
    coordinates: parsed.coordinates,
  };
}

export class PostgisDcahNeighborhoodBoundaryProvider
  implements IncidenceNeighborhoodBoundaryProvider
{
  async resolveNeighborhoodBoundary(
    input: IncidenceNeighborhoodBoundaryLookupInput
  ): Promise<IncidenceNeighborhoodBoundaryLookupResult> {
    const normalizedNeighborhood = normalizeDcahLookupText(input.neighborhood);
    const query = buildDcahNeighborhoodBoundaryQuery({
      normalizedNeighborhood,
      municipalityCode: input.municipalityCode,
    });
    const result = await getPool().query(query.text, query.values);

    if (result.rows.length === 0) {
      return {
        status: "NOT_FOUND",
        matches: [],
      };
    }

    if (result.rows.length > 1) {
      return {
        status: "AMBIGUOUS",
        matches: result.rows.map((row) => ({
          gid: Number(row.gid),
          cvegeo: String(row.cvegeo),
          cveMun: String(row.cve_mun),
          nomAsen: String(row.nom_asen),
          tipo: row.tipo ?? null,
        })),
      };
    }

    const row = result.rows[0];
    return {
      status: "RESOLVED",
      match: {
        gid: Number(row.gid),
        cvegeo: String(row.cvegeo),
        cveMun: String(row.cve_mun),
        nomAsen: String(row.nom_asen),
        tipo: row.tipo ?? null,
        geometry: parsePolygonGeometry(row.geometry_geojson),
      },
    };
  }
}
