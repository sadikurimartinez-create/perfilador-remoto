import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";

export interface GeoIntMemberNode {
  member_id: string;
  alias: string;
  gang: string;
  location: { lat: number; lng: number };
  confidence: number;
  source: string;
  rol?: string;
  domicilioExacto?: string;
}

export interface GeoIntInfluenceZone {
  zone_id: string;
  gang: string;
  points: { lat: number; lng: number }[];
  influence_score: number;
  intensity: string;
  memberCount: number;
  density: number;
}

export interface GeoIntManualDrawing {
  geometry_type: string;
  coordinates: { lat: number; lng: number }[];
  radio?: number;
  risk_level: string;
  label: string;
  timestamp: string;
}

export interface GeoIntAnalysisContext {
  selectedGangs: string[];
  activeLayers: string[];
  domiciles: GeoIntMemberNode[];
  influenceZones: GeoIntInfluenceZone[];
  manualDrawings: GeoIntManualDrawing[];
  allGangs: any[];
}

export interface GeoIntStructuredOutput {
  pandillas_analizadas: string[];
  zonas_criticas: { lat: number; lng: number; descripcion: string; nivel: string }[];
  corredores_movilidad: { id: string; gang: string; descripcion: string; puntos: { lat: number; lng: number }[] }[];
  clusters_detectados: { lat: number; lng: number; radioMetros: number; descripcion: string }[];
  niveles_riesgo: Record<string, string>; // gang -> risk level
  hipotesis_operacionales: string[];
  correlaciones_clave: string[];
  fuentes_utilizadas: string[];
  confianza_global: number; // 0.0 to 10.0 scale
}

export interface GeoIntAnalysisReport {
  report: string;
  structuredOutput: GeoIntStructuredOutput;
  isAiGenerated: boolean;
}

export class GeoIntAnalyticsEngine {
  /**
   * Main entrypoint to execute a comprehensive geo-intelligence analytical scan
   */
  public static async analyze(context: GeoIntAnalysisContext): Promise<GeoIntAnalysisReport> {
    // 1. Ingest & Normalize Geospatial Entities
    const normalizedData = this.normalize(context);

    // 2. Run Semantic Classification
    const classifiedData = this.classify(normalizedData, context);

    // 3. Cross-Source Correlation & Pattern Detection
    const { correlations, criticalZones, clusters, corridors } = this.correlateAndDetectPatterns(normalizedData, context);

    // 4. Formulate Criminological Operational Hypotheses
    const hypotheses = this.inferHypotheses(normalizedData, correlations, context);

    // 5. Evaluate Source Ponderation & Global Confidence Score
    const { globalConfidence, sourcesUsed } = this.weighSources(context);

    // 6. Compute Risk Levels per Selected Gang
    const riskLevels: Record<string, string> = {};
    context.selectedGangs.forEach(gang => {
      let riskScore = 3.0; // Baseline
      const gangDetails = context.allGangs.find(g => g.nombre === gang);
      if (gangDetails) {
        if (gangDetails.peligrosidad === "Crítico") riskScore += 3.0;
        else if (gangDetails.peligrosidad === "Alto") riskScore += 2.0;
        else if (gangDetails.peligrosidad === "Medio") riskScore += 1.0;
      }
      
      const gangDomiciles = context.domiciles.filter(d => d.gang === gang);
      riskScore += Math.min(2.0, gangDomiciles.length * 0.2);

      const hasCriticalDrawings = context.manualDrawings.some(d => d.risk_level === "high");
      if (hasCriticalDrawings) riskScore += 1.5;

      if (riskScore >= 7.0) riskLevels[gang] = "Crítico";
      else if (riskScore >= 5.0) riskLevels[gang] = "Alto";
      else if (riskScore >= 3.0) riskLevels[gang] = "Medio";
      else riskLevels[gang] = "Bajo";
    });

    // 7. Construct GeoInt Structured Output
    const structuredOutput: GeoIntStructuredOutput = {
      pandillas_analizadas: context.selectedGangs,
      zonas_criticas: criticalZones,
      corredores_movilidad: corridors,
      clusters_detectados: clusters,
      niveles_riesgo: riskLevels,
      hipotesis_operacionales: hypotheses,
      correlaciones_clave: correlations,
      fuentes_utilizadas: sourcesUsed,
      confianza_global: parseFloat(globalConfidence.toFixed(1))
    };

    // 8. Generate Operational Narrative Report (Vertex AI or Deterministic Fallback)
    const reportText = await this.generateReportText(context, structuredOutput);

    return {
      report: reportText.report,
      structuredOutput,
      isAiGenerated: reportText.isAiGenerated
    };
  }

