import type {
  AcquisitionMode,
  AcquisitionStatus,
  EpistemicIntegrityMetadata,
  IntelligenceSemanticRole,
} from "@/types/epistemicIntegrity";
import { classifyExternalFailure } from "@/utils/externalProviderError";

export type CifaSourceClassification =
  | "OBSERVED_REAL"
  | "AI_DERIVED"
  | "CONNECTIVITY_ONLY"
  | "NOT_CONFIGURED"
  | "UNAVAILABLE"
  | "LEGACY_DIAGNOSTIC";

export interface CifaSourceEnvelope<T = unknown> {
  sourceKey: string;
  sourceId: string;
  providerId: string;
  providerName: string;
  sourceType: string;
  classification: CifaSourceClassification;
  acquisitionMode: AcquisitionMode;
  acquisitionStatus: AcquisitionStatus;
  semanticRole: IntelligenceSemanticRole;
  validationStatus: "UNREVIEWED";
  isSimulated: false;
  authoritative: boolean;
  selectedForProductiveAcquisition: boolean;
  query: string;
  requestedAt: string;
  acquiredAt: string | null;
  durationMs: number;
  resultCount: number;
  sourceReference: string;
  sourceUrl: string | null;
  rawSourceReference: string | null;
  data: T;
  errorCode?: string;
  errorMessage?: string;
  sanitizedFailureReason?: string;
  providerErrorCode?: string;
  httpStatus?: number;
  nativeErrorCode?: string;
  nativeCauseCode?: string;
}

export interface CifaSourceDefinition<T = unknown> {
  sourceKey: string;
  sourceId: string;
  providerId: string;
  providerName: string;
  sourceType: string;
  classification: Exclude<CifaSourceClassification, "NOT_CONFIGURED" | "UNAVAILABLE" | "LEGACY_DIAGNOSTIC">;
  acquisitionMode: Extract<AcquisitionMode, "OBSERVED" | "AI_GENERATED" | "CONNECTIVITY_ONLY">;
  semanticRole: IntelligenceSemanticRole;
  authoritative?: boolean;
  sourceReference: string;
  sourceUrl?: string | null;
  rawSourceReference?: string | null;
  readiness?: () => { ready: boolean; status?: "NOT_CONFIGURED" | "UNAVAILABLE"; code?: string; message?: string };
  execute: () => Promise<T>;
  count?: (data: T) => number;
  failureCode?: string;
  failureMessage?: string;
}

function countResult(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (data === null || data === undefined || data === "") return 0;
  return 1;
}

function integrityFor<T>(envelope: CifaSourceEnvelope<T>): EpistemicIntegrityMetadata {
  return {
    sourceId: envelope.sourceId,
    providerId: envelope.providerId,
    providerName: envelope.providerName,
    sourceType: envelope.sourceType,
    acquisitionMode: envelope.acquisitionMode,
    acquisitionStatus: envelope.acquisitionStatus,
    semanticRole: envelope.semanticRole,
    validationStatus: envelope.validationStatus,
    isSimulated: false,
    isDerived: envelope.acquisitionMode === "AI_GENERATED",
    isConnectivityOnly: envelope.acquisitionMode === "CONNECTIVITY_ONLY",
    acquiredAt: envelope.acquiredAt,
    generatedAt: envelope.acquisitionMode === "AI_GENERATED" ? envelope.acquiredAt : null,
    observedAt: envelope.acquisitionMode === "OBSERVED" ? envelope.acquiredAt : null,
    sourceReference: envelope.sourceReference,
    sourceUrl: envelope.sourceUrl,
    rawSourceReference: envelope.rawSourceReference,
    query: envelope.query,
    resultCount: envelope.resultCount,
    lineage: [],
  };
}

function attachIntegrity<T>(data: T, envelope: CifaSourceEnvelope<T>): T {
  const decorate = (item: unknown) => {
    if (!item || typeof item !== "object") return item;
    return {
      ...(item as Record<string, unknown>),
      acquisitionMode: envelope.acquisitionMode,
      acquisitionStatus: envelope.acquisitionStatus,
      semanticRole: envelope.semanticRole,
      validationStatus: envelope.validationStatus,
      isSimulated: false,
      providerId: envelope.providerId,
      sourceId: envelope.sourceId,
      sourceReference: envelope.sourceReference,
      sourceUrl: envelope.sourceUrl,
      rawSourceReference: envelope.rawSourceReference,
      query: envelope.query,
      acquiredAt: envelope.acquiredAt,
      epistemicIntegrity: integrityFor(envelope),
    };
  };

  return (Array.isArray(data) ? data.map(decorate) : decorate(data)) as T;
}

