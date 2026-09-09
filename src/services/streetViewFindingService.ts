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
import { adaptEvidence, adaptFinding } from "@/services/geoint/canonicalEvidenceRegistry";
import type { CanonicalReferenceSet } from "@/types/canonicalEvidenceRegistry";
import { buildStreetViewFindingLineage, validateLineage, type CanonicalLineageNode, type LineageStatus } from "@/utils/evidenceLineage";
import { validateInstitutionalEvidenceTraceability } from "@/utils/institutionalEvidenceTraceabilityGuard";

export interface StreetViewFinding {
  id: string;
  expedienteId: string;
  traceabilityId: string;
  sourceEvidenceId?: string;
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
  createdBy?: string;
  validatedBy?: any;
  validationDate?: string;
  humanValidationStatus?: string;
  validationSource?: string;
  supportingEvidenceIds?: string[];
  lineage?: CanonicalLineageNode[];
  lineageStatus?: LineageStatus | "COMPLETE" | "PARTIAL" | "LEGACY_PARTIAL" | "UNAVAILABLE";
  geographyId?: string | null;
}

function present(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveStreetViewFindingDedupKey(finding: Partial<StreetViewFinding>): string {
  const traceabilityId = present(finding.traceabilityId);
  const sourceEvidenceId = present(finding.sourceEvidenceId);
  if (traceabilityId && sourceEvidenceId) return `${traceabilityId}::${sourceEvidenceId}`;
  return `id::${present(finding.id) || present(finding.captureId) || "UNAVAILABLE"}`;
}

export function deduplicateStreetViewFindings(findings: StreetViewFinding[]): StreetViewFinding[] {
  const seen = new Set<string>();
  const result: StreetViewFinding[] = [];

  for (const finding of findings) {
    const key = resolveStreetViewFindingDedupKey(finding);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(finding);
  }

  return result;
}

export type HistoricalStreetViewFindingClassification =
  | "HISTORICAL_RECOVERABLE"
  | "HISTORICAL_INCOMPLETE"
  | "HISTORICAL_UNRECOVERABLE";

export function classifyHistoricalStreetViewFinding(
  data: Partial<StreetViewFinding> & { expedienteId?: string }
): { classification: HistoricalStreetViewFindingClassification; reasons: string[] } {
  const reasons: string[] = [];
  const id = present(data.id) || present(data.captureId);
  const expedienteId = present(data.expedienteId);
  const sourceEvidenceId = present(data.sourceEvidenceId) || present(data.captureId) || present(data.evidenciaId);
  const geographyId = present(data.geographyId);
  const hasContext = Boolean(present(data.fechaCreacion) || present(data.descripcion) || present(data.observaciones_visual));
  const lat = Number(data.coordenadas?.lat);
  const lng = Number(data.coordenadas?.lng);
  const hasValidGeo = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);

  if (!id) reasons.push("missing finding id");
  if (!expedienteId) reasons.push("missing expedienteId");
  if (!sourceEvidenceId) reasons.push("missing sourceEvidenceId");
  if (!geographyId) reasons.push("missing geographyId");
  if (!hasValidGeo) reasons.push("invalid coordinates");
  if (!hasContext) reasons.push("missing historical context");

  if (reasons.length === 0) return { classification: "HISTORICAL_RECOVERABLE", reasons };
  if (id && expedienteId && sourceEvidenceId && hasValidGeo) return { classification: "HISTORICAL_INCOMPLETE", reasons };
  return { classification: "HISTORICAL_UNRECOVERABLE", reasons };
}

export function recoverHistoricalStreetViewFindingForApproval(
  data: Partial<StreetViewFinding> & { expedienteId: string }
): Partial<StreetViewFinding> & { expedienteId: string } {
  if (present(data.traceabilityId)) return data;

  const classification = classifyHistoricalStreetViewFinding(data);
  if (classification.classification !== "HISTORICAL_RECOVERABLE") return data;

  const id = present(data.id) || present(data.captureId)!;
  const sourceEvidenceId = present(data.sourceEvidenceId) || present(data.captureId) || present(data.evidenciaId)!;
  const geographyId = present(data.geographyId)!;
  const lineage = data.lineage?.length
    ? data.lineage
    : buildStreetViewFindingLineage({
        findingId: id,
        evidenceId: sourceEvidenceId,
        sourceReference: data.imagen,
        geographyId,
      });
  const lineageStatus = validateLineage(lineage).status;

  return {
    ...data,
    id,
    sourceEvidenceId,
    traceabilityId: buildGeointTraceabilityId("trace-streetview-historical", [
      data.expedienteId,
      id,
      sourceEvidenceId,
      geographyId,
    ]),
    lineage,
    lineageStatus,
  };
}

