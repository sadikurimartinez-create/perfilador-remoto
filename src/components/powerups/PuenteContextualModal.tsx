"use client";

import React, { useState, useEffect } from "react";
import { PowerUpConfig, PowerUpState } from "./powerups.types";
import { POWER_UPS_CONFIG } from "./powerups.config";

import { PowerUpExecutionResultData } from "./VentanaResultadosPuente";

interface PuenteContextualModalProps {
  isOpen: boolean;
  onClose: () => void;
  insumoText: string;
  insumoType: string;
  insumoName: string;
  locationCoords?: { lat: number; lng: number };
  onApplyAnalysis: (appliedTexts: string[]) => void;
  coords?: { x: number; y: number } | null;
  onApplyDetailedAnalysis?: (results: PowerUpExecutionResultData[]) => void;
}

// Interface for parsed context
interface AnalysisResult {
  detectedEntities: string[];
  detectedObjects: string[];
  detectedPlaces: string[];
  detectedActivities: string[];
  riskLevel: "Bajo" | "Medio" | "Alto";
  scoring: Record<string, number>;
  primaryPuId: string;
  secondaryPuIds: string[];
  explanations: Record<string, { detection: string; action: string; objective: string }>;
  copilotComment: string;
  warnings: string[];
}

export function analyzeInsumoContext(text: string, type: string, coords?: { lat: number; lng: number }): AnalysisResult {
  const t = text.toLowerCase();
  
  const detectedEntities: string[] = [];
  const detectedObjects: string[] = [];
  const detectedPlaces: string[] = [];
  const detectedActivities: string[] = [];
  const warnings: string[] = [];
  
  // 1. Entity Parsing
  if (t.includes("alias") || t.includes("apodo")) {
    const match = text.match(/(?:alias|apodo)\s+["'“]?([^"'“.,;\s]+(?: [^"'“.,;\s]+)?)/i);
    detectedEntities.push(match ? `Alias "${match[1]}"` : "Alias delictivo");
  }
  if (t.includes("sujeto") || t.includes("sospechoso") || t.includes("testigo")) {
    detectedEntities.push("Actor sospechoso");
  }
  if (t.includes("cártel") || t.includes("cartel") || t.includes("banda") || t.includes("pandilla")) {
    detectedEntities.push("Grupo organizado");
  }
  if (detectedEntities.length === 0) {
    detectedEntities.push("Extracción NLP activa");
  }

  // 2. Objects Parsing
  if (t.includes("placa") || t.includes("matrícula") || t.includes("repuve")) {
    detectedObjects.push("Placa vehicular");
  }
  if (t.includes("vehículo") || t.includes("auto") || t.includes("carro") || t.includes("camioneta") || t.includes("moto")) {
    detectedObjects.push("Vehículo sospechoso");
  }
  if (t.includes("arma") || t.includes("pistola") || t.includes("rifle") || t.includes("fuego") || t.includes("casquillo")) {
    detectedObjects.push("Armamento/Fuego");
  }
  if (t.includes("fachada") || t.includes("puerta") || t.includes("letrero") || t.includes("cámara") || t.includes("video")) {
    detectedObjects.push("Detalle de fachada");
  }
  if (detectedObjects.length === 0) {
    detectedObjects.push("Indicios físicos");
  }

  // 3. Places Parsing
  if (t.includes("cantina") || t.includes("bar") || t.includes("antro") || t.includes("alcohol")) {
    detectedPlaces.push("Establecimiento de riesgo");
  }
  if (t.includes("calle") || t.includes("colonia") || t.includes("esquina") || t.includes("avenida") || t.includes("domicilio")) {
    detectedPlaces.push("Dirección vial");
  }
  if (t.includes("coordenadas") || t.includes("gps") || coords) {
    detectedPlaces.push("Ubicación de interés");
  }
  if (detectedPlaces.length === 0) {
    detectedPlaces.push("Punto territorial general");
  }

  // 4. Activities Parsing
  if (t.includes("disparo") || t.includes("balacera") || t.includes("ejecut") || t.includes("homicidio") || t.includes("muerte")) {
    detectedActivities.push("Actividad de alto impacto");
  }
  if (t.includes("venta") || t.includes("droga") || t.includes("narco") || t.includes("cristal") || t.includes("dosis")) {
    detectedActivities.push("Narcomenudeo");
  }
  if (t.includes("desaparecido") || t.includes("rnpdno") || t.includes("privado") || t.includes("secuestro") || t.includes("levant")) {
    detectedActivities.push("Desaparición/Secuestro");
  }
  if (t.includes("reunión") || t.includes("junta") || t.includes("vigilancia") || t.includes("halcón")) {
    detectedActivities.push("Vigilancia/Halconeo");
  }
  if (detectedActivities.length === 0) {
    detectedActivities.push("Incidente operativo");
  }

  // 5. Risk Calculation
  let riskScore = 0;
  if (t.includes("arma") || t.includes("fuego") || t.includes("homicidio") || t.includes("cartel") || t.includes("disparo")) riskScore += 3;
  if (t.includes("droga") || t.includes("desaparecido") || t.includes("secuestro") || t.includes("violencia")) riskScore += 2;
  if (t.includes("vehículo") || t.includes("calle") || t.includes("cantina")) riskScore += 1;
  
  const riskLevel = riskScore >= 4 ? "Alto" : riskScore >= 2 ? "Medio" : "Bajo";

  // 6. Base Scoring
  const scores: Record<string, number> = {
    analizar_imagen: 45,
    analizar_audio: 35,
    analisis_ubicacion: 50,
    detectar_entidades: 55,
    buscar_inteligencia: 60
  };

  // Adjust by context type
  if (type === "photo") {
    scores.analizar_imagen += 40;
    scores.analisis_ubicacion += 25;
  } else if (type === "document_pending" || type === "document_upload") {
    scores.detectar_entidades += 30;
    scores.buscar_inteligencia += 20;
  } else if (type === "hypothesis") {
    scores.buscar_inteligencia += 35;
    scores.detectar_entidades += 20;
  }

  // Keywords boosts
  if (t.includes("imagen") || t.includes("foto") || t.includes("pdf") || t.includes("placa") || t.includes("fachada") || t.includes("objeto")) {
    scores.analizar_imagen += 25;
  }
  if (t.includes("audio") || t.includes("llamada") || t.includes("grabación") || t.includes("voz") || t.includes("escucha")) {
    scores.analizar_audio += 45;
  }
  if (t.includes("calle") || t.includes("colonia") || t.includes("avenida") || t.includes("coordenadas") || coords || t.includes("cantina") || t.includes("bar")) {
    scores.analisis_ubicacion += 35;
  }
  if (t.includes("persona") || t.includes("alias") || t.includes("apodo") || t.includes("sujeto") || t.includes("nombre")) {
    scores.detectar_entidades += 30;
  }
  if (t.includes("inteligencia") || t.includes("osint") || t.includes("historial") || t.includes("antecedente") || t.includes("modus")) {
    scores.buscar_inteligencia += 25;
  }

  // Cap scores between 15 and 98%
  Object.keys(scores).forEach(k => {
    scores[k] = Math.min(Math.max(Math.floor(scores[k]), 15), 98);
  });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primaryPuId = sorted[0][0];
  const secondaryPuIds = sorted.slice(1).map(x => x[0]);

  const explanations: Record<string, { detection: string; action: string; objective: string }> = {
    analizar_imagen: {
      detection: t.includes("placa") || t.includes("vehículo") 
        ? "Se identificaron indicios de tránsito vehicular o matrículas." 
        : "Insumo de tipo gráfico o visual documentado.",
      action: "Ejecución de OCR Multimodal e Indexación de Objetos en Escena.",
      objective: "Identificar matrículas de vehículos, logotipos y letreros urbanos legibles en la foto."
    },
    analizar_audio: {
      detection: t.includes("llamada") || t.includes("voz") 
        ? "Menciones a testimonios orales, llamadas o grabaciones." 
        : "Evidencia de audio o escuchas en el expediente.",
      action: "Speech-to-Text v2, diarización por oradores e identificación de estado emocional.",
      objective: "Trascripción literal de audio con detección de picos de tensión y miedo."
    },
    analisis_ubicacion: {
      detection: coords 
        ? `Coordenadas activas (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}).` 
        : t.includes("cantina") 
          ? "Se detectaron puntos de interés comerciales / cantinas de riesgo." 
          : "Mención de vialidades o asentamientos.",
      action: "Búsqueda geoespacial ST_DWithin y grounding territorial.",
      objective: "Identificar incidencia delictiva local, denuncias previas y noticias georreferenciadas."
    },
    detectar_entidades: {
      detection: t.includes("alias") 
        ? "Se detectó el uso de alias, apodos u organizaciones delictivas." 
        : "Presencia de actores, alias o puntos de reunión en el texto.",
      action: "Aislamiento NLP (Vertex AI) de Personas, Alias, Lugares y Organizaciones.",
      objective: "Crear un inventario estructurado de actores para el grafo de vínculos de la carpeta."
    },
    buscar_inteligencia: {
      detection: t.includes("modus") || t.includes("historial") 
        ? "Referencias a modus operandi reiterativo." 
        : "Requerimiento de cruce histórico OSINT.",
      action: "Búsqueda Semántica Vectorial (RAG) en repositorios OSINT y manuales de prevención.",
      objective: "Contrastar el caso actual con modus operandi del pasado y sugerir lecciones preventivas."
    }
  };

  // Warning calculations
  if (!coords && scores.analisis_ubicacion > 65) {
    warnings.push("Falta georreferencia explícita en el insumo. La correlación espacial de ubicación usará un radio genérico amplio sobre nombres de vialidades de texto, reduciendo la precisión.");
  }
  if (text.trim().length < 30) {
    warnings.push("La narrativa actual es muy corta. Se recomienda ampliar la contextualización (óptimo > 50 caracteres) para que la IA extraiga entidades y antecedentes de manera óptima.");
  }

  // Copilot interactive message
  let copilotComment = "";
  if (primaryPuId === "analizar_imagen") {
    copilotComment = "El Asistente opina: He detectado indicios visuales sustanciales en tu descripción. Recomiendo priorizar 'Analizar Imagen' para aislar matrículas o detalles físicos y digitalizar textos relevantes.";
  } else if (primaryPuId === "analisis_ubicacion") {
    copilotComment = "El Asistente opina: Hay una fuerte connotación territorial o de establecimientos. Trazar un radio configurable con 'Análisis de Ubicación' es clave para identificar incidencia delictiva circundante.";
  } else if (primaryPuId === "detectar_entidades") {
    copilotComment = "El Asistente opina: He aislado referencias a personas, alias o grupos. 'Detectar Personas y Lugares' es ideal para estructurar estos nodos y alimentar automáticamente tus redes de vínculos.";
  } else {
    copilotComment = "El Asistente opina: Para robustecer esta hipótesis de campo, la 'Búsqueda de Inteligencia' es óptima. Buscará patrones criminales idénticos en bases de datos OSINT y casos análogos del pasado.";
  }

  return {
    detectedEntities,
    detectedObjects,
    detectedPlaces,
    detectedActivities,
    riskLevel,
    scoring: scores,
    primaryPuId,
    secondaryPuIds,
    explanations,
    copilotComment,
    warnings
  };
}

