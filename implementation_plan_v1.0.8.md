# PLAN DE IMPLEMENTACIÓN v1.0.8
## SISTEMA DE INTELIGENCIA CRIMINAL SSPE-CEIPOL — PERFILADOR REMOTO

---

## 🟢 ESTADO: PLAN PRESENTADO PARA REVISIÓN Y APROBACIÓN
**Fase:** v1.0.8 — Intelligence Report Structure Optimization Engine  
**Gobernanza:** Report Quality Governance Layer  

---

## 1. ARQUITECTURA DEL MOTOR (`intelligenceReportStructureEngine.ts`)

La capa de optimización de la estructura documental se implementará en el nuevo archivo modular **`src/utils/intelligenceReportStructureEngine.ts`**. Su propósito fundamental es analizar, cuantificar y reportar la distribución del contenido y la cobertura analítica del reporte sin alterar ni borrar texto de manera automática.

### A. Componentes Clave
El motor estará compuesto por 5 clases altamente especializadas y desacopladas:

1. **`ChapterBalanceAnalyzer`:** Mide las proporciones métricas cuantitativas (número de caracteres, volumen narrativo, recuento de evidencias y elementos visuales) por capítulo. No realiza valoraciones de redacción o estilo (responsabilidad de v1.0.7), limitándose a la cuantificación objetiva de pesos.
2. **`AnalyticalFlowValidator`:** Valida la coherencia de la secuencia analítica (Pregunta $\rightarrow$ Hipótesis $\rightarrow$ Evidencia $\rightarrow$ Análisis $\rightarrow$ Conclusión), evaluando si existen brechas lógicas críticas de flujo.
3. **`ReportRedundancyAnalyzer`:** Analiza la similitud léxica inter-capítulo para alertar sobre solapamientos, pero de forma pasiva, es decir, emitiendo reportes de advertencia (`REDUNDANCY_ALERT`) sin modificar la prosa de forma destructiva.
4. **`ChapterQualityScore`:** Calcula indicadores analíticos de salud estructural para cada capítulo (Trazabilidad, Apoyo Visual, Alineación) sirviendo como panel de auditoría, sin realizar aprobaciones automáticas definitivas de liberación.
5. **`IntelligenceReportStructureEngine`:** Orquestador principal que consolida todos los componentes y retorna el dictamen estructural final para inyectarlo en el `briefing` del documento.

---

## 2. INTERFACES TYPESCRIPT Y ENUMS

Definiremos los contratos de datos de la siguiente manera:

```typescript
export enum AnalyticalFlowStatus {
  COMPLETE,
  MISSING_EVIDENCE,
  MISSING_HYPOTHESIS,
  UNSUPPORTED_CONCLUSION,
  STRUCTURAL_GAP
}

export interface ChapterBalance {
  chapter: string;
  narrativeWeight: number; // Porcentaje de bloques narrativos (párrafos, listas)
  evidenceWeight: number;  // Porcentaje de referencias a evidencias físicas y de campo
  visualWeight: number;    // Porcentaje de bloques visuales (gráficas, tablas)
  balanceScore: number;    // Índice de equilibrio de 0 a 100
}

export interface EvidenceCoverageMatrix {
  chapterId: string;
  hypothesisCoverage: number; // Porcentaje de hipótesis sustentada
  evidenceCoverage: number;   // Porcentaje de evidencias descritas
  visualCoverage: number;     // Porcentaje de visuales asociados
  unsupportedClaims: number;  // Cantidad de aserciones severas sin evidencia
}

export interface RedundancyAlert {
  sourceChapter: string;
  targetChapter: string;
  similarity: number;         // Grado de solapamiento léxico (0 a 1.0)
  snippet: string;            // Fragmento conceptual duplicado
}

export interface FlowValidationResult {
  status: AnalyticalFlowStatus;
  isValid: boolean;
  unsupportedConclusions: string[];
  orphanedEvidence: string[];
  incompleteCapitols: string[];
  warnings: string[];
}

export interface StructuralQualityScore {
  coherence: number;          // 0 a 100 (alineación hipótesis-conclusión)
  traceability: number;       // 0 a 100 (tasa de enlace texto-evidencia)
  evidenceAlignment: number;  // 0 a 100 (densidad de evidencia frente a afirmaciones)
  visualSupport: number;      // 0 a 100 (proporción óptima de tablas y gráficos)
  overall: number;            // Promedio ponderado de salud estructural (indicador, no decisor)
}

export interface ChapterStructureReport {
  chapterKey: string;
  balance: ChapterBalance;
  coverage: EvidenceCoverageMatrix;
  scores: StructuralQualityScore;
}

export interface ReportStructureAuditResult {
  isValid: boolean;
  globalScore: number;
  chapters: Record<string, ChapterStructureReport>;
  flow: FlowValidationResult;
  redundancies: RedundancyAlert[];
}
```

