"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getCanonicalScinceData } from "@/lib/osintActions";
import { getScinceContextFreshness, prepareScinceContextIncorporation } from "@/lib/scinceHumanContextActions";
import { createScinceHumanContextFlow, type ScinceHumanState } from "@/utils/scinceHumanContextFlow";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import type { ScinceCanonicalSuccess, ScinceSnapshotFreshness } from "@/types/scinceCanonicalSnapshot";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";

type Props = {
  projectId: string;
  canonicalGeography: CanonicalProjectGeography | null | undefined;
  analysis: Record<string, unknown> | null;
  isReadOnly: boolean;
  updateProjectDetails: (details: { iaAnalysis: Record<string, unknown> }) => Promise<void>;
  setAnalysisResult: (analysis: Record<string, unknown>) => void;
};
const display = (value: unknown) => value == null ? "No disponible" : String(value);
const freshnessLabels: Record<ScinceSnapshotFreshness, string> = {
  CURRENT: "VIGENTE", STALE: "OBSOLETO", INVALID: "INVÁLIDO", MISSING: "NO DISPONIBLE",
};

export function ScinceFreshnessStatus({ freshness }: { freshness: ScinceSnapshotFreshness | "CHECKING" | "UNAVAILABLE" }) {
  return <>
    <p className="text-xs" role="status">Contexto SCINCE incorporado: {freshness === "CHECKING" ? "Comprobando vigencia…" :
      freshness === "UNAVAILABLE" ? "NO DISPONIBLE" : freshnessLabels[freshness]}</p>
    {freshness === "STALE" && <p className="text-xs text-amber-300">El contexto SCINCE incorporado ya no corresponde al territorio vigente. Se conserva como antecedente.</p>}
  </>;
}

