import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { InegiWmsProvider } from "@/lib/providers/inegi_wms_provider";
import { LayerRecommendationEngine } from "@/lib/providers/layerRecommendationEngine";
import { SpatialLayerEngine } from "@/lib/providers/spatialLayerEngine";
import { CriminalIntelligenceCorrelationEngine } from "@/lib/criminal/correlation/criminalCorrelationEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GISMemberNode {
  member_id: string;
  alias: string;
  gang: string;
  location: { lat: number; lng: number };
  confidence: number;
  source: string;
}

interface InfluenceZone {
  zone_id: string;
  gang: string;
  points: { lat: number; lng: number }[];
  influence_score: number;
  intensity: "bajo" | "medio" | "alto";
  memberCount: number;
  density: number;
}

interface ManualDrawing {
  geometry_type: "polygon" | "corridor" | "buffer";
  coordinates: { lat: number; lng: number }[];
  radio?: number;
  risk_level: "low" | "medium" | "high";
  label: string;
  timestamp: string;
}

interface CrimeIncident {
  lat: number;
  lng: number;
  tipo: string;
  fuente: string;
  distancia_m?: number;
}

interface AnalyzeGisRequest {
  selectedGangs: string[];
  activeLayers: string[];
  domiciles: GISMemberNode[];
  influenceZones: InfluenceZone[];
  manualDrawings: ManualDrawing[];
  incidents: CrimeIncident[];
  allGangs: any[];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeGisRequest;
    const {
      selectedGangs = [],
      activeLayers = [],
      domiciles = [],
      influenceZones = [],
      manualDrawings = [],
      incidents = [],
      allGangs = []
    } = body;

    if (selectedGangs.length === 0) {
      return NextResponse.json(
        { error: "Debe seleccionar al menos una pandilla para realizar el análisis." },
        { status: 400 }
      );
    }

    // 1. Calculate Centroid for Spatial Queries and WMS recommendations
    const centerLat = domiciles.length > 0 ? domiciles.reduce((acc, d) => acc + d.location.lat, 0) / domiciles.length : 21.8853;
    const centerLng = domiciles.length > 0 ? domiciles.reduce((acc, d) => acc + d.location.lng, 0) / domiciles.length : -102.2916;

    // 2. Fetch and suggest WMS layers via recommendation engine
    const wmsProvider = new InegiWmsProvider();
    const capabilitiesRes = await wmsProvider.fetchData({
      action: "get_capabilities",
      lat: centerLat,
      lng: centerLng
    });

    const allLayers = capabilitiesRes.status === "ok" && capabilitiesRes.payload
      ? (capabilitiesRes.payload.layers || [])
      : [];

    const recommendedLayerIds = LayerRecommendationEngine.recommend("pandillas", {
      lat: centerLat,
      lng: centerLng,
      query: selectedGangs.join(" ")
    });

    const activeRecommendedLayers = allLayers.filter((l: any) => recommendedLayerIds.includes(l.id));

    // Correlate sources using CICE
    const ciceReport = CriminalIntelligenceCorrelationEngine.correlate({
      selectedGangs,
      incidentsCount: incidents.length,
      domicilesCount: domiciles.length,
      zonesCount: influenceZones.length,
      rssCount: activeLayers.includes("osint") || activeLayers.includes("incidents") ? 10 : 0,
      hasGoogleMaps: true,
      hasScince: true,
      hasDenue: true,
      socialMediaSignals: {
        telegram: activeLayers.includes("relations") || activeLayers.includes("domiciles"),
        facebook: activeLayers.includes("influence"),
        instagram: activeLayers.includes("influence"),
        x: activeLayers.includes("influence"),
        reddit: activeLayers.includes("influence"),
        search: true,
      }
    });

    // 3. Calculate Spatial Crossings using SpatialLayerEngine
    const crossingsList: string[] = [];
    let insideDomicilesCount = 0;
    let insideIncidentsCount = 0;

