export const runtime = "nodejs";
export const maxDuration = 120; // Allow enough time to process multiple files via Gemini

import { NextResponse } from "next/server";
import { DriveIngestionEngine } from "@/modules/drive-ingestion/drive-ingestion.engine";
import { DriveIngestionService } from "@/modules/drive-ingestion/drive-ingestion.service";
import { getPool } from "@/lib/db";

/**
 * GET: Retrieve already processed intelligence or current ingestion logs.
 * Query parameters:
 * - type: 'intelligence' | 'logs' (default: 'intelligence')
 * - category: 'Pandillas' | 'OSINT' | 'Evidencia' | 'Desaparecidos' (optional)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "intelligence";
    const category = searchParams.get("category") || undefined;

    if (type === "logs") {
      await DriveIngestionService.ensureTrackingTableExists();
      const pool = getPool();
      const res = await pool.query(
        "SELECT file_id, file_name, status, timestamp, source, logical_category, error_message FROM drive_ingestion_log ORDER BY timestamp DESC LIMIT 100"
      );
      return NextResponse.json({ logs: res.rows });
    }

    // Default: Retrieve extracted intelligence
    const intelligence = await DriveIngestionEngine.getIngestedIntelligence(category);
    return NextResponse.json({ intelligence });
  } catch (err: any) {
    console.error("[GET /api/drive-ingest] Error:", err);
    return NextResponse.json(
      { error: "Error al recuperar datos de ingesta.", details: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST: Triggers the secure Google Drive scan and file ingestion process.
 */
export async function POST(req: Request) {
  try {
    console.log("[POST /api/drive-ingest] Solicitud de escaneo e ingesta de Google Drive recibida.");
    
    const report = await DriveIngestionEngine.runPipeline();
    
    return NextResponse.json({
      success: true,
      message: "Escaneo e ingesta de Google Drive completado.",
      report,
    });
  } catch (err: any) {
    console.error("[POST /api/drive-ingest] Error crítico ejecutando el pipeline:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno al ejecutar el motor de ingesta de Google Drive.",
        details: err.message,
      },
      { status: 500 }
    );
  }
}