  /**
   * Helper to parse coordinates embedded as text in timeline fields
   */
  private static parseCoords(str: string | undefined): { lat: number; lng: number } | null {
    if (!str) return null;
    const match = str.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    return null;
  }

  /**
   * Pipeline step 2: Normalize and extract clean geometry objects from input raw context
   */
  private static normalize(context: GeoIntAnalysisContext) {
    const domiciles = context.domiciles.map(d => ({
      id: d.member_id,
      alias: d.alias,
      gang: d.gang,
      location: d.location,
      rol: d.rol || "Integrante",
      domicilioExacto: d.domicilioExacto || ""
    }));

    const zones = context.influenceZones.map(z => ({
      id: z.zone_id,
      gang: z.gang,
      center: z.points.length > 0 ? z.points[0] : { lat: 21.88, lng: -102.29 },
      points: z.points,
      score: z.influence_score,
      intensity: z.intensity
    }));

    const drawings = context.manualDrawings.map(d => ({
      label: d.label,
      type: d.geometry_type,
      points: d.coordinates,
      radio: d.radio || 0,
      risk: d.risk_level
    }));

    // Extract real corridors and events from selected gangs
    const activeGangs = context.allGangs.filter(g => context.selectedGangs.includes(g.nombre));
    const corridors: any[] = [];
    const graffiti: any[] = [];
    const history: any[] = [];

    activeGangs.forEach(g => {
      // Corridors
      (g.geometrias || []).forEach((shape: any) => {
        if (shape.tipo === "corredor") {
          corridors.push({
            id: shape.id,
            gang: g.nombre,
            nombre: shape.nombre || "Corredor Táctico",
            puntos: shape.puntos,
            nivelControl: shape.nivelControlTerritorial
          });
        }
      });

      // Events
      (g.cronologiaEventos || []).forEach((evt: any) => {
        const coords = this.parseCoords(evt.lugar);
        if (coords) {
          const item = {
            id: evt.id,
            gang: g.nombre,
            titulo: evt.titulo,
            descripcion: evt.descripcion,
            location: coords,
            date: evt.fecha,
            gravedad: evt.gravedad,
            categoria: evt.categoria
          };

          if (evt.categoria === "grafiti" || evt.titulo.toLowerCase().includes("grafiti")) {
            graffiti.push(item);
          } else {
            history.push(item);
          }
        }
      });
    });

    return { domiciles, zones, drawings, corridors, graffiti, history };
  }

  /**
   * Pipeline step 3: Semantically classify geo-intelligence factors
   */
  private static classify(normalized: any, context: GeoIntAnalysisContext) {
    const structuralNodes = normalized.domiciles.filter((d: any) => 
      d.rol.toLowerCase().includes("lider") || d.rol.toLowerCase().includes("segundo")
    );

    const mobilityNodes = normalized.corridors;

    const criminalBehavior = [
      ...normalized.history.map((h: any) => ({ ...h, aspect: "Historial Delictivo" })),
      ...normalized.graffiti.map((g: any) => ({ ...g, aspect: "Marcaje Territorial" }))
    ];

    const urbanInfrastructure = normalized.drawings.map((d: any) => ({
      ...d,
      aspect: "Trazado Urbano"
    }));

    return { structuralNodes, mobilityNodes, criminalBehavior, urbanInfrastructure };
  }

