import type { ScinceAnalysisArea } from './scinceAnalysisArea';
import type { ScinceCoverageDataset, ScinceCoverageLevel, ScinceCoverageRelation, ScinceCoverageTopologyEvidence } from './scinceCanonicalCoverage';
import type { ScinceAggregate, ScinceUnitDetail } from './scinceMultiunit';
import type { ScinceDimension } from './scinceCatalog';
import type { FirestoreSafeCanonicalProjectGeography } from '../utils/canonicalProjectGeography';

/** Isolated V2.1 contract. Structural validation is not authorization or GEOS certification. */
export interface ScinceCompactObservation {
  geographicLevel: 'AGEB' | 'MANZANA';
  sourceRowKey: string;
  geographicCode: string;
  relationToAnalysis: ScinceCoverageRelation;
  usage: 'ENUMERATION_ONLY' | 'FULL_SOURCE_UNIT_CONTEXT_ONLY';
  observationFingerprint: string;
  rawValues: Array<string | null> | null;
}
export interface ScinceCompactTerritorialUnit {
  geographicLevel: ScinceCoverageLevel;
  geographicCode: string;
  geographicName: string | null;
  geographyId: string;
  geometryFingerprint: string;
  coverageRelation: ScinceCoverageRelation;
  intersectionType: ScinceUnitDetail['intersectionType'];
  coverageMetrics: ScinceUnitDetail['coverageMetric'];
  observationIndexes: number[];
}
export interface ScinceCompactProfile {
  referenceYear: 2020;
  aggregateValues: Array<number | null>;
  aggregateStatuses: Array<'ADMISSIBLE' | 'NOT_AGGREGATED'>;
  aggregateMethods: Array<ScinceAggregate['method']>;
  aggregateReasonCodes: Array<string | null>;
  dimensions: Partial<Record<ScinceDimension, number[]>>;
  derivedIndicators: Array<{name: string; value: number; numeratorIndex: number; denominatorIndex: number;
    formula: '100 * numerator / denominator'; version: 'SCINCE_COMPACT_DERIVATIONS_V1'}>;
  limitations: string[];
  provenanceReference: 'sourceIdentity.provenance';
  profileFingerprint: string;
}
export interface ScinceCompactSnapshotV2 {
  schemaVersion: 'SCINCE_COMPACT_SNAPSHOT_V2';
  encodingVersion: 'SCINCE_RAW_COLUMN_VECTOR_V1';
  projectBinding: {projectId: string};
  geographyBinding: {geographyId: string; geographyType: 'INDIVIDUAL' | 'CORRIDOR' | 'POLYGON';
    geometry: FirestoreSafeCanonicalProjectGeography; geographyFingerprint: string; fingerprintVersion: string};
  datasetIdentity: {datasetId: string; referenceYear: 2020; version: string};
  releaseIdentity: {releaseId: string; observationSetFingerprint: string};
  catalogIdentity: {catalogVersion: string; catalogFingerprint: string; columnOrderFingerprint: string; indicatorOrderFingerprint: string};
  normalizationIdentity: {normalizationVersion: string};
  sourceIdentity: {source: 'INEGI_CPV2020_LOCAL_POSTGIS'; normalizer: 'SCINCE_MULTIUNIT_NORMALIZER_V1'; provenance: ScinceCoverageDataset['provenance']};
  analysisArea: ScinceAnalysisArea;
  topology: Omit<ScinceCoverageTopologyEvidence, 'geometry'>;
  territorialUnits: ScinceCompactTerritorialUnit[];
  observations: ScinceCompactObservation[];
  partitionEvidence: {selectedObservationIndexes: number[]; sameLevel: true; disjointInteriors: boolean;
    aggregationMethod: 'FULL_DISJOINT_SOURCE_UNITS_ONLY'};
  officialBaseProfile2020: ScinceCompactProfile;
  selectedObservationSetFingerprint: string;
  ppcReview: {status: 'REQUIRES_PPC_REVIEW' | 'INCORPORATED'; reviewedContentFingerprint: string;
    decision: 'INCORPORATED' | null; institutionalUserId: string | null; incorporatedAt: string | null};
  freshness: {evaluatedAt: string | null; status: 'CURRENT' | 'STALE' | 'INVALID' | 'MISSING'; reasonCode: string | null};
  audit: {acquiredAt: string; observedAt: null; contractVersion: 'SCINCE_COMPACT_CONTRACT_V1';
    materializerVersion: 'SCINCE_COMPACT_CODEC_V1'; contentFingerprint: string};
}
export type ScinceCompactSnapshotInput = Omit<ScinceCompactSnapshotV2, 'observations' | 'officialBaseProfile2020' | 'selectedObservationSetFingerprint' | 'ppcReview' | 'audit'> & {
  observations: Array<Omit<ScinceCompactObservation, 'observationFingerprint'>>;
  officialBaseProfile2020: Omit<ScinceCompactProfile, 'profileFingerprint'>;
  ppcReview: Omit<ScinceCompactSnapshotV2['ppcReview'], 'reviewedContentFingerprint'>;
  audit: Omit<ScinceCompactSnapshotV2['audit'], 'contentFingerprint'>;
};