---

## 3. PUNTO EXACTO DE INTEGRACIÓN EN `reportEngine.ts`

El motor de estructura se invocará en el estado `DERIVE_LAYOUT` de **`src/lib/reportEngine.ts`** tras la ejecución de la Síntesis Narrativa v1.0.7:

```typescript
// [reportEngine.ts] -> DERIVE_LAYOUT

// 1. Ejecutar Síntesis Narrativa v1.0.7
editorialPayload.contextoTerritorial = IntelligenceNarrativeSynthesisEngine.synthesizeChapter(
  editorialPayload.contextoTerritorial || "",
  "contextoTerritorial",
  synthContext
);
// ... [Mismos mappers de los demás capítulos] ...

// 2. Invocación de la Capa de Estructura v1.0.8 [NUEVO]
const structureAudit = IntelligenceReportStructureEngine.auditReportStructure(
  editorialPayload,
  this.context.album || []
);

// Adjuntar el reporte de auditoría estructural al editorialPayload para el exportador
editorialPayload.structureAudit = structureAudit;
```

De esta forma, `exportToWord.ts` podrá renderizar el diagnóstico estructural dentro de un apartado formal del dictamen o guardarlo en la bitácora de gobernanza del expediente sin interrumpir la compilación del DOCX.

---

## 4. ESTRATEGIA DE PRUEBAS (`scratch/test_intelligenceReportStructure.ts`)

La suite de verificación se desarrollará en `scratch/test_intelligenceReportStructure.ts` cubriendo los 9 escenarios requeridos:

1. **Caso 1 — Capítulo Equilibrado:** Proporciones óptimas de narrativa, evidencias fotográficas asociadas y apoyos visuales. (`balanceScore` $> 80$).
2. **Caso 2 — Capítulo sin Evidencia:** Capítulo con más de 300 palabras explicativas pero 0 referencias físicas o numéricas. Se espera alerta de capítulo silencioso.
3. **Caso 3 — Conclusión sin Soporte:** Conclusiones operativas severas inyectadas sin correspondencia empírica. (`AnalyticalFlowStatus.UNSUPPORTED_CONCLUSION`).
4. **Caso 4 — Duplicidad entre Capítulos:** Párrafos redundantes repetidos en distintas secciones del reporte. Se espera emisión de `REDUNDANCY_ALERT` con similitud $> 75\%$.
5. **Caso 5 — Evidencia Mal Ubicada:** Imágenes que no coinciden contextualmente con el capítulo en el que se listan.
6. **Caso 6 — Flujo Analítico Incompleto:** Ruptura de la cadena lógica (hipótesis sin conclusiones operativas de mitigación).
7. **Caso 7 — Capítulo Huérfano:** Párrafo de análisis territorial con más de 10 bloques narrativos pero con 0 evidencias físicas o de campo asociadas en el expediente. Se espera `AnalyticalFlowStatus.STRUCTURAL_GAP`.
8. **Caso 8 — Evidencia sin Interpretación:** 5 imágenes renderizadas dentro del álbum físico pero con 0 narrativa explicativa o interpretación criminológica en el cuerpo de texto. Se espera `orphanedEvidence` listando sus identificadores.
9. **Caso 9 — Conclusión Alejada:** Una recomendación o conclusión operativa descrita en el Capítulo 10 cuya evidencia de base empírica se sitúa lejanamente en el Capítulo 2, sin mención intermedia. Se espera la emisión de una alerta `TRACEABILITY_WARNING`.

---

## 5. CRITERIOS DE CERTIFICACIÓN DE LA FASE

Para dar por cerrada y congelada la fase v1.0.8, se requiere el cumplimiento estricto de las siguientes condiciones:

* **No Regresión Estática:** Ejecución exitosa de `npx tsc --noEmit` con 0 advertencias o errores en todo el espacio de trabajo.
* **Cobertura de Pruebas:** Ejecución exitosa del script de pruebas `scratch/test_intelligenceReportStructure.ts` pasando el 100% de las aserciones de los 9 escenarios.
* **Compilación en Producción:** Ejecución del script `scratch/audit_geronimo_e2e.ts` sobre el dataset real de 2,844 incidencias de Aguascalientes logrando la firma digital de certificación `CERTIFIED` y el DOCX v3 final sin anomalías técnicas.
