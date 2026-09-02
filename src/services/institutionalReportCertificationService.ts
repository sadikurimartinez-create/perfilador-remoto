import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { InstitutionalDocumentModel } from "@/utils/institutionalDocumentAssembly";
import type { InstitutionalReportInput } from "@/utils/institutionalReportPublicationContract";
import {
  isRealCertificationActorIdentity,
  ReportCertificationGate,
  type CertificationActorIdentity,
  type InstitutionalReportCertification,
} from "@/utils/reportCertificationGate";
import { GeointEventOutboxService, type GeointOutboxEventPayload } from "@/services/geoint/geointEventOutboxService";

export interface InstitutionalCertificationRepository {
  create(certification: InstitutionalReportCertification, event?: GeointOutboxEventPayload): Promise<InstitutionalReportCertification>;
  get(projectId: string, certificationId: string): Promise<InstitutionalReportCertification | null>;
  list(projectId: string): Promise<InstitutionalReportCertification[]>;
  save(certification: InstitutionalReportCertification, event?: GeointOutboxEventPayload): Promise<InstitutionalReportCertification>;
  certifyAndSupersede(
    certification: InstitutionalReportCertification,
    superseded: InstitutionalReportCertification[],
    event?: GeointOutboxEventPayload
  ): Promise<InstitutionalReportCertification>;
}

function certificationCollection(db: Firestore, projectId: string) {
  return collection(db, "projects", projectId, "reportCertifications");
}

function certificationDoc(db: Firestore, projectId: string, certificationId: string) {
  return doc(db, "projects", projectId, "reportCertifications", certificationId);
}

export class FirestoreInstitutionalCertificationRepository implements InstitutionalCertificationRepository {
  constructor(private readonly db: Firestore = getDb()) {}

  async create(certification: InstitutionalReportCertification, event?: GeointOutboxEventPayload): Promise<InstitutionalReportCertification> {
    if (!event) {
      await setDoc(certificationDoc(this.db, certification.projectId, certification.certificationId), certification);
      return certification;
    }
    await runTransaction(this.db, async (transaction) => {
      transaction.set(certificationDoc(this.db, certification.projectId, certification.certificationId), certification);
      await GeointEventOutboxService.enqueueEventInTransaction(transaction, this.db, event);
    });
    return certification;
  }

  async get(projectId: string, certificationId: string): Promise<InstitutionalReportCertification | null> {
    const snap = await getDoc(certificationDoc(this.db, projectId, certificationId));
    return snap.exists() ? snap.data() as InstitutionalReportCertification : null;
  }

  async list(projectId: string): Promise<InstitutionalReportCertification[]> {
    const snap = await getDocs(certificationCollection(this.db, projectId));
    return snap.docs.map((item) => item.data() as InstitutionalReportCertification);
  }

  async save(certification: InstitutionalReportCertification, event?: GeointOutboxEventPayload): Promise<InstitutionalReportCertification> {
    if (!event) {
      await setDoc(certificationDoc(this.db, certification.projectId, certification.certificationId), certification, { merge: true });
      return certification;
    }
    await runTransaction(this.db, async (transaction) => {
      transaction.set(certificationDoc(this.db, certification.projectId, certification.certificationId), certification, { merge: true });
      await GeointEventOutboxService.enqueueEventInTransaction(transaction, this.db, event);
    });
    return certification;
  }

  async certifyAndSupersede(
    certification: InstitutionalReportCertification,
    superseded: InstitutionalReportCertification[],
    event?: GeointOutboxEventPayload
  ): Promise<InstitutionalReportCertification> {
    await runTransaction(this.db, async (transaction) => {
      superseded.forEach((record) => {
        transaction.set(certificationDoc(this.db, record.projectId, record.certificationId), record, { merge: true });
      });
      transaction.set(certificationDoc(this.db, certification.projectId, certification.certificationId), certification);
      if (event) {
        await GeointEventOutboxService.enqueueEventInTransaction(transaction, this.db, event);
      }
    });
    return certification;
  }
}

function actorLabel(identity: CertificationActorIdentity | null | undefined): string {
  return String(identity?.id || identity?.uid || identity?.email || identity?.name || identity?.displayName || "UNAVAILABLE");
}

function certificationEventPayload(
  eventType: string,
  certification: InstitutionalReportCertification,
  actor: CertificationActorIdentity | null | undefined,
  source: string,
  metadata: Record<string, any> = {}
): GeointOutboxEventPayload {
  return {
    eventType,
    expedienteId: certification.projectId,
    traceabilityId: certification.certificationId,
    actor: actorLabel(actor),
    source,
    status: certification.status,
    entityType: "INSTITUTIONAL_REPORT_CERTIFICATION",
    entityId: certification.certificationId,
    metadata: {
      certificationId: certification.certificationId,
      reportSnapshotId: certification.reportSnapshotId,
      documentModelId: certification.documentModelId,
      documentArtifactReference: certification.documentArtifactReference,
      documentArtifactHash: certification.documentArtifactHash,
      ...metadata,
    },
  };
}

