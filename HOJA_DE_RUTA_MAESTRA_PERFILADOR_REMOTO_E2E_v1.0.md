# HOJA DE RUTA MAESTRA — PERFILADOR REMOTO SSPE-CEIPOL
## E2E INSTITUCIONAL CON EXPEDIENTES LIMPIOS
### VERSIÓN 1.0 — DOCUMENTO DE CONDUCCIÓN OPERATIVA

**Fecha de consolidación:** 2026-09-07
**Actualización operativa:** 2026-09-08
**Baseline Git local actual:** `8622a4df18f8728692eb6087c0c5ce11584ea2c1`
**Rama:** `main`
**HEAD == origin/main:** NO — HEAD local está 2 commits adelante y 0 atrás
**Vercel Production:** `NO VERIFICABLE` con la evidencia disponible
**Estado para E2E:** `APTO CON ADVERTENCIAS`
**Estado de datos:** `Firestore projects = 0` / `Storage projects/ = 0`

---

# 0. PROPÓSITO

Esta Hoja de Ruta Maestra integra dos fuentes de autoridad:

1. **DIRECTORIO MAESTRO DE ADR Y DOCUMENTOS RECTORES v2.0 — OPERATIVO E2E**
   - responde: **qué gobierna el sistema**;
   - define jerarquía, ADR, manuales, certificaciones, flujos, prohibiciones y reglas anti-duplicación.

2. **REGISTRO MAESTRO DE RELEASES Y DESPLIEGUES**
   - responde: **qué se implementó, qué se publicó en Git y qué pudo verificarse de Vercel**;
   - reconstruye commits, tags, ramas y evidencia de despliegue.

Esta Hoja de Ruta responde una tercera pregunta:

> **¿Qué debemos hacer, en qué orden, con qué gates y bajo qué reglas para llevar tres expedientes reales desde campo hasta informe institucional sin duplicar arquitectura ni reabrir decisiones cerradas?**

---

# 1. REGLA DE AUTORIDAD

Cuando exista duda o contradicción, aplicar este orden:

1. `ADR-000`
2. Manual de Gobernanza Operacional y Analítica
3. ADR específico más reciente y vigente
4. Certificación o auditoría de cierre vinculada
5. Flujo implementado y validado
6. Auditoría histórica
7. Legacy / deprecado / duplicado

Un ADR cerrado **no se reabre** salvo:

- regresión demostrada;
- incumplimiento del contrato vigente;
- contradicción normativa real;
- nuevo requerimiento institucional expreso.

---

# 2. REGLA ANTI-DUPLICACIÓN

Antes de crear cualquier:

- engine;
- service;
- adapter;
- workflow;
- panel;
- colección;
- contrato;
- pipeline;
- motor de informe;
- integración multisource;

debe cumplirse:

```text
CONSULTAR DIRECTORIO
→ IDENTIFICAR ADR RECTOR
→ BUSCAR IMPLEMENTACIÓN EXISTENTE
→ BUSCAR CONSUMIDOR PRODUCTIVO
→ BUSCAR TEST / CERTIFICACIÓN
→ DECIDIR: REUTILIZAR / EXTENDER / CORREGIR
```

## Prohibición

> No se autoriza una segunda implementación de una capacidad gobernada y existente por el solo hecho de no haber sido localizada inicialmente.

---

# 3. ESTADO DE PARTIDA

## 3.1 Datos

```text
Firestore projects = 0
Storage projects/ = 0
```

No existen expedientes productivos que deban migrarse.

## 3.2 Git

```text
HEAD local   = 8622a4df18f8728692eb6087c0c5ce11584ea2c1
origin/main  = 94c3f781ebd34f2a1fc5fa78e2d9c3a024bc6099
HEAD == origin/main = NO — 2 commits locales certificados pendientes de push
```

## 3.3 Vercel

La auditoría disponible determinó:

```text
VERCEL_CLI_NO_DISPONIBLE
VERCEL_NOT_VERIFIABLE
HEAD == PRODUCTION = NO VERIFICABLE
```

