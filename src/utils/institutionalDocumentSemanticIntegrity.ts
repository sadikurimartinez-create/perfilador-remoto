import type { InstitutionalReportInput } from "./institutionalReportPublicationContract";
import type { ExecutiveGeointReportModel } from "./executiveGeointReportModel";
import type { ExecutiveVisualComposition } from "./executiveVisualComposition";
import type { ExecutiveDocumentSection, ExecutiveVisualPlacement } from "./executiveGeointReportDocumentModel";
import { buildNarrativeAssertion, renderGovernedNarrative } from "./analyticalNarrativeGovernance";
import { buildCrimeIncidenceInstitutionalVisualSpecifications } from "./crimeIncidenceInstitutionalVisualProducer";

export type DocumentClaimState = "OBSERVED" | "DERIVED" | "HYPOTHESIS" | "HUMAN_VALIDATED_RELATION" | "PROSPECTIVE" | "LIMITATION";
export interface DocumentClaim {
  claimId: string;
  sectionId: string;
  paragraphIndex: number;
  text: string;
  state: DocumentClaimState;
  sourceIds: string[];
  evidenceIds: string[];
  findingIds: string[];
  analysisIds: string[];
  relationIds: string[];
  visualIds: string[];
  geographyId: string | null;
  validation: unknown;
  provenance: unknown;
  numericAssertions: Array<{ value: string; snapshotReference: string }>;
}
export interface DocumentSemanticAudit {
  enforced: boolean;
  narrativeClaims: DocumentClaim[];
  sourceAssertions: Array<{ sourceId: string; provenance: unknown }>;
  numericAssertions: DocumentClaim["numericAssertions"];
  requiredVisualIds: string[];
  optionalVisualIds: string[];
  renderedVisualIds: string[];
  missingVisualAssetIds: string[];
  sourceDependencies: unknown[];
  independentSources: string[];
  visualDescriptions: Array<{ visualId: string; headline: string; caption: string }>;
  errors: string[];
  status: "RESERVED" | "BLOCKED" | "RECONCILED";
}
const array = (value: any): any[] => Array.isArray(value) ? value : [];
const uniq = (values: any[]): string[] => [...new Set(values.filter(value => typeof value === "string" && value.trim()))];
const id = (item: any): string => item?.visualId || item?.evidenceId || item?.findingId || item?.analysisId || item?.outputId || item?.productId || item?.id || "";
export function canonicalSemanticValue(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonicalSemanticValue).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalSemanticValue(value[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

/** The textual and visual views share the producer's admitted snapshot projection. */
export function incidenceDocumentBasis(input: InstitutionalReportInput) {
  const snapshot = input.crimeIncidenceExportContract;
  if (!snapshot) return null;
  if (snapshot.productClassification !== "DESCRIPTIVE_ANALYTICAL_PRODUCT" || snapshot.analyticalLevel !== "DESCRIPTIVE") {
    throw new Error("P5_BLOCKED:INCIDENCE_NOT_ADMITTED");
  }
  const projection = { metrics: snapshot.projectionReference?.metrics, datasetReference: snapshot.datasetReference,
    sourceQuery: snapshot.queryReference, geographicReference: snapshot.geographicReference,
    temporalReference: snapshot.projectionReference?.temporalReference, lineage: snapshot.lineage,
    limitations: snapshot.limitations || [] };
  const charts = buildCrimeIncidenceInstitutionalVisualSpecifications(projection as any).charts;
  const request = snapshot.queryReference?.request;
  const basis = {
    datasetReference: snapshot.datasetReference.datasetId,
    total: projection.metrics.frequency.totalRecords,
    filters: request?.crimeFilters || snapshot.lineage.filters,
    period: projection.temporalReference || request?.temporalFilters || snapshot.lineage.timeRange,
    geography: snapshot.geographicReference || request?.queryGeometry || snapshot.lineage.geographicFilter,
    sourceIdentity: request?.datasetIdentity || snapshot.datasetReference,
    lineage: snapshot.lineage,
  };
  for (const visual of input.visualProducts || []) {
    if (!/^crime-incidence-(type-distribution|temporal-evolution):/.test(id(visual))) continue;
    const expected = charts.find(chart => chart.metadata.visualId === id(visual));
    const actual = visual.provenance || visual.crimeIncidenceVisualMetadata?.provenance;
    if (!expected || !actual || canonicalSemanticValue(actual) !== canonicalSemanticValue(expected.metadata)) {
      throw new Error(`P5_BLOCKED:INCIDENCE_VISUAL_SNAPSHOT_MISMATCH:${id(visual)}`);
    }
  }
  return { ...basis, source: charts[0]?.metadata.sourceReference || snapshot.queryReference?.requestProvenance?.sourceReference ||
    snapshot.datasetReference.sourceReference || snapshot.lineage.dataset || basis.datasetReference,
    snapshotReference: snapshot.exportId || basis.datasetReference,
    charts: charts.map(chart => ({ visualId: chart.metadata.visualId, kind: chart.kind })),
    snapshot };
}

function visualKinds(text: string): string[] {
  const kinds = [
    /\b(mapa|cartograf[ií]a)\b/i.test(text) && "MAP",
    /\b(BAR|barras|distribuci[oó]n)\b/i.test(text) && "BAR",
    /\b(LINE|gr[aá]fica lineal|serie temporal|evoluci[oó]n temporal|tendencia observada)\b/i.test(text) && "LINE",
    /\b(fotograf[ií]a|foto|imagen de campo)\b/i.test(text) && "PHOTO",
    /street\s*view/i.test(text) && "STREET_VIEW",
    /\bgr[aá]fica\b/i.test(text) && "CHART",
  ].filter(Boolean) as string[];
  return kinds.filter(kind => kind !== "CHART" || !kinds.includes("BAR") && !kinds.includes("LINE"));
}

export function resolveClaimVisualIds(text: string, sources: any[], input: InstitutionalReportInput): { ids: string[]; unresolved: string[] } {
  const explicit = uniq(sources.flatMap(item => [...array(item.visualIds), ...array(item.requiredVisualIds),
    ...array(item.visualReferences).filter(value => typeof value === "string"), item.visualId, item.photoEvidenceId]));
  const ids = [...explicit];
  const unresolved: string[] = [];
  const evidence = [...input.evidence, ...input.streetView];
  for (const kind of visualKinds(text)) {
    if (kind === "MAP") { ids.push("principal-territorial-map"); continue; }
    let candidates: string[] = [];
    if (["BAR", "LINE", "CHART"].includes(kind)) {
      candidates = input.visualProducts.filter(item => (kind === "BAR" ? item.kind === "INCIDENT_TYPE_DISTRIBUTION" :
        kind === "LINE" ? item.kind === "TEMPORAL_EVOLUTION" : item.visualType === "CHART") && sources.some(source =>
        explicit.includes(id(item)) || source.datasetReference?.datasetId === item.provenance?.datasetReference ||
        source.datasetId === item.provenance?.datasetReference || array(source.sourceIds).includes(item.provenance?.datasetReference))).map(id);
    } else {
      const refs = uniq(sources.flatMap(item => [id(item), ...array(item.evidenceIds), ...array(item.evidenceReferences),
        ...array(item.supportingEvidenceIds), ...array(item.contradictingEvidenceIds), ...array(item.supportingReferences), ...array(item.contradictingReferences),
        ...array(item.publicationEligibility?.lineageRefs?.evidenceIds), item.photoEvidenceId]));
      candidates = evidence.filter(item => refs.includes(id(item)) &&
        (kind === "STREET_VIEW" ? input.streetView.includes(item) || Boolean(item.streetViewMetadata) : !item.streetViewMetadata)).map(id);
    }
    if (candidates.length === 1 || (candidates.length > 0 && (kind === "PHOTO" || kind === "STREET_VIEW" || kind === "CHART" && sources.some(item => item.datasetReference)))) ids.push(...candidates);
    else if (!explicit.length) unresolved.push(kind);
  }
  return { ids: uniq(ids), unresolved };
}

/** Reserve explicit dependencies before P3's existing selection policy runs. */
export function collectDocumentCitedVisualIds(model: ExecutiveGeointReportModel, input: InstitutionalReportInput): string[] {
  const citations = model.findings.flatMap(finding => {
    const native = input.findings.filter(item => finding.technicalMetadata.sourceFindingIds.includes(id(item)));
    return resolveClaimVisualIds([finding.title, finding.summary, finding.interpretation, finding.implication].join(" "), native, input).ids;
  });
  for (const evidence of model.keyEvidence) {
    const native = [...input.evidence, ...input.streetView].find(item => id(item) === evidence.technicalMetadata.sourceItemId);
    citations.push(...resolveClaimVisualIds([evidence.title, evidence.summary].join(" "), native ? [native] : [], input).ids);
    if (evidence.visualReference && native) citations.push(id(native));
  }
  citations.push(...resolveClaimVisualIds(input.hypothesis.currentHypothesis || "", [input.hypothesis], input).ids);
  const result = model.multisourceAnalysis.technicalMetadata.governedAnalysis;
  if (result) citations.push(...resolveClaimVisualIds(model.panorama?.situacion || "", [result], input).ids);
  return uniq(citations);
}

function sourcesForParagraph(section: string, index: number, text: string, model: ExecutiveGeointReportModel, input: InstitutionalReportInput): any[] {
  const result = model.multisourceAnalysis.technicalMetadata.governedAnalysis;
  const findings = (finding: any) => finding ? input.findings.filter(item => finding.technicalMetadata.sourceFindingIds.includes(id(item))) : [];
  if (section === "cover") {
    const admitted = input.scinceContext?.publicationStatus === 'PUBLISHABLE' ? input.scinceContext.snapshot : null;
    const profile = admitted?.multiunit?.officialBaseProfile2020;
    // Full observations live in the protected input/annex and indicator bindings.
    // Repeating all 222 variables in every cover claim would inflate the package.
    return [{ id: input.projectId, provenance: { projectId: input.projectId, generatedAt: input.generatedAt } },
      ...(profile && admitted ? [{ id: profile.datasetId, snapshot: { dataset: admitted.dataset,
        geographyBinding: admitted.geographyBinding, release: { releaseId: profile.releaseId,
          catalogVersion: profile.catalogVersion, normalizationVersion: profile.normalizationVersion,
          observationSetFingerprint: profile.observationSetFingerprint, catalogFingerprint: profile.catalogFingerprint } } }] : [])];
  }
  if (section === "priority-findings") return findings(model.findings[index]);
  if (section === "key-evidence") return [...input.evidence, ...input.streetView, ...input.visualProducts].filter(item => id(item) === model.keyEvidence[index]?.technicalMetadata.sourceItemId);
  if (section === "decision-implications") return findings(model.findings.find(item => item.findingId === model.decisionImplications[index]?.technicalMetadata.sourceFindingId));
  if (section === "prospective-analysis") return input.predictiveAnalyticalProducts.filter(item => model.prospectiveAnalysis.technicalMetadata.sourceProductIds.includes(id(item)));
  if (section === "initial-hypothesis") {
    const hypothesis = input.hypothesis;
    const evidenceIds = [...array(hypothesis.supportingEvidenceIds), ...array(hypothesis.contradictingEvidenceIds)];
    const findingIds = [...array(hypothesis.supportingFindingIds), ...array(hypothesis.contradictingFindingIds)];
    if (index === 2) return input.findings.filter(item => findingIds.includes(id(item)));
    if (index === 3 || index === 4) return [...input.evidence, ...input.findings].filter(item => evidenceIds.includes(id(item)) || findingIds.includes(id(item)));
    if (index === 5) return input.conclusions.filter(item => item.hypothesisId === hypothesis.hypothesisId ||
      array(item.evidenceIds || item.publicationEligibility?.lineageRefs?.evidenceIds).some(ref => evidenceIds.includes(ref)) ||
      array(item.findingIds || item.publicationEligibility?.lineageRefs?.findingIds).some(ref => findingIds.includes(ref)));
    return [{ ...hypothesis, id: hypothesis.hypothesisId, provenance: hypothesis }];
  }
  if (section === "executive-panorama") {
    if (/^Hallazgo prioritario:/.test(text)) return findings(model.findings[index - 1]);
    if (/^Escenario:/.test(text)) return input.predictiveAnalyticalProducts.filter(item => model.prospectiveAnalysis.technicalMetadata.sourceProductIds.includes(id(item)));
    return result ? [result] : [];
  }
  if (section === "territorial-situation") {
    if (/^Incidencia/.test(text)) return input.crimeIncidenceExportContract ? [{ ...input.crimeIncidenceExportContract, id: input.crimeIncidenceExportContract.datasetReference?.datasetId }] : [];
    if (/DENUE/.test(text)) return array(input.denuePois).filter(item => item.source === "DENUE" && item.provider === "INEGI_DENUE" && item.territorialStatus === "INSTITUTIONAL" &&
      (item.epistemicIntegrity || item).acquisitionMode === "OBSERVED" && (item.epistemicIntegrity || item).acquisitionStatus === "ACQUIRED" && (item.epistemicIntegrity || item).isSimulated === false);
    if (index > 1) return input.scinceContext?.publicationStatus === "PUBLISHABLE" ? [{ id: input.scinceContext.snapshot.dataset.datasetId, snapshot: input.scinceContext.snapshot }] : [];
    return input.geography ? [{ id: input.geography.geographyId, provenance: input.geography }] : [];
  }
  if (section === "multisource-analysis") {
    if (/^Registro OSINT/.test(text)) return input.osint.filter(item => text.includes(item.title || item.summary || item.snippet || item.text || "\u0000"));
    if (/pandillas/.test(text)) return input.specializedIntelligence;
    return result ? [result] : [];
  }
  return [];
}

function isLimitation(text: string): boolean {
  return /\b(No consta|No constan)\b|(?:NO DISPONIBLE|NO DETERMINADO|NO CONSIGNADO)\.?$|^(?:Contexto de formulaci[oó]n: NO CONSIGNADO|Brecha de informaci[oó]n:|Contradicci[oó]n:|Dependencia parcial:|Incertidumbre:|Limitaci[oó]n:)/i.test(text);
}

export function buildDocumentSemanticAudit(model: ExecutiveGeointReportModel, input: InstitutionalReportInput,
  composition: ExecutiveVisualComposition, sections: ExecutiveDocumentSection[], placements: ExecutiveVisualPlacement[], enforced = false): DocumentSemanticAudit {
  const result = model.multisourceAnalysis.technicalMetadata.governedAnalysis;
  const claims: DocumentClaim[] = [];
  const errors: string[] = [];
  const incidence = enforced ? incidenceDocumentBasis(input) : null;
  for (const section of sections.filter(item => item.status !== "OPTIONAL_SUPPRESSED")) for (const [index, text] of section.content.entries()) {
    const sources = sourcesForParagraph(section.sectionId, index, text, model, input);
    const limitation = isLimitation(text);
    const sourceIds = uniq(sources.flatMap(item => [id(item), item.sourceId,
      ...array(item.publicationEligibility?.lineageRefs?.sourceIds), ...array(item.lineage).map(node => node.sourceId)]));
    const nativeAssertions = sources.filter(item => !item.projectionReference && !item.snapshot && !item.provenance?.sourceFingerprint)
      .map(item => buildNarrativeAssertion(item, { sourceItemType: section.sectionId === "priority-findings" ? "FINDING" :
        section.sectionId === "initial-hypothesis" ? index === 5 ? "CONCLUSION" : index < 2 ? "HYPOTHESIS" : "EVIDENCE" : "EVIDENCE" }));
    const citations = limitation ? { ids: [], unresolved: [] } : resolveClaimVisualIds(text, sources, input);
    if (section.sectionId === "key-evidence" && model.keyEvidence[index]?.visualReference && sourceIds.length) citations.ids.push(sourceIds[0]);
    const metadata = section.sectionId === "cover" || section.sectionId === "initial-hypothesis" && (index < 2 || index >= 6) ||
      (section.sectionId === "territorial-situation" && index < 2 && !/^Incidencia|DENUE|SCINCE/i.test(text));
    const governed = sources.some(item => item.provenance || item.snapshot || item.projectionReference && item.lineage && item.datasetReference || item.lineage?.length || item.lineageStatus === "TRACEABLE" ||
      item.epistemicIntegrity?.traceabilityId || item.publicationEligibility?.lineageRefs?.sourceIds?.length);
    if (!limitation && (!sourceIds.length || (!metadata && !governed))) errors.push(`CLAIM_PROVENANCE_MISSING:${section.sectionId}:${index}`);
    if (sources.some(item => item.sourceIntegrityStatus === "LEGACY_UNCLASSIFIED" || item.sourceStatus === "LEGACY_UNCLASSIFIED" || item.publicationEligibility?.eligibility === "INELIGIBLE")) errors.push(`CLAIM_NOT_ADMITTED:${section.sectionId}:${index}`);
    if (enforced && !metadata && !limitation) for (const assertion of nativeAssertions) {
      if (!renderGovernedNarrative(assertion, { mode: "INSTITUTIONAL" }).rendered) errors.push(`CLAIM_NARRATIVE_NOT_ADMITTED:${section.sectionId}:${index}`);
    }
    if (citations.unresolved.length) errors.push(`VISUAL_CITATION_UNRESOLVED:${section.sectionId}:${index}:${citations.unresolved.join(",")}`);
    const snapshotReference = /^Incidencia/.test(text) ? incidence?.snapshotReference : sources.find(item => item.snapshot || item.metrics || item.projectionReference)?.snapshot?.dataset?.datasetId ||
      (result && sources.includes(result) ? result.provenance.sourceFingerprint : undefined) ||
      sources.find(item => item.provenance?.datasetReference === incidence?.datasetReference)?.provenance?.datasetReference;
    const numbers = metadata || limitation ? [] : [...text.matchAll(/\b\d+(?:[.,]\d+)?\b/g)].map(match => match[0]);
    const descriptiveDenue = /^Actividad y entorno DENUE/.test(text);
    if (numbers.length && !snapshotReference && !descriptiveDenue) errors.push(`NUMERIC_SNAPSHOT_MISSING:${section.sectionId}:${index}`);
    if (/^Incidencia/.test(text) && incidence) {
      const statedTotal = text.match(/(\d+)\s+registro/i);
      if (statedTotal && Number(statedTotal[1]) !== incidence.total) errors.push(`INCIDENCE_TEXT_TOTAL_MISMATCH:${section.sectionId}:${index}`);
    }
    const state: DocumentClaimState = limitation ? "LIMITATION" : section.sectionId === 'cover' && /· derivado/.test(text) ? 'DERIVED' : section.sectionId === "initial-hypothesis" && index < 2 ? "HYPOTHESIS" :
      section.sectionId === "prospective-analysis" || /^Escenario:/.test(text) ? "PROSPECTIVE" :
      (/^Convergencia:/.test(text) && result?.convergences.some(item => item.humanReviewStatus === "APPROVED")) ||
        nativeAssertions.some(item => item.allowedNarrativeStrength === "VALIDATED_CONCLUSION") ? "HUMAN_VALIDATED_RELATION" :
      section.sectionId === "priority-findings" || section.sectionId === "decision-implications" || sources.includes(result) || /^Incidencia/.test(text) || nativeAssertions.some(item => ["FINDING", "INFERENCE", "ANALYSIS"].includes(item.epistemicClass) || ["DERIVED", "AI_GENERATED"].includes(item.acquisitionMode)) ? "DERIVED" : "OBSERVED";
    claims.push({ claimId: `DC-${section.sectionId}-${index}`, sectionId: section.sectionId, paragraphIndex: index, text, state, sourceIds,
      evidenceIds: uniq(sources.flatMap(item => [item.evidenceId, ...array(item.evidenceIds), ...array(item.evidenceReferences), ...array(item.publicationEligibility?.lineageRefs?.evidenceIds)])),
      findingIds: uniq(sources.flatMap(item => [item.findingId, ...array(item.findingIds)])), analysisIds: uniq(sources.flatMap(item => [item.analysisId, item.outputId, ...array(item.analysisIds)])),
      relationIds: uniq(sources.flatMap(item => [item.relationId, ...array(item.relationIds)])), visualIds: uniq(citations.ids), geographyId: input.geography?.geographyId || null,
      validation: sources.map(item => ({ status: item.humanValidation || item.humanValidationStatus || item.publicationEligibility || null,
        reviewedRelations: array(item.convergences).map(relation => ({ relationId: relation.convergenceId, humanReviewStatus: relation.humanReviewStatus,
          reviewedBy: relation.reviewedBy, reviewedAt: relation.reviewedAt, reviewComment: relation.reviewComment })) })),
      provenance: { sources, narrativeAssertions: nativeAssertions, incidence: /^Incidencia/.test(text) ? incidence : undefined },
      numericAssertions: numbers.map(value => ({ value, snapshotReference: snapshotReference || `denue-inventory:${canonicalSemanticValue(sources)}` })) });
  }
  // Captions describe type, admitted source and scope; source summaries stay in governed claims.
  if (enforced) for (const placement of placements) {
    if (placement.placementRole !== "PRINCIPAL_TERRITORIAL_MAP") {
      const product = input.visualProducts.find(item => id(item) === placement.visualId);
      const native = [...input.evidence, ...input.streetView].find(item => id(item) === placement.visualId);
      const purpose = product?.transformation || product?.analyticalPurpose || array(product?.findingIds).length ||
        claims.some(claim => claim.visualIds.includes(placement.visualId));
      const source = product?.sourceType || native?.sourceType || native?.sourceProvider || native?.source || native?.streetViewMetadata?.provider;
      const relationship = array(product?.findingIds).length || array(product?.analysisIds).length || product?.datasetSourceRefs?.length ||
        claims.some(claim => claim.visualIds.includes(placement.visualId) && claim.sourceIds.length);
      if (!purpose || !source || !relationship) errors.push(`VISUAL_FUNCTION_MISSING:${placement.visualId}`);
    }
    const kind = placement.visualClass === "STREET_VIEW" ? "Captura Street View" : placement.visualClass === "FOTOGRAFIA_CAMPO" ? "Fotografía de campo" :
      placement.visualClass === "GRAFICA_ESTADISTICA" ? "Gráfica descriptiva" : "Representación territorial";
    const source = placement.visibleSourceLabel || (placement.placementRole === "PRINCIPAL_TERRITORIAL_MAP" ? "Geografía canónica del expediente" : "Referencia gobernada del expediente");
    placement.caption = `${kind}. Fuente: ${source}. Ámbito: ${input.geography?.type || "no consignado"}.`;
    placement.headline = kind;
  }
  const required = uniq([composition.principalTerritorialMap.mapId, ...claims.flatMap(claim => claim.visualIds)]);
  for (const visualId of required) {
    const linked = claims.filter(claim => claim.visualIds.includes(visualId));
    for (const left of linked) for (const right of linked) {
      const leftAssertions = array((left.provenance as any).sources).map(item => item.assertion).filter(Boolean);
      const rightAssertions = array((right.provenance as any).sources).map(item => item.assertion).filter(Boolean);
      if (leftAssertions.includes("PRESENT") && rightAssertions.includes("ABSENT") && !left.relationIds.some(relation => right.relationIds.includes(relation))) {
        errors.push(`INCOMPATIBLE_VISUAL_CLAIMS:${visualId}`);
      }
    }
  }
  if (result && model.multisourceAnalysis.fuentesIndependientes.length > result.independentSources.length) errors.push("INDEPENDENT_SOURCE_COUNT_MISMATCH");
  if (enforced) {
    const selected = placements.map(item => item.visualId);
    for (const visualId of required) if (!selected.includes(visualId)) errors.push(`REQUIRED_VISUAL_NOT_SELECTED:${visualId}`);
  }
  if (enforced && errors.length) throw new Error(`P5_BLOCKED:${errors.join(";")}`);
  return { enforced, narrativeClaims: claims, sourceAssertions: [...new Map(claims.flatMap(claim => claim.sourceIds.map(sourceId => [sourceId, { sourceId, provenance: claim.provenance }] as const))).values()],
    numericAssertions: claims.flatMap(claim => claim.numericAssertions), requiredVisualIds: required,
    optionalVisualIds: placements.map(item => item.visualId).filter(item => !required.includes(item)), renderedVisualIds: [], missingVisualAssetIds: [],
    sourceDependencies: result?.sourceDependencies || [], independentSources: result?.independentSources || [],
    visualDescriptions: placements.map(placement => ({ visualId: placement.visualId, caption: placement.caption, headline: placement.headline })), errors, status: "RESERVED" };
}

/** Reconcile actual renderer output, never hydration or a declared ASSET_RENDERED flag. */
export function reconcileDocumentSemanticAudit(audit: DocumentSemanticAudit, rendered: { renderedVisualIds: string[]; missingVisualAssetIds: string[] },
  sections?: ExecutiveDocumentSection[], placements?: ExecutiveVisualPlacement[]): DocumentSemanticAudit {
  const renderedIds = uniq(rendered.renderedVisualIds);
  const missing = uniq([...rendered.missingVisualAssetIds, ...audit.requiredVisualIds.filter(id => !renderedIds.includes(id))]);
  const errors = [...audit.errors];
  for (const visualId of audit.requiredVisualIds) if (!renderedIds.includes(visualId) || missing.includes(visualId)) errors.push(`REQUIRED_VISUAL_NOT_RENDERED:${visualId}`);
  if (sections) for (const claim of audit.narrativeClaims) {
    if (sections.find(section => section.sectionId === claim.sectionId)?.content[claim.paragraphIndex] !== claim.text) errors.push(`CLAIM_TEXT_CHANGED:${claim.claimId}`);
  }
  if (sections) for (const section of sections.filter(item => item.status !== "OPTIONAL_SUPPRESSED")) {
    for (const [paragraphIndex] of section.content.entries()) if (!audit.narrativeClaims.some(claim => claim.sectionId === section.sectionId && claim.paragraphIndex === paragraphIndex)) {
      errors.push(`UNRESERVED_NARRATIVE_CLAIM:${section.sectionId}:${paragraphIndex}`);
    }
  }
  if (placements) for (const description of audit.visualDescriptions || []) {
    const placement = placements.find(item => item.visualId === description.visualId);
    if (!placement || placement.caption !== description.caption || placement.headline !== description.headline) errors.push(`VISUAL_DESCRIPTION_CHANGED:${description.visualId}`);
  }
  if (placements) for (const placement of placements) if (!(audit.visualDescriptions || []).some(item => item.visualId === placement.visualId)) {
    errors.push(`UNRESERVED_VISUAL:${placement.visualId}`);
  }
  if (audit.enforced && errors.length) throw new Error(`P5_BLOCKED:${errors.join(";")}`);
  return { ...audit, renderedVisualIds: renderedIds, missingVisualAssetIds: missing, errors, status: errors.length ? "BLOCKED" : "RECONCILED" };
}

/** Final renderers consume a reconciled reservation; they never create claims. */
export function assertReconciledDocumentSemanticAudit(audit: DocumentSemanticAudit | undefined): asserts audit is DocumentSemanticAudit {
  if (!audit?.enforced || audit.status !== "RECONCILED" || audit.errors.length) {
    throw new Error("P5_BLOCKED:RECONCILED_AUDIT_REQUIRED");
  }
}

/** P3 materialization is checked before handing the reservation to P6. */
export function reconcileMaterializedDocument(model: { semanticIntegrity?: DocumentSemanticAudit; sections: ExecutiveDocumentSection[]; visualPlacements: ExecutiveVisualPlacement[] }, assets: Record<string, any>): DocumentSemanticAudit {
  if (!model.semanticIntegrity?.enforced) throw new Error("P5_BLOCKED:ENFORCED_AUDIT_REQUIRED");
  const renderedVisualIds: string[] = [], missingVisualAssetIds: string[] = [];
  for (const placement of model.visualPlacements) {
    const value = assets[placement.visualId]?.data;
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : null;
    const valid = bytes && bytes.length > 12 && ((bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) || (bytes[0] === 255 && bytes[1] === 216));
    (valid ? renderedVisualIds : missingVisualAssetIds).push(placement.visualId);
  }
  return reconcileDocumentSemanticAudit(model.semanticIntegrity, { renderedVisualIds, missingVisualAssetIds }, model.sections, model.visualPlacements);
}

export function renderDocumentClaimWithExistingGovernance(item: any, type: Parameters<typeof buildNarrativeAssertion>[1]["sourceItemType"]) {
  return renderGovernedNarrative(buildNarrativeAssertion(item, { sourceItemType: type }), { mode: "INSTITUTIONAL" });
}
