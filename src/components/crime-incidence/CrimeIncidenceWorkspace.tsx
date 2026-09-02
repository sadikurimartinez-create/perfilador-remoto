"use client";

import React, { useState } from "react";
import { CEIPOLBadge } from "@/components/ui/CEIPOLBadge";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";
import { CEIPOLEmptyState } from "@/components/ui/CEIPOLEmptyState";
import { CEIPOLErrorState } from "@/components/ui/CEIPOLErrorState";
import { CEIPOLLoadingState } from "@/components/ui/CEIPOLLoadingState";
import { CEIPOLSectionHeader } from "@/components/ui/CEIPOLSectionHeader";
import { CrimeIncidenceAnalytics } from "@/components/crime-incidence/CrimeIncidenceAnalytics";
import { CrimeIncidenceFilters } from "@/components/crime-incidence/CrimeIncidenceFilters";
import { CrimeIncidenceMap } from "@/components/crime-incidence/CrimeIncidenceMap";
import type { CrimeIncidenceFilterQueryIntent, CrimeIncidenceFilterState } from "@/types/crimeIncidenceControlledFilters";
import type { CrimeIncidenceWorkspaceBindingResult } from "@/utils/crimeIncidenceWorkspaceBinding";
import {
  prepareCrimeIncidenceInstitutionalExport,
  type CrimeIncidenceInstitutionalDocumentProduct,
} from "@/utils/crimeIncidenceWorkspaceExport";
import { createCrimeIncidenceFilterQueryIntent, createCrimeIncidenceFilterState } from "@/utils/crimeIncidenceControlledFilters";

export type CrimeIncidenceWorkspaceVisualState = "LOADING" | "READY" | "EMPTY" | "NO_COVERAGE" | "ERROR";

interface CrimeIncidenceWorkspaceProps {
  binding?: CrimeIncidenceWorkspaceBindingResult;
  onExportProduct?: (product: CrimeIncidenceInstitutionalDocumentProduct) => void | Promise<void>;
  onFilterRequest?: (intent: CrimeIncidenceFilterQueryIntent) => void | Promise<void>;
}

export function getCrimeIncidenceWorkspaceVisualState(
  binding?: CrimeIncidenceWorkspaceBindingResult
): CrimeIncidenceWorkspaceVisualState {
  return binding?.state ?? "LOADING";
}

function display(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "No disponible" : String(value);
}

