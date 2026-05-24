import React from 'react';

import { runPredictiveAnalysis }
  from '../utils/predictiveAnalysis';

interface Props {
  project: any;
}

const PredictivePanel: React.FC<Props> = ({
  project,
}) => {

  const prediction =
    runPredictiveAnalysis(project);

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-rose-300 mb-4">
        Criminología Ambiental Predictiva
      </h2>

      <div className="flex flex-col gap-4 mb-4">

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Riesgo Proyectado
          </p>

          <p className={`text-2xl font-bold ${
            prediction.projectedRisk === 'Alto'
              ? 'text-red-400'
              : prediction.projectedRisk === 'Medio'
              ? 'text-orange-300'
              : 'text-emerald-400'
          }`}>
            {prediction.projectedRisk}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Probabilidad de Escalamiento
          </p>

          <p className="text-2xl font-bold text-cyan-300">
            {prediction.escalationProbability}%
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Tendencia Territorial
          </p>

          <p className="text-sm font-bold text-fuchsia-300">
            {prediction.territorialTrend}
          </p>

        </div>

      </div>

      <div className="bg-slate-800 rounded p-4 mb-4">

        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Interpretación Predictiva
        </h3>

        <p className="text-sm text-slate-300 leading-relaxed">
          {prediction.interpretation}
        </p>

      </div>

      <div className="bg-slate-800 rounded p-4">

        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Indicadores Predictivos
        </h3>

        <ul className="space-y-2">

          {prediction.indicators.map(
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

export default PredictivePanel;