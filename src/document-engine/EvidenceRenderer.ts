export interface FormattedEvidence {
  id: string;
  image: string;
  title: string;
  source: string;
  location: string;
  description: string;
}

export class EvidenceRenderer {
  static formatEvidence(evidence: any): FormattedEvidence | null {
    const img = evidence.image || evidence.file_url || evidence.archivo_url;
    if (!img) return null; // Regla de Oro: Si no existe imagen, omitir el bloque (no dejar espacios vacíos)

    return {
      id: evidence.id || "ev-doc",
      image: img,
      title: evidence.title || evidence.filename || "Evidencia Fotográfica",
      source: evidence.source || "Gabinete CEIPOL",
      location: `LAT: ${evidence.coordenadas?.lat || evidence.latitude || 0} / LNG: ${evidence.coordenadas?.lng || evidence.longitude || 0}`,
      description: evidence.descripcion || evidence.comentario || "Sin descripción adicional de campo.",
    };
  }
}
