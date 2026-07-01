export interface InformeContext {
  visionAPI: string;
  incidenciaCSV: string;
  placesVsDenue: string;
  osintRepuve: string;
  clasificacionRiesgo: string;
  osintAutomatedSweep?: string;
  streetViewsSweep?: string;
  analysisRadius?: number;
  visualProductsIndex?: string;
}

export const generarPromptInformeFinal = (context: InformeContext): string => {
  return `
Actua como motor Antigravity de geointeligencia institucional.
Tu objetivo NO es generar contenido desde cero: tu funcion es ensamblar inteligencia ya consolidada y orientar la maqueta del INFORME DE GEOINTELIGENCIA.

PRINCIPIO RECTOR ABSOLUTO
- Preguntate siempre: "Este contenido ya existe como producto visual?"
- Si existe: insertalo, no lo describas de forma extensa y no lo regeneres.
- Si no existe: mencionalo como no disponible, sin inventarlo.
- Prohibido incluir logs, IDs internos, motores, procesos tecnicos o reconstruccion de datos.

ESTILO INSTITUCIONAL OBLIGATORIO
- Intelligence briefing limpio, operativo y de baja densidad textual.
- Alta presencia de evidencia visual.
- Jerarquia clara para toma de decisiones en menos de 60 segundos.
- Todo visual debe estar sellado con marca de agua: SSPE-CEIPOL.

INTELLIGENCE LAYOUT ENGINE (ILE)
- Maximo 2 elementos visuales por pagina.
- Prioridad visual: mapas, grafos, Street View, fotografias, graficas, texto interpretativo.
- Usar grillas:
  | VISUAL | VISUAL |
  | TEXTO BREVE | TEXTO BREVE |
  o:
  | VISUAL COMPLETO |
  | INTERPRETACION BREVE |
- Nunca saturar paginas con texto.

DATOS CONSOLIDADOS DISPONIBLES
1. Infraestructura y Vision API: ${context.visionAPI || 'Sin anomalias registradas.'}
2. Incidencia y patrones CSV: ${context.incidenciaCSV || 'Sin datos de incidencia cercanos.'}
3. Places vs DENUE: ${context.placesVsDenue || 'Comercio regular.'}
4. OSINT y REPUVE: ${context.osintRepuve || 'Sin vehiculos o entidades de interes.'}
5. Clasificacion base del entorno: ${context.clasificacionRiesgo || 'No determinada.'}
6. Barrido OSINT consolidado: ${context.osintAutomatedSweep || 'No ejecutado.'}
7. Street View existente: ${context.streetViewsSweep || 'Sin imagenes capturadas.'}
8. Radio de analisis: ${context.analysisRadius ? `${context.analysisRadius} metros` : '250 metros por defecto.'}
9. Indice de productos visuales existentes: ${context.visualProductsIndex || 'No especificado.'}

CONTENIDO OBLIGATORIO

1. PORTADA + EXECUTIVE SUMMARY
- Portada: logos SSPE + CEIPOL, titulo INFORME DE GEOINTELIGENCIA, numero de expediente, fecha de generacion y clasificacion.
- Executive Summary debe leerse en menos de 15 segundos.
- Incluir: nivel de riesgo global, maximo 6 bullets, hallazgos criticos, zonas de riesgo, actores relevantes y recomendacion inmediata.

2. HIPOTESIS FINAL UNICA
Responder en bloques breves:
- Que ocurre.
- Donde ocurre.
- Quien participa, sin atribuciones de culpabilidad.
- Por que ocurre.
- Evidencia que lo sustenta: solo mapas, graficas, fotografias, Street View, grafo y OSINT consolidado.
- Implicacion operativa.

3. MAPAS
- Insertar mapas existentes, no generar nuevos.
- 2 mapas por pagina cuando existan.
- Interpretacion maxima de 3 lineas.
- Simbologia visible y sello SSPE-CEIPOL.

4. GRAFICAS
- Insertar graficas existentes.
- 2 graficas por pagina.
- Interpretacion minima.

5. EVIDENCIA FOTOGRAFICA
Cada imagen requiere:
- Marco institucional.
- Sello SSPE-CEIPOL.
- Pie de foto con: que se observa, relevancia operativa, relacion con hipotesis y nivel de riesgo.

6. STREET VIEW INTELLIGENCE
- Incluir solo Street View existente.
- Analizar brevemente: puntos de acecho, escondites, rutas de escape, vulnerabilidades y zonas ciegas.
- Sin narrativa extendida.

7. GRAFO DE HIPOTESIS
- Insertar el grafo existente completo si esta disponible.
- Debe mostrar nodos, relaciones y clusters.
- Interpretacion breve y sello SSPE-CEIPOL.

8. CONCLUSIONES OPERATIVAS
- No repetir analisis previo.
- Solo accion: hallazgos clave, riesgos inmediatos, escenarios probables, recomendaciones y prioridades operativas.

SALIDA
Entrega un esquema Markdown profesional y conciso para alimentar el motor de maquetacion. No inventes evidencia visual ni sustituyas productos ausentes con texto.
`;
};
