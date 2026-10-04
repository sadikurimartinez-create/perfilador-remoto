jest.mock('@/lib/scinceObservationRepository',()=>({...jest.requireActual('@/lib/scinceObservationRepository'),getCurrentScinceRelease:jest.fn(async()=>null)}));
import {execFileSync} from 'child_process';
import {join,resolve} from 'path';
import {getPool} from '../src/lib/db';
import {resolveInegiLegacyMultiunit as resolveInegiMultiunit,SCINCE_MULTIUNIT_SQL} from '../src/lib/inegiMultiunitResolver';
import {SCINCE_ANALYSIS_AREA_SQL,assertScinceProjectionDomain} from '../src/lib/scinceAnalysisArea';
import {readScinceRadiusConfiguration} from '../src/lib/scinceRadiusConfiguration';
import {resolveScinceCanonicalContext} from '../src/services/scinceCanonicalContextService';
import {buildScinceCanonicalSnapshot,isValidScinceCanonicalSnapshot,evaluateScinceSnapshotFreshness} from '../src/utils/scinceCanonicalSnapshot';
import {deriveScinceSociodemographicProfile} from '../src/utils/scinceSociodemographicProfile';
import {scinceDocumentSummary,scinceDocumentFacts} from '../src/utils/scinceDocumentContext';
import {resolveScinceDocumentPublication} from '../src/services/scinceDocumentPublicationService';
import {prepareScinceContextIncorporation} from '../src/lib/scinceHumanContextActions';
import {getCanonicalScinceData} from '../src/lib/osintActions';
import {authorizeInstitutionalProjectAccess} from '../src/services/institutionalProjectAccessService';
import {cookies} from 'next/headers';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'fs';
import ts from 'typescript';
import * as queryGeometry from '../src/utils/scinceQueryGeometry';
import type {ScinceRadiusConfiguration} from '../src/types/scinceAnalysisArea';

jest.mock('server-only',()=>({}),{virtual:true});
jest.mock('@/lib/db',()=>({getPool:jest.fn(()=>{throw new Error('LIVE_DB_FORBIDDEN');})}));
jest.mock('@/services/institutionalProjectAccessService',()=>({authorizeInstitutionalProjectAccess:jest.fn()}));
jest.mock('@/lib/osintActions',()=>({getCanonicalScinceData:jest.fn()}));
jest.mock('@/lib/firebaseAdmin',()=>({getInstitutionalAdminDb:jest.fn(()=>{throw new Error('LIVE_FIRESTORE_FORBIDDEN');})}));
jest.mock('next/headers',()=>({cookies:jest.fn()}));
const config:ScinceRadiusConfiguration={version:'SCINCE_RADIUS_CONFIG_V1',governanceReference:'SYNTHETIC_QA_ONLY',
  individualBaseRadiusMeters:300,lineContextExpansionMeters:200,polygonContextExpansionMeters:400};
const dataset={dataset_id:'radius-offline',product_name:'Synthetic offline only',reference_year:2020,version:'fixture-v1',
  imported_at:'2026-01-01T00:00:00Z',completed_at:'2026-01-02T00:00:00Z',geography_source_url:'https://www.inegi.org.mx/fixture',
  census_source_url:'https://www.inegi.org.mx/fixture',geography_sha256:'a'.repeat(64),census_sha256:'b'.repeat(64)};
