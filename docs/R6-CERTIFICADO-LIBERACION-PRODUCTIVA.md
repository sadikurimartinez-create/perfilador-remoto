# CERTIFICADO DE LIBERACIÓN PRODUCTIVA R6

Proyecto: PERFILADOR REMOTO SSPE-CEIPOL
Institución: Secretaría de Seguridad Pública del Estado — CEIPOL
Fecha de liberación: 2026-10-07
Rama de origen: `work/informes-r2.5-ui-cleanup`
Commit productivo liberado: `34673c4aa1cdfb50a7b500eaae8beb20200596ea`
Commit padre: `854ef85d648401926ad8ddc7e86862368e4a175f`
Subject: `feat(sql): govern scince rollback and runtime role`
Dominio productivo: https://perfilador-remoto.vercel.app/
Modo de promoción: Vercel Preview Ready → Promote to Production.

## Base de evidencia y alcance certificado

Este documento consolida los resultados técnicos productivos declarados en la
solicitud institucional R6.5A del 2026-10-07. Su preparación verificó localmente
rama, HEAD, padre, subject, archivos del commit y hashes de Rules. No repitió
pruebas live, no ejecutó código de aplicación ni SQL y no realizó despliegues.
Los resultados operativos siguientes se registran a partir de la evidencia
aportada para esta liberación; no se presentan como nuevas observaciones del
agente redactor ni incluyen identificadores de deployment/ruleset no aportados.

El alcance certificado comprende ejecución del candidato en Production,
autenticación institucional, apertura de expedientes, PostgreSQL/PostGIS,
runtime ceipol_app, Firebase Admin, bridge institucional Firebase, emisión de
custom token, proyección PostgreSQL → Firestore, Firestore y Storage Security
Rules restrictivas, cross-service IAM Storage → Firestore, Dossier de Pandillas,
lectura de fotografías/documentos y smoke final productivo.

El deployment productivo fue promovido desde la rama
`work/informes-r2.5-ui-cleanup`. No se afirma merge a main.

## Evidencia SQL

El health-check candidato confirmó PostgreSQL/PostGIS con `status = ok` y:

```text
runtimeAuthority:
isCeipolApp = true
isSuperuser = false
canCreateDb = false
canCreateRole = false
bypassRls = false
canCreatePublic = false
canCreateTablePublic = false
ownsDatabase = false
publicCanCreatePublic = false
```

DATABASE_URL quedó acreditada en Vercel con alcance **Production and Preview**.
No se registra su valor. Las bases Cloud SQL previamente inspeccionadas,
`postgres` y `perfilador-remoto-database`, estaban vacías, sin PostGIS y sin
ceipol_app; no fueron utilizadas para aplicar migraciones durante esta liberación.

## Firebase Admin y bridge institucional

Las variables siguientes quedaron configuradas para **Production and Preview**,
sin registrar valores ni presumir que comparten una única entrada administrativa:

- FIREBASE_ADMIN_PROJECT_ID
- FIREBASE_ADMIN_CLIENT_EMAIL
- FIREBASE_ADMIN_PRIVATE_KEY

La prueba funcional de `POST /api/auth/firebase-token` registró:

```text
status = 200
ok = true
hasCustomToken = true
error = null
```

El token real no fue expuesto ni registrado en la evidencia aportada ni en este
certificado. La emisión requiere sesión institucional y sincronización previa
de autorización; no constituye un endpoint de prueba sin efectos.

## Proyección de autorización

Flujo certificado:

```text
ceipol_session
→ PostgreSQL
→ identidad institucional
→ project access authority
→ proyección PostgreSQL → Firestore
→ Firebase custom token
→ cliente autenticado
```

Un expediente productivo abrió correctamente después de la sincronización
institucional. La proyección aplica la autoridad PostgreSQL y su vigencia; no
convierte los documentos Firestore en fuente autoritativa de grants.

## Firestore Security Rules

SHA-256 del archivo restrictivo:
`E95B8E65880D968FE0E737F390EF4F68D5912096B73E49A8FAEBFDF2B28D3A96`.

Evidencia de liberación: compilación **PASS**, deploy **PASS**, proyecto explícito
`perfilador-remoto`, publicación en `cloud.firestore` y validación funcional
post-deploy **PASS**.

Las reglas públicas anteriores `allow read, write: if true;` dejaron de constituir
la política activa después del deploy restrictivo. Se certifica la sustitución
de la release activa, no la eliminación histórica del ruleset anterior. El hash
identifica el archivo; no se inventan IDs administrativos de release o ruleset.

## Storage Security Rules y cross-service IAM

SHA-256 del archivo restrictivo:
`7EA53E394B4E52A20557D2241F74DD8A152A5A175434C0D5ABC27E22FBFC444F`.

Evidencia de liberación: compilación **PASS**, deploy **PASS**, proyecto explícito
`perfilador-remoto`, publicación en `firebase.storage`, concesión del IAM Role
requerido para cross-service rules Storage → Firestore y validación funcional
final **PASS**. La denominación exacta del IAM Role no fue aportada y no se infiere.

Las reglas públicas anteriores `allow read, write: if true;` dejaron de constituir
la política activa después del deploy restrictivo. Esto no afirma eliminación
histórica de versiones anteriores.

## Suite de seguridad

Suite: `tests/firebaseSecurityRules.cjs`.

```text
tests = 90
pass = 90
fail = 0
cancelled = 0
skipped = 0
todo = 0
exit code = 0
```

