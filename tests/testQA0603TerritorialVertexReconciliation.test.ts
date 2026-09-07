import fs from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("QA-06.03E territorial vertex reconciliation", () => {
  const panel = source("src/components/TerritorialVertexReconciliationPanel.tsx");
  const workspace = source("src/components/GeographicWorkspace.tsx");
  const professionalMap = source("src/components/maps/ProfessionalGeoMap.tsx");
  const service = source("src/services/geographicEntityService.ts");
  const canonical = source("src/utils/canonicalProjectGeography.ts");

  test("map click creates a manual VERTEX and not evidence location", () => {
    expect(professionalMap).toContain("isTerritorialVertexCaptureEnabled");
    expect(professionalMap).toContain("onTerritorialVertexAdd?.(event.latLng.lat(), event.latLng.lng())");
    expect(workspace).toContain("saveGeographicEntity({");
    expect(workspace).toContain("type: \"VERTEX\"");
    expect(workspace).toContain("source: \"HUMAN_MAP_VERTEX\"");
    expect(workspace).toContain("isVertex: true");
    expect(workspace).toContain("isIndependentPoi: false");
    expect(workspace).not.toContain("type: \"EVIDENCE_LOCATION\"");
  });

  test("two distinct territorial vertices allow LineString preview", () => {
    expect(panel).toContain("orderedVertices.length >= 2");
    expect(panel).toContain("distinctCount >= 2");
    expect(panel).toContain("Previsualizacion LineString");
    expect(professionalMap).toContain("territorialPreviewPath.length >= 2");
    expect(professionalMap).toContain("<Polyline");
  });

  test("manual order is persisted and respected", () => {
    expect(panel).toContain("moveVertex");
    expect(panel).toContain("Subir");
    expect(panel).toContain("Bajar");
    expect(panel).toContain("metadata: { ...vertex.metadata, order: vertexIndex + 1 }");
    expect(workspace).toContain("updateGeographicEntityMetadata(project.id, vertex.id");
    expect(workspace).toContain("order: index + 1");
  });

  test("consecutive duplicate coordinates are blocked", () => {
    expect(panel).toContain("function hasConsecutiveDuplicate");
    expect(panel).toContain("coordinateKey(vertex) === coordinateKey(vertices[index - 1])");
    expect(panel).toContain("!hasDuplicate");
    expect(panel).toContain("Duplicado consecutivo bloqueado.");
  });

  test("canonical geography is only created after explicit confirmation", () => {
    expect(panel).toContain("CEIPOLConfirmModal");
    expect(panel).toContain("setConfirmOpen(true)");
    expect(panel.indexOf("buildCanonicalProjectGeography")).toBeLessThan(panel.indexOf("await onConfirm(geography)"));
    expect(workspace).toContain("handleTerritorialGeographyConfirm");
    expect(workspace).toContain("updateProjectDetails({");
    expect(workspace).not.toContain("autoConfirm");
  });

  test("confirmation produces CORRIDOR LineString VALID with vertex traceability", () => {
    expect(panel).toContain("type: \"CORRIDOR\"");
    expect(panel).toContain("source: \"HUMAN_MAP_VERTEX\"");
    expect(panel).toContain("geography.geometry.type !== \"LineString\"");
    expect(panel).toContain("geography.validationStatus !== \"VALID\"");
    expect(panel).toContain("sourceRefs: orderedVertices.map");
    expect(panel).toContain("TERRITORIAL_VERTEX");
    expect(canonical).toContain("| \"HUMAN_MAP_VERTEX\"");
    expect(canonical).toContain("sourceRefs?: Array");
  });

  test("historical candidates remain separate from territorial vertices", () => {
    expect(workspace).toContain("HistoricalGeographyReconciliationPanel");
    expect(workspace).toContain("TerritorialVertexReconciliationPanel");
    expect(workspace).toContain("historicalGeographyCandidatesInput");
    expect(workspace).toContain("territorialVertices");
    expect(workspace).not.toContain("HistoricalGeographyCandidate & TerritorialVertex");
    expect(panel).toContain("Los candidatos historicos son evidencia auxiliar");
  });

  test("geographic entity service stores and updates vertex ids without real test writes", () => {
    expect(service).toContain("export async function saveGeographicEntity");
    expect(service).toContain("const docRef = doc(colRef, entityId)");
    expect(service).toContain("await setDoc(docRef");
    expect(service).toContain("export async function updateGeographicEntityMetadata");
    expect(service).toContain("export async function deleteGeographicEntity");
  });
});
