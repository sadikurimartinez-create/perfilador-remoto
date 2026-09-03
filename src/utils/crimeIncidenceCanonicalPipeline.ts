import { validateGeoIntegrity } from "./geoIntegrityEngine";

export type CrimeCoverageStatus = "IN_COVERAGE" | "OUT_OF_COVERAGE" | "UNKNOWN_COVERAGE";
export type CrimeDatasetValidationStatus = "SCHEMA_VALID" | "GEO_INVALID" | "PARTIAL" | "INVALID";
export type CrimeIncidenceQuerySource = "POSTGIS" | "CSV_LEGACY_FALLBACK" | "NONE";
export type CrimeIncidenceSourceStatus = "POSTGIS_AVAILABLE" | "CSV_LEGACY_FALLBACK" | "NOT_CONFIGURED" | "FAILED" | "OUT_OF_COVERAGE";

export interface RawCrimeRecord {
  [key: string]: any;
}

export interface NormalizedCrimeRecord {
  id: string;
  incident: string;
  date: string | null;
  time: string | null;
  originalLat: number | null;
  originalLng: number | null;
  lat: number | null;
  lng: number | null;
  sourceFile: string;
  sourceFingerprint?: string | null;
  datasetVersion?: string | null;
  coverageStatus: CrimeCoverageStatus;
  geoValidationStatus: "VALID_GEOLOCATION" | "NOT_GEOREFERENCED" | "INVALID" | "PRESERVED_UNVERIFIED";
  geolocationSource: "SOURCE_RECORD";
  isValid: boolean;
  rejectionReason?: string;
  dedupKey: string;
  raw: RawCrimeRecord;
}

export interface CrimeIngestSummary {
  received: number;
  validated: number;
  rejected: number;
  inserted: number;
  duplicates: number;
}

export interface CrimeQueryLineage {
  dataset: string;
  querySource: CrimeIncidenceQuerySource;
  filters: Record<string, unknown>;
  timeRange: { start: string | null; end: string | null; status: "KNOWN" | "TEMPORAL_COVERAGE_UNKNOWN" };
  geographicFilter: {
    center: { lat: number; lng: number };
    radiusMeters: number;
    coverageStatus: CrimeCoverageStatus;
  };
  recordSubset: { totalScanned: number; matched: number; excluded: number; duplicates: number; returnedRecords: number };
}

const AGUASCALIENTES_BOUNDS = {
  minLat: 21.0,
  maxLat: 22.8,
  minLng: -103.2,
  maxLng: -101.5,
};

export function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function determineAguascalientesCoverage(lat: number | null, lng: number | null): CrimeCoverageStatus {
  if (lat == null || lng == null) return "UNKNOWN_COVERAGE";
  if (
    lat < AGUASCALIENTES_BOUNDS.minLat ||
    lat > AGUASCALIENTES_BOUNDS.maxLat ||
    lng < AGUASCALIENTES_BOUNDS.minLng ||
    lng > AGUASCALIENTES_BOUNDS.maxLng
  ) {
    return "OUT_OF_COVERAGE";
  }
  return "IN_COVERAGE";
}

export type CrimeIncidenceTemporalWindow =
  | {
      status: "CONFIGURED";
      start: string;
      end: string;
    }
  | {
      status: "INVALID_CONFIGURATION";
      start: null;
      end: null;
    };

function validConfiguredIsoDate(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return raw;
}

export function resolveCrimeIncidenceTemporalWindow(
  environment: Record<string, string | undefined> = process.env
): CrimeIncidenceTemporalWindow | null {
  const rawStart = environment.CRIME_INCIDENCE_DATASET_TEMPORAL_START?.trim();
  const rawEnd = environment.CRIME_INCIDENCE_DATASET_TEMPORAL_END?.trim();

  // Compatibilidad controlada: si ninguna variable temporal fue configurada,
  // no se activa el firewall institucional.
  if (!rawStart && !rawEnd) return null;

  const start = validConfiguredIsoDate(rawStart);
  const end = validConfiguredIsoDate(rawEnd);

  // Si existe intención de configuración, cualquier estado parcial,
  // inválido o invertido debe fallar cerrado.
  if (!start || !end || start > end) {
    return {
      status: "INVALID_CONFIGURATION",
      start: null,
      end: null,
    };
  }

  return {
    status: "CONFIGURED",
    start,
    end,
  };
}

