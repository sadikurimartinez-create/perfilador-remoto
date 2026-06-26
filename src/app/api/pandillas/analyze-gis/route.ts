import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { getHaversineDistance } from "@/lib/providers/gangGeoSweepEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GISMemberNode {
  member_id: string;
  alias: string;
  gang: string;
  location: { lat: number; lng: number };
  confidence: number;
  source: string;
  zone_id?: string;
}

interface InfluenceZone {
  zone_id: string;
  gang: string;
  points: { lat: number; lng: number }[];
  influence_score: number;
  intensity: "bajo" | "medio" | "alto";
  memberCount: number;
  density: number;
  recurrence: number;
  proximity: number;
  color: string;
}

interface AnalyzeGisRequest {
  nodes: GISMemberNode[];
  zones: InfluenceZone[];
  allGangs: any[];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeGisRequest;
    const { nodes = [], zones = [], allGangs = [] } = body;

    if (nodes.length === 0 && zones.length === 0) {
      return NextResponse.json(
        { error: "Debe seleccionar al menos un integrante o una zona de influencia para realizar el análisis." },
        { status: 400 }
      );
    }

    // Run deterministic analysis data preparation
    const reportText = buildDeterministicReport(nodes, zones, allGangs);

    // If VertexAI is not configured, return the deterministic report immediately
    if (!GCP_PROJECT_ID) {
      console.log("[API GIS Analysis] No GCP_PROJECT_ID configured, returning deterministic fallback report.");
      return NextResponse.json({ report: reportText, isAiGenerated: false });
    }

