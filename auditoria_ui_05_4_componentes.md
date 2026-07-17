# Matriz de Componentes Globales Auditados — UI-05.4

Este documento detalla el estado actual, el tipo de deuda visual y la prioridad de intervención de los componentes globales fuera del módulo `PhotoAlbum.tsx` bajo el esquema de gobernanza del **CEIPOL Design System**.

---

# 1. Matriz de Mapeo y Clasificación

| Componente | Archivo / Ubicación | Estado Visual Actual | Deuda Visual Identificada | Prioridad | Clasificación |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ProjectList** | `src/components/ProjectList.tsx` | ⏳ Pendiente | Alta concentración de botones HTML planos (30), llamadas a `window.alert`/`confirm` nativas, y 4 modales internos (`renameModal`, `deleteModal`, `archiveModal`, `reactivateModal`) usando la estética anterior de gris opaco. | 🔥 **CRÍTICA** | **MIGRACIÓN FUTURA** |
| **ProjectManager** | `src/components/ProjectManager.tsx` | ⏳ Pendiente | Uso de alertas nativas del navegador para éxitos/errores y botones de guardado que no usan consistentemente `<CEIPOLButton>`. | ⚡ **MEDIA** | **MIGRACIÓN FUTURA** |
| **ExecutiveDashboard** | `src/components/ExecutiveDashboard.tsx` | ⏳ Pendiente | Tarjetas con fondos planos (`bg-slate-800`), y botones de entrenamiento IA con estilos inline y colores fuera de paleta (`bg-purple-700`). | ⚡ **MEDIA** | **MIGRACIÓN FUTURA** |
| **CaptureAndAddPhoto** | `src/components/CaptureAndAddPhoto.tsx` | ⏳ Pendiente | Botones nativos interactivos de captura y subida con clases duras de Tailwind (`bg-purple-900/30`, `bg-indigo-900/30`) e indicadores de carga inline planos. | ⚡ **MEDIA** | **MIGRACIÓN FUTURA** |
| **CifaCeipolPanel** | `src/components/CifaCeipolPanel.tsx` | ⏳ Pendiente | Indicadores de carga e hilos de espera que usan texto simple con animaciones pulsantes nativas en lugar de componentes estándar `CEIPOLLoader` o `CEIPOLButton` reactivos. | 💤 **BAJA** | **MIGRACIÓN FUTURA** |
| **OsintTerritorialPanel** | `src/components/OsintTerritorialPanel.tsx` | ⏳ Pendiente | Gran cantidad de botones nativos HTML (16) y secciones de visualización de datos sin tarjetas normalizadas. | 💤 **BAJA** | **MIGRACIÓN FUTURA** |
| **AnalysisMap** | `src/components/AnalysisMap.tsx` | ⏳ Pendiente | Controladores de mapas e indicadores de vértices con clases duras de Tailwind en lugar del estándar visual. | 💤 **BAJA** | **MIGRACIÓN FUTURA** |
| **ProjectMap** | `src/components/ProjectMap.tsx` | 🔒 **CERTIFICADO** | Componente estable, alineado con capas de mapa oscuras y visuales correctas. | — | **CERTIFICADO** |
| **SweepIntegrationModal**| `src/components/SweepIntegrationModal.tsx` | 🔒 **CERTIFICADO** | Componente estable, homologado en la fase UI-05.3.B.2. | — | **CERTIFICADO** |
| **DynamicPopup** | `src/components/DynamicPopup.tsx` | 🔒 **CERTIFICADO** | Componente estable, homologado en la fase UI-05.3.B.1. | — | **CERTIFICADO** |

---

# 2. Resumen de Métricas de Deuda Visual

*   **Botones Planos Detectados:** **60+ botones** nativos HTML `<button>` dispersos en los componentes principales (destacando 30 en `ProjectList` y 16 en `OsintTerritorialPanel`).
*   **Modales No Homologados:** **4 modales internos** en `ProjectList` que requieren migración a la estructura glassmorphic con desenfoque de fondo.
*   **Alertas Nativas (`window.alert` / `window.confirm`):** **18 llamadas directas** detectadas en `ProjectList` y `ProjectManager`, representando una ruptura en la consistencia de la experiencia de usuario.
*   **Cargas No Estructuradas:** **5 indicadores** de carga basados en texto simple o clases `animate-pulse` personalizadas en lugar del componente normalizado `CEIPOLLoader`.
