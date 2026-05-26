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
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { exportToWord } from "@/lib/exportToWord";

type ProjectWithCount = {
  id: string;
  name: string;
  createdAt: number;
  photoCount: number;
  createdBy?: string;
  lockedBy?: string | null;
  estado?: string;
  comentariosSupervisor?: string;
};

export function ProjectList() {
  const router = useRouter();
  const { exportProjectData, importProjectData } = useProject();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [nombreInput, setNombreInput] = useState("");
  const [descripcionInput, setDescripcionInput] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [geometryType, setGeometryType] = useState<"individual" | "lineal" | "poligono">("individual");
  const [isListening, setIsListening] = useState(false);
  const [listeningTarget, setListeningTarget] = useState<string>("descripcion");
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
    }[]
  >([]);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<any>(null);
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

  const handleDownloadDictamen = async (project: ProjectWithCount, analysis: { content: string; attachedPhotos?: string[] }) => {
    try {
      window.alert("Generando el dictamen oficial en Word. Esto puede tardar unos segundos dependiendo de las imágenes...");
      let photos = Array.isArray(analysis?.attachedPhotos) ? analysis.attachedPhotos : [];
      if (!photos.length) {
        const firestore = getDb();
        const photosCol = collection(firestore, "projects", project.id, "photos");
        const snap = await getDocs(photosCol);
        photos = snap.docs.map((d) => d.data().url);
      }
      await exportToWord(analysis.content || "", project.name, photos);
    } catch (err) {
      console.error("Error exportando a Word:", err);
      window.alert("Ocurrió un error al generar el documento Word.");
    }
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
          } as ProjectWithCount & { deleted?: boolean };
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
        };
      });
      setAllAnalyses(list);
    });
    return () => unsub();
  }, [loading, user]);

  const handleToggleDictation = (target: string) => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Este navegador no soporta dictado por voz. Use la versión de escritorio o Chrome/Android.");
      return;
    }

    try {
      if (isListening && listeningTarget === target) {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
        return;
      }
      if (isListening) {
        if (recognitionRef.current) recognitionRef.current.stop();
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
            if (listeningTarget === "nombre") {
              setNombreInput((prev) => prev ? `${prev.trim()} ${normalized}` : normalized);
            } else {
              setDescripcionInput((prev) => prev ? `${prev.trim()} ${normalized}` : normalized);
            }
          }
        };
        recognitionRef.current = recognition;
      }
      const recognition = recognitionRef.current as any;
      setListeningTarget(target);
      lastTranscriptRef.current = "";
      recognition.start();
    } catch (e) {
      console.error("Error al iniciar reconocimiento de voz:", e);
      setIsListening(false);
    }
  };

  const handleNuevoProyecto = () => {
    setNombreInput("");
    setDescripcionInput("");
    setShowPrompt(true);
  };

  const handleConfirmarNombre = async () => {
    const nombre = nombreInput.trim();
    if (!nombre || !user) return;
    const firestore = getDb();
    const col = collection(firestore, "projects");
    const createdAt = Date.now();
    try {
      const ref = await import("firebase/firestore").then(({ addDoc }) =>
        addDoc(col, {
          name: nombre,
          geometryType,
          descripcion: descripcionInput,
          createdAt,
          createdBy: user.username,
          lockedBy: null,
          photoCount: 0,
          estado: "ABIERTO",
        })
      );
      setShowPrompt(false);
      setNombreInput("");
      setDescripcionInput("");
      setGeometryType("individual");
      router.push(`/project/${ref.id}`);
    } catch (err: any) {
      console.error("Error creando proyecto:", err);
      alert("Error al crear expediente: " + err.message);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const firstConfirm = window.confirm(
      "Advertencia 1/2: Está a punto de ELIMINAR por completo este expediente y su evidencia asociada (fotos y análisis locales). ¿Desea continuar?"
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      "Confirmación final 2/2: Esta acción es irreversible. El expediente dejará de aparecer en la lista y se eliminarán sus datos locales. ¿CONFIRMA la eliminación definitiva?"
    );
    if (!secondConfirm) return;

    try {
      const firestore = getDb();

      // Eliminar documento del proyecto en Firestore
      const projectRef = doc(firestore, "projects", projectId);
      await deleteDoc(projectRef);

      // Eliminar análisis en Firestore vinculados a este proyecto (colección 'analyses')
      const analysesCol = collection(firestore, "analyses");
      const analysesSnap = await getDocs(
        query(analysesCol, where("projectId", "==", projectId))
      );
      const deletePromises: Promise<void>[] = [];
      analysesSnap.forEach((d) => {
        deletePromises.push(deleteDoc(d.ref));
      });
      const photosCol = collection(firestore, "projects", projectId, "photos");
      const photosSnap = await getDocs(photosCol);
      photosSnap.forEach((d) => {
        deletePromises.push(deleteDoc(d.ref));
      });
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }
    } catch (err) {
      console.error(
        "[ProjectList] Error al eliminar expediente y su evidencia:",
        err
      );
      window.alert(
        "Ocurrió un error al eliminar el expediente. Revise la consola o intente de nuevo."
      );
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
    if (p.estado === "EN REVISIÓN" || p.estado === "CERRADO") {
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/40 border border-slate-800 rounded-xl p-6 shadow-lg">
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
        </div>
      )}

      {devueltosPropios.length > 0 && !showPrompt && (
        <div className="bg-red-950/40 border border-red-900 border-l-4 border-l-red-500 p-4 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg animate-pulse">⚠️</span>
            <h3 className="text-red-400 font-bold text-sm">¡Acción Requerida! Tienes {devueltosPropios.length} expediente(s) devuelto(s)</h3>
          </div>
          <p className="text-xs text-red-200 ml-8">
            Tienes observaciones de auditoría pendientes. Abre el expediente con la etiqueta roja "Devuelto", lee los comentarios y subsánalos.
          </p>
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
              className="hidden"
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
            <button
              id="btn-importar"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition-colors shadow-md"
            >
              📥 Importar desde Campo
            </button>
            <button
              type="button"
              onClick={handleNuevoProyecto}
              className="btn-primary text-sm px-4 py-2"
            >
              Nuevo Proyecto
            </button>
          </div>
          </div>

          {filteredList.length === 0 ? (
            <div className="card p-8 text-center text-slate-400">
              <p className="text-sm">No se encontraron expedientes con esos criterios.</p>
              <p className="text-xs mt-1">Cree un proyecto nuevo o modifique su búsqueda.</p>
              <button
                type="button"
                onClick={handleNuevoProyecto}
                className="mt-4 text-sky-400 hover:text-sky-300 text-sm font-medium"
              >
                Crear primer proyecto
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
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
                  <li
                    key={p.id}
                    className="card flex flex-col h-full bg-slate-900/40 border border-slate-800 hover:border-slate-600 hover:shadow-xl hover:shadow-sky-900/10 transition-all overflow-hidden"
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
                        <button
                          type="button"
                          onClick={() => void exportProjectData(p.id)}
                          title="Descargar archivo para enviarlo a Gabinete"
                          className="p-2 rounded text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-900/30 transition-colors border border-transparent hover:border-amber-700/50"
                        >
                          📤 Exportar
                        </button>
                        )}
                        {(!p.estado || p.estado === "ABIERTO" || p.estado === "DEVUELTO") && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteProject(p.id)}
                          className="p-2 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors"
                        >
                          🗑️ Eliminar
                        </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenProject(p)}
                          className={`flex-1 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors shadow-md ${p.estado === "EN REVISIÓN" || p.estado === "CERRADO" ? "bg-slate-700 hover:bg-slate-600" : "bg-sky-600 hover:bg-sky-500"}`}
                        >
                          {p.estado === "EN REVISIÓN" ? "En Revisión" : p.estado === "CERRADO" ? "Validado" : "Abrir Proyecto"}
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-900/80 p-4 border-t border-slate-800/80">
                      {analysesForProject.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">
                          Sin análisis generados aún.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {analysesForProject.slice(0, 3).map((a) => (
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
                                <button
                                  type="button"
                                  onClick={() => {
                                    router.push(`/project/${p.id}`);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-700 transition-colors"
                                >
                                  Vista previa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleOpenPreview(p, a)}
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-900/40 text-blue-300 hover:bg-blue-800/50 border border-blue-700/50 px-3 py-1 text-[11px] font-semibold transition-colors"
                                >
                                  👁️ Vista Previa y Evidencia
                                </button>
                                {p.estado === "CERRADO" && (
                                  <button
                                    type="button"
                                    onClick={() => void handleDownloadDictamen(p, a)}
                                    className="inline-flex items-center gap-1 rounded-md bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/50 border border-emerald-700/50 px-3 py-1 text-[11px] font-semibold transition-colors"
                                  >
                                    📄 Descargar Dictamen Oficial
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8 pb-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 hover:text-white text-sm font-semibold transition-colors shadow-sm"
              >
                ← Anterior
              </button>
              <span className="text-sm text-slate-400 font-medium">
                Página <span className="text-slate-200">{currentPage}</span> de <span className="text-slate-200">{totalPages}</span>
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 hover:text-white text-sm font-semibold transition-colors shadow-sm"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="card p-6 space-y-4 max-w-md">
          <label className="block">
        <div className="flex items-center justify-between mb-1">
          <span className="block text-sm font-medium text-slate-200">
            Nombre del Proyecto
          </span>
          <button
            type="button"
            onClick={() => handleToggleDictation("nombre")}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold border ${
              isListening && listeningTarget === "nombre"
                ? "border-red-500 text-red-300 bg-red-900/40"
                : "border-slate-600 text-slate-200 bg-slate-900"
            }`}
          >
            <span aria-hidden="true">🎙️</span>
            <span>{isListening && listeningTarget === "nombre" ? "Detener" : "Dictar"}</span>
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

        <div className="geometry-selector mt-2 mb-4">
          <span className="block text-sm font-medium text-slate-200 mb-1">Tipo de geometría operacional</span>
          <div className="flex flex-col gap-2 text-sm text-slate-300">
            <label>
              <input
                type="radio"
                name="geometryType"
                value="individual"
                checked={geometryType === "individual"}
                onChange={() => setGeometryType("individual")}
              />{" "}
              Individual
            </label>
            <label>
              <input
                type="radio"
                name="geometryType"
                value="lineal"
                checked={geometryType === "lineal"}
                onChange={() => setGeometryType("lineal")}
              />{" "}
              Lineal
            </label>
            <label>
              <input
                type="radio"
                name="geometryType"
                value="poligono"
                checked={geometryType === "poligono"}
                onChange={() => setGeometryType("poligono")}
              />{" "}
              Polígono
            </label>
          </div>
        </div>

          <div className="mt-2 mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="block text-sm font-medium text-slate-200">Explicación del Proyecto</span>
              <button
                type="button"
            onClick={() => handleToggleDictation("descripcion")}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold border ${
              isListening && listeningTarget === "descripcion"
                    ? "border-red-500 text-red-300 bg-red-900/40"
                    : "border-slate-600 text-slate-200 bg-slate-900"
                }`}
              >
                <span aria-hidden="true">🎙️</span>
            <span>{isListening && listeningTarget === "descripcion" ? "Detener grabación" : "Grabar explicación"}</span>
              </button>
            </div>
            <textarea
              spellCheck={true}
              value={descripcionInput}
              onChange={(e) => setDescripcionInput(e.target.value)}
              placeholder="Describa el contexto, hipótesis o detalles relevantes. La transcripción aparecerá aquí..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[80px]"
            />
            <div className="mt-2">
              <div className="flex justify-between items-center text-[10px] mb-1">
                <span className="text-slate-400">Idoneidad del contexto (Semáforo):</span>
                <span className={`font-bold ${descripcionInput.length < 20 ? "text-red-400" : descripcionInput.length < 100 ? "text-amber-400" : "text-emerald-400"}`}>
                  {descripcionInput.length === 0 ? "Sin contexto" : descripcionInput.length < 20 ? "Básico" : descripcionInput.length < 100 ? "Aceptable" : "Óptimo"}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${descripcionInput.length < 20 ? "bg-red-500" : descripcionInput.length < 100 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min((descripcionInput.length / 150) * 100, 100)}%` }}
                ></div>
              </div>
              <p className="text-[9px] text-slate-500 mt-1">* Opcional y flexible. Un contexto más amplio guía a la IA a respaldar mejor tus observaciones de campo.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleConfirmarNombre()}
              disabled={!nombreInput.trim()}
              className="btn-primary flex-1"
            >
              Crear e ingresar
            </button>
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {devueltoProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-900 rounded-xl max-w-md w-full p-6 shadow-2xl">
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

      {previewModalOpen && selectedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-8">
          <div className="w-full h-full max-w-[100vw] bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-2xl overflow-y-auto relative flex flex-col">
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