import React from 'react';

import {
  runThreatIntelligence,
} from '../utils/threatIntelligence';

interface Props {

  project: any;

  osintResults: any;

}

const ThreatIntelligencePanel:
React.FC<Props> = ({

  project,

  osintResults,

}) => {

  if (!osintResults) {
    return null;
  }

  const threat =
    runThreatIntelligence(
      project,
      osintResults
    );

  return (

    <div className="bg-slate-950 border border-red-900 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-red-300 mb-4">
        Threat Intelligence
      </h2>

      <div className="flex flex-col gap-4 mb-4">

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Threat Score
          </p>

          <p className="text-2xl font-bold text-white">
            {threat.threatScore}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Nivel de Amenaza
          </p>

          <p className={`text-2xl font-bold ${
            threat.threatLevel === 'CRÍTICO'
              ? 'text-red-500'
              : threat.threatLevel === 'ALTO'
              ? 'text-orange-400'
              : threat.threatLevel === 'MEDIO'
              ? 'text-yellow-300'
              : 'text-emerald-400'
          }`}>
            {threat.threatLevel}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Riesgo de Escalamiento
          </p>

          <p className="text-sm font-bold text-fuchsia-300">
            {threat.escalationRisk}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Indicadores
          </p>

          <p className="text-2xl font-bold text-cyan-300">
            {threat.indicators.length}
          </p>

        </div>

      </div>

      <div className="bg-slate-800 rounded p-4 mb-4">

        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Interpretación Estratégica
        </h3>

        <p className="text-sm text-slate-300 leading-relaxed">
          {threat.interpretation}
        </p>

      </div>

      <div className="bg-slate-800 rounded p-4">

        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Indicadores Detectados
        </h3>

        <div className="flex flex-wrap gap-2">

          {threat.indicators.map(
            (
              indicator,
              index
            ) => (

              <span
                key={index}
                className="bg-red-600/30 text-red-300 px-2 py-1 rounded text-xs"
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

export default ThreatIntelligencePanel;