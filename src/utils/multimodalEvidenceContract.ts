import type { EpistemicIntegrityMetadata } from "@/types/epistemicIntegrity";
import type { ForensicFileIntegrity } from "@/utils/forensicFileIntegrity";

export type MultimodalIngestionSource =
  | "USER_UPLOAD"
  | "CAMERA_CAPTURE"
  | "STREET_VIEW"
  | "GOOGLE_DRIVE"
  | "EXTERNAL_SOURCE";

export type MultimodalIngestionStatus =
  | "FILE_RECEIVED"
  | "IDENTIFIED"
  | "STORED_RAW"
  | "TECHNICALLY_PROCESSED";

export type MultimodalExtractionStatus =
  | "EXTRACTION_PENDING"
  | "EXTRACTED"
  | "STORED_ONLY"
  | "UNSUPPORTED_FOR_EXTRACTION"
  | "EXTRACTION_NOT_IMPLEMENTED";

export type MultimodalAnalysisStatus =
  | "NOT_ANALYZED"
  | "AI_ANALYZED"
  | "READY_FOR_HUMAN_REVIEW"
  | "ANALYSIS_FAILED";

export type MultimodalHumanValidationStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface MultimodalEvidenceContract {
  evidenceId: string;
  expedienteId: string;
  documentId?: string | null;
  fileId?: string | null;
  checksum?: string | null;
  fileName: string;
  mimeType: string;
  size: number | null;
  storageReference: string | null;
  ingestionSource: MultimodalIngestionSource;
  ingestionStatus: MultimodalIngestionStatus;
  extractionStatus: MultimodalExtractionStatus;
  analysisStatus: MultimodalAnalysisStatus;
  humanValidationStatus: MultimodalHumanValidationStatus;
  epistemicIntegrity?: Partial<EpistemicIntegrityMetadata> | null;
  traceabilityId?: string | null;
  rawContentReference: string | null;
  extractedContentReference?: string | null;
  derivedIntelligenceReference?: string | null;
  contextSemantics?: Array<"FILE_METADATA" | "ANALYST_CONTEXT" | "EXTRACTED_CONTENT">;
  aiQualityScore?: number | null;
  validatedAt?: string | null;
  validatedBy?: {
    id?: string | number | null;
    username?: string | null;
    name?: string | null;
  } | null;
  forensicIntegrity?: ForensicFileIntegrity | null;
}

const EXTRACTABLE_MIME_PREFIXES = ["text/", "image/"];
const EXTRACTABLE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

export function isSupportedForExtraction(mimeType: string): boolean {
  return EXTRACTABLE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) || EXTRACTABLE_MIME_TYPES.has(mimeType);
}

export function createStoredRawMultimodalEvidence(input: {
  evidenceId: string;
  expedienteId: string;
  documentId?: string | null;
  fileId?: string | null;
  checksum?: string | null;
  fileName: string;
  mimeType: string;
  size?: number | string | null;
  storageReference: string;
  ingestionSource: MultimodalIngestionSource;
  traceabilityId?: string | null;
  analystContext?: string | null;
  forensicIntegrity?: ForensicFileIntegrity | null;
}): MultimodalEvidenceContract {
  const size = typeof input.size === "string" ? Number(input.size) : input.size ?? null;
  const supported = isSupportedForExtraction(input.mimeType);

  return {
    evidenceId: input.evidenceId,
    expedienteId: input.expedienteId,
    documentId: input.documentId ?? null,
    fileId: input.fileId ?? null,
    checksum: input.checksum ?? null,
    fileName: input.fileName,
    mimeType: input.mimeType || "unknown",
    size: Number.isFinite(size) ? Number(size) : null,
    storageReference: input.storageReference,
    ingestionSource: input.ingestionSource,
    ingestionStatus: "STORED_RAW",
    extractionStatus: supported ? "EXTRACTION_PENDING" : "UNSUPPORTED_FOR_EXTRACTION",
    analysisStatus: "NOT_ANALYZED",
    humanValidationStatus: "PENDING_REVIEW",
    traceabilityId: input.traceabilityId ?? null,
    rawContentReference: input.storageReference,
    extractedContentReference: null,
    derivedIntelligenceReference: null,
    contextSemantics: input.analystContext ? ["FILE_METADATA", "ANALYST_CONTEXT"] : ["FILE_METADATA"],
    aiQualityScore: null,
    validatedAt: null,
    validatedBy: null,
    forensicIntegrity: input.forensicIntegrity ?? null,
  };
}

export function markExtracted(
  evidence: MultimodalEvidenceContract,
  extractedContentReference: string
): MultimodalEvidenceContract {
  return {
    ...evidence,
    extractionStatus: "EXTRACTED",
    extractedContentReference,
    humanValidationStatus: "PENDING_REVIEW",
  };
}

export function markAiAnalyzed(
  evidence: MultimodalEvidenceContract,
  derivedIntelligenceReference: string,
  aiQualityScore?: number | null
): MultimodalEvidenceContract {
  return {
    ...evidence,
    ingestionStatus: "TECHNICALLY_PROCESSED",
    analysisStatus: "AI_ANALYZED",
    humanValidationStatus: "PENDING_REVIEW",
    derivedIntelligenceReference,
    aiQualityScore: aiQualityScore ?? null,
  };
}

export function markReadyForHumanReview(
  evidence: MultimodalEvidenceContract,
  aiQualityScore?: number | null
): MultimodalEvidenceContract {
  return {
    ...evidence,
    analysisStatus: "READY_FOR_HUMAN_REVIEW",
    humanValidationStatus: "PENDING_REVIEW",
    aiQualityScore: aiQualityScore ?? evidence.aiQualityScore ?? null,
  };
}

export function markHumanApproved(
  evidence: MultimodalEvidenceContract,
  validation?: {
    validatedAt?: string | null;
    validatedBy?: MultimodalEvidenceContract["validatedBy"];
  }
): MultimodalEvidenceContract {
  return {
    ...evidence,
    humanValidationStatus: "APPROVED",
    validatedAt: validation?.validatedAt ?? new Date().toISOString(),
    validatedBy: validation?.validatedBy ?? null,
  };
}
