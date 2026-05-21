import React from 'react';

import { compareProjects } from '../utils/compareProjects';

interface Props {
  currentProject: any;
  allProjects: any[];
}

const CorrelationPanel: React.FC<Props> = ({
  currentProject,
  allProjects,
}) => {

  const correlations =
    compareProjects(
      currentProject,
      allProjects.filter(
        p => p.id !== currentProject.id
      )
    );

  if (correlations.length === 0) {
    return null;
  }

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-fuchsia-300 mb-4">
        Correlación Criminológica
      </h2>

      <div className="space-y-3">

        {correlations.map(
          (item, index) => (

            <div
              key={index}
              className="bg-slate-800 rounded p-3 border border-slate-700"
            >

              <div className="flex justify-between mb-2">

                <span className="text-sm font-semibold text-white">
                  {item.riskPattern}
                </span>

                <span className="text-xs text-cyan-300">
                  Similitud:
                  {item.similarityScore}%
                </span>

              </div>

              <p className="text-xs text-slate-300">
                {item.interpretation}
              </p>

            </div>

          )
        )}

      </div>

    </div>
  );
};

export default CorrelationPanel;