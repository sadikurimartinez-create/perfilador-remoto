import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { getPool } from "@/lib/db";
import {
  classifyCrimeDataset,
  normalizeCrimeRecord,
  resolveCrimeIncidenceTemporalWindow,
} from "@/utils/crimeIncidenceCanonicalPipeline";
import { buildCrimeSourceFingerprint } from "@/utils/crimeIncidenceSourceFingerprint.server";

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
    const physicalRecords = records.map((row) =>
      normalizeCrimeRecord(row, file.name)
    );
    const validRecords = physicalRecords.filter((record) => record.isValid);

    const fingerprintedRecords = physicalRecords
      .map((record, sourceIndex) => ({
        record,
        sourceIndex,
      }))
      .filter(({ record }) => record.isValid)
      .map(({ record, sourceIndex }) => {
        const raw = record.raw as Record<string, unknown>;

        const physicalSourceId =
          raw.OID ??
          raw.OBJECTID ??
          raw.FID;

        const normalizedPhysicalSourceId =
          physicalSourceId === null || physicalSourceId === undefined
            ? ""
            : String(physicalSourceId).trim();

        const sourceRowLocator =
          normalizedPhysicalSourceId !== ""
            ? normalizedPhysicalSourceId
            : `ROW:${file.name}:${sourceIndex + 2}`;

        return {
          record,
          sourceFingerprint: buildCrimeSourceFingerprint(record.raw),
          sourceRowLocator,
        };
      });

    const datasetName =
      process.env.CRIME_INCIDENCE_DATASET_NAME?.trim() ?? "";
    const datasetVersion =
      process.env.CRIME_INCIDENCE_DATASET_VERSION?.trim() ?? "";
    const sourceOrganization =
      process.env.CRIME_INCIDENCE_SOURCE_ORGANIZATION?.trim() ?? "";

    if (
      datasetName === "" ||
      datasetVersion === "" ||
      sourceOrganization === ""
    ) {
      return NextResponse.json(
        {
          error:
            "Configuración de provenance institucional incompleta para incidencia delictiva.",
          code: "CRIME_INCIDENCE_DATASET_PROVENANCE_CONFIGURATION_REQUIRED",
          inserted: 0,
          attempted: 0,
          persistenceConfirmation: "BLOCKED_BY_DATASET_GOVERNANCE",
        },
        { status: 503 }
      );
    }

    const client = await getPool().connect();
    let attempted = 0;
    let inserted = 0;

    try {
      await client.query("BEGIN");

      const datasetResult = await client.query(
        `
          SELECT id
          FROM public.crime_incidence_datasets
          WHERE dataset_name = $1
            AND dataset_version = $2
            AND source_organization = $3
            AND temporal_start = $4::date
            AND temporal_end = $5::date
            AND provenance_status = 'VERIFIED'
          LIMIT 2
        `,
        [
          datasetName,
          datasetVersion,
          sourceOrganization,
          temporalWindow.start,
          temporalWindow.end,
        ]
      );

      if (datasetResult.rows.length !== 1) {
        throw new Error(
          "CRIME_INCIDENCE_DATASET_NOT_ADMITTED"
        );
      }

      const datasetId = datasetResult.rows[0].id;

      for (const {
        record,
        sourceFingerprint,
        sourceRowLocator,
      } of fingerprintedRecords) {
        attempted++;

        if (!/^[a-f0-9]{64}$/.test(sourceFingerprint)) {
          throw new Error(
            "CRIME_INCIDENCE_SOURCE_FINGERPRINT_INVALID"
          );
        }

        const incidenceResult = await client.query(
          `
            INSERT INTO public.incidencia_estadistica (
              incidente,
              fecha,
              hora,
              rango_horario,
              nom_asen,
              fuente_archivo,
              geometria,
              dataset_id,
              source_fingerprint,
              source_fingerprint_version
            )
            VALUES (
              $1,
              $2::date,
              $3::time,
              $4,
              $5,
              $6,
              ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
              $9::uuid,
              $10,
              'SOURCE_FINGERPRINT_V1'
            )
            ON CONFLICT (source_fingerprint)
            DO NOTHING
            RETURNING id
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
            datasetId,
            sourceFingerprint,
          ]
        );

        let incidenceId;

        if (incidenceResult.rowCount === 1) {
          incidenceId = incidenceResult.rows[0].id;
          inserted++;
        }

        if (incidenceResult.rowCount === 0) {
          const existingResult = await client.query(
            `
              SELECT id
              FROM public.incidencia_estadistica
              WHERE source_fingerprint = $1
              LIMIT 1
            `,
            [sourceFingerprint]
          );

          if (existingResult.rows.length !== 1) {
            throw new Error(
              "CRIME_INCIDENCE_CANONICAL_RECORD_RESOLUTION_FAILED"
            );
          }

          incidenceId = existingResult.rows[0].id;
        }

        const lineageResult = await client.query(
          `
            INSERT INTO public.crime_incidence_dataset_records (
              dataset_id,
              incidence_id,
              source_fingerprint,
              source_fingerprint_version,
              source_row_locator
            )
            VALUES (
              $1::uuid,
              $2::uuid,
              $3,
              'SOURCE_FINGERPRINT_V1',
              $4
            )
            ON CONFLICT (dataset_id, source_row_locator)
            DO NOTHING
            RETURNING id
          `,
          [
            datasetId,
            incidenceId,
            sourceFingerprint,
            sourceRowLocator,
          ]
        );

        if (lineageResult.rowCount === 0) {
          const existingLineageResult = await client.query(
            `
              SELECT
                incidence_id,
                source_fingerprint,
                source_fingerprint_version
              FROM public.crime_incidence_dataset_records
              WHERE dataset_id = $1::uuid
                AND source_row_locator = $2
              LIMIT 2
            `,
            [
              datasetId,
              sourceRowLocator,
            ]
          );

          if (existingLineageResult.rows.length !== 1) {
            throw new Error(
              "CRIME_INCIDENCE_LINEAGE_RESOLUTION_FAILED"
            );
          }

          const existingLineage =
            existingLineageResult.rows[0];

          const lineageMatches =
            existingLineage.incidence_id === incidenceId &&
            existingLineage.source_fingerprint ===
              sourceFingerprint &&
            existingLineage.source_fingerprint_version ===
              "SOURCE_FINGERPRINT_V1";

          if (!lineageMatches) {
            throw new Error(
              "CRIME_INCIDENCE_LINEAGE_IDENTITY_CONFLICT"
            );
          }
        }
      }

      await client.query("COMMIT");
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
        persistentDedupConstraint: "SOURCE_FINGERPRINT_UNIQUE_ACTIVE",
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

