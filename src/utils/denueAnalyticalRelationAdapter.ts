import type { Coordinate } from "@/lib/providers/spatialLayerEngine";
import type { StreetViewFinding } from "@/services/streetViewFindingService";
import { GeointGovernanceStatus } from "@/types/geointGovernance";
import type { GeoEvidence } from "@/types/geointEvidence";
import type { EvidenceRelationship } from "@/utils/evidenceRelationshipEngine";
import type { ExecutiveFinding } from "@/utils/executiveGeointReportModel";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import {
  buildDenueAnalyticalRelation,
  type DenueAnalyticalRelation,
  type DenueAnalyticalRelationType,
  type DenueMeasuredFact,
} from "@/utils/denueAnalyticalRelation";
import type { DenueCanonicalPoi } from "@/utils/denueCanonicalPoi";
import type { DenueGovernedMapLayer } from "@/utils/denueGovernedMapAdapter";
import { validateLineage, type CanonicalLineageNode } from "@/utils/evidenceLineage";
import {
  classifyConvergenceTemporal,
  classifySourceIndependence,
  type ConvergenceCompatibility,
  type ConvergenceSourceEntry,
  type SourceIndependence,
} from "@/utils/institutionalMultisourceConvergence";
import {
  isValidDenueRelationCoordinate,
  measureDenueAgainstCanonicalGeography,
  measureDenuePointDistance,
} from "@/utils/denueSpatialRelationMetrics";

export interface GovernedDenueAnalyticalObservation {
  poi: Omit<DenueCanonicalPoi, "raw">;
  layer: DenueGovernedMapLayer;
}

export interface VerifiedErgLink {
  relationship: EvidenceRelationship;
  reference: string;
}

export type DenueAnalyticalCandidateResult =
  | { status: "CANDIDATE"; relation: DenueAnalyticalRelation; reasons: [] }
  | { status: "REJECTED"; relation: null; reasons: string[] };

export interface DenueAnalyticalCandidateBatch {
  candidates: DenueAnalyticalRelation[];
  rejected: Array<{ sourceId: string; reasons: string[] }>;
  conflicts: Array<{ relationId: string; reason: "RELATION_ID_CONFLICT" }>;
}

interface CommonCandidateInput {
  denue: GovernedDenueAnalyticalObservation;
  canonicalGeography: CanonicalProjectGeography;
  maxCandidateDistanceMeters: number;
  methodologyVersion: string;
  explicitErgLink?: VerifiedErgLink | null;
}

interface GovernedPointSource {
  id: string;
  sourceEvidenceId: string;
  traceabilityId: string;
  expedienteId: string;
  geographyId: string;
  coordinates: Coordinate;
  timestamp?: string | null;
  lineage: CanonicalLineageNode[];
}

