import type { GangMember, GangEntity } from './pandillas.mapper';
import type { DossierPhotos, DossierPhoto } from './photo-evidence/dossierPhotoDisplay';
import { bindDossierPhotos } from './photo-evidence/dossierPhotoDisplay';
import { legacyMemberFingerprint } from './photo-evidence/identity';

export interface DossierExportGuard { scope: string; selected: GangMember | null; members: GangMember[]; enabled: boolean }
export function isDossierExportCurrent(current: DossierExportGuard, expected: DossierExportGuard): boolean {
  return current.enabled && expected.enabled && current.scope === expected.scope
    && current.selected === expected.selected && current.members === expected.members;
}
/** Resolve only the consultation scope from the institutional inventory; server READ remains mandatory. */
export function resolveDossierWordTarget(gangs: GangEntity[], gangId: string, projectContext?: string): GangEntity | null {
  if (!gangId || gangId.startsWith('static-gang-')) return null;
  const matches = gangs.filter(gang => gang.id === gangId);
  if (matches.length !== 1 || !matches[0].projectId || projectContext && matches[0].projectId !== projectContext) return null;
  return matches[0];
}
export class DossierWordError extends Error {
  constructor(public readonly code: 'SESSION_EXPIRED' | 'ACCESS_DENIED' | 'READ_UNAVAILABLE' | 'CONTEXT_CHANGED' | 'PRIMARY_UNAVAILABLE' | 'BUILD_FAILED' | 'DOWNLOAD_FAILED',
    public readonly stage: 'AUTHORIZATION' | 'PHOTO' | 'BUILD' | 'DOWNLOAD', public readonly httpStatus?: number) {
    super(code); this.name = 'DossierWordError';
  }
}
export type DossierWordStage = 'DOSSIER_WORD_STAGE_1_VIEWMODEL' | 'DOSSIER_WORD_STAGE_2_PRIMARY_PHOTO' | 'DOSSIER_WORD_STAGE_3_ADDITIONAL_PHOTOS' | 'DOSSIER_WORD_STAGE_4_RENDERER' | 'DOSSIER_WORD_STAGE_5_DOCUMENT_COMPOSITION' | 'DOSSIER_WORD_STAGE_6_PACKER' | 'DOSSIER_WORD_STAGE_7_BLOB' | 'DOSSIER_WORD_STAGE_8_DOWNLOAD';
export interface DossierWordDiagnostics {
  memberId?: string; gangId?: string; hasPrimaryPhoto: boolean; additionalPhotoCount: number;
  hasActiveProject: boolean; projectDependencyDetected: boolean;
  directPandillasEntry?: boolean; primaryMime?: string; primaryBytes?: number;
  docxBuildStarted?: boolean; docxBuildCompleted?: boolean;
}
/** Explicit allowlist: never serialize the original exception, URL, member record or project. */
export function logDossierWordStage(stage: DossierWordStage, status: 'START' | 'PASS' | 'FAIL', diagnostics: DossierWordDiagnostics, error?: unknown,
  image?: { bytes: number; mime: string }) {
  const names = ['Error', 'TypeError', 'ReferenceError', 'InvalidStateError', 'DossierWordError'];
  const messages = ['DOSSIER_INCOMPLETE', 'DOSSIER_EMPTY_SECTION', 'DOSSIER_IMAGE_UNAVAILABLE', 'DOSSIER_IMAGE_TYPE', 'DOSSIER_IMAGE_SIZE', 'DOSSIER_IMAGE_HASH', 'DOSSIER_IMAGE_DIMENSIONS', 'DOSSIER_BLOB_INVALID'];
  const errorName = error instanceof Error && names.includes(error.name) ? error.name : error ? 'Error' : undefined;
  const runtimePattern = /^(?:[A-Za-z_$][\w$]{0,60} is not defined|Cannot access '[A-Za-z_$][\w$]{0,60}' before initialization|Cannot read properties of (?:undefined|null) \(reading '[A-Za-z_$][\w$]{0,60}'\)|[A-Za-z_$][\w$.]{0,60} is not a function)$/;
  const errorMessage = error instanceof DossierWordError ? error.code : error instanceof Error && (messages.includes(error.message) || runtimePattern.test(error.message)) ? error.message : error ? 'UNCLASSIFIED_RUNTIME_FAILURE' : undefined;
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
  const errorCause = cause === undefined ? undefined : {
    errorName: cause instanceof Error && names.includes(cause.name) ? cause.name : 'Error',
    errorMessage: cause instanceof DossierWordError ? cause.code : cause instanceof Error && (messages.includes(cause.message) || runtimePattern.test(cause.message)) ? cause.message : 'UNCLASSIFIED_RUNTIME_FAILURE',
  };
  console.info('[DOSSIER_WORD]', JSON.stringify({ stage, status, errorName, errorMessage,
    errorCause,
    memberId: diagnostics.memberId && /^[\w-]{1,128}$/.test(diagnostics.memberId) ? diagnostics.memberId : undefined, hasPrimaryPhoto: diagnostics.hasPrimaryPhoto,
    additionalPhotoCount: diagnostics.additionalPhotoCount, hasActiveProject: diagnostics.hasActiveProject,
    projectDependencyDetected: diagnostics.projectDependencyDetected,
    directPandillasEntry: diagnostics.directPandillasEntry,
    primaryMime: ['image/jpeg', 'image/png', 'image/webp'].includes(diagnostics.primaryMime || '') ? diagnostics.primaryMime : undefined,
    primaryBytes: Number.isFinite(diagnostics.primaryBytes) ? diagnostics.primaryBytes : undefined,
    docxBuildStarted: !!diagnostics.docxBuildStarted, docxBuildCompleted: !!diagnostics.docxBuildCompleted,
    ...(image ? { bytes: image.bytes, mime: ['image/jpeg', 'image/png', 'image/webp'].includes(image.mime) ? image.mime : undefined } : {}) }));
}
export function dossierWordErrorMessage(error: unknown): string {
  const messages: Record<DossierWordError['code'], string> = {
    SESSION_EXPIRED: 'Sesión expirada. Inicie sesión nuevamente para generar Word.',
    ACCESS_DENIED: 'No tiene autorización para consultar este expediente.',
    READ_UNAVAILABLE: 'No se pudo verificar la ficha institucional. Intente nuevamente.',
    CONTEXT_CHANGED: 'La ficha cambió durante la generación. Vuelva a seleccionar el integrante.',
    PRIMARY_UNAVAILABLE: 'No fue posible recuperar la fotografía principal. Intente nuevamente.',
    BUILD_FAILED: 'Error al construir el documento Word.', DOWNLOAD_FAILED: 'Error al descargar el archivo Word.',
  };
  const controlled = error instanceof DossierWordError ? error : new DossierWordError('BUILD_FAILED', 'BUILD');
  console.warn('[DOSSIER_WORD]', JSON.stringify({ code: controlled.code, stage: controlled.stage, ...(controlled.httpStatus ? { httpStatus: controlled.httpStatus } : {}) }));
  return messages[controlled.code];
}
export async function prepareAuthorizedDossierWordView(view: MemberDossierView, member: GangMember, projectId: string, gangId: string): Promise<MemberDossierView> {
  let response: Response;
  try {
    response = await fetch(`/api/pandillas/primary-photos?${new URLSearchParams({ projectId, gangId })}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) });
  } catch { throw new DossierWordError('READ_UNAVAILABLE', 'AUTHORIZATION'); }
  if (!response.ok) throw new DossierWordError(response.status === 401 ? 'SESSION_EXPIRED' : response.status === 403 ? 'ACCESS_DENIED' : 'READ_UNAVAILABLE', 'AUTHORIZATION', response.status);
  let data: any;
  try { data = await response.json(); } catch { throw new DossierWordError('READ_UNAVAILABLE', 'AUTHORIZATION'); }
  const fingerprint = await legacyMemberFingerprint(member);
  if (data.projectId !== projectId || data.gangId !== gangId || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()
    || !Array.isArray(data.items) || data.items.filter((row: any) => row.memberFingerprint === fingerprint).length !== 1) throw new DossierWordError('CONTEXT_CHANGED', 'AUTHORIZATION');
  const fresh = buildMemberDossierView(member, view.gangName, bindDossierPhotos(projectId, gangId, [fingerprint], data)[0]);
  const identity = (snapshot: MemberDossierView) => snapshot.photos.map(photo => photo.evidence
    ? `${photo.evidence.assetId}:${photo.evidence.derivedSha256}:${photo.evidence.associationVersion}:${photo.evidence.documentVersion}:${photo.evidence.selectionVersion || ''}` : photo.url);
  // A standalone consultation may not have initiated the preview photo resolver. Obtain R4 photos
  // from the authorized server response without changing preview state, legacy fields or import scope.
  if (view.photos.some(photo => photo.evidence) && JSON.stringify(identity(fresh)) !== JSON.stringify(identity(view))) throw new DossierWordError(view.photos.some(photo => photo.evidence?.selectionVersion) && !fresh.photos.some(photo => photo.evidence?.selectionVersion) ? 'PRIMARY_UNAVAILABLE' : 'CONTEXT_CHANGED', 'PHOTO');
  return fresh;
}

const absent = new Set(['no registrado', 'no registrada', 'no evaluado', 'no evaluada', 'sin datos', 'sin dato', 'n/a', 'n/d', 'ninguno', 'no aplica', 'desconocido', 'no refiere', 'null', 'undefined']);
export function dossierValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.map(dossierValue).filter(Boolean).join('; ') || undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text && !absent.has(text.toLocaleLowerCase('es')) ? text : undefined;
}
const groups: Array<[string, Array<[keyof GangMember, string]>]> = [
  ['Perfil', [['alias', 'Alias / apodo'], ['edad', 'Edad'], ['sexo', 'Sexo'], ['estatusPandilla', 'Estatus en la pandilla'], ['rol', 'Rol']]],
  ['Datos de identificación', [['curp', 'CURP'], ['telefono', 'Teléfono'], ['telefonoRedes', 'Teléfono / redes'], ['domicilioConocido', 'Domicilio conocido']]],
  ['Información criminológica', [['antecedentes', 'Antecedentes'], ['detencionesPrevias', 'Detenciones previas'], ['ingresosCentrosInternamiento', 'Ingresos / reclusiones'], ['consumoDrogas', 'Consumo de sustancias'], ['riesgoCriminogeno', 'Riesgo criminógeno'], ['nivelViolencia', 'Nivel de violencia'], ['peligrosidadCalculada', 'Peligrosidad registrada']]],
  ['Características y señas particulares', [['señasParticulares', 'Señas particulares'], ['tatuajes', 'Tatuajes'], ['cicatrices', 'Cicatrices'], ['marcasDistintivas', 'Marcas distintivas'], ['complexion', 'Complexión'], ['estatura', 'Estatura'], ['vestimentaUsual', 'Vestimenta usual'], ['vehiculosAsociados', 'Vehículos asociados']]],
  ['Actividad y ocupación', [['lugarTrabajo', 'Lugar de trabajo'], ['actividadEconomica', 'Actividad económica'], ['escuela', 'Escuela']]],
];
export interface MemberDossierView {
  name: string; gangName: string;
  sections: Array<{ title: string; fields: Array<{ label: string; value: string }> }>;
  photos: Array<{ label: string; url: string; evidence?: DossierPhoto }>;
}
export function buildMemberDossierView(member: GangMember, gangName: string, photos: DossierPhotos = { additional: [] }): MemberDossierView {
  const sections = groups.map(([title, fields]) => ({ title, fields: fields.flatMap(([key, label]) => {
    const value = dossierValue(member[key]); return value === undefined ? [] : [{ label, value }];
  }) })).filter(section => section.fields.length);
  const geo = member.georreferencia;
  if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
    const fields = [{ label: 'Coordenadas', value: `${geo.lat}, ${geo.lng}` }];
    const confidence = dossierValue(geo.confidence), status = dossierValue(geo.status);
    if (confidence) fields.push({ label: 'Confianza de georreferencia', value: confidence });
    if (status) fields.push({ label: 'Estado de georreferencia', value: status });
    sections.splice(Math.min(2, sections.length), 0, { title: 'Georreferencia registrada', fields });
  }
  const primary = photos.primary;
  const images: MemberDossierView['photos'] = primary ? [{ label: 'Fotografía principal', url: primary.derivedUrl, evidence: primary }]
    : dossierValue(member.fotografiaUrl) ? [{ label: 'Fotografía histórica', url: member.fotografiaUrl! }] : [];
  const hashes = new Set(primary ? [primary.derivedSha256] : []), ids = new Set(primary ? [primary.assetId] : []);
  for (const photo of photos.additional) {
    if (ids.has(photo.assetId) || hashes.has(photo.derivedSha256) || images.some(image => image.url === photo.derivedUrl)) continue;
    ids.add(photo.assetId); hashes.add(photo.derivedSha256);
    images.push({ label: 'Otra fotografía asociada', url: photo.derivedUrl, evidence: photo });
  }
  return { name: dossierValue(member.nombre) || '', gangName: dossierValue(gangName) || '', sections, photos: images };
}

export interface DossierConsultationState { formOpen: boolean; selected: GangMember | null }
export const initialDossierConsultation: DossierConsultationState = { formOpen: false, selected: null };
export function dossierConsultationTransition(state: DossierConsultationState, action: 'REGISTER' | 'CLOSE' | 'CLEAR' | 'RESET' | GangMember): DossierConsultationState {
  if (typeof action === 'object') return { formOpen: false, selected: action };
  if (action === 'RESET') return initialDossierConsultation;
  if (action === 'CLEAR') return { ...state, selected: null };
  return { ...state, formOpen: action === 'REGISTER' };
}
