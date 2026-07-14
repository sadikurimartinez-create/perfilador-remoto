# ADR-008.5 — Integración Controlada del Gang Intelligence Module (GIM) al Intelligence Integration Contract (IIC)

## 1. Estado del ADR
*   **Estatus:** `PROPOSAL` (Listo para revisión técnica)
*   **Fecha:** 14 de Julio de 2026
*   **Autor:** Arquitecto Senior de Software (Ecosistema Perfilador CEIPOL)
*   **Relacionado con:** ADR-008.1, ADR-008.2, ADR-008.3, ADR-008.4 (Fase 1 a Fase 4 completadas)

---

## 2. Contexto Arquitectónico
El **Intelligence Integration Contract (IIC)** es la única fuente de verdad unificada y certificada de inteligencia dentro del ecosistema del Perfilador CEIPOL. El resto de motores (tales como el Hypothesis Intelligence Engine - HIE, el Analytical Consistency Engine - ACE, y el Report Engine) nunca acceden directamente a las bases de datos ni a los submódulos aislados; consumen única y exclusivamente el `IntelligenceIntegrationContext` unificado.

Una vez construido, validado e implementado el núcleo de datos del **Gang Intelligence Module (GIM)** en la Fase 4 (bajo un tipado estricto y sin dependencias externas), se requiere diseñar la incorporación de este nuevo módulo de pandillas en el contrato del IIC de forma controlada, garantizando retrocompatibilidad al 100% con expedientes históricos que carecen de este capítulo analítico.

---

## 3. Auditoría IIC Actual

### 3.1 Estructura Actual del Contexto
El contrato unificado está estructurado en tres componentes de datos primarios y metadatos de gobernanza:
*   **`evidenceSources`**: Contenedores de matrices en bruto (SEM para estadísticas, VEE para imágenes/grafitis, TIE para territorial).
*   **`capabilityStatus`**: Registros lógicos de disponibilidad que informan a los de redactores automáticos qué secciones del expediente contienen datos listos para procesamiento.
*   **`intelligenceModules`**: Selectores de activación lógica de capacidades que controlan la habilitación de capítulos específicos.
*   **`analysisReadiness`**: Calificación final inmutable (`READY`, `READY_WITH_LIMITATIONS`, `NOT_READY`) que certifica si el expediente puede ser impreso o exportado.

### 3.2 Flujo e Integración Actual de Motores
El flujo del sistema actual opera bajo el siguiente patrón de desacoplamiento por inyección:

```
+-----------------------------------+
|               Input               |
|  (SEM, VEE, TIE, CIE, ACE, HIE)   |
+-------------------+---------------+
                    |
                    ▼
+-------------------+---------------+
|   IntelligenceContextBuilder      | ---> Invoca CapabilityRegistry
+-------------------+---------------+
                    |
                    ▼
+-------------------+---------------+
|   IntelligenceIntegrationContext  | ---> Única fuente de verdad (IIC)
+-------------------+---------------+
                    |
       +------------+------------+
       |                         |
       ▼                         ▼
+------+------+           +------+------+
|     HIE     |           |    Report   |
| (Consumidor)|           |    Engine   |
+-------------+           +-------------+
```

*   **VEE:** Inyectado como `VisualEvidenceMatrix | null` en `evidenceSources.VEE`. Se evalúa en el registry de capacidades para activar `visualEvidence`.
*   **HIE:** Inyectado pasivamente como `HIEValidationVector | null` en `evidenceSources.HIE`.
*   **ACE:** Inyectado como `AnalyticalConsistencyReport` en `evidenceSources.ACE`. Su estatus global regula directamente la concordancia de pruebas (`evidenceAgreement`) y el control de calidad (`qualityControl`).

---

## 4. Diseño de Integración GIM

Para conservar la inmutabilidad y la cohesión de capas, se incorporará la `GangEvidenceMatrix` (GEM) bajo las siguientes atribuciones formales:

### 4.1 Incorporación en `evidenceSources`
*   **Declaración:** `GIM: GangEvidenceMatrix | null;`
*   **Justificación:** La GEM es la matriz unificada de evidencias físicas y documentales recopiladas sobre dinámicas de pandillas (Capítulo 7.2). Pertenece formalmente a la capa de fuentes de evidencia ya que alimenta analíticamente al unificador, de la misma manera que lo hacen SEM, VEE o TIE.

### 4.2 Incorporación en `intelligenceModules`
*   **Declaración:** `gang: boolean;`
*   **Justificación:** Representa la disponibilidad de procesamiento de lógica del módulo analítico dentro de la compilación actual. Su activación determina si el motor de redacción puede estructurar el capítulo de caracterización grupal barrial.

### 4.3 Incorporación en `capabilityStatus`
*   **Declaración:** `gangIntelligence: boolean;`
*   **Justificación:** Informa de manera certera si el expediente cuenta con evidencias de pandillas completas, válidas y listas para ser citadas en el documento de inteligencia. Se determina dinámicamente si la GEM inyectada cumple con un estatus calificado por el validador como utilizable.

---

## 5. Estrategia por Etapas

```
[Etapa 0: Respaldo] ──► [Etapa 1: Tipos Nullable] ──► [Etapa 2: Capability Registry] ──► [Etapa 3: Builder] ──► [Etapa 4: Failover]
```

### Etapa 0 — Snapshot Previo
Antes de alterar cualquier línea de código del contrato central, se realizará un resguardo lógico de los componentes en la rama Git actual:
*   Interfaces en `models/intelligenceContextTypes.ts`.
*   Lógica de mapeo en `capabilityRegistry.ts`.
*   Estrategia de ensamble en `intelligenceContextBuilder.ts`.

### Etapa 1 — Tipos Opcionales y Nullable
Para preservar la compatibilidad retrospectiva, el GIM se declara estrictamente como **nullable**:
```typescript
GIM: GangEvidenceMatrix | null;
```
Cualquier expediente histórico procesado antes del ADR-008 resolverá la propiedad `GIM` como `null`. El esquema del contrato central no se rompe y los compiladores e intérpretes seguirán funcionando con total normalidad.

### Etapa 2 — Activación de Capacidad Dinámica
La propiedad `capabilityStatus.gangIntelligence` se calculará de manera automática en el `CapabilityRegistry`:
*   Si `GIM === null` -> `gangIntelligence = false`.
*   Si `GIM` está presente y su `status` interno es `"READY"` o `"READY_WITH_LIMITATIONS"` -> `gangIntelligence = true`.
*   Si `GIM` tiene estatus `"NOT_READY"` -> `gangIntelligence = false`.

### Etapa 3 — Modificación del Builder
El constructor central `IntelligenceContextBuilder.build()` se expandirá para recibir un parámetro opcional:
```typescript
public static build(
  projectId: string,
  sem: StatisticalEvidenceMatrix,
  vee: VisualEvidenceMatrix | null,
  tie: TerritorialEvidenceMatrix | null,
  hieVector: HIEValidationVector | null,
  ace: AnalyticalConsistencyReport,
  cie: any | null = null,
  gem: GangEvidenceMatrix | null = null // Parámetro de inyección nuevo
): IntelligenceIntegrationContext
```
Esto permite inyectar la matriz GEM de manera no obligatoria.

### Etapa 4 — Tolerancia a Fallos y Degradación Controlada
El sistema implementa tolerancia robusta a fallos analíticos basados en la importancia institucional de los indicios:

*   **Falla del GIM:** Si la validación del GIM resulta en un estatus no listo, el contexto degrada de forma segura a `READY_WITH_LIMITATIONS`, silenciando el capítulo analítico de pandillas en las exportaciones sin bloquear la previsualización del expediente principal.
*   **Falla del VEE / TIE:** El módulo GIM no se detiene si carece de datos del VEE o TIE; continúa de manera degradada emitiendo las advertencias metodológicas calculadas por el validador (e.g. "Graffiti sin corroboración documental").
*   **Falla de ACE / SEM (Bloqueo):** Las fallas en la consistencia analítica central (ACE) o la ausencia de incidentes estadísticos (SEM) representan brechas de integridad de alta prioridad. En este caso, el contexto unificado bloquea inmediatamente la readiness a `NOT_READY`, impidiendo la certificación final del documento.

---

## 6. Plan de Pruebas de Integración (Fase 6)

Se establecen las siguientes pruebas automatizadas obligatorias previas a la aprobación de la integración en producción:

*   **TEST-IIC-001 (Expediente Histórico sin GIM):**
    *   *Entrada:* `gem` se pasa como `null`.
    *   *Resultado esperado:* `GIM: null` en sources, `gangIntelligence: false`, `gang: false`. El contexto se genera con estatus `READY_WITH_LIMITATIONS` (por falta de capítulo) sin lanzar excepciones ni errores de compilación TypeScript.
*   **TEST-IIC-002 (Expediente Nuevo con GEM Válida):**
    *   *Entrada:* `gem` válida con estatus `READY` (Confianza 85).
    *   *Resultado esperado:* `GIM` cargado, `gangIntelligence: true`, `gang: true`. El estatus del contexto se eleva a `READY` (si el resto de las fuentes son estables).
*   **TEST-IIC-003 (GEM con Estatus NOT_READY):**
    *   *Entrada:* `gem` con errores de coordenadas o confianza baja.
    *   *Resultado esperado:* `GIM` cargado en fuentes, pero `gangIntelligence: false` y `gang: false` debido al fallo de validación del validador local de GIM. El contexto degrada correctamente.
*   **TEST-IIC-004 (GIM Completamente Ausente del Flujo):**
    *   *Entrada:* No se proporciona el parámetro `gem` en la llamada a `build()`.
    *   *Resultado esperado:* Comportamiento idéntico a `TEST-IIC-001`. El sistema mantiene compatibilidad heredada por omisión.
*   **TEST-IIC-005 (ACE FAILED con GIM Válido):**
    *   *Entrada:* GIM es válido pero el reporte ACE tiene un estatus `"FAILED"`.
    *   *Resultado esperado:* La unificación asimila el GIM, pero degrada la readiness final del contexto global a `NOT_READY` debido a la inconsistencia global de consistencia de hipótesis.
*   **TEST-IIC-006 (HIE en Ejecución sin GIM):**
    *   *Entrada:* HIE consumiendo el contexto unificado donde GIM es `null`.
    *   *Resultado esperado:* HIE asimila las hipótesis estadísticas tradicionales sin regresiones lógicas ni desbordamiento de memoria.

---

## 7. Estrategia de Rollback

### 7.1 Protocolo de Rollback Inmediato
En caso de detectarse cualquier anomalía posterior a la inyección física de GIM, se activará el rollback inmediato para restaurar la línea base del IIC:

1.  **Restauración de Tipos:** Revertir `models/intelligenceContextTypes.ts` a la versión previa a la declaración de `evidenceSources.GIM`.
2.  **Restauración del Registry:** Revertir `capabilityRegistry.ts` para forzar `gangIntelligence: false` de manera estática.
3.  **Restauración del Builder:** Eliminar el parámetro `gem` de la firma de `IntelligenceContextBuilder.build()` e inyectar `GIM: null` por defecto en las fuentes de manera estática.

### 7.2 Triggers de Rollback Obligatorio
El rollback se activará automáticamente ante la presencia de:
*   Cualquier error de compilación TypeScript (`tsc`) no resuelto en el IIC o los consumidores heredados (HIE, ACE).
*   Fallas o excepciones en la carga de expedientes históricos en entornos de desarrollo y pruebas.
*   Ruptura de contratos de exportación PDF o Word que impidan generar entregables institucionales.
*   Inconsistencia del contexto unificado (e.g. que una matriz GEM nula rompa el cálculo de la `analysisReadiness` global).

