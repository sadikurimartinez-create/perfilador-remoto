import fs from "fs";
import path from "path";

import { compactFindingRef } from "../src/utils/projectRootReconciliation";

describe("REPORT finding refs rehydration", () => {
  const workspacePath = path.join(
    process.cwd(),
    "src/components/GeographicWorkspace.tsx"
  );

  const workspaceSource = fs.readFileSync(workspacePath, "utf8");

  test("compactFindingRef conserva identidad y trazabilidad para Report Ready", () => {
    const ref = compactFindingRef({
      id: "finding-001",
      sourceEvidenceId: "evidence-001",
      traceabilityId: "trace-001",
      geographyId: "geo-001",
      estado: "APPROVED_EVIDENCE",
      humanValidationStatus: "APPROVED",
      validationStatus: "VALIDATED",
      lineageStatus: "COMPLETE",
    });

    expect(ref).toEqual({
      findingId: "finding-001",
      sourceEvidenceId: "evidence-001",
      traceabilityId: "trace-001",
      geographyId: "geo-001",
      status: "APPROVED_EVIDENCE",
      humanValidationStatus: "APPROVED",
      validationStatus: "VALIDATED",
      lineageStatus: "COMPLETE",
      usedInReport: true,
    });
  });

  test("hallazgo aprobado nuevo se persiste como approvedFindingRefs compacto", () => {
    expect(workspaceSource).toContain(
      'import { compactFindingRef } from "@/utils/projectRootReconciliation";'
    );

    expect(workspaceSource).toContain(
      "const compactRef = compactFindingRef(savedFinding);"
    );

    expect(workspaceSource).toContain(
      "approvedFindingRefs: reconciledApprovedFindingRefs"
    );

    expect(workspaceSource).not.toContain(
      "approvedFindings: reconciledApprovedFindings"
    );
  });

  test("expediente existente rehidrata refs desde hallazgos aprobados reales", () => {
    expect(workspaceSource).toContain(
      "const approvedRefs = loadedFindings.flatMap"
    );

    expect(workspaceSource).toContain(
      "finding?.estado === GeointGovernanceStatus.APPROVED_EVIDENCE"
    );

    expect(workspaceSource).toContain(
      'String(finding?.humanValidationStatus || "").toUpperCase() === "APPROVED"'
    );

    expect(workspaceSource).toContain(
      "const compactRef = compactFindingRef(finding);"
    );

    expect(workspaceSource).toContain(
      "[GEOINT FINDING REFS REHYDRATED]"
    );
  });

  test("rehidratacion deduplica y evita escritura repetida sin cambios", () => {
    expect(workspaceSource).toContain(
      "const refsByFindingId = new Map<string, any>();"
    );

    expect(workspaceSource).toContain(
      "refsByFindingId.set(refId, ref);"
    );

    expect(workspaceSource).toContain(
      "if (beforeSignature !== afterSignature)"
    );
  });
});
