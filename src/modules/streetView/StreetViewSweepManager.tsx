"use client";

import React from "react";
import { GeointControlledSweepEngine } from "@/modules/geoint/GeointControlledSweepEngine";
import { GeoIntSweepFindingPayload } from "@/types/geointSweep";

interface StreetViewSweepManagerProps {
  isOpen: boolean;
  lat: number;
  lng: number;
  onClose: () => void;
  onCaptureMultiple: (payloads: any[]) => void;
  analystName?: string;
}

/**
 * ADR-018 v1.0 — StreetViewSweepManager (Componente Subordinado de Interfaz Visual)
 * Se subordina al GEOINT Controlled Sweep Engine para garantizar que no ejecute lógica paralela
 * ni barridos automáticos directos sin convalidación.
 */
export function StreetViewSweepManager({
  isOpen,
  lat,
  lng,
  onClose,
  onCaptureMultiple,
  analystName = "Analista CEIPOL",
}: StreetViewSweepManagerProps) {
  const handleFindingsGenerated = (findings: GeoIntSweepFindingPayload[]) => {
    // Adaptar estructuras al pipeline de convalidación humana (ADR-016 / ADR-018)
    const mappedCaptures = findings.map((f) => ({
      id: f.originalFindingId,
      latitude: f.geometry.lat,
      longitude: f.geometry.lng,
      tipo_origen: "STREETVIEW_AUTOMATICO",
      categoria_exploracion: f.category,
      file_url: f.file_url,
      geolocalizacion: {
        heading: f.geometry.heading || 0,
        pitch: f.geometry.pitch || 0,
        fov: f.geometry.fov || 90,
      },
      estado_revision: "PENDIENTE_REVISION",
      status: "PENDING_REVIEW",
      source: "GEOINT_CONTROLLED_SWEEP",
      createdBy: f.createdBy,
      comentario: f.comentario,
    }));

    onCaptureMultiple(mappedCaptures);
  };

  return (
    <GeointControlledSweepEngine
      isOpen={isOpen}
      lat={lat}
      lng={lng}
      analystName={analystName}
      onClose={onClose}
      onFindingsGenerated={handleFindingsGenerated}
    />
  );
}

export default StreetViewSweepManager;
