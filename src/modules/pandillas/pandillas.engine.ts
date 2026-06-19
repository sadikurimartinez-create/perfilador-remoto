import { getScinceData, getDenueData } from "@/lib/osintActions";
import { PandillasService } from "./pandillas.service";
import { GangEntity, FusionResult } from "./pandillas.mapper";

/**
 * Pandillas intelligence orchestration engine.
 * Gathers extra context from internal system APIs (SCINCE demographic data, DENUE active business data)
 * to feed the Fusion and Sweep API with live, context-rich geo intelligence.
 */
export class PandillasEngine {
  /**
   * Run the full Sweep Orchestration:
   * 1. Check if the gang zone has coordinates. If not, fallback to default Aguascalientes Center coordinates (21.8853, -102.2916).
   * 2. Query internal APIs (getScinceData and getDenueData) to pull demographic and business data for the zone of influence.
   * 3. Construct a unified context payload detailing SCINCE and DENUE matches.
   * 4. Call the main AI and CSV sweep endpoint via PandillasService.
   */
  static async executeFullSweep(
    gang: GangEntity,
    userContext: string
  ): Promise<FusionResult & { scinceInfo?: any; denueInfo?: any; isAiGenerated: boolean; warning?: string }> {
    // Default coordinates: Aguascalientes Centro
    const lat = gang.coordenadas?.lat || 21.8853;
    const lng = gang.coordenadas?.lng || -102.2916;

    console.log(`[PandillasEngine] Iniciando barrido geoespacial en [${lat}, ${lng}]`);

    // Concurrent execution of internal APIs
    const [scinceData, denueData] = (await Promise.all([
      getScinceData(lat, lng).catch(() => ({ exito: false, error: "Fallo SCINCE" })),
      getDenueData(lat, lng, 350).catch(() => ({ exito: false, error: "Fallo DENUE" })),
    ])) as [any, any];

    // Build the enriched context
    let enrichmentPrompt = `
- Información de Entorno Extraída de APIs Internas:
* Datos Demográficos (INEGI SCINCE): ${
      scinceData.exito
        ? `Población: ${scinceData.poblacionTotal}, Viviendas: ${scinceData.viviendasTotales}, Grado de Marginación: ${scinceData.gradoMarginacion}`
        : "Sin datos demográficos."
    }
* Comercios Locales Activos (INEGI DENUE): ${
      denueData.exito && denueData.total > 0
        ? `Total comercios en radio: ${denueData.total}. Muestra de negocios: ${denueData.resumen}`
        : "Sin comercios reportados."
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
    };
  }
}
