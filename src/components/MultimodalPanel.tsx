"use client";

import React, { useState } from "react";

type MultimodalPanelProps = {
  project?: any;
};

export default function MultimodalPanel({ project }: MultimodalPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [instruction, setInstruction] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 shadow-sm mt-4">
      <h3 className="text-lg font-semibold text-slate-200 mb-2 flex items-center gap-2">
        <span>📎</span> Evidencia Multimodal (Trabajo de Gabinete)
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        Sube archivos adicionales (Excel de incidencia, PDFs, videos o audios) para enriquecer el contexto del proyecto.
      </p>

      <div className="space-y-4">
        {/* Drag & Drop Area */}
        <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:bg-slate-800/50 transition-colors">
          <input
            type="file"
            id="multimodal-upload"
            multiple
            className="hidden"
            onChange={handleFileChange}
            accept=".csv, .xlsx, .pdf, image/*, video/*, audio/*"
          />
          <label htmlFor="multimodal-upload" className="cursor-pointer flex flex-col items-center gap-2">
            <span className="text-3xl">📥</span>
            <span className="text-sm font-medium text-slate-300">Haz clic para buscar archivos o arrástralos aquí</span>
            <span className="text-xs text-slate-500">Soporta Excel, CSV, PDF, Audio, Video e Imágenes</span>
          </label>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase">Archivos Cargados:</h4>
            <ul className="space-y-2">
              {files.map((file, idx) => (
                <li key={idx} className="flex items-center justify-between bg-slate-800/80 p-2 rounded border border-slate-700 text-sm">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-lg">📄</span>
                    <span className="truncate text-slate-300">{file.name}</span>
                    <span className="text-xs text-slate-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  <button onClick={() => removeFile(idx)} className="text-red-400 hover:text-red-300 px-2 font-bold">×</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Context Instruction */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase">Instrucción / Prompt Táctico para la IA:</label>
          <textarea
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            rows={3}
            placeholder="Ej: 'Lee este Excel de llamadas al 911 y busca patrones de extorsión', o 'Analiza este audio de entrevista y crúzalo con las fotos del polígono...'"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
        </div>

        <button className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 px-4 rounded-md transition-colors text-sm shadow-md">
          Procesar Evidencia Multimodal
        </button>
      </div>
    </div>
  );
}