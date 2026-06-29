"use server";

export interface IntelligencePlan {
  hypothesis: string;
  investigationType: string;
  priority: "Bajo" | "Medio" | "Alto" | "Crítico";
  areaOfInterest: string;
  suggestedSources: string[];
  estimatedTimeSeconds: number;
  approximateVolume: string;
  expectedCoverage: number; // 0-100
}

/**
 * MOI (Motor Orquestador de Inteligencia)
 * Analyzes case metadata to propose a collection plan.
 */
export const proposeIntelligencePlan = async (
  project: any,
  previousResults?: any
): Promise<IntelligencePlan> => {
  const context = (project?.descripcion || "").toLowerCase() + " " + (project?.nombre || "").toLowerCase();
  
  // 1. Detect hypothesis based on keywords
  let hypothesis = "Actividad delictiva local de baja intensidad";
  let investigationType = "Seguimiento Perimetral";
  let priority: "Bajo" | "Medio" | "Alto" | "Crítico" = "Medio";

  if (context.includes("droga") || context.includes("narco") || context.includes("narcomenudeo") || context.includes("punto")) {
    hypothesis = "Punto de distribución y consumo de sustancias ilícitas (narcomenudeo)";
    investigationType = "Inteligencia Antinarcóticos";
    priority = "Alto";
  } else if (context.includes("homicidio") || context.includes("asesinato") || context.includes("ejecutado") || context.includes("muerto")) {
    hypothesis = "Disputa territorial violenta con resultado de homicidio de impacto";
    investigationType = "Homicidios y Delincuencia Organizada";
    priority = "Crítico";
  } else if (context.includes("robo") || context.includes("asalto") || context.includes("camioneta") || context.includes("vehículo")) {
    hypothesis = "Banda local dedicada al robo de vehículos y transeúntes con violencia";
    investigationType = "Robo y Delitos Patrimoniales";
    priority = "Alto";
  } else if (context.includes("extorsión") || context.includes("cobro de piso") || context.includes("amenaza")) {
    hypothesis = "Estructura criminal dedicada a la extorsión de comercios establecidos";
    investigationType = "Extorsión e Inteligencia Comercial";
    priority = "Crítico";
  } else if (context.includes("inundación") || context.includes("agua") || context.includes("lluvia") || context.includes("riesgo")) {
    hypothesis = "Riesgo hidrometeorológico y vulnerabilidad de infraestructura urbana";
    investigationType = "Protección Civil y Análisis de Entorno";
    priority = "Medio";
  } else if (context.includes("desaparecido") || context.includes("búsqueda") || context.includes("persona")) {
    hypothesis = "Desaparición forzada o ausencia de persona de interés vinculada a la zona";
    investigationType = "Búsqueda de Personas";
    priority = "Alto";
  }

  // Override priority if specified in project state or metadata
  if (project?.estado === "CRÍTICO" || context.includes("critico") || context.includes("urgente")) {
    priority = "Crítico";
  } else if (project?.estado === "ABIERTO" && priority === "Medio") {
    priority = "Alto"; // Escalación preventiva por apertura
  }

  // 2. Determine area of interest and geometry
  const areaOfInterest = project?.locationName || "Aguascalientes, México";
  const geometryType = project?.geometryType || "individual"; // individual, lineal, poligono

  // 3. Propose sources to maximize search utility
  const suggestedSources: string[] = ["osint_territorial", "rss_regional", "google_dorks", "discovery_engine"];

  // Geo-specific sources
  if (project?.latitude && project?.longitude) {
    suggestedSources.push("google_maps");
    suggestedSources.push("street_view");
    suggestedSources.push("apis_gubernamentales");
  }

  // Social deep sources based on context and priority
  if (priority === "Alto" || priority === "Crítico") {
    suggestedSources.push("telegram");
    suggestedSources.push("x_twitter");
    suggestedSources.push("reddit");
    suggestedSources.push("youtube");
  }

  // Category folders for Google Drive Intelligence
  if (priority === "Crítico" || context.includes("drive") || context.includes("evidencia") || context.includes("antecedentes")) {
    suggestedSources.push("drive_intelligence");
  }

  // Facebook & Instagram public accounts
  if (context.includes("perfil") || context.includes("social") || context.includes("cuenta") || context.includes("alias")) {
    suggestedSources.push("facebook_public");
    suggestedSources.push("instagram_public");
  }

  // PowerUps active control
  if (project?.powerups && Array.isArray(project.powerups)) {
    if (project.powerups.includes("deep_web")) {
      suggestedSources.push("telegram"); // Telegram acts as leaks repository
    }
  }

  // 4. Calculate estimates dynamically
  const baseTimePerSource = 5; // seconds
  const selectedSourcesCount = suggestedSources.length;
  const estimatedTimeSeconds = Math.max(15, selectedSourcesCount * baseTimePerSource + (priority === "Crítico" ? 15 : 5));

  const volumeMultiplier = priority === "Crítico" ? 45 : priority === "Alto" ? 30 : 15;
  const approximateVolume = `${selectedSourcesCount * 12} - ${selectedSourcesCount * volumeMultiplier} registros de interés`;

  let expectedCoverage = 60 + (selectedSourcesCount * 3.5);
  if (priority === "Crítico") expectedCoverage += 5; // deep scan enhancement
  expectedCoverage = Math.min(99, Math.round(expectedCoverage));

  return {
    hypothesis,
    investigationType,
    priority,
    areaOfInterest,
    suggestedSources,
    estimatedTimeSeconds,
    approximateVolume,
    expectedCoverage,
  };
};
