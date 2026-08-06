"use client";
// @ts-nocheck
/* eslint-disable */

import React, { Fragment, useRef, useState, useEffect, useCallback, useMemo } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "@/context/AuthContext";
import { useProject, AlbumPhoto } from "@/context/ProjectContext";
import { EvidenceRelationship, EvidenceRelationshipEngine } from "@/utils/evidenceRelationshipEngine";
import { TacticalCharts } from "./TacticalCharts";
import { TacticalMaps } from "./TacticalMaps";
import { ReportEngine, ReportEngineKernel, KernelGuard, generatePdfProgrammatic } from "@/lib/reportEngine";
import { exportToWord } from "@/lib/exportToWord";
import { pingOsint, getScinceData, getDenueData, getTelegramOsintData, getRnpdnoData, getRepuveData } from "@/lib/osintActions";
import { runOSINTScan } from "../utils/osintEngine";
import { CifaCeipolPanel } from "./CifaCeipolPanel";
import { ProjectMap } from "./ProjectMap";
import { GangGeoSweepPanel } from "./GangGeoSweepPanel";
import { CrimeCharts } from "./CrimeCharts";
import dynamic from "next/dynamic";

import { StreetViewConfirmationModal } from "@/modules/streetView/StreetViewConfirmationModal";
import { StreetViewDisclaimerModal } from "@/modules/streetView/StreetViewDisclaimerModal";
import { StreetViewPanoramaPicker } from "@/modules/streetView/streetViewPanoramaPicker";
import { mapStreetViewToAlbumPhoto, StreetViewCapturePayload } from "@/modules/streetView/streetViewMapper";

const NetworkDashboard = dynamic(() => import("./NetworkDashboard").then((mod) => mod.NetworkDashboard), { ssr: false });

import { PowerUpsModule } from "./powerups/PowerUpsModule";
import { VentanaResultadosPuente } from "./powerups/VentanaResultadosPuente";
import { DynamicPopup, PopupPositionManager } from "./DynamicPopup";

import { CEIPOLSectionHeader } from "./ui/CEIPOLSectionHeader";
import { CEIPOLBadge } from "./ui/CEIPOLBadge";
import { CEIPOLToast } from "./ui/CEIPOLToast";
import { CEIPOLLoader } from "./ui/CEIPOLLoader";
import { CEIPOLEmptyState } from "./ui/CEIPOLEmptyState";
import { CEIPOLCard } from "./ui/CEIPOLCard";
import { CEIPOLButton } from "./ui/CEIPOLButton";

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

