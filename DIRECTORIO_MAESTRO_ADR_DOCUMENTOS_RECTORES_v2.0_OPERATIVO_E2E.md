# DIRECTORIO MAESTRO DE ADR Y DOCUMENTOS RECTORES
## PERFILADOR REMOTO SSPE-CEIPOL
### VERSIÓN 2.0 — OPERATIVO E2E

> Documento preparado como hoja de ruta documental para el E2E institucional con expedientes limpios.

DIRECTORIO MAESTRO DE ADR
Y DOCUMENTOS RECTORES
PERFILADOR REMOTO SSPE-CEIPOL
EDICIÓN OPERATIVA v2.0 — E2E DE EXPEDIENTES LIMPIOS
Base actualizada: 08/09/2026 · main · HEAD 8622a4d · origin/main 94c3f78 · 2 commits locales certificados pendientes de push

| Propósito | Fuente única de navegación documental para impedir duplicaciones, reaperturas innecesarias y regresiones. |
| --- | --- |
| Uso mañana | Gobernar tres expedientes nuevos: Individual, Corredor y Polígono, desde campo hasta Informe Word/PDF. |
| Regla de cambio | No crear ni sustituir motores existentes sin identificar ADR rector, implementación vigente y evidencia de regresión real. |
| Jerarquía | ADR-000 → Manual rector → ADR específico vigente → certificación → flujo implementado → auditoría histórica → legacy. |


# 0. HOJA DE RUTA OPERATIVA PARA MAÑANA
Esta sección es el punto de entrada obligatorio antes de cualquier intervención durante el E2E. No sustituye los ADR; indica cuál debe consultarse y en qué orden.

| Fase | Qué debe ocurrir | Documento/ADR rector | Gate antes de avanzar | Prohibición |
| --- | --- | --- | --- | --- |
| 1. Campo | Crear expediente y seleccionar geografía | ADR-000 / ADR-020.29A | Tipo correcto y expediente nuevo | No usar recuperación legacy |
| 2. In situ | Capturar evidencia georreferenciada | ADR-011 / ADR-021.4D-1 | GPS y fotos reales visibles | No inventar coordenadas |
| 3. Geografía | Construir Punto/LineString/Polygon con validación humana | ADR-017 / ADR-020.29A | Geografía válida y aprobada | No autogenerar vértices por inferencia |
| 4. Gabinete | Formular hipótesis inicial obligatoria | ADR-020.31 | Hipótesis humana registrada | No saltar directo a análisis |
| 5. Explotación | Street View / GEOINT / DENUE / SCINCE / OSINT / Incidencia / Pandillas si aplica | ADR-019 / 020 / 021 / 022 / 023 / 025 | Provenance y fuentes separadas | No contaminar geografía rectora |
| 6. IA | Correlacionar, sugerir, auditar | ADR-020.30 / ADR-024 | Revisión humana | IA no decide de forma final |
| 7. Informe | Generar producto institucional | ADR-013 / ADR-020.33 | PPC revisa contenido y visuales | No duplicar Document Engine |
| 8. Cierre | Word/PDF + QA final | Certificaciones de Report Engine / QA-08 | Producto real utilizable | No declarar GO sin producto real |


## 0.1 Reglas inamovibles del E2E
- La geografía operativa del expediente nuevo nace del levantamiento in situ, sus coordenadas y la validación humana, según el tipo seleccionado.
- INDIVIDUAL: un punto rector validado. CORREDOR: nodo inicial, nodos intermedios y nodo final. POLÍGONO: vértices perimetrales validados.
- No crear vértices automáticamente por inferencia a partir de timestamps, Street View, POI u otras fuentes analíticas. Las fotografías in situ sí pueden constituir los puntos/nodos/vértices de la geografía cuando fueron capturadas y validadas expresamente con ese rol.
- Street View, POI, DENUE, SCINCE, OSINT, Incidencia y GEOINT enriquecen el análisis, pero no sustituyen ni mutan la geografía rectora.
- Antes de crear un nuevo engine, adapter, panel o flujo: consultar este directorio, localizar el ADR rector, localizar implementación y pruebas existentes.
- Incidencia cerró ADR-INC-001 en commit local 8622a4d; el código productivo quedó aislado y sin cambios pendientes. No mezclar artefactos documentales/QA con commits funcionales.
- El camino crítico es producto institucional: expedientes nuevos → flujo completo → informe → Word/PDF → QA final.
## 0.2 Semáforo documental

| Estado | Significado | Acción mañana |
| --- | --- | --- |
| RECTOR_VIGENTE / VIGENTE | Autoridad aplicable | Seguir; no rediseñar |
| CERTIFICACION | Evidencia de cierre/version | Usar como prueba, no como ADR superior |
| PENDIENTE_DE_VERIFICACION | No hay evidencia suficiente | No convertir en regla nueva |
| DUPLICADO / DEPRECADO / LEGACY | Sin autoridad actual | No usar para gobernar cambios |
| NO_CORRESPONDE_AL_PERFILADOR | Otro proyecto/módulo | Excluir |


# DIRECTORIO VALIDADO CONTRA REPOSITORIO — CONTENIDO CONSOLIDADO
A continuación se conserva el contenido del directorio validado, normalizado visualmente. Las correcciones operativas de esta edición se limitan a clarificar el uso para el E2E y a evitar una interpretación errónea de la relación entre fotografías in situ y geometría canónica.
# 1. Propósito y autoridad del directorio
Este directorio consolida la autoridad documental del Perfilador Remoto SSPE-CEIPOL. Su función es distinguir documentos rectores, ADR vigentes, certificaciones, auditorías históricas, documentos sustituidos, documentos legacy y materiales no correspondientes al Perfilador.
La autoridad operativa de este archivo es de inventario y gobernanza documental. No sustituye por sí mismo un ADR rector; ordena la lectura institucional de los documentos existentes y define qué documento debe consultarse primero cuando existan versiones, duplicados o evidencias históricas conflictivas.
Regla central: una función gobernada por ADR cerrado no debe duplicarse ni reimplementarse salvo que exista incumplimiento demostrado del contrato vigente, regresión verificable, contradicción normativa o nuevo requerimiento institucional explícito.
# 2. Alcance de la auditoría
La auditoría se limitó al Perfilador Remoto SSPE-CEIPOL dentro del repositorio indicado. Se revisaron documentos Markdown, JSON, DOCX/PDF inventariables por ruta, tags y commits con mensajes ADR relevantes.
No se auditó el contenido binario completo de DOCX/PDF cuando no fue necesario para determinar jerarquía documental; esos documentos quedan señalados con pendiente de verificación binaria cuando aplica.
No se dedicó esta auditoría a migración legacy. El estado operativo confirmado para la plataforma es: Firestore projects=0 y Storage projects/=0. La fase vigente es ESTABILIZAR -> VALIDAR -> EJECUTAR EXPEDIENTES REALES -> PRODUCIR INFORME -> WORD/PDF -> QA FINAL -> LIBERACIÓN.
# 3. Jerarquía documental aplicable
Orden de precedencia validado:
ADR-000 como arquitectura rectora superior.
Manual de Gobernanza Operacional y Analítica del Perfilador, cuando no contradiga ADR vigente.
ADR específico más reciente y sus subfases certificadas.
Certificación final o auditoría de cierre vinculada al ADR.
Flujo homologado implementado y validado por pruebas focales.
Auditorías históricas como evidencia de contexto, no como autoridad superior.
Documentos legacy, duplicados o deprecados sólo para trazabilidad.
Los ADR cerrados no se reabren por preferencia de implementación. Sólo pueden reabrirse por regresión demostrada, contradicción normativa, fallo contractual o nuevo mandato institucional.
# 4. ADR-000 y documentos rectores superiores
### ADR-000 — Arquitectura Rectora del Perfilador CEIPOL

