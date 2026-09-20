const { basename, isAbsolute, posix, win32 } = require("node:path");

const REQUIRED_CENSUS_COLUMNS = Object.freeze([
  "ENTIDAD", "MUN", "LOC", "AGEB", "MZA",
  "POBTOT", "VIVTOT", "VIVPAR_HAB", "VIVPAR_DES",
]);

function canonicalRowKey(row, level) {
  const parts = [row.ENTIDAD, row.MUN, row.LOC, row.AGEB];
  if (level === "MANZANA") parts.push(row.MZA);
  if (parts.some((part) => !part)) throw new Error("La fila censal no contiene una clave territorial completa.");
  return parts.join(":");
}

function validateCensusColumns(columns) {
  const present = new Set(columns.map((column) => String(column).trim().toUpperCase()));
  const missing = REQUIRED_CENSUS_COLUMNS.filter((column) => !present.has(column));
  if (missing.length) throw new Error(`SCHEMA_DRIFT: CSV censal incompatible; faltan columnas: ${missing.join(", ")}.`);
  return true;
}

function validateZipEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("ZIP invalido o vacio.");
  for (const rawEntry of entries) {
    const entry = String(rawEntry).replaceAll("\\", "/");
    const segments = entry.split("/");
    if (!entry || entry.includes("\0") || isAbsolute(entry) || win32.isAbsolute(entry) || segments.includes("..")) {
      throw new Error(`ZIP inseguro: ruta no permitida (${basename(entry) || "entrada vacia"}).`);
    }
    const normalized = posix.normalize(entry);
    if (normalized === ".." || normalized.startsWith("../")) {
      throw new Error(`ZIP inseguro: ruta fuera del directorio (${basename(entry)}).`);
    }
  }
  return true;
}

function validateLayerMetadata(metadata, expectedFields, layerName) {
  const fields = new Set((metadata.fields || []).map((field) => String(field).toLowerCase()));
  const missing = expectedFields.filter((field) => !fields.has(field.toLowerCase()));
  if (missing.length) throw new Error(`SCHEMA_DRIFT: capa ${layerName} incompatible; faltan campos: ${missing.join(", ")}.`);
  const geometryType = String(metadata.geometryType || "");
  if (!/polygon/i.test(geometryType)) throw new Error(`SCHEMA_DRIFT: capa ${layerName} no contiene geometria poligonal.`);
  if (!String(metadata.spatialReference || "").trim()) {
    const error = new Error(`SCHEMA_DRIFT: capa ${layerName} sin sistema de referencia declarado.`);
    error.code = "SCHEMA_DRIFT";
    throw error;
  }
  return true;
}

function assertCoverage(report) {
  const required = [
    "geography_count", "demographic_count", "ageb_count", "block_count",
    "ageb_demographic_count", "block_demographic_count",
  ];
  const missing = required.filter((field) => !Number.isInteger(Number(report[field])) || Number(report[field]) <= 0);
  const invalid = ["invalid_geometry_count", "invalid_code_count"].filter((field) => Number(report[field] || 0) !== 0);
  if (missing.length || invalid.length) {
    throw new Error(`DATASET_READY_INCOMPLETO: faltantes: ${missing.join(", ") || "ninguno"}; invalidos: ${invalid.join(", ") || "ninguno"}.`);
  }
  return "READY";
}

function assertExpectedSha(actual, expected, label) {
  if (!/^[0-9a-f]{64}$/.test(actual)) throw new Error(`SHA-256 calculado invalido para ${label}.`);
  if (expected != null) {
    const normalized = String(expected).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error(`SHA-256 esperado invalido para ${label}.`);
    if (normalized !== actual) throw new Error(`SHA-256 de ${label} no coincide.`);
  }
  return true;
}

function assertApprovedArtifact({ actual, expected, url, size, label }) {
  try {
    assertExpectedSha(actual, expected, label);
  } catch (error) {
    const drift = new Error(
      `HASH_DRIFT: ${label}; esperado=${expected}; recibido=${actual}; url=${url}; bytes=${size}. ` +
      "Posible actualizacion oficial; requiere revision antes de importar."
    );
    drift.code = "HASH_DRIFT";
    throw drift;
  }
  return true;
}

function buildDatasetId(geographyHash, censusHash) {
  assertExpectedSha(geographyHash, null, "geografia");
  assertExpectedSha(censusHash, null, "censo");
  return `inegi-cpv2020-01-${geographyHash.slice(0, 12)}-${censusHash.slice(0, 12)}`;
}

function buildGdalConnection(databaseUrl) {
  let parsed;
  try { parsed = new URL(databaseUrl); } catch { throw new Error("DATABASE_URL no tiene un formato PostgreSQL valido."); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.pathname.slice(1)) {
    throw new Error("DATABASE_URL no tiene un formato PostgreSQL valido.");
  }
  const quote = (value) => String(value).replaceAll("'", "''");
  const options = [
    `host='${quote(parsed.hostname)}'`, `port='${quote(parsed.port || "5432")}'`,
    `dbname='${quote(decodeURIComponent(parsed.pathname.slice(1)))}'`,
    `user='${quote(decodeURIComponent(parsed.username))}'`,
  ];
  const sslmode = parsed.searchParams.get("sslmode");
  if (sslmode) options.push(`sslmode='${quote(sslmode)}'`);
  const password = decodeURIComponent(parsed.password);
  return {
    argument: `PG:${options.join(" ")}`,
    environment: password ? { PGPASSWORD: password } : {},
  };
}

function redactError(error) {
  return String(error && error.message ? error.message : error)
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[DATABASE_URL_REDACTED]")
    .replace(/PGPASSWORD\s*[=:]\s*[^\s]+/gi, "PGPASSWORD=[REDACTED]")
    .replace(/password\s*=\s*'[^']*'/gi, "password='[REDACTED]'")
    .slice(0, 2000);
}

function toolNotConfiguredMessage(tool) {
  return `NOT_CONFIGURED: ${tool} no esta disponible en PATH.`;
}

module.exports = {
  REQUIRED_CENSUS_COLUMNS, assertApprovedArtifact, assertCoverage, assertExpectedSha, buildDatasetId,
  buildGdalConnection, canonicalRowKey, redactError, toolNotConfiguredMessage,
  validateCensusColumns, validateLayerMetadata, validateZipEntries,
};
