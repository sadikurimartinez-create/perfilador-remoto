import { Packer } from "docx";
import JSZip from "jszip";
import { readFileSync } from "fs";
import { resolve } from "path";
import { resolveScinceDocumentPublication, type ScincePersistedDocumentSource } from "../src/services/scinceDocumentPublicationService";
import { getScinceDocumentContext } from "../src/lib/scinceDocumentActions";
import { authorizeInstitutionalProjectAccess } from "../src/services/institutionalProjectAccessService";
import { getInstitutionalAdminDb } from "../src/lib/firebaseAdmin";
import { cookies } from "next/headers";
import * as snapshotCore from "../src/utils/scinceCanonicalSnapshot";
import { fingerprintScinceCanonicalPoint } from "../src/utils/scinceGeographyBinding";
import type { ScinceCanonicalSuccess } from "../src/types/scinceCanonicalSnapshot";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { scinceDocumentSummary, scinceDocumentFacts, scinceDocumentLimitations, integrateScinceDocumentContextForReport,
  type ScinceDocumentContext } from "../src/utils/scinceDocumentContext";
import { buildInstitutionalReportInput, type InstitutionalReportInput } from "../src/utils/institutionalReportPublicationContract";
import { buildExecutiveGeointReportModel } from "../src/utils/executiveGeointReportModel";
import { buildExecutiveVisualComposition } from "../src/utils/executiveVisualComposition";
import { buildExecutiveGeointReportDocumentModel } from "../src/utils/executiveGeointReportDocumentModel";
import { buildExecutiveGeointTechnicalAnnexModel } from "../src/utils/executiveGeointTechnicalAnnexModel";
import { renderExecutiveGeointWordDocument as renderExecutiveGeointWordDocumentDraft } from "../src/utils/executiveGeointWordRenderer";
import { renderExecutiveGeointTechnicalAnnexWordDocument as renderExecutiveGeointTechnicalAnnexWordDocumentDraft } from "../src/utils/executiveGeointTechnicalAnnexWordRenderer";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { createComputedFileIntegrity } from "../src/utils/forensicFileIntegrity";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/services/institutionalProjectAccessService", () => ({ authorizeInstitutionalProjectAccess: jest.fn() }));
jest.mock("@/lib/firebaseAdmin", () => ({ getInstitutionalAdminDb: jest.fn() }));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));

const geography: CanonicalProjectGeography = { geographyId: "P1:INDIVIDUAL", type: "INDIVIDUAL",
  geometry: { type: "Point", coordinates: [-102.291, 21.881] }, source: "MAP_VECTOR",
  validationStatus: "VALID", createdAt: 1, updatedAt: 1 };
