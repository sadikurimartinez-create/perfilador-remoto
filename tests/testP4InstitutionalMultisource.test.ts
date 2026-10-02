import { assembleInstitutionalMultisourceAnalysis as assemble } from "../src/services/geoint/multisourceOrchestrationService";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { buildInstitutionalConvergence, approveConvergenceResult } from "../src/utils/institutionalMultisourceConvergence";
import { buildExecutiveGeointReportModel } from "../src/utils/executiveGeointReportModel";
import type { InstitutionalReportInput } from "../src/utils/institutionalReportPublicationContract";
import { compactReportAnalysisOutput } from "../src/utils/aiAnalysisGovernance";

const time = "2026-09-06T12:00:00.000Z";
function source(id: string, kind = "STREET_VIEW", provider = "google"): any {
  const lineage = buildEvidenceLineage({ evidenceId: id, sourceId: `origin-${id}`, sourceReference: `https://source.example/${id}`, geographyId: "geo" });
  const entry = { sourceKind: kind, sourceId: `origin-${id}`, sourceEvidenceId: id, traceabilityId: `trace-${id}`,
    expedienteId: "exp", geographyId: "geo", coordinates: { lat: 21.88, lng: -102.29 }, timestamp: time,
    temporalClass: "CURRENT", epistemicRole: "SOURCE_FACT", validationStatus: "APPROVED", lineage,
    sourceReferences: [`https://source.example/${id}`], phenomenonTags: ["access"], assertion: "PRESENT", acquisitionMode: "OBSERVED" };
  return { id, evidenceId: id, sourceEvidenceId: id, sourceId: entry.sourceId, traceabilityId: entry.traceabilityId,
    sourceType: kind, providerId: provider, sourceReference: entry.sourceReferences[0], sourceStatus: "AUTHORITATIVE",
    expedienteId: "exp", geographyId: "geo", coordinates: entry.coordinates, observedAt: time, acquisitionMode: "OBSERVED",
    lineage, category: "ACCESS", assertion: "PRESENT", phenomenonTags: entry.phenomenonTags,
    phenomenon: "ACCESS_FEATURE_CORROBORATION", convergenceSource: entry,
    epistemicIntegrity: { acquisitionMode: "OBSERVED", acquisitionStatus: "ACQUIRED", validationStatus: "APPROVED",
      semanticRole: "SOURCE_FACT", isSimulated: false, isConnectivityOnly: false },
    publicationEligibility: { eligibility: "ELIGIBLE", role: "INSTITUTIONAL_FACT" } };
}
function input(overrides: any = {}): InstitutionalReportInput {
  return { projectId: "exp", generatedAt: time, geography: { geographyId: "geo", type: "INDIVIDUAL", geometry: { type: "Point", coordinates: [-102.29, 21.88] }, validationStatus: "VALID", limitations: [] },
    hypothesis: { hypothesisId: "hyp-human", currentHypothesis: "Existe un acceso físico documentado.", supportingEvidenceIds: [], supportingFindingIds: [], contradictingEvidenceIds: [], contradictingFindingIds: [], versions: [] },
    evidence: [source("a"), source("b", "FIELD_OBSERVATION", "field")], findings: [], inferences: [], analyses: [], conclusions: [],
    osint: [], streetView: [], temporalComparisons: [], denuePois: [], specializedIntelligence: [], predictiveAnalyticalProducts: [], visualProducts: [],
    exclusions: [], disclosures: [], lineageSummary: { itemCount: 2, evidenceIds: ["a", "b"], sourceIds: ["origin-a", "origin-b"], findingIds: [], analysisIds: [], conclusionIds: [] },
    publicationEligibility: "ELIGIBLE", draft: false, certified: false, published: false, ...overrides } as InstitutionalReportInput;
}
function reviewed(): InstitutionalReportInput {
  const data = input();
  const convergence = approveConvergenceResult(buildInstitutionalConvergence({ expedienteId: "exp", geographyId: "geo",
    phenomenon: "ACCESS_FEATURE_CORROBORATION", sources: data.evidence.map(item => item.convergenceSource), hypothesisRelation: "SUPPORTS", generatedAt: time }), { reviewedBy: "PPC-fixture", reviewedAt: time });
  return input({ convergences: [convergence] });
}
describe("P4 offline institutional assembly", () => {
  test("runs the existing correlation", () => expect(assemble(input()).correlation.results[0].correlationType).toBe("CORROBORATION"));
  test("proposes a genuine independent convergence", () => expect(assemble(input()).candidateConvergences).toHaveLength(1));
  test("never approves a calculated convergence", () => expect(assemble(input()).candidateConvergences[0].humanReviewStatus).toBe("PENDING_REVIEW"));
  test("pending convergence is not integrated support", () => expect(assemble(input()).status).toBe("INCONCLUSIVE"));
  test("explicit PPC review provides scoped support", () => expect(assemble(reviewed()).supportStatus).toBe("SUPPORTED"));
  test("output remains pending even with reviewed sources", () => expect(assemble(reviewed()).humanValidationStatus).toBe("PENDING_REVIEW"));
  test("human hypothesis is preserved", () => { const data = input(); const before = JSON.stringify(data.hypothesis); assemble(data); expect(JSON.stringify(data.hypothesis)).toBe(before); });
  test("same persisted inputs yield same output", () => expect(assemble(input())).toEqual(assemble(input())));
  test("source order does not change output", () => { const data = input(); expect(assemble(input({ evidence: [...data.evidence].reverse() }))).toEqual(assemble(data)); });
  test("source change changes provenance", () => { const data = input(); data.evidence[0].coordinates = { lat: 21.87, lng: -102.28 }; expect(assemble(data).provenance.sourceFingerprint).not.toBe(assemble(input()).provenance.sourceFingerprint); });
  test("input is not mutated", () => { const data = input(); const before = JSON.stringify(data); assemble(data); expect(JSON.stringify(data)).toBe(before); });
  test("duplicate record is not another source", () => { const data = input(); expect(assemble(input({ evidence: [...data.evidence, data.evidence[0]] }))).toEqual(assemble(data)); });
  test.each(["MOCK", "SIMULATED", "LEGACY", "CONNECTIVITY_TEST", "SYNTHETIC"])("excludes %s", mode => { const item = source("fake"); item.acquisitionMode = mode; expect(assemble(input({ evidence: [item] })).inventory).toHaveLength(0); });
  test.each(["cacheOnly", "isSimulated", "isConnectivityOnly"])("excludes %s flag", flag => { const item = source("fake"); item[flag] = true; expect(assemble(input({ evidence: [item] })).inventory).toHaveLength(0); });
  test("same provider does not corroborate independently", () => { const data = input(); data.evidence[1].providerId = "google"; expect(assemble(data).candidateConvergences).toHaveLength(0); });
  test("derived copy does not corroborate independently", () => { const data = input(); data.evidence[1].dependsOnSourceEvidenceIds = ["a"]; expect(assemble(data).candidateConvergences).toHaveLength(0); });
  test("unknown authority cannot create independent support", () => { const data = input(); delete data.evidence[1].sourceStatus; expect(assemble(data).candidateConvergences).toHaveLength(0); });
  test("different geography cannot correlate", () => { const data = input(); data.evidence[1].geographyId = "other"; expect(assemble(data).correlation.results).toHaveLength(0); });
  test("missing lineage cannot correlate", () => { const data = input(); data.evidence[1].lineage = []; expect(assemble(data).correlation.results).toHaveLength(0); });
  test("contradiction survives without automatic resolution", () => { const data = input(); data.evidence[1].assertion = "ABSENT"; expect(assemble(data).contradictions.join(" ")).toContain("sin resolución automática"); });
  test("missing sources do not refute hypothesis", () => expect(assemble(input({ evidence: [] })).supportStatus).toBe("INSUFFICIENT_DATA"));
  test("human supporting reference is partial without review", () => { const data = input(); data.hypothesis.supportingEvidenceIds = ["a"]; expect(assemble(data).supportStatus).toBe("PARTIALLY_SUPPORTED"); });
  test("human contradictory reference is explicit", () => { const data = input(); data.hypothesis.contradictingEvidenceIds = ["b"]; expect(assemble(data).supportStatus).toBe("CONTRADICTED"); });
  test("absent human reference creates no support", () => { const data = input(); data.hypothesis.supportingEvidenceIds = ["missing"]; expect(assemble(data).supportStatus).toBe("INSUFFICIENT_DATA"); });
  test("stale approved convergence cannot survive a source change", () => { const data = reviewed(); data.evidence[1].convergenceSource.assertion = "ABSENT"; expect(assemble(data).convergences).toHaveLength(0); });
  test("descriptive DENUE is inventory without risk inference", () => { const result = assemble(input({ evidence: [], denuePois: [{ id: "denue", name: "Comercio" }] })); expect(result.inventory[0].epistemicRole).toBe("DESCRIPTIVE"); expect(result.status).toBe("INCONCLUSIVE"); });
  test("GIM and prospective do not become primary source facts", () => { const result = assemble(input({ evidence: [], specializedIntelligence: [{ id: "gim" }], predictiveAnalyticalProducts: [{ productId: "pap", acquisitionMode: "DERIVED" }] })); expect(result.inventory.map(item => item.family)).toEqual(["GIM", "PROSPECTIVE"]); expect(result.correlation.eligibleItemCount).toBe(0); });
  test("legacy counts cannot manufacture support", () => expect(assemble(input({ evidence: [], lineageSummary: { itemCount: 999, sourceIds: ["x", "y", "z"] } })).status).toBe("INCONCLUSIVE"));
  test("executive consumes governed assembly", () => { const model = buildExecutiveGeointReportModel(input()); expect(model.multisourceAnalysis.technicalMetadata.governedAnalysis?.candidateConvergences).toHaveLength(1); expect(model.panorama.situacion).toContain("hipótesis humana"); });
  test("client supplied analysis is recomputed", () => { const model = buildExecutiveGeointReportModel(input({ multisourceAnalysis: { institutionalNarrative: "CERTIFICADO 85%" } })); expect(model.panorama.situacion).not.toContain("85%"); });
  test("output carries scope and analytical provenance", () => { const result = assemble(input()); expect(result).toMatchObject({ projectId: "exp", expedienteId: "exp", acquisitionMode: "DERIVED" }); expect(result.provenance.engines).toContain("correlateInstitutionalEvidence"); });
  test("a single source never creates convergence", () => expect(assemble(input({ evidence: [source("a")] })).candidateConvergences).toHaveLength(0));
  test("explicitly excluded source does not participate", () => { const item = source("excluded"); item.publicationEligibility.eligibility = "INELIGIBLE"; expect(assemble(input({ evidence: [item] })).envelope.items).toHaveLength(0); });
  test("SCINCE stays descriptive without vulnerability inference", () => { const result = assemble(input({ evidence: [], scinceContext: { publicationStatus: "PUBLISHABLE", snapshot: { dataset: { datasetId: "scince" }, population: 100000 } } })); expect(result.inventory[0].epistemicRole).toBe("DESCRIPTIVE"); expect(result.status).toBe("INCONCLUSIVE"); expect(result.institutionalNarrative).not.toContain("vulnerabilidad"); });
  test("descriptive incidence never establishes causality", () => { const result = assemble(input({ evidence: [], crimeIncidenceExportContract: { productClassification: "DESCRIPTIVE_ANALYTICAL_PRODUCT", queryReference: { status: "EXECUTED", admission: { accepted: true } }, datasetReference: { datasetId: "incidence" }, lineage: source("inc").lineage } })); expect(result.inventory[0].epistemicRole).toBe("DESCRIPTIVE"); expect(result.supportStatus).toBe("INSUFFICIENT_DATA"); });
  test("derived OSINT retains its role", () => { const item = source("osint"); item.acquisitionMode = "DERIVED"; const result = assemble(input({ evidence: [], osint: [item] })); expect(result.inventory[0].epistemicRole).toBe("DERIVED"); expect(result.status).toBe("INCONCLUSIVE"); });
  test.each(["FIELD_PHOTO", "STREET_VIEW"])("%s never becomes a finding", kind => { const model = buildExecutiveGeointReportModel(input({ evidence: [source("photo", kind)] })); expect(model.findings).toHaveLength(0); });
  test("unobserved territorial legacy summary does not appear", () => { const model = buildExecutiveGeointReportModel(input({ executiveSummary: "RIESGO ALTO LEGACY", governedExecutiveSummary: { text: "CERTIFICADO POR DEFAULT" } })); expect(model.panorama.situacion).not.toMatch(/RIESGO ALTO|CERTIFICADO POR DEFAULT/); });
  test("fallback confidence 85 is unavailable", () => { const model = buildExecutiveGeointReportModel(input({ findings: [{ findingId: "f", confidence: 85, confidenceSource: "HARDCODED" }] })); expect(model.findings[0].confidence).toBe("NO DISPONIBLE"); });
  test("real contradiction changes institutional narrative", () => { const data = input(); data.evidence[1].assertion = "ABSENT"; expect(assemble(data).institutionalNarrative).not.toBe(assemble(input()).institutionalNarrative); });
  test("reviewed convergences survive the executive model", () => { const model = buildExecutiveGeointReportModel(reviewed()); expect(model.multisourceAnalysis.convergencias.join(" ")).toContain("revisada"); expect(model.multisourceAnalysis.technicalMetadata.governedAnalysis?.convergences).toHaveLength(1); });
  test("reviewed support is a category rather than an invented strength", () => expect(buildExecutiveGeointReportModel(reviewed()).multisourceAnalysis.nivelSoporte).toBe("SOPORTADA"));
  test("contradictions survive executive output", () => { const data = input(); data.evidence[1].assertion = "ABSENT"; expect(buildExecutiveGeointReportModel(data).multisourceAnalysis.contradicciones.join(" ")).toContain("incompatibles"); });
  test("source dependencies and independent roots survive", () => { const result = assemble(input()); expect(result.sourceDependencies[0].dependencyType).toBe("INDEPENDENT"); expect(result.independentSources).toEqual(["a", "b"]); });
  test("summary text and analytical references survive compaction", () => { const result = assemble(input()); const compact = compactReportAnalysisOutput(result); expect(compact.summary).toBe(result.summary); expect(compact.text).toBe(result.text); expect(compact.supportingReferences).toEqual(result.supportingReferences); expect(compact.contradictingReferences).toEqual(result.contradictingReferences); });
  test("structured reviewed convergences survive compaction", () => { const result = assemble(reviewed()); const compact = compactReportAnalysisOutput(result); expect(compact.convergences).toEqual(result.convergences); expect(compact.generatedAt).toBe(time); expect(compact.humanValidationStatus).toBe("PENDING_REVIEW"); });
  test("unresolved contradiction carries explicit limitation", () => { const data = input(); data.evidence[1].assertion = "ABSENT"; expect(assemble(data).limitations.join(" ")).toContain("contradicciones no resueltas"); });
  test("inconclusive output still generates executive model", () => expect(buildExecutiveGeointReportModel(input({ evidence: [] })).multisourceAnalysis.technicalMetadata.governedAnalysis?.status).toBe("INCONCLUSIVE"));
  test.each(["MISSING", "EXCLUDED", "INVALID", "NOT_EXECUTED"])("%s is an analytical limitation", state => { const result = assemble(input({ evidence: [], inputStates: { osint: { state } } })); expect(result.limitations.join(" ")).toContain("esta ausencia no contradice"); expect(result.contradictingReferences).toHaveLength(0); });
});
