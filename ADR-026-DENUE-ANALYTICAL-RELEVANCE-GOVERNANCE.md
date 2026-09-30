# ADR-026 - Gobernanza de Pertinencia Analitica DENUE y Producto Cartografico Derivado

## Estado y control documental

| Campo | Valor |
| --- | --- |
| Identificador | ADR-026 |
| Estado | RECTOR PREIMPLEMENTACION - PENDIENTE DE IMPLEMENTACION Y CERTIFICACION |
| Fecha | 2026-09-29 |
| Proyecto | PERFILADOR REMOTO SSPE-CEIPOL |
| Materia | Pertinencia analitica DENUE y producto cartografico derivado |
| ADR padre | ADR-000 |
| ADR relacionados | ADR-011, ADR-020.31, ADR-021, ADR-022, ADR-023, ADR-024 y ADR-025 |
| Componentes preservados | R3.2B.1, R3.2B.2, R3.2B.3, R3.2B.4 y R3.2B.5 |
| Implementacion | No iniciada |
| Certificacion | No iniciada |

## 1. Contexto

El Perfilador Remoto dispone de una cadena gobernada para adquirir observaciones DENUE, normalizarlas, admitirlas como capas cartograficas, ensamblar un producto de observacion, seleccionar puntos por legibilidad y renderizar un mapa institucional neutral. Esa cadena preserva correctamente a DENUE como contexto economico-territorial observado.

La seleccion cartografica existente no determina pertinencia analitica. En particular, la dispersion espacial, el orden de entrada, la actividad economica y la cercania a otra fuente no bastan para declarar que una unidad economica es vulnerable, criminogena, peligrosa, prioritaria o de riesgo.

Se requiere una segunda rama futura que permita representar relaciones analiticas defendibles sin alterar el producto contextual existente, sin duplicar los motores de relaciones vigentes y sin transferir a una maquina decisiones reservadas a la persona perfiladora criminologica, en adelante PPC.

## 2. Problema

Sin un contrato rector especifico existe riesgo de:

- confundir observaciones territoriales con evidencia criminal;
- interpretar la proximidad espacial como causalidad o riesgo;
- usar la seleccion de legibilidad R3.2B.4 como ranking analitico;
- asignar relevancia por el giro comercial;
- crear un grafo paralelo al ecosistema ERG y multisource;
- publicar relaciones propuestas sin validacion humana;
- reconstruir puntos de incidencia a partir de agregados;
- sustituir Point, LineString o Polygon por radios contextuales;
- adoptar puntuaciones o fallbacks legacy sin metodologia trazable.

## 3. Decision arquitectonica

Se establece una rama analitica DENUE separada, derivada y fail-closed. Esta rama reutilizara el ecosistema de relaciones institucionales existente, producira propuestas explicables y solo podra publicar relaciones aceptadas por una PPC.

La decision central es:

```text
DENUE = OBSERVACION TERRITORIAL
DENUE != EVIDENCIA CRIMINAL
DENUE != HALLAZGO
DENUE != RIESGO
DENUE != VULNERABILIDAD
```

Ningun giro comercial podra clasificarse automaticamente como vulnerable, criminogeno, peligroso, prioritario o de riesgo por su mera actividad economica.

## 4. Alcance y no alcance

Este ADR gobierna:

- la semantica de una futura relacion analitica DENUE;
- los limites de automatizacion y las decisiones reservadas a la PPC;
- las relaciones admisibles y sus requisitos;
- la preservacion de la geografia canonica;
- el producto cartografico analitico derivado;
- su publicacion, trazabilidad, versionado y compatibilidad con R3.2B.1-B.5;
- los principios editoriales del anexo tecnico.

Este ADR no:

- implementa contratos TypeScript, motores, adaptadores, UI, renderers o pruebas;
- aprueba un indice numerico de pertinencia o vulnerabilidad;
- modifica el mapa contextual DENUE;
- convierte DENUE en evidencia criminal;
- autoriza decisiones autonomas de riesgo, causalidad o vulnerabilidad;
- altera limites, vertices o tipo de la geografia canonica.

## 5. Secuencia epistemica obligatoria

Toda evolucion debera preservar la siguiente secuencia:

```text
OBSERVACION
  -> CORRELACION
  -> INDICIO
  -> RELACION ANALITICA
  -> VULNERABILIDAD VALIDADA
  -> RIESGO
```

