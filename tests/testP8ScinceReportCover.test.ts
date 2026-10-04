import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {execFileSync} from 'child_process';
import {join,resolve} from 'path';
import {readFileSync,writeFileSync,mkdirSync} from 'fs';
import {createHash} from 'crypto';
import {catalog,catalogFingerprint,NORMALIZATION_VERSION,parseTypedValue,normalizeRow,validateHeader,legacyCounts} from '../src/lib/scinceCatalogCore.cjs';
import {resolveInegiMultiunit,SCINCE_MULTIUNIT_SQL} from '../src/lib/inegiMultiunitResolver';
import {SCINCE_ANALYSIS_AREA_SQL} from '../src/lib/scinceAnalysisArea';
import {SCINCE_RELEASE_SQL,SCINCE_EXACT_RELEASE_SQL,SCINCE_OBSERVATIONS_SQL,readScinceRelease,readScinceObservations,createScinceMaterializationRepository} from '../src/lib/scinceObservationRepository';
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
function canonical(name='point'):any {const f=engine.cases.find((f:any)=>f.name===name);return {geographyId:'geo',type:f.source.type==='Point'?'INDIVIDUAL':f.source.type==='LineString'?'CORRIDOR':'POLYGON',geometry:f.source,validationStatus:'VALID',source:'MAP_VECTOR',createdAt:1,updatedAt:1};}
function offline(name='point',changed:any={},rawChanges:any={}) {
  const f=engine.cases.find((f:any)=>f.name===name),raw={...publicRows.find((r:any)=>r.MZA==='001'),POBTOT:'170',POBFEM:'90',POBMAS:'80',VIVTOT:'54',VIVPAR_HAB:'54',VIVPAR_DES:'0',...rawChanges};
  const sourceKey='01:001:0001:0017:001';
  const row={geography_id:'1',geographic_level:'MANZANA',source_cvegeo:'0100100010017001',geographic_name:'Synthetic full unit',geometry:JSON.stringify(f.unit),is_valid:f.unitFlags.valid,is_simple:f.unitFlags.simple,is_empty:f.unitFlags.empty,srid:4326,area:f.unitFlags.area,intersects:f.intersects,touches:f.touches,covers_gu:true,covers_ug:false,equals:false,relate:'212FF1FF2',intersection_measure:100,unit_area:100,analysis_measure:f.row.area_square_meters,source_row_key:sourceKey,pobtot:170,vivtot:54,vivpar_hab:54,vivpar_deshab:0};
  const currentRelease={...releaseRow,...changed};
  const query=jest.fn(async(sql:string,values?:any[])=>{
    if(sql.startsWith('BEGIN')||sql.startsWith('SET')||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
    if(sql.includes('FROM public.inegi_territorial_dataset'))return {rows:[dataset]};
    if(sql===SCINCE_RELEASE_SQL || sql===SCINCE_EXACT_RELEASE_SQL)return {rows:[currentRelease]};
    if(sql===SCINCE_OBSERVATIONS_SQL)return {rows:[{geographic_level:'MANZANA',source_row_key:sourceKey,raw_source:raw,observations:normalizeRow(raw,'MANZANA',sourceKey)}]};
    if(sql===SCINCE_ANALYSIS_AREA_SQL)return {rows:[f.row]};
    if(sql.includes('postgis_geos_version'))return {rows:[{is_valid:f.areaFlags.valid,is_simple:f.areaFlags.simple,is_empty:f.areaFlags.empty,srid:4326,area:f.areaFlags.area,engine_version:engine.engine}]};
    if(sql===SCINCE_MULTIUNIT_SQL)return {rows:[row]};
    if(sql.includes('AS disjoint'))return {rows:[{disjoint:true}]};
    throw new Error('UNEXPECTED_OFFLINE_QUERY');
  });return {source:{connect:jest.fn(async()=>({query,release:jest.fn()}))},query};
}
import * as officialProfile from '../src/utils/scinceOfficialProfile';
async function observation(name='point',rawChanges:any={}) {
  let historical:any;const original=officialProfile.buildOfficialBaseProfile2020;
  const capture=jest.spyOn(officialProfile,'buildOfficialBaseProfile2020').mockImplementation((m,r,o)=>{historical=m;return original(m,r,o);});
  try {const r=await resolveInegiMultiunit('exp',canonical(name),offline(name,{},rawChanges).source,config);if(!r.success)throw new Error(r.code);if(!historical)throw new Error('HISTORICAL_FIXTURE_REQUIRED');return historical;}
  finally {capture.mockRestore();}
}
function success(m:any):any{return {success:true,projectId:'exp',geographyId:m.geographyBinding.geographyId,geographyType:m.geographyBinding.geographyType,geographyFingerprint:m.geographyBinding.geographyFingerprint,spatialMode:m.geographyBinding.geographyType==='INDIVIDUAL'?'CANONICAL_POINT':m.geographyBinding.geographyType==='CORRIDOR'?'CANONICAL_LINE':'CANONICAL_AREA',queryCoordinate:null,datasetId:m.dataset.datasetId,datasetYear:2020,datasetVersion:m.dataset.version,geographicLevel:null,demographicGeographicLevel:null,sourceRowKey:null,demographics:null,provenance:null,limitations:m.limitations,multiunit:m};}

import {webcrypto} from 'crypto';
import {deserializeCanonicalGeographyFromFirestore} from '../src/utils/canonicalProjectGeography';
import {buildExecutiveGeointReportModel} from '../src/utils/executiveGeointReportModel';
import {buildExecutiveVisualComposition} from '../src/utils/executiveVisualComposition';
import {buildExecutiveCanonicalTerritorialMapSpec} from '../src/utils/executiveCanonicalTerritorialMap';
import {materializeAuthorizedVisualSnapshot,verifyAuthorizedVisualBytes} from '../src/services/institutionalVisualAuthorityService';
import {Packer} from 'docx';
import JSZip from 'jszip';
import {createCanvas} from '@napi-rs/canvas';
import {p6Fixture} from './p6InstitutionalFixture';
import {buildScinceReportCover,SCINCE_COVER_MAP_ID} from '../src/utils/scinceReportCover';
import {materializeScinceCoverMap} from '../src/utils/scinceCoverMapMaterializer';
import {buildExecutiveGeointReportDocumentModel} from '../src/utils/executiveGeointReportDocumentModel';
import {renderExecutiveGeointWordDocument} from '../src/utils/executiveGeointWordRenderer';
import {reconcileMaterializedDocument} from '../src/utils/institutionalDocumentSemanticIntegrity';
import {renderInstitutionalPdfFromDocx} from '../src/utils/institutionalPdfRenderer';
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const fixtures:Record<string,any>={};
async function admitted(name='point',changes:any={}) {
 const m=await observation(name,changes); m.humanReviewStatus='INCORPORATED';
 return {publicationStatus:'PUBLISHABLE',territorialFreshness:'CURRENT',reason:null,snapshot:buildScinceCanonicalSnapshot(success(m))} as const;
}
function inputFor(c:any) {return {...p6Fixture(c.snapshot?.multiunit?.geometry.type || 'INDIVIDUAL').data,projectId:'exp',geography:deserializeCanonicalGeographyFromFirestore(c.snapshot?.multiunit?.geometry) || p6Fixture().data.geography,scinceContext:c} as any;}
beforeAll(async()=>{
 for(const name of ['point','line','polygon','multi']) {
  const c=await admitted(name), data=inputFor(c), baseline=p6Fixture(data.geography.type);
  const executive=buildExecutiveGeointReportModel(data,{documentIdentity:{numeroExpediente:baseline.document.identity.numeroExpediente,projectId:'exp'},nombreExpediente:'QA documental offline',personaPerfiladora:'PPC fixture',fecha:data.generatedAt});
  const mapSpec=buildExecutiveCanonicalTerritorialMapSpec(data.geography);
  const composition=buildExecutiveVisualComposition(executive,data,{canonicalPrincipalOnly:true,principalMapSpec:mapSpec,citedVisualIds:data.visualProducts.map((x:any)=>x.visualId).concat(['photo','street-view'])});
  const model=buildExecutiveGeointReportDocumentModel(executive,composition,data,{enforceSemanticIntegrity:true});
  const assets={...baseline.assets,[SCINCE_COVER_MAP_ID]:await materializeScinceCoverMap(model.scinceCover!.map!,()=>{const canvas=createCanvas(1280,960);return {context:canvas.getContext('2d') as any,png:async()=>new Uint8Array(await canvas.encode('png'))};})};
  model.semanticIntegrity=reconcileMaterializedDocument(model,assets);
  const logos={sspe:readFileSync(resolve('tests/fixtures/p6/logo-ssp.png')),ceipol:readFileSync(resolve('tests/fixtures/p6/logo-ceipol.png'))};
  const word=renderExecutiveGeointWordDocument(model,{visualAssetsById:assets,institutionalLogos:logos});
  const docx=new Uint8Array(await Packer.toBuffer(word.document));
  const pdf=await renderInstitutionalPdfFromDocx(docx,{kind:'EXECUTIVE_REPORT',projectId:'exp',numeroExpediente:model.identity.numeroExpediente,documentModel:model,semanticIntegrity:model.semanticIntegrity,requiredVisualIds:model.semanticIntegrity!.requiredVisualIds,renderedVisualIds:word.renderAudit.renderedVisualIds,missingVisualAssetIds:word.renderAudit.missingVisualAssetIds,state:'GENERATED',certified:false,published:false});
  const xml=await (await JSZip.loadAsync(docx)).file('word/document.xml')!.async('string');
  fixtures[name]={data,executive,composition,mapSpec,model,assets,word,docx,pdf,xml};
  if(process.env.P8_COVER_QA_OUTPUT){const dir=join(process.env.P8_COVER_QA_OUTPUT,name);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'report.docx'),docx);writeFileSync(join(dir,'report.pdf'),new Uint8Array(await pdf.blob.arrayBuffer()));}
 }
},300000);
test.each(['point','line','polygon','multi'])('%s catalog → official profile → model → cover → actual DOCX/PDF',name=>{
 const f=fixtures[name];expect(f.model.scinceCover.status).toBe('READY');expect(f.pdf.parity.status).toBe('PASS');expect(f.pdf.parity.visualIds).toContain(SCINCE_COVER_MAP_ID);expect(f.model.scinceCover.indicators.length).toBeGreaterThan(0);
});
test('canonical source and analysis area remain separate and complete',()=>{for(const f of Object.values(fixtures)){expect(f.model.scinceCover.map.geography).not.toEqual(f.model.scinceCover.map.analysisArea.geometry);expect(f.model.scinceCover.map.analysisArea.containmentVerified).toBe(true);expect(f.model.scinceCover.map.cartography.viewport.allCoordinatesVisible).toBe(true);}});
test('MultiPolygon components preserved',()=>{expect(fixtures.multi.model.scinceCover.map.geography.geometry.coordinates.length).toBeGreaterThan(1);});
test('Polygon holes reach the existing renderer unchanged',async()=>{const c=await admitted('hole'),cover=buildScinceReportCover(inputFor(c));expect(cover.map!.geography.geometry.type).toBe('Polygon');expect((cover.map!.geography.geometry as any).coordinates).toHaveLength(2);const canvas=createCanvas(1280,960);await expect(materializeScinceCoverMap(cover.map!,()=>({context:canvas.getContext('2d') as any,png:async()=>new Uint8Array(await canvas.encode('png'))}))).resolves.toHaveProperty('type','png');});
test.each(['evidence','streetView','pois','denue','osint','findings','sweeps'])('cover map rejects data channel %s',channel=>{expect(fixtures.point.model.scinceCover.map).not.toHaveProperty(channel);expect(fixtures.point.model.scinceCover.map.layers).toEqual(['CANONICAL_GEOGRAPHY','SCINCE_ANALYSIS_AREA','ANALYTICAL_CENTER','GRATICULE']);});
test('executive summary at most ten indicators immediately below map',()=>{const f=fixtures.point;expect(f.model.scinceCover.indicators.length).toBeLessThanOrEqual(10);expect(f.xml.indexOf('PERFIL SOCIODEMOGRÁFICO')).toBeGreaterThan(f.xml.indexOf(SCINCE_COVER_MAP_ID));expect(f.xml.indexOf('PERFIL SOCIODEMOGRÁFICO')).toBeLessThan(f.xml.indexOf('w:type="page"'));});
test('official 2020 and reproducible derivations are visibly different',()=>{const f=fixtures.point;expect(f.xml).toContain('Valor 2020');expect(f.xml).toContain('oficial');expect(f.xml).toContain('derivado');expect(f.model.scinceCover.estimatedCurrentProfile).toBeNull();});
test('derived cover statements retain derived semantic class',()=>{expect(fixtures.point.model.semanticIntegrity.narrativeClaims.find((c:any)=>c.sectionId==='cover'&&c.text.includes('Mujeres')).state).toBe('DERIVED');});
test('selected aggregate observations preserve complete provenance',()=>{for(const i of fixtures.point.model.scinceCover.indicators){expect(i.provenance.referenceYear).toBe(2020);expect(i.provenance.releaseId).toBe(release.releaseId);expect(i.provenance.normalizationVersion).toBe(NORMALIZATION_VERSION);expect(i.provenance.sourceObservations.length).toBeGreaterThan(0);expect(i.provenance.sourceObservations[0].sourceRowKey).toBeTruthy();}});
test('expanded catalog supplies dimensions beyond the four old fields',()=>{expect(fixtures.point.model.scinceCover.indicators.map((i:any)=>i.dimension)).toContain('ECONOMIC_ACTIVITY');});
test('suppressed executive variable is omitted, never zero',async()=>{const c=await admitted('point',{PEA:'*',PDER_SS:'*'});const cover=buildScinceReportCover(inputFor(c));expect(cover.indicators.some(i=>['PEA','PDER_SS'].includes(i.variableCode))).toBe(false);expect(cover.limitations.join(' ')).toContain('Población económicamente activa');});
test('unavailable dimension creates no empty cards',async()=>{const c=await admitted('point',{PEA:'N/D'});expect(buildScinceReportCover(inputFor(c)).indicators.some(i=>i.dimension==='ECONOMIC_ACTIVITY')).toBe(false);});
test('pending PPC cannot populate a complete cover',()=>{const data=structuredClone(fixtures.point.data);data.scinceContext.snapshot.multiunit.humanReviewStatus='REQUIRES_PPC_REVIEW';expect(buildScinceReportCover(data)).toMatchObject({status:'INCOMPLETE',indicators:[],map:null});});
test('stale admission cannot populate a complete cover',()=>{const data=structuredClone(fixtures.point.data);data.scinceContext={publicationStatus:'NOT_PUBLISHABLE_STALE',territorialFreshness:'STALE',snapshot:null,reason:'changed release'};expect(buildScinceReportCover(data).status).toBe('INCOMPLETE');});
test('tampered geography, profile or radius fails closed',()=>{for(const change of [(d:any)=>d.geography.geographyId='other',(d:any)=>d.scinceContext.snapshot.multiunit.officialBaseProfile2020.rawIndicators.find((o:any)=>o.variableCode==='POBTOT').typedValue=999,(d:any)=>delete d.scinceContext.snapshot.multiunit.scinceAnalysisArea]){const d=structuredClone(fixtures.point.data);change(d);expect(buildScinceReportCover(d).status).toBe('INCOMPLETE');}});
test('without SCINCE the cover fabricates no figures',()=>{const d={...fixtures.point.data,scinceContext:undefined};expect(buildScinceReportCover(d)).toMatchObject({status:'INCOMPLETE',indicators:[],map:null});});
test('legacy point profile stays readable with explicit incomplete cover',()=>{expect(p6Fixture().document.scinceCover).toMatchObject({status:'INCOMPLETE',indicators:[]});});
test('cover map is required by semantic reservation, missing bytes block export',()=>{const m=structuredClone(fixtures.point.model),assets={...fixtures.point.assets};delete assets[SCINCE_COVER_MAP_ID];expect(()=>reconcileMaterializedDocument(m,assets)).toThrow('REQUIRED_VISUAL_NOT_RENDERED');});
test('DOCX map/profile/footer all precede first page break; map not duplicated',()=>{for(const f of Object.values(fixtures)){const cover=f.xml.split('w:type="page"')[0];expect(cover).toContain(SCINCE_COVER_MAP_ID);expect(cover).toContain('Radio total:');expect(cover).toContain('Fuente: INEGI');expect((f.xml.match(/title="scince-cover-territorial-map"/g)||[]).length).toBe(1);expect(f.xml).toContain('w:w="12240"');expect(f.xml).toContain('w:h="15840"');}});
test('PDF overflow is fail-closed, not a second contextualization page',async()=>{const f=fixtures.point,m=structuredClone(f.model);m.scinceCover.methodology=Array(120).fill('Línea metodológica extraordinariamente extensa para prueba de overflow.');const word=renderExecutiveGeointWordDocument(m,{visualAssetsById:f.assets});const bytes=new Uint8Array(await Packer.toBuffer(word.document));await expect(renderInstitutionalPdfFromDocx(bytes,{...f.pdf.trace,documentModel:m})).rejects.toThrow('SCINCE_COVER_OVERFLOW');});