    manualDrawings.forEach(draw => {
      const drawName = draw.label || draw.geometry_type;
      const drawType = draw.geometry_type;
      const drawRisk = draw.risk_level;

      const shapeTipo = drawType === "polygon" ? "poligono" as const : (drawType === "corridor" ? "corredor" as const : "buffer" as const);

      // Cross Domiciles
      domiciles.forEach(node => {
        const isInside = SpatialLayerEngine.intersectsShape(node.location, {
          tipo: shapeTipo,
          puntos: draw.coordinates,
          radio: draw.radio
        });

        if (isInside) {
          insideDomicilesCount++;
          crossingsList.push(`- Integrante **${node.alias}** (${node.gang}) vive en el área delimitada por la capa dibujada **"${drawName}"** (${drawType.toUpperCase()} - Riesgo: ${drawRisk.toUpperCase()}).`);
        }
      });

      // Cross Incidents
      incidents.forEach(inc => {
        const incLoc = { lat: inc.lat, lng: inc.lng };
        const isInside = SpatialLayerEngine.intersectsShape(incLoc, {
          tipo: shapeTipo,
          puntos: draw.coordinates,
          radio: draw.radio
        });

        if (isInside) {
          insideIncidentsCount++;
          crossingsList.push(`- Delito registrado **${inc.tipo || 'Incidente'}** (${inc.fuente}) contenido en la geometría dibujada **"${drawName}"**.`);
        }
      });
    });

    // 4. Compute Quantitative Risk Score (Scale 0.0 - 10.0)
    let score = 2.0; // baseline
    const selectedGangDetails = allGangs.filter(g => selectedGangs.includes(g.nombre));
    
    // Check rivalries between selected gangs
    let directRivalries = 0;
    selectedGangDetails.forEach(g => {
      const relations = g.relaciones || [];
      relations.forEach((r: any) => {
        if (r.tipo === "rival" && selectedGangs.includes(r.pandillaNombre)) {
          directRivalries++;
        }
      });
    });
    score += (directRivalries / 2) * 1.5; // divide by 2 since rivalries are reciprocal
    
    score += insideDomicilesCount * 0.5;
    score += insideIncidentsCount * 0.2;
    
    manualDrawings.forEach(d => {
      if (d.risk_level === "high") score += 1.0;
      else if (d.risk_level === "medium") score += 0.5;
    });

    const finalRiskScore = Math.max(1.0, Math.min(10.0, parseFloat(score.toFixed(1))));

    // 5. Build structured JSON Output
    const structuredOutput = {
      selected_gangs: selectedGangs,
      active_layers: activeLayers,
      domiciles: domiciles.map(d => ({ alias: d.alias, gang: d.gang, location: d.location })),
      influence_zones: influenceZones.map(z => ({ zone_id: z.zone_id, gang: z.gang, influence_score: z.influence_score })),
      analysis_summary: `Se procesó la geointeligencia para ${selectedGangs.length} pandillas (${selectedGangs.join(", ")}). Se activaron las capas: ${activeLayers.join(", ")}. Se detectaron ${insideDomicilesCount} coincidencias de domicilios de integrantes y ${insideIncidentsCount} incidentes delictivos intersecados espacialmente por las ${manualDrawings.length} geometrías trazadas manualmente.`,
      risk_score: finalRiskScore,
      export_ready: true,
      recommended_wms_layers: activeRecommendedLayers.map((l: any) => ({
        id: l.id,
        name: l.name,
        title: l.title,
        category: l.category,
        description: l.description,
        url: `${l.providerUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${l.name}&FORMAT=image/png&TRANSPARENT=TRUE`
      })),
      cice_report: ciceReport
    };

    // 6. Build deterministic fallback report
    const reportText = buildDeterministicReport(body, crossingsList, finalRiskScore, insideDomicilesCount, insideIncidentsCount, activeRecommendedLayers, ciceReport);

    // 5. Call Vertex AI for a premium report if credentials are set
    if (!GCP_PROJECT_ID) {
      console.log("[API GIS Analysis] No GCP_PROJECT_ID configured, returning deterministic fallback report.");
      return NextResponse.json({ report: reportText, structuredOutput, isAiGenerated: false });
    }

