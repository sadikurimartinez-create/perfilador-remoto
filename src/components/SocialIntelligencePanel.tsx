import React from 'react';

import {
  correlateSocialIntel,
} from '../utils/socialCorrelation';

interface Props {

  redditResults: any[];

  xResults: any[];

}

const SocialIntelligencePanel:
React.FC<Props> = ({

  redditResults,

  xResults,

}) => {

  const intel =
    correlateSocialIntel(
      redditResults,
      xResults
    );

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-violet-300 mb-4">
        Social Intelligence
      </h2>

      <div className="flex flex-col gap-4 mb-4">

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Publicaciones Totales
          </p>

          <p className="text-2xl font-bold text-white">
            {intel.totalPosts}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Publicaciones Relevantes
          </p>

          <p className="text-2xl font-bold text-cyan-300">
            {
              intel.relevantPosts.length
            }
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Social Score
          </p>

          <p className="text-2xl font-bold text-fuchsia-300">
            {intel.socialScore}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Nivel de Riesgo
          </p>

          <p className={`text-2xl font-bold ${
            intel.threatLevel === 'ALTO'
              ? 'text-red-400'
              : intel.threatLevel === 'MEDIO'
              ? 'text-orange-300'
              : 'text-emerald-400'
          }`}>
            {intel.threatLevel}
          </p>

        </div>

      </div>

      <div className="bg-slate-800 rounded p-4 mb-4">

        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Keywords Sociales Detectadas
        </h3>

        <div className="flex flex-wrap gap-2">

          {intel.detectedKeywords.map(
            (
              keyword,
              index
            ) => (

              <span
                key={index}
                className="bg-violet-600/30 text-violet-300 px-2 py-1 rounded text-xs"
              >
                {keyword}
              </span>

            )
          )}

        </div>

      </div>

    </div>

  );
};

export default SocialIntelligencePanel;