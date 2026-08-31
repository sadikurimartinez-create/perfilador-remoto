import type { InstitutionalDocumentModel } from "./institutionalDocumentAssembly";
import type { InstitutionalReportInput } from "./institutionalReportPublicationContract";
import { ReportCoherenceValidator, CoherenceValidationResult } from "./reportCoherenceValidator";
import { assessReportReadiness, type ReportReadyAssessment, type ReportReadyReason } from "./reportReadyGovernance";

/**
 * ReportCertificationGate separates legacy quality-gate compatibility from
 * ADR-020.33 F6 institutional certification. Generated document, READY, and AI
 * review states never become a canonical certification without a human act.
 */

export interface CertificationGateResult {
  status: "CERTIFIED" | "CERTIFIED_WITH_WARNINGS" | "NOT_CERTIFIED";
  hypothesis: boolean;
  imagesValidated: boolean;
  sanitization: boolean;
  traceability: boolean;
  certificationId: string;
  messages: string[];
  certifiedAt: string;
  version?: string;
  visualGovernance?: boolean;
  documentQuality?: boolean;
  reportReadyAssessment?: ReportReadyAssessment;
  reportReadyStatus?: ReportReadyAssessment["status"];
  readyForInstitutionalReport?: boolean;
  published?: false;
  legacyCertificationCompatibility?: true;
}

export type InstitutionalCertificationStatus =
  | "NOT_CERTIFIED"
  | "PENDING_CERTIFICATION"
  | "CERTIFIED"
  | "REJECTED"
  | "REVOKED"
  | "SUPERSEDED";

export type InstitutionalCertificationAction =
  | "REQUEST_CERTIFICATION"
  | "CERTIFY"
  | "REJECT"
  | "REVOKE"
  | "AI_REVIEW"
  | "SCORE_REVIEW";

export type InstitutionalPublicationStatus =
  | "NOT_PUBLISHED"
  | "PENDING_PUBLICATION"
  | "PUBLISHED"
  | "PUBLICATION_FAILED"
  | "REVOKED"
  | "SUPERSEDED";

export type InstitutionalPublicationAction =
  | "REQUEST_PUBLICATION"
  | "PUBLISH"
  | "REVOKE_PUBLICATION"
  | "AI_REVIEW"
  | "SCORE_REVIEW"
  | "DOWNLOAD";

export interface CertificationActorIdentity {
  id?: string | null;
  uid?: string | null;
  email?: string | null;
  name?: string | null;
  displayName?: string | null;
  role?: string | null;
  [key: string]: unknown;
}

export interface InstitutionalCertificationDecision {
  status: InstitutionalCertificationStatus;
  canRequestCertification: boolean;
  canCertify: boolean;
  blockingReasons: string[];
  warnings: string[];
  requiredHumanActions: string[];
  reportSnapshotId: string | null;
  institutionalReportInputId: string | null;
  documentModelId: string | null;
  documentArtifactReference: string | null;
  documentArtifactHash: string | null;
  published: false;
  certified: false;
}

export interface InstitutionalReportCertification {
  certificationId: string;
  status: InstitutionalCertificationStatus;
  projectId: string;
  reportSnapshotId: string;
  institutionalReportInputId: string;
  documentModelId: string;
  documentArtifactReference: string;
  documentArtifactHash: string | null;
  reportReadyStatus: ReportReadyAssessment["status"];
  reportReadyAssessment: ReportReadyAssessment;
  validationReferences: {
    evidenceIds: string[];
    findingIds: string[];
    analysisIds: string[];
    conclusionIds: string[];
    geographyId?: string | null;
  };
  lineageReference: InstitutionalReportInput["lineageSummary"];
  warnings: string[];
  blockersAtDecision: string[];
  requestedAt?: string | null;
  requestedBy?: CertificationActorIdentity | null;
  certifiedAt: string | null;
  certifiedBy: CertificationActorIdentity | null;
  rejectedAt?: string | null;
  rejectedBy?: CertificationActorIdentity | null;
  rejectionReason?: string | null;
  revokedAt?: string | null;
  revokedBy?: CertificationActorIdentity | null;
  revocationReason?: string | null;
  supersedesCertificationId?: string | null;
  supersededByCertificationId?: string | null;
  published: false;
}

