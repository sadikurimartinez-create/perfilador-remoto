import type { AcquisitionMode, EpistemicValidationStatus } from "@/types/epistemicIntegrity";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { validateLineage, type CanonicalLineageNode, type LineageStatus } from "@/utils/evidenceLineage";
import { evaluateHumanValidation } from "@/utils/humanValidationPolicy";
import type { PublicationDisclosure, PublicationEligibility, PublicationExclusion } from "@/utils/institutionalReportPublicationContract";

export type InstitutionalVisualType =
  | "MAP"
  | "PHOTO"
  | "STREET_VIEW"
  | "TEMPORAL_COMPARISON"
  | "CHART"
  | "DIAGRAM"
  | "SPECIALIZED_INTELLIGENCE_VISUAL"
  | "DECORATIVE_ASSET"
  | "OTHER";

export type VisualIntegrityStatus =
  | "VALID"
  | "WARNING"
  | "HASH_MISMATCH"
  | "MIME_MISMATCH"
  | "CORRUPT_ARTIFACT"
  | "UNAVAILABLE";

export interface InstitutionalVisualProduct {
  id: string;
  visualId: string;
  visualType: InstitutionalVisualType;
  kind?: string | null;
  title: string;
  caption: string;
  sourceType: string;
  sourceItemIds: string[];
  geographyId?: string | null;
  geographyType?: CanonicalProjectGeography["type"] | null;
  geometryType?: CanonicalProjectGeography["geometry"]["type"] | null;
  evidenceIds: string[];
  findingIds: string[];
  analysisIds: string[];
  assertionIds: string[];
  acquisitionMode: AcquisitionMode | "UNKNOWN";
  validationStatus: EpistemicValidationStatus | "APPROVED" | "LEGACY_UNCLASSIFIED";
  integrityStatus: VisualIntegrityStatus;
  lineageStatus: LineageStatus;
  publicationEligibility: PublicationEligibility;
  disclosureCodes: string[];
  exclusionReason?: string | null;
  assetRef?: string | null;
  generatedAt?: string | null;
  datasetSourceRefs: string[];
  variables: string[];
  transformation?: string | null;
  relationKind?: "CORRELATION" | "CAUSAL" | "TEMPORAL_DIFFERENCE" | "SPATIAL_ASSOCIATION" | null;
  decorative: boolean;
  certified: false;
}

