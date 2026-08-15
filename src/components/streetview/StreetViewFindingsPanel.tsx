"use client";

import * as React from "react";
import { useState, useEffect } from "react";

export interface StreetViewFinding {
  id: string;
  expedienteId: string;
  captureId: string;
  categoria: "RUTA_ACCESO" | "RUTA_ESCAPE" | "PUNTO_ACECHO" | "GRAFITI";
  coordenadas: {
    lat: number;
    lng: number;
  };
  imagen: string;
  heading: number;
  pitch: number;
  fov: number;
  estado: "GENERADO" | "PENDIENTE_REVISION" | "APROBADO" | "IGNORADO";
  descripcion?: string;
  fechaCreacion: string;
  usuarioRevision?: string;
  origenRevision?: "BARRIDO_AUTOMATICO" | "MANUAL";
}

interface StreetViewFindingsPanelProps {
  expedienteId: string;
  captures: any[]; // Capturas automáticas de la Fase 1
  onCaptureStatusChange?: (captureId: string, status: "APROBADO" | "IGNORADO") => void;
  onFindingCreated?: (finding: StreetViewFinding) => void;
}

export function StreetViewFindingsPanel({
  expedienteId,
  captures,
  onCaptureStatusChange,
  onFindingCreated
}: StreetViewFindingsPanelProps) {
  const [selectedCapture, setSelectedCapture] = useState<any | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [pendingCaptures, setPendingCaptures] = useState<any[]>([]);

  useEffect(() => {
    // Filtrar únicamente capturas automáticas que están pendientes de revisión
    const filtered = captures.filter(
      (c) =>
        c.tipo_origen === "STREETVIEW_AUTOMATICO" &&
        (c.estado_revision === "PENDIENTE_REVISION" || !c.estado_revision)
    );
    setPendingCaptures(filtered);
  }, [captures]);

  const handleSelect = (capture: any) => {
    setSelectedCapture(capture);
    setDescripcion(capture.descripcion || "");
  };

  const handleApprove = async () => {
    if (!selectedCapture) return;

    const lat = selectedCapture.latitude || selectedCapture.lat;
    const lng = selectedCapture.longitude || selectedCapture.lng;
    const captureId = selectedCapture.id || selectedCapture.hash_md5 || selectedCapture.filename;

    const newFinding: StreetViewFinding = {
      id: `sv-find-${Date.now()}`,
      expedienteId,
      captureId,
      categoria: selectedCapture.categoria_exploracion || "RUTA_ACCESO",
      coordenadas: { lat, lng },
      imagen: selectedCapture.file_url || selectedCapture.archivo_url || "",
      heading: selectedCapture.geolocalizacion?.heading || selectedCapture.street_view_session?.heading_final || 0,
      pitch: selectedCapture.geolocalizacion?.pitch || selectedCapture.street_view_session?.pitch_final || 0,
      fov: selectedCapture.geolocalizacion?.fov || selectedCapture.street_view_session?.fov_final || 90,
      estado: "APROBADO",
      descripcion,
      fechaCreacion: new Date().toISOString(),
      usuarioRevision: "Analista CEIPOL",
      origenRevision: "BARRIDO_AUTOMATICO"
    };

    try {
      // 1. Crear el Hallazgo en el backend
      const res = await fetch("/api/streetview/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFinding)
      });
      const data = await res.json();

      // 2. Actualizar el estado de la captura origen
      await fetch(`/api/expedientes/${expedienteId}/evidencias/streetview/${captureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_revision: "APROBADO" })
      });

      if (onCaptureStatusChange) {
        onCaptureStatusChange(captureId, "APROBADO");
      }
      if (onFindingCreated) {
        onFindingCreated(data.finding || newFinding);
      }

      setSelectedCapture(null);
      setDescripcion("");
    } catch (err) {
      console.error("Error al aprobar hallazgo:", err);
    }
  };

  const handleIgnore = async () => {
    if (!selectedCapture) return;

    const captureId = selectedCapture.id || selectedCapture.hash_md5 || selectedCapture.filename;

    try {
      await fetch(`/api/expedientes/${expedienteId}/evidencias/streetview/${captureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_revision: "IGNORADO" })
      });

      if (onCaptureStatusChange) {
        onCaptureStatusChange(captureId, "IGNORADO");
      }

      setSelectedCapture(null);
      setDescripcion("");
    } catch (err) {
      console.error("Error al ignorar captura:", err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[500px] overflow-hidden shadow-2xl">
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
        <div>
          <span className="text-[10px] font-black tracking-widest text-cyan-500 uppercase">Validación de Evidencia</span>
          <h2 className="text-sm font-black text-white uppercase tracking-tight">Capturas Pendientes ({pendingCaptures.length})</h2>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Lista de capturas */}
        <div className="w-1/2 border-r border-slate-800 overflow-y-auto p-3 space-y-2">
          {pendingCaptures.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
              <span className="text-2xl mb-1">👌</span>
              <p className="text-[10px] uppercase font-bold tracking-wider">Sin Pendientes</p>
              <p className="text-[9px] text-slate-600 mt-0.5">Todas las capturas automáticas han sido revisadas.</p>
            </div>
          ) : (
            pendingCaptures.map((cap) => {
              const capId = cap.id || cap.hash_md5 || cap.filename;
              const isSelected = selectedCapture && (selectedCapture.id === capId || selectedCapture.hash_md5 === capId);
              return (
                <div
                  key={capId}
                  onClick={() => handleSelect(cap)}
                  className={`p-2.5 rounded-xl cursor-pointer border transition-all duration-200 flex items-center gap-3 ${
                    isSelected
                      ? "bg-cyan-950/40 border-cyan-800/80 shadow-md shadow-cyan-950/20"
                      : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/80"
                  }`}
                >
                  <img
                    src={cap.file_url || cap.archivo_url}
                    alt="Capture preview"
                    className="w-12 h-12 object-cover rounded-lg border border-slate-800 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-black tracking-widest text-cyan-500 uppercase block">
                      {cap.categoria_exploracion?.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-slate-300 truncate block font-bold">
                      {cap.filename || "Captura Automática"}
                    </span>
                    <span className="text-[9px] text-slate-500 block font-mono">
                      LAT: {cap.latitude?.toFixed(4)} / LNG: {cap.longitude?.toFixed(4)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Formulario de revisión */}
        <div className="w-1/2 bg-slate-950/40 p-4 flex flex-col justify-between overflow-y-auto">
          {selectedCapture ? (
            <div className="h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-800 h-32 bg-black">
                  <img
                    src={selectedCapture.file_url || selectedCapture.archivo_url}
                    alt="Current capture"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[8px] font-mono text-cyan-400 border border-slate-800">
                    H: {selectedCapture.geolocalizacion?.heading || 0}° / F: {selectedCapture.geolocalizacion?.fov || 90}°
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black tracking-widest text-slate-400 uppercase block mb-1">
                    Descripción del Hallazgo
                  </label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Describe por qué este punto califica como un hallazgo crítico para la carpeta de investigación..."
                    className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-medium resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex gap-2 border-t border-slate-800 pt-3">
                <button
                  onClick={handleIgnore}
                  className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider border border-slate-800 transition-all duration-150"
                >
                  🚫 Ignorar
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-[10px] font-black text-white uppercase tracking-wider shadow-lg shadow-cyan-950/50 transition-all duration-150"
                >
                  ✅ Aprobar
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
              <span className="text-3xl mb-2">🔍</span>
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Detalle de Revisión</p>
              <p className="text-[9px] text-slate-500 mt-1 max-w-[180px]">Selecciona una captura de la lista para analizar su telemetría e incorporarla al expediente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
