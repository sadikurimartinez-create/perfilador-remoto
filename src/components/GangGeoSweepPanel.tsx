"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { GoogleMap, Marker, Circle, Polyline, useJsApiLoader, InfoWindow } from "@react-google-maps/api";
import { GangGeoSweepEngine, GangSweepResult, getHaversineDistance } from "@/lib/providers/gangGeoSweepEngine";
import { PandillasService } from "@/modules/pandillas/pandillas.service";
import { getDb } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useProject } from "@/context/ProjectContext";

const MAP_LIBRARIES: ("places" | "visualization" | "drawing")[] = ["places", "visualization", "drawing"];

const containerStyle = {
  width: "100%",
  height: "450px",
  borderRadius: "16px",
};

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#38bdf8" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3b82f6" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#020617" }] },
];

interface GangGeoSweepPanelProps {
  projectId: string;
  project: any;
  onUpdateProject: () => Promise<void>;
}

export function GangGeoSweepPanel({ projectId, project, onUpdateProject }: GangGeoSweepPanelProps) {
  const { registerSweep } = useProject();
  // Input fields
  const [narrative, setNarrative] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ name: string; size: string; preview: string }[]>([]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  // Sweep result
  const [sweepResult, setSweepResult] = useState<GangSweepResult | null>(null);

  // Map settings and layers visibility toggle
  const [showDomiciles, setShowDomiciles] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showRelationships, setShowRelationships] = useState(true);

  // Map instance & info window
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);
  const [baseLayer, setBaseLayer] = useState<"standard" | "satellite">("standard");

  const handleZoomIn = () => {
    if (map) {
      const zoom = map.getZoom();
      if (zoom !== undefined) map.setZoom(zoom + 1);
    }
  };

  const handleZoomOut = () => {
    if (map) {
      const zoom = map.getZoom();
      if (zoom !== undefined) map.setZoom(zoom - 1);
    }
  };

  const handleResetView = () => {
    if (map && mapCenter) {
      map.setCenter(mapCenter);
      map.setZoom(13);
    }
  };

  // Pre-load Google Maps API
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: MAP_LIBRARIES,
  });

  // Load existing linked report if present
  useEffect(() => {
    if (project?.linkedGangReport && project?.linkedGeoReportId?.startsWith("CEIPOL-SWEEP-")) {
      setSweepResult(project.linkedGangReport as GangSweepResult);
    }
  }, [project]);

  // Convert File size to readable format
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Handle files select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadedFiles(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreviews(prev => [
          ...prev,
          {
            name: file.name,
            size: formatSize(file.size),
            preview: reader.result as string,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove uploaded file
  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Execute the automated spatial sweeps
  const handleRunGeoSweep = async () => {
    if (!narrative.trim()) {
      alert("⚠️ Por favor describa qué información desea localizar dentro de la Base de Datos de Pandillas.");
      return;
    }

    setIsProcessing(true);
    setProgressMsg("Iniciando barrido de base de datos...");

    try {
      // Step 1: Simulated delays for realistic premium feeling
      await new Promise(resolve => setTimeout(resolve, 800));
      setProgressMsg("Cruzando información con el inventario de pandillas...");
      const dbGangs = await PandillasService.getAllGangs();

      if (dbGangs.length === 0) {
        setSweepResult(null);
        alert("No hay pandillas productivas persistidas disponibles para ejecutar el barrido.");
        return;
      }

      // Step 2: Run the custom spatial sweep engine
      await new Promise(resolve => setTimeout(resolve, 800));
      setProgressMsg("Consolidando registros de inteligencia...");
      const result = await GangGeoSweepEngine.executeSweep(
        uploadedFiles,
        narrative,
        "",
        dbGangs
      );

      setSweepResult(result);
      setIsProcessing(false);
      setProgressMsg("");
    } catch (err: any) {
      console.error("[GangGeoSweepPanel] Error during sweep:", err);
      alert("❌ Ocurrió un error inesperado al procesar el barrido: " + err.message);
      setIsProcessing(false);
    }
  };

  // Reset the panel
  const handleClearForm = () => {
    setNarrative("");
    setUploadedFiles([]);
    setFilePreviews([]);
    setSweepResult(null);
  };

  // Save/Link results back to current Project file in Firestore
  const handleLinkSweepToProject = async () => {
    if (!sweepResult || !projectId) return;

    try {
      setIsProcessing(true);
      setProgressMsg("Vinculando resultados del barrido al expediente...");

      const db = getDb();
      const projectRef = doc(db, "projects", projectId);

      const generatedId = `CEIPOL-SWEEP-${sweepResult.matched_gangs[0]?.name.toUpperCase().replace(/[^A-Z0-9]/g, "") || "UNKNOWN"}-${sweepResult.risk_classification}-${Date.now().toString().slice(-4)}`;

      // Save sweep result in project document
      await updateDoc(projectRef, {
        linkedGeoReportId: generatedId,
        linkedGangReport: sweepResult,
      });

      const gangsList = sweepResult.matched_gangs.map(mg => `${mg.name} (${Math.round(mg.match_strength * 100)}% match)`).join(", ");
      const domicilesList = sweepResult.suspected_domiciles.map((d, idx) => `Domicilio ${idx + 1}: ${d.address}`).join("; ");
      const sweepSummary = `[BARRIDO DE PANDILLAS (GIS)]\nID Reporte: ${generatedId}\nPandillas identificadas: ${gangsList || "Ninguna"}\nDomicilios sospechosos: ${domicilesList || "Ninguno"}\nNivel de riesgo: ${sweepResult.risk_classification}\nInstrucción de búsqueda: ${narrative}`;

      await registerSweep({
        engine: "Barrido de Pandillas (GIS)",
        source: "GEOINT",
        type: "Contextualizada",
        relevance: "Alto",
        data: sweepSummary,
        initialContext: narrative,
        createVisualEvidence: false
      });

      await onUpdateProject();
    } catch (err: any) {
      console.error("[GangGeoSweepPanel] Error linking sweep:", err);
      alert("❌ Error al guardar y vincular el barrido: " + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  // Calculate Map center based on detected locations
  const mapCenter = useMemo(() => {
    if (sweepResult && sweepResult.detected_locations.length > 0) {
      // average center
      let latSum = 0;
      let lngSum = 0;
      sweepResult.detected_locations.forEach(pt => {
        latSum += pt.lat;
        lngSum += pt.lng;
      });
      return {
        lat: latSum / sweepResult.detected_locations.length,
        lng: lngSum / sweepResult.detected_locations.length,
      };
    }
    return null; // No demonstrated geography: do not fabricate a visual center
  }, [sweepResult]);

  const heatmapData = useMemo(() => {
    if (!isLoaded || !sweepResult || !showHeatmap || typeof window === "undefined" || !(window as any).google?.maps?.LatLng) return [];
    return sweepResult.geo_heatmap.map(pt => ({
      location: new (window as any).google.maps.LatLng(pt.lat, pt.lng),
      weight: pt.weight * 5,
    }));
  }, [sweepResult, showHeatmap, isLoaded]);

  // Calculate Node Relationships polyline paths
  // Links activity clusters to suspected domiciles and centroids
  const relationshipLines = useMemo(() => {
    if (!sweepResult || !showRelationships) return [];
    const lines: { path: { lat: number; lng: number }[]; color: string }[] = [];

    sweepResult.detected_locations.forEach(loc => {
      sweepResult.suspected_domiciles.forEach(dom => {
        const dist = getHaversineDistance(loc, dom);
        if (dist < 450) {
          lines.push({
            path: [loc, dom],
            color: "#e2e8f0", // Subtle grey path
          });
        }
      });
    });

    return lines;
  }, [sweepResult, showRelationships]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
              📡 Barrido de Pandillas
            </h3>
          </div>
        </div>

        {/* Input Pipeline (Only display when no active sweep result is shown) */}
        {!sweepResult && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                Barrido Soft
              </label>
              <textarea
                placeholder="Ejemplos:
• Buscar integrantes relacionados con...
• Localizar pandillas que operen en...
• Buscar domicilios asociados a...
• Identificar zonas de influencia cercanas a...
• Buscar pandillas rivales de...
• Localizar grafitis relacionados con..."
                value={narrative}
                onChange={e => setNarrative(e.target.value)}
                rows={6}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition-colors"
              />
              <span className="text-[10px] text-slate-400 italic block mt-1">
                Describa qué información desea localizar dentro de la Base de Datos de Pandillas.
              </span>
            </div>

            <button
              type="button"
              onClick={handleRunGeoSweep}
              disabled={isProcessing}
              className="w-full h-[45px] bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 hover:opacity-90 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent" />
                  <span>Procesando...</span>
                </>
              ) : (
                <span>Ejecutar Barrido</span>
              )}
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {isProcessing && progressMsg && (
          <div className="p-8 border border-sky-500/20 bg-slate-950/90 rounded-2xl flex flex-col items-center justify-center space-y-4 animate-fadeIn">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-sky-500 border-t-transparent" />
            <p className="text-xs text-sky-400 font-mono tracking-widest uppercase animate-pulse text-center font-bold">
              {progressMsg}
            </p>
          </div>
        )}

        {/* Sweep Output (Interactive map, sidebar and results) */}
        {sweepResult && !isProcessing && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* GIS Output MAP (8 cols) */}
              <div className="lg:col-span-8 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">
                    🗺️ Mapa Táctico Multicapa de Influencia
                  </span>

                  {/* Layer Checkboxes */}
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showClusters}
                        onChange={e => setShowClusters(e.target.checked)}
                        className="rounded accent-sky-500"
                      />
                      <span>Clusters Actividad</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDomiciles}
                        onChange={e => setShowDomiciles(e.target.checked)}
                        className="rounded accent-emerald-500"
                      />
                      <span>Domicilios Inferidos</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showZones}
                        onChange={e => setShowZones(e.target.checked)}
                        className="rounded accent-red-500"
                      />
                      <span>Zonas Influencia</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showHeatmap}
                        onChange={e => setShowHeatmap(e.target.checked)}
                        className="rounded accent-orange-500"
                      />
                      <span>Heatmap</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showRelationships}
                        onChange={e => setShowRelationships(e.target.checked)}
                        className="rounded accent-indigo-500"
                      />
                      <span>Relaciones Nodos</span>
                    </label>
                  </div>
                </div>

                {isLoaded && mapCenter ? (
                  <div className="border border-slate-800 rounded-2xl overflow-hidden relative">
                    {/* Zoom & Base Layer Controls Overlay */}
                    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-slate-950/90 border border-slate-800 p-2.5 rounded-xl shadow-2xl">
                      <div className="text-[9px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-850 pb-1 mb-1">
                        Controles Zoom
                      </div>
                      <div className="flex gap-1.5 justify-center mb-1">
                        <button
                          onClick={handleZoomIn}
                          className="w-7 h-7 rounded-md bg-slate-900 hover:bg-slate-800 hover:text-blue-400 text-white font-extrabold text-sm border border-slate-800 flex items-center justify-center transition-all cursor-pointer select-none"
                          title="Zoom In"
                        >
                          +
                        </button>
                        <button
                          onClick={handleZoomOut}
                          className="w-7 h-7 rounded-md bg-slate-900 hover:bg-slate-800 hover:text-blue-400 text-white font-extrabold text-sm border border-slate-800 flex items-center justify-center transition-all cursor-pointer select-none"
                          title="Zoom Out"
                        >
                          -
                        </button>
                        <button
                          onClick={handleResetView}
                          className="px-2 h-7 rounded-md bg-slate-900 hover:bg-slate-800 hover:text-blue-400 text-slate-350 font-bold text-[8px] uppercase border border-slate-800 transition-all cursor-pointer flex items-center justify-center select-none"
                          title="Reset View"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="text-[9px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-850 pb-1 mb-1">
                        Capa Base
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setBaseLayer("standard")}
                          className={`flex-1 py-1 px-2 rounded text-[8px] font-black uppercase border transition-all ${
                            baseLayer === "standard"
                              ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                              : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-355"
                          }`}
                        >
                          Mapa
                        </button>
                        <button
                          onClick={() => setBaseLayer("satellite")}
                          className={`flex-1 py-1 px-2 rounded text-[8px] font-black uppercase border transition-all ${
                            baseLayer === "satellite"
                              ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                              : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-355"
                          }`}
                        >
                          Satélite
                        </button>
                      </div>
                    </div>

                    <GoogleMap
                      mapContainerStyle={containerStyle}
                      center={mapCenter}
                      zoom={14.5}
                      onLoad={mapInstance => setMap(mapInstance)}
                      mapTypeId={baseLayer === "standard" ? "roadmap" : "satellite"}
                      options={{
                        styles: baseLayer === "standard" ? darkMapStyles : [],
                        disableDefaultUI: true,
                        zoomControl: false,
                        mapTypeControl: false,
                        streetViewControl: false,
                        scrollwheel: false,
                        gestureHandling: "cooperative"
                      }}
                    >
                      {/* 1. DENSITY HEAT CLUSTERS (REPLACING DEPRECATED GOOGLE HEATMAPLAYER) */}
                      {showHeatmap &&
                        sweepResult.geo_heatmap.map((pt, idx) => (
                          <Circle
                            key={`heat-${idx}`}
                            center={{ lat: pt.lat, lng: pt.lng }}
                            radius={220 + pt.weight * 60}
                            options={{
                              fillColor: "#f43f5e",
                              fillOpacity: Math.min(pt.weight * 0.12, 0.65),
                              strokeColor: "#f43f5e",
                              strokeOpacity: 0.2,
                              strokeWeight: 1,
                              clickable: false,
                            }}
                          />
                        ))}

                      {/* 2. ACTIVITY CLUSTERS LAYER */}
                      {showClusters &&
                        sweepResult.detected_locations.map((loc, idx) => (
                          <Marker
                            key={`loc-${idx}`}
                            position={{ lat: loc.lat, lng: loc.lng }}
                            icon={{
                              path: 0, // SymbolPath.CIRCLE
                              fillColor: loc.source === "EXIF_GPS" ? "#38bdf8" : "#a855f7",
                              fillOpacity: 0.9,
                              strokeColor: "#0f172a",
                              strokeWeight: 1.5,
                              scale: 7,
                            }}
                            title={loc.label}
                            onClick={() => setSelectedPoint({ ...loc, type: "cluster" })}
                          />
                        ))}

                      {/* 3. INFERRED DOMICILES LAYER */}
                      {showDomiciles &&
                        sweepResult.suspected_domiciles.map((dom, idx) => (
                          <Marker
                            key={`dom-${idx}`}
                            position={{ lat: dom.lat, lng: dom.lng }}
                            icon={{
                              path: 1, // SymbolPath.FORWARD_CLOSED_ARROW
                              fillColor: "#34d399",
                              fillOpacity: 0.9,
                              strokeColor: "#065f46",
                              strokeWeight: 1.5,
                              scale: 6,
                              rotation: 90,
                            }}
                            title={`Domicilio Inferido: ${dom.address}`}
                            onClick={() => setSelectedPoint({ ...dom, type: "domicilio" })}
                          />
                        ))}

                      {/* 4. INFLUENCE ZONES LAYER */}
                      {showZones &&
                        sweepResult.influence_zones.map((zone, idx) => (
                          <Circle
                            key={`zone-${idx}`}
                            center={{ lat: zone.lat, lng: zone.lng }}
                            radius={zone.radiusMetros}
                            options={{
                              fillColor:
                                zone.type === "hotspot" ? "#ef4444" :
                                zone.type === "corridor" ? "#f97316" : "#3b82f6",
                              fillOpacity: 0.12,
                              strokeColor:
                                zone.type === "hotspot" ? "#dc2626" :
                                zone.type === "corridor" ? "#ea580c" : "#2563eb",
                              strokeOpacity: 0.5,
                              strokeWeight: 1.5,
                            }}
                          />
                        ))}

                      {/* 5. NODE RELATIONSHIPS LAYER */}
                      {showRelationships &&
                        relationshipLines.map((line, idx) => (
                          <Polyline
                            key={`line-${idx}`}
                            path={line.path}
                            options={{
                              strokeColor: line.color,
                              strokeOpacity: 0.6,
                              strokeWeight: 1.5,
                              geodesic: true,
                            }}
                          />
                        ))}

                      {/* INFO WINDOW */}
                      {selectedPoint && (
                        <InfoWindow
                          position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
                          onCloseClick={() => setSelectedPoint(null)}
                        >
                          <div className="p-2 text-slate-900 max-w-[200px] text-xs space-y-1">
                            <p className="font-extrabold uppercase text-[10px] text-sky-600">
                              {selectedPoint.type === "cluster" ? "📡 Indicio Espacial" : "🏠 Inferencia Territorial"}
                            </p>
                            <h4 className="font-bold leading-snug">{selectedPoint.label || selectedPoint.address}</h4>
                            <p className="text-[10px] text-slate-500 font-medium">
                              Confianza: <strong className="text-slate-800">{Math.round(selectedPoint.confidence * 100)}%</strong>
                            </p>
                            {selectedPoint.source && (
                              <p className="text-[9px] text-slate-400 font-mono">Origen: {selectedPoint.source}</p>
                            )}
                          </div>
                        </InfoWindow>
                      )}
                    </GoogleMap>
                  </div>
                ) : (
                  <div className="h-[450px] bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-xs text-slate-500 italic">
                    {isLoaded ? "Sin geografia demostrada para representar este barrido en el mapa." : "Cargando servicios de georreferencia de Google Maps..."}
                  </div>
                )}
              </div>

              {/* SIDEBAR DETAILED METRICS (4 cols) */}
              <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Score de Confianza</p>
                    <div className="flex items-end gap-2.5">
                      <span className="text-4xl font-black text-sky-400 leading-none">
                        {Math.round(sweepResult.confidence_score * 100)}%
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                        sweepResult.risk_classification === "CRITICAL" ? "bg-red-950/60 border-red-900/50 text-red-400" :
                        sweepResult.risk_classification === "HIGH" ? "bg-orange-950/60 border-orange-900/50 text-orange-400" :
                        "bg-sky-950/60 border-sky-900/50 text-sky-400"
                      }`}>
                        {sweepResult.risk_classification} RISK
                      </span>
                    </div>
                  </div>

                  {/* Matched Gangs */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pandillas Detectadas (OSINT)</p>
                    <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 space-y-3">
                      {sweepResult.matched_gangs.map((mg, idx) => (
                        <div key={idx} className="space-y-1.5 last:border-0 last:pb-0">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-200 uppercase">
                            <span>{mg.name}</span>
                            <span className="text-sky-400">{Math.round(mg.match_strength * 100)}% Match</span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-sky-400 to-blue-500 h-full transition-all duration-500"
                              style={{ width: `${mg.match_strength * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Domicilios sospechosos list */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inferencia de Domicilios</p>
                    <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                      {sweepResult.suspected_domiciles.map((dom, idx) => (
                        <div key={idx} className="text-[11px] leading-relaxed border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                          <p className="font-extrabold text-slate-200">🏠 Domicilio {idx + 1}</p>
                          <p className="text-slate-400 mt-0.5">{dom.address}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5 font-bold">Confianza: {Math.round(dom.confidence * 100)}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Linking action */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="flex-1 py-3 border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 text-xs font-black uppercase tracking-wide rounded-xl"
                  >
                    Nuevo Análisis
                  </button>
                  <button
                    type="button"
                    onClick={handleLinkSweepToProject}
                    className="flex-1 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black uppercase tracking-wide rounded-xl shadow-md transition-all"
                  >
                    Vincular a Expediente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
