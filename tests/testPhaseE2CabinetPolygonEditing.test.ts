import fs from "node:fs";
import path from "node:path";
import {
  assessPolygonIntegrity,
  findNearestPolygonSegment,
  hasConsecutivePolygonDuplicates,
  hasSelfIntersection,
  polygonAreaSquareMeters,
} from "../src/components/cabinet/cabinetPolygonGeometry";

const workspace = fs.readFileSync(
  path.join(process.cwd(), "src/components/cabinet/CabinetPolygonWorkspace.tsx"),
  "utf8",
);

function sourceBetween(start: string, end: string) {
  const startIndex = workspace.indexOf(start);
  const endIndex = workspace.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return workspace.slice(startIndex, endIndex);
}

const square = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 0.01 },
  { lat: 0.01, lng: 0.01 },
  { lat: 0.01, lng: 0 },
];

describe("Phase E2.1 - polygon geometry helper", () => {
  test("nearest segment includes ordinary edges and returns their insertion position", () => {
    const nearest = findNearestPolygonSegment({ lat: 0.005, lng: 0.01001 }, square);
    expect(nearest?.segmentIndex).toBe(1);
    expect((nearest?.segmentIndex ?? -1) + 1).toBe(2);
    expect(nearest?.distanceMeters).toBeLessThan(2);
  });

  test("closing edge Vn to V1 returns n - 1 and inserts at the array end", () => {
    const nearest = findNearestPolygonSegment({ lat: 0.005, lng: -0.00001 }, square);
    expect(nearest?.segmentIndex).toBe(square.length - 1);
    expect((nearest?.segmentIndex ?? -1) + 1).toBe(square.length);
  });

  test("self-intersection detects crossing non-adjacent edges", () => {
    const bowTie = [square[0], square[2], square[1], square[3]];
    expect(hasSelfIntersection(square)).toBe(false);
    expect(hasSelfIntersection(bowTie)).toBe(true);
    expect(assessPolygonIntegrity(bowTie).isValid).toBe(false);
  });

  test("collinear overlap between non-adjacent edges is an intersection", () => {
    const overlapping = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.02 },
      { lat: 0.01, lng: 0.02 },
      { lat: 0, lng: 0.005 },
      { lat: 0, lng: 0.015 },
      { lat: 0.01, lng: 0 },
    ];
    expect(hasSelfIntersection(overlapping)).toBe(true);
  });

  test("metric shoelace area detects degenerate polygons", () => {
    const collinear = [
      { lat: 0, lng: 0 },
      { lat: 0.001, lng: 0.001 },
      { lat: 0.002, lng: 0.002 },
    ];
    expect(polygonAreaSquareMeters(square)).toBeGreaterThan(1_000_000);
    expect(polygonAreaSquareMeters(collinear)).toBeLessThanOrEqual(0.01);
    expect(assessPolygonIntegrity(collinear).isDegenerate).toBe(true);
  });

  test("consecutive duplicates include the closing Vn to V1 pair", () => {
    expect(hasConsecutivePolygonDuplicates([square[0], square[0], square[1]])).toBe(true);
    expect(hasConsecutivePolygonDuplicates([square[0], square[1], square[2], square[0]])).toBe(true);
    expect(assessPolygonIntegrity(square).hasConsecutiveDuplicates).toBe(false);
  });
});

