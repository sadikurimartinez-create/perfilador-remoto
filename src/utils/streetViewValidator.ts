/**
 * SSPE-CEIPOL - STREET VIEW PROVIDER GUARD (FASE 7.10)
 * 
 * Validador centralizado para la autenticidad de evidencia virtual.
 * Filtra falsos positivos de Google Street View (errores del proveedor,
 * placeholders, o capturas de mapas GIS cartográficos).
 */

export function isValidStreetViewImage(photo: any): boolean {
  if (photo === null || photo === undefined) {
    return false;
  }

  // 1. Obtener la URL y comentario
  let url = "";
  let comment = "";

  if (typeof photo === "string") {
    url = photo;
  } else {
    url = photo.previewUrl || photo.url || photo.image || "";
    comment = photo.comentario || photo.description || photo.observation || "";
  }

  // 2. Validación de Existencia
  if (!url || typeof url !== "string") {
    return false;
  }

  url = url.trim();
  const lowerUrl = url.toLowerCase();
  const lowerComment = comment.toLowerCase();

  if (url === "" || lowerUrl === "null" || lowerUrl === "undefined" || url === "404") {
    return false;
  }

  // 3. Validación de Contenido (Placeholder / Errores del Proveedor)
  const rejectKeywords = [
    "no imagery",
    "sorry, we have no imagery",
    "placeholder",
    "error",
    "unavailable"
  ];

  for (const keyword of rejectKeywords) {
    if (lowerUrl.includes(keyword) || lowerComment.includes(keyword)) {
      return false;
    }
  }

  // 4. Validación de Tipo de Recurso (Evitar Mapas / Tiles / GIS)
  // Excepción legítima: Si contiene "cbk" o "streetview" o "google-streetview", es un dominio real de Street View
  const isLegitStreetViewDomain = lowerUrl.includes("cbk") || lowerUrl.includes("streetview") || lowerUrl.includes("google-streetview");

  if (!isLegitStreetViewDomain) {
    const mapKeywords = [
      "map image",
      "poi",
      "roads",
      "labels",
      "map",
      "gis",
      "tile",
      "carto",
      "screenshot"
    ];

    for (const keyword of mapKeywords) {
      if (lowerUrl.includes(keyword) || lowerComment.includes(keyword)) {
        return false;
      }
    }
  }

  return true;
}
