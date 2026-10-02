# H.2F.2E.14 Validación topológica offline SCINCE

Dictamen: **APROBADA CON OBSERVACIONES** para fixtures sintéticos y predicados de geometría GEOS. LINEAL y POLYGON topológicamente validados en este alcance, sujeto a los controles explícitos del harness. No implementa resolver ni gate productivo.

## Entorno y alcance

Rama work/informes-r2.5-ui-cleanup; HEAD 2ca4fc93b49be6b34ff55c4f80aa6d5879de5191, inicial y final. Staging vacío. Documento rector H2F2E13-SCINCE-TERRITORIAL-COVERAGE-CONTRACT.md leído junto con tipos, utilidades y pruebas.

Motor: GEOS C API, biblioteca ya instalada `C:/Program Files/PostgreSQL/15/bin/libgeos_c.dll`; versión **3.13.1-CAPI-1.19.2**. Python empaquetado 3 ejecuta ctypes directamente, en memoria. No se abre sesión PostgreSQL ni se ejecuta SQL. Docker disponible como CLI pero daemon ausente; Shapely no disponible en runtime empaquetado. No instalamos dependencias ni arrancamos servicios. La DLL forma parte de la instalación local; no representa versión o configuración de infraestructura desplegada.

Predicados efectivamente ejecutados: GEOSIntersects, GEOSTouches, GEOSCovers, GEOSContains, GEOSRelate y GEOSEquals, equivalentes GEOS de los predicados ST_* sobre geometry 2D. Se utilizan API reentrantes _r y liberación de cada geometría/cadena/contexto. No MakeValid, buffers, snapping, centroides, foto-promedios o transformación de CRS.

Fixtures: WKT sintético alrededor de [-102,21], x/y→lng/lat con desplazamientos de 0.001 grados. Cada caso declara analysisSrid/unitSrid=4326, salvo C1, control negativo intencional 3857→4326. No son unidades oficiales, ni expedientes reales, ni cobertura censal observada. Las claves, cifras y URLs INEGI del test contractual son identificadores sintéticos, no afirmaciones de observaciones reales.

## Reproducción

Desde la raíz del repositorio, usando el Python empaquetado:

```powershell
& 'C:/Users/sadi7/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' tests/helpers/scinceGeosOffline.py --output artifacts/qa-scince-h2f2e14/geos-results.json --fixtures tests/fixtures/scince-topology-offline.json
npx jest tests/testScinceTopologyOffline.test.ts tests/testScinceCanonicalCoverage.test.ts tests/testScinceCanonicalSnapshot.test.ts tests/testScinceCanonicalContext.test.ts --runInBand
npx tsc --noEmit
git diff --check
```

`SCINCE_QA_PYTHON` permite seleccionar un Python existente y `SCINCE_QA_GEOS_DIR` una instalación GEOS existente. Sin engine disponible la suite falla explícitamente, no instala ni omite tests. Los tests invocan GEOS cada vez; no toman el JSON de resultados como sustituto del motor. Comparan expectativas predeclaradas del fixture y comprueban predicados discriminantes independientemente de la clasificación.

## Criterio y orden de clasificación

Precondiciones QA: parse correcto, geometrías válidas y no vacías, unidad de área positiva, análisis Polygon/MultiPolygon de área positiva, coordenadas finitas y CRS declarado compatible. CORRIDOR requiere además **isSimple=true** por política conservadora del harness. REJECT/INVALID ante incumplimiento; no se ejecutan predicados binarios sobre entradas rechazadas.

Orden: disjunto→DISJOINT (no candidato al contrato); Touches con interior-interior F→TOUCHES_ONLY; Covers en ambas direcciones y Equals→EQUAL_FOOTPRINT; Covers G→U para polígono→ANALYSIS_COVERS_UNIT; Covers U→G→UNIT_COVERS_ANALYSIS; dimensión interior-interior 1 para línea o 2 para polígono→INTERIOR_INTERSECTION. Cualquier resultado restante sería AMBIGUOUS y no se forzaría. Ninguna ambigüedad ocurrió en esta batería.

