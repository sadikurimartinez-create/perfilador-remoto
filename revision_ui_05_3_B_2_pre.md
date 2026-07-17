# Auditoría Previa de Implementación UI-05.3.B.2

## SweepIntegrationModal — Homologación Visual

**Equipo de Implementación Frontend del Perfilador Remoto SSPE-CEIPOL**  
**Proyecto:** Perfilador Remoto SSPE-CEIPOL  
**Fase de Origen:** UI-05.3.B.2 — SweepIntegrationModal  
**Estado de la Auditoría:** COMPLETA (PRE-IMPLEMENTACIÓN)  

---

# 1. Interfaces Utilizadas

El componente `SweepIntegrationModal` no declara interfaces locales propias de TypeScript ni firmas de tipo extendidas locales para sus propiedades. En su lugar, consume tipos directamente del contexto de datos del proyecto:

*   **`SweepIntegrationItem`** (importado de `@/context/ProjectContext`): Representa la estructura de datos del barrido georreferenciado activo que se pretende evaluar.
    ```typescript
    export interface SweepIntegrationItem {
      id: string;
      engine: string;
      source: string;
      type: string;
      relevance: string;
      status: "Pendiente" | "Integrado" | "Rechazado";
      data: string;
      context?: string;
      justification?: string;
    }
    ```

---

# 2. Props Recibidas

*   **Ninguna (`()`)**: El componente se define como `export function SweepIntegrationModal()`. Al ser un modal autónomo acoplado al estado global, extrae todo su contexto operacional directamente del `ProjectContext` a través de custom hooks, sin requerir parámetros desde componentes superiores.

---

# 3. Estados Internos

El modal administra siete estados locales de React para controlar la interfaz del usuario:

1.  **`mode`**: `"view" | "adjust" | "reject"`  
    *   *Propósito:* Controla la vista activa dentro del flujo secuencial del modal (Lectura de datos, Edición de contexto, u Obligatoriedad de justificación de descarte).
2.  **`contextInput`**: `string`  
    *   *Propósito:* Almacena el texto temporal del área de comentarios ingresados para enriquecer o ajustar la hipótesis.
3.  **`justificationInput`**: `string`  
    *   *Propósito:* Almacena el texto obligatorio para justificar el rechazo/descarte del barrido.
4.  **`errorMsg`**: `string`  
    *   *Propósito:* Registra y muestra mensajes de excepción técnica o validación fallida durante operaciones asíncronas.
5.  **`isSubmitting`**: `boolean`  
    *   *Propósito:* Bandera de bloqueo para deshabilitar botones y evitar transacciones duplicadas concurrentes hacia Firestore.
6.  **`coords`**: `{ x: number; y: number }`  
    *   *Propósito:* Registra la última ubicación en pixeles del ratón del usuario, asegurando que el modal emerja justamente bajo el cursor.
7.  **`positionStyle`**: `React.CSSProperties`  
    *   *Propósito:* Almacena el objeto de estilo en línea calculado dinámicamente para fijar (`fixed`) el modal y evitar colisiones con las fronteras del viewport.

---

# 4. Hooks Utilizados

*   **`useProject()`**: Custom hook del contexto global para extraer:
    *   `activeSweepForModal` (Barrido activo actualmente seleccionado).
    *   `updateSweep` (Función asíncrona de mutación y persistencia hacia Firestore).
    *   `setActiveSweepForModal` (Función para cerrar o conmutar el modal de barridos).
*   **`useState`**: Administración de los 7 estados locales descritos arriba.
*   **`useEffect` (Sincronización de Entradas):** Se activa al mutar `activeSweepForModal`. Carga los valores de context/justification y reinicia el modo a `"view"`.
*   **`useEffect` (Captura de Coordenadas de Ratón):** Agrega un listener global de movimiento de ratón (`mousemove`) mientras el modal está cerrado, registrando continuamente las coordenadas.
*   **`useEffect` (Cálculo del Viewport):** Realiza la matemática de delimitación para inyectar estilos de posicionamiento absoluto ajustado, impidiendo que el modal desborde los márgenes visibles de la pantalla.

---

# 5. Componentes Hijos

*   **Ninguno**: El componente maquetaba de forma directa todos sus elementos de acción y contenedores por medio de marcados nativos del navegador (`div`, `button`, `textarea`, `h2`, `h3`, `span`), representando una oportunidad ideal de modularización por consumo (por ejemplo, mediante `CEIPOLButton`).

---

# 6. Dependencias Visuales Actuales

El modal dependía de estilos de Tailwind genéricos, tales como:
*   Fondo rústico del backdrop: `fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]`
*   Envolvente principal grisáceo: `bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6`
*   Glow decorativo absoluto: `bg-indigo-500/10` y `bg-cyan-500/10` con desenfoque de 60px.
*   Botones de colores arbitrarios (`bg-sky-500 hover:bg-sky-400 text-slate-950`, `bg-red-950/20 hover:bg-red-900/20 text-red-400`, `bg-slate-800 hover:bg-slate-700`).

---

# 7. Consumidores Existentes

Se escaneó minuciosamente el código del proyecto encontrando un **único consumidor global**:

*   **`src/app/project/[id]/page.tsx` (Línea 603):**  
    Renders `<SweepIntegrationModal />` al final del árbol de renderizado del panel maestro, delegando todo su ciclo de apertura al estado global de `ProjectContext`.

---

# Plan de Homologación Visual Autorizado

En función de los hallazgos de esta auditoría, la migración visual operará bajo las siguientes pautas:

1.  **Envolvente Base:** Se aplicarán las clases oficiales de glassmorphic y contraste táctico de `DynamicPopup`:
    ```tsx
    className="bg-slate-950/95 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-2xl p-5"
    ```
2.  **Backdrop:** Se unificará con la envoltura de backdrop certificada:
    ```tsx
    className="fixed inset-0 z-[300] bg-slate-950/20 backdrop-blur-[1px] transition-opacity"
    ```
3.  **Botones:** Se sustituirán todos los botones manuales de HTML por el componente unificado **`CEIPOLButton`**, utilizando adecuadamente sus propiedades funcionales y variantes de estado (`variant="secondary"`, `variant="danger"`, `variant="confirm"`).
4.  **Preservación de Estado:** Se protegerán estrictamente los callbacks de acción asíncrona (`handleConfirm`, `handleAdjust`, `handleReject`), los hooks de seguimiento de ratón y el estilo dinámico de posicionamiento `positionStyle`.

---

### MIGRACIÓN AUTORIZADA PARA INICIAR FASE 2
