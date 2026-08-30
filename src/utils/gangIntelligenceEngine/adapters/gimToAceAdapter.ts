import { GangEvidenceMatrix } from "../models/gangIntelligenceTypes";

/**
 * ACEGimPayload - Contrato de datos seguro para auditoría institucional.
 * Alimenta al Analytical Consistency Engine (ACE) sin proveer lógicas forenses o narrativas crudas.
 */
export interface ACEGimPayload {
  confidenceScore: number;
  limitationsCount: number;
  hasTraceability: boolean;
  sourceIntegrityStatus?: "VERIFIED" | "READY_WITH_LIMITATIONS" | "NOT_READY";
  authorityClassification?: "AUTHORITATIVE" | "NON_AUTHORITATIVE" | "LEGACY_UNCLASSIFIED";
  nonAuthoritativeSourcesCount?: number;
  humanValidationStatus?: "NOT_REQUIRED" | "READY_FOR_HUMAN_REVIEW" | "APPROVED" | "REJECTED";
  validatedByUserId?: string | null;
  humanValidatedAt?: string | null;
  contradictoryEvidenceCount: number;
  evidenceCount: {
    graffiti: number;
    osintEvents: number;
  };
  evidenceDescriptions: string[];
  analyticalObservations: string[];
  lineage?: {
    evidenceIds: string[];
    findingIds: string[];
    analysisIds: string[];
    providerProvenance: string[];
  };
  // AGREGADO: Metadatos cualitativos ricos de Madurez OSINT (ADR-009.10.2 / OBS-009.10.1.2-001)
  osintMaturity?: {
    totalEventsCount: number;
    limitedEventsCount: number;
    mediumEventsCount: number;
    highEventsCount: number;
    globalLimitations: string[];
  };
}

export class GimToAceAdapter {
  /**
   * Adapta una GangEvidenceMatrix (GEM) a un ACEGimPayload seguro enfocado en gobernanza,
   * excluyendo conclusiones forenses o de culpabilidad directa de acuerdo con la Regla ACE-GIM-002.
   */
  public static bridge(gem: GangEvidenceMatrix | null | undefined): ACEGimPayload | null {
    if (!gem) return null;

    // Convertir la confianza cualitativa de GIM en un score numérico para ACE
    let confidenceScore = 0;
    const confidenceLevel = gem.presenceEvidence?.confidence || "NONE";
    switch (confidenceLevel) {
      case "HIGH":
        confidenceScore = 90;
        break;
      case "MEDIUM":
        confidenceScore = 70;
        break;
      case "LOW":
        confidenceScore = 40;
        break;
      default:
        confidenceScore = 0;
        break;
    }

    // Evaluar la cantidad de limitaciones de forma segura
    let limitationsCount = 0;
    if (gem.presenceEvidence?.remarks && gem.presenceEvidence.remarks.trim().length > 0) {
      limitationsCount = 1;
    }

    // Extraer descripciones factuales de evidencia de grafitis y OSINT
    const evidenceDescriptions: string[] = [];
    if (gem.graffitiEvidence) {
      gem.graffitiEvidence.forEach(g => {
        evidenceDescriptions.push(`Grafiti con simbología asociada: ${g.symbologyMatch}`);
      });
    }
    if (gem.osintEvidence?.events) {
      gem.osintEvidence.events.forEach(e => {
        evidenceDescriptions.push(`Reporte OSINT de tipo ${e.eventType} registrado en coordenadas del polígono`);
      });
    }

    // Extraer observaciones analíticas estructuradas sin emitir juicios penales directos
    const analyticalObservations: string[] = [];
    if (gem.territorialInfluence) {
      gem.territorialInfluence.forEach(t => {
        analyticalObservations.push(`Influencia de tipo ${t.influenceType || "PASSIVE"} con nivel de actividad ${t.activityLevel || "UNKNOWN"}`);
      });
    }

    const hasTraceability = Array.isArray(gem.traceabilityLog) && gem.traceabilityLog.length > 0;
    const nonAuthoritativeSourcesCount = (gem.traceabilityLog || []).filter((record) =>
      record.sourceAuthority === "NON_AUTHORITATIVE" ||
      record.sourceAuthority === "SIMULATED" ||
      record.sourceAuthority === "LEGACY_UNCLASSIFIED" ||
      record.sourceIntegrityStatus === "SIMULATED" ||
      record.sourceIntegrityStatus === "LEGACY_UNCLASSIFIED"
    ).length;

    const evidenceIds = (gem.traceabilityLog || []).map((record) => record.evidenceId || record.id).filter(Boolean);
    const findingIds = Array.from(new Set((gem.traceabilityLog || []).flatMap((record) => record.findingIds || [])));
    const analysisIds = Array.from(new Set((gem.traceabilityLog || []).flatMap((record) => record.analysisIds || [])));
    const providerProvenance = Array.from(new Set((gem.traceabilityLog || []).map((record) => record.providerProvenance || record.sourceName).filter(Boolean)));

    // Poblado cualitativo rico de madurez OSINT (ADR-009.10.2 / OBS-009.10.1.2-001)
    let totalEventsCount = 0;
    let limitedEventsCount = 0;
    let mediumEventsCount = 0;
    let highEventsCount = 0;
    const globalLimitations: string[] = [];

    if (gem.osintEvidence?.events) {
      gem.osintEvidence.events.forEach(e => {
        totalEventsCount++;
        const status = e.qualityStatus || "MEDIUM";
        if (status === "LIMITED") {
          limitedEventsCount++;
        } else if (status === "HIGH") {
          highEventsCount++;
        } else {
          mediumEventsCount++;
        }

        if (e.limitations) {
          e.limitations.forEach(lim => {
            if (!globalLimitations.includes(lim)) {
              globalLimitations.push(lim);
            }
          });
        }
      });
    }

    return {
      confidenceScore,
      limitationsCount,
      hasTraceability,
      sourceIntegrityStatus: gem.metadata.sourceIntegrityStatus || (nonAuthoritativeSourcesCount > 0 ? "NOT_READY" : "VERIFIED"),
      authorityClassification: gem.metadata.authorityClassification || (nonAuthoritativeSourcesCount > 0 ? "NON_AUTHORITATIVE" : "AUTHORITATIVE"),
      nonAuthoritativeSourcesCount,
      humanValidationStatus: gem.metadata.humanValidationStatus || "READY_FOR_HUMAN_REVIEW",
      validatedByUserId: gem.metadata.validatedByUserId ?? null,
      humanValidatedAt: gem.metadata.humanValidatedAt ?? null,
      contradictoryEvidenceCount: 0, // Reservado para correlaciones cruzadas avanzadas
      evidenceCount: {
        graffiti: gem.graffitiEvidence?.length || 0,
        osintEvents: gem.osintEvidence?.eventsFound || gem.osintEvidence?.events?.length || 0
      },
      evidenceDescriptions,
      analyticalObservations,
      lineage: {
        evidenceIds,
        findingIds,
        analysisIds,
        providerProvenance
      },
      osintMaturity: totalEventsCount > 0 ? {
        totalEventsCount,
        limitedEventsCount,
        mediumEventsCount,
        highEventsCount,
        globalLimitations
      } : undefined
    };
  }
}
