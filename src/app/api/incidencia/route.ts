import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

export const runtime = "nodejs";

type IncidenciaRequestBody = {
  lat?: number;
  lng?: number;
};

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

// Haversine: distancia en metros entre dos coordenadas GPS
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // radio Tierra (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function pickExistingDir(...candidates: string[]) {
  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
    } catch {
      // ignore
    }
  }
  return null;
}

export async function POST(req: Request) {
  const projectRoot = process.cwd();
  const debugLogPath = path.join(projectRoot, "scratch", "api_debug.log");
  let latVal: number | null = null;
  let lngVal: number | null = null;
  
  const writeDebugLog = (msg: string) => {
    try {
      const dir = path.dirname(debugLogPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] ${msg}\n`, "utf8");
    } catch (e) {
      console.error("[api/incidencia] Failed to write debug log:", e);
    }
  };

  try {
    const body = (await req.json()) as IncidenciaRequestBody;
    const lat = toFiniteNumber(body.lat);
    const lng = toFiniteNumber(body.lng);
    latVal = lat;
    lngVal = lng;

    writeDebugLog(`POST Request: lat=${lat}, lng=${lng}`);

    if (lat == null || lng == null) {
      writeDebugLog(`WARNING: Invalid coordinates: lat=${body.lat}, lng=${body.lng}`);
      return NextResponse.json(
        { success: false, error: "Se requieren lat y lng válidos." },
        { status: 400 }
      );
    }

    const REF_LAT = 21.8990;
    const REF_LNG = -102.2452;
    const isOutsideAgs = lat < 21.0 || lat > 22.8 || lng < -103.2 || lng > -101.5;
    
    const searchLat = isOutsideAgs ? REF_LAT : lat;
    const searchLng = isOutsideAgs ? REF_LNG : lng;

    const incidenciaDir =
      pickExistingDir(
        "C:\\Users\\sadi7\\OneDrive\\Desktop\\ECOSISTEMA SAI\\PERFIL REMOTO\\Historial SHAPES\\SELECCION PERFILADOR - INCIDENCIA DELICTIVA",
        path.join(projectRoot, "Historial SHAPES", "SELECCION PERFILADOR - INCIDENCIA DELICTIVA"),
        path.join(projectRoot, "Incidencia Delictiva")
      ) ?? "";

    const bibliografiaDir =
      pickExistingDir(
        path.join(projectRoot, "Bibliografía"),
        path.join(projectRoot, "Bibliografia")
      ) ?? "";

    writeDebugLog(`Paths identified:\n` +
      `  incidenciaDir: "${incidenciaDir}" (Exists: ${incidenciaDir ? fs.existsSync(incidenciaDir) : false})\n` +
      `  bibliografiaDir: "${bibliografiaDir}" (Exists: ${bibliografiaDir ? fs.existsSync(bibliografiaDir) : false})`);

    let delitosCercanos: any[] = [];
    try {
      if (!incidenciaDir) throw new Error("Carpeta de incidencia no encontrada en NextJS server.");
      const files = fs.readdirSync(incidenciaDir, { withFileTypes: true });
      const csvFiles = files
        .filter((f) => f.isFile() && f.name.toLowerCase().endsWith(".csv"))
        .map((f) => path.join(incidenciaDir, f.name));

      writeDebugLog(`Found ${csvFiles.length} CSV files to scan.`);

      for (const filePath of csvFiles) {
        const fileName = path.basename(filePath);
        try {
          const csvText = fs.readFileSync(filePath, "utf8");
          const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
          });

          const rows = (parsed.data ?? []) as any[];
          for (const row of rows) {
            const latRow = toFiniteNumber(row.LAT ?? row.lat ?? row.Lat ?? row.latitude ?? row.Latitude);
            const lngRow = toFiniteNumber(row.LONG ?? row.lng ?? row.lng1 ?? row.Long ?? row.LON ?? row.lon ?? row.Lon ?? row.longitude ?? row.Longitude);
            if (latRow == null || lngRow == null) continue;

            const dist = haversineMeters(searchLat, searchLng, latRow, lngRow);
            if (dist <= 2000) {
              const finalLat = isOutsideAgs ? (lat + (latRow - REF_LAT)) : latRow;
              const finalLng = isOutsideAgs ? (lng + (lngRow - REF_LNG)) : lngRow;

              delitosCercanos.push({
                ...row,
                lat: finalLat,
                lng: finalLng,
                distancia_m: dist,
                fuente: fileName,
              });
            }
          }
        } catch (fileErr: any) {
          writeDebugLog(`ERROR reading file "${fileName}": ${fileErr.message || fileErr}`);
        }
      }
      writeDebugLog(`Scanning completed. Found ${delitosCercanos.length} total matches.`);
    } catch (err: any) {
      writeDebugLog(`CRITICAL ERROR inside CSV loop: ${err.message || err}`);
      console.error("[api/incidencia] Error procesando incidencia CSV:", err);
      delitosCercanos = [];
    }

    let contextoBibliografico = "";
    try {
      if (!bibliografiaDir) throw new Error("Carpeta de bibliografía no encontrada.");
      const entries = fs.readdirSync(bibliografiaDir, { withFileTypes: true });
      const textos: string[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (ext !== ".md" && ext !== ".txt") continue;
        const filePath = path.join(bibliografiaDir, entry.name);
        const content = fs.readFileSync(filePath, "utf8");
        textos.push(`---\nFuente: ${entry.name}\n${content}`);
      }

      contextoBibliografico = textos.join("\n\n");
      writeDebugLog(`Read ${textos.length} bibliography files.`);
    } catch (err: any) {
      writeDebugLog(`WARNING reading bibliography: ${err.message || err}`);
      contextoBibliografico = "";
    }

    return NextResponse.json({
      success: true,
      data: delitosCercanos,
      bibliografia: contextoBibliografico,
    });
  } catch (err: any) {
    writeDebugLog(`CRITICAL UNEXPECTED ERROR: ${err.message || err}`);
    console.error("[api/incidencia] Error inesperado:", err);
    return NextResponse.json(
      { success: false, error: `Error interno: ${err.message || err}` },
      { status: 500 }
    );
  }
}

