'use client';
import React, { useState } from 'react';
import { dossierWordErrorMessage, type MemberDossierView } from '../memberDossierView';

export function MemberDossierPanel({ formOpen, onRegister, view, onWord, onClear, children }: {
  formOpen: boolean; onRegister: () => void; view: MemberDossierView | null;
  onWord: () => Promise<void>; onClear: () => void; children: React.ReactNode;
}) {
  return formOpen ? <>{children}</> : <>
    <button onClick={onRegister} className="px-4 py-2 rounded-lg border border-sky-700 text-sky-300 text-xs font-bold">+ REGISTRAR NUEVO INTEGRANTE</button>
    <MemberDossierConsultation view={view} onWord={onWord} onClear={onClear} />
  </>;
}

export function MemberDossierConsultation({ view, onWord, onClear }: { view: MemberDossierView | null; onWord: () => Promise<void>; onClear: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!view) return <p className="py-12 text-center text-slate-400">Seleccione un integrante para consultar su ficha.</p>;
  return <article aria-label="Ficha de consulta del integrante" className="space-y-5">
    <header><p className="text-xs text-sky-400 uppercase">Previsualización de ficha</p><h3 className="font-bold text-xl text-slate-100">{view.name}</h3><p className="text-slate-400">{view.gangName}</p></header>
    {view.photos.slice(0, 1).map(photo => <figure key={photo.url}><figcaption className="text-xs uppercase text-slate-400 mb-2">{photo.label}</figcaption><img src={photo.url} alt={`${photo.label}: ${view.name}`} referrerPolicy="no-referrer" className="max-h-64 max-w-full object-contain rounded-lg" /></figure>)}
    {view.sections.map(section => <section key={section.title}><h4 className="font-bold text-sky-300 border-b border-slate-800 pb-2 mb-2">{section.title}</h4><dl className="space-y-2">{section.fields.map(field => <div key={field.label} className="grid grid-cols-1 sm:grid-cols-3 gap-1"><dt className="text-xs text-slate-400">{field.label}</dt><dd className="sm:col-span-2 text-sm text-slate-200 whitespace-pre-wrap break-words">{field.value}</dd></div>)}</dl></section>)}
    {view.photos.length > 1 && <section><h4 className="font-bold text-sky-300 mb-2">Otras fotografías asociadas</h4><div className="grid grid-cols-2 gap-3">{view.photos.slice(1).map(photo => <figure key={photo.url}><img src={photo.url} alt={`Fotografía asociada: ${view.name}`} referrerPolicy="no-referrer" className="max-h-48 max-w-full object-contain" /></figure>)}</div></section>}
    <div className="flex gap-3"><button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onWord(); } catch (error) { setError(dossierWordErrorMessage(error)); } finally { setBusy(false); } }} className="bg-sky-500 rounded-lg px-4 py-2 text-slate-950 font-bold disabled:opacity-50">{busy ? 'GENERANDO WORD…' : 'GENERAR WORD'}</button><button onClick={onClear} className="text-slate-400 text-xs">LIMPIAR SELECCIÓN</button></div>
    {error && <p role="alert" className="text-amber-300 text-sm">{error}</p>}
  </article>;
}