La ausencia de verificación Vercel es un **vacío de trazabilidad de release**, no autorización para reconstruir capacidades existentes.

## 3.4 Working tree

ADR-INC-001 fue cerrado y certificado localmente en `8622a4d`; no quedan cambios productivos pendientes de Incidencia.

Regla:

> NO mezclar Incidencia con el E2E de los expedientes limpios salvo necesidad expresa y demostrada.

---

# 4. OBJETIVO OPERATIVO

Levantar y procesar tres expedientes reales:

1. **INDIVIDUAL**
2. **CORREDOR**
3. **POLÍGONO**

Cada uno debe recorrer el flujo completo hasta:

```text
INSTITUTIONAL + EXECUTIVE_GEOINT
→ WORD
→ PDF
→ QA FINAL
→ GO / NO-GO
```

---

# 5. CAMINO CRÍTICO INAMOVIBLE

```text
CAMPO
↓
CREAR EXPEDIENTE NUEVO
↓
SELECCIONAR GEOGRAFÍA
↓
CAPTURA IN SITU
↓
VALIDAR GEOGRAFÍA
↓
GABINETE
↓
HIPÓTESIS INICIAL OBLIGATORIA
↓
STREET VIEW / GEOINT
↓
DENUE / SCINCE
↓
INCIDENCIA
↓
OSINT
↓
PANDILLAS SI APLICA
↓
CORRELACIÓN MULTISOURCE
↓
AUDITORÍA IA
↓
REVISIÓN PPC
↓
INFORME INSTITUCIONAL
↓
WORD / PDF
↓
QA FINAL
```

No saltar fases.

No reordenar el flujo por conveniencia.

---

# 6. FASE 1 — CREACIÓN DEL EXPEDIENTE

## Objetivo

Crear expediente limpio bajo el flujo ordinario actual.

## ADR / gobierno

- ADR-000
- ADR-020.29A
- ProjectContext / canonical geography

## Gate

- expediente creado;
- tipo de geografía correcto;
- identidad institucional correcta;
- sin mecanismos legacy.

## Prohibido

- recuperación histórica;
- migración;
- creación de geometría falsa;
- reutilización de proyecto viejo.

---

# 7. FASE 2 — CAPTURA IN SITU

## Gobierno

- ADR-011
- ADR-021.4D-1

## Regla general

La evidencia territorial de campo puede constituir parte de la geografía **cuando fue capturada y validada expresamente con ese rol**.

### Individual

```text
1 evidencia in situ territorial validada
→ Punto rector
```

### Corredor

```text
Nodo inicial
→ nodos intermedios
→ nodo final
→ LineString
```

### Polígono

```text
vértices perimetrales in situ
→ Polygon
```

## Prohibido

- convertir cualquier foto contextual en nodo;
- crear nodos desde Street View;
- inferir orden territorial por timestamp;
- generar círculos;
- centroides automáticos;
- convex hulls;
- buffers usados como sustituto de geografía;
- coordenadas inventadas.

---

# 8. FASE 3 — VALIDACIÓN DE GEOGRAFÍA

## Gobierno

- ADR-017
- ADR-020.29A
- QA-06.03 como antecedente operativo

## Gate

La geografía debe ser:

- visible;
- territorialmente correcta;
- humana y explícitamente validada;
- persistida;
- consistente al reabrir el expediente.

## Prueba mínima

Cerrar y volver a abrir el expediente.

La geometría debe permanecer idéntica.

## Si falla

Clasificar el fallo:

```text
A. UI solamente
B. Persistencia
C. Serialización Firestore
D. Carga/read model
E. Contaminación por fuente analítica
```

Corregir sólo el contrato roto.

No reconstruir el módulo completo.

---

# 9. FASE 4 — HIPÓTESIS INICIAL OBLIGATORIA

## Gobierno

- ADR-020.31
- ADR-024

## Gate

No se inicia explotación analítica hasta que exista hipótesis humana registrada.

## Regla

La hipótesis:

- es humana;
- puede ser revisada;
- tiene trazabilidad;
- no se confunde con evidencia;
- no se confunde con finding;
- no puede ser sustituida por una conclusión autónoma de IA.

