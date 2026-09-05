import {
  GeointGovernanceStatus,
  GeointGovernanceStatusValue,
} from "./geointGovernance";
import type {
  GoogleCandidateFinding,
  GoogleIntelligenceEvidence,
} from "@/utils/googleIntelligenceContract";

/**
 * ADR-018 v1.0 — GEOINT Controlled Sweep Engine Types
 * Taxonomía oficial y estructura de datos para barridos gobernados CEIPOL.
 */

export type GeoIntSweepCategory =
  | "ACECHO_ESCONDITE"
  | "GRAFFITI_PANDILLA"
  | "DENUE_POI"
  | "OSINT_GENERAL";

export interface GeoIntSweepCategoryMeta {
  code: GeoIntSweepCategory;
  label: string;
  description: string;
  source: string;
  color: string;
  icon: string;
}

export const GEOINT_SWEEP_CATEGORIES: Record<GeoIntSweepCategory, GeoIntSweepCategoryMeta> = {
  ACECHO_ESCONDITE: {
    code: "ACECHO_ESCONDITE",
    label: "Lugares de Acecho o Escondite",
    description: "Lugares de ocultamiento, puntos vulnerables o zonas tácticas de vigilancia.",
    source: "Reconocimiento Táctico Terrestre / Street View",
    color: "#3b82f6", // Azul táctico
    icon: "👁️",
  },
  GRAFFITI_PANDILLA: {
    code: "GRAFFITI_PANDILLA",
    label: "Grafitis de Pandillas",
    description: "Grafitis, simbología territorial y marcas asociadas a grupos de delincuencia.",
    color: "#a855f7", // Morado territorial
    icon: "🎨",
    source: "Simbología de Pandillas / Marcas de Dominio",
  },
  DENUE_POI: {
    code: "DENUE_POI",
    label: "Puntos de Interés DENUE",
    description: "Establecimientos, puntos comerciales e infraestructura económica de riesgo.",
    color: "#06b6d4", // Cían socioeconómico
    icon: "🏢",
    source: "INEGI DENUE / Directorio de Establecimientos",
  },
  OSINT_GENERAL: {
    code: "OSINT_GENERAL",
    label: "OSINT General",
    description: "Información proveniente de fuentes abiertas, referencias territoriales, datos contextuales y redes autorizadas.",
    color: "#f59e0b", // Ámbar de inteligencia
    icon: "📡",
    source: "Fuentes Abiertas OSINT / Redes Sociales Autorizadas",
  },
};

export interface GeoIntSweepFindingPayload {
  source: "GEOINT_CONTROLLED_SWEEP";
  category: GeoIntSweepCategory;
  status: GeointGovernanceStatusValue;
  traceabilityId: string;
  sourceEvidenceId: string;
  geographyId?: string | null;
  geographyType?: "INDIVIDUAL" | "CORRIDOR" | "POLYGON" | null;
  createdBy: string;
  originalFindingId: string;
  geometry: {
    lat: number;
    lng: number;
    heading?: number;
    pitch?: number;
    fov?: number;
  };
  file_url: string;
  comentario: string;
  timestamp: string;
  googleIntelligenceEvidence?: GoogleIntelligenceEvidence;
  googleCandidateFinding?: GoogleCandidateFinding;
  candidateType?: GoogleCandidateFinding["candidateType"];
  observableFactors?: string[];
  explanation?: string;
  confidence?: GoogleCandidateFinding["confidence"];
  confidenceBasis?: string;
  limitations?: string[];
  metadata?: {
    sweepType?: "RADIAL" | "CORREDOR" | "MULTICAPA";
    radiusMeters?: number;
    panoramaLat?: number;
    panoramaLng?: number;
    panoramaKey?: string;
    distanceMeters?: number;
    nodeOrder?: number;
    sweepGeographyContext?: unknown;
    googleIntelligenceEvidence?: GoogleIntelligenceEvidence;
    googleCandidateFinding?: GoogleCandidateFinding;
  };
}

export { GeointGovernanceStatus };
