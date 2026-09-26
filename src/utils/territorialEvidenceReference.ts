import type { CorridorVertexRole } from "@/utils/canonicalProjectGeography";

export type TerritorialEvidenceReference =
  | {
      geometryType: "individual";
      nodeId: "INDIVIDUAL";
      order: 1;
      role: "POINT";
    }
  | {
      geometryType: "lineal";
      nodeId: string;
      order: number;
      role: CorridorVertexRole;
    }
  | {
      geometryType: "poligono";
      nodeId: string;
      order: number;
      role: "VERTEX";
    };