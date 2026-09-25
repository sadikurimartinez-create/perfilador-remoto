import fs from "node:fs";
import path from "node:path";
import {
  createCabinetContextPoi,
  createCabinetContextPoiId,
  moveCabinetContextPoi,
  updateCabinetContextPoi,
} from "../src/components/cabinet/cabinetContextPoi";

const cabinetDir = path.join(process.cwd(), "src/components/cabinet");
const helper = fs.readFileSync(path.join(cabinetDir, "cabinetContextPoi.ts"), "utf8");
const individual = fs.readFileSync(path.join(cabinetDir, "CabinetIndividualWorkspace.tsx"), "utf8");
const linear = fs.readFileSync(path.join(cabinetDir, "CabinetLinearWorkspace.tsx"), "utf8");
const polygon = fs.readFileSync(path.join(cabinetDir, "CabinetPolygonWorkspace.tsx"), "utf8");
const workspaces = [individual, linear, polygon];

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

const point = { lat: 21.88, lng: -102.29 };
const movedPoint = { lat: 21.89, lng: -102.3 };

describe("Phase G1.1 - shared contextual POI contract", () => {
  test("1. CabinetContextPoi contract exists with independent fields", () => {
    expect(helper).toContain("export interface CabinetContextPoi");
    expect(helper).toContain("id: string");
    expect(helper).toContain("point: LatLngPoint");
    expect(helper).toContain("label: string");
    expect(helper).toContain("description?: string");
  });

  test("2. contract reuses LatLngPoint instead of defining coordinates again", () => {
    expect(helper).toContain('import type { LatLngPoint } from "@/utils/canonicalProjectGeography"');
    expect(helper).not.toMatch(/(?:interface|type)\s+LatLngPoint/);
  });

  test("3. generated IDs are deterministic and remain stable", () => {
    expect(createCabinetContextPoiId(4)).toBe("cabinet-context-poi-4");
    expect(createCabinetContextPoiId(4)).toBe(createCabinetContextPoiId(4));
    expect(createCabinetContextPoiId(5)).not.toBe(createCabinetContextPoiId(4));
  });

  test("15. editing label preserves ID and point", () => {
    const poi = createCabinetContextPoi("poi-1", point, " Escuela ", "Referencia");
    const edited = updateCabinetContextPoi(poi, { label: "Acceso", description: poi.description });
    expect(edited).toMatchObject({ id: "poi-1", point, label: "Acceso" });
  });

  test("16. editing description preserves ID and point", () => {
    const poi = createCabinetContextPoi("poi-1", point, "Escuela", "Anterior");
    const edited = updateCabinetContextPoi(poi, { label: poi.label, description: " Nueva " });
    expect(edited).toEqual({ ...poi, description: "Nueva" });
  });

  test("17. MOVE_POI preserves ID", () => {
    const poi = createCabinetContextPoi("poi-1", point, "Escuela", "Referencia");
    expect(moveCabinetContextPoi(poi, movedPoint).id).toBe(poi.id);
  });

  test("18. MOVE_POI preserves label and description metadata", () => {
    const poi = createCabinetContextPoi("poi-1", point, "Escuela", "Referencia");
    expect(moveCabinetContextPoi(poi, movedPoint)).toEqual({ ...poi, point: movedPoint });
  });
});