Cada transicion exige su propio contrato, evidencia y autoridad. Ningun resultado automatico puede saltar etapas. Una correlacion puede permanecer como dato contextual sin convertirse en indicio. Una relacion aceptada no constituye por si misma vulnerabilidad. La vulnerabilidad validada tampoco constituye necesariamente riesgo. El riesgo requerira un contrato institucional separado cuando resulte aplicable.

## 6. Dos productos cartograficos diferentes

### 6.1 Mapa DENUE contextual

Es el producto R3.2B.5 existente. Representa el universo DENUE admitido mediante una seleccion determinista orientada exclusivamente a legibilidad y dispersion cartografica. Su funcion es proporcionar contexto economico-territorial neutral.

Sus `selectedLayerIds` no expresan importancia, prioridad, vulnerabilidad, riesgo ni pertinencia analitica.

### 6.2 Mapa DENUE analitico

Es un producto futuro y derivado. Su flujo sera:

```text
DENUE observado
  -> relaciones gobernadas propuestas
  -> revision PPC
  -> relaciones ACCEPTED
  -> producto cartografico individualizado
```

Solo podra representar relaciones con validacion humana `ACCEPTED`. Nunca sustituira, mutara ni reclasificara el mapa contextual.

## 7. Responsabilidad de la maquina y de la PPC

La inteligencia artificial y los motores deterministas pueden detectar, medir, correlacionar, proponer y advertir. La PPC conserva la decision analitica final.

### 7.1 Operaciones automaticas permitidas

- detectar y validar identificadores;
- comprobar `expedienteId` y `geographyId`;
- medir distancias en metros;
- comprobar contencion espacial;
- comprobar compatibilidad temporal;
- validar lineage y referencias de fuente;
- contar fuentes independientes y detectar dependencias;
- detectar vinculos explicitos;
- formular propuestas y limitaciones;
- excluir entradas incompletas mediante reglas fail-closed.

### 7.2 Decisiones reservadas a la PPC

- significado criminologico;
- pertinencia sustantiva respecto de una hipotesis;
- apoyo o refutacion sustantivos;
- vulnerabilidad;
- riesgo;
- causalidad;
- racional analitico publicable;
- resolucion de contradicciones;
- aceptacion, rechazo o solicitud de revision;
- autorizacion final de publicacion del mapa analitico.

## 8. Taxonomia de relaciones

| Relacion | Definicion | Prerrequisitos y datos | Automatizable | Validacion PPC | Limitaciones | Publicacion |
| --- | --- | --- | --- | --- | --- | --- |
| `SPATIAL_PROXIMITY` | Distancia o relacion topologica entre DENUE y otra entidad gobernada. | Coordenadas validas, mismo expediente y geografia aplicable, metodo metrico identificado. | Si, como medicion. | Si, para significado. | Proximidad no implica causalidad, apoyo ni riesgo. | Solo dentro de una relacion `ACCEPTED`. |
| `EXPLICIT_SOURCE_LINK` | Vinculo declarado mediante ID o referencia formal verificable. | IDs compatibles, referencias de fuente y lineage completo. | Si. | Si, cuando se interprete analiticamente. | El vinculo acredita identidad o asociacion, no conducta. | Permitida si es trazable y `ACCEPTED`. |
| `EVIDENCE_COINCIDENCE` | Coincidencia verificable entre un DENUE y evidencia gobernada. | Evidencia admitida, coordenadas o enlace explicito, temporalidad y lineage. | Parcialmente. | Si. | Coincidencia no convierte al DENUE en evidencia criminal. | Solo con racional PPC y limitaciones. |
| `FINDING_RELATION` | Relacion entre un DENUE y un hallazgo institucional. | `findingId` y enlace explicito o cadena hallazgo-evidencia-DENUE. | Deteccion parcial. | Si, obligatoria. | No inferir desde titulo, resumen o categoria. | Solo si la cadena es reconstruible. |
| `HYPOTHESIS_SUPPORT` | Propuesta de que una relacion aporta soporte a una hipotesis humana vigente. | `hypothesisId`, referencias de soporte y lineage. | Solo propuesta. | Si, obligatoria. | La coincidencia espacial o semantica no constituye apoyo automatico. | Solo despues de aceptacion expresa. |
| `HYPOTHESIS_CONTRADICTION` | Propuesta de que una relacion contradice una hipotesis humana vigente. | `hypothesisId`, evidencia contradictoria y lineage. | Solo propuesta. | Si, obligatoria. | Ausencia de observacion no equivale a refutacion. | Solo despues de aceptacion expresa. |
| `CONTEXTUAL_ASSOCIATION` | Asociacion territorial descriptiva sin afirmacion criminal. | Geografia compatible y fuente observada. | Si. | Si para uso analitico; no para contexto neutral. | Debe conservar lenguaje no causal. | Puede publicarse como contexto con disclosure; en mapa analitico requiere `ACCEPTED`. |
| `MULTISOURCE_CORROBORATION` | Convergencia de fuentes independientes sobre un fenomeno definido. | Dos o mas fuentes gobernadas, independencia evaluada, compatibilidad y lineage. | Parcialmente. | Si, obligatoria. | Fuentes derivadas no cuentan como independientes; corroboracion no prueba causalidad. | Solo con revision PPC y dependencias visibles. |

