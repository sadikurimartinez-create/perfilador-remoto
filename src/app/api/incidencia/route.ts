import { NextResponse } from "next/server";
import { queryCrimeIncidence } from "@/lib/crimeIncidenceRepository";

export const runtime = "nodejs";

type IncidenciaRequestBody = {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  allowLegacyFallback?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  incidentTypes?: string[];
  requestedCoverage?: "IN_COVERAGE" | "OUT_OF_COVERAGE" | "UNKNOWN_COVERAGE" | null;
};

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncidenciaRequestBody;
    const lat = toFiniteNumber(body.lat);
    const lng = toFiniteNumber(body.lng);

    if (lat == null || lng == null) {
      return NextResponse.json(
        { success: false, error: "Se requieren lat y lng válidos." },
        { status: 400 }
      );
    }

    const result = await queryCrimeIncidence({
      lat,
      lng,
      radiusMeters: toFiniteNumber(body.radiusMeters) ?? 1000,
      allowLegacyFallback: body.allowLegacyFallback,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      incidentTypes: Array.isArray(body.incidentTypes) ? body.incidentTypes : [],
      requestedCoverage: body.requestedCoverage ?? null,
    });

    return NextResponse.json(
      result,
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

