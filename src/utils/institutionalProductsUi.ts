import type { ReportReadyAssessment, ReportReadyReason, ReportReadyStatus } from "@/utils/reportReadyGovernance";
import { buildEvidenceLineage, validateLineage } from "@/utils/evidenceLineage";

export const ADDITIONAL_PHOTO_EVIDENCE_TYPE = "ADDITIONAL_PHOTO" as const;
export const NON_GEOMETRIC_PHOTO_ROLE = "NONE" as const;

export function isImageEvidenceMimeType(value: unknown): boolean {
  return typeof value === "string" && /^image\//i.test(value.trim());
}

export function isAdditionalPhotoEvidence(item: any): boolean {
  return item?.evidenceType === ADDITIONAL_PHOTO_EVIDENCE_TYPE
    || (item?.geometryRole === NON_GEOMETRIC_PHOTO_ROLE && isImageEvidenceMimeType(
      item?.mimeType || item?.type || item?.multimodalEvidence?.mimeType
    ));
}

export function adaptDocumentToAdditionalPhotoEvidence(
  document: any,
  fallback: { projectId?: string | null; geographyId?: string | null; geographyType?: string | null } = {}
): any | null {
  const multimodal = document?.multimodalEvidence || {};
  const mimeType = document?.type || document?.mimeType || multimodal?.mimeType || "";
  if (!isImageEvidenceMimeType(mimeType)) return null;

  const evidenceId = document?.evidenceId || multimodal?.evidenceId || document?.id;
  const expedienteId = document?.expedienteId || document?.projectId || multimodal?.expedienteId || fallback.projectId || null;
  const geographyId = document?.geographyId ?? multimodal?.geographyId ?? fallback.geographyId ?? null;
  const geographyType = document?.geographyType ?? multimodal?.geographyType ?? fallback.geographyType ?? null;
  const sourceEvidenceId = document?.sourceEvidenceId || multimodal?.sourceEvidenceId || evidenceId;
  const lineage = document?.lineage || multimodal?.lineage || buildEvidenceLineage({
    sourceId: sourceEvidenceId,
    sourceReference: multimodal?.storageReference || document?.storagePath || document?.url || sourceEvidenceId,
    geographyId,
    geographyType,
    evidenceId,
  });
  const lineageStatus = document?.lineageStatus || multimodal?.lineageStatus || validateLineage(lineage).status;

  return {
    ...document,
    id: document.id,
    sourceDocumentId: document.id,
    previewUrl: document.url || "",
    lat: null,
    lng: null,
    coordinates: null,
    tipo: "Evidencia Fotográfica Adicional",
    comentario: document.context || "",
    evidenceType: ADDITIONAL_PHOTO_EVIDENCE_TYPE,
    geometryRole: NON_GEOMETRIC_PHOTO_ROLE,
    isGeometry: false,
    evidenceId,
    sourceEvidenceId,
    expedienteId,
    projectId: document?.projectId || expedienteId,
    geographyId,
    geographyType,
    traceabilityId: document?.traceabilityId || multimodal?.traceabilityId || `trace-additional-photo-${expedienteId || "unknown"}-${evidenceId}`,
    lineage,
    lineageStatus,
    storagePath: document?.storagePath || multimodal?.storageReference || null,
    mimeType,
    humanValidationStatus: document?.humanValidationStatus || multimodal?.humanValidationStatus || "PENDING_REVIEW",
    validationSource: document?.validationSource || multimodal?.validationSource || null,
    forensicIntegrity: document?.forensicIntegrity || multimodal?.forensicIntegrity || null,
    fuente: "Carga de Evidencia Adicional",
    multimodalEvidence: multimodal,
  };
}

function photographicIdentityKeys(item: any): string[] {
  const values = [
    item?.evidenceId || item?.multimodalEvidence?.evidenceId,
    item?.storagePath || item?.multimodalEvidence?.storageReference,
    item?.sourceDocumentId,
    item?.id,
  ];
  return Array.from(new Set(values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())));
}

export function mergeAdditionalPhotoEvidence(
  album: any[] = [],
  documents: any[] = [],
  fallback: { projectId?: string | null; geographyId?: string | null; geographyType?: string | null } = {}
): any[] {
  const result: any[] = [];
  const identityToIndex = new Map<string, number>();

  const add = (item: any, preferDocumentProjection = false) => {
    const keys = photographicIdentityKeys(item);
    const existingIndex = keys.map((key) => identityToIndex.get(key)).find((index) => index !== undefined);
    if (existingIndex !== undefined) {
      if (preferDocumentProjection && isAdditionalPhotoEvidence(result[existingIndex])) {
        result[existingIndex] = { ...result[existingIndex], ...item };
        photographicIdentityKeys(result[existingIndex]).forEach((key) => identityToIndex.set(key, existingIndex));
      }
      return;
    }
    const nextIndex = result.length;
    result.push(item);
    keys.forEach((key) => identityToIndex.set(key, nextIndex));
  };

  album.filter(Boolean).forEach((item) => add(item));
  documents
    .map((document) => adaptDocumentToAdditionalPhotoEvidence(document, fallback))
    .filter(Boolean)
    .forEach((item) => add(item, true));

  return result;
}

