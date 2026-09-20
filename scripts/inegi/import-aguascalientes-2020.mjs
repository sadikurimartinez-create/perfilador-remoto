#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, readdir, rename, rm, stat, statfs } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { parse } from "csv-parse";
import pg from "pg";

const require = createRequire(import.meta.url);
const {
  assertApprovedArtifact, assertCoverage, buildDatasetId, buildGdalConnection, canonicalRowKey,
  redactError, toolNotConfiguredMessage, validateCensusColumns, validateLayerMetadata, validateZipEntries,
} = require("./importerCore.cjs");
const { Pool } = pg;

const GEOGRAPHY_URL = "https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/marcogeo/889463807469/01_aguascalientes.zip";
const CENSUS_URL = "https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/ageb_manzana/ageb_mza_urbana_01_cpv2020_csv.zip";
const PRODUCT_NAME = "Marco Geoestadistico y Principales resultados por AGEB y manzana urbana, Censo 2020";
const DOWNLOAD_TIMEOUT_MS = 300_000;
const MIN_FREE_BYTES = 5 * 1024 * 1024 * 1024;
const APPROVED_GEOGRAPHY_SHA256 = "744058229ebe6990140471605633926611b709476c85ba378892a55be0d169b7";
const APPROVED_CENSUS_SHA256 = "cac8849a7f672b3aa8d2722f8bef078ab9984588c02a498c2a776461918d12e9";
const HELP = `Uso:
  node scripts/inegi/import-aguascalientes-2020.mjs [opciones]

Opciones:
  --help                              Muestra esta ayuda sin requerir DB, GDAL ni red.
  --preflight-only                    Valida artefactos, herramientas, DB y permisos; no escribe en PostgreSQL.
  --download                          Descarga los dos ZIP desde las URLs oficiales.
  --work-dir <ruta>                   Directorio controlado de trabajo.
  --geography-zip <ruta>              ZIP local del Marco Geoestadistico.
  --census-zip <ruta>                 ZIP local del Censo AGEB/manzana.
  --expected-geography-sha256 <hash>  Debe coincidir con el hash aprobado en el codigo.
  --expected-census-sha256 <hash>     Debe coincidir con el hash aprobado en el codigo.
  --dataset-id <id>                   ID opcional; por defecto se deriva de ambos hashes.
  --retry-failed                      Reintenta explicitamente un dataset con estado FAILED.
  --database-url <url>                Alternativa a DATABASE_URL; evite usarla en procesos compartidos.
`;
const LEVELS = [
  { level: "ESTADO", suffix: "01ent.shp", fields: ["cvegeo", "cve_ent", "nomgeo"] },
  { level: "MUNICIPIO", suffix: "01mun.shp", fields: ["cvegeo", "cve_ent", "cve_mun", "nomgeo"] },
  { level: "LOCALIDAD", suffix: "01l.shp", fields: ["cvegeo", "cve_ent", "cve_mun", "cve_loc", "nomgeo"] },
  { level: "AGEB", suffix: "01a.shp", fields: ["cvegeo", "cve_ent", "cve_mun", "cve_loc", "cve_ageb"] },
  { level: "MANZANA", suffix: "01m.shp", fields: ["cvegeo", "cve_ent", "cve_mun", "cve_loc", "cve_ageb", "cve_mza"] },
];

function argumentsMap(argv) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const next = argv[index + 1];
    options.set(token.slice(2), next && !next.startsWith("--") ? next : true);
    if (next && !next.startsWith("--")) index += 1;
  }
  return options;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit", env: options.env });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => rejectPromise(new Error(error.code === "ENOENT" ? toolNotConfiguredMessage(command) : redactError(error))));
    child.once("exit", (code) => code === 0
      ? resolvePromise(stdout)
      : rejectPromise(new Error(`${command} termino con codigo ${code}: ${redactError(stderr)}`)));
  });
}

async function preflight() {
  await run("ogr2ogr", ["--version"], { capture: true });
  await run("ogrinfo", ["--version"], { capture: true });
  await run(process.platform === "win32" ? "powershell" : "unzip",
    process.platform === "win32" ? ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"] : ["-v"],
    { capture: true });
}

