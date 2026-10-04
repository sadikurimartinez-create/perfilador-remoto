const {createReadStream} = require('node:fs');
const {createHash} = require('node:crypto');
const {parse} = require('csv-parse');
const {canonicalRowKey} = require('./importerCore.cjs');
const core = require('../../src/lib/scinceCatalogCore.cjs');
async function fileHash(path) {
  const hash=createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex');
}
async function* sourceRows(csvPath) {
  const parser=createReadStream(csvPath).pipe(parse({bom:true,columns:core.validateHeader,skip_empty_lines:true,relax_column_count:false}));
  for await (const row of parser) {
    if(row.ENTIDAD!=='01'||row.AGEB==='0000')continue;
    const level=row.MZA==='000'?'AGEB':'MANZANA', key=canonicalRowKey(row,level);
    yield {level,key,raw:row,observations:core.normalizeRow(row,level,key)};
  }
}
/** Administrative adapter only. No connection, environment loading, geography writes, grants or automatic invocation. */
async function partialReimport(client,{datasetId,csvPath,censusZipPath,geographySha256},dependencies={fileHash,sourceRows}) {
  const {fileHash:hashFile,sourceRows:readRows}=dependencies;
  if(await hashFile(censusZipPath)!==core.catalog.sourceZipSha256 || await hashFile(csvPath)!==core.catalog.sourceCsvSha256)
    throw new Error('SCINCE_PARTIAL_REIMPORT_SOURCE_HASH_MISMATCH');
  const hash=createHash('sha256');let count=0;const keys=new Set();
  // Deterministic source order; reject duplicate territorial keys before any mutation.
  for await(const row of readRows(csvPath)) {
    const key=JSON.stringify([row.level,row.key]);if(keys.has(key))throw new Error('SCINCE_DUPLICATE_SOURCE_KEY');
    keys.add(key);hash.update(JSON.stringify(row.observations)+'\n');count++;
  }
  if(!count)throw new Error('SCINCE_EMPTY_SOURCE');
  const observationSetFingerprint=hash.digest('hex');
  const releaseId='scince-'+core.fingerprint([datasetId,core.catalog.catalogVersion,core.catalogFingerprint,core.NORMALIZATION_VERSION,observationSetFingerprint]);
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    const role=(await client.query('SELECT current_user AS role')).rows[0]?.role;
    if(!role||role==='ceipol_app')throw new Error('SCINCE_ADMINISTRATIVE_PROCEDURE_REQUIRED');
    const d=(await client.query("SELECT * FROM public.inegi_territorial_dataset WHERE dataset_id=$1 AND status='READY' FOR UPDATE",[datasetId])).rows[0];
    if(!d||d.reference_year!==2020||d.state_code!=='01'||d.geography_sha256!==geographySha256||d.census_sha256!==core.catalog.sourceZipSha256)
      throw new Error('SCINCE_PARTIAL_REIMPORT_DATASET_INCOMPATIBLE');
    const existing=(await client.query('SELECT geographic_level,source_row_key FROM public.inegi_territorial_demographics WHERE dataset_id=$1',[datasetId])).rows;
    if(existing.length!==count||existing.some(r=>!keys.has(JSON.stringify([r.geographic_level,r.source_row_key]))))throw new Error('SCINCE_PARTIAL_REIMPORT_KEYS_INCOMPATIBLE');
    const geo=(await client.query(`SELECT d.geographic_level,d.source_row_key,d.cve_ent,d.cve_mun,d.cve_loc,d.cve_ageb,d.cve_mza FROM public.inegi_territorial_demographics d WHERE d.dataset_id=$1 AND NOT EXISTS (
      SELECT 1 FROM public.inegi_territorial_geography g WHERE g.dataset_id=d.dataset_id AND g.geographic_level=d.geographic_level
      AND g.cve_ent=d.cve_ent AND g.cve_mun=d.cve_mun AND g.cve_loc=d.cve_loc AND g.cve_ageb=d.cve_ageb AND g.cve_mza IS NOT DISTINCT FROM d.cve_mza) ORDER BY d.geographic_level,d.source_row_key`,[datasetId])).rows;
    const nonSpatialUnits=geo.map(row=>{
      const parts=[row.cve_ent,row.cve_mun,row.cve_loc,row.cve_ageb];
      const recognized=row.geographic_level==='MANZANA' && row.cve_mza==='800'
        ? 'MANZANA_800_WITHOUT_GEOMETRY'
        : row.geographic_level==='AGEB' && parts.join(':')==='01:001:2050:1903' && row.cve_mza==null
          ? 'ACCREDITED_AGEB_WITHOUT_GEOMETRY' : null;
      if(row.geographic_level==='MANZANA')parts.push(row.cve_mza);
      if(!recognized || row.cve_ent!=='01' || parts.join(':')!==row.source_row_key || !keys.has(JSON.stringify([row.geographic_level,row.source_row_key])))
        throw new Error('SCINCE_PARTIAL_REIMPORT_GEOGRAPHY_KEYS_INCOMPATIBLE');
      return {geographicLevel:row.geographic_level,sourceRowKey:row.source_row_key,spatiallyEligible:false,reason:recognized};
    });
    if(new Set(nonSpatialUnits.map(r=>JSON.stringify([r.geographicLevel,r.sourceRowKey]))).size!==nonSpatialUnits.length)
      throw new Error('SCINCE_PARTIAL_REIMPORT_GEOGRAPHY_KEYS_INCOMPATIBLE');
    const spatialEligibility={totalRows:count,spatialRows:count-geo.length,nonSpatialRows:geo.length,
      agebWithoutGeometry:geo.filter(r=>r.geographic_level==='AGEB').length,
      manzana800WithoutGeometry:geo.filter(r=>r.geographic_level==='MANZANA').length,nonSpatialUnits};
    if(count===16323 && (spatialEligibility.nonSpatialRows!==26 || spatialEligibility.agebWithoutGeometry!==1 || spatialEligibility.manzana800WithoutGeometry!==25))
      throw new Error('SCINCE_PARTIAL_REIMPORT_GEOGRAPHY_KEYS_INCOMPATIBLE');
    const found=(await client.query('SELECT status,metadata FROM public.inegi_scince_normalization_release WHERE release_id=$1',[releaseId])).rows[0];
    if(found) {if(found.status!=='READY')throw new Error('SCINCE_RELEASE_NOT_READY');if(nonSpatialUnits.length && core.fingerprint(found.metadata?.spatialEligibility??null)!==core.fingerprint(spatialEligibility))throw new Error('SCINCE_RELEASE_SPATIAL_METADATA_INCOMPATIBLE');await client.query('COMMIT');return {releaseId,observationSetFingerprint,rowCount:count,spatialEligibility,reused:true};}
    await client.query(`INSERT INTO public.inegi_scince_catalog(catalog_version,catalog_fingerprint,reference_year,catalog)
      VALUES($1,$2,2020,$3::jsonb) ON CONFLICT(catalog_version) DO NOTHING`,[core.catalog.catalogVersion,core.catalogFingerprint,JSON.stringify(core.catalog)]);
    const c=(await client.query('SELECT catalog_fingerprint FROM public.inegi_scince_catalog WHERE catalog_version=$1',[core.catalog.catalogVersion])).rows[0];
    if(c?.catalog_fingerprint!==core.catalogFingerprint)throw new Error('SCINCE_CATALOG_VERSION_COLLISION');
    await client.query(`INSERT INTO public.inegi_scince_normalization_release(release_id,dataset_id,catalog_version,normalization_version,observation_set_fingerprint,status,row_count,metadata)
      VALUES($1,$2,$3,$4,$5,'IMPORTING',$6,$7::jsonb)`,[releaseId,datasetId,core.catalog.catalogVersion,core.NORMALIZATION_VERSION,observationSetFingerprint,count,JSON.stringify({mode:'PARTIAL_REIMPORT',geographySha256,censusSha256:d.census_sha256,catalogFingerprint:core.catalogFingerprint,spatialEligibility})]);
    async function flush(batch) {
      await client.query(`INSERT INTO public.inegi_scince_observation_set(release_id,dataset_id,geographic_level,source_row_key,observations,raw_source)
        SELECT $1,$2,x.level,x.key,x.observations,x.raw FROM jsonb_to_recordset($3::jsonb) AS x(level text,key text,observations jsonb,raw jsonb)`,[releaseId,datasetId,JSON.stringify(batch)]);
    }
    let batch=[];const verify=createHash('sha256');let imported=0;
    for await(const row of readRows(csvPath)) {verify.update(JSON.stringify(row.observations)+'\n');imported++;batch.push(row);if(batch.length===100){await flush(batch);batch=[];}}
    if(batch.length)await flush(batch);
    if(imported!==count||verify.digest('hex')!==observationSetFingerprint||await hashFile(csvPath)!==core.catalog.sourceCsvSha256)throw new Error('SCINCE_SOURCE_CHANGED_DURING_IMPORT');
    await client.query("UPDATE public.inegi_scince_normalization_release SET status='READY' WHERE release_id=$1 AND status='IMPORTING'",[releaseId]);
    await client.query('COMMIT');return {releaseId,observationSetFingerprint,rowCount:count,spatialEligibility,reused:false};
  } catch(error) {await client.query('ROLLBACK');throw error;}
}
module.exports={partialReimport,sourceRows,fileHash};
