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
  album?: { id: string; lat: number | null; lng: number | null }[];
  project?: any;
  projects?: any[];
};

const containerStyle = {
  width: "100%",
  height: "320px",
};

const MAP_LIBRARIES: ("places" | "visualization" | "drawing")[] = ["places", "visualization", "drawing"];

export function ProjectMap({ geometryType, coordinates, onUpdateCoordinates, album, project, projects = [] }: ProjectMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showClusters, setShowClusters] = useState(true);

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

  }, []);

  const center = useMemo(() => {
    if (coordinates.length === 0) return { lat: 21.88, lng: -102.29 };
    const lat = coordinates.reduce((sum, c) => sum + c.lat, 0) / coordinates.length;
    const lng = coordinates.reduce((sum, c) => sum + c.lng, 0) / coordinates.length;
    return { lat, lng };
  }, [coordinates]);

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
    } else {
      mapRef.current.setCenter(coordinates[0]);
      mapRef.current.setZoom(15);
    }
  }, [mapReady, coordinates]);

  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "") : "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "project-map",
    googleMapsApiKey: apiKey,
    libraries: MAP_LIBRARIES,
  });

  if (!apiKey) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-amber-400 mt-4">
        <p className="font-semibold">Mapa no disponible</p>
        <p className="mt-1">Falta la clave de Google Maps (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-red-400 mt-4">
        <p className="font-semibold">Error al cargar el mapa</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400 min-h-[200px] flex items-center justify-center mt-4">
        Cargando mapa de Google…
      </div>
    );
  }

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
      {heatmapData.length > 0 && (
        <div className="flex justify-end gap-2">
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

      <div id="project-map-capture" className="relative rounded-lg border border-slate-700 overflow-hidden bg-slate-900/50 map-container">
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
          const analysis = photo && project?.iaAnalysis ? project.iaAnalysis.find((a: any) => a.photoId === photo.id) : null;
          
          let pinColor = 'blue'; // default
          if (analysis?.riskLevel === 'high' || analysis?.riskLevel === 'alto') pinColor = 'red';
          else if (analysis?.riskLevel === 'medium' || analysis?.riskLevel === 'medio') pinColor = 'orange';
          else if (analysis?.riskLevel === 'low' || analysis?.riskLevel === 'bajo') pinColor = 'green';

          return (
            <Marker
              key={photo ? photo.id : `coord-${idx}`}
              position={c}
              draggable
              onDragEnd={(e) => handleMarkerDrag(idx, e.latLng!.lat(), e.latLng!.lng())}
              icon={project?.iaAnalysis ? {
                url: `/pins/${pinColor}-pin.png`,
                scaledSize: new (window as any).google.maps.Size(30, 30),
              } : {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#dc2626",
                fillOpacity: 1,
                strokeColor: "#fef2f2",
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
              strokeOpacity: 0.8,
              strokeWeight: 4,
            }}
          />
        )}

        {geometryType === "poligono" && coordinates.length > 2 && (
          <Polygon
            paths={coordinates}
            options={{
              strokeColor: "#8b5cf6",
              strokeOpacity: 0.8,
              strokeWeight: 3,
              fillColor: "#8b5cf6",
              fillOpacity: 0.35,
            }}
          />
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
      </GoogleMap>

      {validationMsg && (
        <p className="text-xs text-amber-400 mt-2 px-2 pb-2 font-medium">{validationMsg}</p>
      )}
      </div>

      {project?.iaAnalysis && project.iaAnalysis.length > 0 && (
        <div className="space-y-4">
          <StatisticsDashboard iaAnalysis={project.iaAnalysis || []} />
          <CorrelationPanel
            currentProject={project}
            allProjects={projects || []}
          />
          <TimelinePanel iaAnalysis={project.iaAnalysis || []} />
          <MultimodalPanel project={project} />
          <RoleGuard allowed={permissions.canViewExecutiveDashboard}>
            <ExecutiveDashboard projects={projects || []} />
          </RoleGuard>
          <AuditPanel auditLogs={project.auditLogs || []} />
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
          />
          <AnalysisPanel iaAnalysis={project.iaAnalysis} project={project} />
        </div>
      )}
    </div>
  );
}