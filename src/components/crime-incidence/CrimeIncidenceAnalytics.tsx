"use client";

import React from "react";
import type { CrimeIncidenceAnalyticalProjection } from "@/types/crimeIncidenceAnalyticalProjection";

interface CrimeIncidenceAnalyticsProps {
  projection: CrimeIncidenceAnalyticalProjection;
}

interface DistributionBucket {
  value: string | null;
  count: number;
}

const unavailable = "Información no disponible";

function displayValue(value: string | number | null | undefined): React.ReactNode {
  return value === null || value === undefined || value === "" ? unavailable : value;
}

function DistributionRows({ buckets }: { buckets: readonly DistributionBucket[] | null | undefined }) {
  if (!buckets?.length) {
    return <p className="text-sm text-slate-500">{unavailable}</p>;
  }

  return (
    <div className="divide-y divide-slate-800 border-y border-slate-800">
      {buckets.map((bucket, index) => (
        <div key={`${bucket.value ?? "SIN_VALOR"}:${bucket.count}:${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm">
          <span className="truncate text-slate-300" title={bucket.value ?? undefined}>{displayValue(bucket.value)}</span>
          <span className="font-semibold tabular-nums text-slate-100">{bucket.count}</span>
        </div>
      ))}
    </div>
  );
}

export function CrimeIncidenceAnalytics({ projection }: CrimeIncidenceAnalyticsProps) {
  const { metrics } = projection;

  return (
    <section aria-labelledby="crime-incidence-analytics-title" className="border-b border-slate-800 bg-slate-950 px-4 py-5 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase text-cyan-500">Producto analítico descriptivo</p>
          <h3 id="crime-incidence-analytics-title" className="mt-1 text-base font-semibold text-slate-100">Métricas descriptivas</h3>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs lg:grid-cols-4">
          <div><dt className="text-slate-500">Nivel analítico</dt><dd className="font-semibold text-slate-200">{displayValue(projection.analyticalLevel)}</dd></div>
          <div><dt className="text-slate-500">Dataset autorizado</dt><dd className="font-semibold text-slate-200">{displayValue(projection.datasetReference.datasetId)}</dd></div>
          <div><dt className="text-slate-500">Cobertura</dt><dd className="font-semibold text-slate-200">{displayValue(projection.geographicReference.coverageStatus)}</dd></div>
          <div><dt className="text-slate-500">Proyección</dt><dd className="font-semibold text-slate-200">{displayValue(projection.projectionType)}</dd></div>
        </dl>
      </div>

      <dl className="mt-5 grid border-y border-slate-800 sm:grid-cols-4">
        {[
          ["Total de eventos", metrics.frequency.totalRecords],
          ["Registros compatibles", metrics.aggregation.matchedRecords],
          ["Registros excluidos", metrics.aggregation.excludedRecords],
          ["Con coordenadas", metrics.aggregation.recordsWithCoordinates],
        ].map(([label, value]) => (
          <div key={String(label)} className="border-b border-slate-800 px-3 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-100">{displayValue(value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-7 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Frecuencia por tipo</h4>
          <div className="mt-3"><DistributionRows buckets={metrics.frequency.byIncidentType} /></div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Composición por tipo</h4>
          <div className="mt-3 space-y-3">
            {metrics.percentage.byIncidentType?.length ? metrics.percentage.byIncidentType.map((bucket, index) => (
              <div key={`${bucket.value ?? "SIN_VALOR"}:${bucket.count}:${index}`}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="truncate text-slate-300" title={bucket.value ?? undefined}>{displayValue(bucket.value)}</span>
                  <span className="font-semibold tabular-nums text-slate-100">{bucket.percentage}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden bg-slate-800" aria-hidden="true">
                  <div className="h-full bg-cyan-600" style={{ width: `${bucket.percentage}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{bucket.count} registros</p>
              </div>
            )) : <p className="text-sm text-slate-500">{unavailable}</p>}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Distribución temporal</h4>
          <p className="mt-1 text-xs text-slate-500">{displayValue(projection.temporalReference.query.start)} a {displayValue(projection.temporalReference.query.end)}</p>
          <div className="mt-3"><DistributionRows buckets={metrics.distribution.byOccurredDate} /></div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Distribución territorial</h4>
          <div className="mt-3"><DistributionRows buckets={metrics.distribution.byMunicipality} /></div>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <h4 className="text-sm font-semibold text-slate-200">Limitaciones del análisis</h4>
        {projection.limitations?.length ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-400">
            {projection.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-500">{unavailable}</p>}
        <p className="mt-3 text-xs font-medium text-slate-500">Producto descriptivo sin inferencia causal.</p>
      </div>
    </section>
  );
}
