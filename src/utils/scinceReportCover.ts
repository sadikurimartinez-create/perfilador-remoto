import type { InstitutionalReportInput } from './institutionalReportPublicationContract';
import type { OfficialBaseProfile2020 } from '../types/scinceCatalog';
import type { ScinceAnalysisArea } from '../types/scinceAnalysisArea';
import type { CanonicalProjectGeography } from './canonicalProjectGeography';
import { deserializeCanonicalGeographyFromFirestore, getCanonicalGeographyCoordinates } from './canonicalProjectGeography';
import { buildGovernedCartographicDecision } from './governedCartographicScale';
import { canonicalSemanticValue } from './institutionalDocumentSemanticIntegrity';
import catalog from '../data/scince/inegi-cpv2020-catalog.json';

export const SCINCE_COVER_MAP_ID = 'scince-cover-territorial-map';
export interface ScinceCoverMapPlan {
  geography: CanonicalProjectGeography;
  analysisArea: ScinceAnalysisArea;
  cartography: ReturnType<typeof buildGovernedCartographicDecision>;
  layers: readonly ['CANONICAL_GEOGRAPHY', 'SCINCE_ANALYSIS_AREA', 'ANALYTICAL_CENTER', 'GRATICULE'];
}
export interface ScinceCoverIndicator {
  variableCode: string; label: string; displayValue: string; dimension: string;
  evidenceClass: 'OFFICIAL_2020' | 'REPRODUCIBLE_DERIVATION';
  provenance: { datasetId: string; referenceYear: 2020; releaseId: string; catalogVersion: string;
    normalizationVersion: string; observationSetFingerprint: string; universe: string;
    aggregationMethod: string; sourceObservations: OfficialBaseProfile2020['rawIndicators'];
    derivation?: OfficialBaseProfile2020['derivedIndicators'][number] };
}
export interface ScinceReportCover {
  version: 'SCINCE_REPORT_COVER_V1'; status: 'READY' | 'INCOMPLETE'; reason: string | null;
  map: ScinceCoverMapPlan | null; indicators: ScinceCoverIndicator[]; limitations: string[];
  methodology: string[]; estimatedCurrentProfile: null;
}
// Census counts with interpretable universes; means/rates are never averaged here.
const selection = [
  ['POBTOT', 'Población total'], ['POBFEM_SHARE', 'Mujeres (%)'],
  ['POB0_14', 'Población de 0–14 años'], ['P15YM_SE', '15+ sin escolaridad'], ['PEA', 'Población económicamente activa'],
  ['PDER_SS', 'Con afiliación a salud'], ['VIVPAR_HAB', 'Viviendas particulares habitadas'],
  ['TOTHOG', 'Hogares censales'], ['VPH_C_SERV', 'Viviendas con servicios'], ['VPH_INTER', 'Viviendas con internet'],
  ['POBMAS_SHARE', 'Hombres (%)'], ['PCON_DISC', 'Con discapacidad'],
] as const;

