import 'server-only';
import {createHash} from 'crypto';
import {catalog} from './scinceCatalogCore.cjs';
import {createScinceCompactSnapshotV2,buildScinceCompactProfile,fingerprintScinceCompactObservation,fingerprintScinceCompactColumnOrder,fingerprintScinceCompactIndicatorOrder} from '../utils/scinceCompactSnapshot';
import type {ScinceCompactSnapshotV2,ScinceCompactObservation,ScinceCompactTerritorialUnit} from '../types/scinceCompactSnapshot';
import {readScinceRelease,readScinceObservations} from './scinceObservationRepository';
import {catalogIndicators,buildOfficialBaseProfile2020,isValidOfficialBaseProfile2020} from '../utils/scinceOfficialProfile';
import {readScinceRadiusConfiguration,isValidScinceRadiusConfiguration} from './scinceRadiusConfiguration';
import {calculateScinceAnalysisArea} from './scinceAnalysisArea';
import {fingerprintScinceCanonicalPoint} from '../utils/scinceGeographyBinding';
import {deriveScinceSociodemographicProfile} from '../utils/scinceSociodemographicProfile';
import type {ScinceRadiusConfiguration} from '../types/scinceAnalysisArea';
import { getPool } from './db';
import type { CanonicalProjectGeography } from '../utils/canonicalProjectGeography';
import { serializeCanonicalGeographyForFirestore } from '../utils/canonicalProjectGeography';
import { readScinceCanonicalGeography } from '../utils/scinceQueryGeometry';
import { buildScinceCanonicalCoverage, fingerprintScinceCoverageGeography, scinceCoverageObservationId } from '../utils/scinceCanonicalCoverage';
import { classifyScinceCoverageRelation, validateScinceCoverageGeometry } from '../utils/scinceCoveragePreconditions';
import { aggregateScinceIndicators } from '../utils/scinceIndicatorAggregation';
import type { ScinceCoverageDataset, ScinceCoverageSourceRow, ScinceCoverageTopologyEvidence } from '../types/scinceCanonicalCoverage';
import type { ScinceMultiunitObservation, ScinceIndicator, ScinceUnitDetail } from '../types/scinceMultiunit';
import { latestReadyDataset } from './inegiTerritorialResolver';

export const SCINCE_MULTIUNIT_LIMIT = 500;
export const SCINCE_QUERY_TIMEOUT_MS = 8000;
type Client = { query: (...args: any[]) => Promise<any>; release?: () => void };
type Source = { connect: () => Promise<Client> };
export type ScinceResolvedObservation = ScinceMultiunitObservation | ScinceCompactSnapshotV2;
type Resolution = { success: true; observation: ScinceResolvedObservation } | { success: false; code: 'SCINCE_CANONICAL_GEOGRAPHY_INVALID' | 'SCINCE_CANONICAL_DATA_UNAVAILABLE' | 'MULTIUNIT_QUERY_LIMIT_EXCEEDED' | 'SCINCE_QUERY_TIMEOUT' | 'SCINCE_RADIUS_CONFIGURATION_REQUIRED' };
type LegacyResolution = {success:true;observation:ScinceMultiunitObservation} | Extract<Resolution,{success:false}>;
const cache = new Map<string, { expires: number; observation: ScinceResolvedObservation }>();
type ScinceDiagnosticStage = 'CONFIG' | 'DATABASE_CONNECT' | 'DATASET' | 'RELEASE' | 'ANALYSIS_AREA' | 'SPATIAL_SELECTION' | 'OBSERVATIONS' | 'OFFICIAL_PROFILE' | 'PAYLOAD' | 'COMPLETE';
const scinceDiagnosticCodes = [
  'SCINCE_SNAPSHOT_PAYLOAD_LIMIT', 'SCINCE_UNSUPPORTED_NORMALIZATION_RELEASE',
  'SCINCE_INCOMPLETE_OBSERVATION_SET', 'SCINCE_INVALID_OBSERVATION_SET',
  'SCINCE_INVALID_OBSERVATION', 'SCINCE_TYPED_RAW_MISMATCH', 'SCINCE_PROFILE_INVALID',
  'SCINCE_PROJECTION_DOMAIN_UNSUPPORTED', 'SCINCE_ANALYSIS_AREA_CONTAINMENT_FAILED',
  'SCINCE_ANALYSIS_AREA_INVALID', 'SCINCE_MULTIUNIT_QUERY_LIMIT_EXCEEDED', 'SCINCE_QUERY_TIMEOUT',
  'DATABASE_CONFIGURATION_ERROR', '42P01', '42501', '57014',
  'INVALID_UNIT_RELATION', 'INVALID_METRIC', 'CONFLICTING_UNIT_DETAIL', 'SCINCE_COVERAGE_CONTRACT_INVALID',
] as const;
/** Only literal codes and aggregate sizes may leave this diagnostic boundary. */
function logScinceResolverDiagnostic(stage: ScinceDiagnosticStage, error: unknown, unitCount: number | null = null, payloadBytes: number | null = null): void {
  try {
    const own = (key: string): unknown => error && typeof error === 'object' ? Object.getOwnPropertyDescriptor(error, key)?.value : undefined;
    const sqlCode = own('code'), message = own('message');
    const recognized = scinceDiagnosticCodes.find(code => code === sqlCode) ?? scinceDiagnosticCodes.find(code => code === message);
    const configurationError = [
      'DATABASE_CONFIGURATION_ERROR: DATABASE_URL is required.',
      'DATABASE_CONFIGURATION_ERROR: DATABASE_URL must use the PostgreSQL protocol.',
      'DATABASE_CONFIGURATION_ERROR: DATABASE_URL is structurally invalid.',
    ].some(messageLiteral => messageLiteral === message);
    const integer = (value: number | null) => Number.isSafeInteger(value) && value! >= 0 ? value : null;
    console.error({event:'SCINCE_RESOLVER_DIAGNOSTIC',stage,code:recognized ?? (configurationError ? 'DATABASE_CONFIGURATION_ERROR' : 'UNKNOWN_SANITIZED'),
      unitCount:integer(unitCount),payloadBytes:integer(payloadBytes)});
  } catch { /* Diagnostics must never change the public result or expose the original error. */ }
}

