import { NextRequest, NextResponse } from "next/server";
import { TemporalComparisonPersistenceService } from "@/services/geoint/temporalComparisonPersistenceService";
import { TemporalComparisonRecord } from "@/types/geointTemporalComparison";
import {
  GeointGovernanceStatusValue,
  normalizeGeointGovernanceStatus,
} from "@/types/geointGovernance";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const expedienteId = params.id;
    const body = (await req.json()) as TemporalComparisonRecord;

    if (!expedienteId || !body?.id || !body.traceabilityId || !body.sourceEvidenceId) {
      return NextResponse.json(
        { error: "expedienteId, id, traceabilityId y sourceEvidenceId son obligatorios" },
        { status: 400 }
      );
    }

    const comparison = await TemporalComparisonPersistenceService.saveTemporalComparison(
      expedienteId,
      body
    );

    return NextResponse.json({ comparison }, { status: 201 });
  } catch (error: any) {
    console.error("[API temporal-comparisons POST] Error:", error);
    return NextResponse.json(
      { error: "Error al persistir comparacion temporal", details: error?.message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const expedienteId = params.id;
    const rawStatus = req.nextUrl.searchParams.get("status");
    const status = rawStatus
      ? normalizeGeointGovernanceStatus(rawStatus) as GeointGovernanceStatusValue
      : undefined;

    const comparisons = await TemporalComparisonPersistenceService.getTemporalComparisonsByProject(
      expedienteId,
      status
    );

    return NextResponse.json({ expedienteId, comparisons });
  } catch (error: any) {
    console.error("[API temporal-comparisons GET] Error:", error);
    return NextResponse.json(
      { error: "Error al consultar comparaciones temporales", details: error?.message },
      { status: 500 }
    );
  }
}
