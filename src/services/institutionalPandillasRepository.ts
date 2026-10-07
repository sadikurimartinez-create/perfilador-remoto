import 'server-only';
import { readInstitutionalCollection } from '@/lib/institutionalCollectionActions';
import type { GangEntity } from '@/modules/pandillas/pandillas.mapper';
import { resolveLegacyPandillasCustody, resolvePandillasMasterVersion } from '@/modules/pandillas/pandillasMasterContracts';
import type { PandillasMasterGang } from '@/modules/pandillas/pandillasMasterContracts';

/** Structural compatibility only: existing session/project grants remain authoritative.
 * No cache, new persistence, autonomous writes, or R4 relocation. */
export class InstitutionalPandillasRepository {
  async listMasterGangs(): Promise<PandillasMasterGang[]> {
    const gangs = await readInstitutionalCollection('pandillas') as GangEntity[];
    return gangs.map(gang => {
      const custody = resolveLegacyPandillasCustody(gang);
      const { projectId: legacyCustody, id, ...data } = gang;
      return { ...data, id: custody.masterGangId,
        scope: Object.freeze({ kind: 'MASTER' as const, gangId: custody.masterGangId,
          version: resolvePandillasMasterVersion(gang) }), custody };
    });
  }
  async getMasterGang(gangId: string): Promise<PandillasMasterGang | null> {
    const matches = (await this.listMasterGangs()).filter(gang => gang.id === gangId);
    if (matches.length > 1) throw new Error('PANDILLAS_MASTER_AMBIGUOUS');
    return matches[0] ?? null;
  }
  async resolveCustodyScope(gangId: string) {
    return (await this.getMasterGang(gangId))?.custody ?? null;
  }
  async getMasterVersion(gangId: string) {
    return (await this.getMasterGang(gangId))?.scope.version ?? null;
  }
  /** Legacy literal selector, not an identity ID. Ambiguous names never resolve implicitly. */
  async getMasterMember(gangId: string, selector: { legacyMemberName: string }) {
    const gang = await this.getMasterGang(gangId);
    if (!gang) return null;
    const matches = gang.integrantes.filter(member => member.nombre === selector.legacyMemberName);
    if (matches.length > 1) throw new Error('PANDILLAS_MEMBER_RECONCILIATION_REQUIRED');
    return matches[0] ?? null;
  }
}
