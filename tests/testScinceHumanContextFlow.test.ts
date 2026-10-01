import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import ts from "typescript";
import { createScinceHumanContextFlow, type ScinceHumanContext } from "../src/utils/scinceHumanContextFlow";
import { prepareScinceContextIncorporation, getScinceContextFreshness } from "../src/lib/scinceHumanContextActions";
import { getCanonicalScinceData } from "../src/lib/osintActions";
import { authorizeInstitutionalProjectAccess } from "../src/services/institutionalProjectAccessService";
import { cookies } from "next/headers";
import { buildScinceCanonicalSnapshot } from "../src/utils/scinceCanonicalSnapshot";
import { fingerprintScinceCanonicalPoint } from "../src/utils/scinceGeographyBinding";
import type { ScinceCanonicalSuccess } from "../src/types/scinceCanonicalSnapshot";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/osintActions", () => ({ getCanonicalScinceData: jest.fn() }));
jest.mock("@/services/institutionalProjectAccessService", () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));

// Test-local TSX harness, following testADR0228BCrimeIncidenceWorkspace.test.ts.
// Jest inherits jsx: preserve; compile the real panel and button without global changes.
function loadTsxModule<T>(filename: string): T {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React,
      esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  const localRequire = (specifier: string): unknown => {
    if (specifier === "@/components/ui/CEIPOLButton") {
      return loadTsxModule<typeof import("../src/components/ui/CEIPOLButton")>(
        resolve(__dirname, "../src/components/ui/CEIPOLButton.tsx"));
    }
    // Keep Jest's module resolution and existing server mocks for all other imports.
    return require(specifier);
  };
  const moduleRecord = { exports: {} };
  new Function("require", "module", "exports", output)(localRequire, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports as T;
}
const { ScinceObservedResult, ScinceHumanContextPanel, ScinceFreshnessStatus } =
  loadTsxModule<typeof import("../src/components/ScinceHumanContextPanel")>(
    resolve(__dirname, "../src/components/ScinceHumanContextPanel.tsx"));

const geography: CanonicalProjectGeography = { geographyId: "P1:INDIVIDUAL", type: "INDIVIDUAL",
  geometry: { type: "Point", coordinates: [-102.291, 21.881] }, validationStatus: "VALID",
  source: "MAP_VECTOR", createdAt: 1, updatedAt: 1 };
function observed(): ScinceCanonicalSuccess {
  return { success: true, projectId: "P1", geographyId: geography.geographyId,
    geographyFingerprint: fingerprintScinceCanonicalPoint(geography), geographyType: "INDIVIDUAL", spatialMode: "CANONICAL_POINT",
    queryCoordinate: { lat: 21.881, lng: -102.291 }, datasetId: "censo", datasetYear: 2020, datasetVersion: "v1",
    geographicLevel: "MANZANA", demographicGeographicLevel: "AGEB", sourceRowKey: "row",
    demographics: { geographicLevel: "AGEB", populationTotal: 10, housingTotal: 5,
      inhabitedPrivateHousing: 4, uninhabitedPrivateHousing: 1, marginacion: null, marginacionNote: "No disponible" },
    provenance: { datasetId: "censo", referenceYear: 2020, version: "v1", productName: "Censo",
      importedAt: "2026-01-01", completedAt: "2026-01-02", geographySourceUrl: "https://www.inegi.org.mx/g",
      geographySha256: "a".repeat(64), censusSourceUrl: "https://www.inegi.org.mx/c", censusSha256: "b".repeat(64),
      queryCoordinates: { lat: 21.881, lng: -102.291 }, geographicLevel: "MANZANA", demographicGeographicLevel: "AGEB", sourceRowKey: "row" },
    limitations: ["Cobertura limitada al dataset oficial importado."] };
}
const authorization = (current: CanonicalProjectGeography = geography): any => ({ allowed: true, projectId: "P1", action: "WRITE",
  actor: { institutionalUserId: "trusted-id", username: "trusted-user", role: "USER" },
  project: { canonicalGeography: current }, audit: {} });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(cookies).mockReturnValue({ get: jest.fn(() => ({ value: "trusted-cookie" })) } as any);
  jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue(authorization());
  jest.mocked(getCanonicalScinceData).mockResolvedValue(observed());
});
function harness(existing: Record<string, unknown> = {}) {
  let context: ScinceHumanContext = { projectId: "P1", readOnly: false, analysis: existing, territoryRevision: "territory1" };
  const updateProjectDetails = jest.fn().mockResolvedValue(undefined);
  const setAnalysisResult = jest.fn((next: Record<string, unknown>) => { context = { ...context, analysis: next }; });
  const prepare = jest.fn(prepareScinceContextIncorporation);
  const changed = jest.fn();
  const flow = createScinceHumanContextFlow({ context: () => context, query: getCanonicalScinceData,
    prepare, updateProjectDetails, setAnalysisResult, changed });
  return { flow, updateProjectDetails, setAnalysisResult, prepare, changed,
    context: () => context, change: (patch: Partial<ScinceHumanContext>) => { context = { ...context, ...patch }; } };
}

