import 'server-only';
import {getPool} from './db';
import {catalog,catalogFingerprint,NORMALIZATION_VERSION,parseTypedValue,fingerprint} from './scinceCatalogCore.cjs';
import type {ScinceNormalizationRelease,ScinceTypedObservation} from '../types/scinceCatalog';
import type {ScinceCoverageSourceRow} from '../types/scinceCanonicalCoverage';

type Reader={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
export const SCINCE_RELEASE_SQL=`SELECT r.release_id,r.dataset_id,r.catalog_version,r.normalization_version,r.observation_set_fingerprint,
 c.catalog_fingerprint,c.catalog FROM public.inegi_scince_normalization_release r
 JOIN public.inegi_scince_catalog c ON c.catalog_version=r.catalog_version
 WHERE r.dataset_id=$1 AND r.status='READY' ORDER BY r.created_at DESC,r.release_id DESC LIMIT 1`;
export const SCINCE_OBSERVATIONS_SQL=`SELECT geographic_level,source_row_key,observations,raw_source FROM public.inegi_scince_observation_set
 WHERE release_id=$1 AND (geographic_level,source_row_key) IN
 (SELECT level,key FROM jsonb_to_recordset($2::jsonb) AS x(level text,key text)) ORDER BY geographic_level,source_row_key LIMIT 101`;
export async function readScinceRelease(client:Reader,datasetId:string,requireSupported=true):Promise<ScinceNormalizationRelease|null> {
  const row=(await client.query(SCINCE_RELEASE_SQL,[datasetId])).rows[0];
  if(!row)return null;
  // Local interpretation is version pinned. Unknown releases never get interpreted using an older parser.
  if(row.dataset_id!==datasetId || requireSupported && (row.catalog_version!==catalog.catalogVersion || row.normalization_version!==NORMALIZATION_VERSION ||
    row.catalog_fingerprint!==catalogFingerprint || fingerprint(row.catalog)!==catalogFingerprint) ||
    typeof row.catalog_version!=='string' || !row.catalog_version || typeof row.normalization_version!=='string' || !row.normalization_version || !/^[0-9a-f]{64}$/.test(row.catalog_fingerprint) ||
    typeof row.release_id!=='string' || !row.release_id || !/^[0-9a-f]{64}$/.test(row.observation_set_fingerprint)) throw new Error('SCINCE_UNSUPPORTED_NORMALIZATION_RELEASE');
  return {releaseId:row.release_id,datasetId,catalogVersion:row.catalog_version,normalizationVersion:row.normalization_version,
    observationSetFingerprint:row.observation_set_fingerprint,catalogFingerprint:row.catalog_fingerprint};
}
export async function readScinceObservations(client:Reader,release:ScinceNormalizationRelease,sourceRows:import('../types/scinceMultiunit').ScinceMultiunitObservation['sourceRows']):Promise<ScinceTypedObservation[]> {
  const expected=sourceRows.filter(r=>r.usage!=='ENUMERATION_ONLY');const all:ScinceTypedObservation[]=[];
  for(let offset=0;offset<expected.length;offset+=100) {
    const batch=expected.slice(offset,offset+100);
    const rows=(await client.query(SCINCE_OBSERVATIONS_SQL,[release.releaseId,JSON.stringify(batch.map(r=>({level:r.demographicGeographicLevel,key:r.sourceRowKey})))])).rows;
    if(rows.length!==batch.length)throw new Error('SCINCE_INCOMPLETE_OBSERVATION_SET');
    const seen=new Set<string>();
    for(const row of rows) {
      const id=JSON.stringify([row.geographic_level,row.source_row_key]);
      const source=batch.find(s=>s.demographicGeographicLevel===row.geographic_level&&s.sourceRowKey===row.source_row_key);
      if(!source||seen.has(id)||!Array.isArray(row.observations)||row.observations.length!==catalog.variables.length)throw new Error('SCINCE_INVALID_OBSERVATION_SET');
      seen.add(id);
      const codes=new Set<string>();
      for(const observation of row.observations) {
        const variable=catalog.variables.find(v=>v.variableCode===observation.variableCode);
        if(!variable||codes.has(variable.variableCode)||observation.geographicLevel!==row.geographic_level||observation.sourceRowKey!==row.source_row_key)throw new Error('SCINCE_INVALID_OBSERVATION');
        const parsed=parseTypedValue(row.raw_source?.[variable.variableCode],variable,row.geographic_level);
        if(['rawValue','typedValue','valueStatus','nullReason'].some(k=>(parsed as any)[k]!==observation[k]))throw new Error('SCINCE_TYPED_RAW_MISMATCH');
        codes.add(variable.variableCode);all.push({...observation,sourceReference:source.observationId});
      }
    }
  }
  return all.sort((a,b)=>`${a.sourceReference}:${a.variableCode}`.localeCompare(`${b.sourceReference}:${b.variableCode}`));
}
/** Caller authorizes project access first. Ordinary DB pool performs SELECT only. */
export async function getCurrentScinceRelease(datasetId:string,requireSupported=true):Promise<ScinceNormalizationRelease|null> {
  const client=await getPool().connect();
  try {await client.query('BEGIN READ ONLY');await client.query("SET LOCAL statement_timeout='8000ms'");
    const release=await readScinceRelease(client,datasetId,false);await client.query('COMMIT');return release;
  } catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
