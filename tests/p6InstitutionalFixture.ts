import { reconcileMaterializedDocument } from "../src/utils/institutionalDocumentSemanticIntegrity";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildExecutiveCanonicalTerritorialMapSpec } from "../src/utils/executiveCanonicalTerritorialMap";
import { fingerprintScinceCanonicalPoint } from "../src/utils/scinceGeographyBinding";
import { buildScinceCanonicalSnapshot } from "../src/utils/scinceCanonicalSnapshot";
import { formulateHumanHypothesis, buildReportChapter0Hypothesis } from "../src/utils/hypothesisGovernance";
import { buildInstitutionalConvergence, approveConvergenceResult } from "../src/utils/institutionalMultisourceConvergence";
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
const unusedPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const png = readFileSync(resolve("tests/fixtures/p6/field.png"));
const asset = { data: png, type: "png", width: 100, height: 100 } as const;
function native(id: string, sourceType = "FIELD_PHOTO"): any {
  return { id, evidenceId: id, sourceId: `origin-${id}`, sourceType, summary: "Registro observado", acquisitionMode: "OBSERVED",
    sourceEvidenceId:id,traceabilityId:`trace-${id}`,expedienteId:"exp",sourceReference:`https://fixture.test/${id}`,
    acquisitionStatus:"ACQUIRED",isSimulated:false,
    epistemicIntegrity:{acquisitionMode:"OBSERVED",acquisitionStatus:"ACQUIRED",validationStatus:"APPROVED",semanticRole:"SOURCE_FACT",isSimulated:false,isConnectivityOnly:false},
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
    assetRef: `data:image/png;base64,${readFileSync(resolve(`tests/fixtures/p6/${chart.chartType}.png`)).toString("base64")}`, title: chart.title, caption: chart.subtitle,
    crimeIncidenceVisualMetadata: { chartKind: chart.kind }, chartType: chart.chartType })) });
}
function observed(geo: any): any {
  return { success: true, projectId: "P1", geographyId: geo.geographyId, geographyType: "INDIVIDUAL",
    spatialMode: "CANONICAL_POINT", geographyFingerprint: fingerprintScinceCanonicalPoint(geo),
    queryCoordinate: { lat: 21.881, lng: -102.291 }, datasetId: "scince-fixture-2020", datasetYear: 2020, datasetVersion: "declared-v1",
    geographicLevel: "MANZANA", demographicGeographicLevel: "AGEB", sourceRowKey: "source-row-scince",
    demographics: { geographicLevel: "AGEB", populationTotal: 98765, housingTotal: 34567,
      inhabitedPrivateHousing: 23456, uninhabitedPrivateHousing: null, marginacion: null,
      marginacionNote: "No disponible: marginación no forma parte del producto importado." },
    provenance: { datasetId: "scince-fixture-2020", referenceYear: 2020, version: "declared-v1", productName: "Producto INEGI observado",
      importedAt: "2026-09-01T01:00:00.000Z", completedAt: "2026-09-02T01:00:00.000Z",
      geographySourceUrl: "https://www.inegi.org.mx/geography-fixture", geographySha256: "a".repeat(64),
      censusSourceUrl: "https://www.inegi.org.mx/census-fixture", censusSha256: "b".repeat(64),
      queryCoordinates: { lat: 21.881, lng: -102.291 }, geographicLevel: "MANZANA", demographicGeographicLevel: "AGEB", sourceRowKey: "source-row-scince" },
    limitations: ["Cobertura limitada al dataset oficial importado.", "Las cifras corresponden al nivel AGEB declarado."] };
}