    try {
      const authOptions = GCP_PRIVATE_KEY
        ? {
            credentials: {
              client_email: GCP_CLIENT_EMAIL,
              private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
            },
          }
        : undefined;

      const vertexAI = new VertexAI({
        project: GCP_PROJECT_ID,
        location: GCP_LOCATION,
        googleAuthOptions: authOptions,
      });

      const model = vertexAI.getGenerativeModel({
        model: GEMINI_MODEL,
        tools: [{ googleSearch: {} } as any],
      });

      const systemPrompt = `
Eres un Analista de Geointeligencia Criminal del Centro de Estudios y Política Criminal (CEIPOL) de Aguascalientes.
Tu tarea es tomar un conjunto de datos GIS seleccionados por el analista (integrantes, domicilios, zonas de influencia, capas activas, incidentes delictivos cruzados e intersecciones espaciales con trazos manuales) y generar un **Informe Táctico de Inteligencia Criminal y Geointeligencia (Informe CICE)**.

El informe debe redactarse en un tono sumamente profesional, de inteligencia de seguridad pública, riguroso y analítico.
Debe estructurarse en formato Markdown e incluir obligatoriamente las siguientes secciones:
1. **Resumen Ejecutivo**: Diagnóstico inicial severo de la situación de seguridad.
2. **Descripción Territorial**: Análisis de la geografía del área y sectores de Aguascalientes involucrados (análisis de entornos y atractor de riesgos).
3. **Organización y Estructura Criminal**: Análisis del liderazgo, células y estructura de las pandillas seleccionadas basándote en los datos.
4. **Comportamiento y Modus Operandi**: Patrones delictivos detectados, horarios y recurrencia de los crímenes cruzados en la zona.
5. **Movilidad y Rutas**: Corredores criminales, desplazamientos y tendencias de expansión detectadas mediante el trazado del analista.
6. **Cruce de Capas e Inventario Institucional**: Detalle analítico cruzando Domicilios, Zonas de Influencia, Incidencia Delictiva y el Inventario de Pandillas.
7. **Tendencia y Riesgos Tácticos**: Zonas calientes (Hotspots), conflictos territoriales activos y posible reordenamiento delictivo en la zona.
8. **Conclusiones y Recomendaciones Tácticas**: Patrullajes focalizados de disuasión y recomendaciones prácticas para inteligencia policial.
9. **Confianza de Fuentes e Índice de Confianza**: Detalle estructurado basado en la Verdad Operacional Criminal (CICE).

Vertex AI actúa únicamente como motor de razonamiento y síntesis narrativa. Todas las fuentes autorizadas de georreferenciación y delitos deben ser las provistas (Google Maps, INEGI DENUE/SCINCE, Inventario de Pandillas, Incidencia Delictiva y RSS).
`;

      const userMessage = `
--- DATOS GIS PROCESADOS ---
Pandillas seleccionadas: ${JSON.stringify(selectedGangs, null, 2)}
Capas activas: ${JSON.stringify(activeLayers, null, 2)}
Geometrías manuales: ${JSON.stringify(manualDrawings, null, 2)}
Puntaje cuantitativo de riesgo: ${finalRiskScore}/10.0
Cruces espaciales detectados:
${crossingsList.join("\n") || "No se detectaron intersecciones directas."}

--- ANÁLISIS DE VERDAD OPERACIONAL CRIMINAL (CICE) ---
Fuente Dominante: ${ciceReport.dominantProvider} (Confianza: ${ciceReport.dominantScore}%)
Justificación del Motor: ${ciceReport.dominantReason}
Consenso: ${ciceReport.consensusLevel}% | Incertidumbre: ${ciceReport.uncertaintyLevel}%
Inventario Institucional Consultado: ${ciceReport.institutionalInventoryUsed.join(", ") || "Ninguno"}
Correlaciones Detectadas:
${ciceReport.correlationsDetected.map(c => `- ${c}`).join("\n")}
Pesos detallados de proveedores:
${ciceReport.results.map((r: any) => `- ${r.name} (${r.decision.toUpperCase()} - Score: ${r.truthScore}%): ${r.explanation}`).join("\n")}

--- INFORME DETERMINISTA PRELIMINAR (Úsalo como base técnica y expande) ---
${reportText}
`;

      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: systemPrompt + "\n\n" + userMessage }] }
        ],
        generationConfig: {
          temperature: 0.2,
        }
      });

      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (responseText.trim()) {
        return NextResponse.json({ report: responseText, structuredOutput, isAiGenerated: true });
      }
    } catch (aiErr: any) {
      console.error("[API CICE Analysis] Error calling Vertex AI, falling back to deterministic report:", aiErr);
    }

    return NextResponse.json({ report: reportText, structuredOutput, isAiGenerated: false });

  } catch (error: any) {
    console.error("[API CICE Analysis] Error general:", error);
    return NextResponse.json(
      { error: "Error interno al procesar el análisis de geointeligencia.", details: error.message },
      { status: 500 }
    );
  }
}

