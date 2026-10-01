import "server-only";
import { SCINCE_CANONICAL_SNAPSHOT_VERSION, type ScinceCanonicalSnapshot,
  type ScinceCanonicalSuccess, type ScinceSnapshotFreshnessInput,
  type ScinceSnapshotFreshnessResult } from "@/types/scinceCanonicalSnapshot";
import { isValidLatLng, type CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { CANONICAL_GEOGRAPHY_FINGERPRINT_VERSION, fingerprintScinceCanonicalPoint } from "@/utils/scinceGeographyBinding";

type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const nullableText = (v: unknown) => v === null || text(v);
const levels = ["ESTADO", "MUNICIPIO", "LOCALIDAD", "AGEB", "MANZANA"];
const level = (v: unknown) => v === null || (typeof v === "string" && levels.includes(v));
const demographicLevel = (v: unknown) => v === null || v === "AGEB" || v === "MANZANA";
const count = (v: unknown) => v === null || (typeof v === "number" && Number.isSafeInteger(v) && v >= 0);
const year = (v: unknown) => v === null || (typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 9999);

function pointBinding(geographyId: string, coordinate: { lat: number; lng: number }): CanonicalProjectGeography {
  return { geographyId, type: "INDIVIDUAL", geometry: { type: "Point", coordinates: [coordinate.lng, coordinate.lat] },
    source: "MAP_VECTOR", validationStatus: "VALID", createdAt: 0, updatedAt: 0 };
}

/** Validate untrusted persisted values, including internal coordinate and lineage consistency. */
export function isValidScinceCanonicalSnapshot(value: unknown): value is ScinceCanonicalSnapshot {
  if (!record(value) || value.schemaVersion !== SCINCE_CANONICAL_SNAPSHOT_VERSION || !text(value.projectId) ||
      value.observedAt !== null || !Array.isArray(value.limitations) || !value.limitations.every(v => typeof v === "string")) return false;
  const b = value.geographyBinding, d = value.dataset, r = value.territorialResolution;
  if (!record(b) || !text(b.geographyId) || b.geographyType !== "INDIVIDUAL" || b.spatialMode !== "CANONICAL_POINT" ||
      b.fingerprintVersion !== CANONICAL_GEOGRAPHY_FINGERPRINT_VERSION || !text(b.geographyFingerprint) ||
      !isValidLatLng(b.queryCoordinate) || !record(d) || !nullableText(d.datasetId) || !year(d.year) ||
      !nullableText(d.version) || !record(r) || !level(r.geographicLevel) ||
      !demographicLevel(r.demographicGeographicLevel) || !nullableText(r.sourceRowKey)) return false;
  if (b.geographyFingerprint !== fingerprintScinceCanonicalPoint(pointBinding(b.geographyId, b.queryCoordinate))) return false;
  const demographics = value.demographics;
  if (demographics !== null) {
    if (!record(demographics) || !["AGEB", "MANZANA"].includes(String(demographics.geographicLevel)) ||
        demographics.geographicLevel !== r.demographicGeographicLevel || demographics.marginacion !== null ||
        typeof demographics.marginacionNote !== "string" ||
        !["populationTotal", "housingTotal", "inhabitedPrivateHousing", "uninhabitedPrivateHousing"].every(k => count(demographics[k]))) return false;
  } else if (r.demographicGeographicLevel !== null) return false;
  const p = value.provenance;
  if (p !== null) {
    if (!record(p) || !["datasetId", "productName", "version", "importedAt", "completedAt", "geographySourceUrl",
      "geographySha256", "censusSourceUrl", "censusSha256"].every(k => text(p[k])) ||
      !year(p.referenceYear) || p.referenceYear === null || !isValidLatLng(p.queryCoordinates) ||
      p.queryCoordinates.lat !== b.queryCoordinate.lat || p.queryCoordinates.lng !== b.queryCoordinate.lng ||
      p.datasetId !== d.datasetId || p.referenceYear !== d.year || p.version !== d.version ||
      p.geographicLevel !== r.geographicLevel || !levels.includes(String(p.geographicLevel)) ||
      (p.demographicGeographicLevel ?? null) !== r.demographicGeographicLevel ||
      (p.sourceRowKey ?? null) !== r.sourceRowKey) return false;
  }
  return true;
}

/** No clock, resolver, repository or writer: nulls from the canonical result remain nulls. */
export function buildScinceCanonicalSnapshot(result: ScinceCanonicalSuccess): ScinceCanonicalSnapshot {
  if (!result || result.success !== true) throw new Error("SCINCE_CANONICAL_SUCCESS_REQUIRED");
  const snapshot: ScinceCanonicalSnapshot = {
    schemaVersion: SCINCE_CANONICAL_SNAPSHOT_VERSION, projectId: result.projectId,
    geographyBinding: { geographyId: result.geographyId, geographyType: result.geographyType,
      geographyFingerprint: result.geographyFingerprint, fingerprintVersion: CANONICAL_GEOGRAPHY_FINGERPRINT_VERSION,
      spatialMode: result.spatialMode, queryCoordinate: result.queryCoordinate },
    dataset: { datasetId: result.datasetId, year: result.datasetYear, version: result.datasetVersion },
    territorialResolution: { geographicLevel: result.geographicLevel,
      demographicGeographicLevel: result.demographicGeographicLevel, sourceRowKey: result.sourceRowKey },
    demographics: result.demographics, provenance: result.provenance, limitations: result.limitations, observedAt: null,
  };
  if (!isValidScinceCanonicalSnapshot(snapshot)) throw new Error("SCINCE_CANONICAL_SNAPSHOT_INVALID");
  // Detach nested observations from the caller without adding or repairing fields.
  return structuredClone(snapshot);
}

export function evaluateScinceSnapshotFreshness(input: ScinceSnapshotFreshnessInput): ScinceSnapshotFreshnessResult {
  const { snapshot, currentCanonicalGeography: current, expectedProjectId } = input;
  if (snapshot === null || snapshot === undefined) return { territorialFreshness: "MISSING", datasetIdentity: null, reason: "SNAPSHOT_MISSING" };
  if (!isValidScinceCanonicalSnapshot(snapshot)) return { territorialFreshness: "INVALID", datasetIdentity: null, reason: "SNAPSHOT_CONTRACT_INVALID" };
  const result = (territorialFreshness: "CURRENT" | "STALE" | "INVALID", reason: string): ScinceSnapshotFreshnessResult =>
    ({ territorialFreshness, datasetIdentity: { ...snapshot.dataset }, reason });
  if (!text(expectedProjectId) || snapshot.projectId !== expectedProjectId) return result("INVALID", "PROJECT_BINDING_MISMATCH");
  if (!current || current.validationStatus !== "VALID") return result("STALE", "CANONICAL_GEOGRAPHY_NOT_VALID");
  if (current.type !== "INDIVIDUAL" || current.geometry?.type !== "Point") return result("STALE", "CANONICAL_MODALITY_CHANGED");
  try {
    const fingerprint = fingerprintScinceCanonicalPoint(current);
    if (current.geographyId !== snapshot.geographyBinding.geographyId || fingerprint !== snapshot.geographyBinding.geographyFingerprint)
      return result("STALE", "TERRITORIAL_BINDING_CHANGED");
    return result("CURRENT", "TERRITORIAL_BINDING_MATCHES");
  } catch {
    return result("STALE", "CANONICAL_POINT_INVALID");
  }
}

/** Re-evaluate the snapshot itself; a cached CURRENT label is insufficient. */
export function isScinceSnapshotPublishable(input: ScinceSnapshotFreshnessInput): boolean {
  return evaluateScinceSnapshotFreshness(input).territorialFreshness === "CURRENT";
}
