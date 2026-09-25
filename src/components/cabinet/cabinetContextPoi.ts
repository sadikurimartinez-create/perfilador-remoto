import type { LatLngPoint } from "@/utils/canonicalProjectGeography";

export interface CabinetContextPoi {
  id: string;
  point: LatLngPoint;
  label: string;
  description?: string;
}

export type CabinetMapActionMode = "GEOMETRY" | "ADD_POI" | "MOVE_POI";

export function createCabinetContextPoiId(sequence: number): string {
  return `cabinet-context-poi-${sequence}`;
}

export function normalizeCabinetContextPoiLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

function normalizeDescription(description?: string): string | undefined {
  const normalized = description?.trim();
  return normalized || undefined;
}

export function createCabinetContextPoi(
  id: string,
  point: LatLngPoint,
  label: string,
  description?: string,
): CabinetContextPoi {
  const normalizedLabel = normalizeCabinetContextPoiLabel(label);
  if (!normalizedLabel) throw new Error("El nombre del POI es obligatorio.");

  return {
    id,
    point,
    label: normalizedLabel,
    description: normalizeDescription(description),
  };
}

export function updateCabinetContextPoi(
  poi: CabinetContextPoi,
  updates: Pick<CabinetContextPoi, "label" | "description">,
): CabinetContextPoi {
  const normalizedLabel = normalizeCabinetContextPoiLabel(updates.label);
  if (!normalizedLabel) throw new Error("El nombre del POI es obligatorio.");

  return {
    ...poi,
    label: normalizedLabel,
    description: normalizeDescription(updates.description),
  };
}

export function moveCabinetContextPoi(
  poi: CabinetContextPoi,
  point: LatLngPoint,
): CabinetContextPoi {
  return { ...poi, point };
}