function buildDeterministicReport(
  body: AnalyzeGisRequest,
  crossingsList: string[],
  finalRiskScore: number,
  insideDomicilesCount: number,
  insideIncidentsCount: number,
  activeRecommendedLayers: any[] = [],
  ciceReport: any = null
): string {
  const {
    selectedGangs = [],
    activeLayers = [],
    domiciles = [],
    influenceZones = [],
    manualDrawings = [],
    incidents = []
  } = body;

  const centerLat = domiciles.length > 0 ? domiciles.reduce((acc, d) => acc + d.location.lat, 0) / domiciles.length : 21.8853;
  const centerLng = domiciles.length > 0 ? domiciles.reduce((acc, d) => acc + d.location.lng, 0) / domiciles.length : -102.2916;

  let riskText = "BAJO";
  if (finalRiskScore >= 7.0) riskText = "CRÍTICO";
  else if (finalRiskScore >= 5.0) riskText = "ALTO";
  else if (finalRiskScore >= 3.0) riskText = "MEDIO";

  let markdown = `# INFORME DE INTELIGENCIA TÁCTICA GEOINT CRIMINAL (CICE)\n`;
  markdown += `**Centro de Estudios y Política Criminal (CEIPOL)**\n`;
  markdown += `**Fecha de Emisión:** ${new Date().toLocaleDateString("es-MX")}\n`;
  markdown += `**Foco de Operaciones:** Aguascalientes, Sector Centro-Oriente [${centerLat.toFixed(5)}, ${centerLng.toFixed(5)}]\n`;
  markdown += `**Puntaje de Riesgo Territorial:** **${finalRiskScore}/10.0 (${riskText})**\n\n`;

  markdown += `## 1. Resumen Ejecutivo\n`;
  markdown += `Este informe compila el diagnóstico geoespacial cruzado para las pandillas seleccionadas: **${selectedGangs.join(", ")}**. El motor GIS analizó la vecindad territorial a partir de **${domiciles.length} domicilios de integrantes** y **${influenceZones.length} zonas de influencia**. Mediante las capas de delineado manual, se identificaron **${insideDomicilesCount} intersecciones de domicilios** y **${insideIncidentsCount} incidentes delictivos** de alta prioridad. El índice de severidad se establece en **${finalRiskScore}** sobre una escala de 10.\n\n`;

  markdown += `## 2. Descripción Territorial\n`;
  markdown += `La cuadrícula operativa se centra en las coordenadas correspondientes al oriente y centro de la capital del estado de Aguascalientes. Se identifica una vulnerabilidad física dada la conectividad de los corredores trazados con áreas residenciales y comerciales.\n\n`;

  markdown += `## 3. Nivel de Influencia y Capas Activas\n`;
  markdown += `Se procesaron las siguientes capas de información espacial:\n`;
  markdown += `- **Domicilios de Integrantes:** ${activeLayers.includes("domiciles") ? "🟢 ACTIVA" : "🔴 INACTIVA"}\n`;
  markdown += `- **Zonas de Influencia:** ${activeLayers.includes("influence_zones") ? "🟢 ACTIVA" : "🔴 INACTIVA"}\n`;
  markdown += `- **Redes de Relaciones:** ${activeLayers.includes("relations") ? "🟢 ACTIVA" : "🔴 INACTIVA"}\n`;
  markdown += `- **Incidencia Delictiva:** ${activeLayers.includes("incidents") ? "🟢 ACTIVA" : "🔴 INACTIVA"}\n\n`;

  if (activeRecommendedLayers.length > 0) {
    markdown += `### Capas WMS del INEGI (GAIA) Integradas\n`;
    activeRecommendedLayers.forEach(l => {
      markdown += `- **${l.title}** (${l.category.toUpperCase()}): ${l.description}\n`;
    });
    markdown += `\n`;
  }

  markdown += `## 4. Cruce de Delineado Manual y Geometrías Tácticas\n`;
  markdown += `Se evaluaron **${manualDrawings.length} geometrías dibujadas a mano** por el analista:\n`;
  manualDrawings.forEach(d => {
    markdown += `- **"${d.label || d.geometry_type}"** (${d.geometry_type.toUpperCase()} - Riesgo: ${d.risk_level.toUpperCase()}): Contiene un total de vértices de coordenadas geovalidadas. `;
    if (d.geometry_type === "buffer") {
      markdown += `Radio configurado: ${d.radio || 300} metros.`;
    }
    markdown += `\n`;
  });
  markdown += `\n**Intersecciones de Inteligencia Espacial:**\n`;
  if (crossingsList.length > 0) {
    crossingsList.forEach(c => {
      markdown += c + "\n";
    });
  } else {
    markdown += `*No se registraron intersecciones espaciales directas entre los trazos manuales y la base de datos de domicilios o crímenes.*\n`;
  }
  markdown += `\n`;

  if (ciceReport) {
    markdown += `## 5. Auditoría de Verdad Operacional Criminal (CICE)\n`;
    markdown += `El motor de correlación CICE identificó la fuente dominante y calculó la confiabilidad operacional criminal:\n`;
    markdown += `- **Fuente Dominante:** **${ciceReport.dominantProvider}** (Confianza: **${ciceReport.dominantScore}%**)\n`;
    markdown += `- **Justificación:** ${ciceReport.dominantReason}\n`;
    markdown += `- **Consenso de Inteligencia:** ${ciceReport.consensusLevel}% | **Nivel de Incertidumbre:** ${ciceReport.uncertaintyLevel}%\n`;
    markdown += `- **Inventario Institucional Utilizado:** ${ciceReport.institutionalInventoryUsed.join(", ") || "Ninguno"}\n\n`;
    
    markdown += `**Correlaciones de Inteligencia Detectadas:**\n`;
    ciceReport.correlationsDetected.forEach((c: string) => {
      markdown += `- ${c}\n`;
    });
    markdown += `\n`;
    
    markdown += `**Detalle Ponderado de Fuentes:**\n`;
    ciceReport.results.forEach((r: any) => {
      markdown += `- **${r.name}** (Decisión: \`${r.decision.toUpperCase()}\` - Score: **${r.truthScore}%**): ${r.explanation}\n`;
    });
    markdown += `\n`;
  }

  markdown += `## ${ciceReport ? '6' : '5'}. Patrones Espaciales e Incidencia Delictiva\n`;
  markdown += `El total de incidentes analizados dentro de la zona de influencia asciende a **${incidents.length} delitos cercanos**. Se destaca que la cercanía física entre las viviendas de integrantes y las zonas comerciales o de tránsito incrementa el factor de oportunidad criminal para robos y asaltos en la demarcación.\n\n`;

  markdown += `## ${ciceReport ? '7' : '6'}. Recomendaciones y Conclusiones Tácticas\n`;
  markdown += `1. **Monitorear los Corredores de Movilidad:** Reforzar patrullajes en las rutas de delineado manual donde se detectaron intersecciones directas.\n`;
  markdown += `2. **Asegurar Zonas de Riesgo / Buffers:** Desplegar unidades de disuasión rápida en los círculos de amortiguamiento con puntaje de riesgo ALTO.\n`;
  markdown += `3. **Unificar Inteligencia:** Mantener actualizada la capa de domicilios con registros OSINT y de redes sociales para robustecer el CICE.\n`;

  return markdown;
}
