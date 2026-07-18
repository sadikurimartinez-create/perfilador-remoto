# PLAN DE IMPLEMENTACIÓN TÉCNICA v1.0.9

# EXECUTIVE INTELLIGENCE SUMMARY ENGINE

---

# 1. OBJETIVO DEL MOTOR

El **`ExecutiveIntelligenceSummaryEngine`** es la capa de gobernanza v1.0.9 que destila de forma pasiva y estructurada un resumen ejecutivo institucional de alta dirección desde los capítulos ya certificados por las capas previas. 
Su principio de gobernanza es estricto: **el motor no genera nueva inteligencia ni aserciones subjetivas**. Su propósito es resumir, priorizar y mapear el flujo analítico `Hallazgo -> Evidencia -> Fundamento Criminológico` para facilitar la toma de decisiones ágil de los mandos superiores de la SSP.

---

# 2. PROPOSICIÓN DE CAMBIOS POR COMPONENTES

## A. Crear `src/utils/executiveIntelligenceSummaryEngine.ts` [NEW]

Se definen las siguientes interfaces y clases:

```typescript
export interface ExecutiveFinding {
  title: string;
  finding: string;
  sourceChapter: string;
  evidenceIds: string[];
  confidence: number; // 0 a 100
}

export interface ExecutiveRisk {
  risk: string;
  level: "HIGH" | "MEDIUM" | "LOW";
  basis: string;
  evidenceIds: string[];
}

export interface ExecutiveRecommendation {
  action: string;
  objective: string;
  supportingFindings: string[];
  evidenceIds: string[];
}

export interface ExecutiveSummaryReport {
  situation: string;
  findings: ExecutiveFinding[];
  risks: ExecutiveRisk[];
  hypothesisState: {
    statement: string;
    state: "CONFIRMADA" | "EN_EVALUACION" | "LIMITADA";
    confidenceScore: number;
  };
  recommendations: ExecutiveRecommendation[];
  isValid: boolean;
}
```

### Clases Especializadas:

1.  **`ExecutiveFindingExtractor`**:
    *   Extrae aserciones clave del Capítulo 10 (Conclusiones) y capítulos intermedios.
    *   Si se proveen más de 5 hallazgos, prioriza los que tienen mayor nivel de confianza o soporte de evidencia y trunca el resultado a un máximo de 5 prioritarios (**Caso 5**).

2.  **`CriticalRiskPrioritizer`**:
    *   Clasifica riesgos delictivos u operativos.
    *   Asigna niveles estrictos (`HIGH`, `MEDIUM`, `LOW`) cruzándolos con los valores calculados en el motor estadístico (Poisson) y las evidencias físicas asociadas.
    *   Si un riesgo no posee fundamento empírico ni evidencias, es descartado (**Caso 3**).

3.  **`OperationalRecommendationMapper`**:
    *   Mapea recomendaciones a partir del Capítulo 10.
    *   Cada recomendación debe tener una acción explícita, un objetivo táctico y apoyarse en hallazgos y evidencias específicas.
    *   Si no cuenta con soporte perimetral, es bloqueada del resumen (**Caso 6**).

4.  **`ExecutiveSummaryValidator`**:
    *   Filtra hallazgos que no posean enlace con evidencias reales del expediente (**Caso 2**).
    *   Asegura que las hipótesis mantengan su estado y nivel de veracidad del Hypothesis Ledger sin alteraciones (**Caso 4**).

---

## B. Integración en `src/lib/reportEngine.ts` [MODIFY]

Se modificará el bloque `DERIVE_LAYOUT` en `reportEngine.ts` para:
1.  Importar `ExecutiveIntelligenceSummaryEngine` desde `@/utils/executiveIntelligenceSummaryEngine`.
2.  Invocar el motor de resumen ejecutivo pasando el `editorialPayload` y el `album` fotográfico.
3.  Adjuntar el reporte final resultante como `editorialPayload.executiveSummaryReport` para la composición de Word y PDF.

```typescript
// Integración en DERIVE_LAYOUT
const executiveSummaryReport = ExecutiveIntelligenceSummaryEngine.generateSummary(
  editorialPayload,
  this.context.album || []
);
(editorialPayload as any).executiveSummaryReport = executiveSummaryReport;
```

---

# 3. PLAN DE VERIFICACIÓN Y PRUEBAS

## Pruebas Unitarias de Resumen Ejecutivo (`scratch/test_executiveIntelligenceSummary.ts` [NEW])

Desarrollar una suite de pruebas automatizadas que valide los 6 escenarios regulatorios:

*   **Caso 1 (Generación Exitosa)**: Proporciona un reporte completo ideal con datos de entrada válidos y verifica que el resumen ejecutivo estructurado se compile con éxito total, conservando su trazabilidad.
*   **Caso 2 (Hallazgo sin Evidencia)**: Intenta inyectar un hallazgo crítico que no cuenta con un identificador de evidencia física o mención empírica. El validador debe rechazarlo o filtrarlo del resumen.
*   **Caso 3 (Riesgo sin Fundamento)**: Introduce un riesgo alarmista sin correspondencia de base en los análisis o datos. El priorizador de riesgos debe omitirlo para mantener la objetividad institucional.
*   **Caso 4 (Hipótesis Limitada)**: Valida que ante un expediente con limitaciones estadísticas, la hipótesis se declare con el estado correcto `LIMITADA` y se mantenga inalterada.
*   **Caso 5 (Exceso de Hallazgos)**: Provee una lista ficticia con 8 hallazgos. El extractor debe seleccionar únicamente los 5 de mayor relevancia y truncar el resto de manera limpia.
*   **Caso 6 (Recomendación sin Soporte)**: Provee una recomendación sobre "reforzar puertas" que no está vinculada a ningún hallazgo de infraestructura ni evidencia física. La recomendación debe ser bloqueada del reporte ejecutivo.

---

# 4. RESTRICCIONES DE ARQUITECTURA (CONGELADAS)

❌ No modificar `src/utils/hypothesisIntelligenceEngine.ts` (ADR-011 / HIE Engine).  
❌ No modificar `src/utils/evidenceGovernanceEngine.ts` (Evidence Governance Core).  
❌ No modificar `src/utils/photoEvidenceGovernanceEngine.ts` (Photo Evidence Core).  
❌ No alterar la semántica de las fases certificadas v1.0.1 a v1.0.8.