---

## 8. Matriz de Impacto

| Archivo | Impacto | Cambio Esperado | Riesgo / Mitigación |
| :--- | :--- | :--- | :--- |
| **`intelligenceContextTypes.ts`** | Bajo | Adición de propiedad opcional `GIM` en `evidenceSources`. | **Riesgo:** Desalineación de tipos en consumidores.<br>**Mitigación:** Tipado estrictamente compatible y opcional. |
| **`capabilityRegistry.ts`** | Bajo | Evaluación dinámica de disponibilidad de `gangIntelligence` basada en la GEM. | **Riesgo:** Activar capacidad con GEM corrupta.<br>**Mitigación:** Consumir el estatus de GEM validado por el `GangEvidenceValidator`. |
| **`intelligenceContextBuilder.ts`** | Medio | Adición del parámetro `gem`, mapeo en sources y modulación del estatus `gang` y readiness. | **Riesgo:** Generación nula de expedientes históricos.<br>**Mitigación:** Parámetro por defecto asignado como `null` en la firma del método. |
| **`hypothesisIntelligenceEngine.ts`** | Ninguno | Ninguno en esta fase (Consumo pasivo posterior). | No se modifica. Acceso exclusivo mediante interfaz del contexto. |
| **`visualEvidenceEngine/`** | Ninguno | Ninguno (Aislado). | No se altera. GIM consume del VEE de manera unidireccional y pasiva. |
| **`reportEngine.ts`** | Ninguno | Ninguno en esta fase (Preparación de renders futuros). | No se altera. Integración desacoplada posterior. |

---

## 9. Riesgos Identificados y Salvaguardas

*   **Riesgo 1: Referencias históricas nulas en Report Engine.**
    *   *Salvaguarda:* El motor de reportes siempre debe comprobar `capabilityStatus.gangIntelligence === true` antes de intentar renderizar o mapear el contenido del Capítulo 7.2. Si la capacidad es falsa, el capítulo se omite limpiamente en el documento resultante.
*   **Riesgo 2: Sobrecarga en la inyección de tipos.**
    *   *Salvaguarda:* No se permite inyectar dependencias cruzadas de GIM hacia los motores analíticos de VEE o TIE. El flujo es estrictamente asimétrico: GIM lee tipos de VEE, pero VEE no tiene conocimiento de la existencia de GIM.

---

## 10. Plan de Implementación Futuro

Para ejecutar la integración física de manera controlada y sin regresiones, se seguirá el siguiente orden de operaciones:
1.  **Modificar Tipos IIC:** Añadir `GIM` como opcional en `evidenceSources` dentro de `intelligenceContextTypes.ts`.
2.  **Modificar Capability Registry:** Actualizar la lógica de `gangIntelligence` en `capabilityRegistry.ts`.
3.  **Modificar Builder:** Expandir la firma y el enrutamiento de ensamble en `intelligenceContextBuilder.ts`.
4.  **Ejecutar Pruebas de Integración:** Correr el banco de pruebas (TEST-IIC-001 al TEST-IIC-006).
5.  **Validar Contexto:** Confirmar compilación general limpia mediante `npx tsc --noEmit`.
6.  **Activar Consumidores:** Permitir que HIE y el Report Engine lean opcionalmente los nuevos indicadores de pandillas.

---

## 11. Dictamen Final ADR-008.5

```
[ X ] Aprobado para integración controlada (Siguiente paso sugerido)
[   ] Aprobado con ajustes menores
[   ] Requiere rediseño del contrato
```

*El diseño de integración del GIM en el IIC se declara viable, seguro, retrocompatible y listo para ser ejecutado físicamente de forma controlada en la siguiente fase.*
