"use client";

import React, { useEffect, useState } from "react";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";
import type { CrimeIncidenceFilterState } from "@/types/crimeIncidenceControlledFilters";

interface CrimeIncidenceFiltersProps {
  value: CrimeIncidenceFilterState;
  incidentTypeOptions: Array<string | null>;
  datasetId?: string;
  currentCoverage?: string;
  disabled?: boolean;
  onApply: (filters: CrimeIncidenceFilterState) => void;
}

export function CrimeIncidenceFilters({ value, incidentTypeOptions, datasetId, currentCoverage, disabled = false, onApply }: CrimeIncidenceFiltersProps) {
  const [draft, setDraft] = useState<CrimeIncidenceFilterState>(value);
  useEffect(() => setDraft(value), [value]);
  const incidentType = draft.incidentTypes[0] ?? "";
  const activeFilters = [
    draft.temporal.start ? `Desde ${draft.temporal.start}` : null,
    draft.temporal.end ? `Hasta ${draft.temporal.end}` : null,
    incidentType ? `Tipo ${incidentType}` : null,
    draft.geographicCoverage ? `Cobertura ${draft.geographicCoverage}` : null,
  ];

  return (
    <section aria-label="Filtros analíticos controlados" className="border-b border-slate-800 bg-slate-950 px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[145px] flex-1 text-xs text-slate-400">Desde
          <input type="date" value={draft.temporal.start ?? ""} disabled={disabled} onChange={(event) => setDraft({ ...draft, temporal: { ...draft.temporal, start: event.target.value || null } })} className="mt-1 h-9 w-full border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100" />
        </label>
        <label className="min-w-[145px] flex-1 text-xs text-slate-400">Hasta
          <input type="date" value={draft.temporal.end ?? ""} disabled={disabled} onChange={(event) => setDraft({ ...draft, temporal: { ...draft.temporal, end: event.target.value || null } })} className="mt-1 h-9 w-full border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100" />
        </label>
        <label className="min-w-[180px] flex-[1.25] text-xs text-slate-400">Tipo de incidencia
          <select value={incidentType} disabled={disabled} onChange={(event) => setDraft({ ...draft, incidentTypes: event.target.value ? [event.target.value] : [] })} className="mt-1 h-9 w-full border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100">
            <option value="">Todos los tipos autorizados</option>
            {incidentTypeOptions.map((option, index) => option ? <option key={`${option}:${index}`} value={option}>{option}</option> : null)}
          </select>
        </label>
        <label className="min-w-[180px] flex-1 text-xs text-slate-400">Cobertura geográfica
          <select value={draft.geographicCoverage ?? ""} disabled={disabled} onChange={(event) => setDraft({ ...draft, geographicCoverage: event.target.value ? event.target.value as CrimeIncidenceFilterState["geographicCoverage"] : null })} className="mt-1 h-9 w-full border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100">
            <option value="">Cobertura autorizada vigente</option>
            <option value="IN_COVERAGE">IN_COVERAGE</option>
            <option value="OUT_OF_COVERAGE">OUT_OF_COVERAGE</option>
            <option value="UNKNOWN_COVERAGE">UNKNOWN_COVERAGE</option>
          </select>
        </label>
        <CEIPOLButton size="sm" variant="secondary" disabled={disabled} onClick={() => onApply(draft)}>Aplicar filtros</CEIPOLButton>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
        <span>Dataset: {datasetId || "No disponible"}</span>
        <span>Cobertura vigente: {currentCoverage || "No disponible"}</span>
        {activeFilters.map((filter, index) => filter ? <span key={`${filter}:${index}`} className="border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">{filter}</span> : null)}
      </div>
    </section>
  );
}
