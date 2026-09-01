import { getScinceData, getDenueData, getTelegramOsintData } from "@/lib/osintActions";
import { PandillasService } from "./pandillas.service";
import { GangEntity, FusionResult } from "./pandillas.mapper";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";
import type { EpistemicIntegrityMetadata } from "@/types/epistemicIntegrity";
import { classifyEpistemicSource, type SourceRouteDescriptor } from "@/lib/providers/sourceRegistry";

/**
 * Pandillas intelligence orchestration engine.
 * Gathers extra context from internal system APIs (SCINCE demographic data, DENUE active business data, CEIPOL OSINT crawler)
 * to feed the Fusion and Sweep API with live, context-rich geo intelligence.
 */
export class PandillasEngine {
  /**
   * Run the full Sweep Orchestration:
   * 1. Validate the gang coordinates. If valid geography is absent, stop the territorial sweep without fabricating a fallback location.
   * 2. Query internal APIs (getScinceData, getDenueData, getTelegramOsintData) to pull demographic, business, and social OSINT data.
   * 3. Construct a unified context payload detailing SCINCE, DENUE, and OSINT matches.
   * 4. Call the main AI and CSV sweep endpoint via PandillasService.
   */
  static async executeFullSweep(
    gang: GangEntity,
    userContext: string
  ): Promise<FusionResult & { scinceInfo?: any; denueInfo?: any; externalSourceProvenance?: EpistemicIntegrityMetadata[]; sourceRouteClassifications?: SourceRouteDescriptor[]; isAiGenerated: boolean; warning?: string }> {
    const geoValidation = validateGeoIntegrity(gang.coordenadas?.lat, gang.coordenadas?.lng);
    const lat = geoValidation.latitude;
    const lng = geoValidation.longitude;

    if (lat === null || lng === null) {
      return {
        exito: false,
        razon: "Ausencia de coordenadas geográficas válidas. El barrido territorial requiere validación.",
        elementosFusionados: [],
        resumenEjecutivo: "La representación territorial requiere validación geográfica.",
        scoreRiesgo: 0,
        accionesSugeridas: [],
        origenDatos: "NONE",
        isAiGenerated: false,
        warning: "La representación territorial requiere validación geográfica."
      } as any;
    }

    console.log(`[PandillasEngine] Iniciando barrido geoespacial en [${lat}, ${lng}]`);

    // ADR-020.34 C9D3:
    // The OSINT territorial query must use only real source text.
    // Do not append a fixed municipality or invent a colony.
    const normalizedGangName =
      typeof gang.nombre === "string"
        ? gang.nombre.trim()
        : "";

    const normalizedInfluenceArea =
      typeof gang.zonaInfluencia === "string"
        ? gang.zonaInfluencia.trim()
        : "";

    const telegramQuery = [
      normalizedGangName
        ? `Pandilla ${normalizedGangName}`
        : "Pandilla",
      normalizedInfluenceArea
        ? normalizedInfluenceArea
        : ""
    ]
      .filter(Boolean)
      .join(" ");

    // Concurrent execution of internal APIs (SCINCE, DENUE, and OSINT Crawler)
    const [scinceData, denueData, telegramOsint] = (await Promise.all([
      getScinceData(lat, lng).catch(() => ({ exito: false, error: "Fallo SCINCE" })),
      getDenueData(lat, lng, 350).catch(() => ({ exito: false, error: "Fallo DENUE" })),
      getTelegramOsintData(telegramQuery).catch(() => ({ success: false, error: "Fallo OSINT" }))
    ])) as [any, any, any];
    const externalSourceProvenance = [scinceData, denueData, telegramOsint]
      .map((item) => item?.epistemicIntegrity)
      .filter(Boolean) as EpistemicIntegrityMetadata[];
    const sourceRouteClassifications = externalSourceProvenance
      .map((metadata) => classifyEpistemicSource(metadata))
      .filter(Boolean) as SourceRouteDescriptor[];
    const scinceRoute = classifyEpistemicSource(scinceData?.epistemicIntegrity);
    const denueRoute = classifyEpistemicSource(denueData?.epistemicIntegrity);
    const telegramRoute = classifyEpistemicSource(telegramOsint?.epistemicIntegrity);

    // Build the enriched context
    let enrichmentPrompt = `
- Información de Entorno Extraída de APIs Internas:
* Datos Demográficos (SCINCE / ${scinceRoute?.operationalMode || "UNKNOWN"}): ${
      scinceData.exito
        ? `Uso diagnostico no autoritativo. Población estimada: ${scinceData.poblacionTotal}, Viviendas: ${scinceData.viviendasTotales}, Grado de Marginación: ${scinceData.gradoMarginacion}`
        : "Sin datos demográficos."
    }
* Comercios Locales Activos (DENUE / ${denueRoute?.operationalMode || "UNKNOWN"}): ${
      denueRoute?.authoritative && denueData.exito && denueData.total > 0
        ? `Total comercios en radio: ${denueData.total}. Muestra de negocios: ${denueData.resumen}`
        : "Sin adquisición DENUE autoritativa disponible."
    }
* Análisis OSINT Complementario (${telegramRoute?.sourceType || "TELEGRAM_CONTEXT"} / ${telegramRoute?.operationalMode || "UNKNOWN"}): ${
      telegramOsint.success
        ? telegramOsint.osintSummary
        : "Sin correlaciones OSINT adicionales detectadas."
    }
`;

    // Append this to the user's manual notes
    const finalContext = `${userContext}\n\n${enrichmentPrompt.trim()}`;

    // Execute the backend intelligence sweep
    const result = await PandillasService.analyzeGang(gang, finalContext);

    return {
      ...result,
      scinceInfo: scinceData.exito ? scinceData : undefined,
      denueInfo: denueData.exito ? denueData : undefined,
      externalSourceProvenance,
      sourceRouteClassifications,
    };
  }
}
