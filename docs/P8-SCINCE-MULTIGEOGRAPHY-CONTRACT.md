# P8 — SCINCE productivo multigeografía

## Decisión y auditoría previa

Baseline: 8587939c66b1db02c8d5666850b3b3346ab53bc3. El prompt institucional
P8 autoriza implementar localmente consulta, revisión, persistencia y entrada
documental para Point, LineString, Polygon y MultiPolygon. Evoluciona el alcance
SUPPORTED_CONTEXT_ONLY de H.2F.2E.13–15 sin alterar sus reglas topológicas ni
reescribir certificaciones históricas. No autoriza ejecución live ni despliegue.

Inventario rector: DIRECTORIO_MAESTRO_ADR_DOCUMENTOS_RECTORES_v2.0_OPERATIVO_E2E.md
(ADR-017/020.29A geografía, ADR-021 orquestación, ADR-024 revisión humana),
ADR-026-DENUE-ANALYTICAL-RELEVANCE-GOVERNANCE.md §19, H2F2E13-SCINCE-TERRITORIAL-COVERAGE-CONTRACT.md,
H2F2E14-SCINCE-TOPOLOGY-OFFLINE-VALIDATION.md, H2F2E15-SCINCE-TOPOLOGY-PRECONDITIONS.md,
ADR-013-DOCUMENT-ENGINE-ARCHITECTURE.md, docs/ADR-022.8K-crime-incidence-provenance.md,
docs/P8-GEOSPATIAL-EVIDENCE-UI-CONTRACT.md y docs/P8.3-G-INSTITUTIONAL-PROJECT-ACCESS-MIGRATION.md.
Evidencia de datos: database/migrations/inegi-territorial/001_inegi_territorial_dataset_up.sql,
scripts/inegi/README.md, import-aguascalientes-2020.mjs, importerCore.cjs y fixtures INEGI.
La documentación histórica ADR PERFILADOR.docx es antecedente del directorio vigente.
La certificación GEOS offline no certifica una instalación PostGIS ni cobertura live.

Antes: servicio, fingerprint, snapshot V1 y publicación admitían exclusivamente
INDIVIDUAL/Point; cobertura V1 y precondiciones eran especificaciones aisladas.
Provider INEGI recibe lat/lng; WMS es cartografía, no un proveedor censal multiunidad.
La nueva ruta no convierte geometrías en coordenadas para pasar por ese provider.

## Contrato operativo

Point conserva V1 y resolver ST_Covers. CORRIDOR y POLYGON usan snapshot V2,
geometría completa serializada con el contrato Firestore existente, fingerprint
SCINCE_COVERAGE_FINGERPRINT_V1 y cobertura productiva V2. Consulta por projectId;
ANALYZE_SCINCE se verifica en servidor antes de DB o cache. Incorporación requiere
WRITE, nueva observación server-side y confirmación humana; exportación conserva
GENERATE_REPORT y vigencia contra documento persistido. No bypass por rol.

El adaptador PostGIS mide isValid/isSimple/isEmpty, área, CRS y predicados ligados
a la geometría exacta; reutiliza las precondiciones y clasificador H.2F.2E.15.
Sin reparación, buffers, reducción, centroides ni tolerancia espacial. MANZANA y
AGEB son niveles censales; LOCALIDAD/MUNICIPIO/ESTADO sólo identificación cuando
no hay cifras. Cada unidad conserva footprint y relación propios; AGEB se une
por su propia clave y footprint, nunca por la relación de una manzana hija.

ST_Intersection determina porción espacial. Longitud en metros y área en m²
se miden sobre geography WGS84; proporciones son espaciales, jamás demográficas.
TOUCHED_UNIT sólo enumeración; PARTIAL_UNIT conserva cifras completas con aviso;
FULL_UNIT exige Covers(G,U). Huecos y todos los componentes permanecen intactos.

Indicadores tipados COUNT/RATE/PERCENTAGE/AVERAGE/INDEX/CATEGORICAL/UNKNOWN.
Sólo los cuatro COUNT importados tienen definición acreditada en el dataset.
Suma únicamente unidades FULL_UNIT del mismo nivel/dataset, sin null, con
disjunción interior medida por PostGIS y sin mezclar AGEB con manzanas.
Se llama suma de unidades completas seleccionadas, nunca población total del área:
el dataset READY no acredita completitud de una partición territorial.
Rates/porcentajes requieren numerador y denominador acreditados y coherentes con el valor original;
los promedios requieren pesos acreditados. Ambos requieren escala, universo y fórmula
explícitos; índices, categorías y desconocidos no se combinan automáticamente.
No población×área, valores parciales ficticios, sumas de contactos ni null→0.

## Rendimiento y vigencia

Límites fijos: 500 unidades, 10.000 posiciones, 8 segundos por sentencia SQL;
transacción READ ONLY con snapshot REPEATABLE READ, consulta espacial acotada,
join censal por lotes y límite+1 para detectar exceso sin truncar.
Cache sólo server-side, TTL 60 s, 100 entradas por ruta (Point y multiunidad); clave projectId+fingerprint+
dataset ID/año/versión/checksums. Revalidar autorización y dataset incluso en hit.
No cache de errores. Cada revisión compara contenido, no hora de readquisición.
Cambio de coordenadas, orden, componentes, ID o dataset fuerza nueva observación.

