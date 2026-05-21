import React from 'react';

interface Props {
  sessions: any[];
}

const MultiUserPanel: React.FC<Props> = ({
  sessions,
}) => {

  if (
    !sessions ||
    sessions.length === 0
  ) {
    return null;
  }

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-cyan-300 mb-4">
        Monitoreo Multiusuario
      </h2>

      <div className="space-y-3">

        {sessions.map(
          (session, index) => (

            <div
              key={index}
              className="bg-slate-800 rounded p-3 border border-slate-700"
            >

              <div className="flex justify-between mb-2">

                <span className="text-sm font-semibold text-white">
                  {session.username}
                </span>

                <span className="text-xs text-fuchsia-300">
                  {session.userRole}
                </span>

              </div>

              <p className="text-xs text-slate-300">
                Módulo:
                {' '}
                {session.activeModule}
              </p>

              <p className="text-xs text-slate-400 mt-1">
                Última actividad:
                {' '}
                {new Date(
                  session.lastActivity
                ).toLocaleString()}
              </p>

            </div>

          )
        )}

      </div>

    </div>
  );
};

export default MultiUserPanel;