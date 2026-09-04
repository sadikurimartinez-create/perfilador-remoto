import { getPool } from "@/lib/db";
import { resolveInegiGaiaAguascalientesMunicipalityCode } from "./incidenceMunicipalityBoundaryProvider";

export type IncidenceStreetMultiLineStringGeometry = {
  type: "MultiLineString";
  coordinates: Array<Array<[number, number]>>;
};

export type IncidenceStreetNeighborhoodReference = {
  cvegeo: string;
  cveMun: string;
  nomAsen: string;
  tipo: string | null;
  metersInside: number;
};

export type IncidenceStreetCandidate = {
  candidateId: string;
  cveMun: string;
  cveLoc: string;
  cvevial: string;
  nomvial: string;
  tipos: string[];
  sentidos: string[];
  geometry: IncidenceStreetMultiLineStringGeometry;
  neighborhoods: IncidenceStreetNeighborhoodReference[];
};

export type IncidenceStreetCandidateLookupInput = {
  street: string;
  municipality?: string | null;
};

export type IncidenceStreetCandidateLookupResult =
  | {
      status: "RESOLVED";
      candidate: IncidenceStreetCandidate;
    }
  | {
      status: "AMBIGUOUS";
      candidates: IncidenceStreetCandidate[];
    }
  | {
      status: "NOT_FOUND";
      candidates: [];
    }
  | {
      status: "UNSUPPORTED";
      candidates: [];
      limitations: string[];
    };

export type IncidenceStreetCandidateProvider = {
  resolveStreetCandidates(
    input: IncidenceStreetCandidateLookupInput
  ): Promise<IncidenceStreetCandidateLookupResult>;
};

type QueryResultLike = {
  rows: Array<Record<string, unknown>>;
};

type StreetProviderDependencies = {
  fetchJson?: (url: string) => Promise<unknown>;
  query?: (text: string, values: unknown[]) => Promise<QueryResultLike>;
};

export function normalizeStreetLookupText(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function buildInegiGaiaStreetUrl(cveMun: string): string {
  return `https://gaia.inegi.org.mx/wscatgeo/v2/geo/vialidades/01/${cveMun}`;
}

export function buildStreetCandidateId(input: {
  cveMun: string;
  cveLoc: string;
  cvevial: string;
}): string {
  return `${input.cveMun}:${input.cveLoc}:${input.cvevial}`;
}

function asObject(value: unknown): Record<string, any> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, any>)
    : null;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

export function buildDcahStreetIntersectionQuery(): string {
  return `
    WITH street AS (
      SELECT
        ST_SetSRID(
          ST_GeomFromGeoJSON($1),
          4326
        ) AS geom
    ),
    intersections AS (
      SELECT
        d.cvegeo,
        d.cve_mun,
        d.nom_asen,
        d.tipo,
        ST_Intersection(
          d.geom_operativa,
          street.geom
        ) AS intersection_geom
      FROM public.dcah_asentamientos_2025_ags d
      CROSS JOIN street
      WHERE d.cve_mun = $2
        AND ST_Intersects(
          d.geom_operativa,
          street.geom
        )
    )
    SELECT
      cvegeo,
      cve_mun,
      nom_asen,
      tipo,
      ST_Length(intersection_geom::geography) AS meters_inside
    FROM intersections
    WHERE ST_Length(intersection_geom::geography) > 0.01
    ORDER BY meters_inside DESC, nom_asen ASC, cvegeo ASC
  `;
}

