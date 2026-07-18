# AUDITORÍA DE CALIDAD Y GOBERNANZA DE REPORTES v1.0.8
## SISTEMA DE INTELIGENCIA CRIMINAL SSPE-CEIPOL — PERFILADOR REMOTO

---

## 🟢 ESTADO DE AUDITORÍA: APROBADA PARA DISEÑO DE PLAN
**Fase:** v1.0.8 — Intelligence Report Structure Optimization Engine  
**Gobernanza:** Report Quality Governance Layer  

---

## 1. ANÁLISIS DE LA TUBERÍA ACTUAL (`reportEngine.ts`)

### A. Formación y Orden de Capítulos
En la arquitectura certificada actual, la formación de los capítulos se realiza de manera determinista y secuencial durante el estado `DERIVE_LAYOUT`:
1. El `reportEngine.ts` llama a `buildIntelligenceEditorialPayload` para procesar el texto libre (`this.context.content`) y estructurarlo mediante regex y marcadores en un `editorialPayload`.
2. Posteriormente, `buildIntelligenceEditorialPayload` entrega estos datos estructurados junto con el contexto del proyecto y el expediente unificado en un objeto `briefing`.
3. Finalmente, `exportToWord.ts` consume este `briefing` y el `editorialPayload` para renderizar el documento físico en Word.

Los capítulos están organizados en una secuencia analítica estándar:
* **Capítulo 0 (Fase v1.0.2):** Trayectoria de hipótesis (ADR-011 / HIE Ledger).
* **Capítulo 1:** Contexto territorial e indicadores delictivos locales (TCE).
* **Capítulo 2:** Planteamiento y validación de hipótesis (HIE).
* **Capítulo 3:** Análisis cartográfico y de mapas (CIE).
* **Capítulo 4 (Fase v1.0.3):** Modelos estadísticos y tablas documentales.
* **Capítulo 5 (Fase v1.0.4/v1.0.6):** Evidencia fotográfica de campo.
* **Capítulo 6 (Fase v1.0.6):** Evidencia virtual (Street View).
* **Capítulo 7:** Síntesis de información OSINT.
* **Capítulo 8:** Análisis táctico de pandillas y actores locales.
* **Capítulo 9:** Grafo de vínculos y relaciones tácticas.
* **Capítulo 10:** Conclusiones operativas, hallazgos críticos y recomendaciones.

### B. Punto de Intervención Estructural
La capa estructural propuesta debe operar inmediatamente después de la síntesis narrativa (`v1.0.7`) y antes de que los textos sean transferidos al renderizador físico de Word (`exportToWord.ts`).
El punto de acoplamiento ideal se sitúa al final del bloque `DERIVE_LAYOUT` en `reportEngine.ts`:

```text
    [buildIntelligenceEditorialPayload]
                     ↓
       [Narrative Synthesis Layer (v1.0.7)]
                     ↓
  ★ [Structure Optimization Engine (v1.0.8)] ★
                     ↓
        [buildIntelligenceBriefing]
                     ↓
             [exportToWord.ts]
```

Esta intervención evaluará la estructura integral del reporte y, en lugar de bloquear el flujo, inyectará un reporte de salud estructural y calibrará los balances de contenido de forma automatizada.

---

## 2. REVISIÓN DE `EditorialStructureEngine`

### A. Tipos de Bloques Actuales
El motor de estructura editorial clasifica el texto plano en bloques tipados de la interfaz `EditorialBlock`:
* `TITLE` y `SUBTITLE`: Encabezados del dictamen.
* `PARAGRAPH`: Párrafos de análisis continuo.
* `BULLET` y `NUMBERED_LIST`: Listas ordenadas y viñetas de campo.
* `ANALYTICAL_BLOCK`: Bloques de la estructura de 4 partes (`HECHO_OBSERVADO`, `INFERENCIA_ANALITICA`, `EVIDENCIA`, `IMPACTO_OPERACIONAL`, `RECOMMENDATION`).
* `TABLE` (v1.0.3): Tablas de datos nativas del dictamen.
* `VISUAL_BLOCK` (v1.0.4): Tarjetas de KPI, Callouts, visualizaciones de riesgo y gráficas.

