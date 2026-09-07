import fs from "node:fs";
import path from "node:path";
import { assessReportReadiness } from "../src/utils/reportReadyGovernance";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function extractBlock(sourceText: string, startToken: string, endToken: string) {
  const start = sourceText.indexOf(startToken);
  const end = sourceText.indexOf(endToken, start);
  if (start < 0 || end < 0) {
    throw new Error(`BLOCK_NOT_FOUND:${startToken}`);
  }
  return sourceText.slice(start, end);
}

describe("QA-06.03E.2 controlled historical recovery project", () => {
  const projectContext = source("src/context/ProjectContext.tsx");
  const createProjectBlock = extractBlock(
    projectContext,
    "const createProject = useCallback",
    "const createHistoricalRecoveryProject = useCallback"
  );
  const recoveryBlock = extractBlock(
    projectContext,
    "const createHistoricalRecoveryProject = useCallback",
    "const assignHistoricalNumeroExpediente"
  );

  test("defines explicit project recovery lineage contract", () => {
    expect(projectContext).toContain("export type HistoricalProjectRecoveryOrigin");
    expect(projectContext).toContain("recoveryType: \"HISTORICAL_PROJECT_RECOVERY\"");
    expect(projectContext).toContain("sourceProjectId: string");
    expect(projectContext).toContain("sourceProjectName?: string | null");
    expect(projectContext).toContain("sourceGeometryType?: string | null");
    expect(projectContext).toContain("recoveryReason: string");
    expect(projectContext).toContain("recoveredAt: number");
    expect(projectContext).toContain("historicalProjectRecoveryOrigin?: HistoricalProjectRecoveryOrigin | null");
  });

  test("normal createProject remains closed to projects without geography", () => {
    expect(createProjectBlock).toContain("if (!canonicalGeography && !draftGeography?.confirmed)");
    expect(createProjectBlock).toContain("Debe definir, validar y confirmar la geografía antes de crear el expediente.");
    expect(createProjectBlock).not.toContain("HISTORICAL_PROJECT_RECOVERY");
    expect(createProjectBlock).not.toContain("historicalProjectRecoveryOrigin");
  });

  test("recovery project uses a new generated project id and never reuses sourceProjectId", () => {
    expect(recoveryBlock).toContain("const projectDocRef = doc(projectCol)");
    expect(recoveryBlock).toContain("sourceProjectId: sourceId");
    expect(recoveryBlock).not.toContain("doc(projectCol, sourceProjectId");
    expect(recoveryBlock).not.toContain("doc(projectCol, sourceId");
    expect(recoveryBlock).not.toContain("id: sourceProjectId");
  });

  test("recovery project receives new institutional identity through the counter transaction", () => {
    expect(recoveryBlock).toContain("const counterRef = doc(firestore, \"counters\", \"projects\")");
    expect(recoveryBlock).toContain("await runTransaction(firestore, async (transaction) =>");
    expect(recoveryBlock).toContain("const nextCount = currentCount + 1");
    expect(recoveryBlock).toContain("ceipolId = `CEIPOL/");
    expect(recoveryBlock).toContain("numeroExpedienteFields = buildNumeroExpedienteFields");
    expect(recoveryBlock).toContain("transaction.set(counterRef, { count: nextCount })");
  });

  test("auth, readOnly and runtime geometry guards run before Firestore writes", () => {
    expect(recoveryBlock).toContain("if (!user)");
    expect(recoveryBlock).toContain("HISTORICAL_RECOVERY_AUTH_REQUIRED");
    expect(recoveryBlock).toContain("if (isReadOnly)");
    expect(recoveryBlock).toContain("HISTORICAL_RECOVERY_READ_ONLY");
    expect(recoveryBlock).toContain("[\"individual\", \"lineal\", \"poligono\"].includes(geometryType)");
    expect(recoveryBlock).toContain("HISTORICAL_RECOVERY_INVALID_GEOMETRY_TYPE");

    const authGuard = recoveryBlock.indexOf("if (!user)");
    const readOnlyGuard = recoveryBlock.indexOf("if (isReadOnly)");
    const geometryGuard = recoveryBlock.indexOf("[\"individual\", \"lineal\", \"poligono\"].includes(geometryType)");
    const getDbCall = recoveryBlock.indexOf("const firestore = getDb()");
    const transactionCall = recoveryBlock.indexOf("await runTransaction");

    expect(authGuard).toBeGreaterThan(-1);
    expect(readOnlyGuard).toBeGreaterThan(authGuard);
    expect(geometryGuard).toBeGreaterThan(readOnlyGuard);
    expect(authGuard).toBeLessThan(getDbCall);
    expect(readOnlyGuard).toBeLessThan(getDbCall);
    expect(geometryGuard).toBeLessThan(transactionCall);
  });

  test("recovery project is alive but has no canonical geography until human reconciliation", () => {
    expect(recoveryBlock).toContain("estado: \"ABIERTO\"");
    expect(recoveryBlock).toContain("canonicalGeography: null");
    expect(recoveryBlock).toContain("geographyId: null");
    expect(recoveryBlock).toContain("geographyValidationStatus: \"INVALID\"");
    expect(recoveryBlock).toContain("historicalGeographyReconciliation: null");
    expect(recoveryBlock).not.toContain("canonicalizeConfirmedDraftGeography");
    expect(recoveryBlock).not.toContain("serializeCanonicalGeographyForFirestore");
  });

  test("recovery project does not invent root coordinates or vertices", () => {
    expect(recoveryBlock).not.toContain("Point");
    expect(recoveryBlock).not.toContain("LineString");
    expect(recoveryBlock).not.toContain("Polygon");
    expect(recoveryBlock).not.toContain("centroid");
    expect(recoveryBlock).not.toContain("latitude:");
    expect(recoveryBlock).not.toContain("longitude:");
    expect(recoveryBlock).not.toContain("lat:");
    expect(recoveryBlock).not.toContain("lng:");
    expect(recoveryBlock).not.toContain("\"VERTEX\"");
    expect(recoveryBlock).not.toContain("isVertex");
    expect(recoveryBlock).not.toContain("geographicEntities");
  });

  test("recovery project without canonical geography is not ready for report", () => {
    const assessment = assessReportReadiness({
      id: "new-recovery-project",
      geometryType: "lineal",
      canonicalGeography: null,
      geographyId: null,
      geographyValidationStatus: "INVALID",
      historicalGeographyReconciliation: null,
      canonicalHypothesis: null,
      hypothesisRequirementSatisfied: false,
    });

    expect(assessment.status).toBe("NOT_READY");
    expect(assessment.readyForInstitutionalReport).toBe(false);
    expect(assessment.blockingReasons.map((reason) => reason.code)).toContain("GEOGRAPHY_INVALID_OR_MISSING");
  });

  test("context exposes the separate recovery operation", () => {
    expect(projectContext).toContain("createHistoricalRecoveryProject: (params:");
    expect(projectContext).toContain("createHistoricalRecoveryProject,");
    expect((projectContext.match(/createHistoricalRecoveryProject/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  test("recovery creation is audited with source lineage", () => {
    expect(recoveryBlock).toContain("CREAR_EXPEDIENTE_RECUPERACION_HISTORICA");
    expect(recoveryBlock).toContain("newProjectId: projectDocRef.id");
    expect(recoveryBlock).toContain("numeroExpediente: numeroExpedienteFields.numeroExpediente");
    expect(recoveryBlock).toContain("geometryType,");
    expect(recoveryBlock).toContain("recoveryType: historicalProjectRecoveryOrigin.recoveryType");
    expect(recoveryBlock).toContain("sourceProjectId: historicalProjectRecoveryOrigin.sourceProjectId");
    expect(recoveryBlock).toContain("sourceProjectName: historicalProjectRecoveryOrigin.sourceProjectName");
    expect(recoveryBlock).toContain("sourceGeometryType: historicalProjectRecoveryOrigin.sourceGeometryType");
    expect(recoveryBlock).toContain("recoveryReason: historicalProjectRecoveryOrigin.recoveryReason");
    expect(recoveryBlock.indexOf("await runTransaction")).toBeLessThan(recoveryBlock.indexOf("await logAuditAction"));
  });

  test("write failures cannot produce success audit before persistence completes", () => {
    expect(recoveryBlock.indexOf("await runTransaction")).toBeLessThan(recoveryBlock.indexOf("await logAuditAction"));
    const catchBlock = recoveryBlock.slice(recoveryBlock.indexOf("catch (err"));
    expect(catchBlock).not.toContain("CREAR_EXPEDIENTE_RECUPERACION_HISTORICA");
    expect(catchBlock).not.toContain("result: \"ÉXITO\"");
  });
});
