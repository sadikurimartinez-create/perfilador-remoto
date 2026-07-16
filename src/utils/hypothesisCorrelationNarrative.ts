import { InvestigationHypothesis } from "./hypothesisLifecycle";
import { IntelligenceEvidenceObject } from "./evidenceGovernanceEngine";
import { FusionResult } from "./hypothesisCorrelationEngine";

export class HypothesisCorrelationNarrative {
  /**
   * Transforma la matriz matemática de correlación de evidencias en una explicación criminológica estructurada de cinco partes.
   */
  public static generateNarrative(
    hypothesis: InvestigationHypothesis,
    result: FusionResult,
    evidences: IntelligenceEvidenceObject[]
  ): string {
    const relatedEvidences = evidences.filter(ev => 
      ev.hipotesisRelacionadas.includes(hypothesis.id) || 
      ev.hipotesisRelacionadas.includes(hypothesis.expedienteId)
    );

    // 1. Cabecera e Hipótesis Original
    let narrative = `HIPÓTESIS ORIGINAL:\n${hypothesis.hipotesisInicial}\n\n`;

    // 2. Evidencias que la impactan
    narrative += `EVIDENCIAS QUE LA IMPACTAN:\n`;
    if (relatedEvidences.length === 0) {
      narrative += `Ninguna evidencia asociada registrada en el sistema.\n`;
    } else {
      relatedEvidences.forEach((ev, idx) => {
        let relType = "COMPLEMENTA";
        const matchedEvent = result.correlationEvents.find(evt => evt.evidenciasOrigen.includes(ev.id));
        if (matchedEvent) {
          relType = matchedEvent.tipoRelacion;
        }
        narrative += `${idx + 1}. Fuente: ${ev.fuente} (${ev.tipo}) | Relación: ${relType}\n`;
      });
    }
    narrative += `\n`;

    // 3. Cambio Producido
    let changeProduced: "FORTALECIDA" | "DEBILITADA" | "MODIFICADA" = "MODIFICADA";
    if (result.hcsScore >= 75) {
      changeProduced = "FORTALECIDA";
    } else if (result.hcsScore < 40) {
      changeProduced = "DEBILITADA";
    }
    narrative += `CAMBIO PRODUCIDO:\n${changeProduced}\n\n`;

    // 4. Justificación Analítica
    narrative += `JUSTIFICACIÓN:\n`;
    
    // Si hay conflictos de cifra negra u contradicciones
    if (result.conflicts.length > 0) {
      narrative += `El análisis integrado evidencia una convergencia multidominio con conflictos de discrepancia activa:\n`;
      result.conflicts.forEach(c => {
        narrative += `- [CONFLICTO DETECTADO] Entre ${c.fuenteA} y ${c.fuenteB}. ${c.descripcion} Tratamiento metodológico: ${c.tratamiento}.\n`;
      });
    } else {
      narrative += `El análisis integrado evidencia una convergencia multidominio limpia y consistente entre:\n`;
    }

    if (result.correlationEvents.length > 0) {
      result.correlationEvents.forEach(evt => {
        narrative += `- ${evt.justificacionAnalitica}\n`;
      });
    } else {
      narrative += `- No se detectaron patrones causales robustos entre las evidencias disponibles.\n`;
    }

    // Agregar la justificación de diversidad epistémica
    narrative += `- [DIVERSIDAD EPISTÉMICA] El Score de Convergencia Final se calculó en ${result.hcsScore}/100, influenciado por un Factor de Diversidad de ${result.warnings.length === 0 ? "ALTO" : "BAJO"} nivel trans-disciplinario.\n\n`;

    // 5. Nivel de Confianza
    let confidenceLevel: "ALTO" | "MEDIO" | "BAJO" = "BAJO";
    if (result.hcsScore >= 80) confidenceLevel = "ALTO";
    else if (result.hcsScore >= 50) confidenceLevel = "MEDIO";

    narrative += `NIVEL DE CONFIANZA:\n${confidenceLevel}`;

    return narrative;
  }
}
