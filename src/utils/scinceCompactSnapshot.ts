import {createHash} from 'crypto';
import {catalog, catalogFingerprint, NORMALIZATION_VERSION, normalizeRow} from '../lib/scinceCatalogCore.cjs';
import {catalogIndicators} from './scinceOfficialProfile';
import {aggregateScinceIndicators} from './scinceIndicatorAggregation';
import {readScinceCanonicalGeography} from './scinceQueryGeometry';
import {fingerprintScinceCoverageGeography} from './scinceCanonicalCoverage';
import {validateScinceCoverageGeometry} from './scinceCoveragePreconditions';
import {isValidScinceRadiusConfiguration} from '../lib/scinceRadiusConfiguration';
import type {ScinceCompactObservation, ScinceCompactProfile, ScinceCompactSnapshotInput, ScinceCompactSnapshotV2} from '../types/scinceCompactSnapshot';

export const SCINCE_COMPACT_SCHEMA_VERSION = 'SCINCE_COMPACT_SNAPSHOT_V2';
export const SCINCE_COMPACT_ENCODING_VERSION = 'SCINCE_RAW_COLUMN_VECTOR_V1';
export const SCINCE_COMPACT_RAW_COLUMN_COUNT = 230;
export const SCINCE_COMPACT_INDICATOR_COUNT = 222;
const columns = catalog.variables.map(v => v.variableCode);
const indicators = catalog.variables.filter(v => v.statisticalType !== 'IDENTIFIER');
const relations = ['TOUCHES_ONLY','INTERIOR_INTERSECTION','ANALYSIS_COVERS_UNIT','UNIT_COVERS_ANALYSIS','EQUAL_FOOTPRINT'];
const lengths: Record<string, number> = {ESTADO:2,MUNICIPIO:5,LOCALIDAD:9,AGEB:13,MANZANA:16};
const reject = (): never => {throw new Error('SCINCE_COMPACT_CONTRACT_INVALID');};
const record = (x: any) => !!x && typeof x === 'object' && !Array.isArray(x);
const text = (x: any) => typeof x === 'string' && x.trim().length > 0;
const sha = (x: any) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const date = (x: any) => typeof x === 'string' && /^\d{4}-\d\d-\d\dT/.test(x) && Number.isFinite(Date.parse(x));
const strings = (x: any) => Array.isArray(x) && x.every(text);
const finite = (...values: any[]) => values.every(v => typeof v === 'number' && Number.isFinite(v));
const exact = (x: any, keys: string[]) => record(x) && Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x,k));

