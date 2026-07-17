# Auditoría Previa de Implementación UI-05.3.B.5

## Consola de Procesamiento Dictamen IA / Capítulos — Homologación Visual

**Equipo de Implementación Frontend del Perfilador Remoto SSPE-CEIPOL**  
**Proyecto:** Perfilador Remoto SSPE-CEIPOL  
**Fase de Origen:** UI-05.3.B.5 — Consola de Procesamiento Dictamen IA / Capítulos  
**Estado de la Auditoría:** COMPLETA (PRE-IMPLEMENTACIÓN)  

---

# 1. Componentes de Procesamiento IA y Dictamen IA Bajo Alcance

Dentro del componente `PhotoAlbum.tsx`, el panel analítico final y la consola de gestión de reportes generados por inteligencia artificial se concentran de manera íntegra en el modal global:

1.  **Modal de Dictamen Oficial (`showReportModal`):** Consola maestra con vista dividida en pestañas (Edición y Vista Previa Institucional) que recopila el dictamen de 11 capítulos lógicos, la parametrización de anexos cartográficos, la selección de gráficas topológicas/temporales, el control de la bitácora de barridos activos, y el panel de emisión final (Descargas PDF/Word y guardado persistente).

---

# 2. Interfaces y Tipos Utilizados

*   **`activeReportTab` (Estado local):** Union de tipo `"edit" | "preview" | string` que determina el modo de interacción con el reporte final.
*   **`selectedAnnexes` (Estado local):** Objeto booleano estructurado que controla la inyección selectiva de anexos en el reporte compilado.
    ```typescript
    type SelectedAnnexesState = {
      mapInteractive: boolean;
      mapDensity: boolean;
      mapMobility: boolean;
      mapAttractors: boolean;
      mapPredictive: boolean;
      chartTemporal: boolean;
      chartTopology: boolean;
      chartEnvironmental: boolean;
      chartPrediction: boolean;
      graphConnections: boolean;
      sweepDenue: boolean;
      sweepIncidencia: boolean;
      sweepRepuve: boolean;
      sweepRnpdno: boolean;
      sweepMultimodal: boolean;
      sweepCifa: boolean;
      includeOsintAppendix: boolean;
    };
    ```
*   **`reportGenerationMeta` (Estado local):** Objeto o nulo con los datos de emisión analítica para el pie de página institucional.
    ```typescript
    type ReportGenerationMeta = {
      date: string;
      time: string;
      user: string;
    };
    ```

---

# 3. Props Recibidas (Componente Padre)

El componente padre `PhotoAlbum` hereda la firma de `PhotoAlbumProps` ya documentada. En este bloque, la prop crítica de callback consumida es:
*   `onSaveAnalysisToCloud`: Permite archivar en la nube la hipótesis final, los anexos y la bitácora estructurada de manera persistente.

---

# 4. Estados Internos Administrados

El modal asume y controla los siguientes estados reactivos de React:

*   **`showReportModal`** (`boolean`, inicial: `false`): Bandera que gatilla la renderización del contenedor overlay del dictamen oficial.
*   **`activeReportTab`** (`string`, inicial: `"edit"`): Estado de las pestañas ("edit" para edición de texto y anexos; "preview" para maquetación de paginación rígida).
*   **`editableProfile`** (`string`): Cuerpo completo del dictamen de 11 capítulos editables en formato markdown/mono.
*   **`selectedAnnexes`** (`any`): Objeto de banderas booleanas para la inyección de atlas cartográficos, modelos y barridos.
*   **`previewPageIdx`** (`number`, inicial: `0`): Índice de la paginación rígida de 12 páginas para la simulación física de la hoja de papel institucional CONFIDENCIAL.
*   **`isSavingAnalysis` / `isSavingExpediente`** (`boolean`): Sincronizadores visuales de carga para el bloqueo de botones durante transacciones.

---

# 5. Hooks Utilizados

*   **`useProject()`**: Extrae metadatos del proyecto y funciones de almacenamiento e impresión documental asíncronas.
*   **`useAuth()`**: Recupera al usuario logueado para plasmar firmas de analista responsable.
*   **`useState` / `useEffect`**: Sincronización local, guardado temporal de cambios y validación de anexos.

---

# 6. Componentes Hijos

*   **Ninguno directo**: El modal maqueta de forma nativa la hoja de previsualización analítica, las grillas de selección de checkbox, las tablas sintéticas de trazabilidad GEOINT, los formularios y el pie de página, haciéndolo ideal para la migración total de controles interactivos hacia el estándar de **`CEIPOLButton`**.

---

# 7. Dependencias Visuales y Oportunidades de Homologación

*   **Pestañas de Control (Tabs):** Se sustituye el diseño plano de pestañas por indicadores técnicos retroalimentados mediante colores cian y bordes unificados de gobernanza.
*   **Textarea de Cuerpo del Dictamen:** Se migra a un formato glassmorphic con focus estético y bordes suavizados.
*   **Cajas Selectoras de Anexos (Atlas, Modelos, Barridos):** Las tres grillas de selección se homologan estéticamente utilizando la paleta HSL oscura (`bg-slate-950/60 border border-slate-850`) y casillas de verificación alineadas (`text-cyan-500`).
*   **Botones rústicos de previsualización (Anterior/Siguiente) y acciones finales:** Sustitución de botones nativos (`bg-slate-800`, `bg-emerald-600`, `bg-sky-600`, `bg-amber-600`) por **`CEIPOLButton`** consumiendo sus variantes semánticas rígidas (`primary`, `confirm`, `warning`, `secondary`).

---

# 8. Consumidores Existentes del Componente Padre

Se re-confirma el alcance de distribución global:
1.  **`src/app/project/[id]/page.tsx` (Línea 410)**
2.  **`src/components/ProjectManager.tsx` (Línea 679)**

---

### MIGRACIÓN AUTORIZADA PARA INICIAR FASE 2
