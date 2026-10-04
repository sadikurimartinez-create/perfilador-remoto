# P8 — Carátula territorial y sociodemográfica

Gobierno aplicable: ADR-011 (hipótesis y Capítulo 0), ADR-012 (sin geografía
fabricada), ADR-013 y su adenda CARTOGRAPHIC_SCALE_WEB_MERCATOR_V1, ADR-026,
contratos P5/P6/P7 de semántica, composición, paridad física y publicación,
P8-SCINCE-MULTIGEOGRAPHY-CONTRACT y P8-SCINCE-RADIUS-TERRITORIAL-CONTRACT.
Se preservan identidad institucional, clasificación, expediente, fecha, logos,
formato carta, header/footer y separación informe/anexo. ADR-013 continúa siendo
una propuesta; esta intervención no declara aprobaciones institucionales nuevas.

## Flujo documental obligatorio

Toda capacidad analítica nueva debe declarar su impacto documental y demostrar
su incorporación coherente al informe final cuando corresponda: dato → análisis
→ validación humana → provenance → modelo → narrativa/visuales → DOCX → PDF.
La aceptación exige pruebas del producto final, no sólo de componentes aislados.

## Modelo y carátula única

SCINCE_REPORT_COVER_V1 es una proyección pura de la admisión server-side vigente.
READY requiere snapshot válido, binding territorial actual, PPC incorporado,
officialBaseProfile2020, radio gobernado y cifras ejecutivas admisibles.
La admisión server-side conserva la comparación del release/radio actual y el
grant GENERATE_REPORT; este módulo no sustituye esos controles ni consulta DB.
Sin requisitos, INCOMPLETE muestra un estado explícito y ninguna cifra o mapa
SCINCE. Los modelos históricos sin este campo conservan su renderer original;
no se regeneran ni reinterpretan snapshots al descargar paquetes históricos.

Orden: identidad → mapa exclusivo → ficha ejecutiva → pie metodológico, todo
antes del primer salto. El PDF consume el DOCX exacto y rechaza overflow de
carátula. La verificación visual DOCX sigue siendo obligatoria para certificar
la paginación física del renderer Word/LibreOffice.

## Cartografía exclusiva

Se reutiliza InstitutionalMapRenderer con una entrada tipada que sólo acepta
geografía canónica, área SCINCE y cartografía gobernada. Base mínima: retícula
geográfica, sin atribuir calles/localidades no acreditadas. Amber identifica
origen; azul discontinuo identifica entorno; huecos/componentes se conservan.
El viewport se ajusta al conjunto de origen y área, incluso para Point, usando
el algoritmo de escala existente, reservando 30 píxeles lógicos para impedir
que la leyenda cubra geometría. Esta decisión explícita de carátula no altera
el zoom ni la imagen del mapa analítico del cuerpo/anexo. El mapa de cuerpo
mantiene su propósito analítico distinto; no se repite el bitmap de carátula.
Materialización antes de renderizar, reserva semántica obligatoria, bytes
protegidos por snapshot visual server-side y lineage del modelo documental.

## Selección y provenance

Máximo diez indicadores. Prioridad: población, proporción de mujeres ya
derivada, edad 0–14, población 15+ sin escolaridad, actividad económica,
afiliación a salud, viviendas habitadas, hogares, servicios y TIC. Hombres y
discapacidad son reemplazos acreditados cuando faltan indicadores anteriores.
La proporción complementaria de hombres permanece en el anexo; no se duplica
sistemáticamente en la ficha, favoreciendo amplitud dimensional y baja redundancia.
Se omiten dimensiones ausentes. Sólo COUNT sumados sobre unidades completas,
disjuntas y del mismo nivel, y derivaciones ya reproducibles del perfil.
No promediar GRAPROES ni convertir supresiones/nulos en cero. Las limitaciones
de elegibilidad permanecen visibles mediante aviso y completas en el anexo.
Las cifras son de unidades completas seleccionadas, no estimaciones areales.

Cada indicador retiene variableCode, universo, observaciones fuente con unidad,
dataset, 2020, release, catálogo, normalización, fingerprint, método y fórmula
si corresponde. La ficha distingue oficial/derivado; no implementa estimación
actualizada. El cuerpo contextualiza; el anexo conserva los 222 indicadores,
supresiones, metodología y provenance. Ninguna característica implica causalidad
criminal ni habilita etiquetar población. No hay cambios de grants, Rules o DB.

El mapa contextual adicional no consume la reserva de hasta cinco visuales
analíticos del cuerpo. Tiene ID, propósito y bytes distintos; es obligatorio
cuando la carátula está READY. El título extenso requerido por P8 se aplica
a las nuevas carátulas READY; los modelos legacy preservan el título histórico.

Preparación temporal: el contrato separado EstimatedCurrentProfile deberá
aportar dato actualizado, año, variación, intervalo y nivel de confianza con
método y revisión propios antes de habilitar esa presentación. Actualmente
estimatedCurrentProfile permanece null y no se generan valores temporales.

## Evidencia offline y límite de certificación

22 suites y 845 pruebas PASS; 35 pruebas específicas de carátula. TypeScript
`--noEmit --incremental false` PASS. Se generaron cuatro DOCX y sus cuatro PDF
institucionales reales: Point, LineString, Polygon y MultiPolygon. Cada PDF
tiene siete páginas y una sola carátula; las cuatro carátulas se rasterizaron
y revisaron visualmente sin overflow. La prueba de coordenadas de texto PDF
acredita los anchos porcentuales literales DOCX. El parser conserva además el
soporte numérico de cincuentavos OOXML. El snapshot visual server-side incluye
los bytes del mapa.

La paginación física de Word/LibreOffice sigue **sin certificar**: el intento
con `render_docx.py` falló por ausencia de `soffice.exe` en el runtime disponible.
No se sustituye esa validación por inspección de XML ni por el PDF propio.
No se ejecutaron migraciones, reimportación, operaciones live ni comandos Git
de escritura. La implementación funcional no implica autorización de despliegue
ni cierre de la certificación visual DOCX/PDF completa.
