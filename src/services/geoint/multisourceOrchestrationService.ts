import type {
  InstitutionalMultisourceAnalysis,
  InstitutionalSourceEligibility,
  MultisourceOrchestrationEnvelope,
  MultisourceOrchestrationItem,
  MultisourceSourceDescriptor,
  SourceDependencyRelation,
  SourceDependencyType,
} from "@/types/multisourceOrchestration";
import type { InstitutionalReportInput } from "@/utils/institutionalReportPublicationContract";
import { correlateInstitutionalEvidence, type InstitutionalCorrelationItem } from "@/lib/geoint/institutionalEvidenceCorrelation";
import { buildInstitutionalConvergence, classifyConvergenceTemporal, convergenceToInstitutionalCorrelationItem, type ConvergenceSourceEntry, type ConvergencePhenomenon } from "@/utils/institutionalMultisourceConvergence";
import { validateLineage } from "@/utils/evidenceLineage";
import { renderInstitutionalMultisourceNarrative } from "@/utils/analyticalNarrativeGovernance";

function present(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function stableRepresentation(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const character of stableRepresentation(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return `source-v1:${hash.toString(16).padStart(8, "0")}`;
}
const unique = <T>(values: T[]) => [...new Set(values)];
const array = (value: unknown): any[] => Array.isArray(value) ? value : [];
const nonProductive = (item: any) => [item?.acquisitionMode, item?.epistemicClass, item?.sourceStatus,
  item?.epistemicIntegrity?.acquisitionMode, item?.epistemicIntegrity?.sourceStatus].some(value => /MOCK|SIMULAT|LEGACY|CONNECTIVITY|TEST|SYNTHETIC/i.test(String(value || ""))) ||
  item?.isSimulated === true || item?.epistemicIntegrity?.isSimulated === true || item?.cacheOnly === true ||
  item?.isConnectivityOnly === true || item?.epistemicIntegrity?.isConnectivityOnly === true;
const supportedPhenomena = new Set(["PHYSICAL_FEATURE_CORROBORATION", "ACCESS_FEATURE_CORROBORATION", "POI_IDENTITY_CORROBORATION",
  "FUNCTIONAL_ACTIVITY_CORROBORATION", "TEMPORAL_ACTIVITY_CORROBORATION", "OPERATIONAL_STATUS_CONTRADICTION",
  "PHYSICAL_STATE_CONTRADICTION", "ROUTE_ACCESS_CORROBORATION", "TOPOGRAPHIC_CONTEXT_CORROBORATION", "FIELD_CORROBORATED_FINDING"]);
const supportedSourceKinds = new Set(["STREET_VIEW", "PLACES", "PLACES_REVIEW", "VISION", "ROUTES", "ELEVATION", "DENUE", "FIELD_PHOTO", "FIELD_OBSERVATION", "PPC_CONTEXT"]);

/** Deterministic documentary assembly. Engines retain their responsibilities; no provider or persistence call. */
export function assembleInstitutionalMultisourceAnalysis(input: InstitutionalReportInput): InstitutionalMultisourceAnalysis {
  const records: Array<{ family: string; item: any }> = [];
  const limitations: string[] = [];
  const add = (family: string, items: unknown) => array(items).forEach(item => {
    if (!item || nonProductive(item) || item.publicationEligibility?.eligibility === "INELIGIBLE") return;
    records.push({ family, item });
  });
  add("EVIDENCE", input.evidence); add("FINDING", input.findings); add("ANALYSIS", input.analyses);
  add("OSINT", input.osint); add("STREET_VIEW", input.streetView); add("GEOINT", input.temporalComparisons);
  add("DENUE_CONTEXT", input.denuePois); add("GIM", input.specializedIntelligence); add("PROSPECTIVE", input.predictiveAnalyticalProducts);
  if (input.denueAnalyticalDocument?.status === "READY") add("DENUE_ANALYTICAL", [input.denueAnalyticalDocument.unit]);
  if (input.scinceContext?.publicationStatus === "PUBLISHABLE") {
    records.push({ family: "SCINCE", item: { ...input.scinceContext.snapshot, id: input.scinceContext.snapshot.dataset.datasetId,
      semanticRole: "DESCRIPTIVE_CONTEXT" } });
  }
  const incidence = input.crimeIncidenceExportContract;
  if (incidence?.productClassification === "DESCRIPTIVE_ANALYTICAL_PRODUCT" && incidence.queryReference?.status === "EXECUTED" &&
    incidence.queryReference.admission?.accepted === true && incidence.datasetReference?.datasetId && incidence.lineage) {
    records.push({ family: "INCIDENCE", item: { ...incidence, id: incidence.exportId || incidence.datasetReference.datasetId,
      provenance: incidence.datasetReference, semanticRole: "DESCRIPTIVE_ANALYTICAL_PRODUCT" } });
  }
  records.sort((a, b) => `${a.family}:${stableRepresentation(a.item)}`.localeCompare(`${b.family}:${stableRepresentation(b.item)}`));
  for (let index = records.length - 1; index > 0; index--) {
    if (stableRepresentation(records[index]) === stableRepresentation(records[index - 1])) records.splice(index, 1);
  }
  const rawItems: InstitutionalCorrelationItem[] = [];
  const descriptors: MultisourceOrchestrationItem[] = [];
  const sourceEntries: Array<{ phenomenon: ConvergencePhenomenon; source: ConvergenceSourceEntry; itemId: string }> = [];
  const sourceIds = new Set<string>();
  const admittedEvidence = new Set<string>();
  const admittedFindings = new Set<string>();
  const inventory = records.map(({ family, item }) => {
    const id = String(item.outputId || item.findingId || item.evidenceId || item.productId || item.id || "");
    const integrity = item.epistemicIntegrity || {};
    const provenance = { ...(item.provenance || {}), epistemicIntegrity: integrity, lineage: array(item.lineage) };
    if (family === "EVIDENCE" || family === "STREET_VIEW") {
      if (item.evidenceId) admittedEvidence.add(item.evidenceId);
    }
    if (family === "FINDING" && item.findingId) admittedFindings.add(item.findingId);
    const sourceId = item.sourceId || integrity.sourceId || item.sourceEvidenceId;
    if (sourceId) sourceIds.add(sourceId);
    const mode = item.acquisitionMode || integrity.acquisitionMode;
    const role = family === "ANALYSIS" || family === "PROSPECTIVE" || mode === "DERIVED" || mode === "AI_GENERATED"
      ? "DERIVED" : ["SCINCE", "DENUE_CONTEXT", "INCIDENCE", "DENUE_ANALYTICAL"].includes(family) ? "DESCRIPTIVE" : mode || "UNKNOWN";
    // Descriptive modules and approved analyses remain inventory, never primary corroboration sources.
    if (["SCINCE", "DENUE_CONTEXT", "INCIDENCE", "DENUE_ANALYTICAL", "ANALYSIS", "PROSPECTIVE", "GIM", "GEOINT"].includes(family)) {
      return { family, id, epistemicRole: role, provenance };
    }
    const providerId = item.providerId || integrity.providerId || item.sourceProvider;
    const traceabilityId = item.traceabilityId || integrity.traceabilityId;
    const sourceEvidenceId = item.sourceEvidenceId || integrity.sourceEvidenceId;
    const reference = item.sourceReference || integrity.sourceReference || item.provenance?.sourceReference || array(item.sourceReferences)[0];
    const persistedDescriptor = input.sourceOrchestration?.items.find(entry => entry.itemId === id &&
      entry.source.providerId === providerId && (entry.source.sourceReference === reference || entry.source.rawSourceReference === reference))?.source;
    if (!id || !providerId || !sourceEvidenceId || !traceabilityId || !reference || validateLineage(array(item.lineage)).status !== "SUPPORTED" ||
      (item.expedienteId || item.projectId) !== input.projectId || item.geographyId !== input.geography?.geographyId) {
      limitations.push(`La referencia ${id || family} carece de identidad, origen o trazabilidad suficientes para correlación.`);
      return { family, id, epistemicRole: role, provenance };
    }
    const correlationItem: InstitutionalCorrelationItem = { id, providerId, sourceType: item.sourceType || integrity.sourceType || family,
      sourceEvidenceId, traceabilityId, expedienteId: input.projectId, geographyId: item.geographyId,
      ...(item.coordinates ? { coordinates: item.coordinates } : {}), observedAt: item.observedAt || integrity.observedAt,
      acquiredAt: item.acquiredAt || integrity.acquiredAt, semanticRole: integrity.semanticRole || item.semanticRole,
      epistemicIntegrity: { ...integrity, acquisitionMode: mode, isSimulated: false }, reference,
      lineage: item.lineage, tags: item.phenomenonTags || item.tags, category: item.category,
      payload: { assertion: item.assertion, category: item.category, tags: item.phenomenonTags || item.tags } };
    rawItems.push(correlationItem);
    descriptors.push({ itemId: id, eligibility: "ELIGIBLE", source: { descriptorId: traceabilityId, sourceType: correlationItem.sourceType,
      sourceId, providerId, sourceReference: reference, rawSourceReference: item.rawSourceReference || integrity.rawSourceReference || persistedDescriptor?.rawSourceReference,
      captureId: item.captureId || persistedDescriptor?.captureId, operationId: item.operationId || item.visitId || persistedDescriptor?.operationId, sourceEvidenceIds: [sourceEvidenceId],
      dependsOnSourceEvidenceIds: unique([...array(item.dependsOnSourceEvidenceIds), ...array(persistedDescriptor?.dependsOnSourceEvidenceIds)]),
      authorityClassification: item.sourceStatus === "AUTHORITATIVE" ? "AUTHORITATIVE" : persistedDescriptor?.authorityClassification || item.sourceDescriptor?.authorityClassification || "UNKNOWN",
      integrityClassification: persistedDescriptor?.integrityClassification || "VERIFIED" } });
    const source = item.convergenceSource || (item.sourceKind && item.phenomenonTags ? item : null);
    if (source && supportedPhenomena.has(item.phenomenon) && supportedSourceKinds.has(source.sourceKind) &&
      source.sourceEvidenceId === sourceEvidenceId && source.traceabilityId === traceabilityId &&
      source.acquisitionMode === mode && source.assertion === item.assertion &&
      (!item.coordinates || stableRepresentation(source.coordinates) === stableRepresentation(item.coordinates)) &&
      array(source.sourceReferences).includes(reference) &&
      source.expedienteId === input.projectId && source.geographyId === item.geographyId && validateLineage(array(source.lineage)).status === "SUPPORTED") {
      sourceEntries.push({ phenomenon: item.phenomenon, source: { ...source,
        temporalClass: source.temporalClass || classifyConvergenceTemporal(source.timestamp, new Date(input.generatedAt)) }, itemId: id });
    }
    return { family, id, epistemicRole: role, provenance };
  });
  const correlation = correlateInstitutionalEvidence("perfil", rawItems, input.generatedAt);
  const acceptedIds = new Set(rawItems.filter(item => !correlation.excludedItems.some(excluded => excluded.id === item.id)).map(item => item.id));
  const envelope = buildMultisourceOrchestrationEnvelope(input.projectId, descriptors.filter(item => acceptedIds.has(item.itemId)));
  const groupByItem = new Map(envelope.corroborationGroups.flatMap(group => group.itemIds.map(id => [id, group.groupId] as const)));
  const independentRelation = (a: string, b: string) => groupByItem.has(a) && groupByItem.has(b) && groupByItem.get(a) !== groupByItem.get(b) &&
    envelope.dependencyRelations.some(relation => relation.countsAsIndependentCorroboration &&
      ((relation.leftItemId === a && relation.rightItemId === b) || (relation.leftItemId === b && relation.rightItemId === a)));
  const candidateConvergences: InstitutionalMultisourceAnalysis["candidateConvergences"] = [];
  for (const relation of correlation.results) {
    if (relation.correlationType !== "CORROBORATION" || !independentRelation(relation.sources[0].id, relation.sources[1].id)) continue;
    const entries = relation.sources.map(item => sourceEntries.find(entry => entry.itemId === item.id));
    if (entries.some(entry => !entry) || entries[0]!.phenomenon !== entries[1]!.phenomenon) continue;
    const candidate = buildInstitutionalConvergence({ expedienteId: input.projectId, geographyId: relation.geographyId,
      phenomenon: entries[0]!.phenomenon, sources: entries.map(entry => entry!.source), generatedAt: input.generatedAt });
    if (!candidate.blockingReasons.length && candidate.temporalCompatibility === "COMPATIBLE" &&
      ["SAME_POINT", "NEARBY", "SPATIALLY_COMPATIBLE"].includes(candidate.spatialCompatibility) && candidate.semanticCompatibility === "COMPATIBLE" &&
      candidate.sourceDependencies.every(dependency => dependency.independence === "INDEPENDENT")) candidateConvergences.push(candidate);
  }
  const convergences = (input.convergences || []).filter(result => result.expedienteId === input.projectId &&
    !!result.reviewedBy?.trim() && !!result.reviewedAt && Number.isFinite(Date.parse(result.reviewedAt)) &&
    result.geographyId === input.geography?.geographyId && convergenceToInstitutionalCorrelationItem(result).item !== null &&
    result.supportingSources.length + result.contradictingSources.length >= 2 &&
    result.sourceDependencies.length > 0 && result.sourceDependencies.every(dependency => dependency.independence === "INDEPENDENT") &&
    [...result.supportingSources, ...result.contradictingSources].every(source =>
      sourceEntries.some(entry => entry.source.sourceEvidenceId === source.sourceEvidenceId &&
        entry.source.traceabilityId === source.traceabilityId && stableRepresentation(entry.source) === stableRepresentation({ ...source,
          temporalClass: source.temporalClass || classifyConvergenceTemporal(source.timestamp, new Date(input.generatedAt)) }))) &&
    [...result.supportingSources, ...result.contradictingSources].every((source, index, sources) => sources.slice(index + 1).every(other => {
      const a = sourceEntries.find(entry => entry.source.sourceEvidenceId === source.sourceEvidenceId);
      const b = sourceEntries.find(entry => entry.source.sourceEvidenceId === other.sourceEvidenceId);
      return !!a && !!b && independentRelation(a.itemId, b.itemId);
    })) &&
    result.temporalCompatibility === "COMPATIBLE" && result.semanticCompatibility === "COMPATIBLE" &&
    ["SAME_POINT", "NEARBY", "SPATIALLY_COMPATIBLE"].includes(result.spatialCompatibility));
  const contradictions = unique([
    ...correlation.results.filter(result => result.correlationType === "CONTRADICTION").map(result =>
      `Las fuentes ${result.sources.map(source => source.id).join(" y ")} contienen afirmaciones incompatibles; contraste pendiente de revisión PPC, sin resolución automática.`),
    ...convergences.filter(result => result.contradictingSources.length).map(result =>
      `La convergencia revisada ${result.convergenceId} conserva contraste entre ${result.supportingSources.map(s => s.sourceId).join(", ")} y ${result.contradictingSources.map(s => s.sourceId).join(", ")}.`),
    ...input.analyses.filter(item => !nonProductive(item) && item.publicationEligibility?.eligibility !== "INELIGIBLE")
      .flatMap(item => array(item.contradictions).filter(value => typeof value === "string")),
  ]);
  const hypothesis = input.hypothesis;
  const supportingReferences = unique([
    ...array(hypothesis.supportingEvidenceIds).filter(id => admittedEvidence.has(id)),
    ...array(hypothesis.supportingFindingIds).filter(id => admittedFindings.has(id)),
    ...convergences.filter(result => result.hypothesisRelation === "SUPPORTS").flatMap(result => result.sourceEvidenceIds),
  ]);
  const contradictingReferences = unique([
    ...array(hypothesis.contradictingEvidenceIds).filter(id => admittedEvidence.has(id)),
    ...array(hypothesis.contradictingFindingIds).filter(id => admittedFindings.has(id)),
    ...convergences.filter(result => result.hypothesisRelation === "CONTRADICTS").flatMap(result => result.sourceEvidenceIds),
  ]);
  const supportStatus: InstitutionalMultisourceAnalysis["supportStatus"] = contradictingReferences.length ? "CONTRADICTED" :
    convergences.some(result => result.hypothesisRelation === "SUPPORTS") && !contradictions.length ? "SUPPORTED" :
    supportingReferences.length ? "PARTIALLY_SUPPORTED" : "INSUFFICIENT_DATA";
  const stateLabels: Record<string, string> = { MISSING: "ausente", EXCLUDED: "excluida", INVALID: "inválida",
    ACCESS_DENIED: "sin acceso autorizado", NOT_EXECUTED: "no ejecutada", EMPTY_VALID: "sin registros" };
  for (const [field, state] of Object.entries(input.inputStates || {})) {
    if (state && stateLabels[state.state]) limitations.push(`La fuente ${field} está ${stateLabels[state.state]}; esta ausencia no contradice la hipótesis.`);
  }
  limitations.push(...input.exclusions.map(item => `Referencia ${item.itemId} excluida: ${item.reason}`),
    ...input.disclosures.map(item => item.message), ...records.flatMap(record => array(record.item.limitations)),
    ...input.analyses.filter(item => !nonProductive(item)).flatMap(item => array(item.informationGaps)),
    ...convergences.flatMap(result => result.limitations));
  if (contradictions.length) limitations.push("Existen contradicciones no resueltas; la evidencia disponible no permite resolverlas automáticamente.");
  if (candidateConvergences.length) limitations.push("Las convergencias calculadas son propuestas pendientes de revisión PPC; no se han aprobado automáticamente.");
  if (!convergences.length) limitations.push("No hay convergencias independientes revisadas que permitan afirmar soporte integrado.");
  if (envelope.dependencyRelations.some(relation => !relation.countsAsIndependentCorroboration)) limitations.push("Los registros dependientes o con origen desconocido no se cuentan como corroboración independiente.");
  limitations.push("El contexto descriptivo y la asociación espacial no establecen riesgo, causalidad ni predicción.");
  const independentSources = unique(envelope.dependencyRelations.filter(relation => relation.countsAsIndependentCorroboration &&
    groupByItem.get(relation.leftItemId) !== groupByItem.get(relation.rightItemId)).flatMap(relation =>
      [relation.leftItemId, relation.rightItemId].flatMap(id => envelope.items.find(item => item.itemId === id)?.source.sourceEvidenceIds || []))).sort();
  const sourceFingerprint = fingerprint({ records, hypothesis, convergences, envelope });
  const status = supportStatus === "CONTRADICTED" ? "CONTRADICTED" : supportStatus === "SUPPORTED" ? "SUPPORTED" : "INCONCLUSIVE";
  const summary = `Contraste de la hipótesis humana: ${hypothesis.currentHypothesis}. ` +
    (supportStatus === "SUPPORTED" ? "Existen relaciones independientes revisadas que apoyan la hipótesis." :
      supportStatus === "CONTRADICTED" ? "Existen referencias admitidas que contradicen la hipótesis; requieren valoración humana." :
      supportingReferences.length ? "Existen referencias de apoyo, pero el soporte integrado no es concluyente." : "Los datos admitidos son insuficientes para establecer soporte integrado.");
  const result: InstitutionalMultisourceAnalysis = { outputId: `multisource:${input.projectId}:${sourceFingerprint}`, projectId: input.projectId,
    generatedAt: input.generatedAt, geographyId: input.geography?.geographyId || null,
    lineage: records.flatMap(record => array(record.item.lineage)),
    traceabilityIds: unique(rawItems.filter(item => acceptedIds.has(item.id)).flatMap(item => item.traceabilityId ? [item.traceabilityId] : [])).sort(),
    expedienteId: input.projectId, acquisitionMode: "DERIVED", humanValidationStatus: "PENDING_REVIEW", status, supportStatus,
    summary, text: [summary, ...contradictions, ...unique(limitations)].join(" "), envelope, correlation, convergences, candidateConvergences,
    contradictions, sourceDependencies: envelope.dependencyRelations, independentSources, supportingReferences, contradictingReferences,
    limitations: unique(limitations), inventory, provenance: { sourceFingerprint, hypothesisId: hypothesis.hypothesisId || null,
      sourceIds: [...sourceIds].sort(), engines: ["multisourceOrchestrationService", "correlateInstitutionalEvidence", "buildInstitutionalConvergence"] },
    institutionalNarrative: "" };
  result.institutionalNarrative = renderInstitutionalMultisourceNarrative(result, input);
  return result;
}

function normalized(value: string | undefined): string | undefined {
  return present(value)?.toUpperCase();
}

function isNonProductiveToken(value: string | undefined): boolean {
  const token = normalized(value);
  return Boolean(
    token &&
    (token.includes("SIMULAT") ||
      token.includes("MOCK") ||
      token.includes("DEMO") ||
      token.includes("FAKE") ||
      token.includes("STUB"))
  );
}

export function evaluateSourceEligibility(
  source: MultisourceSourceDescriptor
): InstitutionalSourceEligibility {
  if (
    source.authorityClassification === "SIMULATED" ||
    source.integrityClassification === "SIMULATED" ||
    source.authorityClassification === "NON_AUTHORITATIVE" ||
    isNonProductiveToken(source.sourceId) ||
    isNonProductiveToken(source.providerId) ||
    isNonProductiveToken(source.rawSourceReference)
  ) {
    return "INELIGIBLE";
  }

  if (
    source.authorityClassification === "LEGACY_UNCLASSIFIED" ||
    source.authorityClassification === "UNKNOWN" ||
    source.integrityClassification === "READY_WITH_LIMITATIONS" ||
    source.integrityClassification === "LEGACY_UNCLASSIFIED" ||
    source.integrityClassification === "UNKNOWN" ||
    source.integrityClassification === "NOT_READY"
  ) {
    return "LIMITED";
  }

  return "ELIGIBLE";
}

function same(a?: string, b?: string): boolean {
  const left = normalized(a);
  const right = normalized(b);
  return Boolean(left && right && left === right);
}

export function classifySourceDependency(
  left: MultisourceOrchestrationItem,
  right: MultisourceOrchestrationItem
): SourceDependencyType {
  const leftRoots = [...left.source.sourceEvidenceIds || [], ...left.source.dependsOnSourceEvidenceIds || []];
  const rightRoots = [...right.source.sourceEvidenceIds || [], ...right.source.dependsOnSourceEvidenceIds || []];
  if (leftRoots.some(root => rightRoots.includes(root))) {
    return left.source.dependsOnSourceEvidenceIds?.length || right.source.dependsOnSourceEvidenceIds?.length ? "DERIVED" : "SAME_ORIGIN";
  }
  if (same(left.source.captureId, right.source.captureId)) return "SAME_CAPTURE";
  if (same(left.source.operationId, right.source.operationId)) return "SAME_OPERATION";
  if (
    same(left.source.rawSourceReference, right.source.rawSourceReference) ||
    same(left.source.sourceReference, right.source.sourceReference)
  ) return "SAME_ORIGIN";
  if (same(left.source.providerId, right.source.providerId)) return "SAME_PROVIDER";
  if (same(left.source.sourceId, right.source.sourceId)) return "DERIVED";

  const leftProvider = present(left.source.providerId);
  const rightProvider = present(right.source.providerId);
  const leftOrigin = present(left.source.rawSourceReference || left.source.sourceReference);
  const rightOrigin = present(right.source.rawSourceReference || right.source.sourceReference);

  if (leftProvider && rightProvider && leftOrigin && rightOrigin) return "INDEPENDENT";
  return "UNKNOWN_DEPENDENCY";
}

function relation(
  left: MultisourceOrchestrationItem,
  right: MultisourceOrchestrationItem
): SourceDependencyRelation {
  const dependencyType = classifySourceDependency(left, right);
  return {
    leftItemId: left.itemId,
    rightItemId: right.itemId,
    dependencyType,
    countsAsIndependentCorroboration:
      dependencyType === "INDEPENDENT" &&
      left.eligibility === "ELIGIBLE" &&
      right.eligibility === "ELIGIBLE",
  };
}

export function buildMultisourceOrchestrationEnvelope(
  expedienteId: string | null | undefined,
  inputItems: Array<Omit<MultisourceOrchestrationItem, "eligibility">>
): MultisourceOrchestrationEnvelope {
  const items: MultisourceOrchestrationItem[] = inputItems.map((item) => ({
    ...item,
    eligibility: evaluateSourceEligibility(item.source),
  }));

  const dependencyRelations: SourceDependencyRelation[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      dependencyRelations.push(relation(items[i], items[j]));
    }
  }

  const eligible = items.filter((item) => item.eligibility === "ELIGIBLE");
  const eligibleIds = new Set(eligible.map((item) => item.itemId));
  const adjacency = new Map<string, Set<string>>();

  for (const item of eligible) {
    adjacency.set(item.itemId, new Set());
  }

  for (const rel of dependencyRelations) {
    if (rel.dependencyType === "INDEPENDENT") continue;
    if (!eligibleIds.has(rel.leftItemId) || !eligibleIds.has(rel.rightItemId)) continue;

    adjacency.get(rel.leftItemId)?.add(rel.rightItemId);
    adjacency.get(rel.rightItemId)?.add(rel.leftItemId);
  }

  const visited = new Set<string>();
  const groups: string[][] = [];

  for (const item of eligible) {
    if (visited.has(item.itemId)) continue;

    const component: string[] = [];
    const stack = [item.itemId];
    visited.add(item.itemId);

    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);

      for (const neighbor of adjacency.get(current) || []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        stack.push(neighbor);
      }
    }

    groups.push(component);
  }

  const corroborationGroups = groups.map((itemIds, index) => ({
    groupId: `corroboration-group-${index + 1}`,
    itemIds,
    institutionallyEligibleItemIds: [...itemIds],
  }));

  return {
    ...(present(expedienteId) ? { expedienteId: present(expedienteId) } : {}),
    items,
    dependencyRelations,
    corroborationGroups,
    totalItems: items.length,
    eligibleItems: eligible.length,
    independentEligibleSources: corroborationGroups.length,
  };
}
