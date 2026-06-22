"use client";

import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { GoogleMap, Marker, Polyline, Polygon, useJsApiLoader, InfoWindow } from "@react-google-maps/api";
import AnalysisPanel from "./AnalysisPanel";
// @ts-ignore
import Supercluster from 'supercluster';
import StatisticsDashboard from './StaticsDashboard';
import CorrelationPanel from './CorrelationPanel';
import TimelinePanel from './TimelinePanel';
import MultimodalPanel from './MultimodalPanel';
import ExecutiveDashboard from './ExecutiveDashboard';
import RoleGuard from './RoleGuard';
import { useProject } from "@/context/ProjectContext";
import { usePermissions } from '../hooks/usePermissions';
import AuditPanel from './AuditPanel';
import { createAuditLog, appendAuditLog } from '../utils/auditLogger';
import OperationalTimeline
  from './OperationalTimeline';
import MultiUserPanel
  from './MultiUserPanel';
import PredictivePanel
  from './PredictivePanel';
import { OsintTerritorialPanel } from './OsintTerritorialPanel';
import ThreatMapOverlay
  from './ThreatMapOverlay';
import {
  createSession,
  appendSessionAction,
} from '../utils/sessionTracker';
import {
  HeatmapLayer,
} from '@react-google-maps/api';

type ProjectMapProps = {
  geometryType: "individual" | "lineal" | "poligono";
  coordinates: { lat: number; lng: number }[];
  onUpdateCoordinates?: (coords: { lat: number; lng: number }[]) => void;
  album?: { id: string; lat: number | null; lng: number | null; tipo?: string }[];
  project?: any;
  projects?: any[];
};

const containerStyle = {
  width: "100%",
  height: "60vh",
  minHeight: "500px",
};

const MAP_LIBRARIES: ("places" | "visualization" | "drawing")[] = ["places", "visualization", "drawing"];

// Algoritmos de validación espacial de contención geográfica
const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; 
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const isPointInPolygon = (point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean => {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > point.lat) !== (yj > point.lat))
        && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const isPointInRadius = (point: { lat: number; lng: number }, center: { lat: number; lng: number }, radiusMeters: number): boolean => {
  const dist = getDistanceInMeters(center.lat, center.lng, point.lat, point.lng);
  return dist <= radiusMeters;
};

const getDistanceToSegment = (p: { lat: number; lng: number }, p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number => {
  const x = p.lng;
  const y = p.lat;
  const x1 = p1.lng;
  const y1 = p1.lat;
  const x2 = p2.lng;
  const y2 = p2.lat;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return getDistanceInMeters(y, x, y1, x1);
  }

  let t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const projLat = y1 + t * dy;
  const projLng = x1 + t * dx;

  return getDistanceInMeters(y, x, projLat, projLng);
};

const isPointNearLine = (point: { lat: number; lng: number }, line: { lat: number; lng: number }[], maxDistanceMeters: number): boolean => {
  if (line.length === 0) return false;
  if (line.length === 1) {
    return getDistanceInMeters(line[0].lat, line[0].lng, point.lat, point.lng) <= maxDistanceMeters;
  }
  for (let i = 0; i < line.length - 1; i++) {
    const dist = getDistanceToSegment(point, line[i], line[i+1]);
    if (dist <= maxDistanceMeters) return true;
  }
  return false;
};

const getMarkerColor = (tipo?: string) => {
  switch (tipo) {
    case "Nodo Inicial": return "#10b981"; // Verde Esmeralda
    case "Nodo Final": return "#ef4444"; // Rojo
    case "Corredor": return "#3b82f6"; // Azul
    case "Perímetro": return "#8b5cf6"; // Morado
    case "Interior": return "#f97316"; // Naranja
    default: return "#dc2626"; // Rojo estándar
  }
};

