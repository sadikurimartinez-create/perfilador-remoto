import React from 'react';
import { exportCSV } from '@/utils/exportAnalysis';

interface Props {
  iaAnalysis: any[];
}

const AnalysisPanel: React.FC<Props> = ({ iaAnalysis }) => {
  if (!iaAnalysis || iaAnalysis.length === 0) return null;

  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-2">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-indigo-300">Hallazgos y Observaciones IA</h3>
        <button 
          onClick={() => exportCSV(iaAnalysis)}
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
        >
          Descargar CSV
        </button>
      </div>
      <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {iaAnalysis.map((item, idx) => (
          <li key={item.photoId || idx} className="bg-slate-800/50 border border-slate-700 rounded p-3 text-xs text-slate-300">
            <div className="flex justify-between items-start mb-1">
              <span className="font-semibold text-sky-400">Punto / Foto: {item.photoId}</span>
              <span className={`font-semibold uppercase tracking-wide ${item.riskLevel === 'high' || item.riskLevel === 'alto' ? 'text-red-400' : item.riskLevel === 'medium' || item.riskLevel === 'medio' ? 'text-orange-400' : 'text-emerald-400'}`}>
                Nivel de Riesgo: {item.riskLevel}
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed mt-1">{item.note || 'Sin observación registrada.'}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AnalysisPanel;