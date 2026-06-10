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
    <div style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '8px', marginTop: '16px', backgroundColor: '#f9fafb' }}>
      <h3 style={{ marginTop: 0, color: '#111827' }}>Análisis de Datos Abiertos de México</h3>
      <p style={{ color: '#374151' }}>Pegue la URL de un dataset del portal datos.gob.mx para buscar registros cercanos a su punto de análisis.</p>
      
      <input
        type="text"
        value={datasetUrl}
        onChange={(e) => setDatasetUrl(e.target.value)}
        placeholder="https://www.datos.gob.mx/dataset/..."
        style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db' }}
        disabled={isLoading}
      />
      
      <button onClick={handleAnalyze} disabled={isLoading} style={{ padding: '10px 15px', cursor: 'pointer', backgroundColor: isLoading ? '#9ca3af' : '#0D2B52', color: 'white', border: 'none', borderRadius: '4px' }}>
        {isLoading ? 'Analizando...' : 'Analizar Datos Abiertos'}
      </button>

      {error && (
        <div style={{ color: '#b91c1c', marginTop: '12px', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '4px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && !error && (
        <div style={{ marginTop: '12px', backgroundColor: '#e0f2fe', padding: '12px', borderRadius: '4px', color: '#0c4a6e' }}>
          <h4>Resultado del Análisis</h4>
          <p><strong>Dataset:</strong> {result.datasetTitle}</p>
          <p>{result.resumen}</p>
        </div>
      )}
    </div>
  );
}