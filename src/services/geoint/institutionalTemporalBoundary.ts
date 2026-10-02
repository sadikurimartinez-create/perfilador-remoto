import "server-only";
import { createHash } from "crypto";
import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { getInstitutionalAdminDb } from "@/lib/firebaseAdmin";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { validAuthorizationId } from "@/services/institutionalAuthorizationProjectionService";
import { canonicalSemanticValue } from "@/utils/institutionalDocumentSemanticIntegrity";
import { GeointEventOutboxService } from "./geointEventOutboxService";
import { TemporalComparisonPersistenceService, type TemporalPersistencePort } from "./temporalComparisonPersistenceService";
import { normalizeGeointGovernanceStatus, GeointGovernanceStatus } from "@/types/geointGovernance";
import type { TemporalComparisonRecord } from "@/types/geointTemporalComparison";

type Dependencies = { authorize: typeof authorizeInstitutionalProjectAccess; database: () => Firestore };
function semantic(record: any) {
  const { updatedAt, createdAt, ...content } = record;
  return canonicalSemanticValue({ ...content, analystValidation: { ...content.analystValidation, reviewedAt: null } });
}
export async function executeInstitutionalTemporal(input: { session: unknown; projectId: string; operation: 'SAVE' | 'REVIEW' | 'LIST'; record?: TemporalComparisonRecord; comparisonId?: string; status?: string; comments?: string }, overrides: Partial<Dependencies> = {}) {
  const deps = { authorize: authorizeInstitutionalProjectAccess, database: getInstitutionalAdminDb, ...overrides };
  const access = await deps.authorize({ sessionToken: input.session, projectId: input.projectId, action: input.operation === 'LIST' ? 'READ' : 'WRITE' });
  if (!access.allowed) throw new Error('TEMPORAL_ACCESS_DENIED');
  const db = deps.database(); const projectId = access.projectId;
  if (input.operation === 'LIST') {
    const snapshots = await Promise.all([db.collection('projects').doc(projectId).collection('geoint_temporal_comparisons').get(), db.collection('geoint_temporal_comparisons').where('expedienteId','==',projectId).get()]);
    const records = new Map<string, any>();
    for (const snapshot of snapshots) for (const doc of snapshot.docs) {
      const record = doc.data(); if (record.expedienteId !== projectId) throw new Error('TEMPORAL_CROSS_PROJECT');
      if (!records.has(doc.id) && (!input.status || normalizeGeointGovernanceStatus(record.analystValidation?.status) === normalizeGeointGovernanceStatus(input.status))) records.set(doc.id, { ...record, id: doc.id });
    }
    return Array.from(records.values());
  }
  const id = input.operation === 'SAVE' ? input.record?.id : input.comparisonId;
  if (!validAuthorizationId(id)) throw new Error('TEMPORAL_INVALID_ID');
  const entity = db.collection('projects').doc(projectId).collection('geoint_temporal_comparisons').doc(id);
  const root = db.collection('geoint_temporal_comparisons').doc(id);
  const actor = `user:${access.actor.institutionalUserId}`;
  let prior: any = null;
  const port: TemporalPersistencePort = {
    db, document: (database, ...segments) => database.doc(segments.join('/')),
    transaction: async (_database, work) => { await db.runTransaction(async raw => {
      const project = await raw.get(db.collection('projects').doc(projectId));
      const data = project.data();
      if (!data || (data.deleted !== undefined && data.deleted !== false) || data.estado === 'ARCHIVADO' || data.status === 'ARCHIVADO') throw new Error('TEMPORAL_PROJECT_INACCESSIBLE');
      const existing = await raw.get(entity); const legacy = await raw.get(root);
      prior = existing.data() ?? legacy.data() ?? null;
      if (prior && prior.expedienteId !== projectId || legacy.exists && legacy.data()?.expedienteId !== projectId) throw new Error('TEMPORAL_CROSS_PROJECT');
      const writes: Array<[DocumentReference, any, any]> = [];
      await work({ get: async (ref: DocumentReference) => { const snap = await raw.get(ref); return { exists: () => snap.exists, data: () => snap.data() }; },
        set: (ref: DocumentReference, value: any, options?: any) => { writes.push([ref,value,options]); } });
      for (const [ref,value,options] of writes) {
        if (ref.path === entity.path || ref.path === root.path) {
          value.createdAt = prior?.createdAt || new Date().toISOString();
          if (prior && input.operation === 'SAVE' && semantic(prior) !== semantic(value)) throw new Error('TEMPORAL_EXISTING_RECORD_IMMUTABLE');
        }
        if (options) raw.set(ref,value,options); else raw.set(ref,value);
      }
    }); },
    enqueue: async (transaction, database, payload) => {
      const prepared = await GeointEventOutboxService.prepareEventInTransaction(transaction,database,{ ...payload, actor, expedienteId: projectId },(database,...segments) => database.doc(segments.join('/')));
      const auditId = createHash('sha256').update('temporal:'+prepared.fingerprint).digest('hex');
      const auditRef = database.collection('audit_logs').doc(auditId);
      const audit = await transaction.get(auditRef);
      if (prepared.exists && canonicalSemanticValue(prepared.entry.payload) !== canonicalSemanticValue({ ...payload, actor, expedienteId: projectId })) throw new Error('TEMPORAL_RETRY_CONFLICT');
      if (audit.exists() && audit.data()?.projectId !== projectId) throw new Error('TEMPORAL_AUDIT_CROSS_PROJECT');
      if (prepared.exists && !audit.exists()) throw new Error('TEMPORAL_LEGACY_EVENT_RECONCILIATION_REQUIRED');
      const entry = GeointEventOutboxService.commitPreparedEventInTransaction(transaction,prepared,() => FieldValue.serverTimestamp());
      if (!audit.exists()) transaction.set(auditRef,{ projectId, action: payload.eventType, actorInstitutionalUserId: access.actor.institutionalUserId, user: access.actor.username,
        timestamp: new Date().toISOString(), source: 'SERVER', policyVersion: access.policyVersion, eventId: entry.eventId });
      return entry;
    },
  };
  if (input.operation === 'SAVE') {
    const record = input.record;
    if (!record || record.expedienteId !== projectId || typeof record.traceabilityId !== 'string' || !record.traceabilityId || !record.sourceEvidenceId || !record.evidenceA?.id || !record.evidenceB?.id || JSON.stringify(record).length > 1000000) throw new Error('TEMPORAL_PAYLOAD_INVALID');
    // Creation is observation; only the separate authenticated review can promote it.
    const normalized = { ...record, analystValidation: { status: GeointGovernanceStatus.PENDING_REVIEW, reviewerId: actor } };
    return TemporalComparisonPersistenceService.saveTemporalComparison(projectId, normalized, port);
  }
  const status = normalizeGeointGovernanceStatus(input.status);
  if (![GeointGovernanceStatus.APPROVED_EVIDENCE, GeointGovernanceStatus.REJECTED_FINDING, GeointGovernanceStatus.RETURNED_FOR_REANALYSIS].includes(status as any) || typeof input.comments !== 'string' || !input.comments.trim() || input.comments.length > 10000) throw new Error('TEMPORAL_REVIEW_INVALID');
  return TemporalComparisonPersistenceService.updateTemporalComparisonStatus(projectId,id,status,input.comments,actor,port);
}
