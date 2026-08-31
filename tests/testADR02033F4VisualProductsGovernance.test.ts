import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { createComputedFileIntegrity, createHashUnavailableIntegrity } from "../src/utils/forensicFileIntegrity";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import { createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import {
  assessVisualProductEligibility,
  buildGovernedVisualProducts,
  buildInstitutionalVisualProduct,
} from "../src/utils/institutionalVisualProductGovernance";
import {
  buildInstitutionalReportInput,
  reconcileInstitutionalReportPayload,
} from "../src/utils/institutionalReportPublicationContract";

const polygonGeography = buildCanonicalProjectGeography({
  projectId: "project-f4",
  type: "POLYGON",
  points: [
    { lat: 21.88, lng: -102.29 },
    { lat: 21.89, lng: -102.29 },
    { lat: 21.89, lng: -102.28 },
  ],
  now: 1,
});

const corridorGeography = buildCanonicalProjectGeography({
  projectId: "project-f4",
  type: "CORRIDOR",
  points: [
    { lat: 21.88, lng: -102.29 },
    { lat: 21.885, lng: -102.285 },
    { lat: 21.89, lng: -102.28 },
  ],
  now: 1,
});

const lineage = buildEvidenceLineage({
  geographyId: polygonGeography.geographyId,
  sourceId: "source-f4",
  evidenceId: "ev-f4",
  findingId: "find-f4",
  inferenceId: "inf-f4",
  analysisId: "analysis-f4",
  conclusionId: "conclusion-f4",
});

const goodHash = "e".repeat(64);

function evidence(overrides: any = {}) {
  return {
    evidenceId: "ev-f4",
    id: "ev-f4",
    imageUrl: "https://example.test/evidence.jpg",
    acquisitionMode: "OBSERVED",
    usedInReport: true,
    requiredForReport: true,
    geographyId: polygonGeography.geographyId,
    humanValidationStatus: "APPROVED",
    forensicIntegrity: createComputedFileIntegrity({ rawSha256: goodHash, declaredMimeType: "image/jpeg" }),
    lineage,
    sourceStatus: "AUTHORITATIVE",
    ...overrides,
  };
}

function finding(overrides: any = {}) {
  return {
    findingId: "find-f4",
    id: "find-f4",
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
      outputId: "analysis-f4",
      outputType: "ANALYSIS",
      evidenceIds: ["ev-f4"],
      findingIds: ["find-f4"],
      lineage,
      validationStatus: "APPROVED",
      ...overrides,
    }),
    ...overrides,
  };
}

function conclusion(overrides: any = {}) {
  return {
    conclusionId: "conclusion-f4",
    id: "conclusion-f4",
    humanValidationStatus: "APPROVED",
    lineage,
    lineageStatus: "SUPPORTED",
    analysisIds: ["analysis-f4"],
    findingIds: ["find-f4"],
    evidenceIds: ["ev-f4"],
    ...overrides,
  };
}

function hypothesis() {
  return formulateHumanHypothesis({
    projectId: "project-f4",
    text: "Hipótesis humana gobernada para visuales.",
    geographyId: polygonGeography.geographyId,
    supportingEvidenceIds: ["ev-f4"],
    supportingFindingIds: ["find-f4"],
    lineage,
  });
}

function readyProject(overrides: any = {}) {
  return {
    id: "project-f4",
    projectId: "project-f4",
    canonicalGeography: polygonGeography,
    canonicalHypothesis: hypothesis(),
    photoEvidence: [evidence()],
    findings: [finding()],
    analysisOutputs: [analysis()],
    conclusions: [conclusion()],
    maps: [{ id: "map-f4", kind: "map", dataUrl: "data:image/png;base64,AAA", geographyId: polygonGeography.geographyId, sourceReference: "canonical-map", layers: ["evidence"] }],
    charts: [{ id: "chart-f4", kind: "chart", dataUrl: "data:image/png;base64,AAA", datasetId: "dataset-f4", sourceReference: "incidence-dataset", variables: ["robbery"], transformation: "count-by-zone" }],
    streetViewAnalysis: [{ id: "sv-f4", evidenceId: "sv-f4", previewUrl: "https://example.test/sv.jpg", geographyId: polygonGeography.geographyId, panoramaId: "pano-f4", lineage }],
    temporalComparisons: [{ comparisonId: "tc-f4", imageUrl: "https://example.test/tc.jpg", comparedEvidenceIds: ["ev-a", "ev-b"], humanValidationStatus: "APPROVED" }],
    intelligenceContext: {
      aceReport: {
        certifiedGimOutput: { validatedByACE: true, traceabilityReference: "gim-cert-f4", imageUrl: "https://example.test/gim.jpg", lineage },
      },
    },
    sweeps: [{ id: "sweep-f4", lifecycleStatus: "CERTIFIED", outputEvidenceIds: ["ev-f4"], outputFindingIds: ["find-f4"] }],
    ...overrides,
  };
}

