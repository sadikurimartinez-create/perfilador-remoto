import type { GangMember } from './pandillas.mapper';
import type { DossierPhotos, DossierPhoto } from './photo-evidence/dossierPhotoDisplay';

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
