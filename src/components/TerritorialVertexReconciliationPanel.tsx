"use client";

import * as React from "react";
import { CEIPOLButton } from "./ui/CEIPOLButton";
import { CEIPOLConfirmModal } from "./ui/CEIPOLConfirmModal";
import {
  buildCanonicalProjectGeography,
  type CanonicalProjectGeography,
} from "@/utils/canonicalProjectGeography";
import type { GeographicEntity } from "@/services/geographicEntityService";

export type TerritorialVertex = GeographicEntity & {
  id: string;
  type: "VERTEX";
  metadata: NonNullable<GeographicEntity["metadata"]> & {
    isVertex: true;
    isIndependentPoi: false;
    order: number;
    source: "HUMAN_MAP_VERTEX";
  };
};

type Props = {
  projectId: string;
  vertices: TerritorialVertex[];
  canonicalGeographyExists: boolean;
  isCaptureEnabled: boolean;
  onCaptureEnabledChange: (enabled: boolean) => void;
  onReorder: (vertices: TerritorialVertex[]) => Promise<void>;
  onRemove: (vertexId: string) => Promise<void>;
  onPreviewChange?: (points: Array<{ lat: number; lng: number }>) => void;
  onConfirm: (geography: CanonicalProjectGeography) => Promise<unknown>;
};

function coordinateKey(vertex: Pick<TerritorialVertex, "lat" | "lng">): string {
  return `${Number(vertex.lat).toFixed(7)},${Number(vertex.lng).toFixed(7)}`;
}

function hasConsecutiveDuplicate(vertices: TerritorialVertex[]) {
  return vertices.some((vertex, index) => index > 0 && coordinateKey(vertex) === coordinateKey(vertices[index - 1]));
}

function sortVertices(vertices: TerritorialVertex[]) {
  return [...vertices].sort((a, b) => Number(a.metadata?.order || 0) - Number(b.metadata?.order || 0));
}

