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
  error?: string;
}

/**
 * Servicio proveedor de panorámicas de Google Street View API.
 * Resuelve URLs estáticas y conversión de imágenes con manejo explícito de errores.
 */
export async function fetchStreetViewPanorama(
  lat: number,
  lng: number,
  options?: StreetViewPanoramaOptions
): Promise<StreetViewPanoramaResult> {
  try {
    const staticUrl = buildStreetViewUrl(lat, lng, options);

    if (!staticUrl) {
      console.warn(`[streetViewProviderService] Street View no disponible o API Key ausente para lat: ${lat}, lng: ${lng}`);
      return {
        url: null,
        dataUrl: null,
        isAvailable: false,
        error: "STREET_VIEW_NOT_AVAILABLE: GOOGLE_MAPS_API_KEY ausente o parámetros inválidos.",
      };
    }

    // Intentar resolver la imagen a través del proxy de imagen local para librar restricciones CORS si aplica
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(staticUrl)}`;
    let dataUrl: string | null = null;

    try {
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
      console.warn("[streetViewProviderService] Proxy de imagen no disponible, usando URL estática directa:", proxyErr);
    }

    return {
      url: staticUrl,
      dataUrl: dataUrl || staticUrl,
      isAvailable: true,
    };
  } catch (err: any) {
    console.error("[streetViewProviderService] Error al obtener panorama Street View:", err);
    return {
      url: null,
      dataUrl: null,
      isAvailable: false,
      error: `STREET_VIEW_ERROR: ${err?.message || "Error desconocido en proveedor de panorámicas."}`,
    };
  }
}
