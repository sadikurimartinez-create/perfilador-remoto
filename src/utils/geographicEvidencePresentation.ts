import type { CanonicalProjectGeography } from './canonicalProjectGeography';
import { corridorVertexRole, normalizeCanonicalGeographyType, type DraftProjectGeography } from './canonicalProjectGeography';
import type { TerritorialEvidenceReference } from './territorialEvidenceReference';

export const geographicRoleLabels = {
  START: ['NI', 'Nodo Inicial'], INTERMEDIATE: ['NM', 'Nodo Intermedio'],
  END: ['NF', 'Nodo Final'], VERTEX: ['V', 'Perímetro'], POINT: ['P', 'Nodo Principal'],
  NONE: ['EA', 'Evidencia Fotográfica Adicional'], LEGACY_UNCLASSIFIED: ['SC', 'Rol no acreditado'],
} as const;
export type GeographicEvidenceRole = keyof typeof geographicRoleLabels;
const legacyRoles: Record<string, GeographicEvidenceRole> = {
  'Nodo Inicial': 'START', 'Nodo Intermedio': 'INTERMEDIATE', Corredor: 'INTERMEDIATE',
  'Nodo Final': 'END', 'Perímetro': 'VERTEX', 'Nodo Principal': 'POINT',
  'Evidencia Adicional': 'NONE', 'Evidencia Fotográfica Adicional': 'NONE',
};
export function geographicEvidenceRole(item: any): GeographicEvidenceRole {
  if (item?.evidenceType === 'ADDITIONAL_PHOTO' || item?.geometryRole === 'NONE') return 'NONE';
  const explicit = item?.geometryRole || item?.territorialRef?.role;
  if (explicit && Object.prototype.hasOwnProperty.call(geographicRoleLabels, explicit)) return explicit;
  return legacyRoles[item?.tipo] || 'LEGACY_UNCLASSIFIED';
}
export function geographicEvidenceCoordinates(item: any): { lat: number; lng: number } | null {
  // Preserve paired coordinates from one source; never coerce absent/null values to zero.
  for (const pair of [[item?.lat, item?.lng], [item?.coordinates?.lat, item?.coordinates?.lng], [item?.savedCoordinates?.lat, item?.savedCoordinates?.lng],
    [item?.latitude, item?.longitude], [item?.gpsLat, item?.gpsLng],
    [item?.exifLat, item?.exifLng], [item?.coordenadas?.lat, item?.coordenadas?.lng]]) {
    if (pair.some(value => value == null || value === '' || typeof value === 'boolean')) continue;
    const [lat, lng] = pair.map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}
export function geographicEvidenceOrder(item: any, geography?: CanonicalProjectGeography | null): number | null {
  if (geographicEvidenceRole(item) === 'NONE') return null;
  const refs = geography?.sourceRefs?.filter(ref => ref.id === item?.territorialRef?.nodeId);
  const order = refs?.length === 1 ? refs[0].order : item?.territorialRef?.order;
  return Number.isSafeInteger(order) && order >= 1 ? order : null;
}
export function sortGeographicEvidence<T>(items: T[], geography?: CanonicalProjectGeography | null): T[] {
  const rank: Record<GeographicEvidenceRole, number> = { START: 0, INTERMEDIATE: 1, END: 2,
    VERTEX: 0, POINT: 0, LEGACY_UNCLASSIFIED: 3, NONE: 4 };
  return [...items].sort((a: any, b: any) => {
    const roleA = geographicEvidenceRole(a), roleB = geographicEvidenceRole(b);
    const group = rank[roleA] - rank[roleB];
    if (group) return group;
    const orderA = geographicEvidenceOrder(a, geography), orderB = geographicEvidenceOrder(b, geography);
    if (orderA !== null || orderB !== null) {
      const sequence = (orderA ?? Infinity) - (orderB ?? Infinity);
      if (sequence) return sequence;
    }
    // Deterministic presentation only. This tie breaker is never stored as geographic order.
    return String(a.evidenceId || a.id || '').localeCompare(String(b.evidenceId || b.id || ''));
  });
}
export function geographicEvidenceTrace(item: any, geography?: CanonicalProjectGeography | null) {
  const role = geographicEvidenceRole(item);
  return { resourceId: item?.sourceDocumentId || item?.id, projectId: item?.projectId || item?.expedienteId,
    resourceType: item?.evidenceType || 'PHOTO', role, label: geographicRoleLabels[role][0],
    coordinates: geographicEvidenceCoordinates(item), order: geographicEvidenceOrder(item, geography),
    participatesInGeometry: role !== 'NONE' && role !== 'LEGACY_UNCLASSIFIED' && Boolean(item?.territorialRef),
    provenance: item?.lineage || item?.multimodalEvidence?.lineage || null };
}
export function photoResourceCollection(item: any): 'documents' | 'photos' {
  return item?.sourceDocumentId ? 'documents' : 'photos';
}

export function bindPhotoToTerritorialNode(draft: DraftProjectGeography, index: number | null) {
  const type = normalizeCanonicalGeographyType(draft.type);
  if (index !== null && (!Number.isInteger(index) || !draft.points[index])) throw new Error('PHOTO_NODE_NOT_IN_DRAFT');
  const role = index === null ? 'NONE' : type === 'CORRIDOR' ? corridorVertexRole(index, draft.points.length) : type === 'POLYGON' ? 'VERTEX' : 'POINT';
  const territorialRef: TerritorialEvidenceReference | null = index === null ? null : {
    geometryType: type === 'CORRIDOR' ? 'lineal' : type === 'POLYGON' ? 'poligono' : 'individual',
    nodeId: type === 'INDIVIDUAL' ? 'INDIVIDUAL' : `node-${index + 1}`,
    order: index + 1, role,
  } as TerritorialEvidenceReference;
  return { geometryRole: role, tipo: geographicRoleLabels[role][1], territorialRef };
}
