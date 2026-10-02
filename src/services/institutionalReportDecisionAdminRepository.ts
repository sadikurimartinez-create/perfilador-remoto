import "server-only";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";
import { GeointEventFingerprintService } from "@/services/geoint/geointEventFingerprintService";
import type { GeointOutboxEventPayload } from "@/services/geoint/geointEventOutboxService";
import type { InstitutionalCertificationRepository } from "./institutionalReportCertificationService";
import type { InstitutionalPublicationRepository } from "./institutionalReportPublicationService";
import type { InstitutionalReportCertification, InstitutionalReportPublication } from "@/utils/reportCertificationGate";

class AdminDecisionRepository {
  protected db = getInstitutionalAdminDb();
  constructor(private collection: string, private idField: string) {}
  protected ref(projectId: string, id: string) { return this.db.collection("projects").doc(projectId).collection(this.collection).doc(id); }
  async get(projectId: string, id: string): Promise<any> { const snap = await this.ref(projectId,id).get(); return snap.exists ? snap.data() : null; }
  async list(projectId: string): Promise<any[]> { return (await this.db.collection("projects").doc(projectId).collection(this.collection).get()).docs.map(doc => doc.data()); }
  protected async commit(record: any, superseded: any[], event?: GeointOutboxEventPayload) {
    if (!event || event.expedienteId !== record.projectId) throw new Error("REPORT_DECISION_AUDIT_REQUIRED");
    const fingerprint = GeointEventFingerprintService.generateEventFingerprint(event);
    const fingerprintRef = this.db.collection("geoint_event_fingerprints").doc(fingerprint);
    return this.db.runTransaction(async transaction => {
      const project = await transaction.get(this.db.collection("projects").doc(record.projectId));
      const data = project.data();
      if (!data || (data.deleted !== undefined && data.deleted !== false) || data.estado === "ARCHIVADO" || data.status === "ARCHIVADO") throw new Error("REPORT_DECISION_PROJECT_INACCESSIBLE");
      const existingFingerprint = await transaction.get(fingerprintRef);
      if (existingFingerprint.exists) {
        const existing = await transaction.get(this.ref(record.projectId, record[this.idField]));
        if (!existing.exists) throw new Error("REPORT_DECISION_INCONSISTENT_AUDIT");
        return existing.data();
      }
      for (const prior of superseded) {
        if (prior.projectId !== record.projectId) throw new Error("REPORT_DECISION_CROSS_PROJECT");
        transaction.set(this.ref(record.projectId, prior[this.idField]), prior);
      }
      transaction.set(this.ref(record.projectId, record[this.idField]), record);
      const eventId = `evt-${fingerprint.substring(0,16)}`;
      const timestamp = new Date().toISOString();
      transaction.create(this.db.collection("geoint_event_logs").doc(eventId), {
        eventId, eventType: event.eventType, timestamp, expedienteId: event.expedienteId,
        traceabilityId: event.traceabilityId, actor: event.actor, source: event.source, status: event.status,
        payload: { entityType: event.entityType, entityId: event.entityId, ...event.metadata },
      });
      transaction.create(fingerprintRef, { fingerprint, eventId, expedienteId: event.expedienteId,
        traceabilityId: event.traceabilityId, eventType: event.eventType, entityId: event.entityId, status: event.status, createdAt: timestamp });
      return record;
    });
  }
}
export class AdminInstitutionalCertificationRepository extends AdminDecisionRepository implements InstitutionalCertificationRepository {
  constructor() { super("reportCertifications", "certificationId"); }
  create(record: InstitutionalReportCertification, event?: GeointOutboxEventPayload) { return this.commit(record, [], event); }
  save(record: InstitutionalReportCertification, event?: GeointOutboxEventPayload) { return this.commit(record, [], event); }
  certifyAndSupersede(record: InstitutionalReportCertification, superseded: InstitutionalReportCertification[], event?: GeointOutboxEventPayload) { return this.commit(record, superseded, event); }
}
export class AdminInstitutionalPublicationRepository extends AdminDecisionRepository implements InstitutionalPublicationRepository {
  constructor() { super("reportPublications", "publicationId"); }
  create(record: InstitutionalReportPublication, event?: GeointOutboxEventPayload) { return this.commit(record, [], event); }
  save(record: InstitutionalReportPublication, event?: GeointOutboxEventPayload) { return this.commit(record, [], event); }
  publishAndSupersede(record: InstitutionalReportPublication, superseded: InstitutionalReportPublication[], event?: GeointOutboxEventPayload) { return this.commit(record, superseded, event); }
}
