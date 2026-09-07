"use client";

import * as React from "react";
import { CEIPOLButton } from "./ui/CEIPOLButton";
import { CEIPOLConfirmModal } from "./ui/CEIPOLConfirmModal";
import {
  confirmHistoricalGeographyReconciliation,
  createHistoricalGeographyReconciliation,
  discardHistoricalGeographyCandidates,
  selectHistoricalGeographyCandidates,
  type HistoricalGeographyCandidate,
  type HistoricalGeographyHumanActor,
  type HistoricalGeographyReconciliation,
} from "@/utils/historicalGeographyReconciliation";

type Props = {
  projectId: string;
  candidates: HistoricalGeographyCandidate[];
  canonicalGeographyExists: boolean;
  onPersist: (reconciliation: HistoricalGeographyReconciliation) => Promise<unknown>;
  onPreviewChange?: (selectedOrderedCandidates: HistoricalGeographyCandidate[]) => void;
  onCandidateStateChange?: (
    candidates: HistoricalGeographyCandidate[],
    selectedCandidateIds: string[],
    discardedCandidateIds: string[]
  ) => void;
  confirmedBy?: HistoricalGeographyHumanActor | null;
};

type ForensicCandidateMetadata = {
  forensicSequence?: number | null;
  forensicBasis?: string | null;
  spatialGroupId?: string | null;
};

function buildReconciliationId(projectId: string, candidates: HistoricalGeographyCandidate[]) {
  const suffix = candidates.map((candidate) => candidate.candidateId).join("-").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48);
  return `hgr-${projectId}-${suffix || "empty"}`;
}

function applySelectedOrder(candidates: HistoricalGeographyCandidate[], selectedIds: string[]) {
  const byId = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  return selectedIds.map((candidateId) => byId.get(candidateId)).filter((candidate): candidate is HistoricalGeographyCandidate => Boolean(candidate));
}

function buildCandidatesSignature(candidates: HistoricalGeographyCandidate[]) {
  return candidates
    .map((candidate) => [
      candidate.candidateId,
      candidate.projectId,
      candidate.lat,
      candidate.lng,
      candidate.sourceType,
      (candidate as HistoricalGeographyCandidate & ForensicCandidateMetadata).spatialGroupId || "",
    ].join(":"))
    .join("|");
}