export function PuenteContextualModal({
  isOpen,
  onClose,
  insumoText,
  insumoType,
  insumoName,
  locationCoords,
  onApplyAnalysis,
  coords,
  onApplyDetailedAnalysis
}: PuenteContextualModalProps) {
  const [activeTab, setActiveTab] = useState<"sugerido" | "manual">("sugerido");
  const [selectedPuIds, setSelectedPuIds] = useState<string[]>([]);
  
  // Editable parameters
  const [searchRadius, setSearchRadius] = useState(500);
  const [analysisPriority, setAnalysisPriority] = useState<"Baja" | "Media" | "Alta">("Media");
  const [catalogTypes, setCatalogTypes] = useState<Record<string, boolean>>({
    personas: true,
    vehiculos: true,
    alias: true,
    establecimientos: true
  });
  const [extraContext, setExtraContext] = useState("");

  // Running Processing Overlay
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [processingPercent, setProcessingStepPercent] = useState(0);

  const analysis = React.useMemo(() => {
    return analyzeInsumoContext(insumoText || "", insumoType, locationCoords);
  }, [insumoText, insumoType, locationCoords]);

  // Set default selection based on analyzed primary
  useEffect(() => {
    if (isOpen) {
      setSelectedPuIds([analysis.primaryPuId]);
      setIsProcessing(false);
      setProcessingStep("");
      setProcessingStepPercent(0);
    }
  }, [isOpen, analysis.primaryPuId]);

  if (!isOpen) return null;

  const primaryPu = POWER_UPS_CONFIG.find(p => p.id === analysis.primaryPuId);
  const primaryExpl = analysis.explanations[analysis.primaryPuId];

  const handleToggleSelectPu = (id: string) => {
    setSelectedPuIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const executePipeline = () => {
    if (selectedPuIds.length === 0) {
      alert("Por favor, seleccione al menos un PowerUp para ejecutar.");
      return;
    }

    setIsProcessing(true);
    setProcessingStepPercent(5);
    setProcessingStep("Fase 1: Inicializando Puente Contextual de Inteligencia...");

    // Stage 1: Reading and parsing context
    setTimeout(() => {
      setProcessingStepPercent(30);
      setProcessingStep("Fase 2: Extrayendo indicios tácticos y mapeando entidades NLP...");
    }, 1000);

    // Stage 2: Simulating GIS queries or OSINT database grounding
    setTimeout(() => {
      setProcessingStepPercent(65);
      setProcessingStep(
        selectedPuIds.includes("analisis_ubicacion")
          ? `Fase 3: Ejecutando consulta espacial ST_DWithin en radio de ${searchRadius} metros...`
          : "Fase 3: Consultando bases OSINT y repositorios de incidencia histórica..."
      );
    }, 2200);

    // Stage 3: Injecting prompt attributes
    setTimeout(() => {
      setProcessingStepPercent(90);
      setProcessingStep("Fase 4: Consolidando hipótesis digital y estructurando logs de trazabilidad...");
    }, 3600);

    // Stage 4: Execution Completed!
    setTimeout(() => {
      setProcessingStepPercent(100);
      setIsProcessing(false);

      // Generate results text
      const resultSnippets = selectedPuIds.map(id => {
        const config = POWER_UPS_CONFIG.find(p => p.id === id);
        let paramSnippet = "";
        if (id === "analisis_ubicacion") {
          paramSnippet = ` [Configuración: Radio de consulta ${searchRadius}m, Prioridad: ${analysisPriority}]`;
        } else if (id === "detectar_entidades") {
          const catStr = Object.entries(catalogTypes)
            .filter(([_, v]) => v)
            .map(([k]) => k.toUpperCase())
            .join(", ");
          paramSnippet = ` [Estructuración: Catalogar ${catStr || "TODOS"}]`;
        }
        
        const extraNote = extraContext.trim() ? `\n   - Contexto Adicional Táctico: "${extraContext.trim()}"` : "";

        return `\n👉 POWERUP APLICADO: **${config?.title}**\n   - Proceso IA: ${config?.technicalText}${paramSnippet}${extraNote}\n   - Impacto del Expediente: ${config?.fileImpact}`;
      });

      // Generate structured detailed results for audit sync
      const detailedResults: PowerUpExecutionResultData[] = selectedPuIds.map(id => {
        const config = POWER_UPS_CONFIG.find(p => p.id === id);
        
        // Generate simulated findings or summaries based on text and parameters
        let summaryText = "";
        let correlations: string[] = [];
        let entitiesFound: string[] = [];
        
        if (id === "analisis_ubicacion") {
          summaryText = `Análisis espacial completado con éxito en un radio de ${searchRadius}m. Se detectó una densidad delictiva media-alta en las inmediaciones de la vía referenciada, con correlación a carpetas previas por robo a comercio y narcomenudeo. Se recomienda patrullaje preventivo nocturno.`;
          correlations = ["Correlación con Carpeta CI-2025/4892 (Robo)", "Cercanía a 3 expendios de alcohol registrados"];
        } else if (id === "detectar_entidades") {
          summaryText = `Extracción NLP completada. Se aislaron actores y apodos relevantes del texto. El grafo de vínculos de la zona se ha enriquecido con un nuevo nodo sospechoso.`;
          entitiesFound = ["Sujeto referenciado como Alias 'El Cholo'", "Banda local 'Los de la 14'"];
        } else if (id === "analizar_imagen") {
          summaryText = `OCR Multimodal finalizado. Se extrajo texto de la imagen con un 98% de confianza. Se identificaron indicios vehiculares (placas legibles) y fachada de riesgo comercial.`;
          entitiesFound = ["Placa vehicular: ABC-123-X", "Establecimiento: Bar 'La Oficina'"];
        } else {
          summaryText = `Búsqueda semántica OSINT completada. Cruce de modus operandi arrojó coincidencia del 94% con incidentes registrados en el sector poniente durante el último bimestre.`;
          correlations = ["Cruce con Carpeta Sector Poniente v3", "Antecedentes OSINT de halconeo registrados"];
        }

        if (extraContext.trim()) {
          summaryText += `\n\nDirectriz adicional del analista considerada: "${extraContext.trim()}"`;
        }

        return {
          insumoId: "", // Will be assigned by parent
          insumoName: insumoName,
          insumoText: insumoText,
          powerUpId: id,
          powerUpTitle: config?.title || "Análisis",
          powerUpIcon: config?.icon || "⚡",
          detectedEntities: analysis.detectedEntities,
          detectedObjects: analysis.detectedObjects,
          detectedPlaces: analysis.detectedPlaces,
          detectedActivities: analysis.detectedActivities,
          riskLevel: analysis.riskLevel,
          analysisPerformed: config?.technicalText || "",
          userValidation: {
            searchRadius: id === "analisis_ubicacion" ? searchRadius : undefined,
            analysisPriority: analysisPriority,
            catalogTypes: id === "detectar_entidades" ? catalogTypes : undefined,
            extraContext: extraContext.trim() || undefined,
            finalText: `\n👉 POWERUP APLICADO: **${config?.title}**\n   - Proceso IA: ${config?.technicalText}`
          },
          finalFindings: {
            entitiesFound: entitiesFound.length > 0 ? entitiesFound : undefined,
            correlations: correlations.length > 0 ? correlations : undefined,
            summary: summaryText
          },
          timestamp: new Date().toLocaleTimeString("es-MX", { hour12: false }) + " " + new Date().toLocaleDateString("es-MX")
        };
      });

      if (onApplyDetailedAnalysis) {
        onApplyDetailedAnalysis(detailedResults);
      }

      onApplyAnalysis(resultSnippets);
      onClose();
    }, 4500);
  };

  const getFloatingStyle = () => {
    if (!coords) return {};
    let top = coords.y + 15;
    let left = coords.x + 15;
    if (typeof window !== "undefined") {
      const modalWidth = 672; // max-w-2xl is 672px
      const modalHeight = 650; 
      if (left + modalWidth > window.innerWidth) {
        left = window.innerWidth - modalWidth - 25;
      }
      if (top + modalHeight > window.innerHeight) {
        top = window.innerHeight - modalHeight - 25;
      }
    }
    return {
      position: "fixed" as const,
      top: `${Math.max(15, top)}px`,
      left: `${Math.max(15, left)}px`,
      transform: "none",
      margin: "0",
    };
  };

  return (
    <>
      {/* Fullscreen processing blocker for UI block execution */}
      {isProcessing && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[500] flex flex-col items-center justify-center text-center p-6 select-none animate-fadeIn">
          {/* Tactical radar spinner */}
          <div className="relative w-44 h-44 mb-8 flex items-center justify-center">
            {/* Green glowing outer radar line */}
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-pulse"></div>
            <div className="absolute inset-4 rounded-full border border-emerald-500/10"></div>
            <div className="absolute inset-10 rounded-full border border-emerald-500/5"></div>
            
            {/* Radar Sweeper */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/20 via-transparent to-transparent animate-spin shrink-0" style={{ animationDuration: "3s" }} />

            {/* Inner tactical content */}
            <div className="z-10 flex flex-col items-center">
              <span className="text-3xl animate-bounce">⚡</span>
              <span className="text-[10px] font-mono text-emerald-400 mt-2 font-bold tracking-widest animate-pulse">
                PERFILANDO IA
              </span>
            </div>
          </div>

          <div className="max-w-md space-y-4">
            <h5 className="text-base font-bold text-slate-100 uppercase tracking-wider">
              El Perfilador está procesando inteligencia operativa…
            </h5>
            
            {/* Loader active step explanation */}
            <p className="text-xs text-slate-300 font-mono bg-black/40 border border-slate-800 p-3 rounded-lg min-h-[50px] flex items-center justify-center leading-relaxed">
              {processingStep}
            </p>

            {/* Progress bar percentage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Progreso Técnico</span>
                <span className="text-emerald-400 font-bold">{processingPercent}%</span>
              </div>
              <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  style={{ width: `${processingPercent}%` }}
                />
              </div>
            </div>
            
            <p className="text-[10px] text-slate-500 italic">
              Bloqueo de seguridad activo. Por favor, no cierre esta ventana mientras el motor de decisiones procesa la evidencia.
            </p>
          </div>
        </div>
      )}

      {/* Main Modal Backdrop Container */}
      <div 
        className="fixed inset-0 bg-black/5 backdrop-blur-[1px] z-[300] animate-fadeIn"
        onClick={onClose}
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          style={getFloatingStyle()}
          className="bg-slate-950 border border-slate-800/80 rounded-2xl w-full max-w-2xl p-5 shadow-2xl relative flex flex-col max-h-[92vh] overflow-y-auto gap-4 scrollbar-thin"
        >
        {/* Top styling bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-900 pb-3 mt-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xl shadow-lg shrink-0">
              🔗
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                  Puente Contextual Activo
                </span>
                <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                  Sugerencia IA
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-100 mt-0.5 uppercase tracking-wide">
                Puente de Inteligencia Operativa ({insumoName})
              </h4>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors text-xl font-bold p-1 leading-none"
          >
            ×
          </button>
        </div>

        {/* Sub-header: Insumo Text Preview */}
        <div className="bg-slate-900/30 border border-slate-900 p-3 rounded-lg space-y-1 text-left">
          <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase">
            <span>Insumo Contextualizado:</span>
            <span className="text-indigo-400 font-mono text-[8px] bg-indigo-950/40 px-1.5 py-0.2 rounded border border-indigo-900/30">
              ID: {insumoType.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 italic line-clamp-2 leading-relaxed">
            "{insumoText || "Falta descripción o comentario de contextualización para este insumo."}"
          </p>
        </div>

        {/* SECTION 1: DETECCIÓN AUTOMÁTICA DE CONTEXTO */}
        <div className="space-y-2 text-left bg-slate-900/20 border border-slate-900 p-3.5 rounded-xl">
          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>🧠</span> 1. Análisis de Contexto del Insumo:
          </h5>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="bg-slate-950/50 p-2 rounded border border-slate-900">
              <span className="text-[9px] text-slate-500 block font-semibold">📦 OBJETOS DETECTADOS</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {analysis.detectedObjects.map((o, idx) => (
                  <span key={idx} className="text-[10px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded font-medium border border-slate-800">
                    {o}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="bg-slate-950/50 p-2 rounded border border-slate-900">
              <span className="text-[9px] text-slate-500 block font-semibold">📍 LUGARES CLAVE</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {analysis.detectedPlaces.map((p, idx) => (
                  <span key={idx} className="text-[10px] text-sky-300 bg-sky-950/20 px-2 py-0.5 rounded font-medium border border-sky-900/20">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/50 p-2 rounded border border-slate-900">
              <span className="text-[9px] text-slate-500 block font-semibold">👤 ACTORES / ENTIDADES</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {analysis.detectedEntities.map((e, idx) => (
                  <span key={idx} className="text-[10px] text-amber-300 bg-amber-950/20 px-2 py-0.5 rounded font-medium border border-amber-900/20">
                    {e}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/50 p-2 rounded border border-slate-900">
              <span className="text-[9px] text-slate-500 block font-semibold">⚡ ACTIVIDAD SOSPECHOSA</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {analysis.detectedActivities.map((a, idx) => (
                  <span key={idx} className="text-[10px] text-purple-300 bg-purple-950/20 px-2 py-0.5 rounded font-medium border border-purple-900/20">
                    {a}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/50 p-2 rounded border border-slate-900">
              <span className="text-[9px] text-slate-500 block font-semibold">🚨 NIVEL DE RIESGO IA</span>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                  analysis.riskLevel === "Alto" ? "bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.15)] animate-pulse" :
                  analysis.riskLevel === "Medio" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    analysis.riskLevel === "Alto" ? "bg-red-500" :
                    analysis.riskLevel === "Medio" ? "bg-amber-500" : "bg-emerald-500"
                  }`} />
                  Riesgo {analysis.riskLevel}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/50 p-2 rounded border border-slate-900 flex flex-col justify-center">
              <span className="text-[9px] text-slate-500 block font-semibold">🗺️ GEORREFERENCIA</span>
              <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                {locationCoords ? `Lat: ${locationCoords.lat.toFixed(4)}, Lng: ${locationCoords.lng.toFixed(4)}` : "❌ Sin coordenadas GPS"}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: MOTOR DE RECOMENDACIÓN Y SCORING */}
        <div className="space-y-3.5 text-left">
          {/* Tab Selector for Recommendation Mode */}
          <div className="flex border-b border-slate-900">
            <button
              type="button"
              onClick={() => {
                setActiveTab("sugerido");
                setSelectedPuIds([analysis.primaryPuId]);
              }}
              className={`pb-2 px-4 text-xs font-bold transition-all border-b-2 ${
                activeTab === "sugerido"
                  ? "border-indigo-500 text-indigo-400 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              🧠 Recomendación IA (Sugerido)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("manual")}
              className={`pb-2 px-4 text-xs font-bold transition-all border-b-2 ${
                activeTab === "manual"
                  ? "border-indigo-500 text-indigo-400 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              🛠️ Selección Libre (Multiselección Combinable)
            </button>
          </div>

          {activeTab === "sugerido" ? (
            <div className="space-y-3">
              {/* Highlight Primary Powerup */}
              {primaryPu && (
                <div className="bg-indigo-950/15 border-2 border-indigo-500/30 rounded-xl p-4 shadow-lg space-y-3 relative overflow-hidden">
                  <div className="absolute top-2 right-3 flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
                    💡 Recomendado Principal ({analysis.scoring[primaryPu.id]}%)
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl shadow-inner shrink-0">
                      {primaryPu.icon}
                    </div>
                    <div>
                      <h6 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                        {primaryPu.title}
                      </h6>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {primaryPu.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Operational explainers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] pt-1 border-t border-slate-900/80">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-500 block font-bold">🔎 QUÉ DETECTÓ LA IA:</span>
                      <p className="text-slate-300 font-semibold leading-relaxed">
                        {primaryExpl?.detection}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-500 block font-bold">🧠 QUÉ HARÁ ESTE POWERUP:</span>
                      <p className="text-slate-300 leading-relaxed font-mono">
                        {primaryExpl?.action}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-950/50 p-2.5 rounded border border-slate-900 text-[11px] space-y-0.5">
                    <span className="text-[9px] text-slate-500 block font-bold">⚙️ OBJETIVO ANALÍTICO:</span>
                    <p className="text-indigo-300 font-medium">
                      🎯 {primaryExpl?.objective}
                    </p>
                  </div>
                </div>
              )}

              {/* Secondary powerups listed with scoring bar */}
              <div className="space-y-2 bg-slate-900/10 border border-slate-900 p-3 rounded-xl">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  📊 Nivel de recomendación estimado por IA (Scoring de Relevancia):
                </span>
                
                <div className="space-y-2.5">
                  {POWER_UPS_CONFIG.map(pu => {
                    const score = analysis.scoring[pu.id];
                    const isPrimary = pu.id === analysis.primaryPuId;
                    
                    return (
                      <div key={pu.id} className="flex items-center gap-3 text-xs">
                        <span className="text-base shrink-0 w-5 text-center">{pu.icon}</span>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[10.5px]">
                            <span className="font-bold text-slate-200">
                              {pu.title} {isPrimary && <span className="text-[8.5px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1 py-0.2 rounded font-sans ml-1 font-semibold uppercase">Sugerido</span>}
                            </span>
                            <span className={`font-mono font-bold ${isPrimary ? "text-indigo-400" : score > 70 ? "text-emerald-400" : "text-slate-400"}`}>
                              {score}/100
                            </span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                isPrimary ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" :
                                score > 70 ? "bg-emerald-500" : "bg-slate-700"
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Manual multi-selection free combinable mode */
            <div className="space-y-3">
              <div className="bg-slate-900/20 border border-slate-900 p-3 rounded-lg text-[10px] text-slate-400">
                💡 <strong className="text-slate-200">Modo Combinable:</strong> Selecciona uno o más PowerUps que quieras ejecutar juntos en este mismo insumo. El sistema fusionará el análisis.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {POWER_UPS_CONFIG.map(pu => {
                  const score = analysis.scoring[pu.id];
                  const isSelected = selectedPuIds.includes(pu.id);
                  const theme = pu.colorTheme;
                  
                  return (
                    <div
                      key={pu.id}
                      onClick={() => handleToggleSelectPu(pu.id)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? `${theme.bg} ${theme.border} ring-2 ring-indigo-500/40 shadow-lg` 
                          : "bg-slate-950/40 border-slate-900 hover:border-slate-800 hover:bg-slate-900/20"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // Handled by div onClick
                          className="mt-0.5 accent-indigo-500 shrink-0 pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center gap-1">
                            <span className="font-bold text-[11px] text-slate-100 truncate flex items-center gap-1">
                              <span>{pu.icon}</span> {pu.title}
                            </span>
                            <span className="text-[9px] font-mono font-bold text-slate-500">
                              {score}% rec.
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed line-clamp-1">
                            {pu.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: AJUSTES DE PARÁMETROS DEL USUARIO */}
        <div className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl space-y-3.5 text-left">
          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>⚙️</span> 2. Configurar Parámetros del Análisis (Opcional):
          </h5>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search Radius Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10.5px]">
                <span className="text-slate-400 font-semibold">🗺️ Radio de Búsqueda Táctico (GEOINT)</span>
                <span className="text-sky-400 font-mono font-bold bg-sky-950/30 px-2 py-0.5 rounded border border-sky-900/20">
                  {searchRadius} metros
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="2000"
                step="50"
                value={searchRadius}
                onChange={(e) => setSearchRadius(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[8.5px] text-slate-600 font-mono">
                <span>50m (Cerrado)</span>
                <span>2,000m (Amplio)</span>
              </div>
            </div>

            {/* Priority Select */}
            <div className="space-y-1.5">
              <span className="text-[10.5px] text-slate-400 font-semibold block">⚡ Prioridad de Procesamiento</span>
              <select
                value={analysisPriority}
                onChange={(e: any) => setAnalysisPriority(e.target.value)}
                className="w-full bg-slate-950 text-slate-300 border border-slate-900 rounded-md p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="Baja">Baja (Lenta, menos costosa)</option>
                <option value="Media">Media (Balanceada)</option>
                <option value="Alta">Alta (Inmediata, máxima precisión)</option>
              </select>
            </div>
          </div>

          {/* Catalog Selection & Extra Context */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <span className="text-[10.5px] text-slate-400 font-semibold block">🧠 Categorías NLP a catalogar:</span>
              <div className="grid grid-cols-2 gap-2 text-[9.5px]">
                {Object.keys(catalogTypes).map(type => (
                  <label key={type} className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={catalogTypes[type]}
                      onChange={() => setCatalogTypes(prev => ({ ...prev, [type]: !prev[type] }))}
                      className="accent-indigo-500 shrink-0"
                    />
                    <span className="capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10.5px] text-slate-400 font-semibold block">📝 Contexto o Instrucciones Adicionales:</span>
              <textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder="Ejemplo: Priorizar vehículos color rojo o alias delictivos de la zona..."
                rows={2}
                className="w-full bg-slate-950 text-slate-300 border border-slate-900 rounded-md p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: ASISTENTE DE INTELIGENCIA OPERATIVA (AI COPILOT) */}
        <div className="bg-slate-900/40 border border-indigo-500/20 p-3.5 rounded-xl text-left space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
              Asistente de Inteligencia Operativa
            </span>
          </div>
          
          <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
            {analysis.copilotComment}
          </p>

          {/* Warning / Inconsistency warnings */}
          {analysis.warnings.length > 0 && (
            <div className="space-y-1 pt-1.5 border-t border-slate-900">
              <span className="text-[8.5px] font-bold text-amber-500 uppercase tracking-widest block">
                ⚠️ ALERTAS DE INCONSISTENCIA EN DETECCIÓN:
              </span>
              <ul className="list-disc pl-4 space-y-1 text-[10px] text-amber-300/90 leading-relaxed">
                {analysis.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* SECTION 5: MODAL ACTION BUTTONS (USER VALIDATION) */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold py-2 px-3 rounded-lg text-xs transition-all text-center"
          >
            Cancelar análisis
          </button>
          
          <button
            type="button"
            onClick={executePipeline}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all shadow-[0_0_15px_rgba(99,102,241,0.25)] flex items-center justify-center gap-1.5"
          >
            ⚡ {activeTab === "sugerido" ? "Aceptar Sugerencia (Ejecutar)" : "Ejecutar Combinación Seleccionada"}
          </button>
        </div>

        <div className="text-center text-[9px] text-slate-500">
          ⚖️ Principio de control operativo: <strong className="text-slate-400">“La inteligencia sugiere, el usuario decide.”</strong>
        </div>
        </div>
      </div>
    </>
  );
}