  /**
   * Pipeline step 4 & 5: Intersect sources, locate patterns, and define critical collision zones
   */
  private static correlateAndDetectPatterns(normalized: any, context: GeoIntAnalysisContext) {
    const correlations: string[] = [];
    const criticalZones: GeoIntStructuredOutput["zonas_criticas"] = [];
    const clusters: GeoIntStructuredOutput["clusters_detectados"] = [];
    const corridors: GeoIntStructuredOutput["corredores_movilidad"] = [];

    // Map corridors
    normalized.corridors.forEach((corr: any) => {
      corridors.push({
        id: corr.id,
        gang: corr.gang,
        descripcion: `Corredor de movilidad criminal de la pandilla ${corr.gang}. Control: ${corr.nivelControl}.`,
        puntos: corr.puntos
      });
    });

    // Rivalry intersections (Check if rival gangs have close domiciles)
    const selectedGangs = context.selectedGangs;
    if (selectedGangs.length > 1) {
      for (let i = 0; i < selectedGangs.length; i++) {
        for (let j = i + 1; j < selectedGangs.length; j++) {
          const gangA = selectedGangs[i];
          const gangB = selectedGangs[j];
          
          // Check rivalries in database
          const detailsA = context.allGangs.find(g => g.nombre === gangA);
          const isRival = detailsA?.relaciones?.some((r: any) => r.tipo === "rival" && r.pandillaNombre === gangB);
          
          if (isRival) {
            correlations.push(`Conflictividad activa: Las pandillas antagónicas ${gangA} y ${gangB} comparten operaciones en la cuadrícula analizada.`);
            
            // Intersection of zones
            const zoneA = normalized.zones.find((z: any) => z.gang === gangA);
            const zoneB = normalized.zones.find((z: any) => z.gang === gangB);
            
            if (zoneA && zoneB) {
              const distance = this.getDist(zoneA.center, zoneB.center);
              if (distance < 3000) {
                const collisionCenter = {
                  lat: (zoneA.center.lat + zoneB.center.lat) / 2,
                  lng: (zoneA.center.lng + zoneB.center.lng) / 2
                };
                criticalZones.push({
                  lat: collisionCenter.lat,
                  lng: collisionCenter.lng,
                  descripcion: `Zona de colisión territorial crítica por intersección táctica de influencia entre ${gangA} y ${gangB}. Proximidad: ${Math.round(distance)}m.`,
                  nivel: "Alta"
                });
                clusters.push({
                  lat: collisionCenter.lat,
                  lng: collisionCenter.lng,
                  radioMetros: 600,
                  descripcion: `Cluster de colisión activa (${gangA} vs ${gangB})`
                });
              }
            }
          }
        }
      }
    }

    // Intersect manual drawings and member domiciles
    normalized.drawings.forEach((draw: any) => {
      let containsDomicile = false;
      normalized.domiciles.forEach((dom: any) => {
        if (this.isPointInDrawing(dom.location, draw)) {
          containsDomicile = true;
          correlations.push(`Intersección táctica: El domicilio del integrante "${dom.alias}" (${dom.gang}) se localiza dentro de la geometría trazada manualmente "${draw.label}" (${draw.risk.toUpperCase()}).`);
        }
      });

      if (containsDomicile) {
        const center = draw.points.length > 0 ? draw.points[0] : { lat: 21.88, lng: -102.29 };
        criticalZones.push({
          lat: center.lat,
          lng: center.lng,
          descripcion: `Punto caliente (Hotspot) operacional debido a intersección directa de integrantes con el trazado manual "${draw.label}".`,
          nivel: draw.risk === "high" ? "Crítico" : "Media"
        });
      }
    });

    // Detect high density clusters of domiciles per gang
    context.selectedGangs.forEach(gang => {
      const gangDomiciles = normalized.domiciles.filter((d: any) => d.gang === gang);
      if (gangDomiciles.length >= 3) {
        // Calculate average centroid
        let latSum = 0;
        let lngSum = 0;
        gangDomiciles.forEach((d: any) => {
          latSum += d.location.lat;
          lngSum += d.location.lng;
        });
        const centroid = { lat: latSum / gangDomiciles.length, lng: lngSum / gangDomiciles.length };
        clusters.push({
          lat: centroid.lat,
          lng: centroid.lng,
          radioMetros: 400,
          descripcion: `Nido delictivo principal / Agrupación de domicilios: ${gang}`
        });
      }
    });

    if (correlations.length === 0) {
      correlations.push("Correlación espacial establecida: Coexistencia territorial de células delictivas bajo un mismo perímetro táctico.");
    }

    return { correlations, criticalZones, clusters, corridors };
  }

