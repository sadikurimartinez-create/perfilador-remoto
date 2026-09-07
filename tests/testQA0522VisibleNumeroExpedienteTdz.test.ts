import fs from "fs";
import path from "path";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("QA-05.22 - visibleNumeroExpediente TDZ", () => {
  const source = readSource("src/lib/exportToWord.ts");

  test("TEST 1 exportToWord declares visibleNumeroExpediente before consistency gate", () => {
    const exportStart = source.indexOf("export async function exportToWord");
    expect(exportStart).toBeGreaterThanOrEqual(0);

    const exportSource = source.slice(exportStart);

    const declaration = exportSource.indexOf(
      "const visibleNumeroExpediente = resolveVisibleNumeroExpediente({"
    );

    const consistencyGate = exportSource.indexOf(
      "// CoverDataValidator, FinalReportConsistencyCheck & ExecutiveReportQualityGate"
    );

    const firstGateUse = exportSource.indexOf(
      'visibleNumeroExpediente !== "NO ASIGNADO"'
    );

    expect(declaration).toBeGreaterThanOrEqual(0);
    expect(consistencyGate).toBeGreaterThan(declaration);
    expect(firstGateUse).toBeGreaterThan(declaration);
  });

  test("TEST 2 exportToWord contains one scoped declaration for visibleNumeroExpediente", () => {
    const exportStart = source.indexOf("export async function exportToWord");
    expect(exportStart).toBeGreaterThanOrEqual(0);

    const exportSource = source.slice(exportStart);

    const matches =
      exportSource.match(
        /const visibleNumeroExpediente = resolveVisibleNumeroExpediente\(\{/g
      ) || [];

    expect(matches).toHaveLength(1);
  });

  test("TEST 3 FinalReportConsistencyCheck keeps its independent local declaration", () => {
    const fnStart = source.indexOf("function FinalReportConsistencyCheck");
    expect(fnStart).toBeGreaterThanOrEqual(0);

    const fnEnd = source.indexOf("\n}\n", fnStart);
    expect(fnEnd).toBeGreaterThan(fnStart);

    const fnSource = source.slice(fnStart, fnEnd + 3);

    expect(fnSource).toContain(
      "const visibleNumeroExpediente = resolveVisibleNumeroExpediente(payload);"
    );
  });
});
