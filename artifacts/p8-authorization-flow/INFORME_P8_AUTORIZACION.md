# 1. DIAGNÓSTICO

Baseline inspeccionado: `work/informes-r2.5-ui-cleanup`, HEAD `7746471adf7f6ad47ac1cc06c5fcc2573ff98e83`; índice y cambios rastreados vacíos al inicio. Se acepta como acreditado el estado PostgreSQL comunicado por el usuario; no se consultó ni modificó infraestructura live.

El runtime sí conecta token → snapshot PostgreSQL → adapter Admin → transacción Firestore → emisión del token. El listado es otro camino: sesión → grants PostgreSQL → documentos `projects` mediante Admin. No lee `authorizationUsers` para enumerar proyectos. Por ello, las proyecciones ausentes no explican por sí solas los cero expedientes.

Se encontró y corrigió una omisión local reproducible en la idempotencia de la proyección. No se ha demostrado que sus precondiciones se cumplan en Preview. No existe evidencia suficiente para atribuirle toda la discrepancia live ni declarar PASS E2E.

| Hipótesis | Resultado y evidencia |
|---|---|
| H1: snapshot sin persistencia | Descartada en el flujo normal: synchronize espera adapter.commit. |
| H2: adapter noop | Descartada en runtime inspeccionado: se instancia AdminAuthorizationProjectionAdapter. Los mocks sólo pertenecen a tests. |
| H3: proyecto Admin distinto | Código restringe Admin a perfilador-remoto; destino efectivo de la observación live no acreditado aquí. |
| H4: configuración cliente/Admin distinta | Ambos apuntan estructuralmente a perfilador-remoto y Firestore por defecto. La app Admin es nombrada y el cliente usa la app default. No se inspeccionaron valores secretos ni configuración efectiva del deployment/emuladores. |
| H5: ruta equivocada | Descartada en código: authorizationUsers/1 y projectAccess/Kzp218N27O1F9aNS9M98/members/1. |
| H6: READ omite escritura | Descartada y probada: READ único se proyecta. |
| H7: error silenciado antes del token | No se silencian errores de persistencia: producen 503. Sí había salida anticipada por recibo de auditoría existente, sin verificar mirrors; corregida. |
| H8: user:1 versus 1 | Descartada: UID user:1, claim y paths con string 1. |
| H9: tipos PostgreSQL incompatibles | SQL del snapshot usa u.id::text; parámetros de grants usan ID string y el contrato de la tabla es text/text[]. Prueba integrada pasa con id de usuario numérico y grant string. No se volvió a consultar PostgreSQL live. |
| H10: token no invoca proyección | Descartada: await synchronize precede mint; prueba real de la ruta sin mockear el servicio lo verifica. |
| H11: tombstone accidental | Grant presente READ y activo se escribe vigente. Tombstone sólo para ID anterior ausente del snapshot. No hay prueba de una revocación posterior live. |
| H12: listado con identidad legacy | Descartada para enumeración: resolveInstitutionalSessionIdentity y grants por institutionalUserId. |
| H13: createdBy/username/role autorizan proyectos | Descartada para listado y WRITE. ProjectList conserva agrupación visual de devueltos por creador y controles de estado por rol; no agregan proyectos ni conceden WRITE. ProjectContext obtiene canModify del servicio de acceso explícito. |
| H14: READ devuelve vacío por contrato | No ocurre con el fixture válido: devuelve exactamente el proyecto. Puede devolver vacío si documento no existe o deleted no es undefined/false; errores del server action también se convierten a lista vacía en el subscriber. Condición live pendiente. |
| H15: campos legacy faltantes | name/createdAt/createdBy/estado no son prerrequisitos de autorización/listado. Fixture histórico sin createdBy ni createdAt sigue visible. El filtro deleted es estricto; no se conocen sus valores live. |
| H16: carrera login/token/carga | Secuencia normal espera bridge antes de setUser; ProjectList espera loading=false y user. Bridge serializa operaciones, usa generación e inMemoryPersistence. No se demuestra una carrera live. |
| H17: conexión faltante entre capas | No falta en código inspeccionado. Fail-closed puede vaciar UI por error de listado; falta evidencia de esa llamada live. |
| H18: tests cubren otro flujo | Cobertura previa segmentada: token inyectaba synchronize; ruta mockeaba issue; snapshot usaba adapter ficticio. Se añadió integración real ruta→servicios→adapter→listado, simulando únicamente I/O y framework. Sigue sin certificar Firebase/PG/red/UI live. |

# 2. CAUSA RAÍZ DEMOSTRADA