export interface InstitutionalPublicationDecision {
  status: InstitutionalPublicationStatus;
  canRequestPublication: boolean;
  canPublish: boolean;
  blockingReasons: string[];
  warnings: string[];
  requiredHumanActions: string[];
  certificationId: string | null;
  projectId: string | null;
  reportSnapshotId: string | null;
  documentModelId: string | null;
  documentArtifactReference: string | null;
  documentArtifactHash: string | null;
  published: false;
}

export interface InstitutionalReportPublication {
  publicationId: string;
  projectId: string;
  certificationId: string;
  reportSnapshotId: string;
  documentModelId: string;
  documentArtifactReference: string;
  documentArtifactHash: string | null;
  status: InstitutionalPublicationStatus;
  requestedAt?: string | null;
  requestedBy?: CertificationActorIdentity | null;
  publishedAt: string | null;
  publishedBy: CertificationActorIdentity | null;
  publicationChannelOrType: string;
  warnings: string[];
  supersedesPublicationId?: string | null;
  supersededByPublicationId?: string | null;
  revokedAt?: string | null;
  revokedBy?: CertificationActorIdentity | null;
  revocationReason?: string | null;
  failureAt?: string | null;
  failureReason?: string | null;
  outboxEventId?: string | null;
}

const RESERVED_ACTOR_VALUES = new Set(["ADMIN", "ANALYST", "SYSTEM", "UNKNOWN-USER", "UNKNOWN_USER"]);

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asCleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasReservedActorValue(value: unknown): boolean {
  const normalized = asCleanString(value)?.toUpperCase();
  return Boolean(normalized && RESERVED_ACTOR_VALUES.has(normalized));
}

export function isRealCertificationActorIdentity(value: unknown): value is CertificationActorIdentity {
  if (!value || typeof value !== "object") return false;
  const actor = value as CertificationActorIdentity;
  const identityValues = [actor.id, actor.uid, actor.email, actor.name, actor.displayName];
  const realIdentity = identityValues.some((item) => asCleanString(item) && !hasReservedActorValue(item));
  return realIdentity;
}

function preserveRealIdentity(value: unknown): CertificationActorIdentity | null {
  return isRealCertificationActorIdentity(value) ? value : null;
}

