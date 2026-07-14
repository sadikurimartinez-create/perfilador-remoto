import { VisualEvidenceEditorial } from "../visualEvidenceEngine/models/visualEvidenceTypes";
import { GraffitiTerritorialEvidence } from "./models/gangIntelligenceTypes";

export class GraffitiTerritorialAnalyzer {
  /**
   * Interpreta evidencias visuales de grafiti previamente catalogadas por el VEE.
   * NO procesa archivos JPG, no hace OCR ni llama APIs de visión. Lee metadatos editoriales.
   */
  public static analyze(
    veeGraffiti: VisualEvidenceEditorial[],
    projectLat: number,
    projectLng: number
  ): GraffitiTerritorialEvidence[] {
    const analyzedGraffiti: GraffitiTerritorialEvidence[] = [];

    veeGraffiti.forEach((item, index) => {
      // 1. Detección simplificada y no criminalizante de simbología en comentarios editoriales
      let symbologyMatch = "Pinta / Grafiti de oportunidad";
      let detectedGangName = "Grupo Local No Identificado";

      const textToScan = `${item.title} ${item.description} ${item.finding}`.toLowerCase();

      if (textToScan.includes("13") || textToScan.includes("sur")) {
        symbologyMatch = "Tag compatible con facción 13";
        detectedGangName = "Facción Sureña";
      } else if (textToScan.includes("18") || textToScan.includes("dieciocho")) {
        symbologyMatch = "Tag compatible con facción 18";
        detectedGangName = "Facción Dieciocho";
      } else if (textToScan.includes("clika") || textToScan.includes("clica")) {
        symbologyMatch = "Tag compatible con agrupación barrial";
        detectedGangName = "Agrupación Barrial Local";
      }

      // Determinar nivel de riesgo de forma conservadora
      let riskLevel: "ALTO" | "MEDIO" | "BAJO" | "NO_DETERMINADO" = "BAJO";
      if (textToScan.includes("amenaza") || textToScan.includes("rivalidad")) {
        riskLevel = "MEDIO";
      }

      analyzedGraffiti.push({
        id: `gim-graf-${index + 1}`,
        veeReferenceId: `vee-photo-${index + 1}`, // Referencia de trazabilidad hacia VEE
        symbologyMatch,
        detectedGangName,
        riskLevel,
        confidence: "MEDIUM", // Confianza moderada obligatoria (indicio ambiental secundario)
        coordinates: { lat: projectLat, lng: projectLng } // Utiliza las coordenadas perimetrales del proyecto
      });
    });

    return analyzedGraffiti;
  }
}
