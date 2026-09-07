import fs from "fs";
import path from "path";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("QA-05.8 - Draft evidence propagation", () => {
  const source = readSource("src/lib/reportEngine.ts");

  test("TEST 1 institutional branch propagates album as photoEvidence", () => {
    const institutionalBranch = source.match(
      /if \(exportMode === "INSTITUTIONAL"\) \{([\s\S]*?)\} else \{/
    );

    expect(institutionalBranch).not.toBeNull();
    expect(institutionalBranch?.[1]).toContain(
      "photoEvidence: this.context.album || []"
    );
    expect(institutionalBranch?.[1]).toContain(
      "album: this.context.album || []"
    );
  });

  test("TEST 2 draft branch propagates governed evidence context", () => {
    const draftExport = source.match(
      /\.\.\.wordPayload,([\s\S]*?)\{ exportMode: "DRAFT" \}\s*\);/
    );

    expect(draftExport).not.toBeNull();
    expect(draftExport?.[1]).toContain(
      "photoEvidence: this.context.album || []"
    );
    expect(draftExport?.[1]).toContain(
      "album: this.context.album || []"
    );
    expect(draftExport?.[1]).toContain(
      "mapSnapshots: this.context.mapSnapshots || []"
    );
    expect(draftExport?.[1]).toContain(
      "sweeps: this.context.sweeps || []"
    );
  });

  test("TEST 3 draft evidence propagation preserves DRAFT mode", () => {
    const draftExport = source.match(
      /\.\.\.wordPayload,([\s\S]*?)\{ exportMode: "DRAFT" \}\s*\);/
    );

    expect(draftExport).not.toBeNull();
    expect(draftExport?.[0]).toContain('{ exportMode: "DRAFT" }');
    expect(draftExport?.[0]).not.toContain(
      '{ exportMode: "INSTITUTIONAL" }'
    );
  });
});
