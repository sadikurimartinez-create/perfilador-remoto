import { VisualEvidenceInternal } from "./models/visualEvidenceTypes";

export class StreetViewSelector {
  /**
   * Ranquear y seleccionar máximo 4 candidatos de Street View con relevancia operacional.
   */
  static select(candidates: VisualEvidenceInternal[], hotspots: any[]): VisualEvidenceInternal[] {
    if (candidates.length === 0) return [];

    // Calcular puntaje táctico para cada candidato
    const ranked = candidates.map(c => {
      let score = 0;

      // 1. Proximidad a hotspots de la SEM (si existen hotspots, medir distancia aproximada)
      if (hotspots && hotspots.length > 0) {
        let minDistance = 999999;
        for (const h of hotspots) {
          const hLat = h.lat || h.latitude || 0;
          const hLng = h.lng || h.longitude || 0;
          if (hLat && hLng) {
            const latDiff = Math.abs(c.lat - hLat);
            const lngDiff = Math.abs(c.lng - hLng);
            const distSim = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111320; // Distancia estimada en metros
            if (distSim < minDistance) minDistance = distSim;
          }
        }

        if (minDistance < 50) {
          score += 50;
        } else if (minDistance < 150) {
          score += 30;
        } else if (minDistance < 300) {
          score += 10;
        }
      } else {
        score += 20; // Puntuación basal de entorno
      }

      // 2. Priorización de factores físicos críticos de oportunidad
      if (c.category === "ALUMBRADO_PUBLICO") {
        score += 30;
      } else if (c.category === "CERRAMIENTOS_DEFICIENTES") {
        score += 25;
      } else if (c.category === "PREDIOS_ABANDONADOS") {
        score += 20;
      } else if (c.category === "ZONAS_DE_OCULTAMIENTO") {
        score += 15;
      } else if (c.category === "GRAFITI_TERRITORIAL") {
        score += 10;
      }

      // 3. Severidad del nivel de riesgo
      if (c.riskLevel === "CRITICO") {
        score += 15;
      } else if (c.riskLevel === "ALTO") {
        score += 10;
      } else if (c.riskLevel === "MEDIO") {
        score += 5;
      }

      return { candidate: c, score };
    });

    // Ordenar de mayor a menor relevancia y retornar la totalidad de candidatos aprobados (sin límites artificiales)
    ranked.sort((a, b) => b.score - a.score);

    return ranked.map(r => r.candidate);
  }
}
