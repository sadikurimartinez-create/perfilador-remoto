# H.2F.2E.13 Contrato territorial SCINCE para LINEAL y POLYGON

Estado: metodología de **contexto por unidad** definida; contrato de diseño aislado y pruebas puras. Precondiciones obligatorias formalizadas por H.2F.2E.15, detalladas en `H2F2E15-SCINCE-TOPOLOGY-PRECONDITIONS.md`. LINEAL y POLYGON: **SUPPORTED_CONTEXT_ONLY**. No soporte de agregación, consulta productiva, persistencia o publicación documental multiunidad. INDIVIDUAL continúa con SCINCE_CANONICAL_SNAPSHOT_V1 sin cambios.

## Autoridad y alcance de la evidencia

Se aplican el Directorio Maestro v2.0 (la fuente analítica no sustituye la geografía canónica; ADR-021 como orquestación SCINCE), el contrato canónico territorial existente y ADR-026 §19 (contexto territorial, sin atribución de atributos del área a personas/unidades económicas). La mención de contexto agregado en gobernanza describe el nivel de la fuente, no autoriza sumar intersecciones arbitrarias ni interpolar censos.

Inventario obtenido **exclusivamente de código, esquema, SQL de ingesta y fixture local**. No se verifican instalación, existencia, conteos o cobertura de una base live. No se descargaron ZIP/SHP/CSV oficiales. Las garantías observadas del importador no equivalen a certificación topológica cruzada entre niveles del dataset desplegado.

Fuentes locales inspeccionadas:

- `database/migrations/inegi-territorial/001_inegi_territorial_dataset_up.sql`: tres tablas, constraints, identidad e índices.
- `scripts/inegi/import-aguascalientes-2020.mjs`: capas, normalización geográfica, filas y condiciones READY.
- `scripts/inegi/importerCore.cjs`: canonicalRowKey, validación de capa y cobertura.
- `scripts/inegi/README.md`: productos, checksums y alcance declarado.
- `tests/fixtures/inegi/aguascalientes-cpv2020-minimal.json`: fila manzana documentada; geometría de pruebas sintética, no oficial.
- `src/lib/inegiTerritorialResolver.ts`: Point, ST_Covers, selección por nivel y fallback AGEB.
- `src/utils/canonicalProjectGeography.ts`: CORRIDOR/LineString, POLYGON/Polygon o MultiPolygon; derived y representaciones Firestore.
- `src/utils/scinceGeographyBinding.ts`, snapshot canónico y servicio de contexto; pruebas INDIVIDUAL existentes.

## Inventario territorial

| Nivel | Capa que exige el importador | Geometría almacenada | Demografía en esquema/ingesta |
|---|---|---|---|
| ESTADO | 01ent.shp | MultiPolygon, EPSG:4326 | No |
| MUNICIPIO | 01mun.shp | MultiPolygon, EPSG:4326 | No |
| LOCALIDAD | 01l.shp | MultiPolygon, EPSG:4326 | No |
| AGEB | 01a.shp | MultiPolygon, EPSG:4326 | Sí: filas MZA=000 |
| MANZANA | 01m.shp | MultiPolygon, EPSG:4326 | Sí: demás MZA admitidas |

`inegi_territorial_geography.geom` no admite POINT. El importador exige capas poligonales y promueve a multi, transforma a EPSG:4326, aplica Force2D/MakeValid/CollectionExtract y ST_Multi. Puede reparar la geometría original; un análisis futuro debe usar la geometría almacenada con lineage del artefacto importado y registrar esta limitación. No introducir nuevas reparaciones silenciosas de la geometría analítica.

READY exige conteos positivos AGEB/manzana geográficos y demográficos y geometrías no vacías/válidas en SRID 4326. No prueba que la unión de manzanas cubra exactamente una AGEB ni ausencia de superposición entre polígonos del mismo nivel. Estado/municipio/localidad sirven para identificación, no para inventar censos faltantes. La fila fixture usa clave `01:001:0001:0017:001`; su población es de esa fila, no de un corredor.

## Identidad de observación

`source_row_key` es una clave territorial construida con códigos conservando ceros: ENT:MUN:LOC:AGEB para AGEB y ENT:MUN:LOC:AGEB:MZA para manzana. No es un hash de fila, ID global ni garantía temporal. La PK real es `(dataset_id, geographic_level, source_row_key)`. `source_cvegeo` identifica el footprint geográfico y tiene unicidad `(dataset_id, geographic_level, source_cvegeo)`; las columnas de códigos demográficos no tienen una segunda restricción UNIQUE independiente.

