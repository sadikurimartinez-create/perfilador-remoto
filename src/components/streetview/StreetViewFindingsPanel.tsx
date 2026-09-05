"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  adaptStreetViewFindingToGeoEvidence,
  adaptSweepPayloadToGeoEvidence,
} from "@/utils/geoResolver";
import {
  GeointGovernanceStatus,
  GeointGovernanceStatusValue,
  normalizeGeointGovernanceStatus,
} from "@/types/geointGovernance";
import type { CanonicalLineageNode, LineageStatus } from "@/utils/evidenceLineage";
import { buildStreetViewFindingLineage, validateLineage } from "@/utils/evidenceLineage";
import type { AiAnalyticalOutput } from "@/utils/aiAnalysisGovernance";
import {
  approveGoogleCandidateFinding,
  rejectGoogleCandidateFinding,
  type GoogleCandidateFinding,
  type GoogleIntelligenceEvidence,
} from "@/utils/googleIntelligenceContract";

export interface AnalyticalFinding {
  findingId: string;
  projectId: string;
  sourceType: string;
  sourceEvidenceId?: string;
  lineage?: CanonicalLineageNode[];
  lineageStatus?: LineageStatus;
  geometry: {
    lat: number;
    lng: number;
    heading?: number;
    pitch?: number;
    fov?: number;
  };
  imageReference: string;
  generatedBy: string;
  createdAt: string;
  status: GeointGovernanceStatusValue;
}

export interface ApprovedEvidence {
  evidenceId: string;
  projectId: string;
  originalFindingId: string;
  validatedBy: string | null;
  validatorRole: string;
  validationDate: string;
  validationComment: string;
  status: GeointGovernanceStatus.APPROVED_EVIDENCE;
  geometry?: {
    lat: number;
    lng: number;
    heading?: number;
    pitch?: number;
  };
  imageReference?: string;
  sourceEvidenceId?: string;
  lineage?: CanonicalLineageNode[];
  lineageStatus?: LineageStatus;
}

export interface StreetViewFinding {
  id: string;
  expedienteId: string;
  traceabilityId?: string;
  sourceEvidenceId?: string;
  evidenciaId?: string;
  captureId?: string;
  categoria: "pendiente_clasificacion" | "COMPARACION_TEMPORAL" | "ACECHO_ESCONDITE" | "GRAFFITI_PANDILLA" | "DENUE_POI" | "OSINT_GENERAL" | "acecho" | "graffiti" | "denue" | "sin_hallazgo" | "RUTA_ACCESO" | "PUNTO_ACECHO";
  coordenadas: {
    lat: number | null;
    lng: number | null;
  };
  geolocationIntegrity?: any;
  imagen?: string;
  heading?: number;
  pitch?: number;
  fov?: number;
  estado?: GeointGovernanceStatusValue;
  descripcion?: string;
  observaciones_visual?: string;
  fechaCreacion?: string;
  usuarioRevision?: string | null;
  origenRevision?: "BARRIDO_AUTOMATICO" | "MANUAL";
  supportingEvidenceIds?: string[];
  lineage?: CanonicalLineageNode[];
  lineageStatus?: LineageStatus;
  geographyId?: string | null;
  aiAnalyticalOutput?: AiAnalyticalOutput | null;
  googleIntelligenceEvidence?: GoogleIntelligenceEvidence | null;
  googleCandidateFinding?: GoogleCandidateFinding | null;
  candidateType?: GoogleCandidateFinding["candidateType"];
  observableFactors?: string[];
  explanation?: string;
  confidence?: GoogleCandidateFinding["confidence"];
  confidenceBasis?: string;
  limitations?: string[];
}

interface StreetViewFindingsPanelProps {
  expedienteId: string;
  captures?: any[]; // Capturas automáticas / analyticalFindings
  onCaptureStatusChange?: (captureId: string, status: GeointGovernanceStatusValue) => void;
  onFindingCreated?: (finding: any) => void;
  validatorId?: string;
  validatorRole?: string;
  onTriggerTemporalComparison?: (candidate?: any) => void;
}

function getGoogleCandidateFinding(capture: any): GoogleCandidateFinding | null {
  return capture?.googleCandidateFinding || capture?.metadata?.googleCandidateFinding || null;
}

function getGoogleEvidence(capture: any): GoogleIntelligenceEvidence | null {
  return capture?.googleIntelligenceEvidence || capture?.metadata?.googleIntelligenceEvidence || null;
}

