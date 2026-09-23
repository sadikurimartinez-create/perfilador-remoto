import { Document, Packer } from "docx";
import JSZip from "jszip";
import { renderStructuredTable } from "../src/utils/documentTableRenderer";

async function documentXml(children: any[]): Promise<string> {
  const document = new Document({ sections: [{ children }] });
  const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
  return zip.file("word/document.xml")?.async("string") || "";
}

describe("DocumentTableRenderer gobernado", () => {
  test("render estructurado emite header repetible, filas indivisibles y anchos", async () => {
    const table = renderStructuredTable({
      headers: ["EVIDENCIA", "TRAZABILIDAD", "OBSERVACIONES"],
      rows: [["EV-001", "TRAZABLE", "Contenido visible completo"]],
    }, { columnWidths: [20, 25, 55] });
    const xml = await documentXml([table]);

    expect(xml).toContain("<w:tblHeader/>");
    expect(xml.match(/<w:cantSplit\/>/g)).toHaveLength(2);
    expect(xml).toContain("<w:tblW");
    expect(xml).toContain("<w:tcW");
    expect(xml).toContain('<w:tblLayout w:type="fixed"/>');
    expect(xml).toContain("Contenido visible completo");
  });

  test("preserva 25 filas, texto largo y valores estructurados sin truncar", async () => {
    const longText = "TEXTO_EXTENSO_CERTIFICADO_" + "contenido sin recorte ".repeat(30);
    const rows = Array.from({ length: 25 }, (_, index) => [
      `ROW_${String(index + 1).padStart(2, "0")}`,
      `${longText} END_${index + 1}`,
      { fuente: `FUENTE_${index + 1}`, estado: "TRAZABLE" },
    ]);
    const xml = await documentXml([renderStructuredTable({
      headers: ["REGISTRO", "DETALLE", "FUENTE"],
      rows,
    }, { columnWidths: [15, 55, 30] })]);

    for (let index = 1; index <= rows.length; index += 1) {
      expect(xml).toContain(`ROW_${String(index).padStart(2, "0")}`);
      expect(xml).toContain(`END_${index}`);
      expect(xml).toContain(`FUENTE_${index}`);
    }
    expect(xml).toContain(longText);
    expect(xml).not.toContain("[object Object]");
    expect(xml.match(/<w:tr[ >]/g)).toHaveLength(26);
  });
});