/** Reject non-JSON values rather than silently losing them while hashing/cloning. */
function stable(value: unknown): string {
  const visit = (v: any): any => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) && !Object.is(v,-0) ? v : reject();
    if (Array.isArray(v)) {
      if (Reflect.ownKeys(v).length !== v.length+1) return reject();
      return Array.from({length:v.length},(_,i)=>{
        const descriptor=Object.getOwnPropertyDescriptor(v,String(i));
        if (!descriptor || !Object.hasOwn(descriptor,'value') || !descriptor.enumerable) return reject();
        return visit(descriptor.value);
      });
    }
    if (!record(v) || Reflect.ownKeys(v).length !== Object.keys(v).length) return reject();
    const prototype = Object.getPrototypeOf(v);
    // structuredClone can return plain JSON objects from another JavaScript realm.
    if (prototype !== null && (Object.getPrototypeOf(prototype) !== null ||
      !Object.hasOwn(prototype,'constructor') ||
      Function.prototype.toString.call(prototype.constructor) !== Function.prototype.toString.call(Object))) return reject();
    return Object.fromEntries(Object.keys(v).sort().map(key => {
      const descriptor=Object.getOwnPropertyDescriptor(v,key);
      if (!descriptor || !Object.hasOwn(descriptor,'value')) return reject();
      return [key,visit(descriptor.value)];
    }));
  };
  return JSON.stringify(visit(value));
}
const equal = (a: unknown,b: unknown) => stable(a) === stable(b);
const hash = (version: string,value: unknown) => `${version}:${createHash('sha256').update(stable({version,value}),'utf8').digest('hex')}`;
export function fingerprintScinceReviewView(view: import('../types/scinceCompactSnapshot').ScinceReviewView):string {
  const {reviewFingerprint:_,...content}=view;
  return hash('SCINCE_REVIEW_VIEW_FINGERPRINT_V1',content);
}
/** Server-derived bounded display view; no per-unit typed/raw indicator expansion. */
export function buildScinceReviewView(snapshot:ScinceCompactSnapshotV2):import('../types/scinceCompactSnapshot').ScinceReviewView {
  if(!isScinceCompactSnapshotV2(snapshot))return reject();
  const s=structuredClone(snapshot),a=s.analysisArea,p=s.officialBaseProfile2020;
  const view:import('../types/scinceCompactSnapshot').ScinceReviewView={version:'SCINCE_REVIEW_VIEW_V1',dataset:s.datasetIdentity,release:s.releaseIdentity,catalog:s.catalogIdentity,
    geography:{geographyId:s.geographyBinding.geographyId,geographyType:s.geographyBinding.geographyType,geographyFingerprint:s.geographyBinding.geographyFingerprint},
    analysisArea:{center:a.center,coverageRadiusMeters:a.coverageRadiusMeters,contextExpansionMeters:a.contextExpansionMeters,analysisRadiusMeters:a.analysisRadiusMeters,
      approximateAreaSquareMeters:a.approximateAreaSquareMeters,calculationMethod:a.calculationMethod},unitCount:s.territorialUnits.length,
    coverageSummary:{FULL_UNIT:0,PARTIAL_UNIT:0,TOUCHED_UNIT:0},aggregateIndicators:indicators.map((v,i)=>({code:v.variableCode,name:v.officialName,dimension:v.dimension,
      value:p.aggregateValues[i],status:p.aggregateStatuses[i],method:p.aggregateMethods[i],reasonCode:p.aggregateReasonCodes[i]})),
    derivedIndicators:p.derivedIndicators,limitations:p.limitations,provenanceSummary:s.sourceIdentity.provenance,freshness:s.freshness.status,
    snapshotFingerprint:s.audit.contentFingerprint,reviewFingerprint:''};
  s.territorialUnits.forEach(u=>view.coverageSummary[u.intersectionType]++);
  view.reviewFingerprint=fingerprintScinceReviewView(view);
  return view;
}
export const fingerprintScinceCompactColumnOrder = (order: readonly string[] = columns) => hash('SCINCE_COMPACT_COLUMN_ORDER_V1',order);
export const fingerprintScinceCompactIndicatorOrder = (order: readonly string[] = indicators.map(v=>v.variableCode)) => hash('SCINCE_COMPACT_INDICATOR_ORDER_V1',order);
export function fingerprintScinceCompactObservation(observation: Omit<ScinceCompactObservation,'observationFingerprint'> | ScinceCompactObservation): string {
  const {geographicLevel,sourceRowKey,geographicCode,relationToAnalysis,usage,rawValues}=observation;
  return hash('SCINCE_COMPACT_OBSERVATION_V1',{geographicLevel,sourceRowKey,geographicCode,relationToAnalysis,usage,rawValues});
}
export function fingerprintScinceCompactSelectedObservationSet(s: Pick<ScinceCompactSnapshotV2,'datasetIdentity'|'releaseIdentity'|'observations'|'partitionEvidence'>): string {
  return hash('SCINCE_COMPACT_SELECTED_SET_V1',{dataset:s.datasetIdentity,release:s.releaseIdentity,
    observations:s.partitionEvidence.selectedObservationIndexes.map(i=>s.observations[i])});
}
export function fingerprintScinceCompactProfile(p: ScinceCompactProfile | Omit<ScinceCompactProfile,'profileFingerprint'>): string {
  const {profileFingerprint:_,...content}=p as ScinceCompactProfile;
  return hash('SCINCE_COMPACT_PROFILE_V1',content);
}
export function fingerprintScinceCompactSnapshotV2(s: ScinceCompactSnapshotV2): string {
  // Acquisition/evaluation times and the human decision are not observation content.
  // Review metadata is separately validated; excluding it is not a grant or publication gate.
  const {ppcReview:_,freshness:__,audit,...content}=s;
  return hash('SCINCE_COMPACT_CONTENT_V1',{...content,audit:{observedAt:audit.observedAt,contractVersion:audit.contractVersion,materializerVersion:audit.materializerVersion}});
}