---

# 10. FASE 5 — STREET VIEW / GEOINT

## Gobierno

- ADR-011
- ADR-018
- ADR-019
- ADR-020
- ADR-023
- ADR-025

## Regla

Street View es:

```text
FUENTE ANALÍTICA / CONTEXTUAL
```

No es:

```text
FUENTE AUTOMÁTICA DE GEOGRAFÍA RECTORA
```

## Gate

- barrido explícito;
- provenance;
- evidencia contextual distinguida de evidencia primaria;
- no muta la geografía operativa.

---

# 11. FASE 6 — DENUE / SCINCE / INCIDENCIA / OSINT / PANDILLAS

## DENUE

Gobierno:

- ADR-020.19
- ADR-021.4D-2
- ADR-023

## SCINCE

Gobierno:

- ADR-021.4D-2

## Incidencia

Gobierno:

- ADR-022

## OSINT

Gobierno:

- ADR-020.20
- ADR-021.4D-3B

## Pandillas

Gobierno:

- ADR-008
- ADR-020.29
- ADR-021

## Gate común

Toda fuente debe conservar:

```text
SOURCE
→ PROVENANCE
→ EVIDENCE / DATA
→ FINDING
→ ANALYSIS
```

No colapsar categorías.

No convertir `DATA` automáticamente en `EVIDENCE`.

No convertir `EVIDENCE` automáticamente en `FINDING`.

---

# 12. FASE 7 — CORRELACIÓN MULTISOURCE

## Gobierno

- ADR-021
- ADR-023
- ADR-025

## Pipeline rector

```text
normalización
→ evidence
→ finding
→ contextualización
→ correlación
→ contraste de hipótesis
→ análisis
→ auditoría IA
→ validación humana
→ report ready
```

## Prohibido

Crear un segundo motor de correlación paralelo.

Si existe una carencia:

- extender;
- adaptar;
- corregir;
- integrar.

No duplicar.

---

# 13. FASE 8 — IA / HUMAN-IN-THE-LOOP

## Gobierno

- ADR-010
- ADR-020.30
- ADR-024
- Manual de Gobernanza Algorítmica

## IA puede

- analizar;
- organizar;
- correlacionar;
- sugerir;
- auditar;
- redactar borradores.

## IA no puede

- modificar evidencia;
- inventar hechos;
- sustituir validación humana;
- convertir inferencias en hechos;
- alterar geografía canónica autónomamente;
- emitir decisión institucional final.

---

# 14. FASE 9 — REVISIÓN PPC

Antes de pasar a informe, la persona perfiladora criminológica debe revisar:

- hipótesis;
- hallazgos;
- correlaciones;
- inferencias;
- mapas;
- fotografías;
- narrativa;
- pertinencia operativa;
- consistencia territorial.

## Gate

```text
PPC REVIEW = COMPLETADA
```

Sin ello no se declara `REPORT READY`.

---

# 15. FASE 10 — INFORME INSTITUCIONAL

## Gobierno

- ADR-013
- ADR-020.33
- Report Engine E2E
- Report Quality Governance

## Producto objetivo

```text
INSTITUTIONAL + EXECUTIVE_GEOINT
```

## Objetivo editorial

- 7–9 páginas;
- máximo ordinario 10;
- 3–5 visuales;
- mínimo 1 mapa territorial canónico;
- 2–4 fotografías decisivas;
- detalle adicional en anexo técnico.

## Controles

- identidad institucional;
- logos;
- número de expediente;
- PPC;
- fecha;
- mapa correcto;
- leyenda;
- escala;
- captions;
- hipótesis coherente;
- hechos ≠ inferencias;
- evidencia primaria ≠ Street View;
- narrativa consistente con fuentes.

## Prohibido

- duplicar Document Engine;
- usar canvas/fallback como sustituto de contenido real cuando el producto gobernado exista;
- exportar geometría incorrecta;
- incluir imágenes sin función narrativa o probatoria.

---

# 16. FASE 11 — WORD / PDF

## Gate

