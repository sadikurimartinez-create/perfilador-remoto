"use client";

import React, { useState } from "react";

export interface PowerUpData {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  colorTheme: {
    bg: string;
    border: string;
    hoverBorder: string;
    hoverBg: string;
    text: string;
    accentText: string;
    glow: string;
    badge: string;
    accentBg: string;
  };
  technicalText: string;
  internalActions: string[];
  expectedResults: string[];
  complexity: "Bajo" | "Intermedio" | "Avanzado" | "Complejo";
  dataTypes: string;
  fileImpact: string;
  whatIsIt: string;
}

export const POWER_UPS_REDESIGNED: PowerUpData[] = [
  {
    id: "analizar_imagen",
    title: "Analizar Imagen",
    subtitle: "Extrae texto y detecta objetos relevantes en fotos o PDFs.",
    icon: "📸",
    technicalText: "Ejecuta OCR Avanzado y Extracción de Atributos Visuales.",
    internalActions: [
      "OCR avanzado (Vision API)",
      "Detección de objetos relevantes",
      "Extracción de atributos visuales"
    ],
    expectedResults: [
      "Texto digitalizado",
      "Objetos identificados",
      "Evidencia estructurada"
    ],
    complexity: "Intermedio",
    dataTypes: "Fotos (JPG, PNG), Escaneos, Archivos PDF",
    fileImpact: "Enriquece el expediente digital con texto legible y detección de elementos de riesgo o marcas en la escena.",
    whatIsIt: "Procesa cualquier archivo visual para convertir la imagen en datos editables y catalogar objetos de interés.",
    colorTheme: {
      bg: "bg-emerald-950/20",
      border: "border-emerald-500/30",
      hoverBorder: "hover:border-emerald-500/80",
      hoverBg: "hover:bg-emerald-950/40",
      text: "text-emerald-300",
      accentText: "text-emerald-400",
      glow: "shadow-emerald-500/10",
      badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      accentBg: "bg-emerald-500"
    }
  },
  {
    id: "analizar_audio",
    title: "Analizar Audio",
    subtitle: "Convierte audio en texto y detecta tono emocional.",
    icon: "🎙️",
    technicalText: "Aplica Análisis de Diarización y Sentimiento.",
    internalActions: [
      "Speech-to-Text de alta fidelidad",
      "Diarización de voces (separación de hablantes)",
      "Análisis de sentimiento y tono emocional"
    ],
    expectedResults: [
      "Transcripción por hablante",
      "Identificación de emociones",
      "Segmentación de diálogo"
    ],
    complexity: "Avanzado",
    dataTypes: "Grabaciones de voz, Audios, Llamadas (MP3, WAV)",
    fileImpact: "Registra transcripciones literales, identificando quién habla y detectando picos de tensión o miedo en el diálogo.",
    whatIsIt: "Utiliza modelos lingüísticos acústicos para transcribir grabaciones de audio separando a los participantes y evaluando su carga emocional.",
    colorTheme: {
      bg: "bg-purple-950/20",
      border: "border-purple-500/30",
      hoverBorder: "hover:border-purple-500/80",
      hoverBg: "hover:bg-purple-950/40",
      text: "text-purple-300",
      accentText: "text-purple-400",
      glow: "shadow-purple-500/10",
      badge: "bg-purple-500/10 text-purple-300 border-purple-500/20",
      accentBg: "bg-purple-500"
    }
  },
  {
    id: "analisis_ubicacion",
    title: "Análisis de Ubicación",
    subtitle: "Detecta eventos y noticias cerca del punto investigado.",
    icon: "📍",
    technicalText: "Realiza Consulta de Proximidad ST_DWithin y Grounding Dinámico.",
    internalActions: [
      "Consulta espacial ST_DWithin",
      "Cruce con noticias en tiempo real",
      "Correlación geográfica dinámica"
    ],
    expectedResults: [
      "Eventos cercanos",
      "Alertas territoriales",
      "Correlaciones espaciales"
    ],
    complexity: "Complejo",
    dataTypes: "Coordenadas geográficas (Lat/Lon), Radios de búsqueda",
    fileImpact: "Establece conexiones lógicas entre las coordenadas del suceso y eventos históricos u operativos reportados a la redonda.",
    whatIsIt: "Analiza bases de datos geográficas para buscar patrones espaciales y reportes informativos cercanos al punto de interés.",
    colorTheme: {
      bg: "bg-blue-950/20",
      border: "border-blue-500/30",
      hoverBorder: "hover:border-blue-500/80",
      hoverBg: "hover:bg-blue-950/40",
      text: "text-blue-300",
      accentText: "text-blue-400",
      glow: "shadow-blue-500/10",
      badge: "bg-blue-500/10 text-blue-300 border-blue-500/20",
      accentBg: "bg-blue-500"
    }
  },
  {
    id: "detectar_entidades",
    title: "Detectar Personas y Lugares",
    subtitle: "Identifica nombres, organizaciones y direcciones en el contenido.",
    icon: "🧠",
    technicalText: "Activa Extracción de Entidades Salientes.",
    internalActions: [
      "NLP Entity Recognition",
      "Extracción de alias",
      "Detección de estructuras criminales"
    ],
    expectedResults: [
      "Lista de entidades",
      "Relaciones entre actores",
      "Posibles vínculos"
    ],
    complexity: "Intermedio",
    dataTypes: "Descripciones de campo, Testimonios, Documentos de texto",
    fileImpact: "Estructura de forma automática una base de actores (quién es quién) y lugares clave para armar redes de vínculos.",
    whatIsIt: "Extrae automáticamente nombres propios, direcciones, organizaciones o términos clave de textos narrativos desestructurados.",
    colorTheme: {
      bg: "bg-amber-950/20",
      border: "border-amber-500/30",
      hoverBorder: "hover:border-amber-500/80",
      hoverBg: "hover:bg-amber-950/40",
      text: "text-amber-300",
      accentText: "text-amber-400",
      glow: "shadow-amber-500/10",
      badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
      accentBg: "bg-amber-500"
    }
  },
  {
    id: "buscar_inteligencia",
    title: "Buscar Inteligencia",
    subtitle: "Busca información relevante en bases OSINT y conocimiento histórico.",
    icon: "🔍",
    technicalText: "Despliega Búsqueda Semántica en Discovery Engine.",
    internalActions: [
      "Semantic Search Engine",
      "Google Discovery Engine",
      "Recuperación de casos similares"
    ],
    expectedResults: [
      "Casos relacionados",
      "Contexto histórico",
      "Evidencia comparable"
    ],
    complexity: "Complejo",
    dataTypes: "Bases OSINT abiertas, Repositorios del expediente, Históricos",
    fileImpact: "Vincula tu investigación actual con precedentes históricos, lecciones operativas previas o información pública relevante.",
    whatIsIt: "Usa embeddings vectoriales para interrogar múltiples fuentes y bases de datos a nivel semántico (por significado, no solo palabras clave).",
    colorTheme: {
      bg: "bg-rose-950/20",
      border: "border-rose-500/30",
      hoverBorder: "hover:border-rose-500/80",
      hoverBg: "hover:bg-rose-950/40",
      text: "text-rose-300",
      accentText: "text-rose-400",
      glow: "shadow-rose-500/10",
      badge: "bg-rose-500/10 text-rose-300 border-rose-500/20",
      accentBg: "bg-rose-500"
    }
  }
];