export class InstitutionalReportCertificationService {
  constructor(private readonly repository: InstitutionalCertificationRepository = new FirestoreInstitutionalCertificationRepository()) {}

  async requestCertification(input: {
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    requestedBy?: CertificationActorIdentity | null;
    requestedAt?: string | null;
  }): Promise<InstitutionalReportCertification> {
    const request = ReportCertificationGate.requestInstitutionalCertification(input);
    return this.repository.create(
      request,
      certificationEventPayload("REPORT_CERTIFICATION_REQUESTED", request, request.requestedBy, "InstitutionalReportCertificationService.requestCertification")
    );
  }

  async certifyInstitutionalReport(input: {
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    certifierIdentity: CertificationActorIdentity | null | undefined;
    certifiedAt?: string | null;
  }): Promise<InstitutionalReportCertification> {
    if (!isRealCertificationActorIdentity(input.certifierIdentity)) {
      throw new Error("INSTITUTIONAL_CERTIFICATION_BLOCKED:CERTIFIER_IDENTITY_UNAVAILABLE");
    }

    const existing = await this.repository.list(input.institutionalReportInput.projectId);
    const activeForProject = existing.filter((record) => record.status === "CERTIFIED");
    const supersedesCertificationId = activeForProject
      .sort((a, b) => String(b.certifiedAt || "").localeCompare(String(a.certifiedAt || "")))[0]?.certificationId ?? null;

    const certification = ReportCertificationGate.certifyInstitutionalReport({
      ...input,
      certifierIdentity: input.certifierIdentity,
      supersedesCertificationId,
    });

    const superseded = activeForProject.map((record) =>
      ReportCertificationGate.supersedeInstitutionalCertification(record, certification)
    );

    return this.repository.certifyAndSupersede(
      certification,
      superseded,
      certificationEventPayload("REPORT_CERTIFIED", certification, certification.certifiedBy, "InstitutionalReportCertificationService.certifyInstitutionalReport", {
        supersededCertificationIds: superseded.map((record) => record.certificationId),
      })
    );
  }

  async rejectInstitutionalCertification(input: {
    certification: InstitutionalReportCertification;
    rejectedBy: CertificationActorIdentity | null | undefined;
    rejectedAt?: string | null;
    rejectionReason: string;
  }): Promise<InstitutionalReportCertification> {
    const rejected = ReportCertificationGate.rejectInstitutionalCertification({
      certification: input.certification,
      rejectedBy: input.rejectedBy as CertificationActorIdentity,
      rejectedAt: input.rejectedAt,
      rejectionReason: input.rejectionReason,
    });
    return this.repository.save(
      rejected,
      certificationEventPayload("REPORT_CERTIFICATION_REJECTED", rejected, rejected.rejectedBy, "InstitutionalReportCertificationService.rejectInstitutionalCertification", {
        rejectionReason: rejected.rejectionReason,
      })
    );
  }

  async revokeInstitutionalCertification(input: {
    projectId: string;
    certificationId: string;
    revokedBy: CertificationActorIdentity | null | undefined;
    revokedAt?: string | null;
    revocationReason: string;
  }): Promise<InstitutionalReportCertification> {
    const certification = await this.repository.get(input.projectId, input.certificationId);
    if (!certification) {
      throw new Error("CERTIFICATION_REVOCATION_BLOCKED:CERTIFICATION_NOT_FOUND");
    }
    const revoked = ReportCertificationGate.revokeInstitutionalCertification({
      certification,
      revokedBy: input.revokedBy as CertificationActorIdentity,
      revokedAt: input.revokedAt,
      revocationReason: input.revocationReason,
    });
    return this.repository.save(
      revoked,
      certificationEventPayload("REPORT_CERTIFICATION_REVOKED", revoked, revoked.revokedBy, "InstitutionalReportCertificationService.revokeInstitutionalCertification", {
        revocationReason: revoked.revocationReason,
      })
    );
  }

  async listCertifications(projectId: string): Promise<InstitutionalReportCertification[]> {
    return this.repository.list(projectId);
  }

  async getCurrentInstitutionalCertification(input: {
    projectId: string;
    institutionalReportInput?: InstitutionalReportInput | null;
    institutionalDocumentModel?: InstitutionalDocumentModel | null;
    documentArtifactReference?: string | null;
  }): Promise<InstitutionalReportCertification | null> {
    const certifications = await this.repository.list(input.projectId);
    return ReportCertificationGate.resolveCurrentInstitutionalCertification({
      certifications,
      institutionalReportInput: input.institutionalReportInput,
      institutionalDocumentModel: input.institutionalDocumentModel,
      documentArtifactReference: input.documentArtifactReference,
    });
  }
}

export const institutionalReportCertificationService = new InstitutionalReportCertificationService();
