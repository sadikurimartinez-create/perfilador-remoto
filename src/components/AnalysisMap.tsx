"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, GoogleMap, HeatmapLayer, Marker, Polygon, Polyline, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import type { AlbumPhoto, AnalysisResult } from "@/context/ProjectContext";

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
    return { icon: "🚓", color: "#3b82f6", bg: "bg-blue-600", text: "Vigilancia" }; // Azul institucional de seguridad
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
    case "Nodo Inicial": return "#10b981"; // Verde
    case "Nodo Final": return "#ef4444"; // Rojo
    case "Corredor": return "#3b82f6"; // Azul
    case "Perímetro": return "#8b5cf6"; // Morado
    case "Interior": return "#f97316"; // Naranja
    default: return "#dc2626"; // Rojo por defecto
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

  // El centro geográfico del mapa se calcula de forma dinámica y secuencial priorizando evidencias reales,
  // polígonos dibujados, POIs y, de forma secundaria, los centroides de incidentes históricos de análisis.
  // Evitamos por completo centrar en Aguascalientes Centro si existe cualquier dato espacial en el análisis.
  const center = useMemo(() => {
    const activeCoords: { lat: number; lng: number }[] = [];
    
    if (photosWithCoords.length > 0) {
      photosWithCoords.forEach(p => activeCoords.push({ lat: p.lat, lng: p.lng }));
    } else if (analysisPolygon && analysisPolygon.length > 0) {
      analysisPolygon.forEach(p => activeCoords.push({ lat: p.lat, lng: p.lng }));
    } else if (manualPois && manualPois.length > 0) {
      manualPois.forEach(p => activeCoords.push({ lat: p.lat, lng: p.lng }));
    } else if (analysisResult) {
      // Secundario: Centroide de incidentes históricos
      if (analysisResult.historicalCrimes && analysisResult.historicalCrimes.length > 0) {
        analysisResult.historicalCrimes.forEach(c => {
          if (hasValidCoords(c)) activeCoords.push({ lat: c.lat as number, lng: c.lng as number });
        });
      }
      // Terciario: Centroide de POIs detectados
      if (activeCoords.length === 0 && analysisResult.pois && analysisResult.pois.length > 0) {
        analysisResult.pois.forEach(p => {
          if (hasValidCoords(p)) activeCoords.push({ lat: p.lat as number, lng: p.lng as number });
        });
      }
    }

    if (activeCoords.length === 0) {
      return { lat: 21.8853, lng: -102.2916 }; // fallback absoluto de última instancia si nada de nada está definido
    }
    const lat = activeCoords.reduce((a, p) => a + p.lat, 0) / activeCoords.length;
    const lng = activeCoords.reduce((a, p) => a + p.lng, 0) / activeCoords.length;
    return { lat, lng };
  }, [photosWithCoords, analysisPolygon, manualPois, analysisResult]);

  // Validador geoespacial en tiempo real de pertenencia al polígono, radio o corredor activo
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
      return isPointNearLine(point, linePoints, 500); // 500m de corredor/área de influencia
    }
    
    if (photosWithCoords.length > 0 || (manualPois && manualPois.length > 0)) {
      return isPointInRadius(point, center, analysisRadius);
    }
    
    return true;
  }, [isPreliminary, analysisPolygon, geometryType, photosWithCoords, center, analysisRadius, manualPois]);

  // Se filtran los elementos con un estricto validador espacial para asegurar que pertenecen a la geografía activa (Regla Crítica Global)
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

  // Clusterización automática y robusta en JS (Evita dependencias externas fallidas)
  const clusteredCrimes = useMemo(() => {
    if (!activeLayers.clusters) {
      return crimesWithCoords.map(c => ({ isCluster: false, lat: c.lat, lng: c.lng, count: 1, crimes: [c] }));
    }
    const clusters: { lat: number; lng: number; count: number; crimes: any[] }[] = [];
    const distanceThreshold = 100; // metros
    
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

  // Identificación dinámica de Hotspots de concentración crítica
  const activeHotspots = useMemo(() => {
    // Tomamos los clusters de crímenes con más de 2 incidentes
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

  // Unificación de todos los acechos tácticos (IA y manuales del fotógrafo)
  const allAcechos = useMemo(() => {
    const list: Array<{ id: string; lat: number; lng: number; name: string; url: string; source: "AI" | "MANUAL" }> = [];
    
    // AI views
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

    // Manual photos de acecho
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

    // Validar espacialmente (Regla Crítica Global)
    return list.filter(pt => isPointInActiveGeography(pt));
  }, [lugaresAcecho, photosWithCoords, isPointInActiveGeography]);

  // POIs manuales estrictamente validados
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

  // Trazado de rutas con Directions API recortadas/acopladas dentro del polígono
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
            // Recorte geoespacial de la ruta contra la geografía activa (Regla Crítica Global)
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
      // Tomamos hasta los 3 atractores principales para evitar saturar API
      const limit = Math.min(top5Pois.length, 3);
      for (let i = 0; i < limit; i++) {
        const poiLatLng = { lat: top5Pois[i].lat as number, lng: top5Pois[i].lng as number };
        if (i % 2 === 0) {
          // Rutas de acceso (🔵 Azules, peatonales/tacticas)
          access.push(await fetchRoute(poiLatLng, center, "WALKING"));
        } else {
          // Rutas de fuga (🔴 Rojas, escape vehicular rápido)
          escape.push(await fetchRoute(center, poiLatLng, "DRIVING"));
        }
        await new Promise(r => setTimeout(r, 200));
      }
      setAccessRoutes(access);
      setEscapeRoutes(escape);
    };

    generateRoutes();
  }, [mapReady, viewMode, top5Pois, center, isPointInActiveGeography]);

  // Proyección a 6 meses: Vectores direccionales de expansión criminal radiales
  const predictiveVectors = useMemo(() => {
    if (viewMode !== "PREDICTIVE" || !center || top5Pois.length === 0) return [];
    
    // Trazamos vectores de expansión partiendo del centro y empujando past de los atractores
    return top5Pois.slice(0, 3).map((poi, idx) => {
      const poiLat = poi.lat as number;
      const poiLng = poi.lng as number;
      const dLat = poiLat - center.lat;
      const dLng = poiLng - center.lng;
      
      // Expandir 1.8 veces para capturar la proyección táctica
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
      typeof window === "undefined" ||
      !(window as any).google?.maps
    ) {
      return [];
    }
    const g = (window as any).google;
    
    // Construimos una cuadrícula ponderada por gravedad
    const cellSize = 0.0001;
    const grid = new Map<string, { lat: number; lng: number; weight: number }>();
    for (const c of crimesWithCoords) {
      const lat = c.lat;
      const lng = c.lng;
      const key = `${Math.round(lat / cellSize) * cellSize},${Math.round(lng / cellSize) * cellSize}`;
      const severity = getSeverityWeight(c.tipoDelito || "");
      const existing = grid.get(key);
      if (existing) {
        existing.weight += severity;
      } else {
        grid.set(key, { lat, lng, weight: severity });
      }
    }
    return Array.from(grid.values()).map(({ lat, lng, weight }) => ({
      location: new g.maps.LatLng(lat, lng),
      weight: Math.min(weight, 15), 
    }));
  }, [crimesWithCoords, isLoaded]);

  // Factor de escala de riesgo de zona (0-10)
  const zoneRiskIndex = useMemo(() => {
    if (crimesWithCoords.length === 0) return "0.0";
    let score = 0;
    crimesWithCoords.forEach(c => {
      score += getSeverityWeight(c.tipoDelito || "");
    });
    // Escalar logarítmicamente entre 0 y 10
    const val = Math.min(10, Math.log10(score * 2 + 1) * 3);
    return val.toFixed(1);
  }, [crimesWithCoords]);

  // Texto de Riesgo Descriptivo
  const zoneRiskLabel = useMemo(() => {
    const num = parseFloat(zoneRiskIndex);
    if (num >= 8.0) return { text: "Crítico", color: "text-red-500 border-red-500 bg-red-950/40" };
    if (num >= 5.0) return { text: "Alto", color: "text-orange-500 border-orange-500 bg-orange-950/40" };
    if (num >= 2.5) return { text: "Medio", color: "text-yellow-500 border-yellow-500 bg-yellow-950/40" };
    return { text: "Bajo", color: "text-emerald-500 border-emerald-500 bg-emerald-950/40" };
  }, [zoneRiskIndex]);

  // Función de captura/exportación rápida de evidencia
  const handleExportMap = () => {
    setIsExporting(true);
    alert("Para exportar, use CTRL+P en su navegador para guardar como PDF, o capture la pantalla del mapa táctico limpio que se presentará a continuación.");
  };

  if (!apiKey || apiKey.trim() === "") {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-amber-400">
        <p className="font-semibold text-base">⚠️ Mapa No Disponible</p>
        <p className="mt-1">Falta la clave de Google Maps en las variables de entorno (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-red-400 space-y-2">
        <p className="font-semibold text-base">❌ Error al cargar Google Maps</p>
        <p>Asegúrese de que las APIs de JavaScript de Google Maps y de visualización estén activas en la consola de Google Cloud.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400 min-h-[200px] flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        <span>Iniciando Entorno Cartográfico de Seguridad…</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col w-full font-sans transition-all duration-300 ${isExporting ? "fixed inset-0 z-50 bg-slate-950 p-4" : ""}`}>
      {/* Botón de salida para modo de exportación */}
      {isExporting && (
        <div className="flex justify-between items-center mb-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg">
          <span className="text-white text-xs font-bold uppercase tracking-wider">SSPE - Vista de Evidencia de Alta Coherencia</span>
          <button 
            onClick={() => setIsExporting(false)}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold"
          >
            Regresar al Informe
          </button>
        </div>
      )}

      <div className="relative w-full h-[650px] overflow-hidden bg-slate-900 rounded-xl border border-slate-800 shadow-xl">
        
        {/* Sello de agua oficial de seguridad */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden">
          <span className="text-slate-800/15 font-bold text-5xl sm:text-7xl -rotate-45 select-none tracking-[0.2em] drop-shadow-md">
            SSPE-CEIPOL
          </span>
        </div>

        {/* CONTROLES FLOTANTES PREMIUM (LADO DERECHO) */}
        <div className="absolute top-4 right-4 z-20 w-80 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl p-4 text-white max-h-[90%] overflow-y-auto flex flex-col gap-3.5 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Encabezado e Índice de Riesgo */}
          <div className="flex justify-between items-start border-b border-slate-800 pb-2.5">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">GEOINT Tactical Board</span>
              <h3 className="text-xs font-extrabold tracking-tight text-white uppercase mt-0.5">
                {viewMode === "DENSITY" && "Análisis de Densidad"}
                {viewMode === "TOPOGRAPHY" && "Estructura del Entorno"}
                {viewMode === "MOBILITY" && "Corredores & Fugas"}
                {viewMode === "PREDICTIVE" && "Modelo Predictivo"}
              </h3>
            </div>
            <div className={`px-2 py-1 rounded border text-center flex flex-col items-center shrink-0 min-w-[65px] ${zoneRiskLabel.color}`}>
              <span className="text-[9px] uppercase font-semibold leading-none">Riesgo</span>
              <span className="text-sm font-black leading-none mt-1">{zoneRiskIndex}</span>
              <span className="text-[7.5px] uppercase font-bold mt-0.5 tracking-wider">{zoneRiskLabel.text}</span>
            </div>
          </div>

          {/* DESCRIPCIÓN TÉCNICA DINÁMICA OBLIGATORIA */}
          <div className="bg-slate-900/65 border border-slate-800/50 p-2.5 rounded-lg text-[10px] text-slate-300 leading-relaxed">
            <span className="font-extrabold text-white text-[10.5px] block mb-1 uppercase tracking-wide">🔬 Descripción Técnica:</span>
            {viewMode === "DENSITY" && (
              <p>
                Representación de densidad criminal mediante cuadrículas ponderadas de Kernel. Los incidentes históricos 
                están ponderados por gravedad penal (homicidio/armas: x5, robos: x4, lesiones: x3). 
                Los niveles indican la recurrencia e intensidad delictiva local.
              </p>
            )}
            {viewMode === "TOPOGRAPHY" && (
              <p>
                Análisis de atractores urbanos que incentivan la criminalidad. Un <strong>Atractor de Riesgo</strong> es un espacio 
                cuya función o flujo de personas genera vulnerabilidad táctica, facilitando concentraciones 
                delictivas y disminuyendo el control social formal.
              </p>
            )}
            {viewMode === "MOBILITY" && (
              <p>
                Trazado dinámico de movilidad delictiva. <strong>Rutas de Acceso (Azul)</strong> describen aproximación táctica, 
                <strong> Rutas de Fuga (Rojo)</strong> detallan el escape vehicular, y las <strong>Zonas de Acecho</strong> señalan 
                puntos con nula visibilidad u ocultamiento.
              </p>
            )}
            {viewMode === "PREDICTIVE" && (
              <p>
                Proyección espacial a 6 meses. Modela la dirección natural de expansión del fenómeno a partir de los centroides 
                activos y los atractores de alta fricción. Las zonas concéntricas indican gradientes de presión delictiva futura.
              </p>
            )}
          </div>

          {/* ESCALA VISUAL OBLIGATORIA (Simbología Detallada) */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">🎨 Escala Visual:</span>
            <div className="bg-slate-900/50 p-2 rounded-lg space-y-1.5 text-[10px]">
              {viewMode === "DENSITY" && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-600 shrink-0"></span><span>Verde: Baja</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-yellow-500 shrink-0"></span><span>Amarillo: Media</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-orange-500 shrink-0"></span><span>Naranja: Alta</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-600 shrink-0"></span><span>Rojo: Crítico</span></div>
                  <div className="flex items-center gap-1.5 col-span-2 border-t border-slate-800 pt-1.5 mt-0.5"><span className="text-[11px] shrink-0">❌</span><span>Incidente Delictivo</span></div>
                </div>
              )}
              {viewMode === "TOPOGRAPHY" && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  <div className="flex items-center gap-1.5"><span>🏠</span><span>Viviendas</span></div>
                  <div className="flex items-center gap-1.5"><span>🏪</span><span>Comercios</span></div>
                  <div className="flex items-center gap-1.5"><span>🏦</span><span>Bancos/Financ.</span></div>
                  <div className="flex items-center gap-1.5"><span>🏫</span><span>Escuelas</span></div>
                  <div className="flex items-center gap-1.5"><span>⛽</span><span>Gasolineras</span></div>
                  <div className="flex items-center gap-1.5"><span>🚓</span><span>Vigilancia</span></div>
                </div>
              )}
              {viewMode === "MOBILITY" && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-2 rounded bg-blue-600 border border-blue-400 opacity-80"></span>
                    <span>Rutas de Acceso</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-2 rounded bg-red-600 border border-red-400 opacity-80"></span>
                    <span>Rutas de Fuga</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-dashed border-slate-400 bg-slate-950 flex items-center justify-center text-[8px]">⚫</span>
                    <span>Zona de Acecho (Street View)</span>
                  </div>
                </div>
              )}
              {viewMode === "PREDICTIVE" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-red-500 bg-red-500/15"></span>
                    <span>Presión Crítica (Concéntrica)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-orange-500 bg-orange-500/25"></span>
                    <span>Presión Focalizada (Atractor)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-0.5 bg-red-600 relative flex items-center justify-end"><span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span></span>
                    <span>Vector Direccional de Expansión</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CAPAS ACTIVABLES / CONTROL DE OPACIDAD */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">⚙️ Panel de Control Táctico:</span>
            
            {/* Toggles */}
            <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-300">
              {viewMode === "DENSITY" && (
                <>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                    <input type="checkbox" checked={activeLayers.heatmap} onChange={() => setActiveLayers(p => ({...p, heatmap: !p.heatmap}))} className="rounded accent-emerald-500 bg-slate-950 border-slate-800" />
                    <span>Heatmap</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                    <input type="checkbox" checked={activeLayers.clusters} onChange={() => setActiveLayers(p => ({...p, clusters: !p.clusters}))} className="rounded accent-emerald-500 bg-slate-950 border-slate-800" />
                    <span>Clusterización</span>
                  </label>
                </>
              )}
              {viewMode === "TOPOGRAPHY" && (
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors col-span-2">
                  <input type="checkbox" checked={activeLayers.atractores} onChange={() => setActiveLayers(p => ({...p, atractores: !p.atractores}))} className="rounded accent-emerald-500 bg-slate-950 border-slate-800" />
                  <span>Ver Atractores Urbanos</span>
                </label>
              )}
              {viewMode === "MOBILITY" && (
                <>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                    <input type="checkbox" checked={activeLayers.routes} onChange={() => setActiveLayers(p => ({...p, routes: !p.routes}))} className="rounded accent-emerald-500 bg-slate-950 border-slate-800" />
                    <span>Ver Rutas</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                    <input type="checkbox" checked={activeLayers.acechos} onChange={() => setActiveLayers(p => ({...p, acechos: !p.acechos}))} className="rounded accent-emerald-500 bg-slate-950 border-slate-800" />
                    <span>Street View</span>
                  </label>
                </>
              )}
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                <input type="checkbox" checked={activeLayers.buffer} onChange={() => setActiveLayers(p => ({...p, buffer: !p.buffer}))} className="rounded accent-emerald-500 bg-slate-950 border-slate-800" />
                <span>Buffer Límite</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                <input type="checkbox" checked={isOperativoMode} onChange={() => setIsOperativoMode(p => !p)} className="rounded accent-emerald-500 bg-slate-950 border-slate-800" />
                <span>Modo Operativo</span>
              </label>
            </div>

            {/* Sliders de Opacidad */}
            <div className="space-y-2 mt-2 pt-1 border-t border-slate-800/40">
              {viewMode === "DENSITY" && activeLayers.heatmap && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] text-slate-400">
                    <span>Opacidad del Heatmap:</span>
                    <span>{Math.round(heatmapOpacity * 100)}%</span>
                  </div>
                  <input type="range" min="0.1" max="1" step="0.05" value={heatmapOpacity} onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 accent-emerald-500 rounded-lg cursor-pointer" />
                </div>
              )}
              {(viewMode === "MOBILITY" || viewMode === "PREDICTIVE") && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] text-slate-400">
                    <span>Sombreado de Ruta:</span>
                    <span>{Math.round(corridorOpacity * 100)}%</span>
                  </div>
                  <input type="range" min="0.1" max="0.9" step="0.05" value={corridorOpacity} onChange={(e) => setCorridorOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 accent-blue-500 rounded-lg cursor-pointer" />
                </div>
              )}
              {viewMode === "PREDICTIVE" && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] text-slate-400">
                    <span>Opacidad de Expansión:</span>
                    <span>{Math.round(projectionOpacity * 100)}%</span>
                  </div>
                  <input type="range" min="0.05" max="0.6" step="0.05" value={projectionOpacity} onChange={(e) => setPredictiveOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 accent-red-500 rounded-lg cursor-pointer" />
                </div>
              )}
            </div>
          </div>

          {/* ACCIONES OPERATIVAS (EXPORTAR EVIDENCIA) */}
          <div className="border-t border-slate-800 pt-2.5 mt-0.5 flex gap-2">
            <button 
              onClick={handleExportMap}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-slate-700"
            >
              📸 Exportar Evidencia
            </button>
          </div>
        </div>

        {/* MAPA PRELIMINAR - HERRAMIENTAS DE DIBUJO */}
        {isPreliminary && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 shadow-lg">
            <span className="font-semibold tracking-tight text-emerald-300">
              Mapa Preliminar
            </span>
            {setAnalysisPolygon && (
              <button
                type="button"
                onClick={() => {
                  setIsDrawingPolygon((prev) => !prev);
                  if (isDrawingPolygon && setAnalysisPolygon && (analysisPolygon?.length ?? 0) < 3) {
                    setAnalysisPolygon([]);
                  }
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 border text-[11px] ${
                  isDrawingPolygon
                    ? "border-red-400 bg-red-500/20 text-red-200"
                    : "border-slate-600 bg-slate-800/70 text-slate-200"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Trazar perímetro
              </button>
            )}
            {setManualPois && (
              <button
                type="button"
                onClick={() => setIsPlacingManualPoi((prev) => !prev)}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 border text-[11px] ${
                  isPlacingManualPoi
                    ? "border-amber-400 bg-amber-500/20 text-amber-200"
                    : "border-slate-600 bg-slate-800/70 text-slate-200"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Fijar POI manual
              </button>
            )}
          </div>
        )}

        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={15}
          onLoad={onMapLoad}
          onClick={(e) => {
            if (!isPreliminary) return;
            const latLng = e.latLng;
            if (!latLng) return;
            const pt = { lat: latLng.lat(), lng: latLng.lng() };
            if (isDrawingPolygon && setAnalysisPolygon) {
              const current = analysisPolygon ?? [];
              setAnalysisPolygon([...current, pt]);
              return;
            }
            if (setManualPois && isPlacingManualPoi) {
              const label = window.prompt(
                "Escriba una clasificación para el punto (ej. Casa de Seguridad, Baldío, Taller):"
              );
              setManualPois([
                ...(manualPois ?? []),
                { ...pt, label: label || undefined },
              ]);
            }
          }}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            // Modo Operativo Táctico simplifica los fondos a un Mapa de Calles (terrain)
            // de alto contraste, en vez de satélite híbrido que sobrecarga la vista.
            mapTypeId: isOperativoMode ? "terrain" : "hybrid",
          }}
        >
          {/* LÍMITES / BUFFER (Ocultable) */}
          {activeLayers.buffer && !isPreliminary && geometryType !== "lineal" && geometryType !== "poligono" && (
            <Circle
              center={center}
              radius={analysisRadius}
              options={{
                strokeColor: "#ef4444",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#ef4444",
                fillOpacity: 0.12,
              }}
            />
          )}

          {!isPreliminary && geometryType === "lineal" && photosWithCoords.length > 1 && (
            <Polyline
              path={photosWithCoords.map(p => ({ lat: p.lat, lng: p.lng }))}
              options={{
                strokeColor: "#3b82f6",
                strokeOpacity: 0.9,
                strokeWeight: 6,
              }}
            />
          )}

          {!isPreliminary && geometryType === "poligono" && photosWithCoords.length > 2 && (
            <Polygon
              paths={
                photosWithCoords.filter(p => p.tipo === "Perímetro").length >= 3
                  ? photosWithCoords.filter(p => p.tipo === "Perímetro").map(p => ({ lat: p.lat, lng: p.lng }))
                  : photosWithCoords.map(p => ({ lat: p.lat, lng: p.lng }))
              }
              options={{
                strokeWeight: 4,
                fillColor: "#8b5cf6",
                fillOpacity: 0.35,
              }}
            />
          )}

          {/* RUTAS DE ACCESO: Sombreado Territorial Amplio + Núcleo Central de Alta Legibilidad */}
          {!isPreliminary && activeLayers.routes && (viewMode === "MOBILITY" || viewMode === "PREDICTIVE") && accessRoutes.map((path, idx) => (
            <Fragment key={`acc-route-group-${idx}`}>
              {/* Sombreado de Corredor amplio */}
              <Polyline
                path={path}
                options={{
                  strokeColor: "#3b82f6", // Azul 🔵
                  strokeOpacity: corridorOpacity,
                  strokeWeight: 14,
                  zIndex: 8
                }}
              />
              {/* Núcleo Sólido */}
              <Polyline
                path={path}
                options={{
                  strokeColor: "#1e40af", // Azul marino oscuro para alto contraste
                  strokeOpacity: 0.9,
                  strokeWeight: 3.5,
                  zIndex: 10
                }}
              />
            </Fragment>
          ))}

          {/* RUTAS DE FUGA: Sombreado Territorial Amplio + Núcleo Central de Alta Legibilidad */}
          {!isPreliminary && activeLayers.routes && (viewMode === "MOBILITY" || viewMode === "PREDICTIVE") && escapeRoutes.map((path, idx) => (
            <Fragment key={`esc-route-group-${idx}`}>
              {/* Sombreado de Corredor amplio */}
              <Polyline
                path={path}
                options={{
                  strokeColor: "#ef4444", // Rojo 🔴
                  strokeOpacity: corridorOpacity,
                  strokeWeight: 14,
                  zIndex: 8
                }}
              />
              {/* Núcleo Sólido */}
              <Polyline
                path={path}
                options={{
                  strokeColor: "#991b1b", // Rojo sangre para contraste táctico
                  strokeOpacity: 0.9,
                  strokeWeight: 3.5,
                  zIndex: 10
                }}
              />
            </Fragment>
          ))}

          {/* ZONAS DE ACECHO: Círculos de sombreado territorial ⚫ (Ocultables) */}
          {!isPreliminary && activeLayers.acechos && viewMode === "MOBILITY" && allAcechos.map((acecho, idx) => (
            <Fragment key={`acecho-zone-group-${idx}`}>
              {/* Sombreado Territorial de Acecho */}
              <Circle
                center={{ lat: acecho.lat, lng: acecho.lng }}
                radius={45}
                options={{
                  fillColor: "#0f172a", // Gris pizarra profundo/negro ⚫
                  fillOpacity: 0.35,
                  strokeColor: "#1e293b",
                  strokeOpacity: 0,
                  strokeWeight: 0,
                  zIndex: 15
                }}
              />
              {/* Borde exterior punteado fino */}
              <Polyline
                path={getDottedCirclePath(acecho.lat, acecho.lng, 45)}
                options={{
                  strokeOpacity: 0,
                  icons: [{ 
                    icon: { 
                      path: "M 0,-1 0,1", 
                      strokeOpacity: 1, 
                      scale: 2, 
                      strokeColor: "#000000" // Negro
                    }, 
                    offset: "0", 
                    repeat: "10px" 
                  }],
                  zIndex: 16
                }}
              />
            </Fragment>
          ))}

          {/* MARCADOR VISUAL AMPLIADO PARA ZONAS DE ACECHO (Street View estático o imagen de referencia) */}
          {!isPreliminary && activeLayers.acechos && viewMode === "MOBILITY" && allAcechos.map((acecho, idx) => (
            <OverlayView
              key={`acecho-overlay-${idx}`}
              position={{ lat: acecho.lat, lng: acecho.lng }}
              mapPaneName="overlayMouseTarget"
              getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -(height + 15) })}
            >
              <div className="bg-slate-950/95 border-2 border-slate-950 rounded-lg p-1.5 shadow-2xl flex flex-col items-center w-36 relative transition-all duration-300 hover:scale-105 hover:border-amber-400 z-50">
                {/* Imagen StreetView o Referencia */}
                <div className="w-full h-20 object-cover rounded-md border border-slate-800 overflow-hidden bg-slate-900">
                  <img src={acecho.url} alt={acecho.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 w-full justify-center px-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                  <span className="text-[7px] text-red-400 uppercase font-black tracking-wider leading-none">⚠️ ACECHO ACTIVO</span>
                </div>
                <span className="text-[8.5px] font-black text-slate-100 uppercase text-center mt-1 leading-tight truncate w-full px-0.5" title={acecho.name}>
                  {acecho.name}
                </span>
                <span className="text-[7px] text-slate-400 font-bold text-center mt-0.5 mb-0.5">
                  {acecho.source === "AI" ? "Análisis de IA" : "Referencia Fotográfica"}
                </span>
                {/* Flecha indicadora */}
                <div className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-slate-950"></div>
              </div>
            </OverlayView>
          ))}

          {/* FOTOS DE ARCHIVO (Fotógrafos u otros marcadores iniciales) */}
          {(viewMode === "TOPOGRAPHY" || viewMode === "MOBILITY" || isPreliminary) && photosWithCoords.map((p) => {
            const pinColor = getMarkerColor(p.tipo);
            return (
              <Marker
                key={p.id}
                position={{ lat: p.lat, lng: p.lng }}
                title={`${p.tipo} - ${p.comentario ?? ""}`}
                icon={{
                  path: 0 as any, // CIRCLE
                  scale: 9,
                  fillColor: pinColor,
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 1.8,
                }}
              />
            );
          })}

          {photosWithCoords.length > 0 && viewMode !== "DENSITY" && (
            <Marker
              position={center}
              title="Centro de levantamiento fotográfico"
              icon={{
                path: 3 as any, // BACKWARD_CLOSED_ARROW
                scale: 7,
                fillColor: "#f97316", // Naranja
                fillOpacity: 1,
                strokeColor: "#1f2937",
                strokeWeight: 1.5,
              }}
            />
          )}

          {/* DELITOS HISTÓRICOS (Con o sin Clusterización) */}
          {viewMode === "DENSITY" && clusteredCrimes.map((cluster, idx) => {
            if (cluster.count === 1) {
              const crime = cluster.crimes[0];
              return (
                <Marker
                  key={`crime-single-${idx}`}
                  position={{ lat: cluster.lat, lng: cluster.lng }}
                  title={crime.tipoDelito}
                  label={{
                    text: "❌",
                    color: "#fee2e2",
                    fontSize: "9px",
                    fontWeight: "700",
                  }}
                  icon={{
                    path: 0 as any, // Circle
                    fillColor: "#B22222",
                    fillOpacity: 0.9,
                    strokeColor: "#ffffff",
                    strokeWeight: 1.5,
                    scale: 9,
                  }}
                />
              );
            } else {
              // Cluster de Alta Incidencia
              return (
                <Marker
                  key={`crime-cluster-${idx}`}
                  position={{ lat: cluster.lat, lng: cluster.lng }}
                  title={`Cluster de ${cluster.count} incidentes delictivos`}
                  label={{
                    text: `${cluster.count}`,
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: "900",
                  }}
                  icon={{
                    path: 0 as any, // Circle
                    fillColor: "#dc2626", // Red
                    fillOpacity: 0.95,
                    strokeColor: "#ffffff",
                    strokeWeight: 2,
                    scale: 16,
                  }}
                />
              );
            }
          })}

          {/* ETIQUETA DINÁMICA DE HOTSPOTS ACTIVOS EN DENSIDAD CRÍTICA */}
          {viewMode === "DENSITY" && activeHotspots.map((hs) => (
            <OverlayView
              key={`hotspot-label-${hs.id}`}
              position={{ lat: hs.lat, lng: hs.lng }}
              mapPaneName="overlayMouseTarget"
              getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -(height + 26) })}
            >
              <div className="bg-red-950/95 border border-red-500 rounded px-1.5 py-0.5 shadow-lg flex items-center gap-1.5 whitespace-nowrap z-40">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[8px] font-black text-red-200 uppercase tracking-widest leading-none">
                  Foco Crítico #{hs.id} ({hs.count} incidentes)
                </span>
              </div>
            </OverlayView>
          ))}

          {/* SISTEMA ESTANDARIZADO DE SIMBOLOGÍA ATRACTOR PARA TODOS LOS POIs */}
          {activeLayers.atractores && (viewMode === "TOPOGRAPHY" || viewMode === "MOBILITY") && top5Pois.map((p, idx) => {
            const details = getPoiDetails(p.name, p.category || p.type);
            return (
              <Fragment key={`attr-marker-group-${idx}`}>
                {/* Radio de Influencia Directa (120 metros de vulnerabilidad del entorno) */}
                <Circle
                  center={{ lat: p.lat as number, lng: p.lng as number }}
                  radius={120}
                  options={{ 
                    fillColor: "#1e293b", // Gris oscuro táctico
                    fillOpacity: 0.12, 
                    strokeColor: details.color, 
                    strokeWeight: 1.5, 
                    strokeOpacity: 0.7 
                  }}
                />
                {/* Marcador Estandarizado Redondo de Alta Legibilidad y Contraste */}
                <Marker
                  position={{ lat: p.lat as number, lng: p.lng as number }}
                  label={{ 
                    text: details.icon, 
                    fontSize: "14px",
                  }}
                  title={`${p.name} (${details.text})`} 
                  icon={{ 
                    path: 0 as any, // Circle
                    scale: 15, 
                    fillColor: details.color, 
                    fillOpacity: 1, 
                    strokeColor: "#ffffff", 
                    strokeWeight: 2.2 
                  }}
                />
                {/* Distintivo Numérico de Jerarquía del Atractor */}
                <OverlayView
                  position={{ lat: p.lat as number, lng: p.lng as number }}
                  mapPaneName="overlayMouseTarget"
                  getPixelPositionOffset={() => ({ x: 10, y: -16 })}
                >
                  <span className="bg-slate-950 border border-slate-700 text-white rounded-full w-5 h-5 font-sans font-black text-[9px] flex items-center justify-center shadow-lg px-1 text-center select-none">
                    #{idx + 1}
                  </span>
                </OverlayView>
              </Fragment>
            );
          })}

          {/* MODELO PREDICTIVO A 6 MESES */}
          {viewMode === "PREDICTIVE" && (
            <>
              {/* Gradiente de Crecimiento Territorial Concéntrico Ampliado */}
              {/* Concentric 1: Radio Primario */}
              <Circle
                center={center}
                radius={analysisRadius}
                options={{ 
                  fillColor: "#dc2626", 
                  fillOpacity: projectionOpacity * 1.5, 
                  strokeColor: "#dc2626", 
                  strokeWeight: 2,
                  strokeOpacity: 0.8
                }}
              />
              {/* Concentric 2: Radio Intermedio */}
              <Circle
                center={center}
                radius={analysisRadius * 1.4}
                options={{ 
                  fillColor: "#ea580c", 
                  fillOpacity: projectionOpacity, 
                  strokeColor: "#ea580c", 
                  strokeWeight: 1.5,
                  strokeOpacity: 0.6
                }}
              />
              {/* Concentric 3: Radio Externo Ampliado */}
              <Circle
                center={center}
                radius={analysisRadius * 1.8}
                options={{ 
                  fillColor: "#eab308", 
                  fillOpacity: projectionOpacity * 0.5, 
                  strokeColor: "#eab308", 
                  strokeWeight: 1,
                  strokeOpacity: 0.4
                }}
              />

              {/* Zonas de Presión Futura en Atractores Clave */}
              {top5Pois.slice(0, 3).map((p, idx) => (
                <Circle
                  key={`pred-poi-zone-${idx}`}
                  center={{ lat: p.lat as number, lng: p.lng as number }}
                  radius={160}
                  options={{ 
                    fillColor: "#ea580c", 
                    fillOpacity: 0.22, 
                    strokeColor: "#ea580c", 
                    strokeWeight: 1.5,
                    strokeOpacity: 0.7 
                  }}
                />
              ))}

              {/* Vectores Direccionales de Expansión con flechas reales */}
              {predictiveVectors.map((v) => (
                <Fragment key={`pred-vector-${v.id}`}>
                  <Polyline
                    path={v.path}
                    options={{
                      strokeColor: "#ef4444", // Rojo neon
                      strokeOpacity: 0.95,
                      strokeWeight: 3.5,
                      icons: [
                        {
                          icon: {
                            path: 1, // FORWARD_CLOSED_ARROW
                            scale: 3.8,
                            fillColor: "#fecaca",
                            fillOpacity: 1,
                            strokeColor: "#dc2626",
                            strokeWeight: 1.5,
                          },
                          offset: "100%",
                        },
                      ],
                      zIndex: 30,
                    }}
                  />
                  {/* Etiquetado dinámico de Riesgo Emergente en la punta del vector */}
                  <OverlayView
                    position={v.path[1]}
                    mapPaneName="overlayMouseTarget"
                    getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -(height / 2) })}
                  >
                    <div className="bg-red-950/95 border border-red-500 rounded px-1.5 py-0.5 shadow-xl flex items-center gap-1 whitespace-nowrap z-40">
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                      </span>
                      <span className="text-[7.5px] font-black text-red-200 uppercase tracking-widest leading-none">
                        ZONA DE PRESIÓN EMERGENTE #{v.id}
                      </span>
                    </div>
                  </OverlayView>
                </Fragment>
              ))}
            </>
          )}

          {/* POLÍGONO DE ANÁLISIS DRAWN */}
          {isPreliminary && analysisPolygon && analysisPolygon.length > 2 && (
            <Polygon
              paths={analysisPolygon}
              options={{
                strokeColor: "#ef4444",
                strokeOpacity: 1,
                strokeWeight: 2,
                fillColor: "#991b1b",
                fillOpacity: 0.25,
              }}
            />
          )}

          {/* POIs MANUALES FILTRADOS Y ESTANDARIZADOS */}
          {filteredManualPois.map((p, idx) => {
            const details = getPoiDetails(p.label || "Otro", "");
            return (
              <Marker
                key={`manual-poi-${idx}`}
                position={{ lat: p.lat, lng: p.lng }}
                title={`${p.label || "Punto Fijado Manual"} (Manual)`}
                label={{ 
                  text: details.icon, 
                  fontSize: "12px" 
                }}
                icon={{
                  path: 0 as any, // CIRCLE
                  scale: 13,
                  fillColor: details.color,
                  fillOpacity: 1,
                  strokeColor: "#1e293b",
                  strokeWeight: 1.8,
                }}
              />
            );
          })}

          {/* CAPA DE CALOR (Ocultable por toggle) */}
          {viewMode === "DENSITY" && activeLayers.heatmap && heatmapCrimeData.length > 0 && (
            <HeatmapLayer
              data={heatmapCrimeData}
              options={{
                radius: 40,
                dissipating: true,
                opacity: heatmapOpacity,
                gradient: [
                  "rgba(16,185,129,0)",     // Verde Esmeralda (Bajo)
                  "rgba(16,185,129,0.35)",
                  "rgba(234,179,8,0.55)",   // Amarillo (Medio)
                  "rgba(249,115,22,0.75)",  // Naranja (Alto)
                  "rgba(220,38,38,1)",      // Rojo (Crítico)
                ],
              }}
            />
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