| ID | ADR-000 |
| --- | --- |
| Documento | Arquitectura Rectora del Perfilador CEIPOL |
| Ruta | ADR-000 — Arquitectura Rectora del Perfilador CEIPOL.docx |
| Tipo | ADR rector |
| Versión | v2.0 |
| Estado | RECTOR_VIGENTE |
| Área regulada | Arquitectura superior |
| ADR padre | N/A |
| Implementado | Sí |
| Certificado | Pendiente de verificación binaria |
| Commit | 095c97a |
| Tag/Release | N/A |
| Sustituye a | ADR PERFILADOR.docx |
| Sustituido por | N/A |
| Observaciones | Rector superior identificado por v0.1 y trazabilidad Git. |


### LEGACY-000 — ADR PERFILADOR

| ID | LEGACY-000 |
| --- | --- |
| Documento | ADR PERFILADOR |
| Ruta | ADR PERFILADOR.docx |
| Tipo | ADR legacy |
| Versión | s/d |
| Estado | DEPRECADO |
| Área regulada | Arquitectura previa |
| ADR padre | N/A |
| Implementado | Histórico |
| Certificado | No vigente |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | ADR-000 |
| Observaciones | Mantener sólo como archivo histórico. |


### GOV-001 — Manual de Gobernanza Operacional y Analítica Perfilador

| ID | GOV-001 |
| --- | --- |
| Documento | Manual de Gobernanza Operacional y Analítica Perfilador |
| Ruta | MANUAL DE GOBERNANZA OPERACIONAL Y ANALÍTICA PERFILADOR.docx |
| Tipo | Manual rector |
| Versión | v1.0 |
| Estado | RECTOR_VIGENTE |
| Área regulada | Gobernanza operativa y analítica |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Pendiente de verificación binaria |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | Versiones previas no normalizadas |
| Sustituido por | N/A |
| Observaciones | Rector complementario superior. |


### GOV-002 — Manual de Gobernanza Algorítmica

| ID | GOV-002 |
| --- | --- |
| Documento | Manual de Gobernanza Algorítmica |
| Ruta | MANUAL DE GOBERNANZA ALGORÍTMICA v2.0.docx |
| Tipo | Manual |
| Versión | v2.0 |
| Estado | COMPLEMENTARIO_VIGENTE |
| Área regulada | Gobernanza algorítmica |
| ADR padre | ADR-000 |
| Implementado | Parcial |
| Certificado | Pendiente de verificación binaria |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Complementa reglas de IA, no sustituye ADR-020/024. |


# 5. ADR vigentes identificados
### ADR-003.2 — Implementation Report ADR-003.2

| ID | ADR-003.2 |
| --- | --- |
| Documento | Implementation Report ADR-003.2 |
| Ruta | implementation_report_adr_003_2.md |
| Tipo | Implementación |
| Versión | 3.2 |
| Estado | AUDITORIA_HISTORICA |
| Área regulada | Base funcional temprana |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Histórico |
| Commit | 23fbb38 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | ADR posteriores |
| Observaciones | Mantener como evidencia histórica. |


### ADR-004 — Familia ADR-004

| ID | ADR-004 |
| --- | --- |
| Documento | Familia ADR-004 |
| Ruta | adr_004_1_design.md; implementation_report_adr_004_*.md |
| Tipo | ADR/subfases |
| Versión | 004.1-004.5.4 |
| Estado | VIGENTE |
| Área regulada | Análisis estadístico, ACE, integración GEOINT inicial |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Parcial por subfase |
| Commit | a8fab75, b4cee82, 0fae363, 4ff7aac, 2359255, 14558bc, 2ce11b6, 7923c84, 343da2d, e633ed1 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | ADR-020/021 en orquestación superior |
| Observaciones | Vigente como antecedente funcional. |


### ADR-007 — Auditoría IIC

| ID | ADR-007 |
| --- | --- |
| Documento | Auditoría IIC |
| Ruta | adr_007_4_auditoria_iic.md |
| Tipo | Auditoría |
| Versión | 7.4 |
| Estado | AUDITORIA_HISTORICA |
| Área regulada | Contexto IIC |
| ADR padre | ADR-000 |
| Implementado | Parcial |
| Certificado | Histórico |
| Commit | 30d9e0f |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | ADR-008 |
| Observaciones | Evidencia de contexto. |


### ADR-008 — Familia GIM/Pandillas

| ID | ADR-008 |
| --- | --- |
| Documento | Familia GIM/Pandillas |
| Ruta | adr_008_*.md |
| Tipo | ADR/subfases |
| Versión | 8.1.1-8.8.2 |
| Estado | VIGENTE |
| Área regulada | GIM, Pandillas, IIC, ACE |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Parcial por subfase |
| Commit | 2e49252, 66ab685, f442631 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | ADR-020.29/021 |
| Observaciones | Vigente para Pandillas con orquestación posterior. |


### ADR-010 — Soft Governance Quality Gate

| ID | ADR-010 |
| --- | --- |
| Documento | Soft Governance Quality Gate |
| Ruta | ADR-010-SOFT-GOVERNANCE-QUALITY-GATE.md |
| Tipo | ADR |
| Versión | 010 |
| Estado | RECTOR_VIGENTE |
| Área regulada | Quality Gate no bloqueante |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Sí |
| Commit | 5f14e76 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Certificado/congelado. Decisión humana final. |


### ADR-011 — Photo Evidence Governance

| ID | ADR-011 |
| --- | --- |
| Documento | Photo Evidence Governance |
| Ruta | docs/ADR-011-FINAL-CERTIFICATION.md y docs/ADR-011-* |
| Tipo | ADR/certificación |
| Versión | 011 |
| Estado | RECTOR_VIGENTE |
| Área regulada | Evidencia fotográfica, Street View guard, captura mapa, eliminación |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Sí |
| Commit | ff2e459, d96ea64, b9b0ee0, e52e186, 66cd39c |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Certificado production-ready frozen. |


### ADR-012 — Geo Integrity Anti-Fallback

| ID | ADR-012 |
| --- | --- |
| Documento | Geo Integrity Anti-Fallback |
| Ruta | ADR-012-AUDIT-REPORT.md |
| Tipo | ADR/auditoría |
| Versión | 012 |
| Estado | VIGENTE |
| Área regulada | Integridad geográfica y anti-fallback |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Parcial |
| Commit | 2729523 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | ADR-017/020 |
| Observaciones | Vigente con alcance reconciliado por canonical geography. |


### ADR-013 — Document Engine Architecture