### B. Extensión para la Capa de Optimización Estructural
El `EditorialStructureEngine` actual garantiza la **fidelidad semántica absoluta** mediante el método `assertSemanticPreservation()`. Para dar soporte a la optimización estructural sin vulnerar la integridad de los datos, diseñaremos mecanismos para rastrear la proporción de estos bloques dentro de cada capítulo, cuantificando el "peso analítico" de cada sección sin alterar un solo carácter de la narrativa base.

---

## 3. ACOPLAMIENTO CON `IntelligenceNarrativeSynthesisEngine`

### A. Flujo de Datos Narrativos
El motor de síntesis narrativa v1.0.7 entrega párrafos sanitizados, deduplicados y enlazados unívocamente a evidencias (`NarrativeEvidenceLink`) y trazabilidad analítica (`NarrativeTrace`).

### B. Evaluación de Calidad Estructural de la Narrativa
La nueva capa de optimización interactuará con el resultado de la síntesis para medir las siguientes variables métricas:
1. **Densidad Narrativa:** Relación entre el número de palabras explicativas y el número de evidencias fotográficas o cartográficas.
2. **Trazabilidad Lógica:** Proporción de bloques narrativos de tipo conclusión que tienen un enlace explícito (`links`) a evidencias físicas registradas.
3. **Consistencia Temática:** Detección de brechas lógicas entre la hipótesis formulada en el Capítulo 2 y las conclusiones listadas en el Capítulo 10.

---

## 4. GOBERNANZA DE EVIDENCIAS Y COBERTURA ANALÍTICA

### A. Cobertura Evidencia-Capítulo
Actualmente, las evidencias fotográficas (`photoEvidence`) e imágenes virtuales (`streetViewAnalysis`) están concentradas en los capítulos 5 y 6. Sin embargo, su análisis o mención narrativa ocurre a lo largo de todo el documento.

### B. Anomalías Estructurales a Detectar
* **Capítulo Silencioso:** Secciones extensas con abundante prosa explicativa pero 0 referencias a evidencias o datos estadísticos sustentados (Desequilibrio Analítico).
* **Evidencia Huérfana:** Imágenes renderizadas en tarjetas premium dentro de los capítulos 5 o 6 que no tienen ninguna correspondencia o mención textual en las síntesis narrativas de los capítulos perimetrales.
* **Brecha de Causalidad:** Conclusiones operativas severas formuladas en el Capítulo 10 cuyas variables de impacto no figuran en las hipótesis de trabajo ni en los análisis de factores criminógenos de los capítulos precedentes.

---

## 5. DISEÑO DE CLASES DEL NUEVO MOTOR (`intelligenceReportStructureEngine.ts`)

Proponemos la creación del archivo `src/utils/intelligenceReportStructureEngine.ts` con la siguiente arquitectura de clases modulares:

* **`ChapterBalanceAnalyzer`:** Calcula la distribución de pesos por capítulo de acuerdo con la tipología de bloques editoriales y visuales:
  ```typescript
  export interface ChapterBalance {
    chapter: string;
    narrativeWeight: number; // Porcentaje de bloques narrativos
    evidenceWeight: number;  // Porcentaje de referencias a evidencias físicas
    visualWeight: number;    // Porcentaje de bloques visuales y tablas
    balanceScore: number;    // Índice de equilibrio de 0 a 100
  }
  ```
* **`AnalyticalFlowValidator`:** Garantiza el flujo lógico de la cadena de inteligencia, identificando brechas analíticas críticas:
  ```typescript
  export interface FlowValidationResult {
    isValid: boolean;
    unsupportedConclusions: string[]; // Conclusiones analíticas sin base de evidencia
    orphanedEvidence: string[];       // Evidencias físicas no explicadas en la narrativa
    incompleteCapitols: string[];     // Capítulos que no cumplen con su propósito analítico mínimo
  }
  ```
* **`ReportRedundancyAnalyzer`:** Detecta la redundancia temática, conceptual y léxica cruzada entre todos los capítulos del payload, identificando duplicaciones excesivas de hallazgos.
* **`ChapterQualityScore`:** Genera un dictamen global e individual de calidad estructural de 0 a 100 basado en: Coherencia (`coherence`), Trazabilidad (`traceability`), Alineación de Evidencias (`evidenceAlignment`), y Apoyo Visual (`visualSupport`).

---