test("executing creation, query and review never persists until the explicit incorporate action", async () => {
  const h = harness();
  expect(h.flow.getState().status).toBe("IDLE"); expect(h.updateProjectDetails).not.toHaveBeenCalled();
  const pending = h.flow.consult(); expect(h.flow.getState().status).toBe("CONSULTANDO");
  await pending;
  expect(h.flow.getState()).toMatchObject({ status: "RESULTADO_DISPONIBLE", result: observed() });
  expect(h.prepare).not.toHaveBeenCalled(); expect(h.updateProjectDetails).not.toHaveBeenCalled();
  const incorporation = h.flow.incorporate(); expect(h.flow.getState().status).toBe("INCORPORANDO");
  await incorporation;
  expect(h.updateProjectDetails).toHaveBeenCalledTimes(1);
  expect(h.flow.getState().status).toBe("INCORPORADO");
});
test("multiple selected photos with GPS cannot influence institutional query coordinates", async () => {
  const selectedPhotos = [{ id: "a", lat: 1, lng: 2 }, { id: "b", lat: 50, lng: 60 }];
  const h = harness({ selectedPhotos });
  await h.flow.consult();
  expect(getCanonicalScinceData).toHaveBeenCalledTimes(1);
  expect(getCanonicalScinceData).toHaveBeenCalledWith("P1");
  expect(h.flow.getState().result?.queryCoordinate).toEqual({ lat: 21.881, lng: -102.291 });
  expect(h.updateProjectDetails).not.toHaveBeenCalled();
});
test("NO INCORPORAR, opening/reviewing and closing review never write", async () => {
  const h = harness(); await h.flow.consult(); h.flow.dismiss();
  expect(h.flow.getState().status).toBe("IDLE");
  await h.flow.incorporate();
  expect(h.prepare).not.toHaveBeenCalled(); expect(h.updateProjectDetails).not.toHaveBeenCalled();
});
test("rendering panel never queries or persists automatically", () => {
  const h = harness({ scinceDemographics: { legacy: true } });
  const html = renderToStaticMarkup(React.createElement(ScinceHumanContextPanel, { projectId: "P1", canonicalGeography: geography,
    analysis: h.context().analysis, isReadOnly: false, updateProjectDetails: h.updateProjectDetails, setAnalysisResult: h.setAnalysisResult }));
  expect(html).toContain("CONSULTAR SCINCE"); expect(html).toContain("Contexto SCINCE legacy");
  expect(getCanonicalScinceData).not.toHaveBeenCalled(); expect(h.updateProjectDetails).not.toHaveBeenCalled();
});
test("snapshot and legacy fields coexist; query does not replace, incorporation alone replaces", async () => {
  const previous = buildScinceCanonicalSnapshot(observed()); previous.limitations.push("previous");
  const legacy = { old: true }, h = harness({ scinceCanonicalSnapshot: previous,
    scinceDemographics: legacy, scinceCanonicalSnapshotHistory: [{ old: "history" }], unrelated: { keep: true } });
  await h.flow.consult();
  expect(h.context().analysis?.scinceCanonicalSnapshot).toBe(previous);
  expect(h.updateProjectDetails).not.toHaveBeenCalled();
  await h.flow.incorporate();
  const analysis = h.updateProjectDetails.mock.calls[0][0].iaAnalysis;
  expect(analysis.scinceCanonicalSnapshot).toEqual(buildScinceCanonicalSnapshot(observed()));
  expect(analysis.scinceDemographics).toBe(legacy); expect(analysis.unrelated).toEqual({ keep: true });
  expect(analysis.scinceCanonicalSnapshotHistory).toEqual([{ old: "history" }]);
  expect(analysis.scinceCanonicalIncorporation).toMatchObject({ decision: "INCORPORATED",
    incorporatedBy: { institutionalUserId: "trusted-id", username: "trusted-user" } });
  expect(analysis.scinceCanonicalIncorporation.incorporatedAt).toEqual(expect.any(String));
});
test.each([
  ["SCINCE_CANONICAL_ACCESS_DENIED", "ACCESO_DENEGADO"],
  ["SCINCE_CANONICAL_GEOMETRY_UNSUPPORTED", "GEOMETRIA_NO_COMPATIBLE"],
  ["SCINCE_CANONICAL_GEOGRAPHY_INVALID", "NO_DISPONIBLE"],
  ["SCINCE_CANONICAL_DATA_UNAVAILABLE", "NO_DISPONIBLE"],
] as const)("query %s displays safe %s without persistence", async (code, status) => {
  jest.mocked(getCanonicalScinceData).mockResolvedValue({ success: false, code });
  const h = harness(); await h.flow.consult(); await h.flow.incorporate();
  expect(h.flow.getState().status).toBe(status); expect(h.updateProjectDetails).not.toHaveBeenCalled();
});
test("transport exceptions are sanitized", async () => {
  jest.mocked(getCanonicalScinceData).mockRejectedValue(new Error("SECRET SQL token"));
  const h = harness(); await h.flow.consult();
  expect(h.flow.getState().status).toBe("ERROR"); expect(h.flow.getState().message).not.toMatch(/SECRET|SQL|token/);
});
test("reviewed result displays dataset, year, version, distinct levels, row, variables and limitations", () => {
  const html = renderToStaticMarkup(React.createElement(ScinceObservedResult, { result: observed() }));
  ["censo", "2020", "v1", "Nivel geográfico localizado", "MANZANA", "Nivel demográfico efectivo", "AGEB",
    "Los niveles difieren", "row", "Población total", "10", observed().limitations[0]].forEach(value => expect(html).toContain(value));
  expect(html).not.toMatch(/riesgo|vulnerabilidad|perfil criminal|predicción/i);
});
test("unsupported local modality displays neutral unavailable message with disabled query and no fallback", () => {
  const html = renderToStaticMarkup(React.createElement(ScinceHumanContextPanel, { projectId: "P1",
    canonicalGeography: { ...geography, type: "POLYGON", geometry: { type: "Polygon", coordinates: [] } },
    analysis: null, isReadOnly: false, updateProjectDetails: jest.fn(), setAnalysisResult: jest.fn() }));
  expect(html).toContain("SCINCE canónico no disponible todavía para esta modalidad territorial.");
  expect(html).toContain("disabled"); expect(getCanonicalScinceData).not.toHaveBeenCalled();
});
test("preparation invokes the existing builder, WRITE authorization, trusted cookie and canonical query without writers", async () => {
  const response = await prepareScinceContextIncorporation("P1", observed());
  expect(response.success).toBe(true);
  expect(authorizeInstitutionalProjectAccess).toHaveBeenCalledWith({ projectId: "P1", action: "WRITE", sessionToken: "trusted-cookie" });
  expect(getCanonicalScinceData).toHaveBeenCalledWith("P1");
  if (response.success) expect(response.snapshot).toEqual(buildScinceCanonicalSnapshot(observed()));
  expect(JSON.stringify(response)).not.toContain("trusted-cookie");
});
test("caller-declared actor is ignored in favor of authorized server identity", async () => {
  const result = { ...observed(), incorporatedBy: { institutionalUserId: "attacker" } };
  const response = await prepareScinceContextIncorporation("P1", result);
  expect(response.success).toBe(true);
  if (response.success) expect(response.incorporation.incorporatedBy.institutionalUserId).toBe("trusted-id");
});
test("tampered or changed observation requires new review and never writes", async () => {
  const h = harness(); await h.flow.consult();
  jest.mocked(getCanonicalScinceData).mockResolvedValue({ ...observed(), limitations: ["Changed dataset observation"] });
  await h.flow.incorporate();
  expect(h.flow.getState().status).toBe("ERROR"); expect(h.updateProjectDetails).not.toHaveBeenCalled();
  const tampered = observed(); tampered.demographics!.populationTotal = 999;
  jest.mocked(getCanonicalScinceData).mockResolvedValue(observed());
  expect(await prepareScinceContextIncorporation("P1", tampered)).toEqual({ success: false, code: "REVIEW_CHANGED" });
});
test("WRITE denial blocks preparation, query and persistence", async () => {
  const h = harness(); await h.flow.consult();
  jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue({ allowed: false, code: "PROJECT_ACCESS_DENIED", audit: {} } as any);
  jest.mocked(getCanonicalScinceData).mockClear();
  await h.flow.incorporate();
  expect(h.flow.getState().status).toBe("ACCESO_DENEGADO"); expect(getCanonicalScinceData).not.toHaveBeenCalled();
  expect(h.updateProjectDetails).not.toHaveBeenCalled();
});
test("territorial change after review blocks incorporation", async () => {
  const h = harness(); await h.flow.consult(); h.change({ territoryRevision: "territory2" });
  await h.flow.incorporate(); expect(h.prepare).not.toHaveBeenCalled(); expect(h.updateProjectDetails).not.toHaveBeenCalled();
});
test("server geography change also blocks incorporation through the existing freshness gate", async () => {
  const h = harness(); await h.flow.consult();
  jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue(authorization({ ...geography,
    geometry: { type: "Point", coordinates: [-102.292, 21.881] } }));
  await h.flow.incorporate(); expect(h.updateProjectDetails).not.toHaveBeenCalled();
});
test.each(["CURRENT", "STALE", "INVALID", "MISSING"] as const)("authorized freshness evaluates %s without demographic queries", async status => {
  let snapshot: unknown = buildScinceCanonicalSnapshot(observed());
  if (status === "INVALID") snapshot = { legacy: true };
  if (status === "MISSING") snapshot = null;
  if (status === "STALE") jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue(authorization({ ...geography,
    geometry: { type: "Point", coordinates: [-102.292, 21.881] } }));
  const response = await getScinceContextFreshness("P1", snapshot);
  expect(response).toMatchObject({ success: true, freshness: { territorialFreshness: status } });
  expect(getCanonicalScinceData).not.toHaveBeenCalled();
  expect(authorizeInstitutionalProjectAccess).toHaveBeenCalledWith({ projectId: "P1", action: "READ", sessionToken: "trusted-cookie" });
});
test("local pending geometry change can only lower server freshness", async () => {
  const snapshot = buildScinceCanonicalSnapshot(observed());
  expect(await getScinceContextFreshness("P1", snapshot, { ...geography, geometry: { type: "Point", coordinates: [-102.292, 21.881] } }))
    .toMatchObject({ success: true, freshness: { territorialFreshness: "STALE" } });
  jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue(authorization({ ...geography, geographyId: "other" }));
  expect(await getScinceContextFreshness("P1", snapshot, geography))
    .toMatchObject({ success: true, freshness: { territorialFreshness: "STALE" } });
});
test.each([
  ["CURRENT", "VIGENTE"], ["STALE", "OBSOLETO"], ["INVALID", "INVÁLIDO"], ["MISSING", "NO DISPONIBLE"],
  ["CHECKING", "Comprobando vigencia"], ["UNAVAILABLE", "NO DISPONIBLE"],
] as const)("UI renders %s as %s without promoting noncurrent states", (freshness, label) => {
  const html = renderToStaticMarkup(React.createElement(ScinceFreshnessStatus, { freshness }));
  expect(html).toContain(label);
  if (freshness !== "CURRENT") expect(html).not.toContain("VIGENTE");
  if (freshness === "STALE") expect(html).toContain("Se conserva como antecedente");
});
test("canonical snapshot legacy is INVALID; separate legacy data without snapshot remains MISSING", async () => {
  expect(await getScinceContextFreshness("P1", { populationTotal: 10 }))
    .toMatchObject({ success: true, freshness: { territorialFreshness: "INVALID" } });
  const h = harness({ scinceDemographics: { populationTotal: 10 } });
  const html = renderToStaticMarkup(React.createElement(ScinceHumanContextPanel, { projectId: "P1", canonicalGeography: geography,
    analysis: h.context().analysis, isReadOnly: false, updateProjectDetails: h.updateProjectDetails, setAnalysisResult: h.setAnalysisResult }));
  expect(html).toContain("NO DISPONIBLE"); expect(html).toContain("Contexto SCINCE legacy");
  expect(html).not.toContain("VIGENTE"); expect(h.context().analysis?.scinceCanonicalSnapshot).toBeUndefined();
});
test("malformed persisted numeric Point is never silently coerced to CURRENT", async () => {
  jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue(authorization({ ...geography,
    geometry: { type: "Point", point: { lat: "21.881", lng: "-102.291" } } } as any));
  expect(await getScinceContextFreshness("P1", buildScinceCanonicalSnapshot(observed())))
    .toMatchObject({ success: true, freshness: { territorialFreshness: "STALE" } });
});
test("read denied returns safe message and no freshness claim", async () => {
  jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue({ allowed: false, code: "PROJECT_ACCESS_REVOKED", audit: {} } as any);
  expect(await getScinceContextFreshness("P1", {})).toEqual({ success: false, code: "ACCESS_DENIED" });
});
test("read-only flow cannot query or incorporate", async () => {
  const h = harness(); h.change({ readOnly: true }); await h.flow.consult(); await h.flow.incorporate();
  expect(getCanonicalScinceData).not.toHaveBeenCalled(); expect(h.updateProjectDetails).not.toHaveBeenCalled();
});
test("double-click incorporate performs one write", async () => {
  const h = harness(); await h.flow.consult(); await Promise.all([h.flow.incorporate(), h.flow.incorporate()]);
  expect(h.updateProjectDetails).toHaveBeenCalledTimes(1);
});
test("pending preparation is abandoned if project or territory changes", async () => {
  const h = harness(); await h.flow.consult();
  let release!: (value: Awaited<ReturnType<typeof prepareScinceContextIncorporation>>) => void;
  h.prepare.mockImplementation(() => new Promise(r => { release = r; }));
  const pending = h.flow.incorporate(); h.change({ projectId: "P2" });
  release({ success: true, snapshot: buildScinceCanonicalSnapshot(observed()), incorporation: {
    decision: "INCORPORATED", incorporatedAt: "2026-10-01", incorporatedBy: { institutionalUserId: "trusted-id", username: "trusted-user" } } });
  await pending; expect(h.updateProjectDetails).not.toHaveBeenCalled();
});
test("unmount/dispose suppresses pending responses and StrictMode activation allows a fresh query", async () => {
  const h = harness(); h.flow.dispose(); await h.flow.consult(); expect(getCanonicalScinceData).not.toHaveBeenCalled();
  h.flow.activate(); await h.flow.consult(); expect(h.flow.getState().status).toBe("RESULTADO_DISPONIBLE");
});
test("write failure never marks incorporated or installs optimistic snapshot", async () => {
  const h = harness(); await h.flow.consult(); h.updateProjectDetails.mockRejectedValue(new Error("SECRET"));
  await h.flow.incorporate(); expect(h.flow.getState().status).toBe("ERROR");
  expect(h.setAnalysisResult).not.toHaveBeenCalled(); expect(h.flow.getState().message).not.toContain("SECRET");
});
test("PhotoAlbum wires only the canonical SCINCE panel; DENUE and report flows remain separate", () => {
  const photo = readFileSync(resolve(__dirname, "../src/components/PhotoAlbum.tsx"), "utf8");
  const start = photo.indexOf("{/* MÓDULO DE DEMOGRAFÍA TERRITORIAL OFICIAL INEGI");
  const end = photo.indexOf("{/* MÓDULO DE GIROS COMERCIALES", start);
  const scince = photo.slice(start, end);
  expect(scince).toContain("ScinceHumanContextPanel"); expect(scince).toContain('projectId={project?.id || ""}');
  expect(scince).not.toMatch(/selectedPhotos|selectedIds|centerLat|centerLng|reduce\(|getScinceData|registerSweep/);
  expect(photo).not.toMatch(/getScinceData|scinceDataConfirm/);
  expect(photo).toContain("CONFIRMACIÓN DE HIPÓTESIS COMERCIAL (DENUE)");
  const panel = readFileSync(resolve(__dirname, "../src/components/ScinceHumanContextPanel.tsx"), "utf8");
  expect(panel).toContain("query: getCanonicalScinceData"); expect(panel).toContain("onClick={() => void flow.incorporate()}");
  ["VIGENTE", "OBSOLETO", "INVÁLIDO", "NO DISPONIBLE"].forEach(label => expect(panel).toContain(label));
  expect(panel).not.toMatch(/getScinceData|registerSweep|setDoc|updateDoc|reportEngine|exportToWord/);
});
