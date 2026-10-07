'use client';
import { useEffect, useState } from 'react';
import { legacyMemberFingerprint } from '../photo-evidence/identity';
import { bindDossierPhotos, dossierPhotoSource, type DossierPhotos } from '../photo-evidence/dossierPhotoDisplay';
import type { GangMember } from '../pandillas.mapper';

export function useDossierPhotos(projectId: string | undefined, gangId: string, members: GangMember[], enabled: boolean, username: string) {
  const [state, setState] = useState<{ projectId: string; gangId: string; members: GangMember[]; username: string; photos: DossierPhotos[] } | null>(null);
  useEffect(() => {
    if (!enabled || !projectId || !gangId || gangId.startsWith('static-gang-')) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const resolve = async () => {
      let photos: DossierPhotos[] = [];
      try {
        const timeout = setTimeout(() => controller.abort(), 20000);
        let response: Response;
        try {
          response = await fetch(`/api/pandillas/primary-photos?${new URLSearchParams({ projectId, gangId })}`,
            { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        } finally { clearTimeout(timeout); }
        if (!response.ok) throw new Error('PRIMARY_UNAVAILABLE');
        const data = await response.json();
        const fingerprints = await Promise.all(members.map(member => legacyMemberFingerprint(member)));
        photos = bindDossierPhotos(projectId, gangId, fingerprints, data);
      } catch { /* Stable avatar/legacy fallback; no document data is patched. */ }
      if (!cancelled) {
        setState({ projectId, gangId, members, username, photos });
        // Signed capabilities expire after two minutes. Refresh one batch while the tab is active.
        if (!controller.signal.aborted) timer = setTimeout(resolve, 90000);
      }
    };
    void resolve();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [projectId, gangId, members, enabled, username]);
  // Hide old responses immediately on scope/member/session change, before effect cleanup runs.
  return enabled && state && state.projectId === projectId && state.gangId === gangId && state.members === members && state.username === username ? state.photos : [];
}

export function DossierPrimaryPhoto({ primaryUrl, legacyUrl, sex, alt }: { primaryUrl?: string; legacyUrl?: string; sex?: string; alt: string }) {
  const key = JSON.stringify([primaryUrl, legacyUrl]);
  const [failure, setFailure] = useState<{ key: string; urls: string[] }>({ key: '', urls: [] });
  const src = dossierPhotoSource(primaryUrl, legacyUrl, failure.key === key ? failure.urls : []);
  return src ? <img src={src} className="w-full h-full object-cover" alt={alt} referrerPolicy="no-referrer"
    onError={() => setFailure(prior => ({ key, urls: [...(prior.key === key ? prior.urls : []), src] }))} />
    : <span className="text-2xl">{sex === 'Femenino' ? '👩' : '👨'}</span>;
}

export function useDossierPrimaryPhotoUrls(...args: Parameters<typeof useDossierPhotos>) {
  return useDossierPhotos(...args).map(photos => photos.primary?.derivedUrl);
}
