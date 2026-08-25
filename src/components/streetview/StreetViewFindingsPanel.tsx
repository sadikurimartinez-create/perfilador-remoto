"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  adaptStreetViewFindingToGeoEvidence,
  adaptSweepPayloadToGeoEvidence,
} from "@/utils/geoResolver";

export interface AnalyticalFinding {
  findingId: string;
  projectId: string;
  sourceType: string;
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
  status: "PENDING_REVIEW" | "APPROVED_EVIDENCE" | "REJECTED_FINDING";
}

export interface ApprovedEvidence {
  evidenceId: string;
  projectId: string;
  originalFindingId: string;
  validatedBy: string;
  validatorRole: string;
  validationDate: string;
  validationComment: string;
  status: "APPROVED_EVIDENCE";
  geometry?: {
    lat: number;
    lng: number;
    heading?: number;
    pitch?: number;
  };
  imageReference?: string;
}

export interface StreetViewFinding {
  id: string;
  expedienteId: string;
  evidenciaId?: string;
  captureId?: string;
  categoria: "pendiente_clasificacion" | "COMPARACION_TEMPORAL" | "ACECHO_ESCONDITE" | "GRAFFITI_PANDILLA" | "DENUE_POI" | "OSINT_GENERAL" | "acecho" | "graffiti" | "denue" | "sin_hallazgo" | "RUTA_ACCESO" | "PUNTO_ACECHO";
  coordenadas: {
    lat: number;
    lng: number;
  };
  imagen?: string;
  heading?: number;
  pitch?: number;
  fov?: number;
  estado?: "GENERADO" | "PENDIENTE_REVISION" | "APROBADO" | "IGNORADO" | "APPROVED_EVIDENCE" | "REJECTED_FINDING";
  descripcion?: string;
  observaciones_visual?: string;
  fechaCreacion?: string;
  usuarioRevision?: string;
  origenRevision?: "BARRIDO_AUTOMATICO" | "MANUAL";
}

interface StreetViewFindingsPanelProps {
  expedienteId: string;
  captures?: any[]; // Capturas automáticas / analyticalFindings
  onCaptureStatusChange?: (captureId: string, status: "APROBADO" | "IGNORADO") => void;
  onFindingCreated?: (finding: any) => void;
  validatorId?: string;
  validatorRole?: string;
  onTriggerTemporalComparison?: (candidate?: any) => void;
}

export function StreetViewFindingsPanel({
  expedienteId,
  captures = [],
  onCaptureStatusChange,
  onFindingCreated,
  validatorId = "US-CEIPOL-ANALISTA",
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
        (c.estado_revision === "PENDIENTE_REVISION" || c.status === "PENDING_REVIEW" || !c.estado_revision)
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

    // Construcción de la nueva entidad approvedEvidence (ADR-016)
    const approvedEvidence: ApprovedEvidence = {
      evidenceId: `evi-approved-${Date.now()}`,
      projectId: expedienteId,
      originalFindingId: captureId,
      validatedBy: validatorId,
      validatorRole: validatorRole,
      validationDate: new Date().toISOString(),
      validationComment: validationComment.trim(),
      status: "APPROVED_EVIDENCE",
      geometry: {
        lat,
        lng,
        heading: selectedCapture.geolocalizacion?.heading || selectedCapture.heading || 0,
        pitch: selectedCapture.geolocalizacion?.pitch || selectedCapture.pitch || 0
      },
      imageReference: selectedCapture.file_url || selectedCapture.archivo_url || selectedCapture.imageReference || ""
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
          categoria: selectedCapture.categoria_exploracion || "RUTA_ACCESO",
          coordenadas: { lat, lng },
          imagen: approvedEvidence.imageReference,
          heading: approvedEvidence.geometry?.heading,
          pitch: approvedEvidence.geometry?.pitch,
          estado: "APPROVED_EVIDENCE",
          descripcion: validationComment.trim(),
          fechaCreacion: approvedEvidence.validationDate,
          usuarioRevision: validatorId,
          origenRevision: "BARRIDO_AUTOMATICO"
        })
      }).catch((err) => console.warn("Muted fetch error:", err));

      // 2. Actualizar estado del hallazgo analítico origen
      await fetch(`/api/expedientes/${expedienteId}/evidencias/streetview/${captureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_revision: "APPROVED_EVIDENCE",
          status: "APPROVED_EVIDENCE",
          validationComment: validationComment.trim(),
          validatedBy: validatorId,
          validationDate: approvedEvidence.validationDate
        })
      }).catch((err) => console.warn("Muted patch error:", err));

      if (onCaptureStatusChange) {
        onCaptureStatusChange(captureId, "APROBADO");
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

    try {
      // Marcar hallazgo analítico como REJECTED_FINDING manteniendo antecedentes e historial (Regla 3 ADR-016)
      await fetch(`/api/expedientes/${expedienteId}/evidencias/streetview/${captureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado_revision: "REJECTED_FINDING",
          status: "REJECTED_FINDING",
          rejectedBy: validatorId,
          rejectionDate: new Date().toISOString(),
          rejectionComment: validationComment.trim() || "Descartado por el analista"
        })
      }).catch((err) => console.warn("Muted rejection patch error:", err));

      if (onCaptureStatusChange) {
        onCaptureStatusChange(captureId, "IGNORADO");
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