export const SCINCE_MULTIUNIT_SQL = `
WITH analysis AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) AS geom),
candidates AS MATERIALIZED (
 SELECT g.* FROM public.inegi_territorial_geography g, analysis a
 WHERE g.dataset_id=$2 AND g.geom && a.geom AND ST_Intersects(g.geom,a.geom)
 ORDER BY g.geographic_level, g.source_cvegeo LIMIT $3
)
SELECT g.geography_id, g.geographic_level, g.source_cvegeo, g.geographic_name,
 ST_AsGeoJSON(g.geom) AS geometry,
 ST_IsValid(g.geom) AS is_valid, ST_IsSimple(g.geom) AS is_simple, ST_IsEmpty(g.geom) AS is_empty,
 ST_SRID(g.geom) AS srid, ST_Area(g.geom) AS area,
 ST_Intersects(a.geom,g.geom) AS intersects, ST_Touches(a.geom,g.geom) AS touches,
 ST_Covers(a.geom,g.geom) AS covers_gu, ST_Covers(g.geom,a.geom) AS covers_ug,
 ST_Equals(a.geom,g.geom) AS equals, ST_Relate(a.geom,g.geom) AS relate,
 CASE WHEN GeometryType(a.geom)='LINESTRING'
 THEN ST_Length(ST_CollectionExtract(ST_Intersection(a.geom,g.geom),2)::geography)
 ELSE ST_Area(ST_CollectionExtract(ST_Intersection(a.geom,g.geom),3)::geography) END AS intersection_measure,
 CASE WHEN GeometryType(a.geom)='LINESTRING' THEN ST_Length(a.geom::geography) ELSE ST_Area(a.geom::geography) END AS analysis_measure,
 ST_Area(g.geom::geography) AS unit_area,
 d.source_row_key, d.pobtot, d.vivtot, d.vivpar_hab, d.vivpar_deshab
FROM candidates g CROSS JOIN analysis a
LEFT JOIN public.inegi_territorial_demographics d ON d.dataset_id=g.dataset_id
 AND d.geographic_level=g.geographic_level AND d.cve_ent=g.cve_ent
 AND d.cve_mun=g.cve_mun AND d.cve_loc=g.cve_loc AND d.cve_ageb=g.cve_ageb
 AND d.cve_mza IS NOT DISTINCT FROM g.cve_mza
ORDER BY g.geographic_level,g.source_cvegeo,d.source_row_key`;

