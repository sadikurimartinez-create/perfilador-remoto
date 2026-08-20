"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { CEIPOLCard } from "./ui/CEIPOLCard";
import { CEIPOLButton } from "./ui/CEIPOLButton";

type ProjectWithCount = {
  id: string;
  name: string;
  createdAt: number;
  photoCount: number;
  createdBy?: string;
  lockedBy?: string | null;
  estado?: string;
  comentariosSupervisor?: string;
  descripcion?: string;
  geometryType?: string;
  analysisContent?: string;
  deleted?: boolean;
  deadlineAt?: number;
  printedAt?: number | null;
  ceipolId?: string;
};

export function ProjectList() {
  const router = useRouter();
  const { 
    exportProjectData, 
    importProjectData, 
    createProject, 
    renameProject, 
    softDeleteDoc, 
    archiveProject, 
    reactivateProject,
    logAuditAction 
  } = useProject();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [nombreInput, setNombreInput] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [geometryType, setGeometryType] = useState<"individual" | "lineal" | "poligono">("individual");
  const [isListening, setIsListening] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<{file: File, url: string}[]>([]);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const lastTranscriptRef = useRef<string>("");
  const { user, loading } = useAuth();
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [allAnalyses, setAllAnalyses] = useState<
    {
      id: string;
      projectId: string;
      content: string;
      createdAt: number;
      createdBy?: string;
      attachedPhotos?: string[];
      reportEngineOutput?: boolean;
    }[]
  >([]);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<any>(null);

  // Estados para gobernanza, papelera, renombrado, archivado y reactivación
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState<ProjectWithCount | null>(null);
  const [renameInput, setRenameInput] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithCount | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonCustom, setDeleteReasonCustom] = useState("");

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [projectToArchive, setProjectToArchive] = useState<ProjectWithCount | null>(null);
  const [archiveReason, setArchiveReason] = useState("");

  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [projectToReactivate, setProjectToReactivate] = useState<ProjectWithCount | null>(null);
  const [reactivateReason, setReactivateReason] = useState("");
  const [devueltoProject, setDevueltoProject] = useState<ProjectWithCount | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

  const handleOpenPreview = async (
    project: ProjectWithCount,
    analysis: { content?: string; attachedPhotos?: string[] } | any
  ) => {
    const attached = Array.isArray(analysis?.attachedPhotos)
      ? (analysis.attachedPhotos as string[])
      : [];

    // Si existe evidencia ya guardada en Firestore, úsala.
    // Si no, cae a una consulta local rápida desde Dexie (IndexedDB).
    let photos: string[] = attached;
    if (!photos.length) {
      try {
        const firestore = getDb();
        const photosCol = collection(firestore, "projects", project.id, "photos");
        const snap = await getDocs(photosCol);
        photos = snap.docs.map((d) => d.data().url);
      } catch (e) {
        console.error("[ProjectList] Error obteniendo fotos de Firebase:", e);
        photos = [];
      }
    }

    setSelectedPreview({
      title: project.name,
      content: analysis?.content ?? "",
      photos,
    });
    setPreviewModalOpen(true);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;
    const db = getDb();
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: ProjectWithCount[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "Sin nombre",
            createdAt: data.createdAt ?? 0,
            photoCount: data.photoCount ?? 0,
            createdBy: data.createdBy,
            lockedBy: data.lockedBy ?? null,
            // campo opcional en Firestore para borrado lógico
            deleted: data.deleted === true,
            estado: data.estado || "ABIERTO",
            comentariosSupervisor: data.comentariosSupervisor || "",
            descripcion: data.descripcion || "",
            geometryType: data.geometryType || "individual",
            analysisContent: data.analysisContent || "",
            deadlineAt: data.deadlineAt || 0,
          } as ProjectWithCount;
        })
        .filter((p) => !p.deleted);
      setProjects(list);
    });
    return () => unsub();
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return;
    const db = getDb();
    const q = query(collection(db, "analyses"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          projectId: data.projectId as string,
          content: (data.content as string) ?? "",
          createdAt: (data.createdAt as number) ?? 0,
          createdBy: data.createdBy as string | undefined,
          attachedPhotos: (data.attachedPhotos as string[] | undefined) ?? [],
          reportEngineOutput: data.reportEngineOutput === true,
        };
      }).filter((analysis) => analysis.reportEngineOutput === true);
      setAllAnalyses(list);
    });
    return () => unsub();
  }, [loading, user]);

  const handleToggleDictation = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Este navegador no soporta dictado por voz. Use la versión de escritorio o Chrome/Android.");
      return;
    }

    try {
      if (isListening) {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
        return;
      }
      if (!recognitionRef.current) {
        const recognition = new SpeechRecognition();
        recognition.lang = "es-MX";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => { setIsListening(true); };
        recognition.onerror = (event: any) => {
          console.error("Error en micrófono:", event?.error);
          setIsListening(false);
        };
        recognition.onend = () => {
          setIsListening(false);
        };
        recognition.onresult = (event: any) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const text = (res[0]?.transcript as string | undefined)?.trim();
            if (!text) continue;
            if (res.isFinal) {
              finalTranscript += text + " ";
            }
          }
          if (finalTranscript) {
            const normalized = finalTranscript.trim();
            if (!normalized) return;
            if (normalized === lastTranscriptRef.current) return;
            lastTranscriptRef.current = normalized;
            setNombreInput((prev) => prev ? `${prev.trim()} ${normalized}` : normalized);
          }
        };
        recognitionRef.current = recognition;
      }
      const recognition = recognitionRef.current as any;
      lastTranscriptRef.current = "";
      recognition.start();
    } catch (e) {
      console.error("Error al iniciar reconocimiento de voz:", e);
      setIsListening(false);
    }
  };

  const handlePendingPhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newItems = Array.from(e.target.files).map(file => ({
        file,
        url: URL.createObjectURL(file)
      }));
      setPendingPhotos(prev => [...prev, ...newItems]);
    }
    e.target.value = "";
  };

  const removePendingPhoto = (index: number) => {
    setPendingPhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].url);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleNuevoProyecto = () => {
    setNombreInput("");
    pendingPhotos.forEach(p => URL.revokeObjectURL(p.url));
    setPendingPhotos([]);
    setShowPrompt(true);
  };

  const handleConfirmarNombre = async () => {
    const nombre = nombreInput.trim();
    if (!nombre || !user) return;
    try {
      if (pendingPhotos.length > 0) {
        (window as any).pendingProjectPhotos = pendingPhotos.map(p => p.file);
      }
      const newId = await createProject({
        nombre,
        geometryType,
        descripcion: "",
        latitude: null,
        longitude: null,
        locationSource: "UNKNOWN",
        analysisRadius: 500
      });
      pendingPhotos.forEach(p => URL.revokeObjectURL(p.url));
      setShowPrompt(false);
      setNombreInput("");
      setPendingPhotos([]);
      setGeometryType("individual");
      router.push(`/project/${newId}`);
    } catch (err: any) {
      delete (window as any).pendingProjectPhotos;
      console.error("Error creando proyecto:", err);
      alert("Error al crear expediente: " + err.message);
    }
  };

  const handleReassignProject = async (projectId: string, currentOwner: string | undefined) => {
    const newOwner = window.prompt("Administración: Ingrese el nombre de usuario al que desea asignar este expediente:", currentOwner || "");
    if (newOwner !== null && newOwner.trim() !== "" && newOwner.trim() !== currentOwner) {
      try {
        const firestore = getDb();
        await updateDoc(doc(firestore, "projects", projectId), {
          createdBy: newOwner.trim(),
          lockedBy: null // Asegura desbloquear el expediente para el nuevo dueño
        });
        window.alert(`Expediente reasignado exitosamente a ${newOwner.trim()}.`);
      } catch (err: any) {
        window.alert("Error al reasignar: " + err.message);
      }
    }
  };

  const handleExportFineTuningDataset = () => {
    const validados = projects.filter(p => p.estado === "VALIDADO" || p.estado === "CERRADO");
    if (validados.length === 0) {
      window.alert("No hay expedientes validados para exportar al dataset de entrenamiento.");
      return;
    }

    let jsonl = "";
    
    for (const p of validados) {
      const analysesForProject = allAnalyses.filter(a => a.projectId === p.id);
      if (analysesForProject.length === 0) continue;
      
      analysesForProject.sort((a, b) => b.createdAt - a.createdAt);
      const bestAnalysis = analysesForProject[0];
      
      const systemText = "Eres un Analista de Inteligencia y Criminólogo experto en Ecología Ambiental adscrito al Centro de Estudios y Política Criminal (CEIPOL). Redactas dictámenes técnicos EXHAUSTIVOS, PROFUNDOS Y SEVEROS denominados 'Perfil Criminológico Ambiental', empleando un lenguaje policial avanzado, táctico y objetivo. Fundamentas el análisis en la integración de Inteligencia de Fuentes Abiertas (OSINT), cartografía criminal y cuatro marcos: Actividades Rutinarias, Patrón Delictivo, Elección Racional y Teoría de Ventanas Rotas.";
      
      const userText = `Genera un Perfil Criminológico Ambiental.\nProyecto: ${p.name}\nGeometría: ${p.geometryType || "individual"}\nDirectriz u observaciones del investigador en campo:\n${p.descripcion || "Sin contexto adicional proporcionado."}`;
      
      const row = {
        systemInstruction: { role: "system", parts: [{ text: systemText }] },
        contents: [
          { role: "user", parts: [{ text: userText }] },
          { role: "model", parts: [{ text: bestAnalysis.content }] }
        ]
      };
      
      jsonl += JSON.stringify(row) + "\n";
    }

    if (!jsonl) {
      window.alert("No se encontraron análisis dentro de los expedientes validados.");
      return;
    }

    const blob = new Blob([jsonl], { type: "application/jsonl+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dataset_gemini_ceipol_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteProject = async (projectId: string) => {
    const projObj = projects.find(p => p.id === projectId);
    if (!projObj) return;

    try {
      // Proceder directamente con modal de eliminación lógica para enviarlo a la Papelera de Reciclaje
      setProjectToDelete(projObj);
      setDeleteReason("");
      setDeleteReasonCustom("");
      setDeleteModalOpen(true);
    } catch (err: any) {
      console.error("Error al preparar eliminación de expediente:", err);
      alert("Error al preparar eliminación de expediente: " + err.message);
    }
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    const finalReason = deleteReason === "Otro" ? deleteReasonCustom.trim() : deleteReason;
    if (!finalReason) {
      alert("Debe ingresar o seleccionar un motivo para la eliminación.");
      return;
    }

    try {
      await softDeleteDoc({
        type: "Proyecto",
        id: projectToDelete.id,
        reason: finalReason
      });
      setDeleteModalOpen(false);
      setProjectToDelete(null);
      setDeleteReason("");
      setDeleteReasonCustom("");
      alert("Expediente enviado a la papelera de reciclaje exitosamente.");
    } catch (err: any) {
      console.error("Error al eliminar expediente:", err);
      alert("Error al eliminar: " + err.message);
    }
  };

  const handleArchiveProject = (proj: ProjectWithCount) => {
    setProjectToArchive(proj);
    setArchiveReason("");
    setArchiveModalOpen(true);
  };

  const confirmArchiveProject = async () => {
    if (!projectToArchive) return;
    if (!archiveReason.trim()) {
      alert("Debe ingresar un motivo para archivar el expediente.");
      return;
    }
    try {
      await archiveProject(projectToArchive.id, archiveReason.trim());
      setArchiveModalOpen(false);
      setProjectToArchive(null);
      setArchiveReason("");
      alert("Expediente archivado exitosamente.");
    } catch (err: any) {
      console.error("Error al archivar expediente:", err);
      alert("Error al archivar: " + err.message);
    }
  };

  const handleReactivateProject = (proj: ProjectWithCount) => {
    setProjectToReactivate(proj);
    setReactivateReason("");
    setReactivateModalOpen(true);
  };

  const confirmReactivateProject = async () => {
    if (!projectToReactivate) return;
    if (!reactivateReason.trim()) {
      alert("Debe ingresar un motivo para reactivar el expediente.");
      return;
    }
    try {
      await reactivateProject(projectToReactivate.id, reactivateReason.trim());
      setReactivateModalOpen(false);
      setProjectToReactivate(null);
      setReactivateReason("");
      alert("Expediente reactivado exitosamente.");
    } catch (err: any) {
      console.error("Error al reactivar expediente:", err);
      alert("Error al reactivar: " + err.message);
    }
  };

  const handleRenameProject = (proj: ProjectWithCount) => {
    setProjectToRename(proj);
    setRenameInput(proj.name);
    setRenameModalOpen(true);
  };

  const confirmRenameProject = async () => {
    if (!projectToRename) return;
    if (!renameInput.trim()) {
      alert("Debe ingresar un nombre descriptivo válido.");
      return;
    }
    try {
      await renameProject(projectToRename.id, renameInput.trim());
      setRenameModalOpen(false);
      setProjectToRename(null);
      setRenameInput("");
      alert("Nombre del expediente modificado correctamente.");
    } catch (err: any) {
      console.error("Error al renombrar expediente:", err);
      alert("Error al renombrar: " + err.message);
    }
  };

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "EN REVISIÓN":
        return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">En Revisión</span>;
      case "CERRADO":
        return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Validado</span>;
      case "DEVUELTO":
        return <span className="bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Devuelto</span>;
      default:
        return <span className="bg-slate-500/20 text-slate-400 border border-slate-500/50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Abierto</span>;
    }
  };

  const handleOpenProject = (p: ProjectWithCount) => {
    const adminRole = (user as any)?.role === "SUPER_ADMIN" || (user as any)?.role === "ADMIN";
    if (!adminRole && (p.estado === "EN REVISIÓN" || p.estado === "CERRADO" || p.estado === "VALIDADO")) {
      alert(`El expediente se encuentra en estado: ${p.estado}. No es posible modificarlo en este momento.`);
      return;
    }
    if (p.estado === "DEVUELTO") {
      setDevueltoProject(p);
      return;
    }
    router.push(`/project/${p.id}`);
  };

  const list = projects ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-400">
        Verificando sesión…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAdmin = (user as any)?.role === "SUPERADMIN" || (user as any)?.role === "SUPER_ADMIN" || (user as any)?.role === "ADMIN";
  const devueltosPropios = list.filter(p => p.estado === "DEVUELTO" && p.createdBy === (user as any)?.username);
  const enRevisionAdmin = list.filter(p => p.estado === "EN REVISIÓN");
  
  const expedientesUrgentes = devueltosPropios.filter(p => p.deadlineAt && (p.deadlineAt - Date.now()) <= (5 * 60 * 60 * 1000) && (p.deadlineAt - Date.now()) > 0);
  const expedientesVencidos = devueltosPropios.filter(p => p.deadlineAt && (p.deadlineAt - Date.now()) <= 0);

  const filteredList = list.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.estado || "ABIERTO").toLowerCase().includes(term) ||
      (p.createdBy || "").toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE) || 1;
  const paginatedList = filteredList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Cálculos para la gráfica de distribución de estatus
  const stats = {
    abiertos: list.filter(p => !p.estado || p.estado === "ABIERTO").length,
    enRevision: list.filter(p => p.estado === "EN REVISIÓN").length,
    enAuditoria: list.filter(p => p.estado === "EN AUDITORÍA").length,
    devueltos: list.filter(p => p.estado === "DEVUELTO").length,
    validados: list.filter(p => p.estado === "CERRADO" || p.estado === "VALIDADO").length,
    total: list.length
  };

  const pAbiertos = stats.total > 0 ? (stats.abiertos / stats.total) * 100 : 0;
  const pRevision = stats.total > 0 ? (stats.enRevision / stats.total) * 100 : 0;
  const pAuditoria = stats.total > 0 ? (stats.enAuditoria / stats.total) * 100 : 0;
  const pDevueltos = stats.total > 0 ? (stats.devueltos / stats.total) * 100 : 0;
  const g1 = pAbiertos; const g2 = g1 + pRevision; const g3 = g2 + pAuditoria; const g4 = g3 + pDevueltos;
  
  const chartStyle = { background: `conic-gradient(#64748b 0% ${g1}%, #3b82f6 ${g1}% ${g2}%, #a855f7 ${g2}% ${g3}%, #ef4444 ${g3}% ${g4}%, #10b981 ${g4}% 100%)` };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
          Mis Expedientes
        </h2>
        <p className="text-sm text-slate-400 max-w-2xl">
          Lobby de expedientes en la nube. Puedes crear nuevos o revisar los que están en proceso de auditoría.
        </p>
      </header>

      {list.length > 0 && !showPrompt && (
        <CEIPOLCard
          variant="default"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/40 border border-slate-800 rounded-xl p-6 shadow-lg"
        >
          <div className="col-span-1 flex items-center justify-center relative">
            <div className="w-32 h-32 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:scale-105" style={chartStyle}>
              <div className="w-24 h-24 bg-slate-900 rounded-full flex flex-col items-center justify-center shadow-inner">
                <span className="text-2xl font-bold text-slate-100">{stats.total}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest">Total</span>
              </div>
            </div>
          </div>
          <div className="col-span-1 md:col-span-2 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 border-b border-slate-700/50 pb-2">Distribución Global de Expedientes</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-slate-500 shadow-sm"></span><span className="text-slate-300">Abiertos: <span className="font-bold text-slate-100">{stats.abiertos}</span></span></div>
              <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></span><span className="text-slate-300">En Revisión: <span className="font-bold text-slate-100">{stats.enRevision}</span></span></div>
              <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-purple-500 shadow-sm"></span><span className="text-slate-300">En Auditoría: <span className="font-bold text-slate-100">{stats.enAuditoria}</span></span></div>
              <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></span><span className="text-slate-300">Devueltos: <span className="font-bold text-slate-100">{stats.devueltos}</span></span></div>
              <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></span><span className="text-slate-300">Validados: <span className="font-bold text-slate-100">{stats.validados}</span></span></div>
            </div>
          </div>
        </CEIPOLCard>
      )}

      {devueltosPropios.length > 0 && !showPrompt && (
        <div className="flex flex-col gap-4">
          {expedientesVencidos.length > 0 && (
            <div className="bg-red-900/60 border border-red-700 border-l-4 border-l-red-500 p-4 rounded-lg shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">❌</span>
                <h3 className="text-red-300 font-bold text-sm">¡Término Vencido!</h3>
              </div>
              <p className="text-xs text-red-100 ml-8">
                Tienes {expedientesVencidos.length} expediente(s) cuyo término para subsanar observaciones ha expirado. Comunícate con tu supervisor.
              </p>
            </div>
          )}
          {expedientesUrgentes.length > 0 && (
            <div className="bg-orange-950/60 border border-orange-700 border-l-4 border-l-orange-500 p-4 rounded-lg shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg animate-pulse">⏳</span>
                <h3 className="text-orange-400 font-bold text-sm">¡Alerta de Término! &lt; 5 horas restantes</h3>
              </div>
              <p className="text-xs text-orange-200 ml-8">
                Tienes {expedientesUrgentes.length} expediente(s) devuelto(s) próximos a vencer. Ingresa inmediatamente para subsanar las observaciones.
              </p>
            </div>
          )}
          <div className="bg-red-950/30 border border-red-900/50 border-l-4 border-l-red-500/50 p-4 rounded-lg shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">⚠️</span>
              <h3 className="text-red-400 font-bold text-sm">Tienes {devueltosPropios.length} expediente(s) devuelto(s) en total</h3>
            </div>
            <p className="text-xs text-red-200/80 ml-8">
              Abre el expediente con la etiqueta roja &quot;Devuelto&quot;, lee los comentarios y subsánalos antes de que finalice el término.
            </p>
          </div>
        </div>
      )}

      {isAdmin && enRevisionAdmin.length > 0 && !showPrompt && (
        <div className="bg-blue-950/40 border border-blue-900 border-l-4 border-l-blue-500 p-4 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg animate-pulse">📋</span>
            <h3 className="text-blue-400 font-bold text-sm">Auditoría Pendiente: {enRevisionAdmin.length} expediente(s) en revisión</h3>
          </div>
          <p className="text-xs text-blue-200 ml-8">
            Los analistas han enviado expedientes. Ábrelos para iniciar la auditoría, validarlos o devolverlos.
          </p>
        </div>
      )}

      {!showPrompt ? (
        <>
          <div className="flex flex-col sm:flex-row flex-wrap justify-between gap-4 mb-2">
            <div className="relative w-full sm:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                🔍
              </span>
              <input
                type="text"
                spellCheck={true}
                placeholder="Buscar expediente, estado o analista..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors shadow-inner"
              />
            </div>
            <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept=".json"
              className="sr-only"
              ref={fileInputRef}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !user) return;
                const btn = document.getElementById("btn-importar");
                if (btn) btn.innerText = "⏳ Importando...";
                await importProjectData(file, user.username).then(() => alert("¡Expediente importado exitosamente!")).catch(err => alert("Error importando: " + err.message));
                if (btn) btn.innerText = "📥 Importar desde Campo";
                e.target.value = "";
              }}
            />
            <CEIPOLButton
              id="btn-importar"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              📥 Importar desde Campo
            </CEIPOLButton>
            {isAdmin && (
              <CEIPOLButton
                variant="primary"
                onClick={handleExportFineTuningDataset}
                className="from-purple-900/50 to-indigo-900/50 hover:from-purple-800/50 hover:to-indigo-800/50 border-purple-800/20"
                title="Exportar dictámenes validados para entrenar a Vertex AI"
              >
                🧠 Exportar Dataset ML
              </CEIPOLButton>
            )}
            <CEIPOLButton
              variant="primary"
              onClick={handleNuevoProyecto}
            >
              Nuevo Proyecto
            </CEIPOLButton>
          </div>
          </div>

          {filteredList.length === 0 ? (
            <CEIPOLCard
              variant="default"
              className="p-8 text-center text-slate-400"
            >
              <p className="text-sm">No se encontraron expedientes con esos criterios.</p>
              <p className="text-xs mt-1">Cree un proyecto nuevo o modifique su búsqueda.</p>
              <CEIPOLButton
                variant="ghost"
                onClick={handleNuevoProyecto}
                className="mt-4 text-cyan-400 hover:text-cyan-300 mx-auto"
              >
                Crear primer proyecto
              </CEIPOLButton>
            </CEIPOLCard>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedList.map((p) => {
                const analysesForProject = allAnalyses.filter(
                  (a) => a.projectId === p.id
                );
                const photosFromAnalyses = analysesForProject.reduce(
                  (acc, a: any) =>
                    acc +
                    (((a.attachedPhotos as string[] | undefined)?.length ??
                      0) as number),
                  0
                );
            const photoCountDisplay = Math.max(p.photoCount, photosFromAnalyses);
                return (
                  <li key={p.id} className="h-full">
                    <CEIPOLCard
                      variant="analysis"
                      className="flex flex-col h-full bg-slate-900/40 border border-slate-800 hover:border-slate-600 hover:shadow-xl hover:shadow-sky-900/10 transition-all overflow-hidden !p-0"
                    >
                    <div className="p-5 flex flex-col flex-1 gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-base font-bold text-slate-100 truncate" title={p.name}>
                            {p.name}
                          </h3>
                          {getStatusBadge(p.estado || "ABIERTO")}
                        </div>
                          <p className="text-xs text-slate-400 flex items-center gap-1.5">
                            <span aria-hidden="true">📅</span>
                        {new Date(p.createdAt).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                          <p className="text-xs text-slate-400 flex items-center gap-1.5">
                            <span aria-hidden="true">📸</span>
                        {photoCountDisplay}{" "}
                        {photoCountDisplay === 1 ? "foto" : "fotos"}
                      </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                            <span aria-hidden="true">👤</span>
                        Creado por:{" "}
                        <span className="font-medium text-slate-300">
                          {p.createdBy ?? "Desconocido"}
                        </span>
                      </p>
                      </div>
                      </div>

                      <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
                        {(!p.estado || p.estado === "ABIERTO" || p.estado === "DEVUELTO") && (
                        <CEIPOLButton
                          variant="ghost"
                          size="sm"
                          onClick={() => void exportProjectData(p.id)}
                          title="Descargar archivo para enviarlo a Gabinete"
                          className="!p-2 text-xs text-amber-400 hover:text-amber-300"
                        >
                          📤 Exportar
                        </CEIPOLButton>
                        )}
                        {(!p.estado || p.estado === "ABIERTO" || p.estado === "DEVUELTO") && (
                        <CEIPOLButton
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDeleteProject(p.id)}
                          className="!p-2 text-xs text-red-400 hover:text-red-300"
                        >
                          🗑️ Eliminar
                        </CEIPOLButton>
                        )}
                        {(!p.estado || p.estado === "ABIERTO" || p.estado === "DEVUELTO") && (
                        <CEIPOLButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRenameProject(p)}
                          title="Cambiar el nombre del expediente"
                          className="!p-2 text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          ✏️ Renombrar
                        </CEIPOLButton>
                        )}
                        {(!p.estado || p.estado === "ABIERTO" || p.estado === "DEVUELTO") && (
                        <CEIPOLButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchiveProject(p)}
                          title="Archivar este expediente"
                          className="!p-2 text-xs text-amber-500 hover:text-amber-400"
                        >
                          📦 Archivar
                        </CEIPOLButton>
                        )}
                        {p.estado === "ARCHIVADO" && (
                        <CEIPOLButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReactivateProject(p)}
                          title="Reactivar este expediente archivado"
                          className="!p-2 text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          🔄 Reactivar
                        </CEIPOLButton>
                        )}
                        {isAdmin && (
                          <CEIPOLButton
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleReassignProject(p.id, p.createdBy)}
                            className="!p-2 text-xs text-cyan-400 hover:text-cyan-300"
                            title="Reasignar expediente a otro analista"
                          >
                            🔄 Reasignar
                          </CEIPOLButton>
                        )}
                        <CEIPOLButton
                          variant={p.estado === "EN REVISIÓN" || p.estado === "CERRADO" ? "secondary" : "primary"}
                          onClick={() => handleOpenProject(p)}
                          className="flex-1 text-sm py-2"
                        >
                          {p.estado === "EN REVISIÓN" ? "En Revisión" : p.estado === "CERRADO" ? "Validado" : "Abrir Proyecto"}
                        </CEIPOLButton>
                      </div>
                    </div>
                    <div className="bg-slate-900/80 p-4 border-t border-slate-800/80">
                      {analysesForProject.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">
                          Sin dictamen oficial generado aún.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {analysesForProject.slice(0, 3).map((a: any) => (
                            <div
                              key={a.id}
                              className="bg-slate-800/40 p-3 rounded-md border border-slate-700/50 flex flex-col gap-2"
                            >
                              <p className="text-[11px] text-sky-400 font-semibold">
                                {new Date(a.createdAt).toLocaleString("es-MX", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                · Generado por:{" "}
                                <span className="text-slate-100">
                                  {a.createdBy || "Usuario no identificado"}
                                </span>
                              </p>
                              <p className="text-xs text-slate-300 line-clamp-2">
                                {a.content.length > 120
                                  ? `${a.content.substring(0, 120)}…`
                                  : a.content}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <CEIPOLButton
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    router.push(`/project/${p.id}`);
                                  }}
                                  className="!text-[10px] !py-1 !px-2.5"
                                >
                                  Vista previa
                                </CEIPOLButton>
                                <CEIPOLButton
                                  variant="primary"
                                  size="sm"
                                  onClick={() => void handleOpenPreview(p, a)}
                                  className="!text-[10px] !py-1 !px-2.5 from-blue-900/40 to-indigo-900/40 border border-blue-700/30 text-blue-300 hover:text-white"
                                >
                                  👁️ Vista Previa y Evidencia
                                </CEIPOLButton>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    </CEIPOLCard>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8 pb-4">
              <CEIPOLButton
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ← Anterior
              </CEIPOLButton>
              <span className="text-sm text-slate-400 font-medium">
                Página <span className="text-slate-200">{currentPage}</span> de <span className="text-slate-200">{totalPages}</span>
              </span>
              <CEIPOLButton
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Siguiente →
              </CEIPOLButton>
            </div>
          )}
        </>
      ) : (
        <div className="card p-6 space-y-4 max-w-6xl w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Columna Izquierda: Identificación del Proyecto */}
            <div className="space-y-4">
              <label className="block">
                <div className="flex items-center justify-between mb-1">
                  <span className="block text-sm font-medium text-slate-200">
                    Nombre del Proyecto
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleDictation}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold border ${
                      isListening
                        ? "border-red-500 text-red-300 bg-red-900/40"
                        : "border-slate-600 text-slate-200 bg-slate-900"
                    }`}
                  >
                    <span aria-hidden="true">🎙️</span>
                    <span>{isListening ? "Detener" : "Dictar"}</span>
                  </button>
                </div>
                <input
                  type="text"
                  spellCheck={true}
                  value={nombreInput}
                  onChange={(e) => setNombreInput(e.target.value)}
                  placeholder="Ej. Diagnóstico Polígono VNSA"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </label>

              <div className="geometry-selector">
                <span className="block text-sm font-medium text-slate-200 mb-2">Tipo de geometría operacional</span>
                <div className="flex flex-col gap-2.5 text-sm text-slate-300 bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                    <input
                      type="radio"
                      name="geometryType"
                      value="individual"
                      checked={geometryType === "individual"}
                      onChange={() => setGeometryType("individual")}
                      className="text-sky-500 focus:ring-sky-500 bg-slate-900 border-slate-700"
                    />{" "}
                    Individual (Punto + Radio operacional)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                    <input
                      type="radio"
                      name="geometryType"
                      value="lineal"
                      checked={geometryType === "lineal"}
                      onChange={() => setGeometryType("lineal")}
                      className="text-sky-500 focus:ring-sky-500 bg-slate-900 border-slate-700"
                    />{" "}
                    Lineal (Rutas de patrullaje / Proyecciones)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                    <input
                      type="radio"
                      name="geometryType"
                      value="poligono"
                      checked={geometryType === "poligono"}
                      onChange={() => setGeometryType("poligono")}
                      className="text-sky-500 focus:ring-sky-500 bg-slate-900 border-slate-700"
                    />{" "}
                    Polígono (Áreas de interés / Zonas calientes)
                  </label>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Evidencia y Multimedia */}
            <div className="space-y-4">
              <div>
                <span className="block text-sm font-medium text-slate-200 mb-2">Captura de fotografías in-situ (Opcional en este paso)</span>
                <div className="flex gap-3">
                  <label className="flex-1 text-center cursor-pointer rounded-lg border border-emerald-600 bg-emerald-900/30 text-emerald-100 py-2.5 text-sm font-semibold hover:bg-emerald-800/50 shadow-md transition-colors flex items-center justify-center gap-2">
                    📷 Usar Cámara
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={handlePendingPhotosChange}
                    />
                  </label>
                  <label className="flex-1 text-center cursor-pointer rounded-lg border border-sky-600 bg-sky-900/30 text-sky-100 py-2.5 text-sm font-semibold hover:bg-sky-800/50 shadow-md transition-colors flex items-center justify-center gap-2">
                    📸 Usar Galería
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={handlePendingPhotosChange}
                    />
                  </label>
                </div>
              </div>

              {pendingPhotos.length > 0 && (
                <div className="bg-slate-950/30 p-3 rounded-lg border border-slate-800">
                  <p className="text-xs text-emerald-400 mb-2 font-medium">✓ {pendingPhotos.length} fotografía(s) seleccionada(s) lista(s) para ser ingresada(s).</p>
                  <div className="grid grid-cols-4 gap-2 max-h-[140px] overflow-y-auto pr-1">
                    {pendingPhotos.map((item, idx) => (
                      <div key={idx} className="relative group rounded-md overflow-hidden border border-slate-700 aspect-square bg-slate-800 flex items-center justify-center shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={item.url} 
                          alt="Preview" 
                          className="object-cover w-full h-full"
                        />
                        <button
                          type="button"
                          onClick={() => removePendingPhoto(idx)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-90 hover:opacity-100 shadow-md"
                          title="Borrar fotografía"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => void handleConfirmarNombre()}
              disabled={!nombreInput.trim()}
              className="btn-primary flex-1 py-2.5 text-sm font-semibold"
            >
              Crear e ingresar
            </button>
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              className="px-4 py-2.5 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800 font-semibold transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {devueltoProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" className="cursor-anchored-dialog bg-slate-900 border border-red-900 rounded-xl max-w-4xl w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-red-500 mb-2">Expediente Devuelto</h3>
            <p className="text-sm text-slate-300 mb-4">
              Tu supervisor ha devuelto este expediente con las siguientes observaciones. Corrige los puntos señalados y vuelve a enviarlo a revisión.
            </p>
            <div className="bg-red-950/30 border border-red-900 p-4 rounded-md mb-6 max-h-48 overflow-y-auto">
              <p className="text-sm text-red-200 whitespace-pre-wrap">{devueltoProject.comentariosSupervisor}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDevueltoProject(null)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancelar</button>
              <button onClick={() => {
                const id = devueltoProject.id;
                setDevueltoProject(null);
                router.push(`/project/${id}`);
              }} className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded shadow-lg transition-colors">Entendido, corregir expediente</button>
            </div>
          </div>
        </div>
      )}

      {renameModalOpen && projectToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" className="cursor-anchored-dialog bg-slate-950/95 backdrop-blur-md border border-slate-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
              ✏️ Modificar Nombre de Expediente
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
              Cambia el nombre de identificación de este expediente. Se guardará de manera permanente en los registros.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nuevo Nombre:</label>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 rounded-xl p-2.5 text-sm text-slate-100 outline-none transition-all"
                  placeholder="Ej. Aguascalientes Operativo Norte"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <CEIPOLButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRenameModalOpen(false);
                  setProjectToRename(null);
                  setRenameInput("");
                }}
              >
                Cancelar
              </CEIPOLButton>
              <CEIPOLButton
                variant="confirm"
                size="sm"
                onClick={confirmRenameProject}
                disabled={!renameInput.trim()}
              >
                Guardar Cambios
              </CEIPOLButton>
            </div>
          </div>
        </div>
      )}

      {archiveModalOpen && projectToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" className="cursor-anchored-dialog bg-slate-950/95 backdrop-blur-md border border-slate-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-amber-500 mb-2 flex items-center gap-2">
              📦 Archivar Expediente
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
              ¿Estás seguro de que deseas archivar este expediente? Esto cambiará su estado a ARCHIVADO.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Motivo del Archivado:</label>
                <textarea
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 rounded-xl p-2.5 text-sm text-slate-100 outline-none resize-none transition-all"
                  placeholder="Escribe el motivo por el cual archivas este expediente..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <CEIPOLButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setArchiveModalOpen(false);
                  setProjectToArchive(null);
                  setArchiveReason("");
                }}
              >
                Cancelar
              </CEIPOLButton>
              <CEIPOLButton
                variant="warning"
                size="sm"
                onClick={confirmArchiveProject}
                disabled={!archiveReason.trim()}
              >
                Archivar Expediente
              </CEIPOLButton>
            </div>
          </div>
        </div>
      )}

      {reactivateModalOpen && projectToReactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" className="cursor-anchored-dialog bg-slate-950/95 backdrop-blur-md border border-slate-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-emerald-500 mb-2 flex items-center gap-2">
              🔄 Reactivar Expediente
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
              ¿Deseas reactivar este expediente archivado? Volverá a estar ABIERTO para edición.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Motivo de la Reactivación:</label>
                <textarea
                  value={reactivateReason}
                  onChange={(e) => setReactivateReason(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 rounded-xl p-2.5 text-sm text-slate-100 outline-none resize-none transition-all"
                  placeholder="Escribe el motivo de la reactivación..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <CEIPOLButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setReactivateModalOpen(false);
                  setProjectToReactivate(null);
                  setReactivateReason("");
                }}
              >
                Cancelar
              </CEIPOLButton>
              <CEIPOLButton
                variant="confirm"
                size="sm"
                onClick={confirmReactivateProject}
                disabled={!reactivateReason.trim()}
              >
                Reactivar Expediente
              </CEIPOLButton>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" className="cursor-anchored-dialog bg-slate-950/95 backdrop-blur-md border border-slate-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2">
              🗑️ Enviar Expediente a Papelera
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
              ¿Estás seguro de que deseas eliminar este expediente? Se moverá de manera lógica a la Papelera de Reciclaje de conformidad con la cadena de custodia digital y gobernanza de la información.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Motivo de la Eliminación:</label>
                <select
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 rounded-xl p-2.5 text-sm text-slate-100 outline-none mb-3 cursor-pointer transition-all"
                >
                  <option value="">-- Selecciona un motivo --</option>
                  <option value="Error en captura de datos">Error en captura de datos</option>
                  <option value="Duplicado de expediente">Duplicado de expediente</option>
                  <option value="Cancelación de orden operativa">Cancelación de orden de operativo</option>
                  <option value="Otro">Otro (Especificar motivo personalizado)</option>
                </select>

                {deleteReason === "Otro" && (
                  <textarea
                    value={deleteReasonCustom}
                    onChange={(e) => setDeleteReasonCustom(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 rounded-xl p-2.5 text-sm text-slate-100 outline-none resize-none transition-all"
                    placeholder="Describe detalladamente el motivo institucional para eliminar este expediente..."
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <CEIPOLButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setProjectToDelete(null);
                  setDeleteReason("");
                  setDeleteReasonCustom("");
                }}
              >
                Cancelar
              </CEIPOLButton>
              <CEIPOLButton
                variant="danger"
                size="sm"
                onClick={confirmDeleteProject}
                disabled={!deleteReason || (deleteReason === "Otro" && !deleteReasonCustom.trim())}
              >
                Enviar a Papelera
              </CEIPOLButton>
            </div>
          </div>
        </div>
      )}

      {previewModalOpen && selectedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-8">
          <div role="dialog" aria-modal="true" className="cursor-anchored-dialog w-full h-full max-w-[98vw] 2xl:max-w-none bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-2xl overflow-y-auto relative flex flex-col">
            <button
              type="button"
              onClick={() => setPreviewModalOpen(false)}
              className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200 h-8 w-8 text-sm"
              aria-label="Cerrar vista previa"
            >
              ✕
            </button>

            <div className="flex flex-col gap-6">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-gray-200 mb-4">
                  {selectedPreview.title}
                </h3>
                <div className="text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">
                  {selectedPreview.content}
                </div>
              </div>

              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-400 mt-8 mb-4 border-b border-gray-700 pb-2">
                  Álbum de Evidencia Fotográfica
                </h3>
                {Array.isArray(selectedPreview.photos) &&
                  selectedPreview.photos.length > 0 ? (
                  <div className="flex flex-col gap-6">
                    {selectedPreview.photos.map(
                      (src: string, idx: number) => (
                        <div
                          key={`${src}-${idx}`}
                    className="w-full h-auto rounded-lg overflow-hidden border border-gray-700 shadow-md bg-black relative flex items-center justify-center"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={`Evidencia ${idx + 1}`}
                      className="object-contain w-full h-auto max-h-[70vh]"
                          />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10">
                      <span className="text-white/40 font-bold text-4xl sm:text-7xl -rotate-45 select-none tracking-widest drop-shadow-lg">
                              SSPE-CEIPOL
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    No se encontró evidencia fotográfica para este análisis.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
