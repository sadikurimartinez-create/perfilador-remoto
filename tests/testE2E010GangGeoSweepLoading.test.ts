import fs from "node:fs";
import path from "node:path";

describe("E2E-010 Gang Geo Sweep loading cleanup", () => {
  test("handleRunGeoSweep always releases processing state in finally", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/GangGeoSweepPanel.tsx"),
      "utf8"
    );
    const handler = source.match(
      /const handleRunGeoSweep = async \(\) => \{[\s\S]*?(?=\n\s*\/\/ Reset the panel)/
    )?.[0];

    expect(handler).toBeDefined();

    const finallyBlock = handler?.match(
      /finally\s*\{([\s\S]*?)\n\s*\}/
    );
    expect(finallyBlock).not.toBeNull();
    expect(finallyBlock?.[1]).toContain("setIsProcessing(false)");
    expect(finallyBlock?.[1]).toContain('setProgressMsg("")');

    const emptyGangsBranch = handler?.match(
      /if \(dbGangs\.length === 0\) \{([\s\S]*?)\n\s*\}/
    );
    expect(emptyGangsBranch).not.toBeNull();
    expect(emptyGangsBranch?.[1]).toContain("setSweepResult(null)");
    expect(emptyGangsBranch?.[1]).toContain("return;");

    const handlerWithoutFinally = handler?.replace(finallyBlock?.[0] ?? "", "");
    expect(handlerWithoutFinally).not.toContain("setIsProcessing(false)");
    expect(handlerWithoutFinally).not.toContain('setProgressMsg("")');
  });
});
