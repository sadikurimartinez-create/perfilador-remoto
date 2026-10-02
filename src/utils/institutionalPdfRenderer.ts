import JSZip from "jszip";
import { xml2js, type Element } from "xml-js";
import { jsPDF } from "jspdf";
import { assertReconciledDocumentSemanticAudit, canonicalSemanticValue, type DocumentSemanticAudit } from "./institutionalDocumentSemanticIntegrity";

type ParagraphBlock = { kind: "PARAGRAPH"; text: string; size: number; bold: boolean; color: string; align: string; before: number; after: number; keepNext: boolean };
type ImageBlock = { kind: "IMAGE"; data: Uint8Array; format: "PNG" | "JPEG"; width: number; height: number; visualId: string; sha256: string; row?: { id: string; index: number; count: number } };
type TableBlock = { kind: "TABLE"; widths: number[]; rows: Array<{ header: boolean; cells: Array<{ blocks: DocumentBlock[]; fill: string }> }> };
type DocumentBlock = ParagraphBlock | ImageBlock | TableBlock | { kind: "PAGE_BREAK" };
export interface InstitutionalPdfTrace {
  kind: "EXECUTIVE_REPORT" | "TECHNICAL_ANNEX";
  projectId: string;
  numeroExpediente: string;
  documentModel: unknown;
  semanticIntegrity: unknown;
  requiredVisualIds: string[];
  renderedVisualIds: string[];
  missingVisualAssetIds: string[];
  state: "GENERATED";
  certified: false;
  published: false;
}
export interface InstitutionalPdfRenderResult {
  blob: Blob;
  trace: InstitutionalPdfTrace;
  parity: { status: "PASS"; sourceDocxSha256: string; pdfSha256: string; textBlocks: string[]; imageHashes: string[]; visualIds: string[]; pageCount: number; format: "LETTER"; orientation: "PORTRAIT" };
}
export function institutionalAnnexRequiredVisualIds(annex: { executiveReportReference: { principalMapId: string }; sections: Array<{ sectionId: string; records: Array<{ recordId: string }> }> }, executiveRequiredIds: string[]): string[] {
  const records = annex.sections.filter(section => ["field-photographs", "street-view"].includes(section.sectionId)).flatMap(section => section.records);
  return [...new Set([annex.executiveReportReference.principalMapId, ...records.filter(record => executiveRequiredIds.includes(record.recordId)).map(record => record.recordId)])];
}
const children = (node: Element | undefined, name?: string): Element[] => (node?.elements || []).filter(item => !name || item.name === name);
function descendants(node: Element | undefined, name: string): Element[] {
  return (node?.elements || []).flatMap(item => [...(item.name === name ? [item] : []), ...descendants(item, name)]);
}
const attr = (node: Element | undefined, key: string): string => String(node?.attributes?.[key] ?? "");
const textOf = (node: Element): string => descendants(node, "w:t").map(item => children(item).map(child => String(child.text ?? "")).join("")).join("");
const xml = (value: string): Element => xml2js(value, { compact: false }) as Element;
const unique = (values: string[]) => [...new Set(values)];
/** Compare all OOXML parts, including headers/footers, while allowing packing timestamps and drawing counters. */
export async function assertInstitutionalDocxPhysicalParity(actual: Uint8Array, expected: Uint8Array): Promise<void> {
  const [a, b] = await Promise.all([JSZip.loadAsync(actual), JSZip.loadAsync(expected)]);
  const names = (zip: JSZip) => Object.keys(zip.files).filter(name => !zip.files[name].dir).sort();
  const normalize = (node: Element): Element => ({ ...node,
    ...(node.attributes ? { attributes: Object.fromEntries(Object.entries(node.attributes).filter(([key]) =>
      !(key === "id" && ["wp:docPr", "pic:cNvPr"].includes(node.name || "")))) } : {}),
    ...(node.elements ? { elements: node.elements.filter(child => !["dcterms:created", "dcterms:modified"].includes(child.name || "")).map(normalize) } : {}),
  });
  if (canonicalSemanticValue(names(a)) !== canonicalSemanticValue(names(b))) throw new Error("REPORT_PACKAGE_LINEAGE_MISMATCH:P6_DOCX_PARTS");
  for (const name of names(a)) {
    const [left, right] = await Promise.all([a.file(name)!.async("uint8array"), b.file(name)!.async("uint8array")]);
    const equal = /\.(xml|rels)$/.test(name)
      ? canonicalSemanticValue(normalize(xml(new TextDecoder().decode(left)))) === canonicalSemanticValue(normalize(xml(new TextDecoder().decode(right))))
      : await hash(left) === await hash(right);
    if (!equal) throw new Error(`REPORT_PACKAGE_LINEAGE_MISMATCH:P6_DOCX_BYTES:${name}`);
  }
}
async function hash(data: Uint8Array): Promise<string> {
  const exact = Uint8Array.from(data);
  return `sha256:${[...new Uint8Array(await crypto.subtle.digest("SHA-256", exact.buffer))].map(value => value.toString(16).padStart(2, "0")).join("")}`;
}
function normalizePart(base: string, target: string): string {
  const segments: string[] = [];
  for (const item of `${base}/${target}`.split("/")) { if (item === "..") segments.pop(); else if (item && item !== ".") segments.push(item); }
  return segments.join("/");
}
export async function readDocx(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const document = xml(await zip.file("word/document.xml")!.async("string"));
  const section = descendants(document, "w:sectPr").at(-1)!;
  const size = children(section, "w:pgSz")[0];
  if (Number(attr(size, "w:w")) !== 12240 || Number(attr(size, "w:h")) !== 15840 || attr(size, "w:orient") === "landscape") {
    throw new Error("INSTITUTIONAL_PDF_BLOCKED:LETTER_PORTRAIT_REQUIRED");
  }
  const margins = children(section, "w:pgMar")[0];
  const margin = (side: string, fallback: number) => Number(attr(margins, `w:${side}`)) / 20 || fallback;
  async function readPart(path: string): Promise<DocumentBlock[]> {
    let paragraphNumber = 0;
    const entry = zip.file(path);
    if (!entry) throw new Error(`INSTITUTIONAL_PDF_BLOCKED:DOCX_PART_MISSING:${path}`);
    const tree = xml(await entry.async("string"));
    const slash = path.lastIndexOf("/");
    const base = path.slice(0, slash);
    const relEntry = zip.file(`${base}/_rels/${path.slice(slash + 1)}.rels`);
    const relations = relEntry ? descendants(xml(await relEntry.async("string")), "Relationship") : [];
    async function parse(node: Element): Promise<DocumentBlock[]> {
      if (node.name === "w:p") {
        const paragraphId = `${path}:${paragraphNumber++}`;
        const blocks: DocumentBlock[] = [];
        const properties = children(node, "w:pPr")[0];
        const spacing = children(properties, "w:spacing")[0];
        const run = descendants(node, "w:rPr")[0];
        const content = textOf(node);
        if (children(properties, "w:pageBreakBefore").length) blocks.push({ kind: "PAGE_BREAK" });
        if (content) blocks.push({ kind: "PARAGRAPH", text: content,
          size: Number(attr(children(run, "w:sz")[0], "w:val")) / 2 || 10,
          bold: children(run, "w:b").length > 0, color: attr(children(run, "w:color")[0], "w:val") || "222222",
          align: attr(children(properties, "w:jc")[0], "w:val") || "left",
          before: Number(attr(spacing, "w:before")) / 20 || 0, after: Number(attr(spacing, "w:after")) / 20 || 4,
          keepNext: children(properties, "w:keepNext").length > 0 });
        const drawings = descendants(node, "w:drawing");
        for (const [index, drawing] of drawings.entries()) {
          const blip = descendants(drawing, "a:blip")[0];
          const relation = relations.find(item => attr(item, "Id") === attr(blip, "r:embed"));
          if (!relation || attr(relation, "TargetMode") === "External") throw new Error("INSTITUTIONAL_PDF_BLOCKED:EMBEDDED_IMAGE_REQUIRED");
          const media = zip.file(normalizePart(base, attr(relation, "Target")));
          if (!media) throw new Error("INSTITUTIONAL_PDF_BLOCKED:IMAGE_MISSING");
          const data = await media.async("uint8array");
          const extent = descendants(drawing, "wp:extent")[0];
          const format = data[0] === 137 && data[1] === 80 ? "PNG" : data[0] === 255 && data[1] === 216 ? "JPEG" : null;
          if (!format) throw new Error("INSTITUTIONAL_PDF_BLOCKED:IMAGE_FORMAT_UNSUPPORTED");
          blocks.push({ kind: "IMAGE", data, format, width: Number(attr(extent, "cx")) / 12700,
            height: Number(attr(extent, "cy")) / 12700, visualId: attr(descendants(drawing, "wp:docPr")[0], "title"), sha256: await hash(data),
            ...(drawings.length > 1 ? { row: { id: paragraphId, index, count: drawings.length } } : {}) });
        }
        if (descendants(node, "w:br").some(item => attr(item, "w:type") === "page")) blocks.push({ kind: "PAGE_BREAK" });
        return blocks;
      }
      if (node.name === "w:tbl") {
        const firstCells = children(children(node,"w:tr")[0],"w:tc");
        const percentageWidths = firstCells.map(cell => children(children(cell,"w:tcPr")[0],"w:tcW")[0]);
        const widths = percentageWidths.every(item => attr(item,"w:type") === "pct" && Number(attr(item,"w:w")) > 0)
          ? percentageWidths.map(item => Number(attr(item,"w:w")))
          : descendants(children(node,"w:tblGrid")[0],"w:gridCol").map(item => Number(attr(item,"w:w")));
        return [{ kind: "TABLE", widths,
        rows: await Promise.all(children(node, "w:tr").map(async row => ({ header: descendants(row, "w:tblHeader").length > 0,
          cells: await Promise.all(children(row, "w:tc").map(async cell => ({ blocks: (await Promise.all(children(cell).filter(item => item.name !== "w:tcPr").map(parse))).flat(),
            fill: attr(descendants(children(cell, "w:tcPr")[0], "w:shd")[0], "w:fill") || "FFFFFF" }))) }))) }];
      }
      if (["w:document", "w:body", "w:hdr", "w:ftr"].includes(node.name || "") || !node.name) return (await Promise.all(children(node).map(parse))).flat();
      if (node.name === "w:sectPr" || node.type === "declaration") return [];
      throw new Error(`INSTITUTIONAL_PDF_BLOCKED:UNSUPPORTED_DOCX_BLOCK:${node.name}`);
    }
    return parse(tree);
  }
  const docRels = descendants(xml(await zip.file("word/_rels/document.xml.rels")!.async("string")), "Relationship");
  async function auxiliary(name: string): Promise<DocumentBlock[]> {
    const ref = children(section, name).find(item => attr(item, "w:type") === "default");
    if (!ref) return [];
    const relation = docRels.find(item => attr(item, "Id") === attr(ref, "r:id"));
    return relation ? readPart(normalizePart("word", attr(relation, "Target"))) : [];
  }
  return { blocks: await readPart("word/document.xml"), header: await auxiliary("w:headerReference"),
    left: margin("left", 60), right: margin("right", 56), top: margin("top", 56), bottom: margin("bottom", 56) };
}
const blockTexts = (blocks: DocumentBlock[]): string[] => blocks.flatMap(block => block.kind === "PARAGRAPH" ? [block.text] : block.kind === "TABLE" ? block.rows.flatMap(row => row.cells.flatMap(cell => blockTexts(cell.blocks))) : []);
const blockImages = (blocks: DocumentBlock[]): ImageBlock[] => blocks.flatMap(block => block.kind === "IMAGE" ? [block] : block.kind === "TABLE" ? block.rows.flatMap(row => row.cells.flatMap(cell => blockImages(cell.blocks))) : []);

