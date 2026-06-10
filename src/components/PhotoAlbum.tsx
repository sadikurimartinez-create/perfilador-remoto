"use client";
// @ts-nocheck
/* eslint-disable */

import React, { Fragment, useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { TacticalCharts } from "./TacticalCharts";
import { TacticalMaps } from "./TacticalMaps";
import { exportToWord } from "@/lib/exportToWord";
import { pingOsint, getScinceData, getDenueData } from "@/lib/osintActions";
import { runOSINTScan } from "../utils/osintEngine";
import DatosAbiertosAnalyzer from "./DatosAbiertosAnalyzer";

type EvidencePhotoType = {
  id: string;
  previewUrl?: string;
  tipo?: string;
  comentario?: string;
};

/** Redimensiona y comprime la imagen para que el payload quede bajo el límite de Vercel (~4.5 MB). */
async function resizeImageToBase64(file: File, maxSize = 640, quality = 0.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      let dw = w;
      let dh = h;
      if (w > maxSize || h > maxSize) {
        if (w >= h) {
          dw = maxSize;
          dh = Math.round((h * maxSize) / w);
        } else {
          dh = maxSize;
          dw = Math.round((w * maxSize) / h);
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo crear canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, dw, dh);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const i = dataUrl.indexOf(",");
      resolve(i >= 0 ? dataUrl.slice(i + 1) : dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Error al cargar la imagen"));
    };
    img.src = url;
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No se pudo leer el archivo"));
        return;
      }
      const i = result.indexOf(",");
      resolve(i >= 0 ? result.slice(i + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Tatúa/Quema el sello de agua directamente en los píxeles de la imagen para que nunca se pierdan en Word/PDF */
async function burnGpsOnImage(srcUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(srcUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);
      
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      const watermarkSize = Math.max(40, canvas.width * 0.08);
      ctx.font = `bold ${watermarkSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 8;
      ctx.fillText("SSPE-CEIPOL", 0, 0);
      ctx.restore();
      
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => resolve(srcUrl);
    img.src = srcUrl;
  });
}

function ElapsedTime({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) {
      setSeconds(0);
      return;
    }
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);
  if (!running) return null;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return <span className="font-mono bg-black/20 px-1.5 py-0.5 rounded inline-block ml-1">{m}:{s}</span>;
}

function PendingEvidenceEditor({ d, projectId, album, selectedIds, project, isReadOnly }: any) {
  const [context, setContext] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [auditScore, setAuditScore] = useState<number | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [isAudited, setIsAudited] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const parseJSONResponse = (suggestionsVal: string, scoreVal: number) => {
    let sVal = suggestionsVal;
    let scVal = scoreVal;
    if (sVal.includes("La respuesta de la IA") || sVal.includes("```") || sVal.includes("{")) {
      try {
        const match = sVal.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = match && match[1] ? match[1] : sVal.match(/\{[\s\S]*\}/)?.[0];
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (parsed && typeof parsed === 'object') {
            if (typeof parsed.score === 'number') scVal = parsed.score;
            if (typeof parsed.suggestions === 'string') sVal = parsed.suggestions;
          }
        }
      } catch(e) {}
    }
    return { sVal, scVal };
  };

  const handleRequestSuggestions = async () => {
    setIsRefining(true);
    setSuggestions("");
    setAuditScore(null);
    try {
      const selected = album.filter((p: any) => selectedIds.includes(p.id));
      const photosToUse = selected.length > 0 ? selected : album.filter((p:any) => p.lat != null && p.lng != null);
      const minimalPhotos = photosToUse.map((p: any) => ({ lat: p.lat, lng: p.lng, tipo: p.tipo || "", comentario: p.comentario || "" }));
      const res = await fetch("/api/refine-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: context + "\n\n(INSTRUCCIÓN DEL SISTEMA: Eres un evaluador empático y flexible. Evalúa SÓLO la pertinencia lógica de la evidencia. NO exijas cantidades ni métricas precisas. Si el contexto justifica la evidencia de forma general, otorga un score >= 80. DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO con las claves 'score' (número) y 'suggestions' (string).)",
          photos: minimalPhotos,
          mode: "suggest",
          geometryType: project?.geometryType || "individual",
          projectDescription: project?.descripcion || "",
        }),
      });
      const textRes = await res.text();
      let data;
      try {
        data = JSON.parse(textRes);
      } catch (e) {
        throw new Error(`El servidor devolvió HTML en lugar de JSON (Status: ${res.status}). Verifica que la ruta exista.`);
      }
      if (res.ok) {
        const { sVal, scVal } = parseJSONResponse(data.suggestions ?? "", data.score ?? 0);
        setSuggestions(sVal);
        setAuditScore(scVal);
        if (scVal >= 80) setIsAudited(true);
      } else {
        alert(data.error || "No se pudieron obtener sugerencias.");
      }
    } catch(e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsRefining(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { getDb } = await import("@/lib/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      const firestore = getDb();
      await updateDoc(doc(firestore, "projects", projectId, "documents", d.id), {
        context: context
      });
    } catch(e: any) {
      alert("Error al guardar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-2 p-3 bg-slate-900 border border-amber-600/50 rounded-lg shadow-inner">
       <p className="text-[11px] text-amber-400 font-semibold mb-1 flex items-center gap-1">
         <span className="animate-pulse">⚠️</span> Evidencia In-Situ: Requiere Trabajo de Gabinete (Contextualización)
       </p>
       <textarea value={context} disabled={isReadOnly} onChange={(e) => { setContext(e.target.value); setIsAudited(false); }} className="w-full bg-slate-800 text-slate-200 border border-slate-600 rounded-md p-2 text-xs outline-none focus:border-sky-500 min-h-[80px]" placeholder="Describa el contexto y justificación de esta evidencia capturada en campo..." />
       <div className="flex items-center gap-2 mt-1">
          <button type="button" onClick={handleRequestSuggestions} disabled={isRefining || !context.trim() || isReadOnly} className="bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-md text-white text-[11px] font-semibold disabled:opacity-50 transition-colors">
              {isRefining ? "Consultando IA..." : "Auditar Contexto"}
          </button>
       </div>
       {suggestions && (
           <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-md text-xs text-yellow-200 mt-2 space-y-2">
               <div className="flex justify-between items-center"><p className="font-semibold">Sugerencias IA:</p>{auditScore !== null && (<span className={`px-2 py-0.5 rounded font-bold ${auditScore >= 80 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>Lógica: {auditScore}%</span>)}</div>
               <textarea value={suggestions} onChange={(e) => setSuggestions(e.target.value)} className="w-full bg-yellow-950/50 border border-yellow-700/50 rounded p-2 text-yellow-100 min-h-[60px] focus:outline-none" />
               <div className="flex gap-2"><button type="button" onClick={() => { setContext(c => c + "\n\n" + suggestions); setSuggestions(""); setIsAudited(true); }} className="bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-1 rounded font-medium text-[11px]">Aplicar Sugerencia</button><button type="button" onClick={() => { setSuggestions(""); setAuditScore(null); setIsAudited(false); }} className="bg-red-900/50 border border-red-800 text-red-200 hover:bg-red-800/50 px-2 py-1 rounded font-medium text-[11px]">Descartar</button></div>
           </div>
       )}
       <div className="flex justify-end mt-2"><button type="button" onClick={handleSave} disabled={isSaving || !context.trim() || !isAudited || isReadOnly} className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-50 transition-colors shadow-md">{isSaving ? "Guardando..." : "✅ Subir al Análisis (Completar Gabinete)"}</button></div>
    </div>
  );
}

type PhotoAlbumProps = {
  onDeletePhoto?: (id: string) => void;
  projectId?: string;
  onSaveAnalysisToCloud?: (
    content: string,
    attachedPhotos?: string[],
    summary?: string
  ) => Promise<void>;
};

export function PhotoAlbum({
  onDeletePhoto,
  projectId,
  onSaveAnalysisToCloud,
}: PhotoAlbumProps = {}) {
  const { user } = useAuth();
  const {
    project,
    album,
    selectedIds,
    analysisResult,
    togglePhotoSelection,
    selectAllPhotos,
    clearSelection,
    setAnalysisResult,
    updatePhotoMeta,
    removePhotoFromAlbum,
    removeAllPhotosFromAlbum,
    documents,
    uploadDocument,
    removeDocument,
    isReadOnly,
    markAsPrinted,
    uploadAndAddPhoto,
    datosGobMxResult, // <-- Obtener del contexto
    setDatosGobMxResult,
  } = useProject();
  const [error, setError] = useState<string | null>(null);
  const [aiProfile, setAiProfile] = useState<string | null>(null);
  const [editableProfile, setEditableProfile] = useState<string>("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSavingAnalysis, setIsSavingAnalysis] = useState(false);
  const [hasSavedAnalysis, setHasSavedAnalysis] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [analysisContext, setAnalysisContext] = useState("");
  const [analysisRadius, setAnalysisRadius] = useState(500);
  const [qaIteration, setQaIteration] = useState(0);
  const [aiQuestionsList, setAiQuestionsList] = useState<string[]>([]);
  const [userAnswersMap, setUserAnswersMap] = useState<Record<number, string>>({});
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [analysisContextExtra, setAnalysisContextExtra] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [profileRiskLevel, setProfileRiskLevel] = useState<
    "bajo" | "medio" | "alto" | null
  >(null);
  const [analysisPolygon, setAnalysisPolygon] = useState<{ lat: number; lng: number }[]>([]);
  const [manualPois, setManualPois] = useState<{ lat: number; lng: number; label?: string }[]>([]);
  const [visionData, setVisionData] = useState<Record<string, { faces: { count: number; headwear: boolean }; extractedText: string }>>({});
  const [debugData, setDebugData] = useState<any>(null);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [docContext, setDocContext] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isRefiningDoc, setIsRefiningDoc] = useState(false);
  const [docSuggestions, setDocSuggestions] = useState("");
  const [isAuditingDoc, setIsAuditingDoc] = useState(false);
  const [mapSnapshots, setMapSnapshots] = useState<{ title: string; dataUrl: string }[]>([]);
  const [listeningField, setListeningField] = useState<string | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const lastTranscriptRef = useRef<string>("");
  const [isValidatingPhotos, setIsValidatingPhotos] = useState(false);
  const [docAuditScore, setDocAuditScore] = useState<number | null>(null);
  const [analysisAuditScore, setAnalysisAuditScore] = useState<number | null>(null);

  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [reportSummary, setReportSummary] = useState("");
  const [reportNumber, setReportNumber] = useState("");

  useEffect(() => {
    if (user && !reportNumber) {
      const u = user as any;
      const n = u.nombre || "";
      const ap = u.apellidoPaterno || "";
      const am = u.apellidoMaterno || "";
      let initials = "USR";
      if (n || ap || am) {
        initials = `${n.charAt(0) || ""}${ap.charAt(0) || ""}${am.charAt(0) || ""}`.toUpperCase();
      } else if (u.username) {
        initials = u.username.substring(0, 3).toUpperCase();
      }
      
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      
      setReportNumber(`${initials}/${dd}${mm}${yyyy}/01`);
    }
  }, [user, reportNumber]);

  useEffect(() => {
    if (project && (project as any).reportSummary && !reportSummary) {
      setReportSummary((project as any).reportSummary);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // Estado para Consulta Vehicular OSINT
  const [plateQuery, setPlateQuery] = useState("");
  const [isCheckingPlate, setIsCheckingPlate] = useState(false);
  const [plateContext, setPlateContext] = useState("");

  // Estado para Consulta SAT OSINT (Art. 69-B)
  const [satQuery, setSatQuery] = useState("");
  const [isCheckingSat, setIsCheckingSat] = useState(false);
  const [satContext, setSatContext] = useState("");

  // Estado para Consulta TELEGRAM OSINT
  const [telegramQuery, setTelegramQuery] = useState("");
  const [isCheckingTelegram, setIsCheckingTelegram] = useState(false);
  const [telegramContext, setTelegramContext] = useState("");

  // Estado para Consulta INEGI SCINCE
  const [isCheckingScince, setIsCheckingScince] = useState(false);

  // Estado para Consulta INEGI DENUE
  const [isCheckingDenue, setIsCheckingDenue] = useState(false);

  // Estado para Fusión OSINT RSS
  const [isCheckingRss, setIsCheckingRss] = useState(false);

  // Estado para Búsqueda Multimodal Geo-Espacial
  const [geoQueries, setGeoQueries] = useState<any[]>([]);
  const [isCheckingGeo, setIsCheckingGeo] = useState(false);

  // FASE 3: Indicadores de Conexión en tiempo real (Telemetría)
  const [statusScince, setStatusScince] = useState<"checking" | "online" | "offline">("checking");
  const [statusDenue, setStatusDenue] = useState<"checking" | "online" | "offline">("checking");

  // FASE 2: Estados de validación de auditoría (semáforo)
  const [isDocContextAudited, setIsDocContextAudited] = useState(false);
  const [isAnalysisContextAudited, setIsAnalysisContextAudited] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<any>(null); // Estado para la ventana de edición
  // Validación mínima de fotografías según geometría
const minimumPhotos = {
  individual: 1,
  lineal: 2,
  poligono: 3,
} as const;

const geom = (project?.geometryType as keyof typeof minimumPhotos) || "individual";
const requiredPhotos =
  minimumPhotos[geom] || 1;

const currentPhotos = album.length;

const hasMinimumPhotos =
  currentPhotos >= requiredPhotos;

  // Verificar conexión de las APIs al cargar el componente
  useEffect(() => {
    pingOsint().then(() => {
      setStatusScince("online");
      setStatusDenue("online");
    }).catch(() => {
      setStatusScince("offline");
      setStatusDenue("offline");
    });
  }, []);

  const toggleDictation = (fieldId: string, onUpdate: (text: string) => void) => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Este navegador no soporta dictado por voz. Use la versión de escritorio o Chrome/Android.");
      return;
    }

    try {
      if (listeningField === fieldId) {
        if (recognitionRef.current) recognitionRef.current.stop();
        setListeningField(null);
        return;
      }
      if (recognitionRef.current && listeningField) {
        recognitionRef.current.stop();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "es-MX";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setListeningField(fieldId);
      recognition.onerror = () => setListeningField(null);
      recognition.onend = () => setListeningField(null);
      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalTranscript += (event.results[i][0]?.transcript || "").trim() + " ";
        }
        const normalized = finalTranscript.trim();
        if (!normalized || normalized === lastTranscriptRef.current) return;
        lastTranscriptRef.current = normalized;
        onUpdate(normalized);
      };

      recognitionRef.current = recognition;
      lastTranscriptRef.current = "";
      recognition.start();
    } catch (e) {
      console.error("Error micrófono:", e);
      setListeningField(null);
    }
  };

  const handleOpenConfigModal = async () => {
    if (selectedIds.length === 0) {
      setError("Seleccione al menos una fotografía.");
      return;
    }

    if (!hasMinimumPhotos) {
      setError(
        `La geometría ${project?.geometryType?.toUpperCase() || "INDIVIDUAL"} requiere mínimo ${requiredPhotos} fotografía(s) georreferenciada(s).`
      );
      return;
    }

    // FASE 1: Validación estricta de Contextualización en Fotografías
    const selectedPhotos = album.filter((p) => selectedIds.includes(p.id));
    const isMissingContext = selectedPhotos.some((p) => !p.tipo || !p.comentario?.trim());
    if (isMissingContext) {
      setError("Todas las fotografías seleccionadas deben estar contextualizadas (Tipo y Comentario son obligatorios).");
      return;
    }

    setIsValidatingPhotos(true);
    setError(null);
    try {
      const photosContext = selectedPhotos.map(p => `[${p.tipo}] ${p.comentario}`).join(" | ");
      const instructionPhotos = "\n\n(INSTRUCCIÓN DEL SISTEMA: Eres un evaluador empático. Evalúa EXCLUSIVAMENTE la claridad descriptiva de la observación en campo. NO exijas cantidades precisas, datos estadísticos, nombres exactos ni información OSINT/GEOINT (eso lo hará la plataforma después de manera automática). Si el comentario describe razonablemente el entorno, la percepción de seguridad o el riesgo visual, otorga un score de 80 o más. Tu sugerencia debe ser amigable y no demandar datos imposibles de obtener a simple vista.)";
      const minimalPhotos = selectedPhotos.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        tipo: p.tipo || "",
        comentario: p.comentario || ""
      }));
      const res = await fetch("/api/refine-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: photosContext + instructionPhotos, photos: minimalPhotos, mode: "validate-photos", geometryType: project?.geometryType || "individual", projectDescription: project?.descripcion || "" })
      });
      const textRes = await res.text();
      let data;
      try {
        data = JSON.parse(textRes);
      } catch (e) {
        throw new Error(`La ruta /api/refine-context devolvió HTML (Status: ${res.status}).`);
      }
      if ((data.score ?? 0) < 80) {
        setError(`⚠️ RECHAZADO (Lógica ${data.score ?? 0}%): ${data.suggestions || "Mejora el rigor técnico de la evidencia."}`);
        setIsValidatingPhotos(false);
        return;
      }
    } catch (err) {
      console.error("Error al validar fotos:", err);
      setError("Error de comunicación al validar evidencia. Intente de nuevo.");
      setIsValidatingPhotos(false);
      return;
    }
    setIsValidatingPhotos(false);

    setError(null);
    setQaIteration(0);
    setAiQuestionsList([]);
    setUserAnswersMap({});
    setAnalysisAuditScore(null);
    setIsAnalysisContextAudited(false);
    setShowConfigModal(true);
  };

  const handleSaveAnalysis = async () => {
    if (!editableProfile.trim() || !projectId) return;
    setIsSavingAnalysis(true);
    setError(null);
    try {
      if (onSaveAnalysisToCloud) {
        // Versión robusta y rápida: se guarda siempre el texto del dictamen
        // y no se bloquea el UI intentando subir fotos pesadas.
        try {
          await onSaveAnalysisToCloud(editableProfile, [], reportSummary);
          setHasSavedAnalysis(true);
        } catch (saveErr) {
          console.error(
            "[PhotoAlbum] Error guardando análisis en Firestore (solo texto):",
            saveErr
          );
          setError(
            saveErr instanceof Error
              ? saveErr.message
              : "No se pudo guardar el análisis en el expediente."
          );
          setHasSavedAnalysis(false);
          return;
        }
      }
    } catch (err) {
      console.error("[PhotoAlbum] Error al guardar análisis:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el análisis en el expediente."
      );
      setHasSavedAnalysis(false);
    } finally {
      setIsSavingAnalysis(false);
    }
  };

  const confirmAndGenerateProfile = async () => {
    const selected = album.filter((p) => selectedIds.includes(p.id));
    const withCoords = selected.filter(
      (p) =>
        p.lat != null &&
        p.lng != null &&
        !Number.isNaN(p.lat) &&
        !Number.isNaN(p.lng)
    );
    if (withCoords.length === 0) {
      setError(
        "Ninguna de las fotos seleccionadas tiene coordenadas GPS. Use fotos con ubicación (cámara o EXIF)."
      );
      setShowConfigModal(false);
      return;
    }
    setShowConfigModal(false);
    setError(null);
    setIsGeneratingAI(true);
    try {
      const photosPayload = await Promise.all(
        selected.map(async (p) => {
          let imageBase64: string | null = null;
          if (p.file) {
            try {
              imageBase64 = await resizeImageToBase64(p.file, 640, 0.5);
            } catch {
              const sizeMb = p.file.size / (1024 * 1024);
              if (sizeMb <= 2) imageBase64 = await readFileAsBase64(p.file);
            }
          }
          return {
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            tipo: p.tipo,
            comentario: p.comentario,
            imageBase64: imageBase64 ?? undefined,
          };
        })
      );

      const first = selected[0];
      const lat = typeof first?.lat === "number" && !Number.isNaN(first.lat) ? first.lat : 21.8818;
      const lng = typeof first?.lng === "number" && !Number.isNaN(first.lng) ? first.lng : -102.2915;

      // EJECUCIÓN PARALELA: Mapa, Incidencia y Barrido OSINT Automático (X/Twitter, Google, DENUE, News)
      const mapResPromise = fetch("/api/analyze-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          photos: photosPayload, 
          analysisRadius,
          analysisPolygon,
          manualPois
        }),
      });

      const incidenciaResPromise = fetch("/api/incidencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      }).catch(e => {
        console.error("[PhotoAlbum] Error /api/incidencia:", e);
        return null;
      });

      const osintPromise = runOSINTScan(project).catch(e => {
        console.warn("[Auto-OSINT] Falló el barrido:", e);
        return null;
      });

      const [mapRes, incidenciaRes, automaticOsintData] = await Promise.all([
        mapResPromise,
        incidenciaResPromise,
        osintPromise
      ]);

      let currentAnalysisResult = analysisResult;
      let svData: any[] = [];
      if (mapRes && mapRes.ok) {
        const mapData = await mapRes.json();
        currentAnalysisResult = mapData;
        setAnalysisResult(mapData);
        if (mapData.tacticalStreetViews) svData = mapData.tacticalStreetViews;
      }

      let incidenciaLocal: any[] = [];
      let bibliografiaLocal = "";
      if (incidenciaRes && incidenciaRes.ok) {
        const incidenciaJson = await incidenciaRes.json() as any;
        incidenciaLocal = (incidenciaJson.data ?? []).slice(0, 30);
        bibliografiaLocal = incidenciaJson.bibliografia ?? "";
        setDebugData((prev: any) => ({
          ...(prev ?? {}),
          incidencia: incidenciaLocal,
          bibliografia: bibliografiaLocal,
        }));
      }

      // Empaquetar las instrucciones de la Evidencia Multimodal para la IA
      const multimodalContext = documents.map(d => `[Archivo Adjunto al Expediente: ${d.name} | Tipo: ${d.type}]\nInstrucción Táctica del Analista: ${d.context}`).join("\n\n");

      // Forzar a la IA a describir detalladamente las evidencias de StreetView o del barrido físico
      const svInstruction = svData && svData.length > 0
        ? `\n\n[INSTRUCCIÓN TÁCTICA OBLIGATORIA - BARRIDO DE ACECHO]\nSe obtuvieron ${svData.length} evidencias fotográficas automatizadas de lugares de acecho (StreetView): ${svData.map((s: any) => s.name).join(', ')}. ES TOTALMENTE OBLIGATORIO que dediques un apartado en tu dictamen para enumerar y explicar detalladamente CADA UNO de estos lugares, justificando con claridad por qué representan un riesgo físico o refugio criminal.`
        : `\n\n[INSTRUCCIÓN TÁCTICA OBLIGATORIA - BARRIDO DE ACECHO]\nPROHIBIDO mencionar la frase "no se dispone de un barrido de StreetView". El barrido de lugares de acecho se garantizó a través de la exploración in-situ del analista. Usa estrictamente las fotografías adjuntas por el investigador para extraer, enumerar y explicar con total claridad las evidencias de riesgo y vulnerabilidad física encontradas en terreno.`;

      try {
        const res = await fetch("/api/generate-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photos: photosPayload.map(({ imageBase64, ...rest }) => rest), // Quitar base64 masivo para evitar Timeout 504
            analysisContext: (analysisContext || "") + svInstruction,
            analysisRadius,
            focusAreas,
            incidenciaLocal,
            bibliografiaLocal,
            multimodalContext,
            geometryType: project?.geometryType || "individual",
            projectDescription: project?.descripcion || "",
            osintEngineData: automaticOsintData,
            streetViews: svData,
            datosGobMxData: datosGobMxResult, // <-- AÑADIR AQUÍ
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          let msg = text || "Error al generar el perfil de IA";
          try {
            const json = JSON.parse(text) as { error?: string };
            if (json.error) msg = json.error;
          } catch {
            /* usar text tal cual */
          }
          throw new Error(msg);
        }

        const data = (await res.json()) as {
          markdown?: string;
          unifiedProfile?: string;
          meta?: { 
            riskLevel?: "bajo" | "medio" | "alto";
            incidenciaDetalles?: any[];
            pois?: any[];
            inegiDemographics?: any;
            tacticalStreetViews?: any[];
            scinceDemographics?: any;
            mlFeatures?: any;
          };
        };
        
        let finalMarkdown: string = "";
        if (data.markdown) finalMarkdown = data.markdown;
        else if (data.unifiedProfile) finalMarkdown = data.unifiedProfile;
        else finalMarkdown = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        
        // Corrección definitiva en caso de que el texto crudo en formato JSON haya logrado colarse a la UI
        if (finalMarkdown.trim().startsWith('{') && finalMarkdown.includes('"markdown"')) {
           try {
              const obj = JSON.parse(finalMarkdown);
              if (obj.markdown) finalMarkdown = String(obj.markdown);
           } catch(e) {
              const m = finalMarkdown.match(/"markdown"\s*:\s*"([\s\S]*?)"/);
              if (m && m[1]) finalMarkdown = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
              else finalMarkdown = finalMarkdown.replace(/^[\s\S]*?"markdown"\s*:\s*"/, '').replace(/"\s*}\s*$/, '').replace(/\\n/g, '\n');
           }
        }

        setAiProfile(finalMarkdown);
        setEditableProfile(finalMarkdown);
        setProfileRiskLevel(data.meta?.riskLevel ?? null);

        // Generar resumen automático para la carátula
        try {
          const sumRes = await fetch("/api/refine-context", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context: "Resume el siguiente dictamen en un solo párrafo de máximo 40 palabras para usarlo en la carátula oficial. Dictamen:\n" + finalMarkdown.substring(0, 2000) + "\n\n(INSTRUCCIÓN: DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO con las claves 'score' (número 100) y 'suggestions' (string con el resumen). NO agregues markdown ni comillas invertidas.)",
              photos: [],
              mode: "suggest",
              geometryType: project?.geometryType || "individual",
              projectDescription: project?.descripcion || "",
            })
          });
          const sumText = await sumRes.text();
          let sumData;
          try { sumData = JSON.parse(sumText); } catch(e) {}
          if (sumData) {
            let sVal = sumData.suggestions || "";
            if (sVal.includes("```")) {
              const match = sVal.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
              if (match && match) {
                try {
                  const parsed = JSON.parse(match);
                  if (parsed.suggestions) sVal = parsed.suggestions;
                } catch(e) {}
              }
            } else if (sVal.trim().startsWith("{")) {
              try { const parsed = JSON.parse(sVal); if (parsed.suggestions) sVal = parsed.suggestions; } catch(e) {}
            }
            setReportSummary(sVal.trim());
          }
        } catch (err) {
          console.warn("No se pudo autogenerar el resumen de la carátula.", err);
        }

        // Integrar datos para asegurar que las gráficas y el mapa (Dashboard) se pinten
        const combinedCrimes = [
          ...(data.meta?.incidenciaDetalles || []).map((c: any) => ({
            lat: c.lat,
            lng: c.lng,
            tipoDelito: c.incidente || c.tipoDelito || "Delito",
            rangoHorario: c.rango_horario || c.rangoHorario || "Sin rango",
          })),
          ...incidenciaLocal.map((c: any) => ({
            lat: c.lat,
            lng: c.lng,
            tipoDelito: c.tipo || c.incidente || c.tipoDelito || "Delito",
            rangoHorario: c.rangoHorario || c.rango_horario || "Sin rango",
          })),
        ];

        setAnalysisResult({
          ...(currentAnalysisResult || {}),
          historicalCrimes: combinedCrimes,
          pois: data.meta?.pois || currentAnalysisResult?.pois || [],
          inegiDemographics: data.meta?.inegiDemographics || currentAnalysisResult?.inegiDemographics,
          tacticalStreetViews: data.meta?.tacticalStreetViews || (currentAnalysisResult as any)?.tacticalStreetViews,
          scinceDemographics: data.meta?.scinceDemographics || (currentAnalysisResult as any)?.scinceDemographics,
          riskLevel: data.meta?.riskLevel || (currentAnalysisResult as any)?.riskLevel,
          mlFeatures: data.meta?.mlFeatures || (currentAnalysisResult as any)?.mlFeatures,
        } as any);

        // Integrar automáticamente los lugares de acecho (StreetView) al Álbum
        if (data.meta?.tacticalStreetViews && data.meta.tacticalStreetViews.length > 0) {
          for (const sv of data.meta.tacticalStreetViews) {
            const exists = album.some(p => 
              Math.abs((p.lat || 0) - sv.lat) < 0.0001 && 
              Math.abs((p.lng || 0) - sv.lng) < 0.0001
            );
            
            if (!exists && uploadAndAddPhoto) {
              try {
                const svRes = await fetch(sv.streetViewUrl);
                if (svRes.ok) {
                  const blob = await svRes.blob();
                  const file = new File([blob], `StreetView_${sv.name.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`, { type: "image/jpeg" });
                  await uploadAndAddPhoto(file, sv.lat, sv.lng);
                }
              } catch (err) {
                console.error("[PhotoAlbum] Error anexando StreetView al álbum:", err);
              }
            }
          }
        }
      } catch (err) {
          console.error("ERROR REAL PERFILADOR:", err);
        
          const rawMessage =
            err instanceof Error ? err.message : "Error al generar el perfil criminológico con IA.";
          const lower = rawMessage.toLowerCase();
          const isQuotaError =
            lower.includes("429") ||
            lower.includes("too many requests") ||
            lower.includes("quota");

          setError(
            isQuotaError
              ? "Saturación de red en la IA. Por favor, espere 40 segundos e intente de nuevo."
              : `Error de Cuartel General: ${rawMessage}`
          );
        }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const autoCaptureSnapshots = async (): Promise<{ title: string; dataUrl: string }[]> => {
    const currentSnapshots = [...mapSnapshots];
    let changed = false;

    // Capturar Gráficas Individuales
    const chartIds = [
      { id: "chart-export-1", title: "GRÁFICA 1: COMPOSICIÓN DEL ENTORNO" },
      { id: "chart-export-2", title: "GRÁFICA 2: PRIORIDAD DE FACTORES" },
      { id: "chart-export-3", title: "GRÁFICA 3: DESORGANIZACIÓN SOCIAL" },
      { id: "chart-export-4", title: "GRÁFICA 4: EVOLUCIÓN DE RIESGO" }
    ];

    for (const c of chartIds) {
      if (!currentSnapshots.some((s) => s.title === c.title) && analysisResult) {
        const el = document.getElementById(c.id);
        if (el) {
          try {
            const resultMap = await html2canvas(el, { useCORS: true, scale: 2.5, backgroundColor: "#ffffff" });
            const canvasMap = resultMap as unknown as HTMLCanvasElement;
            const dataUrlMap = String(canvasMap.toDataURL("image/png"));
            currentSnapshots.push({ title: c.title, dataUrl: dataUrlMap });
            changed = true;
          } catch(err) {
            console.warn("Ignorar error de renderizado en gráficas:", err);
          }
        }
      }
    }

    // Capturar Mapas Tácticos Institucionales
    const mapIds = [
      { id: "map-density", title: "1. DENSIDAD CRIMINOLÓGICA" },
      { id: "map-mobility", title: "2. CORREDORES Y MOVILIDAD" },
      { id: "map-attractors", title: "3. ATRACCIÓN Y FACTORES" },
      { id: "map-predictive", title: "4. PROYECCIÓN A 6 MESES" }
    ];

    for (const m of mapIds) {
      if (!currentSnapshots.some((s) => s.title === m.title) && analysisResult) {
        const el = document.getElementById(m.id);
        if (el) {
          try {
            // Dejamos el mapa en su tamaño real responsivo para evitar que Google Maps pierda el centrado
            // Solo aumentamos el 'scale' para obtener alta resolución sin afectar el renderizado interno.
            const resultMap = await html2canvas(el, { useCORS: true, scale: 2.5 });
            const canvasMap = resultMap as unknown as HTMLCanvasElement;
            const dataUrlMap = String(canvasMap.toDataURL("image/png"));
            currentSnapshots.push({ title: m.title, dataUrl: dataUrlMap });
            changed = true;
          } catch(err) {
            console.warn("Ignorar error de renderizado en mapas:", err);
          }
        }
      }
    }

    if (changed) {
      setMapSnapshots(currentSnapshots);
      await new Promise((r) => setTimeout(r, 500));
    }
    return currentSnapshots;
  };

  const handleAttachMapSnapshot = async () => {
    await autoCaptureSnapshots();
    alert("Mapas capturados exitosamente para el dictamen oficial.");
  };

  const handleExportToWord = async () => {
    const rawContent = editableProfile || aiProfile || (project as any)?.analysisContent;
    if (!rawContent) {
      setError("No hay contenido para exportar. Genere o guarde el dictamen primero.");
      return;
    }
    setError(null);
    
    const snapshotsToExport = await autoCaptureSnapshots();
    const content = rawContent.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "[$1]");

    const chartsSnaps = snapshotsToExport.filter((s) => s.title.toLowerCase().includes("gráfica") || s.title.toLowerCase().includes("grafica"));
    const mapsSnaps = snapshotsToExport.filter((s) => !chartsSnaps.some((c) => c.title === s.title));
    const sortedSnapshotsToExport = [...mapsSnaps, ...chartsSnaps];

    const photosToExport = album.filter((p) => selectedIds.includes(p.id) && p.previewUrl);
    const photosToExportData: { url: string; tipo: string; comentario: string }[] = [];

    for (const p of photosToExport) {
      const burnedUrl = await burnGpsOnImage(p.previewUrl as string);
      photosToExportData.push({
        url: burnedUrl,
        tipo: p.tipo || "Evidencia Táctica",
        comentario: p.comentario || "Sin comentario."
      });
    }

    try {
      await exportToWord(
        content,
        "Dictamen_criminologico_ambiental",
        photosToExportData.length > 0 ? photosToExportData : undefined,
        profileRiskLevel ?? undefined,
        sortedSnapshotsToExport.length > 0 ? sortedSnapshotsToExport : undefined,
        (analysisResult as any)?.scinceDemographics,
        reportNumber || project?.id || "DICTAMEN_CRIMINOLOGICO",
        reportSummary
      );

      if (!isReadOnly) await markAsPrinted();
    } catch (err) {
      console.error("[PhotoAlbum] Error al exportar a Word:", err);
      setError(
        err instanceof Error ? err.message : "No se pudo generar el documento Word."
      );
    }
  };

  const handleExportToPDF = async () => {
    await autoCaptureSnapshots();

    const element = document.getElementById("official-pdf-content");
    if (!element) {
      setError("No se pudo encontrar el contenedor del PDF.");
      return;
    }

    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = (html2pdfModule.default || html2pdfModule) as any;
      const safeName = project?.nombre?.replace(/\s+/g, "_") || "Dictamen";
      const opt = {
        margin: 0,
        filename: `Dictamen_Criminologico_${safeName}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ['css', 'legacy'] }
      };
      html2pdf().set(opt).from(element).save().then(() => {
        if (!isReadOnly) void markAsPrinted();
      });
    } catch (err) {
      console.error("Error al exportar a PDF:", err);
      setError("Error al exportar. Compruebe la conexión o instale html2pdf.js");
    }
  };

  if (album.length === 0) {
    return (
      <section className="card p-6 text-center text-slate-400 text-sm">
        El álbum está vacío. Agregue fotografías desde el bloque de captura.
      </section>
    );
  }

  return (
    <>
      <section className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 shadow-2xl rounded-xl p-4 md:p-6 space-y-4 col-span-full w-full">
      <header className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h3 className="text-lg font-semibold text-slate-100">Álbum fotográfico</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAllPhotos}
            className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-800 hidden md:block"
          >
            Seleccionar todas
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-800 hidden md:block"
          >
            Limpiar selección
          </button>
          {!isReadOnly && projectId && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const { getDb } = await import("@/lib/firebase");
                  const { doc, writeBatch } = await import("firebase/firestore");
                  const firestore = getDb();
                  const batch = writeBatch(firestore);
                  album.forEach(p => {
                    batch.update(doc(firestore, "projects", projectId, "photos", p.id), { tipo: p.tipo || "", comentario: p.comentario || "" });
                  });
                  await batch.commit();
                  window.alert("Contextualizaciones guardadas correctamente.");
                } catch (err) {
                  console.error(err);
                  window.alert("Error al guardar.");
                }
              }}
              className="text-xs px-2 py-1 rounded border border-emerald-600 text-emerald-100 bg-emerald-900/40 hover:bg-emerald-800"
            >
              💾 Guardar Cambios
            </button>
          )}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("¿Seguro que desea borrar TODAS las fotografías de este proyecto?")) {
                  if (project) void removeAllPhotosFromAlbum(project.id);
                }
              }}
              className="text-xs px-2 py-1 rounded border border-red-900/50 text-red-400 hover:bg-red-900/30"
            >
              Borrar todas
            </button>
          )}
        </div>
      </header>

      {(() => {
        let groups: { title: string; photos: typeof album }[] = [];
        if (project?.geometryType === "lineal") {
          groups = [
            { title: "Nodo Inicial", photos: album.filter((p) => p.tipo === "Nodo Inicial") },
            { title: "Corredor", photos: album.filter((p) => p.tipo === "Corredor") },
            { title: "Nodo Final", photos: album.filter((p) => p.tipo === "Nodo Final") },
            { title: "Sin Clasificar / Otros", photos: album.filter((p) => !["Nodo Inicial", "Corredor", "Nodo Final"].includes(p.tipo)) },
          ];
        } else if (project?.geometryType === "poligono") {
          groups = [
            { title: "Perímetro", photos: album.filter((p) => p.tipo === "Perímetro") },
            { title: "Interior", photos: album.filter((p) => p.tipo === "Interior") },
            { title: "Sin Clasificar / Otros", photos: album.filter((p) => !["Perímetro", "Interior"].includes(p.tipo)) },
          ];
        } else {
          groups = [
            { title: "Nodo y Entorno", photos: album }
          ];
        }
        groups = groups.filter((g) => g.photos.length > 0);

        return groups.map((group, gIdx) => (
          <div key={gIdx} className="mb-4">
            {project?.geometryType !== "individual" && (
              <h4 className="text-sm font-semibold text-sky-300 mb-2 border-b border-slate-700 pb-1">{group.title}</h4>
            )}
            <div className="flex flex-col gap-6 w-full">
              {group.photos.map((p) => (
          <div
            key={p.id}
            className={`rounded-lg border overflow-hidden bg-slate-900/80 ${
              selectedIds.includes(p.id) ? "border-sky-500 ring-1 ring-sky-500/50" : "border-slate-700"
            }`}
          >
            <div className="flex flex-col">
              <div className="flex flex-col items-center gap-4 p-4 w-full">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={async () => {
                    togglePhotoSelection(p.id);
                    if (!visionData[p.id] && p.file instanceof Blob) {
                      try {
                        const base64 = await readFileAsBase64(p.file);
                        const res = await fetch("/api/analyze-vision", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ imageBase64: base64 }),
                        });
                        if (res.ok) {
                          const data = (await res.json()) as {
                            faces: { count: number; headwear: boolean };
                            extractedText: string;
                          };
                          setVisionData((prev) => ({
                            ...prev,
                            [p.id]: data,
                          }));
                        }
                      } catch (err) {
                        console.error("[PhotoAlbum] Error en analyze-vision:", err);
                      }
                    }
                  }}
                    className="mt-1 rounded border-slate-600 hidden md:block"
                />
                <div className="flex-1 w-full min-w-0 relative">
                  <div className="w-full relative rounded overflow-hidden bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.previewUrl}
                      alt=""
                      className="w-full h-auto max-h-[75vh] object-contain"
                    />
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        void removePhotoFromAlbum(p.id);
                      }}
                      className="absolute top-0 right-0 rounded p-1 bg-red-600/90 text-white hover:bg-red-500"
                      title="Eliminar fotografía"
                      aria-label="Eliminar fotografía"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Campo de comentarios (Obligatorio) - Visible en móvil y PC */}
                  <div className="relative w-full mt-2">
                    <textarea
                      spellCheck={true}
                      placeholder="Contexto e Instrucciones Específicas para la IA (Ej. Buscar grafitis similares a 1km)..."
                      value={p.comentario || ""}
                      disabled={isReadOnly}
                      onChange={(e) => updatePhotoMeta(p.id, { tipo: p.tipo, comentario: e.target.value })}
                      className={`w-full bg-slate-800 text-slate-200 border rounded-md p-2 pr-14 text-xs outline-none focus:border-sky-500 disabled:opacity-50 resize-y min-h-[80px] ${!p.comentario?.trim() ? 'border-amber-500/70 bg-amber-900/10' : 'border-slate-700'}`}
                    />
                    {!isReadOnly && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingPhoto(p)}
                          className="absolute right-8 top-2 text-slate-400 hover:text-sky-400"
                          title="Editar en ventana ampliada"
                        >
                          🪟
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleDictation(`comentario-${p.id}`, (text) => updatePhotoMeta(p.id, { tipo: p.tipo, comentario: ((p.comentario || "") + " " + text).trim() }))}
                          className={`absolute right-2 top-2 ${listeningField === 'comentario-'+p.id ? 'text-red-400 animate-pulse' : 'text-slate-400 hover:text-sky-400'}`}
                          title="Dictar comentario por voz"
                        >
                          🎙️
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-1 mb-2">
                    <div className="flex justify-between items-center text-[9px] mb-0.5">
                      <span className="text-slate-400">Idoneidad del contexto (Semáforo):</span>
                      <span className={`font-bold ${(p.comentario || "").length < 30 ? "text-red-400" : (p.comentario || "").length < 100 ? "text-amber-400" : "text-emerald-400"}`}>
                        {(p.comentario || "").length === 0 ? "Sin contexto" : (p.comentario || "").length < 30 ? "Básico" : (p.comentario || "").length < 100 ? "Aceptable" : "Óptimo"}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1">
                      <div 
                        className={`h-1 rounded-full transition-all duration-300 ${(p.comentario || "").length < 30 ? "bg-red-500" : (p.comentario || "").length < 100 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(((p.comentario || "").length / 150) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {visionData[p.id]?.extractedText && (
                    <span className="mt-0.5 inline-flex items-center gap-1 bg-blue-900/80 text-blue-200 text-[10px] px-2 py-0.5 rounded border border-blue-700">
                      🏷️ OCR:{" "}
                      <span className="truncate max-w-[7rem]">
                        {visionData[p.id].extractedText}
                      </span>
                    </span>
                  )}
                  {(visionData[p.id]?.faces?.count ?? 0) > 0 && (
                    <span className="mt-0.5 inline-flex items-center gap-1 bg-red-900/80 text-red-200 text-[10px] px-2 py-0.5 rounded border border-red-700">
                      👤 Rostros: {visionData[p.id].faces.count}
                    </span>
                  )}
                  <select
                    value={p.tipo || ""}
                    onChange={(e) =>
                      updatePhotoMeta(p.id, {
                        tipo: e.target.value,
                        comentario: p.comentario,
                      })
                    }
                    disabled={isReadOnly}
                    className={`w-full mt-2 bg-gray-800 text-gray-200 border rounded-md p-1 text-sm outline-none focus:border-blue-500 hidden md:block disabled:opacity-50 ${!p.tipo ? 'border-amber-500/70 bg-amber-900/10' : 'border-gray-600'}`}
                  >
                    {project?.geometryType === "lineal" ? (
                      <>
                        <option value="">Selecciona rol...</option>
                        <option value="Nodo Inicial">Nodo Inicial</option>
                        <option value="Corredor">Corredor</option>
                        <option value="Nodo Final">Nodo Final</option>
                        <option value="Otro">Otro</option>
                      </>
                    ) : project?.geometryType === "poligono" ? (
                      <>
                        <option value="">Selecciona rol...</option>
                        <option value="Perímetro">Perímetro</option>
                        <option value="Interior">Interior</option>
                        <option value="Otro">Otro</option>
                      </>
                    ) : (
                      <>
                        <option value="">Selecciona rol...</option>
                        <option value="Nodo Principal">Nodo Principal</option>
                        <option value="Atractor de Riesgo">Atractor de Riesgo</option>
                        <option value="Ruta de Acceso/Escape">Ruta de Acceso/Escape</option>
                        <option value="Lugar de Acecho">Lugar de Acecho</option>
                        <option value="Frontera/Límite">Frontera/Límite</option>
                        <option value="Otro">Otro</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
          </div>
          </div>
        ))}
            </div>
          </div>
        ));
      })()}

      <div className="flex flex-col gap-6 pt-6 mt-6 border-t border-slate-800 w-full print:hidden">
      {/* MÓDULO DE CONSULTA VEHICULAR OSINT (CheckAuto / REPUVE) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">Consulta Vehicular (OSINT Automático)</h4>
          <p className="text-xs text-slate-400">
            Realice un barrido automatizado simulando la consulta pública de placas vehiculares detectadas en las fotos. El resultado se inyectará en la hipótesis. <strong className="text-amber-400">Obligatorio contextualizar.</strong>
          </p>
        </header>
        <div className="flex flex-col gap-4 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center w-full">
            <input
              type="text"
              placeholder="Ingrese placa o NIV..."
              value={plateQuery}
              onChange={(e) => setPlateQuery(e.target.value.toUpperCase().replace(/[-\s]/g, ""))}
              disabled={isCheckingPlate || isReadOnly}
              className="w-full md:w-64 bg-slate-900 text-slate-200 border border-slate-600 rounded-md p-2 text-sm outline-none focus:border-sky-500 disabled:opacity-50 uppercase font-mono"
            />
          </div>
          <div className="w-full relative">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => toggleDictation('plateContext', (text) => setPlateContext(prev => (prev ? `${prev.trim()} ${text}` : text)))}
                className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold border ${listeningField === 'plateContext' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-slate-600 text-slate-300 bg-slate-800/80 hover:bg-slate-700"}`}
              >
                <span>🎙️</span> {listeningField === 'plateContext' ? "Grabando..." : "Dictar"}
              </button>
            )}
            <textarea
              spellCheck={true}
              value={plateContext}
              disabled={isReadOnly}
              onChange={(e) => setPlateContext(e.target.value)}
              placeholder="Contexto, justificación o instrucción específica para la IA sobre este vehículo (Obligatorio)..."
              className={`w-full bg-slate-900 text-slate-200 border rounded-md p-3 pr-14 text-sm outline-none focus:border-sky-500 min-h-[80px] disabled:opacity-50 ${!plateContext.trim() ? 'border-amber-500/70 bg-amber-900/10' : 'border-slate-600'}`}
            />
          </div>
          <div className="mt-1 mb-2">
            <div className="flex justify-between items-center text-[10px] mb-1">
              <span className="text-slate-400">Idoneidad del contexto (Semáforo):</span>
              <span className={`font-bold ${plateContext.length < 30 ? "text-red-400" : plateContext.length < 100 ? "text-amber-400" : "text-emerald-400"}`}>
                {plateContext.length === 0 ? "Sin contexto" : plateContext.length < 30 ? "Básico" : plateContext.length < 100 ? "Aceptable" : "Óptimo"}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${plateContext.length < 30 ? "bg-red-500" : plateContext.length < 100 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min((plateContext.length / 150) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <button
            type="button"
            disabled={!plateQuery.trim() || !plateContext.trim() || isCheckingPlate || isReadOnly}
            onClick={async () => {
              setIsCheckingPlate(true);
              setError(null);
              try {
                const res = await fetch("/api/repuve", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ placa: plateQuery.trim() })
                });
                
                const data = await res.json();

                if (!res.ok) {
                  throw new Error(data.error || `Fallo en el puente de conexión (Código ${res.status}).`);
                }
                if (data.exito) {
                  // Inyectamos el resumen detallado (vehículo + instituciones) proveniente del Robot
                  const newContext = `[INTELIGENCIA VEHICULAR OSINT - Placa: ${data.placa}]\nInstrucción/Contexto del Analista: ${plateContext}\nEstatus general: ${data.estatus}\n\n${data.resumenTexto || ""}\n\nObservaciones tácticas: Este vehículo se detectó físicamente en el perímetro del análisis, lo cual podría representar una ventana de oportunidad criminal o un atractor de riesgo.`;
                  setAnalysisContext((prev) => prev ? `${prev}\n\n${newContext}` : newContext);
                  setPlateQuery("");
                  setPlateContext("");
                  setIsAnalysisContextAudited(false); // Forzar a reevaluar la hipótesis con la IA
                  alert(`¡Búsqueda Vehicular Completada!\n\nEstatus: ${data.estatus}\n\n${data.resumenTexto || ""}\n\n* La información ha sido anexada a su Hipótesis Táctica.`);
                } else {
                  setError(data.error || "Error al consultar la placa.");
                }
              } catch (err) {
                console.error("[Frontend] Error crítico al consultar placa:", err);
                setError(err instanceof Error ? err.message : "Error de red al comunicarse con el cuartel general.");
              } finally {
                setIsCheckingPlate(false);
              }
            }}
            className="w-full md:w-auto bg-sky-700 hover:bg-sky-600 text-white py-2 px-4 rounded text-xs font-semibold disabled:opacity-50 transition shadow-lg"
          >
            {isCheckingPlate ? <span className="flex items-center justify-center">Consultando Base de Datos... <ElapsedTime running={isCheckingPlate} /></span> : "🔍 Consultar y Añadir a Hipótesis"}
          </button>
        </div>
      </div>

      {/* MÓDULO DE INTELIGENCIA ECONÓMICA (SAT Art. 69-B) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">Inteligencia Económica (SAT - Art. 69B)</h4>
          <p className="text-xs text-slate-400">
            Consulte negocios detectados contra las listas negras de la SHCP/SAT. Identifique empresas fachada o posibles esquemas de lavado de dinero operando en el polígono. <strong className="text-amber-400">Obligatorio contextualizar.</strong>
          </p>
        </header>
        <div className="flex flex-col gap-4 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center w-full">
            <input
              type="text"
              placeholder="Ingrese RFC o Razón Social..."
              value={satQuery}
              onChange={(e) => setSatQuery(e.target.value.toUpperCase())}
              disabled={isCheckingSat || isReadOnly}
              className="w-full md:w-64 bg-slate-900 text-slate-200 border border-slate-600 rounded-md p-2 text-sm outline-none focus:border-sky-500 disabled:opacity-50 uppercase font-mono"
            />
          </div>
          <div className="w-full relative">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => toggleDictation('satContext', (text) => setSatContext(prev => (prev ? `${prev.trim()} ${text}` : text)))}
                className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold border ${listeningField === 'satContext' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-slate-600 text-slate-300 bg-slate-800/80 hover:bg-slate-700"}`}
              >
                <span>🎙️</span> {listeningField === 'satContext' ? "Grabando..." : "Dictar"}
              </button>
            )}
            <textarea
              spellCheck={true}
              value={satContext}
              disabled={isReadOnly}
              onChange={(e) => setSatContext(e.target.value)}
              placeholder="Contexto, justificación o instrucción específica para la IA sobre este negocio (Obligatorio)..."
              className={`w-full bg-slate-900 text-slate-200 border rounded-md p-3 pr-14 text-sm outline-none focus:border-sky-500 min-h-[80px] disabled:opacity-50 ${!satContext.trim() ? 'border-amber-500/70 bg-amber-900/10' : 'border-slate-600'}`}
            />
          </div>
          <div className="mt-1 mb-2">
            <div className="flex justify-between items-center text-[10px] mb-1">
              <span className="text-slate-400">Idoneidad del contexto (Semáforo):</span>
              <span className={`font-bold ${satContext.length < 30 ? "text-red-400" : satContext.length < 100 ? "text-amber-400" : "text-emerald-400"}`}>
                {satContext.length === 0 ? "Sin contexto" : satContext.length < 30 ? "Básico" : satContext.length < 100 ? "Aceptable" : "Óptimo"}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${satContext.length < 30 ? "bg-red-500" : satContext.length < 100 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min((satContext.length / 150) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <button
            type="button"
            disabled={!satQuery.trim() || !satContext.trim() || isCheckingSat || isReadOnly}
            onClick={async () => {
              setIsCheckingSat(true);
              setError(null);
              try {
                const res = await fetch("/api/osint/sat", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ rfc_o_nombre: satQuery.trim() })
                });
                const data = await res.json();
                if (res.ok) {
                  const newContext = `[INTELIGENCIA ECONÓMICA OSINT - Búsqueda SAT: ${data.busqueda}]\nInstrucción/Contexto del Analista: ${satContext}\nEstatus Oficial: ${data.estatus}. Supuesto: ${data.supuesto}. Observaciones tácticas: Este establecimiento fue consultado en las Listas Negras (Art. 69-B CFF). Si aparece como EFOS, debe considerarse un mercado negro y atractor de riesgo grave de desorganización social para el entorno.`;
                  setAnalysisContext((prev) => prev ? `${prev}\n\n${newContext}` : newContext);
                  setSatQuery("");
                  setSatContext("");
                  setIsAnalysisContextAudited(false); // Forzar reevaluación por añadir riesgo
                  alert(`Consulta finalizada: ${data.estatus}. Resultado integrado a la hipótesis.`);
                } else {
                  setError(data.error || "Error al consultar el SAT.");
                }
              } catch (err) {
                setError("Error de red al conectar con el módulo SAT.");
              } finally {
                setIsCheckingSat(false);
              }
            }}
            className="w-full md:w-auto bg-emerald-700 hover:bg-emerald-600 text-white py-2 px-4 rounded text-xs font-semibold disabled:opacity-50 transition shadow-lg"
          >
            {isCheckingSat ? <span className="flex items-center justify-center">Consultando SAT... <ElapsedTime running={isCheckingSat} /></span> : "💰 Consultar SAT y Añadir a Hipótesis"}
          </button>
        </div>
      </div>

      {/* MÓDULO DE INTELIGENCIA DE FUENTES ABIERTAS (TELEGRAM OSINT) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">Inteligencia de Fuentes Abiertas (Telegram OSINT)</h4>
          <p className="text-xs text-slate-400">
            Consulte bases de datos filtradas (Leaks) buscando apodos, placas secundarias o entidades detectadas en terreno. <strong className="text-amber-400">Obligatorio contextualizar.</strong>
          </p>
        </header>
        <div className="flex flex-col gap-4 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center w-full">
            <input
              type="text"
              placeholder="Ingrese objetivo (Ej. Apodo, Teléfono)..."
              value={telegramQuery}
              onChange={(e) => setTelegramQuery(e.target.value)}
              disabled={isCheckingTelegram || isReadOnly}
              className="w-full md:w-64 bg-slate-900 text-slate-200 border border-slate-600 rounded-md p-2 text-sm outline-none focus:border-sky-500 disabled:opacity-50 font-mono"
            />
          </div>
          <div className="w-full relative">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => toggleDictation('telegramContext', (text) => setTelegramContext(prev => (prev ? `${prev.trim()} ${text}` : text)))}
                className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold border ${listeningField === 'telegramContext' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-slate-600 text-slate-300 bg-slate-800/80 hover:bg-slate-700"}`}
              >
                <span>🎙️</span> {listeningField === 'telegramContext' ? "Grabando..." : "Dictar"}
              </button>
            )}
            <textarea
              spellCheck={true}
              value={telegramContext}
              disabled={isReadOnly}
              onChange={(e) => setTelegramContext(e.target.value)}
              placeholder="Contexto, justificación o instrucción específica para la IA sobre esta búsqueda..."
              className={`w-full bg-slate-900 text-slate-200 border rounded-md p-3 pr-14 text-sm outline-none focus:border-sky-500 min-h-[80px] disabled:opacity-50 ${!telegramContext.trim() ? 'border-amber-500/70 bg-amber-900/10' : 'border-slate-600'}`}
            />
          </div>
          <div className="mt-1 mb-2">
            <div className="flex justify-between items-center text-[10px] mb-1">
              <span className="text-slate-400">Idoneidad del contexto (Semáforo):</span>
              <span className={`font-bold ${telegramContext.length < 30 ? "text-red-400" : telegramContext.length < 100 ? "text-amber-400" : "text-emerald-400"}`}>
                {telegramContext.length === 0 ? "Sin contexto" : telegramContext.length < 30 ? "Básico" : telegramContext.length < 100 ? "Aceptable" : "Óptimo"}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${telegramContext.length < 30 ? "bg-red-500" : telegramContext.length < 100 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min((telegramContext.length / 150) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <button
            type="button"
            disabled={!telegramQuery.trim() || !telegramContext.trim() || isCheckingTelegram || isReadOnly}
            onClick={async () => {
              setIsCheckingTelegram(true);
              setError(null);
              try {
                // 1. Expandir la consulta con IA
                const expansionRes = await fetch("/api/refine-context", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    context: `Dada la siguiente consulta de inteligencia: "${telegramQuery.trim()}". Genera al menos 8 palabras clave, entidades o conceptos relacionados para profundizar la búsqueda en bases de datos de fuentes abiertas. (INSTRUCCIÓN DEL SISTEMA: DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO con las claves 'score' (número 100) y 'suggestions' (string con las palabras clave separadas por comas).)`,
                    mode: "suggest",
                    photos: [],
                    geometryType: project?.geometryType || "individual",
                    projectDescription: project?.descripcion || "",
                  }),
                });

                let expandedQuery = telegramQuery.trim();
                if (expansionRes.ok) {
                  const expansionText = await expansionRes.text();
                  try {
                    const expansionData = JSON.parse(expansionText);
                    let suggestionsVal = expansionData.suggestions || "";
                    // Lógica de parseo robusta
                    if (suggestionsVal.includes("```")) {
                      const match = suggestionsVal.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                      if (match && match[1]) {
                        try { const parsed = JSON.parse(match[1]); if (parsed.suggestions) suggestionsVal = parsed.suggestions; } catch(e) {}
                      }
                    } else if (suggestionsVal.trim().startsWith("{")) {
                      try { const parsed = JSON.parse(suggestionsVal); if (parsed.suggestions) suggestionsVal = parsed.suggestions; } catch(e) {}
                    }
                    
                    if (suggestionsVal) {
                      expandedQuery += ", " + suggestionsVal;
                    }
                  } catch(e) {
                     console.error("Error al parsear la expansión de IA:", e);
                  }
                }

                // 2. Ejecutar la búsqueda OSINT con la consulta expandida
                const res = await fetch("/api/osint", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ queryTelegram: expandedQuery })
                });
                if (!res.ok) {
                   const errorText = await res.text().catch(() => `Error del servidor (código ${res.status})`);
                   if (errorText.toLowerCase().includes("<!doctype html>")) {
                     throw new Error(`La ruta /api/osint no está disponible o devolvió HTML (Status: ${res.status}).`);
                   }
                   throw new Error(errorText);
                }
                const data = await res.json();
                if (data.success) {
                  const newContext = `[INTELIGENCIA OSINT AVANZADA - Búsqueda Ampliada por IA: ${expandedQuery}]\nInstrucción/Contexto del Analista: ${telegramContext}\nResultados: ${data.osintSummary}. Observaciones tácticas: Elemento identificado en campo con posible vinculación a bases de datos filtradas. Evaluar impacto en la estructura del entorno.`;
                  setAnalysisContext((prev) => prev ? `${prev}\n\n${newContext}` : newContext);
                  setTelegramQuery("");
                  setTelegramContext("");
                  setIsAnalysisContextAudited(false);
                  alert(`Consulta Telegram OSINT (Ampliada por IA) finalizada.\n\nResultado integrado a la hipótesis.`);
                } else {
                  setError(data.error || "Error al consultar Telegram OSINT.");
                }
              } catch (err: any) {
                console.error("Error Telegram OSINT:", err);
                setError(err.message || "Error de red al conectar con el módulo OSINT o de expansión de IA.");
              } finally {
                setIsCheckingTelegram(false);
              }
            }}
            className="w-full md:w-auto bg-indigo-700 hover:bg-indigo-600 text-white py-2 px-4 rounded text-xs font-semibold disabled:opacity-50 transition shadow-lg"
          >
            {isCheckingTelegram ? <span className="flex items-center justify-center">Consultando OSINT... <ElapsedTime running={isCheckingTelegram} /></span> : "🕵️ Consultar OSINT y Añadir a Hipótesis"}
          </button>
        </div>
      </div>

      {/* MÓDULO DE INTELIGENCIA DEMOGRÁFICA (INEGI SCINCE) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="text-base font-semibold text-slate-200">Demografía y Marginación (INEGI SCINCE)</h4>
            {statusScince === "checking" && <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full animate-pulse">⏳ Verificando...</span>}
            {statusScince === "online" && <span className="text-[10px] bg-emerald-900/60 border border-emerald-700 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> ONLINE</span>}
            {statusScince === "offline" && <span className="text-[10px] bg-red-900/60 border border-red-700 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> OFFLINE (404)</span>}
          </div>
          <p className="text-xs text-slate-400">
            Extrae datos sociodemográficos a nivel manzana/AGEB basados en el centro de las fotografías seleccionadas. Identifica viviendas deshabitadas y desorganización social.
          </p>
        </header>
        <div className="flex flex-col md:flex-row gap-3 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700 items-start md:items-center">
          <p className="text-xs text-slate-300 flex-1">
            {selectedIds.length > 0
              ? `El barrido se calculará sobre el centroide de las ${selectedIds.length} fotos seleccionadas.`
              : "⚠️ Seleccione al menos una fotografía en el álbum para establecer el punto GPS de búsqueda."}
          </p>
          <button
            type="button"
            disabled={selectedIds.length === 0 || isCheckingScince || isReadOnly}
            onClick={async () => {
              setIsCheckingScince(true);
              setError(null);
              try {
                const selectedPhotos = album.filter(p => selectedIds.includes(p.id) && p.lat && p.lng);
                if (selectedPhotos.length === 0) {
                  setError("Las fotos seleccionadas no tienen coordenadas GPS válidas.");
                  setIsCheckingScince(false);
                  return;
                }
                const centerLat = selectedPhotos.reduce((acc, p) => acc + p.lat!, 0) / selectedPhotos.length;
                const centerLng = selectedPhotos.reduce((acc, p) => acc + p.lng!, 0) / selectedPhotos.length;

                const data = await getScinceData(centerLat, centerLng);
                if (data.exito) {
                  const newContext = `[INTELIGENCIA DEMOGRÁFICA - INEGI SCINCE] Coordenadas: ${data.coordenadas}. Población de la manzana: ${data.poblacionTotal} hab. Viviendas totales: ${data.viviendasTotales}. VIVIENDAS DESHABITADAS: ${data.viviendasDeshabitadas}. Grado de marginación: ${data.gradoMarginacion}. Observaciones tácticas: El nivel de viviendas abandonadas o en desuso agudiza la percepción de desorden, propicia el paracaidismo, el consumo de drogas y consolida el patrón de "Ventanas Rotas" en la zona.`;
                  setAnalysisContext((prev) => prev ? `${prev}\n\n${newContext}` : newContext);
                  setIsAnalysisContextAudited(false); // Forzar reevaluación por la IA
                  alert(`Consulta SCINCE finalizada. ${data.viviendasDeshabitadas} casas deshabitadas detectadas en la cuadra.`);
                } else {
                  setError(data.error || "Error al consultar INEGI SCINCE.");
                }
              } catch (err: any) { setError(err.message || "Error de red al conectar con SCINCE."); } 
              finally { setIsCheckingScince(false); }
            }}
            className="w-full md:w-auto bg-purple-700 hover:bg-purple-600 text-white py-2 px-4 rounded text-xs font-semibold disabled:opacity-50 transition shadow-lg"
          >
            {isCheckingScince ? <span className="flex items-center justify-center">Consultando INEGI... <ElapsedTime running={isCheckingScince} /></span> : "📊 Consultar Cuadra y Añadir a Hipótesis"}
          </button>
        </div>
      </div>

      {/* MÓDULO DE GIROS COMERCIALES Y NEGOCIOS (INEGI DENUE) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="text-base font-semibold text-slate-200">Giros Comerciales (INEGI DENUE)</h4>
            {statusDenue === "checking" && <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full animate-pulse">⏳ Verificando...</span>}
            {statusDenue === "online" && <span className="text-[10px] bg-emerald-900/60 border border-emerald-700 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> ONLINE</span>}
            {statusDenue === "offline" && <span className="text-[10px] bg-red-900/60 border border-red-700 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> OFFLINE (404)</span>}
          </div>
          <p className="text-xs text-slate-400">
            Realice un barrido para identificar negocios, bares, chatarreras y unidades económicas formales a 500 metros de la evidencia.
          </p>
        </header>
        <div className="flex flex-col md:flex-row gap-3 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700 items-start md:items-center">
          <p className="text-xs text-slate-300 flex-1">
            {selectedIds.length > 0
              ? `El barrido buscará negocios a 500 metros del centroide de las ${selectedIds.length} fotos seleccionadas.`
              : "⚠️ Seleccione al menos una fotografía en el álbum para establecer el punto GPS de búsqueda."}
          </p>
          <button
            type="button"
            disabled={selectedIds.length === 0 || isCheckingDenue || isReadOnly}
            onClick={async () => {
              setIsCheckingDenue(true);
              setError(null);
              try {
                const selectedPhotos = album.filter(p => selectedIds.includes(p.id) && p.lat && p.lng);
                if (selectedPhotos.length === 0) {
                  setError("Las fotos seleccionadas no tienen coordenadas GPS válidas.");
                  setIsCheckingDenue(false);
                  return;
                }
                const centerLat = selectedPhotos.reduce((acc, p) => acc + p.lat!, 0) / selectedPhotos.length;
                const centerLng = selectedPhotos.reduce((acc, p) => acc + p.lng!, 0) / selectedPhotos.length;

                const data = await getDenueData(centerLat, centerLng, 500);
                if (data.exito) {
                  const newContext = `[INTELIGENCIA COMERCIAL - INEGI DENUE] A 500 metros del epicentro se detectaron ${data.total} negocios formales. Destacan: ${data.resumen}. Observaciones tácticas: Este mapeo permite cruzar giros antagónicos (ej. bares cerca de escuelas) y detectar vulnerabilidades o atractores de riesgo en la zona.`;
                  setAnalysisContext((prev) => prev ? `${prev}\n\n${newContext}` : newContext);
                  setIsAnalysisContextAudited(false);
                  alert(`Consulta DENUE finalizada. ${data.total} unidades económicas detectadas.`);
                } else {
                  setError(data.error || "Error al consultar INEGI DENUE.");
                }
              } catch (err: any) { setError(err.message || "Error de red al conectar con DENUE."); } 
              finally { setIsCheckingDenue(false); }
            }}
            className="w-full md:w-auto bg-amber-700 hover:bg-amber-600 text-white py-2 px-4 rounded text-xs font-semibold disabled:opacity-50 transition shadow-lg"
          >
            {isCheckingDenue ? <span className="flex items-center justify-center">Buscando Negocios... <ElapsedTime running={isCheckingDenue} /></span> : "🏪 Consultar DENUE y Añadir a Hipótesis"}
          </button>
        </div>
      </div>

      {/* MÓDULO DE DATOS ABIERTOS (datos.gob.mx) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">Datos Abiertos del Gobierno Federal</h4>
          <p className="text-xs text-slate-400">Busca bases de datos y registros oficiales cerca de las coordenadas del polígono.</p>
        </header>
        <DatosAbiertosAnalyzer
          lat={album.find(p => p.lat && p.lng)?.lat || 21.8818}
          lng={album.find(p => p.lat && p.lng)?.lng || -102.2915}
          onAnalysisComplete={(data) => {
            setDatosGobMxResult(data);
            const newContext = `[DATOS ABIERTOS GUBERNAMENTALES]\nDataset: ${data.datasetTitle}\nResumen: ${data.resumen}\n\nObservaciones tácticas: Elementos extraídos del padrón federal.`;
            setAnalysisContext((prev) => prev ? `${prev}\n\n${newContext}` : newContext);
            setIsAnalysisContextAudited(false); // Obliga a reevaluar la hipótesis
            alert(`Análisis de Datos Abiertos completado y anexado a su Hipótesis:\n\n${data.resumen}`);
          }}
        />
      </div>

      {/* MÓDULO DE FUSIÓN OSINT (NOTICIAS RSS) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">Radar OSINT Regional (Noticias RSS)</h4>
          <p className="text-xs text-slate-400">
            Escanea medios locales y nacionales en tiempo real. La IA correlacionará automáticamente las noticias de alto impacto con tu hipótesis, la marginación y los comercios detectados.
          </p>
        </header>
        <div className="flex flex-col md:flex-row gap-3 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700 items-start md:items-center">
          <p className="text-xs text-slate-300 flex-1">
            Recomendación: Ejecute las consultas SCINCE y DENUE antes de este barrido para que la IA tenga mayor contexto de cruce.
          </p>
          <button
            type="button"
            disabled={isCheckingRss || isReadOnly}
            onClick={async () => {
              setIsCheckingRss(true);
              setError(null);
              try {
                const res = await fetch("/api/refine-context", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    context: analysisContext,
                    mode: "rss-news",
                    region: "Aguascalientes"
                  })
                });
                const textRes = await res.text();
                let data;
                try {
                  data = JSON.parse(textRes);
                } catch (e) {
                  throw new Error(`Error en el servidor al procesar noticias (Status: ${res.status}).`);
                }
                if (res.ok && data.success) {
                  const d = data.data;
                  const criticos = d.eventosCriticos && d.eventosCriticos.length > 0
                    ? d.eventosCriticos.map((e: any) => `- ${e.titulo} (${e.fuente}): ${e.resumenTactico}`).join("\n")
                    : "No se detectaron eventos críticos inmediatos en el barrido actual.";
                  
                  const newContext = `[FUSIÓN OSINT REGIONAL - Noticias RSS]\nSe analizaron ${d.totalNoticiasLeidas} noticias recientes.\n\nEVENTOS TÁCTICOS DETECTADOS:\n${criticos}\n\nCORRELACIÓN DE INTELIGENCIA:\n- Cruce Comercial (DENUE): ${d.correlacionPlataforma?.conexionDenue || "N/A"}\n- Cruce Sociodemográfico (SCINCE): ${d.correlacionPlataforma?.conexionScince || "N/A"}\n- Incidencia Histórica: ${d.correlacionPlataforma?.conexionHistorica || "N/A"}\n\nCONCLUSIÓN OPERATIVA: ${d.conclusionOperativa || "Revisar entorno con precaución."}`;
                  
                  setAnalysisContext((prev) => prev ? `${prev}\n\n${newContext}` : newContext);
                  setIsAnalysisContextAudited(false); // Forzamos a la IA a reevaluar la hipótesis con los nuevos datos
                  alert("¡Fusión OSINT completada!\nLas noticias y su correlación han sido inyectadas en tu Hipótesis.");
                } else {
                  setError(data.message || data.error || "No se pudieron obtener noticias recientes.");
                }
              } catch (err: any) {
                setError(err.message || "Error de red al conectar con el Motor OSINT RSS.");
              } finally {
                setIsCheckingRss(false);
              }
            }}
            className="w-full md:w-auto bg-rose-700 hover:bg-rose-600 text-white py-2 px-4 rounded text-xs font-semibold disabled:opacity-50 transition shadow-lg"
          >
            {isCheckingRss ? <span className="flex items-center justify-center">Analizando Noticias... <ElapsedTime running={isCheckingRss} /></span> : "📡 Realizar Fusión OSINT Regional"}
          </button>
        </div>
      </div>

      {/* MÓDULO DE BÚSQUEDA MULTIMODAL GEO-ESPACIAL */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">Búsqueda Multimodal Geo-Espacial</h4>
          <p className="text-xs text-slate-400">
            Realice un barrido inteligente (IA + Grounding) a 1km de radio usando conceptos visuales y de contexto. Puede agregar múltiples imágenes y búsquedas. La información es obligatoria para cada imagen.
          </p>
        </header>
        <div className="flex flex-col gap-4 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700">
          
          <div className="bg-sky-900/30 border border-sky-800 p-3 rounded-lg text-xs text-sky-200 space-y-2">
            <p className="font-bold text-sky-300">💡 Guía de Contextualización para el Usuario:</p>
            <p>Para obtener los mejores resultados en el barrido de 1km, estructura tu descripción. Ejemplos que activan el barrido:</p>
            <ul className="list-disc pl-4 space-y-1 opacity-90">
              <li>&quot;Busca patrones visuales similares a este grafiti en un radio de 1km para identificar firmas de la misma banda.&quot;</li>
              <li>&quot;Analiza el entorno y ubica puntos de acecho como callejones oscuros o entradas sin visibilidad.&quot;</li>
              <li>&quot;Realiza un barrido de infraestructura dañada; busca postes de luz apagados o muros derribados.&quot;</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="flex-1 min-w-[140px] text-center cursor-pointer rounded-lg border border-emerald-600 bg-emerald-900/30 text-emerald-100 py-2 px-2 text-xs font-semibold hover:bg-emerald-800/50 transition-colors">
              📷 Usar Cámara
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => {
                if (e.target.files) {
                  const newQueries = Array.from(e.target.files).map(file => ({
                    id: Math.random().toString(36).substring(2, 9), file, previewUrl: URL.createObjectURL(file), subject: "", action: "", environment: ""
                  }));
                  setGeoQueries(prev => [...prev, ...newQueries]);
                }
                e.target.value = "";
              }} disabled={isCheckingGeo || isReadOnly} />
            </label>
            <label className="flex-1 min-w-[140px] text-center cursor-pointer rounded-lg border border-sky-600 bg-sky-900/30 text-sky-100 py-2 px-2 text-xs font-semibold hover:bg-sky-800/50 transition-colors">
              📸 Subir Archivo(s)
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                if (e.target.files) {
                  const newQueries = Array.from(e.target.files).map(file => ({
                    id: Math.random().toString(36).substring(2, 9), file, previewUrl: URL.createObjectURL(file), subject: "", action: "", environment: ""
                  }));
                  setGeoQueries(prev => [...prev, ...newQueries]);
                }
                e.target.value = "";
              }} disabled={isCheckingGeo || isReadOnly} />
            </label>
            <button type="button" onClick={() => setGeoQueries(prev => [...prev, { id: Math.random().toString(36).substring(2, 9), file: null, previewUrl: null, subject: "", action: "", environment: "" }])} disabled={isCheckingGeo || isReadOnly} className="flex-1 min-w-[140px] rounded-lg border border-indigo-600 bg-indigo-900/30 text-indigo-100 py-2 px-2 text-xs font-semibold hover:bg-indigo-800/50 transition-colors">
              📝 Búsqueda solo texto
            </button>
          </div>

          {geoQueries.length > 0 && (
            <div className="space-y-4">
              {geoQueries.map((query, index) => (
                <div key={query.id} className="flex flex-col md:flex-row gap-4 p-4 bg-slate-900/80 rounded-lg border border-slate-600 relative shadow-md">
                  <button type="button" onClick={() => {
                    setGeoQueries(prev => {
                      const item = prev.find(q => q.id === query.id);
                      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
                      return prev.filter(q => q.id !== query.id);
                    });
                  }} disabled={isCheckingGeo || isReadOnly} className="absolute top-2 right-2 text-red-400 hover:text-red-300 font-bold text-lg bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center border border-red-900/50 z-10 shadow-sm" title="Borrar y volver a capturar">
                    ✕
                  </button>
                  
                  {query.previewUrl && (
                    <div className="w-full md:w-1/4 flex flex-col gap-2 relative">
                      <img src={query.previewUrl} alt="Preview" className="w-full h-32 md:h-full object-cover rounded border border-slate-600 bg-black" />
                      <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[9px] text-emerald-400 max-w-[90%] truncate">
                        {query.file?.name}
                      </div>
                    </div>
                  )}
                  
                  <div className={`w-full ${query.previewUrl ? 'md:w-3/4' : 'md:w-full'} space-y-3`}>
                    <div className="flex justify-between items-center pr-8">
                      <h5 className="text-xs font-bold text-sky-300">Búsqueda {index + 1}</h5>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-300">Sujeto (¿Qué buscar?)</label>
                        <input type="text" placeholder='ej. "grafitis", "callejones"' value={query.subject} onChange={(e) => {
                          setGeoQueries(prev => prev.map(q => q.id === query.id ? { ...q, subject: e.target.value } : q));
                        }} disabled={isCheckingGeo || isReadOnly} className="w-full bg-slate-800 text-slate-200 border border-slate-600 rounded p-2 text-xs outline-none focus:border-sky-500 disabled:opacity-50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-300">Acción (¿Qué hacer?)</label>
                        <input type="text" placeholder='ej. "busca similares", "identifica"' value={query.action} onChange={(e) => {
                          setGeoQueries(prev => prev.map(q => q.id === query.id ? { ...q, action: e.target.value } : q));
                        }} disabled={isCheckingGeo || isReadOnly} className="w-full bg-slate-800 text-slate-200 border border-slate-600 rounded p-2 text-xs outline-none focus:border-sky-500 disabled:opacity-50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-300">Ambiente (Entorno)</label>
                        <input type="text" placeholder='ej. "zona comercial", "baldío"' value={query.environment} onChange={(e) => {
                          setGeoQueries(prev => prev.map(q => q.id === query.id ? { ...q, environment: e.target.value } : q));
                        }} disabled={isCheckingGeo || isReadOnly} className="w-full bg-slate-800 text-slate-200 border border-slate-600 rounded p-2 text-xs outline-none focus:border-sky-500 disabled:opacity-50" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={geoQueries.length === 0 || !geoQueries.every(q => q.subject.trim() && q.action.trim() && q.environment.trim()) || isCheckingGeo || isReadOnly}
            onClick={async () => {
              setIsCheckingGeo(true);
              setError(null);
              try {
                const selectedPhotos = album.filter((p: any) => selectedIds.includes(p.id) && p.lat && p.lng);
                const photosToUse = selectedPhotos.length > 0 ? selectedPhotos : album.filter((p: any) => p.lat && p.lng);
                if (photosToUse.length === 0) { setError("No hay fotos georreferenciadas en el álbum para establecer el epicentro del barrido."); setIsCheckingGeo(false); return; }
                const centerLat = photosToUse.reduce((acc: number, p: any) => acc + p.lat!, 0) / photosToUse.length;
                const centerLng = photosToUse.reduce((acc: number, p: any) => acc + p.lng!, 0) / photosToUse.length;

                let allFindings = "";
                let allPois: any[] = [];
                let allConcepts: string[] = [];

                for (let i = 0; i < geoQueries.length; i++) {
                   const q = geoQueries[i];
                   let imageBase64 = null;
                   if (q.file) {
                     try { imageBase64 = await resizeImageToBase64(q.file, 800, 0.6); } catch (e) { console.warn(`No se pudo procesar la imagen de referencia ${i+1}.`); }
                   }
                   
                   const res = await fetch("/api/osint/geo-spatial-search", {
                     method: "POST", headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({ lat: centerLat, lng: centerLng, subject: q.subject, action: q.action, environment: q.environment, imageBase64 })
                   });
                   if (!res.ok) {
                     const errorText = await res.text().catch(() => `Error del servidor (código ${res.status})`);
                     if (errorText.toLowerCase().includes("<!doctype html>")) {
                       throw new Error(`Error del servidor (código ${res.status}). La ruta /api/osint/geo-spatial-search no está funcionando correctamente o no existe.`);
                     }
                     throw new Error(errorText);
                   }
                   const data = await res.json();
                   if (data.success) {
                      const d = data.data;
                      const hallazgos = d.hallazgos && d.hallazgos.length > 0 ? d.hallazgos.map((h: any) => `- ${h.nombre} (${h.nivelCoincidencia}): ${h.descripcion}`).join("\n") : "No se identificaron zonas de riesgo coincidentes.";
                      allFindings += `\n\n--- BARRIDO ${i + 1} ---\nParámetros:\n- Sujeto: ${q.subject}\n- Acción: ${q.action}\n- Ambiente: ${q.environment}\nConceptos: ${d.conceptosExtraidos?.join(", ")}\nHallazgos:\n${hallazgos}\nConclusión: ${d.conclusion}`;
                      
                      if (d.conceptosExtraidos) allConcepts.push(...d.conceptosExtraidos);

                      if (d.hallazgos && d.hallazgos.length > 0) {
                        const newPois = d.hallazgos.map((h: any) => ({
                          lat: h.lat,
                          lng: h.lng,
                          label: `Geo-IA: ${h.nombre}`
                        }));
                        allPois.push(...newPois);
                      }
                   } else {
                      throw new Error(data.error || `Error en la búsqueda ${i+1}`);
                   }
                }

                if (allFindings) {
                  const newContext = `[BÚSQUEDA MULTIMODAL GEO-ESPACIAL MÚLTIPLE]\n(INSTRUCCIÓN OBLIGATORIA PARA LA IA: Debes detallar e insertar de manera explícita en tu dictamen final todos y cada uno de los siguientes hallazgos).${allFindings}`;
                  setAnalysisContext((prev) => prev ? `${prev}\n\n${newContext}` : newContext);
                  setIsAnalysisContextAudited(false); 
                  
                  // Cleanup object URLs
                  geoQueries.forEach(q => { if(q.previewUrl) URL.revokeObjectURL(q.previewUrl) });
                  setGeoQueries([]); 
                  
                  if (allPois.length > 0) {
                    setManualPois(prev => [...prev, ...allPois]);
                  }
                  alert("¡Barridos Geo-Espaciales completados con éxito!\nSe han inyectado los análisis en la hipótesis.");
                }
              } catch (err: any) { setError(err.message || "Error de red al conectar con el motor Geo-Espacial."); } finally { setIsCheckingGeo(false); }
            }}
            className="w-full bg-indigo-700 hover:bg-indigo-600 text-white py-3 px-4 rounded-lg text-xs font-bold disabled:opacity-50 transition shadow-lg mt-2 uppercase tracking-wide"
          >
            {isCheckingGeo ? <span className="flex items-center justify-center">Realizando Barrido(s) Multimodal(es)... <ElapsedTime running={isCheckingGeo} /></span> : `🌐 Ejecutar Barrido Geo-Espacial y Añadir a Hipótesis ${geoQueries.length > 0 && geoQueries.every(q => q.subject.trim() && q.action.trim() && q.environment.trim()) ? `(${geoQueries.length})` : ''}`}
          </button>
        </div>
      </div>
      </div>

      {/* EVIDENCIAS ADICIONALES */}
      <div className="pt-6 mt-4 border-t border-slate-800 space-y-4 print:hidden">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">Evidencias</h4>
          <p className="text-xs text-slate-400">
            Adjunte archivos de evidencia adicionales (documentos, imágenes, audios, videos).{" "}
            <strong className="text-amber-400">Obligatorio contextualizar.</strong>
          </p>
        </header>
        <div className="flex flex-col gap-4 items-start w-full">
          <div className="w-full space-y-3 p-5 bg-slate-800/40 rounded-lg border border-slate-700">
            <div className="flex gap-2">
              <label className="flex-1 text-center cursor-pointer rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors">
                📄 Seleccionar Archivo(s)
                <input
                  type="file"
                  multiple
                  disabled={isReadOnly}
                  onChange={(e) => setDocFiles(e.target.files ? Array.from(e.target.files) : [])}
                  className="hidden"
                  accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.ppt,.pptx,.txt,.mp4,.avi,.mkv,.mov,.jpg,.jpeg,.png,.wav,.mp3,.m4a"
                />
              </label>
              <label className="flex-1 text-center cursor-pointer rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors">
                📁 Subir Carpeta Completa
                <input
                  type="file"
                  {...{ webkitdirectory: "true", directory: "true" } as any}
                  multiple
                  disabled={isReadOnly}
                  onChange={(e) => setDocFiles(e.target.files ? Array.from(e.target.files) : [])}
                  className="hidden"
                />
              </label>
            </div>
            {docFiles.length > 0 && (
              <div className="flex justify-between items-center bg-sky-900/20 border border-sky-800 p-2 rounded">
                <span className="text-xs text-sky-400 font-semibold">✓ {docFiles.length} archivo(s) preparado(s) para contextualizar</span>
                <button type="button" onClick={() => setDocFiles([])} className="text-red-400 hover:text-red-300 text-[10px] font-bold">Cancelar</button>
              </div>
            )}
            <div className="w-full relative">
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => toggleDictation('docContext', (text) => {
                    setDocContext(prev => (prev ? `${prev.trim()} ${text}` : text));
                    setIsDocContextAudited(false);
                  })}
                  className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold border ${listeningField === 'docContext' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-slate-600 text-slate-300 bg-slate-800/80 hover:bg-slate-700"}`}
                >
                  <span>🎙️</span> {listeningField === 'docContext' ? "Grabando..." : "Dictar"}
                </button>
              )}
              <textarea
                spellCheck={true}
                value={docContext}
                disabled={isReadOnly}
                onChange={(e) => {
                  setDocContext(e.target.value);
                  setIsDocContextAudited(false);
                }}
                placeholder="Contexto, justificación o descripción del documento (Obligatorio)..."
                className="w-full bg-slate-900 text-slate-200 border border-slate-600 rounded-md p-3 text-sm outline-none focus:border-sky-500 min-h-[100px] disabled:opacity-50"
              />
            </div>
            
            <div className="mt-1 mb-2">
              <div className="flex justify-between items-center text-[10px] mb-1">
                <span className="text-slate-400">Idoneidad del contexto (Semáforo):</span>
                <span className={`font-bold ${docContext.length < 50 ? "text-red-400" : docContext.length < 150 ? "text-amber-400" : "text-emerald-400"}`}>
                  {docContext.length === 0 ? "Sin contexto" : docContext.length < 50 ? "Básico" : docContext.length < 150 ? "Aceptable" : "Óptimo"}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${docContext.length < 50 ? "bg-red-500" : docContext.length < 150 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min((docContext.length / 250) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  setIsRefiningDoc(true);
                  setDocSuggestions("");
                  setDocAuditScore(null);
                  try {
                    const selected = album.filter((p) => selectedIds.includes(p.id));
                    const photosToUse = selected.length > 0 ? selected : album.filter(p => p.lat != null && p.lng != null);
                    const minimalPhotos = photosToUse.map((p) => ({
                      lat: p.lat,
                      lng: p.lng,
                      tipo: p.tipo || "",
                      comentario: p.comentario || ""
                    }));
                    const res = await fetch("/api/refine-context", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        context: docContext + "\n\n(INSTRUCCIÓN DEL SISTEMA: Eres un evaluador empático y flexible. Evalúa SÓLO la pertinencia lógica de la evidencia. NO exijas cantidades, métricas precisas ni datos que requieran investigación OSINT. Si el contexto justifica la evidencia de forma general, otorga un score >= 80. MUY IMPORTANTE: DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO con las claves 'score' (número) y 'suggestions' (string). NO agregues comillas invertidas de markdown como ```json.)",
                        photos: minimalPhotos,
                        mode: "suggest",
                        geometryType: project?.geometryType || "individual",
                        projectDescription: project?.descripcion || "",
                      }),
                    });
                    const textRes = await res.text();
                    let data;
                    try {
                      data = JSON.parse(textRes);
                    } catch (e) {
                      throw new Error(`La ruta /api/refine-context no existe o devolvió HTML (Status: ${res.status}).`);
                    }
                    if (res.ok) {
                      let scoreVal = data.score ?? 0;
                      let suggestionsVal = data.suggestions ?? "";
                      
                      if (suggestionsVal.includes("La respuesta de la IA") || suggestionsVal.includes("```")) {
                        try {
                          const match = suggestionsVal.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                          if (match && match[1]) {
                              const parsed = JSON.parse(match[1]) as Record<string, any>;
                              if (parsed && typeof parsed === 'object') {
                                if (typeof parsed.score === 'number') scoreVal = parsed.score;
                                if (typeof parsed.suggestions === 'string') suggestionsVal = parsed.suggestions;
                              }
                          } else {
                            const jsonMatch = suggestionsVal.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const parsed = JSON.parse(jsonMatch[0]) as Record<string, any>;
                                if (parsed && typeof parsed === 'object') {
                                  if (typeof parsed.score === 'number') scoreVal = parsed.score;
                                  if (typeof parsed.suggestions === 'string') suggestionsVal = parsed.suggestions;
                                }
                            }
                          }
                        } catch (e) {}
                      }

                      setDocSuggestions(suggestionsVal);
                      setDocAuditScore(scoreVal);
                      if (scoreVal >= 80) {
                        setIsDocContextAudited(true);
                      }
                    } else {
                      setError(data.error || "No se pudieron obtener sugerencias de IA.");
                    }
                  } catch (err) {
                    setError("Error de comunicación con IA.");
                  } finally {
                    setIsRefiningDoc(false);
                  }
                }}
                disabled={isRefiningDoc || !docContext.trim() || isReadOnly}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
              >
                {isRefiningDoc ? <span className="flex items-center justify-center">Consultando IA... <ElapsedTime running={isRefiningDoc} /></span> : "Pedir Sugerencias y Auditar Contexto"}
              </button>
            </div>

            {docSuggestions && (
              <div className="mt-2 rounded-md border border-yellow-700 bg-yellow-900/30 px-3 py-2 text-xs text-yellow-200 space-y-2 w-full">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold">Borrador y Sugerencias de IA (Editable):</p>
                  {docAuditScore !== null && (
                    <span className={`px-2 py-1 rounded font-bold ${docAuditScore >= 80 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                      Lógica: {docAuditScore}%
                    </span>
                  )}
                </div>
            <div className="relative w-full">
              <button
                type="button"
                onClick={() => toggleDictation('docSuggestions', (text) => setDocSuggestions(prev => (prev ? `${prev.trim()} ${text}` : text)))}
                className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold border ${listeningField === 'docSuggestions' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-yellow-700 text-yellow-300 bg-yellow-900/80 hover:bg-yellow-800"}`}
              >
                <span>🎙️</span>
              </button>
              <textarea
                spellCheck={true}
                value={docSuggestions}
                onChange={(e) => setDocSuggestions(e.target.value)}
                className="w-full bg-yellow-950/50 border border-yellow-700/50 rounded-md p-3 pr-10 text-sm text-yellow-100 min-h-[100px] focus:outline-none focus:ring-1 focus:ring-yellow-500 resize-y shadow-inner"
              />
            </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDocSuggestions("");
                      setDocAuditScore(null);
                      setIsDocContextAudited(false);
                    }}
                    className="rounded-md border border-red-800 bg-red-900/50 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-800/50"
                  >
                    Descartar (Usar Original)
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsAuditingDoc(true);
                      setError(null);
                      try {
                        const selected = album.filter((p) => selectedIds.includes(p.id));
                        const photosToUse = selected.length > 0 ? selected : album.filter(p => p.lat != null && p.lng != null);
                        const minimalPhotos = photosToUse.map((p) => ({
                          lat: p.lat,
                          lng: p.lng,
                          tipo: p.tipo || "",
                          comentario: p.comentario || ""
                        }));
                        const res = await fetch("/api/refine-context", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ 
                            context: docSuggestions + "\n\n(INSTRUCCIÓN DEL SISTEMA: Eres un evaluador empático y flexible. Evalúa SÓLO la pertinencia lógica. NO exijas cantidades ni datos que requieran investigación OSINT. Si tiene sentido lógico general, otorga un score >= 80. MUY IMPORTANTE: DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO con las claves 'score' (número) y 'suggestions' (string). NO agregues comillas invertidas de markdown como ```json.)", 
                            photos: minimalPhotos,
                            mode: "audit",
                            geometryType: project?.geometryType || "individual",
                            projectDescription: project?.descripcion || "",
                          }),
                        });
                        const textRes = await res.text();
                        let data;
                        try {
                          data = JSON.parse(textRes);
                        } catch (e) {
                          throw new Error(`La ruta /api/refine-context no existe o devolvió HTML (Status: ${res.status}).`);
                        }
                      if (res.ok) {
                        let scoreVal = data.score ?? 0;
                        let suggestionsVal = data.suggestions ?? "";
                        if (suggestionsVal.includes("La respuesta de la IA") || suggestionsVal.includes("```")) {
                          try {
                            const match = suggestionsVal.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                            if (match && match[1]) {
                              const parsed = JSON.parse(match[1]) as Record<string, any>;
                              if (parsed && typeof parsed === 'object') {
                                if (typeof parsed.score === 'number') scoreVal = parsed.score;
                                if (typeof parsed.suggestions === 'string') suggestionsVal = parsed.suggestions;
                              }
                            } else {
                              const jsonMatch = suggestionsVal.match(/\{[\s\S]*\}/);
                              if (jsonMatch) {
                                const parsed = JSON.parse(jsonMatch[0]) as Record<string, any>;
                                if (parsed && typeof parsed === 'object') {
                                  if (typeof parsed.score === 'number') scoreVal = parsed.score;
                                  if (typeof parsed.suggestions === 'string') suggestionsVal = parsed.suggestions;
                                }
                              }
                            }
                          } catch(e) {}
                        }
                        setDocSuggestions(suggestionsVal);
                        setDocAuditScore(scoreVal);
                        if (scoreVal >= 80) setIsDocContextAudited(true);
                      }
                        else setError(data.error || "Error al auditar sugerencia.");
                      } catch (err) { setError("Error de comunicación al auditar."); }
                      finally { setIsAuditingDoc(false); }
                    }}
                    disabled={isAuditingDoc || !docSuggestions.trim()}
                    className="rounded-md bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                  >
                    {isAuditingDoc ? <span className="flex items-center justify-center">Auditando... <ElapsedTime running={isAuditingDoc} /></span> : "Auditar y Mejorar Redacción"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDocContext((prev) => (prev ? `${prev}\n\n${docSuggestions}` : docSuggestions));
                      setDocSuggestions("");
                      setIsDocContextAudited(true);
                    }}
                    disabled={isAuditingDoc || (docAuditScore !== null && docAuditScore < 80)}
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                  >
                    Aplicar al Contexto {(docAuditScore !== null && docAuditScore < 80) ? '(Requiere 80%)' : ''}
                  </button>
                </div>
              </div>
            )}

            {docContext.trim() && !isDocContextAudited && !docSuggestions && (
              <p className="text-xs text-amber-400 mt-1">⚠️ Requiere solicitar sugerencias y auditar el contexto antes de poder subir la evidencia.</p>
            )}
            {isDocContextAudited && (
              <p className="text-xs text-emerald-400 mt-1">✅ Contexto auditado y validado. Listo para subir.</p>
            )}

            <button
              type="button"
              disabled={docFiles.length === 0 || !docContext.trim() || isUploadingDoc || isReadOnly || !isDocContextAudited}
              onClick={async () => {
                if (docFiles.length === 0 || !docContext.trim()) return;
                setIsUploadingDoc(true);
                setError(null);
                try {
                  for (const file of docFiles) {
                    await uploadDocument(file, docContext);
                  }
                  setDocFiles([]);
                  setDocContext("");
                  setIsDocContextAudited(false);
                } catch (e: any) {
                  setError("Error al subir documento(s): " + e.message);
                } finally {
                  setIsUploadingDoc(false);
                }
              }}
              className="w-full bg-sky-700 hover:bg-sky-600 text-white py-1.5 px-4 rounded text-xs font-semibold disabled:opacity-50 transition"
            >
              {isUploadingDoc ? <span className="flex items-center justify-center">Subiendo Evidencia... <ElapsedTime running={isUploadingDoc} /></span> : "Subir Evidencia Contextualizada"}
            </button>
          </div>
          <div className="w-full space-y-2">
            {documents && documents.length > 0 ? documents.map(d => (
              <div key={d.id} className="p-2 bg-slate-800/60 rounded border border-slate-700 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline font-semibold text-[11px] truncate flex-1" title={d.name}>📄 {d.name}</a>
                  {!isReadOnly && (
                    <button onClick={() => removeDocument(d.id)} className="text-red-400 hover:text-red-300 text-[10px] shrink-0">Eliminar</button>
                  )}
                </div>
                {d.context === "PENDIENTE DE CONTEXTUALIZAR EN GABINETE" ? (
                  <PendingEvidenceEditor d={d} projectId={projectId} album={album} selectedIds={selectedIds} project={project} isReadOnly={isReadOnly} />
                ) : (
                  <p className="text-[10px] text-slate-300 bg-slate-900 p-1.5 rounded">{d.context}</p>
                )}
              </div>
            )) : (
              <div className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-700 rounded-lg">No hay evidencias adicionales en este expediente.</div>
            )}
          </div>
        </div>
      </div>
      {/* FIN EVIDENCIAS ADICIONALES */}

      <div className="pt-4 border-t border-slate-800 space-y-2 hidden md:block print:hidden">
        <button
          type="button"
          onClick={() => void handleOpenConfigModal()}
          disabled={isGeneratingAI || isValidatingPhotos || selectedIds.length === 0 || isReadOnly}
          className="w-full inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGeneratingAI || isValidatingPhotos ? (
            <>
              <svg
                className="mr-2 h-4 w-4 animate-spin text-slate-100"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  className="opacity-25"
                  fill="currentColor"
                  d="M12 2a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 15a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Zm7-5a1 1 0 0 1 1 1 8 8 0 0 1-8 8 1 1 0 1 1 0-2 6 6 0 0 0 6-6 1 1 0 0 1 1-1Zm-7-8a8 8 0 0 1 8 8 1 1 0 1 1-2 0 6 6 0 0 0-6-6 1 1 0 1 1 0-2Z"
                />
              </svg>
              {isValidatingPhotos ? <span className="flex items-center gap-1">Auditando evidencia fotográfica... <ElapsedTime running={isValidatingPhotos} /></span> : <span className="flex items-center gap-1">Ejecutando Barrido OSINT e Inteligencia Artificial... <ElapsedTime running={isGeneratingAI} /></span>}
            </>
          ) : aiProfile ? (
            isReadOnly ? "Análisis Protegido (Solo Lectura)" : "Actualizar Informe"
          ) : (
            "Generar Informe"
          )}
        </button>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </div>

      {isGeneratingAI && (
        <div className="animate-pulse space-y-4 p-6 bg-slate-900/40 rounded-xl border border-slate-700/50">
          <div className="h-4 bg-slate-700 rounded w-3/4" />
          <div className="h-4 bg-slate-700 rounded w-full" />
          <div className="h-4 bg-slate-700 rounded w-5/6" />
          <div className="h-32 bg-slate-700/50 rounded w-full mt-6" />
        </div>
      )}

      {(analysisResult || aiProfile) && (
        <div className="flex flex-col space-y-6 w-full">

          {aiProfile && (
            <div className="flex flex-col space-y-3 pt-4 border-t-2 border-indigo-500/60 bg-slate-900/70 rounded-xl p-4 w-full">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-base font-bold text-indigo-200">
                  Perfil criminológico ambiental (IA completa)
                </h4>
                {profileRiskLevel && (
                  <div
                    className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5"
                    title="Nivel de riesgo según incidencia en la zona"
                  >
                    <span className="text-xs font-medium text-slate-400">
                      Riesgo:
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-block h-3 w-3 rounded-full ${
                          profileRiskLevel === "bajo"
                            ? "bg-emerald-500 ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900"
                            : "bg-emerald-500/40"
                        }`}
                        aria-hidden
                      />
                      <span
                        className={`inline-block h-3 w-3 rounded-full ${
                          profileRiskLevel === "medio"
                            ? "bg-amber-500 ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900"
                            : "bg-amber-500/40"
                        }`}
                        aria-hidden
                      />
                      <span
                        className={`inline-block h-3 w-3 rounded-full ${
                          profileRiskLevel === "alto"
                            ? "bg-red-500 ring-2 ring-red-400 ring-offset-1 ring-offset-slate-900"
                            : "bg-red-500/40"
                        }`}
                        aria-hidden
                      />
                    </div>
                    <span
                      className={`text-xs font-semibold capitalize ${
                        profileRiskLevel === "bajo"
                          ? "text-emerald-400"
                          : profileRiskLevel === "medio"
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    >
                      {profileRiskLevel}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2 w-full flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-200">
                    Dictamen editable por el analista
                  </label>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => toggleDictation('editableProfile', (text) => setEditableProfile(prev => (prev ? `${prev.trim()} ${text}` : text)))}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold border transition-colors ${listeningField === 'editableProfile' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-slate-600 text-slate-300 bg-slate-800 hover:bg-slate-700"}`}
                    >
                      <span>🎙️</span> {listeningField === 'editableProfile' ? "Grabando..." : "Dictar edición"}
                    </button>
                  )}
                </div>
                <textarea
                  spellCheck={true}
                  value={editableProfile}
                  onChange={(e) => setEditableProfile(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full min-h-[500px] md:min-h-[750px] bg-slate-900 text-slate-100 border border-slate-700 rounded-lg p-8 text-base md:text-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y shadow-inner disabled:opacity-80 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}

          {analysisResult && (
            <div className="flex flex-col space-y-4 pt-4 border-t-2 border-sky-500/50 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-xl p-4 w-full">
              <h4 className="text-lg font-bold text-sky-200 tracking-tight">
                Análisis Espacial y Estadístico
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Número de Expediente</label>
                  <input 
                    type="text" 
                    value={reportNumber} 
                    onChange={(e) => setReportNumber(e.target.value)} 
                    className="w-full bg-slate-800 text-slate-200 border border-slate-600 rounded p-2 text-xs outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-300">Breve Resumen (Carátula)</label>
                    <button 
                      type="button"
                      onClick={async () => {
                        const contentToSummarize = editableProfile || aiProfile || (project as any)?.analysisContent;
                        if (!contentToSummarize) {
                          alert("No hay dictamen para resumir. Genérelo primero.");
                          return;
                        }
                        setIsGeneratingSummary(true);
                        try {
                          const sumRes = await fetch("/api/refine-context", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              context: "Resume el siguiente dictamen en un solo párrafo de máximo 40 palabras para usarlo en la carátula oficial. Dictamen:\n" + contentToSummarize.substring(0, 2000) + "\n\n(INSTRUCCIÓN: DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO con las claves 'score' (número 100) y 'suggestions' (string con el resumen). NO agregues markdown ni comillas invertidas.)",
                              photos: [],
                              mode: "suggest",
                              geometryType: project?.geometryType || "individual",
                              projectDescription: project?.descripcion || "",
                            })
                          });
                          const sumText = await sumRes.text();
                          let sumData;
                          try { sumData = JSON.parse(sumText); } catch(e) {}
                          if (sumData) {
                            let sVal = sumData.suggestions || "";
                            const match = sVal.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                            if (match && match) { try { const parsed = JSON.parse(match); if (parsed.suggestions) sVal = parsed.suggestions; } catch(e) {} }
                            else if (sVal.trim().startsWith("{")) { try { const parsed = JSON.parse(sVal); if (parsed.suggestions) sVal = parsed.suggestions; } catch(e) {} }
                            setReportSummary(sVal.trim());
                          }
                        } catch (err) {
                          alert("Error al autogenerar el resumen.");
                        } finally {
                          setIsGeneratingSummary(false);
                        }
                      }}
                      disabled={isGeneratingSummary || isReadOnly}
                      className="text-[10px] text-sky-400 hover:text-sky-300 font-medium disabled:opacity-50 transition-colors"
                    >
                      {isGeneratingSummary ? "⏳ Generando..." : "🪄 Auto-Generar"}
                    </button>
                  </div>
                  <textarea 
                    value={reportSummary} 
                    onChange={(e) => setReportSummary(e.target.value)} 
                    disabled={isReadOnly}
                    placeholder="Resumen del contenido del informe..."
                    className="w-full bg-slate-800 text-slate-200 border border-slate-600 rounded p-2 text-xs outline-none focus:border-sky-500 resize-y min-h-[40px] disabled:opacity-60"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 print:hidden">
                {!isReadOnly && projectId && (
                  <button
                    type="button"
                    onClick={handleSaveAnalysis}
                    disabled={isSavingAnalysis}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSavingAnalysis
                      ? "Guardando análisis en expediente…"
                      : hasSavedAnalysis
                      ? "Guardado en expediente"
                      : "Guardar Análisis en Expediente"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleExportToWord()}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
                >
                  Exportar a Word
                </button>
                <button
                  type="button"
                  onClick={handleExportToPDF}
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500 transition-colors"
                >
                  Descargar PDF
                </button>
              </div>

              {analysisResult?.scinceDemographics?.svs !== undefined && (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 print:hidden">
                   <div className="bg-slate-800/60 p-4 border border-slate-700/80 rounded-xl flex items-center justify-between col-span-1 lg:col-span-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-200">Vulnerabilidad Sociodemográfica</h4>
                        <div className="text-[11px] text-slate-400 mt-0.5">CENSINT • SocioDemographic Vulnerability Score</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">🚨</div>
                        <div className="flex flex-col items-end">
                          <span className="text-2xl font-black" style={{color: `#${analysisResult.scinceDemographics.svsColor}`}}>{analysisResult.scinceDemographics.svs}</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{color: `#${analysisResult.scinceDemographics.svsColor}`}}>{analysisResult.scinceDemographics.svsNivel}</span>
                        </div>
                      </div>
                   </div>
                </div>
              )}
              {analysisResult && (
                <div className="w-full mb-3 print:mb-0">
                  <TacticalCharts analysisResult={analysisResult} />
                </div>
              )}
              <div className="w-full mt-3 flex flex-col print:mb-0">
                <TacticalMaps
                  album={album.filter((p) => selectedIds.includes(p.id))}
                  analysisResult={analysisResult}
                  analysisRadius={analysisRadius}
                  analysisPolygon={analysisPolygon}
                  manualPois={manualPois}
                  geometryType={project?.geometryType}
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-3 print:hidden">
                <button
                  type="button"
                  onClick={handleAttachMapSnapshot}
                  className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
                >
                  📸 Añadir 4 Mapas al Informe Word
                </button>
              </div>
              {mapSnapshots.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                  <div className="w-full text-xs font-semibold text-slate-300 mb-1">Mapas adjuntos al reporte Word:</div>
                  {mapSnapshots.map((snap, idx) => (
                    <div key={idx} className="relative group rounded border border-sky-500 overflow-hidden w-28 h-20 bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={snap.dataUrl} alt={snap.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      <button onClick={() => setMapSnapshots(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1.5 py-0.5 hover:bg-red-500 rounded-bl" title="Quitar mapa del reporte">×</button>
                      <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] text-white text-center truncate px-1 py-0.5">{snap.title.replace("Mapa de ", "")}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showConfigModal && (
        <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-[95vw] 2xl:max-w-[1600px] rounded-xl border border-slate-700 bg-slate-900 px-6 md:px-8 py-8 md:py-10 my-8 md:my-auto">
            <h3 className="text-lg font-semibold text-slate-100">
              Configuración del Análisis Táctico
            </h3>
            <div className="flex flex-col gap-8 items-start mt-6 w-full">
            {selectedIds.length >= 1 && (
              <>
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="block text-xs font-medium text-slate-300">
                    Objetivos prioritarios del análisis
                  </p>
                  {(() => {
                    const analysisOptions = [
                      "Incidencia Delictiva Histórica",
                      "Giros Comerciales",
                      "Bares",
                      "Cantinas",
                      "Chatarreras",
                      "Escuelas / Entornos Educativos",
                      "Terrenos Baldíos",
                      "Zonas de Abandono",
                      "Rutas de Escape / Callejones",
                      "Deficiencia de Servicios Públicos",
                      "Iluminación",
                      "Pavimentación",
                      "Otro"
                    ];

                    return (
                      <>
                        <div className="grid grid-cols-1 gap-1 text-xs text-slate-200">
                          {analysisOptions.map((label) => (
                            <label
                              key={label}
                              className="flex items-center gap-2 rounded-md bg-slate-900/60 px-2 py-1"
                            >
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                                checked={focusAreas.includes(label)}
                                onChange={(e) =>
                                  setFocusAreas((prev) =>
                                    e.target.checked
                                      ? [...prev, label]
                                      : prev.filter((x) => x !== label)
                                  )
                                }
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>

                        {focusAreas.includes("Otro") && (
                          <div className="relative mt-2 w-full">
                            <button
                              type="button"
                              onClick={() => toggleDictation('analysisContextExtra', (text) => setAnalysisContextExtra(prev => (prev ? `${prev.trim()} ${text}` : text)))}
                              className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold border ${listeningField === 'analysisContextExtra' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-slate-600 text-slate-300 bg-slate-800/80 hover:bg-slate-700"}`}
                            >
                              <span>🎙️</span>
                            </button>
                            <textarea
                              spellCheck={true}
                              placeholder="Especifique otros objetivos prioritarios del análisis..."
                              value={analysisContextExtra ?? ""}
                              onChange={(e) => setAnalysisContextExtra(e.target.value)}
                              className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 pr-10 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                              rows={4}
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-300">
                    Hipótesis de la Persona Perfiladora (contexto del cruce de ubicaciones)
                  </label>
                  <div className="flex items-center gap-2">
                    {!isReadOnly && projectId && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const { getDb } = await import("@/lib/firebase");
                            const { doc, updateDoc } = await import("firebase/firestore");
                            const firestore = getDb();
                            await updateDoc(doc(firestore, "projects", projectId), {
                              hipotesis: analysisContext
                            });
                            window.alert("Hipótesis guardada exitosamente en el expediente.");
                          } catch (err) {
                            console.error("Error al guardar hipótesis:", err);
                            window.alert("Error al guardar la hipótesis.");
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold border border-emerald-600 text-emerald-300 bg-emerald-900/40 hover:bg-emerald-800 transition-colors"
                      >
                        <span>💾</span> Guardar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleDictation('analysisContext', (text) => {
                        setAnalysisContext(prev => (prev ? `${prev.trim()} ${text}` : text));
                        setIsAnalysisContextAudited(false);
                      })}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold border transition-colors ${listeningField === 'analysisContext' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-slate-600 text-slate-300 bg-slate-800 hover:bg-slate-700"}`}
                    >
                      <span>🎙️</span> {listeningField === 'analysisContext' ? "Grabando..." : "Dictar hipótesis"}
                    </button>
                  </div>
                </div>
                <textarea
                  spellCheck={true}
                  value={analysisContext}
                  onChange={(e) => {
                    setAnalysisContext(e.target.value);
                    setIsAnalysisContextAudited(false);
                  }}
                  rows={8}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 px-5 py-4 text-base md:text-lg resize-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ejemplo: Posible corredor de riesgo entre polígono habitacional y zona de bares, con vulnerabilidad en rutas peatonales sin vigilancia..."
                />
                <div className="mt-1 mb-2">
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className="text-slate-400">Idoneidad de la hipótesis (Semáforo):</span>
                    <span className={`font-bold ${analysisContext.length < 50 ? "text-red-400" : analysisContext.length < 150 ? "text-amber-400" : "text-emerald-400"}`}>
                      {analysisContext.length === 0 ? "Sin contexto" : analysisContext.length < 50 ? "Básico" : analysisContext.length < 150 ? "Aceptable" : "Óptimo"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${analysisContext.length < 50 ? "bg-red-500" : analysisContext.length < 150 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min((analysisContext.length / 250) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
                </div>
                <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsRefining(true);
                      setAnalysisAuditScore(null);
                      try {
                        const selected = album.filter((p) =>
                          selectedIds.includes(p.id)
                        );
                        const minimalPhotos = selected.map((p) => ({
                          lat: p.lat,
                          lng: p.lng,
                          tipo: p.tipo || "",
                          comentario: p.comentario || ""
                        }));
                        
                        let focusContext = focusAreas.length > 0 ? `\nObjetivos prioritarios marcados: ${focusAreas.join(", ")}.` : "";
                        if (analysisContextExtra) focusContext += ` Otros: ${analysisContextExtra}`;
                        
                        let answersString = Object.entries(userAnswersMap)
                          .filter(([_, ans]) => ans.trim())
                          .map(([idx, ans]) => `Pregunta: ${aiQuestionsList[Number(idx)]}\nRespuesta: ${ans}`)
                          .join("\n\n");

                        const fullContext = analysisContext + focusContext + (answersString ? `\n\nRespuestas a preguntas previas:\n${answersString}` : "");

                        const res = await fetch("/api/refine-context", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            context: fullContext,
                            photos: minimalPhotos,
                            mode: "hypothesis-qa",
                            geometryType: project?.geometryType || "individual",
                            projectDescription: project?.descripcion || "",
                          }),
                        });
                        const textRes = await res.text();
                        let data;
                        try {
                          data = JSON.parse(textRes);
                        } catch (e) {
                          throw new Error(`La ruta /api/refine-context no existe o devolvió HTML (Status: ${res.status}).`);
                        }
                        if (res.ok) {
                          let scoreVal = data.score ?? 0;
                          let questionsVal: string[] = Array.isArray(data.questions) ? data.questions : [];
                          if (questionsVal.length === 0 && typeof data.suggestions === "string" && scoreVal < 80) {
                              questionsVal = data.suggestions.split('\n').filter((l: string) => l.trim().length > 10).slice(0,5);
                          }

                          setAnalysisAuditScore(scoreVal);
                          if (scoreVal >= 80) {
                            setIsAnalysisContextAudited(true);
                            if (answersString.trim()) {
                               setAnalysisContext((prev) => prev + "\n\nContexto adicional aportado:\n" + answersString);
                            }
                            setAiQuestionsList([]);
                            setUserAnswersMap({});
                          } else {
                            setAiQuestionsList(questionsVal.length > 0 ? questionsVal.slice(0,5) : [
                            "¿A qué hora del día percibe mayor vulnerabilidad en este punto?",
                            "¿Cómo describiría el estado de la iluminación o deterioro en el lugar específico?",
                            "¿Hacia dónde se dirigen las posibles rutas de escape físicas desde este nodo?",
                            "¿Qué tipo de personas transitaban o frecuentan esta zona cuando observó?",
                            "¿Observó algún obstáculo visual (bardas, maleza, autos) que facilite el acecho?"
                            ]);
                            setIsAnalysisContextAudited(false);
                            if (answersString.trim()) {
                                setAnalysisContext((prev) => prev + "\n\nContexto adicional aportado:\n" + answersString);
                                setUserAnswersMap({});
                            }
                            setQaIteration((prev) => prev + 1);
                          }
                        } else {
                          setError(
                            data.error ||
                              "No se pudieron obtener sugerencias de IA."
                          );
                        }
                      } catch (err) {
                        setError(
                          "Error de comunicación con IA."
                        );
                      } finally {
                        setIsRefining(false);
                      }
                    }}
                    disabled={isRefining || !analysisContext.trim() || isAnalysisContextAudited || (qaIteration > 0 && Object.values(userAnswersMap).filter(a => a.trim().length > 0).length === 0)}
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                  >
                  {isRefining ? <span className="flex items-center justify-center">Validando... <ElapsedTime running={isRefining} /></span> : qaIteration === 0 ? "Validar Hipótesis con IA" : "Reevaluar Hipótesis"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                </div>
              {!isAnalysisContextAudited && aiQuestionsList.length > 0 && (
                <div className="mt-4 rounded-md border border-yellow-700 bg-yellow-900/30 px-4 py-4 text-sm text-yellow-200 space-y-4">
                  <div className="flex flex-col border-b border-yellow-800 pb-2">
                    <p className="font-bold text-yellow-400">💡 La IA sugiere ampliar el espectro para fortalecer el dictamen (Idoneidad actual: {analysisAuditScore}%)</p>
                    <p className="text-xs text-yellow-200/80 mt-1">Responde al menos a una pregunta para sumar puntos de idoneidad y avanzar. No hay respuestas incorrectas, todo aporta al análisis.</p>
                  </div>
                  {aiQuestionsList.map((q, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="text-yellow-100 whitespace-pre-wrap leading-relaxed font-semibold">{idx + 1}. {q}</p>
                      <div className="relative w-full">
                        <button
                          type="button"
                          onClick={() => toggleDictation(`userAnswer-${idx}`, (text) => setUserAnswersMap(prev => ({ ...prev, [idx]: (prev[idx] ? `${prev[idx].trim()} ${text}` : text) })))}
                          className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold border ${listeningField === `userAnswer-${idx}` ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-yellow-700 text-yellow-300 bg-yellow-900/80 hover:bg-yellow-800"}`}
                        >
                          <span>🎙️</span>
                        </button>
                        <textarea
                          spellCheck={true}
                          value={userAnswersMap[idx] || ""}
                          onChange={(e) => setUserAnswersMap(prev => ({ ...prev, [idx]: e.target.value }))}
                          className="w-full bg-yellow-950/50 border border-yellow-700/50 rounded-md p-3 pr-10 text-sm text-yellow-100 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-yellow-500 resize-y shadow-inner"
                          placeholder="Responde aquí para esclarecer la hipótesis..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
              </>
            )}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-medium text-slate-300">
                Radio de búsqueda geoespacial
              </label>
              <input
                type="range"
                min={100}
                max={10000}
                step={100}
                value={analysisRadius}
                onChange={(e) => setAnalysisRadius(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
              <p className="text-xs text-slate-400">
                Radio de búsqueda:{" "}
                <span className="font-semibold text-slate-100">
                  {analysisRadius >= 1000 ? `${(analysisRadius / 1000).toFixed(1)} km` : `${analysisRadius} metros`}
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
            {!isAnalysisContextAudited && aiQuestionsList.length === 0 && (
                <p className="text-xs text-amber-400 text-right">⚠️ Debe validar la hipótesis con la IA antes de comenzar el análisis (Requiere 80%+).</p>
              )}
              {isAnalysisContextAudited && (
                <p className="text-xs text-emerald-400 text-right">✅ Hipótesis validada con éxito (Idoneidad: {analysisAuditScore}%). Lista para generar el análisis.</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void confirmAndGenerateProfile()}
                  disabled={!isAnalysisContextAudited}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generar Informe
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </section>
      {/* CONTENEDOR OCULTO PARA EL PDF OFICIAL (A4 ~ 794px) */}
      <div className="absolute left-[-9999px] top-[-9999px]">
        <div id="official-pdf-content" className="w-[794px] bg-white text-[#222222] font-sans">
          {/* PÁGINA 1: CARÁTULA */}
          <div className="html2pdf__page-break w-[794px] h-[1123px] flex flex-col p-10 bg-white" style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid', breakBefore: 'page' }}>
            <div className="flex justify-between items-center border-b-2 border-[#0D2B52] pb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/logo-ceipol.png" alt="CEIPOL" className="h-24 object-contain" />
              <div className="flex-1 text-center px-4">
                <h1 className="text-2xl font-black text-[#0D2B52] tracking-widest uppercase">DICTAMEN TÁCTICO</h1>
                <h2 className="text-base font-bold text-slate-700 mt-2">PERFIL CRIMINOLÓGICO AMBIENTAL</h2>
                <h3 className="text-xs font-semibold text-slate-500 mt-1 uppercase">Centro de Estudios y Política Criminal</h3>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/logo-ssp.png" alt="SSP" className="h-24 object-contain" />
            </div>

            <div className="flex-1 flex flex-col justify-center items-center text-center px-8">
              <div className="bg-[#0D2B52] text-white py-6 px-10 rounded-t-lg w-full shadow-md">
                <h1 className="text-3xl font-black tracking-widest uppercase leading-tight">{project?.nombre || "Análisis de Polígono"}</h1>
              </div>
              <div className="bg-slate-50 border-x border-b border-slate-300 py-8 px-10 rounded-b-lg w-full shadow-md">
                <div className="grid grid-cols-2 gap-6 text-left">
                  <div className="flex flex-col border-b border-slate-300 pb-3">
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Número de Expediente</span>
                    <span className="font-mono text-slate-800 text-sm mt-1">{reportNumber || project?.id || "DICTAMEN_CRIMINOLOGICO"}</span>
                  </div>
                  <div className="flex flex-col border-b border-slate-300 pb-3">
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Fecha de Emisión</span>
                    <span className="font-mono text-slate-800 text-sm mt-1">{new Date().toLocaleDateString("es-MX", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex flex-col border-b border-slate-300 pb-3">
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Geometría</span>
                    <span className="font-mono text-slate-800 text-sm mt-1 uppercase">{project?.geometryType || "NO DEFINIDA"}</span>
                  </div>
                  <div className="flex flex-col border-b border-slate-300 pb-3">
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Radio de Cobertura</span>
                    <span className="font-mono text-slate-800 text-sm mt-1">{analysisRadius} metros</span>
                  </div>
                </div>
                
                <div className="mt-8 flex flex-col border border-slate-400 bg-slate-100 rounded-lg p-5 text-left shadow-sm">
                  <span className="font-bold text-[#0D2B52] uppercase text-[11px] tracking-wider mb-2 border-b border-slate-300 pb-1">Síntesis Ejecutiva del Dictamen</span>
                  <span className="text-slate-800 text-[13px] leading-relaxed font-medium">
                    {reportSummary || "Dictamen táctico del perfil criminológico ambiental enfocado en el análisis de vulnerabilidades, factores de riesgo y movilidad criminal."}
                  </span>
                </div>

                <div className="mt-6 flex flex-col items-center justify-center p-4 border-2 border-slate-300 rounded-lg bg-white">
                  <span className="font-bold text-slate-600 uppercase text-xs mb-2 tracking-widest">Nivel de Riesgo (IA)</span>
                  <span className={`text-2xl font-black uppercase px-6 py-2 rounded shadow-sm ${profileRiskLevel === 'alto' ? 'bg-red-600 text-white' : profileRiskLevel === 'medio' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}>{profileRiskLevel || "PENDIENTE"}</span>
                </div>
                </div>
              </div>

            <div className="text-center mt-auto border-t border-slate-300 pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documento Estratégico Generado por el Perfilador Remoto CEIPOL</p>
              <p className="text-[10px] text-slate-400">Documento Confidencial - Uso Exclusivo</p>
            </div>
          </div>

          {/* PÁGINAS DE DICTAMEN TEXTUAL */}
          <div className="html2pdf__page-break w-[794px] min-h-[1123px] flex flex-col p-10 bg-white relative" style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid', breakBefore: 'page' }}>
            <div className="flex justify-between items-end border-b-2 border-[#0D2B52] pb-2 mb-6">
               <h2 className="text-xl font-black text-[#0D2B52] uppercase tracking-wider">DICTAMEN TÁCTICO</h2>
               <span className="text-[10px] font-bold text-slate-400 uppercase">{project?.nombre}</span>
            </div>
            
            <div className="text-[11.5px] text-[#333333] whitespace-pre-wrap leading-relaxed text-justify flex-1">
              {(editableProfile || aiProfile || "").replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "[$1]")}
            </div>

            <div className="absolute bottom-10 left-10 right-10 flex justify-between items-center border-t border-slate-300 pt-2">
              <span className="text-[9px] font-bold text-slate-400">CEIPOL</span>
              <span className="text-[9px] text-slate-400">{new Date().toLocaleDateString()}</span>
              <span className="text-[9px] text-slate-400">Dictamen Estratégico</span>
            </div>
          </div>

          {/* ANEXOS DE MAPAS Y GRÁFICAS */}
          {(() => {
            const chartsSnaps = mapSnapshots.filter(s => s.title.toLowerCase().includes("gráfica") || s.title.toLowerCase().includes("grafica"));
            const mapsSnaps = mapSnapshots.filter(s => !chartsSnaps.some((c) => c.title === s.title));

            const renderAnnexPage = (title: string, items: { title: string; dataUrl: string }[]) => {
              if (items.length === 0) return null;
              const chunks: Array<{ title: string; dataUrl: string }[]> = [];
              for (let i = 0; i < items.length; i += 2) chunks.push(items.slice(i, i + 2));

              return chunks.map((chunk: { title: string; dataUrl: string }[], cIdx: number) => (
                <div key={`${title}-chunk-${cIdx}`} className="html2pdf__page-break w-[794px] h-[1123px] flex flex-col p-10 bg-white relative overflow-hidden" style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid', breakBefore: 'page' }}>
                  <div className="flex justify-between items-end border-b-2 border-[#0D2B52] pb-2 mb-6 shrink-0">
                     <h2 className="text-xl font-black text-[#0D2B52] uppercase tracking-wider">{title.toUpperCase()}</h2>
                     <span className="text-[10px] font-bold text-slate-400 uppercase">CEIPOL GEOINT</span>
                  </div>
                  
                  <div className="flex flex-col gap-8 flex-1">
                    {chunk.map((snap: { title: string; dataUrl: string }, i: number) => (
                      <div key={i} className="border border-slate-300 p-4 rounded-lg flex flex-col bg-slate-50 overflow-hidden h-[420px]">
                        <h4 className="text-sm font-bold text-white bg-[#0D2B52] px-3 py-1.5 rounded-t-md text-left uppercase tracking-wide shrink-0">
                          {snap.title}
                        </h4>
                        <div className="flex-1 relative bg-white border border-slate-200 flex items-center justify-center p-2 rounded-b-md">
                          <img src={snap.dataUrl} className="max-w-full max-h-full object-contain" alt={snap.title} />
                        </div>
                        <div className="mt-2 pt-2 shrink-0">
                          <p className="text-[9px] text-slate-500 font-bold uppercase">Fuente: Plataforma de Geointeligencia SAI | CEIPOL</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-10 left-10 right-10 flex justify-between items-center border-t border-slate-300 pt-2 shrink-0">
                    <span className="text-[9px] font-bold text-slate-400">CEIPOL</span>
                    <span className="text-[9px] text-slate-400">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              ));
            };

            return (
              <>
                {renderAnnexPage("Atlas Cartográfico", mapsSnaps)}
                {renderAnnexPage("Modelos Analíticos", chartsSnaps)}
              </>
            );
          })()}

          {/* ANEXO FOTOGRÁFICO */}
          {(() => {
            const selectedPhotos = album.filter(p => selectedIds.includes(p.id));
            if (selectedPhotos.length === 0) return null;

            const photoChunks: Array<typeof album> = [];
            for (let i = 0; i < selectedPhotos.length; i += 2) {
              photoChunks.push(selectedPhotos.slice(i, i + 2));
            }

            return photoChunks.map((chunk, idx) => (
              <div key={`photo-chunk-${idx}`} className="html2pdf__page-break w-[794px] h-[1123px] flex flex-col p-10 bg-white relative overflow-hidden" style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid', breakBefore: 'page' }}>
                <div className="flex justify-between items-end border-b-2 border-[#0D2B52] pb-2 mb-6 shrink-0">
                   <h2 className="text-xl font-black text-[#0D2B52] uppercase tracking-wider">ANEXO FOTOGRÁFICO Y TRABAJO DE CAMPO</h2>
                   <span className="text-[10px] font-bold text-slate-400 uppercase">INSPECCIÓN IN-SITU</span>
                </div>
                
                <div className="flex flex-col gap-8 flex-1">
                  {chunk.map((p, i) => (
                    <div key={p.id} className="border border-slate-300 rounded-lg flex flex-row bg-slate-50 h-[420px] overflow-hidden">
                      {/* Fotografía izquierda */}
                    <div className="w-1/2 bg-black relative flex items-center justify-center p-1 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.previewUrl || ""} alt={`Evidencia ${p.tipo || ""}`} className="max-w-full max-h-full object-contain z-0" />
                      <div className="absolute bottom-3 right-3 flex items-center justify-center pointer-events-none z-10 bg-black/60 px-3 py-1.5 rounded border border-white/20">
                        <span className="text-white/90 font-bold text-[10px] select-none tracking-widest drop-shadow-md">
                          SSPE-CEIPOL
                        </span>
                      </div>
                      </div>
                      {/* Texto derecha */}
                      <div className="w-1/2 flex flex-col p-5 bg-white border-l border-slate-300">
                        <h4 className="text-sm font-black text-white bg-[#1F4E79] px-3 py-1.5 rounded uppercase mb-4 shrink-0 shadow-sm">
                          Evidencia {idx * 2 + i + 1} - {p.tipo || "Registro Táctico"}
                        </h4>
                        <div className="bg-slate-50 p-4 rounded border border-slate-200 flex-1 overflow-hidden">
                          <p className="text-[11px] text-slate-700 leading-relaxed text-justify">
                            {p.comentario || "Sin comentario analítico registrado."}
                          </p>
                        </div>
                        <div className="mt-4 pt-2 border-t border-slate-200 shrink-0">
                           <p className="text-[9px] text-slate-500 font-bold uppercase">Fuente: Trabajo de Campo | {new Date().toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                ))}
                </div>

                <div className="absolute bottom-10 left-10 right-10 flex justify-between items-center border-t border-slate-300 pt-2 shrink-0">
                  <span className="text-[9px] font-bold text-slate-400">CEIPOL</span>
                  <span className="text-[9px] text-slate-400">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* MODAL DE EDICIÓN DE VENTANA */}
      {editingPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-lg bg-slate-900 border border-sky-600 rounded-xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-sky-200">Ventana de Edición de Contexto</h3>
            <p className="text-xs text-slate-400">Edite la contextualización de la evidencia de manera cómoda.</p>
            <textarea
              spellCheck={true}
              value={editingPhoto.comentario || ""}
              onChange={(e) => {
                updatePhotoMeta(editingPhoto.id, { tipo: editingPhoto.tipo, comentario: e.target.value });
                setEditingPhoto({ ...editingPhoto, comentario: e.target.value });
              }}
              className="w-full min-h-[150px] bg-slate-800 text-slate-100 border border-slate-600 rounded-md p-4 text-sm focus:outline-none focus:border-sky-500 resize-y shadow-inner"
              placeholder="Escribe el comentario detallado aquí..."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingPhoto(null)} className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-colors shadow-md">
                Aceptar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
