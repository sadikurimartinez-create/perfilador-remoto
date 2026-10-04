import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {execFileSync} from 'child_process';
import {join,resolve} from 'path';
import {readFileSync} from 'fs';
import {createHash} from 'crypto';
import {catalog,catalogFingerprint,NORMALIZATION_VERSION,parseTypedValue,normalizeRow,validateHeader,legacyCounts} from '../src/lib/scinceCatalogCore.cjs';
import {resolveInegiMultiunit,SCINCE_MULTIUNIT_SQL} from '../src/lib/inegiMultiunitResolver';
import {SCINCE_ANALYSIS_AREA_SQL} from '../src/lib/scinceAnalysisArea';
import {SCINCE_RELEASE_SQL,SCINCE_OBSERVATIONS_SQL,readScinceRelease,readScinceObservations} from '../src/lib/scinceObservationRepository';
import {buildScinceCanonicalSnapshot,evaluateScinceSnapshotFreshness,isValidScinceCanonicalSnapshot} from '../src/utils/scinceCanonicalSnapshot';
import {scinceDocumentFacts} from '../src/utils/scinceDocumentContext';
import {resolveScinceDocumentPublication} from '../src/services/scinceDocumentPublicationService';
import {prepareScinceContextIncorporation,getScinceContextFreshness} from '../src/lib/scinceHumanContextActions';
import {authorizeInstitutionalProjectAccess} from '../src/services/institutionalProjectAccessService';
import {getCanonicalScinceData} from '../src/lib/osintActions';
import {getPool} from '../src/lib/db';
import {cookies} from 'next/headers';
import {aggregateScinceIndicators} from '../src/utils/scinceIndicatorAggregation';
const {partialReimport}=require('../scripts/inegi/demographicEnrichment.cjs');
const publicRows=require('./fixtures/inegi/scince-cpv2020-public-rows.json').rows;
jest.mock('server-only',()=>({}),{virtual:true});
jest.mock('@/lib/db',()=>({getPool:jest.fn(()=>{throw new Error('LIVE_DB_FORBIDDEN');})}));
jest.mock('@/services/institutionalProjectAccessService',()=>({authorizeInstitutionalProjectAccess:jest.fn()}));
jest.mock('@/lib/osintActions',()=>({getCanonicalScinceData:jest.fn()}));
jest.mock('@/lib/firebaseAdmin',()=>({getInstitutionalAdminDb:jest.fn(()=>{throw new Error('LIVE_FIRESTORE_FORBIDDEN');})}));
jest.mock('next/headers',()=>({cookies:jest.fn()}));
const variable=(code='POBTOT')=>catalog.variables.find(v=>v.variableCode===code)!;
const config:any={version:'SCINCE_RADIUS_CONFIG_V1',governanceReference:'SYNTHETIC_QA_ONLY',individualBaseRadiusMeters:300,lineContextExpansionMeters:200,polygonContextExpansionMeters:400};
const dataset={dataset_id:'catalog-offline',product_name:'Official metadata; synthetic geography',reference_year:2020,version:'fixture-v1',imported_at:'2026-01-01T00:00:00Z',completed_at:'2026-01-02T00:00:00Z',geography_source_url:'https://www.inegi.org.mx/fixture',census_source_url:catalog.sourceUrl,geography_sha256:'a'.repeat(64),census_sha256:catalog.sourceZipSha256};
const releaseRow={release_id:'release-offline',dataset_id:dataset.dataset_id,catalog_version:catalog.catalogVersion,normalization_version:NORMALIZATION_VERSION,observation_set_fingerprint:'c'.repeat(64),catalog_fingerprint:catalogFingerprint,catalog};
const release={releaseId:releaseRow.release_id,datasetId:dataset.dataset_id,catalogVersion:catalog.catalogVersion,normalizationVersion:NORMALIZATION_VERSION,observationSetFingerprint:'c'.repeat(64),catalogFingerprint};
let engine:any;
beforeAll(()=>{engine=JSON.parse(execFileSync(process.env.SCINCE_QA_PYTHON||join(process.env.USERPROFILE!,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),[resolve(__dirname,'helpers/scinceRadiusOffline.py')],{encoding:'utf8',timeout:60000}));},65000);
beforeEach(()=>{jest.clearAllMocks();jest.mocked(cookies).mockReturnValue({get:()=>({value:'internal'})} as any);});
function canonical(name='point'):any {const f=engine.cases.find((f:any)=>f.name===name);return {geographyId:'P1:source',type:f.source.type==='Point'?'INDIVIDUAL':f.source.type==='LineString'?'CORRIDOR':'POLYGON',geometry:f.source,validationStatus:'VALID',source:'MAP_VECTOR',createdAt:1,updatedAt:1};}
function offline(name='point',changed:any={},rawChanges:any={}) {
  const f=engine.cases.find((f:any)=>f.name===name),raw={...publicRows.find((r:any)=>r.MZA==='001'),POBTOT:'170',POBFEM:'90',POBMAS:'80',VIVTOT:'54',VIVPAR_HAB:'54',VIVPAR_DES:'0',...rawChanges};
  const sourceKey='01:001:0001:0017:001';
  const row={geography_id:'1',geographic_level:'MANZANA',source_cvegeo:'0100100010017001',geographic_name:'Synthetic full unit',geometry:JSON.stringify(f.unit),is_valid:f.unitFlags.valid,is_simple:f.unitFlags.simple,is_empty:f.unitFlags.empty,srid:4326,area:f.unitFlags.area,intersects:f.intersects,touches:f.touches,covers_gu:true,covers_ug:false,equals:false,relate:'212FF1FF2',intersection_measure:100,unit_area:100,analysis_measure:f.row.area_square_meters,source_row_key:sourceKey,pobtot:170,vivtot:54,vivpar_hab:54,vivpar_deshab:0};
  const currentRelease={...releaseRow,...changed};
  const query=jest.fn(async(sql:string,values?:any[])=>{
    if(sql.startsWith('BEGIN')||sql.startsWith('SET')||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
    if(sql.includes('FROM public.inegi_territorial_dataset'))return {rows:[dataset]};
    if(sql===SCINCE_RELEASE_SQL)return {rows:[currentRelease]};
    if(sql===SCINCE_OBSERVATIONS_SQL)return {rows:[{geographic_level:'MANZANA',source_row_key:sourceKey,raw_source:raw,observations:normalizeRow(raw,'MANZANA',sourceKey)}]};
    if(sql===SCINCE_ANALYSIS_AREA_SQL)return {rows:[f.row]};
    if(sql.includes('postgis_geos_version'))return {rows:[{is_valid:f.areaFlags.valid,is_simple:f.areaFlags.simple,is_empty:f.areaFlags.empty,srid:4326,area:f.areaFlags.area,engine_version:engine.engine}]};
    if(sql===SCINCE_MULTIUNIT_SQL)return {rows:[row]};
    if(sql.includes('AS disjoint'))return {rows:[{disjoint:true}]};
    throw new Error('UNEXPECTED_OFFLINE_QUERY');
  });return {source:{connect:jest.fn(async()=>({query,release:jest.fn()}))},query};
}
async function observation(name='point',rawChanges:any={}) {const r=await resolveInegiMultiunit('P1',canonical(name),offline(name,{},rawChanges).source,config);if(!r.success)throw new Error(r.code);return r.observation;}
function success(m:any):any{return {success:true,projectId:'P1',geographyId:m.geographyBinding.geographyId,geographyType:m.geographyBinding.geographyType,geographyFingerprint:m.geographyBinding.geographyFingerprint,spatialMode:m.geographyBinding.geographyType==='INDIVIDUAL'?'CANONICAL_POINT':m.geographyBinding.geographyType==='CORRIDOR'?'CANONICAL_LINE':'CANONICAL_AREA',queryCoordinate:null,datasetId:m.dataset.datasetId,datasetYear:2020,datasetVersion:m.dataset.version,geographicLevel:null,demographicGeographicLevel:null,sourceRowKey:null,demographics:null,provenance:null,limitations:m.limitations,multiunit:m};}

test('1 versioned official catalog has 230 dictionary fields, 222 indicators, exact header and source fingerprints',()=>{
  expect(catalog.variables).toHaveLength(230);expect(new Set(catalog.variables.map(v=>v.variableCode)).size).toBe(230);expect(catalogFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(validateHeader(Object.keys(publicRows[0]))).toHaveLength(230);expect(()=>validateHeader(['POBTOT'])).toThrow('SCHEMA_DRIFT');
  expect(catalog.variables.every(v=>v.catalogVersion===catalog.catalogVersion&&v.referenceYear===2020&&v.officialDescription&&v.universe)).toBe(true);
});
test('2 explicit AGEB-only restriction overrides a supplied manzana numeric cell',()=>expect(parseTypedValue('12',{...variable(),availableLevels:'AGEB'},'MANZANA')).toMatchObject({typedValue:null,valueStatus:'NOT_AVAILABLE',nullReason:'VARIABLE_NOT_PUBLISHED_AT_LEVEL'}));
test('3 explicit MANZANA restriction rejects AGEB input',()=>expect(parseTypedValue('12',{...variable(),availableLevels:'MANZANA'},'AGEB').valueStatus).toBe('NOT_AVAILABLE'));
test('4 both levels supported; official availability discrepancy remains visible',()=>{expect(parseTypedValue('12',variable(),'AGEB').typedValue).toBe(12);expect(parseTypedValue('12',variable(),'MANZANA').typedValue).toBe(12);expect(catalog.methodologicalWarnings.join(' ')).toContain('222/215');});
test.each(['COUNT','PERCENTAGE','RATE','AVERAGE','INDEX'] as const)('5-9 strictly typed %s',kind=>expect(parseTypedValue(kind==='COUNT'?'12':'12.5',{...variable(),statisticalType:kind},'AGEB').typedValue).toBe(kind==='COUNT'?12:12.5));
test('10 UNKNOWN preserves source without assigning numeric meaning',()=>expect(parseTypedValue('12',{...variable(),statisticalType:'UNKNOWN'},'AGEB')).toMatchObject({rawValue:'12',typedValue:null,valueStatus:'INVALID_SOURCE_VALUE'}));
test.each(['0','0.00'])('11 true zero %s is ZERO',raw=>expect(parseTypedValue(raw,variable(),'MANZANA')).toMatchObject({typedValue:0,valueStatus:'ZERO',nullReason:null}));
test('12 suppression is never zero',()=>expect(parseTypedValue('*',variable(),'MANZANA')).toMatchObject({rawValue:'*',typedValue:null,valueStatus:'SUPPRESSED'}));
test('13 N/D is unavailable, not suppression',()=>expect(parseTypedValue('N/D',variable(),'AGEB').valueStatus).toBe('NOT_AVAILABLE'));
test.each(['N/A','NO APLICA'])('14 no aplica %s',raw=>expect(parseTypedValue(raw,variable(),'AGEB').valueStatus).toBe('NOT_APPLICABLE'));
test.each([null,undefined,''])('15 missing %s',raw=>expect(parseTypedValue(raw,variable(),'AGEB').valueStatus).toBe('MISSING'));
test('16 raw whitespace remains intact',()=>expect(parseTypedValue(' 12 ',variable(),'AGEB')).toMatchObject({rawValue:' 12 ',typedValue:12}));
test('identifiers retain leading zeros and categorical text is not parsed as numeric',()=>{expect(parseTypedValue('001',variable('MUN'),'MANZANA').typedValue).toBe('001');expect(parseTypedValue('category',{...variable(),statisticalType:'CATEGORICAL'},'MANZANA').typedValue).toBe('category');});
test.each(['12abc','12.5','1e3','-1','Infinity','1,000','0x10'])('17 strict COUNT rejects %s',raw=>expect(parseTypedValue(raw,variable(),'AGEB').valueStatus).toBe('INVALID_SOURCE_VALUE'));
test('18 all four legacy counts also exist as typed observations',()=>{const row=publicRows.find((r:any)=>r.MZA==='001');expect(legacyCounts(row,'MANZANA')).toEqual({populationTotal:170,housingTotal:82,inhabitedPrivateHousing:54,uninhabitedPrivateHousing:28});const obs=normalizeRow(row,'MANZANA','01:001:0001:0017:001');for(const code of ['POBTOT','VIVTOT','VIVPAR_HAB','VIVPAR_DES'])expect(obs.some(o=>o.variableCode===code)).toBe(true);});
test('19 no AGEB/manzana mixed sum',()=>expect(aggregateScinceIndicators([{name:'POBTOT',kind:'COUNT',value:10,sourceReference:'a',universe:'AGEB'},{name:'POBTOT',kind:'COUNT',value:10,sourceReference:'b',universe:'MANZANA'}],{fullUnits:true,sameLevel:true,disjointInteriors:true})[0].value).toBeNull());
test('20 duplicate source never double counts',()=>expect(aggregateScinceIndicators(Array(2).fill({name:'POBTOT',kind:'COUNT',value:10,sourceReference:'a',universe:'same'}),{fullUnits:true,sameLevel:true,disjointInteriors:true})[0].value).toBeNull());
test.each(['catalogVersion','normalizationVersion','observationSetFingerprint'])('21-23 stale when %s changes',async field=>{const snapshot=buildScinceCanonicalSnapshot(success(await observation()));expect(evaluateScinceSnapshotFreshness({snapshot,expectedProjectId:'P1',currentCanonicalGeography:canonical(),currentNormalizationRelease:{...release,[field]:'changed'}})).toMatchObject({territorialFreshness:'STALE',reason:'SCINCE_NORMALIZATION_RELEASE_CHANGED'});});
test('enrichment also requires a new PPC review of a valid historical V2 snapshot',async()=>{const db=offline(),original=db.query.getMockImplementation()!;db.query.mockImplementation(async(sql,values)=>sql===SCINCE_RELEASE_SQL?{rows:[]}:original(sql,values));const result=await resolveInegiMultiunit('P1',canonical(),db.source,config);if(!result.success)throw new Error(result.code);const snapshot=buildScinceCanonicalSnapshot(success(result.observation));expect(isValidScinceCanonicalSnapshot(snapshot)).toBe(true);expect(evaluateScinceSnapshotFreshness({snapshot,expectedProjectId:'P1',currentCanonicalGeography:canonical(),currentNormalizationRelease:release}).territorialFreshness).toBe('STALE');});
test('24 PPC reacquisition rejects changed observation fingerprint and never incorporates',async()=>{const m=await observation(),reviewed=success(m),fresh=structuredClone(m);fresh.officialBaseProfile2020!.observationSetFingerprint='d'.repeat(64);fresh.officialBaseProfile2020!.datasetIdentity=fresh.officialBaseProfile2020!.datasetIdentity.replace('c'.repeat(64),'d'.repeat(64));jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue({allowed:true,projectId:'P1',actor:{institutionalUserId:'1',username:'PPC'},project:{canonicalGeography:canonical()}} as any);jest.mocked(getCanonicalScinceData).mockResolvedValue(success(fresh));expect(await prepareScinceContextIncorporation('P1',reviewed)).toEqual({success:false,code:'REVIEW_CHANGED'});expect(m.humanReviewStatus).toBe('REQUIRES_PPC_REVIEW');});
test('unchanged catalog profile can be incorporated only through the human WRITE preparation',async()=>{const m=await observation();jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue({allowed:true,projectId:'P1',actor:{institutionalUserId:'1',username:'PPC'},project:{canonicalGeography:canonical()}} as any);jest.mocked(getCanonicalScinceData).mockResolvedValue(success(m));const r=await prepareScinceContextIncorporation('P1',success(m));expect(r.success).toBe(true);if(r.success){expect(r.snapshot.multiunit!.humanReviewStatus).toBe('INCORPORATED');expect(r.snapshot.multiunit!.officialBaseProfile2020).toEqual(m.officialBaseProfile2020);}expect(m.humanReviewStatus).toBe('REQUIRES_PPC_REVIEW');});
test.each(['point','line','polygon','multi'])('25-28 %s traverses actual resolver, profile, snapshot and validator',async name=>{const g=canonical(name),before=JSON.stringify(g),m=await observation(name);expect(m.officialBaseProfile2020!.rawIndicators).toHaveLength(230);expect(m.indicators).toHaveLength(222);expect(m.indicators.some(i=>i.name==='PEA')).toBe(true);expect(isValidScinceCanonicalSnapshot(buildScinceCanonicalSnapshot(success(m)))).toBe(true);expect(JSON.stringify(g)).toBe(before);});
test('29 governed radius and separate original geography remain',async()=>{const m=await observation('line');expect(m.scinceAnalysisArea!.contextExpansionMeters).toBe(200);expect(m.officialBaseProfile2020!.scinceAnalysisArea).toEqual(m.scinceAnalysisArea);expect(m.officialBaseProfile2020!.territorialBinding).toEqual(m.geographyBinding);expect(m.estimatedCurrentProfile).toBeNull();});
test('30 document separates official 2020, reproducible derivation, unavailable and future estimate',async()=>{const s=buildScinceCanonicalSnapshot(success(await observation()));const facts=scinceDocumentFacts({publicationStatus:'PUBLISHABLE',territorialFreshness:'CURRENT',reason:null,snapshot:s});expect(facts.some(f=>f.label==='Dato oficial INEGI 2020')).toBe(true);expect(facts.some(f=>f.label.startsWith('Derivación reproducible:'))).toBe(true);expect(facts.some(f=>f.label==='Estimación temporal'&&f.value.includes('No implementada'))).toBe(true);expect(s.multiunit!.officialBaseProfile2020!.derivedIndicators[0].denominator.code).toBe('POBTOT');});
test('only accredited dimensions are populated and means never averaged',async()=>{const p=(await observation()).officialBaseProfile2020!;expect(p.profileDimensions.EDUCATION).toContain('GRAPROES');expect(p.admissibleAggregates.find(a=>a.name==='GRAPROES')!.value).toBeNull();});
test('tampered typed value invalidates snapshot',async()=>{const s=buildScinceCanonicalSnapshot(success(await observation()));s.multiunit!.officialBaseProfile2020!.rawIndicators.find(o=>o.variableCode==='POBTOT')!.typedValue=999;expect(isValidScinceCanonicalSnapshot(s)).toBe(false);});
test('Firestore map key ordering cannot invalidate an unchanged catalog snapshot',async()=>{const snapshot=buildScinceCanonicalSnapshot(success(await observation()));const reorder=(v:any):any=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reorder(x)])):v;expect(isValidScinceCanonicalSnapshot(reorder(snapshot))).toBe(true);});
test('unsupported release fails closed; freshness may compare unknown identity without interpreting it',async()=>{const db=offline('point',{catalog_version:'future'});expect((await resolveInegiMultiunit('P1',canonical(),db.source,config)).success).toBe(false);expect(await readScinceRelease({query:db.query},dataset.dataset_id,false)).toMatchObject({catalogVersion:'future'});});
test('runtime cache rechecks release and changes key on enrichment fingerprint',async()=>{const env={...process.env};try {process.env.DATABASE_URL='mock-only';const db=offline();jest.mocked(getPool).mockReturnValue(db.source as any);await resolveInegiMultiunit('CACHE_CATALOG',canonical(),undefined,config);await resolveInegiMultiunit('CACHE_CATALOG',canonical(),undefined,config);expect(db.query.mock.calls.filter(c=>c[0]===SCINCE_OBSERVATIONS_SQL)).toHaveLength(1);const next=offline('point',{observation_set_fingerprint:'d'.repeat(64)});jest.mocked(getPool).mockReturnValue(next.source as any);await resolveInegiMultiunit('CACHE_CATALOG',canonical(),undefined,config);expect(next.query.mock.calls.some(c=>c[0]===SCINCE_OBSERVATIONS_SQL)).toBe(true);}finally{process.env=env;}});
test('document admission compares current release after explicit authorization',async()=>{const s=buildScinceCanonicalSnapshot(success(await observation()));s.multiunit!.humanReviewStatus='INCORPORATED';const env={...process.env};try{Object.assign(process.env,{SCINCE_DEFAULT_RADIUS_M:'300',SCINCE_LINE_CONTEXT_EXPANSION_M:'200',SCINCE_POLYGON_CONTEXT_EXPANSION_M:'400',SCINCE_RADIUS_GOVERNANCE_REFERENCE:'SYNTHETIC_QA_ONLY'});const readRelease=jest.fn(async()=>({...release,observationSetFingerprint:'d'.repeat(64)}));const r=await resolveScinceDocumentPublication({projectId:'P1',sessionToken:'internal',reportGeography:canonical()},{authorize:jest.fn(async()=>({allowed:true,projectId:'P1'} as any)),readRelease,readProject:jest.fn(async()=>({id:'P1',canonicalGeography:canonical(),iaAnalysis:{scinceCanonicalSnapshot:s,scinceCanonicalIncorporation:{decision:'INCORPORATED',incorporatedBy:{institutionalUserId:'1'},incorporatedAt:'2026-01-01T00:00:00Z'}}}))});expect(r.publicationStatus).toBe('NOT_PUBLISHABLE_STALE');expect(readRelease).toHaveBeenCalledWith(dataset.dataset_id);}finally{process.env=env;}});
test('unauthorized document never reads release or project',async()=>{const readRelease=jest.fn(),readProject=jest.fn();await resolveScinceDocumentPublication({projectId:'P1',sessionToken:'internal',reportGeography:canonical()},{authorize:jest.fn(async()=>({allowed:false} as any)),readRelease,readProject});expect(readRelease).not.toHaveBeenCalled();expect(readProject).not.toHaveBeenCalled();});

