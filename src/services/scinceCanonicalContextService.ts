import "server-only";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { resolveInegiTerritory } from "@/lib/inegiTerritorialResolver";
import { deserializeCanonicalGeographyFromFirestore, type CanonicalProjectGeography,
  type FirestoreSafeCanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { fingerprintScinceCanonicalPoint } from "@/utils/scinceGeographyBinding";
import type { ScinceCanonicalCode, ScinceCanonicalContextResult } from "@/types/scinceCanonicalContext";

type Dependencies = {
  authorize: typeof authorizeInstitutionalProjectAccess;
  resolve: typeof resolveInegiTerritory;
};
const reject = (code: ScinceCanonicalCode): ScinceCanonicalContextResult => ({ success: false, code });
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

// sessionToken is internal: the server action retrieves it from the signed-session cookie.
export async function resolveScinceCanonicalContext(input: { projectId: unknown }, sessionToken: unknown,
  overrides: Partial<Dependencies> = {}): Promise<ScinceCanonicalContextResult> {
  const deps = { authorize: authorizeInstitutionalProjectAccess, resolve: resolveInegiTerritory, ...overrides };
  let access;
  try { access = await deps.authorize({ projectId: input.projectId, sessionToken, action: "ANALYZE_SCINCE" }); }
  catch { return reject("SCINCE_CANONICAL_ACCESS_DENIED"); }
  if (!access.allowed) return { success: false, code: "SCINCE_CANONICAL_ACCESS_DENIED", accessCode: access.code };
  const raw = access.project.canonicalGeography;
  if (raw == null) return reject("SCINCE_CANONICAL_GEOGRAPHY_MISSING");
  if (!record(raw) || raw.validationStatus !== "VALID" || typeof raw.geographyId !== "string" || !raw.geographyId.trim()) {
    return reject("SCINCE_CANONICAL_GEOGRAPHY_INVALID");
  }
  if (raw.type !== "INDIVIDUAL" || !record(raw.geometry) || raw.geometry.type !== "Point") {
    return reject("SCINCE_CANONICAL_GEOMETRY_UNSUPPORTED");
  }
  // Guard the persisted numeric input before the existing deserializer can coerce it.
  const geometry = raw.geometry;
  const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates :
    record(geometry.point) ? [geometry.point.lng, geometry.point.lat] : [];
  if (coordinates.length !== 2 || !coordinates.every(value => typeof value === "number" && Number.isFinite(value)) ||
      Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return reject("SCINCE_CANONICAL_POINT_INVALID");
  let canonical;
  try { canonical = deserializeCanonicalGeographyFromFirestore(raw as unknown as CanonicalProjectGeography | FirestoreSafeCanonicalProjectGeography); }
  catch { return reject("SCINCE_CANONICAL_GEOGRAPHY_INVALID"); }
  if (!canonical || canonical.validationStatus !== "VALID") return reject("SCINCE_CANONICAL_GEOGRAPHY_INVALID");
  if (canonical.type !== "INDIVIDUAL" || canonical.geometry.type !== "Point") return reject("SCINCE_CANONICAL_GEOMETRY_UNSUPPORTED");
  const [lng, lat] = canonical.geometry.coordinates;
  try {
    const geographyFingerprint = fingerprintScinceCanonicalPoint(canonical);
    const result = await deps.resolve(lat, lng);
    if (!result.exito || result.status !== "OBSERVED") return reject("SCINCE_CANONICAL_DATA_UNAVAILABLE");
    return { success: true, projectId: access.projectId, geographyId: canonical.geographyId, geographyType: "INDIVIDUAL",
      geographyFingerprint, spatialMode: "CANONICAL_POINT", queryCoordinate: { lat, lng },
      datasetId: result.provenance?.datasetId ?? null, datasetYear: result.provenance?.referenceYear ?? null,
      datasetVersion: result.provenance?.version ?? null, geographicLevel: result.geographicLevel ?? null,
      demographicGeographicLevel: result.demographics?.geographicLevel ?? result.provenance?.demographicGeographicLevel ?? null,
      sourceRowKey: result.provenance?.sourceRowKey ?? null, demographics: result.demographics ?? null,
      provenance: result.provenance ?? null,
      limitations: ["Contexto sociodemográfico observado; no constituye un hallazgo ni inferencia criminológica.",
        "Cobertura limitada al dataset oficial importado; sin agregación territorial.",
        ...(result.demographics ? [] : ["Demografía no disponible para el territorio localizado."]),
        ...(result.geographicLevel && result.demographics && result.geographicLevel !== result.demographics.geographicLevel
          ? ["El nivel demográfico difiere del nivel geográfico localizado; las cifras corresponden al nivel demográfico declarado."] : [])],
    };
  } catch { return reject("SCINCE_CANONICAL_DATA_UNAVAILABLE"); }
}
