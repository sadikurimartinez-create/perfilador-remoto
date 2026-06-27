"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { VisualCellRepresentation, HeatPoint } from "@/lib/geo-visual/geoVisualEngine";
import { GeoEvent } from "@/lib/iri/operations/iriEventEngine";

// Self-contained CSS styles for map premium aesthetics, glowing overlays, and pulsing indicators.
const CUSTOM_MAP_STYLES = `
  @keyframes geoPulse {
    0% { transform: scale(1); opacity: 0.85; box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
    70% { transform: scale(1.1); opacity: 0.4; box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
    100% { transform: scale(1); opacity: 0.85; box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
  }

  .pulse-marker {
    background: #dc2626;
    border-radius: 50%;
    border: 2px solid #ffffff;
    animation: geoPulse 1.8s infinite;
  }

  @keyframes cellFlash {
    0% { fill-opacity: 0.4; }
    50% { fill-opacity: 0.85; }
    100% { fill-opacity: 0.4; }
  }

  .pulsing-cell {
    animation: cellFlash 2s infinite ease-in-out;
  }

  .custom-leaflet-popup .leaflet-popup-content-wrapper {
    background: rgba(15, 23, 42, 0.9) !important;
    color: #f8fafc !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
    backdrop-filter: blur(8px) !important;
    border-radius: 8px !important;
    font-family: 'Inter', sans-serif !important;
  }

  .custom-leaflet-popup .leaflet-popup-tip {
    background: rgba(15, 23, 42, 0.9) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
  }

  .glass-panel {
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  }
`;