describe("Phase G1.1 - contextual POIs in all cabinet workspaces", () => {
  test("4. Individual can add a contextual POI", () => {
    expect(individual).toContain('setMapActionMode("ADD_POI")');
    expect(individual).toContain("createCabinetContextPoi(id, pendingPoiPoint");
  });

  test("5. Individual supports multiple contextual POIs", () => {
    expect(individual).toContain("setContextPois((current) => [");
    expect(individual).toContain("...current");
    expect(individual).toContain("contextPois.map((poi)");
  });

  test("6. ADD_POI in Individual returns before changing the territorial candidate", () => {
    const handler = sourceBetween(individual, "const handleMapClick", "const savePoi");
    expect(handler.indexOf('mapActionMode === "ADD_POI"')).toBeLessThan(handler.indexOf("setCandidate(point)"));
    const addBranch = sourceBetween(handler, 'if (mapActionMode === "ADD_POI")', 'if (mapActionMode === "MOVE_POI"');
    expect(addBranch).not.toMatch(/setCandidate|setCapture|setValidated/);
  });

  test("7. Lineal accepts a contextual POI without line proximity constraints", () => {
    const addBranch = sourceBetween(linear, 'if (mapActionMode === "ADD_POI")', 'if (mapActionMode === "MOVE_POI"');
    expect(addBranch).toContain("setPendingPoiPoint(point)");
    expect(addBranch).not.toMatch(/findNearestCorridorSegment|MAX_INSERT_DISTANCE_METERS/);
  });

  test("8. a Lineal POI never creates a PI", () => {
    const addBranch = sourceBetween(linear, 'if (mapActionMode === "ADD_POI")', 'if (mapActionMode === "MOVE_POI"');
    expect(addBranch).not.toMatch(/setVertices|beginPendingCapture|INSERT|APPEND/);
  });

  test("9. a Lineal POI never modifies NI", () => {
    const poiSave = sourceBetween(linear, "const savePoi", "const confirmPoiDeletion");
    expect(poiSave).not.toMatch(/vertices|corridorVertexRole|captureByVertexId/);
  });

  test("10. a Lineal POI never modifies NF", () => {
    const moveBranch = sourceBetween(linear, 'if (mapActionMode === "MOVE_POI"', "if (isEditing && editAction");
    expect(moveBranch).toContain("moveCabinetContextPoi");
    expect(moveBranch).not.toMatch(/setVertices|workflowStep|pendingOperation/);
  });

  test("11. Polygon accepts contextual POIs inside its area", () => {
    expect(polygon).toContain("Seleccione cualquier ubicación dentro o fuera del polígono.");
    expect(polygon).toContain("setPendingPoiPoint(point)");
  });

  test("12. Polygon accepts contextual POIs outside without topology restrictions", () => {
    const addBranch = sourceBetween(polygon, 'if (mapActionMode === "ADD_POI")', 'if (mapActionMode === "MOVE_POI"');
    expect(addBranch).not.toMatch(/findNearestPolygonSegment|MAX_INSERT_DISTANCE_METERS|canonicalPreview/);
  });

  test("13. Polygon POI operations do not modify vertices", () => {
    const poiSave = sourceBetween(polygon, "const savePoi", "const confirmPoiDeletion");
    expect(poiSave).not.toMatch(/setVertices|captureByVertexId|setGeometryConfirmed/);
  });

  test("14. Polygon paths continue to derive only from territorial vertices", () => {
    expect(polygon).toContain("const vertexPath = useMemo(() => vertices.map((vertex) => vertex.point), [vertices])");
    expect(polygon).toContain("paths={vertexPath}");
    expect(polygon).not.toMatch(/paths=\{contextPois/);
  });

  test("19. deletion filters only the selected contextual POI", () => {
    workspaces.forEach((workspace) => {
      const deletion = sourceBetween(workspace, "const confirmPoiDeletion", "const handleCapture");
      expect(deletion).toContain("current.filter((poi) => poi.id !== poiDeleteCandidateId)");
      expect(deletion).not.toMatch(/setVertices|setCandidate|removeCapture/);
    });
  });

  test("20. contextual POIs use an amber marker explicitly labelled POI", () => {
    workspaces.forEach((workspace) => {
      expect(workspace).toContain('fillColor: "#f59e0b"');
      expect(workspace).toContain('label={{ text: "POI"');
      expect(workspace).toContain("title={`POI — ${poi.label}`}");
    });
  });

  test("21. ADD_POI and MOVE_POI never open territorial Street View", () => {
    workspaces.forEach((workspace) => {
      const addBranch = sourceBetween(workspace, 'if (mapActionMode === "ADD_POI")', 'if (mapActionMode === "MOVE_POI"');
      expect(addBranch).not.toMatch(/StreetView|setIsStreetViewOpen|handleCapture/);
      const moveBranch = sourceBetween(workspace, 'if (mapActionMode === "MOVE_POI"', "resetPoiInteraction();\n      return;");
      expect(moveBranch).not.toMatch(/StreetView|setIsStreetViewOpen|handleCapture/);
    });
  });

  test("22. implementation remains local with no persistence or evidence contract", () => {
    const allSources = [helper, ...workspaces].join("\n");
    expect(allSources).not.toMatch(/createProject|updateProject|createGeographicEntity|ProjectContext/);
    expect(allSources).not.toMatch(/firebase|firestore|storage|AlbumPhoto/i);
  });

  test("23. contextual POIs never enter canonical geometry and all actions are exposed", () => {
    workspaces.forEach((workspace) => {
      expect(workspace).toContain("Agregar POI");
      expect(workspace).toContain(">Editar</CEIPOLButton>");
      expect(workspace).toContain(">Mover</CEIPOLButton>");
      expect(workspace).toContain(">Eliminar</CEIPOLButton>");
      expect(workspace).toContain('useState<CabinetMapActionMode>("GEOMETRY")');
      expect(workspace).not.toMatch(/(?:geometry|vertices|coordinates):\s*contextPois/);
    });
    expect(helper).not.toMatch(/CanonicalProjectGeography|DraftProjectGeography|buildDraftGeographyPreview/);
  });
});
