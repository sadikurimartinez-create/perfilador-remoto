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
  sieData?: any;
  tceData?: any;
}

/**
 * 1. PORTADA + EXECUTIVE SUMMARY
 */
export const ExecutiveSummaryPrompt = (ctx: ReportContext): string => {
  return `
--- INICIO MÓDULO: RESUMEN EJECUTIVO (PORTADA) ---
Genera el Resumen Ejecutivo del "Informe de Geointeligencia Operativa" para el expediente "${ctx.projectName}" (Número de Expediente: ${ctx.projectId}).

El resumen ejecutivo debe ser sumamente analítico y formal, con un máximo de 350 palabras, y estructurarse bajo los siguientes apartados explícitos:

1. ¿Qué ocurre?: Descripción del fenómeno territorial delictivo o de desorden analizado.
2. ¿Dónde ocurre?: Ubicación exacta y delimitación geoespacial del área (Radio: ${ctx.analysisRadius}m, Cobertura: ${ctx.geometryType}).
3. ¿Qué evidencia lo sostiene?: Fuentes utilizadas para sostener el análisis (secciones de incidencia, mapas, fotografías, OSINT, Street View, pandillas, DENUE y SCINCE).
4. ¿Cuál es el riesgo?: Clasificación formal de riesgo (BAJO, MEDIO, ALTO).
5. ¿Qué debe hacerse?: Tres acciones prioritarias recomendadas en terreno.

Reglas:
- Evita lenguaje técnico informal o marcas internas de sistemas.
- Sé ejecutivo y conciso.
- Todo elemento visual o tabla debe llevar la marca de agua: SSPE-CEIPOL.
--- FIN MÓDULO ---
`.trim();
};

/**
 * 2. CAPÍTULO 1: CONTEXTO DEL ANÁLISIS
 */
export const TerritorialAnalysisPrompt = (ctx: ReportContext): string => {
  const tceJson = ctx.tceData ? JSON.stringify(ctx.tceData, null, 2) : "Sin datos procesados por el motor de contexto territorial TCE.";
  return `
--- INICIO MÓDULO: CONTEXTO DEL ANÁLISIS (CAPÍTULO 1) ---
Genera el Capítulo 1: "CONTEXTO DEL ANÁLISIS".

JSON de Datos del Territorial Context Engine (TCE):
\`\`\`json
${tceJson}
\`\`\`

REGLAS DE GENERACIÓN DE TEXTO:
1. Queda TERMINANTEMENTE PROHIBIDO inventar la motivación de la investigación, el alcance territorial, la metodología o las fuentes de información. Todo debe provenir de los datos del JSON.
2. Si algún bloque o variable del JSON indica que un dato no está disponible o tiene baja disponibilidad, deberás escribir explícitamente "Información no disponible" en el subapartado correspondiente, sin rellenarlo con especulaciones.
3. El dictamen debe estructurarse obligatoriamente con los siguientes 4 apartados numerados:

2.1 Motivo del análisis.
- Sintetizar la motivación real de la investigación a partir del campo "executiveSummary.motivoAnalisis".

2.2 Alcance territorial.
- Describir con precisión matemática los límites geográficos: latitud, longitud, radio del buffer en metros, tipo de geometría, superficie aproximada en metros cuadrados y perímetro en metros calculados en "territorialContext".
- Mencionar los indicadores y vulnerabilidades físicas/urbanas descritas en "urbanContext" y "demographicContext" (si están disponibles).

2.3 Metodología utilizada.
- Detallar las fases metodológicas institucionales descritas en "methodologicalContext.stages".

2.4 Fuentes integradas.
- Listar y justificar formalmente cada una de las fuentes activas reportadas en "sources.list".

REGLAS EDITORIALES:
- Sé directo, formal e institucional. Evita narrativas genéricas introductorias y explicaciones de relleno.
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
Establece obligatoriamente una única hipótesis criminológica central estructurada con el siguiente formato estricto:

## Hipótesis:
[Redacción completa, coherente y directa de la hipótesis en un párrafo analítico]

## Evidencia que la soporta:
[Listado estructurado de los elementos de soporte analizados: mapas, gráficas, fotos de campo, OSINT y Street View]

## Nivel de confianza:
[Indicar únicamente ALTO, MEDIO o BAJO basado en la cantidad y calidad de evidencia]

## Factores que podrían modificarla:
[Detallar factores pendientes de validar o elementos que podrían alterar la hipótesis planteada]
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
- Regla Estricta: Prohibido describir visualmente el mapa de forma pasiva. Cada mapa interpretado debe estructurarse obligatoriamente bajo los siguientes tres apartados analíticos de forma concisa:
  - Hallazgo espacial: ¿Qué patrón o concentración muestra geoespacialmente el mapa?
  - Interpretación criminológica: ¿Por qué es relevante este patrón ambiental para explicar la oportunidad delictiva?
  - Impacto operativo: ¿Qué decisión táctica directa permite tomar a las unidades en campo?
- Añade el sello de agua: "🔒 SSPE-CEIPOL".
--- FIN MÓDULO ---
`.trim();
};

