import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { executeInstitutionalGeointEntity } from "@/services/institutionalGeointEntityBoundary";
import {
  isSyntheticStreetViewReviewer,
} from "@/utils/streetViewApiAuth";

function streetViewPatchStatus(message: string): number {
  if (message.startsWith("GEOINT_ENTITY_ACCESS_DENIED")) return 403;
  if (message.startsWith("STREETVIEW_FINDING_TRACEABILITY_INCOMPLETE")) return 400;
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

    if(req.headers.get("origin")!==new URL(req.url).origin || req.headers.get("sec-fetch-site")==="cross-site")return NextResponse.json({error:"INVALID_ORIGIN"},{status:403});
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

    await executeInstitutionalGeointEntity(cookies().get("ceipol_session")?.value,
      {projectId:expedienteId,kind:'STREETVIEW',operation:'UPDATE',id:captureId,data:{estado,validationComment}});
    const success=true;

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
