# ADR-008.3: PLAN DE IMPLEMENTACIÓN FÍSICA DEL GANG INTELLIGENCE MODULE (GIM)
## Ecosistema Perfilador CEIPOL — SSPE Aguascalientes

---

## 1. Estado del ADR
*   **Identificador:** `ADR-008.3`
*   **Relacionado con:** [ADR-008.2](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/adr_008_2_actualizacion_diseno_gim.md)
*   **Estado:** 🟢 **APROBADO PARA DESARROLLO CONTROLADO**
*   **Rol de Autoría:** Arquitecto Senior de Software & Líder Técnico
*   **Ecosistema:** Perfilador CEIPOL

---

## 2. Alcance de Implementación

El alcance de este plan técnico define de forma clara y delimitada las fronteras físicas de la codificación para asegurar que el desarrollo del GIM sea aislado, seguro y libre de regresiones.

### Qué INCLUYE el Desarrollo:
1.  **Creación del Módulo GIM:** Implementación de la carpeta dedicada `src/utils/gangIntelligenceEngine/` y sus archivos internos.
2.  **Contratos y Tipos:** Modelos TypeScript robustos que definan formalmente el `GangEvidenceMatrix` (GEM).
3.  **Integración IIC:** Actualización del contrato de datos unificados, el compilador de contexto y el registro de capacidades del cuadrante.
4.  **Validadores de Capa 1:** Implementación de reglas locales de calidad de datos y filtros geográficos perimetrales de Haversine.
5.  **Adaptador HIE:** Creación del convertidor de tipos `gimToHieAdapter.ts` para retrocompatibilidad.
6.  **Integración de Capa 2 (ACE):** Programación del validador de consistencia cruzada narrativa en `ConsistencyValidators.ts`.
7.  **Acoplamiento en el Report Engine:** Conexión del flujo de datos con el generador de páginas del Capítulo 8.
8.  **Suite de Pruebas Unitarias:** Creación del archivo de pruebas tácticas automatizadas cubriendo los flujos esenciales.

### Qué NO INCLUYE el Desarrollo:
*   ❌ **Modificación del HIE Interno:** Está prohibido alterar una sola línea de lógica o peso matemático en `hypothesisIntelligenceEngine.ts`.
*   ❌ **Procesamiento de Imágenes Primario:** No se escribirán clasificadores de imagen en GIM; se consumirá de forma pasiva la clasificación del VEE.
*   ❌ **Cambios de Maquetación o Nuevos Capítulos:** El layout institucional de 12 páginas es inamovible; GIM se inyectará en el espacio pre-reservado en el Capítulo 8.
*   ❌ **Alteración de Estilos de Exportación:** No se modificará el estilo de los componentes visuales de Word o PDF, únicamente se proveerá la narrativa estructurada de datos.

---

## 3. Archivos Autorizados a Crear

La programación física se limitará estrictamente a los siguientes archivos nuevos dentro del directorio encapsulado:

```
src/utils/gangIntelligenceEngine/
│
├── models/
│    └── gangIntelligenceTypes.ts         # Contratos de datos, tipos e interfaces TypeScript del GIM
│
├── gangIntelligenceEngine.ts             # Orquestador del motor y punto de entrada de procesamiento
│
├── gangEvidenceBuilder.ts                # Procesador analítico que unifica indicios en la matriz GEM
│
├── gangEvidenceValidator.ts              # Validador de Capa 1 (coherencia local y calidad formal)
│
├── gangOsintAnalyzer.ts                  # Analizador de indicios y reportes de fuentes abiertas OSINT
│
├── graffitiTerritorialAnalyzer.ts        # Analizador de simbología (Lee datos del VEE, no imágenes)
│
├── gimEvidenceTraceability.ts            # Libro de trazabilidad de procedencia de la evidencia
│
├── adapters/
│    └── gimToHieAdapter.ts               # Adaptador de retrocompatibilidad GEM -> linkedGangReport
│
├── index.ts                              # Exportaciones públicas de la API del módulo
│
└── tests/
     └── gangIntelligence.test.ts         # Suite de pruebas unitarias tácticas automatizadas
```

---

## 4. Archivos Autorizados a Modificar

Solo se autoriza la modificación de los siguientes componentes del núcleo del Perfilador para acoplar el módulo bajo los contratos del ADR-008.2:

