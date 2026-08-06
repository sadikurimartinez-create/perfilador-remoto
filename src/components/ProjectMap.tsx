"use client";

import React, { useMemo, useState } from "react";
import { GoogleMap, Marker, Polyline, Polygon, Circle, useJsApiLoader, InfoWindow } from "@react-google-maps/api";
import { extractSweepCoordinates } from "@/utils/sweepCoordinatesExtractor";

interface ProjectMapProps {
  geometryType: "individual" | "lineal" | "poligono" | string;
  coordinates: { lat: number; lng: number }[];
  onUpdateCoordinates?: (newCoords: { lat: number; lng: number }[]) => void;
  onAddPoint?: (lat: number, lng: number, details: { name: string; isIndependentPoi: boolean; isVertex: boolean }) => Promise<void>;
  onMoveMarker?: (id: string, lat: number, lng: number) => Promise<void>;
  onCandidateCapture?: (lat: number, lng: number, context: { geometryType: "POLYGON" | "LINE"; captureContext: "vertex_add" | "vertex_edit"; previousPhotoId?: string }) => void;
  onPoiSelect?: (lat: number, lng: number) => void;
  album: any[];
  project: {
    id: string;
    latitude?: number | null;
    longitude?: number | null;
    radius?: number | null;
    locationName?: string;
    sweeps?: any[];
  };
}

const mapContainerStyle = {
  width: "100%",
  height: "550px",
  borderRadius: "0.75rem",
};

// Dark mode maps styling for matching CEIPOL styling aesthetics
const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
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
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#e2e8f0" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#38bdf8" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#020617" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#0f172a" }],
  },
];

const GOOGLE_MAPS_LIBRARIES: any = ["places", "visualization", "drawing"];