export function TerritorialVertexReconciliationPanel({
  projectId,
  vertices,
  canonicalGeographyExists,
  isCaptureEnabled,
  onCaptureEnabledChange,
  onReorder,
  onRemove,
  onPreviewChange,
  onConfirm,
}: Props) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isPersisting, setIsPersisting] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");
  const orderedVertices = React.useMemo(() => sortVertices(vertices), [vertices]);
  const previewPath = React.useMemo(
    () => orderedVertices.map((vertex) => ({ lat: Number(vertex.lat), lng: Number(vertex.lng) })),
    [orderedVertices]
  );
  const distinctCount = React.useMemo(() => new Set(orderedVertices.map(coordinateKey)).size, [orderedVertices]);
  const hasDuplicate = hasConsecutiveDuplicate(orderedVertices);
  const canConfirm = !canonicalGeographyExists && orderedVertices.length >= 2 && distinctCount >= 2 && !hasDuplicate && !isPersisting;

  React.useEffect(() => {
    onPreviewChange?.(previewPath);
  }, [onPreviewChange, previewPath]);

  const moveVertex = async (vertexId: string, direction: -1 | 1) => {
    const index = orderedVertices.findIndex((vertex) => vertex.id === vertexId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= orderedVertices.length) return;
    const nextVertices = [...orderedVertices];
    [nextVertices[index], nextVertices[nextIndex]] = [nextVertices[nextIndex], nextVertices[index]];
    await onReorder(nextVertices.map((vertex, vertexIndex) => ({
      ...vertex,
      metadata: { ...vertex.metadata, order: vertexIndex + 1 },
    })));
  };

  const handleConfirm = async () => {
    setIsPersisting(true);
    setFeedback("");
    try {
      if (!canConfirm) throw new Error("TERRITORIAL_VERTEX_CORRIDOR_INVALID");
      const geography: CanonicalProjectGeography = {
        ...buildCanonicalProjectGeography({
          projectId,
          type: "CORRIDOR",
          points: previewPath,
          source: "HUMAN_MAP_VERTEX",
        }),
        sourceRefs: orderedVertices.map((vertex, index) => ({
          type: "TERRITORIAL_VERTEX",
          id: vertex.id,
          order: index + 1,
        })),
        limitations: [
          "CANONICAL_GEOGRAPHY_BUILT_FROM_CONFIRMED_TERRITORIAL_VERTICES",
          ...orderedVertices.map((vertex, index) => `TERRITORIAL_VERTEX:${index + 1}:${vertex.id}`),
        ],
      };
      if (geography.validationStatus !== "VALID" || geography.geometry.type !== "LineString") {
        throw new Error("TERRITORIAL_VERTEX_CORRIDOR_INVALID");
      }
      await onConfirm(geography);
      setConfirmOpen(false);
      setFeedback("Corredor canonico confirmado con vertices territoriales.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "No fue posible confirmar el corredor territorial.");
      throw err;
    } finally {
      setIsPersisting(false);
    }
  };

  return (
    <section className="w-full border border-slate-800 bg-slate-950 px-4 py-4 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-300">Vertices territoriales manuales</p>
          <p className="mt-1 text-xs text-slate-400">
            Total: {orderedVertices.length} | Posiciones distintas: {distinctCount} | Estado: {canonicalGeographyExists ? "CANONICAL_EXISTENTE" : canConfirm ? "LISTO_PARA_CONFIRMACION" : "PENDIENTE"}
          </p>
          <p className="mt-1 text-[11px] text-amber-300">
            Los candidatos historicos son evidencia auxiliar. La geografia canonica se construye exclusivamente con vertices territoriales confirmados manualmente.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[11px] font-black uppercase text-rose-100">
          <input
            type="checkbox"
            checked={isCaptureEnabled}
            disabled={canonicalGeographyExists}
            onChange={(event) => onCaptureEnabledChange(event.target.checked)}
          />
          Capturar vertices en mapa
        </label>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_280px]">
        <ol className="space-y-2">
          {orderedVertices.map((vertex, index) => (
            <li key={vertex.id} className="border border-slate-800 bg-slate-900/20 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-black uppercase text-slate-200">Orden {index + 1} | HUMAN_MAP_VERTEX</p>
                  <p className="mt-1 font-mono text-[11px] text-cyan-300">ID: {vertex.id}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">{Number(vertex.lat).toFixed(6)}, {Number(vertex.lng).toFixed(6)}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <CEIPOLButton size="sm" variant="ghost" disabled={index === 0 || canonicalGeographyExists} onClick={() => moveVertex(vertex.id, -1)}>
                    Subir
                  </CEIPOLButton>
                  <CEIPOLButton size="sm" variant="ghost" disabled={index === orderedVertices.length - 1 || canonicalGeographyExists} onClick={() => moveVertex(vertex.id, 1)}>
                    Bajar
                  </CEIPOLButton>
                  <CEIPOLButton size="sm" variant="danger" disabled={canonicalGeographyExists} onClick={() => onRemove(vertex.id)}>
                    Eliminar
                  </CEIPOLButton>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="border border-slate-800 bg-slate-900/30 p-3 text-xs">
          <p className="font-black uppercase text-amber-300">Previsualizacion LineString</p>
          <p className="mt-2 text-slate-400">
            Requiere al menos dos vertices territoriales distintos y sin duplicados consecutivos.
          </p>
          {hasDuplicate && <p className="mt-2 font-bold text-red-300">Duplicado consecutivo bloqueado.</p>}
          <CEIPOLButton
            className="mt-4 w-full"
            variant="confirm"
            disabled={!canConfirm}
            loading={isPersisting}
            onClick={() => setConfirmOpen(true)}
          >
            Confirmar corredor territorial
          </CEIPOLButton>
          {feedback && <p className="mt-3 text-[11px] text-amber-300">{feedback}</p>}
        </div>
      </div>

      <CEIPOLConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Confirmar corredor territorial"
        variant="warning"
        confirmText="Confirmar y persistir"
        isLoading={isPersisting}
        message="La geografia canonica se creara exclusivamente desde los vertices territoriales manuales en el orden mostrado. Las evidencias historicas permanecen como auxiliares."
      />
    </section>
  );
}

export default TerritorialVertexReconciliationPanel;
