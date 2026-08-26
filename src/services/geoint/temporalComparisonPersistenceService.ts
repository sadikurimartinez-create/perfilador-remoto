import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getFirebaseServerDb } from "@/lib/firebaseServer";
import { logGeointEvent } from "@/services/geoint/logGeointEvent";
import { getDb } from "@/lib/firebase";
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

    await setDoc(
      doc(db, "projects", expedienteId, "geoint_temporal_comparisons", normalizedRecord.id),
      normalizedRecord,
      { merge: true }
    );
    await setDoc(
      doc(db, "geoint_temporal_comparisons", normalizedRecord.id),
      normalizedRecord,
      { merge: true }
    );

    // Event Log Forense: Registrar creación de comparación temporal (ADR-019.18)
    await logGeointEvent(
      "TEMPORAL_COMPARISON_CREATED",
      expedienteId,
      normalizedRecord.traceabilityId,
      normalizedRecord.analystValidation?.reviewerId || "ANALISTA_GEOINT",
      "TemporalComparisonPersistenceService",
      normalizedRecord.analystValidation.status,
      "TEMPORAL_COMPARISON",
      normalizedRecord.id,
      {
        comparisonId: normalizedRecord.id,
        evidenceA: normalizedRecord.evidenceA,
        evidenceB: normalizedRecord.evidenceB,
      }
    );

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
    const existingSnap = await getDoc(subcolRef);
    const existing = existingSnap.exists()
      ? (existingSnap.data() as TemporalComparisonRecord)
      : null;

    if (!existing) return null;

    const previousStatus = existing.analystValidation?.status || "PENDING_REVIEW";
    const updated: TemporalComparisonRecord = {
      ...existing,
      analystValidation: {
        status: normalizedStatus,
        reviewerId,
        reviewedAt: now,
        comments: comments.trim(),
      },
      updatedAt: now,
    };

    await setDoc(subcolRef, updated, { merge: true });
    await setDoc(rootRef, updated, { merge: true });

    // Event Log Forense: Registrar validación humana (HUMAN_APPROVED o HUMAN_REJECTED) (ADR-019.18)
    const eventType = normalizedStatus === GeointGovernanceStatus.APPROVED_EVIDENCE ? "HUMAN_APPROVED" : "HUMAN_REJECTED";
    await logGeointEvent(
      eventType,
      expedienteId,
      existing.traceabilityId,
      reviewerId,
      "TemporalComparisonPersistenceService",
      normalizedStatus,
      "TEMPORAL_COMPARISON",
      comparisonId,
      {
        previousStatus,
        newStatus: normalizedStatus,
        comments: comments.trim(),
      }
    );

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