export function parseCrimeDate(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const isoLike = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoLike) {
    const [, y, m, d] = isoLike;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

export function normalizeCrimeTime(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{1,2}$/.test(raw)) return `${raw.padStart(2, "0")}:00:00`;
  if (/^\d{1,2}:\d{2}$/.test(raw)) return `${raw.padStart(5, "0")}:00`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(raw)) return raw.padStart(8, "0");
  return null;
}

function pick(row: RawCrimeRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && row[key] !== "") return row[key];
  }
  return null;
}

export function buildCrimeDedupKey(record: {
  incident: string;
  date: string | null;
  time: string | null;
  originalLat: number | null;
  originalLng: number | null;
  sourceFile: string;
}): string {
  return [
    record.sourceFile,
    record.incident.trim().toUpperCase(),
    record.date ?? "NO_DATE",
    record.time ?? "NO_TIME",
    record.originalLat == null ? "NO_LAT" : record.originalLat.toFixed(6),
    record.originalLng == null ? "NO_LNG" : record.originalLng.toFixed(6),
  ].join("|");
}

export function normalizeCrimeRecord(row: RawCrimeRecord, sourceFile: string): NormalizedCrimeRecord {
  const incident = String(pick(row, ["INCIDENTE", "incidente", "DELITO", "delito"]) ?? "").trim();
  const date = parseCrimeDate(pick(row, ["FECHA", "fecha", "Fecha", "FECHA_DENUNCIA", "fecha_denuncia", "Fecha_Denuncia", "FECHA_REP", "fecha_rep", "Fecha_Rep"]));
  const time = normalizeCrimeTime(pick(row, ["HORA", "hora", "Hora"]));
  const originalLat = toFiniteNumber(pick(row, ["LAT", "lat", "Lat", "latitude", "Latitude"]));
  const originalLng = toFiniteNumber(pick(row, ["LONG", "LON", "lng", "lon", "Long", "Lon", "longitude", "Longitude"]));
  const sourceFingerprint = pick(row, ["sourceFingerprint", "source_fingerprint"]);
  const datasetVersion = pick(row, ["datasetVersion", "dataset_version"]);
  const coverageStatus = determineAguascalientesCoverage(originalLat, originalLng);
  const geo = validateGeoIntegrity({ latitude: originalLat, longitude: originalLng, source: "SOURCE_RECORD" });
  const geoStatus = geo.geolocationStatus ?? "INVALID";
  const hasRequired = Boolean(incident && date && originalLat != null && originalLng != null);
  const inCoverage = coverageStatus === "IN_COVERAGE";
  const temporalWindow = resolveCrimeIncidenceTemporalWindow();
  const temporalConfigurationValid =
    temporalWindow?.status !== "INVALID_CONFIGURATION";
  const temporalInScope =
    temporalWindow === null ||
    (temporalWindow.status === "CONFIGURED" &&
      date !== null &&
      date >= temporalWindow.start &&
      date <= temporalWindow.end);
  const isValid =
    hasRequired &&
    geoStatus === "VALID_GEOLOCATION" &&
    inCoverage &&
    temporalConfigurationValid &&
    temporalInScope;
  const dedupKey = buildCrimeDedupKey({ incident, date, time, originalLat, originalLng, sourceFile });

  let rejectionReason: string | undefined;
  if (!hasRequired) rejectionReason = "MISSING_REQUIRED_FIELDS";
  else if (geoStatus !== "VALID_GEOLOCATION") rejectionReason = "GEO_INVALID";
  else if (!inCoverage) rejectionReason = coverageStatus;
  else if (!temporalConfigurationValid) rejectionReason = "TEMPORAL_CONFIGURATION_INVALID";
  else if (!temporalInScope) rejectionReason = "TEMPORAL_OUT_OF_SCOPE";

  return {
    id: dedupKey,
    incident,
    date,
    time,
    originalLat,
    originalLng,
    lat: isValid ? originalLat : null,
    lng: isValid ? originalLng : null,
    sourceFile,
    sourceFingerprint: sourceFingerprint == null ? null : String(sourceFingerprint),
    datasetVersion: datasetVersion == null ? null : String(datasetVersion),
    coverageStatus,
    geoValidationStatus: geoStatus,
    geolocationSource: "SOURCE_RECORD",
    isValid,
    rejectionReason,
    dedupKey,
    raw: row,
  };
}

