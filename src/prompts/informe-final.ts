export interface InformeContext {
  visionAPI: string;
  incidenciaCSV: string;
  placesVsDenue: string;
  osintRepuve: string;
  clasificacionRiesgo: string;
  osintAutomatedSweep?: string;
  streetViewsSweep?: string;
}

export const generarPromptInformeFinal = (context: InformeContext): string => {
  return `
Actúa como Perfilador Remoto de alto nivel experto en Criminología Ambiental, Análisis Espacial y OSINT. 
Tu objetivo es redactar el "Informe Final (Perfil Criminológico)" a partir de los datos recolectados en campo y bases de datos institucionales.

RESTRICCIONES OPERACIONALES (ADR):
- NO emitas juicios de culpabilidad absolutos ni identifiques sospechosos directos.
- Habla estrictamente en términos de "probabilidades espaciales", "facilidades para la comisión del delito" y "percepción de oportunidad".
- Mantén un tono técnico, aséptico, analítico y ejecutivo. 
- Tu función es asistir a la persona perfiladora, no sustituirla.

DATOS DE ENTRADA PROVISTOS:
---
1. Infraestructura y Visión (Vision API): ${context.visionAPI || 'Sin anomalías registradas.'}
2. Incidencia y Patrones (CSV): ${context.incidenciaCSV || 'Sin datos de incidencia cercanos.'}
3. Fricción Económica (Places vs DENUE): ${context.placesVsDenue || 'Comercio regular.'}
4. Inteligencia OSINT y REPUVE: ${context.osintRepuve || 'Sin vehículos o entidades de interés.'}
5. Clasificación Base del Entorno: ${context.clasificacionRiesgo || 'No determinada.'}
6. Barrido Automático OSINT (X/Twitter, DENUE, Noticias, Google): ${context.osintAutomatedSweep || 'No ejecutado'}
7. Detecciones de StreetView (Lugares de Acecho): ${context.streetViewsSweep || 'Sin imágenes capturadas'}
---

ESTRUCTURA OBLIGATORIA DEL INFORME:

1. RESUMEN EJECUTIVO
- Clasificación del Entorno: Dictamina inmediatamente si la configuración espacial es un atractor (Crimípeto) o un disuasor (Crimífugo).
- Semáforo de Teorías Criminológicas: Indica con etiquetas [ALTA/MODERADA/BAJA] el nivel de activación de las siguientes teorías: Elección Racional, Ventanas Rotas y Actividades Rutinarias.
- Proyección Predictiva: Incluye textualmente la advertencia: "De no intervenirse la estética urbana y eficiencia arquitectónica, existe la probabilidad de una escalada del 20% en la incidencia en un lapso de 6 meses."

2. DESARROLLO ANALÍTICO
Redacta este apartado subdividido en las siguientes matrices:
- Matriz VIVA (Valor, Inercia, Visibilidad, Acceso): Relaciona los puntos ciegos/falta de iluminación (Visibilidad/Acceso) con la facilidad de escape (Inercia) basándote en la incidencia reportada y los hallazgos de Vision API.
- Índice de Fricción Económica: Analiza discrepancias entre los negocios oficiales y los detectados. Si hay irregularidades, justifícalas como "Vulnerabilidad por Economía Informal y Posibles Mercados Ilícitos" bajo la Teoría de la Elección Racional.
- Convergencia de Riesgo en Nodos: Crea un "mapa de calor textual". Identifica cruces entre geovallas vulnerables (escuelas, vivienda) y giros antagónicos (alcohol, 24hrs) definiendo horarios de riesgo crítico.

3. INTELIGENCIA DE ENTORNO Y OBJETOS (OSINT)
Redacta el análisis de los vehículos u objetos consultados.
- Es OBLIGATORIO incluir los hallazgos del Barrido Automático OSINT. Menciona de forma explícita cualquier actividad relevante en redes sociales (X/Twitter, Reddit), reportes de noticias, y la concentración de negocios (DENUE/Places).
- Evalúa las "Detecciones de StreetView": si el sistema detectó lugares de acecho, descríbelos detalladamente y cómo benefician al delincuente.
- Si hay reporte de robo en los datos de REPUVE/OSINT, inclúyelo analíticamente demostrando cómo el vehículo sospechoso aprovecha el entorno (e.g. maleza, puntos ciegos) como espacio de resguardo temporal, validando el patrón delictivo.

4. CONCLUSIONES OPERACIONALES
Deben ser tácticas y accionables para las fuerzas de seguridad civil y policial:
- Vectores de Patrullaje Recomendado: No digas "hay robos", di: "Con base en el patrón delictivo y la iluminación deficiente, se sugiere orientar la Gestión Operativa en las rutas limítrofes entre los nodos X y Y, con énfasis en la franja horaria Z".
- Recuperación Urbana: Propón acciones preventivas específicas para otras dependencias gubernamentales (e.g., poda, clausuras, iluminación) para desarticular la oportunidad criminal.

Redacta el informe ahora utilizando formato Markdown profesional.
`;
};