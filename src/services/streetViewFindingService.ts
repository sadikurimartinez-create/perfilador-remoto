import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { getFirebaseServerDb } from "@/lib/firebaseServer";
import { getDb } from "@/lib/firebase";
import {
  GeointGovernanceStatus,
  GeointGovernanceStatusValue,
  buildGeointTraceabilityId,
  normalizeGeointGovernanceStatus,
} from "@/types/geointGovernance";

export interface StreetViewFinding {
  id: string;
  expedienteId: string;
  traceabilityId: string;
  sourceEvidenceId: string;
  evidenciaId?: string;
  captureId?: string;
  categoria:
    | "pendiente_clasificacion"
    | "COMPARACION_TEMPORAL"
    | "ACECHO_ESCONDITE"
    | "GRAFFITI_PANDILLA"
    | "DENUE_POI"
    | "OSINT_GENERAL"
    | "acecho"
    | "graffiti"
    | "denue"
    | "sin_hallazgo"
    | "RUTA_ACCESO"
    | "PUNTO_ACECHO";
  coordenadas: {
    lat: number;
    lng: number;
  };
  imagen?: string;
  heading?: number;
  pitch?: number;
  fov?: number;
  estado:
    GeointGovernanceStatusValue;
  descripcion?: string;
  observaciones_visual?: string;
  fechaCreacion?: string;
  usuarioRevision?: string;
  validationComment?: string;
  origenRevision?: "BARRIDO_AUTOMATICO" | "MANUAL";
}

function getFirestoreInstance() {
  if (typeof window === "undefined") {
    return getFirebaseServerDb();
  } else {
    return getDb();
  }
}

export class StreetViewFindingService {
  /**
   * Registra o crea un nuevo hallazgo de StreetView en Firestore.
   */
  static async createStreetViewFinding(
    data: Partial<StreetViewFinding> & { expedienteId: string }
  ): Promise<StreetViewFinding> {
    const db = getFirestoreInstance();
    const id = data.id || data.captureId || `sv-finding-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fechaCreacion = data.fechaCreacion || new Date().toISOString();

    const finding: StreetViewFinding = {
      id,
      expedienteId: data.expedienteId,
      traceabilityId:
        (data as any).traceabilityId ||
        buildGeointTraceabilityId("trace-finding", [data.expedienteId, id]),
      sourceEvidenceId:
        (data as any).sourceEvidenceId ||
        data.captureId ||
        data.evidenciaId ||
        id,
      evidenciaId: data.evidenciaId || `evi-${Date.now()}`,
      captureId: data.captureId || id,
      categoria: data.categoria || "RUTA_ACCESO",
      coordenadas: {
        lat: Number(data.coordenadas?.lat || 0),
        lng: Number(data.coordenadas?.lng || 0)
      },
      imagen: data.imagen || "",
      heading: Number(data.heading || 0),
      pitch: Number(data.pitch || 0),
      fov: Number(data.fov || 90),
      estado: normalizeGeointGovernanceStatus(data.estado || GeointGovernanceStatus.PENDING_REVIEW),
      descripcion: data.descripcion || "",
      observaciones_visual: data.observaciones_visual || "",
      fechaCreacion,
      usuarioRevision: data.usuarioRevision || "",
      validationComment: data.validationComment || "",
      origenRevision: data.origenRevision || "BARRIDO_AUTOMATICO"
    };

    // Guardar en la subcolección del proyecto
    const projectSubcolRef = doc(db, "projects", data.expedienteId, "streetview_findings", id);
    await setDoc(projectSubcolRef, finding, { merge: true });

    // Guardar también en la colección raíz 'streetview_findings' para consultas directas por expedienteId
    const rootColRef = doc(db, "streetview_findings", id);
    await setDoc(rootColRef, finding, { merge: true });

    return finding;
  }

  /**
   * Obtiene todos los hallazgos de StreetView vinculados a un expediente.
   */
  static async getStreetViewFindingsByProject(expedienteId: string): Promise<StreetViewFinding[]> {
    const db = getFirestoreInstance();
    const findings: StreetViewFinding[] = [];
    const seenIds = new Set<string>();

    try {
      // 1. Consultar subcolección projects/{expedienteId}/streetview_findings
      const subcolRef = collection(db, "projects", expedienteId, "streetview_findings");
      const subcolSnap = await getDocs(subcolRef);

      subcolSnap.forEach((docSnap) => {
        const item = docSnap.data() as StreetViewFinding;
        const findingId = item.id || docSnap.id;
        if (!seenIds.has(findingId)) {
          seenIds.add(findingId);
          findings.push({ ...item, id: findingId });
        }
      });
    } catch (err) {
      console.warn(`[StreetViewFindingService] Warn al leer subcolección del proyecto ${expedienteId}:`, err);
    }

    try {
      // 2. Consultar colección raíz streetview_findings filtrando por expedienteId
      const rootColRef = collection(db, "streetview_findings");
      const q = query(rootColRef, where("expedienteId", "==", expedienteId));
      const rootSnap = await getDocs(q);

      rootSnap.forEach((docSnap) => {
        const item = docSnap.data() as StreetViewFinding;
        const findingId = item.id || docSnap.id;
        if (!seenIds.has(findingId)) {
          seenIds.add(findingId);
          findings.push({ ...item, id: findingId });
        }
      });
    } catch (err) {
      console.warn(`[StreetViewFindingService] Warn al leer colección raíz streetview_findings:`, err);
    }

    return findings;
  }

  /**
   * Actualiza el estado probatorio y atributos de revisión de un hallazgo.
   */
  static async updateStreetViewFindingStatus(
    expedienteId: string,
    findingId: string,
    updateData: Partial<StreetViewFinding>
  ): Promise<boolean> {
    const db = getFirestoreInstance();
    const payload: Partial<StreetViewFinding> & { updatedAt: string } = {
      ...updateData,
      estado: updateData.estado ? normalizeGeointGovernanceStatus(updateData.estado) : undefined,
      updatedAt: new Date().toISOString()
    };
    if (!payload.estado) {
      delete payload.estado;
    }

    try {
      const subcolRef = doc(db, "projects", expedienteId, "streetview_findings", findingId);
      await setDoc(subcolRef, payload, { merge: true });
    } catch (err) {
      console.warn(`[StreetViewFindingService] Error al actualizar subcolección ${findingId}:`, err);
    }

    try {
      const rootColRef = doc(db, "streetview_findings", findingId);
      await setDoc(rootColRef, payload, { merge: true });
    } catch (err) {
      console.warn(`[StreetViewFindingService] Error al actualizar colección raíz ${findingId}:`, err);
    }

    return true;
  }

  /**
   * Promueve un hallazgo a Evidencia Probatoria Aprobada (APPROVED_EVIDENCE) según ADR-016.
   */
  static async promoteFindingToApprovedEvidence(
    expedienteId: string,
    findingId: string,
    approvalData: { usuarioRevision: string; validationComment: string }
  ): Promise<boolean> {
    return this.updateStreetViewFindingStatus(expedienteId, findingId, {
      estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
      usuarioRevision: approvalData.usuarioRevision,
      validationComment: approvalData.validationComment
    });
  }
}