function getCandidateDisplay(capture: any) {
  const candidate = getGoogleCandidateFinding(capture);
  const evidence = getGoogleEvidence(capture);
  const streetViewDate =
    evidence?.metadata?.streetView?.captureDate ||
    evidence?.observedAt ||
    capture?.streetViewMetadata?.captureDate ||
    capture?.captureDate ||
    null;
  return {
    candidate,
    evidence,
    candidateType: candidate?.candidateType || capture?.candidateType || capture?.categoria_exploracion || capture?.categoria || "TACTICAL_OBSERVATION_POINT",
    explanation: candidate?.explanation || capture?.explanation || capture?.comentario || capture?.descripcion || "",
    observableFactors: candidate?.observableFactors || capture?.observableFactors || [],
    confidence: candidate?.confidence ?? capture?.confidence ?? "UNKNOWN",
    confidenceBasis: candidate?.confidenceBasis || capture?.confidenceBasis || "Base de confianza no disponible.",
    limitations: candidate?.limitations || capture?.limitations || [],
    streetViewDate,
  };
}

export function StreetViewFindingsPanel({
  expedienteId,
  captures = [],
  onCaptureStatusChange,
  onFindingCreated,
  validatorId,
  validatorRole = "ANALISTA_GEOINT_SUPERVISOR",
  onTriggerTemporalComparison,
}: StreetViewFindingsPanelProps) {
  const [selectedCapture, setSelectedCapture] = useState<any | null>(null);
  const [validationComment, setValidationComment] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingCaptures, setPendingCaptures] = useState<any[]>([]);
  const [governedFindings, setGovernedFindings] = useState<StreetViewFinding[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // 1. Cargar hallazgos gobernados desde la API interna Next.js (ADR-019.5)
    if (expedienteId) {
      fetch(`/api/expedientes/${expedienteId}/streetview/findings`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const items = Array.isArray(data) ? data : (data?.findings || []);
          if (Array.isArray(items)) {
            setGovernedFindings(items);
          }
        })
        .catch((err) => console.warn("[StreetViewFindingsPanel] Error cargando db.streetview_findings:", err));
    }

    // 2. Filtrar únicamente hallazgos analíticos pendientes de revisión (ADR-016)
    const filtered = (captures || []).filter(
      (c) =>
        (c.tipo_origen === "STREETVIEW_AUTOMATICO" || c.sourceType === "STREETVIEW_AUTOMATICO" || !c.tipo_origen) &&
        (normalizeGeointGovernanceStatus(c.estado_revision || c.status) === GeointGovernanceStatus.PENDING_REVIEW)
    );
    setPendingCaptures(filtered);
  }, [expedienteId, captures]);

  const handleSelect = (capture: any) => {
    setSelectedCapture(capture);
    setValidationComment(capture.descripcion || capture.validationComment || "");
    setErrorMessage(null);
  };

  const handleApprove = async () => {
    if (!selectedCapture) return;

    // Validación obligatoria de comentario (ADR-016)
    if (!validationComment || validationComment.trim().length === 0) {
      setErrorMessage("⚠️ El comentario de validación es OBLIGATORIO para promover el hallazgo a evidencia probatoria.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const lat = selectedCapture.latitude || selectedCapture.lat || selectedCapture.geometry?.lat || 0;
    const lng = selectedCapture.longitude || selectedCapture.lng || selectedCapture.geometry?.lng || 0;
    const captureId = selectedCapture.id || selectedCapture.findingId || selectedCapture.hash_md5 || selectedCapture.filename || `find-${Date.now()}`;
    const sourceEvidenceId = selectedCapture.sourceEvidenceId || selectedCapture.evidenceId || selectedCapture.evidenciaId || selectedCapture.captureId || null;
    const candidate = getGoogleCandidateFinding(selectedCapture);
    const approvedCandidate = candidate
      ? approveGoogleCandidateFinding(candidate, {
          validatedBy: validatorId ? { id: validatorId, role: validatorRole } : null,
          validatedAt: new Date().toISOString(),
        })
      : null;
    const lineage = buildStreetViewFindingLineage({
      findingId: captureId,
      evidenceId: sourceEvidenceId,
      sourceReference: selectedCapture.panoId || selectedCapture.sourceReference || selectedCapture.imageReference || selectedCapture.file_url,
    });
    const lineageValidation = validateLineage(lineage);

    // Construcción de la nueva entidad approvedEvidence (ADR-016)
    const approvedEvidence: ApprovedEvidence = {
      evidenceId: `evi-approved-${Date.now()}`,
      projectId: expedienteId,
      originalFindingId: captureId,
      sourceEvidenceId,
      validatedBy: validatorId || null,
      validatorRole: validatorRole,
      validationDate: new Date().toISOString(),
      validationComment: validationComment.trim(),
      status: GeointGovernanceStatus.APPROVED_EVIDENCE,
      geometry: {
        lat,
        lng,
        heading: selectedCapture.geolocalizacion?.heading || selectedCapture.heading || 0,
        pitch: selectedCapture.geolocalizacion?.pitch || selectedCapture.pitch || 0
      },
      imageReference: selectedCapture.file_url || selectedCapture.archivo_url || selectedCapture.imageReference || "",
      lineage,
      lineageStatus: lineageValidation.status,
    };

    try {
      // 1. Registrar la evidencia aprobada en el backend
      await fetch("/api/streetview/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...approvedEvidence,
          id: approvedEvidence.evidenceId,
          expedienteId,
          captureId,
          sourceEvidenceId,
          supportingEvidenceIds: sourceEvidenceId ? [sourceEvidenceId] : [],
          lineage,
          lineageStatus: lineageValidation.status,
          categoria: selectedCapture.categoria_exploracion || "RUTA_ACCESO",
          candidateType: approvedCandidate?.candidateType || selectedCapture.candidateType,
          observableFactors: approvedCandidate?.observableFactors || selectedCapture.observableFactors || [],
          explanation: approvedCandidate?.explanation || selectedCapture.explanation,
          confidence: approvedCandidate?.confidence ?? selectedCapture.confidence,
          confidenceBasis: approvedCandidate?.confidenceBasis || selectedCapture.confidenceBasis,
          limitations: approvedCandidate?.limitations || selectedCapture.limitations || [],
          googleIntelligenceEvidence: getGoogleEvidence(selectedCapture),
          googleCandidateFinding: approvedCandidate,
          coordenadas: { lat, lng },
          imagen: approvedEvidence.imageReference,
          heading: approvedEvidence.geometry?.heading,
          pitch: approvedEvidence.geometry?.pitch,
          estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
          humanValidationStatus: "APPROVED",
          validationSource: "ADR_020_24_HUMAN_ACTION",
          descripcion: validationComment.trim(),
          fechaCreacion: approvedEvidence.validationDate,
          usuarioRevision: validatorId || null,
          origenRevision: "BARRIDO_AUTOMATICO"
        })
      }).catch((err) => console.warn("Muted fetch error:", err));

      // 2. Actualizar estado del hallazgo analítico origen
      await fetch(`/api/expedientes/${expedienteId}/evidencias/streetview/${captureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_revision: GeointGovernanceStatus.APPROVED_EVIDENCE,
          status: GeointGovernanceStatus.APPROVED_EVIDENCE,
          humanValidationStatus: "APPROVED",
          validationSource: "ADR_020_24_HUMAN_ACTION",
          lineage,
          lineageStatus: lineageValidation.status,
          validationComment: validationComment.trim(),
          validatedBy: validatorId || null,
          validationDate: approvedEvidence.validationDate
        })
      }).catch((err) => console.warn("Muted patch error:", err));

      if (onCaptureStatusChange) {
        onCaptureStatusChange(captureId, GeointGovernanceStatus.APPROVED_EVIDENCE);
      }
      if (onFindingCreated) {
        onFindingCreated(approvedEvidence);
      }

      // Remover de la lista de pendientes local
      setPendingCaptures((prev) => prev.filter((c) => (c.id || c.findingId || c.hash_md5 || c.filename) !== captureId));
      setSelectedCapture(null);
      setValidationComment("");
    } catch (err) {
      console.error("Error al aprobar hallazgo (ADR-016):", err);
      setErrorMessage("Error de red al registrar la convalidación. Intente nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedCapture) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const captureId = selectedCapture.id || selectedCapture.findingId || selectedCapture.hash_md5 || selectedCapture.filename;
    const candidate = getGoogleCandidateFinding(selectedCapture);
    const rejectedCandidate = candidate ? rejectGoogleCandidateFinding(candidate) : null;

    try {
      // Marcar hallazgo analítico como REJECTED_FINDING manteniendo antecedentes e historial (Regla 3 ADR-016)
      await fetch(`/api/expedientes/${expedienteId}/evidencias/streetview/${captureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_revision: GeointGovernanceStatus.REJECTED_FINDING,
          status: GeointGovernanceStatus.REJECTED_FINDING,
          humanValidationStatus: "REJECTED",
          validationSource: "ADR_020_24_HUMAN_ACTION",
          rejectedBy: validatorId || null,
          rejectionDate: new Date().toISOString(),
          rejectionComment: validationComment.trim() || "Descartado por el analista",
          googleCandidateFinding: rejectedCandidate,
        })
      }).catch((err) => console.warn("Muted rejection patch error:", err));

      if (onCaptureStatusChange) {
        onCaptureStatusChange(captureId, GeointGovernanceStatus.REJECTED_FINDING);
      }

      // Remover de la lista de pendientes local
      setPendingCaptures((prev) => prev.filter((c) => (c.id || c.findingId || c.hash_md5 || c.filename) !== captureId));
      setSelectedCapture(null);
      setValidationComment("");
    } catch (err) {
      console.error("Error al rechazar hallazgo (ADR-016):", err);
      setErrorMessage("Error al registrar el rechazo. Intente nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[520px] overflow-hidden shadow-2xl">
      {/* Encabezado de Gobernanza */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
        <div>
          <span className="text-[10px] font-black tracking-widest text-cyan-500 uppercase">
            CONSOLA DE CONVALIDACIÓN HUMANA DE EVIDENCIAS (ADR-016)
          </span>
          <h2 className="text-sm font-black text-white uppercase tracking-tight">
            Hallazgos Pendientes de Revisión ({pendingCaptures.length}) | Aprobados ({governedFindings.length})
          </h2>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Lista de hallazgos pendientes (analyticalFindings) */}
        <div className="w-1/2 border-r border-slate-800 overflow-y-auto p-3 space-y-2">
          {pendingCaptures.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
              <span className="text-2xl mb-1">👌</span>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Sin Hallazgos Pendientes</p>
              <p className="text-[9px] text-slate-600 mt-0.5">Todos los hallazgos analíticos han sido evaluados por el analista.</p>
            </div>
          ) : (
            pendingCaptures.map((cap) => {
              const capId = cap.id || cap.findingId || cap.hash_md5 || cap.filename;
              const isSelected = selectedCapture && (selectedCapture.id === capId || selectedCapture.findingId === capId || selectedCapture.hash_md5 === capId);
              const lat = cap.latitude || cap.lat || cap.geometry?.lat;
              const lng = cap.longitude || cap.lng || cap.geometry?.lng;
              const display = getCandidateDisplay(cap);

              return (
                <div
                  key={capId}
                  onClick={() => handleSelect(cap)}
                  className={`p-2.5 rounded-xl cursor-pointer border transition-all duration-200 flex items-center gap-3 ${
                    isSelected
                      ? "bg-cyan-950/40 border-cyan-800/80 shadow-md shadow-cyan-950/20"
                      : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/80"
                  }`}
                >
                  {(cap.file_url || cap.archivo_url || cap.imageReference) ? (
                    <img
                      src={cap.file_url || cap.archivo_url || cap.imageReference}
                      alt="Finding preview"
                      className="w-12 h-12 object-cover rounded-lg border border-slate-800 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-lg text-[8px] font-bold text-slate-500 text-center uppercase leading-tight p-0.5 shrink-0">
                      SIN VISTA PREVIA
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-black tracking-widest text-cyan-500 uppercase block">
                      {cap.sourceType || cap.tipo_origen || "STREETVIEW_AUTOMATICO"}
                    </span>
                    <span className="text-[10px] text-slate-300 truncate block font-bold">
                      ID: {capId}
                    </span>
                    <span className="text-[9px] text-amber-300 truncate block font-bold">
                      {display.candidateType}
                    </span>
                    <span className="text-[9px] text-slate-500 block font-mono">
                      LAT: {typeof lat === "number" ? lat.toFixed(4) : "N/A"} / LNG: {typeof lng === "number" ? lng.toFixed(4) : "N/A"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Panel de inspección y convalidación */}
        <div className="w-1/2 bg-slate-950/40 p-4 flex flex-col justify-between overflow-y-auto">
          {selectedCapture ? (
            <div className="h-full flex flex-col justify-between">
              <div className="space-y-3">
                {(() => {
                  const display = getCandidateDisplay(selectedCapture);
                  return (
                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                      <div className="bg-emerald-950/30 border border-emerald-900/70 rounded-xl p-2">
                        <p className="text-emerald-300 font-black uppercase tracking-wider">Observación</p>
                        <p className="text-slate-300 mt-1">Fuente Google Street View vinculada a evidencia trazable.</p>
                        <p className="text-slate-500 font-mono mt-1">Fecha SV: {display.streetViewDate || "N/D"}</p>
                      </div>
                      <div className="bg-amber-950/30 border border-amber-900/70 rounded-xl p-2">
                        <p className="text-amber-300 font-black uppercase tracking-wider">Interpretación / Candidato</p>
                        <p className="text-slate-200 font-bold mt-1">{display.candidateType}</p>
                        <p className="text-slate-500 font-mono mt-1">Estado: {display.candidate?.validationStatus || selectedCapture.status || "PENDING_REVIEW"}</p>
                      </div>
                    </div>
                  );
                })()}
                <div className="relative rounded-xl overflow-hidden border border-slate-800 h-32 bg-black">
                  {(selectedCapture.file_url || selectedCapture.archivo_url || selectedCapture.imageReference) ? (
                    <img
                      src={selectedCapture.file_url || selectedCapture.archivo_url || selectedCapture.imageReference}
                      alt="Current finding"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-950 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      SIN VISTA PREVIA
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[8px] font-mono text-cyan-400 border border-slate-800">
                    H: {selectedCapture.geolocalizacion?.heading || selectedCapture.heading || 0}° / P: {selectedCapture.geolocalizacion?.pitch || selectedCapture.pitch || 0}°
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60 space-y-1">
                  {(() => {
                    const display = getCandidateDisplay(selectedCapture);
                    return (
                      <div className="space-y-1.5 border-b border-slate-800/70 pb-2 mb-2">
                        <p className="text-[9px] text-slate-300 leading-relaxed">
                          <span className="text-amber-300 font-bold">Explicación:</span> {display.explanation || "Sin explicación canónica."}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          <span className="text-cyan-400 font-bold">Factores:</span> {display.observableFactors.length > 0 ? display.observableFactors.join(", ") : "N/D"}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          <span className="text-cyan-400 font-bold">Confianza:</span> {String(display.confidence)} · {display.confidenceBasis}
                        </p>
                        <p className="text-[9px] text-slate-500">
                          <span className="text-red-300 font-bold">Limitaciones:</span> {display.limitations.length > 0 ? display.limitations.join(" ") : "No prueba conducta criminal ni uso actual sin validación."}
                        </p>
                      </div>
                    );
                  })()}
                  <p className="text-[9px] font-mono text-slate-400">
                    <span className="text-cyan-400 font-bold">Motor Generador:</span> {selectedCapture.generatedBy || "STREETVIEW_SWEEP_ENGINE"}
                  </p>
                  <p className="text-[9px] font-mono text-slate-400">
                    <span className="text-cyan-400 font-bold">Origen:</span> {selectedCapture.sourceType || "STREETVIEW_AUTOMATICO"}
                  </p>
                  {onTriggerTemporalComparison && (
                    <button
                      type="button"
                      onClick={() => {
                        const adapted =
                          adaptStreetViewFindingToGeoEvidence(selectedCapture) ||
                          adaptSweepPayloadToGeoEvidence(selectedCapture, expedienteId) ||
                          selectedCapture;
                        onTriggerTemporalComparison(adapted);
                      }}
                      className="w-full mt-1 py-1.5 px-2 bg-amber-950/80 hover:bg-amber-900 border border-amber-800/80 text-amber-300 rounded-lg text-[9px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>⏳</span> Comparar Evidencia Temporal (ADR-019)
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[9px] font-black tracking-widest text-slate-400 uppercase block mb-1">
                    Fundamentación / Comentario de Validación <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={validationComment}
                    onChange={(e) => {
                      setValidationComment(e.target.value);
                      if (e.target.value.trim().length > 0) setErrorMessage(null);
                    }}
                    placeholder="Justifique la relevancia probatoria de esta captura para incorporarla formalmente al expediente..."
                    className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-medium resize-none leading-relaxed"
                  />
                </div>

                {errorMessage && (
                  <div className="p-2 rounded-lg bg-red-950/40 border border-red-800/80 text-[9px] text-red-300 font-bold">
                    {errorMessage}
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t border-slate-800 pt-3 mt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleReject}
                  className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-red-950/40 hover:border-red-800 text-[10px] font-black text-slate-400 hover:text-red-300 uppercase tracking-wider border border-slate-800 transition-all duration-150 disabled:opacity-50"
                >
                  🚫 Rechazar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleApprove}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-[10px] font-black text-white uppercase tracking-wider shadow-lg shadow-cyan-950/50 transition-all duration-150 disabled:opacity-50"
                >
                  ✅ Aprobar Evidencia
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
              <span className="text-3xl mb-2">🔍</span>
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Detalle de Convalidación</p>
              <p className="text-[9px] text-slate-500 mt-1 max-w-[180px]">Seleccione un hallazgo de la lista para analizar su relevancia e incorporarlo al expediente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
