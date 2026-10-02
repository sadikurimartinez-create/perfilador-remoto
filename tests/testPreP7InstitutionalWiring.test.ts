jest.mock("@/lib/institutionalReportSourceActions", () => ({ getAuthorizedInstitutionalReportSource: jest.fn() }));
import { preP7Fixture } from "./helpers/preP7InstitutionalFixture";
import { enrichInstitutionalPayloadWithCrimeIncidenceVisuals } from "../src/utils/crimeIncidenceInstitutionalPayloadBridge";
import { p6Fixture } from "./p6InstitutionalFixture";
import { MemoryRepository, MemoryStorage } from "./helpers/institutionalPackageMemory";
import { InstitutionalReportPackageService, buildInstitutionalPackageLineage, sha256Blob } from "../src/services/institutionalReportPackageService";
import { renderExecutiveGeointWordDocument } from "../src/utils/executiveGeointWordRenderer";
import { renderExecutiveGeointTechnicalAnnexWordDocument } from "../src/utils/executiveGeointTechnicalAnnexWordRenderer";
import { reconcileMaterializedDocument, reconcileDocumentSemanticAudit, incidenceDocumentBasis } from "../src/utils/institutionalDocumentSemanticIntegrity";
import { integrateScinceDocumentContextForReport, excludedScinceDocumentContext, scinceDocumentSummary } from "../src/utils/scinceDocumentContext";
import { buildInstitutionalReportInput } from "../src/utils/institutionalReportPublicationContract";
import { buildInstitutionalGenerationModels } from "../src/utils/institutionalGenerationModels";
import { exportToWord } from "../src/lib/exportToWord";
import { readFileSync } from "fs";
import { resolve } from "path";
import JSZip from "jszip";
import { assessDenueAnalyticalPublication } from "../src/utils/denueAnalyticalPublicationGate";

