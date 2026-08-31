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
import { GeointEventOutboxService, type GeointOutboxEventPayload } from "@/services/geoint/geointEventOutboxService";
import type { InstitutionalDocumentModel } from "@/utils/institutionalDocumentAssembly";
import type { InstitutionalReportInput } from "@/utils/institutionalReportPublicationContract";
import {
  isRealCertificationActorIdentity,
  ReportCertificationGate,
  type CertificationActorIdentity,
  type InstitutionalReportCertification,
  type InstitutionalReportPublication,
} from "@/utils/reportCertificationGate";
import { institutionalReportCertificationService, type InstitutionalCertificationRepository } from "@/services/institutionalReportCertificationService";

export interface InstitutionalPublicationRepository {
  create(publication: InstitutionalReportPublication, event?: GeointOutboxEventPayload): Promise<InstitutionalReportPublication>;
  get(projectId: string, publicationId: string): Promise<InstitutionalReportPublication | null>;
  list(projectId: string): Promise<InstitutionalReportPublication[]>;
  save(publication: InstitutionalReportPublication, event?: GeointOutboxEventPayload): Promise<InstitutionalReportPublication>;
  publishAndSupersede(
    publication: InstitutionalReportPublication,
    superseded: InstitutionalReportPublication[],
    event?: GeointOutboxEventPayload
  ): Promise<InstitutionalReportPublication>;
}

function publicationCollection(db: Firestore, projectId: string) {
  return collection(db, "projects", projectId, "reportPublications");
}

function publicationDoc(db: Firestore, projectId: string, publicationId: string) {
  return doc(db, "projects", projectId, "reportPublications", publicationId);
}

export class FirestoreInstitutionalPublicationRepository implements InstitutionalPublicationRepository {
  constructor(private readonly db: Firestore = getDb()) {}

  async create(publication: InstitutionalReportPublication, event?: GeointOutboxEventPayload): Promise<InstitutionalReportPublication> {
    if (!event) {
      await setDoc(publicationDoc(this.db, publication.projectId, publication.publicationId), publication);
      return publication;
    }
    await runTransaction(this.db, async (transaction) => {
      transaction.set(publicationDoc(this.db, publication.projectId, publication.publicationId), publication);
      await GeointEventOutboxService.enqueueEventInTransaction(transaction, this.db, event);
    });
    return publication;
  }

  async get(projectId: string, publicationId: string): Promise<InstitutionalReportPublication | null> {
    const snap = await getDoc(publicationDoc(this.db, projectId, publicationId));
    return snap.exists() ? snap.data() as InstitutionalReportPublication : null;
  }

  async list(projectId: string): Promise<InstitutionalReportPublication[]> {
    const snap = await getDocs(publicationCollection(this.db, projectId));
    return snap.docs.map((item) => item.data() as InstitutionalReportPublication);
  }

  async save(publication: InstitutionalReportPublication, event?: GeointOutboxEventPayload): Promise<InstitutionalReportPublication> {
    if (!event) {
      await setDoc(publicationDoc(this.db, publication.projectId, publication.publicationId), publication, { merge: true });
      return publication;
    }
    await runTransaction(this.db, async (transaction) => {
      transaction.set(publicationDoc(this.db, publication.projectId, publication.publicationId), publication, { merge: true });
      await GeointEventOutboxService.enqueueEventInTransaction(transaction, this.db, event);
    });
    return publication;
  }

  async publishAndSupersede(
    publication: InstitutionalReportPublication,
    superseded: InstitutionalReportPublication[],
    event?: GeointOutboxEventPayload
  ): Promise<InstitutionalReportPublication> {
    await runTransaction(this.db, async (transaction) => {
      superseded.forEach((record) => {
        transaction.set(publicationDoc(this.db, record.projectId, record.publicationId), record, { merge: true });
      });
      transaction.set(publicationDoc(this.db, publication.projectId, publication.publicationId), publication);
      if (event) {
        await GeointEventOutboxService.enqueueEventInTransaction(transaction, this.db, event);
      }
    });
    return publication;
  }
}

function actorLabel(identity: CertificationActorIdentity | null | undefined): string {
  return String(identity?.id || identity?.uid || identity?.email || identity?.name || identity?.displayName || "UNAVAILABLE");
}

function publicationEventPayload(
  eventType: string,
  publication: InstitutionalReportPublication,
  actor: CertificationActorIdentity | null | undefined,
  source: string,
  metadata: Record<string, any> = {}
): GeointOutboxEventPayload {
  return {
    eventType,
    expedienteId: publication.projectId,
    traceabilityId: publication.publicationId,
    actor: actorLabel(actor),
    source,
    status: publication.status,
    entityType: "INSTITUTIONAL_REPORT_PUBLICATION",
    entityId: publication.publicationId,
    metadata: {
      publicationId: publication.publicationId,
      certificationId: publication.certificationId,
      reportSnapshotId: publication.reportSnapshotId,
      documentModelId: publication.documentModelId,
      documentArtifactReference: publication.documentArtifactReference,
      documentArtifactHash: publication.documentArtifactHash,
      publicationChannelOrType: publication.publicationChannelOrType,
      ...metadata,
    },
  };
}

