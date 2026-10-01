import fs from "fs";
import path from "path";

import { deriveEffectiveApprovedFindingRefs } from "../src/utils/effectiveApprovedFindingRefs";
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

  test("effective refs are deterministic, compact and do not mutate human decisions", () => {
    const stored = [{ findingId: "old" }, { findingId: "new", status: "STALE" }];
    const findings = [
      { id: "new", estado: "APPROVED_EVIDENCE", sourceEvidenceId: "ev" },
      { id: "pending", estado: "PENDING" },
      { id: "rejected", humanValidationStatus: "REJECTED" },
    ];
    const before = JSON.stringify({ stored, findings });
    const effective = deriveEffectiveApprovedFindingRefs(stored, findings);
    expect(effective.map(ref => ref.findingId)).toEqual(["old", "new"]);
    expect(effective[1]).toEqual(compactFindingRef(findings[0]));
    expect(deriveEffectiveApprovedFindingRefs(effective, findings)).toEqual(effective);
    expect(JSON.stringify({ stored, findings })).toBe(before);
  });

  test("ProjectContext exposes derived refs before readiness without persisting them", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/context/ProjectContext.tsx"), "utf8");
    const projection = source.slice(source.indexOf("// Canonical findings enrich"), source.indexOf("      setAlbum(governedAlbumPhotos)"));
    expect(projection).toContain("approvedFindingRefs: effectiveApprovedFindingRefs");
    expect(projection).toContain("reportReadyAssessment: assessReportReadiness");
    expect(projection).not.toMatch(/updateDoc|setDoc|updateProjectDetails|logAuditAction/);
  });
});
