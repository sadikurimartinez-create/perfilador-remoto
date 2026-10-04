jest.mock('server-only',()=>({}),{virtual:true});
jest.mock('@/lib/db',()=>({getPool:jest.fn(()=>{throw new Error('LIVE_DB_FORBIDDEN');})}));
jest.mock('@/lib/firebaseAdmin',()=>({getInstitutionalAdminDb:jest.fn(()=>{throw new Error('LIVE_FIRESTORE_FORBIDDEN');})}));
jest.mock('@/services/institutionalProjectAccessService',()=>({authorizeInstitutionalProjectAccess:jest.fn()}));
jest.mock('@/lib/osintActions',()=>({getCanonicalScinceData:jest.fn()}));
jest.mock('next/headers',()=>({cookies:jest.fn()}));
import {getPool} from '../src/lib/db';
import {getInstitutionalAdminDb} from '../src/lib/firebaseAdmin';
import {authorizeInstitutionalProjectAccess} from '../src/services/institutionalProjectAccessService';
import {getCanonicalScinceData} from '../src/lib/osintActions';
import {cookies} from 'next/headers';
import {prepareScinceContextIncorporation,getScinceContextFreshness} from '../src/lib/scinceHumanContextActions';
import {createScinceHumanContextFlow} from '../src/utils/scinceHumanContextFlow';
import {buildScinceReviewView} from '../src/utils/scinceCompactSnapshot';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import ts from 'typescript';
import {catalog,catalogFingerprint,NORMALIZATION_VERSION,normalizeRow,legacyCounts} from '../src/lib/scinceCatalogCore.cjs';
import {serializeCanonicalGeographyForFirestore,type CanonicalProjectGeography} from '../src/utils/canonicalProjectGeography';
import {fingerprintScinceCoverageGeography} from '../src/utils/scinceCanonicalCoverage';
import {buildScinceCompactProfile,fingerprintScinceCompactObservation,fingerprintScinceCompactColumnOrder,fingerprintScinceCompactIndicatorOrder,
  fingerprintScinceCompactProfile,fingerprintScinceCompactSnapshotV2,fingerprintScinceCompactSelectedObservationSet,isScinceCompactSnapshotV2} from '../src/utils/scinceCompactSnapshot';
import {resolveInegiMultiunit,SCINCE_MULTIUNIT_SQL} from '../src/lib/inegiMultiunitResolver';
import {SCINCE_RELEASE_SQL,SCINCE_EXACT_RELEASE_SQL,SCINCE_OBSERVATIONS_SQL,createScinceMaterializationRepository,
  type ScinceMaterializationRepository,type ScinceDurableObservationRow} from '../src/lib/scinceObservationRepository';
