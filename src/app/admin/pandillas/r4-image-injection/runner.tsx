'use client';
import { useRef, useState } from 'react';
import { prepareR4RunnerFiles, R4_RUNNER_CONFIRMATION, R4_RUNNER_PROJECT, type R4RunnerPair } from '@/utils/pandillasR4RunnerFiles';

const endpoint = '/api/pandillas/r4/image-injection';
const directory = { webkitdirectory: '', directory: '' };
export default function R4ImageInjectionRunner() {
  const [payload, setPayload] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);
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
      const prepared = await prepareR4RunnerFiles(payload, files, async file => {
        const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
      });
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
    <label className="block">Añadir carpeta de originales o derivados <input type="file" {...directory} multiple disabled={busy} onChange={event => {
      invalidate(); setFiles(prior => [...prior, ...Array.from(event.target.files || [])]); event.target.value = '';
    }} /></label>
    <label className="block">Añadir archivos individuales <input type="file" multiple accept="image/jpeg,image/png" disabled={busy} onChange={event => {
      invalidate(); setFiles(prior => [...prior, ...Array.from(event.target.files || [])]); event.target.value = '';
    }} /></label>
    <p>Archivos seleccionados: {files.length}. Se necesitan 79 pares original/derived (158 archivos).</p>
    <button disabled={busy} onClick={() => { invalidate(); setFiles([]); }}>Limpiar archivos</button>
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
