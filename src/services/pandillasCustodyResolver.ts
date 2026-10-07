import 'server-only';
import { readInstitutionalCollection } from '@/lib/institutionalCollectionActions';
import type { GangEntity } from '@/modules/pandillas/pandillas.mapper';
import { resolveLegacyPandillasCustody, resolvePandillasMasterVersion } from '@/modules/pandillas/pandillasMasterContracts';

/** Only the current institutional reader may select custody; no caller-provided project fallback.
 * A missing/inaccessible gang stays unavailable under existing project grants/lifecycle policy. */
export async function resolvePandillasCustodyScope(masterGangId: string) {
  const gangs = await readInstitutionalCollection('pandillas') as GangEntity[];
  const matches = gangs.filter(gang => gang.id === masterGangId);
  if (matches.length > 1) throw new Error('PANDILLAS_MASTER_AMBIGUOUS');
  if (!matches.length) return null;
  const gang = matches[0];
  return Object.freeze({ ...resolveLegacyPandillasCustody(gang),
    masterVersion: resolvePandillasMasterVersion(gang), source: 'pandillas.projectId' as const });
}
