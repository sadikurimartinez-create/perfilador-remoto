# Auditoría Previa de Arquitectura — UI-05.7.A

## Diagnóstico Técnico Preliminar para los Componentes `CEIPOLLoadingState` y `CEIPOLConfirmModal`

**Gobernanza UX / CEIPOL Design System**  
**Proyecto:** Perfilador Remoto SSPE-CEIPOL  
**Estado:** ✅ **COMPLETADA**

---

# 1. CEIPOLLoadingState

## 1.1 Inexistencia previa o componentes similares
En el directorio `src/components/ui/` se identificó un componente llamado `CEIPOLLoader.tsx` con un tamaño de 1430 bytes.
*   **Propósito actual de `CEIPOLLoader.tsx`:** Es una ruleta de carga simple diseñada principalmente para renderizado en línea. No soporta variantes de bloqueo global (`full-screen`) ni de superposición de contenedor (`card`), lo cual ha llevado a los desarrolladores a construir estados de carga ad-hoc y rudimentarios con `animate-spin` manuales o div rígidos en otros paneles operativos.
*   **Diferenciación con `CEIPOLLoadingState`:** El nuevo componente `CEIPOLLoadingState` consolida e integra las tres variantes de visualización (`full-screen`, `card` e `inline`) de manera nativa e in-situ, abstrayendo toda la complejidad de posición absoluta, z-index y filtros backdrop-blur. Eventualmente, en la fase UI-05.7.B/C, `CEIPOLLoader` podrá ser deprecated o redireccionado hacia `CEIPOLLoadingState` para unificar el núcleo visual.

## 1.2 Usos actuales de loaders y spinners manuales
Actualmente, los indicadores de carga se distribuyen de la siguiente manera en los componentes prioritarios analizados:
1.  **`CifaCeipolPanel.tsx` (Línea 228):** Utiliza `<CEIPOLLoader message="Generando análisis CIFA-CEIPOL" />` para la carga inicial.
2.  **`CifaCeipolPanel.tsx` (Línea 230):** Utiliza un div animado manual `<div className="text-center py-10 text-slate-500 text-sm animate-pulse">Generando plan operativo...</div>`.
3.  **`OsintTerritorialPanel.tsx` (Línea 507):** Renderiza un spinner inline crudo con un SVG animado personalizado `<svg className="animate-spin h-4 w-4 text-white">` acoplado directamente al botón táctico de rastreo.
4.  **`SweepSummaryTab.tsx` (Línea 186):** Renderiza texto simple dinámico dentro del botón: `{isSavingHypothesis ? "Guardando..." : "💾 Guardar Hipótesis"}`.

## 1.3 Conflictos potenciales y mitigación
*   **Conflicto de Importación / Nombre:** Para evitar colisiones o ambigüedades con el antiguo `CEIPOLLoader`, el nuevo componente se llamará estrictamente `CEIPOLLoadingState`.
*   **Conflicto de Z-Index:** La variante `full-screen` del nuevo loader global debe situarse en un nivel superior al de cualquier modal administrativo o popup de mapa existente (`z-[150]`), evitando que quede oculto tras el contenido dinámico.
*   **Conflicto de Desplazamiento (Scroll):** El contenedor `full-screen` se define con posicionamiento `fixed` para bloquear visualmente la interacción total del usuario en segundo plano durante procesos pesados de persistencia de datos.

---

# 2. CEIPOLConfirmModal

## 2.1 Ubicaciones actuales de llamadas a `confirm()`
Se escaneó todo el ecosistema y se localizó la única llamada a diálogo de confirmación síncrono del navegador:
*   **Archivo:** `src/components/OsintTerritorialPanel.tsx`
*   **Línea:** 268
*   **Línea de Código:**
    ```typescript
    const confirmClear = window.confirm("¿Deseas descongelar el expediente y limpiar la caché OSINT? Esto permitirá realizar nuevos barridos en vivo.");
    ```

## 2.2 Componentes candidatos a migración futura
Una vez construido `CEIPOLConfirmModal`, los siguientes flujos operativos críticos (fuera de la prioridad analítica pero pertenecientes al administrador) son candidatos ideales para su adopción secuencial en UI-05.7.B/C:
1.  **`ProjectList.tsx`:** Los modales administrativos nativos para borrar, archivar o reactivar proyectos que requieran autorizaciones tácticas secundarias.
2.  **`CaptureAndAddPhoto.tsx`:** Flujo de confirmación manual de ubicación en caso de fallo EXIF o imágenes duplicadas en cola de subida (`manualQueue`).
3.  **`ProjectManager.tsx`:** Flujo de cierre de proyecto o finalización del expediente operativo.

## 2.3 Riesgos de reemplazo y controles de mitigación
*   **Riesgo de Bloqueo Síncrono:** La función nativa `window.confirm()` interrumpe la ejecución del hilo principal de JavaScript y espera de forma bloqueante la respuesta del usuario. Por el contrario, un modal de React es asíncrono y se basa en el ciclo de vida del estado.
    *   *Mitigación:* Se estructurarán las funciones de llamada (como `clearSnapshotAndCache` en `OsintTerritorialPanel.tsx`) para usar el estado `isOpen` del nuevo modal y pasar la ejecución real del borrado al callback `onConfirm` que se disparará al dar clic en el botón correspondiente.
*   **Riesgo de Pérdida de Referencias:** Si el modal se desmonta abruptamente por un cambio de estado del padre, se podría perder el flujo transaccional.
    *   *Mitigación:* `CEIPOLConfirmModal` recibirá las propiedades de control de forma limpia y transparente, y el padre gestionará el estado `isOpen` asegurándose de que permanezca montado durante todo el ciclo de interacción de confirmación.

---

### Dictamen de Gobernancia para Autorización de Código
> **ESTADO DE LA AUDITORÍA PREVIA:** ✅ **APROBADA**  
> Se confirma que se cuenta con un mapeo preciso y exhaustivo de dependencias y riesgos. Las firmas y contratos TypeScript propuestos garantizan la seguridad operativa e inmunidad ante regresiones. Queda autorizado proceder con la creación física de ambos archivos en el repositorio.
