import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

export const runtime = "nodejs";

type RawRecord = Record<string, unknown>;

function text(record: RawRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function numberValue(record: RawRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function normalize(record: RawRecord, sourceFile: string) {
  return {
    incidentType: text(record, ["INCIDENTE", "incidente", "DELITO", "delito"]),
    date: text(record, ["FECHA", "fecha", "Fecha"]),
    time: text(record, ["HORA", "hora", "Hora"]),
    municipality: text(record, ["MUNICIPIO", "municipio", "MUN_INC"]),
    neighborhood: text(record, ["NOM_ASEN", "nom_asen", "COLONIA", "colonia"]),
    street: text(record, ["NOM_VIAL", "calle", "street"]),
    lat: numberValue(record, ["LAT", "lat", "latitude"]),
    lng: numberValue(record, ["LONG", "LON", "lng", "lon", "longitude"]),
    sourceFile,
  };
}

export async function GET() {
  try {
    const root = process.cwd();
    const candidates = [
      process.env.CRIME_INCIDENCE_CSV_DIR || "",
      path.join(root, "Historial SHAPES", "SELECCION PERFILADOR - INCIDENCIA DELICTIVA"),
      path.join(root, "Incidencia Delictiva"),
    ].filter(Boolean);

    const dir = candidates.find((candidate) => {
      try {
        return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
      } catch {
        return false;
      }
    });

    if (!dir) {
      return NextResponse.json(
        { success: false, error: "CRIME_INCIDENCE_DATASET_NOT_FOUND" },
        { status: 503 }
      );
    }

    const files = fs.readdirSync(dir)
      .filter((name) => name.toLowerCase().endsWith(".csv"))
      .sort();

    const records: ReturnType<typeof normalize>[] = [];

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const csv = fs.readFileSync(fullPath, "utf8");
      const parsed = Papa.parse<RawRecord>(csv, {
        header: true,
        skipEmptyLines: true,
      });

      for (const row of parsed.data) {
        records.push(normalize(row, file));
      }
    }

    const unique = (values: Array<string | null>) =>
      Array.from(new Set(values.filter((value): value is string => Boolean(value))))
        .sort((a, b) => a.localeCompare(b, "es"));

    return NextResponse.json({
      success: true,
      dataset: "INCIDENCIA_DELICTIVA",
      files: files.length,
      totalRecords: records.length,
      filters: {
        municipalities: unique(records.map((record) => record.municipality)),
        neighborhoods: unique(records.map((record) => record.neighborhood)),
        streets: unique(records.map((record) => record.street)),
        incidentTypes: unique(records.map((record) => record.incidentType)),
      },
      records,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