/** Pure projection of server admission. Never admits a client snapshot or recomputes SCINCE. */
export function buildScinceReportCover(input: InstitutionalReportInput): ScinceReportCover {
  const incomplete = (reason: string): ScinceReportCover => ({ version: 'SCINCE_REPORT_COVER_V1', status: 'INCOMPLETE',
    reason, map: null, indicators: [], limitations: ['Contextualización SCINCE incompleta; no se publican cifras en la carátula.'],
    methodology: [], estimatedCurrentProfile: null });
  try {
  const c = input.scinceContext;
  if (c?.publicationStatus !== 'PUBLISHABLE' || c.territorialFreshness !== 'CURRENT') return incomplete(c?.publicationStatus || 'SCINCE_MISSING');
  const s = c.snapshot, m = s.multiunit, p = m?.officialBaseProfile2020, a = m?.scinceAnalysisArea;
  if (!m || !p || !a) return incomplete('OFFICIAL_PROFILE_AND_GOVERNED_RADIUS_REQUIRED');
  if (m.humanReviewStatus !== 'INCORPORATED') return incomplete('PPC_INCORPORATION_REQUIRED');
  if (!p.provenance?.censusSourceUrl || !p.provenance.censusSha256 || !p.provenance.geographySha256 ||
      !p.catalogFingerprint || !p.datasetIdentity || !p.profileDimensions || !Array.isArray(p.rawIndicators) ||
      !Array.isArray(p.admissibleAggregates) || !Array.isArray(p.derivedIndicators) || !m.partitionEvidence?.sourceReferences?.length)
    return incomplete('SCINCE_PROFILE_PROVENANCE_REQUIRED');
  // Full snapshot/release/freshness validation belongs to server admission. Keep this
  // browser projection free of server-only modules and Node crypto dependencies.
  const current = deserializeCanonicalGeographyFromFirestore(input.geography);
  const geography = deserializeCanonicalGeographyFromFirestore(m.geometry);
  const area = deserializeCanonicalGeographyFromFirestore(a.geometry);
  if (!current || !geography || s.projectId !== input.projectId || current.geographyId !== geography.geographyId ||
      current.type !== geography.type || canonicalSemanticValue(current.geometry) !== canonicalSemanticValue(geography.geometry) ||
      canonicalSemanticValue(p.territorialBinding) !== canonicalSemanticValue(m.geographyBinding) ||
      canonicalSemanticValue(p.scinceAnalysisArea) !== canonicalSemanticValue(a) ||
      p.catalogVersion !== catalog.catalogVersion || p.referenceYear !== 2020 || !p.releaseId || !p.normalizationVersion || !p.observationSetFingerprint)
    return incomplete('SCINCE_SNAPSHOT_INVALID_OR_STALE');
  if (!geography || !area || !a.containmentVerified || !a.configuration?.governanceReference ||
      ![a.analysisRadiusMeters, a.coverageRadiusMeters, a.contextExpansionMeters, a.approximateAreaSquareMeters].every(Number.isFinite) ||
      a.analysisRadiusMeters <= 0 || a.approximateAreaSquareMeters <= 0 || a.coverageRadiusMeters < 0 || a.contextExpansionMeters < 0 ||
      Math.abs(a.analysisRadiusMeters - a.coverageRadiusMeters - a.contextExpansionMeters) > 1e-7)
    return incomplete('GOVERNED_RADIUS_REQUIRED');
  const indicators: ScinceCoverIndicator[] = [];
  const limitations: string[] = [];
  for (const [code, label] of selection) {
    const derived = p.derivedIndicators.find(d => d.name === code);
    const v = catalog.variables.find(v => v.variableCode === (derived?.inputs[0]?.code || code));
    if (!v || !p.profileDimensions[v.dimension as keyof typeof p.profileDimensions]?.includes(v.variableCode)) continue;
    const aggregate = p.admissibleAggregates.find(g => g.name === code && g.method === 'SUM_FULL_DISJOINT_UNITS');
    const value = derived?.value ?? aggregate?.value;
    const refs = derived?.sourceReferences ?? aggregate?.sourceReferences ?? [];
    if (value == null || !Number.isFinite(value) || !refs.length) { limitations.push(`${label}: sin resumen admisible; detalle de supresiones y unidades parciales en anexo.`); continue; }
    const codes = derived ? [derived.inputs[0].code, derived.denominator.code] : [code];
    const observations = p.rawIndicators.filter(o => refs.includes(o.sourceReference) && codes.includes(o.variableCode));
    if (!observations.length || observations.some(o => !['VALUE', 'ZERO'].includes(o.valueStatus))) continue;
    for (const sourceCode of codes) {
      const sourceAggregate = p.admissibleAggregates.find(g => g.name === sourceCode && g.method === 'SUM_FULL_DISJOINT_UNITS');
      const bound = observations.filter(o => o.variableCode === sourceCode);
      if (!sourceAggregate || !bound.length || bound.some(o => typeof o.typedValue !== 'number') ||
          bound.reduce((sum, o) => sum + Number(o.typedValue), 0) !== sourceAggregate.value)
        return incomplete('EXECUTIVE_OBSERVATION_BINDING_INVALID');
    }
    indicators.push({ variableCode: code, label, dimension: v.dimension,
      displayValue: derived ? `${value > 0 && value < 0.1 ? '<0.1' : value.toFixed(1)} % · derivado` : `${value.toLocaleString('es-MX')} · oficial`,
      evidenceClass: derived ? 'REPRODUCIBLE_DERIVATION' : 'OFFICIAL_2020',
      provenance: { datasetId: p.datasetId, referenceYear: 2020, releaseId: p.releaseId, catalogVersion: p.catalogVersion,
        normalizationVersion: p.normalizationVersion, observationSetFingerprint: p.observationSetFingerprint,
        universe: derived?.universe ?? v.universe, aggregationMethod: derived ? 'RATIO_OF_SUMS' : 'SUM_FULL_DISJOINT_UNITS',
        sourceObservations: structuredClone(observations), ...(derived ? { derivation: structuredClone(derived) } : {}) } });
    if (indicators.length === 10) break;
  }
  if (!indicators.length) return incomplete('NO_ADMISSIBLE_EXECUTIVE_INDICATORS');
  const cartography = buildGovernedCartographicDecision({ center: a.center,
    points: [...getCanonicalGeographyCoordinates(geography), ...getCanonicalGeographyCoordinates(area)], fitMode: 'BOUNDS', reservedBottomLogicalPx: 30 });
  const metric = (n: number) => n.toLocaleString('es-MX', { maximumSignificantDigits: 6 });
  const areaLabel = a.approximateAreaSquareMeters < 1e6 ? `${metric(a.approximateAreaSquareMeters)} m²` : `${metric(a.approximateAreaSquareMeters / 1e6)} km²`;
  return { version: 'SCINCE_REPORT_COVER_V1', status: 'READY', reason: null,
    map: { geography: structuredClone(geography), analysisArea: structuredClone(a), cartography,
      layers: ['CANONICAL_GEOGRAPHY', 'SCINCE_ANALYSIS_AREA', 'ANALYTICAL_CENTER', 'GRATICULE'] },
    indicators, limitations, estimatedCurrentProfile: null,
    methodology: [
      `Fuente: INEGI · Censo 2020 / AGEB y manzana urbana (3.ª edición) · ${geography.geometry.type}`,
      `Radio total: ${metric(a.analysisRadiusMeters)} m · cobertura: ${metric(a.coverageRadiusMeters)} m · expansión: ${metric(a.contextExpansionMeters)} m · área aproximada: ${areaLabel} · ${m.partitionEvidence.sourceReferences.length} unidades utilizadas.`,
      `Catálogo: ${p.catalogVersion} · release${p.releaseId.length > 32 ? ' abreviado' : ''}: ${p.releaseId.length > 32 ? p.releaseId.slice(0, 20) + '…' : p.releaseId}`,
      'Oficial INEGI 2020 / derivación reproducible. Sumas de unidades completas disjuntas; no estiman población de intersecciones parciales ni al año actual. Contexto territorial, sin atribución causal de criminalidad.',
      ...(limitations.length ? ['Hay indicadores sin resumen admisible; consultar limitaciones y provenance en anexo.'] : []),
    ] };
  } catch { return incomplete('SCINCE_COVER_PROJECTION_INVALID'); }
}