## 9. Contrato conceptual DenueAnalyticalRelation

El contrato futuro debera contener, como minimo, los siguientes grupos semanticos. Esta definicion es conceptual y no constituye todavia un contrato TypeScript.

| Grupo | Campos minimos | Semantica e invariantes |
| --- | --- | --- |
| Identidad | `relationId`, `denueLayerId`, `sourceEvidenceId`, `expedienteId`, `geographyId` | Identidad estable, no inventada y perteneciente al mismo contexto institucional. |
| Relaciones | `relationTypes` | Una o mas relaciones de la taxonomia cerrada y versionada. |
| Vinculos | `linkedEvidenceIds`, `linkedFindingIds`, `linkedHypothesisRefs`, `linkedSourceRefs` | Referencias verificables; los arreglos vacios no se completan por inferencia. |
| Espacio | `spatialMetrics` | Metodo, unidades en metros, coordenadas de entrada, precision, contencion o distancia aplicable. |
| Tiempo | `temporalCompatibility` | Fechas observadas, regla empleada, compatibilidad y faltantes. |
| Fuentes | `sourceIndependence` | Independencia, dependencia parcial, derivacion o estado desconocido. |
| Lineage | `lineage` | Cadena de origen, transformacion, reglas y referencias. |
| Separacion epistemica | `measuredFacts`, `proposedInterpretations` | Los hechos medidos no se mezclan con interpretaciones propuestas. |
| Limites | `limitations` | Limitaciones materiales y epistemicas no vacias cuando correspondan. |
| Resultado maquina | `machineAssessment` | Estado automatico restringido a `DETECTED`, `PROPOSED` o `INSUFFICIENT`. |
| Decision humana | `humanValidation` | Estado PPC, identidad, fecha y racional. |
| Publicacion | `publicationEligibility` | Resultado fail-closed derivado del contrato, no una inferencia libre. |
| Metodo | `methodologyVersion` | Version inmutable de reglas y calculos aplicados. |

Los campos de identidad, lineage, metodo y decision no podran reconstruirse silenciosamente a partir de texto libre.

## 10. Machine assessment

Los estados automaticos minimos son:

- `DETECTED`: existen hechos medidos o vinculos verificables, sin interpretacion sustantiva aceptada;
- `PROPOSED`: la maquina propone una relacion y explicita su base y limitaciones;
- `INSUFFICIENT`: faltan elementos para proponer una relacion defendible.

Quedan prohibidos como estados automaticos, entre otros:

- `CONFIRMED_RISK`;
- `VULNERABLE`;
- `CRIMINOGENIC`;
- cualquier equivalente que certifique riesgo, causalidad o significado criminologico.

## 11. Human validation

Los estados minimos de validacion PPC son:

- `PENDING`;
- `ACCEPTED`;
- `REJECTED`;
- `REQUIRES_REVISION`.

Toda validacion debera conservar `validatedBy`, `validatedAt` y `rationale`. Una transicion a `ACCEPTED` sin esos elementos sera invalida. La validacion no altera los hechos medidos ni elimina propuestas o decisiones previas; las conserva en el historial.

## 12. Reutilizacion obligatoria de ERG y multisource

No se creara un grafo paralelo.

Las relaciones DENUE deberan entrar, mediante adaptadores o extensiones compatibles, al ecosistema compuesto por:

- Evidence Relationship Graph de ADR-011;
- `MultiSourceCorrelationEngine` de ADR-023;
- `institutionalMultisourceConvergence` de ADR-025.

