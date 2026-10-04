import {catalog,catalogFingerprint,NORMALIZATION_VERSION,parseTypedValue,legacyCodes} from '../lib/scinceCatalogCore.cjs';
import {aggregateScinceIndicators} from './scinceIndicatorAggregation';
import {isDeepStrictEqual} from 'util';
import type {ScinceMultiunitObservation} from '../types/scinceMultiunit';
import type {OfficialBaseProfile2020,ScinceTypedObservation,ScinceNormalizationRelease,ScinceDerivedIndicator} from '../types/scinceCatalog';

export function catalogIndicators(observations:ScinceTypedObservation[]):ScinceMultiunitObservation['indicators'] {
  return observations.flatMap(o=>{
    const v=catalog.variables.find(v=>v.variableCode===o.variableCode);
    if(!v||v.statisticalType==='IDENTIFIER')return [];
    return [{name:v.variableCode,kind:v.statisticalType,value:o.typedValue,sourceReference:o.sourceReference,
      observationId:o.sourceReference,universe:`${o.geographicLevel}:${v.variableCode}:${v.universe}`}];
  });
}
/** Only COUNT sums can be carried across full, same-level, disjoint units. No implicit weighting of means. */
export function buildOfficialBaseProfile2020(m:ScinceMultiunitObservation,release:ScinceNormalizationRelease,observations:ScinceTypedObservation[]):OfficialBaseProfile2020 {
  const selected=m.partitionEvidence.sourceReferences;
  const full=m.sourceRows.filter(r=>selected.includes(r.observationId)).every(r=>['ANALYSIS_COVERS_UNIT','EQUAL_FOOTPRINT'].includes(r.relationToAnalysis));
  const aggregates=aggregateScinceIndicators(catalogIndicators(observations).filter(i=>selected.includes(i.observationId)),
    {fullUnits:full&&selected.length>0,sameLevel:m.partitionEvidence.sameLevel,disjointInteriors:m.partitionEvidence.disjointInteriors});
  const profileDimensions:OfficialBaseProfile2020['profileDimensions']={};
  for(const o of observations) {const v=catalog.variables.find(v=>v.variableCode===o.variableCode)!;
    if(v.statisticalType==='IDENTIFIER')continue;
    const codes=profileDimensions[v.dimension] ?? (profileDimensions[v.dimension]=[]);if(!codes.includes(v.variableCode))codes.push(v.variableCode);
  }
  const derivedIndicators:ScinceDerivedIndicator[]=[];
  const sums=new Map(aggregates.filter(a=>a.method==='SUM_FULL_DISJOINT_UNITS'&&a.value!==null).map(a=>[a.name,a]));
  // Explicit sex proportions: numerator and denominator use the same census population universe.
  for(const code of ['POBFEM','POBMAS']) {
    const numerator=sums.get(code),denominator=sums.get('POBTOT');
    if(numerator&&denominator&&denominator.value!>0&&numerator.value!<=denominator.value!)
      derivedIndicators.push({name:`${code}_SHARE`,value:numerator.value!/denominator.value!*100,formula:'100 * numerator / denominator',
        inputs:[{code,value:numerator.value!}],denominator:{code:'POBTOT',value:denominator.value!},universe:'Población residente habitual; incluye edad no especificada',
        version:'SCINCE_DERIVATIONS_V1',territorialRestrictions:['FULL_DISJOINT_SOURCE_UNITS_ONLY','SAME_LEVEL_ONLY','NO_AREAL_PRORATION'],sourceReferences:denominator.sourceReferences});
  }
  return {...release,schemaVersion:'SCINCE_OFFICIAL_BASE_PROFILE_2020_V1',referenceYear:2020,datasetIdentity:JSON.stringify([m.partitionEvidence.datasetIdentity,release.catalogVersion,release.normalizationVersion,release.observationSetFingerprint]),
    territorialBinding:structuredClone(m.geographyBinding),scinceAnalysisArea:structuredClone(m.scinceAnalysisArea ?? null),
    rawIndicators:structuredClone(observations),derivedIndicators,profileDimensions,admissibleAggregates:aggregates,
    methodologicalWarnings:[...catalog.methodologicalWarnings,...m.methodologicalWarnings,'Las medias y razones oficiales no se suman ni promedian automáticamente.','No hay estimación al año actual.'],
    provenance:structuredClone(m.dataset.provenance)};
}
export function isValidOfficialBaseProfile2020(m:ScinceMultiunitObservation):boolean {
  try {
    const p=m.officialBaseProfile2020;if(!p)return false;
    if(p.datasetId!==m.dataset.datasetId||p.catalogVersion!==catalog.catalogVersion||p.catalogFingerprint!==catalogFingerprint||
      p.normalizationVersion!==NORMALIZATION_VERSION||!p.releaseId||!/^[0-9a-f]{64}$/.test(p.observationSetFingerprint)||m.dataset.year!==2020)return false;
    const sources=m.sourceRows.filter(r=>r.usage!=='ENUMERATION_ONLY');
    if(p.rawIndicators.length!==sources.length*catalog.variables.length)return false;
    const seen=new Set<string>();
    for(const o of p.rawIndicators) {
      const v=catalog.variables.find(v=>v.variableCode===o.variableCode),r=sources.find(r=>r.observationId===o.sourceReference);
      const key=JSON.stringify([o.sourceReference,o.variableCode]);
      if(!v||!r||seen.has(key)||o.geographicLevel!==r.demographicGeographicLevel||o.sourceRowKey!==r.sourceRowKey)return false;
      seen.add(key);const parsed=parseTypedValue(o.rawValue,v,o.geographicLevel);
      if(['rawValue','typedValue','valueStatus','nullReason'].some(k=>(parsed as any)[k] !== (o as any)[k]))return false;
      const legacy=Object.entries(legacyCodes).find(([,code])=>code===o.variableCode)?.[0];
      if(legacy && (r.demographics as any)[legacy]!==o.typedValue)return false;
    }
    const {releaseId,datasetId,catalogVersion,normalizationVersion,observationSetFingerprint,catalogFingerprint:cf}=p;
    const expected=buildOfficialBaseProfile2020(m,{releaseId,datasetId,catalogVersion,normalizationVersion,observationSetFingerprint,catalogFingerprint:cf},p.rawIndicators);
    // Firestore may reorder map keys. Array order and content remain part of the reviewed observation.
    return isDeepStrictEqual(JSON.parse(JSON.stringify(expected)),JSON.parse(JSON.stringify(p)));
  }catch{return false;}
}
