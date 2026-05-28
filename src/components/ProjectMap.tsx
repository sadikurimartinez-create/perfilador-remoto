"use client";

import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { GoogleMap, Marker, Polyline, Polygon, useJsApiLoader } from "@react-google-maps/api";
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
import OSINTPanel
  from './OSINTPanel';
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
  const mapRef = useRef<google.maps.Map | null>(null);
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

  const center = useMemo(() => {
    if (coordinates.length === 0) return { lat: 21.88, lng: -102.29 };
    const lat = coordinates.reduce((sum, c) => sum + c.lat, 0) / coordinates.length;
    const lng = coordinates.reduce((sum, c) => sum + c.lng, 0) / coordinates.length;
    return { lat, lng };
  }, [coordinates]);

  // Simulación táctica de datos del Atlas de Riesgos basados en el centro del mapa
  const atlasData = useMemo(() => {
    if (!center) return null;
    return {
      ducto: [
        { lat: center.lat - 0.008, lng: center.lng - 0.012 },
        { lat: center.lat + 0.002, lng: center.lng + 0.001 },
        { lat: center.lat + 0.012, lng: center.lng + 0.008 },
      ],
      falla: [
        { lat: center.lat - 0.004, lng: center.lng + 0.004 },
        { lat: center.lat - 0.001, lng: center.lng + 0.007 },
        { lat: center.lat - 0.005, lng: center.lng + 0.010 },
        { lat: center.lat - 0.007, lng: center.lng + 0.005 },
      ]
    };
  }, [center]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady || typeof window === "undefined" || !(window as any).google || coordinates.length === 0) return;
    const g = (window as any).google as typeof google;
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
    
    return project?.iaAnalysis
      ?.filter(
        (item: any) =>
          item.latitude &&
          item.longitude
      )
      .map((item: any) => {

        let weight = 1;

        if (
          item.riskLevel === 'high' ||
          item.riskLevel === 'alto'
        ) {
          weight = 5;
        } else if (
          item.riskLevel === 'medium' ||
          item.riskLevel === 'medio'
        ) {
          weight = 3;
        }

        return {
          location: new (window as any).google.maps.LatLng(
            item.latitude,
            item.longitude
          ),
          weight,
        };
      }) || [];
  }, [isLoaded, project?.iaAnalysis]);

  const clusterPoints =
    project?.iaAnalysis
      ?.filter(
        (item: any) =>
          item.latitude &&
          item.longitude
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
                <span className="w-4 h-1 bg-amber-500 rounded"></span> Ductos PEMEX (Riesgo Huachicol)
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-red-500/30 border border-red-700 rounded"></span> Falla Geológica / Hundimiento
              </div>
            </div>
          </div>
        )}

        {/* Sello de agua oficial */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden">
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
                path: (window as any).google.maps.SymbolPath.CIRCLE,
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
            <Polyline
              path={atlasData.ducto}
              options={{ strokeColor: "#f59e0b", strokeOpacity: 0.9, strokeWeight: 5, zIndex: 50 }}
            />
            <Polygon
              paths={atlasData.falla}
              options={{ fillColor: "#ef4444", fillOpacity: 0.3, strokeColor: "#b91c1c", strokeWeight: 2, zIndex: 40 }}
            />
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
                  path: google.maps.SymbolPath.CIRCLE,
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
            Para visualizar el Dashboard Estadístico, el Heatmap de Riesgo y el Panel de Correlaciones, primero debes subir las fotografías requeridas y hacer clic en <strong>"Generar Análisis Criminológico"</strong>.
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
          <OSINTPanel
            project={project}
            setOsintResults={
              setOsintResults
            }
          />
        </div>
      )}
    </div>
  );
}