export type ScinceMaterializationPurpose = 'UI' | 'IA' | 'PPC' | 'REPORT';
export interface ScinceReviewView {
  version:'SCINCE_REVIEW_VIEW_V1';
  dataset:ScinceCompactSnapshotV2['datasetIdentity'];
  release:ScinceCompactSnapshotV2['releaseIdentity'];
  catalog:ScinceCompactSnapshotV2['catalogIdentity'];
  geography:Pick<ScinceCompactSnapshotV2['geographyBinding'],'geographyId'|'geographyType'|'geographyFingerprint'>;
  analysisArea:Pick<ScinceAnalysisArea,'center'|'coverageRadiusMeters'|'contextExpansionMeters'|'analysisRadiusMeters'|'approximateAreaSquareMeters'|'calculationMethod'>;
  unitCount:number;
  coverageSummary:Record<'FULL_UNIT'|'PARTIAL_UNIT'|'TOUCHED_UNIT',number>;
  aggregateIndicators:Array<{code:string;name:string;dimension:ScinceDimension;value:number|null;
    status:ScinceCompactProfile['aggregateStatuses'][number];method:ScinceAggregate['method'];reasonCode:string|null}>;
  derivedIndicators:ScinceCompactProfile['derivedIndicators'];
  limitations:string[];
  provenanceSummary:ScinceCoverageDataset['provenance'];
  freshness:'CURRENT'|'STALE'|'INVALID'|'MISSING';
  snapshotFingerprint:string;
  reviewFingerprint:string;
}
/** Transient server-side view. This is never a persisted snapshot or a public response. */
export interface MaterializedScinceContext {
  version: 'SCINCE_CONTEXT_MATERIALIZATION_V1';
  purpose: ScinceMaterializationPurpose;
  projectBinding: ScinceCompactSnapshotV2['projectBinding'];
  geographyBinding: ScinceCompactSnapshotV2['geographyBinding'];
  datasetIdentity: ScinceCompactSnapshotV2['datasetIdentity'];
  releaseIdentity: ScinceCompactSnapshotV2['releaseIdentity'];
  catalogIdentity: ScinceCompactSnapshotV2['catalogIdentity'];
  normalizationIdentity: ScinceCompactSnapshotV2['normalizationIdentity'];
  analysisArea: ScinceAnalysisArea;
  topology: ScinceCompactSnapshotV2['topology'];
  territorialUnits: ScinceCompactTerritorialUnit[];
  observations: Array<ScinceCompactObservation & {sourceReference:string;normalizedValues:import('./scinceCatalog').ScinceTypedObservation[] | null}>;
  partitionEvidence: ScinceCompactSnapshotV2['partitionEvidence'];
  officialBaseProfile2020: ScinceCompactProfile;
  indicators: Array<{variableCode:string;officialName:string;dimension:ScinceDimension;
    value:number|null;status:ScinceCompactProfile['aggregateStatuses'][number];
    method:ScinceAggregate['method'];reasonCode:string|null}>;
  provenance: ScinceCoverageDataset['provenance'];
  limitations: string[];
  verification: {selectedObservationSetFingerprint:string;profileFingerprint:string;contentFingerprint:string};
  toJSON(): never;
}