Identidad del contrato: tupla JSON `[datasetId, year, version, demographicGeographicLevel, sourceRowKey]`. Año/versión refuerzan lineage; se fijan desde un único dataset del envelope. No mezclar datasets ni versiones. Cada fila contiene su geographicCode y nivel demográfico; la provenance completa del dataset se comparte explícitamente en el envelope y se hereda por esas identidades. No reconstruir una clave oficial desde un ID visual.

Dos manzanas que resuelven a una AGEB referencian **una** observación AGEB. Duplicados idénticos se deduplican; duplicados con cifras/relación contradictorias se rechazan. Nunca sumar la misma AGEB por cada manzana. Incluso deduplicada, una AGEB junto con sus manzanas sigue siendo una partición solapada: **no sumar niveles**. Que una manzana esté cubierta no implica que la AGEB de sus cifras también lo esté; la relación de la fila censal se evalúa sobre el footprint AGEB propio.

## Predicados evaluados y método elegido

Sea G la geometría canónica completa y U una unidad oficial almacenada, ambas válidas y en el mismo CRS. Utilizar semántica `geometry` sin buffer/tolerancia añadidos. Un índice/bounding box puede filtrar candidatos; su centro nunca representa G.

1. INTERSECTION como conjunto G∩U es diagnóstico espacial, no repartición de población. `ST_Intersects(U,G)` selecciona candidatos con cualquier punto común: incluye borde, no acredita población representativa.
2. `ST_Touches(U,G)` distingue contacto sin intersección de interiores: enumeración únicamente, sin publicar las cifras como contexto del área analítica.
3. `ST_Covers(G,U)` identifica unidades completamente cubiertas por un polígono analítico, incluyendo borde. `ST_Covers(U,G)` identifica la geometría analítica completamente incluida en una unidad; las cifras de U siguen siendo de U.
4. `ST_Contains` exige además contacto de interiores y excluye geometrías ubicadas sólo sobre un borde. Se evaluó, pero no se selecciona como filtro general: perdería contactos territoriales relevantes. No es sinónimo de Covers.
5. Interior-interior de dimensión 1 para LINEAL y 2 para POLYGON (DE-9IM/ST_Relate) distingue intersección interior de contacto de borde. Para afirmar que una línea **atraviesa** una unidad, además debe salir de ella y verificarse su relación topológica; INTERIOR_INTERSECTION por sí sola no afirma cruce completo.