function enrichment(rows=publicRows) {
 const normalized=rows.map((raw:any)=>{const level=raw.MZA==='000'?'AGEB':'MANZANA',key=[raw.ENTIDAD,raw.MUN,raw.LOC,raw.AGEB,...(level==='MANZANA'?[raw.MZA]:[])].join(':');return {level,key,raw,observations:normalizeRow(raw,level,key)};});
 const dependencies={fileHash:jest.fn(async(path:string)=>path==='zip'?catalog.sourceZipSha256:catalog.sourceCsvSha256),sourceRows:async function*(){yield* normalized;}};
 const query=jest.fn(async(sql:string,values?:any[])=>{
  if(sql.startsWith('BEGIN')||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
  if(sql==='SELECT current_user AS role')return {rows:[{role:'administrative_test_only'}]};
  if(sql.includes('FROM public.inegi_territorial_dataset'))return {rows:[{reference_year:2020,state_code:'01',geography_sha256:'a'.repeat(64),census_sha256:catalog.sourceZipSha256}]};
  if(sql.startsWith('SELECT geographic_level'))return {rows:normalized.map(r=>({geographic_level:r.level,source_row_key:r.key}))};
  if(sql.includes('NOT EXISTS ('))return {rows:[]};
  if(sql.startsWith('SELECT status'))return {rows:[]};
  if(sql.startsWith('SELECT catalog_fingerprint'))return {rows:[{catalog_fingerprint:catalogFingerprint}]};
  if(sql.startsWith('INSERT')||sql.startsWith('UPDATE public.inegi_scince_'))return {rows:[]};
  throw new Error('UNEXPECTED_OFFLINE_ADMIN_QUERY');
 });return {query,dependencies,options:{datasetId:'dataset-offline',csvPath:'csv',censusZipPath:'zip',geographySha256:'a'.repeat(64)}};
}
test('PARTIAL_REIMPORT creates an immutable typed release only after source hashes and territorial compatibility',async()=>{const a=enrichment();const result=await partialReimport(a,a.options,a.dependencies);expect(result.rowCount).toBe(2);expect(result.reused).toBe(false);const statements=a.query.mock.calls.map(c=>c[0]);expect(statements.findIndex(s=>s.includes('NOT EXISTS ('))).toBeLessThan(statements.findIndex(s=>s.startsWith('INSERT')));expect(statements.some(s=>/INSERT INTO public.inegi_territorial_geography|UPDATE public.inegi_territorial_demographics|GRANT/.test(s))).toBe(false);expect(statements.at(-1)).toBe('COMMIT');});
test('PARTIAL_REIMPORT bad artifact hash aborts before DB',async()=>{const a=enrichment();a.dependencies.fileHash.mockResolvedValue('bad');await expect(partialReimport(a,a.options,a.dependencies)).rejects.toThrow('SOURCE_HASH_MISMATCH');expect(a.query).not.toHaveBeenCalled();});
test('PARTIAL_REIMPORT duplicate keys abort before mutation',async()=>{const a=enrichment([publicRows[0],publicRows[0]]);await expect(partialReimport(a,a.options,a.dependencies)).rejects.toThrow('DUPLICATE_SOURCE_KEY');expect(a.query).not.toHaveBeenCalled();});
test('PARTIAL_REIMPORT ordinary application cannot provision releases',async()=>{const a=enrichment(),original=a.query.getMockImplementation()!;a.query.mockImplementation(async(sql,values)=>sql==='SELECT current_user AS role'?{rows:[{role:'ceipol_app'}]}:original(sql,values));await expect(partialReimport(a,a.options,a.dependencies)).rejects.toThrow('ADMINISTRATIVE_PROCEDURE_REQUIRED');expect(a.query.mock.calls.some(c=>c[0].startsWith('INSERT'))).toBe(false);});
test('additive migration does not edit geography, legacy columns or grant privileges',()=>{const sql=readFileSync(resolve('database/migrations/inegi-territorial/002_scince_catalog_up.sql'),'utf8');expect(sql).toContain('FOREIGN KEY (dataset_id,geographic_level,source_row_key)');expect(sql).not.toMatch(/ALTER TABLE public.inegi_territorial|GRANT\s+\w|DROP TABLE/i);expect(sql).toContain('jsonb');});
test('PARTIAL_REIMPORT repeat of a READY release does not duplicate observations',async()=>{const a=enrichment(),original=a.query.getMockImplementation()!;a.query.mockImplementation(async(sql,values)=>sql.startsWith('SELECT status')?{rows:[{status:'READY'}]}:original(sql,values));const r=await partialReimport(a,a.options,a.dependencies);expect(r.reused).toBe(true);expect(a.query.mock.calls.some(c=>c[0].startsWith('INSERT'))).toBe(false);});
test('PARTIAL_REIMPORT incompatible demographic keys abort before inserts',async()=>{const a=enrichment(),original=a.query.getMockImplementation()!;a.query.mockImplementation(async(sql,values)=>sql.startsWith('SELECT geographic_level')?{rows:[]}:original(sql,values));await expect(partialReimport(a,a.options,a.dependencies)).rejects.toThrow('KEYS_INCOMPATIBLE');expect(a.query.mock.calls.some(c=>c[0].startsWith('INSERT'))).toBe(false);expect(a.query.mock.calls.at(-1)![0]).toBe('ROLLBACK');});
test('PARTIAL_REIMPORT missing certified geography aborts before inserts',async()=>{const a=enrichment(),original=a.query.getMockImplementation()!;a.query.mockImplementation(async(sql,values)=>sql.includes('NOT EXISTS (')?{rows:[{missing:1}]}:original(sql,values));await expect(partialReimport(a,a.options,a.dependencies)).rejects.toThrow('GEOGRAPHY_KEYS_INCOMPATIBLE');expect(a.query.mock.calls.some(c=>c[0].startsWith('INSERT'))).toBe(false);});
test('reader rejects typed/raw divergence rather than trusting JSONB',async()=>{const db=offline(),original=db.query.getMockImplementation()!;db.query.mockImplementation(async(sql,values)=>{const r=await original(sql,values);if(sql===SCINCE_OBSERVATIONS_SQL)r.rows[0].observations[8].typedValue=999;return r;});expect((await resolveInegiMultiunit('P1',canonical(),db.source,config)).success).toBe(false);expect(db.query).toHaveBeenCalledWith('ROLLBACK');});
test('missing typed observations cannot fall back to four legacy counts',async()=>{const db=offline(),original=db.query.getMockImplementation()!;db.query.mockImplementation(async(sql,values)=>sql===SCINCE_OBSERVATIONS_SQL?{rows:[]}:original(sql,values));expect((await resolveInegiMultiunit('P1',canonical(),db.source,config)).success).toBe(false);});
test('server freshness reads current release after READ and marks changed fingerprint stale',async()=>{const s=buildScinceCanonicalSnapshot(success(await observation()));jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue({allowed:true,projectId:'P1',project:{canonicalGeography:canonical()}} as any);jest.mocked(getPool).mockReturnValue(offline('point',{observation_set_fingerprint:'d'.repeat(64)}).source as any);expect(await getScinceContextFreshness('P1',s)).toMatchObject({success:true,freshness:{territorialFreshness:'STALE',reason:'SCINCE_NORMALIZATION_RELEASE_CHANGED'}});expect(authorizeInstitutionalProjectAccess).toHaveBeenCalledWith(expect.objectContaining({action:'READ'}));});
test('actual PPC UI renders official names, dimensions and suppression without false zero',async()=>{
  const js=ts.transpileModule(readFileSync(resolve('src/components/ScinceHumanContextPanel.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  const module={exports:{} as any};new Function('require','module','exports',js)((name:string)=>name==='@/components/ui/CEIPOLButton'?{CEIPOLButton:()=>null}:require(name),module,module.exports);
  const m=await observation('point',{PDER_IMSS:'*'});const html=renderToStaticMarkup(React.createElement(module.exports.ScinceObservedResult,{result:success(m)}));
  expect(html).toContain('Dato oficial INEGI 2020');expect(html).toContain('Educación');expect(html).toContain('Reservado por confidencialidad');expect(html).toContain('Población total');
  const facts=scinceDocumentFacts({publicationStatus:'PUBLISHABLE',territorialFreshness:'CURRENT',reason:null,snapshot:buildScinceCanonicalSnapshot(success(m))});expect(facts.find(f=>f.label.startsWith('Oficial 2020: PDER_IMSS '))!.value).toContain('SUPPRESSED');
});

// Offline compatibility: official observations remain complete; geometry owns selection.
function nonSpatialEnrichment(level:string, changes:any={}) {
 const raw={...publicRows[0],ENTIDAD:'01',MUN:'001',LOC:'2050',AGEB:'1903',MZA:level==='AGEB'?'000':'800',...changes};
 const a=enrichment([raw]), original=a.query.getMockImplementation()!;
 const key=[raw.ENTIDAD,raw.MUN,raw.LOC,raw.AGEB,...(level==='MANZANA'?[raw.MZA]:[])].join(':');
 a.query.mockImplementation(async(sql,values)=>sql.includes('NOT EXISTS (')?{rows:[{geographic_level:level,source_row_key:key,cve_ent:raw.ENTIDAD,cve_mun:raw.MUN,cve_loc:raw.LOC,cve_ageb:raw.AGEB,cve_mza:level==='AGEB'?null:raw.MZA}]}:original(sql,values));
 return a;
}
function insertedObservations(a:any){return a.query.mock.calls.filter((c:any)=>c[0].includes('INSERT INTO public.inegi_scince_observation_set')).flatMap((c:any)=>JSON.parse(c[1][2]));}
test.each(['MANZANA','AGEB'])('%s without geometry is retained intact and explicitly ineligible',async level=>{
 const a=nonSpatialEnrichment(level),r=await partialReimport(a,a.options,a.dependencies);
 expect(r.rowCount).toBe(1);expect(r.spatialEligibility).toMatchObject({totalRows:1,spatialRows:0,nonSpatialRows:1});
 expect(r.spatialEligibility.nonSpatialUnits[0]).toMatchObject({geographicLevel:level,spatiallyEligible:false});
 const input=[];for await(const row of a.dependencies.sourceRows())input.push(row);
 expect(insertedObservations(a)).toEqual(input);
 expect(r.observationSetFingerprint).toBe(createHash('sha256').update(JSON.stringify(input[0].observations)+'\n').digest('hex'));
 const metadata=JSON.parse(a.query.mock.calls.find(c=>c[0].includes('INSERT INTO public.inegi_scince_normalization_release'))![1]![6]);
 expect(metadata.spatialEligibility).toEqual(r.spatialEligibility);
 expect(metadata.spatialEligibility.agebWithoutGeometry).toBe(level==='AGEB'?1:0);
 expect(metadata.spatialEligibility.manzana800WithoutGeometry).toBe(level==='MANZANA'?1:0);
 expect(a.query.mock.calls.map(c=>c[0]).join(' ')).not.toMatch(/ST_Union|INSERT INTO public.inegi_territorial_geography|DELETE|UPDATE public.inegi_territorial_demographics/i);
});
test.each([['MANZANA',{MZA:'001'}],['AGEB',{AGEB:'1904'}],['MANZANA',{ENTIDAD:'02'}]])('unrecognized territorial incompatibility %s %j aborts',async(level,changes)=>{
 const a=nonSpatialEnrichment(level as string,changes);await expect(partialReimport(a,a.options,a.dependencies)).rejects.toThrow('GEOGRAPHY_KEYS_INCOMPATIBLE');
 expect(insertedObservations(a)).toHaveLength(0);expect(a.query.mock.calls.at(-1)![0]).toBe('ROLLBACK');
});
test('ordinary spatial observations remain eligible and complete',async()=>{
 const a=enrichment(),r=await partialReimport(a,a.options,a.dependencies);expect(r.spatialEligibility).toEqual({totalRows:2,spatialRows:2,nonSpatialRows:0,agebWithoutGeometry:0,manzana800WithoutGeometry:0,nonSpatialUnits:[]});expect(insertedObservations(a)).toHaveLength(2);
});
test.each(['MANZANA','AGEB'])('nonspatial %s is never requested, selected or summed into the profile',async level=>{
 const db=offline(),original=db.query.getMockImplementation()!;const requested:any[]=[];
 db.query.mockImplementation(async(sql,values)=>{if(sql===SCINCE_OBSERVATIONS_SQL)requested.push(...JSON.parse(values![1]));return original(sql,values);});
 const r=await resolveInegiMultiunit('NONSPATIAL_'+level,canonical(),db.source,config);if(!r.success)throw new Error(r.code);
 expect(requested).toEqual([{level:'MANZANA',key:'01:001:0001:0017:001'}]);
 expect(JSON.stringify(r.observation.sourceRows)).not.toContain('2050:1903');
 expect(r.observation.sourceRows).toHaveLength(1);
 expect(r.observation.aggregates.find(a=>a.name==='POBTOT')?.value).toBe(170);
 expect(SCINCE_MULTIUNIT_SQL).toContain('SELECT g.* FROM public.inegi_territorial_geography');
 expect(SCINCE_MULTIUNIT_SQL).toContain('FROM candidates g CROSS JOIN analysis a');
});
test('unexpected nonspatial observation returned by reader fails closed',async()=>{
 const db=offline(),original=db.query.getMockImplementation()!;db.query.mockImplementation(async(sql,values)=>{const result=await original(sql,values);if(sql===SCINCE_OBSERVATIONS_SQL)result.rows[0].source_row_key='01:001:2050:1903:800';return result;});expect((await resolveInegiMultiunit('UNEXPECTED_NONSPATIAL',canonical(),db.source,config)).success).toBe(false);
});
test('complete 16323-row observation set includes all 26 nonspatial rows in count and fingerprint',async()=>{
 const a=nonSpatialEnrichment('AGEB');const rows=Array.from({length:16323},(_,i)=>({level:i===0?'AGEB':'MANZANA',key:i===0?'01:001:2050:1903':i<=25?`01:001:${String(i).padStart(4,'0')}:0017:800`:`01:001:9999:0017:${i}`,raw:{fixture:i},observations:[{fixture:i}]}));
 const missing=rows.slice(0,26).map(r=>{const p=r.key.split(':');return {geographic_level:r.level,source_row_key:r.key,cve_ent:p[0],cve_mun:p[1],cve_loc:p[2],cve_ageb:p[3],cve_mza:p[4]??null};});
 const original=a.query.getMockImplementation()!;
 a.dependencies.sourceRows=async function*(){yield* rows;};
 a.query.mockImplementation(async(sql,values)=>sql.startsWith('SELECT geographic_level')?{rows:rows.map(r=>({geographic_level:r.level,source_row_key:r.key}))}:sql.includes('NOT EXISTS (')?{rows:missing}:original(sql,values));
 const r=await partialReimport(a,a.options,a.dependencies);expect(r.rowCount).toBe(16323);expect(insertedObservations(a)).toEqual(rows);
 expect(r.spatialEligibility).toMatchObject({totalRows:16323,spatialRows:16297,nonSpatialRows:26,agebWithoutGeometry:1,manzana800WithoutGeometry:25});
 const hash=createHash('sha256');rows.forEach(row=>hash.update(JSON.stringify(row.observations)+'\n'));expect(r.observationSetFingerprint).toBe(hash.digest('hex'));
});

test('existing release cannot silently reuse missing nonspatial metadata',async()=>{
 const a=nonSpatialEnrichment('AGEB'),original=a.query.getMockImplementation()!;a.query.mockImplementation(async(sql,values)=>sql.startsWith('SELECT status')?{rows:[{status:'READY',metadata:{}}]}:original(sql,values));
 await expect(partialReimport(a,a.options,a.dependencies)).rejects.toThrow('SPATIAL_METADATA_INCOMPATIBLE');expect(insertedObservations(a)).toHaveLength(0);
});
