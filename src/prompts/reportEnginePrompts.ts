import { CEIPOLReportContext } from "../utils/intelligenceIntegrationContract/models/reportContextTypes";

export type ReportContext = CEIPOLReportContext;

const GLOBAL_CONTEXT_RULE = `
REGLA ABSOLUTA DE CONTEXTO:
Toda información analítica proviene exclusivamente del objeto IntelligenceIntegrationContext.
El modelo generativo NO deberá:
- calcular estadísticas;
- generar hotspots;
- inferir relaciones territoriales;
- completar información faltante;
- crear hipótesis no contenidas en el contexto;
- modificar valores certificados.

Su única función es transformar evidencia certificada en narrativa ejecutiva.
`.trim();

/**
 * 1. PORTADA + EXECUTIVE SUMMARY
 */
export const ExecutiveSummaryPrompt = (ctx: ReportContext): string => {
  const iic = ctx.intelligenceContext;
  const sem = iic.evidenceSources.SEM;
  const tie = iic.evidenceSources.TIE;

  const projectName = tie?.projectName || sem.metadata?.projectId || "Zona de Estudio";
  const projectId = iic.metadata.projectId;
  const analysisRadius = sem.metadata?.analysisRadiusMeters || 250;
  const geometryType = tie?.urbanStructure?.streetGridType || "polígono";

  return `
${GLOBAL_CONTEXT_RULE}

--- INICIO MÓDULO: RESUMEN EJECUTIVO (PORTADA) ---
Genera el Resumen Ejecutivo del "Informe de Geointeligencia Operativa" para el expediente "${projectName}" (Número de Expediente: ${projectId}).

El resumen ejecutivo debe ser sumamente analítico y formal, con un máximo de 350 palabras, y estructurarse bajo los siguientes apartados explícitos:

1. ¿Qué ocurre?: Descripción del fenómeno territorial delictivo o de desorden analizado.
2. ¿Dónde ocurre?: Ubicación exacta y delimitación geoespacial del área (Radio: ${analysisRadius}m, Cobertura: ${geometryType}).
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
  const iic = ctx.intelligenceContext;
  const tie = iic.evidenceSources.TIE;
  const tceJson = tie ? JSON.stringify(tie, null, 2) : "Sin datos procesados por el motor de contexto territorial TCE.";

  return `
${GLOBAL_CONTEXT_RULE}

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
  const iic = ctx.intelligenceContext;
  const hie = iic.evidenceSources.HIE;
  const hieJson = hie ? JSON.stringify(hie, null, 2) : "Sin datos procesados por el motor de hipótesis HIE.";

  return `
${GLOBAL_CONTEXT_RULE}

--- INICIO MÓDULO: HIPÓTESIS CRIMINOLÓGICA AMBIENTAL (CAPÍTULO 2) ---
Genera el Capítulo 2: "HIPÓTESIS CRIMINOLÓGICA AMBIENTAL".

JSON de Datos del Hypothesis Intelligence Engine (HIE):
\`\`\`json
${hieJson}
\`\`\`

REGLAS DE GENERACIÓN DE TEXTO:
1. Queda estrictamente PROHIBIDO inventar la hipótesis, la evidencia que la soporta, el nivel de confianza, los facilitadores físicos o las dinámicas delictivas. Todo debe provenir de los datos del JSON del HIE.
2. Si el flag "validationMatrix.isValidated" es falso o "validationMatrix.hasSufficientEvidence" es falso, deberás escribir UNICAMENTE y sin añadir ningún otro texto lo siguiente:
"Evidencia insuficiente para construir una hipótesis criminológica ambiental con respaldo metodológico."
3. Si la evidencia es suficiente, deberás estructurar el capítulo obligatoriamente con los siguientes apartados y subtítulos exactos:

## Hipótesis:
- Redactar de forma fluida y coherente la síntesis de la hipótesis del campo "centralHypothesis.summary". Debe ser un párrafo formal de tono técnico-institucional.

## Matriz de Evidencia:
- Clasificar y listar ordenadamente los elementos de soporte con su peso técnico reportados en el JSON:
  - **Evidencia Territorial**: Listar ítems de "territorialEvidence".
  - **Evidencia Criminal**: Listar ítems de "criminalEvidence".
  - **Evidencia Ambiental**: Listar ítems de "environmentalEvidence".
  - **Evidencia Urbana**: Listar ítems de "urbanEvidence".
  - **Evidencia OSINT**: Listar ítems de "osintEvidence".

## Matriz de Trazabilidad:
- Listar los orígenes de datos, motores, variables y fechas reportados en "traceability".

## Nivel de confianza:
- Especificar el nivel de confianza cuantitativo y cualitativo según el campo "confidence" (ej: "Confianza: ALTO (Score: 75/100). Descripción: ...").
- Detallar los factores cuantitativos: calidad de la evidencia (qualityScore), cantidad de la evidencia (quantityScore), convergencia (convergenceScore), y consistencia (consistencyScore) reportados en "confidenceFactors".

## Matriz de Evidencia Contradictoria y Faltante:
- Listar los elementos que debilitan la hipótesis reportados en "contradictoryEvidence" (si existen).
- Listar la información faltante reportada en "missingEvidence" que ayudaría a incrementar el nivel de confianza.

## Recomendaciones de Verificación:
- Detallar las acciones de verificación recomendadas a partir de "recommendedVerificationActions".

REGLAS EDITORIALES:
- Sé directo, depurado e institucional. Evita narrativas genéricas introductorias y explicaciones de relleno.
--- FIN MÓDULO ---
`.trim();
};