/** One read-only PostGIS snapshot, no migration, no point surrogate, no repairs. */
async function resolveCoverage(projectId: string, geography: CanonicalProjectGeography, injected: Source | undefined, radiusConfig: ScinceRadiusConfiguration | undefined, compactOutput: boolean): Promise<Resolution> {
  const fail = (code: Extract<Resolution,{success:false}>['code']): Resolution => ({success:false,code});
  const origin = readScinceCanonicalGeography(geography);
  let canonical = origin;
  if (!canonical || canonical.type === 'INDIVIDUAL' && !radiusConfig) return fail('SCINCE_CANONICAL_GEOGRAPHY_INVALID');
  let fingerprint: string;
  try { fingerprint = canonical.type==='INDIVIDUAL'?fingerprintScinceCanonicalPoint(canonical):fingerprintScinceCoverageGeography(canonical); } catch { return fail('SCINCE_CANONICAL_GEOGRAPHY_INVALID'); }
  if (!injected && !process.env.DATABASE_URL?.trim()) { logScinceResolverDiagnostic('CONFIG', {code:'DATABASE_CONFIGURATION_ERROR'}); return fail('SCINCE_CANONICAL_DATA_UNAVAILABLE'); }
  let client: Client | undefined;
  let stage: ScinceDiagnosticStage = 'DATABASE_CONNECT';
  let unitCount: number | null = null, payloadBytes: number | null = null;
  try {
    client = await (injected ?? getPool()).connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query(`SET LOCAL statement_timeout = '${SCINCE_QUERY_TIMEOUT_MS}ms'`);
    stage = 'DATASET';
    const dataset = await latestReadyDataset(client as any);
    if (!dataset) { await client.query('ROLLBACK'); logScinceResolverDiagnostic(stage, null); return fail('SCINCE_CANONICAL_DATA_UNAVAILABLE'); }
    const d: ScinceCoverageDataset = { datasetId:dataset.dataset_id, year:dataset.reference_year, version:dataset.version,
      provenance:{productName:dataset.product_name,geographySourceUrl:dataset.geography_source_url,censusSourceUrl:dataset.census_source_url,
        geographySha256:dataset.geography_sha256,censusSha256:dataset.census_sha256,
        importedAt:new Date(dataset.imported_at).toISOString(),completedAt:new Date(dataset.completed_at).toISOString()} };
    const identity = JSON.stringify([d.datasetId,d.year,d.version,d.provenance.geographySha256,d.provenance.censusSha256]);
    stage = 'RELEASE';
    const normalizationRelease=await readScinceRelease(client,d.datasetId);
    const key = JSON.stringify([projectId,fingerprint,identity,radiusConfig ?? null,normalizationRelease,compactOutput]);
    const hit = !injected ? cache.get(key) : null;
    if (hit && hit.expires > Date.now()) { await client.query('COMMIT'); return {success:true,observation:structuredClone(hit.observation)}; }
    stage = 'ANALYSIS_AREA';
    const scinceAnalysisArea = radiusConfig ? await calculateScinceAnalysisArea(client,canonical,fingerprint,radiusConfig) : undefined;
    if (scinceAnalysisArea) canonical=readScinceCanonicalGeography(scinceAnalysisArea.geometry)!;
    const json = JSON.stringify(canonical.geometry);
    const flags = (await client.query(`WITH a AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) AS geom)
      SELECT ST_IsValid(geom) AS is_valid,ST_IsSimple(geom) AS is_simple,ST_IsEmpty(geom) AS is_empty,
      ST_Area(geom) AS area,ST_SRID(geom) AS srid,postgis_geos_version() AS engine_version FROM a`,[json])).rows[0];
    const topology: ScinceCoverageTopologyEvidence = {geometry:canonical.geometry,crs:flags.srid,engine:'GEOS',engineVersion:flags.engine_version,
      isValid:flags.is_valid,isSimple:flags.is_simple,isEmpty:flags.is_empty,area:Number(flags.area)};
    const mode = canonical.type as 'CORRIDOR'|'POLYGON';
    const analysis = validateScinceCoverageGeometry({mode,geometry:canonical.geometry,crs:4326,topology});
    if (analysis.status !== 'VALID') { await client.query('ROLLBACK'); return fail('SCINCE_CANONICAL_GEOGRAPHY_INVALID'); }
    stage = 'SPATIAL_SELECTION';
    const raw = (await client.query(SCINCE_MULTIUNIT_SQL,[json,d.datasetId,SCINCE_MULTIUNIT_LIMIT+1])).rows;
    unitCount = raw.length;
    if (raw.length > SCINCE_MULTIUNIT_LIMIT) { await client.query('ROLLBACK'); logScinceResolverDiagnostic(stage, {code:'SCINCE_MULTIUNIT_QUERY_LIMIT_EXCEEDED'}, unitCount); return fail('MULTIUNIT_QUERY_LIMIT_EXCEEDED'); }
    if (!raw.length) { await client.query('COMMIT'); logScinceResolverDiagnostic(stage, null, unitCount); return fail('SCINCE_CANONICAL_DATA_UNAVAILABLE'); }
    const sourceRows: ScinceCoverageSourceRow[] = [];
    const units: Parameters<typeof buildScinceCanonicalCoverage>[0]['territorialUnits'] = [];
    const details: ScinceUnitDetail[] = [];
    const sourceGeometryIds = new Map<string,string>();
    const unitIdentities = new Map<string,{geographyId:string;geometryFingerprint:string}>();
    for (const row of raw) {
      const geometry = JSON.parse(row.geometry);
      const unit = validateScinceCoverageGeometry({mode:'POLYGON',geometry,crs:row.srid,
        topology:{geometry,crs:row.srid,engine:'GEOS',engineVersion:topology.engineVersion,isValid:row.is_valid,isSimple:row.is_simple,isEmpty:row.is_empty,area:Number(row.area)}});
      const relation = classifyScinceCoverageRelation(analysis,unit,{analysisIdentity:analysis.geometryIdentity,
        unitIdentity:unit.status === 'VALID' ? unit.geometryIdentity : '',intersects:row.intersects,touches:row.touches,
        coversGU:row.covers_gu,coversUG:row.covers_ug,equals:row.equals,relate:row.relate});
      if (relation.status !== 'RELATED') throw new Error('INVALID_UNIT_RELATION');
      if(unit.status!=='VALID')throw new Error('INVALID_UNIT_RELATION');
      const unitKey=JSON.stringify([row.geographic_level,row.source_cvegeo]);
      const unitIdentity={geographyId:String(row.geography_id),geometryFingerprint:createHash('sha256').update(unit.geometryIdentity).digest('hex')};
      const previousIdentity=unitIdentities.get(unitKey);
      if(previousIdentity && JSON.stringify(previousIdentity)!==JSON.stringify(unitIdentity))throw new Error('CONFLICTING_UNIT_DETAIL');
      unitIdentities.set(unitKey,unitIdentity);
      const r = relation.relation;
      const ids: string[] = [];
      if (row.source_row_key && ['MANZANA','AGEB'].includes(row.geographic_level)) {
        const source: ScinceCoverageSourceRow = {demographicGeographicLevel:row.geographic_level,sourceRowKey:row.source_row_key,
          geographicCode:row.source_cvegeo,relationToAnalysis:r,observedAt:null,
          demographics:{populationTotal:row.pobtot,housingTotal:row.vivtot,inhabitedPrivateHousing:row.vivpar_hab,uninhabitedPrivateHousing:row.vivpar_deshab,marginacion:null}};
        const id = scinceCoverageObservationId(d,source);ids.push(id);sourceRows.push(source);sourceGeometryIds.set(id,String(row.geography_id));
      }
      units.push({geographicLevel:row.geographic_level,geographicCode:row.source_cvegeo,relationToAnalysis:r,sourceRowIds:ids});
      const intersection=Number(row.intersection_measure),measure=Number(row.analysis_measure),area=Number(row.unit_area);
      if (![intersection,measure,area].every(Number.isFinite) || intersection<0 || measure<=0 || area<=0 || intersection>measure*(1+1e-8) || mode==='POLYGON' && intersection>area*(1+1e-8)) throw new Error('INVALID_METRIC');
      details.push({unitType:row.geographic_level,inegiCode:row.source_cvegeo,name:row.geographic_name ?? null,relation:r,
        intersectionType:r==='TOUCHES_ONLY'?'TOUCHED_UNIT':r==='ANALYSIS_COVERS_UNIT'||r==='EQUAL_FOOTPRINT'?'FULL_UNIT':'PARTIAL_UNIT',
        coverageMetric:{measure:mode==='CORRIDOR'?'METRES':'SQUARE_METRES',intersection,analysis:measure,unitArea:area,analysisFraction:intersection/measure,unitAreaFraction:mode==='POLYGON'?intersection/area:null},
        sourceReference:JSON.stringify([d.datasetId,row.geographic_level,row.source_cvegeo])});
    }
    const context = buildScinceCanonicalCoverage({projectId,geography:canonical,crs:4326,topology,dataset:d,territorialUnits:units,sourceRows,limitations:["Contexto observado por unidad oficial INEGI; sin atribución individual."]});
    const sourceLevel = context.sourceRows.some(row=>row.demographicGeographicLevel==='MANZANA' && row.usage!=='ENUMERATION_ONLY') ? 'MANZANA' : 'AGEB';
    const selected = context.sourceRows.filter(row=>row.demographicGeographicLevel===sourceLevel && row.usage!=='ENUMERATION_ONLY');
    const full = selected.length>0 && selected.every(row=>['ANALYSIS_COVERS_UNIT','EQUAL_FOOTPRINT'].includes(row.relationToAnalysis));
    let disjoint = false;
    if (full) {
      const ids=selected.map(row=>sourceGeometryIds.get(row.observationId));
      const evidence=await client.query(`SELECT NOT EXISTS (SELECT 1 FROM public.inegi_territorial_geography a
        JOIN public.inegi_territorial_geography b ON a.geography_id<b.geography_id AND a.geom && b.geom
        WHERE a.dataset_id=$1 AND b.dataset_id=$1 AND a.geography_id=ANY($2::bigint[]) AND b.geography_id=ANY($2::bigint[])
        AND ST_Relate(a.geom,b.geom,'2********')) AS disjoint`,[d.datasetId,ids]);
      disjoint=evidence.rows[0]?.disjoint===true;
    }
    const indicators: ScinceMultiunitObservation['indicators'] = context.sourceRows.flatMap(row=>row.usage==='ENUMERATION_ONLY'?[]:
      (['populationTotal','housingTotal','inhabitedPrivateHousing','uninhabitedPrivateHousing'] as const).map(name=>({name,kind:'COUNT' as const,value:row.demographics[name],
        sourceReference:row.observationId,observationId:row.observationId,universe:`${identity}:${row.demographicGeographicLevel}:${name}`})));
    const refs=selected.map(row=>row.observationId);
    const aggregates=aggregateScinceIndicators(indicators.filter(row=>refs.includes(row.observationId)),{fullUnits:full,sameLevel:true,disjointInteriors:disjoint});
    const warnings=['Las cifras corresponden a unidades fuente completas; no representan población del corredor ni de intersecciones parciales.',
      'Las proporciones de área/longitud son espaciales; no se utilizan para prorratear demografía.',
      'La suma admisible describe sólo unidades completas seleccionadas, sin afirmar cobertura censal completa del área.',
      'Footprints oficiales pueden haber sido reparados por la ingesta registrada; el análisis no se repara.'];
    const uniqueDetails = new Map<string,ScinceUnitDetail>();
    for (const detail of details) {
      const id=JSON.stringify([detail.unitType,detail.inegiCode]);
      if (uniqueDetails.has(id) && JSON.stringify(uniqueDetails.get(id))!==JSON.stringify(detail)) throw new Error('CONFLICTING_UNIT_DETAIL');
      uniqueDetails.set(id,detail);
    }
    const {schemaVersion:_schema,support:_support,aggregation:_aggregation,...base}=context;
    const {geometry:_geometry,...facts}=topology;
    const observation: ScinceMultiunitObservation={...base,schemaVersion:'SCINCE_PRODUCTIVE_COVERAGE_V2',support:'PRODUCTIVE_UNIT_CONTEXT',
      geometry:serializeCanonicalGeographyForFirestore(canonical)!,queryTimestamp:new Date().toISOString(),source:'INEGI_CPV2020_LOCAL_POSTGIS',normalizer:'SCINCE_MULTIUNIT_NORMALIZER_V1',
      humanReviewStatus:'REQUIRES_PPC_REVIEW',topology:facts,unitDetails:[...uniqueDetails.values()],indicators,aggregates,aggregationMethod:'FULL_DISJOINT_SOURCE_UNITS_ONLY',
      partitionEvidence:{sameLevel:true,disjointInteriors:disjoint,datasetIdentity:identity,sourceReferences:refs},methodologicalWarnings:warnings,
      limitations:context.limitations.filter(s=>!s.startsWith('Sin agregación')).concat(warnings)};
    if (scinceAnalysisArea) {
      observation.geometry=serializeCanonicalGeographyForFirestore(origin!)!;
      observation.geographyBinding={geographyId:origin!.geographyId,geographyType:origin!.type,geographyFingerprint:fingerprint};
      observation.scinceAnalysisArea=scinceAnalysisArea;
      observation.rawScinceIndicators=structuredClone(indicators);
      observation.derivedSociodemographicProfile=deriveScinceSociodemographicProfile(indicators,aggregates,d.year,identity);
      observation.officialBaseProfile=structuredClone(observation.derivedSociodemographicProfile);
      observation.estimatedCurrentProfile=null;
      observation.limitations.push('Perfil del entorno territorial definido por área analítica; censo oficial sin actualización temporal ni atribución individual.');
    }
    let finalObservation:ScinceResolvedObservation=observation;
    if(normalizationRelease) {
      stage = 'OBSERVATIONS';
      const observations=await readScinceObservations(client,normalizationRelease,context.sourceRows);
      stage = 'OFFICIAL_PROFILE';
      observation.officialBaseProfile2020=buildOfficialBaseProfile2020(observation,normalizationRelease,observations);
      observation.indicators=catalogIndicators(observations);
      observation.aggregates=observation.officialBaseProfile2020.admissibleAggregates;
      if(scinceAnalysisArea) {
        observation.rawScinceIndicators=structuredClone(observation.indicators);
        observation.derivedSociodemographicProfile=deriveScinceSociodemographicProfile(observation.indicators,observation.aggregates,d.year,identity);
        observation.officialBaseProfile=structuredClone(observation.derivedSociodemographicProfile);
      }
      if(!isValidOfficialBaseProfile2020(observation))throw new Error('SCINCE_PROFILE_INVALID');
      if(compactOutput) {
        if(!scinceAnalysisArea || d.year!==2020)throw new Error('SCINCE_PROFILE_INVALID');
        const compactObservations:ScinceCompactObservation[]=context.sourceRows.map(row=>{
          const values=new Map(observations.filter(o=>o.sourceReference===row.observationId).map(o=>[o.variableCode,o.rawValue]));
          const rawValues=row.usage==='ENUMERATION_ONLY'?null:catalog.variables.map(v=>{
            if(!values.has(v.variableCode))throw new Error('SCINCE_INCOMPLETE_OBSERVATION_SET');
            return values.get(v.variableCode) ?? null;
          });
          const compact={geographicLevel:row.demographicGeographicLevel,sourceRowKey:row.sourceRowKey,geographicCode:row.geographicCode,
            relationToAnalysis:row.relationToAnalysis,usage:row.usage,rawValues};
          return {...compact,observationFingerprint:fingerprintScinceCompactObservation(compact)};
        });
        const partition={selectedObservationIndexes:context.sourceRows.flatMap((row,i)=>refs.includes(row.observationId)?[i]:[]),
          sameLevel:true as const,disjointInteriors:disjoint,aggregationMethod:'FULL_DISJOINT_SOURCE_UNITS_ONLY' as const};
        const territorialUnits:ScinceCompactTerritorialUnit[]=observation.unitDetails.map(detail=>{
          const unit=context.territorialUnits.find(u=>u.geographicLevel===detail.unitType&&u.geographicCode===detail.inegiCode);
          const identity=unitIdentities.get(JSON.stringify([detail.unitType,detail.inegiCode]));
          if(!unit || !identity)throw new Error('CONFLICTING_UNIT_DETAIL');
          return {geographicLevel:detail.unitType,geographicCode:detail.inegiCode,geographicName:detail.name,...identity,
            coverageRelation:detail.relation,intersectionType:detail.intersectionType,coverageMetrics:detail.coverageMetric,
            observationIndexes:context.sourceRows.flatMap((row,i)=>unit.sourceRowIds.includes(row.observationId)?[i]:[])};
        });
        finalObservation=createScinceCompactSnapshotV2({schemaVersion:'SCINCE_COMPACT_SNAPSHOT_V2',encodingVersion:'SCINCE_RAW_COLUMN_VECTOR_V1',
          projectBinding:{projectId},geographyBinding:{...observation.geographyBinding,geometry:observation.geometry,fingerprintVersion:fingerprint.split(':')[0]},
          datasetIdentity:{datasetId:d.datasetId,referenceYear:2020,version:d.version},
          releaseIdentity:{releaseId:normalizationRelease.releaseId,observationSetFingerprint:normalizationRelease.observationSetFingerprint},
          catalogIdentity:{catalogVersion:normalizationRelease.catalogVersion,catalogFingerprint:normalizationRelease.catalogFingerprint,
            columnOrderFingerprint:fingerprintScinceCompactColumnOrder(),indicatorOrderFingerprint:fingerprintScinceCompactIndicatorOrder()},
          normalizationIdentity:{normalizationVersion:normalizationRelease.normalizationVersion},
          sourceIdentity:{source:observation.source,normalizer:observation.normalizer,provenance:d.provenance},
          analysisArea:scinceAnalysisArea,topology:facts,territorialUnits,observations:compactObservations,partitionEvidence:partition,
          officialBaseProfile2020:buildScinceCompactProfile(compactObservations,partition,observation.limitations),
          ppcReview:{status:'REQUIRES_PPC_REVIEW',decision:null,institutionalUserId:null,incorporatedAt:null},
          freshness:{status:'CURRENT',evaluatedAt:observation.queryTimestamp,reasonCode:null},
          audit:{acquiredAt:observation.queryTimestamp,observedAt:null,contractVersion:'SCINCE_COMPACT_CONTRACT_V1',materializerVersion:'SCINCE_COMPACT_CODEC_V1'}});
      }
      stage = 'PAYLOAD';
      payloadBytes = Buffer.byteLength(JSON.stringify(finalObservation),'utf8');
      if(payloadBytes>800000)throw new Error('SCINCE_SNAPSHOT_PAYLOAD_LIMIT');
    } else {observation.limitations.push('Dataset histórico: catálogo y observaciones tipadas todavía no enriquecidos.');}
    stage = 'COMPLETE';
    await client.query('COMMIT');
    if (!injected) { for (const [k,v] of cache) if(v.expires<=Date.now())cache.delete(k);if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{expires:Date.now()+60000,observation:structuredClone(finalObservation)}); }
    return {success:true,observation:finalObservation};
  } catch(error) {
    logScinceResolverDiagnostic(stage, error, unitCount, payloadBytes);
    try { await client?.query('ROLLBACK'); } catch { /* keep original failure */ }
    return fail((error as any)?.code==='57014'?'SCINCE_QUERY_TIMEOUT':'SCINCE_CANONICAL_DATA_UNAVAILABLE');
  } finally { client?.release?.(); }
}

