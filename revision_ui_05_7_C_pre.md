# Auditoría Previa de Arquitectura — UI-05.7.C

## Inventario e Identificación de Deuda de Controles Visuales (CEIPOLButton + CEIPOLCard)

**Gobernanza UX / CEIPOL Design System**  
**Proyecto:** Perfilador Remoto SSPE-CEIPOL  
**Estado:** ✅ **COMPLETADA**

---

# 1. CifaCeipolPanel.tsx

## 1.1 Inventario de Controles Candidatos
*   **Tarjetas Opacas (`bg-slate-900`) candidatas a `CEIPOLCard variant="glass"`:**
    *   Línea 326 (alrededor): `<div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">` (Hipótesis Táctica Actualizada).
*   **Botones Nativos (`<button>`) candidatos a `CEIPOLButton`:**
    *   Línea 330 (alrededor): `<button onClick={handleAppendHypothesis} className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-[10px] font-bold rounded-lg transition">` -> Migrar a `variant="primary"` con tamaño `sm`.
    *   Línea 462 (alrededor): Botón cerrar modal con clase `"absolute top-3 right-3 text-slate-400 hover:text-white text-sm bg-slate-800 hover:bg-slate-700 h-8 w-8 rounded-full flex items-center justify-center transition"` -> Migrar a `variant="secondary"` con diseño redondeado.
    *   Línea 533 (alrededor): Botón "Cancelar" en DynamicPopup con clase `"px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all"` -> Migrar a `variant="secondary"`.
    *   Línea 540 (alrededor): Botón "Confirmar y Persistir" en DynamicPopup con clase `"px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-md active:scale-95"` -> Migrar a `variant="primary"`.

## 1.2 Callbacks y Estados Asociados
*   `handleAppendHypothesis`: Registra el barrido analítico y actualiza el estado de las hipótesis en el expediente local.
*   `setCifaDataConfirm`: Controla el renderizado condicional del modal dinámico.

---

# 2. SweepSummaryTab.tsx

## 2.1 Inventario de Controles Candidatos
*   **Tarjetas Opacas (`bg-slate-900`) candidatas a `CEIPOLCard variant="glass"`:**
    *   Líneas 69, 108 y 145 (alrededor): Tarjetas de resumen de métricas y estados operacionales.
    *   Líneas 171 y 205 (alrededor): Contenedores del editor de hipótesis y de la grilla de barridos unificados.
*   **Botones Nativos (`<button>`) candidatos a `CEIPOLButton`:**
    *   Línea 182 (alrededor): `<button type="button" onClick={handleSaveHypothesis} disabled={isSavingHypothesis} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 px-3.5 py-1.5 text-xs font-black uppercase tracking-wide transition-all shadow-md">` -> Migrar a `variant="confirm"` con atributo `loading={isSavingHypothesis}`.
    *   Línea 264 (alrededor): Botón "Modificar" en fila de la tabla -> Migrar a `variant="secondary"`.

## 2.2 Callbacks y Estados Asociados
*   `handleSaveHypothesis`: Salva la narrativa unificada de hipótesis en el contexto del expediente.
*   `isSavingHypothesis`: Bandera booleana de estado de carga.
*   `setActiveSweepForModal`: Controla la fila de barrido seleccionada para su edición.

---

# 3. ImiDashboard.tsx

## 3.1 Inventario de Controles Candidatos
*   **Tarjetas Opacas (`bg-slate-900`) candidatas a `CEIPOLCard variant="glass"`:**
    *   Línea 420 (alrededor): Header principal del IMI con clase `"bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6"`.
    *   Línea 771 (alrededor): Panel táctico secundario con clase `"bg-slate-900/30 border border-slate-800"`.
*   **Botones Nativos (`<button>`) candidatos a `CEIPOLButton`:**
    *   Líneas 395 y 405 (alrededor): Botones de pestaña "Cuadro de Mando IMI" y "Metodología IMI" -> Migrar a `variant="ghost"` adaptando las clases del borde inferior condicional de forma dinámica.
    *   Línea 782 (alrededor): Filtros de período temporal (90 días, 180 días, 365 días) -> Migrar el seleccionado a `variant="primary"` y los inactivos a `variant="secondary"`.

## 3.2 Callbacks y Estados Asociados
*   `setDashboardTab`: Alterna entre el panel analítico y la vista metodológica de madurez operativa.
*   `setPeriodDays`: Filtra el histórico de eventos del IMI.

---

# 4. SecaiDashboard.tsx

## 4.1 Inventario de Controles Candidatos
*   **Tarjetas Opacas (`bg-slate-900`) candidatas a `CEIPOLCard variant="glass"`:**
    *   Se identifican exactamente **12 widgets de control métrico y analítico** estructurados con clases de borde y fondo opaco:
        *   Líneas: 268, 280, 298, 326, 350, 376, 402, 426, 450, 479, 518 y 558.
        *   Clase actual: `"bg-slate-900/30 border border-slate-800 rounded-xl p-5 ..."`
        *   Acción: Sustituir/envolver por `<CEIPOLCard variant="glass">` para unificar el brillo de datos interactivos.

## 4.2 Callbacks y Estados Asociados
*   El componente solo calcula y expone métricas descriptivas e integraciones de datos. No posee callbacks destructivos o transaccionales que puedan verse comprometidos.

---

# 5. OsintTerritorialPanel.tsx

## 5.1 Inventario de Controles Candidatos
*   **Tarjetas Opacas (`bg-slate-900` / `bg-slate-950`) candidatas a `CEIPOLCard variant="glass"`:**
    *   Líneas 535, 543, 554, 565, 822, 835, 887, 899, 925, 936, 954 y 1000.
*   **Botones Nativos (`<button>`) candidatos a `CEIPOLButton`:**
    *   Líneas 410 y 427 (Filtros de riesgo): Migrar a `CEIPOLButton`.
    *   Línea 454 (Acción de rastreo/búsqueda táctica): Migrar a `<CEIPOLButton variant="primary" loading={loading}>`.
    *   Líneas 473 y 479 (Controles de mapa): Migrar a `CEIPOLButton`.
    *   Líneas 596 a 646 (Controles de pestañas de cobertura): Migrar a `CEIPOLButton` de tipo `ghost`/`primary`.
    *   Líneas 798, 875 y 989 (Integraciones directas de hallazgos, patrones y rutas tácticas): Migrar a `<CEIPOLButton size="sm">` en variantes acordes.

## 5.2 Callbacks y Estados Asociados
*   `loading`: Controla el spinner síncrono del rastreo. Su paso a `CEIPOLButton` automatizará el spinner nativo.
*   `onAppendToAnalysis`: Inyecta directamente las narrativas geoespaciales analizadas en el motor de hipótesis del expediente.

---

# 6. Evaluación de Riesgos y Controles de Mitigación

1.  **Inmunidad Transaccional:** Se prohíbe tocar la firma de cualquier callback, o la invocación a la persistencia local de Dexie/IndexedDB.
2.  **Mitigación Visual:** Se mantendrán las clases condicionales y los layouts de posicionamiento nativos (`flex-1`, `absolute`, etc.) transfiriendo las responsabilidades cromáticas y de desenfoque al Design System de forma controlada.
