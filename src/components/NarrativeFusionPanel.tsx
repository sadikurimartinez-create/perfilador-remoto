import React from 'react';

import {
  buildNarrativeFusion,
} from '../utils/narrativeFusion';

interface Props {

  project: any;

  osintResults: any;

}

const NarrativeFusionPanel:
React.FC<Props> = ({

  project,

  osintResults,

}) => {

  if (!osintResults) {
    return null;
  }

  const narrative =
    buildNarrativeFusion(
      project,
      osintResults
    );

  return (

    <div className="bg-slate-950 border border-cyan-900 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-cyan-300 mb-4">
        AI Narrative Fusion
      </h2>

      <div className="space-y-4">

        <div className="bg-slate-800 rounded p-4">

          <h3 className="text-sm font-semibold text-cyan-300 mb-2">
            Narrativa Criminológica
          </h3>

          <p className="text-sm text-slate-300 leading-relaxed">
            {narrative.narrative}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <h3 className="text-sm font-semibold text-fuchsia-300 mb-2">
            Interpretación Territorial
          </h3>

          <p className="text-sm text-slate-300 leading-relaxed">
            {narrative.territorialInterpretation}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <h3 className="text-sm font-semibold text-orange-300 mb-2">
            Evaluación Operacional
          </h3>

          <p className="text-sm text-slate-300 leading-relaxed">
            {narrative.operationalAssessment}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <h3 className="text-sm font-semibold text-emerald-300 mb-2">
            Fuentes OSINT/GEOINT Utilizadas
          </h3>

          <div className="flex flex-wrap gap-2">

            {narrative.sources.map(
              (
                source,
                index
              ) => (

                <span
                  key={index}
                  className="bg-cyan-600/30 text-cyan-300 px-2 py-1 rounded text-xs"
                >
                  {source}
                </span>

              )
            )}

          </div>

        </div>

      </div>

    </div>

  );

};

export default NarrativeFusionPanel;