/** Explicit archived-contract entry; never used to expand a compact result. */
export async function resolveInegiSourceCoverage(projectId:string,geography:CanonicalProjectGeography,injected?:Source,radiusConfig?:ScinceRadiusConfiguration):Promise<LegacyResolution> {
  const result=await resolveCoverage(projectId,geography,injected,radiusConfig,false);
  if(!result.success)return result;
  if(result.observation.schemaVersion!=='SCINCE_PRODUCTIVE_COVERAGE_V2')return {success:false,code:'SCINCE_CANONICAL_DATA_UNAVAILABLE'};
  return {success:true,observation:result.observation};
}
export async function resolveInegiLegacyMultiunit(projectId:string,geography:CanonicalProjectGeography,injected?:Source,configuration?:ScinceRadiusConfiguration):Promise<LegacyResolution> {
  const config=configuration ?? readScinceRadiusConfiguration();
  if(!isValidScinceRadiusConfiguration(config))return {success:false,code:'SCINCE_RADIUS_CONFIGURATION_REQUIRED'};
  return resolveInegiSourceCoverage(projectId,geography,injected,config);
}

/** Productive entry: configuration is required for every modality. Source coverage is retained for archived-contract regression only. */
export async function resolveInegiMultiunit(projectId:string, geography:CanonicalProjectGeography, injected?:Source, configuration?:ScinceRadiusConfiguration):Promise<Resolution> {
  const config=configuration ?? readScinceRadiusConfiguration();
  if (!isValidScinceRadiusConfiguration(config)) { logScinceResolverDiagnostic('CONFIG', null); return {success:false,code:'SCINCE_RADIUS_CONFIGURATION_REQUIRED'}; }
  return resolveCoverage(projectId,geography,injected,config,true);
}
