/**
 * Types and Mappers for the PANDILLAS (Gangs) Module.
 * Designed for CEIPOL - SSP Aguascalientes.
 */

export interface GangMember {
  nombre: string;
  alias: string;
  rol: string; // Legacy field, kept for backward compatibility
  edad?: number | string;
  antecedentes?: string;
  señasParticulares?: string;
  tatuajes?: string;
  complexion?: string;
  estatura?: string;
  vestimentaUsual?: string;
  telefonoRedes?: string;
  vehiculosAsociados?: string;

  // REENGINEERING: CORE FIELDS
  sexo?: "Masculino" | "Femenino" | "Otro";
  curp?: string;
  domicilioConocido?: string;
  telefono?: string;
  fotografiaUrl?: string; // Base64 or mock avatar path

  // REENGINEERING: CRIMINOLOGICAL INFORMATION
  detencionesPrevias?: string;
  ingresosCentrosInternamiento?: string;
  consumoDrogas?: string;
  nivelViolencia?: "Bajo" | "Medio" | "Alto";
  riesgoCriminogeno?: "Bajo" | "Medio" | "Alto" | "Crítico";
  peligrosidadCalculada?: number; // Automatic computed danger rating (e.g. 0 to 100)

  // REENGINEERING: DISTINCTIVE FEATURES
  cicatrices?: string;
  marcasDistintivas?: string;

  // REENGINEERING: OCCUPATIONAL INFORMATION
  lugarTrabajo?: string;
  actividadEconomica?: string;
  escuela?: string;

  // REENGINEERING: STATUS WITHIN THE GANG
  estatusPandilla?:
    | "Líder"
    | "Segundo al mando"
    | "Reclutador"
    | "Distribuidor"
    | "Vigilante"
    | "Operador"
    | "Integrante"
    | "Exintegrante"
    | "Colaborador externo";
  georreferencia?: {
    lat: number;
    lng: number;
    confidence?: number;
    status?: string;
  };
}

export interface GangRelationship {
  tipo: "rival" | "asociado";
  pandillaId?: string; // Id of linked gang
  pandillaNombre: string; // Name of linked gang
  tipoVinculo: string; // e.g. "Conflicto territorial", "Venta de estupefacientes", "Alianza de paso"
  fechaInicio?: string;
  nivelSeveridad?: "Bajo" | "Medio" | "Alto" | "Crítico"; // Level of conflict or cooperation
}

export interface GeointeligenciaShape {
  id: string;
  nombre: string;
  tipo: "poligono" | "corredor" | "buffer" | "zona_riesgo";
  puntos: { lat: number; lng: number }[]; // Array of points
  radio?: number; // Used for buffer circles
  nivelControlTerritorial: "Nulo" | "Bajo" | "Medio" | "Alto" | "Absoluto";
  riskLevel?: "low" | "medium" | "high";
  fechaActualizacion: string;
}

export interface TimelineEvent {
  id: string;
  fecha: string;
  titulo: string;
  descripcion: string;
  gravedad: "Baja" | "Media" | "Alta" | "Crítica";
  categoria: "enfrentamiento" | "detencion" | "grafiti" | "expansion" | "otro";
  lugar?: string;
}

export interface GraffitiImage {
  id: string;
  url: string; // Base64 or path
  descripcion?: string; // e.g. "Punto de venta", "Mensaje de advertencia"
  tipo?: "Identidad" | "Advertencia" | "Frontera" | "Punto de venta" | "Otro";
  fechaRegistro?: string;
}

export interface GangEntity {
  id?: string;
  projectId?: string;
  nombre: string;
  aliasConocidos?: string;
  fechaRegistro?: number;
  estatus: "Activa" | "Inactiva" | "En observación" | "Desarticulada";

  // DATOS GENERALES
  zonaInfluencia: string;
  coloniasAsociadas?: string[];
  municipiosAsociados?: string[];
  ilicitos?: ("Narcomenudeo" | "Robo" | "Extorsión" | "Homicidio" | "Lesiones" | "Daño en las cosas" | "Vandalismo" | "Otro")[];
  especificarOtroIlicito?: string;
  drogasConsumidas?: string[];
  modusOperandi?: string;
  simbolosIdentificacion?: string; // Graffiti or symbols
  peligrosidad?: "Bajo" | "Medio" | "Alto" | "Crítico";

  // LEGACY GEOMETRIES
  coordenadas?: { lat: number; lng: number };
  poligono?: { lat: number; lng: number }[];
  antagonicas?: string[];

  // REENGINEERED GEOMETRIES
  geometrias?: GeointeligenciaShape[];

  // RELATIONSHIPS
  relaciones?: GangRelationship[];

  // TIMELINE
  cronologiaEventos?: TimelineEvent[];

  // IMAGES OF GRAFFITIS / MESSAGES
  imagenesGrafiti?: GraffitiImage[];

  // MEMBERS
  integrantes: GangMember[];

  // LEGACY GRAFFITI INFO, KEPT FOR BACKWARD COMPATIBILITY
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
  geoReportId?: string;
  nivelRiesgo?: string; // Kept for backward compatibility
  resumenInteligencia?: string;
}

export interface FusionResult {
  ficha: {
    nombre: string;
    zona: string;
    integrantes: GangMember[];
    estructuraJerarquica: string;
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
 * Calculates member danger rating automatically.
 */
export function calculateMemberDanger(m: GangMember): number {
  let score = 20; // Base score
  if (m.estatusPandilla === "Líder") score += 35;
  else if (m.estatusPandilla === "Segundo al mando") score += 25;
  else if (m.estatusPandilla === "Reclutador" || m.estatusPandilla === "Distribuidor") score += 15;

  if (m.nivelViolencia === "Alto") score += 20;
  else if (m.nivelViolencia === "Medio") score += 10;

  if (m.riesgoCriminogeno === "Crítico") score += 20;
  else if (m.riesgoCriminogeno === "Alto") score += 15;
  else if (m.riesgoCriminogeno === "Medio") score += 5;

  if (m.antecedentes && m.antecedentes.length > 5) score += 5;
  if (m.detencionesPrevias && m.detencionesPrevias.length > 5) score += 5;

  return Math.min(100, score);
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

