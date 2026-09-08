# REGISTRO MAESTRO DE RELEASES Y DESPLIEGUES
## PERFILADOR REMOTO SSPE-CEIPOL
## VERSIÓN 1.0 VALIDADA CONTRA GIT Y VERCEL

Fecha de auditoría: 2026-09-07

Repositorio: `C:\Users\sadi7\OneDrive\Desktop\ECOSISTEMA SAI\PERFIL REMOTO`

Modo: READ-ONLY forense documental. Este archivo es el único artefacto creado.

## 1. Propósito

Este registro reconstruye la trazabilidad entre ADR/fase, implementación, commit, test/certificación, tag/release, push remoto y evidencia de Vercel.

La regla de cierre es conservadora: Git push, tag o commit con texto "production" no prueban por sí mismos que un deployment haya llegado a Vercel Production. Production sólo se declara verificada cuando existe evidencia directa de deployment productivo, alias productivo o inspección Vercel read-only.

## 2. Baseline auditada

| Campo | Valor |
|---|---|
| Git toplevel | `C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA SAI/PERFIL REMOTO` |
| Rama local | `main` |
| HEAD local | `8622a4df18f8728692eb6087c0c5ce11584ea2c1` |
| HEAD corto | `8622a4d` |
| Mensaje HEAD | `feat(incidencia): enforce canonical spatial queries ADR-INC-001` |
| Fecha HEAD | `2026-09-08T16:21:02-06:00` |
| origin/main | `94c3f781ebd34f2a1fc5fa78e2d9c3a024bc6099` |
| HEAD == origin/main | NO — local 2 commits adelante / 0 atrás |
| prod-github/main | NO DISPONIBLE LOCALMENTE |
| Working tree | Código productivo limpio; permanecen documentos y logs QA no trackeados |
| Vercel CLI | VERCEL_CLI_NO_DISPONIBLE |
| Firestore projects | 0, por contexto de auditoría |
| Storage projects/ | 0, por contexto de auditoría |

Estado local previo relevante: existen cambios no relacionados de Incidencia en `src/app/api/incidencia/route.ts`, `src/app/incidencia/page.tsx`, `src/lib/incidenceStreetCandidateProvider.ts`, `src/lib/incidenceStreetCandidatesApiHandler.ts`, `src/utils/crimeIncidenceProductionComposition.ts`, más archivos no trackeados de Incidencia. No fueron tocados.

## 3. Fuentes utilizadas

| Fuente | Resultado |
|---|---|
| `git rev-parse --show-toplevel` | Baseline de repositorio confirmada. |
| `git branch --show-current` | Rama `main`. |
| `git rev-parse HEAD` | Snapshot histórico de auditoría 07/09/2026: HEAD `af213e0b099c52f545886aea8e6f3e99fff33eeb`. |
| `git rev-parse origin/main` | Snapshot histórico 07/09/2026: coincidía con HEAD `af213e0`. Estado vigente actualizado en la sección 23. |
| `git status --short` | Snapshot histórico 07/09/2026: working tree con cambios de Incidencia. ADR-INC-001 fue cerrado posteriormente. |
| `git remote -v` | `origin` y `prod-github` configurados; sólo `origin/main` disponible como ref local. |
| `git branch -a` | Ramas ADR/GEOINT/preview/reconcile/validation identificadas. |
| `git tag --list` y `git show-ref --tags` | 19 tags/releases identificados. |
| `git log --all --oneline --decorate` filtrado | Commits ADR/QA/release/deploy relevantes identificados. |
| `rg` documental | Sin evidencia directa de deployment Vercel inspeccionable en MD/TXT/JSON. |
| `.vercel/project.json` | Proyecto Vercel localmente vinculado a `perfilador-remoto`; no prueba deployment. |
| `.env.vercel*` | Variables configuradas; valores no inspeccionados ni reportados. |

## 4. Estado de acceso a Vercel

| Elemento | Estado | Observaciones |
|---|---|---|
| Vercel CLI | VERCEL_CLI_NO_DISPONIBLE | `vercel --version` no existe en PATH. |
| `vercel whoami` | NO EJECUTABLE | CLI no disponible. |
| `vercel ls` / inspect | NO EJECUTABLE | No se instalaron herramientas. |
| `.vercel/project.json` | CONFIGURADO | Proyecto local vinculado a `perfilador-remoto`. |
| `.env.vercel` | CONFIGURADA | Contiene `VERCEL_OIDC_TOKEN`; valor no impreso. |
| `.env.vercel.production` | CONFIGURADA | 56 nombres de variables detectados; valores no impresos. |
| Production directo | VERCEL_NOT_VERIFIABLE | No hay inspección CLI ni reporte de deployment productivo directo. |