/**
 * 4. CAPÍTULO 3: ANÁLISIS TERRITORIAL CARTOGRÁFICO
 */
export const MapsInterpretationPrompt = (ctx: ReportContext): string => {
  const iic = ctx.intelligenceContext;
  const cie = iic.evidenceSources.CIE || {};
  const spatialPattern = cie.spatialPattern || {};
  const density = cie.densityAnalysis || {};
  const mobility = cie.mobilityAnalysis || {};
  const attractors = cie.attractorAnalysis || {};
  const confidence = cie.confidence || {};

  // Construir el JSON simplificado oficial que Gemini recibirá estrictamente
  const geminiInput = {
    spatialPattern: {
      geometryType: spatialPattern.geometryType || "individual",
      center: spatialPattern.center || { lat: 21.8853, lng: -102.2916 },
      radiusMetros: spatialPattern.radiusMetros || 250,
      classification: spatialPattern.classification || "Distribución sectorizada"
    },
    densityMap: {
      finding: `Se identificaron ${density.hotspotsCount || 0} hotspots criminológicos principales con un total de ${density.totalEvents || 0} incidentes históricos.`,
      evidence: `Patrón clasificado como ${density.classification || "Baja densidad"} con una dispersión de ${density.dispersionMeters || 0} metros.`,
      confidence: `Nivel de confianza geoespacial: ${confidence.level || "MEDIO"} (Score: ${confidence.score || 50}/100)`
    },
    mobilityMap: {
      finding: `Presencia de ${mobility.corridors?.length || 0} corridors tácticos de movilidad delictiva radiales detectados.`,
      evidence: (mobility.corridors || []).map((c: any) => c.description).join(" "),
      confidence: `Nivel de accesibilidad territorial calculado en ${mobility.accessibilityScore || 100}%`
    },
    attractorsMap: {
      finding: `Concentración delictiva ligada a la presencia de ${attractors.totalAttractors || 0} atractores comerciales del DENUE.`,
      evidence: `Establecimientos críticos a corta distancia: ${(attractors.criticalEstablishments || []).map((e: any) => `${e.name} (${e.distanceMetros}m)`).join(", ")}.`,
      confidence: `Score de proximidad: ${attractors.proximityScore || 100}/100`
    },
    predictiveMap: {
      finding: `Proyección espacial del riesgo en el baricentro delictivo y celdas de inercia prioritarias.`,
      evidence: `Baricentro calculado en lat ${cie.priorityZones?.baricenter?.lat || 0}, lng ${cie.priorityZones?.baricenter?.lng || 0}.`,
      confidence: `Hotspots críticos prioritarios: ${(cie.priorityZones?.criticalHotspotsIds || []).join(", ")}.`
    }
  };

  return `
${GLOBAL_CONTEXT_RULE}

--- INICIO MÓDULO: ANÁLISIS TERRITORIAL CARTOGRÁFICO (CAPÍTULO 3) ---
Genera el Capítulo 3: "ANÁLISIS TERRITORIAL CARTOGRÁFICO".

Insumos Analíticos Reales (CIEResult):
${JSON.stringify(geminiInput, null, 2)}

Instrucciones de Redacción:
- Redacta el análisis del capítulo basándote ÚNICAMENTE en los insumos analíticos reales provistos arriba.
- Queda estrictamente prohibido inventar cualquier coordenada, dirección, número de incidentes, tipo de delito, o atractor comercial que no figure en los datos.
- Genera obligatoriamente la interpretación para cada uno de los siguientes 4 mapas tácticos del Atlas:
  1. MAPA 1: CONTEXTO TERRITORIAL
  2. MAPA 2: DISTRIBUCIÓN ESPACIAL DEL FENÓMENO (DENSIDAD CRIMINOLÓGICA)
  3. MAPA 3: FACTORES TERRITORIALES DE OPORTUNIDAD (ATRACTORES Y VULNERABILIDADES)
  4. MAPA 4: PROYECCIÓN ESPACIAL DEL RIESGO
- Para cada uno de los 4 mapas, debes estructurar la redacción de forma concisa bajo estos tres apartados exactos:
  - [Hallazgo espacial]
  - [Interpretación criminológica]
  - [Impacto operativo]
- No utilices etiquetas Markdown adicionales (*, _, \`) en los apartados.
- Enmarca todo elemento visual con la marca de agua: "🔒 SSPE-CEIPOL".
--- FIN MÓDULO ---
`.trim();
};

