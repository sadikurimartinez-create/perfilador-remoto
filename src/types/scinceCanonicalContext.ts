import type { InegiTerritorialResult } from "@/lib/inegiTerritorialResolver";
import type { ProjectAccessCode } from "@/types/institutionalProjectAccess";

export type ScinceCanonicalCode =
  | "SCINCE_CANONICAL_ACCESS_DENIED" | "SCINCE_CANONICAL_GEOGRAPHY_MISSING"
  | "SCINCE_CANONICAL_GEOGRAPHY_INVALID" | "SCINCE_CANONICAL_GEOMETRY_UNSUPPORTED"
  | "SCINCE_CANONICAL_POINT_INVALID" | "SCINCE_CANONICAL_DATA_UNAVAILABLE";
export type ScinceCanonicalContextResult =
  | { success: false; code: ScinceCanonicalCode; accessCode?: ProjectAccessCode }
  | { success: true; projectId: string; geographyId: string; geographyType: "INDIVIDUAL";
      geographyFingerprint: string; spatialMode: "CANONICAL_POINT";
      queryCoordinate: { lat: number; lng: number };
      datasetId: string | null; datasetYear: number | null; datasetVersion: string | null;
      geographicLevel: InegiTerritorialResult["geographicLevel"] | null;
      demographicGeographicLevel: "AGEB" | "MANZANA" | null; sourceRowKey: string | null;
      demographics: InegiTerritorialResult["demographics"] | null;
      provenance: InegiTerritorialResult["provenance"] | null; limitations: string[];
    };
