import type { ScinceCanonicalSnapshot, ScinceSnapshotFreshness } from "@/types/scinceCanonicalSnapshot";
import type { InstitutionalReportInput } from "@/utils/institutionalReportPublicationContract";

export type ScinceDocumentContext =
  | { publicationStatus: "PUBLISHABLE"; territorialFreshness: "CURRENT"; snapshot: ScinceCanonicalSnapshot; reason: null }
  | { publicationStatus: "NOT_PUBLISHABLE_STALE" | "NOT_PUBLISHABLE_INVALID" | "NOT_PUBLISHABLE_MISSING";
      territorialFreshness: Exclude<ScinceSnapshotFreshness, "CURRENT">; snapshot: null; reason: string };

export function excludedScinceDocumentContext(status: Exclude<ScinceSnapshotFreshness, "CURRENT">,
  reason: string): ScinceDocumentContext {
  return { publicationStatus: `NOT_PUBLISHABLE_${status}`, territorialFreshness: status, snapshot: null, reason };
}

/** Replace any previous admission on each generation, including when transport is unavailable. */
export async function integrateScinceDocumentContextForReport(input: InstitutionalReportInput,
  admit: (projectId: string, geography: InstitutionalReportInput["geography"]) => Promise<ScinceDocumentContext>
): Promise<InstitutionalReportInput> {
  let scinceContext: ScinceDocumentContext;
  try { scinceContext = await admit(input.projectId, input.geography); }
  catch { scinceContext = excludedScinceDocumentContext("INVALID", "SCINCE_DOCUMENT_ADMISSION_UNAVAILABLE"); }
  return { ...input, scinceContext };
}

const value = (v: string | number | null | undefined) => v == null ? "No disponible" : String(v);

/** Descriptive projections of an already admitted observation; no publication decisions here. */
export function scinceDocumentSummary(context?: ScinceDocumentContext): string[] {
  if (context?.publicationStatus !== "PUBLISHABLE") return [];
  const s = context.snapshot;
  if (s.multiunit) return [`Contexto sociodemográfico observado — INEGI SCINCE. Consulta sobre ${s.geographyBinding.geographyType === 'INDIVIDUAL' ? 'punto' : s.geographyBinding.geographyType === 'CORRIDOR' ? 'corredor' : 'área'}; ` +
    `dataset ${s.multiunit.dataset.datasetId}, año ${s.multiunit.dataset.year}, versión ${s.multiunit.dataset.version}. ` +
    (s.multiunit.scinceAnalysisArea ? `El perfil corresponde al entorno territorial definido por un radio de ${s.multiunit.scinceAnalysisArea.analysisRadiusMeters} metros, calculado para contener completamente ${s.geographyBinding.geographyType==='INDIVIDUAL'?'el punto':s.geographyBinding.geographyType==='CORRIDOR'?'el corredor':'el área poligonal'}. ` : '') +
    `${s.multiunit.territorialUnits.length} unidades territoriales relacionadas. Las cifras son de cada unidad fuente completa; ` +
    'no estiman población de intersecciones parciales. Unidades, indicadores, método y provenance en el Anexo Técnico.'];
  return [`Contexto sociodemográfico observado — INEGI SCINCE. Dataset: ${value(s.dataset.datasetId)}; ` +
    `año: ${value(s.dataset.year)}; versión: ${value(s.dataset.version)}. ` +
    `La unidad territorial consultada fue localizada a nivel ${value(s.territorialResolution.geographicLevel)}. ` +
    `Los indicadores demográficos disponibles corresponden al nivel ${value(s.territorialResolution.demographicGeographicLevel)}. ` +
    `Población: ${value(s.demographics?.populationTotal)}; viviendas: ${value(s.demographics?.housingTotal)}. ` +
    "Detalle de variables, fuentes y limitaciones en el Anexo Técnico."];
}