La extension debera preservar IDs, expediente, geografia, trazabilidad, lineage, independencia de fuentes, compatibilidad espacial y temporal, contradicciones, limitaciones y revision humana.

Las puntuaciones y umbrales actualmente usados por esos motores no se convierten automaticamente en una metodologia de pertinencia DENUE. Su reutilizacion numerica requerira validacion metodologica especifica.

## 13. Geografia canonica

Se preservan sin degradacion:

```text
INDIVIDUAL = Point
CORRIDOR   = LineString
POLYGON    = Polygon
```

Los radios o envolventes contextuales:

- no sustituyen la geografia canonica;
- no crean una nueva geografia canonica;
- no modifican limites, vertices ni nodos;
- no degradan LineString o Polygon a Point;
- solo pueden servir para adquisicion, preseleccion o encuadre, con metodo y version explicitos.

Regla obligatoria: `contextual radius != canonical geography`.

## 14. Proximidad espacial

La proximidad se medira en metros mediante la utilidad geoespacial gobernada existente, actualmente `SpatialLayerEngine`, o su sucesora expresamente autorizada. No se calculara con diferencias directas de grados.

La proximidad:

- no implica causalidad;
- no implica riesgo;
- no implica vulnerabilidad;
- no implica apoyo o refutacion automaticos de una hipotesis;
- no transforma una observacion territorial en evidencia criminal.

Toda metrica debera registrar entradas, metodo, unidad, resultado, precision o redondeo, version y limitaciones.

## 15. Ambito INDIVIDUAL

El centro es el `Point` canonico. El radio contextual sera un parametro explicito, positivo, versionado y trazable. La distancia a una entidad se medira desde el punto canonico. El radio no mutara el punto ni ampliara silenciosamente la geografia del expediente.

## 16. Ambito CORRIDOR

El corredor conserva su `LineString`. Una envolvente contextual podra emplearse para adquisicion o preseleccion, pero la relacion espacial real utilizara, cuando corresponda, la distancia minima a la polilinea.

El centro geometrico, el extremo mas lejano y un margen contextual pueden documentar un encuadre de consulta. No reemplazan la polilinea ni autorizan pertenencia por un circulo sustituto.

## 17. Ambito POLYGON

El poligono conserva su `Polygon`. El contrato distinguira expresamente:

- `inside polygon`;
- `outside polygon`;
- `distance to boundary`;
- `contextual envelope`.

El centroide, el vertice mas lejano y un margen contextual podran apoyar adquisicion o encuadre. El circulo resultante nunca sustituira el poligono ni sus limites.

## 18. Incidencia

Solo se permitira correlacion DENUE-incidencia cuando existan incidentes individualizados, coordenadas validas, lineage suficiente y jurisdiccion o expediente aplicable compatible.

Los productos agregados de ADR-022 destinados a exportacion no contienen por si mismos la individualizacion espacial necesaria. Queda prohibido reconstruir, estimar o inventar puntos a partir de frecuencias, porcentajes, series temporales u otros agregados.

## 19. SCINCE

SCINCE puede aportar contexto territorial mediante AGEB, manzana, poblacion, viviendas y geometria oficial cuando esos datos existan realmente en el contrato observado.

Los atributos agregados de un area no se atribuiran a una unidad economica ni a sus personas usuarias, propietarias o trabajadoras. Toda relacion sera territorial y agregada, con nivel geografico, dataset, periodo y limitaciones visibles.

## 20. OSINT

Queda prohibida la vinculacion automatica basada unicamente en semejanza entre nombre comercial DENUE y una mencion OSINT.

Una relacion requerira al menos un identificador explicito, coordenada gobernada, referencia formal u otro vinculo verificable, ademas de provenance y lineage suficientes. La coincidencia nominal puede registrarse como candidato insuficiente, nunca como relacion publicable.

## 21. Publicacion del mapa DENUE analitico

El mapa analitico solo mostrara relaciones cuya validacion humana sea `ACCEPTED` y cuya elegibilidad de publicacion haya superado todos los gates aplicables.

Cada elemento representado debera permitir identificar:

- identificador cartografico;
- establecimiento;
- actividad observada, sin clasificacion de riesgo implicita;
- distancia o metrica pertinente;
- tipo o tipos de relacion;
- fuentes vinculadas;
- limitaciones;
- estado de validacion PPC;
- referencia de trazabilidad y version metodologica.

