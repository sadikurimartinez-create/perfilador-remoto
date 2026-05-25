"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, GoogleMap, HeatmapLayer, Marker, Polygon, Polyline, useJsApiLoader } from "@react-google-maps/api";
import type { AlbumPhoto, AnalysisResult } from "@/context/ProjectContext";

export type MapViewMode = "HEATMAP" | "ECOLOGY" | "MOBILITY";

type AnalysisMapProps = {
  album: AlbumPhoto[];
  analysisResult: AnalysisResult | null;
  /** Radio de la zona de análisis en metros (círculo en el mapa). Por defecto 500. */
  analysisRadius?: number;
  /** Polígono de análisis dibujado manualmente por el analista. */
  analysisPolygon?: google.maps.LatLngLiteral[];
  setAnalysisPolygon?: (coords: google.maps.LatLngLiteral[]) => void;
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
const getSeverityWeight = (crimeName: string) => {
  const name = crimeName.toLowerCase();
  if (name.includes("homicidio") || name.includes("secuestro") || name.includes("arma") || name.includes("violación")) return 5;
  if (name.includes("robo") || name.includes("asalto") || name.includes("extorsión") || name.includes("narcomenudeo")) return 4;
  if (name.includes("lesiones") || name.includes("violencia") || name.includes("amenaza")) return 3;
  return 2; 
};

const MAP_LIBRARIES: ("places" | "visualization" | "drawing")[] = ["places", "visualization", "drawing"];

const containerStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "500px",
  height: "65vh",
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
  viewMode = "HEATMAP",
  geometryType,
}: AnalysisMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isPlacingManualPoi, setIsPlacingManualPoi] = useState(false);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);

  const photosWithCoords = useMemo(
    () => album.filter(hasValidCoords) as Array<{ id: string; lat: number; lng: number; tipo: string; comentario: string }>,
    [album]
  );

  const center = useMemo(() => {
    if (photosWithCoords.length === 0) return { lat: 21.88, lng: -102.29 };
    const lat = photosWithCoords.reduce((a, p) => a + p.lat, 0) / photosWithCoords.length;
    const lng = photosWithCoords.reduce((a, p) => a + p.lng, 0) / photosWithCoords.length;
    return { lat, lng };
  }, [photosWithCoords]);

  const crimesWithCoords = useMemo(
    () => (analysisResult?.historicalCrimes ?? []).filter((c) => hasValidCoords(c)),
    [analysisResult?.historicalCrimes]
  );

  const poisWithCoords = useMemo(
    () => (analysisResult?.pois ?? []).filter((p) => hasValidCoords(p)),
    [analysisResult?.pois]
  );

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

  const boundsPoints = useMemo(() => {
    const points: Array<{ lat: number; lng: number }> = [];
    photosWithCoords.forEach((p) => points.push({ lat: p.lat, lng: p.lng }));
    crimesWithCoords.forEach((c) => points.push({ lat: c.lat as number, lng: c.lng as number }));
    top5Pois.forEach((p) => points.push({ lat: p.lat as number, lng: p.lng as number }));
    return points;
  }, [photosWithCoords, crimesWithCoords, top5Pois]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady || typeof window === "undefined" || !(window as any).google || boundsPoints.length === 0) return;
    const g = (window as any).google as typeof google;
    const bounds = new g.maps.LatLngBounds();
    boundsPoints.forEach((pt) => bounds.extend(new g.maps.LatLng(pt.lat, pt.lng)));
    mapRef.current.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
  }, [mapReady, boundsPoints]);

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
      !(window as any).google
    ) {
      return [];
    }
    const g = (window as any).google as typeof google;
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

  const getPoiIcon = (category?: string | null): { emoji: string; bg: string } => {
    switch (category) {
      case "escuela":
        return { emoji: "🏫", bg: "#0ea5e9" };
      case "expendioAlcohol":
        return { emoji: "🍺", bg: "#eab308" };
      case "chatarreraOTaller":
        return { emoji: "🛠️", bg: "#f97316" };
      case "otro":
      default:
        return { emoji: "📍", bg: "#22c55e" };
    }
  };

  return (
    <div className="relative rounded-xl border-2 border-slate-700 shadow-xl overflow-hidden bg-slate-900/50">
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

      {/* LEYENDA DEL TOP 5 POIs (SOLO MODO ECOLOGY) */}
      {!isPreliminary && viewMode === "ECOLOGY" && top5Pois.length > 0 && (
        <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-600 p-3 rounded-lg shadow-2xl z-20 max-w-[280px]">
          <h4 className="text-xs font-bold text-amber-400 mb-2 border-b border-slate-600 pb-1 uppercase tracking-wider">Top 5 Atractores de Riesgo</h4>
          <ul className="text-[10px] text-slate-200 space-y-2">
            {top5Pois.map((p, i) => (
              <li key={i} className="leading-tight flex gap-2">
                <span className="flex-shrink-0 bg-amber-500 text-slate-900 font-bold w-4 h-4 rounded-full flex items-center justify-center">{i+1}</span>
                <div>
                  <span className="font-bold text-amber-200 block">{p.name}</span>
                  <span className="text-slate-400">{p.category}</span>
                </div>
              </li>
            ))}
          </ul>
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
              strokeColor: "#8b5cf6",
              strokeOpacity: 0.9,
              strokeWeight: 4,
              fillColor: "#8b5cf6",
              fillOpacity: 0.4,
            }}
          />
        )}

        {/* Pines tácticos: se basan en el tipo de evidencia seleccionada */}
        {viewMode === "MOBILITY" && photosWithCoords.map((p) => {
          const pinColor = getMarkerColor(p.tipo);
          return (
            <Marker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              title={`${p.tipo} - ${p.comentario ?? ""}`}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: pinColor,
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              }}
            />
          );
        })}

        {photosWithCoords.length > 0 && (
          <Marker
            position={center}
            title="Centro del levantamiento fotográfico"
            icon={{
              path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: 8,
              fillColor: "#f97316",
              fillOpacity: 1,
              strokeColor: "#1f2937",
              strokeWeight: 2,
            }}
          />
        )}

        {/* Delitos: puntos carmesí con cruz táctica */}
        {viewMode === "HEATMAP" && crimesWithCoords.map((c, idx) => (
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
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: "#7f1d1d",
              fillOpacity: 1,
              strokeColor: "#fecaca",
              strokeWeight: 1,
            }}
          />
        ))}

        {/* POIs / atractores Top 5: Numerados */}
        {viewMode === "ECOLOGY" && top5Pois.map((p, idx) => (
          <Marker
            key={`top-poi-${idx}`}
            position={{ lat: p.lat as number, lng: p.lng as number }}
            title={p.name}
            label={{
              text: `${idx + 1}`,
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: "bold",
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#eab308", 
              fillOpacity: 1,
              strokeColor: "#000000",
              strokeWeight: 2,
            }}
          />
        ))}

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
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: "#f59e0b",
              fillOpacity: 1,
              strokeColor: "#1f2937",
              strokeWeight: 2,
            }}
          />
        ))}

        {viewMode === "HEATMAP" && heatmapCrimeData.length > 0 && (
          <HeatmapLayer
            data={heatmapCrimeData}
            options={{
              radius: 40,
              dissipating: true,
              opacity: 0.7,
              gradient: [
                "rgba(0,255,0,0)",
                "rgba(0,255,0,0.4)",
                "rgba(255,255,0,0.6)",
                "rgba(255,165,0,0.8)",
                "rgba(255,0,0,1)",
              ],
            }}
          />
        )}
      </GoogleMap>

      <div className="p-3 border-t border-slate-700 bg-slate-900/90 space-y-2">
        <div className="flex flex-col gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-slate-200">Simbología Táctica de Evidencia:</span>
            <div className="flex flex-wrap items-center gap-3">
              {geometryType === "lineal" ? (
                <>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-[#10b981] border border-white" /> Nodo Inicial</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-[#3b82f6] border border-white" /> Corredor</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-[#ef4444] border border-white" /> Nodo Final</span>
                </>
              ) : geometryType === "poligono" ? (
                <>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-[#8b5cf6] border border-white" /> Perímetro</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-[#f97316] border border-white" /> Interior</span>
                </>
              ) : (
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-[#dc2626] border border-white" /> Nodo Principal</span>
              )}
            </div>
          </div>
          <div className="h-px w-full bg-slate-700 my-1" />
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-sky-400" />
            <span className="text-slate-400">
              <span className="font-semibold text-slate-200">Atractores:</span>{" "}
              Escuelas, comercios y otros puntos de interés (POIs).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]">❌</span>
            <span className="text-slate-400">
              <span className="font-semibold text-slate-200">Incidencia:</span>{" "}
              Delitos históricos (Puntos individuales).
            </span>
          </div>
        </div>
        {heatmapCrimeData.length > 0 && (
          <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
            <span className="font-medium text-slate-400">Heatmap:</span>
            Verde (baja) → Amarillo → Rojo (alta concentración).
          </p>
        )}
      </div>
    </div>
  );
}
