"use server";
import { cookies } from 'next/headers';
import { executeInstitutionalImfo } from '@/services/institutionalImfoBoundary';
export interface ImfoSource {
  id: string;
  name: string;
  platform: string; // "Telegram" | "X" | "Reddit" | "Facebook" | "Instagram" | "YouTube" | "RSS" | "Google Drive"
  type: string; // "Bot" | "Canal" | "Grupo" | "Cuenta" | "Hashtag" | "Carpeta" | "Feed RSS" | "API"
  coverage: string; // "Local" | "Regional" | "Nacional"
  state: string; // e.g. "Aguascalientes"
  municipality: string;
  neighborhood: string;
  zone: string;
  category: string; // "Seguridad" | "General" | "Prensa" | "Narcotráfico" | "Accidentes"
  trustworthiness: "Alta" | "Media" | "Baja";
  priority: number; // 1-5
  updateFrequency: string; // "Streaming" | "Diario" | "Semanal"
  discoveryDate: string;
  lastValidationDate: string;
  operationalStatus: "Activa" | "Suspendida" | "Pendiente Autorización";
  observations: string;
  utilityIndex?: number; // 0-100 (Motor de Aprendizaje)
  useCount?: number;
  avgResponseTimeMs?: number;
  precisionScore?: number; // 0-100
}

export interface LearningLog {
  id?: string;
  sourceId: string;
  sourceName: string;
  timestamp: string;
  responseTimeMs: number;
  success: boolean;
  resultCount: number;
  feedback?: "Util" | "No Util" | "Neutro";
}


const session=()=>cookies().get('ceipol_session')?.value;
export const getAuthorizedSources=async():Promise<ImfoSource[]> => ((await executeInstitutionalImfo(session(),'READ')) as ImfoSource[]).filter((source:any)=>['Activa','Suspendida'].includes(source.operationalStatus));
export const getDiscoveredSources=async():Promise<ImfoSource[]> => ((await executeInstitutionalImfo(session(),'READ')) as ImfoSource[]).filter((source:any)=>source.operationalStatus==='Pendiente Autorización');
export const updateSource=async(source:ImfoSource):Promise<void> => {await executeInstitutionalImfo(session(),'UPDATE',{id:source.id,data:source});};
export const authorizeSource=async(id:string):Promise<void> => {await executeInstitutionalImfo(session(),'AUTHORIZE',{id});};
export const deleteSource=async(id:string):Promise<void> => {await executeInstitutionalImfo(session(),'DELETE',{id});};
export const logLearningAction=async(sourceId:string,_sourceName:string,responseTimeMs:number,success:boolean,resultCount:number,feedback?:'Util'|'No Util'|'Neutro'):Promise<void> => {await executeInstitutionalImfo(session(),'LEARNING',{id:sourceId,responseTimeMs,success,resultCount,feedback:feedback||'Neutro'});};
export const autoDiscoverSource=async(name:string,platform:string,type:string,url:string,neighborhood?:string,category?:string):Promise<void> => {
 const id=`auto_${platform.toLowerCase()}_${name.toLowerCase().replace(/[^a-z0-9]/g,'_')}`;
 await executeInstitutionalImfo(session(),'DISCOVER',{id,data:{id,name,platform,type,coverage:'Local',state:'Aguascalientes',municipality:'Aguascalientes',neighborhood:neighborhood||'Sin catalogar',zone:'Sin catalogar',category:category||'General',trustworthiness:'Media',priority:3,updateFrequency:'Diario',discoveryDate:new Date().toISOString().slice(0,10),lastValidationDate:new Date().toISOString().slice(0,10),operationalStatus:'Pendiente Autorización',observations:`Fuente descubierta automáticamente por el orquestador CIFA. Dirección de acceso: ${url}`}});
};