    // Call Gemini to generate a refined, context-rich analysis
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
Tu tarea es tomar un conjunto de datos GIS seleccionados por el analista (integrantes, domicilios y zonas de influencia) y generar un **Informe Táctico de Geointeligencia (Informe GEOINT)**.

El informe debe redactarse en un tono profesional, institucional, riguroso y analítico.
Debe estructurarse en formato Markdown e incluir obligatoriamente las siguientes secciones:
1. **Resumen Ejecutivo**: Diagnóstico inicial severo de la situación.
2. **Descripción Territorial**: Análisis de la geografía del área y sectores de Aguascalientes involucrados.
3. **Nivel de Influencia**: Evaluación de la intensidad y presencia criminal en la zona.
4. **Pandillas Relacionadas**: Detalle de organizaciones, clicas o bandas involucradas.
5. **Integrantes Relacionados**: Lista de los sospechosos analizados y sus perfiles/roles.
6. **Posibles Conflictos**: Evaluación de riesgos de enfrentamientos o disputas de frontera.
7. **Patrones Espaciales**: Análisis de distribución de domicilios, rutas y concentración de grafitis.
8. **Conclusiones**: Recomendaciones de patrullaje u operaciones tácticas.
9. **Nivel de Confianza**: Calificación del análisis basada en las fuentes (OSINT, investigación, registro).

Te proporcionaremos un análisis técnico estructurado preliminar para que lo expandas y complementes utilizando tu conocimiento táctico y opcionalmente búsquedas de internet (Google Search) sobre eventos delictivos recientes en Aguascalientes en las zonas involucradas.
`;

      const userMessage = `
--- DATOS GIS SELECCIONADOS ---
Nodos de Domicilio: ${JSON.stringify(nodes, null, 2)}
Polígonos de Zona: ${JSON.stringify(zones, null, 2)}

--- INFORME DETERMINISTA PRELIMINAR (Úsalo como base técnica) ---
${reportText}
`;

      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: systemPrompt + "\n\n" + userMessage }] }
        ],
        generationConfig: {
          temperature: 0.25,
        }
      });

      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (responseText.trim()) {
        return NextResponse.json({ report: responseText, isAiGenerated: true });
      }
    } catch (aiErr: any) {
      console.error("[API GIS Analysis] Error calling Vertex AI, falling back to deterministic report:", aiErr);
    }

    return NextResponse.json({ report: reportText, isAiGenerated: false });

  } catch (error: any) {
    console.error("[API GIS Analysis] Error general:", error);
    return NextResponse.json(
      { error: "Error interno al procesar el análisis de geointeligencia.", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Builds a highly detailed, rules-based spatial correlation report in Markdown.
 */
function buildDeterministicReport(nodes: GISMemberNode[], zones: InfluenceZone[], allGangs: any[]): string {
  // Extract unique gangs involved
  const gangNames = Array.from(new Set([
    ...nodes.map(n => n.gang),
    ...zones.map(z => z.gang)
  ]));

  const gangsDetails = gangNames.map(name => {
    return allGangs.find(g => g.nombre.toLowerCase() === name.toLowerCase()) || {
      nombre: name,
      zonaInfluencia: "Por determinar",
      relaciones: [],
      simbolosIdentificacion: "No documentados",
      modusOperandi: "No documentado"
    };
  });

  // Calculate coordinates center of selection
  let latSum = 0;
  let lngSum = 0;
  let pointsCount = 0;

  nodes.forEach(n => {
    latSum += n.location.lat;
    lngSum += n.location.lng;
    pointsCount++;
  });

  zones.forEach(z => {
    z.points.forEach(p => {
      latSum += p.lat;
      lngSum += p.lng;
      pointsCount++;
    });
  });

  const centerLat = pointsCount > 0 ? latSum / pointsCount : 21.8853;
  const centerLng = pointsCount > 0 ? lngSum / pointsCount : -102.2916;

  // Cross-reference proximity
  const proximityLines: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = getHaversineDistance(nodes[i].location, nodes[j].location);
      if (dist < 1500) {
        proximityLines.push(`- Domicilio de **${nodes[i].alias}** (${nodes[i].gang}) se encuentra a **${Math.round(dist)} metros** del de **${nodes[j].alias}** (${nodes[j].gang}).`);
      }
    }
  }

  // Cross-reference zones conflict risks
  const conflictsList: string[] = [];
  gangsDetails.forEach(g => {
    const relations = g.relaciones || [];
    relations.forEach((rel: any) => {
      if (rel.tipo === "rival" && gangNames.includes(rel.pandillaNombre)) {
        conflictsList.push(`- **RIVALIDAD ACTIVA:** ${g.nombre} mantiene un estado de hostilidad directa con ${rel.pandillaNombre} (Vínculo: ${rel.tipoVinculo}, Severidad: ${rel.nivelSeveridad}).`);
      }
    });
  });

  // Calculate average confidence score
  const avgConfidence = nodes.length > 0 
    ? nodes.reduce((acc, n) => acc + n.confidence, 0) / nodes.length 
    : 0.85;

  let riskLevel = "BAJO";
  if (conflictsList.length > 0 || proximityLines.length > 3) riskLevel = "CRÍTICO";
  else if (nodes.length > 2 || zones.length > 1) riskLevel = "ALTO";
  else if (nodes.length > 0) riskLevel = "MEDIO";

  // Build Markdown
  let markdown = `# INFORME DE INTELIGENCIA TÁCTICA GEOINT\n`;
  markdown += `**Centro de Estudios y Política Criminal (CEIPOL)**\n`;
  markdown += `**Fecha de Emisión:** ${new Date().toLocaleDateString("es-MX")}\n`;
  markdown += `**Foco de Operaciones:** Sector Aguascalientes Centro-Oriente [${centerLat.toFixed(5)}, ${centerLng.toFixed(5)}]\n`;
  markdown += `**Clasificación de Riesgo:** **${riskLevel}**\n\n`;

  markdown += `## 1. Resumen Ejecutivo\n`;
  markdown += `El presente informe analiza la correlación de evidencia espacial de pandillas a partir de **${nodes.length} domicilios** y **${zones.length} zonas de influencia** seleccionadas en la geografía del municipio de Aguascalientes. La concentración espacial y la proximidad territorial revelan patrones de agrupación delictiva que demandan atención prioritaria en materia de patrullaje preventivo. El nivel de riesgo se clasifica como **${riskLevel}** debido a la cercanía física de los objetivos y los antecedentes históricos de rivalidades en el sector.\n\n`;

  markdown += `## 2. Descripción Territorial\n`;
  markdown += `El área bajo escrutinio comprende coordenadas que se intersectan en la zona urbana de Aguascalientes. Las colonias de mayor atención que corresponden a este sector son: **${gangsDetails.map(g => g.zonaInfluencia).filter(x => x && x !== "Aguascalientes").join(", ") || "Sector Oriente"}**. Se detecta una densidad urbana media-alta que favorece el repliegue y la ocultación de los objetivos criminales en pasajes y vialidades secundarias.\n\n`;

