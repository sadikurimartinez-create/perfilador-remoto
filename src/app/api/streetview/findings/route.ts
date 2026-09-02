import { NextRequest, NextResponse } from "next/server";
import { StreetViewFindingService } from "@/services/streetViewFindingService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const expedienteId = body.expedienteId || body.projectId;

    if (!expedienteId) {
      return NextResponse.json(
        { error: "El campo 'expedienteId' es obligatorio" },
        { status: 400 }
      );
    }

    const finding = await StreetViewFindingService.createStreetViewFinding({
      ...body,
      expedienteId,
      estado: body.estado || "PENDIENTE_REVISION"
    });

    return NextResponse.json(
      {
        message: "Hallazgo de StreetView registrado correctamente",
        finding
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[API POST /api/streetview/findings] Error:", error);
    return NextResponse.json(
      { error: "Error al registrar hallazgo de StreetView", details: error?.message },
      { status: 500 }
    );
  }
}
