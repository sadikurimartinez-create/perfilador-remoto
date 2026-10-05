import { CrimeDatasetCorpusIdentity, normalizeCrimeDatasetCorpusIdentity, validateCrimeDatasetCorpusIdentity } from "../src/types/crimeDatasetCorpusIdentity";

function fixture(two = false, gap = false): CrimeDatasetCorpusIdentity {
  const components = ["a", ...(two ? ["b"] : [])].map((datasetId, index) => ({
    datasetId, datasetName: "Official fixture", datasetVersion: "v1", sourceOrganization: "Institution",
    temporalCoverage: { start: index ? (gap ? "2025-03-01" : "2025-02-01") : "2025-01-01", end: index ? "2025-03-31" : "2025-01-31" },
    provenanceStatus: "VERIFIED" as const, institutionalRegistryReference: `registry:${datasetId}`,
  }));
  const covered = two && gap ? components.map(c => ({ ...c.temporalCoverage }))
    : [{ start: "2025-01-01", end: two ? "2025-03-31" : "2025-01-31" }];
  return {
    schemaVersion: "ADR02231_CORPUS_V1", components, componentCount: components.length,
    sourceType: "POSTGIS", sourceName: "Institutional corpus",
    queryScope: { functionalScope: "INCIDENCE", temporalFilters: { start: null, end: null }, incidentTypes: [], geographicReference: "canonical:fixture" },
    geographicCoverage: { status: "IN_COVERAGE", scopeCompatibility: "IN_SCOPE" },
    temporalCoverage: { componentIntervals: components.map(c => ({ datasetId: c.datasetId, ...c.temporalCoverage })),
      coveredIntervals: covered, effectiveQueryIntervals: covered, coverageEnvelope: { start: covered[0].start, end: covered[covered.length - 1].end },
      coverageContinuity: gap ? "DISCONTINUOUS" : "CONTINUOUS" },
    lineage: { queryReference: "query:fixture", componentReferences: components.map(c => ({ datasetId: c.datasetId, institutionalRegistryReference: c.institutionalRegistryReference })) },
    validationSummary: { status: "NOT_EVALUATED", structuralValidationOnly: true, codes: [] },
  };
}
describe("ADR-022.31 pure corpus contract", () => {
  test.each([[false, false], [true, false], [true, true]])("valid singular, continuous and discontinuous corpus", (two, gap) => {
    expect(validateCrimeDatasetCorpusIdentity(fixture(two, gap)).valid).toBe(true);
  });
  test("distinct IDs with identical descriptive metadata remain distinct", () => {
    const f = fixture(true);
    expect(validateCrimeDatasetCorpusIdentity(f).valid).toBe(true);
    expect(normalizeCrimeDatasetCorpusIdentity(f).components).toHaveLength(2);
  });
  test("ordering deterministic and input immutable", () => {
    const a = fixture(true); const b = fixture(true);
    b.components.reverse(); b.temporalCoverage.componentIntervals.reverse(); b.lineage.componentReferences.reverse();
    const before = JSON.stringify(b);
    expect(normalizeCrimeDatasetCorpusIdentity(a)).toEqual(normalizeCrimeDatasetCorpusIdentity(b));
    expect(JSON.stringify(b)).toBe(before);
  });
  const mutations: Array<[string, (f: any) => void]> = [
    ["empty", f => { f.components = []; f.componentCount = 0; }],
    ["count", f => { f.componentCount = 8; }],
    ["duplicate", f => { f.components.push({ ...f.components[0] }); f.componentCount++; }],
    ["missing ID", f => { f.components[0].datasetId = ""; }],
    ["unverified", f => { f.components[0].provenanceStatus = "REGISTERED"; }],
    ["registry missing", f => { delete f.components[0].institutionalRegistryReference; }],
    ["metadata missing", f => { delete f.components[0].datasetVersion; }],
    ["reversed interval", f => { f.components[0].temporalCoverage.start = "2026-01-01"; }],
    ["contradictory identity", f => { f.components.push({ ...f.components[0], datasetVersion: "other" }); f.componentCount++; }],
    ["contradictory reference", f => { f.lineage.componentReferences[0].institutionalRegistryReference = "other"; }],
    ["false continuity", f => { f.temporalCoverage.coverageContinuity = "CONTINUOUS"; }],
    ["invalid calendar date", f => { f.components[0].temporalCoverage.start = "2025-02-30"; }],
  ];
  test.each(mutations)("rejects %s without silently normalizing", (_name, change) => {
    const f = fixture(true, true); change(f);
    expect(validateCrimeDatasetCorpusIdentity(f).valid).toBe(false);
    expect(() => normalizeCrimeDatasetCorpusIdentity(f)).toThrow("CORPUS_STRUCTURE_INVALID");
  });
  test("UNKNOWN is representable without asserting continuity", () => {
    const f = fixture(true, true); f.temporalCoverage.coverageContinuity = "UNKNOWN";
    expect(validateCrimeDatasetCorpusIdentity(f).valid).toBe(true);
  });
});