export function ScinceObservedResult({ result }: { result: ScinceCanonicalSuccess }) {
  const d = result.demographics;
  return <div className="space-y-2 text-xs text-slate-300" data-testid="scince-observed-result">
    <p>Contexto sociodemográfico observado</p>
    <dl className="grid grid-cols-2 gap-2">
      <dt>Dataset</dt><dd>{display(result.datasetId)}</dd>
      <dt>Año</dt><dd>{display(result.datasetYear)}</dd>
      <dt>Versión</dt><dd>{display(result.datasetVersion)}</dd>
      <dt>Nivel geográfico localizado</dt><dd>{display(result.geographicLevel)}</dd>
      <dt>Nivel demográfico efectivo</dt><dd>{display(result.demographicGeographicLevel)}</dd>
      <dt>Clave territorial de la fila</dt><dd>{display(result.sourceRowKey)}</dd>
      <dt>Población total</dt><dd>{display(d?.populationTotal)}</dd>
      <dt>Viviendas totales</dt><dd>{display(d?.housingTotal)}</dd>
      <dt>Viviendas particulares habitadas</dt><dd>{display(d?.inhabitedPrivateHousing)}</dd>
      <dt>Viviendas particulares deshabitadas</dt><dd>{display(d?.uninhabitedPrivateHousing)}</dd>
      <dt>Marginación</dt><dd>{display(d?.marginacion)} {d?.marginacionNote}</dd>
    </dl>
    {result.geographicLevel !== result.demographicGeographicLevel && <p className="text-amber-300">
      Los niveles difieren: ubicación {display(result.geographicLevel)}; cifras de {display(result.demographicGeographicLevel)}.
    </p>}
    <ul className="list-disc pl-4">{result.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul>
  </div>;
}

export function ScinceHumanContextPanel(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  // A change while consulting/incorporating cancels the pending decision, including local map edits.
  const territoryRevision = JSON.stringify(props.canonicalGeography ?? null);
  const [state, setState] = useState<ScinceHumanState>({ status: "IDLE", result: null, message: null });
  const [freshness, setFreshness] = useState<ScinceSnapshotFreshness | "CHECKING" | "UNAVAILABLE">("CHECKING");
  const [freshnessMessage, setFreshnessMessage] = useState<string | null>(null);
  const snapshot = props.analysis?.scinceCanonicalSnapshot;
  const hasLegacy = props.analysis?.scinceDemographics != null;
  const freshnessScope = useMemo(() => ({ projectId: props.projectId, territoryRevision, snapshot }),
    [props.projectId, territoryRevision, snapshot]);
  const [evaluatedScope, setEvaluatedScope] = useState<typeof freshnessScope | null>(null);
  const flow = useMemo(() => createScinceHumanContextFlow({
    context: () => ({ projectId: latest.current.projectId, readOnly: latest.current.isReadOnly,
      analysis: latest.current.analysis, territoryRevision: JSON.stringify(latest.current.canonicalGeography ?? null) }),
    query: getCanonicalScinceData, prepare: prepareScinceContextIncorporation,
    updateProjectDetails: details => latest.current.updateProjectDetails(details),
    setAnalysisResult: analysis => latest.current.setAnalysisResult(analysis), changed: setState,
  }), [props.projectId]);
  useEffect(() => { flow.activate(); return () => flow.dispose(); }, [flow]);
  useEffect(() => { setState(flow.getState()); }, [flow]);
  useEffect(() => {
    if (flow.getState().status === "RESULTADO_DISPONIBLE") flow.dismiss();
  }, [flow, territoryRevision]);
  useEffect(() => {
    let active = true;
    setFreshness("CHECKING");
    setFreshnessMessage(null);
    // Absence remains absence; legacy data is never submitted as a canonical snapshot.
    if (snapshot == null) { setFreshness("MISSING"); setEvaluatedScope(freshnessScope); return () => { active = false; }; }
    getScinceContextFreshness(props.projectId, snapshot, props.canonicalGeography ?? null).then(response => {
      if (!active) return;
      setEvaluatedScope(freshnessScope);
      if (response.success) setFreshness(response.freshness.territorialFreshness);
      else {
        setFreshness("UNAVAILABLE");
        setFreshnessMessage(response.code === "ACCESS_DENIED" ? "Acceso denegado para comprobar vigencia." : "No fue posible comprobar vigencia.");
      }
    }).catch(() => { if (active) { setEvaluatedScope(freshnessScope); setFreshness("UNAVAILABLE"); setFreshnessMessage("No fue posible comprobar vigencia."); } });
    return () => { active = false; };
  }, [freshnessScope, props.projectId, territoryRevision, snapshot]);
  // Never display a previous CURRENT result during the render preceding the refresh effect.
  const visibleFreshness = snapshot == null ? "MISSING" : evaluatedScope === freshnessScope ? freshness : "CHECKING";
  const busy = state.status === "CONSULTANDO" || state.status === "INCORPORANDO";
  const incompatible = !!props.canonicalGeography &&
    (props.canonicalGeography.type !== "INDIVIDUAL" || props.canonicalGeography.geometry.type !== "Point");
  return <section className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50" aria-label="SCINCE canónico">
    <h3 className="font-bold text-cyan-300">Demografía territorial — INEGI (Paso 5)</h3>
    <p className="text-xs text-slate-300">La consulta utiliza la geometría canónica del expediente. Revise el resultado antes de decidir su incorporación.</p>
    <ScinceFreshnessStatus freshness={visibleFreshness} />
    {evaluatedScope === freshnessScope && freshnessMessage && <p className="text-xs text-amber-300">{freshnessMessage}</p>}
    {hasLegacy && <p className="text-xs text-slate-400">Contexto SCINCE legacy conservado; no acredita un snapshot canónico vigente.</p>}
    {incompatible && <p className="text-xs text-amber-300">SCINCE canónico no disponible todavía para esta modalidad territorial.</p>}
    <CEIPOLButton disabled={!props.projectId || props.isReadOnly || busy || incompatible}
      loading={state.status === "CONSULTANDO"} onClick={() => void flow.consult()}>CONSULTAR SCINCE</CEIPOLButton>
    <p className="text-xs text-slate-400" role="status">{state.status}</p>
    {state.message && <p className="text-xs text-amber-300" role="status">{state.message}</p>}
    {state.result && <div className="space-y-3 border border-slate-700 rounded-lg p-4" aria-label="Revisión humana SCINCE">
      <ScinceObservedResult result={state.result} />
      {snapshot != null && <p className="text-xs text-amber-300">Incorporar este resultado reemplaza el contexto SCINCE canónico anterior para fines vigentes.</p>}
      <div className="flex gap-2">
        <CEIPOLButton variant="secondary" disabled={busy} onClick={() => flow.dismiss()}>NO INCORPORAR</CEIPOLButton>
        <CEIPOLButton variant="confirm" disabled={busy || props.isReadOnly || incompatible || state.status !== "RESULTADO_DISPONIBLE"}
          loading={state.status === "INCORPORANDO"} onClick={() => void flow.incorporate()}>INCORPORAR AL CONTEXTO</CEIPOLButton>
      </div>
    </div>}
  </section>;
}
