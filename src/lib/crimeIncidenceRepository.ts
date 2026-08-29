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

type CrimeQueryInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
  allowLegacyFallback?: boolean;
};

export type CrimeQueryResult = {
  success: boolean;
  querySource: CrimeIncidenceQuerySource;
  sourceStatus: CrimeIncidenceSourceStatus;
  coverageStatus: CrimeCoverageStatus;
  data: any[];
  bibliografia: string;
  lineage: ReturnType<typeof buildCrimeQueryLineage>;
  error?: string;
};

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
  const radiusMeters = input.radiusMeters ?? 1000;
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

  const client = await getPool().connect();
  try {
    const result = await client.query(
      `
        SELECT
          incidente,
          fecha,
          hora,
          rango_horario,
          nom_asen,
          fuente_archivo,
          ST_Y(geometria::geometry) AS lat,
          ST_X(geometria::geometry) AS lng,
          ST_Distance(
            geometria,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) AS distancia_m
        FROM incidencia_estadistica
        WHERE ST_DWithin(
          geometria,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
        ORDER BY distancia_m ASC
        LIMIT 500
      `,
      [input.lng, input.lat, radiusMeters]
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
    }),
  };
}

export async function queryCrimeIncidence(input: CrimeQueryInput): Promise<CrimeQueryResult> {
  const postgis = await queryPostgisCrimeIncidence(input);
  if (postgis.sourceStatus === "POSTGIS_AVAILABLE" || postgis.sourceStatus === "OUT_OF_COVERAGE") {
    return postgis;
  }

  if (input.allowLegacyFallback === false) {
    return postgis;
  }

  const legacy = queryCsvLegacyCrimeIncidence(input);
  return {
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
}
