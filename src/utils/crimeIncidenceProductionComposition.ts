import type { CrimeDatasetIdentity } from "@/types/crimeDatasetIdentity";
import type { CrimeIncidenceFilterState } from "@/types/crimeIncidenceControlledFilters";
import type { CrimeExpedientGeographyContext } from "@/types/crimeIncidenceGeographicResolution";
import type { CrimeIncidenceQueryRequest } from "@/types/crimeIncidenceQueryGovernance";
import type { CrimeIncidenceQueryGeometry } from "@/types/crimeIncidenceWorkspace";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { projectCrimeIncidenceAnalytics } from "@/utils/crimeIncidenceAnalyticalProjection";
import { createCrimeIncidenceExportContract } from "@/utils/crimeIncidenceExportGovernance";
import { resolveCrimeIncidenceGeography } from "@/utils/crimeIncidenceGeographicResolution";
import { resolveCrimeIncidenceQuery } from "@/utils/crimeIncidenceQueryGovernance";
import {
  adaptCrimeIncidenceQueryResult,
  type CurrentCrimeIncidenceQueryResult,
} from "@/utils/crimeIncidenceWorkspaceAdapter";
import {
  bindCrimeIncidenceWorkspace,
  type CrimeIncidenceWorkspaceBindingResult,
} from "@/utils/crimeIncidenceWorkspaceBinding";

interface CrimeIncidenceApiResult extends CurrentCrimeIncidenceQueryResult {
  success: boolean;
  datasetIdentity?: CrimeDatasetIdentity;
}

export interface CrimeIncidenceProductionCompositionInput {
  expedienteId: string;
  canonicalGeography: CanonicalProjectGeography | null | undefined;
  radiusMeters: number | null | undefined;
  filters?: CrimeIncidenceFilterState;
  requestedBy?: string;
  fetcher?: typeof fetch;
}

function errorBinding(message: string): CrimeIncidenceWorkspaceBindingResult {
  return { state: "ERROR", viewModel: null, error: message };
}

export function createCrimeIncidenceCanonicalQueryGeometry(
  geography: CanonicalProjectGeography,
  radiusMeters: number | null | undefined
): CrimeIncidenceQueryGeometry | null {
  if (geography.type === "INDIVIDUAL" && geography.geometry.type === "Point" && radiusMeters && radiusMeters > 0) {
    return { mode: "POINT_RADIUS", geometry: geography.geometry, radiusMeters };
  }
  if (geography.type === "CORRIDOR" && geography.geometry.type === "LineString" && radiusMeters && radiusMeters > 0) {
    return { mode: "CORRIDOR_COVERAGE", geometry: geography.geometry, corridorWidthMeters: radiusMeters };
  }
  if (geography.type === "POLYGON" && geography.geometry.type === "Polygon") {
    return { mode: "POLYGON_BOUNDARY", geometry: geography.geometry };
  }
  return null;
}

function expedientGeography(
  expedienteId: string,
  queryGeometry: CrimeIncidenceQueryGeometry,
  requestedBy: string
): CrimeExpedientGeographyContext {
  const base = { expedienteId, source: "PROJECT_CREATION" as const, createdBy: requestedBy };
  if (queryGeometry.mode === "POINT_RADIUS") return { ...base, geographyType: "INDIVIDUAL", point: queryGeometry };
  if (queryGeometry.mode === "CORRIDOR_COVERAGE") return { ...base, geographyType: "CORRIDOR", corridor: queryGeometry };
  return { ...base, geographyType: "POLYGON", polygon: queryGeometry };
}

