# PLAN DE IMPLEMENTACIÓN — MOTOR DE SÍNTESIS NARRATIVA DE INTELIGENCIA (v1.0.7)
**Intelligence Narrative Synthesis Engine — Perfilador Remoto CEIPOL**

---

## 1. DESCRIPCIÓN DEL PROYECTO
El objetivo de la fase **v1.0.7** es diseñar e integrar el **`IntelligenceNarrativeSynthesisEngine`** (Motor de Síntesis Narrativa de Inteligencia) para el Perfilador Remoto SSPE-CEIPOL. Este nuevo motor asume la gobernanza de la traducción entre datos duros e interpretaciones en texto libre. Al imponer restricciones algorítmicas, se erradican las sobreinferencias, el lenguaje policial dubitativo y las duplicaciones estructurales, garantizando que ninguna afirmación carezca de respaldo fidedigno en el expediente (*Regla de Oro*).

De acuerdo con el dictamen de auditoría arquitectónica v1.0.7 aprobado:
1. **Mapeo Narrativa-Evidencia Riguroso:** Toda frase o párrafo analítico de geointeligencia se vinculará con sus identificadores de evidencia de soporte (`evidenceIds`) e hipótesis (`hypothesisId`) mediante la estructura de mapeo `NarrativeEvidenceLink`.
2. **Validación Semántica de Conclusiones (`NarrativeValidator`):** Se auditará léxica y semánticamente cada capítulo. Las conclusiones de alta gama (ej. "concentración delictiva activa") requerirán la presencia de su `sourceEvidence` o `analyticalBasis` correspondientes (ej. incidentes registrados en el polígono), rechazando o reescribiendo de forma asertiva frases especulativas.
3. **Filtro de Lenguaje Policial Institucional (`InstitutionalLanguageGuard`):** Barrido determinista para eliminar o normalizar expresiones debilitadoras o probabilísticas ("probablemente", "podría ser", "quizás", "posiblemente") cuando no estén contenidas dentro de una hipótesis formalmente catalogada.
4. **Deduplicación Semántica en Caliente (`NarrativeDeduplicationEngine`):** Limpieza activa de redundancias analíticas duplicadas o parafraseadas con alta similitud conceptual en diferentes capítulos para asegurar un dictamen fluido, compacto y premium.
5. **Alineación con el HIE Hypothesis Ledger:** Enlace directo de la narrativa con el historial de evolución de la hipótesis (`hypothesisLifecycle`), calibrando el tono de certidumbre según el estado lógico actual del expediente (ej. `EN_ANALISIS` vs `CONFIRMADA`).
6. **Mantenimiento de Formato de 4 Partes:** Todas las síntesis de texto resultantes mantendrán la estructura formal obligatoria requerida por `exportToWord.ts` (HALLAZGO, EVIDENCIA, ANÁLISIS, IMPLICACIÓN).

---

## 2. PREGUNTAS ABIERTAS
> [!NOTE]
> ### Estatus de Requerimientos
> Ninguna. Todas las directrices sobre reglas léxicas, enmascaramiento de términos dubitativos, mapeo unívoco e inyección de consistencia con el ledger de hipótesis han sido validadas y resueltas de común acuerdo con la Dirección General de Tecnología en el Dictamen de Auditoría Previa.

---

## 3. PROPUESTA DE CAMBIOS DE CÓDIGO

### Componente: Intelligence Narrative Synthesis Engine

#### [NEW] [intelligenceNarrativeSynthesisEngine.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/intelligenceNarrativeSynthesisEngine.ts)
Crear el archivo del motor de síntesis de narrativa que contendrá las siguientes clases desacopladas y de alta cohesión:

1.  **Interfaces y Tipos:**
    ```typescript
    export type NarrativeBlockType = 
      | "OBSERVATION" 
      | "ANALYTICAL_FINDING" 
      | "HYPOTHESIS_STATUS" 
      | "OPERATIONAL_CONCLUSION" 
      | "LIMITATION";

    export interface NarrativeEvidenceLink {
      narrativeId: string;
      evidenceIds: string[];
      hypothesisId?: string;
      confidence: number; // 0 - 100
    }

    export interface NarrativeBlock {
      id: string;
      type: NarrativeBlockType;
      text: string;
      links: NarrativeEvidenceLink[];
    }
    ```

2.  **`InstitutionalLanguageGuard`:**
    *   Método `sanitizeTerms(text: string, isExploratoryHypothesis = false): string`.
    *   Busca expresiones dubitativas: `/(?:probablemente|quizá|quizás|podría ser|posiblemente|parece indicar)/gi`.
    *   Si `isExploratoryHypothesis` es `false`, normaliza las frases sustituyéndolas por giros institucionales de asertividad moderada:
        *   `"Probablemente existe presencia"` $\rightarrow$ `"Se identifican indicadores compatibles con la presencia"`
        *   `"podría ser un punto"` $\rightarrow$ `"se clasifica analíticamente como un punto"`
        *   `"quizás se deba a"` $\rightarrow$ `"se asocia técnicamente con"`
        *   `"posiblemente ocurra"` $\rightarrow$ `"presenta recurrencia temporal compatible con"`
        *   `"parece indicar"` $\rightarrow$ `"concluye analíticamente"`

3.  **`NarrativeDeduplicationEngine`:**
    *   Método `deduplicateParagraphs(paragraphs: string[]): string[]`.
    *   Calcula la similitud conceptual (mediante coincidencia de bigramas y palabras clave analíticas principales como `hotspot`, `concentración`, `alumbrado`, `maleza`, `baldío`).
    *   Si dos párrafos dentro de un mismo capítulo o entre capítulos consecutivos repiten la misma idea con una similitud delictiva superior al **75%**, consolida el texto reteniendo el de mayor rigor analítico y descartando el duplicado redundante.

4.  **`NarrativeEvidenceMapper`:**
    *   Método `mapNarrativeToEvidence(blocks: NarrativeBlock[], context: any): NarrativeBlock[]`.
    *   Inspecciona las afirmaciones analíticas en los bloques. Busca referencias explícitas a evidencias físicas del expediente (fotos de campo, Street View o incidentes delictivos).
    *   Construye objetos `NarrativeEvidenceLink` que asocian formalmente el bloque con los IDs de las evidencias que proveen soporte directo (ej. `["photo-0", "SV-001"]`).

5.  **`NarrativeValidator`:**
    *   Método `validateBlock(block: NarrativeBlock, context: any): { isValid: boolean; reason?: string; rewrittenText?: string }`.
    *   Implementa la *Regla de Oro*: Toda afirmación catalogada como `ANALYTICAL_FINDING` u `OPERATIONAL_CONCLUSION` debe contar con respaldo directo (`sourceEvidence` o `analyticalBasis` en el expediente, como un volumen de incidencias mayor a cero o fotografías de factores de oportunidad relacionados).
    *   Si una conclusión táctica o de alta peligrosidad carece de sustento en el expediente (ej. afirmar "punto crítico de alta peligrosidad" en un sector con 1 solo incidente y sin fotos de factores criminógenos de campo), marca el bloque como **REJECTED** and ejecuta una rutina de reescritura para atenuar o enmarcar la afirmación dentro de las limitaciones reales registradas (ej. reescribe a `"El sector presenta baja incidencia registrada históricamente; no obstante, se recomiendan acciones preventivas estándar..."`).

---

### Componente: Report Engine

