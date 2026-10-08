import { getScinceData, getDenueData, getTelegramOsintData } from "@/lib/osintActions";
import { PandillasService } from "./pandillas.service";
import { GangEntity, FusionResult } from "./pandillas.mapper";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";
import type { EpistemicIntegrityMetadata } from "@/types/epistemicIntegrity";
import { classifyEpistemicSource, type SourceRouteDescriptor } from "@/lib/providers/sourceRegistry";
import { adaptDenueScinceSource } from "@/services/geoint/denueScinceOrchestrationAdapter";
import { adaptOsintSource } from "@/services/geoint/osintCanonicalOrchestrationAdapter";
import type { MultisourceOrchestrationItem } from "@/types/multisourceOrchestration";

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
  ): Promise<FusionResult & { scinceInfo?: any; denueInfo?: any; denueObservationDiagnostics?: Array<{ index: number; reason: string }>; externalSourceProvenance?: EpistemicIntegrityMetadata[]; sourceRouteClassifications?: SourceRouteDescriptor[]; sourceOrchestrationItems?: MultisourceOrchestrationItem[]; isAiGenerated: boolean; warning?: string }> {
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
    const denueScinceOrchestrationItems = [scinceData]
      .map((item) => adaptDenueScinceSource({
        expedienteId: gang.projectId,
        integrity: item?.epistemicIntegrity,
      }))
      .filter((item): item is MultisourceOrchestrationItem => item !== null);

    // Acquired DENUE items are observations, not the aggregate query descriptor.
    // Keep the provider's canonical identity and provenance; never fabricate an ID.
    const denueObservationDiagnostics: Array<{ index: number; reason: string }> = [];
    const denuePois: any[] = [];
    if (denueData?.epistemicIntegrity?.acquisitionStatus === "ACQUIRED") {
      const pois = Array.isArray(denueData.pois) ? denueData.pois : [];
      if (!pois.length) denueObservationDiagnostics.push({ index: -1, reason: "DENUE_OBSERVATIONS_UNAVAILABLE" });
      const identityCounts = new Map<string, number>();
      for (const poi of pois) {
        if (typeof poi?.sourceEvidenceId === "string") identityCounts.set(poi.sourceEvidenceId, (identityCounts.get(poi.sourceEvidenceId) || 0) + 1);
      }
      pois.forEach((poi: any, index: number) => {
        const identity = poi?.sourceEvidenceId;
        const integrity = poi?.epistemicIntegrity;
        let reason: string | undefined;
        const originalId = poi?.Id ?? poi?.DENUE_ID ?? poi?.denueId ?? poi?.CLEE ?? poi?.clee ?? poi?.Clee ?? poi?.id;
        if (typeof identity !== "string" || !/^denue:(?!(?:invalid|derived):)[a-zA-Z0-9_.:-]+$/.test(identity)
          || (originalId !== undefined && !/^[a-zA-Z0-9_.:-]+$/.test(String(originalId)))) reason = "DENUE_OBSERVATION_IDENTITY_UNAVAILABLE";
        else if (originalId !== undefined && identity !== `denue:${originalId}` && identity !== originalId) reason = "DENUE_OBSERVATION_IDENTITY_MISMATCH";
        else if ((identityCounts.get(identity) || 0) > 1) reason = "DENUE_DUPLICATE_OBSERVATION_IDENTITY";
        else if (poi.provider !== "INEGI_DENUE" || poi.source !== "DENUE"
          || integrity?.sourceId !== "inegi-denue-api" || integrity?.providerId !== "INEGI_DENUE"
          || integrity?.sourceType !== "DENUE" || integrity?.acquisitionMode !== "OBSERVED"
          || integrity?.acquisitionStatus !== "ACQUIRED" || integrity?.isSimulated !== false
          || typeof integrity?.acquiredAt !== "string" || !Number.isFinite(Date.parse(integrity.acquiredAt))
          || !integrity?.sourceReference || !integrity?.rawSourceReference
          || poi.sourceReference !== integrity.sourceReference || poi.rawSourceReference !== integrity.rawSourceReference
          || !poi.traceabilityId || poi.traceabilityId !== integrity.traceabilityId
          || integrity.query !== `${lat},${lng},350`) reason = "DENUE_OBSERVATION_PROVENANCE_UNAVAILABLE";
        else if (validateGeoIntegrity(poi.lat, poi.lng).latitude === null) reason = "DENUE_OBSERVATION_COORDINATES_INVALID";
        if (reason) { denueObservationDiagnostics.push({ index, reason }); return; }
        const item = adaptDenueScinceSource({ expedienteId: gang.projectId, observationReference: identity, integrity });
        if (item?.eligibility !== "ELIGIBLE") {
          denueObservationDiagnostics.push({ index, reason: "DENUE_OBSERVATION_NOT_ELIGIBLE" }); return;
        }
        denueScinceOrchestrationItems.push(item);
        denuePois.push(poi);
      });
    } else {
      const descriptor = adaptDenueScinceSource({ expedienteId: gang.projectId, integrity: denueData?.epistemicIntegrity });
      if (descriptor) denueScinceOrchestrationItems.push(descriptor);
    }

    const telegramOrchestrationItem = adaptOsintSource({
      expedienteId: gang.projectId,
      integrity: telegramOsint?.epistemicIntegrity,
    });

    const sourceOrchestrationItems = [
      ...denueScinceOrchestrationItems,
      ...(telegramOrchestrationItem ? [telegramOrchestrationItem] : []),
    ];

    // Build the enriched context
    let enrichmentPrompt = `
- Información de Entorno Extraída de APIs Internas:
* Datos Demográficos (SCINCE / ${scinceRoute?.operationalMode || "UNKNOWN"}): ${
      scinceData.exito
        ? `Uso diagnostico no autoritativo. Población estimada: ${scinceData.poblacionTotal}, Viviendas: ${scinceData.viviendasTotales}, Grado de Marginación: ${scinceData.gradoMarginacion}`
        : "Sin datos demográficos."
    }
* Comercios Locales Activos (DENUE / ${denueRoute?.operationalMode || "UNKNOWN"}): ${
      denueRoute?.authoritative && denueData.exito && denuePois.length > 0
        ? `Observaciones DENUE incorporables: ${denuePois.length}. Muestra de negocios: ${denuePois.slice(0, 8).map(poi => `${poi.Nombre || ""} (${poi.Clase_actividad || ""})`).join(" | ")}`
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
      denueInfo: denueData.exito ? { ...denueData, pois: denuePois, total: denuePois.length, resumen: denuePois.slice(0, 8).map(poi => `${poi.Nombre || ""} (${poi.Clase_actividad || ""})`).join(" | ") } : undefined,
      denueObservationDiagnostics,
      externalSourceProvenance,
      sourceRouteClassifications,
      sourceOrchestrationItems,
    };
  }
}
