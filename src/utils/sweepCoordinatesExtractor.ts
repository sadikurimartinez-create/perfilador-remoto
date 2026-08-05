export interface SweepCoordinates {
  hasCoordinates: boolean;
  lat: number | null;
  lng: number | null;
  source: string;
}

/**
 * Función aislada y robusta encargada de extraer coordenadas geográficas de un barrido OSINT.
 * Responsabilidad:
 * 1. Buscar en campos estructurados (lat/lng, latitude/longitude).
 * 2. Buscar dentro de objetos en sweep.data.
 * 3. Buscar mediante patrones Regex progresivos en description, comentario o datos serializados.
 */
export function extractSweepCoordinates(sweep: any): SweepCoordinates {
  if (!sweep) {
    return { hasCoordinates: false, lat: null, lng: null, source: "UNKNOWN" };
  }

  const source = sweep.engine || sweep.source || "UNKNOWN";

  // 1. Campos numéricos estructurados de nivel superior
  if (typeof sweep.lat === "number" && typeof sweep.lng === "number") {
    return { hasCoordinates: true, lat: sweep.lat, lng: sweep.lng, source };
  }
  if (sweep.latitude !== undefined && sweep.longitude !== undefined) {
    const latNum = Number(sweep.latitude);
    const lngNum = Number(sweep.longitude);
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      return { hasCoordinates: true, lat: latNum, lng: lngNum, source };
    }
  }

  // 2. Objeto de datos estructurado interno
  if (sweep.data) {
    if (typeof sweep.data === "object") {
      const lat = sweep.data.lat ?? sweep.data.latitude ?? sweep.data.gpsLat;
      const lng = sweep.data.lng ?? sweep.data.longitude ?? sweep.data.gpsLng;
      if (typeof lat === "number" && typeof lng === "number") {
        return { hasCoordinates: true, lat, lng, source };
      }
      const latNum = Number(lat);
      const lngNum = Number(lng);
      if (!isNaN(latNum) && !isNaN(lngNum) && lat !== null && lng !== null) {
        return { hasCoordinates: true, lat: latNum, lng: lngNum, source };
      }
    }
  }

  // 3. Expresiones Regulares progresivas en campos de texto (description, comentario o data string)
  const textToSearch = [
    sweep.description,
    sweep.comentario,
    typeof sweep.data === "string" ? sweep.data : JSON.stringify(sweep.data),
  ].filter(Boolean).join(" ");

  if (textToSearch) {
    const regexList = [
      // Patrón: Coordenadas: 21.80691,-102.26740
      /coordenadas?:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i,
      // Patrón: Latitud 21.80691 ... Longitud -102.26740
      /latitud\s*(-?\d+\.\d+).*?longitud\s*(-?\d+\.\d+)/i,
      // Patrón: 21.80691 / -102.26740
      /(-?\d+\.\d+)\s*\/\s*(-?\d+\.\d+)/i,
      // Patrón genérico: [lat], [lng] (limitado a coordenadas de latitud/longitud válidas)
      /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/
    ];

    for (const regex of regexList) {
      const match = textToSearch.match(regex);
      if (match) {
        const latVal = parseFloat(match[1]);
        const lngVal = parseFloat(match[2]);
        // Validación matemática elemental de rangos geográficos
        if (!isNaN(latVal) && !isNaN(lngVal) && Math.abs(latVal) <= 90 && Math.abs(lngVal) <= 180) {
          return { hasCoordinates: true, lat: latVal, lng: lngVal, source };
        }
      }
    }
  }

  return { hasCoordinates: false, lat: null, lng: null, source };
}
