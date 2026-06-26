/**
 * GangInfluenceEngine - Spatial clustering and territorial influence calculations.
 * Designed for CEIPOL - SSP Aguascalientes.
 */

import { getHaversineDistance } from "./gangGeoSweepEngine";

export interface GISMemberNode {
  member_id: string;
  alias: string;
  gang: string;
  location: {
    lat: number;
    lng: number;
  };
  confidence: number;
  source: "OSINT" | "investigation" | "registry";
  zone_id?: string;
  rol?: string;
  domicilioExacto?: string;
}

export interface InfluenceZone {
  zone_id: string;
  gang: string;
  points: { lat: number; lng: number }[];
  influence_score: number; // density + recurrence + proximity
  intensity: "bajo" | "medio" | "alto";
  memberCount: number;
  density: number;
  recurrence: number;
  proximity: number;
  color: string; // Hex color for mapping
}

export class GangInfluenceEngine {
  /**
   * Performs distance-based DBSCAN clustering on member nodes.
   * Groups nodes belonging to the same gang that are close to each other.
   *
   * @param nodes List of member nodes
   * @param epsilon Distance threshold in meters (default 1500m)
   * @param minPoints Minimum points to form a cluster (default 2)
   */
  static clusterMembers(
    nodes: GISMemberNode[],
    epsilon: number = 1500,
    minPoints: number = 2
  ): { [gang: string]: GISMemberNode[][] } {
    const gangClusters: { [gang: string]: GISMemberNode[][] } = {};

    // Group nodes by gang first so influence zones are gang-specific
    const gangGroups: { [gang: string]: GISMemberNode[] } = {};
    for (const node of nodes) {
      if (!node.location || typeof node.location.lat !== "number" || typeof node.location.lng !== "number") {
        continue;
      }
      if (!gangGroups[node.gang]) {
        gangGroups[node.gang] = [];
      }
      gangGroups[node.gang].push(node);
    }

    // Apply DBSCAN on each gang's nodes
    for (const gang of Object.keys(gangGroups)) {
      const gangNodes = gangGroups[gang];
      const visited = new Set<string>();
      const clusters: GISMemberNode[][] = [];

      for (let i = 0; i < gangNodes.length; i++) {
        const node = gangNodes[i];
        const nodeId = node.member_id || `node-${gang}-${i}`;

        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        // Find neighbors
        const neighbors = this.findNeighbors(node, gangNodes, epsilon);

        if (neighbors.length >= minPoints) {
          const cluster: GISMemberNode[] = [node];
          const queue = [...neighbors.filter(n => n.member_id !== nodeId)];

          const clusterNodeIds = new Set<string>([nodeId]);

          while (queue.length > 0) {
            const current = queue.shift()!;
            const curId = current.member_id || `node-${gang}-${gangNodes.indexOf(current)}`;

            if (!visited.has(curId)) {
              visited.add(curId);
              const curNeighbors = this.findNeighbors(current, gangNodes, epsilon);
              if (curNeighbors.length >= minPoints) {
                queue.push(...curNeighbors.filter(n => {
                  const nId = n.member_id || `node-${gang}-${gangNodes.indexOf(n)}`;
                  return !visited.has(nId);
                }));
              }
            }

            if (!clusterNodeIds.has(curId)) {
              clusterNodeIds.add(curId);
              cluster.push(current);
            }
          }

          clusters.push(cluster);
        }
      }

      gangClusters[gang] = clusters;
    }

    return gangClusters;
  }

  private static findNeighbors(
    target: GISMemberNode,
    allNodes: GISMemberNode[],
    epsilon: number
  ): GISMemberNode[] {
    const neighbors: GISMemberNode[] = [];
    for (const node of allNodes) {
      const dist = getHaversineDistance(target.location, node.location);
      if (dist <= epsilon) {
        neighbors.push(node);
      }
    }
    return neighbors;
  }

