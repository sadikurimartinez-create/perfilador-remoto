import fs from "node:fs";
import path from "node:path";
import { TCE_DEFAULT_FALLBACK } from "../src/utils/territorialContextEngine";
import { assertInstitutionalExportAuthorization } from "../src/lib/reportEngine";

const root = process.cwd();

function source(file: string): string {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("QA-05.26 - Word export runtime fallback symbols", () => {
  test("A exportToWord importa TCE_DEFAULT_FALLBACK desde el modulo canonico", () => {
    const text = source("src/lib/exportToWord.ts");
    expect(text).toContain('import { TCE_DEFAULT_FALLBACK } from "@/utils/territorialContextEngine";');
  });

  test("B TCE_DEFAULT_FALLBACK continua exportado por territorialContextEngine", () => {
    const text = source("src/utils/territorialContextEngine.ts");
    expect(text).toContain("export const TCE_DEFAULT_FALLBACK");
    expect(TCE_DEFAULT_FALLBACK.length).toBeGreaterThan(80);
  });

  test("C defaultChapterFallbacks usa constante canonica y no copia literal nueva", () => {
    const text = source("src/lib/exportToWord.ts");
    const fallbackBlock = text.slice(text.indexOf("const defaultChapterFallbacks"), text.indexOf("const emptyChaptersAlerts"));
    expect(fallbackBlock).toContain("contextoTerritorial: TCE_DEFAULT_FALLBACK");
    expect(fallbackBlock).not.toContain(TCE_DEFAULT_FALLBACK);
  });

  test("D validateAndPaveChapters no se elimina", () => {
    const text = source("src/lib/exportToWord.ts");
    expect(text).toContain("function validateAndPaveChapters(payload: any)");
    expect(text).toContain("validateAndPaveChapters(payload)");
  });

  test("E identidad y certificacion institucional protegidas permanecen sin bypass", () => {
    const exportText = source("src/lib/exportToWord.ts");
    const identityText = source("src/utils/documentIdentity.ts");
    expect(exportText).toContain("resolveVisibleNumeroExpediente");
    expect(() => assertInstitutionalExportAuthorization({ exportMode: "INSTITUTIONAL" }, "WORD")).toThrow("WORD_INSTITUTIONAL_EXPORT_BLOCKED");
    expect(identityText).toContain("resolveVisibleNumeroExpediente");
  });

  test("F emptyChaptersAlerts queda declarado en el mismo boundary antes de usarse", () => {
    const text = source("src/lib/exportToWord.ts");
    const functionBlock = text.slice(text.indexOf("function FinalReportConsistencyCheck"), text.indexOf("function ExecutiveReportQualityGate"));
    expect(functionBlock).toContain("const emptyChaptersAlerts: string[] = [];");
    expect(functionBlock.indexOf("const emptyChaptersAlerts: string[] = [];")).toBeLessThan(functionBlock.indexOf("emptyChaptersAlerts.push"));
  });
});
