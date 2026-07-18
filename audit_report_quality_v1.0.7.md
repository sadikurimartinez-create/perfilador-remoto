# AUDITORÍA DE ARQUITECTURA DE SÍNTESIS NARRATIVA DE INTELIGENCIA

# REPORT QUALITY GOVERNANCE v1.0.7

## Módulo: `IntelligenceNarrativeSynthesisEngine` (Interpretación Criminológica de Dictámenes)

---

## OBJETIVO DE AUDITORÍA

Determinar si la infraestructura de procesamiento narrativo, validación semántica e integración del Perfilador Remoto SSPE-CEIPOL está lista para incorporar el **Motor de Síntesis Narrativa de Inteligencia (v1.0.7)**. Esta nueva capa controlará la generación de interpretaciones de geointeligencia, garantizando:
* Que ninguna conclusión supere la evidencia disponible en el expediente (*Regla de Oro*).
* El mapeo explícito entre afirmaciones analíticas, identificadores de evidencia (`evidenceIds`) e hipótesis (`hypothesisId`).
* La eliminación sistemática de lenguaje débil o ambiguo mediante filtros institucionales.
* La clasificación de textos en bloques semánticos normalizados (`OBSERVATION`, `ANALYTICAL_FINDING`, `HYPOTHESIS_STATUS`, `OPERATIONAL_CONCLUSION`, `LIMITATION`).
* La integración directa y trazable con el **HIE Hypothesis Ledger** (trayectoria de hipótesis).
* La deduplicación en caliente de afirmaciones delictivas o explicaciones repetidas.

---

## 1. ANÁLISIS DEL FLUJO NARRATIVO ACTUAL (ESTADO PREVIO)

En el sistema actual, la construcción de la narrativa se orquesta a través de **[intelligenceLayoutEngine.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/intelligenceLayoutEngine.ts)** en la función `buildIntelligenceEditorialPayload`. 

El flujo de ensamblaje es lineal y opera bajo las siguientes premisas:
1. **Extracción por Secciones:** Separa el contenido crudo provisto por los modelos analíticos mediante `extractSection(rawContent, sectionNumber)`.
2. **Estructura de Cuatro Partes (`4-Part Structure`):** Aplica la función `formatToFourPartStructure` para forzar que los capítulos principales (Contexto, Hipótesis, OSINT, Pandillas y Conclusiones) sigan la plantilla:
   - **`[HALLAZGO]`**: Qué se detectó en el sector.
   - **`[EVIDENCIA]`**: Datos duros y registros que lo respaldan.
   - **`[ANÁLISIS]`**: Interpretación criminológica o causal.
   - **`[IMPLICACIÓN]`**: Impacto operativo en el cuadrante.
3. **Inyección Cuantitativa Directa:** Se precalientan y concatenan de forma programática las métricas estadísticas del **Statistical Intelligence Engine (SIE)** y la matriz **SEM** (probabilidad de Poisson, volumen de incidentes delictivos, baricentro geométrico, dispersión en metros) dentro del texto de Conclusiones.

### Brechas detectadas en la auditoría (Riesgos Activos):
* **Falta de Trazabilidad Unívoca:** Aunque la estructura de cuatro partes menciona la evidencia, no existe un enlace de datos a nivel de código (`evidenceIds` vinculados a un párrafo o frase analítica).
* **Posibilidad de Generaciones Libres:** Si un modelo de lenguaje analítico introduce descripciones especulativas o no certificadas en `rawContent`, estas fluyen directamente a la exportación DOCX sin que una capa dura los enmarque en el registro inmutable de hechos del **IntelligenceIntegrationContext**.
* **Lenguaje Policial Débil:** Se permite la filtración de términos dubitativos ("probablemente", "podría ser", "quizá", "quizás", "posiblemente") fuera de las hipótesis exploratorias formales, restándole carácter institucional e institucionalidad al dictamen táctico.
* **Repetición Narrativa:** No se analizan solapamientos de conceptos o textos idénticos entre diferentes capítulos.

---

## 2. AUDITORÍA DE LOS COMPONENTES Y PUNTOS DE INTEGRACIÓN

### 2.1 Módulo `intelligenceIntegrationContract`
La carpeta **[intelligenceIntegrationContract](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/intelligenceIntegrationContract)** expone el objeto unificado `IntelligenceIntegrationContext` el cual almacena de forma inmutable:
* `StatisticalEvidenceMatrix` (SEM) con volumen de incidentes, Poisson y tendencias temporales.
* `VisualEvidenceMatrix` (VEE) con fotos de campo clasificadas y análisis Street View virtuales.
* `TerritorialEvidenceMatrix` (TIE) con atractores económicos, maleza, luminarias y grafiti.
* `AnalyticalConsistencyReport` (ACE) con el estado de correlación.

Este contrato representa la **fuente de verdad certificada** definitiva. El nuevo motor `IntelligenceNarrativeSynthesisEngine` debe consumir este contexto para validar y anclar la narrativa. Ninguna frase puede referenciar un factor criminógeno (ej. "falla de iluminación" o "presencia de pandillas") si este no se encuentra explícitamente habilitado con disponibilidad táctica en el contrato.

