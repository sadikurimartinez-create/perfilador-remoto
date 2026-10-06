'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { captureR4FileSelection, inspectR4Folder, precheckR4Folder, prepareR4RunnerFiles, R4_RUNNER_CONFIRMATION, R4_RUNNER_PROJECT, type R4RunnerPair, type R4FolderKind } from '@/utils/pandillasR4RunnerFiles';

const endpoint = '/api/pandillas/r4/image-injection';
const directory = { webkitdirectory: '', directory: '' };
const sha256 = async (file: File) => {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
};
export default function R4ImageInjectionRunner() {
  const [payload, setPayload] = useState<any>(null);
  const [originalFiles, setOriginalFiles] = useState<File[]>([]);
  const [derivedFiles, setDerivedFiles] = useState<File[]>([]);
  const [manualFiles, setManualFiles] = useState<File[]>([]);
  const files = useMemo(() => [...originalFiles, ...derivedFiles, ...manualFiles], [originalFiles, derivedFiles, manualFiles]);
  const inspect = (selected: File[], kind: R4FolderKind) => {
    if (!payload) return { coverage: null, error: '' };
    try { return { coverage: inspectR4Folder(payload, selected, kind), error: '' }; }
    catch (error) { return { coverage: null, error: error instanceof Error ? error.message : 'Payload inválido.' }; }
  };
  const originalInspection = useMemo(() => inspect(originalFiles, 'original'), [payload, originalFiles]);
  const derivedInspection = useMemo(() => inspect(derivedFiles, 'derived'), [payload, derivedFiles]);
  const [folderHashes, setFolderHashes] = useState<Record<R4FolderKind, string>>({ original: '', derived: '' });
  useEffect(() => {
    let cancelled = false;
    setFolderHashes({ original: '', derived: '' });
    const check = async (kind: R4FolderKind, selected: File[], inspection: typeof originalInspection) => {
      if (!payload || !selected.length || !inspection.coverage) return;
      if (!inspection.coverage.valid) {
        if (!cancelled) setFolderHashes(prior => ({ ...prior, [kind]: inspection.coverage!.missing ? 'FAIL: faltan archivos requeridos' : 'FAIL: nombres ambiguos' }));
        return;
      }
      if (!cancelled) setFolderHashes(prior => ({ ...prior, [kind]: 'Verificando SHA-256…' }));
      try {
        const checked = await precheckR4Folder(payload, selected, kind, sha256);
        if (!cancelled) setFolderHashes(prior => ({ ...prior, [kind]: `${checked.hashMatch}/79` }));
      } catch (error) {
        if (!cancelled) setFolderHashes(prior => ({ ...prior, [kind]: `FAIL: ${error instanceof Error ? error.message : 'Hash inválido.'}` }));
      }
    };
    void Promise.all([check('original', originalFiles, originalInspection), check('derived', derivedFiles, derivedInspection)]);
    return () => { cancelled = true; };
  }, [payload, originalFiles, derivedFiles, originalInspection, derivedInspection]);
  const [pairs, setPairs] = useState<R4RunnerPair[]>([]);
  const [confirmation, setConfirmation] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [message, setMessage] = useState('Seleccione el payload y las carpetas certificadas.');
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<any>(null);
  const inFlight = useRef(false);
  const invalidate = () => { setPairs([]); setConfirmation(''); setArmed(false); setStatuses([]); setResult(null); };
  const request = async (body: FormData | string) => {
    const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: typeof body === 'string' ? { 'Content-Type': 'application/json' } : undefined, body });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Verificación institucional fallida.');
    return data;
  };
  const form = (pair: R4RunnerPair, mode: 'READINESS' | 'LIVE', receipt?: string) => {
    const data = new FormData();
    data.append('metadata', JSON.stringify({ mode, projectId: R4_RUNNER_PROJECT, batchLabel: 'R4_PRIMARY_IMAGE_INJECTION_V1',
      items: [pair.item], ...(receipt ? { previousReceipt: receipt } : {}) }));
    data.append('original', pair.original, pair.item.originalFileName);
    data.append('derived', pair.derived, pair.item.derivedFileName);
    return data;
  };
  const precheck = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); invalidate();
    try {
      const prepared = await prepareR4RunnerFiles(payload, files, sha256);
      // Complete server-side readiness for ALL 79 before allowing confirmation.
      const receipts: string[] = [];
      for (let i = 0; i < prepared.length; i++) {
        setMessage(`Verificación sin escritura ${i + 1}/79`);
        const ready = await request(form(prepared[i], 'READINESS'));
        if (!ready.itemReadinessForLive || !ready.readinessReceipt) throw new Error('READINESS incompleto.');
        receipts.push(ready.readinessReceipt);
      }
      const batch = await request(JSON.stringify({ mode: 'READINESS', projectId: R4_RUNNER_PROJECT,
        batchLabel: 'R4_PRIMARY_IMAGE_INJECTION_V1', receipts }));
      if (!batch.readinessForLive) throw new Error('READINESS del lote incompleto.');
      setPairs(prepared); setStatuses(prepared.map(() => 'READY'));
      setMessage('TARGET=79 · FILES_READY=79/79 · MISSING=0 · HASH_PRECHECK=79/79');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Verificación fallida.'); }
    finally { setBusy(false); inFlight.current = false; }
  };
  const execute = async () => {
    if (inFlight.current || pairs.length !== 79 || !armed || confirmation !== R4_RUNNER_CONFIRMATION) return;
    inFlight.current = true; setBusy(true); setArmed(false); setConfirmation('');
    let index = 0;
    const status = (value: string) => setStatuses(prior => prior.map((entry, i) => i === index ? value : entry));
    try {
      for (; index < pairs.length; index++) {
        setMessage(`${index + 1}/79`); status('READY');
        // Previous writes change the fingerprint: obtain a fresh receipt for each member.
        const ready = await request(form(pairs[index], 'READINESS'));
        if (!ready.itemReadinessForLive || !ready.readinessReceipt) throw new Error('READINESS vigente requerido.');
        status('UPLOADING');
        const live = await request(form(pairs[index], 'LIVE', ready.readinessReceipt));
        if (!live.primaryResolverPass || !live.storageOriginalVerified || !live.storageDerivedVerified || live.status !== 'DONE') throw new Error('Readback incompleto.');
        // Stages are shown only after the server confirms their completion.
        status(live.completedStages.join(' → '));
      }
      const final = await request(JSON.stringify({ mode: 'VERIFY', projectId: R4_RUNNER_PROJECT }));
      setResult(final); setMessage('79/79 verificadas institucionalmente.');
    } catch (error) { if (index < 79) status('FAILED'); setMessage(`Lote detenido ${Math.min(index + 1, 79)}/79: ${error instanceof Error ? error.message : 'Error'}. Puede reanudar con una nueva confirmación.`); }
    finally { setBusy(false); inFlight.current = false; }
  };
  return <main className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-4">
    <h1 className="text-xl font-bold">Inyección fotográfica R4 · 79 primarias certificadas</h1>
    <p>Proyecto: {R4_RUNNER_PROJECT}</p>
    <label className="block">Payload certificado JSON <input type="file" accept=".json" disabled={busy} onChange={async event => {
      invalidate(); setPayload(null); const file = event.target.files?.[0];
      if (file) try { if (file.size > 128 * 1024) throw new Error('Payload demasiado grande.'); setPayload(JSON.parse(await file.text())); }
      catch { setMessage('JSON inválido.'); }
    }} /></label>
    <label className="block">Carpeta originals <input type="file" {...directory} multiple disabled={busy} onChange={event => {
      const selected = captureR4FileSelection(event.currentTarget);
      if (!selected.length) { setMessage('No se recibieron archivos de la carpeta originals.'); return; }
      invalidate(); setOriginalFiles(selected); setMessage(`CARPETA ORIGINAL DETECTADA · ARCHIVOS EN CARPETA=${selected.length}`);
    }} /></label>
    <label className="block">Carpeta derived <input type="file" {...directory} multiple disabled={busy} onChange={event => {
      const selected = captureR4FileSelection(event.currentTarget);
      if (!selected.length) { setMessage('No se recibieron archivos de la carpeta derived.'); return; }
      invalidate(); setDerivedFiles(selected); setMessage(`CARPETA DERIVED DETECTADA · ARCHIVOS EN CARPETA=${selected.length}`);
    }} /></label>
    {(['original', 'derived'] as const).map(kind => {
      const selected = kind === 'original' ? originalFiles : derivedFiles;
      const inspection = kind === 'original' ? originalInspection : derivedInspection;
      if (!selected.length) return null;
      return <section key={kind} className="border p-3" aria-live="polite">
        <p>CARPETA {kind.toUpperCase()} DETECTADA</p>
        <p>ARCHIVOS EN CARPETA={selected.length} · REQUERIDOS=79</p>
        {inspection.coverage ? <>
          <p>COINCIDENTES={inspection.coverage.matched} · FALTANTES={inspection.coverage.missing} · EXTRAS IGNORADOS={inspection.coverage.extraIgnored}</p>
          {inspection.coverage.missing > 0 && <p role="alert">Faltan: {inspection.coverage.missingNames.join(', ')}</p>}
          {inspection.coverage.duplicateNames.length > 0 && <p role="alert">Nombres ambiguos: {inspection.coverage.duplicateNames.join(', ')}</p>}
        </> : <p>{inspection.error || 'Cargue el payload certificado para identificar los 79 requeridos.'}</p>}
        <p>{kind.toUpperCase()}_HASH_PRECHECK={folderHashes[kind] || 'Pendiente'}</p>
      </section>;
    })}
    <label className="block">Añadir archivos individuales <input type="file" multiple accept="image/jpeg,image/png" disabled={busy} onChange={event => {
      const selected = captureR4FileSelection(event.currentTarget);
      invalidate(); setManualFiles(prior => [...prior, ...selected]);
    }} /></label>
    <p>Archivos seleccionados: {files.length}. Se necesitan 79 pares original/derived (158 archivos).</p>
    <button disabled={busy} onClick={() => { invalidate(); setOriginalFiles([]); setDerivedFiles([]); setManualFiles([]); }}>Limpiar archivos</button>
    <button className="block border p-2 disabled:opacity-50" disabled={busy || !payload || !files.length} onClick={precheck}>VERIFICAR ARCHIVOS Y READINESS SIN ESCRIBIR</button>
    <p role="status">{message}</p>
    <button className="border p-2 disabled:opacity-50" disabled={busy || pairs.length !== 79} onClick={() => setArmed(true)}>EJECUTAR INYECCIÓN R4 — 79 FOTOGRAFÍAS</button>
    {armed && <section className="border border-amber-500 p-4 space-y-3" role="dialog" aria-label="Confirmar inyección R4">
      <p>Escriba exactamente: {R4_RUNNER_CONFIRMATION}</p>
      <input className="w-full text-black p-2" value={confirmation} onChange={event => setConfirmation(event.target.value)} aria-label="Confirmación exacta" />
      <button disabled={busy || confirmation !== R4_RUNNER_CONFIRMATION} onClick={execute}>CONFIRMAR Y EJECUTAR</button>
      <button onClick={() => { setArmed(false); setConfirmation(''); }}>Cancelar</button>
    </section>}
    <ol>{pairs.map((pair, i) => <li key={`${pair.item.gangName}/${pair.item.memberName}`}>
      {i + 1}/79 · {pair.item.gangName} · {pair.item.memberName} · {statuses[i]}
    </li>)}</ol>
    {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
  </main>;
}
