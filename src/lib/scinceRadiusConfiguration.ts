import 'server-only';
import type { ScinceRadiusConfiguration } from '../types/scinceAnalysisArea';

export function isValidScinceRadiusConfiguration(value: unknown): value is ScinceRadiusConfiguration {
  const c=value as ScinceRadiusConfiguration;
  return !!c && c.version==='SCINCE_RADIUS_CONFIG_V1' && typeof c.governanceReference==='string' && !!c.governanceReference.trim() &&
    typeof c.individualBaseRadiusMeters==='number' && Number.isFinite(c.individualBaseRadiusMeters) && c.individualBaseRadiusMeters>0 &&
    [c.lineContextExpansionMeters,c.polygonContextExpansionMeters].every(n=>typeof n==='number' && Number.isFinite(n) && n>=0) &&
    [c.individualBaseRadiusMeters,c.lineContextExpansionMeters,c.polygonContextExpansionMeters].every(n=>n<=100000);
}
/** Explicit deployment configuration; absence/invalidity never invents a radius or falls back to direct coverage. */
export function readScinceRadiusConfiguration(env: NodeJS.ProcessEnv = process.env): ScinceRadiusConfiguration | null {
  const parse=(key:string)=>env[key]?.trim() ? Number(env[key]) : NaN;
  const c={version:'SCINCE_RADIUS_CONFIG_V1' as const,governanceReference:env.SCINCE_RADIUS_GOVERNANCE_REFERENCE ?? '',
    individualBaseRadiusMeters:parse('SCINCE_DEFAULT_RADIUS_M'),lineContextExpansionMeters:parse('SCINCE_LINE_CONTEXT_EXPANSION_M'),
    polygonContextExpansionMeters:parse('SCINCE_POLYGON_CONTEXT_EXPANSION_M')};
  return isValidScinceRadiusConfiguration(c) ? c : null;
}

export function scinceRadiusConfigurationMatches(value: unknown): boolean {
  const current=readScinceRadiusConfiguration();
  return current!==null && isValidScinceRadiusConfiguration(value) &&
    current.governanceReference===value.governanceReference &&
    current.individualBaseRadiusMeters===value.individualBaseRadiusMeters &&
    current.lineContextExpansionMeters===value.lineContextExpansionMeters &&
    current.polygonContextExpansionMeters===value.polygonContextExpansionMeters;
}
