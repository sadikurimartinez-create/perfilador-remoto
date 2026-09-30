import type { StreetViewFinding } from "@/services/streetViewFindingService";
import {
  FirestoreDenueAnalyticalWorkflowRepository,
  type DenueAnalyticalWorkflowRepository,
} from "@/services/denueAnalyticalWorkflowRepository";
import type { GeoEvidence } from "@/types/geointEvidence";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import {
  adaptDenueFindingCandidates,
  adaptDenueGeoEvidenceCandidate,
  adaptDenueMultisourceCandidate,
  adaptDenueStreetViewCandidate,
  deduplicateDenueAnalyticalCandidates,
  type DenueAnalyticalCandidateResult,
  type GovernedDenueAnalyticalObservation,
  type VerifiedErgLink,
} from "@/utils/denueAnalyticalRelationAdapter";
import {
  fingerprintDenueAnalyticalRelation,
} from "@/utils/denueAnalyticalReviewLedger";
import type {
  DenueAnalyticalRelation,
  DenueAnalyticalRelationType,
} from "@/utils/denueAnalyticalRelation";
import {
  adaptDenueObservationToGovernedMapLayer,
} from "@/utils/denueGovernedMapAdapter";
import type { ExecutiveFinding } from "@/utils/executiveGeointReportModel";
import type { PersistedDenuePoi } from "@/utils/institutionalStructuredPersistence";
import type { ConvergenceSourceEntry } from "@/utils/institutionalMultisourceConvergence";

export interface DenueAnalyticalErgLinkInput {
  denueSourceEvidenceId?: string;
  sourceEvidenceId: string;
  link: VerifiedErgLink;
}

export interface DenueAnalyticalCandidateGenerationInput {
  projectId: string;
  canonicalGeography: CanonicalProjectGeography;
  denuePois: readonly PersistedDenuePoi[];
  geoEvidence?: readonly GeoEvidence[];
  streetViewFindings?: readonly StreetViewFinding[];
  findings?: readonly ExecutiveFinding[];
  multisourceGroups?: ReadonlyArray<readonly ConvergenceSourceEntry[]>;
  verifiedErgLinks?: readonly DenueAnalyticalErgLinkInput[];
  maxCandidateDistanceMeters: number;
  methodologyVersion: string;
}

export interface DenueAnalyticalCandidateGenerationResult {
  sourceDenueCount: number;
  candidateCount: number;
  newCandidateCount: number;
  existingCandidateCount: number;
  invalidCandidateCount: number;
  relationTypes: DenueAnalyticalRelationType[];
  staleRelationIds: string[];
  warnings: string[];
}

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertInput(input: DenueAnalyticalCandidateGenerationInput): void {
  if (!present(input?.projectId)) throw new Error("DENUE_CANDIDATE_PROJECT_ID_REQUIRED");
  if (!input.canonicalGeography || input.canonicalGeography.validationStatus !== "VALID") {
    throw new Error("DENUE_CANDIDATE_CANONICAL_GEOGRAPHY_INVALID");
  }
  if (!present(input.canonicalGeography.geographyId)) throw new Error("DENUE_CANDIDATE_GEOGRAPHY_ID_REQUIRED");
  if (!present(input.methodologyVersion)) throw new Error("DENUE_CANDIDATE_METHODOLOGY_VERSION_REQUIRED");
  if (!Number.isFinite(input.maxCandidateDistanceMeters) || input.maxCandidateDistanceMeters <= 0) {
    throw new Error("DENUE_CANDIDATE_DISTANCE_INVALID");
  }
}

function ergLinkFor(
  input: DenueAnalyticalCandidateGenerationInput,
  denueSourceEvidenceId: string,
  sourceEvidenceId: string
): VerifiedErgLink | null {
  const match = (input.verifiedErgLinks || []).find((candidate) =>
    candidate.sourceEvidenceId === sourceEvidenceId &&
    (!candidate.denueSourceEvidenceId || candidate.denueSourceEvidenceId === denueSourceEvidenceId)
  );
  return match?.link || null;
}

function observationFor(
  poi: PersistedDenuePoi,
  productId: string
): { observation: GovernedDenueAnalyticalObservation | null; reasons: string[] } {
  const adapted = adaptDenueObservationToGovernedMapLayer(poi, { productId });
  return adapted.status === "ADAPTED"
    ? { observation: { poi, layer: adapted.layer }, reasons: [] }
    : { observation: null, reasons: adapted.reasons };
}

function warning(sourceId: string, reasons: readonly string[]): string {
  return `${sourceId}:${reasons.join(",")}`;
}

function relationTypes(relations: readonly DenueAnalyticalRelation[]): DenueAnalyticalRelationType[] {
  return Array.from(new Set(relations.flatMap((relation) => relation.relationTypes)))
    .sort((left, right) => left.localeCompare(right));
}

export class DenueAnalyticalCandidateService {
  constructor(
    private readonly workflowRepository: DenueAnalyticalWorkflowRepository =
      new FirestoreDenueAnalyticalWorkflowRepository()
  ) {}

