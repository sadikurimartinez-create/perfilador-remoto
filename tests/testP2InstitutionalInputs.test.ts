import { compactReportAnalysisOutput, createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import { projectPersistedInstitutionalInputs } from "../src/utils/institutionalReportInputProjection";
import { buildInstitutionalProductExportPayload } from "../src/utils/institutionalProductsUi";
import { assessReportReadiness } from "../src/utils/reportReadyGovernance";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

const content = {
  summary: "Resumen verificable", text: "Texto analítico completo", convergences: ["Coincidencia"],
  contradictions: ["Discrepancia"], sourceDependencies: [{ sourceA: "s1", sourceB: "s2", independence: "DERIVED", reason: "Fuente común" }],
  independentSources: ["s3"], supportingEvidenceIds: ["e1"], contradictingEvidenceIds: ["e2"],
  contradictingFindingIds: ["f2"], supportingConvergences: ["c1"], informationGaps: ["Sin fecha"],
  provenance: { provider: "persisted", originalId: "a1" }, limitations: ["Alcance territorial"],
};
const protectedFiles: Array<[string, string]> = [
  [
    "src/components/PhotoAlbum.tsx",
    "765F8EBF44A314E607727C1FD4DD35920E3C2BACC74D6B00B46AEA0DC217B46C"
  ],
  [
    "docs/H2F2E13-SCINCE-TERRITORIAL-COVERAGE-CONTRACT.md",
    "198F0109F5E34A4E6C00449DB08C824F3516AC9550B7784B696D4EC9D6293731"
  ],
  [
    "docs/H2F2E14-SCINCE-TOPOLOGY-OFFLINE-VALIDATION.md",
    "98DD0E83B080420F7FF1648817106F376C502DA1B0ED875C1A4E5BCB560B7ADB"
  ],
  [
    "docs/H2F2E15-SCINCE-TOPOLOGY-PRECONDITIONS.md",
    "E12C2BAAE3CC1DDFCF79BDCE668415E894DBD26F459E06F66AF06DC7336BAF1C"
  ],
  [
    "src/types/scinceCanonicalCoverage.ts",
    "3634F4A99193374D5D82741902842B293C1F82E24FF7A5FE2C5A801A80A39B4A"
  ],
  [
    "src/utils/scinceCanonicalCoverage.ts",
    "9CFCEB16D6D6C4A311D5B1E893CC9FF41796B77DE6CE0A2579D1909ECADA8523"
  ],
  [
    "src/utils/scinceCoveragePreconditions.ts",
    "EA8000F5495BA9DA8842433998D38A6F1027E811B840467B56E7A6D4E6B85C40"
  ],
  [
    "tests/testScinceCanonicalCoverage.test.ts",
    "89F1F44668B9870E3B2ECC5883C8D92C932FE2D5D8209F97AA0E219D8FD79B99"
  ],
  [
    "tests/testScinceTopologyOffline.test.ts",
    "375F1259803B60B0440E0DC3941280A03678B833B29A103BC22D1787B629BF54"
  ],
  [
    "tests/testScinceCoveragePreconditions.test.ts",
    "C06B64A529FB00C546B48404CC5840A1332B9CFF5616BB319F04780E04FA927B"
  ],
  [
    "tests/helpers/scinceGeosOffline.py",
    "52ED9124AA6D38FBB154F9FFDDDFDC7367E3B1277C1BE3E3462CB231DEA74882"
  ],
  [
    "tests/fixtures/scince-topology-offline.json",
    "ACD1F24AA1B919DB289BA6E0943B3630276AF123DF9A8191391FFF5A3775ED28"
  ]
];
describe("P2 protected preexisting work", () => {
  test.each(protectedFiles)("preserves SHA-256 of %s", (file, expected) => {
    expect(createHash("sha256").update(readFileSync(join(process.cwd(), file))).digest("hex").toUpperCase()).toBe(expected);
  });
});
describe("P2 persisted analytical content", () => {
  test.each(Object.keys(content))("compaction preserves %s across JSON persistence", key => {
    const output = JSON.parse(JSON.stringify(compactReportAnalysisOutput({ outputId: "a1", ...content })));
    expect(output[key]).toEqual((content as any)[key]);
  });
  test("keeps IDs, lineage and human validation without promoting legacy", () => {
    const result = compactReportAnalysisOutput({ outputId: "a1", evidenceIds: ["e1"], findingIds: ["f1"],
      humanValidationStatus: "APPROVED", validationSource: "HUMAN", validatedBy: { id: "u1" }, validatedAt: "date" });
    expect(result).toMatchObject({ outputId: "a1", evidenceIds: ["e1"], findingIds: ["f1"],
      humanValidationStatus: "APPROVED", validationSource: "HUMAN", validatedBy: { id: "u1" }, validatedAt: "date",
      acquisitionMode: "LEGACY", epistemicClass: "LEGACY_UNCLASSIFIED" });
  });
  test("factory carries explicit substantive content", () => {
    const result = createAiAnalyticalOutput({ outputType: "ANALYSIS", summary: content.summary, text: content.text });
    expect(result.summary).toBe(content.summary); expect(result.text).toBe(content.text);
    expect(result.acquisitionMode).toBe("AI_GENERATED");
  });
  test.each(["findings", "analysisOutputs", "convergences", "osint", "evidence"])("empty %s cannot hide persisted nested inputs", field => {
    const items = [{ id: "persisted-1", text: "original" }];
    expect(projectPersistedInstitutionalInputs({ [field]: [], iaAnalysis: { [field]: items } }).project[field]).toEqual(items);
  });
  test("matching copies select top-level and deduplicate", () => {
    const item = { id: "a1", summary: "same" };
    const result = projectPersistedInstitutionalInputs({ analysisOutputs: [item, item], iaAnalysis: { analysisOutputs: [item] } });
    expect(result.project.analysisOutputs).toEqual([item]);
    expect(result.states.analysisOutputs).toMatchObject({ source: "TOP_LEVEL", state: "AVAILABLE", count: 1 });
  });
  test("conflicting copies require explicit reconciliation", () => {
    expect(() => projectPersistedInstitutionalInputs({ analysisOutputs: [{ id: "a1", summary: "old" }],
      iaAnalysis: { analysisOutputs: [{ id: "a1", summary: "new" }] } })).toThrow("REPORT_INPUT_CONFLICT");
  });
  test("duplicate identity with different content cannot silently overwrite", () => {
    expect(() => projectPersistedInstitutionalInputs({ findings: [{ id: "f1", text: "old" }, { id: "f1", text: "new" }] })).toThrow("REPORT_INPUT_CONFLICT");
  });
  test("invalid structured array blocks projection", () => {
    expect(() => projectPersistedInstitutionalInputs({ findings: "invalid" })).toThrow("REPORT_INPUT_INVALID");
  });
  test.each(["MISSING", "ACCESS_DENIED", "NOT_EXECUTED", "INVALID", "EXCLUDED", "EMPTY_VALID"])("availability preserves %s", state => {
    const project = state === "MISSING" ? {} : state === "EMPTY_VALID" ? { osint: [] } : { inputAcquisitionStates: { osint: state } };
    expect(projectPersistedInstitutionalInputs(project).states.osint?.state).toBe(state);
  });
  test("institutional payload uses persisted nested analysis despite empty top-level", () => {
    const project = { id: "p1", numeroExpediente: "N1", analysisOutputs: [], iaAnalysis: { analysisOutputs: [{ outputId: "a1", ...content }] } };
    expect(buildInstitutionalProductExportPayload(project, { reportReadyAssessment: assessReportReadiness(project) }).analysisOutputs).toEqual(project.iaAnalysis.analysisOutputs);
  });
  test("incidence scalar conflict blocks instead of selecting silently", () => {
    expect(() => projectPersistedInstitutionalInputs({ crimeIncidenceExportContract: { dataset: "a" }, iaAnalysis: { crimeIncidenceExportContract: { dataset: "b" } } })).toThrow("REPORT_INPUT_CONFLICT");
  });
});
