import { createInstitutionalReviewedAnalysisOutput } from "../src/utils/aiAnalysisGovernance";
import { assessReportReadiness } from "../src/utils/reportReadyGovernance";
import {
  compactFindingRef,
  inventoryProjectRoot,
  planProjectRootReconciliation,
} from "../src/utils/projectRootReconciliation";
import { collectInstitutionalAnalysisFindingIds } from "../src/utils/institutionalProductsUi";

const projectId = "Cw130y3Dg5iq6nhC5CMX";

function heavyFinding(id: string) {
  return {
    id,
    findingId: id,
    sourceEvidenceId: `ev-${id}`,
    evidenceId: `ev-${id}`,
    traceabilityId: `trace-${id}`,
    geographyId: "geo-prod",
    estado: "APPROVED_EVIDENCE",
    humanValidationStatus: "APPROVED",
    validationStatus: "APPROVED",
    lineageStatus: "SUPPORTED",
    usedInReport: true,
    raw: "x".repeat(220_000),
    dataUrl: `data:image/png;base64,${"x".repeat(220_000)}`,
    metadata: { payload: "x".repeat(100_000) },
  };
}

function baseProject(overrides: any = {}) {
  const output = createInstitutionalReviewedAnalysisOutput({
    projectId,
    geographyId: "geo-prod",
    evidenceIds: ["ev-finding-1"],
    findingIds: ["finding-1"],
    validatedAt: "2026-09-10T00:00:00.000Z",
    validatedBy: { id: "u-prod" },
  });
  return {
    id: projectId,
    numeroExpediente: "06092026-0007-JMG",
    canonicalGeography: { geographyId: "geo-prod", validationStatus: "VALID" },
    canonicalHypothesis: {
      hypothesisStatus: "FORMULATED",
      supportingEvidenceIds: ["ev-finding-1"],
      supportingFindingIds: ["finding-1"],
    },
    evidence: [{ evidenceId: "ev-finding-1", humanValidationStatus: "APPROVED" }],
    approvedFindings: [heavyFinding("finding-1")],
    streetViewAnalysis: [heavyFinding("finding-2")],
    analysisOutputs: [output],
    iaAnalysis: { analysisOutputs: [output], raw: "x".repeat(100_000) },
    ...overrides,
  };
}

