export interface Coordinate {
  lat: number;
  lng: number;
}

export class SpatialLayerEngine {
  /**
   * Computes the Haversine distance between two coordinates in meters.
   */
  static getDistance(p1: Coordinate, p2: Coordinate): number {
    const R = 6371000; // Earth radius in meters
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(p2.lat - p1.lat);
    const dLng = toRad(p2.lng - p1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(p1.lat)) *
        Math.cos(toRad(p2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Evaluates if a point is inside a polygon using the Ray-Casting algorithm.
   */
  static isPointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
    if (polygon.length < 3) return false;
    const x = point.lng, y = point.lat;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Computes the shortest distance in meters from a point to a segment.
   */
  static distToSegment(p: Coordinate, v: Coordinate, w: Coordinate): number {
    const l2 = this.getDistance(v, w);
    if (l2 === 0) return this.getDistance(p, v);
    
    // Calculate projection factor t
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.lng - v.lng) * (w.lng - v.lng) + (p.lat - v.lat) * (w.lat - v.lat)) /
          (Math.pow(w.lng - v.lng, 2) + Math.pow(w.lat - v.lat, 2))
      )
    );
    
    const projection = {
      lat: v.lat + t * (w.lat - v.lat),
      lng: v.lng + t * (w.lng - v.lng)
    };
    return this.getDistance(p, projection);
  }

  /**
   * Computes the shortest distance in meters from a point to a polyline.
   */
  static distToPolyline(point: Coordinate, path: Coordinate[]): number {
    if (path.length < 2) return Infinity;
    let minDist = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const dist = this.distToSegment(point, path[i], path[i + 1]);
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  }

  /**
   * Generates intersections of coordinates with active user shapes.
   * e.g. checking if a point is within buffer (radial circle) or corridor (polyline with buffer).
   */
  static intersectsShape(
    point: Coordinate,
    shape: { tipo: "poligono" | "corredor" | "buffer"; puntos: Coordinate[]; radio?: number }
  ): boolean {
    if (shape.tipo === "poligono") {
      return this.isPointInPolygon(point, shape.puntos);
    } else if (shape.tipo === "corredor") {
      // 100 meters corridor width by default
      return this.distToPolyline(point, shape.puntos) <= 100;
    } else if (shape.tipo === "buffer") {
      const radius = shape.radio || 300;
      return this.getDistance(point, shape.puntos[0]) <= radius;
    }
    return false;
  }
}
