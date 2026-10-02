jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/firebaseAdmin", () => ({ getInstitutionalAdminDb: () => { throw Error("P7_LIVE_FORBIDDEN"); } }));
jest.mock("@/services/institutionalProjectAccessService", () => ({ authorizeInstitutionalProjectAccess: () => { throw Error("P7_LIVE_FORBIDDEN"); } }));
jest.mock("@/lib/scinceDocumentActions", () => ({ getScinceDocumentContext: jest.fn() }));
jest.mock("@/services/denueAnalyticalPublicationService", () => ({ buildDenueAnalyticalPublicationProduct: jest.fn(async () => ({ status: "EMPTY", product: null, warnings: [] })) }));
jest.mock("@/utils/crimeIncidenceInstitutionalChartMaterializer", () => ({ materializeCrimeIncidenceInstitutionalCharts: jest.fn(async (specs: any[]) => specs.map(spec => ({
  assetVersion: "1.0", visualId: spec.metadata.visualId, kind: spec.kind, visualType: "CHART", mimeType: "image/png", width: 500, height: 280,
  dataUrl: `data:image/png;base64,${require("fs").readFileSync(require("path").resolve(`tests/fixtures/p6/${spec.kind === "INCIDENT_TYPE_DISTRIBUTION" ? "BAR" : "LINE"}.png`)).toString("base64")}`,
  title: spec.title, caption: spec.kind === "INCIDENT_TYPE_DISTRIBUTION" ? "Distribución descriptiva de los registros admitidos por tipo de incidencia." : "Evolución temporal descriptiva de los registros admitidos por fecha de ocurrencia.", metadata: spec.metadata,
}))) }));
import { p6Fixture } from "../p6InstitutionalFixture";
import { readFileSync } from "fs";
import { resolve } from "path";
import { webcrypto } from "crypto";
import { Packer } from "docx";
import { formulateHumanHypothesis, reviseHumanHypothesis } from "../../src/utils/hypothesisGovernance";
import { buildEvidenceLineage } from "../../src/utils/evidenceLineage";
import { createAiAnalyticalOutput } from "../../src/utils/aiAnalysisGovernance";
import { fingerprintScinceCanonicalPoint } from "../../src/utils/scinceGeographyBinding";
import { getScinceDocumentContext } from "../../src/lib/scinceDocumentActions";
import { resolveAuthorizedInstitutionalReportSource } from "../../src/services/institutionalReportSourceService";
import { enrichInstitutionalPayloadWithCrimeIncidenceVisuals } from "../../src/utils/crimeIncidenceInstitutionalPayloadBridge";
import { buildInstitutionalGenerationModels } from "../../src/utils/institutionalGenerationModels";
import { reconcileMaterializedDocument, reconcileDocumentSemanticAudit } from "../../src/utils/institutionalDocumentSemanticIntegrity";
import { buildExecutiveGeointTechnicalAnnexModel } from "../../src/utils/executiveGeointTechnicalAnnexModel";
import { renderExecutiveGeointWordDocument } from "../../src/utils/executiveGeointWordRenderer";
import { renderExecutiveGeointTechnicalAnnexWordDocument } from "../../src/utils/executiveGeointTechnicalAnnexWordRenderer";
import { renderInstitutionalPdfFromDocx, institutionalAnnexRequiredVisualIds } from "../../src/utils/institutionalPdfRenderer";
import { buildInstitutionalPackageLineage, InstitutionalReportPackageService } from "../../src/services/institutionalReportPackageService";
import { MemoryRepository, MemoryStorage } from "./institutionalPackageMemory";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
export type P7Mode = "INDIVIDUAL" | "CORRIDOR" | "POLYGON";

/** Namespace persisted identities before running the real authorized source projection.
 * Acquisition uses declared synthetic local assets. No provider/SDK boundary is called.
 * principal-territorial-map is a report-local contract slot, not a cross-project identity.
 */