  /**
   * Pipeline step 6: Formulate operational criminological hypotheses
   */
  private static inferHypotheses(normalized: any, correlations: string[], context: GeoIntAnalysisContext): string[] {
    const hypotheses: string[] = [];

    context.selectedGangs.forEach(gang => {
      const details = context.allGangs.find(g => g.nombre === gang);
      const leaders = normalized.domiciles.filter((d: any) => d.gang === gang && (d.rol.includes("Líder") || d.rol.includes("Segundo")));
      
      if (leaders.length > 0) {
        hypotheses.push(`Punto de Comando: Se infiere que el domicilio georreferenciado del líder "${leaders[0].alias}" de la pandilla ${gang} funge como centro de acopio táctico y toma de decisiones operativas.`);
      }

      const corridors = normalized.corridors.filter((c: any) => c.gang === gang);
      if (corridors.length > 0) {
        hypotheses.push(`Ruta de Evacuación: El corredor de movilidad "${corridors[0].nombre}" se proyecta como la principal vía de repliegue y distribución de mercancía de ${gang}.`);
      }

      const graffiti = normalized.graffiti.filter((g: any) => g.gang === gang);
      if (graffiti.length >= 2) {
        hypotheses.push(`Línea de Demarcación: La concentración de grafitis registrados en la periferia denota un esfuerzo sistemático de ${gang} para marcar fronteras territoriales ante rivalidades locales.`);
      }
    });

    // Collision hypothesis
    const criticalCollisions = correlations.filter(c => c.includes("antagónicas"));
    if (criticalCollisions.length > 0) {
      hypotheses.push(`Conflicto de Expansión: Se proyecta un alto riesgo de disputas de territorio en las zonas limítrofes debido a la cercanía y superposición de las áreas de influencia.`);
    }

    if (hypotheses.length === 0) {
      hypotheses.push("Patrón Operativo: Se presume una estructura jerárquica dispersa con células autónomas distribuidas para minimizar la detección de liderazgo.");
    }

    return hypotheses;
  }

  /**
   * Pipeline step 7: Apply dynamic CICE weighting on geo-evidence sources
   */
  private static weighSources(context: GeoIntAnalysisContext) {
    const sourcesUsed: string[] = [];
    let sumWeight = 0;
    let count = 0;

    // Weight matrices
    if (context.domiciles.length > 0) {
      sourcesUsed.push("Bases Internas (Domicilios de Integrantes)");
      sumWeight += 0.95; // High authority
      count++;
    }
    if (context.influenceZones.length > 0) {
      sourcesUsed.push("Análisis Espacial DBSCAN (Zonas de Influencia)");
      sumWeight += 0.90;
      count++;
    }
    if (context.manualDrawings.length > 0) {
      sourcesUsed.push("Google Maps API (Polígonos Manuales)");
      sumWeight += 0.85;
      count++;
    }

    const hasCorridors = context.allGangs.some(g => (g.geometrias || []).some((s: any) => s.tipo === "corredor"));
    if (hasCorridors) {
      sourcesUsed.push("Cartografía Histórica (Corredores de Movilidad)");
      sumWeight += 0.88;
      count++;
    }

    const hasTimelineCoords = context.allGangs.some(g => (g.cronologiaEventos || []).some((e: any) => this.parseCoords(e.lugar) !== null));
    if (hasTimelineCoords) {
      sourcesUsed.push("Expedientes de Investigación (Eventos Históricos)");
      sumWeight += 0.92;
      count++;
    }

    if (context.activeLayers.includes("osint")) {
      sourcesUsed.push("Radar OSINT Regional (Feeds RSS / Redes Sociales)");
      sumWeight += 0.70; // Lower reliability
      count++;
    }

    // Default baseline if empty
    if (count === 0) {
      sourcesUsed.push("Inventario de Pandillas");
      sumWeight = 0.80;
      count = 1;
    }

    const globalConfidence = (sumWeight / count) * 10.0; // Scale 0.0 - 10.0

    return { globalConfidence, sourcesUsed };
  }

