"use client";
import React, { useRef, useState } from "react";
import { useProject } from "@/context/ProjectContext";
import { reviewInstitutionalEvidence } from "@/lib/institutionalGeointEntityActions";
import type { HumanValidationAction } from "@/utils/humanValidationPolicy";
import { createEvidenceReviewSubmission, evidenceImageReference, ppcReviewDisplayStatus, reviewStateLabels, reviewVersion } from "@/utils/institutionalEvidenceReview";
import { hasStreetViewProvenance } from "@/utils/visualEvidenceEngine/streetViewCollector";

export function PhotoPpcReviewPanel() {
  const { project, album, isReadOnly } = useProject();
  if (!project) return null;
  return <section aria-label="Revisión PPC de fotografías" className="mb-6 space-y-3 border-t border-slate-700 pt-4">
    <h3 className="font-semibold text-slate-200">Revisión PPC de fotografías</h3>
    <p className="text-xs text-slate-400">Contextualizar y seleccionar para publicación no implica aprobación humana.</p>
    {album.filter(item => !item.deleted && !hasStreetViewProvenance(item)).map(item =>
      <EvidencePpcReviewCard key={`${project.id}:${item.id}`} projectId={project.id}
        item={{ ...item, reviewTarget: { source: item.sourceDocumentId ? "DOCUMENT_PHOTO" : "PHOTO", id: item.sourceDocumentId || item.id } }} readOnly={isReadOnly} />)}
  </section>;
}

export function EvidencePpcReviewCard({ projectId, item, readOnly, onConfirmed, save = reviewInstitutionalEvidence }: {
  projectId: string; item: any; readOnly: boolean; onConfirmed?: (record: any) => void;
  save?: typeof reviewInstitutionalEvidence;
}) {
  const [confirmed, setConfirmed] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [availability, setAvailability] = useState("DISPONIBILIDAD_NO_COMPROBADA");
  const submission = useRef(createEvidenceReviewSubmission(save));
  const current = confirmed || item;
  const status = ppcReviewDisplayStatus(current);
  const image = evidenceImageReference(current);
  async function decide(action: HumanValidationAction) {
    if (readOnly || saving || confirmed || !comment.trim() || !current.reviewTarget || submission.current.isPending()) return;
    setSaving(true); setError(false);
    try {
      await submission.current.submit({ projectId, ...current.reviewTarget, action, comment, expectedReview: reviewVersion(current) }, result => {
        setConfirmed(result); onConfirmed?.(result);
      });
    } catch { setError(true); }
    finally { setSaving(false); }
  }
  return <article className="rounded-lg border border-slate-700 p-3 space-y-2 text-sm text-slate-200">
    <p>{hasStreetViewProvenance(current) || ["TACTICAL_STREET_VIEW", "STREETVIEW_FINDING"].includes(current.reviewTarget?.source) ? "Street View" : "Fotografía"} · {current.reviewTarget?.id}</p>
    <p role="status">Estado PPC: {reviewStateLabels[status]}</p>
    <p className="text-xs text-slate-400">Fuente: {current.sourceProvider || current.fuente || current.gpsSource || "No acreditada"} · Fecha: {String(current.streetViewMetadata?.captureDate || current.createdAt || current.fechaCreacion || "No acreditada")}</p>
    {current.validatedAt && <p className="text-xs">Revisión: {current.validatedBy?.name || "Identidad institucional"} · {current.validatedAt}</p>}
    {current.validationComment && <p className="text-xs">Motivo: {current.validationComment}</p>}
    <button type="button" onClick={() => setInspect(true)} disabled={!image}>Ver imagen</button>
    {inspect && image && <img src={image} alt="Recurso en revisión PPC" loading="lazy" referrerPolicy="no-referrer"
      onLoad={() => setAvailability("IMAGEN_DISPONIBLE")} onError={() => setAvailability("REFERENCIA_ROTA")} className="max-h-48" />}
    <p className="text-xs">{availability}</p>
    <label className="block">Comentario de revisión
      <textarea value={comment} disabled={readOnly || saving} onChange={event => setComment(event.target.value)} className="block w-full bg-slate-950" />
    </label>
    <div className="flex flex-wrap gap-3">
      {([ ["APPROVE", "Aprobar"], ["REJECT", "Rechazar"], ["RETURN_FOR_REANALYSIS", "Devolver para reanálisis"] ] as const).map(([action, label]) =>
        <button key={action} type="button" disabled={readOnly || saving || !comment.trim() || Boolean(confirmed)} onClick={() => decide(action)}>{saving ? "Guardando…" : label}</button>)}
    </div>
    {error && <p role="alert">No se confirmó la revisión. Recargue y verifique el estado antes de reintentar.</p>}
  </article>;
}