/**
 * 5. CAPÍTULO 4: ANÁLISIS ESTADÍSTICO
 */
export const GraphAnalysisPrompt = (ctx: ReportContext): string => {
  const iic = ctx.intelligenceContext;
  const sem = iic.evidenceSources.SEM;
  const ace = iic.evidenceSources.ACE;
  const hie = iic.evidenceSources.HIE;

  const eventsCount = sem?.criminalEvidence?.totalEvents ?? sem?.metadata?.totalCanonicalIncidents ?? 0;
  
  if (eventsCount < 5) {
    return "Evidencia estadística insuficiente para establecer una inferencia táctica válida en el polígono seleccionado.";
  }

  const semJson = sem ? JSON.stringify(sem, null, 2) : "Sin datos procesados en la SEM.";
  const aceJson = ace ? JSON.stringify({
    globalStatus: ace.globalStatus,
    overallConfidence: ace.overallConfidence,
    alertsCount: ace.alerts?.length ?? 0
  }, null, 2) : "Sin datos del Quality Gate ACE.";
  const hieJson = hie ? JSON.stringify(hie, null, 2) : "Sin vector de validación HIE.";

  return `
${GLOBAL_CONTEXT_RULE}

--- INICIO MÓDULO: ANÁLISIS ESTADÍSTICO (CAPÍTULO 4) ---
Genera el CAPÍTULO 4: "ANÁLISIS ESTADÍSTICO DEL FENÓMENO DELICTIVO" para el expediente "${iic.evidenceSources.TIE?.projectName || "Expediente"}" (ID: ${iic.metadata.projectId}).
Radio de análisis: ${sem.metadata?.analysisRadiusMeters || 250} metros.

DATOS CERTIFICADOS DE ENTRADA:

1. MATRIZ DE EVIDENCIA ESTADÍSTICA (SEM):
\`\`\`json
${semJson}
\`\`\`

2. REPORTE DE CONSISTENCIA ANALÍTICA (ACE QUALITY GATE):
\`\`\`json
${aceJson}
\`\`\`

3. VECTOR DE VALIDACIÓN DE HIPÓTESIS (HIE):
\`\`\`json
${hieJson}
\`\`\`

REGLAS EDITORIALES Y DE INTEGRIDAD DE DATOS (CEIPOL):
1. Queda estrictamente PROHIBIDO inventar estadísticas, estimar porcentajes alternativos o extrapolar información que no figure en los datos provistos.
2. Queda prohibido el uso de lenguaje académico, explicaciones metodológicas, fórmulas matemáticas o descripciones de algoritmos (como ecuaciones de Poisson o la teoría de DBSCAN). Todo método matemático debe permanecer invisible; solo se deben redactar los hallazgos operativos y su utilidad táctica.
3. El dictamen debe estructurarse obligatoriamente con los siguientes 5 apartados exactos:

CAPÍTULO 4: ANÁLISIS ESTADÍSTICO DEL FENÓMENO DELICTIVO

4.1 Magnitud y composición del fenómeno
- Responder: ¿Qué magnitud tiene la incidencia?
- Describir el volumen total de delitos georreferenciados válidos en el polígono.
- Listar los delitos predominantes de la SEM con sus tasas de concentración y detallar si la distribución está focalizada o diversificada.

4.2 Dinámica temporal del riesgo
- Responder: ¿Cuándo ocurre?
- Redactar la tendencia delictiva robusta no paramétrica de Theil-Sen (dirección y pendiente).
- Detallar la estacionalidad temporal del fenómeno, identificando la ventana crítica de oportunidad (días y rango horario prioritario) y picos de anomalías históricas.

4.3 Concentración espacial y focalización
- Responder: ¿Dónde ocurre?
- Describir de forma explícita el número de hotspots de alta densidad detectados por DBSCAN, sus ubicaciones prioritarias en el polígono y el porcentaje de delitos que concentran en relación con el CIE.

4.4 Escenario predictivo y riesgo operativo
- Responder: ¿Qué probabilidad existe de repetición?
- Explicar el escenario de riesgo probabilístico de corto plazo según el modelo de Poisson (indicando la probabilidad de ocurrencia semanal y el nivel de confianza de la prueba Chi-Square).
- Describir el peligro de propagación espacio-temporal mediante la tasa de contagio Near-Repeat, señalando las limitaciones inherentes a los datos históricos.

4.5 Conclusión estadística operacional
- Responder: ¿Qué significa operativamente toda esta evidencia para la toma de decisiones?
- Integrar la evidencia de la SEM, la hipótesis criminológica ambiental del HIE y la certificación del ACE.
- Formular una síntesis ejecutiva directa dirigida al tomador de decisiones que fundamente estrategias de patrullaje dinámico, focalización operativa o remediación urbana en los hotspots prioritarios.

Restricción de Extensión: La narrativa completa debe ser profunda, precisa y ejecutiva, y caber de forma compacta en un rango de 2 a 3 páginas físicas, evitando redundancias.
--- FIN MÓDULO ---
`.trim();
};

