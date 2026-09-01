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
    // ADR-020.34 C7:
    // Territorial analysis requires demonstrated spatial context.
    // Never substitute a missing expediente geography with a default location.
    const rawLat = projectData?.latitud ?? projectData?.lat;
    const rawLng = projectData?.longitud ?? projectData?.lng;
    const rawRadius = projectData?.radio ?? projectData?.analysisRadius;

    const centerLat =
      typeof rawLat === "number"
        ? rawLat
        : typeof rawLat === "string" && rawLat.trim().length > 0
          ? Number(rawLat)
          : Number.NaN;

    const centerLng =
      typeof rawLng === "number"
        ? rawLng
        : typeof rawLng === "string" && rawLng.trim().length > 0
          ? Number(rawLng)
          : Number.NaN;

    const radiusMeters =
      typeof rawRadius === "number"
        ? rawRadius
        : typeof rawRadius === "string" && rawRadius.trim().length > 0
          ? Number(rawRadius)
          : Number.NaN;

    const hasValidTerritorialGeography =
      Number.isFinite(centerLat) &&
      centerLat >= -90 &&
      centerLat <= 90 &&
      Number.isFinite(centerLng) &&
      centerLng >= -180 &&
      centerLng <= 180 &&
      Number.isFinite(radiusMeters) &&
      radiusMeters > 0;

    if (!hasValidTerritorialGeography) {
      throw new Error(
        "TerritorialIntelligenceEngine requiere latitud, longitud y radio territoriales validos del expediente; no se permite fabricar contexto geografico."
      );
    }

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
