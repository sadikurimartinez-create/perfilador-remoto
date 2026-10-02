jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/utils/crimeIncidenceInstitutionalChartMaterializer", () => ({ materializeCrimeIncidenceInstitutionalCharts: jest.fn(async (specs: any[]) => specs.map(spec => ({
  assetVersion: "1.0", visualId: spec.metadata.visualId, kind: spec.kind, visualType: "CHART", mimeType: "image/png", width: 500, height: 280,
  dataUrl: `data:image/png;base64,${require("fs").readFileSync(require("path").resolve(`tests/fixtures/p6/${spec.kind === "INCIDENT_TYPE_DISTRIBUTION" ? "BAR" : "LINE"}.png`)).toString("base64")}`,
  title: spec.title, caption: spec.kind === "INCIDENT_TYPE_DISTRIBUTION" ? "Distribución descriptiva de los registros admitidos por tipo de incidencia." : "Evolución temporal descriptiva de los registros admitidos por fecha de ocurrencia.", metadata: spec.metadata,
}))) }));
jest.mock("@/lib/scinceDocumentActions", () => ({ getScinceDocumentContext: jest.fn() }));
jest.mock("@/services/denueAnalyticalPublicationService", () => ({ buildDenueAnalyticalPublicationProduct: jest.fn(async () => ({ status: "EMPTY", product: null, warnings: [] })) }));
jest.mock('next/server',()=>({NextResponse:{json:(body:any,init?:any)=>({status:init?.status||200,json:async()=>body})}}));
jest.mock('next/headers',()=>({cookies:()=>({get:()=>({value:'offline-session'})})}));
const mockAuthorizedSource=jest.fn();
jest.mock('@/services/institutionalReportSourceService',()=>({resolveAuthorizedInstitutionalReportSource:(...args:any[])=>mockAuthorizedSource(...args)}));
jest.mock('server-only',()=>({}),{virtual:true});
jest.mock('@/lib/institutionalReportSourceActions',()=>({getAuthorizedInstitutionalReportSource:jest.fn()}));
let mockDb:any;
const mockObjects=new Map<string,Buffer>();
jest.mock('@/lib/firebaseAdmin',()=>({getInstitutionalAdminDb:()=>mockDb,getInstitutionalAdminBucket:()=>({file:(path:string)=>({save:async(bytes:Buffer)=>{if(mockObjects.has(path)){const error:any=new Error('EXISTS');error.code=412;throw error;}mockObjects.set(path,Buffer.from(bytes));},download:async()=>[mockObjects.get(path)]})})}));
import { verifyAuthorizedVisualBytes } from "../src/services/institutionalVisualAuthorityService";
import { encodeReportBoundaryValue, decodeReportBoundaryValue } from '../src/utils/institutionalReportBoundaryTransport';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Packer } from 'docx';
import { renderExecutiveGeointWordDocument } from '../src/utils/executiveGeointWordRenderer';
import { renderExecutiveGeointTechnicalAnnexWordDocument } from '../src/utils/executiveGeointTechnicalAnnexWordRenderer';
import { renderInstitutionalPdfFromDocx, institutionalAnnexRequiredVisualIds } from '../src/utils/institutionalPdfRenderer';
import { buildInstitutionalPackageLineage } from '../src/services/institutionalReportPackageService';
import { preP7Fixture } from './helpers/preP7InstitutionalFixture';
import { POST } from '../src/app/api/institutional/reports/route';
import { adminFixture } from './helpers/p8InstitutionalAdminFixture';
import { AdminInstitutionalReportPackageRepository,AdminInstitutionalReportPackageStorage } from '../src/services/institutionalReportAdminRepository';
import { InstitutionalReportPackageService } from '../src/services/institutionalReportPackageService';
import { executeInstitutionalReportDecision } from '../src/services/institutionalReportDecisionBoundary';
let f:Awaited<ReturnType<typeof preP7Fixture>>;
beforeAll(async()=>{f=await preP7Fixture();},600000);
jest.setTimeout(180000);
function setup(){const store=adminFixture({'projects/exp':{deleted:false,estado:'ABIERTO'}});mockDb=store.db;mockObjects.clear();const repo=new AdminInstitutionalReportPackageRepository(f.context);const service=new InstitutionalReportPackageService(repo,new AdminInstitutionalReportPackageStorage(),()=>f.context.generatedAt,async()=>f.authorized);return{...store,repo,service};}
const actor={institutionalUserId:'server-human',username:'Servidor Humano',role:'USER' as const};
function decisionInput(manifest:any){return{projectId:'exp',institutionalReportInput:structuredClone(f.context.institutionalReportInput),institutionalDocumentModel:structuredClone(f.context.documentModel),documentArtifactReference:manifest.artifacts.executiveReport.storagePath,documentArtifactHash:manifest.artifacts.executiveReport.sha256,publicationChannelOrType:'INSTITUTIONAL_INTERNAL',certifierIdentity:{id:'forged',displayName:'Forged'},publisherIdentity:{id:'forged',displayName:'Forged'}};}
test('actual P2-P6 generation persists through Admin IO and stored seals bind real human gates',async()=>{const x=setup();const manifest=await x.service.persistGeneratedPackage(f.base);expect(manifest.state).toBe('GENERATED');expect(mockObjects.size).toBe(4);expect(x.get(`projects/exp/reportPackageInputs/${manifest.packageId}`).sourceFingerprint).toBe(f.authorized.sourceFingerprint);const input=decisionInput(manifest);const certified=await executeInstitutionalReportDecision('CERTIFY',input,actor,'exp');expect(certified.status).toBe('CERTIFIED');expect(certified.certifiedBy?.id).toBe('server-human');const published=await executeInstitutionalReportDecision('PUBLISH',input,actor,'exp');expect(published.status).toBe('PUBLISHED');expect(published.publishedBy?.id).toBe('server-human');expect(x.entries().filter(([path])=>path.startsWith('geoint_event_logs/')).length).toBeGreaterThanOrEqual(2);});
test('fabricated GENERATED client package cannot reach certification',async()=>{const x=setup();const before=x.entries();await expect(executeInstitutionalReportDecision('CERTIFY',{...decisionInput({artifacts:{executiveReport:{storagePath:'forged',sha256:'forged'}}}),state:'GENERATED'},actor,'exp')).rejects.toThrow('SERVER_PACKAGE_REQUIRED');expect(x.entries()).toEqual(before);});
test('fabricated CERTIFIED client state cannot publish without server certification',async()=>{const x=setup();const manifest=await x.service.persistGeneratedPackage(f.base);await expect(executeInstitutionalReportDecision('PUBLISH',{...decisionInput(manifest),certification:{status:'CERTIFIED'},state:'PUBLISHED'},actor,'exp')).rejects.toThrow();expect(x.entries().filter(([path])=>path.includes('/reportPublications/'))).toHaveLength(0);});
test('wrong project cannot certify a complete server package',async()=>{const x=setup();const manifest=await x.service.persistGeneratedPackage(f.base);await expect(executeInstitutionalReportDecision('CERTIFY',decisionInput(manifest),actor,'other')).rejects.toThrow('SERVER_PACKAGE_REQUIRED');});
test('modified sealed evidence is denied before human-state persistence',async()=>{const x=setup();const manifest=await x.service.persistGeneratedPackage(f.base);const input=decisionInput(manifest);input.institutionalReportInput.evidence[0].summary='client-fabricated';await expect(executeInstitutionalReportDecision('CERTIFY',input,actor,'exp')).rejects.toThrow('SNAPSHOT_MISMATCH');expect(x.entries().filter(([path])=>path.includes('/reportCertifications/'))).toHaveLength(0);});