let f: Awaited<ReturnType<typeof preP7Fixture>>;
beforeAll(async () => { f = await preP7Fixture(); }, 180000);
const clone = <T>(value: T): T => structuredClone(value);
function setup() {
  const repository = new MemoryRepository(), storage = new MemoryStorage();
  return { repository, storage, base: { ...f.base, generationContext: clone(f.context), pdfArtifacts: { ...f.base.pdfArtifacts, parity: clone(f.base.pdfArtifacts.parity) } },
    service: new InstitutionalReportPackageService(repository, storage, () => "2026-10-01T00:00:00.000Z", async () => f.authorized) };
}
describe("PRE-P7-R1 institutional wiring, actual models and artifacts offline", () => {
  test("P2→P4→P3→P5→P6→package reconstructs authorized models and archives four artifacts", async () => {
    const x = setup(), manifest = await x.service.persistGeneratedPackage(x.base);
    expect(manifest.state).toBe("GENERATED"); expect(x.storage.writes).toHaveLength(4);
    expect(manifest.lineage.contract).toEqual(f.context.lineage);
    expect(f.context.institutionalReportInput.multisourceAnalysis).toEqual(f.context.executiveModel.multisourceAnalysis.technicalMetadata.governedAnalysis);
    expect(f.context.documentModel.semanticIntegrity.status).toBe("RECONCILED");
  }, 180000);
  test.each(["missing", "RESERVED", "disabled"])("executive rejects %s P5", state => {
    const model = clone(f.context.documentModel);
    if (state === "missing") delete model.semanticIntegrity;
    else if (state === "disabled") model.semanticIntegrity.enforced = false;
    else model.semanticIntegrity.status = state;
    expect(() => renderExecutiveGeointWordDocument(model, { visualAssetsById: f.assets })).toThrow("P5_BLOCKED");
  });
  test.each(["missing", "RESERVED", "disabled"])("annex rejects %s P5", state => {
    const model = clone(f.context.annexModel);
    if (state === "missing") delete model.technicalMetadata.semanticIntegrity;
    else if (state === "disabled") model.technicalMetadata.semanticIntegrity.enforced = false;
    else model.technicalMetadata.semanticIntegrity.status = state;
    expect(() => renderExecutiveGeointTechnicalAnnexWordDocument(model, { visualAssetsById: f.assets })).toThrow("P5_BLOCKED");
  });
  test.each([
    ["P2 fingerprint missing", (x: any) => delete x.generationContext.sourceAuthority.sourceFingerprint],
    ["P2 incompatible", (x: any) => x.generationContext.sourceAuthority.sourceFingerprint = "B"],
    ["P5 fingerprint missing", (x: any) => delete x.generationContext.lineage.semanticIntegrityFingerprint],
    ["P5 incompatible", (x: any) => x.generationContext.lineage.semanticIntegrityFingerprint = "B"],
    ["document incompatible", (x: any) => x.generationContext.documentModel.sections[1].content.push("AFIRMACIÓN NO RESERVADA")],
    ["source projection incompatible", (x: any) => x.generationContext.lineage.sourceProjectionFingerprint = "B"],
    ["project mismatch", (x: any) => x.projectId = "foreign"],
    ["expediente mismatch", (x: any) => x.numeroExpediente = "foreign"],
    ["one artifact missing", (x: any) => x.pdfArtifacts.annex = null],
    ["PDF failure", (x: any) => x.pdfArtifacts.parity.status = "FAILED"],
  ] as Array<[string, (input: any) => void]>)("BLOCK: %s before storage", async (_label, mutate) => {
    const x = setup(); mutate(x.base); await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow(); expect(x.storage.writes).toHaveLength(0); expect(x.repository.records.size).toBe(0);
  });
  test("BLOCK: recomputed client seals cannot authorize foreign P2 lineage", async () => {
    const x = setup(); x.base.generationContext.institutionalReportInput.evidence[0].summary = "CONTENIDO AJENO";
    x.base.generationContext.lineage = await buildInstitutionalPackageLineage(f.authorized, x.base.generationContext);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow("P2_INPUT"); expect(x.storage.writes).toHaveLength(0);
  });
  test("BLOCK: correct self hashes do not admit altered DOCX content", async () => {
    const x = setup(), zip = await JSZip.loadAsync(await x.base.reportBlob.arrayBuffer());
    zip.file("word/document.xml", (await zip.file("word/document.xml")!.async("string")).replace("Número de expediente:", "Número adulterado de expediente:"));
    x.base.reportBlob = new Blob([await zip.generateAsync({ type: "arraybuffer" })]);
    x.base.pdfArtifacts.parity.sourceDocxHashes[0] = await sha256Blob(x.base.reportBlob);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow("P6_DOCX_BYTES"); expect(x.storage.writes).toHaveLength(0);
  }, 180000);
  test.each(["photo", "street-view"])("BLOCK: cited %s unavailable or invalid", id => {
    const assets = { ...f.assets, [id]: id === "photo" ? { data: new Uint8Array([1, 2, 3]), type: "png" } : null };
    const real = p6Fixture(); expect(real.document.semanticIntegrity!.requiredVisualIds).toContain(id);
    expect(() => reconcileMaterializedDocument(real.document, assets)).toThrow("NOT_RENDERED");
  });
  test("EXCLUDE/LIMIT: stale SCINCE never emits census facts", async () => {
    const input = await integrateScinceDocumentContextForReport(f.data, async () => excludedScinceDocumentContext("STALE", "fixture changed geography"));
    expect(scinceDocumentSummary(input.scinceContext)).toEqual([]); expect(input.scinceContext!.publicationStatus).toBe("NOT_PUBLISHABLE_STALE");
  });
  test("EXCLUDE: MOCK OSINT", () => {
    const project = clone(f.project); project.osint[0].acquisitionMode = "MOCK"; project.osint[0].epistemicIntegrity.acquisitionMode = "MOCK";
    expect(buildInstitutionalReportInput(project).osint).toEqual([]);
  });
  test("EXCLUDE: unapproved relation cannot become institutional convergence", () => {
    const project = clone(f.project); project.convergences[0].humanReviewStatus = "PENDING_REVIEW";
    expect(buildInstitutionalReportInput(project).convergences).toEqual([]);
  });
  test("EXCLUDE: DENUE analytical relation pending human approval", () => {
    const denue = f.data.denuePois[0];
    const relation: any = { relationId: "pending-denue", denueLayerId: denue.id, sourceEvidenceId: denue.evidenceId,
      expedienteId: "exp", geographyId: "geo", relationTypes: ["SPATIAL_PROXIMITY"], linkedEvidenceIds: [], linkedFindingIds: [],
      linkedHypothesisRefs: [], linkedSourceRefs: [denue.sourceId], spatialMetrics: { unit: "METERS", method: "SpatialLayerEngine.getDistance", distanceMeters: 24 },
      temporalCompatibility: "COMPATIBLE", sourceIndependence: { status: "UNKNOWN", assessedSourceRefs: [denue.sourceId], independentSourceRefs: [], rationale: [] },
      lineage: denue.lineage, measuredFacts: [], proposedInterpretations: [], limitations: [{ code: "PROXIMITY_NOT_CAUSALITY" }, { code: "HUMAN_VALIDATION_REQUIRED" }],
      machineAssessment: { status: "DETECTED", reasonCodes: [] }, humanValidation: { status: "PENDING", validatedBy: null, validatedAt: null, rationale: null },
      publicationEligibility: "INELIGIBLE", methodologyVersion: "fixture-existing-contract" };
    const decision = assessDenueAnalyticalPublication({ baseRelation: relation, relation, ledger: null as any });
    expect(decision.eligible).toBe(false); expect(decision.reasons).toContain("HUMAN_VALIDATION_NOT_ACCEPTED:PENDING");
  });
  test("BLOCK: incompatible P5 audit despite recomputed seal", async () => {
    const x = setup(); x.base.generationContext.documentModel.semanticIntegrity.narrativeClaims[0].state = "PROSPECTIVE";
    x.base.generationContext.lineage = await buildInstitutionalPackageLineage(f.authorized, x.base.generationContext);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow("P5_DOCUMENT");
    expect(x.storage.writes).toEqual([]);
  });
  test("BLOCK: expediente identity inside input cannot be substituted", async () => {
    const x = setup(); x.base.generationContext.institutionalReportInput.expedienteId = "foreign";
    x.base.generationContext.lineage = await buildInstitutionalPackageLineage(f.authorized, x.base.generationContext);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow("IDENTITY_CONFLICT");
  });
  test("BLOCK: dataset A text / B chart", () => {
    const data = clone(f.data); data.visualProducts[0].provenance.datasetReference = { datasetId: "B" };
    expect(() => incidenceDocumentBasis(data)).toThrow("SNAPSHOT_MISMATCH");
  });
  test("BLOCK: geography A / visual B even with freshly computed client seals", async () => {
    const x = setup(); x.base.generationContext.principalTerritorialMapSpec.technicalMetadata.geographyId = "B";
    x.base.generationContext.lineage = await buildInstitutionalPackageLineage(f.authorized, x.base.generationContext);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow("P3_MAP");
  });
  test("BLOCK: missing provenance with freshly computed client seals", async () => {
    const x = setup(); delete x.base.generationContext.institutionalReportInput.evidence[0].lineage;
    x.base.generationContext.lineage = await buildInstitutionalPackageLineage(f.authorized, x.base.generationContext);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow("P2_INPUT");
  });
  test("BLOCK: caption altered after reservation", () => {
    const model = clone(f.context.documentModel); model.visualPlacements[0].caption += " ALTERADO";
    expect(() => renderExecutiveGeointWordDocument(model, { visualAssetsById: f.assets })).toThrow("VISUAL_DESCRIPTION_CHANGED");
  });
  test("BLOCK: annex content altered after reservation", () => {
    const model = clone(f.context.annexModel); model.sections[1].content.push("AFIRMACIÓN AJENA");
    expect(() => renderExecutiveGeointTechnicalAnnexWordDocument(model, { visualAssetsById: f.assets })).toThrow("ANNEX_CONTENT_CHANGED");
  });
  test("BLOCK: authz denial before persistence", async () => {
    const storage = new MemoryStorage(), repository = new MemoryRepository();
    const service = new InstitutionalReportPackageService(repository, storage, undefined, async () => { throw Error("ACCESS_DENIED"); });
    await expect(service.persistGeneratedPackage(f.base)).rejects.toThrow("ACCESS_DENIED"); expect(storage.writes).toHaveLength(0);
  });
  test("standalone institutional annex cannot download or emit GENERATED", async () => {
    await expect(exportToWord({ projectId: "exp" }, "Expediente", undefined, undefined, { exportMode: "INSTITUTIONAL", reportKind: "EXECUTIVE_GEOINT_TECHNICAL_ANNEX" })).rejects.toThrow("COMPLETE_PACKAGE_REQUIRED");
  });
  test("CTA is wired to authorized export and P5 preflight before render", () => {
    const ui = readFileSync(resolve("src/components/PhotoAlbum.tsx"), "utf8"), exporter = readFileSync(resolve("src/lib/exportToWord.ts"), "utf8");
    expect(ui).toContain("handleInstitutionalProductExport(institutionalProducts.actions.executiveReport.reportKind)");
    expect(exporter.indexOf("authorizedSource = await getAuthorizedInstitutionalReportSource")).toBeLessThan(exporter.indexOf("const generationContext = await buildInstitutionalGenerationContext"));
    expect(exporter).toContain("reconcileMaterializedDocument(generationContext.documentModel");
  });
  test("same complete fixture structurally equivalent across claims, models, visuals and sources", async () => {
    const second = await preP7Fixture();
    expect(second.context.documentModel).toEqual(f.context.documentModel); expect(second.context.executiveModel).toEqual(f.context.executiveModel);
    expect(second.context.annexModel).toEqual(f.context.annexModel); expect(second.context.lineage).toEqual(f.context.lineage);
  }, 180000);
  test("BLOCK: altered DOCX footer with updated declared hash", async () => {
    const x = setup(), zip = await JSZip.loadAsync(await x.base.reportBlob.arrayBuffer());
    const footer = Object.keys(zip.files).find(name => /^word\/footer\d+\.xml$/.test(name))!;
    expect(footer).toBeDefined();
    zip.file(footer, (await zip.file(footer)!.async("string")).replace("</w:ftr>", "<w:p><w:r><w:t>FOOTER ALTERADO</w:t></w:r></w:p></w:ftr>"));
    x.base.reportBlob = new Blob([await zip.generateAsync({ type: "arraybuffer" })]);
    x.base.pdfArtifacts.parity.sourceDocxHashes[0] = await sha256Blob(x.base.reportBlob);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow("P6_DOCX_BYTES"); expect(x.storage.writes).toEqual([]);
  }, 180000);
  test("BLOCK: altered PDF cannot use a self-declared PASS", async () => {
    const x = setup(); x.base.pdfArtifacts.executive = new Blob([await x.base.pdfArtifacts.executive.arrayBuffer(), "\n%ALTERED"]);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow("P6_PDF_BYTES"); expect(x.storage.writes).toEqual([]);
  }, 180000);
  test("BLOCK: document substitution despite a fresh client document fingerprint", async () => {
    const x = setup(); x.base.generationContext.documentModel.sections[1].content.push("NARRATIVA AJENA");
    x.base.generationContext.lineage = await buildInstitutionalPackageLineage(f.authorized, x.base.generationContext);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow("P5_DOCUMENT"); expect(x.storage.writes).toEqual([]);
  });
  test("epistemic roles survive composition without promotion", () => {
    const states = new Set(f.context.documentModel.semanticIntegrity.narrativeClaims.map((claim: any) => claim.state));
    for (const state of ["OBSERVED", "DERIVED", "HYPOTHESIS", "PROSPECTIVE", "LIMITATION"]) expect(states).toContain(state);
    expect(f.context.annexModel.technicalMetadata.semanticIntegrity).toBe(f.context.documentModel.semanticIntegrity);
  });
  test("first generation without an injected clock can be reconstructed at its reserved timestamp", async () => {
    const payload = await enrichInstitutionalPayloadWithCrimeIncidenceVisuals({ ...f.project, projectId: "exp", expedienteId: "exp", personaPerfiladora: f.authorized.actor.displayName });
    const first = await buildInstitutionalGenerationModels(payload, f.project.nombre, f.project.numeroExpediente, f.authorized.actor);
    const repeated = await buildInstitutionalGenerationModels(payload, f.project.nombre, f.project.numeroExpediente, f.authorized.actor, first.generatedAt);
    expect(first.institutionalReportInput.reportReadyAssessment.assessedAt).toBe(first.generatedAt);
    expect(repeated.documentModel).toEqual(first.documentModel); expect(repeated.institutionalReportInput).toEqual(first.institutionalReportInput);
  });
  test("controlled OSINT source change preserves unrelated hypothesis, incidence numbers and visual IDs", async () => {
    const project = clone(f.project); project.osint[0].summary = "Referencia documental revisada";
    const changed = await buildInstitutionalGenerationModels(await enrichInstitutionalPayloadWithCrimeIncidenceVisuals({ ...project, projectId: "exp", expedienteId: "exp", personaPerfiladora: f.authorized.actor.displayName }), project.nombre, project.numeroExpediente, f.authorized.actor, f.base.generatedAt);
    expect(changed.institutionalReportInput.hypothesis).toEqual(f.context.institutionalReportInput.hypothesis);
    const independent = (model: any) => model.semanticIntegrity.narrativeClaims.filter((claim: any) =>
      !["multisource-analysis", "executive-panorama"].includes(claim.sectionId));
    expect(independent(changed.documentModel)).toEqual(independent(f.context.documentModel));
    expect(changed.documentModel.semanticIntegrity!.numericAssertions.map(n => n.value)).toEqual(f.context.documentModel.semanticIntegrity.numericAssertions.map((n: any) => n.value));
    expect(changed.documentModel.visualPlacements.map(p => p.visualId)).toEqual(f.context.documentModel.visualPlacements.map((p: any) => p.visualId));
    expect(changed.institutionalReportInput.osint[0].summary).not.toEqual(f.context.institutionalReportInput.osint[0].summary);
    const analysis = changed.executiveModel.multisourceAnalysis.technicalMetadata.governedAnalysis!;
    const original = f.context.executiveModel.multisourceAnalysis.technicalMetadata.governedAnalysis;
    expect(analysis.convergences).toEqual(original.convergences); expect(analysis.contradictions).toEqual(original.contradictions);
    expect(analysis.limitations).toEqual(original.limitations);
  });
});
