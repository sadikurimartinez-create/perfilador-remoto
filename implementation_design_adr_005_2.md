# DISEÑO ARQUITECTÓNICO: CAPÍTULO 5 (ADR-005.2)
**EVIDENCIA VISUAL OPERACIONAL Y CONTEXTO TERRITORIAL**
**SISTEMA PERFILADOR CEIPOL — ECOSISTEMA SAI**

---

## 1. INTRODUCCIÓN Y OBJETIVOS DEL DISEÑO
El presente documento define la reingeniería y el diseño arquitectónico del nuevo **Capítulo 5: Evidencia Visual Operacional y Contexto Territorial** del sistema Perfilador CEIPOL. Este módulo sustituye y evoluciona completamente la sección anterior de "Evidencia Fotográfica", unificando el análisis de campo in-situ y el barrido digital de Google Street View en una única matriz integrada de geointeligencia visual, alineándose con la regla de diseño institucional:

> [!IMPORTANT]
> **Regla de Diseño Editorial:**
> *"La construcción analítica debe ser profunda, pero la materialización documental debe ser ejecutiva, clara y breve."*

El dictamen no debe ser un catálogo fotográfico masivo ni redundante; cada imagen debe incorporarse únicamente si aporta inteligencia táctica accionable para la toma de decisiones.

---

## 2. AUDITORÍA DEL FLUJO ACTUAL (SINOPSIS)
A partir del diagnóstico profundo realizado en **ADR-005.1**, se identificaron tres fallas críticas de desacoplamiento:
*   **Pérdida de Contexto Visual en prompt:** Frontend remueve el base64 de las imágenes y backend borra la `dataUrl` en el `ReportContext` para evitar sobrecarga. Como consecuencia, el prompt enviado a Vertex AI solo recibe la cantidad de fotos (`photoCount`), provocando que la narrativa del capítulo sea **100% inventada/alucinada** por Vertex AI al no contar con comentarios de campo ni descripciones en el prompt.
*   **Análisis Hardcodeado:** En `intelligenceLayoutEngine.ts`, el campo `criminologicalInterpretation` está estáticamente duplicado con la misma frase ("El análisis visual táctico documenta fallas...") para todas las fotos del álbum.
*   **Aislamiento de Motores:** El Capítulo 5 opera de forma ciega sin comunicación con el motor de contexto territorial (**TCE**), matriz de evidencia estadística (**SEM**), motor de hipótesis (**HIE**), orquestador cartográfico (**CIE**), ni validaciones cruzadas de consistencia (**ACE**).

---

## 3. NUEVO MODELO DE DATOS Y CONTRATOS (SEMÁNTICA)
Para consolidar una arquitectura estructurada y tipada, se introduce el nuevo contrato unificado **VisualEvidenceMatrix** en la capa de datos del Report Kernel:

```typescript
export interface VisualEvidence {
  id: string;
  source: "ANALYST" | "STREET_VIEW";
  category: string; // e.g., "ALUMBRADO", "DETERIORO", "OBSTACULO", "GRAFFITI"
  dataUrl: string; // Base64 o URL segura de la imagen
  description: string; // Comentario factual crudo cargado en campo
  observation: string; // Elemento físico o anomalía detectada
  operationalInterpretation: string; // Vulnerabilidad física/táctica identificada
  relationToHypothesis: string; // Cómo influye o fortalece la hipótesis delictiva (HIE)
  riskLevel: "BAJO" | "MEDIO" | "ALTO" | "CRÍTICO";
  lat: number;
  lng: number;
  capturedAt: string;
}

export interface VisualEvidenceMatrix {
  projectId: string;
  overallVisualConfidence: number; // Porcentaje de consistencia evaluado por el ACE
  analystPhotos: VisualEvidence[]; // Sin límite físico de inserción
  streetViewEvidence: VisualEvidence[]; // Limitado a máximo 4 imágenes de acecho
  graffitiEvidence: VisualEvidence[]; // Activado por regla de densidad (>= 2)
  territorialFindings: {
    criticalVulnerabilityCount: number;
    primaryRiskFactor: string; // Vulnerabilidad prevaleciente
    impactAreaSqm: number;
  };
  operationalSummary: {
    executiveAbstract: string; // Texto inicial de geointeligencia visual redactado por el LLM
    tacticalDirectives: string[]; // Estrategias recomendadas
  };
}
```

---

## 4. COMPONENTES Y REGLAS DE NEGOCIO

