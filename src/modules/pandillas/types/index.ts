/**
 * Types and Interfaces for the PANDILLAS (Gangs) Module.
 * Formulated under Phase 2.1 Architectural Contract.
 * CEIPOL - SSP Aguascalientes.
 */

export type IntelligenceState =
  | "descubierto"
  | "hipotesis"
  | "validacion"
  | "corroborado"
  | "certificado"
  | "vigente"
  | "historico";

export type LinkState =
  | "propuesto"
  | "validando"
  | "certificado"
  | "descartado";

export interface GangProfile {
  id: string;
  identidad: {
    nombre: string;
    alias: string[];
    simbolos: string[];
  };
  estadoInteligencia: IntelligenceState;
  organizacion: {
    nivel: string;
    descripcion: string;
  };
  integrantes: string[];  // Array of GangMemberCandidate ids or relationship ids
  territorios: string[];  // Array of GangTerritory ids
  eventos: string[];      // Array of event ids
  evidencias: string[];    // Array of Evidence ids
  indicadores: {
    riesgo: number;       // 0 to 100
    cohesion: number;     // 0 to 100
    expansion: number;    // 0 to 100
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface GangMemberCandidate {
  id: string;
  personaId: string;      // Identifier (CURP or project-specific ID from Perfilador)
  personaNombre: string;
  personaAlias: string;
  pandillaId: string;
  rolPropuesto: string;
  estado: LinkState;
  fechaRegistro: Date;
  usuarioRegistro: string;
}

export interface AnalyticalRelationship {
  id: string;
  origen: string;         //CURP or Gang ID
  destino: string;        //CURP or Gang ID
  tipoRelacion: string;   // e.g. "pertenece", "rivalidad", "alianza"
  confianza: number;      // 0 to 100
  evidencia: string[];    // Array of Evidence ids
  algoritmoOrigen: string; // e.g. "EME-JaroWinkler-v1", "Manual"
  estado: LinkState;
  analista: string | null;
  fecha: Date;
}

export interface VariableEvaluada {
  name: string;
  value: any;
  weight: number;
}

export interface ILEMemory {
  id: string;
  entidadOrigen: string;
  entidadDestino: string;
  tipoRelacion: string;
  algoritmo: string;
  variablesEvaluadas: VariableEvaluada[];
  resultado: string;
  confianza: number;
  fecha: Date;
  estado: string;
  usuarioValidacion: string | null;
}

export interface Evidence {
  id: string;
  tipo: "grafiti" | "tatuaje" | "red_social" | "arma" | "reporte_911" | "otro";
  fuente: string;
  fecha: Date;
  hash?: string | null;   // SHA-256 only when supplied/computed from real upstream file bytes
  forensicIntegrity?: import("@/utils/forensicFileIntegrity").ForensicFileIntegrity | null;
  confianza: "Baja" | "Media" | "Alta" | "Certificada";
  relacion: string | null; // UUID of related relationship or entity
}

export interface GangTerritory {
  id: string;
  type: "point" | "line" | "polygon";
  geometry: any;          // Coordinates structure or spatial vectors
  confidence: number;     // 0 to 100
}

export interface AuditLog {
  idAuditoria: string;
  timestamp: number;
  usuarioId: string;
  accion: string;
  moduloOrigen: string;
  detalles: any;
  ipDireccion: string;
  dispositivo: string;
}