Conclusión: Vercel está configurado localmente, pero no verificable por CLI en esta auditoría. Ningún commit se clasifica como `PRODUCTION_VERIFIED`.

## 5. Inventario de ramas relevantes

| Rama | Tipo | Estado observado | Observaciones |
|---|---|---|---|
| `main` | Local | Activa | HEAD local `8622a4d`; 2 commits adelante de `origin/main`. |
| `origin/main` | Remota | Disponible | Baseline remota verificable `94c3f78`; no contiene todavía E2E-004 ni ADR-INC-001. |
| `feature/ADR-020-GEOINT-SWEEP-ENGINE` | Local/remota | Disponible | Release checkpoint ADR-020.35-39. |
| `feature/v2.5.1-evolution` | Local/remota | Disponible | Contiene commit de force clean production deployment, no Production verificado. |
| `preview/ADR-019.13-GEOINT` | Local/remota | Disponible | Rama preview Git; no deployment Preview Vercel verificado. |
| `reconcile/ADR-020-main-integration` | Local/remota | Disponible | Merge a main por PR #1. |
| `validation/adr-022-30-mobile-geography` | Local/remota | Disponible | Validación ADR-022.29/30. |
| `backup_pre_fase11` | Local | Disponible | Rama histórica. |
| `prueba-pre-streetview` | Local/remota | Disponible | Rama histórica de prueba. |

## 6. Inventario de tags/releases

| Fecha | ADR/Fase | Commit | Mensaje | Rama | Tag | Certificación | Push | Deployment ID/URL | Environment | Estado Vercel | Production | Sustituido por | Clasificación | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-08-10 | v2.4.1 | d527925 | Perfilador Remoto v2.4.1 Recovery | s/d | v2.4.1-recovery | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | v2.5.0/v2.6.x | TAG_ONLY | Release histórico. |
| 2026-08-20 | v2.5.1 | 1f113e4 | Frontend Backend Governance Integration | s/d | v2.5.1 | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | v2.6.0 | TAG_ONLY | Tag no demuestra Production. |
| 2026-08-20 | v2.6.0 | f9b58ce | Report Engine & Document Engine Governance | main histórico | v2.6.0 | DOCUMENTED | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | v2.6.1 | TAG_ONLY | Release relevante documental. |
| 2026-08-20 | v2.6.1 | 672f1e7 | Stability Governance | main histórico | v2.6.1 | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | v2.6.2-fase1 | TAG_ONLY | Release de estabilidad. |
| 2026-08-20 | v2.6.2 Fase 1 | 17ebc06 | Geospatial Lifecycle Governance | main histórico | v2.6.2-fase1 | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020+QA | TAG_ONLY | Tag objetivo apunta a objeto tag; commit observado `dc5e4d3`. |
| 2026-08-20 | Backup v2.6.2 | ebc1dd6 | Backup completo antes rollback | main histórico | backup-v2.6.2-antes-rollback | N/A | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | N/A | TAG_ONLY | Backup, no release productiva. |
| 2026-08-21 | ADR-016 | f3d30e1 | Human validation workflow sprint 1 | s/d | v2.5.1-sprint1-adr016 | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020/024 | TAG_ONLY | RBAC/human validation. |
| 2026-08-21 | ADR-017 | b0d5b32 | POI Geographic Entity Storage Decoupling | s/d | v2.5.1-adr017-geographic-decoupling | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020.29A | TAG_ONLY | Geografía desacoplada. |
| 2026-08-21 | ADR-017 v1.1 | f33608f | GEOINT event interception fix | s/d | v2.5.1-adr017-v1.1-geoint-event-fix | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-019/020 | TAG_ONLY | Hotfix. |
| 2026-08-21 | ADR-018 | b1ad4e8 | GEOINT Controlled Sweep Engine | s/d | v2.5.1-adr018-controlled-sweep-engine | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-019/020 | TAG_ONLY | Barrido controlado. |
| 2026-08-21 | ADR-019 | 89d9a93 | Temporal Comparative Evidence Engine | s/d | v2.5.1-adr019-temporal-comparative-engine | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-019.19 | TAG_ONLY | Motor temporal. |
| 2026-08-21 | ADR-019.1 | bc46471 | GEOINT UI Integration | s/d | v2.5.1-adr019.1-geoint-ui-integration | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-019.19 | TAG_ONLY | Integración UI. |
| 2026-08-21 | ADR-019.2 | 1a0f1ef | Runtime Integration Fix GEOINT Engines | s/d | v2.5.1-adr019.2-runtime-integration-fix | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-019.19 | TAG_ONLY | Fix runtime. |
| 2026-08-21 | ADR-019.3 | 626e2c4 | Google Maps Loader Singleton Fix | s/d | v2.5.1-adr019.3-google-loader-fix | UNKNOWN | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-019.19 | TAG_ONLY | Fix loader. |
| 2026-08-25 | ADR-019.15 | 88b9f0e | Street View Sweep GEOINTEGRITY Complete | preview histórico | ADR-019.15-BEFORE-UX-HOTFIX | CERTIFIED in message | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-019.16/019.19 | TAG_ONLY | Certificación Git, no Vercel. |
| 2026-08-26 | ADR-019.19 | 8a77050 | GEOINT Event Outbox Pattern Certified | preview | ADR-019.19-v1.0 | CERTIFIED in tag | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | v2.5.1-adr01919 | TAG_ONLY | Tag anotado; commit directo `55aa27d`. |
| 2026-08-28 | ADR-019.19 | 8bf9ee7 | Transactional GEOINT Event Outbox certified closure | feature/main histórico | v2.5.1-adr01919-transactional-event-outbox | CERTIFIED in tag | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020 | TAG_ONLY | Cierre de outbox. |
| 2026-08-31 | ADR-020.35 | e0bf65e | ADR-020 GEOINT Sweep Engine | feature/main histórico | v2.5.1-adr020-geoint-sweep-engine | CERTIFIED by tag/message | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | QA-01..QA-06 | TAG_ONLY | Baseline ADR-020 relevante. |
| 2026-08-21 | v2.5.0 | 8e4f843 | Stable recovery 244796c | s/d | v2.5.0-stable-recovery-244796c | E2E in tag text | TAG | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | v2.6.x | TAG_ONLY | Recovery stable, no Production verificado. |