async function download(url, destination) {
  const partial = `${destination}.part`;
  await rm(partial, { force: true });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`FUENTE_INEGI_NO_DISPONIBLE: HTTP ${response.status}; url=${url}.`);
    }
    await pipeline(response.body, createWriteStream(partial, { flags: "wx" }));
    await rename(partial, destination);
  } catch (error) {
    if (String(error?.message || error).includes("FUENTE_INEGI_NO_DISPONIBLE")) throw error;
    throw new Error(`FUENTE_INEGI_NO_DISPONIBLE: url=${url}; detalle=${redactError(error)}.`);
  } finally {
    clearTimeout(timeout);
    await rm(partial, { force: true });
  }
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

async function zipEntries(zipPath) {
  if (process.platform === "win32") {
    const script = "& { param($zip) Add-Type -AssemblyName System.IO.Compression.FileSystem; $archive=[System.IO.Compression.ZipFile]::OpenRead($zip); try { $archive.Entries | ForEach-Object { $_.FullName } } finally { $archive.Dispose() } }";
    return String(await run("powershell", ["-NoProfile", "-Command", script, zipPath], { capture: true })).split(/\r?\n/).filter(Boolean);
  }
  return String(await run("unzip", ["-Z1", zipPath], { capture: true })).split(/\r?\n/).filter(Boolean);
}

function assertChildPath(parent, child) {
  if (!resolve(child).startsWith(`${resolve(parent)}${sep}`)) throw new Error("Directorio de extraccion fuera del area de trabajo.");
}

async function extract(zipPath, destination, workDirectory) {
  assertChildPath(workDirectory, destination);
  validateZipEntries(await zipEntries(zipPath));
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  if (process.platform === "win32") {
    await run("powershell", ["-NoProfile", "-Command", "Expand-Archive", "-LiteralPath", zipPath, "-DestinationPath", destination, "-Force"]);
  } else {
    await run("unzip", ["-o", zipPath, "-d", destination]);
  }
}

async function findFile(directory, expectedName) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFile(entryPath, expectedName);
      if (nested) return nested;
    } else if (entry.name.toLowerCase() === expectedName.toLowerCase()) return entryPath;
  }
  return null;
}

async function inspectLayer(shapefile, expectedFields, layerName) {
  const output = await run("ogrinfo", ["-so", "-al", "-json", shapefile], { capture: true });
  let document;
  try { document = JSON.parse(output); } catch { throw new Error(`ogrinfo no devolvio JSON valido para ${layerName}.`); }
  const layer = document.layers?.[0];
  validateLayerMetadata({
    fields: (layer?.fields || []).map((field) => field.name),
    geometryType: layer?.geometryFields?.[0]?.type || layer?.geometryType || "",
    spatialReference: layer?.geometryFields?.[0]?.coordinateSystem?.wkt || layer?.coordinateSystem?.wkt || "",
  }, expectedFields, layerName);
}

async function inspectCensusCsv(censusCsv) {
  const parser = createReadStream(censusCsv).pipe(parse({
    columns: (header) => { validateCensusColumns(header); return header; },
    bom: true,
    skip_empty_lines: true,
    relax_column_count: false,
    to_line: 2,
  }));
  let foundRow = false;
  for await (const _row of parser) foundRow = true;
  if (!foundRow) throw new Error("SCHEMA_DRIFT: el CSV censal no contiene filas de datos.");
}

function approvedExpectedHash(options, optionName, approvedHash, label) {
  const supplied = options.get(optionName);
  if (supplied && String(supplied).trim().toLowerCase() !== approvedHash) {
    throw new Error(`HASH_DRIFT: el hash esperado suministrado para ${label} no coincide con el baseline aprobado en el codigo.`);
  }
  return approvedHash;
}

async function assertFreeSpace(workDirectory) {
  const storage = await statfs(workDirectory);
  const availableBytes = Number(storage.bavail) * Number(storage.bsize);
  if (!Number.isFinite(availableBytes) || availableBytes < MIN_FREE_BYTES) {
    throw new Error(`NOT_CONFIGURED: espacio libre insuficiente; se requieren al menos ${MIN_FREE_BYTES} bytes.`);
  }
  return availableBytes;
}

