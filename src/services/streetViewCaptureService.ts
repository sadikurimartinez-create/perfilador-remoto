/**
 * Servicio único y unificado para la captura de imágenes de Google Street View
 * mediante el Proxy Seguro del Backend (ADR-007 / ADR-011).
 */
export interface StreetViewCaptureParams {
  lat: number;
  lng: number;
  heading: number;
  pitch: number;
  fov: number;
  size?: string;
}

export class StreetViewCaptureService {
  /**
   * Captura una imagen de Street View utilizando el proxy seguro del backend
   * para evitar cualquier exposición de la API Key en el frontend.
   */
  static async captureStreetViewImage(params: StreetViewCaptureParams): Promise<Blob> {
    const size = params.size || "800x600";
    const query = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      heading: String(params.heading),
      pitch: String(params.pitch),
      fov: String(params.fov),
      size,
    });

    const endpoint = `/api/proxy-image?${query.toString()}`;
    const response = await fetch(endpoint);

    if (!response.ok) {
      throw {
        code: "SV_CAPTURE_001",
        component: "PhotoAlbum",
        endpoint: "/api/proxy-image",
        message: `Google rechazó la imagen solicitada (${response.status} ${response.statusText})`,
      };
    }

    return await response.blob();
  }
}
