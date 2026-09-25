import fs from "node:fs";
import path from "node:path";
import {
  buildDraftGeographyPreview,
  getCanonicalGeographyCoordinates,
} from "../src/utils/canonicalProjectGeography";

const workspacePath = path.join(process.cwd(), "src/components/cabinet/CabinetPolygonWorkspace.tsx");
const workspace = fs.readFileSync(workspacePath, "utf8");
const projectList = fs.readFileSync(path.join(process.cwd(), "src/components/ProjectList.tsx"), "utf8");

const v1 = { lat: 21.881, lng: -102.291 };
const v2 = { lat: 21.882, lng: -102.292 };
const v3 = { lat: 21.883, lng: -102.29 };

function sourceBetween(start: string, end: string) {
  const startIndex = workspace.indexOf(start);
  const endIndex = workspace.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return workspace.slice(startIndex, endIndex);
}

describe("Phase E1.1 - Cabinet polygon local workspace", () => {
  test("CABINET polygon mounts its workspace without changing other creation branches", () => {
    expect(projectList).toContain('projectCreationMode === "CABINET" && cabinetGeometryType === "poligono"');
    expect(projectList).toContain("<CabinetPolygonWorkspace");
    expect(projectList).toContain('setProjectCreationMode("IN_SITU")');
    expect(projectList).toContain('projectCreationMode === "CABINET" && cabinetGeometryType === "individual"');
    expect(projectList).toContain("<CabinetIndividualWorkspace");
    expect(projectList).toContain('projectCreationMode === "CABINET" && cabinetGeometryType === "lineal"');
    expect(projectList).toContain("<CabinetLinearWorkspace");
    expect(projectList).not.toContain("El espacio de trabajo de Gabinete se habilitará en la siguiente fase.");
  });

  test("workspace uses the governed Google Maps and Street View primitives", () => {
    expect(workspace).toContain("GoogleMap");
    expect(workspace).toContain("Marker");
    expect(workspace).toContain("Polygon");
    expect(workspace).toContain("useJsApiLoader");
    expect(workspace).toContain("StreetViewPanoramaPicker");
    expect(workspace).toContain("StreetViewCapturePayload");
  });

  test("local vertices use stable IDs and captures remain associated by vertex ID", () => {
    expect(workspace).toContain("const [vertices, setVertices]");
    expect(workspace).toContain("const [activeVertexId, setActiveVertexId]");
    expect(workspace).toContain("captureByVertexId");
    expect(workspace).toContain("cabinet-polygon-vertex-${nextVertexId.current++}");
    expect(workspace).toContain("[activeVertexId]: payload");
    expect(workspace).not.toMatch(/cabinet-polygon-vertex-.*(?:lat|lng|panorama)/);
  });

  test("V1, V2, V3 and later vertices enter state only after accepted capture", () => {
    const mapHandler = sourceBetween("const handleMapClick", "const handleCapture");
    const buildingHandler = mapHandler.slice(
      mapHandler.indexOf('if (workflowStep !== "BUILDING"'),
    );
    const captureHandler = sourceBetween("const handleCapture", "const prepareNextVertex");
    expect(buildingHandler).toContain("setPendingPoint(point)");
    expect(buildingHandler).toContain("setActiveVertexId(vertexId)");
    expect(buildingHandler).not.toContain("setVertices");
    expect(captureHandler).toContain("const acceptedVertex");
    expect(captureHandler).toContain("setVertices((current) => [...current, acceptedVertex])");
    expect(captureHandler).toContain("setPendingPoint(null)");
    expect(captureHandler).toContain("setActiveVertexId(null)");
  });

  test("fewer than three unique territorial positions cannot close", () => {
    const twoVertices = buildDraftGeographyPreview({
      type: "POLYGON",
      points: [v1, v2],
      confirmed: false,
    });
    const duplicateThird = buildDraftGeographyPreview({
      type: "POLYGON",
      points: [v1, v2, v1],
      confirmed: false,
    });
    expect(twoVertices.canConfirm).toBe(false);
    expect(duplicateThird.canConfirm).toBe(false);
    expect(workspace).toContain("vertices.length >= 3 && uniquePositionCount >= 3");
    expect(workspace).toContain("disabled={!canClosePolygon}");
  });

  test("canonical POLYGON preview governs closure without a new validator", () => {
    const preview = buildDraftGeographyPreview({
      type: "POLYGON",
      points: [v1, v2, v3],
      confirmed: false,
    });
    expect(preview.canConfirm).toBe(true);
    expect(workspace).toContain("buildDraftGeographyPreview({");
    expect(workspace).toContain('type: "POLYGON"');
    expect(workspace).toContain("canonicalPreview.canConfirm");
  });

  test("local state stays open while canonical GeoJSON closes the ring", () => {
    const vertexPathDeclaration = sourceBetween("const vertexPath =", "const canonicalPreview");
    expect(vertexPathDeclaration).toContain("vertices.map((vertex) => vertex.point)");
    expect(workspace).toContain("paths={vertexPath}");
    expect(workspace).not.toContain("[...vertices, vertices[0]]");
    expect(workspace).not.toContain("[...vertexPath, vertexPath[0]]");

    const preview = buildDraftGeographyPreview({ type: "POLYGON", points: [v1, v2, v3], confirmed: false });
    expect(preview.geometry.type).toBe("Polygon");
    if (preview.geometry.type === "Polygon") {
      expect(preview.geometry.coordinates[0][0]).toEqual(preview.geometry.coordinates[0].at(-1));
    }
    expect(getCanonicalGeographyCoordinates({
      geographyId: "preview",
      type: "POLYGON",
      geometry: preview.geometry,
      source: "PROJECT_CREATION",
      validationStatus: preview.validationStatus,
      createdAt: 0,
      updatedAt: 0,
    })).toEqual([v1, v2, v3]);
  });

  test("closing enters REVIEW and returning only reopens construction", () => {
    const closeHandler = sourceBetween("const closePolygon", "const returnToBuilding");
    const returnHandler = sourceBetween("const returnToBuilding", "return (");
    expect(workspace).toContain("Cerrar polígono");
    expect(closeHandler).toContain('setWorkflowStep("REVIEW")');
    expect(workspace).toContain('workflowStep === "REVIEW"');
    expect(workspace).toContain("Volver a construcción");
    expect(returnHandler).toContain('setWorkflowStep("BUILDING")');
    expect(returnHandler).toContain("setGeometryConfirmed(false)");
  });

  test("VALIDAR GEOMETRÍA requires review, integrity, complete captures and no candidate", () => {
    expect(workspace).toContain("allVerticesCaptured");
    expect(workspace).toContain("!hasPendingCandidate");
    expect(workspace).toContain("polygonIntegrityValid");
    expect(workspace).toContain('workflowStep === "REVIEW" && polygonIntegrityValid');
    expect(workspace).toContain("disabled={!canValidateGeometry || geometryConfirmed}");
    expect(workspace).toContain("setGeometryConfirmed(true)");
  });

  test("territorial vertices stay independent from Google camera coordinates", () => {
    expect(workspace).toContain("vertices.map((vertex) => vertex.point)");
    expect(workspace).toContain("vertex.point.lat.toFixed(6)");
    expect(workspace).toContain("vertex.point.lng.toFixed(6)");
    expect(workspace).toContain("capture.panoramaLat.toFixed(6)");
    expect(workspace).toContain("capture.panoramaLng.toFixed(6)");
    expect(sourceBetween("const handleMapClick", "const handleCapture")).not.toMatch(/panoramaLat|panoramaLng|poiLat|poiLng/);
  });

  test("workspace has no project creation, persistence or final evidence mapping", () => {
    expect(workspace).not.toMatch(/createProject|updateProject/);
    expect(workspace).not.toMatch(/firebase|firestore|storage/i);
    expect(workspace).not.toMatch(/AlbumPhoto|mapStreetViewToAlbumPhoto/);
    expect(workspace).not.toMatch(/ledger|outbox/i);
    expect(workspace).not.toContain("ProjectContext");
    expect(workspace).not.toContain("useProject");
  });
});
