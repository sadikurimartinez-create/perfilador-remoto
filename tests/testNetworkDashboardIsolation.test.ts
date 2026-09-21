import fs from "node:fs";
import path from "node:path";
import { classifyDynamicModuleFailure } from "../src/utils/dynamicModuleFailure";

describe("NetworkDashboard isolation from the expediente runtime", () => {
  const readSource = (...segments: string[]) => fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");

  test("NetworkDashboard remains available and only its graph engine is dynamically loaded", () => {
    const source = readSource("src", "components", "NetworkDashboard.tsx");

    expect(source).toContain("export const NetworkDashboard");
    expect(source).toContain("import('react-force-graph-2d').catch");
    expect(source).toContain("return ForceGraph2DFallback");
  });

  test("a missing registered chunk is classified and degrades inside the HIG boundary", () => {
    const error = Object.assign(new Error("Loading chunk 7745 failed"), {
      name: "ChunkLoadError",
      type: "missing",
      request: "https://example.test/_next/static/chunks/7745.hash.js?secret=redacted",
    });

    expect(classifyDynamicModuleFailure(error)).toEqual({
      failureType: "WEBPACK_CHUNK_REGISTRATION_FAILURE",
      errorName: "ChunkLoadError",
      requestPath: "/_next/static/chunks/7745.hash.js",
    });

    const boundarySource = readSource("src", "components", "ui", "DynamicErrorBoundary.tsx");

    expect(boundarySource).toContain("getDerivedStateFromError");
    expect(boundarySource).toContain("<DynamicModuleFallback moduleName={this.props.moduleName} />");
    expect(boundarySource).not.toContain("error.stack");
    expect(boundarySource).not.toContain("componentStack:");
  });

  test("CIFA stays statically accessible and outside the isolated HIG boundary", () => {
    const source = readSource("src", "components", "PhotoAlbum.tsx");
    const cifaPanel = source.indexOf("<CifaCeipolPanel");
    const higBoundary = source.indexOf('<DynamicErrorBoundary moduleName="Hypothesis Intelligence Graph (HIG 2.0)">');

    expect(source).toContain('import { NetworkDashboard } from "./NetworkDashboard";');
    expect(source).not.toContain('import("./NetworkDashboard")');
    expect(cifaPanel).toBeGreaterThan(-1);
    expect(higBoundary).toBeGreaterThan(cifaPanel);
    expect(source.slice(higBoundary, source.indexOf("</DynamicErrorBoundary>", higBoundary)))
      .not.toContain("CifaCeipolPanel");
  });
});
