import 'server-only';
import {fingerprintScinceCanonicalPoint} from './scinceGeographyBinding';
import {fingerprintScinceCoverageGeography} from './scinceCanonicalCoverage';
import {deriveScinceSociodemographicProfile} from './scinceSociodemographicProfile';
import {isValidScinceRadiusConfiguration} from '../lib/scinceRadiusConfiguration';
import { isDeepStrictEqual } from 'util';
import { buildScinceCanonicalCoverage } from './scinceCanonicalCoverage';
import { readScinceCanonicalGeography } from './scinceQueryGeometry';
import { aggregateScinceIndicators } from './scinceIndicatorAggregation';
import type { ScinceMultiunitObservation } from '../types/scinceMultiunit';

const equal = (a: unknown, b: unknown) => isDeepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));

/** Persisted shape/identity checks are not live topological certification. */
export function isValidScinceMultiunit(value: unknown): value is ScinceMultiunitObservation {
  try {
    const m = value as ScinceMultiunitObservation;
    if (!m || m.schemaVersion !== 'SCINCE_PRODUCTIVE_COVERAGE_V2' || m.support !== 'PRODUCTIVE_UNIT_CONTEXT' ||
      m.source !== 'INEGI_CPV2020_LOCAL_POSTGIS' || m.normalizer !== 'SCINCE_MULTIUNIT_NORMALIZER_V1' ||
      !['REQUIRES_PPC_REVIEW','INCORPORATED'].includes(m.humanReviewStatus) || typeof m.queryTimestamp!=='string' || !Number.isFinite(Date.parse(m.queryTimestamp)) ||
      m.aggregationMethod !== 'FULL_DISJOINT_SOURCE_UNITS_ONLY' || !m.territorialUnits.length || m.territorialUnits.length>500 ||
      !m.methodologicalWarnings.length || !m.methodologicalWarnings.every(s=>typeof s==='string')) return false;
    const origin=readScinceCanonicalGeography(m.geometry);
    const a=m.scinceAnalysisArea;
    const geography = readScinceCanonicalGeography(a?.geometry ?? m.geometry);
    if (!origin || !geography || geography.type==='INDIVIDUAL') return false;
    if (a) {
      const fp=origin.type==='INDIVIDUAL'?fingerprintScinceCanonicalPoint(origin):fingerprintScinceCoverageGeography(origin);
      const expansion=origin.type==='INDIVIDUAL'?a.configuration.individualBaseRadiusMeters:origin.type==='CORRIDOR'?a.configuration.lineContextExpansionMeters:a.configuration.polygonContextExpansionMeters;
      if (a.version!=='SCINCE_ANALYSIS_AREA_V1' || a.calculationMethod!=='LOCAL_AEQD_WGS84_CIRCUMSCRIBED_128_V1' ||
        a.centerMethod!==(origin.type==='INDIVIDUAL'?'SOURCE_POINT':origin.type==='CORRIDOR'?'METRIC_LINE_MIDPOINT':'METRIC_MINIMUM_BOUNDING_CIRCLE') ||
        !isValidScinceRadiusConfiguration(a.configuration) || a.sourceGeographyId!==origin.geographyId || a.sourceGeometryRevision!==fp ||
        a.geometryType!=='Polygon' || geography.geometry.type!=='Polygon' || a.containmentVerified!==true ||
        ![a.coverageRadiusMeters,a.contextExpansionMeters,a.analysisRadiusMeters,a.constructionRadiusMeters,a.approximateAreaSquareMeters,a.center.lat,a.center.lng].every(Number.isFinite) ||
        Math.abs(a.center.lat)>80 || Math.abs(a.center.lng)>180 || a.coverageRadiusMeters<0 || a.analysisRadiusMeters<=0 || a.analysisRadiusMeters>100000 || a.approximateAreaSquareMeters<=0 ||
        a.contextExpansionMeters!==expansion || Math.abs(a.analysisRadiusMeters-a.coverageRadiusMeters-expansion)>1e-7 ||
        Math.abs(a.constructionRadiusMeters-a.analysisRadiusMeters/Math.cos(Math.PI/128))>1e-7 ||
        origin.type==='INDIVIDUAL' && (a.coverageRadiusMeters!==0 || origin.geometry.type!=='Point' || a.center.lng!==origin.geometry.coordinates[0] || a.center.lat!==origin.geometry.coordinates[1]) ||
        typeof a.projection!=='string' || !a.projection.startsWith('+proj=aeqd ')) return false;
      if (!equal(m.geographyBinding,{geographyId:origin.geographyId,geographyType:origin.type,geographyFingerprint:fp})) return false;
    } else if (origin.type==='INDIVIDUAL' || m.rawScinceIndicators!==undefined || m.derivedSociodemographicProfile!==undefined || m.officialBaseProfile!==undefined || m.estimatedCurrentProfile!==undefined) return false;
    const base = buildScinceCanonicalCoverage({projectId:m.projectId,geography,crs:4326,
      topology:{...m.topology,geometry:geography.geometry},dataset:m.dataset,sourceRows:m.sourceRows,
      territorialUnits:m.territorialUnits,limitations:m.limitations});
    if (!equal(a ? m.geographyBinding : base.geographyBinding,m.geographyBinding) || base.coverageMode!==m.coverageMode ||
      !equal(base.sourceRows,m.sourceRows) || !equal(base.territorialUnits,m.territorialUnits) ||
      m.unitDetails.length!==m.territorialUnits.length) return false;
    const ids = new Set<string>();
    for (const detail of m.unitDetails) {
      const unit=m.territorialUnits.find(u=>u.geographicLevel===detail.unitType && u.geographicCode===detail.inegiCode);
      const id=JSON.stringify([detail.unitType,detail.inegiCode]);
      if (!unit || ids.has(id) || detail.relation!==unit.relationToAnalysis ||
        detail.sourceReference!==JSON.stringify([m.dataset.datasetId,detail.unitType,detail.inegiCode]) ||
        (detail.name!==null && typeof detail.name!=='string')) return false;
      ids.add(id);
      const kind=unit.relationToAnalysis==='TOUCHES_ONLY'?'TOUCHED_UNIT':['ANALYSIS_COVERS_UNIT','EQUAL_FOOTPRINT'].includes(unit.relationToAnalysis)?'FULL_UNIT':'PARTIAL_UNIT';
      if (kind!==detail.intersectionType) return false;
      const metric=detail.coverageMetric;
      if (![metric.analysis,metric.intersection,metric.unitArea,metric.analysisFraction].every(Number.isFinite) ||
        metric.analysis<=0 || metric.unitArea<=0 || metric.intersection<0 || metric.intersection>metric.analysis*(1+1e-8) ||
        Math.abs(metric.analysisFraction-metric.intersection/metric.analysis)>1e-10 ||
        metric.measure!==(geography.type==='CORRIDOR'?'METRES':'SQUARE_METRES') ||
        geography.type==='CORRIDOR' && metric.unitAreaFraction!==null ||
        geography.type==='POLYGON' && (typeof metric.unitAreaFraction!=='number' || !Number.isFinite(metric.unitAreaFraction) ||
          metric.intersection>metric.unitArea*(1+1e-8) || Math.abs(metric.unitAreaFraction-metric.intersection/metric.unitArea)>1e-10)) return false;
    }
    const expected=m.sourceRows.flatMap(row=>row.usage==='ENUMERATION_ONLY'?[]:
      (['populationTotal','housingTotal','inhabitedPrivateHousing','uninhabitedPrivateHousing'] as const).map(name=>({name,kind:'COUNT',value:row.demographics[name],sourceReference:row.observationId,
        observationId:row.observationId,universe:`${m.partitionEvidence.datasetIdentity}:${row.demographicGeographicLevel}:${name}`})));
    const identity=JSON.stringify([m.dataset.datasetId,m.dataset.year,m.dataset.version,m.dataset.provenance.geographySha256,m.dataset.provenance.censusSha256]);
    if (m.partitionEvidence.datasetIdentity!==identity || m.partitionEvidence.sameLevel!==true || typeof m.partitionEvidence.disjointInteriors!=='boolean' ||
      !equal(expected,m.indicators)) return false;
    const level=m.sourceRows.some(row=>row.demographicGeographicLevel==='MANZANA' && row.usage!=='ENUMERATION_ONLY')?'MANZANA':'AGEB';
    const selected=m.sourceRows.filter(row=>row.demographicGeographicLevel===level && row.usage!=='ENUMERATION_ONLY');
    const refs=selected.map(row=>row.observationId);
    if (!equal(refs,m.partitionEvidence.sourceReferences)) return false;
    const full=selected.length>0 && selected.every(row=>['ANALYSIS_COVERS_UNIT','EQUAL_FOOTPRINT'].includes(row.relationToAnalysis));
    const aggregates=aggregateScinceIndicators(m.indicators.filter(row=>refs.includes(row.observationId)),
      {fullUnits:full,sameLevel:true,disjointInteriors:m.partitionEvidence.disjointInteriors});
    if (!equal(aggregates,m.aggregates)) return false;
    if (a) {
      const profile=deriveScinceSociodemographicProfile(m.indicators,m.aggregates,m.dataset.year,identity);
      if (!equal(m.rawScinceIndicators,m.indicators) || !equal(m.derivedSociodemographicProfile,profile) || !equal(m.officialBaseProfile,profile) || m.estimatedCurrentProfile!==null) return false;
    }
    return true;
  } catch { return false; }
}

/** Reacquisition times can change without changing the reviewed territorial observation. */
export function scinceReviewedContent(snapshot: import('../types/scinceCanonicalSnapshot').ScinceCanonicalSnapshot): unknown {
  const copy=structuredClone(snapshot);
  if (copy.multiunit) copy.multiunit.queryTimestamp='ACQUISITION_TIME_EXCLUDED_FROM_CONTENT_COMPARISON';
  return copy;
}