export async function executeCifaSource<T>(
  definition: CifaSourceDefinition<T>,
  query: string
): Promise<CifaSourceEnvelope<T | []>> {
  const requestedAt = new Date().toISOString();
  const startedAt = Date.now();
  const readiness = definition.readiness?.() ?? { ready: true };

  if (!readiness.ready) {
    const unavailable = readiness.status === "UNAVAILABLE";
    return {
      sourceKey: definition.sourceKey,
      sourceId: definition.sourceId,
      providerId: definition.providerId,
      providerName: definition.providerName,
      sourceType: definition.sourceType,
      classification: unavailable ? "UNAVAILABLE" : "NOT_CONFIGURED",
      acquisitionMode: definition.acquisitionMode,
      acquisitionStatus: unavailable ? "UNAVAILABLE" : "NOT_CONFIGURED",
      semanticRole: definition.semanticRole,
      validationStatus: "UNREVIEWED",
      isSimulated: false,
      authoritative: Boolean(definition.authoritative),
      selectedForProductiveAcquisition: false,
      query,
      requestedAt,
      acquiredAt: null,
      durationMs: Date.now() - startedAt,
      resultCount: 0,
      sourceReference: definition.sourceReference,
      sourceUrl: definition.sourceUrl ?? null,
      rawSourceReference: definition.rawSourceReference ?? null,
      data: [],
      errorCode: readiness.code ?? (unavailable ? "SOURCE_UNAVAILABLE" : "SOURCE_NOT_CONFIGURED"),
      errorMessage: readiness.message ?? (unavailable ? "La fuente no está disponible." : "La fuente no está configurada."),
    };
  }

  try {
    const data = await definition.execute();
    const resultCount = definition.count?.(data) ?? countResult(data);
    const acquiredAt = new Date().toISOString();
    const envelope: CifaSourceEnvelope<T> = {
      sourceKey: definition.sourceKey,
      sourceId: definition.sourceId,
      providerId: definition.providerId,
      providerName: definition.providerName,
      sourceType: definition.sourceType,
      classification: definition.classification,
      acquisitionMode: definition.acquisitionMode,
      acquisitionStatus: resultCount > 0 ? "ACQUIRED" : "NO_DATA",
      semanticRole: definition.semanticRole,
      validationStatus: "UNREVIEWED",
      isSimulated: false,
      authoritative: Boolean(definition.authoritative),
      selectedForProductiveAcquisition: true,
      query,
      requestedAt,
      acquiredAt,
      durationMs: Date.now() - startedAt,
      resultCount,
      sourceReference: definition.sourceReference,
      sourceUrl: definition.sourceUrl ?? null,
      rawSourceReference: definition.rawSourceReference ?? null,
      data,
    };
    envelope.data = attachIntegrity(data, envelope);
    return envelope;
  } catch (error) {
    const failure = classifyExternalFailure(error).failure;
    return {
      sourceKey: definition.sourceKey,
      sourceId: definition.sourceId,
      providerId: definition.providerId,
      providerName: definition.providerName,
      sourceType: definition.sourceType,
      classification: definition.classification,
      acquisitionMode: definition.acquisitionMode,
      acquisitionStatus: "FAILED",
      semanticRole: definition.semanticRole,
      validationStatus: "UNREVIEWED",
      isSimulated: false,
      authoritative: Boolean(definition.authoritative),
      selectedForProductiveAcquisition: true,
      query,
      requestedAt,
      acquiredAt: null,
      durationMs: Date.now() - startedAt,
      resultCount: 0,
      sourceReference: definition.sourceReference,
      sourceUrl: definition.sourceUrl ?? null,
      rawSourceReference: definition.rawSourceReference ?? null,
      data: [],
      errorCode: definition.failureCode ?? "PROVIDER_REQUEST_FAILED",
      errorMessage: failure.reason === "UNKNOWN_FAILURE"
        ? definition.failureMessage ?? failure.message
        : failure.message,
      sanitizedFailureReason: failure.reason,
      providerErrorCode: failure.technicalCode,
      httpStatus: failure.httpStatus,
      nativeErrorCode: failure.nativeErrorCode,
      nativeCauseCode: failure.nativeCauseCode,
    };
  }
}

export async function executeCifaBatch(
  definitions: CifaSourceDefinition[],
  query: string
): Promise<CifaSourceEnvelope[]> {
  const settled = await Promise.allSettled(definitions.map((definition) => executeCifaSource(definition, query)));
  return settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const definition = definitions[index];
    return {
      sourceKey: definition.sourceKey,
      sourceId: definition.sourceId,
      providerId: definition.providerId,
      providerName: definition.providerName,
      sourceType: definition.sourceType,
      classification: definition.classification,
      acquisitionMode: definition.acquisitionMode,
      acquisitionStatus: "FAILED",
      semanticRole: definition.semanticRole,
      validationStatus: "UNREVIEWED",
      isSimulated: false,
      authoritative: Boolean(definition.authoritative),
      selectedForProductiveAcquisition: true,
      query,
      requestedAt: new Date().toISOString(),
      acquiredAt: null,
      durationMs: 0,
      resultCount: 0,
      sourceReference: definition.sourceReference,
      sourceUrl: definition.sourceUrl ?? null,
      rawSourceReference: definition.rawSourceReference ?? null,
      data: [],
      errorCode: "ORCHESTRATION_FAILURE",
      errorMessage: "La fuente falló fuera de su contrato de adquisición.",
      sanitizedFailureReason: "UNKNOWN_FAILURE",
      providerErrorCode: "ORCHESTRATION_FAILURE",
    };
  });
}