export default function GeoIntMapInner() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  // Layer groups references for dynamic, non-flickering updates (diff-rendering)
  const gridLayerGroup = useRef<L.LayerGroup | null>(null);
  const heatmapLayerGroup = useRef<L.LayerGroup | null>(null);
  const eventLayerGroup = useRef<L.LayerGroup | null>(null);
  const hydroMeteoLayerGroup = useRef<L.LayerGroup | null>(null);

  // State elements
  const [bbox, setBbox] = useState<[number, number, number, number]>([21.84, -102.32, 21.92, -102.26]);
  const [cells, setCells] = useState<VisualCellRepresentation[]>([]);
  const [events, setEvents] = useState<GeoEvent[]>([]);
  const [heatmap, setHeatmap] = useState<HeatPoint[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pollingActive, setPollingActive] = useState(true);

  // Layer visibility triggers
  const [showGrid, setShowGrid] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showHydro, setShowHydro] = useState(true);

  // Selected event focus reference
  const [selectedEvent, setSelectedEvent] = useState<GeoEvent | null>(null);

  const standardTileLayer = useRef<L.TileLayer | null>(null);
  const satelliteTileLayer = useRef<L.TileLayer | null>(null);
  const [baseLayer, setBaseLayer] = useState<"standard" | "satellite">("standard");

  // 1. Initialize map instance
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Default center in Aguascalientes, with scroll wheel zoom disabled
    const map = L.map(mapRef.current, {
      center: [21.882, -102.291],
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: false,
    });

    mapInstance.current = map;

    // Add CartoDB Dark Matter tile layer for slick premium UI
    standardTileLayer.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    });

    satelliteTileLayer.current = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19,
    });

    standardTileLayer.current.addTo(map);

    // Initialize layered visual controllers
    gridLayerGroup.current = L.layerGroup().addTo(map);
    heatmapLayerGroup.current = L.layerGroup().addTo(map);
    eventLayerGroup.current = L.layerGroup().addTo(map);
    hydroMeteoLayerGroup.current = L.layerGroup().addTo(map);

    // Update coordinates when map is panned
    const updateBbox = () => {
      const bounds = map.getBounds();
      const minLat = bounds.getSouth();
      const minLng = bounds.getWest();
      const maxLat = bounds.getNorth();
      const maxLng = bounds.getEast();
      setBbox([minLat, minLng, maxLat, maxLng]);
    };

    map.on("dragend", updateBbox);
    map.on("zoomend", updateBbox);

    return () => {
      map.off("dragend", updateBbox);
      map.off("zoomend", updateBbox);
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Handle switching layer
  useEffect(() => {
    if (!mapInstance.current || !standardTileLayer.current || !satelliteTileLayer.current) return;
    if (baseLayer === "standard") {
      mapInstance.current.removeLayer(satelliteTileLayer.current);
      standardTileLayer.current.addTo(mapInstance.current);
    } else {
      mapInstance.current.removeLayer(standardTileLayer.current);
      satelliteTileLayer.current.addTo(mapInstance.current);
    }
  }, [baseLayer]);

  const handleZoomIn = () => {
    if (mapInstance.current) {
      mapInstance.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstance.current) {
      mapInstance.current.zoomOut();
    }
  };

  const handleResetView = () => {
    if (mapInstance.current) {
      mapInstance.current.setView([21.882, -102.291], 13);
    }
  };

  // 2. Poll real-time visual streaming packet
  useEffect(() => {
    if (!pollingActive) return;

    let isMounted = true;

    const fetchStream = async () => {
      try {
        const queryBbox = `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`;
        const response = await fetch(`/api/geo/stream?bbox=${queryBbox}&simulated_storm=true`);
        if (!response.ok) throw new Error("Stream connection failed");
        
        const data = await response.json();
        
        if (isMounted) {
          setCells(data.cells || []);
          setEvents(data.events || []);
          setHeatmap(data.heatmap || []);
          setMeta(data.metadata || null);
          setLoading(false);
        }
      } catch (err) {
        console.error("[GEO_INT_MAP_STREAM_ERR]", err);
      }
    };

    fetchStream();
    const interval = setInterval(fetchStream, 3000); // 3-second rapid synchronization

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [bbox, pollingActive]);

  // 3. Layer Rendering Systems
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // --- RENDER CAPA 1: IRI GRID LAYER ---
    const gridGroup = gridLayerGroup.current;
    if (gridGroup) {
      gridGroup.clearLayers();
      if (showGrid) {
        cells.forEach((cell) => {
          const latLngs = cell.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
          
          const polygonOptions: L.PolylineOptions = {
            color: cell.color,
            weight: cell.isPulsing ? 2 : 1,
            fillColor: cell.color,
            fillOpacity: cell.fillOpacity,
            className: cell.isPulsing ? "pulsing-cell" : "",
          };

          const poly = L.polygon(latLngs, polygonOptions);

          // Add interactive hover details and popups
          poly.bindPopup(`
            <div class="p-2 text-xs font-sans text-white">
              <div class="font-bold border-b border-gray-600 pb-1 mb-1">Grid Cell: ${cell.id}</div>
              <div><b>IRI Score:</b> <span class="font-mono text-amber-400">${cell.score.toFixed(3)}</span></div>
              <div><b>Risk Level:</b> <span class="font-bold" style="color: ${cell.color}">${cell.riskLevel}</span></div>
              <div class="text-[10px] text-gray-400 mt-1">Resolution: 250m grid segment</div>
            </div>
          `, { className: "custom-leaflet-popup" });

          gridGroup.addLayer(poly);
        });
      }
    }

    // --- RENDER CAPA 2: HEATMAP LAYER ---
    const heatGroup = heatmapLayerGroup.current;
    if (heatGroup) {
      heatGroup.clearLayers();
      if (showHeatmap) {
        heatmap.forEach((pt) => {
          // Render a smooth circle overlay representing Gaussian interpolation density
          const circle = L.circle([pt.lat, pt.lng], {
            radius: 180, // smooth spatial spread
            color: "transparent",
            fillColor: pt.color,
            fillOpacity: pt.intensity * 0.45,
          });
          heatGroup.addLayer(circle);
        });
      }
    }

    // --- RENDER CAPA 3: EVENT OVERLAY ---
    const evtGroup = eventLayerGroup.current;
    if (evtGroup) {
      evtGroup.clearLayers();
      if (showEvents) {
        events.forEach((evt) => {
          const [lat, lng] = [
            (evt.geometry.coordinates[0][0][1] + evt.geometry.coordinates[0][2][1]) / 2,
            (evt.geometry.coordinates[0][0][0] + evt.geometry.coordinates[0][2][0]) / 2,
          ];

          // Determine specific event state marker style
          const isCritical = evt.state === "CRITICAL";
          const colorMap = {
            NORMAL: "#22c55e",
            WATCH: "#eab308",
            WARNING: "#f97316",
            ALERT: "#ef4444",
            CRITICAL: "#dc2626",
          };
          const markerColor = colorMap[evt.state] || "#3b82f6";

          // Generate dynamic SVG icon
          const iconHtml = isCritical
            ? `<div class="pulse-marker" style="width: 14px; height: 14px;"></div>`
            : `<div style="background: ${markerColor}; border: 1.5px solid #ffffff; width: 10px; height: 10px; border-radius: 50%;"></div>`;

          const customIcon = L.divIcon({
            html: iconHtml,
            className: "event-state-icon",
            iconSize: isCritical ? [14, 14] : [10, 10],
          });

          const marker = L.marker([lat, lng], { icon: customIcon });

          const popupContent = `
            <div class="p-3 text-xs font-sans text-white w-52">
              <div class="flex items-center justify-between border-b border-gray-700 pb-1.5 mb-1.5">
                <span class="font-bold text-red-400 font-mono">${evt.id}</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold" style="background: ${markerColor}; color: #000;">
                  ${evt.state}
                </span>
              </div>
              <div class="space-y-1">
                <div><b>IRI Score:</b> <span class="font-mono text-amber-300 font-bold">${evt.iri_score.toFixed(3)}</span></div>
                <div class="border-t border-gray-800 my-1 pt-1 text-[10px] text-gray-300">
                  <div class="font-semibold mb-0.5 text-gray-400">Contributor Signals:</div>
                  <div class="grid grid-cols-2 gap-x-1 gap-y-0.5 font-mono text-[9px]">
                    <div>🌧️ Lluvia: ${(evt.signals.precipitation * 10).toFixed(1)}</div>
                    <div>🌊 Hidro: ${(evt.signals.hydrology * 10).toFixed(1)}</div>
                    <div>🌐 OSINT: ${(evt.signals.osint * 10).toFixed(1)}</div>
                    <div>🛰️ Sat: ${(evt.signals.satellite * 10).toFixed(1)}</div>
                  </div>
                </div>
                <div class="text-[9px] text-gray-400 pt-1 border-t border-gray-800">
                  <b>Sources:</b> ${evt.sources.join(", ")}
                </div>
              </div>
            </div>
          `;

          marker.bindPopup(popupContent, { className: "custom-leaflet-popup" });
          marker.on("click", () => setSelectedEvent(evt));

          evtGroup.addLayer(marker);
        });
      }
    }

    // --- RENDER CAPA 4: HYDRO-METEO LAYER ---
    const hydroGroup = hydroMeteoLayerGroup.current;
    if (hydroGroup) {
      hydroGroup.clearLayers();
      if (showHydro && meta?.storm_centroid_simulated) {
        const [stormLat, stormLng] = meta.storm_centroid_simulated;

        // Draw a simulated radial pluvial front
        const stormCore = L.circle([stormLat, stormLng], {
          radius: 1200, // Storm radius meters
          color: "rgba(30, 58, 138, 0.4)",
          weight: 1.5,
          fillColor: "#1e3a8a",
          fillOpacity: 0.15,
        });

        // Add informative tooltip for simulated storm front
        stormCore.bindTooltip("🌧️ Simulated Moving Storm Front Core", {
          permanent: false,
          direction: "top",
          className: "bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-xs",
        });

        hydroGroup.addLayer(stormCore);
      }
    }
  }, [cells, heatmap, events, meta, showGrid, showHeatmap, showEvents, showHydro]);

  return (
    <div className="relative w-full h-full flex flex-col min-h-0 bg-slate-950 text-slate-100 font-sans">
      {/* Self-contained CSS injection */}
      <style dangerouslySetInnerHTML={{ __html: CUSTOM_MAP_STYLES }} />

      {/* Header Panel */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800 glass-panel z-10">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-amber-500 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
            Real-Time GEOINT Visual Engine
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Operational 4-Layer Synchronizer • Standardized Visual Stream
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPollingActive(!pollingActive)}
            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
              pollingActive
                ? "bg-emerald-950 text-emerald-300 border border-emerald-500"
                : "bg-slate-800 text-slate-400 border border-slate-600"
            }`}
          >
            {pollingActive ? "🟢 Live Streaming" : "⏸️ Paused"}
          </button>
        </div>
      </div>

      {/* Main Map + UI wrapper */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* Leaflet DOM container */}
        <div ref={mapRef} className="flex-1 h-full w-full z-0" />

        {/* Map Layers Toggle Widget (Absolute Top Right over map) */}
        <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2 p-3 rounded-lg glass-panel max-w-[200px]">
          {/* Zoom controls */}
          <div className="text-[9px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-1">
            Zoom Controls
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

          {/* Base Layer Switcher */}
          <div className="text-[9px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-1">
            Base Layer
          </div>
          <div className="flex gap-1.5 mb-1.5">
            <button
              onClick={() => setBaseLayer("standard")}
              className={`flex-1 py-1 rounded text-[8px] font-black uppercase border transition-all ${
                baseLayer === "standard"
                  ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                  : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350"
              }`}
            >
              🗺️ Mapa
            </button>
            <button
              onClick={() => setBaseLayer("satellite")}
              className={`flex-1 py-1 rounded text-[8px] font-black uppercase border transition-all ${
                baseLayer === "satellite"
                  ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                  : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350"
              }`}
            >
              🛰️ Satélite
            </button>
          </div>

          <div className="text-[9px] uppercase font-black tracking-wider text-slate-450 mb-1 border-b border-slate-800 pb-1">
            Map Overlays
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="accent-amber-500"
            />
            <span>🔲 IRI Grid (250m)</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
              className="accent-amber-500"
            />
            <span>🌡️ Dynamic Heatmap</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showEvents}
              onChange={(e) => setShowEvents(e.target.checked)}
              className="accent-amber-500"
            />
            <span>🚨 Operational Events</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showHydro}
              onChange={(e) => setShowHydro(e.target.checked)}
              className="accent-amber-500"
            />
            <span>🌧️ Hydro-Meteo Front</span>
          </label>
        </div>

        {/* Legend Widget (Absolute Bottom Left over map) */}
        <div className="absolute bottom-4 left-4 z-[400] p-3 rounded-lg glass-panel max-w-[220px]">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 border-b border-slate-800 pb-1">
            IRI Risk Index Legend
          </div>
          <div className="space-y-1.5 text-xs text-slate-300 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-2 rounded bg-[#22c55e]"></span>
              <span>0.00–0.20 : LOW (Verde)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-2 rounded bg-[#eab308]"></span>
              <span>0.21–0.40 : MEDIUM (Amarillo)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-2 rounded bg-[#f97316]"></span>
              <span>0.41–0.60 : HIGH (Naranja)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-2 rounded bg-[#ef4444]"></span>
              <span>0.61–0.80 : VERY HIGH (Rojo)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-2 rounded bg-[#dc2626] animate-pulse border border-white"></span>
              <span>0.81–1.00 : CRITICAL (Pulsante)</span>
            </div>
          </div>
        </div>

        {/* Real-time Side Analytics Panel (Glassmorphic) */}
        <div className="w-80 h-full border-l border-slate-800 glass-panel flex flex-col p-4 z-10 text-xs overflow-y-auto space-y-4">
          <div>
            <h3 className="text-slate-300 font-bold uppercase tracking-wider mb-2 text-[10px] text-amber-500">
              ⚡ Live Signal Stream summary
            </h3>
            <div className="grid grid-cols-2 gap-2 text-center text-slate-300 font-mono">
              <div className="bg-slate-900 border border-slate-800 p-2 rounded">
                <div className="text-slate-500 text-[9px] uppercase">Active Cells</div>
                <div className="text-sm font-bold text-amber-400">{cells.length}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-2 rounded">
                <div className="text-slate-500 text-[9px] uppercase">Alert Events</div>
                <div className="text-sm font-bold text-red-400">{events.length}</div>
              </div>
            </div>
          </div>

          {meta && (
            <div className="bg-slate-900/50 border border-slate-800/80 p-3 rounded space-y-1">
              <h4 className="font-semibold text-slate-400 text-[10px] uppercase">Simulated Climate Core</h4>
              <div className="font-mono text-[10px] space-y-0.5 text-slate-300">
                <div>🧭 Centroid: [{meta.storm_centroid_simulated[0].toFixed(4)}, {meta.storm_centroid_simulated[1].toFixed(4)}]</div>
                <div>📡 Mode: {meta.mode}</div>
                <div>📦 Grid Res: {meta.grid_resolution}m</div>
              </div>
            </div>
          )}

          {/* Active Events Feed */}
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="text-slate-300 font-bold uppercase tracking-wider mb-2 text-[10px] text-amber-500">
              🚨 Active Events Feed
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[220px] pr-1">
              {events.length === 0 ? (
                <div className="text-slate-500 text-center py-6 border border-dashed border-slate-800 rounded">
                  No active events in current bounds.
                </div>
              ) : (
                events.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`p-2 rounded border transition-all cursor-pointer ${
                      selectedEvent?.id === evt.id
                        ? "bg-slate-900 border-amber-500/60"
                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 font-mono text-[10px]">{evt.id}</span>
                      <span
                        className="px-1 py-0.2 rounded text-[8px] font-bold uppercase"
                        style={{
                          background:
                            evt.state === "CRITICAL"
                              ? "#dc2626"
                              : evt.state === "ALERT"
                              ? "#ef4444"
                              : "#eab308",
                          color: "#000",
                        }}
                      >
                        {evt.state}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-mono">
                      <span>IRI Score: {evt.iri_score.toFixed(3)}</span>
                      <span>Signals: {Object.keys(evt.signals).length}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Focused Event telemetry details */}
          {selectedEvent && (
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                <span className="font-bold text-amber-500 font-mono text-[10px]">{selectedEvent.id}</span>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-slate-500 hover:text-slate-300 text-[10px]"
                >
                  ✕ Close
                </button>
              </div>
              <div className="space-y-1 text-[10px] text-slate-300 font-mono">
                <div className="flex justify-between">
                  <span>IRI Index:</span>
                  <span className="font-bold text-slate-100">{selectedEvent.iri_score.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span>State:</span>
                  <span className="font-bold text-red-400">{selectedEvent.state}</span>
                </div>
                <div className="border-t border-slate-800 my-1.5 pt-1.5">
                  <div className="text-slate-400 font-semibold mb-1 text-[9px] uppercase">Telemetry Breakdown</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>🌧️ Precipitation:</span>
                      <span>{(selectedEvent.signals.precipitation * 10).toFixed(1)} / 10</span>
                    </div>
                    <div className="flex justify-between">
                      <span>🌊 Hydrology:</span>
                      <span>{(selectedEvent.signals.hydrology * 10).toFixed(1)} / 10</span>
                    </div>
                    <div className="flex justify-between">
                      <span>🌐 OSINT Social:</span>
                      <span>{(selectedEvent.signals.osint * 10).toFixed(1)} / 10</span>
                    </div>
                    <div className="flex justify-between">
                      <span>🛰️ Satellite Hum:</span>
                      <span>{(selectedEvent.signals.satellite * 10).toFixed(1)} / 10</span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-1 text-[8px] text-slate-500 truncate">
                  <b>Sources:</b> {selectedEvent.sources.join(", ")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
