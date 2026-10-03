import type { FirestoreSafeCanonicalProjectGeography } from '../utils/canonicalProjectGeography';
import type { ScinceIndicator, ScinceAggregate } from './scinceMultiunit';

export interface ScinceRadiusConfiguration {
  version: 'SCINCE_RADIUS_CONFIG_V1';
  governanceReference: string;
  individualBaseRadiusMeters: number;
  lineContextExpansionMeters: number;
  polygonContextExpansionMeters: number;
}
export interface ScinceAnalysisArea {
  version: 'SCINCE_ANALYSIS_AREA_V1';
  center: {lat:number; lng:number};
  coverageRadiusMeters: number;
  contextExpansionMeters: number;
  analysisRadiusMeters: number;
  constructionRadiusMeters: number;
  approximateAreaSquareMeters: number;
  geometryType: 'Polygon';
  geometry: FirestoreSafeCanonicalProjectGeography;
  sourceGeometryRevision: string;
  sourceGeographyId: string;
  calculationMethod: 'LOCAL_AEQD_WGS84_CIRCUMSCRIBED_128_V1';
  centerMethod: 'SOURCE_POINT' | 'METRIC_LINE_MIDPOINT' | 'METRIC_MINIMUM_BOUNDING_CIRCLE';
  projection: string;
  configuration: ScinceRadiusConfiguration;
  containmentVerified: true;
}
export interface ScinceSociodemographicProfile {
  version: 'SCINCE_SOCIODEMOGRAPHIC_PROFILE_V1';
  referenceYear: number;
  datasetIdentity: string;
  dimensions: Partial<Record<'population'|'housing', {
    rawIndicators: Array<ScinceIndicator & {observationId:string}>;
    admissibleAggregates: ScinceAggregate[];
  }>>;
  unclassifiedIndicatorNames: string[];
}