describe("Phase E2.1 - polygon structural editing workspace", () => {
  test("editing mode exposes MOVE, ADD_VERTEX, DELETE_VERTEX and finalization", () => {
    expect(workspace).toContain('type PolygonEditAction = "MOVE" | "ADD_VERTEX" | "DELETE_VERTEX" | null');
    expect(workspace).toContain("const [isEditing, setIsEditing]");
    expect(workspace).toContain("Mover vértice");
    expect(workspace).toContain("Agregar vértice sobre arista");
    expect(workspace).toContain("Borrar vértice");
    expect(workspace).toContain("Finalizar edición");
  });

  test("moving preserves ID and array position while changing only point", () => {
    const moveHandler = sourceBetween(
      'if (isEditing && editAction === "MOVE" && selectedVertexId)',
      'if (isEditing && editAction === "ADD_VERTEX")',
    );
    expect(moveHandler).toContain("vertex.id === selectedVertexId ? { ...vertex, point } : vertex");
    expect(moveHandler).toContain("removeCapture(selectedVertexId)");
    expect(moveHandler).toContain('kind: "MOVE", vertexId: selectedVertexId');
    expect(moveHandler).not.toMatch(/panoramaLat|panoramaLng/);
  });

  test("moving invalidates only its capture and keeps all other keyed captures", () => {
    const removeCapture = sourceBetween("const removeCapture", "const beginPendingCapture");
    expect(removeCapture).toContain("const next = { ...current }");
    expect(removeCapture).toContain("delete next[vertexId]");
    expect(removeCapture).toContain("return next");
    expect(workspace).toContain("Este vértice requiere una nueva captura Street View.");
  });

  test("insertion uses nearest edge, stable ID and splice instead of always appending", () => {
    const addHandler = sourceBetween(
      'if (isEditing && editAction === "ADD_VERTEX")',
      'if (workflowStep !== "BUILDING"',
    );
    const captureHandler = sourceBetween("const handleCapture", "const prepareNextVertex");
    expect(addHandler).toContain("findNearestPolygonSegment(point, vertexPath)");
    expect(addHandler).toContain("nearestSegment.segmentIndex + 1");
    expect(addHandler).toContain("nextVertexId.current++");
    expect(addHandler).toContain("MAX_INSERT_DISTANCE_METERS");
    expect(captureHandler).toContain("next.splice(pendingOperation.insertIndex, 0");
    expect(captureHandler).toContain("id: pendingOperation.vertexId");
  });

  test("deletion uses double confirmation, preserves IDs and cannot leave fewer than three", () => {
    const requestDeletion = sourceBetween("const requestVertexDeletion", "const cancelVertexDeletion");
    const confirmDeletion = sourceBetween("const confirmVertexDeletion", "const integrityMessages");
    expect(workspace).toContain("CEIPOLConfirmModal");
    expect(workspace).toContain('isOpen={deleteConfirmationStage === 1}');
    expect(workspace).toContain('onConfirm={() => setDeleteConfirmationStage(2)}');
    expect(workspace).toContain('isOpen={deleteConfirmationStage === 2}');
    expect(requestDeletion).toContain("vertices.length <= 3");
    expect(confirmDeletion).toContain("vertices.length <= 3");
    expect(confirmDeletion).toContain("current.filter((vertex) => vertex.id !== deleteCandidateId)");
    expect(confirmDeletion).toContain("removeCapture(deleteCandidateId)");
  });

  test("invalid geometry remains visible but blocks finalization and validation", () => {
    expect(workspace).toContain("paths={vertexPath}");
    expect(workspace).toContain("disabled={!canFinishEditing}");
    expect(workspace).toContain("disabled={!canValidateGeometry || geometryConfirmed}");
    expect(workspace).toContain("canonicalPreview.canConfirm");
    expect(workspace).toContain("localIntegrity.isValid");
    expect(workspace).toContain("AUTO-INTERSECCIÓN DETECTADA");
    expect(workspace).toContain("ÁREA DEGENERADA");
    expect(workspace).toContain("VÉRTICES DUPLICADOS");
    expect(workspace).toContain("CAPTURAS PENDIENTES");
    expect(workspace).toContain("GEOMETRÍA VÁLIDA");
  });

  test("Street View stays keyed by vertex and territorial geometry never uses camera coordinates", () => {
    expect(workspace).toContain("[activeVertexId]: payload");
    expect(workspace).toContain("vertices.map((vertex) => vertex.point)");
    expect(workspace).toContain("capture.panoramaLat.toFixed(6)");
    expect(workspace).toContain("capture.panoramaLng.toFixed(6)");
    expect(sourceBetween("const handleMapClick", "const handleCapture")).not.toMatch(/panoramaLat|panoramaLng/);
  });

  test("editing remains local with no creation or persistence access", () => {
    expect(workspace).not.toMatch(/createProject|updateProject/);
    expect(workspace).not.toMatch(/firebase|firestore|storage/i);
    expect(workspace).not.toMatch(/AlbumPhoto|mapStreetViewToAlbumPhoto/);
    expect(workspace).not.toContain("ProjectContext");
    expect(workspace).not.toContain("useProject");
  });
});
