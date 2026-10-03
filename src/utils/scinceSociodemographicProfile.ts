import type { ScinceMultiunitObservation } from '../types/scinceMultiunit';
import type { ScinceSociodemographicProfile } from '../types/scinceAnalysisArea';

/** Only the four fields normalized by the current importer have an accredited dimension. */
export function deriveScinceSociodemographicProfile(raw: ScinceMultiunitObservation['indicators'],
  aggregates: ScinceMultiunitObservation['aggregates'], referenceYear: number, datasetIdentity: string): ScinceSociodemographicProfile {
  const mapping: Record<string,'population'|'housing'> = {populationTotal:'population',housingTotal:'housing',
    inhabitedPrivateHousing:'housing',uninhabitedPrivateHousing:'housing'};
  const dimensions: ScinceSociodemographicProfile['dimensions'] = {};
  for (const indicator of raw) {
    const dimension=Object.prototype.hasOwnProperty.call(mapping,indicator.name)?mapping[indicator.name]:undefined;
    if (!dimension) continue;
    const bucket=dimensions[dimension] ?? (dimensions[dimension]={rawIndicators:[],admissibleAggregates:[]});
    bucket.rawIndicators.push(structuredClone(indicator));
  }
  for (const aggregate of aggregates) {
    const dimension=Object.prototype.hasOwnProperty.call(mapping,aggregate.name)?mapping[aggregate.name]:undefined;
    if (dimension && dimensions[dimension]) dimensions[dimension]!.admissibleAggregates.push(structuredClone(aggregate));
  }
  return {version:'SCINCE_SOCIODEMOGRAPHIC_PROFILE_V1',referenceYear,datasetIdentity,dimensions,
    unclassifiedIndicatorNames:[...new Set(raw.filter(r=>!Object.prototype.hasOwnProperty.call(mapping,r.name)).map(r=>r.name))].sort()};
}
