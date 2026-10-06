# ADR-027 — Persistencia institucional de evidencia fotográfica de Pandillas

Estado: decisión autorizada por R4.5A; implementación local, sin despliegue ni datos reales.
Fecha: 2026-10-06.

## Problema y jerarquía

GangMember carece de identidad individual estable y fotografiaUrl es legacy. Original,
derivado, asociación y primaria tienen ciclos de vida distintos. Rigen Manual de
Gobernanza Algorítmica v2.0, ADR-000, Manual Operacional y Analítico, ADR-011 y
sus contratos de custodia, EXPLICIT_ACTION_GRANT_V1, integridad multimodal,
revisión humana, publicación institucional y lifecycle con auditoría de servidor.
ADR-026 es el mayor identificador base encontrado; ADR-027 no estaba ocupado
en los documentos/archivos rectores revisados antes de crear este ADR.

## Alternativas descartadas

Base64 nuevo dentro de GangEntity; nombres/alias/índices como identidad; tratar
selecciones como documentos fotográficos ficticios; arrays crecientes en el
proyecto; cuarta colección PhotoAssets. Ninguna preserva adecuadamente aislamiento
y responsabilidad sin duplicar o confundir contratos existentes.

## Decisión y persistencia

Se implementan exclusivamente tres subcolecciones:

- projects/{projectId}/pandillasMemberIdentities
- projects/{projectId}/pandillasPhotoAssociations
- projects/{projectId}/pandillasPrimarySelections

PhotoAsset reside como metadata tipada ProjectDocument.photoAsset en la colección
documents existente, junto con multimodalEvidence. No contiene URL o binario.
Su id es el documentId y referencia el PDF fuente y su SHA-256, página e IMAGE_ID.
Original y derivado son archivos separados: Storage contiene los bytes; los contratos
contienen hashes, dimensiones, MIME, ruta, receta y recorte en píxeles originales.
No se reutiliza derivedIntelligenceReference para imágenes ni fingerprints narrativos
como integridad. Todo SHA-256 usa forensicFileIntegrity.ts.

## Identidad y asociación

memberIdentityId es opaco, generado en servidor. legacyMemberName sirve para la
conciliación humana, nunca como clave. Se exige pandilla/proyecto exactos, un único
integrante de nombre literal y expectedGangUpdatedAt vigente al revisar. Un hash
criptográfico del snapshot legacy ordenado detecta cambios posteriores; no identifica
personas ni sustituye el ID. Cambios de nombre o del snapshot requieren nueva revisión,
sin remapeo automático. No se registra de nuevo el mismo fingerprint en la pandilla.

Asociación independiente: EXACT, PROBABLE_DOCUMENTARY, AMBIGUOUS o NONE;
ACTIVE o RETIRED. Registro explícito humano y expectedDocumentVersion. Una
asociación retirada no se modifica. Retirar una primaria exige reemplazarla primero;
desselección/reconciliación de identidad quedan para una fase explícita posterior.

## Selección, autorización y versiones

El documento de primaria usa gangId~memberIdentityId. Los IDs validados excluyen ~,
por lo que el par no colisiona. Solo EXACT, ACTIVE, revisado, identidad ACTIVE con
snapshot vigente, documento ACTIVE aprobado e íntegro y derivado disponible.
expectedVersion controla cada mutación; la selección también exige versiones de
documento y asociación. Transacciones leen antes de escribir y garantizan una primaria.
El reemplazo conserva asociación/activo y registra la selección anterior como REPLACED
en audit_logs, sin una colección de historial adicional. Actor y fecha son del servidor.

Boundary server-only reutiliza authorizeInstitutionalProjectAccess con sesión y
READ/WRITE. Sin bypass ADMIN. Revalida padre y pertenencia de pandilla en la
transacción; READ resuelve referencias en snapshot consistente, sin URL permanente.
Las tres subcolecciones admiten lectura según grant institucional y proyecto guardado;
escrituras cliente denegadas. Metadata photoAsset de documents es server-only:
las reglas impiden creación/inyección/alteración cliente del activo R4.

## Auditoría y resolución

PHOTO_IDENTITY_CREATED, PHOTO_IMPORTED, PHOTO_ASSOCIATED,
PHOTO_PRIMARY_SELECTED, PHOTO_PRIMARY_REPLACED,
PHOTO_ASSOCIATION_RETIRED y PHOTO_DELETED tienen contrato tipado.
Solo los eventos de las operaciones implementadas se generan al invocar el boundary;
IMPORT/DELETE quedan como contratos, no como endpoints ejecutables en esta fase.
IDs, versiones, hashes, actor, timestamp, motivo y old/new; sin URL, token, binario
ni base64. Mutación/auditoría y revisión de fuente se confirman conjuntamente.

resolveMemberPrimaryPhoto exige READ, identidad vigente, primaria, asociación EXACT,
documento del mismo proyecto, aprobación humana, integridad y derivado. Devuelve
documentId, associationId, ruta/hash del derivado, MIME, dimensiones y las tres versiones.
No realiza descarga, no acredita bytes reales ni genera enlaces públicos.

## Custodia, eliminación y publicación

Preservar original y derivado aprobado inmutables; futuras rutas:
projects/{projectId}/pandillas/evidence/assets/{assetId}/original/{sha256}.{ext}
projects/{projectId}/pandillas/evidence/assets/{assetId}/derived/{recipeVersion}/{sha256}.{ext}
storage.rules permanece cerrado para estas rutas. No hay uploader/registrador de activos.

ADR-011 distingue quitar primaria, retirar asociación y borrar físicamente. No se
implementa borrado R4; no reutilizar el borrado de un único storagePath para purgar
original más derivados. La fase de carga deberá integrar referencias compartidas,
doble confirmación, retención y saga institucional de intenciones/recibos/reintentos.
Firestore/Storage no son una transacción única. No borrar publicaciones inmutables
como efecto de sustituir una primaria.

fotografiaUrl no se modifica. Precedencia futura: R4 PRIMARY → legacy fallback,
sin activar consumidores. Publicación futura fija associationId/documentId,
derivedSha256, documentVersion, associationVersion y selectionVersion y reutiliza
revisión/autoridad institucional; no duplica base64 ni inventa geographyId para retratos.

## Migración futura y exclusiones

No inicializar 80 identidades, extraer PDF, subir objetos, asociar 79 candidatos,
elegir fotografías reales, resolver Amézquita/Amezcuita, incorporar Ángel Ricardo
González Sánchez, desplegar reglas, cambiar Word/PDF/UI, migrar legacy ni hacer commit.
El boundary bloquea explícitamente los pendientes R4.3 de identidad. Los múltiples
EXACT requieren selección humana, sin ranking facial ni inferencias por apariencia.

Fases siguientes: revisar este contrato y sus tests; carga/verificación server-side de
bytes y metadata multimodal; custodia y eliminación completa R4; conciliación humana;
resolución autenticada del recurso; integración UI/publicación y migración opt-in.
La implementación de esta fase no registra hechos en Firestore/Storage real.