| Archivo | Tipo de modificación | Motivo / Descripción Técnica |
| :--- | :---: | :--- |
| **`src/utils/intelligenceIntegrationContract/models/intelligenceContextTypes.ts`** | Interfaz | Inyectar el tipo opcional `GIM: GangEvidenceMatrix \| null` dentro de la interfaz principal de `evidenceSources`. |
| **`src/utils/intelligenceIntegrationContract/capabilityRegistry.ts`** | Lógica de Negocio | Actualizar `getCapabilityStatus` para calcular y declarar disponible la capacidad de inteligencia de pandillas (`gangIntelligence: boolean`) basándose en si la GEM tiene indicios válidos. |
| **`src/utils/intelligenceIntegrationContract/intelligenceContextBuilder.ts`** | Lógica de Negocio | Inyectar `gimData` de forma inmutable durante la compilación y ensamblado del `IntelligenceIntegrationContext`. |
| **`src/utils/analyticalConsistencyEngine/consistencyValidators.ts`** | Validación Transversal | Implementar el método de Capa 2 `validateGangConsistency()` para auditar lenguaje institucional, sesgos y activar veto del reporte. |
| **`src/lib/reportEngine.ts`** | Integración del Kernel | Inyectar la matriz GEM del contexto unificado al `editorialPayload` durante el paso de validación y transitar el estado del motor a `VALIDATED`. |
| **`src/utils/intelligenceLayoutEngine.ts`** | Integración Editorial | Mapear la narrativa generada en 4 partes del GIM directamente a la propiedad pre-reservada `payload.pandillasAnalysis` que renderiza el Capítulo 8. |

---

## 5. Archivos Estrictamente Prohibidos de Modificar

Con el objetivo de blindar el ecosistema ante regresiones y roturas analíticas, queda estrictamente prohibida la alteración de los siguientes módulos:

*   ❌ **`src/utils/hypothesisIntelligenceEngine.ts`** (El motor de hipótesis criminológicas no debe conocer la estructura interna del GIM, solo interactúa mediante el adaptador).
*   ❌ **`src/utils/visualEvidenceEngine/`** (No se altera la captura de fotos, la carga en Firebase ni el procesador primario `graffitiDetector.ts`).
*   ❌ **Sistemas de Autenticación y Seguridad** (`firebase.ts`, lógica de usuarios).
*   ❌ **Módulos de Gestión de Usuarios y Permisos**.
*   ❌ **`exportToWord.ts` u otros motores de exportación** (Los exportadores consumen pasivamente el payload editorial estructurado sin enterarse del origen de los datos).

---

## 6. Orden Obligatorio de Implementación

Para mitigar riesgos y facilitar la integración continua, el equipo de desarrollo debe seguir la siguiente secuencia cronológica de hitos:

```
                  ┌──────────────────────────────────────────┐
                  │ FASE 1: Modelos y Contratos (Types)      │
                  └────────────────────┬─────────────────────┘
                                       │
                  ┌────────────────────▼─────────────────────┐
                  │ FASE 2: Construcción Interna (Analyzers) │
                  └────────────────────┬─────────────────────┘
                                       │
                  ┌────────────────────▼─────────────────────┐
                  │ FASE 3: Validación Local (Capa 1)        │
                  └────────────────────┬─────────────────────┘
                                       │
                  ┌────────────────────▼─────────────────────┐
                  │ FASE 4: Libro de Trazabilidad (History)  │
                  └────────────────────┬─────────────────────┘
                                       │
                  ┌────────────────────▼─────────────────────┐
                  │ FASE 5: Integración del Contrato IIC     │
                  └────────────────────┬─────────────────────┘
                                       │
                  ┌────────────────────▼─────────────────────┐
                  │ FASE 6: Adaptador HIE (Retrocompat)      │
                  └────────────────────┬─────────────────────┘
                                       │
                  ┌────────────────────▼─────────────────────┐
                  │ FASE 7: Consistencia ACE (Capa 2)        │
                  └────────────────────┬─────────────────────┘
                                       │
                  ┌────────────────────▼─────────────────────┐
                  │ FASE 8: Motor Editorial (Report Engine)   │
                  └────────────────────┬─────────────────────┘
                                       │
                  ┌────────────────────▼─────────────────────┐
                  │ FASE 9: Suite de Pruebas Unitarias HD    │
                  └──────────────────────────────────────────┘
```

---

## 7. Plan de Pruebas Unitarias Obligatorias

