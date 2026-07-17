# Reporte Pre-Auditoría Técnica — UI-05.5.B

## ProjectManager.tsx — Homologación de Alertas y Cabecera Operativa

**Equipo de Implementación Frontend del Perfilador Remoto SSPE-CEIPOL**  
**Bloque:** UI-05.5.B — Homologación de Alertas, Mensajería y Cabeceras  
**Fase:** Pre-Auditoría de Arquitectura (Pre-Implementation Audit)  
**Estado:** ✅ **AUDITORÍA COMPLETADA / LÍNEA BASE ESTABLECIDA**

---

# 1. Estructura y Consumidores del Componente

*   **Archivo Core:** `src/components/ProjectManager.tsx`
*   **Rol en el Sistema:** Orquestador principal del expediente del proyecto, coordinando mapas, álbum fotográfico, captura y el procesamiento IA.
*   **Consumidor Principal:**
    *   `src/app/project/[id]/page.tsx` (Línea 603: `<ProjectManager />`)

---

# 2. Análisis de Deuda de Diálogos Nativos Encontrados

Se detectaron **13 llamadas directas** a cuadros nativos de diálogo en el archivo `ProjectManager.tsx`:

### A) Alertas de Usuario (`window.alert`)
*   *Línea 51:* Alerta de micrófono no soportado por navegador.
*   *Línea 166:* Confirmación de guardado de contexto correcto.
*   *Línea 168:* Notificación de fallo al guardar contexto.
*   *Línea 183:* Confirmación de envío a revisión correcto.
*   *Línea 186:* Notificación de error al enviar a revisión.
*   *Línea 204:* Notificación de error al iniciar la auditoría.
*   *Línea 221:* Confirmación de validación de expediente correcta.
*   *Línea 223:* Notificación de error al validar.
*   *Línea 232:* Advertencia por omitir comentarios de devolución.
*   *Línea 247:* Confirmación de expediente devuelto a analista.
*   *Línea 249:* Notificación de error al devolver el expediente.
*   *Línea 262:* Confirmación de habilitación de edición manual.
*   *Línea 264:* Notificación de error al abrir expediente.

*Estrategia de Mitigación:* Integrar el estado local `toast` e inyectar el componente institucional `<CEIPOLToast>` para todas las alertas de estado/mensajes de éxito y error.

### B) Confirmaciones Nativas (`window.confirm`)
*   *Línea 174:* Confirmación de envío a revisión.
*   *Línea 212:* Confirmación de validación definitiva.
*   *Línea 257:* Confirmación de habilitación de edición en bloqueo.

*Estrategia de Mitigación:* Dado que no existe infraestructura de cuadros de confirmación en el subdirectorio de soporte `src/components/ui/`, se conservará la API nativa de JavaScript `window.confirm` para evitar introducir sistemas paralelos vulnerables, y se documentará oficialmente como Deuda UX remanente en el informe de cierre.

---

# 3. Análisis de la Cabecera Operativa actual

*   La cabecera actual del administrador de proyectos de `ProjectManager` utiliza contenedores con bordes redondeados simples de Tailwind (`rounded-lg bg-slate-900 border border-slate-800`), y botones HTML planos para "Regresar", "Guardar Cambios", "Enviar a Revisión", "Iniciar Auditoría", "Aprobar/Validar", "Devolver" y "Habilitar Edición".
*   *Estrategia de Mitigación:* Reemplazar todos los botones planos por instancias de `<CEIPOLButton>` con el esquema semántico correcto:
    *   *Regresar:* variante `secondary`
    *   *Guardar Cambios:* variante `primary`
    *   *Enviar a Revisión / Iniciar Auditoría:* variante `confirm`
    *   *Aprobar/Validar / Habilitar Edición:* variante `confirm`
    *   *Devolver:* variante `danger`