export class InstitutionalReportPublicationService {
  constructor(
    private readonly repository: InstitutionalPublicationRepository = new FirestoreInstitutionalPublicationRepository(),
    private readonly certificationReader: Pick<InstitutionalCertificationRepository, "list"> = {
      list: (projectId: string) => institutionalReportCertificationService.listCertifications(projectId),
    }
  ) {}

  async requestPublication(input: {
    projectId: string;
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    requestedBy?: CertificationActorIdentity | null;
    requestedAt?: string | null;
    publicationChannelOrType: string;
  }): Promise<InstitutionalReportPublication> {
    const currentCertification = await this.resolveCurrentCertification(input);
    const request = ReportCertificationGate.requestInstitutionalPublication({
      ...input,
      currentCertification,
    });
    return this.repository.create(
      request,
      publicationEventPayload("REPORT_PUBLICATION_REQUESTED", request, request.requestedBy, "InstitutionalReportPublicationService.requestPublication")
    );
  }

  async publishInstitutionalReport(input: {
    projectId: string;
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    publisherIdentity: CertificationActorIdentity | null | undefined;
    publishedAt?: string | null;
    publicationChannelOrType: string;
  }): Promise<InstitutionalReportPublication> {
    if (!isRealCertificationActorIdentity(input.publisherIdentity)) {
      throw new Error("INSTITUTIONAL_PUBLICATION_BLOCKED:PUBLISHER_IDENTITY_UNAVAILABLE");
    }
    const currentCertification = await this.resolveCurrentCertification(input);
    const existing = await this.repository.list(input.projectId);
    const active = existing.filter((record) => record.status === "PUBLISHED");
    const supersedesPublicationId = active
      .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")))[0]?.publicationId ?? null;
    const publication = ReportCertificationGate.publishInstitutionalReport({
      ...input,
      currentCertification,
      publisherIdentity: input.publisherIdentity,
      supersedesPublicationId,
    });
    const superseded = active.map((record) => ReportCertificationGate.supersedeInstitutionalPublication(record, publication));
    return this.repository.publishAndSupersede(
      publication,
      superseded,
      publicationEventPayload("REPORT_PUBLISHED", publication, publication.publishedBy, "InstitutionalReportPublicationService.publishInstitutionalReport", {
        supersededPublicationIds: superseded.map((record) => record.publicationId),
      })
    );
  }

  async failPublication(input: {
    request: InstitutionalReportPublication;
    failureReason: string;
    failureAt?: string | null;
  }): Promise<InstitutionalReportPublication> {
    const failed = ReportCertificationGate.failInstitutionalPublication(input);
    return this.repository.save(
      failed,
      publicationEventPayload("REPORT_PUBLICATION_FAILED", failed, failed.requestedBy, "InstitutionalReportPublicationService.failPublication", {
        failureReason: failed.failureReason,
      })
    );
  }

  async revokePublication(input: {
    projectId: string;
    publicationId: string;
    revokedBy: CertificationActorIdentity | null | undefined;
    revocationReason: string;
    revokedAt?: string | null;
  }): Promise<InstitutionalReportPublication> {
    const publication = await this.repository.get(input.projectId, input.publicationId);
    if (!publication) throw new Error("PUBLICATION_REVOCATION_BLOCKED:PUBLICATION_NOT_FOUND");
    const revoked = ReportCertificationGate.revokeInstitutionalPublication({
      publication,
      revokedBy: input.revokedBy as CertificationActorIdentity,
      revocationReason: input.revocationReason,
      revokedAt: input.revokedAt,
    });
    return this.repository.save(
      revoked,
      publicationEventPayload("REPORT_PUBLICATION_REVOKED", revoked, revoked.revokedBy, "InstitutionalReportPublicationService.revokePublication", {
        revocationReason: revoked.revocationReason,
      })
    );
  }

  async listPublications(projectId: string): Promise<InstitutionalReportPublication[]> {
    return this.repository.list(projectId);
  }

  async getCurrentPublication(input: {
    projectId: string;
    certification?: InstitutionalReportCertification | null;
    documentArtifactReference?: string | null;
    documentArtifactHash?: string | null;
  }): Promise<InstitutionalReportPublication | null> {
    const publications = await this.repository.list(input.projectId);
    return ReportCertificationGate.resolveCurrentInstitutionalPublication({
      publications,
      certification: input.certification,
      documentArtifactReference: input.documentArtifactReference,
      documentArtifactHash: input.documentArtifactHash,
    });
  }

  private async resolveCurrentCertification(input: {
    projectId: string;
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
  }): Promise<InstitutionalReportCertification> {
    const certifications = await this.certificationReader.list(input.projectId);
    const currentCertification = ReportCertificationGate.resolveCurrentInstitutionalCertification({
      certifications,
      institutionalReportInput: input.institutionalReportInput,
      institutionalDocumentModel: input.institutionalDocumentModel,
      documentArtifactReference: input.documentArtifactReference,
    });
    if (!currentCertification) {
      throw new Error("INSTITUTIONAL_PUBLICATION_BLOCKED:CURRENT_CERTIFICATION_REQUIRED");
    }
    return currentCertification;
  }
}

export const institutionalReportPublicationService = new InstitutionalReportPublicationService();
