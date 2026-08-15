"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";

interface MockMapProps {
  geografiaRectora?: {
    polygonCoords?: { lat: number; lng: number }[];
    lineCoords?: { lat: number; lng: number }[];
    center?: { lat: number; lng: number };
    hasCoordinates?: boolean;
  };
  pois?: any[];
  photographs?: any[];
  streetViewManual?: any[];
  streetViewAutomatic?: any[];
  findings?: any[];
  onPoiSelect?: (poi: any) => void;
  onStreetViewSelect?: (sv: any) => void;
  selectedPoiId?: string;
  selectedSvId?: string;
}

export function MockMap({
  geografiaRectora,
  pois = [],
  photographs = [],
  streetViewManual = [],
  streetViewAutomatic = [],
  findings = [],
  onPoiSelect,
  onStreetViewSelect,
  selectedPoiId,
  selectedSvId,
}: MockMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visibleLayers, setVisibleLayers] = useState({
    rectora: true,
    pois: true,
    photos: true,
    svManual: true,
    svAutomatic: true,
    findings: true,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Limpiar y dibujar fondo gris táctico institucional
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Dibujar Geografía Rectora
    if (visibleLayers.rectora && geografiaRectora?.polygonCoords && geografiaRectora.polygonCoords.length > 0) {
      ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      geografiaRectora.polygonCoords.forEach((coord, index) => {
        // Mapeo determinista temporal de coordenadas a píxeles
        const x = 100 + (coord.lng + 102) * 5000;
        const y = 300 - (coord.lat - 21) * 5000;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Dibujar POIs
    if (visibleLayers.pois) {
      pois.forEach(poi => {
        const x = 100 + (poi.lng + 102) * 5000;
        const y = 300 - (poi.lat - 21) * 5000;
        ctx.fillStyle = poi.id === selectedPoiId ? "#3b82f6" : "#60a5fa";
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.fillText(poi.name || "POI", x + 12, y + 4);
      });
    }

    // Dibujar Fotos de Campo (Círculos verdes)
    if (visibleLayers.photos) {
      photographs.forEach(p => {
        const x = 100 + (p.lng + 102) * 5000;
        const y = 300 - (p.lat - 21) * 5000;
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Dibujar Street View Manual (Cámara cian)
    if (visibleLayers.svManual) {
      streetViewManual.forEach(sv => {
        const x = 100 + (sv.lng + 102) * 5000;
        const y = 300 - (sv.lat - 21) * 5000;
        ctx.fillStyle = "#06b6d4";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Dibujar Street View Automático
    if (visibleLayers.svAutomatic) {
      streetViewAutomatic.forEach(sv => {
        const x = 100 + (sv.lng + 102) * 5000;
        const y = 300 - (sv.lat - 21) * 5000;
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  }, [geografiaRectora, pois, photographs, streetViewManual, streetViewAutomatic, findings, visibleLayers, selectedPoiId, selectedSvId]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
        <span className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-2">
          <span>⚠️</span> FALLBACK CARTOGRÁFICO TEMPORAL ACTIVO (CANVAS MOCK)
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setVisibleLayers(prev => ({ ...prev, rectora: !prev.rectora }))}
            className={`px-2 py-1 rounded text-[10px] font-bold border transition ${visibleLayers.rectora ? "bg-cyan-950 border-cyan-800 text-cyan-400" : "bg-slate-950 border-slate-800 text-slate-500"}`}
          >
            Geografía
          </button>
          <button
            onClick={() => setVisibleLayers(prev => ({ ...prev, pois: !prev.pois }))}
            className={`px-2 py-1 rounded text-[10px] font-bold border transition ${visibleLayers.pois ? "bg-cyan-950 border-cyan-800 text-cyan-400" : "bg-slate-950 border-slate-800 text-slate-500"}`}
          >
            POIs
          </button>
          <button
            onClick={() => setVisibleLayers(prev => ({ ...prev, photos: !prev.photos }))}
            className={`px-2 py-1 rounded text-[10px] font-bold border transition ${visibleLayers.photos ? "bg-cyan-950 border-cyan-800 text-cyan-400" : "bg-slate-950 border-slate-800 text-slate-500"}`}
          >
            Fotos
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} width={800} height={500} className="w-full flex-1 bg-slate-950 cursor-crosshair" />
    </div>
  );
}

export default MockMap;
