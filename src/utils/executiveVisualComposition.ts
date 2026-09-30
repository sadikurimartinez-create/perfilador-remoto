import type { InstitutionalReportInput, PublicationItemType } from "@/utils/institutionalReportPublicationContract";
import type {
  ExecutiveEvidenceItem,
  ExecutiveFinding,
  ExecutiveGeointReportModel,
  ExecutiveVisualCandidate,
} from "@/utils/executiveGeointReportModel";
import type { ExecutiveCanonicalTerritorialMapSpec } from "@/utils/executiveCanonicalTerritorialMap";
import type { GovernedCartographicScale } from "@/utils/governedCartographicScale";
import { DENUE_ANALYTICAL_DOCUMENT_KIND } from "@/utils/denueAnalyticalDocumentIntegration";
import {
  getCanonicalMapViewport,
  type CanonicalGeometry,
  type CanonicalProjectGeography,
  type LatLngPoint,
} from "@/utils/canonicalProjectGeography";

export const MAX_EXECUTIVE_VISUALS = 5;

export type ExecutiveSecondaryVisualType =
  | "EVIDENCE_IMAGE"
  | "FIELD_PHOTOGRAPH"
  | "STREET_VIEW_CAPTURE"
  | "TEMPORAL_COMPARISON"
  | "MULTISOURCE_CONVERGENCE"
  | "TREND_VISUAL"
  | "PROSPECTIVE_SCENARIO"
  | "STATISTICAL_CHART"
  | "INFOGRAPHIC"
  | "SECONDARY_MAP";

export type ExecutiveVisualExclusionReasonCode =
  | "NO_TRACEABILITY"
  | "NO_EXECUTIVE_RELATION"
  | "NO_VISUAL_REFERENCE"
  | "GEOGRAPHY_MISMATCH"
  | "DUPLICATE"
  | "VISUAL_BUDGET_EXCEEDED"
  | "CONTEXT_ONLY"
  | "MAP_RENDER_REQUIRED"
  | "LOW_EXECUTIVE_VALUE";

export type TerritorialMapStatus = "READY_FROM_GOVERNED_VISUAL" | "MAP_RENDER_REQUIRED" | "NO_CANONICAL_GEOGRAPHY";

export interface ExecutiveTerritorialMap {
  mapId: string;
  status: TerritorialMapStatus;
  executiveHeadline: string;
  caption: string;
  renderInstruction: "USE_GOVERNED_VISUAL" | "MAP_RENDER_REQUIRED" | "CANONICAL_GEOGRAPHY_REQUIRED";
  visualReference?: string | null;
  presentation: {
    title: string;
    visibleSourceLabel: string | null;
    cartographicMetadata?: {
      geometryLabel: string;
      legendLabel: string | null;
      scaleLabel: string | null;
      orientationLabel: string | null;
    };
  };
  technicalMetadata: {
    geographyId?: string | null;
    geometry?: CanonicalGeometry | null;
    geographyType?: CanonicalProjectGeography["type"] | "MULTIPOLYGON" | null;
    bounds?: CanonicalProjectGeography["derived"] extends infer D
      ? D extends { bounds?: infer B }
        ? B
        : never
      : never;
    center?: LatLngPoint | null;
    fitMode?: "CENTER" | "BOUNDS";
    cartographicScale?: GovernedCartographicScale | null;
    traceabilityIds: string[];
    relatedFindingIds: string[];
    relatedEvidenceIds: string[];
    sourceItemId?: string | null;
  };
}

export interface ExecutiveSecondaryVisual {
  visualId: string;
  visualType: ExecutiveSecondaryVisualType;
  executiveHeadline: string;
  caption: string;
  visualReference: string;
  presentation: {
    title: string;
    visibleSourceLabel: string | null;
  };
  technicalMetadata: {
    sourceItemId: string;
    sourceType: PublicationItemType | "VISUAL_CANDIDATE" | "KEY_EVIDENCE";
    geographyId?: string | null;
    traceabilityIds: string[];
    relatedFindingIds: string[];
    relatedEvidenceIds: string[];
  };
}

export interface ExecutiveVisualSelectionAudit {
  selectedIds: string[];
  excludedItems: Array<{
    itemId: string;
    itemType: string;
    reasonCode: ExecutiveVisualExclusionReasonCode;
    reason: string;
  }>;
  reasonCodes: ExecutiveVisualExclusionReasonCode[];
  visualBudgetUsed: number;
  visualBudgetMaximum: typeof MAX_EXECUTIVE_VISUALS;
  territorialMapStatus: TerritorialMapStatus;
}

