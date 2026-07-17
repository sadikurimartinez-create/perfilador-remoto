# Auditoría Previa de Implementación UI-05.3.B.3

## PhotoAlbum Informational Modals — Homologación Visual

**Equipo de Implementación Frontend del Perfilador Remoto SSPE-CEIPOL**  
**Proyecto:** Perfilador Remoto SSPE-CEIPOL  
**Fase de Origen:** UI-05.3.B.3 — PhotoAlbum Informational Modals  
**Estado de la Auditoría:** COMPLETA (PRE-IMPLEMENTACIÓN)  

---

# 1. Modales Informales Bajo Alcance

Dentro del componente `PhotoAlbum.tsx`, existen dos ventanas dinámicas de diálogo o modales que se clasifican estrictamente dentro de la categoría **Informativos/Edición Contextual**:

1.  **Modal de Edición de Contexto (`editingPhoto`):** Ventana emergente tipo popup adyacente al cursor para modificar comentarios o enriquecer contextualización sobre una captura de evidencia o fotografía del álbum.
2.  **Modal de Historial de Dossiers Guardados (`showHistoryModal`):** Bitácora histórica que despliega un listado de expedientes generados en el proyecto, permitiendo regenerar reportes (Word o PDF) o eliminar registros lógicos de dossiers.

---

# 2. Interfaces y Tipos Utilizados

Los modales no definen contratos TypeScript locales en archivos independientes, sino que operan con firmas y tipado genérico (`any`) o importado de contextos globales:

*   **`EvidencePhotoType` (Local):** Define la estructura de fotos en procesamiento.
    ```typescript
    type EvidencePhotoType = {
      id: string;
      previewUrl?: string;
      tipo?: string;
      comentario?: string;
    };
    ```
*   **`AlbumPhoto` (Contexto Global - importado de `@/context/ProjectContext`):** Estructura del item fotográfico en el álbum del proyecto.
*   **`any[]` / `any`:** Utilizado como firma de tipado para los dossiers históricos de bitácora y la foto en edición debido al historial de desarrollo heredado.

---

# 3. Props Recibidas (Componente Padre)

El componente padre `PhotoAlbum` recibe las siguientes propiedades de contrato mediante el tipo `PhotoAlbumProps`:
```typescript
type PhotoAlbumProps = {
  onDeletePhoto?: (id: string) => void;
  projectId?: string;
  onSaveAnalysisToCloud?: (
    content: string,
    attachedPhotos?: string[],
    summary?: string,
    metadata?: { reportEngineOutput?: boolean; source?: string }
  ) => Promise<void>;
};
```

---

# 4. Estados Internos

Los modales consumen o administran los siguientes estados internos React definidos en el cuerpo de `PhotoAlbum.tsx`:

*   **`editingPhoto`** (`any | null`, inicial: `null`): Controla la foto seleccionada para edición. Si posee valor, se gatilla la apertura del popup de comentarios.
*   **`clickCoords`** (`{ x: number; y: number }`, inicial: `{ x: 0, y: 0 }`): Almacena las coordenadas X/Y del puntero para anclar el popup.
*   **`showHistoryModal`** (`boolean`, inicial: `false`): Controla la apertura de la ventana de bitácora histórica.
*   **`historyDossiers`** (`any[]`, inicial: `[]`): Registra la lista de reportes expedientes históricos recuperados de la nube.
*   **`isLoadingHistory`** (`boolean`, inicial: `false`): Bandera para animaciones de carga en la bitácora histórica.

---

# 5. Hooks Utilizados

*   **`useProject()`**: Custom hook del contexto global para interactuar con:
    *   `project` (datos del proyecto activo).
    *   `album` (capturas cargadas).
    *   `updatePhotoMeta` (actualización de comentarios de fotos en la hipótesis).
*   **`useAuth()`**: Custom hook para validar credenciales y auditoría de dossiers (`user`).
*   **`useState` / `useRef`**: Estados locales de React y referencias a nodos del DOM.
*   **`useCallback`**: Memorización de manejadores de eventos.
*   **`useEffect`**: Invocaciones y triggers condicionales (ej. consulta del historial de dossiers al abrirse el modal).

---

# 6. Componentes Hijos

*   **`CEIPOLEmptyState` (Certificado / Congelado):** Consumido dentro del modal de historial cuando la lista de dossiers es nula o vacía.
*   **Controles Nativos HTML:**
    *   `button` y `textarea` en el Modal de Edición.
    *   `button` en la fila del listado de historial (Generar Word, Generar PDF, Borrar).
    *   `button` de cierre en el footer.

---

# 7. Dependencias Visuales y Oportunidades de Homologación

*   **`DynamicPopup` Wrapper:** Modales envueltos en `<DynamicPopup open={...} anchorPosition={clickCoords} onClose={...}>`.
*   **Botones Rústicos a Reemplazar:**
    *   *Aceptar y Cerrar* en Modal de Edición (`bg-sky-600 hover:bg-sky-500`).
    *   *Cerrar Historial* en footer de Dossiers (`bg-slate-800 hover:bg-slate-700`).
    *   *Generar Word* en lista (`bg-blue-700 hover:bg-blue-600`).
    *   *Generar PDF* en lista (`bg-sky-700 hover:bg-sky-600`).
    *   *Borrar* en lista (`bg-red-850 hover:bg-red-750`).
*   **Oportunidad de Homologación:** Reemplazo directo de todos los botones HTML planos por el componente unificado **`CEIPOLButton`**, seleccionando con rigor sus variantes (`secondary`, `confirm`, `danger`).

---

# 8. Consumidores Existentes del Componente Padre

El componente `PhotoAlbum` es renderizado en dos áreas críticas del sistema:
1.  **`src/app/project/[id]/page.tsx` (Línea 410):** Sección principal de análisis del panel maestro de proyectos.
2.  **`src/components/ProjectManager.tsx` (Línea 679):** Sub-módulo de supervisión y gestión.

---

### MIGRACIÓN AUTORIZADA PARA INICIAR FASE 2
