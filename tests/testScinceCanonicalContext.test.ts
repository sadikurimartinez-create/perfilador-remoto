import { resolveScinceCanonicalContext as canonicalService } from "../src/services/scinceCanonicalContextService";
import { getCanonicalScinceData } from "../src/lib/osintActions";
import { cookies } from "next/headers";
import { authorizeInstitutionalProjectAccess } from "../src/services/institutionalProjectAccessService";
import { resolveInegiTerritory } from "../src/lib/inegiTerritorialResolver";
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/services/institutionalProjectAccessService", () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
jest.mock("@/lib/inegiTerritorialResolver", () => ({ resolveInegiTerritory: jest.fn() }));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@google-cloud/vertexai", () => ({ VertexAI: jest.fn() }));
jest.mock("@/lib/geminiEnv", () => ({}));
jest.mock("@/lib/datosGobMx", () => ({ searchDatosGobMx: jest.fn() }));

const resolveScinceCanonicalContext = (input:any,token:any,overrides:any={}) => canonicalService(input,token,{resolve:resolveInegiTerritory,...overrides});

function geography(overrides: Record<string, unknown> = {}) {
  return { geographyId: "P1:INDIVIDUAL", type: "INDIVIDUAL", validationStatus: "VALID", source: "MAP_VECTOR",
    createdAt: 1, updatedAt: 1, geometry: { type: "Point", point: { lat: 21.9, lng: -102.3 } }, ...overrides };
}
function observed(): any {
  return { status: "OBSERVED", exito: true, geographicLevel: "MANZANA",
    demographics: { geographicLevel: "AGEB", populationTotal: 10, housingTotal: 5,
      inhabitedPrivateHousing: 4, uninhabitedPrivateHousing: 1, marginacion: null, marginacionNote: "No disponible" },
    provenance: { datasetId: "dataset-test", referenceYear: 2020, version: "v1", sourceRowKey: "ageb-row",
      geographicLevel: "MANZANA", demographicGeographicLevel: "AGEB", queryCoordinates: { lat: 21.9, lng: -102.3 } } };
}
function allow(canonical: unknown = geography()): any {
  return { allowed: true, projectId: "P1", action: "ANALYZE_SCINCE", project: { canonicalGeography: canonical } };
}
const authorize = jest.mocked(authorizeInstitutionalProjectAccess);
const resolve = jest.mocked(resolveInegiTerritory);
beforeEach(() => { jest.clearAllMocks(); authorize.mockResolvedValue(allow()); resolve.mockResolvedValue(observed()); });

