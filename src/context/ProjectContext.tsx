"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DatosGobMxResult } from "@/lib/datosGobMx";
import { ImageDeletionGovernanceService } from "@/utils/imageDeletionGovernanceService";
import { EvidenceRelationship } from "@/utils/evidenceRelationshipEngine";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { doc, getDoc, setDoc, collection, addDoc, updateDoc, increment, query, orderBy, getDocs, deleteDoc, runTransaction } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db } from "@/lib/localDb";
import { getDb } from "@/lib/firebase";
import { enqueueSweepLifecycleEventsInTransaction } from "@/services/geoint/geointSweepLifecycleEventService";
import { createStoredRawMultimodalEvidence, type MultimodalEvidenceContract } from "@/utils/multimodalEvidenceContract";
import { createComputedFileIntegrityFromBytes, createHashUnavailableIntegrity } from "@/utils/forensicFileIntegrity";
import {
  certifyGeointSweepWithHumanApproval,
  createHumanTriggeredRunningSweepLifecycle,
  isActiveGeointSweepLifecycleStatus,
  markGeointSweepReadyForHumanReview,
  rejectGeointSweepWithHumanDecision,
  transitionGeointSweepLifecycle,
  type GeointSweepAnalysisStatus,
  type GeointSweepLifecycleRecord,
  type GeointSweepLifecycleStatus,
} from "@/utils/geointSweepLifecycle";
import imageCompression from "browser-image-compression";
import { useAuth } from "@/context/AuthContext";
import { saveGeographicEntity, getGeographicEntities } from "@/services/geographicEntityService";
import type { CanonicalLineageNode, LineageStatus } from "@/utils/evidenceLineage";
import {
  adaptLegacyProjectGeography,
  canonicalizeConfirmedDraftGeography,
  type CanonicalGeographyType,
  type CanonicalProjectGeography,
  type DraftProjectGeography,
} from "@/utils/canonicalProjectGeography";
import type { AiAnalyticalOutput } from "@/utils/aiAnalysisGovernance";
import {
  adaptLegacyProjectHypothesis,
  canProceedWithInstitutionalAnalysis,
  formulateHumanHypothesis,
  reviseHumanHypothesis,
  type CanonicalProjectHypothesis,
} from "@/utils/hypothesisGovernance";
import type { InstitutionalDocumentModel } from "@/utils/institutionalDocumentAssembly";
import type { InstitutionalReportInput } from "@/utils/institutionalReportPublicationContract";
import {
  institutionalReportCertificationService,
} from "@/services/institutionalReportCertificationService";
import { institutionalReportPublicationService } from "@/services/institutionalReportPublicationService";
import type {
  InstitutionalReportCertification,
  InstitutionalReportPublication,
} from "@/utils/reportCertificationGate";
import { assessReportReadiness, type ReportReadyAssessment } from "@/utils/reportReadyGovernance";

export const TIPOS_IMAGEN = [
  "Terrenos baldíos / Caminos sobre terrenos en breña",
  "Viviendas deshabitadas y paracaidistas / Viviendas quemadas",
  "Escuelas / Templos de culto",
  "Bancos y/o cajeros automáticos / Casas de cambio",
  "Gasolineras / Oxxo / Farmacias 24 hrs. / Moteles",
  "Expendios de alcohol / Bares, antros y merenderos / Billares",
  "Terminales de transporte público",
  "Gimnasios",
  "Chatarreras / Casa de empeño / Compra y venta de celulares",
  "Locales de máquinas tragamonedas",
  "Negocios no registrados (Talleres, Barberías, Venta de ropa tipo cholo, Gestorías)",
  "Tianguis / Puestos ambulantes / Puestos de bebidas preparadas / Ventas de dulces / Negocios de suplementos",
  "Picaderos / Anexos y centros de rehabilitación",
  "Alojamiento de personas en situación de calle / Loncherías (cachimbas)",
  "Autobuses y transporte pesado en calles",
  "Otro; ventana para contextualizar"
] as const;

export type TipoImagen = (typeof TIPOS_IMAGEN)[number];

export type EvidenceOrigin = "FIELD" | "REMOTE";
export type CollectionMethod = "IN_PERSON" | "DESKTOP_ANALYSIS" | "VIRTUAL_SWEEP";
export type EvidenceCategoryClass = "FIELD_CAPTURE" | "REMOTE_VISUAL" | "DESKTOP_ANALYSIS";
export type EvidenceConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type SourceProvider = "GOOGLE_STREET_VIEW" | "MAPILLARY" | "BING_STREET_SIDE" | "OTHER";

export type StreetViewMetadata = {
  panoramaLat: number;
  panoramaLng: number;
  heading: number;
  pitch: number;
  fov: number;
  panoId?: string;
  captureDate?: string;
  provider: string;
  captureTimestamp?: number;
};

export type ConfidenceFactors = {
  imageryAgeScore: number;
  geographicPrecision: number;
  sourceReliability: number;
  analystValidation: number;
};

export type AlbumPhoto = {
  id: string;
  previewUrl: string;
  lat: number | null;
  lng: number | null;
  tipo: string;
  comentario: string;
  file?: File;
  evidenceId?: string;
  sourceEvidenceId?: string | null;
  contextualizedAt?: number;
  contextualizedBy?: string;
  isContextualized?: boolean;
  gpsAccuracy?: number | null;
  gpsTimestamp?: number | null;
  gpsSource?: string;
  exifLat?: number | null;
  exifLng?: number | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  diagnosticLogs?: string;
  validado?: boolean;
  humanValidationStatus?: "UNREVIEWED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "RETURNED_FOR_REANALYSIS" | "LEGACY_UNCLASSIFIED";
  validationSource?: "ADR_020_24_HUMAN_ACTION" | "CANONICAL_FIELD" | "LEGACY_COMPATIBILITY" | "TECHNICAL_BOOLEAN" | "AI_READY" | "ABSENT";
  lineage?: CanonicalLineageNode[];
  lineageStatus?: LineageStatus;
  isIndependentPoi?: boolean;
  evidenceRelationship?: EvidenceRelationship | null;
  geographyId?: string | null;
  geographyType?: CanonicalGeographyType | null;
  aiAnalyticalOutput?: AiAnalyticalOutput | null;

  // Extensión de Gobernanza Street View Evidence v2.1 y Contrato Determinista
  evidenceOrigin?: EvidenceOrigin;
  collectionMethod?: CollectionMethod;
  evidenceCategoryClass?: EvidenceCategoryClass;
  confidenceLevel?: EvidenceConfidenceLevel;
  confidencePercentage?: number;
  sourceProvider?: SourceProvider;
  streetViewMetadata?: StreetViewMetadata;
  confidenceFactors?: ConfidenceFactors;
  streetViewCategory?: string;
  streetViewSource?: string;

  // Campos adicionales del contrato determinístico Evidence Governance Engine
  category?: string;
  classification?: string;
  isStreetView?: boolean;
};

export type SweepIntegrationItem = {
  id: string;
  engine: string;
  source: string;
  type: "Directa" | "Contextualizada";
  status: "Integrado" | "Pendiente" | "Rechazado";
  lifecycleStatus?: GeointSweepLifecycleStatus;
  lifecycleVersion?: number;
  lifecycle?: GeointSweepLifecycleRecord;
  analysisStatus?: GeointSweepAnalysisStatus;
  aiQualityScore?: number | null;
  humanValidationStatus?: "UNREVIEWED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "RETURNED_FOR_REANALYSIS" | "LEGACY_UNCLASSIFIED";
  validationSource?: "ADR_020_24_HUMAN_ACTION" | null;
  validatedAt?: string | null;
  validatedBy?: any | null;
  traceabilityId?: string | null;
  correlationId?: string | null;
  outputEvidenceIds?: string[];
  outputFindingIds?: string[];
  lineage?: CanonicalLineageNode[];
  lineageStatus?: LineageStatus;
  geographyId?: string | null;
  geographyType?: CanonicalGeographyType | null;
  relevance: "Alto" | "Medio" | "Bajo";
  data: string;
  context?: string;
  justification?: string;
  timestamp: number;
};

export type Project = {
  id: string;
  nombre: string;
  geometryType: "individual" | "lineal" | "poligono";
  descripcion?: string;
  createdBy?: string;
  printedAt?: number;
  linkedGeoReportId?: string | null;
  linkedGangReport?: any | null;
  ceipolId?: string;
  estado?: string;
  status?: "ACTIVO" | "ARCHIVADO";
  contextoIncidencia?: string;
  delitosSeleccionados?: string[];
  hipotesis?: string;
  reportSummary?: string;
  sweeps?: SweepIntegrationItem[];
  canonicalGeography?: CanonicalProjectGeography | null;
  geographyId?: string | null;
  geographyValidationStatus?: "VALID" | "PARTIAL" | "INVALID";
  canonicalHypothesis?: CanonicalProjectHypothesis | null;
  hypothesisRequirementSatisfied?: boolean;
  reportReadyAssessment?: ReportReadyAssessment | null;
  latitude?: number;
  longitude?: number;
  analysisRadius?: number;
};

export type PerPhotoFinding = {
  photoId: string;
  visionLabels?: string[];
  lugaresCercanos?: unknown[];
};

export type AnalysisResult = {
  perPhotoFindings?: PerPhotoFinding[];
  unifiedProfile?: string;
  heatmapData?: Array<{ lat: number; lng: number; weight?: number }>;
  historicalCrimes?: Array<{
    lat: number;
    lng: number;
    tipoDelito: string;
    rangoHorario: string | null;
  }>;
  pois?: Array<{ lat: number; lng: number; name: string; category?: string }>;
  inegiDemographics?: {
    exito: boolean;
    municipioNombre: string;
    poblacionTotal: string;
    datosExtra: string;
  };
  scinceDemographics?: any;
  tacticalStreetViews?: any[];
  riskLevel?: string;
  mlFeatures?: any;
  raw?: unknown;
};

export type ProjectDocument = {
  id: string;
  name: string;
  url: string;
  type: string;
  context: string;
  createdAt: number;
  multimodalEvidence?: MultimodalEvidenceContract;
};

