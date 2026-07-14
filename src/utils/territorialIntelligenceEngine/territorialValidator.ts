import { TerritorialEvidenceMatrix } from "./models/territorialEvidenceTypes";

export class TerritorialValidator {
  /**
   * TEST 5: Validar que no existan fugas de coordenadas numéricas hacia Word o PDF
   * Retorna true si está libre de leaks, false si encuentra filtraciones.
   */
  public static validateEditorialSanitization(text: string): { isValid: boolean; error?: string } {
    const geoLeakRegex = /\b\d{1,3}\.\d{5,8}\b|\b-\d{1,3}\.\d{5,8}\b|lat:|lng:|coordinates:/gi;
    const matches = text.match(geoLeakRegex);
    if (matches && matches.length > 0) {
      return {
        isValid: false,
        error: `ACE FAILED: Fuga de coordenadas o identificadores geográficos detectados en capa editorial: ${matches.join(", ")}`
      };
    }
    return { isValid: true };
  }

  /**
   * TEST 4: Validar regla "Territorio no criminalizado"
   * Lanza advertencias (ACE WARNING) si Vertex AI utiliza términos prohibidos sin sustento.
   */
  public static validateVisualInference(text: string): { isValid: boolean; warning?: string } {
    const criminalizingTerms = [
      "zona criminal",
      "territorio controlado",
      "punto de venta",
      "área dominada",
      "zona de operación delictiva",
      "punto de asalto"
    ];

    const detected = criminalizingTerms.filter(term => text.toLowerCase().includes(term));
    if (detected.length > 0) {
      return {
        isValid: false,
        warning: `ACE WARNING: El texto utiliza terminología de criminalización espacial no fundamentada: ${detected.join(", ")}`
      };
    }
    return { isValid: true };
  }

  /**
   * TEST 6: Validar que la TEM esté completa y estructurada
   * Lanza WARNING si le faltan campos esenciales.
   */
  public static validateCompleteness(tem: TerritorialEvidenceMatrix): { isValid: boolean; warning?: string } {
    if (
      !tem.urbanStructure ||
      !tem.urbanStructure.landUse ||
      !tem.urbanStructure.streetGridType ||
      !tem.territorialPressure ||
      tem.confidence.operationalConfidence === 0
    ) {
      return {
        isValid: false,
        warning: "ACE WARNING: La Territorial Evidence Matrix (TEM) está incompleta o carece de confianza operativa calculada."
      };
    }
    return { isValid: true };
  }

  /**
   * TEST 3: Relación entre hotspots (SEM) y atractores.
   * Valida que al menos un atractor esté a una distancia razonable (< 200m) de los hotspots de la SEM.
   */
  public static validateHotspotRelationship(tem: TerritorialEvidenceMatrix): boolean {
    if (tem.economicAttractors.length === 0) return false;
    return tem.economicAttractors.some(a => a.distanceToHotspotMeters < 200);
  }
}