const BASE_LIMITATIONS = [
  { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
  { code: "PROXIMITY_NOT_CAUSALITY" },
  { code: "HUMAN_VALIDATION_REQUIRED" },
] as const;

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function stableIdentityPart(value: string): string {
  return encodeURIComponent(value.trim());
}

function relationId(
  denueSourceEvidenceId: string,
  linkedSourceRefs: string[],
  relationTypes: DenueAnalyticalRelationType[],
  methodologyVersion: string
): string {
  return [
    "denue-relation",
    methodologyVersion,
    denueSourceEvidenceId,
    [...linkedSourceRefs].sort().join("+"),
    [...relationTypes].sort().join("+"),
  ].map(stableIdentityPart).join(":");
}

function mergeLineage(...groups: CanonicalLineageNode[][]): CanonicalLineageNode[] {
  const nodes = new Map<string, CanonicalLineageNode>();
  for (const node of groups.flat()) {
    const key = `${node.type}:${node.id}`;
    const existing = nodes.get(key);
    if (!existing) nodes.set(key, { ...node });
    else if (JSON.stringify(existing) !== JSON.stringify(node)) {
      nodes.set(`${key}:conflict:${nodes.size}`, { ...node });
    }
  }
  return Array.from(nodes.values());
}

function temporalCompatibility(left?: string | null, right?: string | null): ConvergenceCompatibility {
  if (!present(left) || !present(right)) return "UNKNOWN";
  const leftClass = classifyConvergenceTemporal(left);
  const rightClass = classifyConvergenceTemporal(right);
  if (leftClass === "UNKNOWN" || rightClass === "UNKNOWN") return "UNKNOWN";
  if ((leftClass === "CURRENT" && rightClass === "HISTORICAL") ||
    (leftClass === "HISTORICAL" && rightClass === "CURRENT")) return "PARTIAL";
  return "COMPATIBLE";
}

function validateDenueObservationContext(
  input: Pick<CommonCandidateInput, "denue" | "canonicalGeography" | "methodologyVersion">
): string[] {
  const { poi, layer } = input.denue;
  const reasons: string[] = [];
  if (!present(input.methodologyVersion)) reasons.push("METHODOLOGY_VERSION_REQUIRED");
  if (!present(poi?.sourceEvidenceId)) reasons.push("DENUE_SOURCE_EVIDENCE_ID_REQUIRED");
  if (!present(poi?.traceabilityId)) reasons.push("DENUE_TRACEABILITY_ID_REQUIRED");
  if (!present(poi?.expedienteId)) reasons.push("DENUE_EXPEDIENTE_ID_REQUIRED");
  if (!present(poi?.geographyId)) reasons.push("DENUE_GEOGRAPHY_ID_REQUIRED");
  if (!isValidDenueRelationCoordinate(poi?.coordinates)) reasons.push("DENUE_COORDINATES_INVALID");
  if (poi?.territorialStatus !== "INSTITUTIONAL" || poi?.source !== "DENUE" || poi?.provider !== "INEGI_DENUE") {
    reasons.push("DENUE_NOT_GOVERNED");
  }
  if (layer?.layerId !== poi?.sourceEvidenceId || layer?.epistemicClass !== "OBSERVED") reasons.push("DENUE_LAYER_IDENTITY_MISMATCH");
  if (layer?.geographyId !== poi?.geographyId) reasons.push("DENUE_LAYER_GEOGRAPHY_MISMATCH");
  if (input.canonicalGeography?.geographyId !== poi?.geographyId) reasons.push("CANONICAL_GEOGRAPHY_ID_MISMATCH");
  if (validateLineage(layer?.lineage).status !== "SUPPORTED") reasons.push("DENUE_LINEAGE_INVALID");
  if (!layer?.lineage?.some((node) => node.type === "EVIDENCE" && node.evidenceId === poi?.sourceEvidenceId)) {
    reasons.push("DENUE_LINEAGE_SOURCE_MISSING");
  }
  return unique(reasons);
}

function validateDenueContext(input: CommonCandidateInput): string[] {
  const reasons = validateDenueObservationContext(input);
  if (typeof input.maxCandidateDistanceMeters !== "number" || !Number.isFinite(input.maxCandidateDistanceMeters) || input.maxCandidateDistanceMeters <= 0) {
    reasons.push("MAX_CANDIDATE_DISTANCE_INVALID");
  }
  return unique(reasons);
}

function validatePointSource(denue: GovernedDenueAnalyticalObservation, source: GovernedPointSource): string[] {
  const reasons: string[] = [];
  if (!present(source.id)) reasons.push("SOURCE_ID_REQUIRED");
  if (!present(source.sourceEvidenceId)) reasons.push("SOURCE_EVIDENCE_ID_REQUIRED");
  if (!present(source.traceabilityId)) reasons.push("SOURCE_TRACEABILITY_ID_REQUIRED");
  if (source.expedienteId !== denue.poi.expedienteId) reasons.push("EXPEDIENTE_MISMATCH");
  if (source.geographyId !== denue.poi.geographyId) reasons.push("GEOGRAPHY_MISMATCH");
  if (!isValidDenueRelationCoordinate(source.coordinates)) reasons.push("SOURCE_COORDINATES_INVALID");
  if (validateLineage(source.lineage).status !== "SUPPORTED") reasons.push("SOURCE_LINEAGE_INVALID");
  if (!source.lineage.some((node) =>
    node.type === "EVIDENCE" &&
    [node.id, node.evidenceId].some((identity) => identity === source.id || identity === source.sourceEvidenceId)
  )) {
    reasons.push("SOURCE_LINEAGE_EVIDENCE_MISSING");
  }
  if (source.lineage.some((node) => present(node.geographyId) && node.geographyId !== denue.poi.geographyId)) {
    reasons.push("SOURCE_LINEAGE_GEOGRAPHY_MISMATCH");
  }
  return unique(reasons);
}

function validateErgLink(
  link: VerifiedErgLink | null | undefined,
  denue: GovernedDenueAnalyticalObservation,
  source: GovernedPointSource
): string[] {
  if (!link) return [];
  const reasons: string[] = [];
  if (!present(link.reference) || !present(link.relationship?.id)) reasons.push("ERG_LINK_REFERENCE_REQUIRED");
  if (link.relationship?.projectId !== denue.poi.expedienteId) reasons.push("ERG_LINK_EXPEDIENTE_MISMATCH");
  if (![source.id, source.sourceEvidenceId].includes(link.relationship?.evidenceId)) reasons.push("ERG_LINK_EVIDENCE_MISMATCH");
  return reasons;
}

function measuredFact(
  relationIdentity: string,
  metric: string,
  value: string | number | boolean,
  sourceRefs: string[],
  unit: string | null = null
): DenueMeasuredFact {
  return {
    factId: `${relationIdentity}:fact:${stableIdentityPart(metric)}`,
    metric,
    value,
    unit,
    sourceRefs,
  };
}

function buildPointCandidate(
  input: CommonCandidateInput & {
    source: GovernedPointSource;
    relationTypes?: DenueAnalyticalRelationType[];
    linkedEvidenceIds?: string[];
    linkedFindingIds?: string[];
    additionalLineage?: CanonicalLineageNode[];
  }
): DenueAnalyticalCandidateResult {
  const reasons = [
    ...validateDenueContext(input),
    ...validatePointSource(input.denue, input.source),
    ...validateErgLink(input.explicitErgLink, input.denue, input.source),
  ];
  if (reasons.length > 0) return { status: "REJECTED", relation: null, reasons: unique(reasons) };

  const distanceMeters = measureDenuePointDistance(input.denue.poi.coordinates, input.source.coordinates);
  if (distanceMeters === null) return { status: "REJECTED", relation: null, reasons: ["DISTANCE_INVALID"] };
  if (distanceMeters > input.maxCandidateDistanceMeters) {
    return { status: "REJECTED", relation: null, reasons: ["OUTSIDE_TECHNICAL_CANDIDATE_DISTANCE"] };
  }
  const geographyMeasurement = measureDenueAgainstCanonicalGeography(input.denue.poi.coordinates, input.canonicalGeography);
  if (geographyMeasurement.status === "REJECTED") {
    return { status: "REJECTED", relation: null, reasons: geographyMeasurement.reasons };
  }

  const relationTypes = unique([
    "SPATIAL_PROXIMITY",
    ...(input.relationTypes || []),
    ...(input.explicitErgLink ? ["EXPLICIT_SOURCE_LINK", "EVIDENCE_COINCIDENCE"] : []),
  ]) as DenueAnalyticalRelationType[];
  const linkedSourceRefs = unique([
    input.denue.poi.sourceEvidenceId,
    input.source.sourceEvidenceId,
    ...(input.explicitErgLink ? [input.explicitErgLink.reference] : []),
  ]);
  const identity = relationId(input.denue.poi.sourceEvidenceId, linkedSourceRefs, relationTypes, input.methodologyVersion);
  const temporal = temporalCompatibility(
    input.denue.poi.observedAt || input.denue.poi.acquiredAt,
    input.source.timestamp
  );
  const contextMetrics = geographyMeasurement.measurement;
  const facts: DenueMeasuredFact[] = [
    measuredFact(identity, "distanceMeters", distanceMeters, linkedSourceRefs, "METERS"),
    measuredFact(identity, "temporalCompatibility", temporal, linkedSourceRefs),
  ];
  if (contextMetrics.distanceToCanonicalPointMeters !== undefined) {
    facts.push(measuredFact(identity, "distanceToCanonicalPointMeters", contextMetrics.distanceToCanonicalPointMeters, [input.denue.poi.sourceEvidenceId], "METERS"));
  }
  if (contextMetrics.distanceToCorridorMeters !== undefined) {
    facts.push(measuredFact(identity, "distanceToCorridorMeters", contextMetrics.distanceToCorridorMeters, [input.denue.poi.sourceEvidenceId], "METERS"));
  }
  if (contextMetrics.insideCanonicalGeography !== undefined) {
    facts.push(measuredFact(identity, "insideCanonicalGeography", contextMetrics.insideCanonicalGeography, [input.denue.poi.sourceEvidenceId]));
  }
  if (contextMetrics.distanceToBoundaryMeters !== undefined) {
    facts.push(measuredFact(identity, "distanceToBoundaryMeters", contextMetrics.distanceToBoundaryMeters, [input.denue.poi.sourceEvidenceId], "METERS"));
  }
  if (input.explicitErgLink) facts.push(measuredFact(identity, "explicitSourceLink", true, [input.explicitErgLink.reference]));

  const built = buildDenueAnalyticalRelation({
    relationId: identity,
    denueLayerId: input.denue.layer.layerId,
    sourceEvidenceId: input.denue.poi.sourceEvidenceId,
    expedienteId: input.denue.poi.expedienteId,
    geographyId: input.denue.poi.geographyId,
    relationTypes,
    linkedEvidenceIds: unique(input.linkedEvidenceIds || []),
    linkedFindingIds: unique(input.linkedFindingIds || []),
    linkedHypothesisRefs: [],
    linkedSourceRefs,
    spatialMetrics: {
      unit: "METERS",
      method: `SpatialLayerEngine.getDistance+${contextMetrics.method}`,
      distanceMeters,
      distanceToCorridorMeters: contextMetrics.distanceToCorridorMeters,
      insideCanonicalGeography: contextMetrics.insideCanonicalGeography,
      distanceToBoundaryMeters: contextMetrics.distanceToBoundaryMeters,
    },
    temporalCompatibility: temporal,
    sourceIndependence: {
      status: "UNKNOWN",
      assessedSourceRefs: linkedSourceRefs,
      independentSourceRefs: [],
      rationale: ["SIMPLE_RELATION_INDEPENDENCE_NOT_ASSERTED"],
    },
    lineage: mergeLineage(input.denue.layer.lineage, input.source.lineage, input.additionalLineage || []),
    measuredFacts: facts,
    proposedInterpretations: [],
    limitations: BASE_LIMITATIONS.map((limitation) => ({ ...limitation })),
    machineAssessment: { status: "DETECTED", reasonCodes: ["MEASURED_SPATIAL_RELATION"] },
    humanValidation: { status: "PENDING", validatedBy: null, validatedAt: null, rationale: null },
    publicationEligibility: "INELIGIBLE",
    methodologyVersion: input.methodologyVersion,
  });
  return built.validation.valid
    ? { status: "CANDIDATE", relation: built.relation, reasons: [] }
    : { status: "REJECTED", relation: null, reasons: built.validation.reasons.map((reason) => `RELATION_INVALID:${reason}`) };
}

function geoEvidenceSource(evidence: GeoEvidence): GovernedPointSource {
  return {
    id: evidence.id,
    sourceEvidenceId: evidence.sourceEvidenceId,
    traceabilityId: evidence.traceabilityId,
    expedienteId: evidence.expedienteId,
    geographyId: evidence.geographyId || "",
    coordinates: {
      lat: evidence.coordinates?.lat as number,
      lng: evidence.coordinates?.lng as number,
    },
    timestamp: evidence.captureDate,
    lineage: evidence.lineage || [],
  };
}

export function adaptDenueGeoEvidenceCandidate(
  input: CommonCandidateInput & { evidence: GeoEvidence }
): DenueAnalyticalCandidateResult {
  if (input.evidence?.status !== GeointGovernanceStatus.APPROVED_EVIDENCE) {
    return { status: "REJECTED", relation: null, reasons: ["EVIDENCE_NOT_GOVERNED_APPROVED"] };
  }
  return buildPointCandidate({
    ...input,
    source: geoEvidenceSource(input.evidence),
    linkedEvidenceIds: [input.evidence.id],
  });
}

export function adaptDenueStreetViewCandidate(
  input: CommonCandidateInput & { finding: StreetViewFinding }
): DenueAnalyticalCandidateResult {
  if (input.finding?.estado !== GeointGovernanceStatus.APPROVED_EVIDENCE) {
    return { status: "REJECTED", relation: null, reasons: ["STREET_VIEW_NOT_GOVERNED_APPROVED"] };
  }
  const sourceEvidenceId = input.finding.sourceEvidenceId || "";
  return buildPointCandidate({
    ...input,
    source: {
      id: input.finding.id,
      sourceEvidenceId,
      traceabilityId: input.finding.traceabilityId,
      expedienteId: input.finding.expedienteId,
      geographyId: input.finding.geographyId || "",
      coordinates: input.finding.coordenadas,
      timestamp: input.finding.fechaCreacion,
      lineage: input.finding.lineage || [],
    },
    linkedEvidenceIds: [sourceEvidenceId],
  });
}

export function adaptDenueFindingCandidates(
  input: CommonCandidateInput & { finding: ExecutiveFinding; evidenceRegistry: GeoEvidence[] }
): DenueAnalyticalCandidateBatch {
  const formalEvidenceRefs = unique([
    ...(input.finding?.evidenceReferences || []),
    ...(input.finding?.technicalMetadata?.sourceEvidenceIds || []),
  ]);
  const linkedEvidence = input.evidenceRegistry.filter((evidence) =>
    formalEvidenceRefs.includes(evidence.id) || formalEvidenceRefs.includes(evidence.sourceEvidenceId)
  );
  if (!present(input.finding?.findingId) || linkedEvidence.length === 0) {
    return {
      candidates: [],
      rejected: [{ sourceId: input.finding?.findingId || "UNKNOWN", reasons: ["FINDING_WITHOUT_GEOREFERENCED_EVIDENCE"] }],
      conflicts: [],
    };
  }

  const results = linkedEvidence.map((evidence) => {
    if (evidence.status !== GeointGovernanceStatus.APPROVED_EVIDENCE) {
      return { status: "REJECTED", relation: null, reasons: ["EVIDENCE_NOT_GOVERNED_APPROVED"] } as DenueAnalyticalCandidateResult;
    }
    const source = geoEvidenceSource(evidence);
    const evidenceLineageId = source.lineage.find((node) =>
      node.type === "EVIDENCE" &&
      [node.id, node.evidenceId].some((identity) => identity === evidence.id || identity === evidence.sourceEvidenceId)
    )?.id;
    if (!evidenceLineageId) {
      return { status: "REJECTED", relation: null, reasons: ["SOURCE_LINEAGE_EVIDENCE_MISSING"] } as DenueAnalyticalCandidateResult;
    }
    const findingNode: CanonicalLineageNode = {
      id: input.finding.findingId,
      type: "FINDING",
      findingId: input.finding.findingId,
      geographyId: source.geographyId,
      supportingEvidenceIds: [evidenceLineageId],
    };
    return buildPointCandidate({
      ...input,
      source,
      relationTypes: ["FINDING_RELATION"],
      linkedEvidenceIds: [evidence.id],
      linkedFindingIds: [input.finding.findingId],
      additionalLineage: [findingNode],
    });
  });
  return deduplicateDenueAnalyticalCandidates(results.map((result, index) => ({
    sourceId: linkedEvidence[index].id,
    result,
  })));
}

function pairwise<T>(values: T[]): Array<[T, T]> {
  const pairs: Array<[T, T]> = [];
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) pairs.push([values[left], values[right]]);
  }
  return pairs;
}