type ProjectContextValue = {
  project: Project | null;
  album: AlbumPhoto[];
  selectedIds: string[];
  analysisResult: AnalysisResult | null;
  createProject: (params: {
    nombre: string;
    geometryType: "individual" | "lineal" | "poligono";
    descripcion?: string;
    canonicalGeography?: CanonicalProjectGeography | null;
    draftGeography?: DraftProjectGeography | null;
  }) => Promise<string>;

  closeProject: () => void;
  loadProject: (projectId: string) => Promise<void>;
  addPhotoToAlbum: (photo: Omit<AlbumPhoto, "id">, id?: string) => void;
  uploadAndAddPhoto: (
    file: File,
    lat: number,
    lng: number,
    metadata?: {
      gpsAccuracy?: number | null;
      gpsTimestamp?: number | null;
      gpsSource?: string;
      exifLat?: number | null;
      exifLng?: number | null;
      gpsLat?: number | null;
      gpsLng?: number | null;
      diagnosticLogs?: string;
      validado?: boolean;
      tipo?: string;
      comentario?: string;
      isIndependentPoi?: boolean;
    }
  ) => Promise<void>;
  createGeographicEntity?: (params: {
    lat: number;
    lng: number;
    type: "POI" | "VERTEX" | "EVIDENCE_LOCATION";
    name?: string;
    comentario?: string;
    isIndependentPoi?: boolean;
    isVertex?: boolean;
  }) => Promise<string>;
  removePhotoFromAlbum: (id: string) => Promise<void>;
  removeAllPhotosFromAlbum: (projectId: string) => Promise<void>;
  updatePhotoMeta: (id: string, meta: { tipo: string; comentario: string }) => void;
  updatePhotoCoordinates: (id: string, lat: number, lng: number) => Promise<void>;
  updatePhotoRelationship: (id: string, relationship: EvidenceRelationship) => Promise<void>;
  togglePhotoSelection: (id: string) => void;
  selectAllPhotos: () => void;
  clearSelection: () => void;
  setAnalysisResult: (result: AnalysisResult | null) => void;
  exportProjectData: (projectId: string) => Promise<void>;
  importProjectData: (file: File, username: string) => Promise<void>;
  documents: ProjectDocument[];
  uploadDocument: (file: File, context: string) => Promise<void>;
  saveCustomDocument: (name: string, type: string, context: string, url?: string) => Promise<string>;
  removeDocument: (id: string) => Promise<void>;
  markAsPrinted: () => Promise<void>;
  datosGobMxResult: DatosGobMxResult | null;
  setDatosGobMxResult: (result: DatosGobMxResult | null) => void;
  isReadOnly: boolean;
  renameProject: (projectId: string, newName: string) => Promise<void>;
  softDeleteDoc: (params: {
    type: "Proyecto" | "Fotografía" | "Documento";
    id: string;
    projectId?: string;
    reason: string;
  }) => Promise<void>;
  restoreDoc: (trashId: string) => Promise<void>;
  archiveProject: (projectId: string, reason: string) => Promise<void>;
  reactivateProject: (projectId: string, reason: string) => Promise<void>;
  savePhotoContextualization: (photoId: string) => Promise<string>;
  logAuditAction: (params: {
    action: string;
    module: string;
    projectId?: string;
    projectName?: string;
    result?: "ÉXITO" | "FALLO" | "BLOQUEADO";
    details: string;
  }) => Promise<void>;
  updateProjectDetails: (details: Partial<Project>) => Promise<void>;
  saveHumanHypothesis: (text: string) => Promise<CanonicalProjectHypothesis>;
  requestInstitutionalReportCertification: (params: {
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
  }) => Promise<InstitutionalReportCertification>;
  certifyInstitutionalReportByHumanAction: (params: {
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
  }) => Promise<InstitutionalReportCertification>;
  rejectInstitutionalReportCertification: (params: {
    certification: InstitutionalReportCertification;
    rejectionReason: string;
  }) => Promise<InstitutionalReportCertification>;
  revokeInstitutionalReportCertification: (params: {
    certificationId: string;
    revocationReason: string;
  }) => Promise<InstitutionalReportCertification>;
  getCurrentInstitutionalReportCertification: (params: {
    institutionalReportInput?: InstitutionalReportInput | null;
    institutionalDocumentModel?: InstitutionalDocumentModel | null;
    documentArtifactReference?: string | null;
  }) => Promise<InstitutionalReportCertification | null>;
  requestInstitutionalReportPublication: (params: {
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    publicationChannelOrType: string;
  }) => Promise<InstitutionalReportPublication>;
  publishInstitutionalReportByHumanAction: (params: {
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    publicationChannelOrType: string;
  }) => Promise<InstitutionalReportPublication>;
  revokeInstitutionalReportPublication: (params: {
    publicationId: string;
    revocationReason: string;
  }) => Promise<InstitutionalReportPublication>;
  getCurrentInstitutionalReportPublication: (params: {
    certification?: InstitutionalReportCertification | null;
    documentArtifactReference?: string | null;
    documentArtifactHash?: string | null;
  }) => Promise<InstitutionalReportPublication | null>;
  activeSweepForModal: SweepIntegrationItem | null;
  setActiveSweepForModal: (sweep: SweepIntegrationItem | null) => void;
  registerSweep: (params: Omit<SweepIntegrationItem, "id" | "status" | "timestamp"> & { initialContext?: string }) => Promise<string>;
  updateSweep: (sweepId: string, updates: Partial<SweepIntegrationItem>) => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  initialQuality: 0.7,
  alwaysKeepResolution: true,
  preserveExif: true,
} as const;