export class InegiGaiaStreetCandidateProvider
  implements IncidenceStreetCandidateProvider
{
  private readonly fetchJson: (url: string) => Promise<unknown>;
  private readonly query: (
    text: string,
    values: unknown[]
  ) => Promise<QueryResultLike>;

  constructor(dependencies: StreetProviderDependencies = {}) {
    this.fetchJson =
      dependencies.fetchJson ??
      (async (url: string) => {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`INEGI_GAIA_STREET_HTTP_${response.status}`);
        }

        return response.json();
      });

    this.query =
      dependencies.query ??
      (async (text: string, values: unknown[]) => {
        return getPool().query(text, values);
      });
  }

  async resolveStreetCandidates(
    input: IncidenceStreetCandidateLookupInput
  ): Promise<IncidenceStreetCandidateLookupResult> {
    const municipality =
      input.municipality?.trim() || "Aguascalientes";

    const cveMun =
      resolveInegiGaiaAguascalientesMunicipalityCode(
        municipality
      );

    if (!cveMun) {
      return {
        status: "UNSUPPORTED",
        candidates: [],
        limitations: [
          "El municipio solicitado no pertenece al catálogo controlado de Aguascalientes para INEGI GAIA.",
        ],
      };
    }

    const normalizedStreet =
      normalizeStreetLookupText(input.street);

    if (!normalizedStreet) {
      return {
        status: "NOT_FOUND",
        candidates: [],
      };
    }

    const payload = await this.fetchJson(
      buildInegiGaiaStreetUrl(cveMun)
    );

    const collection = asObject(payload);

    const features = Array.isArray(collection?.features)
      ? collection.features
      : [];

    const exactMatches = features.filter((rawFeature) => {
      const feature = asObject(rawFeature);
      const properties = asObject(feature?.properties);

      return (
        typeof properties?.nomvial === "string" &&
        normalizeStreetLookupText(properties.nomvial) ===
          normalizedStreet
      );
    });

    if (exactMatches.length === 0) {
      return {
        status: "NOT_FOUND",
        candidates: [],
      };
    }

    const grouped =
      new Map<string, Array<Record<string, any>>>();

    for (const rawFeature of exactMatches) {
      const feature = asObject(rawFeature);

      if (!feature) continue;

      const properties = asObject(feature.properties);

      const cvevial =
        typeof properties?.cvevial === "string"
          ? properties.cvevial.trim()
          : "";

      const cveLoc =
        typeof properties?.cve_loc === "string"
          ? properties.cve_loc.trim()
          : "";

      if (!cvevial || !cveLoc) continue;

      const candidateId = buildStreetCandidateId({
        cveMun,
        cveLoc,
        cvevial,
      });

      const current = grouped.get(candidateId) ?? [];
      current.push(feature);
      grouped.set(candidateId, current);
    }

    const candidates: IncidenceStreetCandidate[] = [];

    for (const [candidateId, candidateFeatures] of grouped) {
      const firstProperties = asObject(
        candidateFeatures[0]?.properties
      );

      const cvevial =
        typeof firstProperties?.cvevial === "string"
          ? firstProperties.cvevial.trim()
          : "";

      const cveLoc =
        typeof firstProperties?.cve_loc === "string"
          ? firstProperties.cve_loc.trim()
          : "";

      if (!cvevial || !cveLoc) continue;

      const lineStrings: Array<Array<[number, number]>> = [];
      const tipos: string[] = [];
      const sentidos: string[] = [];

      let nominalName = input.street.trim();

      for (const feature of candidateFeatures) {
        const properties = asObject(feature.properties);
        const geometry = asObject(feature.geometry);

        if (typeof properties?.nomvial === "string") {
          nominalName = properties.nomvial;
        }

        if (typeof properties?.tipovial === "string") {
          tipos.push(properties.tipovial);
        }

        if (typeof properties?.sentido === "string") {
          sentidos.push(properties.sentido);
        }

        if (
          geometry?.type !== "MultiLineString" ||
          !Array.isArray(geometry.coordinates)
        ) {
          continue;
        }

        for (const rawPart of geometry.coordinates) {
          if (!Array.isArray(rawPart)) continue;

          const part: Array<[number, number]> = [];

          for (const rawPosition of rawPart) {
            if (
              Array.isArray(rawPosition) &&
              rawPosition.length >= 2 &&
              Number.isFinite(Number(rawPosition[0])) &&
              Number.isFinite(Number(rawPosition[1]))
            ) {
              part.push([
                Number(rawPosition[0]),
                Number(rawPosition[1]),
              ]);
            }
          }

          if (part.length >= 2) {
            lineStrings.push(part);
          }
        }
      }

      if (lineStrings.length === 0) continue;

      const geometry: IncidenceStreetMultiLineStringGeometry = {
        type: "MultiLineString",
        coordinates: lineStrings,
      };

      const dcahResult = await this.query(
        buildDcahStreetIntersectionQuery(),
        [JSON.stringify(geometry), cveMun]
      );

      const neighborhoods =
        dcahResult.rows
          .map((row) => ({
            cvegeo: String(row.cvegeo ?? ""),
            cveMun: String(row.cve_mun ?? ""),
            nomAsen: String(row.nom_asen ?? ""),
            tipo:
              row.tipo == null
                ? null
                : String(row.tipo),
            metersInside: Number(
              row.meters_inside ?? 0
            ),
          }))
          .filter(
            (item) =>
              item.cvegeo &&
              item.nomAsen &&
              Number.isFinite(item.metersInside) &&
              item.metersInside > 0.01
          );

      candidates.push({
        candidateId,
        cveMun,
        cveLoc,
        cvevial,
        nomvial: nominalName,
        tipos: uniqueSorted(tipos),
        sentidos: uniqueSorted(sentidos),
        geometry,
        neighborhoods,
      });
    }

    candidates.sort((a, b) =>
      a.candidateId.localeCompare(b.candidateId)
    );

    if (candidates.length === 0) {
      return {
        status: "NOT_FOUND",
        candidates: [],
      };
    }

    if (candidates.length === 1) {
      return {
        status: "RESOLVED",
        candidate: candidates[0],
      };
    }

    return {
      status: "AMBIGUOUS",
      candidates,
    };
  }
}