La ausencia de relaciones `ACCEPTED` producira un estado negativo gobernado o la omision del producto, nunca relaciones de relleno.

## 22. Individualizacion cartografica

Todo marcador numerado o alfanumerico tendra una correspondencia biunivoca y determinista con un registro de tabla. El identificador visible, el `relationId` y el `denueLayerId` deberan reconstruirse desde la auditoria del producto.

La estrategia concreta de etiquetado pertenece a la fase de renderer. No podra alterar coordenadas, ocultar limitaciones ni reutilizar el orden de seleccion B.4 como prioridad analitica.

## 23. Presupuesto de visuales

Se conserva el maximo ordinario de cinco visuales institucionales. El mapa DENUE analitico sera candidato a visual secundario y no ampliara ese limite.

La composicion ejecutiva debera conservar el mapa territorial principal y aplicar las reglas vigentes de elegibilidad, deduplicacion, relacion con hallazgos y presupuesto. La existencia de un mapa analitico elegible no garantiza automaticamente su seleccion editorial.

## 24. Anexo tecnico

El anexo tecnico no repetira indiscriminadamente cientos de observaciones DENUE cuando ese listado no aporte utilidad analitica. El diseño futuro privilegiara:

- universo total observado y admitido;
- conteos por actividad solo cuando la clasificacion sea confiable;
- parametros de seleccion cartografica;
- relaciones `ACCEPTED`;
- trazabilidad compacta;
- limitaciones y metodologia;
- inventario exhaustivo solo cuando sea requerido por una obligacion institucional expresa.

El universo contextual y las relaciones analiticas se presentaran por separado y sin duplicacion plana.

## 25. Estados negativos y triple confirmacion

Este ADR no relaja las reglas institucionales de triple confirmacion de negativos o no disponibilidad. Cuando el contrato fuente las exija, un resultado negativo debera preservar de forma coherente:

1. estado explicito de adquisicion o consulta;
2. resultado o conteo observado compatible con ese estado;
3. provenance, query reference o lineage que permita verificarlo.

`NO_DATA`, `NOT_CONFIGURED`, `FAILED`, `UNAVAILABLE` y estados equivalentes no se normalizaran como adquisicion positiva ni como ausencia sustantiva del fenomeno. Si las confirmaciones discrepan, el resultado sera insuficiente y quedara fuera de publicacion analitica.

## 26. Fail-closed

Una relacion quedara fuera del producto analitico cuando falte cualquier elemento obligatorio para su tipo. El sistema no completara datos, creara coordenadas, inventara IDs, asumira independencia ni inferira vinculos.

Como minimo, toda relacion publicable exigira:

- identidad DENUE admitida;
- `expedienteId` y `geographyId` compatibles;
- tipo de relacion reconocido;
- datos requeridos por ese tipo;
- lineage suficiente;
- `methodologyVersion`;
- limitaciones registradas;
- validacion PPC `ACCEPTED` completa;
- elegibilidad de publicacion positiva.

Un estado `INSUFFICIENT`, `PENDING`, `REJECTED` o `REQUIRES_REVISION` no podra aparecer como relacion positiva en el mapa analitico.

## 27. Legacy excluido como autoridad

Las puntuaciones, categorias, roles criminologicos, riesgos y fallbacks presentes en `territorialContextEngine.ts` y `TerritorialEvidenceMatrix` no son rectores del nuevo motor cuando carezcan de lineage y metodologia compatibles con este ADR.

Podran conservarse y auditarse como implementacion historica. No podran aportar pesos, umbrales, clasificaciones o hechos al producto analitico sin pasar por un contrato nuevo, evidencia real y validacion institucional.

## 28. Trazabilidad obligatoria

Toda relacion debera permitir reconstruir:

1. observacion DENUE fuente;
2. dato observado utilizado;
3. metrica calculada y entradas;
4. fuentes correlacionadas y sus dependencias;
5. regla y version aplicadas;
6. resultado de maquina;
7. decision de la PPC y su racional;
8. fechas y versiones;
9. resultado de elegibilidad y publicacion;
10. producto cartografico y registro tabular donde fue representada.

Los historiales de propuestas, revisiones y rechazos se conservaran; una aceptacion posterior no los sobrescribira.

## 29. Versionado metodologico

