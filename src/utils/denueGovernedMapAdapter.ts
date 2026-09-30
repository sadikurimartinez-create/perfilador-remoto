import type { PublicationEligibility } from "@/utils/institutionalReportPublicationContract";
import type { DenueCanonicalPoi } from "@/utils/denueCanonicalPoi";
import { buildEvidenceLineage } from "@/utils/evidenceLineage";
import type { ObservedGovernedMapLayer } from "@/utils/governedCartographicProduct";

export type DenueCartographicObservation = Omit<DenueCanonicalPoi, "raw"> & {
  category?: string | null;
  activityCategory?: string | null;
  distanceMeters?: number | null;
  publicationEligibility?: PublicationEligibility | null;
};

export interface DenueObservedProperties {
  name: string;
  activityCode: string;
  address: string;
  provider: "INEGI_DENUE";
  publicationRole: "TERRITORIAL_CONTEXT";
  semanticRole: "SOURCE_FACT";
  isCriminalEvidence: false;
  rawSourceReference: string;
  category?: string;
  distanceMeters?: number;
}

export type DenueGovernedMapLayer = ObservedGovernedMapLayer & {
  observedProperties: DenueObservedProperties;
};

export type DenueGovernedMapAdaptationResult =
  | { status: "ADAPTED"; layer: DenueGovernedMapLayer; reasons: [] }
  | { status: "REJECTED"; layer: null; reasons: string[] };

const PUBLICATION_ELIGIBILITY = new Set<PublicationEligibility>([
  "ELIGIBLE",
  "ELIGIBLE_WITH_DISCLOSURE",
  "INELIGIBLE",
]);

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function validLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function institutionalPublicationEligibility(observation: DenueCartographicObservation): PublicationEligibility | null {
  if (observation.publicationEligibility != null) {
    return PUBLICATION_ELIGIBILITY.has(observation.publicationEligibility) ? observation.publicationEligibility : null;
  }
  const integrity = observation.epistemicIntegrity;
  const institutionallyAdmitted =
    observation.territorialStatus === "INSTITUTIONAL" &&
    observation.publicationRole === "TERRITORIAL_CONTEXT" &&
    observation.semanticRole === "SOURCE_FACT" &&
    observation.isCriminalEvidence === false &&
    integrity?.acquisitionMode === "OBSERVED" &&
    integrity?.acquisitionStatus === "ACQUIRED" &&
    integrity?.isSimulated === false;
  return institutionallyAdmitted ? "ELIGIBLE" : null;
}

