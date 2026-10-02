jest.mock('server-only',()=>({}),{virtual:true});
jest.mock('@/lib/firebaseAdmin',()=>({getInstitutionalAdminDb:()=>{throw new Error('REAL_ADAPTER_FORBIDDEN');},getInstitutionalAdminBucket:()=>{throw new Error('REAL_ADAPTER_FORBIDDEN');}}));
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { verifyAuthorizedVisualBytes, materializeAuthorizedVisualSnapshot, VISUAL_AUTHORITY_VERSION } from '../src/services/institutionalVisualAuthorityService';
import { normalizeAuthorizedVisualBytes } from '../src/services/institutionalNodeVisualRenderer';
import { createCanvas } from '@napi-rs/canvas';
import { p6Fixture } from './p6InstitutionalFixture';
const sha=(bytes:Uint8Array)=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const bytes=new Uint8Array(readFileSync(resolve('tests/fixtures/p6/field.png')));const snapshotId='a'.repeat(64);const generatedAt='2026-10-02T00:00:00.000Z';
 const source:any={projectId:'A',sourceFingerprint:'source-A',action:'GENERATE_REPORT',actor:{uid:'1',displayName:'fixture'},project:{}};
 const path=`projects/A/reports/visual-authority/${snapshotId}/asset.png`;
 const snapshot:any={projectId:'A',sourceFingerprint:source.sourceFingerprint,generatedAt,snapshotId,version:VISUAL_AUTHORITY_VERSION,
 assets:{map:{storagePath:path,sha256:sha(bytes),width:10,height:10,type:'png',sourceReferenceFingerprint:'server',state:'ASSET_RENDERED'}},
 logos:{sspe:{storagePath:path,sha256:sha(bytes)},ceipol:{storagePath:path,sha256:sha(bytes)}}};
 const context:any={generatedAt,visualAuthority:structuredClone(snapshot),visualAssetsById:{map:{data:bytes,width:10,height:10,type:'png'}},institutionalLogos:{sspe:bytes,ceipol:bytes}};
 const deps={readSnapshot:jest.fn(async()=>snapshot),readObject:jest.fn(async()=>bytes)};return{source,snapshot,context,deps,bytes};
}
test('server stored proof and actual bytes are authoritative',async()=>{const f=fixture();const result=await verifyAuthorizedVisualBytes(f.source,f.context,f.deps);expect(result.visualAssetsById.map.data).toEqual(f.bytes);expect(f.deps.readObject).toHaveBeenCalledTimes(3);});
test('client proof is required',async()=>{const f=fixture();delete f.context.visualAuthority;await expect(verifyAuthorizedVisualBytes(f.source,f.context,f.deps)).rejects.toThrow('PROOF_REQUIRED');});
test('client fabricated hash and matching fabricated bytes are denied',async()=>{const f=fixture();f.context.visualAuthority.assets.map.sha256=sha(new Uint8Array([9]));f.context.visualAssetsById.map.data=new Uint8Array([9]);await expect(verifyAuthorizedVisualBytes(f.source,f.context,f.deps)).rejects.toThrow('CLIENT_PROOF_DENIED');expect(f.deps.readObject).not.toHaveBeenCalled();});
test.each(['projectId','sourceFingerprint','generatedAt'])('source mismatch %s denies',async key=>{const f=fixture();f.snapshot[key]='another';f.context.visualAuthority=structuredClone(f.snapshot);await expect(verifyAuthorizedVisualBytes(f.source,f.context,f.deps)).rejects.toThrow('SNAPSHOT_MISMATCH');});
test.each(['projects/B/reports/file.png','projects/A/photos/file.png','projects/A/../reports/file.png'])('stored path %s denies',async path=>{const f=fixture();f.snapshot.assets.map.storagePath=path;f.context.visualAuthority=structuredClone(f.snapshot);await expect(verifyAuthorizedVisualBytes(f.source,f.context,f.deps)).rejects.toThrow();});
test('Storage byte corruption denies independently of client hashes',async()=>{const f=fixture();f.deps.readObject.mockResolvedValue(new Uint8Array([9]));await expect(verifyAuthorizedVisualBytes(f.source,f.context,f.deps)).rejects.toThrow('BYTES_MISMATCH');});
test.each(['data','width','height','type'])('client modified %s denies',async key=>{const f=fixture();f.context.visualAssetsById.map[key]=key==='data'?new Uint8Array([9]):'fabricated';await expect(verifyAuthorizedVisualBytes(f.source,f.context,f.deps)).rejects.toThrow('CLIENT_BYTES_DENIED');});
test('missing or added asset denies',async()=>{const f=fixture();delete f.context.visualAssetsById.map;await expect(verifyAuthorizedVisualBytes(f.source,f.context,f.deps)).rejects.toThrow('CLIENT_ASSETS_DENIED');});
test('fabricated logo bytes deny',async()=>{const f=fixture();f.context.institutionalLogos.sspe=new Uint8Array([9]);await expect(verifyAuthorizedVisualBytes(f.source,f.context,f.deps)).rejects.toThrow('CLIENT_LOGO_DENIED');});
test('Storage failure is fail closed',async()=>{const f=fixture();f.deps.readObject.mockRejectedValue(new Error('STORAGE_FAILURE'));await expect(verifyAuthorizedVisualBytes(f.source,f.context,f.deps)).rejects.toThrow('STORAGE_FAILURE');});
test('native bitmap normalization uses real PNG bytes',async()=>{const canvas=createCanvas(32,16);canvas.getContext('2d').fillRect(0,0,32,16);const bytes=new Uint8Array(await canvas.encode('png'));const image=await normalizeAuthorizedVisualBytes(bytes,16,16);expect(image.width).toBe(16);expect(image.height).toBe(8);expect([...image.data.slice(0,8)]).toEqual([137,80,78,71,13,10,26,10]);});

