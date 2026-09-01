import type { CanonicalEvidenceRef, CanonicalFindingRef } from "./canonicalEvidenceRegistry";

export type SourceAuthorityClassification =
  | "AUTHORITATIVE"
  | "NON_AUTHORITATIVE"
  | "SIMULATED"
  | "LEGACY_UNCLASSIFIED"
  | "UNKNOWN";

export type SourceIntegrityClassification =
  | "VERIFIED"
  | "READY_WITH_LIMITATIONS"
  | "NOT_READY"
  | "SIMULATED"
  | "LEGACY_UNCLASSIFIED"
  | "UNKNOWN";

export type SourceDependencyType =
  | "INDEPENDENT"
  | "DERIVED"
  | "SAME_ORIGIN"
  | "SAME_PROVIDER"
  | "SAME_CAPTURE"
  | "SAME_OPERATION"
  | "UNKNOWN_DEPENDENCY";

export type InstitutionalSourceEligibility =
  | "ELIGIBLE"
  | "LIMITED"
  | "INELIGIBLE";

export interface MultisourceSourceDescriptor {
  descriptorId: string;
  sourceType: string;
  sourceId?: string;
  providerId?: string;
  sourceFamily?: string;
  sourceReference?: string;
  rawSourceReference?: string;
  captureId?: string;
  operationId?: string;
  sweepId?: string;
  authorityClassification: SourceAuthorityClassification;
  integrityClassification: SourceIntegrityClassification;
}

export interface MultisourceOrchestrationItem {
  itemId: string;
  evidenceRef?: CanonicalEvidenceRef;
  findingRef?: CanonicalFindingRef;
  source: MultisourceSourceDescriptor;
  eligibility: InstitutionalSourceEligibility;
}

export interface SourceDependencyRelation {
  leftItemId: string;
  rightItemId: string;
  dependencyType: SourceDependencyType;
  countsAsIndependentCorroboration: boolean;
}

export interface IndependentCorroborationGroup {
  groupId: string;
  itemIds: string[];
  institutionallyEligibleItemIds: string[];
}

export interface MultisourceOrchestrationEnvelope {
  expedienteId?: string;
  items: MultisourceOrchestrationItem[];
  dependencyRelations: SourceDependencyRelation[];
  corroborationGroups: IndependentCorroborationGroup[];
  totalItems: number;
  eligibleItems: number;
  independentEligibleSources: number;
}
