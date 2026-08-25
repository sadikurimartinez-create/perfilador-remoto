import { NextRequest, NextResponse } from "next/server";
import { StreetViewFindingService } from "@/services/streetViewFindingService";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; captureId: string } }
) {
  try {
    const expedienteId = params.id;
    const captureId = params.captureId;

    if (!expedienteId || !captureId) {
      return NextResponse.json(
        { error: "Parámetros 'id' (expedienteId) y 'captureId' son requeridos" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const estado = body.estado || body.estado_revision || body.status || "PENDIENTE_REVISION";
    const usuarioRevision = body.usuarioRevision || body.validatedBy || body.rejectedBy || "analista";
    const validationComment = body.validationComment || body.rejectionComment || body.comentario || "";

    const success = await StreetViewFindingService.updateStreetViewFindingStatus(
      expedienteId,
      captureId,
      {
        estado,
        usuarioRevision,
        validationComment
      }
    );

    return NextResponse.json({
      message: "Estado de evidencia StreetView actualizado correctamente",
      success,
      captureId,
      estado
    });
  } catch (error: any) {
    console.error("[API PATCH streetview capture] Error:", error);
    return NextResponse.json(
      { error: "Error al actualizar evidencia StreetView", details: error?.message },
      { status: 500 }
    );
  }
}
