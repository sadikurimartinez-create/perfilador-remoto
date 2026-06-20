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

  const photosWithCoords = useMemo(
    () => album.filter(hasValidCoords) as Array<{ id: string; lat: number; lng: number; tipo: string; comentario: string }>,
    [album]
  );

  // El centro geográfico del mapa se calcula de forma dinámica y secuencial priorizando las evidencias y la geometría del usuario.
  // Evitamos por completo centrar en la ciudad de Aguascalientes si existe cualquier elemento activo.
  const center = useMemo(() => {
    const activeCoords: { lat: number; lng: number }[] = [];
    if (photosWithCoords.length > 0) {
      photosWithCoords.forEach(p => activeCoords.push({ lat: p.lat, lng: p.lng }));
    } else if (analysisPolygon && analysisPolygon.length > 0) {
      analysisPolygon.forEach(p => activeCoords.push({ lat: p.lat, lng: p.lng }));
    } else if (manualPois && manualPois.length > 0) {
      manualPois.forEach(p => activeCoords.push({ lat: p.lat, lng: p.lng }));
    }
    if (activeCoords.length === 0) {
      return { lat: 21.8853, lng: -102.2916 }; // fallback absoluto de última instancia si nada está definido
    }
    const lat = activeCoords.reduce((a, p) => a + p.lat, 0) / activeCoords.length;
    const lng = activeCoords.reduce((a, p) => a + p.lng, 0) / activeCoords.length;
    return { lat, lng };
  }, [photosWithCoords, analysisPolygon, manualPois]);

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

  // Se filtran los elementos con un estricto validador espacial para asegurar que pertenecen a la geografía activa
  const crimesWithCoords = useMemo(() => {
    const raw = (analysisResult?.historicalCrimes ?? []).filter((c) => hasValidCoords(c)) as Array<{ lat: number; lng: number; tipoDelito?: string }>;
    const hasActiveGeo = photosWithCoords.length > 0 || (isPreliminary && analysisPolygon && analysisPolygon.length >= 3) || (manualPois && manualPois.length > 0);
    if (!hasActiveGeo) return raw;
    return raw.filter(c => isPointInActiveGeography(c));
  }, [analysisResult?.historicalCrimes, isPointInActiveGeography, photosWithCoords.length, isPreliminary, analysisPolygon, manualPois]);

  const poisWithCoords = useMemo(() => {
    const raw = (analysisResult?.pois ?? []).filter((p) => hasValidCoords(p)) as Array<{ lat: number; lng: number; name?: string; type?: string }>;
    const hasActiveGeo = photosWithCoords.length > 0 || (isPreliminary && analysisPolygon && analysisPolygon.length >= 3) || (manualPois && manualPois.length > 0);
    if (!hasActiveGeo) return raw;
    return raw.filter(p => isPointInActiveGeography(p));
  }, [analysisResult?.pois, isPointInActiveGeography, photosWithCoords.length, isPreliminary, analysisPolygon, manualPois]);

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

  const lugaresAcecho = useMemo(() => {
    if (!analysisResult?.tacticalStreetViews) return [];
    return analysisResult.tacticalStreetViews.map((sv: any) => {
      const match = analysisResult.pois?.find((p) => p.name === sv.name);
      return { ...sv, lat: match?.lat, lng: match?.lng };
    }).filter((a: any) => a.lat != null && a.lng != null);
  }, [analysisResult]);

  const boundsPoints = useMemo(() => {
    const points: Array<{ lat: number; lng: number }> = [];
    photosWithCoords.forEach((p) => points.push({ lat: p.lat, lng: p.lng }));
    crimesWithCoords.forEach((c) => points.push({ lat: c.lat as number, lng: c.lng as number }));
    top5Pois.forEach((p) => points.push({ lat: p.lat as number, lng: p.lng as number }));
    return points;
  }, [photosWithCoords, crimesWithCoords, top5Pois]);

  const onMapLoad = useCallback((map: any) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady || typeof window === "undefined" || !(window as any).google?.maps || boundsPoints.length === 0) return;
    const g = (window as any).google;
    const bounds = new g.maps.LatLngBounds();
    boundsPoints.forEach((pt) => bounds.extend(new g.maps.LatLng(pt.lat, pt.lng)));
    mapRef.current.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
  }, [mapReady, boundsPoints]);

  // Efecto para calcular rutas tácticas reales sobre el trazado de las calles
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
            // Recorte geoespacial (clipping) de la ruta para que no salga del área de influencia activa
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
      for (let i = 0; i < top5Pois.length; i++) {
        const poiLatLng = { lat: top5Pois[i].lat as number, lng: top5Pois[i].lng as number };
        if (i % 2 === 0) {
          access.push(await fetchRoute(poiLatLng, center, "WALKING")); // Rutas de acceso / peatonales
        } else {
          escape.push(await fetchRoute(center, poiLatLng, "DRIVING")); // Rutas de fuga / vehiculares
        }
        await new Promise(r => setTimeout(r, 250)); // Pequeña pausa para no saturar la API de Google
      }
      setAccessRoutes(access);
      setEscapeRoutes(escape);
    };

    generateRoutes();
  }, [mapReady, viewMode, top5Pois, center]);

  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "") : "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: MAP_LIBRARIES,
    version: "3.64",
  });

  const heatmapCrimeData = useMemo(() => {
    if (
      !isLoaded ||
      !analysisResult?.historicalCrimes?.length ||
      typeof window === "undefined" ||
      !(window as any).google?.maps
    ) {
      return [];
    }
    const g = (window as any).google;
    const valid = analysisResult.historicalCrimes.filter((c) => hasValidCoords(c));
    if (valid.length === 0) return [];

    const cellSize = 0.0001;
    const grid = new Map<string, { lat: number; lng: number; weight: number }>();
    for (const c of valid) {
      const lat = c.lat as number;
      const lng = c.lng as number;
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
  }, [analysisResult?.historicalCrimes, isLoaded]);

  if (!apiKey || apiKey.trim() === "") {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-amber-400">
        <p className="font-semibold">Mapa no disponible</p>
        <p className="mt-1">Falta la clave de Google Maps (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). En móvil, asegúrese de que la app se sirve con la variable configurada.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-red-400 space-y-2">
        <p className="font-semibold">Error al cargar el mapa</p>
        <p>Verifique en Google Cloud: Maps JavaScript API y biblioteca Visualization habilitadas, clave sin restricciones que bloqueen este dominio o dispositivo (en Android use la misma URL que en escritorio o añada restricciones por sitio).</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400 min-h-[200px] flex items-center justify-center">
        Cargando mapa de Google…
      </div>
    );
  }


  return (
    <div className="flex flex-col w-full">
      <div className="relative w-full h-[600px] overflow-hidden bg-slate-100">
      {/* Sello de agua oficial */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden">
        <span className="text-white/40 font-bold text-4xl sm:text-6xl -rotate-45 select-none tracking-widest drop-shadow-lg">
          SSPE-CEIPOL
        </span>
      </div>

      {isPreliminary && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 shadow-lg">
          <span className="font-semibold tracking-tight text-emerald-300">
            Mapa preliminar
          </span>
          {setAnalysisPolygon && (
            <button
              type="button"
              onClick={() => {
                setIsDrawingPolygon((prev) => !prev);
                if (isDrawingPolygon && setAnalysisPolygon && (analysisPolygon?.length ?? 0) < 3) {
                  // Si se desactiva sin formar un polígono válido, limpiar
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
          // Si estamos en modo dibujo de perímetro, acumular vértices del polígono
          if (isDrawingPolygon && setAnalysisPolygon) {
            const current = analysisPolygon ?? [];
            setAnalysisPolygon([...current, pt]);
            return;
          }
          // Si estamos en modo POI manual, fijar un punto de interés
          if (setManualPois && isPlacingManualPoi) {
            const label = window.prompt(
              "Clasificación del punto (ej. Casa de Seguridad, Baldío, Taller):"
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
          mapTypeId: viewMode === "MOBILITY" ? "terrain" : "hybrid",
        }}
      >
        {!isPreliminary && geometryType !== "lineal" && geometryType !== "poligono" && (
          <Circle
            center={center}
            radius={analysisRadius}
            options={{
              strokeColor: "#ef4444",
              strokeOpacity: 0.8,
              strokeWeight: 3,
              fillColor: "#ef4444",
              fillOpacity: 0.15,
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
              fillOpacity: 0.4,
            }}
          />
        )}

        {/* Rutas de Acceso (Sombreando calles) */}
        {!isPreliminary && (viewMode === "MOBILITY" || viewMode === "PREDICTIVE") && accessRoutes.map((path, idx) => (
          <Polyline
            key={`route-access-${idx}`}
            path={path}
            options={{
              strokeColor: "#10b981", // Verde
              strokeOpacity: 0.6,
              strokeWeight: 8,
              zIndex: 10
            }}
          />
        ))}

        {/* Rutas de Fuga (Sombreando calles) */}
        {!isPreliminary && (viewMode === "MOBILITY" || viewMode === "PREDICTIVE") && escapeRoutes.map((path, idx) => (
          <Polyline
            key={`route-escape-${idx}`}
            path={path}
            options={{
              strokeColor: "#ef4444", // Rojo
              strokeOpacity: 0.6,
              strokeWeight: 8,
              zIndex: 10
            }}
          />
        ))}

        {/* Lugares de acecho punteados de la IA */}
        {!isPreliminary && viewMode === "MOBILITY" && lugaresAcecho.map((acecho: any, idx: number) => (
          <Polyline
            key={`acecho-dot-${idx}`}
            path={getDottedCirclePath(acecho.lat, acecho.lng, 50)}
            options={{
              strokeOpacity: 0,
              icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 2.5, strokeColor: "#0ea5e9" }, offset: "0", repeat: "12px" }],
              zIndex: 20
            }}
          />
        ))}

        {/* Lugares de acecho punteados MANUALES del fotógrafo */}
        {!isPreliminary && viewMode === "MOBILITY" && photosWithCoords.filter(p => p.tipo === "Lugar de Acecho").map((p: any, idx: number) => (
          <Polyline
            key={`acecho-manual-dot-${idx}`}
            path={getDottedCirclePath(p.lat, p.lng, 50)}
            options={{
              strokeOpacity: 0,
              icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 2.5, strokeColor: "#0ea5e9" }, offset: "0", repeat: "12px" }],
              zIndex: 20
            }}
          />
        ))}

        {/* Lugares de acecho con StreetView ilustrado */}
        {!isPreliminary && viewMode === "MOBILITY" && lugaresAcecho.map((acecho: any, idx: number) => (
          <OverlayView
            key={`acecho-${idx}`}
            position={{ lat: acecho.lat, lng: acecho.lng }}
            mapPaneName="overlayMouseTarget"
            getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -(height + 15) })}
          >
            <div className="bg-slate-900 border-2 border-sky-500 rounded-lg p-1 shadow-xl flex flex-col items-center w-28 relative">
              <img src={acecho.streetViewUrl} alt={acecho.name} className="w-full h-16 object-cover rounded-sm" />
              <span className="text-[8px] font-bold text-sky-200 mt-1 uppercase text-center leading-tight truncate w-full px-1" title={acecho.name}>{acecho.name}</span>
              <span className="text-[7px] text-slate-300 text-center mb-0.5">Lugar de Acecho</span>
              <div className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-sky-500"></div>
            </div>
          </OverlayView>
        ))}

        {(viewMode === "TOPOGRAPHY" || viewMode === "MOBILITY" || isPreliminary) && photosWithCoords.map((p) => {
          const pinColor = getMarkerColor(p.tipo);
          return (
            <Marker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              title={`${p.tipo} - ${p.comentario ?? ""}`}
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

        {photosWithCoords.length > 0 && viewMode !== "DENSITY" && (
          <Marker
            position={center}
            title="Centro del levantamiento fotográfico"
            icon={{
            path: 3 as any, // BACKWARD_CLOSED_ARROW
              scale: 8,
              fillColor: "#D96A00",
              fillOpacity: 1,
              strokeColor: "#1f2937",
              strokeWeight: 2,
            }}
          />
        )}

        {/* Delitos: puntos carmesí con cruz táctica */}
        {viewMode === "DENSITY" && crimesWithCoords.map((c, idx) => (
          <Marker
            key={`crime-${idx}`}
            position={{ lat: c.lat as number, lng: c.lng as number }}
            title={c.tipoDelito}
            label={{
              text: "❌",
              color: "#fee2e2",
              fontSize: "10px",
              fontWeight: "700",
            }}
            icon={{
            path: 0 as any, // CIRCLE
              fillColor: "#B22222",
              fillOpacity: 1,
              strokeColor: "#fecaca",
              strokeWeight: 1,
            }}
          />
        ))}

        {/* POIs / atractores Top 5: Numerados */}
        {(viewMode === "TOPOGRAPHY" || viewMode === "MOBILITY") && top5Pois.map((p, idx) => (
          <Fragment key={`attr-group-${idx}`}>
            <Circle
              center={{ lat: p.lat as number, lng: p.lng as number }}
              radius={120}
              options={{ fillColor: "#1F4E79", fillOpacity: 0.15, strokeColor: "#eab308", strokeWeight: 2, strokeOpacity: 0.8 }}
            />
            <Marker
              position={{ lat: p.lat as number, lng: p.lng as number }}
              label={{ text: `${idx + 1}`, color: "#000000", fontSize: "13px", fontWeight: "900" }}
              title={p.name} icon={{ path: 0 as any, scale: 8, fillColor: "#eab308", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 1 }}
            />
          </Fragment>
        ))}

        {/* Predicción a 6 meses: Expansión de zonas de riesgo */}
        {viewMode === "PREDICTIVE" && (
          <>
            <Circle
              center={center}
              radius={analysisRadius * 1.5}
              options={{ fillColor: "#B22222", fillOpacity: 0.15, strokeColor: "#B22222", strokeWeight: 2 }}
            />
            {top5Pois.map((p, idx) => (
              <Circle
                key={`pred-${idx}`}
                center={{ lat: p.lat as number, lng: p.lng as number }}
                radius={250}
                options={{ fillColor: "#D96A00", fillOpacity: 0.25, strokeColor: "#D96A00", strokeWeight: 2 }}
              />
            ))}
          </>
        )}

        {/* Polígono de análisis dibujado por el analista */}
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

        {/* POIs manuales fijados por el analista */}
        {manualPois?.map((p, idx) => (
          <Marker
            key={`manual-poi-${idx}`}
            position={{ lat: p.lat, lng: p.lng }}
            title={p.label || "POI manual"}
            icon={{
              path: 0 as any, // CIRCLE
              scale: 7,
              fillColor: "#f59e0b",
              fillOpacity: 1,
              strokeColor: "#1f2937",
              strokeWeight: 2,
            }}
          />
        ))}

        {viewMode === "DENSITY" && heatmapCrimeData.length > 0 && (
          <HeatmapLayer
            data={heatmapCrimeData}
            options={{
              radius: 40,
              dissipating: true,
              opacity: 0.8,
              gradient: [
                "rgba(46,139,87,0)",     // Verde #2E8B57
                "rgba(46,139,87,0.4)",
                "rgba(230,167,0,0.6)",   // Amarillo #E6A700
                "rgba(217,106,0,0.8)",   // Naranja #D96A00
                "rgba(178,34,34,1)",     // Rojo #B22222
              ],
            }}
          />
        )}
      </GoogleMap>
      </div>

      {/* Leyenda Institucional Externa (Debajo del Mapa) */}
      {!isPreliminary && (
        <div className="bg-white border-t border-slate-300 p-4 text-[11px] text-[#222222] w-full">
          <div className="font-bold mb-2 border-b border-gray-300 pb-1 text-[#0D2B52] uppercase tracking-wide">
            {viewMode === "DENSITY" && "Simbología: Densidad Criminológica"}
            {viewMode === "TOPOGRAPHY" && "Simbología: Topografía del Entorno"}
            {viewMode === "MOBILITY" && "Simbología: Atractores, Corredores y Rutas de Riesgo"}
            {viewMode === "PREDICTIVE" && "Simbología: Evolución a 6 Meses"}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 mt-2">
            {viewMode === "DENSITY" && (
              <>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#B22222]"></span> Alta Concentración (Hotspot)</div>
                 <div className="flex items-center gap-2"><span className="text-[12px]">❌</span> Evento Histórico</div>
              </>
            )}
            {viewMode === "TOPOGRAPHY" && (
              <>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#eab308]"></span> Negocios Detectados (DENUE)</div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#1F4E79] opacity-20 border border-[#eab308]"></span> Radio de Influencia (120m)</div>
              </>
            )}
            {viewMode === "MOBILITY" && (
              <>
                 {top5Pois.map((p, idx) => (
                   <div key={`legend-attr-${idx}`} className="flex items-center gap-1.5">
                     <span className="w-4 h-4 rounded-full bg-[#eab308] border border-black text-[10px] flex items-center justify-center text-black font-bold shrink-0">{idx + 1}</span>
                     <span className="truncate max-w-[200px] font-semibold text-slate-700" title={p.name}>{p.name}</span>
                   </div>
                 ))}
                 {top5Pois.length === 0 && <div className="text-gray-500 italic">No hay atractores detectados</div>}
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#1F4E79] opacity-20 border border-[#eab308]"></span> Área de Influencia Directa</div>
                 <div className="flex items-center gap-2"><span className="w-6 h-2 bg-[#10b981] opacity-60"></span> Rutas de Acceso</div>
                 <div className="flex items-center gap-2"><span className="w-6 h-2 bg-[#ef4444] opacity-60"></span> Rutas de Fuga</div>
                 <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-dashed border-[#0ea5e9]"></span> Lugar de Acecho</div>
              </>
            )}
            {viewMode === "PREDICTIVE" && (
              <>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#B22222] opacity-40"></span> Expansión de Riesgo Crítico</div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#D96A00] opacity-50"></span> Agravamiento Focalizado</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