import {SCINCE_ANALYSIS_AREA_SQL} from '../src/lib/scinceAnalysisArea';
import {readScinceCanonicalGeography} from '../src/utils/scinceQueryGeometry';
import {resolveScinceCanonicalContext} from '../src/services/scinceCanonicalContextService';
import {materializeScinceContext,projectMaterializedScinceDocument} from '../src/services/scinceContextMaterializationService';
import {resolveScinceDocumentPublication} from '../src/services/scinceDocumentPublicationService';
import {scinceDocumentFacts,scinceDocumentSummary,scinceDocumentLimitations} from '../src/utils/scinceDocumentContext';
import {buildScinceReportCover} from '../src/utils/scinceReportCover';
import {buildScinceCanonicalSnapshot} from '../src/utils/scinceCanonicalSnapshot';
import {canonicalSemanticValue} from '../src/utils/institutionalDocumentSemanticIntegrity';
import type {ScinceCompactSnapshotInput,ScinceCompactSnapshotV2,ScinceMaterializationPurpose} from '../src/types/scinceCompactSnapshot';
import type {ProjectAccessResult,ProjectAccessAction} from '../src/types/institutionalProjectAccess';
import type {ScinceCoverageRelation} from '../src/types/scinceCanonicalCoverage';
import type {ScinceMultiunitObservation} from '../src/types/scinceMultiunit';
import * as officialProfile from '../src/utils/scinceOfficialProfile';
const publicRow=require('./fixtures/inegi/scince-cpv2020-public-rows.json').rows.find((r:Record<string,string|null>)=>r.MZA==='001');
// Explicit synthetic topology facts; no live or GEOS certification is claimed.
function input(): ScinceCompactSnapshotInput {
  const canonical:CanonicalProjectGeography={geographyId:'COMPACT_SYNTHETIC',type:'POLYGON',geometry:{type:'Polygon',coordinates:[[[-102,21],[-101.999,21],[-101.999,21.001],[-102,21.001],[-102,21]]]},validationStatus:'VALID',source:'MAP_VECTOR',createdAt:0,updatedAt:0};
  const fp=fingerprintScinceCoverageGeography(canonical);
  const observations=Array.from({length:52},(_,i)=>{
    const mza=String(i+1).padStart(3,'0'),raw:Record<string,string|null>={...publicRow,ENTIDAD:'01',MUN:'001',LOC:'0001',AGEB:'0017',MZA:mza};
    return {geographicLevel:'MANZANA' as const,sourceRowKey:`01:001:0001:0017:${mza}`,geographicCode:`0100100010017${mza}`,
      relationToAnalysis:'ANALYSIS_COVERS_UNIT' as const,usage:'FULL_SOURCE_UNIT_CONTEXT_ONLY' as const,
      rawValues:catalog.variables.map(v=>raw[v.variableCode]??null)};
  });
  const partition={selectedObservationIndexes:observations.map((_,i)=>i),sameLevel:true as const,disjointInteriors:true,aggregationMethod:'FULL_DISJOINT_SOURCE_UNITS_ONLY' as const};
  const radius=500;
  return {schemaVersion:'SCINCE_COMPACT_SNAPSHOT_V2',encodingVersion:'SCINCE_RAW_COLUMN_VECTOR_V1',projectBinding:{projectId:'COMPACT_OFFLINE'},
    geographyBinding:{geographyId:canonical.geographyId,geographyType:'POLYGON',geometry:serializeCanonicalGeographyForFirestore(canonical)!,geographyFingerprint:fp,fingerprintVersion:'SCINCE_COVERAGE_FINGERPRINT_V1'},
    datasetIdentity:{datasetId:'synthetic-offline',referenceYear:2020,version:'fixture-v1'},releaseIdentity:{releaseId:'synthetic-release',observationSetFingerprint:'a'.repeat(64)},
    catalogIdentity:{catalogVersion:catalog.catalogVersion,catalogFingerprint,columnOrderFingerprint:fingerprintScinceCompactColumnOrder(),indicatorOrderFingerprint:fingerprintScinceCompactIndicatorOrder()},
    normalizationIdentity:{normalizationVersion:NORMALIZATION_VERSION},sourceIdentity:{source:'INEGI_CPV2020_LOCAL_POSTGIS',normalizer:'SCINCE_MULTIUNIT_NORMALIZER_V1',
      provenance:{productName:'SYNTHETIC_QA_ONLY',geographySourceUrl:'https://www.inegi.org.mx/fixture',censusSourceUrl:catalog.sourceUrl,geographySha256:'b'.repeat(64),censusSha256:catalog.sourceZipSha256,importedAt:'2026-01-01T00:00:00Z',completedAt:'2026-01-02T00:00:00Z'}},
    analysisArea:{version:'SCINCE_ANALYSIS_AREA_V1',center:{lat:21,lng:-102},coverageRadiusMeters:100,contextExpansionMeters:400,analysisRadiusMeters:radius,
      constructionRadiusMeters:radius/Math.cos(Math.PI/128),approximateAreaSquareMeters:10000,geometryType:'Polygon',geometry:serializeCanonicalGeographyForFirestore({...canonical,geographyId:canonical.geographyId+':area'})!,
      sourceGeometryRevision:fp,sourceGeographyId:canonical.geographyId,calculationMethod:'LOCAL_AEQD_WGS84_CIRCUMSCRIBED_128_V1',centerMethod:'METRIC_MINIMUM_BOUNDING_CIRCLE',projection:'+proj=aeqd +units=m',
      configuration:{version:'SCINCE_RADIUS_CONFIG_V1',governanceReference:'SYNTHETIC_QA_ONLY',individualBaseRadiusMeters:300,lineContextExpansionMeters:200,polygonContextExpansionMeters:400},containmentVerified:true},
    topology:{crs:4326,engine:'GEOS',engineVersion:'SYNTHETIC_CONTRACT_FACTS',isValid:true,isSimple:true,isEmpty:false,area:0.000001},
    territorialUnits:observations.map((o,i)=>({geographicLevel:'MANZANA',geographicCode:o.geographicCode,geographicName:'Synthetic unit',geographyId:String(i+1),geometryFingerprint:'c'.repeat(64),coverageRelation:o.relationToAnalysis,intersectionType:'FULL_UNIT',
      coverageMetrics:{measure:'SQUARE_METRES',intersection:100,analysis:10000,unitArea:100,analysisFraction:0.01,unitAreaFraction:1},observationIndexes:[i]})),
    observations,partitionEvidence:partition,officialBaseProfile2020:buildScinceCompactProfile(observations.map(o=>({...o,observationFingerprint:fingerprintScinceCompactObservation(o)})),partition,['Official 2020; no areal proration; synthetic QA facts.']),
    ppcReview:{status:'REQUIRES_PPC_REVIEW',decision:null,institutionalUserId:null,incorporatedAt:null},freshness:{status:'CURRENT',evaluatedAt:'2026-01-03T00:00:00Z',reasonCode:null},
    audit:{acquiredAt:'2026-01-03T00:00:00Z',observedAt:null,contractVersion:'SCINCE_COMPACT_CONTRACT_V1',materializerVersion:'SCINCE_COMPACT_CODEC_V1'}};
}
function resolverFixture(relations:ScinceCoverageRelation[]=Array(52).fill('ANALYSIS_COVERS_UNIT'),large=false) {
  const fixture=input(),canonical=readScinceCanonicalGeography(fixture.geographyBinding.geometry);
  if(!canonical)throw new Error('FIXTURE_INVALID');
  const p=fixture.sourceIdentity.provenance,a=fixture.analysisArea;
  const rows=fixture.observations.map((o,i)=>{
    const raw=Object.fromEntries(catalog.variables.map((v,j)=>[v.variableCode,o.rawValues![j]]));
    if(large)raw.NOM_LOC='x'.repeat(20000);
    const demographics=legacyCounts(raw,'MANZANA');
    const relation=relations[i],touch=relation==='TOUCHES_ONLY';
    return {raw,geographic_level:'MANZANA',source_row_key:o.sourceRowKey,source_cvegeo:o.geographicCode,geography_id:String(i+1),geographic_name:'Synthetic unit',
      geometry:JSON.stringify(canonical.geometry),srid:4326,is_valid:true,is_simple:true,is_empty:false,area:0.000001,
      intersects:true,touches:touch,covers_gu:relation==='ANALYSIS_COVERS_UNIT',covers_ug:false,equals:false,relate:touch?'FF2F11212':'212FF1FF2',
      intersection_measure:touch?0:relation==='INTERIOR_INTERSECTION'?50:100,unit_area:100,analysis_measure:10000,
      pobtot:demographics.populationTotal,vivtot:demographics.housingTotal,vivpar_hab:demographics.inhabitedPrivateHousing,vivpar_deshab:demographics.uninhabitedPrivateHousing};
  });
  const query=jest.fn(async(sql:string,params?:unknown[])=>{
    if(sql.startsWith('BEGIN')||sql.startsWith('SET')||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
    if(sql.includes('FROM public.inegi_territorial_dataset'))return {rows:[{dataset_id:fixture.datasetIdentity.datasetId,reference_year:2020,version:fixture.datasetIdentity.version,
      product_name:p.productName,geography_source_url:p.geographySourceUrl,census_source_url:p.censusSourceUrl,geography_sha256:p.geographySha256,census_sha256:p.censusSha256,imported_at:p.importedAt,completed_at:p.completedAt}]};
    if(sql===SCINCE_RELEASE_SQL || sql===SCINCE_EXACT_RELEASE_SQL)return {rows:[{release_id:fixture.releaseIdentity.releaseId,dataset_id:fixture.datasetIdentity.datasetId,catalog_version:catalog.catalogVersion,
      normalization_version:NORMALIZATION_VERSION,observation_set_fingerprint:fixture.releaseIdentity.observationSetFingerprint,catalog_fingerprint:catalogFingerprint,catalog}]};
    if(sql===SCINCE_ANALYSIS_AREA_SQL)return {rows:[{geometry:JSON.stringify(canonical.geometry),lat:a.center.lat,lng:a.center.lng,coverage_radius:a.coverageRadiusMeters,analysis_radius:a.analysisRadiusMeters,
      construction_radius:a.constructionRadiusMeters,area_square_meters:a.approximateAreaSquareMeters,projection:a.projection,source_valid:true,source_simple:true,contains_source:true,area_valid:true,area_empty:false}]};
    if(sql.includes('postgis_geos_version'))return {rows:[{srid:4326,is_valid:true,is_simple:true,is_empty:false,area:0.000001,engine_version:'SYNTHETIC_CONTRACT_FACTS'}]};
    if(sql===SCINCE_MULTIUNIT_SQL)return {rows};
    if(sql===SCINCE_OBSERVATIONS_SQL) {
      const requested=String(params?.[1]);
      return {rows:rows.filter(r=>requested.includes(r.source_row_key)).map(r=>({geographic_level:r.geographic_level,source_row_key:r.source_row_key,raw_source:r.raw,observations:normalizeRow(r.raw,'MANZANA',r.source_row_key)}))};
    }
    if(sql.includes('AS disjoint'))return {rows:[{disjoint:true}]};
    throw new Error('UNEXPECTED_OFFLINE_QUERY');
  });
  return {fixture,canonical,query,source:{connect:jest.fn(async()=>({query,release:jest.fn()}))}};
}

let snapshot:ScinceCompactSnapshotV2,legacy:ScinceMultiunitObservation;
beforeAll(async()=>{
  const db=resolverFixture(),references:ScinceMultiunitObservation[]=[],original=officialProfile.buildOfficialBaseProfile2020;
  const capture=jest.spyOn(officialProfile,'buildOfficialBaseProfile2020').mockImplementation((m,r,o)=>{references.push(m);return original(m,r,o);});
  try {
    const result=await resolveInegiMultiunit(db.fixture.projectBinding.projectId,db.canonical,db.source,db.fixture.analysisArea.configuration);
    if(!result.success || result.observation.schemaVersion!=='SCINCE_COMPACT_SNAPSHOT_V2')throw new Error('COMPACT_FIXTURE_FAILED');
    snapshot=result.observation;legacy=references[0];
  }finally{capture.mockRestore();}
},60000);
const purposes:ScinceMaterializationPurpose[]=['UI','IA','PPC','REPORT'];
const actions:Record<ScinceMaterializationPurpose,ProjectAccessAction>={UI:'ANALYZE_SCINCE',IA:'ANALYZE_SCINCE',PPC:'WRITE',REPORT:'GENERATE_REPORT'};
function authorized(purpose:ScinceMaterializationPurpose='UI'):ProjectAccessResult {
  const action=actions[purpose],projectId=snapshot.projectBinding.projectId;
  return {allowed:true,actor:{institutionalUserId:'1',username:'OFFLINE',role:'USER'},projectId,action,
    project:{canonicalGeography:structuredClone(snapshot.geographyBinding.geometry)},authorizationBasis:'EXPLICIT_ACTIVE_ACTION_GRANT',policyVersion:'EXPLICIT_ACTION_GRANT_V1',
    audit:{correlationId:'offline',institutionalUserId:'1',username:'OFFLINE',role:'USER',projectId,action,outcome:'ALLOW',authorizationBasis:'EXPLICIT_ACTIVE_ACTION_GRANT',
      policyVersion:'EXPLICIT_ACTION_GRANT_V1',timestamp:'2026-01-03T00:00:00Z'}};
}
function repository() {
  const db=resolverFixture(),base=createScinceMaterializationRepository({query:db.query});
  return {...db,repo:{readExactRelease:jest.fn(base.readExactRelease),readReferencedObservations:jest.fn(base.readReferencedObservations)}};
}
const changed=(mutate:(s:ScinceCompactSnapshotV2)=>void)=>{const s=structuredClone(snapshot);mutate(s);return s;};
function rehash(s:ScinceCompactSnapshotV2) {
  s.observations.forEach(o=>o.observationFingerprint=fingerprintScinceCompactObservation(o));
  s.selectedObservationSetFingerprint=fingerprintScinceCompactSelectedObservationSet(s);
  s.officialBaseProfile2020.profileFingerprint=fingerprintScinceCompactProfile(s.officialBaseProfile2020);
  s.audit.contentFingerprint=fingerprintScinceCompactSnapshotV2(s);s.ppcReview.reviewedContentFingerprint=s.audit.contentFingerprint;
  return s;
}

test('52-unit materialization verifies durable observations and preserves expanded semantics',async()=>{
  const db=repository(),before=JSON.stringify(snapshot),result=await materializeScinceContext(snapshot,'UI',authorized(),db.repo);
  expect(result.materialization).toBe('PASS');if(result.materialization!=='PASS')throw new Error(result.code);
  const m=result.context,profile=legacy.officialBaseProfile2020;if(!profile)throw new Error('LEGACY_REQUIRED');
  expect(m.version).toBe('SCINCE_CONTEXT_MATERIALIZATION_V1');expect(m.territorialUnits).toHaveLength(52);expect(m.observations).toHaveLength(52);
  expect(m.datasetIdentity).toEqual({datasetId:legacy.dataset.datasetId,referenceYear:legacy.dataset.year,version:legacy.dataset.version});
  expect(m.geographyBinding).toMatchObject(legacy.geographyBinding);expect(m.analysisArea).toEqual(legacy.scinceAnalysisArea);expect(m.topology).toEqual(legacy.topology);
  expect(m.territorialUnits.map(u=>[u.geographicLevel,u.geographicCode,u.intersectionType,u.coverageRelation,u.coverageMetrics]))
    .toEqual(legacy.unitDetails.map(u=>[u.unitType,u.inegiCode,u.intersectionType,u.relation,u.coverageMetric]));
  expect(m.indicators).toHaveLength(222);
  m.indicators.forEach((v,i)=>{
    const a=profile.admissibleAggregates.find(a=>a.name===v.variableCode);
    expect(v.value).toBe(a?.value??null);expect(v.method).toBe(a?.method??'NOT_AGGREGATED');expect(v.reasonCode).toBe(a?.reason??null);
    expect(v.status).toBe(a?.value==null?'NOT_AGGREGATED':'ADMISSIBLE');expect(m.officialBaseProfile2020.aggregateValues[i]).toBe(v.value);
  });
  m.observations.forEach(o=>{
    expect(o.rawValues).toHaveLength(230);expect(o.normalizedValues).toHaveLength(230);
    o.normalizedValues!.forEach(v=>{
      const original=profile.rawIndicators.find(r=>r.sourceRowKey===o.sourceRowKey && r.variableCode===v.variableCode);
      if(!original)throw new Error('ORIGINAL_REQUIRED');
      expect([v.rawValue,v.typedValue,v.valueStatus,v.nullReason]).toEqual([original.rawValue,original.typedValue,original.valueStatus,original.nullReason]);
      expect(v.sourceReference).toBe(original.sourceReference);expect(o.sourceReference).toBe(original.sourceReference);
    });
  });
  expect(m.officialBaseProfile2020.derivedIndicators.map(d=>[d.name,d.formula])).toEqual(profile.derivedIndicators.map(d=>[d.name,d.formula]));
  m.officialBaseProfile2020.derivedIndicators.forEach((d,i)=>expect(d.value).toBeCloseTo(profile.derivedIndicators[i].value,12));
  expect(m.limitations).toEqual(legacy.limitations);expect(m.provenance).toEqual(legacy.dataset.provenance);
  expect(m.partitionEvidence).toEqual(snapshot.partitionEvidence);expect(m.verification.contentFingerprint).toBe(snapshot.audit.contentFingerprint);
  expect(db.repo.readExactRelease).toHaveBeenCalledWith(snapshot.datasetIdentity.datasetId,snapshot.releaseIdentity.releaseId);
  expect(db.repo.readReferencedObservations).toHaveBeenCalledWith(snapshot.releaseIdentity.releaseId,expect.any(Array));
  expect(db.query.mock.calls.some(([sql])=>sql===SCINCE_RELEASE_SQL)).toBe(false);
  expect(db.query.mock.calls.every(([sql])=>sql.startsWith('SELECT'))).toBe(true);
  expect(JSON.stringify(snapshot)).toBe(before);
  expect(()=>JSON.stringify(m)).toThrow('SCINCE_MATERIALIZED_CONTEXT_SERVER_ONLY');
  const bytes=Buffer.byteLength(before,'utf8');expect(bytes).toBeLessThan(800000);console.log(`SCINCE_V23_COMPACT_PAYLOAD_BYTES=${bytes}`);
});

test.each(purposes)('purpose %s verifies the identical profile under its explicit action',async purpose=>{
  const db=repository(),result=await materializeScinceContext(snapshot,purpose,authorized(purpose),db.repo);
  if(result.materialization!=='PASS')throw new Error(result.code);
  expect(result.context.officialBaseProfile2020).toEqual(snapshot.officialBaseProfile2020);
  expect(result.context.purpose).toBe(purpose);
});

test('repeated materialization is deterministic and does not cache verification',async()=>{
  const db=repository(),first=await materializeScinceContext(snapshot,'UI',authorized(),db.repo),second=await materializeScinceContext(snapshot,'UI',authorized(),db.repo);
  if(first.materialization!=='PASS' || second.materialization!=='PASS')throw new Error('PASS_REQUIRED');
  expect(second.context.observations).toEqual(first.context.observations);expect(second.context.officialBaseProfile2020).toEqual(first.context.officialBaseProfile2020);
  expect(second.context.verification).toEqual(first.context.verification);expect(db.repo.readExactRelease).toHaveBeenCalledTimes(2);expect(db.repo.readReferencedObservations).toHaveBeenCalledTimes(2);
});

test.each([
  ['column order',(s:ScinceCompactSnapshotV2)=>s.catalogIdentity.columnOrderFingerprint='bad'],
  ['indicator order',(s:ScinceCompactSnapshotV2)=>s.catalogIdentity.indicatorOrderFingerprint='bad'],
  ['normalization',(s:ScinceCompactSnapshotV2)=>s.normalizationIdentity.normalizationVersion='future'],
  ['observation fingerprint',(s:ScinceCompactSnapshotV2)=>s.observations[0].observationFingerprint='bad'],
  ['selected set',(s:ScinceCompactSnapshotV2)=>s.selectedObservationSetFingerprint='bad'],
  ['profile',(s:ScinceCompactSnapshotV2)=>s.officialBaseProfile2020.profileFingerprint='bad'],
  ['partition',(s:ScinceCompactSnapshotV2)=>s.partitionEvidence.selectedObservationIndexes.pop()],
  ['content',(s:ScinceCompactSnapshotV2)=>s.audit.contentFingerprint='bad'],
  ['raw cardinality',(s:ScinceCompactSnapshotV2)=>s.observations[0].rawValues!.pop()],
  ['aggregate cardinality',(s:ScinceCompactSnapshotV2)=>s.officialBaseProfile2020.aggregateValues.pop()],
] as const)('rejects snapshot %s before repository access',async(_,mutate)=>{
  const db=repository(),result=await materializeScinceContext(changed(mutate),'UI',authorized(),db.repo);
  expect(result).toEqual({materialization:'REJECTED',code:'SCINCE_MATERIALIZATION_CONTRACT_INVALID'});
  expect(db.repo.readExactRelease).not.toHaveBeenCalled();expect(db.query).not.toHaveBeenCalled();
});

test('unknown schema, encoding and legacy cannot be silently materialized',async()=>{
  for(const s of [{...snapshot,schemaVersion:'UNKNOWN'},{...snapshot,encodingVersion:'UNKNOWN'},legacy]) {
    const db=repository();expect((await materializeScinceContext(s,'UI',authorized(),db.repo)).materialization).toBe('REJECTED');expect(db.query).not.toHaveBeenCalled();
  }
});

test.each(['missing release','wrong release','wrong dataset','catalog mismatch','catalog source modified','normalization mismatch','global set mismatch'])('rejects durable %s',async issue=>{
  const db=repository(),original=db.repo.readExactRelease.getMockImplementation()!;
  db.repo.readExactRelease.mockImplementation(async(...args)=>{
    const exact=await original(...args);if(!exact)throw new Error('FIXTURE_REQUIRED');
    if(issue==='missing release')return null;
    if(issue==='wrong release')exact.release.releaseId='OTHER';
    if(issue==='wrong dataset')exact.release.datasetId='OTHER';
    if(issue==='catalog mismatch')exact.release.catalogFingerprint='d'.repeat(64);
    if(issue==='catalog source modified')exact.catalog={untrusted:true};
    if(issue==='normalization mismatch')exact.release.normalizationVersion='OTHER';
    if(issue==='global set mismatch')exact.release.observationSetFingerprint='d'.repeat(64);
    return exact;
  });
  expect((await materializeScinceContext(snapshot,'UI',authorized(),db.repo)).materialization).toBe('REJECTED');expect(db.repo.readReferencedObservations).not.toHaveBeenCalled();
});

test.each(['missing observation','duplicate observation','wrong row release','wrong key','raw modified','raw cardinality','typed modified'])('rejects durable %s',async issue=>{
  const db=repository(),original=db.repo.readReferencedObservations.getMockImplementation()!;
  db.repo.readReferencedObservations.mockImplementation(async(...args)=>{
    const rows=await original(...args);
    if(issue==='missing observation')rows.pop();if(issue==='duplicate observation')rows[1]=rows[0];if(issue==='wrong row release')rows[0].releaseId='OTHER';
    if(issue==='wrong key')rows[0].sourceRowKey='OTHER';if(issue==='raw modified')rows[0].rawValues[10]='999';if(issue==='raw cardinality')rows[0].rawValues.pop();
    if(issue==='typed modified') {
      const values=rows[0].observations;if(!Array.isArray(values))throw new Error('FIXTURE_REQUIRED');
      values[10].typedValue=999;
    }
    return rows;
  });
  expect((await materializeScinceContext(snapshot,'UI',authorized(),db.repo)).materialization).toBe('REJECTED');
});

test('rehashed tampered observation and profile cannot override durable truth',async()=>{
  const s=changed(s=>s.observations[0].rawValues![catalog.variables.findIndex(v=>v.variableCode==='POBTOT')]='999');
  s.officialBaseProfile2020={...buildScinceCompactProfile(s.observations,s.partitionEvidence,s.officialBaseProfile2020.limitations),profileFingerprint:''};rehash(s);
  expect(isScinceCompactSnapshotV2(s)).toBe(true);
  const db=repository();expect((await materializeScinceContext(s,'UI',authorized(),db.repo)).materialization).toBe('REJECTED');
});

test.each(['denied','wrong action','wrong project','no explicit basis','invalid audit','changed geography','admin denied'])('rejects authorization: %s before any read',async issue=>{
  const db=repository(),access=authorized();if(!access.allowed)throw new Error('ALLOW_REQUIRED');
  let value:ProjectAccessResult=access;
  if(issue==='denied' || issue==='admin denied')value={allowed:false,code:'PROJECT_ACCESS_DENIED',audit:{...access.audit,outcome:'DENY',role:issue==='admin denied'?'SUPER_ADMIN':'USER'}};
  if(issue==='wrong action')access.action='READ';if(issue==='wrong project')access.projectId='OTHER';if(issue==='no explicit basis')access.policyVersion='UNACCREDITED';
  if(issue==='invalid audit')access.audit.outcome='DENY';if(issue==='changed geography')access.project.canonicalGeography=null;
  expect(await materializeScinceContext(snapshot,'UI',value,db.repo)).toEqual({materialization:'REJECTED',code:'SCINCE_MATERIALIZATION_UNAUTHORIZED'});
  expect(db.query).not.toHaveBeenCalled();expect(db.repo.readExactRelease).not.toHaveBeenCalled();
});

test.each(['PPC','REPORT'] as const)('ANALYZE_SCINCE does not authorize %s',async purpose=>{
  const db=repository();expect((await materializeScinceContext(snapshot,purpose,authorized('UI'),db.repo)).materialization).toBe('REJECTED');expect(db.query).not.toHaveBeenCalled();
});

test('null, suppression and enumeration-only remain distinct from zero',async()=>{
  const s=structuredClone(snapshot),db=repository(),missing=catalog.variables.findIndex(v=>v.variableCode==='PDER_IMSS'),suppressed=catalog.variables.findIndex(v=>v.variableCode==='PCON_DISC');
  s.observations[0].rawValues![missing]=null;s.observations[0].rawValues![suppressed]='*';
  s.observations[1]={...s.observations[1],usage:'ENUMERATION_ONLY',rawValues:null,relationToAnalysis:'TOUCHES_ONLY'};
  Object.assign(s.territorialUnits[1],{coverageRelation:'TOUCHES_ONLY',intersectionType:'TOUCHED_UNIT',coverageMetrics:{...s.territorialUnits[1].coverageMetrics,intersection:0,analysisFraction:0,unitAreaFraction:0}});
  s.partitionEvidence.selectedObservationIndexes=s.partitionEvidence.selectedObservationIndexes.filter(i=>i!==1);
  s.officialBaseProfile2020={...buildScinceCompactProfile(s.observations,s.partitionEvidence,s.officialBaseProfile2020.limitations),profileFingerprint:''};rehash(s);
  const original=db.repo.readReferencedObservations.getMockImplementation()!;
  db.repo.readReferencedObservations.mockImplementation(async(...args)=>{
    const rows=await original(...args);rows[0].rawValues[missing]=null;rows[0].rawValues[suppressed]='*';
    const raw=Object.fromEntries(catalog.variables.map((v,i)=>[v.variableCode,rows[0].rawValues[i]]));rows[0].observations=normalizeRow(raw,'MANZANA',rows[0].sourceRowKey);return rows;
  });
  const result=await materializeScinceContext(s,'UI',authorized(),db.repo);if(result.materialization!=='PASS')throw new Error(result.code);
  expect(result.context.observations[0].normalizedValues![missing]).toMatchObject({typedValue:null,valueStatus:'MISSING'});
  expect(result.context.observations[0].normalizedValues![suppressed]).toMatchObject({typedValue:null,valueStatus:'SUPPRESSED'});
  expect(result.context.observations[1]).toMatchObject({usage:'ENUMERATION_ONLY',rawValues:null,normalizedValues:null});
  expect(result.context.partitionEvidence.selectedObservationIndexes).not.toContain(1);
});

test('MATERIALIZED_CONTEXT_NOT_RETURNED_BY_CANONICAL_PUBLIC_RESULT',async()=>{
  const access=authorized(),authorize=jest.fn(async()=>access),db=resolverFixture();
  const result=await resolveScinceCanonicalContext({projectId:snapshot.projectBinding.projectId},'offline',{authorize,resolveMultiunit:jest.fn(async()=>({success:true as const,observation:snapshot}))});
  if(!result.success)throw new Error(result.code);
  expect(result.compactSnapshot).toBe(snapshot);expect(result.multiunit).toBeUndefined();expect(result).not.toHaveProperty('normalizedValues');expect(result).not.toHaveProperty('materializedContext');
  expect(JSON.stringify(result)).not.toContain('normalizedValues');expect(db.query).not.toHaveBeenCalled();
});

test('repository uses exact pinned release even if latest differs; rows are requested in bounded batches',async()=>{
  const db=repository();const exact=await db.repo.readExactRelease(snapshot.datasetIdentity.datasetId,snapshot.releaseIdentity.releaseId);
  expect(exact?.release.releaseId).toBe(snapshot.releaseIdentity.releaseId);expect(db.query).toHaveBeenCalledWith(SCINCE_EXACT_RELEASE_SQL,[snapshot.datasetIdentity.datasetId,snapshot.releaseIdentity.releaseId]);
  expect(SCINCE_EXACT_RELEASE_SQL).not.toMatch(/ORDER BY r.created_at/);expect(SCINCE_EXACT_RELEASE_SQL).toContain('r.release_id=$2');
  const refs=Array.from({length:201},(_,i)=>({geographicLevel:'MANZANA' as const,sourceRowKey:`01:001:0001:0017:${String(i+1).padStart(3,'0')}`}));
  db.query.mockImplementation(async(sql,params)=>{
    if(sql!==SCINCE_OBSERVATIONS_SQL)throw new Error('ONLY_REFERENCED_SELECT');
    const requested:Array<{level:'MANZANA';key:string}>=JSON.parse(String(params?.[1]));
    return {rows:requested.map(r=>{const raw={...publicRow,MZA:r.key.split(':').at(-1)};return {geographic_level:r.level,source_row_key:r.key,raw_source:raw,observations:normalizeRow(raw,r.level,r.key)};})};
  });
  const rows=await db.repo.readReferencedObservations(snapshot.releaseIdentity.releaseId,refs);expect(rows).toHaveLength(201);
  expect(db.query.mock.calls.filter(([sql])=>sql===SCINCE_OBSERVATIONS_SQL)).toHaveLength(3);
});

test('repository errors are sanitized and fail closed without logging source data',async()=>{
  const db=repository();db.repo.readExactRelease.mockRejectedValue(new Error('private SQL and source data'));
  expect(await materializeScinceContext(snapshot,'UI',authorized(),db.repo)).toEqual({materialization:'REJECTED',code:'SCINCE_MATERIALIZATION_SOURCE_INVALID'});
});

test.each(['missing release','ambiguous release','misbound release','corrupt catalog','missing cell','unexpected row','missing row'])('exact repository rejects %s',async issue=>{
  const db=repository(),original=db.query.getMockImplementation()!;
  db.query.mockImplementation(async(...args)=>{
    const result=await original(...args);
    if(args[0]===SCINCE_EXACT_RELEASE_SQL) {
      if(issue==='missing release')return {rows:[]};
      if(issue==='ambiguous release')return {rows:[...result.rows,...result.rows]};
      if(issue==='misbound release')return {rows:result.rows.map(r=>({...r,release_id:'OTHER'}))};
      if(issue==='corrupt catalog')return {rows:result.rows.map(r=>({...r,catalog:{untrusted:true}}))};
    }
    if(args[0]===SCINCE_OBSERVATIONS_SQL) {
      if(issue==='missing row')return {rows:result.rows.slice(1)};
      if(issue==='unexpected row')return {rows:result.rows.map((r,i)=>i===0?{...r,source_row_key:'OTHER'}:r)};
      if(issue==='missing cell')return {rows:result.rows.map((r,i)=>{
        if(i!==0 || !('raw_source' in r))return r;
        const raw={...r.raw_source};delete raw.NOM_LOC;return {...r,raw_source:raw};
      })};
    }
    return result;
  });
  expect((await materializeScinceContext(snapshot,'UI',authorized(),db.repo)).materialization).toBe('REJECTED');
});

const radiusKeys=['SCINCE_DEFAULT_RADIUS_M','SCINCE_LINE_CONTEXT_EXPANSION_M','SCINCE_POLYGON_CONTEXT_EXPANSION_M','SCINCE_RADIUS_GOVERNANCE_REFERENCE'] as const;
const initialRadiusValues=radiusKeys.map(key=>process.env[key]);
afterEach(()=>{radiusKeys.forEach((key,i)=>{if(initialRadiusValues[i]===undefined)delete process.env[key];else process.env[key]=initialRadiusValues[i];});});
async function ppcHarness(denied:ProjectAccessAction[]=[]){
  const db=repository(),reviewed=await resolveScinceCanonicalContext({projectId:snapshot.projectBinding.projectId},'offline',{
    authorize:async()=>authorized('UI'),resolveMultiunit:async()=>({success:true,observation:structuredClone(snapshot)})});
  if(!reviewed.success)throw new Error(reviewed.code);
  Object.assign(process.env,{SCINCE_DEFAULT_RADIUS_M:'300',SCINCE_LINE_CONTEXT_EXPANSION_M:'200',SCINCE_POLYGON_CONTEXT_EXPANSION_M:'400',SCINCE_RADIUS_GOVERNANCE_REFERENCE:'SYNTHETIC_QA_ONLY'});
  jest.mocked(authorizeInstitutionalProjectAccess).mockImplementation(async input=>{
    const access=authorized(input.action==='WRITE'?'PPC':'UI');if(!access.allowed)throw new Error('FIXTURE_REQUIRED');
    access.action=input.action==='READ'?'READ':input.action==='WRITE'?'WRITE':'ANALYZE_SCINCE';access.audit.action=access.action;
    if(denied.includes(access.action))return {allowed:false,code:'PROJECT_ACCESS_DENIED',audit:{...access.audit,outcome:'DENY'}};
    return access;
  });
  jest.mocked(cookies).mockReturnValue({get:()=>({value:'offline-session'})} as ReturnType<typeof cookies>);
  jest.mocked(getCanonicalScinceData).mockResolvedValue(reviewed);
  jest.mocked(getPool).mockReturnValue({connect:async()=>({query:db.query,release:jest.fn()})} as ReturnType<typeof getPool>);
  let project:Record<string,unknown>={canonicalGeography:structuredClone(snapshot.geographyBinding.geometry),iaAnalysis:{unrelated:'KEEP'}};
  const ref={id:snapshot.projectBinding.projectId},updates:Array<Record<string,unknown>>=[];
  const transaction={get:jest.fn(async()=>({exists:true,data:()=>structuredClone(project)})),update:jest.fn((_ref:unknown,patch:Record<string,unknown>)=>{updates.push(patch);})};
  const runTransaction=jest.fn(async(worker:(tx:typeof transaction)=>Promise<void>)=>{updates.length=0;await worker(transaction);updates.forEach(p=>{project={...project,...p};});});
  jest.mocked(getInstitutionalAdminDb).mockReturnValue({collection:()=>({doc:()=>ref}),runTransaction} as ReturnType<typeof getInstitutionalAdminDb>);
  const clientWrites=jest.fn(async()=>{}),setAnalysis=jest.fn(),states=jest.fn();
  const flow=createScinceHumanContextFlow({context:()=>({projectId:snapshot.projectBinding.projectId,readOnly:false,canQuery:true,analysis:{unrelated:'KEEP'},territoryRevision:'FIXTURE'}),
    query:async()=>reviewed,prepare:prepareScinceContextIncorporation,updateProjectDetails:clientWrites,setAnalysisResult:setAnalysis,changed:states});
  return {db,reviewed,transaction,runTransaction,clientWrites,setAnalysis,flow,project:()=>project,changeProject:(next:Record<string,unknown>)=>{project=next;}};
}

test('V2.4 consultation, explicit PPC decision and compact server persistence preserve the full contract',async()=>{
  const h=await ppcHarness();await h.flow.consult();expect(h.flow.getState().status).toBe('RESULTADO_DISPONIBLE');expect(h.runTransaction).not.toHaveBeenCalled();
  await h.flow.incorporate();expect(h.flow.getState().status).toBe('INCORPORADO');expect(h.clientWrites).not.toHaveBeenCalled();expect(h.runTransaction).toHaveBeenCalledTimes(1);
  const analysis=h.project().iaAnalysis;if(!analysis || typeof analysis!=='object' || !('scinceCanonicalSnapshot' in analysis))throw new Error('PERSISTED_REQUIRED');
  const saved=analysis.scinceCanonicalSnapshot;if(!isScinceCompactSnapshotV2(saved))throw new Error('COMPACT_REQUIRED');
  expect(saved.ppcReview).toMatchObject({status:'INCORPORATED',decision:'INCORPORATED',institutionalUserId:'1',reviewedContentFingerprint:snapshot.audit.contentFingerprint});
  expect(saved.officialBaseProfile2020).toEqual(snapshot.officialBaseProfile2020);expect(saved.sourceIdentity.provenance).toEqual(snapshot.sourceIdentity.provenance);
  expect(saved.territorialUnits).toEqual(snapshot.territorialUnits);expect(saved.releaseIdentity).toEqual(snapshot.releaseIdentity);expect(saved.catalogIdentity).toEqual(snapshot.catalogIdentity);
  expect(analysis).toHaveProperty('unrelated','KEEP');expect(saved).not.toHaveProperty('normalizedValues');expect(saved).not.toHaveProperty('indicators');
  expect(saved.audit.contentFingerprint).toBe(snapshot.audit.contentFingerprint);
  expect(await getScinceContextFreshness(snapshot.projectBinding.projectId,saved,snapshot.geographyBinding.geometry)).toMatchObject({success:true,freshness:{territorialFreshness:'CURRENT'}});
  const compactBytes=Buffer.byteLength(JSON.stringify(h.reviewed.compactSnapshot),'utf8'),viewBytes=Buffer.byteLength(JSON.stringify(h.reviewed.reviewView),'utf8'),total=Buffer.byteLength(JSON.stringify(h.reviewed),'utf8');
  expect(total).toBeLessThanOrEqual(650000);expect(total).toBeLessThan(800000);
  console.log(`V24_COMPACT_SNAPSHOT_BYTES=${compactBytes};REVIEW_VIEW_BYTES=${viewBytes};TOTAL_CLIENT_RESPONSE_BYTES=${total}`);
});

test.each(['ANALYZE_SCINCE','WRITE'] as const)('V2.4 denied %s prevents incorporation and every write',async action=>{
  const h=await ppcHarness([action]);expect(await prepareScinceContextIncorporation(snapshot.projectBinding.projectId,h.reviewed)).toMatchObject({success:false,code:'ACCESS_DENIED'});
  expect(h.runTransaction).not.toHaveBeenCalled();expect(h.transaction.update).not.toHaveBeenCalled();
});

test.each(['snapshot','review fingerprint','review values','content','profile','fresh geography','changed release','changed catalog','changed observation','radius','transaction geography'])('V2.4 rejects changed %s before persistence',async issue=>{
  const h=await ppcHarness(),reviewed=structuredClone(h.reviewed);
  if(!reviewed.compactSnapshot || !reviewed.reviewView)throw new Error('COMPACT_REQUIRED');
  if(issue==='snapshot')reviewed.compactSnapshot.observations[0].rawValues![10]='999';
  if(issue==='review fingerprint')reviewed.reviewView.reviewFingerprint='bad';if(issue==='review values')reviewed.reviewView.aggregateIndicators[0].value=999;
  if(issue==='content')reviewed.compactSnapshot.audit.contentFingerprint='bad';if(issue==='profile')reviewed.compactSnapshot.officialBaseProfile2020.profileFingerprint='bad';
  if(issue==='fresh geography')jest.mocked(getCanonicalScinceData).mockResolvedValue({...h.reviewed,compactSnapshot:rehash(changed(s=>s.geographyBinding.geographyId='OTHER'))});
  if(issue==='radius')process.env.SCINCE_POLYGON_CONTEXT_EXPANSION_M='450';
  if(issue==='transaction geography')h.changeProject({canonicalGeography:null,iaAnalysis:{unrelated:'KEEP'}});
  if(['changed release','changed catalog','changed observation'].includes(issue)) {
    const original=h.db.query.getMockImplementation()!;
    h.db.query.mockImplementation(async(...args)=>{
      const result=await original(...args);
      if(args[0]===SCINCE_RELEASE_SQL && issue==='changed release')return {rows:result.rows.map(r=>({...r,release_id:'NEW_RELEASE'}))};
      if(args[0]===SCINCE_RELEASE_SQL && issue==='changed catalog')return {rows:result.rows.map(r=>({...r,catalog_version:'FUTURE'}))};
      if(args[0]===SCINCE_OBSERVATIONS_SQL && issue==='changed observation')return {rows:result.rows.slice(1)};
      return result;
    });
  }
  expect((await prepareScinceContextIncorporation(snapshot.projectBinding.projectId,reviewed)).success).toBe(false);expect(h.transaction.update).not.toHaveBeenCalled();
});

test('V2.4 222-slot review view is deterministic, bounded and contains no per-unit expanded arrays',async()=>{
  const h=await ppcHarness(),view=h.reviewed.reviewView;if(!view)throw new Error('REVIEW_REQUIRED');
  expect(view).toEqual(buildScinceReviewView(snapshot));expect(view.aggregateIndicators).toHaveLength(222);
  expect(view.coverageSummary).toEqual({FULL_UNIT:52,PARTIAL_UNIT:0,TOUCHED_UNIT:0});expect(view.provenanceSummary).toEqual(snapshot.sourceIdentity.provenance);
  expect(view).not.toHaveProperty('rawIndicators');expect(view).not.toHaveProperty('rawScinceIndicators');expect(view).not.toHaveProperty('observations');
});

test('V2.4 actual UI renders the compact review without expanded per-unit cells',async()=>{
  const h=await ppcHarness(),compiled=ts.transpileModule(readFileSync(resolve('src/components/ScinceHumanContextPanel.tsx'),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  const module={exports:{} as typeof import('../src/components/ScinceHumanContextPanel')};
  new Function('require','module','exports',compiled)((name:string)=>name==='@/components/ui/CEIPOLButton'?{CEIPOLButton:()=>null}:require(name),module,module.exports);
  const html=renderToStaticMarkup(React.createElement(module.exports.ScinceObservedResult,{result:h.reviewed}));
  expect(html).toContain('scince-compact-result');expect(html).toContain('REQUIERE REVISIÓN PPC');expect(html).toContain('Dato oficial INEGI 2020');
  expect(html).toContain('Unidades: 52');expect(html).toContain('Completas: 52');expect(html).toContain('Radio total');expect(html).toContain('Procedencia INEGI');
  expect(html).toContain('VIGENTE');expect(html).toContain('Sin agregado metodológicamente admisible');expect(html).not.toContain('normalizedValues');
});

test('V2.4 WRITE alone cannot consult or skip the ANALYZE_SCINCE gate',async()=>{
  const h=await ppcHarness(['ANALYZE_SCINCE']),resolver=jest.fn(async()=>({success:true as const,observation:snapshot}));
  expect(await resolveScinceCanonicalContext({projectId:snapshot.projectBinding.projectId},'offline',{resolveMultiunit:resolver})).toMatchObject({success:false,code:'SCINCE_CANONICAL_ACCESS_DENIED'});
  expect(resolver).not.toHaveBeenCalled();expect(h.runTransaction).not.toHaveBeenCalled();
});

test('V2.4 ANALYZE_SCINCE alone can consult but cannot incorporate',async()=>{
  const h=await ppcHarness(['WRITE']),resolver=jest.fn(async()=>({success:true as const,observation:snapshot}));
  expect(await resolveScinceCanonicalContext({projectId:snapshot.projectBinding.projectId},'offline',{resolveMultiunit:resolver})).toMatchObject({success:true,compactSnapshot:{schemaVersion:'SCINCE_COMPACT_SNAPSHOT_V2'}});
  await h.flow.consult();await h.flow.incorporate();expect(h.flow.getState().status).toBe('ACCESO_DENEGADO');expect(h.runTransaction).not.toHaveBeenCalled();expect(h.clientWrites).not.toHaveBeenCalled();
});

test('V2.4 a revoked WRITE grant at final recheck prevents persistence',async()=>{
  const h=await ppcHarness(),original=jest.mocked(authorizeInstitutionalProjectAccess).getMockImplementation()!;let writes=0;
  jest.mocked(authorizeInstitutionalProjectAccess).mockImplementation(async input=>{
    const result=await original(input);
    if(input.action==='WRITE' && ++writes===2)return {allowed:false,code:'PROJECT_ACCESS_REVOKED',audit:{...result.audit,outcome:'DENY'}};
    return result;
  });
  expect(await prepareScinceContextIncorporation(snapshot.projectBinding.projectId,h.reviewed)).toMatchObject({success:false,code:'ACCESS_DENIED'});
  expect(h.runTransaction).not.toHaveBeenCalled();
});

async function reportHarness(mutate?:(s:ScinceCompactSnapshotV2,p:any,release:any)=>void,denied=false,transportOnly=false,sourceFailure=false) {
  const db=repository(),s=structuredClone(snapshot),access=authorized('REPORT');
  s.ppcReview={status:'INCORPORATED',decision:'INCORPORATED',institutionalUserId:'1',incorporatedAt:'2026-01-04T00:00:00Z',reviewedContentFingerprint:s.audit.contentFingerprint};
  const project:any={id:s.projectBinding.projectId,canonicalGeography:s.geographyBinding.geometry,iaAnalysis:{scinceCanonicalSnapshot:s,
    scinceCanonicalIncorporation:{decision:'INCORPORATED',incorporatedBy:{institutionalUserId:'1'},incorporatedAt:s.ppcReview.incorporatedAt}}};
  const release={datasetId:s.datasetIdentity.datasetId,...s.releaseIdentity,catalogVersion:s.catalogIdentity.catalogVersion,
    catalogFingerprint:s.catalogIdentity.catalogFingerprint,...s.normalizationIdentity};
  radiusKeys.forEach((key,i)=>{process.env[key]=['300','200','400','SYNTHETIC_QA_ONLY'][i];});
  mutate?.(s,project,release);
  if(sourceFailure)db.repo.readReferencedObservations.mockResolvedValue([]);
  const materialize=jest.fn((snapshot:any,purpose:any,a:any)=>materializeScinceContext(snapshot,purpose,a,db.repo));
  const context=await resolveScinceDocumentPublication({projectId:s.projectBinding.projectId,sessionToken:'offline',reportGeography:db.canonical,transportOnly},
    {authorize:jest.fn(async()=>denied?{allowed:false,code:'PROJECT_ACCESS_DENIED',audit:{}} as any:access),readProject:async()=>project,readRelease:async()=>release,materialize});
  return {context,materialize,db,s,project};
}

test('V2.5 REPORT verifies exact source and preserves expanded document semantics',async()=>{
  const h=await reportHarness();expect(h.context.publicationStatus).toBe('PUBLISHABLE');
  expect(h.materialize).toHaveBeenCalledWith(h.s,'REPORT',expect.objectContaining({action:'GENERATE_REPORT'}));
  if(h.context.publicationStatus!=='PUBLISHABLE')throw new Error(h.context.reason);
  const historical={...h.context,snapshot:{...h.context.snapshot,multiunit:{...legacy,humanReviewStatus:'INCORPORATED' as const}}};
  const expectedMultiunit={...legacy,humanReviewStatus:'INCORPORATED'};
  for(const key of Object.keys(expectedMultiunit))expect({key,equal:canonicalSemanticValue((h.context.snapshot.multiunit as any)[key])===canonicalSemanticValue((expectedMultiunit as any)[key])}).toEqual({key,equal:true});
  expect(scinceDocumentFacts(h.context)).toEqual(scinceDocumentFacts(historical));
  expect(scinceDocumentSummary(h.context)).toEqual(scinceDocumentSummary(historical));
  expect(scinceDocumentLimitations(h.context)).toEqual(scinceDocumentLimitations(historical));
  const reportInput:any={projectId:h.s.projectBinding.projectId,geography:h.db.canonical,scinceContext:h.context};
  expect(buildScinceReportCover(reportInput)).toEqual(buildScinceReportCover({...reportInput,scinceContext:historical}));
  expect(h.context.snapshot.multiunit!.officialBaseProfile2020!.admissibleAggregates).toHaveLength(222);
  expect(h.project.iaAnalysis.scinceCanonicalSnapshot.schemaVersion).toBe('SCINCE_COMPACT_SNAPSHOT_V2');
});

test('V2.5 client document action transport excludes raw and expanded contexts',async()=>{
  const h=await reportHarness(undefined,false,true),json=JSON.stringify(h.context);
  expect(h.materialize).not.toHaveBeenCalled();expect(h.context).toHaveProperty('snapshot',null);
  for(const field of ['rawIndicators','rawScinceIndicators','normalizedValues','rawValues','sourceRows','SCINCE_CONTEXT_MATERIALIZATION_V1'])expect(json).not.toContain(field);
  expect(h.context).toHaveProperty('clientPreparation.aggregateIndicators');
  console.info('V25_CLIENT_DOCUMENT_CONTEXT_BYTES='+Buffer.byteLength(json));expect(Buffer.byteLength(json)).toBeLessThanOrEqual(250000);
});

test.each([
  ['not incorporated',(s:any)=>{s.ppcReview.status='REQUIRES_PPC_REVIEW';s.ppcReview.decision=null;s.ppcReview.institutionalUserId=null;s.ppcReview.incorporatedAt=null;}],
  ['stale',(s:any)=>{s.freshness.status='STALE';}],
  ['wrong release',(_s:any,_p:any,r:any)=>{r.releaseId='OTHER';}],
  ['catalog mismatch',(_s:any,_p:any,r:any)=>{r.catalogFingerprint='f'.repeat(64);}],
  ['content fingerprint',(s:any)=>{s.audit.contentFingerprint='f'.repeat(64);}],
  ['profile mismatch',(s:any)=>{s.officialBaseProfile2020.aggregateValues[0]++;}],
  ['observation mismatch',(s:any)=>{s.observations[0].rawValues[8]='99999';}],
  ['geography mismatch',(_s:any,p:any)=>{p.canonicalGeography={...p.canonicalGeography,geographyId:'OTHER'};}],
  ['PPC actor mismatch',(_s:any,p:any)=>{p.iaAnalysis.scinceCanonicalIncorporation.incorporatedBy.institutionalUserId='OTHER';}],
] as const)('V2.5 publication rejects %s',async(_label,mutate)=>{
  const h=await reportHarness(mutate);expect(h.context.publicationStatus).not.toBe('PUBLISHABLE');expect(h.context.snapshot).toBeNull();
});
test('V2.5 ANALYZE+WRITE cannot publish without GENERATE_REPORT',async()=>{
  const h=await reportHarness(undefined,true);expect(h.context).toMatchObject({snapshot:null,reason:'SCINCE_DOCUMENT_ACCESS_DENIED'});expect(h.materialize).not.toHaveBeenCalled();
});
test('V2.5 changed durable source rejects REPORT and exposes no expansion',async()=>{
  const db=repository();db.repo.readReferencedObservations.mockResolvedValue([]);
  const result=await materializeScinceContext(snapshot,'REPORT',authorized('REPORT'),db.repo);expect(result.materialization).toBe('REJECTED');
});
test('V2.5 publication rejects materialization failure without a document snapshot',async()=>{
  const h=await reportHarness(undefined,false,false,true);expect(h.materialize).toHaveBeenCalled();
  expect(h.context).toMatchObject({publicationStatus:'NOT_PUBLISHABLE_INVALID',snapshot:null,reason:'SCINCE_MATERIALIZATION_SOURCE_INVALID'});
  expect(h.project.iaAnalysis.scinceCanonicalSnapshot.schemaVersion).toBe('SCINCE_COMPACT_SNAPSHOT_V2');
});
