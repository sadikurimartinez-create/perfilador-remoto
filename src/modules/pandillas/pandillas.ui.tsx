"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  GangEntity,
  GangMember,
  GangRelationship,
  GeointeligenciaShape,
  TimelineEvent,
  GraffitiImage,
  calculateMemberDanger,
  calculateSimilarity
} from "./pandillas.mapper";
import { PandillasService } from "./pandillas.service";
import { PandillasEngine } from "./pandillas.engine";
import { GoogleMap, Polygon, Polyline, Marker, Circle, useJsApiLoader } from "@react-google-maps/api";
import { GangGISAnalysisLayer, GISRelationshipLine } from "@/lib/providers/gangGISAnalysisLayer";
import { GISMemberNode, InfluenceZone } from "@/lib/providers/gangInfluenceEngine";

const MAP_LIBRARIES: ("places" | "visualization" | "drawing")[] = ["places", "visualization", "drawing"];

const CRIME_TYPES_MAP = [
  { id: "Homicidios_2025.csv", label: "💀 Homicidios", color: "#f43f5e" },
  { id: "Feminicidios_2025.csv", label: "🌸 Feminicidios", color: "#ec4899" },
  { id: "Robo negocio 2025.csv", label: "🏢 Robo a Negocio", color: "#f97316" },
  { id: "Robo casa 2025.csv", label: "🏠 Robo a Casa", color: "#eab308" },
  { id: "Robo vehicular 2025.csv", label: "🚗 Robo Vehicular", color: "#3b82f6" },
  { id: "Robo motocicleta 2025.csv", label: "🏍️ Robo Motocicleta", color: "#06b6d4" },
  { id: "Extorsion & Fraude 2025.csv", label: "📞 Extorsión y Fraude", color: "#8b5cf6" },
  { id: "PERSONA 2025.csv", label: "👥 Delitos contra Personas", color: "#10b981" },
  { id: "Autopartes & Cristalazo 2025.csv", label: "💎 Autopartes y Cristalazo", color: "#6b7280" }
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

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#38bdf8" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
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
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#020617" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3b82f6" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#020617" }],
  },
];

const isWithinAguascalientes = (lat: number, lng: number) => {
  return lat >= 21.5 && lat <= 22.5 && lng >= -103.0 && lng <= -101.5;
};

const calculateCentroid = (points: { lat: number; lng: number }[]) => {
  if (!points || points.length === 0) return { lat: 21.8853, lng: -102.2916 };
  let latSum = 0;
  let lngSum = 0;
  points.forEach(p => {
    latSum += p.lat;
    lngSum += p.lng;
  });
  return { lat: latSum / points.length, lng: lngSum / points.length };
};

interface PandillasUIProps {
  projectId?: string;
  onSaveAnalysisToCloud?: (content: string) => Promise<void>;
}

