jest.mock('@/lib/scinceObservationRepository',()=>({...jest.requireActual('@/lib/scinceObservationRepository'),getCurrentScinceRelease:jest.fn(async()=>null)}));
import {execFileSync} from 'child_process';
import {resolve,join} from 'path';
import {resolveInegiTerritory} from '../src/lib/inegiTerritorialResolver';
import {resolveInegiSourceCoverage as resolveInegiMultiunit,SCINCE_MULTIUNIT_SQL} from '../src/lib/inegiMultiunitResolver';
import {resolveScinceCanonicalContext} from '../src/services/scinceCanonicalContextService';
import {buildScinceCanonicalSnapshot,evaluateScinceSnapshotFreshness,isValidScinceCanonicalSnapshot} from '../src/utils/scinceCanonicalSnapshot';
import {serializeCanonicalGeographyForFirestore} from '../src/utils/canonicalProjectGeography';
import {readScinceCanonicalGeography} from '../src/utils/scinceQueryGeometry';
import {aggregateScinceIndicators} from '../src/utils/scinceIndicatorAggregation';
import {resolveScinceDocumentPublication} from '../src/services/scinceDocumentPublicationService';
import {scinceDocumentSummary,scinceDocumentFacts} from '../src/utils/scinceDocumentContext';
import {createScinceHumanContextFlow} from '../src/utils/scinceHumanContextFlow';
import {prepareScinceContextIncorporation,getScinceQueryCapability} from '../src/lib/scinceHumanContextActions';
import {authorizeInstitutionalProjectAccess} from '../src/services/institutionalProjectAccessService';
import {getCanonicalScinceData} from '../src/lib/osintActions';
import {cookies} from 'next/headers';
import {buildEvidenceLineage} from '../src/utils/evidenceLineage';
import {createComputedFileIntegrity} from '../src/utils/forensicFileIntegrity';
import {formulateHumanHypothesis} from '../src/utils/hypothesisGovernance';
import {buildInstitutionalReportInput} from '../src/utils/institutionalReportPublicationContract';
import {buildExecutiveGeointReportModel} from '../src/utils/executiveGeointReportModel';
import {buildExecutiveVisualComposition} from '../src/utils/executiveVisualComposition';
import {buildExecutiveGeointReportDocumentModel} from '../src/utils/executiveGeointReportDocumentModel';
import {buildExecutiveGeointTechnicalAnnexModel} from '../src/utils/executiveGeointTechnicalAnnexModel';

jest.mock('server-only',()=>({}),{virtual:true});
jest.mock('@/lib/db',()=>({getPool:jest.fn(()=>{throw new Error('LIVE_DB_FORBIDDEN');})}));
jest.mock('@/services/institutionalProjectAccessService',()=>({authorizeInstitutionalProjectAccess:jest.fn()}));
jest.mock('@/lib/osintActions',()=>({getCanonicalScinceData:jest.fn()}));
jest.mock('@/lib/firebaseAdmin',()=>({getInstitutionalAdminDb:jest.fn(()=>{throw new Error('LIVE_FIRESTORE_FORBIDDEN');})}));
jest.mock('next/headers',()=>({cookies:jest.fn()}));
let geos:any;
beforeAll(()=>{
  const python=process.env.SCINCE_QA_PYTHON || join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
  geos=JSON.parse(execFileSync(python,[resolve(__dirname,'helpers/scinceGeosOffline.py')],{encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024}));
},65000);
beforeEach(()=>jest.clearAllMocks());
const measured=(id:string)=>geos.cases.find((c:any)=>c.case===id);
const dataset={dataset_id:'synthetic-offline',product_name:'Synthetic fixture, not live INEGI',reference_year:2020,version:'test-v1',
  imported_at:'2026-01-01T00:00:00Z',completed_at:'2026-01-02T00:00:00Z',geography_source_url:'https://www.inegi.org.mx/fixture-geo',
  census_source_url:'https://www.inegi.org.mx/fixture-census',geography_sha256:'a'.repeat(64),census_sha256:'b'.repeat(64)};
