import fs from "node:fs";
import path from "node:path";
import {
  assessCorridorIntegrity,
  corridorVertexRole,
} from "../src/utils/canonicalProjectGeography";
import { findNearestCorridorSegment } from "../src/components/cabinet/cabinetLinearGeometry";

const workspacePath = path.join(process.cwd(), "src/components/cabinet/CabinetLinearWorkspace.tsx");
const workspace = fs.readFileSync(workspacePath, "utf8");
const projectList = fs.readFileSync(path.join(process.cwd(), "src/components/ProjectList.tsx"), "utf8");
const individualWorkspace = fs.readFileSync(
  path.join(process.cwd(), "src/components/cabinet/CabinetIndividualWorkspace.tsx"),
  "utf8",
);

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
    expect(projectList).toContain("<CabinetPolygonWorkspace");
  });

  test("NI, PI and NF preserve valid ordered corridors", () => {
    expect(assessCorridorIntegrity([ni, nf]).isValid).toBe(true);
    expect(assessCorridorIntegrity([ni, pi1, nf]).validPoints).toEqual([ni, pi1, nf]);
    expect(assessCorridorIntegrity([ni, pi1, pi2, nf]).isValid).toBe(true);
  });

  test("roles remain derived from canonical array order", () => {
    expect([ni, pi1, pi2, nf].map((_, index, points) => corridorVertexRole(index, points.length))).toEqual([
      "START",
      "INTERMEDIATE",
      "INTERMEDIATE",
      "END",
    ]);
    expect(workspace).toContain("corridorVertexRole(index, vertices.length)");
    expect(workspace).not.toMatch(/role:\s*["'](?:START|INTERMEDIATE|END)/);
  });

  test("initial map selection remains pending until Street View capture is accepted", () => {
    const mapClickHandler = sourceBetween("const handleMapClick", "const handleCapture");
    const captureHandler = sourceBetween("const handleCapture", "const chooseNextStep");
    expect(mapClickHandler).toContain('kind: "APPEND"');
    expect(mapClickHandler).toContain("beginPendingCapture(point");
    expect(captureHandler).toContain("setVertices((current) => [...current");
    expect(captureHandler).toContain("setCaptureByVertexId");
  });

  test("territorial path never uses panorama coordinates", () => {
    const vertexPathDeclaration = sourceBetween("const vertexPath =", "const corridorIntegrity");
    expect(vertexPathDeclaration).toContain("vertices.map((vertex) => vertex.point)");
    expect(vertexPathDeclaration).not.toContain("panorama");
    expect(workspace).toContain("path={vertexPath}");
    expect(workspace).toContain("capture.panoramaLat.toFixed(6)");
    expect(workspace).toContain("capture.panoramaLng.toFixed(6)");
  });

  test("workspace stays local-only and keeps the governed vertical picker layout", () => {
    expect(workspace).toContain("StreetViewPanoramaPicker");
    expect(workspace).toContain("StreetViewCapturePayload");
    expect(workspace).toContain('<div className="space-y-5">');
    expect(workspace).not.toContain("lg:grid-cols-[minmax");
    expect(workspace).not.toContain("createProject");
    expect(workspace).not.toContain("ProjectContext");
    expect(workspace).not.toContain("useProject");
    expect(workspace).not.toMatch(/firebase|firestore|storage|AlbumPhoto/);
  });

  test("validation requires integrity, all captures, no candidate and completed editing", () => {
    expect(workspace).toContain("assessCorridorIntegrity(vertexPath)");
    expect(workspace).toContain("!isEditing");
    expect(workspace).toContain("!hasPendingCandidate");
    expect(workspace).toContain("corridorIntegrity.isValid");
    expect(workspace).toContain("allVerticesCaptured");
    expect(workspace).toContain("disabled={!canValidateGeometry || geometryConfirmed}");
  });
});

