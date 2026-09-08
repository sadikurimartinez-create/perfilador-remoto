import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { StreetViewFindingService } from "@/services/streetViewFindingService";
import {
  isSyntheticStreetViewReviewer,
  resolveStreetViewSessionIdentity,
} from "@/utils/streetViewApiAuth";

function streetViewPatchStatus(message: string): number {
  if (message.startsWith("STREET_VIEW_FINDING_PROMOTION_BLOCKED")) return 400;
  return 500;
}

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
    const reviewerFromClient = body.usuarioRevision || body.validatedBy || body.rejectedBy;
    const validationComment = body.validationComment || body.rejectionComment || body.comentario || "";

    if (isSyntheticStreetViewReviewer(reviewerFromClient)) {
      return NextResponse.json(
        { error: "STREETVIEW_HUMAN_IDENTITY_SYNTHETIC" },
        { status: 400 }
      );
    }

    const identity = resolveStreetViewSessionIdentity(cookies().get("ceipol_session")?.value);
    if (!identity) {
      return NextResponse.json(
        { error: "INVALID_SESSION" },
        { status: 401 }
      );
    }

    const success = await StreetViewFindingService.updateStreetViewFindingStatus(
      expedienteId,
      captureId,
      {
        estado,
        usuarioRevision: identity.username,
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
    const details = error?.message || "INTERNAL_STREETVIEW_EVIDENCE_ERROR";
    return NextResponse.json(
      { error: streetViewPatchStatus(details) === 500 ? "Error al actualizar evidencia StreetView" : details, details },
      { status: streetViewPatchStatus(details) }
    );
  }
}