export function adaptDenueObservationToGovernedMapLayer(
  input: DenueCartographicObservation,
  context: { productId: string }
): DenueGovernedMapAdaptationResult {
  const observation = input as DenueCartographicObservation & { geometry?: unknown };
  const reasons: string[] = [];
  const integrity = observation?.epistemicIntegrity;

  if (!present(context?.productId)) reasons.push("PRODUCT_ID_REQUIRED");
  if (!present(observation?.id)) reasons.push("DENUE_ID_REQUIRED");
  if (!validLatitude(observation?.lat)) reasons.push("DENUE_LATITUDE_INVALID");
  if (!validLongitude(observation?.lng)) reasons.push("DENUE_LONGITUDE_INVALID");
  if (!observation?.coordinates || !validLatitude(observation.coordinates.lat) || !validLongitude(observation.coordinates.lng)) {
    reasons.push("DENUE_COORDINATES_INVALID");
  } else if (observation.coordinates.lat !== observation.lat || observation.coordinates.lng !== observation.lng) {
    reasons.push("DENUE_COORDINATE_FIELDS_MISMATCH");
  }
  if (observation?.lat === 0 && observation?.lng === 0) reasons.push("DENUE_NULL_ISLAND_FORBIDDEN");
  if (observation?.geometry !== undefined) reasons.push("DENUE_PRECOMPUTED_GEOMETRY_FORBIDDEN");
  if (!present(observation?.geographyId)) reasons.push("GEOGRAPHY_ID_REQUIRED");
  if (!present(observation?.sourceEvidenceId)) reasons.push("SOURCE_EVIDENCE_ID_REQUIRED");
  if (!present(observation?.traceabilityId)) reasons.push("TRACEABILITY_ID_REQUIRED");
  if (!present(observation?.sourceReference)) reasons.push("SOURCE_REFERENCE_REQUIRED");
  if (!present(observation?.rawSourceReference)) reasons.push("RAW_SOURCE_REFERENCE_REQUIRED");
  if (observation?.source !== "DENUE" || observation?.provider !== "INEGI_DENUE") reasons.push("DENUE_SOURCE_IDENTITY_INVALID");
  if (observation?.territorialStatus !== "INSTITUTIONAL") reasons.push("DENUE_NOT_INSTITUTIONAL");
  if (integrity?.acquisitionMode !== "OBSERVED") reasons.push("DENUE_NOT_OBSERVED");
  if (integrity?.acquisitionStatus !== "ACQUIRED") reasons.push("DENUE_NOT_ACQUIRED");
  if (integrity?.isSimulated !== false) reasons.push("DENUE_SIMULATION_STATUS_INVALID");
  if (!present(integrity?.sourceId)) reasons.push("DENUE_SOURCE_ID_REQUIRED");
  if (integrity?.traceabilityId !== observation?.traceabilityId) reasons.push("DENUE_TRACEABILITY_MISMATCH");
  if (integrity?.sourceReference !== observation?.sourceReference) reasons.push("DENUE_SOURCE_REFERENCE_MISMATCH");

  const publicationEligibility = observation ? institutionalPublicationEligibility(observation) : null;
  if (!publicationEligibility) reasons.push("DENUE_PUBLICATION_ELIGIBILITY_UNRESOLVED");
  else if (publicationEligibility === "INELIGIBLE") reasons.push("DENUE_PUBLICATION_INELIGIBLE");

  if (reasons.length > 0) {
    return { status: "REJECTED", layer: null, reasons: unique(reasons) };
  }

  const category = present(observation.category)
    ? observation.category
    : present(observation.activityCategory)
      ? observation.activityCategory
      : null;
  const distanceMeters = typeof observation.distanceMeters === "number" && Number.isFinite(observation.distanceMeters) && observation.distanceMeters >= 0
    ? observation.distanceMeters
    : null;
  const variables = ["coordinates", "name", "activityCode", "address"];
  if (category) variables.push("category");
  if (distanceMeters !== null) variables.push("distanceMeters");

  const observedProperties: DenueObservedProperties = {
    name: observation.name,
    activityCode: observation.activityCode,
    address: observation.address,
    provider: observation.provider,
    publicationRole: observation.publicationRole,
    semanticRole: observation.semanticRole,
    isCriminalEvidence: observation.isCriminalEvidence,
    rawSourceReference: observation.rawSourceReference,
    ...(category ? { category } : {}),
    ...(distanceMeters !== null ? { distanceMeters } : {}),
  };

  return {
    status: "ADAPTED",
    reasons: [],
    layer: {
      layerId: observation.sourceEvidenceId,
      productId: context.productId,
      layerType: "OBSERVATION_POINTS",
      epistemicClass: "OBSERVED",
      geographyId: observation.geographyId,
      geometry: { type: "Point", coordinates: [observation.lng, observation.lat] },
      geometryType: "Point",
      sourceType: observation.source,
      sourceReference: observation.sourceReference,
      sourceItemIds: [observation.sourceEvidenceId],
      datasetReference: null,
      queryReference: null,
      traceabilityIds: [observation.traceabilityId],
      lineage: buildEvidenceLineage({
        geographyId: observation.geographyId,
        geographyType: observation.geographyType,
        sourceId: integrity.sourceId!,
        sourceReference: observation.sourceReference,
        evidenceId: observation.sourceEvidenceId,
      }),
      variables,
      transformation: null,
      method: null,
      limitations: ["DENUE_TERRITORIAL_CONTEXT_ONLY", "DENUE_NOT_CRIMINAL_EVIDENCE"],
      humanReviewStatus: integrity.validationStatus || "UNREVIEWED",
      publicationEligibility: publicationEligibility!,
      styleSpecification: { symbolizer: "MARKER" },
      disclosure: null,
      observedProperties,
    },
  };
}
