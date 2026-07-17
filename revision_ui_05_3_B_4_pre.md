# Auditoría Previa de Implementación UI-05.3.B.4

## Modales de Confirmación Firestore / Riesgo Crítico — Homologación Visual

**Equipo de Implementación Frontend del Perfilador Remoto SSPE-CEIPOL**  
**Proyecto:** Perfilador Remoto SSPE-CEIPOL  
**Fase de Origen:** UI-05.3.B.4 — Modales de Confirmación Firestore / Riesgo Crítico  
**Estado de la Auditoría:** COMPLETA (PRE-IMPLEMENTACIÓN)  

---

# 1. Modales de Alto Riesgo Crítico Bajo Alcance

Dentro del componente `PhotoAlbum.tsx`, se gestionan tres flujos transaccionales irreversibles que impactan la persistencia en Firestore y el historial del proyecto. Estos modales de confirmación son:

1.  **Modal de Eliminación Controlada (`deleteModal`):** Permite realizar un descarte lógico de elementos (fotografías, perfiles, evidencias) enviándolos a la papelera por 7 días, requiriendo justificación obligatoria.
2.  **Confirmación de Ingestión INEGI SCINCE (`scinceDataConfirm`):** Procesa datos demográficos recuperados de la API de INEGI y los inyecta dentro del bloque de hipótesis activa del proyecto mediante un barrido directo.
3.  **Confirmación de Ingestión INEGI DENUE (`denueDataConfirm`):** Procesa datos de concentración comercial recuperados del DENUE y los registra de manera inmutable en la hipótesis.

---

# 2. Interfaces y Tipos Utilizados

*   **`deleteModal` (Estado local):** Objeto de tipo `DeleteModalState` o genérico `any` que mapea la identidad del elemento a dar de baja.
    *   Firma esperada: `{ isOpen: boolean; id: string; type: string; projectId: string; }`
*   **`scinceDataConfirm` (Estado local):** String genérico o nulo que almacena la respuesta pre-procesada de la API SCINCE de INEGI.
*   **`denueDataConfirm` (Estado local):** String genérico o nulo que almacena la respuesta comercial de establecimientos de la API DENUE de INEGI.

---

# 3. Props Recibidas (Componente Padre)

El componente padre `PhotoAlbum` hereda la firma de `PhotoAlbumProps` ya documentada en UI-05.3.B.3. La invocación de estos modales se desencadena por eventos internos o mediante el consumo de handlers inyectados por el contexto de datos.

---

# 4. Estados Internos Administrados

Los modales están acoplados a los siguientes estados reactivos de React:

*   **`deleteModal`** (`any | null`, inicial: `null`): Almacena los metadatos del elemento en proceso de borrado. Controla la apertura del diálogo de eliminación.
*   **`deleteReason`** (`string`, inicial: `""`): Registra la justificación administrativa seleccionada obligatoriamente para autorizar la eliminación de un documento en Firestore.
*   **`scinceDataConfirm`** (`string | null`, inicial: `null`): String de texto con la tabla demográfica consolidada. Su presencia gatilla la confirmación de inyección demográfica.
*   **`denueDataConfirm`** (`string | null`, inicial: `null`): String de texto con la bitácora comercial de establecimientos. Su presencia gatilla la confirmación de inyección comercial.
*   **`clickCoords`** (`{ x: number; y: number }`): Coordenadas de posicionamiento del ratón para fijar el popover.

---

# 5. Hooks Utilizados

*   **`useProject()`**: Extrae funciones asíncronas de base de datos críticas para la persistencia del expediente en Firestore:
    *   `softDeleteDoc` (Función asíncrona para marcar documentos en la papelera lógica).
    *   `registerSweep` (Función asíncrona de mutación e inyección incremental para registrar barridos demográficos o comerciales en la hipótesis).
*   **`useState`**: Sincronización local de justificaciones, cargas y confirmaciones.

---

# 6. Componentes Hijos

*   **Ninguno**: Los modales se encapsulan en `<DynamicPopup>` y construyen de forma manual todas sus filas, selectores HTML (`select`, `option`), viewports de código monospace (`div`) y paneles de acciones (`button`), presentándose como candidatos óptimos para el consumo del componente certificado **`CEIPOLButton`**.

---

# 7. Dependencias Visuales Py Oportunidades de Homologación

*   **Fronteras de Advertencia Crítica:** El modal de eliminación controlada requiere un borde distintivo que resalte la naturaleza destructiva del descarte (`border-red-700/50`).
*   **Botones Rústicos a Homologar:**
    *   *Cancelar* en todos los diálogos (`bg-slate-800 hover:bg-slate-750`).
    *   *Confirmar Eliminación* (`bg-red-700 hover:bg-red-600 disabled:opacity-50`).
    *   *Aceptar y Añadir SCINCE* (`bg-purple-700 hover:bg-purple-650`).
    *   *Aceptar y Añadir DENUE* (`bg-amber-700 hover:bg-amber-650`).
*   **Estrategia de Homologación:** Reemplazo de controles planos por **`CEIPOLButton`** con sus variantes calibradas (`secondary` para cancelaciones, `danger` para eliminaciones lógicas, `confirm` para integraciones).

---

# 8. Consumidores Existentes del Componente Padre

Se re-confirma el alcance de distribución global:
1.  **`src/app/project/[id]/page.tsx` (Línea 410)**
2.  **`src/components/ProjectManager.tsx` (Línea 679)**

---

### MIGRACIÓN AUTORIZADA PARA INICIAR FASE 2
