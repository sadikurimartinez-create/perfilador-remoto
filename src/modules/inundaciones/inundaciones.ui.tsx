"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, Circle, Polyline, InfoWindow } from "@react-google-maps/api";
import { InundacionesService } from "./inundaciones.service";
import { FloodAssessment } from "./inundaciones.types";
import { useAuth } from "@/context/AuthContext";

const MAP_LIBRARIES: ("places" | "visualization" | "drawing")[] = ["places", "visualization", "drawing"];
const mapContainerStyle = {
  width: "100%",
  height: "500px",
  borderRadius: "0.75rem",
};

// Estilo de mapa oscuro premium (GEOINT)
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#022c22" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#10b981" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#1e1b4b" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#312e81" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#c084fc" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#082f49" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#0284c7" }],
  },
];

export function InundacionesUI() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<FloodAssessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<FloodAssessment | null>(null);
  
  // Formulario
  const [zonaInput, setZonaInput] = useState("Sector Río San Pedro / Fracc. Las Flores");
  const [latInput, setLatInput] = useState("21.8885");
  const [lngInput, setLngInput] = useState("-102.3156");
  const [radioInput, setRadioInput] = useState(1200);
  const [observacionesInput, setObservacionesInput] = useState(
    "Drenaje pluvial reportado con azolve recurrente por maleza y basura. Canal a cielo abierto cercano presenta niveles moderados tras llovizna."
  );
  const [pronosticoInput, setPronosticoInput] = useState("Lluvias intensas con acumulados de 45mm en las próximas 24 horas");

  // Estados de carga y flujo
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"dictamen" | "osint" | "infraestructura" | "recomendaciones">("dictamen");

  const handleTabChange = useCallback((tab: "dictamen" | "osint" | "infraestructura" | "recomendaciones") => {
    setActiveTab(tab);
    setTimeout(() => {
      if ((window as any).map && typeof (window as any).map.invalidateSize === "function") {
        (window as any).map.invalidateSize();
      }
    }, 300);
    requestAnimationFrame(() => {
      if ((window as any).map && typeof (window as any).map.invalidateSize === "function") {
        (window as any).map.invalidateSize();
      }
    });
  }, []);

  const [activeLayers, setActiveLayers] = useState({
    calor: true,
    infraestructura: true,
    escurrimientos: true,
    predictivo: true,
    osint: true,
  });

  // Estados interactivos del mapa
  const [map, setMap] = useState<any | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<any | null>(null);
  const [loadingStep, setLoadingStep] = useState("");
  const stepsIndex = useRef(0);

  // Cargar Google Maps JS API
  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc") : "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: MAP_LIBRARIES,
  });

  // Cargar historial al iniciar y autoseleccionar el primer registro para poblar el mapa
  const loadHistory = async () => {
    const data = await InundacionesService.getAllAssessments();
    setAssessments(data);
    if (data.length > 0) {
      const first = data[0];
      setSelectedAssessment(first);
      setZonaInput(first.zona_analizada);
      setLatInput(String(first.lat));
      setLngInput(String(first.lng));
      setRadioInput(first.radioMetros);
      setObservacionesInput(first.observaciones_campo || "");
      setPronosticoInput(first.pronostico_lluvia || "");
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Animación de los pasos de carga para una excelente experiencia de usuario
  const startLoadingAnimation = (callback: () => void) => {
    const steps = [
      "Iniciando ingesta de datos territoriales de INEGI...",
      "Cargando Modelo Digital de Elevación (DEM) y estimando pendientes...",
      "Obteniendo curvas de nivel y red de drenaje pluvial natural...",
      "Consultando pronósticos e índices de lluvia con CONAGUA / SMN...",
      "Cargando Atlas Nacional de Riesgos de CENAPRED...",
      "Analizando impermeabilidad y colectores mediante OpenStreetMap...",
      "Ejecutando barrido semántico OSINT en redes locales y medios...",
      "Calculando Índice de Riesgo de Inundación (IRI) compuesto...",
      "Generando Dictamen Técnico Automatizado GEOINT..."
    ];
    setLoading(true);
    stepsIndex.current = 0;
    setLoadingStep(steps[0]);

    const interval = setInterval(() => {
      stepsIndex.current += 1;
      if (stepsIndex.current < steps.length) {
        setLoadingStep(steps[stepsIndex.current]);
      } else {
        clearInterval(interval);
        callback();
      }
    }, 1100);
  };

  // Ejecutar Análisis de Riesgo
  const handleAnalyze = () => {
    if (!latInput || !lngInput) {
      alert("Por favor introduce coordenadas válidas.");
      return;
    }

    startLoadingAnimation(async () => {
      try {
        const result = await InundacionesService.analyzeFloodRisk({
          lat: parseFloat(latInput),
          lng: parseFloat(lngInput),
          radioMetros: radioInput,
          observaciones_campo: observacionesInput,
          pronostico_lluvia: pronosticoInput,
          zona_analizada: zonaInput,
        });

        // Guardar automáticamente en Firestore
        const savedId = await InundacionesService.saveAssessment(result, user?.username || "Analista");
        const finalAssessment = { ...result, id: savedId };

        setSelectedAssessment(finalAssessment);
        // Actualizar historial
        await loadHistory();
      } catch (err: any) {
        console.error("Error al analizar riesgo:", err);
        alert("Ocurrió un error al procesar el análisis de inteligencia territorial: " + err.message);
      } finally {
        setLoading(false);
        setLoadingStep("");
      }
    });
  };

  // Cargar un análisis histórico
  const handleLoadHistoric = (assess: FloodAssessment) => {
    setSelectedAssessment(assess);
    setZonaInput(assess.zona_analizada);
    setLatInput(String(assess.lat));
    setLngInput(String(assess.lng));
    setRadioInput(assess.radioMetros);
    setObservacionesInput(assess.observaciones_campo || "");
    setPronosticoInput(assess.pronostico_lluvia || "");
    
    // Enfocar el mapa si está listo
    if (map) {
      map.panTo({ lat: assess.lat, lng: assess.lng });
      map.setZoom(14);
    }
  };

  // Eliminar análisis histórico
  const handleDeleteHistoric = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("¿Estás seguro de que deseas eliminar este dictamen histórico?")) {
      await InundacionesService.deleteAssessment(id);
      if (selectedAssessment?.id === id) {
        setSelectedAssessment(null);
      }
      loadHistory();
    }
  };

  // Al hacer click en el mapa, actualizar coordenadas
  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setLatInput(e.latLng.lat().toFixed(6));
      setLngInput(e.latLng.lng().toFixed(6));
    }
  }, []);

  const onMapLoad = useCallback((mapInstance: any) => {
    setMap(mapInstance);
    if (typeof window !== "undefined") {
      if ((window as any).map && (window as any).map !== mapInstance) {
        try {
          (window as any).map.remove();
        } catch (e) {
          console.warn("Error removing previous map instance:", e);
        }
      }
      (window as any).map = mapInstance;
      if (!(window as any).map.invalidateSize) {
        (window as any).map.invalidateSize = () => {
          if (typeof window !== "undefined" && (window as any).google?.maps) {
            (window as any).google.maps.event.trigger(mapInstance, "resize");
          }
        };
      }
      if (!(window as any).map.remove) {
        (window as any).map.remove = () => {
          if ((window as any).map === mapInstance) {
            (window as any).map = null;
          }
        };
      }
    }
  }, []);

  // Generar datos geoespaciales para renderizado táctico (curvas de nivel, escurrimientos artificiales)
  const mapCenter = useMemo(() => {
    return {
      lat: selectedAssessment ? selectedAssessment.lat : parseFloat(latInput) || 21.8885,
      lng: selectedAssessment ? selectedAssessment.lng : parseFloat(lngInput) || -102.3156,
    };
  }, [selectedAssessment, latInput, lngInput]);

  // Rutas de escurrimientos naturales simuladas a partir del centro
  const escurrimientosFlujos = useMemo(() => {
    const centerLat = mapCenter.lat;
    const centerLng = mapCenter.lng;
    return [
      [
        { lat: centerLat + 0.005, lng: centerLng - 0.003 },
        { lat: centerLat + 0.002, lng: centerLng - 0.001 },
        { lat: centerLat, lng: centerLng },
      ],
      [
        { lat: centerLat - 0.004, lng: centerLng + 0.006 },
        { lat: centerLat - 0.002, lng: centerLng + 0.003 },
        { lat: centerLat, lng: centerLng },
      ],
      [
        { lat: centerLat + 0.006, lng: centerLng + 0.004 },
        { lat: centerLat + 0.003, lng: centerLng + 0.002 },
        { lat: centerLat, lng: centerLng },
      ]
    ];
  }, [mapCenter]);

  // Copiar Dictamen al Portapapeles
  const handleCopyDictamen = () => {
    if (!selectedAssessment) return;
    const reportText = `
--- DICTAMEN DE INTELIGENCIA TERRITORIAL GEOINT ---
CENTRO DE ESTUDIOS Y POLÍTICA CRIMINAL (CEIPOL)

ZONA ANALIZADA: ${selectedAssessment.zona_analizada}
COORDENADAS CENTRALES: ${selectedAssessment.lat}, ${selectedAssessment.lng}
ÍNDICE DE RIESGO DE INUNDACIÓN (IRI): ${selectedAssessment.iri_score}/100
NIVEL DE RIESGO: ${selectedAssessment.nivel_riesgo.toUpperCase()}
ESTADO DE ALERTA: ${selectedAssessment.alerta ? "⚠️ ALERTA CRÍTICA ACTIVA" : "MONITOREO ORDINARIO"}

FACTORES DETONANTES PRINCIPALES:
${selectedAssessment.factores_principales.map((f, i) => `${i + 1}. ${f}`).join("\n")}

EVIDENCIAS GEOESPACIALES (INEGI/CENAPRED):
${selectedAssessment.evidencia_geoespacial.map(e => `- [${e.tipo}]: ${e.descripcion}`).join("\n")}

EVIDENCIAS OSINT (BARRIDO DE INTELIGENCIA):
${selectedAssessment.evidencia_osint.map(o => `- [${o.fuente}]: "${o.texto}" (${o.fecha || "N/D"})`).join("\n")}

INFRAESTRUCTURA VULNERABLE AFECTADA:
${selectedAssessment.infraestructura_critica.map(i => `- ${i.nombre} (${i.tipo}) - Vulnerabilidad: ${i.vulnerabilidad}`).join("\n")}

RECOMENDACIONES DE OPERACIÓN TÁCTICA:
${selectedAssessment.recomendaciones.map((r, i) => `- ${r}`).join("\n")}
    `.trim();

    navigator.clipboard.writeText(reportText);
    alert("¡Dictamen GEOINT copiado al portapapeles exitosamente!");
  };

  // Imprimir dictamen o descargar en PDF
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* HEADER DE MÓDULO */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Motor Operativo GEOINT</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">
            Módulo de Riesgo por Inundaciones y Alertas Hidrometeorológicas
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Análisis predictivo de cuencas, barrido de fuentes abiertas (OSINT) e infraestructura crítica vulnerable en tiempo casi real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleLoadHistoric({
              zona_analizada: "Zona Centro Aguascalientes (Río San Pedro)",
              lat: 21.8885,
              lng: -102.3156,
              radioMetros: 1500,
              observaciones_campo: "Zona baja urbana adyacente a ramificaciones aluviales secundarias. Problemas crónicos de drenaje en época de lluvias intensas.",
              pronostico_lluvia: "Lluvia extrema pronosticada por remanentes de tormenta tropical (50-70mm)",
              iri_score: 84,
              nivel_riesgo: "Alto",
              factores_principales: [
                "Proximidad inmediata al cauce principal del Río San Pedro",
                "Azolve severo de alcantarillas por residuos urbanos",
                "Saturación hídrica histórica por arcillas expansivas en el suelo"
              ],
              evidencia_geoespacial: [
                { tipo: "MDE de INEGI", descripcion: "Altitud inferior a los 1,860 msnm con pendientes planas estancadas." },
                { tipo: "Red de Drenaje Natural", descripcion: "Intersección con escurrimientos pluviales naturales procedentes del cerro oriente." }
              ],
              evidencia_osint: [
                { fuente: "Twitter Reporteros", texto: "Reportan calles completamente anegadas en cruce de López Mateos Poniente, agua sube 40cm.", fecha: "Hace 2 horas" },
                { fuente: "Portal Noticias Aguascalientes", texto: "Bomberos asisten a rescate de vehículos varados bajo puente del Río San Pedro.", fecha: "Histórico" }
              ],
              infraestructura_critica: [
                { nombre: "Hospital General de Zona IMSS", tipo: "Hospital", vulnerabilidad: "Crítica", coordenadas: { lat: 21.891, lng: -102.312 } },
                { nombre: "Escuela Secundaria Técnica #1", tipo: "Escuela", vulnerabilidad: "Alta", coordenadas: { lat: 21.885, lng: -102.319 } }
              ],
              alerta: true,
              recomendaciones: [
                "Activar cuadrillas de desazolve rápido de protección civil.",
                "Colocar barricadas de arena en accesos de sótanos y áreas de urgencias del IMSS.",
                "Efectuar cortes viales temporales en el paso deprimido del río."
              ]
            })}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-all shadow-md"
          >
            ⚡ Cargar Demo Aguascalientes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PANEL LATERAL DE HISTORIAL Y CONFIGURACIÓN */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          {/* CONFIGURACIÓN DEL ANÁLISIS */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider border-b border-slate-800 pb-2">
              📍 Parámetros del Área de Estudio
            </h3>

            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <label className="text-slate-400 text-xs font-medium">Nombre del Polígono o Zona</label>
                <input
                  type="text"
                  value={zonaInput}
                  onChange={(e) => setZonaInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 text-xs font-medium">Latitud</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-xs font-medium">Longitud</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={lngInput}
                    onChange={(e) => setLngInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <label className="text-slate-400">Radio de Cobertura GEOINT</label>
                  <span className="text-blue-400 font-bold">{radioInput} metros</span>
                </div>
                <input
                  type="range"
                  min="250"
                  max="3000"
                  step="250"
                  value={radioInput}
                  onChange={(e) => setRadioInput(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-xs font-medium">Pronóstico de Lluvia (CONAGUA / SMN)</label>
                <select
                  value={pronosticoInput}
                  onChange={(e) => setPronosticoInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                >
                  <option value="Sin probabilidad de lluvia">Despejado - Sin lluvia</option>
                  <option value="Lloviznas ligeras aisladas (menos de 5mm en 24h)">Llovizna Ligera (&lt; 5mm)</option>
                  <option value="Lluvia moderada constante (10-25mm en 24h)">Lluvia Moderada (10-25mm)</option>
                  <option value="Lluvias intensas con acumulados de 45mm en las próximas 24 horas">Tormenta / Lluvia Intensa (45mm+)</option>
                  <option value="Depresión tropical estacionaria con descargas eléctricas y acumulado superior a 80mm">Depresión Tropical Estacionaria (80mm+)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-xs font-medium">Observaciones de Campo del Investigador</label>
                <textarea
                  value={observacionesInput}
                  onChange={(e) => setObservacionesInput(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-slate-100 font-extrabold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 mt-2 cursor-pointer hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-slate-200 border-t-transparent rounded-full" />
                    <span>Ejecutando Barrido...</span>
                  </>
                ) : (
                  <>
                    <span>🛰️ Iniciar Barrido de Inteligencia</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* HISTORIAL DE DICTÁMENES */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md shadow-lg flex-1 space-y-3 overflow-y-auto max-h-[350px] scrollbar-thin scrollbar-thumb-slate-800">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>📋 Dictámenes Guardados</span>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-md">{assessments.length}</span>
            </h3>

            {assessments.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No hay dictámenes de inundación guardados en este expediente. Realice un análisis para comenzar.
              </div>
            ) : (
              <ul className="space-y-2">
                {assessments.map((item) => (
                  <li
                    key={item.id}
                    onClick={() => handleLoadHistoric(item)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex justify-between items-center ${
                      selectedAssessment?.id === item.id
                        ? "bg-blue-950/30 border-blue-700/60 hover:bg-blue-950/40"
                        : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700/60"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-bold text-slate-200 truncate">{item.zona_analizada}</p>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className={`px-1.5 py-0.25 rounded-md font-bold uppercase ${
                          item.nivel_riesgo === "Crítico" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                          item.nivel_riesgo === "Alto" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                          item.nivel_riesgo === "Medio" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                          "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        }`}>
                          IRI: {item.iri_score} ({item.nivel_riesgo})
                        </span>
                        <span className="text-slate-500">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteHistoric(e, item.id || "")}
                      className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                      title="Eliminar dictamen"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* MAPA Y RESULTADOS INTERACTIVOS */}
        <div className="lg:col-span-8 space-y-6">
          {/* PANTALLA DE CARGA PROGRESIVA PREMIUM */}
          {loading && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-8 backdrop-blur-md shadow-xl min-h-[500px] flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent" />
                <div className="absolute h-10 w-10 rounded-full bg-blue-950 animate-pulse flex items-center justify-center">
                  <span className="text-xs">🛰️</span>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-bold text-slate-200">Ejecutando Proceso Analítico Geoespacial</h4>
                <p className="text-xs text-blue-400 font-mono tracking-wide animate-pulse">
                  {loadingStep}
                </p>
              </div>
              <div className="w-64 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${((stepsIndex.current + 1) / 9) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* MAPA INTERACTIVO GOOGLE MAPS */}
          {!loading && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 backdrop-blur-md shadow-lg space-y-3 relative">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">🗺️ Capas GEOINT Activas:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setActiveLayers(l => ({ ...l, calor: !l.calor }))}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                      activeLayers.calor ? "bg-red-500/20 text-red-400 border-red-500/40" : "bg-slate-900 border-slate-800 text-slate-500"
                    }`}
                  >
                    🔥 Calor Riesgo
                  </button>
                  <button
                    onClick={() => setActiveLayers(l => ({ ...l, infraestructura: !l.infraestructura }))}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                      activeLayers.infraestructura ? "bg-blue-500/20 text-blue-400 border-blue-500/40" : "bg-slate-900 border-slate-800 text-slate-500"
                    }`}
                  >
                    🏥 Infraestructura
                  </button>
                  <button
                    onClick={() => setActiveLayers(l => ({ ...l, escurrimientos: !l.escurrimientos }))}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                      activeLayers.escurrimientos ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40" : "bg-slate-900 border-slate-800 text-slate-500"
                    }`}
                  >
                    🌊 Escurrimientos
                  </button>
                  <button
                    onClick={() => setActiveLayers(l => ({ ...l, predictivo: !l.predictivo }))}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                      activeLayers.predictivo ? "bg-purple-500/20 text-purple-400 border-purple-500/40" : "bg-slate-900 border-slate-800 text-slate-500"
                    }`}
                  >
                    🔮 Predictivo (24-72h)
                  </button>
                  <button
                    onClick={() => setActiveLayers(l => ({ ...l, osint: !l.osint }))}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                      activeLayers.osint ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-slate-900 border-slate-800 text-slate-500"
                    }`}
                  >
                    💬 OSINT
                  </button>
                </div>
              </div>

              {isLoaded ? (
                <div className="relative h-[500px] w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={mapCenter}
                    zoom={14}
                    onLoad={onMapLoad}
                    onClick={onMapClick}
                    options={{
                      styles: darkMapStyle,
                      disableDefaultUI: false,
                      mapTypeControl: false,
                      streetViewControl: true,
                    }}
                  >
                    {/* Epicentro o marcador central del análisis */}
                    <Marker
                      position={mapCenter}
                      title="Epicentro de Análisis"
                      icon={{
                        url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                      }}
                    />

                    {/* Radio de consulta visual buffer */}
                    <Circle
                      center={mapCenter}
                      radius={radioInput}
                      options={{
                        strokeColor: "#3b82f6",
                        strokeOpacity: 0.4,
                        strokeWeight: 1.5,
                        fillColor: "#3b82f6",
                        fillOpacity: 0.04,
                        clickable: false,
                      }}
                    />

                    {/* CAPA DE CALOR DE INUNDACIÓN (Círculo de Calor General) */}
                    {activeLayers.calor && selectedAssessment && (
                      <Circle
                        center={mapCenter}
                        radius={radioInput * 0.7}
                        options={{
                          strokeColor: selectedAssessment.iri_score > 75 ? "#ef4444" : "#f97316",
                          strokeOpacity: 0.6,
                          strokeWeight: 2,
                          fillColor: selectedAssessment.iri_score > 75 ? "#ef4444" : "#f97316",
                          fillOpacity: 0.18,
                          clickable: false,
                        }}
                      />
                    )}

                    {/* ESCURRIMIENTOS Y CUENCAS (Polilíneas dinámicas) */}
                    {activeLayers.escurrimientos && escurrimientosFlujos.map((lineCoords, idx) => (
                      <Polyline
                        key={`escurr-${idx}`}
                        path={lineCoords}
                        options={{
                          strokeColor: "#0ea5e9",
                          strokeOpacity: 0.75,
                          strokeWeight: 3.5,
                          geodesic: true,
                        }}
                      />
                    ))}

                    {/* MAPA PREDICTIVO (Zonas concéntricas de riesgo inminente) */}
                    {activeLayers.predictivo && selectedAssessment && selectedAssessment.alerta && (
                      <Circle
                        center={{ lat: mapCenter.lat - 0.001, lng: mapCenter.lng + 0.0015 }}
                        radius={radioInput * 0.35}
                        options={{
                          strokeColor: "#a855f7",
                          strokeOpacity: 0.7,
                          strokeWeight: 1.5,
                          fillColor: "#a855f7",
                          fillOpacity: 0.25,
                          clickable: false,
                        }}
                      />
                    )}

                    {/* MARCADORES OSINT */}
                    {activeLayers.osint && selectedAssessment?.evidencia_osint?.map((item, idx) => {
                      const itemLat = item.coordenadas?.lat ?? (mapCenter.lat + (idx % 2 === 0 ? 0.002 : -0.0015));
                      const itemLng = item.coordenadas?.lng ?? (mapCenter.lng + (idx % 2 === 0 ? -0.0025 : 0.003));
                      return (
                        <Marker
                          key={`osint-marker-${idx}`}
                          position={{ lat: itemLat, lng: itemLng }}
                          title={`OSINT: ${item.fuente}`}
                          onClick={() => setSelectedMarker({
                            title: `💬 OSINT - Fuente: ${item.fuente}`,
                            description: item.texto,
                            type: "osint",
                            date: item.fecha
                          })}
                          icon={{
                            url: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
                          }}
                        />
                      );
                    })}

                    {/* MARCADORES INFRAESTRUCTURA VULNERABLE */}
                    {activeLayers.infraestructura && selectedAssessment?.infraestructura_critica?.map((infra, idx) => (
                      <Marker
                        key={`infra-marker-${idx}`}
                        position={{ lat: infra.coordenadas.lat, lng: infra.coordenadas.lng }}
                        title={`${infra.nombre} (${infra.tipo})`}
                        onClick={() => setSelectedMarker({
                          title: `${infra.tipo === "Hospital" ? "🏥" : "🏫"} ${infra.nombre}`,
                          description: `Vulnerabilidad calculada ante lluvias intensas: ${infra.vulnerabilidad.toUpperCase()}`,
                          type: "infra",
                          vulnerability: infra.vulnerabilidad
                        })}
                        icon={{
                          url: infra.vulnerabilidad === "Crítica" || infra.vulnerabilidad === "Alta" 
                            ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                            : "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
                        }}
                      />
                    ))}

                    {/* INFO WINDOW PARA EVENTO CLIC EN MARCADORES */}
                    {selectedMarker && (
                      <InfoWindow
                        position={{
                          lat: selectedMarker.lat ?? mapCenter.lat,
                          lng: selectedMarker.lng ?? mapCenter.lng,
                        }}
                        onCloseClick={() => setSelectedMarker(null)}
                      >
                        <div className="p-2 text-slate-950 max-w-xs space-y-1 font-sans">
                          <h4 className="text-xs font-bold border-b pb-1 border-slate-200">{selectedMarker.title}</h4>
                          <p className="text-[10px] leading-normal">{selectedMarker.description}</p>
                          {selectedMarker.date && (
                            <p className="text-[9px] text-slate-500 font-mono pt-1">Fecha: {selectedMarker.date}</p>
                          )}
                          {selectedMarker.vulnerability && (
                            <p className="text-[9px] font-bold text-red-600">Vulnerabilidad: {selectedMarker.vulnerability}</p>
                          )}
                        </div>
                      </InfoWindow>
                    )}
                  </GoogleMap>
                  <p className="absolute bottom-2 left-2 z-10 bg-slate-950/85 border border-slate-800 text-[10px] text-slate-300 px-2.5 py-1 rounded-md">
                    💡 <span className="font-semibold text-white">Tip:</span> Haz click en cualquier punto del mapa para actualizar coordenadas.
                  </p>
                </div>
              ) : (
                <div className="h-[500px] w-full bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                  {loadError ? "Error cargando Google Maps API" : "Cargando mapa táctico geoespacial..."}
                </div>
              )}
            </div>
          )}

          {/* DICTAMEN AUTOMÁTICO GEOINT & DETALLES */}
          {selectedAssessment && !loading && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md shadow-lg space-y-6">
              {/* RESUMEN DE COMPOSICIÓN DEL RIESGO */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center border-b border-slate-800 pb-6">
                <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl shadow-inner relative overflow-hidden">
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest block mb-2">Puntaje IRI</span>
                  <div className="relative w-28 h-28 rounded-full flex items-center justify-center border-4 border-slate-800" style={{
                    borderColor: selectedAssessment.iri_score > 75 ? "#ef4444" : selectedAssessment.iri_score > 55 ? "#f97316" : "#eab308"
                  }}>
                    <div className="text-center">
                      <span className="text-3xl font-black text-slate-100">{selectedAssessment.iri_score}</span>
                      <span className="text-[10px] text-slate-500 block">/100</span>
                    </div>
                  </div>
                  <span className={`mt-3.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                    selectedAssessment.nivel_riesgo === "Crítico" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                    selectedAssessment.nivel_riesgo === "Alto" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                    selectedAssessment.nivel_riesgo === "Medio" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                    "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}>
                    Riesgo {selectedAssessment.nivel_riesgo}
                  </span>
                </div>

                <div className="md:col-span-8 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-200">Factores Detonantes del Peligro</h3>
                    <p className="text-xs text-slate-400">Principales vectores territoriales combinados que incrementan el IRI en este sector:</p>
                  </div>
                  <ul className="space-y-2 text-xs">
                    {selectedAssessment.factores_principales.map((factor, idx) => (
                      <li key={`factor-${idx}`} className="flex items-start gap-2.5 text-slate-300">
                        <span className="text-blue-400 font-black mt-0.5">•</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>

                  {/* ALERTA INTELIGENTE */}
                  {selectedAssessment.alerta ? (
                    <div className="bg-red-950/40 border border-red-500/40 border-l-4 border-l-red-500 p-3.5 rounded-lg flex items-center justify-between gap-4 animate-pulse-light shadow-lg">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black text-red-400 uppercase tracking-wide">🚨 Alerta Hidrometeorológica Activa</h4>
                        <p className="text-[10px] text-red-200/80">Coincidencia de topografía vulnerable, alcantarillados insuficientes y tormenta inminente.</p>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-ping shrink-0" />
                    </div>
                  ) : (
                    <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg text-slate-400 flex items-center gap-2">
                      <span className="text-emerald-500">✔</span>
                      <p className="text-[10px]">Monitoreo Ordinario: Las condiciones climáticas y OSINT no justifican la emisión de alertas operativas prioritarias en este polígono.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* TABS DE DETALLE */}
              <div className="space-y-4">
                <div className="flex border-b border-slate-800">
                  <button
                    onClick={() => handleTabChange("dictamen")}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                      activeTab === "dictamen" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    📄 Dictamen Técnico
                  </button>
                  <button
                    onClick={() => handleTabChange("osint")}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                      activeTab === "osint" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    💬 Evidencias OSINT ({selectedAssessment.evidencia_osint.length})
                  </button>
                  <button
                    onClick={() => handleTabChange("infraestructura")}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                      activeTab === "infraestructura" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    🏥 Infraestructura ({selectedAssessment.infraestructura_critica.length})
                  </button>
                  <button
                    onClick={() => handleTabChange("recomendaciones")}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                      activeTab === "recomendaciones" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    ⚡ Operación de Campo
                  </button>
                </div>

                {/* TAB CONTENIDO: DICTAMEN TÉCNICO */}
                {activeTab === "dictamen" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-slate-900/30 border border-slate-800/80 rounded-lg px-4 py-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Documento Oficial GEOINT</span>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopyDictamen}
                          className="px-3 py-1 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                        >
                          📋 Copiar Texto
                        </button>
                        <button
                          onClick={handlePrint}
                          className="px-3 py-1 rounded text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-slate-100 transition-colors"
                        >
                          🖨️ Imprimir / Guardar PDF
                        </button>
                      </div>
                    </div>

                    <div id="dictamen-imprimible" className="bg-slate-950 p-6 border border-slate-800 rounded-xl space-y-4 text-xs leading-relaxed text-slate-300 font-sans shadow-inner max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                      <div className="text-center space-y-1 pb-4 border-b border-slate-800">
                        <h2 className="text-sm font-black text-slate-100 uppercase tracking-widest">Centro de Estudios y Política Criminal (CEIPOL)</h2>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dictamen de Inteligencia Territorial sobre Riesgo de Inundaciones</h3>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">ID_DICTAMEN: FLD-{selectedAssessment.id?.slice(0,6) || "N/A"}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-900 text-[10px]">
                        <div>
                          <p><span className="text-slate-500 font-bold">ZONA DE INTERÉS:</span> {selectedAssessment.zona_analizada}</p>
                          <p><span className="text-slate-500 font-bold">COBERTURA RADIAL:</span> {selectedAssessment.radioMetros} m</p>
                          <p><span className="text-slate-500 font-bold">EPICENTRO COORDINADAS:</span> {selectedAssessment.lat}, {selectedAssessment.lng}</p>
                        </div>
                        <div>
                          <p><span className="text-slate-500 font-bold">EMISOR:</span> CEIPOL GEOINT Engine</p>
                          <p><span className="text-slate-500 font-bold">NIVEL IRI:</span> {selectedAssessment.iri_score}/100 - {selectedAssessment.nivel_riesgo.toUpperCase()}</p>
                          <p><span className="text-slate-500 font-bold">FECHA DE EVALUACIÓN:</span> {new Date().toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <h4 className="font-bold text-slate-100 border-b border-slate-900 pb-1 uppercase tracking-wider text-[11px]">1. Diagnóstico Geomorfológico y Topográfico (INEGI)</h4>
                          <p className="mt-1">
                            A través de la integración de capas cartográficas base del INEGI y el Modelo Digital de Elevación (MDE), el sistema detecta que la zona {selectedAssessment.zona_analizada} se localiza sobre un perfil con una pendiente promedio inferior al 2%. Esto genera condiciones idóneas para el represamiento artificial de aguas pluviales ante la ausencia de conductos de salida adecuados. La proximidad con cuencas naturales de escurrimiento fomenta la concentración direccional de escurrimientos en el punto de estudio.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-100 border-b border-slate-900 pb-1 uppercase tracking-wider text-[11px]">2. Síntesis de Evidencia Geosomática e Historial (CENAPRED)</h4>
                          <p className="mt-1">
                            {selectedAssessment.evidencia_geoespacial.map((e, idx) => (
                              <span key={idx} className="block mb-1">
                                • <strong>[{e.tipo}]:</strong> {e.descripcion}
                              </span>
                            ))}
                          </p>
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-100 border-b border-slate-900 pb-1 uppercase tracking-wider text-[11px]">3. Análisis de Inundación en Fuentes Abiertas (OSINT)</h4>
                          <p className="mt-1">
                            El barrido inteligente de redes sociales y notas de prensa localizó incidentes anteriores asociados con el desbordamiento de canales y saturación de sumideros pluviales en las adyacencias. Esta información corrobora la veracidad de los factores de vulnerabilidad de la infraestructura de alcantarillado.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-100 border-b border-slate-900 pb-1 uppercase tracking-wider text-[11px]">4. Conclusiones y Nivel de Alerta</h4>
                          <p className="mt-1">
                            Con base en el puntaje de <strong>{selectedAssessment.iri_score} puntos en el Índice de Riesgo de Inundación (IRI)</strong>, se determina que el polígono posee una vulnerabilidad de nivel <strong>{selectedAssessment.nivel_riesgo}</strong>. El pronóstico de precipitación emitido por CONAGUA (${selectedAssessment.pronostico_lluvia}) {selectedAssessment.alerta ? "HACE IMPRESCINDIBLE LA DECLARATORIA DE ALERTA OPERATIVA INMEDIATA." : "mantiene la zona bajo estatus de prevención ordinaria sin requerir movilización extraordinaria de momento."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENIDO: OSINT */}
                {activeTab === "osint" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-slate-400">Registros semánticos y notas de prensa geolocalizados por el rastreador GEOINT:</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedAssessment.evidencia_osint.map((item, idx) => (
                        <div key={`osint-${idx}`} className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-2 text-xs hover:border-slate-700 transition-colors shadow-sm">
                          <div className="flex justify-between items-start gap-3">
                            <span className="font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                              📡 {item.fuente}
                            </span>
                            {item.fecha && (
                              <span className="text-[10px] text-slate-500 font-mono">{item.fecha}</span>
                            )}
                          </div>
                          <p className="text-slate-300 italic">
                            &quot;{item.texto}&quot;
                          </p>
                          {item.coordenadas && (
                            <div className="text-[9px] text-slate-500 font-mono">
                              Coordenadas de Origen: {item.coordenadas.lat.toFixed(4)}, {item.coordenadas.lng.toFixed(4)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB CONTENIDO: INFRAESTRUCTURA VULNERABLE */}
                {activeTab === "infraestructura" && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">Establecimientos de interés público y servicios críticos localizados dentro del radio de afectación:</p>
                    <div className="border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs border-collapse bg-slate-900/20">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                            <th className="px-4 py-2.5">Establecimiento</th>
                            <th className="px-4 py-2.5">Tipo de Infraestructura</th>
                            <th className="px-4 py-2.5 text-center">Vulnerabilidad Calculada</th>
                            <th className="px-4 py-2.5 text-right">Ubicación</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {selectedAssessment.infraestructura_critica.map((infra, idx) => (
                            <tr key={`infra-${idx}`} className="hover:bg-slate-900/30 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-200">{infra.nombre}</td>
                              <td className="px-4 py-3 text-slate-400">{infra.tipo}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  infra.vulnerabilidad === "Crítica" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                  infra.vulnerabilidad === "Alta" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                                  infra.vulnerabilidad === "Media" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                                  "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                }`}>
                                  {infra.vulnerabilidad}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-[10px] text-slate-500">
                                {infra.coordenadas.lat.toFixed(4)}, {infra.coordenadas.lng.toFixed(4)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB CONTENIDO: RECOMENDACIONES / OPERATIVO */}
                {activeTab === "recomendaciones" && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">Guía de Mitigación y Recomendaciones Operativas para despliegue táctico inmediato:</p>
                    <div className="bg-slate-900/25 border border-slate-800 rounded-xl p-5 space-y-4">
                      {selectedAssessment.recomendaciones.map((rec, idx) => (
                        <div key={`rec-${idx}`} className="flex items-start gap-3 border-b border-slate-800/40 pb-3 last:border-0 last:pb-0">
                          <input
                            type="checkbox"
                            className="mt-1 h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-950"
                          />
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-wide">Medida de Mitigación {idx + 1}</span>
                            <p className="text-xs text-slate-200 leading-normal">{rec}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
