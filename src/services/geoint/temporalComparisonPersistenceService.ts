import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import { getFirebaseServerDb } from "@/lib/firebaseServer";
import { getDb } from "@/lib/firebase";
import { GeointEventOutboxService } from "@/services/geoint/geointEventOutboxService";
import { TemporalComparisonRecord } from "@/types/geointTemporalComparison";
import {
  GeointGovernanceStatus,
  GeointGovernanceStatusValue,
  normalizeGeointGovernanceStatus,
} from "@/types/geointGovernance";

function getFirestoreInstance() {
  return typeof window === "undefined" ? getFirebaseServerDb() : getDb();
}

export interface TemporalPersistencePort {
  db: any;
  document(db: any, ...segments: string[]): any;
  transaction(db: any, work: (transaction: any) => Promise<void>): Promise<void>;
  enqueue(transaction: any, db: any, payload: any): Promise<any>;
}
function persistencePort(override?: TemporalPersistencePort): TemporalPersistencePort {
  return override || { db: getFirestoreInstance(), document: doc,
    transaction: runTransaction as any, enqueue: GeointEventOutboxService.enqueueEventInTransaction.bind(GeointEventOutboxService) };
}
async function temporalRequest(projectId: string, method: string, body?: unknown, comparisonId?: string) {
  const path = `/api/expedientes/${encodeURIComponent(projectId)}/geoint/temporal-comparisons${comparisonId ? '/'+encodeURIComponent(comparisonId) : ''}`;
  const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error('TEMPORAL_BOUNDARY_DENIED');
  return response.json();
}

export class TemporalComparisonPersistenceService {
  static async saveTemporalComparison(
    expedienteId: string,
    record: TemporalComparisonRecord, port?: TemporalPersistencePort
  ): Promise<TemporalComparisonRecord> {
    if (typeof window !== "undefined" && !port) return (await temporalRequest(expedienteId, "POST", record)).comparison;
    const persistence = persistencePort(port); const db = persistence.db;
    const normalizedRecord: TemporalComparisonRecord = {
      ...record,
      expedienteId,
      analystValidation: {
        ...record.analystValidation,
        status: normalizeGeointGovernanceStatus(record.analystValidation?.status),
      },
      updatedAt: new Date().toISOString(),
    };

    const subcolRef = persistence.document(db, "projects", expedienteId, "geoint_temporal_comparisons", normalizedRecord.id);
    const rootRef = persistence.document(db, "geoint_temporal_comparisons", normalizedRecord.id);

    await persistence.transaction(db, async (transaction) => {
      await persistence.enqueue(transaction, db, {
        eventType: "TEMPORAL_COMPARISON_CREATED",
        expedienteId,
        traceabilityId: normalizedRecord.traceabilityId,
        actor: normalizedRecord.analystValidation?.reviewerId || "ANALISTA_GEOINT",
        source: "TemporalComparisonPersistenceService",
        status: normalizedRecord.analystValidation.status,
        entityType: "TEMPORAL_COMPARISON",
        entityId: normalizedRecord.id,
        metadata: {
          comparisonId: normalizedRecord.id,
          evidenceA: normalizedRecord.evidenceA,
          evidenceB: normalizedRecord.evidenceB,
        },
      });
      transaction.set(subcolRef, normalizedRecord, { merge: true });
      transaction.set(rootRef, normalizedRecord, { merge: true });
    });

    return normalizedRecord;

  }

  static async updateTemporalComparisonStatus(
    expedienteId: string,
    comparisonId: string,
    status: GeointGovernanceStatusValue,
    comments: string,
    reviewerId: string, port?: TemporalPersistencePort
  ): Promise<TemporalComparisonRecord | null> {
    if (typeof window !== "undefined" && !port) return (await temporalRequest(expedienteId, "PATCH", { status, comments }, comparisonId)).comparison;
    const persistence = persistencePort(port); const db = persistence.db;
    const now = new Date().toISOString();
    const normalizedStatus = normalizeGeointGovernanceStatus(status);
    const subcolRef = persistence.document(db, "projects", expedienteId, "geoint_temporal_comparisons", comparisonId);
    const rootRef = persistence.document(db, "geoint_temporal_comparisons", comparisonId);
    const eventType = normalizedStatus === GeointGovernanceStatus.APPROVED_EVIDENCE ? "HUMAN_APPROVED" : "HUMAN_REJECTED";
    let updated: TemporalComparisonRecord | null = null;

    await persistence.transaction(db, async (transaction) => {
      const existingSnap = await transaction.get(subcolRef);
      const existing = existingSnap.exists()
        ? (existingSnap.data() as TemporalComparisonRecord)
        : null;

      if (!existing) {
        updated = null;
        return;
      }

      const previousStatus = existing.analystValidation?.status || "PENDING_REVIEW";
      updated = {
        ...existing,
        analystValidation: {
          status: normalizedStatus,
          reviewerId,
          reviewedAt: now,
          comments: comments.trim(),
        },
        updatedAt: now,
      };

      await persistence.enqueue(transaction, db, {
        eventType,
        expedienteId,
        traceabilityId: existing.traceabilityId,
        actor: reviewerId,
        source: "TemporalComparisonPersistenceService",
        status: normalizedStatus,
        entityType: "TEMPORAL_COMPARISON",
        entityId: comparisonId,
        metadata: {
          previousStatus,
          newStatus: normalizedStatus,
          comments: comments.trim(),
        },
      });
      transaction.set(subcolRef, updated, { merge: true });
      transaction.set(rootRef, updated, { merge: true });
    });

    return updated;

  }

  static async getTemporalComparisonsByProject(
    expedienteId: string,
    status?: GeointGovernanceStatusValue
  ): Promise<TemporalComparisonRecord[]> {
    if (typeof window !== "undefined") {
      const records = (await temporalRequest(expedienteId, 'GET')).comparisons as TemporalComparisonRecord[];
      return status ? records.filter(record => normalizeGeointGovernanceStatus(record.analystValidation?.status) === normalizeGeointGovernanceStatus(status)) : records;
    }
    const db = getFirestoreInstance();
    const records: TemporalComparisonRecord[] = [];
    const seen = new Set<string>();
    const normalizedStatus = status ? normalizeGeointGovernanceStatus(status) : null;

    const pushRecord = (record: TemporalComparisonRecord, id: string) => {
      if (seen.has(id)) return;
      if (normalizedStatus && normalizeGeointGovernanceStatus(record.analystValidation?.status) !== normalizedStatus) {
        return;
      }
      seen.add(id);
      records.push({ ...record, id });
    };

    try {
      const subcolRef = collection(db, "projects", expedienteId, "geoint_temporal_comparisons");
      const subcolSnap = await getDocs(subcolRef);
      subcolSnap.forEach((docSnap) => {
        pushRecord(docSnap.data() as TemporalComparisonRecord, docSnap.id);
      });
    } catch (err) {
      console.warn(`[TemporalComparisonPersistenceService] Warn leyendo subcoleccion ${expedienteId}:`, err);
    }

    try {
      const rootColRef = collection(db, "geoint_temporal_comparisons");
      const rootQuery = query(rootColRef, where("expedienteId", "==", expedienteId));
      const rootSnap = await getDocs(rootQuery);
      rootSnap.forEach((docSnap) => {
        pushRecord(docSnap.data() as TemporalComparisonRecord, docSnap.id);
      });
    } catch (err) {
      console.warn("[TemporalComparisonPersistenceService] Warn leyendo coleccion raiz:", err);
    }

    return records;
  }
}