Tags/releases identificados: 19.

## 7. Línea de tiempo maestra

| Fecha | ADR/Fase | Commit | Mensaje | Rama | Tag | Certificación | Push | Deployment ID/URL | Environment | Estado Vercel | Production | Sustituido por | Clasificación | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-07-14 | ADR-000 | 095c97a | Integrate new ADR-000 governance rector document | main histórico | N/A | DOCUMENTED | GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO | ADR posteriores | GIT_PUSH_ONLY | Arquitectura rectora. |
| 2026-07-17 | ADR-010 | 5f14e76 | Soft Governance Quality Gate | main histórico | N/A | DOCUMENTED | GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO | ADR-020/024 complementan | GIT_PUSH_ONLY | Quality Gate humano. |
| 2026-07-17 | ADR-011/012 | 9b6319c | HLIE/EGE validation engines and tests | main histórico | N/A | DOCUMENTED | GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO | ADR-017/020 | GIT_PUSH_ONLY | Evidencia/geointegridad. |
| 2026-08-11 | ADR-013 | 2d4107c | Document Engine integration | main histórico | N/A | DOCUMENTED | GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO | ADR-020.33 | GIT_PUSH_ONLY | Documento inicial. |
| 2026-08-17 | Deploy marker | d495c85 | force production redeployment on Vercel for E2E validation | main histórico | N/A | UNKNOWN | GIT | N/A | desconocido | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | NO VERIFICABLE | posteriores | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | Mensaje indica deploy, sin inspección Vercel. |
| 2026-08-17 | Build fix | f4d288c | resolve Vercel type error | main histórico | N/A | BUILD_FIX | GIT | N/A | desconocido | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | NO VERIFICABLE | posteriores | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | Evidencia de fallo build corregido, no deployment. |
| 2026-08-20 | v2.6.0 | 2ef037f | release v2.6.0 governance and stability | main histórico | v2.6.0 | UNKNOWN | TAG/GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | v2.6.1 | TAG_ONLY | Release Git. |
| 2026-08-21 | ADR-017 | 2115a2a | geographic entity storage decoupling | feature histórico | v2.5.1-adr017-geographic-decoupling | UNKNOWN | TAG/GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020.29A | TAG_ONLY | Geografía. |
| 2026-08-21 | ADR-018 | af75d7a | controlled sweep engine | feature histórico | v2.5.1-adr018-controlled-sweep-engine | UNKNOWN | TAG/GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-019/020 | TAG_ONLY | Barrido. |
| 2026-08-21 | ADR-019.4 | 9ef24c2 | force clean production deployment after chunk mismatch | feature/v2.5.1-evolution | N/A | UNKNOWN | REMOTE_BRANCH | N/A | desconocido | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | NO VERIFICABLE | posteriores | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | Posible deployment correctivo no verificable. |
| 2026-08-25 | ADR-019.15 | 88b9f0e | Street View Sweep GEOINTEGRITY Complete | preview histórico | ADR-019.15-BEFORE-UX-HOTFIX | CERTIFIED | TAG/GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-019.16 | TAG_ONLY | Certificado por Git/tag. |
| 2026-08-26 | ADR-019.19 | 55aa27d | GEOINT Event Outbox Pattern certified | preview/ADR-019.13-GEOINT | ADR-019.19-v1.0 | CERTIFIED | REMOTE_BRANCH/TAG | N/A | Preview desconocido | VERCEL_NOT_VERIFIABLE | NO | dc3e9c5 | TAG_ONLY | Rama preview Git, no Vercel Preview probado. |
| 2026-08-28 | ADR-019.19 | dc3e9c5 | close transactional event outbox | feature/main histórico | v2.5.1-adr01919 | CERTIFIED | TAG/GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020 | TAG_ONLY | Cierre outbox. |
| 2026-08-28 | ADR-020.17-21 | 69d2222..87c369b | IA firewall, OSINT, DENUE, incidence pipeline | main histórico | N/A | UNKNOWN | GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020.35 | GIT_PUSH_ONLY | Subfases base. |
| 2026-08-30 | ADR-020.22-33 | 1d567b6..7061365 | Evidence lifecycle, canonical geography, IA, report publication | main histórico | N/A | PARTIAL_CERT | GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020.35 | GIT_PUSH_ONLY | Subfases críticas. |
| 2026-08-31 | ADR-020.35 | 9d2eb31 | harden productive provenance and human validation | main/feature histórico | v2.5.1-adr020-geoint-sweep-engine | CERTIFIED | TAG/GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | QA-01..QA-06 | TAG_ONLY | Release ADR-020. |
| 2026-09-02 | Production trigger | 05116cf | retrigger incidence governance production deployment | main histórico | N/A | UNKNOWN | GIT | N/A | desconocido | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | NO VERIFICABLE | posteriores | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | Mensaje indica producción, sin Vercel. |
| 2026-09-04 | Vercel build fix | 6052578 | include territorial boundary providers for Vercel build | validation/main histórico | N/A | BUILD_FIX | GIT | N/A | desconocido | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | NO VERIFICABLE | posteriores | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | Evidencia de fix de build Vercel. |
| 2026-09-04 | ADR-022 | 7a68e6e | certify institutional E2E traceability and export governance | main | N/A | CERTIFIED | GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-023/025/QA | GIT_PUSH_ONLY | Incidencia/export governance. |
| 2026-09-05 | ADR-023/024/025 | bbc5346..89c16e0 | Street View, correlation, AI, Google evidence | main | N/A | PARTIAL_CERT | GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-025 final/report | GIT_PUSH_ONLY | Multisource/IA/Google. |
| 2026-09-06 | ADR-025/report | 3716a70 | integrate governed predictive products into institutional reporting | main | N/A | UNKNOWN | GIT | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | QA-01..QA-06 | GIT_PUSH_ONLY | Reporte predictivo. |
| 2026-09-07 | QA-06 | cdbcc19..af213e0 | historical reconciliation and manual territorial vertices | main/origin | N/A | QA focal histórica en commits | PUSH_VERIFIED_ORIGIN | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | N/A | GIT_PUSH_ONLY | Baseline Git actual; Production no comprobada. |