test("ANALYZE_SCINCE uses exactly the authorized canonical Point and preserves distinct levels/provenance", async () => {
  const result = await resolveScinceCanonicalContext({ projectId: "P1" }, "signed-cookie");
  expect(authorize).toHaveBeenCalledWith({ projectId: "P1", sessionToken: "signed-cookie", action: "ANALYZE_SCINCE" });
  expect(resolve).toHaveBeenCalledWith(21.9, -102.3, undefined, expect.objectContaining({projectId:"P1",geographyId:"P1:INDIVIDUAL"}));
  expect(result).toMatchObject({ success: true, geographyId: "P1:INDIVIDUAL", geographicLevel: "MANZANA",
    demographicGeographicLevel: "AGEB", sourceRowKey: "ageb-row", datasetYear: 2020,
    datasetId: "dataset-test", datasetVersion: "v1", queryCoordinate: { lat: 21.9, lng: -102.3 },
    provenance: observed().provenance, demographics: observed().demographics });
  if (result.success) expect(result.limitations.join(" ")).toContain("nivel demográfico difiere");
  expect(JSON.stringify(result)).not.toContain("signed-cookie");
});
test("denied access preserves only the sanitized institutional code and never resolves", async () => {
  authorize.mockResolvedValue({ allowed: false, code: "PROJECT_ACCESS_REVOKED", audit: {} } as any);
  expect(await resolveScinceCanonicalContext({ projectId: "P1" }, "token")).toEqual({ success: false,
    code: "SCINCE_CANONICAL_ACCESS_DENIED", accessCode: "PROJECT_ACCESS_REVOKED" });
  expect(resolve).not.toHaveBeenCalled();
});
test.each([
  [undefined, "GEOGRAPHY_MISSING"], [null, "GEOGRAPHY_MISSING"],
  [geography({ validationStatus: "INVALID" }), "GEOGRAPHY_INVALID"],
  [geography({ validationStatus: "PARTIAL" }), "GEOGRAPHY_INVALID"],
  [geography({ geographyId: "" }), "GEOGRAPHY_INVALID"],
  [geography({ limitations: ["INCOMPLETE_CANONICAL_GEOMETRY"] }), "GEOGRAPHY_INVALID"],
  [geography({ type: "LINEAL" }), "GEOMETRY_UNSUPPORTED"],
  [geography({ type: "CORRIDOR", geometry: { type: "LineString", points: [] } }), "GEOGRAPHY_INVALID"],
  [geography({ type: "POLYGON", geometry: { type: "Polygon", rings: [] } }), "GEOGRAPHY_INVALID"],
  [geography({ type: "POLYGON", geometry: { type: "MultiPolygon", polygons: [] } }), "GEOGRAPHY_INVALID"],
  [geography({ geometry: { type: "MultiPolygon", polygons: [] } }), "GEOMETRY_UNSUPPORTED"],
  [geography({ geometry: { type: "Point", point: { lat: null, lng: null } } }), "POINT_INVALID"],
  [geography({ geometry: { type: "Point", point: { lat: "21", lng: "-102" } } }), "POINT_INVALID"],
  [geography({ geometry: { type: "Point", coordinates: [1, NaN] } }), "POINT_INVALID"],
  [geography({ geometry: { type: "Point", coordinates: [181, 0] } }), "POINT_INVALID"],
  [geography({ geometry: { type: "Point", coordinates: [1, 2, 3] } }), "POINT_INVALID"],
])("invalid or unsupported persisted geography rejects before any territorial query (%#)", async (canonical, suffix) => {
  const access = allow(); access.project.canonicalGeography = canonical;
  authorize.mockResolvedValue(access);
  expect(await resolveScinceCanonicalContext({ projectId: "P1" }, "cookie")).toEqual({ success: false, code: `SCINCE_CANONICAL_${suffix}` });
  expect(resolve).not.toHaveBeenCalled();
});
test.each(["VALID", "INVALID"])("explicit zero Point with %s state respects the canonical state", async validationStatus => {
  authorize.mockResolvedValue(allow(geography({ validationStatus, geometry: { type: "Point", coordinates: [0, 0] } })));
  const result = await resolveScinceCanonicalContext({ projectId: "P1" }, "cookie");
  expect(result.success).toBe(validationStatus === "VALID");
  if (validationStatus === "VALID") expect(resolve).toHaveBeenCalledWith(0, 0, undefined, expect.objectContaining({projectId:"P1"}));
  else expect(resolve).not.toHaveBeenCalled();
});
test("malicious input, legacy ownership, photos and derived centers cannot determine identity or coordinates", async () => {
  authorize.mockResolvedValue({ ...allow(geography({ derived: { centroid: { lat: 1, lng: 1 } } })),
    project: { ...allow().project, createdBy: "attacker", photos: [{ lat: 2, lng: 2 }], latitude: 3, longitude: 3 } } as any);
  const malicious = { projectId: "P1", lat: 1, lng: 1, role: "SUPER_ADMIN", userId: "other", username: "other",
    canonicalGeography: geography({ geometry: { type: "Point", coordinates: [1, 1] } }) };
  expect((await resolveScinceCanonicalContext(malicious, "cookie")).success).toBe(true);
  expect(authorize).toHaveBeenCalledWith({ projectId: "P1", sessionToken: "cookie", action: "ANALYZE_SCINCE" });
  expect(resolve).toHaveBeenCalledWith(21.9, -102.3, undefined, expect.objectContaining({projectId:"P1",geographyId:"P1:INDIVIDUAL"}));
});
test("legacy fields and photos never substitute missing canonical geography", async () => {
  authorize.mockResolvedValue({ ...allow(), project: { createdBy: "owner", latitude: 21, longitude: -102, photos: [{}] } } as any);
  expect(await resolveScinceCanonicalContext({ projectId: "P1" }, "cookie")).toMatchObject({ success: false, code: "SCINCE_CANONICAL_GEOGRAPHY_MISSING" });
  expect(resolve).not.toHaveBeenCalled();
});
test.each(["NO_DATA", "NOT_CONFIGURED", "FAILED"])("resolver %s becomes a sanitized unavailable result", async status => {
  resolve.mockResolvedValue({ status, exito: false, error: "SQL SECRET token" } as any);
  expect(await resolveScinceCanonicalContext({ projectId: "P1" }, "cookie")).toEqual({ success: false, code: "SCINCE_CANONICAL_DATA_UNAVAILABLE" });
});
test("resolver exceptions cannot leak SQL, tokens or credentials", async () => {
  resolve.mockRejectedValue(new Error("SQL SECRET token"));
  expect(await resolveScinceCanonicalContext({ projectId: "P1" }, "cookie")).toEqual({ success: false, code: "SCINCE_CANONICAL_DATA_UNAVAILABLE" });
});
test("authorization infrastructure exceptions are sanitized", async () => {
  authorize.mockRejectedValue(new Error("SECRET cookie SQL"));
  expect(await resolveScinceCanonicalContext({ projectId: "P1" }, "cookie")).toEqual({ success: false, code: "SCINCE_CANONICAL_ACCESS_DENIED" });
  expect(resolve).not.toHaveBeenCalled();
});
test("unavailable demographic or dataset fields remain honest nulls", async () => {
  resolve.mockResolvedValue({ status: "OBSERVED", exito: true, geographicLevel: "AGEB" } as any);
  expect(await resolveScinceCanonicalContext({ projectId: "P1" }, "cookie")).toMatchObject({ success: true,
    datasetId: null, datasetYear: null, datasetVersion: null, demographics: null,
    demographicGeographicLevel: null, sourceRowKey: null, provenance: null });
});
test("server action retrieves only the trusted cookie and ignores extra client arguments", async () => {
  jest.mocked(cookies).mockReturnValue({ get: jest.fn(() => ({ value: "server-cookie" })) } as any);
  expect((await (getCanonicalScinceData as any)("P1", { sessionToken: "client-token", lat: 1, role: "SUPER_ADMIN" })).success).toBe(false);
  expect(authorize).toHaveBeenCalledWith({ projectId: "P1", sessionToken: "server-cookie", action: "ANALYZE_SCINCE" });
});
test("the flow exposes no write dependency and never invokes extra injected writers", async () => {
  const write = jest.fn();
  await resolveScinceCanonicalContext({ projectId: "P1" }, "cookie", { write } as any);
  expect(write).not.toHaveBeenCalled();
});