export function p7StoredProject(mode: P7Mode) {
  const prior = p6Fixture(mode), projectId = `E2E-${mode}`, ids = new Map<string, string>();
  function collect(value: any, key = "") {
    if (typeof value === "string" && /(^id$|Id$|Ids$|supportingConvergences|contradictingConvergences)/.test(key)) ids.set(value, `${projectId}-${value}`);
    else if (Array.isArray(value)) value.forEach(item => collect(item, key));
    else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => collect(v, k));
  }
  collect(prior.data); ids.set("exp", projectId); ids.set("geo", `${projectId}-geography`);
  function remap(value: any): any {
    if (typeof value === "string") return ids.get(value) || value;
    if (Array.isArray(value)) return value.map(remap);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v)]));
    return value;
  }
  const project = remap(prior.data);
  project.id = projectId; project.projectId = projectId; project.expedienteId = projectId;
  project.nombre = `QA offline ${projectId}`; project.numeroExpediente = `02102026-P7-${mode}`;
  project.canonicalGeography = project.geography;
  if (mode === "POLYGON") project.canonicalGeography.geometry.coordinates.push([
    [-102.295, 21.885], [-102.295, 21.895], [-102.285, 21.895], [-102.285, 21.885], [-102.295, 21.885],
  ]);
  if (project.scinceContext.snapshot) {
    project.scinceContext.snapshot.projectId = projectId;
    project.scinceContext.snapshot.geographyBinding.geographyFingerprint = fingerprintScinceCanonicalPoint(project.canonicalGeography);
  }
  const photoId = ids.get("photo")!, findingId = `${projectId}-finding`, analysisId = `${projectId}-analysis`;
  const lineage = buildEvidenceLineage({ sourceId: ids.get("origin-photo"), evidenceId: photoId, findingId, analysisId, geographyId: project.canonicalGeography.geographyId });
  const initial = formulateHumanHypothesis({ projectId, text: `Hipótesis humana inicial ${mode}: existe un acceso documentado.`,
    geographyId: project.canonicalGeography.geographyId, authorId: `${projectId}-PPC`, createdAt: project.generatedAt, lineage,
    supportingEvidenceIds: [photoId], contradictingEvidenceIds: [ids.get("street-view")!] });
  project.canonicalHypothesis = reviseHumanHypothesis(initial, { text: `Hipótesis humana vigente ${mode}: el acceso requiere contraste entre campo y Street View.`, authorId: `${projectId}-PPC`, updatedAt: project.generatedAt });
  project.findings = [{ title: "Acceso documentado", summary: "Registro de campo admitido", evidenceIds: [photoId], findingId,
    expedienteId: projectId, geographyId: project.canonicalGeography.geographyId, humanValidationStatus: "APPROVED", lineage,
    traceabilityId: `${projectId}-trace-finding`, lineageStatus: "SUPPORTED" }];
  project.analyses = [];
  project.analysisOutputs = [{ ...createAiAnalyticalOutput({ outputId: analysisId, outputType: "ANALYSIS", generatedAt: project.generatedAt,
    evidenceIds: [photoId], findingIds: [findingId], lineage, validationStatus: "APPROVED" }), expedienteId: projectId,
    geographyId: project.canonicalGeography.geographyId, traceabilityId: `${projectId}-trace-analysis`, sourceEvidenceId: photoId }];
  project.sweeps = [{ sweepId: `${projectId}-sweep`, projectId, geographyId: project.canonicalGeography.geographyId,
    acquisitionMode: "OFFLINE_FIXTURE", evidenceIds: project.evidence.map((x: any) => x.evidenceId), streetViewIds: project.streetView.map((x: any) => x.evidenceId) }];
  // Productive IDs are recreated by the existing incidence bridge from namespaced source metadata.
  project.visualProducts = [];
  const assets: any = {};
  for (const [id, asset] of Object.entries(prior.assets)) assets[ids.get(id) || id] = asset;
  assets["principal-territorial-map"] = { data: readFileSync(resolve(`tests/fixtures/p7/map-${mode}.png`)), type: "png", width: 500, height: 280 };
  const logos = { sspe: readFileSync(resolve("tests/fixtures/p6/logo-ssp.png")), ceipol: readFileSync(resolve("tests/fixtures/p6/logo-ceipol.png")) };
  return { project, assets, logos, ids };
}

