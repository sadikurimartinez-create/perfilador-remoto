import { ACEAlert, ACEAuditLog, ACEBlockingReason, ACEPayload, AnalyticalConsistencyReport } from "./models/aceTypes";
import { ConsistencyValidators } from "./consistencyValidators";

// Carga segura y dinámica de módulos de Node en el servidor para evitar que Webpack intente empaquetarlos en el navegador
const isServer = typeof window === "undefined";
const fs = isServer ? eval("require")("fs") : null;
const path = isServer ? eval("require")("path") : null;

export class AnalyticalConsistencyEngine {
  private static readonly VERSION = "1.0";

  private static getHistoryFile(): string {
    if (typeof window === "undefined" && path) {
      return path.join(process.cwd(), "scratch", "ace_audit_history.json");
    }
    return "";
  }

  /**
   * Ejecuta la auditoría integral cruzada de consistencia sobre todo el Ecosistema MMAS.
   */
  public static audit(
    payload: ACEPayload,
    executionType: "EXPORT" | "VALIDATE" = "VALIDATE"
  ): AnalyticalConsistencyReport {
    const alerts: ACEAlert[] = [];
    const blockingReasons: ACEBlockingReason[] = [];
    const auditedAt = new Date().toISOString();

    // 1. Ejecutar Validadores Individuales
    const quantitative = ConsistencyValidators.validateQuantitative(payload, alerts, blockingReasons);
    const spatial = ConsistencyValidators.validateSpatial(payload, alerts, blockingReasons);
    const temporal = ConsistencyValidators.validateTemporal(payload, alerts, blockingReasons);
    const criminological = ConsistencyValidators.validateCriminological(payload, alerts, blockingReasons);
    const document = ConsistencyValidators.validateDocument(payload, alerts, blockingReasons);

    // 2. Determinar Estatus Global de Calidad
    let globalStatus: "PASS" | "WARNING" | "FAILED" = "PASS";
    if (
      quantitative.status === "FAILED" ||
      spatial.status === "FAILED" ||
      temporal.status === "FAILED" ||
      document.status === "FAILED"
    ) {
      globalStatus = "FAILED";
    } else if (
      quantitative.status === "WARNING" ||
      spatial.status === "WARNING" ||
      temporal.status === "WARNING" ||
      criminological.status === "WARNING" ||
      document.status === "WARNING"
    ) {
      globalStatus = "WARNING";
    }

    // 3. Calcular Nivel de Confianza de la Auditoría (Ajuste 4)
    let overallConfidence = 100;
    alerts.forEach(alert => {
      if (alert.severity === "HIGH") {
        overallConfidence -= 15;
      } else if (alert.severity === "MEDIUM") {
        overallConfidence -= 5;
      } else if (alert.severity === "LOW") {
        overallConfidence -= 2;
      }
    });
    if (overallConfidence < 0) overallConfidence = 0;

    // 4. Registrar y persistir en Historial de Auditorías (Ajuste 5)
    const newLog: ACEAuditLog = {
      date: auditedAt,
      execution: executionType,
      status: globalStatus,
      warnings: alerts.filter(a => a.severity !== "LOW").length,
      aceVersion: this.VERSION
    };

    const auditHistory = this.saveAndGetHistory(newLog);

    // 5. Ensamblar Reporte de Consistencia Analítica
    const report: AnalyticalConsistencyReport = {
      metadata: {
        projectId: payload.projectId,
        auditedAt,
        aceVersion: this.VERSION
      },
      quantitativeConsistency: {
        status: quantitative.status,
        difference: quantitative.maxDifference,
        severity: quantitative.status === "FAILED" ? "HIGH" : quantitative.status === "WARNING" ? "MEDIUM" : "NONE"
      },
      spatialConsistency: {
        status: spatial.status,
        centroidDistanceMeters: spatial.centroidDistanceMeters,
        radiusDifferencePercentage: spatial.radiusDifferencePercentage
      },
      temporalConsistency: {
        status: temporal.status,
        coverageInconsistent: temporal.coverageInconsistent
      },
      criminologicalConsistency: {
        status: criminological.status,
        hypothesisContradictory: criminological.hypothesisContradictory
      },
      documentConsistency: {
        status: document.status,
        mapsOrChartsInconsistent: document.mapsOrChartsInconsistent
      },
      globalStatus,
      overallConfidence,
      alerts,
      auditHistory
    };

    // Agregar bloque de razones de bloqueo en caso de FAILED (Ajuste 1)
    if (globalStatus === "FAILED" && blockingReasons.length > 0) {
      report.blockingReason = blockingReasons;
    }

    return report;
  }

  /**
   * Guarda el log en un archivo JSON en scratch y devuelve el historial completo.
   */
  private static saveAndGetHistory(newLog: ACEAuditLog): ACEAuditLog[] {
    const history: ACEAuditLog[] = [];
    const historyFile = this.getHistoryFile();

    if (!historyFile || !fs || !path) {
      history.push(newLog);
      return history;
    }
    
    try {
      // Asegurar que el directorio scratch existe
      const scratchDir = path.dirname(historyFile);
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
      }

      if (fs.existsSync(historyFile)) {
        const raw = fs.readFileSync(historyFile, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          history.push(...parsed);
        }
      }
    } catch (err) {
      // Ignorar errores menores de lectura para que no truene el auditor
    }

    // Mantener un historial máximo de los últimos 20 registros para eficiencia
    history.push(newLog);
    if (history.length > 20) {
      history.shift();
    }

    try {
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), "utf8");
    } catch (err) {
      // Ignorar errores menores de escritura
    }

    return history;
  }
}