| ID | ADR-013 |
| --- | --- |
| Documento | Document Engine Architecture |
| Ruta | ADR-013-DOCUMENT-ENGINE-ARCHITECTURE.md |
| Tipo | ADR |
| Versión | 013 |
| Estado | VIGENTE |
| Área regulada | Document Engine, Word/PDF, separación de ReportEngine |
| ADR padre | ADR-000 |
| Implementado | Sí por ADR-020.33 |
| Certificado | Certificación posterior |
| Commit | 2d4107c, 40f10a7, 507dd50, 28d5d2e, 7061365 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | El archivo base dice PROPUESTO; Git posterior evidencia integración. |


### ADR-014 — Ghost/decorative UI

| ID | ADR-014 |
| --- | --- |
| Documento | Ghost/decorative UI |
| Ruta | s/d físico confirmado |
| Tipo | ADR previsto |
| Versión | 014 |
| Estado | PENDIENTE_DE_VERIFICACION |
| Área regulada | Limpieza UI decorativa |
| ADR padre | ADR-000 |
| Implementado | No confirmado |
| Certificado | No confirmado |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Citado por v0.1; requiere localización documental. |


### ADR-015 — CrimeCharts

| ID | ADR-015 |
| --- | --- |
| Documento | CrimeCharts |
| Ruta | s/d físico confirmado |
| Tipo | ADR previsto |
| Versión | 015 |
| Estado | PENDIENTE_DE_VERIFICACION |
| Área regulada | Visualización criminal |
| ADR padre | ADR-000 |
| Implementado | No confirmado |
| Certificado | No confirmado |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Citado por v0.1; requiere prueba documental. |


### ADR-016 — Multiusuario

| ID | ADR-016 |
| --- | --- |
| Documento | Multiusuario |
| Ruta | tags/commits sprint1-adr016 |
| Tipo | ADR |
| Versión | 016 |
| Estado | VIGENTE |
| Área regulada | RBAC, sesiones, multiusuario |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Parcial |
| Commit | b0c34b2 |
| Tag/Release | v2.5.1-sprint1-adr016 |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Evidencia fuerte en auth/PostgreSQL; falta ADR físico consolidado. |


### ADR-017 — Geographic Decoupling

| ID | ADR-017 |
| --- | --- |
| Documento | Geographic Decoupling |
| Ruta | tag v2.5.1-adr017-* |
| Tipo | ADR |
| Versión | 017 |
| Estado | VIGENTE |
| Área regulada | Entidades geográficas desacopladas |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Sí por tag |
| Commit | s/d |
| Tag/Release | v2.5.1-adr017-geographic-decoupling |
| Sustituye a | ADR-012 parcial |
| Sustituido por | ADR-020 canonical geography |
| Observaciones | Rector técnico para storage de entidades geográficas. |


### ADR-018 — Controlled Sweep Engine

| ID | ADR-018 |
| --- | --- |
| Documento | Controlled Sweep Engine |
| Ruta | tag v2.5.1-adr018-controlled-sweep-engine |
| Tipo | ADR |
| Versión | 018 |
| Estado | VIGENTE |
| Área regulada | Barrido GEOINT controlado |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Sí por tag |
| Commit | s/d |
| Tag/Release | v2.5.1-adr018-controlled-sweep-engine |
| Sustituye a | N/A |
| Sustituido por | ADR-019/020 |
| Observaciones | Precede event ledger y sweep persistente. |


### ADR-019 — GEOINT/Street View/Event Ledger

| ID | ADR-019 |
| --- | --- |
| Documento | GEOINT/Street View/Event Ledger |
| Ruta | docs/ADR-019.* |
| Tipo | ADR/subfases |
| Versión | 019.15-019.19 |
| Estado | RECTOR_VIGENTE |
| Área regulada | Street View, comparación temporal, event ledger, outbox |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Sí por subfase |
| Commit | b215e68, 1363f71 |
| Tag/Release | ADR-019.15-BEFORE-UX-HOTFIX, v2.5.1-adr01919-transactional-event-outbox |
| Sustituye a | ADR-018 parcial |
| Sustituido por | ADR-020 en ciclo completo |
| Observaciones | Rector para Street View y eventos. |


### ADR-020 — GEOINT Sweep Engine y gobernanza epistemica

| ID | ADR-020 |
| --- | --- |
| Documento | GEOINT Sweep Engine y gobernanza epistemica |
| Ruta | Git ADR-020.* |
| Tipo | ADR/subfases |
| Versión | 020.17-020.35 |
| Estado | RECTOR_VIGENTE |
| Área regulada | Canonical geography, hipótesis, IA, report readiness, Document Engine integrado |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Sí por subfases |
| Commit | 69d2222..9d2eb31 |
| Tag/Release | v2.5.1-adr020-geoint-sweep-engine |
| Sustituye a | ADR-017/018/019 parcial |
| Sustituido por | N/A |
| Observaciones | ADR operativo central de GEOINT moderno. |


### ADR-021 — Multisource Orchestration

| ID | ADR-021 |
| --- | --- |
| Documento | Multisource Orchestration |
| Ruta | Git ADR-021.* |
| Tipo | ADR/subfases |
| Versión | 021.2-021.4D |
| Estado | VIGENTE |
| Área regulada | Orquestación fotos, DENUE, SCINCE, OSINT, Telegram, Pandillas |
| ADR padre | ADR-020 |
| Implementado | Sí |
| Certificado | Parcial |
| Commit | c0c7e77..757cb6c |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | ADR-023/025 complementan |
| Observaciones | Rector de integración multisource. |


### ADR-022 — Incidencia y trazabilidad dataset

| ID | ADR-022 |
| --- | --- |
| Documento | Incidencia y trazabilidad dataset |
| Ruta | docs/ADR-022.8K-crime-incidence-provenance.md y Git ADR-022.* |
| Tipo | ADR/subfases |
| Versión | 022.2A-022.30 |
| Estado | RECTOR_VIGENTE |
| Área regulada | Incidencia, C5i 911, PostGIS, mobile geography |
| ADR padre | ADR-000/020 |
| Implementado | Sí |
| Certificado | Sí por fases |
| Commit | 9670518..7c1a63d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Rector vigente de incidencia; no tocar cambios actuales. |


### ADR-023 — Correlación multisource y DENUE

| ID | ADR-023 |
| --- | --- |
| Documento | Correlación multisource y DENUE |
| Ruta | Git ADR-023 |
| Tipo | ADR |
| Versión | 023 |
| Estado | VIGENTE |
| Área regulada | Correlación institucional, DENUE, promoción Street View |
| ADR padre | ADR-021 |
| Implementado | Sí |
| Certificado | Parcial |
| Commit | 22ca7aa, bbc5346 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | No estaba en v0.1. |


### ADR-024 — Gobernanza IA institucional

| ID | ADR-024 |
| --- | --- |
| Documento | Gobernanza IA institucional |
| Ruta | Git ADR-024 |
| Tipo | ADR |
| Versión | 024 |
| Estado | RECTOR_VIGENTE |
| Área regulada | IA, revisión humana, control epistemico |
| ADR padre | ADR-020 |
| Implementado | Sí |
| Certificado | Sí por commit |
| Commit | 048105a |
| Tag/Release | N/A |
| Sustituye a | ADR-020.30 parcial |
| Sustituido por | N/A |
| Observaciones | No estaba en v0.1. |


### ADR-025 — Google Evidence Contract y predictive products

