import {
  generateDenueAnalyticalCandidates,
  type DenueAnalyticalCandidateGenerationInput,
  type DenueAnalyticalCandidateGenerationResult,
} from "@/services/denueAnalyticalCandidateService";
import { appendDenueAnalyticalReviewEvent } from "@/services/denueAnalyticalWorkflowRepository";
import type { DenueAnalyticalRelation } from "@/utils/denueAnalyticalRelation";
import {
  buildDenueAnalyticalReviewEvent,
  type DenueAnalyticalReviewDecision,
  type DenueAnalyticalReviewEvent,
} from "@/utils/denueAnalyticalReviewLedger";

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function authenticatedPpcIdentity(user: {
  id?: string | number | null;
  username?: string | null;
  email?: string | null;
} | null): string | null {
  if (user?.id !== null && user?.id !== undefined && present(String(user.id))) return `user:${String(user.id).trim()}`;
  if (present(user?.username)) return `username:${user.username.trim()}`;
  if (present(user?.email)) return `email:${user.email.trim()}`;
  return null;
}

export async function runExplicitDenueCandidateGeneration(input: {
  snapshot: DenueAnalyticalCandidateGenerationInput;
  generate?: typeof generateDenueAnalyticalCandidates;
  reload: () => Promise<void>;
}): Promise<DenueAnalyticalCandidateGenerationResult> {
  const result = await (input.generate || generateDenueAnalyticalCandidates)(input.snapshot);
  await input.reload();
  return result;
}

export async function persistDenueAnalyticalReviewDecision(input: {
  projectId: string;
  relation: DenueAnalyticalRelation;
  decision: DenueAnalyticalReviewDecision;
  rationale: string;
  reviewedBy: string | null;
  reviewedAt?: string;
  append?: typeof appendDenueAnalyticalReviewEvent;
  reload: () => Promise<void>;
}): Promise<DenueAnalyticalReviewEvent> {
  if (!present(input.reviewedBy)) throw new Error("DENUE_REVIEW_AUTHENTICATED_IDENTITY_REQUIRED");
  if (!present(input.rationale)) throw new Error("DENUE_REVIEW_RATIONALE_REQUIRED");
  const event = buildDenueAnalyticalReviewEvent(input.relation, {
    nextStatus: input.decision,
    reviewedBy: input.reviewedBy,
    reviewedAt: input.reviewedAt || new Date().toISOString(),
    rationale: input.rationale.trim(),
  });
  await (input.append || appendDenueAnalyticalReviewEvent)(input.projectId, event);
  await input.reload();
  return event;
}
