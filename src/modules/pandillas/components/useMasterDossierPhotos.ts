'use client';
import { useEffect, useState } from 'react';
import { readInstitutionalMasterGangPhotos } from '@/lib/institutionalPandillasReadActions';
import { legacyMemberFingerprint } from '../photo-evidence/identity';
import { bindDossierPhotos, type DossierPhotos } from '../photo-evidence/dossierPhotoDisplay';
import type { GangMember } from '../pandillas.mapper';
/** Only gang identity enters this adapter. Legacy custody is resolved on the server. */
export async function loadMasterDossierPhotos(gangId: string, members: GangMember[]): Promise<DossierPhotos[]> {
  const data = await readInstitutionalMasterGangPhotos(gangId);
  if (!data || data.gangId !== gangId) throw new Error('PRIMARY_UNAVAILABLE');
  const fingerprints = await Promise.all(members.map(legacyMemberFingerprint));
  return bindDossierPhotos(data.projectId, gangId, fingerprints, data);
}
export function useMasterDossierPhotos(gangId: string, members: GangMember[], enabled: boolean, username: string) {
  const [state, setState] = useState<{ gangId: string; members: GangMember[]; username: string; photos: DossierPhotos[] } | null>(null);
  useEffect(() => {
    if (!enabled || !gangId || gangId.startsWith('static-gang-')) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const resolve = async () => {
      let photos: DossierPhotos[] = [];
      try { photos = await loadMasterDossierPhotos(gangId, members); }
      catch { /* No authorization fallback; retain the existing avatar/legacy display policy. */ }
      if (!cancelled) {
        setState({ gangId, members, username, photos });
        timer = setTimeout(resolve, 90000);
      }
    };
    void resolve();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [gangId, members, enabled, username]);
  return enabled && state?.gangId === gangId && state.members === members && state.username === username ? state.photos : [];
}
