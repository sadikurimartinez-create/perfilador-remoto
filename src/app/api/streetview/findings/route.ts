import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { executeInstitutionalGeointEntity } from "@/services/institutionalGeointEntityBoundary";
import {
  isSyntheticStreetViewReviewer,
} from "@/utils/streetViewApiAuth";

function streetViewPostStatus(message: string): number {
  if (message.startsWith("GEOINT_ENTITY_ACCESS_DENIED")) return 403;
  if (message.startsWith("STREETVIEW_FINDING_GEO_REQUIRED")) return 400;
  if (message.startsWith("STREETVIEW_FINDING_TRACEABILITY_INCOMPLETE")) return 400;
  return 500;
}

export async function POST(req: NextRequest) {
  try {
    if(req.headers.get("origin")!==new URL(req.url).origin || req.headers.get("sec-fetch-site")==="cross-site")return NextResponse.json({error:"INVALID_ORIGIN"},{status:403});
    const body = await req.json();
    const expedienteId = body.expedienteId || body.projectId;
    const reviewerFromClient = body.usuarioRevision || body.validatedBy || body.createdBy;

    if (!expedienteId) {
      return NextResponse.json(
        { error: "El campo 'expedienteId' es obligatorio" },
        { status: 400 }
      );
    }

    if (isSyntheticStreetViewReviewer(reviewerFromClient)) {
      return NextResponse.json(
        { error: "STREETVIEW_HUMAN_IDENTITY_SYNTHETIC" },
        { status: 400 }
      );
    }

    const finding = await executeInstitutionalGeointEntity(cookies().get("ceipol_session")?.value,
      {projectId:expedienteId,kind:'STREETVIEW',operation:'SAVE',id:body.id||body.captureId,data:body});

    return NextResponse.json(
      {
        message: "Hallazgo de StreetView registrado correctamente",
        finding
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[API POST /api/streetview/findings] Error:", error);
    const details = error?.message || "INTERNAL_STREETVIEW_FINDING_ERROR";
    return NextResponse.json(
      { error: streetViewPostStatus(details) === 500 ? "Error al registrar hallazgo de StreetView" : details, details },
      { status: streetViewPostStatus(details) }
    );
  }
}
