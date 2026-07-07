export interface ReportContext {
  projectName: string;
  projectId: string;
  projectDescription: string;
  analysisRadius: number;
  geometryType: string;
  focusAreas?: string[];
  incidenciaLocal?: any[];
  bibliografiaLocal?: string;
  multimodalContext?: string;
  osintEngineData?: any;
  streetViews?: any[];
  datosGobMxData?: any;
  linkedGangReport?: any;
  sweeps?: any[];
  sweepsComments?: string;
  photos?: any[];
  analysisContext?: string;
}

/**
 * 1. PORTADA + EXECUTIVE SUMMARY
 */
export const ExecutiveSummaryPrompt = (ctx: ReportContext): string => {
  return `
--- INICIO MÓDULO: RESUMEN EJECUTIVO (PORTADA) ---
Eres un Analista de Inteligencia del CEIPOL.
Genera un Resumen Ejecutivo en un tono estrictamente institucional para el expediente "${ctx.projectName}" (Número: ${ctx.projectId}), con fecha ${new Date().toLocaleDateString('es-MX')}.

El resumen ejecutivo debe presentarse en formato de tabla o bloque estructurado y ser extremadamente conciso (máximo 150 palabras). Debe responder puntualmente a:
1. Área geográfica: ${ctx.projectDescription}, Radio: ${ctx.analysisRadius} metros, Cobertura: ${ctx.geometryType}.
2. Problema territorial principal detectado.
3. Hipótesis central delictiva en una sola frase.
4. Factores críticos ambientales identificados (máx. 3 bullets cortos).
5. Acción prioritaria recomendada.

Instrucciones de Estilo:
- Prohibido utilizar jerga de desarrollo, mencionar APIs, prompts, motores o procesos técnicos internos.
- Sé sumamente directo y ejecutivo.
- Todo elemento visual o tabla debe llevar la marca de agua: SSPE-CEIPOL.
--- FIN MÓDULO ---
`.trim();
};

/**
 * 2. CAPÍTULO 1: CONTEXTO DEL ANÁLISIS
 */
export const TerritorialAnalysisPrompt = (ctx: ReportContext): string => {
  return `
--- INICIO MÓDULO: CONTEXTO DEL ANÁLISIS (CAPÍTULO 1) ---
Genera el Capítulo 1 del Informe: "CONTEXTO DEL ANÁLISIS".
Ubicación: ${ctx.projectDescription}
Radio: ${ctx.analysisRadius} metros
Polígono: ${ctx.geometryType}

Instrucciones:
- Explica de forma directa el área analizada, el objetivo táctico de la investigación y las fuentes empleadas (cartografía, fotos de campo, OSINT).
- Sé muy conciso (máximo 80 palabras).
- Prohibido mencionar APIs, lenguajes de programación, nombres de algoritmos o procesos internos de computación.
- Tono puramente formal e institucional.
--- FIN MÓDULO ---
`.trim();
};

/**
 * 3. CAPÍTULO 2: HIPÓTESIS CRIMINOLÓGICA AMBIENTAL
 */
export const HypothesisPrompt = (ctx: ReportContext): string => {
  return `
--- INICIO MÓDULO: HIPÓTESIS CRIMINOLÓGICA AMBIENTAL (CAPÍTULO 2) ---
Genera el Capítulo 2: "HIPÓTESIS CRIMINOLÓGICA AMBIENTAL".
Contexto de hipótesis: "${ctx.analysisContext || 'Sin hipótesis inicial.'}"

Instrucciones:
1. Plantea una única hipótesis delictiva central del cuadrante de forma directa y concisa.
2. Detalla brevemente los elementos que la sustentan: factores territoriales, evidencia visual de campo, incidencia delictiva y datos OSINT.
3. Separa el análisis obligatoriamente usando las etiquetas:
   - HECHO: (Dato empírico verificado).
   - INFERENCIA: (Deducción lógica del hecho).
   - VALORACIÓN: (Evaluación de riesgo).
4. Sé extremadamente breve y ve directo al grano (máximo 150 palabras). No uses narraciones de relleno.
--- FIN MÓDULO ---
`.trim();
};

