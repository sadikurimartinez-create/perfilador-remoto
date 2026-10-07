import { Document, Paragraph, TextRun, ImageRun } from 'docx';
import { EditorialStructureEngine } from '@/utils/editorialStructureEngine';
import { renderStructuredTable } from '@/utils/documentTableRenderer';
import { PageFormatManager, HeaderFooterManager, InstitutionalBrandManager } from '@/utils/documentCompositionEngine';
import type { MemberDossierView } from '@/modules/pandillas/memberDossierView';

export interface DossierWordImage { data: Uint8Array; type: 'jpg' | 'png'; width: number; height: number }
export interface DossierWordContext { projectId: string; gangId: string; actor: string }
/** Consultation artifact, not an analytical report or a certification/publication package. */
export function renderMemberDossierWord(view: MemberDossierView, images: DossierWordImage[], context?: DossierWordContext): Document {
  if (!view.name || !view.gangName || images.length !== view.photos.length || images.some(image => !image.data.length)) throw new Error('DOSSIER_INCOMPLETE');
  const children: Array<Paragraph | ReturnType<typeof renderStructuredTable>> = [
    ...InstitutionalBrandManager.createCoverIdentity('FICHA INSTITUCIONAL DE INTEGRANTE', {}, true),
    new Paragraph({ children: [new TextRun({ text: view.name, bold: true, size: 28 })] }),
    new Paragraph({ text: view.gangName, spacing: { after: 180 } }),
  ];
  const heading = (text: string) => {
    // Use the existing editorial parser only for fixed section titles, never reinterpret member data.
    const block = EditorialStructureEngine.parse(`## ${text}`)[0];
    children.push(new Paragraph({ children: [new TextRun({ text: block.text!, bold: true, color: '0D2B52', size: 23 })], keepNext: true, spacing: { before: 180, after: 120 } }));
  };
  const image = (index: number) => {
    const img = images[index];
    const scale = Math.min(320 / img.width, 260 / img.height, 1);
    children.push(new Paragraph({ children: [new ImageRun({ data: img.data, type: img.type, transformation: { width: Math.max(1, Math.round(img.width * scale)), height: Math.max(1, Math.round(img.height * scale)) } })] }));
  };
  if (view.photos.length) { heading(view.photos[0].label); image(0); }
  for (const section of view.sections) {
    if (!section.fields.length || section.fields.some(field => !field.value.trim())) throw new Error('DOSSIER_EMPTY_SECTION');
    heading(section.title);
    children.push(renderStructuredTable({ headers: ['Campo', 'Información disponible'], rows: section.fields.map(field => [field.label, field.value]) }, { columnWidths: [32, 68], cleanMarkdown: false }));
  }
  if (view.photos.length > 1) { heading('Otras fotografías asociadas'); for (let i = 1; i < images.length; i++) image(i); }
  const provenance = view.photos.map(photo => photo.evidence ? {
    documentId: photo.evidence.assetId, associationId: photo.evidence.associationId, derivedSha256: photo.evidence.derivedSha256,
    documentVersion: photo.evidence.documentVersion, associationVersion: photo.evidence.associationVersion,
    selectionVersion: photo.evidence.selectionVersion,
  } : { source: 'HISTORICAL_LEGACY_FALLBACK' });
  return new Document({ creator: context?.actor, title: 'Ficha institucional de integrante',
    customProperties: [{ name: 'DossierConsultationProvenance', value: JSON.stringify({ ...context, generatedAt: new Date().toISOString(), operation: 'READ_ONLY_CONSULTATION', photographs: provenance }) }],
    sections: [{ properties: { page: { size: { width: PageFormatManager.width, height: PageFormatManager.height }, margin: PageFormatManager.margins } },
    headers: { default: HeaderFooterManager.createDefaultHeader(new ArrayBuffer(0), 'FICHA DE CONSULTA DE INTEGRANTE') }, children }] });
}

export async function hydrateDossierWordImages(view: MemberDossierView): Promise<DossierWordImage[]> {
  const images: DossierWordImage[] = [];
  for (const photo of view.photos) {
    const response = await fetch(photo.url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('DOSSIER_IMAGE_UNAVAILABLE');
    const mime = (response.headers.get('content-type') || '').split(';')[0];
    if (!['image/png', 'image/jpeg'].includes(mime)) throw new Error('DOSSIER_IMAGE_TYPE');
    const data = new Uint8Array(await response.arrayBuffer());
    if (!data.length || data.length > 2 * 1024 * 1024) throw new Error('DOSSIER_IMAGE_SIZE');
    if (photo.evidence) {
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data))).map(n => n.toString(16).padStart(2, '0')).join('');
      if (hash !== photo.evidence.derivedSha256 || mime !== photo.evidence.mimeType) throw new Error('DOSSIER_IMAGE_HASH');
    }
    const bitmap = await createImageBitmap(new Blob([data], { type: mime }));
    const width = bitmap.width, height = bitmap.height; bitmap.close();
    if (!width || !height || width * height > 40000000 || photo.evidence && (width !== photo.evidence.width || height !== photo.evidence.height)) throw new Error('DOSSIER_IMAGE_DIMENSIONS');
    images.push({ data, type: mime === 'image/png' ? 'png' : 'jpg', width, height });
  }
  return images;
}
