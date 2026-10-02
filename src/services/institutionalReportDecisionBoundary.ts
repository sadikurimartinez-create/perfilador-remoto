import "server-only";
import { createHash } from "crypto";
import { canonicalSemanticValue } from "@/utils/institutionalDocumentSemanticIntegrity";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";
import { AdminInstitutionalReportPackageRepository } from "./institutionalReportAdminRepository";
import { AdminInstitutionalCertificationRepository, AdminInstitutionalPublicationRepository } from "./institutionalReportDecisionAdminRepository";
import { InstitutionalReportCertificationService } from "./institutionalReportCertificationService";
import { InstitutionalReportPublicationService } from "./institutionalReportPublicationService";
import { isCompleteInstitutionalReportPackage } from "./institutionalReportPackageService";
import type { InstitutionalActor } from "@/types/institutionalProjectAccess";

export async function executeInstitutionalReportDecision(operation: string, input: any, actor: InstitutionalActor, projectId: string, sourceFingerprint?: string) {
  const identity = { id: actor.institutionalUserId, uid: `user:${actor.institutionalUserId}`,
    displayName: actor.username, role: actor.role };
  const certifications = new AdminInstitutionalCertificationRepository();
  const publications = new AdminInstitutionalPublicationRepository();
  const certificationService = new InstitutionalReportCertificationService(certifications);
  const publicationService = new InstitutionalReportPublicationService(publications, certifications);
  const now = new Date().toISOString();
  if (operation === "REVOKE_CERTIFICATION") return certificationService.revokeInstitutionalCertification({ ...input, projectId, revokedBy: identity, revokedAt: now });
  if (operation === "REVOKE_PUBLICATION") return publicationService.revokePublication({ ...input, projectId, revokedBy: identity, revokedAt: now });
  if (operation === "REJECT_CERTIFICATION") {
    const certification = await certifications.get(projectId, input.certification?.certificationId);
    if (!certification) throw new Error("CERTIFICATION_NOT_FOUND");
    return certificationService.rejectInstitutionalCertification({ ...input, certification, rejectedBy: identity, rejectedAt: now });
  }
  if (operation === "FAIL_PUBLICATION") {
    const request = await publications.get(projectId, input.request?.publicationId);
    if (!request) throw new Error("PUBLICATION_NOT_FOUND");
    return publicationService.failPublication({ request, failureReason: input.failureReason, failureAt: now });
  }
  // Bind every human decision to a complete server-stored package and its
  // validated input/model hashes. Browser certification labels are never inputs.
  const packages = await new AdminInstitutionalReportPackageRepository().list(projectId);
  const manifest = packages.find(record => isCompleteInstitutionalReportPackage(record) &&
    Object.values(record.artifacts).some(artifact => artifact?.storagePath === input.documentArtifactReference &&
      (!input.documentArtifactHash || artifact.sha256 === input.documentArtifactHash)));
  if (!manifest) throw new Error("REPORT_DECISION_SERVER_PACKAGE_REQUIRED");
  const seals = (await getInstitutionalAdminDb().collection("projects").doc(projectId).collection("reportPackageInputs").doc(manifest.packageId).get()).data();
  const hash = (value: unknown) => createHash("sha256").update(canonicalSemanticValue(value)).digest("hex");
  if (!seals || seals.projectId !== projectId || (sourceFingerprint !== undefined && seals.sourceFingerprint !== sourceFingerprint) || seals.inputHash !== hash(input.institutionalReportInput) ||
      seals.modelHash !== hash(input.institutionalDocumentModel)) throw new Error("REPORT_DECISION_SNAPSHOT_MISMATCH");
  const artifact = Object.values(manifest.artifacts).find(item => item?.storagePath === input.documentArtifactReference)!;
  // Generation is a fact of the complete immutable server package, never a browser label.
  const trusted = { ...input, projectId, documentArtifactHash: artifact.sha256,
    institutionalDocumentModel: { ...input.institutionalDocumentModel, generated: true, status: 'GENERATED',
      metadata: { ...input.institutionalDocumentModel.metadata, projectId, generatedAt: input.institutionalReportInput.generatedAt },
      sourceSnapshotId: input.institutionalReportInput.generatedAt } };
  switch (operation) {
    case "REQUEST_CERTIFICATION": return certificationService.requestCertification({ ...trusted, requestedBy: identity, requestedAt: now });
    case "CERTIFY": return certificationService.certifyInstitutionalReport({ ...trusted, certifierIdentity: identity, certifiedAt: now });
    case "REQUEST_PUBLICATION": return publicationService.requestPublication({ ...trusted, requestedBy: identity, requestedAt: now });
    case "PUBLISH": return publicationService.publishInstitutionalReport({ ...trusted, publisherIdentity: identity, publishedAt: now });
    default: throw new Error("REPORT_DECISION_UNSUPPORTED");
  }
}