**Defecto local demostrado:** el adapter devolvía éxito inmediatamente si existía `authorizationAudit/{hash(actor,projections,timestamp)}`. Un recibo persistente no garantiza que los documentos derivados sigan presentes. En una repetición con mismo actor, snapshot y timestamp, un recibo previo más mirrors ausentes permitía emitir token y responder 200 sin recrearlos.

Se ejecutó la nueva regresión sobre el archivo original de HEAD, restaurando después exactamente la corrección: la aserción HTTP200 pasó y la lectura posterior del índice fue undefined; test FAIL esperado. Con la corrección, el mismo caso PASS.

**Límite causal:** Date.now genera normalmente un timestamp nuevo por solicitud, y entra en el hash. Un login nuevo ordinario no necesariamente reutiliza el recibo. No se conoce un recibo coincidente en Preview, ni el origen exacto del 404 observado. Este defecto no demuestra la causa raíz conjunta live; el listado no depende del mirror. Afirmar que toda la incidencia quedó resuelta sería incorrecto.

# 3. FLUJO REAL ENCONTRADO

`AuthContext.login → POST /api/auth/login → usuario PostgreSQL → sesión institucional httpOnly → connectInstitutionalFirebase → POST /api/auth/firebase-token → validación de sesión/identidad PostgreSQL → refreshInstitutionalAuthorization → SELECT LEFT JOIN institutional_project_access → validateAuthorizationSnapshot → AdminAuthorizationProjectionAdapter.commit → transacción índice + members + audit → createCustomToken → signInWithCustomToken → setUser → ProjectList`.

El bridge realiza signOut, setPersistence(inMemoryPersistence) y espera signInWithCustomToken; refresca proyección/token cada dos minutos. La lease de autorización dura cinco minutos. Un error aborta autenticación Firebase.

Listado real: `ProjectList → subscribeInstitutionalCollection('projects') → server action readInstitutionalCollection → resolveInstitutionalSessionIdentity → SELECT grants → validar READ activo → Admin getAll de projects/{IDs} → filtro existencia/deleted → mapeo de UI`. Se refresca cada treinta segundos. El subscriber borra registros ante excepción y no distingue error de una lista legítimamente vacía.

Carga individual: `ProjectContext.loadProject → Firebase cliente getDoc(projects/{id})`, protegida por Rules y mirror vigente; WRITE se consulta separadamente por server action. Crear no interviene en listar el expediente existente: boundary reserva ID y exige grant explícito previo WRITE; no provisiona grants.

# 4. ARCHIVOS RELEVANTES

| Archivo | Líneas | Función / responsabilidad |
|---|---|---|
| src/context/AuthContext.tsx | 41–74, 95–137 | refreshUser/login: espera bridge antes de publicar usuario. |
| src/app/api/auth/login/route.ts | 7–26 | POST: identidad PG y sesión institucional. |
| src/services/institutionalSessionIdentityService.ts | 22–52 | resolveInstitutionalSessionIdentity: edad, identidad y rol canónicos. |
| src/app/api/auth/firebase-token/route.ts | 1–30 | POST: origen, sesión, token o error sanitizado. |
| src/services/institutionalFirebaseTokenService.ts | 13–53 | resolveUser/issueInstitutionalFirebaseToken: sincronizar antes de mint. |
| src/services/institutionalAuthorizationProjectionRepository.ts | 8–60 | Adapter transaccional y refresh PG. |
| src/services/institutionalAuthorizationProjectionService.ts | 28–67 | Validación canónica y commit obligatorio. |
| src/lib/firebaseAdmin.ts | 7–52 | Admin nombrado, proyecto restringido, Firestore default. |
| src/lib/firebase.ts | 12, 23–45 | Cliente, mismo projectId, Firestore default; valores de claves omitidos. |
| src/services/institutionalFirebaseClientBridge.ts | 9–59 | Refresh serializado, signInWithCustomToken e inMemoryPersistence. |
| src/lib/institutionalCollectionActions.ts | 9–47 | READ/listado y consulta WRITE institucional. |
| src/services/institutionalCollectionClient.ts | 6–24 | Subscriber: server action, refresco y vacío ante error. |
| src/components/ProjectList.tsx | 257–292, 852–875 | Carga autorizada, mapping, agrupaciones y búsqueda visual. |
| src/context/ProjectContext.tsx | 906–949, 996–1027 | Recuperaciones desde listado autorizado; getDoc y canModify institucional. |
| src/services/institutionalProjectAccessService.ts | 18–63 | Autorización por acción explícita, sin bypass por rol. |
| src/services/institutionalProjectAccessRepository.ts | 12–31 | Grants SELECT y metadata Admin por proyecto. |
| src/services/institutionalProjectCreationBoundary.ts | 30–56 | Reserva y creación con grant previo; sin autoprovisionamiento. |
| src/lib/institutionalProjectCreationActions.ts | 86–94 | Server actions de reserva/creación. |
| src/app/layout.tsx; src/app/page.tsx | 24–33; 92 | AuthProvider/ProjectProvider y ProjectList real. |
| firestore.rules | 4–32 | UID institucional y acciones/revocación/lease; sin cambios. |
| docs/P8.3-G-INSTITUTIONAL-PROJECT-ACCESS-MIGRATION.md | 7, 75–83 | Precedencia gobernanza, mínimo privilegio y sincronización tras grant. Estado live del prompt prevalece sobre notas históricas del documento. |
| tests/testP8AuthorizationListingIntegration.test.ts | 1–123 | Integración offline nueva y regresiones de recibo/mirrors. |

