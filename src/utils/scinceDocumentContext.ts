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
