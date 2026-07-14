import { TerritorialEvidenceMatrix } from "./models/territorialEvidenceTypes";
import { AttractorAnalyzer } from "./attractorAnalyzer";
import { UrbanContextAnalyzer } from "./urbanContextAnalyzer";
import { EnvironmentalRiskAnalyzer } from "./environmentalRiskAnalyzer";
import { MobilityAnalyzer } from "./mobilityAnalyzer";
import { TerritorialEvidenceBuilder } from "./territorialEvidenceBuilder";
import { TerritorialValidator } from "./territorialValidator";

export class TerritorialIntelligenceEngine {
  /**
   * Procesa de manera íntegra y determinista las fuentes de datos para producir la TEM (Capítulo 6)
   */
  public static process(
    projectData: any,
    tceData: any,
    rawAttractors: any[],
    inegiData: any,
    albumData: any[],
    hotspots: { lat: number; lng: number; weight?: number }[] = []
  ): TerritorialEvidenceMatrix {
    const centerLat = projectData?.latitud || projectData?.lat || 21.88234;
    const centerLng = projectData?.longitud || projectData?.lng || -102.28234;
    const radiusMeters = projectData?.radio || 500; // radio por defecto

    // 1. Analizar e identificar atractores económicos filtrados por distancia (DENUE)
    const validatedAttractors = AttractorAnalyzer.analyze(
      rawAttractors,
      centerLat,
      centerLng,
      radiusMeters,
      hotspots
    );

    // 2. Analizar la estructura de uso de suelo y trama vial (TCE/CIE)
    const urban = UrbanContextAnalyzer.analyze(projectData, tceData);

    // 3. Analizar riesgos y condiciones ambientales (Alumbrado/Baldíos)
    const env = EnvironmentalRiskAnalyzer.analyze(projectData, inegiData, albumData);

    // 4. Analizar flujos de movilidad y exposición peatonal
    const mobility = MobilityAnalyzer.analyze(projectData, validatedAttractors);

    // 5. Construir la Territorial Evidence Matrix (TEM) integral con TPI e Implicaciones
    const tem = TerritorialEvidenceBuilder.build(
      projectData,
      urban,
      validatedAttractors,
      mobility,
      env
    );

    // 6. Validar completitud e integridad de la TEM con ACE
    const completenessCheck = TerritorialValidator.validateCompleteness(tem);
    if (!completenessCheck.isValid) {
      tem.validationStatus = "WARNING";
    }

    return tem;
  }
}