export function CrimeIncidenceWorkspace({ binding, onExportProduct, onFilterRequest }: CrimeIncidenceWorkspaceProps) {
  const [exporting, setExporting] = useState(false);
  const visualState = getCrimeIncidenceWorkspaceVisualState(binding);
  const viewModel = binding?.viewModel ?? null;
  const resolution = viewModel?.geographyContext.geographicResolution;
  const datasetId = viewModel?.datasetReference.datasetId;
  const queryRequest = viewModel?.queryReference.request;

  const handleExport = async () => {
    if (visualState !== "READY" || !viewModel || !onExportProduct) return;
    setExporting(true);
    try {
      await onExportProduct(prepareCrimeIncidenceInstitutionalExport(viewModel.exportReference));
    } finally {
      setExporting(false);
    }
  };

  const handleFilters = async (filters: CrimeIncidenceFilterState) => {
    if (!queryRequest || !onFilterRequest) return;
    await onFilterRequest(createCrimeIncidenceFilterQueryIntent(queryRequest, filters));
  };

  return (
    <section className="w-full border border-slate-800 bg-slate-950" data-testid="crime-incidence-workspace" data-state={visualState}>
      <div className="border-b border-slate-800 px-4 py-4 md:px-6">
        <CEIPOLSectionHeader
          title="Incidencia delictiva"
          subtitle={viewModel ? `Expediente ${viewModel.expedienteId}` : "Preparando workspace gobernado"}
          actions={(
            <div className="flex items-center gap-2">
              <CEIPOLBadge status={visualState === "READY" ? "validated" : visualState === "NO_COVERAGE" ? "warning" : visualState === "ERROR" ? "error" : "pending"}>
                {visualState.replace("_", " ")}
              </CEIPOLBadge>
              <CEIPOLButton
                size="sm"
                variant="secondary"
                disabled={visualState !== "READY" || !viewModel || !onExportProduct || exporting}
                onClick={handleExport}
                title={onExportProduct ? "Generar producto documental institucional" : "Renderer documental no disponible"}
              >
                {exporting ? "Generando" : "Exportar"}
              </CEIPOLButton>
            </div>
          )}
        />

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <div><dt className="inline text-slate-500">Dataset: </dt><dd className="inline text-slate-200">{display(datasetId)}</dd></div>
          <div><dt className="inline text-slate-500">Estado: </dt><dd className="inline text-slate-200">{display(viewModel?.queryReference.status)}</dd></div>
          <div><dt className="inline text-slate-500">Cobertura: </dt><dd className="inline text-slate-200">{display(resolution?.coverageStatus)}</dd></div>
          <div><dt className="inline text-slate-500">Nivel analítico: </dt><dd className="inline text-slate-200">{display(viewModel?.exportReference.analyticalLevel)}</dd></div>
        </dl>
      </div>

      {viewModel && queryRequest ? (
        <CrimeIncidenceFilters
          value={createCrimeIncidenceFilterState(queryRequest)}
          incidentTypeOptions={viewModel.exportReference.projectionReference.metrics.frequency.byIncidentType.map((bucket) => bucket.value)}
          datasetId={datasetId}
          currentCoverage={resolution?.coverageStatus}
          disabled={!onFilterRequest || visualState === "ERROR"}
          onApply={handleFilters}
        />
      ) : null}

      <div className="relative flex h-[65vh] min-h-[420px] w-full items-center justify-center border-b border-slate-800 bg-slate-900/40" data-testid="crime-incidence-map-container">
        {visualState === "LOADING" && (
          <CEIPOLLoadingState message="Preparando incidencia delictiva" subMessage="Consulta gobernada no disponible todavía" />
        )}
        {visualState === "EMPTY" && (
          <CEIPOLEmptyState title="Sin incidentes compatibles" description="La resolución geográfica no contiene incidentes compatibles para mostrar." />
        )}
        {visualState === "NO_COVERAGE" && (
          <CEIPOLEmptyState title="Sin cobertura territorial" description={display(resolution?.coverageExplanation)} />
        )}
        {visualState === "ERROR" && (
          <CEIPOLErrorState title="No fue posible preparar el workspace" description={binding?.error ?? "Error de binding no especificado"} />
        )}
        {visualState === "READY" && viewModel && (
          <CrimeIncidenceMap viewModel={viewModel} />
        )}
      </div>

      {visualState === "READY" && viewModel ? (
        <CrimeIncidenceAnalytics projection={viewModel.exportReference.projectionReference} />
      ) : null}

      <div className="px-4 py-5 md:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase text-slate-200">Resultados trazables</h3>
          <span className="text-[10px] text-slate-500">{viewModel?.incidents.table.length ?? 0} registros</span>
        </div>
        <div className="overflow-x-auto border border-slate-800">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="bg-slate-900 text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Municipio</th>
                <th className="px-3 py-2">Fuente</th><th className="px-3 py-2">Cobertura</th><th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {(viewModel?.incidents.table ?? []).map(({ classification, incident }) => (
                <tr key={`${classification}:${incident.id}`}>
                  <td className="px-3 py-2">{display(incident.occurredDate)}</td>
                  <td className="px-3 py-2">{display(incident.incidentType)}</td>
                  <td className="px-3 py-2">{display(incident.location.municipality)}</td>
                  <td className="px-3 py-2">{display(incident.source.sourceReference ?? incident.source.sourceFile ?? incident.source.querySource)}</td>
                  <td className="px-3 py-2">{display(incident.coverage.geographic)}</td>
                  <td className="px-3 py-2">{classification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default CrimeIncidenceWorkspace;
