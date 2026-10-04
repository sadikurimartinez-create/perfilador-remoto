jest.mock('server-only',()=>({}),{virtual:true});
import {catalog,catalogFingerprint,NORMALIZATION_VERSION} from '../src/lib/scinceCatalogCore.cjs';
import {serializeCanonicalGeographyForFirestore} from '../src/utils/canonicalProjectGeography';
import {fingerprintScinceCoverageGeography} from '../src/utils/scinceCanonicalCoverage';
import {buildScinceCompactProfile,createScinceCompactSnapshotV2,decodeScinceCompactObservation,
  fingerprintScinceCompactColumnOrder,fingerprintScinceCompactIndicatorOrder,fingerprintScinceCompactObservation,
  fingerprintScinceCompactProfile,fingerprintScinceCompactSelectedObservationSet,fingerprintScinceCompactSnapshotV2,
  isScinceCompactSnapshotV2,validateScinceCompactSnapshotV2} from '../src/utils/scinceCompactSnapshot';
import type {ScinceCompactSnapshotInput,ScinceCompactSnapshotV2} from '../src/types/scinceCompactSnapshot';
import {normalizeRow,legacyCounts} from '../src/lib/scinceCatalogCore.cjs';
import {resolveInegiMultiunit,resolveInegiLegacyMultiunit,SCINCE_MULTIUNIT_SQL} from '../src/lib/inegiMultiunitResolver';
import {SCINCE_RELEASE_SQL,SCINCE_OBSERVATIONS_SQL} from '../src/lib/scinceObservationRepository';
import {SCINCE_ANALYSIS_AREA_SQL} from '../src/lib/scinceAnalysisArea';
import {readScinceCanonicalGeography} from '../src/utils/scinceQueryGeometry';
import {resolveScinceCanonicalContext} from '../src/services/scinceCanonicalContextService';
import {buildScinceCanonicalSnapshot,isValidScinceResolvedSnapshot,isScinceSnapshotPublishable} from '../src/utils/scinceCanonicalSnapshot';
import {isValidScinceResolvedObservation} from '../src/utils/scinceMultiunitValidation';
import type {ScinceCoverageRelation} from '../src/types/scinceCanonicalCoverage';
import type {ProjectAccessResult} from '../src/types/institutionalProjectAccess';
import type {ScinceMultiunitObservation} from '../src/types/scinceMultiunit';
import * as officialProfile from '../src/utils/scinceOfficialProfile';
jest.mock('@/lib/db',()=>({getPool:jest.fn(()=>{throw new Error('LIVE_DB_FORBIDDEN');})}));
const publicRow=require('./fixtures/inegi/scince-cpv2020-public-rows.json').rows.find((r:any)=>r.MZA==='001');

