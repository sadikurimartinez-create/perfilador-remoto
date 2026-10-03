import 'server-only';
import type { CanonicalProjectGeography } from '../utils/canonicalProjectGeography';
import { serializeCanonicalGeographyForFirestore } from '../utils/canonicalProjectGeography';
import { readScinceCanonicalGeography } from '../utils/scinceQueryGeometry';
import type { ScinceAnalysisArea, ScinceRadiusConfiguration } from '../types/scinceAnalysisArea';

/** All distance calculations are in a local metric WGS84 projection, never in angular degrees.
 * Full original WGS84 geometry containment is checked after inverse projection/serialization.
 * Unsupported extents fail closed; no silent projection fallback or geometry repair. */
export const SCINCE_ANALYSIS_AREA_SQL = `
WITH source AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) AS geom),
anchor AS (SELECT geom, ST_Centroid(ST_Envelope(geom)) AS anchor FROM source),
projected AS (SELECT geom,
 '+proj=aeqd +lat_0='||ST_Y(anchor)||' +lon_0='||ST_X(anchor)||' +datum=WGS84 +units=m +no_defs' AS projection FROM anchor),
metric AS (SELECT *, ST_Transform(geom,projection) AS metric_geom FROM projected),
centered AS (SELECT *, CASE GeometryType(geom)
 WHEN 'POINT' THEN metric_geom
 WHEN 'LINESTRING' THEN ST_LineInterpolatePoint(metric_geom,0.5)
 ELSE (ST_MinimumBoundingRadius(metric_geom)).center END AS center FROM metric),
radius AS (SELECT *, ST_MaxDistance(center,metric_geom) AS coverage_radius FROM centered),
buffered AS (SELECT *, coverage_radius+$2::double precision AS analysis_radius,
 (coverage_radius+$2::double precision)/cos(pi()/128) AS construction_radius FROM radius),
area AS (SELECT *, ST_Transform(ST_Buffer(center,construction_radius,'quad_segs=32'),projection,4326) AS analysis_geom FROM buffered),
serialized AS (SELECT *, ST_SetSRID(ST_GeomFromGeoJSON(ST_AsGeoJSON(analysis_geom,15)),4326) AS published_geom FROM area)
SELECT ST_AsGeoJSON(published_geom,15) AS geometry, ST_X(ST_Transform(center,projection,4326)) AS lng,
 ST_Y(ST_Transform(center,projection,4326)) AS lat, coverage_radius,analysis_radius,construction_radius,projection,
 ST_Area(published_geom::geography) AS area_square_meters,
 ST_Covers(published_geom,geom) AS contains_source,
 ST_IsValid(geom) AS source_valid, ST_IsSimple(geom) AS source_simple,
 ST_IsValid(published_geom) AS area_valid, ST_IsEmpty(published_geom) AS area_empty
FROM serialized`;

export function assertScinceProjectionDomain(canonical: CanonicalProjectGeography): void {
  const points: number[][]=[];
  const walk=(v:any):void=>{if(Array.isArray(v) && typeof v[0]==='number') points.push(v); else if(Array.isArray(v)) v.forEach(walk);};
  walk(canonical.geometry.coordinates);
  if (!points.length || points.some(p=>Math.abs(p[1])>80) ||
    Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))>5 ||
    Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))>5) throw new Error('SCINCE_PROJECTION_DOMAIN_UNSUPPORTED');
}

export async function calculateScinceAnalysisArea(client: {query:(...args:any[])=>Promise<any>}, canonical: CanonicalProjectGeography,
  fingerprint: string, config: ScinceRadiusConfiguration): Promise<ScinceAnalysisArea> {
  assertScinceProjectionDomain(canonical);
  const expansion=canonical.type==='INDIVIDUAL'?config.individualBaseRadiusMeters:
    canonical.type==='CORRIDOR'?config.lineContextExpansionMeters:config.polygonContextExpansionMeters;
  const row=(await client.query(SCINCE_ANALYSIS_AREA_SQL,[JSON.stringify(canonical.geometry),expansion])).rows[0];
  if (!row || row.source_valid!==true || row.source_simple!==true || row.contains_source!==true || row.area_valid!==true || row.area_empty!==false)
    throw new Error('SCINCE_ANALYSIS_AREA_CONTAINMENT_FAILED');
  const coverage=Number(row.coverage_radius),radius=Number(row.analysis_radius),construction=Number(row.construction_radius),area=Number(row.area_square_meters);
  if (![coverage,radius,construction,area,row.lat,row.lng].every(Number.isFinite) || coverage<0 || radius<=0 || radius>100000 || area<=0 ||
    Math.abs(radius-coverage-expansion)>1e-7 || Math.abs(construction-radius/Math.cos(Math.PI/128))>1e-7 ||
    canonical.type==='INDIVIDUAL' && coverage!==0 || typeof row.projection!=='string' || !row.projection.startsWith('+proj=aeqd ')) throw new Error('SCINCE_ANALYSIS_AREA_INVALID');
  const derived=readScinceCanonicalGeography({...canonical,type:'POLYGON',geometry:JSON.parse(row.geometry),geographyId:canonical.geographyId+':scince-area'});
  if (!derived || derived.geometry.type!=='Polygon') throw new Error('SCINCE_ANALYSIS_AREA_INVALID');
  return {version:'SCINCE_ANALYSIS_AREA_V1',center:canonical.geometry.type==='Point'?{lat:canonical.geometry.coordinates[1],lng:canonical.geometry.coordinates[0]}:{lat:row.lat,lng:row.lng},coverageRadiusMeters:coverage,contextExpansionMeters:expansion,
    analysisRadiusMeters:radius,constructionRadiusMeters:construction,approximateAreaSquareMeters:area,geometryType:'Polygon',
    geometry:serializeCanonicalGeographyForFirestore(derived)!,sourceGeometryRevision:fingerprint,sourceGeographyId:canonical.geographyId,
    calculationMethod:'LOCAL_AEQD_WGS84_CIRCUMSCRIBED_128_V1',centerMethod:canonical.type==='INDIVIDUAL'?'SOURCE_POINT':canonical.type==='CORRIDOR'?'METRIC_LINE_MIDPOINT':'METRIC_MINIMUM_BOUNDING_CIRCLE',
    projection:row.projection,configuration:structuredClone(config),containmentVerified:true};
}
