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
import { GoogleMap, Polygon, Polyline, Marker, Circle, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
import { GangGISAnalysisLayer, GISRelationshipLine } from "@/lib/providers/gangGISAnalysisLayer";
import { GISMemberNode, InfluenceZone } from "@/lib/providers/gangInfluenceEngine";
import { getDb } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

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

const ICON_PATHS = {
  star: "M 0,-8 L 2.4,-2.4 L 8,-2.4 L 3.4,1 L 5.2,6.4 L 0,3 L -5.2,6.4 L -3.4,1 L -8,-2.4 L -2.4,-2.4 Z",
  crosshair: "M -6,0 L -2,0 M 2,0 L 6,0 M 0,-6 L 0,-2 M 0,2 L 0,6 M -4,0 A 4,4 0 1,0 4,0 A 4,4 0 1,0 -4,0",
  eye: "M -8,0 C -5,5 5,5 8,0 C 5,-5 -5,-5 -8,0 Z M -2,0 A 2,2 0 1,0 2,0 A 2,2 0 1,0 -2,0",
  dot: "M 0,0 A 4,4 0 1,0 0,-0.01 Z"
};

const getGangColor = (gangName: string): string => {
  const colors = ["#06b6d4", "#f59e0b", "#a855f7", "#ec4899", "#10b981", "#ef4444", "#3b82f6", "#f43f5e", "#14b8a6", "#84cc16"];
  let hash = 0;
  for (let i = 0; i < gangName.length; i++) {
    hash = gangName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getMarkerIcon = (rol: string | undefined, gangColor: string) => {
  const r = (rol || "").toLowerCase();
  let path = ICON_PATHS.dot;
  let scale = 1.5;
  if (r.includes("lider") || r.includes("segundo")) {
    path = ICON_PATHS.star;
    scale = 1.8;
  } else if (r.includes("sicario")) {
    path = ICON_PATHS.crosshair;
    scale = 2.0;
  } else if (r.includes("halcon") || r.includes("vigilante")) {
    path = ICON_PATHS.eye;
    scale = 1.8;
  }
  
  return {
    path,
    scale,
    fillColor: gangColor,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
  };
};

const parseCoordinates = (str: string | undefined): { lat: number; lng: number } | null => {
  if (!str) return null;
  const match = str.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  return null;
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
  const [geointSubTab, setGeointSubTab] = useState<"mapa" | "album">("mapa");
  const [albumGangId, setAlbumGangId] = useState<string>("");
  const [gisSidebarTab, setGisSidebarTab] = useState<"drawing" | "analysis">("analysis");
  const [activeGisLayers, setActiveGisLayers] = useState<Record<string, boolean>>({
    domiciles: true,
    influence: true,
    corridors: true,
    graffiti: true,
    history: true,
  });
  const showGisNodes = activeGisLayers.domiciles;
  const showGisZones = activeGisLayers.influence;
  const [selectedGangsForGis, setSelectedGangsForGis] = useState<string[]>([]);
  const [editingGeometryId, setEditingGeometryId] = useState<string | null>(null);
  const [gisStructuredOutput, setGisStructuredOutput] = useState<any | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"report" | "json">("report");

  const [selectedGisNode, setSelectedGisNode] = useState<GISMemberNode | null>(null);
  const [selectedGisZone, setSelectedGisZone] = useState<InfluenceZone | null>(null);
  const [multiSelectedNodes, setMultiSelectedNodes] = useState<GISMemberNode[]>([]);
  const [multiSelectedZones, setMultiSelectedZones] = useState<InfluenceZone[]>([]);
  const [isGisAnalyzing, setIsGisAnalyzing] = useState(false);
  const [gisAnalysisReport, setGisAnalysisReport] = useState<string | null>(null);

  const [hoveredGisElement, setHoveredGisElement] = useState<any | null>(null);
  const [selectedGisElement, setSelectedGisElement] = useState<any | null>(null);
  const [projectPhotos, setProjectPhotos] = useState<any[]>([]);

  // Load project photos
  useEffect(() => {
    if (projectId) {
      const fetchProjectPhotos = async () => {
        try {
          const firestore = getDb();
          const photosColRef = collection(firestore, "projects", projectId, "photos");
          const photosSnap = await getDocs(photosColRef);
          const photos = photosSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((p: any) => !p.deleted && p.lat != null && p.lng != null);
          setProjectPhotos(photos);
        } catch (e) {
          console.error("Error loading project photos for GIS:", e);
        }
      };
      void fetchProjectPhotos();
    }
  }, [projectId]);

  // Synchronize albumGangId with active selectedGangId or default to first gang
  useEffect(() => {
    if (selectedGangId) {
      setAlbumGangId(selectedGangId);
    } else if (storedGangs.length > 0 && !albumGangId) {
      setAlbumGangId(storedGangs[0].id || "");
    }
  }, [selectedGangId, storedGangs, albumGangId]);

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
      relationships: []
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

  // 1. Mobility Corridors (from database shape.tipo === "corredor")
  const realCorridors = useMemo(() => {
    const list: any[] = [];
    const activeGangs = storedGangs.filter(g => selectedGangsForGis.includes(g.nombre));
    activeGangs.forEach(gang => {
      const gangColor = getGangColor(gang.nombre);
      (gang.geometrias || []).forEach(shape => {
        if (shape.tipo === "corredor") {
          list.push({
            id: shape.id,
            gang: gang.nombre,
            path: shape.puntos,
            color: gangColor,
            nombre: shape.nombre,
            nivel: shape.nivelControlTerritorial
          });
        }
      });
    });
    return list;
  }, [storedGangs, selectedGangsForGis]);

  // 2. Graffiti (from timeline categoria === "grafiti" and georeferenced project photos)
  const realGraffiti = useMemo(() => {
    const list: any[] = [];
    const activeGangs = storedGangs.filter(g => selectedGangsForGis.includes(g.nombre));
    activeGangs.forEach(gang => {
      const gangColor = getGangColor(gang.nombre);
      (gang.cronologiaEventos || []).forEach(evt => {
        const isGrafiti = evt.categoria === "grafiti" || evt.titulo.toLowerCase().includes("grafiti") || evt.descripcion.toLowerCase().includes("grafiti");
        if (isGrafiti) {
          const coords = parseCoordinates(evt.lugar);
          if (coords) {
            list.push({
              id: evt.id,
              gang: gang.nombre,
              color: gangColor,
              location: coords,
              text: evt.titulo,
              description: evt.descripcion,
              date: evt.fecha,
              source: "Historial de Eventos"
            });
          }
        }
      });
    });

    projectPhotos.forEach(p => {
      list.push({
        id: p.id,
        gang: "Proyecto / Evidencia",
        color: "#f97316",
        location: { lat: p.lat, lng: p.lng },
        text: p.tipo || "Foto de Campo",
        description: p.comentario || "Foto de evidencia georreferenciada.",
        date: p.createdAt ? new Date(p.createdAt).toLocaleDateString("es-MX") : "",
        imageUrl: p.previewUrl || p.url,
        source: "Fotos de Proyecto"
      });
    });

    return list;
  }, [storedGangs, selectedGangsForGis, projectPhotos]);

  // 3. Historical Events (from timeline parsed events)
  const realHistory = useMemo(() => {
    const list: any[] = [];
    const activeGangs = storedGangs.filter(g => selectedGangsForGis.includes(g.nombre));
    activeGangs.forEach(gang => {
      const gangColor = getGangColor(gang.nombre);
      (gang.cronologiaEventos || []).forEach(evt => {
        const isGrafiti = evt.categoria === "grafiti" || evt.titulo.toLowerCase().includes("grafiti") || evt.descripcion.toLowerCase().includes("grafiti");
        if (!isGrafiti) {
          const coords = parseCoordinates(evt.lugar);
          if (coords) {
            list.push({
              id: evt.id,
              gang: gang.nombre,
              color: gangColor,
              location: coords,
              text: evt.titulo,
              description: evt.descripcion,
              date: evt.fecha,
              categoria: evt.categoria,
              gravedad: evt.gravedad
            });
          }
        }
      });
    });
    return list;
  }, [storedGangs, selectedGangsForGis]);

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

  const handleGenerateMap = async (format: "pdf" | "png") => {
    const mapEl = document.getElementById("gis-tactical-map");
    if (!mapEl) {
      alert("No se encontró el contenedor del mapa para exportar.");
      return;
    }
    setIsGisAnalyzing(true);
    try {
      const html2canvasLib = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      // Capture map canvas
      const mapCanvas = await html2canvasLib(mapEl, { useCORS: true, scale: 2 });
      const mapDataUrl = mapCanvas.toDataURL("image/png");

      // Create dynamic hidden print wrapper
      const reportContainer = document.createElement("div");
      reportContainer.style.position = "absolute";
      reportContainer.style.left = "-9999px";
      reportContainer.style.top = "-9999px";
      reportContainer.style.width = "800px";
      reportContainer.style.padding = "40px";
      reportContainer.style.backgroundColor = "#ffffff";
      reportContainer.style.color = "#1e293b";
      reportContainer.style.fontFamily = "Arial, sans-serif";
      reportContainer.style.lineHeight = "1.5";

      const nowStr = new Date().toLocaleString("es-MX");
      const activeLayersStr = Object.entries(activeGisLayers)
        .filter(([_, active]) => active)
        .map(([key, _]) => {
          const map: Record<string, string> = {
            domiciles: "Domicilios de Integrantes",
            influence: "Zonas de Influencia",
            corridors: "Corredores de Movilidad",
            graffiti: "Grafitis Registrados",
            history: "Eventos Históricos"
          };
          return map[key] || key;
        })
        .join(", ") || "Ninguna";

      const selectedGangsStr = selectedGangsForGis.join(", ") || "Ninguna";

      // Build legend items
      let legendItemsHtml = "";
      const legendMap: Record<string, { color: string, label: string }> = {
        domiciles: { color: "#06b6d4", label: "Domicilios de Integrantes" },
        influence: { color: "#eab308", label: "Zonas de Influencia" },
        corridors: { color: "#a855f7", label: "Corredores de Movilidad" },
        graffiti: { color: "#f97316", label: "Grafitis Registrados" },
        history: { color: "#ef4444", label: "Eventos Históricos" }
      };

      Object.entries(activeGisLayers).forEach(([key, active]) => {
        if (active && legendMap[key]) {
          legendItemsHtml += `
            <div style="display: flex; align-items: center; gap: 8px; margin-right: 20px; margin-bottom: 8px; font-size: 11px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: ${legendMap[key].color}; border: 1px solid #cbd5e1;"></span>
              <span>${legendMap[key].label}</span>
            </div>
          `;
        }
      });

      reportContainer.innerHTML = `
        <div style="border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; font-size: 22px; color: #0f172a; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Centro de Estudios y Política Criminal</h1>
            <p style="margin: 3px 0 0 0; color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Dirección de Inteligencia y GEOINT</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 10px; font-weight: bold; color: #ef4444; border: 1px solid #fecaca; background-color: #fef2f2; padding: 4px 8px; border-radius: 4px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px;">Reservado - Confidencial</p>
          </div>
        </div>

        <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 25px; font-size: 11px;">
          <div><strong>Pandillas Analizadas:</strong> ${selectedGangsStr}</div>
          <div><strong>Fecha y Hora de Emisión:</strong> ${nowStr}</div>
          <div style="grid-column: span 2;"><strong>Capas GIS Utilizadas:</strong> ${activeLayersStr}</div>
        </div>

        <h3 style="font-size: 14px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 0; margin-bottom: 15px; text-transform: uppercase; font-weight: 800;">1. Mapa de Situación Geopolítica</h3>
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 20px; text-align: center; background-color: #0f172a; height: 350px;">
          <img src="${mapDataUrl}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>

        <h3 style="font-size: 14px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 25px; margin-bottom: 10px; text-transform: uppercase; font-weight: 800;">Leyenda de Capas Tácticas</h3>
        <div style="display: flex; flex-wrap: wrap; margin-bottom: 25px; background-color: #f8fafc; padding: 10px 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
          ${legendItemsHtml || '<span style="font-size: 11px; color: #94a3b8; font-style: italic;">Ninguna capa activa seleccionada.</span>'}
        </div>

        <h3 style="font-size: 14px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 25px; margin-bottom: 15px; text-transform: uppercase; font-weight: 800;">2. Interpretación de Inteligencia GEOINT</h3>
        <div style="font-size: 12px; color: #334155; white-space: pre-wrap; font-weight: 500; text-align: justify; font-family: sans-serif;">
          ${gisAnalysisReport || "No se ha generado interpretación narrativa."}
        </div>

        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 9px; color: #94a3b8;">
          Este reporte es un producto de análisis de geointeligencia del Módulo de Pandillas (CEIPOL). Su contenido es de carácter confidencial y para fines tácticos policiales.
        </div>
      `;

      document.body.appendChild(reportContainer);
      const reportCanvas = await html2canvasLib(reportContainer, { useCORS: true, scale: 2 });

      if (format === "png") {
        const url = reportCanvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `Reporte_GEOINT_${selectedGangsForGis.join("_") || "Pandillas"}.png`;
        a.click();
      } else {
        const pdfWidth = 210;
        const pageHeight = 297;
        const imgWidth = pdfWidth;
        const imgHeight = (reportCanvas.height * pdfWidth) / reportCanvas.width;

        const doc = new jsPDF("p", "mm", "a4");
        let heightLeft = imgHeight;
        let position = 0;
        const imgData = reportCanvas.toDataURL("image/png");

        doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          doc.addPage();
          doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        doc.save(`Reporte_GEOINT_${selectedGangsForGis.join("_") || "Pandillas"}.pdf`);
      }

      document.body.removeChild(reportContainer);
    } catch (err: any) {
      console.error("Error generating printable report:", err);
      alert("Error al generar el reporte: " + err.message);
    } finally {
      setIsGisAnalyzing(false);
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
      fotografiaUrl: tempMember.fotografiaUrl || (tempMember.sexo === "Femenino" ? "/avatars/avatar_fem.png" : "/avatars/avatar_male.png"),
      georreferencia: tempMember.georreferencia
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
      tatuajes: "", complexion: "", estatura: "", vestimentaUsual: "", telefonoRedes: "", vehiculosAsociados: "", fotografiaUrl: "",
      georreferencia: undefined
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
        activeGisLayers.domiciles && "domiciles",
        activeGisLayers.influence && "influence_zones",
        activeGisLayers.corridors && "corridors",
        activeGisLayers.graffiti && "graffiti",
        activeGisLayers.history && "history"
      ].filter(Boolean) as string[];

      const payload = {
        selectedGangs: selectedGangsForGis,
        activeLayers,
        domiciles: filteredGisData.nodes,
        influenceZones: filteredGisData.zones,
        manualDrawings: geometrias.map(geo => ({
          geometry_type: geo.tipo === "zona_riesgo" ? "buffer" : (geo.tipo === "poligono" ? "polygon" : geo.tipo),
          coordinates: geo.puntos,
          radio: geo.radio,
          risk_level: geo.riskLevel || "medium",
          label: geo.nombre,
          timestamp: geo.fechaActualizacion || new Date().toISOString()
        })),
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

                 <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-6 space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Domicilio Conocido</label>
                    <input
                      type="text"
                      placeholder="Calle, No, Colonia, Municipio"
                      value={tempMember.domicilioConocido}
                      onChange={e => setTempMember({ ...tempMember, domicilioConocido: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Latitud (Opcional)</label>
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="Ej. 21.8853"
                      value={tempMember.georreferencia?.lat ?? ""}
                      onChange={e => setTempMember({
                        ...tempMember,
                        georreferencia: {
                          lat: parseFloat(e.target.value) || 0,
                          lng: tempMember.georreferencia?.lng ?? -102.2916,
                          confidence: 1.0,
                          status: "investigation"
                        }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Longitud (Opcional)</label>
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="Ej. -102.2916"
                      value={tempMember.georreferencia?.lng ?? ""}
                      onChange={e => setTempMember({
                        ...tempMember,
                        georreferencia: {
                          lat: tempMember.georreferencia?.lat ?? 21.8853,
                          lng: parseFloat(e.target.value) || 0,
                          confidence: 1.0,
                          status: "investigation"
                        }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>
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
                          strokeWidth="1.5"
                        />
                        <text
                          y="22"
                          textAnchor="middle"
                          fill="#cbd5e1"
                          fontSize="9"
                          className="uppercase font-semibold"
                        >
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
          <div className="w-full space-y-6">
            
            {/* Sub-tab selection: Mapa Táctico vs Álbum de Pandilla */}
            <div className="flex border-b border-slate-800 pb-2 gap-4">
              <button
                type="button"
                onClick={() => setGeointSubTab("mapa")}
                className={`pb-2 px-1 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                  geointSubTab === "mapa"
                    ? "border-sky-500 text-sky-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                🗺️ Mapa Táctico GIS
              </button>
              <button
                type="button"
                onClick={() => setGeointSubTab("album")}
                className={`pb-2 px-1 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                  geointSubTab === "album"
                    ? "border-sky-500 text-sky-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                📁 Álbum de Pandilla
              </button>
            </div>

            {geointSubTab === "mapa" && (
              <>
                {/* 1. MAPA GIS PANDILLAS (Elemento central absoluto, 100% ancho, h-[70vh]) */}
                <div className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="border-b border-slate-900 pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider">🗺️ Mapa Táctico GEOINT de Pandillas</h3>
                      <p className="text-[10px] text-slate-500">Visualización de capas espaciales activas en tiempo real.</p>
                    </div>
                  </div>
                  
                  {!isLoaded ? (
                    <div className="w-full h-[70vh] rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center text-xs text-slate-500">
                      Cargando cartografía táctica...
                    </div>
                  ) : (
                    <div id="gis-tactical-map" className="relative h-[70vh] w-full rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
                      <GoogleMap
                        mapContainerStyle={{ width: "100%", height: "100%" }}
                        center={mapCenter}
                        zoom={13}
                        onLoad={onMapLoad}
                        options={{
                          streetViewControl: false,
                          mapTypeControl: false,
                          fullscreenControl: false,
                          styles: darkMapStyles,
                          disableDefaultUI: false
                        }}
                      >
                        {/* 1. Domicilios de integrantes */}
                        {showGisNodes && filteredGisData.nodes.map((node) => {
                          const gangColor = getGangColor(node.gang);
                          return (
                            <Marker
                              key={node.member_id}
                              position={node.location}
                              title={`${node.alias || "Integrante"} (${node.gang})`}
                              onClick={() => {
                                setSelectedGisNode(node);
                                setSelectedGisElement({
                                  tipo: "Domicilio de Integrante",
                                  titulo: node.alias || "Integrante",
                                  subtitulo: node.gang,
                                  rol: node.rol || "Integrante",
                                  detalle: node.domicilioExacto || "Sin dirección exacta registrada.",
                                  gang: node.gang,
                                  color: gangColor,
                                  lat: node.location.lat,
                                  lng: node.location.lng,
                                  source: node.source
                                });
                              }}
                              onMouseOver={() => setHoveredGisElement(node)}
                              onMouseOut={() => setHoveredGisElement(null)}
                              icon={getMarkerIcon(node.rol, gangColor)}
                            />
                          );
                        })}
                        
                        {/* 2. Zonas de influencia */}
                        {showGisZones && filteredGisData.zones.map((zone) => {
                          const gangColor = getGangColor(zone.gang);
                          return (
                            <Polygon
                              key={zone.zone_id}
                              paths={zone.points}
                              onClick={() => {
                                setSelectedGisZone(zone);
                                setSelectedGisElement({
                                  tipo: "Zona de Influencia",
                                  titulo: `Zona de Influencia DBSCAN`,
                                  subtitulo: zone.gang,
                                  detalle: `Área de control territorial calculada mediante agrupamiento de domicilios (DBSCAN). Contiene ${zone.memberCount} integrantes mapeados con una densidad de ${zone.density.toFixed(2)} integrantes/km². Score de influencia: ${zone.influence_score}.`,
                                  gang: zone.gang,
                                  color: gangColor,
                                  lat: zone.points[0]?.lat || 21.88,
                                  lng: zone.points[0]?.lng || -102.29,
                                  source: "Análisis Espacial DBSCAN"
                                });
                              }}
                              options={{
                                strokeColor: gangColor,
                                strokeOpacity: 0.6,
                                strokeWeight: 2,
                                fillColor: gangColor,
                                fillOpacity: 0.25,
                              }}
                            />
                          );
                        })}
                        
                        {/* 3. Corredores de movilidad */}
                        {activeGisLayers.corridors && realCorridors.map((corr) => {
                          const gangColor = getGangColor(corr.gang);
                          return (
                            <Polyline
                              key={corr.id}
                              path={corr.path}
                              onClick={() => {
                                setSelectedGisElement({
                                  tipo: "Corredor de Movilidad",
                                  titulo: corr.nombre || "Corredor Táctico",
                                  subtitulo: corr.gang,
                                  detalle: `Ruta de desplazamiento y corredor de movilidad delictiva identificado para la organización. Nivel de control territorial: ${corr.nivel || "Medio"}.`,
                                  gang: corr.gang,
                                  color: gangColor,
                                  lat: corr.path[0]?.lat || 21.88,
                                  lng: corr.path[0]?.lng || -102.29,
                                  source: "Registros del Inventario"
                                });
                              }}
                              options={{
                                strokeColor: gangColor,
                                strokeOpacity: 0.85,
                                strokeWeight: 4.5,
                              }}
                            />
                          );
                        })}
                        
                        {/* 4. Grafitis registrados */}
                        {activeGisLayers.graffiti && realGraffiti.map((graf) => {
                          const gangColor = getGangColor(graf.gang);
                          return (
                            <Marker
                              key={graf.id}
                              position={graf.location}
                              title={`${graf.text} (${graf.gang})`}
                              onClick={() => {
                                setSelectedGisElement({
                                  tipo: "Grafiti / Marcaje Territorial",
                                  titulo: graf.text || "Grafiti de Marcaje",
                                  subtitulo: graf.gang,
                                  detalle: graf.description || "Evidencia física de marcaje e identificación territorial por grafiti.",
                                  gang: graf.gang,
                                  color: gangColor,
                                  lat: graf.location.lat,
                                  lng: graf.location.lng,
                                  date: graf.date,
                                  source: graf.source
                                });
                              }}
                              onMouseOver={() => setHoveredGisElement(graf)}
                              onMouseOut={() => setHoveredGisElement(null)}
                              icon={{
                                path: ICON_PATHS.dot,
                                scale: 1.5,
                                fillColor: gangColor,
                                fillOpacity: 1,
                                strokeColor: "#f97316",
                                strokeWeight: 2,
                              }}
                            />
                          );
                        })}
                        
                        {/* 5. Eventos históricos */}
                        {activeGisLayers.history && realHistory.map((hist) => {
                          const gangColor = getGangColor(hist.gang);
                          return (
                            <Marker
                              key={hist.id}
                              position={hist.location}
                              title={`${hist.text} (${hist.date})`}
                              onClick={() => {
                                setSelectedGisElement({
                                  tipo: `Evento Histórico - ${hist.categoria?.toUpperCase() || "INTELIGENCIA"}`,
                                  titulo: hist.text,
                                  subtitulo: hist.gang,
                                  detalle: hist.description || "Registro histórico de interés criminológico y de seguridad pública.",
                                  gang: hist.gang,
                                  color: gangColor,
                                  lat: hist.location.lat,
                                  lng: hist.location.lng,
                                  date: hist.date,
                                  source: "Cronología CEIPOL"
                                });
                              }}
                              onMouseOver={() => setHoveredGisElement(hist)}
                              onMouseOut={() => setHoveredGisElement(null)}
                              icon={{
                                path: ICON_PATHS.dot,
                                scale: 1.6,
                                fillColor: gangColor,
                                fillOpacity: 1,
                                strokeColor: "#ef4444",
                                strokeWeight: 2,
                              }}
                            />
                          );
                        })}

                        {/* Tooltip en Hover */}
                        {hoveredGisElement && (
                          <InfoWindow
                            position={hoveredGisElement.location}
                            options={{ disableAutoPan: true }}
                          >
                            <div className="bg-slate-950 text-slate-200 p-2 rounded-lg border border-slate-800 shadow-xl max-w-[240px] text-[11px] space-y-1">
                              {hoveredGisElement.alias ? (
                                <>
                                  <p className="font-bold text-sky-400 text-xs">🏠 {hoveredGisElement.alias}</p>
                                  <p><span className="text-slate-500 font-semibold">Rol:</span> {hoveredGisElement.rol || "Integrante"}</p>
                                  <p><span className="text-slate-500 font-semibold">Pandilla:</span> {hoveredGisElement.gang}</p>
                                  {hoveredGisElement.domicilioExacto && (
                                    <p className="truncate"><span className="text-slate-500 font-semibold">Dirección:</span> {hoveredGisElement.domicilioExacto}</p>
                                  )}
                                </>
                              ) : (
                                <>
                                  <p className="font-bold text-rose-400 text-xs">📍 {hoveredGisElement.text}</p>
                                  <p><span className="text-slate-500 font-semibold">Pandilla:</span> {hoveredGisElement.gang}</p>
                                  {hoveredGisElement.date && (
                                    <p><span className="text-slate-500 font-semibold">Fecha:</span> {hoveredGisElement.date}</p>
                                  )}
                                  {hoveredGisElement.description && (
                                    <p className="line-clamp-2 text-slate-300 italic">"{hoveredGisElement.description}"</p>
                                  )}
                                </>
                              )}
                            </div>
                          </InfoWindow>
                        )}
                      </GoogleMap>
                    </div>
                  )}
                </div>

                {/* 2. DETALLE EXPANDIDO DE INTELIGENCIA TERRITORIAL (Clic en marcador, abajo del mapa) */}
                {selectedGisElement && (
                  <div className="bg-slate-950/80 border rounded-2xl p-5 shadow-2xl animate-fadeIn space-y-4" style={{ borderColor: selectedGisElement.color }}>
                    <div className="flex justify-between items-start border-b border-slate-900 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded animate-pulse" style={{ backgroundColor: `${selectedGisElement.color}20`, color: selectedGisElement.color }}>
                          {selectedGisElement.tipo}
                        </span>
                        <h3 className="text-base font-black text-slate-100 uppercase mt-2">
                          {selectedGisElement.titulo}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Pandilla: <strong style={{ color: selectedGisElement.color }}>{selectedGisElement.subtitulo}</strong></p>
                      </div>
                      <button 
                        onClick={() => setSelectedGisElement(null)}
                        className="text-slate-500 hover:text-slate-300 text-xs font-bold uppercase transition-colors"
                      >
                        ❌ Cerrar Detalle
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                      <div className="md:col-span-8 space-y-3">
                        {selectedGisElement.rol && (
                          <p><strong className="text-slate-400">Rol en Estructura:</strong> <span className="font-bold text-slate-200">{selectedGisElement.rol}</span></p>
                        )}
                        <p><strong className="text-slate-400">Detalle Operativo:</strong></p>
                        <p className="bg-slate-900/60 p-3 rounded-lg border border-slate-850 text-slate-300 leading-relaxed italic">
                          {selectedGisElement.detalle}
                        </p>
                      </div>
                      <div className="md:col-span-4 bg-slate-900/40 p-4 rounded-xl border border-slate-850 space-y-2">
                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Metadatos Geográficos</span>
                        <p><strong className="text-slate-400">Latitud:</strong> <span className="font-mono">{selectedGisElement.lat.toFixed(6)}</span></p>
                        <p><strong className="text-slate-400">Longitud:</strong> <span className="font-mono">{selectedGisElement.lng.toFixed(6)}</span></p>
                        {selectedGisElement.date && (
                          <p><strong className="text-slate-400">Fecha de Registro:</strong> <span>{selectedGisElement.date}</span></p>
                        )}
                        {selectedGisElement.source && (
                          <p><strong className="text-slate-400">Fuente:</strong> <span className="px-1.5 py-0.5 bg-slate-800 text-[10px] text-slate-300 rounded font-bold">{selectedGisElement.source}</span></p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. BARRA DE CONTROLES INFERIOR (Debajo del mapa) */}
                <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-950/60 border border-slate-800 rounded-2xl p-5 shadow-xl">
                  
                  {/* SECCIÓN 1: SELECCIÓN DE PANDILLAS */}
                  <div className="md:col-span-6 space-y-3 border-r border-slate-800/60 pr-6">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                      <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                        👥 Selección de Pandillas
                      </h3>
                      <span className="text-[10px] bg-slate-850 px-1.5 py-0.5 rounded text-sky-400 font-bold">
                        {selectedGangsForGis.length}
                      </span>
                    </div>
                    
                    {storedGangs.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No hay pandillas registradas</p>
                    ) : (
                      <div className="space-y-2">
                        {/* Seleccionar Todas Checkbox */}
                        <label className="flex items-center justify-between text-xs text-slate-200 font-bold cursor-pointer border-b border-slate-900/60 pb-1.5">
                          <span>Seleccionar Todas</span>
                          <input
                            type="checkbox"
                            checked={selectedGangsForGis.length === storedGangs.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                  setSelectedGangsForGis(storedGangs.map(g => g.nombre));
                              } else {
                                  setSelectedGangsForGis([]);
                              }
                            }}
                            className="rounded bg-slate-900 border-slate-800 text-sky-500 focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                        </label>
                        
                        {/* List of Gangs */}
                        <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                          {storedGangs.map((g) => {
                            const isChecked = selectedGangsForGis.includes(g.nombre);
                            const gangColor = getGangColor(g.nombre);
                            return (
                              <label key={g.id} className="flex items-center justify-between text-xs text-slate-300 cursor-pointer hover:bg-slate-900/30 p-1.5 rounded transition-colors border border-slate-900/50" style={{ borderLeft: `3px solid ${gangColor}` }}>
                                <span className="truncate pr-1">👥 {g.nombre}</span>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedGangsForGis(selectedGangsForGis.filter(n => n !== g.nombre));
                                    } else {
                                      setSelectedGangsForGis([...selectedGangsForGis, g.nombre]);
                                    }
                                  }}
                                  className="rounded bg-slate-900 border-slate-800 text-sky-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* SECCIÓN 2: CAPAS GIS ACTIVAS & EJECUTAR ANÁLISIS */}
                  <div className="md:col-span-6 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="border-b border-slate-850 pb-2">
                        <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                          ⚙️ Capas GIS Activas (Máx. 5 Capas)
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "domiciles", label: "🏠 Domicilios de integrantes", color: "bg-cyan-500" },
                          { id: "influence", label: "🗺️ Zonas de influencia", color: "bg-yellow-500" },
                          { id: "corridors", label: "📈 Corredores de movilidad", color: "bg-purple-500" },
                          { id: "graffiti", label: "🎨 Grafitis registrados", color: "bg-orange-500" },
                          { id: "history", label: "⚠️ Eventos históricos", color: "bg-red-500" }
                        ].map(layer => (
                          <label key={layer.id} className="flex items-center justify-between text-xs text-slate-300 cursor-pointer hover:bg-slate-900/20 p-1.5 rounded transition-colors border border-slate-900">
                            <span className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${layer.color}`} />
                              {layer.label}
                            </span>
                            <input
                              type="checkbox"
                              checked={!!activeGisLayers[layer.id]}
                              onChange={(e) => {
                                setActiveGisLayers(prev => ({
                                  ...prev,
                                  [layer.id]: e.target.checked
                                }));
                              }}
                              className="rounded bg-slate-900 border-slate-800 text-sky-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    {/* BOTÓN PRINCIPAL: EJECUTAR ANÁLISIS */}
                    <button
                      type="button"
                      onClick={handleGisAnalysis}
                      disabled={isGisAnalyzing || selectedGangsForGis.length === 0}
                      className="w-full py-3 bg-gradient-to-r from-sky-400 to-indigo-600 hover:opacity-90 disabled:opacity-40 text-slate-950 text-xs font-black uppercase rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      {isGisAnalyzing ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent" />
                          <span>Analizando...</span>
                        </>
                      ) : (
                        <span>Ejecutar Análisis</span>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* 4. INTERPRETACIÓN GEOINT & BOTÓN FINAL */}
                {gisAnalysisReport && (
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 animate-fadeIn">
                    <div className="border-b border-slate-900 pb-3">
                      <h2 className="text-lg font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                        📋 Interpretación GEOINT
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">Análisis territorial narrativo de geointeligencia del sector.</p>
                    </div>
                    
                    {/* 🧠 VERDAD OPERACIONAL CRIMINAL (CICE) */}
                    {gisStructuredOutput?.cice_report && (
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-inner space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                          <div>
                            <h4 className="text-sm font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                              🧠 Verdad Operacional Criminal (CICE Telemetry)
                            </h4>
                            <p className="text-[10px] text-slate-500">
                              Consenso dinámico y nivel de confianza analítico de inteligencia criminal
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider">Confianza CICE</span>
                              <span className="text-xl font-mono font-black text-rose-400">
                                {gisStructuredOutput.cice_report.dominantScore}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Dominant source and reason */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                          <div className="md:col-span-4 border-r border-slate-850/60 pr-2">
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Fuente Dominante</span>
                            <span className="text-xs font-black text-slate-200 mt-1 block uppercase truncate" title={gisStructuredOutput.cice_report.dominantProvider}>
                              👑 {gisStructuredOutput.cice_report.dominantProvider}
                            </span>
                          </div>
                          <div className="md:col-span-8 pl-1">
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Justificación Metodológica</span>
                            <p className="text-[11px] text-slate-300 italic leading-relaxed mt-1">
                              {gisStructuredOutput.cice_report.dominantReason}
                            </p>
                          </div>
                        </div>

                        {/* Consensus & Uncertainty progress bars */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-400 font-extrabold">NIVEL DE CONSENSO:</span>
                              <span className="text-emerald-400 font-mono font-black">{gisStructuredOutput.cice_report.consensusLevel}%</span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 border border-slate-850">
                              <div 
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                                style={{ width: `${gisStructuredOutput.cice_report.consensusLevel}%` }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-400 font-extrabold">NIVEL DE INCERTIDUMBRE:</span>
                              <span className="text-amber-500 font-mono font-black">{gisStructuredOutput.cice_report.uncertaintyLevel}%</span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 border border-slate-850">
                              <div 
                                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" 
                                style={{ width: `${gisStructuredOutput.cice_report.uncertaintyLevel}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Institutional Inventories Used */}
                        {gisStructuredOutput.cice_report.institutionalInventoryUsed && gisStructuredOutput.cice_report.institutionalInventoryUsed.length > 0 && (
                          <div className="space-y-1 bg-slate-950/20 p-3 rounded-lg border border-slate-850/50">
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Inventario Institucional Utilizado</span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {gisStructuredOutput.cice_report.institutionalInventoryUsed.map((inv: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 bg-rose-950/50 text-rose-300 border border-rose-900/40 rounded text-[9px] font-bold">
                                  🛡️ {inv}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Correlations Detected */}
                        {gisStructuredOutput.cice_report.correlationsDetected && gisStructuredOutput.cice_report.correlationsDetected.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Correlaciones Cruzadas Detectadas</span>
                            <ul className="space-y-1 pl-1">
                              {gisStructuredOutput.cice_report.correlationsDetected.map((corr: string, idx: number) => (
                                <li key={idx} className="text-[10.5px] text-cyan-300 leading-normal flex items-start gap-1.5 bg-cyan-950/20 p-2 border border-cyan-900/30 rounded-lg">
                                  <span className="text-cyan-400 select-none mt-0.5">🔗</span>
                                  <span>{corr}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Sources detail */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-900/60">
                          <div className="space-y-1">
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Fuentes Utilizadas</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {gisStructuredOutput.cice_report.activeUsedProviders?.map((prov: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 bg-emerald-950/50 text-emerald-300 border border-emerald-900/30 rounded text-[9px] font-bold">
                                  {prov}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Fuentes Descartadas</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {gisStructuredOutput.cice_report.activeDiscardedProviders?.map((prov: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 bg-slate-950/60 text-slate-400 border border-slate-850 rounded text-[9px] font-semibold line-through opacity-60">
                                  {prov}
                                </span>
                              ))}
                              {(!gisStructuredOutput.cice_report.activeDiscardedProviders || gisStructuredOutput.cice_report.activeDiscardedProviders.length === 0) && (
                                <span className="text-[9px] text-slate-600 italic">Ninguna fuente descartada.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-850 whitespace-pre-wrap font-sans text-slate-300 text-xs leading-relaxed font-medium">
                      {gisAnalysisReport}
                    </div>
                    
                    {/* BOTÓN FINAL: GENERAR MAPA REPORT */}
                    <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-900 justify-end">
                      <button
                        type="button"
                        onClick={() => handleGenerateMap("png")}
                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold rounded-lg text-xs uppercase transition-all shadow-md active:scale-[0.98] cursor-pointer"
                      >
                        🖼️ Exportar como PNG
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateMap("pdf")}
                        className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-lg text-xs uppercase transition-all shadow-md active:scale-[0.98] cursor-pointer"
                      >
                        📄 Exportar como PDF (Dictamen Oficial)
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {geointSubTab === "album" && (
              <div className="w-full space-y-6">
                <div className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider">📁 Álbum de Pandilla</h3>
                      <p className="text-[10px] text-slate-500">Expediente visual estructurado de cada organización criminal.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 font-bold uppercase">Expediente:</label>
                      <select
                        value={albumGangId}
                        onChange={e => setAlbumGangId(e.target.value)}
                        className="bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 rounded px-2.5 py-1.5 focus:ring-0"
                      >
                        {storedGangs.map(g => (
                          <option key={g.id} value={g.id}>👥 {g.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const activeAlbumGang = storedGangs.find(g => g.id === albumGangId) || storedGangs[0];
                    if (!activeAlbumGang) {
                      return (
                        <div className="p-8 text-center text-xs text-slate-500 italic">
                          No hay expedientes de pandillas cargados en el sistema. Vaya al Panel de Registro para crear uno.
                        </div>
                      );
                    }

                    // 1. Identidad General
                    const codeSnippet = activeAlbumGang.id ? activeAlbumGang.id.substring(0, 8).toUpperCase() : "N/A";
                    
                    // 2. Estructura Criminal Grouping
                    const gangMembers = activeAlbumGang.integrantes || [];
                    const lideres = gangMembers.filter(m => {
                      const r = (m.estatusPandilla || m.rol || "").toLowerCase();
                      return r.includes("lider") || r.includes("segundo");
                    });
                    const sicarios = gangMembers.filter(m => {
                      const r = (m.estatusPandilla || m.rol || "").toLowerCase();
                      return r.includes("sicario") || r.includes("distribuidor");
                    });
                    const halcones = gangMembers.filter(m => {
                      const r = (m.estatusPandilla || m.rol || "").toLowerCase();
                      return r.includes("halcon") || r.includes("vigilante");
                    });
                    const operadores = gangMembers.filter(m => {
                      const r = (m.estatusPandilla || m.rol || "").toLowerCase();
                      return r.includes("operador") || r.includes("reclutador");
                    });
                    const miembros = gangMembers.filter(m => {
                      const r = (m.estatusPandilla || m.rol || "").toLowerCase();
                      return !r.includes("lider") && !r.includes("segundo") && !r.includes("sicario") && !r.includes("distribuidor") && !r.includes("halcon") && !r.includes("vigilante") && !r.includes("operador") && !r.includes("reclutador");
                    });

                    // 3. Domicilios Registrados
                    const gangNodes = filteredGisData.nodes.filter(n => n.gang === activeAlbumGang.nombre);

                    // 4. Zonas de Influencia
                    const gangZones = filteredGisData.zones.filter(z => z.gang === activeAlbumGang.nombre);

                    // 5. Evidencia Visual
                    const gangGraffiti = activeAlbumGang.imagenesGrafiti || [];
                    const associatedPhotos = projectPhotos.filter(p => {
                      const comment = (p.comentario || "").toLowerCase();
                      const name = (p.nombre || "").toLowerCase();
                      const gangName = activeAlbumGang.nombre.toLowerCase();
                      return comment.includes(gangName) || name.includes(gangName);
                    });

                    // 6. Eventos Históricos
                    const gangEvents = activeAlbumGang.cronologiaEventos || [];

                    // 7. Relaciones
                    const gangRelations = activeAlbumGang.relaciones || [];

                    // 8. Análisis Automático
                    let riskScore = 3.0; // Baseline
                    if (activeAlbumGang.peligrosidad === "Crítico") riskScore += 3.0;
                    else if (activeAlbumGang.peligrosidad === "Alto") riskScore += 2.0;
                    else if (activeAlbumGang.peligrosidad === "Medio") riskScore += 1.0;
                    riskScore += Math.min(2.0, gangMembers.length * 0.2);
                    const riskText = riskScore >= 7.0 ? "Crítico" : riskScore >= 5.0 ? "Alto" : riskScore >= 3.0 ? "Medio" : "Bajo";

                    const corridorCount = (activeAlbumGang.geometrias || []).filter(s => s.tipo === "corredor").length;
                    const growthTrend = gangMembers.length >= 8 ? "Expansión Territorial Alta" : gangMembers.length >= 4 ? "Estable / Crecimiento Moderado" : "Bajo Control";
                    
                    const patterns: string[] = [];
                    if (lideres.length > 0 && sicarios.length > 0) {
                      patterns.push("Estructura Operativa Completa: Se detecta coexistencia de mando táctico (líderes) y ejecutores de calle (sicarios).");
                    }
                    if (gangZones.length > 1) {
                      patterns.push("Fraccionamiento Territorial: Presencia de múltiples cuadrantes de influencia DBSCAN denota una distribución descentralizada.");
                    }
                    const gangRivals = gangRelations.filter(r => r.tipo === "rival");
                    if (gangRivals.length > 0) {
                      patterns.push(`Conflicto de Frontera Activo: Rivalidad declarada con ${gangRivals.map(r => r.pandillaNombre).join(", ")}, elevando el riesgo de colisión.`);
                    }
                    if (patterns.length === 0) {
                      patterns.push("Célula Local Autónoma: Estructura simple orientada al control de un cuadrante menor.");
                    }

                    // Navigation handlers
                    const zoomToCoords = (coords: { lat: number; lng: number }, elementData: any) => {
                      setSelectedGisElement(elementData);
                      setGeointSubTab("mapa");
                      setTimeout(() => {
                        if (mapInstance) {
                          mapInstance.panTo(coords);
                          mapInstance.setZoom(16);
                        }
                      }, 100);
                    };

                    const handleMemberClick = (m: GangMember) => {
                      const node = gangNodes.find(n => n.alias === m.alias || n.alias === m.nombre);
                      if (node) {
                        zoomToCoords(node.location, {
                          tipo: "Domicilio de Integrante",
                          titulo: node.alias || "Integrante",
                          subtitulo: node.gang,
                          rol: node.rol || "Integrante",
                          detalle: node.domicilioExacto || "Sin dirección exacta registrada.",
                          gang: node.gang,
                          color: getGangColor(node.gang),
                          lat: node.location.lat,
                          lng: node.location.lng,
                          source: node.source
                        });
                        setSelectedGisNode(node);
                      } else {
                        alert("⚠️ Este integrante no tiene coordenadas válidas en el mapa.");
                      }
                    };

                    const handleZoneClick = (z: any) => {
                      if (z.points && z.points.length > 0) {
                        zoomToCoords(z.points[0], {
                          tipo: "Zona de Influencia",
                          titulo: `Zona de Influencia DBSCAN`,
                          subtitulo: z.gang,
                          detalle: `Área de control territorial calculada mediante agrupamiento de domicilios. Contiene ${z.memberCount} integrantes. Score: ${z.influence_score}.`,
                          gang: z.gang,
                          color: getGangColor(z.gang),
                          lat: z.points[0].lat,
                          lng: z.points[0].lng,
                          source: "Análisis Espacial DBSCAN"
                        });
                        setSelectedGisZone(z);
                      }
                    };

                    const handleEventClick = (ev: any) => {
                      const coords = parseCoordinates(ev.lugar);
                      if (coords) {
                        zoomToCoords(coords, {
                          tipo: `Evento Histórico - ${ev.categoria?.toUpperCase() || "INTELIGENCIA"}`,
                          titulo: ev.titulo,
                          subtitulo: activeAlbumGang.nombre,
                          detalle: ev.descripcion || "Registro histórico de interés criminológico.",
                          gang: activeAlbumGang.nombre,
                          color: getGangColor(activeAlbumGang.nombre),
                          lat: coords.lat,
                          lng: coords.lng,
                          date: ev.fecha,
                          source: "Cronología CEIPOL"
                        });
                      } else {
                        alert("⚠️ Este evento no tiene coordenadas georreferenciadas.");
                      }
                    };

                    const handleResaltarGang = () => {
                      setSelectedGangsForGis([activeAlbumGang.nombre]);
                      setGeointSubTab("mapa");
                      if (gangNodes.length > 0) {
                        setTimeout(() => {
                          if (mapInstance) {
                            mapInstance.panTo(gangNodes[0].location);
                            mapInstance.setZoom(13);
                          }
                        }, 100);
                      }
                    };

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* LEFT COLUMN: GENERAL & STRUCTURE (7 cols) */}
                        <div className="lg:col-span-7 space-y-6">
                          
                          {/* 1. IDENTIDAD GENERAL */}
                          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 shadow space-y-4">
                            <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                              <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                                🧠 1. Identidad General
                              </h4>
                              <button
                                type="button"
                                onClick={handleResaltarGang}
                                className="px-2.5 py-1 bg-sky-950 hover:bg-sky-900 text-sky-400 border border-sky-850 rounded text-[10px] font-bold uppercase transition-colors"
                              >
                                🗺️ Resaltar en Mapa Táctico
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Nombre</span>
                                <span className="font-extrabold text-slate-200 mt-1 block uppercase">{activeAlbumGang.nombre}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Código Interno</span>
                                <span className="font-mono font-bold text-slate-200 mt-1 block">{codeSnippet}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Nivel de Actividad</span>
                                <span className="font-bold text-emerald-400 mt-1 block uppercase">{activeAlbumGang.estatus}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Peligrosidad</span>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase mt-1 ${
                                  activeAlbumGang.peligrosidad === "Crítico" ? "bg-red-950 text-red-400 border border-red-900/40" :
                                  activeAlbumGang.peligrosidad === "Alto" ? "bg-orange-950 text-orange-400 border border-orange-900/40" :
                                  "bg-sky-950 text-sky-400 border border-sky-900/40"
                                }`}>
                                  {activeAlbumGang.peligrosidad || "Medio"}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs bg-slate-950/40 p-3 rounded-lg border border-slate-850">
                              <span className="text-[9px] text-slate-500 uppercase font-bold block">Zona Principal de Operación</span>
                              <p className="text-slate-300 mt-1 font-semibold">{activeAlbumGang.zonaInfluencia || "Sin delimitar en catálogo."}</p>
                            </div>
                          </div>

                          {/* 2. ESTRUCTURA CRIMINAL */}
                          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 shadow space-y-4">
                            <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
                              <span>👥 2. Estructura Criminal ({gangMembers.length} integrantes)</span>
                              <span className="text-[10px] text-slate-500 font-bold">Haz clic en un integrante para ubicar su domicilio</span>
                            </h4>

                            {gangMembers.length === 0 ? (
                              <p className="text-xs text-slate-500 italic text-center py-4">No hay integrantes registrados en esta pandilla.</p>
                            ) : (
                              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                                {/* Group: Líderes */}
                                {lideres.length > 0 && (
                                  <div className="space-y-2">
                                    <h5 className="text-[10px] text-rose-400 font-black uppercase tracking-wider flex items-center gap-1">👑 Líderes / Mandos ({lideres.length})</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {lideres.map((m, i) => (
                                        <div key={i} onClick={() => handleMemberClick(m)} className="flex items-center gap-2.5 p-2 bg-slate-950/50 hover:bg-slate-900/60 border border-slate-850 rounded-lg cursor-pointer transition-all hover:scale-[1.01]">
                                          <img src={m.fotografiaUrl || "/avatars/avatar_male.png"} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-800 object-cover" />
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-200 truncate">"{m.alias || "Sin alias"}"</p>
                                            <p className="text-[9px] text-slate-400 truncate">{m.nombre || "Nombre sin registrar"}</p>
                                          </div>
                                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-rose-950/40 text-rose-400 border border-rose-900/30 rounded">LÍDER</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Group: Sicarios */}
                                {sicarios.length > 0 && (
                                  <div className="space-y-2">
                                    <h5 className="text-[10px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-1">🎯 Sicarios / Distribuidores ({sicarios.length})</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {sicarios.map((m, i) => (
                                        <div key={i} onClick={() => handleMemberClick(m)} className="flex items-center gap-2.5 p-2 bg-slate-950/50 hover:bg-slate-900/60 border border-slate-850 rounded-lg cursor-pointer transition-all hover:scale-[1.01]">
                                          <img src={m.fotografiaUrl || "/avatars/avatar_male.png"} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-800 object-cover" />
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-200 truncate">"{m.alias || "Sin alias"}"</p>
                                            <p className="text-[9px] text-slate-400 truncate">{m.nombre || "Nombre sin registrar"}</p>
                                          </div>
                                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-amber-950/40 text-amber-500 border border-amber-900/30 rounded">SICARIO</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Group: Halcones */}
                                {halcones.length > 0 && (
                                  <div className="space-y-2">
                                    <h5 className="text-[10px] text-sky-400 font-black uppercase tracking-wider flex items-center gap-1">👁️ Halcones / Vigilantes ({halcones.length})</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {halcones.map((m, i) => (
                                        <div key={i} onClick={() => handleMemberClick(m)} className="flex items-center gap-2.5 p-2 bg-slate-950/50 hover:bg-slate-900/60 border border-slate-850 rounded-lg cursor-pointer transition-all hover:scale-[1.01]">
                                          <img src={m.fotografiaUrl || "/avatars/avatar_male.png"} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-800 object-cover" />
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-200 truncate">"{m.alias || "Sin alias"}"</p>
                                            <p className="text-[9px] text-slate-400 truncate">{m.nombre || "Nombre sin registrar"}</p>
                                          </div>
                                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-sky-950/40 text-sky-400 border border-sky-900/30 rounded">HALCÓN</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Group: Operadores */}
                                {operadores.length > 0 && (
                                  <div className="space-y-2">
                                    <h5 className="text-[10px] text-purple-400 font-black uppercase tracking-wider flex items-center gap-1">⚙️ Operadores ({operadores.length})</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {operadores.map((m, i) => (
                                        <div key={i} onClick={() => handleMemberClick(m)} className="flex items-center gap-2.5 p-2 bg-slate-950/50 hover:bg-slate-900/60 border border-slate-850 rounded-lg cursor-pointer transition-all hover:scale-[1.01]">
                                          <img src={m.fotografiaUrl || "/avatars/avatar_male.png"} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-800 object-cover" />
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-200 truncate">"{m.alias || "Sin alias"}"</p>
                                            <p className="text-[9px] text-slate-400 truncate">{m.nombre || "Nombre sin registrar"}</p>
                                          </div>
                                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-purple-950/40 text-purple-400 border border-purple-900/30 rounded">OPERADOR</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Group: Miembros standard */}
                                {miembros.length > 0 && (
                                  <div className="space-y-2">
                                    <h5 className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center gap-1">🟢 Miembros / Colaboradores ({miembros.length})</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {miembros.map((m, i) => (
                                        <div key={i} onClick={() => handleMemberClick(m)} className="flex items-center gap-2.5 p-2 bg-slate-950/50 hover:bg-slate-900/60 border border-slate-850 rounded-lg cursor-pointer transition-all hover:scale-[1.01]">
                                          <img src={m.fotografiaUrl || "/avatars/avatar_male.png"} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-850 object-cover" />
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-200 truncate">"{m.alias || "Sin alias"}"</p>
                                            <p className="text-[9px] text-slate-400 truncate">{m.nombre || "Nombre sin registrar"}</p>
                                          </div>
                                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 rounded">MIEMBRO</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 3. DOMICILIOS REGISTRADOS */}
                          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 shadow space-y-4">
                            <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                              🏠 3. Domicilios Registrados & Cartografía Embebida
                            </h4>
                            
                            {/* Embedded Map */}
                            {isLoaded && (
                              <div className="w-full h-[250px] rounded-lg border border-slate-850 overflow-hidden shadow-inner bg-slate-950">
                                <GoogleMap
                                  mapContainerStyle={{ width: "100%", height: "100%" }}
                                  center={activeAlbumGang.coordenadas || (gangNodes[0]?.location) || { lat: 21.8853, lng: -102.2916 }}
                                  zoom={13}
                                  options={{
                                    streetViewControl: false,
                                    mapTypeControl: false,
                                    fullscreenControl: false,
                                    styles: darkMapStyles,
                                    disableDefaultUI: true
                                  }}
                                >
                                  {gangNodes.map(node => (
                                    <Marker
                                      key={node.member_id}
                                      position={node.location}
                                      icon={getMarkerIcon(node.rol, getGangColor(node.gang))}
                                      title={node.alias}
                                    />
                                  ))}
                                </GoogleMap>
                              </div>
                            )}

                            {/* Addresses List */}
                            <div className="space-y-1.5 max-h-[220px] overflow-y-auto text-xs pr-1">
                              {gangMembers.map((m, i) => {
                                const node = gangNodes.find(n => n.alias === m.alias || n.alias === m.nombre);
                                return (
                                  <div key={i} onClick={() => handleMemberClick(m)} className="p-2.5 bg-slate-950/40 border border-slate-900 rounded-lg hover:bg-slate-900/35 transition-colors cursor-pointer flex justify-between items-center gap-4">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-extrabold text-slate-200">🏠 "{m.alias || "Integrante"}"</p>
                                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{m.domicilioConocido || "Sin dirección exacta registrada."}</p>
                                    </div>
                                    {node ? (
                                      <div className="flex flex-col items-end shrink-0">
                                        <span className="font-mono text-[9px] text-emerald-400 font-bold">{node.location.lat.toFixed(5)}, {node.location.lng.toFixed(5)}</span>
                                        <span className="text-[8px] bg-emerald-950/50 text-emerald-400 border border-emerald-900/30 px-1 rounded font-bold uppercase tracking-wider mt-0.5">GEORREFERENCIADO</span>
                                      </div>
                                    ) : (
                                      <span className="text-[8px] bg-slate-900 text-slate-500 border border-slate-800 px-1 rounded font-bold uppercase tracking-wider shrink-0">SIN COORDENADAS</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>

                        {/* RIGHT COLUMN: ZONES, PHOTOS, TIMELINE, RELATIONS & AI (5 cols) */}
                        <div className="lg:col-span-5 space-y-6">
                          
                          {/* 4. ZONAS DE INFLUENCIA */}
                          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 shadow space-y-4">
                            <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                              🗺️ 4. Zonas de Influencia
                            </h4>
                            {gangZones.length === 0 ? (
                              <p className="text-xs text-slate-500 italic text-center py-4">No hay zonas de influencia DBSCAN calculadas para esta pandilla. Se requiere un mínimo de 2 integrantes geolocalizados.</p>
                            ) : (
                              <div className="space-y-2">
                                {gangZones.map((z, idx) => (
                                  <div key={idx} onClick={() => handleZoneClick(z)} className="p-3 bg-slate-950/40 hover:bg-slate-900/35 border border-slate-900 rounded-xl transition-all cursor-pointer space-y-2 relative overflow-hidden" style={{ borderLeft: `4px solid ${getGangColor(z.gang)}` }}>
                                    <div className="flex justify-between items-center">
                                      <span className="text-[9px] font-black uppercase text-slate-400">POLÍGONO DBSCAN</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                        z.intensity === "alto" ? "bg-red-950 text-red-400 border border-red-900/40" :
                                        z.intensity === "medio" ? "bg-orange-950 text-orange-400 border border-orange-900/40" :
                                        "bg-yellow-950 text-yellow-400 border border-yellow-900/40"
                                      }`}>
                                        INTENSIDAD {z.intensity.toUpperCase()}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-200 leading-normal font-semibold">
                                      Área de influencia con un total de <strong>{z.memberCount} integrantes</strong> agrupados.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                      <div>
                                        <span className="text-slate-500 block font-bold">Score de Influencia:</span>
                                        <span className="text-sky-400 font-extrabold">{z.influence_score}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500 block font-bold">Densidad / km²:</span>
                                        <span className="text-emerald-400 font-extrabold">{z.density}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 5. EVIDENCIA VISUAL */}
                          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 shadow space-y-4">
                            <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                              📸 5. Evidencia Visual
                            </h4>
                            
                            {gangGraffiti.length === 0 && associatedPhotos.length === 0 ? (
                              <p className="text-xs text-slate-500 italic text-center py-4">No hay grafitis ni fotografías asociadas a esta pandilla en Firestore.</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                                {gangGraffiti.map((img, i) => (
                                  <div key={i} className="bg-slate-950/40 border border-slate-900 rounded-lg overflow-hidden relative group">
                                    <img src={img.url} alt="Grafiti" className="w-full h-24 object-cover" />
                                    <div className="p-1.5 text-[9px] text-slate-400 truncate bg-slate-950/80 absolute bottom-0 left-0 right-0">
                                      🎨 {img.descripcion || "Marcaje Territorial"}
                                    </div>
                                  </div>
                                ))}
                                {associatedPhotos.map((img, i) => (
                                  <div key={i} className="bg-slate-950/40 border border-slate-900 rounded-lg overflow-hidden relative group">
                                    <img src={img.imageUrl || img.url} alt="Foto" className="w-full h-24 object-cover" />
                                    <div className="p-1.5 text-[9px] text-slate-400 truncate bg-slate-950/80 absolute bottom-0 left-0 right-0">
                                      📸 {img.description || "Foto de Evidencia"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 6. EVENTOS HISTÓRICOS */}
                          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 shadow space-y-4">
                            <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                              ⚠️ 6. Eventos Históricos
                            </h4>
                            {gangEvents.length === 0 ? (
                              <p className="text-xs text-slate-500 italic text-center py-4">No hay incidentes registrados en la cronología.</p>
                            ) : (
                              <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                                {gangEvents.map((ev, i) => (
                                  <div key={ev.id || i} onClick={() => handleEventClick(ev)} className="p-2.5 bg-slate-950/40 border border-slate-900 hover:bg-slate-900/35 rounded-lg cursor-pointer transition-colors space-y-1 relative">
                                    <div className="flex justify-between items-center text-[9px]">
                                      <span className="text-slate-500 font-bold">{ev.fecha}</span>
                                      <span className={`px-1 rounded-[3px] font-black uppercase text-[8px] ${
                                        ev.gravedad === "Crítica" ? "bg-red-500" : ev.gravedad === "Alta" ? "bg-orange-500" : "bg-sky-500"
                                      }`}>
                                        {ev.gravedad}
                                      </span>
                                    </div>
                                    <h5 className="text-xs font-bold text-slate-200 uppercase truncate">💥 {ev.titulo}</h5>
                                    <p className="text-[10px] text-slate-400 leading-normal line-clamp-2">{ev.descripcion}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 7. RELACIONES */}
                          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 shadow space-y-4">
                            <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                              🔗 7. Relaciones & Alianzas
                            </h4>
                            {gangRelations.length === 0 ? (
                              <p className="text-xs text-slate-500 italic text-center py-4">No hay relaciones inter-pandillas declaradas.</p>
                            ) : (
                              <div className="space-y-2">
                                {gangRelations.map((rel, i) => (
                                  <div key={i} className="p-2.5 bg-slate-950/40 border border-slate-900 rounded-lg flex items-center justify-between gap-4 text-xs">
                                    <div className="min-w-0">
                                      <p className="font-extrabold text-slate-200">👥 {rel.pandillaNombre}</p>
                                      <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">{rel.tipoVinculo || "Actividad delictiva"}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                                      rel.tipo === "rival" ? "bg-red-950 text-red-400 border border-red-900/40" : "bg-emerald-950 text-emerald-400 border border-emerald-900/40"
                                    }`}>
                                      {rel.tipo === "rival" ? "⚔️ RIVAL" : "🤝 ALIANZA"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 8. ANÁLISIS AUTOMÁTICO */}
                          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 shadow space-y-4">
                            <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                              📈 8. Análisis Automático (GEOINT AI)
                            </h4>
                            <div className="space-y-3.5 text-xs">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-950/30 p-2.5 rounded-lg border border-slate-900">
                                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Riesgo Calculado</span>
                                  <span className={`font-black uppercase text-xs mt-1 block ${
                                    riskText === "Crítico" ? "text-red-400 animate-pulse" : riskText === "Alto" ? "text-orange-400" : "text-sky-400"
                                  }`}>{riskText} ({riskScore.toFixed(1)}/10)</span>
                                </div>
                                <div className="bg-slate-950/30 p-2.5 rounded-lg border border-slate-900">
                                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Tendencia de Crecimiento</span>
                                  <span className="font-extrabold text-slate-200 mt-1 block truncate">{growthTrend}</span>
                                </div>
                              </div>
                              <div className="bg-slate-950/30 p-2.5 rounded-lg border border-slate-900">
                                <span className="text-[9px] text-slate-500 font-bold uppercase block">Movilidad y Control</span>
                                <span className="font-extrabold text-slate-300 mt-1 block">
                                  {corridorCount} Corredores de Movilidad Tácticos identificados en cuadrícula.
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-[9px] text-slate-500 font-bold uppercase block">Patrones Operacionales Inferidos</span>
                                <div className="space-y-1.5">
                                  {patterns.map((pat, idx) => (
                                    <div key={idx} className="p-2.5 bg-sky-950/20 text-sky-300 border border-sky-900/30 rounded-lg text-[10.5px] leading-normal flex items-start gap-1.5">
                                      <span className="text-sky-400 mt-0.5">🧠</span>
                                      <span>{pat}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })()}
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
