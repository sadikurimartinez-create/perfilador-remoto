import { evaluateCartographicAdmission, type CartographicAdmissionResult } from "@/utils/cartographicAdmissionGate";
import {
  adaptDenueObservationToGovernedMapLayer,
  type DenueCartographicObservation,
  type DenueGovernedMapLayer,
} from "@/utils/denueGovernedMapAdapter";
import type {
  CanonicalGeographyReference,
  GovernedCartographicProduct,
} from "@/utils/governedCartographicProduct";

export interface DenueGovernedCartographicProductInput {
  projectId: string;
  geographyId: string;
  canonicalGeographyReference: CanonicalGeographyReference;
  observations: DenueCartographicObservation[];
  createdAtReference: string;
}

export interface RejectedDenueCartographicObservation {
  observationId: string | null;
  sourceEvidenceId: string | null;
  reasons: string[];
}

export interface DenueGovernedCartographicProductResult {
  product: GovernedCartographicProduct | null;
  admission: CartographicAdmissionResult;
  acceptedLayerIds: string[];
  rejectedObservations: RejectedDenueCartographicObservation[];
  duplicateObservationCount: number;
}

const PRODUCT_LIMITATIONS = [
  "DENUE_TERRITORIAL_CONTEXT_ONLY",
  "DENUE_NOT_CRIMINAL_EVIDENCE",
  "DENUE_NOT_FINDING",
  "DENUE_NOT_RISK_ASSESSMENT",
  "DENUE_NO_CAUSAL_INFERENCE",
];

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value as Record<string, unknown>)
    .sort((left, right) => left.localeCompare(right))
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = stableValue((value as Record<string, unknown>)[key]);
      return result;
    }, {});
}

