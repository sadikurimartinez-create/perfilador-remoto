jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/utils/crimeIncidenceInstitutionalChartMaterializer", () => ({ materializeCrimeIncidenceInstitutionalCharts: jest.fn(async (specs: any[]) => specs.map(spec => ({
  assetVersion: "1.0", visualId: spec.metadata.visualId, kind: spec.kind, visualType: "CHART", mimeType: "image/png", width: 500, height: 280,
  dataUrl: `data:image/png;base64,${require("fs").readFileSync(require("path").resolve(`tests/fixtures/p6/${spec.kind === "INCIDENT_TYPE_DISTRIBUTION" ? "BAR" : "LINE"}.png`)).toString("base64")}`,
  title: spec.title, caption: spec.kind === "INCIDENT_TYPE_DISTRIBUTION" ? "Distribución descriptiva de los registros admitidos por tipo de incidencia." : "Evolución temporal descriptiva de los registros admitidos por fecha de ocurrencia.", metadata: spec.metadata,
}))) }));
jest.mock("@/lib/scinceDocumentActions", () => ({ getScinceDocumentContext: jest.fn() }));
jest.mock("@/services/denueAnalyticalPublicationService", () => ({ buildDenueAnalyticalPublicationProduct: jest.fn(async () => ({ status: "EMPTY", product: null, warnings: [] })) }));
import { p6Fixture } from "../p6InstitutionalFixture";
import { formulateHumanHypothesis } from "../../src/utils/hypothesisGovernance";
import { buildEvidenceLineage } from "../../src/utils/evidenceLineage";
import { createAiAnalyticalOutput } from "../../src/utils/aiAnalysisGovernance";
import { getScinceDocumentContext } from "../../src/lib/scinceDocumentActions";
import { enrichInstitutionalPayloadWithCrimeIncidenceVisuals } from "../../src/utils/crimeIncidenceInstitutionalPayloadBridge";
import { buildInstitutionalGenerationModels } from "../../src/utils/institutionalGenerationModels";
import { reconcileMaterializedDocument, reconcileDocumentSemanticAudit } from "../../src/utils/institutionalDocumentSemanticIntegrity";
import { buildExecutiveGeointTechnicalAnnexModel } from "../../src/utils/executiveGeointTechnicalAnnexModel";
import { renderExecutiveGeointWordDocument } from "../../src/utils/executiveGeointWordRenderer";
import { renderExecutiveGeointTechnicalAnnexWordDocument } from "../../src/utils/executiveGeointTechnicalAnnexWordRenderer";
import { renderInstitutionalPdfFromDocx, institutionalAnnexRequiredVisualIds } from "../../src/utils/institutionalPdfRenderer";
import { buildInstitutionalPackageLineage, InstitutionalReportPackageService } from "../../src/services/institutionalReportPackageService";
import { MemoryRepository, MemoryStorage } from "./institutionalPackageMemory";
import { Packer } from "docx";
import { webcrypto } from "crypto";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

