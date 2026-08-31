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
}
