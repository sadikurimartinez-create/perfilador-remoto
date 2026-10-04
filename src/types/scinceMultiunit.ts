import type { ScinceCanonicalCoverage, ScinceCoverageTopologyEvidence, ScinceCoverageRelation } from './scinceCanonicalCoverage';
import type { FirestoreSafeCanonicalProjectGeography } from '../utils/canonicalProjectGeography';

export type ScinceIndicatorKind = 'COUNT' | 'RATE' | 'PERCENTAGE' | 'AVERAGE' | 'INDEX' | 'CATEGORICAL' | 'IDENTIFIER' | 'UNKNOWN';
export interface ScinceIndicator {
  name: string; kind: ScinceIndicatorKind; value: number | string | null;
  sourceReference: string; universe: string;
  numerator?: number; denominator?: number; scale?: number;
  formula?: 'NUMERATOR_DENOMINATOR' | 'WEIGHTED_MEAN';
}
export interface ScinceAggregate {
  name: string; kind: ScinceIndicatorKind; value: number | null;
  method: 'SUM_FULL_DISJOINT_UNITS' | 'RATIO_OF_SUMS' | 'WEIGHTED_MEAN' | 'NOT_AGGREGATED';
  sourceReferences: string[]; reason: string | null;
}
export interface ScinceUnitDetail {
  unitType: ScinceCanonicalCoverage['territorialUnits'][number]['geographicLevel'];
  inegiCode: string; name: string | null;
  intersectionType: 'FULL_UNIT' | 'PARTIAL_UNIT' | 'TOUCHED_UNIT';
  relation: ScinceCoverageRelation;
  coverageMetric: { measure: 'METRES' | 'SQUARE_METRES'; intersection: number; analysis: number; unitArea: number; analysisFraction: number; unitAreaFraction: number | null };
  sourceReference: string;
}
export interface ScinceMultiunitObservation extends Omit<ScinceCanonicalCoverage, 'schemaVersion' | 'support' | 'aggregation' | 'geographyBinding'> {
  geographyBinding: {geographyId:string; geographyType:'INDIVIDUAL'|'CORRIDOR'|'POLYGON'; geographyFingerprint:string};
  scinceAnalysisArea?: import('./scinceAnalysisArea').ScinceAnalysisArea;
  officialBaseProfile2020?: import('./scinceCatalog').OfficialBaseProfile2020;
  rawScinceIndicators?: ScinceMultiunitObservation['indicators'];
  derivedSociodemographicProfile?: import('./scinceAnalysisArea').ScinceSociodemographicProfile;
  officialBaseProfile?: import('./scinceAnalysisArea').ScinceSociodemographicProfile;
  estimatedCurrentProfile?: null;
  schemaVersion: 'SCINCE_PRODUCTIVE_COVERAGE_V2';
  support: 'PRODUCTIVE_UNIT_CONTEXT';
  geometry: FirestoreSafeCanonicalProjectGeography;
  queryTimestamp: string;
  source: 'INEGI_CPV2020_LOCAL_POSTGIS';
  normalizer: 'SCINCE_MULTIUNIT_NORMALIZER_V1';
  humanReviewStatus: 'REQUIRES_PPC_REVIEW' | 'INCORPORATED';
  topology: Omit<ScinceCoverageTopologyEvidence, 'geometry'>;
  unitDetails: ScinceUnitDetail[];
  indicators: Array<ScinceIndicator & { observationId: string }>;
  aggregates: ScinceAggregate[];
  aggregationMethod: 'FULL_DISJOINT_SOURCE_UNITS_ONLY';
  partitionEvidence: { sameLevel: boolean; disjointInteriors: boolean; datasetIdentity: string; sourceReferences: string[] };
  methodologicalWarnings: string[];
}
