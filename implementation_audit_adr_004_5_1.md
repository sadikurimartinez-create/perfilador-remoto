# INFORME DE AUDITORÍA DE ARQUITECTURA: ADR-004.5.1
## CAPÍTULO 4 – ANÁLISIS ESTADÍSTICO DEL FENÓMENO DELICTIVO
### ECOSISTEMA SAI – CEIPOL / PERFILADOR REMOTO MMAS

---

## 1. RESUMEN EJECUTIVO
Este documento presenta el diagnóstico técnico y la auditoría profunda de la arquitectura actual del **Capítulo 4: Análisis Estadístico del Fenómeno Delictivo** dentro del dictamen del Perfilador Remoto MMAS. 

**Diagnóstico General:** Existe una brecha estructural crítica entre la sofisticación matemática introducida por el nuevo **Statistical Intelligence Engine 2.0 (SIE 2.0 Core)** y la **Statistical Evidence Matrix (SEM)**, y el contenido textual y gráfico que actualmente genera y muestra el Capítulo 4. El capítulo actual sigue operando bajo conceptos y métricas de la **versión 1.0 (V1)**, como el índice de aceleración lineal simple, centros de gravedad descriptivos y elipses direccionales rígidas, ignorando por completo la riqueza metodológica de la agrupación por densidad real (DBSCAN), tendencias robustas no paramétricas (Theil-Sen) y contagio espacio-temporal (Near-Repeat).

Este reporte define la hoja de ruta conceptual para la **reconstrucción completa del Capítulo 4 (ADR-004.5)**, bajo la filosofía institucional de *"Método invisible, operación visible"*, garantizando el consumo directo de la SEM y el acople armónico con el HIE y CIE.

---

## 2. ARQUITECTURA ACTUAL DEL CAPÍTULO 4
La generación del Capítulo 4 se divide en tres capas funcionales en la plataforma:

1.  **Capa de Texto Narrativo:** El orquestador `reportEngine.ts` invoca a Gemini utilizando el prompt `GraphAnalysisPrompt` definido en `src/prompts/reportEnginePrompts.ts`. Este prompt inyecta el JSON del motor estadístico y genera la variable `statsText`.
2.  **Capa Visual (PDF):** En `src/utils/intelligenceLayoutEngine.ts`, se crea de manera independiente una página para cada gráfica del array `payload.graphs`, mapeando campos de hallazgo, explicación y relación operativa.
3.  **Capa Editorial (Word):** En `src/lib/exportToWord.ts` (líneas 664-725), se escribe el título del capítulo, el cuerpo de texto principal y se renderiza un flujo dinámico de imágenes y bloques tabulados de "Hallazgo - Interpretación - Implicación".

---

## 3. MAPEO DEL FLUJO DE DATOS ACTUAL

### 3.1. Matriz de Componentes e Integración de Datos

| Componente | Variable Crítica | Archivo Origen | Consumidor | Estado Actual en Cap. 4 |
| :--- | :--- | :--- | :--- | :---: |
| **TCE** | Coordenadas y Radio | `src/lib/reportEngine.ts` | Gemini Prompt | **Integrado** (Inyectado en texto) |
| **SIE V1** | Métricas Lineales y Elipses | `src/utils/statisticalIntelligenceEngine.ts` | `reportEngine.ts` / Prompt | **Obsoleto** (Sigue guiando el texto) |
| **SIE 2.0** | DBSCAN, Theil-Sen, Near-Repeat | `src/utils/statisticalIntelligenceEngineV2/` | ACE Quality Gate | **Ausente** (No se inyecta en el prompt) |
| **SEM** | Evidencia Estadística | `src/utils/statisticalEvidenceMatrix/` | ACE Quality Gate | **Ausente** (No alimenta la narrativa) |
| **ACE** | Estatus, Confianza, Alertas | `src/utils/analyticalConsistencyEngine/` | `reportEngine.ts` | **Parcial** (Valida consistencia externa) |
| **HIE** | Hipótesis Textual Adaptada | `src/components/PhotoAlbum.tsx` | `reportEngine.ts` | **Ausente** (No influye en el análisis) |
| **CIE** | Hotspots Cartográficos | `src/components/AnalysisMap.tsx` | Layout Engine / PDF | **Parcial** (Gráficos independientes) |

### 3.2. Procesamiento e Inconsistencia Analítica
*   **Duplicidad:** Actualmente no existe duplicidad severa de cálculo de backend, pero sí una **desconexión analítica**. El core matemático calcula DBSCAN y Theil-Sen de alta precisión, pero el prompt que genera el texto de inteligencia (`GraphAnalysisPrompt`) exige que Gemini redacte párrafos descriptivos sobre la Elipse Direccional y el Índice de Aceleración Lineal (V1). Esto obliga al modelo de lenguaje a "alucinar" o forzar interpretaciones de variables desactualizadas.

---

