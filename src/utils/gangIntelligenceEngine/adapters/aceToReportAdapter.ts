import { AnalyticalConsistencyReport, CertifiedGangAnalysisPayload, ACEPayload } from "../../analyticalConsistencyEngine/models/aceTypes";
import { GimReportGeoSanitizer } from "../sanitizers/gimReportGeoSanitizer";

/**
 * Adaptador de Salida de ACE hacia el Report Engine (AceToReportAdapter)
 * Traduce de forma controlada el resultado de la auditoría de consistencia de ACE y el contexto GIM
 * en el contrato seguro y certificado CertifiedGangAnalysisPayload.
 */
export class AceToReportAdapter {
  /**
   * Diccionario de Gobernanza del Lenguaje (SSPE):
   * Reemplaza jergas de control físico absoluto o inculpación penal directa
   * por términos neutros descriptivos analíticos.
   */
  private static readonly STYLE_DICTIONARY: { regex: RegExp; replacement: string }[] = [
    {
      regex: /pertenece a la pandilla/gi,
      replacement: "presenta indicios de afinidad o asociación simbólica compatible con"
    },
    {
      regex: /miembro confirmado/gi,
      replacement: "sujeto identificado con factores de atención perimetral o asociación simbólica"
    },
    {
      regex: /controla territorio/gi,
      replacement: "registra una posible área de influencia delictiva activa o simbólica"
    },
    {
      regex: /controla el territorio/gi,
      replacement: "registra una posible área de influencia delictiva activa o simbólica"
    },
    {
      regex: /zona dominada/gi,
      replacement: "zona de oportunidad con factores de vulnerabilidad ambiental"
    },
    {
      regex: /control absoluto/gi,
      replacement: "presencia recurrente con factores de facilitación ambiental"
    },
    {
      regex: /dominio criminal/gi,
      replacement: "dinámicas grupales de carácter territorial asimétrico"
    }
  ];

  /**
   * Traduce y suaviza el lenguaje crudo según las reglas de gobernanza editorial
   */
  private static applyLanguageGovernance(text: string): string {
    if (!text) return "";
    let cleanText = text;
    for (const rule of this.STYLE_DICTIONARY) {
      cleanText = cleanText.replace(rule.regex, rule.replacement);
    }
    return GimReportGeoSanitizer.sanitizeDescription(cleanText);
  }

  /**
   * Construye el CertifiedGangAnalysisPayload certificado a partir de los resultados de auditoría de ACE y su payload de entrada.
   */
  public static bridge(
    report: AnalyticalConsistencyReport,
    payload: ACEPayload
  ): CertifiedGangAnalysisPayload | null {
    // Si no hay contexto de pandillas (GIM), o la auditoría determinó bloqueo (FAILED) para el módulo criminológico
    if (!payload.gimContext) {
      return null;
    }

    // Regla de seguridad: Si la consistencia general del ACE falló (FAILED), o el reporte bloquea el expediente
    const validatedByACE = report.globalStatus !== "FAILED";
    const validationStatus = report.globalStatus === "WARNING" ? "CERTIFIED_WITH_LIMITATIONS" : "CERTIFIED";

    // Si ACE falló, el Report Engine NO debe renderizar contenido GIM fáctico (Regla de bloqueo total)
    if (!validatedByACE) {
      return {
        schemaVersion: "GIM-REPORT-1.0",
        validationStatus: "CERTIFIED_WITH_LIMITATIONS", // Forzado a descarte/limitado
        confidenceScore: 0,
        validatedByACE: false,
        limitations: ["El expediente de geointeligencia no superó la auditoría de consistencia analítica de ACE."],
        analyticalFindings: ["Análisis suspendido por inconsistencia documental o violación de neutralidad lingüística."],
        territorialSummary: ["No certificado para publicación."],
        evidenceSummary: ["Métricas factuales invalidadas."],
        traceabilityReference: payload.gimContext.hasTraceability ? "REF-INVALIDATED-ACE" : "REF-NONE"
      };
    }

    const gim = payload.gimContext;

    // 1. Sanitizar y aplicar gobernanza lingüística a hallazgos analíticos
    const analyticalFindings = (gim.analyticalObservations || []).map(obs => 
      this.applyLanguageGovernance(obs)
    );

    // 2. Sanitizar descripciones de evidencia y asociar su volumen
    const evidenceSummary: string[] = [];
    if (gim.evidenceCount.graffiti > 0) {
      evidenceSummary.push(`Se auditaron ${gim.evidenceCount.graffiti} registros visuales de marcas/graffiti en el sector.`);
    }
    if (gim.evidenceCount.osintEvents > 0) {
      evidenceSummary.push(`Se identificaron ${gim.evidenceCount.osintEvents} incidentes compatibles en fuentes abiertas (OSINT).`);
    }
    (gim.evidenceDescriptions || []).forEach(desc => {
      evidenceSummary.push(this.applyLanguageGovernance(desc));
    });

    // 3. Sanitización geoespacial de zonas de influencia
    const territorialSummary: string[] = [];
    const centroid = payload.tceContext.centroid || { lat: 21.80929, lng: -102.26964 };
    const approximateZoneName = GimReportGeoSanitizer.approximateLocation(centroid.lat, centroid.lng);
    territorialSummary.push(`Presencia simbólica o dinámica observada en el sector: ${approximateZoneName}.`);

    // 4. Copiar y sanitizar limitaciones metodológicas
    const limitations: string[] = [];
    if (gim.limitationsCount > 0) {
      limitations.push(`El levantamiento táctico registra ${gim.limitationsCount} limitaciones metodológicas de campo.`);
    }
    if (gim.confidenceScore < 80) {
      limitations.push("Advertencia metodológica: confianza cualitativa inicial moderada; requiere supervisión periódica.");
    }

    // 5. Trazabilidad
    const traceabilityReference = gim.hasTraceability ? `CERT-GIM-2026-${payload.projectId.replace(/[^A-Za-z0-9]/g, "")}` : "CERT-PENDING";

    return {
      schemaVersion: "GIM-REPORT-1.0",
      validationStatus,
      confidenceScore: gim.confidenceScore,
      validatedByACE,
      limitations,
      analyticalFindings,
      territorialSummary,
      evidenceSummary,
      traceabilityReference
    };
  }
}
