/**
 * Types and Mappers for the PANDILLAS (Gangs) Module.
 * Designed for CEIPOL - SSP Aguascalientes.
 */

export interface GangMember {
  nombre: string;
  alias: string;
  rol: string;
  edad?: number | string;
  antecedentes?: string;
}

export interface GangEntity {
  id?: string;
  projectId?: string;
  nombre: string;
  zonaInfluencia: string;
  coordenadas?: { lat: number; lng: number };
  poligono?: { lat: number; lng: number }[];
  antagonicas: string[];
  integrantes: GangMember[];
  grafitiInfo?: {
    texto?: string;
    simbolos?: string;
    patrones?: string;
    imageUrl?: string;
  };
  archivosAnexos?: {
    nombre: string;
    size: number;
    tipo: string;
    contexto?: string;
  }[];
  createdAt?: number;
  createdBy?: string;
}

export interface FusionResult {
  ficha: {
    nombre: string;
    zona: string;
    integrantes: GangMember[];
    estructuraJerarquica: string; // "Piramidal", "Horizontal", "Celular", etc.
    descripcionEstructura: string;
    nivelRiesgo: "Bajo" | "Medio" | "Alto" | "Crítico";
    resumenInteligencia: string;
    crossCheckJuridico: string;
  };
  mapa: {
    geolocalizacion: { lat: number; lng: number; descripcion: string }[];
    areasCalientes: { lat: number; lng: number; radioMetros: number; intensidad: number }[];
    expansionTerritorial: string;
  };
  grafo: {
    nodos: { id: string; label: string; tipo: "pandilla" | "integrante" | "simbolo" | "zona"; grupo?: string; risk?: string }[];
    enlaces: { source: string; target: string; relacion: "conflicto" | "alianza" | "pertenece" | "actividad" }[];
  };
  alertas: {
    tipo: "incidente" | "territorio" | "actor" | "conflicto";
    severidad: "Baja" | "Media" | "Alta" | "Crítica";
    mensaje: string;
    fecha: string;
  }[];
}

/**
 * Normalizes user gang names and addresses to improve search matches.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s]/g, "") // Remove special chars
    .trim();
}

/**
 * Checks for potential duplicates or similar names using a simple Jaro-Winkler-like distance.
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeText(s1);
  const norm2 = normalizeText(s2);
  if (norm1 === norm2) return 1.0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.85;

  const set1 = new Set(norm1.split(" "));
  const set2 = new Set(norm2.split(" "));
  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) intersection++;
  }
  const union = new Set([...set1, ...set2]).size;
  return union > 0 ? intersection / union : 0;
}