## 8. Deployments Production

No se verificó ningún deployment Production por CLI ni por artefacto directo.

| Deployment ID/URL | Commit | Fecha | Environment | Estado Vercel | Production | Clasificación | Observaciones |
|---|---|---|---|---|---|---|---|
| N/A | N/A | N/A | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | VERCEL_NOT_VERIFIABLE | CLI no disponible y no hay reporte directo de Vercel. |

## 9. Deployments Preview relevantes

No se verificó ningún deployment Preview Vercel. Existe rama Git `preview/ADR-019.13-GEOINT`, pero eso no equivale a Vercel Preview.

| Deployment ID/URL | Commit | Fecha | Environment | Estado Vercel | Production | Clasificación | Observaciones |
|---|---|---|---|---|---|---|---|
| N/A | 55aa27d | 2026-08-26 | Git preview branch | VERCEL_NOT_VERIFIABLE | NO | TAG_ONLY | Rama preview remota y tag ADR-019.19; deployment no inspeccionado. |

## 10. Deployments fallidos/cancelados

No se encontraron deployments Vercel fallidos/cancelados verificables. Sí existen commits que mencionan fallos o fixes asociados a Vercel.

| Fecha | ADR/Fase | Commit | Mensaje | Rama | Tag | Certificación | Push | Deployment ID/URL | Environment | Estado Vercel | Production | Sustituido por | Clasificación | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-09-04 | ADR-022.29 | 6052578 | include territorial boundary providers for Vercel build | main/validation | N/A | BUILD_FIX | GIT | N/A | desconocido | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | NO VERIFICABLE | posteriores | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | Evidencia de corrección de build, no de fallo inspeccionado. |
| 2026-08-21 | ADR-019.4 | 9ef24c2 | force clean production deployment after chunk mismatch | feature/v2.5.1-evolution | N/A | UNKNOWN | REMOTE_BRANCH | N/A | desconocido | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | NO VERIFICABLE | posteriores | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | Chunk mismatch documentado por mensaje. |
| 2026-08-17 | Build | f4d288c | resolve Vercel type error | main histórico | N/A | BUILD_FIX | GIT | N/A | desconocido | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | NO VERIFICABLE | posteriores | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | Type error corregido. |