export type InstitutionalReportKind = "EXECUTIVE_GEOINT" | "EXECUTIVE_GEOINT_TECHNICAL_ANNEX";

export interface InstitutionalProductAction {
  label: string;
  reportKind: InstitutionalReportKind;
  disabled: boolean;
}

export interface InstitutionalProductsViewModel {
  numeroExpediente: string;
  hasInstitutionalIdentity: boolean;
  statusLabel: string;
  readyForInstitutionalReport: boolean;
  readinessChecks: Array<{ label: string; complete: boolean }>;
  pendingMessages: string[];
  actions: {
    executiveReport: InstitutionalProductAction;
    technicalAnnex: InstitutionalProductAction;
  };
}

export function buildInstitutionalProductExportOptions(reportKind: InstitutionalReportKind) {
  return { exportMode: "INSTITUTIONAL" as const, reportKind };
}

export function resolveInstitutionalNumeroExpediente(project: { numeroExpediente?: unknown } | null | undefined): string | null {
  const value = typeof project?.numeroExpediente === "string" ? project.numeroExpediente.trim() : "";
  if (!value || value.toUpperCase() === "NO ASIGNADO") return null;
  return value;
}

export function buildInstitutionalProductExportPayload(
  project: any,
  context: {
    projectId?: string;
    user?: any;
    editableProfile?: string;
    aiProfile?: string | null;
    reportSummary?: string;
    reportReadyAssessment: ReportReadyAssessment;
    album?: any[];
    documents?: any[];
    mapSnapshots?: any[];
    analysisResult?: any;
  }
) {
  const numeroExpediente = resolveInstitutionalNumeroExpediente(project);
  if (!numeroExpediente) throw new Error("INSTITUTIONAL_NUMERO_EXPEDIENTE_REQUIRED");
  const projectId = project?.projectId || project?.id || context.projectId;
  const photoEvidence = mergeAdditionalPhotoEvidence(
    [
      ...asArray(project?.photoEvidence),
      ...asArray(context.album),
    ],
    context.documents,
    {
      projectId,
      geographyId: project?.geographyId || project?.canonicalGeography?.geographyId || null,
      geographyType: project?.canonicalGeography?.type || null,
    }
  );
  return {
    ...(project || {}),
    projectId,
    expedienteId: project?.expedienteId || project?.id || context.projectId,
    nombre: project?.nombre,
    numeroExpediente,
    ceipolId: project?.ceipolId,
    fecha: project?.fecha || project?.date,
    date: project?.date || project?.fecha,
    classification: project?.classification || project?.clasificacion || "CONFIDENCIAL",
    personaPerfiladora: context.user?.username || context.user?.name || context.user?.email,
    analysisContent: context.editableProfile || context.aiProfile || project?.analysisContent || "",
    iaAnalysis: { ...(project?.iaAnalysis || {}), ...(context.analysisResult || {}) },
    briefing: context.editableProfile || context.aiProfile || project?.analysisContent || "",
    reportSummary: context.reportSummary,
    reportReadyAssessment: context.reportReadyAssessment,
    album: photoEvidence,
    photoEvidence,
    documents: context.documents || [],
    mapSnapshots: context.mapSnapshots || [],
    sweeps: project?.sweeps || [],
    canonicalGeography: project?.canonicalGeography,
    canonicalHypothesis: project?.canonicalHypothesis,
    humanHypothesis: project?.humanHypothesis,
    findings: project?.findings || context.analysisResult?.findings || [],
    analysisOutputs: project?.analysisOutputs || context.analysisResult?.analysisOutputs || [],
    conclusions: project?.conclusions || context.analysisResult?.conclusions || [],
    predictiveAnalyticalProducts: project?.predictiveAnalyticalProducts || [],
    traceabilityGate: project?.traceabilityGate,
  };
}

const STATUS_LABELS: Record<ReportReadyStatus, string> = {
  NOT_READY: "EXPEDIENTE NO HABILITADO PARA INFORME INSTITUCIONAL",
  READY_WITH_WARNINGS: "EXPEDIENTE HABILITADO CON OBSERVACIONES",
  REPORT_READY: "EXPEDIENTE HABILITADO PARA INFORME INSTITUCIONAL",
};

