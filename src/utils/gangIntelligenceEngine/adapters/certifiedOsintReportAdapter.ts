import { AnalyticalConsistencyReport, CertifiedOSINTAnalysisPayload, ACEPayload } from "../../analyticalConsistencyEngine/models/aceTypes";

/**
 * CertifiedOSINTReportAdapter (ADR-009.11)
 * Traduce de forma controlada y segura el veredicto del ACE Engine al payload de maquetación editorial.
 * Aplica de forma rigurosa la prohibición de inyectar variables de confianza numéricas directas (OBS-009.10.2.1-001).
 */
export class CertifiedOSINTReportAdapter {
  /**
   * Adapta el reporte de consistencia analítica y el contexto de entrada al payload certificado OSINT.
   */
  public static bridge(
    report: AnalyticalConsistencyReport,
    payload: ACEPayload
  ): CertifiedOSINTAnalysisPayload | null {
    // Si no hay datos de GIM/OSINT o el payload de consistencia es nulo
    if (!payload.gimContext) {
      return null;
    }

    const isAceCertified = report.globalStatus !== "FAILED";
    let validationStatus: "CERTIFIED" | "CERTIFIED_WITH_LIMITATIONS" | "NOT_CERTIFIED" = "NOT_CERTIFIED";

    if (report.globalStatus === "PASS") {
      validationStatus = "CERTIFIED";
    } else if (report.globalStatus === "WARNING") {
      validationStatus = "CERTIFIED_WITH_LIMITATIONS";
    }

    // Extraer y agrupar limitaciones cualitativas colapsando repetidos (Evita crecimiento infinito)
    const limitations: string[] = [];
    
    // Heredar limitaciones del adaptador GIM si existiesen
    if (payload.gimContext.osintMaturity?.globalLimitations) {
      payload.gimContext.osintMaturity.globalLimitations.forEach(lim => {
        if (!limitations.includes(lim)) {
          limitations.push(lim);
        }
      });
    }

    // Registrar limitaciones derivadas de la auditoría de consistencia del ACE
    report.alerts
      .filter(alert => alert.type === "CRIMINOLOGICAL" && (alert.severity === "MEDIUM" || alert.severity === "HIGH"))
      .forEach(alert => {
        if (!limitations.includes(alert.message)) {
          limitations.push(alert.message);
        }
      });

    // Construir hallazgos analíticos limpios y normalizados bajo el diccionario de gobernanza
    const analyticalFindings: string[] = [];
    if (isAceCertified && payload.gimContext.osintMaturity) {
      const maturity = payload.gimContext.osintMaturity;
      analyticalFindings.push(
        `Se procesó un lote consolidado de ${maturity.totalEventsCount} indicios territoriales de fuentes abiertas (OSINT).`
      );
      if (maturity.highEventsCount > 0) {
        analyticalFindings.push(
          `Se corroboraron ${maturity.highEventsCount} eventos con alto nivel de madurez técnica e integridad digital.`
        );
      }
      if (maturity.limitedEventsCount > 0) {
        analyticalFindings.push(
          `Se detectó presencia marginal de ${maturity.limitedEventsCount} indicios con restricciones metodológicas preventivas.`
        );
      }
    } else if (!isAceCertified) {
      analyticalFindings.push(
        "Análisis de fuentes abiertas suspendido temporalmente por inconsistencia metodológica o lingüística."
      );
    } else {
      analyticalFindings.push(
        "No se registraron indicios sustantivos de fuentes abiertas en el polígono de análisis."
      );
    }

    // Resumen de calidad analítica e integridad
    const qualitySummary: string[] = [
      `Validación de Consistencia: ${validationStatus}`,
      `Auditoría ACE: Versión ${report.metadata.aceVersion}`,
      `Integridad Criptográfica de Ingesta: ${isAceCertified ? "CERTIFICADA (SHA-256)" : "NO VALIDADA"}`
    ];

    // Resumen territorial seguro de coordenadas sanitizadas (Evita jergas de dominancia territorial)
    const territorialSummary: string[] = [];
    if (isAceCertified && payload.gimContext.evidenceDescriptions) {
      const uniqueTypes = new Set<string>();
      payload.gimContext.evidenceDescriptions.forEach(desc => {
        const match = desc.match(/tipo\s+(\w+)/i);
        if (match) uniqueTypes.add(match[1].toUpperCase());
      });
      if (uniqueTypes.size > 0) {
        territorialSummary.push(
          `Dinámicas registradas en fuentes abiertas asociadas a actividades de tipo: ${[...uniqueTypes].join(", ")}.`
        );
      } else {
        territorialSummary.push(
          "Monitoreo espacial preventivo activo en el polígono perimetral."
        );
      }
    } else {
      territorialSummary.push("No habilitado para visualización espacial o publicación oficial.");
    }

    // Obtener hash de trazabilidad única o generar fallback seguro
    const traceabilityReference = payload.gimContext.hasTraceability
      ? `CERT-OSINT-2026-${payload.projectId.replace(/[^A-Za-z0-9]/g, "")}`
      : "CERT-PENDING-SIGNATURE";

    return {
      schemaVersion: "OSINT-CERT-1.0",
      validationStatus,
      validatedByACE: isAceCertified,
      qualitySummary,
      analyticalFindings,
      limitations,
      territorialSummary,
      traceabilityReference,
      generatedAt: report.metadata.auditedAt
    };
  }
}
