# Reporte Pre-Auditoría Técnica — UI-05.5.A

## ProjectList.tsx — Modernización Visual Administrativa

**Equipo de Implementación Frontend del Perfilador Remoto SSPE-CEIPOL**  
**Bloque:** UI-05.5.A — Modernización Visual ProjectList.tsx  
**Fase:** Pre-Auditoría de Arquitectura (Pre-Implementation Audit)  
**Estado:** ✅ **AUDITORÍA COMPLETADA / LÍNEA BASE ESTABLECIDA**

---

# 1. Estructura y Consumidores del Componente

*   **Archivo Core:** `src/components/ProjectList.tsx`
*   **Rol en el Sistema:** Lobby principal y lista general de expedientes cargados en el Perfilador Remoto.
*   **Consumidor Principal:**
    *   `src/app/page.tsx` (Línea 99: `<ProjectList />`)
*   **Dependencias y Contextos:**
    *   `AuthContext.tsx` (Estado de sesión de usuario y rol administrativo).
    *   `ProjectContext.tsx` (Manejadores lógicos del ciclo de vida de los proyectos: crear, renombrar, archivar, borrar lógica, restaurar).

---

# 2. Inventario de Botones y Controles Encontrados

Se detectaron **30 botones HTML planos (`<button>`)** dentro del renderizado condicional de `ProjectList.tsx`:

### A) Controles de Cabecera General
*   *Línea 673:* Botón nativo para desencadenar la importación de JSON (`id="btn-importar"`) con clases de Tailwind de color gris opaco.
*   *Línea 682:* Botón nativo para exportar dataset Vertex AI con clases de Tailwind púrpura duro.
*   *Línea 691:* Botón nativo para crear un nuevo expediente (`"Nuevo Proyecto"`).

### B) Botones de Paginación
*   *Línea 899:* Botón nativo `"← Anterior"`.
*   *Línea 909:* Botón nativo `"Siguiente →"`.

### C) Botones en Tarjetas de Expedientes
*   *Línea 868:* Botón nativo `"Vista previa"`.
*   *Línea 877:* Botón nativo `"👁️ Vista Previa y Evidencia"`.

---

# 3. Inventario de Modales Administrativos Encontrados

`ProjectList.tsx` implementa **4 modales internos** autogestionados mediante estados React:

1.  **Rename Modal (`renameModalOpen`):**
    *   *Ubicación:* Línea 1090
    *   *Propósito:* Modificación del nombre de un expediente.
    *   *Estilo Actual:* `bg-slate-900 border border-slate-800 rounded-xl`
2.  **Archive Modal (`archiveModalOpen`):**
    *   *Ubicación:* Línea 1134
    *   *Propósito:* Archivar expedientes (pasar su estado a `ARCHIVADO`).
    *   *Estilo Actual:* `bg-slate-900 border border-slate-800 rounded-xl`
3.  **Reactivate Modal (`reactivateModalOpen`):**
    *   *Ubicación:* Línea 1178 (aproximadamente)
    *   *Propósito:* Reactivar expedientes que estén en la papelera o archivados.
    *   *Estilo Actual:* `bg-slate-900 border border-slate-800 rounded-xl`
4.  **Delete Modal (`deleteModalOpen`):**
    *   *Ubicación:* Línea 1222
    *   *Propósito:* Envío lógico de expedientes a la Papelera de Reciclaje.
    *   *Estilo Actual:* `bg-slate-900 border border-red-900/30 rounded-xl`

---

# 4. Mapeo de Estadoses y Alertas del Sistema

Se registraron **12 llamadas directas** a cuadros nativos de diálogo de navegador (`window.alert` / `window.confirm` / `alert`) que representan deuda visual técnica:
*   *Línea 198, 300, 313, 315, 323, 352, 377, 385, 399, 402, 415, 423, 426, 439, 447, 450, 463, 471, 474, 494:* Diálogos que irrumpen bruscamente el diseño y que serán documentados como Deuda UX debido a que no existe infraestructura centralizada unificada de modales de confirmación para migrar de forma aislada en esta fase de cambios puros de presentación.

---

# 5. Plan de Protección de Código

Durante las modificaciones estéticas de la fase **UI-05.5.A**, la lógica y funciones controladoras lógicas de `ProjectList.tsx` permanecerán completamente **intactas, protegidas y sin alteraciones**:
*   `confirmRenameProject`
*   `confirmDeleteProject`
*   `handleNuevoProyecto`
*   Lector asíncrono de base de datos (`onSnapshot`) e inyecciones de consulta en Firestore.
*   Contratos de interfaces y tipos TypeScript lógicos.