async function inspectAdministrativeDatabase(client, datasetId, geographyHash, censusHash) {
  const environment = await client.query(`SELECT current_user AS database_user, current_database() AS database_name,
    (SELECT extversion FROM pg_extension WHERE extname = 'postgis') AS postgis_version,
    to_regclass('public.inegi_territorial_dataset') IS NOT NULL AS has_dataset_table,
    to_regclass('public.inegi_territorial_geography') IS NOT NULL AS has_geography_table,
    to_regclass('public.inegi_territorial_demographics') IS NOT NULL AS has_demographics_table`);
  const configuration = environment.rows[0];
  if (configuration.database_user === "ceipol_app") {
    throw new Error("PERMISSION_MODEL_INVALID: ceipol_app es de solo lectura y no puede ejecutar la ingesta.");
  }
  const tableFlags = ["has_dataset_table", "has_geography_table", "has_demographics_table"];
  const missingTables = tableFlags.filter((field) => configuration[field] !== true);
  if (!configuration.postgis_version || missingTables.length) {
    throw new Error(`NOT_CONFIGURED: PostGIS o tablas INEGI ausentes: ${missingTables.join(", ") || "postgis"}.`);
  }
  const privilegeResult = await client.query(`SELECT
    has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_staging,
    has_table_privilege(current_user, 'public.inegi_territorial_dataset', 'INSERT,UPDATE') AS can_manage_dataset,
    has_table_privilege(current_user, 'public.inegi_territorial_geography', 'INSERT') AS can_insert_geography,
    has_table_privilege(current_user, 'public.inegi_territorial_demographics', 'INSERT') AS can_insert_demographics`);
  const privileges = privilegeResult.rows[0];
  const requiredFlags = ["can_create_staging", "can_manage_dataset", "can_insert_geography", "can_insert_demographics"];
  const missing = requiredFlags.filter((field) => privileges[field] !== true);
  if (missing.length) throw new Error(`PERMISSION_MODEL_INVALID: faltan tablas o privilegios administrativos: ${missing.join(", ")}.`);

  const existing = await client.query(`SELECT dataset_id, status, geography_feature_count, demographic_record_count
    FROM public.inegi_territorial_dataset
    WHERE dataset_id = $1 OR (state_code = '01' AND geography_sha256 = $2 AND census_sha256 = $3)`,
  [datasetId, geographyHash, censusHash]);
  return {
    databaseName: configuration.database_name,
    databaseUser: configuration.database_user,
    postgisAvailable: Boolean(configuration.postgis_version),
    existingDatasets: existing.rows,
  };
}

