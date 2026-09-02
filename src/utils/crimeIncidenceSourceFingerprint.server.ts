import { createHash } from "node:crypto";

import type { RawCrimeRecord } from "./crimeIncidenceCanonicalPipeline";

const EXCLUDED_SOURCE_IDENTITY_FIELDS = new Set([
  "OID",
  "OBJECTID",
  "FID",
]);

function normalizeFieldName(name: string): string {
  return name.trim().toUpperCase();
}

function normalizeFieldValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

export function buildCrimeSourceCanonicalPayload(
  row: RawCrimeRecord
): string {
  const canonicalFields = Object.entries(row)
    .map(([rawName, rawValue]) => ({
      name: normalizeFieldName(rawName),
      value: normalizeFieldValue(rawValue),
    }))
    .filter(({ name }) => !EXCLUDED_SOURCE_IDENTITY_FIELDS.has(name))
    .sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });

  return canonicalFields
    .map(({ name, value }) => {
      return `${name.length}:${name}=${value.length}:${value}`;
    })
    .join("|");
}

export function buildCrimeSourceFingerprint(
  row: RawCrimeRecord
): string {
  const canonicalPayload = buildCrimeSourceCanonicalPayload(row);

  return createHash("sha256")
    .update(canonicalPayload, "utf8")
    .digest("hex");
}