const REASON_LABELS: Record<string, string> = {
  GEOGRAPHY_INVALID_OR_MISSING: "Validar y confirmar la geografía territorial del expediente.",
  HYPOTHESIS_NOT_FORMULATED: "Formular o ratificar la hipótesis humana obligatoria.",
  VALID_EVIDENCE_MISSING: "Incorporar al menos una evidencia utilizable.",
  VALID_FINDING_MISSING: "Incorporar y validar al menos un hallazgo trazable.",
  SUPPORTED_ANALYSIS_MISSING: "Incorporar al menos un análisis soportado y revisado.",
  MANDATORY_HUMAN_REVIEW_PENDING: "Completar la revisión humana obligatoria.",
  REPORT_LINEAGE_UNRESOLVED: "Resolver la trazabilidad de los elementos utilizados en el informe.",
  TRACEABILITY_GATE_REQUIRED: "Resolver la trazabilidad institucional antes de emitir el informe.",
  AI_ANALYSIS_PENDING_HUMAN_REVIEW: "Completar la revisión humana del análisis asistido.",
  ANALYSIS_UNSUPPORTED_OR_UNTRACEABLE: "Vincular el análisis con evidencia y trazabilidad verificable.",
  FINDING_UNSUPPORTED_OR_UNTRACEABLE: "Vincular los elementos analíticos con evidencia verificable.",
  CRITICAL_EVIDENCE_INTEGRITY_FAILURE: "Resolver la integridad documental de evidencia crítica.",
  UNTRUSTED_SOURCE_USED_AS_AUTHORITATIVE: "Sustituir o justificar la fuente no autorizada usada como soporte institucional.",
  FAILED_SWEEP_USED_AS_REPORT_SUPPORT: "Revisar el barrido utilizado como soporte antes de emitir el informe.",
  INSTITUTIONAL_REPORT_INPUT_REQUIRED: "Completar el expediente institucional antes de emitir el informe.",
};

export function translateInstitutionalReadinessStatus(status: ReportReadyStatus): string {
  return STATUS_LABELS[status];
}

export function translateInstitutionalReadinessReason(code: string): string {
  return REASON_LABELS[code] || "Completar el requisito institucional pendiente.";
}

export function collectInstitutionalReadinessMessages(assessment: Pick<ReportReadyAssessment, "blockingReasons" | "unresolvedItems">): string[] {
  const reasons = [
    ...(Array.isArray(assessment.blockingReasons) ? assessment.blockingReasons : []),
    ...(Array.isArray(assessment.unresolvedItems) ? assessment.unresolvedItems : []),
  ];
  const messages = new Map<string, string>();
  for (const reason of reasons) {
    const code = typeof reason === "string" ? reason : (reason as ReportReadyReason)?.code;
    const message = translateInstitutionalReadinessReason(code);
    if (!messages.has(message)) messages.set(message, message);
  }
  return [...messages.values()];
}

export function shouldShowInstitutionalAnalysisCreationTrigger(
  assessment: Pick<ReportReadyAssessment, "evidenceReady" | "findingsReady" | "analysisReady">,
  options: { candidateCount: number; acceptedCount?: number; isReadOnly?: boolean }
): boolean {
  return options.isReadOnly !== true
    && (options.acceptedCount ?? options.candidateCount) === 0
    && assessment.evidenceReady === true
    && assessment.findingsReady === true
    && assessment.analysisReady === false;
}

function uniqueNonEmpty(values: Array<unknown>): string[] {
  return Array.from(new Set(values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())));
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function analysisReferenceItems(input: {
  project?: any;
  album?: any[];
  documents?: any[];
  analysisResult?: any;
}): any[] {
  const project = input.project || {};
  return [
    ...asArray(project.evidence),
    ...asArray(project.evidences),
    ...asArray(project.photoEvidence),
    ...asArray(project.album),
    ...asArray(input.album),
    ...asArray(input.documents),
    ...asArray(project.findings),
    ...asArray(project.approvedFindings),
    ...asArray(project.streetViewAnalysis),
    ...asArray(input.analysisResult?.findings),
    project.canonicalHypothesis,
    project.hypothesisLifecycle,
  ].filter(Boolean);
}