export function p6Fixture(type: "INDIVIDUAL" | "CORRIDOR" | "POLYGON" = "INDIVIDUAL") {
 const geo = buildCanonicalProjectGeography({ projectId:"exp", geographyId:"geo", type, now:1, points: type === "INDIVIDUAL" ? [{lat:21.881,lng:-102.291}] : type === "CORRIDOR" ? [{lat:21.881,lng:-102.291},{lat:21.9,lng:-102.28},{lat:21.92,lng:-102.27}] : [{lat:21.88,lng:-102.30},{lat:21.88,lng:-102.28},{lat:21.90,lng:-102.28},{lat:21.90,lng:-102.30}] });
 const data=incidenceInput(); data.geography=geo;
 data.visualProducts.forEach((v:any)=>v.visualType="STATISTICAL_CHART");
 data.projectId="exp";
 data.hypothesis=buildReportChapter0Hypothesis({canonicalHypothesis:formulateHumanHypothesis({projectId:"exp",text:"Existe un acceso documentado.",geographyId:"geo",authorId:"PPC-fixture",createdAt:time,lineage:buildEvidenceLineage({sourceId:"ppc-fixture",geographyId:"geo"})})});
 const photo=native("photo"); photo.title="Fotografía de campo"; photo.summary="La fotografía muestra un acceso documentado.";
 photo.visualReference="asset://field"; photo.coordinates={lat:21.881,lng:-102.291}; photo.category="ACCESS"; photo.assertion="PRESENT"; photo.providerId="field";
 const sv=native("street-view","STREET_VIEW"); sv.title="Street View"; sv.summary="Street View muestra un acceso documentado.";
 sv.visualReference="asset://street-view"; sv.previewUrl=sv.visualReference; sv.sourceProvider="GOOGLE_STREET_VIEW";
 sv.coordinates=photo.coordinates; sv.category="ACCESS"; sv.assertion="ABSENT"; sv.providerId="google";
 sv.streetViewMetadata={provider:"GOOGLE_STREET_VIEW",panoId:"pano-offline",heading:10,pitch:0,fov:45,panoramaLat:21.881,panoramaLng:-102.291,capturedAt:time};
 data.evidence=[photo]; data.streetView=[sv];
 for(const item of [photo,sv]) { item.assetRef=item.visualReference; item.traceabilityId=`trace-${item.id}`; item.traceabilityIds=[item.traceabilityId]; }
 const context={...native("places-context","PLACES"),coordinates:photo.coordinates,providerId:"places",category:"ACCESS",assertion:"PRESENT",summary:"Registro contextual de contraste",title:"Registro contextual de Places"};
 for(const item of [photo,context]) {
   item.phenomenon="ACCESS_FEATURE_CORROBORATION";
   item.convergenceSource={sourceKind:item.sourceType,sourceId:item.sourceId,sourceEvidenceId:item.evidenceId,traceabilityId:item.traceabilityId,expedienteId:"exp",geographyId:"geo",coordinates:item.coordinates,timestamp:time,temporalClass:"CURRENT",epistemicRole:"SOURCE_FACT",validationStatus:"APPROVED",lineage:item.lineage,sourceReferences:[item.sourceReference],phenomenonTags:["access"],assertion:"PRESENT",acquisitionMode:"OBSERVED"};
 }
 data.evidence.push(context);
 data.convergences=[approveConvergenceResult(buildInstitutionalConvergence({expedienteId:"exp",geographyId:"geo",phenomenon:"ACCESS_FEATURE_CORROBORATION",sources:[photo.convergenceSource,context.convergenceSource],hypothesisRelation:"SUPPORTS",generatedAt:time}),{reviewedBy:"PPC-fixture",reviewedAt:time})];
 if(type==="INDIVIDUAL") data.predictiveAnalyticalProducts=[{...native("pap"),acquisitionMode:"DERIVED",productId:"pap",expedienteId:"exp",geographyId:"geo",canonicalGeographyType:"POINT",productType:"SPATIAL_PERSISTENCE_OUTLOOK",analyticalLevel:"PROSPECTIVE_SCENARIO",trend:"STABLE",scenario:"PERSISTENCE",supportingConvergences:[data.convergences[0].convergenceId],contradictingConvergences:[],supportingFactors:["Contraste de campo documentado"],contradictingFactors:["Contradicción de captura pendiente de resolución"],assumptions:[],limitations:["No constituye certeza de ocurrencia futura."],confidence:0.74,confidenceBasis:"Evaluación PPC declarada en fixture",uncertaintyLevel:"MODERATE",uncertaintyReasons:["Contraste pendiente"],temporalWindow:{analysisWindowStart:"2026-08-01T00:00:00.000Z",analysisWindowEnd:"2026-09-01T00:00:00.000Z",generatedAt:time,validUntil:"2026-11-06T00:00:00.000Z",temporalAssumptions:[]},validUntil:"2026-11-06T00:00:00.000Z",hypothesisRelation:"SUPPORTS",fieldStatus:"fieldSupport",epistemicRole:"ANALYTICAL_PROJECTION",humanReviewStatus:"APPROVED",reviewedBy:"PPC-fixture",reviewedAt:time,traceabilityIds:["trace-pap"],producedFromApprovedConvergences:true,blockingReasons:[],producedPersonalPrediction:false,producedCrimeOccurrenceCertainty:false,snapshot:{dataset:{datasetId:"pap-fixture"}}}];
 data.osint=[{...native("osint","OSINT"),title:"Registro OSINT admitido",summary:"Referencia documental del acceso",sourceReference:"https://fixture.test/osint",url:"https://fixture.test/osint"}];
 data.osint[0].providerId="documental-fixture";data.osint[0].epistemicIntegrity.providerName="Fuente documental de QA";
 for(const product of data.predictiveAnalyticalProducts) {product.sourceType="PROSPECTIVE";product.epistemicIntegrity.acquisitionMode="DERIVED";product.epistemicIntegrity.semanticRole="ANALYTICAL_PROJECTION";}
 data.denuePois=[{...native("denue","DENUE"),source:"DENUE",provider:"INEGI_DENUE",territorialStatus:"INSTITUTIONAL",id:"denue",name:"Comercio observado",nombre:"Comercio observado",lat:21.881,lng:-102.291,activityCode:"461110",scian:"461110",activity:"Comercio"}];
 data.scinceContext=type==="INDIVIDUAL" ? {publicationStatus:"PUBLISHABLE",territorialFreshness:"CURRENT",snapshot:buildScinceCanonicalSnapshot({...observed(geo), projectId:"exp"}),reason:null} : {publicationStatus:"NOT_PUBLISHABLE_MISSING",territorialFreshness:"MISSING",snapshot:null,reason:"SCINCE: cobertura topológica no disponible para este ámbito; ausente declarado."};
 data.disclosures=[{message:"Fixture offline: ninguna adquisición real ni certificación."}];
 const executive=buildExecutiveGeointReportModel(data,{documentIdentity:{numeroExpediente:`01102026-P6-${type}`,projectId:"exp"},nombreExpediente:`QA offline ${type}`,personaPerfiladora:"PPC fixture",fecha:time});
 const composition=buildExecutiveVisualComposition(executive,data,{canonicalPrincipalOnly:true,principalMapSpec:buildExecutiveCanonicalTerritorialMapSpec(geo),citedVisualIds:data.visualProducts.map((x:any)=>x.visualId).concat(["photo","street-view"])});
 const document=buildExecutiveGeointReportDocumentModel(executive,composition,data,{enforceSemanticIntegrity:true});

 const assets:any={"principal-territorial-map":{data:readFileSync(resolve(`tests/fixtures/p6/map-${type}.png`)),type:"png",width:500,height:280},photo:{data:png,type:"png",width:400,height:230},"street-view":{data:readFileSync(resolve("tests/fixtures/p6/street-view.png")),type:"png",width:400,height:230}};
 data.visualProducts.forEach((v:any)=>assets[v.visualId]={data:readFileSync(resolve(`tests/fixtures/p6/${v.chartType}.png`)),type:"png",width:500,height:280});
 const logos={sspe:readFileSync(resolve("tests/fixtures/p6/logo-ssp.png")),ceipol:readFileSync(resolve("tests/fixtures/p6/logo-ceipol.png"))};
 document.semanticIntegrity=reconcileMaterializedDocument(document,assets);
 const annex=buildExecutiveGeointTechnicalAnnexModel(data,executive,composition,document);
 const word=renderExecutiveGeointWordDocument(document,{visualAssetsById:assets,institutionalLogos:logos});
 const annexWord=renderExecutiveGeointTechnicalAnnexWordDocument(annex,{visualAssetsById:assets,institutionalLogos:logos});
 return {data,executive,composition,document,annex,word,annexWord,assets, mapSpec:buildExecutiveCanonicalTerritorialMapSpec(geo)};
}
