export class ConsistencyRules {
  /**
   * Calcula la distancia Haversine en metros entre dos puntos geográficos.
   */
  public static calculateHaversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000; // metros
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Determina el estatus y severidad cuantitativa basada en la matriz de desviación porcentual:
   * - 0% - 5%: PASS
   * - 5% - 10%: WARNING
   * - > 10%: FAILED
   */
  public static evaluateQuantitativeDeviation(
    expected: number,
    received: number
  ): {
    status: "PASS" | "WARNING" | "FAILED";
    deviationPercentage: number;
    severity: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  } {
    if (expected === 0) {
      return {
        status: received === 0 ? "PASS" : "FAILED",
        deviationPercentage: received === 0 ? 0 : 100,
        severity: received === 0 ? "NONE" : "HIGH"
      };
    }

    const diff = Math.abs(received - expected);
    const deviationPercentage = parseFloat(((diff / expected) * 100).toFixed(2));

    if (deviationPercentage <= 5) {
      return {
        status: "PASS",
        deviationPercentage,
        severity: "NONE"
      };
    } else if (deviationPercentage <= 10) {
      return {
        status: "WARNING",
        deviationPercentage,
        severity: "MEDIUM"
      };
    } else {
      return {
        status: "FAILED",
        deviationPercentage,
        severity: "HIGH"
      };
    }
  }
}
