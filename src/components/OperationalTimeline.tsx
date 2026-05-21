import React from 'react';

interface Props {
  session: any;
}

const OperationalTimeline: React.FC<Props> = ({
  session,
}) => {

  if (!session) {
    return null;
  }

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-orange-300 mb-4">
        Timeline Operativo
      </h2>

      <div className="space-y-3">

        <div className="bg-slate-800 rounded p-3">

          <p className="text-xs text-slate-400">
            Usuario
          </p>

          <p className="text-sm text-white">
            {session.username}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-3">

          <p className="text-xs text-slate-400">
            Rol
          </p>

          <p className="text-sm text-cyan-300">
            {session.userRole}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-3">

          <p className="text-xs text-slate-400">
            Módulo Activo
          </p>

          <p className="text-sm text-fuchsia-300">
            {session.activeModule}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-3">

          <p className="text-xs text-slate-400">
            Inicio de Sesión
          </p>

          <p className="text-sm text-emerald-300">
            {new Date(
              session.startedAt
            ).toLocaleString()}
          </p>

        </div>

        <div className="bg-slate-800 rounded p-3">

          <p className="text-xs text-slate-400">
            Última Actividad
          </p>

          <p className="text-sm text-amber-300">
            {new Date(
              session.lastActivity
            ).toLocaleString()}
          </p>

        </div>

      </div>

    </div>
  );
};

export default OperationalTimeline;