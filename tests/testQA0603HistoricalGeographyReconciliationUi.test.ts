import fs from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("QA-06.03D.4B historical geography reconciliation UI", () => {
  const panel = source("src/components/HistoricalGeographyReconciliationPanel.tsx");
  const candidateLayer = source("src/components/maps/layers/HistoricalGeographyCandidateLayer.tsx");
  const professionalMap = source("src/components/maps/ProfessionalGeoMap.tsx");
  const workspace = source("src/components/GeographicWorkspace.tsx");
  const projectMap = source("src/components/ProjectMap.tsx");
  const projectContext = source("src/context/ProjectContext.tsx");
  const domain = source("src/utils/historicalGeographyReconciliation.ts");
  const haciendaCaller = source("src/app/admin/historical-recovery/hacienda-san-marcos/page.tsx");
  const historicalResolutionBlock = workspace.slice(
    workspace.indexOf("const persistedHistoricalCandidates"),
    workspace.indexOf("React.useEffect(() => {\n    setHistoricalMapCandidates")
  );

  test("panel reuses certified domain functions and does not create vertices", () => {
    expect(panel).toContain("createHistoricalGeographyReconciliation");
    expect(panel).toContain("selectHistoricalGeographyCandidates");
    expect(panel).toContain("discardHistoricalGeographyCandidates");
    expect(panel).toContain("confirmHistoricalGeographyReconciliation");
    expect(panel).not.toContain("isVertex");
    expect(panel).not.toContain("\"VERTEX\"");
    expect(panel).not.toContain("metadata.isVertex");
  });

  test("selection, discard and manual order are explicit UI actions", () => {
    expect(panel).toContain("toggleCandidate");
    expect(panel).toContain("discardCandidate");
    expect(panel).toContain("moveCandidate");
    expect(panel).toContain("Seleccionar");
    expect(panel).toContain("Descartar");
    expect(panel).toContain("Subir");
    expect(panel).toContain("Bajar");
    expect(panel).not.toContain(".sort(");
    expect(panel).not.toContain("nearest");
    expect(panel).not.toContain("timestamp");
  });

  test("confirmation modal gates persistence and enforces minimum two selected candidates", () => {
    expect(panel).toContain("CEIPOLConfirmModal");
    expect(panel).toContain("Confirmar geografia historica");
    expect(panel).toContain("selectedCandidates.length >= 2");
    expect(panel).toContain("setConfirmOpen(true)");
    expect(panel).toContain("await onPersist(confirmed)");
    expect(panel.indexOf("confirmHistoricalGeographyReconciliation")).toBeLessThan(panel.indexOf("await onPersist(confirmed)"));
  });

  test("preview is explicitly non-canonical and separate from persistence", () => {
    expect(panel).toContain("Previsualizacion - no geografia canonica");
    expect(professionalMap).toContain("historicalPreviewPath");
    expect(professionalMap).toContain("HistoricalGeographyCandidateLayer");
    expect(candidateLayer).toContain("<Polyline");
    expect(candidateLayer).not.toContain("RectorGeometryLayer");
    expect(candidateLayer).not.toContain("canonicalGeography");
  });

  test("candidate layer renders candidate states without POI or evidence-location semantics", () => {
    expect(candidateLayer).toContain("selectedCandidateIds");
    expect(candidateLayer).toContain("discardedCandidateIds");
    expect(candidateLayer).toContain("DISCOVERED");
    expect(candidateLayer).toContain("DISCARDED");
    expect(candidateLayer).toContain("label={order");
    expect(candidateLayer).not.toContain("POI");
    expect(candidateLayer).not.toContain("EVIDENCE_LOCATION");
    expect(candidateLayer).not.toContain("\"VERTEX\"");
  });

  test("GeographicWorkspace has a backward-compatible optional candidate input", () => {
    expect(workspace).toContain("export type GeographicWorkspaceProps");
    expect(workspace).toContain("historicalGeographyCandidatesInput?: HistoricalGeographyCandidate[]");
    expect(workspace).toContain("export function GeographicWorkspace({");
    expect(workspace).toContain("historicalGeographyCandidatesInput = []");
    expect(workspace).toContain("}: GeographicWorkspaceProps = {})");
  });

  test("GeographicWorkspace resolves empty candidates without external input or persisted reconciliation", () => {
    expect(workspace).toContain("const persistedHistoricalCandidates = project?.historicalGeographyReconciliation?.candidates ?? []");
    expect(workspace).toContain("historicalGeographyCandidatesInput = []");
    expect(workspace).toContain("return persistedHistoricalCandidates");
  });

  test("external candidates can feed the panel before persisted reconciliation exists", () => {
    expect(workspace).toContain("if (project && historicalGeographyCandidatesInput.length > 0)");
    expect(workspace).toContain("candidates={historicalGeographyCandidates}");
    expect(workspace).toContain("project && historicalGeographyCandidates.length > 0");
  });

  test("external candidates have priority over persisted reconciliation candidates", () => {
    expect(workspace.indexOf("historicalGeographyCandidatesInput.length > 0")).toBeLessThan(
      workspace.indexOf("return persistedHistoricalCandidates")
    );
  });

  test("external and persisted candidate sources are not concatenated or deduplicated in workspace", () => {
    expect(workspace).not.toContain("historicalGeographyCandidatesInput.concat");
    expect(workspace).not.toContain("persistedHistoricalCandidates.concat");
    expect(workspace).not.toContain("[...historicalGeographyCandidatesInput");
    expect(workspace).not.toContain("[...persistedHistoricalCandidates");
    expect(workspace).not.toContain("new Set(");
  });

  test("external candidates from another project are excluded without reassignment", () => {
    expect(workspace).toContain("candidate.projectId === project.id");
    expect(workspace).not.toContain("projectId: project.id");
    expect(workspace).not.toMatch(/candidate\.projectId\s=[^=]/);
  });

  test("external input does not auto-select, create vertices or mutate canonical geography", () => {
    expect(workspace).toContain("setSelectedHistoricalCandidateIds([])");
    expect(historicalResolutionBlock).not.toContain("status: \"SELECTED\"");
    expect(historicalResolutionBlock).not.toContain("\"VERTEX\"");
    expect(historicalResolutionBlock).not.toContain("isVertex");
    expect(historicalResolutionBlock).not.toContain("canonicalGeography");
  });

  test("GeographicWorkspace consumes ProjectContext persistence only after panel confirmation", () => {
    expect(workspace).toContain("HistoricalGeographyReconciliationPanel");
    expect(workspace).toContain("persistHistoricalGeographyReconciliationForProject(project.id, reconciliation)");
    expect(panel).toContain("await onPersist(confirmed)");
    expect(workspace).not.toContain("listAll");
    expect(workspace).not.toContain("getMetadata");
    expect(workspace).not.toContain("exifr");
  });

  test("canonical existing state is passed as a blocker to panel", () => {
    expect(workspace).toContain("canonicalGeographyExists={project.canonicalGeography?.validationStatus === \"VALID\"}");
    expect(panel).toContain("canonicalGeographyExists");
    expect(panel).toContain("disabled={!canConfirm}");
  });

  test("map extension leaves rector geometry and modern flows separate", () => {
    expect(professionalMap).toContain("<RectorGeometryLayer visible={layers.rectorGeometry} geografiaRectora={geografiaRectora} />");
    expect(professionalMap).toContain("<HistoricalGeographyCandidateLayer");
    expect(professionalMap.indexOf("<HistoricalGeographyCandidateLayer")).toBeGreaterThan(professionalMap.indexOf("<StreetSelectionLayer"));
    expect(projectMap).toContain("isVertex: true");
  });

  test("certified ProjectContext and domain contracts remain available", () => {
    expect(projectContext).toContain("persistHistoricalGeographyReconciliationForProject");
    expect(domain).toContain("export function confirmHistoricalGeographyReconciliation");
    expect(domain).toContain("source: \"HISTORICAL_RECONCILIATION\"");
  });

  test("Hacienda caller keeps seven distinct candidates with five spatial groups", () => {
    expect(haciendaCaller.match(/candidateId: `hacienda-gps-/g)?.length).toBe(1);
    expect(haciendaCaller).toContain("padStart(2, \"0\")");
    expect(haciendaCaller).toContain("forensicSequence: index + 1");
    expect(haciendaCaller).toContain("Secuencia temporal de objeto Storage + coincidencia GPS EXIF exacta");
    expect(haciendaCaller.match(/spatialGroupId: "hacienda-node-/g)?.length).toBe(7);
    expect(haciendaCaller.match(/spatialGroupId: "hacienda-node-02"/g)?.length).toBe(2);
    expect(haciendaCaller.match(/spatialGroupId: "hacienda-node-03"/g)?.length).toBe(2);
    expect(haciendaCaller).not.toContain("deduplicateHistoricalGeographyCandidates");
  });

  test("panel shows forensic metadata as auxiliary governance without auto-selection", () => {
    expect(panel).toContain("Posiciones espaciales únicas");
    expect(panel).toContain("uniqueSpatialPositionCount");
    expect(panel).toContain("new Set(groupIds).size");
    expect(panel).toContain("Secuencia forense:");
    expect(panel).toContain("Grupo espacial:");
    expect(panel).toContain("Base forense:");
    expect(panel).toContain("La secuencia forense es una referencia auxiliar");
    expect(panel).toContain("La geometría sólo se vuelve canónica tras confirmación humana explícita");
    expect(panel).toContain("setSelectedIds([])");
    expect(panel).toContain("Previsualizacion - no geografia canonica");
  });
});
