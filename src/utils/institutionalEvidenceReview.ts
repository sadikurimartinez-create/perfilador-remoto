import { evaluateHumanValidation, type HumanValidationAction } from "./humanValidationPolicy";
import { GeointGovernanceStatus } from "@/types/geointGovernance";
import { hasStreetViewProvenance } from "./visualEvidenceEngine/streetViewCollector";

// Locators identify existing storage, not a second evidence/review contract.
export type EvidenceReviewSource = "PHOTO" | "DOCUMENT_PHOTO" | "TACTICAL_STREET_VIEW" | "STREETVIEW_FINDING";
export interface EvidenceReviewTarget { source: EvidenceReviewSource; id: string }
export interface EvidenceReviewRequest extends EvidenceReviewTarget {
  projectId: string; action: HumanValidationAction; comment: string;
  expectedReview: string;
}
export const reviewStateLabels: Record<string, string> = {
  UNREVIEWED: "Sin revisar", PENDING_REVIEW: "Sin revisar", LEGACY_UNCLASSIFIED: "Sin revisar",
  APPROVED: "Aprobada", REJECTED: "Rechazada", RETURNED_FOR_REANALYSIS: "Devuelta para reanálisis",
};
export function ppcReviewDisplayStatus(item: any) {
  const decision = evaluateHumanValidation(item);
  // Legacy report compatibility is not a recorded institutional PPC decision.
  return decision.isLegacyCompatibleApproval ? "PENDING_REVIEW" : decision.status;
}
export function reviewVersion(item: any): string {
  const nested = item?.multimodalEvidence || {};
  const record = { ...nested, ...item, humanValidationStatus: item?.humanValidationStatus ?? nested.humanValidationStatus };
  return JSON.stringify([evaluateHumanValidation(record).status, record.validatedAt ?? record.validationDate ?? null,
    record.validationComment ?? null]);
}
export function institutionalReviewState(action: HumanValidationAction): GeointGovernanceStatus {
  return action === "APPROVE" ? GeointGovernanceStatus.APPROVED_EVIDENCE :
    action === "REJECT" ? GeointGovernanceStatus.REJECTED_FINDING : GeointGovernanceStatus.RETURNED_FOR_REANALYSIS;
}
export function evidenceAliases(item: any): string[] {
  return [...new Set([item.id, item.evidenceId, item.captureId, item.sourceEvidenceId, item.sourceReference,
    item.storagePath, item.imageReference, item.previewUrl, item.url, item.imagen, item.file_url, item.archivo_url]
    .filter(value => typeof value === "string" && value.trim()).map(value => value.trim()))] as string[];
}
export function evidenceImageReference(item: any): string {
  return item.previewUrl || item.url || item.imagen || item.imageReference || item.file_url || item.archivo_url || "";
}
export function evidenceReviewLocatorId(item: any): string | null {
  const id = item.id || item.captureId || item.evidenceId;
  if (id) return id;
  const reference = item.storagePath || evidenceImageReference(item);
  if (!reference) return null;
  // A locator for legacy array entries, never a fabricated canonical evidence ID.
  let hash = 2166136261;
  for (const character of reference) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `legacy-ref-${(hash >>> 0).toString(16)}`;
}
export function reconcileStreetViewReviewItems(photos: any[], tactical: any[], findings: any[]): any[] {
  const candidates = [
    ...findings.map(item => ({ ...item, reviewTarget: item.reviewTarget || { source: "STREETVIEW_FINDING", id: item.id } })),
    ...photos.filter(hasStreetViewProvenance).map(item => ({ ...item, reviewTarget: item.reviewTarget || { source: "PHOTO", id: item.id } })),
    ...tactical.map(item => ({ ...item, reviewTarget: item.reviewTarget || { source: "TACTICAL_STREET_VIEW", id: evidenceReviewLocatorId(item) } })),
  ].filter(item => !item.deleted && item.reviewTarget.id);
  // Connected components avoid duplication even when aliases bridge two representations.
  const groups: any[][] = [];
  for (const item of candidates) {
    const aliases = new Set(evidenceAliases(item));
    const matches = groups.filter(group => group.some(member => evidenceAliases(member).some(id => aliases.has(id))));
    const group = [item, ...matches.flat()];
    for (const matched of matches) groups.splice(groups.indexOf(matched), 1);
    groups.push(group);
  }
  return groups.map(group => {
    const reviewed = group.filter(item => item.validationSource === "ADR_020_24_HUMAN_ACTION");
    const selected = reviewed.sort((a, b) => String(b.validatedAt || b.validationDate || "").localeCompare(String(a.validatedAt || a.validationDate || "")))[0]
      || group.find(item => item.reviewTarget.source === "STREETVIEW_FINDING")
      || group.find(item => item.reviewTarget.source === "PHOTO") || group[0];
    return { ...selected, imageReference: evidenceImageReference(selected) || group.map(evidenceImageReference).find(Boolean) || "" };
  });
}

export function createEvidenceReviewSubmission(save: (request: EvidenceReviewRequest) => Promise<any>) {
  let pending = false;
  return { isPending: () => pending, async submit(request: EvidenceReviewRequest, confirmed: (record: any) => void) {
    if (pending) return false;
    pending = true;
    try { const result = await save(request); confirmed(result); return true; }
    finally { pending = false; }
  } };
}
