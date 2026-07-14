import {
  TerritorialEvidenceMatrix,
  UrbanStructure,
  EconomicAttractor,
  MobilityFactor,
  EnvironmentalRiskFactor,
  TerritorialPressureIndex,
  OperationalImplication
} from "./models/territorialEvidenceTypes";

export class TerritorialEvidenceBuilder {
  public static build(
    projectData: any,
    urban: UrbanStructure,
    attractors: EconomicAttractor[],
    mobility: MobilityFactor,
    env: EnvironmentalRiskFactor
  ): TerritorialEvidenceMatrix {
    // 1. Calcular el Territorial Pressure Index (TPI) compuesto (Mapeo de la relación SEM -> TEM)
    const territorialPressure = this.calculateTPI(urban, attractors, mobility, env);

    // 2. Formular las implicaciones operativas tácticas de remediación y patrullaje
    const operationalImplications = this.generateOperationalImplications(attractors, env, mobility);

    // 3. Evaluar la confianza del expediente en base al número de evidencias de soporte reales
    const supportCount = attractors.length + (env.abandonedLotsCount > 0 ? 1 : 0);
    const operationalConfidence = Math.min(40 + supportCount * 10, 100);

    return {
      projectId: projectData?.id || "PR-001",
      projectName: projectData?.nombre || "Proyecto de Análisis Territorial",
      temVersion: "TEM-2.0-Core",
      territorialContext: {
        tipologyName: urban.landUse,
        areaSizeMeters: 500, // radio estándar
        description: `Entorno urbano clasificado como uso de suelo ${urban.landUse.toLowerCase()} con una estructura de calles de tipo ${urban.streetGridType.toLowerCase()}.`
      },
      urbanStructure: urban,
      economicAttractors: attractors,
      mobilityFactors: mobility,
      environmentalRiskFactors: env,
      territorialPressure,
      operationalImplications,
      traceability: {
        variablesQueried: ["uso_de_suelo", "trama_calle", "atractores_economicos", "alumbrado_publico", "predios_baldios"],
        denueVersion: "DENUE 2026",
        queryTimestamp: new Date().toISOString()
      },
      confidence: {
        operationalConfidence,
        evidenceSupportCount: supportCount
      },
      validationStatus: "VALIDATED"
    };
  }

  private static calculateTPI(
    urban: UrbanStructure,
    attractors: EconomicAttractor[],
    mobility: MobilityFactor,
    env: EnvironmentalRiskFactor
  ): TerritorialPressureIndex {
    // A) Proximidad a hotspots (SEM): Mayor presión si los atractores están muy pegados a hotspots
    const avgDistance = attractors.length > 0
      ? attractors.reduce((sum, a) => sum + a.distanceToHotspotMeters, 0) / attractors.length
      : 250;
    const hotspotProximityScore = Math.max(10, Math.min(100, Math.round(100 - avgDistance / 3)));

    // B) Densidad de atractores: Mayor si hay más atractores comerciales/escolares en el sector
    const attractorDensityScore = Math.min(100, attractors.length * 15 + 10);

    // C) Exposición por movilidad: Alta si hay paradas de transporte y exposición peatonal alta
    let mobilityExposureScore = 50;
    if (mobility.pedestrianExposure === "HIGH") mobilityExposureScore = 85;
    if (mobility.pedestrianExposure === "LOW") mobilityExposureScore = 25;
    if (mobility.transportNodeCount > 0) mobilityExposureScore = Math.min(100, mobilityExposureScore + 10);

    // D) Vulnerabilidad ambiental: Alta si hay predios baldíos, fallas de iluminación, o deterioro
    let environmentalVulnerabilityScore = 30;
    if (env.lightingScore === "CRITICAL") environmentalVulnerabilityScore += 40;
    if (env.lightingScore === "DEFICIENT") environmentalVulnerabilityScore += 20;
    if (env.abandonedLotsCount > 0) environmentalVulnerabilityScore += Math.min(30, env.abandonedLotsCount * 15);
    if (env.structuralDeterioration === "HIGH") environmentalVulnerabilityScore += 10;
    environmentalVulnerabilityScore = Math.min(100, environmentalVulnerabilityScore);

    return {
      hotspotProximityScore,
      attractorDensityScore,
      mobilityExposureScore,
      environmentalVulnerabilityScore
    };
  }

  private static generateOperationalImplications(
    attractors: EconomicAttractor[],
    env: EnvironmentalRiskFactor,
    mobility: MobilityFactor
  ): OperationalImplication[] {
    const implications: OperationalImplication[] = [];

    // Patrullaje focalizado en atractores de alta influencia situacional
    const highInfluence = attractors.filter(a => a.situationalInfluenceLevel === "HIGH");
    if (highInfluence.length > 0) {
      implications.push({
        directiveType: "PATROL_INCREASE",
        locationReference: "Sector perimetral de conectores comerciales",
        rationale: `Incrementar patrullaje dinámico en horarios críticos en los accesos de ${highInfluence[0].name} debido a alta aglomeración temporal que modifica las condiciones de exposición situacional.`
      });
    }

    // Remediación de infraestructura ante fallas de iluminación u obstrucciones
    if (env.lightingScore === "CRITICAL" || env.lightingScore === "DEFICIENT" || env.abandonedLotsCount > 0) {
      implications.push({
        directiveType: "PHYSICAL_REMEDIATION",
        locationReference: "Sector perimetral con predios baldíos o alumbrado deficiente",
        rationale: `Solicitar la instalación/reparación de luminarias públicas y cerramiento de predios baldíos para reducir los puntos ciegos y restaurar la vigilancia natural.`
      });
    }

    // Puntos fijos o tácticos en nodos de alta movilidad
    if (mobility.transportNodeCount > 0) {
      implications.push({
        directiveType: "TACTICAL_POINT",
        locationReference: "Área de ascenso/descenso de transporte público",
        rationale: `Establecer presencia disuasiva fija en horarios de mayor confluencia en las paradas de transporte registradas para resguardar la seguridad de transeúntes en tiempos de espera.`
      });
    }

    // Fallback estándar si no hay detonantes específicos
    if (implications.length === 0) {
      implications.push({
        directiveType: "COMMUNITY_SURVEILLANCE",
        locationReference: "Vialidad principal del sector",
        rationale: `Fomentar canales de vigilancia comunitaria y coordinación con vecinos para robustecer la vigilancia natural del entorno.`
      });
    }

    return implications;
  }
}