export interface ExecutiveVisualComposition {
  principalTerritorialMap: ExecutiveTerritorialMap;
  secondaryVisuals: ExecutiveSecondaryVisual[];
  visualBudget: {
    minimumFunctional: 1;
    maximumOrdinary: typeof MAX_EXECUTIVE_VISUALS;
    used: number;
    secondaryMaximum: 4;
    filledArtificially: false;
  };
  selectionAudit: ExecutiveVisualSelectionAudit;
  technicalMetadata: {
    source: "ExecutiveGeointReportModel+InstitutionalReportInput";
    deterministic: true;
    rendersFinalAssets: false;
    externalCalls: false;
  };
}

interface Candidate {
  id: string;
  kind: "KEY_EVIDENCE" | "VISUAL_CANDIDATE" | "INPUT_VISUAL_PRODUCT";
  visualType: ExecutiveSecondaryVisualType | "MAP";
  title: string;
  summary: string;
  reference: string;
  traceabilityIds: string[];
  relatedFindingIds: string[];
  relatedEvidenceIds: string[];
  sourceType: PublicationItemType | "VISUAL_CANDIDATE" | "KEY_EVIDENCE";
  geographyId?: string | null;
  sourceItemId: string;
  score: number;
  originalIndex: number;
  explicitVisibleSourceLabel: string;
  datasetSourceRefs?: string[];
  variables?: string[];
  transformation?: string;
  chartKind?: string;
  publicationEligibility?: string;
  governedAnalyticalMap?: boolean;
}