/**
 * 5. CAPÍTULO 4: ANÁLISIS ESTADÍSTICO
 */
export const GraphAnalysisPrompt = (ctx: ReportContext): string => {
  const sieJson = ctx.sieData ? JSON.stringify(ctx.sieData, null, 2) : "Sin datos procesados por el motor estadístico SIE.";
  return `
--- INICIO MÓDULO: ANÁLISIS ESTADÍSTICO (CAPÍTULO 4) ---
Genera el Capítulo 4: "ANÁLISIS ESTADÍSTICO".
Radio de análisis: ${ctx.analysisRadius} metros.

JSON de Resultados del Statistical Intelligence Engine (SIE):
\`\`\`json
${sieJson}
\`\`\`

REGLAS DE GENERACIÓN DE TEXTO:
1. Queda TERMINANTEMENTE PROHIBIDO inventar estadísticas, estimar porcentajes arbitrarios, o interpretar información que no figure de forma explícita en el JSON del SIE.
2. Tu rol es únicamente de redactor técnico-institucional de la información cuantitativa calculada.
3. El dictamen debe estructurarse obligatoriamente con los siguientes 5 apartados y responder de forma analítica y formal a las preguntas metodológicas usando los datos provistos:

4.1 Dinámica Temporal del Fenómeno Criminal
- Describir cómo evoluciona la tendencia de crímenes en el sector según la variación mensual calculada y el índice de aceleración/desaceleración delictiva.
- Mencionar de forma explícita si existen anomalías (picos de incidencia) en fechas específicas.

4.2 Inteligencia Espacio Temporal
- Describir el centro de gravedad (Mean Center), la desviación estándar espacial (en metros) y la dirección dominante de la elipse direccional.
- Explicar la clasificación de la expansión territorial (ej. "Concentración Sectorizada con Rutas de Escape", "Focalización Táctica Aguda" o "Expansión Crítica") basándote en los datos espaciales.
- Señalar la ubicación o magnitud de los hotspots principales detectados.

4.3 Perfil Operativo del Fenómeno
- Detallar el comportamiento operativo, especificando las variables predominantes: horarios críticos (ventana de oportunidad) y el día de la semana con mayor concentración de incidentes.
- Vincular la estacionalidad delictiva o ventana crítica con la vulnerabilidad operativa en el área.

4.4 Factores de Oportunidad
- Analizar la correlación entre la incidencia concentrada en los hotspots y el nivel de oportunidad/vulnerabilidad ambiental provisto por el SIE (índice de oportunidad de atractores y vulnerabilidad ambiental).

4.5 Inteligencia Predictiva
- Explicar qué escenario predictivo puede ocurrir en el área basándose en la probabilidad de repetición semanal y mensual calculada por el modelo de Poisson.
- Indicar explícitamente el nivel de confianza y error del modelo predictivo y las variables explicativas utilizadas.

REGLA DE EVIDENCIA INSUFICIENTE:
Si el JSON indica totalEventos de 0 o evidencia insuficiente, debes escribir textualmente la frase: "Evidencia insuficiente para establecer una inferencia estadísticamente sustentada", y omitir cualquier tipo de especulación analítica o porcentajes arbitrarios.
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
Fotografías de campo en el expediente: ${photoCount}.

Instrucciones:
- Estructura el análisis de cada una de las fotografías de campo agregadas al expediente.
- El análisis de cada fotografía debe ser sintético (máximo 150 palabras) y contener obligatoriamente estos tres títulos:
  - Observación: Qué elemento físico o anomalía del entorno aparece.
  - Interpretación: Qué significa o qué vulnerabilidad física representa.
  - Relación con hipótesis: Cómo influye o fortalece la hipótesis criminal central.
- No incluyas nombres de herramientas de desarrollo ni procesos internos.
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
Evidencias Street View en el expediente: ${svCount}.

Instrucciones:
- Analiza de forma exhaustiva y analítica los puntos críticos de vulnerabilidad física identificados en Street View.
- Busca identificar factores como: puntos de ocultamiento, lugares de acecho, rutas de escape, espacios de baja visibilidad natural, inmuebles abandonados o barreras visuales.
- Para cada hallazgo analizado, detalla obligatoriamente:
  1. Ubicación.
  2. Descripción física detallada.
  3. Valoración operativa de vulnerabilidad.
- Prohibido limitarse a decir "Se detectó mediante Street View". Se debe realizar una valoración criminológica real.
- Incluir sello de agua institucional: "🔒 SSPE-CEIPOL".
--- FIN MÓDULO ---
`.trim();
};