export function scinceDocumentFacts(context?: ScinceDocumentContext): Array<{ label: string; value: string }> {
  if (context?.publicationStatus !== "PUBLISHABLE") return [];
  const s = context.snapshot, p = s.provenance;
  if (s.multiunit) {
    const m=s.multiunit;
    return [
      {label:'Modalidad de consulta',value:s.geographyBinding.geographyType==='INDIVIDUAL'?'Entorno de un punto':s.geographyBinding.geographyType==='CORRIDOR'?'Consulta sobre corredor':'Consulta sobre área'},
      {label:'Geometría origen',value:`${s.geographyBinding.geographyId} · ${s.geographyBinding.geographyFingerprint}`},
      {label:'Dataset / año / versión',value:`${m.dataset.datasetId} / ${m.dataset.year} / ${m.dataset.version}`},
      ...(m.scinceAnalysisArea ? [
        {label:'Geometría canónica original',value:JSON.stringify(m.geometry)},
        {label:'Área analítica SCINCE separada',value:JSON.stringify(m.scinceAnalysisArea)},
        {label:'Perfil sociodemográfico oficial reproducible',value:JSON.stringify(m.officialBaseProfile)},
        {label:'Estimación temporal',value:'No implementada; datos oficiales conservan su año censal'},
      ] : []),
      {label:'Proveedor / normalizador',value:`${m.source} / ${m.normalizer}`},
      {label:'Fecha de adquisición (no observación censal)',value:m.queryTimestamp},
      {label:'Método de agregación',value:m.aggregationMethod},
      {label:'Fuente geográfica / SHA-256',value:`${m.dataset.provenance.geographySourceUrl} / ${m.dataset.provenance.geographySha256}`},
      {label:'Fuente censal / SHA-256',value:`${m.dataset.provenance.censusSourceUrl} / ${m.dataset.provenance.censusSha256}`},
      ...m.unitDetails.map(u=>({label:`Unidad ${u.unitType} ${u.inegiCode}`,value:`${u.intersectionType}; ${u.relation}; intersección ${u.coverageMetric.intersection} ${u.coverageMetric.measure}; proporción del análisis ${u.coverageMetric.analysisFraction}; referencia ${u.sourceReference}`})),
      ...m.sourceRows.map(r=>({label:`Fila ${r.demographicGeographicLevel} ${r.sourceRowKey}`,value:r.usage==='ENUMERATION_ONLY'?'Sólo contacto: identidad sin cifras publicables':
        `Cifras completas de la unidad: población ${value(r.demographics.populationTotal)}, viviendas ${value(r.demographics.housingTotal)}, habitadas ${value(r.demographics.inhabitedPrivateHousing)}, deshabitadas ${value(r.demographics.uninhabitedPrivateHousing)}; fuente ${r.observationId}`})),
      ...m.aggregates.map(a=>({label:`Resumen de unidades completas seleccionadas: ${a.name}`,value:`${value(a.value)}; método ${a.method}; ${a.reason ?? ''}; fuentes ${a.sourceReferences.join(', ')}`})),
    ];
  }
  return [
    { label: "Conjunto de datos", value: value(s.dataset.datasetId) },
    { label: "Año de referencia", value: value(s.dataset.year) },
    { label: "Versión del dataset", value: value(s.dataset.version) },
    { label: "Unidad territorial localizada", value: value(s.territorialResolution.geographicLevel) },
    { label: "Nivel territorial de los datos demográficos", value: value(s.territorialResolution.demographicGeographicLevel) },
    { label: "Clave territorial de la fila fuente", value: value(s.territorialResolution.sourceRowKey) },
    { label: "Población total", value: value(s.demographics?.populationTotal) },
    { label: "Viviendas totales", value: value(s.demographics?.housingTotal) },
    { label: "Viviendas particulares habitadas", value: value(s.demographics?.inhabitedPrivateHousing) },
    { label: "Viviendas particulares deshabitadas", value: value(s.demographics?.uninhabitedPrivateHousing) },
    { label: "Marginación", value: "No disponible en el producto importado" },
    ...(s.demographics ? [{ label: "Nota de marginación de la fuente", value: s.demographics.marginacionNote }] : []),
    ...(p ? [
      { label: "Producto fuente", value: p.productName },
      { label: "Dataset de provenance", value: p.datasetId },
      { label: "Año de provenance", value: String(p.referenceYear) },
      { label: "Versión de provenance", value: p.version },
      { label: "Fuente geográfica", value: p.geographySourceUrl },
      { label: "SHA-256 de geografía", value: p.geographySha256 },
      { label: "Fuente censal", value: p.censusSourceUrl },
      { label: "SHA-256 de censo", value: p.censusSha256 },
      { label: "Fecha de importación (no observación)", value: p.importedAt },
      { label: "Fecha de finalización de importación (no observación)", value: p.completedAt },
    ] : []),
    { label: "Fecha de observación", value: value(s.observedAt) },
  ];
}

export function scinceDocumentLimitations(context?: ScinceDocumentContext): string[] {
  if (context?.publicationStatus === "PUBLISHABLE") return [...context.snapshot.limitations];
  return context ? [`Limitación: SCINCE no publicable (${context.territorialFreshness}): ${context.reason}`] : [];
}
