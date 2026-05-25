"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { useProject } from "@/context/ProjectContext";
import { AnalysisMap } from "./AnalysisMap";
import { CrimeCharts } from "./CrimeCharts";
import { exportToWord } from "@/lib/exportToWord";

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
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(srcUrl);

      ctx.drawImage(img, 0, 0);

      // Sello de agua Institucional
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      const watermarkSize = Math.max(30, canvas.width * 0.1);
      ctx.font = `bold ${watermarkSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SSPE-CEIPOL", 0, 0);
      ctx.restore();
      
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => resolve(srcUrl);
    img.src = srcUrl;
  });
}

const C4_RIGHT_COLUMN_ID = "c4-right-column";

type PhotoAlbumProps = {
  onDeletePhoto?: (id: string) => void;
  projectId?: string;
  onSaveAnalysisToCloud?: (
    content: string,
    attachedPhotos?: string[]
  ) => Promise<void>;
  /** Vista Centro de Comando: columna derecha para mapa y gráficas (portal). */
  splitLayout?: boolean;
};

export function PhotoAlbum({
  onDeletePhoto,
  projectId,
  onSaveAnalysisToCloud,
  splitLayout = false,
}: PhotoAlbumProps = {}) {
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
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [analysisContextExtra, setAnalysisContextExtra] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [profileRiskLevel, setProfileRiskLevel] = useState<
    "bajo" | "medio" | "alto" | null
  >(null);
  const [analysisPolygon, setAnalysisPolygon] = useState<google.maps.LatLngLiteral[]>([]);
  const [manualPois, setManualPois] = useState<{ lat: number; lng: number; label?: string }[]>([]);
  const [visionData, setVisionData] = useState<Record<string, { faces: { count: number; headwear: boolean }; extractedText: string }>>({});
  const [debugData, setDebugData] = useState<any>(null);
  const [showMonitor, setShowMonitor] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docContext, setDocContext] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isRefiningDoc, setIsRefiningDoc] = useState(false);
  const [docSuggestions, setDocSuggestions] = useState("");
  const [isAuditingDoc, setIsAuditingDoc] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<"HEATMAP" | "ECOLOGY" | "MOBILITY">("HEATMAP");
  const [mapSnapshots, setMapSnapshots] = useState<{ title: string; dataUrl: string }[]>([]);
  const [listeningField, setListeningField] = useState<string | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const lastTranscriptRef = useRef<string>("");
  const [isValidatingPhotos, setIsValidatingPhotos] = useState(false);
  const [docAuditScore, setDocAuditScore] = useState<number | null>(null);
  const [analysisAuditScore, setAnalysisAuditScore] = useState<number | null>(null);

  // FASE 2: Estados de validación de auditoría (semáforo)
  const [isDocContextAudited, setIsDocContextAudited] = useState(false);
  const [isAnalysisContextAudited, setIsAnalysisContextAudited] = useState(false);
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
      const res = await fetch("/api/refine-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: photosContext, mode: "validate-photos", geometryType: project?.geometryType || "individual" })
      });
      const data = await res.json();
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
          await onSaveAnalysisToCloud(editableProfile, []);
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

      const mapRes = await fetch("/api/analyze-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          photos: photosPayload, 
          analysisRadius,
          analysisPolygon,
          manualPois
        }),
      });
      
      let currentAnalysisResult = analysisResult;
      if (mapRes.ok) {
        const mapData = await mapRes.json();
        currentAnalysisResult = mapData;
        setAnalysisResult(mapData);
      }

      // Incidencia local (1km) + marco teórico (bibliografía) para auditoría y Gemini
      let incidenciaLocal: any[] = [];
      let bibliografiaLocal = "";
      try {
        const first = selected[0];
        const lat =
          typeof first?.lat === "number" && !Number.isNaN(first.lat)
            ? first.lat
            : 21.8818;
        const lng =
          typeof first?.lng === "number" && !Number.isNaN(first.lng)
            ? first.lng
            : -102.2915;

        const incidenciaRes = await fetch("/api/incidencia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        });

        if (incidenciaRes.ok) {
          const incidenciaJson = (await incidenciaRes.json()) as {
            data?: any[];
            bibliografia?: string;
          };
          incidenciaLocal = incidenciaJson.data ?? [];
          bibliografiaLocal = incidenciaJson.bibliografia ?? "";
          setDebugData((prev: any) => ({
            ...(prev ?? {}),
            incidencia: incidenciaLocal,
            bibliografia: bibliografiaLocal,
          }));
        }
      } catch (e) {
        console.error("[PhotoAlbum] Error /api/incidencia:", e);
      }

      // Empaquetar las instrucciones de la Evidencia Multimodal para la IA
      const multimodalContext = documents.map(d => `[Archivo Adjunto al Expediente: ${d.name} | Tipo: ${d.type}]\nInstrucción Táctica del Analista: ${d.context}`).join("\n\n");

      try {
        const res = await fetch("/api/generate-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photos: photosPayload,
            analysisContext,
            analysisRadius,
            focusAreas,
            incidenciaLocal,
            bibliografiaLocal,
            multimodalContext,
            geometryType: project?.geometryType || "individual",
            projectDescription: project?.descripcion || "",
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
          markdown: string;
          meta?: { 
            riskLevel?: "bajo" | "medio" | "alto";
            incidenciaDetalles?: any[];
            pois?: any[];
            inegiDemographics?: any;
          };
        };
        const markdown = data.markdown ?? "";
        setAiProfile(markdown);
        setEditableProfile(markdown);
        setProfileRiskLevel(data.meta?.riskLevel ?? null);

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
        });
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
              : "Error de comunicación con el Cuartel General. Reintente."
          );
        }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleDownloadMap = async () => {
    const el = document.getElementById("map-export-container");
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        scale: 2,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "Mapa_Dictamen_Tactico.png";
      link.click();
    } catch (err) {
      console.error("[PhotoAlbum] Error al exportar mapa:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo exportar el mapa oficial."
      );
    }
  };

  const handleAttachMapSnapshot = async () => {
    const el = document.getElementById("map-export-container");
    if (!el) return;
    try {
      // Ocultar la botonera de pestañas temporalmente para la foto
      const buttons = el.querySelector('.bg-slate-100.border-b');
      if (buttons) (buttons as HTMLElement).style.display = 'none';

      const canvas = await html2canvas(el, { useCORS: true, scale: 1.5 });
      
      if (buttons) (buttons as HTMLElement).style.display = 'flex';

      const dataUrl = canvas.toDataURL("image/png");
      
      let title = "Mapa Criminológico";
      if (mapViewMode === "HEATMAP") title = "Mapa de Zonas Calientes (Heatmap)";
      if (mapViewMode === "ECOLOGY") title = "Mapa de Ecología y Atractores (DENUE)";
      if (mapViewMode === "MOBILITY") title = "Mapa de Topografía y Rutas";

      setMapSnapshots(prev => [...prev, { title, dataUrl }]);
    } catch (err) {
      console.error("[PhotoAlbum] Error al capturar mapa:", err);
    }
  };

  const autoCaptureSnapshots = async () => {
    let currentSnapshots = [...mapSnapshots];
    let changed = false;

    // Capturar Gráficas
    if (!currentSnapshots.some(s => s.title === "GRÁFICAS ESTADÍSTICAS") && analysisResult?.historicalCrimes && analysisResult.historicalCrimes.length > 0) {
      const chartsEl = document.getElementById("charts-export-container");
      if (chartsEl) {
        try {
          const canvas = await html2canvas(chartsEl, { useCORS: true, scale: 1.5, backgroundColor: "#0f172a" });
          currentSnapshots.unshift({ title: "GRÁFICAS ESTADÍSTICAS", dataUrl: canvas.toDataURL("image/png") });
          changed = true;
        } catch(e) {}
      }
    }

    // Capturar Mapa
    if (!currentSnapshots.some(s => s.title.includes("MAPA")) && analysisResult) {
      const mapEl = document.getElementById("map-export-container");
      if (mapEl) {
        try {
          const buttons = mapEl.querySelector('.bg-slate-100.border-b');
          if (buttons) (buttons as HTMLElement).style.display = 'none';
          const canvas = await html2canvas(mapEl, { useCORS: true, scale: 1.5 });
          if (buttons) (buttons as HTMLElement).style.display = 'flex';
          currentSnapshots.push({ title: "MAPA DEL ANÁLISIS", dataUrl: canvas.toDataURL("image/png") });
          changed = true;
        } catch(e) {}
      }
    }

    if (changed) {
      setMapSnapshots(currentSnapshots);
      await new Promise(r => setTimeout(r, 500));
    }
    return currentSnapshots;
  };

  const handleExportToWord = async () => {
    const rawContent = editableProfile || aiProfile;
    if (!rawContent) return;
    setError(null);
    
    const snapshotsToExport = await autoCaptureSnapshots();
    const content = rawContent.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "[$1]");

    const mapsSnaps = snapshotsToExport.filter(s => s.title.toLowerCase().includes("mapa") || s.title.toLowerCase().includes("zonas") || s.title.toLowerCase().includes("atractores") || s.title.toLowerCase().includes("topografía"));
    const chartsSnaps = snapshotsToExport.filter(s => s.title.toLowerCase().includes("gráfica") || s.title.toLowerCase().includes("grafica") || !mapsSnaps.includes(s));
    const sortedSnapshotsToExport = [...mapsSnaps, ...chartsSnaps];

    const photosToExport = album.filter((p) => selectedIds.includes(p.id) && p.previewUrl);
    const photoUrls: string[] = [];

    for (const p of photosToExport) {
      const burnedUrl = await burnGpsOnImage(p.previewUrl as string);
      photoUrls.push(burnedUrl);
    }

    try {
      await exportToWord(
        content,
        "Dictamen_criminologico_ambiental",
        photoUrls.length > 0 ? photoUrls : undefined,
        profileRiskLevel ?? undefined,
        sortedSnapshotsToExport.length > 0 ? sortedSnapshotsToExport : undefined
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
        margin: 10,
        filename: `Dictamen_Criminologico_${safeName}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
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
            <div className="flex flex-col gap-6">
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
                    {/* Sello de agua visual en UI */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10">
                      <span className="text-white/40 font-bold text-4xl sm:text-7xl -rotate-45 select-none tracking-widest drop-shadow-lg">
                        SSPE-CEIPOL
                      </span>
                    </div>
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
                    <input
                      type="text"
                      placeholder="Comentario (Obligatorio)..."
                      value={p.comentario || ""}
                      disabled={isReadOnly}
                      onChange={(e) => updatePhotoMeta(p.id, { tipo: p.tipo, comentario: e.target.value })}
                      className={`w-full bg-slate-800 text-slate-200 border rounded-md p-2 pr-8 text-xs outline-none focus:border-sky-500 disabled:opacity-50 ${!p.comentario?.trim() ? 'border-amber-500/70 bg-amber-900/10' : 'border-slate-700'}`}
                    />
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => toggleDictation(`comentario-${p.id}`, (text) => updatePhotoMeta(p.id, { tipo: p.tipo, comentario: ((p.comentario || "") + " " + text).trim() }))}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${listeningField === 'comentario-'+p.id ? 'text-red-400 animate-pulse' : 'text-slate-400 hover:text-sky-400'}`}
                        title="Dictar comentario por voz"
                      >
                        🎙️
                      </button>
                    )}
                  </div>

                  <div className="mt-1 mb-2">
                    <div className="flex justify-between items-center text-[9px] mb-0.5">
                      <span className="text-slate-400">Idoneidad del contexto (Semáforo):</span>
                      <span className={`font-bold ${(p.comentario || "").length < 15 ? "text-red-400" : (p.comentario || "").length < 50 ? "text-amber-400" : "text-emerald-400"}`}>
                        {(p.comentario || "").length === 0 ? "Sin contexto" : (p.comentario || "").length < 15 ? "Básico" : (p.comentario || "").length < 50 ? "Aceptable" : "Óptimo"}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1">
                      <div 
                        className={`h-1 rounded-full transition-all duration-300 ${(p.comentario || "").length < 15 ? "bg-red-500" : (p.comentario || "").length < 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(((p.comentario || "").length / 80) * 100, 100)}%` }}
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
            <input
              id="doc-upload-input"
              type="file"
              disabled={isReadOnly}
              onChange={(e) => setDocFile(e.target.files ? e.target.files[0] : null)}
              className="text-sm text-slate-300 w-full file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-sky-900 file:text-sky-200 hover:file:bg-sky-800 disabled:opacity-50"
              accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.ppt,.pptx,.txt,.mp4,.avi,.mkv,.mov,.jpg,.jpeg,.png,.wav,.mp3,.m4a"
            />
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
                <span className={`font-bold ${docContext.length < 20 ? "text-red-400" : docContext.length < 80 ? "text-amber-400" : "text-emerald-400"}`}>
                  {docContext.length === 0 ? "Sin contexto" : docContext.length < 20 ? "Básico" : docContext.length < 80 ? "Aceptable" : "Óptimo"}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${docContext.length < 20 ? "bg-red-500" : docContext.length < 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min((docContext.length / 150) * 100, 100)}%` }}
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
                    const minimalPhotos = selected.map((p) => ({ lat: p.lat, lng: p.lng }));
                    const res = await fetch("/api/refine-context", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        context: docContext,
                        photos: minimalPhotos,
                        mode: "suggest",
                        geometryType: project?.geometryType || "individual",
                        projectDescription: project?.descripcion || "",
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setDocSuggestions(data.suggestions ?? "");
                      setDocAuditScore(data.score ?? 0);
                      if ((data.score ?? 0) >= 80) {
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
                {isRefiningDoc ? "Consultando IA..." : "Pedir Sugerencias y Auditar Contexto"}
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
                        const res = await fetch("/api/refine-context", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ 
                            context: docSuggestions, 
                            mode: "audit",
                            geometryType: project?.geometryType || "individual",
                            projectDescription: project?.descripcion || "",
                          }),
                        });
                        const data = await res.json();
                      if (res.ok) {
                        setDocSuggestions(data.suggestions ?? "");
                        setDocAuditScore(data.score ?? 0);
                        if ((data.score ?? 0) >= 80) setIsDocContextAudited(true);
                      }
                        else setError(data.error || "Error al auditar sugerencia.");
                      } catch (err) { setError("Error de comunicación al auditar."); }
                      finally { setIsAuditingDoc(false); }
                    }}
                    disabled={isAuditingDoc || !docSuggestions.trim()}
                    className="rounded-md bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                  >
                    {isAuditingDoc ? "Auditando..." : "Auditar y Mejorar Redacción"}
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
              disabled={!docFile || !docContext.trim() || isUploadingDoc || isReadOnly || !isDocContextAudited}
              onClick={async () => {
                if (!docFile || !docContext.trim()) return;
                setIsUploadingDoc(true);
                setError(null);
                try {
                  await uploadDocument(docFile, docContext);
                  setDocFile(null);
                  setDocContext("");
                  setIsDocContextAudited(false);
                  const fileInput = document.getElementById("doc-upload-input") as HTMLInputElement;
                  if (fileInput) fileInput.value = "";
                } catch (e: any) {
                  setError("Error al subir documento: " + e.message);
                } finally {
                  setIsUploadingDoc(false);
                }
              }}
              className="w-full bg-sky-700 hover:bg-sky-600 text-white py-1.5 px-4 rounded text-xs font-semibold disabled:opacity-50 transition"
            >
              {isUploadingDoc ? "Subiendo Evidencia..." : "Subir Evidencia Contextualizada"}
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
                <p className="text-[10px] text-slate-300 bg-slate-900 p-1.5 rounded">{d.context}</p>
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
              {isValidatingPhotos ? "Auditando evidencia fotográfica..." : "Procesando inteligencia... Por favor espere"}
            </>
          ) : aiProfile ? (
            isReadOnly ? "Análisis Protegido (Solo Lectura)" : "Actualizar Análisis Criminológico"
          ) : (
            "Generar Análisis Criminológico"
          )}
        </button>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        <button
          type="button"
          onClick={() => setShowMonitor(!showMonitor)}
          className="text-xs text-gray-500 hover:text-blue-400 flex items-center gap-1 mt-2"
        >
          👁️{" "}
          {showMonitor ? "Ocultar Monitor de Ingesta" : "Ver Datos Crudos (Auditoría)"}
        </button>
      </div>

      {showMonitor && (
        <div className="mt-4 p-4 bg-black border border-green-900 rounded-md overflow-x-auto max-h-96 overflow-y-auto">
          <h4 className="text-green-500 text-xs font-mono mb-2 border-b border-green-900 pb-1">
            DATOS EXTRAÍDOS PARA LA IA:
          </h4>
          {debugData ? (
            <pre className="text-green-400 text-[10px] sm:text-xs font-mono whitespace-pre-wrap">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          ) : (
            <p className="text-green-700 text-[11px] font-mono">
              Aún no hay datos capturados. Genere un análisis para ver el payload que se enviará a la IA.
            </p>
          )}
        </div>
      )}

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

              {analysisResult.historicalCrimes && analysisResult.historicalCrimes.length > 0 && (
                <div id="charts-export-container" className="w-full bg-[#0f172a] rounded-xl p-4 mb-3 border border-slate-700">
                  <CrimeCharts crimes={analysisResult.historicalCrimes ?? []} inegi={analysisResult.inegiDemographics} pois={analysisResult.pois ?? []} />
                </div>
              )}
              <div id="map-export-container" className="w-full mt-3 rounded-xl border border-slate-700 bg-white text-black overflow-hidden flex flex-col">
                <div className="bg-slate-100 border-b border-slate-300 p-2 flex flex-wrap gap-2 print:hidden justify-center shadow-sm">
                  <button 
                    onClick={() => setMapViewMode("HEATMAP")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${mapViewMode === 'HEATMAP' ? 'bg-red-600 text-white shadow-inner' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    🔥 Zonas Calientes
                  </button>
                  <button 
                    onClick={() => setMapViewMode("ECOLOGY")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${mapViewMode === 'ECOLOGY' ? 'bg-sky-600 text-white shadow-inner' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    🏪 Atractores (DENUE)
                  </button>
                  <button 
                    onClick={() => setMapViewMode("MOBILITY")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${mapViewMode === 'MOBILITY' ? 'bg-emerald-600 text-white shadow-inner' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    🛣️ Topografía y Rutas
                  </button>
                </div>
                <div className="relative p-0 w-full">
                  <AnalysisMap
                    album={album.filter((p) => selectedIds.includes(p.id))}
                    analysisResult={analysisResult}
                    analysisRadius={analysisRadius}
                    analysisPolygon={analysisPolygon}
                    setAnalysisPolygon={setAnalysisPolygon}
                    manualPois={manualPois}
                    setManualPois={setManualPois}
                    isPreliminary={false}
                    viewMode={mapViewMode}
                    geometryType={project?.geometryType}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 print:hidden">
                <button
                  type="button"
                  onClick={handleAttachMapSnapshot}
                  className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
                >
                  📸 Añadir vista actual al informe
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMap}
                  className="inline-flex items-center justify-center rounded-md bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-600 transition-colors print:hidden"
                >
                  Descargar Imagen Suelta
                </button>
              </div>
              {mapSnapshots.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                  <div className="w-full text-xs font-semibold text-slate-300 mb-1">Mapas adjuntos al reporte Word:</div>
                  {mapSnapshots.map((snap, idx) => (
                    <div key={idx} className="relative group rounded border border-sky-500 overflow-hidden w-28 h-20 bg-black">
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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-900 px-8 py-10 space-y-6 my-auto">
            <h3 className="text-lg font-semibold text-slate-100">
              Configuración del Análisis Táctico
            </h3>
            {selectedIds.length >= 1 && (
              <div className="space-y-2">
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
                    Hipótesis del investigador (contexto del cruce de ubicaciones)
                  </label>
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
                <textarea
                  value={analysisContext}
                  onChange={(e) => {
                    setAnalysisContext(e.target.value);
                    setIsAnalysisContextAudited(false);
                  }}
                  rows={8}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 px-5 py-4 text-base md:text-lg resize-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ejemplo: Posible corredor de riesgo entre polígono habitacional y zona de bares, con vulnerabilidad en rutas peatonales sin vigilancia..."
                />
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsRefining(true);
                      setAiSuggestions("");
                      setAnalysisAuditScore(null);
                      try {
                        const selected = album.filter((p) =>
                          selectedIds.includes(p.id)
                        );
                        const minimalPhotos = selected.map((p) => ({
                          lat: p.lat,
                          lng: p.lng,
                        }));
                        const res = await fetch("/api/refine-context", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            context: analysisContext,
                            photos: minimalPhotos,
                            mode: "suggest",
                            geometryType: project?.geometryType || "individual",
                            projectDescription: project?.descripcion || "",
                          }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setAiSuggestions(data.suggestions ?? "");
                          setAnalysisAuditScore(data.score ?? 0);
                          if ((data.score ?? 0) >= 80) {
                            setIsAnalysisContextAudited(true);
                          }
                        } else {
                          setError(
                            data.error ||
                              "No se pudieron obtener sugerencias de IA."
                          );
                        }
                      } catch (err) {
                        console.error("[PhotoAlbum] refine-context error:", err);
                        setError(
                          err instanceof Error
                            ? err.message
                            : "No se pudieron obtener sugerencias de IA."
                        );
                      } finally {
                        setIsRefining(false);
                      }
                    }}
                    disabled={isRefining || selectedIds.length < 1}
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                  >
                    {isRefining
                      ? "Pidiendo sugerencias…"
                      : "Pedir Sugerencias a IA"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                </div>
                {aiSuggestions && (
                  <div className="mt-2 rounded-md border border-yellow-700 bg-yellow-900/30 px-3 py-2 text-xs text-yellow-200 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold">Borrador y Sugerencias de IA (Editable):</p>
                      {analysisAuditScore !== null && (
                        <span className={`px-2 py-1 rounded font-bold ${analysisAuditScore >= 80 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                          Lógica: {analysisAuditScore}%
                        </span>
                      )}
                    </div>
                    <div className="relative w-full">
                      <button
                        type="button"
                        onClick={() => toggleDictation('aiSuggestions', (text) => setAiSuggestions(prev => (prev ? `${prev.trim()} ${text}` : text)))}
                        className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold border ${listeningField === 'aiSuggestions' ? "border-red-500 text-red-300 bg-red-900/60 animate-pulse" : "border-yellow-700 text-yellow-300 bg-yellow-900/80 hover:bg-yellow-800"}`}
                      >
                        <span>🎙️</span>
                      </button>
                      <textarea
                        value={aiSuggestions}
                        onChange={(e) => setAiSuggestions(e.target.value)}
                        className="w-full bg-yellow-950/50 border border-yellow-700/50 rounded-md p-3 pr-10 text-sm text-yellow-100 min-h-[140px] focus:outline-none focus:ring-1 focus:ring-yellow-500 resize-y shadow-inner"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-yellow-300/80">
                      Edite el texto libremente. Puede pedir a la IA que audite y mejore su redacción técnica antes de aplicarlo al contexto principal.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAiSuggestions("");
                          setAnalysisAuditScore(null);
                          setIsAnalysisContextAudited(false);
                        }}
                        className="rounded-md border border-red-800 bg-red-900/50 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-800/50"
                      >
                        Descartar (Usar Original)
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setIsAuditing(true);
                          setError(null);
                          try {
                            const res = await fetch("/api/refine-context", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                context: aiSuggestions,
                                mode: "audit",
                                geometryType: project?.geometryType || "individual",
                                projectDescription: project?.descripcion || "",
                              }),
                            });
                            const data = await res.json();
                            if (res.ok) {
                              setAiSuggestions(data.suggestions ?? "");
                              setAnalysisAuditScore(data.score ?? 0);
                              if ((data.score ?? 0) >= 80) {
                                setIsAnalysisContextAudited(true);
                              }
                            } else {
                              setError(data.error || "Error al auditar sugerencia.");
                            }
                          } catch (err) {
                            setError("Error de comunicación al auditar.");
                          } finally {
                            setIsAuditing(false);
                          }
                        }}
                        disabled={isAuditing || !aiSuggestions.trim()}
                        className="rounded-md bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                      >
                        {isAuditing ? "Auditando y Mejorando..." : "Auditar y Mejorar Redacción"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAnalysisContext((prev) => (prev ? `${prev}\n\n${aiSuggestions}` : aiSuggestions));
                          setAiSuggestions("");
                          setIsAnalysisContextAudited(true);
                        }}
                        disabled={isAuditing || (analysisAuditScore !== null && analysisAuditScore < 80)}
                        className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        Aplicar al Contexto Principal {(analysisAuditScore !== null && analysisAuditScore < 80) ? '(Requiere 80%)' : ''}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
              {!isAnalysisContextAudited && !aiSuggestions && (
                <p className="text-xs text-amber-400 text-right">⚠️ Debe pedir sugerencias y auditar la hipótesis antes de comenzar el análisis.</p>
              )}
              {isAnalysisContextAudited && (
                <p className="text-xs text-emerald-400 text-right">✅ Hipótesis contextual auditada y validada.</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void confirmAndGenerateProfile()}
                  disabled={!isAnalysisContextAudited}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Comenzar Análisis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
      {/* CONTENEDOR OCULTO PARA EL PDF OFICIAL (A4 ~ 794px) */}
      <div className="absolute left-[-9999px] top-[-9999px]">
        <div id="official-pdf-content" className="w-[794px] bg-white text-black p-10 font-sans">
          <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-6">
            <img src="/logos/logo-ceipol.png" alt="CEIPOL" className="h-20 object-contain" />
            <div className="flex-1 text-center px-4">
              <h1 className="text-xl font-black text-slate-900 tracking-wide">PERFIL CRIMINOLÓGICO AMBIENTAL</h1>
              <h2 className="text-sm font-bold text-slate-700 mt-1">CENTRO DE ESTUDIOS EN SEGURIDAD PÚBLICA</h2>
              <h3 className="text-[11px] font-semibold text-slate-500 mt-0.5">SECRETARÍA DE SEGURIDAD PÚBLICA DEL ESTADO</h3>
            </div>
            <img src="/logos/logo-ssp.png" alt="SSP" className="h-20 object-contain" />
          </div>

          {profileRiskLevel && (
            <div className="mb-6 p-4 border border-slate-300 bg-slate-50 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Epicentro de Análisis</p>
                <p className="text-sm font-semibold">{project?.nombre || "Polígono Operativo"}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Radio de Cobertura</p>
                <p className="text-sm font-semibold">{analysisRadius} metros</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-500 uppercase">Nivel de Riesgo</p>
                <p className={`text-base font-black uppercase ${profileRiskLevel === 'alto' ? 'text-red-600' : profileRiskLevel === 'medio' ? 'text-amber-500' : 'text-emerald-600'}`}>{profileRiskLevel}</p>
              </div>
            </div>
          )}

          {project?.descripcion && (
            <div className="mb-6 p-4 border border-slate-300 bg-slate-50 rounded-lg break-inside-avoid">
              <p className="text-xs font-bold text-slate-500 uppercase">Explicación del Proyecto (Voz)</p>
              <p className="text-sm font-semibold text-slate-800">{project.descripcion}</p>
            </div>
          )}

          {(() => {
            const mapsSnaps = mapSnapshots.filter(s => s.title.toLowerCase().includes("mapa") || s.title.toLowerCase().includes("zonas") || s.title.toLowerCase().includes("atractores") || s.title.toLowerCase().includes("topografía"));
            const chartsSnaps = mapSnapshots.filter(s => s.title.toLowerCase().includes("gráfica") || s.title.toLowerCase().includes("grafica") || !mapsSnaps.includes(s));
            const combined = [...mapsSnaps, ...chartsSnaps];
            
            if (combined.length === 0) return (
              <div className="mb-8">
                <h3 className="text-base font-bold text-slate-800 border-b border-slate-300 mb-3 pb-1">DICTAMEN TÁCTICO</h3>
                <div className="text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed text-justify">
                  {(editableProfile || aiProfile || "").replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "[$1]")}
                </div>
              </div>
            );
            
            const chunks = [];
            for (let i = 0; i < combined.length; i += 4) chunks.push(combined.slice(i, i + 4));
            
            return (
              <>
                <div className="mb-8">
                  <h3 className="text-base font-bold text-slate-800 border-b border-slate-300 mb-3 pb-1">DICTAMEN TÁCTICO</h3>
                  <div className="text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed text-justify">
                    {(editableProfile || aiProfile || "").replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "[$1]")}
                  </div>
                </div>

                {/* NUEVA PORTADA CAPÍTULO MAPAS Y GRÁFICAS */}
                <div className="html2pdf__page-break"></div>
                <div className="flex flex-col items-center justify-center h-[1040px] bg-slate-50 border-8 border-slate-800 m-4">
                  <h1 className="text-5xl font-black text-slate-900 tracking-widest uppercase mb-4 text-center">Mapas y Gráficas</h1>
                  <div className="w-32 h-2 bg-sky-700 mb-6"></div>
                  <p className="text-xl font-bold text-slate-500 uppercase tracking-widest text-center">Anexo Geoespacial y Algorítmico</p>
                </div>

                {/* CUADRÍCULA DE 4 ELEMENTOS POR PÁGINA */}
                {chunks.map((chunk, cIdx) => (
                  <div key={`chunk-${cIdx}`} className="html2pdf__page-break flex flex-col justify-center h-[1080px] p-8 bg-white">
                    <div className="grid grid-cols-2 grid-rows-2 gap-6 h-full w-full">
                      {Array.from({ length: 4 }).map((_, i) => {
                        const snap = chunk[i];
                        return snap ? (
                          <div key={i} className="border-4 border-slate-800 p-4 rounded-xl flex flex-col h-full bg-slate-50 shadow-sm overflow-hidden">
                            <h4 className="text-[13px] font-black text-slate-800 text-center mb-3 uppercase tracking-wider border-b-2 border-slate-800 pb-2 truncate">{snap.title}</h4>
                            <div className="flex-1 overflow-hidden flex items-center justify-center">
                              <img src={snap.dataUrl} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                            </div>
                          </div>
                        ) : (
                          <div key={i} className="border-4 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center h-full bg-slate-50/50">
                            <span className="text-slate-300 text-sm font-bold uppercase tracking-widest">Espacio Vacío</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            );
          })()}

          {(() => {
            const selectedPhotos = album.filter(p => selectedIds.includes(p.id));
            if (selectedPhotos.length === 0) return null;

            let groups: { title: string; photos: typeof album }[] = [];
            if (project?.geometryType === "lineal") {
              groups = [
                { title: "NODO INICIAL", photos: selectedPhotos.filter((p) => p.tipo === "Nodo Inicial") },
                { title: "CORREDOR", photos: selectedPhotos.filter((p) => p.tipo === "Corredor") },
                { title: "NODO FINAL", photos: selectedPhotos.filter((p) => p.tipo === "Nodo Final") },
                { title: "EVIDENCIA ADICIONAL", photos: selectedPhotos.filter((p) => !["Nodo Inicial", "Corredor", "Nodo Final"].includes(p.tipo)) },
              ];
            } else if (project?.geometryType === "poligono") {
              groups = [
                { title: "PERÍMETRO", photos: selectedPhotos.filter((p) => p.tipo === "Perímetro") },
                { title: "INTERIOR", photos: selectedPhotos.filter((p) => p.tipo === "Interior") },
                { title: "EVIDENCIA ADICIONAL", photos: selectedPhotos.filter((p) => !["Perímetro", "Interior"].includes(p.tipo)) },
              ];
            } else {
              groups = [
                { title: "NODO Y ENTORNO", photos: selectedPhotos }
              ];
            }
            groups = groups.filter((g) => g.photos.length > 0);

            return (
              <>
                <div className="html2pdf__page-break"></div>
                <h3 className="text-base font-bold text-slate-800 border-b border-slate-300 mb-4 pb-1">ANEXO FOTOGRÁFICO Y DE DETERIORO URBANO</h3>
                {groups.map((group, gIdx) => (
                  <div key={gIdx} className="mb-6 break-inside-avoid">
                    <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide border-l-4 border-slate-500 pl-2">{group.title}</h4>
                    <div className="flex flex-col gap-6">
                      {group.photos.map(p => (
                        <div key={p.id} className="border border-slate-300 rounded-lg p-3 break-inside-avoid bg-slate-50">
                          <div className="relative w-full h-40 mb-2 rounded border border-slate-200 overflow-hidden bg-black">
                            <img src={p.previewUrl} alt={`Evidencia ${p.tipo}`} className="w-full h-full object-cover" />
                            {/* Sello de agua en PDF */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10">
                              <span className="text-white/40 font-bold text-3xl -rotate-45 select-none tracking-widest drop-shadow-lg">
                                SSPE-CEIPOL
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-600 mb-1 leading-tight">{p.comentario || "Sin comentario."}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      </div>
    </>
  );
}