/**
 * 8. CAPÍTULO 7: INTELIGENCIA OSINT
 */
export const OSINTAnalysisPrompt = (ctx: ReportContext): string => {
  const sweepSummary = ctx.sweeps && ctx.sweeps.length > 0
    ? ctx.sweeps.slice(0, 10).map(s => `- [${s.engine || s.source}]: ${(s.data || "").slice(0, 200)}`).join("\n")
    : "Sin barridos OSINT integrados en el expediente.";

  const gangReportSummary = ctx.linkedGangReport
    ? `Riesgo: ${ctx.linkedGangReport.risk_classification || "LOW"}, matched_gangs: ${JSON.stringify(ctx.linkedGangReport.matched_gangs || [])}, confidence: ${ctx.linkedGangReport.confidence_score ?? 0}`
    : "Sin reporte de pandillas.";

  return `
--- INICIO MÓDULO: INTELIGENCIA OSINT (CAPÍTULO 7) ---
Genera el Capítulo 7: "INTELIGENCIA OSINT".
Radio de análisis: ${ctx.analysisRadius} metros.
Datos de entrada OSINT: "${ctx.osintEngineData ? JSON.stringify(ctx.osintEngineData) : 'Sin barrido directo disponible.'}"
Barridos integrados al expediente:
${sweepSummary}

Resultado del Barrido de Pandillas (Módulo GIS):
${gangReportSummary}

REGLA CRÍTICA DE COHERENCIA DE PANDILLAS (MÚLTIPLES BARRIDOS):
Si el Resultado del Barrido de Pandillas indica que no hay presencia de pandillas (matched_gangs vacío, o confidencescore / confidence de 0, o riesgo LOW), queda TERMINANTEMENTE PROHIBIDO que el análisis OSINT invente, mencione o infiera la presencia, control territorial o actividad de pandillas específicas (tales como "ZKL13", "LOS 90", "La Clica Palomino Dena", "Benito Palomino Sur Gang" o cualquier otra) en el área de análisis.
Si el barrido es negativo o de bajo riesgo, el dictamen OSINT debe ser consistente: debe limitarse a reportar la actividad de delincuencia común (robo a transeúnte, robo de vehículos, asalto peatonal) y flujos comerciales, pero SIN asociarla a pandillas u organizaciones delictivas locales. Prioriza siempre la coherencia del expediente.

REGLA CRÍTICA GENERAL: Prohibido redactar afirmaciones abstractas. Cada conclusión debe ser inteligencia operativa verificable.

Estructura OBLIGATORIA (usar exactamente estos encabezados):

HALLAZGO:
- Indicar QUÉ se detectó, DÓNDE (calle, colonia, corredor), con nombres de establecimientos si existen (tiendas, farmacias, bares, escuelas, etc.).
- Incluir horarios de mayor actividad cuando la evidencia lo permita.
- Prohibido: "alta concentración comercial", "existe flujo" o "percepción de inseguridad" sin especificar.

EVIDENCIA:
- Enumerar explícitamente las fuentes utilizadas entre: Facebook, X, Reddit, DENUE, Google Maps, Google Reviews, Street View, Noticias, Datos Abiertos, Catastro, Incidencia delictiva, Reportes ciudadanos, Telegram.
- Indicar cuáles fueron consultadas en ESTE expediente.
- Prohibido: "Publicaciones georreferenciadas" sin nombrar fuentes.

ANÁLISIS:
- Explicar DÓNDE ocurre el fenómeno: calles, cruces, tramos y evidencia visual si existe.
- Vincular el hallazgo con la hipótesis central del expediente.
- Prohibido: "la falta de alumbrado genera percepción de inseguridad" sin ubicación exacta.

IMPLICACIÓN OPERATIVA:
- Indicar DÓNDE actuar, QUÉ calles/corredores, QUÉ horario (ej. 18:00–23:00) y POR QUÉ.
- Prohibido: "realizar recorridos de proximidad" sin calles ni horario.

Ejemplo de calidad mínima aceptable:
"Se identificó un corredor comercial conformado por Abarrotes La Glorieta, Farmacia Guadalajara y Tortillería San Antonio sobre Avenida Paseos de San Antonio y calle Menorca, generando concentración de peatones en horarios de 07:00–09:00 y 17:00–21:00 horas."
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
Radio de análisis: ${ctx.analysisRadius} metros.
Datos de pandilla vinculada: ${ctx.linkedGangReport ? JSON.stringify(ctx.linkedGangReport) : 'Ninguno.'}

Instrucciones:
- Regla Crítica: Prohibido afirmar presencia territorial de grupos de riesgo por simple coincidencia nominal.
- Regla Geoespacial: Prohibido incluir actores cuya distancia al epicentro no esté calculada con coordenadas geográficas reales (Haversine). No asignar distancia únicamente por colonia.
- Solo incluir integrantes con domicilio geocodificado verificable dentro del radio de ${ctx.analysisRadius} metros.
- Audita y valida la vinculación respondiendo a:
  1. ¿La pandilla tiene zona de influencia activa dentro del área analizada?
  2. ¿Existe algún integrante plenamente identificado en el área?
  3. ¿Existe algún líder del grupo relacionado con la zona?
  4. ¿Existe evidencia OSINT que corrobore su presencia territorial activa?
- Clasifica obligatoriamente la presencia como: CONFIRMADO, PROBABLE o NO CORROBORADO.
- Si no hay elementos suficientes para confirmar la relación territorial, no especules y escribe textualmente: "Se realizó búsqueda sin elementos suficientes para confirmar presencia territorial."
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
- Analiza el flujo relacional del Grafo de Hipótesis (HIG 2.0).
- Estructura la explicación detallando cómo se conecta:
  1. Nodo Central: Hipótesis principal delictiva.
  2. Nodos Secundarios:
     - Evidencias: Fotografías, mapas, gráficas, OSINT, Street View.
     - Factores ambientales: Iluminación, accesibilidad, vigilancia natural, infraestructura.
     - Actores: Pandillas, establecimientos críticos, puntos de interés delictivo.
  3. Tipo y peso de las conexiones:
     - Tipo de conexión: fortalece, contradice o requiere validación.
     - Peso de la conexión: Alto, Medio o Bajo.
- Concluye el capítulo incluyendo la siguiente frase narrativa institucional obligatoria: "El grafo muestra cómo la evidencia disponible incrementa o disminuye la confianza de la hipótesis central."
- Todo pie de grafo debe llevar la marca de agua: "🔒 SSPE-CEIPOL".
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
- Genera recomendaciones y conclusiones operativas específicas derivadas del análisis territorial.
- Estructura las acciones de forma obligatoria en tres plazos:
  
  ## Acción inmediata (0 a 30 días)
  [Recomendaciones inmediatas tácticas en campo]
  
  ## Acción preventiva (30 a 90 días)
  [Recomendaciones de prevención y diseño ambiental]
  
  ## Acción estratégica (90 días o más)
  [Recomendaciones a mediano y largo plazo]

- Para cada recomendación o acción redactada, debes responder explícitamente:
  - ¿Qué hacer?
  - ¿Dónde?
  - ¿Por qué?
  - ¿Con qué evidencia?
- Sé directo, imperativo y sumamente formal.
--- FIN MÓDULO ---
`.trim();
};