function canonical(id:string):any {const c=measured(id);return {geographyId:'P1:geometry',type:c.mode,geometry:c.analysisGeometry,source:'MAP_VECTOR',validationStatus:'VALID',createdAt:1,updatedAt:1};}
function sqlRow(id:string,index=0):any {
  const c=measured(id),code=String(index+1).padStart(3,'0');
  return {geography_id:String(index+1),geographic_level:'MANZANA',source_cvegeo:`0100100010017${code}`,geographic_name:'Synthetic unit',geometry:JSON.stringify(c.unitGeometry),
    is_valid:c.unitFlags.valid,is_simple:c.unitFlags.simple,is_empty:c.unitFlags.empty,area:c.unitFlags.area,srid:4326,
    intersects:c.intersects,touches:c.touches,covers_gu:c.coversGU,covers_ug:c.coversUG,equals:c.equals,relate:c.relate,
    // Metric columns are explicit repository fixtures, not a certification of deployed geography measurements.
    intersection_measure:c.touches?0:c.coversGU?100:40,analysis_measure:200,unit_area:100,
    source_row_key:`01:001:0001:0017:${code}`,pobtot:10+index,vivtot:5+index,vivpar_hab:4,vivpar_deshab:1};
}
function offline(id:string,related:string[]=[id],options:{disjoint?:boolean;rows?:any[];timeout?:boolean;dataset?:any}={}) {
  const c=measured(id);
  const rows=options.rows ?? related.filter(k=>measured(k).classification!=='DISJOINT').map(sqlRow);
  const query=jest.fn(async(sql:string,values?:any[])=>{
    if(sql.startsWith('BEGIN') || sql.startsWith('SET') || sql==='COMMIT' || sql==='ROLLBACK')return {rows:[]};
    if(sql.includes('FROM public.inegi_scince_normalization_release'))return {rows:[]};
    if(sql.includes('FROM public.inegi_territorial_dataset'))return {rows:[options.dataset ?? dataset]};
    if(sql.includes('postgis_geos_version'))return {rows:[{is_valid:c.analysisFlags.valid,is_simple:c.analysisFlags.simple,is_empty:c.analysisFlags.empty,area:c.analysisFlags.area,srid:4326,engine_version:geos.version}]};
    if(sql===SCINCE_MULTIUNIT_SQL){if(options.timeout)throw Object.assign(new Error('private SQL details'),{code:'57014'});return {rows};}
    if(sql.includes('AS disjoint'))return {rows:[{disjoint:options.disjoint ?? true}]};
    throw new Error('Unexpected offline SQL');
  });
  const release=jest.fn();const connect=jest.fn(async()=>({query,release}));return {source:{connect},query,release};
}
async function observation(id='P6',related?:string[],options?:any) {
  const db=offline(id,related,options);const result=await resolveInegiMultiunit('P1',canonical(id),db.source);
  if(!result.success)throw new Error(result.code);return result.observation;
}
function success(m:any):any {return {success:true,projectId:'P1',geographyId:m.geographyBinding.geographyId,geographyType:m.geographyBinding.geographyType,
  geographyFingerprint:m.geographyBinding.geographyFingerprint,spatialMode:m.geographyBinding.geographyType==='CORRIDOR'?'CANONICAL_LINE':'CANONICAL_AREA',queryCoordinate:null,
  datasetId:m.dataset.datasetId,datasetYear:m.dataset.year,datasetVersion:m.dataset.version,geographicLevel:null,demographicGeographicLevel:null,sourceRowKey:null,demographics:null,provenance:null,limitations:m.limitations,multiunit:m};}
const allow=(g:any):any=>({allowed:true,projectId:'P1',actor:{institutionalUserId:'1',username:'reviewer',role:'USER'},project:{canonicalGeography:g},audit:{}});

