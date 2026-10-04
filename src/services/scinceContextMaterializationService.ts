import 'server-only';
import {getPool} from '../lib/db';
import {createScinceMaterializationRepository} from '../lib/scinceObservationRepository';
import {catalog,catalogFingerprint,NORMALIZATION_VERSION,fingerprint,normalizeRow} from '../lib/scinceCatalogCore.cjs';
import {isScinceCompactSnapshotV2,decodeScinceCompactObservation,buildScinceCompactProfile,
  fingerprintScinceCompactObservation,fingerprintScinceCompactProfile,fingerprintScinceCompactSelectedObservationSet,
  fingerprintScinceCompactSnapshotV2} from '../utils/scinceCompactSnapshot';
import {readScinceCanonicalGeography} from '../utils/scinceQueryGeometry';
import {fingerprintScinceCanonicalPoint} from '../utils/scinceGeographyBinding';
import {fingerprintScinceCoverageGeography,scinceCoverageObservationId} from '../utils/scinceCanonicalCoverage';
import type {ProjectAccessResult,ProjectAccessAction} from '../types/institutionalProjectAccess';
import type {ScinceMaterializationRepository} from '../lib/scinceObservationRepository';
import type {ScinceMaterializationPurpose,MaterializedScinceContext,ScinceCompactObservation} from '../types/scinceCompactSnapshot';
import type {ScinceCompactSnapshotV2} from '../types/scinceCompactSnapshot';
import type {ScinceCanonicalSnapshot} from '../types/scinceCanonicalSnapshot';
import type {ScinceMultiunitObservation} from '../types/scinceMultiunit';
import {catalogIndicators,buildOfficialBaseProfile2020} from '../utils/scinceOfficialProfile';
import {deriveScinceSociodemographicProfile} from '../utils/scinceSociodemographicProfile';

export const SCINCE_CONTEXT_MATERIALIZATION_VERSION='SCINCE_CONTEXT_MATERIALIZATION_V1';
const purposeAction:Record<ScinceMaterializationPurpose,ProjectAccessAction>={UI:'ANALYZE_SCINCE',IA:'ANALYZE_SCINCE',PPC:'WRITE',REPORT:'GENERATE_REPORT'};
type Rejection='SCINCE_MATERIALIZATION_CONTRACT_INVALID'|'SCINCE_MATERIALIZATION_UNAUTHORIZED'|'SCINCE_MATERIALIZATION_SOURCE_INVALID';
export type ScinceMaterializationResult={materialization:'PASS';context:MaterializedScinceContext}|{materialization:'REJECTED';code:Rejection};
const record=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string' && v.trim().length>0;
const reject=(code:Rejection):ScinceMaterializationResult=>({materialization:'REJECTED',code});
const sourceInvalid=():never=>{throw new Error('SCINCE_MATERIALIZATION_SOURCE_INVALID');};