test('HTTP transport, real byte verification, lineage engines and Admin IO complete one offline generation',async()=>{
 const x=setup();mockAuthorizedSource.mockResolvedValue(f.authorized);
 const snapshotId='a'.repeat(64);const prefix=`projects/exp/reports/visual-authority/${snapshotId}/`;
 const proof:any={projectId:'exp',sourceFingerprint:f.authorized.sourceFingerprint,generatedAt:f.context.generatedAt,snapshotId,version:'SERVER_VISUAL_BYTES_V1',assets:{},logos:{}};
 const sha=(bytes:Uint8Array)=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
 const context=structuredClone(f.context);
 for(const [id,asset] of Object.entries(context.visualAssetsById) as any){const bytes=new Uint8Array(asset.data);const path=prefix+createHash('sha256').update(id).digest('hex')+'.png';mockObjects.set(path,Buffer.from(bytes));proof.assets[id]={storagePath:path,sha256:sha(bytes),width:asset.width,height:asset.height,type:asset.type,sourceReferenceFingerprint:'offline-trusted-reference',state:'ASSET_RENDERED'};}
 context.institutionalLogos={sspe:new Uint8Array(readFileSync(resolve('tests/fixtures/p6/logo-ssp.png'))),ceipol:new Uint8Array(readFileSync(resolve('tests/fixtures/p6/logo-ceipol.png')))};
 for(const name of ['sspe','ceipol']){const path=prefix+`logo-${name}.png`;const bytes=context.institutionalLogos[name];mockObjects.set(path,Buffer.from(bytes));proof.logos[name]={storagePath:path,sha256:sha(bytes)};}
 context.visualAuthority=proof;x.seed(`projects/exp/reportVisualAuthority/${snapshotId}`,proof);
 const rendered=renderExecutiveGeointWordDocument(context.documentModel,{visualAssetsById:context.visualAssetsById,institutionalLogos:context.institutionalLogos});
 const annex=renderExecutiveGeointTechnicalAnnexWordDocument(context.annexModel,{visualAssetsById:context.visualAssetsById,institutionalLogos:context.institutionalLogos});
 const reportBlob=await Packer.toBlob(rendered.document),annexBlob=await Packer.toBlob(annex.document);
 const pdf=async(kind:'EXECUTIVE_REPORT'|'TECHNICAL_ANNEX',blob:Blob,rendered:any,model:any)=>renderInstitutionalPdfFromDocx(new Uint8Array(await blob.arrayBuffer()),{kind,projectId:'exp',numeroExpediente:f.base.numeroExpediente,documentModel:model,semanticIntegrity:context.documentModel.semanticIntegrity,requiredVisualIds:kind==='EXECUTIVE_REPORT'?context.documentModel.semanticIntegrity.requiredVisualIds:institutionalAnnexRequiredVisualIds(context.annexModel,context.documentModel.semanticIntegrity.requiredVisualIds),renderedVisualIds:rendered.renderAudit.renderedVisualIds,missingVisualAssetIds:rendered.renderAudit.missingVisualAssetIds,state:'GENERATED',certified:false,published:false});
 const executivePdf=await pdf('EXECUTIVE_REPORT',reportBlob,rendered,context.documentModel),annexPdf=await pdf('TECHNICAL_ANNEX',annexBlob,annex,context.annexModel);
 context.lineage=await buildInstitutionalPackageLineage(f.authorized,context);
 const encoded=await encodeReportBoundaryValue({...f.base,generationContext:context,reportBlob,annexBlob,pdfArtifacts:{executive:executivePdf.blob,annex:annexPdf.blob,parity:{status:'PASS',sourceDocxHashes:[executivePdf.parity.sourceDocxSha256,annexPdf.parity.sourceDocxSha256]}}});
 const decoded=decodeReportBoundaryValue(encoded);await verifyAuthorizedVisualBytes(f.authorized,decoded.generationContext);
 const body=JSON.stringify({operation:'GENERATE',input:encoded});expect(Buffer.byteLength(body)).toBeLessThan(64*1024*1024);
 const response=await POST(new Request('https://offline.test/api/institutional/reports',{method:'POST',headers:{origin:'https://offline.test','content-type':'application/json'},body}));expect(response.status).toBe(200);expect((await response.json()).state).toBe('GENERATED');
});
test('source revision after generation denies certification of stale sealed evidence',async()=>{const x=setup();const manifest=await x.service.persistGeneratedPackage(f.base);await expect(executeInstitutionalReportDecision('CERTIFY',decisionInput(manifest),actor,'exp','sha256:changed-source')).rejects.toThrow('SNAPSHOT_MISMATCH');});