export async function composeCrimeIncidenceProductionWorkspace(
  input: CrimeIncidenceProductionCompositionInput
): Promise<CrimeIncidenceWorkspaceBindingResult> {
  const geography = input.canonicalGeography;
  if (!geography || geography.validationStatus !== "VALID") {
    return errorBinding("CRIME_INCIDENCE_CANONICAL_GEOGRAPHY_REQUIRED");
  }
  const requestedBy = input.requestedBy?.trim();
  if (!requestedBy) return errorBinding("CRIME_INCIDENCE_ANALYST_IDENTITY_REQUIRED");
  const queryGeometry = createCrimeIncidenceCanonicalQueryGeometry(geography, input.radiusMeters);
  if (!queryGeometry) return errorBinding("CRIME_INCIDENCE_PRODUCTION_GEOGRAPHY_UNSUPPORTED");

  try {
    const fetcher = input.fetcher ?? fetch;
    const filters = input.filters ?? {
      temporal: { start: null, end: null },
      incidentTypes: [],
      geographicCoverage: null,
    };
    const pointCoordinates = queryGeometry.mode === "POINT_RADIUS" ? queryGeometry.geometry.coordinates : null;
    const response = await fetcher("/api/incidencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(pointCoordinates ? { lat: pointCoordinates[1], lng: pointCoordinates[0] } : {}),
        queryGeometry,
        radiusMeters: queryGeometry.mode === "POINT_RADIUS"
          ? queryGeometry.radiusMeters
          : queryGeometry.mode === "CORRIDOR_COVERAGE" ? queryGeometry.corridorWidthMeters : null,
        startDate: filters.temporal.start,
        endDate: filters.temporal.end,
        incidentTypes: filters.incidentTypes,
        requestedCoverage: filters.geographicCoverage,
      }),
    });
    if (!response.ok) throw new Error(`CRIME_INCIDENCE_QUERY_HTTP_${response.status}`);
    const result = await response.json() as CrimeIncidenceApiResult;
    if (!result.success || result.sourceStatus === "FAILED" || result.sourceStatus === "NOT_CONFIGURED") {
      throw new Error(result.error || "CRIME_INCIDENCE_QUERY_SOURCE_UNAVAILABLE");
    }
    if (!result.datasetIdentity) throw new Error("CRIME_INCIDENCE_DATASET_IDENTITY_UNAVAILABLE");

    const queryParameters = {
      geometryMode: queryGeometry.mode,
      requestedCoverage: filters.geographicCoverage,
    };
    const envelope = adaptCrimeIncidenceQueryResult({ result, queryGeometry, queryParameters });
    const request: CrimeIncidenceQueryRequest = {
      datasetIdentity: result.datasetIdentity,
      queryGeometry,
      temporalFilters: { ...filters.temporal },
      crimeFilters: { incidentTypes: [...filters.incidentTypes] },
      purpose: "WORKSPACE",
      analyticLevel: "DESCRIPTIVE",
      requestProvenance: {
        requestedBy,
        requestReference: `crime-incidence-workspace:${input.expedienteId}`,
        sourceReference: result.lineage.dataset,
      },
      queryParameters,
      sourceEnvelope: envelope,
    };
    const queryResolution = resolveCrimeIncidenceQuery(request);
    if (!queryResolution.admission.accepted) {
      throw new Error(`CRIME_INCIDENCE_DATASET_NOT_ADMITTED:${queryResolution.admission.status}`);
    }
    const geographicResolution = resolveCrimeIncidenceGeography(
      expedientGeography(input.expedienteId, queryGeometry, requestedBy),
      queryResolution
    );
    const analyticalProjection = projectCrimeIncidenceAnalytics(envelope.records, geographicResolution);
    const exportContract = createCrimeIncidenceExportContract(
      analyticalProjection,
      geographicResolution.institutionalMetadata
    );
    return bindCrimeIncidenceWorkspace({
      expedienteId: input.expedienteId,
      canonicalGeography: geography,
      geographicResolution,
      analyticalProjection,
      exportContract,
    });
  } catch (error: unknown) {
    return errorBinding(error instanceof Error ? error.message : "CRIME_INCIDENCE_PRODUCTION_COMPOSITION_ERROR");
  }
}
