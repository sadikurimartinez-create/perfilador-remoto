"use client";

import * as React from "react";
import { useRef } from "react";

interface ChartContainerProps {
  title: string;
  question: string;
  description?: string;
  children: React.ReactNode;
  hasData?: boolean;
}

export function ChartContainer({
  title,
  question,
  description,
  children,
  hasData = true,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExportSVG = () => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector("svg");
    if (!svgEl) return;

    try {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgEl);
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title.toLowerCase().replace(/\s+/g, "_")}_export.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al exportar SVG:", err);
    }
  };

  const handleExportPNG = () => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector("svg");
    if (!svgEl) return;

    try {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgEl);
      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Escalar a alta resolución (ej. 2x para impresión premium)
        const scale = 2;
        canvas.width = svgEl.clientWidth * scale;
        canvas.height = svgEl.clientHeight * scale;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const pngUrl = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = pngUrl;
              link.download = `${title.toLowerCase().replace(/\s+/g, "_")}_export.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(pngUrl);
            }
          }, "image/png");
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (err) {
      console.error("Error al exportar PNG:", err);
    }
  };

  return (
    <div ref={containerRef} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-[340px] shadow-xl relative overflow-hidden">
      <div>
        <div className="flex justify-between items-start gap-4 mb-1">
          <div>
            <span className="text-[9px] font-black tracking-widest text-cyan-500 uppercase block">{question}</span>
            <h3 className="text-xs font-black text-white uppercase tracking-tight">{title}</h3>
          </div>
          <div className="flex gap-1.5 shrink-0 z-10">
            <button
              onClick={handleExportSVG}
              disabled={!hasData}
              title="Exportar SVG vectorial"
              className="px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-[8px] font-black text-slate-400 uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              SVG
            </button>
            <button
              onClick={handleExportPNG}
              disabled={!hasData}
              title="Exportar PNG HD"
              className="px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-[8px] font-black text-slate-400 uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              PNG HD
            </button>
          </div>
        </div>
        {description && <p className="text-[10px] text-slate-500 font-medium mb-3">{description}</p>}
      </div>

      <div className="flex-1 relative flex items-center justify-center min-h-0 w-full">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center text-center text-slate-500 p-4 font-sans select-none">
            <span className="text-xl mb-1.5">📊</span>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Sin Información</p>
            <p className="text-[9px] text-slate-600 mt-0.5 max-w-[220px]">No existe información suficiente para computar el patrón analítico.</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
