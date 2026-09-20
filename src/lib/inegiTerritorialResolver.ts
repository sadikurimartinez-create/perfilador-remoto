import type { Pool } from "pg";
import { getPool } from "@/lib/db";
import type { EpistemicIntegrityMetadata } from "@/types/epistemicIntegrity";

export const INEGI_TERRITORIAL_SOURCE_ID = "INEGI_CPV2020_LOCAL_POSTGIS";
export const INEGI_TERRITORIAL_PROVIDER_ID = "INEGI";
export const INEGI_TERRITORIAL_PRODUCT =
  "Marco Geoestadistico y Principales resultados por AGEB y manzana urbana, Censo 2020";

export type InegiTerritorialStatus = "OBSERVED" | "NO_DATA" | "NOT_CONFIGURED" | "FAILED";
export type InegiGeographicLevel = "ESTADO" | "MUNICIPIO" | "LOCALIDAD" | "AGEB" | "MANZANA";

export interface InegiTerritorialReadiness {
  ready: boolean;
  status: "READY" | "NOT_CONFIGURED" | "FAILED";
  datasetId?: string;
  reason?: string;
}

export interface InegiTerritorialResult {
  status: InegiTerritorialStatus;
  exito: boolean;
  error?: string;
  coordenadas: string;
  geographicLevel?: InegiGeographicLevel;
  geography?: {
    estado?: { code: string; name?: string };
    municipio?: { code: string; name?: string };
    localidad?: { code: string; name?: string };
    ageb?: { code: string };
    manzana?: { code: string };
  };
  geometry?: GeoJSON.Geometry;
  demographics?: {
    geographicLevel: "AGEB" | "MANZANA";
    populationTotal: number | null;
    housingTotal: number | null;
    inhabitedPrivateHousing: number | null;
    uninhabitedPrivateHousing: number | null;
    marginacion: null;
    marginacionNote: string;
  };
  provenance?: {
    datasetId: string;
    productName: string;
    referenceYear: number;
    version: string;
    importedAt: string;
    completedAt: string;
    geographySourceUrl: string;
    geographySha256: string;
    censusSourceUrl: string;
    censusSha256: string;
    sourceRowKey?: string;
    queryCoordinates: { lat: number; lng: number };
    geographicLevel: InegiGeographicLevel;
    demographicGeographicLevel?: "AGEB" | "MANZANA";
  };
  poblacionTotal?: string;
  viviendasTotales?: string;
  viviendasHabitadas?: string;
  viviendasDeshabitadas?: string;
  gradoMarginacion?: string;
  epistemicIntegrity: EpistemicIntegrityMetadata;
}

type Queryable = Pick<Pool, "query">;

interface DatasetRow {
  dataset_id: string;
  product_name: string;
  reference_year: number;
  version: string;
  imported_at: Date | string;
  completed_at: Date | string;
  geography_source_url: string;
  geography_sha256: string;
  census_source_url: string;
  census_sha256: string;
  geography_feature_count: number;
  demographic_record_count: number;
}

interface GeographyRow {
  geographic_level: InegiGeographicLevel;
  cve_ent: string;
  cve_mun: string | null;
  cve_loc: string | null;
  cve_ageb: string | null;
  cve_mza: string | null;
  geographic_name: string | null;
  geometry: string;
}

interface DemographicsRow {
  geographic_level: "AGEB" | "MANZANA";
  pobtot: number | null;
  vivtot: number | null;
  vivpar_hab: number | null;
  vivpar_deshab: number | null;
  source_row_key: string;
}

function configuredPool(injected?: Queryable): Queryable | null {
  if (injected) return injected;
  if (!process.env.DATABASE_URL?.trim()) return null;
  return getPool();
}

function validCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function configurationError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || "");
  const message = String((error as Error)?.message || error);
  return code === "42P01" || code === "42704" || code === "42883" || /postgis|inegi_territorial_/i.test(message);
}

