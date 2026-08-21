"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { ProfessionalGeoMap } from "./maps/ProfessionalGeoMap";
import { StreetViewFindingsPanel, StreetViewFinding } from "./streetview/StreetViewFindingsPanel";
import { AnalyticsDashboard } from "./analytics/AnalyticsDashboard";
import { AnalyticsFilterProvider } from "./analytics/AnalyticsFilterContext";

const MOCK_RECTORA = {
  center: { lat: 21.885, lng: -102.291 },
  polygonCoords: [
    { lat: 21.892, lng: -102.300 },
    { lat: 21.892, lng: -102.280 },
    { lat: 21.878, lng: -102.280 },
    { lat: 21.878, lng: -102.300 },
  ],
  lineCoords: [
    { lat: 21.885, lng: -102.295 },
    { lat: 21.885, lng: -102.285 },
  ],
  hasCoordinates: true,
};

const MOCK_POIS = [
  { id: "poi-1", name: "Cámara Escudo 01", category: "Vigilancia", lat: 21.888, lng: -102.293, comentario: "Punto de monitoreo de accesos" },
  { id: "poi-2", name: "Estación de Servicio Pemex", category: "Comercio", lat: 21.882, lng: -102.288, comentario: "Frecuentada por halcones" },
  { id: "poi-3", name: "Cruce Táctico Central", category: "Cruce", lat: 21.885, lng: -102.291, comentario: "Cruce principal de la zona" },
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `poi-dense-${i}`,
    name: `Punto Táctico Adicional ${i + 1}`,
    category: "Inteligencia",
    lat: 21.885 + (Math.random() - 0.5) * 0.005,
    lng: -102.291 + (Math.random() - 0.5) * 0.005,
    comentario: "Punto secundario de cobertura"
  }))
];

