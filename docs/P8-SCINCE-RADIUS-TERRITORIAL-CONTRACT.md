# P8 — SCINCE radio territorial y perfil sociodemográfico

Fecha: 2026-10-03. Baseline Git conservado: 8587939c66b1db02c8d5666850b3b3346ab53bc3.
Esta intervención evoluciona P8-SCINCE-MULTIGEOGRAPHY-CONTRACT.md sin desecharlo.
Sus 44 suites/1,032 pruebas constituyen la regresión histórica. La autorización
del nuevo prompt permite derivar un área de entorno; no permite modificar la
geometría canónica, ejecutar operaciones live ni preparar staging.

## Decisión territorial y precisión

El expediente conserva su geometría original completa (incluyendo huecos y
componentes). `multiunit.geometry` y `geographyBinding` acreditan ese origen.
`multiunit.scinceAnalysisArea.geometry` acredita por separado el footprint
utilizado para consultar INEGI. Su `sourceGeometryRevision` es el fingerprint
canónico; también se vincula el geographyId. El snapshot nuevo es V2 incluso
para Point. V1 y V2 anteriores siguen siendo legibles, sin reinterpretarlos
retroactivamente como áreas por radio.

1. Point: centro original, cobertura cero y radio institucional explícito.
2. LineString: `ST_LineInterpolatePoint(metric_geom,0.5)` sobre la línea métrica.
   Representa la mitad de su longitud y permanece sobre la línea proyectada.
   El centroid puede salir de la línea; PointOnSurface no acredita su posición
   central por longitud. Ninguno sustituye la geometría canónica.
3. Polygon/MultiPolygon: centro de `ST_MinimumBoundingRadius(metric_geom)`.
   Minimiza el círculo envolvente del conjunto completo. Centroid puede caer
   fuera de un polígono cóncavo o en un hueco; PointOnSurface acredita interior
   pero no minimiza cobertura. No se exige que este centro analítico sea un
   punto operativo dentro del polígono. Los huecos interiores no aumentan el
   círculo envolvente; los componentes separados sí contribuyen.

La proyección AEQD WGS84 en metros se deriva del centro del envelope de cada
geometría, sin EPSG/UTM hardcodeado a Aguascalientes. Es un método métrico local,
no una afirmación de radio geodésico exacto mundial. `ST_MaxDistance` mide el
máximo al conjunto completo proyectado, no distancia cartesiana en grados.
El máximo de segmentos lineales ocurre en vértices en esa representación
métrica. Radio analítico = cobertura + expansión contextual configurada.

Dominio explícito de la implementación V1: latitudes hasta ±80°, amplitud de
longitud/latitud hasta 5°, sin cruce del antimeridiano, radio total hasta 100 km.
Son límites técnicos conservadores, no radios institucionales aprobados.
Fuera del dominio se rechaza la consulta; no se cambia de CRS silenciosamente.
La tolerancia geodésica del entorno PostGIS concreto requiere certificación
live antes de habilitar operación institucional. No se certifica precisión
submétrica mediante mocks.

El buffer de 128 segmentos es circunscrito: radio de construcción = radio
analítico / cos(pi/128). Ese margen numérico (~0.0301%) se acredita como
`constructionRadiusMeters`, sin ocultarlo en la expansión institucional.
El área se vuelve a EPSG:4326, se serializa a 15 decimales y se exige
`ST_Covers(published_geom,geom)` sobre **toda** la geometría original, no sólo
sus vértices ni su centro. Fallar esa comprobación aborta antes de consultar
unidades. La superficie aproximada se calcula con `ST_Area(...::geography)`.
El área serializada es la que se usa realmente en intersecciones y overlay.

