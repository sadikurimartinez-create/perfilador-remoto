# P8 — SCINCE Compact Snapshot V2

Adenda contractual vigente bajo ADR-021 (orquestación SCINCE), subordinada a
ADR-000, gobernanza humana y ADR-013/ADR-020.33 para el Document Engine.
No constituye un ADR independiente ni sustituye certificaciones históricas.
Baseline de esta implementación: `5beed54e14f18e6124953032a1bbb77f21a00766`,
rama `work/informes-r2.5-ui-cleanup`. Implementación y certificación offline;
no autoriza staging, commit, push, despliegue, grants ni operaciones live.

## Representación e invariantes

`SCINCE_COMPACT_SNAPSHOT_V2` usa `SCINCE_RAW_COLUMN_VECTOR_V1`: 230 columnas
fuente en orden acreditado y 222 indicadores no identificadores. No truncar
columnas, unidades, supresiones, códigos, métodos, motivos ni provenance para
reducir payload. Los vectores conservan valores fuente y nulos; las observaciones
de sólo contacto (`ENUMERATION_ONLY`) conservan identidad sin cifras publicables.
El catálogo determina el orden de columnas e indicadores, con fingerprints
separados. Un código desconocido o una longitud incompatible se rechaza.

La representación cambia; el contrato semántico se conserva. La selección
espacial sigue naciendo de `inegi_territorial_geography`, seguida de observaciones
por clave. No se fabrican geometrías para observaciones no espaciales. Geografía
canónica, componentes, huecos, relaciones FULL/PARTIAL/TOUCHED, métricas y área
analítica conservan sus contratos P8. No cambia el SQL de selección, la gobernanza
de radios ni el método territorial. No prorratear población por superficie,
mezclar niveles censales, convertir supresiones en cero ni atribuir causalidad
criminal. El perfil oficial 2020 se conserva; `estimatedCurrentProfile` sigue
nulo y no se implementa estimación 2020 → año actual.

## Lectura y escritura

Lectura compatible: legacy V1, expanded V2 histórico y Compact V2. La escritura
productiva nueva usa Compact V2. No hay migración automática, reescritura de
observaciones antiguas ni reconstrucción de paquetes históricos al descargarlos.
Los snapshots históricos y paquetes DOCX/PDF permanecen inmutables.

Identidades vinculadas: proyecto, geografía y su fingerprint, dataset/año/versión,
release exacto, catálogo, normalización, fuente y checksums. Se verifican
fingerprints de observación, conjunto seleccionado, perfil y contenido; la vista
de revisión tiene fingerprint propio. Son controles de consistencia, no grants
ni certificación topológica live. No sustituir silenciosamente release o fuente.

## Consulta y revisión PPC

`ANALYZE_SCINCE` explícito precede a consulta. La respuesta contiene snapsho
compacto y vista acotada de revisión con los 222 agregados, estados, métodos,
motivos, limitaciones y provenance. Consultar no equivale a incorporar.

La decisión humana explícita exige `WRITE` y revalidación independiente de
`ANALYZE_SCINCE`, nueva consulta, igualdad del contenido revisado, verificación
de fuentes durables, vigencia y radios. El servidor revalida WRITE antes de
persistir y la geografía dentro de la transacción. Se conserva sólo el snapsho
compacto incorporado con actor institucional y fecha del servidor; no se acepta
autoridad del cliente. No incorporación automática ni bypass por rol.

## Materialización y publicación

`scinceContextMaterializationService` es la única autoridad de materialización.
Verifica release/catálogo exactos y observaciones durables por clave en sesiones
PostgreSQL READ ONLY. Reconstruye valores tipados y perfil, comprobando todos
los fingerprints. El objeto `MaterializedScinceContext` es transitorio en memoria
servidor: no se persiste, cachea como snapshot, registra en logs ni devuelve al
navegador. La falta, alteración o discrepancia de fuente falla de forma cerrada.

Publicación Compact: `GENERATE_REPORT` explícito → PPC incorporado → freshness
CURRENT recalculada → geografía y configuración vigentes → fuente/release/
catálogo verificados → materialización `purpose="REPORT"` → contexto documental
→ modelos institucionales → integridad semántica → DOCX/PDF.
ANALYZE_SCINCE y WRITE no implican GENERATE_REPORT. Cualquier gate fallido impide
la generación Compact, sin publicar un informe con contexto omitido por silencio.

El contexto documental conserva 222 indicadores, unidades, relaciones y métricas,
identidades, normalización, métodos/motivos, derivaciones, limitaciones, provenance,
fingerprints, decisión PPC y vigencia. El adaptador de materialización reutiliza
la semántica histórica de carátula, cuerpo y anexo. La carátula sigue limitada a
diez indicadores, con fuente/año y provenance por cifra. Los hechos extensos del
anexo se segmentan en continuaciones sin pérdida para respetar el renderer PDF;
no se crea un renderer ni un Document Engine paralelo.

## Boundary cliente/servidor

El navegador inicia `GENERATE` en la ruta institucional existente mediante
`SERVER_DOCUMENT_GENERATION_V1`: projectId, intención y formato DOCX/PDF/ALL.
No envía modelos finales ni un generationContext expandido. El servidor autoriza
y reconstruye todos los modelos desde fuentes persistidas autorizadas, valida
semántica y genera/revalida el paquete. Sólo responde con manifiesto y artefactos.
Los fingerprints enviados por cliente nunca son autoridad documental final.

La preparación transportable puede contener identidad, perfil/resumen, cobertura,
limitaciones, provenance, PPC/freshness y fingerprints. Excluye `rawIndicators[]`,
`rawScinceIndicators[]`, indicadores expandidos por unidad, filas materializadas
completas y `MaterializedScinceContext`. El builder compartido discrimina la
admisión transportable de la admisión final inyectada por el flujo servidor;
no consulta PostgreSQL ni replica el materializador.

## Límites y certificación

Snapshot compacto y respuesta total de consulta: cada uno `< 800000` bytes.
La meta de contexto documental cliente es `<= 250000` bytes. No elevar límites
ni serializar la expansión como snapshot. REPORT puede usar mayor memoria
transitoria. Los bytes de los artefactos DOCX/PDF son distintos del contexto
documental transportable y siguen el boundary binario institucional vigente.

El gate offline cubre Individual, corredor LineString, Polygon y MultiPolygon:
geografía → área analítica → selección → resolver → revisión → PPC → persistencia
simulada → read-back → materialización → REPORT → contexto → carátula/cuerpo/
anexo → DOCX/PDF reales locales. Mantiene estrés de 52 unidades/52 observaciones,
230 columnas/222 indicadores y negativos de grants, geografía, radios, fuentes,
release/catálogo, fingerprints y fallos de materialización.

Los fixtures usan fuentes públicas y topología/métrica offline. El transporte
PostgreSQL y la persistencia Firestore son dobles explícitos; no acreditan SQL
ejecutado en PostGIS live ni autorizan operaciones productivas. La equivalencia
documental compara semántica para la misma fuente, no bytes con fechas distintas.
La creación de DOCX y PDF no certifica paginación física de Word/LibreOffice.

Contratos complementarios: [multigeografía](P8-SCINCE-MULTIGEOGRAPHY-CONTRACT.md),
[radio territorial](P8-SCINCE-RADIUS-TERRITORIAL-CONTRACT.md) y
[carátula](P8-SCINCE-REPORT-COVER-CONTRACT.md). Conservan precedencia y contenido
histórico; esta adenda gobierna representación y boundary de Compact V2.
