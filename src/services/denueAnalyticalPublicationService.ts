import {
  loadDenueAnalyticalWorkflow,
  type DenueAnalyticalWorkflowSnapshot,
} from "@/services/denueAnalyticalWorkflowRepository";
import {
  buildDenueAnalyticalCartographicProduct,
  type DenueAnalyticalCartographicProduct,
  type DenueAnalyticalCartographicProductInput,
  type DenueAnalyticalCartographicProductResult,
} from "@/utils/denueAnalyticalCartographicProduct";
import {
  normalizeDenueAnalyticalRelation,
  type DenueAnalyticalRelation,
} from "@/utils/denueAnalyticalRelation";
import {
  assessDenueAnalyticalPublication,
  type DenueAnalyticalPublicationInput,
} from "@/utils/denueAnalyticalPublicationGate";
import {
  validateDenueAnalyticalReviewLedger,
  type DenueAnalyticalReviewLedger,
} from "@/utils/denueAnalyticalReviewLedger";

export type DenueAnalyticalPublicationProductRequest = Omit<
  DenueAnalyticalCartographicProductInput,
  "expedienteId" | "relations"
>;

export interface DenueAnalyticalPublicationExclusion {
  relationId: string;
  reasons: string[];
}

export interface DenueAnalyticalPublicationServiceResult {
  relationCount: number;
  acceptedCount: number;
  eligibleCount: number;
  excludedCount: number;
  exclusionReasons: DenueAnalyticalPublicationExclusion[];
  productStatus: DenueAnalyticalCartographicProductResult["status"];
  product: DenueAnalyticalCartographicProduct | null;
  warnings: string[];
}

export interface DenueAnalyticalPublicationServiceDependencies {
  loadWorkflow(projectId: string): Promise<DenueAnalyticalWorkflowSnapshot>;
}

const DEFAULT_DEPENDENCIES: DenueAnalyticalPublicationServiceDependencies = {
  loadWorkflow: loadDenueAnalyticalWorkflow,
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function reconstructBaseRelation(relation: DenueAnalyticalRelation): DenueAnalyticalRelation {
  return normalizeDenueAnalyticalRelation({
    ...relation,
    humanValidation: {
      status: "PENDING",
      validatedBy: null,
      validatedAt: null,
      rationale: null,
    },
    publicationEligibility: "INELIGIBLE",
  });
}

function ledgersByRelationId(
  ledgers: readonly DenueAnalyticalReviewLedger[]
): Map<string, DenueAnalyticalReviewLedger[]> {
  const grouped = new Map<string, DenueAnalyticalReviewLedger[]>();
  for (const ledger of ledgers) {
    const group = grouped.get(ledger.relationId) || [];
    group.push(ledger);
    grouped.set(ledger.relationId, group);
  }
  return grouped;
}

function productWarnings(
  exclusions: readonly DenueAnalyticalPublicationExclusion[],
  result: DenueAnalyticalCartographicProductResult
): string[] {
  const warnings = exclusions.flatMap((exclusion) =>
    exclusion.reasons.map((reason) => `RELATION_EXCLUDED:${exclusion.relationId}:${reason}`)
  );
  if (result.status === "REJECTED") {
    warnings.push(...result.reasons.map((reason) => `PRODUCT_REJECTED:${reason}`));
  }
  return uniqueSorted(warnings);
}

export async function buildDenueAnalyticalPublicationProduct(
  projectId: string,
  request: DenueAnalyticalPublicationProductRequest,
  dependencies: DenueAnalyticalPublicationServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<DenueAnalyticalPublicationServiceResult> {
  const workflow = await dependencies.loadWorkflow(projectId);
  const ledgerGroups = ledgersByRelationId(workflow.reviewLedgers);
  const eligibleInputs: DenueAnalyticalPublicationInput[] = [];
  const exclusions: DenueAnalyticalPublicationExclusion[] = [];
  let acceptedCount = 0;

  const relations = [...workflow.relations].sort((left, right) =>
    left.relationId.localeCompare(right.relationId)
  );
  for (const persistedRelation of relations) {
    const relationId = persistedRelation.relationId;
    const matchingLedgers = ledgerGroups.get(relationId) || [];
    if (matchingLedgers.length !== 1) {
      exclusions.push({
        relationId,
        reasons: [matchingLedgers.length === 0 ? "LEDGER_MISSING" : "LEDGER_IDENTITY_CONFLICT"],
      });
      continue;
    }

    const baseRelation = reconstructBaseRelation(persistedRelation);
    const ledgerValidation = validateDenueAnalyticalReviewLedger(baseRelation, matchingLedgers[0]);
    if (ledgerValidation.status !== "VALID") {
      const decision = assessDenueAnalyticalPublication({
        baseRelation,
        relation: persistedRelation,
        ledger: matchingLedgers[0],
      });
      exclusions.push({
        relationId,
        reasons: decision.reasons,
      });
      continue;
    }

    const currentRelation = ledgerValidation.relation;
    if (currentRelation.humanValidation.status === "ACCEPTED") acceptedCount += 1;
    const publicationInput: DenueAnalyticalPublicationInput = {
      baseRelation,
      relation: currentRelation,
      ledger: ledgerValidation.ledger,
    };
    const decision = assessDenueAnalyticalPublication(publicationInput);
    if (decision.eligible) eligibleInputs.push(publicationInput);
    else exclusions.push({ relationId, reasons: decision.reasons });
  }

  const productResult = buildDenueAnalyticalCartographicProduct({
    ...request,
    expedienteId: projectId,
    relations: eligibleInputs,
  });
  const exclusionReasons = exclusions
    .map((exclusion) => ({
      relationId: exclusion.relationId,
      reasons: uniqueSorted(exclusion.reasons),
    }))
    .sort((left, right) => left.relationId.localeCompare(right.relationId));

  return {
    relationCount: workflow.relations.length,
    acceptedCount,
    eligibleCount: eligibleInputs.length,
    excludedCount: workflow.relations.length - eligibleInputs.length,
    exclusionReasons,
    productStatus: productResult.status,
    product: productResult.product,
    warnings: productWarnings(exclusionReasons, productResult),
  };
}