## 6. REGLAS DE GOBERNANZA ESTRICTAS
Para mantener la integridad absoluta de la capa analítica de la SSPE-CEIPOL, se establecen las siguientes restricciones de congelamiento de código:

* **❌ COMPONENTES TOTALMENTE CONGELADOS (NO MODIFICAR):**
  * ADR-011 Ledger de Validación de Hipótesis.
  * Hypothesis Intelligence Engine (HIE).
  * Evidencias Certificadas en Base de Datos.
  * Fases v1.0.1 a v1.0.7.
* **🟢 ARCHIVOS AUTORIZADOS PARA MODIFICACIÓN:**
  * `src/utils/intelligenceReportStructureEngine.ts` (Nuevo archivo modular).
  * `src/lib/reportEngine.ts` (Únicamente el punto de llamada dentro del estado `DERIVE_LAYOUT`).
  * Carpeta `scratch/` para suites de pruebas unitarias y logs de auditoría.

---

## 7. PLAN DE VERIFICACIÓN Y PRUEBAS

Diseñaremos la suite de pruebas unitarias en **`scratch/test_intelligenceReportStructure.ts`** abarcando los siguientes 6 escenarios de gobernanza:
1. **Caso 1 — Capítulo Equilibrado:** Valida un capítulo con proporciones óptimas de narrativa, evidencias físicas y componentes visuales, logrando un `balanceScore` alto.
2. **Caso 2 — Capítulo sin Evidencia:** Identifica capítulos puramente narrativos ("silenciosos") con más de 300 palabras y 0 referencias físicas, emitiendo una alerta estructural.
3. **Caso 3 — Conclusión sin Soporte:** Detecta conclusiones operativas severas inyectadas en el Capítulo 10 que carecen de correspondencia con evidencias en el expediente o HIE.
4. **Caso 4 — Duplicidad entre Capítulos:** Verifica que el análisis de redundancia inter-capítulo identifique la repetición sistemática de hallazgos conceptuales.
5. **Caso 5 — Evidencia Mal Ubicada / Huérfana:** Identifica fotos de campo o capturas virtuales que figuran en el álbum físico pero que no poseen ninguna interpretación o mención explicativa en las narraciones.
6. **Caso 6 — Flujo Analítico Incompleto:** Evalúa expedientes con fallas en la cadena lógica (ej. se plantea una hipótesis pero el Capítulo 10 carece de conclusiones operativas o recomendaciones).

---

## 8. CONTEO REGRESIVO DE FASES RESTANTES

| Fase | Título Técnico | Propósito Analítico | Estado |
| :--- | :--- | :--- | :--- |
| **v1.0.1** | Sanitización Documental | Limpieza analítica de trazas técnicas y fallbacks robustos. | ✅ CERTIFICADO |
| **v1.0.2** | Trayectoria de Hipótesis | Estructura unificada de HIE y ADR-011 en Capítulo 0. | ✅ CERTIFICADO |
| **v1.0.3** | Tablas Nativas Word | Renderizado nativo de matrices estadísticas y numéricas. | ✅ CERTIFICADO |
| **v1.0.4** | Inteligencia Visual | Bloques YAML :::VISUAL_BLOCK para KPI, Callouts e Índices. | ✅ CERTIFICADO |
| **v1.0.5** | Composición Documental | Márgenes premium, control de flujo natural de páginas y watermark. | ✅ CERTIFICADO |
| **v1.0.6** | Integración de Evidencias | Enmascaramiento Geoshield y delegación a anexo digital. | ✅ CERTIFICADO |
| **v1.0.7** | Síntesis Narrativa | Normalización asertiva y deduplicación del lenguaje policial. | ✅ CERTIFICADO |
| **v1.0.8** | **Structure Optimization Engine** | **Equilibrio, secuencia lógica y cobertura analítica del reporte.** | 🟡 **PLANIFICACIÓN** |
| **v1.0.9** | Executive Summary Engine | Resumen ejecutivo automatizado (Situación, Riesgo, Recomendación). | 📅 PENDIENTE |
| **v1.1.0** | Quality Assurance Engine | Auditoría y control de contradicciones lógicas antes de firma. | 📅 PENDIENTE |
| **v1.1.1** | Report Certification Engine | Sello criptográfico digital, metadatos y firma digital. | 📅 PENDIENTE |