interface PrincipalMapCandidate {
  id: string;
  title: string;
  summary: string;
  visualType: string;
  reference: string;
  traceabilityIds: string[];
  relatedFindingIds: string[];
  relatedEvidenceIds: string[];
  sourceItemId: string;
  explicitGeographyIds: string[];
  visibleSourceLabel: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function itemId(item: any, fallback: string): string {
  return clean(item?.visualId || item?.evidenceId || item?.id || item?.sourceItemId || item?.productId || fallback);
}

function traceabilityIds(item: any): string[] {
  return dedupe([
    ...(asArray<string>(item?.traceabilityIds)),
    item?.traceabilityId,
    item?.technicalMetadata?.traceabilityId,
    ...(asArray<any>(item?.lineage).map((node) => node?.traceabilityId)),
  ]);
}

function explicitGeographyIds(item: any): string[] {
  return dedupe([
    item?.geographyId,
    item?.canonicalGeographyId,
    item?.technicalMetadata?.geographyId,
    item?.technicalMetadata?.canonicalGeographyId,
    item?.technicalMetadata?.sourceGeographyId,
    ...(asArray<any>(item?.lineage).map((node) => node?.geographyId || node?.canonicalGeographyId)),
  ]);
}

function relatedFindingIds(item: any): string[] {
  return dedupe([
    ...(asArray<string>(item?.relatedFindingIds)),
    ...(asArray<string>(item?.findingIds)),
    item?.findingId,
    item?.technicalMetadata?.sourceFindingId,
  ]);
}

function relatedEvidenceIds(item: any): string[] {
  return dedupe([
    ...(asArray<string>(item?.relatedEvidenceIds)),
    ...(asArray<string>(item?.evidenceReferences)),
    ...(asArray<string>(item?.evidenceIds)),
    item?.evidenceId,
    item?.technicalMetadata?.sourceItemId,
  ]);
}

function visualReference(item: any): string {
  return clean(item?.visualReference || item?.reference || item?.assetRef || item?.dataUrl || item?.imageUrl || item?.previewUrl || item?.url);
}

function explicitVisibleSourceLabel(item: any): string {
  const label = clean(item?.presentation?.visibleSourceLabel || item?.visibleSourceLabel || item?.sourceLabel);
  if (!label || /https?:\/\/|blob:|data:|gs:\/\/|storagePath|[A-Za-z]:\\|\[object Object\]/i.test(label)) return "";
  return label;
}

function visibleSourceLabel(candidate: Pick<Candidate, "visualType" | "explicitVisibleSourceLabel">): string | null {
  if (candidate.explicitVisibleSourceLabel) return candidate.explicitVisibleSourceLabel;
  if (candidate.visualType === "STREET_VIEW_CAPTURE") return "Google Street View";
  if (candidate.visualType === "FIELD_PHOTOGRAPH") return "Fotografía de campo";
  return null;
}

function classifyVisualType(item: any): ExecutiveSecondaryVisualType | "MAP" {
  const raw = clean(item?.visualType || item?.type || item?.kind || item?.technicalMetadata?.originalItemType).toUpperCase();
  const provenance = [
    item?.sourceType,
    item?.sourceProvider,
    item?.provider,
    item?.technicalMetadata?.sourceType,
    ...(asArray<string>(item?.sourceTypes)),
  ].map(clean).join(" ").toUpperCase();
  const title = clean(item?.title).toUpperCase();
  if (
    raw === "ANALYTICAL_DENUE_MAP" &&
    clean(item?.documentIntegrationKind || item?.technicalMetadata?.documentIntegrationKind) === "DENUE_ANALYTICAL_B6G"
  ) return "SECONDARY_MAP";
  if (raw.includes("MAP") || raw.includes("MAPA")) return "MAP";
  if (raw.includes("TEMPORAL")) return "TEMPORAL_COMPARISON";
  if (raw.includes("CONVERGENCE") || raw.includes("MULTISOURCE") || raw.includes("MULTIFUENTE")) return "MULTISOURCE_CONVERGENCE";
  if (raw.includes("TREND") || raw.includes("TENDENCIA")) return "TREND_VISUAL";
  if (raw.includes("PROSPECT") || raw.includes("ESCENARIO")) return "PROSPECTIVE_SCENARIO";
  if (raw.includes("CHART") || raw.includes("GRAPH") || raw.includes("GRAF")) return "STATISTICAL_CHART";
  if (raw.includes("INFOGRAPH") || raw.includes("INFOGRAF")) return "INFOGRAPHIC";
  if (raw.includes("STREET_VIEW") || provenance.includes("STREET_VIEW")) return "STREET_VIEW_CAPTURE";
  if (raw.includes("FIELD_PHOTO") || provenance.includes("FIELD_PHOTO") || provenance.includes("FIELD_CAPTURE")) return "FIELD_PHOTOGRAPH";
  if (raw.includes("PHOTO") || raw.includes("EVIDENCE") || title.includes("FOTOGRAF")) return "EVIDENCE_IMAGE";
  return "EVIDENCE_IMAGE";
}

function visibleGeometryLabel(geography: CanonicalProjectGeography): string {
  if (geography.type === "INDIVIDUAL") return "Punto territorial individual";
  if (geography.type === "CORRIDOR") return "Corredor territorial";
  return "Polígono territorial";
}

function generatedMapLegend(geography: CanonicalProjectGeography): string {
  if (geography.type === "INDIVIDUAL") return "Marcador A: ubicación territorial de referencia";
  if (geography.type === "CORRIDOR") return "Trazo azul: corredor territorial analizado";
  return "Contorno azul: polígono territorial analizado";
}

function isProspectiveAllowed(candidate: Candidate, model: ExecutiveGeointReportModel): boolean {
  const productIds = model.prospectiveAnalysis.technicalMetadata.sourceProductIds;
  if (!productIds.length) return false;
  if (productIds.includes(candidate.sourceItemId)) return true;
  return candidate.traceabilityIds.some((id) => model.prospectiveAnalysis.traceabilityIds.includes(id));
}

function headlineFromFinding(findings: ExecutiveFinding[], relatedIds: string[]): string {
  const finding = findings.find((item) => relatedIds.includes(item.findingId));
  return clean(finding?.title) || clean(finding?.summary) || "CONFIGURACIÓN TERRITORIAL DEL ÁREA ANALIZADA";
}

function duplicateKey(candidate: Candidate): string {
  if (
    candidate.visualType === "STATISTICAL_CHART" &&
    clean(candidate.chartKind)
  ) {
    return `${candidate.visualType}:${clean(candidate.chartKind)}:${candidate.id}`;
  }

  return `${candidate.visualType}:${candidate.reference || candidate.sourceItemId || candidate.id}`;
}

function geometryType(geography: CanonicalProjectGeography | null): CanonicalProjectGeography["type"] | "MULTIPOLYGON" | null {
  if (!geography) return null;
  if (geography.geometry.type === "MultiPolygon") return "MULTIPOLYGON";
  return geography.type;
}

function sourceVisualProductsForCandidate(candidate: any, institutionalInput: InstitutionalReportInput): any[] {
  const id = itemId(candidate, "");
  const sourceItemId = clean(candidate?.technicalMetadata?.sourceItemId || candidate?.sourceItemId);
  const reference = visualReference(candidate);
  return institutionalInput.visualProducts.filter((item: any) => {
    const visualProductId = itemId(item, "");
    return Boolean(
      (id && visualProductId === id) ||
      (sourceItemId && visualProductId === sourceItemId) ||
      (reference && visualReference(item) === reference)
    );
  });
}

function toPrincipalMapCandidate(item: any, institutionalInput: InstitutionalReportInput): PrincipalMapCandidate | null {
  const visualType = clean(item?.visualType || item?.type || item?.kind).toUpperCase();
  if (!visualType.includes("MAP") && !visualType.includes("MAPA")) return null;
  const sourceProducts = sourceVisualProductsForCandidate(item, institutionalInput);
  // B.6G and its projections remain secondary; the principal retains B.5/canonical geography.
  if ([item, ...sourceProducts].some((visual) =>
    clean(visual?.visualType || visual?.type || visual?.kind).toUpperCase() === "ANALYTICAL_DENUE_MAP" ||
    visual?.documentIntegrationKind === DENUE_ANALYTICAL_DOCUMENT_KIND ||
    visual?.technicalMetadata?.documentIntegrationKind === DENUE_ANALYTICAL_DOCUMENT_KIND
  )) return null;
  const reference = visualReference(item);
  const traces = traceabilityIds(item);
  if (!reference || !traces.length) return null;
  return {
    id: itemId(item, "principal-map-candidate"),
    title: clean(item?.title || item?.caption),
    summary: clean(item?.summary || item?.caption || item?.description),
    visualType,
    reference,
    traceabilityIds: traces,
    relatedFindingIds: relatedFindingIds(item),
    relatedEvidenceIds: relatedEvidenceIds(item),
    sourceItemId: clean(item?.technicalMetadata?.sourceItemId || item?.sourceItemId || itemId(item, "principal-map-candidate")),
    explicitGeographyIds: dedupe([
      ...explicitGeographyIds(item),
      ...sourceProducts.flatMap(explicitGeographyIds),
    ]),
    visibleSourceLabel: explicitVisibleSourceLabel(item) || sourceProducts.map(explicitVisibleSourceLabel).find(Boolean) || "",
  };
}

function selectCompatiblePrincipalMapCandidate(
  model: ExecutiveGeointReportModel,
  institutionalInput: InstitutionalReportInput,
  geography: CanonicalProjectGeography,
  excludedItems: ExecutiveVisualSelectionAudit["excludedItems"]
): PrincipalMapCandidate | null {
  const rawCandidates = [
    model.territorialSituation.principalMapCandidate,
    ...model.visualCandidates,
    ...institutionalInput.visualProducts,
  ];
  for (const rawCandidate of rawCandidates) {
    const candidate = toPrincipalMapCandidate(rawCandidate, institutionalInput);
    if (!candidate) continue;
    if (!candidate.explicitGeographyIds.length) {
      excludedItems.push({
        itemId: candidate.id,
        itemType: "TERRITORIAL_MAP",
        reasonCode: "MAP_RENDER_REQUIRED",
        reason: "Map visual excluded because no verifiable geographyId linked it to CanonicalProjectGeography.",
      });
      continue;
    }
    if (!candidate.explicitGeographyIds.includes(geography.geographyId)) {
      excludedItems.push({
        itemId: candidate.id,
        itemType: "TERRITORIAL_MAP",
        reasonCode: "GEOGRAPHY_MISMATCH",
        reason: "Map visual excluded because its explicit geographyId does not match the canonical project geography.",
      });
      continue;
    }
    return candidate;
  }
  return null;
}

function buildPrincipalMap(
  model: ExecutiveGeointReportModel,
  institutionalInput: InstitutionalReportInput,
  excludedItems: ExecutiveVisualSelectionAudit["excludedItems"],
  principalMapSpec?: ExecutiveCanonicalTerritorialMapSpec | null
): ExecutiveTerritorialMap {
  const geography = model.territorialSituation.canonicalGeography || institutionalInput.geography || null;
  if (!geography) {
    excludedItems.push({
      itemId: "principalTerritorialMap",
      itemType: "TERRITORIAL_MAP",
      reasonCode: "MAP_RENDER_REQUIRED",
      reason: "CanonicalProjectGeography is required before rendering the principal territorial map.",
    });
    return {
      mapId: "principal-territorial-map",
      status: "NO_CANONICAL_GEOGRAPHY",
      executiveHeadline: "CONFIGURACIÓN TERRITORIAL DEL ÁREA ANALIZADA",
      caption: "Geografia canonica no disponible para renderizado.",
      renderInstruction: "CANONICAL_GEOGRAPHY_REQUIRED",
      visualReference: null,
      presentation: {
        title: "CONFIGURACIÓN TERRITORIAL DEL ÁREA ANALIZADA",
        visibleSourceLabel: null,
      },
      technicalMetadata: {
        geographyId: null,
        geometry: null,
        geographyType: null,
        center: null,
        traceabilityIds: [],
        relatedFindingIds: [],
        relatedEvidenceIds: [],
        sourceItemId: null,
      },
    };
  }

  const viewport = getCanonicalMapViewport(geography);
  const mapCandidate = selectCompatiblePrincipalMapCandidate(model, institutionalInput, geography, excludedItems);
  const relatedFindingIds = dedupe([
    ...(mapCandidate?.relatedFindingIds || []),
  ]);
  const mapRelatedEvidenceIds = dedupe([
    ...(mapCandidate ? relatedEvidenceIds(mapCandidate) : []),
    ...model.keyEvidence.flatMap((item) => item.evidenceReferences).slice(0, 8),
  ]);
  const traces = dedupe([
    ...(mapCandidate?.traceabilityIds || []),
    ...model.findings.filter((finding) => relatedFindingIds.includes(finding.findingId)).flatMap((finding) => finding.traceabilityIds),
  ]);

  if (!mapCandidate) {
    excludedItems.push({
      itemId: "principalTerritorialMap",
      itemType: "TERRITORIAL_MAP",
      reasonCode: "MAP_RENDER_REQUIRED",
      reason: "No governed map visual was available; renderer must use CanonicalProjectGeography.",
    });
  }

  const headline = headlineFromFinding(model.findings, relatedFindingIds);
  const governedScale = !mapCandidate
    && principalMapSpec?.technicalMetadata.geographyId === geography.geographyId
    ? principalMapSpec.cartographicScale
    : null;
  return {
    mapId: "principal-territorial-map",
    status: mapCandidate ? "READY_FROM_GOVERNED_VISUAL" : "MAP_RENDER_REQUIRED",
    executiveHeadline: headline,
    caption: mapCandidate?.summary || "Representación territorial derivada de la geografía canónica.",
    renderInstruction: mapCandidate ? "USE_GOVERNED_VISUAL" : "MAP_RENDER_REQUIRED",
    visualReference: mapCandidate?.reference || null,
    presentation: {
      title: headline,
      visibleSourceLabel: mapCandidate?.visibleSourceLabel || (mapCandidate ? null : "Google Maps; geografía canónica del expediente"),
      cartographicMetadata: {
        geometryLabel: visibleGeometryLabel(geography),
        legendLabel: mapCandidate
          ? null
          : principalMapSpec?.legend
            ? [
                generatedMapLegend(geography),
                principalMapSpec.legend.canonicalGeometry,
                principalMapSpec.legend.denueContext,
                principalMapSpec.legend.interpretationLimit,
                principalMapSpec.legend.countStatement,
              ].join(" ")
            : generatedMapLegend(geography),
        scaleLabel: governedScale?.label ?? null,
        orientationLabel: null,
      },
    },
    technicalMetadata: {
      geographyId: geography.geographyId,
      geometry: geography.geometry,
      geographyType: geometryType(geography),
      bounds: viewport.bounds,
      center: viewport.center ?? null,
      fitMode: viewport.fitMode,
      cartographicScale: governedScale,
      traceabilityIds: traces,
      relatedFindingIds,
      relatedEvidenceIds: mapRelatedEvidenceIds,
      sourceItemId: mapCandidate?.sourceItemId || null,
    },
  };
}

function candidateFromKeyEvidence(item: ExecutiveEvidenceItem, index: number): Candidate {
  return {
    id: item.evidenceId,
    kind: "KEY_EVIDENCE",
    visualType: classifyVisualType(item),
    title: item.title,
    summary: item.summary,
    reference: visualReference(item),
    traceabilityIds: item.traceabilityIds,
    relatedFindingIds: item.relatedFindingIds,
    relatedEvidenceIds: item.evidenceReferences,
    sourceType: "KEY_EVIDENCE",
    sourceItemId: item.technicalMetadata.sourceItemId,
    score: 70 - index,
    originalIndex: index,
    explicitVisibleSourceLabel: explicitVisibleSourceLabel(item),
  };
}

function candidateFromVisual(item: ExecutiveVisualCandidate, index: number): Candidate {
  return {
    id: item.visualId,
    kind: "VISUAL_CANDIDATE",
    visualType: classifyVisualType(item),
    title: item.title,
    summary: item.summary,
    reference: visualReference(item),
    traceabilityIds: item.traceabilityIds,
    relatedFindingIds: item.relatedFindingIds,
    relatedEvidenceIds: relatedEvidenceIds(item),
    sourceType: item.technicalMetadata.sourceType,
    sourceItemId: item.technicalMetadata.sourceItemId,
    score: 60 - index,
    originalIndex: index,
    explicitVisibleSourceLabel: explicitVisibleSourceLabel(item),
  };
}

function candidateFromInputVisual(item: any, index: number): Candidate {
  const sourceTraceabilityIds = dedupe([
    ...asArray<string>(item?.sourceItemIds),
    ...asArray<string>(item?.datasetSourceRefs),
  ]);

  const candidate: Candidate = {
    id: itemId(item, `input-visual-${index + 1}`),
    kind: "INPUT_VISUAL_PRODUCT",
    visualType: classifyVisualType(item),
    title: clean(item?.title || item?.caption || `Visual gobernado ${index + 1}`),
    summary: clean(item?.caption || item?.summary || item?.description || "Visual gobernado sin sintesis disponible."),
    reference: visualReference(item),
    traceabilityIds: dedupe([
      ...traceabilityIds(item),
      ...sourceTraceabilityIds,
    ]),
    relatedFindingIds: relatedFindingIds(item),
    relatedEvidenceIds: relatedEvidenceIds(item),
    sourceType: "VISUAL_PRODUCT",
    geographyId: clean(item?.geographyId) || null,
    sourceItemId: itemId(item, `input-visual-${index + 1}`),
    score: 40 - index,
    originalIndex: index,
    explicitVisibleSourceLabel: explicitVisibleSourceLabel(item),
    datasetSourceRefs: dedupe([
      ...asArray<string>(item?.datasetSourceRefs),
      ...asArray<string>(item?.sourceItemIds),
    ]),
    variables: dedupe(asArray<string>(item?.variables)),
    transformation: clean(item?.transformation),
    chartKind: clean(item?.kind),
    publicationEligibility: clean(item?.publicationEligibility),
    governedAnalyticalMap:
      clean(item?.visualType).toUpperCase() === "ANALYTICAL_DENUE_MAP" &&
      clean(item?.documentIntegrationKind || item?.technicalMetadata?.documentIntegrationKind) === "DENUE_ANALYTICAL_B6G",
  };

  if (isGovernedDescriptiveStatisticalChart(candidate)) {
    candidate.score = 300 - index;
  } else if (candidate.governedAnalyticalMap) {
    candidate.score = 200;
  }

  return candidate;
}

function isGovernedDescriptiveStatisticalChart(candidate: Candidate): boolean {
  const eligible =
    candidate.publicationEligibility === "ELIGIBLE" ||
    candidate.publicationEligibility === "ELIGIBLE_WITH_DISCLOSURE";

  return (
    candidate.kind === "INPUT_VISUAL_PRODUCT" &&
    candidate.visualType === "STATISTICAL_CHART" &&
    eligible &&
    Boolean(candidate.reference) &&
    Boolean(candidate.datasetSourceRefs?.length) &&
    Boolean(candidate.variables?.length) &&
    Boolean(clean(candidate.transformation))
  );
}

function relationScore(candidate: Candidate, priorityFindingIds: string[], decisionFindingLabels: string[]): number {
  const supportsFinding = candidate.relatedFindingIds.some((id) => priorityFindingIds.includes(id));
  const supportsDecision = decisionFindingLabels.some((label) => label && candidate.title.includes(label));
  return (supportsFinding ? 30 : 0) + (supportsDecision ? 10 : 0);
}

function validateCandidate(
  candidate: Candidate,
  model: ExecutiveGeointReportModel,
  selected: Candidate[],
  duplicateKeys: Set<string>
): ExecutiveVisualExclusionReasonCode | null {
  if (!candidate.traceabilityIds.length) return "NO_TRACEABILITY";
  if (!candidate.reference) return "NO_VISUAL_REFERENCE";
  if (duplicateKeys.has(duplicateKey(candidate))) return "DUPLICATE";
  if (candidate.visualType === "MAP") return "LOW_EXECUTIVE_VALUE";
  if (candidate.visualType === "SECONDARY_MAP" && !candidate.governedAnalyticalMap) return "LOW_EXECUTIVE_VALUE";
  if (candidate.visualType === "PROSPECTIVE_SCENARIO" && !isProspectiveAllowed(candidate, model)) return "CONTEXT_ONLY";
  const priorityFindingIds = model.findings.map((finding) => finding.findingId);
  const referencedByKeyEvidence =
    candidate.kind !== "KEY_EVIDENCE" &&
    candidate.relatedEvidenceIds.some((id) =>
      model.keyEvidence.some((item) => item.evidenceReferences.includes(id) || item.evidenceId === id)
    );
  const hasRelation =
    candidate.relatedFindingIds.some((id) => priorityFindingIds.includes(id)) ||
    referencedByKeyEvidence ||
    candidate.visualType === "MULTISOURCE_CONVERGENCE" ||
    candidate.visualType === "TEMPORAL_COMPARISON" ||
    candidate.visualType === "TREND_VISUAL" ||
    candidate.visualType === "PROSPECTIVE_SCENARIO" ||
    candidate.governedAnalyticalMap === true ||
    isGovernedDescriptiveStatisticalChart(candidate);

  if (!hasRelation) return "NO_EXECUTIVE_RELATION";

  const sameType = selected.filter(
    (item) => item.visualType === candidate.visualType
  );

  if (
    candidate.visualType === "STATISTICAL_CHART" &&
    isGovernedDescriptiveStatisticalChart(candidate)
  ) {
    const chartKind = clean(candidate.chartKind);
    const duplicateChartKind = sameType.some(
      (item) => clean(item.chartKind) === chartKind
    );

    if (
      !chartKind ||
      duplicateChartKind ||
      sameType.length >= 2
    ) {
      return "LOW_EXECUTIVE_VALUE";
    }

    return null;
  }

  if (
    sameType.length >= 2 &&
    candidate.visualType === "EVIDENCE_IMAGE"
  ) {
    return "LOW_EXECUTIVE_VALUE";
  }

  if (
    sameType.length >= 1 &&
    candidate.visualType !== "EVIDENCE_IMAGE"
  ) {
    return "LOW_EXECUTIVE_VALUE";
  }

  return null;
}

function exclusionReason(code: ExecutiveVisualExclusionReasonCode): string {
  const reasons: Record<ExecutiveVisualExclusionReasonCode, string> = {
    NO_TRACEABILITY: "Visual excluded because no traceability identifiers were preserved.",
    NO_EXECUTIVE_RELATION: "Visual excluded because it does not support a priority finding, relation, contradiction, temporal evolution, governed scenario, or existing decision.",
    NO_VISUAL_REFERENCE: "Visual excluded because no usable visual reference was available.",
    GEOGRAPHY_MISMATCH: "Visual excluded because its explicit geography does not match CanonicalProjectGeography.",
    DUPLICATE: "Visual excluded because an equivalent visual was already selected.",
    VISUAL_BUDGET_EXCEEDED: "Visual excluded because the executive visual budget was reached.",
    CONTEXT_ONLY: "Visual excluded because it is contextual and not admissible for executive visual selection.",
    MAP_RENDER_REQUIRED: "Principal map requires rendering from CanonicalProjectGeography.",
    LOW_EXECUTIVE_VALUE: "Visual excluded by deterministic diversity or executive value rules.",
  };
  return reasons[code];
}

function toSecondaryVisual(candidate: Candidate, model: ExecutiveGeointReportModel): ExecutiveSecondaryVisual {
  const headline = isGovernedDescriptiveStatisticalChart(candidate)
    ? candidate.title
    : headlineFromFinding(model.findings, candidate.relatedFindingIds);
  const type = candidate.visualType === "MAP" ? "SECONDARY_MAP" : candidate.visualType;
  return {
    visualId: candidate.id,
    visualType: type,
    executiveHeadline: headline,
    caption: candidate.summary || headline,
    visualReference: candidate.reference,
    presentation: {
      title: headline,
      visibleSourceLabel: visibleSourceLabel({ visualType: type, explicitVisibleSourceLabel: candidate.explicitVisibleSourceLabel }),
    },
    technicalMetadata: {
      sourceItemId: candidate.sourceItemId,
      sourceType: candidate.sourceType,
      geographyId: candidate.geographyId ?? null,
      traceabilityIds: candidate.traceabilityIds,
      relatedFindingIds: candidate.relatedFindingIds,
      relatedEvidenceIds: candidate.relatedEvidenceIds,
    },
  };
}

export function buildExecutiveVisualComposition(
  executiveModel: ExecutiveGeointReportModel,
  institutionalInput: InstitutionalReportInput,
  options: { maxVisuals?: number; principalMapSpec?: ExecutiveCanonicalTerritorialMapSpec | null } = {}
): ExecutiveVisualComposition {
  const maxVisuals = Math.min(Math.max(1, options.maxVisuals ?? MAX_EXECUTIVE_VISUALS), MAX_EXECUTIVE_VISUALS);
  const excludedItems: ExecutiveVisualSelectionAudit["excludedItems"] = [];
  const principalTerritorialMap = buildPrincipalMap(executiveModel, institutionalInput, excludedItems, options.principalMapSpec);
  const secondaryBudget = Math.max(0, maxVisuals - 1);
  const priorityFindingIds = executiveModel.findings.map((finding) => finding.findingId);
  const decisionLabels = executiveModel.decisionImplications.map((decision) => decision.hallazgoRelacionado);
  const inputVisualIds = new Set(
    institutionalInput.visualProducts
      .map((item) => itemId(item, ""))
      .filter(Boolean)
  );
  const inputVisualReferences = new Set(
    institutionalInput.visualProducts
      .map(visualReference)
      .filter(Boolean)
  );
  const candidates = [
    ...executiveModel.keyEvidence.map(candidateFromKeyEvidence),
    ...executiveModel.visualCandidates
      .filter((item) => {
        const id = itemId(item, "");
        const reference = visualReference(item);

        return !(
          (id && inputVisualIds.has(id)) ||
          (reference && inputVisualReferences.has(reference))
        );
      })
      .map(candidateFromVisual),
    ...institutionalInput.visualProducts.map(candidateFromInputVisual),
  ].map((candidate) => ({
    ...candidate,
    score: candidate.score + relationScore(candidate, priorityFindingIds, decisionLabels),
  })).sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex || a.id.localeCompare(b.id));

