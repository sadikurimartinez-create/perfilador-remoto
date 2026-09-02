import { buildStreetViewUrl } from "@/lib/googleStreetView";

export interface StreetViewPanoramaOptions {
  size?: string;
  fov?: number;
  pitch?: number;
  heading?: number;
}

export interface StreetViewPanoramaResult {
  url: string | null;
  dataUrl?: string | null;
  isAvailable: boolean;
  panoramaLat: number | null;
  panoramaLng: number | null;
  panoramaId: string | null;
  captureDate: string; // Fecha real ("YYYY-MM") o "FECHA_NO_DISPONIBLE"
  copyright?: string;
  error?: string;
}

/**
 * Servicio proveedor de panorámicas de Google Street View API.
 * ADR-019.15: Obtiene metadata real de Google Street View Metadata API con filtro exterior (`source=outdoor`).
 */
export async function fetchStreetViewPanorama(
  lat: number,
  lng: number,
  options?: StreetViewPanoramaOptions
): Promise<StreetViewPanoramaResult> {
  try {
    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ??
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
      null;

    // Permitir mock in-memory para entorno de pruebas automatizadas (unit tests)
    const mockMap = (global as any).__MOCK_STREETVIEW_METADATA_MAP__;
    if (mockMap) {
      const mockKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const mockMeta = mockMap[mockKey] || mockMap["DEFAULT"];
      if (mockMeta) {
        if (!mockMeta.isAvailable || mockMeta.status === "ZERO_RESULTS" || mockMeta.error === "NO_VALID_OUTDOOR_PANORAMA") {
          return {
            url: null,
            dataUrl: null,
            isAvailable: false,
            panoramaLat: null,
            panoramaLng: null,
            panoramaId: null,
            captureDate: "FECHA_NO_DISPONIBLE",
            error: "NO_VALID_OUTDOOR_PANORAMA: No se encontró panorámica exterior válida de Google Street View.",
          };
        }
        const mockImageReference =
          mockMeta.dataUrl ||
          mockMeta.url ||
          buildStreetViewUrl(lat, lng, options) ||
          `mock-streetview://${mockMeta.panoramaId || mockMeta.pano_id || "panorama"}`;
        return {
          url: mockImageReference,
          dataUrl: mockImageReference,
          isAvailable: true,
          panoramaLat: mockMeta.panoramaLat ?? lat,
          panoramaLng: mockMeta.panoramaLng ?? lng,
          panoramaId: mockMeta.panoramaId || mockMeta.pano_id || null,
          captureDate: mockMeta.captureDate || "FECHA_NO_DISPONIBLE",
          copyright: mockMeta.copyright || "© Google",
        };
      }
    }

    if (!apiKey) {
      console.warn(`[streetViewProviderService] API Key ausente para lat: ${lat}, lng: ${lng}`);
      return {
        url: null,
        dataUrl: null,
        isAvailable: false,
        panoramaLat: null,
        panoramaLng: null,
        panoramaId: null,
        captureDate: "FECHA_NO_DISPONIBLE",
        error: "NO_PANORAMA_METADATA: GOOGLE_MAPS_API_KEY ausente.",
      };
    }

    // 1. Consultar Google Street View Metadata API con source=outdoor
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&source=outdoor&key=${apiKey}`;
    const metaRes = await fetch(metadataUrl);

    if (!metaRes.ok) {
      return {
        url: null,
        dataUrl: null,
        isAvailable: false,
        panoramaLat: null,
        panoramaLng: null,
        panoramaId: null,
        captureDate: "FECHA_NO_DISPONIBLE",
        error: `NO_PANORAMA_METADATA: Respuesta HTTP ${metaRes.status} al consultar Google Metadata API.`,
      };
    }

    const metaData = await metaRes.json();

    if (metaData.status !== "OK" || !metaData.pano_id) {
      return {
        url: null,
        dataUrl: null,
        isAvailable: false,
        panoramaLat: null,
        panoramaLng: null,
        panoramaId: null,
        captureDate: "FECHA_NO_DISPONIBLE",
        error: "NO_VALID_OUTDOOR_PANORAMA: No se encontró panorámica exterior válida de Google Street View en la ubicación especificada.",
      };
    }

    // 2. Extraer metadata real de Google
    const realPanoId = metaData.pano_id;
    const realLat = metaData.location?.lat ?? lat;
    const realLng = metaData.location?.lng ?? lng;
    const realDate = metaData.date ? String(metaData.date) : "FECHA_NO_DISPONIBLE";
    const copyright = metaData.copyright || "© Google";

    const staticUrl = buildStreetViewUrl(lat, lng, options);

    // Intentar resolver la imagen a través del proxy local si aplica
    let dataUrl: string | null = null;
    if (staticUrl) {
      try {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(staticUrl)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const blob = await res.blob();
          dataUrl = await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        }
      } catch (proxyErr) {
        // Fallback silencioso
      }
    }

    return {
      url: staticUrl,
      dataUrl: dataUrl || staticUrl,
      isAvailable: true,
      panoramaLat: realLat,
      panoramaLng: realLng,
      panoramaId: realPanoId,
      captureDate: realDate,
      copyright,
    };
  } catch (err: any) {
    console.error("[streetViewProviderService] Error al obtener panorama Street View:", err);
    return {
      url: null,
      dataUrl: null,
      isAvailable: false,
      panoramaLat: null,
      panoramaLng: null,
      panoramaId: null,
      captureDate: "FECHA_NO_DISPONIBLE",
      error: `STREET_VIEW_ERROR: ${err?.message || "Error desconocido en proveedor de panorámicas."}`,
    };
  }
}