/** Synthetic contract facts only: this suite does not certify GEOS/disjointness or real units. */
function input(): ScinceCompactSnapshotInput {
  const canonical:any={geographyId:'COMPACT_SYNTHETIC',type:'POLYGON',geometry:{type:'Polygon',coordinates:[[[-102,21],[-101.999,21],[-101.999,21.001],[-102,21.001],[-102,21]]]},validationStatus:'VALID',source:'MAP_VECTOR',createdAt:0,updatedAt:0};
  const fp=fingerprintScinceCoverageGeography(canonical);
  const observations=Array.from({length:52},(_,i)=>{
    const mza=String(i+1).padStart(3,'0'),raw={...publicRow,ENTIDAD:'01',MUN:'001',LOC:'0001',AGEB:'0017',MZA:mza};
    return {geographicLevel:'MANZANA' as const,sourceRowKey:`01:001:0001:0017:${mza}`,geographicCode:`0100100010017${mza}`,
      relationToAnalysis:'ANALYSIS_COVERS_UNIT' as const,usage:'FULL_SOURCE_UNIT_CONTEXT_ONLY' as const,
      rawValues:catalog.variables.map(v=>raw[v.variableCode]??null)};
  });
  const partition={selectedObservationIndexes:observations.map((_,i)=>i),sameLevel:true as const,disjointInteriors:true,aggregationMethod:'FULL_DISJOINT_SOURCE_UNITS_ONLY' as const};
  const radius=500;
  return {schemaVersion:'SCINCE_COMPACT_SNAPSHOT_V2',encodingVersion:'SCINCE_RAW_COLUMN_VECTOR_V1',projectBinding:{projectId:'COMPACT_OFFLINE'},
    geographyBinding:{geographyId:canonical.geographyId,geographyType:'POLYGON',geometry:serializeCanonicalGeographyForFirestore(canonical)!,geographyFingerprint:fp,fingerprintVersion:'SCINCE_COVERAGE_FINGERPRINT_V1'},
    datasetIdentity:{datasetId:'synthetic-offline',referenceYear:2020,version:'fixture-v1'},releaseIdentity:{releaseId:'synthetic-release',observationSetFingerprint:'a'.repeat(64)},
    catalogIdentity:{catalogVersion:catalog.catalogVersion,catalogFingerprint,columnOrderFingerprint:fingerprintScinceCompactColumnOrder(),indicatorOrderFingerprint:fingerprintScinceCompactIndicatorOrder()},
    normalizationIdentity:{normalizationVersion:NORMALIZATION_VERSION},sourceIdentity:{source:'INEGI_CPV2020_LOCAL_POSTGIS',normalizer:'SCINCE_MULTIUNIT_NORMALIZER_V1',
      provenance:{productName:'SYNTHETIC_QA_ONLY',geographySourceUrl:'https://www.inegi.org.mx/fixture',censusSourceUrl:catalog.sourceUrl,geographySha256:'b'.repeat(64),censusSha256:catalog.sourceZipSha256,importedAt:'2026-01-01T00:00:00Z',completedAt:'2026-01-02T00:00:00Z'}},
    analysisArea:{version:'SCINCE_ANALYSIS_AREA_V1',center:{lat:21,lng:-102},coverageRadiusMeters:100,contextExpansionMeters:400,analysisRadiusMeters:radius,
      constructionRadiusMeters:radius/Math.cos(Math.PI/128),approximateAreaSquareMeters:10000,geometryType:'Polygon',geometry:serializeCanonicalGeographyForFirestore({...canonical,geographyId:canonical.geographyId+':area'})!,
      sourceGeometryRevision:fp,sourceGeographyId:canonical.geographyId,calculationMethod:'LOCAL_AEQD_WGS84_CIRCUMSCRIBED_128_V1',centerMethod:'METRIC_MINIMUM_BOUNDING_CIRCLE',projection:'+proj=aeqd +units=m',
      configuration:{version:'SCINCE_RADIUS_CONFIG_V1',governanceReference:'SYNTHETIC_QA_ONLY',individualBaseRadiusMeters:300,lineContextExpansionMeters:200,polygonContextExpansionMeters:400},containmentVerified:true},
    topology:{crs:4326,engine:'GEOS',engineVersion:'SYNTHETIC_CONTRACT_FACTS',isValid:true,isSimple:true,isEmpty:false,area:0.000001},
    territorialUnits:observations.map((o,i)=>({geographicLevel:'MANZANA',geographicCode:o.geographicCode,geographicName:'Synthetic unit',geographyId:String(i+1),geometryFingerprint:'c'.repeat(64),coverageRelation:o.relationToAnalysis,intersectionType:'FULL_UNIT',
      coverageMetrics:{measure:'SQUARE_METRES',intersection:100,analysis:10000,unitArea:100,analysisFraction:0.01,unitAreaFraction:1},observationIndexes:[i]})),
    observations,partitionEvidence:partition,officialBaseProfile2020:buildScinceCompactProfile(observations.map(o=>({...o,observationFingerprint:fingerprintScinceCompactObservation(o)})),partition,['Official 2020; no areal proration; synthetic QA facts.']),
    ppcReview:{status:'REQUIRES_PPC_REVIEW',decision:null,institutionalUserId:null,incorporatedAt:null},freshness:{status:'CURRENT',evaluatedAt:'2026-01-03T00:00:00Z',reasonCode:null},
    audit:{acquiredAt:'2026-01-03T00:00:00Z',observedAt:null,contractVersion:'SCINCE_COMPACT_CONTRACT_V1',materializerVersion:'SCINCE_COMPACT_CODEC_V1'}};
}
let good:ScinceCompactSnapshotV2;
beforeAll(()=>{good=createScinceCompactSnapshotV2(input());});
const changed=(mutate:(s:ScinceCompactSnapshotV2)=>void)=>{const s=structuredClone(good);mutate(s);return s;};
const rehash=(s:ScinceCompactSnapshotV2)=>{s.observations.forEach(o=>o.observationFingerprint=fingerprintScinceCompactObservation(o));s.selectedObservationSetFingerprint=fingerprintScinceCompactSelectedObservationSet(s);s.officialBaseProfile2020.profileFingerprint=fingerprintScinceCompactProfile(s.officialBaseProfile2020);s.audit.contentFingerprint=fingerprintScinceCompactSnapshotV2(s);s.ppcReview.reviewedContentFingerprint=s.audit.contentFingerprint;return s;};
test('52-unit happy path preserves all columns, 222 indicators, provenance and audit below target',()=>{
  expect(validateScinceCompactSnapshotV2(good)).toEqual({valid:true});expect(good.territorialUnits).toHaveLength(52);expect(good.observations).toHaveLength(52);
  expect(good.observations.every(o=>o.rawValues?.length===230)).toBe(true);expect(good.officialBaseProfile2020.aggregateValues).toHaveLength(222);
  expect(good.sourceIdentity.provenance).toEqual(input().sourceIdentity.provenance);expect(good.territorialUnits.every(u=>u.intersectionType==='FULL_UNIT')).toBe(true);
  const bytes=Buffer.byteLength(JSON.stringify(good),'utf8');expect(bytes).toBeLessThanOrEqual(600000);expect(bytes).toBeLessThan(800000);
  console.log(`SCINCE_COMPACT_V21_PAYLOAD_BYTES=${bytes}`);
});
test('constructor is detached and does not repair invalid input',()=>{
  const i=input(),before=JSON.stringify(i),s=createScinceCompactSnapshotV2(i);expect(JSON.stringify(i)).toBe(before);
  s.observations[0].rawValues![0]='changed';expect(i.observations[0].rawValues![0]).toBe('01');i.observations[0].rawValues!.pop();expect(()=>createScinceCompactSnapshotV2(i)).toThrow('SCINCE_COMPACT_CONTRACT_INVALID');
});
test.each([
  ['raw values',(s:any)=>s.observations[0].rawValues[10]='999'],
  ['column order',(s:any)=>s.catalogIdentity.columnOrderFingerprint=fingerprintScinceCompactColumnOrder([...catalog.variables.map(v=>v.variableCode)].reverse())],
  ['indicator order',(s:any)=>s.catalogIdentity.indicatorOrderFingerprint=fingerprintScinceCompactIndicatorOrder(['POBTOT'])],
  ['observation hash',(s:any)=>s.observations[0].observationFingerprint='bad'],
  ['selected set hash',(s:any)=>s.selectedObservationSetFingerprint='bad'],
  ['profile hash',(s:any)=>s.officialBaseProfile2020.profileFingerprint='bad'],
  ['content hash',(s:any)=>s.audit.contentFingerprint='bad'],
  ['project',(s:any)=>s.projectBinding.projectId=''],['geography ID',(s:any)=>s.geographyBinding.geographyId=''],
  ['geography hash',(s:any)=>s.geographyBinding.geographyFingerprint='bad'],['schema',(s:any)=>s.schemaVersion='SCINCE_CANONICAL_SNAPSHOT_V2'],
  ['encoding',(s:any)=>s.encodingVersion='UNKNOWN'],['dataset',(s:any)=>s.datasetIdentity.referenceYear=2026],['release',(s:any)=>s.releaseIdentity.releaseId=''],
  ['catalog',(s:any)=>s.catalogIdentity.catalogVersion=''],['catalog hash',(s:any)=>s.catalogIdentity.catalogFingerprint='bad'],['normalization',(s:any)=>s.normalizationIdentity.normalizationVersion=''],
  ['duplicate unit',(s:any)=>s.territorialUnits.push(s.territorialUnits[0])],['duplicate observation',(s:any)=>s.observations.push(s.observations[0])],
  ['unit index',(s:any)=>s.territorialUnits[0].observationIndexes=[52]],['selected index',(s:any)=>s.partitionEvidence.selectedObservationIndexes=[-1]],
  ['PPC',(s:any)=>s.ppcReview.decision='INCORPORATED'],['freshness',(s:any)=>s.freshness.status='UNKNOWN'],['audit',(s:any)=>delete s.audit.acquiredAt],
  ['extra expanded array',(s:any)=>s.indicators=[]],['unsupported topology',(s:any)=>s.topology.isValid=false],
] as Array<[string,(s:any)=>void]>)('fail-closed: %s',(_,mutate)=>{expect(isScinceCompactSnapshotV2(changed(mutate))).toBe(false);});
test.each([229,231])('rejects raw cardinality %i even with recomputed hashes',n=>{
  const s=changed(s=>s.observations[0].rawValues=Array(n).fill(null));expect(isScinceCompactSnapshotV2(rehash(s))).toBe(false);
});
test.each(['aggregateValues','aggregateStatuses','aggregateMethods','aggregateReasonCodes'])('rejects %s cardinality 221 and 223',(key)=>{
  for(const n of [221,223]){const s=changed(s=>(s.officialBaseProfile2020 as any)[key]=Array(n).fill(null));expect(isScinceCompactSnapshotV2(rehash(s))).toBe(false);}
});
test('preserves null and suppression without false zero',()=>{
  const i=input(),missing=catalog.variables.findIndex(v=>v.variableCode==='PDER_IMSS'),suppressed=catalog.variables.findIndex(v=>v.variableCode==='PCON_DISC');
  i.observations[0].rawValues![missing]=null;i.observations[0].rawValues![suppressed]='*';
  i.officialBaseProfile2020=buildScinceCompactProfile(i.observations.map(o=>({...o,observationFingerprint:fingerprintScinceCompactObservation(o)})),i.partitionEvidence,i.officialBaseProfile2020.limitations);
  const s=createScinceCompactSnapshotV2(i),decoded=decodeScinceCompactObservation(s.observations[0]);
  expect(decoded[missing]).toMatchObject({rawValue:null,typedValue:null,valueStatus:'MISSING'});expect(decoded[suppressed]).toMatchObject({rawValue:'*',typedValue:null,valueStatus:'SUPPRESSED'});
  expect(s.observations[0].rawValues![missing]).toBeNull();expect(s.observations[0].rawValues![suppressed]).toBe('*');
});
test('touch-only raw null is enumerated and never summed',()=>{
  const i=input();i.observations[0]={...i.observations[0],rawValues:null,usage:'ENUMERATION_ONLY',relationToAnalysis:'TOUCHES_ONLY'};
  Object.assign(i.territorialUnits[0],{coverageRelation:'TOUCHES_ONLY',intersectionType:'TOUCHED_UNIT',coverageMetrics:{...i.territorialUnits[0].coverageMetrics,intersection:0,analysisFraction:0,unitAreaFraction:0}});
  i.partitionEvidence.selectedObservationIndexes.shift();i.officialBaseProfile2020=buildScinceCompactProfile(i.observations.map(o=>({...o,observationFingerprint:fingerprintScinceCompactObservation(o)})),i.partitionEvidence,i.officialBaseProfile2020.limitations);
  const s=createScinceCompactSnapshotV2(i);expect(isScinceCompactSnapshotV2(s)).toBe(true);expect(decodeScinceCompactObservation(s.observations[0])).toEqual([]);
});
test('partial units preserve observations but block automatic totals',()=>{
  const i=input();i.observations[0].relationToAnalysis='INTERIOR_INTERSECTION';Object.assign(i.territorialUnits[0],{coverageRelation:'INTERIOR_INTERSECTION',intersectionType:'PARTIAL_UNIT'});
  i.officialBaseProfile2020=buildScinceCompactProfile(i.observations.map(o=>({...o,observationFingerprint:fingerprintScinceCompactObservation(o)})),i.partitionEvidence,i.officialBaseProfile2020.limitations);
  const s=createScinceCompactSnapshotV2(i);expect(s.officialBaseProfile2020.aggregateValues.every(v=>v===null)).toBe(true);expect(s.observations[0].rawValues).toHaveLength(230);
});
test('rehashed forged aggregate and raw territorial identity are rejected',()=>{
  expect(isScinceCompactSnapshotV2(rehash(changed(s=>s.officialBaseProfile2020.aggregateValues[0]=999999)))).toBe(false);
  expect(isScinceCompactSnapshotV2(rehash(changed(s=>s.observations[0].rawValues![0]='02')))).toBe(false);
});
test('valid PPC transition preserves content hash, malformed review is rejected',()=>{
  const s=changed(s=>Object.assign(s.ppcReview,{status:'INCORPORATED',decision:'INCORPORATED',institutionalUserId:'1',incorporatedAt:'2026-01-04T00:00:00Z'}));
  expect(isScinceCompactSnapshotV2(s)).toBe(true);expect(fingerprintScinceCompactSnapshotV2(s)).toBe(good.audit.contentFingerprint);
  s.ppcReview.institutionalUserId='';expect(isScinceCompactSnapshotV2(s)).toBe(false);
});
test('object property order is irrelevant; timestamps are excluded; material changes are bound',()=>{
  const reordered=Object.fromEntries(Object.entries(good).reverse()) as unknown as ScinceCompactSnapshotV2;
  expect(fingerprintScinceCompactSnapshotV2(reordered)).toBe(good.audit.contentFingerprint);
  const timed=changed(s=>{s.audit.acquiredAt='2026-01-05T00:00:00Z';s.freshness.evaluatedAt='2026-01-05T00:00:00Z';});expect(isScinceCompactSnapshotV2(timed)).toBe(true);
  const material=changed(s=>s.sourceIdentity.provenance.productName='other');expect(fingerprintScinceCompactSnapshotV2(material)).not.toBe(good.audit.contentFingerprint);
});
test('rejects non-JSON payloads and unknown inherited encoding',()=>{
  for(const v of [undefined,null,[],{},new Date(),changed(s=>(s as any).extra=undefined),changed(s=>s.officialBaseProfile2020.aggregateValues[0]=NaN)])expect(isScinceCompactSnapshotV2(v)).toBe(false);
});
test('rejects accessors and hidden properties without executing them',()=>{
  const getter=jest.fn(()=> '1'),s=changed(()=>{});
  Object.defineProperty(s.observations[0].rawValues!,'0',{get:getter,enumerable:true});
  expect(isScinceCompactSnapshotV2(s)).toBe(false);expect(getter).not.toHaveBeenCalled();
  const hidden=changed(()=>{});Object.defineProperty(hidden,'hidden',{value:1,enumerable:false});
  expect(isScinceCompactSnapshotV2(hidden)).toBe(false);
});
test('rejects extra analysis-area metadata even after rehashing',()=>{
  const s=changed(s=>(s.analysisArea.configuration as any).unversionedRadius=42);
  expect(isScinceCompactSnapshotV2(rehash(s))).toBe(false);
});

