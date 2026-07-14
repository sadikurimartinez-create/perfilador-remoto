import { MobilityFactor, EconomicAttractor } from "./models/territorialEvidenceTypes";

export class MobilityAnalyzer {
  public static analyze(
    projectData: any,
    validatedAttractors: EconomicAttractor[]
  ): MobilityFactor {
    // 1. Contar paradas de transporte en los atractores validados
    const transportNodeCount = validatedAttractors.filter(a => a.category === "TRANSPORTE").length;

    // 2. Extraer corredores y accesos viales del polígono de interés
    const mainAccessPoints: string[] = [];
    const geoLower = (projectData?.areaGeografica || "").toLowerCase();

    if (geoLower.includes("paseos") || geoLower.includes("aguascalientes")) {
      mainAccessPoints.push("Avenida Paseos de Aguascalientes");
      mainAccessPoints.push("Calle Paseos de Carboneras");
    } else {
      mainAccessPoints.push("Corredor Vial Primario de Acceso");
    }

    // 3. Evaluar la exposición peatonal basándose en el tipo de atractores
    let pedestrianExposure: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    const highExposureCategories = validatedAttractors.filter(
      a => a.category === "ESCUELA" || a.category === "TRANSPORTE" || a.category === "COMERCIO"
    ).length;

    if (highExposureCategories >= 3) {
      pedestrianExposure = "HIGH";
    } else if (highExposureCategories === 0) {
      pedestrianExposure = "LOW";
    }

    const vulnerabilityDescription = pedestrianExposure === "HIGH"
      ? "La confluencia de múltiples atractores peatonales genera altos flujos de personas expuestas en horarios específicos, requiriendo patrullaje focalizado."
      : "El entorno registra flujos peatonales moderados y regulares orientados al abasto local y traslados domiciliarios estándar.";

    return {
      transportNodeCount,
      mainAccessPoints,
      vulnerabilityDescription,
      pedestrianExposure
    };
  }
}