Fuentes técnicas verificadas: https://postgis.net/docs/ST_Intersection.html,
https://postgis.net/docs/ST_Relate.html, https://postgis.net/docs/ST_Area.html,
https://postgis.net/docs/ST_Length.html. La operación espacial no constituye una
metodología oficial de distribución demográfica.

El Point conserva ST_Covers, selección/fallback y snapshot V1; su cache añade
scope projectId+geographyId+fingerprint y reconsulta identidad del dataset antes
de reutilizar la observación, sin alterar coordenadas ni cifras.

## Pendientes de infraestructura

Validar por separado PostGIS real, permisos SELECT/READ ONLY, versión GEOS,
dataset oficial READY, límites de ejecución, índices y cobertura. No se realizan
migraciones, conexiones ni grants live en esta intervención. Las pruebas SQL con
repository mock y GEOS local se reportan separadamente de certificación live.

## Arquitectura auditada: rutas, funciones, líneas e I/O

El rechazo anterior estaba en servicio (modalidad), panel (gate) y snapshot/publicación V1 (binding Point). La nueva ruta mantiene el resolver y snapshot Point; extiende las otras capas con V2.

| Componente | Archivo:línea / función | Input | Output | Geometrías / límite |
|---|---|---|---|---|
| Panel | src/components/ScinceHumanContextPanel.tsx:74 / export function ScinceHumanContextPanel | projectId/geografía/capacidad | consulta, revisión y estados | Point/LineString/Polygon/MultiPolygon |
| Flujo humano | src/utils/scinceHumanContextFlow.ts:21 / export function createScinceHumanContextFlow | contexto/acciones | iaAnalysis sólo tras incorporar | resultado V1/V2 |
| Servicio | src/services/scinceCanonicalContextService.ts:20 / export async function resolveScinceCanonicalContext | projectId/session interna | observación canónica o rechazo | Point existente; demás completas |
| Provider previo | src/lib/providers/inegiProvider.ts:32 / async fetchData | lat/lng/action | provider response | Point; sin degradación de geometrías |
| Resolver Point | src/lib/inegiTerritorialResolver.ts:264 / export async function resolveInegiTerritory | lat/lng | unidad ST_Covers + fallback AGEB | Point sin cambios semánticos |
| Resolver multiunidad | src/lib/inegiMultiunitResolver.ts:48 / export async function resolveInegiMultiunit | projectId + canonical | observación V2 por unidades | LineString/Polygon/MultiPolygon |
| Request builder | src/lib/inegiMultiunitResolver.ts:20 / export const SCINCE_MULTIUNIT_SQL | GeoJSON exacto, dataset, límite | candidatos y filas propias | geometría completa EPSG:4326 |
| Adaptador geométrico | src/utils/scinceQueryGeometry.ts:5 / export function readScinceCanonicalGeography | geografía raw/Firestore-safe | geografía completa o null | las cuatro geometrías; sin coerción ni drop |
| Auth boundary | src/services/institutionalProjectAccessService.ts:14 / export async function authorizeInstitutionalProjectAccess | actor/projectId/action | explicit active grant | ANALYZE_SCINCE/WRITE/GENERATE_REPORT separados |
| ProjectContext | src/context/ProjectContext.tsx:1982 / const updateProjectDetails | iaAnalysis confirmado | persistencia existente del proyecto | snapshot Firestore-safe V1/V2 |
| Normalización | src/utils/scinceMultiunitValidation.ts:11 / export function isValidScinceMultiunit | snapshot persistido | validación/identidad/agregados | V2; no certificación live |
| Snapshot/vigencia | src/utils/scinceCanonicalSnapshot.ts:88 / export function evaluateScinceSnapshotFreshness | snapshot + geografía actual | CURRENT/STALE/INVALID/MISSING | V1 Point y V2 multiunidad |
| Publicación | src/services/scinceDocumentPublicationService.ts:43 / export async function resolveScinceDocumentPublication | snapshot persistido/geografía del informe | admisión con review y freshness | V1/V2; GenerateReport preservado |
| Entrada narrativa | src/utils/scinceDocumentContext.ts:27 / export function scinceDocumentSummary | contexto admitido | consulta puntual/corredor/área | sin sustitución metodológica |
| Orquestación histórica | src/services/geoint/denueScinceOrchestrationAdapter.ts:117 / export function adaptDenueScinceSource | provider response + provenance | fuente observada separada | no se usa como conversor a Point |

## Inventario documental ampliado

Búsqueda sólo en documentos rastreados; antecedentes directos e indirectos localizados por SCINCE/INEGI/unidades/canonicalGeography/provenance/agregación. El directorio vigente determina precedencia sobre reportes históricos.

