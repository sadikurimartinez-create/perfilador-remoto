/**
 * @file gangIntelligenceTypes.ts
 * @description Contratos de datos, tipos e interfaces TypeScript para el Gang Intelligence Module (GIM).
 * 
 * DESIGN BLUEPRINT (ADR-008.2):
 * 1. El GIM expone un contrato unificado (GangEvidenceMatrix) que el IntelligenceIntegrationContext (IIC)
 *    consume de forma pasiva a través de interfaces, garantizando el desacoplamiento de lógicas internas.
 * 2. Aunque este contrato se especializa actualmente en la detección e interpretación de pandillas,
 *    su diseño extensible (estructurado en matrices de influencia y evidencias secundarias) permite
 *    su evolución futura para alojar células criminales, redes complejas o grupos híbridos.
 */

/**
 * Registro individual en el Libro de Trazabilidad e Historial de Procedencia del GIM.
 */
export interface GIMTraceabilityRecord {
  id: string; // ID único del indicio o evidencia
  sourceType: "OFFICIAL_DATABASE" | "OSINT_CRAWLER" | "ANALYST_FIELD_WORK" | "VEE_GRAFFITI";
  sourceName: string; // Nombre del sistema o documento de procedencia (ej. "VEE.graffitiEvidence")
  capturedAt: string; // Timestamp ISO-8601 de captura del indicio
  operatorId: string; // Identificador del analista o sistema responsable de la ingesta
  transformationApplied: string; // Tipo de limpieza o normalización (ej. "Filtro perimetral Haversine")
  gimConfidenceAllocated: number; // Porcentaje de confianza local (0-100) asignado por GIM
  consumersList: string[]; // Componentes internos que consumieron este dato (ej. ["HIE", "ReportEngine"])
}

/**
 * Resumen analítico de la presencia detectada en el cuadrante.
 */
export interface GangPresenceEvidence {
  status: "CONFIRMED" | "REFERENCED" | "NO_EVIDENCE";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  matchedGroups: string[]; // Arreglo de nombres de grupos detectados en el polígono
  findingsCount: number; // Suma de indicios corroborados
  remarks: string; // Nota metodológica o aclaración de limitaciones analíticas
}

/**
 * Registro estructurado de la influencia territorial o simbólica de un grupo en el cuadrante.
 */
export interface TerritorialInfluence {
  gangName: string;
  subgroups: string[]; // Células o sub-grupos asociados
  activityLevel: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  influenceType: "TERRITORIAL" | "SYMBOLIC" | "PASSIVE" | "NONE";
  approximateCoordinates: { lat: number; lng: number } | null;
}

/**
 * Registro de evidencias visuales interpretadas por el GIM a partir del VEE.
 * NOTA: GIM consume metadatos pre-clorificados por el VEE; no analiza imágenes directamente.
 */
export interface GraffitiTerritorialEvidence {
  id: string; // ID único de la relación simbólica
  veeReferenceId: string; // ID de la foto original en el Visual Evidence Engine
  symbologyMatch: string; // Identificación simbólica de la pinta o tag (ej. "Número 13")
  detectedGangName: string; // Pandilla asociada por la simbología
  riskLevel: "ALTO" | "MEDIO" | "BAJO" | "NO_DETERMINADO";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  coordinates: { lat: number; lng: number };
}

/**
 * Registro estructurado de incidentes de fuentes abiertas (OSINT) perimetrales.
 */
export interface OsintGangEvidence {
  eventId: string; // ID del indicio OSINT
  sourceUrl: string; // Enlace de la noticia, foro o reporte social
  detectedGroup: string; // Pandilla o actor citado
  eventType: "RIÑA" | "AMENAZA" | "ENFRENTAMIENTO" | "REFERENCIA_GENERAL";
  coordinates: { lat: number; lng: number };
  distanceMeters: number; // Distancia calculada mediante Haversine respecto al centroide del proyecto
  validatedAt: string; // Timestamp ISO-8601 de validación perimetral
}

/**
 * Matriz Certificada de Inteligencia de Pandillas (GEM).
 * Es el contrato definitivo que GIM inyectará en el IntelligenceIntegrationContext.
 */
export interface GangEvidenceMatrix {
  metadata: {
    module: "GIM";
    version: "1.0.0"; // Versionado semántico del código del motor
    generatedAt: string; // Timestamp de compilación
    schemaVersion: "ADR-008.2"; // Versión del esquema del contrato unificado para retrocompatibilidad
  };
  presenceEvidence: GangPresenceEvidence;
  territorialInfluence: TerritorialInfluence[];
  graffitiEvidence: GraffitiTerritorialEvidence[];
  osintEvidence: {
    eventsFound: number;
    events: OsintGangEvidence[];
  };
  traceabilityLog: GIMTraceabilityRecord[];
  status: "READY" | "READY_WITH_LIMITATIONS" | "NOT_READY"; // Calificación de disponibilidad local
}