/**
 * 4. CAPÍTULO 3: ANÁLISIS TERRITORIAL CARTOGRÁFICO
 */
export const MapsInterpretationPrompt = (ctx: ReportContext): string => {
  return `
--- INICIO MÓDULO: ANÁLISIS TERRITORIAL CARTOGRÁFICO (CAPÍTULO 3) ---
Genera el Capítulo 3: "ANÁLISIS TERRITORIAL CARTOGRÁFICO".

Instrucciones:
- Interpreta de manera espacial y criminológica los mapas tácticos del expediente (Densidad Criminológica, Atracción y Factores, Corredores y Movilidad, Proyección Predictiva a 6 Meses).
- Regla Estricta: Prohibido describir el mapa. Debes INTERPRETAR la distribución espacial y qué significa operativamente (ej. "La concentración espacial observada en la intersección X evidencia un patrón de oportunidad asociado a...").
- Para cada uno de los mapas, asóciale un título claro y una interpretación analítica muy concisa (máximo 2 líneas por mapa).
- Sella la interpretación con el pie de imagen: "🔒 SSPE-CEIPOL | Marca de agua institucional".
--- FIN MÓDULO ---
`.trim();
};

/**
 * 5. CAPÍTULO 4: ANÁLISIS ESTADÍSTICO
 */
export const GraphAnalysisPrompt = (ctx: ReportContext): string => {
  const incidentCount = ctx.incidenciaLocal?.length || 0;
  return `
--- INICIO MÓDULO: ANÁLISIS ESTADÍSTICO (CAPÍTULO 4) ---
Genera el Capítulo 4: "ANÁLISIS ESTADÍSTICO".
Datos: ${incidentCount} incidentes delictivos en el radio analizado.

Instrucciones:
- Redacta una interpretación analítica sumamente breve para las gráficas estadísticas delictivas (máximo 4 gráficas).
- Cada gráfica interpretada debe responder de forma resumida (máximo 2 líneas cada una): qué ocurre, dónde, cuándo y qué significa.
- Sin textos decorativos ni introducciones redundantes.
- Leyenda: "🔒 SSPE-CEIPOL".
--- FIN MÓDULO ---
`.trim();
};

/**
 * 6. CAPÍTULO 5: EVIDENCIA FOTOGRÁFICA
 */
export const EvidenceAnalysisPrompt = (ctx: ReportContext): string => {
  const photoCount = ctx.photos?.length || 0;
  return `
--- INICIO MÓDULO: EVIDENCIA FOTOGRÁFICA DE CAMPO (CAPÍTULO 5) ---
Genera el Capítulo 5: "EVIDENCIA FOTOGRÁFICA".
Evidencias disponibles: ${photoCount} fotografías de campo.

Instrucciones:
- Proporciona el análisis de la evidencia fotográfica de campo.
- Para cada imagen del expediente, redacta un análisis sumamente corto (máximo 3 líneas) que contenga:
  1. Observación objetiva: Qué elemento físico se observa.
  2. Interpretación ambiental: Qué vulnerabilidad representa.
  3. Relación con la hipótesis central: Por qué importa.
- Prohibido mencionar nombres de herramientas IA, comandos OCR, PowerUps o procesos internos.
- Todo pie de imagen debe ostentar el sello oficial: "🔒 SSPE-CEIPOL".
--- FIN MÓDULO ---
`.trim();
};

/**
 * 7. CAPÍTULO 6: STREET VIEW INTELLIGENCE
 */
export const StreetViewIntelligencePrompt = (ctx: ReportContext): string => {
  const svCount = ctx.streetViews?.length || 0;
  return `
--- INICIO MÓDULO: STREET VIEW INTELLIGENCE (CAPÍTULO 6) ---
Genera el Capítulo 6: "STREET VIEW INTELLIGENCE".
Puntos de Street View: ${svCount} registros.

Instrucciones:
- Analiza de forma muy breve y puntual los puntos de ocultamiento, acecho, rutas de acceso/salida o baja vigilancia natural detectados.
- No uses la frase "Street View detectó actividad criminal". Usa lenguaje analítico profesional: "El análisis visual identificó condiciones ambientales compatibles con la facilitación de..."
- Sé extremadamente conciso (máximo 100 palabras en total).
- Incluir en cada hallazgo la marca de agua: "🔒 SSPE-CEIPOL".
--- FIN MÓDULO ---
`.trim();
};