const MOCK_PHOTOGRAPHS = [
  { id: "photo-1", lat: 21.887, lng: -102.290, previewUrl: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=150&q=80", gpsTimestamp: Date.now() - 86400000, comentario: "Evidencia de marcas de pandilla" },
  { id: "photo-2", lat: 21.881, lng: -102.294, previewUrl: "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?auto=format&fit=crop&w=150&q=80", gpsTimestamp: Date.now() - 172800000, comentario: "Vehículo sospechoso detectado" },
];

const MOCK_SV_MANUAL = [
  { id: "sv-man-1", lat: 21.889, lng: -102.295, streetViewMetadata: { heading: 120 }, contextualizedBy: "Analista Ceipol" },
  { id: "sv-man-2", lat: 21.883, lng: -102.285, streetViewMetadata: { heading: 45 }, contextualizedBy: "Gabinete SSPE" },
];

// @deprecated ADR-018: Desactivado para evitar la simulación de barridos automáticos al abrir expedientes
const INITIAL_SV_AUTOMATIC: any[] = [];

const MOCK_CRIMES = [
  { id: "crime-1", fecha: "2026-08-10", tipo: "Robo de Vehículo" },
  { id: "crime-2", fecha: "2026-08-11", tipo: "Asalto a Transeúnte" },
  { id: "crime-3", fecha: "2026-08-12", tipo: "Allanamiento" },
  { id: "crime-4", fecha: "2026-08-13", tipo: "Robo de Vehículo" },
  { id: "crime-5", fecha: "2026-08-14", tipo: "Daño en Propiedad" },
];

export function GeographicWorkspace() {
  const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
  const [selectedSv, setSelectedSv] = useState<any | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<any | null>(null);

  const [captures, setCaptures] = useState<any[]>(INITIAL_SV_AUTOMATIC);
  const [findings, setFindings] = useState<StreetViewFinding[]>([]);

  // Sincronizar hallazgos del expediente desde el backend al cargar
  useEffect(() => {
    async function fetchFindings() {
      try {
        const res = await fetch("/api/expedientes/EXP-2026/streetview/findings");
        if (res.ok) {
          const data = await res.json();
          setFindings(data);
        }
      } catch (err) {
        console.error("Error cargando hallazgos:", err);
      }
    }
    fetchFindings();
  }, []);

  const handlePoiSelect = (poi: any) => {
    setSelectedPoi(poi);
    setSelectedSv(null);
    setSelectedFinding(null);
  };

  const handleStreetViewSelect = (sv: any) => {
    setSelectedSv(sv);
    setSelectedPoi(null);
    setSelectedFinding(null);
  };

  const handleFindingSelect = (finding: any) => {
    setSelectedFinding(finding);
    setSelectedPoi(null);
    setSelectedSv(null);
  };

  const handleCaptureStatusChange = (captureId: string, status: "APROBADO" | "IGNORADO") => {
    setCaptures((prev) =>
      prev.map((c) => {
        const cId = c.id || c.hash_md5 || c.filename;
        if (cId === captureId) {
          return { ...c, estado_revision: status };
        }
        return c;
      })
    );
  };

  const handleFindingCreated = (newFinding: StreetViewFinding) => {
    setFindings((prev) => [...prev, newFinding]);
  };

  return (
    <AnalyticsFilterProvider>
      <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
        {/* Sección Superior: Mapa y Controles Lateral */}
        <div className="flex flex-1 min-h-0 w-full overflow-hidden">
          {/* Panel de Control Lateral */}
          <div className="w-[420px] bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl z-20 shrink-0">
            <div className="p-5 border-b border-slate-800 bg-slate-950 flex flex-col gap-1">
              <span className="text-[10px] font-black tracking-widest text-cyan-500 uppercase">Perfilador Remoto SSPE-CEIPOL</span>
              <h1 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                <span>🗺️</span> Espacio Analítico v1.0
              </h1>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Ficha de Detalles del Elemento Seleccionado */}
              {selectedPoi && (
                <div className="bg-slate-950/65 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <span className="text-[9px] font-black tracking-widest text-cyan-500 uppercase">Punto de Interés</span>
                    <span className="text-[9px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full uppercase">{selectedPoi.category}</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-tight">{selectedPoi.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">"{selectedPoi.comentario}"</p>
                  </div>
                </div>
              )}

              {selectedSv && (
                <div className="bg-slate-950/65 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <span className="text-[9px] font-black tracking-widest text-amber-500 uppercase">Cámara de Barrido</span>
                    <span className="text-[9px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full uppercase">PENDIENTE</span>
                  </div>
                  <img
                    src={selectedSv.file_url || selectedSv.archivo_url || selectedSv.previewUrl}
                    alt="Capture Preview"
                    className="w-full h-36 object-cover rounded-xl border border-slate-800"
                  />
                  <div className="text-[10px] space-y-1.5 font-mono text-slate-400 pt-1">
                    <p>ORIENTACIÓN: {selectedSv.geolocalizacion?.heading || selectedSv.street_view_session?.heading_final || 0}°</p>
                    <p>CATEGORÍA: {selectedSv.categoria_exploracion?.replace("_", " ") || "GENERAL"}</p>
                  </div>
                </div>
              )}

              {selectedFinding && (
                <div className="bg-cyan-950/20 border border-cyan-800/50 rounded-2xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-cyan-800/30 pb-2.5">
                    <span className="text-[9px] font-black tracking-widest text-cyan-400 uppercase">Hallazgo Aprobado</span>
                    <span className="text-[9px] font-bold bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-full uppercase">{selectedFinding.categoria}</span>
                  </div>
                  <img
                    src={selectedFinding.imagen}
                    alt="Finding"
                    className="w-full h-36 object-cover rounded-xl border border-cyan-800/60 shadow-md shadow-cyan-950/30"
                  />
                  <div>
                    <p className="text-[10px] text-slate-200 leading-relaxed font-semibold">"{selectedFinding.descripcion || "Sin descripción táctica registrada."}"</p>
                  </div>
                  <div className="text-[10px] space-y-1 font-mono text-cyan-500/80 pt-1.5 border-t border-cyan-900/30">
                    <p>HEADING: {selectedFinding.heading}°</p>
                    <p>FOCAL (FOV): {selectedFinding.fov}°</p>
                    <p>REVISOR: {selectedFinding.usuarioRevision}</p>
                  </div>
                </div>
              )}

              {!selectedPoi && !selectedSv && !selectedFinding && (
                <div className="border border-dashed border-slate-800 rounded-2xl p-6 text-center text-slate-500 flex flex-col items-center justify-center h-36">
                  <span className="text-2xl mb-1.5">🎯</span>
                  <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Inspección de Análisis</p>
                  <p className="text-[9px] text-slate-500 mt-1">Haz clic en cualquier elemento, captura o hallazgo en el mapa.</p>
                </div>
              )}

              {/* Panel de Validación de Capturas de Barrido */}
              <StreetViewFindingsPanel
                expedienteId="EXP-2026"
                captures={captures}
                onCaptureStatusChange={handleCaptureStatusChange}
                onFindingCreated={handleFindingCreated}
              />
            </div>
          </div>

          {/* Visor SIG Profesional */}
          <div className="flex-1 h-full p-4 bg-slate-950 relative">
            <ProfessionalGeoMap
              geografiaRectora={MOCK_RECTORA}
              pois={MOCK_POIS}
              photographs={MOCK_PHOTOGRAPHS}
              streetViewManual={MOCK_SV_MANUAL}
              streetViewAutomatic={captures}
              findings={findings}
              onPoiSelect={handlePoiSelect}
              onStreetViewSelect={handleStreetViewSelect}
              onFindingSelect={handleFindingSelect}
              selectedPoiId={selectedPoi?.id}
              selectedSvId={selectedSv?.id || selectedSv?.hash_md5}
              selectedFindingId={selectedFinding?.id}
            />
          </div>
        </div>

        {/* Sección Inferior: Dashboard Analítico Modular */}
        <div className="h-[400px] border-t border-slate-900 p-4 bg-slate-950/80 backdrop-blur-md shrink-0">
          <AnalyticsDashboard
            pois={MOCK_POIS}
            findings={findings}
            historicalCrimes={MOCK_CRIMES}
          />
        </div>
      </div>
    </AnalyticsFilterProvider>
  );
}

export default GeographicWorkspace;