  /**
   * Generates a Convex Hull (Jarvis March) around a set of coordinates.
   */
  static getConvexHull(points: { lat: number; lng: number }[]): { lat: number; lng: number }[] {
    if (points.length < 3) return points;

    // Find leftmost point (lowest lng)
    let leftmostIdx = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].lng < points[leftmostIdx].lng) {
        leftmostIdx = i;
      }
    }

    const hull: { lat: number; lng: number }[] = [];
    let p = leftmostIdx;
    let q: number;

    do {
      hull.push(points[p]);
      q = (p + 1) % points.length;

      for (let i = 0; i < points.length; i++) {
        // If i is more counterclockwise than q with respect to p
        if (this.getOrientation(points[p], points[i], points[q]) === 2) {
          q = i;
        }
      }

      p = q;
    } while (p !== leftmostIdx && hull.length < points.length + 1);

    return hull;
  }

  private static getOrientation(
    p: { lat: number; lng: number },
    q: { lat: number; lng: number },
    r: { lat: number; lng: number }
  ): number {
    const val = (q.lat - p.lat) * (r.lng - q.lng) - (q.lng - p.lng) * (r.lat - q.lat);
    if (val === 0) return 0; // collinear
    return val > 0 ? 1 : 2; // 1: clock, 2: counterclock
  }

  /**
   * Expands 2 points into a 4-point bounding capsule polygon to represent linear territorial control.
   */
  static expandLineToPolygon(
    p1: { lat: number; lng: number },
    p2: { lat: number; lng: number },
    offset: number = 0.0015
  ): { lat: number; lng: number }[] {
    const dy = p2.lat - p1.lat;
    const dx = p2.lng - p1.lng;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len === 0) {
      return [
        { lat: p1.lat + offset, lng: p1.lng + offset },
        { lat: p1.lat + offset, lng: p1.lng - offset },
        { lat: p1.lat - offset, lng: p1.lng - offset },
        { lat: p1.lat - offset, lng: p1.lng + offset }
      ];
    }

    const py = -dx / len;
    const px = dy / len;

    return [
      { lat: p1.lat + py * offset, lng: p1.lng + px * offset },
      { lat: p2.lat + py * offset, lng: p2.lng + px * offset },
      { lat: p2.lat - py * offset, lng: p2.lng - px * offset },
      { lat: p1.lat - py * offset, lng: p1.lng - px * offset }
    ];
  }

  /**
   * Smoothes polygon borders slightly to make them look organic/premium.
   */
  static smoothPolygon(points: { lat: number; lng: number }[]): { lat: number; lng: number }[] {
    if (points.length < 3) return points;
    
    const smoothed: { lat: number; lng: number }[] = [];
    const n = points.length;

    // Apply simple Chaikin-like midpoint subdivision for border smoothing
    for (let i = 0; i < n; i++) {
      const curr = points[i];
      const next = points[(i + 1) % n];

      // 1/4 and 3/4 interpolation points
      const p1 = {
        lat: curr.lat * 0.75 + next.lat * 0.25,
        lng: curr.lng * 0.75 + next.lng * 0.25
      };
      const p2 = {
        lat: curr.lat * 0.25 + next.lat * 0.75,
        lng: curr.lng * 0.25 + next.lng * 0.75
      };

      smoothed.push(p1, p2);
    }

    return smoothed;
  }

  /**
   * Calculates the complete spatial influence score and outputs a descriptive Influence Zone.
   *
   * influence_score = density + recurrence + proximity_to_other_nodes
   */
  static calculateInfluenceZone(
    clusterId: string,
    gangName: string,
    clusterNodes: GISMemberNode[],
    historicalActivityFactor: number = 3.0
  ): InfluenceZone | null {
    if (clusterNodes.length < 2) {
      return null; // Must have at least 2 points to generate a zone
    }

    // 1. Calculate Density (nodes per area-proxy or simply raw count weighting)
    const count = clusterNodes.length;
    const densityScore = count * 2.5; // Weight raw density

    // 2. Calculate Recurrence (using provided historical factors or defaults)
    // Gang-level base recurrence based on size & static history
    const recurrenceScore = historicalActivityFactor * 1.8;

    // 3. Calculate Proximity (average distance between all pairs, shorter distance -> higher score)
    let totalDist = 0;
    let pairs = 0;
    for (let i = 0; i < clusterNodes.length; i++) {
      for (let j = i + 1; j < clusterNodes.length; j++) {
        totalDist += getHaversineDistance(clusterNodes[i].location, clusterNodes[j].location);
        pairs++;
      }
    }
    const avgDistMeters = pairs > 0 ? totalDist / pairs : 500;
    // Closer proximity (avgDist <= 1000m) awards up to 10 points
    const proximityScore = Math.max(1, Math.min(15, 15 - (avgDistMeters / 150)));

    // Total Score
    const totalScore = densityScore + recurrenceScore + proximityScore;

    // Map Intensity: bajo (yellow) -> medio (orange) -> alto (red)
    let intensity: "bajo" | "medio" | "alto" = "bajo";
    let color = "#eab308"; // amarillo
    if (totalScore >= 25) {
      intensity = "alto";
      color = "#ef4444"; // rojo
    } else if (totalScore >= 12) {
      intensity = "medio";
      color = "#f97316"; // naranja
    }

    // 4. Generate geometry
    let rawPoints: { lat: number; lng: number }[] = [];
    if (clusterNodes.length === 2) {
      // 2 points: expand line to a rectangle capsule
      rawPoints = this.expandLineToPolygon(clusterNodes[0].location, clusterNodes[1].location, 0.0018);
    } else {
      // 3+ points: compute Convex Hull and smooth
      const coords = clusterNodes.map(n => n.location);
      rawPoints = this.getConvexHull(coords);
    }

    const smoothedPoints = this.smoothPolygon(rawPoints);

    return {
      zone_id: clusterId,
      gang: gangName,
      points: smoothedPoints,
      influence_score: parseFloat(totalScore.toFixed(2)),
      intensity,
      memberCount: count,
      density: parseFloat(densityScore.toFixed(2)),
      recurrence: parseFloat(recurrenceScore.toFixed(2)),
      proximity: parseFloat(proximityScore.toFixed(2)),
      color
    };
  }

  /**
   * Runs the full analytical pipeline to extract all dynamic influence zones from a list of member nodes.
   */
  static generateAllZones(
    nodes: GISMemberNode[],
    epsilon: number = 1800,
    minPoints: number = 2
  ): { zones: InfluenceZone[]; clusteredNodes: GISMemberNode[] } {
    const gangClusters = this.clusterMembers(nodes, epsilon, minPoints);
    const zones: InfluenceZone[] = [];
    const processedNodes: GISMemberNode[] = [];

    let zoneCounter = 1;
    for (const gang of Object.keys(gangClusters)) {
      const clusters = gangClusters[gang];
      for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
        const cluster = clusters[cIdx];
        const zoneId = `zone-${gang.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${zoneCounter++}`;

        // Tag nodes with their zone ID
        const taggedNodes = cluster.map(n => {
          const tagged = { ...n, zone_id: zoneId };
          processedNodes.push(tagged);
          return tagged;
        });

        // Calculate zone
        // Provide a default historical activity factor proportional to gang size
        const histFactor = Math.min(8, 2 + cluster.length * 0.8);
        const zone = this.calculateInfluenceZone(zoneId, gang, taggedNodes, histFactor);
        if (zone) {
          zones.push(zone);
        }
      }
    }

    // For nodes that didn't cluster, keep them as unclustered
    const processedIds = new Set(processedNodes.map(n => n.member_id));
    for (const n of nodes) {
      if (!processedIds.has(n.member_id)) {
        processedNodes.push({ ...n, zone_id: undefined });
      }
    }

    return {
      zones,
      clusteredNodes: processedNodes
    };
  }
}

// Fix typescript compilation warning/error for loop inside generateAllZones
// (Wait, there was a typo "for (let cIdx = 0; iIdx < clusters.length; cIdx++)" -> should be cIdx < clusters.length)