/**
 * 8. CAPÍTULO 7: INTELIGENCIA OSINT
 */
export const OSINTAnalysisPrompt = (ctx: ReportContext): string => {
  return `
--- INICIO MÓDULO: INTELIGENCIA OSINT (CAPÍTULO 7) ---
Genera el Capítulo 7: "INTELIGENCIA OSINT".
Datos OSINT: "${ctx.osintEngineData ? JSON.stringify(ctx.osintEngineData) : 'Sin barrido directo disponible.'}"

Instrucciones:
- Transforma la información de fuentes abiertas y noticias locales en un análisis contextual de entorno muy conciso (máximo 80 palabras).
- Responde directamente: ¿Qué información externa de prensa o incidentes locales fortalece la hipótesis operativa?
- Prohibido mostrar un listado crudo de titulares o enlaces. La información debe integrarse de forma fluida.
--- FIN MÓDULO ---
`.trim();
};

/**
 * 9. CAPÍTULO 8: ACTORES TERRITORIALES Y PANDILLAS
 */
export const GangAnalysisPrompt = (ctx: ReportContext): string => {
  return `
--- INICIO MÓDULO: ACTORES TERRITORIALES Y PANDILLAS (CAPÍTULO 8) ---
Genera el Capítulo 8: "ACTORES TERRITORIALES Y PANDILLAS".
Datos de pandilla vinculada: ${ctx.linkedGangReport ? JSON.stringify(ctx.linkedGangReport) : 'Ninguno.'}

Instrucciones:
- Analiza la vinculación territorial de grupos de riesgo únicamente si existe evidencia y zona de influencia activa en el polígono.
- Si no existe una relación territorial comprobable, debes indicar textualmente: "No se identificó relación territorial comprobable de grupos de riesgo o pandillas con el área bajo análisis."
- Sé directo y evita especulaciones.
--- FIN MÓDULO ---
`.trim();
};

/**
 * 10. CAPÍTULO 9: GRAFO DE HIPÓTESIS HIG 2.0
 */
export const HIGGraphPrompt = (ctx: ReportContext): string => {
  return `
--- INICIO MÓDULO: GRAFO DE HIPÓTESIS HIG 2.0 (CAPÍTULO 9) ---
Genera el Capítulo 9: "GRAFO DE HIPÓTESIS HIG 2.0".

Instrucciones:
- Explica de manera concisa cómo se conecta la hipótesis con la evidencia y los factores ambientales en el Grafo HIG 2.0.
- Redacta la sección "Lectura Operacional del Grafo HIG 2.0" con un máximo de 100 palabras de forma muy directa.
- Todo pie de gráfica o grafo debe llevar la marca de agua: "🔒 SSPE-CEIPOL".
--- FIN MÓDULO ---
`.trim();
};

/**
 * 11. CAPÍTULO 10: CONCLUSIONES OPERATIVAS
 */
export const OperationalConclusionPrompt = (ctx: ReportContext): string => {
  return `
--- INICIO MÓDULO: CONCLUSIONES OPERATIVAS (CAPÍTULO 10) ---
Genera el Capítulo 10: "CONCLUSIONES OPERATIVAS".

Instrucciones:
- Define las acciones que la institución debe realizar en el territorio estudiado.
- Estructura las recomendaciones obligatoriamente en tres plazos (máximo 2 bullets cortos por plazo):
  1. Acción inmediata (0 a 30 días).
  2. Acción preventiva (30 a 90 días).
  3. Acción estratégica (más de 90 días).
- Sé directo, imperativo y sumamente conciso.
--- FIN MÓDULO ---
`.trim();
};
