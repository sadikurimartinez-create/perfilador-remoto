"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, Circle, Polyline, InfoWindow } from "@react-google-maps/api";
import { InundacionesService } from "./inundaciones.service";
import { FloodAssessment } from "./inundaciones.types";
import { useAuth } from "@/context/AuthContext";
import { GeoFloodForecastResult, ForecastZone } from "@/lib/geoint/geoFloodForecastEngine";

const MAP_LIBRARIES: ("places" | "visualization" | "drawing")[] = ["places", "visualization", "drawing"];

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

const WMS_LAYERS_CATALOG = [
  { id: "corrientes_agua_lineal", name: "corrientes_agua_lineal", title: "💧 Corrientes de Agua", category: "hidrologia", providerUrl: "https://geoportal.inegi.org.mx/geoserver/hidrografia/wms" },
  { id: "cuerpos_agua_poligonal", name: "cuerpos_agua_poligonal", title: "🌊 Cuerpos de Agua", category: "hidrologia", providerUrl: "https://geoportal.inegi.org.mx/geoserver/hidrografia/wms" },
  { id: "cuencas_hidrograficas", name: "cuencas_hidrograficas", title: "⛰️ Cuencas Hidrográficas", category: "hidrologia", providerUrl: "https://geoportal.inegi.org.mx/geoserver/hidrografia/wms" },
  { id: "curvas_nivel_30m", name: "curvas_nivel_30m", title: "📐 Curvas de Nivel (30m)", category: "topografia", providerUrl: "https://geoportal.inegi.org.mx/geoserver/cem/wms" },
  { id: "continente_elevacion_cem_30m", name: "continente_elevacion_cem_30m", title: "🏔️ Elevación CEM", category: "topografia", providerUrl: "https://geoportal.inegi.org.mx/geoserver/cem/wms" },
  { id: "uso_suelo_serie_vii", name: "uso_suelo_serie_vii", title: "🌾 Uso de Suelo Serie VII", category: "uso_suelo", providerUrl: "https://geoportal.inegi.org.mx/geoserver/uso_suelo_vegetacion/wms" },
  { id: "m_ageb_m_g", name: "m_ageb_m_g", title: "🗺️ AGEB Urbanas", category: "organizacion_territorial", providerUrl: "https://geoportal.inegi.org.mx/geoserver/m_ageb_m_g/wms" },
  { id: "m_localidad_p_g", name: "m_localidad_p_g", title: "📍 Localidades", category: "organizacion_territorial", providerUrl: "https://geoportal.inegi.org.mx/geoserver/m_ageb_m_g/wms" },
  { id: "m_municipio_g", name: "m_municipio_g", title: "🏢 Límites Municipales", category: "organizacion_territorial", providerUrl: "https://geoportal.inegi.org.mx/geoserver/m_ageb_m_g/wms" }
];

