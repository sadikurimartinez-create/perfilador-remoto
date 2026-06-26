import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";

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

function getHaversineDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1.lat)) *
      Math.cos(toRad(p2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isPointInPolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean {
  if (polygon.length < 3) return false;
  const x = point.lng, y = point.lat;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToSegment(p: { lat: number; lng: number }, v: { lat: number; lng: number }, w: { lat: number; lng: number }): number {
  const l2 = getHaversineDistance(v, w);
  if (l2 === 0) return getHaversineDistance(p, v);
  const t = Math.max(0, Math.min(1, ((p.lng - v.lng) * (w.lng - v.lng) + (p.lat - v.lat) * (w.lat - v.lat)) / (Math.pow(w.lng - v.lng, 2) + Math.pow(w.lat - v.lat, 2))));
  const projection = {
    lat: v.lat + t * (w.lat - v.lat),
    lng: v.lng + t * (w.lng - v.lng)
  };
  return getHaversineDistance(p, projection);
}

function distToPolyline(point: { lat: number; lng: number }, path: { lat: number; lng: number }[]): number {
  if (path.length < 2) return Infinity;
  let minDist = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const dist = distToSegment(point, path[i], path[i+1]);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
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

    // 1. Calculate Spatial Crossings
    const crossingsList: string[] = [];
    let insideDomicilesCount = 0;
    let insideIncidentsCount = 0;

    manualDrawings.forEach(draw => {
      const drawName = draw.label || draw.geometry_type;
      const drawType = draw.geometry_type;
      const drawRisk = draw.risk_level;

      // Cross Domiciles
      domiciles.forEach(node => {
        let isInside = false;
        if (drawType === "polygon") {
          isInside = isPointInPolygon(node.location, draw.coordinates);
        } else if (drawType === "corridor") {
          isInside = distToPolyline(node.location, draw.coordinates) <= 100; // 100 meters corridor buffer
        } else if (drawType === "buffer") {
          isInside = getHaversineDistance(node.location, draw.coordinates[0]) <= (draw.radio || 300);
        }

        if (isInside) {
          insideDomicilesCount++;
          crossingsList.push(`- Integrante **${node.alias}** (${node.gang}) vive en el área delimitada por la capa dibujada **"${drawName}"** (${drawType.toUpperCase()} - Riesgo: ${drawRisk.toUpperCase()}).`);
        }
      });

      // Cross Incidents
      incidents.forEach(inc => {
        let isInside = false;
        const incLoc = { lat: inc.lat, lng: inc.lng };
        if (drawType === "polygon") {
          isInside = isPointInPolygon(incLoc, draw.coordinates);
        } else if (drawType === "corridor") {
          isInside = distToPolyline(incLoc, draw.coordinates) <= 100;
        } else if (drawType === "buffer") {
          isInside = getHaversineDistance(incLoc, draw.coordinates[0]) <= (draw.radio || 300);
        }

        if (isInside) {
          insideIncidentsCount++;
          crossingsList.push(`- Delito registrado **${inc.tipo || 'Incidente'}** (${inc.fuente}) contenido en la geometría dibujada **"${drawName}"**.`);
        }
      });
    });

    // 2. Compute Quantitative Risk Score (Scale 0.0 - 10.0)
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

    // 3. Build structured JSON Output
    const structuredOutput = {
      selected_gangs: selectedGangs,
      active_layers: activeLayers,
      domiciles: domiciles.map(d => ({ alias: d.alias, gang: d.gang, location: d.location })),
      influence_zones: influenceZones.map(z => ({ zone_id: z.zone_id, gang: z.gang, influence_score: z.influence_score })),
      analysis_summary: `Se procesó la geointeligencia para ${selectedGangs.length} pandillas (${selectedGangs.join(", ")}). Se activaron las capas: ${activeLayers.join(", ")}. Se detectaron ${insideDomicilesCount} coincidencias de domicilios de integrantes y ${insideIncidentsCount} incidentes delictivos intersecados espacialmente por las ${manualDrawings.length} geometrías trazadas manualmente.`,
      risk_score: finalRiskScore,
      export_ready: true
    };

    // 4. Build deterministic fallback report
    const reportText = buildDeterministicReport(body, crossingsList, finalRiskScore, insideDomicilesCount, insideIncidentsCount);

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
Tu tarea es tomar un conjunto de datos GIS seleccionados por el analista (integrantes, domicilios, zonas de influencia, capas activas, incidentes delictivos cruzados e intersecciones espaciales con trazos manuales) y generar un **Informe Táctico de Geointeligencia (Informe GEOINT)**.

El informe debe redactarse en un tono profesional, institucional, riguroso y analítico.
Debe estructurarse en formato Markdown e incluir obligatoriamente las siguientes secciones:
1. **Resumen Ejecutivo**: Diagnóstico inicial severo de la situación.
2. **Descripción Territorial**: Análisis de la geografía del área y sectores de Aguascalientes involucrados.
3. **Nivel de Influencia**: Evaluación de la intensidad y presencia criminal en la zona.
4. **Pandillas Relacionadas**: Detalle de organizaciones, clicas o bandas involucradas.
5. **Cruce de Delineado Manual y Riesgo**: Explicar detalladamente qué domicilios e incidentes caen dentro de las geometrías dibujadas por el analista.
6. **Posibles Conflictos**: Evaluación de riesgos de enfrentamientos o disputas de frontera en base a las rivalidades documentadas.
7. **Patrones Espaciales e Incidencia Delictiva**: Análisis de concentración de delitos e integrantes.
8. **Conclusiones y Recomendaciones Tácticas**: Patrullajes focalizados o intervenciones específicas.
9. **Nivel de Confianza e Índice de Riesgo**: Calificación de la severidad con un puntaje de riesgo del 1 al 10.

Te proporcionaremos un análisis técnico estructurado preliminar para que lo expandas y complementes utilizando tu conocimiento táctico y opcionalmente búsquedas de internet (Google Search) sobre eventos delictivos recientes en Aguascalientes en las zonas analizadas.
`;

      const userMessage = `
--- DATOS GIS PROCESADOS ---
Pandillas seleccionadas: ${JSON.stringify(selectedGangs, null, 2)}
Capas activas: ${JSON.stringify(activeLayers, null, 2)}
Geometrías manuales: ${JSON.stringify(manualDrawings, null, 2)}
Puntaje cuantitativo de riesgo: ${finalRiskScore}/10.0
Cruces espaciales detectados:
${crossingsList.join("\n") || "No se detectaron intersecciones directas."}

--- INFORME DETERMINISTA PRELIMINAR (Úsalo como base técnica y expande) ---
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
        return NextResponse.json({ report: responseText, structuredOutput, isAiGenerated: true });
      }
    } catch (aiErr: any) {
      console.error("[API GIS Analysis] Error calling Vertex AI, falling back to deterministic report:", aiErr);
    }

    return NextResponse.json({ report: reportText, structuredOutput, isAiGenerated: false });

  } catch (error: any) {
    console.error("[API GIS Analysis] Error general:", error);
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
  insideIncidentsCount: number
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

  let markdown = `# INFORME DE INTELIGENCIA TÁCTICA GEOINT\n`;
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

  markdown += `## 5. Patrones Espaciales e Incidencia Delictiva\n`;
  markdown += `El total de incidentes analizados dentro de la zona de influencia asciende a **${incidents.length} delitos cercanos**. Se destaca que la cercanía física entre las viviendas de integrantes y las zonas comerciales o de tránsito incrementa el factor de oportunidad criminal para robos y asaltos en la demarcación.\n\n`;

  markdown += `## 6. Recomendaciones y Conclusiones Tácticas\n`;
  markdown += `1. **Monitorear los Corredores de Movilidad:** Reforzar patrullajes en las rutas de delineado manual donde se detectaron intersecciones directas.\n`;
  markdown += `2. **Asegurar Zonas de Riesgo / Buffers:** Desplegar unidades de disuasión rápida en los círculos de amortiguamiento con puntaje de riesgo ALTO.\n`;
  markdown += `3. **Unificar Inteligencia:** Mantener actualizada la capa de domicilios con registros OSINT recientes para evitar fallas en la detección espacial de proximidades.\n`;

  return markdown;
}
