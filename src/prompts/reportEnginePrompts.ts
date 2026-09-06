import { CEIPOLReportContext } from "../utils/intelligenceIntegrationContract/models/reportContextTypes";
import { resolveVisibleNumeroExpediente } from "../utils/documentIdentity";

export type ReportContext = CEIPOLReportContext;

const GLOBAL_CONTEXT_RULE = `
REGLA ABSOLUTA DE CONTEXTO Y GOBERNANZA ANALÍTICA (ADR-010 - INDE):
Toda información analítica proviene exclusivamente del objeto IntelligenceIntegrationContext.
El modelo generativo NO deberá:
- calcular estadísticas;
- generar hotspots;
- inferir relaciones territoriales;
- completar información faltante;
- crear hipótesis no contenidas en el contexto;
- modificar valores certificados.

Su única función es transformar evidencia certificada en narrativa ejecutiva de alta profundidad.

FILOSOFÍA DE RAZONAMIENTO INDE:
"Menos narrativa superficial, mayor profundidad analítica."
- El prompt orienta; el motor valida. Toda afirmación debe tener fundamento en datos reales.
- El informe debe estructurarse para explicar causas, sustentos y alcances de inteligencia, evitando redundancias.

CONTRATO OBLIGATORIO DE SALIDA (ESTRUCTURA DE 5 BLOQUES):
Toda respuesta generada para cualquier capítulo DEBERÁ estructurarse utilizando de forma obligatoria los siguientes bloques de cabeceras textuales, sin omitir ninguno:

[HECHO OBSERVADO]
(Descripción factual, objetiva y 100% observable del terreno, p. ej. predio sin cerco, graffiti de 3 caracteres, luminaria apagada).

[EVIDENCIA UTILIZADA]
(Trazabilidad de la fuente exacta del expediente, p. ej. fotografía 04 del álbum, registro de incidencia delictiva del SEM, base DENUE/INEGI).

[INFERENCIA ANALÍTICA]
(Explicación causal y criminológica ambiental fundamentada del hecho observado, p. ej. la desatención física reduce el control social y propicia condiciones de oportunidad. EVITAR términos sobre-afirmados).

[NIVEL DE CONFIANZA]
(Declaración explícita y justificada del nivel de certeza analítica, de la siguiente forma exacta: "Nivel de confianza: ALTO/MEDIO/BAJO debido a la convergencia/escasez de fuentes...").

[IMPLICACIÓN OPERACIONAL]
(Acción policial recomendada con definición espacio-temporal precisa, p. ej. patrullaje preventivo de precisión en el sector norte entre las 18:00 y las 22:00 horas).

CONTROL DE INFERENCIA Y MATRIZ DE LENGUAJE SAI:
- Prohibición absoluta de adjudicar operaciones criminales, presencia de cárteles o delincuentes sin evidencia legal o de inteligencia humana certificada en el expediente.
- Catálogo de frases prohibidas (Bloqueo directo):
  * "control territorial de la organización" / "zona dominada por" / "presencia de grupo criminal"
  * "operación del cártel" / "la pandilla utiliza" / "los delincuentes operan"
  * "célula criminal" / "célula operativa" / "plaza criminal" / "halcones" / "punto de venta" / "casa de seguridad" / "narcomenudeo activo"
- Sustitución de expresiones requerida:
  * En lugar de "Los delincuentes utilizan predios baldíos", escribir "Los predios baldíos representan condiciones territoriales compatibles con ocultamiento temporal o pérdida de vigilancia natural".
  * Usar "indicio territorial compatible con...", "condición que requiere validación...", "posible dinámica asociada a...", o "hipótesis de investigación...".

- Confirmación: "Se acredita" (RESERVADO estrictamente para evidencia sólida verificada).

CONTRATO DE TRAYECTORIA DE HIPÓTESIS (ADR-011 - HLIE):
- Toda la narrativa y análisis criminológico de cada capítulo debe conectarse de forma explícita o implícita con el origen investigativo del expediente.
- Al evaluar evidencias, factores territoriales o hallazgos OSINT, el modelo responderá rigurosamente a la directiva: "¿Esta evidencia fortalece (CONFIRMACIÓN), debilita (REFUTACIÓN), amplía (AMPLIACIÓN) o reorienta (REORIENTACIÓN) la hipótesis inicial formulada?"
- Garantizar que la hipótesis inicial nunca se elimine y se mantenga la trazabilidad de su evolución y conclusiones resultantes.

REGLAS EDITORIALES Y DE GOBERNANZA ADICIONALES:
1. REGLA DE HIPÓTESIS INICIAL: La hipótesis inicial analizada debe extraerse de forma inalterada del texto del investigador (provisto en "executiveSummary.motivoAnalisis" o "centralHypothesis.summary") sin agregar jerga del sistema ni especulaciones.
2. REGLA DE EXCLUSIÓN DE IMÁGENES INEXISTENTES ("SIN IMAGEN = SIN BLOQUE"): Queda estrictamente prohibido analizar, interpretar, mencionar o referenciar cualquier imagen, fotografía, archivo o elemento multimedia que no esté explícitamente listado y presente en el expediente.
3. REGLA DE EVITAR BLOQUES VACÍOS: El modelo no generará tablas, secciones, cuadros, tarjetas o bloques vacíos de información. Si no hay datos suficientes, se omitirá la sección o se indicará de forma directa la ausencia de información.
4. REGLA DE LIMITACIÓN DE EXTENSIÓN Y EVITAR AUTORREFERENCIAS: Cada capítulo o sección redactada tendrá un límite estricto de entre 3 y 5 párrafos como máximo. Queda estrictamente prohibido que el modelo haga referencias a sí mismo (ej. "como modelo de lenguaje", "como IA", "este asistente") o use jerga técnica interna de la IA.
5. REGLA DE PROHIBICIÓN DE RECOMENDACIONES EN CAPÍTULOS PREVIOS: Todas las propuestas operativas, acciones policiales, recomendaciones de patrullaje o sugerencias de diseño ambiental deben confinarse STRICTAMENTE al Capítulo 10 ("CONCLUSIONES OPERATIVAS"). Queda estrictamente prohibido incluir cualquier recomendación o sugerencia operativa en los Capítulos 1 al 9.
6. REGLA DE EXCLUSIÓN DE MÉTRICAS DE CONTROL DE CALIDAD EN TEXTO NARRATIVO: Queda estrictamente prohibido inyectar puntuaciones numéricas (scores), porcentajes de confianza cuantitativos del sistema, sellos de auditoría o alertas de calidad técnica dentro del cuerpo de texto narrativo principal de los capítulos.
`.trim();

