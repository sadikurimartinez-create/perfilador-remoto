import { InvestigationHypothesis, HypothesisState } from "./hypothesisLifecycle";
import { IntelligenceEvidenceObject, EvidenceType } from "./evidenceGovernanceEngine";

export type EvidenceRelationship =
  | "FORTALECE"
  | "DEBILITA"
  | "CONTRADICE"
  | "NEUTRAL"
  | "COMPLEMENTA";

export interface EvidenceCorrelationEvent {
  id: string;
  fecha: number;
  evidenciasOrigen: string[]; // IDs de evidencias combinadas
  hipotesisObjetivo: string;  // ID de la hipótesis
  tipoRelacion: EvidenceRelationship;
  pesoCorrelacion: number;    // Score ponderado del evento
  justificacionAnalitica: string;
  motoresParticipantes: string[];
  nivelConfianza: "ALTO" | "MEDIO" | "BAJO";
}

export interface EvidenceConflict {
  fuenteA: string;
  fuenteB: string;
  descripcion: string;
  tratamiento: "Mantener incertidumbre analítica";
}

export interface FusionResult {
  hcsScore: number; // Hypothesis Convergence Score (0-100)
  correlationEvents: EvidenceCorrelationEvent[];
  conflicts: EvidenceConflict[];
  hypothesisStatusRecommendation: "EN_ANALISIS" | "HIPOTESIS_SUSTENTADA_POR_CONVERGENCIA" | "CONFIRMADA";
  warnings: string[];
}