| ID | ADR-025 |
| --- | --- |
| Documento | Google Evidence Contract y predictive products |
| Ruta | Git ADR-025 |
| Tipo | ADR/subfases |
| Versión | 025 |
| Estado | VIGENTE |
| Área regulada | Places, Vision, Routes, Elevation, convergencia, productos predictivos |
| ADR padre | ADR-021/024 |
| Implementado | Sí |
| Certificado | Parcial |
| Commit | 89c16e0, 0059aca, 188cc14, 444e10b, 9997afb, 7e09c53, 3716a70 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | No estaba en v0.1. |


# 6. Manuales vigentes y duplicados
### MAN-001 — Manual de Gobernanza Operacional y Analítica

| ID | MAN-001 |
| --- | --- |
| Documento | Manual de Gobernanza Operacional y Analítica |
| Ruta | MANUAL DE GOBERNANZA OPERACIONAL Y ANALÍTICA PERFILADOR.docx |
| Tipo | Manual rector |
| Versión | v1.0 |
| Estado | RECTOR_VIGENTE |
| Área regulada | Operación institucional |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Pendiente binario |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Fuente manual superior. |


### MAN-002 — Manual de Gobernanza Algorítmica

| ID | MAN-002 |
| --- | --- |
| Documento | Manual de Gobernanza Algorítmica |
| Ruta | MANUAL DE GOBERNANZA ALGORÍTMICA v2.0.docx |
| Tipo | Manual |
| Versión | v2.0 |
| Estado | COMPLEMENTARIO_VIGENTE |
| Área regulada | IA/gobernanza algorítmica |
| ADR padre | ADR-024 |
| Implementado | Sí |
| Certificado | Pendiente binario |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Complementa ADR-020/024. |


### MAN-003 — Manual del Usuario Tomo I

| ID | MAN-003 |
| --- | --- |
| Documento | Manual del Usuario Tomo I |
| Ruta | MANUAL DEL USUARIO. TOMO I.docx |
| Tipo | Manual usuario |
| Versión | s/d |
| Estado | DUPLICADO |
| Área regulada | Usuario final |
| ADR padre | ADR-000 |
| Implementado | Parcial |
| Certificado | No |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | MAN-005 |
| Observaciones | Familia duplicada. |


### MAN-004 — Manual Usuario Tomo I

| ID | MAN-004 |
| --- | --- |
| Documento | Manual Usuario Tomo I |
| Ruta | MANUAL USUARIO TOMO I.docx |
| Tipo | Manual usuario |
| Versión | s/d |
| Estado | DUPLICADO |
| Área regulada | Usuario final |
| ADR padre | ADR-000 |
| Implementado | Parcial |
| Certificado | No |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | MAN-005 |
| Observaciones | Familia duplicada. |


### MAN-005 — Manual Usuario Tomo I corregido estilos

| ID | MAN-005 |
| --- | --- |
| Documento | Manual Usuario Tomo I corregido estilos |
| Ruta | MANUAL_USUARIO_TOMO_I_CORREGIDO_ESTILOS.docx |
| Tipo | Manual usuario |
| Versión | s/d |
| Estado | VIGENTE |
| Área regulada | Usuario final |
| ADR padre | ADR-000 |
| Implementado | Parcial |
| Certificado | Pendiente binario |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | MAN-003/MAN-004 |
| Sustituido por | N/A |
| Observaciones | Versión preferente por nombre. |


### MAN-006 — Guía Operativa

| ID | MAN-006 |
| --- | --- |
| Documento | Guía Operativa |
| Ruta | GUÍA OPERATIVA.docx |
| Tipo | Guía |
| Versión | s/d |
| Estado | COMPLEMENTARIO_VIGENTE |
| Área regulada | Operación |
| ADR padre | ADR-000 |
| Implementado | Parcial |
| Certificado | Pendiente binario |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Complementaria, no ADR. |


### MAN-007 — Módulo de Análisis de Riesgo por Inundaciones

| ID | MAN-007 |
| --- | --- |
| Documento | Módulo de Análisis de Riesgo por Inundaciones |
| Ruta | Modulo de Analisis de Riesgo por Inundaciones.docx |
| Tipo | Documento externo/módulo |
| Versión | s/d |
| Estado | NO_CORRESPONDE_AL_PERFILADOR |
| Área regulada | Otro módulo |
| ADR padre | N/A |
| Implementado | No aplica |
| Certificado | No |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | No debe gobernar Perfilador Remoto. |


# 7. Flujos operativos gobernados
Flujos identificados como gobernados o cubiertos por ADR:

| Flujo | Documento rector | Estado | Observación |
| --- | --- | --- | --- |
| Creación/carga de proyecto | ADR-000; ADR-020.29A; ProjectContext | Vigente | Identidad institucional y geografía canónica gobiernan readiness. |
| Geografía canónica | ADR-017; ADR-020.29A; QA-06.03 | Vigente | Point/LineString/Polygon sólo con validación correspondiente. |
| Fotografía in situ | ADR-011; ADR-021.4D-1 | Vigente | Evidencia, no vértice automático. |
| Street View | ADR-011 guard; ADR-019; ADR-023 | Vigente | Fuente analítica, no fuente rectora automática. |
| Barrido GEOINT | ADR-018; ADR-020.26-028 | Vigente | Disparo explícito y persistencia controlada. |
| Captura de evidencia | ADR-011 | Vigente | Governed capture, relación y anexos. |
| Eliminación de evidencia | ADR-011.7.11A | Vigente | Gobernanza de eliminación de imágenes. |
| Hipótesis | ADR-020.31 | Vigente | Lifecycle gobernado y frontera de reporte. |
| OSINT | ADR-020.20; ADR-021.4D-3B | Vigente | Proveedor canónico y orquestación. |
| DENUE | ADR-020.19; ADR-021.4D-2; ADR-023 | Vigente | Fuente externa con credenciales y trazabilidad. |
| SCINCE | ADR-021.4D-2 | Vigente | Orquestación canónica. |
| Incidencia | ADR-022 | Rector vigente | C5i 911, PostGIS, dataset, mobile geography. |
| Pandillas | ADR-008; ADR-020.29; ADR-021.4D | Vigente | Pipeline autoritativo posterior. |
| Correlación | ADR-023; ADR-025 | Vigente | Multisource y convergencia. |
| IA | ADR-020.30; ADR-024 | Rector vigente | Revisión humana obligatoria. |
| Document Engine | ADR-013; ADR-020.33 | Vigente | Word/PDF y publicación gobernada. |
| RBAC/sesiones | ADR-016; auth hardening | Vigente | PostgreSQL/auth, multiusuario. |
| Auditoría/outbox | ADR-019.19; ADR-020.28 | Vigente | Event ledger y outbox transaccional. |