/** Document projection of verified REPORT materialization; never a persisted snapshot. */
export function projectMaterializedScinceDocument(s:ScinceCompactSnapshotV2,c:MaterializedScinceContext):ScinceCanonicalSnapshot {
  if(c.purpose!=='REPORT' || c.verification.contentFingerprint!==s.audit.contentFingerprint ||
    c.verification.profileFingerprint!==s.officialBaseProfile2020.profileFingerprint ||
    c.verification.selectedObservationSetFingerprint!==s.selectedObservationSetFingerprint)throw new Error('SCINCE_REPORT_VERIFICATION_REQUIRED');
  const dataset={datasetId:c.datasetIdentity.datasetId,year:2020,version:c.datasetIdentity.version,provenance:structuredClone(c.provenance)};
  const identity=JSON.stringify([dataset.datasetId,2020,dataset.version,dataset.provenance.geographySha256,dataset.provenance.censusSha256]);
  const sourceRows=c.observations.map(o=>{
    const values=new Map((o.normalizedValues ?? []).map(v=>[v.variableCode,v.typedValue]));
    const count=(code:string)=>typeof values.get(code)==='number'?values.get(code) as number:null;
    return {demographicGeographicLevel:o.geographicLevel,sourceRowKey:o.sourceRowKey,geographicCode:o.geographicCode,
      relationToAnalysis:o.relationToAnalysis,demographics:{populationTotal:count('POBTOT'),housingTotal:count('VIVTOT'),
        inhabitedPrivateHousing:count('VIVPAR_HAB'),uninhabitedPrivateHousing:count('VIVPAR_DES'),marginacion:null},
      observedAt:null,observationId:o.sourceReference,usage:o.usage} as const;
  });
  const raw=c.observations.flatMap(o=>o.normalizedValues ?? []).sort((a,b)=>`${a.sourceReference}:${a.variableCode}`.localeCompare(`${b.sourceReference}:${b.variableCode}`));
  const warnings=['Las cifras corresponden a unidades fuente completas; no representan población del corredor ni de intersecciones parciales.',
    'Las proporciones de área/longitud son espaciales; no se utilizan para prorratear demografía.',
    'La suma admisible describe sólo unidades completas seleccionadas, sin afirmar cobertura censal completa del área.',
    'Footprints oficiales pueden haber sido reparados por la ingesta registrada; el análisis no se repara.'];
  const m:ScinceMultiunitObservation={schemaVersion:'SCINCE_PRODUCTIVE_COVERAGE_V2',support:'PRODUCTIVE_UNIT_CONTEXT',projectId:s.projectBinding.projectId,
    geographyBinding:{geographyId:c.geographyBinding.geographyId,geographyType:c.geographyBinding.geographyType,geographyFingerprint:c.geographyBinding.geographyFingerprint},
    coverageMode:'POLYGON_INTERSECTION_CONTEXT',dataset,geometry:structuredClone(c.geographyBinding.geometry),queryTimestamp:s.audit.acquiredAt,
    source:s.sourceIdentity.source,normalizer:s.sourceIdentity.normalizer,humanReviewStatus:'INCORPORATED',topology:structuredClone(c.topology),
    territorialUnits:c.territorialUnits.map(u=>({geographicLevel:u.geographicLevel,geographicCode:u.geographicCode,relationToAnalysis:u.coverageRelation,
      sourceRowIds:u.observationIndexes.map(i=>c.observations[i].sourceReference)})),sourceRows,
    unitDetails:c.territorialUnits.map(u=>({unitType:u.geographicLevel,inegiCode:u.geographicCode,name:u.geographicName,intersectionType:u.intersectionType,
      relation:u.coverageRelation,coverageMetric:structuredClone(u.coverageMetrics),sourceReference:JSON.stringify([dataset.datasetId,u.geographicLevel,u.geographicCode])})),
    indicators:catalogIndicators(raw),aggregates:[],aggregationMethod:'FULL_DISJOINT_SOURCE_UNITS_ONLY',
    partitionEvidence:{sameLevel:true,disjointInteriors:c.partitionEvidence.disjointInteriors,datasetIdentity:identity,
      sourceReferences:c.partitionEvidence.selectedObservationIndexes.map(i=>c.observations[i].sourceReference)},
    methodologicalWarnings:warnings,limitations:structuredClone(s.officialBaseProfile2020.limitations),scinceAnalysisArea:structuredClone(c.analysisArea),estimatedCurrentProfile:null};
  m.officialBaseProfile2020=buildOfficialBaseProfile2020(m,{datasetId:dataset.datasetId,...c.releaseIdentity,
    catalogVersion:c.catalogIdentity.catalogVersion,catalogFingerprint:c.catalogIdentity.catalogFingerprint,...c.normalizationIdentity},raw);
  m.aggregates=m.officialBaseProfile2020.admissibleAggregates;
  m.rawScinceIndicators=structuredClone(m.indicators);
  m.derivedSociodemographicProfile=deriveScinceSociodemographicProfile(m.indicators,m.aggregates,2020,identity);
  m.officialBaseProfile=structuredClone(m.derivedSociodemographicProfile);
  return {schemaVersion:'SCINCE_CANONICAL_SNAPSHOT_V2',projectId:m.projectId,multiunit:m,
    geographyBinding:{...m.geographyBinding,fingerprintVersion:s.geographyBinding.fingerprintVersion,
      spatialMode:m.geographyBinding.geographyType==='INDIVIDUAL'?'CANONICAL_POINT':m.geographyBinding.geographyType==='CORRIDOR'?'CANONICAL_LINE':'CANONICAL_AREA',queryCoordinate:null},
    dataset:{datasetId:dataset.datasetId,year:2020,version:dataset.version},territorialResolution:{geographicLevel:null,demographicGeographicLevel:null,sourceRowKey:null},
    demographics:null,provenance:null,limitations:structuredClone(m.limitations),observedAt:null};
}

