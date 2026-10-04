import 'server-only';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from '@/lib/firebaseAdmin';
import { normalizeAuthorizedVisualBytes, assertAuthorizedRasterBytes } from './institutionalNodeVisualRenderer';
import { enrichInstitutionalPayloadWithCrimeIncidenceVisuals } from '@/utils/crimeIncidenceInstitutionalPayloadBridge';
import { buildInstitutionalGenerationModels } from '@/utils/institutionalGenerationModels';
import { buildExecutiveGeointTechnicalAnnexModel } from '@/utils/executiveGeointTechnicalAnnexModel';
import { buildExecutiveGeointWordVisualAssets } from '@/utils/executiveGeointWordRenderer';
import { renderDenueAnalyticalMapBitmap } from '@/utils/denueAnalyticalMapImageRenderer';
import { canonicalSemanticValue } from '@/utils/institutionalDocumentSemanticIntegrity';
import type { AuthorizedInstitutionalReportSource } from './institutionalReportSourceService';
import { materializeScinceCoverMap } from '@/utils/scinceCoverMapMaterializer';
import { SCINCE_COVER_MAP_ID } from '@/utils/scinceReportCover';
export const VISUAL_AUTHORITY_VERSION = 'SERVER_VISUAL_BYTES_V1';
const hash = (bytes: Uint8Array|string) => 'sha256:'+createHash('sha256').update(bytes).digest('hex');
export interface VisualSnapshot { projectId: string; snapshotId: string; sourceFingerprint: string; generatedAt: string; version: typeof VISUAL_AUTHORITY_VERSION;
  assets: Record<string,{ storagePath:string;sha256:string;width:number;height:number;type:string;sourceReferenceFingerprint:string;state:'ASSET_RENDERED' }>;
  logos: Record<string,{storagePath:string;sha256:string}>; }
