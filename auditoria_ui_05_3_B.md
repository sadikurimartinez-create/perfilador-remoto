# Auditoría UI-05.3.B

## Modales y Capa Dinámica

---

# 1. Componentes Analizados

Se ha realizado una inspección exhaustiva de la base de código del **Perfilador Remoto SSPE-CEIPOL** enfocada en identificar ventanas flotantes, overlays, popups y el sistema global de posicionamiento dinámico de diálogos por cursor. Se analizaron prioritariamente los siguientes archivos:

1.  **`src/components/CursorAnchoredDialogs.tsx`**  
    *   *Propósito:* Sidecar de cliente global que intercepta el ciclo de vida del DOM mediante un `MutationObserver` y registra los eventos del puntero del ratón (`pointerdown`, `pointermove`). Fuerza de forma dinámica coordenadas `top` y `left` en los modales para abrirlos adyacentes a la última interacción del usuario.
2.  **`src/components/DynamicPopup.tsx`**  
    *   *Propósito:* Contenedor flotante común que encapsula un backdrop de descarte (`onClick={onClose}`) y calcula coordenadas optimizadas con control de colisión y reajuste en los límites del viewport a través del submódulo helper `PopupPositionManager`.
3.  **`src/components/SweepIntegrationModal.tsx`**  
    *   *Propósito:* Modal táctico para la visualización, ajuste de contexto o rechazo técnico de barridos georreferenciados. Opera con posicionamiento adaptativo basado en coordenadas y dispone de múltiples flujos lógicos conectados a Firestore.
4.  **`src/components/PhotoAlbum.tsx`**  
    *   *Propósito:* Componente maestro de análisis criminológico-ambiental de más de 5200 líneas de código. Renderiza múltiples ventanas dinámicas (Historial de Expedientes, Eliminación Controlada, Confirmaciones del SCINCE/DENUE, Consola de Generación por IA y Visor del Dictamen con Edición).

---

# 2. Hallazgos

### A. El Sistema de Posicionamiento Global (`CursorAnchoredDialogs.tsx`)
*   Se identificó un patrón arquitectónico sobresaliente de posicionamiento reactivo: un observador de mutaciones intercepta de manera transparente cualquier elemento montado en el cuerpo del documento que coincida con el selector `.cursor-anchored-dialog, [role='dialog'], dialog[open], [aria-modal='true']`.
*   Esto significa que muchos modales no calculan su posición localmente de forma manual; son interceptados al nacer e inyectados con estilos en línea de posicionamiento `fixed` adyacentes al puntero, respetando el contenedor de bloque que los contenga.
*   *Gobernanza:* El archivo `CursorAnchoredDialogs.tsx` es de **crítica importancia** para la experiencia de usuario y se encuentra protegido de modificaciones destructivas para no quebrar el renderizado de ventanas en todo el sistema.

### B. Ventanas Flotantes Basadas en `DynamicPopup` (`PhotoAlbum.tsx`)
Se detectaron múltiples integraciones lógicas que delegan su maquetación y posicionamiento a `DynamicPopup`:
1.  **Historial de Expedientes (v9.0) (Línea 4918):** Renderiza la bitácora de dossiers guardados. Contiene botones de generación de Word, PDF, y borrado con llamadas asíncronas.
2.  **Modal de Eliminación Controlada (Línea 5015):** Exige justificación para desechar un registro o fotografía. Contiene un selector `<select>` nativo de motivos y validaciones estrictas.
3.  **Confirmación Sociodemográfica INEGI SCINCE (Línea 5085):** Caja de diálogo con un contenedor preformateado (`font-mono`) que despliega la demografía de la cuadra.
4.  **Confirmación Comercial INEGI DENUE (Línea 5133):** Caja similar con el volcado de la actividad económica y giros comerciales identificados.
*   *Estilo Legacy:* Todos estos bloques usan estilos nativos planos de `bg-slate-900 border border-slate-700/80 rounded-xl` y botones sin el estilo institucional unificado del Design System.

### C. Overlays de Cobertura Completa e Interacción Compleja (`PhotoAlbum.tsx`)
1.  **Consola de Procesamiento de Dictamen IA (Línea 5183):** Activo durante `isGeneratingAI`. Utiliza un overlay fijo (`fixed inset-0 z-[300] bg-black/90 backdrop-blur-md`) que bloquea la pantalla, una consola terminal con texto de consola de color verde esmeralda y una barra de progreso de capítulos basada en gradientes.
2.  **Editor y Vista Previa del Dictamen Criminológico (Línea 4370):** Activo mediante `showReportModal && editableProfile`. Dispone de un backdrop translúcido oscuro con filtro de desenfoque (`fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm`), un sistema de pestañas nativas ("Editar Dictamen" vs "Vista Previa"), un área de texto masiva y botones de acción.

### D. Modal de Barridos Georreferenciados (`SweepIntegrationModal.tsx`)
*   Se constató que opera bajo un z-index altísimo (`z-[300]`) con un fondo con filtro de desenfoque (`bg-slate-950/40 backdrop-blur-[2px]`).
*   Los contenedores y botones de acción se encuentran maquetados mediante clases nativas planas de Tailwind (`bg-slate-900 border border-slate-800 hover:bg-slate-700 text-slate-200`) y con botones de colores de advertencia no homologados.

