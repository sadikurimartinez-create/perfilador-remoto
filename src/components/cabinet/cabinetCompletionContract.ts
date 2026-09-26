import type { DraftProjectGeography } from "@/utils/canonicalProjectGeography";
import type { TerritorialEvidenceReference } from "@/utils/territorialEvidenceReference";
import type { StreetViewCapturePayload } from "@/modules/streetView/streetViewMapper";
import type { CabinetContextPoi } from "./cabinetContextPoi";

export type CabinetGeometryType = "individual" | "lineal" | "poligono";

export type CabinetTerritorialReference = TerritorialEvidenceReference;

export interface CabinetStreetViewEvidence {
  territorialRef: CabinetTerritorialReference;
  capture: StreetViewCapturePayload;
}

export interface CabinetCompletionResult {
  geometryType: CabinetGeometryType;
  draftGeography: DraftProjectGeography;
  streetViewEvidence: CabinetStreetViewEvidence[];
  contextPois: CabinetContextPoi[];
}