Generar ambos productos.

Revisar visualmente:

- portada;
- márgenes;
- tablas;
- saltos;
- mapas;
- imágenes;
- títulos;
- pies;
- paginación;
- encabezado/pie;
- legibilidad;
- calidad institucional.

No aprobar sólo porque el build pase.

El producto debe ser **utilizable por una persona real**.

---

# 17. FASE 12 — QA FINAL / QA-08

QA-08 permanece:

```text
NO-GO
```

hasta que exista al menos un informe institucional real E2E.

## GO requiere

- expediente real;
- geografía correcta;
- evidencia real;
- hipótesis;
- explotación multisource;
- revisión IA;
- validación PPC;
- Word/PDF;
- integridad documental;
- ausencia de regresión crítica.

---

# 18. CRITERIO DE BLOQUEO

Un problema **bloquea** la liberación si impide:

1. crear expediente nuevo;
2. guardar geografía;
3. reabrir expediente;
4. registrar evidencia;
5. formular hipótesis;
6. ejecutar fuentes necesarias;
7. producir informe;
8. exportar Word/PDF.

Un problema **no bloquea** si:

- afecta sólo legacy;
- es cosmético menor;
- corresponde a un módulo no usado en el producto;
- no altera el E2E de expedientes nuevos.

---

# 19. PROTOCOLO ANTE ANOMALÍAS

Cuando aparezca un problema:

## Paso 1 — No modificar de inmediato

Registrar:

- expediente;
- fase;
- acción;
- resultado esperado;
- resultado real;
- captura/log si aplica.

## Paso 2 — Identificar ADR rector

No actuar sin saber qué contrato gobierna la función.

## Paso 3 — Identificar implementación actual

Buscar:

```text
ADR
→ código
→ consumidor
→ test
→ certificación
```

## Paso 4 — Clasificar

```text
REGRESIÓN
CONTRATO INCUMPLIDO
BUG LOCAL
ERROR DE DATOS
ERROR DE USO
LEGACY
NO BLOQUEANTE
```

## Paso 5 — Corrección quirúrgica

Máximo alcance razonable:

- 1–3 archivos;
- prueba focal;
- TSC/build por PowerShell cuando corresponda;
- Git explícito;
- sin `git add .`;
- sin mezclar Incidencia.

---

# 20. POLÍTICA CODEX

## Modo por defecto

```text
MODO CODEX: MUY ECONÓMICO
REASONING EFFORT: MINIMAL
```

## Usar Codex sólo para

- inspección real de repositorio;
- localización de implementación;
- modificación quirúrgica;
- análisis transversal difícil.

## No usar Codex para

- builds;
- TSC general;
- Git;
- status;
- staging;
- commit;
- push;
- validaciones que pueda hacer PowerShell.

## Modo completo

Reservado para:

- bug transversal complejo;
- bloqueo real del primer informe;
- QA-08;
- ruptura de Document Engine;
- arquitectura no resoluble con inspección focal.

---

# 21. POLÍTICA POWERSHELL

PowerShell ejecuta:

- `npm run build`
- `npx tsc --noEmit`
- Jest focal
- `git diff --check`
- `git status`
- staging explícito
- commit
- push

Regla:

```text
NO git add .
NO git add -A
```

---

# 22. ESTADO VERCEL Y REGLA DE PUBLICACIÓN

La auditoría disponible no pudo verificar Production directamente.

Por tanto:

```text
HEAD == origin/main = NO — 2 commits locales certificados pendientes de push
HEAD == Vercel Production = NO VERIFICABLE
```

## Consecuencia

Durante el E2E:

- si la plataforma accesible refleja el HEAD esperado y funciona, continuar;
- antes de release final, verificar Vercel Production de forma read-only;
- la falta de CLI no autoriza redeploy arbitrario;
- no usar un deploy para “ver si se arregla” un bug no diagnosticado.

---

# 23. MATRIZ OPERATIVA DE CAPACIDADES