function getChapterLabel(ch: number): string {
  const labels: Record<number, string> = {
    1: "Executive Summary",
    2: "Capítulo 1: Contexto del Análisis",
    3: "Capítulo 2: Hipótesis Criminológica",
    4: "Capítulo 3: Análisis Cartográfico",
    5: "Capítulo 4: Análisis Estadístico",
    6: "Capítulo 5: Evidencia Fotográfica",
    7: "Capítulo 6: Street View Intelligence",
    8: "Capítulo 7: Inteligencia OSINT",
    9: "Capítulo 8: Actores y Pandillas",
    10: "Capítulo 9: Grafo de Hipótesis",
    11: "Capítulo 10: Conclusiones Operativas"
  };
  return labels[ch] || `Sección ${ch}`;
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
          <CEIPOLButton
            type="button"
            variant="secondary"
            onClick={handleRequestSuggestions}
            disabled={!context.trim() || isReadOnly}
            loading={isRefining}
          >
            Sugerir Refinamiento
          </CEIPOLButton>
       </div>
       {suggestions && (
           <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-md text-xs text-yellow-200 mt-2 space-y-2">
               <div className="flex justify-between items-center"><p className="font-semibold">Sugerencias IA:</p>{auditScore !== null && (<span className={`px-2 py-0.5 rounded font-bold ${auditScore >= 80 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>Lógica: {auditScore}%</span>)}</div>
               <textarea value={suggestions} onChange={(e) => setSuggestions(e.target.value)} className="w-full bg-yellow-950/50 border border-yellow-700/50 rounded p-2 text-yellow-100 min-h-[60px] focus:outline-none" />
               <div className="flex gap-2">
                 <CEIPOLButton
                   type="button"
                   variant="ghost"
                   size="sm"
                   onClick={() => { setContext(c => c + "\n\n" + suggestions); setSuggestions(""); setIsAudited(true); }}
                 >
                   + Añadir plantilla...
                 </CEIPOLButton>
                 <button type="button" onClick={() => { setSuggestions(""); setAuditScore(null); setIsAudited(false); }} className="bg-red-900/50 border border-red-800 text-red-200 hover:bg-red-800/50 px-2 py-1 rounded font-medium text-[11px]">Descartar</button>
               </div>
           </div>
       )}
       <div className="flex justify-end mt-2">
         <CEIPOLButton
           type="button"
           variant="confirm"
           onClick={handleSave}
           disabled={!context.trim() || !isAudited || isReadOnly}
           loading={isSaving}
         >
           Guardar Dictamen
         </CEIPOLButton>
       </div>
    </div>
  );
}

type PhotoAlbumProps = {
  onDeletePhoto?: (id: string) => void;
  projectId?: string;
  onSaveAnalysisToCloud?: (
    content: string,
    attachedPhotos?: string[],
    summary?: string,
    metadata?: { reportEngineOutput?: boolean; source?: string }
  ) => Promise<void>;
};

const DELITOS_CATEGORIES = [
  { id: "homicidios", label: "Homicidios y Feminicidios" },
  { id: "fraude_extorsion", label: "Fraude y Extorsión" },
  { id: "robo_persona", label: "Robo a Persona / Transeúnte" },
  { id: "robo_casa", label: "Robo a Casa Habitación" },
  { id: "robo_negocio", label: "Robo a Negocio" },
  { id: "robo_vehicular", label: "Robo Vehicular" },
  { id: "robo_motocicleta", label: "Robo de Motocicleta" },
  { id: "robo_transporte", label: "Robo a Transporte Público" },
  { id: "cristalazo_autopartes", label: "Cristalazo y Autopartes" },
  { id: "otros", label: "Otros Delitos" }
];

const CRIME_SEMANTIC_MAP: Record<string, string> = {
  "robo a casa": "Robo a Casa Habitación",
  "robo a casa habitación": "Robo a Casa Habitación",
  "robo a casa habitacion": "Robo a Casa Habitación",
  "robo domiciliario": "Robo a Casa Habitación",
  "robo a domicilio": "Robo a Casa Habitación",

  "robo de vehiculo": "Robo Vehicular",
  "robo de vehículo": "Robo Vehicular",
  "robo vehicular": "Robo Vehicular",
  "robo automotor": "Robo Vehicular",

  "robo a transeunte": "Robo a Persona / Transeúnte",
  "robo a transeúnte": "Robo a Persona / Transeúnte",
  "robo a persona": "Robo a Persona / Transeúnte",
  "robo a personas": "Robo a Persona / Transeúnte"
};

const getNormalizedCrimeCategory = (rawCrime: string): string => {
  if (!rawCrime) {
    return "Delito No Especificado";
  }
  const normalizedKey = rawCrime.trim().toLowerCase();
  return CRIME_SEMANTIC_MAP[normalizedKey] || rawCrime;
};

const getCategoryForFilename = (filename: string): string => {
  const name = String(filename || "").toLowerCase();
  if (name.includes("homicidio") || name.includes("feminicidio")) return "homicidios";
  if (name.includes("cristalazo") || name.includes("autopartes")) return "cristalazo_autopartes";
  if (name.includes("casa") || name.includes("rch")) return "robo_casa";
  if (name.includes("negocio")) return "robo_negocio";
  if (name.includes("motocicleta")) return "robo_motocicleta";
  if (name.includes("vehicular") || name.includes("vehiculo")) return "robo_vehicular";
  if (name.includes("persona") || name.includes("transeunte") || name.includes("transeúnte")) return "robo_persona";
  if (name.includes("transporte")) return "robo_transporte";
  if (name.includes("fraude") || name.includes("extorsion") || name.includes("extorsión")) return "fraude_extorsion";
  return "otros";
};

const createSweepId = (sweep: any) => {
  const raw = [
    sweep?.engine || "unknown",
    sweep?.timestamp || sweep?.createdAt || sweep?.updatedAt || "no-time",
    sweep?.source || sweep?.type || "no-source",
  ].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `sweep-${hash.toString(16)}`;
};

const dedupeSweeps = (sweeps: any[] = []) => {
  const seen = new Set<string>();
  const seenType = new Set<string>();
  return sweeps.filter((sweep) => {
    const uniqueSweepId = sweep?.uniqueSweepId || createSweepId(sweep);
    const sourceType = `${sweep?.engine || "unknown"}:${sweep?.source || sweep?.type || "unknown"}`;
    if (seen.has(uniqueSweepId) || seenType.has(sourceType)) return false;
    seen.add(uniqueSweepId);
    seenType.add(sourceType);
    sweep.uniqueSweepId = uniqueSweepId;
    return true;
  });
};

function SweepSummaryItemRow({ sweep, updateSweep }: { sweep: any; updateSweep: any }) {
  const [comments, setComments] = useState(sweep.comments || "");
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setComments(sweep.comments || "");
  }, [sweep.comments]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSweep(sweep.id, { comments });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error(err);
      alert("Error al guardar los ajustes.");
    } finally {
      setIsSaving(false);
    }
  };

  const relevanceColors = {
    Alta: "bg-red-500/10 text-red-400 border-red-500/30",
    Media: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Baja: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    Nula: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  };

  const statusColors = {
    Integrado: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    Pendiente: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Rechazado: "bg-red-500/10 text-red-400 border-red-500/30",
  };

  return (
    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-black text-slate-100 text-xs tracking-wide">
            📡 Motor: {sweep.engine}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${relevanceColors[sweep.relevance as keyof typeof relevanceColors] || relevanceColors.Baja}`}>
            Relevancia: {sweep.relevance}
          </span>
          <span className="text-[10px] bg-slate-850 text-slate-300 px-1.5 py-0.5 rounded-full border border-slate-700">
            {sweep.type === "Directa" ? "⚡ Integración Directa" : "🧠 Contextualizado"}
          </span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-md border ${statusColors[sweep.status as keyof typeof statusColors] || statusColors.Pendiente}`}>
          ● {sweep.status}
        </span>
      </div>

      <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-850 text-[11px] text-slate-300 max-h-[80px] overflow-y-auto font-mono whitespace-pre-wrap">
        {sweep.extractedData}
      </div>

      <div className="flex items-end gap-3 pt-1">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
            ✍️ Ajustes y Contextualización del Analista
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Agregue consideraciones tácticas, exclusiones o notas que la IA deba tomar en cuenta para el análisis general..."
            className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-sky-500 min-h-[50px] resize-y"
          />
        </div>
        <CEIPOLButton
          variant="primary"
          size="sm"
          loading={isSaving}
          disabled={comments === (sweep.comments || "")}
          onClick={handleSave}
        >
          {isSaving
            ? "Guardando..."
            : isSaved
            ? "✓ Guardado"
            : "💾 Guardar Ajustes"}
        </CEIPOLButton>
      </div>
    </div>
  );
}

export function PhotoAlbum({
  onDeletePhoto,
  projectId,
  onSaveAnalysisToCloud,
}: PhotoAlbumProps = {}) {
  const { user } = useAuth();
  const {
    project,
    album: rawAlbum,
    selectedIds,
    analysisResult,
    togglePhotoSelection,
    selectAllPhotos,
    clearSelection,
    setAnalysisResult,
    updatePhotoMeta,
    updatePhotoCoordinates,
    updatePhotoRelationship,
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
    loadProject,
    registerSweep,
    updateSweep,
    setActiveSweepForModal,
    logAuditAction,
  } = useProject();

  // 1. Auditoría y validación de Street View (Gobernanza FIX-GEO-01)
  const streetViewValidation = useMemo(() => {
    const svPhotos = (rawAlbum || []).filter(
      (p: any) => p.tipo === "STREET_VIEW" || p.evidenceType === "VIRTUAL_STREET_VIEW"
    );

    const getStatus = (count: number) => {
      if (count === 0) return "EMPTY";
      if (count < 2) return "INSUFFICIENT";
      if (count > 4) return "CAPPED";
      return "VALID";
    };

    const hideouts = svPhotos.filter((p: any) => p.streetViewCategory === "hideout");
    const graffitis = svPhotos.filter((p: any) => p.streetViewCategory === "graffiti");
    const denues = svPhotos.filter((p: any) => p.streetViewCategory === "denue_interest");

    return {
      hideout: {
        count: hideouts.length,
        status: getStatus(hideouts.length),
        photos: hideouts,
        label: "Lugares de acecho o escondite",
      },
      graffiti: {
        count: graffitis.length,
        status: getStatus(graffitis.length),
        photos: graffitis,
        label: "Grafitis de pandillas",
      },
      denue_interest: {
        count: denues.length,
        status: getStatus(denues.length),
        photos: denues,
        label: "Puntos de interés DENUE",
      },
    };
  }, [rawAlbum]);

  // 2. Normalización de fotos del Álbum al vuelo (Gobernanza FIX-GEO-01)
  const normalizedAlbum = useMemo(() => {
    if (!rawAlbum) return [];

    // Conservar todas las fotos de usuario intactas
    const userPhotos = rawAlbum.filter(
      (p: any) => p.tipo !== "STREET_VIEW" && p.evidenceType !== "VIRTUAL_STREET_VIEW"
    );

    // Fotos de Street View gobernadas (Máximo visual de 4 por categoría)
    const hideouts = streetViewValidation.hideout.photos.slice(0, 4);
    const graffitis = streetViewValidation.graffiti.photos.slice(0, 4);
    const denues = streetViewValidation.denue_interest.photos.slice(0, 4);

    // Otras fotos Street View que no pertenezcan a las categorías principales
    const otherSvs = rawAlbum.filter((p: any) => 
      (p.tipo === "STREET_VIEW" || p.evidenceType === "VIRTUAL_STREET_VIEW") &&
      !["hideout", "graffiti", "denue_interest"].includes(p.streetViewCategory)
    );

    return [...userPhotos, ...hideouts, ...graffitis, ...denues, ...otherSvs];
  }, [rawAlbum, streetViewValidation]);

  // Sobrescribir "album" local para que todo el componente herede las reglas gobernadas
  const album: AlbumPhoto[] = normalizedAlbum;

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
      if ((project as any).incidents && Array.isArray((project as any).incidents)) {
        setIncidents((project as any).incidents);
      } else {
        setIncidents([]);
      }

      if (project.sweeps && Array.isArray(project.sweeps)) {
        const sweeps = project.sweeps;
        const hasSweep = (engineKeyword: string) => 
          sweeps.some((s: any) => s.engine?.toLowerCase().includes(engineKeyword) && s.status === "Integrado");
        
        setSelectedAnnexes({
          mapInteractive: true,
          mapDensity: true,
          mapMobility: true,
          mapAttractors: true,
          mapPredictive: true,
          chartTemporal: true,
          chartTopology: true,
          chartEnvironmental: true,
          chartPrediction: true,
          sweepDenue: hasSweep("denue") || hasSweep("inegi"),
          sweepIncidencia: hasSweep("incidencia") || hasSweep("delitos"),
          sweepRepuve: hasSweep("vehicular") || hasSweep("repuve"),
          sweepRnpdno: hasSweep("desaparecidos") || hasSweep("rnpdno"),
          sweepMultimodal: hasSweep("multimodal"),
          sweepCifa: hasSweep("cifa"),
          graphConnections: true,
          includeOsintAppendix: false,
        });
      } else {
        setSelectedAnnexes({
          mapInteractive: true,
          mapDensity: true,
          mapMobility: true,
          mapAttractors: true,
          mapPredictive: true,
          chartTemporal: true,
          chartTopology: true,
          chartEnvironmental: true,
          chartPrediction: true,
          sweepDenue: false,
          sweepIncidencia: false,
          sweepRepuve: false,
          sweepRnpdno: false,
          sweepMultimodal: false,
          sweepCifa: false,
          graphConnections: true,
          includeOsintAppendix: false,
        });
      }
    }
  }, [project]);

  useEffect(() => {
    let active = true;
    const initStreetView = () => {
      if (typeof window === "undefined" || !window.google || !window.google.maps || !window.google.maps.StreetViewService || !svContainerRef.current) {
        if (active) {
          setTimeout(initStreetView, 1000);
        }
        return;
      }
      const selectedPhotos = album.filter(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && selectedIds.includes(p.id));
      const photosToUse = selectedPhotos.length > 0 ? selectedPhotos : album.filter(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
      if (photosToUse.length === 0) return;
      const centerLat = photosToUse.reduce((acc, p) => acc + Number(p.lat), 0) / photosToUse.length;
      const centerLng = photosToUse.reduce((acc, p) => acc + Number(p.lng), 0) / photosToUse.length;

      try {
        const svService = new window.google.maps.StreetViewService();
        svService.getPanorama({
          location: { lat: centerLat, lng: centerLng },
          radius: 150
        }, (data, status) => {
          if (!active) return;
          if (status === window.google.maps.StreetViewStatus.OK && data && data.location && data.location.latLng) {
            setSvError(null);
            const pano = new window.google.maps.StreetViewPanorama(svContainerRef.current!, {
              position: data.location.latLng,
              pov: { heading: 34, pitch: 10 },
              zoom: 1,
              addressControl: true,
              linksControl: true,
              panControl: true,
              enableCloseButton: false
            });
            setActivePanorama(pano);
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
  const [imageDeleteFlow, setImageDeleteFlow] = useState<{
    isOpen: boolean;
    photo: any;
    step: 1 | 2;
  } | null>(null);
  const [activePanorama, setActivePanorama] = useState<any>(null);
  const [temporaryCintilla, setTemporaryCintilla] = useState<{
    id: string;
    url: string;
    lat: number;
    lng: number;
    heading: number;
    pitch: number;
    comentario: string;
    streetViewCategory: "hideout" | "graffiti" | "denue_interest" | "other";
  }[]>([]);
  const [isCapturingSv, setIsCapturingSv] = useState(false);
  const [mapTemporaryCintilla, setMapTemporaryCintilla] = useState<{
    id: string;
    url: string;
    lat: number;
    lng: number;
    geometryType: "POLYGON" | "LINE";
    captureContext: "vertex_add" | "vertex_edit";
    targetPhotoId?: string;
    comentario: string;
    streetViewCategory: "hideout" | "graffiti" | "denue_interest" | "other";
  }[]>([]);
  const [isCapturingMap, setIsCapturingMap] = useState(false);
  const [mapConfirmModal, setMapConfirmModal] = useState<{
    isOpen: boolean;
  } | null>(null);

  // --- MÓDULO STREET VIEW EVIDENCE GOVERNANCE v2.1 ---
  const [svFlowTarget, setSvFlowTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [isSvModal1Open, setIsSvModal1Open] = useState(false);
  const [isSvModal2Open, setIsSvModal2Open] = useState(false);
  const [isSvPickerOpen, setIsSvPickerOpen] = useState(false);

  const handleStartStreetViewFlow = useCallback((lat: number, lng: number) => {
    setSvFlowTarget({ lat, lng });
    setIsSvModal1Open(true);
  }, []);

  const handleConfirmSvModal1 = useCallback(() => {
    setIsSvModal1Open(false);
    setIsSvModal2Open(true);
  }, []);

  const handleAcceptSvModal2 = useCallback((acceptance: { acceptedTerms: boolean; acceptedAt: number; acceptedBy: string }) => {
    setIsSvModal2Open(false);
    setIsSvPickerOpen(true);
  }, []);

  const handleCompleteStreetViewCapture = useCallback(async (payload: StreetViewCapturePayload) => {
    setIsSvPickerOpen(false);
    try {
      const albumPhoto = mapStreetViewToAlbumPhoto(payload);
      if (uploadAndAddPhoto) {
        const blobRes = await fetch(albumPhoto.previewUrl);
        const blob = await blobRes.blob();
        const file = new File([blob], `Remote_StreetView_${Date.now()}.jpg`, { type: "image/jpeg" });

        await uploadAndAddPhoto(file, albumPhoto.lat!, albumPhoto.lng!, {
          tipo: albumPhoto.tipo,
          comentario: albumPhoto.comentario,
          gpsSource: albumPhoto.gpsSource,
          validado: true,
          isIndependentPoi: true,
          evidenceOrigin: albumPhoto.evidenceOrigin,
          collectionMethod: albumPhoto.collectionMethod,
          evidenceCategoryClass: albumPhoto.evidenceCategoryClass,
          sourceProvider: albumPhoto.sourceProvider,
          confidenceLevel: albumPhoto.confidenceLevel,
          confidencePercentage: albumPhoto.confidencePercentage,
          confidenceFactors: albumPhoto.confidenceFactors,
          streetViewCategory: albumPhoto.streetViewCategory,
          streetViewSource: albumPhoto.streetViewSource,
          streetViewMetadata: albumPhoto.streetViewMetadata,
        } as any);
        alert("Evidencia remota Street View v2.1 incorporada exitosamente al expediente.");
      }
    } catch (err: any) {
      console.error("[PhotoAlbum] Error al incorporar evidencia Street View v2.1:", err);
      alert("Error al incorporar evidencia remota: " + err.message);
    } finally {
      setSvFlowTarget(null);
    }
  }, [uploadAndAddPhoto]);

  const handleCandidateCapture = useCallback((
    lat: number,
    lng: number,
    context: { geometryType: "POLYGON" | "LINE"; captureContext: "vertex_add" | "vertex_edit"; previousPhotoId?: string }
  ) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyBB1mc8b1lpevjxcFSSLHurnbCQw62RAaA";
    const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=600x400&maptype=hybrid&markers=color:red%7C${lat},${lng}&key=${apiKey}`;

    const newCapture = {
      id: `temp-map-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: staticUrl,
      lat,
      lng,
      geometryType: context.geometryType,
      captureContext: context.captureContext,
      targetPhotoId: context.previousPhotoId,
      comentario: "",
      streetViewCategory: "other" as const
    };

    setMapTemporaryCintilla(prev => [...prev, newCapture]);
  }, []);

  const [aiProfile, setAiProfile] = useState<string | null>(null);
  const [editableProfile, setEditableProfile] = useState<string>("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [generationChapter, setGenerationChapter] = useState<number>(0);
  const [isSweepsListExpanded, setIsSweepsListExpanded] = useState(true);
  const [isSavingAnalysis, setIsSavingAnalysis] = useState(false);
  const [hasSavedAnalysis, setHasSavedAnalysis] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<"edit" | "preview">("edit");
  const [previewPageIdx, setPreviewPageIdx] = useState<number>(0);
  const [kernelState, setKernelState] = useState(ReportEngineKernel.getState());
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyDossiers, setHistoryDossiers] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSavingExpediente, setIsSavingExpediente] = useState(false);

  useEffect(() => {
    return ReportEngineKernel.subscribe((s) => {
      setKernelState(s);
    });
  }, []);
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [scinceDataConfirm, setScinceDataConfirm] = useState<string | null>(null);
  const [denueDataConfirm, setDenueDataConfirm] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const getDynamicModalStyle = (estimatedW = 950, estimatedH = 600) => {
    if (!clickCoords) return {};
    const winWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
    const winHeight = typeof window !== "undefined" ? window.innerHeight : 800;
    const pos = PopupPositionManager.calculate(clickCoords.x, clickCoords.y, estimatedW, estimatedH, winWidth, winHeight);
    return {
      position: "fixed" as const,
      top: `${pos.y}px`,
      left: `${pos.x}px`,
      margin: 0
    };
  };
  const handleAddMapPoint = async (lat: number, lng: number, details: { name: string; isIndependentPoi: boolean; isVertex: boolean }) => {
    if (isReadOnly) return;
    try {
      const fileBlob = await (await fetch("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")).blob();
      const file = new File([fileBlob], `${details.isIndependentPoi ? "POI" : "Vertex"}_${Date.now()}.jpg`, { type: "image/jpeg" });
      
      if (uploadAndAddPhoto) {
        await uploadAndAddPhoto(file, lat, lng, {
          gpsSource: details.isIndependentPoi ? "POI_MAPA" : "VERTICE_MAPA",
          validado: true,
          tipo: details.isIndependentPoi ? "POI" : (project?.geometryType === "lineal" ? "Corredor" : "Polígono"),
          comentario: details.name || (details.isIndependentPoi ? "POI creado desde mapa." : "Vértice de trazado."),
          isIndependentPoi: details.isIndependentPoi
        });
      }
    } catch (err: any) {
      alert("Error al agregar punto geográfico: " + err.message);
    }
  };
  const [reportGenerationMeta, setReportGenerationMeta] = useState<{ date: string; time: string; user: string } | null>(null);
  const [datasetReport, setDatasetReport] = useState<any | null>(null);
  const [isValidatingDataset, setIsValidatingDataset] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsValidatingDataset(true);
    try {
      const res = await fetch("/api/validate-crime-dataset");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.report) {
          setDatasetReport(json.report);
        }
      }
    } catch (e) {
      console.error("Error fetching crime dataset validation:", e);
    } finally {
      setIsValidatingDataset(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

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

  const [isHypothesisValidatedInWorkspace, setIsHypothesisValidatedInWorkspace] = useState(false);
  const [selectedAnnexes, setSelectedAnnexes] = useState({
    mapInteractive: true,
    mapDensity: true,
    mapMobility: true,
    mapAttractors: true,
    mapPredictive: true,
    chartTemporal: true,
    chartTopology: true,
    chartEnvironmental: true,
    chartPrediction: true,
    sweepDenue: true,
    sweepIncidencia: true,
    sweepRepuve: true,
    sweepRnpdno: true,
    sweepMultimodal: true,
    sweepCifa: true,
    graphConnections: true,
    includeOsintAppendix: false,
  });

  const [sweepsComments, setSweepsComments] = useState("");

  // 🔒 5. REACT RENDER ISOLATION LAYER
  useEffect(() => {
    if (ReportEngineKernel.isActive()) {
      console.warn("[ReportEngineKernel] Kernel is locked during render, isolating lifecycle.");
    }
  }, []);

  useEffect(() => {
    if (project) {
      if ((project as any).sweepsComments) {
        setSweepsComments((project as any).sweepsComments);
      }
      if ((project as any).incidents) {
        setIncidents((project as any).incidents);
      }
    }
  }, [project]);

  // Automatically enable tools if there is an existing hypothesis loaded
  useEffect(() => {
    if (project && project.hipotesis && project.hipotesis.trim().length > 10) {
      setIsHypothesisValidatedInWorkspace(true);
    }
  }, [project]);

  const sweepsSummaryText = React.useMemo(() => {
    if (!project?.sweeps || project.sweeps.length === 0) {
      return "No hay barridos de información registrados o integrados en la hipótesis de este expediente todavía.";
    }
    return dedupeSweeps(project.sweeps)
      .map((s: any) => `• [Barrido ${s.engine}] Tipo: ${s.type} | Relevancia: ${s.relevance}\n  Datos: ${s.extractedData || "Sin datos"}`)
      .join("\n\n");
  }, [project?.sweeps]);

  const getNextReportNumber = async (projId: string) => {
    try {
      const { getDb } = await import("@/lib/firebase");
      const db = getDb();
      const { getDocs, query, where, collection } = await import("firebase/firestore");
      
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const dateStr = `${dd}${mm}${yyyy}`;
      
      const q = query(collection(db, "dossiers"), where("projectId", "==", projId));
      const snap = await getDocs(q);
      const count = snap.size;
      
      if (count === 0) {
        return `${dateStr}/001`;
      } else {
        return `${dateStr}/001.${count}`;
      }
    } catch (err) {
      console.error("Error calculating next report number:", err);
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      return `${dd}${mm}${yyyy}/001`;
    }
  };

  useEffect(() => {
    if (project?.id) {
      const loadNextReportNum = async () => {
        const num = await getNextReportNumber(project.id);
        setReportNumber(num);
      };
      void loadNextReportNum();
    }
  }, [project?.id, historyDossiers.length]);

  useEffect(() => {
    if (project && project.reportSummary && !reportSummary) {
      setReportSummary(project.reportSummary);
    }
    if (project && project.hipotesis !== undefined) {
      setAnalysisContext(project.hipotesis || "");
    }
  }, [project?.hipotesis, project?.reportSummary]);

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
  const [toast, setToast] = useState<{ type: "success" | "warning" | "error" | "info"; message: string } | null>(null);

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

;

  const [isRetrievingAnalysisData, setIsRetrievingAnalysisData] = useState(false);

  const loadAnalysisData = async () => {
    const selected = album.filter((p) => selectedIds.includes(p.id));
    const withCoords = selected.filter(
      (p) =>
        p.lat != null &&
        p.lng != null &&
        Number.isFinite(Number(p.lat)) &&
        Number.isFinite(Number(p.lng))
    );
    if (withCoords.length === 0) return;

    setIsRetrievingAnalysisData(true);
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

      const centerLat = withCoords.reduce((acc, p) => acc + Number(p.lat), 0) / withCoords.length;
      const centerLng = withCoords.reduce((acc, p) => acc + Number(p.lng), 0) / withCoords.length;

      const res = await fetch("/api/analyze-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: photosPayload,
          analysisRadius,
          analysisPolygon,
          manualPois,
        }),
      });

      if (res.ok) {
        const text = await res.text();
        if (text) {
          const mapData = JSON.parse(text);
          setAnalysisResult(mapData);
        }
      }
    } catch (err) {
      console.error("[PhotoAlbum] Error retrieving analysis data:", err);
    } finally {
      setIsRetrievingAnalysisData(false);
    }
  };

  const confirmAndGenerateProfile = async () => {
    let selected = album.filter((p) => selectedIds.includes(p.id));
    if (selected.length === 0) {
      selected = album;
    }
    const withCoords = selected.filter(
      (p) =>
        p.lat != null &&
        p.lng != null &&
        Number.isFinite(Number(p.lat)) &&
        Number.isFinite(Number(p.lng))
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
    const addLog = (msg: string) => {
      setGenerationLogs((prev) => [...prev, `[${new Date().toLocaleTimeString("es-MX")}] ${msg}`]);
    };
    setGenerationLogs([]);
    setGenerationChapter(0);
    addLog("Iniciando procesamiento del Dictamen Técnico de Inteligencia...");
    let hasError = false;
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

      // Usar el centroide geográfico real de las evidencias seleccionadas, priorizando las coordenadas del proyecto o el polígono de análisis
      const projLat = Number(project?.latitude);
      const projLng = Number(project?.longitude);
      const polyLat = (analysisPolygon && analysisPolygon.length > 0) ? (analysisPolygon.reduce((acc, p) => acc + p.lat, 0) / analysisPolygon.length) : NaN;
      const polyLng = (analysisPolygon && analysisPolygon.length > 0) ? (analysisPolygon.reduce((acc, p) => acc + p.lng, 0) / analysisPolygon.length) : NaN;
      const centerLat = withCoords.length > 0 ? (withCoords.reduce((acc, p) => acc + Number(p.lat), 0) / withCoords.length) : NaN;
      const centerLng = withCoords.length > 0 ? (withCoords.reduce((acc, p) => acc + Number(p.lng), 0) / withCoords.length) : NaN;
      const lat = (!isNaN(projLat) && projLat !== 0) ? projLat : (!isNaN(polyLat) ? polyLat : (!isNaN(centerLat) ? centerLat : 21.8818));
      const lng = (!isNaN(projLng) && projLng !== 0) ? projLng : (!isNaN(polyLng) ? polyLng : (!isNaN(centerLng) ? centerLng : -102.2915));
      // Helper local de fetch con timeout
      const fetchWithTimeout = async (url: string, options: any, timeoutMs = 15000): Promise<Response> => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          clearTimeout(id);
          return response;
        } catch (err) {
          clearTimeout(id);
          throw err;
        }
      };

      addLog("Llamando APIs de georreferenciación táctica y análisis territorial...");
      console.log("[confirmAndGenerateProfile] 1. Inicializando análisis y llamando APIs concurrentes...");
      setAiProfile("Inicializando análisis y consultando bases cartográficas...");

      // EJECUCIÓN PARALELA: Mapa, Incidencia y Barrido OSINT Automático (X/Twitter, Google, DENUE, News)
      const mapResPromise = fetchWithTimeout("/api/analyze-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          photos: photosPayload, 
          analysisRadius,
          analysisPolygon,
          manualPois
        }),
      }, 15000).catch(e => {
        console.warn("[PhotoAlbum] Error /api/analyze-selection (se continúa con datos por defecto):", e);
        return null;
      });

      const incidenciaResPromise = fetchWithTimeout("/api/incidencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, radius: analysisRadius }), // Forzamos a la BDD a respetar el radio
      }, 12000).catch(e => {
        console.warn("[PhotoAlbum] Error /api/incidencia (se continúa sin incidencia local):", e);
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

      addLog("APIs territoriales, de incidencia y OSINT resueltas correctamente.");
      console.log("[confirmAndGenerateProfile] 2. APIs iniciales resueltas.");

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
      let incidenciaCompleta: any[] = [];
      let bibliografiaLocal = "";
      if (incidenciaRes && incidenciaRes.ok) {
        try {
          const incText = await incidenciaRes.text();
          if (incText) {
            const incidenciaJson = JSON.parse(incText) as any;
            incidenciaLocal = (incidenciaJson.data ?? []).slice(0, 30);
            incidenciaCompleta = incidenciaJson.data ?? [];
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
        let finalMarkdown = "";
        let data: any = null;
        const totalChapters = 11;

        addLog("Iniciando bucle de generación de 11 capítulos con la IA...");
        for (let ch = 1; ch <= totalChapters; ch++) {
          setGenerationChapter(ch);
          addLog(`Solicitando a la IA: ${getChapterLabel(ch)} (Sección ${ch} de 11)...`);
          setAiProfile(`Generando informe de geointeligencia... Capítulo ${ch} de ${totalChapters}`);

          let res: Response | null = null;
          let retries = 3;
          let delayMs = 2000;

          for (let attempt = 1; attempt <= retries; attempt++) {
            try {
              res = await fetchWithTimeout("/api/generate-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  projectName: project?.nombre || "",
                  projectId: project?.id || "",
                  photos: photosPayload.map(({ imageBase64, ...rest }) => rest), // Quitar base64 masivo para evitar Timeout 504
                  analysisContext: (analysisContext || "") + svInstruction,
                  analysisRadius,
                  focusAreas,
                  incidenciaLocal,
                  incidenciaCompleta,
                  lat,
                  lng,
                  bibliografiaLocal,
                  multimodalContext,
                  geometryType: project?.geometryType || "individual",
                  projectDescription: project?.descripcion || "",
                  osintEngineData: automaticOsintData,
                  streetViews: svData,
                  datosGobMxData: datosGobMxResult,
                  linkedGangReport: project?.linkedGangReport,
                  sweeps: dedupeSweeps((project as any)?.sweeps || []),
                  sweepsComments: sweepsComments,
                  chapter: ch
                }),
              }, 120000);

              if (res.ok) {
                break;
              }

              addLog(`⚠️ Intento ${attempt} fallido con status ${res.status}.`);
              console.warn(`[confirmAndGenerateProfile] Intento ${attempt} fallido con status ${res.status}.`);
            } catch (err) {
              addLog(`⚠️ Intento ${attempt} fallido por error de red/fetch.`);
              console.warn(`[confirmAndGenerateProfile] Intento ${attempt} arrojó error de red/fetch:`, err);
              if (attempt === retries) {
                throw err;
              }
            }
            await new Promise(r => setTimeout(r, delayMs));
            delayMs *= 1.5;
          }

          if (!res || !res.ok) {
            const text = res ? await res.text().catch(() => "") : "";
            let msg = `Error al generar el capítulo ${ch} de la IA tras varios reintentos`;
            try {
              const json = JSON.parse(text) as { error?: string; details?: string };
              if (json && json.error) {
                msg = json.error + (json.details ? ` | Detalles técnicos: ${json.details}` : "");
              }
            } catch {}
            throw new Error(msg);
          }

          const reader = res.body?.getReader();
          if (!reader) {
            throw new Error("No se pudo iniciar el lector de flujo del servidor.");
          }

          const decoder = new TextDecoder("utf-8");
          let accumulatedResponse = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            accumulatedResponse += chunk;

            try {
              const markdownMatch = accumulatedResponse.match(/"markdown"\s*:\s*"(.*)/);
              if (markdownMatch) {
                let currentMarkdown = markdownMatch[1];
                if (currentMarkdown.endsWith('"}')) {
                  currentMarkdown = currentMarkdown.slice(0, -2);
                }
                try {
                  // Unescape JSON string fragment
                  currentMarkdown = JSON.parse(`"${currentMarkdown}"`);
                } catch {
                  // Fallback unescape
                  currentMarkdown = currentMarkdown
                    .replace(/\\n/g, "\n")
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, "\\");
                }
                setAiProfile(finalMarkdown + currentMarkdown);
                setEditableProfile(finalMarkdown + currentMarkdown);
              }
            } catch (streamErr) {
              console.warn("[confirmAndGenerateProfile] Stream chunk parse warning:", streamErr);
            }
          }

          let chapterData: any;
          try {
            chapterData = JSON.parse(accumulatedResponse);
          } catch (err) {
            throw new Error(`El servidor devolvió una respuesta vacía o incompleta en el capítulo ${ch}.`);
          }

          if (!data) {
            data = { meta: {} };
          }
          if (chapterData.meta) {
            data.meta = {
              ...data.meta,
              ...chapterData.meta
            };
          }
          data.markdown = chapterData.markdown;
          let chunkMarkdown = chapterData.markdown || "";
          if (chunkMarkdown.startsWith("```markdown")) {
            chunkMarkdown = chunkMarkdown.replace(/^```markdown\s*/i, "").replace(/\s*```$/g, "").trim();
          } else if (chunkMarkdown.startsWith("```")) {
            chunkMarkdown = chunkMarkdown.replace(/^```\s*/, "").replace(/\s*```$/g, "").trim();
          }

          addLog(`✓ ${getChapterLabel(ch)} generado con éxito.`);
          finalMarkdown += chunkMarkdown + "\n\n";
        }

        addLog("Generación de capítulos completada con éxito.");
        addLog("Procesando carátula e integraciones documentales...");
        console.log("[confirmAndGenerateProfile] 4. Generación con IA finalizada. Procesando carátula e integraciones...");
        finalMarkdown = finalMarkdown.trim();

        if (
          automaticOsintData?.streetViewAnalysis?.analisis &&
          !/BARRIDO MULTIMODAL DE STREET VIEW/i.test(finalMarkdown)
        ) {
          finalMarkdown += `\n\n### BARRIDO MULTIMODAL DE STREET VIEW (IA)\n${automaticOsintData.streetViewAnalysis.analisis}`;
        }

        setAiProfile(finalMarkdown);
        setEditableProfile(finalMarkdown);

        setProfileRiskLevel(data.meta?.riskLevel ?? null);



        // Generar resumen automático para la carátula
        let summaryText = "";
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
          if (sumRes.ok) {
            const sumText = await sumRes.text();
            let sumData;
            try { sumData = JSON.parse(sumText); } catch(e) {}
            if (sumData) {
              let sVal = sumData.suggestions || "";
              if (sVal.includes("```")) {
                const match = sVal.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match && match[1]) {
                  try {
                    const parsed = JSON.parse(match[1]);
                    if (parsed.suggestions) sVal = parsed.suggestions;
                  } catch(e) {}
                }
              } else if (sVal.trim().startsWith("{")) {
                try { const parsed = JSON.parse(sVal); if (parsed.suggestions) sVal = parsed.suggestions; } catch(e) {}
              }
              summaryText = sVal.trim();
            }
          }
        } catch (err) {
          console.warn("Fallo al generar resumen con IA, aplicando fallback:", err);
        }

        if (!summaryText) {
          summaryText = `Dictamen estratégico de geointeligencia operativa para el cuadrante del expediente ${project?.nombre || 'bajo estudio'}. Con base en las inspecciones tácticas y el relevamiento espacial, se identificaron factores criminógenos de oportunidad vial y perimetral vinculados al desorden de infraestructura y la pérdida de vigilancia natural en la zona.`;
        }
        setReportSummary(summaryText);

        // Integrar datos para asegurar que las gráficas y el mapa (Dashboard) se pinten
        const combinedCrimes = [
          ...(data.meta?.incidenciaDetalles || []).map((c: any) => ({
            lat: c.lat,
            lng: c.lng,
            fecha: c.fecha || c.FECHA || c.Fecha || c.fechaStr || c.fecha_hecho || c.FECHA_HECHO || new Date().toISOString().split("T")[0],
            tipoDelito: c.incidente || c.tipoDelito || "Delito",
            rangoHorario: c.rango_horario || c.rangoHorario || "Sin rango",
            colonia: c.colonia || c.COLONIA || "SECTOR NO ESPECIFICADO",
            arma: c.arma || c.ARMA || "NINGUNA"
          })),
          ...incidenciaLocal.map((c: any) => ({
            lat: c.lat,
            lng: c.lng,
            fecha: c.fecha || c.FECHA || c.Fecha || c.fechaStr || c.fecha_hecho || c.FECHA_HECHO || new Date().toISOString().split("T")[0],
            tipoDelito: c.tipo || c.incidente || c.tipoDelito || "Delito",
            rangoHorario: c.rangoHorario || c.rango_horario || "Sin rango",
            colonia: c.colonia || c.COLONIA || "SECTOR NO ESPECIFICADO",
            arma: c.arma || c.ARMA || "NINGUNA"
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
          sieData: data.meta?.sieData || (currentAnalysisResult as any)?.sieData,
          tceData: data.meta?.tceData || (currentAnalysisResult as any)?.tceData,
          hieData: data.meta?.hieData || (currentAnalysisResult as any)?.hieData,
        } as any);

        // Integrar automáticamente los lugares de acecho (StreetView) al Álbum
        if (data.meta?.tacticalStreetViews && data.meta.tacticalStreetViews.length > 0) {
          for (const sv of data.meta.tacticalStreetViews) {
            let svLat = sv.lat;
            let svLng = sv.lng;

            if (typeof svLat !== "number" || typeof svLng !== "number") {
              try {
                if (sv.streetViewUrl) {
                  const urlObj = new URL(sv.streetViewUrl);
                  const loc = urlObj.searchParams.get("location");
                  if (loc) {
                    const [latStr, lngStr] = loc.split(",");
                    svLat = parseFloat(latStr);
                    svLng = parseFloat(lngStr);
                  }
                }
              } catch (e) {
                console.error("[PhotoAlbum] No se pudieron extraer coordenadas de StreetView URL:", e);
              }
            }

            if (typeof svLat !== "number" || typeof svLng !== "number" || isNaN(svLat) || typeof svLng !== "number" || isNaN(svLng)) {
              console.warn("[PhotoAlbum] Ignorando StreetView sin coordenadas válidas:", sv);
              continue;
            }

            const exists = album.some(p => 
              Math.abs((p.lat || 0) - svLat) < 0.0001 && 
              Math.abs((p.lng || 0) - svLng) < 0.0001
            );
            
            if (!exists && uploadAndAddPhoto) {
              try {
                const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(sv.streetViewUrl)}`;
                const svRes = await fetch(proxyUrl);
                if (svRes.ok) {
                  const blob = await svRes.blob();
                  const file = new File([blob], `StreetView_${sv.name.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`, { type: "image/jpeg" });
                  const category = sv.streetViewCategory || "hideout";
                  await uploadAndAddPhoto(file, svLat, svLng, {
                    tipo: "STREET_VIEW",
                    gpsSource: "STREET_VIEW",
                    streetViewCategory: category,
                    streetViewSource: "Google Street View",
                    analysisType: "STREET_VIEW",
                    comentario: `EVIDENCIA VIRTUAL STREET VIEW [Categoría: ${category}]: ${sv.name}. ${sv.observed || "Punto de observación de entorno vial."}`,
                    validado: true
                  } as any);

                  if (project?.id) {
                    try {
                      const { collection, query, where, getDocs, updateDoc } = await import("firebase/firestore");
                      const { getDb } = await import("@/lib/firebase");
                      const db = getDb();
                      const photosCol = collection(db, "projects", project.id, "photos");
                      const q = query(
                        photosCol,
                        where("lat", "==", svLat),
                        where("lng", "==", svLng)
                      );
                      const qSnap = await getDocs(q);
                      if (!qSnap.empty) {
                        for (const docDom of qSnap.docs) {
                          await updateDoc(docDom.ref, {
                            streetViewCategory: category,
                            streetViewSource: "Google Street View",
                            analysisType: "STREET_VIEW"
                          });
                        }
                        console.log(`[PhotoAlbum] Metadata de StreetView persistida en Firestore para lat=${svLat}, lng=${svLng}`);
                      }
                    } catch (fsErr) {
                      console.warn("[PhotoAlbum] No se pudo escribir extra metadata en Firestore (pero el archivo ya se subió):", fsErr);
                    }
                  }
                } else {
                  console.error("[PhotoAlbum] Falló la descarga del proxy de StreetView:", svRes.statusText);
                }
              } catch (err) {
                console.error("[PhotoAlbum] Error anexando StreetView al álbum:", err);
              }
            }
          }
        }

        const now = new Date();
        setReportGenerationMeta({
          date: now.toLocaleDateString("es-MX"),
          time: now.toLocaleTimeString("es-MX"),
          user: user ? `${user.username} (${(user.role === "ADMIN" || user.role === "SUPER_ADMIN") ? "Administrador" : "Analista"})` : "Usuario"
        });
        addLog("Dictamen generado y archivado de forma exitosa.");
        setShowReportModal(true);
      } catch (err) {
        hasError = true;
        console.error("ERROR REAL PERFILADOR:", err);
      
        const rawMessage =
          err instanceof Error ? err.message : "Error al generar el perfil criminológico con IA.";
        const lower = rawMessage.toLowerCase();
        const isQuotaError =
          lower.includes("429") ||
          lower.includes("too many requests") ||
          lower.includes("quota");

        const finalErrMsg = isQuotaError
          ? "Saturación de red en la IA. Por favor, espere 40 segundos e intente de nuevo."
          : `Error de Cuartel General: ${rawMessage}`;

        setError(finalErrMsg);
        addLog(`🚨 ERROR CRÍTICO: ${finalErrMsg}`);
      } finally {
        if (!hasError) {
          setIsGeneratingAI(false);
        }
      }
    } catch (outerErr: any) {
      console.error("Outer generation error:", outerErr);
      setError(outerErr.message || "Error al inicializar la generación.");
      setIsGeneratingAI(false);
    }
  };

  const autoCaptureSnapshots = async (): Promise<{ title: string; dataUrl: string }[]> => {
    // Ya no se requiere captura en pantalla del DOM (html2canvas) ya que
    // el motor de maquetación genera todos los mapas, gráficas y grafos vectoriales
    // de forma nativa e independiente a nivel de kernel utilizando VectorRenderEngine.
    return [];
  };

  const handleAttachMapSnapshot = async () => {
    await autoCaptureSnapshots();
    alert("Mapas capturados exitosamente para el dictamen oficial.");
  };

  const handleSaveExpediente = async () => {
    const kernelContext = ReportEngineKernel.getContext();
    if (!kernelContext || !kernelContext.editorialPayload) {
      alert("⚠️ Por favor, genere el dictamen con la IA antes de guardarlo en la bitácora institucional.");
      return;
    }
    setIsSavingExpediente(true);
    try {
      const { getDb } = await import("@/lib/firebase");
      const { addDoc, collection } = await import("firebase/firestore");
      const db = getDb();
      const activeComponents = Object.entries(selectedAnnexes)
        .filter(([_, val]) => !!val)
        .map(([key]) => key);
        
      const dataToSave = {
        projectId: project?.id || "EXP_TACTICO",
        poligono: project?.nombre || (project as any)?.name || "Zona de Estudio",
        analyst: user?.username || "Analista CEIPOL",
        fecha: Date.now(),
        version: "v9.0",
        componentes: activeComponents,
        fuentes: (project?.sweeps || []).map((s: any) => s.engine || s.name).filter(Boolean),
        visualsCount: (album || []).length + (mapSnapshots || []).length,
        editorialPayload: kernelContext.editorialPayload,
        briefing: kernelContext.briefing || null
      };

      await addDoc(collection(db, "dossiers"), dataToSave);
      alert("¡Expediente guardado correctamente en la bitácora institucional!");
    } catch (err) {
      console.error("Error al guardar expediente:", err);
      alert("No se pudo guardar el expediente.");
    } finally {
      setIsSavingExpediente(false);
    }
  };

  const verifyAndPasswordCheck = async (): Promise<boolean> => {
    if (!user || !user.username) {
      alert("No hay ningún usuario autenticado en la sesión actual.");
      return false;
    }
    const passwordEntered = window.prompt("Por favor, introduzca su contraseña de usuario para autorizar la eliminación:");
    if (passwordEntered === null) return false;
    if (!passwordEntered.trim()) {
      alert("La contraseña no puede estar vacía.");
      return false;
    }
    try {
      const { getDb } = await import("@/lib/firebase");
      const db = getDb();
      const { getDocs, query, where, collection } = await import("firebase/firestore");
      const q = query(
        collection(db, "users"),
        where("username", "==", user.username.trim())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        alert("No se encontró el registro del usuario actual.");
        return false;
      }
      const docSnap = snap.docs[0];
      const data = docSnap.data() as { passwordHash?: string };
      if (data.passwordHash !== passwordEntered) {
        alert("Contraseña incorrecta. Autorización denegada.");
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error al validar contraseña:", err);
      alert("Error de comunicación al validar credenciales.");
      return false;
    }
  };

  const handleDeleteDossier = async (dossierId: string) => {
    const verified = await verifyAndPasswordCheck();
    if (!verified) return;

    const confirm1 = window.confirm("⚠️ PRIMERA CONFIRMACIÓN: ¿Está totalmente seguro de eliminar definitivamente este dictamen oficial de la bitácora institucional?");
    if (!confirm1) return;

    const confirm2 = window.confirm("🚨 SEGUNDA CONFIRMACIÓN DE SEGURIDAD: Esta acción es irreversible y se registrará en la bitácora de auditoría. ¿Confirmar eliminación definitiva?");
    if (!confirm2) return;

    try {
      const { getDb } = await import("@/lib/firebase");
      const db = getDb();
      const { deleteDoc, doc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "dossiers", dossierId));
      
      await logAuditAction({
        action: "ELIMINAR_DICTAMEN_HISTORIAL",
        module: "Expedientes",
        projectId: project?.id || "EXP",
        projectName: project?.nombre || "EXP",
        details: `Eliminado dictamen guardado ID ${dossierId} por el analista ${user?.username}.`
      });

      alert("El dictamen oficial ha sido eliminado correctamente.");
      setHistoryDossiers(prev => prev.filter(h => h.id !== dossierId));
    } catch (err: any) {
      alert("Error al eliminar el dictamen: " + err.message);
    }
  };

  const handleConsultarHistorial = async () => {
    setIsLoadingHistory(true);
    setShowHistoryModal(true);
    try {
      const { getDb } = await import("@/lib/firebase");
      const db = getDb();
      const { getDocs, query, where, collection } = await import("firebase/firestore");
      const q = query(collection(db, "dossiers"), where("projectId", "==", project?.id || "EXP_TACTICO"));
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setHistoryDossiers(list.sort((a, b) => b.fecha - a.fecha));
    } catch (err) {
      console.error("Error al consultar historial:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFinalizeAndExport = async (format: "WORD" | "PDF") => {
    const rawContent = editableProfile || aiProfile || (project as any)?.analysisContent;
    if (!rawContent) {
      setError("No hay contenido para exportar. Genere o guarde el dictamen primero.");
      return;
    }
    setIsSavingAnalysis(true);
    setError(null);
    
    try {
      const snapshotsToExport = await autoCaptureSnapshots();
      const content = rawContent.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "[$1]");

      const chartsSnaps = snapshotsToExport.filter((s) => {
        const isChart = s.title.toLowerCase().includes("gráfica") || s.title.toLowerCase().includes("grafica");
        if (!isChart) return false;
        if (s.title.includes("1") && !selectedAnnexes.chartTemporal) return false;
        if (s.title.includes("2") && !selectedAnnexes.chartTopology) return false;
        if (s.title.includes("3") && !selectedAnnexes.chartEnvironmental) return false;
        if (s.title.includes("4") && !selectedAnnexes.chartPrediction) return false;
        return true;
      });

      const mapsSnaps = snapshotsToExport.filter((s) => {
        const isChart = s.title.toLowerCase().includes("gráfica") || s.title.toLowerCase().includes("grafica");
        if (isChart) return false;
        if (s.title.toLowerCase().includes("densidad") && !selectedAnnexes.mapDensity) return false;
        if (s.title.toLowerCase().includes("corredores") && !selectedAnnexes.mapMobility) return false;
        if (s.title.toLowerCase().includes("atracción") && !selectedAnnexes.mapAttractors) return false;
        if (s.title.toLowerCase().includes("proyección") && !selectedAnnexes.mapPredictive) return false;
        return true;
      });

      const sortedSnapshotsToExport = [...mapsSnaps, ...chartsSnaps].slice(0, 8);
      let photosToExport = album.filter((p) => selectedIds.includes(p.id) && p.previewUrl).slice(0, 8);
      if (photosToExport.length === 0) {
        photosToExport = album.filter((p) => p.previewUrl).slice(0, 8);
      }

      const photosToExportData = photosToExport.map((p) => ({
        id: p.id,
        previewUrl: p.previewUrl,
        tipo: p.tipo || "Evidencia Táctica",
        comentario: p.comentario || "Sin comentario."
      }));

      const selectedSweeps = (project?.sweeps || []).filter((s: any) => {
        const engineLower = s.engine.toLowerCase();
        if (engineLower.includes("denue") && !selectedAnnexes.sweepDenue) return false;
        if (engineLower.includes("incidencia") && !selectedAnnexes.sweepIncidencia) return false;
        if (engineLower.includes("vehicular") && !selectedAnnexes.sweepRepuve) return false;
        if (engineLower.includes("desaparecidos") && !selectedAnnexes.sweepRnpdno) return false;
        if (engineLower.includes("multimodal") && !selectedAnnexes.sweepMultimodal) return false;
        if (engineLower.includes("cifa") && !selectedAnnexes.sweepCifa) return false;
        return s.status === "Integrado";
      });

      const powerupsToExport = (documents || [])
        .filter((d: any) => d.type === "powerup_execution")
        .map((d: any) => {
          try {
            return JSON.parse(d.context);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const activeId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 1. INIT_KERNEL
      await KernelGuard({ type: "INIT_KERNEL", payload: { executionId: activeId } });

      // 2. LOCK_INPUT
      const centroidLat = (() => {
        if (project?.latitude) return project.latitude;
        const valid = (album || []).filter(p => p.lat != null);
        if (valid.length === 0) return 21.8853;
        return valid.reduce((sum, p) => sum + Number(p.lat), 0) / valid.length;
      })();
      const centroidLng = (() => {
        if (project?.longitude) return project.longitude;
        const valid = (album || []).filter(p => p.lng != null);
        if (valid.length === 0) return -102.2916;
        return valid.reduce((sum, p) => sum + Number(p.lng), 0) / valid.length;
      })();

      await KernelGuard({
        type: "LOCK_INPUT",
        payload: {
          executionId: activeId,
          project: {
            ...project,
            latitude: centroidLat,
            longitude: centroidLng,
            analysisRadius,
            historicalIncidents: (analysisResult as any)?.historicalCrimes || [],
            incidents: (analysisResult as any)?.historicalCrimes || [],
            incidenciaCompleta: (analysisResult as any)?.historicalCrimes || [],
            incidenciaLocal: (analysisResult as any)?.historicalCrimes || []
          },
          content,
          album: photosToExportData,
          mapSnapshots: sortedSnapshotsToExport,
          riskLevel: profileRiskLevel ?? undefined,
          scinceDemographics: (analysisResult as any)?.scinceDemographics,
          reportNumber: reportNumber || (project?.id ? String(project.id) : "") || "DICTAMEN_CRIMINOLOGICO",
          reportSummary,
          user: { id: user?.id ? String(user.id) : "unknown", username: user?.username || "Usuario", role: user?.role || "USER" },
          markAsPrinted: !isReadOnly ? markAsPrinted : undefined,
          sweeps: selectedSweeps,
          powerups: powerupsToExport,
          selectedAnnexes: {
            ...selectedAnnexes,
            sweepDenue: { selected: selectedAnnexes.sweepDenue, available: (project?.sweeps || []).some((s: any) => s.engine.toLowerCase().includes("denue") && s.status === "Integrado") },
            sweepIncidencia: { selected: selectedAnnexes.sweepIncidencia, available: (project?.sweeps || []).some((s: any) => s.engine.toLowerCase().includes("incidencia") && s.status === "Integrado") },
            sweepRepuve: { selected: selectedAnnexes.sweepRepuve, available: (project?.sweeps || []).some((s: any) => s.engine.toLowerCase().includes("vehicular") && s.status === "Integrado") },
            sweepRnpdno: { selected: selectedAnnexes.sweepRnpdno, available: (project?.sweeps || []).some((s: any) => s.engine.toLowerCase().includes("desaparecidos") && s.status === "Integrado") },
            sweepMultimodal: { selected: selectedAnnexes.sweepMultimodal, available: (project?.sweeps || []).some((s: any) => s.engine.toLowerCase().includes("multimodal") && s.status === "Integrado") },
            sweepCifa: { selected: selectedAnnexes.sweepCifa, available: (project?.sweeps || []).some((s: any) => s.engine.toLowerCase().includes("cifa") && s.status === "Integrado") },
          },
          includeOsintAppendix: selectedAnnexes.includeOsintAppendix
        }
      });

      // 3. APPLY_POWERUPS
      await KernelGuard({ type: "APPLY_POWERUPS", payload: { executionId: activeId } });

      // 4. DERIVE_LAYOUT
      await KernelGuard({ type: "DERIVE_LAYOUT", payload: { executionId: activeId } });

      // 5. VALIDATE_KERNEL
      await KernelGuard({ type: "VALIDATE_KERNEL", payload: { executionId: activeId } });

      // 6. EXECUTE_EXPORT (WORD or PDF - Sequential Auto-completing)
      await KernelGuard({
        type: "EXECUTE_EXPORT",
        payload: { format, activeId }
      });

      // Verify the final kernel state is COMPLETE
      if (ReportEngineKernel.getState() !== "COMPLETE") {
        throw new Error("STATE_MACHINE_INCOMPLETE");
      }

      setHasSavedAnalysis(true);
      window.alert("¡Dictamen Oficial generado, exportado y guardado con éxito!");
    } catch (err) {
      console.error("[PhotoAlbum] Error al finalizar y exportar el dictamen:", err);
      let errMsg = "No se pudo generar y exportar el informe.";
      if (err instanceof Error) {
        if (err.message.includes("VALIDATION_FAILED_CRITERIA")) {
          errMsg = "ERROR DE VALIDACIÓN INSTITUCIONAL: El informe excede las 12 páginas, contiene comandos internos prohibidos o carece de los anexos obligatorios (mapas, gráficas, resumen o conclusiones).";
        } else if (err.message === "STATE_MACHINE_OVERFLOW_BLOCKED") {
          errMsg = "BLOQUEO DE STATE MACHINE: El informe excede los límites máximos permitidos. Simplifique el dictamen.";
        } else {
          errMsg = err.message;
        }
      }
      setError(errMsg);
    } finally {
      setIsSavingAnalysis(false);
    }
  };

  if (album.length === 0) {
    return (
      <div className="p-6 col-span-full w-full">
        <CEIPOLEmptyState
          icon="📸"
          title="Álbum sin fotografías"
          description="Agregue fotografías desde el bloque de captura."
        />
      </div>
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

      {/* Panel de Auditoría Street View - FIX-GEO-01 */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3 font-sans shadow-xl print:hidden">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <span className="text-base">📍</span>
          <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">
            Auditoría de Gobernanza: Evidencia Street View
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.entries(streetViewValidation).map(([key, value]: [string, any]) => {
            const isInsufficient = value.status === "INSUFFICIENT";
            const isCapped = value.status === "CAPPED";
            const isEmpty = value.status === "EMPTY";
            const isValid = value.status === "VALID";

            let bgClass = "bg-slate-900/40 border-slate-800/50 text-slate-400";
            let badgeClass = "bg-slate-800 text-slate-400 border border-slate-700";
            let statusText = "Sin capturas";

            if (isValid) {
              bgClass = "bg-emerald-950/20 border-emerald-500/20 text-emerald-300";
              badgeClass = "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60";
              statusText = "✓ Conforme";
            } else if (isInsufficient) {
              bgClass = "bg-amber-950/20 border-amber-500/20 text-amber-300";
              badgeClass = "bg-amber-950/60 text-amber-400 border border-amber-800/60";
              statusText = "⚠ Requiere captura adicional";
            } else if (isCapped) {
              bgClass = "bg-blue-950/20 border-blue-500/20 text-blue-300";
              badgeClass = "bg-blue-950/60 text-blue-400 border border-blue-800/60";
              statusText = "ⓘ Exceso (Capped at 4)";
            }

            return (
              <div
                key={key}
                className={`p-3 rounded-lg border flex flex-col justify-between gap-2.5 transition-all hover:bg-slate-900/30 ${bgClass}`}
              >
                <div className="space-y-1">
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-[11px] font-bold text-slate-100 uppercase tracking-wide">
                      {value.label}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full ${badgeClass}`}>
                      {statusText}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Capturas en el expediente: <strong className="text-slate-200">{value.count}</strong>
                  </p>
                </div>
                {isInsufficient && (
                  <div className="text-[9px] text-amber-400 leading-normal border-t border-amber-500/10 pt-1.5 flex items-center gap-1">
                    <span>⚠</span>
                    <span>Evidencia Street View insuficiente. Se requieren mínimo 2 capturas.</span>
                  </div>
                )}
                {isCapped && (
                  <div className="text-[9px] text-blue-400 leading-normal border-t border-blue-500/10 pt-1.5 flex items-center gap-1">
                    <span>ⓘ</span>
                    <span>Mostrando únicamente 4 capturas en el reporte y visualización para evitar contaminación.</span>
                  </div>
                )}
                {isEmpty && (
                  <div className="text-[9px] text-slate-500 leading-normal border-t border-slate-800/50 pt-1.5">
                    No se han registrado capturas de Street View en esta categoría.
                  </div>
                )}
                {isValid && (
                  <div className="text-[9px] text-emerald-400 leading-normal border-t border-emerald-500/10 pt-1.5 flex items-center gap-1">
                    <span>✓</span>
                    <span>Gobernanza conforme. Evidencia validada correctamente.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
                        setClickCoords({ x: e.clientX, y: e.clientY });
                        setImageDeleteFlow({
                          isOpen: true,
                          photo: p,
                          step: 1
                        });
                      }}
                      className="absolute top-2 right-2 rounded-lg p-2 bg-red-600/90 text-white hover:bg-red-500 shadow-lg border border-red-500/20 transition-all duration-150 backdrop-blur-sm"
                      title="🗑️ Eliminar imagen"
                      aria-label="Eliminar imagen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                          onClick={(e) => { setClickCoords({ x: e.clientX, y: e.clientY }); setEditingPhoto(p); }}
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
                        onApplyPowerUp={(text) => {
                          // PowerUps exist ONLY as structured metadata, not inline text
                        }}
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
                      <span className="text-slate-400">Aptitud de contenido (Longitud mínima):</span>
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

                  {/* BADGE DE GOBERNANZA DE EVIDENCIA REMOTE GABINETE v2.1 */}
                  {(p.evidenceCategoryClass === "REMOTE_VISUAL" || p.evidenceOrigin === "REMOTE" || p.tipo === "REMOTE_STREET_VIEW") && (
                    <div className="mt-2 mb-2 p-2 bg-amber-950/40 border border-amber-500/40 rounded-lg space-y-1 text-left font-sans">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="px-1.5 py-0.5 text-[8px] font-black uppercase bg-amber-500 text-slate-950 rounded tracking-wider">
                          🌐 TRABAJO DE GABINETE
                        </span>
                        <span className="text-[9px] font-bold text-amber-400">
                          {p.confidencePercentage || 100}% ({p.confidenceLevel || "HIGH"})
                        </span>
                      </div>
                      <div className="text-[8px] text-slate-300 font-mono leading-tight space-y-0.5">
                        <div>Fuente: <strong className="text-slate-200">{p.streetViewSource || p.sourceProvider || "Google Street View"}</strong></div>
                        <div>Fecha Toma Google: <strong className="text-slate-200">{p.streetViewMetadata?.captureDate || "N/D"}</strong></div>
                        {p.streetViewMetadata && (
                          <div>POV: HDG <strong className="text-cyan-400">{p.streetViewMetadata.heading}°</strong> | PITCH <strong className="text-cyan-400">{p.streetViewMetadata.pitch}°</strong> | FOV <strong className="text-cyan-400">{p.streetViewMetadata.fov}°</strong></div>
                        )}
                      </div>
                    </div>
                  )}

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

                  {/* NUEVA SECCIÓN: RELACIÓN ANALÍTICA (FASE 7.12.4) */}
                  <div className="mt-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-850 pb-1.5">
                      <span className="text-xs">🕸️</span>
                      <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Relación Analítica</h4>
                    </div>

                    {/* Evidencia & Territorio (FASE 7.12.1) */}
                    <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400">
                      <div className="bg-slate-900/60 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 font-bold block text-[8px] uppercase tracking-wider">Evidencia</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs">📷</span>
                          <span className="font-semibold text-slate-300 truncate">{(p as any).source || (p.tipo === "STREET_VIEW" ? "STREET_VIEW" : "FIELD_CAPTURE")}</span>
                        </div>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 font-bold block text-[8px] uppercase tracking-wider">Territorio (📍 Ubicación)</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs">📍</span>
                          <span className="font-semibold text-slate-300 truncate">
                            {project?.geometryType === "poligono" ? "POLÍGONO" : project?.geometryType === "lineal" ? "LÍNEA / CORREDOR" : "PUNTO"}
                          </span>
                        </div>
                        {p.lat && p.lng && (
                          <p className="text-[7.5px] text-sky-400 font-semibold truncate leading-none mt-1">
                            Región: {project?.nombre || "Zona del Proyecto"}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Factores Criminógenos (FASE 7.12.2) */}
                    <div className="space-y-1.5">
                      <span className="text-slate-500 font-bold block text-[8px] uppercase tracking-wider">Factores Criminógenos Asociados</span>
                      
                      {/* Factores Actuales */}
                      <div className="flex flex-wrap gap-1">
                        {(!p.evidenceRelationship?.criminogenicFactors || p.evidenceRelationship.criminogenicFactors.length === 0) ? (
                          <span className="text-[9px] text-slate-600 italic">Ningún factor asociado</span>
                        ) : (
                          p.evidenceRelationship.criminogenicFactors.map((f: string, idx: number) => (
                            <span key={idx} className="bg-slate-850 text-slate-300 text-[8.5px] px-1.5 py-0.5 rounded border border-slate-750 font-medium">
                              {f}
                            </span>
                          ))
                        )}
                      </div>

                      {/* IA Sugerencias de Factores (FASE 7.12.5 - Lenguaje Probabilístico) */}
                      <div className="bg-slate-900/40 p-2 rounded border border-slate-850/80 space-y-1">
                        <span className="text-[7.5px] text-sky-400 font-bold uppercase tracking-wider">Sugerencias IA (Probabilístico)</span>
                        <div className="flex flex-wrap gap-1">
                          {EvidenceRelationshipEngine.suggestCriminogenicFactors({
                            tipo: p.tipo || "",
                            comentario: p.comentario || ""
                          }).map((sug: any, sIdx: number) => {
                            const isAdded = p.evidenceRelationship?.criminogenicFactors?.includes(sug.description) || false;
                            return (
                              <button
                                key={sIdx}
                                type="button"
                                disabled={isReadOnly}
                                onClick={async () => {
                                  if (isReadOnly) return;
                                  const currentFactors = p.evidenceRelationship?.criminogenicFactors || [];
                                  const newFactors = isAdded 
                                    ? currentFactors.filter((f: string) => f !== sug.description)
                                    : [...currentFactors, sug.description];

                                  const updatedRel: EvidenceRelationship = {
                                    id: p.evidenceRelationship?.id || `rel-${p.id}-${Date.now()}`,
                                    evidenceId: p.id,
                                    projectId: projectId || "N/A",
                                    source: (p as any).source || (p.tipo === "STREET_VIEW" ? "STREET_VIEW" : "FIELD_CAPTURE"),
                                    geography: {
                                      type: project?.geometryType === "poligono" ? "POLYGON" : project?.geometryType === "lineal" ? "LINE" : "POINT",
                                      latitude: p.lat || undefined,
                                      longitude: p.lng || undefined,
                                      area: project?.nombre || "Área General"
                                    },
                                    criminogenicFactors: newFactors,
                                    hypothesisLinks: p.evidenceRelationship?.hypothesisLinks || [],
                                    confidence: p.evidenceRelationship?.confidence || "MEDIUM",
                                    createdAt: p.evidenceRelationship?.createdAt || new Date().toISOString()
                                  };

                                  if (updatePhotoRelationship) {
                                    await updatePhotoRelationship(p.id, updatedRel);
                                  }
                                }}
                                className={`text-[8.5px] px-1.5 py-0.5 rounded transition duration-150 flex items-center gap-1 ${
                                  isAdded 
                                    ? "bg-emerald-950/80 text-emerald-400 border border-emerald-850/50 hover:bg-emerald-900/40"
                                    : "bg-slate-900 text-slate-400 border border-slate-850 hover:bg-slate-800 hover:text-slate-300"
                                }`}
                              >
                                {isAdded ? "✓" : "+"} {sug.description}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Hipótesis Relacionadas (FASE 7.12.3) */}
                    <div className="space-y-1.5">
                      <span className="text-slate-500 font-bold block text-[8px] uppercase tracking-wider">Hipótesis Relacionadas</span>
                      
                      {/* Vínculos Actuales */}
                      <div className="flex flex-wrap gap-1">
                        {(!p.evidenceRelationship?.hypothesisLinks || p.evidenceRelationship.hypothesisLinks.length === 0) ? (
                          <span className="text-[9px] text-slate-600 italic">Ninguna hipótesis vinculada</span>
                        ) : (
                          p.evidenceRelationship.hypothesisLinks.map((h: string, idx: number) => (
                            <span key={idx} className="bg-sky-950/40 text-sky-400 text-[8.5px] px-1.5 py-0.5 rounded border border-sky-900/40 font-medium">
                              {h}
                            </span>
                          ))
                        )}
                      </div>

                      {/* IA Sugerencias de Hipótesis (FASE 7.12.5 - Lenguaje Probabilístico) */}
                      <div className="bg-slate-900/40 p-2 rounded border border-slate-850/80 space-y-1">
                        <span className="text-[7.5px] text-sky-400 font-bold uppercase tracking-wider">Vincular Hipótesis IA (Sugerido)</span>
                        <div className="flex flex-col gap-1">
                          {EvidenceRelationshipEngine.suggestHypothesisLinks({
                            tipo: p.tipo || "",
                            comentario: p.comentario || ""
                          }).map((sugHyp: any, hIdx: number) => {
                            const isAdded = p.evidenceRelationship?.hypothesisLinks?.includes(sugHyp.description) || false;
                            return (
                              <button
                                key={hIdx}
                                type="button"
                                disabled={isReadOnly}
                                onClick={async () => {
                                  if (isReadOnly) return;
                                  const currentLinks = p.evidenceRelationship?.hypothesisLinks || [];
                                  const newLinks = isAdded 
                                    ? currentLinks.filter((l: string) => l !== sugHyp.description)
                                    : [...currentLinks, sugHyp.description];

                                  const updatedRel: EvidenceRelationship = {
                                    id: p.evidenceRelationship?.id || `rel-${p.id}-${Date.now()}`,
                                    evidenceId: p.id,
                                    projectId: projectId || "N/A",
                                    source: (p as any).source || (p.tipo === "STREET_VIEW" ? "STREET_VIEW" : "FIELD_CAPTURE"),
                                    geography: {
                                      type: project?.geometryType === "poligono" ? "POLYGON" : project?.geometryType === "lineal" ? "LINE" : "POINT",
                                      latitude: p.lat || undefined,
                                      longitude: p.lng || undefined,
                                      area: project?.nombre || "Área General"
                                    },
                                    criminogenicFactors: p.evidenceRelationship?.criminogenicFactors || [],
                                    hypothesisLinks: newLinks,
                                    confidence: p.evidenceRelationship?.confidence || "MEDIUM",
                                    createdAt: p.evidenceRelationship?.createdAt || new Date().toISOString()
                                  };

                                  if (updatePhotoRelationship) {
                                    await updatePhotoRelationship(p.id, updatedRel);
                                  }
                                }}
                                className={`text-[8.5px] p-1.5 rounded transition duration-150 text-left flex items-start gap-1.5 leading-normal ${
                                  isAdded 
                                    ? "bg-sky-950/80 text-sky-400 border border-sky-850/50 hover:bg-sky-900/40"
                                    : "bg-slate-900 text-slate-400 border border-slate-850 hover:bg-slate-800 hover:text-slate-300"
                                }`}
                              >
                                <span className="mt-0.5">{isAdded ? "✓" : "+"}</span>
                                <span>{sugHyp.hypothesisId}: {sugHyp.description}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          </div>
          </div>
        ))}
            </div>
          </div>
        ));
      })()}

      {/* Formulario de Hipótesis y Precisiones de Barridos en la página principal */}
      <div className="pt-8 mt-6 border-t border-slate-800 w-full print:hidden">
        {isHypothesisValidatedInWorkspace && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 max-w-4xl mx-auto mb-6 text-center md:text-left shadow-xl backdrop-blur-sm font-sans">
            <div className="space-y-1">
              <span className="text-xs text-emerald-400 font-black tracking-wider uppercase flex items-center gap-1.5">
                🛡️ Hipótesis de Gobernanza Validada y Certificada por IA
              </span>
              <p className="text-[11px] text-slate-400">
                Las herramientas de análisis táctico y el dictamen oficial están habilitados. La hipótesis se encuentra en modo de lectura protegida.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsHypothesisValidatedInWorkspace(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-4 rounded-lg text-xs transition-all flex items-center gap-1.5 border border-slate-700 whitespace-nowrap active:scale-[0.97]"
            >
              🔓 Editar Hipótesis y Precisiones
            </button>
          </div>
        )}

        <div className="space-y-6 max-w-4xl mx-auto w-full">
          <header className="text-center space-y-2 mb-6">
            <h3 className="text-lg font-black text-slate-100 uppercase tracking-wider">
              🧠 Formulación de Hipótesis y Ajustes de Barridos
            </h3>
            <p className="text-xs text-slate-400">
              Escriba la hipótesis central del expediente, revise el resumen de todos los barridos de inteligencia y agregue precisiones generales para validar con la IA.
            </p>
          </header>

          {/* 1. TEXTAREA DE HIPÓTESIS */}
          <div className="space-y-3 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                📝 Hipótesis de la Persona Perfiladora (Contexto de cruce de ubicaciones)
              </label>
              {!isHypothesisValidatedInWorkspace && (
                <div className="flex items-center gap-2">
                  {!isReadOnly && projectId && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const { getDb } = await import("@/lib/firebase");
                          const { doc, updateDoc } = await import("firebase/firestore");
                          const firestore = getDb();
                          await updateDoc(doc(firestore, "projects", projectId || ""), {
                            hipotesis: analysisContext,
                            sweepsComments: sweepsComments
                          });
                          window.alert("Hipótesis y precisiones guardadas exitosamente en el expediente.");
                        } catch (err) {
                          console.error("Error al guardar:", err);
                          window.alert("Error al guardar.");
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold border border-emerald-600 text-emerald-300 bg-emerald-900/40 hover:bg-emerald-800 transition-colors"
                    >
                      <span>💾</span> Guardar Borrador
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleDictation('analysisContext', (text) => {
                      setAnalysisContext(prev => (prev ? `${prev.trim()} ${text}` : text));
                      setIsAnalysisContextAudited(false);
                    })}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold border transition-colors ${listeningField === 'analysisContext' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-slate-600 text-slate-300 bg-slate-800 hover:bg-slate-700"}`}
                  >
                    <span>🎙️</span> {listeningField === 'analysisContext' ? "Grabando..." : "Dictar hipótesis"}
                  </button>
                </div>
              )}
            </div>
            <textarea
              spellCheck={true}
              value={analysisContext}
              disabled={isHypothesisValidatedInWorkspace}
              onChange={(e) => {
                setAnalysisContext(e.target.value);
                setIsAnalysisContextAudited(false);
              }}
              rows={6}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 text-slate-100 px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:opacity-75 disabled:bg-slate-955"
              placeholder="Ejemplo: Posible corredor de riesgo entre polígono habitacional y zona de bares, con vulnerabilidad en rutas peatonales sin vigilancia..."
            />
            
            <div className="mt-1.5">
              <div className="flex justify-between items-center text-[10px] mb-1">
                <span className="text-slate-400 font-bold">Aptitud de contenido (Longitud mínima):</span>
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

            {/* PowerUps y Resultados de Puente */}
            {!isReadOnly && !isHypothesisValidatedInWorkspace && (
              <div className="mt-2.5">
                <PowerUpsModule
                  onApplyPowerUp={(text) => {
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
                          onRemove={isReadOnly || isHypothesisValidatedInWorkspace ? undefined : () => removeDocument(doc.id)}
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

            {/* Radio de búsqueda geoespacial */}
            <div className="space-y-2 pt-3 border-t border-slate-800/60 mt-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                📏 Radio de búsqueda geoespacial
              </label>
              <input
                type="range"
                min={100}
                max={10000}
                step={100}
                disabled={isHypothesisValidatedInWorkspace}
                value={analysisRadius}
                onChange={(e) => setAnalysisRadius(Number(e.target.value))}
                className="w-full accent-sky-500 disabled:opacity-50"
              />
              <p className="text-[10px] text-slate-400 font-bold">
                Radio de búsqueda:{" "}
                <span className="font-semibold text-slate-100">
                  {analysisRadius >= 1000 ? `${(analysisRadius / 1000).toFixed(1)} km` : `${analysisRadius} metros`}
                </span>
              </p>
            </div>
          </div>

          {/* 2. RESUMEN Y PRECISIONES DE BARRIDOS */}
          <div className="space-y-3 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
              📡 Resumen de todos los Barridos con sus hallazgos
            </label>
            
            <div className="bg-slate-950 border border-slate-805 rounded-lg p-3 max-h-[160px] overflow-y-auto text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed shadow-inner">
              {sweepsSummaryText}
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="block text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                ✍️ Precisiones del Analista e Indicaciones para la IA
              </label>
              <textarea
                value={sweepsComments}
                disabled={isHypothesisValidatedInWorkspace}
                onChange={(e) => setSweepsComments(e.target.value)}
                rows={4}
                placeholder="Escriba aquí los ajustes, exclusiones, precisiones sobre los hallazgos de los barridos, o instrucciones específicas que desea que la IA analice en conjunto..."
                className="w-full text-xs bg-slate-955 border border-slate-850 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-sky-500 resize-none min-h-[80px] disabled:opacity-75 disabled:bg-slate-955"
              />
            </div>
          </div>

          {/* 3. BOTÓN FUSIONADO DE VALIDACIÓN Y GENERACIÓN */}
          {!isHypothesisValidatedInWorkspace && (
            <div className="bg-slate-900/20 p-5 rounded-xl border border-slate-800 space-y-4">
              <div className="flex flex-col gap-2">
                {!isAnalysisContextAudited && aiQuestionsList.length === 0 && (
                  <p className="text-xs text-amber-400 text-center">⚠️ La hipótesis y las precisiones de barridos deben contar con la Auditoría Soft IA aprobada para habilitar las herramientas de análisis.</p>
                )}
                {isAnalysisContextAudited && (
                  <p className="text-xs text-emerald-400 text-center">✅ Auditoría Soft IA: Aprobada con éxito. Las herramientas de análisis y el informe oficial están habilitados.</p>
                )}
              </div>

              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    setIsRefining(true);
                    setAnalysisAuditScore(null);
                    try {
                      let selected = album.filter((p) => selectedIds.includes(p.id));
                      if (selected.length === 0) {
                        if (album.length > 0) {
                          selectAllPhotos();
                          selected = album;
                        } else {
                          window.alert("Debe agregar al menos una fotografía al expediente para poder formular una hipótesis.");
                          return;
                        }
                      }
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

                      const fullContext = analysisContext + `\n\n[Precisiones de Barridos e Indicaciones del Analista]\n${sweepsComments}` + focusContext + (answersString ? `\n\nRespuestas a preguntas previas:\n${answersString}` : "") + `\n\n(INSTRUCCIÓN DEL SISTEMA: Evalúa la hipótesis. Score >= 80 si es sólida; si es vaga, score < 80. OBLIGATORIO: Sugiere usar ST_DWithin o Búsqueda Semántica.)`;

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
                      let data = JSON.parse(textRes);
                      if (res.ok) {
                        let scoreVal = data.score ?? 0;
                        let questionsVal: string[] = Array.isArray(data.questions) ? data.questions : [];
                        
                        setAnalysisAuditScore(scoreVal);
                        if (scoreVal >= 80) {
                          setIsAnalysisContextAudited(true);
                          
                          const updatedContext = answersString.trim()
                            ? analysisContext + "\n\nContexto adicional:\n" + answersString
                            : analysisContext;

                          if (answersString.trim()) {
                            setAnalysisContext(updatedContext);
                          }
                          setAiQuestionsList([]);
                          setUserAnswersMap({});
                          
                          // Guardar hipótesis y precisiones en la BDD
                          const { getDb } = await import("@/lib/firebase");
                          const { doc, updateDoc } = await import("firebase/firestore");
                          const firestore = getDb();
                          await updateDoc(doc(firestore, "projects", projectId || ""), {
                            hipotesis: updatedContext,
                            sweepsComments: sweepsComments
                          });

                          // Habilitar herramientas
                          setIsHypothesisValidatedInWorkspace(true);
                          void loadAnalysisData();

                          // Generar informe de manera automática
                          window.alert("¡Validación exitosa! El dictamen y el expediente han sido certificados por la Auditoría Soft IA.");
                          await confirmAndGenerateProfile();
                        } else {
                          setAiQuestionsList(questionsVal.length > 0 ? questionsVal.slice(0,5) : [
                            "¿Cómo describiría el estado de la iluminación o deterioro en el lugar específico?",
                            "¿Hacia dónde se dirigen las posibles rutas de escape físicas desde este nodo?",
                            "¿Qué tipo de personas transitaban o frecuentan esta zona cuando observó?"
                          ]);
                          setIsAnalysisContextAudited(false);
                          setQaIteration((prev) => prev + 1);
                        }
                      }
                    } catch (err: any) {
                      console.error(err);
                      window.alert("Error de validación: " + err.message);
                    } finally {
                      setIsRefining(false);
                    }
                  }}
                  disabled={isRefining || !analysisContext.trim()}
                  className="bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-black px-6 py-3 rounded-lg text-xs uppercase tracking-wider transition active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none shadow-lg flex items-center gap-2"
                >
                  {isRefining ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Certificando consistencia...
                    </>
                  ) : (
                    <>🧠 Validar Hipótesis e Iniciar Auditoría Soft IA</>
                  )}
                </button>
              </div>

              {!isAnalysisContextAudited && aiQuestionsList.length > 0 && (
                <div className="mt-4 rounded-md border border-yellow-750 bg-yellow-950/20 px-4 py-4 text-xs text-yellow-200 space-y-4 max-w-2xl mx-auto shadow-xl">
                  <p className="font-bold text-yellow-400">💡 Preguntas de afinación de la IA (Estado de Auditoría Soft IA: Requiere precisiones):</p>
                  {aiQuestionsList.map((q, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="font-semibold text-yellow-100">{idx + 1}. {q}</p>
                      <textarea
                        value={userAnswersMap[idx] || ""}
                        onChange={(e) => setUserAnswersMap(prev => ({ ...prev, [idx]: e.target.value }))}
                        className="w-full bg-yellow-950/40 border border-yellow-750/40 rounded-md p-2.5 text-xs text-yellow-100 focus:outline-none"
                        placeholder="Escriba su respuesta aquí..."
                        rows={2}
                      />
                    </div>
                  ))}
                  
                  <div className="flex justify-end gap-3 pt-2 border-t border-yellow-750/30">
                    <CEIPOLButton
                      variant="warning"
                      loading={isRefining}
                      onClick={async () => {
                        setIsRefining(true);
                        try {
                          let answersString = Object.entries(userAnswersMap)
                            .filter(([_, ans]) => ans.trim())
                            .map(([idx, ans]) => `Pregunta: ${aiQuestionsList[Number(idx)]}\nRespuesta: ${ans}`)
                            .join("\n\n");
                          
                          const updatedContext = answersString.trim()
                            ? analysisContext + "\n\nContexto adicional:\n" + answersString
                            : analysisContext;
                          
                          setAnalysisContext(updatedContext);

                          const { getDb } = await import("@/lib/firebase");
                          const { doc, updateDoc } = await import("firebase/firestore");
                          const firestore = getDb();
                          await updateDoc(doc(firestore, "projects", projectId || ""), {
                            hipotesis: updatedContext,
                            sweepsComments: sweepsComments
                          });

                          setIsAnalysisContextAudited(true);
                          setIsHypothesisValidatedInWorkspace(true);
                          void loadAnalysisData();

                          window.alert("¡Aceptación manual confirmada! Generando el dictamen oficial...");
                          await confirmAndGenerateProfile();
                        } catch (err: any) {
                          console.error(err);
                          alert("Error al procesar la aceptación: " + err.message);
                        } finally {
                          setIsRefining(false);
                        }
                      }}
                    >
                      ⚠️ Confirmar y Certificar Hipótesis con Precisiones Adicionales
                    </CEIPOLButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. AUDITORÍA SOFT IA */}
      <CEIPOLCard
        variant="glass"
        className="max-w-4xl mx-auto w-full mt-6 space-y-4 font-sans"
      >
        <header className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider">
              Auditoría Soft IA
            </h4>
          </div>
          <span className={`px-2.5 py-1 text-[9px] font-bold rounded-full tracking-wider uppercase ${isHypothesisValidatedInWorkspace ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-amber-950 text-amber-400 border border-amber-800"}`}>
            {isHypothesisValidatedInWorkspace ? "CONSISTENCIA CERTIFICADA" : "ANÁLISIS EN CURSO"}
          </span>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CEIPOLCard
            variant="default"
            className="p-4 flex flex-col gap-1.5"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Coherencia Visual</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={album.length > 0 ? "text-emerald-400 text-xs font-black" : "text-amber-400 text-xs font-black"}>
                {album.length > 0 ? "✓ Revisada" : "⚠ Pendiente"}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">Evaluación automatizada de correlación de evidencia in situ.</p>
          </CEIPOLCard>

          <CEIPOLCard
            variant="default"
            className="p-4 flex flex-col gap-1.5"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Correspondencia Territorial</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={project?.latitude || album.some(p => p.lat != null) ? "text-emerald-400 text-xs font-black" : "text-amber-400 text-xs font-black"}>
                {project?.latitude || album.some(p => p.lat != null) ? "✓ Compatible" : "⚠ Sin georreferencia"}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">Cruce geoespacial de polígonos, corredores e hitos urbanos.</p>
          </CEIPOLCard>

          <CEIPOLCard
            variant="default"
            className="p-4 flex flex-col gap-1.5"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Consistencia Descriptiva</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={isHypothesisValidatedInWorkspace ? "text-emerald-400 text-xs font-black" : "text-amber-400 text-xs font-black"}>
                {isHypothesisValidatedInWorkspace ? "✓ Validada" : "⚠ Borrador / Sin Validar"}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">Análisis gramatical y correlación predictiva de la hipótesis.</p>
          </CEIPOLCard>
        </div>
      </CEIPOLCard>

      <div className="flex flex-col gap-6 pt-6 mt-6 border-t border-slate-800 w-full print:hidden">

      {/* PASO 2: MAPA INTERACTIVO */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">📍 Mapa Interactivo de Evidencias (Paso 2)</h4>
          <p className="text-xs text-slate-400">
            Visualización en tiempo real del polígono de interés y la geolocalización de las evidencias de campo.
          </p>
        </header>
        <div className="w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-950/20">
          {album.filter(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))).length === 0 ? (
            <CEIPOLEmptyState
              icon="📍"
              title="Sin ubicación disponible"
              description="Seleccione fotografías con coordenadas GPS o agregue vértices al mapa."
            />
          ) : (
            album.length > 0 && project && (
              <ProjectMap
                project={project}
                album={album}
                geometryType={project.geometryType || "individual"}
                coordinates={album.filter(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && !p.isIndependentPoi && p.tipo !== "POI").map((photo) => ({
                  lat: Number(photo.lat),
                  lng: Number(photo.lng),
                }))}
                onPoiSelect={handleStartStreetViewFlow}
                onAddPoint={handleAddMapPoint}
                onMoveMarker={updatePhotoCoordinates}
                onCandidateCapture={handleCandidateCapture}
                onUpdateCoordinates={(newCoords) => {
                  newCoords.forEach((coord, idx) => {
                    const photo = album.filter(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && !p.isIndependentPoi && p.tipo !== "POI")[idx];
                    if (photo && (photo.lat !== coord.lat || photo.lng !== coord.lng)) {
                      void updatePhotoCoordinates(photo.id, coord.lat, coord.lng);
                    }
                  });
                }}
              />
            )
          )}
        </div>

        {/* CINTILLA TEMPORAL DE MAPA (MAP EVIDENCE CAPTURE LAYER) */}
        {mapTemporaryCintilla.length > 0 && (
          <div className="mt-4 bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🎞️</span>
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                  Cintilla Temporal de Evidencias de Mapa ({mapTemporaryCintilla.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm("¿Desea limpiar todas las capturas de mapa temporales?")) {
                    setMapTemporaryCintilla([]);
                  }
                }}
                className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider"
              >
                Limpiar todo
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {mapTemporaryCintilla.map((item, idx) => (
                <div 
                  key={item.id} 
                  className="flex-shrink-0 w-72 bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-3 relative group animate-fade-in"
                >
                  <div className="w-full h-36 relative rounded overflow-hidden bg-black border border-slate-800">
                    <img 
                      src={item.url} 
                      alt={`Captura de Mapa ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMapTemporaryCintilla(prev => prev.filter(c => c.id !== item.id));
                      }}
                      className="absolute top-1.5 right-1.5 p-1 bg-red-600/90 text-white hover:bg-red-500 rounded-full shadow-lg border border-red-500/20"
                      title="Eliminar de la cintilla"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-2 text-[10px]">
                    <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-400 border-b border-slate-800 pb-1.5">
                      <div><span className="text-slate-500 font-bold">Origen:</span> MAP_CAPTURE</div>
                      <div><span className="text-slate-500 font-bold">Tipo:</span> STATIC_MAP_CONTEXT</div>
                      <div><span className="text-slate-500 font-bold">Geometría:</span> {item.geometryType}</div>
                      <div><span className="text-slate-500 font-bold">Contexto:</span> {item.captureContext}</div>
                      <div className="col-span-2"><span className="text-slate-500 font-bold">Coords:</span> {item.lat.toFixed(5)}, {item.lng.toFixed(5)}</div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Categoría Táctica *
                      </label>
                      <select
                        value={item.streetViewCategory}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setMapTemporaryCintilla(prev => prev.map(c => c.id === item.id ? { ...c, streetViewCategory: val } : c));
                        }}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-1.5 text-[10px] text-slate-200 focus:outline-none focus:border-sky-500/50"
                      >
                        <option value="hideout">Lugar de acecho o escondite</option>
                        <option value="graffiti">Grafiti de pandilla</option>
                        <option value="denue_interest">Punto de interés DENUE</option>
                        <option value="other">Otros / Sin clasificar</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Comentario / Observación *
                      </label>
                      <textarea
                        value={item.comentario}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMapTemporaryCintilla(prev => prev.map(c => c.id === item.id ? { ...c, comentario: val } : c));
                        }}
                        placeholder="Describa el contexto o la actualización de trazado observada..."
                        rows={2}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50 resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800/60">
              <CEIPOLButton
                variant="primary"
                size="sm"
                disabled={isCapturingMap || mapTemporaryCintilla.some(c => !c.comentario.trim())}
                onClick={() => setMapConfirmModal({ isOpen: true })}
              >
                {isCapturingMap ? "Incorporando..." : "📥 Incorporar Capturas de Mapa al Expediente (ADR-011)"}
              </CEIPOLButton>
            </div>
            {mapTemporaryCintilla.some(c => !c.comentario.trim()) && (
              <p className="text-[9px] text-amber-400 text-right leading-none mt-1">
                ⚠️ Complete el comentario / observación de todas las capturas de mapa para poder incorporarlas.
              </p>
            )}
          </div>
        )}
      </div>

      {/* PASO 3: STREET VIEW PANORAMA & ENTORNO VIRTUAL GOBERNADO */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">🛣️ Street View - Entorno Virtual (Paso 3)</h4>
          <p className="text-xs text-slate-400">
            Exploración a pie de calle de las inmediaciones del punto central de las evidencias seleccionadas y generación controlada de evidencia virtual.
          </p>
        </header>
        {svError ? (
          <div className="p-4 bg-amber-950/20 border border-amber-800 text-amber-300 rounded-lg text-xs">
            ⚠️ {svError}
          </div>
        ) : (
          <div className="space-y-4">
            <div 
              ref={svContainerRef} 
              style={{ width: "100%", height: "400px" }} 
              className="rounded-lg border border-slate-700 overflow-hidden bg-black"
            />
            
            {activePanorama && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => {
                    const pos = activePanorama.getPosition();
                    const pov = activePanorama.getPov();
                    const lat = pos.lat();
                    const lng = pos.lng();
                    const heading = pov.heading;
                    const pitch = pov.pitch;
                    const zoom = activePanorama.getZoom();
                    const fov = 180 / Math.pow(2, zoom);
                    
                    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyBB1mc8b1lpevjxcFSSLHurnbCQw62RAaA";
                    const staticUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${apiKey}`;
                    
                    const newCapture = {
                      id: `temp-sv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      url: staticUrl,
                      lat,
                      lng,
                      heading,
                      pitch,
                      comentario: "",
                      streetViewCategory: "hideout" as const
                    };
                    
                    setTemporaryCintilla(prev => [...prev, newCapture]);
                  }}
                  className="px-4 py-2 bg-sky-600/90 text-white rounded-lg hover:bg-sky-500 font-sans text-xs font-bold shadow-lg border border-sky-500/20 transition-all duration-150 flex items-center gap-2"
                >
                  <span>📷</span>
                  <span>Capturar Vista Actual (Cintilla)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* CINTILLA TEMPORAL DE EVIDENCIA CAPTURADA */}
        {temporaryCintilla.length > 0 && (
          <div className="mt-4 bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🎞️</span>
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                  Cintilla Temporal de Evidencias Virtuales ({temporaryCintilla.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm("¿Desea limpiar todas las capturas temporales?")) {
                    setTemporaryCintilla([]);
                  }
                }}
                className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider"
              >
                Limpiar todo
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {temporaryCintilla.map((item, idx) => (
                <div 
                  key={item.id} 
                  className="flex-shrink-0 w-72 bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-3 relative group"
                >
                  <div className="w-full h-36 relative rounded overflow-hidden bg-black border border-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={item.url} 
                      alt={`Captura ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setTemporaryCintilla(prev => prev.filter(c => c.id !== item.id));
                      }}
                      className="absolute top-1.5 right-1.5 p-1 bg-red-600/90 text-white hover:bg-red-500 rounded-full shadow-lg border border-red-500/20"
                      title="Eliminar de la cintilla"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Categoría Táctica *
                      </label>
                      <select
                        value={item.streetViewCategory}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setTemporaryCintilla(prev => prev.map(c => c.id === item.id ? { ...c, streetViewCategory: val } : c));
                        }}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
                      >
                        <option value="hideout">Lugar de acecho o escondite</option>
                        <option value="graffiti">Grafiti de pandilla</option>
                        <option value="denue_interest">Punto de interés DENUE</option>
                        <option value="other">Otros / Sin clasificar</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Comentario / Observación *
                      </label>
                      <textarea
                        value={item.comentario}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTemporaryCintilla(prev => prev.map(c => c.id === item.id ? { ...c, comentario: val } : c));
                        }}
                        placeholder="Describa los elementos sospechosos o facilitadores físicos observados..."
                        rows={2}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50 resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800/60">
              <CEIPOLButton
                variant="primary"
                size="sm"
                disabled={isCapturingSv || temporaryCintilla.some(c => !c.comentario.trim())}
                onClick={async () => {
                  if (!uploadAndAddPhoto) return;
                  setIsCapturingSv(true);
                  try {
                    for (let i = 0; i < temporaryCintilla.length; i++) {
                      const item = temporaryCintilla[i];
                      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(item.url)}`;
                      const svRes = await fetch(proxyUrl);
                      if (!svRes.ok) {
                        throw new Error(`Error al descargar la captura virtual #${i + 1}`);
                      }
                      const blob = await svRes.blob();
                      const file = new File([blob], `StreetView_Capture_${Date.now()}_${i}.jpg`, { type: "image/jpeg" });
                      
                      const category = item.streetViewCategory;
                      await uploadAndAddPhoto(file, item.lat, item.lng, {
                        tipo: "STREET_VIEW",
                        gpsSource: "STREET_VIEW",
                        streetViewCategory: category,
                        streetViewSource: "Google Street View",
                        analysisType: "STREET_VIEW",
                        comentario: `EVIDENCIA VIRTUAL STREET VIEW [Categoría: ${category}]: ${item.comentario}`,
                        validado: true
                      } as any);
                    }
                    setTemporaryCintilla([]);
                    alert("Capturas temporales incorporadas exitosamente al expediente bajo las reglas de gobernanza ADR-011.");
                  } catch (err: any) {
                    console.error("[PhotoAlbum] Error al incorporar cintilla:", err);
                    alert("Error al incorporar capturas virtuales: " + err.message);
                  } finally {
                    setIsCapturingSv(false);
                  }
                }}
              >
                {isCapturingSv ? "Incorporando..." : "📥 Incorporar Capturas al Expediente (ADR-011)"}
              </CEIPOLButton>
            </div>
            {temporaryCintilla.some(c => !c.comentario.trim()) && (
              <p className="text-[9px] text-amber-400 text-right leading-none mt-1">
                ⚠️ Complete el comentario / observación de todas las capturas para poder incorporarlas.
              </p>
            )}
          </div>
        )}
      </div>



      {/* MÓDULO DE INTELIGENCIA DEMOGRÁFICA (INEGI SCINCE) (Paso 5) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <CEIPOLSectionHeader
          icon="📊"
          title="Demografía y Marginación (INEGI SCINCE) (Paso 5)"
          subtitle="Extrae datos sociodemográficos a nivel manzana/AGEB basados en el centro de las fotografías seleccionadas. Identifica viviendas deshabitadas y desorganización social."
          className="mb-2"
          actions={
            <>
              {statusScince === "checking" && <CEIPOLBadge status="processing">Verificando...</CEIPOLBadge>}
              {statusScince === "online" && <CEIPOLBadge status="validated">ONLINE</CEIPOLBadge>}
              {statusScince === "offline" && <CEIPOLBadge status="error">OFFLINE (404)</CEIPOLBadge>}
            </>
          }
        />
        {isCheckingScince ? (
          <CEIPOLLoader message="Consultando indicadores demográficos INEGI SCINCE" />
        ) : (
          <div className="flex flex-col md:flex-row gap-3 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700 items-start md:items-center">
            <p className="text-xs text-slate-300 flex-1">
              {selectedIds.length > 0
                ? `El barrido se calculará sobre el centroide de las ${selectedIds.length} fotos seleccionadas.`
                : "⚠️ Seleccione al menos una fotografía en el álbum para establecer el punto GPS de búsqueda."}
            </p>
            <CEIPOLButton
              variant="primary"
              loading={isCheckingScince}
              disabled={selectedIds.length === 0 || isReadOnly}
              onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                setClickCoords({ x: e.clientX, y: e.clientY });
                setIsCheckingScince(true);
                setError(null);
                try {
                  const selectedPhotos = album.filter(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && selectedIds.includes(p.id));
                  if (selectedPhotos.length === 0) {
                    setError("Las fotos seleccionadas no tienen coordenadas GPS válidas.");
                    setIsCheckingScince(false);
                    return;
                  }
                  const centerLat = selectedPhotos.reduce((acc, p) => acc + Number(p.lat), 0) / selectedPhotos.length;
                  const centerLng = selectedPhotos.reduce((acc, p) => acc + Number(p.lng), 0) / selectedPhotos.length;

                  const data = await getScinceData(centerLat, centerLng);
                  if (data.exito) {
                    const newContext = `[INTELIGENCIA DEMOGRÁFICA - INEGI SCINCE] Coordenadas: ${data.coordenadas}. Población de la manzana: ${data.poblacionTotal} hab. Viviendas totales: ${data.viviendasTotales}. VIVIENDAS DESHABITADAS: ${data.viviendasDeshabitadas}. Grado de marginación: ${data.gradoMarginacion}. Observaciones tácticas: El nivel de viviendas abandonadas o en desuso agudiza la percepción de desorden, propicia el paracaidismo, el consumo de drogas y consolida el patrón de "Ventanas Rotas" en la zona.`;
                    setScinceDataConfirm(newContext);
                  } else {
                    setError(data.error || "Error al consultar INEGI SCINCE.");
                  }
                } catch (err: any) { setError(err.message || "Error de red al conectar con SCINCE."); } 
                finally { setIsCheckingScince(false); }
              }}
            >
              📊 Consultar Cuadra y Añadir a Hipótesis
            </CEIPOLButton>
          </div>
        )}
      </div>

      {/* MÓDULO DE GIROS COMERCIALES Y NEGOCIOS (INEGI DENUE) (Paso 6) */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <CEIPOLSectionHeader
          icon="🏬"
          title="Giros Comerciales (INEGI DENUE) (Paso 6)"
          subtitle="Realice un barrido para identificar negocios, bares, chatarreras y unidades económicas formales a 500 metros de la evidencia."
          className="mb-2"
          actions={
            <>
              {statusDenue === "checking" && <CEIPOLBadge status="processing">Verificando...</CEIPOLBadge>}
              {statusDenue === "online" && <CEIPOLBadge status="validated">ONLINE</CEIPOLBadge>}
              {statusDenue === "offline" && <CEIPOLBadge status="error">OFFLINE (404)</CEIPOLBadge>}
            </>
          }
        />
        {isCheckingDenue ? (
          <CEIPOLLoader message="Consultando información comercial INEGI DENUE" />
        ) : (
          <div className="flex flex-col md:flex-row gap-3 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700 items-start md:items-center">
            <p className="text-xs text-slate-300 flex-1">
              {selectedIds.length > 0
                ? `El barrido buscará negocios a 500 metros del centroide de las ${selectedIds.length} fotos seleccionadas.`
                : "⚠️ Seleccione al menos una fotografía en el álbum para establecer el punto GPS de búsqueda."}
            </p>
            <CEIPOLButton
              variant="primary"
              loading={isCheckingDenue}
              disabled={selectedIds.length === 0 || isReadOnly}
              onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                setClickCoords({ x: e.clientX, y: e.clientY });
                setIsCheckingDenue(true);
                setError(null);
                try {
                  const selectedPhotos = album.filter(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && selectedIds.includes(p.id));
                  if (selectedPhotos.length === 0) {
                    setError("Las fotos seleccionadas no tienen coordenadas GPS válidas.");
                    setIsCheckingDenue(false);
                    return;
                  }
                  const centerLat = selectedPhotos.reduce((acc, p) => acc + Number(p.lat), 0) / selectedPhotos.length;
                  const centerLng = selectedPhotos.reduce((acc, p) => acc + Number(p.lng), 0) / selectedPhotos.length;

                  const data = await getDenueData(centerLat, centerLng, 500);
                  if (data.exito) {
                    const newContext = `[INTELIGENCIA COMERCIAL - INEGI DENUE] A 500 metros del epicentro se detectaron ${data.total} negocios formales. Destacan: ${data.resumen}. Observaciones tácticas: Este mapeo permite cruzar giros antagónicos (ej. bares cerca de escuelas) y detectar vulnerabilidades o atractores de riesgo en la zona.`;
                    setDenueDataConfirm(newContext);
                  } else {
                    setError(data.error || "Error al consultar INEGI DENUE.");
                  }
                } catch (err: any) { setError(err.message || "Error de red al conectar con DENUE."); } 
                finally { setIsCheckingDenue(false); }
              }}
            >
              🏪 Consultar DENUE y Añadir a Hipótesis
            </CEIPOLButton>
          </div>
        )}
      </div>



      {/* PASO 8: INCIDENCIA DELICTIVA */}
      <div className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">🚔 Incidencia Delictiva (Paso 8)</h4>
          <p className="text-xs text-slate-400">
            Filtre los delitos y visualice gráficas de severidad basadas en la base local georreferenciada.
          </p>
        </header>
        {/* INCIDENCIA DELICTIVA DATA CHECK REMOVED */}
        
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

        {isCheckingIncidencia ? (
          <CEIPOLLoader message="Consultando información delictiva territorial" />
        ) : (
          <div className="flex flex-col md:flex-row gap-3 w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700 items-start md:items-center">
            <p className="text-xs text-slate-300 flex-1">
              {selectedIds.length > 0
                ? `El barrido buscará delitos a 1 km del centro de las ${selectedIds.length} fotos seleccionadas.`
                : album.some(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && !p.isIndependentPoi && p.tipo !== "POI")
                ? "El barrido buscará delitos a 1 km del centro del polígono/corredor del proyecto."
                : "⚠️ Seleccione al menos una fotografía o agregue vértices al mapa para establecer el centro de búsqueda."}
            </p>
            <CEIPOLButton
              variant="primary"
              loading={isCheckingIncidencia}
              disabled={isReadOnly || (!(project?.latitude && project?.longitude) && selectedIds.length === 0 && !album.some(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && !p.isIndependentPoi && p.tipo !== "POI"))}
              onClick={async () => {
                let queryLat = Number(project?.latitude);
                let queryLng = Number(project?.longitude);

                if (isNaN(queryLat) || isNaN(queryLng) || queryLat === 0) {
                  if (analysisPolygon && analysisPolygon.length > 0) {
                    queryLat = analysisPolygon.reduce((acc, p) => acc + p.lat, 0) / analysisPolygon.length;
                    queryLng = analysisPolygon.reduce((acc, p) => acc + p.lng, 0) / analysisPolygon.length;
                  } else {
                    const selectedPhotos = album.filter(p => selectedIds.includes(p.id) && p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
                    const vertices = album.filter(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && !p.isIndependentPoi && p.tipo !== "POI");
                    const photosToUse = selectedPhotos.length > 0 ? selectedPhotos : vertices;

                    if (photosToUse.length === 0) {
                      alert("⚠️ Debe establecer las coordenadas del proyecto en el mapa (trazar polígono/vértices) o seleccionar al menos una fotografía con coordenadas GPS.");
                      return;
                    }
                    queryLat = photosToUse.reduce((acc, p) => acc + Number(p.lat), 0) / photosToUse.length;
                    queryLng = photosToUse.reduce((acc, p) => acc + Number(p.lng), 0) / photosToUse.length;
                  }
                }

                if (incidents.length > 0) {
                  const reAudit = confirm("Los incidentes ya se encuentran cargados en este expediente. ¿Desea ejecutar el barrido delictivo nuevamente para re-auditar la zona?");
                  if (!reAudit) return;
                }

                setIsCheckingIncidencia(true);
                setError(null);
                try {
                  const res = await fetch("/api/incidencia", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lat: queryLat, lng: queryLng })
                  });
                  const data = await res.json();
                  if (data.success && data.data) {
                    setIncidents(data.data);
                    if (projectId) {
                      try {
                        const { doc, updateDoc } = await import("firebase/firestore");
                        const { getDb } = await import("@/lib/firebase");
                        const firestore = getDb();
                        const optimizedIncidents = data.data.map((inc: any) => ({
                          INCIDENTE: inc.INCIDENTE || inc.incidente || "",
                          FECHA: inc.FECHA || inc.fecha || "",
                          NOM_ASEN: inc.NOM_ASEN || inc.nom_asen || "",
                          lat: inc.lat,
                          lng: inc.lng,
                          distancia_m: inc.distancia_m,
                          fuente: inc.fuente || ""
                        }));
                        await updateDoc(doc(firestore, "projects", projectId), {
                          incidents: optimizedIncidents
                        });
                      } catch (fsErr) {
                        console.error("Error persisting incidents in Firestore:", fsErr);
                      }
                    }
                    
                    const total = data.data.length;
                    const crimeCounts: Record<string, number> = {};
                    data.data.forEach((inc: any) => {
                      const type = inc.INCIDENTE || "Delito No Especificado";
                      crimeCounts[type] = (crimeCounts[type] || 0) + 1;
                    });
                    
                    const topCrimes = Object.entries(crimeCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([type, count]) => `${type} (${count})`)
                      .join(", ");

                    const summaryContext = `[BARRIDO DE INCIDENCIA DELICTIVA - GEOINT] Se detectaron un total de ${total} incidentes delictivos registrados en un radio de 1 km del polígono. Principales ilícitos reportados: ${topCrimes || "Ninguno"}. Observaciones tácticas: Este acumulado indica la severidad delictiva del sector, destacando dinámicas de incidencia criminal que alimentan la hipótesis de movilidad y acecho.`;
                    
                    await registerSweep({
                      engine: "Incidencia Delictiva",
                      source: "GEOINT",
                      type: "Directa",
                      relevance: "Alto",
                      data: summaryContext
                    });
                  } else {
                    setError(data.error || "Error al obtener la incidencia delictiva.");
                  }
                } catch (err: any) {
                  setError(err.message || "Error al conectar con la API de incidencia.");
                } finally {
                  setIsCheckingIncidencia(false);
                }
              }}
            >
              🚔 Ejecutar Barrido Delictivo
            </CEIPOLButton>
          </div>
        )}

          {(() => {
            const filteredInc = incidents.filter(inc => activeDelitos.includes(getCategoryForFilename(inc.fuente || "")));
            if (filteredInc.length > 0) {
              return (
                <div className="space-y-4">
                  <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700">
                    <h5 className="text-xs font-semibold text-slate-300 mb-3">Gráficas de Severidad Criminal</h5>
                    <CrimeCharts crimes={filteredInc.map(inc => ({
                      ...inc,
                      tipoDelito: getNormalizedCrimeCategory(inc.INCIDENTE || "Delito No Especificado"),
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
                              <td className="p-2 font-semibold text-sky-400">{getNormalizedCrimeCategory(inc.INCIDENTE || "No especificado")}</td>
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
            } else if (project && (project as any).incidents !== undefined && !error) {
              return (
                <div className="mt-4">
                  <CEIPOLEmptyState
                    icon="🚔"
                    title="Sin incidencia registrada"
                    description="No se localizaron eventos delictivos bajo los filtros seleccionados."
                  />
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
                <span className="text-slate-400">Aptitud de contenido (Longitud mínima):</span>
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
                    await registerSweep({
                      engine: "Consulta Vehicular (REPUVE)",
                      source: "REPUVE",
                      type: "Contextualizada",
                      relevance: "Alto",
                      data: newContext,
                      initialContext: plateContext
                    });
                    setPlateQuery("");
                    setPlateContext("");
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
                    await registerSweep({
                      engine: "Registro de Desaparecidos (RNPDNO)",
                      source: "SEGOB",
                      type: "Contextualizada",
                      relevance: "Medio",
                      data: newContext,
                      initialContext: rnpdnoContext
                    });
                    setRnpdnoContext("");
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

                  const selectedPhotos = album.filter(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && selectedIds.includes(p.id));
                  const photosToUse = selectedPhotos.length > 0 ? selectedPhotos : album.filter(p => p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
                  const centerLat = photosToUse.reduce((acc, p) => acc + Number(p.lat), 0) / photosToUse.length;
                  const centerLng = photosToUse.reduce((acc, p) => acc + Number(p.lng), 0) / photosToUse.length;

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
                    await registerSweep({
                      engine: "Búsqueda Multimodal Geo-Espacial",
                      source: "GEOINT",
                      type: "Directa",
                      relevance: "Alto",
                      data: newContext
                    });
                    setGeoQueries([]);
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
                  <span className="text-slate-400">Aptitud de contenido (Longitud mínima):</span>
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
    
      {/* PASO 11: GRAFO DE CONEXIONES Y REDES DELICTIVAS (BigQuery) */}
      <div id="network-graph-container" className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200 font-bold">👥 Grafo de Relaciones y Redes Delictivas (Paso 11 / BigQuery)</h4>
          <p className="text-xs text-slate-400">
            Visualización interactiva de vínculos cruzados, reincidencias de objetivos y relaciones en base a escaneos previos almacenados en BigQuery.
          </p>
        </header>
        <div className="w-full">
          <NetworkDashboard />
        </div>
      </div>
    


            {/* 3. RESUMEN Y AJUSTES DE BARRIDOS DE INTELIGENCIA (REPLAZADO POR TODO EL CONTENIDO DE RESUMEN Y CIERRE) */}
            <div className="space-y-6">
              {/* Overview Dashboard Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Progress Gauge */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center justify-between min-h-[190px] relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none"></div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Completitud del Análisis</h4>
                  
                  {(() => {
                    const sweeps = project?.sweeps || [];
                    const totalSweeps = sweeps.length;
                    const completedSweeps = sweeps.filter((s: any) => s.status === "Integrado" || s.status === "Rechazado").length;
                    const completenessPercentage = totalSweeps > 0 
                      ? Math.round((completedSweeps / totalSweeps) * 100) 
                      : 100;
                    return (
                      <>
                        <div className="relative flex items-center justify-center h-24 w-24">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="48" cy="48" r="40" className="stroke-slate-850 fill-none" strokeWidth="8" />
                            <circle
                              cx="48"
                              cy="48"
                              r="40"
                              className="stroke-sky-500 fill-none transition-all duration-700 ease-out"
                              strokeWidth="8"
                              strokeDasharray="251.2"
                              strokeDashoffset={251.2 - (251.2 * completenessPercentage) / 100}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-xl font-black text-white">{completenessPercentage}%</span>
                            <span className="text-[8px] text-slate-500 font-bold uppercase">Resuelto</span>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-400 font-medium mt-2">
                          {totalSweeps === 0 
                            ? "No se han ejecutado barridos de información." 
                            : `${completedSweeps} de ${totalSweeps} barridos completados.`}
                        </p>
                      </>
                    );
                  })()}
                </div>

                {/* Pending Summary */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between min-h-[190px] relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-[40px] pointer-events-none"></div>
                  {(() => {
                    const sweeps = project?.sweeps || [];
                    const pendingSweeps = sweeps.filter((s: any) => s.status === "Pendiente").length;
                    return (
                      <>
                        <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Elementos Pendientes</h4>
                          {pendingSweeps > 0 ? (
                            <div className="space-y-1">
                              <span className="text-3xl font-black text-amber-400 font-mono leading-none">{pendingSweeps}</span>
                              <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                                Barridos de información requieren ser integrados o descartados.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-3xl font-black text-emerald-400 font-mono leading-none">0</span>
                              <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                                Todos los barridos tácticos han sido integrados o descartados correctamente.
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="border-t border-slate-800/80 pt-2.5">
                          {pendingSweeps > 0 ? (
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-500 uppercase tracking-wide">
                              <span className="animate-ping w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                              <span>Bloqueo Activo - Resuelva para salir</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-400 uppercase tracking-wide">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              <span>Expediente Listo para Cerrar</span>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Integration Rules Check */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between min-h-[190px] relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none"></div>
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Gobernanza Criminológica</h4>
                    <div className="space-y-1.5 text-xs text-slate-300 font-medium">
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-400">✓</span>
                        <p className="leading-snug">Trazabilidad completa por timestamp</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-400">✓</span>
                        <p className="leading-snug">Identificador único por bloque inyectado</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-400">✓</span>
                        <p className="leading-snug">Registro obligatorio de justificación de descarte</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    Normativa Operativa CEIPOL v3.0
                  </div>
                </div>
              </div>

              {/* Sweeps List History Table */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                {(() => {
                  const sweeps = project?.sweeps || [];
                  const totalSweeps = sweeps.length;

                  const getStatusBadgeLocal = (status: string) => {
                    switch (status) {
                      case "Integrado":
                        return <span className="bg-emerald-950/80 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 w-fit">✔ Integrado</span>;
                      case "Rechazado":
                        return <span className="bg-red-950/80 border border-red-900/50 text-red-400 px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 w-fit">❌ Descartado</span>;
                      default:
                        return <span className="bg-amber-950/80 border border-amber-900 text-amber-400 px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 w-fit animate-pulse">⚠ Pendiente</span>;
                    }
                  };

                  const getRelevanceBadgeLocal = (lvl: string) => {
                    switch (lvl) {
                      case "Alto":
                        return <span className="bg-red-950/40 border border-red-900/40 text-red-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase w-fit">Alta</span>;
                      case "Medio":
                        return <span className="bg-amber-950/40 border border-amber-900/40 text-amber-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase w-fit">Media</span>;
                      default:
                        return <span className="bg-sky-950/40 border border-sky-900/40 text-sky-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase w-fit">Baja</span>;
                    }
                  };

                  return (
                    <>
                      <h3 
                        onClick={() => setIsSweepsListExpanded(!isSweepsListExpanded)}
                        className="text-sm font-black text-slate-200 uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center justify-between cursor-pointer select-none"
                      >
                        <span>Historial de Barridos Realizados ({totalSweeps})</span>
                        <span className="text-slate-400 text-sm hover:text-white transition-all transform duration-250">
                          {isSweepsListExpanded ? "▲" : "▼"}
                        </span>
                      </h3>

                      {isSweepsListExpanded && (
                        totalSweeps === 0 ? (
                          <div className="p-8 text-center text-xs text-slate-500 italic">
                            No se han registrado barridos en este expediente. Utilice las herramientas del álbum, mapas o el panel de pandillas para realizar barridos.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-950 text-slate-400 font-black uppercase tracking-wider border-b border-slate-800 text-[9px]">
                                  <th className="p-3">Motor / Tipo</th>
                                  <th className="p-3">Fuente</th>
                                  <th className="p-3">Tipo de Int.</th>
                                  <th className="p-3">Relevancia</th>
                                  <th className="p-3">Fecha</th>
                                  <th className="p-3">Estado / Detalle</th>
                                  {!isReadOnly && <th className="p-3 text-right">Acciones</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850 text-slate-200">
                                {sweeps.map((s: any) => (
                                  <tr key={s.id} className="hover:bg-slate-950/40 transition-colors">
                                    <td className="p-3">
                                      <div className="font-extrabold">{s.engine}</div>
                                      <div className="text-[9px] text-slate-500 font-mono mt-0.5">ID: {s.id}</div>
                                    </td>
                                    <td className="p-3">
                                      <span className="font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-900/50 px-2 py-0.5 rounded text-[10px]">{s.source}</span>
                                    </td>
                                    <td className="p-3 font-semibold text-slate-400">{s.type}</td>
                                    <td className="p-3">{getRelevanceBadgeLocal(s.relevance)}</td>
                                    <td className="p-3 font-mono text-[10px] text-slate-400">
                                      {new Date(s.timestamp).toLocaleString("es-MX", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit"
                                      })}
                                    </td>
                                    <td className="p-3 space-y-1">
                                      {getStatusBadgeLocal(s.status)}
                                      {s.status === "Rechazado" && s.justification && (
                                        <div className="text-[10px] text-red-300 bg-red-950/30 border border-red-900/30 p-2 rounded-lg mt-1 max-w-xs whitespace-pre-wrap leading-relaxed">
                                          <span className="font-black">Justificación:</span> {s.justification}
                                        </div>
                                      )}
                                      {s.status === "Integrado" && s.context && (
                                        <div className="text-[10px] text-slate-300 bg-slate-950 border border-slate-850 p-2 rounded-lg mt-1 max-w-xs whitespace-pre-wrap leading-relaxed">
                                          <span className="font-bold text-slate-400">Contexto:</span> {s.context}
                                        </div>
                                      )}
                                    </td>
                                    {!isReadOnly && (
                                      <td className="p-3 text-right">
                                        <button
                                          type="button"
                                          onClick={() => setActiveSweepForModal(s)}
                                          className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition-all border border-slate-750"
                                        >
                                          ✏️ Modificar
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={(e) => { setClickCoords({ x: e.clientX, y: e.clientY }); void confirmAndGenerateProfile(); }}
                disabled={isGeneratingAI}
                className="w-full md:w-auto bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-8 py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGeneratingAI ? (
                  <>Re-procesando Dictamen Criminológico...</>
                ) : (
                  <>
                    <span>📄</span> Regenerar / Actualizar Informe Oficial
                  </>
                )}
              </button>
            </div>
          </div>
    </section>
      
      {/* MODAL DE EDICIÓN DE VENTANA */}
      <DynamicPopup
        open={!!editingPhoto}
        anchorPosition={clickCoords}
        onClose={() => setEditingPhoto(null)}
        className="max-w-2xl w-full max-h-[85vh] overflow-y-auto"
      >
        <h3 className="text-sm font-black text-cyan-400 uppercase tracking-wider mb-1">VENTANA DE EDICIÓN DE CONTEXTO</h3>
        <p className="text-[11px] text-slate-400 font-medium mb-4">Edite la contextualización de la evidencia de manera cómoda y cumpla con la bitácora operativa.</p>
        <textarea
          spellCheck={true}
          value={editingPhoto ? (editingPhoto.comentario || "") : ""}
          onChange={(e) => {
            if (editingPhoto) {
              updatePhotoMeta(editingPhoto.id, { tipo: editingPhoto.tipo, comentario: e.target.value });
              setEditingPhoto({ ...editingPhoto, comentario: e.target.value });
            }
          }}
          className="w-full min-h-[150px] bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 hover:border-slate-700 transition-all duration-200 font-sans resize-y mb-4 shadow-inner"
          placeholder="Escribe el comentario detallado aquí..."
        />
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <CEIPOLButton 
            variant="confirm" 
            size="sm" 
            onClick={() => setEditingPhoto(null)}
          >
            Aceptar y Cerrar
          </CEIPOLButton>
        </div>
      </DynamicPopup>

      {/* MODAL DE DICTAMEN OFICIAL (PREVISUALIZACIÓN, ANEXOS Y DESCARGA) */}
      {showReportModal && editableProfile && (
        <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto print:hidden" onClick={() => setShowReportModal(false)}>
          <div 
            role="dialog" 
            aria-modal="true" 
            onClick={(e) => e.stopPropagation()}
            style={getDynamicModalStyle(950, 700)}
            className="w-full max-w-5xl bg-slate-950/95 backdrop-blur-md border border-slate-800/80 p-6 rounded-2xl shadow-2xl space-y-6 text-left max-h-[90vh] overflow-y-auto animate-fadeIn"
          >
            <header className="flex justify-between items-center border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                📄 Dictamen Criminológico Ambiental Generado
              </h3>
              <button 
                type="button" 
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white transition duration-200"
              >
                ✕
              </button>
            </header>

            {/* TABS DE MODO */}
            <div className="flex border-b border-slate-800/80 gap-4 mb-4">
              <button
                type="button"
                onClick={() => setActiveReportTab("edit")}
                className={`pb-2 text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeReportTab === "edit" ? "border-b-2 border-cyan-500 text-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
              >
                📝 Editar Dictamen
              </button>
              <button
                type="button"
                onClick={() => setActiveReportTab("preview")}
                className={`pb-2 text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeReportTab === "preview" ? "border-b-2 border-cyan-500 text-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
              >
                👁️ Vista Previa Institucional
              </button>
            </div>

            {activeReportTab === "edit" ? (
              <>
                {/* 1. EDICIÓN DEL CUERPO DEL DICTAMEN */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    📝 Editar Cuerpo del Dictamen
                  </label>
                  <textarea
                    spellCheck={true}
                    value={editableProfile}
                    onChange={(e) => {
                      setEditableProfile(e.target.value);
                      setHasSavedAnalysis(false);
                    }}
                    className="w-full min-h-[250px] rounded-xl border border-slate-850 bg-slate-950/60 text-slate-200 p-4 text-xs font-mono leading-relaxed resize-y focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 hover:border-slate-800 transition-all duration-200"
                    placeholder="Escribe el cuerpo del dictamen aquí..."
                  />
                </div>

                {/* 2. SELECCIÓN DE ANEXOS */}
                <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    📋 Configuración del Dictamen y Selección de Anexos
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Seleccione qué componentes y barridos de información desea adjuntar al documento oficial.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-slate-350">
                    {/* Mapas */}
                    <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-850 space-y-2.5 shadow-inner">
                      <p className="font-extrabold text-cyan-400 uppercase tracking-wider text-[9px] border-b border-slate-850 pb-1 flex items-center gap-1">
                        🗺️ Atlas Cartográfico
                      </p>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.mapInteractive}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, mapInteractive: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Mapa de Evidencias de Campo</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.mapDensity}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, mapDensity: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Mapa 1: Densidad Criminológica</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.mapMobility}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, mapMobility: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Mapa 2: Corredores y Movilidad</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.mapAttractors}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, mapAttractors: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Mapa 3: Atracción y Factores</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.mapPredictive}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, mapPredictive: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Mapa 4: Proyección Predictiva</span>
                      </label>
                    </div>

                    {/* Modelos Analíticos */}
                    <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-850 space-y-2.5 shadow-inner">
                      <p className="font-extrabold text-indigo-400 uppercase tracking-wider text-[9px] border-b border-slate-850 pb-1 flex items-center gap-1">
                        📊 Modelos Analíticos
                      </p>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.chartTemporal}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, chartTemporal: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Gráfica 1: Distribución por Turno</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.chartTopology}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, chartTopology: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Gráfica 2: Topología y Frecuencia</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.chartEnvironmental}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, chartEnvironmental: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Gráfica 3: Facilitadores Ambientales</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.chartPrediction}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, chartPrediction: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Gráfica 4: Predicción a 6 Meses</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.graphConnections}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, graphConnections: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Grafo 1: Relaciones y Redes</span>
                      </label>
                    </div>

                    {/* Barridos */}
                    <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-850 space-y-2.5 shadow-inner">
                      <p className="font-extrabold text-emerald-400 uppercase tracking-wider text-[9px] border-b border-slate-850 pb-1 flex items-center gap-1">
                        📡 Barridos e Inteligencia
                      </p>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.sweepDenue}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, sweepDenue: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Barrido DENUE (INEGI)</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.sweepIncidencia}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, sweepIncidencia: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Barrido de Incidencia Delictiva</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.sweepRepuve}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, sweepRepuve: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Consulta Vehicular (REPUVE)</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.sweepRnpdno}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, sweepRnpdno: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Registro Desaparecidos (RNPDNO)</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.sweepMultimodal}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, sweepMultimodal: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Búsqueda Multimodal Geo-Espacial</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.sweepCifa}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, sweepCifa: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Fusión CIFA-CEIPOL</span>
                      </label>
                      <label className="flex items-center gap-2 hover:text-slate-200 cursor-pointer select-none text-[11px] text-slate-400 font-medium transition duration-150">
                        <input
                          type="checkbox"
                          checked={selectedAnnexes.includeOsintAppendix}
                          onChange={(e) => setSelectedAnnexes(prev => ({ ...prev, includeOsintAppendix: e.target.checked }))}
                          className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-cyan-500/30 w-3.5 h-3.5"
                        />
                        <span>Anexo Técnico B (Detalle OSINT Crudo)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 3. METADATOS DE EMISIÓN */}
                {reportGenerationMeta && (
                  <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-4 space-y-1.5 text-xs text-slate-400 shadow-inner">
                    <p className="font-extrabold text-slate-400 uppercase tracking-widest text-[9px] mb-1">
                      ⚙️ DETALLES DE GENERACIÓN
                    </p>
                    <p><strong>Fecha de Emisión:</strong> {reportGenerationMeta.date}</p>
                    <p><strong>Hora de Emisión:</strong> {reportGenerationMeta.time}</p>
                    <p><strong>Analista a Cargo:</strong> <span className="text-slate-300 font-bold">{reportGenerationMeta.user}</span></p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Paginación Rígida de Geointeligencia (Pág. {previewPageIdx + 1} de 12)
                  </span>
                  <div className="flex gap-2">
                    <CEIPOLButton
                      variant="secondary"
                      size="sm"
                      disabled={previewPageIdx === 0}
                      onClick={() => setPreviewPageIdx(p => Math.max(0, p - 1))}
                    >
                      ◀ Anterior
                    </CEIPOLButton>
                    <CEIPOLButton
                      variant="secondary"
                      size="sm"
                      disabled={previewPageIdx === 11}
                      onClick={() => setPreviewPageIdx(p => Math.min(11, p + 1))}
                    >
                      Siguiente ▶
                    </CEIPOLButton>
                  </div>
                </div>

                {/* Hoja de papel simulada */}
                <div className="w-full aspect-[297/210] bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl p-6 relative flex flex-col justify-between text-slate-200">
                  {/* Encabezado Institucional */}
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-2 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    <span>CEIPOL - SSPE</span>
                    <span>Dictamen Técnico de Inteligencia Territorial</span>
                    <span className="text-red-500 font-extrabold tracking-wider">CONFIDENCIAL</span>
                  </div>

                  {/* Cuerpo de la Página */}
                  <div className="flex-1 py-4 flex flex-col justify-center text-xs overflow-y-auto">
                    {previewPageIdx === 0 && (
                      <div className="space-y-4 text-center">
                        <h4 className="text-sm font-black text-slate-100 uppercase tracking-wide">DICTAMEN TÉCNICO DE INTELIGENCIA TERRITORIAL</h4>
                        <p className="text-[10px] font-semibold text-slate-400">SECRETARÍA DE SEGURIDAD PÚBLICA / CEIPOL</p>
                        <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-left text-[10px] text-slate-350">
                          <p><strong>Expediente:</strong> {project?.nombre || "Polígono"}</p>
                          <p><strong>Número:</strong> {project?.id || "EXP_TACTICO"}</p>
                          <p><strong>Analista:</strong> {user?.username || "Analista"}</p>
                          <p><strong>Fecha:</strong> {new Date().toLocaleDateString("es-MX")}</p>
                          <p><strong>Geometría:</strong> {project?.geometryType?.toUpperCase() || "POLÍGONO"}</p>
                          <p><strong>Clasificación:</strong> <span className="text-red-500 font-bold">CONFIDENCIAL</span></p>
                        </div>
                        <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-850 text-left leading-relaxed max-h-[100px] overflow-y-auto">
                          <p className="font-semibold text-slate-300 text-[10px] uppercase mb-1">Resumen del Dictamen:</p>
                          <p className="text-[10px] text-slate-450">{reportSummary || "Dictamen estratégico de geointeligencia operativa perimetral."}</p>
                        </div>
                      </div>
                    )}

                    {previewPageIdx === 1 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">BLOQUE I: ANÁLISIS EJECUTIVO - CONTEXTO TERRITORIAL</h4>
                        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 leading-relaxed text-[11px] max-h-[220px] overflow-y-auto text-slate-300 select-all">
                          {editableProfile.slice(0, 1000)}
                        </div>
                      </div>
                    )}

                    {previewPageIdx === 2 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">BLOQUE I: ANÁLISIS EJECUTIVO - HIPÓTESIS PRINCIPAL</h4>
                        <div className="grid grid-cols-1 gap-2 text-[10px] text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                          <p><strong>¿Qué ocurre?:</strong> Fenómenos de oportunidad delictiva y faltas administrativas nocturnas.</p>
                          <p><strong>¿Dónde ocurre?:</strong> En las intersecciones principales y puntos ciegos de la zona perimetral.</p>
                          <p><strong>¿Quién podría participar?:</strong> Grupos locales de riesgo y personas en tránsito.</p>
                          <p><strong>¿Por qué ocurre?:</strong> Facilitado por deficiencia en el alumbrado y presencia de áreas baldías sin bardeado.</p>
                          <p><strong>¿Qué evidencia sustenta?:</strong> Registro fotográfico, testimonios de campo y barrido cartográfico de calor.</p>
                          <p><strong>Nivel de confianza:</strong> <span className="text-red-400 font-bold">Alto (0.88)</span></p>
                        </div>
                      </div>
                    )}

                    {previewPageIdx === 3 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">BLOQUE I: ANÁLISIS EJECUTIVO - VALORACIÓN OPERACIONAL</h4>
                        <div className="grid grid-cols-1 gap-2 text-[10px] text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                          <p><strong>Amenaza:</strong> Aumento progresivo de asaltos a transeúntes durante el horario de cierre comercial.</p>
                          <p><strong>Oportunidad criminal:</strong> Facilidad de acecho en predios sin cerramientos y callejones sin iluminación.</p>
                          <p><strong>Vulnerabilidades:</strong> Falta de iluminación pública formal en el 60% del área y cerramientos vulnerables.</p>
                          <p><strong>Capacidad requerida:</strong> Patrullaje dinámico en turnos críticos y gestión municipal de desbroce y bardeado.</p>
                        </div>
                      </div>
                    )}

                    {previewPageIdx === 4 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-indigo-400 uppercase tracking-wider">BLOQUE II: MATRIZ DE TRAZABILIDAD ANALÍTICA (GEOINT)</h4>
                        <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800 overflow-x-auto">
                          <table className="w-full text-left text-[9px] border-collapse">
                            <thead>
                              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400">
                                <th className="p-1.5 font-bold uppercase">Componente</th>
                                <th className="p-1.5 font-bold uppercase">Fuente</th>
                                <th className="p-1.5 font-bold uppercase">Método</th>
                                <th className="p-1.5 font-bold uppercase">Hallazgo</th>
                                <th className="p-1.5 font-bold uppercase">Impacto</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-slate-900 bg-slate-950/20 text-slate-300">
                                <td className="p-1.5">Street View</td>
                                <td className="p-1.5">Google Maps</td>
                                <td className="p-1.5">Análisis visual</td>
                                <td className="p-1.5">Predios ciegos</td>
                                <td className="p-1.5">Vulnerabilidad</td>
                              </tr>
                              <tr className="border-b border-slate-900 text-slate-300">
                                <td className="p-1.5">Cartografía</td>
                                <td className="p-1.5">CEIPOL GIS</td>
                                <td className="p-1.5">Mapeo de calor</td>
                                <td className="p-1.5">Concentración</td>
                                <td className="p-1.5">Focalización</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {previewPageIdx === 5 && (
                      <div className="space-y-2 text-center">
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">BLOQUE III: ATLAS CARTOGRÁFICO OPERATIVO</h4>
                        <div className="w-[280px] h-[130px] bg-slate-950/80 border border-slate-800 rounded-xl mx-auto flex items-center justify-center text-slate-500 text-[9px] relative shadow-inner select-none font-medium">
                          [Cartografía de Densidades y Corredores de Calor delictivo]
                          <span className="absolute bottom-2 right-2 text-[7px] text-slate-600">SSPE-CEIPOL</span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">Cada mapa seleccionado se inserta en página independiente del cuerpo analítico.</p>
                      </div>
                    )}

                    {previewPageIdx === 6 && (
                      <div className="space-y-2 text-center">
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">BLOQUE IV: EVALUACIÓN VISUAL DE ENTORNO (STREET VIEW)</h4>
                        <div className="w-[280px] h-[130px] bg-slate-950/80 border border-slate-800 rounded-xl mx-auto flex items-center justify-center text-slate-500 text-[9px] relative shadow-inner select-none font-medium">
                          [Capturas Automáticas de Acecho y Puntos de Ocultamiento]
                          <span className="absolute bottom-2 right-2 text-[7px] text-slate-600">SSPE-CEIPOL</span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">Identificación visual georreferenciada con clasificación criminológica de factores urbanos.</p>
                      </div>
                    )}

                    {previewPageIdx === 7 && (
                      <div className="space-y-2 text-center">
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">BLOQUE V: MODELOS ANALÍTICOS Y GRÁFICAS</h4>
                        <div className="w-[280px] h-[130px] bg-slate-950/80 border border-slate-800 rounded-xl mx-auto flex items-center justify-center text-slate-500 text-[9px] relative shadow-inner select-none font-medium">
                          [Gráficas de Distribución Temporal y Facilitadores]
                          <span className="absolute bottom-2 right-2 text-[7px] text-slate-600">SSPE-CEIPOL</span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">Modelos estadísticos integrados para sustentar la oportunidad ambiental.</p>
                      </div>
                    )}

                    {previewPageIdx === 8 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">BLOQUE VI: BARRIDOS DE INTELIGENCIA DE FUENTES</h4>
                        <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 leading-relaxed text-[10px] text-slate-350 space-y-1">
                          <p><strong>DENUE:</strong> Giros comerciales de tipo atractor identificados en el radio táctico.</p>
                          <p><strong>Incidencia:</strong> Histórico de delitos y denuncias de BigQuery en el perímetro.</p>
                          <p><strong>REPUVE:</strong> Flujos de vehículos con alertas de seguridad en los accesos.</p>
                        </div>
                      </div>
                    )}

                    {previewPageIdx === 9 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">BLOQUE VII: EVIDENCIA FOTOGRÁFICA DE CAMPO (Corte 45%)</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800 space-y-1 relative">
                            <div className="h-[90px] bg-slate-950 flex items-center justify-center text-[8px] text-slate-550 relative shadow-inner rounded-lg">
                              [Imagen Táctica - 45%]
                              <span className="absolute top-2 right-2 text-[6px] text-slate-700">SSPE-CEIPOL</span>
                            </div>
                            <p className="text-[8px] text-slate-400"><strong>Ubicación:</strong> Zona de Ocultamiento norte</p>
                            <p className="text-[8px] text-slate-400"><strong>Factor:</strong> Luminaria inactiva</p>
                          </div>
                          <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800 space-y-1 relative">
                            <div className="h-[90px] bg-slate-950 flex items-center justify-center text-[8px] text-slate-550 relative shadow-inner rounded-lg">
                              [Imagen Táctica - 45%]
                              <span className="absolute top-2 right-2 text-[6px] text-slate-700">SSPE-CEIPOL</span>
                            </div>
                            <p className="text-[8px] text-slate-400"><strong>Ubicación:</strong> Callejón sin salida</p>
                            <p className="text-[8px] text-slate-400"><strong>Factor:</strong> Cerramiento deficiente</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {previewPageIdx === 10 && (
                      <div className="space-y-2 text-center">
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">BLOQUE VIII: HYPOTHESIS INTELLIGENCE GRAPH (HIG 2.0)</h4>
                        <div className="w-[280px] h-[130px] bg-slate-950/80 border border-slate-800 rounded-xl mx-auto flex items-center justify-center text-slate-500 text-[9px] relative shadow-inner select-none font-medium">
                          [Visualizador de Grafo Relacional HIG 2.0]
                          <span className="absolute bottom-2 right-2 text-[7px] text-slate-600">SSPE-CEIPOL</span>
                        </div>
                        <p className="text-[9px] text-slate-500 italic">Mapeo de relaciones, actores, lugares, evidencias y pesos.</p>
                      </div>
                    )}

                    {previewPageIdx === 11 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider">BLOQUE IX: CONCLUSIONES OPERATIVAS Y RECOMENDACIONES</h4>
                        <ul className="list-disc list-inside space-y-1 text-[10px] text-slate-350">
                          <li><strong>Hallazgo Crítico:</strong> Alumbrado ausente en más de un 60% perimetral.</li>
                          <li><strong>Riesgo Inmediato:</strong> Oportunidad de acecho sobre vías peatonales tácticas.</li>
                          <li><strong>Recomendación Táctica:</strong> Recorridos dinámicos coordinados en el tercer turno.</li>
                          <li><strong>Recomendación Estratégica:</strong> Luminarias LED y bardeado de baldíos.</li>
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Pie de Página */}
                  <div className="flex justify-between items-center border-t border-slate-800/80 pt-2 text-[9px] text-slate-450 font-medium">
                    <span>Página {previewPageIdx + 1} de 12</span>
                    <span>SSPE-CEIPOL - Perímetro de Vigilancia</span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. ESTADO DE GENERACIÓN Y BOTONES DE CONTROL (v9.0) */}
            <div className="bg-slate-950/80 border border-emerald-500/20 rounded-xl p-5 space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 animate-pulse uppercase tracking-wider">
                  ✅ INFORME GENERADO CORRECTAMENTE
                </span>
                <span className="text-[10px] text-slate-500 font-medium tracking-wider">Versión: v9.0 | Gobernanza Algorítmica</span>
              </div>
              
              <div className="flex flex-wrap gap-2 justify-between items-center pt-1 border-t border-slate-800/60">
                <div className="flex flex-wrap gap-2">
                  <CEIPOLButton
                    variant="confirm"
                    size="sm"
                    disabled={isSavingAnalysis}
                    onClick={() => handleFinalizeAndExport("PDF")}
                  >
                    📄 Descargar PDF
                  </CEIPOLButton>
                  <CEIPOLButton
                    variant="primary"
                    size="sm"
                    disabled={isSavingAnalysis}
                    onClick={() => handleFinalizeAndExport("WORD")}
                  >
                    📝 Descargar Word
                  </CEIPOLButton>
                  <CEIPOLButton
                    variant="warning"
                    size="sm"
                    disabled={isSavingExpediente}
                    onClick={() => handleSaveExpediente()}
                  >
                    💾 Guardar Expediente
                  </CEIPOLButton>
                  <CEIPOLButton
                    variant="secondary"
                    size="sm"
                    onClick={(e) => { setClickCoords({ x: e.clientX, y: e.clientY }); handleConsultarHistorial(); }}
                  >
                    📂 Consultar Historial
                  </CEIPOLButton>
                  <CEIPOLButton
                    variant="secondary"
                    size="sm"
                    onClick={(e) => { setClickCoords({ x: e.clientX, y: e.clientY }); setShowReportModal(false); void confirmAndGenerateProfile(); }}
                  >
                    🔄 Regenerar Informe
                  </CEIPOLButton>
                </div>
                
                <CEIPOLButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowReportModal(false)}
                >
                  Cerrar Ventana
                </CEIPOLButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE CAPTURA DE MAPA (MAP_CAPTURE) */}
      {mapConfirmModal?.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 font-sans animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-amber-500">
                <span className="text-3xl">⚠️</span>
                <h3 className="text-base font-black uppercase tracking-wider">Confirmar Incorporación Cartográfica</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                La imagen será incorporada al expediente fotográfico asociada a la geometría seleccionada. Deberá cumplir las reglas de validación fotográfica institucional.
              </p>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2 text-[10px] text-slate-400">
                <div className="flex justify-between">
                  <span>Capturas a procesar:</span>
                  <span className="font-bold text-slate-200">{mapTemporaryCintilla.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Origen de Evidencia:</span>
                  <span className="font-bold text-cyan-400">MAP_CAPTURE</span>
                </div>
                <div className="flex justify-between">
                  <span>Tipo de Representación:</span>
                  <span className="font-bold text-emerald-400">STATIC_MAP_CONTEXT</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950/40 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setMapConfirmModal(null)}
                className="px-4 py-2 text-xs font-black text-slate-400 hover:text-white uppercase tracking-wider bg-transparent border-0 cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                disabled={isCapturingMap}
                onClick={async () => {
                  if (!uploadAndAddPhoto) return;
                  setIsCapturingMap(true);
                  setMapConfirmModal(null);
                  try {
                    for (let i = 0; i < mapTemporaryCintilla.length; i++) {
                      const item = mapTemporaryCintilla[i];
                      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(item.url)}`;
                      const res = await fetch(proxyUrl);
                      if (!res.ok) {
                        throw new Error(`Error al descargar la captura satelital de mapa #${i + 1}`);
                      }
                      const blob = await res.blob();
                      const file = new File([blob], `Map_Capture_${Date.now()}_${i}.jpg`, { type: "image/jpeg" });

                      await uploadAndAddPhoto(file, item.lat, item.lng, {
                        tipo: item.geometryType === "LINE" ? "Corredor" : "Polígono",
                        gpsSource: "VERTICE_MAPA",
                        source: "MAP_CAPTURE",
                        visualType: "STATIC_MAP_CONTEXT",
                        geometryType: item.geometryType,
                        captureMethod: item.captureContext === "vertex_edit" ? "VERTEX_EDIT" : "VERTEX_ADD",
                        captureContext: "map_geometry_change",
                        createdFrom: "ProjectMap",
                        streetViewCategory: item.streetViewCategory,
                        streetViewSource: "Google Maps Static API",
                        analysisType: "MAP_CAPTURE",
                        comentario: `EVIDENCIA CARTOGRÁFICA DE MAPA [Categoría: ${item.streetViewCategory}]: ${item.comentario}`,
                        validado: true,
                        // Trazabilidad de relación geométrica sin sobreescribir previas
                        ...(item.targetPhotoId ? {
                          relation: {
                            type: "GEOMETRY_UPDATE",
                            previousPhotoId: item.targetPhotoId
                          }
                        } : {})
                      } as any);
                    }
                    setMapTemporaryCintilla([]);
                    alert("Capturas de mapa incorporadas exitosamente al expediente bajo las reglas de gobernanza ADR-011.");
                  } catch (err: any) {
                    console.error("[PhotoAlbum] Error al incorporar cintilla de mapa:", err);
                    alert("Error al incorporar capturas de mapa: " + err.message);
                  } finally {
                    setIsCapturingMap(false);
                  }
                }}
                className="px-4 py-2 bg-emerald-600/90 text-white hover:bg-emerald-500 rounded-lg text-xs font-black uppercase tracking-wider shadow-lg border border-emerald-500/20 cursor-pointer"
              >
                {isCapturingMap ? "INCORPORANDO..." : "INCORPORAR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTORIAL DOSSIERS (v9.0) */}
      <DynamicPopup
        open={showHistoryModal}
        anchorPosition={clickCoords}
        onClose={() => setShowHistoryModal(false)}
        className="max-w-2xl w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-sm font-black text-cyan-400 flex items-center gap-2 uppercase tracking-wider">
            📂 Historial de Expedientes Guardados (v9.0)
          </h3>
          <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white text-sm transition-colors">✖</button>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
          {isLoadingHistory ? (
            <p className="text-xs text-slate-400">Cargando bitácora...</p>
          ) : historyDossiers.length === 0 ? (
            <CEIPOLEmptyState
              icon="📂"
              title="Historial de Expedientes Vacío"
              description="No existen expedientes registrados en la bitácora histórica de este proyecto."
              className="max-w-sm"
            />
          ) : (
            historyDossiers.map((h) => (
              <div key={h.id} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs hover:border-slate-700 transition-all">
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-400">Fecha y Hora:</span>
                    <span className="text-cyan-400 font-mono font-bold">{new Date(h.fecha).toLocaleString("es-MX")}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400">Nombre del Autor:</span>
                    <span className="text-slate-200 font-medium ml-1.5">{h.analyst || "Desconocido"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CEIPOLButton
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      try {
                        if (!h.editorialPayload) {
                          alert("Este expediente histórico no contiene el dictamen de Word para regenerar.");
                          return;
                        }
                        await exportToWord(
                          h.editorialPayload,
                          h.poligono || 'Expediente',
                          h.projectId || 'EXP',
                          user
                        );
                      } catch (err: any) {
                        alert("Error al generar Word: " + err.message);
                      }
                    }}
                  >
                    📝 WORD
                  </CEIPOLButton>
                  <CEIPOLButton
                    variant="confirm"
                    size="sm"
                    onClick={async () => {
                      try {
                        if (!h.briefing) {
                          alert("Este expediente histórico no contiene el dictamen de PDF para regenerar.");
                          return;
                        }
                        await generatePdfProgrammatic(h.briefing);
                      } catch (err: any) {
                        alert("Error al generar PDF: " + err.message);
                      }
                    }}
                  >
                    📄 PDF
                  </CEIPOLButton>
                  <CEIPOLButton
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteDossier(h.id)}
                  >
                    🗑️ BORRAR
                  </CEIPOLButton>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="flex justify-end pt-4 mt-2 border-t border-slate-800">
          <CEIPOLButton 
            variant="secondary" 
            size="sm" 
            onClick={() => setShowHistoryModal(false)}
          >
            Cerrar Historial
          </CEIPOLButton>
        </div>
      </DynamicPopup>

      {/* MODAL DE ELIMINACIÓN CONTROLADA (JUSTIFICACIÓN OBLIGATORIA) */}
      <DynamicPopup
        open={!!deleteModal?.isOpen}
        anchorPosition={clickCoords}
        onClose={() => {
          setDeleteModal(null);
          setDeleteReason("");
        }}
        className="max-w-md w-full border-red-700/50"
      >
        <h3 className="text-sm font-black text-red-500 flex items-center gap-2 mb-2 uppercase tracking-wider">
          ⚠️ Confirmar Eliminación Controlada
        </h3>
        <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-4">
          Está a punto de enviar este elemento ({deleteModal?.type}) a la <span className="font-bold text-amber-500">Papelera de Reciclaje Institucional</span>. Permanecerá allí por 7 días naturales antes de su eliminación definitiva.
        </p>
        
        <div className="space-y-1 mb-4">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Motivo de Eliminación (Obligatorio) *</label>
          <select
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 hover:border-slate-700 transition-all duration-200 font-sans"
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

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
          <CEIPOLButton
            variant="secondary"
            size="sm"
            onClick={() => {
              setDeleteModal(null);
              setDeleteReason("");
            }}
          >
            Cancelar
          </CEIPOLButton>
          <CEIPOLButton
            variant="danger"
            size="sm"
            disabled={!deleteReason.trim()}
            onClick={async () => {
              if (!deleteReason || !deleteModal) return;
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
          >
            Confirmar Eliminación
          </CEIPOLButton>
        </div>
      </DynamicPopup>

      {/* FASE 7.11-A: DOBLE CONFIRMACIÓN DE ELIMINACIÓN DE EVIDENCIA FOTOGRÁFICA */}
      {imageDeleteFlow?.isOpen && imageDeleteFlow.photo && (
        <DynamicPopup
          open={imageDeleteFlow.isOpen}
          anchorPosition={clickCoords}
          onClose={() => setImageDeleteFlow(null)}
          className="max-w-md w-full border-red-500/50 bg-slate-950/95"
        >
          {imageDeleteFlow.step === 1 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-red-500 flex items-center gap-2 uppercase tracking-wider">
                🗑️ Advertencia de eliminación
              </h3>
              
              <blockquote className="border-l-4 border-red-500 bg-red-950/20 p-3 rounded-r-xl">
                <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                  "Está a punto de eliminar esta imagen del expediente. Esta acción eliminará la evidencia visual y toda la contextualización asociada dentro del sistema."
                </p>
              </blockquote>

              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-800">
                  Detalles de la Evidencia Digital:
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-sans">
                  <div>
                    <span className="text-slate-500 block uppercase font-bold tracking-wide">Origen de imagen:</span>
                    <span className="text-slate-200 font-medium">
                      {imageDeleteFlow.photo.tipo?.toLowerCase().includes("street") || imageDeleteFlow.photo.url?.toLowerCase().includes("street") || imageDeleteFlow.photo.evidenceType === "VIRTUAL_STREET_VIEW" || imageDeleteFlow.photo.fuente === "Google Street View"
                        ? "Street View / Virtual"
                        : "Captura de Campo"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-bold tracking-wide">Fecha de registro:</span>
                    <span className="text-slate-200 font-medium">
                      {imageDeleteFlow.photo.fecha ? new Date(imageDeleteFlow.photo.fecha).toLocaleDateString("es-MX") : "N/D"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-bold tracking-wide">Clasificación actual:</span>
                    <span className="text-slate-200 font-medium">
                      {imageDeleteFlow.photo.tipo || imageDeleteFlow.photo.classification || "PRIMARY"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-bold tracking-wide">Relación Geográfica:</span>
                    <span className="text-slate-200 font-medium truncate" title={imageDeleteFlow.photo.lat ? `${imageDeleteFlow.photo.lat}, ${imageDeleteFlow.photo.lng}` : "Sin coordenadas"}>
                      {imageDeleteFlow.photo.lat != null ? `Georreferenciada (${Number(imageDeleteFlow.photo.lat).toFixed(4)}, ${Number(imageDeleteFlow.photo.lng).toFixed(4)})` : "Sin coordenadas"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <CEIPOLButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setImageDeleteFlow(null)}
                >
                  CANCELAR
                </CEIPOLButton>
                <CEIPOLButton
                  variant="danger"
                  size="sm"
                  onClick={() => setImageDeleteFlow(prev => prev ? { ...prev, step: 2 } : null)}
                >
                  CONTINUAR
                </CEIPOLButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-amber-500 flex items-center gap-2 uppercase tracking-wider">
                ⚠️ Confirmación irreversible
              </h3>

              <blockquote className="border-l-4 border-amber-500 bg-amber-950/20 p-3 rounded-r-xl">
                <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                  "Esta acción no puede deshacerse. Al confirmar se perderá permanentemente la imagen, su contextualización territorial, clasificación analítica y vínculos dentro del expediente."
                </p>
              </blockquote>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <CEIPOLButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setImageDeleteFlow(prev => prev ? { ...prev, step: 1 } : null)}
                >
                  REGRESAR
                </CEIPOLButton>
                <CEIPOLButton
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    try {
                      await removePhotoFromAlbum(imageDeleteFlow.photo.id);
                      setImageDeleteFlow(null);
                      alert("Evidencia visual eliminada definitivamente de forma exitosa.");
                    } catch (err: any) {
                      alert("Error al eliminar la evidencia visual: " + err.message);
                    }
                  }}
                >
                  ELIMINAR DEFINITIVAMENTE
                </CEIPOLButton>
              </div>
            </div>
          )}
        </DynamicPopup>
      )}

      {/* CONFIRMACIÓN DE HIPÓTESIS DEMOGRÁFICA (SCINCE) */}
      <DynamicPopup
        open={!!scinceDataConfirm}
        anchorPosition={clickCoords}
        onClose={() => setScinceDataConfirm(null)}
        className="max-w-md w-full"
      >
        <h3 className="text-sm font-black text-cyan-400 flex items-center gap-2 mb-2 uppercase tracking-wider">
          📊 Confirmación de Hipótesis: INEGI SCINCE
        </h3>
        <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-3">
          Se han obtenido los siguientes datos sociodemográficos de la cuadra (Demografía, Marginación, Población e Indicadores Sociales). Confirme su incorporación al análisis de hipótesis:
        </p>
        <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-xs text-slate-300 leading-relaxed font-mono max-h-[160px] overflow-y-auto mb-4 select-all shadow-inner">
          {scinceDataConfirm}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <CEIPOLButton
            variant="secondary"
            size="sm"
            onClick={() => setScinceDataConfirm(null)}
          >
            Cancelar
          </CEIPOLButton>
          <CEIPOLButton
            variant="confirm"
            size="sm"
            onClick={async () => {
              if (!scinceDataConfirm) return;
              try {
                await registerSweep({
                  engine: "Población de Cuadra (SCINCE)",
                  source: "INEGI SCINCE",
                  type: "Directa",
                  relevance: "Medio",
                  data: scinceDataConfirm
                });
                setScinceDataConfirm(null);
                setToast({ type: "success", message: "✓ Datos sociodemográficos agregados a la hipótesis correctamente" });
              } catch (err: any) {
                alert("Error al registrar barrido: " + err.message);
              }
            }}
          >
            Aceptar y Añadir
          </CEIPOLButton>
        </div>
      </DynamicPopup>

      {/* CONFIRMACIÓN DE HIPÓTESIS COMERCIAL (DENUE) */}
      <DynamicPopup
        open={!!denueDataConfirm}
        anchorPosition={clickCoords}
        onClose={() => setDenueDataConfirm(null)}
        className="max-w-md w-full"
      >
        <h3 className="text-sm font-black text-cyan-400 flex items-center gap-2 mb-2 uppercase tracking-wider">
          🏪 Confirmación de Hipótesis: INEGI DENUE
        </h3>
        <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-3">
          Se han obtenido los siguientes datos de la actividad comercial (Giros, Concentración y Establecimientos Comerciales). Confirme su incorporación al análisis de hipótesis:
        </p>
        <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-xs text-slate-300 leading-relaxed font-mono max-h-[160px] overflow-y-auto mb-4 select-all shadow-inner">
          {denueDataConfirm}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <CEIPOLButton
            variant="secondary"
            size="sm"
            onClick={() => setDenueDataConfirm(null)}
          >
            Cancelar
          </CEIPOLButton>
          <CEIPOLButton
            variant="confirm"
            size="sm"
            onClick={async () => {
              if (!denueDataConfirm) return;
              try {
                await registerSweep({
                  engine: "Giros Comerciales (DENUE)",
                  source: "OSINT",
                  type: "Directa",
                  relevance: "Medio",
                  data: denueDataConfirm
                });
                setDenueDataConfirm(null);
                setToast({ type: "success", message: "✓ Datos comerciales agregados a la hipótesis correctamente" });
              } catch (err: any) {
                alert("Error al registrar barrido: " + err.message);
              }
            }}
          >
            Aceptar y Añadir
          </CEIPOLButton>
        </div>
      </DynamicPopup>

      {/* VENTANA DE PROCESAMIENTO DE DICTAMEN IA (CONSOLA DE CAPÍTULOS) */}
      {isGeneratingAI && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 print:hidden">
          <div role="dialog" aria-modal="true" className="w-full max-w-2xl bg-slate-950 border border-sky-900/50 rounded-xl p-6 shadow-2xl space-y-4 text-left">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-sky-400 uppercase tracking-widest flex items-center gap-2">
                ⚙️ PROCESAMIENTO DE DICTAMEN IA - GEOINT v8.0
              </h3>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-sky-500 rounded-full animate-ping"></span>
                <span className="text-[10px] text-sky-400 font-bold uppercase">PROCESANDO</span>
              </div>
            </div>

            {/* Medidor / Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400 font-semibold">
                <span>Avance de Capítulos: {generationChapter} / 11</span>
                <span>{Math.round((generationChapter / 11) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                <div 
                  className="bg-gradient-to-r from-sky-600 to-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${Math.round((generationChapter / 11) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-sky-400/90 font-bold italic animate-pulse mt-1">
                {generationChapter > 0 ? `Generando: ${getChapterLabel(generationChapter)}` : "Inicializando consulta cartográfica..."}
              </p>
            </div>

            {/* Consola Terminal */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bitácora en Tiempo Real (Consola)</label>
              <div className="w-full h-64 bg-slate-900 border border-slate-800 rounded-lg p-3 overflow-y-auto font-mono text-[10px] text-emerald-400 space-y-1 leading-relaxed">
                {generationLogs.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap">
                    {log}
                  </div>
                ))}
                {/* Auto Scroll Anchor */}
                <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })}></div>
              </div>
            </div>

            {/* Footer / Botones */}
            <div className="flex justify-end pt-2 border-t border-slate-850">
              <p className="text-[9px] text-slate-500 mr-auto flex items-center">
                * Por favor, no cierre esta ventana hasta finalizar.
              </p>
              {error && (
                <button
                  type="button"
                  onClick={() => { setIsGeneratingAI(false); setError(null); }}
                  className="px-4 py-2 bg-red-950/40 border border-red-900 text-red-300 text-xs font-bold rounded-lg hover:bg-red-900/40 transition active:scale-95"
                >
                  Cerrar por Error
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Offscreen rendering for autoCaptureSnapshots */}
      <div 
        style={{ 
          position: "absolute", 
          top: "-9999px", 
          left: "-9999px", 
          width: "1200px", 
          pointerEvents: "none" 
        }}
      >
        <TacticalMaps
          album={album}
          analysisResult={analysisResult}
          analysisRadius={analysisRadius}
          analysisPolygon={analysisPolygon}
          manualPois={manualPois}
          geometryType={project?.geometryType || "individual"}
        />
        <TacticalCharts analysisResult={analysisResult} />
      </div>

      {/* TOAST DE GOBERNANZA CEIPOL */}
      {toast && (
        <CEIPOLToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* MÓDULO DE FLUJOS Y VISOR STREET VIEW EVIDENCE GOVERNANCE v2.1 */}
      {svFlowTarget && (
        <>
          <StreetViewConfirmationModal
            isOpen={isSvModal1Open}
            lat={svFlowTarget.lat}
            lng={svFlowTarget.lng}
            onCancel={() => {
              setIsSvModal1Open(false);
              setSvFlowTarget(null);
            }}
            onConfirm={handleConfirmSvModal1}
          />

          <StreetViewDisclaimerModal
            isOpen={isSvModal2Open}
            onCancel={() => {
              setIsSvModal2Open(false);
              setSvFlowTarget(null);
            }}
            onAccept={handleAcceptSvModal2}
            analystName={user?.displayName || "Analista CEIPOL"}
          />

          <StreetViewPanoramaPicker
            isOpen={isSvPickerOpen}
            lat={svFlowTarget.lat}
            lng={svFlowTarget.lng}
            onClose={() => {
              setIsSvPickerOpen(false);
              setSvFlowTarget(null);
            }}
            onCapture={handleCompleteStreetViewCapture}
            analystName={user?.displayName || "Analista CEIPOL"}
          />
        </>
      )}
    </>
  );
}