/**
 * 1. PORTADA + EXECUTIVE SUMMARY
 */
export const ExecutiveSummaryPrompt = (ctx: ReportContext): string => {
  const iic = ctx.intelligenceContext;
  const sem = iic.evidenceSources.SEM;
  const tie = iic.evidenceSources.TIE;

  const projectName = tie?.projectName || sem.metadata?.projectId || "Zona de Estudio";
  const numeroExpediente = resolveVisibleNumeroExpediente(iic.metadata as any);
  const analysisRadius = sem.metadata?.analysisRadiusMeters || 250;
  const geometryType = tie?.urbanStructure?.streetGridType || "polígono";

  return `
${GLOBAL_CONTEXT_RULE}

--- INICIO MÓDULO: RESUMEN EJECUTIVO (PORTADA) ---
Genera el Resumen Ejecutivo del "Informe de Geointeligencia Operativa" para el expediente "${projectName}" (Número de Expediente: ${numeroExpediente}).

El resumen ejecutivo debe ser sumamente analítico y formal, con un máximo de 250 palabras, y estructurarse bajo los siguientes cuatro apartados explícitos de forma exclusiva, sin incluir recomendaciones operativas o acciones a tomar:

1. ¿Qué ocurre?: Descripción objetiva y directa del fenómeno de desorden, delincuencia o vulnerabilidad territorial detectado en el polígono.
2. ¿Dónde ocurre?: Ubicación exacta y delimitación geoespacial del área (Radio: ${analysisRadius}m, Cobertura: ${geometryType}).
3. Hallazgo principal: Síntesis ejecutiva del hallazgo de geointeligencia y criminología ambiental más relevante sustentado en el expediente.
4. Riesgo principal: Clasificación cualitativa formal del riesgo identificado (Bajo, Medio, Alto) con su correspondiente justificación analítica.

Reglas:
- Queda ABSOLUTAMENTE PROHIBIDO incluir recomendaciones operativas, patrullajes o sugerencias de acciones en este resumen. Es una sección puramente descriptiva e interpretativa.
- Evita lenguaje técnico informal o marcas internas de sistemas.
- Sé sumamente ejecutivo y conciso.
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
- Deberás COPIAR TEXTUALMENTE la hipótesis formulada por el investigador contenida en el campo "centralHypothesis.summary". Si dicho texto supera la extensión equivalente a una página completa de Word (aproximadamente 500 palabras), realiza únicamente un resumen fiel de la misma que conserve intacto su significado criminológico, sin alterar la intención original del investigador.

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
- Especificar de manera puramente cualitativa el nivel de confianza del campo "confidence" (ej: "Confianza: ALTO", "Confianza: MEDIO" o "Confianza: BAJO") y su correspondiente descripción o justificación metodológica.
- Queda ESTRICTAMENTE PROHIBIDO incluir cualquier puntuación numérica, porcentaje o score cuantitativo (como "75/100", "Score: ...", u otros similares) en este apartado o en cualquier texto redactado.
- Detallar cualitativamente los factores de confianza: calidad de la evidencia (qualityScore), cantidad de la evidencia (quantityScore), convergencia (convergenceScore), y consistencia (consistencyScore) reportados en "confidenceFactors", traduciéndolos a descripciones narrativas formales en lugar de porcentajes o puntuaciones.

## Matriz de Evidencia Contradictoria y Faltante:
- Listar los elementos que debilitan la hipótesis reportados en "contradictoryEvidence" (si existen).
- Listar la información faltante reportada en "missingEvidence" que ayudaría a incrementar el nivel de confianza.

## Recomendaciones de Verificación:
- Detallar las acciones de verificación recomendadas a partir de "recommendedVerificationActions".

REGLAS EDITORIALES:
- Sé directo, depurado e institucional. Evita narrativas genéricas introductorias y explicaciones de relleno.
- Queda estrictamente prohibido redactar cualquier tipo de recomendación operativa o propuesta de patrullaje en esta sección.
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
      center: spatialPattern.center || { lat: null, lng: null },
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
Genera el CAPÍTULO 4 del "Dictamen Técnico de Inteligencia Territorial".
Nombre oficial de la sección: CAPÍTULO 4: ANÁLISIS ESTADÍSTICO DEL FENÓMENO

Tu objetivo es redactar un análisis del fenómeno delictivo sumamente ejecutivo, reduciendo un 60-70% el volumen de texto explicativo o metodológico de la versión anterior. 
No expliques algoritmos. No expliques la teoría de Poisson, ni la de DBSCAN, ni menciones la prueba de Chi-Square ni los cálculos de la desviación estándar. Enfócate exclusivamente en la interpretación del fenómeno, la dinámica operacional y la utilidad táctica para seguridad pública.

DATOS CERTIFICADOS DE ENTRADA:
1. Eventos analizados en polígono: ${eventsCount}
2. Delito predominante: ${sem?.criminalEvidence?.dominantCrime || "No definido"}
3. Concentración espacial en hotspots: ${(sem?.criminalEvidence?.concentrationScore ? (sem.criminalEvidence.concentrationScore * 100).toFixed(0) : "0")}%
4. Día crítico: ${sem?.temporalEvidence?.criticalPeriods?.[0] || "No definido"}
5. Horario crítico: ${sem?.temporalEvidence?.criticalPeriods?.[1] || "No definido"}
6. Nivel de riesgo inferido: ${ace?.overallConfidence && ace.overallConfidence >= 75 ? "Alto" : "Medio"}
7. Principales Delitos (SEM):
${JSON.stringify(sem?.criminalEvidence?.crimeTypes || [], null, 2)}
8. Concentración espacial (Hotspots):
- Número de hotspots: ${sem?.spatialEvidence?.hotspots?.length || 0}
- Radio operativo promedio: ${sem?.metadata?.analysisRadiusMeters || 250} metros
- Centro de gravedad espacial: Lat: ${sem?.spatialEvidence?.centerOfGravity?.lat?.toFixed(4) || "0.0"}, Lng: ${sem?.spatialEvidence?.centerOfGravity?.lng?.toFixed(4) || "0.0"}
9. Proyección y probabilidad de repetición:
- Riesgo de repetición semanal (Poisson): ${(sem?.predictiveEvidence?.poissonProbability * 100).toFixed(0) || "0"}%
- Riesgo de propagación (Near Repeat): ${(sem?.predictiveEvidence?.nearRepeatRisk * 100).toFixed(0) || "0"}%

ESTRUCTURA OBLIGATORIA DEL CAPÍTULO 4 (No omitas ningún título ni alteres el formato):

4.1 Resumen estadístico ejecutivo

Genera exactamente la siguiente tabla compacta de Markdown:

| Indicador | Resultado |
| :--- | :--- |
| Eventos analizados | ${eventsCount} |
| Periodo analizado | Histórico acumulado |
| Delito predominante | ${sem?.criminalEvidence?.dominantCrime || "No definido"} |
| Concentración espacial | ${(sem?.criminalEvidence?.concentrationScore ? (sem.criminalEvidence.concentrationScore * 100).toFixed(0) : "0")}% |
| Día crítico | ${sem?.temporalEvidence?.criticalPeriods?.[0] || "No definido"} |
| Horario crítico | ${sem?.temporalEvidence?.criticalPeriods?.[1] || "No definido"} |
| Nivel de riesgo | ${ace?.overallConfidence && ace.overallConfidence >= 75 ? "Alto" : "Medio"} |

Inmediatamente debajo, escribe únicamente un párrafo interpretativo de máximo 5 líneas. Ejemplo:
"El análisis estadístico identifica una concentración significativa del fenómeno dentro del área de estudio, con predominio de [Delito predominante], localizado principalmente en la zona de hotspots identificada. La distribución temporal evidencia una ventana crítica de ocurrencia durante [Día crítico] en el horario de [Horario crítico], por lo que el riesgo operativo se concentra en dicho espacio-tiempo."

4.2 Magnitud y composición criminal
Escribe exactamente en este formato (sin rodeos ni introducciones largas):
"El universo analizado comprende ${eventsCount} eventos.

La composición principal corresponde a:
1. ${sem?.criminalEvidence?.crimeTypes?.[0]?.type || "Delito Principal"}: ${sem?.criminalEvidence?.crimeTypes?.[0]?.count || 0} eventos (${((sem?.criminalEvidence?.crimeTypes?.[0]?.count || 0) / (eventsCount || 1) * 100).toFixed(0)}%)
2. ${sem?.criminalEvidence?.crimeTypes?.[1]?.type || "Delito Secundario"}: ${sem?.criminalEvidence?.crimeTypes?.[1]?.count || 0} eventos (${((sem?.criminalEvidence?.crimeTypes?.[1]?.count || 0) / (eventsCount || 1) * 100).toFixed(0)}%)
3. ${sem?.criminalEvidence?.crimeTypes?.[2]?.type || "Delito Terciario"}: ${sem?.criminalEvidence?.crimeTypes?.[2]?.count || 0} eventos (${((sem?.criminalEvidence?.crimeTypes?.[2]?.count || 0) / (eventsCount || 1) * 100).toFixed(0)}%)

Hallazgo:
El fenómeno presenta una concentración predominante en la categoría de ${sem?.criminalEvidence?.dominantCrime || "No definido"}."

4.3 Dinámica temporal
Escribe exactamente en este formato (máximo 5 líneas totales):
"Ventana crítica:
- Día: ${sem?.temporalEvidence?.criticalPeriods?.[0] || "No definido"}
- Horario: ${sem?.temporalEvidence?.criticalPeriods?.[1] || "No definido"}
- Periodo: Histórico recurrente
- Interpretación: La distribución temporal identifica una ventana recurrente de mayor exposición delictiva durante estos periodos. Este patrón permite orientar acciones preventivas y despliegue operativo hacia periodos específicos."

4.4 Concentración espacial
Escribe exactamente en este formato:
"Concentración espacial:
- Hotspots identificados: ${sem?.spatialEvidence?.hotspots?.length || 0}
- Concentración del fenómeno: ${(sem?.criminalEvidence?.concentrationScore ? (sem.criminalEvidence.concentrationScore * 100).toFixed(0) : "0")}%
- Radio operativo: ${sem?.metadata?.analysisRadiusMeters || 250} metros
- Centro de gravedad: Lat: ${sem?.spatialEvidence?.centerOfGravity?.lat?.toFixed(4) || "0.0"}, Lng: ${sem?.spatialEvidence?.centerOfGravity?.lng?.toFixed(4) || "0.0"}

Interpretación:
El fenómeno presenta una distribución focalizada en sectores territoriales clave, concentrándose principalmente en el baricentro de alta densidad espacial."

4.5 Evaluación predictiva
Escribe exactamente en este formato (máximo 6 líneas totales):
"Proyección:
- Riesgo de repetición: ${(sem?.predictiveEvidence?.poissonProbability * 100).toFixed(0) || "0"}%
- Riesgo de propagación espacial: ${(sem?.predictiveEvidence?.nearRepeatRisk * 100).toFixed(0) || "0"}%
- Nivel predictivo: ${ace?.overallConfidence && ace.overallConfidence >= 75 ? "Alto" : "Medio"}
- Limitación principal: Volumen de datos de la serie histórica.

Interpretación: El escenario predictivo denota una probabilidad de repetición focalizada en el entorno inmediato, sugiriendo un patrón de riesgo de contagio territorial de corto plazo."

4.6 Conclusión estadística operacional
Escribe exactamente en este formato:
"Hallazgo central:
La evidencia estadística confirma un patrón delictivo focalizado territorialmente, con concentración espacial definida y una ventana temporal específica de mayor riesgo.

Implicación operativa:
1. Patrullaje focalizado en el baricentro espacial durante la ventana crítica.
2. Intervención táctica disuasiva en los límites georreferenciados del hotspot.
3. Sincronización analítica continua de reportes de incidencia local."
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
- Prohibición Absoluta de Alucinación Visual: Analiza únicamente las evidencias visuales proporcionadas a continuación. No agregues elementos no observados en los metadatos ni infieras tipos de delitos específicos o conclusiones criminales subjetivas a partir de fotos.
- Queda ESTRICTAMENTE PROHIBIDO incluir cualquier tipo de metadatos internos, identificadores de archivos, nombres de archivo de imagen, UUIDs, rutas de archivo (e.g., photo_01.jpg, b59fcab...) o marcas de motores de base de datos.
- Redacte de forma directa, ejecutiva e institucional.
- Para cada fotografía analizada en los apartados 5.2, 5.3 y 5.4, debes estructurar el análisis utilizando obligatoria y exclusivamente el siguiente formato textual lineal, limitando el análisis a un máximo de 5 líneas de texto:

  IMAGEN: [Título de la imagen, ej: "Fachada de baldío con matorrales"]
  Análisis criminológico asociado: [Análisis profundo de la vulnerabilidad física/ambiental de la imagen y su relación con el riesgo, estrictamente máximo 5 líneas de texto]

Estructura del Capítulo:

## 5.1 Síntesis Visual Territorial
Redacte un párrafo de síntesis ejecutiva (máximo 150 palabras) describiendo de forma agregada el entorno territorial analizado, resumiendo los principales riesgos observados y su influencia en la vigilancia natural o el control social. Apóyate en este resumen base: "${matrix.executiveAbstract}"

## 5.2 Evidencia Fotográfica de Campo (Analista)
Redacte el análisis de las siguientes fotografías tomadas por el investigador en el terreno, respetando de manera estricta el formato obligatorio (IMAGEN + Análisis criminológico asociado con un límite de 5 líneas por imagen) y evitando cualquier mención a metadatos internos:
${analystPhotosStr}

## 5.3 Evidencia de Barrido Vial (Google Street View)
Redacte el análisis de las siguientes imágenes de Google Street View, respetando el formato obligatorio (IMAGEN + Análisis criminológico asociado con un límite de 5 líneas por imagen):
${streetViewStr}

## 5.4 Indicadores Visuales de Grafiti Territorial
Si está activo, analice el patrón repetitivo de grafitis en el sector como un indicador físico de apropiación de espacios, respetando de manera estricta el formato obligatorio (IMAGEN + Análisis criminológico asociado con un límite de 5 líneas por imagen):
${graffitiStr}

## 5.5 Conclusión de Contexto Visual
Redacte un párrafo conclusivo descriptivo de carácter de geointeligencia y situacional que resuma la interconectividad de los facilitadores detectados (máximo 150 palabras). Queda estrictamente prohibido redactar propuestas operativas, sugerencias de patrullaje o acciones directas en esta sección.

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
- Genera recomendaciones y conclusiones operativas específicas derivadas exclusivamente del análisis territorial del expediente.
- Estructura las acciones de forma obligatoria en tres plazos bien definidos:
  
  ## Acción inmediata (0 a 30 días)
  [Recomendaciones inmediatas tácticas en campo]
  
  ## Acción preventiva (30 a 90 días)
  [Recomendaciones de prevención y diseño ambiental situacional]
  
  ## Acción estratégica (90 días o más)
  [Recomendaciones estratégicas a mediano y largo plazo]

- Cada una de las recomendaciones, propuestas o acciones tácticas que redactes bajo cualquiera de los tres plazos DEBERÁ estructurarse de forma obligatoria respetando exactamente el siguiente formato lineal de cuatro prefijos textuales, sin omitir ninguno y sin usar viñetas u otros encabezados:

  ACCIÓN: [Descripción imperativa y concisa del patrullaje táctico, intervención o remoción que se recomienda realizar]
  OBJETIVO: [Meta o justificación criminológica de la acción en terreno]
  HALLAZGO RELACIONADO: [Ubicación, calles, tramos, colonias o áreas exactas de vulnerabilidad vinculadas en el expediente]
  EVIDENCIA: [Mapeo de la fuente de evidencia que lo sustenta, ej: Mapa 2 de Densidad, Foto 03 de baldío, reporte de incidencias SEM, etc.]

- Redacte de manera directa, imperativa y sumamente formal.
--- FIN MÓDULO ---
`.trim();
};
