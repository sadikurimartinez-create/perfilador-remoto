import React from 'react';

import {
  runGeointFusion,
} from '../utils/geointFusion';

interface Props {

  project: any;

  osintResults: any;

}

const GeointFusionPanel:
React.FC<Props> = ({

  project,

  osintResults,

}) => {

  if (!osintResults) {
    return null;
  }

  const fusion =
    runGeointFusion(
      project,
      osintResults
    );

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-cyan-300 mb-4">
        GEOINT Fusion
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Territorial Score
          </p>

          <p className="text-2xl font-bold text-white">
            {fusion.territorialScore}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Hotspot Density
          </p>

          <p className="text-2xl font-bold text-fuchsia-300">
            {fusion.hotspotDensity}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Riesgo Ambiental
          </p>

          <p className={`text-2xl font-bold ${
            fusion.environmentalRisk === 'ALTO'
              ? 'text-red-400'
              : fusion.environmentalRisk === 'MEDIO'
              ? 'text-orange-300'
              : 'text-emerald-400'
          }`}>
            {fusion.environmentalRisk}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Patrón Territorial
          </p>

          <p className="text-sm font-bold text-cyan-300">
            {fusion.territorialPattern}
          </p>

        </div>

      </div>

      <div className="bg-slate-800 rounded p-4">

        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Indicadores GEOINT
        </h3>

        <div className="flex flex-wrap gap-2">

          {fusion.indicators.map(
            (
              indicator,
              index
            ) => (

              <span
                key={index}
                className="bg-cyan-600/30 text-cyan-300 px-2 py-1 rounded text-xs"
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

export default GeointFusionPanel;