export function PandillasUI({ projectId, onSaveAnalysisToCloud }: PandillasUIProps = {}) {
  const { user } = useAuth();
  const username = user?.username || "CEIPOL_Analista";

  // --- REGISTRY LIST STATES ---
  const [storedGangs, setStoredGangs] = useState<GangEntity[]>([]);
  const [selectedGangId, setSelectedGangId] = useState<string>("");

  // --- GENERAL GANG DATA STATES ---
  const [nombre, setNombre] = useState("");
  const [aliasConocidos, setAliasConocidos] = useState("");
  const [estatus, setEstatus] = useState<GangEntity["estatus"]>("Activa");
  const [zonaInfluencia, setZonaInfluencia] = useState("");
  const [coloniasAsociadas, setColoniasAsociadas] = useState<string>("");
  const [municipiosAsociados, setMunicipiosAsociados] = useState<string>("Aguascalientes");
  const [ilicitos, setIlicitos] = useState<GangEntity["ilicitos"]>([]);
  const [especificarOtroIlicito, setEspecificarOtroIlicito] = useState("");
  const [drogasConsumidas, setDrogasConsumidas] = useState<string[]>([]);
  const [modusOperandi, setModusOperandi] = useState("");
  const [simbolosIdentificacion, setSimbolosIdentificacion] = useState("");
  const [peligrosidad, setPeligrosidad] = useState<GangEntity["peligrosidad"]>("Medio");
  const [geoReportId, setGeoReportId] = useState("");

  // --- REENGINEERED LISTS ---
  const [integrantes, setIntegrantes] = useState<GangMember[]>([]);
  const [relaciones, setRelaciones] = useState<GangRelationship[]>([]);
  const [geometrias, setGeometrias] = useState<GeointeligenciaShape[]>([]);
  const [cronologiaEventos, setCronologiaEventos] = useState<TimelineEvent[]>([]);
  const [imagenesGrafiti, setImagenesGrafiti] = useState<GraffitiImage[]>([]);

  // --- INEGI WMS STATE ---
  const [selectedWmsLayers, setSelectedWmsLayers] = useState<string[]>([]);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const wmsOverlaysRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!mapInstance) return;

    // Remove existing WMS overlays
    Object.entries(wmsOverlaysRef.current).forEach(([layerId, overlay]) => {
      try {
        const index = mapInstance.overlayMapTypes.indexOf(overlay);
        if (index !== -1) {
          mapInstance.overlayMapTypes.removeAt(index);
        }
      } catch (e) {
        console.warn("Error removing WMS overlay:", e);
      }
    });
    wmsOverlaysRef.current = {};

    // Helper to get Web Mercator tile bounds (EPSG:3857)
    const getEPSG3857BBox = (x: number, y: number, zoom: number) => {
      const max = 20037508.34;
      const size = (max * 2) / Math.pow(2, zoom);
      const minX = -max + x * size;
      const maxX = -max + (x + 1) * size;
      const minY = max - (y + 1) * size;
      const maxY = max - y * size;
      return `${minX},${minY},${maxX},${maxY}`;
    };

    // Add selected WMS overlays
    selectedWmsLayers.forEach(layerId => {
      const matched = WMS_LAYERS_CATALOG.find(l => l.id === layerId);
      if (!matched) return;

      const overlay = new window.google.maps.ImageMapType({
        getTileUrl: (coord: any, zoom: number) => {
          const bbox = getEPSG3857BBox(coord.x, coord.y, zoom);
          return `${matched.providerUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${matched.name}&FORMAT=image/png&TRANSPARENT=TRUE&SRS=EPSG:3857&BBOX=${bbox}&WIDTH=256&HEIGHT=256`;
        },
        tileSize: new window.google.maps.Size(256, 256),
        opacity: 0.65,
        name: matched.title
      });

      wmsOverlaysRef.current[layerId] = overlay;
      mapInstance.overlayMapTypes.push(overlay);
    });
  }, [selectedWmsLayers, mapInstance]);
  const [archivos, setArchivos] = useState<{ nombre: string; size: number; tipo: string; contexto?: string }[]>([]);

  // --- INTERACTION & EDITING SUB-STATES ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "registro" | "integrantes" | "relaciones" | "geointeligencia" | "barridos">("dashboard");

  const onMapLoad = useCallback((mapInstance: any) => {
    setMapInstance(mapInstance);
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

  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null);
  const [tempMember, setTempMember] = useState<Partial<GangMember>>({
    nombre: "", alias: "", estatusPandilla: "Integrante", sexo: "Masculino", edad: "", curp: "", domicilioConocido: "",
    telefono: "", detencionesPrevias: "", ingresosCentrosInternamiento: "", consumoDrogas: "", nivelViolencia: "Bajo",
    riesgoCriminogeno: "Bajo", cicatrices: "", marcasDistintivas: "", lugarTrabajo: "", actividadEconomica: "", escuela: "",
    tatuajes: "", complexion: "", estatura: "", vestimentaUsual: "", telefonoRedes: "", vehiculosAsociados: ""
  });

  const [tempRel, setTempRel] = useState<Partial<GangRelationship>>({
    tipo: "rival", pandillaNombre: "", tipoVinculo: "", fechaInicio: "", nivelSeveridad: "Medio"
  });

  const [tempEvent, setTempEvent] = useState<Partial<TimelineEvent>>({
    fecha: new Date().toISOString().split("T")[0], titulo: "", descripcion: "", gravedad: "Media", categoria: "otro", lugar: ""
  });

  // --- GRAFFITI GALLERY STATE & HANDLER ---
  const [newGraffitiDesc, setNewGraffitiDesc] = useState("");
  const [newGraffitiType, setNewGraffitiType] = useState<"Identidad" | "Advertencia" | "Frontera" | "Punto de venta" | "Otro">("Identidad");

  const handleUploadGraffitiImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const newImg: GraffitiImage = {
        id: `graf-${Date.now()}`,
        url: reader.result as string,
        descripcion: newGraffitiDesc || "Sin descripción",
        tipo: newGraffitiType,
        fechaRegistro: new Date().toLocaleDateString("es-MX")
      };
      setImagenesGrafiti(prev => [...prev, newImg]);
      setNewGraffitiDesc(""); // reset
    };
    reader.readAsDataURL(file);
  };

  // --- DRAWING TOOLBOX STATES ---
  const [drawingMode, setDrawingMode] = useState<"poligono" | "corredor" | "buffer" | "zona_riesgo" | null>(null);
  const [tempShapeName, setTempShapeName] = useState("");
  const [tempShapeControl, setTempShapeControl] = useState<GeointeligenciaShape["nivelControlTerritorial"]>("Medio");
  const [tempShapePoints, setTempShapePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [tempShapeRadius, setTempShapeRadius] = useState<number>(300); // meters for buffer circles

  // --- GANG GIS ANALYSIS LAYER STATES ---
  const [gisSidebarTab, setGisSidebarTab] = useState<"drawing" | "analysis">("analysis");
  const [showGisNodes, setShowGisNodes] = useState(true);
  const [showGisZones, setShowGisZones] = useState(true);
  const [showGisRelations, setShowGisRelations] = useState(true);
  const [showGisIncidents, setShowGisIncidents] = useState(true);
  const [selectedGangsForGis, setSelectedGangsForGis] = useState<string[]>([]);
  const [selectedCrimeTypes, setSelectedCrimeTypes] = useState<string[]>([
    "Homicidios_2025.csv", "Feminicidios_2025.csv", "Robo negocio 2025.csv",
    "Robo casa 2025.csv", "Robo vehicular 2025.csv", "Robo motocicleta 2025.csv",
    "Extorsion & Fraude 2025.csv", "PERSONA 2025.csv", "Autopartes & Cristalazo 2025.csv"
  ]);
  const [gisIncidents, setGisIncidents] = useState<any[]>([]);
  const [isFetchingIncidents, setIsFetchingIncidents] = useState(false);
  const [editingGeometryId, setEditingGeometryId] = useState<string | null>(null);
  const [gisStructuredOutput, setGisStructuredOutput] = useState<any | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"report" | "json">("report");

  const [selectedGisNode, setSelectedGisNode] = useState<GISMemberNode | null>(null);
  const [selectedGisZone, setSelectedGisZone] = useState<InfluenceZone | null>(null);
  const [multiSelectedNodes, setMultiSelectedNodes] = useState<GISMemberNode[]>([]);
  const [multiSelectedZones, setMultiSelectedZones] = useState<InfluenceZone[]>([]);
  const [isGisAnalyzing, setIsGisAnalyzing] = useState(false);
  const [gisAnalysisReport, setGisAnalysisReport] = useState<string | null>(null);

  // Process and memoize GIS Layer structures
  const gisAnalysisResult = useMemo(() => {
    return GangGISAnalysisLayer.processGISData(storedGangs);
  }, [storedGangs]);

  const filteredGisData = useMemo(() => {
    if (!gisAnalysisResult) return { nodes: [], zones: [], relationships: [] };
    if (selectedGangsForGis.length === 0) {
      return { nodes: [], zones: [], relationships: [] };
    }
    return {
      nodes: gisAnalysisResult.nodes.filter(n => selectedGangsForGis.includes(n.gang)),
      zones: gisAnalysisResult.zones.filter(z => selectedGangsForGis.includes(z.gang)),
      relationships: gisAnalysisResult.relationships.filter(r => selectedGangsForGis.includes(r.gang))
    };
  }, [gisAnalysisResult, selectedGangsForGis]);

  const selectedGangsCentroid = useMemo(() => {
    const activeGangs = storedGangs.filter(g => selectedGangsForGis.includes(g.nombre));
    if (activeGangs.length === 0) return { lat: 21.8853, lng: -102.2916 };
    let latSum = 0;
    let lngSum = 0;
    let count = 0;
    activeGangs.forEach(g => {
      if (g.coordenadas?.lat && g.coordenadas?.lng) {
        latSum += g.coordenadas.lat;
        lngSum += g.coordenadas.lng;
        count++;
      } else if (g.geometrias && g.geometrias.length > 0) {
        const c = calculateCentroid(g.geometrias[0].puntos);
        latSum += c.lat;
        lngSum += c.lng;
        count++;
      }
    });
    if (count === 0) return { lat: 21.8853, lng: -102.2916 };
    return { lat: latSum / count, lng: lngSum / count };
  }, [storedGangs, selectedGangsForGis]);

  const fetchIncidentsForGis = async (lat: number, lng: number) => {
    setIsFetchingIncidents(true);
    try {
      const res = await fetch("/api/incidencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      if (res.ok) {
        const json = await res.json();
        setGisIncidents(json.data || []);
      }
    } catch (err) {
      console.error("Error fetching incidents for GIS:", err);
    } finally {
      setIsFetchingIncidents(false);
    }
  };

  useEffect(() => {
    if (selectedGangsForGis.length > 0) {
      const centroid = selectedGangsCentroid;
      void fetchIncidentsForGis(centroid.lat, centroid.lng);
    }
  }, [selectedGangsForGis, selectedGangsCentroid]);

  const filteredIncidents = useMemo(() => {
    if (!showGisIncidents) return [];
    return gisIncidents.filter(inc => selectedCrimeTypes.includes(inc.fuente));
  }, [gisIncidents, showGisIncidents, selectedCrimeTypes]);

  const handleVertexDrag = (geoId: string, idx: number, lat: number, lng: number) => {
    if (!isWithinAguascalientes(lat, lng)) {
      alert("⛔ ERROR DE GEORREFERENCIACIÓN:\nEl punto se encuentra fuera de los límites del Estado de Aguascalientes.");
      return;
    }
    setGeometrias(prev => prev.map(geo => {
      if (geo.id === geoId) {
        const nextPoints = [...geo.puntos];
        nextPoints[idx] = { lat, lng };
        return {
          ...geo,
          puntos: nextPoints,
          fechaActualizacion: new Date().toISOString().split("T")[0]
        };
      }
      return geo;
    }));
  };

  const handleVertexDelete = (geoId: string, idx: number) => {
    setGeometrias(prev => prev.map(geo => {
      if (geo.id === geoId) {
        if (geo.tipo === "poligono" && geo.puntos.length <= 3) {
          alert("⚠️ Un polígono requiere al menos 3 vértices.");
          return geo;
        }
        if (geo.tipo === "corredor" && geo.puntos.length <= 2) {
          alert("⚠️ Un corredor requiere al menos 2 vértices.");
          return geo;
        }
        if (geo.tipo === "buffer" || geo.tipo === "zona_riesgo") {
          alert("⚠️ No se puede eliminar el nodo de una geometría de punto único.");
          return geo;
        }
        const nextPoints = geo.puntos.filter((_, i) => i !== idx);
        return {
          ...geo,
          puntos: nextPoints,
          fechaActualizacion: new Date().toISOString().split("T")[0]
        };
      }
      return geo;
    }));
  };

  const handleExportGisMap = async () => {
    const el = document.getElementById("gis-tactical-map");
    if (!el) {
      alert("No se encontró el contenedor del mapa para exportar.");
      return;
    }
    const html2canvasLib = (await import("html2canvas")).default;
    try {
      const canvas = await html2canvasLib(el, { useCORS: true, scale: 2 });
      const dataUrl = canvas.toDataURL("image/png");
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("El navegador bloqueó la apertura de la ventana de exportación. Habilite las ventanas emergentes.");
        return;
      }
      const nowStr = new Date().toLocaleString("es-MX");
      const activeLayersStr = [
        showGisNodes && "Domicilios de Integrantes",
        showGisZones && "Zonas de Influencia",
        showGisRelations && "Redes de Proximidad",
        showGisIncidents && "Incidencia Delictiva"
      ].filter(Boolean).join(", ") || "Ninguna";
      const selectedGangsStr = selectedGangsForGis.join(", ") || "Ninguna";
      const summaryText = gisAnalysisReport || "Realice un análisis primero para ver la síntesis de inteligencia aquí.";

      printWindow.document.write(`
        <html>
          <head>
            <title>REPORTE DE GEOINTELIGENCIA TÁCTICA CEIPOL</title>
            <style>
              body { font-family: Arial, sans-serif; background-color: #ffffff; color: #1e293b; margin: 40px; line-height: 1.6; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
              .header-title h1 { margin: 0; font-size: 24px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
              .header-title p { margin: 5px 0 0 0; color: #64748b; font-size: 12px; font-weight: bold; }
              .meta-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 30px; font-size: 12px; }
              .meta-item strong { color: #334155; }
              .map-container { text-align: center; margin-bottom: 35px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
              .map-img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
              .section-title { font-size: 16px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; text-transform: uppercase; }
              .content-text { font-size: 13px; color: #334155; white-space: pre-wrap; font-weight: 500; }
              .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 10px; color: #94a3b8; }
              .no-print button { background-color: #0f172a; color: white; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer; }
              @media print { body { margin: 20px; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="header-title">
                <h1>Reporte de Geointeligencia GEOINT</h1>
                <p>Centro de Estudios y Política Criminal (CEIPOL)</p>
              </div>
              <div class="no-print">
                <button onclick="window.print()">Imprimir / Guardar PDF</button>
              </div>
            </div>
            <div class="meta-grid">
              <div class="meta-item"><strong>Pandillas Analizadas:</strong> ${selectedGangsStr}</div>
              <div class="meta-item"><strong>Fecha y Hora:</strong> ${nowStr}</div>
              <div class="meta-item"><strong>Capas GIS Activas:</strong> ${activeLayersStr}</div>
              <div class="meta-item"><strong>Clasificación:</strong> Reservado - Uso Exclusivo Policial</div>
            </div>
            <div class="section-title">Mapa de Situación Geopolítica</div>
            <div class="map-container">
              <img class="map-img" src="${dataUrl}" alt="Mapa Táctico GEOINT" />
            </div>
            <div class="section-title">Resultados de Cruce y Explicación del Análisis</div>
            <div class="content-text">${summaryText}</div>
            <div class="footer">
              Este documento contiene información confidencial de inteligencia criminal de Aguascalientes.
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error("Error al exportar mapa:", err);
      alert("Error al exportar el mapa táctico.");
    }
  };

  const crossInfluenceIntersection = useMemo(() => {
    const zonesToAnalyze = multiSelectedZones.length > 0 ? multiSelectedZones : filteredGisData.zones;
    return GangGISAnalysisLayer.analyzeCrossInfluence(zonesToAnalyze);
  }, [multiSelectedZones, filteredGisData.zones]);

  // --- BARRIDO & AI ENGINE STATES ---
  const [barridoTarget, setBarridoTarget] = useState<"all" | "member" | "zone" | "shape">("all");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState("");
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [activeReport, setActiveReport] = useState<"estructura" | "riesgo" | "completo">("estructura");

  // --- AUTOMATIC ALERTS SYSTEM ---
  const [alerts, setAlerts] = useState<{ id: string; tipo: string; severidad: string; mensaje: string; fecha: string }[]>([]);

  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc") : "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc";
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: MAP_LIBRARIES,
  });

  // Load registered gangs on mount
  useEffect(() => {
    void loadSavedGangs();
    if (projectId) {
      void loadGangForProject();
    }
  }, [projectId]);

  const loadSavedGangs = async () => {
    try {
      const list = await PandillasService.getAllGangs();
      setStoredGangs(list);
      if (list.length > 0) {
        // Autoseleccionamos el primer expediente del listado para poblar inmediatamente la UI
        loadGangIntoState(list[0]);
      }
    } catch (e) {
      console.error("[Gangs UI] Error al cargar pandillas:", e);
    }
  };

  const loadGangForProject = async () => {
    if (!projectId) return;
    try {
      const existing = await PandillasService.getGangByProjectId(projectId);
      if (existing) {
        loadGangIntoState(existing);
      }
    } catch (e) {
      console.error("[Gangs UI] Error al cargar pandilla del proyecto:", e);
    }
  };

  const loadGangIntoState = (gang: GangEntity) => {
    setSelectedGangId(gang.id || "");
    setNombre(gang.nombre || "");
    setAliasConocidos(gang.aliasConocidos || "");
    setEstatus(gang.estatus || "Activa");
    setZonaInfluencia(gang.zonaInfluencia || "");
    setColoniasAsociadas(gang.coloniasAsociadas?.join(", ") || "");
    setMunicipiosAsociados(gang.municipiosAsociados?.join(", ") || "Aguascalientes");
    setIlicitos(gang.ilicitos || []);
    setEspecificarOtroIlicito(gang.especificarOtroIlicito || "");
    setDrogasConsumidas(gang.drogasConsumidas || []);
    setModusOperandi(gang.modusOperandi || "");
    setSimbolosIdentificacion(gang.simbolosIdentificacion || "");
    setPeligrosidad(gang.peligrosidad || "Medio");
    setGeoReportId(gang.geoReportId || "");

    setIntegrantes(gang.integrantes || []);
    setRelaciones(gang.relaciones || []);
    setGeometrias(gang.geometrias || []);
    setCronologiaEventos(gang.cronologiaEventos || []);
    setImagenesGrafiti(gang.imagenesGrafiti || []);
    setArchivos(gang.archivosAnexos || []);
    setAnalysisResult(null); // Clear previous visual report to let user sweep again
    setSelectedGangsForGis([gang.nombre || ""]);
  };



  const mapCenter = useMemo(() => {
    if (tempShapePoints.length > 0) {
      return tempShapePoints[tempShapePoints.length - 1];
    }
    if (geometrias.length > 0 && geometrias[0].puntos.length > 0) {
      return calculateCentroid(geometrias[0].puntos);
    }
    return { lat: 21.8853, lng: -102.2916 }; // Aguascalientes City Center
  }, [tempShapePoints, geometrias]);

  // --- SAVE TO FIRESTORE ---
  const handleSaveGangToCloud = async () => {
    if (!nombre) {
      alert("⚠️ El nombre oficial de la pandilla es obligatorio para guardar el registro.");
      return;
    }

    try {
      const colArray = coloniasAsociadas.split(",").map(c => c.trim()).filter(Boolean);
      const munArray = municipiosAsociados.split(",").map(m => m.trim()).filter(Boolean);
      const centroid = geometrias.length > 0 && geometrias[0].puntos.length > 0
        ? calculateCentroid(geometrias[0].puntos)
        : { lat: 21.8853, lng: -102.2916 };

      const cleanName = nombre.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 10);
      const cleanThreat = peligrosidad?.toUpperCase() || "MEDIO";
      const idSnippet = (selectedGangId || "NEW").substring(0, 5).toUpperCase();
      const generatedGeoReportId = geoReportId || `CEIPOL-GEO-${cleanName}-${cleanThreat}-${idSnippet}`;

      const data: GangEntity = {
        id: selectedGangId || undefined,
        projectId: projectId || undefined,
        nombre,
        aliasConocidos,
        estatus,
        fechaRegistro: Date.now(),
        zonaInfluencia,
        coloniasAsociadas: colArray,
        municipiosAsociados: munArray,
        ilicitos,
        especificarOtroIlicito,
        drogasConsumidas,
        modusOperandi,
        simbolosIdentificacion,
        peligrosidad,
        integrantes,
        relaciones,
        geometrias,
        cronologiaEventos,
        imagenesGrafiti,
        coordenadas: centroid,
        archivosAnexos: archivos,
        geoReportId: generatedGeoReportId,
        resumenInteligencia: `${nombre} es una pandilla clasificada con nivel de peligrosidad ${peligrosidad}. Cuenta con ${integrantes.length} integrantes documentados en el Dossier de Inteligencia Criminal, con influencia táctica en ${zonaInfluencia}.`
      };

      const savedId = await PandillasService.saveGang(data, username);
      setSelectedGangId(savedId);
      setGeoReportId(generatedGeoReportId);
      alert(`🎉 Registro de Inteligencia Criminal "${nombre}" guardado con éxito en la nube.\nID Geointeligencia: ${generatedGeoReportId}`);
      await loadSavedGangs();
    } catch (e: any) {
      alert("❌ Error al persistir el registro en Firestore: " + e.message);
    }
  };

  // --- AUTOMATIC ALERTS CALCULATOR ---
  useEffect(() => {
    const list: typeof alerts = [];
    const today = new Date().toLocaleDateString("es-MX");

    // Danger alerts
    if (peligrosidad === "Crítico") {
      list.push({
        id: "alert-risk",
        tipo: "territorio",
        severidad: "Crítica",
        mensaje: `Nivel de peligrosidad global configurado en "Crítico". Se requiere desplegar patrullajes coordinados preventivos.`,
        fecha: today
      });
    }

    // Member quantity alerts
    if (integrantes.length >= 5) {
      list.push({
        id: "alert-members",
        tipo: "actor",
        severidad: "Alta",
        mensaje: `Estructura de clica expandida: ${integrantes.length} integrantes activos con roles jerárquicos documentados.`,
        fecha: today
      });
    }

    // High danger members check
    const highViolentMembers = integrantes.filter(m => m.nivelViolencia === "Alto");
    if (highViolentMembers.length > 0) {
      list.push({
        id: "alert-violence",
        tipo: "actor",
        severidad: "Alta",
        mensaje: `Se detectaron ${highViolentMembers.length} integrantes con nivel de violencia "Alto" en la base.`,
        fecha: today
      });
    }

    // Territorial conflict alerts
    const activeConflicts = relaciones.filter(r => r.tipo === "rival" && r.nivelSeveridad === "Crítico");
    if (activeConflicts.length > 0) {
      list.push({
        id: "alert-conflicto",
        tipo: "conflicto",
        severidad: "Crítica",
        mensaje: `Disputa territorial activa de alta fricción contra "${activeConflicts.map(c => c.pandillaNombre).join(", ")}".`,
        fecha: today
      });
    }

    // Geographic overlap alerts
    if (geometrias.length > 1) {
      list.push({
        id: "alert-shapes",
        tipo: "territorio",
        severidad: "Baja",
        mensaje: `Múltiples geometrías operativas registradas (${geometrias.length} corredores/polígonos de influencia).`,
        fecha: today
      });
    }

    // Cross reference / shared members alert
    storedGangs.forEach(g => {
      if (g.id !== selectedGangId) {
        g.integrantes.forEach(otherM => {
          integrantes.forEach(m => {
            if (m.nombre && otherM.nombre && m.nombre.toLowerCase().trim() === otherM.nombre.toLowerCase().trim()) {
              list.push({
                id: `shared-member-${m.nombre}`,
                tipo: "actor",
                severidad: "Alta",
                mensaje: `COINCIDENCIA AUTOMÁTICA: El integrante "${m.alias || m.nombre}" también se encuentra registrado en la pandilla "${g.nombre}".`,
                fecha: today
              });
            }
          });
        });
      }
    });

    setAlerts(list);
  }, [peligrosidad, integrantes, relaciones, geometrias, storedGangs, selectedGangId]);

  // --- MAP CLICK HANDLER FOR GEOSPATIAL DRAWING ---
  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    // STRICT GEOGRAPHICAL VALIDATION
    if (!isWithinAguascalientes(lat, lng)) {
      alert("⛔ ERROR DE GEORREFERENCIACIÓN:\nEl punto seleccionado se encuentra fuera de los límites del Estado de Aguascalientes. Todo elemento cartográfico debe quedar estrictamente contenido dentro de la geografía del estado.");
      return;
    }

    if (editingGeometryId) {
      const geo = geometrias.find(g => g.id === editingGeometryId);
      if (geo && (geo.tipo === "poligono" || geo.tipo === "corredor")) {
        setGeometrias(prev => prev.map(g => {
          if (g.id === editingGeometryId) {
            return {
              ...g,
              puntos: [...g.puntos, { lat, lng }],
              fechaActualizacion: new Date().toISOString().split("T")[0]
            };
          }
          return g;
        }));
      }
      return;
    }

    if (!drawingMode) return;

    if (drawingMode === "zona_riesgo" || drawingMode === "buffer") {
      // Single point geometries
      setTempShapePoints([{ lat, lng }]);
    } else {
      // Line/polygon path geometries
      setTempShapePoints(prev => [...prev, { lat, lng }]);
    }
  };

  const handleSaveGeometry = () => {
    if (!tempShapeName) {
      alert("⚠️ Ingrese un nombre descriptivo para esta geometría táctica.");
      return;
    }
    if (tempShapePoints.length === 0) {
      alert("⚠️ Debe hacer clic en el mapa para posicionar la geometría antes de guardar.");
      return;
    }
    if ((drawingMode === "poligono" && tempShapePoints.length < 3)) {
      alert("⚠️ Un polígono de influencia territorial requiere de al menos 3 vértices delimitadores.");
      return;
    }

    const nextRisk = tempShapeControl === "Nulo" || tempShapeControl === "Bajo" ? "low" : tempShapeControl === "Medio" ? "medium" : "high";

    const newShape: GeointeligenciaShape & { riskLevel?: "low" | "medium" | "high" } = {
      id: "shape-" + Date.now(),
      nombre: tempShapeName,
      tipo: drawingMode!,
      puntos: [...tempShapePoints],
      radio: drawingMode === "buffer" ? tempShapeRadius : undefined,
      nivelControlTerritorial: tempShapeControl,
      riskLevel: nextRisk,
      fechaActualizacion: new Date().toISOString().split("T")[0]
    };

    setGeometrias(prev => [...prev, newShape]);

    // Reset toolbox
    setTempShapePoints([]);
    setTempShapeName("");
    setDrawingMode(null);
  };

  // --- GANG MEMBERS (INTEGRANTES) METHODS ---
  const handleMemberPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempMember(prev => ({
          ...prev,
          fotografiaUrl: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMember = () => {
    if (!tempMember.nombre && !tempMember.alias) {
      alert("⚠️ El integrante requiere por lo menos un nombre o alias identificatorio.");
      return;
    }

    const danger = calculateMemberDanger(tempMember as GangMember);

    const newMember: GangMember = {
      nombre: tempMember.nombre || "",
      alias: tempMember.alias || "",
      rol: tempMember.estatusPandilla || "Integrante",
      edad: tempMember.edad || "",
      sexo: tempMember.sexo as any,
      curp: tempMember.curp,
      domicilioConocido: tempMember.domicilioConocido,
      telefono: tempMember.telefono,
      detencionesPrevias: tempMember.detencionesPrevias,
      ingresosCentrosInternamiento: tempMember.ingresosCentrosInternamiento,
      consumoDrogas: tempMember.consumoDrogas,
      nivelViolencia: tempMember.nivelViolencia as any,
      riesgoCriminogeno: tempMember.riesgoCriminogeno as any,
      cicatrices: tempMember.cicatrices,
      marcasDistintivas: tempMember.marcasDistintivas,
      lugarTrabajo: tempMember.lugarTrabajo,
      actividadEconomica: tempMember.actividadEconomica,
      escuela: tempMember.escuela,
      tatuajes: tempMember.tatuajes,
      complexion: tempMember.complexion,
      estatura: tempMember.estatura,
      vestimentaUsual: tempMember.vestimentaUsual,
      telefonoRedes: tempMember.telefonoRedes,
      vehiculosAsociados: tempMember.vehiculosAsociados,
      estatusPandilla: tempMember.estatusPandilla as any,
      peligrosidadCalculada: danger,
      fotografiaUrl: tempMember.fotografiaUrl || (tempMember.sexo === "Femenino" ? "/avatars/avatar_fem.png" : "/avatars/avatar_male.png")
    };

    if (editingMemberIndex !== null) {
      const list = [...integrantes];
      list[editingMemberIndex] = newMember;
      setIntegrantes(list);
      setEditingMemberIndex(null);
    } else {
      setIntegrantes(prev => [...prev, newMember]);
    }

    // Reset member form
    setTempMember({
      nombre: "", alias: "", estatusPandilla: "Integrante", sexo: "Masculino", edad: "", curp: "", domicilioConocido: "",
      telefono: "", detencionesPrevias: "", ingresosCentrosInternamiento: "", consumoDrogas: "", nivelViolencia: "Bajo",
      riesgoCriminogeno: "Bajo", cicatrices: "", marcasDistintivas: "", lugarTrabajo: "", actividadEconomica: "", escuela: "",
      tatuajes: "", complexion: "", estatura: "", vestimentaUsual: "", telefonoRedes: "", vehiculosAsociados: "", fotografiaUrl: ""
    });
  };

  const handleEditMember = (index: number) => {
    setEditingMemberIndex(index);
    setTempMember({ ...integrantes[index] });
    setActiveTab("integrantes");
  };

  // --- RELATIONSHIPS METHODS ---
  const handleAddRelationship = () => {
    if (!tempRel.pandillaNombre) {
      alert("⚠️ Seleccione o escriba el nombre de la pandilla vinculada.");
      return;
    }

    const newRel: GangRelationship = {
      tipo: tempRel.tipo || "rival",
      pandillaNombre: tempRel.pandillaNombre,
      tipoVinculo: tempRel.tipoVinculo || (tempRel.tipo === "rival" ? "Fricción Territorial" : "Actividad Conjunta"),
      fechaInicio: tempRel.fechaInicio || new Date().toISOString().split("T")[0],
      nivelSeveridad: tempRel.nivelSeveridad as any
    };

    setRelaciones(prev => [...prev, newRel]);
    setTempRel({ tipo: "rival", pandillaNombre: "", tipoVinculo: "", fechaInicio: "", nivelSeveridad: "Medio" });
  };

  // --- TIMELINE EVENTS METHODS ---
  const handleAddTimelineEvent = () => {
    if (!tempEvent.titulo || !tempEvent.descripcion) {
      alert("⚠️ Ingrese un título y descripción del evento táctico.");
      return;
    }

    const newEvent: TimelineEvent = {
      id: "event-" + Date.now(),
      fecha: tempEvent.fecha || new Date().toISOString().split("T")[0],
      titulo: tempEvent.titulo,
      descripcion: tempEvent.descripcion,
      gravedad: tempEvent.gravedad as any,
      categoria: tempEvent.categoria as any,
      lugar: tempEvent.lugar
    };

    setCronologiaEventos(prev => [...prev, newEvent].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    setTempEvent({ fecha: new Date().toISOString().split("T")[0], titulo: "", descripcion: "", gravedad: "Media", categoria: "otro", lugar: "" });
  };

  const handleGisAnalysis = async () => {
    if (selectedGangsForGis.length === 0) {
      alert("⚠️ Seleccione al menos una pandilla para realizar el análisis.");
      return;
    }
    setIsGisAnalyzing(true);
    setGisAnalysisReport(null);
    setGisStructuredOutput(null);
    try {
      const activeLayers = [
        showGisNodes && "domiciles",
        showGisZones && "influence_zones",
        showGisRelations && "relations",
        showGisIncidents && "incidents"
      ].filter(Boolean) as string[];

      const payload = {
        selectedGangs: selectedGangsForGis,
        activeLayers,
        domiciles: filteredGisData.nodes,
        influenceZones: filteredGisData.zones,
        manualDrawings: geometrias.map(geo => ({
          geometry_type: geo.tipo === "zona_riesgo" ? "buffer" : geo.tipo,
          coordinates: geo.puntos,
          radio: geo.radio,
          risk_level: geo.riskLevel || "medium",
          label: geo.nombre,
          timestamp: geo.fechaActualizacion || new Date().toISOString()
        })),
        incidents: filteredIncidents,
        allGangs: storedGangs
      };

      const response = await fetch("/api/pandillas/analyze-gis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || response.statusText);
      }

      const data = await response.json();
      setGisAnalysisReport(data.report);
      setGisStructuredOutput(data.structuredOutput);
    } catch (err: any) {
      console.error("GIS Analysis error:", err);
      alert("❌ Falló el análisis de geointeligencia: " + err.message);
    } finally {
      setIsGisAnalyzing(false);
    }
  };

  // --- GRANULAR GEOSPATIAL SWEEPS ---
  const handleExecuteTargetedSweep = async () => {
    if (!nombre) {
      alert("⚠️ Complete los datos generales de la pandilla antes de lanzar el barrido de geointeligencia.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    const steps = [
      "Iniciando Mapeador de Geointeligencia Criminal...",
      "Resolviendo demarcación territorial de Aguascalientes...",
      "Inyectando catálogo del dataset local 'Domiclios Pandillas.csv'...",
      `Iniciando rastreador OSINT especializado en: ${barridoTarget === "all" ? "Toda la pandilla" : barridoTarget === "member" ? "Integrante específico" : barridoTarget === "zone" ? "Zona de influencia" : "Polígono delimitado"}...`,
      "Conectando con endpoints gubernamentales de INEGI SCINCE para demografía...",
      "Extrayendo puntos comerciales activos en INEGI DENUE...",
      "Disparando Vertex AI Gemini 2.5 Pro con habilitación de búsqueda Google Search real...",
      "Sintetizando redes de vínculos y calculando vectores territoriales..."
    ];

    for (let i = 0; i < steps.length; i++) {
      setAnalyzeStep(steps[i]);
      await new Promise(r => setTimeout(r, 700 + Math.random() * 400));
    }

    try {
      let filterPrompt = `BARRIDO ESPECÍFICO DIRIGIDO A: `;
      if (barridoTarget === "all") {
        filterPrompt += `Toda la Pandilla: "${nombre}"`;
      } else if (barridoTarget === "member") {
        const targetM = integrantes.find(m => m.nombre === selectedTargetId || m.alias === selectedTargetId);
        filterPrompt += `Integrante: "${targetM?.alias || "Sin alias"}" (Nombre: ${targetM?.nombre || "No ident."})`;
      } else if (barridoTarget === "zone") {
        filterPrompt += `Zona de Influencia: "${zonaInfluencia}"`;
      } else if (barridoTarget === "shape") {
        const targetShape = geometrias.find(s => s.id === selectedTargetId);
        filterPrompt += `Geometría GIS: "${targetShape?.nombre || "Polígono"}" de tipo ${targetShape?.tipo || ""}`;
      }

      const inputGang: GangEntity = {
        nombre,
        zonaInfluencia,
        estatus,
        integrantes,
        relaciones,
        geometrias,
        cronologiaEventos,
        coordenadas: geometrias.length > 0 ? calculateCentroid(geometrias[0].puntos) : { lat: 21.8853, lng: -102.2916 }
      };

      const result = await PandillasEngine.executeFullSweep(inputGang, filterPrompt);
      setAnalysisResult(result);
      alert("📡 ¡El barrido de geointeligencia multifuente ha concluido! Revise los informes técnicos generados.");
    } catch (err: any) {
      console.error(err);
      alert("❌ Falló el motor de barrido Vertex AI: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleResetForm = () => {
    if (confirm("🚨 ¿Seguro de reiniciar la mesa de inteligencia? Esto borrará la captura local no guardada.")) {
      setSelectedGangId("");
      setNombre("");
      setAliasConocidos("");
      setEstatus("Activa");
      setZonaInfluencia("");
      setColoniasAsociadas("");
      setMunicipiosAsociados("Aguascalientes");
      setIlicitos([]);
      setEspecificarOtroIlicito("");
      setDrogasConsumidas([]);
      setModusOperandi("");
      setSimbolosIdentificacion("");
      setPeligrosidad("Medio");
      setGeoReportId("");
      setIntegrantes([]);
      setRelaciones([]);
      setGeometrias([]);
      setCronologiaEventos([]);
      setImagenesGrafiti([]);
      setArchivos([]);
      setAnalysisResult(null);
      setActiveTab("dashboard");
    }
  };

  const handleAttachReportToWorkspace = async () => {
    if (!analysisResult || !onSaveAnalysisToCloud) return;

    try {
      const formattedIntegrantes = integrantes.map(m =>
        `- **"${m.alias || "N/A"}"** (${m.nombre || "No ident."}) - Rol: ${m.estatusPandilla || "Integrante"} | Peligrosidad: ${m.peligrosidadCalculada}/100 | Criminógeno: ${m.riesgoCriminogeno}`
      ).join("\n");

      const formattedGeometrias = geometrias.map(g =>
        `- **[CAPA ${g.tipo.toUpperCase()}]** ${g.nombre} (Control: ${g.nivelControlTerritorial})`
      ).join("\n");

      const formattedRelaciones = relaciones.map(r =>
        `- ${r.tipo === "rival" ? "❌ RIVAL" : "🤝 AFÍN"}: ${r.pandillaNombre} | Tipo: ${r.tipoVinculo} (Severidad: ${r.nivelSeveridad})`
      ).join("\n");

      const content = `# INFORMES DE INTELIGENCIA CRIMINAL Y GEOINTELIGENCIA TÁCTICA
**Subsistema Perfilador Remoto - CEIPOL**
**Pandilla:** ${nombre} (${aliasConocidos ? `Alias: ${aliasConocidos}` : "Sin alias"})
**ID Geointeligencia:** ${geoReportId || "N/A"}
**Fecha de Emisión:** ${new Date().toLocaleDateString("es-MX")}

---

## PRODUCTO 1: ANÁLISIS DE ESTRUCTURA Y RED DE VÍNCULOS
### 1.1 Identificación y Demografía Criminal
- **Nombre Oficial:** ${nombre}
- **Zona de Influencia Primaria:** ${zonaInfluencia}
- **Colonias Vinculadas:** ${coloniasAsociadas}
- **Municipios:** ${municipiosAsociados}
- **Estatus Operativo:** ${estatus}

### 1.2 Dossier de Integrantes Documentados
${formattedIntegrantes || "*Sin integrantes capturados.*"}

### 1.3 Red de Vínculos Inter-Pandillas (Alianzas y Conflictos)
${formattedRelaciones || "*Sin relaciones binarias registradas.*"}

---

## PRODUCTO 2: INFORME DE RIESGO TERRITORIAL Y GEOINTELIGENCIA
### 2.1 Capas Cartográficas de Control
${formattedGeometrias || "*Sin geometrías delineadas.*"}

### 2.2 Diagnóstico Técnico del Sector
${analysisResult.ficha.resumenInteligencia}

### 2.3 Evaluación Jurídica (Art. 2 Ley de Delincuencia Organizada)
${analysisResult.ficha.crossCheckJuridico}

---
*Documento confidencial para uso exclusivo de mandos policiales. Emitido por el motor CEIPOL FUSION.*`;

      await onSaveAnalysisToCloud(content);
      alert("📋 ¡Los productos de inteligencia se han anexado correctamente al expediente del proyecto!");
    } catch (e: any) {
      alert("❌ Error al anexar informes: " + e.message);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* GLOWING HEADER BAR */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-6 md:p-8 shadow-2xl">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 h-24 w-24 rounded-full bg-purple-500/5 blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-sky-500/30 bg-sky-950/60 text-[10px] font-black tracking-widest text-sky-400 uppercase">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
              SISTEMA DE GEOPOLÍTICA CRIMINAL Y MAPEO TÁCTICO
            </div>
            <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight md:text-3xl">
              Módulo de Inteligencia de Pandillas
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Mesa táctica de control para el registro, análisis relacional de clicas y delineación multifiguras de polígonos de influencia en Aguascalientes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleResetForm}
              className="px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-xs font-bold text-slate-300 transition-all flex items-center gap-1.5 shadow"
            >
              🔄 Reiniciar
            </button>
            <button
              onClick={handleSaveGangToCloud}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-slate-950 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 uppercase"
            >
              💾 Guardar en Nube
            </button>
          </div>
        </div>
      </div>

      {/* OPERATIONAL MATRIX TABS */}
      <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1.5 gap-1.5 shadow-xl overflow-x-auto">
        {[
          { id: "dashboard", label: "📊 Panel Ejecutivo" },
          { id: "registro", label: "📋 Registro Pandilla" },
          { id: "integrantes", label: "👥 Dossier Integrantes" },
          { id: "relaciones", label: "🕸️ Vínculos & Redes" },
          { id: "geointeligencia", label: "🗺️ Geointeligencia GIS" },
          { id: "barridos", label: "📡 Barridos & Reportes" }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id as any);
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
            }}
            className={`flex-1 min-w-[130px] px-3 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${
              activeTab === t.id
                ? "bg-sky-500 text-slate-950 font-black shadow-lg shadow-sky-500/10 scale-[1.02]"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CORE MATRIX SCREENS */}
      <div className="grid grid-cols-1 gap-6">

        {/* TAB 1: EXECUTIVE DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* OPERATIONAL CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl shadow-lg relative overflow-hidden">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gangs Registradas</p>
                <p className="text-3xl font-black text-sky-400 mt-2">{storedGangs.length}</p>
                <div className="text-[10px] text-slate-400 mt-2">Expedientes en base Firestore</div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl shadow-lg relative overflow-hidden">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actores Documentados</p>
                <p className="text-3xl font-black text-emerald-400 mt-2">
                  {storedGangs.reduce((acc, g) => acc + (g.integrantes?.length || 0), 0)}
                </p>
                <div className="text-[10px] text-slate-400 mt-2">Integrantes totales identificados</div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl shadow-lg relative overflow-hidden">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pandilla Activa</p>
                <p className="text-lg font-black text-slate-200 truncate mt-3 uppercase">
                  {nombre || "Sin seleccionar"}
                </p>
                <div className="text-[10px] text-slate-400 mt-1">Estatus actual: <strong className="text-sky-400">{estatus}</strong></div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl shadow-lg relative overflow-hidden">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nivel de Riesgo Global</p>
                <span className={`inline-block px-3 py-1 rounded text-xs font-black uppercase mt-2.5 ${
                  peligrosidad === "Crítico" ? "bg-red-950 text-red-400 border border-red-800" :
                  peligrosidad === "Alto" ? "bg-orange-950 text-orange-400 border border-orange-800" :
                  "bg-sky-950 text-sky-400 border border-sky-800"
                }`}>
                  {peligrosidad}
                </span>
                <div className="text-[10px] text-slate-400 mt-2">Peligrosidad de la pandilla activa</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* ALERTS CONTROL (7 cols) */}
              <div className="lg:col-span-7 bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
                  <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">🚨 Alertas Analíticas del Sistema</h3>
                  <span className="text-[10px] font-bold bg-slate-950 px-2 py-0.5 rounded text-sky-400 border border-slate-800">
                    {alerts.length} alertas activas
                  </span>
                </div>

                {alerts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 italic">
                    Sin alertas de riesgo territorial u operativas activas para esta pandilla.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-2">
                    {alerts.map((a, i) => (
                      <div
                        key={i}
                        className={`p-3.5 rounded-xl border flex gap-3.5 relative overflow-hidden bg-slate-950/40 ${
                          a.severidad === "Crítica" ? "border-red-900/50" :
                          a.severidad === "Alta" ? "border-orange-900/50" :
                          "border-slate-800"
                        }`}
                      >
                        <span className="text-lg">
                          {a.tipo === "territorio" ? "📍" : a.tipo === "conflicto" ? "⚔️" : "👤"}
                        </span>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-wider ${
                              a.severidad === "Crítica" ? "text-red-400" :
                              a.severidad === "Alta" ? "text-orange-400" :
                              "text-sky-400"
                            }`}>
                              ALERTA {a.severidad}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-semibold">{a.mensaje}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TIMELINE OF EVENTS (5 cols) */}
              <div className="lg:col-span-5 bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide border-b border-slate-800 pb-2">
                  📅 Línea de Tiempo de Confrontaciones y Eventos
                </h3>

                {/* Event creation form */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={tempEvent.fecha}
                      onChange={e => setTempEvent({ ...tempEvent, fecha: e.target.value })}
                      className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200"
                    />
                    <select
                      value={tempEvent.gravedad}
                      onChange={e => setTempEvent({ ...tempEvent, gravedad: e.target.value as any })}
                      className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    >
                      <option value="Baja">Gravedad Baja</option>
                      <option value="Media">Gravedad Media</option>
                      <option value="Alta">Gravedad Alta</option>
                      <option value="Crítica">Gravedad Crítica</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Título del incidente"
                      value={tempEvent.titulo}
                      onChange={e => setTempEvent({ ...tempEvent, titulo: e.target.value })}
                      className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Ubicación/Lugar"
                      value={tempEvent.lugar}
                      onChange={e => setTempEvent({ ...tempEvent, lugar: e.target.value })}
                      className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200"
                    />
                  </div>
                  <textarea
                    placeholder="Descripción táctica..."
                    value={tempEvent.descripcion}
                    onChange={e => setTempEvent({ ...tempEvent, descripcion: e.target.value })}
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none"
                  />
                  <button
                    onClick={handleAddTimelineEvent}
                    className="w-full py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-xs font-bold text-slate-950 uppercase"
                  >
                    ➕ Registrar Incidente
                  </button>
                </div>

                {/* Timeline visual rendering */}
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                  {cronologiaEventos.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 italic">
                      Sin eventos históricos registrados.
                    </div>
                  ) : (
                    <div className="relative border-l border-slate-800 pl-4 space-y-4">
                      {cronologiaEventos.map((ev, i) => (
                        <div key={ev.id || i} className="relative">
                          <span className={`absolute -left-[21px] top-1 h-3.5 w-3.5 rounded-full border-2 border-slate-950 ${
                            ev.gravedad === "Crítica" ? "bg-red-500" : ev.gravedad === "Alta" ? "bg-orange-500" : "bg-sky-500"
                          }`} />
                          <div className="text-[10px] text-slate-500 font-bold">{ev.fecha} {ev.lugar && `· ${ev.lugar}`}</div>
                          <h4 className="text-xs font-bold text-slate-200 uppercase mt-0.5">{ev.titulo}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{ev.descripcion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SELECTION MATRIX (LOAD SYSTEM RECORDS) */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide border-b border-slate-800 pb-2">
                📂 Expedientes de Geointeligencia en Base de Datos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {storedGangs.map(g => (
                  <div
                    key={g.id}
                    onClick={() => loadGangIntoState(g)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 relative group ${
                      selectedGangId === g.id
                        ? "bg-sky-950/40 border-sky-500"
                        : "bg-slate-950/45 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`🚨 ¿Confirma la eliminación permanente de la pandilla "${g.nombre}" de la base de datos?`)) {
                          await PandillasService.deleteGang(g.id!);
                          await loadSavedGangs();
                          if (selectedGangId === g.id) {
                            handleResetForm();
                          }
                        }
                      }}
                      className="absolute right-3 top-3 p-1 rounded text-slate-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      🗑️
                    </button>
                    <div>
                      <span className="text-[9px] font-black text-sky-400 uppercase tracking-wider">EXPEDIENTE CEIPOL</span>
                      <h4 className="text-xs font-extrabold text-slate-200 truncate uppercase mt-0.5">{g.nombre}</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Zona: <strong className="text-slate-300">{g.zonaInfluencia || "Sin delimitar"}</strong></p>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-800/80 pt-2 mt-1">
                      <span>👥 {g.integrantes?.length || 0} integrantes</span>
                      <span className="uppercase font-mono">RISK: {g.peligrosidad || "MEDIO"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PANDILLA REGISTRY FORM */}
        {activeTab === "registro" && (
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <span>📝</span> Captura General de Pandilla o Clica Criminal
              </h2>
              <p className="text-xs text-slate-400 mt-1">Declare los datos identitarios generales y parámetros delictivos observados en campo.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* COLUMN Left (6 cols) */}
              <div className="md:col-span-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Nombre Oficial de la Pandilla</label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      placeholder="Ej. Mara Salvatrucha 13, Los de la Catorce..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Alias conocidos</label>
                    <input
                      type="text"
                      value={aliasConocidos}
                      onChange={e => setAliasConocidos(e.target.value)}
                      placeholder="Ej. MS-13, Los Monstruos..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Estatus de la Pandilla</label>
                    <select
                      value={estatus}
                      onChange={e => setEstatus(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                    >
                      <option value="Activa">Activa (Operación Territorial)</option>
                      <option value="Inactiva">Inactiva</option>
                      <option value="En observación">En observación táctica</option>
                      <option value="Desarticulada">Desarticulada (Detención del liderazgo)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Nivel de Peligrosidad</label>
                    <select
                      value={peligrosidad}
                      onChange={e => setPeligrosidad(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                    >
                      <option value="Bajo">Bajo</option>
                      <option value="Medio">Medio</option>
                      <option value="Alto">Alto (Fricción armada constante)</option>
                      <option value="Crítico">Crítico (Uso de armas de alto calibre / nexos cárteles)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Zona Principal de Influencia</label>
                  <input
                    type="text"
                    value={zonaInfluencia}
                    onChange={e => setZonaInfluencia(e.target.value)}
                    placeholder="Ej. Sector Oriente, Valle de los Cactus..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Colonias Asociadas</label>
                    <input
                      type="text"
                      value={coloniasAsociadas}
                      onChange={e => setColoniasAsociadas(e.target.value)}
                      placeholder="Colonia 1, Colonia 2, etc."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Municipios Asociados</label>
                    <input
                      type="text"
                      value={municipiosAsociados}
                      onChange={e => setMunicipiosAsociados(e.target.value)}
                      placeholder="Aguascalientes, Jesús María, etc."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Modus Operandi Predominante</label>
                  <textarea
                    value={modusOperandi}
                    onChange={e => setModusOperandi(e.target.value)}
                    placeholder="Detalle de actividades, horarios, tácticas de cobro, despliegues..."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* COLUMN Right (6 cols) */}
              <div className="md:col-span-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Ilícitos a los que se dedica (Checklist)</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                    {["Narcomenudeo", "Robo", "Extorsión", "Homicidio", "Lesiones", "Daño en las cosas", "Vandalismo"].map(ili => {
                      const active = ilicitos?.includes(ili as any);
                      return (
                        <label key={ili} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => {
                              if (active) {
                                setIlicitos(ilicitos?.filter(i => i !== ili) as any);
                              } else {
                                setIlicitos([...(ilicitos || []), ili as any]);
                              }
                            }}
                            className="rounded bg-slate-900 border-slate-800 text-sky-500 focus:ring-0 focus:ring-offset-0"
                          />
                          {ili}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Drogas consumidas por sus integrantes</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                    {["Cannabis", "Cocaína", "Cristal", "Fentanilo", "Inhalantes", "Pastillas Psicotrópicas"].map(dg => {
                      const active = drogasConsumidas.includes(dg);
                      return (
                        <label key={dg} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => {
                              if (active) {
                                setDrogasConsumidas(drogasConsumidas.filter(d => d !== dg));
                              } else {
                                setDrogasConsumidas([...drogasConsumidas, dg]);
                              }
                            }}
                            className="rounded bg-slate-900 border-slate-800 text-sky-500 focus:ring-0 focus:ring-offset-0"
                          />
                          {dg}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Grafitis o Símbolos de identificación territorial</label>
                  <input
                    type="text"
                    value={simbolosIdentificacion}
                    onChange={e => setSimbolosIdentificacion(e.target.value)}
                    placeholder="Ej. Trazos numéricos de '13', aerosol color negro, coronas de 5 puntas..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* GALLERY OF MULTIPLE GRAFFITI / MESSAGE IMAGES */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-3.5">
                  <p className="text-[10px] font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🖼️</span> Galería Fotográfica de Grafitis y Mensajes delictivos
                  </p>
                  
                  {/* Adder Sub-form */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-slate-900/40 p-3 rounded-lg border border-slate-800/80">
                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Clasificación / Tipo</label>
                      <select
                        value={newGraffitiType}
                        onChange={e => setNewGraffitiType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="Identidad">Identidad / Marca de Clica</option>
                        <option value="Advertencia">Mensaje de Advertencia / Rivalidad</option>
                        <option value="Frontera">Límite Territorial / Frontera</option>
                        <option value="Punto de venta">Punto de Venta de Droga</option>
                        <option value="Otro">Otro / Mensaje Codificado</option>
                      </select>
                    </div>
                    <div className="sm:col-span-5 space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Descripción / Referencia</label>
                      <input
                        type="text"
                        placeholder="Ej. Muro col. Solidaridad"
                        value={newGraffitiDesc}
                        onChange={e => setNewGraffitiDesc(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="w-full py-2 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-[10px] uppercase text-center block cursor-pointer transition-all shadow-md">
                        📸 SUBIR IMAGEN
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadGraffitiImage}
                        />
                      </label>
                    </div>
                  </div>

                  {/* List / Grid of Loaded Images */}
                  <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                    {imagenesGrafiti.map((img) => (
                      <div key={img.id} className="relative rounded-lg border border-slate-800 bg-slate-900/50 p-2 group flex flex-col justify-between">
                        <div className="relative w-full h-24 rounded bg-slate-950 border border-slate-850 overflow-hidden">
                          <img src={img.url} className="w-full h-full object-cover" alt="Graffiti / Marca" />
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-950/90 text-sky-400 border border-slate-800">
                            {img.tipo}
                          </span>
                          <button
                            type="button"
                            onClick={() => setImagenesGrafiti(imagenesGrafiti.filter(x => x.id !== img.id))}
                            className="absolute top-1 right-1 bg-red-950/90 hover:bg-red-900/90 border border-red-950 text-[8px] font-black text-red-400 px-1.5 py-0.5 rounded transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                        <p className="text-[10px] font-bold text-slate-300 mt-1.5 truncate uppercase">
                          {img.descripcion}
                        </p>
                        <p className="text-[8px] text-slate-500 font-mono text-right mt-0.5">
                          Reg: {img.fechaRegistro}
                        </p>
                      </div>
                    ))}
                    {imagenesGrafiti.length === 0 && (
                      <div className="col-span-2 text-center py-6 text-[10px] text-slate-500 italic border border-dashed border-slate-805/80 rounded-lg">
                        Sin imágenes de grafitis o marcas cargadas.
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveGangToCloud}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg"
                >
                  💾 Confirmar & Guardar Ficha General
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MEMBER DOSSIER */}
        {activeTab === "integrantes" && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* MEMBER CAPTURE COLUMN (6 cols) */}
            <div className="lg:col-span-6 bg-slate-900/30 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">
                  {editingMemberIndex !== null ? "✏️ Editar Integrante del Dossier" : "➕ Registrar Nuevo Integrante en Dossier"}
                </h3>
              </div>

              <div className="space-y-3.5">
                {/* CORE INDIVIDUAL DATA WITH PHOTOGRAPHY */}
                <div className="flex gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <div className="flex flex-col items-center justify-center border-r border-slate-800/80 pr-4 space-y-1.5 flex-shrink-0">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fotografía</label>
                    <div className="relative w-20 h-20 bg-slate-900 rounded-xl border border-slate-700/60 flex items-center justify-center overflow-hidden group">
                      {tempMember.fotografiaUrl ? (
                        <img src={tempMember.fotografiaUrl} className="w-full h-full object-cover" alt="Vista previa" />
                      ) : (
                        <span className="text-3xl text-slate-600">👤</span>
                      )}
                      <label className="absolute inset-0 bg-slate-950/85 flex items-center justify-center text-[9px] font-black text-sky-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                        SUBIR
                        <input type="file" accept="image/*" className="hidden" onChange={handleMemberPhotoUpload} />
                      </label>
                    </div>
                    {tempMember.fotografiaUrl && (
                      <button
                        type="button"
                        onClick={() => setTempMember({ ...tempMember, fotografiaUrl: "" })}
                        className="text-[8px] text-red-400 font-extrabold uppercase hover:underline"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Nombre Completo</label>
                      <input
                        type="text"
                        placeholder="Nombre real (Ej. Carlos Martínez Pérez)"
                        value={tempMember.nombre}
                        onChange={e => setTempMember({ ...tempMember, nombre: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Alias / Apodo</label>
                      <input
                        type="text"
                        placeholder="Ej. El Charly"
                        value={tempMember.alias}
                        onChange={e => setTempMember({ ...tempMember, alias: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Sexo</label>
                    <select
                      value={tempMember.sexo}
                      onChange={e => setTempMember({ ...tempMember, sexo: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Edad</label>
                    <input
                      type="text"
                      placeholder="Ej. 21"
                      value={tempMember.edad}
                      onChange={e => setTempMember({ ...tempMember, edad: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Estatus / Jerarquía</label>
                    <select
                      value={tempMember.estatusPandilla}
                      onChange={e => setTempMember({ ...tempMember, estatusPandilla: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="Líder">Líder</option>
                      <option value="Segundo al mando">Segundo al mando</option>
                      <option value="Reclutador">Reclutador</option>
                      <option value="Distribuidor">Distribuidor</option>
                      <option value="Vigilante">Vigilante</option>
                      <option value="Operador">Operador</option>
                      <option value="Integrante">Integrante</option>
                      <option value="Exintegrante">Exintegrante</option>
                      <option value="Colaborador externo">Colaborador externo</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">CURP (Opcional)</label>
                    <input
                      type="text"
                      placeholder="CURP (18 dígitos)"
                      value={tempMember.curp}
                      onChange={e => setTempMember({ ...tempMember, curp: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Teléfono (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej. 4491234567"
                      value={tempMember.telefono}
                      onChange={e => setTempMember({ ...tempMember, telefono: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Domicilio Conocido</label>
                  <input
                    type="text"
                    placeholder="Calle, No, Colonia, Municipio"
                    value={tempMember.domicilioConocido}
                    onChange={e => setTempMember({ ...tempMember, domicilioConocido: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                  />
                </div>

                {/* CRIMINOLOGICAL INFORMATION */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-3">
                  <p className="text-[10px] font-black text-sky-400 uppercase tracking-wider">⚖️ Información Criminológica & Penal</p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Nivel de Violencia</label>
                      <select
                        value={tempMember.nivelViolencia}
                        onChange={e => setTempMember({ ...tempMember, nivelViolencia: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                      >
                        <option value="Bajo">Bajo</option>
                        <option value="Medio">Medio</option>
                        <option value="Alto">Alto</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Riesgo Criminógeno</label>
                      <select
                        value={tempMember.riesgoCriminogeno}
                        onChange={e => setTempMember({ ...tempMember, riesgoCriminogeno: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                      >
                        <option value="Bajo">Bajo</option>
                        <option value="Medio">Medio</option>
                        <option value="Alto">Alto</option>
                        <option value="Crítico">Crítico</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Antecedentes criminales genéricos"
                      value={tempMember.antecedentes}
                      onChange={e => setTempMember({ ...tempMember, antecedentes: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Detenciones previas e informes homologados (IPH)"
                      value={tempMember.detencionesPrevias}
                      onChange={e => setTempMember({ ...tempMember, detencionesPrevias: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Ingresos a centros de internamiento / reclusorios"
                      value={tempMember.ingresosCentrosInternamiento}
                      onChange={e => setTempMember({ ...tempMember, ingresosCentrosInternamiento: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Sustancias consumidas (Ej. Cristal, Solvente)"
                      value={tempMember.consumoDrogas}
                      onChange={e => setTempMember({ ...tempMember, consumoDrogas: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200"
                    />
                  </div>
                </div>

                {/* RASGOS Y OCUPACION */}
                <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-sky-400 uppercase tracking-wider">🔍 Señas & Tatuajes</p>
                    <input
                      type="text"
                      placeholder="Tatuajes (brazo, cuello)"
                      value={tempMember.tatuajes}
                      onChange={e => setTempMember({ ...tempMember, tatuajes: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Cicatrices"
                      value={tempMember.cicatrices}
                      onChange={e => setTempMember({ ...tempMember, cicatrices: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Marcas distintivas"
                      value={tempMember.marcasDistintivas}
                      onChange={e => setTempMember({ ...tempMember, marcasDistintivas: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-sky-400 uppercase tracking-wider">💼 Ocupación</p>
                    <input
                      type="text"
                      placeholder="Lugar de trabajo"
                      value={tempMember.lugarTrabajo}
                      onChange={e => setTempMember({ ...tempMember, lugarTrabajo: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Actividad económica"
                      value={tempMember.actividadEconomica}
                      onChange={e => setTempMember({ ...tempMember, actividadEconomica: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Escuela"
                      value={tempMember.escuela}
                      onChange={e => setTempMember({ ...tempMember, escuela: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  {editingMemberIndex !== null && (
                    <button
                      onClick={() => setEditingMemberIndex(null)}
                      className="flex-1 py-2 rounded-lg border border-slate-800 text-xs font-bold text-slate-400 hover:bg-slate-900"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={handleAddMember}
                    className="flex-2 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase flex-1 shadow"
                  >
                    💾 Guardar Integrante en Ficha
                  </button>
                </div>
              </div>
            </div>

            {/* REGISTERED DOSSIER GRID (6 cols) */}
            <div className="lg:col-span-6 space-y-4 bg-slate-900/30 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide border-b border-slate-800 pb-2">
                📋 Dossier Criminal de la Pandilla ({integrantes.length} integrantes)
              </h3>

              {integrantes.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500 italic">
                  No hay integrantes capturados aún. Regístrelos en el panel de la izquierda.
                </div>
              ) : (
                <div className="space-y-4 max-h-[620px] overflow-y-auto pr-2">
                  {integrantes.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 relative flex gap-4 hover:border-slate-700 transition-colors"
                    >
                      {/* Avatar Photo */}
                      <div className="w-16 h-16 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                        {m.fotografiaUrl ? (
                          <img src={m.fotografiaUrl} className="w-full h-full object-cover" alt={m.alias || m.nombre} />
                        ) : (
                          <span className="text-2xl">{m.sexo === "Femenino" ? "👩" : "👨"}</span>
                        )}
                        {/* Peligrosidad badge overlay */}
                        <div className="absolute bottom-0 inset-x-0 text-center bg-slate-950/80 text-[8px] font-black text-sky-400">
                          {m.peligrosidadCalculada}%
                        </div>
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 justify-between">
                          <h4 className="text-xs font-extrabold text-slate-200 truncate uppercase">
                            {m.alias ? `"${m.alias}"` : "Sin alias"}
                          </h4>
                          <span className="px-2 py-0.5 rounded bg-sky-950/60 border border-sky-900/40 text-[9px] text-sky-400 font-extrabold uppercase">
                            {m.estatusPandilla}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 truncate">
                          <strong className="text-slate-500">Nombre:</strong> {m.nombre || "No identificado"}
                          {m.edad && ` (${m.edad} años)`}
                        </p>

                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 border-t border-slate-900 pt-2 mt-1">
                          <p>Violencia: <span className="text-slate-300 font-bold">{m.nivelViolencia}</span></p>
                          <p>Riesgo: <span className="text-slate-300 font-bold">{m.riesgoCriminogeno}</span></p>
                        </div>

                        {/* Extra indicators */}
                        <div className="flex flex-wrap gap-1 pt-1.5">
                          {m.tatuajes && <span className="text-[8px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">🎨 Tatuajes</span>}
                          {m.antecedentes && <span className="text-[8px] bg-red-950/30 text-red-400 px-1.5 py-0.5 rounded border border-red-900/20">⚖️ Antecedentes</span>}
                          {m.curp && <span className="text-[8px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">📄 CURP</span>}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 justify-center pl-2">
                        <button
                          onClick={() => handleEditMember(idx)}
                          className="p-1.5 hover:bg-slate-900 rounded text-slate-400 hover:text-sky-400 text-xs transition-colors"
                          title="Editar Ficha"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`🚨 ¿Remover a "${m.alias || m.nombre}" del dossier?`)) {
                              setIntegrantes(integrantes.filter((_, i) => i !== idx));
                            }
                          }}
                          className="p-1.5 hover:bg-slate-900 rounded text-slate-400 hover:text-red-400 text-xs transition-colors"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: RELATIONSHIPS & LINK NETWORK */}
        {activeTab === "relaciones" && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LINK REGISTRATION (5 cols) */}
            <div className="lg:col-span-5 bg-slate-900/30 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">
                  🕸️ Declaración de Vínculos Inter-Pandillas
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Defina relaciones binarias (Rivalidades/Alianzas) con otras clicas registradas en el sistema.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Vínculo</label>
                  <select
                    value={tempRel.tipo}
                    onChange={e => setTempRel({ ...tempRel, tipo: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200"
                  >
                    <option value="rival">Pandilla Antagónica (Rivalidad)</option>
                    <option value="asociado">Pandilla Afín (Alianza)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre de la Pandilla Destino</label>
                  <input
                    type="text"
                    placeholder="Escriba o seleccione pandilla"
                    value={tempRel.pandillaNombre}
                    onChange={e => setTempRel({ ...tempRel, pandillaNombre: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200"
                    list="registered-gangs"
                  />
                  <datalist id="registered-gangs">
                    {storedGangs.map(g => <option key={g.id} value={g.nombre} />)}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Detalle/Tipo del Vínculo</label>
                  <input
                    type="text"
                    placeholder="Ej. Conflicto por control de plaza, distribución conjunta"
                    value={tempRel.tipoVinculo}
                    onChange={e => setTempRel({ ...tempRel, tipoVinculo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha de inicio</label>
                    <input
                      type="date"
                      value={tempRel.fechaInicio}
                      onChange={e => setTempRel({ ...tempRel, fechaInicio: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nivel de Confrontación / Alianza</label>
                    <select
                      value={tempRel.nivelSeveridad}
                      onChange={e => setTempRel({ ...tempRel, nivelSeveridad: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="Bajo">Bajo</option>
                      <option value="Medio">Medio</option>
                      <option value="Alto">Alto</option>
                      <option value="Crítico">Crítico</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAddRelationship}
                  className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-xs font-bold text-slate-950 uppercase rounded shadow"
                >
                  ➕ Enlazar Pandillas
                </button>
              </div>

              {/* LIST OF ENROLLED BINDINGS */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase">Vínculos Registrados</h4>
                {relaciones.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No hay relaciones registradas aún.</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                    {relaciones.map((rel, idx) => (
                      <div key={idx} className="p-2.5 rounded border border-slate-800 bg-slate-950/40 flex justify-between items-center text-xs">
                        <div>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase mr-2 ${
                            rel.tipo === "rival" ? "bg-red-950 text-red-400 border border-red-900" : "bg-emerald-950 text-emerald-400 border border-emerald-900"
                          }`}>
                            {rel.tipo}
                          </span>
                          <span className="font-extrabold text-slate-200 uppercase">{rel.pandillaNombre}</span>
                          <p className="text-[10px] text-slate-500 mt-0.5">Motivo: {rel.tipoVinculo} (Severidad: {rel.nivelSeveridad})</p>
                        </div>
                        <button
                          onClick={() => setRelaciones(relaciones.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-red-400 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* INTERACTIVE LINK NETWORK VISUAL (7 cols) */}
            <div className="lg:col-span-7 bg-slate-900/30 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide border-b border-slate-800 pb-2">
                🔗 Red de Vínculos del Crimen Organizado (Grafo de Inteligencia)
              </h3>

              <div className="h-96 w-full bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden shadow-inner">
                {/* Visual SVG math */}
                <svg className="w-full h-full">
                  {/* Edges */}
                  {relaciones.map((rel, i) => {
                    const total = relaciones.length;
                    const angle = (i / total) * Math.PI * 2;
                    const r = 130;
                    const startX = 220;
                    const startY = 180;
                    const targetX = startX + Math.cos(angle) * r;
                    const targetY = startY + Math.sin(angle) * r;

                    return (
                      <g key={i}>
                        <line
                          x1={startX}
                          y1={startY}
                          x2={targetX}
                          y2={targetY}
                          stroke={rel.tipo === "rival" ? "#ef4444" : "#10b981"}
                          strokeWidth={rel.nivelSeveridad === "Crítico" ? 3 : 1.5}
                          strokeDasharray={rel.tipo === "rival" ? "4,4" : undefined}
                          opacity={0.7}
                        />
                        {/* Relationship label */}
                        <text
                          x={(startX + targetX) / 2}
                          y={(startY + targetY) / 2 - 5}
                          fill="#64748b"
                          fontSize="8"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {rel.tipoVinculo.substring(0, 15)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Node Primary */}
                  <g transform="translate(220, 180)">
                    <circle r="18" fill="#0284c7" stroke="#38bdf8" strokeWidth="2.5" />
                    <text y="32" textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="bold" className="uppercase">
                      {nombre || "PANDILLA BASE"}
                    </text>
                  </g>

                  {/* Nodes Sibling */}
                  {relaciones.map((rel, i) => {
                    const total = relaciones.length;
                    const angle = (i / total) * Math.PI * 2;
                    const r = 130;
                    const startX = 220;
                    const startY = 180;
                    const targetX = startX + Math.cos(angle) * r;
                    const targetY = startY + Math.sin(angle) * r;

                    return (
                      <g key={i} transform={`translate(${targetX}, ${targetY})`}>
                        <circle
                          r="12"
                          fill={rel.tipo === "rival" ? "#7f1d1d" : "#064e3b"}
                          stroke={rel.tipo === "rival" ? "#ef4444" : "#10b981"}
                          strokeWidth="2"
                        />
                        <text y="24" textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight="extrabold" className="uppercase">
                          {rel.pandillaNombre}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: GEOINTELIGENCIA TÁCTICA */}
        {activeTab === "geointeligencia" && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* GIS TOOLBOX PANEL (4 cols) */}
            <div className="lg:col-span-4 bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-start">
              {/* GIS TAB SWITCHER */}
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setGisSidebarTab("analysis")}
                  className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase tracking-wider transition-all ${
                    gisSidebarTab === "analysis"
                      ? "bg-sky-500 text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🗺️ Análisis GIS
                </button>
                <button
                  type="button"
                  onClick={() => setGisSidebarTab("drawing")}
                  className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase tracking-wider transition-all ${
                    gisSidebarTab === "drawing"
                      ? "bg-sky-500 text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📐 Delineado Manual
                </button>
              </div>

              {gisSidebarTab === "drawing" ? (
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-2">
                    <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">
                      🛠️ GIS Tactical Drawing Toolbox
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase block">1. Seleccionar Geometría</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "poligono", label: "🔷 Polígono", desc: "Zonas de dominio" },
                          { id: "corredor", label: "📈 Corredor", desc: "Líneas de paso/rutas" },
                          { id: "buffer", label: "⭕ Buffer", desc: "Radios de acción" }
                        ].map(type => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => {
                              setDrawingMode(type.id as any);
                              setTempShapePoints([]);
                            }}
                            className={`p-2 rounded-lg border text-xs font-bold text-left flex flex-col justify-between transition-all ${
                              drawingMode === type.id
                                ? "bg-sky-950/60 border-sky-500 text-sky-400"
                                : "bg-slate-950/45 border-slate-800 hover:border-slate-700 text-slate-300"
                            }`}
                          >
                            <span>{type.label}</span>
                            <span className="text-[8px] text-slate-500 font-medium mt-0.5">{type.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {drawingMode && (
                      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3.5 animate-fadeIn">
                        <p className="text-[9px] font-black text-sky-400 uppercase tracking-widest">📐 Dibujando Nueva Capa GIS</p>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Nombre de la Capa</label>
                          <input
                            type="text"
                            placeholder="Ej. Polígono de Venta Este, Corredor de Huida"
                            value={tempShapeName}
                            onChange={e => setTempShapeName(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Control Territorial</label>
                          <select
                            value={tempShapeControl}
                            onChange={e => setTempShapeControl(e.target.value as any)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                          >
                            <option value="Nulo">Nulo</option>
                            <option value="Bajo">Bajo</option>
                            <option value="Medio">Medio</option>
                            <option value="Alto">Alto</option>
                            <option value="Absoluto">Absoluto (Control delictivo total)</option>
                          </select>
                        </div>

                        {drawingMode === "buffer" && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase flex justify-between">
                              <span>Radio Buffer:</span>
                              <span className="text-sky-400 font-bold">{tempShapeRadius} metros</span>
                            </label>
                            <input
                              type="range"
                              min="100"
                              max="1500"
                              step="50"
                              value={tempShapeRadius}
                              onChange={e => setTempShapeRadius(parseInt(e.target.value))}
                              className="w-full accent-sky-500"
                            />
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 bg-slate-900/60 p-2.5 rounded border border-slate-800 leading-relaxed font-medium">
                          👉 Haga clic directamente sobre el mapa táctico para establecer los vértices correspondientes.
                          <div className="mt-1.5 flex justify-between font-bold">
                            <span>Vértices colocados:</span>
                            <span className="text-sky-400">{tempShapePoints.length}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setTempShapePoints([]);
                              setDrawingMode(null);
                            }}
                            className="flex-1 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300"
                          >
                            Descartar
                          </button>
                          <button
                            onClick={handleSaveGeometry}
                            className="flex-1 py-1 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black uppercase"
                          >
                            Guardar Capa
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* LIST OF SAVED DELINEATED LAYERS */}
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase">Capas Espaciales Guardadas</h4>
                    {geometrias.length === 0 ? (
                      <p className="text-xs text-slate-505 italic">No hay geometrías delineadas aún.</p>
                    ) : (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {geometrias.map((geo) => {
                          const isEditing = editingGeometryId === geo.id;
                          return (
                            <div key={geo.id} className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2 text-xs">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px]">
                                      {geo.tipo === "poligono" ? "🔷" : geo.tipo === "corredor" ? "📈" : geo.tipo === "buffer" ? "⭕" : "📍"}
                                    </span>
                                    <span className="font-extrabold text-slate-300 uppercase">{geo.nombre}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-1">Control: <strong className="text-sky-400 uppercase">{geo.nivelControlTerritorial}</strong></p>
                                </div>
                                <div className="flex gap-1">
                                  {isEditing ? (
                                    <button
                                      onClick={() => setEditingGeometryId(null)}
                                      className="px-2 py-1 bg-emerald-600 text-slate-950 text-[10px] font-bold rounded"
                                    >
                                      Terminar
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingGeometryId(geo.id);
                                        setDrawingMode(null);
                                      }}
                                      className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] font-bold rounded hover:bg-slate-700"
                                    >
                                      Editar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (isEditing) setEditingGeometryId(null);
                                      setGeometrias(geometrias.filter(g => g.id !== geo.id));
                                    }}
                                    className="text-slate-500 hover:text-red-400 text-xs px-1.5"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                              {isEditing && geo.tipo === "buffer" && (
                                <div className="space-y-1 bg-slate-900/60 p-2 rounded border border-slate-800 animate-fadeIn">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase flex justify-between">
                                    <span>Radio del Buffer:</span>
                                    <span className="text-sky-400 font-bold">{geo.radio || 300}m</span>
                                  </label>
                                  <input
                                    type="range"
                                    min="100"
                                    max="1500"
                                    step="50"
                                    value={geo.radio || 300}
                                    onChange={e => {
                                      const newRadius = parseInt(e.target.value);
                                      setGeometrias(prev => prev.map(g => g.id === geo.id ? { ...g, radio: newRadius } : g));
                                    }}
                                    className="w-full accent-sky-500"
                                  />
                                </div>
                              )}
                              {isEditing && (
                                <p className="text-[9px] text-slate-500 italic leading-snug">
                                  💡 Arrastre los vértices numerados sobre el mapa para modificar el trazado. Haga doble clic en un vértice para eliminarlo.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 flex-1 flex flex-col justify-start">
                  <div className="border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-black text-sky-400 uppercase tracking-widest">
                      🗺️ GANG GIS ANALYSIS LAYER
                    </h3>
                  </div>

                  {/* MULTI-GANG CHECKBOXES */}
                  <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">👥 Seleccionar Pandillas ({selectedGangsForGis.length})</p>
                    {storedGangs.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">No hay pandillas registradas</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {storedGangs.map((g) => {
                          const isChecked = selectedGangsForGis.includes(g.nombre);
                          return (
                            <label key={g.id} className="flex items-center justify-between text-xs text-slate-300 font-medium cursor-pointer hover:bg-slate-900/40 p-1 rounded transition-colors">
                              <span className="flex items-center gap-2">
                                👥 {g.nombre}
                              </span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedGangsForGis(selectedGangsForGis.filter(n => n !== g.nombre));
                                  } else {
                                    setSelectedGangsForGis([...selectedGangsForGis, g.nombre]);
                                  }
                                  setSelectedGisNode(null);
                                  setSelectedGisZone(null);
                                }}
                                className="rounded bg-slate-900 border-slate-800 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* LAYER TOGGLES WITH CRIME FILTERS */}
                  <div className="space-y-2 bg-slate-950/45 p-3 rounded-xl border border-slate-800/80">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Capas GIS Activas</p>
                    <div className="space-y-2">
                      <label className="flex items-center justify-between text-xs text-slate-300 font-medium cursor-pointer">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500" /> Domicilios de Integrantes
                        </span>
                        <input
                          type="checkbox"
                          checked={showGisNodes}
                          onChange={e => setShowGisNodes(e.target.checked)}
                          className="rounded bg-slate-900 border-slate-850 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs text-slate-300 font-medium cursor-pointer">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500" /> Zonas de Influencia
                        </span>
                        <input
                          type="checkbox"
                          checked={showGisZones}
                          onChange={e => setShowGisZones(e.target.checked)}
                          className="rounded bg-slate-900 border-slate-850 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs text-slate-300 font-medium cursor-pointer">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-500" /> Redes de Proximidad
                        </span>
                        <input
                          type="checkbox"
                          checked={showGisRelations}
                          onChange={e => setShowGisRelations(e.target.checked)}
                          className="rounded bg-slate-900 border-slate-850 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                        />
                      </label>
                      
                      <label className="flex items-center justify-between text-xs text-slate-300 font-medium cursor-pointer pt-1 border-t border-slate-900/60">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> Incidencia Delictiva
                        </span>
                        <input
                          type="checkbox"
                          checked={showGisIncidents}
                          onChange={e => setShowGisIncidents(e.target.checked)}
                          className="rounded bg-slate-900 border-slate-850 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                        />
                      </label>

                      {showGisIncidents && (
                        <div className="pl-4 pt-1.5 space-y-1.5 border-l border-slate-800 animate-fadeIn">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Tipos de Delito</p>
                          <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                            {CRIME_TYPES_MAP.map(crime => {
                              const isChecked = selectedCrimeTypes.includes(crime.id);
                              return (
                                <label key={crime.id} className="flex items-center justify-between text-[10px] text-slate-400 cursor-pointer hover:bg-slate-900/20 p-0.5 rounded transition-colors">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: crime.color }} />
                                    {crime.label}
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedCrimeTypes(selectedCrimeTypes.filter(x => x !== crime.id));
                                      } else {
                                        setSelectedCrimeTypes([...selectedCrimeTypes, crime.id]);
                                      }
                                    }}
                                    className="rounded bg-slate-900 border-slate-800 text-sky-500 focus:ring-0 w-3 h-3"
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* INEGI WMS LAYERS */}
                  <div className="space-y-2 bg-slate-950/45 p-3 rounded-xl border border-slate-800/80">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Capas WMS INEGI (GAIA)</p>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {WMS_LAYERS_CATALOG.map(wms => {
                        const isChecked = selectedWmsLayers.includes(wms.id);
                        return (
                          <label key={wms.id} className="flex items-center justify-between text-xs text-slate-300 font-medium cursor-pointer hover:bg-slate-900/10 p-0.5 rounded transition-colors">
                            <span className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                wms.category === "hidrologia" ? "bg-blue-500" :
                                wms.category === "topografia" ? "bg-emerald-500" :
                                wms.category === "uso_suelo" ? "bg-yellow-600" :
                                wms.category === "organizacion_territorial" ? "bg-purple-500" : "bg-slate-400"
                              }`} /> {wms.title}
                            </span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedWmsLayers(selectedWmsLayers.filter(x => x !== wms.id));
                                } else {
                                  setSelectedWmsLayers([...selectedWmsLayers, wms.id]);
                                }
                              }}
                              className="rounded bg-slate-900 border-slate-850 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* UNIFIED GIS ANALYSIS TRIGGER */}
                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-2.5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed font-mono">
                      ⚡ Análisis geoespacial cruzando pandillas, capas activas, trazos manuales y delitos de sector.
                    </p>
                    <button
                      type="button"
                      onClick={handleGisAnalysis}
                      disabled={isGisAnalyzing || selectedGangsForGis.length === 0}
                      className="w-full h-9 bg-gradient-to-r from-sky-400 to-indigo-600 hover:opacity-90 disabled:opacity-40 text-slate-950 text-xs font-black uppercase rounded-lg shadow-lg flex items-center justify-center gap-1.5 transition-all"
                    >
                      {isGisAnalyzing ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent" />
                          <span>Analizando...</span>
                        </>
                      ) : (
                        <span>Ejecutar Análisis GEOINT</span>
                      )}
                    </button>
                  </div>

                  {/* INTERACTIVE DETAIL VIEW */}
                  {!selectedGisNode && !selectedGisZone ? (
                    <div className="bg-slate-950/20 border border-slate-900/60 p-4 rounded-xl text-center">
                      <p className="text-xs text-slate-500 italic">
                        Haga clic en un domicilio (marcador) o en una zona de influencia (polígono) sobre el mapa para analizar sus detalles tácticos.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* NODE CARD */}
                      {selectedGisNode && (
                        <div className="bg-slate-950/90 border border-slate-800 p-3.5 rounded-xl space-y-2 animate-fadeIn relative">
                          <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-rose-500/20 text-rose-400 uppercase">Domicilio Detectado</span>
                            <button onClick={() => setSelectedGisNode(null)} className="text-slate-500 hover:text-slate-300">✕</button>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-200 uppercase">{selectedGisNode.alias}</h4>
                            <p className="text-[10px] text-slate-400 font-semibold">{selectedGisNode.gang}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-slate-900/60">
                            <div>
                              <span className="text-slate-500 block text-[8px] uppercase">Confianza</span>
                              <strong className="text-slate-300 font-bold">{(selectedGisNode.confidence * 100).toFixed(0)}%</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[8px] uppercase">Fuente</span>
                              <strong className="text-slate-300 uppercase font-bold">{selectedGisNode.source}</strong>
                            </div>
                          </div>
                          <div className="pt-1">
                            {multiSelectedNodes.some(n => n.member_id === selectedGisNode.member_id) ? (
                              <button
                                type="button"
                                onClick={() => setMultiSelectedNodes(multiSelectedNodes.filter(n => n.member_id !== selectedGisNode.member_id))}
                                className="w-full py-1 rounded bg-purple-950/40 border border-purple-800/30 text-[9px] font-black text-purple-400 uppercase hover:bg-purple-950/60 transition-all"
                              >
                                ✕ Quitar de Comparación
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setMultiSelectedNodes([...multiSelectedNodes, selectedGisNode])}
                                className="w-full py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-slate-950 text-[9px] font-black uppercase transition-all"
                              >
                                ➕ Comparar Domicilio
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ZONE CARD */}
                      {selectedGisZone && (
                        <div className="bg-slate-950/90 border border-slate-800 p-3.5 rounded-xl space-y-2 animate-fadeIn">
                          <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 rounded text-[8px] font-black bg-orange-500/20 text-orange-400 uppercase">Zona de Influencia</span>
                            <button onClick={() => setSelectedGisZone(null)} className="text-slate-500 hover:text-slate-300">✕</button>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-200 uppercase">{selectedGisZone.zone_id}</h4>
                            <p className="text-[10px] text-slate-400 font-semibold">Pandilla: <strong className="text-sky-400">{selectedGisZone.gang}</strong></p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[9px] pt-1.5 border-t border-slate-900/60">
                            <div>
                              <span className="text-slate-500 block text-[8px] uppercase">Score Total</span>
                              <strong className="text-sky-400 text-xs font-black">{selectedGisZone.influence_score}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[8px] uppercase">Intensidad</span>
                              <strong className={`uppercase font-bold ${selectedGisZone.intensity === "alto" ? "text-red-400" : selectedGisZone.intensity === "medio" ? "text-orange-400" : "text-yellow-400"}`}>
                                {selectedGisZone.intensity}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[8px] uppercase">Domicilios</span>
                              <strong className="text-slate-300 font-bold">{selectedGisZone.memberCount} nodos</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[8px] uppercase">Densidad</span>
                              <strong className="text-slate-300 font-bold">{selectedGisZone.density}</strong>
                            </div>
                          </div>
                          <div className="pt-1">
                            {multiSelectedZones.some(z => z.zone_id === selectedGisZone.zone_id) ? (
                              <button
                                type="button"
                                onClick={() => setMultiSelectedZones(multiSelectedZones.filter(z => z.zone_id !== selectedGisZone.zone_id))}
                                className="w-full py-1 rounded bg-purple-950/40 border border-purple-800/30 text-[9px] font-black text-purple-400 uppercase"
                              >
                                ✕ Quitar de Comparación
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setMultiSelectedZones([...multiSelectedZones, selectedGisZone])}
                                className="w-full py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-slate-950 text-[9px] font-black uppercase"
                              >
                                ➕ Comparar Influencia
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MULTI-SELECTION COMPARE LISTS */}
                  {(multiSelectedNodes.length > 0 || multiSelectedZones.length > 0) && (
                    <div className="space-y-2 bg-slate-950/45 p-3 rounded-xl border border-slate-800/80">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-purple-400 uppercase tracking-wider">🔬 Comparador Multitáctico</span>
                        <button
                          onClick={() => {
                            setMultiSelectedNodes([]);
                            setMultiSelectedZones([]);
                          }}
                          className="text-[8px] text-slate-500 hover:text-slate-300 uppercase font-black"
                        >
                          Limpiar
                        </button>
                      </div>

                      {multiSelectedNodes.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[8px] text-slate-500 uppercase font-black">Nodos Domicilio ({multiSelectedNodes.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {multiSelectedNodes.map(n => (
                              <span key={n.member_id} className="inline-flex items-center gap-1 bg-purple-950/50 border border-purple-800/50 px-2 py-0.5 rounded text-[9px] text-purple-300 uppercase font-bold">
                                {n.alias}
                                <button onClick={() => setMultiSelectedNodes(multiSelectedNodes.filter(x => x.member_id !== n.member_id))} className="text-purple-500 hover:text-purple-300 font-bold ml-1">✕</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {multiSelectedZones.length > 0 && (
                        <div className="space-y-1 pt-1.5 border-t border-slate-900/60">
                          <p className="text-[8px] text-slate-500 uppercase font-black">Polígonos de Zona ({multiSelectedZones.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {multiSelectedZones.map(z => (
                              <span key={z.zone_id} className="inline-flex items-center gap-1 bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 rounded text-[9px] text-amber-300 uppercase font-bold">
                                {z.zone_id}
                                <button onClick={() => setMultiSelectedZones(multiSelectedZones.filter(x => x.zone_id !== z.zone_id))} className="text-amber-500 hover:text-amber-300 font-bold ml-1">✕</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CROSS INFLUENCE INTERSECTIONS OVERLAY */}
                  <div className="space-y-2 pt-2 border-t border-slate-850 mt-auto">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">⚡ Análisis de Influencia Cruzada</h4>
                    
                    {crossInfluenceIntersection.totalOverlaps === 0 ? (
                      <p className="text-[10px] text-slate-500 italic bg-slate-950/30 p-2.5 rounded border border-slate-900/60">
                        No se detectan solapamientos de influencia fronteriza entre las zonas analizadas.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {crossInfluenceIntersection.intersections.map((inter, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] space-y-1">
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-red-400 uppercase text-[9px] tracking-wide">Solapamiento Crítico</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                inter.conflictRisk === "Alto" ? "bg-red-500 text-slate-950 animate-pulse" : inter.conflictRisk === "Medio" ? "bg-orange-500 text-slate-950" : "bg-yellow-500 text-slate-950"
                              }`}>
                                {inter.conflictRisk}
                              </span>
                            </div>
                            <p className="text-slate-300 leading-normal">
                              Zona de <strong className="text-sky-400 font-bold">{inter.gangA}</strong> cruza con <strong className="text-rose-400 font-bold">{inter.gangB}</strong>.
                            </p>
                            <p className="text-[9px] text-slate-500 font-mono">
                              Distancia entre focos: {inter.avgDistanceMeters} metros
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* GOOGLE MAP LAYER PANEL (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div>
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">🗺️ Canvas de Geopolítica y Control Territorial</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Delineado con geovalidación obligatoria para Aguascalientes. Prohibido fallbacks automáticos.</p>
                </div>
              </div>

              {!isLoaded ? (
                <div className="w-full h-[450px] rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center text-xs text-slate-500">
                  Cargando cartografía táctica...
                </div>
              ) : (
                <div id="gis-tactical-map" className="relative h-[450px] w-full rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={mapCenter}
                    zoom={13}
                    onLoad={onMapLoad}
                    onClick={handleMapClick}
                    options={{
                      streetViewControl: false,
                      mapTypeControl: false,
                      fullscreenControl: false,
                      styles: darkMapStyles,
                      disableDoubleClickZoom: drawingMode !== null || editingGeometryId !== null
                    }}
                  >
                    {/* DRAWING TEMP POINTS */}
                    {tempShapePoints.map((pt, i) => (
                      <Marker
                        key={`temp-${i}`}
                        position={pt}
                        label={{ text: String(i + 1), color: "#ffffff", fontSize: "9px", fontWeight: "bold" }}
                        icon={{
                          path: 0, // Circle
                          scale: 6,
                          fillColor: "#38bdf8",
                          fillOpacity: 1,
                          strokeColor: "#ffffff",
                          strokeWeight: 1.5,
                        }}
                      />
                    ))}

                    {/* TEMP SHAPE POLYGON PATH */}
                    {drawingMode === "poligono" && tempShapePoints.length >= 3 && (
                      <Polygon
                        paths={tempShapePoints}
                        options={{
                          strokeColor: "#38bdf8",
                          strokeOpacity: 0.8,
                          strokeWeight: 2,
                          fillColor: "#0284c7",
                          fillOpacity: 0.3,
                        }}
                      />
                    )}

                    {/* TEMP SHAPE POLYLINE PATH */}
                    {drawingMode === "corredor" && tempShapePoints.length >= 2 && (
                      <Polyline
                        path={tempShapePoints}
                        options={{
                          strokeColor: "#a855f7",
                          strokeOpacity: 0.8,
                          strokeWeight: 3,
                        }}
                      />
                    )}

                    {/* TEMP SHAPE BUFFER CIRCLE */}
                    {drawingMode === "buffer" && tempShapePoints.length > 0 && (
                      <Circle
                        center={tempShapePoints[0]}
                        radius={tempShapeRadius}
                        options={{
                          strokeColor: "#eab308",
                          strokeOpacity: 0.7,
                          strokeWeight: 1.5,
                          fillColor: "#eab308",
                          fillOpacity: 0.2,
                        }}
                      />
                    )}

                    {/* SAVED GEOMETRIES RENDERING */}
                    {geometrias.map((geo) => {
                      const isEditing = editingGeometryId === geo.id;
                      const color = isEditing ? "#eab308" :
                        geo.nivelControlTerritorial === "Absoluto" ? "#ef4444" :
                        geo.nivelControlTerritorial === "Alto" ? "#f97316" :
                        geo.nivelControlTerritorial === "Medio" ? "#eab308" : "#3b82f6";

                      return (
                        <React.Fragment key={geo.id}>
                          {geo.tipo === "poligono" && (
                            <Polygon
                              paths={geo.puntos}
                              options={{
                                strokeColor: color,
                                strokeOpacity: 0.9,
                                strokeWeight: isEditing ? 3.5 : 2.5,
                                fillColor: color,
                                fillOpacity: isEditing ? 0.35 : 0.25,
                              }}
                            />
                          )}

                          {geo.tipo === "corredor" && (
                            <Polyline
                              path={geo.puntos}
                              options={{
                                strokeColor: color,
                                strokeOpacity: 0.9,
                                strokeWeight: isEditing ? 5 : 4,
                              }}
                            />
                          )}

                          {geo.tipo === "buffer" && (
                            <Circle
                              center={geo.puntos[0]}
                              radius={geo.radio || 300}
                              options={{
                                strokeColor: color,
                                strokeOpacity: 0.8,
                                strokeWeight: isEditing ? 3 : 1.5,
                                fillColor: color,
                                fillOpacity: isEditing ? 0.25 : 0.15,
                              }}
                            />
                          )}

                          {/* INTERACTIVE MARKERS FOR EDITING GEOMETRY VERTICES */}
                          {isEditing && geo.puntos.map((pt, pIdx) => (
                            <Marker
                              key={`edit-vertex-${geo.id}-${pIdx}`}
                              position={pt}
                              draggable={true}
                              onDragEnd={(e) => {
                                if (e.latLng) {
                                  handleVertexDrag(geo.id, pIdx, e.latLng.lat(), e.latLng.lng());
                                }
                              }}
                              onDblClick={() => {
                                handleVertexDelete(geo.id, pIdx);
                              }}
                              label={{
                                text: String(pIdx + 1),
                                color: "#ffffff",
                                fontSize: "9px",
                                fontWeight: "bold"
                              }}
                              icon={{
                                path: 0,
                                scale: 7,
                                fillColor: "#eab308",
                                fillOpacity: 1,
                                strokeColor: "#ffffff",
                                strokeWeight: 1.5,
                              }}
                            />
                          ))}
                        </React.Fragment>
                      );
                    })}

                    {/* REDES DE PROXIMIDAD (CAPA 3) */}
                    {showGisRelations && filteredGisData.relationships.map((rel) => {
                      const isRelatedToSelectedNode = selectedGisNode && (
                        rel.fromMember === selectedGisNode.alias || rel.toMember === selectedGisNode.alias
                      );
                      return (
                        <Polyline
                          key={rel.id}
                          path={rel.path}
                          options={{
                            strokeColor: isRelatedToSelectedNode ? "#a855f7" : "#06b6d4",
                            strokeOpacity: isRelatedToSelectedNode ? 0.9 : 0.4,
                            strokeWeight: isRelatedToSelectedNode ? 2.5 : 1.2,
                          }}
                        />
                      );
                    })}

                    {/* ZONAS DE INFLUENCIA (CAPA 2) */}
                    {showGisZones && filteredGisData.zones.map((zone) => {
                      const isSelected = selectedGisZone && selectedGisZone.zone_id === zone.zone_id;
                      const isMultiSelected = multiSelectedZones.some(z => z.zone_id === zone.zone_id);
                      return (
                        <Polygon
                          key={zone.zone_id}
                          paths={zone.points}
                          onClick={() => {
                            setSelectedGisZone(zone);
                            setSelectedGisNode(null);
                          }}
                          options={{
                            strokeColor: zone.color,
                            strokeOpacity: isSelected || isMultiSelected ? 0.95 : 0.5,
                            strokeWeight: isSelected || isMultiSelected ? 3.5 : 1.5,
                            fillColor: zone.color,
                            fillOpacity: isSelected ? 0.45 : isMultiSelected ? 0.35 : 0.2,
                          }}
                        />
                      );
                    })}

                    {/* DOMICILIOS INDIVIDUALES (CAPA 1) */}
                    {showGisNodes && filteredGisData.nodes.map((node) => {
                      const isSelected = selectedGisNode && selectedGisNode.member_id === node.member_id;
                      const isMultiSelected = multiSelectedNodes.some(n => n.member_id === node.member_id);
                      return (
                        <React.Fragment key={node.member_id}>
                          <Marker
                            position={node.location}
                            onClick={() => {
                              setSelectedGisNode(node);
                              setSelectedGisZone(null);
                            }}
                            title={`${node.alias} (${node.gang})`}
                            icon={{
                              path: 0, // Circle
                              scale: isSelected ? 9 : isMultiSelected ? 8 : 6,
                              fillColor: isSelected ? "#ec4899" : isMultiSelected ? "#a855f7" : "#06b6d4",
                              fillOpacity: 1,
                              strokeColor: "#ffffff",
                              strokeWeight: isSelected || isMultiSelected ? 2 : 1.5,
                            }}
                          />
                          {/* Pulsing/Highlight Halo around selectedGisNode (150-meter radius) */}
                          {isSelected && (
                            <Circle
                              center={node.location}
                              radius={150}
                              options={{
                                strokeColor: "#ec4899",
                                strokeOpacity: 0.8,
                                strokeWeight: 2,
                                fillColor: "#ec4899",
                                fillOpacity: 0.25,
                              }}
                            />
                          )}
                          {isMultiSelected && !isSelected && (
                            <Circle
                              center={node.location}
                              radius={100}
                              options={{
                                strokeColor: "#a855f7",
                                strokeOpacity: 0.7,
                                strokeWeight: 1.5,
                                fillColor: "#a855f7",
                                fillOpacity: 0.15,
                              }}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* INCIDENCIA DELICTIVA PINS */}
                    {showGisIncidents && filteredIncidents.map((inc, idx) => {
                      const crimeMeta = CRIME_TYPES_MAP.find(c => c.id === inc.fuente);
                      const crimeColor = crimeMeta?.color || "#ef4444";
                      return (
                        <Marker
                          key={`crime-incident-${idx}`}
                          position={{ lat: inc.lat, lng: inc.lng }}
                          title={`${inc.tipo || "Delito"} (${inc.fuente})`}
                          icon={{
                            path: 0, // Circle
                            scale: 5,
                            fillColor: crimeColor,
                            fillOpacity: 0.9,
                            strokeColor: "#ffffff",
                            strokeWeight: 1,
                          }}
                        />
                      );
                    })}
                  </GoogleMap>

                  {/* FLOATING LEGEND */}
                  <div className="absolute top-4 right-4 bg-slate-950/95 border border-slate-800 p-2.5 rounded-lg text-[9px] font-mono text-slate-400 space-y-1.5 z-30 shadow-md">
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500" /> Control Absoluto</div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-orange-500" /> Control Alto</div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-yellow-500" /> Control Medio</div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500" /> Control Bajo/Nulo</div>
                  </div>
                </div>
              )}
            </div>

            {/* GIS ANALYSIS REPORT MODAL */}
            {gisAnalysisReport && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                  {/* Modal Header */}
                  <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                    <div>
                      <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                        📋 INFORME DE INTELIGENCIA TÁCTICA GEOINT
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1">Análisis cruzado de proximidad territorial, clicas y conflictos.</p>
                    </div>
                    <button
                      onClick={() => setGisAnalysisReport(null)}
                      className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Modal Tab Switcher */}
                  <div className="flex bg-slate-950 p-1 border-b border-slate-800">
                    <button
                      onClick={() => setActiveModalTab("report")}
                      className={`flex-1 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                        activeModalTab === "report"
                          ? "bg-slate-900 text-sky-400 border-b-2 border-sky-400"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      📄 Informe Narrativo
                    </button>
                    <button
                      onClick={() => setActiveModalTab("json")}
                      className={`flex-1 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                        activeModalTab === "json"
                          ? "bg-slate-900 text-purple-400 border-b-2 border-purple-400"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      ⚙️ Payload JSON Estructurado
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs text-slate-300 leading-relaxed font-semibold">
                    {activeModalTab === "report" ? (
                      <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-850 whitespace-pre-wrap font-sans">
                        {gisAnalysisReport}
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(gisStructuredOutput, null, 2));
                            alert("📋 ¡JSON copiado con éxito!");
                          }}
                          className="absolute right-4 top-4 px-2.5 py-1 bg-purple-950/60 border border-purple-800 text-[10px] font-black text-purple-300 rounded hover:bg-purple-900 transition-colors uppercase"
                        >
                          Copiar JSON
                        </button>
                        <pre className="bg-slate-950/80 p-5 rounded-xl border border-slate-850 font-mono text-[11px] text-purple-300 overflow-x-auto whitespace-pre">
                          {JSON.stringify(gisStructuredOutput, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-2.5">
                    <button
                      onClick={handleExportGisMap}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-extrabold rounded-lg text-xs transition-colors uppercase"
                    >
                      🖨️ Exportar Mapa GEOINT
                    </button>
                    <button
                      onClick={() => {
                        const content = activeModalTab === "report" ? gisAnalysisReport : JSON.stringify(gisStructuredOutput, null, 2);
                        navigator.clipboard.writeText(content || "");
                        alert("📋 ¡Contenido copiado al portapapeles con éxito!");
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold rounded-lg text-xs transition-colors"
                    >
                      Copiar
                    </button>
                    <button
                      onClick={() => setGisAnalysisReport(null)}
                      className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black uppercase rounded-lg text-xs transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: SWEEPS & SPECIALIZED REPORTS */}
        {activeTab === "barridos" && (
          <div className="space-y-6">
            {/* TARGET CAPTURE & EXECUTION HEADER */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">📡 Parametrizar Barrido Geointeligente CEIPOL</h3>
                  <p className="text-[10px] text-slate-400">Seleccione el objeto de rastreo y unifique la búsqueda con Vertex AI.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 px-2 font-extrabold uppercase">Objetivo:</span>
                    {[
                      { id: "all", label: "Toda Pandilla" },
                      { id: "member", label: "Integrante" },
                      { id: "zone", label: "Zona" },
                      { id: "shape", label: "Geometría GIS" }
                    ].map(tar => (
                      <button
                        key={tar.id}
                        type="button"
                        onClick={() => {
                          setBarridoTarget(tar.id as any);
                          setSelectedTargetId("");
                        }}
                        className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${
                          barridoTarget === tar.id
                            ? "bg-sky-500 text-slate-950"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {tar.label}
                      </button>
                    ))}
                  </div>

                  {/* Selective target dropdowns */}
                  {barridoTarget === "member" && (
                    <select
                      value={selectedTargetId}
                      onChange={e => setSelectedTargetId(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-extrabold"
                    >
                      <option value="">Seleccione Integrante...</option>
                      {integrantes.map((m, idx) => (
                        <option key={idx} value={m.alias || m.nombre}>
                          {m.alias || m.nombre} ({m.estatusPandilla})
                        </option>
                      ))}
                    </select>
                  )}

                  {barridoTarget === "shape" && (
                    <select
                      value={selectedTargetId}
                      onChange={e => setSelectedTargetId(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 font-extrabold"
                    >
                      <option value="">Seleccione Capa GIS...</option>
                      {geometrias.map(geo => (
                        <option key={geo.id} value={geo.id}>
                          {geo.nombre} ({geo.tipo})
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={handleExecuteTargetedSweep}
                    disabled={isAnalyzing}
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-sky-400 to-indigo-600 hover:from-sky-300 hover:to-indigo-500 text-slate-950 text-xs font-black uppercase shadow-lg"
                  >
                    📡 Lanzar Barrido
                  </button>
                </div>
              </div>

              {isAnalyzing && (
                <div className="p-8 border border-sky-500/20 bg-slate-950/80 rounded-xl flex flex-col items-center justify-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-sky-500 border-t-transparent" />
                  <p className="text-xs text-sky-400 font-mono tracking-widest uppercase animate-pulse">{analyzeStep}</p>
                </div>
              )}
            </div>

            {/* RESULTS VIEW REPORT & PRODUCTS */}
            {analysisResult && (
              <div className="space-y-6">
                <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1 gap-1 max-w-xl no-print">
                  <button
                    onClick={() => setActiveReport("estructura")}
                    className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all ${
                      activeReport === "estructura" ? "bg-sky-500 text-slate-950" : "text-slate-400"
                    }`}
                  >
                    Reporte 1: Estructura & Vínculos
                  </button>
                  <button
                    onClick={() => setActiveReport("riesgo")}
                    className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all ${
                      activeReport === "riesgo" ? "bg-sky-500 text-slate-950" : "text-slate-400"
                    }`}
                  >
                    Reporte 2: Riesgo Territorial
                  </button>
                  <button
                    onClick={() => setActiveReport("completo")}
                    className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all ${
                      activeReport === "completo" ? "bg-sky-500 text-slate-950" : "text-slate-400"
                    }`}
                  >
                    Reporte 3: Informe Integral de Pandilla
                  </button>
                </div>

                {/* PRODUCT 1: STRUCTURE & LINK NETWORK */}
                {activeReport === "estructura" && (
                  <div id="print-structure-report" className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl relative">
                    <div className="flex justify-between border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">PRODUCTO DE INTELIGENCIA MILITAR CEIPOL</span>
                        <h2 className="text-2xl font-black text-slate-100 uppercase mt-1">Estructura & Red de Vínculos</h2>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 font-mono">ID: {geoReportId || "PRE-EMISION"}</span>
                        <p className="text-[10px] text-slate-500 mt-1">Fecha: {new Date().toLocaleDateString("es-MX")}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">1. Identificación de la Pandilla</h4>
                        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                          <p><strong className="text-slate-500 uppercase">Nombre:</strong> {nombre}</p>
                          {aliasConocidos && <p><strong className="text-slate-500 uppercase">Alias:</strong> {aliasConocidos}</p>}
                          <p><strong className="text-slate-500 uppercase">Estatus:</strong> <span className="text-sky-400 font-bold">{estatus}</span></p>
                          <p><strong className="text-slate-500 uppercase">Peligrosidad global:</strong> <span className="text-red-400 font-bold">{peligrosidad}</span></p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">2. Jerarquía & Organigrama Interno</h4>
                        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs space-y-2.5">
                          {integrantes.filter(m => m.estatusPandilla === "Líder" || m.estatusPandilla === "Segundo al mando").map((m, i) => (
                            <div key={i} className="flex justify-between items-center border-b border-slate-900 pb-1.5 last:border-0 last:pb-0">
                              <div>
                                <span className="font-extrabold text-slate-200">"{m.alias || "N/A"}"</span>
                                <p className="text-[10px] text-slate-500">Nombre: {m.nombre || "No ident."}</p>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 text-[9px] font-black uppercase border border-red-800">
                                {m.estatusPandilla}
                              </span>
                            </div>
                          ))}
                          {integrantes.length === 0 && (
                            <p className="text-xs text-slate-500 italic">Sin integrantes documentados.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">3. Red de Relaciones y Bilateralidad</h4>
                      <table className="w-full text-xs text-left bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500">
                            <th className="p-3">Pandilla Asociada</th>
                            <th className="p-3">Vínculo</th>
                            <th className="p-3">Detalle</th>
                            <th className="p-3">Severidad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900">
                          {relaciones.map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/20 text-slate-300">
                              <td className="p-3 font-extrabold uppercase">{r.pandillaNombre}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  r.tipo === "rival" ? "bg-red-950 text-red-400 border border-red-950" : "bg-emerald-950 text-emerald-400 border border-emerald-950"
                                }`}>
                                  {r.tipo}
                                </span>
                              </td>
                              <td className="p-3">{r.tipoVinculo}</td>
                              <td className="p-3 font-bold">{r.nivelSeveridad}</td>
                            </tr>
                          ))}
                          {relaciones.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-xs text-slate-500 italic">No hay vínculos binarios cargados.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                      <button
                        onClick={handleAttachReportToWorkspace}
                        className="px-4 py-2 rounded-lg border border-sky-500/40 bg-sky-950/30 hover:bg-sky-900/40 text-xs font-bold text-sky-400 uppercase"
                      >
                        📄 Anexar Reporte al Expediente
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100 uppercase"
                      >
                        🖨️ Imprimir
                      </button>
                    </div>
                  </div>
                )}

                {/* PRODUCT 2: TERRITORIAL RISK */}
                {activeReport === "riesgo" && (
                  <div id="print-risk-report" className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl relative">
                    <div className="flex justify-between border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">PRODUCTO DE INTELIGENCIA MILITAR CEIPOL</span>
                        <h2 className="text-2xl font-black text-slate-100 uppercase mt-1">Informe de Riesgo Territorial</h2>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 font-mono">ID: {geoReportId || "PRE-EMISION"}</span>
                        <p className="text-[10px] text-slate-500 mt-1">Fecha: {new Date().toLocaleDateString("es-MX")}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">1. Capas y Zonas de Influencia Georreferenciadas</h4>
                        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                          {geometrias.map(geo => (
                            <div key={geo.id} className="flex justify-between border-b border-slate-900 pb-1.5 last:border-0 last:pb-0">
                              <div>
                                <span className="font-extrabold text-slate-300 uppercase">{geo.nombre}</span>
                                <p className="text-[10px] text-slate-500">Tipo: {geo.tipo} {geo.radio && `(R: ${geo.radio}m)`}</p>
                              </div>
                              <span className="text-sky-400 font-bold uppercase">{geo.nivelControlTerritorial}</span>
                            </div>
                          ))}
                          {geometrias.length === 0 && (
                            <p className="text-xs text-slate-500 italic">Sin capas GIS delineadas.</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">2. Diagnóstico Técnico Táctico</h4>
                        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs leading-relaxed font-medium text-slate-300">
                          {analysisResult.ficha.resumenInteligencia}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">3. Cruzamiento de Actores con Alta Peligrosidad</h4>
                      <table className="w-full text-xs text-left bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500">
                            <th className="p-3">Alias</th>
                            <th className="p-3">Rol</th>
                            <th className="p-3">Riesgo Criminógeno</th>
                            <th className="p-3">Peligrosidad Calculada</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900">
                          {integrantes.map((m, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/20 text-slate-300">
                              <td className="p-3 font-extrabold uppercase">"{m.alias || "N/A"}"</td>
                              <td className="p-3">{m.estatusPandilla}</td>
                              <td className="p-3 font-semibold">{m.riesgoCriminogeno}</td>
                              <td className="p-3 font-black text-sky-400">{m.peligrosidadCalculada}/100</td>
                            </tr>
                          ))}
                          {integrantes.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-xs text-slate-500 italic">No hay integrantes documentados.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">4. Proyección Jurídico Operativa</h4>
                      <div className="bg-red-950/5 border border-red-900/20 p-4 rounded-xl text-xs leading-relaxed font-semibold text-slate-300">
                        {analysisResult.ficha.crossCheckJuridico}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                      <button
                        onClick={handleAttachReportToWorkspace}
                        className="px-4 py-2 rounded-lg border border-sky-500/40 bg-sky-950/30 hover:bg-sky-900/40 text-xs font-bold text-sky-400 uppercase"
                      >
                        📄 Anexar Reporte al Expediente
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100 uppercase"
                      >
                        🖨️ Imprimir
                      </button>
                    </div>
                  </div>
                )}

                {/* PRODUCT 3: COMPLETE INTELLIGENCE REPORT */}
                {activeReport === "completo" && (
                  <div id="print-complete-report" className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 space-y-8 shadow-2xl relative">
                    <style dangerouslySetInnerHTML={{ __html: `
                      @media print {
                        body {
                          background: #ffffff !important;
                          color: #000000 !important;
                        }
                        #print-complete-report {
                          background: #ffffff !important;
                          color: #000000 !important;
                          border: none !important;
                          box-shadow: none !important;
                          padding: 0 !important;
                          width: 100% !important;
                        }
                        .no-print {
                          display: none !important;
                        }
                        h1, h2, h3, h4, h5, h6, p, td, th, span, div, strong, label {
                          color: #000000 !important;
                        }
                        .border, .border-b, .border-t, .border-slate-800, .border-slate-900 {
                          border-color: #d1d5db !important;
                        }
                        .bg-slate-950, .bg-slate-950/60, .bg-slate-900/40, .bg-slate-900, .bg-slate-950/40, .bg-slate-900/50, .bg-slate-900/80 {
                          background-color: #f3f4f6 !important;
                          background: #f3f4f6 !important;
                        }
                        .bg-red-950, .bg-sky-950, .bg-sky-950/60, .bg-emerald-950 {
                          background-color: #e5e7eb !important;
                          border-color: #9ca3af !important;
                        }
                        .text-sky-400, .text-red-400, .text-emerald-400 {
                          color: #000000 !important;
                          font-weight: bold !important;
                        }
                        /* Page breaks */
                        .page-break {
                          page-break-before: always;
                        }
                      }
                    `}} />

                    {/* Institutional Header */}
                    <div className="flex justify-between border-b-2 border-sky-500/40 pb-6">
                      <div>
                        <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest block font-mono">
                          ESTADO DE AGUASCALIENTES • SECRETARÍA DE SEGURIDAD PÚBLICA
                        </span>
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest block font-mono">
                          SECRETÓ / CLASIFICADO • EXCLUSIVO PARA USO OPERATIVO
                        </span>
                        <h2 className="text-3xl font-black text-slate-100 uppercase mt-2 tracking-tight">
                          INFORME TÁCTICO INTEGRAL DE INTELIGENCIA
                        </h2>
                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase">
                          SISTEMA DE PERFILAMIENTO REMOTO Y GEOINTELIGENCIA CRITICA (CEIPOL)
                        </p>
                      </div>
                      <div className="text-right flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-black text-slate-400 font-mono bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
                            ID: {geoReportId || "PRE-EMISION"}
                          </span>
                        </div>
                        <div className="mt-4">
                          <p className="text-[10px] text-slate-400 font-bold font-mono">EMISIÓN: {new Date().toLocaleDateString("es-MX")} {new Date().toLocaleTimeString("es-MX")}</p>
                          <p className="text-[9px] text-slate-500 font-mono">PERFILADOR DE PANDILLAS V2.1</p>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 1: RESUMEN GENERAL */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <span className="text-sky-400 text-lg">📊</span>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                          1. RESUMEN EJECUTIVO Y DATOS DE LA ESTRUCTURA
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 bg-slate-950/60 p-5 rounded-2xl border border-slate-850 space-y-3.5 text-xs">
                          <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-wider border-b border-slate-900 pb-1.5">
                            Identificación de la Organización
                          </h4>
                          <p className="flex justify-between">
                            <strong className="text-slate-500 uppercase font-bold">Nombre:</strong> 
                            <span className="text-slate-200 font-black uppercase">{nombre}</span>
                          </p>
                          <p className="flex justify-between">
                            <strong className="text-slate-500 uppercase font-bold">Alias Conocidos:</strong> 
                            <span className="text-slate-300 font-bold">{aliasConocidos || "N/A"}</span>
                          </p>
                          <p className="flex justify-between">
                            <strong className="text-slate-500 uppercase font-bold">Estatus:</strong> 
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950/40 text-emerald-400 border border-emerald-900/40">
                              {estatus}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <strong className="text-slate-500 uppercase font-bold">Peligrosidad:</strong> 
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              peligrosidad === "Crítico" ? "bg-red-950 text-red-400 border border-red-900" :
                              peligrosidad === "Alto" ? "bg-orange-950 text-orange-400 border border-orange-900" :
                              "bg-slate-900 text-slate-300 border border-slate-800"
                            }`}>
                              {peligrosidad || "Media"}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <strong className="text-slate-500 uppercase font-bold">Zona de Influencia:</strong> 
                            <span className="text-slate-300 font-semibold">{zonaInfluencia || "No registrada"}</span>
                          </p>
                          <div className="space-y-1 mt-2">
                            <strong className="text-slate-500 uppercase font-bold text-[10px] block">Áreas Geográficas:</strong>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {municipiosAsociados && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 text-[9px] font-mono border border-slate-800 uppercase">
                                  Mun: {municipiosAsociados}
                                </span>
                              )}
                              {coloniasAsociadas && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 text-[9px] font-mono border border-slate-800 uppercase">
                                  Col: {coloniasAsociadas}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="lg:col-span-2 space-y-4">
                          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-850 space-y-3">
                            <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-wider border-b border-slate-900 pb-1.5">
                              Diagnóstico Táctico CEIPOL (Motor OSINT/Geointeligencia)
                            </h4>
                            <div className="text-xs leading-relaxed font-medium text-slate-300 space-y-2">
                              <p className="whitespace-pre-line">{analysisResult.ficha.resumenInteligencia}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: INTEGRANTES & DOSSIER */}
                    <div className="space-y-4 page-break">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <span className="text-sky-400 text-lg">💀</span>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                          2. DOSSIER OPERATIVO DE INTEGRANTES Y JERARQUÍA ("CALIDAD")
                        </h3>
                      </div>

                      {integrantes.length === 0 ? (
                        <div className="bg-slate-950/40 p-6 rounded-2xl text-center text-xs text-slate-500 italic border border-slate-850">
                          No hay integrantes documentados en la base de datos de esta estructura.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {integrantes.map((m, idx) => (
                            <div key={idx} className="bg-slate-950/60 rounded-2xl border border-slate-850 p-4 flex flex-col justify-between space-y-4 shadow-lg hover:border-slate-700 transition-all">
                              <div className="flex gap-4">
                                {/* Photo Box */}
                                <div className="w-24 h-24 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0 relative shadow-inner">
                                  {m.fotografiaUrl ? (
                                    <img src={m.fotografiaUrl} className="w-full h-full object-cover" alt={m.alias || m.nombre} />
                                  ) : (
                                    <span className="text-4xl">{m.sexo === "Femenino" ? "👩" : "👨"}</span>
                                  )}
                                  <div className="absolute bottom-0 inset-x-0 text-center bg-slate-950/95 py-0.5 border-t border-slate-900">
                                    <span className="text-[9px] font-black text-sky-400 tracking-wider">
                                      PELIGRO: {m.peligrosidadCalculada || 0}%
                                    </span>
                                  </div>
                                </div>

                                {/* Main details */}
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex justify-between items-start gap-1">
                                    <h4 className="text-sm font-black text-slate-100 truncate uppercase">
                                      {m.alias ? `"${m.alias}"` : "Sin alias"}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 text-[8px] font-black uppercase border border-red-900">
                                      {m.estatusPandilla || "Integrante"}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 font-semibold truncate uppercase">
                                    {m.nombre || "No identificado"}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold">
                                    <span className="text-slate-500 font-bold">EDAD:</span> {m.edad ? `${m.edad} años` : "No reg."} | <span className="text-slate-500 font-bold">SEXO:</span> {m.sexo || "No reg."}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    <span className="text-slate-500 font-bold uppercase">CURP:</span> <span className="font-mono text-[9px] font-bold text-slate-300">{m.curp || "N/A"}</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    <span className="text-slate-500 font-bold uppercase">DOMICILIO:</span> <span className="text-slate-300 font-bold">{m.domicilioConocido || "No reg."}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Technical features & traits grid */}
                              <div className="grid grid-cols-2 gap-3 border-t border-slate-900 pt-3 text-[10px]">
                                <div className="space-y-1 bg-slate-900/40 p-2 rounded-lg border border-slate-900/60">
                                  <p className="font-black text-[9px] text-sky-400 uppercase tracking-wider">Perfil Criminológico</p>
                                  <p><span className="text-slate-500 font-bold">Riesgo:</span> <strong className="text-red-400">{m.riesgoCriminogeno || "No calif."}</strong></p>
                                  <p><span className="text-slate-500 font-bold">Violencia:</span> <strong className="text-slate-300">{m.nivelViolencia || "No calif."}</strong></p>
                                  <p className="truncate"><span className="text-slate-500 font-bold">Droga consumo:</span> <strong className="text-slate-300">{m.consumoDrogas || "N/A"}</strong></p>
                                </div>
                                <div className="space-y-1 bg-slate-900/40 p-2 rounded-lg border border-slate-900/60">
                                  <p className="font-black text-[9px] text-sky-400 uppercase tracking-wider">Señas Particulares</p>
                                  <p className="truncate"><span className="text-slate-500 font-bold">Tatuajes:</span> <span className="text-slate-300 font-semibold">{m.tatuajes || "N/A"}</span></p>
                                  <p className="truncate"><span className="text-slate-500 font-bold">Marcas/Cicatriz:</span> <span className="text-slate-300 font-semibold">{m.marcasDistintivas || m.cicatrices || "N/A"}</span></p>
                                  <p className="truncate"><span className="text-slate-500 font-bold">Complexión:</span> <span className="text-slate-300 font-semibold">{m.complexion || "N/A"} ({m.estatura || "N/A"})</span></p>
                                </div>
                              </div>

                              {/* Antecedentes and detention history block */}
                              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-900 text-[10px] space-y-1 leading-relaxed">
                                <p className="font-black text-[9px] text-red-400 uppercase tracking-wider">Antecedentes Penales y Detenciones</p>
                                <p className="text-slate-300 font-semibold italic">
                                  {m.detencionesPrevias || m.antecedentes || m.ingresosCentrosInternamiento || "No registra detenciones o antecedentes cargados en base de datos local."}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SECTION 3: GEOINTELIGENCIA & TERRITORIO */}
                    <div className="space-y-4 page-break">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <span className="text-sky-400 text-lg">🗺️</span>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                          3. GEOMATRIZ DE CONTROL TERRITORIAL Y CAPAS GIS
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                            Delimitaciones GIS Georreferenciadas
                          </h4>
                          <div className="bg-slate-950/60 rounded-2xl border border-slate-850 p-4 space-y-3.5 text-xs">
                            {geometrias.map((geo, gIdx) => (
                              <div key={geo.id} className="border-b border-slate-900 pb-3 last:border-0 last:pb-0">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-extrabold text-slate-200 uppercase text-xs">{gIdx + 1}. {geo.nombre}</span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                    geo.nivelControlTerritorial === "Absoluto" || geo.nivelControlTerritorial === "Alto" ? "bg-red-950 text-red-400" : "bg-sky-950 text-sky-400"
                                  }`}>
                                    Control {geo.nivelControlTerritorial}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  <span className="text-slate-500 font-bold uppercase">Tipo Capa:</span> {geo.tipo.toUpperCase()} {geo.radio && ` | Radio: ${geo.radio}m`}
                                </p>
                                <p className="text-[9px] text-slate-500 font-mono mt-1 break-all">
                                  <span className="text-slate-600 font-bold">PUNTOS COORDENADAS:</span> {geo.puntos.map(p => `[${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}]`).join(", ")}
                                </p>
                              </div>
                            ))}
                            {geometrias.length === 0 && (
                              <p className="text-xs text-slate-500 italic text-center py-4">No se han registrado polígonos o capas geográficas.</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                            Análisis Crítico de Expansión
                          </h4>
                          <div className="bg-slate-950/60 rounded-2xl border border-slate-850 p-4 text-xs leading-relaxed font-semibold text-slate-300">
                            <p className="whitespace-pre-line">{analysisResult.ficha.crossCheckJuridico}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: GALERIA DE GRAFITIS */}
                    <div className="space-y-4 page-break">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <span className="text-sky-400 text-lg">🎨</span>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                          4. GALERÍA DE GRAFITIS IDENTITARIOS Y MENSAJES OPERATIVOS
                        </h3>
                      </div>

                      {imagenesGrafiti.length === 0 ? (
                        <div className="bg-slate-950/40 p-6 rounded-2xl text-center text-xs text-slate-500 italic border border-slate-850">
                          No se han cargado evidencias visuales de marcas, grafitis identitarios o mensajes de advertencia para esta pandilla.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {imagenesGrafiti.map((img) => (
                            <div key={img.id} className="bg-slate-950/60 rounded-2xl border border-slate-850 p-3 flex flex-col justify-between space-y-2 shadow-md">
                              <div className="relative w-full h-32 rounded-xl bg-slate-900 border border-slate-900 overflow-hidden shadow-inner">
                                <img src={img.url} className="w-full h-full object-cover" alt="Grafiti" />
                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-black uppercase bg-slate-950/95 text-sky-400 border border-slate-800 shadow">
                                  {img.tipo || "Identidad"}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] font-bold text-slate-200 uppercase truncate">
                                  {img.descripcion || "Sin descripción"}
                                </p>
                                <p className="text-[9px] text-slate-500 font-mono text-right">
                                  Capturado: {img.fechaRegistro || "N/A"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SECTION 5: RELACIONES & VINCULOS */}
                    <div className="space-y-4 page-break">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <span className="text-sky-400 text-lg">🔗</span>
                        <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                          5. RED DE VÍNCULOS Y RELACIONES BILATERALES
                        </h3>
                      </div>

                      <table className="w-full text-xs text-left bg-slate-950/60 rounded-2xl border border-slate-850 overflow-hidden shadow">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/50">
                            <th className="p-3.5">Organización Antagónica / Asociada</th>
                            <th className="p-3.5">Bilateralidad</th>
                            <th className="p-3.5">Tipo de Vínculo Táctico</th>
                            <th className="p-3.5 text-center">Nivel Severidad / Riesgo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900">
                          {relaciones.map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/10 text-slate-300">
                              <td className="p-3.5 font-black uppercase tracking-wide">{r.pandillaNombre}</td>
                              <td className="p-3.5">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  r.tipo === "rival" ? "bg-red-950 text-red-400 border border-red-950/40" : "bg-emerald-950 text-emerald-400 border border-emerald-950/40"
                                }`}>
                                  {r.tipo.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-3.5 font-medium">{r.tipoVinculo}</td>
                              <td className="p-3.5 text-center font-black">
                                <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${
                                  r.nivelSeveridad === "Crítico" ? "bg-red-950 text-red-400" :
                                  r.nivelSeveridad === "Alto" ? "bg-orange-950 text-orange-400" :
                                  "bg-slate-900 text-slate-400"
                                }`}>
                                  {r.nivelSeveridad || "Medio"}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {relaciones.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-5 text-center text-xs text-slate-500 italic">No se han registrado relaciones bilaterales con otras estructuras.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* CEIPOL Validation Block */}
                    <div className="border-t border-slate-800 pt-8 mt-12 grid grid-cols-2 gap-12 text-center text-[10px] uppercase font-bold text-slate-400 page-break">
                      <div className="space-y-12">
                        <p>PERFILADO Y CAPTURADO POR:</p>
                        <div className="border-t border-slate-800 pt-2 w-2/3 mx-auto">
                          <p className="text-slate-300 font-extrabold font-mono">FIRMA DE AGENTE ANALISTA</p>
                          <p className="text-[9px] text-slate-500 font-medium">CEIPOL • SSP AGUASCALIENTES</p>
                        </div>
                      </div>
                      <div className="space-y-12">
                        <p>SISTEMA DE SEGURIDAD PÚBLICA:</p>
                        <div className="border-t border-slate-800 pt-2 w-2/3 mx-auto">
                          <p className="text-slate-300 font-extrabold font-mono">SELLO DE VALIDACIÓN TÁCTICA</p>
                          <p className="text-[9px] text-slate-500 font-medium">CENTRO DE INTELIGENCIA OPERATIVA</p>
                        </div>
                      </div>
                    </div>

                    {/* Report action buttons */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-800 no-print">
                      <button
                        onClick={handleAttachReportToWorkspace}
                        className="px-5 py-2.5 rounded-xl border border-sky-500/40 bg-sky-950/30 hover:bg-sky-900/40 text-xs font-black text-sky-400 uppercase tracking-wider shadow-lg transition-colors"
                      >
                        📄 Anexar Reporte Integral al Expediente
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-xs font-black text-slate-100 uppercase tracking-wider shadow-lg transition-all"
                      >
                        🖨️ Imprimir Reporte
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