La suite de pruebas en `tests/gangIntelligence.test.ts` deberá validar automáticamente los siguientes 6 escenarios de control críticos:

### TEST-001: Expediente sin Evidencias (Fallback Seguro)
*   **Condición de Entrada:** Se procesa un proyecto con un IIC vacío y sin registros OSINT ni grafitis.
*   **Validación esperada:** 
    *   La matriz GEM se genera con estatus `"NO_EVIDENCE"`.
    *   La capacidad `gangIntelligence` se evalúa como `false`.
    *   La narrativa final del Capítulo 8 se renderiza de forma segura con la plantilla estandarizada de descarte (no-presencia), impidiendo fallas de maquetación por propiedades nulas.

### TEST-002: Persona Referenciada (Dato Estructurado Oficial)
*   **Condición de Entrada:** Proyecto con 1 indicio oficial de campo que cita una marca o alias, pero sin grafitis.
*   **Validación esperada:** 
    *   El GEM de presencia se evalúa como `"REFERENCED"` con nivel de confianza `"MEDIUM"`.
    *   La trazabilidad registra la procedencia como `"OFFICIAL_DATABASE"`.

### TEST-003: Grafiti Identificado mediante VEE (Consumo Secundario)
*   **Condición de Entrada:** Se inyecta una matriz de VEE que contiene 2 registros activos en `graffitiEvidence` con metadatos de ubicación dentro del radio perimetral.
*   **Validación esperada:**
    *   `graffitiTerritorialAnalyzer.ts` extrae correctamente los metadatos.
    *   La GEM de presencia clasifica estatus como `"CONFIRMED"`.
    *   No se invocan APIs externas de visión o Street View.

### TEST-004: Eventos OSINT (Filtro Geográfico)
*   **Condición de Entrada:** Se inyectan 2 incidentes OSINT: uno a 120m del centroide (dentro del radio de 500m del TCE) y otro a 700m (fuera del perímetro de amortiguamiento).
*   **Validación esperada:**
    *   El validador de Capa 1 aplica el filtro Haversine y rechaza el evento de 700m.
    *   La GEM incluye únicamente el evento de 120m.
    *   La trazabilidad registra la transformación `"Haversine perimetral filter applied"`.

### TEST-005: Bloqueo de Lenguaje Criminalizante (Calidad de Capa 2)
*   **Condición de Entrada:** Se inyecta una narrativa simulada de Gemini en `payload.pandillasAnalysis` que incluye la frase prohibida: *"Esta zona está controlada por la Pandilla X"*.
*   **Validación esperada:**
    *   `validateGangConsistency()` en ACE detecta el patrón mediante regex.
    *   ACE asigna estatus global `"FAILED"`.
    *   El kernel de `reportEngine.ts` detiene físicamente la exportación levantando una excepción de tipo `BLOQUEO DE SEGURIDAD (NOT_READY)`.

### TEST-006: Conflicto entre Evidencia Positiva y Ausencia Documental
*   **Condición de Entrada:** El analista selecciona el Capítulo 8 para renderizar grafitis de pandillas, pero el IIC registra cero evidencias en la GEM.
*   **Validación esperada:**
    *   La Capa 1 de validación local del GIM detecta la contradicción de completitud y reduce la confianza local del módulo a menos de 40.
    *   Se inyecta una advertencia metodológica en el libro de trazabilidad.

---

## 8. Criterios de Aceptación del Desarrollo (Checklist)

El desarrollo del GIM se considerará oficialmente finalizado y listo para pruebas de QA únicamente cuando se marque con éxito el 100% de la siguiente lista de verificación:

- [ ] **Compilación limpia:** El proyecto compila sin errores de TypeScript y la suite de pruebas unitarias se ejecuta con éxito.
- [ ] **Estructuración en el IIC:** El objeto inmutable `IntelligenceIntegrationContext` contiene la propiedad `GIM` poblada con el esquema GEM correspondiente.
- [ ] **Aislamiento del VEE:** El `VisualEvidenceEngine` y su lógica de carga/procesamiento de imágenes permanecen completamente inalterados.
- [ ] **Aislamiento del HIE:** No se modificó el archivo `hypothesisIntelligenceEngine.ts`; el adaptador traduce la GEM simulando la interfaz legacy perfectamente.
- [ ] **Gobernanza de lenguaje en ACE:** El motor ACE intercepta y veta de forma determinista cualquier narrativa con sesgos o afirmaciones criminalizantes.
- [ ] **Fidelity del Capítulo 8:** El Report Engine genera y renderiza la narrativa del Capítulo 8 respetando el formato estricto de 4 partes.
- [ ] **Trazabilidad operativa:** Cada dato del GIM cuenta con un registro en `gimEvidenceTraceability.ts` detallando su procedencia oficial u OSINT.
- [ ] **Casos de prueba acreditados:** Los 6 casos de prueba unitarios se ejecutan y aprueban de forma automatizada.

