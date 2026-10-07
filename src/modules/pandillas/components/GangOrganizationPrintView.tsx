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
    : status === 'Narcomenudista' ? 'amber' : status === 'Distribuidor' ? 'purple'
    : ['Halcón', 'Vigilante'].includes(status || '') ? 'cyan'
    : ['Chofer', 'Logística', 'Enlace'].includes(status || '') ? 'slate'
    : status === 'No determinado' ? 'muted' : 'neutral';
}
export type OrganizationMember = Readonly<Pick<GangMember, 'nombre' | 'alias' | 'edad' | 'rol' | 'estatusPandilla' | 'fotografiaUrl'> & { primaryUrl?: string }>;
export type GangOrganizationSnapshot = Readonly<{ gangName: string; generatedAt: string; members: readonly OrganizationMember[] }>;
export function createGangOrganizationSnapshot(gangName: string, members: readonly GangMember[], primaryUrls: readonly (string | undefined)[], generatedAt = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })): GangOrganizationSnapshot {
  return Object.freeze({ gangName, generatedAt, members: Object.freeze(members.map((m, i) => Object.freeze({
    nombre: m.nombre, alias: m.alias, edad: m.edad, rol: m.rol,
    estatusPandilla: m.estatusPandilla, fotografiaUrl: m.fotografiaUrl, primaryUrl: primaryUrls[i],
  }))) });
}
// CSS pixels at 96 dpi. Letter landscape, minus the browser's 6 mm margins.
export const ORGANIZATION_LAYOUT_POLICY = Object.freeze({
  width: (279.4 - 12) * 96 / 25.4, height: (215.9 - 12) * 96 / 25.4,
  padding: 12, header: 112, footer: 34, gap: 12,
  minimumCardWidth: 220, minimumPhotoHeight: 72, fontSize: 11, lineHeight: 14,
  grids: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3]] as const,
});
export type OrganizationLayout = { columns: number; rows: number; capacity: number; cardWidth: number; cardHeight: number; photoHeight: number };
function requiredCardHeight(member: OrganizationMember, width: number, photoHeight: number) {
  // Conservative wrapping budget, including explicit newlines and long unbroken words.
  const lines = (value: string) => value.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length * 8 / (width - 32))), 0);
  const main = member.estatusPandilla || member.rol || 'Función no registrada';
  const extra = !!member.rol && member.rol !== member.estatusPandilla;
  return photoHeight + 16 + 18 + (extra ? 16 : 8) + 14 * (
    lines(member.nombre || 'Nombre no registrado') + (member.alias ? lines(`Alias: ${member.alias}`) : 0)
    + lines(main) + (extra ? lines(`Rol: ${member.rol}`) : 0)
    + (member.edad !== undefined && member.edad !== '' ? 1 : 0));
}
export function getOrganizationLayout(members: readonly OrganizationMember[]): OrganizationLayout {
  const p = ORGANIZATION_LAYOUT_POLICY;
  const desired = p.grids.findIndex(([columns, rows]) => columns * rows >= Math.max(1, members.length));
  const candidates = p.grids.slice(0, desired < 0 ? p.grids.length : desired + 1).reverse();
  for (const [columns, rows] of candidates) {
    const cardWidth = (p.width - p.padding * 2 - p.gap * (columns - 1)) / columns;
    const cardHeight = (p.height - p.padding * 2 - p.header - p.footer - p.gap * (rows + 1)) / rows;
    const photoHeight = rows === 1 ? 144 : rows === 2 ? 104 : p.minimumPhotoHeight;
    if (cardWidth >= p.minimumCardWidth && members.slice(0, columns * rows).every(m => requiredCardHeight(m, cardWidth, photoHeight) <= cardHeight)) {
      return { columns, rows, capacity: columns * rows, cardWidth, cardHeight, photoHeight };
    }
  }
  // Never truncate an exceptionally large documentary field. Print preparation checks actual overflow.
  return { columns: 1, rows: 1, capacity: 1, cardWidth: p.width - 24, cardHeight: p.height - 210, photoHeight: 144 };
}
export function organizationPages(snapshot: GangOrganizationSnapshot) {
  const pages: { members: readonly OrganizationMember[]; layout: OrganizationLayout; start: number }[] = [];
  for (let i = 0; i < snapshot.members.length;) {
    const layout = getOrganizationLayout(snapshot.members.slice(i));
    const members = snapshot.members.slice(i, i + layout.capacity);
    pages.push({ members, layout, start: i + 1 });
    i += members.length;
  }
  return pages.length ? pages : [{ members: [], layout: getOrganizationLayout([]), start: 0 }];
}
export function getOrganizationPreviewScale(width: number, height: number, zoom = 1) {
  const p = ORGANIZATION_LAYOUT_POLICY;
  return Math.max(0.01, Math.min(Math.max(1, width - 32) / p.width, Math.max(1, height - 32) / p.height)) * zoom;
}
export function organizationPageIndex(current: number, delta: number, count: number) {
  return Math.max(0, Math.min(Math.max(0, count - 1), current + delta));
}
function OrganizationPhoto({ member }: { member: OrganizationMember }) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = dossierPhotoSource(member.primaryUrl, member.fotografiaUrl, failed);
  return src ? <img src={src} alt={`Fotografía de ${member.nombre}`} referrerPolicy="no-referrer"
    onError={() => setFailed(prior => [...prior, src])} /> : <span className={styles.placeholder}>Fotografía no disponible</span>;
}
export function GangOrganizationPages({ snapshot, activePage = 0 }: { snapshot: GangOrganizationSnapshot; activePage?: number }) {
  const pages = organizationPages(snapshot);
  return <>{pages.map((page, pageIndex) => <section className={styles.page} data-active={pageIndex === activePage} key={pageIndex}
    style={{ '--page-width': `${ORGANIZATION_LAYOUT_POLICY.width}px`, '--page-height': `${ORGANIZATION_LAYOUT_POLICY.height}px`, '--photo-height': `${page.layout.photoHeight}px` } as React.CSSProperties}>
    <header className={styles.header}><strong>SECRETARÍA DE SEGURIDAD PÚBLICA DEL ESTADO<br />CEIPOL</strong>
      <strong>ORGANIGRAMA DOCUMENTAL DE PANDILLA</strong></header>
    <h1 className={styles.root}>{snapshot.gangName}</h1>
    <div className={styles.metadata}><span>Total: {snapshot.members.length} integrantes</span><span>{snapshot.generatedAt}</span>
      <span>Página {pageIndex + 1} de {pages.length}</span>
      {page.members.length > 0 && <span>Integrantes {page.start}–{page.start + page.members.length - 1}{pageIndex > 0 ? ' · Continuación' : ''}</span>}</div>
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${page.layout.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${page.layout.rows}, minmax(0, 1fr))` }}>
      {!page.members.length && <p>Sin integrantes registrados.</p>}{page.members.map((m, index) => <article key={page.start + index}
      className={`${styles.card} ${styles[getGangRoleVisualStyle(m.estatusPandilla || m.rol)]}`}>
      <div className={styles.photo}><OrganizationPhoto member={m} /></div>
      {m.alias && <div className={styles.alias}>Alias: {m.alias}</div>}
      <strong className={styles.memberName}>{m.nombre || 'Nombre no registrado'}</strong>
      {m.edad !== undefined && m.edad !== '' && <div>Edad: {m.edad}</div>}
      <span className={styles.badge}>{(m.estatusPandilla || m.rol) === 'Sicario' ? 'SICARIO' : m.estatusPandilla || m.rol || 'Función no registrada'}</span>
      {m.rol && m.rol !== m.estatusPandilla && <span className={styles.badge}>Rol: {m.rol}</span>}
    </article>)}</div>
    <p className={styles.legend}>Los conectores representan pertenencia documental a la pandilla. No implican relaciones de mando salvo registro expreso.</p>
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
  const viewport = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1000, height: 700 });
  const [activePage, setActivePage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const pages = organizationPages(snapshot);
  const scale = getOrganizationPreviewScale(viewportSize.width, viewportSize.height, zoom);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const resize = () => setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setActivePage(0); setZoom(1); }, [snapshot]);
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
      if (alive.current && root.current) {
        // Physical print dimensions never depend on preview zoom. Refuse clipping of exceptional text.
        const overflowing = Array.from(root.current.querySelectorAll<HTMLElement>('article')).some(card => card.scrollHeight > card.clientHeight + 1);
        if (overflowing) throw new Error('PRINT_TEXT_OVERFLOW');
        printGangOrganization(document.body, window);
      }
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error && failure.message === 'PRINT_TEXT_OVERFLOW'
        ? 'Un campo documental excede el área legible de carta horizontal. No se imprimió para evitar recortarlo.'
        : 'No se pudo preparar la impresión. Intente nuevamente.');
    }
    finally { if (alive.current) setBusy(false); }
  };
  return createPortal(<div data-gang-print-root className={styles.overlay} role="dialog" aria-modal="true" aria-label="Organigrama de la pandilla">
    <style>{'@media print { @page { size: letter landscape; margin: 6mm; } }'}</style>
    <div className={styles.modal}>
      <div className={styles.toolbar}><strong>ORGANIGRAMA — {snapshot.gangName}</strong>
        <CEIPOLButton loading={busy} onClick={() => void print()}>IMPRIMIR / GUARDAR PDF</CEIPOLButton>
        <CEIPOLButton variant="secondary" onClick={() => setZoom(1)}>AJUSTAR</CEIPOLButton>
        <CEIPOLButton variant="secondary" aria-label="Reducir zoom" onClick={() => setZoom(value => Math.max(.5, value - .1))}>−</CEIPOLButton>
        <CEIPOLButton variant="secondary" aria-label="Aumentar zoom" onClick={() => setZoom(value => Math.min(2, value + .1))}>+</CEIPOLButton>
        <span>{Math.round(scale * 100)}%</span><CEIPOLButton variant="secondary" onClick={onClose}>CERRAR</CEIPOLButton>
      </div>
      <div className={styles.navigation}>
        <CEIPOLButton variant="secondary" disabled={activePage === 0} onClick={() => setActivePage(value => organizationPageIndex(value, -1, pages.length))}>← Página anterior</CEIPOLButton>
        <span>Página {activePage + 1} de {pages.length}</span>
        <CEIPOLButton variant="secondary" disabled={activePage === pages.length - 1} onClick={() => setActivePage(value => organizationPageIndex(value, 1, pages.length))}>Página siguiente →</CEIPOLButton>
      </div>
      <div className={styles.viewport} ref={viewport}><div className={styles.stage} style={{ width: ORGANIZATION_LAYOUT_POLICY.width * scale, height: ORGANIZATION_LAYOUT_POLICY.height * scale }}>
        <div className={styles.document} ref={root} style={{ transform: `scale(${scale})` }}><GangOrganizationPages snapshot={snapshot} activePage={activePage} /></div>
      </div></div>
      <div className={styles.notice}>{error && <p role="alert">{error}</p>}Chrome → Más ajustes → desactivar Encabezados y pies de página.</div>
    </div>
  </div>, document.body);
}