## 11. ADR → Commit → Tag → Deployment

| ADR/Fase | Commit principal | Tag | Certificación | Push verificado | Vercel verificado | Environment | Estado deployment | Production | Sustituido por | Estado actual |
|---|---|---|---|---|---|---|---|---|---|---|
| ADR-000 | 095c97a | N/A | Documental | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR específicos | Rector vigente. |
| ADR-003 | 23fbb38 | N/A | Histórico | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR posteriores | Histórico. |
| ADR-004 | a8fab75..e633ed1 | N/A | Parcial documental | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020/021 | Vigente histórico. |
| ADR-007 | 8088fda/94ba6cf | N/A | 8/8 pruebas por mensaje | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-008 | Histórico. |
| ADR-008 | 30d9e0f..64b7177 | N/A | Parcial | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020/021 | Vigente por pipeline. |
| ADR-010 | 5f14e76 | N/A | Documental | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-024 complementa | Rector vigente. |
| ADR-011 | 9b6319c; docs cert | N/A | CERTIFIED | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-019/020 complementan | Rector vigente. |
| ADR-012 | 2729523 | N/A | Build verification por mensaje | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-017/020 | Vigente. |
| ADR-013 | 2d4107c/04f43fd | N/A | Integración posterior ADR-020.33 | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020.33 | Vigente. |
| ADR-014 | s/d | N/A | No localizada | NO | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO | N/A | Pendiente. |
| ADR-015 | s/d | N/A | No localizada | NO | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO | N/A | Pendiente. |
| ADR-016 | 0719044 | v2.5.1-sprint1-adr016 | UNKNOWN | TAG/GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020/024 | Vigente. |
| ADR-017 | 2115a2a/a81aff6 | v2.5.1-adr017-* | UNKNOWN | TAG/GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020.29A | Vigente. |
| ADR-018 | af75d7a | v2.5.1-adr018-controlled-sweep-engine | UNKNOWN | TAG/GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-019/020 | Vigente. |
| ADR-019 | d3b38e4..dc3e9c5 | ADR-019.15, ADR-019.19, v2.5.1-adr019* | CERTIFIED by docs/tags | TAG/GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-020 | Vigente. |
| ADR-020 | 69d2222..9d2eb31 | v2.5.1-adr020-geoint-sweep-engine | CERTIFIED by tag/subfase | TAG/GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | QA-01..QA-06 | Rector operativo. |
| ADR-021 | c0c7e77..757cb6c | N/A | Parcial | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-023/025 | Vigente. |
| ADR-022 | 9670518..18aedce | N/A | CERTIFIED by 7a68e6e | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | QA/report | Rector incidencia. |
| ADR-023 | bbc5346/22ca7aa | N/A | UNKNOWN | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | ADR-025 | Vigente. |
| ADR-024 | 048105a | N/A | CERTIFIED by message | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | N/A | Rector IA. |
| ADR-025 | 89c16e0..3716a70 | N/A | UNKNOWN | GIT | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | QA/report | Vigente. |
| QA-06 | 0370554..af213e0 | N/A | QA focal por commits | PUSH_VERIFIED_ORIGIN | NO | desconocido | VERCEL_NOT_VERIFIABLE | NO VERIFICABLE | N/A | Baseline Git actual. |

## 12. Certificación → Deployment