#### [MODIFY] [reportEngine.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/lib/reportEngine.ts)
Modificar la transición `DERIVE_LAYOUT` para acoplar de forma limpia la tubería de síntesis narrativa:
*   Importar `IntelligenceNarrativeSynthesisEngine` desde `@/utils/intelligenceNarrativeSynthesisEngine`.
*   Después de construir el `editorialPayload` con `buildIntelligenceEditorialPayload`, procesar cada campo de capítulo de texto (`contextoTerritorial`, `finalHypothesis`, `osintSynthesized`, `pandillasAnalysis`, `conclusionesText`) a través del nuevo motor:
    *   Ejecutar `InstitutionalLanguageGuard` para limpiar el lenguaje dubitativo.
    *   Ejecutar `NarrativeDeduplicationEngine` para eliminar redundancias cruzadas.
    *   Ejecutar `NarrativeValidator` para asegurar la trazabilidad INDE de toda conclusión.
*   Guardar la narrativa normalizada, certificada y libre de brechas analíticas en `this.context.editorialPayload`.

---

### Componente: Intelligence Layout Engine

#### [MODIFY] [intelligenceLayoutEngine.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/intelligenceLayoutEngine.ts)
Ajustar la firma de tipos para incorporar la estructura semántica de bloques si se requiere, asegurando compatibilidad retrospectiva total con los exportadores DOCX de Word y PDF.

---

### Componente: Analytical Consistency

#### [MODIFY] [analyticalConsistencyEngine.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/analyticalConsistencyEngine/analyticalConsistencyEngine.ts)
Reforzar las reglas duras de consistencia analítica de ACE:
*   Si la hipótesis de portada o del Capítulo 2 no converge con el ledger de HIE o contiene términos delictivos sobreinferidos desestimados por el `NarrativeValidator`, lanzar warnings proactivos.

---

## 4. PLAN DE VERIFICACIÓN

### Pruebas Automatizadas (Pruebas Unitarias Estrictas)
Crearemos el archivo **`scratch/test_intelligenceNarrativeSynthesis.ts`** abarcando los siguientes escenarios de aserciones de prueba:
- **Caso 1 (Narrativa Válida):** Un bloque de hallazgo analítico con fotos de campo y volumen estadístico asociado es validado y aprobado exitosamente por `NarrativeValidator` (manteniendo su nivel de confianza).
- **Caso 2 (Conclusión sin Respaldo):** Un bloque de conclusión severa sin evidencia en el contexto es rechazado por `NarrativeValidator` y reescrito a un formato compatible con los hechos reales del expediente.
- **Caso 3 (Sanitización de Lenguaje Policial):** Validación de que `InstitutionalLanguageGuard` enmascara frases dubitativas ("probablemente existe presencia", "podría ser", "quizás ocurra") por aserciones institucionales afirmativas de nivel técnico moderado.
- **Caso 4 (Consistencia de Hipótesis HIE):** Confirma que el motor calibra la certidumbre y el tono de la hipótesis de acuerdo con su estado real en el `hypothesisLifecycle` (ej. se atenúa la asertividad si está en `EN_ANALISIS` y se robustece si está `CONFIRMADA`).
- **Caso 5 (Manejo de Limitaciones):** Confirma la inyección de advertencias de limitación táctica (`LIMITATION`) si el expediente adolece de falta de fotos o volumen estadístico bajo.
- **Caso 6 (Deduplicación Semántica):** Valida que párrafos redundantes o altamente repetitivos (>75% similitud conceptual) sean identificados y depurados por `NarrativeDeduplicationEngine`.

### Pruebas de Compilación y Regresión
1.  **TypeScript Static Analysis:** Ejecutar `npx tsc --noEmit` para asegurar que las nuevas clases e interfaces de TypeScript strict y las llamadas en `reportEngine.ts` compilen sin un solo error de tipado.
2.  **E2E Production Compilation:** Correr el script `scratch/audit_geronimo_e2e.ts` sobre el dataset real de **GERONIMO_LINEAL** (Aguascalientes) para comprobar físicamente la generación impecable del archivo DOCX con marcas de agua, sin fugas de coordenadas y con la narrativa de inteligencia de alto nivel debidamente sintetizada en los Capítulos 1, 2, 7, 8 y 10.
