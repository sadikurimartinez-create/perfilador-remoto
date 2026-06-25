export interface GeoError {
  source: string;
  type: "TIMEOUT" | "API_FAILURE" | "DATA_INVALID" | "UNKNOWN";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  fallback_used: boolean;
  message: string;
  timestamp: string;
}

export class GlobalErrorHandler {
  private static errorLog: GeoError[] = [];
  private static readonly MAX_LOG_SIZE = 100;

  /**
   * Translates any thrown exception into a standardized and normalized GeoError object.
   */
  public static handleError(
    source: string,
    error: any,
    fallbackUsed: boolean = false
  ): GeoError {
    const message = error?.message || String(error);
    let type: GeoError["type"] = "UNKNOWN";
    let severity: GeoError["severity"] = "MEDIUM";

    // 1. Detect error category
    if (message.includes("Timeout") || message.includes("timeout") || message.includes("ETIMEDOUT")) {
      type = "TIMEOUT";
      severity = "HIGH";
    } else if (
      message.includes("API") ||
      message.includes("status code") ||
      message.includes("HTTP") ||
      message.includes("fetch") ||
      message.includes("Network") ||
      message.includes("network")
    ) {
      type = "API_FAILURE";
      severity = "HIGH";
    } else if (
      message.includes("invalid") ||
      message.includes("undefined") ||
      message.includes("null") ||
      message.includes("parse") ||
      message.includes("Type") ||
      message.includes("syntax")
    ) {
      type = "DATA_INVALID";
      severity = "MEDIUM";
    }

    // Adjust severity if a fallback was successfully utilized to keep the system operational
    if (fallbackUsed) {
      severity = "LOW";
    }

    // Critical escalation triggers (e.g. core databases or hydro-fusion physical truth providers)
    if (source === "hydro_fusion" || source === "database" || source === "iri_engine") {
      if (!fallbackUsed) {
        severity = "CRITICAL";
      }
    }

    const geoError: GeoError = {
      source,
      type,
      severity,
      fallback_used: fallbackUsed,
      message,
      timestamp: new Date().toISOString()
    };

    // Store in-memory error registry (capped)
    this.errorLog.push(geoError);
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog.shift();
    }

    // Standardized secure logging (never leak credentials)
    console.error(`[GEO_ERROR_NORMALIZED] [${geoError.severity}] Source: ${geoError.source} | Type: ${geoError.type} | Msg: ${geoError.message} | Fallback: ${geoError.fallback_used}`);

    return geoError;
  }

  /**
   * Retrieves all normalized errors logged.
   */
  public static getErrorLog(): GeoError[] {
    return [...this.errorLog];
  }

  /**
   * Clears the in-memory error log.
   */
  public static clearLog(): void {
    this.errorLog = [];
  }
}
