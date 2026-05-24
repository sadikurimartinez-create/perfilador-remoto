import React from 'react';

import { runOSINTScan }
  from '../utils/osintEngine';
import NewsIntelligencePanel
  from './NewsIntelligencePanel';
import SocialIntelligencePanel
  from './SocialIntelligencePanel';
import UrbanIntelligencePanel
  from './UrbanIntelligencePanel';
import GeointFusionPanel
  from './GeointFusionPanel';
import ThreatIntelligencePanel
  from './ThreatIntelligencePanel';
import NarrativeFusionPanel
  from './NarrativeFusionPanel';
import VisualAnalysisPanel
  from './VisualAnalysisPanel';

interface Props {
  project: any;
  setOsintResults?: (
    data: any
  ) => void;
}

const OSINTPanel: React.FC<Props> = ({
  project,
  setOsintResults,
}) => {

  const [loading, setLoading] =
    React.useState(false);

  const [results, setResults] =
    React.useState<any>(null);

  const executeOSINT = async () => {
    setLoading(true);

    try {
      const data = await runOSINTScan(project);
      setOsintResults?.(data);
      setResults(data);
    } catch (error) {
      console.error("OSINT Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <div className="flex justify-between items-center mb-4">

        <h2 className="text-lg font-bold text-cyan-300">
          Motor OSINT CEIPOL
        </h2>

        <button
          onClick={executeOSINT}
          disabled={loading}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded text-sm"
        >
          {loading
            ? 'Ejecutando...'
            : 'Ejecutar OSINT'}
        </button>

      </div>

      {results && (

        <div className="space-y-4">

          <div className="bg-slate-800 rounded p-4">

            <p className="text-xs text-slate-400">
              Resultados Totales
            </p>

            <p className="text-3xl font-bold text-white">
              {results.totalResults}
            </p>

          </div>

          <NewsIntelligencePanel
            osintResults={results}
          />

          <ThreatIntelligencePanel
            project={project}
            osintResults={results}
          />

          <NarrativeFusionPanel
            project={project}
            osintResults={results}
          />

          <VisualAnalysisPanel
            project={project}
          />

          <GeointFusionPanel
            project={project}
            osintResults={results}
          />

          <UrbanIntelligencePanel
            denue={
              results.denue || []
            }
            overpass={
              results.overpass || []
            }
            googlePlaces={
              results.googlePlaces || []
            }
          />

          <SocialIntelligencePanel
            redditResults={
              results.reddit || []
            }
            xResults={
              results.x || []
            }
          />

          <div className="flex flex-col gap-4">

            <div className="bg-slate-800 rounded p-3">
              <p className="text-xs text-slate-400">
                SERPAPI
              </p>

              <p className="text-xl text-cyan-300 font-bold">
                {results.serp?.length || 0}
              </p>
            </div>

            <div className="bg-slate-800 rounded p-3">
              <p className="text-xs text-slate-400">
                NEWSAPI
              </p>

              <p className="text-xl text-fuchsia-300 font-bold">
                {results.news?.length || 0}
              </p>
            </div>

            <div className="bg-slate-800 rounded p-3">
              <p className="text-xs text-slate-400">
                GNEWS
              </p>

              <p className="text-xl text-emerald-300 font-bold">
                {results.gnews?.length || 0}
              </p>
            </div>

            <div className="bg-slate-800 rounded p-3">
              <p className="text-xs text-slate-400">
                NEWSDATA
              </p>

              <p className="text-xl text-orange-300 font-bold">
                {results.newsdata?.length || 0}
              </p>
            </div>

            <div className="bg-slate-800 rounded p-3">
              <p className="text-xs text-slate-400">
                THENEWSAPI
              </p>

              <p className="text-xl text-red-300 font-bold">
                {results.thenews?.length || 0}
              </p>
            </div>

            <div className="bg-slate-800 rounded p-3">
              <p className="text-xs text-slate-400">
                DENUE
              </p>

              <p className="text-xl text-yellow-300 font-bold">
                {results.denue?.length || 0}
              </p>
            </div>

          </div>

        </div>

      )}

    </div>

  );
};

export default OSINTPanel;