import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { getPool } from "@/lib/db";
import {
  buildCrimeQueryLineage,
  deduplicateCrimeRecords,
  determineAguascalientesCoverage,
  normalizeCrimeRecord,
  type CrimeCoverageStatus,
  type CrimeIncidenceQuerySource,
  type CrimeIncidenceSourceStatus,
} from "@/utils/crimeIncidenceCanonicalPipeline";
import type { CrimeDatasetIdentity } from "@/types/crimeDatasetIdentity";
import {
  buildCrimeIncidenceDatasetIdentity,
  readCrimeIncidenceDatasetProvenanceConfig,
} from "@/utils/crimeIncidenceDatasetProvenance";

export type CrimeQueryInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
  spatialFilter?:
    | {
        type: "RADIUS";
        lat: number;
        lng: number;
        radiusMeters?: number;
      }
    | {
        type: "POLYGON";
        coordinates: Array<[number, number]>;
      };
  allowLegacyFallback?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  incidentTypes?: string[];
  requestedCoverage?: CrimeCoverageStatus | null;
};

export type CrimeQueryResult = {
  success: boolean;
  querySource: CrimeIncidenceQuerySource;
  sourceStatus: CrimeIncidenceSourceStatus;
  coverageStatus: CrimeCoverageStatus;
  data: any[];
  bibliografia: string;
  lineage: ReturnType<typeof buildCrimeQueryLineage>;
  datasetIdentity?: CrimeDatasetIdentity;
  error?: string;
};

function configuredDatasetIdentity(result: CrimeQueryResult): CrimeDatasetIdentity {
  return buildCrimeIncidenceDatasetIdentity({
    config: readCrimeIncidenceDatasetProvenanceConfig(),
    datasetReference: result.lineage.dataset || null,
    querySource: result.querySource,
    sourceStatus: result.sourceStatus,
    coverageStatus: result.coverageStatus,
    recordCount: result.data.length,
    lineage: result.lineage,
  });
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function pickExistingDir(...candidates: string[]) {
  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
    } catch {
      // ignore unreadable candidates
    }
  }
  return null;
}