async function latestReadyDataset(db: Queryable): Promise<DatasetRow | null> {
  const result = await db.query<DatasetRow>(`
    SELECT dataset_id, product_name, reference_year, version, imported_at, completed_at,
           geography_source_url, geography_sha256, census_source_url, census_sha256,
           geography_feature_count, demographic_record_count
      FROM public.inegi_territorial_dataset
     WHERE state_code = '01'
       AND status = 'READY'
       AND geography_feature_count > 0
       AND demographic_record_count > 0
       AND completed_at IS NOT NULL
       AND geography_sha256 ~ '^[0-9a-f]{64}$'
       AND census_sha256 ~ '^[0-9a-f]{64}$'
       AND geography_source_url LIKE 'https://www.inegi.org.mx/%'
       AND census_source_url LIKE 'https://www.inegi.org.mx/%'
       AND EXISTS (
         SELECT 1 FROM public.inegi_territorial_geography g
          WHERE g.dataset_id = inegi_territorial_dataset.dataset_id AND g.geographic_level = 'AGEB'
       )
       AND EXISTS (
         SELECT 1 FROM public.inegi_territorial_geography g
          WHERE g.dataset_id = inegi_territorial_dataset.dataset_id AND g.geographic_level = 'MANZANA'
       )
       AND EXISTS (
         SELECT 1 FROM public.inegi_territorial_demographics d
          WHERE d.dataset_id = inegi_territorial_dataset.dataset_id AND d.geographic_level = 'AGEB'
       )
       AND EXISTS (
         SELECT 1 FROM public.inegi_territorial_demographics d
          WHERE d.dataset_id = inegi_territorial_dataset.dataset_id AND d.geographic_level = 'MANZANA'
       )
     ORDER BY imported_at DESC
     LIMIT 1
  `);
  return result.rows[0] ?? null;
}

export async function inspectInegiTerritorialReadiness(
  injected?: Queryable
): Promise<InegiTerritorialReadiness> {
  const db = configuredPool(injected);
  if (!db) return { ready: false, status: "NOT_CONFIGURED", reason: "DATABASE_URL no configurada." };

  try {
    const extension = await db.query<{ available: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS available"
    );
    if (!extension.rows[0]?.available) {
      return { ready: false, status: "NOT_CONFIGURED", reason: "PostGIS no esta instalado." };
    }
    const dataset = await latestReadyDataset(db);
    return dataset
      ? { ready: true, status: "READY", datasetId: dataset.dataset_id }
      : { ready: false, status: "NOT_CONFIGURED", reason: "No hay un dataset INEGI territorial READY con lineage completo." };
  } catch (error) {
    return {
      ready: false,
      status: configurationError(error) ? "NOT_CONFIGURED" : "FAILED",
      reason: configurationError(error) ? "Esquema territorial INEGI no disponible." : "No fue posible verificar el dataset territorial.",
    };
  }
}

function integrity(params: {
  status: InegiTerritorialStatus;
  query: string;
  dataset?: DatasetRow;
  resultCount: number;
  acquiredAt: string;
}): EpistemicIntegrityMetadata {
  const dataset = params.dataset;
  const sourceReference = dataset
    ? `dataset:${dataset.dataset_id};year:${dataset.reference_year};version:${dataset.version}`
    : "local-postgis:inegi-territorial";
  return {
    sourceId: INEGI_TERRITORIAL_SOURCE_ID,
    providerId: INEGI_TERRITORIAL_PROVIDER_ID,
    providerName: "Instituto Nacional de Estadistica y Geografia (INEGI)",
    sourceType: "INEGI_TERRITORIAL_CPV2020",
    acquisitionMode: "OBSERVED",
    acquisitionStatus: params.status === "OBSERVED" ? "ACQUIRED" : params.status,
    semanticRole: "OBSERVATION",
    validationStatus: "UNREVIEWED",
    isSimulated: false,
    isDerived: false,
    isConnectivityOnly: false,
    observedAt: null,
    acquiredAt: params.acquiredAt,
    generatedAt: null,
    sourceReference,
    sourceUrl: dataset?.census_source_url ?? null,
    rawSourceReference: dataset
      ? `inegi:${dataset.dataset_id}:geo-sha256:${dataset.geography_sha256}:census-sha256:${dataset.census_sha256}`
      : "local-postgis:inegi-territorial",
    query: params.query,
    resultCount: params.resultCount,
    geolocationSource: "INPUT_COORDINATES_UNVERIFIED",
    traceabilityId: dataset ? `${dataset.dataset_id}:${params.query}` : null,
    lineage: dataset
      ? [
          {
            sourceId: `${INEGI_TERRITORIAL_SOURCE_ID}:GEOGRAPHY`,
            providerId: INEGI_TERRITORIAL_PROVIDER_ID,
            providerName: "INEGI",
            sourceType: "MARCO_GEOESTADISTICO_2020",
            sourceReference: dataset.geography_sha256,
            sourceUrl: dataset.geography_source_url,
            rawSourceReference: `sha256:${dataset.geography_sha256}`,
            acquisitionMode: "OBSERVED",
          },
          {
            sourceId: `${INEGI_TERRITORIAL_SOURCE_ID}:CENSUS`,
            providerId: INEGI_TERRITORIAL_PROVIDER_ID,
            providerName: "INEGI",
            sourceType: "CPV2020_AGEB_MANZANA",
            sourceReference: dataset.census_sha256,
            sourceUrl: dataset.census_source_url,
            rawSourceReference: `sha256:${dataset.census_sha256}`,
            acquisitionMode: "OBSERVED",
          },
        ]
      : [],
  };
}