export function deduplicateCrimeRecords(records: NormalizedCrimeRecord[]): {
  unique: NormalizedCrimeRecord[];
  duplicates: NormalizedCrimeRecord[];
} {
  const seen = new Set<string>();
  const unique: NormalizedCrimeRecord[] = [];
  const duplicates: NormalizedCrimeRecord[] = [];

  for (const record of records) {
    if (seen.has(record.dedupKey)) {
      duplicates.push(record);
      continue;
    }
    seen.add(record.dedupKey);
    unique.push(record);
  }

  return { unique, duplicates };
}

export function classifyCrimeDataset(rows: RawCrimeRecord[], sourceFile: string): {
  status: CrimeDatasetValidationStatus;
  records: NormalizedCrimeRecord[];
  summary: CrimeIngestSummary;
  temporalCoverage: { start: string | null; end: string | null; status: "KNOWN" | "TEMPORAL_COVERAGE_UNKNOWN" };
} {
  const records = rows.map((row) => normalizeCrimeRecord(row, sourceFile));
  const { unique, duplicates } = deduplicateCrimeRecords(records);
  const validUnique = unique.filter((record) => record.isValid);
  const invalidUnique = unique.filter((record) => !record.isValid);
  const dates = validUnique.map((record) => record.date).filter(Boolean).sort() as string[];
  const hasAnyRequiredShape = records.some((record) => record.incident || record.date || record.originalLat != null || record.originalLng != null);

  let status: CrimeDatasetValidationStatus = "INVALID";
  if (validUnique.length > 0 && invalidUnique.length === 0) status = "SCHEMA_VALID";
  else if (validUnique.length > 0 && invalidUnique.length > 0) status = "PARTIAL";
  else if (records.length > 0 && hasAnyRequiredShape && invalidUnique.some((record) => record.rejectionReason === "GEO_INVALID" || record.coverageStatus !== "IN_COVERAGE")) status = "GEO_INVALID";

  return {
    status,
    records: unique,
    summary: {
      received: records.length,
      validated: validUnique.length,
      rejected: invalidUnique.length,
      inserted: 0,
      duplicates: duplicates.length,
    },
    temporalCoverage:
      dates.length > 0
        ? { start: dates[0], end: dates[dates.length - 1], status: "KNOWN" }
        : { start: null, end: null, status: "TEMPORAL_COVERAGE_UNKNOWN" },
  };
}

export function buildCrimeQueryLineage(params: {
  dataset: string;
  querySource?: CrimeIncidenceQuerySource;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  coverageStatus: CrimeCoverageStatus;
  totalScanned: number;
  matched: number;
  excluded: number;
  duplicates: number;
  returnedRecords?: number;
  startDate?: string | null;
  endDate?: string | null;
}): CrimeQueryLineage {
  return {
    dataset: params.dataset,
    querySource: params.querySource ?? "CSV_LEGACY_FALLBACK",
    filters: {
      radiusMeters: params.radiusMeters,
      coverageStatus: params.coverageStatus,
    },
    timeRange:
      params.startDate || params.endDate
        ? { start: params.startDate ?? null, end: params.endDate ?? null, status: "KNOWN" }
        : { start: null, end: null, status: "TEMPORAL_COVERAGE_UNKNOWN" },
    geographicFilter: {
      center: { lat: params.centerLat, lng: params.centerLng },
      radiusMeters: params.radiusMeters,
      coverageStatus: params.coverageStatus,
    },
    recordSubset: {
      totalScanned: params.totalScanned,
      matched: params.matched,
      excluded: params.excluded,
      duplicates: params.duplicates,
      returnedRecords: params.returnedRecords ?? params.matched,
    },
  };
}