/**
 * 6. CAPÍTULO 5: EVIDENCIA FOTOGRÁFICA
 */
export const EvidenceAnalysisPrompt = (ctx: ReportContext): string => {
  const iic = ctx.intelligenceContext;
  const matrix = iic.evidenceSources.VEE;
  if (!matrix) {
    return `
${GLOBAL_CONTEXT_RULE}

--- INICIO MÓDULO: EVIDENCIA VISUAL OPERACIONAL Y CONTEXTO TERRITORIAL (CAPÍTULO 5) ---
No se cargó evidencia de campo ni se detectaron anomalías en el barrido territorial.
--- FIN MÓDULO ---
`.trim();
  }

  const analystPhotosStr = matrix.analystPhotos.length > 0
    ? matrix.analystPhotos.map((p: any) => `
- ${p.title}:
  * Descripción factual: ${p.description}
  * Hallazgo identificado: ${p.finding}
  * Impacto operacional táctico: ${p.operationalImpact}
`).join("\n")
    : "No se cargaron fotografías de campo por parte del investigador.";

  const streetViewStr = matrix.streetViewEvidence.length > 0
    ? matrix.streetViewEvidence.map((p: any) => `
- ${p.title}:
  * Descripción: ${p.description}
  * Hallazgo: ${p.finding}
  * Impacto táctico: ${p.operationalImpact}
`).join("\n")
    : "El barrido territorial no identificó elementos visuales relevantes para incorporar como evidencia operacional.";

  const graffitiStr = matrix.graffitiEvidence.length > 0
    ? matrix.graffitiEvidence.map((p: any) => `
- ${p.title}:
  * Descripción: ${p.description}
  * Hallazgo: ${p.finding}
  * Impacto operacional: ${p.operationalImpact}
`).join("\n")
    : "No se identificaron patrones densos ni repetitivos de grafiti territorial en el área de interés.";

  return `
${GLOBAL_CONTEXT_RULE}

--- INICIO MÓDULO: EVIDENCIA VISUAL OPERACIONAL Y CONTEXTO TERRITORIAL (CAPÍTULO 5) ---
Genera el Capítulo 5: "EVIDENCIA VISUAL OPERACIONAL Y CONTEXTO TERRITORIAL".

Instrucciones Generales de Redacción:
- Sigue la Regla Institucional de Diseño: "La construcción analítica debe ser profunda, determinista y auditable; la materialización documental debe ser ejecutiva, breve y orientada a la toma de decisiones."
- Prohibición Absoluta de Alucinación Visual: Analiza únicamente las evidencias visuales proporcionadas a continuación. No agregues elementos no observados en los metadatos ni infieras tipos de delitos específicos o conclusiones criminales subjetivas a partir de fotos (ej. no afirmes "venta de drogas" o "zona de asaltantes" en base a una foto deteriorada).
- No incluyas coordenadas geográficas (latitud, longitud), identificadores de fotos internos (ej., uuid, file paths) ni nombres de motores estadísticos o variables de sistema.
- Redacte de forma directa, ejecutiva e institucional.

Estructura del Capítulo:

## 5.1 Síntesis Visual Territorial
Redacte un párrafo de síntesis ejecutiva (máximo 150 palabras) describiendo de forma agregada el entorno territorial analizado, resumiendo los principales riesgos observados y su influencia en la vigilancia natural o el control social. Apóyate en este resumen base: "${matrix.executiveAbstract}"

## 5.2 Evidencia Fotográfica de Campo (Analista)
Redacte una narrativa integrada para las siguientes fotografías tomadas por el investigador en el terreno, explicando de forma ejecutiva cómo las condiciones físicas observadas inciden en las vulnerabilidades operativas:
${analystPhotosStr}

## 5.3 Evidencia de Barrido Vial (Google Street View)
Redacte un análisis táctico detallado y conciso sobre las siguientes imágenes de Street View seleccionadas por su alta relevancia criminógena y cercanía con hotspots:
${streetViewStr}

## 5.4 Indicadores Visuales de Grafiti Territorial
Si está activo, analice de forma espacial el patrón repetitivo de grafitis en el sector como un indicador físico de apropiación de espacios y posible deterioro de la vigilancia natural:
${graffitiStr}

## 5.5 Conclusión Operacional
Redacte una conclusión de carácter táctico-operativo orientada a directivas de patrullaje policial, patrullas dinámicas y remediación física ambiental de las anomalías observadas (alumbrado, cerramientos, matorrales, etc.) en un máximo de 3 párrafos.

--- FIN MÓDULO ---
`.trim();
};