const generatedAt = "2026-10-01T12:00:00.000Z";
function observed(): ScinceCanonicalSuccess {
  return { success: true, projectId: "P1", geographyId: geography.geographyId, geographyType: "INDIVIDUAL",
    spatialMode: "CANONICAL_POINT", geographyFingerprint: fingerprintScinceCanonicalPoint(geography),
    queryCoordinate: { lat: 21.881, lng: -102.291 }, datasetId: "scince-fixture-2020", datasetYear: 2020, datasetVersion: "declared-v1",
    geographicLevel: "MANZANA", demographicGeographicLevel: "AGEB", sourceRowKey: "source-row-scince",
    demographics: { geographicLevel: "AGEB", populationTotal: 98765, housingTotal: 34567,
      inhabitedPrivateHousing: 23456, uninhabitedPrivateHousing: null, marginacion: null,
      marginacionNote: "No disponible: marginación no forma parte del producto importado." },
    provenance: { datasetId: "scince-fixture-2020", referenceYear: 2020, version: "declared-v1", productName: "Producto INEGI observado",
      importedAt: "2026-09-01T01:00:00.000Z", completedAt: "2026-09-02T01:00:00.000Z",
      geographySourceUrl: "https://www.inegi.org.mx/geography-fixture", geographySha256: "a".repeat(64),
      censusSourceUrl: "https://www.inegi.org.mx/census-fixture", censusSha256: "b".repeat(64),
      queryCoordinates: { lat: 21.881, lng: -102.291 }, geographicLevel: "MANZANA", demographicGeographicLevel: "AGEB", sourceRowKey: "source-row-scince" },
    limitations: ["Cobertura limitada al dataset oficial importado.", "Las cifras corresponden al nivel AGEB declarado."] };
}
const snapshot = () => snapshotCore.buildScinceCanonicalSnapshot(observed());
function persisted(): ScincePersistedDocumentSource {
  return { id: "P1", canonicalGeography: geography, iaAnalysis: { scinceCanonicalSnapshot: snapshot(),
    scinceDemographics: { populationTotal: 111111, legacy: "legacy-secret-fixture" } } };
}
function readyProject() {
  const lineage = buildEvidenceLineage({ geographyId: geography.geographyId, sourceId: "source-1", evidenceId: "ev-1",
    findingId: "find-1", analysisId: "analysis-1" });
  return { id: "P1", nombre: "Expediente fixture", numeroExpediente: "01102026-0001-PPC", canonicalGeography: geography,
    canonicalHypothesis: formulateHumanHypothesis({ projectId: "P1", text: "Hipótesis humana inicial del expediente", geographyId: geography.geographyId,
      authorId: "PPC", createdAt: generatedAt, supportingEvidenceIds: ["ev-1"], supportingFindingIds: ["find-1"], lineage }),
    evidence: [{ evidenceId: "ev-1", geographyId: geography.geographyId, humanValidationStatus: "APPROVED", lineage,
      forensicIntegrity: createComputedFileIntegrity({ rawSha256: "c".repeat(64), declaredMimeType: "image/jpeg" }), sourceStatus: "AUTHORITATIVE" }],
    findings: [{ findingId: "find-1", title: "Observación de campo validada", humanValidationStatus: "APPROVED", lineage, lineageStatus: "SUPPORTED" }],
    analysisOutputs: [{ analysisId: "analysis-1", humanValidationStatus: "APPROVED", lineage, lineageStatus: "SUPPORTED" }],
    iaAnalysis: persisted().iaAnalysis };
}
const authorization = (): any => ({ allowed: true, projectId: "P1", action: "GENERATE_REPORT", actor: {}, project: { canonicalGeography: geography }, audit: {} });
async function admit(project: ScincePersistedDocumentSource = persisted(), reportGeography: CanonicalProjectGeography | null = geography) {
  return resolveScinceDocumentPublication({ projectId: "P1", sessionToken: "trusted-cookie", reportGeography }, {
    authorize: jest.fn().mockResolvedValue(authorization()), readProject: jest.fn().mockResolvedValue(project),
  });
}
function documents(context: ScinceDocumentContext) {
  const input: InstitutionalReportInput = { ...buildInstitutionalReportInput(readyProject(), { generatedAt }), scinceContext: context };
  const executive = buildExecutiveGeointReportModel(input, { documentIdentity: { numeroExpediente: "01102026-0001-PPC", projectId: "P1" }, fecha: generatedAt });
  const composition = buildExecutiveVisualComposition(executive, input);
  const document = buildExecutiveGeointReportDocumentModel(executive, composition, input);
  const annex = buildExecutiveGeointTechnicalAnnexModel(input, executive, composition, document);
  return { input, executive, composition, document, annex };
}
async function xml(document: any) {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
  return zip.file("word/document.xml")!.async("string");
}
beforeEach(() => { jest.clearAllMocks(); jest.mocked(authorizeInstitutionalProjectAccess).mockResolvedValue(authorization());
  jest.mocked(cookies).mockReturnValue({ get: jest.fn(() => ({ value: "trusted-cookie" })) } as any); });

