import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { getPool } from "@/lib/db";
import {
  classifyCrimeDataset,
  resolveCrimeIncidenceTemporalWindow,
} from "@/utils/crimeIncidenceCanonicalPipeline";

type CsvRow = {
  INCIDENTE: string;
  FECHA: string;
  HORA: string;
  RANGO?: string;
  NOM_ASEN?: string;
  LAT: string;
  LONG: string;
};

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debe enviar un archivo CSV en el campo 'file'." },
        { status: 400 }
      );
    }

    // ADR-022.8K: el boundary productivo de ingestión falla cerrado.
    // El pipeline canónico conserva compatibilidad legacy cuando no existe
    // configuración temporal, pero una carga persistente nunca puede hacerlo.
    const temporalWindow = resolveCrimeIncidenceTemporalWindow();

    if (
      temporalWindow === null ||
      temporalWindow.status === "INVALID_CONFIGURATION"
    ) {
      return NextResponse.json(
        {
          error:
            "La ingestión de incidencia delictiva está bloqueada porque la ventana temporal institucional no está configurada correctamente.",
          code:
            temporalWindow === null
              ? "CRIME_INCIDENCE_TEMPORAL_CONFIGURATION_REQUIRED"
              : "CRIME_INCIDENCE_TEMPORAL_CONFIGURATION_INVALID",
          inserted: 0,
          attempted: 0,
          persistenceConfirmation: "BLOCKED_BY_TEMPORAL_GOVERNANCE",
        },
        { status: 503 }
      );
    }
    const arrayBuffer = await file.arrayBuffer();
    const csvText = Buffer.from(arrayBuffer).toString("utf8");

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
    const classified = classifyCrimeDataset(records, file.name);
    const validRecords = classified.records.filter((record) => record.isValid);

    const client = await getPool().connect();
    let attempted = 0;
    let inserted = 0;
    try {
      await client.query("BEGIN");

      for (const record of validRecords) {
        await client.query(
          `
          INSERT INTO incidencia_estadistica (
            incidente,
            fecha,
            hora,
            rango_horario,
            nom_asen,
            fuente_archivo,
            geometria
          )
          VALUES (
            $1,
            $2::date,
            $3::time,
            $4,
            $5,
            $6,
            ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography
          )
        `,
          [
            record.incident,
            record.date,
            record.time,
            record.raw.RANGO ?? null,
            record.raw.NOM_ASEN ?? null,
            file.name,
            record.lng,
            record.lat,
          ]
        );
        attempted++;
      }

      await client.query("COMMIT");
      inserted = attempted;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[upload-csv] Error en transacción:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? `Error al guardar los registros en la base de datos: ${error.message}`
              : "Error al guardar los registros en la base de datos.",
          received: classified.summary.received,
          validated: classified.summary.validated,
          rejected: classified.summary.rejected,
          inserted: 0,
          attempted,
          duplicates: classified.summary.duplicates,
          persistenceConfirmation: "FAILED",
        },
        { status: 500 }
      );
    } finally {
      client.release();
    }

    return NextResponse.json(
      {
        ok: true,
        received: classified.summary.received,
        validated: classified.summary.validated,
        rejected: classified.summary.rejected,
        inserted,
        attempted,
        duplicates: classified.summary.duplicates,
        persistenceConfirmation: "DB_CONFIRMED",
        persistentDedupConstraint: "PERSISTENT_DEDUP_CONSTRAINT_PENDING",
        temporalCoverage: classified.temporalCoverage,
        validationStatus: classified.status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[upload-csv] Error general:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Error al procesar el CSV: ${error.message}`
            : "Error al procesar el CSV.",
      },
      { status: 500 }
    );
  }
}