| Certificación | Commit/Documento | Evidencia de validación | Deployment | Clasificación | Resultado |
|---|---|---|---|---|---|
| FINAL-CERTIFICATION-REPORT | docs/FINAL-CERTIFICATION-REPORT.md | Build exitoso documentado | N/A | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | No prueba Production. |
| ADR-011 Final Certification | docs/ADR-011-FINAL-CERTIFICATION.md | PASS en casos funcionales | N/A | VERCEL_NOT_VERIFIABLE | Certificado funcional, deployment no probado. |
| ADR-019.16 Certified UX | docs/ADR-019.16-CERTIFIED-GEOINT-UX-FINALIZATION.md | Certificado para producción y build estable | N/A | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | Producción documentada, no verificada por Vercel. |
| ADR-019.17 Certification | docs/ADR-019.17-CERTIFICATION-REPORT.md | Suite PASS y TSC documentado | N/A | VERCEL_NOT_VERIFIABLE | Certificación técnica. |
| ADR-019.18 Closure | docs/ADR-019.18-CLOSURE-AUDIT.md | Certificado | N/A | VERCEL_NOT_VERIFIABLE | Cierre de ledger. |
| ADR-019.19 tag | ADR-019.19-v1.0 / v2.5.1-adr01919 | Certificado por tag/mensaje | N/A | TAG_ONLY | No prueba Production. |
| ADR-020.35 tag | v2.5.1-adr020-geoint-sweep-engine | Productive provenance/human validation | N/A | TAG_ONLY | No prueba Production. |
| ADR-022 E2E | 7a68e6e | Certify institutional E2E traceability/export | N/A | GIT_PUSH_ONLY | No prueba Production. |
| QA-06 | commits 0370554..af213e0 | Pruebas focales inferidas por mensajes; no reejecutadas | N/A | GIT_PUSH_ONLY | Baseline Git, no Vercel. |

## 13. Capacidades productivas

| Capacidad | ADR rector | Commit productivo más reciente | Deployment productivo | Estado actual | ¿Puede reimplementarse? | Condición |
|---|---|---|---|---|---|---|
| Geografía canónica | ADR-017/020.29A/QA-06 | af213e0 | VERCEL_NOT_VERIFIABLE | CURRENT_BASELINE_GIT | NO | Sólo corregir contrato vigente si falla. |
| Fotografía in situ | ADR-011/021 | 42dd23a | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | No convertir fotos en vertices automáticos. |
| Street View | ADR-011/019/023/025 | 89c16e0/bbc5346 | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | Sólo como evidencia/análisis gobernado. |
| Barrido GEOINT | ADR-018/020 | 9d2eb31 | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | Mantener trigger explícito. |
| Evidence Governance | ADR-011/020.22 | 1d567b6 | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | Preservar lifecycle y trazabilidad. |
| Hipótesis | ADR-020.31 | 1d52380 | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | No mezclar evidencia con conclusión. |
| OSINT | ADR-020.20/021 | 9ffc4e2/80c11be | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | Proveedor canónico y provenance. |
| DENUE | ADR-020.19/021/023 | 22ca7aa | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | Credenciales y trazabilidad. |
| SCINCE | ADR-021 | e756a61 | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | Orquestación canónica. |
| Incidencia | ADR-022 + ADR-INC-001 | `8622a4d` | VERCEL_NOT_VERIFIABLE | ADR-INC-001 CERTIFICADO_LOCAL; pendiente de push | NO | Preservar consulta espacial canónica y fail-closed territorial. |
| Pandillas | ADR-008/020.29/021 | 9cdc830/757cb6c | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | Pipeline autoritativo. |
| Orquestación multisource | ADR-021/023/025 | 9997afb | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | No duplicar motor. |
| IA | ADR-020.30/024 | 048105a | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | Revisión humana obligatoria. |
| Document Engine | ADR-013/020.33 | 7061365 | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | No duplicar Document Engine. |
| Word/PDF | ADR-013/020.33/QA-05 | cfd75d1 | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | Mantener export institucional. |
| RBAC | ADR-016 | b0c34b2/0719044 | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | Sesión/perfil obligatorio. |
| Sesiones | ADR-016/auth | e5444ed | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | No saltar autenticación. |
| Auditoría/outbox | ADR-019.19/020.28 | dc3e9c5/4c16d75 | VERCEL_NOT_VERIFIABLE | Vigente en Git | NO | No registrar falso éxito. |

## 14. Releases sustituidas

| Release/Commit | Clasificación | Sustituido por | Motivo |
|---|---|---|---|
| v2.4.1-recovery | SUPERSEDED | v2.5.x/v2.6.x | Baseline histórica superada. |
| v2.5.0-stable-recovery-244796c | SUPERSEDED | v2.5.1/v2.6.x | Stable recovery superada por releases posteriores. |
| v2.5.1 | SUPERSEDED | v2.6.0 | Release posterior de gobernanza. |
| v2.6.0 | SUPERSEDED | v2.6.1/v2.6.2-fase1 | Estabilidad y lifecycle posteriores. |
| v2.6.1 | SUPERSEDED | v2.6.2-fase1 | Geospatial lifecycle posterior. |
| ADR-019.15 | SUPERSEDED | ADR-019.16/019.19 | UX hotfix y outbox posteriores. |
| ADR-019.19-v1.0 | SUPERSEDED | v2.5.1-adr01919 / ADR-020 | Cierre transaccional y ADR-020. |
| v2.5.1-adr020-geoint-sweep-engine | SUPERSEDED_IN_GIT | QA-01..QA-06 | QA posteriores agregan geografía, reportes y reconciliación. |