---

## 9. Matriz de Riesgos y Mitigaciones del Proyecto

### Riesgo 1: Introducción de Alucinaciones o Sesgos Criminalizantes por Gemini
*   **Clasificación:** 🚨 **CRÍTICO**
*   **Impacto:** Crítico. Cuestionamiento institucional del Perfilador por vulneraciones a los derechos humanos y estigmatización territorial.
*   **Mitigación:** Filtro Regex centralizado en ACE. El validador central de ACE barre la narrativa final y veta la exportación si detecta expresiones categóricas proscritas.

### Riesgo 2: Excepciones de Referencia Nula (Null Pointer) en Expedientes Históricos
*   **Clasificación:** ⚠️ **ALTO**
*   **Impacto:** Alto. Ruptura de la interfaz de usuario y de las exportaciones para todos los reportes antiguos que no cuentan con datos GIM.
*   **Mitigación:** Tipado opcional estricto en TypeScript (`GIM: GangEvidenceMatrix | null`) y manejo seguro de valores predeterminados (fallbacks) en el maquetador del layout.

### Riesgo 3: Consumo Redundante de Cuotas de APIs Visuales
*   **Clasificación:** 🟢 **MEDIO**
*   **Impacto:** Medio. Aumento innecesario de costos de infraestructura y retrasos en el procesamiento del perfil del entorno.
*   **Mitigación:** El GIM tiene prohibido llamar a APIs de mapas u Google Vision. Solo consume el array estático de grafitis previamente procesado por VEE.

### Riesgo 4: Imposibilidad de Acreditar el Carácter Científico del Reporte en Litigios
*   **Clasificación:** 🟢 **MEDIO**
*   **Impacto:** Medio. Descalificación del reporte técnico en juicios orales o auditorías ministeriales.
*   **Mitigación:** Inyectar de forma inmutable el Libro de Trazabilidad en la última página del reporte Word, detallando con marcas de tiempo la procedencia física del dato.

---

## 10. Plan de Validación Posterior (Pipeline de Liberación)

Para autorizar el paso de la rama del GIM a producción, la implementación física debe atravesar de manera secuencial la siguiente tubería de verificación técnica:

```
[ 1. Validación de Arquitectura ]
Confirmar que no se crearon archivos fuera del alcance y que no hay dependencias prohibidas.
               │
               ▼
[ 2. Validación TypeScript ]
Verificar el tipado estricto en tiempo de compilación para descartar referencias nulas.
               │
               ▼
[ 3. Pruebas Unitarias Automatizadas ]
Ejecutar la suite completa tests/gangIntelligence.test.ts logrando 100% de acreditación.
               │
               ▼
[ 4. Prueba con Expediente Real (Staging) ]
Procesar un proyecto de prueba real en Firestore utilizando datos reales e interactuando con VEE.
               │
               ▼
[ 5. Validación de Gobernanza de ACE ]
Simular inyección de lenguaje prohibido para comprobar el bloqueo físico de la exportación.
               │
               ▼
[ 6. Validación de Exportación PDF/Word ]
Generar los entregables oficiales y verificar visualmente que el Capítulo 8 y la tabla de trazabilidad se maquetan sin desbordamientos de estilo.
```

---

## Dictamen Final ADR-008.3

### Estatus del Plan de Implementación:
**`[ X ] APROBADO PARA DESARROLLO CONTROLADO`**

Se autoriza de forma oficial la implementación física y codificación del **Gang Intelligence Module (GIM)** siguiendo estrictamente los lineamientos de alcance, orden secuencial, arquitectura de archivos, pruebas y criterios de aceptación estipulados en este **ADR-008.3**. 

Ningún componente fuera de los listados en este documento podrá ser creado o modificado durante el desarrollo de la característica.

---
*Fin del Plan de Implementación Física ADR-008.3*
