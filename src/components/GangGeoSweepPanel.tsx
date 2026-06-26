"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { GoogleMap, Marker, Circle, Polyline, HeatmapLayer, useJsApiLoader, InfoWindow } from "@react-google-maps/api";
import { GangGeoSweepEngine, GangSweepResult, getHaversineDistance } from "@/lib/providers/gangGeoSweepEngine";
import { PandillasService } from "@/modules/pandillas/pandillas.service";
import { getDb } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

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
  // Input fields
  const [narrative, setNarrative] = useState("");
  const [softPrompt, setSoftPrompt] = useState("");
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

  // Pre-load Google Maps API
  const apiKey = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc") : "AIzaSyDSO_b0Hi9XEt5eB1vNH9AFoKYQ_a2d0Fc";
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
      alert("⚠️ Por favor describe el contexto del evento observado antes de iniciar el barrido.");
      return;
    }

    setIsProcessing(true);
    setProgressMsg("Iniciando Extracción de Capa de Datos...");

    try {
      // Step 1: Simulated delays for realistic premium feeling
      await new Promise(resolve => setTimeout(resolve, 800));
      setProgressMsg("Extrayendo geolocalización EXIF de evidencia...");

      // Step 2: Query existing registered gangs database to cross-reference
      await new Promise(resolve => setTimeout(resolve, 600));
      setProgressMsg("Cruzando datos con el Inventario Estatal de Pandillas...");
      const dbGangs = await PandillasService.getAllGangs();

      // Step 3: Run the custom spatial sweep engine
      await new Promise(resolve => setTimeout(resolve, 650));
      setProgressMsg("Correlacionando patrones geoespaciales y OSINT...");
      const result = await GangGeoSweepEngine.executeSweep(
        uploadedFiles,
        narrative,
        softPrompt,
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
    setSoftPrompt("");
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

      await onUpdateProject();
      alert("✅ ¡Resultados del barrido geosemántico vinculados exitosamente al expediente actual!");
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
    return { lat: 21.8821, lng: -102.2961 }; // Default Aguascalientes
  }, [sweepResult]);

  // Construct Heatmap points for Google Maps API format
  const heatmapData = useMemo(() => {
    if (!sweepResult || !showHeatmap || typeof window === "undefined" || !(window as any).google) return [];
    return sweepResult.geo_heatmap.map(pt => ({
      location: new google.maps.LatLng(pt.lat, pt.lng),
      weight: pt.weight * 5,
    }));
  }, [sweepResult, showHeatmap]);

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
              🧠 Descubrimiento Geoespacial Basado en Evidencia
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Rastreo geosemántico táctico utilizando análisis EXIF, estimación visual y cruce territorial OSINT.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold bg-sky-950 text-sky-400 border border-sky-900/50 px-3 py-1 rounded-full uppercase tracking-widest">
            Automatizado v3.0
          </span>
        </div>

        {/* Input Pipeline (Only display when no active sweep result is shown) */}
        {!sweepResult && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Context forms (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                  1. Contexto Narrativo del Evento *
                </label>
                <textarea
                  placeholder="Describe la situación observada, calle, colonia o indicios visuales relevantes (Ej. 'Se avistaron sujetos del grupo Los Monstruos realizando pintas tipo frontera en el sector Loma del Cardenal, cerca de Mirador de las Culturas, portando marcas alusivas...')"
                  value={narrative}
                  onChange={e => setNarrative(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider block flex justify-between">
                  <span>2. Análisis de Entorno (Soft Prompt)</span>
                  <span className="text-[10px] text-slate-500 italic lowercase">Opcional</span>
                </label>
                <textarea
                  placeholder="Describe personas, vestimenta, actividad urbana o contexto demográfico del entorno..."
                  value={softPrompt}
                  onChange={e => setSoftPrompt(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:border-sky-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Photo Drops & Metadata (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                  3. Módulo de Evidencia Fotográfica (Múltiples)
                </label>

                {/* Upload Trigger Area */}
                <div className="border border-dashed border-slate-800 hover:border-sky-500/50 bg-slate-950/40 rounded-xl p-6 transition-all text-center relative group">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="text-2xl block mb-1">📸</span>
                  <span className="text-xs font-extrabold text-slate-300 block">Arrastrar o seleccionar imágenes</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Soporte EXIF GPS parser & visual estimate</span>
                </div>

                {/* Previews Grid */}
                {filePreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2 max-h-[140px] overflow-y-auto pr-1">
                    {filePreviews.map((f, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-800 group h-[55px]">
                        <img src={f.preview} alt="upload preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="absolute inset-0 bg-red-950/80 text-white font-bold text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕ Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Execution Block */}
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
                  <>
                    <span>📡 Lanzar Barrido Geosemántico</span>
                  </>
                )}
              </button>
            </div>
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

                {isLoaded ? (
                  <div className="border border-slate-800 rounded-2xl overflow-hidden relative">
                    <GoogleMap
                      mapContainerStyle={containerStyle}
                      center={mapCenter}
                      zoom={14.5}
                      onLoad={mapInstance => setMap(mapInstance)}
                      options={{
                        styles: darkMapStyles,
                        disableDefaultUI: false,
                        zoomControl: true,
                        mapTypeControl: false,
                        streetViewControl: false,
                      }}
                    >
                      {/* 1. HEATMAP LAYER */}
                      {showHeatmap && heatmapData.length > 0 && (
                        <HeatmapLayer data={heatmapData} />
                      )}

                      {/* 2. ACTIVITY CLUSTERS LAYER */}
                      {showClusters &&
                        sweepResult.detected_locations.map((loc, idx) => (
                          <Marker
                            key={`loc-${idx}`}
                            position={{ lat: loc.lat, lng: loc.lng }}
                            icon={{
                              path: google.maps.SymbolPath.CIRCLE,
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
                              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
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
                    Cargando servicios de georreferencia de Google Maps...
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
