import { parse } from "csv-parse/sync";

// Helper to convert values to numbers, returns null if not a valid finite number.
function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

// Helper to calculate distance between two geo-points in meters.
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type DatosGobMxResult = {
  exito: boolean;
  datasetTitle?: string;
  registrosEncontrados: number;
  registrosEnRadio: number;
  datosMuestra: any[];
  resumen: string;
  error?: string;
};

const CKAN_API_BASE = "https://api.datos.gob.mx/v1";

/**
 * Searches a dataset from datos.gob.mx, downloads the first CSV resource,
 * and filters its records by geographic proximity.
 */
export async function searchDatosGobMx(
  datasetUrl: string,
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<DatosGobMxResult> {
  let datasetId = "";
  try {
    const url = new URL(datasetUrl);
    const pathParts = url.pathname.split('/');
    // Handles URLs like /dataset/name and /dataset/name/
    datasetId = pathParts.find((p, i) => p && pathParts[i-1] === 'dataset') || '';
    if (!datasetId) throw new Error();
  } catch {
    throw new Error("URL del dataset no válida. Debe ser una URL de datos.gob.mx/dataset/...");
  }

  // 1. Get dataset metadata from CKAN API
  const datasetMetaUrl = `${CKAN_API_BASE}/datasets/${datasetId}`;
  const metaRes = await fetch(datasetMetaUrl);
  if (!metaRes.ok) {
    throw new Error(`No se pudo obtener la información del dataset '${datasetId}' desde la API de datos.gob.mx.`);
  }
  const metaData = await metaRes.json();
  const datasetTitle = metaData?.title || datasetId;

  // 2. Find the first CSV resource
  const csvResource = metaData?.resources?.find((r: any) => r.format?.toLowerCase() === 'csv');
  if (!csvResource || !csvResource.url) {
    throw new Error("El dataset no contiene un recurso descargable en formato CSV.");
  }

  // 3. Fetch and parse the CSV data
  const csvUrl = csvResource.url;
  const csvRes = await fetch(csvUrl);
  if (!csvRes.ok) {
    throw new Error(`No se pudo descargar el archivo CSV desde ${csvUrl}`);
  }
  const csvContent = await csvRes.text();
  
  let rows: any[];
  try {
    rows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
  } catch (e: any) {
    throw new Error(`Error al procesar el archivo CSV: ${e.message}`);
  }

  if (rows.length === 0) {
    return { exito: true, datasetTitle, registrosEncontrados: 0, registrosEnRadio: 0, datosMuestra: [], resumen: "El dataset está vacío o no se pudo procesar." };
  }

  // 4. Filter by location
  const filteredRows: any[] = [];
  for (const row of rows) {
    const latVal = row.latitud ?? row.Latitud ?? row.LATITUD ?? row.lat ?? row.Lat ?? row.LAT;
    const lngVal = row.longitud ?? row.Longitud ?? row.LONGITUD ?? row.lng ?? row.Lng ?? row.LNG ?? row.lon ?? row.Lon ?? row.LON;
    
    const latNum = toNumber(latVal);
    const lngNum = toNumber(lngVal);

    if (latNum != null && lngNum != null) {
      if (haversineMeters(lat, lng, latNum, lngNum) <= radiusMeters) {
        filteredRows.push(row);
      }
    }
  }

  return {
    exito: true,
    datasetTitle,
    registrosEncontrados: rows.length,
    registrosEnRadio: filteredRows.length,
    datosMuestra: filteredRows.slice(0, 5), // Take a small sample to show
    resumen: `Se procesaron ${rows.length.toLocaleString("es-MX")} registros del dataset "${datasetTitle}". Se encontraron ${filteredRows.length} registros dentro de un radio de ${radiusMeters} metros.`,
  };
}