async function getClientIp(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    return data.ip || "127.0.0.1";
  } catch (e) {
    return "127.0.0.1";
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildRealValidatorIdentity(user: any): any | null {
  if (!user) return null;
  const identity: Record<string, unknown> = {};
  if (user.id != null && String(user.id).trim()) identity.id = user.id;
  if (typeof user.username === "string" && user.username.trim()) identity.username = user.username.trim();
  if (typeof user.name === "string" && user.name.trim()) identity.name = user.name.trim();
  if (typeof user.role === "string" && user.role.trim()) identity.role = user.role.trim();
  return Object.keys(identity).length > 0 ? identity : null;
}

function buildGeointSweepEventActor(user: any): string {
  const identity = buildRealValidatorIdentity(user);
  return identity?.username || identity?.name || (identity?.id != null ? String(identity.id) : "UNAVAILABLE");
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [activeSweepForModal, setActiveSweepForModal] = useState<SweepIntegrationItem | null>(null);
  const [album, setAlbum] = useState<AlbumPhoto[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [analysisResult, setAnalysisResultState] = useState<AnalysisResult | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [datosGobMxResult, setDatosGobMxResult] = useState<DatosGobMxResult | null>(null);

  const logAuditAction = useCallback(async (params: {
    action: string;
    module: string;
    projectId?: string;
    projectName?: string;
    result?: "ÉXITO" | "FALLO" | "BLOQUEADO";
    details: string;
  }) => {
    try {
      const firestore = getDb();
      const ip = await getClientIp();
      const now = new Date();
      const dateStr = now.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeStr = now.toLocaleTimeString("es-MX", { hour12: false });
      
      const auditCol = collection(firestore, "audit_logs");
      await addDoc(auditCol, {
        user: user?.username || "Usuario Local",
        userName: user?.name || "Usuario Local",
        userRole: user?.role || "USER",
        action: params.action,
        module: params.module,
        projectId: params.projectId || "",
        projectName: params.projectName || "",
        ip,
        timestamp: Date.now(),
        date: dateStr,
        time: timeStr,
        result: params.result || "ÉXITO",
        details: params.details
      });
    } catch (err) {
      console.error("Error writing audit log:", err);
    }
  }, [user]);

  const createProject = useCallback(async ({
    nombre,
    geometryType,
    descripcion,
    canonicalGeography,
    draftGeography,
  }: {
    nombre: string;
    geometryType: "individual" | "lineal" | "poligono";
    descripcion?: string;
    canonicalGeography?: CanonicalProjectGeography | null;
    draftGeography?: DraftProjectGeography | null;
  }) => {
    try {
      const firestore = getDb();
      const counterRef = doc(firestore, "counters", "projects");
      const projectCol = collection(firestore, "projects");
      const projectDocRef = doc(projectCol);
      if (canonicalGeography && canonicalGeography.validationStatus !== "VALID") {
        throw new Error("La geografía canónica del expediente está incompleta o es inválida.");
      }
      if (!canonicalGeography && !draftGeography?.confirmed) {
        throw new Error("Debe definir, validar y confirmar la geografía antes de crear el expediente.");
      }

      let ceipolId = "";
      const confirmedCanonicalGeography = canonicalGeography || canonicalizeConfirmedDraftGeography({
        projectId: projectDocRef.id,
        draft: draftGeography!,
      });
      const geographyPersistence = confirmedCanonicalGeography
        ? {
            canonicalGeography: confirmedCanonicalGeography,
            geographyId: confirmedCanonicalGeography.geographyId,
            geographyValidationStatus: confirmedCanonicalGeography.validationStatus,
          }
        : {
            canonicalGeography: null,
            geographyId: null,
            geographyValidationStatus: "INVALID" as const,
          };
      
      await runTransaction(firestore, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let currentCount = 0;
        if (counterSnap.exists()) {
          currentCount = counterSnap.data().count || 0;
        }
        const nextCount = currentCount + 1;
        
        const now = new Date();
        const day = now.getDate().toString().padStart(2, "0");
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const year = now.getFullYear();
        ceipolId = `CEIPOL/${nextCount.toString().padStart(6, "0")}/${day}/${month}/${year}`;

        transaction.set(counterRef, { count: nextCount });

        transaction.set(projectDocRef, {
          ceipolId,
          name: nombre.trim() || "Sin nombre",
          geometryType,
          descripcion: descripcion || "",
          createdAt: Date.now(),
          createdBy: user?.username || "Usuario Local",
          lockedBy: null,
          photoCount: 0,
          estado: "ABIERTO",
          canonicalHypothesis: null,
          hypothesisRequirementSatisfied: false,
          ...geographyPersistence,
        });
      });

      const newProjectState = {
        id: projectDocRef.id,
        nombre: nombre.trim() || "Sin nombre",
        geometryType,
        descripcion: descripcion || "",
        createdBy: user?.username || "Usuario Local",
        ceipolId,
        estado: "ABIERTO",
        canonicalHypothesis: null,
        hypothesisRequirementSatisfied: false,
        ...geographyPersistence,
      };
      setProject({
        ...newProjectState,
        reportReadyAssessment: assessReportReadiness(newProjectState),
      });

      setAlbum([]);
      setSelectedIds([]);
      setAnalysisResultState(null);
      setDocuments([]);
      setIsReadOnly(false);

      await logAuditAction({
        action: "CREAR",
        module: "Expedientes",
        projectId: projectDocRef.id,
        projectName: ceipolId,
        details: `Creado expediente oficial con folio ${ceipolId} y nombre descriptivo "${nombre}".`
      });
      return projectDocRef.id;
    } catch (err: any) {
      console.error("Error creando proyecto:", err);
      alert("Error al crear expediente: " + err.message);
      throw err;
    }
  }, [user, logAuditAction]);

  const closeProject = useCallback(() => {
    setProject(null);
    setAlbum([]);
    setSelectedIds([]);
    setAnalysisResultState(null);
    setDocuments([]);
    setIsReadOnly(false);
  }, []);

  const markAsPrinted = useCallback(async () => {
    if (!project || isReadOnly) return;
    try {
      const firestore = getDb();
      const projectRef = doc(firestore, "projects", project.id);
      const snap = await getDoc(projectRef);
      if (snap.exists() && !snap.data().printedAt) {
        const printedAt = Date.now();
        await updateDoc(projectRef, { printedAt });
        setProject((prev) => (prev ? { ...prev, printedAt } : prev));
      }
    } catch (err) {
      console.error("[ProjectContext] Error al marcar como impreso:", err);
    }
  }, [project, isReadOnly]);

  const loadProject = useCallback(async (projectId: string) => {
    try {
      const firestore = getDb();
      const projectRef = doc(firestore, "projects", projectId);
      const projectSnap = await getDoc(projectRef);

      if (!projectSnap.exists()) {
        console.error("El proyecto no existe en Firestore.");
        throw new Error("El proyecto no existe en la base de datos.");
      }
      const projectData = projectSnap.data();
      const creator = projectData.createdBy;

      // REGLAS DE ACCESO DE ROLES Y TEMPORALIDAD (FASE 3)
      if (user?.role === "USER" && creator !== user?.username) {
        throw new Error("Acceso denegado: El expediente pertenece a otro analista y su rol no permite visualización de terceros.");
      }

      let canModify = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" || creator === user?.username;
      let isLockedByTime = false;

      // Lógica de 24 horas: Inmutabilidad para analistas operativos tras su impresión
      if (projectData.printedAt && user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
        const hoursSincePrint = (Date.now() - projectData.printedAt) / (1000 * 60 * 60);
        if (hoursSincePrint > 24 && projectData.estado !== "DEVUELTO") {
          canModify = false;
          isLockedByTime = true;
        }
      }

      setIsReadOnly(!canModify);
      
      if (isLockedByTime) {
        setTimeout(() => alert("Este expediente fue impreso hace más de 24 horas y ahora es de solo lectura. Solo un Administrador puede reabrirlo/modificarlo."), 500);
      }

      const photosColRef = collection(firestore, "projects", projectId, "photos");
      const photosQuery = query(photosColRef, orderBy("createdAt", "asc"));
      const photosSnap = await getDocs(photosQuery);

      const albumPhotos: AlbumPhoto[] = photosSnap.docs
        .map((photoDoc) => {
          const data = photoDoc.data();
          let rawUrl = data.url || "";
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

          // NORMALIZAR OPENSTREETMAP ALEMANIA EN CALIENTE PARA LA VISTA CLIENTE
          if (rawUrl.includes("staticmap.openstreetmap.de")) {
            // console.warn("[ProjectContext] Detectado previewUrl de OpenStreetMap Alemania caído en Firestore. Normalizando en caliente para la vista cliente...");
            const match = rawUrl.match(/center=([^&]+)/);
            if (match && match[1]) {
              const [lat, lng] = match[1].split(",");
              if (apiKey) {
                rawUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x400&maptype=roadmap&key=${apiKey}`;
              } else {
                rawUrl = `https://basemaps.cartocdn.com/rastertiles/voyager_labels_under/16/${lng}/${lat}/600x400.png`;
              }
            } else if (data.lat && data.lng) {
              if (apiKey) {
                rawUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${data.lat},${data.lng}&zoom=16&size=600x400&maptype=roadmap&key=${apiKey}`;
              } else {
                rawUrl = `https://basemaps.cartocdn.com/rastertiles/voyager_labels_under/16/${data.lng}/${data.lat}/600x400.png`;
              }
            }
          }

          // NORMALIZAR YANDEX MAPS EN CALIENTE PARA LA VISTA CLIENTE
          if (rawUrl.includes("api-maps.yandex.ru")) {
            // console.warn("[ProjectContext] Detectado previewUrl de Yandex Maps caído en Firestore. Normalizando en caliente para la vista cliente...");
            const match = rawUrl.match(/ll=([^&]+)/);
            if (match && match[1]) {
              const [lng, lat] = match[1].split(",");
              if (apiKey) {
                rawUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x400&maptype=roadmap&key=${apiKey}`;
              } else {
                rawUrl = `https://basemaps.cartocdn.com/rastertiles/voyager_labels_under/16/${lng}/${lat}/600x400.png`;
              }
            } else if (data.lat && data.lng) {
              if (apiKey) {
                rawUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${data.lat},${data.lng}&zoom=16&size=600x400&maptype=roadmap&key=${apiKey}`;
              } else {
                rawUrl = `https://basemaps.cartocdn.com/rastertiles/voyager_labels_under/16/${data.lng}/${data.lat}/600x400.png`;
              }
            }
          }

          return {
            id: photoDoc.id,
            previewUrl: rawUrl,
            lat: data.lat ?? data.gpsLat ?? null,
            lng: data.lng ?? data.gpsLng ?? null,
            tipo: data.tipo,
            comentario: data.comentario,
            deleted: data.deleted === true,
            evidenceId: data.evidenceId || null,
            sourceEvidenceId: data.sourceEvidenceId || null,
            contextualizedAt: data.contextualizedAt || null,
            contextualizedBy: data.contextualizedBy || null,
            isContextualized: data.isContextualized || false,
            evidenceRelationship: data.evidenceRelationship || null,
            evidenceType: data.evidenceType || "ANALYST_PHOTO",
            streetViewCategory: data.streetViewCategory || null,
            streetViewSource: data.streetViewSource || null,
            analysisType: data.analysisType || null,
            fuente: data.fuente || "Inspección de Campo",
            validado: data.validado === true,
            humanValidationStatus: data.humanValidationStatus || null,
            validationSource: data.validationSource || null,
            lineage: data.lineage || null,
            lineageStatus: data.lineageStatus || null,
            gpsLat: data.gpsLat ?? null,
            gpsLng: data.gpsLng ?? null,
            gpsAccuracy: data.gpsAccuracy ?? null,
            gpsTimestamp: data.gpsTimestamp ?? null,
            diagnosticLogs: data.diagnosticLogs ?? null,
            geographyId: data.geographyId ?? null,
            geographyType: data.geographyType ?? null,
          };
        })
        .filter((p) => !p.deleted) as any;

      let geoEntities: any[] = [];
      try {
        geoEntities = await getGeographicEntities(projectId);
        const geoAlbumItems: AlbumPhoto[] = geoEntities.map((geo) => ({
          id: geo.id!,
          previewUrl: "",
          lat: geo.lat,
          lng: geo.lng,
          tipo: geo.metadata?.tipo || (geo.metadata?.isIndependentPoi ? "POI" : "Punto Geográfico"),
          comentario: geo.metadata?.comentario || geo.metadata?.name || "Punto Geográfico",
          evidenceType: "GEOGRAPHIC_VECTOR",
          isIndependentPoi: geo.metadata?.isIndependentPoi ?? true,
          fuente: "Mapa Táctico GEOINT",
          validado: true,
          createdAt: geo.createdAt || Date.now(),
          geographyId: projectData.geographyId ?? projectData.canonicalGeography?.geographyId ?? null,
          geographyType: projectData.canonicalGeography?.type ?? null,
        } as any));
        albumPhotos.push(...geoAlbumItems);
      } catch (geoErr) {
        console.warn("[ProjectContext] No se pudieron cargar entidades geográficas:", geoErr);
      }

      const canonicalGeography = adaptLegacyProjectGeography(
        {
          id: projectId,
          geometryType: projectData.geometryType,
          latitude: projectData.latitude ?? null,
          longitude: projectData.longitude ?? null,
          canonicalGeography: projectData.canonicalGeography ?? null,
        },
        { geographicEntities: geoEntities }
      );
      const canonicalHypothesis = adaptLegacyProjectHypothesis({
        ...projectData,
        id: projectId,
        geographyId: canonicalGeography?.geographyId ?? projectData.geographyId ?? null,
        canonicalGeography,
      });
      const hypothesisGate = canProceedWithInstitutionalAnalysis({ canonicalHypothesis });
      const docsColRef = collection(firestore, "projects", projectId, "documents");
      const docsSnap = await getDocs(query(docsColRef, orderBy("createdAt", "asc")));
      const projectDocs: ProjectDocument[] = docsSnap.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as any))
        .filter((d: any) => !d.deleted);

      const loadedProject = {
        id: projectId,
        nombre: projectData.name,
        geometryType: projectData.geometryType,
        descripcion: projectData.descripcion || "",
        ...projectData,
        canonicalGeography,
        geographyId: canonicalGeography?.geographyId ?? projectData.geographyId ?? null,
        geographyValidationStatus: canonicalGeography?.validationStatus ?? projectData.geographyValidationStatus ?? "INVALID",
        canonicalHypothesis,
        hypothesisRequirementSatisfied: hypothesisGate.hypothesisRequirementSatisfied,
      };
      setProject({
        ...loadedProject,
        reportReadyAssessment: assessReportReadiness({
          ...loadedProject,
          album: albumPhotos,
          documents: projectDocs,
        }),
      });
      setAlbum(albumPhotos);
      setSelectedIds(albumPhotos.map((p) => p.id));
      setDocuments(projectDocs);

      if (projectData.iaAnalysis) {
        setAnalysisResultState(projectData.iaAnalysis);
      } else {
        setAnalysisResultState(null);
      }
    } catch (err: any) {
      console.error("Error cargando proyecto:", err);
      alert("Error al abrir expediente: " + err.message);
      setProject(null);
      setAlbum([]);
    }
  }, [user]);

  const addPhotoToAlbum = useCallback(
    (photo: Omit<AlbumPhoto, "id">, id?: string) => {
      if (
        photo.lat == null ||
        photo.lng == null ||
        Number.isNaN(photo.lat) ||
        Number.isNaN(photo.lng)
      ) {
        console.warn(
          "[ProjectContext] Intento de agregar foto sin coordenadas; se descarta."
        );
        return;
      }
      setAlbum((prev) => [...prev, { ...photo, id: id ?? generateId() }]);
    },
    []
  );

  const uploadAndAddPhoto = useCallback(async (
    file: File,
    lat: number,
    lng: number,
    metadata?: {
      gpsAccuracy?: number | null;
      gpsTimestamp?: number | null;
      gpsSource?: string;
      exifLat?: number | null;
      exifLng?: number | null;
      gpsLat?: number | null;
      gpsLng?: number | null;
      diagnosticLogs?: string;
      validado?: boolean;
      tipo?: string;
      comentario?: string;
      isIndependentPoi?: boolean;
    }
  ) => {
    if (isReadOnly) throw new Error("Expediente en modo lectura (Auditoría).");
    if (!project) throw new Error("No hay un proyecto activo para subir la foto.");

    // 1. Comprimir imagen
    const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);

    // 2. Subir a Firebase Storage
    const storage = getStorage();
    const photoId = generateId();
    const storageRef = ref(storage, `projects/${project.id}/${photoId}.jpg`);
    const snapshot = await uploadBytes(storageRef, compressedFile);
    const downloadURL = await getDownloadURL(snapshot.ref);

    let defaultTipo = metadata?.tipo || "Nodo Principal";
    if (!metadata?.tipo) {
      if (project.geometryType === "lineal") defaultTipo = "Corredor";
      else if (project.geometryType === "poligono") defaultTipo = "Interior";
    }

    let photoDocId = photoId;

    const isStreetView = defaultTipo === "STREET_VIEW" || 
                         defaultTipo === "REMOTE_STREET_VIEW" || 
                         metadata?.gpsSource === "STREET_VIEW" || 
                         (metadata as any)?.evidenceType === "VIRTUAL_STREET_VIEW" || 
                         (metadata as any)?.tipo === "REMOTE_STREET_VIEW" || 
                         (metadata as any)?.tipo === "STREET_VIEW";

    const resolvedTipo = (metadata as any)?.tipo || (isStreetView ? "REMOTE_STREET_VIEW" : defaultTipo);

    // 3. Guardar metadatos en Firestore (con fallback local ante cuotas agotadas)
    try {
      const firestore = getDb();
      const photosColRef = collection(firestore, "projects", project.id, "photos");
      const photoDocData = {
        url: downloadURL,
        storagePath: snapshot.ref.fullPath,
        lat,
        lng,
        projectId: project.id,
        createdAt: Date.now(),
        tipo: resolvedTipo,
        fuente: isStreetView ? "Google Street View" : ((metadata as any)?.fuente || "Inspección de Campo"),
        evidenceType: isStreetView ? "VIRTUAL_STREET_VIEW" : ((metadata as any)?.evidenceType || "ANALYST_PHOTO"),
        comentario: metadata?.comentario || "",
        isIndependentPoi: metadata?.isIndependentPoi || false,
        gpsAccuracy: metadata?.gpsAccuracy ?? null,
        gpsTimestamp: metadata?.gpsTimestamp ?? null,
        gpsSource: metadata?.gpsSource ?? "SOLO_EXIF",
        exifLat: metadata?.exifLat ?? null,
        exifLng: metadata?.exifLng ?? null,
        gpsLat: metadata?.gpsLat ?? null,
        gpsLng: metadata?.gpsLng ?? null,
        diagnosticLogs: metadata?.diagnosticLogs ?? "Carga estándar",
        validado: metadata?.validado ?? false,
        geographyId: project.canonicalGeography?.geographyId ?? null,
        geographyType: project.canonicalGeography?.type ?? null,
        humanValidationStatus: (metadata as any)?.humanValidationStatus || (isStreetView ? "PENDING_REVIEW" : "UNREVIEWED"),
        validationSource: (metadata as any)?.validationSource || (isStreetView ? "CANONICAL_FIELD" : "ABSENT"),
        streetViewCategory: (metadata as any)?.streetViewCategory || null,
        streetViewSource: (metadata as any)?.streetViewSource || (isStreetView ? "Google Street View" : null),
        analysisType: (metadata as any)?.analysisType || (isStreetView ? "STREET_VIEW" : null),

        // Regla gobernada por contrato determinista (EGE Contract Rules)
        ...(isStreetView || resolvedTipo === "REMOTE_STREET_VIEW" ? {
          category: "STREET_VIEW",
          classification: "REMOTE_VISUAL",
          sourceProvider: "GOOGLE_STREET_VIEW",
          isStreetView: true
        } : {})
      };
      const photoDocRef = await addDoc(photosColRef, photoDocData);
      photoDocId = photoDocRef.id;

      // 4. Actualizar contador en el proyecto padre
      const projectDocRef = doc(firestore, "projects", project.id);
      await updateDoc(projectDocRef, {
        photoCount: increment(1)
      });
    } catch (err: any) {
      console.warn("[ProjectContext] Falló la persistencia en Firestore (posible cuota agotada), agregando en memoria local:", err);
    }

    // 5. Actualizar estado local para reflejar en UI
    addPhotoToAlbum({
      previewUrl: downloadURL,
      lat,
      lng,
      tipo: resolvedTipo,
      fuente: isStreetView ? "Google Street View" : ((metadata as any)?.fuente || "Inspección de Campo"),
      evidenceType: isStreetView ? "VIRTUAL_STREET_VIEW" : ((metadata as any)?.evidenceType || "ANALYST_PHOTO"),
      comentario: metadata?.comentario || "",
      isIndependentPoi: metadata?.isIndependentPoi || false,
      file: compressedFile,
      gpsAccuracy: metadata?.gpsAccuracy ?? null,
      gpsTimestamp: metadata?.gpsTimestamp ?? null,
      gpsSource: metadata?.gpsSource ?? "SOLO_EXIF",
      exifLat: metadata?.exifLat ?? null,
      exifLng: metadata?.exifLng ?? null,
      gpsLat: metadata?.gpsLat ?? null,
      gpsLng: metadata?.gpsLng ?? null,
      diagnosticLogs: metadata?.diagnosticLogs ?? "Carga estándar",
      validado: metadata?.validado ?? false,
      geographyId: project.canonicalGeography?.geographyId ?? null,
      geographyType: project.canonicalGeography?.type ?? null,
      streetViewCategory: (metadata as any)?.streetViewCategory || null,
      streetViewSource: (metadata as any)?.streetViewSource || (isStreetView ? "Google Street View" : null),
      analysisType: (metadata as any)?.analysisType || (isStreetView ? "STREET_VIEW" : null),

      // Regla gobernada por contrato determinista (EGE Contract Rules)
      ...(isStreetView || resolvedTipo === "REMOTE_STREET_VIEW" ? {
        category: "STREET_VIEW",
        classification: "REMOTE_VISUAL",
        sourceProvider: "GOOGLE_STREET_VIEW",
        isStreetView: true
      } : {})
    } as any, photoDocId);

    // Auto-seleccionar la foto en la lista activa para asegurar su exportación
    setSelectedIds((prev) => {
      if (prev.includes(photoDocId)) return prev;
      return [...prev, photoDocId];
    });

  }, [project, addPhotoToAlbum, isReadOnly, setSelectedIds]);

  const createGeographicEntity = useCallback(
    async (params: {
      lat: number;
      lng: number;
      type: "POI" | "VERTEX" | "EVIDENCE_LOCATION";
      name?: string;
      comentario?: string;
      isIndependentPoi?: boolean;
      isVertex?: boolean;
    }) => {
      if (isReadOnly) throw new Error("Expediente en modo lectura (Auditoría).");
      if (!project) throw new Error("No hay un proyecto activo para crear el punto geográfico.");

      const entityId = `geo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const comment = params.comentario || params.name || (params.isIndependentPoi ? "POI creado desde mapa." : "Vértice de trazado.");
      const resolvedTipo = params.isIndependentPoi ? "POI" : (project.geometryType === "lineal" ? "Corredor" : "Polígono");

      await saveGeographicEntity({
        id: entityId,
        projectId: project.id,
        lat: params.lat,
        lng: params.lng,
        type: params.type,
        geometryType: project.geometryType || "individual",
        source: "MAP_VECTOR",
        createdAt: Date.now(),
        metadata: {
          name: params.name || "",
          comentario: comment,
          isIndependentPoi: params.isIndependentPoi ?? true,
          isVertex: params.isVertex ?? false,
          tipo: resolvedTipo,
        },
      });

      addPhotoToAlbum(
        {
          previewUrl: "",
          lat: params.lat,
          lng: params.lng,
          tipo: resolvedTipo,
          fuente: "Mapa Táctico GEOINT",
          evidenceType: "GEOGRAPHIC_VECTOR",
          comentario: comment,
          isIndependentPoi: params.isIndependentPoi ?? true,
          gpsSource: params.isIndependentPoi ? "POI_MAPA" : "VERTICE_MAPA",
          validado: true,
          createdAt: Date.now(),
          geographyId: project.canonicalGeography?.geographyId ?? null,
          geographyType: project.canonicalGeography?.type ?? null,
        } as any,
        entityId
      );

      return entityId;
    },
    [isReadOnly, project, addPhotoToAlbum]
  );

  const uploadDocument = useCallback(async (file: File, context: string) => {
    if (isReadOnly) throw new Error("Expediente en modo lectura (Auditoría).");
    if (!project) throw new Error("No hay un proyecto activo para subir el anexo.");
    const storage = getStorage();
    const docId = generateId();
    let forensicIntegrity;
    try {
      const rawBytes = await file.arrayBuffer();
      forensicIntegrity = await createComputedFileIntegrityFromBytes({
        bytes: rawBytes,
        declaredMimeType: file.type || null,
        fileName: file.name,
      });
    } catch (err) {
      console.warn("[ProjectContext] No se pudo calcular SHA-256 real del archivo local.", err);
      forensicIntegrity = createHashUnavailableIntegrity({
        declaredMimeType: file.type || null,
        fileName: file.name,
      });
    }
    const storageRef = ref(storage, `projects/${project.id}/documents/${docId}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    const firestore = getDb();
    const docsColRef = collection(firestore, "projects", project.id, "documents");
    const storagePath = snapshot.ref.fullPath;
    const docData = {
      name: file.name,
      url: downloadURL,
      type: file.type || "unknown",
      context,
      createdAt: Date.now(),
      multimodalEvidence: createStoredRawMultimodalEvidence({
        evidenceId: docId,
        expedienteId: project.id,
        documentId: docId,
        fileName: file.name,
        mimeType: file.type || "unknown",
        size: file.size,
        storageReference: storagePath,
        ingestionSource: "USER_UPLOAD",
        geographyId: project.canonicalGeography?.geographyId ?? null,
        geographyType: project.canonicalGeography?.type ?? null,
        traceabilityId: null,
        analystContext: context,
        forensicIntegrity,
      })
    };
    const docRef = await addDoc(docsColRef, docData);
    setDocuments(prev => [...prev, { id: docRef.id, ...docData }]);
  }, [project, isReadOnly]);

  const saveCustomDocument = useCallback(async (name: string, type: string, context: string, url = "") => {
    if (isReadOnly) throw new Error("Expediente en modo lectura (Auditoría).");
    if (!project) throw new Error("No hay un proyecto activo para guardar el anexo.");
    const firestore = getDb();
    const docsColRef = collection(firestore, "projects", project.id, "documents");
    const docData = {
      name,
      url,
      type,
      context,
      createdAt: Date.now()
    };
    const docRef = await addDoc(docsColRef, docData);
    setDocuments(prev => [...prev, { id: docRef.id, ...docData }]);
    return docRef.id;
  }, [project, isReadOnly]);

  const removeDocument = useCallback(async (id: string) => {
    if (isReadOnly) throw new Error("Expediente en modo lectura.");
    if (!project) return;
    const firestore = getDb();
    await deleteDoc(doc(firestore, "projects", project.id, "documents", id));
    setDocuments(prev => prev.filter(d => d.id !== id));
  }, [project, isReadOnly]);

  const removePhotoFromAlbum = useCallback(async (id: string) => {
    if (isReadOnly) throw new Error("Expediente en modo lectura.");
    try {
      if (!project) return;
      const firestore = getDb();
      const photoToId = album.find((p) => p.id === id);
      if (!photoToId) return;

      // Invocar el ImageDeletionGovernanceService para procesar la lógica transversal
      const { updatedAlbum, auditLog } = ImageDeletionGovernanceService.deleteImage(
        photoToId,
        project.id,
        user?.username || "Usuario Local",
        album,
        project.geometryType || "polígono"
      );

      // 1. Eliminar referencia de Firestore y Storage
      const photoRef = doc(firestore, "projects", project.id, "photos", id);
      await deleteDoc(photoRef);

      // Decrementar contador
      const projectRef = doc(firestore, "projects", project.id);
      await updateDoc(projectRef, { photoCount: increment(-1) });

      // Guardar la bitácora de trazabilidad única en Firestore en una colección dedicada
      const deletionCol = collection(firestore, "image_deletion_logs");
      await addDoc(deletionCol, auditLog);

      // Registrar acción en la bitácora general de auditoría
      await logAuditAction({
        action: "IMAGE_DELETED",
        module: "PHOTO_ALBUM",
        projectId: project.id,
        projectName: project.ceipolId || project.nombre,
        result: "ÉXITO",
        details: `Imagen ${id} (${auditLog.source}) eliminada definitivamente del expediente por solicitud del usuario.`
      });

      // Actualizar estado reactivo
      setAlbum(updatedAlbum);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      console.error("[ProjectContext] Error al eliminar foto:", err);
    }
  }, [project, isReadOnly, album, user, logAuditAction]);

  const removeAllPhotosFromAlbum = useCallback(async (projectId: string) => {
    if (isReadOnly) throw new Error("Expediente en modo lectura.");
    // This needs to be re-implemented to delete all photos from the subcollection in Firestore and Storage.
    // It's a more complex operation (batch delete). For now, I'll just clear the local state.
    console.warn("removeAllPhotosFromAlbum no está completamente implementado para Firebase.");
    setAlbum([]);
    setSelectedIds([]);
  }, [isReadOnly]);

  const updatePhotoMeta = useCallback((id: string, meta: { tipo: string; comentario: string }) => {
    if (isReadOnly) return;
    setAlbum((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...meta } : p))
    );
  }, [isReadOnly]);

  const updatePhotoRelationship = useCallback(async (id: string, relationship: EvidenceRelationship) => {
    if (isReadOnly) return;
    if (!project) return;
    try {
      const firestore = getDb();
      const photoRef = doc(firestore, "projects", project.id, "photos", id);
      await updateDoc(photoRef, {
        evidenceRelationship: relationship
      });

      setAlbum((prev) =>
        prev.map((p) => (p.id === id ? { ...p, evidenceRelationship: relationship } : p))
      );
    } catch (err) {
      console.error("[ProjectContext] Error updating photo relationship:", err);
    }
  }, [isReadOnly, project]);

  const updatePhotoCoordinates = useCallback(async (id: string, lat: number, lng: number) => {
    if (isReadOnly) return;
    if (!project) return;
    try {
      const firestore = getDb();
      // Find the current photo to check if it's a map construct
      const currentPhoto = album.find((p) => p.id === id);
      const isMapUrl = currentPhoto && (
        currentPhoto.previewUrl?.includes("api-maps.yandex.ru") ||
        currentPhoto.previewUrl?.includes("openstreetmap.de") ||
        currentPhoto.gpsSource === "POI_MAPA" ||
        currentPhoto.gpsSource === "VERTICE_MAPA" ||
        currentPhoto.tipo?.startsWith("Barrido")
      );

      const updateData: any = { lat, lng };
      let newMapUrl = "";
      if (isMapUrl) {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
        if (apiKey) {
          console.log("[ProjectContext] Actualizando mapa dinámico con Google Maps Static API (Habilitada por Analista)...");
          newMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x400&maptype=roadmap&key=${apiKey}`;
        } else {
          console.warn("[ProjectContext] API Key de Google no detectada. Usando fallback estable de CartoDB (Voyager)...");
          newMapUrl = `https://basemaps.cartocdn.com/rastertiles/voyager_labels_under/16/${lng}/${lat}/600x400.png`;
        }
        updateData.url = newMapUrl;
        updateData.previewUrl = newMapUrl;
      }

      await updateDoc(doc(firestore, "projects", project.id, "photos", id), updateData);
      setAlbum((prev) =>
        prev.map((p) => (p.id === id ? { ...p, lat, lng, ...(newMapUrl ? { previewUrl: newMapUrl } : {}) } : p))
      );
    } catch (err) {
      console.error("[ProjectContext] Error al actualizar coordenadas:", err);
    }
  }, [project, isReadOnly, album]);

  const togglePhotoSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const selectAllPhotos = useCallback(() => {
    setAlbum((prev) => {
      setSelectedIds(prev.map((p) => p.id));
      return prev;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const setAnalysisResult = useCallback((result: AnalysisResult | null) => {
    setAnalysisResultState(result);
  }, []);

  const exportProjectData = useCallback(async (projectId: string) => {
    try {
      const firestore = getDb();
      const projectRef = doc(firestore, "projects", projectId);
      const projectSnap = await getDoc(projectRef);
      if (!projectSnap.exists()) throw new Error("Proyecto no encontrado en la nube.");
      const projectData = projectSnap.data();

      const photosColRef = collection(firestore, "projects", projectId, "photos");
      const photosSnap = await getDocs(query(photosColRef, orderBy("createdAt", "asc")));
      
      const photosData = photosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const payload = {
        version: "2.0-cloud", // New version to differentiate
        project: { id: projectId, ...projectData },
        photos: photosData
      };

      const fileName = `${projectData.name.replace(/\s+/g, '_')}_Gabinete.json`;
      const fileToShare = new File([JSON.stringify(payload, null, 2)], fileName, { type: "application/json" });

      const triggerDownload = () => {
        const url = URL.createObjectURL(fileToShare);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      };

      if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
        try {
          await navigator.share({
            files: [fileToShare],
            title: 'Expediente Táctico Exportado',
            text: `Evidencia de campo: ${projectData.name}`,
          });
          return; // Compartido exitosamente, salimos de la función
        } catch (shareErr: any) {
          console.log("[ProjectContext] Web Share cancelado o fallido:", shareErr);
          // Si el usuario cerró el menú de compartir nativo (AbortError), no forzamos la descarga.
          if (shareErr.name !== "AbortError") {
            triggerDownload();
          }
          return;
        }
      }

      triggerDownload();
    } catch (err) {
      console.error("[ProjectContext] Error exportando:", err);
      alert("Error al exportar el expediente.");
    }
  }, []);

  const importProjectData = useCallback(async (file: File, username: string) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      if (!payload.version?.startsWith("2.0") || !payload.project || !payload.photos) {
        throw new Error("El archivo no es un expediente válido del Perfilador.");
      }

      const proj = payload.project;
      const firestore = getDb();
      const col = collection(firestore, "projects");
      const projectRef = doc(col, proj.id); // Use existing ID

      const snap = await getDoc(projectRef);
      if (snap.exists() && snap.data().createdBy !== user?.username && user?.role !== "SUPER_ADMIN") {
         throw new Error("No puedes sobrescribir un expediente de auditoría que pertenece a otro usuario.");
      }

      // Guardar en la nube (para que aparezca en la lista)
      await setDoc(projectRef, {
        name: proj.name,
        geometryType: proj.geometryType || "individual",
        descripcion: proj.descripcion || "",
        createdAt: proj.createdAt || Date.now(),
        createdBy: username,
        lockedBy: null,
        photoCount: payload.photos.length,
      }, { merge: true });

      // Guardar fotos en la subcolección
      const photosColRef = collection(firestore, "projects", proj.id, "photos");
      const photoPromises = payload.photos.map((p: any) => {
        const photoDocRef = doc(photosColRef, p.id); // Use existing ID
        // Don't include the ID in the data itself
        const { id, ...photoData } = p;
        return setDoc(photoDocRef, photoData, { merge: true });
      });
      await Promise.all(photoPromises);
    } catch (err) {
      throw err;
    }
  }, [user]);

  const renameProject = useCallback(async (projectId: string, newName: string) => {
    if (isReadOnly) throw new Error("Expediente en modo lectura.");
    const firestore = getDb();
    const projectRef = doc(firestore, "projects", projectId);
    const snap = await getDoc(projectRef);
    if (!snap.exists()) throw new Error("El expediente no existe.");

    const data = snap.data();
    const oldName = data.name;

    const isOwner = data.createdBy === user?.username;
    const isAuthorized = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" || isOwner;
    if (!isAuthorized) {
      throw new Error("No tiene permisos para renombrar este expediente.");
    }

    await updateDoc(projectRef, { name: newName.trim() });

    if (project?.id === projectId) {
      setProject((prev) => prev ? { ...prev, nombre: newName.trim() } : prev);
    }

    await logAuditAction({
      action: "RENOMBRAR_EXPEDIENTE",
      module: "Expedientes",
      projectId,
      projectName: data.ceipolId || oldName,
      details: `Cambiado nombre de expediente. Anterior: "${oldName}", Nuevo: "${newName.trim()}".`
    });
  }, [project, isReadOnly, user, logAuditAction]);

  const updateProjectDetails = useCallback(async (details: Partial<Project>) => {
    if (!project || isReadOnly) return;
    try {
      const firestore = getDb();
      const projectRef = doc(firestore, "projects", project.id);
      await updateDoc(projectRef, details);
      setProject((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...details };
        return { ...next, reportReadyAssessment: assessReportReadiness({ ...next, album, documents }) };
      });
      
      await logAuditAction({
        action: "ACTUALIZAR_EXPEDIENTE_DETALLES",
        module: "Expedientes",
        projectId: project.id,
        projectName: project.ceipolId || project.nombre,
        details: `Actualizados detalles del expediente: ${Object.keys(details).join(", ")}.`
      });
    } catch (err) {
      console.error("[ProjectContext] Error al actualizar detalles del expediente:", err);
      throw err;
    }
  }, [project, isReadOnly, logAuditAction, album, documents]);

  const saveHumanHypothesis = useCallback(async (text: string): Promise<CanonicalProjectHypothesis> => {
    if (!project || isReadOnly) throw new Error("No hay expediente activo o es de solo lectura.");
    const trimmedText = text.trim();
    if (!trimmedText) throw new Error("La hipótesis humana no puede estar vacía.");

    const realIdentity = buildRealValidatorIdentity(user);
    const authorId = realIdentity?.username || realIdentity?.name || (realIdentity?.id != null ? String(realIdentity.id) : null);
    const existing = project.canonicalHypothesis || adaptLegacyProjectHypothesis(project);
    const geographyId = project.geographyId ?? project.canonicalGeography?.geographyId ?? existing?.geographyId ?? null;
    const canonicalHypothesis = existing
      ? reviseHumanHypothesis(existing, { text: trimmedText, authorId })
      : formulateHumanHypothesis({
          projectId: project.id,
          text: trimmedText,
          geographyId,
          authorId,
        });
    const hypothesisGate = canProceedWithInstitutionalAnalysis({ canonicalHypothesis });
    const updates = {
      hipotesis: trimmedText,
      canonicalHypothesis,
      hypothesisRequirementSatisfied: hypothesisGate.hypothesisRequirementSatisfied,
    };

    const firestore = getDb();
    const projectRef = doc(firestore, "projects", project.id);
    await updateDoc(projectRef, updates);
    setProject((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      return { ...next, reportReadyAssessment: assessReportReadiness({ ...next, album, documents }) };
    });

    await logAuditAction({
      action: "FORMULAR_HIPOTESIS_HUMANA",
      module: "Expedientes",
      projectId: project.id,
      projectName: project.ceipolId || project.nombre,
      details: `Persistida hipótesis humana versión ${canonicalHypothesis.version}.`
    });

    return canonicalHypothesis;
  }, [project, isReadOnly, user, logAuditAction, album, documents]);

  const requestInstitutionalReportCertification = useCallback(async (params: {
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
  }) => {
    if (!project || isReadOnly) throw new Error("No hay expediente activo o es de solo lectura.");
    const actor = buildRealValidatorIdentity(user);
    const certification = await institutionalReportCertificationService.requestCertification({
      ...params,
      requestedBy: actor,
    });
    await logAuditAction({
      action: "SOLICITAR_CERTIFICACION_REPORTE",
      module: "Reportes",
      projectId: project.id,
      projectName: project.ceipolId || project.nombre,
      details: `Solicitud durable de certificación ${certification.certificationId} para snapshot ${certification.reportSnapshotId}.`,
    });
    return certification;
  }, [project, isReadOnly, user, logAuditAction]);

  const certifyInstitutionalReportByHumanAction = useCallback(async (params: {
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
  }) => {
    if (!project || isReadOnly) throw new Error("No hay expediente activo o es de solo lectura.");
    const actor = buildRealValidatorIdentity(user);
    if (!actor) throw new Error("INSTITUTIONAL_CERTIFICATION_BLOCKED:CERTIFIER_IDENTITY_UNAVAILABLE");
    const certification = await institutionalReportCertificationService.certifyInstitutionalReport({
      ...params,
      certifierIdentity: actor,
    });
    await logAuditAction({
      action: "CERTIFICAR_REPORTE_INSTITUCIONAL",
      module: "Reportes",
      projectId: project.id,
      projectName: project.ceipolId || project.nombre,
      details: `Certificación humana durable ${certification.certificationId} para snapshot ${certification.reportSnapshotId}.`,
    });
    return certification;
  }, [project, isReadOnly, user, logAuditAction]);

  const rejectInstitutionalReportCertification = useCallback(async (params: {
    certification: InstitutionalReportCertification;
    rejectionReason: string;
  }) => {
    if (!project || isReadOnly) throw new Error("No hay expediente activo o es de solo lectura.");
    const actor = buildRealValidatorIdentity(user);
    const rejected = await institutionalReportCertificationService.rejectInstitutionalCertification({
      certification: params.certification,
      rejectedBy: actor,
      rejectionReason: params.rejectionReason,
    });
    await logAuditAction({
      action: "RECHAZAR_CERTIFICACION_REPORTE",
      module: "Reportes",
      projectId: project.id,
      projectName: project.ceipolId || project.nombre,
      details: `Rechazada certificación ${rejected.certificationId}. Motivo: ${params.rejectionReason}.`,
    });
    return rejected;
  }, [project, isReadOnly, user, logAuditAction]);

  const revokeInstitutionalReportCertification = useCallback(async (params: {
    certificationId: string;
    revocationReason: string;
  }) => {
    if (!project || isReadOnly) throw new Error("No hay expediente activo o es de solo lectura.");
    const actor = buildRealValidatorIdentity(user);
    const revoked = await institutionalReportCertificationService.revokeInstitutionalCertification({
      projectId: project.id,
      certificationId: params.certificationId,
      revokedBy: actor,
      revocationReason: params.revocationReason,
    });
    await logAuditAction({
      action: "REVOCAR_CERTIFICACION_REPORTE",
      module: "Reportes",
      projectId: project.id,
      projectName: project.ceipolId || project.nombre,
      details: `Revocada certificación ${revoked.certificationId}. Motivo: ${params.revocationReason}.`,
    });
    return revoked;
  }, [project, isReadOnly, user, logAuditAction]);

  const getCurrentInstitutionalReportCertification = useCallback(async (params: {
    institutionalReportInput?: InstitutionalReportInput | null;
    institutionalDocumentModel?: InstitutionalDocumentModel | null;
    documentArtifactReference?: string | null;
  }) => {
    if (!project) return null;
    return institutionalReportCertificationService.getCurrentInstitutionalCertification({
      projectId: project.id,
      ...params,
    });
  }, [project]);

  const requestInstitutionalReportPublication = useCallback(async (params: {
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    publicationChannelOrType: string;
  }) => {
    if (!project || isReadOnly) throw new Error("No hay expediente activo o es de solo lectura.");
    const actor = buildRealValidatorIdentity(user);
    const publication = await institutionalReportPublicationService.requestPublication({
      projectId: project.id,
      ...params,
      requestedBy: actor,
    });
    await logAuditAction({
      action: "SOLICITAR_PUBLICACION_REPORTE",
      module: "Reportes",
      projectId: project.id,
      projectName: project.ceipolId || project.nombre,
      details: `Solicitud durable de publicación ${publication.publicationId} para certificación ${publication.certificationId}.`,
    });
    return publication;
  }, [project, isReadOnly, user, logAuditAction]);

  const publishInstitutionalReportByHumanAction = useCallback(async (params: {
    institutionalReportInput: InstitutionalReportInput;
    institutionalDocumentModel: InstitutionalDocumentModel;
    documentArtifactReference: string;
    documentArtifactHash?: string | null;
    publicationChannelOrType: string;
  }) => {
    if (!project || isReadOnly) throw new Error("No hay expediente activo o es de solo lectura.");
    const actor = buildRealValidatorIdentity(user);
    if (!actor) throw new Error("INSTITUTIONAL_PUBLICATION_BLOCKED:PUBLISHER_IDENTITY_UNAVAILABLE");
    const publication = await institutionalReportPublicationService.publishInstitutionalReport({
      projectId: project.id,
      ...params,
      publisherIdentity: actor,
    });
    await logAuditAction({
      action: "PUBLICAR_REPORTE_INSTITUCIONAL",
      module: "Reportes",
      projectId: project.id,
      projectName: project.ceipolId || project.nombre,
      details: `Publicación humana durable ${publication.publicationId} del artefacto ${publication.documentArtifactReference}.`,
    });
    return publication;
  }, [project, isReadOnly, user, logAuditAction]);

  const revokeInstitutionalReportPublication = useCallback(async (params: {
    publicationId: string;
    revocationReason: string;
  }) => {
    if (!project || isReadOnly) throw new Error("No hay expediente activo o es de solo lectura.");
    const actor = buildRealValidatorIdentity(user);
    const revoked = await institutionalReportPublicationService.revokePublication({
      projectId: project.id,
      publicationId: params.publicationId,
      revokedBy: actor,
      revocationReason: params.revocationReason,
    });
    await logAuditAction({
      action: "REVOCAR_PUBLICACION_REPORTE",
      module: "Reportes",
      projectId: project.id,
      projectName: project.ceipolId || project.nombre,
      details: `Revocada publicación ${revoked.publicationId}. Motivo: ${params.revocationReason}.`,
    });
    return revoked;
  }, [project, isReadOnly, user, logAuditAction]);

  const getCurrentInstitutionalReportPublication = useCallback(async (params: {
    certification?: InstitutionalReportCertification | null;
    documentArtifactReference?: string | null;
    documentArtifactHash?: string | null;
  }) => {
    if (!project) return null;
    return institutionalReportPublicationService.getCurrentPublication({
      projectId: project.id,
      ...params,
    });
  }, [project]);

  const softDeleteDoc = useCallback(async (params: {
    type: "Proyecto" | "Fotografía" | "Documento";
    id: string;
    projectId?: string;
    reason: string;
  }) => {
    if (isReadOnly) throw new Error("Expediente en modo lectura.");
    const firestore = getDb();
    const deletedBy = user?.username || "Usuario Local";
    const deletedAt = Date.now();
    const expiresAt = deletedAt + 7 * 24 * 60 * 60 * 1000;

    let originalPath = "";
    let name = "";
    let originalData: any = null;
    let projCeipolId = "";
    const activeProjId = params.projectId || project?.id;

    if (params.type === "Proyecto") {
      originalPath = `projects/${params.id}`;
      const projectRef = doc(firestore, "projects", params.id);
      const snap = await getDoc(projectRef);
      if (snap.exists()) {
        originalData = snap.data();
        name = originalData.name;
        projCeipolId = originalData.ceipolId || "";
      }
    } else if (params.type === "Fotografía") {
      if (!activeProjId) throw new Error("Proyecto no especificado.");
      originalPath = `projects/${activeProjId}/photos/${params.id}`;
      const photoRef = doc(firestore, originalPath);
      const snap = await getDoc(photoRef);
      if (snap.exists()) {
        originalData = snap.data();
        name = originalData.tipo || "Fotografía";
        if (originalData.comentario) {
          name += ` (${originalData.comentario.slice(0, 30)}...)`;
        }
      }
    } else if (params.type === "Documento") {
      if (!activeProjId) throw new Error("Proyecto no especificado.");
      originalPath = `projects/${activeProjId}/documents/${params.id}`;
      const docRef = doc(firestore, originalPath);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        originalData = snap.data();
        name = originalData.name;
      }
    }

    if (!originalData) throw new Error("No se encontró el elemento original.");

    const trashCol = collection(firestore, "trash");
    await addDoc(trashCol, {
      originalId: params.id,
      originalPath,
      type: params.type,
      name,
      deletedBy,
      deletedAt,
      expiresAt,
      deletionReason: params.reason,
      originalData,
      projectId: activeProjId || "",
      projectCeipolId: projCeipolId || project?.ceipolId || ""
    });

    const itemRef = doc(firestore, originalPath);
    await updateDoc(itemRef, {
      deleted: true,
      deletedBy,
      deletedAt,
      deletionReason: params.reason,
      expiresAt
    });

    if (params.type === "Proyecto") {
      if (project?.id === params.id) {
        closeProject();
      }
    } else if (params.type === "Fotografía") {
      setAlbum((prev) => prev.filter((p) => p.id !== params.id));
      setSelectedIds((prev) => prev.filter((x) => x !== params.id));
    } else if (params.type === "Documento") {
      setDocuments((prev) => prev.filter((d) => d.id !== params.id));
    }

    await logAuditAction({
      action: "ELIMINAR",
      module: params.type === "Proyecto" ? "Expedientes" : params.type === "Fotografía" ? "Album Fotografico" : "Documentos",
      projectId: activeProjId || params.id,
      projectName: projCeipolId || project?.ceipolId || name,
      details: `Eliminación lógica de ${params.type} "${name}". Motivo: "${params.reason}".`
    });
  }, [project, isReadOnly, user, closeProject, logAuditAction]);

  const restoreDoc = useCallback(async (trashId: string) => {
    if (isReadOnly) throw new Error("Expediente en modo lectura.");
    const firestore = getDb();
    const trashRef = doc(firestore, "trash", trashId);
    const trashSnap = await getDoc(trashRef);
    if (!trashSnap.exists()) throw new Error("El elemento no existe en la papelera.");

    const trashData = trashSnap.data();
    const { originalPath, originalId, type, name, projectId, projectCeipolId } = trashData;

    const itemRef = doc(firestore, originalPath);
    const itemSnap = await getDoc(itemRef);

    if (itemSnap.exists()) {
      await updateDoc(itemRef, {
        deleted: false,
        deletedBy: null,
        deletedAt: null,
        deletionReason: null,
        expiresAt: null
      });
    } else {
      await setDoc(itemRef, {
        ...trashData.originalData,
        deleted: false,
        deletedBy: null,
        deletedAt: null,
        deletionReason: null,
        expiresAt: null
      });
    }

    if (project?.id === projectId) {
      if (type === "Fotografía") {
        const p = trashData.originalData;
        setAlbum((prev) => [
          ...prev,
          {
            id: originalId,
            previewUrl: p.url,
            lat: p.lat,
            lng: p.lng,
            tipo: p.tipo,
            comentario: p.comentario,
            evidenceId: p.evidenceId || null,
            contextualizedAt: p.contextualizedAt || null,
            contextualizedBy: p.contextualizedBy || null,
            isContextualized: p.isContextualized || false,
          } as any
        ]);
      } else if (type === "Documento") {
        const d = trashData.originalData;
        setDocuments((prev) => [...prev, { id: originalId, ...d }]);
      }
    }

    await deleteDoc(trashRef);

    await logAuditAction({
      action: "RESTAURAR",
      module: "Papelera",
      projectId: projectId || originalId,
      projectName: projectCeipolId || name,
      details: `Restaurado elemento "${name}" (${type}) a su ubicación original.`
    });
  }, [project, isReadOnly, logAuditAction]);

  const archiveProject = useCallback(async (projectId: string, reason: string) => {
    const firestore = getDb();
    const projectRef = doc(firestore, "projects", projectId);
    const snap = await getDoc(projectRef);
    if (!snap.exists()) throw new Error("El expediente no existe.");

    const data = snap.data();
    const isAuthorized = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
    if (!isAuthorized) throw new Error("Solo los administradores pueden archivar expedientes.");

    await updateDoc(projectRef, {
      estado: "ARCHIVADO",
      archiveReason: reason,
      archivedAt: Date.now(),
      archivedBy: user?.username || "Usuario Local"
    });

    if (project?.id === projectId) {
      setProject((prev) => prev ? { ...prev, estado: "ARCHIVADO" } : prev);
    }

    await logAuditAction({
      action: "ARCHIVAR",
      module: "Expedientes",
      projectId,
      projectName: data.ceipolId || data.name,
      details: `Expediente archivado. Motivo: "${reason}".`
    });
  }, [project, user, logAuditAction]);

  const reactivateProject = useCallback(async (projectId: string, reason: string) => {
    const firestore = getDb();
    const projectRef = doc(firestore, "projects", projectId);
    const snap = await getDoc(projectRef);
    if (!snap.exists()) throw new Error("El expediente no existe.");

    const data = snap.data();
    const isAuthorized = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
    if (!isAuthorized) throw new Error("Solo los administradores pueden reactivar expedientes.");

    await updateDoc(projectRef, {
      estado: "ABIERTO",
      reactivateReason: reason,
      reactivatedAt: Date.now(),
      reactivatedBy: user?.username || "Usuario Local"
    });

    if (project?.id === projectId) {
      setProject((prev) => prev ? { ...prev, estado: "ABIERTO" } : prev);
    }

    await logAuditAction({
      action: "REACTIVAR",
      module: "Expedientes",
      projectId,
      projectName: data.ceipolId || data.name,
      details: `Expediente reactivado (vuelto a estado ABIERTO). Motivo: "${reason}".`
    });
  }, [project, user, logAuditAction]);

  const savePhotoContextualization = useCallback(async (photoId: string) => {
    if (isReadOnly) throw new Error("Expediente en modo lectura.");
    if (!project) throw new Error("No hay un proyecto activo.");

    const photo = album.find((p) => p.id === photoId);
    if (!photo) throw new Error("Fotografía no encontrada.");

    const firestore = getDb();
    const evidenceId = photo.evidenceId || `EVI-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
    const contextualizedAt = Date.now();
    const contextualizedBy = user?.username || "Usuario Local";

    const photoRef = doc(firestore, "projects", project.id, "photos", photoId);
    await updateDoc(photoRef, {
      evidenceId,
      tipo: photo.tipo || "",
      comentario: photo.comentario || "",
      contextualizedAt,
      contextualizedBy,
      isContextualized: true,
      isIndependentPoi: photo.isIndependentPoi || false,
      savedCoordinates: photo.lat && photo.lng ? { lat: photo.lat, lng: photo.lng } : null
    });

    setAlbum((prev) =>
      prev.map((p) =>
        p.id === photoId
          ? {
              ...p,
              evidenceId,
              contextualizedAt,
              contextualizedBy,
              isContextualized: true,
              isIndependentPoi: photo.isIndependentPoi || false,
            }
          : p
      )
    );

    await logAuditAction({
      action: "GUARDAR_CONTEXTUALIZACION",
      module: "Album Fotografico",
      projectId: project.id,
      projectName: project.ceipolId || project.nombre,
      details: `Guardada contextualización de evidencia ${evidenceId} para foto con ID ${photoId}.`
    });

    return evidenceId;
  }, [project, album, isReadOnly, user, logAuditAction]);

  const registerSweep = useCallback(async (params: Omit<SweepIntegrationItem, "id" | "status" | "timestamp"> & { initialContext?: string }) => {
    if (!project || isReadOnly) throw new Error("No hay expediente activo o es de solo lectura.");

    const currentSweeps = project.sweeps || [];
    const activeDuplicate = currentSweeps.find((s) =>
      s.engine === params.engine &&
      s.source === params.source &&
      s.type === params.type &&
      isActiveGeointSweepLifecycleStatus(s.lifecycleStatus || s.lifecycle?.status)
    );
    if (activeDuplicate) {
      setActiveSweepForModal(activeDuplicate);
      return activeDuplicate.id;
    }
    
    const sweepId = `SWEEP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const initialStatus = params.type === "Directa" ? "Integrado" : "Pendiente";
    const lifecycle = createHumanTriggeredRunningSweepLifecycle({
      sweepId,
      expedienteId: project.id,
      correlationId: (params as any).correlationId ?? null,
      traceabilityId: (params as any).traceabilityId ?? null,
      outputEvidenceIds: (params as any).outputEvidenceIds || [],
      outputFindingIds: (params as any).outputFindingIds || [],
      lineage: (params as any).lineage || [],
      lineageStatus: (params as any).lineageStatus,
    });
    
    const newSweep: SweepIntegrationItem = {
      id: sweepId,
      engine: params.engine,
      source: params.source,
      type: params.type,
      status: initialStatus,
      relevance: params.relevance,
      data: params.data,
      context: params.initialContext || "",
      timestamp: Date.now(),
      lifecycleStatus: lifecycle.status,
      lifecycleVersion: lifecycle.version,
      lifecycle,
      analysisStatus: lifecycle.analysisStatus,
      humanValidationStatus: lifecycle.humanValidationStatus,
      validationSource: lifecycle.validationSource,
      validatedAt: lifecycle.validatedAt,
      validatedBy: lifecycle.validatedBy,
      traceabilityId: lifecycle.traceabilityId,
      correlationId: lifecycle.correlationId,
      outputEvidenceIds: lifecycle.outputEvidenceIds,
      outputFindingIds: lifecycle.outputFindingIds,
      lineage: lifecycle.lineage,
      lineageStatus: lifecycle.lineageStatus,
      geographyId: params.geographyId ?? project.canonicalGeography?.geographyId ?? null,
      geographyType: params.geographyType ?? project.canonicalGeography?.type ?? null,
    };

    const updatedSweeps = [...currentSweeps, newSweep];

    let updatedHypothesis = project.hipotesis || "";

    if (params.type === "Directa") {
      const delimiterStart = `\n=== BARRIDO DIRECTO [ID: ${sweepId}] [Engine: ${params.engine}] ===\n`;
      const delimiterEnd = `\n=========================================\n`;
      const textToAppend = `${delimiterStart}Fecha: ${new Date(newSweep.timestamp).toLocaleString("es-MX")}\nFuente: ${params.source}\nRelevancia: ${params.relevance}\n${params.data}${delimiterEnd}`;
      updatedHypothesis = updatedHypothesis ? `${updatedHypothesis}\n${textToAppend}` : textToAppend;
    }

    try {
      const firestore = getDb();
      const projectRef = doc(firestore, "projects", project.id);
      
      const updateData: any = {
        sweeps: updatedSweeps
      };
      if (params.type === "Directa") {
        updateData.hipotesis = updatedHypothesis;
      }

      await runTransaction(firestore, async (transaction) => {
        transaction.update(projectRef, updateData);
        await enqueueSweepLifecycleEventsInTransaction(transaction, firestore, lifecycle, {
          actor: buildGeointSweepEventActor(user),
          source: "ProjectContext.registerSweep",
        });
      });

      // Toda evidencia generada por barridos crea automáticamente un elemento geográfico
      let latVal: number | null = null;
      let lngVal: number | null = null;
      
      // Parse coordinates from sweep data text
      const coordsMatch = params.data.match(/(?:lat|lng|coordenadas|coords|posicion)[:\s]+(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i);
      if (coordsMatch) {
        latVal = parseFloat(coordsMatch[1]);
        lngVal = parseFloat(coordsMatch[2]);
      } else {
        latVal = project.canonicalGeography?.derived?.centroid?.lat ?? null;
        lngVal = project.canonicalGeography?.derived?.centroid?.lng ?? null;
      }

      if (latVal != null && lngVal != null && !Number.isNaN(latVal) && !Number.isNaN(lngVal)) {
        try {
          const photoId = `EVI-SWEEP-${Date.now()}`;
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
          let previewUrl = "";
          if (apiKey) {
            console.log("[ProjectContext] Creando mapa de barrido con Google Maps Static API (Habilitada por Analista)...");
            previewUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latVal},${lngVal}&zoom=16&size=600x400&maptype=roadmap&key=${apiKey}`;
          } else {
            console.warn("[ProjectContext] API Key de Google no detectada en creación de barrido. Usando CartoDB...");
            previewUrl = `https://basemaps.cartocdn.com/rastertiles/voyager_labels_under/16/${lngVal}/${latVal}/600x400.png`;
          }
          const photosColRef = collection(firestore, "projects", project.id, "photos");
          const photoDocData = {
            url: previewUrl,
            storagePath: `sweeps/${photoId}.jpg`,
            lat: latVal,
            lng: lngVal,
            projectId: project.id,
            createdAt: Date.now(),
            tipo: `Barrido ${params.engine}`,
            comentario: `Evidencia generada automáticamente por barrido OSINT/GIS (${params.source}). Datos clave: ${params.data.slice(0, 300)}`,
            validado: true,
            isIndependentPoi: true,
            geographyId: newSweep.geographyId ?? null,
            geographyType: newSweep.geographyType ?? null,
          };
          await setDoc(doc(photosColRef, photoId), photoDocData);
          
          setAlbum(prev => [...prev, {
            id: photoId,
            previewUrl,
            lat: latVal!,
            lng: lngVal!,
            tipo: `Barrido ${params.engine}`,
            comentario: `Evidencia generada automáticamente por barrido OSINT/GIS (${params.source}). Datos clave: ${params.data.slice(0, 300)}`,
            validado: true,
            isIndependentPoi: true,
            geographyId: newSweep.geographyId ?? null,
            geographyType: newSweep.geographyType ?? null,
          }]);
        } catch (photoErr) {
          console.error("[ProjectContext] Error creating sweep georeferenced photo:", photoErr);
        }
      }

      setProject(prev => prev ? { ...prev, sweeps: updatedSweeps, hipotesis: updatedHypothesis } : prev);
      
      await logAuditAction({
        action: "REGISTRAR_BARRIDO",
        module: "Expedientes",
        projectId: project.id,
        projectName: project.ceipolId || project.nombre,
        details: `Registrado barrido ${params.engine} (${params.source}). Tipo: ${params.type}. Relevancia: ${params.relevance}. Estado inicial: ${initialStatus}.`
      });

      // Abre el diálogo modal de confirmación obligatoria
      setActiveSweepForModal(newSweep);

      return sweepId;
    } catch (err) {
      console.error("[ProjectContext] Error registering sweep:", err);
      throw err;
    }
  }, [project, isReadOnly, logAuditAction, user]);

  const updateSweep = useCallback(async (sweepId: string, updates: Partial<SweepIntegrationItem>) => {
    if (!project || isReadOnly) throw new Error("No hay expediente activo o es de solo lectura.");

    const currentSweeps = project.sweeps || [];
    const sweepToUpdate = currentSweeps.find(s => s.id === sweepId);
    if (!sweepToUpdate) throw new Error("Barrido no encontrado.");

    let lifecycle = updates.lifecycle || sweepToUpdate.lifecycle || null;
    const validationTimestamp = new Date().toISOString();
    const validatorIdentity = buildRealValidatorIdentity(user);

    if (updates.status === "Integrado" && lifecycle && lifecycle.status !== "CERTIFIED") {
      if (lifecycle.status === "RUNNING") {
        lifecycle = transitionGeointSweepLifecycle(lifecycle, "COLLECTING", {
          expectedVersion: lifecycle.version,
          now: validationTimestamp,
          reason: "SWEEP_OUTPUTS_AVAILABLE_FOR_REVIEW",
        });
      }
      if (lifecycle.status === "COLLECTING") {
        lifecycle = transitionGeointSweepLifecycle(lifecycle, "ANALYZING", {
          expectedVersion: lifecycle.version,
          now: validationTimestamp,
          reason: "SWEEP_OUTPUTS_COLLECTED",
        });
      }
      if (lifecycle.status === "ANALYZING") {
        lifecycle = markGeointSweepReadyForHumanReview(lifecycle, {
          aiQualityScore: updates.aiQualityScore ?? lifecycle.aiQualityScore ?? 0,
          expectedVersion: lifecycle.version,
          now: validationTimestamp,
        });
      }
      lifecycle = certifyGeointSweepWithHumanApproval(lifecycle, {
        validatedAt: updates.validatedAt || validationTimestamp,
        validatedBy: updates.validatedBy ?? validatorIdentity,
        expectedVersion: lifecycle.version,
      });
    }

    if (updates.status === "Rechazado" && lifecycle && lifecycle.status !== "FAILED") {
      lifecycle = rejectGeointSweepWithHumanDecision(lifecycle, {
        reason: updates.justification || "HUMAN_REJECTED_SWEEP",
        validatedAt: updates.validatedAt || validationTimestamp,
        validatedBy: updates.validatedBy ?? validatorIdentity,
        expectedVersion: lifecycle.version,
      });
    }

    const updatedSweep = {
      ...sweepToUpdate,
      ...updates,
      ...(lifecycle ? {
        lifecycle,
        lifecycleStatus: lifecycle.status,
        lifecycleVersion: lifecycle.version,
        analysisStatus: lifecycle.analysisStatus,
        aiQualityScore: lifecycle.aiQualityScore,
        humanValidationStatus: lifecycle.humanValidationStatus,
        validationSource: lifecycle.validationSource,
        validatedAt: lifecycle.validatedAt,
        validatedBy: lifecycle.validatedBy,
        traceabilityId: lifecycle.traceabilityId,
        correlationId: lifecycle.correlationId,
        outputEvidenceIds: lifecycle.outputEvidenceIds,
        outputFindingIds: lifecycle.outputFindingIds,
        lineage: lifecycle.lineage,
        lineageStatus: lifecycle.lineageStatus,
      } : {}),
    } as SweepIntegrationItem;
    let updatedSweeps = currentSweeps.map(s => s.id === sweepId ? updatedSweep : s);

    let updatedHypothesis = project.hipotesis || "";

    const directHeader = `=== BARRIDO DIRECTO [ID: ${sweepId}]`;
    const directFooter = `=========================================\n`;
    const contextualizedHeader = `=== BARRIDO CONTEXTUALIZADO [ID: ${sweepId}]`;
    const contextualizedFooter = `================================================\n`;

    const cleanHypothesisBlock = (hyp: string, header: string, footer: string) => {
      const startIndex = hyp.indexOf(header);
      if (startIndex !== -1) {
        const endIndex = hyp.indexOf(footer, startIndex);
        if (endIndex !== -1) {
          const fullMatchLength = (endIndex + footer.length) - startIndex;
          const cleaned = hyp.substring(0, startIndex) + hyp.substring(startIndex + fullMatchLength);
          return cleaned.replace(/\n\n\n+/g, "\n\n").trim();
        }
      }
      return hyp;
    };

    updatedHypothesis = cleanHypothesisBlock(updatedHypothesis, directHeader, directFooter);
    updatedHypothesis = cleanHypothesisBlock(updatedHypothesis, contextualizedHeader, contextualizedFooter);

    if (updatedSweep.status === "Integrado") {
      if (updatedSweep.type === "Directa") {
        const delimiterStart = `\n=== BARRIDO DIRECTO [ID: ${sweepId}] [Engine: ${updatedSweep.engine}] ===\n`;
        const textToAppend = `${delimiterStart}Fecha: ${new Date(updatedSweep.timestamp).toLocaleString("es-MX")}\nFuente: ${updatedSweep.source}\nRelevancia: ${updatedSweep.relevance}\nContexto/Ajuste: ${updatedSweep.context || "Sin contexto adicional"}\n${updatedSweep.data}${directFooter}`;
        updatedHypothesis = updatedHypothesis ? `${updatedHypothesis}\n${textToAppend}` : textToAppend;
      } else {
        const delimiterStart = `\n=== BARRIDO CONTEXTUALIZADO [ID: ${sweepId}] [Engine: ${updatedSweep.engine}] ===\n`;
        const textToAppend = `${delimiterStart}Fecha: ${new Date().toLocaleString("es-MX")}\nFuente: ${updatedSweep.source}\nRelevancia: ${updatedSweep.relevance}\nContexto/Validación: ${updatedSweep.context || "Sin contexto adicional"}\nDetalles: ${updatedSweep.data}${contextualizedFooter}`;
        updatedHypothesis = updatedHypothesis ? `${updatedHypothesis}\n${textToAppend}` : textToAppend;
      }
    }

    try {
      const firestore = getDb();
      const projectRef = doc(firestore, "projects", project.id);

      await runTransaction(firestore, async (transaction) => {
        const projectSnap = await transaction.get(projectRef);
        const serverProject = projectSnap.data() as Project | undefined;
        const serverSweeps = Array.isArray(serverProject?.sweeps) ? serverProject.sweeps : currentSweeps;
        const serverSweep = serverSweeps.find((s) => s.id === sweepId);
        if (!serverSweep) throw new Error("Barrido no encontrado en persistencia.");

        const localVersion = sweepToUpdate.lifecycleVersion ?? sweepToUpdate.lifecycle?.version ?? 0;
        const serverVersion = serverSweep.lifecycleVersion ?? serverSweep.lifecycle?.version ?? 0;
        if (serverVersion > localVersion) {
          throw new Error(`GEOINT_SWEEP_VERSION_CONFLICT:${serverVersion}:LOCAL_${localVersion}`);
        }

        updatedSweeps = serverSweeps.map(s => s.id === sweepId ? { ...serverSweep, ...updatedSweep } : s);
        transaction.update(projectRef, {
          sweeps: updatedSweeps,
          hipotesis: updatedHypothesis
        });
        if (updatedSweep.lifecycle) {
          await enqueueSweepLifecycleEventsInTransaction(transaction, firestore, updatedSweep.lifecycle, {
            actor: buildGeointSweepEventActor(user),
            source: "ProjectContext.updateSweep",
          });
        }
      });

      setProject(prev => prev ? { ...prev, sweeps: updatedSweeps, hipotesis: updatedHypothesis } : prev);

      await logAuditAction({
        action: "ACTUALIZAR_BARRIDO",
        module: "Expedientes",
        projectId: project.id,
        projectName: project.ceipolId || project.nombre,
        details: `Actualizado barrido ${updatedSweep.engine} (${sweepId}). Nuevo estado: ${updatedSweep.status}.`
      });

      if (activeSweepForModal?.id === sweepId) {
        setActiveSweepForModal(null);
      }
    } catch (err) {
      console.error("[ProjectContext] Error updating sweep:", err);
      throw err;
    }
  }, [project, isReadOnly, logAuditAction, activeSweepForModal, user]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      project,
      album,
      selectedIds,
      analysisResult,
      createProject,
      closeProject,
      loadProject,
      addPhotoToAlbum,
      uploadAndAddPhoto,
      createGeographicEntity,
      removePhotoFromAlbum,
      removeAllPhotosFromAlbum,
      updatePhotoMeta,
      updatePhotoCoordinates,
      updatePhotoRelationship,
      togglePhotoSelection,
      selectAllPhotos,
      clearSelection,
      setAnalysisResult,
      exportProjectData,
      importProjectData,
      documents,
      uploadDocument,
      saveCustomDocument,
      removeDocument,
      markAsPrinted,
      datosGobMxResult,
      setDatosGobMxResult,
      isReadOnly,
      renameProject,
      softDeleteDoc,
      restoreDoc,
      archiveProject,
      reactivateProject,
      savePhotoContextualization,
      logAuditAction,
      updateProjectDetails,
      saveHumanHypothesis,
      requestInstitutionalReportCertification,
      certifyInstitutionalReportByHumanAction,
      rejectInstitutionalReportCertification,
      revokeInstitutionalReportCertification,
      getCurrentInstitutionalReportCertification,
      requestInstitutionalReportPublication,
      publishInstitutionalReportByHumanAction,
      revokeInstitutionalReportPublication,
      getCurrentInstitutionalReportPublication,
      activeSweepForModal,
      setActiveSweepForModal,
      registerSweep,
      updateSweep
    }),
    [
      project,
      album,
      selectedIds,
      analysisResult,
      createProject,
      closeProject,
      loadProject,
      addPhotoToAlbum,
      uploadAndAddPhoto,
      createGeographicEntity,
      removePhotoFromAlbum,
      removeAllPhotosFromAlbum,
      updatePhotoMeta,
      updatePhotoCoordinates,
      updatePhotoRelationship,
      togglePhotoSelection,
      selectAllPhotos,
      clearSelection,
      setAnalysisResult,
      exportProjectData,
      importProjectData,
      documents,
      uploadDocument,
      saveCustomDocument,
      removeDocument,
      markAsPrinted,
      datosGobMxResult,
      setDatosGobMxResult,
      isReadOnly,
      renameProject,
      softDeleteDoc,
      restoreDoc,
      archiveProject,
      reactivateProject,
      savePhotoContextualization,
      logAuditAction,
      updateProjectDetails,
      saveHumanHypothesis,
      requestInstitutionalReportCertification,
      certifyInstitutionalReportByHumanAction,
      rejectInstitutionalReportCertification,
      revokeInstitutionalReportCertification,
      getCurrentInstitutionalReportCertification,
      requestInstitutionalReportPublication,
      publishInstitutionalReportByHumanAction,
      revokeInstitutionalReportPublication,
      getCurrentInstitutionalReportPublication,
      activeSweepForModal,
      registerSweep,
      updateSweep
    ]
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject debe usarse dentro de ProjectProvider");
  return ctx;
}
