import { buildDocumentSemanticAudit, collectDocumentCitedVisualIds, incidenceDocumentBasis, reconcileDocumentSemanticAudit, resolveClaimVisualIds, renderDocumentClaimWithExistingGovernance } from "../src/utils/institutionalDocumentSemanticIntegrity";
import { buildCrimeIncidenceInstitutionalVisualSpecifications } from "../src/utils/crimeIncidenceInstitutionalVisualProducer";
import { buildExecutiveGeointReportModel } from "../src/utils/executiveGeointReportModel";
import { buildExecutiveGeointReportDocumentModel } from "../src/utils/executiveGeointReportDocumentModel";
import { buildExecutiveGeointTechnicalAnnexModel } from "../src/utils/executiveGeointTechnicalAnnexModel";
import { buildExecutiveVisualComposition } from "../src/utils/executiveVisualComposition";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { renderExecutiveGeointWordDocument } from "../src/utils/executiveGeointWordRenderer";
import { renderExecutiveGeointTechnicalAnnexWordDocument } from "../src/utils/executiveGeointTechnicalAnnexWordRenderer";
import { Packer } from "docx";
import JSZip from "jszip";

const time = "2026-09-06T12:00:00.000Z";
const mapId = "principal-territorial-map";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const asset = { data: png, type: "png", width: 100, height: 100 } as const;
function native(id: string, sourceType = "FIELD_PHOTO"): any {
  return { id, evidenceId: id, sourceId: `origin-${id}`, sourceType, summary: "Registro observado", acquisitionMode: "OBSERVED",
    sourceStatus: "AUTHORITATIVE", observedAt: time, geographyId: "geo", provenance: { sourceId: `origin-${id}`, observedAt: time },
    lineage: buildEvidenceLineage({ evidenceId: id, sourceId: `origin-${id}`, sourceReference: `https://fixture.test/${id}`, geographyId: "geo" }),
    publicationEligibility: { eligibility: "ELIGIBLE", role: "INSTITUTIONAL_FACT", lineageRefs: { sourceIds: [`origin-${id}`], evidenceIds: [id] } } };
}
function input(overrides: any = {}): any {
  return { projectId: "exp", generatedAt: time, geography: buildCanonicalProjectGeography({ projectId: "exp", geographyId: "geo", type: "INDIVIDUAL", points: [{ lat: 22, lng: -102 }], now: 1 }),
    hypothesis: { hypothesisId: "hyp", currentHypothesis: "Existe un acceso documentado.", supportingEvidenceIds: [], contradictingEvidenceIds: [], supportingFindingIds: [], contradictingFindingIds: [], versions: [] },
    evidence: [], streetView: [], findings: [], inferences: [], analyses: [], conclusions: [], osint: [], temporalComparisons: [], denuePois: [],
    specializedIntelligence: [], predictiveAnalyticalProducts: [], visualProducts: [], denueAnalyticalDocument: { status: "NOT_AVAILABLE" }, exclusions: [], disclosures: [],
    lineageSummary: { sourceIds: [], evidenceIds: [], findingIds: [], analysisIds: [], conclusionIds: [], itemCount: 0 }, ...overrides };
}
function model(): any { return { findings: [], keyEvidence: [], decisionImplications: [], prospectiveAnalysis: { technicalMetadata: { sourceProductIds: [] } },
  multisourceAnalysis: { fuentesIndependientes: [], technicalMetadata: {} } }; }
function composition(ids: string[] = []): any { return { principalTerritorialMap: { mapId }, secondaryVisuals: ids.map(visualId => ({ visualId })) }; }
function placements(ids: string[] = []): any[] { return [{ visualId: mapId, placementRole: "PRINCIPAL_TERRITORIAL_MAP", visibleSourceLabel: "Geografía canónica" },
  ...ids.map(visualId => ({ visualId, placementRole: "SUPPORTING_EVIDENCE", visualClass: "FOTOGRAFIA_CAMPO", visibleSourceLabel: "Fuente admitida" }))]; }