test('source observations remain available in body/annex after executive selection',()=>{const f=fixtures.point;expect(f.data.scinceContext.snapshot.multiunit.officialBaseProfile2020.rawIndicators).toHaveLength(230);expect(scinceDocumentFacts(f.data.scinceContext).filter(x=>x.label.startsWith('Oficial 2020:'))).toHaveLength(222);expect(f.model.sections.find((x:any)=>x.sectionId==='territorial-situation').content.join(' ')).toContain('dimensiones acreditadas');});
test('historical model without cover contract still renders its original cover',()=>{const f=p6Fixture(),model=structuredClone(f.document);delete model.scinceCover;expect(()=>renderExecutiveGeointWordDocument(model,{visualAssetsById:f.assets})).not.toThrow();});
test('server visual authority binds actual cover bytes; tampered bytes cannot publish',async()=>{
 const f=fixtures.point,objects=new Map<string,Uint8Array>();let snapshot:any=null;
 const source:any={projectId:'exp',action:'GENERATE_REPORT',sourceFingerprint:'offline-source',actor:{institutionalUserId:'1'},project:{}};
 const deps:any={models:async()=>({projectId:'exp',institutionalReportInput:f.data,executiveModel:f.executive,visualComposition:f.composition,principalTerritorialMapSpec:f.mapSpec,documentModel:f.model}),sourceBytes:async()=>new Uint8Array(f.assets['principal-territorial-map'].data),readSnapshot:async()=>snapshot,saveSnapshot:async(s:any)=>{snapshot=s;},saveObject:async(p:string,b:Uint8Array)=>{objects.set(p,b);},readObject:async(p:string)=>objects.get(p)!,logo:async()=>new Uint8Array(readFileSync(resolve('tests/fixtures/p6/logo-ssp.png')))};
 const authority=await materializeAuthorizedVisualSnapshot(source,f.data.generatedAt,deps);
 expect(authority.visualAssetsById[SCINCE_COVER_MAP_ID].data.length).toBeGreaterThan(1024);
 const context={...authority,generatedAt:f.data.generatedAt};await expect(verifyAuthorizedVisualBytes(source,context,deps)).resolves.toHaveProperty('visualAuthority');
 context.visualAssetsById[SCINCE_COVER_MAP_ID].data=new Uint8Array([137,80]);await expect(verifyAuthorizedVisualBytes(source,context,deps)).rejects.toThrow('VISUAL_CLIENT_BYTES_DENIED');
});

