# AUDITORÍA DE INTEGRACIÓN Y PROPUESTA TÉCNICA (ADR-004.4.1)
## INTEGRACIÓN DEL ANALYTICAL CONSISTENCY ENGINE (ACE)
### PERFILADOR REMOTO – MMAS | ECOSISTEMA SAI – CEIPOL

---

## 1. Resumen Ejecutivo

Esta auditoría técnica evalúa la viabilidad, el acoplamiento y el punto óptimo de integración del **Analytical Consistency Engine (ACE)** dentro del flujo productivo de generación y exportación del dictamen en el Perfilador Remoto. 

Tras analizar en profundidad los componentes del frontend de usuario (`PhotoAlbum.tsx`), las transiciones del estado del kernel de maquetación (`reportEngine.ts`), y los motores de generación de diseño (`intelligenceLayoutEngine.ts`), se concluye que:
1. **Factibilidad:** El diseño del ACE es 100% compatible con la arquitectura del Report Engine actual.
2. **Punto de Integración:** El paso automático de validación del kernel (`VALIDATE_KERNEL`) es el punto ideal para enganchar la auditoría cruzada de consistencia.
3. **No Interrupción Silenciosa:** Se ha diseñado un mecanismo robusto para que, en caso de fallo crítico (`FAILED`), el sistema no lance errores genéricos, sino que devuelva una bitácora detallada y legible (`blockingReason`) con las diferencias y las variables exactas afectadas para que el analista pueda corregirlas en la interfaz de usuario.
4. **Impacto Mínimo:** Se establece una sección compacta de **media página** de impacto editorial para los casos `WARNING`, preservando la concisión y la naturaleza ejecutiva del dictamen policial.

---

## 2. Arquitectura de Integración Actual vs Recomendada

### Flujo de Integración Actual

Actualmente, el flujo de maquetación sigue un pipeline secuencial de máquina de estados dentro de `ReportEngineKernel` en `reportEngine.ts`. Sin embargo, la validación se limita a comprobar la presencia de archivos y la estructura mediante el componente heredado `ReportQualityGate`:

```
               [ INICIAR EXPORTACIÓN (PhotoAlbum.tsx) ]
                                  │
                                  ▼
                     [ INIT_KERNEL ] (Inicializa ID)
                                  │
                                  ▼
                     [ LOCK_INPUT ] (Sella textos y fotos)
                                  │
                                  ▼
                    [ APPLY_POWERUPS ] (Dedupica Power-Ups)
                                  │
                                  ▼
                   [ DERIVE_LAYOUT ] (Genera estructura)
                                  │
                                  ▼
                   [ VALIDATE_KERNEL ] (Llama a ReportQualityGate heredado)
                                  │
                                  ▼
                    [ EXECUTE_EXPORT ] (Genera Word/PDF)
```

### Flujo de Integración Recomendado

Proponemos interceptar de manera nativa la transición **`VALIDATE_KERNEL`** para inyectar la ejecución automática del **ACE** antes de proceder a la fase de escritura y guardado de archivos (`EXECUTE_EXPORT`), consumiendo directamente los datos compilados en `ReportEngineKernel.getContext()`:

```
                                [ VALIDATE_KERNEL ]
                                         │
                                         ▼
                     [ Ensamblar Payload para Auditoría ACE ]
                                         │
                                         ▼
                             [ ACE.audit(payload) ]
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
             [ Status: FAILED ]                        [ Status: PASS / WARNING ]
                    │                                         │
                    ▼                                         ▼
         [ BLOQUEAR EXPORTACIÓN ]                   [ AUTORIZAR EXPORTACIÓN ]
           Retorna blockingReason                     - PASS: Generación normal.
           con variables y causas                     - WARNING: Inserta nota
           para corregir en interfaz.                   técnica de media página.
```

---

## 3. Matriz de Contratos de Datos: Correspondencia de Fuentes

Para alimentar correctamente al `ACEPayload`, se detalla la procedencia de las variables requeridas de cada motor en el ecosistema:

| Variable del Contrato ACE | Fuente de Datos Esperada | Fuente de Datos Actual en el Sistema | Estado de Viabilidad |
| :--- | :--- | :--- | :---: |
| **`tceContext.centroid`** | Coordenadas del proyecto | `project.latitude`, `project.longitude` (TCE) | ✅ **Disponible** |
| **`tceContext.radiusMeters`** | Radio del polígono | `analysisRadius` (TCE Config) | ✅ **Disponible** |
| **`tceContext.startDate / endDate`** | Rango temporal configurado | Derivado de las fechas extremas de las incidencias filtradas | ✅ **Disponible** |
| **`sieEventsCount`** | Conteo matemático de delitos | `project.incidents.length` | ✅ **Disponible** |
| **`semContext`** | Matriz de Evidencia Estadística | Instancia resultante de ejecutar `StatisticalEvidenceMatrixManager.process()` | 🟡 **Requiere cálculo al vuelo** |
| **`hieContext.validationVector`** | Vector de hipótesis cualitativo | Derivado del campo `spatialPattern` y la lógica estructurada del HIE en Firestore o parseado del markdown | 🟡 **Parcial** |
| **`cieContext.centroid`** | Centroide geográfico GIS | `project.latitude`, `project.longitude` (CIE) | ✅ **Disponible** |
| **`cieContext.eventsCount`** | Eventos del análisis GIS | `project.incidents.length` (CIE Layer) | ✅ **Disponible** |
| **`reportContext.mapCount`** | Total de capas en mapa | `mapSnapshots.filter(s => s.type === "map").length` | ✅ **Disponible** |
| **`reportContext.chartsCount`** | Total de gráficos | `mapSnapshots.filter(s => s.type === "chart").length` | ✅ **Disponible** |
| **`reportContext.eventsCount`** | Eventos impresos en reporte | `editorialPayload.eventsCount` | ✅ **Disponible** |

---

## 4. Comportamiento Detallado del Quality Gate

La máquina de estados interceptará y responderá de acuerdo con las siguientes directivas:

### A. Escenario PASS (Consistencia Absoluta)
* **Comportamiento:** Se autoriza la exportación de manera transparente. El documento PDF/Word se genera con su diseño estándar.
* **Métrica de Calidad:** Confianza global = **100%**.

### B. Escenario WARNING (Consistencia Permisiva)
* **Comportamiento:** Se autoriza la exportación, pero se introduce automáticamente en el documento final el bloque compacto **"Control de Consistencia Analítica"** (especificado en la Sección 5).
* **Métrica de Calidad:** Confianza global entre **80% y 98%**.
* **Ejemplo Práctico:** El modelo predictivo presenta sobredispersión temporal por bajo ajuste Poisson. No es un error crítico del sistema, sino una limitación metodológica que se reporta de forma transparente en el dictamen para salvar la responsabilidad institucional del analista.

### C. Escenario FAILED (Bloqueo de Exportación)
* **Comportamiento:** Se detiene y bloquea la exportación física. El sistema **PROHIBE** emitir mensajes de error genéricos del tipo *"Error: Informe incompleto"*.
* **Estructura del Error de Bloqueo:** Devuelve una explicación estructurada legible e institucional de la causa del fallo:
  ```json
  {
    "status": "FAILED",
    "blockingReason": [
      {
        "module": "QUANTITATIVE",
        "variable": "cieEventsCount",
        "expected": 1368,
        "received": 1200,
        "message": "Bloqueo por inconsistencia analítica: El volumen criminal representado en el reporte (1200 eventos) no coincide con el certificado por la SEM (1368 eventos)."
      }
    ]
  }
  ```
* **Impacto en Interfaz:** La interfaz del Perfilador desplegará una modal de advertencia clara listando los módulos y las variables que el analista debe reajustar (por ejemplo, corregir la cobertura de fechas o re-centrar el polígono de análisis).

---

## 5. Diseño Editorial del Bloque de Consistencia (Impacto Compacto)

Para evitar incrementar innecesariamente la extensión del dictamen policial con discusiones teóricas extensas, el bloque de consistencia del ACE se materializará de manera estrictamente ejecutiva en **menos de media página**:

```
┌────────────────────────────────────────────────────────────────────────┐
│               ⚠️ CONTROL DE CONSISTENCIA ANALÍTICA                     │
├──────────────────────────────────────┬─────────────────────────────────┤
│ Estatus de Calidad:  VALIDADO (WARN) │ Nivel de Confianza:    94%      │
├──────────────────────────────────────┴─────────────────────────────────┤
│ • Validaciones de Integridad Ejecutadas:  5 de 5                        │
│ • Alertas de Coherencia Detectadas:       1                             │
├────────────────────────────────────────────────────────────────────────┤
│ OBSERVACIÓN METODOLÓGICA INSTITUTIONAL:                                │
│ "El modelo predictivo presenta una limitación estadística debido a un │
│ bajo ajuste Poisson (sobredispersión diaria). La información se       │
│ conserva en el informe como evidencia contextual y no como proyección  │
│ determinista."                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Auditoría de Impacto Documental y Reglas de Concisión

El ACE no incrementará de forma nociva la extensión del reporte ni generará duplicidad de información bajo las siguientes directivas:

1. **Trazabilidad Interna:** Los detalles finos de la auditoría (coordenadas de centroides, diferencias porcentuales exactas, etc.) se mantienen dentro de la base de datos de bitácoras (`scratch/ace_audit_history.json` y colección `analyses` de Firestore) y **nunca se imprimen** en el informe de Word/PDF.
2. **Orientación al Hecho:** Se privilegia la estructura institucional:
   $$\text{HECHO OBSERVADO} \implies \text{INFERENCIA OPERATIVA} \implies \text{IMPLICACIÓN}$$
3. **Evitar Explicaciones Académicas:** Se prohíbe incluir descripciones matemáticas de algoritmos como DBSCAN, Poisson o el estimador Theil-Sen en el cuerpo del informe final. El ACE se limita a dar veredictos ejecutivos.

---

## 7. Plan de Pruebas Cruzadas Diseñado

La suite de pruebas para certificar la consistencia del pipeline final comprende los siguientes seis escenarios analíticos fundamentales:

1. **Prueba 1: Exportación Consistente (PASS)**
   * *Entrada:* Datos perfectamente simétricos de eventos, mapas, gráficas y coberturas de fechas.
   * *Resultado:* `PASS` con confianza al `100%`.
2. **Prueba 2: Discrepancia de Eventos (FAILED)**
   * *Entrada:* 1,368 delitos analizados por la SEM, pero el CIE reporta 1,200.
   * *Resultado:* `FAILED` en el módulo cuantitativo con bloqueo de exportación.
3. **Prueba 3: Discrepancia Espacial de Centroides (FAILED)**
   * *Entrada:* El centroide configurado en el TCE se desplaza más de 100 metros (10% de tolerancia para un radio de 1 km) respecto a la SEM.
   * *Resultado:* `FAILED` en el módulo espacial con bloqueo de exportación.
4. **Prueba 4: Limitación Estadística (WARNING)**
   * *Entrada:* Bajo ajuste del modelo Poisson (p-value < 0.05).
   * *Resultado:* `WARNING` en la matriz de calidad, permitiendo la descarga del dictamen pero inyectando el bloque compacto de consistencia.
5. **Prueba 5: Pérdida Documental de Mapas (FAILED)**
   * *Entrada:* SEM detecta hotspots activos, pero el reporte tiene 0 mapas insertados.
   * *Resultado:* `FAILED` en el módulo documental con bloqueo de exportación.
6. **Prueba 6: Desalineación Temporal de Rango (FAILED)**
   * *Entrada:* La SEM cubre de 2018 a 2025, pero el Reporte cubre de 2020 a 2025.
   * *Resultado:* `FAILED` en el módulo temporal con bloqueo de exportación.

---

## 8. Recomendaciones de Integración Tecnológica

Para el momento en que se decida pasar de esta fase de diseño a la fase de cableado productivo, se recomienda realizar las siguientes tres acciones técnicas:
1. **Modificar el método `VALIDATE_KERNEL` en `src/lib/reportEngine.ts`:** Reemplazar el validador estático heredado `ReportQualityGate.validate` por la llamada al método orquestador `AnalyticalConsistencyEngine.audit()`.
2. **Mapear el HIE en un vector estructurado:** Actualizar el parser de hipótesis en `intelligenceLayoutEngine.ts` para que extraiga un objeto JSON simple con las variables de patrón espacial y temporal.
3. **Actualizar el renderizador de Word/PDF:** Modificar el archivo `src/lib/exportToWord.ts` y la función `generatePdfProgrammatic` para admitir opcionalmente el pintado del bloque compacto de consistencia si el reporte del ACE contiene estatus `WARNING`.

---

- **Elaborado por:** *Antigravity AI (Google DeepMind Team)*
- **Fecha de Auditoría:** `14 de Julio de 2026`
- **Estatus:** 🟢 **Auditoría de Integración Completada y Cerrada Exitosamente**