Toda relacion y derivacion futura incluira `methodologyVersion` o equivalente. La version identificara reglas, algoritmos espaciales, taxonomias y criterios de elegibilidad.

Un cambio metodologico no recalculara ni alterara silenciosamente relaciones historicas. Cualquier reevaluacion generara una nueva version vinculada a la anterior, con fecha, motivo y autoridad.

## 30. Prohibicion de IPT numerico en esta fase

Queda prohibido crear un indice numerico compuesto de pertinencia, vulnerabilidad o riesgo hasta que exista una metodologia institucional aprobada que defina y valide:

- variables;
- escalas;
- pesos;
- calibracion;
- umbrales;
- tratamiento de faltantes;
- validacion empirica;
- falsos positivos y falsos negativos;
- supervision y revision periodica.

Este ADR no establece pesos. Los scores de motores existentes no se trasladaran ni combinaran para simular un IPT.

## 31. Invariantes

1. DENUE territorial no se transforma en evidencia criminal por correlacion.
2. Proximidad no implica causalidad.
3. Proximidad no implica riesgo.
4. Seleccion cartografica no implica pertinencia.
5. Pertinencia propuesta no implica validacion.
6. Validacion no implica necesariamente vulnerabilidad o riesgo.
7. Riesgo requiere contrato institucional separado cuando aplique.
8. Ningun giro comercial determina automaticamente relevancia analitica.
9. Toda publicacion analitica DENUE requiere trazabilidad y revision humana.
10. Solo relaciones `ACCEPTED` pueden representarse en el mapa analitico.
11. La geografia canonica no se sustituye por un radio contextual.
12. Los agregados no se convierten en observaciones individuales.
13. La ausencia de datos no se convierte en ausencia del fenomeno.
14. Las fuentes derivadas no se cuentan como independientes.
15. Los hechos medidos y las interpretaciones propuestas permanecen separados.

## 32. Compatibilidad con R3.2B.1-B.5

Este ADR es compatible y no invalida:

- **R3.2B.1 CartographicAdmissionGate:** conserva la admision gobernada, elegibilidad, lineage, limitaciones y revision humana aplicables;
- **R3.2B.2 DENUE observation adapter:** conserva a DENUE como `SOURCE_FACT`, `TERRITORIAL_CONTEXT` y no evidencia criminal;
- **R3.2B.3 GovernedCartographicProduct:** conserva el `OBSERVATION_MAP` contextual y sus limitaciones;
- **R3.2B.4 DisplayPlan:** conserva seleccion por dispersion y legibilidad, expresamente no analitica;
- **R3.2B.5 DENUE contextual renderer:** conserva su mapa neutral, disclosures, conteos y geometria canonica.

La nueva rama comenzara despues de la observacion admitida y producira un producto diferente. No modificara los IDs seleccionados por B.4 para convertirlos en ranking analitico.

## 33. Compatibilidad con ADR rectores

- **ADR-000:** mantiene separacion dato-analisis-validacion-narrativa, trazabilidad, explicabilidad y decision humana.
- **ADR-011:** reutiliza ERG y preserva que las relaciones no sustituyen el gobierno de evidencia.
- **ADR-020.31:** respeta hipotesis humanas, IDs de soporte/refutacion, versionado y validacion.
- **ADR-021:** reutiliza la orquestacion DENUE, SCINCE y OSINT sin colapsar fuentes.
- **ADR-022:** no reconstruye puntos desde agregados y conserva integridad geoespacial.
- **ADR-023:** extiende la correlacion institucional y mantiene DENUE como contexto, no nucleo criminal.
- **ADR-024:** reserva decisiones sustantivas y publicacion a revision humana.
- **ADR-025:** reutiliza convergencia multifuente, independencia, lineage y productos gobernados.

Ante conflicto aparente prevalecera ADR-000, seguido del manual rector y del ADR especifico mas reciente que no contradiga la arquitectura superior.

## 34. Ruta de implementacion recomendada

### Fase 1 - Contrato DenueAnalyticalRelation

Formalizar tipos, invariantes, validadores, estados y version metodologica.

### Fase 2 - Adaptadores ERG y multisource

Integrar DENUE con ERG, `MultiSourceCorrelationEngine` e `institutionalMultisourceConvergence` sin crear otro grafo.

### Fase 3 - Metricas espaciales

Implementar distancias, contencion y limite mediante `SpatialLayerEngine`, con pruebas metricas.