interface Dependencies {
 models(source: AuthorizedInstitutionalReportSource, generatedAt: string): Promise<any>;
 sourceBytes(reference: string, projectId: string): Promise<Uint8Array>;
 readSnapshot(projectId: string, snapshotId: string): Promise<VisualSnapshot|null>;
 saveSnapshot(snapshot: VisualSnapshot): Promise<void>;
 readObject(path: string): Promise<Uint8Array>;
 saveObject(path: string,bytes: Uint8Array,sha256:string): Promise<void>;
 logo(name: string): Promise<Uint8Array>;
}
function authorizedObjectPath(path: string,projectId: string) {
 if (!path.startsWith(`projects/${projectId}/`) || path.split('/').some(segment => !segment || segment === '.' || segment === '..' || /[\\\x00-\x1F]/.test(segment))) throw new Error('VISUAL_CROSS_PROJECT_PATH');
 return path;
}
const defaults: Dependencies = {
 async models(source,generatedAt) {
  const payload=await enrichInstitutionalPayloadWithCrimeIncidenceVisuals({ ...source.project,projectId:source.projectId,expedienteId:source.projectId,personaPerfiladora:source.actor.displayName });
  return buildInstitutionalGenerationModels(payload,source.project.nombre || 'Expediente',source.project.numeroExpediente,source.actor,generatedAt);
 },
 async sourceBytes(reference,projectId) {
  if (reference.startsWith('data:image/')) { const match=reference.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/);if(!match)throw new Error('VISUAL_SOURCE_INVALID');const bytes=Buffer.from(match[2],'base64');if(!bytes.length || bytes.length>20*1024*1024)throw new Error('VISUAL_SOURCE_LIMIT');return bytes; }
  const url=new URL(reference);
  if(url.protocol!=='https:' || url.username || url.password)throw new Error('VISUAL_SOURCE_INVALID');
  if(url.hostname==='firebasestorage.googleapis.com') {
   const match=url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);if(!match)throw new Error('VISUAL_SOURCE_INVALID');
   const bucket=getInstitutionalAdminBucket();if(decodeURIComponent(match[1])!==bucket.name)throw new Error('VISUAL_SOURCE_BUCKET_MISMATCH');
   return defaults.readObject(authorizedObjectPath(decodeURIComponent(match[2]),projectId));
  }
  if(url.hostname!=='maps.googleapis.com' || url.pathname!=='/maps/api/staticmap')throw new Error('VISUAL_UNAUTHORIZED_SOURCE');
  // This URL comes only from recomputed canonical geography/models, never request metadata.
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok || !/^image\/(png|jpeg)/.test(response.headers.get('content-type') || ''))throw new Error('VISUAL_SOURCE_UNAVAILABLE');
  const bytes=new Uint8Array(await response.arrayBuffer());if(!bytes.length || bytes.length>20*1024*1024)throw new Error('VISUAL_SOURCE_LIMIT');return bytes;
 },
 async readSnapshot(projectId,snapshotId){const snap=await getInstitutionalAdminDb().collection('projects').doc(projectId).collection('reportVisualAuthority').doc(snapshotId).get();return snap.exists?snap.data() as VisualSnapshot:null;},
 async saveSnapshot(snapshot){await getInstitutionalAdminDb().runTransaction(async tx=>{const ref=getInstitutionalAdminDb().collection('projects').doc(snapshot.projectId).collection('reportVisualAuthority').doc(snapshot.snapshotId);const old=await tx.get(ref);if(old.exists){if(canonicalSemanticValue(old.data())!==canonicalSemanticValue(snapshot))throw new Error('VISUAL_SNAPSHOT_IMMUTABLE');return;}tx.create(ref,snapshot);});},
 async readObject(path){const [bytes]=await getInstitutionalAdminBucket().file(path).download();if(bytes.length>20*1024*1024)throw new Error('VISUAL_SOURCE_LIMIT');return new Uint8Array(bytes);},
 async saveObject(path,bytes,sha256){const file=getInstitutionalAdminBucket().file(path);try{await file.save(Buffer.from(bytes),{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:'image/png',metadata:{sha256,source:'SERVER_VISUAL_AUTHORITY'}}});}catch(error:any){if(error.code!==412)throw error;const [stored]=await file.download();if(hash(stored)!==sha256)throw new Error('VISUAL_OBJECT_IMMUTABLE');}},
 async logo(name){return new Uint8Array(await readFile(join(process.cwd(),'public','logos',name==='sspe'?'logo-ssp.png':'logo-ceipol.png')));},
};
export async function materializeAuthorizedVisualSnapshot(source: AuthorizedInstitutionalReportSource,generatedAt: string,overrides: Partial<Dependencies> = {}) {
 const deps={...defaults,...overrides};
 if(source.action!=='GENERATE_REPORT' || typeof generatedAt!=='string' || !Number.isFinite(Date.parse(generatedAt)))throw new Error('VISUAL_AUTHORITY_INVALID');
 const models=await deps.models(source,generatedAt);
 if(models.projectId!==source.projectId)throw new Error('VISUAL_WRONG_PROJECT');
 const snapshotId=createHash('sha256').update(canonicalSemanticValue({projectId:source.projectId,sourceFingerprint:source.sourceFingerprint,generatedAt,version:VISUAL_AUTHORITY_VERSION,map:models.principalTerritorialMapSpec,composition:models.visualComposition,cover:models.documentModel.scinceCover})).digest('hex');
 const existing=await deps.readSnapshot(source.projectId,snapshotId);
 if(existing){return hydrateSnapshot(existing,source,generatedAt,deps);}
 const references=new Map<string,string>();
 const resolver=async(reference:string,width:number,height:number,_narrative?:string,id?:string)=>{
  if(!id)throw new Error('VISUAL_SOURCE_ID_REQUIRED');references.set(id,reference);
  return normalizeAuthorizedVisualBytes(await deps.sourceBytes(reference,source.projectId),width,height);
 };
 const unit=models.institutionalReportInput?.denueAnalyticalDocument;
 const special: Record<string,any>={};
 if(unit?.status==='READY') {
  const plan=unit.unit.imagePlan;references.set(unit.unit.visualId,canonicalSemanticValue(plan));
  special[unit.unit.visualId]=await renderDenueAnalyticalMapBitmap(plan,{loadBaseMap:async(reference:string)=>{const bytes=await deps.sourceBytes(reference,source.projectId);assertAuthorizedRasterBytes(bytes);const image=await loadImage(Buffer.from(bytes));return{source:image,width:image.width,height:image.height};},createCanvas(width:number,height:number){const canvas=createCanvas(width,height);return{context:canvas.getContext('2d') as any,toPngArrayBuffer:async()=>{const bytes=await canvas.encode('png');return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;}};}});
 }
 const assets=await buildExecutiveGeointWordVisualAssets(models.visualComposition,{principalMapSpec:models.principalTerritorialMapSpec,strictPrincipalMapAssets:true,resolvePrincipalMapImage:resolver,resolveImage:async(reference,w,h,n,id)=>special[id || ''] || resolver(reference,w,h,n,id)});
 if (models.documentModel.scinceCover?.status === 'READY') {
  const plan = models.documentModel.scinceCover.map;
  references.set(SCINCE_COVER_MAP_ID, canonicalSemanticValue(plan));
  assets[SCINCE_COVER_MAP_ID] = await materializeScinceCoverMap(plan, () => {
    const canvas = createCanvas(1280, 960);
    return { context: canvas.getContext('2d') as any, png: async () => new Uint8Array(await canvas.encode('png')) };
  });
 }
 if(models.visualComposition.principalTerritorialMap.status!=='NO_CANONICAL_GEOGRAPHY' && !assets[models.visualComposition.principalTerritorialMap.mapId])throw new Error('VISUAL_REQUIRED_MAP_UNAVAILABLE');
 const annex=buildExecutiveGeointTechnicalAnnexModel(models.institutionalReportInput,models.executiveModel,models.visualComposition,models.documentModel);
 for(const section of annex.sections.filter((section:any)=>['field-photographs','street-view'].includes(section.sectionId)))for(const record of section.records){if(record.visualReference && !assets[record.recordId])assets[record.recordId]=await resolver(record.visualReference,360,220,record.title,record.recordId);}
 const snapshot: VisualSnapshot={projectId:source.projectId,snapshotId,sourceFingerprint:source.sourceFingerprint,generatedAt,version:VISUAL_AUTHORITY_VERSION,assets:{},logos:{}};
 for(const [id,asset]of Object.entries(assets)){const bytes=asset.data instanceof Uint8Array?asset.data:new Uint8Array(asset.data);assertAuthorizedRasterBytes(bytes);const sha256=hash(bytes);const path=`projects/${source.projectId}/reports/visual-authority/${snapshotId}/${createHash('sha256').update(id).digest('hex')}.png`;await deps.saveObject(path,bytes,sha256);snapshot.assets[id]={storagePath:path,sha256,width:asset.width || 1,height:asset.height || 1,type:asset.type || 'png',sourceReferenceFingerprint:hash(references.get(id) || ''),state:'ASSET_RENDERED'};}
 for(const name of ['sspe','ceipol']){const bytes=await deps.logo(name),sha256=hash(bytes),path=`projects/${source.projectId}/reports/visual-authority/${snapshotId}/logo-${name}.png`;await deps.saveObject(path,bytes,sha256);snapshot.logos[name]={storagePath:path,sha256};}
 await deps.saveSnapshot(snapshot);return hydrateSnapshot(snapshot,source,generatedAt,deps);
}
async function hydrateSnapshot(snapshot:VisualSnapshot,source:AuthorizedInstitutionalReportSource,generatedAt:string,deps:Dependencies){
 if(snapshot.projectId!==source.projectId || snapshot.sourceFingerprint!==source.sourceFingerprint || snapshot.generatedAt!==generatedAt || snapshot.version!==VISUAL_AUTHORITY_VERSION)throw new Error('VISUAL_SNAPSHOT_MISMATCH');
 if(!/^[a-f0-9]{64}$/.test(snapshot.snapshotId) || Object.keys(snapshot.assets).length>128 || Object.keys(snapshot.logos).sort().join('|')!=='ceipol|sspe')throw new Error('VISUAL_SNAPSHOT_SCHEMA_INVALID');
 const assets:Record<string,any>={};const logos:Record<string,Uint8Array>={};let totalBytes=0;
 for(const [id,entry]of Object.entries(snapshot.assets)){const path=authorizedObjectPath(entry.storagePath,source.projectId);if(!path.startsWith(`projects/${source.projectId}/reports/visual-authority/${snapshot.snapshotId}/`))throw new Error('VISUAL_SNAPSHOT_PATH_MISMATCH');const bytes=await deps.readObject(path);if(hash(bytes)!==entry.sha256 || entry.state!=='ASSET_RENDERED')throw new Error('VISUAL_BYTES_MISMATCH');assertAuthorizedRasterBytes(bytes);totalBytes+=bytes.length;if(totalBytes>40*1024*1024)throw new Error('VISUAL_SNAPSHOT_LIMIT');assets[id]={data:bytes,width:entry.width,height:entry.height,type:entry.type};}
 for(const [name,entry]of Object.entries(snapshot.logos)){const path=authorizedObjectPath(entry.storagePath,source.projectId);if(!path.startsWith(`projects/${source.projectId}/reports/visual-authority/${snapshot.snapshotId}/`))throw new Error('VISUAL_SNAPSHOT_PATH_MISMATCH');const bytes=await deps.readObject(path);if(hash(bytes)!==entry.sha256)throw new Error('VISUAL_BYTES_MISMATCH');assertAuthorizedRasterBytes(bytes);logos[name]=bytes;}
 return {visualAuthority:snapshot,visualAssetsById:assets,institutionalLogos:logos};
}
export async function verifyAuthorizedVisualBytes(source:AuthorizedInstitutionalReportSource,context:any,overrides:Partial<Dependencies>={}) {
 const deps={...defaults,...overrides};const proof=context?.visualAuthority;
 if(!proof?.snapshotId || !/^[a-f0-9]{64}$/.test(proof.snapshotId))throw new Error('VISUAL_SERVER_PROOF_REQUIRED');
 const stored=await deps.readSnapshot(source.projectId,proof.snapshotId);if(!stored || canonicalSemanticValue(stored)!==canonicalSemanticValue(proof))throw new Error('VISUAL_CLIENT_PROOF_DENIED');
 const authoritative=await hydrateSnapshot(stored,source,context.generatedAt,deps);
 if(Object.keys(context.visualAssetsById || {}).sort().join('|')!==Object.keys(authoritative.visualAssetsById).sort().join('|'))throw new Error('VISUAL_CLIENT_ASSETS_DENIED');
 for(const [id,asset]of Object.entries(authoritative.visualAssetsById)){const supplied=context.visualAssetsById[id];const bytes=supplied?.data instanceof Uint8Array?supplied.data:supplied?.data instanceof ArrayBuffer?new Uint8Array(supplied.data):null;
  if(!bytes || hash(bytes)!==hash(asset.data) || supplied.width!==asset.width || supplied.height!==asset.height || supplied.type!==asset.type)throw new Error('VISUAL_CLIENT_BYTES_DENIED');}
 for(const [name,bytes]of Object.entries(authoritative.institutionalLogos)){const supplied=context.institutionalLogos?.[name];if(!supplied || hash(new Uint8Array(supplied))!==hash(bytes))throw new Error('VISUAL_CLIENT_LOGO_DENIED');}
 return authoritative;
}