## 15. Posibles regresiones

No se declara ninguna regresión productiva verificada porque no existe evidencia Vercel directa.

Riesgos documentales observados:

| Riesgo | Evidencia | Clasificación | Acción recomendada |
|---|---|---|---|
| Mensajes de deploy sin deployment verificable | d495c85, 05116cf, 9ef24c2 | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | Verificar con Vercel CLI/API en auditoría posterior. |
| Fixes de build Vercel sin reporte de resultado | f4d288c, 6052578 | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED | Inspeccionar deployment histórico cuando CLI esté disponible. |
| HEAD local actual no tiene tag/release | `8622a4d` | LOCAL_CERTIFIED_NOT_PUSHED | Crear release/tag sólo después de publicación remota y deployment verificados. |
| Artefactos documentales/QA no trackeados | `git status --short` | Sin cambios productivos pendientes | Mantener fuera de commits funcionales y versionar sólo documentación rectora aprobada. |

## 16. Commits con push pero sin Production verificable

| Grupo | Commits | Push | Vercel | Clasificación |
|---|---|---|---|---|
| Baseline histórica QA-06 | af213e0 y cadena 0370554..5de4b77 | origin/main verificado al 07/09/2026 | VERCEL_NOT_VERIFIABLE | HISTORICAL_GIT_BASELINE |
| ADR-025 | 89c16e0..3716a70 | origin/main por ancestry de HEAD | VERCEL_NOT_VERIFIABLE | GIT_PUSH_ONLY |
| ADR-024 | 048105a | origin/main por ancestry de HEAD | VERCEL_NOT_VERIFIABLE | GIT_PUSH_ONLY |
| ADR-023 | bbc5346/22ca7aa | origin/main por ancestry de HEAD | VERCEL_NOT_VERIFIABLE | GIT_PUSH_ONLY |
| ADR-022 | 7c1a63d..18aedce | origin/main por ancestry de HEAD | VERCEL_NOT_VERIFIABLE | GIT_PUSH_ONLY |
| ADR-020 | 69d2222..9d2eb31 | origin/main por ancestry de HEAD | VERCEL_NOT_VERIFIABLE | GIT_PUSH_ONLY/TAG_ONLY |
| ADR-019 | 55aa27d/dc3e9c5 y tags | remote branch/tag | VERCEL_NOT_VERIFIABLE | TAG_ONLY |
| Deploy markers | d495c85, 05116cf, 9ef24c2 | GIT/remote branch | no CLI | DOCUMENTED_AS_PRODUCTION_NOT_VERIFIED |

Push sin Production verificable: 74 commits relevantes aproximados en la línea ADR/QA/deploy auditada.

## 17. Baseline productiva actual

No existe baseline productiva Vercel verificable en esta auditoría.

Baselines Git vigentes:

| Campo | Valor |
|---|---|
| Baseline remota verificable | `94c3f781ebd34f2a1fc5fa78e2d9c3a024bc6099` |
| Mensaje | `QA-06 add manual territorial vertex corridor flow` |
| HEAD local certificado | `8622a4df18f8728692eb6087c0c5ce11584ea2c1` — pendiente de push |
| Rama | `main` |
| Remoto verificado | `origin/main` |
| Estado | REMOTE_BASELINE_PLUS_LOCAL_CERTIFIED_AHEAD |
| Vercel | VERCEL_NOT_VERIFIABLE |
| Production | NO VERIFICABLE |

## 18. Diferencia HEAD/origin/main vs Production

| Comparación | Resultado | Evidencia |
|---|---|---|
| HEAD local vs origin/main | NO | HEAD `8622a4d`; origin/main `94c3f78`; local 2 commits adelante / 0 atrás. |
| HEAD local vs prod-github/main | NO VERIFICABLE | Ref remota local no disponible. |
| HEAD local vs Vercel Production | NO VERIFICABLE | Vercel CLI no disponible y no hay deployment directo. |
| origin/main vs Vercel Production | NO VERIFICABLE | No se puede inspeccionar deployment. |

Resultado: `HEAD == PRODUCTION` = NO VERIFICABLE.

## 19. Riesgos o vacíos de trazabilidad