/** The actual resolver runs against the same explicit offline source for both representations. */
function resolverFixture(relations:ScinceCoverageRelation[]=Array(52).fill('ANALYSIS_COVERS_UNIT'),large=false) {
  const fixture=input(),canonical=readScinceCanonicalGeography(fixture.geographyBinding.geometry);
  if(!canonical)throw new Error('FIXTURE_INVALID');
  const p=fixture.sourceIdentity.provenance,a=fixture.analysisArea;
  const rows=fixture.observations.map((o,i)=>{
    const raw=Object.fromEntries(catalog.variables.map((v,j)=>[v.variableCode,o.rawValues![j]]));
    if(large)raw.NOM_LOC='x'.repeat(20000);
    const demographics=legacyCounts(raw,'MANZANA');
    const relation=relations[i],touch=relation==='TOUCHES_ONLY';
    return {raw,geographic_level:'MANZANA',source_row_key:o.sourceRowKey,source_cvegeo:o.geographicCode,geography_id:String(i+1),geographic_name:'Synthetic unit',
      geometry:JSON.stringify(canonical.geometry),srid:4326,is_valid:true,is_simple:true,is_empty:false,area:0.000001,
      intersects:true,touches:touch,covers_gu:relation==='ANALYSIS_COVERS_UNIT',covers_ug:false,equals:false,relate:touch?'FF2F11212':'212FF1FF2',
      intersection_measure:touch?0:relation==='INTERIOR_INTERSECTION'?50:100,unit_area:100,analysis_measure:10000,
      pobtot:demographics.populationTotal,vivtot:demographics.housingTotal,vivpar_hab:demographics.inhabitedPrivateHousing,vivpar_deshab:demographics.uninhabitedPrivateHousing};
  });
  const query=jest.fn(async(sql:string,params?:unknown[])=>{
    if(sql.startsWith('BEGIN')||sql.startsWith('SET')||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
    if(sql.includes('FROM public.inegi_territorial_dataset'))return {rows:[{dataset_id:fixture.datasetIdentity.datasetId,reference_year:2020,version:fixture.datasetIdentity.version,
      product_name:p.productName,geography_source_url:p.geographySourceUrl,census_source_url:p.censusSourceUrl,geography_sha256:p.geographySha256,census_sha256:p.censusSha256,imported_at:p.importedAt,completed_at:p.completedAt}]};
    if(sql===SCINCE_RELEASE_SQL)return {rows:[{release_id:fixture.releaseIdentity.releaseId,dataset_id:fixture.datasetIdentity.datasetId,catalog_version:catalog.catalogVersion,
      normalization_version:NORMALIZATION_VERSION,observation_set_fingerprint:fixture.releaseIdentity.observationSetFingerprint,catalog_fingerprint:catalogFingerprint,catalog}]};
    if(sql===SCINCE_ANALYSIS_AREA_SQL)return {rows:[{geometry:JSON.stringify(canonical.geometry),lat:a.center.lat,lng:a.center.lng,coverage_radius:a.coverageRadiusMeters,analysis_radius:a.analysisRadiusMeters,
      construction_radius:a.constructionRadiusMeters,area_square_meters:a.approximateAreaSquareMeters,projection:a.projection,source_valid:true,source_simple:true,contains_source:true,area_valid:true,area_empty:false}]};
    if(sql.includes('postgis_geos_version'))return {rows:[{srid:4326,is_valid:true,is_simple:true,is_empty:false,area:0.000001,engine_version:'SYNTHETIC_CONTRACT_FACTS'}]};
    if(sql===SCINCE_MULTIUNIT_SQL)return {rows};
    if(sql===SCINCE_OBSERVATIONS_SQL) {
      const requested=String(params?.[1]);
      return {rows:rows.filter(r=>requested.includes(r.source_row_key)).map(r=>({geographic_level:r.geographic_level,source_row_key:r.source_row_key,raw_source:r.raw,observations:normalizeRow(r.raw,'MANZANA',r.source_row_key)}))};
    }
    if(sql.includes('AS disjoint'))return {rows:[{disjoint:true}]};
    throw new Error('UNEXPECTED_OFFLINE_QUERY');
  });
  return {fixture,canonical,query,source:{connect:jest.fn(async()=>({query,release:jest.fn()}))}};
}

test('real resolver returns 52 compact units and preserves legacy semantics without expanded duplicates',async()=>{
  const db=resolverFixture(),args=[db.fixture.projectBinding.projectId,db.canonical,db.source,db.fixture.analysisArea.configuration] as const;
  // Capture the unchanged expanded calculation before encoding: its 52-unit payload
  // exceeds the historical gate, so it cannot be returned by the archived writer.
  const references:ScinceMultiunitObservation[]=[],original=officialProfile.buildOfficialBaseProfile2020;
  const capture=jest.spyOn(officialProfile,'buildOfficialBaseProfile2020').mockImplementation((m,r,o)=>{references.push(m);return original(m,r,o);});
  let resolved:Awaited<ReturnType<typeof resolveInegiMultiunit>>;
  try {resolved=await resolveInegiMultiunit(...args);}finally{capture.mockRestore();}
  if(!resolved.success || !references.length)throw new Error('RESOLVER_FIXTURE_FAILED');
  const legacy=references[0],s=resolved.observation;
  if(s.schemaVersion!=='SCINCE_COMPACT_SNAPSHOT_V2')throw new Error('COMPACT_REQUIRED');
  expect(isValidScinceResolvedObservation(s)).toBe(true);expect(isValidScinceResolvedSnapshot(s)).toBe(true);
  expect(s.datasetIdentity).toEqual({datasetId:legacy.dataset.datasetId,referenceYear:legacy.dataset.year,version:legacy.dataset.version});
  expect(s.projectBinding.projectId).toBe(legacy.projectId);expect(s.geographyBinding).toMatchObject(legacy.geographyBinding);
  expect(s.analysisArea).toEqual(legacy.scinceAnalysisArea);expect(s.topology).toEqual(legacy.topology);
  expect(s.territorialUnits).toHaveLength(52);expect(s.observations).toHaveLength(52);
  expect(s.territorialUnits.map(u=>[u.geographicLevel,u.geographicCode,u.coverageRelation,u.intersectionType,u.coverageMetrics]))
    .toEqual(legacy.unitDetails.map(u=>[u.unitType,u.inegiCode,u.relation,u.intersectionType,u.coverageMetric]));
  expect(s.observations.map(o=>[o.sourceRowKey,o.geographicLevel,o.usage])).toEqual(legacy.sourceRows.map(o=>[o.sourceRowKey,o.demographicGeographicLevel,o.usage]));
  const profile=legacy.officialBaseProfile2020;if(!profile)throw new Error('LEGACY_PROFILE_REQUIRED');
  expect(s.releaseIdentity).toEqual({releaseId:profile.releaseId,observationSetFingerprint:profile.observationSetFingerprint});
  expect(s.catalogIdentity.catalogVersion).toBe(profile.catalogVersion);expect(s.normalizationIdentity.normalizationVersion).toBe(profile.normalizationVersion);
  catalog.variables.filter(v=>v.statisticalType!=='IDENTIFIER').forEach((v,i)=>{
    const aggregate=profile.admissibleAggregates.find(a=>a.name===v.variableCode);
    expect(s.officialBaseProfile2020.aggregateValues[i]).toBe(aggregate?.value??null);
    expect(s.officialBaseProfile2020.aggregateStatuses[i]).toBe(aggregate?.value==null?'NOT_AGGREGATED':'ADMISSIBLE');
    expect(s.officialBaseProfile2020.aggregateMethods[i]).toBe(aggregate?.method??'NOT_AGGREGATED');
    expect(s.officialBaseProfile2020.aggregateReasonCodes[i]).toBe(aggregate?.reason??null);
  });
  expect(s.officialBaseProfile2020.derivedIndicators.map(d=>[d.name,d.formula])).toEqual(profile.derivedIndicators.map(d=>[d.name,d.formula]));
  s.officialBaseProfile2020.derivedIndicators.forEach((d,i)=>expect(d.value).toBeCloseTo(profile.derivedIndicators[i].value,12));
  expect(s.officialBaseProfile2020.limitations).toEqual(legacy.limitations);expect(s.sourceIdentity.provenance).toEqual(legacy.dataset.provenance);
  expect(s.partitionEvidence.selectedObservationIndexes.map(i=>legacy.sourceRows[i].observationId)).toEqual(legacy.partitionEvidence.sourceReferences);
  expect(s.partitionEvidence.disjointInteriors).toBe(legacy.partitionEvidence.disjointInteriors);
  s.observations.forEach(o=>{
    expect(o.rawValues).toHaveLength(230);expect(o.observationFingerprint).toBe(fingerprintScinceCompactObservation(o));
    const originals=profile.rawIndicators.filter(r=>r.sourceRowKey===o.sourceRowKey);
    decodeScinceCompactObservation(o).forEach(decoded=>{
      const original=originals.find(r=>r.variableCode===decoded.variableCode);if(!original)throw new Error('SOURCE_MISSING');
      expect([decoded.rawValue,decoded.typedValue,decoded.valueStatus,decoded.nullReason]).toEqual([original.rawValue,original.typedValue,original.valueStatus,original.nullReason]);
    });
  });
  expect(s).not.toHaveProperty('indicators');expect(s).not.toHaveProperty('rawIndicators');expect(s).not.toHaveProperty('rawScinceIndicators');
  expect(buildScinceCanonicalSnapshot(s)).toEqual(s);expect(isScinceSnapshotPublishable({snapshot:s,expectedProjectId:legacy.projectId,currentCanonicalGeography:db.canonical})).toBe(false);
  const bytes=Buffer.byteLength(JSON.stringify(s),'utf8');expect(bytes).toBeLessThanOrEqual(600000);expect(bytes).toBeLessThan(800000);
  console.log(`SCINCE_COMPACT_V22_RESOLVER_PAYLOAD_BYTES=${bytes}`);
});

test('compact resolver preserves touch enumeration and partial metrics without publishing totals',async()=>{
  const relations:ScinceCoverageRelation[]=Array(52).fill('ANALYSIS_COVERS_UNIT');relations[0]='TOUCHES_ONLY';relations[1]='INTERIOR_INTERSECTION';
  const db=resolverFixture(relations),r=await resolveInegiMultiunit(db.fixture.projectBinding.projectId,db.canonical,db.source,db.fixture.analysisArea.configuration);
  if(!r.success || r.observation.schemaVersion!=='SCINCE_COMPACT_SNAPSHOT_V2')throw new Error('COMPACT_REQUIRED');
  const s=r.observation;
  expect(s.observations[0]).toMatchObject({usage:'ENUMERATION_ONLY',rawValues:null});expect(s.territorialUnits[0].intersectionType).toBe('TOUCHED_UNIT');
  expect(s.territorialUnits[1]).toMatchObject({intersectionType:'PARTIAL_UNIT',coverageMetrics:{intersection:50,unitAreaFraction:0.5}});
  expect(s.partitionEvidence.selectedObservationIndexes).not.toContain(0);expect(s.officialBaseProfile2020.aggregateValues.every(v=>v===null)).toBe(true);
});

test('canonical service carries compact output without expansion; PPC builder refuses it',async()=>{
  const db=resolverFixture(),resolved=await resolveInegiMultiunit(db.fixture.projectBinding.projectId,db.canonical,db.source,db.fixture.analysisArea.configuration);
  if(!resolved.success || resolved.observation.schemaVersion!=='SCINCE_COMPACT_SNAPSHOT_V2')throw new Error('COMPACT_REQUIRED');
  const snapshot=resolved.observation,authorize=jest.fn(async():Promise<ProjectAccessResult>=>({allowed:true,projectId:db.fixture.projectBinding.projectId,
    actor:{institutionalUserId:'1',username:'OFFLINE',role:'USER'},authorizationBasis:'EXPLICIT_ACTIVE_ACTION_GRANT',policyVersion:'EXPLICIT_ACTION_GRANT_V1',
    project:{canonicalGeography:db.canonical},action:'ANALYZE_SCINCE',audit:{correlationId:'offline',institutionalUserId:'1',username:'OFFLINE',role:'USER',
      projectId:db.fixture.projectBinding.projectId,action:'ANALYZE_SCINCE',outcome:'ALLOW',authorizationBasis:'EXPLICIT_ACTIVE_ACTION_GRANT',policyVersion:'EXPLICIT_ACTION_GRANT_V1',timestamp:'2026-01-03T00:00:00Z'}}));
  // Use the existing authenticated institutional fixture type, without fabricating runtime grants.
  const serviceResolver=jest.fn(async()=>resolved);
  const result=await resolveScinceCanonicalContext({projectId:db.fixture.projectBinding.projectId},'offline-session',{resolveMultiunit:serviceResolver,authorize});
  expect(authorize).toHaveBeenCalledWith({projectId:db.fixture.projectBinding.projectId,sessionToken:'offline-session',action:'ANALYZE_SCINCE'});
  if(!result.success)throw new Error(result.code);
  expect(result.compactSnapshot).toBe(snapshot);expect(result.multiunit).toBeUndefined();expect(result.datasetId).toBe(snapshot.datasetIdentity.datasetId);
  expect(result.datasetYear).toBe(2020);expect(result.datasetVersion).toBe(snapshot.datasetIdentity.version);expect(result.limitations).toEqual(snapshot.officialBaseProfile2020.limitations);
  expect(()=>buildScinceCanonicalSnapshot(result)).toThrow('SCINCE_COMPACT_ADAPTER_NOT_ENABLED');
  snapshot.projectBinding.projectId='OTHER_PROJECT';rehash(snapshot);
  expect(await resolveScinceCanonicalContext({projectId:db.fixture.projectBinding.projectId},'offline-session',{resolveMultiunit:serviceResolver,authorize}))
    .toEqual({success:false,code:'SCINCE_CANONICAL_DATA_UNAVAILABLE'});
  snapshot.projectBinding.projectId=db.fixture.projectBinding.projectId;rehash(snapshot);snapshot.observations[0].rawValues![10]='999';
  expect(await resolveScinceCanonicalContext({projectId:db.fixture.projectBinding.projectId},'offline-session',{resolveMultiunit:serviceResolver,authorize}))
    .toEqual({success:false,code:'SCINCE_CANONICAL_DATA_UNAVAILABLE'});
  const grant=await authorize();authorize.mockResolvedValue({allowed:false,code:'PROJECT_ACCESS_DENIED',audit:{...grant.audit,outcome:'DENY'}});
  serviceResolver.mockClear();
  expect(await resolveScinceCanonicalContext({projectId:db.fixture.projectBinding.projectId},'offline-session',{resolveMultiunit:serviceResolver,authorize}))
    .toMatchObject({success:false,code:'SCINCE_CANONICAL_ACCESS_DENIED'});
  expect(serviceResolver).not.toHaveBeenCalled();
});

test('compact payload limit remains fail-closed with sanitized diagnostic and rollback',async()=>{
  const db=resolverFixture(undefined,true),log=jest.spyOn(console,'error').mockImplementation(()=>{});
  try {
    expect(await resolveInegiMultiunit(db.fixture.projectBinding.projectId,db.canonical,db.source,db.fixture.analysisArea.configuration)).toEqual({success:false,code:'SCINCE_CANONICAL_DATA_UNAVAILABLE'});
    expect(db.query).toHaveBeenCalledWith('ROLLBACK');expect(db.query).not.toHaveBeenCalledWith('COMMIT');
    expect(log).toHaveBeenCalledWith(expect.objectContaining({stage:'PAYLOAD',code:'SCINCE_SNAPSHOT_PAYLOAD_LIMIT',unitCount:52,payloadBytes:expect.any(Number)}));
    expect(JSON.stringify(log.mock.calls)).not.toContain('xxxx');
  }finally{log.mockRestore();}
});

test('both resolver boundary validators reject tampering, cardinality and unknown formats',()=>{
  for(const bad of [changed(s=>s.audit.contentFingerprint='bad'),changed(s=>s.observations[0].rawValues!.pop()),changed(s=>s.officialBaseProfile2020.aggregateValues.pop()),
    changed(s=>s.territorialUnits[0].observationIndexes=[52]),changed(s=>s.selectedObservationSetFingerprint='bad'),changed(s=>s.officialBaseProfile2020.profileFingerprint='bad'),
    {...good,schemaVersion:'UNKNOWN'},{...good,encodingVersion:'UNKNOWN'}]) {
    expect(isValidScinceResolvedObservation(bad)).toBe(false);expect(isValidScinceResolvedSnapshot(bad)).toBe(false);
  }
});
