import type { CifaSourceEnvelope } from "@/utils/cifaAcquisition";
import { canonicalizeDenuePoisForInstitutionalAnalysis, type DenueCanonicalPoi } from "@/utils/denueCanonicalPoi";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import type { CrimeIncidenceExportContract } from "@/types/crimeIncidenceExportContract";
import { makeFirestoreSafe } from "@/utils/firestoreSafe";
import { canonicalizeCifaUrl } from "@/utils/cifaMultisourceDeduplication";

export type PersistedDenuePoi = Omit<DenueCanonicalPoi, "raw"> & { distanceMeters: number | null };

export function prepareDenuePoisForProject(
  data: unknown,
  options: { expedienteId: string; canonicalGeography: CanonicalProjectGeography | null | undefined; radiusMeters: number }
): PersistedDenuePoi[] {
  if (data && !Array.isArray(data) && typeof data === "object") {
    const response = data as Record<string, any>;
    if (response.exito === false || (response.denueStatus && response.denueStatus !== "SUCCESS") ||
      (response.epistemicIntegrity?.acquisitionStatus && response.epistemicIntegrity.acquisitionStatus !== "ACQUIRED")) return [];
  }
  return canonicalizeDenuePoisForInstitutionalAnalysis(data, options).institutionalPois.map(({ raw, ...poi }) => {
    const distance = Number(raw.distancia_m ?? raw.distanceMeters);
    return makeFirestoreSafe({
      ...poi,
      distanceMeters: Number.isFinite(distance) && distance >= 0 ? distance : null,
    });
  });
}

export function mergeStructuredRecords<T>(
  existing: unknown, incoming: T[], key: (item: T) => string,
  merge: (previous: T, next: T) => T = (_previous, next) => next
): T[] {
  const records = Array.isArray(existing) ? [...existing] as T[] : [];
  const index = new Map<string, number>();
  records.forEach((item, position) => {
    const id = item ? key(item) : "";
    if (id) index.set(id, position);
  });
  for (const item of incoming) {
    const id = key(item);
    if (!id) continue;
    const position = index.get(id);
    if (position === undefined) {
      index.set(id, records.length);
      records.push(item);
    } else {
      records[position] = merge(records[position], item);
    }
  }
  return records;
}

export interface PersistedCifaFinding {
  id: string;
  providerId: string;
  providerName: string;
  sourceType: string;
  sourceReference: string;
  sourceUrl: string | null;
  query: string;
  requestedAt: string;
  observedAt: string;
  acquiredAt: string;
  acquisitionMode: "OBSERVED";
  acquisitionStatus: "ACQUIRED";
  semanticRole: "SOURCE_FACT";
  isSimulated: false;
  title?: string;
  snippet?: string;
  text?: string;
  publishedAt?: string;
  provenance: Record<string, unknown>;
  sourceObservations: Array<Record<string, unknown>>;
  epistemicIntegrity: Record<string, unknown>;
}

export function mergeCifaFindingObservations(previous: PersistedCifaFinding, next: PersistedCifaFinding): PersistedCifaFinding {
  const observations = [...(previous.sourceObservations || [])];
  for (const item of next.sourceObservations) {
    if (!observations.some((saved) => saved.providerId === item.providerId && saved.sourceUrl === item.sourceUrl)) {
      observations.push(item);
    }
  }
  return { ...next, sourceObservations: observations };
}

