import React from 'react';

import {
  runVisualClassifier,
} from '../utils/visualClassifier';

interface Props {

  project: any;

}

const VisualAnalysisPanel:
React.FC<Props> = ({
  project,
}) => {

  const visual =
    runVisualClassifier(
      project
    );

  return (

    <div className="bg-slate-950 border border-violet-900 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-violet-300 mb-4">
        AI Visual Analysis
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Indicadores Visuales
          </p>

          <p className="text-2xl font-bold text-white">
            {visual.totalIndicators}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Visual Score
          </p>

          <p className="text-2xl font-bold text-fuchsia-300">
            {visual.visualScore}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-4">

          <p className="text-xs text-slate-400">
            Riesgo Visual
          </p>

          <p className={`text-2xl font-bold ${
            visual.visualRisk === 'ALTO'
              ? 'text-red-400'
              : visual.visualRisk === 'MEDIO'
              ? 'text-orange-300'
              : 'text-emerald-400'
          }`}>
            {visual.visualRisk}
          </p>

        </div>

      </div>

      <div className="space-y-3">

        {visual.findings.map(
          (
            finding,
            index
          ) => (

            <div
              key={index}
              className="bg-slate-800 rounded p-3 border border-slate-700"
            >

              <div className="flex justify-between items-center">

                <p className="text-sm text-white font-semibold">
                  {finding.indicator}
                </p>

                <span className={`text-xs px-2 py-1 rounded ${
                  finding.risk === 'ALTO'
                    ? 'bg-red-600/30 text-red-300'
                    : finding.risk === 'MEDIO'
                    ? 'bg-orange-600/30 text-orange-300'
                    : 'bg-emerald-600/30 text-emerald-300'
                }`}>
                  {finding.risk}
                </span>

              </div>

              <p className="text-xs text-slate-400 mt-1">
                Score: {finding.score}
              </p>

            </div>

          )
        )}

      </div>

    </div>

  );

};

export default VisualAnalysisPanel;