/** Pure reconstruction using the existing pinned normalizer; never resolves external data. */
export function decodeScinceCompactObservation(o: ScinceCompactObservation) {
  if (o.rawValues === null) {
    if (o.usage !== 'ENUMERATION_ONLY') return reject();
    return [];
  }
  if (o.rawValues.length !== columns.length || !o.rawValues.every(v=>v===null || typeof v==='string')) return reject();
  const raw=Object.fromEntries(columns.map((code,i)=>[code,o.rawValues![i]]));
  return normalizeRow(raw,o.geographicLevel,o.sourceRowKey).map(value=>({...value,sourceReference:o.sourceRowKey}));
}

/** Same aggregation restrictions as the historical official profile; all 222 slots remain present. */
export function buildScinceCompactProfile(observations: ScinceCompactObservation[], partition: ScinceCompactSnapshotV2['partitionEvidence'], limitations: string[]): Omit<ScinceCompactProfile,'profileFingerprint'> {
  const selected=partition.selectedObservationIndexes.map(i=>observations[i]);
  const full=selected.length>0 && selected.every(o=>['ANALYSIS_COVERS_UNIT','EQUAL_FOOTPRINT'].includes(o.relationToAnalysis));
  const aggregates=aggregateScinceIndicators(catalogIndicators(selected.flatMap(decodeScinceCompactObservation)),
    {fullUnits:full,sameLevel:partition.sameLevel,disjointInteriors:partition.disjointInteriors});
  const byName=new Map(aggregates.map(a=>[a.name,a]));
  const values=indicators.map(v=>byName.get(v.variableCode)?.value ?? null);
  const methods=indicators.map(v=>byName.get(v.variableCode)?.method ?? 'NOT_AGGREGATED');
  const reasons=indicators.map(v=>byName.get(v.variableCode)?.reason ?? (byName.has(v.variableCode)?null:'NO_SELECTED_OBSERVATIONS'));
  const dimensions: ScinceCompactProfile['dimensions']={};
  if (observations.some(o=>o.usage!=='ENUMERATION_ONLY')) indicators.forEach((v,i)=>(dimensions[v.dimension] ?? (dimensions[v.dimension]=[])).push(i));
  const derived: ScinceCompactProfile['derivedIndicators']=[];
  const denominatorIndex=indicators.findIndex(v=>v.variableCode==='POBTOT');
  for (const name of ['POBFEM','POBMAS']) {
    const numeratorIndex=indicators.findIndex(v=>v.variableCode===name), n=values[numeratorIndex],d=values[denominatorIndex];
    if (methods[numeratorIndex]==='SUM_FULL_DISJOINT_UNITS' && methods[denominatorIndex]==='SUM_FULL_DISJOINT_UNITS' && n!==null && d!==null && d>0 && n<=d)
      derived.push({name:`${name}_SHARE`,value:100*n/d,numeratorIndex,denominatorIndex,formula:'100 * numerator / denominator',version:'SCINCE_COMPACT_DERIVATIONS_V1'});
  }
  return {referenceYear:2020,aggregateValues:values,aggregateStatuses:values.map(v=>v===null?'NOT_AGGREGATED':'ADMISSIBLE'),
    aggregateMethods:methods,aggregateReasonCodes:reasons,dimensions,derivedIndicators:derived,limitations:[...limitations],provenanceReference:'sourceIdentity.provenance'};
}

