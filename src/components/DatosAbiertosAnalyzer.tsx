'use client';

import { useState } from 'react';
import { getDatosGobMxData } from '@/lib/osintActions';
import type { DatosGobMxResult } from '@/lib/datosGobMx';

interface DatosAbiertosAnalyzerProps {
  lat: number;
  lng: number;
  onAnalysisComplete: (data: DatosGobMxResult) => void;
}

export default function DatosAbiertosAnalyzer({ lat, lng, onAnalysisComplete }: DatosAbiertosAnalyzerProps) {
  const [datasetUrl, setDatasetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DatosGobMxResult | null>(null);

  const handleAnalyze = async () => {
    if (!datasetUrl) {
      setError('Por favor, ingrese la URL de un dataset de datos.gob.mx');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);

    const response = await getDatosGobMxData(datasetUrl, lat, lng);

    if (response.exito && response.data) {
      setResult(response.data);
      onAnalysisComplete(response.data);
    } else {
      setError(response.error || 'Ocurrió un error desconocido.');
    }
    setIsLoading(false);
  };

  return (
    <div className="border border-slate-700 p-4 rounded-lg mt-4 bg-slate-800/30 space-y-3">
      <h4 className="text-sm font-semibold text-slate-200">Análisis de Datos Abiertos de México</h4>
      <p className="text-xs text-slate-400">Pegue la URL de un dataset del portal datos.gob.mx para buscar registros cercanos a su punto de análisis.</p>
      
      <input
        type="text"
        value={datasetUrl}
        onChange={(e) => setDatasetUrl(e.target.value)}
        placeholder="https://www.datos.gob.mx/dataset/..."
        className="w-full bg-slate-900 text-slate-200 border border-slate-600 rounded-md p-2 text-sm outline-none focus:border-sky-500 disabled:opacity-50"
        disabled={isLoading}
      />
      
      <button onClick={handleAnalyze} disabled={isLoading} className="w-full md:w-auto bg-teal-700 hover:bg-teal-600 text-white py-2 px-4 rounded text-xs font-semibold disabled:opacity-50 transition shadow-lg">
        {isLoading ? 'Analizando...' : 'Analizar Datos Abiertos'}
      </button>

      {error && (
        <div className="text-red-400 bg-red-900/30 border border-red-800 p-2 rounded-md text-xs">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && !error && (
        <div className="bg-sky-900/30 border border-sky-800 p-3 rounded-lg text-xs text-sky-200 space-y-1">
          <h5 className="font-bold text-sky-300">Resultado del Análisis</h5>
          <p><strong>Dataset:</strong> {result.datasetTitle}</p>
          <p>{result.resumen}</p>
        </div>
      )}
    </div>
  );
}