# 8. Geografía canónica y reconciliación histórica
La geografía vigente debe entenderse bajo tres capas:
Entidades geográficas auxiliares o legacy.
Draft/selección humana cuando el flujo lo exige.
CanonicalProjectGeography persistida sólo bajo contrato válido.
La reconciliación histórica QA-06.03 es implementación reciente de gobernanza operativa, no un ADR independiente localizado. Su criterio es compatible con ADR-011/017/020/024: fotografías históricas GPS son evidencia y candidatos, pero no VERTEX automático; el orden forense puede informar la revisión, pero la geometría canónica requiere decisión humana explícita.
Estado de gobernanza: VIGENTE con pendiente de consolidación documental ADR si se convierte en política permanente transversal.
# 9. Evidencia fotográfica, Street View y captura
ADR-011 es el rector para evidencia fotográfica. Su certificación final declara producción lista y congelada. Regula integridad, límite de fotos primarias, anexos, eliminación y separación de Street View.
Street View queda regulado por ADR-011 como fuente protegida, por ADR-019 como motor comparativo/GEOINT y por ADR-023/025 para promoción controlada y contrato Google. No puede convertirse en vértice territorial por inferencia automática.
# 10. Barrido GEOINT, DENUE, SCINCE, OSINT y Pandillas
La línea de gobierno es:
ADR-018 establece barrido controlado.
ADR-019 agrega Street View, temporalidad, event ledger y outbox.
ADR-020 integra ciclo persistente, gobernanza epistemica y readiness.
ADR-021 orquesta fotos, DENUE, SCINCE, OSINT, Telegram y Pandillas.
ADR-023/025 extienden correlación, Google evidence contract y convergencia multisource.
No debe implementarse un segundo motor de integración multisource fuera de esta cadena sin prueba de incumplimiento contractual.
# 11. Incidencia, C5i 911 y PostGIS
ADR-022 es rector vigente de incidencia. Incluye dataset C5i 911 Aguascalientes 2016-2026-C5I-911-AGG-v1, admisión, trazabilidad, proyección, exportación institucional, PostGIS y validación móvil.
Como antecedente de la auditoría del 07/09/2026, Incidencia se encontraba modificada en el working tree y fue preservada sin intervención. Ese frente fue posteriormente cerrado y certificado como ADR-INC-001 en el commit local `8622a4d`.
# 12. IA, gobernanza epistemica y revisión humana
ADR-010 prohíbe convertir el Quality Gate en bloqueo decisorio final. ADR-020.30 y ADR-024 gobiernan la IA institucional bajo revisión humana, firewall epistemico y control de provenance.
Regla validada: IA, heurísticas, secuencias temporales, GPS histórico, Street View, Places, Vision, Routes o Elevation pueden producir insumos analíticos, pero no sustituyen confirmación humana cuando el resultado afecta geometría canónica, hipótesis institucional o informe.
# 13. Document Engine, Word/PDF e informe institucional
ADR-013 define la separación Document Engine / Report Engine. Aunque el documento base aparece como PROPUESTO, los commits ADR-020.33 F1-F7 evidencian integración posterior de contrato de publicación, contenido gobernado, visual products, ensamblado documental, certificación humana y publication integrity.
Estado: VIGENTE, con contradicción documental menor por desactualización del estado interno del ADR-013.
# 14. Seguridad, sesiones, RBAC y auditoría
ADR-016 y el hardening de auth/PostgreSQL gobiernan sesiones, login y perfiles. ADR-019.19 y ADR-020.28 gobiernan event ledger/outbox. La auditoría operacional y trazabilidad institucional se respaldan con JSON y reportes auditables en raíz.
Los documentos JSON de seguridad y trazabilidad son evidencias de certificación o auditoría, no manuales rectores por sí solos.
# 15. Certificaciones y auditorías de cierre
### CERT-001 — Certificación Final Perfilador Remoto

| ID | CERT-001 |
| --- | --- |
| Documento | Certificación Final Perfilador Remoto |
| Ruta | CERTIFICACION_FINAL_PERFILADOR_REMOTO_v1.md |
| Tipo | Certificación |
| Versión | v1 |
| Estado | CERTIFICACION |
| Área regulada | Plataforma |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Sí |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Evidencia de cierre histórico. |


### CERT-002 — Cierre Certificación Perfilador Remoto

| ID | CERT-002 |
| --- | --- |
| Documento | Cierre Certificación Perfilador Remoto |
| Ruta | CIERRE_CERTIFICACION_PERFILADOR_REMOTO.md |
| Tipo | Certificación |
| Versión | s/d |
| Estado | CERTIFICACION |
| Área regulada | Plataforma |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Sí |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Complementa CERT-001. |


### CERT-003 — Final Certification Report

| ID | CERT-003 |
| --- | --- |
| Documento | Final Certification Report |
| Ruta | docs/FINAL-CERTIFICATION-REPORT.md |
| Tipo | Certificación |
| Versión | s/d |
| Estado | CERTIFICACION |
| Área regulada | Arquitectura/GEOINT/evidencia/reportes |
| ADR padre | ADR-010/011/012 |
| Implementado | Sí |
| Certificado | Sí |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Declara arquitectura estable; posteriores ADR amplían alcance. |


### CERT-004 — Architecture Audit Final

| ID | CERT-004 |
| --- | --- |
| Documento | Architecture Audit Final |
| Ruta | docs/ARCHITECTURE_AUDIT_FINAL.md |
| Tipo | Auditoría cierre |
| Versión | s/d |
| Estado | CERTIFICACION |
| Área regulada | Arquitectura |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Sí |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Evidencia arquitectura estable/certificada. |


### CERT-005 — ADR-011 Final Certification

| ID | CERT-005 |
| --- | --- |
| Documento | ADR-011 Final Certification |
| Ruta | docs/ADR-011-FINAL-CERTIFICATION.md |
| Tipo | Certificación |
| Versión | 011 |
| Estado | CERTIFICACION |
| Área regulada | Evidencia fotográfica |
| ADR padre | ADR-011 |
| Implementado | Sí |
| Certificado | Sí |
| Commit | ff2e459 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Congelado production-ready. |


### CERT-006 — ADR-019.17 Certification

| ID | CERT-006 |
| --- | --- |
| Documento | ADR-019.17 Certification |
| Ruta | docs/ADR-019.17-CERTIFICATION-REPORT.md |
| Tipo | Certificación |
| Versión | 019.17 |
| Estado | CERTIFICACION |
| Área regulada | GEOINT UX/eventos |
| ADR padre | ADR-019 |
| Implementado | Sí |
| Certificado | Sí |
| Commit | 1363f71 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Subfase certificada. |


### CERT-007 — ADR-019.18 Closure

| ID | CERT-007 |
| --- | --- |
| Documento | ADR-019.18 Closure |
| Ruta | docs/ADR-019.18-CLOSURE-AUDIT.md |
| Tipo | Auditoría cierre |
| Versión | 019.18 |
| Estado | CERTIFICACION |
| Área regulada | GEOINT event ledger |
| ADR padre | ADR-019 |
| Implementado | Sí |
| Certificado | Sí |
| Commit | 1363f71 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Cierre de ledger. |


### CERT-008 — Report Quality Governance Final

| ID | CERT-008 |
| --- | --- |
| Documento | Report Quality Governance Final |
| Ruta | REPORT_QUALITY_GOVERNANCE_FINAL_CERTIFICATION.md |
| Tipo | Certificación |
| Versión | v1.1.1 |
| Estado | CERTIFICACION |
| Área regulada | Calidad de informe |
| ADR padre | ADR-013/020 |
| Implementado | Sí |
| Certificado | Contradictorio |
| Commit | 1337e42 |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Contiene identificador CERTIFICATION_BLOCKED junto a aprobación PASS. |


### CERT-009 — Report Engine E2E Validation

| ID | CERT-009 |
| --- | --- |
| Documento | Report Engine E2E Validation |
| Ruta | REPORT_ENGINE_E2E_VALIDATION.md |
| Tipo | Validación |
| Versión | s/d |
| Estado | CERTIFICACION |
| Área regulada | Report Engine |
| ADR padre | ADR-013 |
| Implementado | Sí |
| Certificado | Sí |
| Commit | 87b884b |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Evidencia E2E de reportes. |