/** Validation verifies internal consistency, not the authenticity of supplied topology/PPC facts. */
export function validateScinceCompactSnapshotV2(value: unknown): {valid:true} | {valid:false; code:'SCINCE_COMPACT_CONTRACT_INVALID'} {
  try {
    stable(value);
    const s=value as ScinceCompactSnapshotV2;
    if (!exact(s,['schemaVersion','encodingVersion','projectBinding','geographyBinding','datasetIdentity','releaseIdentity','catalogIdentity','normalizationIdentity','sourceIdentity','analysisArea','topology','territorialUnits','observations','partitionEvidence','officialBaseProfile2020','selectedObservationSetFingerprint','ppcReview','freshness','audit']) ||
      s.schemaVersion!==SCINCE_COMPACT_SCHEMA_VERSION || s.encodingVersion!==SCINCE_COMPACT_ENCODING_VERSION ||
      columns.length!==230 || indicators.length!==222 || !exact(s.projectBinding,['projectId']) || !text(s.projectBinding.projectId)) return reject();
    const g=s.geographyBinding,d=s.datasetIdentity,r=s.releaseIdentity,c=s.catalogIdentity,p=s.sourceIdentity?.provenance;
    if (!exact(g,['geographyId','geographyType','geometry','geographyFingerprint','fingerprintVersion']) || !text(g.geographyId)) return reject();
    const origin=readScinceCanonicalGeography(g.geometry),area=readScinceCanonicalGeography(s.analysisArea?.geometry);
    if (!origin || !area || area.geometry.type!=='Polygon' || origin.geographyId!==g.geographyId || origin.type!==g.geographyType) return reject();
    const fp=origin.type==='INDIVIDUAL' ? `CANONICAL_GEOGRAPHY_FINGERPRINT_V1:${createHash('sha256').update(JSON.stringify({type:origin.type,geometry:{type:'Point',coordinates:origin.geometry.coordinates}})).digest('hex')}` : fingerprintScinceCoverageGeography(origin);
    if (g.geographyFingerprint!==fp || g.fingerprintVersion!==fp.split(':')[0] ||
      !exact(d,['datasetId','referenceYear','version']) || !text(d.datasetId) || d.referenceYear!==2020 || !text(d.version) ||
      !exact(r,['releaseId','observationSetFingerprint']) || !text(r.releaseId) || !sha(r.observationSetFingerprint) ||
      !exact(c,['catalogVersion','catalogFingerprint','columnOrderFingerprint','indicatorOrderFingerprint']) || c.catalogVersion!==catalog.catalogVersion || c.catalogFingerprint!==catalogFingerprint ||
      c.columnOrderFingerprint!==fingerprintScinceCompactColumnOrder() || c.indicatorOrderFingerprint!==fingerprintScinceCompactIndicatorOrder() ||
      !exact(s.normalizationIdentity,['normalizationVersion']) || s.normalizationIdentity.normalizationVersion!==NORMALIZATION_VERSION ||
      !exact(s.sourceIdentity,['source','normalizer','provenance']) || s.sourceIdentity.source!=='INEGI_CPV2020_LOCAL_POSTGIS' || s.sourceIdentity.normalizer!=='SCINCE_MULTIUNIT_NORMALIZER_V1' ||
      !exact(p,['productName','geographySourceUrl','censusSourceUrl','geographySha256','censusSha256','importedAt','completedAt']) || !text(p.productName) ||
      ![p.geographySourceUrl,p.censusSourceUrl].every(v=>typeof v==='string' && /^https:\/\/www\.inegi\.org\.mx\//.test(v)) || !sha(p.geographySha256) || !sha(p.censusSha256) || !date(p.importedAt) || !date(p.completedAt)) return reject();
    const a=s.analysisArea;
    const expansion=origin.type==='INDIVIDUAL'?a.configuration.individualBaseRadiusMeters:origin.type==='CORRIDOR'?a.configuration.lineContextExpansionMeters:a.configuration.polygonContextExpansionMeters;
    if (!exact(a,['version','center','coverageRadiusMeters','contextExpansionMeters','analysisRadiusMeters','constructionRadiusMeters','approximateAreaSquareMeters','geometryType','geometry','sourceGeometryRevision','sourceGeographyId','calculationMethod','centerMethod','projection','configuration','containmentVerified']) ||
      !exact(a.center,['lat','lng']) || !exact(a.configuration,['version','governanceReference','individualBaseRadiusMeters','lineContextExpansionMeters','polygonContextExpansionMeters']) ||
      a.version!=='SCINCE_ANALYSIS_AREA_V1' || a.sourceGeometryRevision!==fp || a.sourceGeographyId!==g.geographyId || a.geometryType!=='Polygon' ||
      a.calculationMethod!=='LOCAL_AEQD_WGS84_CIRCUMSCRIBED_128_V1' || a.centerMethod!==(origin.type==='INDIVIDUAL'?'SOURCE_POINT':origin.type==='CORRIDOR'?'METRIC_LINE_MIDPOINT':'METRIC_MINIMUM_BOUNDING_CIRCLE') ||
      !isValidScinceRadiusConfiguration(a.configuration) || a.containmentVerified!==true || !finite(a.center.lat,a.center.lng,a.coverageRadiusMeters,a.contextExpansionMeters,a.analysisRadiusMeters,a.constructionRadiusMeters,a.approximateAreaSquareMeters) ||
      Math.abs(a.center.lat)>80 || Math.abs(a.center.lng)>180 || a.coverageRadiusMeters<0 || a.analysisRadiusMeters<=0 || a.analysisRadiusMeters>100000 || a.approximateAreaSquareMeters<=0 || a.contextExpansionMeters!==expansion ||
      Math.abs(a.analysisRadiusMeters-a.coverageRadiusMeters-expansion)>1e-7 || Math.abs(a.constructionRadiusMeters-a.analysisRadiusMeters/Math.cos(Math.PI/128))>1e-7 ||
      typeof a.projection!=='string' || !a.projection.startsWith('+proj=aeqd ') || origin.type==='INDIVIDUAL' && (a.coverageRadiusMeters!==0 || !equal(a.center,{lng:origin.geometry.coordinates[0],lat:origin.geometry.coordinates[1]}))) return reject();
    if (!exact(s.topology,['crs','engine','engineVersion','isValid','isSimple','isEmpty','area']) || validateScinceCoverageGeometry({mode:'POLYGON',geometry:area.geometry,crs:4326,topology:{...s.topology,geometry:area.geometry}}).status!=='VALID') return reject();
    if (!Array.isArray(s.territorialUnits) || !s.territorialUnits.length || s.territorialUnits.length>500 || !Array.isArray(s.observations) || s.observations.length>500) return reject();
    const indexes=(v: any,limit: number) => Array.isArray(v) && v.every(i=>Number.isInteger(i) && i>=0 && i<limit) && new Set(v).size===v.length;
    const observationIds=new Set<string>();
    s.observations.forEach(o=>{
      if (!exact(o,['geographicLevel','sourceRowKey','geographicCode','relationToAnalysis','usage','observationFingerprint','rawValues'])) return reject();
      const pattern=o.geographicLevel==='AGEB'?/^\d{2}:\d{3}:\d{4}:[0-9A-Z]{4}$/:o.geographicLevel==='MANZANA'?/^\d{2}:\d{3}:\d{4}:[0-9A-Z]{4}:\d{3}$/:null;
      const id=`${o.geographicLevel}:${o.sourceRowKey}`;
      if (!pattern?.test(o.sourceRowKey) || o.geographicCode!==o.sourceRowKey.replace(/:/g,'') || observationIds.has(id) || !relations.includes(o.relationToAnalysis) ||
        o.usage!==(o.relationToAnalysis==='TOUCHES_ONLY'?'ENUMERATION_ONLY':'FULL_SOURCE_UNIT_CONTEXT_ONLY') || o.observationFingerprint!==fingerprintScinceCompactObservation(o)) return reject();
      observationIds.add(id);
      if (o.rawValues===null) {if(o.usage!=='ENUMERATION_ONLY')return reject();}
      else {
        decodeScinceCompactObservation(o);
        const raw=Object.fromEntries(columns.map((code,i)=>[code,o.rawValues![i]]));
        const key=[raw.ENTIDAD,raw.MUN,raw.LOC,raw.AGEB,...(o.geographicLevel==='MANZANA'?[raw.MZA]:[])].join(':');
        if (key!==o.sourceRowKey || o.geographicLevel==='AGEB' && raw.MZA!=='000') return reject();
      }
    });
    const unitIds=new Set<string>(),seenObservations=new Set<number>();
    s.territorialUnits.forEach(u=>{
      if (!exact(u,['geographicLevel','geographicCode','geographicName','geographyId','geometryFingerprint','coverageRelation','intersectionType','coverageMetrics','observationIndexes'])) return reject();
      const id=`${u.geographicLevel}:${u.geographicCode}`,m=u.coverageMetrics;
      if (!lengths[u.geographicLevel] || !new RegExp(`^[0-9A-Z]{${lengths[u.geographicLevel]}}$`).test(u.geographicCode) || unitIds.has(id) || !text(u.geographyId) || !sha(u.geometryFingerprint) ||
        !(u.geographicName===null || typeof u.geographicName==='string') || !relations.includes(u.coverageRelation) ||
        u.intersectionType!==(u.coverageRelation==='TOUCHES_ONLY'?'TOUCHED_UNIT':['ANALYSIS_COVERS_UNIT','EQUAL_FOOTPRINT'].includes(u.coverageRelation)?'FULL_UNIT':'PARTIAL_UNIT') ||
        !indexes(u.observationIndexes,s.observations.length) || !exact(m,['measure','intersection','analysis','unitArea','analysisFraction','unitAreaFraction']) || m.measure!=='SQUARE_METRES' ||
        !finite(m.intersection,m.analysis,m.unitArea,m.analysisFraction,m.unitAreaFraction) || m.intersection<0 || m.analysis<=0 || m.unitArea<=0 ||
        m.intersection>m.analysis*(1+1e-8) || m.intersection>m.unitArea*(1+1e-8) || Math.abs(m.analysisFraction-m.intersection/m.analysis)>1e-10 || Math.abs(m.unitAreaFraction!-m.intersection/m.unitArea)>1e-10) return reject();
      unitIds.add(id);
      u.observationIndexes.forEach(i=>{
        const o=s.observations[i];
        if(o.geographicLevel!==u.geographicLevel || o.geographicCode!==u.geographicCode || o.relationToAnalysis!==u.coverageRelation) return reject();
        seenObservations.add(i);
      });
    });
    const partition=s.partitionEvidence;
    if(seenObservations.size!==s.observations.length || !exact(partition,['selectedObservationIndexes','sameLevel','disjointInteriors','aggregationMethod']) ||
      !indexes(partition.selectedObservationIndexes,s.observations.length) || partition.sameLevel!==true || typeof partition.disjointInteriors!=='boolean' || partition.aggregationMethod!=='FULL_DISJOINT_SOURCE_UNITS_ONLY') return reject();
    const selectedLevel=s.observations.some(o=>o.geographicLevel==='MANZANA' && o.usage!=='ENUMERATION_ONLY')?'MANZANA':'AGEB';
    const expectedIndexes=s.observations.flatMap((o,i)=>o.geographicLevel===selectedLevel && o.usage!=='ENUMERATION_ONLY'?[i]:[]);
    if (!equal(expectedIndexes,partition.selectedObservationIndexes) || s.selectedObservationSetFingerprint!==fingerprintScinceCompactSelectedObservationSet(s)) return reject();
    const profile=s.officialBaseProfile2020;
    if (!exact(profile,['referenceYear','aggregateValues','aggregateStatuses','aggregateMethods','aggregateReasonCodes','dimensions','derivedIndicators','limitations','provenanceReference','profileFingerprint']) ||
      !['aggregateValues','aggregateStatuses','aggregateMethods','aggregateReasonCodes'].every(key=>Array.isArray((profile as any)[key]) && (profile as any)[key].length===222) ||
      !strings(profile.limitations) || !profile.limitations.length || profile.profileFingerprint!==fingerprintScinceCompactProfile(profile)) return reject();
    const {profileFingerprint:_,...profileContent}=profile;
    if(!equal(profileContent,buildScinceCompactProfile(s.observations,partition,profile.limitations))) return reject();
    const audit=s.audit,review=s.ppcReview,fresh=s.freshness;
    if(!exact(audit,['acquiredAt','observedAt','contractVersion','materializerVersion','contentFingerprint']) || !date(audit.acquiredAt) || audit.observedAt!==null || audit.contractVersion!=='SCINCE_COMPACT_CONTRACT_V1' || audit.materializerVersion!=='SCINCE_COMPACT_CODEC_V1' ||
      audit.contentFingerprint!==fingerprintScinceCompactSnapshotV2(s) || !exact(review,['status','reviewedContentFingerprint','decision','institutionalUserId','incorporatedAt']) || review.reviewedContentFingerprint!==audit.contentFingerprint ||
      !(review.status==='REQUIRES_PPC_REVIEW' && review.decision===null && review.institutionalUserId===null && review.incorporatedAt===null || review.status==='INCORPORATED' && review.decision==='INCORPORATED' && text(review.institutionalUserId) && date(review.incorporatedAt)) ||
      !exact(fresh,['evaluatedAt','status','reasonCode']) || !['CURRENT','STALE','INVALID','MISSING'].includes(fresh.status) || !(fresh.evaluatedAt===null || date(fresh.evaluatedAt)) ||
      !(fresh.reasonCode===null || text(fresh.reasonCode)) || fresh.status==='CURRENT' && (fresh.evaluatedAt===null || fresh.reasonCode!==null) || fresh.status!=='CURRENT' && !text(fresh.reasonCode)) return reject();
    return {valid:true};
  } catch {return {valid:false,code:'SCINCE_COMPACT_CONTRACT_INVALID'};}
}
export const isScinceCompactSnapshotV2 = (value: unknown): value is ScinceCompactSnapshotV2 => validateScinceCompactSnapshotV2(value).valid;

/** Adds only defined fingerprints. Invalid input is rejected, never repaired or truncated. */
export function createScinceCompactSnapshotV2(input: ScinceCompactSnapshotInput): ScinceCompactSnapshotV2 {
  stable(input);
  const clone=structuredClone(input);
  const s={...clone,observations:clone.observations.map(o=>({...o,observationFingerprint:fingerprintScinceCompactObservation(o)})),
    officialBaseProfile2020:{...clone.officialBaseProfile2020,profileFingerprint:fingerprintScinceCompactProfile(clone.officialBaseProfile2020)},
    selectedObservationSetFingerprint:'',ppcReview:{...clone.ppcReview,reviewedContentFingerprint:''},audit:{...clone.audit,contentFingerprint:''}} as ScinceCompactSnapshotV2;
  s.selectedObservationSetFingerprint=fingerprintScinceCompactSelectedObservationSet(s);
  s.audit.contentFingerprint=fingerprintScinceCompactSnapshotV2(s);
  s.ppcReview.reviewedContentFingerprint=s.audit.contentFingerprint;
  if(!isScinceCompactSnapshotV2(s))return reject();
  return s;
}
