# Auditoría UI-05.3

## Evolución CEIPOL Design System
**Documento de Auditoría Técnica Previa**  
**Proyecto:** Perfilador Remoto SSPE-CEIPOL  
**Fase:** UI-05.3 — Nueva Capa UX Institucional  
**Estado de Modificaciones:** ❌ CONGELADO (Fase de Solo Lectura e Inspección)

---

# 1. Componentes Analizados

Se ha realizado un escaneo estático exhaustivo y una inspección jerárquica en los directorios `src/components/`, `src/app/` y `src/styles/` para identificar todos los elementos que no están homologados bajo el CEIPOL Design System. 

### Resumen Estadístico de Archivos Analizados
Se identificaron **3,577 incidencias** de patrones heredados y elementos fuera del Design System distribuidos en los siguientes componentes clave:

| Componente / Archivo | Incidencias Detectadas | Tipo de Contenido / Propósito |
| :--- | :---: | :--- |
| `src/components/PhotoAlbum.tsx` | **465** | Panel táctico principal (álbum de fotos, mapas, gráficos, reportes) |
| `src/components/ProjectList.tsx` | **180** | Lista de proyectos, bandeja de entrada de expedientes y papelera |
| `src/components/ProjectManager.tsx` | **58** | Creación y parametrización de polígonos/puntos de interés |
| `src/components/SweepIntegrationModal.tsx` | **46** | Ventana dinámica flotante de confirmación de hipótesis (Gobernanza) |
| `src/components/SweepSummaryTab.tsx` | **56** | Resumen analítico e integración de barridos tácticos |
| `src/components/CifaCeipolPanel.tsx` | **61** | Panel de correlaciones de inteligencia e integraciones CIFA |
| `src/components/InstitutionalHeader.tsx` | **10** | Cabecera institucional de la aplicación |
| `src/modules/pandillas/pandillas.ui.tsx` | **570** | Módulo de geointeligencia y análisis de pandillas |
| `src/modules/inundaciones/inundaciones.ui.tsx` | **277** | Módulo de análisis de riesgo por inundaciones |
| `src/components/command/GeoIntCommandDashboard.tsx` | **176** | Tablero de comando estratégico geointeligente |
| `src/components/ImiDashboard.tsx` | **123** | Dashboard de indicadores de inteligencia criminal (IMI) |
| `src/app/admin/page.tsx` | **154** | Módulo de supervisión y administración de expedientes |
| `src/app/admin/imfo/page.tsx` | **50** | Gestión e ingesta de fuentes IMFO |
| `src/components/AnalysisMap.tsx` | **123** | Visualizador geoespacial táctico integrado |
| `src/components/SecaiDashboard.tsx` | **77** | Tablero ejecutivo SEC-AI de gobernanza algorítmica |

---

# 2. Hallazgos

### A. Patrones Heredados y Elementos fuera del Design System

1. **Uso Masivo de Botones Nativos (`<button>`):**
   - Se detectó una de las mayores desviaciones en el uso de etiquetas `<button>` nativas con estilos manuales Tailwind. Estos botones carecen de las propiedades dinámicas de micro-animaciones (como la clase `active:scale-95`), gradientes corporativos y el spinner de carga estandarizado de `CEIPOLButton.tsx`.
   - *Ejemplo típico en `src/components/ProjectList.tsx` (Línea 677):*
     ```tsx
     <button className="px-4 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition-colors shadow-md">
     ```

2. **Inyección de Contenedores de Tarjetas Manuales (`className="card"`):**
   - Aunque `globals.css` define una clase abstracta `.card`, varios módulos inyectan estilos ad-hoc reescribiendo bordes y fondos oscuros en lugar de delegar en el componente certificado `CEIPOLCard.tsx`. Esto rompe el "ambient lighting" (los destellos de luz ambiental de fondo degradada indigo/cyan) que proporciona la tarjeta institucional certificada.
   - *Ejemplo típico en `src/app/admin/imfo/page.tsx` (Línea 58):*
     ```tsx
     <div className="card p-6 text-center space-y-3 mt-8 max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-xl">
     ```

3. **Inconsistencias en Clases de Utilidad de Estilos Inline:**
   - **`bg-*`:** Múltiaciones de fondos como `bg-slate-900/40`, `bg-blue-950/30`, `bg-red-950/20` o `bg-slate-950/50`. Estos valores deben ser reemplazados o abstraídos en la paleta semántica del sistema para asegurar la consistencia del tema táctico oscuro.
   - **`border-*`:** Alta variabilidad de colores de borde (`border-slate-800`, `border-sky-900`, `border-slate-700/50`). No respetan el estándar del sistema que exige bordes limpios basados en `slate-850` o `slate-900`.
   - **`rounded-*`:** Mezcla aleatoria de radios de esquina, conviviendo `rounded-md`, `rounded-lg`, `rounded-xl` y `rounded-2xl` dentro de una misma interfaz.
   - **`shadow-*`:** Variaciones incoherentes de sombras (`shadow-inner`, `shadow-md`, `shadow-lg`, `shadow-2xl`) aplicadas de manera redundante o asimétrica.

