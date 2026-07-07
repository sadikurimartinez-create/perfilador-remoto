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
Eres un Analista Senior de Inteligencia del CEIPOL.
Genera un Resumen Ejecutivo en un tono estrictamente institucional para el expediente "${ctx.projectName}" (Número de Expediente: ${ctx.projectId}), con fecha ${new Date().toLocaleDateString('es-MX')}.

El resumen ejecutivo debe presentarse en formato de tabla o bloque estructurado y no exceder las 350 palabras. Debe responder de manera sintética y clara a las siguientes preguntas operativas:
1. ¿Qué área geográfica fue analizada? (Ubicación: ${ctx.projectDescription}, Radio: ${ctx.analysisRadius} metros, Cobertura: ${ctx.geometryType}).
2. ¿Qué problema territorial principal se identificó?
3. ¿Cuál es la hipótesis central delictiva?
4. ¿Cuáles son los factores críticos criminógenos ambientales identificados?
5. ¿Qué acciones inmediatas y prioritarias se recomiendan?

Instrucciones de Estilo:
- Prohibido utilizar jerga de desarrollo, mencionar APIs, prompts, motores o nombres de procesos informáticos.
- Divide las respuestas de forma clara y ejecutiva para lectura rápida (menos de 60 segundos).
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
Genera el Capítulo 1 del Informe de Geointeligencia: "CONTEXTO DEL ANÁLISIS".
Ubicación del Expediente: ${ctx.projectDescription}
Radio: ${ctx.analysisRadius} metros
Polígono: ${ctx.geometryType}
Fuentes disponibles para el análisis:
- Incidencia delictiva de campo (histórico georreferenciado)
- Registro y censo de factores ambientales y atrayentes comerciales de oportunidad
- Registro visual en terreno por analistas del CEIPOL
- Barridos OSINT de noticias y fuentes abiertas locales
- Red de relaciones de variables del sector

Instrucciones:
- Explica qué área territorial se analizó, el objetivo del análisis táctico y las fuentes utilizadas para estructurar el dictamen.
- Prohibido mencionar APIs, lenguajes de programación, nombres de algoritmos o procesos internos de computación.
- Extensión máxima: Media página (aproximadamente 200 palabras).
- Tono meramente formal, policial e institucional.
--- FIN MÓDULO ---
`.trim();
};

/**
 * 3. CAPÍTULO 2: HIPÓTESIS CRIMINOLÓGICA AMBIENTAL
 */
export const HypothesisPrompt = (ctx: ReportContext): string => {
  return `
--- INICIO MÓDULO: HIPÓTESIS CRIMINOLÓGICA AMBIENTAL (CAPÍTULO 2) ---
Genera el Capítulo 2 del Informe de Geointeligencia: "HIPÓTESIS CRIMINOLÓGICA AMBIENTAL".
Contexto de hipótesis del investigador: "${ctx.analysisContext || 'Sin hipótesis inicial.'}"

Instrucciones:
1. Plantea una ÚNICA hipótesis delictiva central del cuadrante.
2. Explica y detalla los elementos específicos que sustentan esta hipótesis:
   - Factores territoriales observados.
   - Evidencia visual recopilada en campo.
   - Incidencia delictiva del entorno.
   - Inteligencia OSINT y actores locales de riesgo.
3. Debes realizar una distinción explícita en el texto o estructura bajo el siguiente formato conceptual:
   - HECHO (Lo que está empíricamente verificado: ej. infraestructura dañada, incidentes reales).
   - INFERENCIA (La deducción lógica que se deriva del hecho: ej. cómo influye en el comportamiento delictivo).
   - VALORACIÓN (La evaluación operativa y nivel de riesgo estimado).
4. No menciones procesos internos de la IA ni comandos.
5. Extensión máxima: Una página (aproximadamente 400 palabras).
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
- Interpreta de manera espacial y criminológica los mapas tácticos de geointeligencia provistos en el expediente (máximo 4 mapas).
- Regla Estricta: Prohibido simplemente describir el mapa (ej. Evita escribir "Mapa que muestra puntos rojos"). En su lugar, debes INTERPRETAR la distribución espacial y qué significa operativamente (ej. "La concentración espacial observada en la intersección X evidencia un patrón de oportunidad asociado a...").
- Para cada uno de los mapas del dictamen (Densidad Criminológica, Atracción y Factores, Corredores y Movilidad, Proyección Predictiva a 6 Meses), asóciale un título claro, simbología interpretada, e interpretación analítica.
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
Datos de incidencia en el cuadrante:
- Se registraron ${incidentCount} incidentes delictivos en el radio de análisis.
- Frecuencia y tipologías delictivas según la base de datos de llamadas de emergencia del sector.

Instrucciones:
- Redacta la interpretación analítica de las gráficas de frecuencia temporal y tipológica delictiva (máximo 4 gráficas).
- Cada gráfica interpretada debe dar respuesta a:
  * ¿Qué ocurre? (Fenómenos detectados).
  * ¿Dónde? (Ubicación o patrones espaciales).
  * ¿Cuándo? (Distribución horaria, turnos críticos).
  * ¿Qué significa? (Implicación criminógena).
