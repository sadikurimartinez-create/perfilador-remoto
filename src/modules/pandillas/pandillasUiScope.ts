import type { GangEntity } from './pandillas.mapper';
export const PANDILLAS_LEGACY_EDIT_MESSAGE = 'Esta operación de edición todavía requiere el ámbito de autorización legacy asociado al expediente custodio.';
export const PANDILLAS_CASE_MESSAGE = 'Esta función requiere un expediente activo porque genera un resultado contextual del caso.';
/** Direct entry defaults to MASTER even if another module has a remembered project. */
export function resolvePandillasUiScope(caseRequested: boolean, caseProjectId?: string) {
  const caseEnabled = caseRequested && !!caseProjectId;
  return { mode: caseEnabled ? 'CASE' as const : 'MASTER' as const,
    caseEnabled, caseProjectId: caseEnabled ? caseProjectId : undefined };
}
export function canEditPandillasLegacy(scope: ReturnType<typeof resolvePandillasUiScope>,
  authenticated: boolean, gang?: GangEntity | null) {
  return authenticated && scope.caseEnabled && (!gang || gang.projectId === scope.caseProjectId);
}
export function selectPandillasMasterGang(gangs: GangEntity[], gangId: string) {
  const matches = gangs.filter(gang => gang.id === gangId);
  return matches.length === 1 ? matches[0] : null;
}