---

# 3. Matriz de Riesgos

Se clasificaron los hallazgos según su nivel de acoplamiento de lógica, asincronía y persistencia de datos:

| Componente / Elemento Identificado | Líneas de Origen | Tipo de Interacción | Nivel de Riesgo | Justificación del Riesgo |
| :--- | :---: | :--- | :---: | :--- |
| **`CursorAnchoredDialogs.tsx`** | Global | Gestión e intercepción táctica de puntero | **Crítico** | Un error de tipos o de asignación quiebra el renderizado geométrico de todos los modales de la app. |
| **INEGI SCINCE / DENUE Popups** | 5085, 5133 | Incorporación asíncrona de datos en Firestore | **Crítico** | Invoca la función transactiva `registerSweep` para inyectar datos de la API directamente a la hipótesis. |
| **Modal Eliminación Controlada** | 5015 | Envío de documentos a papelera con justificación | **Crítico** | Llama al helper `softDeleteDoc` que realiza mutaciones de descarte documental asíncronas. |
| **Historial de Expedientes (Dossiers)** | 4918 | Descarga y regeneración binaria (PDF/Word) | **Alto** | Integra callbacks de empaquetado asíncrono pesados como `exportToWord` y `generatePdfProgrammatic`. |
| **Editor y Visor del Dictamen** | 4370 | Edición reactiva del dictamen, cambio de tabs | **Alto** | Almacena y muta un estado masivo de texto enriquecido e integra pestañas que alternan vistas condicionales. |
| **Consola de Procesamiento IA** | 5183 | Barra de progreso de capítulos en tiempo real | **Medio** | Despliega animaciones e hilos de texto de consola en tiempo real basados en los eventos del backend. |
| **Modal de Integración de Barridos** | 117 | Control de visualización y estados de rechazo | **Medio** | Dispone de múltiples transiciones de interfaz basadas en estados internos (`mode` de visualización). |
| **`DynamicPopup.tsx` (Clase Base)** | 113 | Backdrop de click-outside y wrapper común | **Bajo** | Contenedor puramente visual con envoltura de slots (`children`). |

---

# 4. Candidatos de Migración

Se han detectado áreas visuales específicas listas para ser homologadas hacia el **CEIPOL Design System** sin tocar la arquitectura subyacente:

1.  **Envolventes Base (`DynamicPopup.tsx`):**
    *   Reemplazar la base rústica de color gris plano por un fondo de opacidad calibrada (`bg-slate-950/95`), bordes más estilizados (`border-slate-800/80`) y propiedades de desenfoque de fondo glassmorphic premium (`backdrop-blur-md`).
2.  **Botones en Ventanas `DynamicPopup` (`PhotoAlbum.tsx`):**
    *   Homologar todos los botones planos (Cancelar, Aceptar, Generar Word, PDF) hacia la paleta institucional utilizando transiciones suaves, micro-escalados (`active:scale-[0.98]`) y contrastes tácticos de color.
3.  **Controles y Formularios Internos en `PhotoAlbum.tsx`:**
    *   Homologar el desplegable (`select`) del modal de eliminación hacia los estilos unificados de alerta roja.
4.  **Envolventes y Botones de `SweepIntegrationModal.tsx`:**
    *   Unificar los tres botones principales de acción ("✏️ Ajustar contexto", "❌ Rechazar" y "Aceptar Barrido") con transiciones, colores oficiales e indicadores luminosos.
5.  **Pestañas y Textareas de la Vista de Dictamen (`PhotoAlbum.tsx`):**
    *   Homologar los selectores de pestañas ("Editar Dictamen" vs "Vista Previa") y aplicar estilo táctico de alto contraste al textarea de edición.

---

# 5. Impacto Arquitectónico

La homologación visual de la capa dinámica de UI-05.3.B se estructurará bajo lineamientos de **Aislamiento Funcional Estricto**:

*   **Sin Modificación de Coordenadas o Eventos:** No se alterarán los listeners de movimiento, los triggers de cursor, ni los cálculos de viewport (`window.innerWidth`, `offsetLeft`, `clamping` del viewport) de `PopupPositionManager` o `CursorAnchoredDialogs`.
*   **Contratos e Interfaces Intactos:** Las propiedades de `DynamicPopupProps` (`open`, `anchorPosition`, `onClose`, etc.) mantendrán intacto su contrato de TypeScript.
*   **Preservación de Estado React:** Los estados que controlan la visibilidad de los modales (`showHistoryModal`, `deleteModal`, `showReportModal`, `scinceDataConfirm`) continuarán interactuando idénticamente con el renderizado condicional.
*   **Aislamiento de Firestore y API:** Las llamadas directas de mutación y persistencia (`registerSweep`, `softDeleteDoc`, `handleDeleteDossier`) quedarán blindadas, sustituyendo únicamente las clases del marcado de envoltura visual.

---

# 6. Recomendación

### 🌟 APROBADO PARA IMPLEMENTACIÓN

Se autoriza avanzar hacia la siguiente fase de desarrollo de modales y capa dinámica, siempre y cuando se respeten los límites del aislamiento de lógica y se proteja la estabilidad global del posicionamiento basado en el puntero del usuario.

---

### FIN AUDITORÍA