export class HypothesisCorrelationEngine {
  /**
   * Ejecuta el análisis de fusión multidominio de evidencias asociadas a una hipótesis.
   */
  public static analyzeCorrelation(
    hypothesis: InvestigationHypothesis,
    evidences: IntelligenceEvidenceObject[]
  ): FusionResult {
    const correlationEvents: EvidenceCorrelationEvent[] = [];
    const conflicts: EvidenceConflict[] = [];
    const warnings: string[] = [];

    // Filtrar evidencias pertenecientes a esta hipótesis
    const relatedEvidences = evidences.filter(ev => 
      ev.hipotesisRelacionadas.includes(hypothesis.id) || 
      ev.hipotesisRelacionadas.includes(hypothesis.expedienteId)
    );

    if (relatedEvidences.length === 0) {
      return {
        hcsScore: 0,
        correlationEvents: [],
        conflicts: [],
        hypothesisStatusRecommendation: "EN_ANALISIS",
        warnings: ["No existen evidencias asociadas a la hipótesis para evaluar su correlación."]
      };
    }

    // 1. Clasificar por Dominios
    const domains = new Set<string>();
    relatedEvidences.forEach(ev => {
      if (ev.tipo === "FIELD_PHOTO") domains.add("FIELD_PHOTO");
      else if (ev.tipo === "STREET_VIEW") domains.add("STREET_VIEW");
      else if (ev.tipo === "CRIME_STATISTICS" || ev.tipo === "GIS_LAYER") domains.add("STATISTICAL");
      else if (ev.tipo === "OSINT" || ev.tipo === "SOCIAL_MEDIA") domains.add("OSINT");
      else domains.add("OTHER");
    });

    const numDomains = domains.size;

    // 2. Determinar Factor de Diversidad Epistémica (FDE)
    let fde = 0.40;
    if (numDomains === 2) fde = 0.70;
    else if (numDomains === 3) fde = 0.90;
    else if (numDomains >= 4) fde = 1.00;

    if (numDomains === 1) {
      warnings.push("WARNING HCEF: Monocultivo de evidencia detectado. Se requiere diversidad analítica para robustecer la hipótesis.");
    }

    // 3. Evaluar Relaciones y Patrones entre Evidencias (Fusión)
    const hasFieldEvidence = domains.has("FIELD_PHOTO") || domains.has("STREET_VIEW");
    const hasStatsEvidence = domains.has("STATISTICAL");
    const hasOsintEvidence = domains.has("OSINT");

    // Patrón 1: Vulnerabilidad Física + Incidencia Estadística
    if (hasFieldEvidence && hasStatsEvidence) {
      const pFieldIds = relatedEvidences.filter(e => e.tipo === "FIELD_PHOTO" || e.tipo === "STREET_VIEW").map(e => e.id);
      const pStatsIds = relatedEvidences.filter(e => e.tipo === "CRIME_STATISTICS" || e.tipo === "GIS_LAYER").map(e => e.id);

      correlationEvents.push({
        id: `evt-corr-${Date.now()}-1`,
        fecha: Date.now(),
        evidenciasOrigen: [...pFieldIds, ...pStatsIds],
        hipotesisObjetivo: hypothesis.id,
        tipoRelacion: "FORTALECE",
        pesoCorrelacion: 85,
        justificacionAnalitica: "La coincidencia entre las vulnerabilidades físicas de infraestructura urbana observadas en campo y el mapa de concentración estadística delictiva consolida causalmente el factor de oportunidad.",
        motoresParticipantes: ["VisualEvidenceEngine", "StatisticalIntelligenceEngine"],
        nivelConfianza: "ALTO"
      });
    }

    // Patrón 2: Reporte Social (OSINT) + Verificación de Campo
    if (hasFieldEvidence && hasOsintEvidence) {
      const pFieldIds = relatedEvidences.filter(e => e.tipo === "FIELD_PHOTO" || e.tipo === "STREET_VIEW").map(e => e.id);
      const pOsintIds = relatedEvidences.filter(e => e.tipo === "OSINT" || e.tipo === "SOCIAL_MEDIA").map(e => e.id);

      correlationEvents.push({
        id: `evt-corr-${Date.now()}-2`,
        fecha: Date.now(),
        evidenciasOrigen: [...pFieldIds, ...pOsintIds],
        hipotesisObjetivo: hypothesis.id,
        tipoRelacion: "COMPLEMENTA",
        pesoCorrelacion: 75,
        justificacionAnalitica: "Las quejas comunitarias o notas periodísticas digitalizadas en fuentes abiertas se complementan y validan empíricamente mediante la inspección visual táctica de campo.",
        motoresParticipantes: ["VisualEvidenceEngine", "OsintMaturityLayer"],
        nivelConfianza: "ALTO"
      });
    }

    // Patrón 3: Cifra Negra (Discrepancia OSINT vs Estadística)
    if (hasOsintEvidence && hasStatsEvidence) {
      const osintRecords = relatedEvidences.filter(e => e.tipo === "OSINT" || e.tipo === "SOCIAL_MEDIA");
      const statsRecords = relatedEvidences.filter(e => e.tipo === "CRIME_STATISTICS" || e.tipo === "GIS_LAYER");

      // Si hay denuncias públicas pero la estadística oficial es baja o nula
      const statsSum = statsRecords.reduce((acc, cr) => acc + (cr.pesoEvidencial || 0), 0);
      const osintSum = osintRecords.reduce((acc, o) => acc + (o.pesoEvidencial || 0), 0);

      if (statsSum < 40 && osintSum > 50) {
        conflicts.push({
          fuenteA: "Estadística Delictiva Oficial (CIE/SIE)",
          fuenteB: "Reportes Ciudadanos y OSINT Abierto",
          descripcion: "Discrepancia severa: Los registros de denuncias de la fiscalía muestran nula o baja incidencia en el cuadrante, contradiciendo múltiples testimonios e informes comunitarios de asaltos activos en fuentes abiertas.",
          tratamiento: "Mantener incertidumbre analítica"
        });

        correlationEvents.push({
          id: `evt-corr-${Date.now()}-3`,
          fecha: Date.now(),
          evidenciasOrigen: [...osintRecords.map(e => e.id), ...statsRecords.map(e => e.id)],
          hipotesisObjetivo: hypothesis.id,
          tipoRelacion: "COMPLEMENTA",
          pesoCorrelacion: 60,
          justificacionAnalitica: "Se registra la discrepancia bajo el supuesto de cifra negra delictiva debido al temor de los ciudadanos a formalizar denuncias, manteniendo la sospecha táctica.",
          motoresParticipantes: ["StatisticalIntelligenceEngine", "OsintMaturityLayer"],
          nivelConfianza: "MEDIO"
        });
      }
    }

    // 4. Calcular el Score de Convergencia Base (SMC)
    let totalWeightedScore = 0;
    let totalRelationWeight = 0;

    relatedEvidences.forEach(ev => {
      let relationFactor = 1.0; // COMPLEMENTA por defecto
      let rType: EvidenceRelationship = "COMPLEMENTA";

      // Determinar la relación basada en la naturaleza y en los eventos generados
      const associatedEvent = correlationEvents.find(evt => evt.evidenciasOrigen.includes(ev.id));
      if (associatedEvent) {
        rType = associatedEvent.tipoRelacion;
      }

      if (rType === "FORTALECE") relationFactor = 1.2;
      else if (rType === "COMPLEMENTA") relationFactor = 1.0;
      else if (rType === "NEUTRAL") relationFactor = 0.5;
      else if (rType === "DEBILITA") relationFactor = -0.5;
      else if (rType === "CONTRADICE") relationFactor = -1.2;

      totalWeightedScore += ev.pesoEvidencial * relationFactor;
      totalRelationWeight += 1;
    });

    const count = Math.max(1, totalRelationWeight);
    const smc = (totalWeightedScore / count) * (1 + Math.log(Math.max(1, numDomains)));

    // 5. Aplicar FDE para obtener el Hypothesis Convergence Score (HCS)
    const rawHcs = smc * fde;
    const hcsScore = Math.max(0, Math.min(100, Math.round(rawHcs)));

    // 6. Proponer Estado Analítico del Ciclo de Vida
    let hypothesisStatusRecommendation: "EN_ANALISIS" | "HIPOTESIS_SUSTENTADA_POR_CONVERGENCIA" | "CONFIRMADA" = "EN_ANALISIS";
    if (hcsScore >= 80) {
      hypothesisStatusRecommendation = "CONFIRMADA";
    } else if (hcsScore >= 50) {
      hypothesisStatusRecommendation = "HIPOTESIS_SUSTENTADA_POR_CONVERGENCIA";
    }

    return {
      hcsScore,
      correlationEvents,
      conflicts,
      hypothesisStatusRecommendation,
      warnings
    };
  }
}