  async generate(
    input: DenueAnalyticalCandidateGenerationInput
  ): Promise<DenueAnalyticalCandidateGenerationResult> {
    assertInput(input);
    const entries: Array<{ sourceId: string; result: DenueAnalyticalCandidateResult }> = [];
    const warnings: string[] = [];
    let invalidCandidateCount = 0;

    for (const poi of input.denuePois || []) {
      const adapted = observationFor(poi, `denue-analytical-candidates:${input.projectId}`);
      if (!adapted.observation) {
        invalidCandidateCount += 1;
        warnings.push(warning(`DENUE:${poi?.sourceEvidenceId || poi?.id || "UNKNOWN"}`, adapted.reasons));
        continue;
      }
      const denue = adapted.observation;

      for (const evidence of input.geoEvidence || []) {
        entries.push({
          sourceId: `GEO_EVIDENCE:${evidence.id}`,
          result: adaptDenueGeoEvidenceCandidate({
            denue,
            canonicalGeography: input.canonicalGeography,
            evidence,
            maxCandidateDistanceMeters: input.maxCandidateDistanceMeters,
            methodologyVersion: input.methodologyVersion,
            explicitErgLink: ergLinkFor(input, poi.sourceEvidenceId, evidence.sourceEvidenceId),
          }),
        });
      }

      for (const finding of input.streetViewFindings || []) {
        entries.push({
          sourceId: `STREET_VIEW:${finding.id}`,
          result: adaptDenueStreetViewCandidate({
            denue,
            canonicalGeography: input.canonicalGeography,
            finding,
            maxCandidateDistanceMeters: input.maxCandidateDistanceMeters,
            methodologyVersion: input.methodologyVersion,
            explicitErgLink: ergLinkFor(input, poi.sourceEvidenceId, finding.sourceEvidenceId || ""),
          }),
        });
      }

      for (const finding of input.findings || []) {
        const batch = adaptDenueFindingCandidates({
          denue,
          canonicalGeography: input.canonicalGeography,
          finding,
          evidenceRegistry: [...(input.geoEvidence || [])],
          maxCandidateDistanceMeters: input.maxCandidateDistanceMeters,
          methodologyVersion: input.methodologyVersion,
        });
        batch.candidates.forEach((relation) => entries.push({
          sourceId: `FINDING:${finding.findingId}`,
          result: { status: "CANDIDATE", relation, reasons: [] },
        }));
        batch.rejected.forEach((rejected) => {
          invalidCandidateCount += 1;
          warnings.push(warning(`FINDING:${rejected.sourceId}`, rejected.reasons));
        });
        batch.conflicts.forEach((conflict) => {
          invalidCandidateCount += 1;
          warnings.push(warning(`FINDING:${conflict.relationId}`, [conflict.reason]));
        });
      }

      for (const [index, sources] of (input.multisourceGroups || []).entries()) {
        entries.push({
          sourceId: `MULTISOURCE:${index}`,
          result: adaptDenueMultisourceCandidate({
            denue,
            canonicalGeography: input.canonicalGeography,
            sources: [...sources],
            methodologyVersion: input.methodologyVersion,
          }),
        });
      }
    }

    const batch = deduplicateDenueAnalyticalCandidates(entries);
    invalidCandidateCount += batch.rejected.length + batch.conflicts.length;
    batch.rejected.forEach((rejected) => warnings.push(warning(rejected.sourceId, rejected.reasons)));
    batch.conflicts.forEach((conflict) => warnings.push(warning(conflict.relationId, [conflict.reason])));

    const existingWorkflow = await this.workflowRepository.load(input.projectId);
    const existingById = new Map(existingWorkflow.relations.map((relation) => [relation.relationId, relation]));
    const newCandidates: DenueAnalyticalRelation[] = [];
    let existingCandidateCount = 0;

    for (const candidate of batch.candidates) {
      const existing = existingById.get(candidate.relationId);
      if (!existing) {
        newCandidates.push(candidate);
        continue;
      }
      if (fingerprintDenueAnalyticalRelation(existing) === fingerprintDenueAnalyticalRelation(candidate)) {
        existingCandidateCount += 1;
      } else {
        invalidCandidateCount += 1;
        warnings.push(warning(candidate.relationId, ["PERSISTED_RELATION_ID_CONFLICT"]));
      }
    }

    if (newCandidates.length > 0) {
      await this.workflowRepository.saveRelations(input.projectId, newCandidates);
    }

    const generatedIds = new Set(batch.candidates.map((candidate) => candidate.relationId));
    const staleRelationIds = existingWorkflow.relations
      .filter((relation) => !generatedIds.has(relation.relationId))
      .map((relation) => relation.relationId)
      .sort((left, right) => left.localeCompare(right));

    return {
      sourceDenueCount: input.denuePois.length,
      candidateCount: batch.candidates.length,
      newCandidateCount: newCandidates.length,
      existingCandidateCount,
      invalidCandidateCount,
      relationTypes: relationTypes(batch.candidates),
      staleRelationIds,
      warnings: Array.from(new Set(warnings)).sort((left, right) => left.localeCompare(right)),
    };
  }
}

let defaultService: DenueAnalyticalCandidateService | null = null;

export function generateDenueAnalyticalCandidates(input: DenueAnalyticalCandidateGenerationInput) {
  if (!defaultService) defaultService = new DenueAnalyticalCandidateService();
  return defaultService.generate(input);
}
