'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CEIPOLButton } from '@/components/ui/CEIPOLButton';
import { dossierPhotoSource } from '../photo-evidence/dossierPhotoDisplay';
import type { GangMember } from '../pandillas.mapper';
import styles from './GangOrganizationPrintView.module.css';

export const GANG_ROLE_OPTIONS: NonNullable<GangMember['estatusPandilla']>[] = [
  'Líder', 'Segundo al mando', 'Sicario', 'Narcomenudista', 'Distribuidor', 'Halcón',
  'Chofer', 'Reclutador', 'Vigilante', 'Operador', 'Encargado de punto', 'Enlace',
  'Logística', 'Integrante', 'Colaborador externo', 'Exintegrante', 'No determinado', 'Otro',
];
export function getGangRoleVisualStyle(status?: string) {
  return status === 'Sicario' ? 'sicario' : status === 'Líder' ? 'leader'
    : status === 'Segundo al mando' ? 'deputy'
    : ['Narcomenudista', 'Distribuidor'].includes(status || '') ? 'purple'
    : ['Halcón', 'Vigilante'].includes(status || '') ? 'cyan'
    : ['Chofer', 'Logística', 'Enlace'].includes(status || '') ? 'slate' : 'neutral';
}
export type OrganizationMember = Readonly<Pick<GangMember, 'nombre' | 'alias' | 'edad' | 'rol' | 'estatusPandilla' | 'fotografiaUrl'> & { primaryUrl?: string }>;
export type GangOrganizationSnapshot = Readonly<{ gangName: string; generatedAt: string; members: readonly OrganizationMember[] }>;
export function createGangOrganizationSnapshot(gangName: string, members: readonly GangMember[], primaryUrls: readonly (string | undefined)[], generatedAt = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })): GangOrganizationSnapshot {
  return Object.freeze({ gangName, generatedAt, members: Object.freeze(members.map((m, i) => Object.freeze({
    nombre: m.nombre, alias: m.alias, edad: m.edad, rol: m.rol,
    estatusPandilla: m.estatusPandilla, fotografiaUrl: m.fotografiaUrl, primaryUrl: primaryUrls[i],
  }))) });
}
export function organizationPages(snapshot: GangOrganizationSnapshot) {
  const groups = [
    { label: 'Liderazgo', members: snapshot.members.filter(m => ['Líder', 'Segundo al mando'].includes(m.estatusPandilla || '')) },
    { label: 'Integrantes y funciones', members: snapshot.members.filter(m => !['Líder', 'Segundo al mando'].includes(m.estatusPandilla || '')) },
  ];
  const pages: { label: string; members: readonly OrganizationMember[] }[] = [];
  for (const group of groups) {
    // Long labels receive more space; never truncate documentary names or aliases.
    const size = group.members.some(m => `${m.nombre}${m.alias}${m.rol}${m.estatusPandilla || ''}`.length > 160) ? 1 : 4;
    for (let i = 0; i < group.members.length; i += size) pages.push({ label: group.label, members: group.members.slice(i, i + size) });
  }
  return pages.length ? pages : [{ label: 'Sin integrantes', members: [] }];
}
function OrganizationPhoto({ member }: { member: OrganizationMember }) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = dossierPhotoSource(member.primaryUrl, member.fotografiaUrl, failed);
  return src ? <img src={src} alt={`Fotografía de ${member.nombre}`} referrerPolicy="no-referrer"
    onError={() => setFailed(prior => [...prior, src])} /> : <span className={styles.placeholder}>Fotografía no disponible</span>;
}
export function GangOrganizationPages({ snapshot }: { snapshot: GangOrganizationSnapshot }) {
  const pages = organizationPages(snapshot);
  return <>{pages.map((page, pageIndex) => <section className={styles.page} key={pageIndex}>
    <header><strong>SECRETARÍA DE SEGURIDAD PÚBLICA DEL ESTADO — CEIPOL</strong>
      <div>Organigrama documental · {snapshot.members.length} integrantes · {snapshot.generatedAt}</div>
      <div>Página {pageIndex + 1} de {pages.length}</div></header>
    <h1 className={styles.root}>{snapshot.gangName}</h1>
    <h2>{page.label}</h2>
    <p className={styles.legend}>Conectores de pertenencia a la pandilla. No representan relaciones de mando. El color identifica únicamente la categoría registrada.</p>
    {!page.members.length && <p>Sin integrantes registrados.</p>}
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, page.members.length))}, minmax(0, 1fr))` }}>{page.members.map((m, index) => <article key={index}
      className={`${styles.card} ${styles[getGangRoleVisualStyle(m.estatusPandilla)]}`}>
      <div className={styles.photo}><OrganizationPhoto member={m} /></div>
      <strong>{m.nombre || 'Nombre no registrado'}</strong>
      {m.alias && <div>Alias: {m.alias}</div>}
      {m.edad !== undefined && m.edad !== '' && <div>Edad: {m.edad}</div>}
      <span className={styles.badge}>{m.estatusPandilla === 'Sicario' ? 'SICARIO' : m.estatusPandilla || m.rol || 'Función no registrada'}</span>
      {m.rol && m.rol !== m.estatusPandilla && <div>Rol registrado: {m.rol}</div>}
    </article>)}</div>
  </section>)}</>;
}
export async function waitForPrintableImages(root: HTMLElement) {
  await Promise.all(Array.from(root.querySelectorAll('img')).map(img => img.complete ? Promise.resolve() : new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); img.removeEventListener('load', done); img.removeEventListener('error', done); };
    const done = () => { cleanup(); resolve(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('PRINT_IMAGE_TIMEOUT')); }, 20000);
    img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true });
    if (img.complete) done();
  })));
}
export function printGangOrganization(body: HTMLElement, printer: Pick<Window, 'print' | 'addEventListener' | 'removeEventListener'>) {
  const cleanup = () => body.classList.remove(styles.printMode);
  printer.addEventListener('afterprint', cleanup);
  body.classList.add(styles.printMode);
  try {
    printer.print();
  } finally {
    cleanup();
    printer.removeEventListener('afterprint', cleanup);
  }
}

export function GangOrganizationPrintView({ snapshot, onClose }: { snapshot: GangOrganizationSnapshot; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const print = async () => {
    setBusy(true); setError('');
    try {
      if (document.fonts) await document.fonts.ready;
      // React may replace a failed PRIMARY with legacy; wait again after repaint.
      for (let i = 0; i < 3 && alive.current; i++) {
        if (root.current) await waitForPrintableImages(root.current);
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      }
      if (alive.current && root.current) printGangOrganization(document.body, window);
    } catch { if (alive.current) setError('No se pudo preparar la impresión. Intente nuevamente.'); }
    finally { if (alive.current) setBusy(false); }
  };
  return createPortal(<div data-gang-print-root className={styles.overlay} role="dialog" aria-modal="true" aria-label="Organigrama de la pandilla">
    <style>{'@media print { @page { size: letter landscape; margin: .35in; } }'}</style>
    <div className={styles.toolbar}><CEIPOLButton loading={busy} onClick={() => void print()}>IMPRIMIR / GUARDAR COMO PDF</CEIPOLButton>
      <CEIPOLButton variant="secondary" onClick={onClose}>CERRAR</CEIPOLButton>{error && <p role="alert">{error}</p>}</div>
    <div ref={root}><GangOrganizationPages snapshot={snapshot} /></div>
  </div>, document.body);
}
