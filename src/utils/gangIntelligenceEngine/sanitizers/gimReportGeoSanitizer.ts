/**
 * Capa de Sanitización Geoespacial (GIMReportGeoSanitizer)
 * Responsable de transformar coordenadas tácticas precisas y referencias crudas GPS
 * en referencias geográficas institucionales y descriptivas seguras.
 */
export class GimReportGeoSanitizer {
  /**
   * Transforma coordenadas exactas lat/lng decimales en una descripción de sector/cuadrante aproximada
   */
  public static approximateLocation(lat: number, lng: number): string {
    if (!lat || !lng) {
      return "Sector perimetral general";
    }

    // Usamos determinismo sencillo basado en cuadrantes sobre el baricentro general
    // lat/lng aproximados para Aguascalientes/Paseos de Aguascalientes como centro de referencia
    const refLat = 21.80929;
    const refLng = -102.26964;

    const diffLat = lat - refLat;
    const diffLng = lng - refLng;

    let sectorVertical = "";
    let sectorHorizontal = "";

    if (Math.abs(diffLat) < 0.001) {
      sectorVertical = "franja central";
    } else {
      sectorVertical = diffLat > 0 ? "sector norte" : "sector sur";
    }

    if (Math.abs(diffLng) < 0.001) {
      sectorHorizontal = "zona media";
    } else {
      sectorHorizontal = diffLng > 0 ? "oriente" : "poniente";
    }

    // Combinación descriptiva aproximada
    if (sectorVertical === "franja central") {
      return `Área perimetral de la franja central (${sectorHorizontal})`;
    }
    return `Cuadrante analítico del ${sectorVertical} (${sectorHorizontal})`;
  }

  /**
   * Sanitiza cualquier cadena de texto que pudiera contener coordenadas numéricas exactas
   * (como "encontrado en 21.809, -102.269") o nombres sensibles
   */
  public static sanitizeDescription(text: string): string {
    if (!text) return "";

    // Expresión regular para buscar coordenadas GPS como decimal, decimal (ej: 21.8092, -102.2696)
    const coordRegex = /-?\d+\.\d{3,}\s*,\s*-?\d+\.\d{3,}/g;

    let sanitized = text;

    if (coordRegex.test(text)) {
      sanitized = sanitized.replace(coordRegex, "[Coordenadas Sanitizadas por Seguridad Operativa]");
    }

    // Eliminar posibles referencias numéricas explícitas de GPS
    const altCoordRegex = /lat(?:itude)?:\s*-?\d+\.\d+|long?(?:itude)?:\s*-?\d+\.\d+/gi;
    if (altCoordRegex.test(sanitized)) {
      sanitized = sanitized.replace(altCoordRegex, "[Ubicación Sanitizada]");
    }

    return sanitized;
  }
}