test('invalid bitmap bytes cannot normalize into an invented asset',async()=>{await expect(normalizeAuthorizedVisualBytes(new Uint8Array([1,2,3]),100,100)).rejects.toThrow('RASTER_SIGNATURE_INVALID');});

function materializationFixture(){
 const f=p6Fixture();const objects=new Map<string,Uint8Array>();let snapshot:any=null;
 const source:any={projectId:'exp',project:{},actor:{uid:'user:1',displayName:'Server actor'},action:'GENERATE_REPORT',sourceFingerprint:'sha256:authorized-fixture'};
 const models=jest.fn(async()=>({projectId:'exp',institutionalReportInput:f.data,executiveModel:f.executive,visualComposition:structuredClone(f.composition),principalTerritorialMapSpec:f.mapSpec,documentModel:f.document}));
 const sourceBytes=jest.fn(async()=>new Uint8Array(f.assets['principal-territorial-map'].data));
 const saveSnapshot=jest.fn(async(value:any)=>{snapshot=structuredClone(value);});
 const deps={models,sourceBytes,readSnapshot:jest.fn(async()=>snapshot),saveSnapshot,readObject:async(path:string)=>{const bytes=objects.get(path);if(!bytes)throw new Error('MISSING_OBJECT');return bytes;},saveObject:jest.fn(async(path:string,bytes:Uint8Array)=>{objects.set(path,bytes);}),logo:async()=>new Uint8Array(readFileSync(resolve('tests/fixtures/p6/logo-ssp.png')))};
 return {f,source,deps,objects};
}
test('existing P3 visual engine and native raster backend materialize project-bound immutable snapshot',async()=>{const x=materializationFixture();const result=await materializeAuthorizedVisualSnapshot(x.source,x.f.data.generatedAt,x.deps);expect(result.visualAuthority.projectId).toBe('exp');expect(result.visualAssetsById['principal-territorial-map'].data.length).toBeGreaterThan(1024);expect(x.deps.saveSnapshot).toHaveBeenCalledTimes(1);for(const entry of Object.values(result.visualAuthority.assets))expect(entry.storagePath).toContain(`projects/exp/reports/visual-authority/${result.visualAuthority.snapshotId}/`);const before=x.deps.saveObject.mock.calls.length;await materializeAuthorizedVisualSnapshot(x.source,x.f.data.generatedAt,x.deps);expect(x.deps.saveObject.mock.calls).toHaveLength(before);});
test('unavailable required source never creates successful visual proof',async()=>{const x=materializationFixture();x.deps.sourceBytes.mockRejectedValue(new Error('SOURCE_UNAVAILABLE'));await expect(materializeAuthorizedVisualSnapshot(x.source,x.f.data.generatedAt,x.deps)).rejects.toThrow('REQUIRED_MAP_UNAVAILABLE');expect(x.deps.saveSnapshot).not.toHaveBeenCalled();});
test('partial Storage failure never commits an invented rendered snapshot',async()=>{const x=materializationFixture();x.deps.saveObject.mockRejectedValue(new Error('STORAGE_FAILED'));await expect(materializeAuthorizedVisualSnapshot(x.source,x.f.data.generatedAt,x.deps)).rejects.toThrow('STORAGE_FAILED');expect(x.deps.saveSnapshot).not.toHaveBeenCalled();});

import { renderInstitutionalChartOnServer } from '../src/services/institutionalNodeVisualRenderer';
import { buildCrimeIncidenceInstitutionalVisualSpecifications } from '../src/utils/crimeIncidenceInstitutionalVisualProducer';
test('existing chart producer renders both institutional charts as actual server PNG bytes',async()=>{
 const f=p6Fixture();const source=f.data.crimeIncidenceExportContract!;
 const result=buildCrimeIncidenceInstitutionalVisualSpecifications({metrics:source.projectionReference.metrics,sourceQuery:source.queryReference,temporalReference:source.projectionReference.temporalReference,geographicReference:source.geographicReference,datasetReference:source.datasetReference,lineage:source.lineage,limitations:source.limitations} as any);
 expect(result.charts).toHaveLength(2);
 for(const spec of result.charts){const rendered=await renderInstitutionalChartOnServer(spec);const bytes=Buffer.from(rendered.dataUrl.split(',')[1],'base64');expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);expect(bytes.length).toBeGreaterThan(1024);expect(rendered.metadata).toEqual(spec.metadata);}
});