## 4. AUDITORÍA DEL MOTOR ESTADÍSTICO ACTUAL (BRECHAS MÉTRICAS)

### 4.1. Indicadores Temporales
*   **Estado Actual:** Se describe la tendencia mediante un "Índice de Aceleración" lineal (comparativa de deltas mes a mes).
*   **Problema:** Altamente sensible a valores atípicos temporales (ruido) y no paramétrico.
*   **Brecha:** El estimador robusto de **Theil-Sen** con nivel de confianza del 95% calculado por el SIE 2.0 está completamente ausente en el Capítulo 4.

### 4.2. Indicadores Espaciales
*   **Estado Actual:** Utiliza el "Centro de Gravedad (Mean Center)" y las dimensiones físicas de la elipse de desviación estándar espacial.
*   **Problema:** La elipse direccional es un modelo geométrico rígido que asume una distribución normal del delito. En criminología ambiental, el delito es altamente focalizado y sigue redes viales o nodos atractores, no elipses perfectas.
*   **Brecha:** Los hotspots de densidad agrupados por **DBSCAN** con precisión Haversine y métricas de entropía real están ausentes de la narrativa.

### 4.3. Indicadores Predictivos
*   **Estado Actual:** Un índice predictivo determinista lineal de riesgo de repetición.
*   **Problema:** Carece de sustento probabilístico real y asume comportamiento constante.
*   **Brecha:** No se consume la probabilidad frecuencial de **Poisson con test de bondad Chi-Cuadrada**, ni se explota la tasa de contagio espacio-temporal de **Near-Repeat** que calcula el motor matemático.

---

## 5. AUDITORÍA DE GRÁFICOS DEL CAPÍTULO 4

| Gráfica Actual | Objetivo Actual | Fuente de Datos | Valor Analítico | Problema Detectado | Recomendación de Cambio (ADR-004.5) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Análisis Temporal** | Mostrar frecuencia semanal/mensual. | SIE V1 | Alto | Simple conteo descriptivo de barras, sin umbrales de anomalías ni estacionalidad. | **Conservar y mejorar:** Integrar líneas de estacionalidad e índices críticos provenientes de `SEM.temporalEvidence`. |
| **2. Topología de Delito** | Mostrar ranking de tipos penales. | SIE V1 | Medio-Alto | Barras saturadas cuando hay alta dispersión de giros de bajo impacto. | **Sustituir:** Enfocar en delitos dominantes vs secundarios parametrizados en `SEM.criminalEvidence`. |
| **3. Ambiental (Atractores)**| Mostrar correlación con negocios. | DENUE/OSINT | Alto | Es meramente descriptiva, no realiza correlación cruzada matemática. | **Mejorar:** Mostrar la matriz de densidad de atractores contra la tasa de concentración de los hotspots DBSCAN. |
| **4. Gráfica Predictiva** | Proyectar riesgo futuro. | Modelo lineal | Bajo | Es una proyección matemática lineal irreal que asume predictibilidad absoluta. | **Reemplazar Completamente:** Sustituir por la curva de distribución probabilística de Poisson (Riesgo Semanal) y zonas de influencia Near-Repeat. |

---

## 6. AUDITORÍA EDITORIAL: "MÉTODO INVISIBLE, OPERACIÓN VISIBLE"

Actualmente el Capítulo 4 peca de tecnicismo abstracto (V1) que no ayuda al tomador de decisiones tácticas en campo (patrulleros, mandos medios):

*   **Lo que DEBE DESAPARECER del Capítulo 4:**
    *   Definiciones sobre cómo se calcula el "Mean Center" o la desviación estándar espacial.
    *   Fórmulas de regresión o elipsis.
    *   Explicaciones conceptuales académicas de probabilidad Poisson.
    *   Mención de parámetros internos de calibración matemática (ej. *epsilon* de DBSCAN, coeficientes, *minPoints*).
*   **Lo que DEBE PERMANECER y FORTALECERSE:**
    *   **Hallazgos Operativos:** "Existe un hotspot de hiper-concentración delictiva que acumula el 45% de los robos del sector en una manzana específica."
    *   **Ventanas Tácticas de Oportunidad:** "El riesgo es crítico los lunes y jueves de 18:00 a 20:00 hrs."
    *   **Facilitadores de Riesgo:** "La alta concentración de comercios del DENUE actúa como el atractor principal de afluencia."
    *   **Riesgo Predictivo Práctico:** "Existe una probabilidad del 92.9% de que ocurra al menos un incidente en la ventana crítica de la siguiente semana."

---

## 7. EVALUACIÓN DE ACORDE A LA NUEVA ARQUITECTURA SAI