function observedRecords(data: unknown): Record<string, unknown>[] {
  const value = Array.isArray(data) ? data :
    data && typeof data === "object" ? (data as Record<string, unknown>).resultadosWeb ?? (data as Record<string, unknown>).results : null;
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> =>
    Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function prepareCifaFindingsForProject(sources: CifaSourceEnvelope[]): PersistedCifaFinding[] {
  const findings: PersistedCifaFinding[] = [];
  const byId = new Map<string, PersistedCifaFinding>();
  for (const source of sources) {
    if (source.acquisitionMode !== "OBSERVED" || source.acquisitionStatus !== "ACQUIRED" ||
      source.semanticRole !== "SOURCE_FACT" || source.isSimulated !== false || source.applicable === false ||
      source.sourceKey === "apis_gubernamentales" || !source.acquiredAt) continue;
    for (const record of observedRecords(source.data)) {
      const integrity = record.epistemicIntegrity as Record<string, unknown> | undefined;
      if (record.isSimulated === true || record.acquisitionMode === "AI_GENERATED" ||
        (record.acquisitionStatus && record.acquisitionStatus !== "ACQUIRED") ||
        integrity?.acquisitionMode === "AI_GENERATED" || integrity?.isSimulated === true ||
        (integrity?.acquisitionStatus && integrity.acquisitionStatus !== "ACQUIRED") ||
        (integrity?.semanticRole && integrity.semanticRole !== "SOURCE_FACT")) continue;
      const title = stringField(record.title ?? record.titular);
      const snippet = stringField(record.snippet);
      const content = stringField(record.text ?? record.content ?? record.description);
      if (!title && !snippet && !content) continue;
      const directUrl = stringField(record.link ?? record.url ?? record.permalink);
      const sourceUrl = directUrl ?? stringField(record.sourceUrl) ?? source.sourceUrl;
      const nativeId = stringField(record.id ?? record.sourceEvidenceId ?? record.traceabilityId);
      const id = directUrl ? `url:${canonicalizeCifaUrl(directUrl) || directUrl}` :
        `${source.providerId}:${nativeId || `${title || ""}|${content || snippet || ""}`}`;
      const observedAt = stringField(record.observedAt) ?? source.acquiredAt;
      const sourceObservation = makeFirestoreSafe({
        providerId: source.providerId, providerName: source.providerName,
        sourceType: source.sourceType, sourceReference: source.sourceReference,
        sourceUrl: sourceUrl ?? null, query: source.query,
        observedAt, acquiredAt: source.acquiredAt,
      });
      const previous = byId.get(id);
      if (previous) {
        if (!previous.sourceObservations.some((item) => item.providerId === source.providerId && item.sourceUrl === sourceUrl)) {
          previous.sourceObservations.push(sourceObservation);
        }
        continue;
      }
      const finding = makeFirestoreSafe({
        id, providerId: source.providerId, providerName: source.providerName,
        sourceType: source.sourceType, sourceReference: source.sourceReference,
        sourceUrl: sourceUrl ?? null, query: source.query, requestedAt: source.requestedAt,
        observedAt, acquiredAt: source.acquiredAt, acquisitionMode: "OBSERVED" as const,
        acquisitionStatus: "ACQUIRED" as const, semanticRole: "SOURCE_FACT" as const,
        isSimulated: false as const, title, snippet, text: content,
        publishedAt: stringField(record.publishedAt ?? record.date),
        provenance: {
          providerId: source.providerId, providerName: source.providerName,
          sourceId: source.sourceId, sourceReference: source.sourceReference,
          rawSourceReference: source.rawSourceReference, sourceUrl: sourceUrl ?? null,
          query: source.query, requestedAt: source.requestedAt, acquiredAt: source.acquiredAt,
        },
        sourceObservations: [sourceObservation],
        epistemicIntegrity: {
          sourceId: source.sourceId, providerId: source.providerId, providerName: source.providerName,
          sourceType: source.sourceType, acquisitionMode: "OBSERVED", acquisitionStatus: "ACQUIRED",
          semanticRole: "SOURCE_FACT", validationStatus: "UNREVIEWED", isSimulated: false,
          observedAt, acquiredAt: source.acquiredAt, sourceReference: source.sourceReference,
          rawSourceReference: source.rawSourceReference, sourceUrl: sourceUrl ?? null, query: source.query,
        },
      });
      findings.push(finding);
      byId.set(id, finding);
    }
  }
  return findings;
}

// The report needs a descriptive snapshot, not raw incident arrays or a live workspace object graph.
export function prepareCrimeIncidenceContractForProject(contract: CrimeIncidenceExportContract) {
  if (contract.productClassification !== "DESCRIPTIVE_ANALYTICAL_PRODUCT" ||
    contract.analyticalLevel !== "DESCRIPTIVE" || contract.queryReference.status !== "EXECUTED" ||
    contract.queryReference.admission.accepted !== true || !contract.datasetReference.datasetId ||
    !Number.isFinite(contract.projectionReference.metrics.frequency.totalRecords) ||
    contract.projectionReference.metrics.frequency.totalRecords < 0) return null;
  return makeFirestoreSafe({
    exportId: contract.exportId,
    expedienteId: contract.expedienteId,
    productClassification: contract.productClassification,
    analyticalLevel: contract.analyticalLevel,
    createdAtReference: contract.createdAtReference,
    limitations: contract.limitations,
    datasetReference: {
      datasetId: contract.datasetReference.datasetId,
      coverage: { temporal: contract.datasetReference.coverage?.temporal ?? null },
    },
    queryReference: {
      status: contract.queryReference.status,
      admission: { accepted: contract.queryReference.admission.accepted },
    },
    projectionReference: {
      metrics: { frequency: { totalRecords: contract.projectionReference.metrics.frequency.totalRecords } },
    },
  });
}
