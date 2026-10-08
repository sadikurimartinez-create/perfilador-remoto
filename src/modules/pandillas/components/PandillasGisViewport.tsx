"use client";

import React, { useEffect, useRef, useState } from 'react';

/** Presentation only: children remain mounted when the viewport changes. */
export function PandillasGisViewport({ map, children }: {
  map: google.maps.Map | null;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setExpanded(false); toggle.current?.focus(); }
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', escape);
    };
  }, [expanded]);

  useEffect(() => {
    if (!map || !viewport.current) return;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        google.maps.event.trigger(map, 'resize');
        if (center) map.setCenter(center);
        if (zoom !== undefined) map.setZoom(zoom);
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(viewport.current);
    resize();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [map]);

  return <section aria-label="Mapa táctico GEOINT" className={expanded
    ? 'fixed inset-2 sm:inset-4 z-[1000] flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-700 bg-slate-950 p-2 sm:p-3 shadow-2xl'
    : 'w-full min-w-0 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-2 sm:p-3 shadow-xl'}>
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
      <div><h3 className="text-sm font-bold text-slate-100">🗺️ Mapa Táctico GEOINT de Pandillas</h3>
        <p className="text-xs text-slate-400">Visualización de capas espaciales activas en tiempo real.</p></div>
      <button ref={toggle} type="button" aria-expanded={expanded} aria-controls="gis-tactical-viewport"
        onClick={() => setExpanded(value => !value)}
        className="rounded-lg border border-sky-700 bg-sky-950 px-3 py-2 text-xs font-bold text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
        {expanded ? 'RESTAURAR VISTA' : 'AMPLIAR MAPA'}
      </button>
    </header>
    <div id="gis-tactical-viewport" ref={viewport} className={expanded ? 'relative min-h-0 w-full flex-1' : 'relative h-[70vh] min-h-[320px] w-full'}>
      {children}
    </div>
  </section>;
}