test.each([
  ['L6',1,'PARTIAL_UNIT'],['L8-A',2,'PARTIAL_UNIT'],['L10',1,'TOUCHED_UNIT'],['L9-IN',1,'PARTIAL_UNIT'],
  ['L1',0,null],['P5',1,'PARTIAL_UNIT'],['P8',1,'PARTIAL_UNIT'],['P6',1,'FULL_UNIT'],['P4',1,'PARTIAL_UNIT'],
  ['P12-A',2,'FULL_UNIT'],['P1',0,null],['P7',1,'FULL_UNIT'],
])('productive resolver fixture %s follows measured GEOS topology',async(id,count,kind)=>{
  const related=id==='L8-A'?['L8-A','L8-B']:id==='P12-A'?['P12-A','P12-B']:[id];
  const db=offline(id,related);const g=canonical(id);const before=JSON.stringify(g);
  const result=await resolveInegiMultiunit('P1',g,db.source);
  if(!count)expect(result).toEqual({success:false,code:'SCINCE_CANONICAL_DATA_UNAVAILABLE'});
  else {expect(result.success).toBe(true);if(result.success){const m=result.observation;
    expect(m.territorialUnits).toHaveLength(count);expect(m.unitDetails[0].intersectionType).toBe(kind);
    expect(readScinceCanonicalGeography(m.geometry)?.geometry).toEqual(g.geometry);
    expect(isValidScinceCanonicalSnapshot(buildScinceCanonicalSnapshot(success(m)))).toBe(true);
    if(kind==='TOUCHED_UNIT'){expect(m.indicators).toEqual([]);expect(m.sourceRows[0].usage).toBe('ENUMERATION_ONLY');}
    if(kind==='PARTIAL_UNIT'){expect(m.sourceRows[0].demographics.populationTotal).toBe(10);expect(m.aggregates.every(a=>a.value===null)).toBe(true);}
  }}
  expect(JSON.stringify(g)).toBe(before);expect(db.release).toHaveBeenCalledTimes(1);
  expect(db.query.mock.calls[0][0]).toContain('REPEATABLE READ READ ONLY');
});
test('legacy canonical line uses complete Firestore points without a derived center',async()=>{
  const g=canonical('L9-IN');const safe=serializeCanonicalGeographyForFirestore(g);const restored=readScinceCanonicalGeography(safe)!;
  const db=offline('L9-IN');expect((await resolveInegiMultiunit('P1',restored,db.source)).success).toBe(true);
  expect(JSON.parse(db.query.mock.calls.find(c=>c[0]===SCINCE_MULTIUNIT_SQL)![1]![0])).toEqual(g.geometry);
});
test.each(['L12','P9','P13'])('hole/gap fixture %s cannot be resolved through a bbox center',async id=>{
  const db=offline(id);expect(await resolveInegiMultiunit('P1',canonical(id),db.source)).toEqual({success:false,code:'SCINCE_CANONICAL_DATA_UNAVAILABLE'});
});
test('FULL_UNIT sum retains original unit figures and proof; overlapping units suppress sum',async()=>{
  const m=await observation('P12-A',['P12-A','P12-B']);expect(m.aggregates.find(a=>a.name==='populationTotal')).toMatchObject({value:21,method:'SUM_FULL_DISJOINT_UNITS'});
  expect(m.sourceRows.map(r=>r.demographics.populationTotal)).toEqual([10,11]);
  const overlapping=await observation('P12-A',['P12-A','P12-B'],{disjoint:false});expect(overlapping.aggregates.every(a=>a.value===null)).toBe(true);
});
test('AGEB and child manzana are never summed; each footprint is classified independently',async()=>{
  const rows=[sqlRow('P6'),{...sqlRow('P4',1),geographic_level:'AGEB',source_cvegeo:'0100100010017',source_row_key:'01:001:0001:0017'}];
  const m=await observation('P6',undefined,{rows});expect(m.sourceRows).toHaveLength(2);
  expect(m.sourceRows.find(r=>r.demographicGeographicLevel==='AGEB')?.relationToAnalysis).toBe('INTERIOR_INTERSECTION');
  expect(m.aggregates.find(a=>a.name==='populationTotal')?.value).toBe(10);
});
test('missing census remains null/unavailable, never zero; no duplicate source rows',async()=>{
  const row=sqlRow('P6');row.pobtot=null;const m=await observation('P6',undefined,{rows:[row]});expect(m.sourceRows[0].demographics.populationTotal).toBeNull();expect(m.aggregates.find(a=>a.name==='populationTotal')?.value).toBeNull();
  const noCensus=await observation('P6',undefined,{rows:[{...row,source_row_key:null}]});expect(noCensus.sourceRows).toEqual([]);
});
test('limit+1 aborts with explicit failure, never returns truncated units',async()=>{
  const db=offline('P6',undefined,{rows:Array(501).fill(sqlRow('P6'))});expect(await resolveInegiMultiunit('P1',canonical('P6'),db.source)).toEqual({success:false,code:'MULTIUNIT_QUERY_LIMIT_EXCEEDED'});
  expect(db.query).toHaveBeenCalledWith('ROLLBACK');
});
test('SQL timeout is explicit and sanitized',async()=>{
  const db=offline('P6',undefined,{timeout:true});expect(await resolveInegiMultiunit('P1',canonical('P6'),db.source)).toEqual({success:false,code:'SCINCE_QUERY_TIMEOUT'});
});
test.each(['L14','P14'])('invalid engine topology %s rejects before unit lookup',async id=>{
  const db=offline(id);expect(await resolveInegiMultiunit('P1',canonical(id),db.source)).toEqual({success:false,code:'SCINCE_CANONICAL_GEOGRAPHY_INVALID'});
  expect(db.query.mock.calls.some(c=>c[0]===SCINCE_MULTIUNIT_SQL)).toBe(false);
});
test('missing/invalid grant cannot reach resolver even for SUPER_ADMIN',async()=>{
  const multi=jest.fn();const authorize=jest.fn(async()=>({allowed:false,code:'PROJECT_ACCESS_DENIED'} as any));
  expect(await resolveScinceCanonicalContext({projectId:'P1'},'offline',{authorize,resolveMultiunit:multi})).toMatchObject({success:false,code:'SCINCE_CANONICAL_ACCESS_DENIED'});
  expect(multi).not.toHaveBeenCalled();expect(authorize).toHaveBeenCalledWith({projectId:'P1',sessionToken:'offline',action:'ANALYZE_SCINCE'});
});
test.each(['L8-A','P6','P12-A'])('authorized service routes %s whole geometry to multiunit resolver, never Point',async id=>{
  const m=await observation(id),g=canonical(id),point=jest.fn(),multi=jest.fn(async()=>({success:true,observation:m} as const));
  const result=await resolveScinceCanonicalContext({projectId:'P1'},'offline',{authorize:jest.fn(async()=>allow(g)),resolve:point,resolveMultiunit:multi});
  expect(result).toMatchObject({success:true,queryCoordinate:null,multiunit:m});expect(multi).toHaveBeenCalledWith('P1',expect.objectContaining({geometry:g.geometry}));expect(point).not.toHaveBeenCalled();
});
test('same geometry/dataset reuses cache, changed dataset and geometry force a new spatial query',async()=>{
  const db=offline('P6');const getPool=require('@/lib/db').getPool;getPool.mockReturnValue(db.source);
  const prior=process.env.DATABASE_URL;process.env.DATABASE_URL='offline-fixture-marker';
  try {
    const g=canonical('P6');await resolveInegiMultiunit('CACHE_ONLY',g);await resolveInegiMultiunit('CACHE_ONLY',g);
    expect(db.query.mock.calls.filter(c=>c[0]===SCINCE_MULTIUNIT_SQL)).toHaveLength(1);
    const next=offline('P6',undefined,{dataset:{...dataset,version:'test-v2'}});getPool.mockReturnValue(next.source);await resolveInegiMultiunit('CACHE_ONLY',g);
    expect(next.query.mock.calls.filter(c=>c[0]===SCINCE_MULTIUNIT_SQL)).toHaveLength(1);
    const changed={...g,geographyId:'new-geography'};await resolveInegiMultiunit('CACHE_ONLY',changed);
    expect(next.query.mock.calls.filter(c=>c[0]===SCINCE_MULTIUNIT_SQL)).toHaveLength(2);
  } finally {if(prior===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=prior;getPool.mockImplementation(()=>{throw new Error('LIVE_DB_FORBIDDEN');});}
});
const proof={fullUnits:true,sameLevel:true,disjointInteriors:true};
const indicator=(kind:any,value:any,extra:any={}):any=>({name:'indicator',kind,value,universe:'official-universe',sourceReference:`source:${value}`,...extra});
test('COUNT requires full disjoint homogeneous sources',()=>expect(aggregateScinceIndicators([indicator('COUNT',3),indicator('COUNT',7)],proof)[0]).toMatchObject({value:10,method:'SUM_FULL_DISJOINT_UNITS'}));
test.each([['PERCENTAGE',100,25],['RATE',1000,250]])('%s uses accredited numerator and denominator, never arithmetic mean', (kind,scale,expected)=>{
  expect(aggregateScinceIndicators([indicator(kind,10/20*scale,{numerator:10,denominator:20,scale,formula:'NUMERATOR_DENOMINATOR'}),indicator(kind,20/100*scale,{numerator:20,denominator:100,scale,formula:'NUMERATOR_DENOMINATOR'})],proof)[0].value).toBe(expected);
});
test('AVERAGE uses explicitly accredited weights',()=>expect(aggregateScinceIndicators([indicator('AVERAGE',10,{denominator:1,formula:'WEIGHTED_MEAN'}),indicator('AVERAGE',20,{denominator:3,formula:'WEIGHTED_MEAN'})],proof)[0].value).toBe(17.5));
test.each(['INDEX','CATEGORICAL','UNKNOWN'])('%s never automatically aggregates',kind=>expect(aggregateScinceIndicators([indicator(kind,2),indicator(kind,5)],proof)[0]).toMatchObject({value:null,method:'NOT_AGGREGATED'}));
test.each(['RATE','PERCENTAGE','AVERAGE'])('%s without official formula/denominator fails closed',kind=>expect(aggregateScinceIndicators([indicator(kind,10),indicator(kind,20)],proof)[0].value).toBeNull());
test('partial coverage and mixed levels cannot yield aggregates',()=>{
  for(const p of [{...proof,fullUnits:false},{...proof,sameLevel:false},{...proof,disjointInteriors:false}])expect(aggregateScinceIndicators([indicator('COUNT',3),indicator('COUNT',7)],p)[0].value).toBeNull();
});
test('persistence/reopening retains units, aggregates, provenance and exact Firestore-safe geography',async()=>{
  const m=await observation('P12-A',['P12-A','P12-B']);const snap=buildScinceCanonicalSnapshot(success(m));
  const stored=JSON.parse(JSON.stringify(snap));expect(isValidScinceCanonicalSnapshot(stored)).toBe(true);expect(stored.multiunit.sourceRows).toHaveLength(2);
  expect(stored.multiunit.dataset.provenance).toEqual(m.dataset.provenance);expect(stored.multiunit.aggregates).toEqual(m.aggregates);
  expect(evaluateScinceSnapshotFreshness({snapshot:stored,expectedProjectId:'P1',currentCanonicalGeography:canonical('P12-A')}).territorialFreshness).toBe('CURRENT');
  function nestedArray(v:any):boolean {if(Array.isArray(v))return v.some(x=>Array.isArray(x)||nestedArray(x));if(v && typeof v==='object')return Object.values(v).some(nestedArray);return false;}
  expect(nestedArray(stored)).toBe(false);
});
test('geometry coordinate/order/project changes cannot reuse a previous snapshot',async()=>{
  const snap=buildScinceCanonicalSnapshot(success(await observation('L8-A')));const g=canonical('L8-A');
  const reversed={...g,geometry:{...g.geometry,coordinates:[...g.geometry.coordinates].reverse()}};
  for(const current of [canonical('P6'),reversed,{...g,geographyId:'other'}])expect(evaluateScinceSnapshotFreshness({snapshot:snap,expectedProjectId:'P1',currentCanonicalGeography:current}).territorialFreshness).toBe('STALE');
  expect(evaluateScinceSnapshotFreshness({snapshot:snap,expectedProjectId:'other-project',currentCanonicalGeography:g}).territorialFreshness).toBe('INVALID');
});
test.each(['aggregate','source','metric','dataset','geometry'])('tampered persisted %s is rejected',async field=>{
  const snap=buildScinceCanonicalSnapshot(success(await observation()));const m=snap.multiunit!;
  if(field==='aggregate')m.aggregates[0].value=999;
  if(field==='source')m.sourceRows[0].demographics.populationTotal=999;
  if(field==='metric')m.unitDetails[0].coverageMetric.analysisFraction=99;
  if(field==='dataset')m.dataset.version='other';
  if(field==='geometry')m.geometry.geographyId='other';
  expect(isValidScinceCanonicalSnapshot(snap)).toBe(false);
});
test('server preparation rechecks WRITE + observed result and records human incorporation, ignoring acquisition-time drift',async()=>{
  const m=await observation(),reviewed=success(m),fresh=structuredClone(reviewed);fresh.multiunit.queryTimestamp='2026-10-03T00:00:00.000Z';
  jest.mocked(cookies).mockReturnValue({get:()=>({value:'offline-cookie'})} as any);
  jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue(allow(canonical('P6')));
  jest.mocked(getCanonicalScinceData).mockResolvedValue(fresh);
  const prepared=await prepareScinceContextIncorporation('P1',reviewed);expect(prepared.success).toBe(true);
  if(prepared.success){expect(prepared.snapshot.multiunit?.humanReviewStatus).toBe('INCORPORATED');expect(prepared.incorporation.incorporatedBy.institutionalUserId).toBe('1');}
  expect(authorizeInstitutionalProjectAccess).toHaveBeenCalledWith({projectId:'P1',action:'WRITE',sessionToken:'offline-cookie'});
  fresh.multiunit.sourceRows[0].demographics.populationTotal=999;
  expect(await prepareScinceContextIncorporation('P1',reviewed)).toMatchObject({success:false});
});
test('human flow consults without persistence, incorporates only after explicit decision and preserves unrelated analysis',async()=>{
  const result=success(await observation());let context:any={projectId:'P1',readOnly:false,canQuery:true,analysis:{unrelated:'preserved'},territoryRevision:'A'};
  const write=jest.fn(),query=jest.fn(async()=>result),prepare=jest.fn(async()=>({success:true,snapshot:buildScinceCanonicalSnapshot(result),incorporation:{decision:'INCORPORATED'}} as any));
  const flow=createScinceHumanContextFlow({context:()=>context,query,prepare,updateProjectDetails:write,setAnalysisResult:jest.fn(),changed:jest.fn()});
  await flow.consult();expect(write).not.toHaveBeenCalled();await flow.incorporate();expect(write).toHaveBeenCalledWith({iaAnalysis:expect.objectContaining({unrelated:'preserved',scinceCanonicalSnapshot:expect.objectContaining({multiunit:expect.any(Object)})})});
  await flow.consult();context={...context,territoryRevision:'B'};await flow.incorporate();expect(write).toHaveBeenCalledTimes(1);
});
test('query capability reflects explicit ANALYZE_SCINCE, not WRITE or role',async()=>{
  jest.mocked(cookies).mockReturnValue({get:()=>({value:'offline-cookie'})} as any);jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue({allowed:false} as any);
  expect(await getScinceQueryCapability('P1')).toBe(false);expect(authorizeInstitutionalProjectAccess).toHaveBeenCalledWith({projectId:'P1',action:'ANALYZE_SCINCE',sessionToken:'offline-cookie'});
  jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue(allow(canonical('P6')));expect(await getScinceQueryCapability('P1')).toBe(true);
});
test.each(['L8-A','P12-A'])('document admission for %s requires human review and keeps the modality/unit facts',async id=>{
  const g=canonical(id),snap=buildScinceCanonicalSnapshot(success(await observation(id)));
  const project:any={id:'P1',canonicalGeography:serializeCanonicalGeographyForFirestore(g),iaAnalysis:{scinceCanonicalSnapshot:snap}};
  const deps={authorize:jest.fn(async()=>allow(g)),readProject:jest.fn(async()=>project)};
  const input={projectId:'P1',sessionToken:'offline',reportGeography:g};
  expect(await resolveScinceDocumentPublication(input,deps)).toMatchObject({reason:'SCINCE_DOCUMENT_HUMAN_REVIEW_REQUIRED'});
  snap.multiunit!.humanReviewStatus='INCORPORATED';project.iaAnalysis.scinceCanonicalIncorporation={decision:'INCORPORATED',incorporatedBy:{institutionalUserId:'1'},incorporatedAt:'2026-10-03T00:00:00Z'};
  const context=await resolveScinceDocumentPublication(input,deps);expect(context.publicationStatus).toBe('PUBLISHABLE');
  expect(scinceDocumentSummary(context).join(' ')).toContain(id.startsWith('L')?'sobre corredor':'sobre área');expect(scinceDocumentFacts(context).some(f=>f.label.startsWith('Unidad MANZANA'))).toBe(true);
  expect(await resolveScinceDocumentPublication({...input,reportGeography:{...g,geographyId:'other'}},deps)).toMatchObject({publicationStatus:'NOT_PUBLISHABLE_STALE'});
});


test('identical repeated source/unit identities deduplicate; contradictory census rows reject',async()=>{
  const row=sqlRow('P6');const m=await observation('P6',undefined,{rows:[row,{...row}]});expect(m.territorialUnits).toHaveLength(1);expect(m.sourceRows).toHaveLength(1);expect(m.unitDetails).toHaveLength(1);
  const db=offline('P6',undefined,{rows:[row,{...row,pobtot:999}]});expect(await resolveInegiMultiunit('P1',canonical('P6'),db.source)).toMatchObject({success:false});
});
test.each(['L8-A','P12-A'])('real narrative and technical annex models retain %s modality and provenance without generating a report',async id=>{
  const g=canonical(id),snap=buildScinceCanonicalSnapshot(success(await observation(id)));snap.multiunit!.humanReviewStatus='INCORPORATED';
  const lineage=buildEvidenceLineage({geographyId:g.geographyId,sourceId:'source-1',evidenceId:'ev-1',findingId:'find-1',analysisId:'analysis-1'});
  const project={id:'P1',nombre:'Synthetic fixture',numeroExpediente:'03102026-0001-PPC',canonicalGeography:g,
    canonicalHypothesis:formulateHumanHypothesis({projectId:'P1',text:'Hipótesis humana del fixture offline',geographyId:g.geographyId,authorId:'PPC',createdAt:'2026-10-03T00:00:00Z',supportingEvidenceIds:['ev-1'],supportingFindingIds:['find-1'],lineage}),
    evidence:[{evidenceId:'ev-1',geographyId:g.geographyId,humanValidationStatus:'APPROVED',lineage,forensicIntegrity:createComputedFileIntegrity({rawSha256:'c'.repeat(64),declaredMimeType:'image/jpeg'}),sourceStatus:'AUTHORITATIVE'}],
    findings:[{findingId:'find-1',title:'Observación humana fixture',humanValidationStatus:'APPROVED',lineage,lineageStatus:'SUPPORTED'}],
    analysisOutputs:[{analysisId:'analysis-1',humanValidationStatus:'APPROVED',lineage,lineageStatus:'SUPPORTED'}]};
  const input:any={...buildInstitutionalReportInput(project,{generatedAt:'2026-10-03T00:00:00Z'}),
    scinceContext:{publicationStatus:'PUBLISHABLE',territorialFreshness:'CURRENT',snapshot:snap,reason:null}};
  const executive=buildExecutiveGeointReportModel(input,{documentIdentity:{numeroExpediente:'03102026-0001-PPC',projectId:'P1'},fecha:'2026-10-03T00:00:00Z'});
  const composition=buildExecutiveVisualComposition(executive,input),document=buildExecutiveGeointReportDocumentModel(executive,composition,input);
  const annex=buildExecutiveGeointTechnicalAnnexModel(input,executive,composition,document);
  expect(document.sections.find(s=>s.sectionId==='territorial-situation')!.content.join(' ')).toContain(id.startsWith('L')?'sobre corredor':'sobre área');
  expect(document.technicalMetadata.sourceProvenance).toContainEqual(expect.objectContaining({source:'INEGI SCINCE',sourceUrl:dataset.census_source_url,observedAt:null}));
  expect(annex.sections.find(s=>s.sectionId==='scince')!.facts.some(f=>f.label.startsWith('Unidad MANZANA'))).toBe(true);
});

test('weighted denominator overflow never fabricates zero',()=>{
  const rows=[indicator('RATE',1,{sourceReference:'a',numerator:1,denominator:1e308,scale:1,formula:'NUMERATOR_DENOMINATOR'}),indicator('RATE',2,{sourceReference:'b',numerator:2,denominator:1e308,scale:1,formula:'NUMERATOR_DENOMINATOR'})];
  expect(aggregateScinceIndicators(rows,proof)[0]).toMatchObject({value:null,method:'NOT_AGGREGATED',reason:'DENOMINATOR_OVERFLOW'});
});

test('Point keeps ST_Covers semantics and uses a project/geometry/dataset cache with fresh dataset checks',async()=>{
  let current=dataset;const query=jest.fn(async(sql:string)=>{
    if(sql.includes('FROM public.inegi_scince_normalization_release'))return {rows:[]};
    if(sql.includes('FROM public.inegi_territorial_dataset'))return {rows:[current]};
    if(sql.includes('WITH point AS'))return {rows:[{geographic_level:'MANZANA',cve_ent:'01',cve_mun:'001',cve_loc:'0001',cve_ageb:'0017',cve_mza:'001',geographic_name:'Synthetic unit',geometry:JSON.stringify(measured('P6').unitGeometry)}]};
    if(sql.includes('FROM public.inegi_territorial_demographics'))return {rows:[{geographic_level:'MANZANA',pobtot:10,vivtot:5,vivpar_hab:4,vivpar_deshab:1,source_row_key:'01:001:0001:0017:001'}]};
    throw new Error('Unexpected Point SQL');
  });
  const getPool=require('@/lib/db').getPool;getPool.mockReturnValue({query});const prior=process.env.DATABASE_URL;process.env.DATABASE_URL='offline-fixture-marker';
  try {
    const scope={projectId:'POINT_CACHE_ONLY',geographyId:'point-1',geographyFingerprint:'point-fingerprint-fixture'};
    const first=await resolveInegiTerritory(21,-102,undefined,scope),second=await resolveInegiTerritory(21,-102,undefined,scope);
    expect(first.status).toBe('OBSERVED');expect(second).toEqual(first);expect(first.demographics?.populationTotal).toBe(10);
    expect(query.mock.calls.filter(c=>c[0].includes('WITH point AS'))).toHaveLength(1);
    expect(query.mock.calls.filter(c=>c[0].includes('FROM public.inegi_territorial_dataset'))).toHaveLength(2);
    expect(query.mock.calls.find(c=>c[0].includes('WITH point AS'))![0]).toContain('ST_Covers(g.geom, p.geom)');
    current={...dataset,version:'point-v2'};await resolveInegiTerritory(21,-102,undefined,scope);
    await resolveInegiTerritory(21,-102,undefined,{...scope,geographyFingerprint:'new-point-revision'});
    expect(query.mock.calls.filter(c=>c[0].includes('WITH point AS'))).toHaveLength(3);
  } finally {if(prior===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=prior;getPool.mockImplementation(()=>{throw new Error('LIVE_DB_FORBIDDEN');});}
});