Los mensajes PERMISSION_DENIED observados pertenecen a casos negativos esperados
para validar acceso sin autenticación, acceso entre proyectos, escalamiento de
rol, escrituras sin grant, modificación de evidencia, borrados directos,
manipulación de auditoría y proyecciones, sustitución de artefactos publicados,
grants malformados, proyectos archivados/eliminados y escrituras server-only.
El resultado agregado 90/90 distingue estas denegaciones previstas de fallos.

## Smoke final productivo

```text
LOGIN OK
EXPEDIENTE OK
FIRESTORE POST-DEPLOY OK
SMOKE FINAL OK
```

El smoke acreditó carga del expediente, lectura de datos, visualización de
fotografías, visualización/apertura de documentos, Dossier de Pandillas operativo,
fotografías primarias visibles y ausencia de errores visibles permission-denied/403
en el flujo probado. No acredita cobertura absoluta de todas las funciones.

## SQL governance incorporado

El commit `34673c4aa1cdfb50a7b500eaae8beb20200596ea` incorporó exactamente:

- `database/migrations/inegi-territorial/002_scince_catalog_down.sql`
- `database/migrations/runtime-role/001_ceipol_app_up.sql`
- `database/migrations/runtime-role/001_ceipol_app_verify.sql`
- `database/migrations/runtime-role/001_ceipol_app_down.sql`
- `docs/P8.3-H-CEIPOL-APP-RUNTIME-ROLE.md`

La evidencia aportada registra **17/17** pruebas P8.3-G project access aprobadas
y rollback SCINCE 002 validado. Ninguna migración SQL nueva se ejecutó contra las
bases Cloud SQL vacías y no se creó un segundo ceipol_app. Incorporar los scripts
al commit no equivale a ejecutarlos.

## Riesgos residuales

Los siguientes resultados de health-check se clasifican como **NO BLOQUEANTES
PARA ESTA LIBERACIÓN**, en el alcance validado, y requieren trabajo posterior.
Estos proveedores no se declaran funcionales:

| Proveedor/control | Error o limitación observada |
| --- | --- |
| Google Cloud Vision | Falta GOOGLE_CLOUD_VISION_API_KEY |
| INEGI DENUE | Respuesta «No hay resultados.» incompatible con el parser JSON actual |
| NASA | HTTP 400 |
| USGS | HTTP 400 |
| CENAPRED | HTTP 404 |
| Tomorrow.io | Provider disabled o API key ausente |
| Reddit | OAuth Bearer token no configurado |
| INEGI WMS | Servicio no alcanzable / uso de caché |
| FastAPI backend probe | HTTP 404 |

## Rollback

Existen dos niveles independientes: **código**, mediante Vercel Instant Rollback
o promoción de deployment previo; y **Firebase Rules**, mediante restauración
controlada de ruleset anterior por procedimiento administrativo.

- El rollback de código no revierte automáticamente las Rules.
- El rollback de Rules no revierte automáticamente el código.
- No realizar rollback parcial sin revisar compatibilidad de bridge, proyección
  y Rules. Una política pública histórica no se considera una restauración segura
  por el mero hecho de ser anterior.
- No ejecutar rollback SQL salvo autorización administrativa expresa.

## Estado de control de versiones

- Commit desplegado: `34673c4aa1cdfb50a7b500eaae8beb20200596ea`.
- Rama de origen: `work/informes-r2.5-ui-cleanup`.
- Deployment productivo: promovido directamente desde Preview.
- Reconciliación/merge con main: **NO ACREDITADO EN ESTE CERTIFICADO**.

No se presenta main como actualizado.

## Dictamen institucional

Con base en la evidencia técnica disponible, la versión R6 del PERFILADOR
REMOTO SSPE-CEIPOL queda CERTIFICADA PARA OPERACIÓN PRODUCTIVA en el alcance
expresamente validado durante esta liberación.

Esta certificación no constituye una declaración de ausencia absoluta de
defectos ni amplía el alcance a funciones no incluidas en las pruebas descritas.

## Trazabilidad

Los resultados live de esta tabla proceden de la evidencia declarada en R6.5A;
la verificación local de Git y hashes se efectuó al preparar el documento.

| Control | Resultado | Evidencia |
| --- | --- | --- |
| Código Production | PASS | Commit 34673c4aa1cdfb50a7b500eaae8beb20200596ea; promoción Preview → Production |
| PostgreSQL/PostGIS | PASS | Health-check: status = ok |
| ceipol_app | PASS | runtimeAuthority con atributos mínimos y sin CREATE/ownership |
| Firebase Admin | PASS | Custom token: status 200, ok=true, hasCustomToken=true, error=null |
| Proyección autorización | PASS | Bridge y apertura del expediente después de sincronización |
| Firebase Rules tests | PASS | tests/firebaseSecurityRules.cjs: 90/90, exit code 0 |
| Firestore deploy | PASS | SHA-256 E95B8E65880D968FE0E737F390EF4F68D5912096B73E49A8FAEBFDF2B28D3A96 |
| Firestore smoke | PASS | FIRESTORE POST-DEPLOY OK |
| Storage deploy | PASS | SHA-256 7EA53E394B4E52A20557D2241F74DD8A152A5A175434C0D5ABC27E22FBFC444F; cross-service IAM |
| Smoke final | PASS | SMOKE FINAL OK, limitado al flujo descrito |