/** Reopen the P6 fixture as persisted inputs; use the same assets and hypothesis. */
export async function preP7Fixture(changeProject?: (project: any) => void) {
  const f = p6Fixture();
  const lineage = buildEvidenceLineage({ sourceId: "origin-photo", evidenceId: "photo", findingId: "finding", analysisId: "analysis", geographyId: "geo" });
  const project: any = { ...f.data, id: "exp", nombre: "Expediente", numeroExpediente: f.document.identity.numeroExpediente,
    canonicalGeography: f.data.geography, canonicalHypothesis: formulateHumanHypothesis({ projectId: "exp", text: f.data.hypothesis.currentHypothesis,
      geographyId: "geo", authorId: "PPC-fixture", createdAt: f.data.generatedAt, lineage }),
    findings: [{ title: "Acceso documentado", summary: "Registro de campo admitido", evidenceIds: ["photo"], findingId: "finding", expedienteId: "exp", geographyId: "geo", humanValidationStatus: "APPROVED", lineage, traceabilityId: "trace-finding", lineageStatus: "SUPPORTED" }],
    analyses: [], analysisOutputs: [createAiAnalyticalOutput({ outputId: "analysis", outputType: "ANALYSIS", generatedAt: f.data.generatedAt, evidenceIds: ["photo"], findingIds: ["finding"], lineage, validationStatus: "APPROVED" })] };
  changeProject?.(project);
  (getScinceDocumentContext as jest.Mock).mockResolvedValue(f.data.scinceContext);
  const authorized = { projectId: "exp", project, sourceFingerprint: "sha256:offline-authorized-source", actor: { uid: "user-1", displayName: "Analista Uno" }, action: "GENERATE_REPORT" as const };
  const payload = await enrichInstitutionalPayloadWithCrimeIncidenceVisuals({ ...project, projectId: "exp", expedienteId: "exp", personaPerfiladora: authorized.actor.displayName });
  const context: any = { ...await buildInstitutionalGenerationModels(payload, project.nombre, project.numeroExpediente, authorized.actor, f.data.generatedAt),
    sourceAuthority: { projectId: "exp", sourceFingerprint: authorized.sourceFingerprint, action: authorized.action }, visualAssetsById: f.assets };
  context.documentModel.semanticIntegrity = reconcileMaterializedDocument(context.documentModel, context.visualAssetsById);
  const word = renderExecutiveGeointWordDocument(context.documentModel, { visualAssetsById: f.assets });
  context.documentModel.semanticIntegrity = reconcileDocumentSemanticAudit(context.documentModel.semanticIntegrity, word.renderAudit, context.documentModel.sections, context.documentModel.visualPlacements);
  const audit = context.principalTerritorialMapSpec?.denueRenderAudit;
  context.annexModel = buildExecutiveGeointTechnicalAnnexModel(context.institutionalReportInput, context.executiveModel, context.visualComposition, context.documentModel, {
    denueContextualSummary: audit ? { contextualUniverseCount: audit.denueAvailableCount, contextualDisplayedCount: audit.denueRenderedCount,
      selectionPolicy: audit.displayPolicy, methodology: "B.4/B.5 governed contextual cartography", limitations: audit.disclosures,
      sourceReferences: audit.sourceReferences, traceabilityIds: audit.traceabilityIds } : null });
  const annexWord = renderExecutiveGeointTechnicalAnnexWordDocument(context.annexModel, { visualAssetsById: f.assets });
  const reportBlob = await Packer.toBlob(word.document), annexBlob = await Packer.toBlob(annexWord.document);
  const pdf = async (kind: "EXECUTIVE_REPORT" | "TECHNICAL_ANNEX", blob: Blob, rendered: any, model: any) => renderInstitutionalPdfFromDocx(new Uint8Array(await blob.arrayBuffer()), {
    kind, projectId: "exp", numeroExpediente: project.numeroExpediente, documentModel: model, semanticIntegrity: context.documentModel.semanticIntegrity,
    requiredVisualIds: kind === "EXECUTIVE_REPORT" ? context.documentModel.semanticIntegrity.requiredVisualIds : institutionalAnnexRequiredVisualIds(context.annexModel, context.documentModel.semanticIntegrity.requiredVisualIds),
    renderedVisualIds: rendered.renderAudit.renderedVisualIds, missingVisualAssetIds: rendered.renderAudit.missingVisualAssetIds, state: "GENERATED", certified: false, published: false });
  const executivePdf = await pdf("EXECUTIVE_REPORT", reportBlob, word, context.documentModel), annexPdf = await pdf("TECHNICAL_ANNEX", annexBlob, annexWord, context.annexModel);
  context.lineage = await buildInstitutionalPackageLineage(authorized, context);
  const repository = new MemoryRepository(), storage = new MemoryStorage();
  const service = new InstitutionalReportPackageService(repository, storage, () => "2026-10-01T00:00:00.000Z", async () => authorized);
  const base = { projectId: "exp", numeroExpediente: project.numeroExpediente, generatedAt: context.generatedAt, generatedBy: authorized.actor,
    generationContext: context, reportBlob, annexBlob, pdfArtifacts: { executive: executivePdf.blob, annex: annexPdf.blob,
      parity: { status: "PASS" as const, sourceDocxHashes: [executivePdf.parity.sourceDocxSha256, annexPdf.parity.sourceDocxSha256] } } };
  return { ...f, context, authorized, project, repository, storage, service, base };
}
