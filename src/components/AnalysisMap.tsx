"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, GoogleMap, Marker, Polygon, Polyline, OverlayView, useJsApiLoader, InfoWindow } from "@react-google-maps/api";
import { useProject } from "@/context/ProjectContext";
import type { AlbumPhoto, AnalysisResult } from "@/context/ProjectContext";
import { extractSweepCoordinates } from "@/utils/sweepCoordinatesExtractor";

export type MapViewMode = "HEATMAP" | "DENSITY" | "TOPOGRAPHY" | "MOBILITY" | "PREDICTIVE";

type AnalysisMapProps = {
  album: AlbumPhoto[];
  analysisResult: AnalysisResult | null;
  /** Radio de la zona de análisis en metros (círculo en el mapa). Por defecto 500. */
  analysisRadius?: number;
  /** Polígono de análisis dibujado manualmente por el analista. */
  analysisPolygon?: { lat: number; lng: number }[];
  setAnalysisPolygon?: (coords: { lat: number; lng: number }[]) => void;
  /** POIs manuales fijados por el analista en el mapa preliminar. */
  manualPois?: { lat: number; lng: number; label?: string }[];
  setManualPois?: (value: { lat: number; lng: number; label?: string }[]) => void;
  /** Controla si el mapa está en modo preliminar (se muestran herramientas de dibujo y toolbar). */
  isPreliminary?: boolean;
  /** Controla qué capas tácticas se muestran ("HEATMAP", "ECOLOGY", "MOBILITY"). */
  viewMode?: MapViewMode;
  /** Geometría del proyecto para trazar rutas o perímetros automáticos */
  geometryType?: "individual" | "lineal" | "poligono";
};

// Ecuaciones para Top 5 Atractores
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

const darkMapStyles = [
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

// Algoritmos de validación espacial de contención geográfica
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

const getSeverityWeight = (crimeName: string) => {
  const name = crimeName.toLowerCase();
  if (name.includes("homicidio") || name.includes("secuestro") || name.includes("arma") || name.includes("violación")) return 5;
  if (name.includes("robo") || name.includes("asalto") || name.includes("extorsión") || name.includes("narcomenudeo")) return 4;
  if (name.includes("lesiones") || name.includes("violencia") || name.includes("amenaza")) return 3;
  return 2; 
};

// Generador matemático para puntear el radio de los lugares de acecho
const getDottedCirclePath = (lat: number, lng: number, radiusMeters: number) => {
  const points = [];
  for (let i = 0; i <= 36; i++) {
    const angle = (i / 36) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    points.push({
       lat: lat + (dy / 111320),
       lng: lng + (dx / (40075 * Math.cos(lat * Math.PI / 180)))
    });
  }
  return points;
};

// Categorizador táctico estandarizado de atractores urbanos
const getPoiDetails = (name: string = "", category: string = "", type: string = "") => {
  const normName = name.toLowerCase();
  const normCat = category.toLowerCase();
  const normType = type.toLowerCase();

  // Puntos de Vigilancia / Seguridad
  if (
    /vigilancia|c[aá]mara|polic[ií]a|m[oó]dulo|caseta|patrulla|seguridad|guardia|torre|ceipol|c4|c5|sspe/.test(normName) ||
    /vigilancia|polic[ií]a|seguridad|police|security/.test(normCat) ||
    /vigilancia|polic[ií]a|seguridad|police|security/.test(normType)
  ) {
    return { icon: "🚓", color: "#3b82f6", bg: "bg-blue-600", text: "Vigilancia" };
  }

  // Gasolineras
  if (
    /gasolinera|pemex|combustible|gasol|oxxo gas|gas depot|hidrosina|gas/.test(normName) ||
    /gas_station|gasolinera/.test(normCat) ||
    /gas_station|gasolinera/.test(normType)
  ) {
    return { icon: "⛽", color: "#eab308", bg: "bg-yellow-500", text: "Gasolinera" };
  }

  // Bancos / Servicios Financieros
  if (
    /banco|cajero|atm|bbva|banamex|santander|banorte|hsbc|azteca|coppel|financier|caja|ahorro|bancario/.test(normName) ||
    /bank|atm|finance|banco/.test(normCat) ||
    /bank|atm|finance|banco/.test(normType)
  ) {
    return { icon: "🏦", color: "#0ea5e9", bg: "bg-sky-500", text: "Financiero" };
  }

  // Escuelas
  if (
    normCat === "escuela" ||
    /escuela|colegio|universidad|jard[ií]n de niñ|kinder|secundaria|primaria|prepa|cbtis|cetis|facultad|instituto|educa/.test(normName) ||
    /school|university|education|escuela/.test(normCat) ||
    /school|university|education|escuela/.test(normType)
  ) {
    return { icon: "🏫", color: "#8b5cf6", bg: "bg-violet-600", text: "Escuela" };
  }

  // Viviendas / Zonas Residenciales
  if (
    /vivienda|casa|domicilio|residencia|habitaci[oó]n|departamento|fraccionamiento|privada|hogar/.test(normName) ||
    /vivienda|casa|residential|home/.test(normCat) ||
    /vivienda|casa|residential|home/.test(normType)
  ) {
    return { icon: "🏠", color: "#10b981", bg: "bg-emerald-600", text: "Vivienda" };
  }

  // Comercios / Negocios
  if (
    normCat === "expendioalcohol" ||
    normCat === "chatarreraotaller" ||
    /comercio|tienda|abarrotes|oxxo|mini|super|mercado|taller|mecanico|chatarr|yonque|deshuesadero|expendio|deposito|vinos|licor|cerveza|bar|cantina|antro|restaurante|negocio|local/.test(normName) ||
    /store|shop|bar|restaurant|car_repair|liquor_store|comercio/.test(normCat) ||
    /store|shop|bar|restaurant|car_repair|liquor_store|comercio/.test(normType)
  ) {
    return { icon: "🏪", color: "#ec4899", bg: "bg-pink-500", text: "Comercio" };
  }

  // Default: Atractor genérico
  return { icon: "📍", color: "#64748b", bg: "bg-slate-500", text: "Atractor" };
};

const MAP_LIBRARIES: ("places" | "visualization" | "drawing")[] = ["places", "visualization", "drawing"];

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: "400px",
};

