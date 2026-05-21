import React from 'react';

import { analyzeMultimodalContext }
  from '../utils/multimodalAnalysis';

interface Props {
  project: any;
}

const MultimodalPanel: React.FC<Props> = ({
  project,
}) => {

  const result =
    analyzeMultimodalContext(project);

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-violet-300 mb-4">
        Inteligencia Multimodal
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Riesgo Contextual
          </p>

          <p className={`text-2xl font-bold ${
            result.contextualRisk === 'Alto'
              ? 'text-red-400'
              : result.contextualRisk === 'Medio'
              ? 'text-orange-300'
              : 'text-emerald-400'
          }`}>
            {result.contextualRisk}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Consistencia Multimodal
          </p>

          <p className="text-2xl font-bold text-cyan-300">
            {result.consistencyScore}%
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Indicadores Detectados
          </p>

          <p className="text-2xl font-bold text-fuchsia-300">
            {result.indicators.length}
          </p>

        </div>

      </div>

      <div className="bg-slate-800 rounded p-4 mb-4">

        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Interpretación Multimodal
        </h3>

        <p className="text-sm text-slate-300 leading-relaxed">
          {result.interpretation}
        </p>

      </div>

      <div className="bg-slate-800 rounded p-4">

        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Indicadores Contextuales
        </h3>

        <ul className="space-y-2">

          {result.indicators.map(
            (indicator, index) => (

              <li
                key={index}
                className="text-xs text-slate-300"
              >
                • {indicator}
              </li>

            )
          )}

        </ul>

      </div>

    </div>
  );
};

export default MultimodalPanel;