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

export class TemporalComparisonPersistenceService {
  static async saveTemporalComparison(
    expedienteId: string,
    record: TemporalComparisonRecord
  ): Promise<TemporalComparisonRecord> {
    const db = getFirestoreInstance();
    const normalizedRecord: TemporalComparisonRecord = {
      ...record,
      expedienteId,
      analystValidation: {
        ...record.analystValidation,
        status: normalizeGeointGovernanceStatus(record.analystValidation?.status),
      },
      updatedAt: new Date().toISOString(),
    };

    const subcolRef = doc(db, "projects", expedienteId, "geoint_temporal_comparisons", normalizedRecord.id);
    const rootRef = doc(db, "geoint_temporal_comparisons", normalizedRecord.id);

    await runTransaction(db, async (transaction) => {
      await GeointEventOutboxService.enqueueEventInTransaction(transaction, db, {
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
    reviewerId: string
  ): Promise<TemporalComparisonRecord | null> {
    const db = getFirestoreInstance();
    const now = new Date().toISOString();
    const normalizedStatus = normalizeGeointGovernanceStatus(status);
    const subcolRef = doc(db, "projects", expedienteId, "geoint_temporal_comparisons", comparisonId);
    const rootRef = doc(db, "geoint_temporal_comparisons", comparisonId);
    const eventType = normalizedStatus === GeointGovernanceStatus.APPROVED_EVIDENCE ? "HUMAN_APPROVED" : "HUMAN_REJECTED";
    let updated: TemporalComparisonRecord | null = null;

    await runTransaction(db, async (transaction) => {
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

      await GeointEventOutboxService.enqueueEventInTransaction(transaction, db, {
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