test('missing provenance produces explicit incomplete cover',()=>{const d=structuredClone(fixtures.point.data);delete d.scinceContext.snapshot.multiunit.officialBaseProfile2020.provenance;expect(buildScinceReportCover(d)).toMatchObject({status:'INCOMPLETE',map:null,indicators:[]});});
test('cover release is compact while complete identity stays in provenance',()=>{const d=structuredClone(fixtures.point.data);d.scinceContext.snapshot.multiunit.officialBaseProfile2020.releaseId='scince-'+ 'a'.repeat(64);const c=buildScinceReportCover(d);expect(c.status).toBe('READY');expect(c.methodology.join(' ')).not.toContain('a'.repeat(64));expect(c.indicators[0].provenance.releaseId).toBe('scince-'+ 'a'.repeat(64));});

test('actual PDF preserves nonuniform DOCX cover column percentages',async()=>{
 const f=fixtures.point;expect(f.xml).toContain('w:w="30%"');
 const script=['import io,sys,json','from pypdf import PdfReader','p=PdfReader(io.BytesIO(sys.stdin.buffer.read())).pages[0]','out=[]; x=0','for args,op in p.get_contents().operations:'," if op==b\"BT\": x=0"," elif op==b\"Td\": x+=float(args[0])"," elif op==b\"Tm\": x=float(args[4])"," elif op==b\"Tj\" and str(args[0]) in [\"Indicador\",\"Valor 2020\"]: out.append([str(args[0]),x])",'print(json.dumps(out))'].join('\n');
 const values=JSON.parse(execFileSync(process.env.SCINCE_QA_PYTHON||join(process.env.USERPROFILE!,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),['-c',script],{input:new Uint8Array(await f.pdf.blob.arrayBuffer()),encoding:'utf8',timeout:15000}));
 const indicator=Math.min(...values.filter((v:any)=>v[0]==='Indicador').map((v:any)=>v[1]));
 const value=Math.min(...values.filter((v:any)=>v[0]==='Valor 2020').map((v:any)=>v[1]));
 expect(value-indicator).toBeCloseTo((612-1417/20-1134/20)*0.3,1);
});