function hasValidCoords(p: { lat?: number | null; lng?: number | null }): boolean {
  return (
    p.lat != null &&
    p.lng != null &&
    !Number.isNaN(p.lat) &&
    !Number.isNaN(p.lng)
  );
}

const getMarkerColor = (tipo?: string) => {
  switch (tipo) {
    case "Nodo Inicial": return "#10b981";
    case "Nodo Final": return "#ef4444";
    case "Corredor": return "#3b82f6";
    case "Perímetro": return "#8b5cf6";
    case "Interior": return "#f97316";
    default: return "#dc2626";
  }
};

export function AnalysisMap({
  album,
  analysisResult,
  analysisRadius = 500,
  analysisPolygon,
  setAnalysisPolygon,
  manualPois,
  setManualPois,
  isPreliminary = false,
  viewMode = "DENSITY",
  geometryType,
}: AnalysisMapProps) {
  const mapRef = useRef<any | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapBaseLayer, setMapBaseLayer] = useState<"standard" | "satellite">("standard");

  const { project } = useProject();

  const [showPhotos, setShowPhotos] = useState(true);
  const [showOsint, setShowOsint] = useState(true);
  const [showGeoint, setShowGeoint] = useState(true);
  const [showAreas, setShowAreas] = useState(true);

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

  // Barridos OSINT con georreferencia
  const sweepsWithCoords = useMemo(() => {
    return parsedSweeps.filter((s) => s.coordsInfo.hasCoordinates);
  }, [parsedSweeps]);

  // Barridos OSINT sin georreferencia
  const sweepsWithoutCoords = useMemo(() => {
    return parsedSweeps.filter((s) => !s.coordsInfo.hasCoordinates);
  }, [parsedSweeps]);

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

  const handleZoomIn = () => {
    if (mapRef.current) {
      const zoom = mapRef.current.getZoom();
      if (zoom !== undefined) mapRef.current.setZoom(zoom + 1);
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      const zoom = mapRef.current.getZoom();
      if (zoom !== undefined) mapRef.current.setZoom(zoom - 1);
    }
  };

  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(15);
    }
  };

  const [isPlacingManualPoi, setIsPlacingManualPoi] = useState(false);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [accessRoutes, setAccessRoutes] = useState<any[][]>([]);
  const [escapeRoutes, setEscapeRoutes] = useState<any[][]>([]);

  // Capas activas interactivas
  const [activeLayers, setActiveLayers] = useState({
    heatmap: true,
    atractores: true,
    routes: true,
    acechos: true,
    buffer: true,
    clusters: false,
  });

  // Opacidades controladas por capa
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.8);
  const [corridorOpacity, setCorridorOpacity] = useState(0.4);
  const [projectionOpacity, setPredictiveOpacity] = useState(0.2);

  // Modo operativo táctico simplificado (alto contraste)
  const [isOperativoMode, setIsOperativoMode] = useState(false);

  // Estado de exportación o captura
  const [isExporting, setIsExporting] = useState(false);

  const photosWithCoords = useMemo(
    () => album.filter(hasValidCoords) as Array<{ id: string; lat: number; lng: number; tipo: string; comentario: string; previewUrl: string }>,
    [album]
  );

  // Compute dispersed positions for marker rendering to prevent stacked pins in analysis map
  const photosWithDispersion = useMemo(() => {
    const coordCounts: Record<string, number> = {};
    return photosWithCoords.map((photo) => {
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
        const angle = (count * 2 * Math.PI) / 8;
        const ring = Math.floor((count - 1) / 8) + 1;
        const baseRadius = 0.000035;
        const radius = baseRadius * ring;
        return {
          ...photo,
          displayLat: lat + radius * Math.sin(angle),
          displayLng: lng + radius * Math.cos(angle),
        };
      }
    });
  }, [photosWithCoords]);

  const center = useMemo(() => {
    const activeCoords: { lat: number; lng: number }[] = [];
    
    if (photosWithCoords.length > 0) {
      photosWithCoords.forEach(p => activeCoords.push({ lat: p.lat, lng: p.lng }));
    } else if (analysisPolygon && analysisPolygon.length > 0) {
      analysisPolygon.forEach(p => activeCoords.push({ lat: p.lat, lng: p.lng }));
    } else if (manualPois && manualPois.length > 0) {
      manualPois.forEach(p => activeCoords.push({ lat: p.lat, lng: p.lng }));
    } else if (analysisResult) {
      if (analysisResult.historicalCrimes && analysisResult.historicalCrimes.length > 0) {
        analysisResult.historicalCrimes.forEach(c => {
          if (hasValidCoords(c)) activeCoords.push({ lat: c.lat as number, lng: c.lng as number });
        });
      }
      if (activeCoords.length === 0 && analysisResult.pois && analysisResult.pois.length > 0) {
        analysisResult.pois.forEach(p => {
          if (hasValidCoords(p)) activeCoords.push({ lat: p.lat as number, lng: p.lng as number });
        });
      }
    }

    if (activeCoords.length === 0) {
      return { lat: 21.8853, lng: -102.2916 };
    }
    const lat = activeCoords.reduce((a, p) => a + p.lat, 0) / activeCoords.length;
    const lng = activeCoords.reduce((a, p) => a + p.lng, 0) / activeCoords.length;
    return { lat, lng };
  }, [photosWithCoords, analysisPolygon, manualPois, analysisResult]);

  const isPointInActiveGeography = useCallback((point: { lat: number; lng: number }): boolean => {
    if (isPreliminary && analysisPolygon && analysisPolygon.length >= 3) {
      return isPointInPolygon(point, analysisPolygon);
    }
    
    if (geometryType === "poligono") {
      const polyPoints = photosWithCoords.filter(p => p.tipo === "Perímetro").length >= 3
        ? photosWithCoords.filter(p => p.tipo === "Perímetro").map(p => ({ lat: p.lat, lng: p.lng }))
        : photosWithCoords.map(p => ({ lat: p.lat, lng: p.lng }));
      if (polyPoints.length >= 3) {
        return isPointInPolygon(point, polyPoints);
      }
    }
    
    if (geometryType === "lineal" && photosWithCoords.length >= 1) {
      const linePoints = photosWithCoords.map(p => ({ lat: p.lat, lng: p.lng }));
      return isPointNearLine(point, linePoints, 500);
    }
    
    if (photosWithCoords.length > 0 || (manualPois && manualPois.length > 0)) {
      return isPointInRadius(point, center, analysisRadius);
    }
    
    return true;
  }, [isPreliminary, analysisPolygon, geometryType, photosWithCoords, center, analysisRadius, manualPois]);

  const crimesWithCoords = useMemo(() => {
    const raw = (analysisResult?.historicalCrimes ?? []).filter((c) => hasValidCoords(c)) as Array<{ lat: number; lng: number; tipoDelito: string }>;
    const hasActiveGeo = photosWithCoords.length > 0 || (isPreliminary && analysisPolygon && analysisPolygon.length >= 3) || (manualPois && manualPois.length > 0);
    if (!hasActiveGeo) return raw;
    return raw.filter(c => isPointInActiveGeography(c));
  }, [analysisResult?.historicalCrimes, isPointInActiveGeography, photosWithCoords.length, isPreliminary, analysisPolygon, manualPois]);

  const poisWithCoords = useMemo(() => {
    const raw = (analysisResult?.pois ?? []).filter((p) => hasValidCoords(p)) as Array<{ lat: number; lng: number; name?: string; type?: string; category?: string }>;
    const hasActiveGeo = photosWithCoords.length > 0 || (isPreliminary && analysisPolygon && analysisPolygon.length >= 3) || (manualPois && manualPois.length > 0);
    if (!hasActiveGeo) return raw;
    return raw.filter(p => isPointInActiveGeography(p));
  }, [analysisResult?.pois, isPointInActiveGeography, photosWithCoords.length, isPreliminary, analysisPolygon, manualPois]);

  const clusteredCrimes = useMemo(() => {
    if (!activeLayers.clusters) {
      return crimesWithCoords.map(c => ({ isCluster: false, lat: c.lat, lng: c.lng, count: 1, crimes: [c] }));
    }
    const clusters: { lat: number; lng: number; count: number; crimes: any[] }[] = [];
    const distanceThreshold = 100;
    
    crimesWithCoords.forEach((crime) => {
      let added = false;
      for (const cluster of clusters) {
        const dist = getDistanceInMeters(crime.lat, crime.lng, cluster.lat, cluster.lng);
        if (dist <= distanceThreshold) {
          cluster.lat = (cluster.lat * cluster.count + crime.lat) / (cluster.count + 1);
          cluster.lng = (cluster.lng * cluster.count + crime.lng) / (cluster.count + 1);
          cluster.count += 1;
          cluster.crimes.push(crime);
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.push({ lat: crime.lat, lng: crime.lng, count: 1, crimes: [crime] });
      }
    });
    return clusters;
  }, [crimesWithCoords, activeLayers.clusters]);

  const top5Pois = useMemo(() => {
    if (!poisWithCoords || poisWithCoords.length === 0) return [];
    return poisWithCoords.map((poi) => {
      let riskScore = 0;
      crimesWithCoords.forEach((c) => {
        if (c.lat != null && c.lng != null && poi.lat != null && poi.lng != null) {
          const dist = getDistanceInMeters(poi.lat, poi.lng, c.lat, c.lng);
          if (dist <= 200) riskScore += getSeverityWeight(c.tipoDelito || "");
        }
      });
      return { ...poi, score: riskScore };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  }, [poisWithCoords, crimesWithCoords]);

  const activeHotspots = useMemo(() => {
    const highDensityClusters = clusteredCrimes.filter(c => c.count >= 2).sort((a, b) => b.count - a.count);
    return highDensityClusters.slice(0, 3).map((h, i) => ({
      id: i + 1,
      lat: h.lat,
      lng: h.lng,
      count: h.count,
    }));
  }, [clusteredCrimes]);

  const lugaresAcecho = useMemo(() => {
    if (!analysisResult?.tacticalStreetViews) return [];
    return analysisResult.tacticalStreetViews.map((sv: any) => {
      const match = analysisResult.pois?.find((p) => p.name === sv.name);
      return { ...sv, lat: match?.lat, lng: match?.lng };
    }).filter((a: any) => a.lat != null && a.lng != null);
  }, [analysisResult]);

  const allAcechos = useMemo(() => {
    const list: Array<{ id: string; lat: number; lng: number; name: string; url: string; source: "AI" | "MANUAL" }> = [];
    
    lugaresAcecho.forEach((a: any, idx: number) => {
      list.push({
        id: `ai-acecho-${idx}`,
        lat: a.lat,
        lng: a.lng,
        name: a.name || "Punto de Acecho IA",
        url: a.streetViewUrl,
        source: "AI",
      });
    });

    photosWithCoords.filter(p => p.tipo === "Lugar de Acecho").forEach((p, idx) => {
      list.push({
        id: `manual-acecho-${idx}`,
        lat: p.lat,
        lng: p.lng,
        name: p.comentario || `Acecho manual #${idx+1}`,
        url: p.previewUrl,
        source: "MANUAL",
      });
    });

    return list.filter(pt => isPointInActiveGeography(pt));
  }, [lugaresAcecho, photosWithCoords, isPointInActiveGeography]);

  const filteredManualPois = useMemo(() => {
    if (!manualPois) return [];
    return manualPois.filter(p => isPointInActiveGeography(p));
  }, [manualPois, isPointInActiveGeography]);

  const boundsPoints = useMemo(() => {
    const points: Array<{ lat: number; lng: number }> = [];
    photosWithCoords.forEach((p) => points.push({ lat: p.lat, lng: p.lng }));
    crimesWithCoords.forEach((c) => points.push({ lat: c.lat as number, lng: c.lng as number }));
    top5Pois.forEach((p) => points.push({ lat: p.lat as number, lng: p.lng as number }));
    filteredManualPois.forEach((p) => points.push({ lat: p.lat, lng: p.lng }));
    return points;
  }, [photosWithCoords, crimesWithCoords, top5Pois, filteredManualPois]);

  const onMapLoad = useCallback((map: any) => {
    mapRef.current = map;
    setMapReady(true);
    if (typeof window !== "undefined") {
      if ((window as any).map && (window as any).map !== map) {
        try {
          (window as any).map.remove();
        } catch (e) {
          console.warn("Error removing previous map instance:", e);
        }
      }
      (window as any).map = map;
      if (!(window as any).map.invalidateSize) {
        (window as any).map.invalidateSize = () => {
          if (typeof window !== "undefined" && (window as any).google?.maps) {
            (window as any).google.maps.event.trigger(map, "resize");
          }
        };
      }
      if (!(window as any).map.remove) {
        (window as any).map.remove = () => {
          if ((window as any).map === map) {
            (window as any).map = null;
          }
        };
      }
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady || typeof window === "undefined" || !(window as any).google?.maps || boundsPoints.length === 0) return;
    const g = (window as any).google;
    const bounds = new g.maps.LatLngBounds();
    boundsPoints.forEach((pt) => bounds.extend(new g.maps.LatLng(pt.lat, pt.lng)));
    mapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  }, [mapReady, boundsPoints]);

  useEffect(() => {
    if (viewMode !== "MOBILITY" && viewMode !== "PREDICTIVE") return;
    if (!mapReady || typeof window === "undefined" || !(window as any).google) return;
    if (top5Pois.length === 0 || !center) return;

    const ds = new (window as any).google.maps.DirectionsService();
    const access: any[][] = [];
    const escape: any[][] = [];

    const fetchRoute = (origin: any, destination: any, mode: string): Promise<any[]> => {
      return new Promise((resolve) => {
        ds.route({ origin, destination, travelMode: mode }, (result: any, status: any) => {
          if (status === "OK" && result) {
            const rawPath = result.routes[0].overview_path.map((pt: any) => ({ lat: pt.lat(), lng: pt.lng() }));
            const clipped = rawPath.filter((pt: any) => isPointInActiveGeography(pt));
            resolve(clipped);
          } else {
            const rawPath = [origin, destination];
            const clipped = rawPath.filter((pt: any) => isPointInActiveGeography(pt));
            resolve(clipped);
          }
        });
      });
    };

    const generateRoutes = async () => {
      const limit = Math.min(top5Pois.length, 3);
      for (let i = 0; i < limit; i++) {
        const poiLatLng = { lat: top5Pois[i].lat as number, lng: top5Pois[i].lng as number };
        if (i % 2 === 0) {
          access.push(await fetchRoute(poiLatLng, center, "WALKING"));
        } else {
          escape.push(await fetchRoute(center, poiLatLng, "DRIVING"));
        }
        await new Promise(r => setTimeout(r, 200));
      }
      setAccessRoutes(access);
      setEscapeRoutes(escape);
    };

    generateRoutes();
  }, [mapReady, viewMode, top5Pois, center, isPointInActiveGeography]);

  const predictiveVectors = useMemo(() => {
    if (viewMode !== "PREDICTIVE" || !center || top5Pois.length === 0) return [];
    
    return top5Pois.slice(0, 3).map((poi, idx) => {
      const poiLat = poi.lat as number;
      const poiLng = poi.lng as number;
      const dLat = poiLat - center.lat;
      const dLng = poiLng - center.lng;
      
      const endLat = center.lat + dLat * 1.8;
      const endLng = center.lng + dLng * 1.8;
      
      return {
        id: idx + 1,
        path: [
          { lat: center.lat, lng: center.lng },
          { lat: endLat, lng: endLng }
        ],
        poiName: poi.name
      };
    });
  }, [viewMode, center, top5Pois]);

  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc") : "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: MAP_LIBRARIES,
  });

  const heatmapCrimeData = useMemo(() => {
    if (
      !isLoaded ||
      !crimesWithCoords.length ||
      typeof window === "undefined"
    ) {
      return [];
    }
    
    const cellSize = 0.0001;
    const grid = new Map<string, { lat: number; lng: number; weight: number }>();
    for (const c of crimesWithCoords) {
      const lat = c.lat;
      const lng = c.lng;
      const gridLat = Math.round(lat / cellSize) * cellSize;
      const gridLng = Math.round(lng / cellSize) * cellSize;
      const key = `${gridLat.toFixed(5)},${gridLng.toFixed(5)}`;
      const w = getSeverityWeight(c.tipoDelito || "");
      const current = grid.get(key);
      if (current) {
        current.weight += w;
      } else {
        grid.set(key, { lat: gridLat, lng: gridLng, weight: w });
      }
    }
    return Array.from(grid.values()).map((point) => ({
      location: new (window as any).google.maps.LatLng(point.lat, point.lng),
      weight: point.weight,
    }));
  }, [isLoaded, crimesWithCoords]);

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-red-400 p-6 rounded-2xl border border-slate-800">
        <span className="text-2xl mb-2">⚠️</span>
        <p className="text-xs font-bold uppercase tracking-wider">Error al cargar Google Maps JS API</p>
        <p className="text-[10px] text-slate-500 mt-1">{loadError.message}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-6 rounded-2xl border border-slate-800 animate-pulse">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent mb-3"></div>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Cargando Cartografía GEOINT...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[450px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex flex-col">
      {/* Controles flotantes superiores */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 items-center bg-slate-900/90 backdrop-blur-md p-2 rounded-xl border border-slate-800 shadow-xl">
        <button
          onClick={() => setMapBaseLayer(mapBaseLayer === "standard" ? "satellite" : "standard")}
          className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition"
        >
          {mapBaseLayer === "standard" ? "🛰️ Satélite" : "🗺️ Estándar"}
        </button>

        <div className="h-4 w-px bg-slate-800 my-auto" />

        <button
          onClick={() => setShowPhotos(!showPhotos)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition ${
            showPhotos ? "bg-cyan-950/80 border-cyan-700 text-cyan-300" : "bg-slate-950/50 border-slate-800 text-slate-500"
          }`}
        >
          📷 Evidencias ({photosWithCoords.length})
        </button>

        <button
          onClick={() => setShowOsint(!showOsint)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition ${
            showOsint ? "bg-purple-950/80 border-purple-700 text-purple-300" : "bg-slate-950/50 border-slate-800 text-slate-500"
          }`}
        >
          🔎 OSINT ({parsedSweeps.length})
        </button>

        <button
          onClick={() => setShowGeoint(!showGeoint)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition ${
            showGeoint ? "bg-emerald-950/80 border-emerald-700 text-emerald-300" : "bg-slate-950/50 border-slate-800 text-slate-500"
          }`}
        >
          📍 Atractores/Hotspots
        </button>
      </div>

      {/* Controles de Zoom en el mapa */}
      <div className="absolute bottom-16 right-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-sm border border-slate-800 shadow-xl flex items-center justify-center cursor-pointer"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-sm border border-slate-800 shadow-xl flex items-center justify-center cursor-pointer"
        >
          -
        </button>
        <button
          onClick={handleResetView}
          className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-400 font-bold text-xs border border-slate-800 shadow-xl flex items-center justify-center cursor-pointer"
          title="Centrar mapa"
        >
          🎯
        </button>
      </div>

      {/* Mapa Principal de Google Maps */}
      <div className="flex-1 w-full relative">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={15}
          onLoad={onMapLoad}
          options={{
            styles: mapBaseLayer === "standard" ? darkMapStyles : [],
            mapTypeId: mapBaseLayer === "standard" ? "roadmap" : "hybrid",
            disableDefaultUI: true,
            zoomControl: false,
            gestureHandling: "greedy",
          }}
        >
          {/* Círculo de Radio de Análisis (Buffer Activo) */}
          {showAreas && activeLayers.buffer && (
            <Circle
              center={center}
              radius={analysisRadius}
              options={{
                fillColor: "#06b6d4",
                fillOpacity: 0.05,
                strokeColor: "#0891b2",
                strokeOpacity: 0.4,
                strokeWeight: 1.5,
              }}
            />
          )}

          {/* Polígono de Análisis dibujado si existe */}
          {analysisPolygon && analysisPolygon.length >= 3 && (
            <Polygon
              paths={analysisPolygon}
              options={{
                fillColor: "#3b82f6",
                fillOpacity: 0.15,
                strokeColor: "#60a5fa",
                strokeOpacity: 0.8,
                strokeWeight: 2,
              }}
            />
          )}

          {/* Marcadores de Evidencia Fotográfica con Dispersión */}
          {showPhotos && photosWithDispersion.map((photo) => (
            <Marker
              key={`photo-${photo.id}`}
              position={{ lat: photo.displayLat, lng: photo.displayLng }}
              title={`${photo.tipo}: ${photo.comentario}`}
              icon={{
                path: 0,
                scale: 7,
                fillColor: getMarkerColor(photo.tipo),
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              }}
            />
          ))}

          {/* Atractores Urbanos TOP 5 */}
          {showGeoint && activeLayers.atractores && top5Pois.map((poi, idx) => {
            const details = getPoiDetails(poi.name, poi.category, poi.type);
            return (
              <Marker
                key={`poi-${idx}`}
                position={{ lat: poi.lat as number, lng: poi.lng as number }}
                title={`${poi.name || "Atractor Urbano"}`}
                icon={{
                  path: 0,
                  scale: 6,
                  fillColor: details.color,
                  fillOpacity: 0.9,
                  strokeColor: "#ffffff",
                  strokeWeight: 1.5,
                }}
              />
            );
          })}

          {/* Hotspots de alta concentración criminal */}
          {showGeoint && activeHotspots.map((hotspot) => (
            <Circle
              key={`hotspot-${hotspot.id}`}
              center={{ lat: hotspot.lat, lng: hotspot.lng }}
              radius={120}
              options={{
                fillColor: "#ef4444",
                fillOpacity: 0.25,
                strokeColor: "#f87171",
                strokeOpacity: 0.8,
                strokeWeight: 2,
              }}
            />
          ))}

          {/* Acechos Tácticos con Círculos Punteados */}
          {showGeoint && activeLayers.acechos && allAcechos.map((acecho) => (
            <Fragment key={`acecho-frag-${acecho.id}`}>
              <Polyline
                path={getDottedCirclePath(acecho.lat, acecho.lng, 40)}
                options={{
                  strokeColor: "#f59e0b",
                  strokeOpacity: 0.8,
                  strokeWeight: 1.5,
                }}
              />
              <Marker
                position={{ lat: acecho.lat, lng: acecho.lng }}
                title={acecho.name}
                icon={{
                  path: 0,
                  scale: 5,
                  fillColor: "#f59e0b",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 1,
                }}
              />
            </Fragment>
          ))}

          {/* Rutas de Acceso y Fuga (Modo Mobility / Predictive) */}
          {(viewMode === "MOBILITY" || viewMode === "PREDICTIVE") && activeLayers.routes && (
            <>
              {accessRoutes.map((routePath, idx) => (
                <Polyline
                  key={`access-route-${idx}`}
                  path={routePath}
                  options={{
                    strokeColor: "#3b82f6",
                    strokeOpacity: corridorOpacity,
                    strokeWeight: 4,
                  }}
                />
              ))}
              {escapeRoutes.map((routePath, idx) => (
                <Polyline
                  key={`escape-route-${idx}`}
                  path={routePath}
                  options={{
                    strokeColor: "#ef4444",
                    strokeOpacity: corridorOpacity,
                    strokeWeight: 4,
                  }}
                />
              ))}
            </>
          )}

          {/* Vectores de Proyección Criminal Criminológica */}
          {viewMode === "PREDICTIVE" && predictiveVectors.map((vector) => (
            <Polyline
              key={`pred-vec-${vector.id}`}
              path={vector.path}
              options={{
                strokeColor: "#a855f7",
                strokeOpacity: 0.8,
                strokeWeight: 3,
                geodesic: true,
              }}
            />
          ))}

          {/* Marcadores e Influencias de Barridos OSINT */}
          {showOsint && osintClusters.map((cluster, idx) => {
            if (cluster.type === "SUPER" || cluster.type === "GROUP") {
              return (
                <Marker
                  key={`osint-group-${idx}`}
                  position={{ lat: cluster.lat, lng: cluster.lng }}
                  title={`${cluster.label}`}
                  icon={{
                    path: 0,
                    scale: 12,
                    fillColor: "#8b5cf6",
                    fillOpacity: 0.9,
                    strokeColor: "#ffffff",
                    strokeWeight: 1.5,
                  }}
                  onClick={() => setSelectedOsintGroup(cluster)}
                />
              );
            }

            const sweep = cluster.sweeps[0];
            return (
              <Marker
                key={`osint-single-${idx}`}
                position={{ lat: cluster.lat, lng: cluster.lng }}
                title={`${sweep.engine} - ${sweep.status}`}
                icon={{
                  path: 0,
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

          {/* InfoWindows de Barridos OSINT */}
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
        </GoogleMap>
      </div>

      {/* LEYENDA INSTITUCIONAL COMPLETA (DEBAJO DEL MAPA) */}
      {!isPreliminary && (
        <div className="bg-slate-900 border-t border-slate-800 p-4 text-[11px] text-slate-300 w-full rounded-b-xl flex flex-col gap-2">
          <div className="font-bold border-b border-slate-800 pb-1.5 text-white uppercase tracking-wider text-xs flex justify-between items-center">
            <span>Simbología Táctica e Integradora (GEOINT)</span>
            <span className="text-[10px] text-slate-400 font-normal normal-case">Polígono de Análisis Activo</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 mt-1 text-[10.5px]">
            {viewMode === "DENSITY" && (
              <>
                 <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-red-600 border border-red-400"></span> Alta Concentración (Hotspot)</div>
                 <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-yellow-500 border border-yellow-300"></span> Media Concentración</div>
                 <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-400"></span> Baja Concentración</div>
                 <div className="flex items-center gap-2"><span className="text-[12px]">❌</span> Evento Delictivo Histórico</div>
              </>
            )}
            {viewMode === "TOPOGRAPHY" && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-2 w-full">
                <div className="flex items-center gap-1.5">🏠 <span className="font-semibold text-slate-200">Vivienda</span></div>
                <div className="flex items-center gap-1.5">🏪 <span className="font-semibold text-slate-200">Comercio</span></div>
                <div className="flex items-center gap-1.5">🏦 <span className="font-semibold text-slate-200">Banco / Financ.</span></div>
                <div className="flex items-center gap-1.5">🏫 <span className="font-semibold text-slate-200">Escuela</span></div>
                <div className="flex items-center gap-1.5">⛽ <span className="font-semibold text-slate-200">Gasolineras</span></div>
                <div className="flex items-center gap-1.5">🚓 <span className="font-semibold text-slate-200">Vigilancia</span></div>
              </div>
            )}
            {viewMode === "MOBILITY" && (
              <>
                 <div className="flex items-center gap-2"><span className="w-7 h-2 rounded bg-blue-600 border border-blue-400 opacity-80"></span> Rutas de Acceso (Aproximación Táctica)</div>
                 <div className="flex items-center gap-2"><span className="w-7 h-2 rounded bg-red-600 border border-red-400 opacity-80"></span> Rutas de Fuga (Escape Vehicular)</div>
                 <div className="flex items-center gap-2">
                   <span className="w-4 h-4 rounded-full border border-dashed border-slate-500 bg-slate-950 text-[8px] flex items-center justify-center">⚫</span>
                   <span>Zonas de Acecho Táctico (Street View integrado)</span>
                 </div>
              </>
            )}
            {viewMode === "PREDICTIVE" && (
              <>
                 <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full border border-red-500 bg-red-500/15"></span> Gradiente de Presión Crítica</div>
                 <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full border border-orange-500 bg-orange-500/25"></span> Desplazamiento Focalizado</div>
                 <div className="flex items-center gap-2">
                   <span className="w-6 h-0.5 bg-red-600 relative flex items-center justify-end"><span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span></span>
                   <span>Vector de Desplazamiento Criminológico</span>
                 </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
