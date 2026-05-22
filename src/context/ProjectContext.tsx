"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { doc, getDoc, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/localDb";
import { getDb } from "@/lib/firebase";

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
};

export type Project = {
  id: string;
  nombre: string;
  geometryType: "individual" | "lineal" | "poligono";
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
  raw?: unknown;
};

type ProjectContextValue = {
  project: Project | null;
  album: AlbumPhoto[];
  selectedIds: string[];
  analysisResult: AnalysisResult | null;
  createProject: ({
    nombre,
    geometryType,
  }: {
    nombre: string;
    geometryType: "individual" | "lineal" | "poligono";
  }) => void;

  closeProject: () => void;
  loadProject: (projectId: string) => Promise<void>;
  addPhotoToAlbum: (photo: Omit<AlbumPhoto, "id">, id?: string) => void;
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
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [album, setAlbum] = useState<AlbumPhoto[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [analysisResult, setAnalysisResultState] = useState<AnalysisResult | null>(null);

  const createProject = useCallback(({
    nombre,
    geometryType,
  }: {
    nombre: string;
    geometryType: "individual" | "lineal" | "poligono";
  }) => {

    setProject({
      id: generateId(),
      nombre: nombre.trim() || "Sin nombre",
      geometryType,
    });

    setAlbum([]);
    setSelectedIds([]);
    setAnalysisResultState(null);

  }, []);

  const closeProject = useCallback(() => {
    setProject(null);
    setAlbum([]);
    setSelectedIds([]);
    setAnalysisResultState(null);
  }, []);

  const loadProject = useCallback(async (projectId: string) => {
    let projectRow = await db.projects.get(projectId);
    if (!projectRow) {
      const firestore = getDb();
      const ref = doc(firestore, "projects", projectId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data() as any;

      const name = data.name ?? "Sin nombre";
      projectRow = {
         id: projectId || generateId(),      // asegura que siempre tenga string
         name: name || "Sin nombre",         // asegura que siempre tenga string
         geometryType: data.geometryType || "individual",
         createdAt: data.createdAt || Date.now(),
         createdBy: data.createdBy || "Desconocido",
         lockedBy: data.lockedBy || null,
       } as any;

      await db.projects.put(projectRow as any);
    }
    const photoRows = await db.photos.where("projectId").equals(projectId).toArray();
    const albumPhotos: AlbumPhoto[] = photoRows
      .filter(
        (p) =>
          p.lat != null &&
          p.lng != null &&
          !Number.isNaN(p.lat) &&
          !Number.isNaN(p.lng)
      )
      .map((p) => ({
        id: p.id,
        previewUrl: URL.createObjectURL(p.imageBlob),
        lat: p.lat,
        lng: p.lng,
        tipo: p.tag,
        comentario: p.comments,
        file: new File([p.imageBlob], "photo.jpg", { type: p.imageBlob.type }),
      }));
    setProject({
      id: projectRow?.id || generateId(),
      nombre: projectRow?.name || "Sin nombre",
      geometryType: (projectRow as any)?.geometryType || "individual",
    });
    setAlbum(albumPhotos);
    setSelectedIds([]);
    setAnalysisResultState(null);
  }, []);

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

  const removePhotoFromAlbum = useCallback(async (id: string) => {
    try {
      await db.photos.delete(id);
      setAlbum((prev) => prev.filter((p) => p.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      console.error("[ProjectContext] Error al eliminar foto:", err);
    }
  }, []);

  const removeAllPhotosFromAlbum = useCallback(async (projectId: string) => {
    try {
      await db.photos.where("projectId").equals(projectId).delete();
      setAlbum([]);
      setSelectedIds([]);
    } catch (err) {
      console.error("[ProjectContext] Error al eliminar todas las fotos:", err);
    }
  }, []);

  const updatePhotoMeta = useCallback((id: string, meta: { tipo: string; comentario: string }) => {
    setAlbum((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...meta } : p))
    );
  }, []);

  const updatePhotoCoordinates = useCallback(async (id: string, lat: number, lng: number) => {
    try {
      await db.photos.update(id, { lat, lng });
      setAlbum((prev) =>
        prev.map((p) => (p.id === id ? { ...p, lat, lng } : p))
      );
    } catch (err) {
      console.error("[ProjectContext] Error al actualizar coordenadas:", err);
    }
  }, []);

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
      const projectRow = await db.projects.get(projectId);
      if (!projectRow) throw new Error("Proyecto no encontrado localmente.");

      const photoRows = await db.photos.where("projectId").equals(projectId).toArray();
      
      // Convertir Blobs a Base64 para empaquetar en JSON
      const photosData = await Promise.all(photoRows.map((p) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              id: p.id,
              tag: p.tag,
              comments: p.comments,
              lat: p.lat,
              lng: p.lng,
              timestamp: p.timestamp,
              base64: reader.result
            });
          };
          reader.onerror = reject;
          if (!p.imageBlob) {
            resolve({ id: p.id, tag: p.tag, comments: p.comments, lat: p.lat, lng: p.lng, timestamp: p.timestamp, base64: null });
          } else {
            reader.readAsDataURL(p.imageBlob);
          }
        });
      }));

      const payload = {
        version: "1.0",
        project: projectRow,
        photos: photosData
      };

      const fileName = `${projectRow.name.replace(/\s+/g, '_')}_Gabinete.json`;
      const fileToShare = new File([JSON.stringify(payload)], fileName, { type: "application/json" });

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

      // Intentar compartir directamente a apps (WhatsApp, Telegram, etc.) en celulares
      if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
        try {
          await navigator.share({
            files: [fileToShare],
            title: 'Expediente Táctico Exportado',
            text: `Evidencia de campo: ${projectRow.name}`,
          });
          return; // Compartido exitosamente, salimos de la función
        } catch (shareErr) {
          console.log("[ProjectContext] Web Share cancelado o fallido, usando fallback de descarga:", shareErr);
          triggerDownload();
          return;
        }
      }

      // Fallback: Descarga nativa para PC o navegadores sin soporte de compartir
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

      if (payload.version !== "1.0" || !payload.project || !payload.photos) {
        throw new Error("El archivo no es un expediente válido del Perfilador.");
      }

      const proj = payload.project;
      const firestore = getDb();
      const col = collection(firestore, "projects");
      const projectRef = doc(col, proj.id);

      // Guardar en la nube (para que aparezca en la lista)
      await setDoc(projectRef, {
        name: proj.name,
        geometryType: proj.geometryType || "individual",
        createdAt: proj.createdAt || Date.now(),
        createdBy: username,
        lockedBy: null,
        photoCount: payload.photos.length,
      });

      // Guardar local (para la evidencia)
      await db.projects.put(proj);
      const photoPromises = payload.photos.map(async (p: any) => {
        const res = await fetch(p.base64);
        const blob = await res.blob();
        return { ...p, imageBlob: blob, projectId: proj.id };
      });
      const photosToSave = await Promise.all(photoPromises);
      await db.photos.bulkPut(photosToSave);
    } catch (err) {
      throw err;
    }
  }, []);

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
      removePhotoFromAlbum,
      removeAllPhotosFromAlbum,
      updatePhotoMeta,
      updatePhotoCoordinates,
      togglePhotoSelection,
      selectAllPhotos,
      clearSelection,
      setAnalysisResult,
      exportProjectData,
      importProjectData
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
      removePhotoFromAlbum,
      removeAllPhotosFromAlbum,
      updatePhotoMeta,
      updatePhotoCoordinates,
      togglePhotoSelection,
      selectAllPhotos,
      clearSelection,
      setAnalysisResult,
      exportProjectData,
      importProjectData
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
