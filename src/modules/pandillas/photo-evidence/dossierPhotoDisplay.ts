export function bindDossierPhotoUrls(projectId: string, gangId: string, fingerprints: string[], response: any): Array<string | undefined> {
  if (!response || response.projectId !== projectId || response.gangId !== gangId || !Array.isArray(response.items)) return [];
  return fingerprints.map(fingerprint => {
    const matches = response.items.filter((row: any) => row.memberFingerprint === fingerprint);
    if (matches.length !== 1 || matches[0].hasPrimaryPhoto !== true || !matches[0].memberId || !matches[0].assetId) return undefined;
    try {
      const url = new URL(matches[0].derivedUrl);
      if (url.protocol !== 'https:' || !(url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.storage.googleapis.com'))) return undefined;
      return url.toString();
    } catch { return undefined; }
  });
}
export function dossierPhotoSource(primaryUrl?: string, legacyUrl?: string, failed: string[] = []) {
  return [primaryUrl, legacyUrl].find((url): url is string => !!url && !failed.includes(url));
}

export interface DossierPhoto {
  assetId: string; associationId: string; derivedSha256: string; derivedUrl: string;
  documentVersion: number; associationVersion: number; selectionVersion?: number;
  mimeType: 'image/jpeg' | 'image/png'; width: number; height: number;
}
export interface DossierPhotos { primary?: DossierPhoto; additional: DossierPhoto[] }
function validPhoto(value: any): value is DossierPhoto {
  try {
    const url = new URL(value.derivedUrl);
    return url.protocol === 'https:' && (url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.storage.googleapis.com'))
      && !!value.assetId && !!value.associationId && /^[a-f0-9]{64}$/.test(value.derivedSha256)
      && ['image/jpeg', 'image/png'].includes(value.mimeType)
      && [value.width, value.height, value.documentVersion, value.associationVersion].every(n => Number.isSafeInteger(n) && n > 0);
  } catch { return false; }
}
export function bindDossierPhotos(projectId: string, gangId: string, fingerprints: string[], response: any): DossierPhotos[] {
  if (response?.projectId !== projectId || response?.gangId !== gangId || !Array.isArray(response.items)
    || !Number.isFinite(response.expiresAt) || response.expiresAt <= Date.now()) return [];
  return fingerprints.map(fingerprint => {
    const rows = response.items.filter((row: any) => row.memberFingerprint === fingerprint);
    if (rows.length !== 1 || !rows[0].memberId || fingerprints.filter(f => f === fingerprint).length !== 1) return { additional: [] };
    const row = rows[0];
    const primary = row.hasPrimaryPhoto && validPhoto(row.primaryPhoto) && row.primaryPhoto.assetId === row.assetId
      && row.primaryPhoto.derivedUrl === row.derivedUrl ? row.primaryPhoto : undefined;
    const ids = new Set(primary ? [primary.assetId] : []), hashes = new Set(primary ? [primary.derivedSha256] : []);
    const additional = (Array.isArray(row.additionalPhotos) ? row.additionalPhotos : []).filter((photo: any) => {
      if (!validPhoto(photo) || ids.has(photo.assetId) || hashes.has(photo.derivedSha256)) return false;
      ids.add(photo.assetId); hashes.add(photo.derivedSha256); return true;
    });
    return { primary, additional };
  });
}
