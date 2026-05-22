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
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!splitLayout || typeof document === "undefined") return;
    setPortalTarget(document.getElementById(C4_RIGHT_COLUMN_ID));
  }, [splitLayout]);
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
  const [isListening, setIsListening] = useState(false);
  const [profileRiskLevel, setProfileRiskLevel] = useState<
    "bajo" | "medio" | "alto" | null
  >(null);
  const [analysisPolygon, setAnalysisPolygon] = useState<google.maps.LatLngLiteral[]>([]);
  const [manualPois, setManualPois] = useState<{ lat: number; lng: number; label?: string }[]>([]);
  const [isPreliminaryMapConfirmed, setIsPreliminaryMapConfirmed] = useState(false);
  const [showPreliminaryMap, setShowPreliminaryMap] = useState(false);
  const recognitionRef = useRef<any | null>(null);
  const lastTranscriptRef = useRef<string>("");
  const [visionData, setVisionData] = useState<Record<string, { faces: { count: number; headwear: boolean }; extractedText: string }>>({});
  const [debugData, setDebugData] = useState<any>(null);
  const [showMonitor, setShowMonitor] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docContext, setDocContext] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
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

const remainingPhotos =
  requiredPhotos - currentPhotos;
  const handleOpenConfigModal = () => {
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
      if (mapRes.ok) {
        const mapData = await mapRes.json();
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
          meta?: { riskLevel?: "bajo" | "medio" | "alto" };
        };
        const markdown = data.markdown ?? "";
        setAiProfile(markdown);
        setEditableProfile(markdown);
        setProfileRiskLevel(data.meta?.riskLevel ?? null);
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

  const handleToggleDictation = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(
        "Este navegador no soporta dictado por voz. Use la versión de escritorio o Chrome/Android."
      );
      return;
    }

    try {
      if (!recognitionRef.current) {
        const recognition = new SpeechRecognition();
        recognition.lang = "es-MX";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onerror = (event: any) => {
          console.error("Error en micrófono:", event?.error);
          setIsListening(false);
        };
        recognition.onend = () => {
          // Si el usuario sigue con la intención de dictar, reiniciamos el micrófono
          if (isListening) {
            try {
              recognition.start();
            } catch (e) {
              console.error("Error reiniciando micrófono:", e);
              setIsListening(false);
            }
          } else {
            setIsListening(false);
          }
        };
        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const text = (res[0]?.transcript as string | undefined)?.trim();
            if (!text) continue;
            if (res.isFinal) {
              finalTranscript += text + " ";
            } else {
              interimTranscript += text + " ";
            }
          }

          if (finalTranscript) {
            const normalized = finalTranscript.trim();
            if (!normalized) return;
            // Evitar repetir exactamente la misma frase varias veces
            if (normalized === lastTranscriptRef.current) return;
            lastTranscriptRef.current = normalized;

            setAnalysisContext((prev) =>
              prev ? `${prev.trim()} ${normalized}` : normalized
            );
          }
          // El interimTranscript se puede usar para mostrar texto en vivo si se desea.
        };

        recognitionRef.current = recognition;
      }

      const recognition = recognitionRef.current as any;
      if (isListening) {
        recognition.stop();
      } else {
        lastTranscriptRef.current = "";
        recognition.start();
      }
    } catch (e) {
      console.error("[PhotoAlbum] Error al iniciar reconocimiento de voz:", e);
      setIsListening(false);
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

  const handleExportToWord = async () => {
    const content = editableProfile || aiProfile;
    if (!content) return;
    setError(null);
    let mapDataUrl: string | undefined;
    if (analysisResult) {
      const mapEl = document.getElementById("map-export-container");
      if (mapEl) {
        try {
          const canvas = await html2canvas(mapEl, {
            useCORS: true,
            scale: 1.5,
          });
          mapDataUrl = canvas.toDataURL("image/png");
        } catch (e) {
          console.warn("[PhotoAlbum] No se pudo capturar el mapa para Word:", e);
        }
      }
    }
    const photoUrls = album
      .filter((p) => selectedIds.includes(p.id))
      .map((p) => p.previewUrl)
      .filter((u): u is string => typeof u === "string" && u.length > 0);
    try {
      await exportToWord(
        content,
        "Dictamen_criminologico_ambiental",
        photoUrls.length > 0 ? photoUrls : undefined,
        profileRiskLevel ?? undefined,
        mapDataUrl
      );
    } catch (err) {
      console.error("[PhotoAlbum] Error al exportar a Word:", err);
      setError(
        err instanceof Error ? err.message : "No se pudo generar el documento Word."
      );
    }
  };

  const handleExportToPDF = () => {
    window.print();
  };

  if (album.length === 0) {
    return (
      <section className="card p-6 text-center text-slate-400 text-sm">
        El álbum está vacío. Agregue fotografías desde el bloque de captura.
      </section>
    );
  }

  const rightColumnContent = analysisResult && (
    <div className="space-y-4 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 shadow-2xl rounded-xl p-4">
      <h4 className="text-base font-bold text-sky-200 font-mono tracking-tight">Mapa y gráficas</h4>
      {analysisResult.historicalCrimes && analysisResult.historicalCrimes.length > 0 && (
        <CrimeCharts crimes={analysisResult.historicalCrimes} />
      )}
      <div id="map-export-container" className="rounded-xl border border-slate-700 bg-white text-black overflow-hidden">
        <div className="relative p-0">
          <AnalysisMap
            album={album.filter((p) => selectedIds.includes(p.id))}
            analysisResult={analysisResult}
            analysisRadius={analysisRadius}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={handleDownloadMap}
        className="w-full inline-flex items-center justify-center rounded-md bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-600 transition-colors print:hidden"
      >
        Descargar Mapa Oficial
      </button>
    </div>
  );

  return (
    <>
      <section className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 shadow-2xl rounded-xl p-4 md:p-6 space-y-4">
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
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {album.map((p) => (
          <div
            key={p.id}
            className={`rounded-lg border overflow-hidden bg-slate-900/80 ${
              selectedIds.includes(p.id) ? "border-sky-500 ring-1 ring-sky-500/50" : "border-slate-700"
            }`}
          >
            <div className="flex flex-col">
              <div className="flex items-start gap-1 p-1">
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
                <div className="flex-1 min-w-0 relative">
                  <div className="aspect-square relative rounded overflow-hidden bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.previewUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
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
                  
                  {/* Campo de comentarios (Opcional) - Visible en móvil y PC */}
                  <input
                    type="text"
                    placeholder="Comentario (opcional)..."
                    value={p.comentario}
                    onChange={(e) => updatePhotoMeta(p.id, { tipo: p.tipo, comentario: e.target.value })}
                    className="w-full mt-2 bg-slate-800 text-slate-200 border border-slate-700 rounded-md p-2 text-xs outline-none focus:border-sky-500"
                  />

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
                    value={p.tipo}
                    onChange={(e) =>
                      updatePhotoMeta(p.id, {
                        tipo: e.target.value,
                        comentario: p.comentario,
                      })
                    }
                    className="w-full mt-2 bg-gray-800 text-gray-200 border border-gray-600 rounded-md p-1 text-sm outline-none focus:border-blue-500 hidden md:block"
                  >
                    <option value="">Selecciona clasificación...</option>
                    <option value="Escuela / Entorno Educativo">
                      Escuela / Entorno Educativo
                    </option>
                    <option value="Templo / Centro Religioso">
                      Templo / Centro Religioso
                    </option>
                    <option value="Comercio / Negocio">
                      Comercio / Negocio
                    </option>
                    <option value="Terreno Baldío / Abandono">
                      Terreno Baldío / Abandono
                    </option>
                    <option value="Vivienda">Vivienda</option>
                    <option value="Vía Pública / Callejón">
                      Vía Pública / Callejón
                    </option>
                    <option value="Rostro / Persona de Interés">
                      Rostro / Persona de Interés
                    </option>
                    <option value="Placa Vehicular / Número Económico">
                      Placa Vehicular / Número Económico
                    </option>
                    <option value="Otro">Otro</option>
                  </select>
                  <p className="text-[9px] font-mono tracking-tight text-blue-300">
                    {p.lat != null && p.lng != null && !Number.isNaN(p.lat) && !Number.isNaN(p.lng)
                      ? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`
                      : "Sin GPS"}
                  </p>
                </div>
              </div>
          </div>
          </div>
        ))}
      </div>

      {/* ANEXOS DOCUMENTALES */}
      <div className="pt-6 mt-4 border-t border-slate-800 space-y-4 print:hidden">
        <header className="space-y-1">
          <h4 className="text-base font-semibold text-slate-200">Anexos Documentales (PDF, Excel, Videos)</h4>
          <p className="text-xs text-slate-400">Adjunte archivos adicionales de inteligencia (se omite del análisis geográfico automático, pero quedan en el expediente). <strong className="text-amber-400">Obligatorio contextualizar.</strong></p>
        </header>
        <div className="flex flex-col md:flex-row gap-4 items-start">
          <div className="w-full md:w-1/2 space-y-3 p-5 bg-slate-800/40 rounded-lg border border-slate-700">
            <input id="doc-upload-input" type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="text-sm text-slate-300 w-full file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-sky-900 file:text-sky-200 hover:file:bg-sky-800" accept=".pdf,.xls,.xlsx,.doc,.docx,.mp4,.avi,.mkv" />
            <textarea value={docContext} onChange={(e) => setDocContext(e.target.value)} placeholder="Contexto, justificación o descripción del documento (Obligatorio)..." className="w-full bg-slate-900 text-slate-200 border border-slate-600 rounded-md p-3 text-sm outline-none focus:border-sky-500 min-h-[100px]" />
            <button type="button" disabled={!docFile || !docContext.trim() || isUploadingDoc} onClick={async () => {
              if (!docFile || !docContext.trim()) return;
              setIsUploadingDoc(true);
              setError(null);
              try {
                await uploadDocument(docFile, docContext);
                setDocFile(null);
                setDocContext("");
                const fileInput = document.getElementById("doc-upload-input") as HTMLInputElement;
                if (fileInput) fileInput.value = "";
              } catch (e: any) {
                setError("Error al subir documento: " + e.message);
              } finally {
                setIsUploadingDoc(false);
              }
            }} className="w-full bg-sky-700 hover:bg-sky-600 text-white py-1.5 px-4 rounded text-xs font-semibold disabled:opacity-50 transition">
              {isUploadingDoc ? "Subiendo Anexo..." : "Subir Anexo Contextualizado"}
            </button>
          </div>
          <div className="w-full md:w-1/2 space-y-2">
            {documents && documents.length > 0 ? documents.map(d => (
              <div key={d.id} className="p-2 bg-slate-800/60 rounded border border-slate-700 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline font-semibold text-[11px] truncate flex-1" title={d.name}>📄 {d.name}</a>
                  <button onClick={() => removeDocument(d.id)} className="text-red-400 hover:text-red-300 text-[10px] shrink-0">Eliminar</button>
                </div>
                <p className="text-[10px] text-slate-300 bg-slate-900 p-1.5 rounded">{d.context}</p>
              </div>
            )) : (
              <div className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-700 rounded-lg">No hay anexos documentales en este expediente.</div>
            )}
          </div>
        </div>
      </div>
      {/* FIN ANEXOS DOCUMENTALES */}

      <div className="pt-4 border-t border-slate-800 space-y-2 hidden md:block print:hidden">
        <button
          type="button"
          onClick={handleOpenConfigModal}
          disabled={isGeneratingAI || selectedIds.length === 0}
          className="w-full inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGeneratingAI ? (
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
              Procesando inteligencia... Por favor espere
            </>
          ) : aiProfile ? (
            "Análisis Generado"
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

      {analysisResult && (
        <div className="space-y-4 pt-4 border-t-2 border-sky-500/50 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-xl p-4">
          <h4 className="text-lg font-bold text-sky-200 tracking-tight">
            Análisis Espacial y Estadístico
          </h4>
          {!splitLayout && (
            <>
              {analysisResult.historicalCrimes && analysisResult.historicalCrimes.length > 0 && (
                <CrimeCharts crimes={analysisResult.historicalCrimes} />
              )}
              <div id="map-export-container" className="mt-3 rounded-xl border border-slate-700 bg-white text-black overflow-hidden">
                <div className="relative p-0">
                  <AnalysisMap
                    album={album.filter((p) => selectedIds.includes(p.id))}
                    analysisResult={analysisResult}
                    analysisRadius={analysisRadius}
                    analysisPolygon={analysisPolygon}
                    setAnalysisPolygon={setAnalysisPolygon}
                    manualPois={manualPois}
                    setManualPois={setManualPois}
                    isPreliminary={false}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setIsPreliminaryMapConfirmed(true)}
                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors print:hidden"
                >
                  Confirmar perímetro y analizar
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMap}
                  className="inline-flex items-center justify-center rounded-md bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-600 transition-colors print:hidden"
                >
                  Descargar Mapa Oficial
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {aiProfile && (
        <div className="space-y-3 pt-4 border-t-2 border-indigo-500/60 bg-slate-900/70 rounded-xl p-4">
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
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-200">
              Dictamen editable por el analista
            </label>
            <textarea
              value={editableProfile}
              onChange={(e) => setEditableProfile(e.target.value)}
              className="w-full min-h-[70vh] md:min-h-[800px] bg-slate-900 text-slate-100 border border-slate-700 rounded-lg p-6 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y shadow-inner"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1 print:hidden">
            {projectId && (
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
        </div>
      )}

      {showConfigModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 px-6 py-8 space-y-5 my-auto">
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
                          <textarea
                            placeholder="Especifique otros objetivos prioritarios del análisis..."
                            value={analysisContextExtra ?? ""}
                            onChange={(e) => setAnalysisContextExtra(e.target.value)}
                            className="mt-2 w-full rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            rows={3}
                          />
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
                    onClick={handleToggleDictation}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold border ${
                      isListening
                        ? "border-red-500 text-red-300 bg-red-900/40"
                        : "border-slate-600 text-slate-200 bg-slate-900"
                    }`}
                  >
                    <span aria-hidden="true">🎙️</span>
                    <span>{isListening ? "Escuchando…" : "Dictar contexto"}</span>
                  </button>
                </div>
                <textarea
                  value={analysisContext}
                  onChange={(e) => setAnalysisContext(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 px-4 py-3 text-base resize-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ejemplo: Posible corredor de riesgo entre polígono habitacional y zona de bares, con vulnerabilidad en rutas peatonales sin vigilancia..."
                />
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsRefining(true);
                      setAiSuggestions("");
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
                          }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setAiSuggestions(data.suggestions ?? "");
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
                    <p className="font-semibold mb-1">Sugerencias de IA:</p>
                    <p className="whitespace-pre-wrap">{aiSuggestions}</p>
                    <p className="mt-1 text-[10px] text-yellow-300/80">
                      Revise estas ideas y, si lo considera útil, incorpórelas
                      en su contexto antes de ejecutar el análisis final.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAiSuggestions("");
                        }}
                        className="rounded-md border border-red-800 bg-red-900/50 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-800/50"
                      >
                        Ignorar Sugerencia
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAnalysisContext((prev) => (prev ? `${prev}\n\n${aiSuggestions}` : aiSuggestions));
                          setAiSuggestions("");
                        }}
                        className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600"
                      >
                        Aplicar 100%
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAnalysisContext(aiSuggestions);
                          setAiSuggestions("");
                        }}
                        className="rounded-md bg-sky-700 px-2 py-1 text-xs font-medium text-white hover:bg-sky-600"
                      >
                        Editar Sugerencia
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
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => void confirmAndGenerateProfile()}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Comenzar Análisis
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
      {portalTarget && rightColumnContent && createPortal(rightColumnContent, portalTarget)}
    </>
  );
}
