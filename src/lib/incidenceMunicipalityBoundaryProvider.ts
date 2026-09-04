import type { CrimeIncidenceResolvedGeometry } from "./incidenceComparisonTypes";

export type IncidenceMunicipalityBoundaryLookupInput = {
  municipality: string;
};

export type IncidenceMunicipalityBoundaryMatch = {
  cvegeo: string;
  cveEnt: string;
  cveMun: string;
  nomgeo: string;
  geometry: Extract<CrimeIncidenceResolvedGeometry, { type: "Polygon" }>;
  endpoint: string;
};

export type IncidenceMunicipalityBoundaryLookupResult =
  | {
      status: "RESOLVED";
      match: IncidenceMunicipalityBoundaryMatch;
    }
  | {
      status: "NOT_FOUND";
      limitations: string[];
    }
  | {
      status: "PARTIAL";
      limitations: string[];
    };

export type IncidenceMunicipalityBoundaryProvider = {
  resolveMunicipalityBoundary(
    input: IncidenceMunicipalityBoundaryLookupInput
  ): Promise<IncidenceMunicipalityBoundaryLookupResult>;
};

const INEGI_GAIA_MGEM_BASE_URL = "https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/01";

const AGUASCALIENTES_MUNICIPALITY_CODES: Record<string, string> = {
  AGUASCALIENTES: "001",
  ASIENTOS: "002",
  CALVILLO: "003",
  COSIO: "004",
  "JESUS MARIA": "005",
  "PABELLON DE ARTEAGA": "006",
  "RINCON DE ROMOS": "007",
  "SAN JOSE DE GRACIA": "008",
  TEPEZALA: "009",
  "EL LLANO": "010",
  "SAN FRANCISCO DE LOS ROMO": "011",
};

export function normalizeInegiGaiaMunicipalityName(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function resolveInegiGaiaAguascalientesMunicipalityCode(
  municipality: string
): string | undefined {
  return AGUASCALIENTES_MUNICIPALITY_CODES[
    normalizeInegiGaiaMunicipalityName(municipality)
  ];
}

export function buildInegiGaiaMgemMunicipalityUrl(cveMun: string): string {
  return `${INEGI_GAIA_MGEM_BASE_URL}/${cveMun}`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function convertInegiGaiaMgemFeatureCollectionToMunicipalityBoundary(
  value: unknown,
  endpoint: string
): IncidenceMunicipalityBoundaryLookupResult {
  const collection = asObject(value);
  const features = Array.isArray(collection?.features) ? collection.features : [];

  if (collection?.type !== "FeatureCollection" || features.length !== 1) {
    return {
      status: "PARTIAL",
      limitations: ["INEGI GAIA no devolvio un FeatureCollection con exactamente 1 feature."],
    };
  }

  const feature = asObject(features[0]);
  const properties = asObject(feature?.properties);
  const geometry = asObject(feature?.geometry);

  if (geometry?.type !== "MultiPolygon" || !Array.isArray(geometry.coordinates)) {
    return {
      status: "PARTIAL",
      limitations: ["INEGI GAIA devolvio una geometria distinta de MultiPolygon."],
    };
  }

  if (geometry.coordinates.length !== 1) {
    return {
      status: "PARTIAL",
      limitations: [
        "INEGI GAIA devolvio un MultiPolygon multipartes; no se toma la primera parte arbitrariamente.",
      ],
    };
  }

  return {
    status: "RESOLVED",
    match: {
      cvegeo: String(properties?.cvegeo ?? ""),
      cveEnt: String(properties?.cve_ent ?? ""),
      cveMun: String(properties?.cve_mun ?? ""),
      nomgeo: String(properties?.nomgeo ?? ""),
      endpoint,
      geometry: {
        type: "Polygon",
        coordinates: geometry.coordinates[0],
      },
    },
  };
}

export class InegiGaiaMunicipalityBoundaryProvider
  implements IncidenceMunicipalityBoundaryProvider
{
  async resolveMunicipalityBoundary(
    input: IncidenceMunicipalityBoundaryLookupInput
  ): Promise<IncidenceMunicipalityBoundaryLookupResult> {
    const cveMun = resolveInegiGaiaAguascalientesMunicipalityCode(input.municipality);

    if (!cveMun) {
      return {
        status: "NOT_FOUND",
        limitations: [
          "El municipio solicitado no pertenece al catalogo controlado de Aguascalientes para INEGI GAIA.",
        ],
      };
    }

    const endpoint = buildInegiGaiaMgemMunicipalityUrl(cveMun);
    const response = await fetch(endpoint);

    if (!response.ok) {
      return {
        status: "PARTIAL",
        limitations: [`INEGI GAIA respondio HTTP ${response.status}.`],
      };
    }

    return convertInegiGaiaMgemFeatureCollectionToMunicipalityBoundary(
      await response.json(),
      endpoint
    );
  }
}
