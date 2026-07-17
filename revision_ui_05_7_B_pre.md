# Auditoría Previa de Arquitectura — UI-05.7.B

## Mapeo Detallado de Alertas y Flujos de Confirmación Críticos para la Consolidación UX

**Gobernanza UX / CEIPOL Design System**  
**Proyecto:** Perfilador Remoto SSPE-CEIPOL  
**Estado:** ✅ **COMPLETADA**

---

# 1. CifaCeipolPanel

## 1.1 Cantidad de Alerts y Contexto
Se identificaron exactamente **5 llamadas a `alert()`** dentro de `CifaCeipolPanel.tsx`:
1.  **Línea 118 (Error de Ejecución):**
    *   *Contexto:* Captura fallas asíncronas en `handleExecuteScan` al invocar la API del motor de barridos.
    *   *Mensaje:* `"Ocurrió un error al ejecutar el barrido de inteligencia."`
2.  **Línea 138 (Error de Registro):**
    *   *Contexto:* Captura excepciones al persistir el barrido operativo en Firestore/Firebase en `handleAppendHypothesis`.
    *   *Mensaje:* `"❌ Error al registrar el barrido: " + err.message`
3.  **Líneas 182, 193, 204 (Barrido no ejecutado):**
    *   *Contexto:* Frenos preventivos en los botones para descargar datos en formato JSON, CSV o TXT cuando el analista intenta exportar sin haber corrido el barrido.
    *   *Mensaje:* `"Debe ejecutar un barrido primero."`

## 1.2 Callbacks y Estados Afectados
*   **Callbacks:** El componente no expone callbacks directos que dependan de la sincronía del diálogo `alert`.
*   **Estados:** Se utiliza el estado reactivo `toast` (línea 61) que ya está declarado e instanciado. La migración no requiere declarar nuevos estados y no altera la lógica de los métodos asíncronos `handleExecuteScan` o `handleAppendHypothesis`.

---

# 2. OsintTerritorialPanel

## 2.1 Confirmaciones y Alertas Existentes
Se identificaron exactamente **6 alertas de diálogo** y **1 confirmación de navegador**:
1.  **Línea 259 (Congelamiento Exitoso):**
    *   *Mensaje:* `"🔒 CONGELAMIENTO EXITOSO: Los datos OSINT han sido certificados e integrados de forma inmutable para este expediente. No se dispararán más consultas dinámicas."`
2.  **Línea 262 (Error de Congelamiento):**
    *   *Mensaje:* `"Error al congelar la instantánea OSINT."`
3.  **Línea 268 (Confirmación de Borrado de Caché - Flujo Crítico):**
    *   *Mensaje:* `"¿Deseas descongelar el expediente y limpiar la caché OSINT? Esto permitirá realizar nuevos barridos en vivo."`
4.  **Línea 283 (Caché restablecida con éxito):**
    *   *Mensaje:* `"🔓 Descongelado con éxito. Caché local de evidencias restablecida."`
5.  **Líneas 796, 872, 986 (Fusión Exitosa de Hipótesis):**
    *   *Mensajes:* Indican la incorporación exitosa de hallazgos (Línea 796), colonias (Línea 872) y rutas (Línea 986) en el panel de hipótesis.

## 2.2 Flujo Crítico y Dependencia de Dexie/IndexedDB
El flujo de descongelar e interactuar con la caché de evidencias local tiene una dependencia directa con la base de datos IndexedDB gestionada por el cliente de Dexie `db`:
*   **`db.osint_snapshots.delete(project.id)`**: Borra el estado congelado del proyecto actual.
*   **`db.osint_events.where("projectId").equals(project.id).delete()`**: Limpia los registros de eventos de geointeligencia asociados.
*   *Control Táctico:* Al pasar de `window.confirm` a `CEIPOLConfirmModal`, **se dividirá la función en dos etapas**. La primera etapa (`clearSnapshotAndCache`) solo activará la visibilidad del modal (`isConfirmOpen = true`). La segunda etapa, encapsulada en el callback `handleConfirmClear()`, procesará la llamada Dexie asíncrona de manera 100% segura y con manejo de excepciones estructurado.

---

# 3. SweepSummaryTab

## 3.1 Estados Actuales y Mensajes
Se identificaron exactamente **2 llamadas a `alert()`** dentro de `SweepSummaryTab.tsx`:
1.  **Línea 32 (Guardado de Hipótesis Exitoso):**
    *   *Mensaje:* `"✅ Hipótesis consolidada guardada exitosamente."`
2.  **Línea 34 (Error de Guardado):**
    *   *Mensaje:* `"❌ Error al guardar la hipótesis: " + err.message`

Ambos diálogos ocurren dentro de la función asíncrona `handleSaveHypothesis` que interactúa con el contexto global `updateProjectDetails`.

## 3.2 Plan de Mitigación
*   Se importará `<CEIPOLToast>` y se declarará el estado `toast` con su correspondiente callback `setToast` para evitar duplicar interfaces de mensajería.
*   El renderizado del toast se agregará en la raíz del JSX para autodescartarse tras 5 segundos.

---

### Dictamen de Gobernancia para Autorización de Código
> **ESTADO DE LA AUDITORÍA PREVIA:** ✅ **APROBADA**  
> Se valida la idoneidad y el análisis exhaustivo de dependencias críticas en IndexedDB y el ciclo de vida del modal. El equipo queda plenamente facultado para proceder con la reestructuración segura de los 3 archivos JSX indicados.
