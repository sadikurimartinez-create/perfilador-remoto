"use client";

import React, { useRef } from "react";
import { geographicEvidenceRole, geographicRoleLabels } from "@/utils/geographicEvidencePresentation";

type Photo = Parameters<typeof geographicEvidenceRole>[0] & { tipo?: string; isContextualized?: boolean };

export function photoRoleLabel(photo: Photo): string | null {
  const classification = photo.tipo?.trim();
  if (classification && classification !== "LEGACY_UNCLASSIFIED") return classification;
  const role = geographicEvidenceRole(photo);
  return role === "LEGACY_UNCLASSIFIED" ? null : geographicRoleLabels[role][1];
}

// Freeze the classification loaded on mount; a local legacy draft is not a saved decision.
// Saving contextualization confirms the draft through the existing persistence boundary.
export function PhotoRolePresentation({ photo, children }: { photo: Photo; children: React.ReactNode }) {
  const loadedRole = useRef(photoRoleLabel(photo));
  const label = loadedRole.current || (photo.isContextualized ? photoRoleLabel(photo) : null);
  return label ? <p className="mt-2 text-sm text-gray-200">Rol: {label}</p> : <>{children}</>;
}