let engine:any;
beforeAll(()=>{engine=JSON.parse(execFileSync(process.env.SCINCE_QA_PYTHON || join(process.env.USERPROFILE!,' .cache'.trim(),'codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),
  [resolve(__dirname,'helpers/scinceRadiusOffline.py')],{encoding:'utf8',timeout:60000}));},65000);
beforeEach(()=>jest.clearAllMocks());
const fixture=(name:string)=>engine.cases.find((c:any)=>c.name===name);
function canonical(name:string):any {const f=fixture(name);return {geographyId:'P1:source',type:f.source.type==='Point'?'INDIVIDUAL':f.source.type==='LineString'?'CORRIDOR':'POLYGON',
  geometry:f.source,validationStatus:'VALID',source:'MAP_VECTOR',createdAt:1,updatedAt:1};}
function offline(name:string,options:{count?:number;containment?:boolean;timeout?:boolean}={}) {
  const f=fixture(name);
  const row={geography_id:'1',geographic_level:'MANZANA',source_cvegeo:'0100100010017001',geographic_name:'Synthetic context-only unit',geometry:JSON.stringify(f.unit),
    is_valid:f.unitFlags.valid,is_simple:f.unitFlags.simple,is_empty:f.unitFlags.empty,srid:4326,area:f.unitFlags.area,
    intersects:f.intersects,touches:f.touches,covers_gu:f.covers_gu,covers_ug:f.covers_ug,equals:f.equals,relate:f.relate,
    // Repository metric columns are explicit mocks; geometry/predicates are measured by installed engines.
    intersection_measure:100,unit_area:100,analysis_measure:f.row.area_square_meters,
    source_row_key:'01:001:0001:0017:001',pobtot:10,vivtot:5,vivpar_hab:4,vivpar_deshab:1};
  const query=jest.fn(async(sql:string,values?:any[])=>{
    if(sql.startsWith('BEGIN')||sql.startsWith('SET')||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
    if(sql.includes('FROM public.inegi_scince_normalization_release'))return {rows:[]};
    if(sql.includes('FROM public.inegi_territorial_dataset'))return {rows:[dataset]};
    if(sql===SCINCE_ANALYSIS_AREA_SQL){if(options.timeout)throw Object.assign(new Error('private SQL'),{code:'57014'});
      return {rows:[{...f.row,...(options.containment===false?{contains_source:false}:{})}]};}
    if(sql.includes('postgis_geos_version'))return {rows:[{is_valid:f.areaFlags.valid,is_simple:f.areaFlags.simple,is_empty:f.areaFlags.empty,srid:4326,area:f.areaFlags.area,engine_version:engine.engine}]};
    if(sql===SCINCE_MULTIUNIT_SQL)return {rows:Array.from({length:options.count ?? 1},()=>row)};
    if(sql.includes('AS disjoint'))return {rows:[{disjoint:true}]};
    throw new Error('Unexpected offline SQL');
  });
  return {source:{connect:jest.fn(async()=>({query,release:jest.fn()}))},query};
}
async function observation(name='point') {const db=offline(name);const r=await resolveInegiMultiunit('P1',canonical(name),db.source,config);
  if(!r.success)throw new Error(r.code);return r.observation;}
function success(m:any):any {return {success:true,projectId:'P1',geographyId:m.geographyBinding.geographyId,geographyType:m.geographyBinding.geographyType,
  geographyFingerprint:m.geographyBinding.geographyFingerprint,spatialMode:m.geographyBinding.geographyType==='INDIVIDUAL'?'CANONICAL_POINT':m.geographyBinding.geographyType==='CORRIDOR'?'CANONICAL_LINE':'CANONICAL_AREA',queryCoordinate:null,
  datasetId:m.dataset.datasetId,datasetYear:m.dataset.year,datasetVersion:m.dataset.version,geographicLevel:null,demographicGeographicLevel:null,sourceRowKey:null,demographics:null,provenance:null,limitations:m.limitations,multiunit:m};}

test('1 Point radius is explicitly configured',async()=>expect((await observation()).scinceAnalysisArea?.analysisRadiusMeters).toBe(300));
test('2 Point area is a closed 128-sided metric circumscribed circle',()=>{const f=fixture('point');expect(JSON.parse(f.row.geometry).coordinates[0]).toHaveLength(129);
  expect(f.row.construction_radius).toBeCloseTo(300/Math.cos(Math.PI/128),8);expect(f.row.contains_source).toBe(true);});
test.each(['point','line','polygon'])('3/9/14 %s selects context units by analysis area rather than source',async name=>{
  const f=fixture(name),db=offline(name);expect(f.sourceIntersectsUnit).toBe(false);expect(f.intersects).toBe(true);
  const r=await resolveInegiMultiunit('P1',canonical(name),db.source,config);expect(r.success).toBe(true);
  const json=JSON.parse(db.query.mock.calls.find(c=>c[0]===SCINCE_MULTIUNIT_SQL)![1]![0]);expect(json).toEqual(JSON.parse(f.row.geometry));expect(json).not.toEqual(f.source);
});
test('4 Line midpoint is a central position on the metric line, not its bbox',()=>{const f=fixture('line');expect(f.metricCenter[0]).toBeCloseTo(f.metricSource.coordinates[1][0],0);expect(f.metricCenter[1]).toBeCloseTo(f.metricSource.coordinates[1][1],0);});
test.each([['5 start',0],['6 end',2]])('line radius covers %s',(_label,index)=>{const f=fixture('line');expect(f.metricVertexDistances[index]).toBeLessThanOrEqual(f.row.coverage_radius);});
test('7 Line covers all vertices and complete transformed geometry',()=>{const f=fixture('line');expect(Math.max(...f.metricVertexDistances)).toBe(f.row.coverage_radius);expect(f.row.contains_source).toBe(true);});
test('8 Line configured expansion is added',async()=>expect((await observation('line')).scinceAnalysisArea?.contextExpansionMeters).toBe(200));
test('10 Polygon uses metric minimum enclosing circle center',async()=>expect((await observation('polygon')).scinceAnalysisArea?.centerMethod).toBe('METRIC_MINIMUM_BOUNDING_CIRCLE'));
test('11 Polygon vertices lie within coverage radius',()=>{const f=fixture('polygon');expect(f.metricVertexDistances.every((v:number)=>v<=f.row.coverage_radius)).toBe(true);});
test('12 Complete polygon including boundaries is covered by actual derived WGS84 geometry',()=>expect(fixture('polygon').row.contains_source).toBe(true));
test('13 Polygon expansion is added',async()=>{const a=(await observation('polygon')).scinceAnalysisArea!;expect(a.analysisRadiusMeters-a.coverageRadiusMeters).toBeCloseTo(400,8);});
test('15 MultiPolygon complete components are covered',()=>expect(fixture('multi').row.contains_source).toBe(true));
test('16 Interior holes do not inflate the minimum enclosing radius',()=>expect(fixture('hole').row.coverage_radius).toBeCloseTo(fixture('polygon').row.coverage_radius,8));
test('17 Separated components contribute to the radius',()=>expect(fixture('multi').row.coverage_radius).toBeGreaterThan(fixture('polygon').row.coverage_radius*2));
test.each(['point','line','polygon','hole','multi'])('18 canonical %s stays intact after area derivation',async name=>{const g=canonical(name),before=JSON.stringify(g);await resolveInegiMultiunit('P1',g,offline(name).source,config);expect(JSON.stringify(g)).toBe(before);});
test.each(['point','line','polygon','multi'])('19 V2 %s round-trip binds source and area with provenance',async name=>{const m=await observation(name),s=buildScinceCanonicalSnapshot(success(m));
  expect(s.schemaVersion).toBe('SCINCE_CANONICAL_SNAPSHOT_V2');expect(isValidScinceCanonicalSnapshot(JSON.parse(JSON.stringify(s)))).toBe(true);
  expect(s.multiunit?.dataset.provenance).toEqual(m.dataset.provenance);expect(evaluateScinceSnapshotFreshness({snapshot:s,expectedProjectId:'P1',currentCanonicalGeography:canonical(name)}).territorialFreshness).toBe('CURRENT');});
test('20 Runtime Point authorization is ANALYZE_SCINCE before resolver; no role bypass',async()=>{const resolver=jest.fn();const auth=jest.fn(async()=>({allowed:false,code:'PROJECT_ACTION_FORBIDDEN'} as any));
  expect((await resolveScinceCanonicalContext({projectId:'P1'},'internal',{authorize:auth,resolveMultiunit:resolver})).success).toBe(false);
  expect(auth).toHaveBeenCalledWith({projectId:'P1',sessionToken:'internal',action:'ANALYZE_SCINCE'});expect(resolver).not.toHaveBeenCalled();});
test('runtime Point uses analysis-area resolver and never the direct point query',async()=>{const m=await observation();const multi=jest.fn(async()=>({success:true,observation:m} as const));
  const r=await resolveScinceCanonicalContext({projectId:'P1'},'internal',{authorize:jest.fn(async()=>({allowed:true,projectId:'P1',project:{canonicalGeography:canonical('point')}} as any)),resolveMultiunit:multi});
  expect(r.success).toBe(true);expect(multi).toHaveBeenCalledWith('P1',expect.objectContaining({geometry:canonical('point').geometry,geographyId:'P1:source'}));});
test('21 PPC preparation still checks WRITE and reacquires before explicit incorporation',async()=>{const m=await observation();jest.mocked(cookies).mockReturnValue({get:()=>({value:'internal'})} as any);
  jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue({allowed:true,projectId:'P1',actor:{institutionalUserId:'1',username:'PPC'},project:{canonicalGeography:canonical('point')}} as any);
  jest.mocked(getCanonicalScinceData).mockResolvedValue(success(m));const r=await prepareScinceContextIncorporation('P1',success(m));
  expect(r.success).toBe(true);if(r.success)expect(r.snapshot.multiunit?.humanReviewStatus).toBe('INCORPORATED');
  expect(authorizeInstitutionalProjectAccess).toHaveBeenCalledWith(expect.objectContaining({action:'WRITE'}));});
test.each([['point','punto'],['line','corredor'],['polygon','área poligonal']])('22 report %s describes source modality and separate radius',async(name,label)=>{const s=buildScinceCanonicalSnapshot(success(await observation(name)));
  const context:any={publicationStatus:'PUBLISHABLE',snapshot:s};expect(scinceDocumentSummary(context).join(' ')).toContain(label);expect(scinceDocumentSummary(context).join(' ')).toContain('radio de');
  expect(scinceDocumentFacts(context).some(f=>f.label==='Área analítica SCINCE separada')).toBe(true);});
test('23 Configuration changes invalidate productive cache including governance revision',async()=>{const oldEnv={...process.env};try{
  Object.assign(process.env,{DATABASE_URL:'mock-only',SCINCE_DEFAULT_RADIUS_M:'300',SCINCE_LINE_CONTEXT_EXPANSION_M:'200',SCINCE_POLYGON_CONTEXT_EXPANSION_M:'400',SCINCE_RADIUS_GOVERNANCE_REFERENCE:'QA_A'});
  const db=offline('point');jest.mocked(getPool).mockReturnValue(db.source as any);
  await resolveInegiMultiunit('CACHE_RADIUS',canonical('point'));await resolveInegiMultiunit('CACHE_RADIUS',canonical('point'));
  expect(db.query.mock.calls.filter(c=>c[0]===SCINCE_ANALYSIS_AREA_SQL)).toHaveLength(1);
  process.env.SCINCE_RADIUS_GOVERNANCE_REFERENCE='QA_B';await resolveInegiMultiunit('CACHE_RADIUS',canonical('point'));
  expect(db.query.mock.calls.filter(c=>c[0]===SCINCE_ANALYSIS_AREA_SQL)).toHaveLength(2);
  process.env.SCINCE_DEFAULT_RADIUS_M='350';await resolveInegiMultiunit('CACHE_RADIUS',canonical('point'));
  expect(db.query.mock.calls.filter(c=>c[0]===SCINCE_ANALYSIS_AREA_SQL)).toHaveLength(3);
  expect(db.query.mock.calls.filter(c=>c[0]===SCINCE_ANALYSIS_AREA_SQL).at(-1)![1]![1]).toBe(350);
 }finally{process.env=oldEnv;}});
test('24 Multiunit limit remains fail-closed after area computation',async()=>expect(await resolveInegiMultiunit('P1',canonical('point'),offline('point',{count:501}).source,config)).toEqual({success:false,code:'MULTIUNIT_QUERY_LIMIT_EXCEEDED'}));
test('25 Available indicators group population and housing only',async()=>{const p=(await observation()).derivedSociodemographicProfile!;expect(Object.keys(p.dimensions).sort()).toEqual(['housing','population']);expect(p.dimensions.housing?.rawIndicators).toHaveLength(3);});
test('26 Unknown indicator is explicitly unclassified, not invented',()=>{const p=deriveScinceSociodemographicProfile([{name:'UNACCREDITED',kind:'UNKNOWN',value:null,sourceReference:'fixture',observationId:'fixture',universe:'fixture'}],[],2020,'fixture');expect(p.dimensions).toEqual({});expect(p.unclassifiedIndicatorNames).toEqual(['UNACCREDITED']);});
test('27 Base profile remains census year 2020 and current estimate is absent',async()=>{const m=await observation();expect(m.officialBaseProfile?.referenceYear).toBe(2020);expect(m.estimatedCurrentProfile).toBeNull();});
test('28 Profile indicators preserve source identities and dataset provenance',async()=>{const m=await observation();expect(m.officialBaseProfile?.dimensions.population?.rawIndicators[0].sourceReference).toBe(m.sourceRows[0].observationId);expect(m.dataset.provenance.censusSha256).toBe('b'.repeat(64));});
test('29 Profile reconstructs exactly from raw indicators and admissible aggregates',async()=>{const m=await observation();expect(deriveScinceSociodemographicProfile(m.rawScinceIndicators!,m.aggregates,m.dataset.year,m.partitionEvidence.datasetIdentity)).toEqual(m.derivedSociodemographicProfile);});
test('30 Missing dimensions are omitted, never fabricated zeroes',async()=>{const p=(await observation()).officialBaseProfile!;expect(p.dimensions).not.toHaveProperty('education');expect(p.dimensions).not.toHaveProperty('sex');expect(p.dimensions).not.toHaveProperty('density');});
test('No approved configuration aborts before connection',async()=>{const db=offline('point');const env={...process.env};try{
  delete process.env.SCINCE_DEFAULT_RADIUS_M;expect(await resolveInegiMultiunit('P1',canonical('point'),db.source)).toEqual({success:false,code:'SCINCE_RADIUS_CONFIGURATION_REQUIRED'});expect(db.source.connect).not.toHaveBeenCalled();
 }finally{process.env=env;}});
test('Explicit zero expansion is allowed; empty, negative and infinite configuration is rejected',()=>{expect(readScinceRadiusConfiguration({SCINCE_DEFAULT_RADIUS_M:'300',SCINCE_LINE_CONTEXT_EXPANSION_M:'0',SCINCE_POLYGON_CONTEXT_EXPANSION_M:'400',SCINCE_RADIUS_GOVERNANCE_REFERENCE:'QA'})).not.toBeNull();expect(readScinceRadiusConfiguration({})).toBeNull();});
test('Containment failure rolls back and never queries units',async()=>{const db=offline('line',{containment:false});expect((await resolveInegiMultiunit('P1',canonical('line'),db.source,config)).success).toBe(false);expect(db.query.mock.calls.some(c=>c[0]===SCINCE_MULTIUNIT_SQL)).toBe(false);expect(db.query).toHaveBeenCalledWith('ROLLBACK');});
test('Radius query timeout preserves explicit timeout result',async()=>expect(await resolveInegiMultiunit('P1',canonical('point'),offline('point',{timeout:true}).source,config)).toEqual({success:false,code:'SCINCE_QUERY_TIMEOUT'}));
test('Dynamic local projection works outside primary territory',()=>{const f=fixture('otherRegion');expect(f.row.projection).toContain('+lat_0=48.');expect(f.row.contains_source).toBe(true);});
test.each([{coordinates:[[179,10],[-179,10]]},{coordinates:[[0,85],[1,85]]}])('Unsupported antimeridian/polar domains reject without hardcoded projection',({coordinates})=>expect(()=>assertScinceProjectionDomain({...canonical('line'),geometry:{type:'LineString',coordinates}})).toThrow());
test('SQL uses metric operations and verifies whole source, including serialization',()=>{expect(SCINCE_ANALYSIS_AREA_SQL).toContain('ST_MaxDistance(center,metric_geom)');expect(SCINCE_ANALYSIS_AREA_SQL).toContain('ST_Covers(published_geom,geom)');expect(SCINCE_ANALYSIS_AREA_SQL).toContain('ST_Area(published_geom::geography)');});
test('Metadata/profile tampering invalidates persisted snapshot',async()=>{const s=buildScinceCanonicalSnapshot(success(await observation()));s.multiunit!.scinceAnalysisArea!.analysisRadiusMeters+=1;expect(isValidScinceCanonicalSnapshot(s)).toBe(false);});
test('Official profile cannot differ from reproducible base',async()=>{const s=buildScinceCanonicalSnapshot(success(await observation()));s.multiunit!.officialBaseProfile!.referenceYear=2026;expect(isValidScinceCanonicalSnapshot(s)).toBe(false);});
test('Document gate rejects old radius configuration without invoking live report generation',async()=>{const s=buildScinceCanonicalSnapshot(success(await observation()));s.multiunit!.humanReviewStatus='INCORPORATED';
  const r=await resolveScinceDocumentPublication({projectId:'P1',sessionToken:'internal',reportGeography:canonical('point')},{authorize:jest.fn(async()=>({allowed:true,projectId:'P1'} as any)),readProject:jest.fn(async()=>({id:'P1',canonicalGeography:canonical('point'),iaAnalysis:{scinceCanonicalSnapshot:s,scinceCanonicalIncorporation:{decision:'INCORPORATED',incorporatedBy:{institutionalUserId:'1'},incorporatedAt:'2026-01-01T00:00:00Z'}}}))});
  expect(r.publicationStatus).toBe('NOT_PUBLISHABLE_STALE');});

function loadTsx(file:string,modules:Record<string,any>={}) {
  const js=ts.transpileModule(readFileSync(resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  const record={exports:{} as any};new Function('require','module','exports',js)((name:string)=>{
    if(name in modules)return modules[name];
    if(name==='@/components/ui/CEIPOLButton')return loadTsx('src/components/ui/CEIPOLButton.tsx');
    return require(name);
  },record,record.exports);return record.exports;
}
test('Actual PPC result renders compact expandable methodology and available profile dimensions',async()=>{
  const {ScinceObservedResult}=loadTsx('src/components/ScinceHumanContextPanel.tsx');
  const html=renderToStaticMarkup(React.createElement(ScinceObservedResult,{result:success(await observation())}));
  for(const label of ['<details>','Centro de análisis','Radio de cobertura','Expansión contextual','Radio total','Área aproximada analizada','Unidades INEGI','Perfil oficial','Población','Vivienda'])expect(html).toContain(label);
  expect(html).not.toContain('Perfil oficial 2026');
});
test('Actual temporary map overlay can be hidden and cannot follow a changed source or project',async()=>{
  let cursor=0;const slots:any[]=[];let receive:any;
  const prior=(globalThis as any).window;(globalThis as any).window={addEventListener:(_name:string,fn:any)=>{receive=fn;},removeEventListener:jest.fn()};
  try {
    const react={...React,useEffect:(fn:any)=>fn(),useState:(initial:any)=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],(next:any)=>{slots[i]=next;}];}};
    const Polygon=()=>null,OverlayView=Object.assign(()=>null,{FLOAT_PANE:'floatPane'});
    const {ScinceAnalysisAreaLayer}=loadTsx('src/components/maps/layers/ScinceAnalysisAreaLayer.tsx',{'react':react,'@react-google-maps/api':{Polygon,OverlayView},'../../../utils/scinceQueryGeometry':queryGeometry});
    const g=canonical('point'),m=await observation();const render=(geo=g)=>{cursor=0;return ScinceAnalysisAreaLayer({projectId:'P1',canonicalGeography:geo});};
    expect(render()).toBeNull();receive({detail:{projectId:'OTHER',source:g,area:m.scinceAnalysisArea}});expect(render()).toBeNull();
    receive({detail:{projectId:'P1',source:g,area:m.scinceAnalysisArea}});let tree=render();const children=React.Children.toArray(tree.props.children) as any[];
    expect(children[0].type).toBe(Polygon);children[1].props.children.props.onClick();tree=render();
    expect((React.Children.toArray(tree.props.children) as any[]).some(n=>n.type===Polygon)).toBe(false);
    expect(render({...g,geometry:{type:'Point',coordinates:[-102.4,21.9]}})).toBeNull();
  } finally {(globalThis as any).window=prior;}
});
test.each(['-1','Infinity','NaN','','100001'])('Unapproved invalid Point radius %s has no default',radius=>expect(readScinceRadiusConfiguration({SCINCE_DEFAULT_RADIUS_M:radius,SCINCE_LINE_CONTEXT_EXPANSION_M:'200',SCINCE_POLYGON_CONTEXT_EXPANSION_M:'400',SCINCE_RADIUS_GOVERNANCE_REFERENCE:'QA'})).toBeNull());
test('Inherited object names remain unclassified indicators',()=>expect(deriveScinceSociodemographicProfile([{name:'toString',kind:'UNKNOWN',value:null,observationId:'x',sourceReference:'x',universe:'x'}],[],2020,'x').dimensions).toEqual({}));