describe("P4-U project root reconciliation", () => {
  test("P4-U-01 dry-run no escribe nada y sólo produce plan", () => {
    const project = baseProject();
    const before = JSON.stringify(project);
    const plan = planProjectRootReconciliation({ projectId, project, dryRun: true });

    expect(plan.dryRun).toBe(true);
    expect(plan.rootPatch).toHaveProperty("approvedFindingRefs");
    expect(JSON.stringify(project)).toBe(before);
  });

  test("P4-U-02 migración es idempotente", () => {
    const first = planProjectRootReconciliation({ projectId, project: baseProject(), dryRun: true });
    const compactRoot = { ...baseProject(), ...first.rootPatch };
    for (const field of first.removeRootFields) delete (compactRoot as any)[field];
    const second = planProjectRootReconciliation({ projectId, project: compactRoot, dryRun: true });

    expect(second.approvedFindingRefs).toEqual(first.approvedFindingRefs);
    expect(second.streetViewFindingRefs).toEqual(first.streetViewFindingRefs);
    expect(second.canonicalFindingUpserts).toEqual([]);
  });

  test("P4-U-03 preserva número de findings", () => {
    const plan = planProjectRootReconciliation({ projectId, project: baseProject(), dryRun: true });

    expect(plan.approvedFindingRefs).toHaveLength(1);
    expect(plan.streetViewFindingRefs).toHaveLength(1);
  });

  test("P4-U-04 preserva IDs de findings", () => {
    const plan = planProjectRootReconciliation({ projectId, project: baseProject(), dryRun: true });

    expect(plan.approvedFindingRefs.map((item) => item.findingId)).toEqual(["finding-1"]);
    expect(plan.streetViewFindingRefs.map((item) => item.findingId)).toEqual(["finding-2"]);
  });

  test("P4-U-05 preserva sourceEvidenceId", () => {
    expect(compactFindingRef(heavyFinding("finding-1"))?.sourceEvidenceId).toBe("ev-finding-1");
  });

  test("P4-U-06 preserva traceabilityId", () => {
    expect(compactFindingRef(heavyFinding("finding-1"))?.traceabilityId).toBe("trace-finding-1");
  });

  test("P4-U-07 root deja de contener payload pesado redundante", () => {
    const plan = planProjectRootReconciliation({ projectId, project: baseProject(), dryRun: true });
    const compactRoot = { ...baseProject(), ...plan.rootPatch };
    for (const field of plan.removeRootFields) delete (compactRoot as any)[field];

    expect(compactRoot.approvedFindings).toBeUndefined();
    expect(compactRoot.streetViewAnalysis).toBeUndefined();
    expect(JSON.stringify(compactRoot)).not.toContain("data:image/png;base64");
  });

  test("P4-U-08 root compacto sigue satisfaciendo consumidores", () => {
    const plan = planProjectRootReconciliation({ projectId, project: baseProject(), dryRun: true });
    const compactRoot = { ...baseProject(), ...plan.rootPatch };
    for (const field of plan.removeRootFields) delete (compactRoot as any)[field];

    expect(collectInstitutionalAnalysisFindingIds({ project: compactRoot })).toContain("finding-1");
    expect(assessReportReadiness(compactRoot).findingsReady).toBe(true);
  });

  test("P4-U-09 loadProject hidrata formato compacto por campos raíz compatibles", () => {
    const projectContext = require("node:fs").readFileSync("src/context/ProjectContext.tsx", "utf8");

    expect(projectContext).toContain("approvedFindingRefs?: any[]");
    expect(projectContext).toContain("streetViewFindingRefs?: any[]");
    expect(projectContext).toContain("if (projectData.iaAnalysis)");
    expect(projectContext).toContain("analysisOutputs: (projectData as any).analysisOutputs");
  });

  test("P4-U-10 analysisReady false sin revisión", () => {
    const output = {
      ...baseProject().analysisOutputs[0],
      validationStatus: "PENDING_REVIEW",
      humanValidationStatus: "PENDING_REVIEW",
    };
    const assessment = assessReportReadiness(baseProject({ analysisOutputs: [output], iaAnalysis: undefined }));

    expect(assessment.analysisReady).toBe(false);
  });

  test("P4-U-11 lineageReady false con refs incompletas", () => {
    const output = {
      ...baseProject().analysisOutputs[0],
      lineage: [{ id: "analysis-broken", type: "ANALYSIS", supportingFindingIds: ["missing-finding"] }],
      lineageStatus: "BROKEN_REFERENCE",
    };
    const assessment = assessReportReadiness(baseProject({ analysisOutputs: [output], iaAnalysis: undefined }));

    expect(assessment.lineageReady).toBe(false);
  });

  test("P4-U-12 analysisReady + lineageReady true sólo con refs reales + revisión humana", () => {
    const plan = planProjectRootReconciliation({ projectId, project: baseProject(), dryRun: true });
    const compactRoot = { ...baseProject(), ...plan.rootPatch };
    for (const field of plan.removeRootFields) delete (compactRoot as any)[field];
    const assessment = assessReportReadiness(compactRoot);

    expect(assessment.analysisReady).toBe(true);
    expect(assessment.lineageReady).toBe(true);
  });

  test("P4-U-13 no se serializa project completo en la mutación institucional", () => {
    const photoAlbum = require("node:fs").readFileSync("src/components/PhotoAlbum.tsx", "utf8");
    const createHandler = photoAlbum.slice(photoAlbum.indexOf("const handleCreateInstitutionalAnalysis"), photoAlbum.indexOf("const handleInstitutionalProductExport"));

    expect(createHandler).toContain("analysisOutputs: compactAnalysisOutputs");
    expect(createHandler).not.toContain("updateProjectDetails(project");
    expect(createHandler).not.toContain("iaAnalysis");
  });

  test("P4-U-14 estimación post-migración queda con margen razonable bajo 1 MiB", () => {
    const plan = planProjectRootReconciliation({ projectId, project: baseProject(), dryRun: true });

    expect(plan.totalBytesBefore).toBeGreaterThan(1_048_576);
    expect(plan.totalBytesAfter).toBeLessThan(250_000);
  });

  test("inventario ordena campos pesados del root", () => {
    const inventory = inventoryProjectRoot(baseProject());

    expect(inventory[0].bytes).toBeGreaterThanOrEqual(inventory[1].bytes);
    expect(inventory.map((item) => item.field)).toContain("approvedFindings");
  });
});