export function ProjectMap({
  geometryType,
  coordinates,
  onUpdateCoordinates,
  onAddPoint,
  onMoveMarker,
  onCandidateCapture,
  onPoiSelect,
  album = [],
  project,
}: ProjectMapProps) {
  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc") : "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc";
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [hoveredPhoto, setHoveredPhoto] = useState<any | null>(null);
  const [activePhoto, setActivePhoto] = useState<any | null>(null);
  const [subMode, setSubMode] = useState<"vertex" | "poi">("poi");

  const [showPhotos, setShowPhotos] = useState(true);
  const [showOsint, setShowOsint] = useState(true);
  const [showGeoint, setShowGeoint] = useState(true);
  const [showAreas, setShowAreas] = useState(true);

  // --- ENHANCEMENTS GEOINT & OSINT v1.0 ---
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showPovCones, setShowPovCones] = useState(true);
  const [osintProviderFilter, setOsintProviderFilter] = useState<"ALL" | "TELEGRAM" | "INEGI" | "GOOGLE" | "SOCIAL">("ALL");

  const [selectedOsintSingle, setSelectedOsintSingle] = useState<any | null>(null);
  const [selectedOsintGroup, setSelectedOsintGroup] = useState<any | null>(null);

  // Mapear y decodificar los barridos OSINT
  const parsedSweeps = useMemo(() => {
    const sweepsList = project?.sweeps || [];
    return sweepsList
      .filter((s: any) => s.status === "Integrado" || s.status === "Completado")
      .map((s: any) => {
        const coords = extractSweepCoordinates(s);
        return {
          ...s,
          coordsInfo: coords
        };
      });
  }, [project?.sweeps]);

  // Filtrado dinámico por proveedor OSINT (OSINT-ENH-01)
  const filteredParsedSweeps = useMemo(() => {
    if (osintProviderFilter === "ALL") return parsedSweeps;
    return parsedSweeps.filter((sweep: any) => {
      const engine = (sweep.engine || sweep.source || sweep.type || "").toUpperCase();
      if (osintProviderFilter === "TELEGRAM") return engine.includes("TELEGRAM");
      if (osintProviderFilter === "INEGI") return engine.includes("INEGI") || engine.includes("DENUE") || engine.includes("SCINCE");
      if (osintProviderFilter === "GOOGLE") return engine.includes("GOOGLE") || engine.includes("PLACES");
      if (osintProviderFilter === "SOCIAL") return engine.includes("X") || engine.includes("FACEBOOK") || engine.includes("INSTAGRAM") || engine.includes("REDDIT");
      return true;
    });
  }, [parsedSweeps, osintProviderFilter]);

  // Barridos OSINT con georreferencia
  const sweepsWithCoords = useMemo(() => {
    return filteredParsedSweeps.filter((s: any) => s.coordsInfo.hasCoordinates);
  }, [filteredParsedSweeps]);

  // Barridos OSINT sin georreferencia
  const sweepsWithoutCoords = useMemo(() => {
    return filteredParsedSweeps.filter((s: any) => !s.coordsInfo.hasCoordinates);
  }, [filteredParsedSweeps]);

  // Clusterización OSINT independiente
  const osintClusters = useMemo(() => {
    const totalCount = sweepsWithCoords.length;
    if (totalCount === 0) return [];

    if (totalCount > 20) {
      const avgLat = sweepsWithCoords.reduce((sum, s) => sum + s.coordsInfo.lat!, 0) / totalCount;
      const avgLng = sweepsWithCoords.reduce((sum, s) => sum + s.coordsInfo.lng!, 0) / totalCount;
      return [{
        type: "SUPER",
        lat: avgLat,
        lng: avgLng,
        count: totalCount,
        sweeps: sweepsWithCoords,
        label: `◉ [${totalCount}] Barridos OSINT`
      }];
    }

    if (totalCount >= 6) {
      const groups: Record<string, any[]> = {};
      sweepsWithCoords.forEach((s) => {
        const gridLat = Math.round(s.coordsInfo.lat! * 1000) / 1000;
        const gridLng = Math.round(s.coordsInfo.lng! * 1000) / 1000;
        const gridKey = `${gridLat},${gridLng}`;
        if (!groups[gridKey]) {
          groups[gridKey] = [];
        }
        groups[gridKey].push(s);
      });

      return Object.entries(groups).map(([key, groupSweeps]) => {
        const [latStr, lngStr] = key.split(",");
        const centerLat = parseFloat(latStr);
        const centerLng = parseFloat(lngStr);
        if (groupSweeps.length === 1) {
          return {
            type: "SINGLE",
            lat: groupSweeps[0].coordsInfo.lat!,
            lng: groupSweeps[0].coordsInfo.lng!,
            count: 1,
            sweeps: groupSweeps,
            label: groupSweeps[0].engine
          };
        }
        return {
          type: "GROUP",
          lat: centerLat,
          lng: centerLng,
          count: groupSweeps.length,
          sweeps: groupSweeps,
          label: `🔎 [${groupSweeps.length}] Barridos`
        };
      });
    }

    return sweepsWithCoords.map((s) => ({
      type: "SINGLE",
      lat: s.coordsInfo.lat!,
      lng: s.coordsInfo.lng!,
      count: 1,
      sweeps: [s],
      label: s.engine
    }));
  }, [sweepsWithCoords]);

  const mapOptions = useMemo(() => ({
    styles: darkMapStyles,
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: true,
    rotateControl: true,
    fullscreenControl: true,
    gestureHandling: "cooperative" as const,
  }), []);

  // Filter georeferenced evidence items
  const georeferencedPhotos = useMemo(() => {
    return album.filter((p) => {
      if (p.lat == null || p.lng == null) return false;
      // Filtrar pines por defecto automáticos de Aguascalientes para evitar distorsionar el mapa
      const isDefaultFallback = Math.abs(Number(p.lat) - 21.8853) < 0.0001 && Math.abs(Number(p.lng) - (-102.2916)) < 0.0001;
      return !isDefaultFallback;
    });
  }, [album]);

  // Compute dispersed positions for marker rendering to prevent stacked pins
  const markersWithDispersion = useMemo(() => {
    const coordCounts: Record<string, number> = {};
    return georeferencedPhotos.map((photo) => {
      const lat = Number(photo.lat);
      const lng = Number(photo.lng);
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      if (coordCounts[key] === undefined) {
        coordCounts[key] = 0;
      }
      const count = coordCounts[key];
      coordCounts[key] += 1;
      if (count === 0) {
        return {
          ...photo,
          displayLat: lat,
          displayLng: lng,
        };
      } else {
        const angle = (count * 2 * Math.PI) / 8; // Max 8 points per ring
        const ring = Math.floor((count - 1) / 8) + 1;
        const baseRadius = 0.000035; // ~3-4 meters
        const radius = baseRadius * ring;
        return {
          ...photo,
          displayLat: lat + radius * Math.sin(angle),
          displayLng: lng + radius * Math.cos(angle),
        };
      }
    });
  }, [georeferencedPhotos]);

  const isFallback = useMemo(() => {
    const hasProjectCoords = project?.latitude != null && project?.longitude != null;
    const isProjectDefault = hasProjectCoords && 
      Math.abs(Number(project.latitude) - 21.8853) < 0.0001 && 
      Math.abs(Number(project.longitude) - (-102.2916)) < 0.0001;

    const hasRealProjectCenter = hasProjectCoords && !isProjectDefault;
    const hasCoordinates = coordinates && coordinates.length > 0;
    const hasRealPhotos = georeferencedPhotos.length > 0;

    return !hasRealProjectCenter && !hasCoordinates && !hasRealPhotos;
  }, [project, coordinates, georeferencedPhotos]);

  const center = useMemo(() => {
    if (project?.latitude && project?.longitude) {
      const isProjectDefault = Math.abs(Number(project.latitude) - 21.8853) < 0.0001 && 
                               Math.abs(Number(project.longitude) - (-102.2916)) < 0.0001;
      if (!isProjectDefault) {
        return { lat: Number(project.latitude), lng: Number(project.longitude) };
      }
    }
    if (georeferencedPhotos.length > 0) {
      return { lat: Number(georeferencedPhotos[0].lat), lng: Number(georeferencedPhotos[0].lng) };
    }
    if (coordinates.length > 0) {
      return coordinates[0];
    }
    return { lat: 21.8853, lng: -102.2916 }; // Default Aguascalientes (sólo para cargar mapa base, pero oculto tras isFallback)
  }, [project, coordinates, georeferencedPhotos]);

  // Group coordinates of evidences for corridor polyline or polygon drawing (excl. independent POIs)
  const geoShapePath = useMemo(() => {
    return georeferencedPhotos
      .filter((p) => !p.isIndependentPoi && p.tipo !== "POI" && p.tipo !== "Punto Independiente" && !p.tipo?.startsWith("Barrido"))
      .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
  }, [georeferencedPhotos]);

  // Carga y cálculo de densidad analítica de calor compatible con Google Maps JS v3.65+ (GEO-ENH-01 v1.1)
  const heatmapDensityClusters = useMemo(() => {
    const rawPoints: { lat: number; lng: number }[] = [];
    georeferencedPhotos.forEach((p) => {
      if (p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))) {
        rawPoints.push({ lat: Number(p.lat), lng: Number(p.lng) });
      }
    });
    sweepsWithCoords.forEach((s: any) => {
      if (s.coordsInfo?.lat != null && s.coordsInfo?.lng != null) {
        rawPoints.push({ lat: Number(s.coordsInfo.lat), lng: Number(s.coordsInfo.lng) });
      }
    });

    if (rawPoints.length === 0) return [];

    // Agrupar en celdas de cuadrícula de densidad de ~100m (precisión 0.001 deg)
    const densityMap: Record<string, { lat: number; lng: number; count: number }> = {};
    rawPoints.forEach((pt) => {
      const gridLat = Math.round(pt.lat * 1000) / 1000;
      const gridLng = Math.round(pt.lng * 1000) / 1000;
      const key = `${gridLat.toFixed(3)},${gridLng.toFixed(3)}`;
      if (!densityMap[key]) {
        densityMap[key] = { lat: gridLat, lng: gridLng, count: 0 };
      }
      densityMap[key].count += 1;
    });

    // Mapear cada celda a un halo de densidad dinámico multinivel
    return Object.entries(densityMap).map(([key, cell]) => {
      const count = cell.count;
      const color = count >= 5 ? "#f43f5e" : count >= 3 ? "#fb923c" : "#facc15";
      const baseRadius = Math.min(120 + count * 25, 400);
      const opacity = Math.min(0.20 + count * 0.08, 0.55);

      return {
        id: key,
        lat: cell.lat,
        lng: cell.lng,
        count,
        radius: baseRadius,
        innerRadius: Math.round(baseRadius * 0.45),
        color,
        opacity,
      };
    });
  }, [georeferencedPhotos, sweepsWithCoords]);

  // Carga de conos de visión 2D (POV) para Street View (GEO-ENH-02)
  const povConePaths = useMemo(() => {
    return georeferencedPhotos
      .filter((photo) => photo.streetViewMetadata || photo.heading != null)
      .map((photo) => {
        const meta = photo.streetViewMetadata || {};
        const lat = Number(photo.lat);
        const lng = Number(photo.lng);
        const heading = meta.heading ?? photo.heading ?? 0;
        const fov = meta.fov ?? photo.fov ?? 90;
        const radius = 0.00025; // ~25 metros

        const halfFov = fov / 2;
        const startAngle = (heading - 90 - halfFov) * (Math.PI / 180);
        const endAngle = (heading - 90 + halfFov) * (Math.PI / 180);

        const path = [{ lat, lng }];
        const steps = 7;
        for (let i = 0; i <= steps; i++) {
          const angle = startAngle + (i * (endAngle - startAngle)) / steps;
          const latOffset = radius * Math.sin(angle);
          const lngOffset = (radius * Math.cos(angle)) / Math.cos(lat * (Math.PI / 180));
          path.push({ lat: lat + latOffset, lng: lng + lngOffset });
        }
        path.push({ lat, lng });

        return {
          id: photo.id,
          path,
          heading,
          fov,
        };
      });
  }, [georeferencedPhotos]);

  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    if (geometryType === "individual") {
      if (onPoiSelect) {
        onPoiSelect(lat, lng);
        return;
      }
      if (!onAddPoint) return;
      const name = window.prompt("Ingrese el nombre o comentario para esta evidencia / POI:", "Evidencia de Campo");
      if (name === null) return;
      await onAddPoint(lat, lng, { name, isIndependentPoi: true, isVertex: false });
    } else {
      if (subMode === "vertex") {
        if (!onAddPoint) return;
        // Modalidad 1: Ampliar / Modificar Trazado
        if (onCandidateCapture) {
          onCandidateCapture(lat, lng, {
            geometryType: geometryType === "lineal" || geometryType === "corredor" ? "LINE" : "POLYGON",
            captureContext: "vertex_add"
          });
        }
        await onAddPoint(lat, lng, { name: "Vértice de trazado", isIndependentPoi: false, isVertex: true });
      } else {
        // Modalidad 2: Evidencia / POI Independiente
        if (onPoiSelect) {
          onPoiSelect(lat, lng);
          return;
        }
        if (!onAddPoint) return;
        const name = window.prompt("Ingrese el comentario para esta evidencia independiente:", "POI Independiente");
        if (name === null) return;
        await onAddPoint(lat, lng, { name, isIndependentPoi: true, isVertex: false });
      }
    }
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-[550px] bg-slate-950 flex items-center justify-center text-xs text-slate-400 border border-slate-800 rounded-xl">
        <div className="flex flex-col items-center gap-2">
          <span className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
          <span>Cargando Mapa Táctico...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {isFallback && (
        <div className="absolute inset-0 bg-slate-950/85 flex items-center justify-center z-[11] backdrop-blur-sm rounded-xl border border-slate-850">
          <div className="bg-slate-900/90 border border-amber-500/30 p-6 rounded-2xl max-w-sm text-center shadow-2xl space-y-3 font-sans">
            <span className="text-3xl inline-block animate-bounce">📍</span>
            <h5 className="text-sm font-black text-slate-100 uppercase tracking-wider">Sin ubicación geográfica disponible</h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              El expediente actual no cuenta con coordenadas GPS reales. El mapa interactivo se encuentra inhabilitado hasta que se carguen imágenes georreferenciadas o se defina un polígono de interés.
            </p>
          </div>
        </div>
      )}

      {/* Floating Toolbar to toggle sub-modalities for corridors and polygons */}
      {(geometryType === "lineal" || geometryType === "poligono" || geometryType === "corredor") && (
        <div className="absolute top-3 left-3 z-[10] bg-slate-950/95 border border-slate-800 p-2.5 rounded-xl shadow-2xl flex gap-2 font-sans">
          <button
            type="button"
            onClick={() => setSubMode("vertex")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition active:scale-95 ${subMode === "vertex" ? "bg-rose-650 text-white shadow-lg" : "bg-slate-900 text-slate-400 hover:text-white"}`}
          >
            📏 Modalidad 1: Ampliar {geometryType === "lineal" || geometryType === "corredor" ? "Corredor" : "Polígono"}
          </button>
          <button
            type="button"
            onClick={() => setSubMode("poi")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition active:scale-95 ${subMode === "poi" ? "bg-cyan-650 text-white shadow-lg" : "bg-slate-900 text-slate-400 hover:text-white"}`}
          >
            📍 Modalidad 2: POI / Evidencia
          </button>
        </div>
      )}

      {/* Floating Layer Controls Widget */}
      <div className="absolute top-3 right-3 z-[10] bg-slate-950/90 border border-slate-800 p-3 rounded-xl shadow-2xl backdrop-blur-md font-sans text-xs flex flex-col gap-2 min-w-[200px]">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-800/80 pb-1.5 flex items-center gap-1.5">
          <span>🛡️</span> CAPAS DE INTELIGENCIA
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-900/40 p-1 rounded transition select-none">
          <input
            type="checkbox"
            checked={showPhotos}
            onChange={(e) => setShowPhotos(e.target.checked)}
            className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
          />
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
            <span className="text-cyan-400">📷</span> Evidencia fotográfica
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-900/40 p-1 rounded transition select-none">
          <input
            type="checkbox"
            checked={showOsint}
            onChange={(e) => setShowOsint(e.target.checked)}
            className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
          />
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
            <span className="text-emerald-400">🔎</span> Barridos OSINT
          </span>
        </label>

        {showOsint && (
          <div className="pl-5 -mt-1 mb-1">
            <select
              value={osintProviderFilter}
              onChange={(e) => setOsintProviderFilter(e.target.value as any)}
              className="w-full bg-slate-900 text-slate-200 border border-slate-750 text-[10px] font-semibold rounded px-2 py-1 outline-none focus:border-emerald-500"
            >
              <option value="ALL">🌐 Todos los Proveedores</option>
              <option value="TELEGRAM">💬 Telegram OSINT</option>
              <option value="INEGI">📊 INEGI (DENUE/SCINCE)</option>
              <option value="GOOGLE">📍 Google Places</option>
              <option value="SOCIAL">📲 Redes (X, FB, IG)</option>
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-900/40 p-1 rounded transition select-none">
          <input
            type="checkbox"
            checked={showGeoint}
            onChange={(e) => setShowGeoint(e.target.checked)}
            className="rounded border-slate-800 bg-slate-950 text-orange-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
          />
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
            <span className="text-orange-400">🌐</span> Inteligencia GEOINT
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-900/40 p-1 rounded transition select-none">
          <input
            type="checkbox"
            checked={showAreas}
            onChange={(e) => setShowAreas(e.target.checked)}
            className="rounded border-slate-800 bg-slate-950 text-purple-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
          />
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
            <span className="text-purple-400">⭕</span> Áreas analíticas
          </span>
        </label>

        {/* CONTROLES AVANZADOS ENHANCEMENT GEOINT v1.0 */}
        <div className="pt-1 border-t border-slate-800/80 flex flex-col gap-1.5">
          <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-900/40 p-1 rounded transition select-none">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
              className="rounded border-slate-800 bg-slate-950 text-rose-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
              <span className="text-rose-400">🔥</span> Heatmap Analítico
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-900/40 p-1 rounded transition select-none">
            <input
              type="checkbox"
              checked={showPovCones}
              onChange={(e) => setShowPovCones(e.target.checked)}
              className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
              <span className="text-amber-400">📐</span> Conos POV Street View
            </span>
          </label>
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={15}
        options={mapOptions}
        onClick={handleMapClick}
      >
        {/* Renderizado de Capa de Densidad Analítica de Calor v1.1 (GEO-ENH-01) */}
        {showHeatmap && heatmapDensityClusters.map((density) => (
          <React.Fragment key={`heatmap-cell-${density.id}`}>
            {/* Outer soft halo */}
            <Circle
              center={{ lat: density.lat, lng: density.lng }}
              radius={density.radius}
              options={{
                strokeColor: density.color,
                strokeOpacity: 0.4,
                strokeWeight: 1,
                fillColor: density.color,
                fillOpacity: density.opacity * 0.45,
                clickable: false,
                zIndex: 1,
              }}
            />
            {/* Inner hot core */}
            <Circle
              center={{ lat: density.lat, lng: density.lng }}
              radius={density.innerRadius}
              options={{
                strokeColor: density.color,
                strokeOpacity: 0.8,
                strokeWeight: 1.5,
                fillColor: density.color,
                fillOpacity: density.opacity,
                clickable: false,
                zIndex: 2,
              }}
            />
          </React.Fragment>
        ))}

        {/* Renderizado de Conos de Visión POV Street View (GEO-ENH-02) */}
        {showPovCones && povConePaths.map((cone) => (
          <Polygon
            key={`pov-cone-${cone.id}`}
            paths={cone.path}
            options={{
              strokeColor: "#f59e0b",
              strokeOpacity: 0.85,
              strokeWeight: 1.5,
              fillColor: "#f59e0b",
              fillOpacity: 0.25,
              zIndex: 5,
            }}
          />
        ))}

        {/* Draw circle for individual type projects (Controlled by showAreas) */}
        {showAreas && geometryType === "individual" && project?.latitude && project?.longitude && !isFallback && (
          <Circle
            center={{ lat: project.latitude, lng: project.longitude }}
            radius={Number(project.radius || 500)}
            options={{
              strokeColor: "#38bdf8",
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: "#0284c7",
              fillOpacity: 0.15,
            }}
          />
        )}

        {/* Draw polyline for lineal (corridor) type projects (Controlled by showAreas) */}
        {showAreas && (geometryType === "lineal" || geometryType === "corredor") && geoShapePath.length > 1 && (
          <Polyline
            path={geoShapePath}
            options={{
              strokeColor: "#f43f5e",
              strokeOpacity: 0.9,
              strokeWeight: 4,
            }}
          />
        )}

        {/* Draw polygon for shape area type projects (Controlled by showAreas) */}
        {showAreas && geometryType === "poligono" && geoShapePath.length > 2 && (
          <Polygon
            paths={geoShapePath}
            options={{
              strokeColor: "#10b981",
              strokeOpacity: 0.8,
              strokeWeight: 3,
              fillColor: "#10b981",
              fillOpacity: 0.15,
            }}
          />
        )}

        {/* Georeferenced Evidence markers */}
        {showPhotos && markersWithDispersion.map((photo) => {
          const isPoi = photo.isIndependentPoi || photo.tipo === "POI" || photo.tipo === "Punto Independiente";
          if (photo.tipo?.startsWith("Barrido")) return null; // Los barridos se manejan por separado en showOsint
          if (isPoi && !showGeoint) return null; // Las POIs se controlan mediante Inteligencia GEOINT
          if (!isPoi && !showPhotos) return null; // Las fotos normales se controlan mediante Evidencia fotográfica

          return (
            <Marker
              key={photo.id}
              position={{ lat: Number(photo.displayLat), lng: Number(photo.displayLng) }}
              onClick={() => setHoveredPhoto(photo)}
              draggable={true}
              onDragEnd={async (e) => {
                if (e.latLng && onMoveMarker) {
                  const lat = e.latLng.lat();
                  const lng = e.latLng.lng();
                  if (isPoi) {
                    const confirmMove = window.confirm("¿Desea mover esta evidencia/POI a la nueva ubicación?");
                    if (confirmMove) {
                      await onMoveMarker(photo.id, lat, lng);
                    }
                  } else {
                    const choice = window.prompt(
                      "Ha desplazado un vértice del trazado. Seleccione una opción:\n" +
                      "1 - Reemplazar la ubicación de la frontera/vértice existente (Mover punto)\n" +
                      "2 - Agregar como nuevo punto al corredor/polígono (Conservar el original)",
                      "1"
                    );
                    if (onCandidateCapture) {
                      onCandidateCapture(lat, lng, {
                        geometryType: geometryType === "lineal" || geometryType === "corredor" ? "LINE" : "POLYGON",
                        captureContext: "vertex_edit",
                        previousPhotoId: photo.id
                      });
                    }
                    if (choice === "1") {
                      await onMoveMarker(photo.id, lat, lng);
                    } else if (choice === "2" && onAddPoint) {
                      await onAddPoint(lat, lng, {
                        name: "Nuevo vértice de trazado",
                        isIndependentPoi: false,
                        isVertex: true
                      });
                    }
                  }
                }
              }}
              icon={{
                path: 0, // circle
                fillColor: isPoi ? "#c084fc" : "#22d3ee",
                fillOpacity: 0.9,
                strokeWeight: 2,
                strokeColor: "#ffffff",
                scale: isPoi ? 8 : 6,
              }}
            />
          );
        })}

        {/* OSINT Sweeps Clusterized Rendering */}
        {showOsint && osintClusters.map((cluster, idx) => {
          if (cluster.type === "SUPER") {
            return (
              <Marker
                key={`osint-super-${idx}`}
                position={{ lat: cluster.lat, lng: cluster.lng }}
                title={`Súper-cluster: ${cluster.count} Barridos OSINT`}
                label={{
                  text: `◉ ${cluster.count}`,
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "bold"
                }}
                icon={{
                  path: 0, // Circle
                  scale: 18,
                  fillColor: "#10b981", // Verde esmeralda
                  fillOpacity: 0.9,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                }}
                onClick={() => setSelectedOsintGroup(cluster)}
              />
            );
          }

          if (cluster.type === "GROUP") {
            return (
              <Marker
                key={`osint-group-${idx}`}
                position={{ lat: cluster.lat, lng: cluster.lng }}
                title={`Grupo: ${cluster.count} Barridos OSINT`}
                label={{
                  text: `${cluster.count}`,
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: "bold"
                }}
                icon={{
                  path: 0, // Circle
                  scale: 13,
                  fillColor: "#059669",
                  fillOpacity: 0.85,
                  strokeColor: "#ffffff",
                  strokeWeight: 1.5,
                }}
                onClick={() => setSelectedOsintGroup(cluster)}
              />
            );
          }

          // Single OSINT sweep with coordinates
          const sweep = cluster.sweeps[0];
          return (
            <Marker
              key={`osint-single-${idx}`}
              position={{ lat: cluster.lat, lng: cluster.lng }}
              title={`${sweep.engine} - ${sweep.status}`}
              icon={{
                path: 0, // Circle
                scale: 8,
                fillColor: "#10b981",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 1.5,
              }}
              onClick={() => setSelectedOsintSingle(sweep)}
            />
          );
        })}

        {/* OSINT Sweeps Circular Areas of Influence (Sweeps without explicit coordinates) */}
        {showOsint && sweepsWithoutCoords.map((s, idx) => (
          <Circle
            key={`osint-area-influence-${idx}`}
            center={center}
            radius={250}
            options={{
              fillColor: "#a855f7",
              fillOpacity: 0.12,
              strokeColor: "#a855f7",
              strokeOpacity: 0.4,
              strokeWeight: 1.5,
              clickable: true,
            }}
            onClick={() => setSelectedOsintSingle(s)}
          />
        ))}

        {/* OSINT InfoWindows */}
        {selectedOsintSingle && (
          <InfoWindow
            position={
              selectedOsintSingle.coordsInfo?.hasCoordinates
                ? { lat: selectedOsintSingle.coordsInfo.lat!, lng: selectedOsintSingle.coordsInfo.lng! }
                : center
            }
            onCloseClick={() => setSelectedOsintSingle(null)}
          >
            <div className="p-3 text-slate-800 font-sans max-w-[280px]">
              <div className="font-bold border-b pb-1 mb-1.5 text-slate-900 flex items-center gap-1">
                <span>🔎</span> {selectedOsintSingle.engine || "BARRIDO OSINT"}
              </div>
              <div className="text-xs space-y-1">
                <p><span className="font-semibold text-slate-600">Estado:</span> {selectedOsintSingle.status}</p>
                {selectedOsintSingle.description && (
                  <p><span className="font-semibold text-slate-600">Descripción:</span> {selectedOsintSingle.description}</p>
                )}
                {selectedOsintSingle.coordsInfo?.hasCoordinates ? (
                  <p><span className="font-semibold text-slate-600">Posición:</span> {selectedOsintSingle.coordsInfo.lat?.toFixed(5)}, {selectedOsintSingle.coordsInfo.lng?.toFixed(5)}</p>
                ) : (
                  <p className="text-[10px] text-purple-600 italic">⚠️ Representación de área de influencia (250m)</p>
                )}
              </div>
            </div>
          </InfoWindow>
        )}

        {selectedOsintGroup && (
          <InfoWindow
            position={{ lat: selectedOsintGroup.lat, lng: selectedOsintGroup.lng }}
            onCloseClick={() => setSelectedOsintGroup(null)}
          >
            <div className="p-3 text-slate-800 font-sans max-w-[300px] max-h-[220px] overflow-y-auto">
              <div className="font-bold border-b pb-1 mb-1.5 text-slate-900 flex items-center gap-1">
                <span>📂</span> {selectedOsintGroup.count} Barridos Concentrados
              </div>
              <div className="space-y-2 text-xs">
                {selectedOsintGroup.sweeps.map((s: any, idx: number) => (
                  <div key={idx} className="border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                    <p className="font-bold text-slate-700">{s.engine}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{s.description || "Sin descripción."}</p>
                  </div>
                ))}
              </div>
            </div>
          </InfoWindow>
        )}

        {/* Hover info window containing the preview and full metadata of the georeferenced evidence */}
        {hoveredPhoto && hoveredPhoto.lat != null && hoveredPhoto.lng != null && (
          <InfoWindow
            position={{ lat: Number(hoveredPhoto.displayLat ?? hoveredPhoto.lat), lng: Number(hoveredPhoto.displayLng ?? hoveredPhoto.lng) }}
            options={{
              pixelOffset: new window.google.maps.Size(0, -35),
            }}
            onCloseClick={() => setHoveredPhoto(null)}
          >
            <div className="bg-slate-950/95 text-slate-200 p-4 rounded-xl border border-slate-800 shadow-2xl flex flex-col gap-2.5 w-72 pointer-events-none font-sans text-xs">
              <img
                src={hoveredPhoto.previewUrl || "/no-image.png"}
                alt={hoveredPhoto.tipo || "Evidencia"}
                className="w-full h-36 object-cover rounded-lg border border-slate-800 bg-slate-900"
              />
              <div className="w-full space-y-1.5">
                <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                  <span className="font-black text-cyan-400 uppercase tracking-wide">
                    {hoveredPhoto.evidenceId || `EVI-${hoveredPhoto.id.slice(0, 6).toUpperCase()}`}
                  </span>
                  <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full ${hoveredPhoto.validado ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-amber-950 text-amber-400 border border-amber-800"}`}>
                    {hoveredPhoto.validado ? "VALIDADA" : "PENDIENTE"}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400">
                  <div><span className="text-slate-500 font-bold">Tipo:</span> {hoveredPhoto.tipo || "Fotografía"}</div>
                  <div><span className="text-slate-500 font-bold">Fuente:</span> {hoveredPhoto.gpsSource || "Analista"}</div>
                  <div><span className="text-slate-500 font-bold">Fecha:</span> {hoveredPhoto.contextualizedAt ? new Date(hoveredPhoto.contextualizedAt).toLocaleDateString("es-MX") : "N/D"}</div>
                  <div><span className="text-slate-500 font-bold">Usuario:</span> {hoveredPhoto.contextualizedBy || "Analista CEIPOL"}</div>
                  <div className="col-span-2"><span className="text-slate-500 font-bold">Coordenadas:</span> {Number(hoveredPhoto.lat).toFixed(5)}, {Number(hoveredPhoto.lng).toFixed(5)}</div>
                  <div className="col-span-2"><span className="text-slate-500 font-bold">Confianza:</span> {hoveredPhoto.gpsAccuracy ? `${hoveredPhoto.gpsAccuracy}m` : "Alto"}</div>
                  <div className="col-span-2"><span className="text-slate-500 font-bold">Relación Hipótesis:</span> Factor ambiental y delictivo</div>
                </div>

                {hoveredPhoto.comentario && (
                  <p className="text-[10px] text-slate-300 leading-normal border-t border-slate-900 pt-1.5 italic">
                    "{hoveredPhoto.comentario}"
                  </p>
                )}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}