interface PowerUpsModuleProps {
  onApplyPowerUp: (text: string) => void;
  isReadOnly?: boolean;
}

export function PowerUpsModule({ onApplyPowerUp, isReadOnly = false }: PowerUpsModuleProps) {
  const [selectedPu, setSelectedPu] = useState<PowerUpData | null>(null);
  const [hoveredPu, setHoveredPu] = useState<PowerUpData | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<Record<string, boolean>>({});

  const activePuForPreview = hoveredPu || selectedPu;

  const handleCardClick = (pu: PowerUpData) => {
    if (isReadOnly) return;
    setSelectedPu(pu);
    // ST_DWithin and Discovery Engine are complex analyses that trigger the Smart Confirmation workflow
    if (pu.complexity === "Complejo") {
      setShowConfirmModal(true);
    } else {
      // For standard analysis we also show the detailed sidebar but allow direct confirmation, or we can open confirm modal as well.
      // To satisfy requirement V.3 (Confirmación inteligente - opcional configurable si el análisis es complejo)
      // we only prompt confirmation modal for "Complejo" analyses, and for others we let the user preview and hit apply in the side panel or modal!
      setShowConfirmModal(true);
    }
  };

  const confirmApply = () => {
    if (selectedPu) {
      onApplyPowerUp(selectedPu.technicalText);
      setShowConfirmModal(false);
      setSelectedPu(null);
    }
  };

  const toggleTechnical = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTechnicalDetails(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="w-full bg-slate-950 border border-slate-800/80 rounded-xl p-4 shadow-2xl space-y-4">
      {/* Header section with operational focus */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-900 pb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wide">
            <span className="text-amber-500 animate-pulse text-base">⚡</span>
            Asistente de Inteligencia Operativa
          </h4>
          <p className="text-[11px] text-slate-400">
            Aumenta el expediente digital con capacidades tácticas avanzadas guiadas por IA.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-full border border-slate-800/80 text-[10px] text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="font-semibold">Módulo Explicativo Activo</span>
        </div>
      </div>

      {/* Main Grid: Left is Buttons, Right is "¿Qué estás activando?" dynamic context */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Buttons / Cards Container (Left pane - 7 cols) */}
        <div className="lg:col-span-7 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {POWER_UPS_REDESIGNED.map((pu) => {
              const theme = pu.colorTheme;
              const isSelected = selectedPu?.id === pu.id;
              const isHovered = hoveredPu?.id === pu.id;

              return (
                <div
                  key={pu.id}
                  onClick={() => handleCardClick(pu)}
                  onMouseEnter={() => !isReadOnly && setHoveredPu(pu)}
                  onMouseLeave={() => setHoveredPu(null)}
                  className={`group relative p-3 rounded-lg border text-left transition-all duration-300 cursor-pointer ${
                    isReadOnly ? "opacity-60 cursor-not-allowed" : ""
                  } ${theme.bg} ${theme.border} ${theme.hoverBorder} ${
                    isSelected ? "border-slate-300 ring-2 ring-slate-500 bg-slate-900/40" : ""
                  } shadow-md hover:shadow-xl hover:-translate-y-0.5`}
                  style={{
                    boxShadow: isHovered || isSelected ? `0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 0 15px 2px rgba(255, 255, 255, 0.02)` : undefined
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Left: Beautiful color badge with icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shadow-inner ${theme.badge} shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                      {pu.icon}
                    </div>

                    {/* Middle: Content */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-1.5">
                        <h5 className="font-bold text-xs text-slate-100 group-hover:text-white truncate">
                          {pu.title}
                        </h5>
                        <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border ${
                          pu.complexity === "Complejo"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : pu.complexity === "Avanzado"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {pu.complexity}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed truncate group-hover:text-slate-200">
                        {pu.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Expandible Tooltip Toggle inside the button (top right corner) */}
                  <button
                    type="button"
                    onClick={(e) => toggleTechnical(pu.id, e)}
                    className="absolute top-2 right-2 p-1 text-slate-500 hover:text-slate-300 rounded transition-colors"
                    title="Ver detalles técnicos internos"
                  >
                    <span className="text-[11px] font-mono select-none">⚙️</span>
                  </button>

                  {/* Expandible inline panel */}
                  {showTechnicalDetails[pu.id] && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1 bg-slate-950/50 p-2 rounded">
                      <div className="font-bold text-slate-300">⚙️ Procesamiento Interno (IA):</div>
                      <ul className="list-disc pl-3.5 space-y-0.5">
                        {pu.internalActions.map((action, i) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ul>
                      <div className="font-bold text-slate-300 mt-1">📦 Producto Generado:</div>
                      <ul className="list-disc pl-3.5 space-y-0.5">
                        {pu.expectedResults.map((res, i) => (
                          <li key={i}>{res}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick "Antes de ejecutar" overlay indicator if hovering on card */}
          {hoveredPu && (
            <div className="hidden lg:block bg-slate-900/80 border border-indigo-500/20 p-2.5 rounded-lg text-[10px] text-slate-300 animate-fadeIn shadow-lg">
              <span className="text-amber-400 font-bold block mb-1">🔍 Vista Previa ("Antes de ejecutar"):</span>
              Este PowerUp añadirá la instrucción de análisis: <code className="text-indigo-300 bg-black/40 px-1 py-0.5 rounded font-mono">"{hoveredPu.technicalText}"</code>
            </div>
          )}
        </div>

        {/* Sidebar Panel: "¿Qué estás activando?" (Right pane - 5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between min-h-[220px] shadow-inner">
          {activePuForPreview ? (
            <div className="space-y-3.5 animate-fadeIn">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{activePuForPreview.icon}</span>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">¿Qué estás activando?</span>
                </div>
                <h6 className="text-xs font-bold text-slate-100">
                  {activePuForPreview.title}
                </h6>
                <p className="text-[10px] text-slate-300 mt-1 leading-relaxed bg-slate-950/40 p-2 rounded border border-slate-900">
                  {activePuForPreview.whatIsIt}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-slate-950/30 p-2 rounded border border-slate-900/60">
                  <span className="text-slate-500 block font-medium">Complejidad:</span>
                  <span className={`font-bold ${
                    activePuForPreview.complexity === "Complejo" ? "text-red-400" :
                    activePuForPreview.complexity === "Avanzado" ? "text-purple-400" : "text-emerald-400"
                  }`}>{activePuForPreview.complexity}</span>
                </div>
                <div className="bg-slate-950/30 p-2 rounded border border-slate-900/60">
                  <span className="text-slate-500 block font-medium">Datos Procesados:</span>
                  <span className="text-slate-300 font-bold truncate block" title={activePuForPreview.dataTypes}>
                    {activePuForPreview.dataTypes}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded border border-slate-900/80 text-[10px]">
                <span className="text-slate-500 block font-bold mb-0.5">Impacto en el Expediente:</span>
                <p className="text-slate-300 leading-normal">
                  {activePuForPreview.fileImpact}
                </p>
              </div>

              {/* Action Button inside right pane if clicked */}
              {!isReadOnly && selectedPu && selectedPu.id === activePuForPreview.id && (
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3 rounded text-[10px] transition-all flex items-center justify-center gap-1.5 shadow-md"
                >
                  ⚡ Configurar y Ejecutar
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-full py-8 text-slate-500 space-y-2">
              <div className="text-2xl animate-pulse">🤖</div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asistente Operativo</p>
                <p className="text-[10px] text-slate-500 max-w-[180px] mt-1">
                  Pasa el cursor o selecciona un PowerUp para ver su impacto operativo antes de ejecutarlo.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Premium Confirm Modal (Smart Confirmation Workflow) */}
      {showConfirmModal && selectedPu && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl relative overflow-hidden">
            {/* Ambient background glow according to the PowerUp theme */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${selectedPu.colorTheme.accentBg}`} />

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-inner ${selectedPu.colorTheme.badge} shrink-0`}>
                  {selectedPu.icon}
                </div>
                <div>
                  <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">
                    Confirmación de Asistente IA
                  </span>
                  <h4 className="text-sm font-bold text-slate-100 mt-1">
                    ¿Estás seguro de activar {selectedPu.title}?
                  </h4>
                </div>
              </div>

              {/* Explanatory Panel: "Este PowerUp hará lo siguiente antes de ejecutarse..." */}
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800 text-[10.5px] text-slate-300 space-y-2 leading-relaxed">
                <p className="font-bold text-slate-200">
                  <span className="text-amber-500 mr-1">👉</span>
                  Este PowerUp hará lo siguiente antes de ejecutarse:
                </p>
                <div className="pl-3.5 space-y-1.5">
                  <p>
                    <strong className="text-slate-200">1. Humano:</strong> {selectedPu.subtitle}
                  </p>
                  <div>
                    <strong className="text-slate-200">2. Proceso Técnico (IA):</strong>
                    <ul className="list-disc pl-3.5 space-y-0.5 text-slate-400 text-[10px] mt-0.5">
                      {selectedPu.internalActions.map((action, i) => (
                        <li key={i}>{action}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong className="text-slate-200">3. Resultado en el Expediente:</strong>
                    <ul className="list-disc pl-3.5 space-y-0.5 text-slate-400 text-[10px] mt-0.5">
                      {selectedPu.expectedResults.map((res, i) => (
                        <li key={i}>{res}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Additional Context mapping */}
              <div className="text-[10px] bg-indigo-950/20 border border-indigo-500/10 p-2.5 rounded-md text-indigo-300 font-mono">
                <span className="font-bold text-indigo-400 block mb-1">📝 Texto de anclaje técnico:</span>
                "{selectedPu.technicalText}"
              </div>

              {/* Modal Buttons */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setSelectedPu(null);
                  }}
                  className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold py-2 px-3 rounded-lg text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmApply}
                  className={`flex-1 ${selectedPu.colorTheme.accentBg} hover:opacity-90 text-slate-950 font-bold py-2 px-3 rounded-lg text-xs transition-all shadow-md`}
                >
                  Confirmar y Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
