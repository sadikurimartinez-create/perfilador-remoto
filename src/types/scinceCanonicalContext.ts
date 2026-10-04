import type { InegiTerritorialResult } from "@/lib/inegiTerritorialResolver";
import type { ProjectAccessCode } from "@/types/institutionalProjectAccess";

export type ScinceCanonicalCode =
  | "SCINCE_CANONICAL_ACCESS_DENIED" | "SCINCE_CANONICAL_GEOGRAPHY_MISSING"
  | "SCINCE_CANONICAL_GEOGRAPHY_INVALID" | "SCINCE_CANONICAL_GEOMETRY_UNSUPPORTED"
  | "SCINCE_RADIUS_CONFIGURATION_REQUIRED" | "SCINCE_CANONICAL_POINT_INVALID" | "SCINCE_CANONICAL_DATA_UNAVAILABLE" | "MULTIUNIT_QUERY_LIMIT_EXCEEDED" | "SCINCE_QUERY_TIMEOUT";
export type ScinceCanonicalContextResult =
  | { success: false; code: ScinceCanonicalCode; accessCode?: ProjectAccessCode }
  | { success: true; projectId: string; geographyId: string; geographyType: "INDIVIDUAL" | "CORRIDOR" | "POLYGON";
      geographyFingerprint: string; spatialMode: "CANONICAL_POINT" | "CANONICAL_LINE" | "CANONICAL_AREA";
      queryCoordinate: { lat: number; lng: number } | null;
      multiunit?: import("./scinceMultiunit").ScinceMultiunitObservation;
      // V2.2 carries compact content without enabling historical UI/PPC materialization.
      compactSnapshot?: import('./scinceCompactSnapshot').ScinceCompactSnapshotV2;
      reviewView?: import('./scinceCompactSnapshot').ScinceReviewView;
      datasetId: string | null; datasetYear: number | null; datasetVersion: string | null;
      geographicLevel: InegiTerritorialResult["geographicLevel"] | null;
      demographicGeographicLevel: "AGEB" | "MANZANA" | null; sourceRowKey: string | null;
      demographics: InegiTerritorialResult["demographics"] | null;
      provenance: InegiTerritorialResult["provenance"] | null; limitations: string[];
    };