  const selected: Candidate[] = [];
  const duplicateKeys = new Set<string>();
  for (const candidate of candidates) {
    const reason = validateCandidate(candidate, executiveModel, selected, duplicateKeys);
    if (reason) {
      excludedItems.push({ itemId: candidate.id, itemType: candidate.visualType, reasonCode: reason, reason: exclusionReason(reason) });
      continue;
    }
    if (selected.length >= secondaryBudget) {
      excludedItems.push({ itemId: candidate.id, itemType: candidate.visualType, reasonCode: "VISUAL_BUDGET_EXCEEDED", reason: exclusionReason("VISUAL_BUDGET_EXCEEDED") });
      continue;
    }
    selected.push(candidate);
    duplicateKeys.add(duplicateKey(candidate));
  }

  const secondaryVisuals = selected.map((candidate) => toSecondaryVisual(candidate, executiveModel));
  const selectedIds = [principalTerritorialMap.mapId, ...secondaryVisuals.map((visual) => visual.visualId)];
  const reasonCodes = Array.from(new Set(excludedItems.map((item) => item.reasonCode)));
  return {
    principalTerritorialMap,
    secondaryVisuals,
    visualBudget: {
      minimumFunctional: 1,
      maximumOrdinary: MAX_EXECUTIVE_VISUALS,
      used: selectedIds.length,
      secondaryMaximum: 4,
      filledArtificially: false,
    },
    selectionAudit: {
      selectedIds,
      excludedItems,
      reasonCodes,
      visualBudgetUsed: selectedIds.length,
      visualBudgetMaximum: MAX_EXECUTIVE_VISUALS,
      territorialMapStatus: principalTerritorialMap.status,
    },
    technicalMetadata: {
      source: "ExecutiveGeointReportModel+InstitutionalReportInput",
      deterministic: true,
      rendersFinalAssets: false,
      externalCalls: false,
    },
  };
}
