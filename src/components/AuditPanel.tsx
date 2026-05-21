import React from 'react';

interface Props {
  auditLogs: any[];
}

const AuditPanel: React.FC<Props> = ({
  auditLogs,
}) => {

  if (
    !auditLogs ||
    auditLogs.length === 0
  ) {
    return null;
  }

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-emerald-300 mb-4">
        Auditoría Institucional
      </h2>

      <div className="space-y-3 max-h-96 overflow-y-auto">

        {auditLogs
          .slice()
          .reverse()
          .map((log, index) => (

            <div
              key={index}
              className="bg-slate-800 rounded p-3 border border-slate-700"
            >

              <div className="flex justify-between mb-2">

                <span className="text-sm font-semibold text-white">
                  {log.action}
                </span>

                <span className="text-xs text-cyan-300">
                  {new Date(
                    log.timestamp
                  ).toLocaleString()}
                </span>

              </div>

              <p className="text-xs text-slate-300">
                Usuario:
                {' '}
                {log.username}
                {' '}
                ({log.userRole})
              </p>

              {log.details && (

                <p className="text-xs text-slate-400 mt-1">
                  {log.details}
                </p>

              )}

            </div>

          ))}

      </div>

    </div>
  );
};

export default AuditPanel;