# P8 — Contrato de presentación geográfica de evidencia

## Auditoría previa a implementación

Baseline examinada: 306a0769c1d0bd98297f88db844a7a6a552ae605.
Rige la instrucción P8 del usuario, seguida por las decisiones certificadas aplicables:
ADR-011 (selección visual, relaciones, eliminación, captura virtual y trazabilidad),
ADR-019.16 (UX GEOINT certificada), ADR-MAP-EVIDENCE-CAPTURE-GOVERNANCE y
GABINETE-GEOMETRY-EXPEDIENTE-FINAL-CERTIFICATION. Los contratos ejecutables
canonicalProjectGeography, historicalGeographyReconciliation, humanValidationPolicy,
evidenceLineage e institutionalEvidenceReview determinan persistencia y compatibilidad.
El manual de gobernanza fue inspeccionado como antecedente; no se encontró una
convención de abreviaturas geográficas en el texto extraído ni en los componentes.
Las iniciales del perfilador son identidad institucional, no labels geográficos.

No se modifica el motor certificado ADR-011, la confirmación territorial,
la autoridad PostgreSQL ni la decisión humana PPC/Street View.

## Convención propuesta antes del código

| Rol acreditado | Label | Campo existente |
| --- | --- | --- |
| Nodo Inicial | NI | tipo / geometryRole START |
| Nodo Intermedio (Corredor legacy) | NM | tipo / geometryRole INTERMEDIATE |
| Nodo Final | NF | tipo / geometryRole END |
| Vértice / Perímetro | V | tipo / geometryRole VERTEX |
| Nodo Principal | P | tipo / geometryRole POINT |
| Evidencia Adicional | EA | geometryRole NONE / evidenceType ADDITIONAL_PHOTO |
| Rol no acreditado | SC | LEGACY_UNCLASSIFIED, sólo proyección |

La secuencia territorial proviene exclusivamente de territorialRef.nodeId y
canonicalGeography.sourceRefs.order, o de un índice territorial explícitamente
persistido. Un ID permite ordenar presentación legacy estable sin afirmar una
secuencia geográfica. Coordenadas coincidentes por sí solas no acreditan roles.
No se deduce START/END desde orden de consulta, GPS ni fecha de carga.

Los roles describen la asociación documental. Sólo la geometría canónica
confirmada define trazado, anillo, centroide y punto principal. Las adicionales
se presentan al final, conservan el recurso original y usan exclusivamente
coordenadas propias reales; sin ellas no se fabrica un pin.

## Interacción y almacenamiento

Pin: click persistente, cierre explícito, imagen e identidad, InfoWindow con
auto-pan. Actuación: modal fijo centrado, overlay, foco y ESC cuando procede.
Documento fotográfico adicional conserva su ruta documents; nunca se crea
una foto paralela para ofrecer herramientas. PPC usa el mismo boundary WRITE
y transacción auditada, con locator documental explícito y validación de MIME.
No hay migraciones live ni sustitución de decisiones históricas.
