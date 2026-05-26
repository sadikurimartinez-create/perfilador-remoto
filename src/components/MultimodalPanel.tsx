"use client";

import React, { useState } from "react";
import { useProject } from "@/context/ProjectContext";

type MultimodalPanelProps = {
  project?: any;
};

export default function MultimodalPanel({ project }: MultimodalPanelProps) {
  const { uploadDocument, isReadOnly } = useProject();
  const [files, setFiles] = useState<File[]>([]);
  const [instruction, setInstruction] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // Lógica recursiva para leer carpetas completas arrastradas
  const traverseFileTree = async (item: any): Promise<File[]> => {
    if (item.isFile) {
      return new Promise((resolve) => item.file((file: File) => resolve([file])));
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      const entries: any[] = await new Promise((resolve) => {
        dirReader.readEntries((res: any) => resolve(res));
      });
      let foundFiles: File[] = [];
      for (const entry of entries) {
        const subFiles = await traverseFileTree(entry);
        foundFiles = [...foundFiles, ...subFiles];
      }
      return foundFiles;
    }
    return [];
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isReadOnly) return;

    const items = e.dataTransfer.items;
    let newFiles: File[] = [];

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item) {
          const extractedFiles = await traverseFileTree(item);
          newFiles = [...newFiles, ...extractedFiles];
        }
      }
    } else if (e.dataTransfer.files) {
      newFiles = Array.from(e.dataTransfer.files);
    }

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setMessage(null);

    try {
      for (const file of files) {
        await uploadDocument(file, instruction || "Evidencia multimodal procesada en gabinete.");
      }
      setFiles([]);
      setInstruction("");
      setMessage({ type: "ok", text: `Se cargaron ${files.length} archivo(s) al expediente táctico con éxito.` });
    } catch (err: any) {
      setMessage({ type: "error", text: `Error al procesar: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 shadow-sm mt-4">
      <h3 className="text-lg font-semibold text-slate-200 mb-2 flex items-center gap-2">
        <span>📎</span> Evidencia Multimodal (Trabajo de Gabinete)
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        Sube archivos individuales o <strong>arrastra carpetas completas</strong> (Excel de incidencia, PDFs, videos o audios) para integrarlos al expediente.
      </p>

      <div className="space-y-4">
        {/* Drag & Drop Area */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? "border-sky-500 bg-sky-900/20" : "border-slate-600 hover:bg-slate-800/50"
          } ${isReadOnly ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input
            type="file"
            id="multimodal-upload"
            multiple
            className="sr-only"
            disabled={isReadOnly}
            onChange={handleFileChange}
            accept=".csv, .xlsx, .pdf, image/*, video/*, audio/*"
          />
          <label htmlFor="multimodal-upload" className="cursor-pointer flex flex-col items-center gap-2">
            <span className="text-3xl">📥</span>
            <span className="text-sm font-medium text-slate-300">Haz clic o arrastra archivos/carpetas aquí</span>
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
                    <span className="text-xs text-slate-500 whitespace-nowrap">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  {!isReadOnly && (
                    <button onClick={() => removeFile(idx)} className="text-red-400 hover:text-red-300 px-2 font-bold">×</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Context Instruction */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase">Instrucción / Prompt Táctico para la IA:</label>
          <textarea
            spellCheck={true}
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            rows={3}
            disabled={isReadOnly}
            placeholder="Ej: 'Lee este Excel de llamadas al 911 y busca patrones de extorsión', o 'Analiza este audio de entrevista y crúzalo con las fotos del polígono...'"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
        </div>

        {message && (
          <div className={`p-2 rounded text-xs font-semibold ${message.type === 'ok' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800' : 'bg-red-900/40 text-red-400 border border-red-800'}`}>
            {message.text}
          </div>
        )}

        <button 
          onClick={handleProcess}
          disabled={files.length === 0 || isProcessing || isReadOnly}
          className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 px-4 rounded-md transition-colors text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? "Ingestando Evidencias..." : "Procesar Evidencia Multimodal"}
        </button>
      </div>
    </div>
  );
}