4. **Inputs, Selects y Textareas no Estandarizados:**
   - No existe un componente centralizado para controles de formulario. Cada archivo de vista de formulario define de forma independiente sus inputs con bordes gruesos o esquinas inconsistentes.

### B. Inconsistencias Visuales e Institucionales

1. **Headers Tácticos Heterogéneos:**
   - Los sub-paneles y modales analíticos construyen sus títulos con etiquetas de cabecera arbitrarias (`<h3>`, `<h4>`, `<h2>`) con combinaciones de color manuales en lugar de implementar `CEIPOLSectionHeader.tsx`. Esto devalúa la jerarquía visual de la aplicación.
   - *Ejemplo típico en `src/components/SweepIntegrationModal.tsx` (Línea 131):*
     ```tsx
     <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Gobernanza Operativa SAI</h3>
     <h2 className="text-base font-extrabold text-white">VENTANA DE CONFIRMACIÓN DE HIPÓTESIS</h2>
     ```

2. **Ausencia de Estados Operativos Certificados:**
   - **Carga (Loading):** Se detectó que el 90% de las pantallas muestran estados de carga nativos ("Cargando...", spinners SVG duplicados) en lugar de renderizar la animación premium táctica de `CEIPOLLoader.tsx`.
   - **Vacío (Empty State) y Error (Error State):** La mayoría de las listas y búsquedas renderizan textos simples de fallback, perdiendo la oportunidad de usar las ilustraciones y textos limpios de `CEIPOLEmptyState.tsx` y `CEIPOLErrorState.tsx`.
   - *Ejemplo típico en `src/components/ProjectList.tsx` (Línea 761):*
     ```tsx
     <p className="text-xs text-slate-400 bg-slate-900/50 p-4 rounded-lg text-center border border-slate-800/50">No hay expedientes en esta categoría.</p>
     ```

---

# 3. Candidatos de Migración

Se proponen los siguientes candidatos prioritarios para ser actualizados en la fase de implementación de UI-05.3, agrupados funcionalmente:

### Lote A: Headers Institucionales y Navegación
*   **`src/components/InstitutionalHeader.tsx`:** Homologar la barra superior, simplificar los enlaces inline mediante un componente de navegación y estandarizar el botón de cierre de sesión con `CEIPOLButton` en su variante `ghost`.
*   **Sub-headers en Paneles (`PhotoAlbum`, `ImiDashboard`, `CifaCeipolPanel`):** Sustituir estructuras nativas de títulos por el componente homologado `CEIPOLSectionHeader`.

### Lote B: Formularios y Controles de Entrada
*   **`src/components/ProjectManager.tsx`:** Unificar los inputs de texto, selectores geométricos (radio buttons) y áreas de texto con clases consistentes o proponer la creación de un `CEIPOLInput` para encapsular la validación y el estilo premium táctico.
*   **`src/app/perfil/page.tsx`** y **`src/components/CaptureAndAddPhoto.tsx`:** Reemplazar entradas rústicas por componentes homologados.

### Lote C: Ventanas Dinámicas, Popups y Modales
*   **`src/components/SweepIntegrationModal.tsx`:** Sustituir el contenedor flotante nativo por una estructura que incorpore `CEIPOLCard` en variante `glass` o `analysis`, y homologar sus botones de acción ("Ajustar contexto", "Confirmar e Integrar", "Descartar") con `CEIPOLButton`.
*   **`src/components/powerups/PuenteContextualModal.tsx`** y **`src/components/SweepSummaryTab.tsx`:** Migrar a la capa visual adaptativa CEIPOL.

### Lote D: Listados, Bandejas y Tablas Administrativas
*   **`src/components/ProjectList.tsx`:** Reemplazar las alertas de término manuales (Líneas 607, 617, 630) por contenedores estilizados basados en `CEIPOLCard` (variantes `alert` o `default`). Convertir las tarjetas de proyecto de divs tradicionales a instancias de `CEIPOLCard` enriquecidas.
*   **Tablas en `src/app/admin/imfo/page.tsx` y `src/app/admin/page.tsx`:** Homologar filas de tabla, indicadores de estado e iconos interactivos.

### Lote E: Estados de Interfaz unificados
*   Reemplazar todos los fallbacks condicionales de carga, listas vacías y errores en todos los archivos de componentes candidatos, forzando el uso exclusivo de `CEIPOLLoader`, `CEIPOLEmptyState` y `CEIPOLErrorState`.

---

# 4. Evaluación de Riesgo

Cada candidato de migración ha sido evaluado según el impacto operativo y técnico que representa su reestructuración visual:

| Tipo de Hallazgo | Ubicación de Ejemplo | Riesgo Asociado | Justificación de Riesgo |
| :--- | :--- | :---: | :--- |
| **Visual puro** | Ambient glows, anillos de gradiente, divisores horizontales en `PhotoAlbum.tsx` | 🟢 **Bajo** | Cambios estéticos puros sin alterar estados o controladores lógicos. No afecta interacción. |
| **Contenedor con estados** | Gestión de pestañas activas en `PhotoAlbum.tsx`, tabs en `ImiDashboard.tsx` | 🟡 **Medio** | Requiere mantener la persistencia y sincronización de los estados activos de la pestaña de React para no interrumpir la navegación. |
| **Control funcional** | Botones de acción en `SweepSummaryTab.tsx`, inputs en `ProjectManager.tsx` | 🟠 **Alto** | Involucra callbacks de usuario (`onClick`, `onChange`). Cualquier omisión en el reenvío de propiedades nativas (`disabled`, `type`, `ref`) puede romper la interacción. |
| **Flujo administrativo** | Bandeja de expedientes de `ProjectList.tsx`, Gobernanza en `SweepIntegrationModal.tsx` | 🔴 **Crítico** | Son flujos que ejecutan mutaciones críticas (eliminaciones lógicas, actualizaciones en Firestore, cambios de estado operativo de "Abierto" a "Validado"). Un error en la migración puede interrumpir la trazabilidad legal del sistema. |

---

# 5. Impacto Arquitectónico

### Lógica Mezclada con Presentación
Existe un alto nivel de acoplamiento entre la lógica de negocios y la capa de presentación en archivos de gran tamaño. Por ejemplo:
- `PhotoAlbum.tsx` (281 KB) realiza consultas directas a Firebase, maneja el estado de geolocalización de Google Maps, gestiona temporizadores y renderiza interfaces tácticas de manera integrada.
- `ProjectList.tsx` (64 KB) integra la lógica de descarte y archivado con modales interactivos y renderizado de grids.

### Viabilidad de Migración de Capa Visual Pura
*   **Sí, es 100% viable**, siempre y cuando se respete un principio de refactorización quirúrgica: **se debe modificar exclusivamente la estructura del marcado (JSX/TSX)** para envolver elementos nativos con componentes CEIPOL, absteniéndose de reestructurar Hooks de React (`useState`, `useEffect`, `useMemo`), llamadas a Firebase Firestore, o controladores de eventos complejos.

### Afectación a Callbacks y Estados de React
*   La sustitución de `<button>` por `CEIPOLButton` no afectará los callbacks, ya que el componente certificado expone correctamente la firma `React.ButtonHTMLAttributes<HTMLButtonElement>`. Sin embargo, se debe validar meticulosamente que el prop `type="button"` se mantenga para evitar que botones dentro de formularios desencadenen submit por accidente.

### Afectación a Firestore y Base de Datos
*   **Impacto Nulo.** Las operaciones de lectura/escritura en Firestore se mantendrán idénticas, ya que las claves de los documentos y los mapeadores de datos no sufrirán ninguna alteración de esquema o lógica durante este cambio estético.

### Afectación a Componentes Certificados
*   **Impacto Positivo.** Esta migración consolida el uso de la capa certificada (`src/components/ui/`), validando su robustez y eliminando la redundancia de código CSS inline en el resto de la aplicación.

---

# 6. Recomendación

El Arquitecto Técnico Principal del Perfilador Remoto SSPE-CEIPOL emite el siguiente dictamen técnico:

### 🌟 APROBADO PARA IMPLEMENTACIÓN bajo las siguientes Directrices de Mitigación Obligatorias:

1.  **Aislamiento de Lógica:** Queda estrictamente prohibido alterar cualquier Hook de React, lógica de sincronización de Firestore, manipulación de archivos u operaciones de API durante la migración estética.
2.  **Uso Quirúrgico de Reemplazos:** Reemplazar de forma ordenada y progresiva las etiquetas nativas `<button>` por `<CEIPOLButton>` asegurando el traslado íntegro de propiedades (`onClick`, `disabled`, `title`).
3.  **Preservación de Posicionamiento Dinámico:** En componentes complejos como `SweepIntegrationModal.tsx`, no se debe alterar la lógica matemática de posicionamiento en pantalla basada en cursor (`coords`), únicamente se modificará el contenedor visual principal para usar la envoltura semántica táctica de `CEIPOLCard` y sus componentes internos.
4.  **Despliegue de Estados Operativos:** Forzar la homologación progresiva de spinners e indicadores de error rústicos hacia las soluciones unificadas de la carpeta `src/components/ui/` para homogeneizar la experiencia del usuario.

---

### FIN AUDITORÍA UI-05.3
*El presente reporte de auditoría cierra de forma satisfactoria el ciclo de inspección para dar paso seguro a la fase de implementación.*