import {materializeScinceContext,projectMaterializedScinceDocument} from '../src/services/scinceContextMaterializationService';
import {buildExecutiveGeointTechnicalAnnexModel} from '../src/utils/executiveGeointTechnicalAnnexModel';
import {renderExecutiveGeointTechnicalAnnexWordDocument} from '../src/utils/executiveGeointTechnicalAnnexWordRenderer';
import {scinceDocumentSummary,scinceDocumentLimitations} from '../src/utils/scinceDocumentContext';
import {prepareInstitutionalGenerationIntent} from '../src/utils/institutionalGenerationModels';
import {rebuildAuthorizedInstitutionalPackage} from '../src/services/institutionalReportPackageService';
import {canonicalSemanticValue} from '../src/utils/institutionalDocumentSemanticIntegrity';
import {resolveScinceCanonicalContext} from '../src/services/scinceCanonicalContextService';
import {createScinceHumanContextFlow} from '../src/utils/scinceHumanContextFlow';
import {getInstitutionalAdminDb} from '../src/lib/firebaseAdmin';

test.each(['point','line','polygon','multi'])('V2.6 %s complete offline PPC read-back REPORT and four artifacts',async name=>{
 const db=offline(name),geo=canonical(name),keys=['SCINCE_DEFAULT_RADIUS_M','SCINCE_LINE_CONTEXT_EXPANSION_M','SCINCE_POLYGON_CONTEXT_EXPANSION_M','SCINCE_RADIUS_GOVERNANCE_REFERENCE'];
 const previous=keys.map(k=>process.env[k]);keys.forEach((k,i)=>process.env[k]=['300','200','400','SYNTHETIC_QA_ONLY'][i]);
 try {
 const access=(action:any):any=>({allowed:true,projectId:'exp',action,project:{canonicalGeography:geo},actor:{institutionalUserId:'1',username:'PPC',role:'USER'},authorizationBasis:'EXPLICIT_ACTIVE_ACTION_GRANT',policyVersion:'EXPLICIT_ACTION_GRANT_V1',audit:{projectId:'exp',action,institutionalUserId:'1',outcome:'ALLOW',authorizationBasis:'EXPLICIT_ACTIVE_ACTION_GRANT',policyVersion:'EXPLICIT_ACTION_GRANT_V1'}});
 jest.mocked(authorizeInstitutionalProjectAccess).mockImplementation(async input=>access(input.action));
 const reviewed=await resolveScinceCanonicalContext({projectId:'exp'},'offline',{authorize:async()=>access('ANALYZE_SCINCE'),resolveMultiunit:async()=>resolveInegiMultiunit('exp',geo,db.source,config)});
 if(!reviewed.success||!reviewed.compactSnapshot)throw new Error('QUERY_REQUIRED');
 jest.mocked(getCanonicalScinceData).mockResolvedValue(reviewed);
 jest.mocked(getPool).mockReturnValue({connect:async()=>({query:db.query,release:jest.fn()})} as any);
 let project:any={id:'exp',canonicalGeography:geo,iaAnalysis:{unrelated:'KEEP'}};
 const ref={id:'exp'},pending:any[]=[];
 const tx={get:jest.fn(async()=>({exists:true,data:()=>structuredClone(project)})),update:jest.fn((_ref:any,patch:any)=>pending.push(patch))};
 const runTransaction=jest.fn(async(worker:any)=>{pending.length=0;await worker(tx);pending.forEach(p=>project={...project,...p});});
 jest.mocked(getInstitutionalAdminDb).mockReturnValue({collection:()=>({doc:()=>ref}),runTransaction} as any);
 const clientWrites=jest.fn(async()=>{});
 const flow=createScinceHumanContextFlow({context:()=>({projectId:'exp',readOnly:false,canQuery:true,analysis:{},territoryRevision:'FIXTURE'}),query:async()=>reviewed,prepare:prepareScinceContextIncorporation,updateProjectDetails:clientWrites,setAnalysisResult:jest.fn(),changed:jest.fn()});
 await flow.consult();expect(runTransaction).not.toHaveBeenCalled();
 await flow.incorporate();expect(flow.getState().status).toBe('INCORPORADO');expect(runTransaction).toHaveBeenCalledTimes(1);expect(clientWrites).not.toHaveBeenCalled();
 const saved=structuredClone(project.iaAnalysis.scinceCanonicalSnapshot);
 expect(saved.schemaVersion).toBe('SCINCE_COMPACT_SNAPSHOT_V2');expect(saved.officialBaseProfile2020).toEqual(reviewed.compactSnapshot.officialBaseProfile2020);
 const repo=createScinceMaterializationRepository({query:db.query});
 const ui=await materializeScinceContext(saved,'UI',access('ANALYZE_SCINCE'),repo);expect(ui.materialization).toBe('PASS');
 const dependencies={authorize:async()=>access('GENERATE_REPORT'),readProject:async()=>project,readRelease:async()=>release,materialize:(s:any,p:any,a:any)=>materializeScinceContext(s,p,a,repo)};
 const context=await resolveScinceDocumentPublication({projectId:'exp',sessionToken:'offline',reportGeography:geo},dependencies);
 expect(context.publicationStatus).toBe('PUBLISHABLE');if(context.publicationStatus!=='PUBLISHABLE')throw new Error(context.reason);
 const client=await resolveScinceDocumentPublication({projectId:'exp',sessionToken:'offline',reportGeography:geo,transportOnly:true},dependencies);
 expect(client.snapshot).toBeNull();expect(JSON.stringify(client)).not.toMatch(/rawIndicators|rawValues|normalizedValues/);
 const baseline=fixtures[name],data={...baseline.data,scinceContext:context};project.numeroExpediente=baseline.executive.identity.numeroExpediente;
 const executive=buildExecutiveGeointReportModel(data,{documentIdentity:baseline.executive.identity,nombreExpediente:'QA documental offline',personaPerfiladora:'PPC fixture',fecha:data.generatedAt});
 const document=buildExecutiveGeointReportDocumentModel(executive,baseline.composition,data,{enforceSemanticIntegrity:true});
 const result=await rebuildAuthorizedInstitutionalPackage({projectId:'exp',action:'GENERATE_REPORT',sourceFingerprint:'sha256:'+'d'.repeat(64),actor:{uid:'user:1',displayName:'PPC'},project},
 {models:async()=>({institutionalReportInput:data,generatedAt:data.generatedAt,projectId:'exp',numeroExpediente:document.identity.numeroExpediente,executiveModel:executive,visualComposition:baseline.composition,documentModel:document,principalTerritorialMapSpec:baseline.mapSpec}),visuals:async()=>({visualAssetsById:baseline.assets,institutionalLogos:{}}),now:()=>data.generatedAt});
 expect(result.pdfArtifacts.parity.status).toBe('PASS');
 const dir=resolve('tmp/P8-V26-CERT',name);mkdirSync(dir,{recursive:true});
 for(const [file,blob] of [['report.docx',result.reportBlob],['annex.docx',result.annexBlob],['report.pdf',result.pdfArtifacts.executive],['annex.pdf',result.pdfArtifacts.annex]] as const){expect(blob.size).toBeGreaterThan(0);writeFileSync(join(dir,file),new Uint8Array(await blob.arrayBuffer()));}
 const metrics={compactBytes:Buffer.byteLength(JSON.stringify(saved)),reviewBytes:Buffer.byteLength(JSON.stringify(reviewed.reviewView)),queryBytes:Buffer.byteLength(JSON.stringify(reviewed)),clientDocumentBytes:Buffer.byteLength(JSON.stringify(client))};
 expect(metrics.compactBytes).toBeLessThan(800000);expect(metrics.queryBytes).toBeLessThan(800000);expect(metrics.clientDocumentBytes).toBeLessThanOrEqual(250000);
 writeFileSync(join(dir,'metrics.json'),JSON.stringify(metrics,null,2));
 expect(project.iaAnalysis.scinceCanonicalSnapshot).toEqual(saved);expect(context.snapshot.multiunit!.officialBaseProfile2020!.admissibleAggregates).toHaveLength(222);
 }finally{keys.forEach((k,i)=>{if(previous[i]===undefined)delete process.env[k];else process.env[k]=previous[i];});}
},120000);