### CERT-010 — Final Pre Operational E2E Audit

| ID | CERT-010 |
| --- | --- |
| Documento | Final Pre Operational E2E Audit |
| Ruta | FINAL_PRE_OPERATIONAL_E2E_AUDIT_REPORT.json |
| Tipo | Auditoría JSON |
| Versión | s/d |
| Estado | CERTIFICACION |
| Área regulada | Operación E2E |
| ADR padre | ADR-000 |
| Implementado | Sí |
| Certificado | Sí |
| Commit | s/d |
| Tag/Release | N/A |
| Sustituye a | N/A |
| Sustituido por | N/A |
| Observaciones | Evidencia machine-readable. |


# 16. Documentos históricos, legacy y deprecados
Documentos a conservar sin autoridad rectora vigente:

| Documento | Estado | Motivo |
| --- | --- | --- |
| ADR PERFILADOR.docx | DEPRECADO | Sustituido por ADR-000. |
| MANUAL DEL USUARIO. TOMO I.docx | DUPLICADO | Familia sustituida por versión corregida. |
| MANUAL USUARIO TOMO I.docx | DUPLICADO | Familia sustituida por versión corregida. |
| Dictámenes parciales ADR-004/007/008 | AUDITORIA_HISTORICA | Evidencia de evolución, no rector superior. |
| implementation_plan*.md | AUDITORIA_HISTORICA | Planes de implementación ya superados por commits. |
| audit_report_quality_v1.0.7/8/9.md | AUDITORIA_HISTORICA | Precede certificación v1.1.1. |
| Bibliografia/*.pdf | COMPLEMENTARIO_VIGENTE | Soporte académico, no contrato operativo. |
| Strategic_Geointelligence_for_Crime_Prevention.pdf | COMPLEMENTARIO_VIGENTE | Bibliografía, no ADR. |
| Modulo de Analisis de Riesgo por Inundaciones.docx | NO_CORRESPONDE_AL_PERFILADOR | Pertenece a otro módulo. |


# 17. Duplicados y familias documentales
Familias duplicadas o versionadas:

| Familia | Documentos | Estado rector |
| --- | --- | --- |
| Arquitectura base | ADR PERFILADOR.docx; ADR-000 — Arquitectura Rectora del Perfilador CEIPOL.docx | ADR-000 vigente; ADR PERFILADOR deprecado. |
| Manual usuario Tomo I | MANUAL DEL USUARIO. TOMO I.docx; MANUAL USUARIO TOMO I.docx; MANUAL_USUARIO_TOMO_I_CORREGIDO_ESTILOS.docx | Versión corregida preferente. |
| Manual gobernanza | MANUAL DE GOBERNANZA OPERACIONAL Y ANALÍTICA PERFILADOR.docx; MANUAL DE GOBERNANZA ALGORÍTMICA v2.0.docx | Ambos vigentes con alcances distintos. |
| Report quality | audit_report_quality_v1.0.7/8/9; REPORT_QUALITY_GOVERNANCE_FINAL_CERTIFICATION.md | Certificación final preferente, con nota de contradicción. |
| ADR-019 | docs/ADR-019.16/17/18/19 y tags | Última fase 019.19 preferente. |


Pendiente: hash binario comparativo de DOCX/PDF para confirmar duplicado exacto versus duplicado semántico.
# 18. Contradicciones y reconciliaciones documentales

| Contradicción | Documentos afectados | Resolución v1.0 |
| --- | --- | --- |
| Arquitectura congelada en certificaciones tempranas vs ADR-020/021/022/023/024/025 posteriores | FINAL-CERTIFICATION-REPORT; Git ADR posteriores | No invalida certificación; las fases posteriores amplían bajo ADR específico. |
| ADR-013 aparece PROPUESTO pero Document Engine fue integrado después | ADR-013; commits ADR-020.33 | Estado corregido a VIGENTE con observación. |
| Report Quality dice CERTIFICATION_BLOCKED pero contiene PASS/aprobación | REPORT_QUALITY_GOVERNANCE_FINAL_CERTIFICATION.md | Clasificar como certificación con contradicción pendiente. |
| Fotos GPS históricas podrían confundirse con vértices | ADR-011; QA-06.03; ADR-020 | Reconciliación: evidencia/candidato no es VERTEX. |
| Street View como fuente analítica vs fuente territorial | ADR-011; ADR-019; ADR-023/025 | Street View no crea geografía canónica automáticamente. |
| Documento de Inundaciones dentro del repositorio | Modulo de Analisis de Riesgo por Inundaciones.docx | NO_CORRESPONDE_AL_PERFILADOR. |


# 19. Matriz de capacidad a documento rector
### Geografía — ADR-017/020.29A

| Capacidad | Geografía |
| --- | --- |
| ADR rector | ADR-017/020.29A |
| Documento rector | ADR-000; tags ADR-017; commits ADR-020 |
| Implementación conocida | canonicalProjectGeography, ProjectContext, GeographicWorkspace |
| Test/certificación | Tags ADR-017/020 |
| ¿Puede crearse otra implementación? | No |
| Condición | Sólo si incumple canonical contract. |


### Fotografía in situ — ADR-011

| Capacidad | Fotografía in situ |
| --- | --- |
| ADR rector | ADR-011 |
| Documento rector | docs/ADR-011-FINAL-CERTIFICATION.md |
| Implementación conocida | Photo Evidence Governance |
| Test/certificación | ADR-011 cert |
| ¿Puede crearse otra implementación? | No |
| Condición | Sólo extensión compatible. |


### Street View — ADR-011/019/023

| Capacidad | Street View |
| --- | --- |
| ADR rector | ADR-011/019/023 |
| Documento rector | docs/ADR-019.* |
| Implementación conocida | Guard, sweep, event ledger |
| Test/certificación | ADR-019 certs |
| ¿Puede crearse otra implementación? | No |
| Condición | No puede crear vértices automáticos. |


### Barrido GEOINT — ADR-018/020

| Capacidad | Barrido GEOINT |
| --- | --- |
| ADR rector | ADR-018/020 |
| Documento rector | tags ADR-018/020 |
| Implementación conocida | Sweep lifecycle |
| Test/certificación | v2.5.1-adr020 |
| ¿Puede crearse otra implementación? | No |
| Condición | Debe preservar trigger explícito. |


### Captura de evidencia — ADR-011

| Capacidad | Captura de evidencia |
| --- | --- |
| ADR rector | ADR-011 |
| Documento rector | ADR-011 docs |
| Implementación conocida | Map evidence capture |
| Test/certificación | ADR-011 subfases |
| ¿Puede crearse otra implementación? | No |
| Condición | Sólo adapters compatibles. |


### Eliminación de evidencia — ADR-011

| Capacidad | Eliminación de evidencia |
| --- | --- |
| ADR rector | ADR-011 |
| Documento rector | ADR-011 deletion governance |
| Implementación conocida | Image deletion governance |
| Test/certificación | ADR-011.7.11A |
| ¿Puede crearse otra implementación? | No |
| Condición | Debe conservar auditoría. |


### Hipótesis — ADR-020.31

| Capacidad | Hipótesis |
| --- | --- |
| ADR rector | ADR-020.31 |
| Documento rector | Git ADR-020.31 |
| Implementación conocida | Hypothesis lifecycle |
| Test/certificación | Commit 1d52380 |
| ¿Puede crearse otra implementación? | No |
| Condición | Sin mezclar evidencia y conclusión. |


### OSINT — ADR-020/021

| Capacidad | OSINT |
| --- | --- |
| ADR rector | ADR-020/021 |
| Documento rector | Git ADR-020.20/021.4D-3B |
| Implementación conocida | OSINT orchestration |
| Test/certificación | Commits e88f388/9ffc4e2 |
| ¿Puede crearse otra implementación? | No |
| Condición | Proveedor canónico y provenance. |


### DENUE — ADR-020/021/023

| Capacidad | DENUE |
| --- | --- |
| ADR rector | ADR-020/021/023 |
| Documento rector | Git ADR-020.19/021.4D-2/023 |
| Implementación conocida | DENUE source path |
| Test/certificación | Commit 22ca7aa |
| ¿Puede crearse otra implementación? | No |
| Condición | Credenciales y trazabilidad. |


### SCINCE — ADR-021

| Capacidad | SCINCE |
| --- | --- |
| ADR rector | ADR-021 |
| Documento rector | Git ADR-021.4D-2 |
| Implementación conocida | Canonical orchestration |
| Test/certificación | e756a61 |
| ¿Puede crearse otra implementación? | No |
| Condición | Fuente externa trazable. |


### Incidencia — ADR-022

| Capacidad | Incidencia |
| --- | --- |
| ADR rector | ADR-022 |
| Documento rector | docs/ADR-022.8K |
| Implementación conocida | Incidence pipeline/PostGIS |
| Test/certificación | ADR-022 commits |
| ¿Puede crearse otra implementación? | No |
| Condición | Respetar dataset contract. |


### Pandillas — ADR-008/020/021

| Capacidad | Pandillas |
| --- | --- |
| ADR rector | ADR-008/020/021 |
| Documento rector | adr_008_*.md |
| Implementación conocida | Pandillas pipeline |
| Test/certificación | ADR-008/020 commits |
| ¿Puede crearse otra implementación? | No |
| Condición | Fuente autoritativa vigente. |


### Correlación — ADR-023/025

| Capacidad | Correlación |
| --- | --- |
| ADR rector | ADR-023/025 |
| Documento rector | Git ADR-023/025 |
| Implementación conocida | Multisource convergence |
| Test/certificación | Commits 22ca7aa/9997afb |
| ¿Puede crearse otra implementación? | No |
| Condición | Sin colapsar provenance. |


### IA — ADR-020.30/024

| Capacidad | IA |
| --- | --- |
| ADR rector | ADR-020.30/024 |
| Documento rector | Manual Algorítmico; Git ADR-024 |
| Implementación conocida | AI governance |
| Test/certificación | 048105a |
| ¿Puede crearse otra implementación? | No |
| Condición | Revisión humana obligatoria. |


### Document Engine — ADR-013/020.33

| Capacidad | Document Engine |
| --- | --- |
| ADR rector | ADR-013/020.33 |
| Documento rector | ADR-013 doc; ADR-020.33 commits |
| Implementación conocida | Document assembly Word/PDF |
| Test/certificación | REPORT_ENGINE E2E |
| ¿Puede crearse otra implementación? | No |
| Condición | Separación de ReportEngine. |


### Word/PDF — ADR-013/020.33

| Capacidad | Word/PDF |
| --- | --- |
| ADR rector | ADR-013/020.33 |
| Documento rector | ADR-013; report certs |
| Implementación conocida | Export pipeline |
| Test/certificación | Report certs |
| ¿Puede crearse otra implementación? | No |
| Condición | No romper publicación institucional. |


### RBAC — ADR-016

| Capacidad | RBAC |
| --- | --- |
| ADR rector | ADR-016 |
| Documento rector | auth hardening |
| Implementación conocida | PostgreSQL/auth profile |
| Test/certificación | b0c34b2 |
| ¿Puede crearse otra implementación? | No |
| Condición | Controles por usuario/sesión. |


### Sesiones — ADR-016

| Capacidad | Sesiones |
| --- | --- |
| ADR rector | ADR-016 |
| Documento rector | auth hardening |
| Implementación conocida | Login/sesión |
| Test/certificación | b0c34b2 |
| ¿Puede crearse otra implementación? | No |
| Condición | Sesión válida obligatoria. |


### Auditoría — ADR-019.19/020.28

| Capacidad | Auditoría |
| --- | --- |
| ADR rector | ADR-019.19/020.28 |
| Documento rector | docs ADR-019.19; Git ADR-020.28 |
| Implementación conocida | Event ledger/outbox |
| Test/certificación | v2.5.1-adr01919 |
| ¿Puede crearse otra implementación? | No |
| Condición | No registrar falsos éxitos. |


# 20. Estado operativo actual de la plataforma
Estado institucional para esta auditoría:
Firestore projects=0.
Storage projects/=0.
No hay expedientes vivos productivos que deban ser tratados como legacy de migración en este documento.
Próxima operación prevista: tres expedientes nuevos, uno individual, uno corredor y uno polígono.
La geografía de esos expedientes debe nacer por flujo canónico vigente, no por restauración automática ni inferencia de datos históricos.
# 21. Reglas de precedencia para decisiones futuras
Si existe ADR rector vigente, se consulta antes que implementación local.
Si dos ADR parecen competir, prevalece el más específico y más reciente, salvo que contradiga ADR-000.
Si un documento de certificación contradice un ADR posterior, se conserva como certificación histórica.
Si el código actual implementa una evolución no documentada, se marca pendiente de ADR o certificación documental.
Si un documento externo pertenece a otro módulo, no gobierna Perfilador Remoto.
# 22. Regla anti-duplicación de capacidades
No se debe crear otra implementación de geografía, evidencia, barrido, IA, incidencia, reporte, auditoría o sesiones cuando exista capacidad gobernada vigente.
Excepción permitida: adapter, puente o UI mínima que reutilice el contrato existente sin duplicar motor. Toda excepción debe declarar:
ADR rector reutilizado.
Contrato que no se modifica.
Prueba de no duplicación.
Riesgo de regresión.
Pruebas focales mínimas.
# 23. Reglas para nuevas fases de desarrollo
Para las fases ESTABILIZAR, VALIDAR, EJECUTAR EXPEDIENTES REALES, PRODUCIR INFORME, WORD/PDF, QA FINAL y LIBERACIÓN:
No inventar geometría.
No crear vértices automáticamente por inferencia. Las fotografías in situ designadas y validadas para ese rol pueden constituir nodos/vértices de la geografía; Street View y fuentes analíticas no.
No relajar createProject ordinario para omitir geografía.
No registrar auditoría de éxito antes de persistencia real.
No duplicar Document Engine.
No mezclar Incidencia con cambios ajenos.
No introducir migraciones o restauraciones sin lineage explícito.
No usar documentos legacy como autoridad contra ADR vigente.
# 24. Pendientes de verificación documental
Pendientes principales:

| Pendiente | Prioridad | Motivo |
| --- | --- | --- |
| Verificación binaria de DOCX rectores | Alta | Confirmar versión exacta, fecha y contenido interno. |
| Consolidar ADR-016 físico | Media | Existe evidencia Git/auth, falta documento rector localizado. |
| Localizar o cerrar ADR-014/015 | Media | Citados por v0.1 sin archivo rector confirmado. |
| Consolidar QA-06.03 como ADR o anexo | Alta | Reconciliación histórica ya impacta geografía canónica. |
| Resolver contradicción REPORT_QUALITY_GOVERNANCE | Media | Identificador bloqueado vs aprobación PASS. |
| Clasificar bibliografía académica | Baja | Soporte doctrinal, no contrato operativo. |


## COMPARATIVO v0.1 → v1.0:

| Elemento | v0.1 | v1.0 validado |
| --- | --- | --- |
| Alcance | Inventario preliminar | Directorio maestro con jerarquía y matriz de capacidad. |
| ADR posteriores | Llega hasta ADR-022 | Amplía a ADR-023, ADR-024 y ADR-025. |
| Geografía histórica | Mencionada de forma indirecta | Integrada como regla QA-06.03 compatible con ADR-011/017/020/024. |
| Incidencia | ADR-022 reconocido | ADR-022 permanece como antecedente rector de dataset/trazabilidad; ADR-INC-001 cerró la evolución de consulta espacial canónica en `8622a4d`. |
| Document Engine | ADR-013 propuesto | Reconciliado con integración ADR-020.33. |
| Duplicados | Señalados parcialmente | Familias duplicadas clasificadas. |
| Contradicciones | No sistematizadas | Seis contradicciones principales registradas. |
| Precedencia | Propuesta | Convertida en regla operativa del directorio. |


# 25. Dictamen final de gobernanza documental
Resultado respecto a v0.1: AMPLIADO SUSTANCIALMENTE.
Dictamen: el Perfilador Remoto cuenta con una línea documental suficiente para operar bajo gobernanza institucional, siempre que las nuevas fases respeten la precedencia ADR-000 -> manual rector -> ADR específico vigente -> certificación -> flujo implementado. La mayor brecha no es ausencia de arquitectura, sino dispersión documental y falta de consolidación formal para algunas capacidades recientes, especialmente QA-06.03 y ADR-023/024/025.
Conteo de auditoría:
Documentos inspeccionados/inventariados: 126.
ADR identificados: 23.
Subfases ADR relevantes: 82.
Manuales identificados: 7.
Certificaciones identificadas: 18.
Flujos identificados: 18.
Duplicados/familias versionadas: 5.
Contradicciones: 6.
Documentos legacy/deprecados/no correspondientes: 14.
Pendientes de verificación: 21.
Este directorio no modifica código ni valida datos productivos. Su uso recomendado es como índice rector para impedir reaperturas innecesarias, duplicación de motores y decisiones de implementación contrarias a ADR vigente.

# ANEXO OPERATIVO — REGLA DE CONSULTA DURANTE EL E2E
1. Ante cualquier anomalía: detener el cambio y determinar primero si es dato, UI, persistencia, contrato o regresión.
1. Consultar la capacidad en la Matriz anti-duplicación.
1. Consultar ADR rector y subfase más reciente certificada.
1. Confirmar implementación productiva y, cuando exista, release/deployment correspondiente.
1. Sólo si hay regresión demostrada abrir corrección quirúrgica.
1. Validar focalmente; después continuar el E2E exactamente donde se detuvo.

ESTADO DE ESTA EDICIÓN: LISTA PARA USO COMO HOJA DE RUTA DOCUMENTAL DEL E2E

## ANEXO OPERATIVO E2E — REGLAS INAMOVIBLES PARA MAÑANA

### Camino crítico

1. Crear expediente nuevo.
2. Seleccionar geografía: **Individual / Corredor / Polígono**.
3. Capturar evidencia **in situ** con geolocalización real.
4. Validar la geografía operativa antes de continuar.
5. Regresar a gabinete.
6. Formular la **hipótesis inicial obligatoria**.
7. Ejecutar fuentes analíticas gobernadas: Street View, GEOINT, DENUE, SCINCE, Incidencia, OSINT y Pandillas cuando aplique.
8. Correlacionar hallazgos sin mezclar provenance.
9. Ejecutar auditoría/validación de IA bajo Human-in-the-Loop.
10. Realizar revisión final por la persona perfiladora criminológica (PPC).
11. Generar **INSTITUTIONAL + EXECUTIVE_GEOINT**.
12. Auditar Word/PDF.
13. Ejecutar QA final y decidir GO/NO-GO.

### Regla geográfica

- **Individual:** una evidencia in situ territorial validada puede constituir el punto rector.
- **Corredor:** las evidencias in situ expresamente utilizadas como nodos territoriales pueden constituir nodo inicial, nodos intermedios y nodo final.
- **Polígono:** las evidencias in situ expresamente utilizadas como vértices territoriales pueden constituir los vértices del perímetro.
- Está prohibido crear automáticamente geometría territorial a partir de timestamps, proximidad, centroides, hulls, círculos, Street View, POI u otras fuentes analíticas.
- Street View, DENUE, SCINCE, Incidencia, OSINT, POI y demás capas posteriores **no modifican la geografía operativa rectora**.

### Regla anti-duplicación

Antes de crear un nuevo motor, servicio, adapter, panel, workflow, colección o contrato:

1. Consultar este Directorio.
2. Identificar ADR rector.
3. Buscar implementación existente.
4. Buscar consumidor productivo.
5. Buscar test/certificación.
6. Sólo después decidir si corresponde reutilizar, extender o corregir.

> **No se crea una segunda implementación de una capacidad vigente salvo regresión demostrada, contradicción normativa real o requerimiento institucional nuevo.**

### Criterio de liberación

> **Si un problema no impide crear un expediente nuevo bajo el contrato vigente y producir su informe institucional, no bloquea la liberación.**

## ACTUALIZACIÓN OPERATIVA — 08/09/2026

### E2E-004 — GEOINT Sweep Lifecycle Persistence Hardening
- Estado: CERTIFICADO LOCALMENTE.
- Commit: `1ba92e4`.
- Alcance: persistencia Firestore segura de campos opcionales del ciclo de vida GEOINT; validación de 14/14 pruebas focales; TypeScript y build aprobados.
- Publicación remota: PENDIENTE.
- Regla: el montaje del componente no crea un sweep; el barrido requiere trigger humano explícito.

### ADR-INC-001 — Canonical Spatial Query + Territorial Integrity Hardening
- Estado: CERTIFICADO LOCALMENTE.
- Commit: `8622a4d`.
- Alcance: consulta espacial canónica para punto, polígono, corredor y vialidad; PostGIS respeta geometría POLYGON; fallback CSV falla cerrado para POLYGON y no degrada geometría a radio.
- Validación: 5/5 pruebas ADR-INC-001; 23/23 pruebas de persistencia/fallback; TypeScript y build aprobados.
- Publicación remota: PENDIENTE.

### Baseline Git actual
- Rama: `main`
- HEAD local: `8622a4df18f8728692eb6087c0c5ce11584ea2c1`
- origin/main: `94c3f781ebd34f2a1fc5fa78e2d9c3a024bc6099`
- Relación: HEAD está 2 commits adelante y 0 atrás.
- Vercel Production: NO VERIFICABLE con la evidencia local disponible.
