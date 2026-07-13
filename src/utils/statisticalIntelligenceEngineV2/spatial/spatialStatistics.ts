import { StandardCrimeRecord } from "../models/statisticalTypes";

export class SpatialStatistics {
  /**
   * Distancia Haversine en metros entre dos coordenadas geográficas.
   */
  public static calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Ejecuta el análisis espacial avanzado (SSM) delictivo.
   */
  public static analyze(
    records: StandardCrimeRecord[],
    centerLat: number,
    centerLng: number,
    radiusMeters: number
  ) {
    if (records.length === 0) {
      return this.buildEmptyAnalysis();
    }

    // 1. Centro de Gravedad (Mean Center)
    const total = records.length;
    const meanLat = records.reduce((sum, r) => sum + r.lat, 0) / total;
    const meanLng = records.reduce((sum, r) => sum + r.lng, 0) / total;

    // 2. Desviación Estándar Espacial / Standard Distance (en metros)
    let varianceSum = 0;
    records.forEach(r => {
      const dy = (r.lat - meanLat) * 111111;
      const dx = (r.lng - meanLng) * 111111 * Math.cos((meanLat * Math.PI) / 180);
      varianceSum += Math.pow(dx, 2) + Math.pow(dy, 2);
    });
    const dispersionMeters = Math.round(Math.sqrt(varianceSum / total));

    // 3. Entropía Espacial (Concentración vs Dispersión basada en Shannon)
    const { entropy, interpretation } = this.calculateSpatialEntropy(records);

    // 4. Clustering Espacial con DBSCAN (eps = 120 metros, minPts = 2)
    const clusteringResult = this.calculateSpatialClusters(records, 120, 2);

    return {
      centerOfGravity: { lat: parseFloat(meanLat.toFixed(5)), lng: parseFloat(meanLng.toFixed(5)) },
      dispersionMeters,
      spatialEntropy: entropy,
      spatialEntropyInterpretation: interpretation,
      clusters: clusteringResult.clusters,
      hotspots: clusteringResult.hotspots
    };
  }

  /**
   * Implementación de DBSCAN Clustering usando distancia Haversine.
   */
  private static calculateSpatialClusters(
    records: StandardCrimeRecord[],
    epsilonMeters: number,
    minimumPoints: number
  ) {
    const n = records.length;
    const visited = new Set<string>();
    const clusterLabels: Record<string, number> = {}; // record.id -> clusterIndex (0-indexed)
    let clusterCounter = 0;

    for (let i = 0; i < n; i++) {
      const p = records[i];
      if (visited.has(p.id)) continue;

      visited.add(p.id);
      const neighbors = this.findNeighbors(p, records, epsilonMeters);

      if (neighbors.length < minimumPoints) {
        // Marcado temporalmente como ruido (NOISE)
        clusterLabels[p.id] = -1;
      } else {
        const clusterIndex = clusterCounter++;
        clusterLabels[p.id] = clusterIndex;
        
        // Expandir el clúster
        const queue = [...neighbors];
        for (let j = 0; j < queue.length; j++) {
          const q = queue[j];
          
          if (!visited.has(q.id)) {
            visited.add(q.id);
            const qNeighbors = this.findNeighbors(q, records, epsilonMeters);
            if (qNeighbors.length >= minimumPoints) {
              // Añadir vecinos a la cola de expansión
              qNeighbors.forEach(qn => {
                if (!queue.some(x => x.id === qn.id)) {
                  queue.push(qn);
                }
              });
            }
          }
          
          // Si no tiene clúster asignado o fue marcado como ruido
          if (clusterLabels[q.id] === undefined || clusterLabels[q.id] === -1) {
            clusterLabels[q.id] = clusterIndex;
          }
        }
      }
    }

    // Agrupar puntos por clústeres reales (excluyendo ruido -1)
    const clusterPoints: Record<number, StandardCrimeRecord[]> = {};
    records.forEach(r => {
      const label = clusterLabels[r.id];
      if (label !== undefined && label !== -1) {
        if (!clusterPoints[label]) {
          clusterPoints[label] = [];
        }
        clusterPoints[label].push(r);
      }
    });

    // Formatear clústeres y hotspots resultantes
    const clusters: any[] = [];
    const hotspots: any[] = [];

    Object.entries(clusterPoints).forEach(([labelStr, pts]) => {
      const label = parseInt(labelStr, 10);
      const ptsCount = pts.length;
      
      // Calcular centroide del clúster
      const cLat = pts.reduce((sum, p) => sum + p.lat, 0) / ptsCount;
      const cLng = pts.reduce((sum, p) => sum + p.lng, 0) / ptsCount;

      // Calcular radio de dispersión local (distancia máxima al centroide)
      let maxLocalDist = 15;
      pts.forEach(p => {
        const d = this.calculateHaversineDistance(cLat, cLng, p.lat, p.lng);
        if (d > maxLocalDist) maxLocalDist = d;
      });

      // Área en hectáreas: pi * radio_local^2 / 10000
      const areaHectares = (Math.PI * Math.pow(maxLocalDist, 2)) / 10000;
      const densityScore = parseFloat((ptsCount / Math.max(areaHectares, 0.05)).toFixed(2)); // Delitos/Ha

      const clusterId = `cluster-${label + 1}`;
      
      clusters.push({
        id: clusterId,
        center: { lat: parseFloat(cLat.toFixed(5)), lng: parseFloat(cLng.toFixed(5)) },
        pointsCount: ptsCount,
        pointsList: pts.map(p => p.id)
      });

      hotspots.push({
        id: `hotspot-${label + 1}`,
        center: { lat: parseFloat(cLat.toFixed(5)), lng: parseFloat(cLng.toFixed(5)) },
        events: ptsCount,
        densityScore
      });
    });

    // Ordenar hotspots por volumen de delitos descendente
    return {
      clusters,
      hotspots: hotspots.sort((a, b) => b.events - a.events)
    };
  }