| Capacidad | Gobierno | Reimplementar | Regla |
|---|---|---:|---|
| Geografía | ADR-017 / ADR-020.29A | NO | Corregir contrato canónico existente |
| Foto in situ | ADR-011 / ADR-021 | NO | Evidencia primaria separada |
| Street View | ADR-011 / 019 / 023 | NO | Fuente contextual |
| Sweep GEOINT | ADR-018 / 020 | NO | Trigger explícito |
| Hipótesis | ADR-020.31 | NO | Lifecycle gobernado |
| DENUE | ADR-020/021/023 | NO | Provenance |
| SCINCE | ADR-021 | NO | Orquestación canónica |
| Incidencia | ADR-022 | NO | No mezclar dirty worktree |
| OSINT | ADR-020/021 | NO | Proveedor gobernado |
| Pandillas | ADR-008/020/021 | NO | Pipeline existente |
| Correlación | ADR-023/025 | NO | No colapsar provenance |
| IA | ADR-020.30 / 024 | NO | Human-in-the-loop |
| Document Engine | ADR-013 / 020.33 | NO | No duplicar |
| Word/PDF | ADR-013 / 020.33 | NO | Producto real |
| RBAC/sesiones | ADR-016 | NO | Auth existente |
| Auditoría/outbox | ADR-019.19 / 020.28 | NO | No falsos éxitos |

---

# 24. CHECKLIST DE MAÑANA — EXPEDIENTE INDIVIDUAL

- [ ] Crear expediente nuevo.
- [ ] Seleccionar Individual.
- [ ] Capturar punto rector in situ.
- [ ] Confirmar GPS.
- [ ] Confirmar PIN correcto.
- [ ] Cerrar/reabrir.
- [ ] Verificar persistencia.
- [ ] Formular hipótesis.
- [ ] Ejecutar flujo analítico.
- [ ] Revisar PPC.
- [ ] Generar Word/PDF.

---

# 25. CHECKLIST DE MAÑANA — CORREDOR

- [ ] Crear expediente nuevo.
- [ ] Seleccionar Corredor.
- [ ] Capturar nodo inicial.
- [ ] Capturar nodos intermedios.
- [ ] Capturar nodo final.
- [ ] Verificar orden territorial.
- [ ] Verificar LineString.
- [ ] Cerrar/reabrir.
- [ ] Verificar persistencia.
- [ ] Formular hipótesis.
- [ ] Ejecutar flujo analítico.
- [ ] Revisar PPC.
- [ ] Generar Word/PDF.

---

# 26. CHECKLIST DE MAÑANA — POLÍGONO

- [ ] Crear expediente nuevo.
- [ ] Seleccionar Polígono.
- [ ] Capturar vértices perimetrales.
- [ ] Verificar orden de recorrido.
- [ ] Verificar cierre del polígono.
- [ ] Verificar ausencia de círculo artificial.
- [ ] Cerrar/reabrir.
- [ ] Verificar persistencia.
- [ ] Formular hipótesis.
- [ ] Ejecutar flujo analítico.
- [ ] Revisar PPC.
- [ ] Generar Word/PDF.

---

# 27. SEMÁFORO DE DECISIÓN

## VERDE — continuar

- función responde al ADR;
- datos persisten;
- flujo operativo continúa;
- producto correcto.

## AMARILLO — documentar y seguir

- detalle cosmético;
- legacy;
- warning no funcional;
- inconsistencia no bloqueante.

## ROJO — detener fase

- pérdida de evidencia;
- geometría falsa;
- persistencia rota;
- fuente modifica geografía;
- hipótesis no puede registrarse;
- reporte no se genera;
- Word/PDF corrupto;
- IA sustituye control humano;
- regresión transversal.

---

# 28. REGLA DE CIERRE DE CADA FASE

No avanzar por intuición.

Cada fase se cierra con:

```text
RESULTADO
+ EVIDENCIA
+ VALIDACIÓN
+ ADR CUMPLIDO
= AVANZAR
```

Si falla:

```text
FALLO
→ AISLAR
→ IDENTIFICAR ADR
→ CORREGIR MÍNIMO
→ VALIDAR
→ CONTINUAR
```

---

