jest.mock("server-only", () => ({}), { virtual: true });
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { Packer } from "docx";
import JSZip from "jszip";
import { webcrypto } from "crypto";
import { p6Fixture } from "./p6InstitutionalFixture";
import { renderInstitutionalPdfFromDocx, institutionalAnnexRequiredVisualIds, type InstitutionalPdfTrace } from "../src/utils/institutionalPdfRenderer";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const types = ["INDIVIDUAL", "CORRIDOR", "POLYGON"] as const;
const results: any[] = [];
beforeAll(async () => {
  for (const type of types) {
    const f = p6Fixture(type);
    const trace = (kind: "EXECUTIVE_REPORT" | "TECHNICAL_ANNEX", renderer: any, documentModel: any): InstitutionalPdfTrace => ({ kind,
      projectId: f.data.projectId, numeroExpediente: f.document.identity.numeroExpediente, documentModel,
      semanticIntegrity: f.document.semanticIntegrity, requiredVisualIds: kind === "EXECUTIVE_REPORT" ? f.document.semanticIntegrity!.requiredVisualIds : institutionalAnnexRequiredVisualIds(f.annex,f.document.semanticIntegrity!.requiredVisualIds),
      renderedVisualIds: renderer.renderAudit.renderedVisualIds, missingVisualAssetIds: renderer.renderAudit.missingVisualAssetIds,
      state: "GENERATED", certified: false, published: false });
    const docx = await Packer.toBuffer(f.word.document), annexDocx = await Packer.toBuffer(f.annexWord.document);
    const pdf = await renderInstitutionalPdfFromDocx(docx, trace("EXECUTIVE_REPORT", f.word, f.document));
    const annexPdf = await renderInstitutionalPdfFromDocx(annexDocx, trace("TECHNICAL_ANNEX", f.annexWord, f.annex));
    results.push({ type, ...f, docx, annexDocx, pdf, annexPdf });
    if (process.env.P6_WRITE_FIXTURES === "1") {
      const dir = resolve("artifacts/P6-offline", type); mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, "executive.docx"), docx); writeFileSync(resolve(dir, "annex.docx"), annexDocx);
      writeFileSync(resolve(dir, "executive.pdf"), Buffer.from(await pdf.blob.arrayBuffer()));
      writeFileSync(resolve(dir, "annex.pdf"), Buffer.from(await annexPdf.blob.arrayBuffer()));
      writeFileSync(resolve(dir, "parity.json"), JSON.stringify({ fixture: type, executive: pdf.parity, annex: annexPdf.parity, input: f.data, document: f.document, technicalAnnex: f.annex }, null, 2));
    }
  }
// Six real DOCX/PDF conversions share this aggregate setup on the Windows host.
// Keep the composition/parity assertions unchanged and give setup a bounded budget.
}, 600000);