### COMPONENTE 1: Fotografías de Campo del Analista (Evidencia Real)
*   **Regla de Capacidad:** Se deben incorporar **todas** las imágenes cargadas por el perfilador en el álbum del expediente, sin aplicar límites numéricos que puedan recortar la evidencia documental real obtenida en terreno.
*   **Formato de Pie de Foto Obligatorio (Clean Typography):** Cada fotografía renderizada en Word se estructurará mediante una tarjeta visual limpia con borde y sombra del color institucional (`0D2B52`).
*   **Restricción Editorial:** Queda estrictamente prohibido imprimir coordenadas geográficas crudas en los campos visuales, nombres técnicos de archivos o nomenclaturas algorítmicas de desarrollo.
*   **Estructura Visual:**
    ```
    ┌────────────────────────────────────────────────────────┐
    │                                                        │
    │                    [ IMAGEN DE CAMPO ]                 │
    │                                                        │
    ├────────────────────────────────────────────────────────┤
    │  Evidencia Visual 01                                   │
    │  Descripción: "Deterioro en barda perimetral..."       │
    │  Análisis: "Representa pérdida de control de accesos..."│
    │  Hipótesis: "Facilita ocultamiento de armas/drogas..." │
    └────────────────────────────────────────────────────────┘
    ```

### COMPONENTE 2: Barrido de Google Street View (Acecho Digital)
*   **Flujo de Barrido:** Cuando se analiza un polígono, el motor realiza una simulación o barrido virtual sobre los accesos prioritarios, lotes baldíos, predios abandonados, puntos de acecho y zonas de baja visibilidad natural en calles disponibles dentro del radio de análisis.
*   **Regla de Inserción Restrictiva:** Para evitar la saturación de páginas del informe ejecutivo, se establece un **límite estricto de máximo cuatro (4) capturas Street View**.
*   **Criterio de Selección de Relevancia Criminológica:** La selección de las 4 imágenes se automatiza en el pipeline priorizando:
    1.  Cercanía espacial inmediata a los hotspots de densidad de la **SEM**.
    2.  Variables coincidentes con los factores ambientales del **HIE** (ej. callejones sin salida en cuadrantes de asalto).
    3.  Presencia verificada de factores críticos de vulnerabilidad física identificados por el analista.
*   **Regla de Ausencia:** Si el barrido territorial de Street View no identifica anomalías críticas en el radio, **no se inserta ninguna imagen** y se despliega de forma limpia y exclusiva el texto:
    > *"El barrido territorial no identificó elementos visuales relevantes para incorporar como evidencia operacional."*

### COMPONENTE 3: Detección y Análisis de Grafitis Territoriales
*   **Regla de Densidad de Activación:** Los grafitis constituyen un indicador crítico de apropiación del territorio. Se define una regla analítica independiente:
    *   **Si se detectan dos (2) o más coincidencias de grafitis** en el barrido o álbum de fotos:
        *   Se activa de forma obligatoria la sección **5.4 Indicadores Visuales de Grafiti**.
        *   Se cargan **todas** las imágenes asociadas a la detección de grafitis.
        *   **Estas imágenes de grafitis NO restan del cupo de las 4 Street View generales.**
*   **Regla de Interpretación Criminológica:** Queda prohibido afirmar de forma dogmática o automatizada que la presencia de grafitis demuestra "presencia de delincuentes/bandas". Debe ser manejado estrictamente como un indicador de deterioro del entorno y apropiación visual:
    *   *Correcto:* *"La repetición de grafitis en distintos puntos del polígono constituye un indicador de apropiación visual del espacio y posible deterioro del control territorial."*
    *   *Incorrecto:* *"El grafiti demuestra presencia delincuencial en el cuadrante."*

---

## 5. ARQUITECTURA DE INTEGRACIÓN CON MOTORES CEIPOL
Para erradicar el aislamiento arquitectónico del Capítulo 5, el flujo de datos se conecta de forma directa con los motores core del Perfilador:

```
    ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
    │      TCE      │      │    SIE 2.0    │      │      HIE      │
    └───────┬───────┘      └───────┬───────┘      └───────┬───────┘
            │                      │                      │
            │ Contexto Urbano      │ Delitos Calientes    │ Patrones
            │                      ▼                      │
            └───────────────►[ CAPÍTULO 5 ]◄──────────────┘
                                   │
                                   ▼
                    [ ANALYTICAL CONSISTENCY GATE ] (ACE)
                                   │
                           ┌───────┴───────┐
                           ▼               ▼
                        [PASS]          [FAILED] (Bloquea Exportación)
```

*   **TCE (Territorial Context Engine):** Alimenta al generador visual inyectando el tipo de entorno urbano del polígono, conectando la foto del analista con la naturaleza de los atractores del cuadrante.
*   **SIE 2.0 / SEM:** Proporciona los hotspots densos tridimensionales de DBSCAN para que el motor visual asocie espacialmente cada fotografía de campo al hotspot más cercano, priorizando la inteligencia donde el delito es recurrente.
*   **HIE (Hypothesis Intelligence Engine):** Cruza el vector de validación criminológica con los factores de riesgo de las fotos (ej. si el HIE propone "Oportunismo nocturno", el prompt prioriza capturas de campo con fallas de iluminación).
*   **CIE (Cartographic Intelligence Engine):** Valida la correspondencia espacial exacta de las coordenadas (`lat, lng`) de cada evidencia visual, garantizando que se ubiquen dentro del polígono delimitado del proyecto.
*   **ACE (Analytical Consistency Engine):** La puerta de calidad final audita la consistencia visual y cuantitativa en el backend:
    *   Valida la presencia física y lectura exitosa de las imágenes asociadas.
    *   Garantiza que la narrativa generada por el LLM no contradiga los tipos de vulnerabilidad física etiquetados en el álbum de fotos (Coherencia Multimodal de Datos).