/** OOXML is the common physical representation; no briefing, dataset query or visual re-selection. */
export async function renderInstitutionalPdfFromDocx(bytes: Uint8Array, trace: InstitutionalPdfTrace): Promise<InstitutionalPdfRenderResult> {
  assertReconciledDocumentSemanticAudit(trace.semanticIntegrity as DocumentSemanticAudit | undefined);
  if (trace.state !== "GENERATED" || trace.certified || trace.published || !trace.projectId || !trace.numeroExpediente) throw new Error("INSTITUTIONAL_PDF_BLOCKED:GENERATED_IDENTITY_REQUIRED");
  const source = await readDocx(bytes);
  const model = trace.documentModel as { identity?: { numeroExpediente?: string; projectId?: string }; technicalMetadata?: { sourceProjectId?: string } };
  if (model?.identity?.numeroExpediente !== trace.numeroExpediente ||
    (model.identity?.projectId || model.technicalMetadata?.sourceProjectId) !== trace.projectId ||
    !blockTexts(source.blocks).includes(`Número de expediente: ${trace.numeroExpediente}`)) {
    throw new Error("INSTITUTIONAL_PDF_BLOCKED:MODEL_IDENTITY_PARITY_REQUIRED");
  }
  const images = blockImages(source.blocks);
  const visualIds = unique(images.map(image => image.visualId).filter(Boolean));
  if (trace.requiredVisualIds.some(id => !visualIds.includes(id) || trace.missingVisualAssetIds.includes(id)) ||
    trace.renderedVisualIds.some(id => !visualIds.includes(id)) || visualIds.some(id => !trace.renderedVisualIds.includes(id))) {
    throw new Error("INSTITUTIONAL_PDF_BLOCKED:VISUAL_PARITY_REQUIRED");
  }
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter", compress: true });
  pdf.setFileId((await hash(bytes)).slice(7, 39));
  const emittedAt = (trace.documentModel as any)?.identity?.fechaEmision || (trace.documentModel as any)?.identity?.fecha;
  const creationDate = new Date(emittedAt);
  if (!Number.isFinite(creationDate.getTime())) throw new Error("INSTITUTIONAL_PDF_BLOCKED:EMISSION_DATE_REQUIRED");
  pdf.setCreationDate(creationDate);
  const width = 612, height = 792;
  const available = width - source.left - source.right;
  let y = source.top, pageHasBody = false;
  const written: string[] = [];
  const drawn: string[] = [];
  const nextPage = () => { pdf.addPage("letter", "portrait"); y = source.top; pageHasBody = false; };
  const ensure = (needed: number) => { if (y + needed > height - source.bottom && pageHasBody) nextPage(); };
  function style(block: ParagraphBlock) { pdf.setFont("helvetica", block.bold ? "bold" : "normal"); pdf.setFontSize(block.size); pdf.setTextColor(`#${/^[0-9a-f]{6}$/i.test(block.color) ? block.color : "222222"}`); }
  function lines(block: ParagraphBlock, cellWidth = available): string[] { style(block); return pdf.splitTextToSize(block.text, cellWidth) as string[]; }
  function paragraph(block: ParagraphBlock) {
    const wrapped = lines(block); const lineHeight = block.size * 1.25;
    ensure(block.before + lineHeight * Math.min(wrapped.length, 2) + (block.keepNext ? 22 : 0)); y += block.before;
    for (const line of wrapped) {
      ensure(lineHeight); style(block);
      const align = block.align === "center" ? "center" : block.align === "right" ? "right" : "left";
      pdf.text(line, align === "center" ? source.left + available / 2 : align === "right" ? width - source.right : source.left, y + block.size, { align });
      y += lineHeight; pageHasBody = true;
    }
    y += block.after; written.push(block.text);
  }
  function image(block: ImageBlock, next?: DocumentBlock) {
    const maxHeight = height - source.top - source.bottom - 70;
    const scale = Math.min(1, available / block.width, maxHeight / block.height);
    const w = block.width * scale, h = block.height * scale;
    if (!Number.isFinite(w + h) || w <= 0 || h <= 0) throw new Error("INSTITUTIONAL_PDF_BLOCKED:IMAGE_DIMENSIONS_INVALID");
    const captionSpace = next?.kind === "PARAGRAPH" ? lines(next).length * next.size * 1.25 + next.after : 0;
    ensure(h + Math.min(captionSpace, 70) + 8);
    pdf.addImage(block.data, block.format, source.left + (available - w) / 2, y, w, h);
    y += h + 8; pageHasBody = true; drawn.push(block.sha256);
  }
  function table(block: TableBlock) {
    const columnCount = Math.max(...block.rows.map(row => row.cells.length));
    const weights = block.widths.length === columnCount ? block.widths : Array(columnCount).fill(1);
    const total = weights.reduce((sum, value) => sum + value, 0);
    const widths = weights.map(value => available * value / total);
    const headers = block.rows.filter(row => row.header);
    const prepare = (row: TableBlock["rows"][number]) => row.cells.map((cell, index) => {
      const paragraphs = cell.blocks.filter((item): item is ParagraphBlock => item.kind === "PARAGRAPH");
      const cellImages = blockImages(cell.blocks);
      const wrapped = paragraphs.flatMap(item => { const small = { ...item, size: Math.min(item.size, 9) }; return lines(small, widths[index] - 12).map(text => ({ text, size: small.size, color: small.color, bold: small.bold })); });
      return { ...cell, wrapped, cellImages, height: 12 + wrapped.reduce((sum, line) => sum + line.size * 1.25, 0) + cellImages.reduce((sum, image) => sum + Math.min(image.height, 80) + 6, 0) };
    });
    function rowDraw(row: TableBlock["rows"][number], repeat = false) {
      const cells = prepare(row); const rowHeight = Math.max(20, ...cells.map(cell => cell.height));
      if (rowHeight > height - source.top - source.bottom) throw new Error("INSTITUTIONAL_PDF_BLOCKED:TABLE_ROW_EXCEEDS_PAGE");
      if (y + rowHeight > height - source.bottom && pageHasBody) { nextPage(); if (!repeat && !row.header) for (const header of headers) rowDraw(header, true); }
      let x = source.left;
      cells.forEach((cell, index) => {
        pdf.setFillColor(`#${/^[0-9a-f]{6}$/i.test(cell.fill) ? cell.fill : "FFFFFF"}`); pdf.setDrawColor("#D9D9D9");
        pdf.rect(x, y, widths[index], rowHeight, "FD"); let cursor = y + 6;
        for (const img of cell.cellImages) {
          const scale = Math.min(1, (widths[index] - 12) / img.width, 80 / img.height);
          pdf.addImage(img.data, img.format, x + (widths[index] - img.width * scale) / 2, cursor, img.width * scale, img.height * scale);
          cursor += img.height * scale + 6; if (!repeat) drawn.push(img.sha256);
        }
        for (const line of cell.wrapped) { pdf.setFont("helvetica", line.bold ? "bold" : "normal"); pdf.setFontSize(line.size); pdf.setTextColor(`#${/^[0-9a-f]{6}$/i.test(line.color) ? line.color : "222222"}`); pdf.text(line.text, x + 6, cursor + line.size); cursor += line.size * 1.25; }
        if (!repeat) written.push(...blockTexts(cell.blocks)); x += widths[index];
      });
      y += rowHeight; pageHasBody = true;
    }
    for (const row of block.rows) rowDraw(row);
    y += 8;
  }
  source.blocks.forEach((block, index) => {
    if (block.kind === "PARAGRAPH") {
      const following = source.blocks[index + 1];
      if (block.keepNext && following?.kind === "IMAGE") {
        const scale = Math.min(1, available / following.width, (height-source.top-source.bottom-70)/following.height);
        const caption = source.blocks[index+2];
        const captionHeight = caption?.kind === "PARAGRAPH" ? Math.min(70, lines(caption).length*caption.size*1.25+caption.after) : 0;
        ensure(block.before+lines(block).length*block.size*1.25+block.after+following.height*scale+captionHeight+8);
      }
      if (block.keepNext && following?.kind === "TABLE") {
        const columns = Math.max(...following.rows.map(row=>row.cells.length));
        const weights = following.widths.length===columns ? following.widths : Array(columns).fill(1);
        const total = weights.reduce((sum,n)=>sum+n,0);
        const preview = following.rows.slice(0,2).reduce((sum,row)=>sum+Math.max(20,...row.cells.map((cell,col)=>12+cell.blocks.reduce((h,item)=>h+(item.kind==="PARAGRAPH" ? lines({...item,size:Math.min(item.size,9)},available*weights[col]/total-12).length*Math.min(item.size,9)*1.25:0),0))),0);
        ensure(block.before+lines(block).length*block.size*1.25+block.after+preview);
      }
      paragraph(block);
    }
    else if (block.kind === "IMAGE") {
      if (!block.row) image(block, source.blocks[index + 1]);
      else if (block.row.index === 0) {
        const row = source.blocks.slice(index, index + block.row.count) as ImageBlock[];
        const gap = 36, totalWidth = row.reduce((sum, item) => sum + item.width, 0) + gap * (row.length - 1);
        const scale = Math.min(1, available / totalWidth), rowHeight = Math.max(...row.map(item => item.height)) * scale;
        ensure(rowHeight + 8); let x = source.left + (available - totalWidth * scale) / 2;
        for (const item of row) { pdf.addImage(item.data, item.format, x, y, item.width * scale, item.height * scale); x += (item.width + gap) * scale; drawn.push(item.sha256); }
        y += rowHeight + 8; pageHasBody = true;
      }
    }
    else if (block.kind === "TABLE") table(block);
    else if (pageHasBody) nextPage();
  });
  if (!pageHasBody && pdf.getNumberOfPages() > 1) pdf.deletePage(pdf.getNumberOfPages());
  const pages = pdf.getNumberOfPages();
  for (let page = 2; page <= pages; page++) {
    pdf.setPage(page); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor("#5B6573");
    pdf.text(blockTexts(source.header).join(" "), source.left, 30, { align: "left", maxWidth: available });
    pdf.setDrawColor("#D9DEE5"); pdf.line(source.left, 37, width - source.right, 37);
    pdf.line(source.left, height - 40, width - source.right, height - 40);
    pdf.text(`Página ${page} de ${pages} | EXP: ${trace.numeroExpediente.slice(0, 30)}`, width - source.right, height - 28, { align: "right" });
  }
  const expectedText = blockTexts(source.blocks);
  if (JSON.stringify(written) !== JSON.stringify(expectedText) || JSON.stringify(drawn) !== JSON.stringify(images.map(item => item.sha256))) throw new Error("INSTITUTIONAL_PDF_BLOCKED:CONTENT_PARITY_FAILED");
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  pdf.setProperties({ title: trace.kind === "EXECUTIVE_REPORT" ? "INFORME EJECUTIVO GEOINT" : "ANEXO TÉCNICO GEOINT", author: "SSPE-CEIPOL", subject: `GENERATED | ${trace.numeroExpediente}` });
  pdf.addMetadata(`<institutionalTrace>${escape(JSON.stringify(trace))}</institutionalTrace>`);
  const data = new Uint8Array(pdf.output("arraybuffer"));
  return { blob: new Blob([data], { type: "application/pdf" }), trace,
    parity: { status: "PASS", sourceDocxSha256: await hash(bytes), pdfSha256: await hash(data), textBlocks: expectedText,
      imageHashes: drawn, visualIds, pageCount: pages, format: "LETTER", orientation: "PORTRAIT" } };
}