function canonicalFindingItems(input: {
  project?: any;
  analysisResult?: any;
}): any[] {
  const project = input.project || {};
  return [
    ...asArray(project.findings),
    ...asArray(project.approvedFindings),
    ...asArray(project.approvedFindingRefs),
    ...asArray(project.streetViewFindingRefs),
    ...asArray(project.streetViewAnalysis).filter((item: any) => item?.findingId || item?.usedInReport),
    ...asArray(input.analysisResult?.findings),
  ].filter((item: any) => item && item?.usedInReport !== false);
}

function findingReferenceValues(item: any): unknown[] {
  return [
    item?.findingId,
    item?.id,
    item?.traceabilityId,
    ...asArray(item?.findingIds),
    ...asArray(item?.supportingFindingIds),
    ...asArray(item?.supportingFindings).flatMap((finding: any) => [
      typeof finding === "string" ? finding : null,
      finding?.findingId,
      finding?.id,
      finding?.traceabilityId,
    ]),
    ...asArray(item?.outputFindingIds),
    ...asArray(item?.lineage).map((node: any) => node?.findingId),
    ...asArray(item?.evidenceLineage).map((node: any) => node?.findingId),
    ...asArray(item?.multimodalEvidence?.lineage).map((node: any) => node?.findingId),
  ];
}

export function collectInstitutionalAnalysisEvidenceIds(input: {
  project?: any;
  album?: any[];
  documents?: any[];
  analysisResult?: any;
}): string[] {
  return uniqueNonEmpty(analysisReferenceItems(input).flatMap((item: any) => [
    item?.evidenceId,
    item?.id,
    item?.multimodalEvidence?.evidenceId,
    ...asArray(item?.evidenceIds),
    ...asArray(item?.supportingEvidenceIds),
    ...asArray(item?.evidenciaConfirmatoria),
    ...asArray(item?.lineage).map((node: any) => node?.evidenceId),
    ...asArray(item?.evidenceLineage).map((node: any) => node?.evidenceId),
    ...asArray(item?.multimodalEvidence?.lineage).map((node: any) => node?.evidenceId),
  ]));
}

export function collectInstitutionalAnalysisFindingIds(input: {
  project?: any;
  analysisResult?: any;
}): string[] {
  return uniqueNonEmpty([
    ...canonicalFindingItems(input).flatMap(findingReferenceValues),
    ...[input.project?.canonicalHypothesis, input.project?.hypothesisLifecycle].filter(Boolean).flatMap(findingReferenceValues),
  ]);
}

export function buildInstitutionalProductsViewModel(
  assessment: ReportReadyAssessment,
  projectOrNumeroExpediente: { numeroExpediente?: unknown } | string | null | undefined
): InstitutionalProductsViewModel {
  const institutionalNumero = typeof projectOrNumeroExpediente === "string"
    ? resolveInstitutionalNumeroExpediente({ numeroExpediente: projectOrNumeroExpediente })
    : resolveInstitutionalNumeroExpediente(projectOrNumeroExpediente);
  const hasInstitutionalIdentity = Boolean(institutionalNumero);
  const disabled = assessment.readyForInstitutionalReport !== true || !hasInstitutionalIdentity;
  const pendingMessages = collectInstitutionalReadinessMessages(assessment);
  if (!hasInstitutionalIdentity) {
    pendingMessages.unshift("El expediente no cuenta con número institucional asignado.");
  }
  return {
    numeroExpediente: institutionalNumero || "Identidad institucional pendiente",
    hasInstitutionalIdentity,
    statusLabel: translateInstitutionalReadinessStatus(assessment.status),
    readyForInstitutionalReport: assessment.readyForInstitutionalReport === true && hasInstitutionalIdentity,
    readinessChecks: [
      { label: "Identidad institucional", complete: hasInstitutionalIdentity },
      { label: "Geografía territorial", complete: assessment.geographyReady },
      { label: "Hipótesis humana", complete: assessment.hypothesisReady },
      { label: "Evidencia admisible", complete: assessment.evidenceReady },
      { label: "Hallazgos", complete: assessment.findingsReady },
      { label: "Análisis validado", complete: assessment.analysisReady },
      { label: "Trazabilidad", complete: assessment.lineageReady },
      { label: "Revisión humana", complete: assessment.humanValidationReady },
      { label: "Integridad forense", complete: assessment.forensicIntegrityReady },
      { label: "Integridad de fuente", complete: assessment.sourceIntegrityReady },
    ],
    pendingMessages,
    actions: {
      executiveReport: {
        label: "GENERAR INFORME",
        reportKind: "EXECUTIVE_GEOINT",
        disabled,
      },
      technicalAnnex: {
        label: "Anexo tecnico interno",
        reportKind: "EXECUTIVE_GEOINT_TECHNICAL_ANNEX",
        disabled,
      },
    },
  };
}
