import { createHash } from 'crypto';
import { captureR4FileSelection, inspectR4Folder, precheckR4Folder, prepareR4RunnerFiles,
  R4_RUNNER_PROJECT, type R4FolderKind } from '../src/utils/pandillasR4RunnerFiles';

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const contents = (kind: R4FolderKind, i: number) => Buffer.from(`${kind}-certified-${i}`);
function payload() {
  return { mode: 'DRY_RUN', projectId: R4_RUNNER_PROJECT, batchLabel: 'R4_PRIMARY_IMAGE_INJECTION_V1',
    items: Array.from({ length: 79 }, (_, i) => ({ gangName: 'Synthetic gang', memberName: `Member ${i}`,
      sourceImageId: `IMG-${i}`, selectionType: 'PRIMARY', associationLevel: 'EXACT',
      originalFileName: `IMG-${i}__original.jpg`, derivedFileName: `IMG-${i}__derived.png`,
      originalSha256: hash(contents('original', i)), derivedSha256: hash(contents('derived', i)), mimeType: 'image/jpeg', derivedMimeType: 'image/png' })) };
}
function required(kind: R4FolderKind) {
  return Array.from({ length: 79 }, (_, i) => {
    const bytes = contents(kind, i);
    return { name: `IMG-${i}__${kind}.${kind === 'original' ? 'jpg' : 'png'}`, type: kind === 'original' ? 'image/jpeg' : 'image/png',
      size: bytes.length, webkitRelativePath: `${kind}/nested/IMG-${i}__${kind}.${kind === 'original' ? 'jpg' : 'png'}`,
      arrayBuffer: async () => new Uint8Array(bytes).buffer } as File;
  });
}
function extras() {
  // Extras are deliberately incompatible: their content must never be read or validated.
  return Array.from({ length: 128 }, (_, i) => ({ name: `EXTRA-${i}.pdf`, type: 'application/pdf', size: 99999999,
    arrayBuffer: jest.fn(() => { throw new Error('EXTRA_MUST_NOT_BE_READ'); }) } as unknown as File));
}
const sha = () => jest.fn(async (file: File) => hash(Buffer.from(await file.arrayBuffer())));

test.each(['derived', 'original'] as const)('%s folder: 207 files, 79 required, 128 ignored, all 79 hashes match', async kind => {
  const files = [...required(kind), ...extras()];
  expect(inspectR4Folder(payload(), files, kind)).toMatchObject({ folderFiles: 207, required: 79, matched: 79,
    missing: 0, extraIgnored: 128, valid: true });
  const digest = sha(); const checked = await precheckR4Folder(payload(), files, kind, digest);
  expect(checked.hashMatch).toBe(79); expect(digest).toHaveBeenCalledTimes(79);
  expect(digest.mock.calls.every(([file]) => !file.name.startsWith('EXTRA-'))).toBe(true);
  for (const file of files.slice(79)) expect(file.arrayBuffer).not.toHaveBeenCalled();
});
test.each(['derived', 'original'] as const)('%s folder: 206 files with one required missing fails with 78 matches', async kind => {
  const files = [...required(kind).slice(1), ...extras()]; const digest = sha();
  expect(inspectR4Folder(payload(), files, kind)).toMatchObject({ folderFiles: 206, required: 79, matched: 78,
    missing: 1, extraIgnored: 128, valid: false });
  await expect(precheckR4Folder(payload(), files, kind, digest)).rejects.toThrow('Faltan 1 archivos');
  expect(digest).not.toHaveBeenCalled();
});
test('FileList snapshot survives clearing input before the deferred state updater runs', () => {
  let liveFiles = [...required('derived'), ...extras()] as unknown as FileList;
  const input = { get files() { return liveFiles; }, get value() { return 'derived'; },
    set value(value: string) { expect(value).toBe(''); liveFiles = [] as unknown as FileList; } };
  const selected = captureR4FileSelection(input);
  const deferredUpdater = (prior: File[]) => [...prior, ...selected];
  expect(input.files.length).toBe(0); expect(deferredUpdater([]).length).toBe(207);
  expect(inspectR4Folder(payload(), deferredUpdater([]), 'derived').matched).toBe(79);
});
test('cancelled picker produces an empty snapshot without reusing a previous FileList', () => {
  const input = { files: null, value: '' }; expect(captureR4FileSelection(input)).toEqual([]);
});
test('two full folders prepare exactly 79 pairs, hashing only the 158 required files', async () => {
  const digest = sha(); const files = [...required('original'), ...extras(), ...required('derived'), ...extras()];
  const pairs = await prepareR4RunnerFiles(payload(), files, digest);
  expect(pairs).toHaveLength(79); expect(digest).toHaveBeenCalledTimes(158);
  expect(pairs.every(pair => !pair.original.name.startsWith('EXTRA-') && !pair.derived.name.startsWith('EXTRA-'))).toBe(true);
});
test('required-file hash mismatch remains an error even when all filenames are present', async () => {
  await expect(precheckR4Folder(payload(), required('derived'), 'derived', async () => '0'.repeat(64))).rejects.toThrow('Integridad inválida');
});
test('duplicate required filename in different subfolders is ambiguous and cannot pass', async () => {
  const files = required('derived'); files.push({ ...files[0], webkitRelativePath: 'derived/another/IMG-0__derived.png' });
  expect(inspectR4Folder(payload(), files, 'derived')).toMatchObject({ matched: 79, missing: 0, valid: false, duplicateNames: ['IMG-0__derived.png'] });
  await expect(precheckR4Folder(payload(), files, 'derived', sha())).rejects.toThrow('ambiguos');
});