describe("P6 governed DOCX/PDF composition offline", () => {
  test.each(types)("%s renders executive and annex from actual institutional OOXML", type => {
    const result = results.find(r => r.type === type); expect(result.pdf.parity.status).toBe("PASS"); expect(result.annexPdf.parity.status).toBe("PASS");
  });
  test.each(["projectId", "numeroExpediente", "state", "certified", "published"])("both PDFs share governed %s", key => {
    for (const r of results) expect(r.pdf.trace[key]).toEqual(r.annexPdf.trace[key]);
  });
  test.each(["identity", "sections", "visualPlacements", "semanticIntegrity", "technicalMetadata"])("executive PDF preserves whole %s", key => {
    for (const r of results) expect(r.pdf.trace.documentModel[key]).toEqual(r.document[key]);
  });
  test.each(["identity", "sections", "executiveReportReference", "technicalMetadata"])("annex PDF preserves whole %s", key => {
    for (const r of results) expect(r.annexPdf.trace.documentModel[key]).toEqual(r.annex[key]);
  });
  test.each(types)("%s keeps every rendered visual ID and mandatory map", type => {
    const r = results.find(x => x.type === type); expect(r.pdf.parity.visualIds.sort()).toEqual([...r.word.renderAudit.renderedVisualIds].sort());
    expect(r.pdf.parity.visualIds).toContain("principal-territorial-map");
  });
  test.each(types)("%s LETTER portrait contract", type => {
    const r = results.find(x => x.type === type); for (const p of [r.pdf, r.annexPdf]) { expect(p.parity.format).toBe("LETTER"); expect(p.parity.orientation).toBe("PORTRAIT"); }
  });
  test.each(types)("%s source hashes bind PDF to exact executive and annex DOCX", type => {
    const r = results.find(x => x.type === type); expect(r.pdf.parity.sourceDocxSha256).toMatch(/^sha256:[a-f0-9]{64}$/); expect(r.annexPdf.parity.sourceDocxSha256).not.toBe(r.pdf.parity.sourceDocxSha256);
    expect(r.pdf.parity.pdfSha256).toMatch(/^sha256:[a-f0-9]{64}$/); expect(r.annexPdf.parity.pdfSha256).not.toBe(r.pdf.parity.pdfSha256);
  });
  test.each(["initial-hypothesis", "territorial-situation", "key-evidence", "multisource-analysis", "decision-implications"])("PDF retains actual %s heading and all paragraphs", id => {
    for (const r of results) { const section=r.document.sections.find((s:any)=>s.sectionId===id); if(section.status==="OPTIONAL_SUPPRESSED") expect(r.pdf.parity.textBlocks.join(" ")).not.toContain(section.title.toUpperCase()); else expect(r.pdf.parity.textBlocks.join(" ")).toContain(section.title.toUpperCase()); }
  });
  test.each(["SCINCE", "DENUE", "OSINT", "incidencia"])("PDF annex preserves %s source", term => {
    expect(results[0].annexPdf.parity.textBlocks.join(" ").toLowerCase()).toContain(term.toLowerCase());
  });
  test.each(["CORRIDOR", "POLYGON"])("%s declares absent SCINCE", type => {
    const r=results.find(x=>x.type===type); expect(r.data.scinceContext.snapshot).toBeNull(); expect(r.data.scinceContext.reason).toContain("ausente declarado");
  });
  test("individual preserves admitted SCINCE census", () => expect(results[0].annexPdf.parity.textBlocks.join(" ")).toContain("98765"));
  test.each(["photo", "street-view"])("both formats preserve %s exact image", id => { for(const r of results) expect(r.annexPdf.parity.visualIds).toContain(id); });
  test("missing required visual fails closed", async () => { const r=results[0]; await expect(renderInstitutionalPdfFromDocx(r.docx,{...r.pdf.trace,requiredVisualIds:["absent"]})).rejects.toThrow("VISUAL_PARITY"); });
  test("unavailable required image fails closed", async () => { const r=results[0]; await expect(renderInstitutionalPdfFromDocx(r.docx,{...r.pdf.trace,missingVisualAssetIds:["principal-territorial-map"]})).rejects.toThrow("VISUAL_PARITY"); });
  test.each(["certified", "published"])("generation cannot declare %s", async key => { const r=results[0]; await expect(renderInstitutionalPdfFromDocx(r.docx,{...r.pdf.trace,[key]:true})).rejects.toThrow("GENERATED_IDENTITY"); });
  test("A4 landscape cannot be institutional", async () => { const r=results[0],zip=await JSZip.loadAsync(r.docx); zip.file("word/document.xml",(await zip.file("word/document.xml")!.async("string")).replace('w:w="12240"','w:w="16838"')); await expect(renderInstitutionalPdfFromDocx(await zip.generateAsync({type:"uint8array"}),r.pdf.trace)).rejects.toThrow("LETTER_PORTRAIT"); });
  test("renderer has no legacy briefing or provider query",()=> {const source=readFileSync(resolve("src/utils/institutionalPdfRenderer.ts"),"utf8"); expect(source).not.toMatch(/IntelligenceBriefing|fetch\(|getDoc\(|A4/);});
  test.each(["OBSERVED","DERIVED","HYPOTHESIS","PROSPECTIVE","LIMITATION","HUMAN_VALIDATED_RELATION"])("actual PDF retains %s claim state", state=>{
    const r=results[0],claims=r.pdf.trace.semanticIntegrity.narrativeClaims;expect(claims.some((c:any)=>c.state===state)).toBe(true);
    expect(r.annexPdf.trace.semanticIntegrity.narrativeClaims).toEqual(claims);
  });
  test("approved PPC convergence coexists with unresolved contradiction",()=>{
    const r=results[0];expect(r.executive.multisourceAnalysis.convergencias.length).toBeGreaterThan(0);expect(r.executive.multisourceAnalysis.contradicciones.length).toBeGreaterThan(0);
    expect(r.pdf.parity.textBlocks.join(" ")).toContain("Convergencia");expect(r.pdf.parity.textBlocks.join(" ")).toContain("Contradiccion");
  });
  test.each(["projectId","numeroExpediente"])("incompatible trace %s fails closed",async key=>{const r=results[0];await expect(renderInstitutionalPdfFromDocx(r.docx,{...r.pdf.trace,[key]:"OTHER"})).rejects.toThrow("IDENTITY_PARITY");});
  test("DOCX emits native keepNext for image and caption grouping",async()=>{
    const zip=await JSZip.loadAsync(results[0].docx),xml=await zip.file("word/document.xml")!.async("string");
    const imageParagraphs=xml.match(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*<\/w:p>/g)!.filter(p=>p.includes("principal-territorial-map") || p.includes('title="photo"'));
    expect(imageParagraphs.length).toBeGreaterThan(0);for(const p of imageParagraphs)expect(p).toContain("w:keepNext");
  });
});
