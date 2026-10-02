import { readFileSync } from "fs";
import { resolve } from "path";
import ts from "typescript";
import { isCompleteInstitutionalReportPackage } from "../src/services/institutionalReportPackageService";

// Execute the actual isolated callbacks, without importing live SDKs or mounting
// unrelated PhotoAlbum providers. Generation/package internals are covered by P7.
const source = readFileSync(resolve("src/components/PhotoAlbum.tsx"), "utf8");
function callback(name: string, bindings: Record<string, any>) {
  const tree = ts.createSourceFile("PhotoAlbum.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let body = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && node.initializer && ts.isCallExpression(node.initializer)) body = node.initializer.arguments[0].getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree); if (!body) throw Error(`Missing production callback ${name}`);
  const js = ts.transpileModule(`const handler = ${body};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function("require", ...Object.keys(bindings), `${js}; return handler;`)(require, ...Object.values(bindings));
}
const manifest = () => JSON.parse(readFileSync(resolve("artifacts/P7-offline/CORRIDOR/manifest.json"), "utf8"));
const errors: any[] = [];
function generation(result: any) {
  const exportToWord = jest.fn(async (..._args: any[]) => result), update = jest.fn();
  const b: any = { institutionalGenerationInFlightRef: { current: false }, institutionalProducts: { readyForInstitutionalReport: true, numeroExpediente: "P7" },
    setShowReportPreflightModal: jest.fn(), setIsSavingAnalysis: jest.fn(), setError: (x: any) => errors.push(x), project: { id: "E2E-CORRIDOR" }, projectId: "E2E-CORRIDOR",
    user: {}, editableProfile: "", aiProfile: "", reportSummary: "", reportReadyAssessment: {}, album: [], documents: [], mapSnapshots: [], analysisResult: {}, analysisRadius: 10,
    buildInstitutionalProductExportPayload: jest.fn(() => ({ projectId: "E2E-CORRIDOR" })), enrichInstitutionalPayloadWithCrimeIncidenceVisuals: jest.fn(async (x: any) => x),
    exportToWord, buildInstitutionalProductExportOptions: () => ({ exportMode: "INSTITUTIONAL", reportKind: "EXECUTIVE_GEOINT" }),
    isCompleteInstitutionalReportPackage, setInstitutionalReportPackages: update, getReportPackageErrorDiagnostic: (e: Error) => ({ message: e.message }), setToast: jest.fn() };
  return { run: callback("handleInstitutionalProductExport", b), exportToWord, update };
}
beforeEach(() => { errors.length = 0; });
test("canonical CTA executes the existing exporter with ALL formats and accepts one complete package", async () => {
  const m = manifest(), f = generation(m); await f.run("EXECUTIVE_GEOINT");
  expect(f.exportToWord).toHaveBeenCalledTimes(1); expect(f.exportToWord.mock.calls[0][4]).toMatchObject({ downloadFormat: "ALL", exportMode: "INSTITUTIONAL" });
  expect(f.update).toHaveBeenCalledTimes(1); expect(f.update.mock.calls[0][0]([])).toEqual([m]);
  expect(source).toContain("handleInstitutionalProductExport(institutionalProducts.actions.executiveReport.reportKind)");
});
test.each(["executiveReport", "technicalAnnex", "executivePdf", "technicalAnnexPdf"])("CTA rejects missing %s before presenting a complete package", async key => {
  const m = manifest(); delete m.artifacts[key]; const f = generation(m); await f.run("EXECUTIVE_GEOINT");
  expect(f.update).not.toHaveBeenCalled(); expect(errors).toContain("REPORT_PACKAGE_COMPLETE_PRODUCT_REQUIRED");
});
test("two-DOCX legacy output cannot be presented as an institutional GENERATED package", async () => {
  const m = manifest(); delete m.formatContract; delete m.artifacts.executivePdf; delete m.artifacts.technicalAnnexPdf;
  const f = generation(m); await f.run("EXECUTIVE_GEOINT"); expect(f.update).not.toHaveBeenCalled();
  expect(source).toContain('"LEGACY · 2 DOCX"'); expect(source).toContain("{isCompleteInstitutionalReportPackage(item) && (");
});
test("history callback saves all four artifacts from the same downloaded manifest", async () => {
  const m = manifest(), blobs = [new Blob(["a"]),new Blob(["b"]),new Blob(["c"]),new Blob(["d"])], save = jest.fn();
  const result = { manifest: m, executiveReport: blobs[0], technicalAnnex: blobs[1], executivePdf: blobs[2], technicalAnnexPdf: blobs[3] };
  // Replace only the dynamic UI save dependency in this callback's compilation.
  const downloadPackage = jest.fn(async () => result);
  const download = callback("handleDownloadInstitutionalPackage", { isCompleteInstitutionalReportPackage, institutionalReportPackageService: { downloadPackage },
    setIsLoadingInstitutionalReportHistory: jest.fn(), setError: jest.fn() });
  // file-saver is mocked below; the production callback imports it normally.
  const saver = require("file-saver").saveAs; saver.mockImplementation(save);
  await download(m); expect(save).toHaveBeenCalledTimes(4);
  expect(downloadPackage).toHaveBeenCalledWith(m.projectId,m.packageId);
  const keys = ["executiveReport","technicalAnnex","executivePdf","technicalAnnexPdf"];
  keys.forEach((key,i) => expect(save).toHaveBeenNthCalledWith(i+1,blobs[i],m.artifacts[key].filename));
  expect(m.packageId).toBeTruthy(); expect(m.version).toBe(1); expect(source).not.toContain("new InstitutionalReportPackageService");
});
test.each(["executivePdf", "technicalAnnexPdf"])("history saves nothing when downloaded %s is missing", async key => {
  const m = manifest(), result: any = { manifest: m, executiveReport: new Blob(["a"]), technicalAnnex: new Blob(["b"]), executivePdf: new Blob(["c"]), technicalAnnexPdf: new Blob(["d"]) };
  delete result[key]; const error = jest.fn(), saver = require("file-saver").saveAs; saver.mockClear();
  const download = callback("handleDownloadInstitutionalPackage", { isCompleteInstitutionalReportPackage, institutionalReportPackageService: { downloadPackage: jest.fn(async () => result) }, setIsLoadingInstitutionalReportHistory: jest.fn(), setError: error });
  await download(m); expect(saver).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledWith("REPORT_PACKAGE_COMPLETE_PRODUCT_REQUIRED");
});
jest.mock("file-saver", () => ({ saveAs: jest.fn() }));

jest.mock("@/lib/institutionalReportSourceActions", () => ({ getAuthorizedInstitutionalReportSource: jest.fn() }));
jest.mock("@/lib/scinceDocumentActions", () => ({ getScinceDocumentContext: jest.fn() }));
