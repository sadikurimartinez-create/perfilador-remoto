import type { ReportReadyAssessment, ReportReadyReason, ReportReadyStatus } from "@/utils/reportReadyGovernance";

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
  return {
    ...(project || {}),
    projectId: project?.projectId || project?.id || context.projectId,
    expedienteId: project?.expedienteId || project?.id || context.projectId,
    nombre: project?.nombre,
    numeroExpediente,
    ceipolId: project?.ceipolId,
    fecha: project?.fecha || project?.date,
    date: project?.date || project?.fecha,
    classification: project?.classification || project?.clasificacion || "CONFIDENCIAL",
    personaPerfiladora: context.user?.username || context.user?.name || context.user?.email,
    analysisContent: context.editableProfile || context.aiProfile || project?.analysisContent || "",
    briefing: context.editableProfile || context.aiProfile || project?.analysisContent || "",
    reportSummary: context.reportSummary,
    reportReadyAssessment: context.reportReadyAssessment,
    album: context.album || [],
    photoEvidence: project?.photoEvidence || context.album || [],
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
      { label: "Análisis validado", complete: assessment.analysisReady },
      { label: "Trazabilidad", complete: assessment.lineageReady },
      { label: "Revisión humana", complete: assessment.humanValidationReady },
    ],
    pendingMessages,
    actions: {
      executiveReport: {
        label: "Generar Informe Ejecutivo GEOINT",
        reportKind: "EXECUTIVE_GEOINT",
        disabled,
      },
      technicalAnnex: {
        label: "Generar Anexo Técnico",
        reportKind: "EXECUTIVE_GEOINT_TECHNICAL_ANNEX",
        disabled,
      },
    },
  };
}