| Dimensión Nueva Arquitectura | Integrado | Parcial | Ausente | Comentarios / Plan de Acción |
| :--- | :---: | :---: | :---: | :--- |
| **SEM: criminalEvidence** | | | **X** | Se debe erradicar la contabilidad paralela. Capítulo 4 consumirá directamente delitos dominantes de la SEM. |
| **SEM: temporalEvidence** | | | **X** | La narrativa describirá la tendencia robusta de Theil-Sen (Slope/Direction) y estacionalidad de la SEM. |
| **SEM: spatialEvidence** | | | **X** | Se eliminará la elipse direccional; la narrativa describirá los hotspots y clusters calculados por DBSCAN. |
| **SEM: predictiveEvidence** | | | **X** | Se describirá la probabilidad de Poisson validada con Chi-Square y el contagio por proximidad Near-Repeat. |
| **ACE: Calidad y Confianza** | | **X** | | El Quality Gate actualmente audita y rechaza, pero la confianza global (ej. 100%) debe inyectarse en el texto del reporte. |
| **HIE: Acople de Hipótesis** | | | **X** | El Capítulo 4 debe confrontar el modelo cuantitativo con la hipótesis cualitativa mapeada en el adaptador. |
| **CIE: Sincronía Cartográfica**| | **X** | | Sincronización robusta: el texto y los mapas del CIE deben reportar exactamente las mismas ubicaciones de hotspots. |

---

## 8. IDENTIFICACIÓN DE RIESGOS

### 8.1. Riesgos Técnicos
*   **Duplicidad Analítica:** Mantener prompts paralelos que forzan a Gemini a recalcular promedios o recontar incidentes, lo cual introduce sesgos y alucinaciones numéricas no deterministas.
*   **Ruptura del Quality Gate:** Que el texto del Capítulo 4 afirme datos temporales o espaciales distintos a los que la SEM y el CIE validaron, disparando estatus `FAILED` o `WARNING` en el ACE.

### 8.2. Riesgos Editoriales y Metodológicos
*   **Saturación Académica:** Llenar el dictamen de tecnicismos matemáticos complejos, diluyendo la utilidad táctica del reporte y provocando desinterés en el lector final (mando operativo).
*   **Determinismo Predictivo:** Presentar las proyecciones de probabilidad (Poisson) como certezas absolutas, restando credibilidad al modelo estadístico cuando no se verifiquen exactamente en campo.

---

## 9. PROPUESTA DE NUEVA ESTRUCTURA DEL CAPÍTULO 4 (ADR-004.5)

Se propone una reconstrucción conceptual integral del Capítulo 4 basada en **máximo 2 páginas** de narrativa ejecutiva y **2 gráficos de alto valor analítico-operativo**, con los siguientes apartados normados:

### Apartados Narrativos (2 Páginas Máximo)
1.  **4.1. Dinámica Temporal de Oportunidad**
    *   *Contenido:* Tendencia robusta (Theil-Sen), tasa de cambio (Slope), estacionalidad crítica y picos anómalos. Consume directamente `SEM.temporalEvidence`.
2.  **4.2. Patrón de Distribución y Focalización Espacial**
    *   *Contenido:* Identificación de hotspots basados en densidad real (DBSCAN), tasa de concentración y baricentros operativos. Consume directamente `SEM.spatialEvidence`.
3.  **4.3. Escenarios de Riesgo Predictivo y Contagio**
    *   *Contenido:* Probabilidad de ocurrencia periódica (Poisson) con su confianza analítica, vinculada a la tasa de contagio espacio-temporal de Near-Repeat. Consume directamente `SEM.predictiveEvidence`.

### Gráficos Ideales Integrados (Fuera del conteo narrativo)
1.  **Gráfico 1: Curva de Frecuencia Temporal con Línea de Estacionalidad:** Un histograma dinámico que ilustra la frecuencia real de incidentes empalmado con el índice de estacionalidad de la SEM.
2.  **Gráfico 2: Radar de Concentración Horaria y Turnos Críticos:** Un diagrama radial compacto que sintetiza de un vistazo la ventana táctica de patrullaje (horas y días de la semana de máxima concentración de riesgo).

---

## 10. RECOMENDACIÓN FINAL Y DICTAMEN

### 🔴 DICTAMEN: REHACER COMPLETAMENTE (CAPÍTULO 4)

El diagnóstico analítico y arquitectónico determina que mantener la estructura actual del Capítulo 4 es inviable bajo la nueva arquitectura MMAS 2.0. El acople parcial generaría una severa contradicción analítica persistente, la cual sería detectada y rechazada por el Quality Gate del ACE.

**Recomendación:** Proceder de inmediato con el **ADR-004.5 (Reconstrucción del Capítulo 4)** para:
1.  Sustituir por completo el prompt `GraphAnalysisPrompt` para que consuma de forma exclusiva la estructura unificada de la **SEM** y la confianza de auditoría del **ACE**.
2.  Ajustar el mapeo de gráficos del Layout Engine para soportar los dos nuevos esquemas visuales de alta densidad operacional.
3.  Refactorizar la exportación a Word de manera que renderice la nueva estructura narrativa compacta y libre de elipses de desviación.