Referencias primarias: [ST_Intersects](https://postgis.net/docs/ST_Intersects.html), [ST_Touches](https://postgis.net/docs/ST_Touches.html), [ST_Covers](https://postgis.net/docs/ST_Covers.html), [ST_Contains](https://postgis.net/docs/ST_Contains.html), [ST_Relate](https://postgis.net/docs/ST_Relate.html). Estas consultas documentales no son consultas PostGIS live.

Precedencia ratificada por H.2F.2E.14 y formalizada en H.2F.2E.15: INVALID → rechazo; DISJOINT → sin relación; contacto de borde → TOUCHES_ONLY; Equals=true con Covers mutuos → EQUAL_FOOTPRINT; G cubre U → ANALYSIS_COVERS_UNIT; U cubre G → UNIT_COVERS_ANALYSIS; restantes candidatos con intersección interior de dimensión correcta → INTERIOR_INTERSECTION. Covers mutuos sin Equals es evidencia inconsistente y se rechaza. Rechazar resultados inválidos/inconsistentes o dimensión inesperada, no forzar clasificación. Las relaciones espaciales no se calculan mediante el constructor: la función pura de decisión recibe predicados ligados a las geometrías admitidas y un futuro adaptador único deberá medirlos con GEOS/PostGIS.

### LINEAL

El nombre de producto LINEAL corresponde al tipo canónico **CORRIDOR / LineString**. No introduce un segundo tipo LINEAL en el core. Es una línea sin ancho: no puede contener/cubrir una unidad territorial de superficie positiva. Puede tocar, intersectar el interior, atravesar o estar contenida en unidades. No convertirla automáticamente en corredor areal con ST_Buffer, radio de barrido ni ancho supuesto. Si se necesita ancho, debe existir una decisión metodológica y geometría areal canónica validada por separado.

Unidad mínima geográfica disponible: manzana; mínima demográfica efectiva: manzana si existe fila, AGEB si sólo hay fila AGEB vinculada. La cobertura propia de ambas se evalúa separadamente. La población de un territorio intersectado **no es población del corredor**. Agregación prohibida; contacto de borde sólo enumeración. Figuras de unidades con intersección interior pueden mostrarse individualmente, con etiqueta de unidad completa, nivel, fuente y limitación.

### POLYGON

Admite Polygon y MultiPolygon con todos sus componentes y huecos. Se distinguen unidades parcialmente intersectadas, unidades totalmente cubiertas por G y unidades que contienen completamente G. Un hueco no forma parte del área analítica; el bounding box no decide cobertura.

Unidad mínima y fuente efectiva iguales a LINEAL. Incluso si G cubre completamente varias unidades, esta fase **no autoriza suma**: faltan prueba de partición disjunta, completitud, jerarquía consistente, universo censal comparable y decisión institucional para admitir totales. Si G coincide exactamente con una unidad oficial, la fila puede mostrarse como observación de esa unidad; el contrato general sigue siendo CONTEXT_ONLY y no declara soporte EXACT productivo.

## Representatividad y cifras

| Situación | Publicación individual futura | Suma | Ponderación/prorrateo |
|---|---|---|---|
| Sólo borde | Enumerar identidad, sin cifras atribuibles al análisis | Prohibida | Prohibida |
| Intersección parcial | Cifras completas de U con advertencia explícita | Prohibida | Prohibida |
| G dentro de U | Contexto de U; no cifras de G | Prohibida | Prohibida |
| U totalmente cubierta | Cifras completas de U | No autorizada en esta fase | Prohibida |
| Sin fila censal | Demografía no disponible | No sustituir por cero | Prohibida |

No población×superficie, viviendas×superficie, densidad uniforme ni interpolación areal. No hay respaldo metodológico explícito en la evidencia rectora inspeccionada para aplicarlos. Deduplicar evita un error contable pero no demuestra representatividad. null se conserva: no convertirlo en cero ni calcular totales incompletos. Marginación sigue ausente; observedAt permanece null, sin usar importedAt/completedAt.

## SCINCE_CANONICAL_COVERAGE_V1

Se crean tipos y utilidades **aislados**: no importados por servicios, acciones, flujo humano, exportadores, modelos o mapas productivos. Son una especificación ejecutable para fixtures previamente clasificados. No reemplazan SCINCE_CANONICAL_SNAPSHOT_V1 ni el gate INDIVIDUAL.

- schemaVersion, support=SUPPORTED_CONTEXT_ONLY y aggregation=PROHIBITED.
- projectId y geographyBinding: geographyId, tipo CORRIDOR/POLYGON y fingerprint versionado.
- coverageMode LINE_INTERSECTION_CONTEXT o POLYGON_INTERSECTION_CONTEXT, sin radios/centros.
- dataset único con ID, año, versión y provenance (producto, URLs oficiales, ambos SHA256, importación/finalización).
- territorialUnits[]: nivel localizado, código oficial, relación territorial y referencias a observaciones. Pueden existir unidades sin fuente demográfica.
- sourceRows[]: identidad compuesta, nivel demográfico, clave/código oficiales, relación del footprint fuente, variables originales/null, observedAt null y uso explícito. TOUCHES_ONLY → ENUMERATION_ONLY; demás → FULL_SOURCE_UNIT_CONTEXT_ONLY.
- limitations[]: originales más prohibición de atribución de cifras al análisis, agregación y prorrateo.

Sin campo total, porcentaje areal, población estimada o narrativa. coverageCount y demographicSourceCount son respectivamente longitudes de listas únicas; **se derivan**, no se almacenan como segunda verdad. No confundir esos conteos de unidades/observaciones con cifras demográficas. Componentes reconstruibles mediante dataset+clave+geographicCode. No inventar timestamp de observación ni punto de consulta para provenance multiunidad.

El ensamblador exige CRS 4326 y evidencia GEOS de admisibilidad de la geometría analítica ligada exactamente a sus coordenadas; aplica el helper puro de precondiciones antes de construir el contrato. CORRIDOR exige isValid e isSimple, no vacío, finito, sin degeneración, repetición de vértices o cierre de endpoints. Polygon/MultiPolygon exige estructura completa, coordenadas finitas, no vacío, isValid y área positiva: GEOS debe validar anillos, huecos y componentes. No reparación, segmentación, eliminación de bucles ni reordenamiento automáticos. La evidencia no puede provenir de UI ni de una etiqueta VALID persistida.

El ensamblador además valida identidad, referencias de manzana a AGEB propia, enteros no negativos/null y conflictos duplicados; clona datos. No calcula topología ni verifica existencia real de filas o completitud espacial. Las relaciones de unidades/filas siguen siendo entradas previamente clasificadas por el camino de predicados confiables, no por texto declarado del cliente. El evaluador de vigencia conceptual recibe objetos confiables del contrato; no valida un snapshot persistido ni concede publicación. Ningún tipo de diseño ni relación declarada desde UI puede franquear un gate productivo futuro.

## Fingerprint y vigencia

No modificar CANONICAL_GEOGRAPHY_FINGERPRINT_V1 del Point. Extensión separada SCINCE_COVERAGE_FINGERPRINT_V1: SHA256 de payload fijo con versión, geographyId, tipo canónico, tipo de geometría y coordenadas completas exactas y ordenadas. Vinculación projectId aparte. No fotografías, derived, viewport, fechas, centroides, metadatos visuales ni redondeo.

CORRIDOR conserva dirección/orden del recorrido. Polygon conserva inicio/orientación/orden de anillos; MultiPolygon conserva además orden de componentes. No rotar/sortear/normalizar geométricamente de forma silenciosa. Una reordenación equivalente topológicamente también resulta STALE: elección conservadora de identidad de representación canónica, no claim de equivalencia topológica. JSON considera +0/-0 equivalentes; no diferencia territorial. Se rechaza un vértice [0,0] como placeholder en este contrato destinado al dataset de Aguascalientes.

Geometría idéntica con IDs y versión iguales → CURRENT conceptualmente. Cualquier coordenada modificada (incluido un cambio menor que 7 decimales), orden/anillo/hueco/componente, tipo o geographyId distinto → STALE. Formato/estado inválido → INVALID. Validación de arrays es estructural: **no certifica** polígonos simples, áreas positivas, ausencia de cruces/huecos inválidos ni geometría oficial válida. Antes de query futura exigir validación topológica local y rechazar, no reparar, G inválida. Deserializar Firestore con guardas numéricas previas usando el contrato existente; este helper recibe únicamente geometría canónica ya deserializada.

## Límites, representación y siguiente paso

La cobertura urbana importada no demuestra cobertura censal completa de todo el estado ni de un área analítica rural. Polígonos/manzanas adyacentes pueden compartir bordes; contactos no agregan población. Parent/child pueden solaparse; no sumar. READY e integridad por fila no prueban partición territorial inter-nivel. Preservar evidencia de transformaciones del importador, hashes y año censal. No inferencias de riesgo, vulnerabilidad, causalidad, criminogenicidad, perfil ni predicción.

Una futura salida multiunidad requeriría representación cartográfica de G, unidades efectivamente relacionadas, huecos y niveles fuente diferenciados para ser inteligible; **sólo diagnóstico**, ningún mapa implementado. Antes de publicación deberá haber decisión institucional sobre presentación y gate de vigencia, sin extender el DOCX/PDF en esta fase.

La batería topológica local y offline se ejecutó en H.2F.2E.14; H.2F.2E.15 cierra las observaciones isSimple/Equals mediante precondiciones puras y regresiones. Siguiente paso exacto: revisión humana del contrato formalizado y autorización separada para el adaptador rector CONTEXT_ONLY que produzca evidencia GEOS/PostGIS confiable y reutilice almacenamiento/orquestación existentes. Agregación requiere otra decisión y evidencia; no avanzar automáticamente.

## Validación de esta fase

Pruebas puras de identidad completa CURRENT/STALE LINEAL y POLYGON, cambios subprecisión, orden/anillos/huecos/multipart, independencia de fotos/derived, rechazo de fallback/placeholders, fuente AGEB compartida, duplicados conflictivos, parent/child sin suma, null/provenance y relación fuente independiente. Regresiones Point/contexto/snapshot mantienen el rechazo productivo a CORRIDOR y POLYGON. Predicados espaciales documentados **no ejecutados ni certificados**.

Sin build, migraciones, acceso live, escritura de datos, cambios authz, cambios documentales, mapas o git add/commit/push. Dictamen H.2F.2E.13: **METODOLOGÍA DEFINIDA** para contexto multiunidad, no para agregación demográfica ni operación productiva.
