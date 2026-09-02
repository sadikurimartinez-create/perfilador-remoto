import fs from "node:fs";
import path from "node:path";
import { createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { createComputedFileIntegrity } from "../src/utils/forensicFileIntegrity";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import {
  applyInstitutionalDocumentModelToPayload,
  buildInstitutionalDocumentModel,
} from "../src/utils/institutionalDocumentAssembly";
import {
  buildInstitutionalReportInput,
  reconcileInstitutionalReportPayload,
} from "../src/utils/institutionalReportPublicationContract";
import { assessRequestedAnnexAvailability } from "../src/utils/reportAnnexAvailabilityGovernance";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const geography = buildCanonicalProjectGeography({
  projectId: "project-f5",
  type: "POLYGON",
  points: [
    { lat: 21.88, lng: -102.29 },
    { lat: 21.89, lng: -102.29 },
    { lat: 21.89, lng: -102.28 },
  ],
  now: 1,
});

const corridor = buildCanonicalProjectGeography({
  projectId: "project-f5-corridor",
  type: "CORRIDOR",
  points: [
    { lat: 21.88, lng: -102.29 },
    { lat: 21.885, lng: -102.285 },
    { lat: 21.89, lng: -102.28 },
  ],
  now: 1,
});

const lineage = buildEvidenceLineage({
  geographyId: geography.geographyId,
  sourceId: "source-f5",
  evidenceId: "ev-f5",
  findingId: "find-f5",
  inferenceId: "inf-f5",
  analysisId: "analysis-f5",
  conclusionId: "conclusion-f5",
});

const goodHash = "f".repeat(64);
const longImage = `data:image/png;base64,${"A".repeat(140)}`;

function evidence(overrides: any = {}) {
  return {
    evidenceId: "ev-f5",
    id: "ev-f5",
    imageUrl: longImage,
    acquisitionMode: "OBSERVED",
    usedInReport: true,
    requiredForReport: true,
    geographyId: geography.geographyId,
    humanValidationStatus: "APPROVED",
    forensicIntegrity: createComputedFileIntegrity({ rawSha256: goodHash, declaredMimeType: "image/jpeg" }),
    lineage,
    sourceStatus: "AUTHORITATIVE",
    caption: "Vista registrada gobernada",
    ...overrides,
  };
}

function finding(overrides: any = {}) {
  return {
    findingId: "find-f5",
    id: "find-f5",
    text: "hallazgo gobernado visible",
    usedInReport: true,
    humanValidationStatus: "APPROVED",
    lineage,
    lineageStatus: "SUPPORTED",
    ...overrides,
  };
}

function analysis(overrides: any = {}) {
  return {
    ...createAiAnalyticalOutput({
      outputId: "analysis-f5",
      outputType: "ANALYSIS",
      evidenceIds: ["ev-f5"],
      findingIds: ["find-f5"],
      lineage,
      validationStatus: "APPROVED",
      ...overrides,
    }),
    text: "análisis gobernado visible",
    ...overrides,
  };
}

function conclusion(overrides: any = {}) {
  return {
    conclusionId: "conclusion-f5",
    id: "conclusion-f5",
    text: "conclusión validada visible",
    humanValidationStatus: "APPROVED",
    lineage,
    lineageStatus: "SUPPORTED",
    analysisIds: ["analysis-f5"],
    findingIds: ["find-f5"],
    evidenceIds: ["ev-f5"],
    ...overrides,
  };
}

function hypothesis() {
  return formulateHumanHypothesis({
    projectId: "project-f5",
    text: "Hipótesis humana gobernada F5.",
    geographyId: geography.geographyId,
    supportingEvidenceIds: ["ev-f5"],
    supportingFindingIds: ["find-f5"],
    contradictingEvidenceIds: ["ev-contradiction-f5"],
    lineage,
  });
}

function readyProject(overrides: any = {}) {
  return {
    id: "project-f5",
    projectId: "project-f5",
    projectName: "Proyecto F5",
    canonicalGeography: geography,
    canonicalHypothesis: hypothesis(),
    photoEvidence: [evidence()],
    findings: [finding()],
    inferences: [{ inferenceId: "inf-f5", id: "inf-f5", text: "inferencia gobernada", findingIds: ["find-f5"], evidenceIds: ["ev-f5"], lineage, lineageStatus: "SUPPORTED" }],
    analysisOutputs: [analysis()],
    conclusions: [conclusion()],
    maps: [{ id: "map-f5", kind: "map", title: "Mapa gobernado", caption: "Distribución espacial gobernada", dataUrl: longImage, geographyId: geography.geographyId, sourceReference: "canonical-map" }],
    charts: [{ id: "chart-f5", kind: "chart", title: "Chart gobernado", dataUrl: longImage, datasetId: "dataset-f5", sourceReference: "dataset-source", variables: ["variable-f5"] }],
    streetViewAnalysis: [{ id: "sv-f5", evidenceId: "sv-f5", previewUrl: longImage, geographyId: geography.geographyId, panoramaId: "pano-f5", lineage }],
    temporalComparisons: [{ comparisonId: "tc-f5", imageUrl: longImage, comparedEvidenceIds: ["ev-a", "ev-b"], humanValidationStatus: "APPROVED" }],
    sweeps: [{ id: "sweep-f5", lifecycleStatus: "CERTIFIED", outputEvidenceIds: ["ev-f5"], outputFindingIds: ["find-f5"] }],
    ...overrides,
  };
}

function modelFrom(project = readyProject()) {
  const input = buildInstitutionalReportInput(project);
  return { input, model: buildInstitutionalDocumentModel(input, { projectName: project.projectName, reportNumber: "REP-F5" }) };
}

describe("ADR-020.33 F5 - Documentary/editorial integration", () => {
  test("TEST 1 institutional export uses InstitutionalReportInput", () => {
    const source = readSource("src/lib/exportToWord.ts");
    expect(source).toContain("const institutionalReportInput = buildInstitutionalReportInput(payload)");
    expect(source).toContain("buildInstitutionalDocumentModel(institutionalReportInput");
  });

  test("TEST 2 one snapshot feeds one document model", () => {
    const { input, model } = modelFrom();
    expect(model.sourceSnapshotId).toBe(input.generatedAt);
    expect(model.lineageRefs).toBe(input.lineageSummary);
  });

  test("TEST 3 document model does not read raw project findings", () => {
    const { model } = modelFrom(readyProject({ findings: [finding(), finding({ findingId: "raw-bad", id: "raw-bad", usedInReport: false, lineage: [], lineageStatus: "UNSUPPORTED", text: "RAW BAD" })] }));
    expect(JSON.stringify(model)).not.toContain("RAW BAD");
  });

  test("TEST 4 document model does not read raw project hypothesis", () => {
    const { model } = modelFrom(readyProject({ finalHypothesis: "RAW HYPOTHESIS" }));
    expect(JSON.stringify(model)).not.toContain("RAW HYPOTHESIS");
  });

  test("TEST 5 draft retains legacy path", () => {
    const source = readSource("src/lib/exportToWord.ts");
    expect(source).toContain("} else {");
    expect(source).toContain("payload.reportReadyAssessment = assessReportReadiness(payload)");
  });

  test("TEST 6 hypothesis section uses governed hypothesis", () => {
    const { model } = modelFrom();
    expect(model.sections.find((section) => section.sectionId === "hypothesis")?.blocks[0].text).toContain("Hipótesis humana gobernada F5");
  });

  test("TEST 7 finding paragraph maps to governed assertion", () => {
    const { model } = modelFrom();
    const block = model.sections.find((section) => section.sectionId === "findings")?.blocks[0];
    expect(block?.assertionId).toContain("NA-FINDING-find-f5");
  });

  test("TEST 8 analysis paragraph maps to governed assertion", () => {
    const { model } = modelFrom();
    const analysisBlock = model.sections.find((section) => section.sectionId === "analysis")?.blocks.find((block) => block.assertionId?.includes("ANALYSIS"));
    expect(analysisBlock?.assertionId).toContain("NA-ANALYSIS-analysis-f5");
  });

  test("TEST 9 conclusion paragraph maps to validated governed assertion", () => {
    const { model } = modelFrom();
    const block = model.sections.find((section) => section.sectionId === "conclusions")?.blocks[0];
    expect(block?.assertionId).toContain("NA-CONCLUSION-conclusion-f5");
  });

  test("TEST 10 executive summary uses governedExecutiveSummary", () => {
    const { input, model } = modelFrom();
    const reconciled = reconcileInstitutionalReportPayload(readyProject(), input);
    expect(model.claimIds).toEqual(reconciled.governedExecutiveSummary.claimIds);
  });

  test("TEST 11 executive summary creates no new claim ID", () => {
    const { input, model } = modelFrom();
    const assertionIds = new Set(reconcileInstitutionalReportPayload(readyProject(), input).governedNarrativeAssertions.map((item: any) => item.assertionId));
    expect(model.claimIds.every((claimId) => assertionIds.has(claimId))).toBe(true);
  });

  test("TEST 12 institutional visual comes from visualProducts", () => {
    const { input, model } = modelFrom();
    expect(model.figures.every((figure) => input.visualProducts.some((visual: any) => visual.visualId === figure.visualId))).toBe(true);
  });

  test("TEST 13 raw visual cannot re-enter renderer", () => {
    const { input, model } = modelFrom(readyProject({ maps: [{ id: "raw-orphan", kind: "map", dataUrl: longImage }] }));
    expect(input.visualProducts.map((item: any) => item.visualId)).not.toContain("raw-orphan");
    expect(model.figures.map((item) => item.visualId)).not.toContain("raw-orphan");
  });

  test("TEST 14 ineligible visual not rendered", () => {
    const { model } = modelFrom(readyProject({ charts: [{ id: "bad-chart", kind: "chart", dataUrl: longImage }] }));
    expect(model.figures.map((item) => item.visualId)).not.toContain("bad-chart");
  });

  test("TEST 15 caption does not elevate epistemic strength", () => {
    const { model } = modelFrom(readyProject({ maps: [{ id: "map-caption", kind: "map", dataUrl: longImage, geographyId: geography.geographyId, caption: "Mapa que demuestra causa directa" }] }));
    expect(model.figures.find((item) => item.visualId === "map-caption")?.caption).not.toMatch(/demuestra|causa/i);
  });

  test("TEST 16 table data comes from governed content", () => {
    const { model } = modelFrom();
    expect(model.sections.flatMap((section) => section.blocks).every((block) => block.type !== "TABLE" || Boolean(block.assertionId || block.visualId))).toBe(true);
  });

  test("TEST 17 map preserves canonical geography", () => {
    const { model } = modelFrom();
    expect(model.figures.find((item) => item.visualId === "map-f5")?.geographyId).toBe(geography.geographyId);
  });

  test("TEST 18 corridor map not centroid-only", () => {
    const project = readyProject({ projectId: "project-f5-corridor", canonicalGeography: corridor, maps: [{ id: "corridor-map", kind: "map", dataUrl: longImage, geographyId: corridor.geographyId, sourceReference: "map" }] });
    const input = buildInstitutionalReportInput(project);
    const model = buildInstitutionalDocumentModel(input);
    expect(model.figures.find((item) => item.visualId === "corridor-map")?.geometryType).toBe("LineString");
  });

  test("TEST 19 polygon map not centroid-only", () => {
    const { model } = modelFrom();
    expect(model.figures.find((item) => item.visualId === "map-f5")?.geometryType).toBe("Polygon");
  });

  test("TEST 20 figure numbering deterministic", () => {
    const first = modelFrom().model.figures.map((figure) => figure.figureId);
    const second = modelFrom().model.figures.map((figure) => figure.figureId);
    expect(first).toEqual(second);
  });

  test("TEST 21 disclosure survives document assembly", () => {
    const { model } = modelFrom(readyProject({ maps: [{ id: "legacy-map", kind: "map", dataUrl: longImage, geographyId: geography.geographyId, sourceStatus: "LEGACY_UNCLASSIFIED" }] }));
    expect(model.disclosures.some((item) => item.code === "LEGACY_METADATA_PARTIAL")).toBe(true);
  });

  test("TEST 22 exclusion survives audit model but is not silently rendered", () => {
    const { model } = modelFrom(readyProject({ maps: [{ id: "orphan-map", kind: "map", dataUrl: longImage }] }));
    expect(model.exclusions.some((item) => item.itemId === "orphan-map")).toBe(true);
    expect(model.figures.map((item) => item.visualId)).not.toContain("orphan-map");
  });

  test("TEST 23 lineage refs survive document model mapping", () => {
    const { model } = modelFrom();
    const findingBlock = model.sections.find((section) => section.sectionId === "findings")?.blocks[0];
    expect(findingBlock?.evidenceIds).toContain("ev-f5");
    expect(findingBlock?.findingIds).toContain("find-f5");
  });

  test("TEST 24 document metadata uses safe administrative data", () => {
    const { model } = modelFrom();
    expect(model.metadata.projectName).toBe("Proyecto F5");
    expect(model.metadata.reportNumber).toBe("REP-F5");
  });

  test("TEST 25 no fabricated author/validator", () => {
    const { model } = modelFrom();
    expect(model.metadata.author).toBeNull();
    expect(model.metadata.validator).toBeNull();
  });

  test("TEST 26 no forced page break per chapter regression", () => {
    const source = readSource("src/lib/exportToWord.ts");
    expect(source).toContain("FlexibleChapterFlow: No pageBreakBefore, flow naturally");
  });

  test("TEST 27 broken governed visual produces rendering issue, not fake replacement", () => {
    const { model } = modelFrom(readyProject({ photoEvidence: [evidence({ imageUrl: "", dataUrl: "", previewUrl: "" })] }));
    expect(model.renderingIssues.some((issue) => issue.includes("VISUAL_ASSET_UNRESOLVED:ev-f5"))).toBe(true);
    const adapted = applyInstitutionalDocumentModelToPayload({}, model);
    expect(adapted.photoEvidence).toHaveLength(0);
  });

  test("TEST 28 generated document does not set certified", () => {
    expect(modelFrom().model.certified).toBe(false);
  });

  test("TEST 29 generated document does not set published", () => {
    expect(modelFrom().model.published).toBe(false);
  });

  test("TEST 30 Institutional mode cannot bypass F1/F2/F3/F4 contracts", () => {
    const source = readSource("src/lib/exportToWord.ts");
    expect(source.indexOf("buildInstitutionalReportInput(payload)")).toBeLessThan(source.indexOf("reconcileInstitutionalReportPayload(payload, institutionalReportInput)"));
    expect(source.indexOf("reconcileInstitutionalReportPayload(payload, institutionalReportInput)")).toBeLessThan(source.indexOf("buildInstitutionalDocumentModel(institutionalReportInput"));
    expect(source).toContain("applyInstitutionalDocumentModelToPayload");
  });

  test("TEST 31 requested missing map creates disclosure without fabricating a map", () => {
    const payload = { maps: [], graphs: [], sweepsData: [], hypothesisGraph: null };
    const disclosures = assessRequestedAnnexAvailability(payload, { mapDensity: true });

    expect(payload.maps).toEqual([]);
    expect(disclosures).toContainEqual(expect.objectContaining({
      itemId: "annex-map-density",
      itemType: "VISUAL_PRODUCT",
      code: "REQUESTED_VISUAL_PRODUCT_UNAVAILABLE",
    }));
  });

  test("TEST 32 requested missing chart creates disclosure without fabricating a chart", () => {
    const payload = { maps: [], graphs: [], sweepsData: [], hypothesisGraph: null };
    const disclosures = assessRequestedAnnexAvailability(payload, { chartTemporal: true });

    expect(payload.graphs).toEqual([]);
    expect(disclosures.map((item) => item.itemId)).toContain("annex-chart-temporal");
  });

  test("TEST 33 requested unexecuted sweep does not create a synthetic negative result", () => {
    const payload = { maps: [], graphs: [], sweepsData: [], hypothesisGraph: null };
    const disclosures = assessRequestedAnnexAvailability(payload, { sweepDenue: { selected: true, available: false } });

    expect(payload.sweepsData).toEqual([]);
    expect(disclosures).toContainEqual(expect.objectContaining({
      itemId: "annex-sweep-denue",
      itemType: "ANALYSIS",
      code: "REQUESTED_ANALYTICAL_PRODUCT_UNAVAILABLE",
    }));
  });

  test("TEST 34 requested missing HIG does not create a no-connections graph", () => {
    const payload = { maps: [], graphs: [], sweepsData: [], hypothesisGraph: null };
    const disclosures = assessRequestedAnnexAvailability(payload, { graphConnections: true });

    expect(payload.hypothesisGraph).toBeNull();
    expect(disclosures.map((item) => item.itemId)).toContain("annex-hig-connections");
  });

  test("TEST 35 existing real product keeps its analytical title and needs no unavailability disclosure", () => {
    const payload = {
      maps: [{ title: "Mapa de densidad observado" }],
      graphs: [{ title: "Distribución temporal observada" }],
      sweepsData: [{ engine: "DENUE", source: "INEGI", data: "resultado trazable", context: "expediente" }],
      hypothesisGraph: { dataUrl: longImage },
    };
    const original = JSON.parse(JSON.stringify(payload));
    const disclosures = assessRequestedAnnexAvailability(payload, {
      mapDensity: true,
      chartTemporal: true,
      sweepDenue: true,
      graphConnections: true,
    });

    expect(payload).toEqual(original);
    expect(disclosures).toEqual([]);
  });

  test("TEST 36 Report Engine uses governed disclosures and contains no product fallback injection", () => {
    const source = readSource("src/lib/reportEngine.ts");

    expect(source).toContain("assessRequestedAnnexAvailability");
    expect(source).toContain("publicationDisclosures");
    expect(source).not.toMatch(/payloadObj\.(maps|graphs|sweepsData)\.push/);
    expect(source).not.toMatch(/payloadObj\.hypothesisGraph\s*=/);
    expect(source).not.toContain("(Normalizado)");
    expect(source).not.toContain("Sin Conexiones Identificadas en el Sector");
  });
});
