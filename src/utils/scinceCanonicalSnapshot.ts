import "server-only";
import {isScinceCompactSnapshotV2} from './scinceCompactSnapshot';
import type {ScinceCompactSnapshotV2} from '../types/scinceCompactSnapshot';
import type {ScinceResolvedSnapshot} from '../types/scinceCanonicalSnapshot';
import { isValidScinceMultiunit } from "./scinceMultiunitValidation";
import { fingerprintScinceCoverageGeography, SCINCE_COVERAGE_FINGERPRINT_VERSION } from "./scinceCanonicalCoverage";
import { readScinceCanonicalGeography } from "./scinceQueryGeometry";
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
  // Historical publication/PPC guards stay legacy-only until the dedicated adapter phases.
  if(record(value) && value.compactSnapshot!==undefined)return false;
  if (record(value) && value.schemaVersion === "SCINCE_CANONICAL_SNAPSHOT_V2") {
    if (!isValidScinceMultiunit(value.multiunit)) return false;
    const m=value.multiunit, b=value.geographyBinding, d=value.dataset, r=value.territorialResolution;
    return record(b) && record(d) && record(r) && value.projectId===m.projectId && value.observedAt===null &&
      value.demographics===null && value.provenance===null && r.geographicLevel===null && r.demographicGeographicLevel===null && r.sourceRowKey===null &&
      b.geographyId===m.geographyBinding.geographyId && b.geographyType===m.geographyBinding.geographyType &&
      b.geographyFingerprint===m.geographyBinding.geographyFingerprint && b.fingerprintVersion===(b.geographyType==="INDIVIDUAL"?CANONICAL_GEOGRAPHY_FINGERPRINT_VERSION:SCINCE_COVERAGE_FINGERPRINT_VERSION) &&
      b.spatialMode===(b.geographyType==="INDIVIDUAL" ? "CANONICAL_POINT" : b.geographyType==="CORRIDOR" ? "CANONICAL_LINE" : "CANONICAL_AREA") && b.queryCoordinate===null &&
      d.datasetId===m.dataset.datasetId && d.year===m.dataset.year && d.version===m.dataset.version &&
      JSON.stringify(value.limitations)===JSON.stringify(m.limitations);
  }
  if (!record(value) || value.schemaVersion !== SCINCE_CANONICAL_SNAPSHOT_VERSION || !text(value.projectId) ||
      value.observedAt !== null || value.multiunit !== undefined || !Array.isArray(value.limitations) || !value.limitations.every(v => typeof v === "string")) return false;
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
export function buildScinceCanonicalSnapshot(result: ScinceCompactSnapshotV2): ScinceCompactSnapshotV2;
export function buildScinceCanonicalSnapshot(result: ScinceCanonicalSuccess): ScinceCanonicalSnapshot;
export function buildScinceCanonicalSnapshot(result: ScinceCanonicalSuccess | ScinceCompactSnapshotV2): ScinceResolvedSnapshot {
  if(!result)throw new Error('SCINCE_CANONICAL_SUCCESS_REQUIRED');
  if('schemaVersion' in result) {
    if(!isScinceCompactSnapshotV2(result))throw new Error('SCINCE_CANONICAL_SNAPSHOT_INVALID');
    return structuredClone(result);
  }
  if (!result || result.success !== true) throw new Error("SCINCE_CANONICAL_SUCCESS_REQUIRED");
  // Do not let existing PPC callers persist a compact result as an empty legacy snapshot.
  if(result.compactSnapshot!==undefined)throw new Error('SCINCE_COMPACT_ADAPTER_NOT_ENABLED');
  const snapshot: ScinceCanonicalSnapshot = {
    schemaVersion: result.geographyType === "INDIVIDUAL" && !result.multiunit ? SCINCE_CANONICAL_SNAPSHOT_VERSION : "SCINCE_CANONICAL_SNAPSHOT_V2", projectId: result.projectId,
    ...(result.multiunit ? {multiunit: structuredClone(result.multiunit)} : {}),
    geographyBinding: { geographyId: result.geographyId, geographyType: result.geographyType,
      geographyFingerprint: result.geographyFingerprint, fingerprintVersion: result.geographyType === "INDIVIDUAL" ? CANONICAL_GEOGRAPHY_FINGERPRINT_VERSION : SCINCE_COVERAGE_FINGERPRINT_VERSION,
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

/** Resolver/storage contract guard; unlike the historical gate, this does not enable publication. */
export function isValidScinceResolvedSnapshot(value:unknown):value is ScinceResolvedSnapshot {
  if(record(value) && value.schemaVersion==='SCINCE_COMPACT_SNAPSHOT_V2')return isScinceCompactSnapshotV2(value);
  return isValidScinceCanonicalSnapshot(value);
}

export function evaluateScinceSnapshotFreshness(input: ScinceSnapshotFreshnessInput): ScinceSnapshotFreshnessResult {
  const { snapshot, currentCanonicalGeography: current, expectedProjectId } = input;
  if (snapshot === null || snapshot === undefined) return { territorialFreshness: "MISSING", datasetIdentity: null, reason: "SNAPSHOT_MISSING" };
  if(isScinceCompactSnapshotV2(snapshot)) {
    const result=(territorialFreshness:'CURRENT'|'STALE'|'INVALID',reason:string):ScinceSnapshotFreshnessResult=>({territorialFreshness,reason,
      datasetIdentity:{datasetId:snapshot.datasetIdentity.datasetId,year:snapshot.datasetIdentity.referenceYear,version:snapshot.datasetIdentity.version}});
    if(snapshot.projectBinding.projectId!==expectedProjectId)return result('INVALID','PROJECT_BINDING_MISMATCH');
    if(input.currentNormalizationRelease!==undefined) {
      const r=input.currentNormalizationRelease;
      if(!r || r.datasetId!==snapshot.datasetIdentity.datasetId || r.releaseId!==snapshot.releaseIdentity.releaseId ||
        r.observationSetFingerprint!==snapshot.releaseIdentity.observationSetFingerprint || r.catalogVersion!==snapshot.catalogIdentity.catalogVersion ||
        r.catalogFingerprint!==snapshot.catalogIdentity.catalogFingerprint || r.normalizationVersion!==snapshot.normalizationIdentity.normalizationVersion)
        return result('STALE','SCINCE_NORMALIZATION_RELEASE_CHANGED');
    }
    try {
      const g=readScinceCanonicalGeography(current);
      if(!g || g.geographyId!==snapshot.geographyBinding.geographyId || g.type!==snapshot.geographyBinding.geographyType ||
        (g.type==='INDIVIDUAL'?fingerprintScinceCanonicalPoint(g):fingerprintScinceCoverageGeography(g))!==snapshot.geographyBinding.geographyFingerprint)
        return result('STALE','TERRITORIAL_BINDING_CHANGED');
      return result('CURRENT','TERRITORIAL_BINDING_MATCHES');
    }catch{return result('STALE','CANONICAL_GEOGRAPHY_INVALID');}
  }
  if (!isValidScinceCanonicalSnapshot(snapshot)) return { territorialFreshness: "INVALID", datasetIdentity: null, reason: "SNAPSHOT_CONTRACT_INVALID" };
  const result = (territorialFreshness: "CURRENT" | "STALE" | "INVALID", reason: string): ScinceSnapshotFreshnessResult =>
    ({ territorialFreshness, datasetIdentity: { ...snapshot.dataset }, reason });
  if (!text(expectedProjectId) || snapshot.projectId !== expectedProjectId) return result("INVALID", "PROJECT_BINDING_MISMATCH");
  if(input.currentNormalizationRelease!==undefined) {
    const saved=snapshot.multiunit?.officialBaseProfile2020,currentRelease=input.currentNormalizationRelease;
    if((saved || currentRelease) && (!saved || !currentRelease ||
      ['releaseId','datasetId','catalogVersion','catalogFingerprint','normalizationVersion','observationSetFingerprint'].some(k=>(saved as any)[k]!==(currentRelease as any)[k])))
      return result('STALE','SCINCE_NORMALIZATION_RELEASE_CHANGED');
  }
  if (!current || current.validationStatus !== "VALID") return result("STALE", "CANONICAL_GEOGRAPHY_NOT_VALID");
  if (snapshot.schemaVersion === "SCINCE_CANONICAL_SNAPSHOT_V2") {
    try {
      const canonical=readScinceCanonicalGeography(current);
      if (!canonical || canonical.type!==snapshot.geographyBinding.geographyType || canonical.geographyId!==snapshot.geographyBinding.geographyId ||
        (canonical.type==="INDIVIDUAL"?fingerprintScinceCanonicalPoint(canonical):fingerprintScinceCoverageGeography(canonical))!==snapshot.geographyBinding.geographyFingerprint) return result("STALE","TERRITORIAL_BINDING_CHANGED");
      return result("CURRENT","TERRITORIAL_BINDING_MATCHES");
    } catch { return result("STALE","CANONICAL_GEOGRAPHY_INVALID"); }
  }
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
  return isValidScinceCanonicalSnapshot(input.snapshot) && evaluateScinceSnapshotFreshness(input).territorialFreshness === "CURRENT";
}
