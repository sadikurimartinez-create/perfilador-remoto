# Plan de Implementación — UI-05.7.C

## Migración Masiva de Controles Visuales (CEIPOLButton + CEIPOLCard)

Este plan de implementación detalla el proceso seguro y controlado para erradicar de forma definitiva los últimos controles visuales nativos (`<button>`) y contenedores sólidos (`bg-slate-900`) remanentes en los 5 componentes tácticos del Perfilador Remoto SSPE-CEIPOL, migrándolos hacia los estándares unificados del **CEIPOL Design System**: `<CEIPOLButton>` y `<CEIPOLCard variant="glass">`.

---

## User Review Required

> [!IMPORTANT]
> **Preservación de Eventos y Callbacks Operativos:**  
> Al migrar controles visuales, se pondrá especial atención en no alterar la propagación de eventos como `e.stopPropagation()`, firmas de callbacks (`onClick`), ni atributos nativos (`disabled`, `type="button"`, etc.), garantizando la inmunidad absoluta del motor de hipótesis y la base de datos local IndexedDB/Dexie.

---

## Open Questions

No hay preguntas abiertas críticas para esta iteración. Todas las pautas estéticas e inventarios de deuda visual se derivan directamente del dictamen unificado de la Auditoría Técnica Certificada **UI-05.6**.

---

## Proposed Changes

A continuación se agrupan los cambios propuestos organizados lógicamente por componentes analíticos y de control:

---

### Componentes de Analítica y Fusión (UI Core)

#### [MODIFY] [CifaCeipolPanel.tsx](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/components/CifaCeipolPanel.tsx)
*   **Importaciones:** Importar `CEIPOLButton` and `CEIPOLCard` de su respectiva ruta `./ui/`.
*   **Línea 326 (Tarjeta Opaca):** Cambiar el div `<div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">` por `<CEIPOLCard variant="glass" className="p-5 space-y-3">`.
*   **Línea 330 (Botón Anexar):** Migrar el `<button>` a `<CEIPOLButton variant="primary" size="sm" onClick={handleAppendHypothesis} className="py-1.5 text-[10px]">`.
*   **Línea 462 (Botón Cerrar Modal):** Cambiar por `<CEIPOLButton variant="secondary" onClick={() => setSelectedEntity(null)} className="absolute top-3 right-3 rounded-full w-8 h-8 p-0 flex items-center justify-center">`.
*   **Líneas 533-540 (Botones Emergentes DynamicPopup):**
    *   Botón "Cancelar" migrado a `<CEIPOLButton variant="secondary" onClick={() => setCifaDataConfirm(null)} className="px-4 py-2 text-xs font-semibold">`.
    *   Botón "Confirmar" migrado a `<CEIPOLButton variant="primary" onClick={handleAppendHypothesis} className="px-4 py-2 text-xs font-bold shadow-md">`.

#### [MODIFY] [SweepSummaryTab.tsx](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/components/SweepSummaryTab.tsx)
*   **Importaciones:** Importar `CEIPOLButton` y `CEIPOLCard` de `./ui/`.
*   **Líneas 69, 108, 145, 171, 205 (Tarjetas Tácticas):** Sustituir los contenedores planos y opacos `bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl` por `<CEIPOLCard variant="glass" className="p-6 flex flex-col justify-between shadow-xl">` u homólogos según su layout interno.
*   **Línea 182 (Guardar Hipótesis):** Migrar a `<CEIPOLButton variant="confirm" onClick={handleSaveHypothesis} loading={isSavingHypothesis} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black">`.
*   **Línea 264 (Modificar Barrido):** Migrar a `<CEIPOLButton variant="secondary" onClick={() => setActiveSweepForModal(s)} className="px-3 py-1 text-[10px] font-bold">`.

---

### Componentes de Tablero y Métricas (Dashboard Core)

#### [MODIFY] [ImiDashboard.tsx](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/components/ImiDashboard.tsx)
*   **Importaciones:** Importar `CEIPOLButton` y `CEIPOLCard` de `./ui/`.
*   **Líneas 395, 405 (Botones de Pestaña IMI):** Migrar los `<button>` a `<CEIPOLButton variant="ghost">` u homólogo táctico adaptando dinámicamente las clases del estado activo, manteniendo el layout `flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider rounded-none`.
*   **Línea 782 (Filtros de Período Temporal):** Migrar a `<CEIPOLButton variant="primary" size="sm">` para el período seleccionado, y `variant="secondary"` para los inactivos.
*   **Línea 771 (Contenedor Táctico IMI):** Envolver el panel plano `bg-slate-900/30 border border-slate-800` usando `<CEIPOLCard variant="glass">`.

#### [MODIFY] [SecaiDashboard.tsx](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/components/SecaiDashboard.tsx)
*   **Importaciones:** Importar `CEIPOLCard` de `./ui/CEIPOLCard`.
*   **Métricas y Widgets (Líneas 268, 280, 298, 326, 350, 376, 402, 426, 450, 479, 518, 558):** Homologar todos los 12 paneles de widgets basados en clases nativas opacas `bg-slate-900/30 border border-slate-800 rounded-xl` hacia `<CEIPOLCard variant="glass">` para unificar la estética de datos translúcidos premium.

---

### Componentes de Inteligencia Territorial (OSINT Core)

#### [MODIFY] [OsintTerritorialPanel.tsx](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/components/OsintTerritorialPanel.tsx)
*   **Importaciones:** Importar `CEIPOLButton` y `CEIPOLCard` de `./ui/`.
*   **Líneas 402-479 (Botones de Filtro e Interacción):** Migrar los controles planos del panel superior a variantes `<CEIPOLButton>` con tamaños homologados.
*   **Línea 508 (Acción de Búsqueda/Rastreo):** Migrar a `<CEIPOLButton variant="primary" loading={loading}>` e inyectar automáticamente la ruleta táctica del componente.
*   **Líneas 596-646 (Controles de Solapa):** Reemplazar por variantes `variant="ghost"` y `variant="primary"` del botón institucional.
*   **Líneas 798, 875, 989 (Botones de Integración de Hipótesis):** Migrar a `<CEIPOLButton>` en variantes `variant="secondary"`, `variant="ghost"` o adaptados estéticamente para mantener los colores de la corporación.
*   **Líneas 535, 543, 554, 565, 822, 835, 887, 899, 925, 936, 954, 1000 (Tarjetas Opacas):** Homologar envolviendo o sustituyendo las clases planas `bg-slate-950/40 border border-slate-800/80` and `bg-slate-900` por el diseño translúcido de `<CEIPOLCard variant="glass">`.

---

## Verification Plan

### Automated Tests
Para certificar la integridad técnica de todos los cambios estéticos:
-   **Análisis de Tipos TypeScript:**
    ```powershell
    npx tsc --noEmit
    ```
-   **Compilación y Empaquetado Next.js:**
    ```powershell
    npm run build
    ```

### Manual Verification
-   Correr localmente el servidor táctico (`npm run dev`) y verificar que todos los paneles exhiban el desenfoque de cristal, gradientes suaves y retroalimentación táctil de alta intensidad sin alterar ningún callback de guardado de datos.