# 29. PRODUCTO FINAL ESPERADO

Al cierre del E2E deberán existir:

```text
3 EXPEDIENTES REALES
+
3 GEOGRAFÍAS CORRECTAS
+
3 HIPÓTESIS
+
EVIDENCIA IN SITU
+
EXPLOTACIÓN MULTISOURCE
+
REVISIÓN IA
+
VALIDACIÓN PPC
+
INFORME(S) INSTITUCIONAL(ES)
+
WORD
+
PDF
+
DICTAMEN QA-08
```

El objetivo no es volver a perfeccionar indefinidamente la arquitectura.

El objetivo es demostrar que el sistema **produce un producto institucional correcto**.

---

# 30. FUENTES DE ESTA HOJA DE RUTA

## Fuente A
`DIRECTORIO_MAESTRO_ADR_DOCUMENTOS_RECTORES_v2.0_OPERATIVO_E2E.md`

## Fuente B
`REGISTRO MAESTRO DE RELEASES Y DESPLIEGUES — PERFILADOR REMOTO SSPE-CEIPOL — v1.0`

## Esta Hoja de Ruta
No sustituye los ADR.

Su función es:

> **convertir gobernanza + implementación + release en una secuencia operativa única de trabajo.**

---

# 31. REGLA PARA EL NUEVO CHAT

El nuevo chat deberá comenzar leyendo:

1. Directorio Maestro ADR/Documentos Rectores.
2. Registro Maestro Releases/Vercel.
3. Esta Hoja de Ruta Maestra.

Y deberá respetar:

- no duplicación;
- no reapertura de ADR cerrados;
- E2E como camino crítico;
- prioridad producto institucional;
- correcciones quirúrgicas;
- Codex controlado;
- PowerShell para validación;
- Incidencia aislada;
- QA-08 sólo después de producto real.

---

# 32. ESTADO DE ARRANQUE PARA MAÑANA

```text
DATOS LIMPIOS: SÍ
HEAD = origin/main: NO — local 2 commits adelante / 0 atrás
VERCEL PRODUCTION: NO VERIFICABLE
LEGACY COMO CAMINO CRÍTICO: NO
EXPEDIENTES A LEVANTAR: 3
INDIVIDUAL: PENDIENTE
CORREDOR: PENDIENTE
POLÍGONO: PENDIENTE
PRIMER INFORME REAL: PENDIENTE
QA-08: NO-GO HASTA INFORME REAL
```

---

# 33. DICTAMEN

**HOJA DE RUTA MAESTRA APROBADA COMO DOCUMENTO DE CONDUCCIÓN OPERATIVA PARA EL E2E.**

No confiere por sí sola autoridad para modificar ADR, código o arquitectura.

Toda intervención deberá mantener trazabilidad:

```text
PROBLEMA
→ ADR
→ IMPLEMENTACIÓN
→ FIX MÍNIMO
→ PRUEBA
→ PRODUCTO
```

El camino rector para mañana es:

```text
EXPEDIENTES LIMPIOS
→ E2E REAL
→ INFORME INSTITUCIONAL
→ WORD/PDF
→ QA-08
→ LIBERACIÓN
```

## ACTUALIZACIÓN DE CIERRES LOCALES — 08/09/2026

### E2E-004
- Commit: `1ba92e4`
- Estado: CERTIFICADO LOCALMENTE / NO PUSH.
- Resultado: ciclo de vida GEOINT endurecido para persistencia segura y trigger humano explícito.

### ADR-INC-001
- Commit: `8622a4d`
- Estado: CERTIFICADO LOCALMENTE / NO PUSH.
- Resultado: consultas espaciales canónicas integradas; integridad territorial preservada en PostGIS y fallback CSV fail-closed para POLYGON.

### Gate antes de publicación
1. Confirmar commit documental separado.
2. Confirmar worktree limpio salvo artefactos no versionados.
3. Confirmar `origin/main` sin nuevos commits remotos.
4. Publicar commits funcionales y documental en orden controlado.
5. Verificar posteriormente deployment remoto/Vercel antes de declarar Production.
