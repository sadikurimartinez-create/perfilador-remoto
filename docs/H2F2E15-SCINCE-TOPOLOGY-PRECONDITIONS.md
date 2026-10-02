# H.2F.2E.15 Precondiciones topológicas SCINCE multiunidad

Estado: **PRECONDICIONES FORMALIZADAS**. Las observaciones isSimple y Equals de H.2F.2E.14 pasan a requisitos obligatorios. Se conserva SCINCE_CANONICAL_COVERAGE_V1, SUPPORTED_CONTEXT_ONLY y aggregation=PROHIBITED. Sin SQL, repository, servicio, server action, transformación CRS, Firestore, DOCX/PDF ni resolver productivo.

## APIs puras y confianza

`validateScinceCoverageGeometry({mode, geometry, crs, topology})` devuelve VALID (modo e identidad de geometría) o INVALID con código estable. Revisa directamente arrays, dimensiones, números finitos/rangos, placeholder, anillos cerrados y degeneración/repetición de vértices del corredor. **No calcula GEOS en TypeScript**: isValid, isSimple, isEmpty y área provienen de evidencia del motor, que debe incluir exactamente la geometría evaluada, CRS, engine GEOS y versión.

Si falta evidencia, su esquema es incorrecto o pertenece a otra geometría, falla cerrado. No deducir validez a partir de validationStatus=VALID, fotos, derived, fecha o UI. La coincidencia de evidencia es de tipo/coordenadas ordenadas, no del orden de propiedades de un objeto JS. No redondea ni reordena coordenadas. Estos datos deben producirse por un futuro adaptador confiable: **el helper no autentica la procedencia de hechos GEOS**. No exponerlo como aprobación de datos cliente.

`buildScinceCanonicalCoverage` exige ahora `crs` y `topology` en su entrada y llama al helper antes de construir el contrato. Evidencia ausente o inadmisible lanza sólo un código interno. El payload SCINCE_CANONICAL_COVERAGE_V1 no incorpora una segunda verdad de totales ni campos topológicos superfluos; mantiene observaciones y provenance sin agregación.

`classifyScinceCoverageRelation` es una decisión pura sobre validaciones y predicados previamente medidos, ligados a ambas identidades geométricas. No ejecuta operaciones espaciales. Relaciones de filas/unidades del constructor deben proceder de esta clasificación confiable; no basta suministrar una cadena EQUAL_FOOTPRINT. El constructor no mide footprints oficiales: el futuro adaptador será responsable de aplicar el helper a cada geometría fuente y de obtener predicados del par correcto antes de ensamblar.

## CORRIDOR / LineString

Obligatorio: tipo LineString, al menos dos posiciones [lng,lat] finitas dentro de rango, no vacío, sin [0,0], sin segmentos de longitud cero, sin vértices repetidos, endpoints distintos, GEOS isValid=true y **isSimple=true**. La dirección invertida puede ser admisible y simple, pero su identidad canónica cambia.

GEOS-valid **no equivale** a corredor institucionalmente admisible. El fixture L14 tiene isValid=true e isSimple=false. Un recorrido auto-intersectado no representa inequívocamente el corredor analítico y se rechaza, aunque GEOS lo considere válido. No segmentar, eliminar bucles ni cambiar orden para volverlo admisible. Un endpoint repetido que cierra la línea se rechaza conforme al contrato CORRIDOR existente; no convertirla a Polygon.

La validación pura detecta directamente duplicados de posiciones. Cruces entre segmentos sin vértice repetido requieren el resultado isSimple del motor. Declaraciones de fixture puro no sustituyen esa medición en un adaptador real.

## Polygon y MultiPolygon

Obligatorio: tipo Polygon/MultiPolygon, arrays completos, anillos cerrados con al menos tres posiciones distintas, coordenadas finitas/rangos, CRS esperado, no vacío, isValid=true y área finita positiva. GEOS debe certificar ausencia de auto-intersección y validez de huecos, anillos y componentes, incluyendo relaciones entre éstos; que cada array esté cerrado no basta.

Polygon vacío puede exportarse por GEOS como `[[]]`; también se reconoce `[]` y estructuras multipart sin coordenadas. Se rechazan con EMPTY, aunque isValid=true. Área se utiliza sólo como control positivo/cero: no representa porcentaje censal ni peso demográfico. No sumar áreas o filas.

## CRS y reparación

EXPECTED_CRS = **EPSG:4326**, expresado numéricamente como 4326 en entradas. Ambos footprints y sus evidencias deben coincidir. Otro CRS → INVALID. Una transformación futura requerirá autorización, registro y lineage explícitos; esta fase no implementa transformación ni una excepción silenciosa.

Geometría oficial INEGI: puede haber sido reparada por el importador existente, con lineage del dataset y geometría almacenada. Geometría analítica: **no se repara**; una evidencia para coordenadas reparadas no coincide con las originales y se rechaza. Tampoco se repara una unidad oficial durante clasificación: se exige que su geometría almacenada sea admisible. Sin MakeValid, centroides, buffers, snapping, fotos o placeholders alternativos.

## Precedencia y Equals

Orden confirmado por H.2F.2E.14:

1. INVALID: rechazar antes de leer predicados binarios.
2. DISJOINT: sin relación; no incorporar como unidad intersectada.
3. TOUCHES_ONLY: Touches=true e interior-interior F; uso ENUMERATION_ONLY.
4. EQUAL_FOOTPRINT: **Equals=true**, Covers mutuos y geometrías admisibles. Si Covers mutuos son true pero Equals=false, evidencia inconsistente → INVALID.
5. ANALYSIS_COVERS_UNIT: sólo análisis areal cubriendo unidad.
6. UNIT_COVERS_ANALYSIS: unidad cubre análisis.
7. INTERIOR_INTERSECTION: dimensión interior-interior 1 para línea y 2 para análisis areal.

Predicados ausentes, tipos incorrectos, identidades distintas, matriz DE-9IM inválida o hechos contradictorios fallan cerrados. No forzar clasificación. Se conserva la exigencia de unidad areal validada. La línea sobre borde cumple Touches=true y Covers(U,G)=true, pero sigue siendo TOUCHES_ONLY: Covers no puede promoverla a cifras atribuibles al análisis.

## Igualdad topológica e identidad canónica

Equals responde sobre footprint. El fingerprint responde sobre representación canónica exacta, conservando geographyId, tipo, vértices/anillos/componentes y orden. No se modificó el algoritmo SCINCE_COVERAGE_FINGERPRINT_V1 ni el Point INDIVIDUAL.

Polygon A y B pueden tener Equals=true y clasificación EQUAL_FOOTPRINT, pero coordenadas ordenadas distintas: fingerprint(A)≠fingerprint(B), freshness=STALE. No armonizar las reglas ni normalizar el anillo silenciosamente. `evaluateScinceCoverageFreshness` conserva su alcance conceptual: no sustituye la admisión topológica ni valida objetos persistidos sin evidencia confiable.

## Códigos internos

| Código | Rechazo |
|---|---|
| SCINCE_COVERAGE_GEOMETRY_EMPTY | Geometría sin coordenadas / isEmpty |
| SCINCE_COVERAGE_GEOMETRY_NON_FINITE | Coordenadas no numéricas, NaN o Infinity |
| SCINCE_COVERAGE_GEOMETRY_STRUCTURE_INVALID | Tipo o forma de posiciones incorrectos |
| SCINCE_COVERAGE_COORDINATE_OUT_OF_RANGE | Fuera de rangos lng/lat |
| SCINCE_COVERAGE_CORRIDOR_NOT_SIMPLE | Cruce GEOS o repetición interna no consecutiva |
| SCINCE_COVERAGE_CORRIDOR_DEGENERATE | Insuficiente, segmento cero, endpoints iguales o GEOS-invalid |
| SCINCE_COVERAGE_POLYGON_INVALID | Anillo/área/hueco/componente inadmisible |
| SCINCE_COVERAGE_CRS_UNSUPPORTED | CRS incompatible |
| SCINCE_COVERAGE_PLACEHOLDER_COORDINATE | [0,0] en contrato Aguascalientes |
| SCINCE_COVERAGE_TOPOLOGY_EVIDENCE_INVALID | Evidencia ausente, incorrecta o de otra geometría |
| SCINCE_COVERAGE_PAIR_INVALID | Par/predicados inconsistentes o no admitidos |

No son narrativa institucional ni mensajes con datos sensibles. Sin traducción automática a DOCX/UI en esta fase.

## Pruebas y límites

Suite nueva: C1 simple; C2 bow/loop real GEOS; C3 vértice interno repetido; C4 segmento cero; C5 dos puntos iguales; C6 un punto; C7 vacío; C8 NaN; C9 Infinity; C10 placeholder; C11 dirección invertida; C12 endpoint cerrado. Sólo C1/C11 construyen un contrato válido; los demás se rechazan sin mutar entradas.

Además: GEOS-valid/no-simple real → INVALID; Polygon/MultiPolygon vacío; polígonos analíticos/unidad inválidos; anillo abierto y hechos negativos sobre huecos/componentes; ausencia/evidencia desfasada; CRS; rechazo previo a Equals; igualdad que requiere Equals; línea en borde; equivalencia topológica con representación diferente/freshness STALE; par ligado a otro footprint; regresión de precedencia con resultados GEOS reales. La suite pura H.2F.2E.13 usa hechos declarados de fixtures; las suites GEOS miden los hechos con 3.13.1-CAPI-1.19.2, sin SQL ni red.

No se certifica infraestructura desplegada, dataset INEGI real, partición censal ni publicación multiunidad. No installs, migrations, build, persistencia o cambios authz. Siguiente paso exacto: revisión humana del contrato formalizado y autorización separada para el adaptador rector que mida hechos confiables para análisis y unidades; no implementación automática.

## Cierre de validación

Jest: 5 suites, 213 tests, 0 failures; suite nueva de precondiciones: 38 tests. TypeScript (`npx tsc --noEmit`): PASS. Git diff check: PASS, incluidos archivos nuevos/de fases previas editados. El único ajuste tras el primer run fue reconocer la representación GEOS del Polygon vacío `[[]]` como EMPTY, sin modificar geometría.

Rama/HEAD inicial y final: work/informes-r2.5-ui-cleanup / 2ca4fc93b49be6b34ff55c4f80aa6d5879de5191. Staging vacío; sin add/commit/push. PhotoAlbum preservado con SHA256 765F8EBF44A314E607727C1FD4DD35920E3C2BACC74D6B00B46AEA0DC217B46C. Firestore live reads/writes, PostgreSQL writes y PostGIS live queries: 0. Build NO EJECUTADO. Contrato INDIVIDUAL, authz y documentos productivos intactos.
