# AUDITORÍA TÉCNICA Y ARQUITECTÓNICA ADR-005.1
**DIAGNÓSTICO PROFUNDO DEL CAPÍTULO 5: EVIDENCIA FOTOGRÁFICA**
**SISTEMA PERFILADOR CEIPOL — ECOSISTEMA SAI**

---

## 1. ESTADO ACTUAL DEL CAPÍTULO 5
El **Capítulo 5: Evidencia Fotográfica** tiene como misión dentro del dictamen documentar, analizar e interpretar de forma táctica y criminológica los factores físicos de riesgo (vulnerabilidad socio-espacial, fallas de iluminación, maleza, vandalismo, fallas de control de acceso) identificados en campo por el analista, y detallar cómo influyen o sustentan la hipótesis delictiva central del polígono.

Sin embargo, el diagnóstico técnico revela que este capítulo opera actualmente de forma aislada, ciega y con un alto nivel de desacoplamiento arquitectónico, lo que genera **alucinación narrativa total** y **hardcoding de interpretación criminológica**.

---

## 2. ARQUITECTURA DEL FLUJO DE DATOS

### A. Frontend (`src/components/PhotoAlbum.tsx`)
*   **Solicitud de generación:** El componente gestiona la generación en un bucle secuencial de 11 capítulos (`ch = 1..11`).
*   **Payload enviado:** Para la sección de fotos (`ch = 6`), el frontend empaqueta los datos generales del proyecto e inyecta la propiedad `photos`.
*   **Ajuste de peso:** Para evitar errores de timeout HTTP 504 en Vercel, el componente realiza un mapeo masivo que remueve la propiedad `imageBase64` de cada foto antes de enviarla:
    ```typescript
    photos: photosPayload.map(({ imageBase64, ...rest }) => rest)
    ```

### B. Backend (`src/app/api/generate-profile/route.ts`)
*   **Condición del Capítulo:** Identificado como `chapter === 6` (asociado a `EvidenceAnalysisPrompt`).
*   **Tratamiento del Contexto:** Al instanciar el `ReportContext` para Vertex AI, el backend limpia de forma explícita el campo `dataUrl` de las fotos y limita el array a un máximo de 5 elementos para reducir el tamaño del contexto de texto:
    ```typescript
    photos: safeBody.photos ? safeBody.photos.slice(0, 5).map((p: any) => ({ ...p, dataUrl: "" })) : []
    ```
*   **Inexistencia de Motores:** En `chapter === 6`, **no** se ejecuta el `StatisticalIntelligenceEngineV2` (SIE 2.0), no se construye la matriz **SEM**, no se instancia el motor territorial **TCE**, ni se genera el vector de validación del **HIE**.

### C. Prompt (`src/prompts/reportEnginePrompts.ts`)
*   **Prompt de análisis:** `EvidenceAnalysisPrompt(ctx)`.
*   **Variables recibidas:** Únicamente consume la cantidad de fotos (`photoCount = ctx.photos?.length || 0`).
*   **Riesgo Crítico de Alucinación:** El prompt **no incluye** nombres de archivos, comentarios, ubicaciones, descripciones ni metadatos de las fotos en el prompt de texto enviado a Vertex AI. Se le ordena a Gemini estructurar el análisis detallado de "cada una de las fotos" dándole únicamente el conteo total (e.g., 3).
*   > [!CAUTION]
    > **Alucinación Ciega:** Dado que Gemini no ve las imágenes (porque se les quitó el base64 en frontend y el `dataUrl` en backend) ni recibe los comentarios de campo, el texto narrativo inicial (`evidenceText` en Word) que genera es 100% ficticio e inventado.

### D. Maquetación (`src/utils/intelligenceLayoutEngine.ts`)
*   **Construcción del Layout:** Genera el array `photoEvidence` mapeando el álbum de fotos.
*   **Pie Fotográfico:** Llama al helper `getPhotoFooter` para parsear los comentarios del analista mediante regex sencillas buscando etiquetas de `Ubicación:`, `Factor:` y `Relación:`. Si no las encuentra, aplica fallbacks genéricos de texto plano.
*   **Hardcoding Criminológico:** La propiedad `criminologicalInterpretation` (Análisis) está 100% hardcodeada con un string estático idéntico para todas las fotos procesadas:
    ```typescript
    criminologicalInterpretation: "El análisis visual táctico documenta fallas críticas de iluminación e infraestructura que incrementan la vulnerabilidad perimetral."
    ```

### E. Exportación Word (`src/lib/exportToWord.ts`)
*   **Formato de renderizado:** Inserta primero el título del capítulo y el texto narrativo de Gemini (`payload.evidenceText` - el cual es alucinación ciega).
*   **Componentes Visuales:** Para cada foto, calcula proporciones mediante `PageBalanceEngine`, carga la imagen de forma asíncrona mediante `getImageDimensionsAndBuffer`, e incrusta una tabla de celda única con borde azul marino (`0D2B52`) que encapsula la foto y tres bloques de texto: *Observación*, *Análisis* y *Relación con hipótesis*.

---

## 3. INTEGRACIÓN CON MOTORES ACTUALES
Evaluación de la madurez de la conexión de este capítulo con las inteligencias unificadas del Ecosistema SAI:

