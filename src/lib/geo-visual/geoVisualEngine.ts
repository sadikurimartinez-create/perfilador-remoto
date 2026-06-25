import { IRICellResult } from "../iri/iriEngine";
import { GeoEvent } from "../iri/operations/iriEventEngine";

export interface VisualCellRepresentation {
  id: string;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  centroid: [number, number];
  score: number;
  color: string;
  fillOpacity: number;
  isPulsing: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH" | "CRITICAL";
}

export interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number;
  color: string;
}

export interface StandardizedVisualPacket {
  cells: VisualCellRepresentation[];
  events: GeoEvent[];
  heatmap: HeatPoint[];
  iri_updates: { cellId: string; newScore: number; color: string; timestamp: string }[];
  timestamp: string;
}

export class GeoVisualEngine {
  /**
   * PONDERA EL COLOR Y LAS PROPIEDADES DE RENDERIZADO BASADO EN EL SISTEMA DE COLORES OBLIGATORIO:
   * 0.00–0.20 → verde
   * 0.21–0.40 → amarillo
   * 0.41–0.60 → naranja
   * 0.61–0.80 → rojo
   * 0.81–1.00 → rojo pulsante
   */
  public getColorForIri(score: number): { color: string; isPulsing: boolean; opacity: number } {
    if (score <= 0.20) {
      return { color: "#22c55e", isPulsing: false, opacity: 0.35 }; // Verde suave
    } else if (score <= 0.40) {
      return { color: "#eab308", isPulsing: false, opacity: 0.45 }; // Amarillo táctico
    } else if (score <= 0.60) {
      return { color: "#f97316", isPulsing: false, opacity: 0.55 }; // Naranja operativo
    } else if (score <= 0.80) {
      return { color: "#ef4444", isPulsing: false, opacity: 0.65 }; // Rojo peligro
    } else {
      return { color: "#dc2626", isPulsing: true, opacity: 0.80 }; // Rojo crítico pulsante
    }
  }

  /**
   * Representación visual estandarizada para cada celda de riesgo.
   */
  public prepareVisualCells(cells: IRICellResult[]): VisualCellRepresentation[] {
    return cells.map((cell) => {
      const { color, isPulsing, opacity } = this.getColorForIri(cell.iri_score);
      return {
        id: cell.id,
        geometry: cell.geometry,
        centroid: cell.centroid,
        score: cell.iri_score,
        color,
        fillOpacity: opacity,
        isPulsing,
        riskLevel: cell.risk_level,
      };
    });
  }

  /**
   * MOTOR DE HEATMAP DINÁMICO
   * Genera interpolación espacial suavizada utilizando el método Inverse Distance Weighting (IDW)
   * con un Kernel Gaussian para aproximar densidad suave (Kernel Density Estimation feeling).
   */
  public generateDynamicHeatmap(
    cells: IRICellResult[],
    bbox: [number, number, number, number],
    gridSteps = 15
  ): HeatPoint[] {
    if (cells.length === 0) return [];

    const [minLat, minLng, maxLat, maxLng] = bbox;
    const latStep = (maxLat - minLat) / gridSteps;
    const lngStep = (maxLng - minLng) / gridSteps;
    const heatmapPoints: HeatPoint[] = [];

    // Factor de suavizado (Bandwidth) para el Kernel
    const bandwidth = Math.max(latStep, lngStep) * 1.5;

    for (let i = 0; i <= gridSteps; i++) {
      const currentLat = minLat + i * latStep;
      for (let j = 0; j <= gridSteps; j++) {
        const currentLng = minLng + j * lngStep;

        let totalWeight = 0;
        let weightedSum = 0;

        // Calcular la interpolación espacial suavizada basada en la distancia a cada celda conocida
        for (const cell of cells) {
          const [cellLat, cellLng] = cell.centroid;
          
          // Distancia euclidiana aproximada
          const dist = Math.sqrt(
            Math.pow(currentLat - cellLat, 2) + Math.pow(currentLng - cellLng, 2)
          );

          // Gaussian Kernel Weighting Function: K(x) = exp(-0.5 * (x / h)^2)
          const weight = Math.exp(-0.5 * Math.pow(dist / bandwidth, 2));

          totalWeight += weight;
          weightedSum += cell.iri_score * weight;
        }

        const interpolatedIntensity = totalWeight > 0 ? weightedSum / totalWeight : 0;

        // Sólo registramos puntos con riesgo o intensidad significativos para optimizar performance
        if (interpolatedIntensity > 0.10) {
          const { color } = this.getColorForIri(interpolatedIntensity);
          heatmapPoints.push({
            lat: currentLat,
            lng: currentLng,
            intensity: interpolatedIntensity,
            color,
          });
        }
      }
    }

    return heatmapPoints;
  }

  /**
   * Consolida el paquete de streaming unificado asegurando la sincronía de capas:
   * IRI Grid Layer ↔ Event Overlay ↔ Heatmap Layer
   */
  public assembleStreamingPacket(
    cellResults: IRICellResult[],
    activeEvents: GeoEvent[],
    bbox: [number, number, number, number]
  ): StandardizedVisualPacket {
    const visualCells = this.prepareVisualCells(cellResults);
    const heatmap = this.generateDynamicHeatmap(cellResults, bbox, 15);

    // Obtener los deltas de actualizaciones asíncronas para refresco de diffs
    const iri_updates = visualCells.map((c) => ({
      cellId: c.id,
      newScore: c.score,
      color: c.color,
      timestamp: new Date().toISOString(),
    }));

    return {
      cells: visualCells,
      events: activeEvents,
      heatmap,
      iri_updates,
      timestamp: new Date().toISOString(),
    };
  }
}