export function normalizeStreetViewFindingForPersistence(
  data: Partial<StreetViewFinding> & { expedienteId: string }
): StreetViewFinding {
  const id = data.id || data.captureId || `sv-finding-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fechaCreacion = data.fechaCreacion || new Date().toISOString();
  const rawLat: unknown = data.coordenadas?.lat;
  const rawLng: unknown = data.coordenadas?.lng;
  const lat = rawLat == null || rawLat === "" ? Number.NaN : Number(rawLat);
  const lng = rawLng == null || rawLng === "" ? Number.NaN : Number(rawLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) {
    throw new Error("STREETVIEW_FINDING_GEO_REQUIRED");
  }

  const normalizedStatus = normalizeGeointGovernanceStatus(data.estado || GeointGovernanceStatus.PENDING_REVIEW);
  const traceabilityId =
    present(data.traceabilityId) ||
    (normalizedStatus === GeointGovernanceStatus.APPROVED_EVIDENCE
      ? ""
      : buildGeointTraceabilityId("trace-finding", [data.expedienteId, id]));
  const sourceEvidenceId =
    present(data.sourceEvidenceId) ||
    present(data.captureId) ||
    present(data.evidenciaId);
  const geographyId = present(data.geographyId) || null;
  const lineageStatus = data.lineageStatus || (sourceEvidenceId && geographyId ? "COMPLETE" : "LEGACY_PARTIAL");

  const finding: StreetViewFinding = {
    id,
    expedienteId: data.expedienteId,
    traceabilityId,
    ...(sourceEvidenceId ? { sourceEvidenceId } : {}),
    ...(data.evidenciaId ? { evidenciaId: data.evidenciaId } : {}),
    ...(data.captureId ? { captureId: data.captureId } : {}),
    categoria: data.categoria || "RUTA_ACCESO",
    coordenadas: {
      lat,
      lng
    },
    imagen: data.imagen || "",
    heading: Number(data.heading || 0),
    pitch: Number(data.pitch || 0),
    fov: Number(data.fov || 90),
    estado: normalizedStatus,
    descripcion: data.descripcion || "",
    observaciones_visual: data.observaciones_visual || "",
    fechaCreacion,
    usuarioRevision: data.usuarioRevision || "",
    validationComment: data.validationComment || "",
    origenRevision: data.origenRevision || "BARRIDO_AUTOMATICO",
    ...(data.createdBy ? { createdBy: data.createdBy } : {}),
    ...(data.validatedBy ? { validatedBy: data.validatedBy } : {}),
    ...(data.validationDate ? { validationDate: data.validationDate } : {}),
    ...(data.humanValidationStatus ? { humanValidationStatus: data.humanValidationStatus } : {}),
    ...(data.validationSource ? { validationSource: data.validationSource } : {}),
    supportingEvidenceIds: data.supportingEvidenceIds || (sourceEvidenceId ? [sourceEvidenceId] : []),
    lineage: data.lineage || [],
    lineageStatus,
    geographyId,
  };

  if (normalizedStatus === GeointGovernanceStatus.APPROVED_EVIDENCE) {
    const institutionalValidation = validateInstitutionalEvidenceTraceability({
      traceabilityId: finding.traceabilityId,
      sourceEvidenceId: finding.sourceEvidenceId,
      geographyId: finding.geographyId,
      expedienteId: finding.expedienteId,
      lineageStatus: finding.lineageStatus,
      coordenadas: finding.coordenadas,
    });

    if (!institutionalValidation.eligible) {
      throw new Error(`STREETVIEW_FINDING_TRACEABILITY_INCOMPLETE: ${institutionalValidation.reasons.join("; ")}`);
    }
  }

  return finding;
}

function getFirestoreInstance() {
  if (typeof window === "undefined") {
    return getFirebaseServerDb();
  } else {
    return getDb();
  }
}

export class StreetViewFindingService {
  static deriveCanonicalReferences(finding: StreetViewFinding): CanonicalReferenceSet {
    const evidenceRef = adaptEvidence({
      expedienteId: finding.expedienteId,
      nativeEvidenceId: finding.sourceEvidenceId || finding.evidenciaId,
      nativeType: "STREET_VIEW_EVIDENCE",
      sourceType: "STREET_VIEW",
      sourceId: finding.captureId,
      traceabilityId: finding.traceabilityId,
      geographyId: finding.geographyId,
      legacy: !finding.sourceEvidenceId,
    });
    const evidenceRefs = evidenceRef ? [evidenceRef] : [];
    const findingRef = adaptFinding({
      expedienteId: finding.expedienteId,
      nativeFindingId: finding.id,
      nativeType: "STREET_VIEW_FINDING",
      sourceType: "STREET_VIEW",
      sourceFindingId: finding.captureId,
      sourceId: finding.sourceEvidenceId,
      supportingEvidenceRefs: evidenceRefs,
      traceabilityId: finding.traceabilityId,
      geographyId: finding.geographyId,
      legacy: !finding.sourceEvidenceId,
    });
    return { evidenceRefs, findingRef };
  }

  /**
   * Registra o crea un nuevo hallazgo de StreetView en Firestore.
   */
  static async createStreetViewFinding(
    data: Partial<StreetViewFinding> & { expedienteId: string }
  ): Promise<StreetViewFinding> {
    const db = getFirestoreInstance();
    const finding = normalizeStreetViewFindingForPersistence(data);

    // Fuente canonica de escritura: subcoleccion del expediente. La raiz se sincroniza para consultas legacy.
    const projectSubcolRef = doc(db, "projects", data.expedienteId, "streetview_findings", finding.id);
    await setDoc(projectSubcolRef, finding, { merge: true });

    // Compatibilidad: mirror raiz 'streetview_findings' para lectores existentes por expedienteId.
    const rootColRef = doc(db, "streetview_findings", finding.id);
    await setDoc(rootColRef, finding, { merge: true });

    return finding;
  }

  /**
   * Obtiene todos los hallazgos de StreetView vinculados a un expediente.
   */
  static async getStreetViewFindingsByProject(expedienteId: string): Promise<StreetViewFinding[]> {
    const db = getFirestoreInstance();
    const findings: StreetViewFinding[] = [];

    try {
      // 1. Consultar subcolección projects/{expedienteId}/streetview_findings
      const subcolRef = collection(db, "projects", expedienteId, "streetview_findings");
      const subcolSnap = await getDocs(subcolRef);

      subcolSnap.forEach((docSnap) => {
        const item = docSnap.data() as StreetViewFinding;
        const findingId = item.id || docSnap.id;
        findings.push({ ...item, id: findingId });
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
        findings.push({ ...item, id: findingId });
      });
    } catch (err) {
      console.warn(`[StreetViewFindingService] Warn al leer colección raíz streetview_findings:`, err);
    }

    return deduplicateStreetViewFindings(findings);
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

    if (payload.estado === GeointGovernanceStatus.APPROVED_EVIDENCE) {
      const subcolRef = doc(db, "projects", expedienteId, "streetview_findings", findingId);
      const rootColRef = doc(db, "streetview_findings", findingId);
      const subcolSnap = await getDoc(subcolRef);
      const rootSnap = subcolSnap.exists() ? null : await getDoc(rootColRef);
      const existingData = subcolSnap.exists()
        ? subcolSnap.data()
        : rootSnap?.exists()
          ? rootSnap.data()
          : null;

      if (!existingData) {
        throw new Error("STREET_VIEW_FINDING_PROMOTION_BLOCKED: missing finding record");
      }

      try {
        const approvalFinding = recoverHistoricalStreetViewFindingForApproval({
          ...(existingData as Partial<StreetViewFinding>),
          ...payload,
          id: findingId,
          expedienteId,
          estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
        });
        normalizeStreetViewFindingForPersistence(approvalFinding);
        if (approvalFinding.traceabilityId) payload.traceabilityId = approvalFinding.traceabilityId;
        if (approvalFinding.sourceEvidenceId) payload.sourceEvidenceId = approvalFinding.sourceEvidenceId;
        if (approvalFinding.lineage) payload.lineage = approvalFinding.lineage;
        if (approvalFinding.lineageStatus) payload.lineageStatus = approvalFinding.lineageStatus;
      } catch (err: any) {
        throw new Error(`STREET_VIEW_FINDING_PROMOTION_BLOCKED: ${err?.message || "traceability validation failed"}`);
      }
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