export function HistoricalGeographyReconciliationPanel({
  projectId,
  candidates,
  canonicalGeographyExists,
  onPersist,
  onPreviewChange,
  onCandidateStateChange,
  confirmedBy,
}: Props) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [discardedIds, setDiscardedIds] = React.useState<string[]>([]);
  const [reconciliation, setReconciliation] = React.useState<HistoricalGeographyReconciliation>(() =>
    createHistoricalGeographyReconciliation({
      reconciliationId: buildReconciliationId(projectId, candidates),
      projectId,
      candidates,
    })
  );
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isPersisting, setIsPersisting] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");
  const candidatesSignature = React.useMemo(() => buildCandidatesSignature(candidates), [candidates]);

  React.useEffect(() => {
    setSelectedIds([]);
    setDiscardedIds([]);
    setReconciliation(createHistoricalGeographyReconciliation({
      reconciliationId: buildReconciliationId(projectId, candidates),
      projectId,
      candidates,
    }));
    onPreviewChange?.([]);
  }, [projectId, candidatesSignature, onPreviewChange]);

  const selectedCandidates = React.useMemo(
    () => applySelectedOrder(reconciliation.candidates, selectedIds),
    [reconciliation.candidates, selectedIds]
  );
  const uniqueSpatialPositionCount = React.useMemo(() => {
    const groupIds = candidates
      .map((candidate) => String((candidate as HistoricalGeographyCandidate & ForensicCandidateMetadata).spatialGroupId || "").trim())
      .filter(Boolean);
    return groupIds.length > 0 ? new Set(groupIds).size : candidates.length;
  }, [candidates]);
  const canConfirm = !canonicalGeographyExists && selectedCandidates.length >= 2 && !isPersisting;

  React.useEffect(() => {
    onPreviewChange?.(selectedCandidates);
  }, [selectedCandidates, onPreviewChange]);

  React.useEffect(() => {
    onCandidateStateChange?.(reconciliation.candidates, selectedIds, discardedIds);
  }, [reconciliation.candidates, selectedIds, discardedIds, onCandidateStateChange]);

  const syncSelection = (nextSelectedIds: string[]) => {
    const selectableIds = nextSelectedIds.filter((candidateId) => !discardedIds.includes(candidateId));
    setSelectedIds(selectableIds);
    setReconciliation((prev) => selectHistoricalGeographyCandidates(prev, selectableIds));
    setFeedback(selectableIds.length >= 2 ? "Previsualizacion lista para validacion humana." : "Seleccione al menos dos candidatos para formar el corredor.");
  };

  const toggleCandidate = (candidateId: string) => {
    if (canonicalGeographyExists || discardedIds.includes(candidateId)) return;
    const nextSelectedIds = selectedIds.includes(candidateId)
      ? selectedIds.filter((id) => id !== candidateId)
      : [...selectedIds, candidateId];
    syncSelection(nextSelectedIds);
  };

  const discardCandidate = (candidateId: string) => {
    if (canonicalGeographyExists) return;
    const nextDiscardedIds = Array.from(new Set([...discardedIds, candidateId]));
    const nextSelectedIds = selectedIds.filter((id) => id !== candidateId);
    setDiscardedIds(nextDiscardedIds);
    setSelectedIds(nextSelectedIds);
    setReconciliation((prev) => discardHistoricalGeographyCandidates(
      selectHistoricalGeographyCandidates(prev, nextSelectedIds),
      [candidateId]
    ));
    setFeedback("Candidato descartado de la previsualizacion.");
  };

  const restoreCandidate = (candidateId: string) => {
    if (canonicalGeographyExists) return;
    setDiscardedIds((prev) => prev.filter((id) => id !== candidateId));
    setReconciliation(createHistoricalGeographyReconciliation({
      reconciliationId: reconciliation.reconciliationId,
      projectId,
      candidates: reconciliation.candidates.map((candidate) => ({
        ...candidate,
        status: selectedIds.includes(candidate.candidateId) ? "SELECTED" : "DISCOVERED",
      })),
      limitations: reconciliation.limitations,
    }));
    setFeedback("Candidato restaurado para revision.");
  };

  const moveCandidate = (candidateId: string, direction: -1 | 1) => {
    const index = selectedIds.indexOf(candidateId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedIds.length) return;
    const nextSelectedIds = [...selectedIds];
    [nextSelectedIds[index], nextSelectedIds[nextIndex]] = [nextSelectedIds[nextIndex], nextSelectedIds[index]];
    syncSelection(nextSelectedIds);
  };

  const handleConfirm = async () => {
    setIsPersisting(true);
    setFeedback("");
    try {
      const confirmed = confirmHistoricalGeographyReconciliation({
        reconciliation,
        confirmedCandidateIds: selectedIds,
        confirmation: {
          confirmedBy: confirmedBy || { username: "Usuario Local" },
          confirmedAt: new Date().toISOString(),
        },
      });
      setReconciliation(confirmed);
      await onPersist(confirmed);
      onCandidateStateChange?.(confirmed.candidates, confirmed.confirmedCandidateIds, discardedIds);
      setConfirmOpen(false);
      setFeedback("Reconciliacion historica persistida.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "No fue posible confirmar la reconciliacion historica.");
      throw err;
    } finally {
      setIsPersisting(false);
    }
  };

  if (candidates.length === 0) {
    return null;
  }

  return (
    <section className="w-full border border-slate-800 bg-slate-950 px-4 py-4 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Reconciliacion historica de geografia</p>
          <p className="mt-1 text-xs text-slate-400">
            Candidatos: {candidates.length} | Posiciones espaciales únicas: {uniqueSpatialPositionCount} | Seleccionados: {selectedIds.length} | Descartados: {discardedIds.length}
          </p>
          <p className="mt-1 text-[11px] text-amber-300">
            La secuencia forense es una referencia auxiliar. La geometría sólo se vuelve canónica tras confirmación humana explícita.
          </p>
        </div>
        <span className={`rounded border px-2 py-1 text-[10px] font-black uppercase ${canonicalGeographyExists ? "border-emerald-800 text-emerald-300" : "border-amber-800 text-amber-300"}`}>
          {canonicalGeographyExists ? "Canonical existente" : reconciliation.status}
        </span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_280px]">
        <ol className="space-y-2">
          {reconciliation.candidates.map((candidate) => {
            const forensic = candidate as HistoricalGeographyCandidate & ForensicCandidateMetadata;
            const isSelected = selectedIds.includes(candidate.candidateId);
            const isDiscarded = discardedIds.includes(candidate.candidateId) || candidate.status === "DISCARDED";
            const order = selectedIds.indexOf(candidate.candidateId) + 1;
            return (
              <li key={candidate.candidateId} className={`border px-3 py-2 text-xs ${isDiscarded ? "border-slate-800 bg-slate-900/30 opacity-60" : isSelected ? "border-amber-600 bg-amber-950/20" : "border-slate-800 bg-slate-900/20"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black uppercase text-slate-200">
                      {isSelected ? `Orden ${order}` : "Candidato"} | {candidate.sourceType} | {candidate.confidence}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-cyan-300">
                      ID: {candidate.candidateId}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">
                      {candidate.lat.toFixed(6)}, {candidate.lng.toFixed(6)}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {candidate.sourcePhotoId ||
                        candidate.sourceEvidenceId ||
                        candidate.sourceObjectPath ||
                        "Fuente histórica sin vínculo fotográfico certificado"}
                    </p>
                    {(forensic.forensicSequence || forensic.spatialGroupId || forensic.forensicBasis) && (
                      <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                        {forensic.forensicSequence && <p>Secuencia forense: {forensic.forensicSequence}</p>}
                        {forensic.spatialGroupId && <p>Grupo espacial: {forensic.spatialGroupId}</p>}
                        {forensic.forensicBasis && <p>Base forense: {forensic.forensicBasis}</p>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <CEIPOLButton size="sm" variant={isSelected ? "warning" : "secondary"} disabled={canonicalGeographyExists || isDiscarded} onClick={() => toggleCandidate(candidate.candidateId)}>
                      {isSelected ? "Quitar" : "Seleccionar"}
                    </CEIPOLButton>
                    <CEIPOLButton size="sm" variant="ghost" disabled={!isSelected || order <= 1} onClick={() => moveCandidate(candidate.candidateId, -1)}>
                      Subir
                    </CEIPOLButton>
                    <CEIPOLButton size="sm" variant="ghost" disabled={!isSelected || order >= selectedIds.length} onClick={() => moveCandidate(candidate.candidateId, 1)}>
                      Bajar
                    </CEIPOLButton>
                    {isDiscarded ? (
                      <CEIPOLButton size="sm" variant="secondary" disabled={canonicalGeographyExists} onClick={() => restoreCandidate(candidate.candidateId)}>
                        Restaurar
                      </CEIPOLButton>
                    ) : (
                      <CEIPOLButton size="sm" variant="danger" disabled={canonicalGeographyExists} onClick={() => discardCandidate(candidate.candidateId)}>
                        Descartar
                      </CEIPOLButton>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="border border-slate-800 bg-slate-900/30 p-3 text-xs">
          <p className="font-black uppercase text-amber-300">Previsualizacion - no geografia canonica</p>
          <p className="mt-2 text-slate-400">
            Solo los candidatos seleccionados forman la linea preliminar en el orden indicado por la persona perfiladora.
          </p>
          <CEIPOLButton
            className="mt-4 w-full"
            variant="confirm"
            disabled={!canConfirm}
            loading={isPersisting}
            onClick={() => setConfirmOpen(true)}
          >
            Confirmar geografia historica
          </CEIPOLButton>
          {feedback && <p className="mt-3 text-[11px] text-amber-300">{feedback}</p>}
        </div>
      </div>

      <CEIPOLConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Confirmar geografia historica"
        variant="warning"
        confirmText="Confirmar y persistir"
        isLoading={isPersisting}
        message="Los puntos proceden de evidencia historica georreferenciada. No son vertices originales recuperados. El orden mostrado fue definido por una persona perfiladora y al confirmar se creara la geografia canonica institucional."
      />
    </section>
  );
}

export default HistoricalGeographyReconciliationPanel;
