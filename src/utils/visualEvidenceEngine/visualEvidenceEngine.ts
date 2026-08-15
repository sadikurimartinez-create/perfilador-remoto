import { VisualEvidenceInternal, VisualEvidenceMatrix } from "./models/visualEvidenceTypes";
import { resolveImageExtension } from "../documentEvidenceIntegrationEngine";
import { StreetViewCollector } from "./streetViewCollector";
import { StreetViewAnalyzer } from "./streetViewAnalyzer";
import { StreetViewSelector } from "./streetViewSelector";
import { GraffitiDetector } from "./graffitiDetector";
import { VisualEvidenceBuilder } from "./visualEvidenceBuilder";

export class VisualEvidenceEngine {
  /**
   * Procesa de extremo a extremo la matriz de evidencia visual operacional.
   */
  static process(
    projectId: string,
    rawPhotos: any[],
    projectLat: number,
    projectLng: number,
    radiusMeters: number,
    hotspots: any[]
  ): VisualEvidenceMatrix {
    // Regla determinística del Evidence Governance Engine: Pre-normalizar capturas de Street View
    const normalizedRawPhotos = (rawPhotos || []).map(p => {
      if (!p) return p;

      // Determinar clase de categoría y tipo de proveedor de fuente
      const isStreetView = p.tipo === "REMOTE_STREET_VIEW" || p.tipo === "STREET_VIEW" || p.isStreetView;
      const isPhotoField = p.tipo === "PHOTO_FIELD" || p.tipo === "PHOTO" || p.category === "VULNERABILIDAD_FISICA" || p.classification === "PHOTO_FIELD";

      let resolvedImage = p.previewUrl || p.dataUrl || p.imageUrl || p.url || p.capturaPanoramica || p.panoramaUrl || p.streetViewMetadata?.staticUrl || "";

      // Solo realizamos resolución de extensión para recursos de imagen reales (REMOTE_VISUAL o PHOTO_FIELD)
      if (isStreetView || isPhotoField || p.evidenceCategoryClass === "REMOTE_VISUAL" || p.evidenceCategoryClass === "PHOTO_FIELD") {
        if (resolvedImage && typeof resolvedImage === "string") {
          const extension = resolveImageExtension(p.mimeType, resolvedImage, p.buffer);
          if (resolvedImage.includes(".undefined")) {
            console.warn(`[AUDITORÍA VISUAL ENGINE] Corrigiendo URL con extensión inválida .undefined para ID: ${p.id}`);
            resolvedImage = resolvedImage.replace(".undefined", extension);
          }
        }
      }

      if (isStreetView) {
        return {
          ...p,
          tipo: "REMOTE_STREET_VIEW",
          category: "STREET_VIEW",
          classification: "REMOTE_VISUAL",
          evidenceCategoryClass: "REMOTE_VISUAL",
          sourceProvider: "GOOGLE_STREET_VIEW",
          isStreetView: true,
          previewUrl: resolvedImage,
          dataUrl: resolvedImage,
          imageUrl: resolvedImage,
          url: resolvedImage
        };
      }
      return p;
    });

    // 1. Clasificar y mapear las fotos del analista (sin límites)
    const analystInternal: VisualEvidenceInternal[] = normalizedRawPhotos
      .filter(p => !p.tipo?.toLowerCase().includes("street") && !p.url?.toLowerCase().includes("street"))
      .map((p, idx) => {
        let category = "VULNERABILIDAD_FISICA";
        const comment = (p.comentario || p.description || "").toLowerCase();

        if (
          comment.includes("iluminacion") ||
          comment.includes("luz") ||
          comment.includes("alumbrado") ||
          comment.includes("oscur")
        ) {
          category = "ALUMBRADO_PUBLICO";
        } else if (
          comment.includes("barda") ||
          comment.includes("cerca") ||
          comment.includes("muro") ||
          comment.includes("cerramien")
        ) {
          category = "CERRAMIENTOS_DEFICIENTES";
        } else if (
          comment.includes("baldio") ||
          comment.includes("lote") ||
          comment.includes("abandon")
        ) {
          category = "PREDIOS_ABANDONADOS";
        } else if (
          comment.includes("grafiti") ||
          comment.includes("graffiti") ||
          comment.includes("rayone") ||
          comment.includes("pinta")
        ) {
          category = "GRAFITI_TERRITORIAL";
        } else if (
          comment.includes("maleza") ||
          comment.includes("vegetac") ||
          comment.includes("basura") ||
          comment.includes("arbol")
        ) {
          category = "ZONAS_DE_OCULTAMIENTO";
        }

        return {
          id: p.id || `analyst-photo-${idx}`,
          source: "ANALYST",
          image: p.previewUrl || p.url || "",
          category,
          observation: p.comentario || p.description || "Evidencia fotográfica de campo.",
          riskLevel: (p.riskLevel || "medio").toUpperCase() as any,
          lat: p.lat || projectLat,
          lng: p.lng || projectLng,
          capturedAt: p.createdAt || p.fecha || new Date().toLocaleDateString("es-MX")
        };
      });

    // 2. Ejecutar barrido Street View (Collector -> Analyzer -> Selector)
    const svCandidates = StreetViewCollector.collect(rawPhotos, projectLat, projectLng, radiusMeters);
    const svAnalyzed = StreetViewAnalyzer.analyze(svCandidates);
    const svSelected = StreetViewSelector.select(svAnalyzed, hotspots);

    // 3. Ejecutar detector de grafitis territorial (Analista + Street View)
    const allInternal = [...analystInternal, ...svAnalyzed];
    const graffitiResult = GraffitiDetector.detect(allInternal);

    // 4. Construir capas editoriales 100% libres de coordenadas geográficas
    const analystPhotosEditorial = analystInternal.map((p, idx) =>
      VisualEvidenceBuilder.buildEditorial(p, idx)
    );
    const streetViewEditorial = svSelected.map((s, idx) =>
      VisualEvidenceBuilder.buildEditorial(s, idx)
    );
    const graffitiEditorial = graffitiResult.graffitiEvidence.map((g, idx) =>
      VisualEvidenceBuilder.buildEditorial(g, idx)
    );

    // 5. Contar vulnerabilidades críticas
    const criticalVulnerabilityCount = allInternal.filter(
      e => e.riskLevel === "CRITICO" || e.riskLevel === "ALTO"
    ).length;

    // Determinar factor prevaleciente
    const catCounts: { [key: string]: number } = {};
    for (const e of allInternal) {
      catCounts[e.category] = (catCounts[e.category] || 0) + 1;
    }
    let primaryRiskFactor = "DETERIORO_URBANO_GENERAL";
    let maxCount = 0;
    for (const cat of Object.keys(catCounts)) {
      if (catCounts[cat] > maxCount) {
        maxCount = catCounts[cat];
        primaryRiskFactor = cat;
      }
    }

    // 6. Generar Sección 5.6: Matriz Ejecutiva de Hallazgos Visuales
    const matrix56: { evidenceType: string; finding: string; impact: string }[] = [];

    if (analystPhotosEditorial.length > 0) {
      matrix56.push({
        evidenceType: "Inspección de Campo (Analista)",
        finding: analystPhotosEditorial[0].finding,
        impact: analystPhotosEditorial[0].operationalImpact
      });
    }

    if (streetViewEditorial.length > 0) {
      matrix56.push({
        evidenceType: "Barrido Virtual (Street View)",
        finding: streetViewEditorial[0].finding,
        impact: streetViewEditorial[0].operationalImpact
      });
    }

    if (graffitiResult.isActive && graffitiEditorial.length > 0) {
      matrix56.push({
        evidenceType: "Grafitis Territoriales",
        finding: graffitiEditorial[0].finding,
        impact: graffitiEditorial[0].operationalImpact
      });
    }

    // Síntesis inicial (Ground Abstract)
    const friendlyRisk = primaryRiskFactor.replace(/_/g, " ").toLowerCase();
    const executiveAbstract = `El análisis táctico visual de campo documenta fallas físicas de tipo ${friendlyRisk} que disminuyen la visibilidad e incrementan la permeabilidad física del polígono, facilitando la delincuencia de oportunidad por pérdida de control territorial.`;

    return {
      projectId,
      overallVisualConfidence: 100,
      analystPhotos: analystPhotosEditorial,
      streetViewEvidence: streetViewEditorial,
      graffitiEvidence: graffitiResult.isActive ? graffitiEditorial : [],
      territorialFindings: {
        criticalVulnerabilityCount,
        primaryRiskFactor,
        impactAreaSqm: Math.round(radiusMeters * radiusMeters * Math.PI)
      },
      executiveAbstract,
      matrix56
    };
  }
}
export default VisualEvidenceEngine;