function reportReadyReasonCodes(reasons: ReportReadyReason[]): string[] {
  return reasons.map((reason) => reason.code);
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

function certificationIdFor(input: {
  projectId: string;
  reportSnapshotId: string;
  documentModelId: string;
  documentArtifactReference: string;
  actor: CertificationActorIdentity;
  now: string;
}): string {
  const datePart = input.now.slice(0, 10).replace(/-/g, "");
  const actorKey = asCleanString(input.actor.id)
    || asCleanString(input.actor.uid)
    || asCleanString(input.actor.email)
    || asCleanString(input.actor.name)
    || "HUMAN";
  const suffix = stableHash([
    input.projectId,
    input.reportSnapshotId,
    input.documentModelId,
    input.documentArtifactReference,
    actorKey,
    input.now,
  ].join("|"));
  return `CEIPOL-CERT-${datePart}-${suffix}`;
}

function certificationRequestIdFor(input: {
  projectId: string;
  reportSnapshotId: string;
  documentModelId: string;
  documentArtifactReference: string;
  now: string;
}): string {
  const datePart = input.now.slice(0, 10).replace(/-/g, "");
  const suffix = stableHash([
    input.projectId,
    input.reportSnapshotId,
    input.documentModelId,
    input.documentArtifactReference,
    input.now,
    "REQUEST",
  ].join("|"));
  return `CEIPOL-CERT-REQ-${datePart}-${suffix}`;
}

function publicationIdFor(input: {
  projectId: string;
  certificationId: string;
  documentArtifactReference: string;
  publicationChannelOrType: string;
  now: string;
}): string {
  const datePart = input.now.slice(0, 10).replace(/-/g, "");
  const suffix = stableHash([
    input.projectId,
    input.certificationId,
    input.documentArtifactReference,
    input.publicationChannelOrType,
    input.now,
  ].join("|"));
  return `CEIPOL-PUB-${datePart}-${suffix}`;
}

function institutionalReportInputId(input: InstitutionalReportInput | null | undefined): string | null {
  if (!input) return null;
  return `IRI-${input.projectId}-${input.generatedAt}`;
}

function hasCriticalExclusion(input: InstitutionalReportInput | null | undefined): boolean {
  return asArray(input?.exclusions).some((item: any) => {
    const code = String(item?.reasonCode || "").toUpperCase();
    return code.includes("CRITICAL") || code.includes("BROKEN_LINEAGE") || code.includes("UNTRACEABLE");
  });
}

function isPendingHumanValidation(assessment: ReportReadyAssessment | null | undefined): boolean {
  return asArray<ReportReadyReason>(assessment?.unresolvedItems)
    .some((reason) => reason.domain === "HUMAN_VALIDATION");
}

export class ReportCertificationGate {
  /**
   * Legacy report quality-gate compatibility. This is not the ADR-020.33 F6
   * institutional certification act and must not be used for publication.
   */
  public static certify(payload: any, imagesValid: boolean): CertificationGateResult {
    const coherence: CoherenceValidationResult = ReportCoherenceValidator.validate(payload);
    const reportReadyAssessment = payload.reportReadyAssessment || assessReportReadiness(payload);

    const timestamp = new Date();
    const datePart = timestamp.toISOString().slice(0, 10).replace(/-/g, "");
    const legacySuffix = stableHash(`${payload?.projectId || payload?.id || "legacy"}|${timestamp.toISOString()}`);
    const certificationId = `CEIPOL-LEGACY-GATE-${datePart}-${legacySuffix}`;

    let finalStatus: CertificationGateResult["status"] = coherence.status;
    const imagesValidated = imagesValid;
    if (finalStatus === "CERTIFIED" && !imagesValidated) {
      finalStatus = "CERTIFIED_WITH_WARNINGS";
    }

    const messages = [...coherence.messages];
    if (!imagesValidated) {
      messages.push("Advertencia: algunos archivos visuales fallaron validación y requieren revisión humana.");
    }

    return {
      status: finalStatus,
      hypothesis: coherence.hasHypothesis,
      imagesValidated,
      sanitization: true,
      traceability: true,
      certificationId,
      messages,
      certifiedAt: timestamp.toLocaleString("es-MX"),
      version: "1.0.1",
      visualGovernance: true,
      documentQuality: true,
      reportReadyAssessment,
      reportReadyStatus: reportReadyAssessment.status,
      readyForInstitutionalReport: reportReadyAssessment.readyForInstitutionalReport,
      published: false,
      legacyCertificationCompatibility: true,
    };
  }

  public static evaluateInstitutionalCertificationGate(input: {
    reportReadyAssessment?: ReportReadyAssessment | null;
    institutionalReportInput?: InstitutionalReportInput | null;
    institutionalDocumentModel?: InstitutionalDocumentModel | null;
    documentArtifactReference?: string | null;
    documentArtifactHash?: string | null;
    certifierIdentity?: CertificationActorIdentity | null;
    action?: InstitutionalCertificationAction | null;
  }): InstitutionalCertificationDecision {
    const reportReadyAssessment = input.reportReadyAssessment || input.institutionalReportInput?.reportReadyAssessment || null;
    const reportInput = input.institutionalReportInput || null;
    const documentModel = input.institutionalDocumentModel || null;
    const artifactReference = asCleanString(input.documentArtifactReference);
    const artifactHash = asCleanString(input.documentArtifactHash);
    const actor = preserveRealIdentity(input.certifierIdentity);
    const blockers: string[] = [];
    const warnings: string[] = [];
    const requiredHumanActions = ["EXPLICIT_HUMAN_CERTIFICATION_ACTION", "REAL_CERTIFIER_IDENTITY"];

    if (!reportReadyAssessment) {
      blockers.push("REPORT_READY_ASSESSMENT_MISSING");
    } else {
      blockers.push(...reportReadyReasonCodes(reportReadyAssessment.blockingReasons));
      blockers.push(...reportReadyReasonCodes(reportReadyAssessment.unresolvedItems));
      warnings.push(...reportReadyReasonCodes(reportReadyAssessment.warnings));
      if (!reportReadyAssessment.readyForInstitutionalReport) {
        blockers.push("REPORT_NOT_READY");
      }
      if (isPendingHumanValidation(reportReadyAssessment)) {
        blockers.push("HUMAN_VALIDATION_PENDING");
      }
    }

    if (!reportInput) blockers.push("INSTITUTIONAL_REPORT_INPUT_MISSING");
    if (!documentModel) blockers.push("INSTITUTIONAL_DOCUMENT_MODEL_MISSING");
    if (documentModel && documentModel.generated !== true) blockers.push("DOCUMENT_NOT_GENERATED");
    if (documentModel?.status === "RENDER_FAILED") blockers.push("DOCUMENT_RENDER_FAILED");
    if (reportInput && documentModel?.metadata?.projectId && documentModel.metadata.projectId !== reportInput.projectId) {
      blockers.push("DOCUMENT_PROJECT_MISMATCH");
    }
    if (reportInput && documentModel?.sourceSnapshotId && documentModel.sourceSnapshotId !== reportInput.generatedAt) {
      blockers.push("STALE_REPORT_SNAPSHOT");
    }
    if (reportInput && documentModel?.metadata?.generatedAt && documentModel.metadata.generatedAt !== reportInput.generatedAt) {
      blockers.push("STALE_DOCUMENT_MODEL");
    }
    if (!artifactReference) blockers.push("DOCUMENT_ARTIFACT_REFERENCE_MISSING");
    if (hasCriticalExclusion(reportInput)) blockers.push("CRITICAL_PUBLICATION_EXCLUSION_PRESENT");

    asArray<string>(documentModel?.renderingIssues).forEach((issue) => warnings.push(`DOCUMENT_RENDERING_WARNING:${issue}`));
    warnings.push("CERTIFICATION_ROLE_ENFORCEMENT_PENDING");

    if (input.action === "AI_REVIEW") blockers.push("AI_REVIEW_CANNOT_CERTIFY");
    if (input.action === "SCORE_REVIEW") blockers.push("SCORE_REVIEW_CANNOT_CERTIFY");

    const nonIdentityBlockers = blockers.filter((code) => code !== "CERTIFIER_IDENTITY_UNAVAILABLE");
    const canRequestCertification = nonIdentityBlockers.length === 0;

    if (input.action === "CERTIFY" && !actor) {
      blockers.push("CERTIFIER_IDENTITY_UNAVAILABLE");
    }

    const canCertify = input.action === "CERTIFY" && blockers.length === 0 && Boolean(actor);
    const status: InstitutionalCertificationStatus = canCertify
      ? "CERTIFIED"
      : canRequestCertification
        ? "PENDING_CERTIFICATION"
        : "NOT_CERTIFIED";

    return {
      status,
      canRequestCertification,
      canCertify,
      blockingReasons: Array.from(new Set(blockers)),
      warnings: Array.from(new Set(warnings)),
      requiredHumanActions,
      reportSnapshotId: reportInput?.generatedAt || documentModel?.sourceSnapshotId || null,
      institutionalReportInputId: institutionalReportInputId(reportInput),
      documentModelId: documentModel?.modelId || null,
      documentArtifactReference: artifactReference,
      documentArtifactHash: artifactHash,
      published: false,
      certified: false,
    };
  }

  public static requestInstitutionalCertification(input: {
    reportReadyAssessment?: ReportReadyAssessment | null;
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    requestedBy?: CertificationActorIdentity | null;
    requestedAt?: string | null;
  }): InstitutionalReportCertification {
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      ...input,
      action: "REQUEST_CERTIFICATION",
      certifierIdentity: null,
    });
    if (!decision.canRequestCertification) {
      throw new Error(`CERTIFICATION_REQUEST_BLOCKED:${decision.blockingReasons.join(",")}`);
    }
    const requestedAt = input.requestedAt ?? new Date().toISOString();
    return {
      certificationId: certificationRequestIdFor({
        projectId: input.institutionalReportInput.projectId,
        reportSnapshotId: input.institutionalReportInput.generatedAt,
        documentModelId: input.institutionalDocumentModel.modelId,
        documentArtifactReference: input.documentArtifactReference,
        now: requestedAt,
      }),
      status: "PENDING_CERTIFICATION",
      projectId: input.institutionalReportInput.projectId,
      reportSnapshotId: input.institutionalReportInput.generatedAt,
      institutionalReportInputId: institutionalReportInputId(input.institutionalReportInput) as string,
      documentModelId: input.institutionalDocumentModel.modelId,
      documentArtifactReference: input.documentArtifactReference,
      documentArtifactHash: input.documentArtifactHash ?? null,
      reportReadyStatus: input.institutionalReportInput.reportReadyAssessment.status,
      reportReadyAssessment: input.institutionalReportInput.reportReadyAssessment,
      validationReferences: {
        evidenceIds: input.institutionalReportInput.lineageSummary.evidenceIds,
        findingIds: input.institutionalReportInput.lineageSummary.findingIds,
        analysisIds: input.institutionalReportInput.lineageSummary.analysisIds,
        conclusionIds: input.institutionalReportInput.lineageSummary.conclusionIds,
        geographyId: input.institutionalReportInput.lineageSummary.geographyId,
      },
      lineageReference: input.institutionalReportInput.lineageSummary,
      warnings: decision.warnings,
      blockersAtDecision: [],
      requestedAt,
      requestedBy: preserveRealIdentity(input.requestedBy),
      certifiedAt: null,
      certifiedBy: null,
      published: false,
    };
  }

  public static certifyInstitutionalReport(input: {
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    certifierIdentity: CertificationActorIdentity;
    certifiedAt?: string | null;
    supersedesCertificationId?: string | null;
  }): InstitutionalReportCertification {
    const certifiedAt = input.certifiedAt ?? new Date().toISOString();
    const actor = preserveRealIdentity(input.certifierIdentity);
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      ...input,
      reportReadyAssessment: input.institutionalReportInput.reportReadyAssessment,
      certifierIdentity: actor,
      action: "CERTIFY",
    });
    if (!decision.canCertify || !actor) {
      throw new Error(`INSTITUTIONAL_CERTIFICATION_BLOCKED:${decision.blockingReasons.join(",")}`);
    }

    return {
      certificationId: certificationIdFor({
        projectId: input.institutionalReportInput.projectId,
        reportSnapshotId: input.institutionalReportInput.generatedAt,
        documentModelId: input.institutionalDocumentModel.modelId,
        documentArtifactReference: input.documentArtifactReference,
        actor,
        now: certifiedAt,
      }),
      status: "CERTIFIED",
      projectId: input.institutionalReportInput.projectId,
      reportSnapshotId: input.institutionalReportInput.generatedAt,
      institutionalReportInputId: institutionalReportInputId(input.institutionalReportInput) as string,
      documentModelId: input.institutionalDocumentModel.modelId,
      documentArtifactReference: input.documentArtifactReference,
      documentArtifactHash: input.documentArtifactHash ?? null,
      reportReadyStatus: input.institutionalReportInput.reportReadyAssessment.status,
      reportReadyAssessment: input.institutionalReportInput.reportReadyAssessment,
      validationReferences: {
        evidenceIds: input.institutionalReportInput.lineageSummary.evidenceIds,
        findingIds: input.institutionalReportInput.lineageSummary.findingIds,
        analysisIds: input.institutionalReportInput.lineageSummary.analysisIds,
        conclusionIds: input.institutionalReportInput.lineageSummary.conclusionIds,
        geographyId: input.institutionalReportInput.lineageSummary.geographyId,
      },
      lineageReference: input.institutionalReportInput.lineageSummary,
      warnings: decision.warnings,
      blockersAtDecision: [],
      certifiedAt,
      certifiedBy: actor,
      supersedesCertificationId: input.supersedesCertificationId ?? null,
      published: false,
    };
  }

  public static rejectInstitutionalCertification(input: {
    certification: InstitutionalReportCertification;
    rejectedBy: CertificationActorIdentity;
    rejectedAt?: string | null;
    rejectionReason: string;
  }): InstitutionalReportCertification {
    const actor = preserveRealIdentity(input.rejectedBy);
    if (!actor) throw new Error("CERTIFICATION_REJECTION_BLOCKED:CERTIFIER_IDENTITY_UNAVAILABLE");
    return {
      ...input.certification,
      status: "REJECTED",
      rejectedAt: input.rejectedAt ?? new Date().toISOString(),
      rejectedBy: actor,
      rejectionReason: input.rejectionReason,
      certifiedAt: null,
      certifiedBy: null,
      published: false,
    };
  }

  public static revokeInstitutionalCertification(input: {
    certification: InstitutionalReportCertification;
    revokedBy: CertificationActorIdentity;
    revokedAt?: string | null;
    revocationReason: string;
  }): InstitutionalReportCertification {
    const actor = preserveRealIdentity(input.revokedBy);
    if (!actor) throw new Error("CERTIFICATION_REVOCATION_BLOCKED:CERTIFIER_IDENTITY_UNAVAILABLE");
    return {
      ...input.certification,
      status: "REVOKED",
      revokedAt: input.revokedAt ?? new Date().toISOString(),
      revokedBy: actor,
      revocationReason: input.revocationReason,
      published: false,
    };
  }

  public static supersedeInstitutionalCertification(
    previous: InstitutionalReportCertification,
    replacement: InstitutionalReportCertification
  ): InstitutionalReportCertification {
    return {
      ...previous,
      status: "SUPERSEDED",
      supersededByCertificationId: replacement.certificationId,
      published: false,
    };
  }

  public static isCertificationCurrentForSnapshot(input: {
    certification: InstitutionalReportCertification | null | undefined;
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
  }): boolean {
    const cert = input.certification;
    return Boolean(
      cert
      && cert.status === "CERTIFIED"
      && cert.reportSnapshotId === input.institutionalReportInput.generatedAt
      && cert.institutionalReportInputId === institutionalReportInputId(input.institutionalReportInput)
      && cert.documentModelId === input.institutionalDocumentModel.modelId
      && cert.documentArtifactReference === input.documentArtifactReference
    );
  }

  public static resolveCurrentInstitutionalCertification(input: {
    certifications: InstitutionalReportCertification[];
    institutionalReportInput?: InstitutionalReportInput | null;
    institutionalDocumentModel?: InstitutionalDocumentModel | null;
    documentArtifactReference?: string | null;
  }): InstitutionalReportCertification | null {
    return input.certifications
      .filter((cert) => cert.status === "CERTIFIED")
      .filter((cert) => {
        if (!input.institutionalReportInput || !input.institutionalDocumentModel || !input.documentArtifactReference) return true;
        return ReportCertificationGate.isCertificationCurrentForSnapshot({
          certification: cert,
          institutionalReportInput: input.institutionalReportInput,
          institutionalDocumentModel: input.institutionalDocumentModel,
          documentArtifactReference: input.documentArtifactReference,
        });
      })
      .sort((a, b) => String(b.certifiedAt || "").localeCompare(String(a.certifiedAt || "")))[0] || null;
  }

  public static adaptLegacyCertification(input: {
    projectId?: string | null;
    certified?: boolean | null;
    certificationId?: string | null;
  }): InstitutionalCertificationDecision {
    return {
      status: input.certified ? "NOT_CERTIFIED" : "NOT_CERTIFIED",
      canRequestCertification: false,
      canCertify: false,
      blockingReasons: ["LEGACY_CERTIFICATION_UNVERIFIED"],
      warnings: ["LEGACY_CERTIFICATION_BOOLEAN_IS_NOT_INSTITUTIONAL_CERTIFICATION"],
      requiredHumanActions: ["EXPLICIT_HUMAN_CERTIFICATION_ACTION", "REAL_CERTIFIER_IDENTITY"],
      reportSnapshotId: null,
      institutionalReportInputId: null,
      documentModelId: null,
      documentArtifactReference: null,
      documentArtifactHash: null,
      published: false,
      certified: false,
    };
  }

  public static evaluateInstitutionalPublicationGate(input: {
    currentCertification?: InstitutionalReportCertification | null;
    institutionalReportInput?: InstitutionalReportInput | null;
    institutionalDocumentModel?: InstitutionalDocumentModel | null;
    documentArtifactReference?: string | null;
    documentArtifactHash?: string | null;
    publisherIdentity?: CertificationActorIdentity | null;
    action?: InstitutionalPublicationAction | null;
  }): InstitutionalPublicationDecision {
    const certification = input.currentCertification || null;
    const reportInput = input.institutionalReportInput || null;
    const documentModel = input.institutionalDocumentModel || null;
    const artifactReference = asCleanString(input.documentArtifactReference);
    const artifactHash = asCleanString(input.documentArtifactHash);
    const publisher = preserveRealIdentity(input.publisherIdentity);
    const blockers: string[] = [];
    const warnings: string[] = ["PUBLICATION_ROLE_ENFORCEMENT_PENDING"];
    const requiredHumanActions = ["EXPLICIT_HUMAN_PUBLICATION_ACTION", "REAL_PUBLISHER_IDENTITY"];

    if (!certification) {
      blockers.push("CURRENT_CERTIFICATION_REQUIRED");
    } else {
      if (certification.status !== "CERTIFIED") blockers.push("CURRENT_CERTIFICATION_REQUIRED");
      if (certification.status === "REVOKED") blockers.push("CERTIFICATION_REVOKED");
      if (certification.status === "SUPERSEDED") blockers.push("STALE_CERTIFICATION");
      if (reportInput && certification.reportSnapshotId !== reportInput.generatedAt) {
        blockers.push("CERTIFICATION_SNAPSHOT_MISMATCH");
      }
      if (documentModel && certification.documentModelId !== documentModel.modelId) {
        blockers.push("STALE_DOCUMENT_MODEL");
      }
      if (artifactReference && certification.documentArtifactReference !== artifactReference) {
        blockers.push("ARTIFACT_MISMATCH");
      }
      if (certification.documentArtifactHash && artifactHash && certification.documentArtifactHash !== artifactHash) {
        blockers.push("ARTIFACT_HASH_MISMATCH");
      }
      if (!certification.documentArtifactHash || !artifactHash) {
        warnings.push("ARTIFACT_HASH_UNAVAILABLE");
      }
    }

    if (!reportInput) blockers.push("INSTITUTIONAL_REPORT_INPUT_MISSING");
    if (!documentModel) blockers.push("INSTITUTIONAL_DOCUMENT_MODEL_MISSING");
    if (!artifactReference) blockers.push("DOCUMENT_ARTIFACT_REFERENCE_MISSING");
    if (reportInput && documentModel?.sourceSnapshotId && documentModel.sourceSnapshotId !== reportInput.generatedAt) {
      blockers.push("STALE_REPORT_SNAPSHOT");
    }
    if (input.action === "AI_REVIEW") blockers.push("AI_REVIEW_CANNOT_PUBLISH");
    if (input.action === "SCORE_REVIEW") blockers.push("SCORE_REVIEW_CANNOT_PUBLISH");
    if (input.action === "DOWNLOAD") blockers.push("DOWNLOAD_IS_NOT_PUBLICATION");

    const canRequestPublication = blockers.length === 0;
    if (input.action === "PUBLISH" && !publisher) {
      blockers.push("PUBLISHER_IDENTITY_UNAVAILABLE");
    }

    const canPublish = input.action === "PUBLISH" && blockers.length === 0 && Boolean(publisher);
    return {
      status: canPublish ? "PUBLISHED" : canRequestPublication ? "PENDING_PUBLICATION" : "NOT_PUBLISHED",
      canRequestPublication,
      canPublish,
      blockingReasons: Array.from(new Set(blockers)),
      warnings: Array.from(new Set(warnings)),
      requiredHumanActions,
      certificationId: certification?.certificationId || null,
      projectId: certification?.projectId || reportInput?.projectId || documentModel?.metadata?.projectId || null,
      reportSnapshotId: certification?.reportSnapshotId || reportInput?.generatedAt || documentModel?.sourceSnapshotId || null,
      documentModelId: certification?.documentModelId || documentModel?.modelId || null,
      documentArtifactReference: artifactReference,
      documentArtifactHash: artifactHash,
      published: false,
    };
  }

  public static requestInstitutionalPublication(input: {
    currentCertification: InstitutionalReportCertification;
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    requestedBy?: CertificationActorIdentity | null;
    requestedAt?: string | null;
    publicationChannelOrType: string;
  }): InstitutionalReportPublication {
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({
      ...input,
      action: "REQUEST_PUBLICATION",
    });
    if (!decision.canRequestPublication) {
      throw new Error(`PUBLICATION_REQUEST_BLOCKED:${decision.blockingReasons.join(",")}`);
    }
    const requestedAt = input.requestedAt ?? new Date().toISOString();
    return {
      publicationId: publicationIdFor({
        projectId: input.currentCertification.projectId,
        certificationId: input.currentCertification.certificationId,
        documentArtifactReference: input.documentArtifactReference,
        publicationChannelOrType: input.publicationChannelOrType,
        now: requestedAt,
      }),
      projectId: input.currentCertification.projectId,
      certificationId: input.currentCertification.certificationId,
      reportSnapshotId: input.currentCertification.reportSnapshotId,
      documentModelId: input.currentCertification.documentModelId,
      documentArtifactReference: input.documentArtifactReference,
      documentArtifactHash: input.documentArtifactHash ?? null,
      status: "PENDING_PUBLICATION",
      requestedAt,
      requestedBy: preserveRealIdentity(input.requestedBy),
      publishedAt: null,
      publishedBy: null,
      publicationChannelOrType: input.publicationChannelOrType,
      warnings: decision.warnings,
    };
  }

  public static publishInstitutionalReport(input: {
    currentCertification: InstitutionalReportCertification;
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    publisherIdentity: CertificationActorIdentity;
    publishedAt?: string | null;
    publicationChannelOrType: string;
    supersedesPublicationId?: string | null;
  }): InstitutionalReportPublication {
    const publishedAt = input.publishedAt ?? new Date().toISOString();
    const publisher = preserveRealIdentity(input.publisherIdentity);
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({
      ...input,
      publisherIdentity: publisher,
      action: "PUBLISH",
    });
    if (!decision.canPublish || !publisher) {
      throw new Error(`INSTITUTIONAL_PUBLICATION_BLOCKED:${decision.blockingReasons.join(",")}`);
    }
    return {
      publicationId: publicationIdFor({
        projectId: input.currentCertification.projectId,
        certificationId: input.currentCertification.certificationId,
        documentArtifactReference: input.documentArtifactReference,
        publicationChannelOrType: input.publicationChannelOrType,
        now: publishedAt,
      }),
      projectId: input.currentCertification.projectId,
      certificationId: input.currentCertification.certificationId,
      reportSnapshotId: input.currentCertification.reportSnapshotId,
      documentModelId: input.currentCertification.documentModelId,
      documentArtifactReference: input.documentArtifactReference,
      documentArtifactHash: input.documentArtifactHash ?? null,
      status: "PUBLISHED",
      publishedAt,
      publishedBy: publisher,
      publicationChannelOrType: input.publicationChannelOrType,
      warnings: decision.warnings,
      supersedesPublicationId: input.supersedesPublicationId ?? null,
    };
  }

  public static failInstitutionalPublication(input: {
    request: InstitutionalReportPublication;
    failureReason: string;
    failureAt?: string | null;
  }): InstitutionalReportPublication {
    return {
      ...input.request,
      status: "PUBLICATION_FAILED",
      failureAt: input.failureAt ?? new Date().toISOString(),
      failureReason: input.failureReason,
    };
  }

  public static revokeInstitutionalPublication(input: {
    publication: InstitutionalReportPublication;
    revokedBy: CertificationActorIdentity;
    revocationReason: string;
    revokedAt?: string | null;
  }): InstitutionalReportPublication {
    const actor = preserveRealIdentity(input.revokedBy);
    if (!actor) throw new Error("PUBLICATION_REVOCATION_BLOCKED:PUBLISHER_IDENTITY_UNAVAILABLE");
    return {
      ...input.publication,
      status: "REVOKED",
      revokedAt: input.revokedAt ?? new Date().toISOString(),
      revokedBy: actor,
      revocationReason: input.revocationReason,
    };
  }

  public static supersedeInstitutionalPublication(
    previous: InstitutionalReportPublication,
    replacement: InstitutionalReportPublication
  ): InstitutionalReportPublication {
    return {
      ...previous,
      status: "SUPERSEDED",
      supersededByPublicationId: replacement.publicationId,
    };
  }

  public static resolveCurrentInstitutionalPublication(input: {
    publications: InstitutionalReportPublication[];
    certification?: InstitutionalReportCertification | null;
    documentArtifactReference?: string | null;
    documentArtifactHash?: string | null;
  }): InstitutionalReportPublication | null {
    const artifactReference = asCleanString(input.documentArtifactReference);
    const artifactHash = asCleanString(input.documentArtifactHash);
    return input.publications
      .filter((publication) => publication.status === "PUBLISHED")
      .filter((publication) => {
        if (input.certification && publication.certificationId !== input.certification.certificationId) return false;
        if (input.certification && publication.reportSnapshotId !== input.certification.reportSnapshotId) return false;
        if (input.certification && publication.documentModelId !== input.certification.documentModelId) return false;
        if (artifactReference && publication.documentArtifactReference !== artifactReference) return false;
        if (artifactHash && publication.documentArtifactHash && publication.documentArtifactHash !== artifactHash) return false;
        return true;
      })
      .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")))[0] || null;
  }

  public static adaptLegacyPublication(input: {
    projectId?: string | null;
    published?: boolean | null;
  }): InstitutionalPublicationDecision {
    return {
      status: "NOT_PUBLISHED",
      canRequestPublication: false,
      canPublish: false,
      blockingReasons: ["LEGACY_PUBLICATION_UNVERIFIED"],
      warnings: ["LEGACY_PUBLICATION_BOOLEAN_IS_NOT_INSTITUTIONAL_PUBLICATION"],
      requiredHumanActions: ["EXPLICIT_HUMAN_PUBLICATION_ACTION", "REAL_PUBLISHER_IDENTITY"],
      certificationId: null,
      projectId: input.projectId ?? null,
      reportSnapshotId: null,
      documentModelId: null,
      documentArtifactReference: null,
      documentArtifactHash: null,
      published: false,
    };
  }
}
