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
