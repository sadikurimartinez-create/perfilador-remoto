import { NextRequest, NextResponse } from "next/server";
import { StreetViewFindingService } from "@/services/streetViewFindingService";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  console.log(`[ADR-019.8.3 ENDPOINT DEBUG] Entrada a GET /api/expedientes/${params?.id}/streetview/findings a las ${new Date().toISOString()}`);

  try {
    const expedienteId = params.id;
    if (!expedienteId) {
      console.warn("[ADR-019.8.3 ENDPOINT DEBUG] ID de expediente ausente");
      return NextResponse.json({ error: "Falta expedienteId" }, { status: 400 });
    }

    console.log(`[ADR-019.8.3 ENDPOINT DEBUG] Solicitando hallazgos a Firestore para expediente: ${expedienteId}`);
    const dbStartTime = Date.now();
    
    const findings = await StreetViewFindingService.getStreetViewFindingsByProject(expedienteId);
    
    const dbDuration = Date.now() - dbStartTime;
    console.log(`[ADR-019.8.3 ENDPOINT DEBUG] Respuesta de Firestore obtenida en ${dbDuration}ms. Total hallazgos: ${findings?.length || 0}`);

    const totalDuration = Date.now() - startTime;
    console.log(`[ADR-019.8.3 ENDPOINT DEBUG] Salida exitosa de GET endpoint en ${totalDuration}ms`);

    return NextResponse.json({
      expedienteId,
      findings
    });
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error(`[ADR-019.8.3 ENDPOINT DEBUG] Error en GET endpoint tras ${totalDuration}ms:`, error);
    return NextResponse.json(
      { error: "Error interno al recuperar hallazgos", details: error?.message },
      { status: 500 }
    );
  }
}