export interface VisualProductAssessment {
  visualId: string;
  visualType: InstitutionalVisualType;
  publicationEligibility: PublicationEligibility;
  disclosures: PublicationDisclosure[];
  exclusion?: PublicationExclusion;
  lineageRefs: {
    geographyId?: string | null;
    evidenceIds: string[];
    findingIds: string[];
    analysisIds: string[];
    assertionIds: string[];
    sourceItemIds: string[];
  };
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function uniq(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function visualId(item: any, visualType: InstitutionalVisualType): string {
  return String(
    item?.visualId ||
    item?.id ||
    item?.evidenceId ||
    item?.captureId ||
    item?.comparisonId ||
    item?.chartId ||
    item?.mapId ||
    item?.traceabilityReference ||
    `${visualType}-UNAVAILABLE`
  );
}

function lineageOf(item: any): CanonicalLineageNode[] {
  return asArray<CanonicalLineageNode>(item?.lineage || item?.evidenceLineage || item?.multimodalEvidence?.lineage);
}

function lineageStatusOf(item: any): LineageStatus {
  const nodes = lineageOf(item);
  if (nodes.length > 0) return validateLineage(nodes).status;
  return item?.lineageStatus || item?.multimodalEvidence?.lineageStatus || "LEGACY_UNCLASSIFIED";
}

function refs(item: any) {
  const nodes = lineageOf(item);
  return {
    geographyId: item?.geographyId || item?.multimodalEvidence?.geographyId || nodes.find((node) => node.geographyId)?.geographyId || null,
    evidenceIds: uniq([
      ...asArray<string>(item?.evidenceIds),
      ...asArray<string>(item?.comparedEvidenceIds || item?.aiAnalyticalOutput?.comparedEvidenceIds),
      item?.evidenceId,
      item?.multimodalEvidence?.evidenceId,
      ...nodes.map((node) => node.evidenceId),
    ]),
    findingIds: uniq([
      ...asArray<string>(item?.findingIds),
      item?.findingId,
      ...nodes.map((node) => node.findingId),
    ]),
    analysisIds: uniq([
      ...asArray<string>(item?.analysisIds),
      item?.analysisId,
      item?.outputType === "ANALYSIS" ? item?.outputId : null,
      ...nodes.map((node) => node.analysisId),
    ]),
    assertionIds: uniq([
      ...asArray<string>(item?.assertionIds),
      item?.assertionId,
      item?.governedNarrativeAssertionId,
    ]),
    sourceItemIds: uniq([
      ...asArray<string>(item?.sourceItemIds),
      ...asArray<string>(item?.sourceIds),
      item?.sourceId,
      item?.sourceReference,
      item?.datasetId,
      item?.traceabilityReference,
    ]),
  };
}

function sourceClass(item: any): string {
  return String(
    item?.sourceStatus ||
    item?.sourceIntegrityStatus ||
    item?.sourceType ||
    item?.providerType ||
    item?.acquisitionMode ||
    item?.epistemicClass ||
    ""
  ).toUpperCase();
}

function acquisitionMode(item: any): InstitutionalVisualProduct["acquisitionMode"] {
  return String(item?.acquisitionMode || item?.epistemicIntegrity?.acquisitionMode || item?.epistemic?.acquisitionMode || "UNKNOWN").toUpperCase() as InstitutionalVisualProduct["acquisitionMode"];
}

function validationStatus(item: any): InstitutionalVisualProduct["validationStatus"] {
  return evaluateHumanValidation(item?.multimodalEvidence || item).status as InstitutionalVisualProduct["validationStatus"];
}

function integrityStatus(item: any): VisualIntegrityStatus {
  const integrity = item?.forensicIntegrity || item?.multimodalEvidence?.forensicIntegrity || item?.integrity;
  if (item?.corrupt === true || item?.corruptArtifact === true) return "CORRUPT_ARTIFACT";
  if (integrity?.hashStatus === "HASH_MISMATCH") return "HASH_MISMATCH";
  if (integrity?.mimeStatus === "MIME_MISMATCH") return "MIME_MISMATCH";
  if (integrity?.hashStatus === "HASH_UNAVAILABLE" || integrity?.hashStatus === "LEGACY_UNVERIFIED") return "WARNING";
  if (integrity) return "VALID";
  return "UNAVAILABLE";
}

function inferVisualType(item: any): InstitutionalVisualType {
  const raw = String(item?.visualType || item?.type || item?.kind || "").toUpperCase();
  if (item?.decorative === true || raw === "LOGO" || raw === "BRANDING") return "DECORATIVE_ASSET";
  if (raw.includes("STREET")) return "STREET_VIEW";
  if (raw.includes("TEMPORAL")) return "TEMPORAL_COMPARISON";
  if (raw.includes("CHART") || raw.includes("GRAPH")) return "CHART";
  if (raw.includes("DIAGRAM")) return "DIAGRAM";
  if (raw.includes("GIM") || raw.includes("PANDILLAS") || item?.validatedByACE != null) return "SPECIALIZED_INTELLIGENCE_VISUAL";
  if (raw.includes("MAP") || item?.mapId || item?.dataUrl && item?.geographyId) return "MAP";
  if (item?.evidenceId || item?.multimodalEvidence?.evidenceId || raw.includes("PHOTO")) return "PHOTO";
  return "OTHER";
}

function assetRef(item: any): string | null {
  return item?.assetRef || item?.storageReference || item?.rawContentReference || item?.dataUrl || item?.url || item?.imageUrl || item?.previewUrl || null;
}

function disclosure(item: any, code: string, message: string): PublicationDisclosure {
  return { itemId: visualId(item, inferVisualType(item)), itemType: "VISUAL_PRODUCT", code, message };
}

function exclusion(item: any, reasonCode: string, reason: string): PublicationExclusion {
  return { itemId: visualId(item, inferVisualType(item)), itemType: "VISUAL_PRODUCT", reasonCode, reason };
}

function captionFor(item: any, visualType: InstitutionalVisualType): string {
  const raw = String(item?.caption || item?.title || item?.description || "");
  const safe = raw
    .replace(/\bdemuestra\b/gi, "representa")
    .replace(/\bprueba\b/gi, "documenta")
    .replace(/\bcausa\b/gi, "se asocia con")
    .trim();
  if (safe) return safe;
  if (visualType === "MAP") return "Distribución espacial vinculada a geografía canónica.";
  if (visualType === "PHOTO") return "Vista registrada como evidencia visual.";
  if (visualType === "STREET_VIEW") return "Panorama registrado con identidad de captura.";
  if (visualType === "TEMPORAL_COMPARISON") return "Comparación entre evidencias visuales referenciadas.";
  if (visualType === "CHART") return "Gráfica derivada de fuente de datos declarada.";
  if (visualType === "SPECIALIZED_INTELLIGENCE_VISUAL") return "Visual especializado derivado de salida gobernada.";
  return "Producto visual contextual.";
}

export function assessVisualProductEligibility(item: any, options: {
  canonicalGeography?: CanonicalProjectGeography | null;
  critical?: boolean;
} = {}): VisualProductAssessment {
  const visualType = inferVisualType(item);
  const itemRefs = refs(item);
  const disclosures: PublicationDisclosure[] = [];
  const integrity = integrityStatus(item);
  const source = sourceClass(item);
  const mode = acquisitionMode(item);
  const canonicalGeography = options.canonicalGeography || null;

  if (source === "LEGACY_UNCLASSIFIED") disclosures.push(disclosure(item, "LEGACY_METADATA_PARTIAL", "Legacy visual lacks complete publication metadata."));
  if (source === "NON_AUTHORITATIVE") disclosures.push(disclosure(item, "NON_AUTHORITATIVE_SOURCE", "Visual source is contextual and non-authoritative."));
  if (source === "SIMULATED" || source === "MOCK" || mode === "SIMULATED" || mode === "MOCK") disclosures.push(disclosure(item, "SIMULATED_CONTEXT_ONLY", "Simulated visual cannot be presented as observed institutional visual."));
  if (mode === "AI_GENERATED") disclosures.push(disclosure(item, "AI_GENERATED", "AI visual interpretation must remain governed by narrative provenance."));
  if (integrity === "WARNING") disclosures.push(disclosure(item, "INTEGRITY_WARNING", "Visual integrity is not fully verified."));
  if (item?.derivedGeometry === true) disclosures.push(disclosure(item, "DERIVED_GEOMETRY", "Visual geometry is derived and must not replace canonical geography."));
  if (item?.partialTemporalCoverage === true) disclosures.push(disclosure(item, "PARTIAL_TEMPORAL_COVERAGE", "Temporal visual coverage is partial."));

  const hasLink = Boolean(itemRefs.geographyId || itemRefs.evidenceIds.length || itemRefs.findingIds.length || itemRefs.analysisIds.length || itemRefs.sourceItemIds.length);
  let failure: PublicationExclusion | undefined;

  if (integrity === "HASH_MISMATCH" || integrity === "MIME_MISMATCH" || integrity === "CORRUPT_ARTIFACT") {
    failure = exclusion(item, "CRITICAL_VISUAL_INTEGRITY_FAILURE", "Critical visual has hash, MIME, or artifact corruption failure.");
  } else if (visualType === "PHOTO" && !itemRefs.evidenceIds.length) {
    failure = exclusion(item, "PHOTO_WITHOUT_EVIDENCE_ID", "Photo visual requires governed evidence identity.");
  } else if (visualType === "STREET_VIEW" && (!itemRefs.evidenceIds.length || !itemRefs.geographyId)) {
    failure = exclusion(item, "STREET_VIEW_VISUAL_IDENTITY_INCOMPLETE", "Street View visual requires evidenceId and geographyId.");
  } else if (visualType === "TEMPORAL_COMPARISON" && itemRefs.evidenceIds.length < 2) {
    failure = exclusion(item, "TEMPORAL_VISUAL_REQUIRES_TWO_EVIDENCE_IDS", "Temporal comparison visual requires both evidence IDs.");
  } else if (visualType === "CHART" && !itemRefs.sourceItemIds.length) {
    failure = exclusion(item, "CHART_WITHOUT_DATASET_SOURCE", "Chart visual requires dataset or source reference.");
  } else if (visualType === "CHART" && (source === "SIMULATED" || mode === "SIMULATED")) {
    failure = exclusion(item, "SIMULATED_DATASET_CHART_NOT_INSTITUTIONAL", "Simulated dataset chart cannot be presented as observed institutional chart.");
  } else if (visualType === "SPECIALIZED_INTELLIGENCE_VISUAL" && (item?.validatedByACE !== true || !item?.traceabilityReference)) {
    failure = exclusion(item, "SPECIALIZED_VISUAL_NOT_CERTIFIED_PAYLOAD", "Pandillas/GIM visual requires governed certified payload.");
  } else if (visualType !== "DECORATIVE_ASSET" && !hasLink && item?.contextual !== true) {
    failure = exclusion(item, "ORPHAN_VISUAL_PRODUCT", "Visual product has no resolvable evidence, finding, analysis, geography, or source relation.");
  } else if (options.critical === true && source === "LEGACY_UNCLASSIFIED") {
    failure = exclusion(item, "CRITICAL_LEGACY_VISUAL_UNCLASSIFIED", "Critical legacy visual cannot enter institutional report without metadata.");
  }

  if (visualType === "MAP" && canonicalGeography?.geographyId && itemRefs.geographyId && itemRefs.geographyId !== canonicalGeography.geographyId) {
    failure = exclusion(item, "MAP_GEOGRAPHY_CONFLICT", "Map geographyId conflicts with canonical project geography.");
  }

  return {
    visualId: visualId(item, visualType),
    visualType,
    publicationEligibility: failure ? "INELIGIBLE" : disclosures.length ? "ELIGIBLE_WITH_DISCLOSURE" : "ELIGIBLE",
    disclosures,
    exclusion: failure,
    lineageRefs: itemRefs,
  };
}

export function buildInstitutionalVisualProduct(item: any, options: {
  canonicalGeography?: CanonicalProjectGeography | null;
  critical?: boolean;
} = {}): InstitutionalVisualProduct {
  const assessment = assessVisualProductEligibility(item, options);
  const visualType = assessment.visualType;
  const canonicalGeography = options.canonicalGeography || null;
  const useCanonicalMapGeometry = visualType === "MAP" && Boolean(canonicalGeography?.geographyId);
  const itemRefs = assessment.lineageRefs;

  return {
    id: assessment.visualId,
    visualId: assessment.visualId,
    visualType,
    kind: item?.kind || item?.type || null,
    title: String(item?.title || item?.name || visualType),
    caption: captionFor(item, visualType),
    sourceType: String(item?.sourceType || item?.sourceStatus || item?.providerType || item?.sourceReference || "UNAVAILABLE"),
    sourceItemIds: itemRefs.sourceItemIds,
    geographyId: useCanonicalMapGeometry ? canonicalGeography?.geographyId : itemRefs.geographyId,
    geographyType: useCanonicalMapGeometry ? canonicalGeography?.type : item?.geographyType ?? null,
    geometryType: useCanonicalMapGeometry ? canonicalGeography?.geometry.type : item?.geometryType ?? null,
    evidenceIds: itemRefs.evidenceIds,
    findingIds: itemRefs.findingIds,
    analysisIds: itemRefs.analysisIds,
    assertionIds: itemRefs.assertionIds,
    acquisitionMode: acquisitionMode(item),
    validationStatus: validationStatus(item),
    integrityStatus: integrityStatus(item),
    lineageStatus: lineageStatusOf(item),
    publicationEligibility: assessment.publicationEligibility,
    disclosureCodes: assessment.disclosures.map((item) => item.code),
    exclusionReason: assessment.exclusion?.reasonCode || null,
    assetRef: assetRef(item),
    generatedAt: item?.generatedAt || item?.createdAt || null,
    datasetSourceRefs: uniq([...asArray<string>(item?.datasetSourceRefs), item?.datasetId, item?.datasetSource, item?.sourceReference]),
    variables: uniq([...asArray<string>(item?.variables), item?.variable]),
    transformation: item?.transformation || item?.aggregation || null,
    relationKind: item?.relationKind || null,
    decorative: visualType === "DECORATIVE_ASSET",
    certified: false,
  };
}

export function buildGovernedVisualProducts(items: any[], options: {
  canonicalGeography?: CanonicalProjectGeography | null;
  draft?: boolean;
} = {}): {
  visualProducts: InstitutionalVisualProduct[];
  exclusions: PublicationExclusion[];
  disclosures: PublicationDisclosure[];
} {
  const exclusions: PublicationExclusion[] = [];
  const disclosures: PublicationDisclosure[] = [];
  const visualProducts: InstitutionalVisualProduct[] = [];

  for (const item of items) {
    const product = buildInstitutionalVisualProduct(item, { canonicalGeography: options.canonicalGeography });
    const assessment = assessVisualProductEligibility(item, { canonicalGeography: options.canonicalGeography });
    disclosures.push(...assessment.disclosures);
    if (assessment.exclusion) exclusions.push(assessment.exclusion);
    if (product.publicationEligibility !== "INELIGIBLE" || options.draft === true) {
      visualProducts.push(product);
    }
  }

  return { visualProducts, exclusions, disclosures };
}
