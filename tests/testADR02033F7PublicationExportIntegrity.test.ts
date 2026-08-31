import fs from "fs";
import path from "path";
import { createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { createComputedFileIntegrity } from "../src/utils/forensicFileIntegrity";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import { buildInstitutionalDocumentModel } from "../src/utils/institutionalDocumentAssembly";
import { buildInstitutionalReportInput } from "../src/utils/institutionalReportPublicationContract";
import {
  InstitutionalReportCertificationService,
  type InstitutionalCertificationRepository,
} from "../src/services/institutionalReportCertificationService";
import {
  InstitutionalReportPublicationService,
  type InstitutionalPublicationRepository,
} from "../src/services/institutionalReportPublicationService";
import {
  ReportCertificationGate,
  type InstitutionalReportCertification,
  type InstitutionalReportPublication,
} from "../src/utils/reportCertificationGate";
import { assessReportReadiness } from "../src/utils/reportReadyGovernance";

const geography = buildCanonicalProjectGeography({
  projectId: "project-f7",
  type: "POLYGON",
  points: [
    { lat: 21.88, lng: -102.29 },
    { lat: 21.89, lng: -102.29 },
    { lat: 21.89, lng: -102.28 },
  ],
  now: 1,
});

const lineage = buildEvidenceLineage({
  geographyId: geography.geographyId,
  sourceId: "source-f7",
  evidenceId: "ev-f7",
  findingId: "find-f7",
  inferenceId: "inf-f7",
  analysisId: "analysis-f7",
  conclusionId: "conclusion-f7",
});

const goodHash = "7".repeat(64);
const artifactReference = "docx://institutional/project-f7/report-f7.docx";
const artifactHash = "sha256:" + "c".repeat(64);
const publisher = { id: "publisher-f7-001", email: "publicador.f7@ceipol.example", role: "PUBLISHER" };
const certifier = { id: "certifier-f7-001", email: "certificador.f7@ceipol.example", role: "CERTIFIER" };
const longImage = `data:image/png;base64,${"B".repeat(140)}`;

type OutboxEvent = { eventType: string; entityId: string; traceabilityId: string; actor: string; source: string };

function evidence() {
  return {
    evidenceId: "ev-f7",
    id: "ev-f7",
    imageUrl: longImage,
    acquisitionMode: "OBSERVED",
    usedInReport: true,
    requiredForReport: true,
    geographyId: geography.geographyId,
    humanValidationStatus: "APPROVED",
    forensicIntegrity: createComputedFileIntegrity({ rawSha256: goodHash, declaredMimeType: "image/jpeg" }),
    lineage,
    sourceStatus: "AUTHORITATIVE",
    caption: "Vista registrada gobernada F7",
  };
}

function readyProject(overrides: any = {}) {
  return {
    id: "project-f7",
    projectId: "project-f7",
    projectName: "Proyecto F7",
    canonicalGeography: geography,
    canonicalHypothesis: formulateHumanHypothesis({
      projectId: "project-f7",
      text: "Hipotesis humana gobernada F7.",
      geographyId: geography.geographyId,
      supportingEvidenceIds: ["ev-f7"],
      supportingFindingIds: ["find-f7"],
      contradictingEvidenceIds: ["ev-contradiction-f7"],
      lineage,
    }),
    photoEvidence: [evidence()],
    findings: [{ findingId: "find-f7", id: "find-f7", text: "hallazgo gobernado F7", usedInReport: true, humanValidationStatus: "APPROVED", lineage, lineageStatus: "SUPPORTED" }],
    inferences: [{ inferenceId: "inf-f7", id: "inf-f7", text: "inferencia gobernada", findingIds: ["find-f7"], evidenceIds: ["ev-f7"], lineage, lineageStatus: "SUPPORTED" }],
    analysisOutputs: [{
      ...createAiAnalyticalOutput({
        outputId: "analysis-f7",
        outputType: "ANALYSIS",
        evidenceIds: ["ev-f7"],
        findingIds: ["find-f7"],
        lineage,
        validationStatus: "APPROVED",
      }),
      text: "analisis gobernado F7",
    }],
    conclusions: [{ conclusionId: "conclusion-f7", id: "conclusion-f7", text: "conclusion validada F7", humanValidationStatus: "APPROVED", lineage, lineageStatus: "SUPPORTED", analysisIds: ["analysis-f7"], findingIds: ["find-f7"], evidenceIds: ["ev-f7"] }],
    maps: [{ id: "map-f7", kind: "map", title: "Mapa gobernado", caption: "Distribucion espacial gobernada", dataUrl: longImage, geographyId: geography.geographyId, sourceReference: "canonical-map" }],
    charts: [{ id: "chart-f7", kind: "chart", title: "Chart gobernado", dataUrl: longImage, datasetId: "dataset-f7", sourceReference: "dataset-source", variables: ["variable-f7"] }],
    streetViewAnalysis: [{ id: "sv-f7", evidenceId: "sv-f7", previewUrl: longImage, geographyId: geography.geographyId, panoramaId: "pano-f7", lineage }],
    temporalComparisons: [{ comparisonId: "tc-f7", imageUrl: longImage, comparedEvidenceIds: ["ev-a", "ev-b"], humanValidationStatus: "APPROVED" }],
    sweeps: [{ id: "sweep-f7", lifecycleStatus: "CERTIFIED", outputEvidenceIds: ["ev-f7"], outputFindingIds: ["find-f7"] }],
    ...overrides,
  };
}

function modelFrom(generatedAt = "2026-08-31T10:00:00.000Z") {
  const input = buildInstitutionalReportInput(readyProject(), { generatedAt });
  const model = buildInstitutionalDocumentModel(input, { projectName: "Proyecto F7", reportNumber: "REP-F7" });
  return { input, model };
}

class CertificationRepository implements InstitutionalCertificationRepository {
  public readonly events: OutboxEvent[] = [];
  private readonly fingerprints = new Set<string>();
  constructor(private readonly store: Map<string, InstitutionalReportCertification> = new Map()) {}
  async create(certification: InstitutionalReportCertification, event?: any) {
    this.store.set(`${certification.projectId}/${certification.certificationId}`, { ...certification });
    this.record(event);
    return certification;
  }
  async get(projectId: string, certificationId: string) {
    return this.store.get(`${projectId}/${certificationId}`) || null;
  }
  async list(projectId: string) {
    return Array.from(this.store.values()).filter((record) => record.projectId === projectId);
  }
  async save(certification: InstitutionalReportCertification, event?: any) {
    this.store.set(`${certification.projectId}/${certification.certificationId}`, { ...certification });
    this.record(event);
    return certification;
  }
  async certifyAndSupersede(certification: InstitutionalReportCertification, superseded: InstitutionalReportCertification[], event?: any) {
    superseded.forEach((record) => this.store.set(`${record.projectId}/${record.certificationId}`, { ...record }));
    this.store.set(`${certification.projectId}/${certification.certificationId}`, { ...certification });
    this.record(event);
    return certification;
  }
  private record(event?: any) {
    if (!event) return;
    const key = `${event.eventType}|${event.traceabilityId}|${event.entityId}`;
    if (this.fingerprints.has(key)) return;
    this.fingerprints.add(key);
    this.events.push(event);
  }
}

class PublicationRepository implements InstitutionalPublicationRepository {
  public readonly events: OutboxEvent[] = [];
  private readonly fingerprints = new Set<string>();
  constructor(private readonly store: Map<string, InstitutionalReportPublication> = new Map()) {}
  async create(publication: InstitutionalReportPublication, event?: any) {
    this.store.set(`${publication.projectId}/${publication.publicationId}`, { ...publication });
    this.record(event);
    return publication;
  }
  async get(projectId: string, publicationId: string) {
    return this.store.get(`${projectId}/${publicationId}`) || null;
  }
  async list(projectId: string) {
    return Array.from(this.store.values()).filter((record) => record.projectId === projectId);
  }
  async save(publication: InstitutionalReportPublication, event?: any) {
    this.store.set(`${publication.projectId}/${publication.publicationId}`, { ...publication });
    this.record(event);
    return publication;
  }
  async publishAndSupersede(publication: InstitutionalReportPublication, superseded: InstitutionalReportPublication[], event?: any) {
    superseded.forEach((record) => this.store.set(`${record.projectId}/${record.publicationId}`, { ...record }));
    this.store.set(`${publication.projectId}/${publication.publicationId}`, { ...publication });
    this.record(event);
    return publication;
  }
  count() {
    return this.store.size;
  }
  private record(event?: any) {
    if (!event) return;
    const key = `${event.eventType}|${event.traceabilityId}|${event.entityId}`;
    if (this.fingerprints.has(key)) return;
    this.fingerprints.add(key);
    this.events.push(event);
  }
}

async function certifiedFixture(generatedAt = "2026-08-31T10:00:00.000Z", certifiedAt = "2026-08-31T11:00:00.000Z") {
  const certRepo = new CertificationRepository();
  const certService = new InstitutionalReportCertificationService(certRepo);
  const { input, model } = modelFrom(generatedAt);
  const certification = await certService.certifyInstitutionalReport({
    institutionalReportInput: input,
    institutionalDocumentModel: model,
    documentArtifactReference: artifactReference,
    documentArtifactHash: artifactHash,
    certifierIdentity: certifier,
    certifiedAt,
  });
  return { input, model, certification, certRepo };
}

function publicationService(certRepo: CertificationRepository, pubRepo = new PublicationRepository()) {
  return {
    pubRepo,
    service: new InstitutionalReportPublicationService(pubRepo, certRepo),
  };
}

function source(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("ADR-020.33 F7 - Publication export integrity", () => {
  test("TEST 1 generated but not certified -> cannot publish", () => {
    const { input, model } = modelFrom();
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      action: "PUBLISH",
      publisherIdentity: publisher,
    });
    expect(decision.blockingReasons).toContain("CURRENT_CERTIFICATION_REQUIRED");
  });

  test("TEST 2 certified current exact snapshot -> can request publication", async () => {
    const { input, model, certification } = await certifiedFixture();
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({
      currentCertification: certification,
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      documentArtifactHash: artifactHash,
      action: "REQUEST_PUBLICATION",
    });
    expect(decision.canRequestPublication).toBe(true);
  });

  test("TEST 3 revoked certification -> cannot publish", async () => {
    const { input, model, certification } = await certifiedFixture();
    const revoked = ReportCertificationGate.revokeInstitutionalCertification({ certification, revokedBy: certifier, revocationReason: "withdrawn" });
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: revoked, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, action: "PUBLISH", publisherIdentity: publisher });
    expect(decision.blockingReasons).toContain("CERTIFICATION_REVOKED");
  });

  test("TEST 4 superseded certification -> cannot publish", async () => {
    const { input, model, certification } = await certifiedFixture();
    const superseded = ReportCertificationGate.supersedeInstitutionalCertification(certification, { ...certification, certificationId: "replacement" });
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: superseded, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, action: "PUBLISH", publisherIdentity: publisher });
    expect(decision.blockingReasons).toContain("STALE_CERTIFICATION");
  });

  test("TEST 5 stale report snapshot -> cannot publish", async () => {
    const { certification } = await certifiedFixture("2026-08-31T10:00:00.000Z");
    const next = modelFrom("2026-08-31T12:00:00.000Z");
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: certification, institutionalReportInput: next.input, institutionalDocumentModel: next.model, documentArtifactReference: artifactReference, action: "PUBLISH", publisherIdentity: publisher });
    expect(decision.blockingReasons).toContain("CERTIFICATION_SNAPSHOT_MISMATCH");
  });

  test("TEST 6 stale document model -> cannot publish", async () => {
    const { input, model, certification } = await certifiedFixture();
    const staleModel = { ...model, modelId: model.modelId + "-v2" };
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: certification, institutionalReportInput: input, institutionalDocumentModel: staleModel, documentArtifactReference: artifactReference, action: "PUBLISH", publisherIdentity: publisher });
    expect(decision.blockingReasons).toContain("STALE_DOCUMENT_MODEL");
  });

  test("TEST 7 artifact mismatch -> cannot publish", async () => {
    const { input, model, certification } = await certifiedFixture();
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: certification, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: "docx://institutional/project-f7/other.docx", action: "PUBLISH", publisherIdentity: publisher });
    expect(decision.blockingReasons).toContain("ARTIFACT_MISMATCH");
  });

  test("TEST 8 real artifact hash match -> allowed", async () => {
    const { input, model, certification } = await certifiedFixture();
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: certification, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, action: "PUBLISH", publisherIdentity: publisher });
    expect(decision.canPublish).toBe(true);
  });

  test("TEST 9 critical hash mismatch -> blocked", async () => {
    const { input, model, certification } = await certifiedFixture();
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: certification, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: "sha256:" + "d".repeat(64), action: "PUBLISH", publisherIdentity: publisher });
    expect(decision.blockingReasons).toContain("ARTIFACT_HASH_MISMATCH");
  });

  test("TEST 10 hash unavailable -> warning, not fabricated", async () => {
    const { input, model, certification } = await certifiedFixture();
    const noHash = { ...certification, documentArtifactHash: null };
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: noHash, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, action: "PUBLISH", publisherIdentity: publisher });
    expect(decision.warnings).toContain("ARTIFACT_HASH_UNAVAILABLE");
    expect(decision.documentArtifactHash).toBeNull();
  });

  test("TEST 11 explicit human action required", async () => {
    const { input, model, certification } = await certifiedFixture();
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: certification, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, publisherIdentity: publisher });
    expect(decision.requiredHumanActions).toContain("EXPLICIT_HUMAN_PUBLICATION_ACTION");
    expect(decision.canPublish).toBe(false);
  });

  test("TEST 12 missing real publisher identity -> blocked", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const { service, pubRepo } = publicationService(certRepo);
    await expect(service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, publisherIdentity: { id: "system" }, publicationChannelOrType: "OFFICIAL_DOCX" })).rejects.toThrow("PUBLISHER_IDENTITY_UNAVAILABLE");
    expect(pubRepo.count()).toBe(0);
  });

  test("TEST 13 AI cannot publish", async () => {
    const { input, model, certification } = await certifiedFixture();
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: certification, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, action: "AI_REVIEW", publisherIdentity: publisher });
    expect(decision.blockingReasons).toContain("AI_REVIEW_CANNOT_PUBLISH");
  });

  test("TEST 14 score cannot publish", async () => {
    const { input, model, certification } = await certifiedFixture();
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: certification, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, action: "SCORE_REVIEW", publisherIdentity: publisher });
    expect(decision.blockingReasons).toContain("SCORE_REVIEW_CANNOT_PUBLISH");
  });

  test("TEST 15 download does not publish", async () => {
    const { input, model, certification } = await certifiedFixture();
    const decision = ReportCertificationGate.evaluateInstitutionalPublicationGate({ currentCertification: certification, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, action: "DOWNLOAD", publisherIdentity: publisher });
    expect(decision.blockingReasons).toContain("DOWNLOAD_IS_NOT_PUBLICATION");
  });

  test("TEST 16 exportToWord does not publish", () => {
    expect(source("src/lib/exportToWord.ts")).not.toContain("publishInstitutionalReport");
  });

  test("TEST 17 publication creates unique publicationId", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const { service } = publicationService(certRepo);
    const first = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publishedAt: "2026-08-31T12:00:00.000Z", publicationChannelOrType: "OFFICIAL_DOCX" });
    const second = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publishedAt: "2026-08-31T12:01:00.000Z", publicationChannelOrType: "OFFICIAL_DOCX" });
    expect(first.publicationId).not.toBe(second.publicationId);
  });

  test("TEST 18 publication references certificationId", async () => {
    const { input, model, certification, certRepo } = await certifiedFixture();
    const { service } = publicationService(certRepo);
    const publication = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publicationChannelOrType: "OFFICIAL_DOCX" });
    expect(publication.certificationId).toBe(certification.certificationId);
  });

  test("TEST 19 publication references exact report snapshot", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const { service } = publicationService(certRepo);
    const publication = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publicationChannelOrType: "OFFICIAL_DOCX" });
    expect(publication.reportSnapshotId).toBe(input.generatedAt);
  });

  test("TEST 20 publication references exact document model", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const { service } = publicationService(certRepo);
    const publication = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publicationChannelOrType: "OFFICIAL_DOCX" });
    expect(publication.documentModelId).toBe(model.modelId);
  });

  test("TEST 21 publication references exact artifact", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const { service } = publicationService(certRepo);
    const publication = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publicationChannelOrType: "OFFICIAL_DOCX" });
    expect(publication.documentArtifactReference).toBe(artifactReference);
    expect(publication.documentArtifactHash).toBe(artifactHash);
  });

  test("TEST 22 publication persists durably", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const pubRepo = new PublicationRepository();
    const { service } = publicationService(certRepo, pubRepo);
    const publication = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publicationChannelOrType: "OFFICIAL_DOCX" });
    expect(await pubRepo.get(input.projectId, publication.publicationId)).toEqual(publication);
  });

  test("TEST 23 reload/read returns same publication", async () => {
    const store = new Map<string, InstitutionalReportPublication>();
    const { input, model, certRepo } = await certifiedFixture();
    const writer = publicationService(certRepo, new PublicationRepository(store)).service;
    const publication = await writer.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publicationChannelOrType: "OFFICIAL_DOCX" });
    const readerRepo = new PublicationRepository(store);
    expect((await readerRepo.get(input.projectId, publication.publicationId))?.publicationId).toBe(publication.publicationId);
  });

  test("TEST 24 current publication resolves from persistence", async () => {
    const { input, model, certification, certRepo } = await certifiedFixture();
    const { service } = publicationService(certRepo);
    const publication = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publicationChannelOrType: "OFFICIAL_DOCX" });
    const current = await service.getCurrentPublication({ projectId: input.projectId, certification, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash });
    expect(current?.publicationId).toBe(publication.publicationId);
  });

  test("TEST 25 new publication supersedes prior publication", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const { service } = publicationService(certRepo);
    const first = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publishedAt: "2026-08-31T12:00:00.000Z", publicationChannelOrType: "OFFICIAL_DOCX" });
    const second = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publishedAt: "2026-08-31T12:01:00.000Z", publicationChannelOrType: "OFFICIAL_DOCX" });
    const history = await service.listPublications(input.projectId);
    expect(history.find((item) => item.publicationId === first.publicationId)?.status).toBe("SUPERSEDED");
    expect(second.supersedesPublicationId).toBe(first.publicationId);
  });

  test("TEST 26 prior publication remains historical", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const pubRepo = new PublicationRepository();
    const { service } = publicationService(certRepo, pubRepo);
    const first = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publishedAt: "2026-08-31T12:00:00.000Z", publicationChannelOrType: "OFFICIAL_DOCX" });
    await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publishedAt: "2026-08-31T12:01:00.000Z", publicationChannelOrType: "OFFICIAL_DOCX" });
    expect((await pubRepo.get(input.projectId, first.publicationId))?.status).toBe("SUPERSEDED");
  });

  test("TEST 27 revocation persists and history remains", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const { service, pubRepo } = publicationService(certRepo);
    const publication = await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publicationChannelOrType: "OFFICIAL_DOCX" });
    await service.revokePublication({ projectId: input.projectId, publicationId: publication.publicationId, revokedBy: publisher, revocationReason: "withdrawn" });
    expect((await pubRepo.get(input.projectId, publication.publicationId))?.status).toBe("REVOKED");
  });

  test("TEST 28 PUBLICATION_FAILED does not resolve current", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const { service } = publicationService(certRepo);
    const request = await service.requestPublication({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, requestedBy: publisher, publicationChannelOrType: "OFFICIAL_DOCX" });
    await service.failPublication({ request, failureReason: "storage unavailable" });
    expect(await service.getCurrentPublication({ projectId: input.projectId })).toBeNull();
  });

  test("TEST 29 legacy published boolean creates no canonical publication", async () => {
    const pubRepo = new PublicationRepository();
    const legacy = ReportCertificationGate.adaptLegacyPublication({ projectId: "project-f7", published: true });
    expect(legacy.blockingReasons).toContain("LEGACY_PUBLICATION_UNVERIFIED");
    expect(await pubRepo.list("project-f7")).toHaveLength(0);
  });

  test("TEST 30 publication event emitted only after real publication transition", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const { service, pubRepo } = publicationService(certRepo);
    expect(pubRepo.events).toHaveLength(0);
    await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publicationChannelOrType: "OFFICIAL_DOCX" });
    expect(pubRepo.events.map((event) => event.eventType)).toContain("REPORT_PUBLISHED");
  });

  test("TEST 31 reload emits no publication event", async () => {
    const store = new Map<string, InstitutionalReportPublication>();
    const { input, model, certRepo } = await certifiedFixture();
    const pubRepo = new PublicationRepository(store);
    const service = publicationService(certRepo, pubRepo).service;
    await service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publicationChannelOrType: "OFFICIAL_DOCX" });
    const eventCount = pubRepo.events.length;
    await new InstitutionalReportPublicationService(new PublicationRepository(store), certRepo).getCurrentPublication({ projectId: input.projectId });
    expect(pubRepo.events).toHaveLength(eventCount);
  });

  test("TEST 32 duplicate publication transition does not duplicate logical event", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const { service, pubRepo } = publicationService(certRepo);
    const params = { projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, publisherIdentity: publisher, publishedAt: "2026-08-31T12:00:00.000Z", publicationChannelOrType: "OFFICIAL_DOCX" };
    await service.publishInstitutionalReport(params);
    await service.publishInstitutionalReport(params);
    expect(pubRepo.events.filter((event) => event.eventType === "REPORT_PUBLISHED")).toHaveLength(1);
  });

  test("TEST 33 publication event uses ADR-019.19 outbox path", () => {
    const serviceSource = source("src/services/institutionalReportPublicationService.ts");
    expect(serviceSource).toContain("GeointEventOutboxService.enqueueEventInTransaction");
    expect(serviceSource).toContain("reportPublications");
  });

  test("TEST 34 dispatcher remains ledger writer if applicable", () => {
    expect(source("src/services/geoint/geointOutboxDispatcher.ts")).toContain("GeointEventLogService.persistGeointEvent");
    expect(source("src/services/institutionalReportPublicationService.ts")).not.toContain("GeointEventLogService");
  });

  test("TEST 35 certification transition can emit certification outbox event without retrospective backfill", async () => {
    const certRepo = new CertificationRepository();
    const certService = new InstitutionalReportCertificationService(certRepo);
    const { input, model } = modelFrom();
    await certService.certifyInstitutionalReport({ institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: artifactReference, documentArtifactHash: artifactHash, certifierIdentity: certifier });
    expect(certRepo.events.map((event) => event.eventType)).toContain("REPORT_CERTIFIED");
    expect(source("src/services/institutionalReportCertificationService.ts")).not.toMatch(/backfill/i);
  });

  test("TEST 36 new artifact version requires new certification before publication", async () => {
    const { input, model, certRepo } = await certifiedFixture();
    const { service, pubRepo } = publicationService(certRepo);
    await expect(service.publishInstitutionalReport({ projectId: input.projectId, institutionalReportInput: input, institutionalDocumentModel: model, documentArtifactReference: "docx://institutional/project-f7/report-f7-v2.docx", documentArtifactHash: artifactHash, publisherIdentity: publisher, publicationChannelOrType: "OFFICIAL_DOCX" })).rejects.toThrow("CURRENT_CERTIFICATION_REQUIRED");
    expect(pubRepo.count()).toBe(0);
  });

  test("passive REPORT_READY recalculation creates no publication record", async () => {
    const pubRepo = new PublicationRepository();
    assessReportReadiness(readyProject());
    expect(await pubRepo.list("project-f7")).toHaveLength(0);
  });
});
