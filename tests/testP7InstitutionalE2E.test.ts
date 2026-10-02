import { p7Fixture, p7StoredProject, type P7Mode } from "./helpers/p7InstitutionalFixture";
import { MemoryRepository, MemoryStorage } from "./helpers/institutionalPackageMemory";
import { InstitutionalReportPackageService, buildInstitutionalPackageLineage, sha256Blob, isCompleteInstitutionalReportPackage } from "../src/services/institutionalReportPackageService";
import { resolveAuthorizedInstitutionalReportSource } from "../src/services/institutionalReportSourceService";
import { renderExecutiveGeointWordDocument } from "../src/utils/executiveGeointWordRenderer";
import { reconcileMaterializedDocument, incidenceDocumentBasis } from "../src/utils/institutionalDocumentSemanticIntegrity";
import { excludedScinceDocumentContext } from "../src/utils/scinceDocumentContext";
import { readDocx, renderInstitutionalPdfFromDocx } from "../src/utils/institutionalPdfRenderer";
import { buildCrimeIncidenceInstitutionalVisualProduct } from "../src/utils/crimeIncidenceInstitutionalVisualAdapter";
import { evaluateScinceSnapshotFreshness } from "../src/utils/scinceCanonicalSnapshot";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import JSZip from "jszip";

jest.setTimeout(180000);
const modes: P7Mode[] = ["INDIVIDUAL", "CORRIDOR", "POLYGON"];
const fixtures: Awaited<ReturnType<typeof p7Fixture>>[] = [];
const evidence: any[] = [];
const clone = <T>(x: T): T => structuredClone(x);
const artifactRoot = process.env.P7_ARTIFACT_ROOT || "artifacts/P7-offline";
const writeFixture = (mode: P7Mode) => process.env.P7_WRITE_FIXTURES === "1" && (!process.env.P7_WRITE_MODE || process.env.P7_WRITE_MODE === mode);
beforeAll(async () => { if (process.env.P7_WRITE_FIXTURES === "1") mkdirSync(resolve(artifactRoot), { recursive: true }); for (const mode of modes) fixtures.push(await p7Fixture(mode)); });
afterAll(() => {
  if (process.env.P7_WRITE_FIXTURES === "1") writeFileSync(resolve(artifactRoot, "e2e-evidence.json"), JSON.stringify(evidence, null, 2));
});
function fresh(f = fixtures[0]) {
  const repository = new MemoryRepository(), storage = new MemoryStorage();
  return { repository, storage, service: new InstitutionalReportPackageService(repository, storage, () => "2026-10-02T00:00:00.000Z", f.acquireSource),
    base: { ...f.base, generationContext: clone(f.context), pdfArtifacts: { ...f.base.pdfArtifacts, parity: clone(f.base.pdfArtifacts.parity) } } };
}

