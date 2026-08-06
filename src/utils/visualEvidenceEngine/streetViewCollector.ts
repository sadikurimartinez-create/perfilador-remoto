import { VisualEvidenceInternal } from "./models/visualEvidenceTypes";
import { isValidStreetViewImage } from "../streetViewValidator";

export class StreetViewCollector {
  /**
   * Obtiene hasta 30 candidatos de imágenes Street View en el área del proyecto.
   */
  static collect(
    rawImages: any[],
    projectLat: number,
    projectLng: number,
    radiusMeters: number
  ): VisualEvidenceInternal[] {
    const collected: VisualEvidenceInternal[] = [];

    // Filtrar candidatos explícitos que representen Street View
    const svRaw = rawImages.filter(
      img => {
        const matchesSv = img.evidenceOrigin === "REMOTE" ||
          img.evidenceCategoryClass === "REMOTE_VISUAL" ||
          img.evidenceCategoryClass === "REMOTE_STREET_VIEW" ||
          img.tipo === "REMOTE_STREET_VIEW" ||
          img.tipo?.toLowerCase().includes("street") ||
          img.url?.toLowerCase().includes("street") ||
          img.comentario?.toLowerCase().includes("street") ||
          img.description?.toLowerCase().includes("street") ||
          img.evidenceType === "VIRTUAL_STREET_VIEW" ||
          img.fuente === "Google Street View";
        return matchesSv && isValidStreetViewImage(img);
      }
    );

    // Mapear cada uno a VisualEvidenceInternal
    for (let i = 0; i < svRaw.length; i++) {
      const item = svRaw[i];
      collected.push({
        id: item.id || `candidate-sv-${i}`,
        source: "STREET_VIEW",
        image: item.previewUrl || item.url || "",
        category: item.streetViewCategory ? item.streetViewCategory.toUpperCase().replace(/_/g, " ") : "VULNERABILIDAD_FISICA",
        observation: item.comentario || item.description || "Punto de observación de entorno vial.",
        riskLevel: (item.riskLevel || "MEDIO").toUpperCase() as any,
        lat: item.lat || projectLat,
        lng: item.lng || projectLng,
        capturedAt: item.createdAt || new Date().toLocaleDateString("es-MX")
      });
    }

    // Si no hay candidatos específicos pero existen fotos generales, podemos admitir algunas como candidatos de barrido secundario
    if (collected.length === 0) {
      const nonSvRaw = rawImages.filter(
        img =>
          !(img.tipo?.toLowerCase().includes("street") ||
            img.url?.toLowerCase().includes("street") ||
            img.comentario?.toLowerCase().includes("street") ||
            img.description?.toLowerCase().includes("street"))
      );
      for (let i = 0; i < Math.min(nonSvRaw.length, 10); i++) {
        const item = nonSvRaw[i];
        collected.push({
          id: `virtual-sv-${i}`,
          source: "STREET_VIEW",
          image: item.previewUrl || item.url || "",
          category: "ANALISIS_VIAL",
          observation: item.comentario || item.description || "Punto vial analizado virtualmente.",
          riskLevel: "MEDIO",
          lat: item.lat || projectLat + (i * 0.0001),
          lng: item.lng || projectLng + (i * 0.0001),
          capturedAt: item.createdAt || new Date().toLocaleDateString("es-MX")
        });
      }
    }

    // Retornar máximo 30 candidatos
    return collected.slice(0, 30);
  }
}