export function ProjectMap({ geometryType, coordinates, onUpdateCoordinates, album, project, projects = [] }: ProjectMapProps) {
  const mapRef = useRef<any | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showAtlasRiesgos, setShowAtlasRiesgos] = useState(false);
  const { analysisResult } = useProject();

  const userRole = project?.userRole || 'USER';
  const permissions = usePermissions(userRole);

  const [session] =
    React.useState(() =>
      createSession(
        project?.username || 'Usuario',
        userRole,
        'ProjectMap'
      )
    );

  const [osintResults,
    setOsintResults] =
      React.useState<any>(null);

  const [showOsintMarkers, setShowOsintMarkers] = useState(true);
  const [showOsintRoutes, setShowOsintRoutes] = useState(true);
  const [selectedOsintEvent, setSelectedOsintEvent] = useState<any>(null);

  useEffect(() => {
    if (!project) return;

    if (!project.auditLogs) {
      const initialLog = createAuditLog(
        'Proyecto visualizado',
        userRole,
        project?.username || 'Usuario',
        'Acceso al módulo ProjectMap'
      );
      appendAuditLog(project, initialLog);
    }
  }, [project, userRole]);

  React.useEffect(() => {

    appendSessionAction(
      session,
      'Acceso al mapa criminológico'
    );

  }, [session]);

  // Centro dinámico priorizando geometrías de interés activas para evitar fallbacks estáticos en Aguascalientes Centro
  const center = useMemo(() => {
    const activeCoords: { lat: number; lng: number }[] = [];
    
    if (coordinates && coordinates.length > 0) {
      coordinates.forEach(c => activeCoords.push({ lat: c.lat, lng: c.lng }));
    } else if (album && album.length > 0) {
      album.forEach(p => {
        if (p.lat != null && p.lng != null) {
          activeCoords.push({ lat: p.lat, lng: p.lng });
        }
      });
    } else if (project?.iaAnalysis && project.iaAnalysis.length > 0) {
      project.iaAnalysis.forEach((item: any) => {
        if (item.latitude && item.longitude) {
          activeCoords.push({ lat: item.latitude, lng: item.longitude });
        }
      });
    }

    if (activeCoords.length === 0) {
      return { lat: 21.8853, lng: -102.2916 }; //Fallback absoluto si no existe ninguna geometría
    }

    const lat = activeCoords.reduce((sum, c) => sum + c.lat, 0) / activeCoords.length;
    const lng = activeCoords.reduce((sum, c) => sum + c.lng, 0) / activeCoords.length;
    return { lat, lng };
  }, [coordinates, album, project?.iaAnalysis]);

  // Filtro espacial estricto para asegurar pertenencia a la geografía seleccionada por el usuario
  const isPointInActiveGeography = useCallback((point: { lat: number; lng: number }): boolean => {
    if (coordinates.length === 0) return true;

    if (geometryType === "poligono" && coordinates.length >= 3) {
      return isPointInPolygon(point, coordinates);
    }

    if (geometryType === "lineal" && coordinates.length >= 1) {
      return isPointNearLine(point, coordinates, 500); // 500 metros de margen
    }

    if (geometryType === "individual" || coordinates.length === 1) {
      const centerPt = coordinates[0];
      return isPointInRadius(point, centerPt, 500); // 500m de radio
    }

    return true;
  }, [geometryType, coordinates]);

  const [realDuctos, setRealDuctos] = useState<any[][]>([]);
  const [realWater, setRealWater] = useState<any[][]>([]);
  const [realHazards, setRealHazards] = useState<any[][]>([]);

  useEffect(() => {
    if (!center || !showAtlasRiesgos) return;
    const radius = 2000;
    const q = `[out:json][timeout:15];
    (
      way"man_made"="pipeline";
      way"power"="line";
      way"natural"="water";
      way"waterway"~"river|stream|canal";
      way"amenity"="fuel";
      node"amenity"="fuel";
    );
    out geom tags;`;
    
    fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: q })
      .then(res => res.json())
      .then(data => {
          const ductos: any[][] = []; const water: any[][] = []; const hazards: any[] = [];
          data.elements.forEach((e: any) => {
            if (e.tags?.man_made === "pipeline" || e.tags?.power === "line") { if (e.geometry) ductos.push(e.geometry.map((pt: any) => ({ lat: pt.lat, lng: pt.lon }))); }
            else if (e.tags?.natural === "water" || e.tags?.waterway) { if (e.geometry) water.push(e.geometry.map((pt: any) => ({ lat: pt.lat, lng: pt.lon }))); }
            else if (e.tags?.amenity === "fuel") { if (e.geometry) hazards.push(e.geometry.map((pt: any) => ({ lat: pt.lat, lng: pt.lon }))); else if (e.lat && e.lon) hazards.push([{ lat: e.lat, lng: e.lon }]); }
          });
          setRealDuctos(ductos); setRealWater(water); setRealHazards(hazards);
      })
      .catch(err => console.error("Overpass map error", err));
  }, [center, showAtlasRiesgos]);

  // Combinación y recorte geoespacial (clipping) de datos tácticos del Atlas de Riesgos para que permanezcan dentro de la geografía activa
  const atlasData = useMemo(() => {
    if (!center) return null;
    return {
      // Recorte geoespacial de polilíneas y polígonos del Atlas de Riesgos
      ductos: realDuctos.map(path => path.filter(pt => isPointInActiveGeography(pt))).filter(path => path.length >= 2),
      water: realWater.map(path => path.filter(pt => isPointInActiveGeography(pt))).filter(path => path.length >= 3),
      hazards: realHazards.map(path => path.filter(pt => isPointInActiveGeography(pt))).filter(path => path.length >= 1),
      falla: [
        { lat: center.lat - 0.004, lng: center.lng + 0.004 },
        { lat: center.lat - 0.001, lng: center.lng + 0.007 },
        { lat: center.lat - 0.005, lng: center.lng + 0.010 },
        { lat: center.lat - 0.007, lng: center.lng + 0.005 },
      ].filter(pt => isPointInActiveGeography(pt))
    };
  }, [center, realDuctos, realWater, realHazards, isPointInActiveGeography]);

  const onMapLoad = useCallback((map: any) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady || typeof window === "undefined" || !(window as any).google || coordinates.length === 0) return;
    const g = (window as any).google;
    const bounds = new g.maps.LatLngBounds();
    coordinates.forEach((pt) => bounds.extend(new g.maps.LatLng(pt.lat, pt.lng)));
    if (coordinates.length > 1) {
      mapRef.current.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
    } else if (coordinates.length === 1) {
      mapRef.current.setCenter(coordinates[0]);
      mapRef.current.setZoom(15);
    }
  }, [mapReady, coordinates]);

  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc") : "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc"; // HARDCODED TEMPORAL PARA VERCEL
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: MAP_LIBRARIES,
  });

  const handleMarkerDrag = (index: number, lat: number, lng: number) => {
    const newCoords = [...coordinates];
    newCoords[index] = { lat, lng };
    if (onUpdateCoordinates) onUpdateCoordinates(newCoords);
  };

  const heatmapData = useMemo(() => {
    if (!isLoaded || typeof window === "undefined" || !(window as any).google) return [];
    
    // 1. Puntos de fotos in situ
    const photoPoints = project?.iaAnalysis
      ?.filter(
        (item: any) =>
          item.latitude &&
          item.longitude &&
          isPointInActiveGeography({ lat: item.latitude, lng: item.longitude })
      )
      .map((item: any) => {
        let weight = 1;
        if (item.riskLevel === 'high' || item.riskLevel === 'alto') {
          weight = 5;
        } else if (item.riskLevel === 'medium' || item.riskLevel === 'medio') {
          weight = 3;
        }
        return {
          location: new (window as any).google.maps.LatLng(item.latitude, item.longitude),
          weight,
        };
      }) || [];

    // 2. Puntos del barrido OSINT Territorial v2.0
    const osintPoints: any[] = [];
    if (osintResults?.normalizedEvents) {
      osintResults.normalizedEvents.forEach((evt: any) => {
        if (evt.location && evt.location.coordinates) {
          const [lng, lat] = evt.location.coordinates;
          if (isPointInActiveGeography({ lat, lng })) {
            let weight = 2;
            if (evt.risk_level === "Crítico") weight = 8;
            else if (evt.risk_level === "Alto") weight = 5;
            else if (evt.risk_level === "Medio") weight = 3;

            osintPoints.push({
              location: new (window as any).google.maps.LatLng(lat, lng),
              weight,
            });
          }
        }
      });
    }

    return [...photoPoints, ...osintPoints];
  }, [isLoaded, project?.iaAnalysis, osintResults, isPointInActiveGeography]);

  const clusterPoints = useMemo(() => {
    return project?.iaAnalysis
      ?.filter(
        (item: any) =>
          item.latitude &&
          item.longitude &&
          isPointInActiveGeography({ lat: item.latitude, lng: item.longitude })
      )
      .map((item: any) => ({
        type: 'Feature',
        properties: {
          riskLevel: item.riskLevel,
        },
        geometry: {
          type: 'Point',
          coordinates: [
            item.longitude,
            item.latitude,
          ],
        },
      })) || [];
  }, [project?.iaAnalysis, isPointInActiveGeography]);

  const supercluster = new Supercluster({
    radius: 60,
    maxZoom: 20,
  });

  supercluster.load(clusterPoints as any);

  const clusters = supercluster.getClusters(
    [-180, -85, 180, 85],
    10
  );

  // Validación mínima de fotos según geometría
  const minValidMessage = () => {
    if (geometryType === "individual" && coordinates.length < 1) return "Debe agregar al menos 1 foto";
    if (geometryType === "lineal" && coordinates.length < 2) return "Debe agregar al menos 2 fotos";
    if (geometryType === "poligono" && coordinates.length < 3) return "Debe agregar al menos 3 fotos";
    return null;
  };

  const validationMsg = minValidMessage();

  return (
    <div className="flex flex-col gap-4 mt-4">
      {!apiKey ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-amber-400">
          <p className="font-semibold">Mapa no disponible</p>
          <p className="mt-1">Falta la clave de Google Maps.</p>
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-red-400">
          <p className="font-semibold">Error al cargar el mapa</p>
          <p className="mt-1">Google Maps está bloqueando la API Key. Debe permitir el dominio en Google Cloud Console.</p>
        </div>
      ) : !isLoaded ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400 min-h-[200px] flex items-center justify-center">
          Cargando mapa de Google…
        </div>
      ) : (
        <>
          {heatmapData.length > 0 && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowAtlasRiesgos(!showAtlasRiesgos)}
            className={`${showAtlasRiesgos ? 'bg-amber-600 hover:bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'} text-white px-3 py-2 rounded text-xs transition-colors shadow-sm font-semibold border ${showAtlasRiesgos ? 'border-amber-400' : 'border-slate-500'}`}
          >
            {showAtlasRiesgos ? '⚠️ Ocultar Atlas de Riesgos' : '🗺️ Atlas de Riesgos (CENAPRED)'}
          </button>
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-xs transition-colors shadow-sm"
          >
            {showHeatmap ? 'Ocultar Heatmap' : 'Mostrar Heatmap'}
          </button>
          <button
            type="button"
            onClick={() => setShowClusters(!showClusters)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded text-xs transition-colors shadow-sm"
          >
            {showClusters ? 'Ocultar Clusters' : 'Mostrar Clusters'}
          </button>
        </div>
      )}

      <div id="project-map-capture" className="relative rounded-xl border-2 border-slate-700 shadow-xl overflow-hidden bg-slate-900/50 map-container">
        {/* LEYENDA DEL ATLAS DE RIESGOS */}
        {showAtlasRiesgos && (
          <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-700 p-3 rounded-lg shadow-xl z-20 pointer-events-none">
            <h4 className="text-xs font-bold text-slate-200 mb-2 uppercase tracking-wider">Atlas Nacional de Riesgos</h4>
            <div className="flex flex-col gap-2 text-[10px] text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-amber-500 rounded"></span> Infraestructura Crítica (PEMEX/CFE)
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-blue-500/40 border border-blue-700 rounded"></span> Cuerpos de Agua / Inundables
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-purple-600/50 border border-purple-700 rounded"></span> Peligro Químico (Gasolineras/Industrial)
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-red-500/30 border border-red-700 rounded"></span> Falla Geológica / Hundimiento
              </div>
            </div>
          </div>
        )}

        {/* Sello de agua oficial */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden" data-html2canvas-ignore="true">
          <span className="text-white/40 font-bold text-4xl sm:text-6xl -rotate-45 select-none tracking-widest drop-shadow-lg">
            SSPE-CEIPOL
          </span>
        </div>
        <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={15}
        onLoad={onMapLoad}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          mapTypeId: "hybrid",
        }}
      >
        {coordinates.map((c, idx) => {
          const photo = album?.[idx];
          const pinColor = getMarkerColor(photo?.tipo);

          return (
            <Marker
              key={photo ? photo.id : `coord-${idx}`}
              position={c}
              draggable
              onDragEnd={(e) => handleMarkerDrag(idx, e.latLng!.lat(), e.latLng!.lng())}
              icon={{
                path: 0 as any, // CIRCLE
                scale: 10,
                fillColor: pinColor,
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              }}
            />
          );
        })}

        {geometryType === "lineal" && coordinates.length > 1 && (
          <Polyline
            path={coordinates}
            options={{
              strokeColor: "#3b82f6",
              strokeOpacity: 0.9,
              strokeWeight: 6,
            }}
          />
        )}

        {geometryType === "poligono" && coordinates.length > 2 && (
          <Polygon
            paths={coordinates}
            options={{
              strokeColor: "#8b5cf6",
              strokeOpacity: 0.8,
              strokeWeight: 4,
              fillColor: "#8b5cf6",
              fillOpacity: 0.4,
            }}
          />
        )}

        {/* CAPAS GEOGRÁFICAS DEL ATLAS DE RIESGO */}
        {showAtlasRiesgos && atlasData && (
          <>
            {atlasData.ductos.map((ductoPath, idx) => (
              <Polyline
                key={`ducto-${idx}`}
                path={ductoPath}
                options={{ strokeColor: "#f59e0b", strokeOpacity: 0.9, strokeWeight: 5, zIndex: 50 }}
              />
            ))}
            {atlasData.water.map((waterPath, idx) => (
              waterPath.length >= 3 ? (
                <Polygon
                  key={`water-${idx}`}
                  paths={waterPath}
                  options={{ fillColor: "#3b82f6", fillOpacity: 0.4, strokeColor: "#2563eb", strokeWeight: 2, zIndex: 30 }}
                />
              ) : null
            ))}
            {atlasData.hazards.map((hazardPath, idx) => (
              hazardPath.length >= 3 ? (
                <Polygon
                  key={`hazard-${idx}`}
                  paths={hazardPath}
                  options={{ fillColor: "#9333ea", fillOpacity: 0.5, strokeColor: "#7e22ce", strokeWeight: 2, zIndex: 45 }}
                />
              ) : hazardPath.length === 1 ? (
                <Marker
                  key={`hazard-node-${idx}`}
                  position={hazardPath[0]}
                  icon={{ path: 0 as any, scale: 6, fillColor: "#9333ea", fillOpacity: 0.8, strokeColor: "#ffffff", strokeWeight: 1 }}
                />
              ) : null
            ))}
            {atlasData.falla.length >= 3 && (
              <Polygon
                paths={atlasData.falla}
                options={{ fillColor: "#ef4444", fillOpacity: 0.3, strokeColor: "#b91c1c", strokeWeight: 2, zIndex: 40 }}
              />
            )}
          </>
        )}

        {showHeatmap && heatmapData.length > 0 && (
          <HeatmapLayer 
            data={heatmapData} 
            options={{ 
              radius: 40,
              opacity: 0.7 
            }} 
          />
        )}

        {showClusters && clusters.map((cluster: any, index: number) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const isCluster = cluster.properties.cluster;

          if (isCluster) {
            return (
              <Marker
                key={`cluster-${index}`}
                position={{
                  lat: latitude,
                  lng: longitude,
                }}
                label={{
                  text: String(cluster.properties.point_count),
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
                icon={{
                  path: 0 as any,
                  fillColor: '#dc2626',
                  fillOpacity: 0.8,
                  strokeWeight: 1,
                  strokeColor: '#ffffff',
                  scale: Math.max(20, cluster.properties.point_count / 2),
                }}
              />
            );
          }

          return null;
        })}

        {/* RUTAS DE RIESGO SUGERIDAS POR OSINT TERRITORIAL V2.0 */}
        {showOsintRoutes && osintResults?.territorialIntelligence?.riskRoutes?.map((route: any, rIdx: number) => {
          const strokeColor = route.riskLevel === "Crítico" ? "#dc2626" : route.riskLevel === "Alto" ? "#f97316" : "#eab308";
          const path = route.points.map((p: [number, number]) => ({ lat: p[0], lng: p[1] }));
          return (
            <Polyline
              key={`osint-route-${rIdx}`}
              path={path}
              options={{
                strokeColor: strokeColor,
                strokeOpacity: 0.8,
                strokeWeight: 5,
                zIndex: 60,
              }}
            />
          );
        })}

        {/* MARCADORES DE EVENTOS OSINT TERRITORIAL V2.0 */}
        {showOsintMarkers && osintResults?.normalizedEvents?.map((evt: any) => {
          if (!evt.location || !evt.location.coordinates) return null;
          const [lng, lat] = evt.location.coordinates;
          
          const markerColor = 
            evt.risk_level === "Crítico" ? "#991b1b" : 
            evt.risk_level === "Alto" ? "#ea580c" : 
            evt.risk_level === "Medio" ? "#eab308" : "#16a34a";
          
          return (
            <Marker
              key={`osint-marker-${evt.id}`}
              position={{ lat, lng }}
              onClick={() => setSelectedOsintEvent(evt)}
              icon={{
                path: 0 as any,
                scale: 7,
                fillColor: markerColor,
                fillOpacity: 0.9,
                strokeColor: "#ffffff",
                strokeWeight: 1.5,
              }}
            />
          );
        })}

        {/* INFO WINDOW PARA EVENTO SELECCIONADO */}
        {selectedOsintEvent && (() => {
          const [lng, lat] = selectedOsintEvent.location.coordinates;
          return (
            <InfoWindow
              position={{ lat, lng }}
              onCloseClick={() => setSelectedOsintEvent(null)}
            >
              <div className="p-2 text-slate-800 max-w-[280px]">
                <div className="flex justify-between items-center gap-2 mb-1">
                  <span className="font-extrabold text-[10px] uppercase text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">
                    {selectedOsintEvent.platform}
                  </span>
                  <span className="font-black text-[10px] text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-100">
                    Riesgo: {selectedOsintEvent.risk_level} ({selectedOsintEvent.risk_score}%)
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-900 truncate mb-1">
                  {selectedOsintEvent.source}
                </p>
                <p className="text-[11px] text-slate-600 leading-normal line-clamp-3">
                  {selectedOsintEvent.content}
                </p>
                {selectedOsintEvent.neighborhood && (
                  <p className="text-[10px] text-cyan-700 font-extrabold mt-1.5 uppercase">
                    📍 {selectedOsintEvent.neighborhood}
                  </p>
                )}
              </div>
            </InfoWindow>
          );
        })()}

        <ThreatMapOverlay
          project={project}
          osintResults={osintResults}
        />
      </GoogleMap>

      {validationMsg && (
        <p className="text-xs text-amber-400 mt-2 px-2 pb-2 font-medium">{validationMsg}</p>
      )}
      </div>
        </>
      )}

      <div className="hidden md:block">
        <MultimodalPanel project={project} />
      </div>

      {analysisResult || (project?.iaAnalysis && project.iaAnalysis.length > 0) ? (
        <div className="space-y-4 hidden md:block">
          <StatisticsDashboard iaAnalysis={analysisResult?.perPhotoFindings || project?.iaAnalysis || []} />
          <CorrelationPanel
            currentProject={project}
            allProjects={projects || []}
          />
          <TimelinePanel iaAnalysis={analysisResult?.perPhotoFindings || project?.iaAnalysis || []} />
          <RoleGuard allowed={permissions.canViewExecutiveDashboard}>
            <ExecutiveDashboard projects={projects || []} />
          </RoleGuard>
          <AuditPanel auditLogs={project.auditLogs || []} />
          <AnalysisPanel iaAnalysis={analysisResult?.perPhotoFindings || project?.iaAnalysis || []} project={project} />
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center shadow-inner hidden md:block">
          <span className="text-4xl block mb-3 opacity-50">⏳</span>
          <h4 className="text-lg font-semibold text-slate-300">Paneles Analíticos en Espera</h4>
          <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto">
            Para visualizar el Dashboard Estadístico, el Heatmap de Riesgo y el Panel de Correlaciones, primero debes subir las fotografías requeridas y hacer clic en <strong>&quot;Generar Informe&quot;</strong>.
          </p>
        </div>
      )}

      {project && (
        <div className="space-y-4 hidden md:block">
          <OperationalTimeline
            session={session}
          />
          <MultiUserPanel
            sessions={[session]}
          />
          <PredictivePanel
            project={project}
          />
          <OsintTerritorialPanel
            project={project}
            onUpdateMapResults={(data) => setOsintResults(data)}
            showMapMarkers={showOsintMarkers}
            onToggleMapMarkers={setShowOsintMarkers}
            showMapRoutes={showOsintRoutes}
            onToggleMapRoutes={setShowOsintRoutes}
          />
        </div>
      )}
    </div>
  );
}