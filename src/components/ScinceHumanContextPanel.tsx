"use client";

import officialCatalog from "@/data/scince/inegi-cpv2020-catalog.json";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getCanonicalScinceData } from "@/lib/osintActions";
import { getScinceQueryCapability, getScinceContextFreshness, prepareScinceContextIncorporation } from "@/lib/scinceHumanContextActions";
import { createScinceHumanContextFlow, type ScinceHumanState } from "@/utils/scinceHumanContextFlow";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import type { ScinceCanonicalSuccess, ScinceSnapshotFreshness } from "@/types/scinceCanonicalSnapshot";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";

import { readScinceCanonicalGeography } from "@/utils/scinceQueryGeometry";

type Props = {
  canAnalyzeScince?: boolean;
  projectId: string;
  canonicalGeography: CanonicalProjectGeography | null | undefined;
  analysis: Record<string, unknown> | null;
  isReadOnly: boolean;
  updateProjectDetails: (details: { iaAnalysis: Record<string, unknown> }) => Promise<void>;
  setAnalysisResult: (analysis: Record<string, unknown>) => void;
};
const unitRelationLabels = {FULL_UNIT:"Unidad completa cubierta",PARTIAL_UNIT:"Unidad parcialmente relacionada",TOUCHED_UNIT:"Sólo contacto de borde"};
const indicatorLabels: Record<string,string> = {populationTotal:"Población",housingTotal:"Viviendas",inhabitedPrivateHousing:"Viviendas habitadas",uninhabitedPrivateHousing:"Viviendas deshabitadas"};
const dimensionLabels:Record<string,string>={POPULATION:"Población",SEX:"Sexo",AGE:"Edad",FERTILITY:"Fecundidad",MIGRATION:"Migración",INDIGENOUS_ETHNICITY:"Etnicidad e indígenas",DISABILITY:"Discapacidad",EDUCATION:"Educación",ECONOMIC_ACTIVITY:"Actividad económica",HEALTH:"Salud",MARITAL_STATUS:"Situación conyugal",RELIGION:"Religión",HOUSEHOLDS:"Hogares",HOUSING:"Vivienda",BASIC_SERVICES:"Servicios básicos",OVERCROWDING:"Cuartos y ocupación",ICT:"Bienes y TIC",OTHER:"Otras variables"};
const statusLabels:Record<string,string>={SUPPRESSED:"Reservado por confidencialidad",NOT_AVAILABLE:"No disponible",NOT_APPLICABLE:"No aplica",INVALID_SOURCE_VALUE:"Valor fuente inválido",MISSING:"Sin dato"};
const officialNames=new Map(officialCatalog.variables.map(v=>[v.variableCode,v.officialName]));
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
  if(result.compactSnapshot) {
    const s=result.compactSnapshot,v=result.reviewView;
    if(!v || v.snapshotFingerprint!==s.audit.contentFingerprint)return <p className="text-xs text-amber-300">Vista SCINCE inválida. Consulte nuevamente.</p>;
    return <div className="space-y-3 text-xs" data-testid="scince-compact-result">
      <p>REQUIERE REVISIÓN PPC · Dato oficial INEGI 2020 · Sin estimación al año actual</p>
      <p>Dataset: {v.dataset.datasetId} · {v.dataset.referenceYear} · {v.dataset.version}</p>
      <p>Geografía: {v.geography.geographyType} · {v.geography.geographyId} · Vigencia: {freshnessLabels[v.freshness]}</p>
      <p>Unidades: {v.unitCount} · Completas: {v.coverageSummary.FULL_UNIT} · Parciales: {v.coverageSummary.PARTIAL_UNIT} · Sólo borde: {v.coverageSummary.TOUCHED_UNIT}</p>
      <details><summary>Metodología del entorno territorial</summary><dl className="grid grid-cols-2 gap-2">
        <dt>Centro de análisis</dt><dd>{v.analysisArea.center.lat}, {v.analysisArea.center.lng}</dd>
        <dt>Radio de cobertura</dt><dd>{v.analysisArea.coverageRadiusMeters.toFixed(2)} m</dd>
        <dt>Expansión contextual</dt><dd>{v.analysisArea.contextExpansionMeters} m</dd>
        <dt>Radio total</dt><dd>{v.analysisArea.analysisRadiusMeters.toFixed(2)} m</dd>
        <dt>Área aproximada analizada</dt><dd>{v.analysisArea.approximateAreaSquareMeters.toFixed(2)} m²</dd>
      </dl><p>Cifras de unidades fuente completas; sin prorrateo de población por área.</p></details>
      <div aria-label="Perfil oficial INEGI 2020">{Object.entries(dimensionLabels).map(([dimension,label])=>{
        const values=v.aggregateIndicators.filter(i=>i.dimension===dimension);if(!values.length)return null;
        return <details key={dimension}><summary>{label}</summary>{values.map(i=><p key={i.code}>{i.name}: {display(i.value)} · {i.status==='NOT_AGGREGATED'?'Sin agregado metodológicamente admisible':'Suma de unidades completas seleccionadas'}{i.reasonCode?` · ${i.reasonCode}`:''}</p>)}</details>;
      })}</div>
      <details><summary>Derivaciones reproducibles</summary>{v.derivedIndicators.map(i=><p key={i.name}>{i.name}: {i.value} · {i.formula}</p>)}</details>
      <details><summary>Procedencia INEGI</summary><p>{v.provenanceSummary.productName} · {v.provenanceSummary.censusSourceUrl}</p><p>Release: {v.release.releaseId} · Catálogo: {v.catalog.catalogVersion}</p><p>Importación: {v.provenanceSummary.completedAt} · Huella censal: {v.provenanceSummary.censusSha256}</p></details>
      <ul>{v.limitations.map((w,i)=><li key={i}>{w}</li>)}</ul>
    </div>;
  }
  if (result.multiunit) return <div className="space-y-3 text-xs" data-testid="scince-multiunit-result">
    <p>REQUIERE REVISIÓN PPC · {result.geographyType === "INDIVIDUAL" ? "Entorno de un punto" : result.geographyType === "CORRIDOR" ? "Consulta sobre corredor" : "Consulta sobre área"}</p>
    <p>Dataset: {result.multiunit.dataset.datasetId} · {result.multiunit.dataset.year} · {result.multiunit.dataset.version}</p>
    <p>Unidades: {result.multiunit.territorialUnits.length} · Filas censales: {result.multiunit.sourceRows.length}</p>
    {result.multiunit.scinceAnalysisArea && <details><summary>Metodología del entorno territorial</summary><dl className="grid grid-cols-2 gap-2">
      <dt>Centro de análisis</dt><dd>{result.multiunit.scinceAnalysisArea.center.lat}, {result.multiunit.scinceAnalysisArea.center.lng}</dd>
      <dt>Radio de cobertura</dt><dd>{result.multiunit.scinceAnalysisArea.coverageRadiusMeters.toFixed(2)} m</dd>
      <dt>Expansión contextual</dt><dd>{result.multiunit.scinceAnalysisArea.contextExpansionMeters} m</dd>
      <dt>Radio total</dt><dd>{result.multiunit.scinceAnalysisArea.analysisRadiusMeters.toFixed(2)} m</dd>
      <dt>Área aproximada analizada</dt><dd>{result.multiunit.scinceAnalysisArea.approximateAreaSquareMeters.toFixed(2)} m²</dd>
      <dt>Unidades INEGI / año censal</dt><dd>{result.multiunit.territorialUnits.length} / {result.multiunit.dataset.year}</dd>
    </dl><p>El área analítica contiene la geometría original completa. Las cifras corresponden a unidades censales completas, sin prorrateo.</p></details>}
    {result.multiunit.officialBaseProfile2020 && <div aria-label="Perfil oficial INEGI 2020">
      <p>Dato oficial INEGI 2020 · Sin estimación al año actual</p>
      {Object.entries(result.multiunit.officialBaseProfile2020.profileDimensions).map(([dimension,codes])=><details key={dimension}><summary>{dimensionLabels[dimension] || dimension}</summary>
        {result.multiunit!.officialBaseProfile2020!.rawIndicators.filter(i=>codes?.includes(i.variableCode)).map(i=><p key={`${i.sourceReference}:${i.variableCode}`}>
          {officialNames.get(i.variableCode) || i.variableCode}: {i.typedValue===null?statusLabels[i.valueStatus]:display(i.typedValue)} · {i.geographicLevel} {i.sourceRowKey}
        </p>)}
      </details>)}
      <details><summary>Derivaciones reproducibles</summary>{result.multiunit.officialBaseProfile2020.derivedIndicators.map(i=><p key={i.name}>{i.name}: {i.value} · {i.formula}</p>)}</details>
      <details><summary>Limitaciones metodológicas</summary>{result.multiunit.officialBaseProfile2020.methodologicalWarnings.map(w=><p key={w}>{w}</p>)}</details>
    </div>}
    {!result.multiunit.officialBaseProfile2020 && result.multiunit.derivedSociodemographicProfile && <div aria-label="Perfil sociodemográfico">
      <p>Perfil oficial {result.multiunit.derivedSociodemographicProfile.referenceYear}</p>
      {Object.entries(result.multiunit.derivedSociodemographicProfile.dimensions).map(([key,dimension])=><details key={key}><summary>{key==='population'?'Población':'Vivienda'}</summary>
        {dimension.rawIndicators.map((i,index)=><p key={index}>{indicatorLabels[i.name] || i.name}: {display(i.value)} · Unidad fuente: {i.observationId}</p>)}
      </details>)}<p>Las demás dimensiones no están disponibles en el producto normalizado. Sin estimación al año actual.</p>
    </div>}
    <div className="max-h-80 overflow-y-auto"><table className="w-full"><thead><tr><th>Unidad INEGI</th><th>Relación</th><th>Porción espacial</th><th>Cifras completas de la unidad</th></tr></thead><tbody>
      {result.multiunit.unitDetails.map(unit => <tr key={`${unit.unitType}:${unit.inegiCode}`}><td>{unit.unitType} {unit.inegiCode} {unit.name}</td>
        <td>{unitRelationLabels[unit.intersectionType]}</td><td>{unit.coverageMetric.intersection} {unit.coverageMetric.measure === "METRES" ? "m" : "m²"}</td>
        <td>{result.multiunit!.sourceRows.filter(row=>row.geographicCode===unit.inegiCode && row.demographicGeographicLevel===unit.unitType && row.usage!=="ENUMERATION_ONLY").map(row=>
          <p key={row.observationId}>Población: {display(row.demographics.populationTotal)}; viviendas: {display(row.demographics.housingTotal)} · Fuente: {row.sourceRowKey}</p>)}</td></tr>)}
    </tbody></table></div>
    {result.multiunit.aggregates.map(a=><p key={a.name}>{indicatorLabels[a.name] || a.name}: {display(a.value)} · {a.method === "NOT_AGGREGATED" ? "Sin agregado metodológicamente admisible" : "Suma de unidades completas seleccionadas"}</p>)}
    <ul>{result.multiunit.methodologicalWarnings.map(w=><li key={w}>{w}</li>)}</ul>
  </div>;
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
  const [canAnalyze, setCanAnalyze] = useState(props.canAnalyzeScince === true);
  useEffect(() => { let active=true;setCanAnalyze(props.canAnalyzeScince === true);
    if (props.canAnalyzeScince === undefined) getScinceQueryCapability(props.projectId).then(allowed=>{if(active)setCanAnalyze(allowed);}).catch(()=>{if(active)setCanAnalyze(false);});
    return ()=>{active=false;};
  },[props.projectId,props.canAnalyzeScince]);
  const latest = useRef({...props, canAnalyze});
  latest.current = {...props, canAnalyze};
  // A change while consulting/incorporating cancels the pending decision, including local map edits.
  const territoryRevision = JSON.stringify(props.canonicalGeography ?? null);
  const [state, setState] = useState<ScinceHumanState>({ status: "IDLE", result: null, message: null });
  const [freshness, setFreshness] = useState<ScinceSnapshotFreshness | "CHECKING" | "UNAVAILABLE">("CHECKING");
  const [freshnessMessage, setFreshnessMessage] = useState<string | null>(null);
  useEffect(()=>{
    const publish=(area:unknown)=>window.dispatchEvent(new CustomEvent('ceipol:scince-area-preview', {detail:{projectId:props.projectId,source:props.canonicalGeography,area}}));
    publish(state.result?.compactSnapshot?.analysisArea ?? state.result?.multiunit?.scinceAnalysisArea ?? null);
    return ()=>{publish(null);};
  },[props.projectId,props.canonicalGeography,state.result]);
  const snapshot = props.analysis?.scinceCanonicalSnapshot;
  const hasLegacy = props.analysis?.scinceDemographics != null;
  const freshnessScope = useMemo(() => ({ projectId: props.projectId, territoryRevision, snapshot }),
    [props.projectId, territoryRevision, snapshot]);
  const [evaluatedScope, setEvaluatedScope] = useState<typeof freshnessScope | null>(null);
  const flow = useMemo(() => createScinceHumanContextFlow({
    context: () => ({ projectId: latest.current.projectId, readOnly: latest.current.isReadOnly,
      canQuery: latest.current.canAnalyze, analysis: latest.current.analysis, territoryRevision: JSON.stringify(latest.current.canonicalGeography ?? null) }),
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
  const incompatible = !readScinceCanonicalGeography(props.canonicalGeography);
  return <section className="flex flex-col space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50" aria-label="SCINCE canónico">
    <h3 className="font-bold text-cyan-300">Demografía territorial — INEGI (Paso 5)</h3>
    <p className="text-xs text-slate-300">La consulta caracteriza el entorno territorial mediante un radio institucional y conserva la geometría canónica del expediente. Revise el resultado antes de decidir su incorporación.</p>
    <ScinceFreshnessStatus freshness={visibleFreshness} />
    {evaluatedScope === freshnessScope && freshnessMessage && <p className="text-xs text-amber-300">{freshnessMessage}</p>}
    {hasLegacy && <p className="text-xs text-slate-400">Contexto SCINCE legacy conservado; no acredita un snapshot canónico vigente.</p>}
    {incompatible && <p className="text-xs text-amber-300">Se requiere geometría canónica válida para consultar SCINCE.</p>}
    <CEIPOLButton disabled={!props.projectId || !canAnalyze || busy || incompatible}
      loading={state.status === "CONSULTANDO"} onClick={() => void flow.consult()}>CONSULTAR SCINCE</CEIPOLButton>
    <p className="text-xs text-slate-400" role="status">{state.status === "IDLE" && !canAnalyze ? "CONSULTA NO AUTORIZADA" : state.status === "IDLE" && incompatible ? "GEOMETRÍA INVÁLIDA" : ({IDLE:"LISTO PARA CONSULTAR",CONSULTANDO:"CONSULTANDO",RESULTADO_DISPONIBLE:"RESULTADO DISPONIBLE — REQUIERE REVISIÓN PPC",INCORPORANDO:"INCORPORANDO",INCORPORADO:"INCORPORADO",ERROR:"ERROR",NO_DISPONIBLE:"NO DISPONIBLE POR FUENTE",GEOMETRIA_NO_COMPATIBLE:"GEOMETRÍA INVÁLIDA",ACCESO_DENEGADO:"ACCESO DENEGADO"})[state.status]}</p>
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