  private static findNeighbors(
    center: StandardCrimeRecord,
    records: StandardCrimeRecord[],
    epsilonMeters: number
  ): StandardCrimeRecord[] {
    return records.filter(
      r => this.calculateHaversineDistance(center.lat, center.lng, r.lat, r.lng) <= epsilonMeters
    );
  }

  /**
   * Calcula la entropía espacial de Shannon basándose en un grid geográfico adaptativo.
   */
  private static calculateSpatialEntropy(records: StandardCrimeRecord[]) {
    const lats = records.map(r => r.lat);
    const lngs = records.map(r => r.lng);
    const minLat = Math.min(...lats);
    const minLng = Math.min(...lngs);

    // Tamaño de celda en grados (0.002 ~ 220 metros en lat/lng)
    const cellSize = 0.002;
    const grid: Record<string, number> = {};

    records.forEach(r => {
      const cellX = Math.floor((r.lng - minLng) / cellSize);
      const cellY = Math.floor((r.lat - minLat) / cellSize);
      const key = `${cellX},${cellY}`;
      grid[key] = (grid[key] ?? 0) + 1;
    });

    const N = records.length;
    let entropy = 0;
    Object.values(grid).forEach(count => {
      const p = count / N;
      entropy -= p * Math.log2(p);
    });

    // Normalizar la entropía entre 0 y 1 relative al log2(N)
    const maxPossibleEntropy = Math.log2(Math.max(N, 2));
    const normalizedEntropy = maxPossibleEntropy > 0 ? parseFloat((entropy / maxPossibleEntropy).toFixed(3)) : 0;

    const interpretation: "concentrated" | "distributed" = normalizedEntropy < 0.45 ? "concentrated" : "distributed";

    return {
      entropy: normalizedEntropy,
      interpretation
    };
  }

  private static buildEmptyAnalysis() {
    return {
      centerOfGravity: { lat: 0, lng: 0 },
      dispersionMeters: 0,
      spatialEntropy: 0,
      spatialEntropyInterpretation: "concentrated" as const,
      clusters: [],
      hotspots: []
    };
  }
}