function section(sectionId: string, text: string): any { return { sectionId, content: [text], order: 1, title: "QA", status: "READY", densityPolicy: { targetPages: "1" } }; }
function snapshot(): any {
  return { exportId: "snapshot-1", productClassification: "DESCRIPTIVE_ANALYTICAL_PRODUCT", analyticalLevel: "DESCRIPTIVE",
    queryReference: { status: "EXECUTED", admission: { accepted: true }, request: { datasetIdentity: { datasetId: "ds", source: "OBSERVED" },
      requestProvenance: { sourceReference: "Fuente admitida" }, crimeFilters: { incidentTypes: ["A"] }, temporalFilters: { start: "2026-01-01", end: "2026-01-03" } } },
    datasetReference: { datasetId: "ds", coverage: { temporal: { start: "2016-01-01", end: "2026-06-23" } } },
    geographicReference: { expediente: { geographyId: "geo" } }, lineage: { dataset: "ds", filters: { incidentTypes: ["A"] } }, limitations: ["Descriptivo"],
    projectionReference: { temporalReference: { query: { start: "2026-01-01", end: "2026-01-03" } }, metrics: {
      frequency: { totalRecords: 4, byIncidentType: [{ value: "A", count: 4 }] }, percentage: { basis: 4, byIncidentType: [{ value: "A", count: 4, percentage: 100 }] },
      distribution: { byOccurredDate: [{ value: "2026-01-01", count: 3 }, { value: "2026-01-03", count: 1 }] } } } };
}
function incidenceInput(): any {
  const s = snapshot();
  const charts = buildCrimeIncidenceInstitutionalVisualSpecifications({ metrics: s.projectionReference.metrics, sourceQuery: s.queryReference,
    temporalReference: s.projectionReference.temporalReference, geographicReference: s.geographicReference, datasetReference: s.datasetReference, lineage: s.lineage, limitations: s.limitations } as any).charts;
  return input({ crimeIncidenceExportContract: s, visualProducts: charts.map(chart => ({ visualId: chart.metadata.visualId, kind: chart.kind,
    visualType: "CHART", sourceType: chart.metadata.sourceReference, transformation: chart.metadata.transformation, datasetSourceRefs: ["ds"], provenance: chart.metadata,
    publicationEligibility: "ELIGIBLE", acquisitionMode: "OBSERVED", isSimulated: false, variables: chart.metadata.variables,
    assetRef: `data:image/png;base64,${png.toString("base64")}`, title: chart.title, caption: chart.subtitle,
    crimeIncidenceVisualMetadata: { chartKind: chart.kind } })) });
}
function auditFor(kind: string) {
  const data = input(); const m = model(); let text = "Como se observa en el mapa, el ámbito está delimitado."; let sid = "territorial-situation"; let ids: string[] = [];
  if (kind === "BAR" || kind === "LINE") {
    Object.assign(data, incidenceInput()); text = `Incidencia: 4 registros, gráfica ${kind}.`;
    ids = [data.visualProducts[kind === "BAR" ? 0 : 1].visualId];
  } else if (kind !== "MAP") {
    const item = native("photo", kind === "STREET_VIEW" ? "STREET_VIEW" : "FIELD_PHOTO");
    if (kind === "STREET_VIEW") { item.streetViewMetadata = { provider: "Google Street View", panoId: "pano" }; data.streetView = [item]; }
    else data.evidence = [item];
    sid = "key-evidence"; text = kind === "STREET_VIEW" ? "Street View muestra un acceso documentado." : "La fotografía muestra un acceso documentado.";
    m.keyEvidence = [{ technicalMetadata: { sourceItemId: item.id }, visualReference: "fixture" }]; ids = [item.id];
  }
  const sections = [section(sid, text)];
  const ps = placements(ids);
  const audit = buildDocumentSemanticAudit(m, data, composition(ids), sections, ps, true);
  return { data, m, sections, audit, placements: ps, ids: [mapId, ...ids] };
}
async function xml(document: any): Promise<string> { return (await JSZip.loadAsync(await Packer.toBuffer(document))).file("word/document.xml")!.async("string"); }