describe("ADR-020.33 F4 - Visual products governance", () => {
  test("TEST 1 canonical map with geographyId -> ELIGIBLE", () => {
    const result = assessVisualProductEligibility({ id: "map-ok", kind: "map", geographyId: polygonGeography.geographyId }, { canonicalGeography: polygonGeography });
    expect(result.publicationEligibility).toBe("ELIGIBLE");
  });

  test("TEST 2 corridor map preserves LineString -> no centroid-only substitution", () => {
    const product = buildInstitutionalVisualProduct({ id: "corridor-map", kind: "map", geographyId: corridorGeography.geographyId }, { canonicalGeography: corridorGeography });
    expect(product.geometryType).toBe("LineString");
    expect(product.geographyType).toBe("CORRIDOR");
  });

  test("TEST 3 polygon map preserves Polygon", () => {
    const product = buildInstitutionalVisualProduct({ id: "polygon-map", kind: "map", geographyId: polygonGeography.geographyId }, { canonicalGeography: polygonGeography });
    expect(product.geometryType).toBe("Polygon");
  });

  test("TEST 4 photo pins cannot redefine canonical geography", () => {
    const product = buildInstitutionalVisualProduct({ id: "map-with-pin", kind: "map", lat: 0, lng: 0, geographyId: polygonGeography.geographyId }, { canonicalGeography: polygonGeography });
    expect(product.geographyId).toBe(polygonGeography.geographyId);
    expect(product.geometryType).toBe("Polygon");
  });

  test("TEST 5 valid photo evidence -> eligible visual", () => {
    const product = buildInstitutionalVisualProduct(evidence(), { canonicalGeography: polygonGeography });
    expect(product.visualType).toBe("PHOTO");
    expect(product.publicationEligibility).toBe("ELIGIBLE");
  });

  test("TEST 6 raw photo without evidence classification -> ineligible institutional visual", () => {
    const product = buildInstitutionalVisualProduct({ id: "raw-photo", kind: "photo", imageUrl: "raw.jpg" });
    expect(product.publicationEligibility).toBe("INELIGIBLE");
    expect(product.exclusionReason).toBe("PHOTO_WITHOUT_EVIDENCE_ID");
  });

  test("TEST 7 critical integrity failure -> visual excluded", () => {
    const product = buildInstitutionalVisualProduct(evidence({ forensicIntegrity: { hashStatus: "HASH_MISMATCH" } }));
    expect(product.publicationEligibility).toBe("INELIGIBLE");
  });

  test("TEST 8 Street View preserves evidenceId/geographyId", () => {
    const product = buildInstitutionalVisualProduct({ id: "sv-ok", visualType: "STREET_VIEW", evidenceId: "sv-1", geographyId: polygonGeography.geographyId, panoramaId: "pano-1" });
    expect(product.evidenceIds).toContain("sv-1");
    expect(product.geographyId).toBe(polygonGeography.geographyId);
  });

  test("TEST 9 Street View AI interpretation not embedded as observation metadata", () => {
    const product = buildInstitutionalVisualProduct({ id: "sv-ai", visualType: "STREET_VIEW", evidenceId: "sv-ai", geographyId: polygonGeography.geographyId, acquisitionMode: "AI_GENERATED", aiInterpretation: "objeto detectado" });
    expect((product as any).aiInterpretation).toBeUndefined();
    expect(product.disclosureCodes).toContain("AI_GENERATED");
  });

  test("TEST 10 temporal comparison visual references both evidence IDs", () => {
    const product = buildInstitutionalVisualProduct({ comparisonId: "tc-ok", visualType: "TEMPORAL_COMPARISON", comparedEvidenceIds: ["ev-a", "ev-b"] });
    expect(product.evidenceIds).toEqual(["ev-a", "ev-b"]);
  });

  test("TEST 11 orphan temporal visual -> ineligible", () => {
    const product = buildInstitutionalVisualProduct({ comparisonId: "tc-orphan", visualType: "TEMPORAL_COMPARISON", comparedEvidenceIds: ["ev-a"] });
    expect(product.publicationEligibility).toBe("INELIGIBLE");
  });

  test("TEST 12 chart preserves dataset/source refs", () => {
    const product = buildInstitutionalVisualProduct({ id: "chart-ok", kind: "chart", datasetId: "ds-1", sourceReference: "SESNSP", variables: ["homicide"], transformation: "monthly-count" });
    expect(product.datasetSourceRefs).toContain("ds-1");
    expect(product.sourceItemIds).toContain("SESNSP");
    expect(product.variables).toContain("homicide");
  });

  test("TEST 13 simulated dataset chart -> not institutional observed chart", () => {
    const product = buildInstitutionalVisualProduct({ id: "chart-sim", kind: "chart", datasetId: "ds-sim", sourceReference: "sim", acquisitionMode: "SIMULATED" });
    expect(product.publicationEligibility).toBe("INELIGIBLE");
  });

  test("TEST 14 correlation chart metadata does not imply causation", () => {
    const product = buildInstitutionalVisualProduct({ id: "chart-corr", kind: "chart", datasetId: "ds-1", sourceReference: "dataset", relationKind: "CORRELATION" });
    expect(product.relationKind).toBe("CORRELATION");
    expect(product.caption).not.toMatch(/causa|demuestra/i);
  });

  test("TEST 15 certified Pandillas visual -> eligible specialized visual", () => {
    const product = buildInstitutionalVisualProduct({ id: "gim-ok", visualType: "SPECIALIZED_INTELLIGENCE_VISUAL", validatedByACE: true, traceabilityReference: "gim-cert" });
    expect(product.publicationEligibility).toBe("ELIGIBLE");
  });

  test("TEST 16 raw GIM AI visualization -> ineligible institutional visual", () => {
    const product = buildInstitutionalVisualProduct({ id: "gim-raw", visualType: "SPECIALIZED_INTELLIGENCE_VISUAL", acquisitionMode: "AI_GENERATED" });
    expect(product.publicationEligibility).toBe("INELIGIBLE");
  });

  test("TEST 17 orphan visual -> excluded or disclosure according to policy", () => {
    const product = buildInstitutionalVisualProduct({ id: "orphan", visualType: "OTHER", dataUrl: "data:image/png;base64,AAA" });
    expect(product.publicationEligibility).toBe("INELIGIBLE");
    expect(product.exclusionReason).toBe("ORPHAN_VISUAL_PRODUCT");
  });

  test("TEST 18 decorative logo -> separated from evidentiary visual governance", () => {
    const product = buildInstitutionalVisualProduct({ id: "logo-ssp", kind: "logo", decorative: true, assetRef: "/logos/logo-ssp.png" });
    expect(product.visualType).toBe("DECORATIVE_ASSET");
    expect(product.decorative).toBe(true);
    expect(product.evidenceIds).toEqual([]);
  });

  test("TEST 19 caption cannot elevate epistemic strength", () => {
    const product = buildInstitutionalVisualProduct({ id: "map-caption", kind: "map", geographyId: polygonGeography.geographyId, caption: "Mapa que demuestra causa directa" }, { canonicalGeography: polygonGeography });
    expect(product.caption).not.toMatch(/demuestra|causa/i);
  });

  test("TEST 20 visual disclosure propagated", () => {
    const product = buildInstitutionalVisualProduct({ id: "legacy-map", kind: "map", geographyId: polygonGeography.geographyId, sourceStatus: "LEGACY_UNCLASSIFIED" }, { canonicalGeography: polygonGeography });
    expect(product.disclosureCodes).toContain("LEGACY_METADATA_PARTIAL");
  });

  test("TEST 21 LEGACY_UNCLASSIFIED visual -> no fabricated metadata", () => {
    const product = buildInstitutionalVisualProduct({ id: "legacy-visual", visualType: "OTHER", sourceStatus: "LEGACY_UNCLASSIFIED" });
    expect(product.geographyId).toBeNull();
    expect(product.evidenceIds).toEqual([]);
  });

  test("TEST 22 same report snapshot reused", () => {
    const input = buildInstitutionalReportInput(readyProject());
    const reconciled = reconcileInstitutionalReportPayload(readyProject(), input);
    expect(reconciled.institutionalReportInput).toBe(input);
    expect(reconciled.maps[0]).toBe(input.visualProducts.find((item: any) => item.visualId === "map-f4"));
  });

  test("TEST 23 eligible visual enters InstitutionalReportInput.visualProducts", () => {
    const input = buildInstitutionalReportInput(readyProject());
    expect(input.visualProducts.map((item: any) => item.visualId)).toContain("map-f4");
    expect(input.visualProducts.map((item: any) => item.visualId)).toContain("ev-f4");
  });

  test("TEST 24 excluded visual cannot re-enter via exportToWord", () => {
    const input = buildInstitutionalReportInput(readyProject({ maps: [{ id: "orphan-map", kind: "map", dataUrl: "data:image/png;base64,AAA" }] }));
    const reconciled = reconcileInstitutionalReportPayload(readyProject(), input);
    expect(input.visualProducts.map((item: any) => item.visualId)).not.toContain("orphan-map");
    expect(reconciled.maps.map((item: any) => item.visualId)).not.toContain("orphan-map");
  });

  test("TEST 25 draft can retain legacy visual fallback", () => {
    const governed = buildGovernedVisualProducts([{ id: "legacy-draft", visualType: "OTHER", sourceStatus: "LEGACY_UNCLASSIFIED" }], { draft: true });
    expect(governed.visualProducts.map((item) => item.visualId)).toContain("legacy-draft");
  });

  test("TEST 26 institutional export rejects ineligible visual", () => {
    const governed = buildGovernedVisualProducts([{ id: "raw", kind: "photo", imageUrl: "raw.jpg" }]);
    expect(governed.visualProducts).toHaveLength(0);
    expect(governed.exclusions[0].reasonCode).toBe("PHOTO_WITHOUT_EVIDENCE_ID");
  });

  test("TEST 27 visual keeps reverse lineage refs", () => {
    const product = buildInstitutionalVisualProduct(evidence());
    expect(product.evidenceIds).toContain("ev-f4");
    expect(product.findingIds).toContain("find-f4");
    expect(product.analysisIds).toContain("analysis-f4");
  });

  test("TEST 28 visual linked to governed narrative assertion preserves assertion ref", () => {
    const product = buildInstitutionalVisualProduct({ id: "map-assertion", kind: "map", geographyId: polygonGeography.geographyId, assertionId: "NA-FINDING-find-f4" }, { canonicalGeography: polygonGeography });
    expect(product.assertionIds).toContain("NA-FINDING-find-f4");
  });

  test("TEST 29 integrity warning noncritical -> disclosure not automatic blocker", () => {
    const product = buildInstitutionalVisualProduct(evidence({ forensicIntegrity: createHashUnavailableIntegrity({ status: "HASH_UNAVAILABLE" }) }));
    expect(product.publicationEligibility).toBe("ELIGIBLE_WITH_DISCLOSURE");
    expect(product.disclosureCodes).toContain("INTEGRITY_WARNING");
  });

  test("TEST 30 visual eligibility does not equal certification", () => {
    const product = buildInstitutionalVisualProduct(evidence());
    expect(product.publicationEligibility).toBe("ELIGIBLE");
    expect(product.certified).toBe(false);
  });
});
