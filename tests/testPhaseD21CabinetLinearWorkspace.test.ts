import fs from "node:fs";
import path from "node:path";
import {
  assessCorridorIntegrity,
  corridorVertexRole,
} from "../src/utils/canonicalProjectGeography";

const workspacePath = path.join(process.cwd(), "src/components/cabinet/CabinetLinearWorkspace.tsx");
const workspace = fs.readFileSync(workspacePath, "utf8");
const projectList = fs.readFileSync(path.join(process.cwd(), "src/components/ProjectList.tsx"), "utf8");

const ni = { lat: 21.881, lng: -102.291 };
const pi1 = { lat: 21.882, lng: -102.292 };
const pi2 = { lat: 21.883, lng: -102.293 };
const nf = { lat: 21.884, lng: -102.294 };

function sourceBetween(start: string, end: string) {
  const startIndex = workspace.indexOf(start);
  const endIndex = workspace.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return workspace.slice(startIndex, endIndex);
}

describe("Phase D2.1 - Cabinet linear local workspace", () => {
  test("LINEAL mounts only under CABINET lineal while Individual and Polygon stay isolated", () => {
    expect(projectList).toContain('projectCreationMode === "CABINET" && cabinetGeometryType === "lineal"');
    expect(projectList).toContain("<CabinetLinearWorkspace");
    expect(projectList).toContain('projectCreationMode === "CABINET" && cabinetGeometryType === "individual"');
    expect(projectList).toContain("<CabinetIndividualWorkspace");
    expect(projectList).toContain('projectCreationMode === "CABINET" && cabinetGeometryType === "poligono"');
    expect(projectList).toContain("El espacio de trabajo de Gabinete se habilitará en la siguiente fase.");
  });

  test("NI plus NF is a valid minimum corridor", () => {
    expect(assessCorridorIntegrity([ni, nf]).isValid).toBe(true);
  });

  test("NI, PI, NF and multiple PI preserve valid ordered corridors", () => {
    expect(assessCorridorIntegrity([ni, pi1, nf]).validPoints).toEqual([ni, pi1, nf]);
    expect(assessCorridorIntegrity([ni, pi1, pi2, nf]).validPoints).toEqual([ni, pi1, pi2, nf]);
    expect(assessCorridorIntegrity([ni, pi1, pi2, nf]).isValid).toBe(true);
  });

  test("roles are derived from canonical array order", () => {
    expect([ni, pi1, pi2, nf].map((_, index, points) => corridorVertexRole(index, points.length))).toEqual([
      "START",
      "INTERMEDIATE",
      "INTERMEDIATE",
      "END",
    ]);
    expect(workspace).toContain("corridorVertexRole(index, vertices.length)");
  });

  test("map selection remains pending until Street View capture is accepted", () => {
    const mapClickHandler = sourceBetween("const handleMapClick", "const handleCapture");
    const captureHandler = sourceBetween("const handleCapture", "const chooseNextStep");
    expect(mapClickHandler).toContain("setPendingPoint(point)");
    expect(mapClickHandler).not.toContain("setVertices");
    expect(captureHandler).toContain("setVertices");
    expect(captureHandler).toContain("setCaptureByVertexId");
  });

  test("territorial path never uses panorama coordinates", () => {
    expect(workspace).toContain("vertices.map((vertex) => vertex.point)");
    expect(workspace).toContain("path={vertexPath}");
    expect(workspace).toContain("capture.panoramaLat.toFixed(6)");
    expect(workspace).toContain("capture.panoramaLng.toFixed(6)");
    const vertexPathDeclaration = sourceBetween("const vertexPath =", "const corridorIntegrity");

    expect(vertexPathDeclaration).toContain("vertices.map((vertex) => vertex.point)");
    expect(vertexPathDeclaration).not.toContain("panorama");
  });

  test("workspace is local-only and reuses the governed picker", () => {
    expect(workspace).toContain("StreetViewPanoramaPicker");
    expect(workspace).toContain("StreetViewCapturePayload");
    expect(workspace).toContain("captureByVertexId");
    expect(workspace).not.toContain("createProject");
    expect(workspace).not.toContain("ProjectContext");
    expect(workspace).not.toContain("useProject");
    expect(workspace).not.toMatch(/firebase|firestore|storage/i);
  });

  test("layout is vertical and validation is guarded by corridor integrity", () => {
    expect(workspace).toContain('<div className="space-y-5">');
    expect(workspace).not.toContain("lg:grid-cols-[minmax");
    expect(workspace).toContain("assessCorridorIntegrity(vertexPath)");
    expect(workspace).toContain('workflowStep === "REVIEW" && corridorIntegrity.isValid && allVerticesCaptured');
    expect(workspace).toContain("disabled={!canValidateGeometry || geometryConfirmed}");
  });
});
