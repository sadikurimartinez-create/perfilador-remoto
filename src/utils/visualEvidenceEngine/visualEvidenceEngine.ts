import { VisualEvidenceInternal, VisualEvidenceMatrix } from "./models/visualEvidenceTypes";
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
    // 1. Clasificar y mapear las fotos del analista (sin límites)
    const analystInternal: VisualEvidenceInternal[] = rawPhotos
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