- Evita explicaciones decorativas o redundantes. Cada afirmación estadística debe estar vinculada a los patrones de la zona analizada.
- Todo recurso debe incluir la leyenda: "🔒 SSPE-CEIPOL".
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
Se dispone de ${photoCount} fotografías de evidencia recopiladas por el analista táctico en el perímetro.

Instrucciones:
- Proporciona un marco analítico y estructurado para la evidencia visual de campo (máximo dos fotografías por página).
- Para cada imagen relevante del expediente, redacta un análisis que contenga:
  1. Observación objetiva: Qué elemento físico o infraestructura se observa en la fotografía.
  2. Interpretación ambiental: Qué vulnerabilidad o facilitador de oportunidad representa.
  3. Relación con la hipótesis central: Por qué este elemento físico sustenta o agrava la hipótesis delictiva establecida.
- Prohibido mencionar names de herramientas IA, comandos OCR, PowerUps de procesamiento o cualquier proceso técnico interno.
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
Se cuenta con ${svCount} registros fotográficos automatizados de Street View correspondientes al polígono.

Instrucciones:
- El análisis visual y ambiental de las vías urbanas mediante Street View es OBLIGATORIO para evaluar la facilidad de acecho y la vulnerabilidad urbana.
- Identifica y analiza en la geografía del cuadrante:
  * Puntos de ocultamiento y acecho.
  * Rutas de acceso y salida de sospechosos.
  * Sectores con baja vigilancia natural (puntos ciegos por vegetación, bardas o iluminación deficiente).
  * Deterioro urbano e infraestructura descuidada.
- Para cada registro, describe objetivamente el hallazgo, su ubicación, su interpretación ambiental y cómo se relaciona con la hipótesis delictiva.
- Prohibido escribir frases de alarma infundada como "Street View detectó actividad criminal". En su lugar, utiliza un lenguaje analítico profesional: "El análisis visual identificó condiciones ambientales de vulnerabilidad que favorecen..." o "compatibles con la facilitación de...".
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
Información recolectada mediante barrido OSINT: "${ctx.osintEngineData ? JSON.stringify(ctx.osintEngineData) : 'Sin barrido directo disponible.'}"

Instrucciones:
- Transforma la información de fuentes abiertas y noticias locales en un análisis contextual de inteligencia.
- Responde directamente a: ¿Qué información externa de prensa, incidentes locales u opinión pública en redes sociales modifica, fortalece o amplía la hipótesis operativa en el área analizada?
- Prohibido mostrar un listado crudo de titulares, enlaces o URLs sin procesar. La información debe integrarse de forma fluida y redactarse como conclusiones analíticas y de entorno.
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
Datos de pandilla vinculada en el expediente: ${ctx.linkedGangReport ? JSON.stringify(ctx.linkedGangReport) : 'Ninguno.'}

Instrucciones:
- Regla estricta: Analiza grupos de riesgo y pandillas solo si existe una zona de influencia activa demostrada dentro del área de interés, integrantes vinculados al polígono analizado o evidencia documental comprobable.
- Si NO existe una relación territorial comprobable basada en los datos anteriores, debes indicar textualmente y de forma explícita: "No se identificó relación territorial comprobable de grupos de riesgo o pandillas con el área bajo análisis."
- Evita especulaciones sin fundamento.
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
- El Grafo de Hipótesis representa el razonamiento de inteligencia y la relación estructurada de los elementos analizados.
- Describe la estructura del grafo considerando:
  * Nodo central: Hipótesis criminológica delictiva.
  * Nodos secundarios: Evidencia física, factores territoriales, vulnerabilidades de Street View, inteligencia OSINT y actores de riesgo.
- Explica de manera concisa cada conexión en el grafo respondiendo a: ¿Por qué este factor específico influye en la hipótesis final?
- Redacta la sección "Lectura Operacional del Grafo HIG 2.0" con un máximo de 300 palabras.
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
Genera el Capítulo 10 del Informe: "CONCLUSIONES OPERATIVAS".

Instrucciones:
- Define las acciones y prioridades que la institución debe realizar en el territorio estudiado para mitigar los riesgos delictivos y reducir las vulnerabilidades.
- Estructura las recomendaciones obligatoriamente en tres plazos bien diferenciados:
  1. Acción inmediata (Plazo de 0 a 30 días): Intervenciones prioritarias de disuasión o corrección física urgente.
  2. Acción preventiva (Plazo de 30 a 90 días): Programas preventivos locales, inspección comercial o de infraestructura urbana.
  3. Acción estratégica (Plazo de más de 90 días): Políticas de largo plazo, rediseño de espacios o reestructuración urbana.
- El lenguaje debe ser directo, imperativo y orientado a la toma de decisiones por mandos policiales.
--- FIN MÓDULO ---
`.trim();
};
