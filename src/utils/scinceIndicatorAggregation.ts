import type { ScinceAggregate, ScinceIndicator } from '../types/scinceMultiunit';

/** Eligibility is measured by the trusted resolver, not inferred from area fractions. */
export function aggregateScinceIndicators(rows: ScinceIndicator[], proof: { fullUnits: boolean; sameLevel: boolean; disjointInteriors: boolean }): ScinceAggregate[] {
  const names = [...new Set(rows.map(row => row.name))].sort();
  return names.map(name => {
    const selected = rows.filter(row => row.name === name);
    const first = selected[0];
    const sourceReferences = selected.map(row => row.sourceReference);
    const base = { name, kind: first.kind, sourceReferences };
    const unavailable = (reason: string): ScinceAggregate => ({ ...base, value: null, method: 'NOT_AGGREGATED', reason });
    if (!proof.fullUnits || !proof.sameLevel || !proof.disjointInteriors) return unavailable('FULL_DISJOINT_HOMOGENEOUS_UNITS_NOT_ACREDITED');
    if (new Set(sourceReferences).size !== sourceReferences.length || selected.some(row => row.kind !== first.kind || row.universe !== first.universe || !row.universe))
      return unavailable('DUPLICATE_OR_INCOMPARABLE_SOURCE');
    if (selected.some(row => typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 0)) return unavailable('MISSING_OR_INVALID_VALUES');
    const sum = selected.reduce((n, row) => n + Number(row.value), 0);
    if (first.kind === 'COUNT') return Number.isSafeInteger(sum) && selected.every(row => Number.isSafeInteger(row.value)) ?
      { ...base, value: sum, method: 'SUM_FULL_DISJOINT_UNITS', reason: null } : unavailable('COUNT_OVERFLOW_OR_NON_INTEGER');
    if (['RATE','PERCENTAGE','AVERAGE'].includes(first.kind)) {
      if (selected.some(row => typeof row.denominator !== 'number' || !Number.isFinite(row.denominator) || row.denominator <= 0)) return unavailable('DENOMINATOR_NOT_ACREDITED');
      const denominator = selected.reduce((n,row) => n + row.denominator!,0);
      if (!Number.isFinite(denominator)) return unavailable('DENOMINATOR_OVERFLOW');
      if (first.kind === 'AVERAGE' && selected.every(row => row.formula === 'WEIGHTED_MEAN')) {
        const value = selected.reduce((n,row) => n + Number(row.value)*row.denominator!,0)/denominator;
        return Number.isFinite(value) ? { ...base, value, method:'WEIGHTED_MEAN', reason:null } : unavailable('OVERFLOW');
      }
      if (selected.every(row => row.formula === 'NUMERATOR_DENOMINATOR' && row.scale === first.scale &&
        typeof row.numerator === 'number' && Number.isFinite(row.numerator) && row.numerator >= 0 &&
        typeof row.scale === 'number' && Math.abs(Number(row.value)-row.numerator/row.denominator!*row.scale) <= 1e-10) &&
        typeof first.scale === 'number' && first.scale > 0 && Number.isFinite(first.scale)) {
        const value = selected.reduce((n,row)=>n+row.numerator!,0) / denominator * first.scale;
        return Number.isFinite(value) ? { ...base, value, method:'RATIO_OF_SUMS', reason:null } : unavailable('OVERFLOW');
      }
      return unavailable('OFFICIAL_FORMULA_NOT_ACREDITED');
    }
    return unavailable('NO_AUTOMATIC_METHOD_FOR_INDICATOR_KIND');
  });
}
