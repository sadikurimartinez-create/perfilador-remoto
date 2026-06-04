"use client";

import { useState } from "react";

export function ExportMlButton() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await fetch("/api/export-ml");
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Error al exportar el dataset.");
      }

      // Convertimos la respuesta en un archivo Blob (Binario)
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Truco para forzar la descarga en el navegador
      const a = document.createElement("a");
      a.href = url;
      a.download = "dataset_ml_perfil_remoto.csv";
      document.body.appendChild(a);
      a.click();
      
      // Limpiamos la memoria
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error en la exportación:", error);
      alert(error instanceof Error ? error.message : "Error desconocido al exportar");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-900/20 border border-indigo-500"
      title="Descargar historial de predicciones para Entrenamiento de Algoritmos"
    >
      {isExporting ? (
        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
      ) : (
        <span className="text-lg">📊</span>
      )}
      <span>{isExporting ? "Generando CSV..." : "Exportar DataSet ML"}</span>
    </button>
  );
}