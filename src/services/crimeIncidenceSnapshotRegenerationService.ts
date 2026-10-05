"use client";

import { doc, getDocFromServer, runTransaction } from "firebase/firestore";
import { getAuthInstance, getDb } from "@/lib/firebase";
import { canWriteInstitutionalProject } from "@/lib/institutionalCollectionActions";
import { deserializeCanonicalGeographyFromFirestore } from "@/utils/canonicalProjectGeography";
import { composeCrimeIncidenceProductionWorkspace } from "@/utils/crimeIncidenceProductionComposition";
import { prepareCrimeIncidenceContractForProject } from "@/utils/institutionalStructuredPersistence";

const failureCodes = ["SESSION_REQUIRED", "READ_DENIED", "WRITE_DENIED", "PROJECT_UNAVAILABLE",
  "GEOGRAPHY_INVALID", "GEOGRAPHY_CHANGED", "QUERY_FAILED", "DATASET_REJECTED", "LINEAGE_INVALID",
  "CONTRACT_INVALID", "WRITE_FAILED", "VERIFY_FAILED"] as const;
type Failure = typeof failureCodes[number];
export type CrimeIncidenceRegenerationResult =
  | { ok: true; code: "CRIME_INCIDENCE_SNAPSHOT_REGENERATION_OK" }
  | { ok: false; code: `CRIME_INCIDENCE_REGEN_${Failure}` };
class RegenerationFailure extends Error { constructor(readonly reason: Failure) { super(reason); } }
function fail(reason: Failure): never { throw new RegenerationFailure(reason); }
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
function completeLineage(value: any): boolean {
  const text = (v: unknown) => typeof v === "string" && !!v.trim();
  const object = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
  const date = (v: unknown) => v === null || text(v);
  const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  return object(value) && text(value.dataset) && ["POSTGIS", "CSV_LEGACY_FALLBACK", "NONE"].includes(value.querySource)
    && object(value.filters) && object(value.timeRange) && date(value.timeRange.start) && date(value.timeRange.end)
    && ["KNOWN", "TEMPORAL_COVERAGE_UNKNOWN"].includes(value.timeRange.status)
    && object(value.geographicFilter) && object(value.geographicFilter.center)
    && finite(value.geographicFilter.center.lat) && finite(value.geographicFilter.center.lng)
    && finite(value.geographicFilter.radiusMeters)
    && ["IN_COVERAGE", "OUT_OF_COVERAGE", "UNKNOWN_COVERAGE"].includes(value.geographicFilter.coverageStatus)
    && object(value.recordSubset) && ["totalScanned", "matched", "excluded", "duplicates", "returnedRecords"]
      .every(key => Number.isInteger(value.recordSubset[key]) && value.recordSubset[key] >= 0);
}
function accessible(data: any): boolean {
  return !!data && (data.deleted === undefined || data.deleted === false)
    && data.estado !== "ARCHIVADO" && data.status !== "ARCHIVADO";
}

/** New generation only. No bridge refresh, incident writes, sweeps or audit writes. */
export async function regenerateIsolatedCrimeIncidenceSnapshot(projectId: string): Promise<CrimeIncidenceRegenerationResult> {
  let stage: Failure = "SESSION_REQUIRED";
  try {
    const auth = getAuthInstance();
    const actor = auth.currentUser;
    if (!actor) fail("SESSION_REQUIRED");
    const sessionPresent = () => { if (auth.currentUser !== actor) fail("SESSION_REQUIRED"); };
    stage = "WRITE_DENIED";
    if (!await canWriteInstitutionalProject(projectId)) fail("WRITE_DENIED");
    const ref = doc(getDb(), "projects", projectId);
    stage = "READ_DENIED";
    const initial = await getDocFromServer(ref);
    if (!initial.exists() || !accessible(initial.data())) fail("PROJECT_UNAVAILABLE");
    stage = "GEOGRAPHY_INVALID";
    const initialData = initial.data();
    const geography = deserializeCanonicalGeographyFromFirestore(initialData.canonicalGeography);
    if (!geography || geography.validationStatus !== "VALID") fail("GEOGRAPHY_INVALID");
    const geographyKey = canonical(initialData.canonicalGeography);
    stage = "QUERY_FAILED";
    sessionPresent();
    const binding = await composeCrimeIncidenceProductionWorkspace({
      expedienteId: projectId, canonicalGeography: geography,
      radiusMeters: geography.type === "POLYGON" ? null : 1000,
      requestedBy: actor.uid,
    });
    if (!binding.viewModel) {
      if (binding.error?.startsWith("CRIME_INCIDENCE_DATASET_")) fail("DATASET_REJECTED");
      fail("QUERY_FAILED");
    }
    stage = "LINEAGE_INVALID";
    const contract = binding.viewModel.exportReference;
    if (!completeLineage(contract.lineage)) fail("LINEAGE_INVALID");
    stage = "CONTRACT_INVALID";
    const prepared = prepareCrimeIncidenceContractForProject(contract);
    if (!prepared) fail("CONTRACT_INVALID");
    if (!completeLineage(prepared.lineage)) fail("LINEAGE_INVALID");
    const expected = canonical(prepared);
    sessionPresent();
    stage = "WRITE_DENIED";
    if (!await canWriteInstitutionalProject(projectId)) fail("WRITE_DENIED");
    stage = "WRITE_FAILED";
    await runTransaction(getDb(), async transaction => {
      sessionPresent();
      if (!await canWriteInstitutionalProject(projectId)) fail("WRITE_DENIED");
      const current = await transaction.get(ref);
      if (!current.exists() || !accessible(current.data())) fail("PROJECT_UNAVAILABLE");
      if (canonical(current.data().canonicalGeography) !== geographyKey) fail("GEOGRAPHY_CHANGED");
      transaction.update(ref, { crimeIncidenceExportContract: prepared });
    });
    stage = "VERIFY_FAILED";
    sessionPresent();
    const verified = await getDocFromServer(ref);
    const persisted = verified.exists() ? verified.data().crimeIncidenceExportContract : null;
    if (!persisted || !completeLineage(persisted.lineage) || canonical(persisted) !== expected) fail("VERIFY_FAILED");
    return { ok: true, code: "CRIME_INCIDENCE_SNAPSHOT_REGENERATION_OK" };
  } catch (error) {
    return { ok: false, code: `CRIME_INCIDENCE_REGEN_${error instanceof RegenerationFailure ? error.reason : stage}` };
  }
}
