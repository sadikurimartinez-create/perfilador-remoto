"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DatosGobMxResult } from "@/lib/datosGobMx";

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
import imageCompression from "browser-image-compression";
import { useAuth } from "@/context/AuthContext";

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

export type AlbumPhoto = {
  id: string;
  previewUrl: string;
  lat: number | null;
  lng: number | null;
  tipo: string;
  comentario: string;
  file?: File;
  evidenceId?: string;
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
    }
  ) => Promise<void>;
  removePhotoFromAlbum: (id: string) => Promise<void>;
  removeAllPhotosFromAlbum: (projectId: string) => Promise<void>;
  updatePhotoMeta: (id: string, meta: { tipo: string; comentario: string }) => void;
  updatePhotoCoordinates: (id: string, lat: number, lng: number) => Promise<void>;
  togglePhotoSelection: (id: string) => void;
  selectAllPhotos: () => void;
  clearSelection: () => void;
  setAnalysisResult: (result: AnalysisResult | null) => void;
  exportProjectData: (projectId: string) => Promise<void>;
  importProjectData: (file: File, username: string) => Promise<void>;
  documents: ProjectDocument[];
  uploadDocument: (file: File, context: string) => Promise<void>;
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

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
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
  }: {
    nombre: string;
    geometryType: "individual" | "lineal" | "poligono";
    descripcion?: string;
  }) => {
    try {
      const firestore = getDb();
      const counterRef = doc(firestore, "counters", "projects");
      const projectCol = collection(firestore, "projects");
      const projectDocRef = doc(projectCol);

      let ceipolId = "";
      
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
        });
      });

      setProject({
        id: projectDocRef.id,
        nombre: nombre.trim() || "Sin nombre",
        geometryType,
        descripcion: descripcion || "",
        createdBy: user?.username || "Usuario Local",
        ceipolId,
        estado: "ABIERTO",
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
          return {
            id: photoDoc.id,
            previewUrl: data.url,
            lat: data.lat,
            lng: data.lng,
            tipo: data.tipo,
            comentario: data.comentario,
            deleted: data.deleted === true,
            evidenceId: data.evidenceId || null,
            contextualizedAt: data.contextualizedAt || null,
            contextualizedBy: data.contextualizedBy || null,
            isContextualized: data.isContextualized || false,
          };
        })
        .filter((p) => !p.deleted) as any;

      setProject({
        id: projectId,
        nombre: projectData.name,
        geometryType: projectData.geometryType,
        descripcion: projectData.descripcion || "",
        ...projectData,
      });
      setAlbum(albumPhotos);
      setSelectedIds(albumPhotos.map((p) => p.id));

      const docsColRef = collection(firestore, "projects", projectId, "documents");
      const docsSnap = await getDocs(query(docsColRef, orderBy("createdAt", "asc")));
      const projectDocs: ProjectDocument[] = docsSnap.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as any))
        .filter((d: any) => !d.deleted);
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

    let defaultTipo = "Nodo Principal";
    if (project.geometryType === "lineal") defaultTipo = "Corredor";
    else if (project.geometryType === "poligono") defaultTipo = "Interior";

    // 3. Guardar metadatos en Firestore
    const firestore = getDb();
    const photosColRef = collection(firestore, "projects", project.id, "photos");
    const photoDocData = {
      url: downloadURL,
      storagePath: snapshot.ref.fullPath,
      lat,
      lng,
      projectId: project.id,
      createdAt: Date.now(),
      tipo: defaultTipo,
      comentario: "",
      gpsAccuracy: metadata?.gpsAccuracy ?? null,
      gpsTimestamp: metadata?.gpsTimestamp ?? null,
      gpsSource: metadata?.gpsSource ?? "SOLO_EXIF",
      exifLat: metadata?.exifLat ?? null,
      exifLng: metadata?.exifLng ?? null,
      gpsLat: metadata?.gpsLat ?? null,
      gpsLng: metadata?.gpsLng ?? null,
      diagnosticLogs: metadata?.diagnosticLogs ?? "Carga estándar",
      validado: metadata?.validado ?? false,
    };
    const photoDocRef = await addDoc(photosColRef, photoDocData);

    // 4. Actualizar contador en el proyecto padre
    const projectDocRef = doc(firestore, "projects", project.id);
    await updateDoc(projectDocRef, {
      photoCount: increment(1)
    });

    // 5. Actualizar estado local para reflejar en UI
    addPhotoToAlbum({
      previewUrl: downloadURL,
      lat,
      lng,
      tipo: defaultTipo,
      comentario: "",
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
    }, photoDocRef.id);

  }, [project, addPhotoToAlbum, isReadOnly]);

  const uploadDocument = useCallback(async (file: File, context: string) => {
    if (isReadOnly) throw new Error("Expediente en modo lectura (Auditoría).");
    if (!project) throw new Error("No hay un proyecto activo para subir el anexo.");
    const storage = getStorage();
    const docId = generateId();
    const storageRef = ref(storage, `projects/${project.id}/documents/${docId}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    const firestore = getDb();
    const docsColRef = collection(firestore, "projects", project.id, "documents");
    const docData = {
      name: file.name,
      url: downloadURL,
      type: file.type || "unknown",
      context,
      createdAt: Date.now()
    };
    const docRef = await addDoc(docsColRef, docData);
    setDocuments(prev => [...prev, { id: docRef.id, ...docData }]);
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
      const photoRef = doc(firestore, "projects", project.id, "photos", id);
      // Aquí necesitaríamos el storagePath para borrar de Storage, lo agregaré al modelo.
      // Por ahora, solo borramos de Firestore y el contador.
      await deleteDoc(photoRef);
      const projectRef = doc(firestore, "projects", project.id);
      await updateDoc(projectRef, { photoCount: increment(-1) });

      setAlbum((prev) => prev.filter((p) => p.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      console.error("[ProjectContext] Error al eliminar foto:", err);
    }
  }, [project]);

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

  const updatePhotoCoordinates = useCallback(async (id: string, lat: number, lng: number) => {
    if (isReadOnly) return;
    if (!project) return;
    try {
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", project.id, "photos", id), { lat, lng });
      setAlbum((prev) =>
        prev.map((p) => (p.id === id ? { ...p, lat, lng } : p))
      );
    } catch (err) {
      console.error("[ProjectContext] Error al actualizar coordenadas:", err);
    }
  }, [project, isReadOnly]);

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
      removePhotoFromAlbum,
      removeAllPhotosFromAlbum,
      updatePhotoMeta,
      updatePhotoCoordinates,
      togglePhotoSelection,
      selectAllPhotos,
      clearSelection,
      setAnalysisResult,
      exportProjectData,
      importProjectData,
      documents,
      uploadDocument,
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
      logAuditAction
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
      removePhotoFromAlbum,
      removeAllPhotosFromAlbum,
      updatePhotoMeta,
      updatePhotoCoordinates,
      togglePhotoSelection,
      selectAllPhotos,
      clearSelection,
      setAnalysisResult,
      exportProjectData,
      importProjectData,
      documents,
      uploadDocument,
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
      logAuditAction
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
