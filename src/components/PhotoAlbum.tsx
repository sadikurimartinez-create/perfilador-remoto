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
import { pingOsint, getScinceData, getDenueData, getTelegramOsintData, getRnpdnoData, getRepuveData } from "@/lib/osintActions";
import { runOSINTScan } from "../utils/osintEngine";
import { CifaCeipolPanel } from "./CifaCeipolPanel";
import { ProjectMap } from "./ProjectMap";
import { GangGeoSweepPanel } from "./GangGeoSweepPanel";
import { CrimeCharts } from "./CrimeCharts";

import { PowerUpsModule } from "./powerups/PowerUpsModule";
import { VentanaResultadosPuente } from "./powerups/VentanaResultadosPuente";

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
  const { documents, saveCustomDocument, removeDocument } = useProject();
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
          context: context + `\n\n(INSTRUCCIÓN DEL SISTEMA: Eres un Arquitecto de Datos e IA. Evalúa la idoneidad técnica del contexto. Endurece tu criterio: el texto debe dar directrices claras para el procesamiento. Si es claro, score >= 80; si es vago, score < 80. OBLIGATORIO: Sin importar el score, SIEMPRE genera 3 sugerencias de refinamiento técnico usando estos Power-Ups según aplique: 1. IMAGEN/PDF: "Ejecuta OCR Avanzado y Extracción de Atributos Visuales". 2. AUDIO: "Aplica Análisis de Diarización y Sentimiento". 3. GEOESPACIAL: "Consulta de Proximidad ST_DWithin y Grounding Dinámico". 4. TEXTO: "Activa Extracción de Entidades Salientes". 5. HISTÓRICO: "Búsqueda Semántica en Discovery Engine". Explica por qué usar el término mejora la extracción. DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO con las claves 'score' (número) y 'suggestions' (string). NO uses markdown.)`,
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
       
       {!isReadOnly && (
         <div className="mt-1.5 mb-1.5">
           <PowerUpsModule
             onApplyPowerUp={(text) => {
               setContext((prev) => (prev ? prev.trim() + " " : "") + text);
               setIsAudited(false);
             }}
             isReadOnly={isReadOnly}
             insumoText={context || ""}
             insumoType="document_pending"
             insumoId={d.id}
             insumoName={d.name || "Evidencia de Campo"}
             isContextualized={isAudited}
             onApplyDetailedAnalysis={async (results) => {
               for (const res of results) {
                 res.insumoId = d.id;
                 await saveCustomDocument(
                   `Resultados Puente Contextual: ${res.powerUpTitle}`,
                   "powerup_execution",
                   JSON.stringify(res)
                 );
               }
             }}
           />
         </div>
       )}

       {/* Persisted Puente Results */}
       {documents && documents
         .filter((doc: any) => doc.type === "powerup_execution")
         .map((doc: any) => {
           try {
             const parsed = JSON.parse(doc.context);
             if (parsed.insumoId === d.id) {
               return (
                 <div key={doc.id} className="mt-2 text-left">
                   <VentanaResultadosPuente
                     data={parsed}
                     onRemove={isReadOnly ? undefined : () => removeDocument(doc.id)}
                   />
                 </div>
               );
             }
           } catch (err) {
             console.error("Error parsing powerup_execution doc.context", err);
           }
           return null;
         })
       }

       <div className="flex items-center gap-2 mt-1">
          <button type="button" onClick={handleRequestSuggestions} disabled={isRefining || !context.trim() || isReadOnly} className="bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-md text-white text-[11px] font-semibold disabled:opacity-50 transition-colors">
              {isRefining ? "Consultando IA..." : "Auditar Contexto"}
          </button>
       </div>
       {suggestions && (
           <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-md text-xs text-yellow-200 mt-2 space-y-2">
               <div className="flex justify-between items-center"><p className="font-semibold">Sugerencias IA:</p>{auditScore !== null && (<span className={`px-2 py-0.5 rounded font-bold ${auditScore >= 80 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>Lógica: {auditScore}%</span>)}</div>
               <textarea value={suggestions} onChange={(e) => setSuggestions(e.target.value)} className="w-full bg-yellow-950/50 border border-yellow-700/50 rounded p-2 text-yellow-100 min-h-[60px] focus:outline-none" />
               <div className="flex gap-2"><button type="button" onClick={() => { setContext(c => c + "\n\n" + suggestions); setSuggestions(""); setIsAudited(true); }} className="bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-1 rounded font-medium text-[11px]">Aplicar Power-Up Sugerido</button><button type="button" onClick={() => { setSuggestions(""); setAuditScore(null); setIsAudited(false); }} className="bg-red-900/50 border border-red-800 text-red-200 hover:bg-red-800/50 px-2 py-1 rounded font-medium text-[11px]">Descartar</button></div>
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

const DELITOS_CATEGORIES = [
  { id: "Homicidios_2025.csv", label: "Homicidios" },
  { id: "Feminicidios_2025.csv", label: "Feminicidios" },
  { id: "Extorsion & Fraude 2025.csv", label: "Extorsión y Fraude" },
  { id: "PERSONA 2025.csv", label: "Delitos contra las Personas" },
  { id: "Robo casa 2025.csv", label: "Robo a Casa Habitación" },
  { id: "Robo negocio 2025.csv", label: "Robo a Negocio" },
  { id: "Robo vehicular 2025.csv", label: "Robo Vehicular" },
  { id: "Robo motocicleta 2025.csv", label: "Robo de Motocicleta" },
  { id: "Autopartes & Cristalazo 2025.csv", label: "Autopartes y Cristalazo" }
];

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
    saveCustomDocument,
    isReadOnly,
    markAsPrinted,
    uploadAndAddPhoto,
    datosGobMxResult, // <-- Obtener del contexto
    setDatosGobMxResult,
    softDeleteDoc,
    savePhotoContextualization,
    updateProjectDetails,
    updatePhotoCoordinates,
    loadProject,
  } = useProject();

  const svContainerRef = useRef<HTMLDivElement | null>(null);
  const [svError, setSvError] = useState<string | null>(null);
  const [activeDelitos, setActiveDelitos] = useState<string[]>(DELITOS_CATEGORIES.map(d => d.id));
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isCheckingIncidencia, setIsCheckingIncidencia] = useState(false);
  const [delitoText, setDelitoText] = useState("");

  useEffect(() => {
    if (project) {
      if (project.contextoIncidencia) {
        setDelitoText(project.contextoIncidencia);
      }
      if (project.delitosSeleccionados && project.delitosSeleccionados.length > 0) {
        setActiveDelitos(project.delitosSeleccionados);
      }
    }
  }, [project]);

  useEffect(() => {
    let active = true;
    const initStreetView = () => {
      if (typeof window === "undefined" || !window.google || !svContainerRef.current) {
        if (active) {
          setTimeout(initStreetView, 1000);
        }
        return;
      }
      const selectedPhotos = album.filter(p => selectedIds.includes(p.id) && p.lat && p.lng);
      const photosToUse = selectedPhotos.length > 0 ? selectedPhotos : album.filter(p => p.lat && p.lng);
      if (photosToUse.length === 0) return;
      const centerLat = photosToUse.reduce((acc, p) => acc + p.lat!, 0) / photosToUse.length;
      const centerLng = photosToUse.reduce((acc, p) => acc + p.lng!, 0) / photosToUse.length;

      try {
        const svService = new window.google.maps.StreetViewService();
        svService.getPanorama({
          location: { lat: centerLat, lng: centerLng },
          radius: 150
        }, (data, status) => {
          if (!active) return;
          if (status === window.google.maps.StreetViewStatus.OK && data && data.location && data.location.latLng) {
            setSvError(null);
            new window.google.maps.StreetViewPanorama(svContainerRef.current!, {
              position: data.location.latLng,
              pov: { heading: 34, pitch: 10 },
              zoom: 1,
              addressControl: true,
              linksControl: true,
              panControl: true,
              enableCloseButton: false
            });
          } else {
            setSvError("No se encontraron panoramas de Street View en un radio de 150 metros de esta ubicación.");
          }
        });
      } catch (e) {
        console.error("Error loading Street View panorama:", e);
      }
    };

    initStreetView();
    return () => {
      active = false;
    };
  }, [album, selectedIds]);

  const [error, setError] = useState<string | null>(null);
  const [savingPhotoId, setSavingPhotoId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: "Proyecto" | "Fotografía" | "Documento";
    id: string;
    projectId?: string;
  } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
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
    if (project && project.reportSummary && !reportSummary) {
      setReportSummary(project.reportSummary);
    }
    if (project && project.hipotesis && !analysisContext) {
      setAnalysisContext(project.hipotesis);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // Estado para Consulta Vehicular OSINT
  const [plateQuery, setPlateQuery] = useState("");
  const [isCheckingPlate, setIsCheckingPlate] = useState(false);
  const [plateContext, setPlateContext] = useState("");



  // Estado para Consulta TELEGRAM OSINT
  const [telegramQuery, setTelegramQuery] = useState("");
  const [isCheckingTelegram, setIsCheckingTelegram] = useState(false);
  const [telegramContext, setTelegramContext] = useState("");
  const [osintSuiteTab, setOsintSuiteTab] = useState<"telegram" | "territorial">("territorial");

  // Estado para Consulta RNPDNO (Desaparecidos)
  const [rnpdnoEstado, setRnpdnoEstado] = useState("Aguascalientes");
  const [rnpdnoMunicipio, setRnpdnoMunicipio] = useState("Todos");
  const [isCheckingRnpdno, setIsCheckingRnpdno] = useState(false);
  const [rnpdnoContext, setRnpdnoContext] = useState("");

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

  const handleGenerateFinalReport = async () => {
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
      const instructionPhotos = `\n\n(INSTRUCCIÓN DEL SISTEMA: Eres un Arquitecto de Datos e IA evaluando la evidencia de campo. Endurece tu criterio: busca indicaciones técnicas. Si el comentario describe bien el entorno y qué buscar, otorga score >= 80; si es vago, score < 80. OBLIGATORIO: Sin importar el score, SIEMPRE incluye en tus 'suggestions' 3 recomendaciones técnicas usando estos Power-Ups: 1. IMÁGENES: Sugiere "Ejecuta OCR Avanzado y Extracción de Atributos Visuales". 2. GEOESPACIAL: Sugiere "Consulta de Proximidad ST_DWithin y Grounding Dinámico". 3. TEXTO: Sugiere "Activa Extracción de Entidades Salientes". Explica por qué esto afina a la IA. DEVUELVE UN JSON VÁLIDO con 'score' y 'suggestions'.)`;
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
    } catch (err: any) {
      console.error("Error al validar fotos:", err);
      setError(err.message || "Error de comunicación al validar evidencia. Intente de nuevo.");
      setIsValidatingPhotos(false);
      return;
    }
    setIsValidatingPhotos(false);

    // If validation passes, proceed directly to generation
    await confirmAndGenerateProfile();
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

      // Usar el centroide geográfico real de las evidencias seleccionadas, no la ciudad de Aguascalientes por defecto
      const centerLat = withCoords.reduce((acc, p) => acc + p.lat!, 0) / withCoords.length;
      const centerLng = withCoords.reduce((acc, p) => acc + p.lng!, 0) / withCoords.length;
      const lat = centerLat || 21.8818;
      const lng = centerLng || -102.2915;

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
        body: JSON.stringify({ lat, lng, radius: analysisRadius }), // Forzamos a la BDD a respetar el radio
      }).catch(e => {
        console.error("[PhotoAlbum] Error /api/incidencia:", e);
        return null;
      });

      const osintPromise = runOSINTScan({ ...project, latitude: lat, longitude: lng }).catch(e => {
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
        try {
          const mapText = await mapRes.text();
          if (mapText) {
            const mapData = JSON.parse(mapText);
            currentAnalysisResult = mapData;
            setAnalysisResult(mapData);
            if (mapData.tacticalStreetViews) svData = mapData.tacticalStreetViews;
          }
        } catch (err) {
          console.warn("JSON Parse Error en mapRes:", err);
        }
      }

      let incidenciaLocal: any[] = [];
      let bibliografiaLocal = "";
      if (incidenciaRes && incidenciaRes.ok) {
        try {
          const incText = await incidenciaRes.text();
          if (incText) {
            const incidenciaJson = JSON.parse(incText) as any;
            incidenciaLocal = (incidenciaJson.data ?? []).slice(0, 30);
            bibliografiaLocal = incidenciaJson.bibliografia ?? "";
            setDebugData((prev: any) => ({
              ...(prev ?? {}),
              incidencia: incidenciaLocal,
              bibliografia: bibliografiaLocal,
            }));
          }
        } catch (err) {
          console.warn("JSON Parse Error en incidenciaRes:", err);
        }
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
            linkedGangReport: project?.linkedGangReport,
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

        const resText = await res.text();
        let data: any;
        try {
          data = JSON.parse(resText);
        } catch (err) {
          throw new Error("El servidor devolvió una respuesta vacía o incompleta (Timeout). Intente generar el informe nuevamente.");
        }
        
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

        if (automaticOsintData?.streetViewAnalysis?.analisis) {
          finalMarkdown += `\n\n### BARRIDO MULTIMODAL DE STREET VIEW (IA)\n${automaticOsintData.streetViewAnalysis.analisis}`;
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
      { id: "chart-export-1", title: "GRÁFICA 1: DISTRIBUCIÓN TEMPORAL DEL DELITO POR TURNO" },
      { id: "chart-export-2", title: "GRÁFICA 2: TOPOLOGÍA Y FRECUENCIA DE INCIDENTES (TOP 5)" },
      { id: "chart-export-3", title: "GRÁFICA 3: FACILITADORES AMBIENTALES DE OPORTUNIDAD" },
      { id: "chart-export-4", title: "GRÁFICA 4: PREDICCIÓN DE AUMENTO DE INCIDENCIA (6 MESES)" }
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
      photosToExportData.push({
        url: p.previewUrl as string,
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
      {error && (
        <div className="bg-red-900/40 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-xs font-semibold relative mb-4 flex justify-between items-center gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-200 hover:text-red-100 font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}
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
                  {!isReadOnly && (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setDeleteModal({
                          isOpen: true,
                          type: "Fotografía",
                          id: p.id,
                          projectId: projectId || project?.id
                        });
                      }}
                      className="absolute top-0 right-0 rounded p-1 bg-red-600/90 text-white hover:bg-red-500"
                      title="Eliminar fotografía (Controlado)"
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
                  {!isReadOnly && (
                    <div className="mt-1.5 mb-1.5">
                      <PowerUpsModule
                        onApplyPowerUp={(text) =>
                          updatePhotoMeta(p.id, {
                            tipo: p.tipo,
                            comentario: ((p.comentario || "").trim() + " " + text).trim(),
                          })
                        }
                        isReadOnly={isReadOnly}
                        insumoText={p.comentario || ""}
                        insumoType="photo"
                        insumoId={p.id}
                        insumoName={p.tipo || "Evidencia Fotográfica"}
                        locationCoords={p.lat && p.lng ? { lat: p.lat, lng: p.lng } : undefined}
                        isContextualized={p.isContextualized}
                        onApplyDetailedAnalysis={async (results) => {
                          for (const res of results) {
                            res.insumoId = p.id;
                            await saveCustomDocument(
                              `Resultados Puente Contextual: ${res.powerUpTitle}`,
                              "powerup_execution",
                              JSON.stringify(res)
                            );
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Persisted Puente Results for this photo */}
                  {documents && documents
                    .filter((doc: any) => doc.type === "powerup_execution")
                    .map((doc: any) => {
                      try {
                        const parsed = JSON.parse(doc.context);
                        if (parsed.insumoId === p.id) {
                          return (
                            <div key={doc.id} className="mt-2 text-left">
                              <VentanaResultadosPuente
                                data={parsed}
                                onRemove={isReadOnly ? undefined : () => removeDocument(doc.id)}
                              />
                            </div>
                          );
                        }
                      } catch (err) {
                        console.error("Error parsing powerup_execution doc.context", err);
                      }
                      return null;
                    })
                  }

                  <div className="mt-1 mb-2">
                    <div className="flex justify-between items-center text-[9px] mb-0.5">
                      <span className="text-slate-400">Idoneidad técnica (Longitud mínima):</span>
                      <span className={`font-bold ${(p.comentario || "").length < 40 ? "text-red-400" : (p.comentario || "").length < 120 ? "text-amber-400" : "text-emerald-400"}`}>
                        {(p.comentario || "").length === 0 ? "Sin contexto" : (p.comentario || "").length < 40 ? "Básico" : (p.comentario || "").length < 120 ? "Aceptable" : "Óptimo"}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1">
                      <div 
                        className={`h-1 rounded-full transition-all duration-300 ${(p.comentario || "").length < 40 ? "bg-red-500" : (p.comentario || "").length < 120 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(((p.comentario || "").length / 200) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* BOTÓN Y ESTADO DE GUARDAR CONTEXTUALIZACIÓN (REQUERIMIENTO 1) */}
                  <div className="mt-2.5 mb-2.5 bg-slate-900/50 p-2 rounded-lg border border-slate-800/40 flex flex-col gap-2">
                    {p.evidenceId ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                            🛡️ EVIDENCIA: {p.evidenceId}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            Guardado el {new Date(p.contextualizedAt || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-400 leading-normal">
                          Usuario: <strong className="text-slate-300">@{p.contextualizedBy || "Local"}</strong> | Coords: <strong className="text-slate-300">{p.lat?.toFixed(5)}, {p.lng?.toFixed(5)}</strong>
                        </span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            disabled={savingPhotoId === p.id}
                            onClick={async () => {
                              try {
                                setSavingPhotoId(p.id);
                                const evId = await savePhotoContextualization(p.id);
                                alert(`¡Contextualización actualizada!\nFolio: ${evId}`);
                              } catch (err: any) {
                                alert("Error: " + err.message);
                              } finally {
                                setSavingPhotoId(null);
                              }
                            }}
                            className="mt-1 text-center w-full bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] py-1 px-2 rounded border border-slate-700 font-semibold transition"
                          >
                            {savingPhotoId === p.id ? "Actualizando..." : "Actualizar Contextualización"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <div className="text-[9px] text-amber-400 font-medium leading-relaxed flex items-center gap-1">
                          ⚠️ Pendiente de guardar en Cadena de Custodia.
                        </div>
                        {!isReadOnly && (
                          <button
                            type="button"
                            disabled={savingPhotoId === p.id}
                            onClick={async () => {
                              try {
                                setSavingPhotoId(p.id);
                                const evId = await savePhotoContextualization(p.id);
                                alert(`¡Evidencia contextualizada y guardada con éxito!\nFolio único generado: ${evId}`);
                              } catch (err: any) {
                                alert("Error: " + err.message);
                              } finally {
                                setSavingPhotoId(null);
                              }
                            }}
                            className="w-full bg-gradient-to-r from-sky-700 to-indigo-850 hover:from-sky-600 hover:to-indigo-750 text-white font-bold text-[10px] py-1.5 px-3 rounded shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1"
                          >
                            {savingPhotoId === p.id ? "Guardando..." : "💾 Guardar Contextualización"}
                          </button>
                        )}
                      </div>
                    )}
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

      {/* PASO 2: MAPA INTERACTIVO */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">📍 Mapa Interactivo de Evidencias (Paso 2)</h4>
          <p className="text-xs text-slate-400">
            Visualización en tiempo real del polígono de interés y la geolocalización de las evidencias de campo.
          </p>
        </header>
        <div className="w-full overflow-hidden rounded-lg border border-slate-700">
          {album.length > 0 && project && (
            <ProjectMap
              project={project}
              album={album.filter(p => p.lat != null && p.lng != null)}
              geometryType={project.geometryType || "individual"}
              coordinates={album.filter(p => p.lat != null && p.lng != null).map((photo) => ({
                lat: photo.lat as number,
                lng: photo.lng as number,
              }))}
              onUpdateCoordinates={(newCoords) => {
                newCoords.forEach((coord, idx) => {
                  const photo = album.filter(p => p.lat != null && p.lng != null)[idx];
                  if (photo && (photo.lat !== coord.lat || photo.lng !== coord.lng)) {
                    void updatePhotoCoordinates(photo.id, coord.lat, coord.lng);
                  }
                });
              }}
            />
          )}
        </div>
      </div>

      {/* PASO 3: STREET VIEW PANORAMA */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">🛣️ Street View - Entorno Virtual (Paso 3)</h4>
          <p className="text-xs text-slate-400">
            Exploración a pie de calle de las inmediaciones del punto central de las evidencias seleccionadas.
          </p>
        </header>
        {svError ? (
          <div className="p-4 bg-amber-950/20 border border-amber-800 text-amber-300 rounded-lg text-xs">
            ⚠️ {svError}
          </div>
        ) : (
          <div 
            ref={svContainerRef} 
            style={{ width: "100%", height: "400px" }} 
            className="rounded-lg border border-slate-700 overflow-hidden bg-black"
          />
        )}
      </div>

      {/* PASO 4: CONTEXTUALIZACIÓN GENERAL */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">🧠 Contextualización General e Hipótesis (Paso 4)</h4>
          <p className="text-xs text-slate-400">
            Escriba la hipótesis de análisis táctico y audítela con la IA para afinar el rigor técnico (Mínimo 80% requerido).
          </p>
        </header>
        <div className="flex flex-col gap-4 items-start w-full">
          <div className="space-y-4 w-full">
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
              rows={6}
              className="w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 px-4 py-3 text-sm resize-y focus:ring-2 focus:ring-sky-500 focus:outline-none"
              placeholder="Ejemplo: Posible corredor de riesgo entre polígono habitacional y zona de bares, con vulnerabilidad en rutas peatonales sin de vigilancia..."
            />
            {!isReadOnly && (
              <div className="mt-1.5">
                <PowerUpsModule
                  onApplyPowerUp={(text) => {
                    setAnalysisContext((prev) => (prev ? prev.trim() + " " : "") + text);
                    setIsAnalysisContextAudited(false);
                  }}
                  isReadOnly={isReadOnly}
                  insumoText={analysisContext || ""}
                  insumoType="hypothesis"
                  insumoId="main_hypothesis"
                  insumoName="Hipótesis de Análisis"
                  isContextualized={isAnalysisContextAudited}
                  locationCoords={(() => {
                    const geo = album.find(p => p.lat != null && p.lng != null);
                    return geo ? { lat: geo.lat!, lng: geo.lng! } : undefined;
                  })()}
                  onApplyDetailedAnalysis={async (results) => {
                    for (const res of results) {
                      res.insumoId = "main_hypothesis";
                      await saveCustomDocument(
                        `Resultados Puente Contextual: ${res.powerUpTitle}`,
                        "powerup_execution",
                        JSON.stringify(res)
                      );
                    }
                  }}
                />
              </div>
            )}
            {documents && documents
              .filter((doc: any) => doc.type === "powerup_execution")
              .map((doc: any) => {
                try {
                  const parsed = JSON.parse(doc.context);
                  if (parsed.insumoId === "main_hypothesis") {
                    return (
                      <div key={doc.id} className="mt-2 text-left">
                        <VentanaResultadosPuente
                          data={parsed}
                          onRemove={isReadOnly ? undefined : () => removeDocument(doc.id)}
                        />
                      </div>
                    );
                  }
                } catch (err) {
                  console.error("Error parsing powerup_execution doc.context", err);
                }
                return null;
              })
            }
            <div className="mt-1 mb-2">
              <div className="flex justify-between items-center text-[10px] mb-1">
                <span className="text-slate-400">Idoneidad técnica (Longitud mínima):</span>
                <span className={`font-bold ${analysisContext.length < 60 ? "text-red-400" : analysisContext.length < 180 ? "text-amber-400" : "text-emerald-400"}`}>
                  {analysisContext.length === 0 ? "Sin contexto" : analysisContext.length < 60 ? "Básico" : analysisContext.length < 180 ? "Aceptable" : "Óptimo"}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${analysisContext.length < 60 ? "bg-red-500" : analysisContext.length < 180 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min((analysisContext.length / 250) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    setIsRefining(true);
                    setAnalysisAuditScore(null);
                    try {
                      const selected = album.filter((p) => selectedIds.includes(p.id));
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

                      const fullContext = analysisContext + focusContext + (answersString ? `\n\nRespuestas a preguntas previas:\n${answersString}` : "") + `\n\n(INSTRUCCIÓN DEL SISTEMA: Eres un Arquitecto de Datos e IA. Evalúa la hipótesis. Endurece el criterio: debe dar dirección técnica a las APIs. Si es sólida, score >= 80; si es vaga, score < 80. OBLIGATORIO: SIEMPRE incorpora en tus 'questions' o 'suggestions' al menos 3 sugerencias técnicas que inviten a usar: "Consulta de Proximidad ST_DWithin", "Grounding Dinámico", "Extracción de Entidades Salientes", o "Búsqueda Semántica en Discovery Engine". Explica brevemente el porqué. DEVUELVE UN JSON VÁLIDO.)`;

                      const res = await fetch("/api/refine-context", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          context: fullContext,
                          photos: minimalPhotos,
                          mode: "hypothesis-qa",
                          geometryType: project?.geometryType || "individual",
                          projectDescription: project?.descripcion || "",
                          analysisRadius,
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
                        setError(data.error || "No se pudieron obtener sugerencias de IA.");
                      }
                    } catch (err) {
                      setError("Error de comunicación con IA.");
                    } finally {
                      setIsRefining(false);
                    }
                  }}
                  disabled={isRefining || !analysisContext.trim() || isAnalysisContextAudited || (qaIteration > 0 && Object.values(userAnswersMap).filter(a => a.trim().length > 0).length === 0)}
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                >
                  {isRefining ? <span className="flex items-center justify-center">Validando... <ElapsedTime running={isRefining} /></span> : qaIteration === 0 ? "Validar Hipótesis con IA" : "Reevaluar Hipótesis"}
                </button>
                <div className="flex items-center gap-2">
                  {!isAnalysisContextAudited && aiQuestionsList.length === 0 && (
                    <p className="text-[10px] text-amber-400 font-medium">⚠️ Requiere validar hipótesis (80%+).</p>
                  )}
                  {isAnalysisContextAudited && (
                    <p className="text-[10px] text-emerald-400 font-semibold">✅ Hipótesis validada ({analysisAuditScore}%).</p>
                  )}
                </div>
              </div>
              {!isAnalysisContextAudited && aiQuestionsList.length > 0 && (
                <div className="mt-4 rounded-md border border-yellow-700 bg-yellow-900/30 px-4 py-4 text-xs text-yellow-200 space-y-4">
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
                          className="w-full bg-yellow-950/50 border border-yellow-700/50 rounded-md p-3 pr-10 text-xs text-yellow-100 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-yellow-500 resize-y"
                          placeholder="Responde aquí para esclarecer la hipótesis..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 pt-2 border-t border-slate-800">
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
            </div>
          </div>
        </div>
      </div>

      {/* MÓDULO DE INTELIGENCIA DEMOGRÁFICA (INEGI SCINCE) (Paso 5) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="text-base font-semibold text-slate-200 font-bold">Demografía y Marginación (INEGI SCINCE) (Paso 5)</h4>
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
                  setIsAnalysisContextAudited(false);
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

      {/* MÓDULO DE GIROS COMERCIALES Y NEGOCIOS (INEGI DENUE) (Paso 6) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="text-base font-semibold text-slate-200 font-bold">Giros Comerciales (INEGI DENUE) (Paso 6)</h4>
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

      {/* MÓDULO DE FUSIÓN OSINT (NOTICIAS RSS) (Paso 7) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200 font-bold">Radar OSINT Regional (Noticias RSS) (Paso 7)</h4>
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
                  setIsAnalysisContextAudited(false);
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

      {/* PASO 8: INCIDENCIA DELICTIVA */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">🚔 Incidencia Delictiva (Paso 8)</h4>
          <p className="text-xs text-slate-400">
            Filtre los delitos y visualice gráficas de severidad basadas en la base local georreferenciada.
          </p>
        </header>
        
        <div className="space-y-4 w-full">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">Filtro de Delitos a Analizar:</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-slate-800/20 rounded-lg border border-slate-700/50">
              {DELITOS_CATEGORIES.map((cat) => {
                const isChecked = activeDelitos.includes(cat.id);
                return (
                  <label key={cat.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const newDelitos = activeDelitos.includes(cat.id)
                          ? activeDelitos.filter(d => d !== cat.id)
                          : [...activeDelitos, cat.id];
                        setActiveDelitos(newDelitos);
                        if (!isReadOnly && project) {
                          void updateProjectDetails({ delitosSeleccionados: newDelitos });
                        }
                      }}
                      className="rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500 w-3.5 h-3.5"
                    />
                    <span>{cat.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Contextualización Soft (Incidencia Delictiva)</label>
              {!isReadOnly && project && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await updateProjectDetails({ contextoIncidencia: delitoText });
                      alert("Contextualización de incidencia delictiva guardada.");
                    } catch (err) {
                      alert("Error al guardar la contextualización.");
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded bg-emerald-900/40 border border-emerald-700 text-emerald-300 px-2 py-0.5 text-[10px] font-semibold hover:bg-emerald-800/40"
                >
                  <span>💾</span> Guardar
                </button>
              )}
            </div>
            <textarea
              spellCheck={true}
              value={delitoText}
              onChange={(e) => setDelitoText(e.target.value)}
              onBlur={() => {
                if (!isReadOnly && project) {
                  void updateProjectDetails({ contextoIncidencia: delitoText });
                }
              }}
              placeholder="Escriba comentarios, interpretaciones o notas sobre la incidencia delictiva de este sector..."
              className="w-full bg-slate-900 text-slate-200 border border-slate-600 rounded-md p-3 text-xs outline-none focus:border-sky-500 min-h-[80px]"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-3 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700 items-start md:items-center">
            <p className="text-xs text-slate-300 flex-1">
              {selectedIds.length > 0
                ? `El barrido buscará delitos a 1 km del centro de las ${selectedIds.length} fotos.`
                : "⚠️ Seleccione al menos una fotografía para establecer las coordenadas de búsqueda."}
            </p>
            <button
              type="button"
              disabled={selectedIds.length === 0 || isCheckingIncidencia || isReadOnly}
              onClick={async () => {
                const selectedPhotos = album.filter(p => selectedIds.includes(p.id) && p.lat && p.lng);
                const photosToUse = selectedPhotos.length > 0 ? selectedPhotos : album.filter(p => p.lat && p.lng);
                if (photosToUse.length === 0) {
                  alert("⚠️ Debe seleccionar al menos una fotografía con coordenadas GPS.");
                  return;
                }
                const centerLat = photosToUse.reduce((acc, p) => acc + p.lat!, 0) / photosToUse.length;
                const centerLng = photosToUse.reduce((acc, p) => acc + p.lng!, 0) / photosToUse.length;

                if (incidents.length > 0) {
                  alert("Los incidentes ya se encuentran cargados.");
                  return;
                }

                setIsCheckingIncidencia(true);
                setError(null);
                try {
                  const res = await fetch("/api/incidencia", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lat: centerLat, lng: centerLng })
                  });
                  const data = await res.json();
                  if (data.success && data.data) {
                    setIncidents(data.data);
                  } else {
                    setError(data.error || "Error al obtener la incidencia delictiva.");
                  }
                } catch (err: any) {
                  setError(err.message || "Error al conectar con la API de incidencia.");
                } finally {
                  setIsCheckingIncidencia(false);
                }
              }}
              className="w-full md:w-auto bg-sky-700 hover:bg-sky-600 text-white py-2 px-4 rounded text-xs font-semibold disabled:opacity-50 transition shadow-lg"
            >
              {isCheckingIncidencia ? <span className="flex items-center justify-center">Consultando Incidencia... <ElapsedTime running={isCheckingIncidencia} /></span> : "🚔 Ejecutar Barrido Delictivo"}
            </button>
          </div>

          {(() => {
            const filteredInc = incidents.filter(inc => activeDelitos.includes(inc.fuente));
            if (filteredInc.length > 0) {
              return (
                <div className="space-y-4">
                  <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700">
                    <h5 className="text-xs font-semibold text-slate-300 mb-3">Gráficas de Severidad Criminal</h5>
                    <CrimeCharts crimes={filteredInc.map(inc => ({
                      ...inc,
                      tipoDelito: inc.INCIDENTE || "Delito No Especificado",
                      lat: inc.lat,
                      lng: inc.lng
                    }))} />
                  </div>

                  <div className="bg-slate-800/40 rounded-lg border border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-900 text-slate-300 border-b border-slate-700">
                            <th className="p-2">Delito</th>
                            <th className="p-2">Fecha</th>
                            <th className="p-2">Colonia / Asentamiento</th>
                            <th className="p-2 text-right">Distancia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-200">
                          {filteredInc.slice(0, 50).map((inc, index) => (
                            <tr key={index} className="hover:bg-slate-800/30">
                              <td className="p-2 font-semibold text-sky-400">{inc.INCIDENTE || "No especificado"}</td>
                              <td className="p-2">{inc.FECHA || "N/A"}</td>
                              <td className="p-2">{inc.NOM_ASEN || "N/A"}</td>
                              <td className="p-2 text-right text-slate-400">{inc.distancia_m ? `${Math.round(inc.distancia_m)}m` : "N/A"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredInc.length > 50 && (
                      <div className="p-2 bg-slate-900/50 text-[10px] text-center text-slate-400 border-t border-slate-800">
                        Mostrando los 50 delitos más cercanos de {filteredInc.length} detectados.
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>
      </div>

      {/* PASO 9: BARRIDO DE PANDILLAS */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">👥 Barrido Territorial de Pandillas (Paso 9)</h4>
          <p className="text-xs text-slate-400">
            Analice la presencia, zonas de influencia y domicilios de integrantes registrados en la base institucional.
          </p>
        </header>
        <div className="w-full">
          {projectId && project && (
            <GangGeoSweepPanel
              projectId={projectId}
              project={project}
              onUpdateProject={async () => {
                if (projectId) await loadProject(projectId);
              }}
            />
          )}
        </div>
      </div>

      {/* PASO 10: RESTO DEL ANÁLISIS GEOINT */}
      <div className="flex flex-col space-y-6 pt-6 mt-6 border-t border-slate-800 w-full">
        <header className="space-y-1 border-b border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-slate-300 tracking-wider uppercase">Resto del Análisis GEOINT (Paso 10)</h3>
        </header>

        {/* 10.1: Consulta Vehicular */}
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
                className="w-full md:w-64 bg-slate-900 text-slate-200 border border-slate-600 rounded-md p-2 text-xs outline-none focus:border-sky-500 disabled:opacity-50 uppercase font-mono"
              />
            </div>
            <div className="w-full relative">
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => toggleDictation('plateContext', (text) => setPlateContext(prev => (prev ? `${prev.trim()} ${text}` : text)))}
                  className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-semibold border ${listeningField === 'plateContext' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-slate-600 text-slate-300 bg-slate-800/80 hover:bg-slate-700"}`}
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
                className={`w-full bg-slate-900 text-slate-200 border rounded-md p-3 pr-14 text-xs outline-none focus:border-sky-500 min-h-[80px] disabled:opacity-50 ${!plateContext.trim() ? 'border-amber-500/70 bg-amber-900/10' : 'border-slate-600'}`}
              />
            </div>
            <div className="mt-1 mb-2">
              <div className="flex justify-between items-center text-[10px] mb-1">
                <span className="text-slate-400">Idoneidad técnica (Longitud mínima):</span>
                <span className={`font-bold ${plateContext.length < 40 ? "text-red-400" : plateContext.length < 120 ? "text-amber-400" : "text-emerald-400"}`}>
                  {plateContext.length === 0 ? "Sin contexto" : plateContext.length < 40 ? "Básico" : plateContext.length < 120 ? "Aceptable" : "Óptimo"}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${plateContext.length < 40 ? "bg-red-500" : plateContext.length < 120 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min((plateContext.length / 200) * 100, 100)}%` }}
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
                  const data = await getRepuveData(plateQuery.trim());
                  if (data.exito) {
                    const newContext = `[INTELIGENCIA VEHICULAR OSINT - Placa: ${data.placa}]\nInstrucción/Contexto del Analista: ${plateContext}\nEstatus general: ${data.estatus}\n\n${data.resumenTexto || ""}\n\nObservaciones tácticas: Este vehículo se detectó físicamente en el perímetro del análisis, lo cual podría representar una ventana de oportunidad criminal o un atractor de riesgo.`;
                    setAnalysisContext((prev) => prev ? `${prev}\n\n${newContext}` : newContext);
                    setPlateQuery("");
                    setPlateContext("");
                    setIsAnalysisContextAudited(false);
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

        {/* 10.2: CIFA-CEIPOL v3.0 */}
        <CifaCeipolPanel
          project={project}
          onAppendToAnalysis={(text) => {
            setAnalysisContext((prev) => (prev ? `${prev}\n\n${text}` : text));
            setIsAnalysisContextAudited(false);
          }}
        />

        {/* 10.3: Disappeared Persons (SEGOB) */}
        <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
          <header className="space-y-1">
            <h4 className="text-base font-semibold text-slate-200">Registro de Desaparecidos (RNPDNO - SEGOB)</h4>
            <p className="text-xs text-slate-400">
              Extrae cifras del Registro Nacional de Personas Desaparecidas. Identifica patrones de violencia extrema y trata en el Estado/Municipio. <strong className="text-amber-400">Obligatorio contextualizar.</strong>
            </p>
          </header>
          <div className="flex flex-col gap-4 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center w-full">
              <input
                type="text"
                placeholder="Estado (Ej. Aguascalientes)"
                value={rnpdnoEstado}
                onChange={(e) => setRnpdnoEstado(e.target.value)}
                disabled={isCheckingRnpdno || isReadOnly}
                className="w-full md:w-1/2 bg-slate-900 text-slate-200 border border-slate-600 rounded-md p-2 text-xs outline-none focus:border-sky-500 disabled:opacity-50"
              />
              <input
                type="text"
                placeholder="Municipio (Ej. Todos)"
                value={rnpdnoMunicipio}
                onChange={(e) => setRnpdnoMunicipio(e.target.value)}
                disabled={isCheckingRnpdno || isReadOnly}
                className="w-full md:w-1/2 bg-slate-900 text-slate-200 border border-slate-600 rounded-md p-2 text-xs outline-none focus:border-sky-500 disabled:opacity-50"
              />
            </div>
            <div className="w-full relative">
              {!isReadOnly && (
                <button type="button" onClick={() => toggleDictation('rnpdnoContext', (text) => setRnpdnoContext(prev => (prev ? `${prev.trim()} ${text}` : text)))} className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-semibold border ${listeningField === 'rnpdnoContext' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-slate-600 text-slate-300 bg-slate-800/80 hover:bg-slate-700"}`}><span>🎙️</span> {listeningField === 'rnpdnoContext' ? "Grabando..." : "Dictar"}</button>
              )}
              <textarea spellCheck={true} value={rnpdnoContext} disabled={isReadOnly} onChange={(e) => setRnpdnoContext(e.target.value)} placeholder="Contexto, justificación o instrucción específica para la IA sobre estas cifras..." className={`w-full bg-slate-900 text-slate-200 border rounded-md p-3 pr-14 text-xs outline-none focus:border-sky-500 min-h-[80px] disabled:opacity-50 ${!rnpdnoContext.trim() ? 'border-amber-500/70 bg-amber-900/10' : 'border-slate-600'}`} />
            </div>
            <button
              type="button"
              disabled={isCheckingRnpdno || isReadOnly}
              onClick={async () => {
                if (!rnpdnoContext.trim()) {
                  alert("⚠️ Acción requerida: Por favor, escriba o dicte el contexto/justificación antes de ejecutar la consulta a SEGOB.");
                  return;
                }
                setIsCheckingRnpdno(true);
                setError(null);
                try {
                  const data = await getRnpdnoData(rnpdnoEstado, rnpdnoMunicipio);
                  if (data.exito) {
                    const newContext = `[INTELIGENCIA DE PERSONAS DESAPARECIDAS - RNPDNO]\nInstrucción/Contexto del Analista: ${rnpdnoContext}\nResultados Oficiales: ${data.resumenTexto}\nObservaciones tácticas: Estas métricas deben cruzarse con los indicadores de violencia y marginación del polígono para evaluar la presencia delictiva de alto impacto.`;
                    setAnalysisContext((prev) => prev ? `${prev}\n\n${newContext}` : newContext);
                    setRnpdnoContext("");
                    setIsAnalysisContextAudited(false);
                    alert(`Consulta RNPDNO Finalizada:\n\n${data.resumenTexto}`);
                  } else {
                    setError(data.error || "Error al extraer datos de SEGOB.");
                  }
                } catch (err: any) { setError(err.message || "Error de red conectando al Cuartel General."); }
                finally { setIsCheckingRnpdno(false); }
              }}
              className="w-full md:w-auto bg-fuchsia-700 hover:bg-fuchsia-600 text-white py-2 px-4 rounded text-xs font-semibold disabled:opacity-50 transition shadow-lg"
            >
              {isCheckingRnpdno ? <span className="flex items-center justify-center">Extrayendo Datos... <ElapsedTime running={isCheckingRnpdno} /></span> : "⚠️ Consultar SEGOB y Añadir a Hipótesis"}
            </button>
          </div>
        </div>

        {/* 10.4: Multimodal Search */}
        <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
          <header className="space-y-1">
            <h4 className="text-base font-semibold text-slate-200">Búsqueda Multimodal Geo-Espacial</h4>
            <p className="text-xs text-slate-400">
              Realice un barrido inteligente (IA + Grounding) a 1km de radio usando conceptos visuales y de contexto. Puede agregar múltiples imágenes y búsquedas. La información es obligatoria para cada imagen.
            </p>
          </header>
          <div className="flex flex-col gap-4 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700">
            <div className="bg-sky-900/30 border border-sky-800 p-3 rounded-lg text-[10px] text-sky-200 space-y-2">
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
                        <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[8px] text-emerald-400 max-w-[90%] truncate">
                          {query.file?.name}
                        </div>
                      </div>
                    )}
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-300 font-semibold">🔍 ¿Qué objeto visual buscas? (Ej: Grafiti 18, cámara domo, callejón cerrado) *</label>
                        <input type="text" value={query.subject} onChange={(e) => setGeoQueries(prev => prev.map(q => q.id === query.id ? { ...q, subject: e.target.value } : q))} className="w-full bg-slate-800 text-slate-200 border border-slate-600 rounded p-1.5 text-xs outline-none focus:border-sky-500" placeholder="Escriba el objeto o firma visual..." disabled={isCheckingGeo || isReadOnly} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-300 font-semibold">👣 ¿Qué comportamiento o acción táctica investigarás? *</label>
                        <input type="text" value={query.action} onChange={(e) => setGeoQueries(prev => prev.map(q => q.id === query.id ? { ...q, action: e.target.value } : q))} className="w-full bg-slate-800 text-slate-200 border border-slate-600 rounded p-1.5 text-xs outline-none focus:border-sky-500" placeholder="Escriba la acción (Ej: marcar territorio, escape rápido, punto ciego)" disabled={isCheckingGeo || isReadOnly} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-300 font-semibold">🏘️ ¿Cómo es la infraestructura o entorno donde se encuentra? *</label>
                        <input type="text" value={query.environment} onChange={(e) => setGeoQueries(prev => prev.map(q => q.id === query.id ? { ...q, environment: e.target.value } : q))} className="w-full bg-slate-800 text-slate-200 border border-slate-600 rounded p-1.5 text-xs outline-none focus:border-sky-500" placeholder="Escriba el entorno (Ej: barda de ladrillo, poste de concreto, baldío)" disabled={isCheckingGeo || isReadOnly} />
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
                  const itemsPayload = await Promise.all(geoQueries.map(async q => {
                    let base64: string | null = null;
                    if (q.file) {
                      try { base64 = await resizeImageToBase64(q.file, 640, 0.5); } catch { base64 = await readFileAsBase64(q.file); }
                    }
                    return { subject: q.subject, action: q.action, environment: q.environment, imageBase64: base64 || undefined };
                  }));

                  const selectedPhotos = album.filter(p => selectedIds.includes(p.id) && p.lat && p.lng);
                  const photosToUse = selectedPhotos.length > 0 ? selectedPhotos : album.filter(p => p.lat && p.lng);
                  const centerLat = photosToUse.reduce((acc, p) => acc + p.lat!, 0) / photosToUse.length;
                  const centerLng = photosToUse.reduce((acc, p) => acc + p.lng!, 0) / photosToUse.length;

                  const res = await fetch("/api/refine-context", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      mode: "multimodal-sweep",
                      queries: itemsPayload,
                      lat: centerLat || 21.8818,
                      lng: centerLng || -102.2915,
                      radius: 1000
                    })
                  });
                  const text = await res.text();
                  const data = JSON.parse(text);
                  if (res.ok && data.success) {
                    const newContext = `[BÚSQUEDA MULTIMODAL GEO-ESPACIAL (1km)]\nSe procesaron ${geoQueries.length} consultas tácticas.\n\nANÁLISIS DE PATRONES ENCONTRADOS:\n${data.data?.analysis || "Cruce multimodal ejecutado."}`;
                    setAnalysisContext(prev => prev ? `${prev}\n\n${newContext}` : newContext);
                    setIsAnalysisContextAudited(false);
                    setGeoQueries([]);
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

        {/* 10.5: Additional Evidence */}
        <div className="pt-6 mt-4 border-t border-slate-800 space-y-4">
          <header className="space-y-1">
            <h4 className="text-base font-semibold text-slate-200 font-bold">Evidencias Adicionales</h4>
            <p className="text-xs text-slate-400">
              Adjunte archivos de evidencia adicionales (documentos, imágenes, audios, de video) y contextualícelos.
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
                  📁 Subir Carpeta
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
                  <span className="text-xs text-sky-400 font-semibold">✓ {docFiles.length} archivo(s) preparado(s)</span>
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
                    className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-semibold border ${listeningField === 'docContext' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-slate-600 text-slate-300 bg-slate-800/80 hover:bg-slate-700"}`}
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
                  className="w-full bg-slate-900 text-slate-200 border border-slate-600 rounded-md p-3 text-xs outline-none focus:border-sky-500 min-h-[100px] disabled:opacity-50"
                />
              </div>
              {!isReadOnly && (
                <div className="mt-1.5">
                  <PowerUpsModule
                    onApplyPowerUp={(text) => {
                      setDocContext((prev) => (prev ? prev.trim() + " " : "") + text);
                      setIsDocContextAudited(false);
                    }}
                    isReadOnly={isReadOnly}
                    insumoText={docContext || ""}
                    insumoType="document_upload"
                    insumoId="new_document"
                    insumoName="Documento Cargado"
                    isContextualized={isDocContextAudited}
                    onApplyDetailedAnalysis={async (results) => {
                      for (const res of results) {
                        res.insumoId = "new_document";
                        await saveCustomDocument(
                          `Resultados Puente Contextual: ${res.powerUpTitle}`,
                          "powerup_execution",
                          JSON.stringify(res)
                        );
                      }
                    }}
                  />
                </div>
              )}

              {documents && documents
                .filter((doc: any) => doc.type === "powerup_execution")
                .map((doc: any) => {
                  try {
                    const parsed = JSON.parse(doc.context);
                    if (parsed.insumoId === "new_document") {
                      return (
                        <div key={doc.id} className="mt-2 text-left">
                          <VentanaResultadosPuente
                            data={parsed}
                            onRemove={isReadOnly ? undefined : () => removeDocument(doc.id)}
                          />
                        </div>
                      );
                    }
                  } catch (err) {
                    console.error("Error parsing powerup_execution doc.context", err);
                  }
                  return null;
                })
              }
              
              <div className="mt-1 mb-2">
                <div className="flex justify-between items-center text-[10px] mb-1">
                  <span className="text-slate-400">Idoneidad técnica (Longitud mínima):</span>
                  <span className={`font-bold ${docContext.length < 60 ? "text-red-400" : docContext.length < 180 ? "text-amber-400" : "text-emerald-400"}`}>
                    {docContext.length === 0 ? "Sin contexto" : docContext.length < 60 ? "Básico" : docContext.length < 180 ? "Aceptable" : "Óptimo"}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${docContext.length < 60 ? "bg-red-500" : docContext.length < 180 ? "bg-amber-500" : "bg-emerald-500"}`}
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
                          context: docContext + `\n\n(INSTRUCCIÓN DEL SISTEMA: Eres un Arquitecto de Datos e IA. Evalúa la idoneidad técnica del documento. Endurece tu criterio: exige que el usuario guíe a las APIs. Si es claro, score >= 80; si es vago, score < 80. OBLIGATORIO: Sin importar el score, SIEMPRE genera 3 sugerencias de refinamiento técnico usando estos Power-Ups según el tipo de archivo: 1. AUDIO/VIDEO: "Aplica Análisis de Diarización y Sentimiento". 2. IMAGEN/PDF: "Ejecuta OCR Avanzado y Extracción de Atributos Visuales". 3. GEOESPACIAL: "Consulta de Proximidad ST_DWithin y Grounding Dinámico". 4. TEXTO: "Activa Extracción de Entidades Salientes". 5. HISTÓRICO: "Búsqueda Semántica en Discovery Engine". Explica por qué esto mejora el análisis. DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO con las claves 'score' (número) y 'suggestions' (string). NO agregues markdown.)`,
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
                  {isRefiningDoc ? <span className="flex items-center justify-center">Consultando IA... <ElapsedTime running={isRefiningDoc} /></span> : "Auditar Evidencia"}
                </button>
              </div>

              {docSuggestions && (
                <div className="mt-2 rounded-md border border-yellow-700 bg-yellow-900/30 px-3 py-2 text-xs text-yellow-200 space-y-2 w-full">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold">Sugerencias de IA (Editable):</p>
                    {docAuditScore !== null && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${docAuditScore >= 80 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                        Lógica: {docAuditScore}%
                      </span>
                    )}
                  </div>
                  <div className="relative w-full">
                    <button
                      type="button"
                      onClick={() => toggleDictation('docSuggestions', (text) => setDocSuggestions(prev => (prev ? `${prev.trim()} ${text}` : text)))}
                      className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-semibold border ${listeningField === 'docSuggestions' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-yellow-700 text-yellow-300 bg-yellow-900/80 hover:bg-yellow-805"}`}
                    >
                      <span>🎙️</span>
                    </button>
                    <textarea
                      spellCheck={true}
                      value={docSuggestions}
                      onChange={(e) => setDocSuggestions(e.target.value)}
                      className="w-full bg-yellow-950/50 border border-yellow-700/50 rounded-md p-3 pr-10 text-xs text-yellow-100 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-yellow-500 resize-y"
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
                              context: docSuggestions + `\n\n(INSTRUCCIÓN DEL SISTEMA: Evalúa la pertinencia técnica. Endurece el criterio. Score >= 80 si tiene sentido técnico. OBLIGATORIO: Asegura incluir 3 sugerencias usando Power-Ups como 'OCR Avanzado', 'Diarización', 'Extracción de Entidades' o 'Búsqueda Semántica'. DEVUELVE ÚNICA Y EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO con 'score' y 'suggestions'. NO agregues markdown.)`, 
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
                      Aplicar Power-Up Sugerido {(docAuditScore !== null && docAuditScore < 80) ? '(Requiere 80%)' : ''}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    
      {/* Botón al final de la pantalla para formular hipótesis y abrir la configuración de análisis */}
      <div className="pt-8 mt-8 border-t border-slate-800 flex justify-center w-full print:hidden">
        <button
          type="button"
          onClick={() => {
            if (selectedIds.length === 0) {
              if (album.length > 0) {
                selectAllPhotos();
              } else {
                window.alert("Debe agregar al menos una fotografía al expediente para poder formular una hipótesis.");
                return;
              }
            }
            setShowConfigModal(true);
          }}
          className="w-full max-w-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 text-sm uppercase tracking-wider active:scale-98"
        >
          <span>🧠</span> Generar Hipótesis y Contextualización
        </button>
      </div>

      {showConfigModal && (
        <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" className="cursor-anchored-dialog w-full max-w-[98vw] 2xl:max-w-none rounded-xl border border-slate-700 bg-slate-900 px-6 md:px-8 py-8 md:py-10 my-8 md:my-auto max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-100">
              Configuración del Análisis Táctico
            </h3>
            <div className="flex flex-col gap-8 items-start mt-6 w-full">
            {selectedIds.length >= 1 && (
              <>
              <div className="space-y-6 w-full">
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
                {!isReadOnly && (
                  <div className="mt-1.5">
                    <PowerUpsModule
                      onApplyPowerUp={(text) => {
                        setAnalysisContext((prev) => (prev ? prev.trim() + " " : "") + text);
                        setIsAnalysisContextAudited(false);
                      }}
                      isReadOnly={isReadOnly}
                      insumoText={analysisContext || ""}
                      insumoType="hypothesis"
                      insumoId="main_hypothesis"
                      insumoName="Hipótesis de Análisis"
                      isContextualized={isAnalysisContextAudited}
                      locationCoords={(() => {
                        const geo = album.find(p => p.lat != null && p.lng != null);
                        return geo ? { lat: geo.lat!, lng: geo.lng! } : undefined;
                      })()}
                      onApplyDetailedAnalysis={async (results) => {
                        for (const res of results) {
                          res.insumoId = "main_hypothesis";
                          await saveCustomDocument(
                            `Resultados Puente Contextual: ${res.powerUpTitle}`,
                            "powerup_execution",
                            JSON.stringify(res)
                          );
                        }
                      }}
                    />
                  </div>
                )}

                {/* Persisted Puente Results for Hipótesis de Análisis */}
                {documents && documents
                  .filter((doc: any) => doc.type === "powerup_execution")
                  .map((doc: any) => {
                    try {
                      const parsed = JSON.parse(doc.context);
                      if (parsed.insumoId === "main_hypothesis") {
                        return (
                          <div key={doc.id} className="mt-2 text-left">
                            <VentanaResultadosPuente
                              data={parsed}
                              onRemove={isReadOnly ? undefined : () => removeDocument(doc.id)}
                            />
                          </div>
                        );
                      }
                    } catch (err) {
                      console.error("Error parsing powerup_execution doc.context", err);
                    }
                    return null;
                  })
                }
                <div className="mt-1 mb-2">
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className="text-slate-400">Idoneidad técnica (Longitud mínima):</span>
                    <span className={`font-bold ${analysisContext.length < 60 ? "text-red-400" : analysisContext.length < 180 ? "text-amber-400" : "text-emerald-400"}`}>
                      {analysisContext.length === 0 ? "Sin contexto" : analysisContext.length < 60 ? "Básico" : analysisContext.length < 180 ? "Aceptable" : "Óptimo"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${analysisContext.length < 60 ? "bg-red-500" : analysisContext.length < 180 ? "bg-amber-500" : "bg-emerald-500"}`}
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

                        const fullContext = analysisContext + focusContext + (answersString ? `\n\nRespuestas a preguntas previas:\n${answersString}` : "") + `\n\n(INSTRUCCIÓN DEL SISTEMA: Eres un Arquitecto de Datos e IA. Evalúa la hipótesis. Endurece el criterio: debe dar dirección técnica a las APIs. Si es sólida, score >= 80; si es vaga, score < 80. OBLIGATORIO: SIEMPRE incorpora en tus 'questions' o 'suggestions' al menos 3 sugerencias técnicas que inviten a usar: "Consulta de Proximidad ST_DWithin", "Grounding Dinámico", "Extracción de Entidades Salientes", o "Búsqueda Semántica en Discovery Engine". Explica brevemente el porqué. DEVUELVE UN JSON VÁLIDO.)`;

                        const res = await fetch("/api/refine-context", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            context: fullContext,
                            photos: minimalPhotos,
                            mode: "hypothesis-qa",
                            geometryType: project?.geometryType || "individual",
                            projectDescription: project?.descripcion || "",
                            analysisRadius,
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
          <div role="dialog" aria-modal="true" className="cursor-anchored-dialog w-full max-w-6xl bg-slate-900 border border-sky-600 rounded-xl p-6 shadow-2xl space-y-4">
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

      {/* MODAL DE ELIMINACIÓN CONTROLADA (JUSTIFICACIÓN OBLIGATORIA) */}
      {deleteModal?.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 print:hidden">
          <div role="dialog" aria-modal="true" className="cursor-anchored-dialog w-full max-w-md bg-slate-950 border border-red-700/50 p-6 rounded-2xl shadow-2xl space-y-4 text-left">
            <h3 className="text-lg font-black text-red-400 flex items-center gap-2">
              ⚠️ Confirmar Eliminación Controlada
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Está a punto de enviar este elemento ({deleteModal.type}) a la <span className="font-bold text-amber-400">Papelera de Reciclaje Institucional</span>. Permanecerá allí por 7 días naturales antes de su eliminación definitiva.
            </p>
            
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase">Motivo de Eliminación (Obligatorio)</label>
              <select
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-slate-200 focus:border-red-500 focus:outline-none"
              >
                <option value="">-- Seleccione un motivo --</option>
                <option value="Registro duplicado">Registro duplicado</option>
                <option value="Captura incorrecta">Captura incorrecta</option>
                <option value="Evidencia errónea">Evidencia errónea</option>
                <option value="Expediente cancelado">Expediente cancelado</option>
                <option value="Corrección administrativa">Corrección administrativa</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setDeleteModal(null);
                  setDeleteReason("");
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                disabled={!deleteReason.trim()}
                onClick={async () => {
                  if (!deleteReason) return;
                  try {
                    await softDeleteDoc({
                      type: deleteModal.type,
                      id: deleteModal.id,
                      projectId: deleteModal.projectId,
                      reason: deleteReason
                    });
                    setDeleteModal(null);
                    setDeleteReason("");
                    alert(`El elemento (${deleteModal.type}) ha sido enviado a la Papelera de Reciclaje.`);
                  } catch (err: any) {
                    alert("Error al eliminar: " + err.message);
                  }
                }}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-red-900/30"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