test.each(['point','line','polygon','multi'])('V2.5 %s Compact REPORT equals historical body, cover and annex',async name=>{
  const db=offline(name),result=await resolveInegiMultiunit('exp',canonical(name),db.source,config);
  if(!result.success || result.observation.schemaVersion!=='SCINCE_COMPACT_SNAPSHOT_V2')throw new Error('COMPACT_REQUIRED');
  const s=result.observation;s.ppcReview={status:'INCORPORATED',decision:'INCORPORATED',institutionalUserId:'1',incorporatedAt:'2026-01-04T00:00:00Z',reviewedContentFingerprint:s.audit.contentFingerprint};
  const access:any={allowed:true,projectId:'exp',action:'GENERATE_REPORT',project:{canonicalGeography:s.geographyBinding.geometry},actor:{institutionalUserId:'1',username:'PPC',role:'USER'},
    authorizationBasis:'EXPLICIT_ACTIVE_ACTION_GRANT',policyVersion:'EXPLICIT_ACTION_GRANT_V1',audit:{projectId:'exp',action:'GENERATE_REPORT',institutionalUserId:'1',outcome:'ALLOW',authorizationBasis:'EXPLICIT_ACTIVE_ACTION_GRANT',policyVersion:'EXPLICIT_ACTION_GRANT_V1'}};
  const m=await materializeScinceContext(s,'REPORT',access,createScinceMaterializationRepository({query:db.query}));
  expect(m.materialization).toBe('PASS');if(m.materialization!=='PASS')throw new Error(m.code);
  const context:any={publicationStatus:'PUBLISHABLE',territorialFreshness:'CURRENT',reason:null,snapshot:projectMaterializedScinceDocument(s,m.context)};
  const baseline=fixtures[name];
  // Acquisition time differs between reads; compare both projections at the same fixture acquisition.
  context.snapshot.multiunit!.queryTimestamp=baseline.data.scinceContext.snapshot.multiunit.queryTimestamp;
  const data={...baseline.data,scinceContext:context};
  expect(context.snapshot.multiunit.geographyBinding).toEqual(baseline.data.scinceContext.snapshot.multiunit.geographyBinding);
  for(const key of Object.keys(baseline.data.scinceContext.snapshot.multiunit))expect({key,equal:canonicalSemanticValue(context.snapshot.multiunit[key])===canonicalSemanticValue(baseline.data.scinceContext.snapshot.multiunit[key])}).toEqual({key,equal:true});
  expect(scinceDocumentFacts(context)).toEqual(scinceDocumentFacts(baseline.data.scinceContext));
  expect(scinceDocumentSummary(context)).toEqual(scinceDocumentSummary(baseline.data.scinceContext));
  expect(scinceDocumentLimitations(context)).toEqual(scinceDocumentLimitations(baseline.data.scinceContext));
  expect(buildScinceReportCover(data)).toEqual(baseline.model.scinceCover);
  const executive=buildExecutiveGeointReportModel(data,{documentIdentity:baseline.executive.identity,nombreExpediente:'QA documental offline',personaPerfiladora:'PPC fixture',fecha:data.generatedAt});
  const document=buildExecutiveGeointReportDocumentModel(executive,baseline.composition,data,{enforceSemanticIntegrity:true});
  expect(document.sections).toEqual(baseline.model.sections);
  document.semanticIntegrity=reconcileMaterializedDocument(document,baseline.assets);
  const annex=buildExecutiveGeointTechnicalAnnexModel(data,executive,baseline.composition,document);
  const historicalAnnex=buildExecutiveGeointTechnicalAnnexModel(baseline.data,executive,baseline.composition,document);
  expect(annex).toEqual(historicalAnnex);
  expect(()=>JSON.stringify(m.context)).toThrow('SCINCE_MATERIALIZED_CONTEXT_SERVER_ONLY');
  expect(s.schemaVersion).toBe('SCINCE_COMPACT_SNAPSHOT_V2');expect(Buffer.byteLength(JSON.stringify(s))).toBeLessThan(800000);
  if(name==='polygon') {
    const word=renderExecutiveGeointWordDocument(document,{visualAssetsById:baseline.assets}),docx=new Uint8Array(await Packer.toBuffer(word.document));
    const annexWord=renderExecutiveGeointTechnicalAnnexWordDocument(annex,{visualAssetsById:baseline.assets});
    const annexBytes=new Uint8Array(await Packer.toBuffer(annexWord.document));
    expect(docx.byteLength).toBeGreaterThan(0);expect(annexBytes.byteLength).toBeGreaterThan(0);
    const xml=await (await JSZip.loadAsync(annexBytes)).file('word/document.xml')!.async('string');
    for(const value of ['INEGI','2020',s.datasetIdentity.datasetId,s.releaseIdentity.releaseId,s.catalogIdentity.catalogVersion])expect(xml).toContain(value);
    expect(annex.sections.find(v=>v.sectionId==='scince')!.content).toEqual(scinceDocumentLimitations(context));
    const dir=resolve('tmp/P8-V25-CERT');mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'P8-Compact-Report.docx'),docx);writeFileSync(join(dir,'P8-Compact-Annex.docx'),annexBytes);
    const pdf=await renderInstitutionalPdfFromDocx(docx,{kind:'EXECUTIVE_REPORT',projectId:'exp',numeroExpediente:document.identity.numeroExpediente,documentModel:document,
      semanticIntegrity:document.semanticIntegrity,requiredVisualIds:document.semanticIntegrity!.requiredVisualIds,renderedVisualIds:word.renderAudit.renderedVisualIds,
      missingVisualAssetIds:word.renderAudit.missingVisualAssetIds,state:'GENERATED',certified:false,published:false});
    expect(pdf.parity.status).toBe('PASS');writeFileSync(join(dir,'P8-Compact-Report.pdf'),new Uint8Array(await pdf.blob.arrayBuffer()));
    const serverModels={institutionalReportInput:data,generatedAt:data.generatedAt,projectId:'exp',numeroExpediente:document.identity.numeroExpediente,
      executiveModel:executive,visualComposition:baseline.composition,documentModel:document,principalTerritorialMapSpec:baseline.mapSpec};
    const authoritative=await rebuildAuthorizedInstitutionalPackage({projectId:'exp',action:'GENERATE_REPORT',sourceFingerprint:'sha256:'+'d'.repeat(64),
      actor:{uid:'user:1',displayName:'PPC'},project:{numeroExpediente:document.identity.numeroExpediente,iaAnalysis:{scinceCanonicalSnapshot:s}}},
      {models:async()=>({...serverModels,institutionalReportInput:{...data,scinceContext:{...context,compactVerification:{...m.context.verification,ppcReview:s.ppcReview}}}}),
        visuals:async()=>({visualAssetsById:baseline.assets,institutionalLogos:{}}),now:()=>data.generatedAt});
    expect(authoritative.reportBlob.size).toBeGreaterThan(0);expect(authoritative.annexBlob.size).toBeGreaterThan(0);
    expect(authoritative.pdfArtifacts.parity.status).toBe('PASS');
    writeFileSync(join(dir,'P8-Compact-Annex.pdf'),new Uint8Array(await authoritative.pdfArtifacts.annex.arrayBuffer()));
    expect(authoritative.generationContext.institutionalReportInput.scinceContext.snapshot.multiunit.officialBaseProfile2020.admissibleAggregates).toHaveLength(222);
  }
},120000);
test('V2.5 browser generation intent transports only identity and requested format',()=>{
  const intent=prepareInstitutionalGenerationIntent('exp','ALL');expect(Object.keys(intent).sort()).toEqual(['contract','format','projectId']);
  const json=JSON.stringify({operation:'GENERATE',input:intent});console.info('V25_CLIENT_REQUEST_BYTES='+Buffer.byteLength(json));
  expect(json).not.toMatch(/generationContext|rawIndicators|rawScinceIndicators|sourceRows|observations/);
});
