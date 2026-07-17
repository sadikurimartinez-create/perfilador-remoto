# Auditoría de Componentes Globales del Perfilador Remoto — UI-05.4

**Gobernanza UX / CEIPOL Design System**  
**Proyecto:** Perfilador Remoto SSPE-CEIPOL  
**Área de Intervención:** Ecosistema Global fuera del módulo `PhotoAlbum.tsx`  
**Estado:** ✅ **AUDITORÍA COMPLETADA / DIAGNÓSTICO EMITIDO**

---

# 1. Resumen Ejecutivo

Con la conclusión y certificación total de las intervenciones estéticas sobre el módulo de fotografía (`PhotoAlbum`), se inicia de manera formal la fase de **Auditoría Global de Componentes (UI-05.4)**. Este dictamen representa el diagnóstico integral de la capa de presentación global del sistema, localizando áreas con deuda visual acumulada, elementos heredados del maquetado inicial que no están en línea con el **CEIPOL Design System** y componentes aislados listos para ser homologados bajo la estructura glassmorphic táctica.

De estricto acuerdo con la **Regla de Oro de la Gobernanza UI-05.4**, no se ha modificado ni una sola línea de código lógico, operacional o funcional de la base del proyecto durante esta fase, garantizando la preservación completa de la lógica de negocio, bases de datos Firebase/Firestore y APIs de backend.

---

# 2. Alcance Revisado

El alcance de este barrido de auditoría abarca la totalidad de las rutas de usuario y componentes clave situados fuera de la jurisdicción directa de `PhotoAlbum.tsx`:
*   **Componentes de Gestión Core:** `ProjectList.tsx`, `ProjectManager.tsx`, `CaptureAndAddPhoto.tsx`.
*   **Paneles de Datos y Módulos Analíticos:** `ExecutiveDashboard.tsx`, `CifaCeipolPanel.tsx`, `OsintTerritorialPanel.tsx`, `AnalysisMap.tsx`.
*   **Estructura de Ruteo y Páginas:** `src/app/page.tsx`, `src/app/dashboard/page.tsx`, y barras de navegación globales.

---

# 3. Componentes Auditados

Se analizó la distribución de archivos de interfaz interactiva, registrando el conteo y la tipología de controles nativos que deben ser homologados a componentes de diseño de soporte:

1.  **`ProjectList.tsx` (30 botones planos / 4 modales heredados / 12 alertas):** Es el componente de mayor criticidad y prioridad de intervención. Contiene la lista general de expedientes de la central y expone modales rústicos de administración (Renombrar, Borrar, Archivar y Reactivar) que rompen la estética de cristal oscuro.
2.  **`ProjectManager.tsx` (4 botones planos / 6 alertas nativas):** Orquestador general del expediente de un proyecto individual. Requiere unificar las llamadas nativas de guardado e interacción de cambios a cuadros del Design System.
3.  **`ExecutiveDashboard.tsx` (1 botón inline / 3 tarjetas de fondo plano):** Panel de monitoreo de telemetría y métricas para perfiles ejecutivos. Posee cajas sólidas sin difuminado institucional y controles con paletas de color púrpuras duras no normalizadas.
4.  **`CaptureAndAddPhoto.tsx` (3 botones táctiles de color plano):** Interfaz móvil de captura de evidencias en campo. Los botones de disparo y guardado local utilizan fondos de Tailwind directos no cohesivos con el estándar institucional.

---

# 4. Hallazgos Visuales Detallados

### A. Botones Heredados y Controles Interactivos
Se detectaron más de 60 ocurrencias de botones nativos HTML `<button>` estilizados de manera ad-hoc con clases directas de Tailwind. Estos elementos impiden la consistencia táctil y la micro-animación homogénea del sistema. Deberán ser reemplazados en fases de desarrollo por el estándar `<CEIPOLButton>` en las siguientes modalidades:
*   *Acción Primaria (Guardar, Reasignar):* `CEIPOLButton` con variante `primary` o `confirm`.
*   *Acción Destructiva (Borrar, Purgar):* `CEIPOLButton` con variante `danger`.
*   *Acción de Cierre/Regresar:* `CEIPOLButton` con variante `secondary`.