/**
 * 7. CAPÍTULO 6: ANÁLISIS TERRITORIAL OPERACIONAL Y CONTEXTO DE OPORTUNIDAD
 */
export const StreetViewIntelligencePrompt = (ctx: ReportContext): string => {
  const iic = ctx.intelligenceContext;
  const tem = iic.evidenceSources.TIE || {};

  return `
${GLOBAL_CONTEXT_RULE}

--- INICIO MÓDULO: ANÁLISIS TERRITORIAL OPERACIONAL (CAPÍTULO 6) ---
Genera el Capítulo 6 del dictamen: "ANÁLISIS TERRITORIAL OPERACIONAL Y CONTEXTO DE OPORTUNIDAD".

Estructura de Evidencia Territorial (TEM):
${JSON.stringify(tem, null, 2)}

Reglas de Generación:
1. Divide la redacción rigurosamente en las siguientes cinco secciones oficiales, respetando sus encabezados en mayúsculas:
   6.1 CARACTERIZACIÓN TERRITORIAL: Describe el tipo de suelo (residencial, comercial, mixto, industrial), trama vial y conectividad.
   6.2 ESTRUCTURA URBANA Y ATRACTORES: Detalla los atractores económicos del DENUE analizados (escuelas, comercios, paradas, etc.) y su nivel de concentración temporal y movilidad.
   6.3 CONDICIONES AMBIENTALES DEL ENTORNO: Diagnostica factores físicos (alumbrado, lotes baldíos, visibilidad) que disminuyen la vigilancia natural.
   6.4 RELACIÓN TERRITORIO-FENÓMENO: Explica cómo interactúan las vulnerabilidades físicas detectadas con los hotspots de la SEM.
   6.5 CONCLUSIÓN OPERATIVA: Propone las recomendaciones prioritarias para patrullaje focalizado y remediación del espacio físico.

2. REGLA EDITORIAL OBLIGATORIA "Territorio no criminalizado":
   Queda TERMINANTEMENTE PROHIBIDO utilizar términos criminalizantes como "zona criminal", "territorio controlado", "punto de venta", "área dominada", "zona de operación delictiva". 
   En su lugar, utiliza obligatoriamente terminología de prevención situacional y diseño ambiental: "vulnerabilidad territorial", "oportunidad situacional", "concentración de actividad", "condiciones ambientales", "reducción de vigilancia natural".
   El comercio, escuelas o parques NO deben describirse como factores criminales directos, sino como polos de atracción y concentración temporal de flujos humanos que alteran la exposición situacional.

3. Máximo 2 páginas de texto, formato ejecutivo, conciso, formal e institucional. Todo elemento visual o tabla debe llevar la marca de agua: "🔒 SSPE-CEIPOL".
--- FIN MÓDULO ---
`.trim();
};