| Motor | Propósito en el Capítulo 5 | Estatus | Diagnóstico |
| :--- | :--- | :--- | :--- |
| **TCE** | Aportar contexto geográfico, radio y variables urbanas adyacentes a las coordenadas de la foto. | 🔴 **Ausente** | Desconexión total de las fotos frente al cuadrante del polígono. |
| **HIE** | Alinear la relación metodológica de la foto con el patrón delictivo e hipótesis delictiva central. | 🔴 **Ausente** | La correlación criminológica visual es inventada o fija. |
| **SIE 2.0** | Cruzar la tipología de incidentes dominantes con el tipo de vulnerabilidad física identificada. | 🔴 **Ausente** | No sabe qué delitos predominan donde se tomó la foto. |
| **SEM** | Fundamentar la materialización del riesgo físico mapeando la cercanía a hotspots calientes. | 🔴 **Ausente** | Desconexión completa de la matriz estadística de evidencia. |
| **ACE** | Auditar la consistencia temporal, espacial y cuantitativa de las evidencias multimedia. | 🔴 **Ausente** | El capítulo no entra al Quality Gate ACE en el backend. |
| **CIE** | Verificar que la foto esté geográficamente ubicada dentro del polígono cartográfico. | 🔴 **Ausente** | No se valida correspondencia cartográfica in-situ. |

---

## 4. DETECCIÓN DE LEGACY
*   **SIE V1:** No hay dependencias directas en la generación del Capítulo 5.
*   **Variables obsoletas / Cálculos duplicados:** No hay duplicidad de cálculos matemáticos porque el capítulo no realiza análisis numérico, pero existe una redundancia crítica de datos entre el Capítulo 5 (Evidencia Fotográfica) y el Capítulo 6 (Street View), pues ambos representan análisis de vulnerabilidad física/visual del territorio.

---

## 5. AUDITORÍA EDITORIAL
*   **Extensión actual:** 1 a 2 páginas en el informe exportado en Word.
*   **Proporción:** 30% texto narrativo inicial (ficticio por Vertex AI), 70% tarjetas de metadatos de fotos (repetitivas y con análisis hardcodeado).
*   **Calidad Narrativa:** Extremadamente elocuente pero **nulo valor operacional real**. La desconexión entre el texto general (LLM) y las tarjetas individuales de fotos salta a la vista: el LLM inventa objetos que no están en las fotos y las tarjetas repiten interpretaciones prefabricadas.

---

## 6. AUDITORÍA GRÁFICA

| Componente Gráfico | Fuente de Origen | Variable Representada | Valor Operativo | Estado Actual |
| :--- | :--- | :--- | :--- | :--- |
| **Fotografía de Campo (Grande)** | Carga del analista en el álbum. | Imagen visual del entorno en campo. | **Alto** (Aporta la evidencia real e irrefutable). | 🟢 **Correcto** (Renderizado con PageBalanceEngine y tabla limpia). |
| **Gráfica de Tendencia / Mapa** | N/A | N/A | Ninguno (No contiene gráficos de soporte). | 🔴 **Ausente** |

---

## 7. RIESGOS IDENTIFICADOS

> [!CAUTION]
> **Riesgo 1: Alucinación Crítica de la Narrativa**
> Al no pasarse las descripciones, comentarios de campo ni etiquetas de las fotos a Vertex AI, el LLM asume contextos falsos, dañando la credibilidad técnica del dictamen ante mandos operativos o ministeriales.

> [!WARNING]
> **Riesgo 2: Interpretación Criminológica Estática**
> El layout engine clona textualmente la misma interpretación táctica para todas las imágenes de un expediente. Si un analista carga una foto de "Falta de alumbrado" y otra de "Inmueble abandonado", ambas dirán textualmente: *"El análisis visual táctico documenta fallas críticas de iluminación e infraestructura..."*.

> [!NOTE]
> **Riesgo 3: Desvinculación de la Evidencia Táctica**
> La desconexión total con la SEM, el HIE y el ACE deja este capítulo como un simple "álbum de fotos" estético, en lugar de actuar como un motor unificado de Geointeligencia Visual Operacional.

---

## 8. RECOMENDACIÓN TÉCNICA
Se propone un rediseño completo de la Evidencia Fotográfica en la siguiente versión del perfilador (**ADR-005.2**):
1.  **Integración Multimodal Real:** Modificar `EvidenceAnalysisPrompt` en `reportEnginePrompts.ts` para que extraiga de forma robusta los comentarios reales del analista, la ubicación, fecha y categoría del delito asociado de cada foto, enviando este set enriquecido de metadatos estructurados al LLM en el prompt para que la narrativa de Vertex AI sea 100% verídica, factual e hiper-contextualizada.
2.  **Inyección del Entorno (TCE + HIE + SEM):** Integrar datos agregados del polígono en el prompt para que Vertex AI enlace la vulnerabilidad observada con los delitos calientes del sector y la hipótesis criminológica ambiental.
3.  **Remoción de Textos Estáticos:** Erradicar la interpretación hardcodeada del `intelligenceLayoutEngine.ts`, permitiendo que el análisis provenga directamente de una evaluación inteligente basada en las descripciones de campo o en la visión analizada.

---

## 9. DICTAMEN FINAL

*   **Dictamen emitido:** **OPCIÓN C — RECONSTRUCCIÓN ADR-005**
*   **Justificación:** El Capítulo 5 opera bajo una arquitectura ciega que produce alucinación y textos estáticos repetitivos, desaprovechando por completo las capacidades del pipeline analítico del Ecosistema SAI. Requiere un rediseño completo de su flujo de datos, prompts e integraciones para consolidar una verdadera geointeligencia visual táctica.
