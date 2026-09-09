import { NextResponse } from "next/server";
import { queryCrimeIncidence } from "@/lib/crimeIncidenceRepository";
import {
  buildCrimeQueryInputFromCanonicalSpatialQuery,
} from "@/lib/incidenceSpatialQueryAdapter";
import { buildStreetAnalyticalCorridor } from "@/lib/incidenceStreetCorridor";
import type {
  IncidenceCanonicalSpatialQuery,
  IncidenceLineStringGeometry,
} from "@/lib/incidenceSpatialTypes";

export const runtime = "nodejs";

type IncidenciaRequestBody = {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  canonicalSpatialQuery?: IncidenceCanonicalSpatialQuery | null;
  allowLegacyFallback?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  incidentTypes?: string[];
  requestedCoverage?: "IN_COVERAGE" | "OUT_OF_COVERAGE" | "UNKNOWN_COVERAGE" | null;
};

function incidenceResultStatus(result: Awaited<ReturnType<typeof queryCrimeIncidence>>) {
  if (result.error === "CSV_LEGACY_FALLBACK_POLYGON_NOT_SUPPORTED_NO_GEOMETRY_DEGRADATION") {
    return "FALLBACK_BLOCKED";
  }
  if (result.sourceStatus === "FAILED" || result.sourceStatus === "NOT_CONFIGURED") {
    return "ERROR";
  }
  if (result.coverageStatus === "OUT_OF_COVERAGE") {
    return "SOURCE_UNAVAILABLE";
  }
  if (result.success && result.data.length === 0) {
    return "SUCCESS_EMPTY";
  }
  return "SUCCESS_WITH_DATA";
}

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function prepareCanonicalSpatialQueryForAdapter(
  query: IncidenceCanonicalSpatialQuery
): Promise<IncidenceCanonicalSpatialQuery> {
  if (query.mode !== "CORRIDOR_COVERAGE" || query.geometry.type !== "LineString") {
    return query;
  }

  const lineString = query.geometry as IncidenceLineStringGeometry;
  const corridor = await buildStreetAnalyticalCorridor({
    geometry: {
      type: "MultiLineString",
      coordinates: [lineString.coordinates],
    },
    widthMeters: query.metadata.corridorWidthMeters,
  });

  return {
    ...query,
    geometry: corridor.corridorGeometry,
    metadata: {
      ...query.metadata,
      corridorWidthMeters: corridor.widthMeters,
      limitations: [
        ...(query.metadata.limitations ?? []),
        "CORRIDOR_LINESTRING_BUFFERED_WITH_POSTGIS_GEOGRAPHY",
      ],
    },
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncidenciaRequestBody;
    let spatialQueryMetadata: Record<string, unknown> | null = null;
    let queryInput = null;

    if (body.canonicalSpatialQuery) {
      const canonicalSpatialQuery = await prepareCanonicalSpatialQueryForAdapter(
        body.canonicalSpatialQuery
      );
      const adapted = buildCrimeQueryInputFromCanonicalSpatialQuery(
        canonicalSpatialQuery,
        {
          allowLegacyFallback: body.allowLegacyFallback,
          startDate: body.startDate ?? null,
          endDate: body.endDate ?? null,
          incidentTypes: Array.isArray(body.incidentTypes) ? body.incidentTypes : [],
          requestedCoverage: body.requestedCoverage ?? null,
        }
      );
      spatialQueryMetadata = adapted.metadata;
      queryInput = adapted.crimeQueryInput;
    }

    const lat = toFiniteNumber(body.lat);
    const lng = toFiniteNumber(body.lng);
    if (!queryInput && (lat == null || lng == null)) {
      return NextResponse.json(
        { success: false, error: "Se requieren lat y lng válidos." },
        { status: 400 }
      );
    }

    const result = await queryCrimeIncidence(
      queryInput ?? {
        lat: lat as number,
        lng: lng as number,
        radiusMeters: toFiniteNumber(body.radiusMeters) ?? 1000,
        allowLegacyFallback: body.allowLegacyFallback,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        incidentTypes: Array.isArray(body.incidentTypes) ? body.incidentTypes : [],
        requestedCoverage: body.requestedCoverage ?? null,
      }
    );

    const responseBody = {
      ...result,
      resultStatus: incidenceResultStatus(result),
      ...(spatialQueryMetadata ? { spatialQueryMetadata } : {}),
    };

    return NextResponse.json(
      responseBody,
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (err: any) {
    console.error("[api/incidencia] Error inesperado:", err);
    return NextResponse.json(
      { success: false, error: `Error interno: ${err.message || err}` },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

