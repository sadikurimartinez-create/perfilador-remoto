import { Document, Paragraph, TextRun, ImageRun } from 'docx';
import { EditorialStructureEngine } from '@/utils/editorialStructureEngine';
import { renderStructuredTable } from '@/utils/documentTableRenderer';
import { PageFormatManager, HeaderFooterManager, InstitutionalBrandManager } from '@/utils/documentCompositionEngine';
import { DossierWordError, type MemberDossierView, type DossierWordStage } from '@/modules/pandillas/memberDossierView';
import { EVIDENCE_FALLBACK_CATALOG } from '@/utils/evidenceImageValidationEngine';

export interface DossierWordImage { data: Uint8Array; type: 'jpg' | 'png'; width: number; height: number; unavailable?: true }
export interface DossierWordContext { projectId: string; gangId: string; actor: string; memberId?: string; hasActiveProject?: boolean }
export type DossierStageObserver = (stage: DossierWordStage, status: 'START' | 'PASS', image?: { bytes: number; mime: string }) => void;
/** Consultation artifact, not an analytical report or a certification/publication package. */
export function renderMemberDossierWord(view: MemberDossierView, images: DossierWordImage[], context?: DossierWordContext, observe?: DossierStageObserver): Document {
  observe?.('DOSSIER_WORD_STAGE_4_RENDERER', 'START');
  if (!view.name || !view.gangName || images.length !== view.photos.length || images.some((image, index) => !image.data.length && (!image.unavailable || view.photos[index].label !== 'Otra fotografía asociada'))) throw new Error('DOSSIER_INCOMPLETE');
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
    if (img.unavailable) { children.push(new Paragraph({ text: EVIDENCE_FALLBACK_CATALOG.IMAGE_UNAVAILABLE })); return; }
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
  const provenance = view.photos.map((photo, index) => photo.evidence ? {
    renderStatus: images[index].unavailable ? 'IMAGE_UNAVAILABLE' : 'INCLUDED', documentId: photo.evidence.assetId, associationId: photo.evidence.associationId, derivedSha256: photo.evidence.derivedSha256,
    documentVersion: photo.evidence.documentVersion, associationVersion: photo.evidence.associationVersion,
    selectionVersion: photo.evidence.selectionVersion,
  } : { source: 'HISTORICAL_LEGACY_FALLBACK' });
  observe?.('DOSSIER_WORD_STAGE_4_RENDERER', 'PASS');
  observe?.('DOSSIER_WORD_STAGE_5_DOCUMENT_COMPOSITION', 'START');
  const document = new Document({ creator: context?.actor, title: 'Ficha institucional de integrante',
    customProperties: [{ name: 'DossierConsultationProvenance', value: JSON.stringify({ projectId: context?.projectId, gangId: context?.gangId, actor: context?.actor, generatedAt: new Date().toISOString(), operation: 'READ_ONLY_CONSULTATION', photographs: provenance }) }],
    sections: [{ properties: { page: { size: { width: PageFormatManager.width, height: PageFormatManager.height }, margin: PageFormatManager.margins } },
    headers: { default: HeaderFooterManager.createDefaultHeader(new ArrayBuffer(0), 'FICHA DE CONSULTA DE INTEGRANTE') }, children }] });
  observe?.('DOSSIER_WORD_STAGE_5_DOCUMENT_COMPOSITION', 'PASS');
  return document;
}

export async function hydrateDossierWordImages(view: MemberDossierView, observe?: DossierStageObserver): Promise<DossierWordImage[]> {
  const images: DossierWordImage[] = [];
  for (const photo of view.photos) {
    const stage = photo.label === 'Otra fotografía asociada' ? 'DOSSIER_WORD_STAGE_3_ADDITIONAL_PHOTOS' : 'DOSSIER_WORD_STAGE_2_PRIMARY_PHOTO';
    observe?.(stage, 'START');
    let photoStatus: number | undefined;
    try {
    const response = await fetch(photo.url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000) });
    photoStatus = response.status;
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
    observe?.(stage, 'PASS', { bytes: data.length, mime });
    } catch (error) {
      const reason = error instanceof Error && ['DOSSIER_IMAGE_UNAVAILABLE', 'DOSSIER_IMAGE_TYPE', 'DOSSIER_IMAGE_SIZE', 'DOSSIER_IMAGE_HASH', 'DOSSIER_IMAGE_DIMENSIONS'].includes(error.message)
        ? error.message : 'IMAGE_FETCH_OR_DECODE_FAILED';
      console.warn('[DOSSIER_WORD]', JSON.stringify({ code: photo.label === 'Otra fotografía asociada' ? 'ADDITIONAL_IMAGE_UNAVAILABLE' : 'PRIMARY_IMAGE_UNAVAILABLE', stage, status: 'FAIL', reason, ...(photoStatus ? { httpStatus: photoStatus } : {}) }));
      if (photo.label !== 'Otra fotografía asociada') throw new DossierWordError('PRIMARY_UNAVAILABLE', 'PHOTO', photoStatus);
      // Preserve the association and its provenance; never omit an unavailable additional silently.
      images.push({ data: new Uint8Array(0), type: 'jpg', width: 1, height: 1, unavailable: true });
    }
  }
  if (!view.photos.some(photo => photo.label === 'Otra fotografía asociada')) observe?.('DOSSIER_WORD_STAGE_3_ADDITIONAL_PHOTOS', 'PASS');
  return images;
}