/**
 * 8. CAPÍTULO 7: INTELIGENCIA OSINT
 */
export const OSINTAnalysisPrompt = (ctx: ReportContext): string => {
  const iic = ctx.intelligenceContext;
  const sem = iic.evidenceSources.SEM;
  const analysisRadius = sem.metadata?.analysisRadiusMeters || 250;

  const sweepSummary = ctx.sweeps && ctx.sweeps.length > 0
    ? ctx.sweeps.slice(0, 10).map(s => `- [${s.engine || s.source}]: ${(s.data || "").slice(0, 200)}`).join("\n")
    : "Sin barridos OSINT integrados en el expediente.";

  const gangReportSummary = ctx.linkedGangReport
    ? `Riesgo: ${ctx.linkedGangReport.risk_classification || "LOW"}, matched_gangs: ${JSON.stringify(ctx.linkedGangReport.matched_gangs || [])}, confidence: ${ctx.linkedGangReport.confidence_score ?? 0}`
    : "Sin reporte de pandillas.";

  return `
${GLOBAL_CONTEXT_RULE}

--- INICIO MÓDULO: INTELIGENCIA OSINT (CAPÍTULO 7) ---
Genera el Capítulo 7: "INTELIGENCIA OSINT".
Radio de análisis: ${analysisRadius} metros.
Datos de entrada OSINT: "${ctx.osintEngineData ? JSON.stringify(ctx.osintEngineData) : 'Sin barrido directo disponible.'}"
Barridos integrados al expediente:
${sweepSummary}

Resultado del Barrido de Pandillas (Módulo GIS):
${gangReportSummary}

REGLA CRÍTICA DE COHERENCIA DE PANDILLAS (MÚLTIPLES BARRIDOS):
Si el Resultado del Barrido de Pandillas indica que no hay presencia de pandillas (matched_gangs vacío, o confidencescore / confidence de 0, o riesgo LOW), queda TERMINANTEMENTE PROHIBIDO que el análisis OSINT invente, mencione o infiera la presencia, control territorial o actividad de pandillas específicas (tales como "ZKL13", "LOS 90", "La Clica Palomino Dena", "Benito Palomino Sur Gang" o cualquier otra) en el área de análisis.
Si el barrido es negativo o de bajo riesgo, el dictamen OSINT debe ser consistente: debe limitarse a reportar la actividad de delincuencia común (robo a transeúnte, robo de vehículos, asalto peatonal) y flujos comerciales, pero SIN asociarla a pandillas u organizaciones delictivas locales. Prioriza siempre la coherencia del expediente.

REGLA CRÍTICA GENERAL: Prohibido redactar afirmaciones abstractas. Cada conclusión debe ser inteligencia operativa de campo verificable.

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
  const iic = ctx.intelligenceContext;
  const sem = iic.evidenceSources.SEM;
  const analysisRadius = sem.metadata?.analysisRadiusMeters || 250;

  return `
${GLOBAL_CONTEXT_RULE}

--- INICIO MÓDULO: ACTORES TERRITORIALES Y PANDILLAS (CAPÍTULO 8) ---
Genera el Capítulo 8: "ACTORES TERRITORIALES Y PANDILLAS".
Radio de análisis: ${analysisRadius} metros.
Datos de pandilla vinculada: ${ctx.linkedGangReport ? JSON.stringify(ctx.linkedGangReport) : 'Ninguno.'}

Instrucciones:
- Regla Crítica: Prohibido afirmar presencia territorial de grupos de riesgo por simple coincidencia nominal.
- Regla Geoespacial: Prohibido incluir actores cuya distancia al epicentro no esté calculada con coordenadas geográficas reales (Haversine). No asignar distancia únicamente por colonia.
- Solo incluir integrantes con domicilio geocodificado verificable dentro del radio de ${analysisRadius} metros.
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
${GLOBAL_CONTEXT_RULE}

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
${GLOBAL_CONTEXT_RULE}

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
