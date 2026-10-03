"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useProject } from "@/context/ProjectContext";
import { EvidencePpcReviewCard } from "../EvidencePpcReviewPanel";
import { persistInstitutionalGeointEntity } from "@/lib/institutionalGeointEntityActions";
import { ppcReviewDisplayStatus, reconcileStreetViewReviewItems, reviewStateLabels } from "@/utils/institutionalEvidenceReview";
import type { GeointGovernanceStatus, GeointGovernanceStatusValue } from "@/types/geointGovernance";
import type { CanonicalLineageNode, LineageStatus } from "@/utils/evidenceLineage";
import type { AiAnalyticalOutput } from "@/utils/aiAnalysisGovernance";
import {
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
  traceabilityId: string;
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
  onCaptureStatusChange?: (captureId: string, status: GeointGovernanceStatusValue, record?: any) => void;
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

export function StreetViewFindingsPanel({ expedienteId, captures = [], onCaptureStatusChange,
  onTriggerTemporalComparison }: StreetViewFindingsPanelProps) {
  const { isReadOnly } = useProject();
  const [records, setRecords] = useState<any[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmedRecords, setConfirmedRecords] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    setRecords([]); setConfirmedRecords([]); setSelectedId(null); setLoadError(false); setLoading(true);
    persistInstitutionalGeointEntity({ projectId: expedienteId, kind: "STREETVIEW", operation: "LIST" })
      .then(result => { if (active) setRecords(result as any[]); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [expedienteId]);
  const items = reconcileStreetViewReviewItems([], captures.filter(item => item.reviewTarget?.source === "TACTICAL_STREET_VIEW"),
    [...records, ...captures.filter(item => item.reviewTarget?.source !== "TACTICAL_STREET_VIEW"), ...confirmedRecords]);
  // Preserve locators of already reconciled album resources.
  const selected = items.find(item => `${item.reviewTarget.source}:${item.reviewTarget.id}` === selectedId);
  return <section className="rounded-xl border border-slate-700 p-4 space-y-3" aria-label="Revisión PPC Street View">
    <h3 className="font-semibold text-slate-200">Revisión PPC Street View — recursos existentes</h3>
    {loading && <p>Comprobando recursos persistidos…</p>}
    {loadError && <p role="alert">No se pudo cargar la colección de hallazgos. No se ha confirmado ninguna revisión.</p>}
    {items.length === 0 && <p>No hay capturas disponibles para revisión.</p>}
    <div className="flex flex-wrap gap-2">
      {items.map(item => {
        const key = `${item.reviewTarget.source}:${item.reviewTarget.id}`;
        return <button key={key} type="button" onClick={() => setSelectedId(key)} className="rounded border border-slate-700 p-2 text-xs text-slate-200">
          {item.reviewTarget.id} · {reviewStateLabels[ppcReviewDisplayStatus(item)]}
        </button>;
      })}
    </div>
    {selected && <>
      <p className="text-xs text-slate-400">{getCandidateDisplay(selected).explanation}</p>
      <EvidencePpcReviewCard key={`${expedienteId}:${selectedId}`} projectId={expedienteId} item={selected} readOnly={isReadOnly || loading || loadError}
        onConfirmed={record => {
          setConfirmedRecords(previous => [...previous.filter(item => item.reviewTarget?.id !== record.reviewTarget.id), record]);
          onCaptureStatusChange?.(record.reviewTarget.id, record.estado, record);
        }} />
      {onTriggerTemporalComparison && <button type="button" onClick={() => onTriggerTemporalComparison(selected)}>Comparar Evidencia Temporal</button>}
    </>}
  </section>;
}
