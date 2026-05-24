import React from 'react';

import { correlateNews }
  from '../utils/newsCorrelation';

interface Props {
  osintResults: any;
}

const NewsIntelligencePanel:
React.FC<Props> = ({
  osintResults,
}) => {

  if (!osintResults) {
    return null;
  }

  const intelligence =
    correlateNews(osintResults);

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-red-300 mb-4">
        News Intelligence
      </h2>

      <div className="flex flex-col gap-4 mb-4">

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Noticias Totales
          </p>

          <p className="text-2xl font-bold text-white">
            {intelligence.totalNews}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Noticias Relevantes
          </p>

          <p className="text-2xl font-bold text-cyan-300">
            {
              intelligence.relevantNews
                .length
            }
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Threat Score
          </p>

          <p className="text-2xl font-bold text-fuchsia-300">
            {
              intelligence.relevanceScore
            }
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Nivel de Amenaza
          </p>

          <p className={`text-2xl font-bold ${
            intelligence.threatLevel === 'ALTO'
              ? 'text-red-400'
              : intelligence.threatLevel === 'MEDIO'
              ? 'text-orange-300'
              : 'text-emerald-400'
          }`}>
            {
              intelligence.threatLevel
            }
          </p>

        </div>

      </div>

      <div className="bg-slate-800 rounded p-4 mb-4">

        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Keywords Detectadas
        </h3>

        <div className="flex flex-wrap gap-2">

          {intelligence.matchedKeywords.map(
            (
              keyword,
              index
            ) => (

              <span
                key={index}
                className="bg-red-600/30 text-red-300 px-2 py-1 rounded text-xs"
              >
                {keyword}
              </span>

            )
          )}

        </div>

      </div>

      <div className="space-y-3">

        {intelligence.relevantNews
          .slice(0, 10)
          .map(
            (
              item: any,
              index: number
            ) => (

              <div
                key={index}
                className="bg-slate-800 rounded p-3 border border-slate-700"
              >

                <p className="text-sm text-white font-semibold mb-1">
                  {
                    item.title ||
                    item.snippet ||
                    'Sin título'
                  }
                </p>

                <p className="text-xs text-slate-400">
                  {
                    item.source?.name ||
                    item.source ||
                    'Fuente desconocida'
                  }
                </p>

              </div>

            )
          )}

      </div>

    </div>

  );
};

export default NewsIntelligencePanel;