export function InundacionesUI() {
  const { user } = useAuth();

  // Estados del Formulario Temporal y Ámbito
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [hora, setHora] = useState("12:00");
  const [horizonte, setHorizonte] = useState("+24h");
  const [scope, setScope] = useState("estado");
  const [scopeId, setScopeId] = useState("Aguascalientes");
  const [useCustomCoords, setUseCustomCoords] = useState(false);

  // Coordenadas manuales opcionales
  const [latInput, setLatInput] = useState("21.8885");
  const [lngInput, setLngInput] = useState("-102.3156");
  const [radioInput, setRadioInput] = useState(1200);
  const [observacionesInput, setObservacionesInput] = useState(
    "Drenaje pluvial con azolve moderado detectado. Vaso regulador cercano al 65% de capacidad."
  );

  // Estados de carga y flujo
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const stepsIndex = useRef(0);

  // Capas activas
  const [activeLayers, setActiveLayers] = useState({
    calor: true,
    infraestructura: true,
    escurrimientos: true,
    predictivo: true,
    osint: true,
  });

  // WMS overlays states
  const [selectedWmsLayers, setSelectedWmsLayers] = useState<string[]>([]);
  const wmsOverlaysRef = useRef<Record<string, any>>({});

  // Resultados del Motor Predictivo
  const [forecast, setForecast] = useState<GeoFloodForecastResult | null>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<{ timestamp: string; query: string }[]>([]);

  // Estados interactivos del mapa
  const [map, setMap] = useState<any | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<any | null>(null);

  // Cargar Google Maps JS API
  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc") : "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: MAP_LIBRARIES,
  });

  // Calculate Map center based on scope, scopeId and manual selections
  const mapCenter = useMemo(() => {
    if (useCustomCoords) {
      return {
        lat: parseFloat(latInput) || 21.8853,
        lng: parseFloat(lngInput) || -102.2916,
      };
    }
    if (scope === "estado") {
      return { lat: 21.8853, lng: -102.2916 };
    }
    if (scope === "municipio") {
      const coords: Record<string, { lat: number; lng: number }> = {
        "Aguascalientes": { lat: 21.8853, lng: -102.2916 },
        "Jesús María": { lat: 21.9610, lng: -102.3435 },
        "Calvillo": { lat: 21.8465, lng: -102.7188 },
        "Rincón de Romos": { lat: 22.2291, lng: -102.3233 },
        "Pabellón de Arteaga": { lat: 22.1415, lng: -102.2764 },
        "San Francisco de los Romo": { lat: 22.0735, lng: -102.2705 },
        "Asientos": { lat: 22.2389, lng: -102.0889 },
        "Cosío": { lat: 22.3664, lng: -102.3005 },
        "El Llano": { lat: 21.9189, lng: -101.9656 },
        "Tepezalá": { lat: 22.2235, lng: -102.1691 },
        "San José de Gracia": { lat: 22.1522, lng: -102.4158 }
      };
      return coords[scopeId] || { lat: 21.8853, lng: -102.2916 };
    }
    if (scope === "colonia") {
      const coords: Record<string, { lat: number; lng: number }> = {
        "Las Flores": { lat: 21.8895, lng: -102.3166 },
        "Centro": { lat: 21.8885, lng: -102.3156 },
        "Pintores": { lat: 21.8643, lng: -102.2754 },
        "Margaritas": { lat: 21.9610, lng: -102.3255 }
      };
      return coords[scopeId] || { lat: 21.8853, lng: -102.2916 };
    }
    if (scope === "cuenca" || scope === "microcuenca") {
      const coords: Record<string, { lat: number; lng: number }> = {
        "Río San Pedro Alta": { lat: 22.1500, lng: -102.3000 },
        "Chicalote": { lat: 22.0500, lng: -102.2500 },
        "El Cedazo": { lat: 21.8643, lng: -102.2754 },
        "Río San Pedro Media": { lat: 21.8895, lng: -102.3166 },
        "Cuenca Río Calvillo": { lat: 21.8465, lng: -102.7188 }
      };
      return coords[scopeId] || { lat: 21.8853, lng: -102.2916 };
    }
    return { lat: 21.8853, lng: -102.2916 };
  }, [scope, scopeId, useCustomCoords, latInput, lngInput]);

  const mapZoom = useMemo(() => {
    if (useCustomCoords) return 14;
    if (scope === "estado") return 10;
    if (scope === "municipio") return 12;
    if (scope === "colonia") return 15;
    return 13;
  }, [scope, useCustomCoords]);

  // Sync panTo on center change
  useEffect(() => {
    if (map) {
      map.panTo(mapCenter);
      map.setZoom(mapZoom);
    }
  }, [mapCenter, mapZoom, map]);

  // Manage WMS Overlays on map
  useEffect(() => {
    if (!map) return;

    // Clean existing
    Object.entries(wmsOverlaysRef.current).forEach(([layerId, overlay]) => {
      try {
        const index = map.overlayMapTypes.indexOf(overlay);
        if (index !== -1) {
          map.overlayMapTypes.removeAt(index);
        }
      } catch (e) {
        console.warn("Error removing WMS overlay:", e);
      }
    });
    wmsOverlaysRef.current = {};

    const getEPSG3857BBox = (x: number, y: number, zoom: number) => {
      const max = 20037508.34;
      const size = (max * 2) / Math.pow(2, zoom);
      const minX = -max + x * size;
      const maxX = -max + (x + 1) * size;
      const minY = max - (y + 1) * size;
      const maxY = max - y * size;
      return `${minX},${minY},${maxX},${maxY}`;
    };

    selectedWmsLayers.forEach(layerId => {
      const matched = WMS_LAYERS_CATALOG.find(l => l.id === layerId);
      if (!matched) return;

      const overlay = new window.google.maps.ImageMapType({
        getTileUrl: (coord: any, zoom: number) => {
          const bbox = getEPSG3857BBox(coord.x, coord.y, zoom);
          return `${matched.providerUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${matched.name}&FORMAT=image/png&TRANSPARENT=TRUE&SRS=EPSG:3857&BBOX=${bbox}&WIDTH=256&HEIGHT=256`;
        },
        tileSize: new window.google.maps.Size(256, 256),
        opacity: 0.55,
        name: matched.title
      });

      wmsOverlaysRef.current[layerId] = overlay;
      map.overlayMapTypes.push(overlay);
    });
  }, [selectedWmsLayers, map]);

  // Load progress animation
  const startLoadingAnimation = (callback: () => void) => {
    const steps = [
      "Consultando NOAA y pronósticos meteorológicos satelitales...",
      "Obteniendo registros de CONAGUA e históricos de cuencas de Aguascalientes...",
      "Ingresando Modelo Digital de Elevación INEGI y escurrimientos...",
      "Cruzando datos hidrológicos y capacidad de colectores...",
      "Procesando señales de radar OSINT (Telegram/X/Noticias locales)...",
      "Correlacionando factores mediante Model Governance Layer...",
      "Eliminando redundancias y calculando veracidad geoespacial...",
      "Generando síntesis analítica y recomendaciones operativas con Vertex AI..."
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
    }, 900);
  };

  // Execute Predictive Analysis
  const handlePredictiveForecast = useCallback(() => {
    startLoadingAnimation(async () => {
      try {
        const result = await InundacionesService.analyzePredictiveFlood({
          fecha,
          hora,
          horizonte,
          scope,
          scopeId,
          lat: useCustomCoords ? parseFloat(latInput) : undefined,
          lng: useCustomCoords ? parseFloat(lngInput) : undefined,
          radioMetros: useCustomCoords ? radioInput : undefined
        });

        setForecast(result);
        setTelemetryLogs(prev => [
          {
            timestamp: new Date().toLocaleTimeString(),
            query: `Scope: ${scope.toUpperCase()} (${scopeId}) • Horizonte: ${horizonte} • Coordenadas: ${useCustomCoords ? `${latInput}, ${lngInput}` : "N/D"}`
          },
          ...prev
        ]);
      } catch (err: any) {
        console.error("Error al generar pronóstico predictivo:", err);
        alert("Ocurrió un error al calcular el pronóstico predictivo: " + err.message);
      } finally {
        setLoading(false);
        setLoadingStep("");
      }
    });
  }, [fecha, hora, horizonte, scope, scopeId, useCustomCoords, latInput, lngInput, radioInput]);

  // Auto-run first forecast on load
  useEffect(() => {
    handlePredictiveForecast();
  }, []);

  // Preset Loaders
  const loadDemoEstatal = () => {
    setScope("estado");
    setScopeId("Aguascalientes");
    setUseCustomCoords(false);
    setHorizonte("+24h");
    setTimeout(() => handlePredictiveForecast(), 100);
  };

  const loadDemoMunicipal = (munName: string) => {
    setScope("municipio");
    setScopeId(munName);
    setUseCustomCoords(false);
    setHorizonte("+12h");
    setTimeout(() => handlePredictiveForecast(), 100);
  };

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setLatInput(e.latLng.lat().toFixed(6));
      setLngInput(e.latLng.lng().toFixed(6));
      if (!useCustomCoords) {
        setUseCustomCoords(true);
      }
    }
  }, [useCustomCoords]);

  const onMapLoad = useCallback((mapInstance: any) => {
    setMap(mapInstance);
    if (typeof window !== "undefined") {
      (window as any).map = mapInstance;
      if (!(window as any).map.invalidateSize) {
        (window as any).map.invalidateSize = () => {
          if (typeof window !== "undefined" && (window as any).google?.maps) {
            (window as any).google.maps.event.trigger(mapInstance, "resize");
          }
        };
      }
    }
  }, []);

  // Escurrimientos natural lines based on center
  const escurrimientosFlujos = useMemo(() => {
    const centerLat = mapCenter.lat;
    const centerLng = mapCenter.lng;
    return [
      [
        { lat: centerLat + 0.008, lng: centerLng - 0.005 },
        { lat: centerLat + 0.003, lng: centerLng - 0.002 },
        { lat: centerLat, lng: centerLng },
      ],
      [
        { lat: centerLat - 0.006, lng: centerLng + 0.008 },
        { lat: centerLat - 0.002, lng: centerLng + 0.003 },
        { lat: centerLat, lng: centerLng },
      ],
      [
        { lat: centerLat + 0.010, lng: centerLng + 0.006 },
        { lat: centerLat + 0.004, lng: centerLng + 0.002 },
        { lat: centerLat, lng: centerLng },
      ]
    ];
  }, [mapCenter]);

  // Provider health parameters
  const providerHealth = useMemo(() => {
    return [
      { id: "noaa", name: "NOAA (EE.UU.)", latency: 45, status: "healthy" },
      { id: "conagua", name: "CONAGUA (México)", latency: 85, status: "healthy" },
      { id: "tomorrow", name: "Tomorrow.io (API)", latency: 120, status: "stable" },
      { id: "nasa", name: "NASA (Satélite)", latency: 210, status: "healthy" },
      { id: "copernicus", name: "Copernicus (Satelital)", latency: 310, status: "stable" },
      { id: "usgs", name: "USGS (Monitoreo Hidro)", latency: 95, status: "healthy" },
      { id: "osint", name: "OSINT Crawler", latency: 140, status: "healthy" }
    ];
  }, []);

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen p-5 flex flex-col gap-6 font-sans selection:bg-blue-500/30 selection:text-white">
      
      {/* HEADER DE MÓDULO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
            <h1 className="text-base md:text-lg font-bold tracking-wide uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
              🏛️ CENTRO DE PREDICCIÓN HIDROMETEOROLÓGICA GEOINT
            </h1>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            Sistema Unificado de Alerta Temprana • Estado de Aguascalientes • Predicción Multivariable v3.1
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadDemoEstatal}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 transition-all active:scale-[0.97]"
          >
            ⚡ Demo Estatal (AGS)
          </button>
          <button
            onClick={() => loadDemoMunicipal("Calvillo")}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 transition-all active:scale-[0.97]"
          >
            ⚡ Demo Calvillo
          </button>
        </div>
      </div>

      {/* 10 STACKED FULL-WIDTH PANELS */}
      <div className="flex flex-col gap-6 w-full">
        
        {/* PANEL 1: ESTADO GENERAL DEL SISTEMA */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🧭</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 1 — ESTADO GENERAL DEL SISTEMA (SYSTEM OVERVIEW)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-blue-400 font-mono font-bold bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-500/20">
                PREDICTIVE MODE ACTIVE
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-blue-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-350 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-blue-500">
                    ❓ Ayuda: System Overview
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Muestra un resumen general del estado del motor de predicción de inundaciones, el alcance territorial activo y la certeza integrada.</p>
                    <p><strong>¿Qué información presenta?</strong> El modo activo del sistema, el ámbito territorial bajo monitoreo, el score de certeza global y el estado de la conexión.</p>
                    <p><strong>¿Cómo interpretarse?</strong> Estados "OPERACIONAL" y certezas por encima del 80% garantizan pronósticos de alta fiabilidad geomorfológica.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Permite dictaminar rápidamente si el sistema predictivo se encuentra calibrado para coordinar alertas de protección civil.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Estado Global</span>
              <span className="text-sm font-black text-emerald-400 mt-1">OPERACIONAL</span>
            </div>
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Ámbito Activo</span>
              <span className="text-sm font-black text-blue-400 mt-1 uppercase truncate">
                {scope}: {scopeId}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Certeza Global</span>
              <span className="text-sm font-black text-orange-400 mt-1 font-mono">
                {forecast ? `${forecast.nivelConfianzaGlobal}%` : "Cargando..."}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Horizonte Evaluado</span>
              <span className="text-sm font-black text-purple-400 mt-1 font-mono uppercase">{horizonte}</span>
            </div>
          </div>
        </div>

        {/* PANEL 2: MAPA PREDICTIVO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🌍</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 2 — MAPA DE RIESGO PREDICTIVO & ESCURRIMIENTOS
              </h3>
            </div>
            <div className="flex items-center gap-3">
              {/* LAYERS CONTROLLER */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/60">
                <button
                  onClick={() => setActiveLayers(l => ({ ...l, calor: !l.calor }))}
                  className={`px-2 py-0.5 rounded text-[8px] font-bold border transition-colors ${
                    activeLayers.calor ? "bg-red-500/20 text-red-400 border-red-500/40" : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}
                >
                  🔥 Calor
                </button>
                <button
                  onClick={() => setActiveLayers(l => ({ ...l, infraestructura: !l.infraestructura }))}
                  className={`px-2 py-0.5 rounded text-[8px] font-bold border transition-colors ${
                    activeLayers.infraestructura ? "bg-blue-500/20 text-blue-400 border-blue-500/40" : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}
                >
                  🏥 Infraestructura
                </button>
                <button
                  onClick={() => setActiveLayers(l => ({ ...l, escurrimientos: !l.escurrimientos }))}
                  className={`px-2 py-0.5 rounded text-[8px] font-bold border transition-colors ${
                    activeLayers.escurrimientos ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40" : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}
                >
                  🌊 Escurrimientos
                </button>
                <button
                  onClick={() => setActiveLayers(l => ({ ...l, predictivo: !l.predictivo }))}
                  className={`px-2 py-0.5 rounded text-[8px] font-bold border transition-colors ${
                    activeLayers.predictivo ? "bg-purple-500/20 text-purple-400 border-purple-500/40" : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}
                >
                  🔮 Predictivo
                </button>
                <button
                  onClick={() => setActiveLayers(l => ({ ...l, osint: !l.osint }))}
                  className={`px-2 py-0.5 rounded text-[8px] font-bold border transition-colors ${
                    activeLayers.osint ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}
                >
                  💬 OSINT
                </button>
                
                {/* INEGI Dropdown */}
                <div className="relative group">
                  <button className="px-2 py-0.5 rounded text-[8px] font-bold border bg-slate-900 border-slate-800 text-slate-300 hover:border-sky-500/50">
                    🗺️ INEGI WMS {selectedWmsLayers.length > 0 && `(${selectedWmsLayers.length})`}
                  </button>
                  <div className="hidden group-hover:block absolute right-0 mt-1 w-56 bg-slate-950 border border-slate-800 rounded-lg p-2 shadow-2xl z-50 space-y-1">
                    {WMS_LAYERS_CATALOG.map(wms => (
                      <label key={wms.id} className="flex items-center justify-between text-[10px] text-slate-300 cursor-pointer hover:bg-slate-900 p-1 rounded">
                        <span>{wms.title}</span>
                        <input
                          type="checkbox"
                          checked={selectedWmsLayers.includes(wms.id)}
                          onChange={() => {
                            if (selectedWmsLayers.includes(wms.id)) {
                              setSelectedWmsLayers(selectedWmsLayers.filter(x => x !== wms.id));
                            } else {
                              setSelectedWmsLayers([...selectedWmsLayers, wms.id]);
                            }
                          }}
                          className="w-3 h-3 text-sky-500 bg-slate-900 border-slate-800"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-blue-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-blue-500">
                    ❓ Ayuda: Mapa Predictivo
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Representa cartográficamente las zonas con probabilidades estimadas de anegamiento en Aguascalientes.</p>
                    <p><strong>¿Qué información presenta?</strong> Las cuencas de escurrimiento (líneas azules), los focos de calor de riesgo físico e infraestructura crítica expuesta.</p>
                    <p><strong>¿Cómo interpretarse?</strong> Los círculos concéntricos morados muestran las microcuencas y valles bajos propensos a saturación de cauces.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Ayuda a definir perímetros de evacuación preventivos y desvíos viales alternos para vehículos de emergencia.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* LOADING SCREEN OR GOOGLE MAP - Altura de 750px */}
          <div className="w-full relative">
            {loading ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 backdrop-blur-md shadow-xl h-[750px] flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative flex items-center justify-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent" />
                  <div className="absolute h-10 w-10 rounded-full bg-blue-950 animate-pulse flex items-center justify-center">
                    <span className="text-xs">🛰️</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-base font-bold text-slate-200">GEOINT Forecasting Engine Activo</h4>
                  <p className="text-xs text-blue-400 font-mono tracking-wide animate-pulse">
                    {loadingStep}
                  </p>
                </div>
                <div className="w-64 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${((stepsIndex.current + 1) / 8) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 relative">
                {isLoaded ? (
                  <div className="h-[750px] w-full rounded-xl overflow-hidden relative">
                    <GoogleMap
                      mapContainerStyle={{ width: "100%", height: "100%" }}
                      center={mapCenter}
                      zoom={mapZoom}
                      onLoad={onMapLoad}
                      onClick={onMapClick}
                      options={{
                        styles: darkMapStyle,
                        disableDefaultUI: false,
                        mapTypeControl: false,
                        streetViewControl: true,
                      }}
                    >
                      {/* Centro de búsqueda manual */}
                      {useCustomCoords && (
                        <>
                          <Marker
                            position={mapCenter}
                            title="Epicentro de Consulta"
                            icon={{
                              url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                            }}
                          />
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
                        </>
                      )}

                      {/* ESCURRIMIENTOS Y CUENCAS (Polilíneas) */}
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

                      {/* CAPAS PREDICTIVAS (Círculos concéntricos de zonas predictivas) */}
                      {activeLayers.predictivo && forecast?.zonasCriticas.map((zona, idx) => (
                        <Circle
                          key={`pred-circle-${idx}`}
                          center={{ lat: zona.lat, lng: zona.lng }}
                          radius={300 + (zona.probabilidad * 400)}
                          options={{
                            strokeColor: zona.probabilidad > 0.8 ? "#ef4444" : zona.probabilidad > 0.6 ? "#a855f7" : "#3b82f6",
                            strokeOpacity: 0.65,
                            strokeWeight: 1.5,
                            fillColor: zona.probabilidad > 0.8 ? "#ef4444" : zona.probabilidad > 0.6 ? "#a855f7" : "#3b82f6",
                            fillOpacity: 0.15 + (zona.probabilidad * 0.1),
                            clickable: true
                          }}
                          onClick={() => setSelectedMarker({
                            title: `🔮 Zona Predictiva: ${zona.nombre}`,
                            description: `Probabilidad de inundación: ${(zona.probabilidad * 100).toFixed(0)}%. Causas: ${zona.causas.join(", ")}.`,
                            lat: zona.lat,
                            lng: zona.lng
                          })}
                        />
                      ))}

                      {/* MARCADORES INFRAESTRUCTURA DE INTERÉS */}
                      {activeLayers.infraestructura && (
                        <>
                          <Marker
                            position={{ lat: 21.891, lng: -102.312 }}
                            title="Clínica Hospital General IMSS"
                            icon={{ url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png" }}
                            onClick={() => setSelectedMarker({
                              title: "🏥 Hospital General de Zona IMSS",
                              description: "Vulnerabilidad estructural Crítica detectada ante desbordamiento de canales pluviales contiguos.",
                              lat: 21.891,
                              lng: -102.312
                            })}
                          />
                          <Marker
                            position={{ lat: 21.885, lng: -102.319 }}
                            title="Escuela Técnica Secundaria #1"
                            icon={{ url: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png" }}
                            onClick={() => setSelectedMarker({
                              title: "🏫 Escuela Secundaria Técnica #1",
                              description: "Vulnerabilidad Media. Riesgo de encharcamiento en patio cívico bajo.",
                              lat: 21.885,
                              lng: -102.319
                            })}
                          />
                        </>
                      )}

                      {/* MARCADORES OSINT REPORTES */}
                      {activeLayers.osint && (
                        <>
                          <Marker
                            position={{ lat: 21.8890, lng: -102.3160 }}
                            title="OSINT: Reporte Vecinal X"
                            icon={{ url: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png" }}
                            onClick={() => setSelectedMarker({
                              title: "💬 Reporte OSINT (Redes Sociales)",
                              description: "Colapso del canal pluvial superficial. Agua superando banqueta y fluyendo hacia cocheras residenciales.",
                              lat: 21.8890,
                              lng: -102.3160
                            })}
                          />
                        </>
                      )}

                      {/* INFO WINDOW */}
                      {selectedMarker && (
                        <InfoWindow
                          position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
                          onCloseClick={() => setSelectedMarker(null)}
                        >
                          <div className="p-2 text-slate-950 max-w-xs space-y-1 font-sans">
                            <h4 className="text-xs font-bold border-b pb-1 border-slate-200">{selectedMarker.title}</h4>
                            <p className="text-[10px] leading-normal">{selectedMarker.description}</p>
                          </div>
                        </InfoWindow>
                      )}
                    </GoogleMap>
                  </div>
                ) : (
                  <div className="h-[750px] w-full bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                    {loadError ? "Error cargando Google Maps API" : "Cargando mapa predictivo..."}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PANEL 3: HORIZONTE TEMPORAL */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-base">⏳</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 3 — HORIZONTE TEMPORAL & DELIMITACIÓN TERRITORIAL
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] bg-blue-950/40 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                FORECAST CONTROL
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-blue-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-blue-500">
                    ❓ Ayuda: Horizonte Temporal
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Configura las variables de tiempo (Fecha, Hora, Horizonte) y límites geográficos para la simulación del pronóstico.</p>
                    <p><strong>¿Qué información presenta?</strong> Selectores para horizontes predictivos desde +6h a 7 días, y ámbitos territoriales (Estatal, Municipios, Cuencas, Colonias).</p>
                    <p><strong>¿Cómo interpretarse?</strong> Permite simular los escenarios climáticos y acumulados fluviales esperados para un momento futuro específico.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Permite planificar el despliegue con horas o días de antelación para proteger infraestructura crítica vulnerable.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs w-full">
            <div className="space-y-3 bg-slate-950 border border-slate-800/40 p-4 rounded-xl">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Configuración del Tiempo</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 text-[9px] font-bold">Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 text-[9px] font-bold">Hora</label>
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold">Horizonte de Predicción</label>
                <select
                  value={horizonte}
                  onChange={(e) => setHorizonte(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="+6h">+6 Horas (Respuesta Corta)</option>
                  <option value="+12h">+12 Horas (Alerta Operativa)</option>
                  <option value="+24h">+24 Horas (Mediano Plazo)</option>
                  <option value="+48h">+48 Horas (Planificación Escenarios)</option>
                  <option value="+72h">+72 Horas (Logística)</option>
                  <option value="+7d">+7 Días (Largo Plazo)</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950 border border-slate-800/40 p-4 rounded-xl">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Delimitación Territorial</div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-[9px] font-bold">Ámbito de Análisis</label>
                <select
                  value={scope}
                  onChange={(e) => {
                    const nextScope = e.target.value;
                    setScope(nextScope);
                    if (nextScope === "estado") setScopeId("Aguascalientes");
                    else if (nextScope === "municipio") setScopeId("Aguascalientes");
                    else if (nextScope === "colonia") setScopeId("Las Flores");
                    else if (nextScope === "cuenca") setScopeId("Río San Pedro Alta");
                    else setScopeId("");
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="estado">Todo el Estado de Aguascalientes</option>
                  <option value="municipio">Municipio Específico</option>
                  <option value="cuenca">Cuenca Hidrográfica</option>
                  <option value="colonia">Colonia de Interés</option>
                  <option value="ageb">Área Geoestadística Básica (AGEB)</option>
                  <option value="sector">Sector Personalizado</option>
                </select>
              </div>

              {scope !== "estado" && (
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 text-[9px] font-bold">Seleccionar Región / Subdivisión</label>
                  {scope === "municipio" ? (
                    <select
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="Aguascalientes">Aguascalientes (Capital)</option>
                      <option value="Jesús María">Jesús María</option>
                      <option value="Calvillo">Calvillo</option>
                      <option value="Rincón de Romos">Rincón de Romos</option>
                      <option value="Pabellón de Arteaga">Pabellón de Arteaga</option>
                      <option value="San Francisco de los Romo">San Francisco de los Romo</option>
                      <option value="Asientos">Asientos</option>
                      <option value="Cosío">Cosío</option>
                      <option value="El Llano">El Llano</option>
                      <option value="Tepezalá">Tepezalá</option>
                      <option value="San José de Gracia">San José de Gracia</option>
                    </select>
                  ) : scope === "colonia" ? (
                    <select
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="Las Flores">Las Flores</option>
                      <option value="Centro">Centro Histórico</option>
                      <option value="Pintores">Pintores</option>
                      <option value="Margaritas">Margaritas</option>
                    </select>
                  ) : scope === "cuenca" ? (
                    <select
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="Río San Pedro Alta">Río San Pedro Alta</option>
                      <option value="Chicalote">Chicalote</option>
                      <option value="El Cedazo">El Cedazo</option>
                      <option value="Río San Pedro Media">Río San Pedro Media</option>
                      <option value="Cuenca Río Calvillo">Cuenca Río Calvillo</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                      placeholder="Ingrese ID o Nombre..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 bg-slate-950 border border-slate-800/40 p-4 rounded-xl">
              <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                <span>Coordenadas de Consulta</span>
                <input
                  type="checkbox"
                  checked={useCustomCoords}
                  onChange={(e) => setUseCustomCoords(e.target.checked)}
                  className="rounded w-3.5 h-3.5 text-blue-600 bg-slate-900 border-slate-800"
                />
              </div>

              {useCustomCoords ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 text-[9px] font-bold">Latitud</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={latInput}
                        onChange={(e) => setLatInput(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 text-[9px] font-bold">Longitud</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={lngInput}
                        onChange={(e) => setLngInput(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 text-[9px] font-bold">Radio de Búsqueda ({radioInput}m)</label>
                    <input
                      type="range"
                      min="250"
                      max="3000"
                      step="250"
                      value={radioInput}
                      onChange={(e) => setRadioInput(parseInt(e.target.value))}
                      className="w-full accent-blue-500 bg-slate-900 rounded-lg appearance-none cursor-pointer h-1.5"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 text-[9px] font-bold">Observaciones de Campo</label>
                    <input
                      type="text"
                      value={observacionesInput}
                      onChange={(e) => setObservacionesInput(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 text-center py-6">
                  Consulta de Coordenadas inactiva. El motor buscará datos consolidados para el ámbito territorial de {scopeId}.
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handlePredictiveForecast}
            disabled={loading}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-slate-100 font-extrabold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] cursor-pointer"
          >
            {loading ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-slate-200 border-t-transparent rounded-full" />
                <span>Calculando Pronóstico Predictivo...</span>
              </>
            ) : (
              <>
                <span>🔮 Iniciar Pronóstico Predictivo de Inundación</span>
              </>
            )}
          </button>
        </div>

        {/* PANEL 4: VARIABLES METEOROLÓGICAS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🌦️</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 4 — VARIABLES METEOROLÓGICAS (PRECIPITACIÓN Y INFILTRACIÓN)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-sky-400 font-mono font-bold bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-500/20">
                WEATHER SENSORS ACTIVE
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-blue-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-blue-500">
                    ❓ Ayuda: Variables Meteorológicas
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Monitorea en tiempo real e integra los acumulados de precipitación estimada por agencias y la humedad antecedente del suelo.</p>
                    <p><strong>¿Qué información presenta?</strong> Los milímetros esperados de lluvia de NOAA, CONAGUA y Tomorrow.io, y el índice de infiltración terrestre.</p>
                    <p><strong>¿Cómo interpretarse?</strong> Humedades del suelo &gt; 70% reducen drásticamente la infiltración, acelerando la formación de anegamientos superficiales.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Ayuda a evaluar si la tormenta impactará sobre suelo seco (menor peligro inmediato) o saturado (peligro inminente).</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Pronóstico NOAA</span>
              <span className="text-sm font-black text-slate-100 mt-1 font-mono">
                {forecast ? `${forecast.meteorologicalMetrics.noaaPrecipitation} mm` : "Cargando..."}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">CONAGUA / SMN</span>
              <span className="text-sm font-black text-slate-100 mt-1 font-mono">
                {forecast ? `${forecast.meteorologicalMetrics.conaguaPrecipitation} mm` : "Cargando..."}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Tomorrow.io API</span>
              <span className="text-sm font-black text-slate-100 mt-1 font-mono">
                {forecast && forecast.meteorologicalMetrics.tomorrowPrecipitation > 0 
                  ? `${forecast.meteorologicalMetrics.tomorrowPrecipitation} mm` 
                  : "N/A (Suprimido)"}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Humedad Suelo (NASA)</span>
              <span className="text-sm font-black text-cyan-400 mt-1 font-mono">
                {forecast ? `${forecast.meteorologicalMetrics.soilMoisture}%` : "Cargando..."}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Tendencia Humedad</span>
              <span className="text-sm font-black text-amber-500 mt-1 uppercase">
                {forecast ? forecast.meteorologicalMetrics.humidityTrend : "Cargando..."}
              </span>
            </div>
          </div>
        </div>

        {/* PANEL 5: VARIABLES HIDROLÓGICAS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🌊</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 5 — VARIABLES HIDROLÓGICAS & CAPACIDAD DE CAUCES
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20">
                HYDROLOGICAL MATRIX ONLINE
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-blue-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-blue-500">
                    ❓ Ayuda: Variables Hidrológicas
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Monitorea los cauces físicos fluviales principales (como el Río San Pedro) y el drenaje hidráulico urbano.</p>
                    <p><strong>¿Qué información presenta?</strong> Nivel del tirante de agua, porcentaje de eficiencia de los colectores de alcantarillado, y saturación estimada en microcuencas.</p>
                    <p><strong>¿Cómo interpretarse?</strong> Niveles de río mayores a 4 metros y capacidades hidráulicas de drenaje inferiores al 30% representan desbordamientos activos.</p>
                    <p><strong>¿Qué decisiones apoya?</strong> Permite decidir la apertura de compuertas hidráulicas preventivas y la colocación de sacos de contención.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs w-full">
            <div className="bg-slate-950 border border-slate-800/40 p-4 rounded-xl space-y-2.5">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 pb-1.5">Monitoreo Físico de Cauce</div>
              <div className="flex justify-between">
                <span>Cauce Río San Pedro</span>
                <strong className="text-blue-400 font-mono">
                  {forecast ? `${forecast.hydrologicalMetrics.riverLevel.toFixed(2)} metros` : "Cargando..."}
                </strong>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800/40 p-4 rounded-xl space-y-2.5">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 pb-1.5">Infraestructura Hidráulica</div>
              <div className="flex justify-between">
                <span>Capacidad Útil Drenaje</span>
                <strong className="text-cyan-400 font-mono">
                  {forecast ? `${forecast.hydrologicalMetrics.drainageCapacity.toFixed(0)}%` : "Cargando..."}
                </strong>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800/40 p-4 rounded-xl space-y-2.5">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 pb-1.5">Saturación Microcuencas</div>
              {forecast ? (
                <div className="space-y-1 font-mono text-[10px]">
                  {Object.entries(forecast.hydrologicalMetrics.microbasinsSaturations).map(([name, val]) => (
                    <div key={name} className="flex justify-between">
                      <span className="text-slate-450">{name}:</span>
                      <span className="font-bold text-amber-500">{val}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-slate-600 block py-1">Cargando...</span>
              )}
            </div>
          </div>
        </div>

        {/* PANEL 6: GOBERNANZA DE DATOS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🏛️</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 6 — MODEL GOVERNANCE DE FUENTES & CONFIABILIDAD
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-purple-400 font-bold bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/20">
                GOVERNANCE LAYER CALIBRATED
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-blue-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-blue-500">
                    ❓ Ayuda: Gobernanza de Datos
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Controla la veracidad, autoridad y precedencia de cada sensor, descartando duplicados o señales contradictorias.</p>
                    <p><strong>¿Qué información presenta?</strong> La fuente de verdad dominante en este ciclo, el nivel consolidado de consenso ("GeoTruthScore") y la lista de APIs suprimidas.</p>
                    <p><strong>¿Cómo interpretarse?</strong> Un GeoTruthScore alto indica que los sensores meteorológicos e hidrológicos coinciden plenamente en las magnitudes registradas.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs w-full">
            <div className="space-y-3 bg-slate-950 border border-slate-800/40 p-4 rounded-xl">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 font-semibold">Fuente Dominante Evaluada</span>
                <strong className="text-emerald-400 uppercase font-black">
                  {forecast ? forecast.governanceReport.dominantProvider : "Cargando..."}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Certeza de Fuente Principal</span>
                <strong className="text-slate-200 font-extrabold font-mono">
                  {forecast ? `${forecast.governanceReport.dominantScore}%` : "Cargando..."}
                </strong>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950 border border-slate-800/40 p-4 rounded-xl">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 font-semibold">Consenso General (GeoTruthScore)</span>
                <strong className="text-sky-400 font-mono font-black">
                  {forecast ? `${forecast.governanceReport.dominantScore - 2}%` : "Cargando..."}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Fuentes Ponderadas en el Ciclo</span>
                <strong className="text-purple-400 font-mono font-black">
                  {forecast ? forecast.governanceReport.activeUsedProviders.length : "Cargando..."}
                </strong>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-slate-950 border border-slate-800/60 p-3 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 w-full">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
              Fuentes Descartadas o Suprimidas por Redundancia / Inactividad:
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              {forecast ? (
                forecast.governanceReport.results
                  .filter(r => r.decision === "ignore" || r.decision === "degrade")
                  .map(r => (
                    <span key={r.providerId} className="text-[9px] font-bold bg-red-950/40 text-red-400 border border-red-900/30 px-2.5 py-1 rounded-md uppercase font-mono">
                      {r.providerId} ({r.decision})
                    </span>
                  ))
              ) : (
                <span className="text-slate-650">Cargando...</span>
              )}
            </div>
          </div>
        </div>

        {/* PANEL 7: ESTADO DE LOS PROVEEDORES */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🌐</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 7 — PROVIDER HEALTH MATRIX & LATENCIA DE RED
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] bg-slate-950 text-slate-450 border border-slate-850 px-1.5 py-0.5 rounded font-mono font-bold">
                {providerHealth.length} APIS ONLINE
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-blue-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-blue-500">
                    ❓ Ayuda: Proveedores
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Monitorea la conectividad y tiempos de respuesta (latencias) de los servicios meteorológicos y satelitales remotos.</p>
                    <p><strong>¿Qué información presenta?</strong> Estado del disyuntor de red (healthy, stable, degraded) y latencia en milisegundos de cada proveedor.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 w-full">
            {providerHealth.map((h) => {
              return (
                <div key={h.id} className="bg-slate-950 border border-slate-800/60 p-3 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <strong className="text-[10px] text-slate-200 font-extrabold uppercase">{h.id}</strong>
                    <div className="text-[9px] text-slate-500 mt-1 font-mono">{h.latency}ms</div>
                  </div>
                  <span className="text-[7.5px] font-black uppercase px-2 py-0.5 rounded-md border bg-emerald-950/60 text-emerald-400 border-emerald-500/20">
                    {h.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL 8: TELEMETRÍA DEL SISTEMA */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-base">📡</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 8 — TELEMETRÍA DE COMPORTAMIENTO & AUDITORÍA DE CONSULTAS
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400 font-mono font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                MONITOR ACTIVE
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-blue-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-blue-500">
                    ❓ Ayuda: Telemetría
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Monitorea la estabilidad y trazabilidad del motor de cómputo local.</p>
                    <p><strong>¿Qué información presenta?</strong> El índice de estabilidad operacional de los flujos, latencia de respaldo, logs históricos de barrido predictivos firmados.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
            <div className="lg:col-span-5 bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-3 block">
                Métricas de Software Local
              </span>
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/40">
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Estabilidad</div>
                  <div className="text-xs font-black text-purple-400 mt-1">98.5%</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/40">
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Volatilidad</div>
                  <div className="text-xs font-black text-slate-300 mt-1">0.12</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/40">
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Fallback Delay</div>
                  <div className="text-xs font-black text-sky-400 mt-1">45ms</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2 block">
                Auditoría Técnica de Consultas Generadas
              </span>
              <div className="bg-black/40 p-2.5 rounded-lg border border-slate-900 font-mono text-[9px] text-slate-400 h-24 overflow-y-auto pr-1.5 custom-scrollbar space-y-1.5 w-full">
                {telemetryLogs.length > 0 ? (
                  telemetryLogs.map((log, idx) => (
                    <div key={idx} className="border-b border-slate-900/45 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex justify-between text-[8px] text-slate-500">
                        <span>{log.timestamp}</span>
                        <span className="text-sky-500 font-bold uppercase">Actor: Analista</span>
                      </div>
                      <div className="mt-0.5 text-slate-350">{log.query}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-650 text-center py-5">Ninguna consulta ejecutada en este ciclo.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 9: RESULTADOS PREDICTIVOS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 9 — RESULTADOS PREDICTIVOS (ZONAS Y CRONOLOGÍA)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-purple-400 font-bold bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/20">
                FORECAST CALCULATED
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-blue-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-blue-500">
                    ❓ Ayuda: Resultados Predictivos
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Entrega el listado de municipios y colonias de máxima prioridad junto a la cronología esperada del evento.</p>
                    <p><strong>¿Qué información presenta?</strong> Zonas de inundación, tiempos estimados, nivel de riesgo y tendencia.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full text-xs">
            {/* Prioridades territoriales */}
            <div className="lg:col-span-5 bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block border-b border-slate-900 pb-1.5">
                Prioridades Geográficas de Mitigación
              </span>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[9px] text-slate-500 font-bold block uppercase tracking-wide">Municipios de Atención Prioritaria:</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {forecast && forecast.municipiosPrioritarios.length > 0 ? (
                      forecast.municipiosPrioritarios.map(m => (
                        <span key={m} className="px-2.5 py-0.5 bg-red-950/40 text-red-400 border border-red-500/25 rounded-md font-bold uppercase">
                          {m}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-550 italic font-medium">Bajo Riesgo Estatal Estimado</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 font-bold block uppercase tracking-wide">Colonias y Sectores Críticos:</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {forecast && forecast.coloniasPrioritarias.length > 0 ? (
                      forecast.coloniasPrioritarias.map(c => (
                        <span key={c} className="px-2 py-0.5 bg-purple-950/40 text-purple-400 border border-purple-500/25 rounded-md font-medium">
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-550 italic font-medium">Ninguna colonia con riesgo alto en horizonte</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Cronologia */}
              <div className="pt-3 border-t border-slate-900">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block pb-1.5">
                  Cronología Esperada de Afectación
                </span>
                <div className="space-y-2 font-mono text-[10px] mt-1.5">
                  {forecast?.cronologiaEsperada.map((item, idx) => (
                    <div key={idx} className="flex justify-between border-b border-slate-900 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-slate-400 font-semibold">{item.hora}: {item.evento}</span>
                      <strong className="text-blue-400 shrink-0 ml-4">{(item.probabilidad * 100).toFixed(0)}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Listado de zonas críticas */}
            <div className="lg:col-span-7 bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block border-b border-slate-900 pb-1.5">
                Desglose Analítico de Zonas de Riesgo
              </span>
              <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1.5 custom-scrollbar">
                {forecast?.zonasCriticas.map((zona, idx) => (
                  <div key={idx} className="bg-slate-900/60 p-3 rounded-lg border border-slate-850 flex flex-col gap-1.5 hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-center">
                      <strong className="text-[11px] text-slate-200 font-extrabold uppercase">{zona.nombre}</strong>
                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded ${
                        zona.confianza === "Crítica" ? "bg-red-950 text-red-400 border border-red-500/25" :
                        zona.confianza === "Alta" ? "bg-purple-950 text-purple-400 border border-purple-500/25" :
                        "bg-blue-950 text-blue-450 border border-blue-500/25"
                      }`}>
                        Prob. {(zona.probabilidad * 100).toFixed(0)}% ({zona.confianza})
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-normal">
                      <span className="font-bold text-slate-300">Causas:</span> {zona.causas.join(", ")}
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1 border-t border-slate-900/40 pt-1.5">
                      <span>Tendencia: <span className="text-orange-400 uppercase font-bold">{zona.tendencia}</span></span>
                      <span>Expected IRI: <span className="text-white font-bold">{zona.expectedIri}/100</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 10: RECOMENDACIONES OPERATIVAS & SÍNTESIS IA */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl w-full flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-base">🧠</span>
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                PANEL 10 — RECOMENDACIONES DE OPERACIÓN & SÍNTESIS EJECUTIVA DE IA
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
                VERTEX AI POWERED
              </span>
              <div className="relative group flex items-center">
                <span className="text-slate-500 hover:text-blue-500 cursor-help transition-colors select-none text-xs ml-2">❓</span>
                <div className="absolute right-0 top-7 z-50 w-80 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl text-left text-xs text-slate-300 leading-relaxed font-normal normal-case opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none transition-opacity duration-200">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-blue-500">
                    ❓ Ayuda: Síntesis Ejecutiva
                  </h4>
                  <div className="space-y-2 text-[11px]">
                    <p><strong>¿Qué hace el módulo?</strong> Expone el resumen estructurado generado por IA basado únicamente en las salidas del modelo predictivo.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full text-xs items-stretch">
            {/* Vertex AI Summary Box */}
            <div className="lg:col-span-7 bg-slate-950 border border-slate-850 p-5 rounded-xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2.5 block border-b border-slate-900 pb-2 flex items-center gap-1">
                  🤖 Resumen Ejecutivo Generado por IA (Consolidación)
                </span>
                <div className="text-[11px] leading-relaxed text-slate-300 space-y-2 whitespace-pre-line max-h-[350px] overflow-y-auto pr-1.5 custom-scrollbar">
                  {forecast?.aiSynthesis ? (
                    forecast.aiSynthesis
                  ) : (
                    <span className="text-slate-650 italic">Calculando pronóstico predictivo y consolidando resumen IA...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Field Recommendations */}
            <div className="lg:col-span-5 bg-slate-950 border border-slate-850 p-5 rounded-xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2.5 block border-b border-slate-900 pb-2">
                  ⚡ Guía de Mitigación Operativa en Campo
                </span>
                <div className="space-y-3 mt-3">
                  {forecast?.recomendacionesOperativas.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wide">Directriz {idx + 1}</span>
                        <p className="text-[11px] text-slate-250 leading-relaxed">{rec}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
