import type {
  CanonicalCrimeIncident,
  CrimeIncidenceQueryEnvelope,
  CrimeIncidenceQueryGeometry,
  CrimeIncidenceVisualProductMetadata,
} from "@/types/crimeIncidenceWorkspace";
import { CRIME_INCIDENCE_INSTITUTIONAL_BRANDING } from "@/types/crimeIncidenceWorkspace";
import type {
  CrimeCoverageStatus,
  CrimeIncidenceQuerySource,
  CrimeIncidenceSourceStatus,
  CrimeQueryLineage,
} from "@/utils/crimeIncidenceCanonicalPipeline";

type CurrentCrimeRecord = Record<string, unknown>;

export interface CurrentCrimeIncidenceQueryResult {
  querySource: CrimeIncidenceQuerySource;
  sourceStatus: CrimeIncidenceSourceStatus;
  coverageStatus: CrimeCoverageStatus;
  data: CurrentCrimeRecord[];
  bibliografia?: string | null;
  lineage: CrimeQueryLineage;
  error?: string;
}

export interface AdaptCrimeIncidenceQueryResultInput {
  result: CurrentCrimeIncidenceQueryResult;
  queryGeometry?: CrimeIncidenceQueryGeometry;
  queryParameters?: Record<string, unknown>;
}

function value(record: CurrentCrimeRecord, keys: string[]): unknown {
  for (const key of keys) {
    const candidate = record[key];
    if (candidate !== undefined && candidate !== null && candidate !== "") return candidate;
  }
  return undefined;
}

function text(record: CurrentCrimeRecord, keys: string[]): string | undefined {
  const candidate = value(record, keys);
  if (candidate === undefined) return undefined;
  const normalized = String(candidate).trim();
  return normalized || undefined;
}

function number(record: CurrentCrimeRecord, keys: string[]): number | null {
  const candidate = value(record, keys);
  const normalized = typeof candidate === "number" ? candidate : typeof candidate === "string" ? Number(candidate) : Number.NaN;
  return Number.isFinite(normalized) ? normalized : null;
}

function technicalIncidentId(parts: Array<string | number | null | undefined>): string {
  return ["ADR022", "INCIDENT", ...parts.map((part) => encodeURIComponent(String(part ?? "UNAVAILABLE")))].join(":");
}

function currentPointGeometry(lineage: CrimeQueryLineage): CrimeIncidenceQueryGeometry {
  return {
    mode: "POINT_RADIUS",
    geometry: {
      type: "Point",
      coordinates: [lineage.geographicFilter.center.lng, lineage.geographicFilter.center.lat],
    },
    radiusMeters: lineage.geographicFilter.radiusMeters,
  };
}

function adaptRecord(
  record: CurrentCrimeRecord,
  result: CurrentCrimeIncidenceQueryResult
): CanonicalCrimeIncident {
  const incidentType = text(record, ["INCIDENTE", "incidente", "tipo", "tipoDelito"]);
  const occurredDate = text(record, ["FECHA", "fecha", "Fecha"]);
  const occurredTime = text(record, ["HORA", "hora", "Hora"]);
  const timeRange = text(record, ["RANGO", "rango_horario", "rangoHorario"]);
  const lat = number(record, ["lat", "LAT"]);
  const lng = number(record, ["lng", "LONG", "LON"]);
  const originalLat = number(record, ["originalLat"]);
  const originalLng = number(record, ["originalLng"]);
  const sourceFile = text(record, ["fuente", "sourceFile"]);
  const sourceReference = text(record, ["sourceReference"]);
  const existingId = text(record, ["id", "dedupKey"]);
  const canonicalOriginalLat = originalLat ?? lat;
  const canonicalOriginalLng = originalLng ?? lng;

  return {
    id: existingId || technicalIncidentId([
      result.querySource,
      sourceFile || result.lineage.dataset,
      incidentType,
      occurredDate,
      occurredTime,
      canonicalOriginalLat,
      canonicalOriginalLng,
    ]),
    incidentType: incidentType ?? null,
    occurredDate: occurredDate ?? null,
    occurredTime: occurredTime ?? null,
    timeRange: timeRange ?? null,
    coordinates: {
      lat,
      lng,
      originalLat: canonicalOriginalLat,
      originalLng: canonicalOriginalLng,
    },
    location: {
      ...(text(record, ["MUNICIPIO", "municipio", "MUN_INC"]) ? { municipality: text(record, ["MUNICIPIO", "municipio", "MUN_INC"]) } : {}),
      ...(text(record, ["NOM_ASEN", "nom_asen", "COLONIA", "colonia"]) ? { neighborhood: text(record, ["NOM_ASEN", "nom_asen", "COLONIA", "colonia"]) } : {}),
      ...(text(record, ["NOM_VIAL", "calle", "street"]) ? { street: text(record, ["NOM_VIAL", "calle", "street"]) } : {}),
      ...(text(record, ["referencia", "reference", "DESCRIP"]) ? { reference: text(record, ["referencia", "reference", "DESCRIP"]) } : {}),
    },
    source: {
      querySource: result.querySource,
      sourceStatus: result.sourceStatus,
      ...(sourceFile ? { sourceFile } : {}),
      ...(result.lineage.dataset ? { datasetId: result.lineage.dataset } : {}),
      ...(sourceReference ? { sourceReference } : {}),
    },
    coverage: {
      temporal: result.lineage.timeRange,
      geographic: (text(record, ["coverageStatus"]) as CrimeCoverageStatus | undefined) ?? result.coverageStatus,
    },
    geoValidation: text(record, ["geoValidationStatus"]) ?? null,
    lineage: result.lineage,
    ...(text(record, ["rawReference"]) ? { rawReference: text(record, ["rawReference"]) } : {}),
    ...(number(record, ["distancia_m", "distanceMeters"]) != null ? { distanceMeters: number(record, ["distancia_m", "distanceMeters"])! } : {}),
  };
}

export function adaptCrimeIncidenceQueryResult(
  input: AdaptCrimeIncidenceQueryResultInput
): CrimeIncidenceQueryEnvelope {
  const { result } = input;
  const warnings: string[] = [];
  if (result.querySource === "CSV_LEGACY_FALLBACK") warnings.push("CSV_LEGACY_FALLBACK_ACTIVE");
  if (result.sourceStatus === "OUT_OF_COVERAGE") warnings.push("OUT_OF_COVERAGE_IS_NOT_CONFIRMED_ABSENCE");

  return {
    records: result.data.map((record) => adaptRecord(record, result)),
    querySource: result.querySource,
    sourceStatus: result.sourceStatus,
    coverageStatus: result.coverageStatus,
    lineage: result.lineage,
    bibliography: result.bibliografia?.trim() || null,
    queryGeometry: input.queryGeometry || currentPointGeometry(result.lineage),
    queryParameters: { ...(input.queryParameters || {}) },
    warnings,
    errors: result.error ? [result.error] : [],
    dataset: {
      ...(result.lineage.dataset ? { datasetId: result.lineage.dataset } : {}),
      coverage: {
        temporal: result.lineage.timeRange,
        geographic: result.coverageStatus,
      },
      lineage: result.lineage,
    },
  };
}

export function createCrimeIncidenceVisualProductMetadata(
  input: Omit<CrimeIncidenceVisualProductMetadata, "watermark">
): CrimeIncidenceVisualProductMetadata {
  return {
    ...input,
    watermark: CRIME_INCIDENCE_INSTITUTIONAL_BRANDING.watermark,
  };
}