test("CURRENT persisted snapshot crosses the existing gate into both institutional models", async () => {
  const gate = jest.spyOn(snapshotCore, "isScinceSnapshotPublishable");
  const context = await admit();
  expect(context.publicationStatus).toBe("PUBLISHABLE"); expect(gate).toHaveBeenCalled(); gate.mockRestore();
  const d = documents(context);
  expect(d.document.sections.find(s => s.sectionId === "territorial-situation")!.content.join(" ")).toContain("98765");
  expect(d.annex.sections.find(s => s.sectionId === "scince")!.facts).toContainEqual({ label: "Población total", value: "98765" });
});
test.each(["datasetId", "year", "version"] as const)("CURRENT preserves dataset %s", async key => {
  const context = await admit(); if (context.publicationStatus !== "PUBLISHABLE") throw new Error("Expected admission");
  expect(context.snapshot.dataset[key]).toEqual(snapshot().dataset[key]);
});
test.each(["geographicLevel", "demographicGeographicLevel", "sourceRowKey"] as const)("CURRENT preserves territorial resolution %s", async key => {
  const context = await admit(); if (context.publicationStatus !== "PUBLISHABLE") throw new Error("Expected admission");
  expect(context.snapshot.territorialResolution[key]).toEqual(snapshot().territorialResolution[key]);
});
test.each(["demographics", "provenance", "limitations"] as const)("CURRENT preserves %s without mutation", async key => {
  const project = persisted(), before = structuredClone(project), context = await admit(project);
  if (context.publicationStatus !== "PUBLISHABLE") throw new Error("Expected admission");
  expect(context.snapshot[key]).toEqual(snapshot()[key]); expect(project).toEqual(before);
});
test("MANZANA localization and AGEB demographics are explicitly distinguished", async () => {
  const context = await admit(), text = scinceDocumentSummary(context).join(" ");
  expect(text).toContain("localizada a nivel MANZANA"); expect(text).toContain("corresponden al nivel AGEB");
  expect(scinceDocumentFacts(context)).toContainEqual({ label: "Nivel territorial de los datos demográficos", value: "AGEB" });
});
test("marginacion remains null, absent counts are not zero, and importedAt never becomes observedAt", async () => {
  const context = await admit(); if (context.publicationStatus !== "PUBLISHABLE") throw new Error("Expected admission");
  expect(context.snapshot.demographics!.marginacion).toBeNull(); expect(context.snapshot.observedAt).toBeNull();
  expect(scinceDocumentFacts(context)).toContainEqual({ label: "Viviendas particulares deshabitadas", value: "No disponible" });
  expect(scinceDocumentFacts(context)).toContainEqual({ label: "Fecha de observación", value: "No disponible" });
  expect(documents(context).document.technicalMetadata.sourceProvenance).toContainEqual(expect.objectContaining({ source: "INEGI SCINCE", observedAt: null }));
});
test.each(["STALE", "INVALID", "MISSING", "LEGACY"] as const)("%s is omitted from publishable models and actual DOCX without blocking the report", async status => {
  const project = persisted();
  if (status === "STALE") project.canonicalGeography = { ...geography, geometry: { type: "Point", coordinates: [-102.292, 21.881] } };
  if (status === "INVALID") project.iaAnalysis!.scinceCanonicalSnapshot = { legacy: true };
  if (status === "MISSING" || status === "LEGACY") delete project.iaAnalysis!.scinceCanonicalSnapshot;
  if (status === "MISSING") delete project.iaAnalysis!.scinceDemographics;
  const before = structuredClone(project), context = await admit(project);
  expect(context.publicationStatus).toBe(`NOT_PUBLISHABLE_${status === "LEGACY" ? "MISSING" : status}`);
  expect(context.snapshot).toBeNull(); expect(project).toEqual(before);
  const d = documents(context);
  expect(d.input.reportReadyAssessment.readyForInstitutionalReport).toBe(true);
  expect(d.annex.sections.find(s => s.sectionId === "scince")!.facts).toHaveLength(0);
  expect(d.document.technicalMetadata.sourceProvenance?.some(s => s.source === "INEGI SCINCE")).toBe(false);
  const reportXml = await xml(renderExecutiveGeointWordDocument(d.document).document);
  const annexXml = await xml(renderExecutiveGeointTechnicalAnnexWordDocument(d.annex).document);
  for (const output of [reportXml, annexXml]) {
    expect(output).not.toMatch(/98765|34567|23456|scince-fixture-2020|source-row-scince|legacy-secret-fixture|111111/);
    expect(output).toContain("01102026-0001-PPC");
  }
});
test("CURRENT actual DOCX contains descriptive snapshot detail, limitations and provenance", async () => {
  const context = await admit(), d = documents(context);
  const reportXml = await xml(renderExecutiveGeointWordDocument(d.document).document);
  const annexXml = await xml(renderExecutiveGeointTechnicalAnnexWordDocument(d.annex).document);
  for (const output of [reportXml, annexXml]) ["scince-fixture-2020", "2020", "declared-v1", "MANZANA", "AGEB", "98765"].forEach(v => expect(output).toContain(v));
  ["source-row-scince", "34567", "23456", "Producto INEGI observado", "Fuente geográfica", "Fuente censal", "[referencia reservada]",
    "a".repeat(64), "b".repeat(64), ...snapshot().limitations].forEach(v => expect(annexXml).toContain(v));
  // The existing visible-document sanitizer reserves URLs; the model retains the exact source references.
  expect(d.annex.sections.find(s => s.sectionId === "scince")!.facts).toContainEqual({ label: "Fuente geográfica", value: observed().provenance!.geographySourceUrl });
  expect(d.annex.sections.find(s => s.sectionId === "scince")!.facts).toContainEqual({ label: "Fuente censal", value: observed().provenance!.censusSourceUrl });
});
test.each(["riesgo", "vulnerabilidad", "causal", "criminógeno", "criminogenicidad", "perfil criminal", "predicción", "reclutamiento", "evidencia", "hallazgo"])("SCINCE does not generate %s", async term => {
  const context = await admit();
  const block = [...scinceDocumentSummary(context), ...scinceDocumentFacts(context).map(f => `${f.label}: ${f.value}`), ...scinceDocumentLimitations(context)].join(" ").toLowerCase();
  expect(block).not.toContain(term);
});
test("SCINCE contributes no evidence, findings, hypotheses, map or chart slots", async () => {
  const baseline = documents(await admit({ ...persisted(), iaAnalysis: {} })), current = documents(await admit());
  for (const key of ["evidence", "findings", "inferences", "analyses", "conclusions", "visualProducts", "hypothesis"] as const)
    expect(current.input[key]).toEqual(baseline.input[key]);
  expect(current.composition.visualBudget).toEqual(baseline.composition.visualBudget);
  expect(current.document.visualPlacements).toEqual(baseline.document.visualPlacements);
  expect(current.annex.sections.find(s => s.sectionId === "scince")!.records).toHaveLength(0);
});
test("re-evaluation uses persisted current geometry even if authorized metadata and UI label say CURRENT", async () => {
  const project: any = persisted(); project.freshness = "CURRENT"; project.scinceContext = { publicationStatus: "PUBLISHABLE" };
  project.canonicalGeography = { ...geography, geometry: { type: "Point", coordinates: [-102.292, 21.881] } };
  expect(await admit(project)).toMatchObject({ territorialFreshness: "STALE", snapshot: null });
});
test("report geography mismatch or absence cannot publish a current persisted observation", async () => {
  expect(await admit(persisted(), { ...geography, geographyId: "other" })).toMatchObject({ territorialFreshness: "STALE", snapshot: null });
  expect(await admit(persisted(), null)).toMatchObject({ territorialFreshness: "STALE", snapshot: null });
});
test("generation re-reads and re-evaluates instead of caching a previous CURRENT decision", async () => {
  const readProject = jest.fn().mockResolvedValueOnce(persisted()).mockResolvedValueOnce({ ...persisted(), canonicalGeography: {
    ...geography, geometry: { type: "Point", coordinates: [-102.292, 21.881] } } });
  const deps = { authorize: jest.fn().mockResolvedValue(authorization()), readProject };
  const request = { projectId: "P1", sessionToken: "cookie", reportGeography: geography };
  expect((await resolveScinceDocumentPublication(request, deps)).publicationStatus).toBe("PUBLISHABLE");
  expect((await resolveScinceDocumentPublication(request, deps)).publicationStatus).toBe("NOT_PUBLISHABLE_STALE");
  expect(readProject).toHaveBeenCalledTimes(2);
});
test("transport failure clears a previous admission while allowing the rest of the report", async () => {
  const prior = documents(await admit()).input, before = structuredClone(prior);
  const result = await integrateScinceDocumentContextForReport(prior, jest.fn().mockRejectedValue(new Error("SECRET transport")));
  expect(result.scinceContext).toMatchObject({ publicationStatus: "NOT_PUBLISHABLE_INVALID", snapshot: null });
  expect(JSON.stringify(result.scinceContext)).not.toContain("SECRET");
  expect(result.reportReadyAssessment.readyForInstitutionalReport).toBe(true);
  expect(result.evidence).toEqual(prior.evidence); expect(prior).toEqual(before);
});
test("institutional input ignores supplied UI admission and never promotes legacy", () => {
  const project: any = readyProject(), before = structuredClone(project);
  project.scinceContext = { publicationStatus: "PUBLISHABLE", snapshot: snapshot() };
  const input = buildInstitutionalReportInput(project);
  expect(input.scinceContext).toMatchObject({ publicationStatus: "NOT_PUBLISHABLE_MISSING", snapshot: null });
  expect(input.scinceDemographics).toBeUndefined(); expect(project.iaAnalysis).toEqual(before.iaAnalysis);
});
test.each(["schema", "fingerprint", "projectId", "coordinate", "provenance"])("invalid %s fails closed without repair", async invalid => {
  const project = persisted(), s: any = project.iaAnalysis!.scinceCanonicalSnapshot;
  if (invalid === "schema") s.schemaVersion = "V2";
  if (invalid === "fingerprint") delete s.geographyBinding.geographyFingerprint;
  if (invalid === "projectId") s.projectId = "P2";
  if (invalid === "coordinate") s.geographyBinding.queryCoordinate.lat = 999;
  if (invalid === "provenance") s.dataset.year = 2025;
  expect(await admit(project)).toMatchObject({ publicationStatus: "NOT_PUBLISHABLE_INVALID", snapshot: null });
});
test("server action obtains the trusted cookie, authorizes GENERATE_REPORT and reads only the persisted project fixture", async () => {
  const get = jest.fn().mockResolvedValue({ exists: true, id: "P1", data: () => persisted() });
  const doc = jest.fn(() => ({ get })), collection = jest.fn(() => ({ doc }));
  jest.mocked(getInstitutionalAdminDb).mockReturnValue({ collection } as any);
  expect((await getScinceDocumentContext("P1", geography)).publicationStatus).toBe("PUBLISHABLE");
  expect(authorizeInstitutionalProjectAccess).toHaveBeenCalledWith({ projectId: "P1", action: "GENERATE_REPORT", sessionToken: "trusted-cookie" });
  expect(collection).toHaveBeenCalledWith("projects"); expect(doc).toHaveBeenCalledWith("P1"); expect(get).toHaveBeenCalledTimes(1);
});
test("denied authorization, failed reads and inconsistent project identity omit SCINCE", async () => {
  const readProject = jest.fn();
  const denied = await resolveScinceDocumentPublication({ projectId: "P1", sessionToken: "cookie", reportGeography: geography }, {
    authorize: jest.fn().mockResolvedValue({ allowed: false }), readProject });
  expect(denied.snapshot).toBeNull(); expect(readProject).not.toHaveBeenCalled();
  const failed = await resolveScinceDocumentPublication({ projectId: "P1", sessionToken: "cookie", reportGeography: geography }, {
    authorize: jest.fn().mockResolvedValue(authorization()), readProject: jest.fn().mockRejectedValue(new Error("SECRET SQL")) });
  expect(JSON.stringify(failed)).not.toContain("SECRET"); expect(failed.snapshot).toBeNull();
  expect((await admit({ ...persisted(), id: "P2" })).snapshot).toBeNull();
});
test("DOCX admission happens before both document models and is recorded in the existing generation snapshot", () => {
  const source = readFileSync(resolve(__dirname, "../src/lib/exportToWord.ts"), "utf8");
  const start = source.indexOf("async function buildInstitutionalGenerationContext");
  const end = source.indexOf("async function hydrateTechnicalAnnexVisualAssets", start);
  const generation = readFileSync(resolve(__dirname, "../src/utils/institutionalGenerationModels.ts"), "utf8");
  expect(source.slice(start, end)).toContain("await buildInstitutionalGenerationModels");
  expect(generation).toContain("await integrateScinceDocumentContextForReport(institutionalReportInput, getScinceDocumentContext)");
  expect(generation.indexOf("await integrateScinceDocumentContextForReport")).toBeLessThan(generation.indexOf("const documentModel ="));
  const service = readFileSync(resolve(__dirname, "../src/services/scinceDocumentPublicationService.ts"), "utf8");
  expect(service).not.toMatch(/setDoc|updateDoc|\.set\(|\.update\(|resolveInegiTerritory|\bquery\(/);
  const modelSources = ["executiveGeointReportDocumentModel", "executiveGeointTechnicalAnnexModel"]
    .map(name => readFileSync(resolve(__dirname, `../src/utils/${name}.ts`), "utf8"));
  modelSources.forEach(text => expect(text).not.toContain("scinceDemographics"));
});

// Composition-only fixtures are explicit drafts; final guards are tested in PRE-P7.
const renderExecutiveGeointWordDocument = (model: Parameters<typeof renderExecutiveGeointWordDocumentDraft>[0], options: Parameters<typeof renderExecutiveGeointWordDocumentDraft>[1] = {}) => renderExecutiveGeointWordDocumentDraft(model, { ...options, exportMode: "DRAFT" });
const renderExecutiveGeointTechnicalAnnexWordDocument = (model: Parameters<typeof renderExecutiveGeointTechnicalAnnexWordDocumentDraft>[0], options: Parameters<typeof renderExecutiveGeointTechnicalAnnexWordDocumentDraft>[1] = {}) => renderExecutiveGeointTechnicalAnnexWordDocumentDraft(model, { ...options, exportMode: "DRAFT" });