function aggregateTemporal(sources: ConvergenceSourceEntry[]): ConvergenceCompatibility {
  if (sources.some((source) => !present(source.timestamp))) return "UNKNOWN";
  const classes = unique(sources.map((source) => source.temporalClass || classifyConvergenceTemporal(source.timestamp)));
  if (classes.includes("UNKNOWN")) return "UNKNOWN";
  if (classes.includes("CURRENT") && classes.includes("HISTORICAL")) return "PARTIAL";
  return "COMPATIBLE";
}

export function adaptDenueMultisourceCandidate(input: {
  denue: GovernedDenueAnalyticalObservation;
  canonicalGeography: CanonicalProjectGeography;
  sources: ConvergenceSourceEntry[];
  methodologyVersion: string;
}): DenueAnalyticalCandidateResult {
  const reasons = validateDenueObservationContext(input);
  const sources = Array.isArray(input.sources) ? input.sources : [];
  if (sources.length < 2) reasons.push("MULTISOURCE_REQUIRES_TWO_SOURCES");
  if (new Set(sources.map((source) => source.sourceEvidenceId)).size !== sources.length) reasons.push("MULTISOURCE_DUPLICATED_SOURCE");
  for (const source of sources) {
    if (!present(source.sourceId) || !present(source.sourceEvidenceId) || !present(source.traceabilityId)) reasons.push("MULTISOURCE_IDENTITY_INCOMPLETE");
    if (source.expedienteId !== input.denue.poi.expedienteId) reasons.push("EXPEDIENTE_MISMATCH");
    if (source.geographyId !== input.denue.poi.geographyId) reasons.push("GEOGRAPHY_MISMATCH");
    if (validateLineage(source.lineage).status !== "SUPPORTED") reasons.push("SOURCE_LINEAGE_INVALID");
    if (["MOCK", "SIMULATED", "TEST", "CONNECTIVITY_ONLY"].includes(source.acquisitionMode || "")) reasons.push("SOURCE_ACQUISITION_NOT_GOVERNED");
  }
  const dependencies = pairwise(sources).map(([left, right]) => classifySourceIndependence(left, right));
  const independentSourceIds = unique(dependencies
    .filter((dependency) => dependency.independence === "INDEPENDENT")
    .flatMap((dependency) => [dependency.sourceA, dependency.sourceB]));
  if (independentSourceIds.length < 2) reasons.push("MULTISOURCE_INDEPENDENCE_NOT_ESTABLISHED");
  if (reasons.length > 0) return { status: "REJECTED", relation: null, reasons: unique(reasons) };

  const sourceRefs = unique([input.denue.poi.sourceEvidenceId, ...sources.map((source) => source.sourceEvidenceId)]);
  const relationTypes: DenueAnalyticalRelationType[] = ["MULTISOURCE_CORROBORATION"];
  const identity = relationId(input.denue.poi.sourceEvidenceId, sourceRefs, relationTypes, input.methodologyVersion);
  const temporal = aggregateTemporal(sources);
  const allIndependent = dependencies.every((dependency) => dependency.independence === "INDEPENDENT");
  const independenceStatus: SourceIndependence = allIndependent ? "INDEPENDENT" : "PARTIALLY_DEPENDENT";
  const independentSourceRefs = unique(sources
    .filter((source) => independentSourceIds.includes(source.sourceId))
    .map((source) => source.sourceEvidenceId));
  const built = buildDenueAnalyticalRelation({
    relationId: identity,
    denueLayerId: input.denue.layer.layerId,
    sourceEvidenceId: input.denue.poi.sourceEvidenceId,
    expedienteId: input.denue.poi.expedienteId,
    geographyId: input.denue.poi.geographyId,
    relationTypes,
    linkedEvidenceIds: [],
    linkedFindingIds: [],
    linkedHypothesisRefs: [],
    linkedSourceRefs: sourceRefs,
    spatialMetrics: null,
    temporalCompatibility: temporal,
    sourceIndependence: {
      status: independenceStatus,
      assessedSourceRefs: sources.map((source) => source.sourceEvidenceId),
      independentSourceRefs,
      rationale: unique(dependencies.map((dependency) => dependency.reason)),
    },
    lineage: mergeLineage(input.denue.layer.lineage, ...sources.map((source) => source.lineage)),
    measuredFacts: [
      measuredFact(identity, "sourceCount", sources.length, sourceRefs),
      measuredFact(identity, "independentSourceCount", independentSourceRefs.length, sourceRefs),
      measuredFact(identity, "temporalCompatibility", temporal, sourceRefs),
    ],
    proposedInterpretations: [],
    limitations: [
      { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
      { code: "HUMAN_VALIDATION_REQUIRED" },
      { code: "CORROBORATION_NOT_CAUSALITY" },
    ],
    machineAssessment: { status: "DETECTED", reasonCodes: ["INDEPENDENT_SOURCES_MEASURED"] },
    humanValidation: { status: "PENDING", validatedBy: null, validatedAt: null, rationale: null },
    publicationEligibility: "INELIGIBLE",
    methodologyVersion: input.methodologyVersion,
  });
  return built.validation.valid
    ? { status: "CANDIDATE", relation: built.relation, reasons: [] }
    : { status: "REJECTED", relation: null, reasons: built.validation.reasons.map((reason) => `RELATION_INVALID:${reason}`) };
}

export function rejectAdr022AggregateForDenueRelation(_aggregate: unknown): DenueAnalyticalCandidateResult {
  return { status: "REJECTED", relation: null, reasons: ["ADR022_AGGREGATE_NOT_INDIVIDUALIZED"] };
}

export function rejectUnsupportedDenueAnalyticalSource(sourceKind: string): DenueAnalyticalCandidateResult {
  return {
    status: "REJECTED",
    relation: null,
    reasons: [sourceKind === "OSINT_NAME_ONLY" ? "OSINT_NAME_ONLY_FORBIDDEN" : "SOURCE_KIND_UNSUPPORTED"],
  };
}

export function deduplicateDenueAnalyticalCandidates(
  entries: Array<{ sourceId: string; result: DenueAnalyticalCandidateResult }>
): DenueAnalyticalCandidateBatch {
  const candidates = new Map<string, DenueAnalyticalRelation>();
  const rejected: DenueAnalyticalCandidateBatch["rejected"] = [];
  const conflicts: DenueAnalyticalCandidateBatch["conflicts"] = [];
  for (const entry of entries) {
    if (entry.result.status === "REJECTED") {
      rejected.push({ sourceId: entry.sourceId, reasons: entry.result.reasons });
      continue;
    }
    const existing = candidates.get(entry.result.relation.relationId);
    if (!existing) candidates.set(entry.result.relation.relationId, entry.result.relation);
    else if (JSON.stringify(existing) !== JSON.stringify(entry.result.relation)) {
      candidates.delete(entry.result.relation.relationId);
      conflicts.push({ relationId: entry.result.relation.relationId, reason: "RELATION_ID_CONFLICT" });
    }
  }
  return { candidates: Array.from(candidates.values()), rejected, conflicts };
}