describe("P5 institutional semantic integrity offline", () => {
  test.each(["BAR", "LINE"])("incidence text and %s share snapshot total", kind => {
    const data = incidenceInput(); const basis = incidenceDocumentBasis(data)!;
    expect(data.visualProducts[kind === "BAR" ? 0 : 1].provenance.total).toBe(basis.total);
    expect(auditFor(kind).audit.numericAssertions[0].snapshotReference).toBe("snapshot-1");
  });
  test.each(["period", "geography", "filters", "sourceIdentity", "datasetReference", "lineage"])("incidence %s is shared with both charts", key => {
    const data = incidenceInput(); const basis: any = incidenceDocumentBasis(data);
    for (const visual of data.visualProducts) expect(visual.provenance[key]).toEqual(basis[key]);
  });
  test("visible incidence attribution comes from admitted contract", () => expect(incidenceDocumentBasis(incidenceInput())!.source).toBe("Fuente admitida"));
  test.each(["total", "filters", "period", "geography", "sourceIdentity", "datasetReference", "lineage"])("snapshot mismatch in %s blocks", key => {
    const data = incidenceInput(); data.visualProducts[0].provenance = { ...data.visualProducts[0].provenance, [key]: "OTHER" };
    expect(() => incidenceDocumentBasis(data)).toThrow("SNAPSHOT_MISMATCH");
  });
  test.each(["MAP", "BAR", "LINE", "PHOTO", "STREET_VIEW"])("%s citation and actual rendering passes", kind => {
    const { audit, ids, sections } = auditFor(kind);
    expect(reconcileDocumentSemanticAudit(audit, { renderedVisualIds: ids, missingVisualAssetIds: [] }, sections).status).toBe("RECONCILED");
  });
  test.each(["MAP", "BAR", "LINE", "PHOTO", "STREET_VIEW"])("%s cited but missing blocks", kind => {
    const { audit, ids } = auditFor(kind);
    expect(() => reconcileDocumentSemanticAudit(audit, { renderedVisualIds: ids.slice(0, -1), missingVisualAssetIds: [ids.at(-1)!] })).toThrow("REQUIRED_VISUAL_NOT_RENDERED");
  });
  test("uncited optional missing does not block", () => {
    const { audit } = auditFor("MAP");
    expect(reconcileDocumentSemanticAudit({ ...audit, optionalVisualIds: ["optional"] }, { renderedVisualIds: [mapId], missingVisualAssetIds: ["optional"] }).status).toBe("RECONCILED");
  });
  test.each(["ASSET_MISSING", "ASSET_UNAVAILABLE", "ASSET_INVALID", "ASSET_EXCLUDED"])("Street View %s cannot pass without rendering", state => {
    const { audit } = auditFor("STREET_VIEW");
    expect(() => reconcileDocumentSemanticAudit({ ...audit, ...( { assetStates: { photo: state } } as any) }, { renderedVisualIds: [mapId], missingVisualAssetIds: ["photo"] })).toThrow();
  });
  test("missing audit contains absent required even if renderer omitted its placement", () => {
    const { audit } = auditFor("PHOTO"); const result = reconcileDocumentSemanticAudit({ ...audit, enforced: false }, { renderedVisualIds: [mapId], missingVisualAssetIds: [] });
    expect(result.missingVisualAssetIds).toEqual(["photo"]);
  });
  test("required IDs are deduplicated", () => { const { audit } = auditFor("PHOTO"); expect(new Set(audit.requiredVisualIds).size).toBe(audit.requiredVisualIds.length); });
  test("claim mutation after reservation blocks", () => { const { audit, ids, sections } = auditFor("MAP"); sections[0].content[0] = "Texto alterado";
    expect(() => reconcileDocumentSemanticAudit(audit, { renderedVisualIds: ids, missingVisualAssetIds: [] }, sections)).toThrow("CLAIM_TEXT_CHANGED"); });
  test("legacy claim without provenance blocks", () => { const data = input({ evidence: [{ id: "legacy", summary: "Observación legacy" }] }); const m = model(); m.keyEvidence = [{ technicalMetadata: { sourceItemId: "legacy" } }];
    expect(() => buildDocumentSemanticAudit(m, data, composition(), [section("key-evidence", "Observación legacy")], placements(), true)).toThrow("PROVENANCE_MISSING"); });
  test("legacy number without snapshot blocks", () => { const item = native("legacy"); const data = input({ evidence: [item] }); const m = model(); m.keyEvidence = [{ technicalMetadata: { sourceItemId: "legacy" } }];
    expect(() => buildDocumentSemanticAudit(m, data, composition(), [section("key-evidence", "Se registran 999 delitos.")], placements(), true)).toThrow("NUMERIC_SNAPSHOT_MISSING"); });
  test("wrong textual total blocks", () => { const data = incidenceInput(); expect(() => buildDocumentSemanticAudit(model(), data, composition(), [section("territorial-situation", "Incidencia: 999 registros.")], placements(), true)).toThrow("TEXT_TOTAL_MISMATCH"); });
  test("visual presence alone is not analytic support", () => { const data = incidenceInput(); expect(resolveClaimVisualIds("La gráfica BAR muestra distribución", [native("unrelated")], data).unresolved).toContain("BAR"); });
  test("photo retains original source and evidence lineage", () => { const claim = auditFor("PHOTO").audit.narrativeClaims[0]; expect(claim.sourceIds).toContain("origin-photo"); expect(claim.evidenceIds).toContain("photo"); expect(claim.findingIds).toEqual([]); });
  test("observed evidence remains OBSERVED", () => expect(auditFor("PHOTO").audit.narrativeClaims[0].state).toBe("OBSERVED"));
  test("derived incidence remains DERIVED", () => expect(auditFor("BAR").audit.narrativeClaims[0].state).toBe("DERIVED"));
  test("hypothesis remains HYPOTHESIS", () => { const data = input(); const audit = buildDocumentSemanticAudit(model(), data, composition(), [section("initial-hypothesis", "Hipótesis: Existe un acceso")], placements(), true); expect(audit.narrativeClaims[0].state).toBe("HYPOTHESIS"); });
  test("prospective remains PROSPECTIVE", () => { const product = { ...native("pap"), productId: "pap", acquisitionMode: "DERIVED" }; const data = input({ predictiveAnalyticalProducts: [product] }); const m = model(); m.prospectiveAnalysis.technicalMetadata.sourceProductIds = ["pap"];
    expect(buildDocumentSemanticAudit(m, data, composition(), [section("prospective-analysis", "Escenario: Persistencia cualitativa")], placements(), true).narrativeClaims[0].state).toBe("PROSPECTIVE"); });
  test("caption cannot add an analytical conclusion", () => { const data = input(); const ps = placements(); ps[0].caption = "El mapa confirma causalidad criminal"; buildDocumentSemanticAudit(model(), data, composition(), [section("territorial-situation", "Territorio delimitado")], ps, true); expect(ps[0].caption).not.toMatch(/confirma|criminal|causalidad/); expect(ps[0].caption).toContain("Fuente:"); });
  test.each(["SCINCE", "DENUE"])("%s narrative helper does not establish causality", source => { const rendered = renderDocumentClaimWithExistingGovernance({ ...native(source), text: "La población genera delincuencia" }, "EVIDENCE"); expect(rendered.text).not.toContain("genera"); });
  test.each(["FIELD_PHOTO", "STREET_VIEW"])("%s does not become finding", sourceType => expect(buildExecutiveGeointReportModel(input({ evidence: [native("photo", sourceType)] })).findings).toHaveLength(0));
  test("required photo is reserved through P3", () => { const { data, m } = auditFor("PHOTO"); m.keyEvidence[0].title = "Fotografía"; m.keyEvidence[0].summary = "Registro"; expect(collectDocumentCitedVisualIds(m, data)).toEqual(["photo"]); });
  test("fallback visual is not selected for a required source", () => { const { data, m } = auditFor("PHOTO"); expect(() => buildDocumentSemanticAudit(m, data, composition(), [section("key-evidence", "La fotografía muestra acceso")], placements(), true)).toThrow("NOT_SELECTED"); });
  test("same image cannot support incompatible statements without explicit relation", () => { const left = native("a"); const right = native("b"); left.assertion = "PRESENT"; right.assertion = "ABSENT"; left.visualIds = right.visualIds = ["shared"];
    const data = input({ evidence: [left, right], visualProducts: [{ visualId: "shared", sourceType: "FIELD", analyticalPurpose: "Contraste", evidenceIds: ["a", "b"] }] }); const m = model(); m.keyEvidence = [left, right].map(item => ({ technicalMetadata: { sourceItemId: item.id } }));
    expect(() => buildDocumentSemanticAudit(m, data, composition(["shared"]), [{ ...section("key-evidence", "Acceso presente"), content: ["Acceso presente", "Acceso ausente"] }], placements(["shared"]), true)).toThrow("INCOMPATIBLE_VISUAL_CLAIMS"); });
  test("actual DOCX reconciles rendered IDs", async () => { const { audit, sections, ids, placements: ps } = auditFor("PHOTO"); const rendered = renderExecutiveGeointWordDocument({ identity: { numeroExpediente: "QA" }, sections,
    visualPlacements: ps.map(p => ({ ...p, sectionId: "key-evidence" })), presentation: { documentTitle: "QA" }, semanticIntegrity: reconcileDocumentSemanticAudit(audit, { renderedVisualIds: ids, missingVisualAssetIds: [] }, sections, ps) } as any,
    { visualAssetsById: Object.fromEntries(ids.map(id => [id, asset])) }); expect(rendered.renderAudit.renderedVisualIds).toEqual(ids); expect(await xml(rendered.document)).toContain("fotografía muestra un acceso"); });
  test("actual renderer blocks cited missing before DOCX can be packed", () => { const { audit, sections } = auditFor("PHOTO"); expect(() => renderExecutiveGeointWordDocument({ identity: { numeroExpediente: "QA" }, sections,
    visualPlacements: placements(["photo"]).map(p => ({ ...p, sectionId: "key-evidence" })), presentation: { documentTitle: "QA" }, semanticIntegrity: audit } as any, { visualAssetsById: { [mapId]: asset } })).toThrow("RECONCILED_AUDIT_REQUIRED"); });
  test("real executive to document to annex preserves provenance and queried period", () => {
    const data = incidenceInput(); const m = buildExecutiveGeointReportModel(data); const comp = buildExecutiveVisualComposition(m, data, { canonicalPrincipalOnly: true });
    const doc = buildExecutiveGeointReportDocumentModel(m, comp, data, { enforceSemanticIntegrity: true });
    expect(doc.sections.find(s => s.sectionId === "territorial-situation")!.content.join(" ")).toContain("2026-01-01 a 2026-01-03");
    const annex = buildExecutiveGeointTechnicalAnnexModel(data, m, comp, doc); expect(annex.technicalMetadata.semanticIntegrity).toBe(doc.semanticIntegrity);
    expect(annex.sections.find(s => s.sectionId === "incidence")!.facts).toContainEqual({ label: "Periodo inicial", value: "2026-01-01" });
  });
  test("unavailable annex image suppresses observational text", async () => {
    const record = { recordId: "photo", title: "DETERIORO OBSERVADO", sourceType: "FIELD_PHOTO", contextOriginal: "La fotografía confirma deterioro", limitations: [], traceabilityIds: [], visualReference: "fixture" };
    const rendered = renderExecutiveGeointTechnicalAnnexWordDocument({ identity: { numeroExpediente: "QA" }, sections: [{ sectionId: "field-photographs", title: "Campo", content: [], records: [record], facts: [], tables: [] }],
      executiveReportReference: {}, technicalMetadata: { semanticIntegrity: { enforced: true } } } as any, { exportMode: "DRAFT" });
    const text = await xml(rendered.document); expect(text).not.toContain("confirma deterioro"); expect(text).toContain("Activo visual no disponible");
  });
  test("multiple records from one origin do not become multiple independent sources", () => {
    const a = native("a"); const b = native("b"); b.sourceId = a.sourceId; b.lineage = a.lineage;
    const m = buildExecutiveGeointReportModel(input({ evidence: [a, b] }));
    expect(m.multisourceAnalysis.fuentesIndependientes.length).toBeLessThanOrEqual(1);
  });
  test("shared dependency survives documentary audit", () => {
    const m = model(); m.multisourceAnalysis.technicalMetadata.governedAnalysis = { outputId: "assembly", provenance: { sourceFingerprint: "fp" },
      sourceDependencies: [{ leftItemId: "a", rightItemId: "b", dependencyType: "SHARED_ORIGIN", countsAsIndependentCorroboration: false }], independentSources: [] };
    const audit = buildDocumentSemanticAudit(m, input(), composition(), [section("multisource-analysis", "Dependencia parcial: origen compartido")], placements(), true);
    expect(audit.sourceDependencies[0]).toMatchObject({ countsAsIndependentCorroboration: false }); expect(audit.independentSources).toEqual([]);
  });
  test("invented independent source count blocks", () => {
    const m = model(); m.multisourceAnalysis.fuentesIndependientes = ["a", "b"]; m.multisourceAnalysis.technicalMetadata.governedAnalysis = {
      outputId: "assembly", provenance: { sourceFingerprint: "fp" }, sourceDependencies: [], independentSources: ["a"] };
    expect(() => buildDocumentSemanticAudit(m, input(), composition(), [], placements(), true)).toThrow("INDEPENDENT_SOURCE_COUNT_MISMATCH");
  });
  test("PPC relation retains human validation details", () => {
    const m = model(); const relation = { convergenceId: "relation", humanReviewStatus: "APPROVED", reviewedBy: "PPC-fixture", reviewedAt: time };
    m.multisourceAnalysis.technicalMetadata.governedAnalysis = { outputId: "assembly", provenance: { sourceFingerprint: "fp" }, convergences: [relation], sourceDependencies: [], independentSources: [] };
    const audit = buildDocumentSemanticAudit(m, input(), composition(), [section("multisource-analysis", "Convergencia: acceso revisado")], placements(), true);
    expect(audit.narrativeClaims[0].state).toBe("HUMAN_VALIDATED_RELATION"); expect((audit.narrativeClaims[0].validation as any)[0].reviewedRelations[0]).toMatchObject({ reviewedBy: "PPC-fixture", humanReviewStatus: "APPROVED" });
  });
  test.each(["contradiction", "limitation"])("P4 %s survives document without truncation", kind => {
    const data = input(); const m = buildExecutiveGeointReportModel(data); const result = m.multisourceAnalysis.technicalMetadata.governedAnalysis!;
    if (kind === "contradiction") m.multisourceAnalysis.contradicciones = Array.from({ length: 7 }, (_, index) => `Contraste pendiente ${index}`);
    else result.limitations = ["LIMITACIÓN CANÓNICA CONSERVADA"];
    const doc = buildExecutiveGeointReportDocumentModel(m, buildExecutiveVisualComposition(m, data), data);
    expect(doc.sections.find(s => s.sectionId === "multisource-analysis")!.content.join(" ")).toContain(kind === "contradiction" ? "Contraste pendiente 6" : "LIMITACIÓN CANÓNICA CONSERVADA");
  });
  test("caption mutation after reservation blocks", () => {
    const { audit, sections, ids, placements: ps } = auditFor("PHOTO"); ps[1].caption = "La fotografía demuestra causalidad";
    expect(() => reconcileDocumentSemanticAudit(audit, { renderedVisualIds: ids, missingVisualAssetIds: [] }, sections, ps)).toThrow("VISUAL_DESCRIPTION_CHANGED");
  });
  test("unreserved paragraph added after audit blocks", () => {
    const { audit, sections, ids } = auditFor("PHOTO"); sections[0].content.push("Se registran 999 delitos sin snapshot.");
    expect(() => reconcileDocumentSemanticAudit(audit, { renderedVisualIds: ids, missingVisualAssetIds: [] }, sections)).toThrow("UNRESERVED_NARRATIVE_CLAIM");
  });
  test("derived evidence remains DERIVED", () => {
    const { data, m, sections, placements: ps } = auditFor("PHOTO"); data.evidence[0].acquisitionMode = "DERIVED";
    expect(buildDocumentSemanticAudit(m, data, composition(["photo"]), sections, ps, true).narrativeClaims[0].state).toBe("DERIVED");
  });
});
