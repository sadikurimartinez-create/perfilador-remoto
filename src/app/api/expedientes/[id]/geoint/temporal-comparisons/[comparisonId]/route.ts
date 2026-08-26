import { NextRequest, NextResponse } from "next/server";
import { TemporalComparisonPersistenceService } from "@/services/geoint/temporalComparisonPersistenceService";
import {
  GeointGovernanceStatusValue,
  normalizeGeointGovernanceStatus,
} from "@/types/geointGovernance";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; comparisonId: string } }
) {
  try {
    const expedienteId = params.id;
    const comparisonId = params.comparisonId;
    const body = await req.json();
    const status = normalizeGeointGovernanceStatus(body.status) as GeointGovernanceStatusValue;
    const comments = String(body.comments || body.validationComment || "").trim();
    const reviewerId = String(body.reviewerId || body.validatedBy || "US-CEIPOL-ANALISTA");

    if (!expedienteId || !comparisonId) {
      return NextResponse.json(
        { error: "id y comparisonId son obligatorios" },
        { status: 400 }
      );
    }

    const comparison = await TemporalComparisonPersistenceService.updateTemporalComparisonStatus(
      expedienteId,
      comparisonId,
      status,
      comments,
      reviewerId
    );

    if (!comparison) {
      return NextResponse.json(
        { error: "Comparacion temporal no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ comparison });
  } catch (error: any) {
    console.error("[API temporal-comparisons PATCH] Error:", error);
    return NextResponse.json(
      { error: "Error al actualizar comparacion temporal", details: error?.message },
      { status: 500 }
    );
  }
}
