// Browser-only local file preparation. The endpoint independently verifies certification.
import type { R4InjectionItem } from '@/services/pandillasR4ImageInjectionPlan';
export const R4_RUNNER_PROJECT = 'UIwlMmZotIAOsAWmNEH2';
export const R4_RUNNER_CONFIRMATION = `INYECTAR 79 FOTOGRAFÍAS EN EL PROYECTO ${R4_RUNNER_PROJECT}`;
export type R4RunnerPair = { item: R4InjectionItem; original: File; derived: File };
export async function prepareR4RunnerFiles(payload: any, files: File[], sha256: (file: File) => Promise<string>) {
  if (!payload || payload.mode !== 'DRY_RUN' || payload.projectId !== R4_RUNNER_PROJECT
    || payload.batchLabel !== 'R4_PRIMARY_IMAGE_INJECTION_V1' || !Array.isArray(payload.items) || payload.items.length !== 79) throw new Error('Se requiere el payload certificado de 79 integrantes.');
  const members = new Set<string>(), originals = new Set<string>(), derivatives = new Set<string>();
  const pairs: R4RunnerPair[] = [];
  for (const input of payload.items) {
    const item = { ...input, derivedMimeType: input.derivedMimeType ?? input.mimeType } as R4InjectionItem;
    const key = JSON.stringify([item.gangName, item.memberName]);
    const name = String(item.memberName).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    if (members.has(key) || originals.has(item.originalSha256) || derivatives.has(item.derivedSha256)
      || /yordi alejandro|angel ricardo gonzalez sanchez/.test(name) || item.selectionType !== 'PRIMARY' || item.associationLevel !== 'EXACT'
      || !item.sourceImageId || !/^[a-f0-9]{64}$/.test(item.originalSha256) || !/^[a-f0-9]{64}$/.test(item.derivedSha256)) throw new Error('Payload duplicado, excluido o incompatible.');
    members.add(key); originals.add(item.originalSha256); derivatives.add(item.derivedSha256);
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
