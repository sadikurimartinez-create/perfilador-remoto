# ADR-012-AUDIT-REPORT: Geo Integrity & Anti-Fallback Location Architecture

## Estado: AUDITORÍA FINALIZADA / REVISIÓN REQUERIDA
**Autor**: Antigravity (AI Pair Programmer)  
**Fecha**: 2026-07-17  
**Contexto Institucional**: SSPE-CEIPOL, Perfilador Remoto v14.0  

---

## 1. Hallazgo Principal

Durante la auditoría técnica de geointeligencia (**FASE 8 — AUDITORÍA GEOINT**), se identificó un **comportamiento de contaminación silente crítico**: el sistema utiliza por defecto coordenadas de escape rígidas correspondientes al centro urbano de Aguascalientes (`latitude: 21.8853`, `longitude: -102.2916`) cuando un expediente no posee ubicación geográfica válida. 

Este comportamiento "oculta" la ausencia de georreferenciación y contamina de forma sistemática todas las capas de análisis automatizado de los motores del sistema (GEOINT, DENUE, SCINCE, Street View) y las consultas a las APIs externas (Google Places, NASA, Copernicus, etc.), haciendo creer al usuario que los datos presentados pertenecen al expediente cuando en realidad corresponden al centro de Aguascalientes.

---

## 2. Archivos Afectados (Localización Exacta del Fallback)

La auditoría del código fuente localizó el uso rígido de las coordenadas de Aguascalientes (`21.8853`, `-102.2916`) en los siguientes módulos clave:

### A. Motores Analíticos y de Layout (Backend / Servidor)
*   **[territorialContextEngine.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/territorialContextEngine.ts#L87-L88)**: 
    ```typescript
    const lat = typeof input.lat === "number" && isFinite(input.lat) ? input.lat : 21.8853;
    const lng = typeof input.lng === "number" && isFinite(input.lng) ? input.lng : -102.2916;
    ```
*   **[cartographicIntelligenceEngine.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/cartographicIntelligenceEngine.ts#L241-L242)**: 
    ```typescript
    const lat = tContext.latitude || 21.8853;
    const lng = tContext.longitude || -102.2916;
    ```
    Y en la extracción de hotspots simulados (Líneas 308-309):
    ```typescript
    const lat = tContext.latitude || 21.8853;
    ```
*   **[intelligenceLayoutEngine.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/intelligenceLayoutEngine.ts#L965-L966)**: 
    ```typescript
    const epicenterLat = project?.latitude || 21.8853;
    const epicenterLng = project?.longitude || -102.2916;
    ```

### B. Contexto de Datos y Sincronizadores
*   **[ProjectContext.tsx](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/context/ProjectContext.tsx#L1278-L1279)**: 
    En la georreferenciación de barridos de evidencias, si no se detectan coordenadas se recurre por defecto al proyecto o a las coordenadas rígidas:
    ```typescript
    latVal = (project as any).latitude || 21.8853;
    lngVal = (project as any).longitude || -102.2916;
    ```
*   **[syncGangs.js](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/scripts/syncGangs.js#L109-L110)**:
    Si la coordenada del integrante de la pandilla en Excel es inválida, se asigna Aguascalientes centro:
    ```javascript
    lat: isNaN(latVal) ? 21.8853 : latVal,
    lng: isNaN(lngVal) ? -102.2916 : lngVal,
    ```

### C. Proveedores de APIs Externas (Data Providers)
Prácticamente la totalidad de los proveedores en `src/lib/providers/` cargan las coordenadas de Aguascalientes como fallback implícito en su método `fetchData` si los parámetros lat/lng vienen vacíos. Los archivos son:
1.  `cenapredProvider.ts` (Líneas 32-33)
2.  `conaguaProvider.ts` (Líneas 32-33)
3.  `copernicusProvider.ts` (Líneas 32-33)
4.  `facebookProvider.ts` (Líneas 69-70)
5.  `googleProvider.ts` (Líneas 57-58)
6.  `hydroFusionProvider.ts` (Líneas 80-81)
7.  `inegiProvider.ts` (Líneas 34-35)
8.  `inegi_wms_provider.ts` (Líneas 195-196)
9.  `instagramProvider.ts` (Líneas 69-70)
10. `nasaProvider.ts` (Líneas 32-33)
11. `noaa_provider.ts` (Líneas 43-44)
12. `redditProvider.ts` (Líneas 73-74)
13. `telegramProvider.ts` (Líneas 77-78)
14. `tomorrowIoProvider.ts` (Líneas 34-35 y 202)
15. `usgsProvider.ts` (Líneas 32-33)
16. `xProvider.ts` (Líneas 71-72)

### D. Interfaz Gráfica (Frontend)
*   **[ProjectMap.tsx](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/components/ProjectMap.tsx#L180)**: 
    Para evitar centrar mapas en áreas vacías, el visor realiza un filtrado y detecta si es Aguascalientes por defecto (`isProjectDefault`), cayendo al centro de Aguascalientes como último recurso base.

---

## 3. Expedientes Afectados (Diagnóstico Real)

Ejecutamos el script de diagnóstico exhaustivo conectando directamente a Firestore REST API (`scripts/audit_geo_integrity.ts`). El resultado fue:

*   **Total de expedientes en Firestore**: 14
*   **Ubicaciones válidas**: 0 (0.0%)
*   **Ubicaciones fallback (Aguascalientes Centro)**: 0 (0.0% almacenadas como tal)
*   **Ubicaciones vacías (`latitude: null`, `longitude: null`)**: 14 (100.0%)
*   **Ubicaciones duplicadas o sospechosas**: 0 (0.0%)

### Conclusión del Diagnóstico:
**El 100% de los expedientes activos (14 de 14) están contaminados por el fallback de Aguascalientes.** Al no tener coordenadas geográficas registradas en la base de datos Firestore, el sistema activa por defecto las coordenadas rígidas de Aguascalientes en cada ejecución de mapas, análisis territorial, DENUE y Street View. 

---

## 4. Clasificación de Riesgo: CRÍTICO

El riesgo de este comportamiento es **CRÍTICO** debido a que:
1.  **Induce a error metodológico**: Los investigadores reciben informes que afirman poseer datos y gráficos territoriales de Street View o DENUE, cuando en realidad se están analizando comercios y calles del centro de Aguascalientes.
2.  **Inconsistencia de Datos**: Al exportar reportes de expedientes de otras latitudes o municipios, los capítulos territoriales se llenan de forma errónea con información de Aguascalientes, violando la integridad de las pruebas periciales.
3.  **Llamadas a APIs Inútiles**: Se consumen cuotas de las APIs externas para coordenadas repetidas por defecto.

---

## 5. Estrategia de Solución Propuesta (Criterio de Entrada a Fase 8.5)

Para sanar por completo el sistema sin comprometer su robustez frente a fallos, implementaremos la siguiente arquitectura en la próxima fase:

1.  **Introducción del Tipo `GeoLocation`**:
    ```typescript
    export interface GeoLocation {
      latitude: number | null;
      longitude: number | null;
      confidence: "VERIFIED" | "DERIVED" | "UNKNOWN";
      source: "GPS" | "MAP_SELECTION" | "USER_INPUT" | "NONE";
      locationAuditStatus?: "PENDING" | "VERIFIED" | "INVALID";
    }
    ```
2.  **Bloqueo de Fallback Implícito**: Reemplazar todas las asignaciones directas de `|| 21.8853` o `|| -102.2916` por una verificación explícita. Si no hay coordenadas, el estado de ubicación es `UNKNOWN` / `NONE`.
3.  **UI Adaptativa**: Si el estado es `UNKNOWN`, la interfaz de mapas y los bloques del reporte mostrarán un mensaje solicitando al analista georreferenciar el expediente en el mapa, en lugar de renderizar de manera ficticia.
