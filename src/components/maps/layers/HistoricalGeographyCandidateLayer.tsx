"use client";

import * as React from "react";
import { InfoWindow, Marker, Polyline } from "@react-google-maps/api";
import type { HistoricalGeographyCandidate } from "@/utils/historicalGeographyReconciliation";

interface HistoricalGeographyCandidateLayerProps {
  visible: boolean;
  candidates?: HistoricalGeographyCandidate[];
  selectedCandidateIds?: string[];
  discardedCandidateIds?: string[];
  previewPath?: Array<{ lat: number; lng: number }>;
  onCandidateSelect?: (candidateId: string) => void;
}

function markerColor(status: HistoricalGeographyCandidate["status"], isSelected: boolean) {
  if (status === "DISCARDED") return "#64748b";
  if (isSelected) return "#f59e0b";
  if (status === "DISCOVERED") return "#38bdf8";
  return "#38bdf8";
}

export const HistoricalGeographyCandidateLayer: React.FC<HistoricalGeographyCandidateLayerProps> = ({
  visible,
  candidates = [],
  selectedCandidateIds = [],
  discardedCandidateIds = [],
  previewPath = [],
  onCandidateSelect,
}) => {
  const [activeCandidate, setActiveCandidate] = React.useState<HistoricalGeographyCandidate | null>(null);
  const selectedOrder = React.useMemo(
    () => new Map(selectedCandidateIds.map((candidateId, index) => [candidateId, index + 1])),
    [selectedCandidateIds]
  );
  const discardedSet = React.useMemo(() => new Set(discardedCandidateIds), [discardedCandidateIds]);

  if (!visible || candidates.length === 0) return null;

  return (
    <>
      {previewPath.length >= 2 && (
        <Polyline
          path={previewPath}
          options={{
            strokeColor: "#f59e0b",
            strokeOpacity: 0.9,
            strokeWeight: 3,
            clickable: false,
            zIndex: 80,
          }}
        />
      )}

      {candidates.map((candidate) => {
        const isSelected = selectedOrder.has(candidate.candidateId);
        const status = discardedSet.has(candidate.candidateId) ? "DISCARDED" : candidate.status;
        const order = selectedOrder.get(candidate.candidateId);

        return (
          <React.Fragment key={`historical-candidate-${candidate.candidateId}`}>
            <Marker
              position={{ lat: candidate.lat, lng: candidate.lng }}
              title={`Candidato historico ${candidate.candidateId}`}
              onClick={() => {
                setActiveCandidate(candidate);
                onCandidateSelect?.(candidate.candidateId);
              }}
              label={order ? {
                text: String(order),
                color: "#111827",
                fontSize: "11px",
                fontWeight: "bold",
              } : undefined}
              icon={typeof google !== "undefined" ? {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: markerColor(status, isSelected),
                fillOpacity: status === "DISCARDED" ? 0.35 : 0.95,
                strokeColor: isSelected ? "#fef3c7" : "#ffffff",
                strokeWeight: isSelected ? 3 : 1.5,
                scale: isSelected ? 11 : 8,
              } : undefined}
              opacity={status === "DISCARDED" ? 0.45 : 1}
              zIndex={isSelected ? 220 : status === "DISCARDED" ? 90 : 160}
            />
            {activeCandidate?.candidateId === candidate.candidateId && (
              <InfoWindow
                position={{ lat: candidate.lat, lng: candidate.lng }}
                onCloseClick={() => setActiveCandidate(null)}
              >
                <div className="p-2 text-slate-900 font-sans max-w-xs">
                  <h4 className="text-xs font-black uppercase text-slate-800">Candidato historico</h4>
                  <p className="text-[10px] text-slate-600 font-mono mt-1">
                    {candidate.lat.toFixed(6)}, {candidate.lng.toFixed(6)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">Fuente: {candidate.sourceType}</p>
                  <p className="text-[10px] text-slate-500">Estado: {status}</p>
                </div>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default HistoricalGeographyCandidateLayer;