describe("P7 complete institutional E2E offline", () => {
  test.each(modes)("%s P2→P4→P3→P5→P6→persist→reload→download→verify", async mode => {
    const f = fixtures.find(x => x.mode === mode)!, x = fresh(f);
    const manifest = await x.service.persistGeneratedPackage(x.base);
    expect(manifest.state).toBe("GENERATED"); expect(isCompleteInstitutionalReportPackage(manifest)).toBe(true);
    expect(x.storage.writes).toHaveLength(4); expect(Object.keys(manifest.artifacts)).toHaveLength(4);
    expect(manifest.projectId).toBe(`E2E-${mode}`); expect(manifest.lineage.contract.expedienteId).toBe(f.project.id);
    expect(manifest.lineage.contract).toEqual(f.context.lineage); expect(manifest.version).toBe(1);
    const reloaded = JSON.parse(JSON.stringify(await x.repository.get(manifest.projectId, manifest.packageId)));
    const reopenedRepository = new MemoryRepository(), reopenedStorage = new MemoryStorage();
    reopenedRepository.records.set(`${manifest.projectId}/${manifest.packageId}`, reloaded);
    for (const [path, item] of x.storage.objects) reopenedStorage.objects.set(path, { blob: new Blob([await item.blob.arrayBuffer()]), sha256: item.sha256 });
    const reopenedService = new InstitutionalReportPackageService(reopenedRepository, reopenedStorage, undefined, f.acquireSource);
    const downloaded = await reopenedService.downloadPackage(manifest.projectId, manifest.packageId);
    const pairs = [["executiveReport", "executive.docx"], ["technicalAnnex", "annex.docx"], ["executivePdf", "executive.pdf"], ["technicalAnnexPdf", "annex.pdf"]] as const;
    const dir = resolve(artifactRoot, mode);
    if (writeFixture(mode)) mkdirSync(dir, { recursive: true });
    for (const [key, filename] of pairs) {
      const artifact = reloaded.artifacts[key], blob = downloaded[key]!;
      expect(artifact.state).toBe("STORED"); expect(await sha256Blob(blob)).toBe(artifact.sha256);
      expect(blob.size).toBe(artifact.sizeBytes); expect(Buffer.from(await blob.arrayBuffer()).equals(Buffer.from(await x.storage.get(artifact.storagePath).then(b => b.arrayBuffer())))).toBe(true);
      if (writeFixture(mode)) writeFileSync(resolve(dir, filename), Buffer.from(await blob.arrayBuffer()));
    }
    expect(downloaded.manifest).toEqual(reloaded);
    expect(await reopenedService.listPackages(manifest.projectId)).toEqual([reloaded]);
    const doc = await readDocx(new Uint8Array(await downloaded.executiveReport.arrayBuffer()));
    expect(JSON.stringify(doc)).toContain(f.project.numeroExpediente);
    expect(f.executivePdf.parity.status).toBe("PASS"); expect(f.annexPdf.parity.status).toBe("PASS");
    expect(f.context.documentModel.semanticIntegrity.status).toBe("RECONCILED");
    expect(f.context.institutionalReportInput.multisourceAnalysis).toEqual(f.context.executiveModel.multisourceAnalysis.technicalMetadata.governedAnalysis);
    evidence.push({ mode, manifest, reloadVerified: true, fourDownloadsVerified: true, hashesVerified: true });
    if (writeFixture(mode)) {
      writeFileSync(resolve(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
      writeFileSync(resolve(dir, "persisted-project.json"), JSON.stringify(f.persisted, null, 2));
      writeFileSync(resolve(dir, "parity.json"), JSON.stringify({ fixture: mode, executive: f.executivePdf.parity, annex: f.annexPdf.parity,
        input: f.context.institutionalReportInput, document: f.context.documentModel, technicalAnnex: f.context.annexModel,
        mapSpec: f.context.principalTerritorialMapSpec }, null, 2));
    }
  });
  test("fixtures have independent project/expediente/number/geography/source identities", () => {
    for (const select of [(f: any) => f.project.id, (f: any) => f.project.expedienteId, (f: any) => f.project.numeroExpediente,
      (f: any) => f.project.canonicalGeography.geographyId, (f: any) => f.project.evidence[0].evidenceId,
      (f: any) => f.project.crimeIncidenceExportContract.datasetReference.datasetId]) expect(new Set(fixtures.map(select)).size).toBe(3);
  });
  test.each(modes)("%s PRE-P8 source-fact distinction survives both DOCX and PDF models", async mode => {
    const f = fixtures.find(x => x.mode === mode)!;
    const full = "ConvergenceResult es DERIVED_RELATION y no hecho fuente.";
    const raw = "ConvergenceResult es DERIVED_RELATION y no SOURCE_FACT.";
    expect(f.context.executiveModel.multisourceAnalysis.technicalMetadata.governedAnalysis.limitations).toContain(raw);
    for (const blob of [f.base.reportBlob, f.base.annexBlob]) {
      const text = JSON.stringify(await readDocx(new Uint8Array(await blob.arrayBuffer())));
      expect(text).toContain(full); expect(text).not.toContain("ConvergenceResult es DERIVED_RELATION y no .");
    }
    for (const pdf of [f.executivePdf, f.annexPdf]) {
      expect(pdf.parity.textBlocks.join(" ")).toContain(full);
      expect(pdf.parity.textBlocks.join(" ")).not.toContain("ConvergenceResult es DERIVED_RELATION y no .");
    }
    const claims = f.context.documentModel.semanticIntegrity.narrativeClaims;
    expect(claims.some((c: any) => JSON.stringify(c).includes("DERIVED_RELATION") && c.state === "LIMITATION")).toBe(true);
  });
  test.each(modes)("%s map raster declares the exact complete canonical geometry", mode => {
    const f = fixtures.find(x => x.mode === mode)!;
    const geometry = JSON.parse(readFileSync(resolve("tests/fixtures/p7/map-geometries.json"), "utf8"))[mode];
    expect(f.context.institutionalReportInput.geography.geometry).toEqual(geometry);
    expect(f.context.principalTerritorialMapSpec.geometryType).toEqual(geometry.type);
    const paths = mode === "INDIVIDUAL" ? [] : mode === "CORRIDOR" ? [geometry.coordinates] : geometry.coordinates;
    expect(f.context.principalTerritorialMapSpec.paths).toEqual(paths.map((p: number[][]) => p.map(([lng, lat]) => ({ lat, lng }))));
    if (mode === "CORRIDOR") expect(geometry.coordinates).toHaveLength(3);
    if (mode === "POLYGON") expect(geometry.coordinates).toHaveLength(2);
  });
  test.each(modes)("%s human initial/current/history, convergence, contradiction, limitation retained", mode => {
    const f = fixtures.find(x => x.mode === mode)!, text = f.annexPdf.parity.textBlocks.join(" ");
    expect(f.project.canonicalHypothesis.authorType).toBe("HUMAN"); expect(f.project.canonicalHypothesis.history).toHaveLength(2);
    expect(text).toContain(`Hipótesis humana inicial ${mode}`); expect(text).toContain(`Hipótesis humana vigente ${mode}`);
    const multi = f.context.executiveModel.multisourceAnalysis;
    expect(multi.convergencias.length).toBeGreaterThan(0); expect(multi.contradicciones.length).toBeGreaterThan(0); expect(multi.technicalMetadata.governedAnalysis.limitations.length).toBeGreaterThan(0);
    expect(f.context.documentModel.semanticIntegrity.narrativeClaims.length).toBeGreaterThan(0);
    expect(f.context.documentModel.semanticIntegrity.sourceAssertions.length).toBeGreaterThan(0);
    expect(f.context.institutionalReportInput.osint).toHaveLength(1); expect(text).not.toContain("IntelligenceBriefing");
    expect(text).toContain("DENUE"); expect(text).toContain("CEFI - FUENTES ABIERTAS"); expect(text).toContain(f.ids.get("osint"));
    expect(f.project.sweeps[0].evidenceIds).toContain(f.project.evidence[0].evidenceId);
  });
  test.each(modes)("%s cited map BAR LINE photo Street View visible in both artifact models", mode => {
    const f = fixtures.find(x => x.mode === mode)!;
    const ids = ["principal-territorial-map", f.ids.get("photo"), f.ids.get("street-view"), ...f.context.institutionalReportInput.visualProducts.filter((v: any) => /DISTRIBUTION|EVOLUTION/.test(v.kind)).map((v: any) => v.visualId)];
    for (const id of ids) { expect(f.executivePdf.parity.visualIds).toContain(id); expect(f.annexPdf.parity.visualIds).toContain(id); }
    expect(f.context.documentModel.semanticIntegrity.numericAssertions.map((n: any) => n.value)).toContain("4");
    expect(f.context.institutionalReportInput.visualProducts.filter((v: any) => /DISTRIBUTION|EVOLUTION/.test(v.kind))).toHaveLength(2);
    expect(f.context.institutionalReportInput.exclusions.filter((e: any) => e.reasonCode === "VISUAL_PRODUCT_WITHOUT_ELIGIBLE_LINKAGE")).toEqual([]);
  });
  test.each(modes)("%s deterministic claims/convergences/contradictions/limitations/visuals/numbers/sources/sections", async mode => {
    const f = fixtures.find(x => x.mode === mode)!, repeated = await p7Fixture(mode);
    expect(repeated.context.documentModel).toEqual(f.context.documentModel);
    expect(repeated.context.executiveModel).toEqual(f.context.executiveModel);
    expect(repeated.context.annexModel).toEqual(f.context.annexModel);
    expect(repeated.context.lineage).toEqual(f.context.lineage);
  });
  test("INDIVIDUAL admits CURRENT SCINCE bound to its project/geography", () => {
    expect(fixtures[0].context.institutionalReportInput.scinceContext.territorialFreshness).toBe("CURRENT");
    expect(evaluateScinceSnapshotFreshness({ snapshot: fixtures[0].project.scinceContext.snapshot,
      currentCanonicalGeography: fixtures[0].project.canonicalGeography, expectedProjectId: fixtures[0].project.id }).territorialFreshness).toBe("CURRENT");
    expect(fixtures[0].annexPdf.parity.textBlocks.join(" ")).toContain("98765");
  });
  test.each(["CORRIDOR", "POLYGON"])("%s declares absent SCINCE without census extrapolation", mode => {
    const f = fixtures.find(x => x.mode === mode)!;
    expect(f.context.institutionalReportInput.scinceContext.snapshot).toBeNull();
    expect(f.annexPdf.parity.textBlocks.join(" ")).toContain("ausente declarado");
    expect(f.annexPdf.parity.textBlocks.join(" ")).not.toContain("98765");
  });
  test("AUTHZ denial stops P2 before source read and package before storage", async () => {
    const readProject = jest.fn();
    await expect(resolveAuthorizedInstitutionalReportSource({ projectId: "E2E-INDIVIDUAL", sessionToken: "offline-fixture-session" },
      { authorize: (async () => ({ allowed: false, code: "PROJECT_ACCESS_DENIED" })) as any, readProject })).rejects.toThrow("ACCESS_DENIED");
    expect(readProject).not.toHaveBeenCalled(); const x = fresh();
    const denied = new InstitutionalReportPackageService(x.repository, x.storage, undefined, async () => { throw Error("GENERATE_REPORT_DENIED"); });
    await expect(denied.persistGeneratedPackage(x.base)).rejects.toThrow("DENIED"); expect(x.storage.writes).toEqual([]);
  });
  test.each(["photo", "street-view"])("required %s invalid/missing blocks before persistence", async id => {
    const x = fresh(), key = fixtures[0].ids.get(id)!;
    x.base.generationContext.visualAssetsById[key] = id === "photo" ? { data: new Uint8Array([1, 2, 3]), type: "png" } : null;
    expect(() => reconcileMaterializedDocument(x.base.generationContext.documentModel, x.base.generationContext.visualAssetsById)).toThrow("NOT_RENDERED");
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow(); expect(x.storage.writes).toEqual([]);
  });
  test("SCINCE STALE traverses generation/package as exclusion and visible limitation", async () => {
    const f = await p7Fixture("INDIVIDUAL", p => { p.scinceContext = excludedScinceDocumentContext("STALE", "SCINCE: geografía cambió; snapshot excluido."); });
    expect(f.context.institutionalReportInput.scinceContext.snapshot).toBeNull();
    expect(f.annexPdf.parity.textBlocks.join(" ")).not.toContain("98765");
    expect(f.annexPdf.parity.textBlocks.join(" ")).toContain("snapshot excluido");
    expect((await f.service.persistGeneratedPackage(f.base)).state).toBe("GENERATED");
  });
  test("OSINT MOCK traverses generation/package without published mock source", async () => {
    const f = await p7Fixture("INDIVIDUAL", p => { p.osint[0].acquisitionMode = "MOCK"; p.osint[0].epistemicIntegrity.acquisitionMode = "MOCK"; });
    expect(f.context.institutionalReportInput.osint).toEqual([]);
    expect(f.annexPdf.parity.textBlocks.join(" ")).not.toContain("Registro OSINT admitido");
    expect((await f.service.persistGeneratedPackage(f.base)).state).toBe("GENERATED");
  });
  test("unapproved DENUE relationship cannot enter complete generated package", async () => {
    const f = await p7Fixture("INDIVIDUAL", p => { p.denueAnalyticalRelations = [{ relationId: "P7-pending", humanValidation: { status: "PENDING" }, publicationEligibility: "INELIGIBLE" }]; });
    expect(f.context.institutionalReportInput.denueAnalyticalDocument.status).not.toBe("AVAILABLE");
    expect(f.annexPdf.parity.textBlocks.join(" ")).not.toContain("P7-pending");
    expect((await f.service.persistGeneratedPackage(f.base)).state).toBe("GENERATED");
  });
  test("dataset mismatch after reservation blocks package even with refreshed seals", async () => {
    const x = fresh(); x.base.generationContext.institutionalReportInput.visualProducts[0].provenance.datasetReference = "foreign-dataset";
    expect(() => incidenceDocumentBasis(x.base.generationContext.institutionalReportInput)).toThrow("SNAPSHOT_MISMATCH");
    x.base.generationContext.lineage = await buildInstitutionalPackageLineage(fixtures[0].authorized, x.base.generationContext);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow("P2_INPUT"); expect(x.storage.writes).toEqual([]);
  });
  test.each(["geography", "project", "expediente", "provenance", "incomplete", "pdf-preflight"])("%s mismatch blocks package before reservation", async kind => {
    const x = fresh();
    if (kind === "geography") x.base.generationContext.principalTerritorialMapSpec.technicalMetadata.geographyId = "foreign";
    if (kind === "project") x.base.projectId = "foreign";
    if (kind === "expediente") x.base.numeroExpediente = "foreign";
    if (kind === "provenance") delete x.base.generationContext.institutionalReportInput.evidence[0].lineage;
    if (kind === "incomplete") x.base.pdfArtifacts.annex = null as any;
    if (kind === "pdf-preflight") x.base.pdfArtifacts.parity.status = "FAILED" as any;
    x.base.generationContext.lineage = await buildInstitutionalPackageLineage(fixtures[0].authorized, x.base.generationContext);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow(); expect(x.storage.writes).toEqual([]); expect(x.repository.records.size).toBe(0);
  });
  test("caption altered after semantic reservation blocks final renderer and package", async () => {
    const x = fresh(); x.base.generationContext.documentModel.visualPlacements[0].caption += " ALTERADO";
    expect(() => renderExecutiveGeointWordDocument(x.base.generationContext.documentModel, { visualAssetsById: fixtures[0].assets })).toThrow("VISUAL_DESCRIPTION_CHANGED");
    x.base.generationContext.lineage = await buildInstitutionalPackageLineage(fixtures[0].authorized, x.base.generationContext);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow(); expect(x.storage.writes).toEqual([]);
  });
  test("PDF storage failure records FAILED, preserves stored DOCX and prevents download", async () => {
    const x = fresh(), original = x.storage.storeImmutable.bind(x.storage);
    x.storage.storeImmutable = async (path, blob, metadata) => { if (path.endsWith(".pdf")) throw Error("P7_PDF_STORAGE_FAILURE"); return original(path, blob, metadata); };
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow();
    const manifest = [...x.repository.records.values()][0]; expect(manifest.state).toBe("FAILED");
    expect(manifest.artifacts.executiveReport.state).toBe("STORED"); expect(manifest.artifacts.technicalAnnex.state).toBe("STORED");
    expect(isCompleteInstitutionalReportPackage(manifest)).toBe(false);
    await expect(x.service.downloadPackage(manifest.projectId, manifest.packageId)).rejects.toThrow("NOT_DOWNLOADABLE");
  });
  test.each(["executiveReport", "technicalAnnex", "executivePdf", "technicalAnnexPdf"])("download rejects %s hash tampering after reopening", async key => {
    const x = fresh(), manifest = await x.service.persistGeneratedPackage(x.base);
    const artifact = (manifest.artifacts as any)[key]; x.storage.objects.set(artifact.storagePath, { blob: new Blob(["altered"]), sha256: artifact.sha256 });
    await expect(x.service.downloadPackage(manifest.projectId, manifest.packageId)).rejects.toThrow("INTEGRITY_VIOLATION");
  });
  test("modified physical DOCX cannot use freshly declared source hash", async () => {
    const x = fresh(), zip = await JSZip.loadAsync(await x.base.reportBlob.arrayBuffer());
    zip.file("word/document.xml", (await zip.file("word/document.xml")!.async("string")).replace("Número de expediente:", "Identidad adulterada:"));
    x.base.reportBlob = new Blob([await zip.generateAsync({ type: "arraybuffer" })]); x.base.pdfArtifacts.parity.sourceDocxHashes[0] = await sha256Blob(x.base.reportBlob);
    await expect(x.service.persistGeneratedPackage(x.base)).rejects.toThrow("P6_DOCX_BYTES"); expect(x.storage.writes).toEqual([]);
  });
  test("incidence adapter cannot replace declared geography with canonical geography", () => {
    const f = fixtures[0], product = f.context.institutionalReportInput.visualProducts.find((v: any) => v.kind === "INCIDENT_TYPE_DISTRIBUTION");
    expect(() => buildCrimeIncidenceInstitutionalVisualProduct({ visualId: product.visualId, kind: product.kind, dataUrl: product.assetRef,
      title: product.title, caption: product.caption, metadata: { ...product.provenance, geography: { expediente: { geographyId: "foreign" } } } } as any,
      { canonicalGeography: f.project.canonicalGeography })).toThrow("GEOGRAPHY_MISMATCH");
  });
  test("PDF physical validation is stable under equivalent trace object key ordering", async () => {
    const f = fixtures[0];
    function reorder(value: any): any {
      if (Array.isArray(value)) return value.map(reorder);
      if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).reverse().map(key => [key, reorder(value[key])]));
      return value;
    }
    const repeated = await renderInstitutionalPdfFromDocx(new Uint8Array(await f.base.reportBlob.arrayBuffer()), reorder(f.executivePdf.trace));
    expect(repeated.parity.pdfSha256).toBe(f.executivePdf.parity.pdfSha256);
  });
});