function integerOrNull(value) {
  if (value == null || value === "" || value === "*" || value === "N/A" || value === "N/D") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function importShape(gdal, shapefile, table) {
  const inheritedEnvironment = { ...process.env };
  delete inheritedEnvironment.DATABASE_URL;
  delete inheritedEnvironment.PGPASSWORD;
  await run("ogr2ogr", [
    "-f", "PostgreSQL", gdal.argument, shapefile, "-nln", table, "-overwrite",
    "-nlt", "PROMOTE_TO_MULTI", "-t_srs", "EPSG:4326",
    "-lco", "GEOMETRY_NAME=geom", "-lco", "FID=source_fid",
  ], { env: { ...inheritedEnvironment, ...gdal.environment } });
}

function geographySelect(level, stage) {
  const nullable = (column, applies) => applies ? `${column}::text` : "NULL::text";
  const name = ["ESTADO", "MUNICIPIO", "LOCALIDAD"].includes(level) ? "nomgeo::text" : "NULL::text";
  return `SELECT $1, '${level}', cve_ent::text, ${nullable("cve_mun", level !== "ESTADO")},
    ${nullable("cve_loc", ["LOCALIDAD", "AGEB", "MANZANA"].includes(level))},
    ${nullable("cve_ageb", ["AGEB", "MANZANA"].includes(level))}, ${nullable("cve_mza", level === "MANZANA")},
    ${name}, cvegeo::text, ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Force2D(geom)), 3))::geometry(MultiPolygon, 4326)
    FROM public.${stage} WHERE geom IS NOT NULL`;
}

async function flushDemographics(client, datasetId, rows) {
  if (!rows.length) return;
  const values = [];
  const tuples = rows.map((row, rowIndex) => {
    const offset = rowIndex * 13;
    values.push(datasetId, row.level, row.ent, row.mun, row.loc, row.ageb, row.mza,
      row.pobtot, row.vivtot, row.vivparHab, row.vivparDes, row.key,
      JSON.stringify({ populationTotal: "POBTOT", housingTotal: "VIVTOT", inhabitedPrivateHousing: "VIVPAR_HAB", uninhabitedPrivateHousing: "VIVPAR_DES" }));
    return `(${Array.from({ length: 13 }, (_, column) => `$${offset + column + 1}`).join(",")})`;
  });
  await client.query(`INSERT INTO public.inegi_territorial_demographics
    (dataset_id, geographic_level, cve_ent, cve_mun, cve_loc, cve_ageb, cve_mza,
     pobtot, vivtot, vivpar_hab, vivpar_deshab, source_row_key, source_fields)
    VALUES ${tuples.join(",")}`, values);
}

async function registerImport(client, datasetId, geographyHash, censusHash, retryFailed) {
  const existing = await client.query(`SELECT dataset_id, status FROM public.inegi_territorial_dataset
    WHERE dataset_id = $1 OR (state_code = '01' AND geography_sha256 = $2 AND census_sha256 = $3) FOR UPDATE`,
  [datasetId, geographyHash, censusHash]);
  if (existing.rows.length) {
    const row = existing.rows[0];
    if (row.status !== "FAILED" || !retryFailed) {
      throw new Error(`RIESGO_DE_SOBRESCRITURA: dataset ${row.dataset_id} ya existe con estado ${row.status}; no se sobrescribe.`);
    }
    await client.query(`UPDATE public.inegi_territorial_dataset SET status = 'IMPORTING', imported_at = CURRENT_TIMESTAMP, completed_at = NULL,
      geography_feature_count = 0, demographic_record_count = 0,
      import_metadata = import_metadata || $2::jsonb WHERE dataset_id = $1`,
    [row.dataset_id, JSON.stringify({ retryStartedAt: new Date().toISOString() })]);
    return row.dataset_id;
  }
  await client.query(`INSERT INTO public.inegi_territorial_dataset
    (dataset_id, provider_id, product_name, reference_year, version, state_code,
     geography_source_url, geography_sha256, census_source_url, census_sha256, status, import_metadata)
    VALUES ($1, 'INEGI', $2, 2020, 'CPV2020-cierre', '01', $3, $4, $5, $6, 'IMPORTING', $7::jsonb)`,
  [datasetId, PRODUCT_NAME, GEOGRAPHY_URL, geographyHash, CENSUS_URL, censusHash,
    JSON.stringify({ importer: "scripts/inegi/import-aguascalientes-2020.mjs", srid: 4326 })]);
  return datasetId;
}

async function main() {
  const options = argumentsMap(process.argv.slice(2));
  if (options.get("help") === true) {
    process.stdout.write(HELP);
    return;
  }
  delete process.env.PGPASSWORD;
  const databaseUrl = String(options.get("database-url") || process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) throw new Error("NOT_CONFIGURED: DATABASE_URL es obligatorio.");
  await preflight();

  const workDirectory = resolve(String(options.get("work-dir") || join(tmpdir(), "perfilador-inegi-ags-2020")));
  await mkdir(workDirectory, { recursive: true });
  const availableBytes = await assertFreeSpace(workDirectory);
  const geographyZip = resolve(String(options.get("geography-zip") || join(workDirectory, basename(GEOGRAPHY_URL))));
  const censusZip = resolve(String(options.get("census-zip") || join(workDirectory, basename(CENSUS_URL))));
  if (options.get("download") === true) {
    await download(GEOGRAPHY_URL, geographyZip);
    await download(CENSUS_URL, censusZip);
  }
  await access(geographyZip);
  await access(censusZip);

  const geographyHash = await sha256(geographyZip);
  const censusHash = await sha256(censusZip);
  const expectedGeographyHash = approvedExpectedHash(options, "expected-geography-sha256", APPROVED_GEOGRAPHY_SHA256, "geografia");
  const expectedCensusHash = approvedExpectedHash(options, "expected-census-sha256", APPROVED_CENSUS_SHA256, "censo");
  const geographySize = (await stat(geographyZip)).size;
  const censusSize = (await stat(censusZip)).size;
  assertApprovedArtifact({ actual: geographyHash, expected: expectedGeographyHash, url: GEOGRAPHY_URL, size: geographySize, label: "geografia" });
  assertApprovedArtifact({ actual: censusHash, expected: expectedCensusHash, url: CENSUS_URL, size: censusSize, label: "censo" });
  const datasetId = String(options.get("dataset-id") || buildDatasetId(geographyHash, censusHash));
  if (!/^[a-z0-9][a-z0-9._-]{5,127}$/i.test(datasetId)) throw new Error("dataset-id contiene caracteres no permitidos.");
  const stageSuffix = datasetId.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(-48);
  const levels = LEVELS.map((item) => ({ ...item, stage: `inegi_stage_${item.level.toLowerCase()}_${stageSuffix}` }));
  const geographyDirectory = join(workDirectory, `geography-${stageSuffix}`);
  const censusDirectory = join(workDirectory, `census-${stageSuffix}`);
  await extract(geographyZip, geographyDirectory, workDirectory);
  await extract(censusZip, censusDirectory, workDirectory);

  const shapeFiles = new Map();
  for (const item of levels) {
    const shapefile = await findFile(geographyDirectory, item.suffix);
    if (!shapefile) throw new Error(`SCHEMA_DRIFT: falta la capa oficial ${item.suffix}.`);
    await inspectLayer(shapefile, item.fields, item.level);
    shapeFiles.set(item.level, shapefile);
  }
  const censusCsv = await findFile(censusDirectory, "conjunto_de_datos_ageb_urbana_01_cpv2020.csv");
  if (!censusCsv) throw new Error("SCHEMA_DRIFT: falta el CSV censal oficial de Aguascalientes.");
  await inspectCensusCsv(censusCsv);

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const client = await pool.connect();
  let registeredDatasetId;
  let transactionOpen = false;
  let stagingImported = false;
  try {
    const database = await inspectAdministrativeDatabase(client, datasetId, geographyHash, censusHash);
    const gdal = buildGdalConnection(databaseUrl);
    if (options.get("preflight-only") === true) {
      const retryableFailure = database.existingDatasets.length === 1 &&
        database.existingDatasets[0].status === "FAILED" && options.get("retry-failed") === true;
      if (database.existingDatasets.length > 0 && !retryableFailure) {
        throw new Error(`RIESGO_DE_SOBRESCRITURA: ya existe un dataset para los hashes aprobados (${database.existingDatasets[0].status}).`);
      }
      process.stdout.write(`${JSON.stringify({
        status: "PREFLIGHT_OK",
        writeOperations: 0,
        datasetId,
        workDirectory,
        availableBytes,
        geography: { url: GEOGRAPHY_URL, sha256: geographyHash, bytes: geographySize },
        census: { url: CENSUS_URL, sha256: censusHash, bytes: censusSize },
        layers: levels.map((item) => item.level),
        database,
        gdalConnection: gdal.argument,
      }, null, 2)}\n`);
      return;
    }

    await client.query("BEGIN");
    transactionOpen = true;
    registeredDatasetId = await registerImport(client, datasetId, geographyHash, censusHash, options.get("retry-failed") === true);
    await client.query("COMMIT");
    transactionOpen = false;

    stagingImported = true;
    for (const item of levels) await importShape(gdal, shapeFiles.get(item.level), item.stage);

    await client.query("BEGIN");
    transactionOpen = true;
    for (const item of levels) {
      await client.query(`INSERT INTO public.inegi_territorial_geography
        (dataset_id, geographic_level, cve_ent, cve_mun, cve_loc, cve_ageb, cve_mza, geographic_name, source_cvegeo, geom)
        ${geographySelect(item.level, item.stage)}`, [registeredDatasetId]);
    }

    const parser = createReadStream(censusCsv).pipe(parse({
      columns: (header) => { validateCensusColumns(header); return header; },
      bom: true, skip_empty_lines: true, relax_column_count: false,
    }));
    let batch = [];
    for await (const row of parser) {
      if (row.ENTIDAD !== "01" || row.AGEB === "0000") continue;
      const level = row.MZA === "000" ? "AGEB" : "MANZANA";
      batch.push({
        level, ent: row.ENTIDAD, mun: row.MUN, loc: row.LOC, ageb: row.AGEB,
        mza: level === "MANZANA" ? row.MZA : null,
        pobtot: integerOrNull(row.POBTOT), vivtot: integerOrNull(row.VIVTOT),
        vivparHab: integerOrNull(row.VIVPAR_HAB), vivparDes: integerOrNull(row.VIVPAR_DES),
        key: canonicalRowKey(row, level),
      });
      if (batch.length >= 300) { await flushDemographics(client, registeredDatasetId, batch); batch = []; }
    }
    await flushDemographics(client, registeredDatasetId, batch);

    const counts = await client.query(`SELECT
      (SELECT count(*)::int FROM public.inegi_territorial_geography WHERE dataset_id = $1) AS geography_count,
      (SELECT count(*)::int FROM public.inegi_territorial_demographics WHERE dataset_id = $1) AS demographic_count,
      (SELECT count(*)::int FROM public.inegi_territorial_geography WHERE dataset_id = $1 AND geographic_level = 'AGEB') AS ageb_count,
      (SELECT count(*)::int FROM public.inegi_territorial_geography WHERE dataset_id = $1 AND geographic_level = 'MANZANA') AS block_count,
      (SELECT count(*)::int FROM public.inegi_territorial_demographics WHERE dataset_id = $1 AND geographic_level = 'AGEB') AS ageb_demographic_count,
      (SELECT count(*)::int FROM public.inegi_territorial_demographics WHERE dataset_id = $1 AND geographic_level = 'MANZANA') AS block_demographic_count,
      (SELECT count(*)::int FROM public.inegi_territorial_geography WHERE dataset_id = $1 AND (ST_IsEmpty(geom) OR NOT ST_IsValid(geom) OR ST_SRID(geom) <> 4326)) AS invalid_geometry_count,
      (SELECT count(*)::int FROM public.inegi_territorial_geography WHERE dataset_id = $1 AND cve_ent <> '01') +
      (SELECT count(*)::int FROM public.inegi_territorial_demographics WHERE dataset_id = $1 AND cve_ent <> '01') AS invalid_code_count`,
    [registeredDatasetId]);
    const report = counts.rows[0];
    assertCoverage(report);
    await client.query(`UPDATE public.inegi_territorial_dataset SET status = 'READY', completed_at = CURRENT_TIMESTAMP,
      geography_feature_count = $2, demographic_record_count = $3,
      import_metadata = import_metadata || $4::jsonb WHERE dataset_id = $1`,
    [registeredDatasetId, report.geography_count, report.demographic_count, JSON.stringify({ validation: report })]);
    await client.query("COMMIT");
    transactionOpen = false;
    process.stdout.write(`${JSON.stringify({ status: "READY", datasetId: registeredDatasetId, geographySha256: geographyHash, censusSha256: censusHash, ...report }, null, 2)}\n`);
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    if (registeredDatasetId) {
      await client.query(`UPDATE public.inegi_territorial_dataset SET status = 'FAILED', completed_at = CURRENT_TIMESTAMP,
        import_metadata = import_metadata || $2::jsonb WHERE dataset_id = $1 AND status = 'IMPORTING'`,
      [registeredDatasetId, JSON.stringify({ failedAt: new Date().toISOString(), error: redactError(error) })]);
    }
    throw error;
  } finally {
    if (stagingImported) {
      for (const item of levels) await client.query(`DROP TABLE IF EXISTS public.${item.stage}`).catch(() => undefined);
    }
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Importacion INEGI cancelada: ${redactError(error)}\n`);
  process.exitCode = 1;
});