### Fase 4 - Machine proposal engine

Producir exclusivamente `DETECTED`, `PROPOSED` o `INSUFFICIENT`, con hechos y propuestas separados.

### Fase 5 - Human review ledger

Persistir decisiones PPC, historial, racional, identidad y fechas.

### Fase 6 - Producto cartografico analitico

Ensamblar solo relaciones `ACCEPTED`, con admision, lineage, disclosures y fail-closed.

### Fase 7 - Renderer numerado y tabla

Crear correspondencia determinista marcador-registro sin alterar coordenadas ni mapa contextual.

### Fase 8 - Rediseno del anexo

Separar universo, resumen estadistico confiable, relaciones aceptadas y trazabilidad compacta.

### Fase 9 - Pruebas INDIVIDUAL, CORRIDOR y POLYGON

Certificar preservacion de Point, LineString y Polygon, calculos metricos y ausencia de degradaciones.

### Fase 10 - E2E y certificacion

Validar falsos positivos, negativos gobernados, revision humana, presupuesto visual, Word/PDF y trazabilidad completa antes de cualquier liberacion.

## 35. Consecuencias

### Consecuencias favorables

- separacion formal entre contexto y analisis;
- reduccion del riesgo de estigmatizacion de unidades economicas;
- reutilizacion de infraestructura de relaciones existente;
- explicabilidad de mediciones, propuestas y decisiones;
- preservacion del mapa neutral y de la geografia canonica;
- capacidad futura de producir un mapa analitico defendible.

### Costos y restricciones

- toda relacion publicable requiere intervencion PPC;
- las fuentes sin IDs, coordenadas o lineage quedaran excluidas;
- no existira ranking numerico hasta aprobar metodologia;
- el mapa analitico competira dentro del presupuesto visual existente;
- sera necesario versionar contratos, calculos y decisiones historicas.

## 36. Criterios de certificacion futura

La implementacion de este ADR no podra certificarse hasta demostrar, como minimo:

1. ningun giro comercial produce relevancia por si mismo;
2. ninguna relacion incompleta supera el gate fail-closed;
3. solo relaciones `ACCEPTED` llegan al mapa analitico;
4. las relaciones rechazadas o pendientes no se publican como positivas;
5. Point, LineString y Polygon se preservan;
6. toda distancia se calcula en metros con utilidad gobernada;
7. los agregados de incidencia no generan puntos;
8. SCINCE permanece como contexto agregado;
9. OSINT no se vincula por nombre comercial solamente;
10. ERG y multisource son reutilizados sin grafo paralelo;
11. el limite de cinco visuales no aumenta;
12. la trazabilidad reconstruye fuente, metrica, propuesta, decision PPC y publicacion;
13. los estados negativos mantienen las confirmaciones institucionales aplicables;
14. el mapa contextual B.5 permanece funcional e inalterado;
15. las pruebas E2E cubren INDIVIDUAL, CORRIDOR y POLYGON.

## 37. Documentos y contratos consultados

- ADR-000 - Arquitectura Rectora del Perfilador CEIPOL, v2.0.
- Manual de Gobernanza Operacional y Analitica del Perfilador.
- Directorio Maestro de ADR y Documentos Rectores, edicion operativa v2.0.
- ADR-011 - Evidence Relationship Graph y certificaciones relacionadas.
- ADR-020.31 - Gobernanza del ciclo de vida de hipotesis.
- ADR-021 - Multisource Orchestration y adaptadores DENUE, SCINCE y OSINT.
- ADR-022 y ADR-022.8K - Incidencia y provenance del dataset.
- ADR-023 - Correlacion multisource y DENUE.
- ADR-024 - Gobernanza de IA y validacion humana.
- ADR-025 - Google Evidence Contract, convergencia y productos gobernados.
- Contratos vigentes de geografia canonica, evidencia, lineage, admision cartografica, composicion visual e informes institucionales.

## 38. Declaracion final

El futuro motor de pertinencia analitica DENUE sera un sistema de deteccion y propuesta de relaciones gobernadas. No sera un clasificador autonomo de negocios, un motor de riesgo ni una fuente de evidencia criminal.

La maquina medira y propondra. La PPC decidira el significado, aceptara o rechazara la relacion y autorizara su publicacion. El mapa contextual permanecera neutral; el mapa analitico sera derivado, separado, trazable, versionado y sujeto a revision humana.