- ADR-012-AUDIT-REPORT.md
- ADR-026-DENUE-ANALYTICAL-RELEVANCE-GOVERNANCE.md
- CERTIFICACION_FINAL_PERFILADOR_REMOTO_v1.md
- DIRECTORIO_MAESTRO_ADR_DOCUMENTOS_RECTORES_v2.0_OPERATIVO_E2E.md
- HOJA_DE_RUTA_MAESTRA_PERFILADOR_REMOTO_E2E_v1.0.md
- REGISTRO_MAESTRO_RELEASES_DESPLIEGUES_VERCEL_PERFILADOR_REMOTO_v1.0_VALIDADO_CODEX.md
- REPORT_ENGINE_E2E_AUDIT.md
- artifacts/p8-authorization-flow/INFORME_P8_AUTORIZACION.md
- auditoria_master_ui_05_final.md
- auditoria_ui_05_3_B.md
- auditoria_ui_05_3_B_6.md
- auditoria_ui_05_4.md
- database/migrations/adr-0228k/001_source_fingerprint_up.sql
- database/migrations/adr-0228k/002_2025_backfill_up.sql
- database/migrations/inegi-territorial/001_inegi_territorial_dataset_down.sql
- database/migrations/inegi-territorial/001_inegi_territorial_dataset_up.sql
- database/migrations/institutional-project-access/001_project_access_up.sql
- docs/ADR-022.8K-crime-incidence-provenance.md
- docs/H2F2E13-SCINCE-TERRITORIAL-COVERAGE-CONTRACT.md
- docs/H2F2E14-SCINCE-TOPOLOGY-OFFLINE-VALIDATION.md
- docs/H2F2E15-SCINCE-TOPOLOGY-PRECONDITIONS.md
- docs/P8-GEOSPATIAL-EVIDENCE-UI-CONTRACT.md
- docs/P8.3-G-INSTITUTIONAL-PROJECT-ACCESS-MIGRATION.md
- implementation_audit_adr_004_5_1.md
- implementation_audit_adr_005_1.md
- implementation_audit_adr_006_1.md
- implementation_design_adr_004_5_2.md
- implementation_design_adr_006_2.md
- implementation_design_adr_008_1.md
- revision_ui_05_3_B_1.md
- revision_ui_05_3_B_4.md
- revision_ui_05_3_B_4_pre.md
- scripts/inegi/README.md

## Regresión visual acotada

UI_RESOLUTION_BUG reproducible: hidratación ignoraba previewUrl guardado al tomar sólo url. Se conserva previewUrl y se prueba fallback del popup a url del mismo recurso, luego SIN VISTA PREVIA; nunca se fabrica URL desde storagePath. La captura live concreta y existencia del recurso no se verifican en esta fase.

La prueba F7 TEST 34 tenía una cadena de llamada obsoleta: el dispatcher del HEAD ya usa deps.ledger.persistGeointEvent con ledger=GeointEventLogService. Se verifica dispatcher sin diff y se ajusta exclusivamente la aserción al wiring vigente.

## Archivos de esta intervención

- MODIFIED: src/components/ScinceHumanContextPanel.tsx
- MODIFIED: src/components/maps/layers/PhotoEvidenceLayer.tsx
- MODIFIED: src/context/ProjectContext.tsx
- MODIFIED: src/lib/inegiTerritorialResolver.ts
- MODIFIED: src/lib/scinceHumanContextActions.ts
- MODIFIED: src/services/scinceCanonicalContextService.ts
- MODIFIED: src/services/scinceDocumentPublicationService.ts
- MODIFIED: src/types/scinceCanonicalContext.ts
- MODIFIED: src/types/scinceCanonicalSnapshot.ts
- MODIFIED: src/utils/executiveGeointReportDocumentModel.ts
- MODIFIED: src/utils/scinceCanonicalSnapshot.ts
- MODIFIED: src/utils/scinceDocumentContext.ts
- MODIFIED: src/utils/scinceHumanContextFlow.ts
- MODIFIED: tests/testADR02033F7PublicationExportIntegrity.test.ts
- MODIFIED: tests/testP8GeographicEvidenceUi.test.ts
- MODIFIED: tests/testScinceCanonicalContext.test.ts
- MODIFIED: tests/testScinceHumanContextFlow.test.ts
- NEW: docs/P8-SCINCE-MULTIGEOGRAPHY-CONTRACT.md
- NEW: src/types/scinceMultiunit.ts
- NEW: src/utils/scinceQueryGeometry.ts
- NEW: src/utils/scinceIndicatorAggregation.ts
- NEW: src/utils/scinceMultiunitValidation.ts
- NEW: src/lib/inegiMultiunitResolver.ts
- NEW: tests/testP8ScinceMultiunitProductive.test.ts

## Validación final offline

44 suites PASS; 1.032 tests PASS; 1 prueba PostGIS live omitida explícitamente.
Suite nueva productiva: 56 tests; predicados medidos con GEOS local y repository
SQL mock. Las métricas geodésicas SQL y la instalación/dataset real requieren
validación PostGIS live; no se declaran certificadas por esos mocks.
TypeScript (`npx tsc --noEmit --incremental false`): PASS.
Git diff check: PASS (incluye revisión de whitespace de los siete archivos nuevos).
HEAD preservado; staging vacío; sin build completo, conexiones live, Rules, grants,
commit, push, deploy ni generación institucional de DOCX/PDF.
