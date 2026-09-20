# Dataset territorial INEGI 2020

Esta ingesta administrativa carga para Aguascalientes (`CVE_ENT=01`) dos productos oficiales:

- Marco Geoestadistico del Censo de Poblacion y Vivienda 2020: capas `01ent`, `01mun`, `01l`, `01a` y `01m`.
- Principales resultados por AGEB y manzana urbana 2020: `POBTOT`, `VIVTOT`, `VIVPAR_HAB` y `VIVPAR_DES`.

No carga marginacion, no genera poligonos, no simplifica geometria y no sustituye datos faltantes. La clave censal canonica usa delimitadores: `CVE_ENT:CVE_MUN:CVE_LOC:CVE_AGEB[:CVE_MZA]`.

## Prerrequisitos

- Node.js y dependencias del proyecto (`npm ci`).
- PostgreSQL accesible mediante `DATABASE_URL` y un rol administrativo separado del runtime.
- PostGIS instalable por el rol de migraciones.
- GDAL con `ogr2ogr` y `ogrinfo` en `PATH`.
- PowerShell en Windows o `unzip` en Linux.
- Espacio temporal suficiente fuera del repositorio.

Comprobacion:

```powershell
# Windows
ogr2ogr --version
ogrinfo --version
$env:DATABASE_URL = "postgresql://<usuario>:<password>@<host>:5432/<db>?sslmode=require"
```

```bash
# Linux/VPS administrativo
ogr2ogr --version
ogrinfo --version
export DATABASE_URL='postgresql://<usuario>:<password>@<host>:5432/<db>?sslmode=require'
```

No coloque `DATABASE_URL` en argumentos de procesos compartidos. El importador la acepta por entorno y pasa la contraseña a GDAL mediante `PGPASSWORD` solamente cuando existe; no la imprime. La cuenta runtime `ceipol_app` es de solo lectura y el preflight la rechaza para ingesta.

## Migracion

Aplicar una sola vez con el rol de migraciones. El runtime de Next.js no ejecuta DDL.

```powershell
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/migrations/inegi-territorial/001_inegi_territorial_dataset_up.sql
```

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/inegi-territorial/001_inegi_territorial_dataset_up.sql
```

La migracion UP es aditiva, conserva claves con ceros a la izquierda, usa `MultiPolygon` SRID 4326 y crea el indice GiST y los indices territoriales.

## Importacion

La ayuda no requiere DB, GDAL ni red:

```bash
node scripts/inegi/import-aguascalientes-2020.mjs --help
```

### Linux/VPS recomendado

Ejecutar nativamente en el VPS administrativo, no mediante una cadena PowerShell-SSH-Bash. El runner usa por defecto `postgresql://postgres@127.0.0.1:5432/ceipol_perfilador`, sin password, y nunca modifica HBA, permisos, migraciones ni despliegues.

Primero, preflight y descarga verificada, sin escrituras PostgreSQL:

```bash
cd /root/inegi-perfilador
bash scripts/inegi/run-aguascalientes-2020-vps.sh preflight
```

Revise que la salida sea `PREFLIGHT_OK`, `writeOperations: 0`, hashes aprobados, cinco capas y usuario administrativo. Después, importación real usando exactamente los ZIP ya validados:

```bash
cd /root/inegi-perfilador
bash scripts/inegi/run-aguascalientes-2020-vps.sh import
```

Para paths locales distintos puede invocarse directamente `npm run inegi:preflight -- --geography-zip ... --census-zip ... --work-dir ...`; después se usa `npm run inegi:import` con los mismos paths. Los hashes fijados en código son el baseline aprobado: un valor diferente produce `HASH_DRIFT` con hash esperado, recibido, URL y tamaño, y no puede anularse silenciosamente desde CLI.

El importador valida herramientas, espacio libre, HTTP, timeout, rutas ZIP, capas/campos/CRS con `ogrinfo`, columnas CSV, hashes originales, PostGIS, tablas y permisos administrativos. Reproyecta con `-t_srs EPSG:4326`, registra `IMPORTING`, usa una transaccion para filas y marca `READY` unicamente después de validar geometrías y conteos geográficos/demográficos AGEB y manzana. Un fallo controlado revierte filas y conserva `FAILED`. No sobrescribe datasets `READY`; un dataset `FAILED` sólo se reintenta de forma explícita con `--retry-failed`.

## Verificacion

Estado, version y lineage:

```sql
SELECT dataset_id, product_name, reference_year, version, status,
       imported_at, completed_at, geography_sha256, census_sha256,
       geography_feature_count, demographic_record_count
FROM public.inegi_territorial_dataset
ORDER BY imported_at DESC;
```

Cobertura por nivel:

```sql
SELECT geographic_level, count(*)
FROM public.inegi_territorial_geography
WHERE dataset_id = '<dataset_id>'
GROUP BY geographic_level ORDER BY geographic_level;

SELECT geographic_level, count(*)
FROM public.inegi_territorial_demographics
WHERE dataset_id = '<dataset_id>'
GROUP BY geographic_level ORDER BY geographic_level;
```

Indices:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename LIKE 'inegi_territorial_%'
ORDER BY tablename, indexname;
```

Resolucion GIS de la coordenada de integracion (`lng`, `lat`):

```sql
SELECT geographic_level, cve_ent, cve_mun, cve_loc, cve_ageb, cve_mza
FROM public.inegi_territorial_geography
WHERE dataset_id = '<dataset_id>'
  AND ST_Covers(geom, ST_SetSRID(ST_MakePoint(-102.2916, 21.8853), 4326))
ORDER BY CASE geographic_level WHEN 'MANZANA' THEN 1 WHEN 'AGEB' THEN 2
  WHEN 'LOCALIDAD' THEN 3 WHEN 'MUNICIPIO' THEN 4 ELSE 5 END;
```

## Fuentes y checksums observados

- Geografia: `https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/marcogeo/889463807469/01_aguascalientes.zip`
- Censo: `https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/ageb_manzana/ageb_mza_urbana_01_cpv2020_csv.zip`
- SHA-256 observado el 2026-09-19: geografia `744058229ebe6990140471605633926611b709476c85ba378892a55be0d169b7`; censo `cac8849a7f672b3aa8d2722f8bef078ab9984588c02a498c2a776461918d12e9`.

INEGI puede reemplazar artefactos publicados. Cualquier hash nuevo requiere revision y aprobacion; no omita la fijacion de hashes en una carga institucional.

## Runtime y rollback

Vercel solo consulta las tablas mediante `DATABASE_URL`. No puede depender de ZIP, SHP o CSV del VPS y no debe ejecutar la ingesta dentro de un request. La importacion se ejecuta desde un entorno administrativo con red, GDAL y acceso PostgreSQL.

`001_inegi_territorial_dataset_down.sql` es destructiva para estas tres tablas y sus datos. No la ejecute en produccion sin autorizacion, respaldo verificado y ventana de rollback. No elimina la extension PostGIS ni objetos ajenos a esta funcionalidad.
