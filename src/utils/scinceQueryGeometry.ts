import { deserializeCanonicalGeographyFromFirestore, type CanonicalProjectGeography } from './canonicalProjectGeography';

export const SCINCE_MAX_POSITIONS = 10000;
/** Reject raw numeric/coercion/drop/repair hazards before the shared deserializer. */
export function readScinceCanonicalGeography(raw: unknown): CanonicalProjectGeography | null {
  try {
    const r = raw as any;
    if (!r || r.validationStatus !== 'VALID' || typeof r.geographyId !== 'string' || !r.geographyId.trim()) return null;
    const point = (p: any) => {
      if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') throw new Error('NUMERIC');
      return [p.lng, p.lat];
    };
    const g = r.geometry;
    if (!g) return null;
    const coordinates = g.coordinates ?? (g.type === 'Point' ? point(g.point) : g.type === 'LineString' ? g.points.map(point) :
      g.type === 'Polygon' ? g.rings.map((ring: any) => ring.points.map(point)) :
      g.polygons.map((p: any) => p.rings.map((ring: any) => ring.points.map(point))));
    let positions = 0;
    const pos = (p: any): boolean => {
      positions++;
      return Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && Number.isFinite(v)) &&
        Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
    };
    const eq = (a: any, b: any) => a[0] === b[0] && a[1] === b[1];
    const ring = (v: any) => Array.isArray(v) && v.length >= 4 && v.every(pos) && eq(v[0], v[v.length-1]) &&
      new Set(v.slice(0,-1).map((p: any) => JSON.stringify(p))).size >= 3;
    const polygon = (v: any) => Array.isArray(v) && v.length > 0 && v.every(ring);
    const valid = r.type === 'INDIVIDUAL' && g.type === 'Point' ? pos(coordinates) :
      r.type === 'CORRIDOR' && g.type === 'LineString' ? Array.isArray(coordinates) && coordinates.length >= 2 && coordinates.every(pos) &&
        new Set(coordinates.map((p: any) => JSON.stringify(p))).size === coordinates.length :
      r.type === 'POLYGON' && g.type === 'Polygon' ? polygon(coordinates) :
      r.type === 'POLYGON' && g.type === 'MultiPolygon' ? Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(polygon) : false;
    if (!valid || positions > SCINCE_MAX_POSITIONS) return null;
    if (r.type !== 'INDIVIDUAL' && JSON.stringify(coordinates).includes('[0,0]')) return null;
    const original = { ...r, geometry: { type: g.type, coordinates } };
    const canonical = deserializeCanonicalGeographyFromFirestore(original);
    if (!canonical || canonical.validationStatus !== 'VALID' || JSON.stringify(canonical.geometry.coordinates) !== JSON.stringify(coordinates)) return null;
    return canonical;
  } catch { return null; }
}