function stableFingerprint(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function rejection(
  observation: Partial<DenueCartographicObservation> | null | undefined,
  reasons: string[]
): RejectedDenueCartographicObservation {
  return {
    observationId: present(observation?.id) ? observation.id : null,
    sourceEvidenceId: present(observation?.sourceEvidenceId) ? observation.sourceEvidenceId : null,
    reasons: uniqueSorted(reasons),
  };
}

function sortRejections(items: RejectedDenueCartographicObservation[]): RejectedDenueCartographicObservation[] {
  return [...items].sort((left, right) => stableFingerprint(left).localeCompare(stableFingerprint(right)));
}

function rejectedResult(reasons: string[], rejectedObservations: RejectedDenueCartographicObservation[] = []): DenueGovernedCartographicProductResult {
  return {
    product: null,
    admission: { accepted: false, status: "REJECTED", reasons: uniqueSorted(reasons) },
    acceptedLayerIds: [],
    rejectedObservations: sortRejections(rejectedObservations),
    duplicateObservationCount: 0,
  };
}

export function buildDenueGovernedCartographicProduct(
  input: DenueGovernedCartographicProductInput
): DenueGovernedCartographicProductResult {
  const contextReasons: string[] = [];
  if (!present(input?.projectId)) contextReasons.push("PROJECT_ID_REQUIRED");
  if (!present(input?.geographyId)) contextReasons.push("GEOGRAPHY_ID_REQUIRED");
  if (!present(input?.createdAtReference)) contextReasons.push("CREATED_AT_REFERENCE_REQUIRED");
  if (!input?.canonicalGeographyReference) contextReasons.push("CANONICAL_GEOGRAPHY_REFERENCE_REQUIRED");
  else if (input.canonicalGeographyReference.geographyId !== input.geographyId) contextReasons.push("CANONICAL_GEOGRAPHY_ID_MISMATCH");
  if (!Array.isArray(input?.observations) || input.observations.length === 0) contextReasons.push("DENUE_OBSERVATIONS_REQUIRED");
  if (contextReasons.length > 0) return rejectedResult(contextReasons);

  const productId = `denue:observation-map:${input.geographyId}`;
  const grouped = new Map<string, DenueCartographicObservation[]>();
  const rejectedObservations: RejectedDenueCartographicObservation[] = [];

  for (const observation of input.observations) {
    if (!present(observation?.sourceEvidenceId)) {
      rejectedObservations.push(rejection(observation, ["SOURCE_EVIDENCE_ID_REQUIRED"]));
      continue;
    }
    const group = grouped.get(observation.sourceEvidenceId) || [];
    group.push(observation);
    grouped.set(observation.sourceEvidenceId, group);
  }

  const acceptedLayers: DenueGovernedMapLayer[] = [];
  let duplicateObservationCount = 0;
  for (const sourceEvidenceId of Array.from(grouped.keys()).sort((left, right) => left.localeCompare(right))) {
    const observations = grouped.get(sourceEvidenceId)!;
    const adapted = observations.map((observation) => ({
      observation,
      result: observation.geographyId === input.geographyId
        ? adaptDenueObservationToGovernedMapLayer(observation, { productId })
        : { status: "REJECTED" as const, layer: null, reasons: ["DENUE_GEOGRAPHY_ID_MISMATCH"] },
    }));
    const successful = adapted.filter((item): item is typeof item & { result: { status: "ADAPTED"; layer: DenueGovernedMapLayer; reasons: [] } } => item.result.status === "ADAPTED");
    const fingerprints = uniqueSorted(successful.map((item) => stableFingerprint(item.result.layer)));
    const hasConflict = observations.length > 1 && (successful.length !== observations.length || fingerprints.length !== 1);

    if (hasConflict) {
      adapted.forEach((item) => rejectedObservations.push(rejection(item.observation, [
        ...item.result.reasons,
        "DENUE_DUPLICATE_IDENTITY_CONFLICT",
      ])));
      continue;
    }

    if (successful.length === 0) {
      adapted.forEach((item) => rejectedObservations.push(rejection(item.observation, item.result.reasons)));
      continue;
    }

    acceptedLayers.push(successful[0].result.layer);
    duplicateObservationCount += observations.length - 1;
  }

  acceptedLayers.sort((left, right) => left.layerId.localeCompare(right.layerId));
  if (acceptedLayers.length === 0) {
    return {
      ...rejectedResult(["DENUE_PRODUCT_NO_ADMITTED_LAYERS"], rejectedObservations),
      duplicateObservationCount,
    };
  }

  const publicationEligibility = acceptedLayers.some((layer) => layer.publicationEligibility === "ELIGIBLE_WITH_DISCLOSURE")
    ? "ELIGIBLE_WITH_DISCLOSURE" as const
    : "ELIGIBLE" as const;
  const product: GovernedCartographicProduct = {
    productId,
    productType: "OBSERVATION_MAP",
    geographyId: input.geographyId,
    canonicalGeographyReference: { ...input.canonicalGeographyReference },
    title: "OBSERVACIONES TERRITORIALES DENUE",
    purpose: "Contexto territorial observado de establecimientos DENUE",
    layers: acceptedLayers,
    sourceReferences: uniqueSorted(acceptedLayers.map((layer) => layer.sourceReference)),
    traceabilityIds: uniqueSorted(acceptedLayers.flatMap((layer) => layer.traceabilityIds)),
    limitations: uniqueSorted([
      ...PRODUCT_LIMITATIONS,
      ...acceptedLayers.flatMap((layer) => layer.limitations),
    ]),
    publicationEligibility,
    humanReviewStatus: "UNREVIEWED",
    createdAtReference: input.createdAtReference,
  };
  const admission = evaluateCartographicAdmission(product);

  return {
    product: admission.accepted ? product : null,
    admission,
    acceptedLayerIds: admission.accepted ? acceptedLayers.map((layer) => layer.layerId) : [],
    rejectedObservations: sortRejections(rejectedObservations),
    duplicateObservationCount,
  };
}