# 5. DEFECTO EXACTO

Archivo: `src/services/institutionalAuthorizationProjectionRepository.ts`, `AdminAuthorizationProjectionAdapter.commit`, línea 15 del baseline.

Antes: `if ((await transaction.get(auditRef)).exists) return;` permitía concluir la sincronización sin inspeccionar/reaplicar índice y members. La ruta podía devolver 200 aunque éstos hubieran desaparecido.

Ahora: líneas 15–17 guardan `audited`, se procesa siempre el snapshot PG, y línea 36 crea el recibo sólo si falta. La misma transacción vuelve a confirmar los mirrors. No se modifica un recibo existente ni se inventan grants.

No se identificó un defecto adicional inequívoco responsable del listado vacío live. La conversión de excepciones a vacío reduce observabilidad, pero no prueba qué excepción ocurrió y conserva fail-closed; no se cambió ese contrato.

# 6. REMEDIACIÓN APLICADA

Corrección mínima de idempotencia: reaplicar proyección derivada aunque exista recibo de auditoría, conservando su inmutabilidad. Sin nuevo endpoint, SDK config, permisos, fallback ni cambio de Rules.

Se añadió integración con los servicios y adapter reales; PostgreSQL y Admin se sustituyen por fixtures exclusivamente offline. No se atribuye a esta remediación un cierre live todavía no observado.

# 7. ARCHIVOS MODIFICADOS

- src/services/institutionalAuthorizationProjectionRepository.ts: 4 inserciones y 2 eliminaciones.
- tests/testP8AuthorizationListingIntegration.test.ts: archivo nuevo, diez pruebas.
- artifacts/p8-authorization-flow/INFORME_P8_AUTORIZACION.md: este informe.

Sin staging, commits, push, merge, deploy ni cambios de rama. No se tocaron las Rules, PostgreSQL live, Firestore live o Production.

# 8. PRUEBAS EJECUTADAS

`npx jest --runInBand tests/testP8AuthorizationListingIntegration.test.ts` — primera ejecución detectó un reloj futuro artificial incompatible con Date.now capturado por defaults; se corrigió el fixture, sin cambiar runtime por ese motivo. Resultado final: **10 PASS**.

`npx jest --runInBand tests/testP8AuthorizationListingIntegration.test.ts tests/testInstitutionalAuthorizationProjection.test.ts tests/testInstitutionalFirebaseBridge.test.ts tests/testInstitutionalFirebaseTokenRoute.test.ts tests/testInstitutionalFirebaseAdmin.test.ts tests/testInstitutionalFirebaseClientBridge.test.ts tests/testInstitutionalProjectAccess.test.ts tests/testInstitutionalSessionIdentity.test.ts tests/testP8InstitutionalAuthBoundary.test.ts` — **9 suites, 140 tests PASS**.

Regresión sobre el archivo original de HEAD: `npx jest --runInBand tests/testP8AuthorizationListingIntegration.test.ts --testNamePattern 'replay with an existing audit receipt'` — **FAIL esperado**, 200 confirmado y mirrors ausentes; después se restauró la corrección y se repitió el archivo completo con PASS.

Casos: A READ, índice sólo ID controlado, member READ vigente, listado sólo expediente esperado y claims correctos; B SUPER_ADMIN sin grants vacío; C READ permitido y WRITE/ANALYZE_SCINCE/GENERATE_REPORT denegados; D revocado excluido; E fallo al escribir member o commit → 503, rollback y mint no llamado. Adicionales: listado independiente del mirror, deleted excluido, replay restaura mirrors sin duplicar audit y error de reparación no emite token.