describe("Phase D2.2 - structural editing", () => {
  test("EDIT revokes validation and exposes all structural controls", () => {
    const startEditing = sourceBetween("const startEditing", "const selectEditAction");
    expect(startEditing).toContain("setGeometryConfirmed(false)");
    expect(startEditing).toContain("setIsEditing(true)");
    expect(workspace).toContain("Mover nodo");
    expect(workspace).toContain("Agregar PI");
    expect(workspace).toContain("Borrar PI");
    expect(workspace).toContain("Finalizar edición");
  });

  test("moving NI, PI or NF preserves ID, changes only point and clears only its capture", () => {
    const moveHandler = sourceBetween(
      'if (isEditing && editAction === "MOVE" && selectedVertexId)',
      'if (isEditing && editAction === "ADD_PI")',
    );
    expect(moveHandler).toContain("vertex.id === selectedVertexId ? { ...vertex, point } : vertex");
    expect(moveHandler).toContain("removeCapture(selectedVertexId)");
    expect(moveHandler).toContain('kind: "MOVE", vertexId: selectedVertexId');
    expect(moveHandler).not.toContain("panoramaLat");
    expect(moveHandler).not.toContain("panoramaLng");
    expect(workspace).toContain("selectVertexForMove(vertex.id)");
    expect(workspace).not.toContain('role !== "INTERMEDIATE" || hasPendingCandidate} onClick={() => selectVertexForMove');
  });

  test("moving a node revokes validation and requires a replacement capture", () => {
    const pendingCapture = sourceBetween("const beginPendingCapture", "const handleMapClick");
    expect(pendingCapture).toContain("setGeometryConfirmed(false)");
    expect(workspace).toContain("Este nodo requiere una nueva captura Street View antes de validar la geometría.");
    expect(workspace).toContain('[activeVertexId]: payload');
  });

  test("nearest segment calculation inserts a PI in the correct territorial order", () => {
    const path = [
      { lat: 21.88, lng: -102.3 },
      { lat: 21.88, lng: -102.29 },
      { lat: 21.89, lng: -102.29 },
    ];
    const nearest = findNearestCorridorSegment({ lat: 21.887, lng: -102.29005 }, path);
    expect(nearest?.segmentIndex).toBe(1);
    expect(nearest?.distanceMeters).toBeLessThan(10);

    const insertionHandler = sourceBetween('pendingOperation.kind === "INSERT"', '} else {');
    expect(insertionHandler).toContain("next.splice(pendingOperation.insertIndex, 0");
    expect(insertionHandler).toContain("id: pendingOperation.vertexId");
    expect(insertionHandler).toContain("point: pendingPoint");
  });

  test("PI candidates receive stable local IDs and must be close to the selected segment", () => {
    const addHandler = sourceBetween(
      'if (isEditing && editAction === "ADD_PI")',
      "if (isEditing || !canSelectInitialPoint)",
    );
    expect(addHandler).toContain("findNearestCorridorSegment(point, vertexPath)");
    expect(addHandler).toContain("MAX_INSERT_DISTANCE_METERS");
    expect(addHandler).toContain("nextVertexId.current++");
    expect(addHandler).toContain("nearestSegment.segmentIndex + 1");
  });

  test("deleting a PI requires two institutional confirmations", () => {
    expect(workspace).toContain("CEIPOLConfirmModal");
    expect(workspace).toContain('isOpen={deleteConfirmationStage === 1}');
    expect(workspace).toContain('onConfirm={() => setDeleteConfirmationStage(2)}');
    expect(workspace).toContain('isOpen={deleteConfirmationStage === 2}');
    expect(workspace).toContain("¿Desea eliminar este punto intermedio?");
    expect(workspace).toContain("¿Confirma la eliminación definitiva?");
  });

  test("only PI can be deleted and its capture alone is removed", () => {
    const requestDeletion = sourceBetween("const requestVertexDeletion", "const cancelVertexDeletion");
    const confirmDeletion = sourceBetween("const confirmVertexDeletion", "const vertexRole");
    expect(requestDeletion).toContain('!== "INTERMEDIATE"');
    expect(confirmDeletion).toContain('!== "INTERMEDIATE"');
    expect(confirmDeletion).toContain("current.filter((vertex) => vertex.id !== deleteCandidateId)");
    expect(confirmDeletion).toContain("removeCapture(deleteCandidateId)");
    expect(workspace).toContain('disabled={role !== "INTERMEDIATE" || hasPendingCandidate}');
    expect(assessCorridorIntegrity([ni, nf]).isValid).toBe(true);
  });

  test("StreetViewCapturePayload contract is consumed but never redefined", () => {
    expect(workspace).toContain('import type { StreetViewCapturePayload }');
    expect(workspace).not.toMatch(/(?:interface|type)\s+StreetViewCapturePayload/);
  });

  test("Individual and IN SITU remain untouched by the linear editor", () => {
    expect(individualWorkspace).not.toContain("isEditing");
    expect(individualWorkspace).not.toContain("findNearestCorridorSegment");
    expect(projectList).toContain('setProjectCreationMode("IN_SITU")');
    expect(projectList).toContain("const newId = await createProject({");
    expect(projectList).not.toContain("findNearestCorridorSegment");
  });
});
