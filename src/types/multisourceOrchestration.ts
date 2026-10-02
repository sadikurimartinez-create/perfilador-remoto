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
  sourceEvidenceIds?: string[];
  dependsOnSourceEvidenceIds?: string[];
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

/** Assembly of existing engines, never an automatically approved institutional analysis. */
export interface InstitutionalMultisourceAnalysis {
  generatedAt: string;
  geographyId: string | null;
  lineage: import("@/utils/evidenceLineage").CanonicalLineageNode[];
  traceabilityIds: string[];
  outputId: string;
  projectId: string;
  expedienteId: string;
  summary: string;
  text: string;
  acquisitionMode: "DERIVED";
  humanValidationStatus: "PENDING_REVIEW";
  status: "INCONCLUSIVE" | "SUPPORTED" | "CONTRADICTED";
  supportStatus: import("@/utils/hypothesisGovernance").HypothesisSupportStatus;
  envelope: MultisourceOrchestrationEnvelope;
  correlation: import("@/lib/geoint/institutionalEvidenceCorrelation").InstitutionalCorrelationReport;
  convergences: import("@/utils/institutionalMultisourceConvergence").ConvergenceResult[];
  candidateConvergences: import("@/utils/institutionalMultisourceConvergence").ConvergenceResult[];
  contradictions: string[];
  sourceDependencies: SourceDependencyRelation[];
  independentSources: string[];
  supportingReferences: string[];
  contradictingReferences: string[];
  limitations: string[];
  inventory: Array<{ family: string; id: string; epistemicRole: string; provenance: unknown }>;
  provenance: { sourceFingerprint: string; hypothesisId: string | null; sourceIds: string[]; engines: string[] };
  institutionalNarrative: string;
}
