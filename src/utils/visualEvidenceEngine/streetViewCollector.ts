import { VisualEvidenceInternal } from "./models/visualEvidenceTypes";
import { isValidStreetViewImage } from "../streetViewValidator";

function upper(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function hasStreetViewProvenance(image: any): boolean {
  if (!image || typeof image !== "object") return false;

  const type = upper(image.tipo);
  const provider = upper(image.sourceProvider);
  const metadata = image.streetViewMetadata;
  return type === "STREET_VIEW" || type === "REMOTE_STREET_VIEW" || type === "STREETVIEW" ||
    upper(image.evidenceType) === "VIRTUAL_STREET_VIEW" ||
    upper(image.gpsSource) === "STREET_VIEW" ||
    upper(image.analysisType) === "STREET_VIEW" ||
    provider === "GOOGLE_STREET_VIEW" ||
    upper(image.source) === "GOOGLE_STREET_VIEW" ||
    upper(image.fuente) === "GOOGLE STREET VIEW" ||
    upper(image.streetViewSource) === "GOOGLE STREET VIEW" ||
    upper(metadata?.provider) === "GOOGLE_STREET_VIEW" ||
    upper(metadata?.provider) === "GOOGLE STREET VIEW" ||
    Boolean(metadata?.panoId || image.panoramaId);
}

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
    const svRaw = rawImages.filter(img => hasStreetViewProvenance(img) && isValidStreetViewImage(img));

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

    // Retornar máximo 30 candidatos
    return collected.slice(0, 30);
  }
}