No build completo ni acceso de red a los proveedores. Los tests usan sustitutos offline de I/O; no son E2E de navegador real ni emuladores de Rules en esta intervención.

# 9. TSC

**PASS** — `npx tsc --noEmit`, exit code 0.

# 10. GIT DIFF --CHECK

**PASS** — `git diff --check`, exit code 0. Git advierte normalización LF→CRLF; no es error de whitespace. Los archivos nuevos también se revisan de forma independiente sin incorporarlos al índice.

# 11. IMPACTO DE SEGURIDAD

- READ: sólo el grant explícito vigente permite listar/leer el ID asignado.
- WRITE, ANALYZE_SCINCE y GENERATE_REPORT: siguen denegados para el grant READ.
- Role bypass: ninguno para ADMIN/SUPER_ADMIN por proyecto.
- Fail-closed: error de persistencia impide mint y devuelve 503; error de listado limpia la UI.
- PostgreSQL sigue siendo autoridad; runtime conserva sus consultas SELECT y no escribe grants.
- Auditoría existente permanece inmutable; mirrors se reaplican sólo desde snapshot validado, de forma atómica. Un rechazo de escritura que antes quedaba oculto por el recibo ahora se propaga.

# 12. ESTADO DE P8

**REQUIERE VALIDACIÓN LIVE.** Remediación local y validación offline completadas. Causa conjunta de las observaciones Preview todavía no acreditada; no se declara PASS E2E ni que el expediente ya sea visible.

# 13. SIGUIENTE PRUEBA LIVE MÍNIMA

No ejecutada aquí. Un operador autorizado debe realizar una sola prueba correlacionada en Preview, sin tocar Production ni modificar grants/Rules:

1. Antes de repetir, identificar el deployment exacto, commit y hora UTC del token observado, y el destino de la comprobación 404: proyecto **perfilador-remoto**, base **(default)**, paths exactos, método de consulta y contexto de autorización. Diferenciar un 404 administrativo de una lectura denegada al cliente; no compartir credenciales ni respuesta del token. Para comprobar la corrección local, usar posteriormente un Preview con estos cambios mediante el proceso de release autorizado; este trabajo no lo despliega.
2. Mediante consola administrativa autorizada, comprobar sólo existencia y flags del documento `projects/Kzp218N27O1F9aNS9M98`: deleted ausente/false y su estado. No exportar su contenido. No reabrir la migración PostgreSQL ya acreditada.
3. Cerrar sesión y realizar un login institucional fresco con usuario 1 en ese Preview. Registrar únicamente UTC, deployment/commit, status de firebase-token y finalización exitosa/fallida de Firebase Auth. No copiar token, cookies o contraseña. Este login ejecuta las escrituras derivadas propias del flujo; no hacer escrituras manuales de Firestore.
4. Inmediatamente, dentro de la lease de cinco minutos, consultar administrativamente en el mismo proyecto/base: `authorizationUsers/1` con projectIds exactamente [Kzp218N27O1F9aNS9M98], y member del mismo ID con allowedActions [READ], revoked=false y timestamps vigentes. Examinar el recibo PROJECTION_SYNCHRONIZED correspondiente a esa sincronización sin exportar datos personales.
5. Correlacionar también la llamada server action del listado en Preview: status/error sanitizado y cantidad de registros. En UI borrar búsqueda/filtros y confirmar exactamente un expediente con el ID/nombre/folio esperados; no basta el HTTP200 del token. Si la llamada falla, registrar únicamente el error sanitizado disponible en la plataforma y su hora, sin cuerpos de sesión ni variables de entorno. Si devuelve cero, comprobar existencia/deleted del documento en el destino Admin del mismo deployment. Si devuelve uno y UI cero, registrar el estado visual de búsqueda/paginación y el error frontend sanitizado.
6. Confirmar mediante el procedimiento de validación autorizado que WRITE, ANALYZE_SCINCE y GENERATE_REPORT siguen denegados; no ejecutar acciones que creen/modifiquen documentos o generen informes reales. La autorización de lectura no habilita estas acciones.

Si token=200 y mirrors aún ausentes, comparar primero identidad del deployment y destino efectivo de Firestore con el destino de observación. El token firmado acredita identidad de Firebase Auth, no por sí solo el destino efectivo de Firestore. La reproducción de idempotencia sólo explica el caso si hubo recibo exactamente coincidente con el hash de ese snapshot y timestamp; sin esa evidencia no atribuirle el incidente.
