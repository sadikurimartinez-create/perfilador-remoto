import 'server-only';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import { buildCrimeIncidenceInstitutionalChartSvg, CRIME_INCIDENCE_CHART_ASSET_VERSION } from '@/utils/crimeIncidenceInstitutionalChartMaterializer';
import type { CrimeIncidenceInstitutionalChartSpecification } from '@/utils/crimeIncidenceInstitutionalVisualProducer';
export async function renderInstitutionalChartOnServer(specification: CrimeIncidenceInstitutionalChartSpecification) {
 const document = new DOMImplementation().createDocument(null,'container',null);
 const dom = { createElementNS: (ns: string,tag: string) => { const element: any = document.createElementNS(ns,tag); element.style = {}; return element; } };
 const svg = buildCrimeIncidenceInstitutionalChartSvg(specification,dom as any);
 const image = await loadImage(Buffer.from(new XMLSerializer().serializeToString(svg as any)));
 const canvas = createCanvas(2400,1400); const ctx = canvas.getContext('2d'); ctx.scale(2,2);ctx.drawImage(image,0,0,1200,700);
 const bytes = await canvas.encode('png');
 return { assetVersion: CRIME_INCIDENCE_CHART_ASSET_VERSION as "1.0",visualId: specification.metadata.visualId,kind:specification.kind,visualType:'CHART' as const,mimeType:'image/png' as const,width:1200,height:700,
   dataUrl:'data:image/png;base64,'+bytes.toString('base64'),title:specification.title,caption:specification.kind === 'INCIDENT_TYPE_DISTRIBUTION' ? 'Distribución descriptiva de los registros admitidos por tipo de incidencia.' : 'Evolución temporal descriptiva de los registros admitidos por fecha de ocurrencia.', metadata:specification.metadata };
}
export function assertAuthorizedRasterBytes(bytes:Uint8Array) {
 const png=bytes.length>8 && [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value);
 const jpeg=bytes.length>3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
 if(!png && !jpeg)throw new Error('VISUAL_RASTER_SIGNATURE_INVALID');
}
export async function normalizeAuthorizedVisualBytes(bytes: Uint8Array, width: number, height: number) {
 assertAuthorizedRasterBytes(bytes);
 const image = await loadImage(Buffer.from(bytes));
 if (!image.width || !image.height || image.width*image.height > 40_000_000) throw new Error('VISUAL_DIMENSIONS_INVALID');
 const scale=Math.min(width/image.width,height/image.height,1);const w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale));
 const canvas=createCanvas(w,h);canvas.getContext('2d').drawImage(image,0,0,w,h);
 return { data:new Uint8Array(await canvas.encode('png')),width:w,height:h,type:'png' as const };
}