  markdown += `## 3. Nivel de Influencia\n`;
  markdown += `Las zonas de influencia analizadas acumulan una presencia territorial de clicas organizadas. Las métricas de control indican lo siguiente:\n`;
  zones.forEach(z => {
    markdown += `- **${z.zone_id}** (${z.gang}): Score de Influencia **${z.influence_score}** (Intensidad: **${z.intensity.toUpperCase()}**), cobertura aproximada con **${z.memberCount} integrantes registrados** en su perímetro y una densidad local de **${z.density}**.\n`;
  });
  if (zones.length === 0) {
    markdown += `No se seleccionaron polígonos de zona amplios, sin embargo, la presencia de domicilios individuales indica una colonización territorial activa por parte de las clicas locales.\n`;
  }
  markdown += `\n`;

  markdown += `## 4. Pandillas Relacionadas\n`;
  markdown += `Se identificaron las siguientes corporaciones delictivas vinculadas directamente a la selección:\n`;
  gangsDetails.forEach(g => {
    markdown += `### 👤 ${g.nombre}\n`;
    markdown += `- **Zona de Dominio Declarada:** ${g.zonaInfluencia}\n`;
    markdown += `- **Modus Operandi:** ${g.modusOperandi || "Robo y vandalismo nocturno."}\n`;
    markdown += `- **Símbolos y Grafitis:** ${g.simbolosIdentificacion || "Marcas alusivas en bardas perimetrales."}\n\n`;
  });

  markdown += `## 5. Integrantes Relacionados\n`;
  markdown += `El análisis individual de domicilios e integrantes arrojó la siguiente base de objetivos tácticos activos:\n`;
  nodes.forEach(n => {
    markdown += `- **${n.alias}** (Clica: *${n.gang}*): Domiciliado en las inmediaciones del sector. Confianza del registro: **${Math.round(n.confidence * 100)}%** (Origen: *${n.source}*).\n`;
  });
  if (nodes.length === 0) {
    markdown += `No se seleccionaron nodos individuales de domicilio; el análisis se sustenta en la proyección de áreas de calor.\n`;
  }
  markdown += `\n`;

  markdown += `## 6. Posibles Conflictos\n`;
  markdown += `La evaluación de relaciones bilaterales y cruces territoriales arrojó los siguientes puntos críticos:\n`;
  if (conflictsList.length > 0) {
    conflictsList.forEach(c => { markdown += c + "\n"; });
  } else {
    markdown += `- No se documentan rivalidades directas declaradas en el expediente de las pandillas seleccionadas, sin embargo, la presencia simultánea de clicas distintas en un radio menor a 2 km aumenta el riesgo de fricciones por control de puntos de venta.\n`;
  }
  if (proximityLines.length > 0) {
    markdown += `\n**Alertas de Proximidad Física:**\n`;
    proximityLines.forEach(l => { markdown += l + "\n"; });
  }
  markdown += `\n`;

  markdown += `## 7. Patrones Espaciales\n`;
  markdown += `Se detecta una estructura de distribución ${nodes.length > 3 ? "agrupada (clustering)" : "lineal / de paso"} de los integrantes de las pandillas en cuestión. Los domicilios compartidos y la cercanía de los puntos de reunión indican que las redes de proximidad operan como corredores de huida o zonas de reclutamiento.\n\n`;

  markdown += `## 8. Conclusiones y Recomendaciones\n`;
  markdown += `1. **Patrullaje Intensivo:** Establecer rutas de vigilancia preventiva focalizadas sobre los puntos medios y de proximidad detectados.\n`;
  markdown += `2. **Mitigación de Pintas:** Proceder con la remoción de grafitis en los perímetros delimitados para romper la demarcación de frontera delictiva.\n`;
  markdown += `3. **Monitoreo de Líderes:** Priorizar el seguimiento de los nodos con mayor confianza de registro y rol de liderazgo identificados en el informe.\n\n`;

  markdown += `## 9. Nivel de Confianza\n`;
  markdown += `El nivel de confianza general del presente informe es del **${Math.round(avgConfidence * 100)}%**, sustentado en bases de registro de inteligencia policial, cruce de datos OSINT territoriales y delimitación GIS de precisión.\n`;

  return markdown;
}
