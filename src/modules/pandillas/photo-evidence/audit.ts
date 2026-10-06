import type { PhotoAuditEvent } from './contracts';
/** Runtime guard as well as types: audit accepts only bounded textual metadata. */
export function assertPhotoAuditSafe(event: PhotoAuditEvent): void {
  const keys = (value: unknown, allowed: string[]) => {
    if (!value || typeof value !== 'object' || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('R4_UNSAFE_AUDIT');
  };
  keys(event, ['event', 'actor', 'timestamp', 'projectId', 'gangId', 'memberIdentityId', 'assetId', 'oldValue', 'newValue', 'reason', 'action', 'actorInstitutionalUserId', 'source']);
  const persisted = event as PhotoAuditEvent & { action?: string; actorInstitutionalUserId?: string; source?: string };
  if (persisted.action !== undefined && persisted.action !== event.event || persisted.source !== undefined && persisted.source !== 'SERVER' || persisted.actorInstitutionalUserId !== undefined && persisted.actorInstitutionalUserId !== event.actor?.institutionalUserId) throw new Error('R4_UNSAFE_AUDIT');
  keys(event.actor, ['institutionalUserId', 'username']);
  for (const value of [event.oldValue, event.newValue]) if (value !== null) keys(value, ['id', 'version', 'status', 'associationId', 'documentId', 'sha256']);
  const inspect = (value: unknown): void => {
    if (typeof value === 'string' && (value.length > 1000 || /https?:|data:|gs:|base64|[?&]token=/i.test(value))) throw new Error('R4_UNSAFE_AUDIT');
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value) || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) throw new Error('R4_UNSAFE_AUDIT');
      for (const [key, item] of Object.entries(value)) {
        if (/url|binary|bytes|token|base64/i.test(key)) throw new Error('R4_UNSAFE_AUDIT');
        inspect(item);
      }
    }
  };
  inspect(event);
}