---

## 6. FLUJO DE DATOS SIN ALUCINACIONES (RECONSTRUIDO)
Para erradicar por completo la alucinación ciega de Vertex AI detectada en ADR-005.1, se reestructura el flujo de prompts de la siguiente forma:

1.  **Frontend:** Mantiene el envío ligero de metadatos (comentarios, ubicaciones, riesgos, fechas) de las fotos.
2.  **Backend (`route.ts`):** En lugar de borrar la información de las fotos, construye una estructura enriquecida de texto plano llamada `serializedPhotosMetadata` que incluye:
    *   Comentario literal del investigador de campo.
    *   Ubicación relativa y categoría de vulnerabilidad física asociada.
    *   Nivel de riesgo operativo del pie de foto.
3.  **Prompt (`reportEnginePrompts.ts`):** Recibe la metadata serializada real de las fotos y de las Street Views y se la provee explícitamente a Vertex AI:
    ```
    Fotografías reales agregadas por el analista en campo:
    - Foto 1: Categoría: ALUMBRADO. Comentario: "Luminaria fundida sobre callejón de escape."
    - Foto 2: Categoría: ACCESO. Comentario: "Barda de predio baldío derrumbada con huellas de paso."
    ```
4.  **Generación Factible:** Vertex AI ya no inventa el contexto; genera una síntesis de geointeligencia visual real sustentada sobre los hechos de campo y metadatos concretos provistos.

---

## 7. DISEÑO EDITORIAL Y MAQUETACIÓN DOCUMENTAL
La estructura visual final del **Capítulo 5** en el dictamen exportado a Word cumplirá con la siguiente maquetación jerárquica estricta:

*   **CAPÍTULO 5: Evidencia Visual Operacional y Contexto Territorial**
    *   **5.1 Síntesis Visual del Territorio (Máx. Media Página):** Breve prosa táctica introductoria generada por Vertex AI, resumiendo las principales fallas físicas observadas en el cuadrante, su vinculación con los hotspots de la SEM y el impacto en la delincuencia de oportunidad.
    *   **5.2 Evidencia Fotográfica de Campo (Analista):** Renderizado secuencial de todas las fotos de campo del álbum. Cada foto incrustada en una tarjeta visual con su correspondiente pie analítico, observación estructurada e interpretación operativa criminológica.
    *   **5.3 Evidencia Territorial Street View (Máx. 4 Capturas):** Capturas del barrido vial digital con hallazgos operacionales y relación táctica con el HIE.
    *   **5.4 Indicadores Visuales de Grafiti (Solo si se activa):** Despliegue de fotos de grafitis acompañados del bloque de interpretación de apropiación espacial.
    *   **5.5 Conclusión Operacional de Evidencia Visual (Máx. 5 Párrafos):** Cierre ejecutivo de geointeligencia visual, planteando directivas operativas concretas de patrullaje dinámico o remediación del entorno urbano.

---

## 8. PLAN DE IMPLEMENTACIÓN Y MITIGACIÓN DE RIESGOS

### Plan de Trabajo Sugerido:
1.  **Sprint 1:** Modificar la firma del `ReportContext` para dar cabida al contrato `VisualEvidenceMatrix` y estructurar los serializadores de metadatos de fotos en `route.ts`.
2.  **Sprint 2:** Reconstruir `EvidenceAnalysisPrompt` en `reportEnginePrompts.ts` para integrar los metadatos serializados reales y eliminar de raíz la alucinación.
3.  **Sprint 3:** Actualizar `intelligenceLayoutEngine.ts` para mapear los nuevos campos interpretativos y erradicar los strings estáticos hardcodeados. Integrar con el exportador Word de `exportToWord.ts`.
4.  **Sprint 4:** Incorporar la validación multimodal en el motor `AnalyticalConsistencyEngine` (ACE) para auditar la correlación visual.

### Riesgos Técnicos Identificados y Mitigación:
*   **Riesgo de Tamaño de Contexto (Tokens):** Si un expediente tiene más de 30 fotos, inyectar todos sus comentarios detallados al prompt puede encarecer o ralentizar la llamada de Vertex AI.
    *   *Mitigación:* Se implementará un truncamiento inteligente de descripciones largas (máximo 120 caracteres por descripción) y se agruparán fotos por categorías dominantes si la cantidad excede un umbral límite de 10 elementos.
*   **Fallas de Carga de Imagen en Word:** URLs de Street View caídas o rotas pueden provocar excepciones fatales durante la exportación del archivo `.docx`.
    *   *Mitigación:* Se implementará un validador de búfer asíncrono robusto que, ante cualquier falla de descarga de Street View, descarte la imagen individual de forma silenciosa e inyecte un mensaje estructurado de error en el layout en lugar de arrojar una excepción que aborte toda la generación del dictamen.