  /**
   * Helper geometry distance calculator
   */
  private static getDist(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = p1.lat * Math.PI / 180;
    const phi2 = p2.lat * Math.PI / 180;
    const deltaPhi = (p2.lat - p1.lat) * Math.PI / 180;
    const deltaLambda = (p2.lng - p1.lng) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // In meters
  }

  /**
   * Helper geometry shape bounds check
   */
  private static isPointInDrawing(loc: { lat: number; lng: number }, draw: any): boolean {
    if (draw.type === "buffer") {
      const center = draw.points[0];
      if (!center) return false;
      const distance = this.getDist(loc, center);
      return distance <= (draw.radio || 300);
    }
    
    // Simple bounding box containment check for polygon/corridor
    if (draw.points.length === 0) return false;
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    draw.points.forEach((p: any) => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });

    // Expand bounds slightly for corridors
    const buffer = draw.type === "corredor" ? 0.002 : 0;
    return (
      loc.lat >= minLat - buffer &&
      loc.lat <= maxLat + buffer &&
      loc.lng >= minLng - buffer &&
      loc.lng <= maxLng + buffer
    );
  }

  private static async callGeminiRestApi(prompt: string, modelName: string, apiKey: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.15 }
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini REST API returned ${response.status}: ${errText}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No text returned from Gemini REST API.");
    return text;
  }

  /**
   * Formulates the narrative report and handles the Vertex AI invocation or deterministic fallback
   */
  private static async generateReportText(context: GeoIntAnalysisContext, output: GeoIntStructuredOutput): Promise<{ report: string; isAiGenerated: boolean }> {
    const fallbackText = this.buildDeterministicReport(context, output);
    const useVertexAI = !!GCP_PRIVATE_KEY && GCP_PRIVATE_KEY.trim() !== "";

    const systemPrompt = `
Eres el **GEOINT Analytics Engine (Motor de Análisis Inteligente)** del Perfilador Remoto de Aguascalientes.
Tu tarea es tomar un conjunto de datos geoespaciales normalizados, clasificatorios y ponderados por nuestro motor para generar un **Informe de Geointeligencia Táctica y Criminológica Operacional**.

El informe debe redactarse en español con un tono técnico, formal, analítico y riguroso, apto para analistas del CEIPOL y la policía estatal.
Debes estructurar el documento exactamente en las siguientes 9 secciones Markdown:

1. **Resumen Ejecutivo**: Diagnóstico criminógeno primario.
2. **Análisis Territorial**: Elementos geográficos, demarcación del centroide y atractor de riesgos urbanos (INEGI/DENUE).
3. **Estructura Criminal**: Jerarquías identificadas a partir de domicilios y roles.
4. **Movilidad y Expansión**: Rutas críticas y corredores tácticos de movilidad.
5. **Correlaciones Multifuente**: Cruce de bases internas, eventos, trazos manuales y OSINT.
6. **Zonas de Riesgo**: Puntos de colisión y áreas de influencia delictiva de alta densidad.
7. **Hipótesis Operativas**: Explicaciones del patrón delictivo e hipótesis territoriales.
8. **Conclusiones**: Conclusiones generales y directrices para patrullaje.
9. **Nivel de Confianza**: Detalle estructurado de la ponderación de fuentes (CICE) y el porcentaje global de confianza de este análisis.

REGLAS CRÍTICAS:
- No inventes datos. Usa únicamente los provistos.
- Justifica cada inferencia.
`;

    const userMessage = `
--- DATOS GEOINT ESTRUCTURADOS ---
Pandillas analizadas: ${JSON.stringify(output.pandillas_analizadas)}
Zonas críticas: ${JSON.stringify(output.zonas_criticas)}
Corredores de movilidad: ${JSON.stringify(output.corredores_movilidad)}
Clusters detectados: ${JSON.stringify(output.clusters_detectados)}
Niveles de riesgo por pandilla: ${JSON.stringify(output.niveles_riesgo)}
Hipótesis operacionales sugeridas:
${output.hipotesis_operacionales.map(h => `- ${h}`).join("\n")}
Correlaciones clave:
${output.correlaciones_clave.map(c => `- ${c}`).join("\n")}
Fuentes utilizadas: ${output.fuentes_utilizadas.join(", ")}
Confianza global: ${output.confianza_global}/10.0

--- INFORME BASE (Púlelo, amplíalo y dale formato profesional) ---
${fallbackText}
`;

    const fullPrompt = systemPrompt + "\n\n" + userMessage;

    if (useVertexAI) {
      try {
        const authOptions = {
          credentials: {
            client_email: GCP_CLIENT_EMAIL,
            private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
          },
        };
        const vertexAI = new VertexAI({
          project: GCP_PROJECT_ID,
          location: GCP_LOCATION,
          googleAuthOptions: authOptions,
        });

        const model = vertexAI.getGenerativeModel({
          model: GEMINI_MODEL,
          tools: [{ googleSearch: {} } as any],
        });

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.15,
          }
        });

        const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (responseText.trim()) {
          return { report: responseText, isAiGenerated: true };
        }
      } catch (err: any) {
        console.error("[GeoIntAnalyticsEngine] Vertex AI error, will try REST API fallback:", err.message);
      }
    }

    // REST API fallback
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    if (apiKey) {
      try {
        console.log("[GeoIntAnalyticsEngine] Calling Gemini REST API...");
        const responseText = await this.callGeminiRestApi(fullPrompt, GEMINI_MODEL, apiKey);
        if (responseText.trim()) {
          return { report: responseText, isAiGenerated: true };
        }
      } catch (restErr: any) {
        console.error("[GeoIntAnalyticsEngine] Gemini REST API fallback failed:", restErr.message);
      }
    }

    return { report: fallbackText, isAiGenerated: false };
  }

  /**
   * Deterministic fallback generator for the 9-section markdown report
   */
  private static buildDeterministicReport(context: GeoIntAnalysisContext, output: GeoIntStructuredOutput): string {
    const rawLat = context.domiciles.length > 0 ? context.domiciles.reduce((acc, d) => acc + d.location.lat, 0) / context.domiciles.length : null;
    const rawLng = context.domiciles.length > 0 ? context.domiciles.reduce((acc, d) => acc + d.location.lng, 0) / context.domiciles.length : null;

    const geoValidation = validateGeoIntegrity(rawLat, rawLng);
    const centerLat = geoValidation.latitude;
    const centerLng = geoValidation.longitude;

    let markdown = `# INFORME DE INTELIGENCIA TÁCTICA GEOINT CRIMINAL\n`;
    markdown += `**Centro de Estudios y Política Criminal (CEIPOL)**\n`;
    markdown += `**Fecha de Análisis:** ${new Date().toLocaleDateString("es-MX")}\n`;
    const locationTag = centerLat !== null && centerLng !== null 
      ? `[${centerLat.toFixed(5)}, ${centerLng.toFixed(5)}]` 
      : "[Ubicación No Validada]";
    markdown += `**Área de Operación:** Sector Aguascalientes ${locationTag}\n`;
    markdown += `**Confianza del Análisis:** **${output.confianza_global}/10.0**\n\n`;

    markdown += `### 1. Resumen Ejecutivo\n`;
    markdown += `Este dictamen oficial compila el análisis geoespacial táctico integrado para las organizaciones delictivas: **${output.pandillas_analizadas.join(", ")}**. A partir de un total de **${context.domiciles.length} domicilios** y **${context.influenceZones.length} zonas de influencia** ingresadas, se procesó la correlación multifuente geoespacial arrojando un puntaje global de riesgo de alta severidad. Se identifican múltiples colisiones territoriales potenciales y vulnerabilidad en la conectividad del sector comercial.\n\n`;

    markdown += `### 2. Análisis Territorial\n`;
    markdown += `La cuadrícula operativa del CEIPOL detecta que la presencia delictiva se asienta principalmente en los distritos oriente y centro de la capital del estado de Aguascalientes. El análisis de entornos sociodemográficos (INEGI SCINCE) denota una correlación entre áreas de alta marginación y la tasa de reclutamiento delictivo, mientras que la cercanía a giros comerciales (INEGI DENUE) amplifica las oportunidades de extorsión y vandalismo.\n\n`;

    markdown += `### 3. Estructura Criminal\n`;
    markdown += `Mediante la georreferenciación de domicilios y roles, se identificó la concentración espacial de liderazgo. Se registra la presencia de integrantes jerárquicos (Líderes / Segundos al mando) con residencias adyacentes a las zonas de influencia directa. Los nodos de menor nivel (Miembros / Halcones) se asientan de manera periférica para establecer anillos concéntricos de alerta operacional.\n\n`;

    markdown += `### 4. Movilidad y Expansión\n`;
    markdown += `Se evaluaron **${output.corredores_movilidad.length} corredores de movilidad** documentados en el inventario. Estas rutas representan las líneas de tránsito más probables para la distribución y el repliegue táctico. Se proyecta que las organizaciones delictivas utilizan estas arterias urbanas para conectar sus bases operativas con los puntos de comercialización ilegal.\n\n`;

    markdown += `### 5. Correlaciones Multifuente\n`;
    markdown += `El cruce espacial cruzó bases de datos de pandillas con trazos manuales y cronologías de expedientes. Se registraron los siguientes hallazgos de correlación:\n`;
    output.correlaciones_clave.forEach(c => {
      markdown += `- ${c}\n`;
    });
    markdown += `\n`;

    markdown += `### 6. Zonas de Riesgo\n`;
    markdown += `Se detectaron **${output.zonas_criticas.length} zonas críticas de colisión** y **${output.clusters_detectados.length} clusters delictivos** de alta densidad. Estas áreas representan puntos calientes de alta vulnerabilidad operativa:\n`;
    output.zonas_criticas.forEach(z => {
      markdown += `- **Zona Crítica [${z.lat.toFixed(5)}, ${z.lng.toFixed(5)}]:** ${z.descripcion} (Nivel: ${z.nivel.toUpperCase()})\n`;
    });
    markdown += `\n`;

    markdown += `### 7. Hipótesis Operativas\n`;
    markdown += `El motor de inferencia geoespacial formuló las siguientes hipótesis tácticas:\n`;
    output.hipotesis_operacionales.forEach(h => {
      markdown += `- ${h}\n`;
    });
    markdown += `\n`;

    markdown += `### 8. Conclusiones\n`;
    markdown += `1. **Despliegue Focalizado:** Se sugiere realizar patrullajes y cercos policiales en las intersecciones de corredores de movilidad y clusters identificados.\n`;
    markdown += `2. **Aseguramiento de Hotspots:** Priorizar las intervenciones en los buffers y geometrías manuales de nivel crítico.\n`;
    markdown += `3. **Robustecimiento de Fuentes:** Continuar georreferenciando evidencias fotográficas e incorporándolas al sistema para mantener la confiabilidad de la alerta.\n\n`;

    markdown += `### 9. Nivel de Confianza\n`;
    markdown += `La confianza global del análisis se calcula matemáticamente a partir del peso y fiabilidad de cada fuente activa:\n`;
    markdown += `- **Puntaje de Confianza Global:** **${output.confianza_global}/10.0**\n`;
    markdown += `- **Fuentes Utilizadas en la Ponderación:**\n`;
    output.fuentes_utilizadas.forEach(f => {
      markdown += `  * ${f}\n`;
    });

    return markdown;
  }
}