function isValidGeoJsonPosition(position: [number, number]): boolean {
  const [lng, lat] = position;
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function positionKey(position: [number, number]): string {
  return `${position[0]},${position[1]}`;
}

function samePosition(left: [number, number], right: [number, number]): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

export function buildPostgisCrimeIncidenceSpatialQuery(input: CrimeQueryInput): {
  selectDistanceSql: string;
  whereSpatialSql: string;
  spatialParams: unknown[];
  radiusMeters: number;
  centerLat: number;
  centerLng: number;
} {
  if (input.spatialFilter?.type === "POLYGON") {
    const coordinates = input.spatialFilter.coordinates;
    if (coordinates.some((position) => !isValidGeoJsonPosition(position))) {
      throw new Error("INVALID_POLYGON_COORDINATES");
    }

    const distinctCount = new Set(coordinates.map(positionKey)).size;
    if (distinctCount < 3) {
      throw new Error("INVALID_POLYGON_MINIMUM_DISTINCT_VERTICES");
    }

    const ring = samePosition(coordinates[0], coordinates[coordinates.length - 1])
      ? coordinates
      : [...coordinates, coordinates[0]];
    const polygonGeoJson = JSON.stringify({
      type: "Polygon",
      coordinates: [ring],
    });

    return {
      selectDistanceSql: "NULL::double precision AS distancia_m",
      whereSpatialSql: "ST_Intersects(i.geometria, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography)",
      spatialParams: [polygonGeoJson],
      radiusMeters: input.radiusMeters ?? 0,
      centerLat: input.lat,
      centerLng: input.lng,
    };
  }

  const radiusFilter = input.spatialFilter?.type === "RADIUS" ? input.spatialFilter : null;
  const centerLng = radiusFilter?.lng ?? input.lng;
  const centerLat = radiusFilter?.lat ?? input.lat;
  const radiusMeters = radiusFilter?.radiusMeters ?? input.radiusMeters ?? 1000;

  return {
    selectDistanceSql: `
          ST_Distance(
            i.geometria,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) AS distancia_m`,
    whereSpatialSql: `
          ST_DWithin(
            i.geometria,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
          )`,
    spatialParams: [centerLng, centerLat, radiusMeters],
    radiusMeters,
    centerLat,
    centerLng,
  };
}

function emptyResult(params: {
  lat: number;
  lng: number;
  radiusMeters: number;
  coverageStatus: CrimeCoverageStatus;
  querySource: CrimeIncidenceQuerySource;
  sourceStatus: CrimeIncidenceSourceStatus;
  dataset: string;
  error?: string;
}): CrimeQueryResult {
  return {
    success: params.sourceStatus !== "FAILED" && params.sourceStatus !== "NOT_CONFIGURED",
    querySource: params.querySource,
    sourceStatus: params.sourceStatus,
    coverageStatus: params.coverageStatus,
    data: [],
    bibliografia: "",
    lineage: buildCrimeQueryLineage({
      dataset: params.dataset,
      querySource: params.querySource,
      centerLat: params.lat,
      centerLng: params.lng,
      radiusMeters: params.radiusMeters,
      coverageStatus: params.coverageStatus,
      totalScanned: 0,
      matched: 0,
      excluded: 0,
      duplicates: 0,
      returnedRecords: 0,
    }),
    error: params.error,
  };
}

export async function queryPostgisCrimeIncidence(input: CrimeQueryInput): Promise<CrimeQueryResult> {
  let spatialQuery: ReturnType<typeof buildPostgisCrimeIncidenceSpatialQuery>;
  try {
    spatialQuery = buildPostgisCrimeIncidenceSpatialQuery(input);
  } catch (error: any) {
    return emptyResult({
      ...input,
      radiusMeters: input.radiusMeters ?? 0,
      coverageStatus: "UNKNOWN_COVERAGE",
      querySource: "POSTGIS",
      sourceStatus: "FAILED",
      dataset: "incidencia_estadistica",
      error: error.message || String(error),
    });
  }

  const radiusMeters = spatialQuery.radiusMeters;
  const coverageStatus = determineAguascalientesCoverage(input.lat, input.lng);
  if (coverageStatus === "OUT_OF_COVERAGE") {
    return emptyResult({
      ...input,
      radiusMeters,
      coverageStatus,
      querySource: "NONE",
      sourceStatus: "OUT_OF_COVERAGE",
      dataset: "incidencia_estadistica",
    });
  }

  if (!process.env.DATABASE_URL) {
    return emptyResult({
      ...input,
      radiusMeters,
      coverageStatus,
      querySource: "NONE",
      sourceStatus: "NOT_CONFIGURED",
      dataset: "incidencia_estadistica",
      error: "DATABASE_URL not configured for canonical PostGIS incidence query.",
    });
  }

  if (input.requestedCoverage && input.requestedCoverage !== coverageStatus) {
    return emptyResult({
      ...input,
      radiusMeters,
      coverageStatus,
      querySource: "POSTGIS",
      sourceStatus: "POSTGIS_AVAILABLE",
      dataset: "incidencia_estadistica",
    });
  }

  const client = await getPool().connect();
  try {
    const startDateParamIndex = spatialQuery.spatialParams.length + 1;
    const endDateParamIndex = spatialQuery.spatialParams.length + 2;
    const incidentTypesParamIndex = spatialQuery.spatialParams.length + 3;
    const result = await client.query(
      `
        SELECT
          incidente,
          fecha,
          hora,
          rango_horario,
          nom_asen,
          i.fuente_archivo,
          i.source_fingerprint,
          d.dataset_version,
          ST_Y(i.geometria::geometry) AS lat,
          ST_X(i.geometria::geometry) AS lng,
          ${spatialQuery.selectDistanceSql}
        FROM incidencia_estadistica i
        LEFT JOIN crime_incidence_datasets d
          ON d.id = i.dataset_id
        WHERE ${spatialQuery.whereSpatialSql}
          AND ($${startDateParamIndex}::text IS NULL OR i.fecha::date >= $${startDateParamIndex}::date)
          AND ($${endDateParamIndex}::text IS NULL OR i.fecha::date <= $${endDateParamIndex}::date)
          AND ($${incidentTypesParamIndex}::text[] IS NULL OR i.incidente = ANY($${incidentTypesParamIndex}::text[]))
        ORDER BY distancia_m ASC
        LIMIT 500
      `,
      [
        ...spatialQuery.spatialParams,
        input.startDate ?? null,
        input.endDate ?? null,
        input.incidentTypes?.length ? input.incidentTypes : null,
      ]
    );

    const data = result.rows.map((row: any) => ({
      INCIDENTE: row.incidente,
      FECHA: row.fecha,
      HORA: row.hora,
      RANGO: row.rango_horario,
      NOM_ASEN: row.nom_asen,
      lat: Number(row.lat),
      lng: Number(row.lng),
      originalLat: Number(row.lat),
      originalLng: Number(row.lng),
      coverageStatus: "IN_COVERAGE",
      geoValidationStatus: "VALID_GEOLOCATION",
      geolocationSource: "SOURCE_RECORD",
      distancia_m: Number(row.distancia_m),
      fuente: row.fuente_archivo,
      sourceFingerprint: row.source_fingerprint,
      datasetVersion: row.dataset_version,
    }));

    return {
      success: true,
      querySource: "POSTGIS",
      sourceStatus: "POSTGIS_AVAILABLE",
      coverageStatus,
      data,
      bibliografia: "",
      lineage: buildCrimeQueryLineage({
        dataset: "incidencia_estadistica",
        querySource: "POSTGIS",
        centerLat: input.lat,
        centerLng: input.lng,
        radiusMeters,
        coverageStatus,
        totalScanned: data.length,
        matched: data.length,
        excluded: 0,
        duplicates: 0,
        returnedRecords: data.length,
        startDate: input.startDate,
        endDate: input.endDate,
      }),
    };
  } catch (error: any) {
    return emptyResult({
      ...input,
      radiusMeters,
      coverageStatus,
      querySource: "POSTGIS",
      sourceStatus: "FAILED",
      dataset: "incidencia_estadistica",
      error: error.message || String(error),
    });
  } finally {
    client.release();
  }
}

export function queryCsvLegacyCrimeIncidence(input: CrimeQueryInput): CrimeQueryResult {
  const radiusMeters = input.radiusMeters ?? 1000;
  const projectRoot = process.cwd();
  const coverageStatus = determineAguascalientesCoverage(input.lat, input.lng);
  if (coverageStatus === "OUT_OF_COVERAGE") {
    return emptyResult({
      ...input,
      radiusMeters,
      coverageStatus,
      querySource: "NONE",
      sourceStatus: "OUT_OF_COVERAGE",
      dataset: "incidencia_csv_files",
    });
  }

  if (input.requestedCoverage && input.requestedCoverage !== coverageStatus) {
    return emptyResult({
      ...input,
      radiusMeters,
      coverageStatus,
      querySource: "CSV_LEGACY_FALLBACK",
      sourceStatus: "CSV_LEGACY_FALLBACK",
      dataset: "incidencia_csv_files",
    });
  }

  const incidenciaDir =
    pickExistingDir(
      process.env.CRIME_INCIDENCE_CSV_DIR || "",
      "C:\\Users\\sadi7\\OneDrive\\Desktop\\ECOSISTEMA SAI\\PERFIL REMOTO\\Historial SHAPES\\SELECCION PERFILADOR - INCIDENCIA DELICTIVA",
      path.join(projectRoot, "Historial SHAPES", "SELECCION PERFILADOR - INCIDENCIA DELICTIVA"),
      path.join(projectRoot, "Incidencia Delictiva")
    ) ?? "";

  if (!incidenciaDir) {
    return emptyResult({
      ...input,
      radiusMeters,
      coverageStatus,
      querySource: "CSV_LEGACY_FALLBACK",
      sourceStatus: "FAILED",
      dataset: "incidencia_csv_files",
      error: "CSV legacy incidence folder not found.",
    });
  }

  const delitosCercanos: any[] = [];
  let totalScanned = 0;
  let excluded = 0;
  let duplicateCount = 0;

  const files = fs.readdirSync(incidenciaDir, { withFileTypes: true });
  const csvFiles = files
    .filter((f) => f.isFile() && f.name.toLowerCase().endsWith(".csv"))
    .map((f) => path.join(incidenciaDir, f.name));

  for (const filePath of csvFiles) {
    const fileName = path.basename(filePath);
    const csvText = fs.readFileSync(filePath, "utf8");
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = (parsed.data ?? []) as any[];
    const normalized = rows.map((row) => normalizeCrimeRecord(row, fileName));
    const deduped = deduplicateCrimeRecords(normalized);
    totalScanned += normalized.length;
    duplicateCount += deduped.duplicates.length;

    for (const record of deduped.unique) {
      if (!record.isValid || record.lat == null || record.lng == null) {
        excluded++;
        continue;
      }

      if (input.startDate && (!record.date || record.date < input.startDate)) {
        excluded++;
        continue;
      }
      if (input.endDate && (!record.date || record.date > input.endDate)) {
        excluded++;
        continue;
      }
      if (input.incidentTypes?.length && !input.incidentTypes.includes(record.incident)) {
        excluded++;
        continue;
      }

      const dist = haversineMeters(input.lat, input.lng, record.lat, record.lng);
      if (dist <= radiusMeters) {
        delitosCercanos.push({
          ...record.raw,
          lat: record.lat,
          lng: record.lng,
          originalLat: record.originalLat,
          originalLng: record.originalLng,
          coverageStatus: record.coverageStatus,
          geoValidationStatus: record.geoValidationStatus,
          geolocationSource: record.geolocationSource,
          dedupKey: record.dedupKey,
          distancia_m: dist,
          fuente: fileName,
        });
      } else {
        excluded++;
      }
    }
  }

  return {
    success: true,
    querySource: "CSV_LEGACY_FALLBACK",
    sourceStatus: "CSV_LEGACY_FALLBACK",
    coverageStatus,
    data: delitosCercanos,
    bibliografia: "",
    lineage: buildCrimeQueryLineage({
      dataset: "incidencia_csv_files",
      querySource: "CSV_LEGACY_FALLBACK",
      centerLat: input.lat,
      centerLng: input.lng,
      radiusMeters,
      coverageStatus,
      totalScanned,
      matched: delitosCercanos.length,
      excluded,
      duplicates: duplicateCount,
      returnedRecords: delitosCercanos.length,
      startDate: input.startDate,
      endDate: input.endDate,
    }),
  };
}

export async function queryCrimeIncidence(input: CrimeQueryInput): Promise<CrimeQueryResult> {
  const postgis = await queryPostgisCrimeIncidence(input);
  if (postgis.sourceStatus === "POSTGIS_AVAILABLE" || postgis.sourceStatus === "OUT_OF_COVERAGE") {
    return { ...postgis, datasetIdentity: configuredDatasetIdentity(postgis) };
  }

  if (input.allowLegacyFallback === false) {
    return { ...postgis, datasetIdentity: configuredDatasetIdentity(postgis) };
  }

  const legacy = queryCsvLegacyCrimeIncidence(input);
  const result: CrimeQueryResult = {
    ...legacy,
    error: postgis.error,
    lineage: {
      ...legacy.lineage,
      filters: {
        ...legacy.lineage.filters,
        postgisStatus: postgis.sourceStatus,
      },
    },
  };
  return { ...result, datasetIdentity: configuredDatasetIdentity(result) };
}






