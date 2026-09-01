import type {
  CanonicalCrimeIncident,
  CrimeIncidenceQueryEnvelope,
  CrimeIncidenceQueryGeometry,
  CrimeIncidenceVisualProductMetadata,
} from "@/types/crimeIncidenceWorkspace";
import { CRIME_INCIDENCE_INSTITUTIONAL_BRANDING } from "@/types/crimeIncidenceWorkspace";
import type { CrimeIncidenceAnalyticalProjection } from "@/types/crimeIncidenceAnalyticalProjection";
import type { CrimeIncidenceExportContract } from "@/types/crimeIncidenceExportContract";
import type { CrimeIncidenceGeographicResolution } from "@/types/crimeIncidenceGeographicResolution";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
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

export interface CrimeIncidenceWorkspaceViewModel {
  workspaceId: string | null;
  expedienteId: string;
  geographyContext: {
    canonicalGeography: CanonicalProjectGeography;
    geographicResolution: CrimeIncidenceGeographicResolution;
  };
  incidents: {
    matched: CanonicalCrimeIncident[];
    excluded: CanonicalCrimeIncident[];
    table: Array<{
      classification: "MATCHED" | "EXCLUDED";
      incident: CanonicalCrimeIncident;
    }>;
  };
  metrics: CrimeIncidenceAnalyticalProjection["metrics"];
  limitations: string[];
  datasetReference: CrimeIncidenceAnalyticalProjection["datasetReference"];
  queryReference: CrimeIncidenceAnalyticalProjection["sourceQuery"];
  exportReference: CrimeIncidenceExportContract;
  institutionalMetadata: CrimeIncidenceExportContract["institutionalMetadata"];
  lineage: CrimeQueryLineage;
}

export interface BuildCrimeIncidenceWorkspaceInput {
  expedienteId: string;
  canonicalGeography: CanonicalProjectGeography;
  geographicResolution: CrimeIncidenceGeographicResolution;
  analyticalProjection: CrimeIncidenceAnalyticalProjection;
  exportContract: CrimeIncidenceExportContract;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function assertWorkspaceChain(input: BuildCrimeIncidenceWorkspaceInput): void {
  const resolvedExpedienteId = input.geographicResolution.expedientGeography.expedienteId;
  if (input.expedienteId !== resolvedExpedienteId || input.expedienteId !== input.exportContract.expedienteId) {
    throw new Error("CRIME_INCIDENCE_WORKSPACE_EXPEDIENT_MISMATCH");
  }

  const canonicalGeometry = input.canonicalGeography.geometry;
  const resolvedGeometry = input.geographicResolution.geometry.geometry;
  if (
    input.canonicalGeography.type !== input.geographicResolution.expedientGeography.geographyType ||
    JSON.stringify(canonicalGeometry) !== JSON.stringify(resolvedGeometry)
  ) {
    throw new Error("CRIME_INCIDENCE_WORKSPACE_GEOGRAPHY_MISMATCH");
  }

  if (
    input.analyticalProjection.sourceQuery !== input.geographicResolution.queryResolution ||
    input.exportContract.projectionReference !== input.analyticalProjection
  ) {
    throw new Error("CRIME_INCIDENCE_WORKSPACE_GOVERNANCE_CHAIN_MISMATCH");
  }
}

/** Assembles governed ADR-022 outputs for a future UI without deriving analytical or spatial facts. */
export function buildCrimeIncidenceWorkspace(
  input: BuildCrimeIncidenceWorkspaceInput
): CrimeIncidenceWorkspaceViewModel {
  assertWorkspaceChain(input);
  const matched = input.geographicResolution.matchedRecords;
  const excluded = input.geographicResolution.excludedRecords;

  return {
    workspaceId: input.exportContract.exportId,
    expedienteId: input.expedienteId,
    geographyContext: {
      canonicalGeography: input.canonicalGeography,
      geographicResolution: input.geographicResolution,
    },
    incidents: {
      matched,
      excluded,
      table: [
        ...matched.map((incident) => ({ classification: "MATCHED" as const, incident })),
        ...excluded.map((incident) => ({ classification: "EXCLUDED" as const, incident })),
      ],
    },
    metrics: input.analyticalProjection.metrics,
    limitations: unique([
      ...input.geographicResolution.queryResolution.limitations,
      ...input.analyticalProjection.limitations,
      ...input.exportContract.limitations,
      "WORKSPACE_DATA_IS_NOT_EVIDENCE_FINDING_PROOF_CAUSALITY_OR_CRIMINOLOGICAL_PROFILE",
    ]),
    datasetReference: input.analyticalProjection.datasetReference,
    queryReference: input.analyticalProjection.sourceQuery,
    exportReference: input.exportContract,
    institutionalMetadata: input.exportContract.institutionalMetadata,
    lineage: input.analyticalProjection.lineage,
  };
}