### B. Sistema de Modales y Superposiciones (Overlays)
Los modales de edición administrativa dentro de `ProjectList` utilizan un contenedor básico plano (`bg-slate-900 border border-slate-800`). El objetivo es elevarlos hacia la experiencia visual certificada en PhotoAlbum, aplicando un cristal difuminado translúcido de alta inmersión:
```tsx
bg-slate-950/95 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-2xl
```

### C. Alertas y Cuadros de Diálogo Nativos
Se detectó un uso recurrente de la API nativa de JavaScript (`window.alert()` y `window.confirm()`) para control de mensajes de éxito, advertencias y confirmaciones de riesgo crítico. Esto rompe la integración de la estética oscura CEIPOL. Se propone su redirección hacia llamadas de `CEIPOLToast` o disparadores de confirmación visual integrados.

---

# 5. Deuda Técnica UX Categorizada

A continuación se resume la deuda técnica visual identificada y clasificada por severidad:

*   **Severidad Crítica:**
    *   Modales de control de expedientes de `ProjectList.tsx` usando bloques sólidos de colores sin difuminado institucional ni consistencia de cabeceras.
    *   Campos de selección nativos HTML rústicos dentro de los modales de borrado y archivado.
*   **Severidad Media:**
    *   Llamadas nativas de `alert` para notificar guardados exitosos y errores en el orquestador `ProjectManager.tsx`.
    *   Botones de captura de cámara en `CaptureAndAddPhoto.tsx` que utilizan colores morados e índigos independientes ajenos al sistema cromático de la corporación.
*   **Severidad Baja:**
    *   Controles estáticos de telemetría INEGI que utilizan un diseño de grilla simple sin los tokens de espaciado regulados en `tokens.ts`.

---

# 6. Riesgos Identificados

1.  **Riesgo de Regresión de Flujos en `ProjectList` (Medio):** Modificar la maquetación de los modales de borrado y archivado en la lista general de expedientes requiere extrema cautela para no romper la propagación de eventos, los callbacks de re-lectura (onSnapshot) y las llamadas directas de mutación hacia Firestore.
2.  **Riesgo de Compatibilidad de Componentes Móviles (Bajo):** El rediseño de los botones táctiles de captura en `CaptureAndAddPhoto.tsx` debe validar que se mantenga el correcto desencadenamiento del input de cámara en dispositivos móviles iOS y Android.

---

# 7. Priorización de Intervenciones

Se recomienda ejecutar la modernización de los componentes en las siguientes etapas secuenciales de gobernanza:

1.  **Prioridad 1 (Fase UI-05.5.A) — Modernización de Modales y Lista en `ProjectList.tsx`:** Sustitución de los 4 modales administrativos e integración de botones `CEIPOLButton` en la pantalla principal de selección.
2.  **Prioridad 2 (Fase UI-05.5.B) — Homologación de Alertas y Cabecera de `ProjectManager.tsx`:** Remoción de alertas de navegador para reemplazarlas por el componente institucional `CEIPOLToast`.
3.  **Prioridad 3 (Fase UI-05.5.C) — Refactorización Estética de Consolas y Captura:** Unificación visual de `ExecutiveDashboard.tsx` and `CaptureAndAddPhoto.tsx` bajo el esquema de diseño establecido.

---

# 8. Plan Recomendado de Implementación

Para cada componente prioritario, las fases de trabajo del plan de homologación futura deberán respetar rigurosamente la secuencia técnica del proyecto:
1.  **Pre-Auditoría Técnica:** Levantamiento de líneas exactas a modificar e inspección de props.
2.  **Maquetación Visual Pura:** Reemplazo de etiquetas y aplicación de clases HSL y glassmorphism.
3.  **Verificación Estricta:** Comprobación estricta de compilado (`npx tsc --noEmit`) y construcción de distribución en producción (`npm run build`) para garantizar un estado limpio con **0 errores**.
4.  **Cierre y Certificación:** Revisión formal y firma del Comité Técnico para congelar el componente bajo la directiva de gobernanza.
