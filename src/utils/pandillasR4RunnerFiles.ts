// Browser-only local file preparation. The endpoint independently verifies certification.
import type { R4InjectionItem } from '@/services/pandillasR4ImageInjectionPlan';
export const R4_RUNNER_PROJECT = 'UIwlMmZotIAOsAWmNEH2';
export const R4_RUNNER_CONFIRMATION = `INYECTAR 79 FOTOGRAFÍAS EN EL PROYECTO ${R4_RUNNER_PROJECT}`;
export type R4RunnerPair = { item: R4InjectionItem; original: File; derived: File };
function requiredR4Items(payload: any): R4InjectionItem[] {
  if (!payload || payload.mode !== 'DRY_RUN' || payload.projectId !== R4_RUNNER_PROJECT
    || payload.batchLabel !== 'R4_PRIMARY_IMAGE_INJECTION_V1' || !Array.isArray(payload.items) || payload.items.length !== 79) throw new Error('Se requiere el payload certificado de 79 integrantes.');
  const members = new Set<string>(), originals = new Set<string>(), derivatives = new Set<string>();
  const items: R4InjectionItem[] = [];
  for (const input of payload.items) {
    const item = { ...input, derivedMimeType: input.derivedMimeType ?? input.mimeType } as R4InjectionItem;
    const key = JSON.stringify([item.gangName, item.memberName]);
    const name = String(item.memberName).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    if (members.has(key) || originals.has(item.originalSha256) || derivatives.has(item.derivedSha256)
      || /yordi alejandro|angel ricardo gonzalez sanchez/.test(name) || item.selectionType !== 'PRIMARY' || item.associationLevel !== 'EXACT'
      || !item.sourceImageId || !/^[a-f0-9]{64}$/.test(item.originalSha256) || !/^[a-f0-9]{64}$/.test(item.derivedSha256)) throw new Error('Payload duplicado, excluido o incompatible.');
    members.add(key); originals.add(item.originalSha256); derivatives.add(item.derivedSha256);
    for (const filename of [item.originalFileName, item.derivedFileName]) {
      if (!/^[A-Za-z0-9_.-]{1,180}$/.test(filename) || filename.includes('..')) throw new Error('Nombre de archivo inválido.');
    }
    items.push(item);
  }
  if (new Set(items.map(item => item.originalFileName)).size !== 79 || new Set(items.map(item => item.derivedFileName)).size !== 79) throw new Error('Nombres requeridos duplicados.');
  return items;
}
export type R4FolderKind = 'original' | 'derived';
export function captureR4FileSelection(input: Pick<HTMLInputElement, 'files' | 'value'>): File[] {
  // Snapshot the live FileList BEFORE resetting the input or scheduling React updates.
  const selected = Array.from(input.files || []);
  input.value = '';
  return selected;
}
export function inspectR4Folder(payload: any, files: File[], kind: R4FolderKind) {
  const items = requiredR4Items(payload);
  const filename = kind === 'original' ? 'originalFileName' : 'derivedFileName';
  const requiredNames = new Set(items.map(item => item[filename]));
  const matches = items.map(item => ({ item, files: files.filter(file => file.name === item[filename]) }));
  const missingNames = matches.filter(match => !match.files.length).map(match => match.item[filename]);
  const duplicateNames = matches.filter(match => match.files.length > 1).map(match => match.item[filename]);
  return { folderFiles: files.length, required: 79, matched: matches.filter(match => match.files.length).length,
    missing: missingNames.length, extraIgnored: files.filter(file => !requiredNames.has(file.name)).length,
    missingNames, duplicateNames, valid: !missingNames.length && !duplicateNames.length,
    selected: matches.filter(match => match.files.length === 1).map(match => ({ item: match.item, file: match.files[0] })) };
}
export async function precheckR4Folder(payload: any, files: File[], kind: R4FolderKind, sha256: (file: File) => Promise<string>) {
  const coverage = inspectR4Folder(payload, files, kind);
  if (!coverage.valid) throw new Error(coverage.missing
    ? `Faltan ${coverage.missing} archivos: ${coverage.missingNames.join(', ')}`
    : `Archivos requeridos ambiguos: ${coverage.duplicateNames.join(', ')}`);
  let hashMatch = 0;
  for (const { item, file } of coverage.selected) {
    const mime = kind === 'original' ? item.mimeType : item.derivedMimeType;
    const expected = kind === 'original' ? item.originalSha256 : item.derivedSha256;
    if (file.size > 2 * 1024 * 1024 || file.type !== mime || await sha256(file) !== expected) throw new Error(`Integridad inválida: ${file.name}`);
    hashMatch++;
  }
  return { ...coverage, hashMatch };
}
export async function prepareR4RunnerFiles(payload: any, files: File[], sha256: (file: File) => Promise<string>) {
  const pairs: R4RunnerPair[] = [];
  for (const item of requiredR4Items(payload)) {
    const find = async (filename: string, expected: string, mime: string) => {
      if (!/^[A-Za-z0-9_.-]{1,180}$/.test(filename) || filename.includes('..')) throw new Error('Nombre de archivo inválido.');
      const matches = files.filter(file => file.name === filename);
      if (!matches.length) throw new Error(`Falta ${filename}`);
      const valid: File[] = [];
      for (const file of matches) {
        if (file.size > 2 * 1024 * 1024 || file.type !== mime || await sha256(file) !== expected) throw new Error(`Integridad inválida: ${filename}`);
        valid.push(file);
      }
      // Copies in multiple selected folders may only be collapsed when all bytes match.
      return valid[0];
    };
    pairs.push({ item, original: await find(item.originalFileName, item.originalSha256, item.mimeType),
      derived: await find(item.derivedFileName, item.derivedSha256, item.derivedMimeType) });
  }
  return pairs;
}
