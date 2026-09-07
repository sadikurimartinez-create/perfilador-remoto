import fs from "node:fs";
import path from "node:path";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function extractCallback(source: string) {
  const start = source.indexOf("const persistHistoricalGeographyReconciliationForProject = useCallback");
  const end = source.indexOf("const saveHumanHypothesis", start);
  if (start < 0 || end < 0) {
    throw new Error("PERSIST_HISTORICAL_GEOGRAPHY_CALLBACK_NOT_FOUND");
  }
  return source.slice(start, end);
}

describe("QA-06.03D.3 ProjectContext historical geography reconciliation integration", () => {
  const projectContext = readSource("src/context/ProjectContext.tsx");
  const service = readSource("src/services/historicalGeographyReconciliationService.ts");
  const canonicalGeography = readSource("src/utils/canonicalProjectGeography.ts");
  const callback = extractCallback(projectContext);

  test("imports the certified service and domain type without duplicating domain logic", () => {
    expect(projectContext).toContain("persistHistoricalGeographyReconciliation");
    expect(projectContext).toContain("buildHistoricalGeographyReconciliationAuditDetails");
    expect(projectContext).toContain("type { HistoricalGeographyReconciliation }");
    expect(callback).not.toContain("buildCanonicalProjectGeography");
    expect(callback).not.toContain("LineString");
    expect(callback).not.toContain("sourceObjectPath:");
  });

  test("ProjectContextValue exposes a specific persistence operation", () => {
    expect(projectContext).toContain("persistHistoricalGeographyReconciliationForProject: (");
    expect(projectContext).toContain("projectId: string");
    expect(projectContext).toContain("reconciliation: HistoricalGeographyReconciliation");
    expect(projectContext).toContain("Promise<Awaited<ReturnType<typeof persistHistoricalGeographyReconciliation>>>");
  });

  test("valid confirmed reconciliation calls the service exactly through the specific callback path", () => {
    expect(callback).toContain("if (reconciliation.status !== \"CONFIRMED\")");
    expect(callback).toContain("persistHistoricalGeographyReconciliation({");
    expect(callback).toContain("projectId,");
    expect(callback).toContain("reconciliation,");
  });

  test("persisted result updates only local canonical geography fields for the matching active project", () => {
    expect(callback).toContain("if (!prev || prev.id !== projectId) return prev");
    expect(callback).toContain("canonicalGeography: result.canonicalGeography");
    expect(callback).toContain("geographyId: result.geographyId");
    expect(callback).toContain("geographyValidationStatus: result.geographyValidationStatus");
    expect(callback).toContain("historicalGeographyReconciliation: result.historicalGeographyReconciliation");
    expect(callback).not.toContain("latitude:");
    expect(callback).not.toContain("longitude:");
    expect(callback).not.toContain("geographicEntities");
  });

  test("report readiness is recalculated only from the updated local project", () => {
    expect(callback).toContain("reportReadyAssessment: assessReportReadiness({ ...updatedProject, album, documents })");
  });

  test("success audit log records the historical reconciliation event with structured traceability", () => {
    expect(callback).toContain("action: \"RECONCILIAR_GEOGRAFIA_HISTORICA\"");
    expect(callback).toContain("module: \"Geografía\"");
    expect(callback).toContain("result: \"ÉXITO\"");
    expect(callback).toContain("JSON.stringify({");
    expect(callback).toContain("geographyId: result.geographyId");
    expect(callback).toContain("sourceRefs: result.sourceRefs");
    expect(callback).toContain("source: \"HISTORICAL_RECONCILIATION\"");
    expect(callback).toContain("GPS histórico tratado como candidato de reconciliación; no promovido automáticamente a VERTEX.");
  });

  test("domain or service errors do not update state and are audited as BLOQUEADO before rethrow", () => {
    const catchIndex = callback.indexOf("catch (err)");
    const catchBlock = callback.slice(catchIndex);
    expect(catchBlock).toContain("result: \"BLOQUEADO\"");
    expect(catchBlock).toContain("errorCode");
    expect(catchBlock).toContain("throw err");
    expect(catchBlock).not.toContain("setProject");
  });

  test("non-CONFIRMED reconciliation is blocked before service invocation", () => {
    const statusGate = callback.indexOf("if (reconciliation.status !== \"CONFIRMED\")");
    const serviceCall = callback.indexOf("const result = await persistHistoricalGeographyReconciliation");
    expect(statusGate).toBeGreaterThan(-1);
    expect(serviceCall).toBeGreaterThan(statusGate);
    expect(callback).toContain("HISTORICAL_GEOGRAPHY_NOT_CONFIRMED");
  });

  test("context value and useMemo dependencies include the new operation", () => {
    const valueStart = projectContext.indexOf("const value = useMemo<ProjectContextValue>");
    const valueBlock = projectContext.slice(valueStart);
    expect(valueBlock).toContain("persistHistoricalGeographyReconciliationForProject,");
    expect((valueBlock.match(/persistHistoricalGeographyReconciliationForProject/g) || []).length).toBe(2);
  });

  test("createProject and adaptLegacyProjectGeography are not repurposed for historical reconciliation", () => {
    const createProjectStart = projectContext.indexOf("const createProject = useCallback");
    const createProjectEnd = projectContext.indexOf("const assignHistoricalNumeroExpediente", createProjectStart);
    const createProject = projectContext.slice(createProjectStart, createProjectEnd);
    expect(createProject).not.toContain("persistHistoricalGeographyReconciliation");
    expect(canonicalGeography).toContain(".filter((entity) => entity?.type === \"VERTEX\" || entity?.metadata?.isVertex === true)");
    expect(canonicalGeography).not.toContain("sourceType === \"IN_SITU_PHOTO_GPS\"");
  });

  test("service persists only approved project fields", () => {
    expect(service).toContain("await updateDoc(projectRef, patch)");
    expect(service).toContain("canonicalGeography,");
    expect(service).toContain("geographyId: canonicalGeography.geographyId");
    expect(service).toContain("geographyValidationStatus: canonicalGeography.validationStatus");
    expect(service).toContain("historicalGeographyReconciliation:");
    expect(service).not.toContain("latitude:");
    expect(service).not.toContain("longitude:");
    expect(service).not.toContain("geographicEntities");
  });
});