La igualdad conserva la precedencia sobre las coberturas unidireccionales; el contacto conserva la precedencia sobre Covers. Covers es inclusión de conjuntos incluyendo borde; no demuestra por sí mismo cifras atribuibles al análisis.

## Matriz experimental

`—` significa predicado no ejecutado porque la entrada fue rechazada, no false. G=análisis, U=unidad. L8 y P12 se expanden por unidad; L9-IN es control adicional. Todos los valores provienen del engine, no de lectura documental.

| Caso | Geometría análisis | Geometría unidad | Intersects | Touches | Covers G→U | Covers U→G | Contains G→U | Contains U→G | Relate | Clasificación esperada | Clasificación obtenida | PASS/FAIL |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 | `LINESTRING (-102.003000 20.998000, -102.001000 20.999000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | false | false | false | false | false | false | FF1FF0212 | DISJOINT | DISJOINT | PASS |
| L2 | `LINESTRING (-102.002000 20.998000, -102.000000 21.000000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | true | false | false | false | false | FF1F00212 | TOUCHES_ONLY | TOUCHES_ONLY | PASS |
| L3 | `LINESTRING (-102.002000 21.005000, -102.000000 21.005000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | true | false | false | false | false | FF1F00212 | TOUCHES_ONLY | TOUCHES_ONLY | PASS |
| L4 | `LINESTRING (-101.990000 21.005000, -101.988000 21.005000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | true | false | false | false | false | FF1F00212 | TOUCHES_ONLY | TOUCHES_ONLY | PASS |
| L5 | `LINESTRING (-102.000000 21.005000, -101.995000 21.005000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | false | false | true | false | true | 1FF00F212 | UNIT_COVERS_ANALYSIS | UNIT_COVERS_ANALYSIS | PASS |
| L6 | `LINESTRING (-101.998000 21.002000, -101.992000 21.008000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | false | false | true | false | true | 1FF0FF212 | UNIT_COVERS_ANALYSIS | UNIT_COVERS_ANALYSIS | PASS |
| L7 | `LINESTRING (-102.002000 21.005000, -101.988000 21.005000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | false | false | false | false | false | 101FF0212 | INTERIOR_INTERSECTION | INTERIOR_INTERSECTION | PASS |
| L9 | `LINESTRING (-102.002000 21.000000, -101.995000 21.000000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | true | false | false | false | false | F11F00212 | TOUCHES_ONLY | TOUCHES_ONLY | PASS |
| L10 | `LINESTRING (-101.998000 21.000000, -101.992000 21.000000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | true | false | true | false | false | F1FF0F212 | TOUCHES_ONLY | TOUCHES_ONLY | PASS |
| L14 | `LINESTRING (-101.999000 21.001000, -101.991000 21.009000, -101.999000 21.009000, -101.991000 21.001000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| L15 | `LINESTRING (-101.998000 21.002000, -101.998000 21.002000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| L8-A | `LINESTRING (-101.995000 21.005000, -101.985000 21.005000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | false | false | false | false | false | 1010F0212 | INTERIOR_INTERSECTION | INTERIOR_INTERSECTION | PASS |
| L8-B | `LINESTRING (-101.995000 21.005000, -101.985000 21.005000)` | `POLYGON ((-101.990000 21.000000, -101.980000 21.000000, -101.980000 21.010000, -101.990000 21.010000, -101.990000 21.000000))` | true | false | false | false | false | false | 1010F0212 | INTERIOR_INTERSECTION | INTERIOR_INTERSECTION | PASS |
| L11 | `LINESTRING (-101.999000 21.005000, -101.991000 21.005000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000), (-101.997000 21.003000, -101.997000 21.007000, -101.993000 21.007000, -101.993000 21.003000, -101.997000 21.003000))` | true | false | false | false | false | false | 1010FF212 | INTERIOR_INTERSECTION | INTERIOR_INTERSECTION | PASS |
| L12 | `LINESTRING (-101.996000 21.005000, -101.994000 21.005000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000), (-101.997000 21.003000, -101.997000 21.007000, -101.993000 21.007000, -101.993000 21.003000, -101.997000 21.003000))` | false | false | false | false | false | false | FF1FF0212 | DISJOINT | DISJOINT | PASS |
| L13 | `LINESTRING (-102.001000 21.002000, -101.987000 21.002000)` | `MULTIPOLYGON (((-102.000000 21.000000, -101.996000 21.000000, -101.996000 21.004000, -102.000000 21.004000, -102.000000 21.000000)), ((-101.992000 21.000000, -101.988000 21.000000, -101.988000 21.004000, -101.992000 21.004000, -101.992000 21.000000)))` | true | false | false | false | false | false | 101FF0212 | INTERIOR_INTERSECTION | INTERIOR_INTERSECTION | PASS |
| L9-IN | `LINESTRING (-102.000000 21.002000, -102.000000 21.005000, -101.995000 21.005000)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | false | false | true | false | true | 11F00F212 | UNIT_COVERS_ANALYSIS | UNIT_COVERS_ANALYSIS | PASS |
| P1 | `POLYGON ((-101.988000 21.012000, -101.986000 21.012000, -101.986000 21.014000, -101.988000 21.014000, -101.988000 21.012000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | false | false | false | false | false | false | FF2FF1212 | DISJOINT | DISJOINT | PASS |
| P2 | `POLYGON ((-101.990000 21.010000, -101.988000 21.010000, -101.988000 21.012000, -101.990000 21.012000, -101.990000 21.010000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | true | false | false | false | false | FF2F01212 | TOUCHES_ONLY | TOUCHES_ONLY | PASS |
| P3 | `POLYGON ((-101.990000 21.002000, -101.988000 21.002000, -101.988000 21.008000, -101.990000 21.008000, -101.990000 21.002000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | true | false | false | false | false | FF2F11212 | TOUCHES_ONLY | TOUCHES_ONLY | PASS |
| P4 | `POLYGON ((-101.992000 21.002000, -101.988000 21.002000, -101.988000 21.008000, -101.992000 21.008000, -101.992000 21.002000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | false | false | false | false | false | 212101212 | INTERIOR_INTERSECTION | INTERIOR_INTERSECTION | PASS |
| P5 | `POLYGON ((-101.998000 21.002000, -101.992000 21.002000, -101.992000 21.008000, -101.998000 21.008000, -101.998000 21.002000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | false | false | true | false | true | 2FF1FF212 | UNIT_COVERS_ANALYSIS | UNIT_COVERS_ANALYSIS | PASS |
| P6 | `POLYGON ((-102.002000 20.998000, -101.988000 20.998000, -101.988000 21.012000, -102.002000 21.012000, -102.002000 20.998000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | false | true | false | true | false | 212FF1FF2 | ANALYSIS_COVERS_UNIT | ANALYSIS_COVERS_UNIT | PASS |
| P7 | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | false | true | true | true | true | 2FFF1FFF2 | EQUAL_FOOTPRINT | EQUAL_FOOTPRINT | PASS |
| P8 | `POLYGON ((-101.995000 21.005000, -101.985000 21.005000, -101.985000 21.015000, -101.995000 21.015000, -101.995000 21.005000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | false | false | false | false | false | 212101212 | INTERIOR_INTERSECTION | INTERIOR_INTERSECTION | PASS |
| P9 | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000), (-101.997000 21.003000, -101.997000 21.007000, -101.993000 21.007000, -101.993000 21.003000, -101.997000 21.003000))` | `POLYGON ((-101.996000 21.004000, -101.994000 21.004000, -101.994000 21.006000, -101.996000 21.006000, -101.996000 21.004000))` | false | false | false | false | false | false | FF2FF1212 | DISJOINT | DISJOINT | PASS |
| P10 | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000), (-101.997000 21.003000, -101.997000 21.007000, -101.993000 21.007000, -101.993000 21.003000, -101.997000 21.003000))` | `POLYGON ((-101.996500 21.003500, -101.993500 21.003500, -101.993500 21.006500, -101.996500 21.006500, -101.996500 21.003500))` | false | false | false | false | false | false | FF2FF1212 | DISJOINT | DISJOINT | PASS |
| P11 | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000), (-101.997000 21.003000, -101.997000 21.007000, -101.993000 21.007000, -101.993000 21.003000, -101.997000 21.003000))` | `POLYGON ((-101.998000 21.004000, -101.995000 21.004000, -101.995000 21.006000, -101.998000 21.006000, -101.998000 21.004000))` | true | false | false | false | false | false | 212101212 | INTERIOR_INTERSECTION | INTERIOR_INTERSECTION | PASS |
| P12-A | `MULTIPOLYGON (((-102.000000 21.000000, -101.996000 21.000000, -101.996000 21.004000, -102.000000 21.004000, -102.000000 21.000000)), ((-101.992000 21.000000, -101.988000 21.000000, -101.988000 21.004000, -101.992000 21.004000, -101.992000 21.000000)))` | `POLYGON ((-101.999000 21.001000, -101.998000 21.001000, -101.998000 21.002000, -101.999000 21.002000, -101.999000 21.001000))` | true | false | true | false | true | false | 212FF1FF2 | ANALYSIS_COVERS_UNIT | ANALYSIS_COVERS_UNIT | PASS |
| P12-B | `MULTIPOLYGON (((-102.000000 21.000000, -101.996000 21.000000, -101.996000 21.004000, -102.000000 21.004000, -102.000000 21.000000)), ((-101.992000 21.000000, -101.988000 21.000000, -101.988000 21.004000, -101.992000 21.004000, -101.992000 21.000000)))` | `POLYGON ((-101.991000 21.001000, -101.990000 21.001000, -101.990000 21.002000, -101.991000 21.002000, -101.991000 21.001000))` | true | false | true | false | true | false | 212FF1FF2 | ANALYSIS_COVERS_UNIT | ANALYSIS_COVERS_UNIT | PASS |
| P13 | `MULTIPOLYGON (((-102.000000 21.000000, -101.996000 21.000000, -101.996000 21.004000, -102.000000 21.004000, -102.000000 21.000000)), ((-101.992000 21.000000, -101.988000 21.000000, -101.988000 21.004000, -101.992000 21.004000, -101.992000 21.000000)))` | `POLYGON ((-101.995000 21.001000, -101.993000 21.001000, -101.993000 21.003000, -101.995000 21.003000, -101.995000 21.001000))` | false | false | false | false | false | false | FF2FF1212 | DISJOINT | DISJOINT | PASS |
| P14 | `POLYGON ((-101.999000 21.001000, -101.991000 21.009000, -101.999000 21.009000, -101.991000 21.001000, -101.999000 21.001000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| P15 | `POLYGON ((-101.999000 21.001000, -101.991000 21.001000, -101.991000 21.009000, -101.999000 21.009000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| P16 | `POLYGON ((-101.990000 21.010000, -101.990000 21.000000, -102.000000 21.000000, -102.000000 21.010000, -101.990000 21.010000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | true | false | true | true | true | true | 2FFF1FFF2 | EQUAL_FOOTPRINT | EQUAL_FOOTPRINT | PASS |
| I1 | `LINESTRING (-102 21)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| I2 | `POLYGON EMPTY` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| I3 | `MULTIPOLYGON EMPTY` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| I4 | `LINESTRING (-102 21, NaN 21.001)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| I5 | `LINESTRING (-102 21, Infinity 21.001)` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| I6 | `POLYGON ((-101.999000 21.001000, -101.998000 21.001000, -101.997000 21.001000, -101.999000 21.001000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| I7 | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | `POLYGON EMPTY` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| I8 | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | `POLYGON ((-101.999000 21.001000, -101.991000 21.009000, -101.999000 21.009000, -101.991000 21.001000, -101.999000 21.001000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |
| C1 | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | `POLYGON ((-102.000000 21.000000, -101.990000 21.000000, -101.990000 21.010000, -102.000000 21.010000, -102.000000 21.000000))` | — | — | — | — | — | — | — | INVALID | INVALID | PASS |

## Resultados LINEAL

L1–L15: 15 escenarios obligatorios, 15 PASS, 0 FAIL. L8 se evalúa contra dos unidades; L9-IN añade un caso mixto borde/interior: **17 comparaciones**, 17 PASS, 0 FAIL.

- L2/L3/L4: sólo contacto. L9: coincidencia parcial de borde y resto fuera. L10: todo un segmento sobre el borde, con Covers(U,G)=true pero Contains(U,G)=false; **TOUCHES_ONLY**, no UNIT_COVERS_ANALYSIS.
- L5/L6: línea contenida, aunque L5 tenga un endpoint en borde. L9-IN: borde parcial más tramo interior, no sólo contacto; contenido por U.
- L7 entra y sale de U; L8 relaciona ambas unidades adyacentes; L11 alterna superficie y hueco; L13 atraviesa dos componentes. Interior y exterior de la línea tienen dimensión 1.
- L12 dentro del hueco: disjunto aunque quede dentro del bbox.
- L14 válido para GEOS pero no simple: rechazado por política conservadora, no presentado falsamente como isValid=false.
- L15 degenerado: inválido GEOS.

Máscaras concretas G→U: `1********` acredita intersección interior 1D; `1*1******` acredita tramo interior y tramo exterior. Esta última NO prueba por sí sola que ambos endpoints estén fuera o una entrada/salida completa: el harness etiqueta INTERIOR_AND_EXTERIOR, no “atraviesa” universalmente. Los fixtures de cruce tienen endpoints y trayectorias conocidos; un adaptador futuro deberá comprobarlos si utiliza esa expresión. `F********` y Touches identifica interior-interior vacío; mirar sólo Intersects no basta. Contención se comprueba con Covers(U,G), no con mera intersección interior.

## Resultados POLYGON

P1–P16: 16 escenarios obligatorios, 16 PASS, 0 FAIL. P12 tiene una unidad por componente: **17 comparaciones**, 17 PASS, 0 FAIL.

P2/P3 contactos; P4/P8 intersección parcial con dimensión interior-interior 2 (`2********`); P5 U cubre G; P6 G cubre U; P7 igualdad exacta. P9/P10 unidad dentro del hueco: no Intersects ni Covers. P11 cruza el borde del hueco: interior parcial. P12 cubre una unidad por cada componente y P13 excluye la unidad entre componentes; bbox no sustituye el footprint. P14 bow-tie inválido, P15 rechazo de parser por anillo abierto. P16 orden alternativo topológicamente equivalente: Equals y Covers mutuos true, pero fingerprint conservador distinto.

## Entradas inválidas y CRS

I1–I8 y C1: **9 controles adicionales**, 9 PASS, 0 FAIL. Una coordenada de línea/anillo abierto no se corrige automáticamente. Bow-tie y polígonos collineales de área cero se rechazan. Polygon EMPTY/MultiPolygon EMPTY tienen isValid=true en GEOS, pero isEmpty=true y se rechazan. NaN/Infinity se rechazan, registrando el diagnóstico GEOS. Unidad vacía o inválida también rechazada.

El primer intento del fixture collinear usó una diagonal decimal; GEOS encontró una superficie diminuta positiva por representación IEEE y la geometría no era exactamente degenerada. Se corrigió únicamente el fixture a tres vértices con **y idéntica**, área cero experimental. No se introdujo tolerancia, snapping ni corrección del engine o contrato. La matriz entregada corresponde a esta versión final reproducible.

GEOS conserva SRID como metadata, no valida/reproyecta CRS por sí mismo. C1 se rechaza explícitamente antes de predicados. Un adaptador futuro debe comprobar CRS y rangos numéricos de ambas entradas; si una transformación se autoriza, debe declararse y conservar lineage. No hay transformación escondida ni mediciones de superficie en metros: el área se usa sólo como control positivo/cero, jamás para ponderar cifras.

## Equals y controles adicionales recomendados

GEOSEquals fue ejecutado en todos los pares admitidos y confirmó P7/P16. No se consultó igualdad sobre geometrías inválidas o vacías. En las entradas válidas no vacías de esta batería, Covers mutuos y Equals coinciden; no se afirma haber encontrado un contraejemplo válido. **Recomendación**: usar Equals como control adicional explícito después de los rechazos, manteniendo la representación ordenada para vigencia.

La línea auto-intersectada L14 demuestra que isValid no basta para rechazarla: isSimple es un requisito metodológico adicional, no una definición de invalidez GEOS. H.2F.2E.13 no formuló ese requisito explícitamente. Se recomienda ratificarlo para CORRIDOR antes del adaptador; no se alteró el contrato.

## Puente contractual, deduplicación y representatividad

Se usan geometrías GeoJSON escritas por GEOS a partir del WKT para probar CORRIDOR, Polygon y MultiPolygon contra el contrato existente. CURRENT/STALE son exclusivamente conceptuales. Pruebas de coordenada modificada, orden alternativo, hueco y componente confirman identidad conservadora; estructura insuficiente devuelve INVALID. La geometría topológicamente equivalente P16 NO borra el cambio de fingerprint.

Dos manzanas→una AGEB y dos referencias a igual sourceRowKey→una observación; duplicado idéntico de unidad también se deduplica. Duplicado contradictorio lanza SCINCE_COVERAGE_CONTRACT_INVALID. AGEB y manzana hija permanecen observaciones distintas sin suma. Valores null y provenance se preservan. Los códigos fuente del puente son ficticios: no se pretende demostrar geometría oficial por correspondencia de código.

aggregation=PROHIBITED en todas las salidas contractuales. No populationTotal/housingTotal agregados, estimatedPopulation, weightedPopulation, areaPercentagePopulation ni proporciones. Las cifras se conservan sólo dentro de cada fila fuente y expresan la unidad completa. Touches produce ENUMERATION_ONLY. Sin inferencias criminológicas, geometría por fotos ni fallback a centroide.

## Defectos y observaciones

- CRÍTICOS: 0.
- ALTOS: 0 en clasificación experimental final.
- MEDIOS: 1 observación metodológica: el rechazo L14 requiere isSimple adicional a isValid; deberá incorporarse expresamente a requisitos del futuro adaptador mediante revisión humana. No es un bug descubierto del ensamblador: H.2F.2E.13 declara que sólo valida estructura y recibe relaciones confiables previamente clasificadas.
- BAJOS: 1 recomendación de control redundante Equals para EQUAL_FOOTPRINT. No se halló contradicción de Covers mutuos en entradas válidas no vacías.

No se modificaron types, utilidad, pruebas ni documento H.2F.2E.13. Su guardia de fingerprint NO valida topología; darle VALID a un bow-tie fabricado puede producir un fingerprint o CURRENT conceptual. Esa limitación estaba expresamente declarada y no concede publicación. El futuro pipeline deberá ejecutar el rechazo topológico antes de construir/evaluar el contrato; no confundir el evaluador conceptual con un gate productivo.

## Límites y siguiente paso exacto

Validación válida para fixtures y GEOS 3.13.1 2D geometry. No se certifican PostGIS SQL, planeamiento, índices, consultas, geography, tolerancias métricas, versión GEOS desplegada o geometrías INEGI reales. No se prueba partición/completitud demográfica; no se autoriza agregación. El harness es QA, no resolver alternativo. La carga local de la DLL no consulta infraestructura.

Siguiente paso: revisión humana para ratificar el rechazo de corredores no simples y el control Equals, formalizar precondiciones del adaptador rector y sólo después autorizar su diseño/implementación en una fase separada. No continuar automáticamente.

## Regresión y conservación

Pruebas finales: **4 suites, 175 tests, 0 failures** (motor topológico nuevo + contrato + snapshot + contexto). TypeScript: **PASS** (`npx tsc --noEmit`). Git diff check: **PASS**, incluidos archivos nuevos; sólo avisos LF/CRLF. Build NO EJECUTADO. Firestore live reads/writes=0; PostgreSQL writes=0; PostGIS live queries=0. Sin migraciones, deployment, expedientes reales, instalación de dependencias o git add/commit/push.

PhotoAlbum SHA256 esperado y preservado: 765F8EBF44A314E607727C1FD4DD35920E3C2BACC74D6B00B46AEA0DC217B46C. Archivos productivos protegidos intactos. Artefactos QA en artifacts/qa-scince-h2f2e14/.