export async function p7Fixture(mode: P7Mode, change?: (project: any) => void) {
  const seed = p7StoredProject(mode); change?.(seed.project);
  const persisted = JSON.parse(JSON.stringify(seed.project));
  const acquireSource = async () => {
    const source = await resolveAuthorizedInstitutionalReportSource({ projectId: persisted.id, sessionToken: "offline-fixture-session" }, {
    authorize: (async () => ({ allowed: true, projectId: persisted.id, actor: { institutionalUserId: `${persisted.id}-PPC`, username: "PPC fixture", role: "ADMIN" } })) as any,
    readProject: async () => structuredClone(persisted),
    });
    (getScinceDocumentContext as jest.Mock).mockImplementation(async () => structuredClone(source.project.scinceContext));
    return source;
  };
  const authorized = await acquireSource(), project = authorized.project;
  (getScinceDocumentContext as jest.Mock).mockImplementation(async (request: any) => {
    const id = typeof request === "string" ? request : request?.projectId;
    if (id && id !== project.id) throw Error("P7_SCINCE_IDENTITY_CONFLICT");
    return structuredClone(project.scinceContext);
  });
  const payload = await enrichInstitutionalPayloadWithCrimeIncidenceVisuals({ ...project, projectId: authorized.projectId, expedienteId: authorized.projectId, personaPerfiladora: authorized.actor.displayName });
  const assets = seed.assets;
  for (const visual of payload.visualProducts) assets[visual.visualId] = { data: readFileSync(resolve(`tests/fixtures/p6/${visual.kind === "INCIDENT_TYPE_DISTRIBUTION" ? "BAR" : "LINE"}.png`)), type: "png", width: 500, height: 280 };
  const context: any = { ...await buildInstitutionalGenerationModels(payload, project.nombre, project.numeroExpediente, authorized.actor, project.generatedAt),
    sourceAuthority: { projectId: authorized.projectId, sourceFingerprint: authorized.sourceFingerprint, action: authorized.action },
    visualAssetsById: assets, institutionalLogos: seed.logos };
  context.documentModel.semanticIntegrity = reconcileMaterializedDocument(context.documentModel, assets);
  const word = renderExecutiveGeointWordDocument(context.documentModel, { visualAssetsById: assets, institutionalLogos: seed.logos });
  context.documentModel.semanticIntegrity = reconcileDocumentSemanticAudit(context.documentModel.semanticIntegrity, word.renderAudit, context.documentModel.sections, context.documentModel.visualPlacements);
  const audit = context.principalTerritorialMapSpec?.denueRenderAudit;
  context.annexModel = buildExecutiveGeointTechnicalAnnexModel(context.institutionalReportInput, context.executiveModel, context.visualComposition, context.documentModel, {
    denueContextualSummary: audit ? { contextualUniverseCount: audit.denueAvailableCount, contextualDisplayedCount: audit.denueRenderedCount,
      selectionPolicy: audit.displayPolicy, methodology: "B.4/B.5 governed contextual cartography", limitations: audit.disclosures,
      sourceReferences: audit.sourceReferences, traceabilityIds: audit.traceabilityIds } : null });
  const annexWord = renderExecutiveGeointTechnicalAnnexWordDocument(context.annexModel, { visualAssetsById: assets, institutionalLogos: seed.logos });
  const reportBlob = await Packer.toBlob(word.document), annexBlob = await Packer.toBlob(annexWord.document);
  const pdf = async (kind: "EXECUTIVE_REPORT" | "TECHNICAL_ANNEX", blob: Blob, rendered: any, model: any) => renderInstitutionalPdfFromDocx(new Uint8Array(await blob.arrayBuffer()), {
    kind, projectId: project.id, numeroExpediente: project.numeroExpediente, documentModel: model, semanticIntegrity: context.documentModel.semanticIntegrity,
    requiredVisualIds: kind === "EXECUTIVE_REPORT" ? context.documentModel.semanticIntegrity.requiredVisualIds : institutionalAnnexRequiredVisualIds(context.annexModel, context.documentModel.semanticIntegrity.requiredVisualIds),
    renderedVisualIds: rendered.renderAudit.renderedVisualIds, missingVisualAssetIds: rendered.renderAudit.missingVisualAssetIds, state: "GENERATED", certified: false, published: false });
  const executivePdf = await pdf("EXECUTIVE_REPORT", reportBlob, word, context.documentModel), annexPdf = await pdf("TECHNICAL_ANNEX", annexBlob, annexWord, context.annexModel);
  context.lineage = await buildInstitutionalPackageLineage(authorized, context);
  const repository = new MemoryRepository(), storage = new MemoryStorage();
  const service = new InstitutionalReportPackageService(repository, storage, () => "2026-10-02T00:00:00.000Z", acquireSource);
  const base = { projectId: project.id, numeroExpediente: project.numeroExpediente, generatedAt: context.generatedAt, generatedBy: authorized.actor,
    generationContext: context, reportBlob, annexBlob, pdfArtifacts: { executive: executivePdf.blob, annex: annexPdf.blob,
      parity: { status: "PASS" as const, sourceDocxHashes: [executivePdf.parity.sourceDocxSha256, annexPdf.parity.sourceDocxSha256] } } };
  return { mode, project, persisted, authorized, acquireSource, context, assets, ids: seed.ids, repository, storage, service, base, word, annexWord, executivePdf, annexPdf };
}