### 2.2 Módulo `IntelligenceNarrativeValidator` y `EvidenceInferenceMatrix`
Encontramos que **[intelligenceNarrativeValidator.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/intelligenceNarrativeValidator.ts)** ya realiza análisis léxico y calcula el *Indicator de Profundidad Analítica* (IDS) delegando las restricciones duras en **[evidenceInferenceMatrix.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/evidenceInferenceMatrix.ts)**:
* Valida reglas de exclusión como prohibir la vinculación de `graffiti` con "control absoluto de un cártel" o `lote baldío` con "casa de seguridad activa".
* **Limitación actual:** La validación es meramente **blanda y orientativa**; la propiedad `finalStatus` está forzada a returnar siempre `"APPROVED"` (Línea 87).
* **Evolución v1.0.7:** El nuevo motor implementará un validador complementario duro y autocorrectivo (`NarrativeValidator`) que evalúe y limpie afirmaciones antes de la exportación, devolviendo alertas o reescribiendo bloques para asegurar el cumplimiento del estándar INDE.

### 2.3 Módulo de Procesamiento `reportEngine.ts`
En **[reportEngine.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/lib/reportEngine.ts)** (Líneas 611-637), durante la transición `DERIVE_LAYOUT`, se invoca la generación del payload de maquetación:
```typescript
const editorialPayload = await buildIntelligenceEditorialPayload(
  this.context.content || "",
  this.context.album || [],
  ...
);
```
**Punto de Inyección:** El lugar exacto para acoplar el `IntelligenceNarrativeSynthesisEngine` es inmediatamente después de que se ha construido el `editorialPayload` o en el núcleo de `buildIntelligenceEditorialPayload`, actuando sobre las propiedades textuales clave antes de estructurarlas en el briefing y enviarlas a los generadores físicos.

### 2.4 HIE Hypothesis Ledger (Trayectoria de Hipótesis)
El **Hypothesis Intelligence Engine (HIE)** almacena en `hypothesisLifecycle` (un objeto de tipo `InvestigationHypothesis` retornado en la línea 1135 de `intelligenceLayoutEngine.ts`):
* `hipotesisInicial`
* `hipotesisActual`
* `evidenciaConfirmatoria`
* `estadoActual`
* `historialEvolucion`

El nuevo motor consumirá esta información para enlazar de forma transparente la trayectoria de la hipótesis con la narrativa del Capítulo 2 (Hipótesis Criminológica Ambiental) y Capítulo 0, asegurando concordancia exacta entre el estado lógico de la hipótesis y el tono de la narrativa resultante (ej. si la hipótesis está en estado `EN_ANALISIS` o `CONFIRMADA`, la narrativa debe reflejar ese nivel de certidumbre).

### 2.5 Exportación de Documentos (`exportToWord.ts`)
Hemos verificado los puntos exactos donde se insertan los diferentes bloques de narrativa en **[exportToWord.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/lib/exportToWord.ts)**:
* **Capítulo 0 (Trayectoria de la Hipótesis):** Inserta la tabla cronológica de evolución y la narrativa de justificación (Línea 1297).
* **Capítulo 1 (Contexto del Análisis):** Inserta la narrativa en formato de 4 partes de `payload.contextoTerritorial` (Línea 1350).
* **Capítulo 2 (Hipótesis Ambiental):** Inserta el texto formal estructurado de `payload.finalHypothesis` (Línea 1355).
* **Capítulo 7 (Inteligencia OSINT):** Inserta la síntesis OSINT en formato 4 partes de `payload.osintSynthesized` (Línea 1635).
* **Capítulo 8 (Actores y Pandillas):** Inserta la narrativa de `payload.pandillasAnalysis` (Línea 1748).
* **Capítulo 10 (Conclusiones Operativas):** Inserta `payload.conclusionesText` y las colecciones de viñetas clasificadas tácticas, estratégicas y hallazgos críticos (Línea 1931).

---

## 3. PROPUESTA ARQUITECTÓNICA: `intelligenceNarrativeSynthesisEngine.ts`

El nuevo motor se ubicará de forma limpia en `src/utils/intelligenceNarrativeSynthesisEngine.ts` estructurado en clases desacopladas de alta cohesión:

```text
       Raw Narrative Content (Capítulos 1, 2, 7, 8, 10)
                               │
                               ▼
                ┌──────────────────────────────┐
                │     InstitutionalLanguage    │
                │             Guard            │
                └──────────────┬───────────────┘
                               ▼ (Léxico Sanitizado)
                ┌──────────────────────────────┐
                │          Narrative           │
                │     DeduplicationEngine      │
                └──────────────┬───────────────┘
                               ▼ (Sin Redundancias)
                ┌──────────────────────────────┐
                │      NarrativeEvidence       │
                │            Mapper            │
                └──────────────┬───────────────┘
                               ▼ (Enlaces unívocos y trazabilidad)
                ┌──────────────────────────────┐
                │          Narrative           │
                │          Validator           │
                └──────────────┬───────────────┘
                               ▼ (Clasificación de Bloques Semánticos)
              Certificado & Estructurado en Bloques:
        - OBSERVATION, ANALYTICAL_FINDING, HYPOTHESIS_STATUS,
          OPERATIONAL_CONCLUSION, LIMITATION
```

---

## DICTAMEN DE AUDITORÍA

# 🟢 AUDITORÍA v1.0.7 APROBADA

Se autoriza el desarrollo del **Implementation Plan v1.0.7** con las siguientes directrices obligatorias:
1. No se modificará la estructura de base de datos de Firestore ni se alterarán los motores analíticos `HIE` y `StatisticalIntelligenceEngineV2` ya congelados.
2. Toda transformación textual realizada por el motor debe respetar el formato de salida requerido por `exportToWord.ts` (manteniendo la estructura de cuatro partes `HALLAZGO/EVIDENCIA/ANÁLISIS/IMPLICACIÓN` allí donde aplique).
3. Se creará una suite de pruebas unitarias exhaustiva con al menos 12 escenarios de aserciones para garantizar la estabilidad absoluta del sistema antes de compilar el entregable v3 real.
