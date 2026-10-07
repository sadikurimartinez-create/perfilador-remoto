import { Packer } from 'docx';
import JSZip from 'jszip';
import { webcrypto } from 'crypto';
import { buildMemberDossierView } from '../src/modules/pandillas/memberDossierView';
import { renderMemberDossierWord, hydrateDossierWordImages } from '../src/document-engine/renderers/MemberDossierWordRenderer';
import type { DossierPhoto } from '../src/modules/pandillas/photo-evidence/dossierPhotoDisplay';

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
test('Word reflects preview fields and order, actual media, governed header/table, no placeholders or PDF', async () => {
  const view = buildMemberDossierView({ nombre: 'Integrante documental', alias: 'Alias real', rol: '', curp: 'N/A', antecedentes: 'Texto documental | completo **sin reinterpretar**', lugarTrabajo: 'Trabajo' }, 'Pandilla documental');
  view.photos = [{ label: 'Fotografía principal', url: 'synthetic-primary' }, { label: 'Otra fotografía asociada', url: 'synthetic-additional' }];
  const doc = renderMemberDossierWord(view, view.photos.map(() => ({ data: png, width: 1, height: 1, type: 'png' })));
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  const xml = await zip.file('word/document.xml')!.async('string');
  const header = await zip.file('word/header1.xml')!.async('string');
  expect(xml).toContain('FICHA INSTITUCIONAL DE INTEGRANTE'); expect(header).toContain('CEIPOL - SSPE');
  expect(xml).toContain('<w:tblHeader/>'); expect(xml).not.toMatch(/N\/A|CURP|No registrado|No evaluado|PDF|CERTIFIED/);
  let last = xml.indexOf(view.photos[0].label);
  for (const section of view.sections) {
    const index = xml.indexOf(section.title); expect(index).toBeGreaterThan(last); last = index;
    for (const field of section.fields) expect(xml).toContain(field.value);
  }
  expect(xml.indexOf('Otras fotografías asociadas')).toBeGreaterThan(last);
  expect(xml.match(/<w:drawing>/g)).toHaveLength(2);
});
test('missing visible photograph aborts entire document rather than silently changing preview contents', () => {
  const view = buildMemberDossierView({ nombre: 'Nombre', alias: '', rol: '', fotografiaUrl: 'legacy' }, 'Pandilla');
  expect(() => renderMemberDossierWord(view, [])).toThrow('DOSSIER_INCOMPLETE');
});
test('Word hydration verifies certified SHA and dimensions without upload/persistence; corrupted bytes fail', async () => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', png))).map(n => n.toString(16).padStart(2, '0')).join('');
  const evidence: DossierPhoto = { assetId: 'asset', associationId: 'assoc', derivedSha256: sha, derivedUrl: 'https://storage.googleapis.com/synthetic/image.png', mimeType: 'image/png', width: 1, height: 1, documentVersion: 1, associationVersion: 1 };
  const view = buildMemberDossierView({ nombre: 'Nombre', alias: '', rol: '' }, 'Pandilla', { primary: evidence, additional: [] });
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(png, { headers: { 'content-type': 'image/png' } }));
  const bitmap = jest.fn().mockResolvedValue({ width: 1, height: 1, close: jest.fn() });
  Object.defineProperty(globalThis, 'createImageBitmap', { value: bitmap, configurable: true });
  try {
    expect(await hydrateDossierWordImages(view)).toHaveLength(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store' });
    fetchMock.mockResolvedValue(new Response(png, { headers: { 'content-type': 'image/png' } }));
    evidence.derivedSha256 = '0'.repeat(64);
    await expect(hydrateDossierWordImages(view)).rejects.toThrow('PRIMARY_UNAVAILABLE');
  } finally { fetchMock.mockRestore(); delete (globalThis as any).createImageBitmap; }
});
