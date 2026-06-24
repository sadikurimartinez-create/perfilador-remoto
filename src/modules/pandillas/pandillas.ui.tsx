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

const MAP_LIBRARIES: ("places" | "visualization" | "drawing")[] = ["places", "visualization", "drawing"];

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
  const [archivos, setArchivos] = useState<{ nombre: string; size: number; tipo: string; contexto?: string }[]>([]);

  // --- INTERACTION & EDITING SUB-STATES ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "registro" | "integrantes" | "relaciones" | "geointeligencia" | "barridos">("dashboard");

  const onMapLoad = useCallback((mapInstance: any) => {
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
  };

  // --- GEOGRAPHIC VALIDATION BOUNDS FOR AGUASCALIENTES ---
  const isWithinAguascalientes = (lat: number, lng: number) => {
    // Envelope for the State of Aguascalientes, Mexico
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
    if (!drawingMode || !e.latLng) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    // STRICT GEOGRAPHICAL VALIDATION
    if (!isWithinAguascalientes(lat, lng)) {
      alert("⛔ ERROR DE GEORREFERENCIACIÓN:\nEl punto seleccionado se encuentra fuera de los límites del Estado de Aguascalientes. Todo elemento cartográfico debe quedar estrictamente contenido dentro de la geografía del estado.");
      return;
    }

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

    const newShape: GeointeligenciaShape = {
      id: "shape-" + Date.now(),
      nombre: tempShapeName,
      tipo: drawingMode!,
      puntos: [...tempShapePoints],
      radio: drawingMode === "buffer" ? tempShapeRadius : undefined,
      nivelControlTerritorial: tempShapeControl,
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* GIS TOOLBOX PANEL (4 cols) */}
            <div className="lg:col-span-4 bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
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
                      { id: "buffer", label: "⭕ Buffer", desc: "Radios de acción" },
                      { id: "zona_riesgo", label: "📍 Zona Riesgo", desc: "Punto caliente" }
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
                    <p className="text-[9px] font-black text-sky-400 uppercase tracking-widest">📐 Editando Nueva Capa GIS</p>

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
                      👉 Haga clic directamente sobre el mapa táctico para establecer los vértices correspondientes en la geografía.
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
                  <p className="text-xs text-slate-500 italic">No hay geometrías delineadas en este registro.</p>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {geometrias.map((geo, idx) => (
                      <div key={geo.id} className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/40 flex justify-between items-center text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px]">
                              {geo.tipo === "poligono" ? "🔷" : geo.tipo === "corredor" ? "📈" : geo.tipo === "buffer" ? "⭕" : "📍"}
                            </span>
                            <span className="font-extrabold text-slate-300 uppercase">{geo.nombre}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">Control: <strong className="text-sky-400 uppercase">{geo.nivelControlTerritorial}</strong></p>
                        </div>
                        <button
                          onClick={() => setGeometrias(geometrias.filter(g => g.id !== geo.id))}
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

            {/* GOOGLE MAP LAYER PANEL (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div>
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">🗺️ Canvas de Geopolítica y Control Territorial</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Delineado con geovalidación obligatoria para Aguascalientes. Prohibido fallbacks automáticos centralizados.</p>
                </div>
              </div>

              {!isLoaded ? (
                <div className="w-full h-[450px] rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center text-xs text-slate-500">
                  Cargando cartografía táctica...
                </div>
              ) : (
                <div className="relative h-[450px] w-full rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
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
                    {geometrias.map((geo, idx) => {
                      const color =
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
                                strokeWeight: 2.5,
                                fillColor: color,
                                fillOpacity: 0.25,
                              }}
                            />
                          )}

                          {geo.tipo === "corredor" && (
                            <Polyline
                              path={geo.puntos}
                              options={{
                                strokeColor: color,
                                strokeOpacity: 0.9,
                                strokeWeight: 4,
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
                                strokeWeight: 1.5,
                                fillColor: color,
                                fillOpacity: 0.15,
                              }}
                            />
                          )}

                          {geo.tipo === "zona_riesgo" && (
                            <Marker
                              position={geo.puntos[0]}
                              icon={{
                                path: 0,
                                scale: 8,
                                fillColor: color,
                                fillOpacity: 1,
                                strokeColor: "#ffffff",
                                strokeWeight: 2,
                              }}
                            />
                          )}
                        </React.Fragment>
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
