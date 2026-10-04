export type ScinceStatisticalType = 'COUNT'|'RATE'|'PERCENTAGE'|'AVERAGE'|'INDEX'|'CATEGORICAL'|'IDENTIFIER'|'UNKNOWN';
export type ScinceDimension = 'POPULATION'|'SEX'|'AGE'|'FERTILITY'|'MIGRATION'|'INDIGENOUS_ETHNICITY'|'DISABILITY'|'EDUCATION'|'ECONOMIC_ACTIVITY'|'HEALTH'|'MARITAL_STATUS'|'RELIGION'|'HOUSEHOLDS'|'HOUSING'|'BASIC_SERVICES'|'OVERCROWDING'|'ICT'|'OTHER';
export type ScinceValueStatus = 'VALUE'|'ZERO'|'SUPPRESSED'|'NOT_AVAILABLE'|'NOT_APPLICABLE'|'INVALID_SOURCE_VALUE'|'MISSING';
export interface ScinceCatalogVariable {
  variableCode:string; officialName:string; officialDescription:string; dimension:ScinceDimension;
  statisticalType:ScinceStatisticalType; unit:string; universe:string;
  availableLevels:'AGEB'|'MANZANA'|'AMBAS'|'OTRO';
  aggregationPolicy:'SUM_FULL_DISJOINT_SAME_LEVEL'|'NO_AGGREGATION'; denominatorCode:string|null;
  suppressionPolicy:string; nullSemantics:Record<string,string>; sourceProduct:string;
  referenceYear:2020; catalogVersion:string;
}
export interface ScinceTypedValue {
  rawValue:string|null; typedValue:number|string|null; valueStatus:ScinceValueStatus; nullReason:string|null;
}
export interface ScinceTypedObservation extends ScinceTypedValue {
  variableCode:string; geographicLevel:'AGEB'|'MANZANA'; sourceRowKey:string; sourceReference:string;
}
export interface ScinceNormalizationRelease {
  releaseId:string; datasetId:string; catalogVersion:string; normalizationVersion:string;
  observationSetFingerprint:string; catalogFingerprint:string;
}
export interface ScinceDerivedIndicator {
  name:string; value:number; formula:string; inputs:Array<{code:string; value:number}>;
  denominator:{code:string; value:number}; universe:string; version:'SCINCE_DERIVATIONS_V1';
  territorialRestrictions:string[]; sourceReferences:string[];
}
export interface OfficialBaseProfile2020 extends ScinceNormalizationRelease {
  schemaVersion:'SCINCE_OFFICIAL_BASE_PROFILE_2020_V1'; referenceYear:2020; datasetIdentity:string;
  territorialBinding:import('./scinceMultiunit').ScinceMultiunitObservation['geographyBinding'];
  scinceAnalysisArea:import('./scinceAnalysisArea').ScinceAnalysisArea|null;
  rawIndicators:ScinceTypedObservation[]; derivedIndicators:ScinceDerivedIndicator[];
  profileDimensions:Partial<Record<ScinceDimension,string[]>>;
  methodologicalWarnings:string[]; provenance:import('./scinceCanonicalCoverage').ScinceCoverageDataset['provenance'];
  admissibleAggregates:import('./scinceMultiunit').ScinceAggregate[];
}
/** Future estimates must carry their own method, inputs and review; never overwrite census observations. */
export interface EstimatedCurrentProfile {
  schemaVersion:'SCINCE_TEMPORAL_ESTIMATE_CONTRACT_V1'; referenceYear:number;
  baseProfileIdentity:ScinceNormalizationRelease; methodVersion:string; assumptions:string[];
  uncertainty:string; generatedAt:string; humanReviewRequired:true;
}
