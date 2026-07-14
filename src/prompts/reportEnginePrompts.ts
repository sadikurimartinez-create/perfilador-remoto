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
  hieData?: any;
  cieData?: any;
  semData?: any;
  aceReport?: any;
  hieValidationVector?: any;
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
  const hieJson = ctx.hieData ? JSON.stringify(ctx.hieData, null, 2) : "Sin datos procesados por el motor de hipótesis HIE.";
  return `
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
  const cie = ctx.cieData || {};
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
      finding: `Presencia de ${mobility.corridors?.length || 0} corredores tácticos de movilidad delictiva radiales detectados.`,
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
- Añade el sello de agua: "🔒 SSPE-CEIPOL" al final del capítulo.
--- FIN MÓDULO ---
`.trim();
};

/**
 * 5. CAPÍTULO 4: ANÁLISIS ESTADÍSTICO
 */
export const GraphAnalysisPrompt = (ctx: ReportContext): string => {
  const eventsCount = ctx.semData?.totalCanonicalIncidents ?? ctx.incidenciaLocal?.length ?? 0;
  
  if (eventsCount < 5) {
    return "Evidencia estadística insuficiente para establecer una inferencia táctica válida en el polígono seleccionado.";
  }

  const semJson = ctx.semData ? JSON.stringify(ctx.semData, null, 2) : "Sin datos procesados en la SEM.";
  const aceJson = ctx.aceReport ? JSON.stringify({
    globalStatus: ctx.aceReport.globalStatus,
    overallConfidence: ctx.aceReport.overallConfidence,
    alertsCount: ctx.aceReport.alerts?.length ?? 0
  }, null, 2) : "Sin datos del Quality Gate ACE.";
  const hieJson = ctx.hieValidationVector ? JSON.stringify(ctx.hieValidationVector, null, 2) : "Sin vector de validación HIE.";

  return `
--- INICIO MÓDULO: ANÁLISIS ESTADÍSTICO (CAPÍTULO 4) ---
Genera el CAPÍTULO 4: "ANÁLISIS ESTADÍSTICO DEL FENÓMENO DELICTIVO" para el expediente "${ctx.projectName}" (ID: ${ctx.projectId}).
Radio de análisis: ${ctx.analysisRadius} metros.

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