/** Internal read-only acquisition; callers have already obtained the purpose-specific grant. */
export async function materializeScinceContextWithPinnedRepository(snapshot:unknown,purpose:ScinceMaterializationPurpose,access:ProjectAccessResult):Promise<ScinceMaterializationResult> {
  if(!access.allowed)return reject('SCINCE_MATERIALIZATION_UNAUTHORIZED');
  if(!isScinceCompactSnapshotV2(snapshot))return reject('SCINCE_MATERIALIZATION_CONTRACT_INVALID');
  const client=await getPool().connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout='8000ms'");
    const result=await materializeScinceContext(snapshot,purpose,access,createScinceMaterializationRepository(client));
    await client.query(result.materialization==='PASS'?'COMMIT':'ROLLBACK');
    return result;
  }catch{try{await client.query('ROLLBACK');}catch{}return reject('SCINCE_MATERIALIZATION_SOURCE_INVALID');}
  finally{client.release();}
}

/** Internal server API: authorizedContext must originate in the institutional access service,
 * never a client argument. Fingerprints prove consistency, not authorization or GEOS facts.
 * Every purpose verifies the same release/profile; no persistence, public transport or cache. */
export async function materializeScinceContext(snapshot:unknown,purpose:ScinceMaterializationPurpose,
  authorizedContext:ProjectAccessResult,repository:ScinceMaterializationRepository):Promise<ScinceMaterializationResult> {
  try {
    if(!isScinceCompactSnapshotV2(snapshot))return reject('SCINCE_MATERIALIZATION_CONTRACT_INVALID');
    // Detach before awaiting an injected repository: caller mutation cannot change verified content.
    const s=structuredClone(snapshot),access=authorizedContext;
    if(!access || !access.allowed || !Object.hasOwn(purposeAction,purpose) || access.action!==purposeAction[purpose] ||
      access.projectId!==s.projectBinding.projectId || !text(access.actor?.institutionalUserId) ||
      !['USER','ADMIN','SUPER_ADMIN'].includes(access.actor.role) || access.authorizationBasis!=='EXPLICIT_ACTIVE_ACTION_GRANT' ||
      access.policyVersion!=='EXPLICIT_ACTION_GRANT_V1' || access.audit?.outcome!=='ALLOW' ||
      access.audit.authorizationBasis!==access.authorizationBasis || access.audit.policyVersion!==access.policyVersion ||
      access.audit.projectId!==access.projectId || access.audit.action!==access.action || access.audit.institutionalUserId!==access.actor.institutionalUserId ||
      access.project.deleted!==undefined && access.project.deleted!==false || access.project.status==='ARCHIVADO' || access.project.estado==='ARCHIVADO')
      return reject('SCINCE_MATERIALIZATION_UNAUTHORIZED');
    const geography=readScinceCanonicalGeography(access.project.canonicalGeography);
    if(!geography || geography.geographyId!==s.geographyBinding.geographyId || geography.type!==s.geographyBinding.geographyType ||
      (geography.type==='INDIVIDUAL'?fingerprintScinceCanonicalPoint(geography):fingerprintScinceCoverageGeography(geography))!==s.geographyBinding.geographyFingerprint)
      return reject('SCINCE_MATERIALIZATION_UNAUTHORIZED');
    const exact=await repository.readExactRelease(s.datasetIdentity.datasetId,s.releaseIdentity.releaseId);
    if(!exact || exact.release.releaseId!==s.releaseIdentity.releaseId || exact.release.datasetId!==s.datasetIdentity.datasetId ||
      exact.release.catalogVersion!==s.catalogIdentity.catalogVersion || exact.release.catalogFingerprint!==s.catalogIdentity.catalogFingerprint ||
      exact.release.normalizationVersion!==s.normalizationIdentity.normalizationVersion || exact.release.observationSetFingerprint!==s.releaseIdentity.observationSetFingerprint ||
      fingerprint(exact.catalog)!==catalogFingerprint || exact.release.catalogFingerprint!==catalogFingerprint || exact.release.normalizationVersion!==NORMALIZATION_VERSION)sourceInvalid();
    const rows=await repository.readReferencedObservations(s.releaseIdentity.releaseId,s.observations.map(o=>({geographicLevel:o.geographicLevel,sourceRowKey:o.sourceRowKey})));
    if(rows.length!==s.observations.length)sourceInvalid();
    const byKey=new Map(rows.map(r=>[JSON.stringify([r.geographicLevel,r.sourceRowKey]),r]));
    if(byKey.size!==rows.length)sourceInvalid();
    const observations:MaterializedScinceContext['observations']=s.observations.map(o=>{
      const row=byKey.get(JSON.stringify([o.geographicLevel,o.sourceRowKey]));
      if(!row)return sourceInvalid();
      if(row.releaseId!==s.releaseIdentity.releaseId || !Array.isArray(row.rawValues) || row.rawValues.length!==230 ||
        !Array.from({length:230},(_,i)=>Object.hasOwn(row.rawValues,i)).every(Boolean) ||
        !row.rawValues.every(v=>v===null || typeof v==='string') || !Array.isArray(row.observations) || row.observations.length!==230)return sourceInvalid();
      const raw=Object.fromEntries(catalog.variables.map((v,i)=>[v.variableCode,row.rawValues[i]]));
      const key=[raw.ENTIDAD,raw.MUN,raw.LOC,raw.AGEB,...(o.geographicLevel==='MANZANA'?[raw.MZA]:[])].join(':');
      if(key!==o.sourceRowKey || o.geographicLevel==='AGEB' && raw.MZA!=='000')sourceInvalid();
      const normalized=normalizeRow(raw,o.geographicLevel,o.sourceRowKey),seen=new Set<string>();
      for(const value of row.observations) {
        if(!record(value) || !text(value.variableCode) || seen.has(value.variableCode))sourceInvalid();
        const expected=normalized.find(v=>v.variableCode===value.variableCode);
        if(!expected || Object.entries(expected).some(([key,v])=>value[key]!==v))sourceInvalid();
        seen.add(value.variableCode);
      }
      // Enumeration verifies durable identity/normalization but never acquires publishable values.
      const durable:ScinceCompactObservation={...o,rawValues:o.usage==='ENUMERATION_ONLY'?null:[...row.rawValues]};
      if(fingerprintScinceCompactObservation(durable)!==o.observationFingerprint ||
        (durable.rawValues===null ? o.rawValues!==null : !Array.isArray(o.rawValues) || durable.rawValues.some((v,i)=>v!==o.rawValues![i])))sourceInvalid();
      const sourceReference=scinceCoverageObservationId({datasetId:s.datasetIdentity.datasetId,year:s.datasetIdentity.referenceYear,version:s.datasetIdentity.version,
        provenance:s.sourceIdentity.provenance},{demographicGeographicLevel:o.geographicLevel,sourceRowKey:o.sourceRowKey});
      return {...o,sourceReference,normalizedValues:o.usage==='ENUMERATION_ONLY'?null:decodeScinceCompactObservation(durable).map(v=>({...v,sourceReference}))};
    });
    const verifiedObservations=observations.map(({normalizedValues:_,sourceReference:__,...o})=>o);
    const profile=buildScinceCompactProfile(verifiedObservations,s.partitionEvidence,s.officialBaseProfile2020.limitations);
    if(fingerprintScinceCompactProfile(profile)!==s.officialBaseProfile2020.profileFingerprint ||
      fingerprintScinceCompactSelectedObservationSet({...s,observations:verifiedObservations})!==s.selectedObservationSetFingerprint ||
      fingerprintScinceCompactSnapshotV2(s)!==s.audit.contentFingerprint)sourceInvalid();
    const indicators=catalog.variables.filter(v=>v.statisticalType!=='IDENTIFIER').map((v,i)=>({variableCode:v.variableCode,officialName:v.officialName,dimension:v.dimension,
      value:profile.aggregateValues[i],status:profile.aggregateStatuses[i],method:profile.aggregateMethods[i],reasonCode:profile.aggregateReasonCodes[i]}));
    return {materialization:'PASS',context:{version:SCINCE_CONTEXT_MATERIALIZATION_VERSION,purpose,projectBinding:s.projectBinding,geographyBinding:s.geographyBinding,
      datasetIdentity:s.datasetIdentity,releaseIdentity:s.releaseIdentity,catalogIdentity:s.catalogIdentity,normalizationIdentity:s.normalizationIdentity,
      analysisArea:s.analysisArea,topology:s.topology,territorialUnits:s.territorialUnits,observations,partitionEvidence:s.partitionEvidence,
      officialBaseProfile2020:{...profile,profileFingerprint:s.officialBaseProfile2020.profileFingerprint},indicators,provenance:s.sourceIdentity.provenance,
      limitations:[...profile.limitations],verification:{selectedObservationSetFingerprint:s.selectedObservationSetFingerprint,
        profileFingerprint:s.officialBaseProfile2020.profileFingerprint,contentFingerprint:s.audit.contentFingerprint},
      toJSON():never {throw new Error('SCINCE_MATERIALIZED_CONTEXT_SERVER_ONLY');}}};
  }catch{return reject('SCINCE_MATERIALIZATION_SOURCE_INVALID');}
}