Fuentes primarias auditadas:
- [ST_Transform](https://postgis.net/docs/ST_Transform.html): proyección PROJ dinámica y transformación inversa.
- [ST_LineInterpolatePoint](https://postgis.net/docs/ST_LineInterpolatePoint.html): posición fraccional por longitud.
- [ST_MinimumBoundingRadius](https://postgis.net/docs/ST_MinimumBoundingRadius.html): centro/radio envolvente mínimo.
- [ST_MaxDistance](https://postgis.net/docs/ST_MaxDistance.html): máximo en unidades proyectadas.
- [ST_Buffer](https://postgis.net/docs/ST_Buffer.html): aproximación poligonal de arcos; geography también utiliza una proyección interna.

## Configuración gobernada sin defaults numéricos

`ScinceRadiusConfiguration` exige versión y referencia de aprobación institucional:

| Campo | Parámetro server-side | Regla |
|---|---|---|
| individualBaseRadiusMeters | SCINCE_DEFAULT_RADIUS_M | positivo, obligatorio |
| lineContextExpansionMeters | SCINCE_LINE_CONTEXT_EXPANSION_M | no negativo, obligatorio |
| polygonContextExpansionMeters | SCINCE_POLYGON_CONTEXT_EXPANSION_M | no negativo, obligatorio |
| governanceReference | SCINCE_RADIUS_GOVERNANCE_REFERENCE | referencia institucional explícita |

No se escribió ningún valor en configuración local, Preview ni producción.
Los valores 300/200/400 de fixtures son exclusivamente sintéticos de QA.
Cero puede ser una expansión explícita; no equivale a parámetro ausente.
Sin configuración íntegra/válida el runtime devuelve
`SCINCE_RADIUS_CONFIGURATION_REQUIRED` antes de abrir conexión PostgreSQL.
No hace fallback a la cobertura directa anterior. Los parámetros se leen en
cada consulta server-side, sin recompilar lógica nuclear; las operaciones de
configuración/reinicio del entorno siguen sujetas a su gobierno institucional.

## Dataset y perfil reproducible

Auditoría offline de la migración vigente, `scripts/inegi/importerCore.cjs` y
`scripts/inegi/import-aguascalientes-2020.mjs` (mapping/import de demographics):
se acreditan sólo POBTOT, VIVTOT, VIVPAR_HAB, VIVPAR_DES. `source_fields` declara
el mapping importado; no acredita por sí mismo un catálogo adicional disponible.
No se leyó PostgreSQL ni un dataset live: disponibilidad real de filas y calidad
de cobertura siguen pendientes de validación autorizada.

`rawScinceIndicators` conserva valores nulos, año/dataset vía provenance y
observationId/sourceReference. `derivedSociodemographicProfile` agrupa
population (POBTOT) y housing (las tres variables de viviendas).
Las dimensiones sin variables acreditadas se omiten, nunca se rellenan con
cero. Un nombre desconocido queda en `unclassifiedIndicatorNames` sin crear
una dimensión. El perfil se reconstruye determinísticamente de indicadores,
agregados admisibles, año y datasetIdentity; su validación exige igualdad.
`officialBaseProfile` es copia desacoplada e íntegra del perfil oficial.
`estimatedCurrentProfile` permanece null. No hay tasas de crecimiento,
densidad inventada ni estimación 2020→2026.

Las unidades son las intersectadas por el área derivada; no se mantiene una
segunda consulta censal contra el origen. Ambos footprints se conservan para
trazabilidad y las pruebas acreditan unidades del entorno que no intersectan
la geometría original. Las relaciones FULL/PARTIAL/TOUCHED y métricas de cada
unidad se miden contra el área analítica. `coverageMode` corresponde a ese
footprint poligonal; la modalidad narrativa procede de `geographyBinding`.

Se conserva COUNT/RATE/PERCENTAGE/AVERAGE/INDEX/CATEGORICAL/UNKNOWN.
Los agregados conservan los requisitos de unidades completas, un único nivel,
interiores disjuntos, universo comparable y denominadores acreditados.
Se prioriza MANZANA y sólo en su ausencia AGEB; no se suman niveles padre/hijo.
Una relación parcial no habilita población prorrateada por superficie.
Sólo contacto mantiene ENUMERATION_ONLY, sin indicadores censales publicables.

## Cableado, seguridad y vigencia

- Runtime: `resolveScinceCanonicalContext` autoriza ANALYZE_SCINCE antes del
  resolver. `resolveInegiMultiunit` exige configuración en todas las modalidades.
- `resolveInegiSourceCoverage` conserva el núcleo anterior para regresiones y
  soporta internamente el área nueva. No es API/server action ni recibe input
  público. Las pruebas históricas Point V1 usan dependencias explícitas; la
  ruta operativa ordinaria no utiliza su fallback ni el resolver Point directo.
- Una transacción REPEATABLE READ READ ONLY contiene dataset, área, validación
  topológica, intersecciones y prueba de partición; máximo 500 filas candidatas,
  timeout 8 s, cache 60 s/100 entradas, sin cache de fallos.
- La clave incluye proyecto, fingerprint original, identidad/hashes de dataset
  y configuración completa (incluyendo referencia de gobernanza).
- Incorporación: WRITE + reacquisición ANALYZE_SCINCE + comparación completa
  del resultado revisado; sólo el timestamp de adquisición se excluye.
  Cambiar radio/configuración exige consultar y revisar otra vez.
- Vigencia UI y admisión documental verifican configuración server-side vigente;
  un cambio o ausencia de configuración vuelve STALE el snapshot por radio.
  El validador puro acredita estructura/lineage, no topología live nueva.
- Se mantienen grant explícito, ausencia de bypass de roles, READ separado,
  revisión PPC, gate documental y conservación del resto de iaAnalysis.
- No se alteró Firebase Rules, migraciones, privilegios ni PostgreSQL authority.

## UI, mapa e informe

La metodología está en un details desplegable: centro, cobertura, expansión,
radio total, área aproximada, unidades INEGI y año. El perfil expone únicamente
población y vivienda, con indicadores y referencias de unidad fuente.
La configuración ausente se comunica como falta de radio institucional aprobado.

AnalysisMap recibe un overlay temporal mediante evento local del panel de
revisión. Se vincula proyecto + geographyId + geometría exacta. Puede ocultarse;
no escribe ni reemplaza la capa rectora. Desaparece al desechar el resultado,
incorporarlo, desmontar el panel o cambiar el origen/proyecto. No constituye
autorización ni fuente de persistencia. No se modifica previewUrl/url ni popup.

Summary y Anexo Técnico distinguen punto/corredor/área y acreditan el radio,
la geometría original, el área separada, configuración/método y perfil oficial.
Se conserva la advertencia de cifras completas por unidad fuente, sin población
de intersecciones parciales ni atribución individual. Sólo se probaron modelos
documentales offline; no se invocó GENERATE_REPORT ni exportación live.

## Archivos de esta intervención (22)

Nuevos en esta intervención (8):
- src/types/scinceAnalysisArea.ts
- src/utils/scinceSociodemographicProfile.ts
- src/lib/scinceRadiusConfiguration.ts
- src/lib/scinceAnalysisArea.ts
- src/components/maps/layers/ScinceAnalysisAreaLayer.tsx
- tests/helpers/scinceRadiusOffline.py
- tests/testP8ScinceRadiusTerritorial.test.ts
- docs/P8-SCINCE-RADIUS-TERRITORIAL-CONTRACT.md

Modificados sobre el cierre multigeografía anterior (14):
- src/components/AnalysisMap.tsx
- src/components/ScinceHumanContextPanel.tsx
- src/lib/inegiMultiunitResolver.ts
- src/lib/scinceHumanContextActions.ts
- src/services/scinceCanonicalContextService.ts
- src/services/scinceDocumentPublicationService.ts
- src/types/scinceCanonicalContext.ts
- src/types/scinceMultiunit.ts
- src/utils/scinceCanonicalSnapshot.ts
- src/utils/scinceMultiunitValidation.ts
- src/utils/scinceDocumentContext.ts
- src/utils/scinceHumanContextFlow.ts
- tests/testScinceCanonicalContext.test.ts
- tests/testP8ScinceMultiunitProductive.test.ts

Varios archivos de la intervención anterior siguen sin rastrear; este listado
describe cambios desde su cierre, no su estado respecto a HEAD. El diff acumulado
contra HEAD también contiene aquella intervención. No se enumeraron archivos
ajenos/sensibles ni se preparó el índice.

## Validación y límites del PASS

45 suites PASS, 1,091 tests PASS, 1 test live deliberadamente omitido.
59 pruebas nuevas acreditan los 30 requisitos y casos adicionales de seguridad,
configuración, UI real y overlay real. TypeScript (`--noEmit --incremental false`)
PASS. `git diff --check` PASS para tracked; archivos nuevos revisados aparte.

El helper QA usa exclusivamente DLL PROJ/GEOS locales y fixtures sintéticos en
memoria, incluyendo otra región (París), huecos y MultiPolygon. El centro, radio,
buffer y predicados de contención/intersección se calculan con motores reales.
El transporte SQL, dataset y columnas métricas de repositorio son mocks
explícitos; no certifican funciones SQL ejecutadas en un servidor PostgreSQL.

Contrato PostGIS pendiente: ejecutar SQL parametrizado de cálculo con las
cuatro modalidades en una instalación autorizada; verificar PROJ/GEOS/PostGIS,
dominio/tolerancia métrica, contención después de serialización, superficie
geography, selección de unidades contextuales, índices, timeout y límite.
No ejecutar este gate sin nueva autorización live. No se provisionaron radios.

SAFE_TO_STAGE=YES para estos archivos concretos tras revisión humana, aislando
el baseline previo. SAFE_TO_DEPLOY_PREVIEW=NO para habilitar operación SCINCE
institucional hasta aprobar radios y certificar PostGIS. P8_SCINCE_RADIUS_READY=YES
exclusivamente para la implementación/validación offline solicitada.
