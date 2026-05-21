import React from 'react';

import {
  correlateUrbanContext,
} from '../utils/urbanCorrelation';

interface Props {

  denue: any[];

  overpass: any[];

  googlePlaces: any[];

}

const UrbanIntelligencePanel:
React.FC<Props> = ({

  denue,

  overpass,

  googlePlaces,

}) => {

  const urban =
    correlateUrbanContext(
      denue,
      overpass,
      googlePlaces
    );

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-amber-300 mb-4">
        Urban Intelligence
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Lugares Detectados
          </p>

          <p className="text-2xl font-bold text-white">
            {urban.totalPlaces}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Lugares Riesgosos
          </p>

          <p className="text-2xl font-bold text-cyan-300">
            {urban.riskyPlaces}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Urban Score
          </p>

          <p className="text-2xl font-bold text-fuchsia-300">
            {urban.urbanScore}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Riesgo Urbano
          </p>

          <p className={`text-2xl font-bold ${
            urban.riskLevel === 'ALTO'
              ? 'text-red-400'
              : urban.riskLevel === 'MEDIO'
              ? 'text-orange-300'
              : 'text-emerald-400'
          }`}>
            {urban.riskLevel}
          </p>

        </div>

      </div>

      <div className="bg-slate-800 rounded p-4">

        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Indicadores Urbanos
        </h3>

        <div className="flex flex-wrap gap-2">

          {urban.indicators.map(
            (
              indicator,
              index
            ) => (

              <span
                key={index}
                className="bg-amber-600/30 text-amber-300 px-2 py-1 rounded text-xs"
              >
                {indicator}
              </span>

            )
          )}

        </div>

      </div>

    </div>

  );
};

export default UrbanIntelligencePanel;