1. Vercel CLI no está instalada o no está en PATH; no se pudo ejecutar `vercel whoami`, `vercel ls` ni `vercel inspect`.
2. `.vercel/project.json` confirma vínculo local, pero no confirma deployment.
3. `.env.vercel.production` existe, pero no se imprimieron valores por seguridad; su existencia no prueba Production.
4. Hay commits con mensajes de producción/deploy, pero sin deployment ID/URL verificable.
5. HEAD local `8622a4d` todavía NO está pushado a `origin/main`; incluye E2E-004 y ADR-INC-001 certificados localmente.
6. `prod-github/main` no existe como ref local verificable.
7. No quedan cambios productivos pendientes de Incidencia; permanecen únicamente documentos y artefactos QA no trackeados.

## 20. Regla anti-reimplementación

Cuando una capacidad tenga baseline gobernada por ADR y commits vigentes, no puede reimplementarse desde cero por falta de deployment verificable. La falta de evidencia Vercel es un vacío de trazabilidad de release, no autorización para duplicar motores.

Capacidades con reimplementación prohibida por baseline Git gobernada: geografía canónica, fotografía in situ, Street View, barrido GEOINT, evidence governance, hipótesis, OSINT, DENUE, SCINCE, incidencia, Pandillas, orquestación multisource, IA, Document Engine, Word/PDF, RBAC, sesiones y auditoría/outbox.

## 21. Estado preparado para E2E

Estado: APTO CON ADVERTENCIAS.

Motivos:

- HEAD local `8622a4d` está 2 commits adelante de `origin/main` (`94c3f78`).
- La plataforma se reporta limpia en Firestore/Storage para nuevo E2E.
- Existen capacidades gobernadas por ADR/QA suficientes para crear expedientes INDIVIDUAL, CORREDOR y POLÍGONO.
- La baseline productiva de Vercel no pudo verificarse.
- ADR-INC-001 quedó cerrado en `8622a4d`; los artefactos documentales/QA restantes deben mantenerse fuera de commits funcionales.

Antes de declarar Production para E2E institucional, se requiere inspección Vercel read-only con CLI/API disponible.

## 22. Dictamen final

BASELINE PRODUCTIVA ACTUAL:
NO VERIFICABLE EN VERCEL; baseline Git remota verificable `94c3f781ebd34f2a1fc5fa78e2d9c3a024bc6099`; HEAD local certificado `8622a4df18f8728692eb6087c0c5ce11584ea2c1` pendiente de push.

VERCEL:
VERCEL_NOT_VERIFIABLE.

ENVIRONMENT:
desconocido.

HEAD LOCAL:
`af213e0b099c52f545886aea8e6f3e99fff33eeb`.

ORIGIN/MAIN:
`af213e0b099c52f545886aea8e6f3e99fff33eeb`.

HEAD == ORIGIN/MAIN:
SI.

HEAD == PRODUCTION:
NO VERIFICABLE.

ESTADO PARA E2E:
APTO CON ADVERTENCIAS.

BLOQUEADORES REALES:

- Vercel CLI no disponible; no se pudo verificar Production/Preview/Failed/Cancelled.
- No hay deployment ID/URL productivo verificable en documentación local.
- `prod-github/main` no está disponible como ref local.
- No existen cambios productivos pendientes de Incidencia; quedan sólo documentos/artefactos QA no trackeados.

NINGÚN BLOQUEADOR DE CÓDIGO PRODUCTIVO FUE MODIFICADO EN ESTA AUDITORÍA.

## 23. ACTUALIZACIÓN DE TRAZABILIDAD — 08/09/2026

| Fecha | ADR/Fase | Commit | Mensaje | Estado Git | Push | Vercel |
|---|---|---|---|---|---|---|
| 2026-09-08 | E2E-004 | `1ba92e4` | `fix(geoint): harden sweep lifecycle persistence E2E-004` | CERTIFICADO_LOCAL | NO | NO VERIFICABLE |
| 2026-09-08 | ADR-INC-001 | `8622a4d` | `feat(incidencia): enforce canonical spatial queries ADR-INC-001` | CERTIFICADO_LOCAL | NO | NO VERIFICABLE |

### Baseline posterior
- HEAD local: `8622a4df18f8728692eb6087c0c5ce11584ea2c1`
- origin/main: `94c3f781ebd34f2a1fc5fa78e2d9c3a024bc6099`
- Divergencia: `0 behind / 2 ahead`.
- E2E-004 y ADR-INC-001 aún no están publicados en `origin/main`.
- Ninguno de estos commits puede declararse Vercel Production hasta contar con evidencia directa de deployment.
