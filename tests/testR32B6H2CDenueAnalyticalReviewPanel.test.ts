import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
  authenticatedPpcIdentity,
  persistDenueAnalyticalReviewDecision,
  runExplicitDenueCandidateGeneration,
} from "@/components/denueAnalyticalReviewController";
import type { DenueAnalyticalReviewPanelViewProps } from "@/components/DenueAnalyticalReviewPanel";
import type { DenueAnalyticalCandidateGenerationInput } from "@/services/denueAnalyticalCandidateService";
import type { DenueAnalyticalRelation } from "@/utils/denueAnalyticalRelation";
import { buildEvidenceLineage } from "@/utils/evidenceLineage";

const PROJECT_ID = "exp-r32b6h2c";

type PanelModule = typeof import("@/components/DenueAnalyticalReviewPanel");

function loadPanelModule(): PanelModule {
  const filename = path.join(process.cwd(), "src/components/DenueAnalyticalReviewPanel.tsx");
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const ui = (name: string) => ({
    [name]: ({ children, title, description }: Record<string, unknown>) =>
      React.createElement("div", null, children ?? [title, description].filter(Boolean).join(" ")),
  });
  const localRequire = (specifier: string) => {
    if (specifier === "react") return React;
    if (specifier.endsWith("AuthContext")) return { useAuth: () => ({ user: null }) };
    if (specifier.endsWith("ProjectContext")) return { useProject: () => ({ project: null, album: [], isReadOnly: true }) };
    if (specifier.endsWith("CEIPOLBadge")) return ui("CEIPOLBadge");
    if (specifier.endsWith("CEIPOLButton")) return ui("CEIPOLButton");
    if (specifier.endsWith("CEIPOLCard")) return ui("CEIPOLCard");
    if (specifier.endsWith("CEIPOLEmptyState")) return ui("CEIPOLEmptyState");
    if (specifier.endsWith("CEIPOLErrorState")) return ui("CEIPOLErrorState");
    if (specifier.endsWith("geointGovernance")) {
      return { GeointGovernanceStatus: { APPROVED_EVIDENCE: "APPROVED_EVIDENCE" } };
    }
    if (specifier.endsWith("denueAnalyticalReviewController")) {
      return {
        authenticatedPpcIdentity,
        persistDenueAnalyticalReviewDecision,
        runExplicitDenueCandidateGeneration,
      };
    }
    throw new Error(`Unexpected test import: ${specifier}`);
  };
  const moduleRecord: { exports: Partial<PanelModule> } = { exports: {} };
  const execute = new Function("require", "module", "exports", output);
  execute(localRequire, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports as PanelModule;
}

const { DenueAnalyticalReviewPanelView } = loadPanelModule();

function relation(status: "PENDING" | "ACCEPTED" | "REJECTED" | "REQUIRES_REVISION" = "PENDING"): DenueAnalyticalRelation {
  return {
    relationId: "denue-relation-ui-1",
    denueLayerId: "denue:evidence:1",
    sourceEvidenceId: "denue:evidence:1",
    expedienteId: PROJECT_ID,
    geographyId: "geo-ui-1",
    relationTypes: ["SPATIAL_PROXIMITY"],
    linkedEvidenceIds: ["field:evidence:1"],
    linkedFindingIds: [],
    linkedHypothesisRefs: [],
    linkedSourceRefs: ["denue:evidence:1", "field:evidence:1"],
    spatialMetrics: {
      unit: "METERS",
      method: "SpatialLayerEngine.getDistance+CANONICAL_POINT",
      distanceMeters: 24,
    },
    temporalCompatibility: "COMPATIBLE",
    sourceIndependence: {
      status: "UNKNOWN",
      assessedSourceRefs: ["denue:evidence:1", "field:evidence:1"],
      independentSourceRefs: [],
      rationale: ["SIMPLE_RELATION_INDEPENDENCE_NOT_ASSERTED"],
    },
    lineage: buildEvidenceLineage({
      sourceId: "INEGI_DENUE",
      sourceReference: "denue://ui/1",
      evidenceId: "denue:evidence:1",
      geographyId: "geo-ui-1",
      geographyType: "INDIVIDUAL",
    }),
    measuredFacts: [{
      factId: "fact-ui-distance",
      metric: "distanceMeters",
      value: 24,
      unit: "METERS",
      sourceRefs: ["denue:evidence:1", "field:evidence:1"],
    }],
    proposedInterpretations: [],
    limitations: [
      { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
      { code: "PROXIMITY_NOT_CAUSALITY" },
      { code: "HUMAN_VALIDATION_REQUIRED" },
    ],
    machineAssessment: { status: "DETECTED", reasonCodes: ["MEASURED_SPATIAL_RELATION"] },
    humanValidation: status === "PENDING"
      ? { status, validatedBy: null, validatedAt: null, rationale: null }
      : {
          status,
          validatedBy: "user:42",
          validatedAt: "2026-09-30T16:00:00.000Z",
          rationale: "Decision PPC persistida.",
        },
    publicationEligibility: "INELIGIBLE",
    methodologyVersion: "ADR-026:R3.2B.6H.2C:v1",
  };
}

function viewProps(overrides: Partial<DenueAnalyticalReviewPanelViewProps> = {}): DenueAnalyticalReviewPanelViewProps {
  return {
    relations: [],
    ledgers: [],
    denueNames: new Map(),
    coverage: { denue: 1, geoEvidence: 1, streetView: 0, findings: 0, multisourceGroups: 0, ergLinks: 0 },
    geographyType: "INDIVIDUAL",
    generationResult: null,
    generationError: null,
    reviewErrors: {},
    rationaleByRelation: {},
    filter: "PENDING",
    canReview: true,
    generating: false,
    reviewingRelationId: null,
    onFilterChange: () => undefined,
    onGenerate: () => undefined,
    onRationaleChange: () => undefined,
    onDecision: () => undefined,
    ...overrides,
  };
}

function render(overrides: Partial<DenueAnalyticalReviewPanelViewProps> = {}) {
  return renderToStaticMarkup(React.createElement(DenueAnalyticalReviewPanelView, viewProps(overrides)));
}

describe("R3.2B.6H.2C DENUE analytical PPC review UI", () => {
  test("empty state is visible and generation remains an explicit action", () => {
    const generate = jest.fn();
    const markup = render({ onGenerate: generate });
    expect(markup).toContain("No existen relaciones DENUE pendientes de revision");
    expect(markup).toContain("Generar candidatos analiticos");
    expect(generate).not.toHaveBeenCalled();
  });

  test("pending candidate exposes governed states, metric, traceability and proximity warning", () => {
    const pending = relation();
    const markup = render({
      relations: [pending],
      denueNames: new Map([[pending.sourceEvidenceId, "Unidad economica observada"]]),
      rationaleByRelation: { [pending.relationId]: "Revision humana documentada." },
    });
    expect(markup).toContain("Unidad economica observada");
    expect(markup).toContain("Sistema: DETECTED");
    expect(markup).toContain("PPC: Pendiente");
    expect(markup).toContain("Publicacion: INELIGIBLE");
    expect(markup).toContain("24.0 meters");
    expect(markup).toContain("Geometria: INDIVIDUAL");
    expect(markup).toContain("La proximidad espacial es descriptiva");
    expect(markup).toContain("Aceptar relacion");
    expect(markup).toContain("Rechazar relacion");
    expect(markup).toContain("Solicitar revision");
  });

  test("accepted is terminal and exposes no incompatible actions", () => {
    const accepted = relation("ACCEPTED");
    const markup = render({ relations: [accepted], filter: "ACCEPTED" });
    expect(markup).toContain("PPC: Aceptada");
    expect(markup).not.toContain("Aceptar relacion");
    expect(markup).not.toContain("Rechazar relacion");
    expect(markup).not.toContain("Solicitar revision");
  });

  test("authenticated identity comes from the real auth payload", () => {
    expect(authenticatedPpcIdentity({ id: 42, username: "perfilador" })).toBe("user:42");
    expect(authenticatedPpcIdentity({ username: "perfilador" })).toBe("username:perfilador");
    expect(authenticatedPpcIdentity(null)).toBeNull();
  });

  test("candidate generation invokes H.2B only through explicit controller action and reloads", async () => {
    const generate = jest.fn().mockResolvedValue({
      sourceDenueCount: 1,
      candidateCount: 1,
      newCandidateCount: 1,
      existingCandidateCount: 0,
      invalidCandidateCount: 0,
      relationTypes: ["SPATIAL_PROXIMITY"],
      staleRelationIds: [],
      warnings: [],
    });
    const reload = jest.fn().mockResolvedValue(undefined);
    expect(generate).not.toHaveBeenCalled();
    const result = await runExplicitDenueCandidateGeneration({
      snapshot: { projectId: PROJECT_ID } as DenueAnalyticalCandidateGenerationInput,
      generate,
      reload,
    });
    expect(result.candidateCount).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test.each(["ACCEPTED", "REJECTED", "REQUIRES_REVISION"] as const)(
    "%s decision uses canonical event, authenticated identity, append and reload",
    async (decision) => {
      const append = jest.fn().mockResolvedValue({ relations: [], reviewLedgers: [] });
      const reload = jest.fn().mockResolvedValue(undefined);
      const event = await persistDenueAnalyticalReviewDecision({
        projectId: PROJECT_ID,
        relation: relation(),
        decision,
        rationale: `Fundamento humano ${decision}.`,
        reviewedBy: "user:42",
        reviewedAt: "2026-09-30T16:00:00.000Z",
        append,
        reload,
      });
      expect(event.nextStatus).toBe(decision);
      expect(event.reviewedBy).toBe("user:42");
      expect(event.rationale).toBe(`Fundamento humano ${decision}.`);
      expect(append).toHaveBeenCalledWith(PROJECT_ID, event);
      expect(reload).toHaveBeenCalledTimes(1);
    }
  );

  test("empty rationale blocks persistence", async () => {
    const append = jest.fn();
    const reload = jest.fn();
    await expect(persistDenueAnalyticalReviewDecision({
      projectId: PROJECT_ID,
      relation: relation(),
      decision: "ACCEPTED",
      rationale: "   ",
      reviewedBy: "user:42",
      append,
      reload,
    })).rejects.toThrow("DENUE_REVIEW_RATIONALE_REQUIRED");
    expect(append).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  test("persistence failure does not reload or fabricate a visible decision", async () => {
    const append = jest.fn().mockRejectedValue(new Error("FIRESTORE_UNAVAILABLE"));
    const reload = jest.fn();
    await expect(persistDenueAnalyticalReviewDecision({
      projectId: PROJECT_ID,
      relation: relation(),
      decision: "ACCEPTED",
      rationale: "Fundamento conservado para reintento.",
      reviewedBy: "user:42",
      append,
      reload,
    })).rejects.toThrow("FIRESTORE_UNAVAILABLE");
    expect(reload).not.toHaveBeenCalled();
  });

  test("generation and review errors are visible without removing prior relations", () => {
    const pending = relation();
    const markup = render({
      relations: [pending],
      generationError: "GENERATION_FAILED",
      reviewErrors: { [pending.relationId]: "REVIEW_PERSISTENCE_FAILED" },
    });
    expect(markup).toContain("GENERATION_FAILED");
    expect(markup).toContain("REVIEW_PERSISTENCE_FAILED");
    expect(markup).toContain("PPC: Pendiente");
  });

  test("persisted relation state is rendered after reload without auto publication", () => {
    const rejected = relation("REJECTED");
    const markup = render({ relations: [rejected], filter: "REJECTED" });
    expect(markup).toContain("PPC: Rechazada");
    expect(markup).toContain("Publicacion: INELIGIBLE");
    expect(markup).not.toContain("B.6E");
    expect(markup).not.toContain("B.6G");
  });
});