function unavailableResult(
  status: Exclude<InegiTerritorialStatus, "OBSERVED">,
  lat: number,
  lng: number,
  message: string,
  acquiredAt: string,
  dataset?: DatasetRow
): InegiTerritorialResult {
  const query = `${lat},${lng}`;
  return {
    status,
    exito: false,
    error: message,
    coordenadas: query,
    epistemicIntegrity: integrity({ status, query, dataset, resultCount: 0, acquiredAt }),
  };
}

export async function resolveInegiTerritory(
  lat: number,
  lng: number,
  injected?: Queryable
): Promise<InegiTerritorialResult> {
  const acquiredAt = new Date().toISOString();
  if (!validCoordinate(lat, lng)) {
    return unavailableResult("FAILED", lat, lng, "Coordenadas fuera de rango o no numericas.", acquiredAt);
  }

  const db = configuredPool(injected);
  if (!db) {
    return unavailableResult("NOT_CONFIGURED", lat, lng, "Dataset territorial INEGI no configurado.", acquiredAt);
  }

  let dataset: DatasetRow | null = null;
  try {
    dataset = await latestReadyDataset(db);
    if (!dataset) {
      return unavailableResult(
        "NOT_CONFIGURED",
        lat,
        lng,
        "No hay un dataset oficial INEGI importado y listo.",
        acquiredAt
      );
    }

    const geographyResult = await db.query<GeographyRow>(`
      WITH point AS (
        SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326) AS geom
      )
      SELECT geographic_level, cve_ent, cve_mun, cve_loc, cve_ageb, cve_mza,
             geographic_name, ST_AsGeoJSON(g.geom) AS geometry
        FROM public.inegi_territorial_geography g, point p
       WHERE g.dataset_id = $3
         AND ST_Covers(g.geom, p.geom)
       ORDER BY CASE geographic_level
                  WHEN 'MANZANA' THEN 1 WHEN 'AGEB' THEN 2 WHEN 'LOCALIDAD' THEN 3
                  WHEN 'MUNICIPIO' THEN 4 WHEN 'ESTADO' THEN 5 ELSE 6
                END,
                ST_Area(g.geom::geography) ASC
    `, [lat, lng, dataset.dataset_id]);

    if (geographyResult.rows.length === 0) {
      return unavailableResult(
        "NO_DATA",
        lat,
        lng,
        "La coordenada no intersecta la cobertura oficial importada.",
        acquiredAt,
        dataset
      );
    }

    const byLevel = new Map<InegiGeographicLevel, GeographyRow>();
    for (const row of geographyResult.rows) {
      if (!byLevel.has(row.geographic_level)) byLevel.set(row.geographic_level, row);
    }
    const deepest = geographyResult.rows[0];
    const block = byLevel.get("MANZANA");
    const ageb = byLevel.get("AGEB");
    const demographicKey = block ?? ageb;
    let demographic: DemographicsRow | undefined;

    if (demographicKey?.cve_mun && demographicKey.cve_loc && demographicKey.cve_ageb) {
      const demographicResult = await db.query<DemographicsRow>(`
        SELECT geographic_level, pobtot, vivtot, vivpar_hab, vivpar_deshab, source_row_key
          FROM public.inegi_territorial_demographics
         WHERE dataset_id = $1
           AND cve_ent = $2 AND cve_mun = $3 AND cve_loc = $4 AND cve_ageb = $5
           AND (
             (geographic_level = 'MANZANA' AND cve_mza = $6)
             OR geographic_level = 'AGEB'
           )
         ORDER BY CASE geographic_level WHEN 'MANZANA' THEN 1 ELSE 2 END
         LIMIT 1
      `, [
        dataset.dataset_id,
        demographicKey.cve_ent,
        demographicKey.cve_mun,
        demographicKey.cve_loc,
        demographicKey.cve_ageb,
        block?.cve_mza ?? null,
      ]);
      demographic = demographicResult.rows[0];
    }

    const state = byLevel.get("ESTADO");
    const municipality = byLevel.get("MUNICIPIO");
    const locality = byLevel.get("LOCALIDAD");
    const query = `${lat},${lng}`;
    const demographics = demographic
      ? {
          geographicLevel: demographic.geographic_level,
          populationTotal: demographic.pobtot,
          housingTotal: demographic.vivtot,
          inhabitedPrivateHousing: demographic.vivpar_hab,
          uninhabitedPrivateHousing: demographic.vivpar_deshab,
          marginacion: null,
          marginacionNote: "No disponible: marginacion no forma parte de los productos INEGI importados.",
        }
      : undefined;

    return {
      status: "OBSERVED",
      exito: true,
      coordenadas: query,
      geographicLevel: deepest.geographic_level,
      geography: {
        estado: { code: deepest.cve_ent, ...(state?.geographic_name ? { name: state.geographic_name } : {}) },
        ...(municipality?.cve_mun ? { municipio: { code: municipality.cve_mun, ...(municipality.geographic_name ? { name: municipality.geographic_name } : {}) } } : {}),
        ...(locality?.cve_loc ? { localidad: { code: locality.cve_loc, ...(locality.geographic_name ? { name: locality.geographic_name } : {}) } } : {}),
        ...(ageb?.cve_ageb ? { ageb: { code: ageb.cve_ageb } } : {}),
        ...(block?.cve_mza ? { manzana: { code: block.cve_mza } } : {}),
      },
      geometry: JSON.parse(deepest.geometry) as GeoJSON.Geometry,
      ...(demographics ? { demographics } : {}),
      provenance: {
        datasetId: dataset.dataset_id,
        productName: dataset.product_name,
        referenceYear: dataset.reference_year,
        version: dataset.version,
        importedAt: new Date(dataset.imported_at).toISOString(),
        completedAt: new Date(dataset.completed_at).toISOString(),
        geographySourceUrl: dataset.geography_source_url,
        geographySha256: dataset.geography_sha256,
        censusSourceUrl: dataset.census_source_url,
        censusSha256: dataset.census_sha256,
        ...(demographic?.source_row_key ? { sourceRowKey: demographic.source_row_key } : {}),
        queryCoordinates: { lat, lng },
        geographicLevel: deepest.geographic_level,
        ...(demographic ? { demographicGeographicLevel: demographic.geographic_level } : {}),
      },
      poblacionTotal: demographic?.pobtot == null ? "No disponible" : String(demographic.pobtot),
      viviendasTotales: demographic?.vivtot == null ? "No disponible" : String(demographic.vivtot),
      viviendasHabitadas: demographic?.vivpar_hab == null ? "No disponible" : String(demographic.vivpar_hab),
      viviendasDeshabitadas: demographic?.vivpar_deshab == null ? "No disponible" : String(demographic.vivpar_deshab),
      gradoMarginacion: "No disponible",
      epistemicIntegrity: integrity({ status: "OBSERVED", query, dataset, resultCount: 1, acquiredAt }),
    };
  } catch (error) {
    const isConfiguration = configurationError(error);
    return unavailableResult(
      isConfiguration ? "NOT_CONFIGURED" : "FAILED",
      lat,
      lng,
      isConfiguration
        ? "PostGIS o el esquema territorial INEGI no estan disponibles."
        : "Fallo la consulta territorial al dataset oficial INEGI.",
      acquiredAt,
      dataset ?? undefined
    );
  }
}
