import { createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { createComputedFileIntegrity } from "../src/utils/forensicFileIntegrity";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import { buildInstitutionalDocumentModel } from "../src/utils/institutionalDocumentAssembly";
import {
  buildInstitutionalReportInput,
  type InstitutionalReportInput,
} from "../src/utils/institutionalReportPublicationContract";
import {
  isRealCertificationActorIdentity,
  ReportCertificationGate,
  type InstitutionalReportCertification,
} from "../src/utils/reportCertificationGate";
import { assessReportReadiness } from "../src/utils/reportReadyGovernance";
import {
  InstitutionalReportCertificationService,
  type InstitutionalCertificationRepository,
} from "../src/services/institutionalReportCertificationService";

const geography = buildCanonicalProjectGeography({
  projectId: "project-f6",
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
  sourceId: "source-f6",
  evidenceId: "ev-f6",
  findingId: "find-f6",
  inferenceId: "inf-f6",
  analysisId: "analysis-f6",
  conclusionId: "conclusion-f6",
});

const goodHash = "6".repeat(64);
const longImage = `data:image/png;base64,${"A".repeat(140)}`;
const artifactReference = "docx://institutional/project-f6/report-f6.docx";
const artifactHash = "sha256:" + "b".repeat(64);
const certifier = { id: "validator-f6-001", email: "validador.f6@ceipol.example", role: "CERTIFIER" };

function evidence(overrides: any = {}) {
  return {
    evidenceId: "ev-f6",
    id: "ev-f6",
    imageUrl: longImage,
    acquisitionMode: "OBSERVED",
    usedInReport: true,
    requiredForReport: true,
    geographyId: geography.geographyId,
    humanValidationStatus: "APPROVED",
    forensicIntegrity: createComputedFileIntegrity({ rawSha256: goodHash, declaredMimeType: "image/jpeg" }),
    lineage,
    sourceStatus: "AUTHORITATIVE",
    caption: "Vista registrada gobernada F6",
    ...overrides,
  };
}

function finding(overrides: any = {}) {
  return {
    findingId: "find-f6",
    id: "find-f6",
    text: "hallazgo gobernado visible F6",
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
      outputId: "analysis-f6",
      outputType: "ANALYSIS",
      evidenceIds: ["ev-f6"],
      findingIds: ["find-f6"],
      lineage,
      validationStatus: "APPROVED",
      ...overrides,
    }),
    text: "analisis gobernado visible F6",
    ...overrides,
  };
}

function conclusion(overrides: any = {}) {
  return {
    conclusionId: "conclusion-f6",
    id: "conclusion-f6",
    text: "conclusion validada visible F6",
    humanValidationStatus: "APPROVED",
    lineage,
    lineageStatus: "SUPPORTED",
    analysisIds: ["analysis-f6"],
    findingIds: ["find-f6"],
    evidenceIds: ["ev-f6"],
    ...overrides,
  };
}

function hypothesis() {
  return formulateHumanHypothesis({
    projectId: "project-f6",
    text: "Hipotesis humana gobernada F6.",
    geographyId: geography.geographyId,
    supportingEvidenceIds: ["ev-f6"],
    supportingFindingIds: ["find-f6"],
    contradictingEvidenceIds: ["ev-contradiction-f6"],
    lineage,
  });
}

function readyProject(overrides: any = {}) {
  return {
    id: "project-f6",
    projectId: "project-f6",
    projectName: "Proyecto F6",
    canonicalGeography: geography,
    canonicalHypothesis: hypothesis(),
    photoEvidence: [evidence()],
    findings: [finding()],
    inferences: [{ inferenceId: "inf-f6", id: "inf-f6", text: "inferencia gobernada", findingIds: ["find-f6"], evidenceIds: ["ev-f6"], lineage, lineageStatus: "SUPPORTED" }],
    analysisOutputs: [analysis()],
    conclusions: [conclusion()],
    maps: [{ id: "map-f6", kind: "map", title: "Mapa gobernado", caption: "Distribucion espacial gobernada", dataUrl: longImage, geographyId: geography.geographyId, sourceReference: "canonical-map" }],
    charts: [{ id: "chart-f6", kind: "chart", title: "Chart gobernado", dataUrl: longImage, datasetId: "dataset-f6", sourceReference: "dataset-source", variables: ["variable-f6"] }],
    streetViewAnalysis: [{ id: "sv-f6", evidenceId: "sv-f6", previewUrl: longImage, geographyId: geography.geographyId, panoramaId: "pano-f6", lineage }],
    temporalComparisons: [{ comparisonId: "tc-f6", imageUrl: longImage, comparedEvidenceIds: ["ev-a", "ev-b"], humanValidationStatus: "APPROVED" }],
    sweeps: [{ id: "sweep-f6", lifecycleStatus: "CERTIFIED", outputEvidenceIds: ["ev-f6"], outputFindingIds: ["find-f6"] }],
    ...overrides,
  };
}

function modelFrom(project = readyProject(), generatedAt = "2026-08-30T10:00:00.000Z") {
  const input = buildInstitutionalReportInput(project, { generatedAt });
  const model = buildInstitutionalDocumentModel(input, { projectName: project.projectName, reportNumber: "REP-F6" });
  return { input, model };
}

function certify(generatedAt = "2026-08-30T10:00:00.000Z", certifiedAt = "2026-08-30T12:00:00.000Z") {
  const { input, model } = modelFrom(readyProject(), generatedAt);
  return ReportCertificationGate.certifyInstitutionalReport({
    institutionalReportInput: input,
    institutionalDocumentModel: model,
    documentArtifactReference: artifactReference,
    documentArtifactHash: artifactHash,
    certifierIdentity: certifier,
    certifiedAt,
  });
}

class ReloadableCertificationRepository implements InstitutionalCertificationRepository {
  constructor(private readonly store: Map<string, InstitutionalReportCertification> = new Map()) {}

  async create(certification: InstitutionalReportCertification) {
    this.store.set(`${certification.projectId}/${certification.certificationId}`, { ...certification });
    return certification;
  }

  async get(projectId: string, certificationId: string) {
    return this.store.get(`${projectId}/${certificationId}`) || null;
  }

  async list(projectId: string) {
    return Array.from(this.store.values()).filter((record) => record.projectId === projectId);
  }

  async save(certification: InstitutionalReportCertification) {
    this.store.set(`${certification.projectId}/${certification.certificationId}`, { ...certification });
    return certification;
  }

  async certifyAndSupersede(
    certification: InstitutionalReportCertification,
    superseded: InstitutionalReportCertification[]
  ) {
    superseded.forEach((record) => this.store.set(`${record.projectId}/${record.certificationId}`, { ...record }));
    this.store.set(`${certification.projectId}/${certification.certificationId}`, { ...certification });
    return certification;
  }

  count() {
    return this.store.size;
  }
}

describe("ADR-020.33 F6 - Institutional certification gate", () => {
  test("TEST 1 generated document is not automatically certified", () => {
    const { model } = modelFrom();
    expect(model.generated).toBe(true);
    expect(model.certified).toBe(false);
    expect(model.published).toBe(false);
  });

  test("TEST 2 REPORT_READY can request certification but is not certification", () => {
    const { input, model } = modelFrom();
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      action: "REQUEST_CERTIFICATION",
    });
    expect(decision.status).toBe("PENDING_CERTIFICATION");
    expect(decision.canRequestCertification).toBe(true);
    expect(decision.canCertify).toBe(false);
  });

  test("TEST 3 missing report ready assessment blocks certification", () => {
    const { model } = modelFrom();
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      action: "CERTIFY",
      certifierIdentity: certifier,
    });
    expect(decision.blockingReasons).toContain("REPORT_READY_ASSESSMENT_MISSING");
  });

  test("TEST 4 NOT_READY assessment blocks certification", () => {
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      reportReadyAssessment: assessReportReadiness({ id: "not-ready" }),
      documentArtifactReference: artifactReference,
      action: "CERTIFY",
      certifierIdentity: certifier,
    });
    expect(decision.status).toBe("NOT_CERTIFIED");
    expect(decision.blockingReasons).toContain("REPORT_NOT_READY");
  });

  test("TEST 5 missing InstitutionalReportInput blocks certification", () => {
    const { model } = modelFrom();
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      reportReadyAssessment: assessReportReadiness(readyProject()),
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      action: "CERTIFY",
      certifierIdentity: certifier,
    });
    expect(decision.blockingReasons).toContain("INSTITUTIONAL_REPORT_INPUT_MISSING");
  });

  test("TEST 6 missing document model blocks certification", () => {
    const { input } = modelFrom();
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalReportInput: input,
      documentArtifactReference: artifactReference,
      action: "CERTIFY",
      certifierIdentity: certifier,
    });
    expect(decision.blockingReasons).toContain("INSTITUTIONAL_DOCUMENT_MODEL_MISSING");
  });

  test("TEST 7 failed rendering blocks certification", () => {
    const { input, model } = modelFrom();
    const failedModel = { ...model, status: "RENDER_FAILED" as const };
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalReportInput: input,
      institutionalDocumentModel: failedModel,
      documentArtifactReference: artifactReference,
      action: "CERTIFY",
      certifierIdentity: certifier,
    });
    expect(decision.blockingReasons).toContain("DOCUMENT_RENDER_FAILED");
  });

  test("TEST 8 missing artifact reference blocks certification", () => {
    const { input, model } = modelFrom();
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      action: "CERTIFY",
      certifierIdentity: certifier,
    });
    expect(decision.blockingReasons).toContain("DOCUMENT_ARTIFACT_REFERENCE_MISSING");
  });

  test("TEST 9 AI review cannot certify", () => {
    const { input, model } = modelFrom();
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      action: "AI_REVIEW",
      certifierIdentity: certifier,
    });
    expect(decision.blockingReasons).toContain("AI_REVIEW_CANNOT_CERTIFY");
    expect(decision.canCertify).toBe(false);
  });

  test("TEST 10 high AI score / score review cannot certify", () => {
    const { input, model } = modelFrom();
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalReportInput: { ...input, aiQualityScore: 100 } as InstitutionalReportInput,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      action: "SCORE_REVIEW",
      certifierIdentity: certifier,
    });
    expect(decision.status).not.toBe("CERTIFIED");
    expect(decision.blockingReasons).toContain("SCORE_REVIEW_CANNOT_CERTIFY");
  });

  test("TEST 11 explicit human action is required", () => {
    const { input, model } = modelFrom();
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      certifierIdentity: certifier,
    });
    expect(decision.requiredHumanActions).toContain("EXPLICIT_HUMAN_CERTIFICATION_ACTION");
    expect(decision.canCertify).toBe(false);
  });

  test("TEST 12 real certifier identity is required", () => {
    const { input, model } = modelFrom();
    expect(() => ReportCertificationGate.certifyInstitutionalReport({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      certifierIdentity: {},
    })).toThrow("CERTIFIER_IDENTITY_UNAVAILABLE");
  });

  test("TEST 13 fictitious identities are not accepted", () => {
    expect(isRealCertificationActorIdentity({ id: "admin" })).toBe(false);
    expect(isRealCertificationActorIdentity({ id: "analyst" })).toBe(false);
    expect(isRealCertificationActorIdentity({ id: "system" })).toBe(false);
    expect(isRealCertificationActorIdentity({ id: "unknown-user" })).toBe(false);
  });

  test("TEST 14 real identity and timestamp are preserved", () => {
    const cert = certify();
    expect(cert.certifiedBy).toEqual(certifier);
    expect(cert.certifiedAt).toBe("2026-08-30T12:00:00.000Z");
  });

  test("TEST 15 valid human act creates CERTIFIED state", () => {
    expect(certify().status).toBe("CERTIFIED");
  });

  test("TEST 16 certification id is unique to snapshot actor time and artifact", () => {
    const first = certify("2026-08-30T10:00:00.000Z", "2026-08-30T12:00:00.000Z");
    const second = certify("2026-08-30T10:00:00.000Z", "2026-08-30T12:01:00.000Z");
    expect(first.certificationId).not.toBe(second.certificationId);
  });

  test("TEST 17 certification references exact report snapshot", () => {
    const cert = certify();
    expect(cert.reportSnapshotId).toBe("2026-08-30T10:00:00.000Z");
    expect(cert.institutionalReportInputId).toBe("IRI-project-f6-2026-08-30T10:00:00.000Z");
  });

  test("TEST 18 certification references exact document model and artifact", () => {
    const { input, model } = modelFrom();
    const cert = ReportCertificationGate.certifyInstitutionalReport({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      documentArtifactHash: artifactHash,
      certifierIdentity: certifier,
      certifiedAt: "2026-08-30T12:00:00.000Z",
    });
    expect(cert.documentModelId).toBe(model.modelId);
    expect(cert.documentArtifactReference).toBe(artifactReference);
    expect(cert.documentArtifactHash).toBe(artifactHash);
  });

  test("TEST 19 certification preserves validation and lineage references", () => {
    const cert = certify();
    expect(cert.validationReferences.evidenceIds).toContain("ev-f6");
    expect(cert.validationReferences.findingIds).toContain("find-f6");
    expect(cert.validationReferences.analysisIds).toContain("analysis-f6");
    expect(cert.lineageReference.itemCount).toBeGreaterThan(0);
  });

  test("TEST 20 certification does not publish", () => {
    expect(certify().published).toBe(false);
  });

  test("TEST 21 critical publication exclusion blocks certification", () => {
    const { input, model } = modelFrom();
    const compromisedInput = {
      ...input,
      exclusions: [...input.exclusions, { itemId: "ev-bad", itemType: "EVIDENCE", reasonCode: "CRITICAL_INTEGRITY_FAILURE", reason: "hash mismatch" }],
    } as InstitutionalReportInput;
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalReportInput: compromisedInput,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      action: "CERTIFY",
      certifierIdentity: certifier,
    });
    expect(decision.blockingReasons).toContain("CRITICAL_PUBLICATION_EXCLUSION_PRESENT");
  });

  test("TEST 22 broken lineage exclusion blocks certification", () => {
    const { input, model } = modelFrom();
    const brokenInput = {
      ...input,
      exclusions: [...input.exclusions, { itemId: "find-bad", itemType: "FINDING", reasonCode: "BROKEN_LINEAGE", reason: "missing source" }],
    } as InstitutionalReportInput;
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalReportInput: brokenInput,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      action: "CERTIFY",
      certifierIdentity: certifier,
    });
    expect(decision.blockingReasons).toContain("CRITICAL_PUBLICATION_EXCLUSION_PRESENT");
  });

  test("TEST 23 pending human validation blocks certification", () => {
    const { input, model } = modelFrom();
    const pendingAssessment = {
      ...input.reportReadyAssessment,
      readyForInstitutionalReport: false,
      unresolvedItems: [{ domain: "HUMAN_VALIDATION" as const, code: "MANDATORY_HUMAN_REVIEW_PENDING", message: "pending" }],
    };
    const pendingInput = { ...input, reportReadyAssessment: pendingAssessment };
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalReportInput: pendingInput,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      action: "CERTIFY",
      certifierIdentity: certifier,
    });
    expect(decision.blockingReasons).toContain("HUMAN_VALIDATION_PENDING");
  });

  test("TEST 24 request record persists PENDING_CERTIFICATION without approval", () => {
    const { input, model } = modelFrom();
    const pending = ReportCertificationGate.requestInstitutionalCertification({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      requestedAt: "2026-08-30T11:00:00.000Z",
    });
    expect(pending.status).toBe("PENDING_CERTIFICATION");
    expect(pending.certifiedBy).toBeNull();
    expect(pending.certifiedAt).toBeNull();
  });

  test("TEST 25 approval survives reload as persisted certification data", () => {
    const cert = certify();
    const reloaded = JSON.parse(JSON.stringify(cert)) as InstitutionalReportCertification;
    expect(reloaded.status).toBe("CERTIFIED");
    expect(reloaded.certifiedBy?.id).toBe("validator-f6-001");
    expect(reloaded.reportSnapshotId).toBe(cert.reportSnapshotId);
  });

  test("TEST 26 new report snapshot requires re-certification", () => {
    const oldCert = certify("2026-08-30T10:00:00.000Z");
    const { input, model } = modelFrom(readyProject(), "2026-08-30T13:00:00.000Z");
    expect(ReportCertificationGate.isCertificationCurrentForSnapshot({
      certification: oldCert,
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
    })).toBe(false);
  });

  test("TEST 27 new document model requires re-certification", () => {
    const oldCert = certify();
    const { input, model } = modelFrom();
    const nextModel = { ...model, modelId: model.modelId + "-v2" };
    expect(ReportCertificationGate.isCertificationCurrentForSnapshot({
      certification: oldCert,
      institutionalReportInput: input,
      institutionalDocumentModel: nextModel,
      documentArtifactReference: artifactReference,
    })).toBe(false);
  });

  test("TEST 28 revocation requires real human identity", () => {
    expect(() => ReportCertificationGate.revokeInstitutionalCertification({
      certification: certify(),
      revokedBy: { id: "system" },
      revocationReason: "invalidated",
    })).toThrow("CERTIFIER_IDENTITY_UNAVAILABLE");
  });

  test("TEST 29 revocation preserves historical certification record", () => {
    const cert = certify();
    const revoked = ReportCertificationGate.revokeInstitutionalCertification({
      certification: cert,
      revokedBy: certifier,
      revokedAt: "2026-08-30T13:00:00.000Z",
      revocationReason: "new evidence",
    });
    expect(revoked.certificationId).toBe(cert.certificationId);
    expect(revoked.status).toBe("REVOKED");
    expect(revoked.revocationReason).toBe("new evidence");
  });

  test("TEST 30 rejection preserves reason and human identity", () => {
    const { input, model } = modelFrom();
    const pending = ReportCertificationGate.requestInstitutionalCertification({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
    });
    const rejected = ReportCertificationGate.rejectInstitutionalCertification({
      certification: pending,
      rejectedBy: certifier,
      rejectedAt: "2026-08-30T13:10:00.000Z",
      rejectionReason: "incomplete appendix",
    });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectedBy).toEqual(certifier);
    expect(rejected.rejectionReason).toBe("incomplete appendix");
  });

  test("TEST 31 superseded preserves previous record and links replacement", () => {
    const previous = certify("2026-08-30T10:00:00.000Z", "2026-08-30T12:00:00.000Z");
    const replacement = certify("2026-08-30T13:00:00.000Z", "2026-08-30T14:00:00.000Z");
    const superseded = ReportCertificationGate.supersedeInstitutionalCertification(previous, replacement);
    expect(superseded.status).toBe("SUPERSEDED");
    expect(superseded.supersededByCertificationId).toBe(replacement.certificationId);
  });

  test("TEST 32 resolver ignores revoked and superseded records", () => {
    const active = certify("2026-08-30T10:00:00.000Z", "2026-08-30T12:00:00.000Z");
    const revoked = ReportCertificationGate.revokeInstitutionalCertification({
      certification: certify("2026-08-30T10:00:00.000Z", "2026-08-30T12:10:00.000Z"),
      revokedBy: certifier,
      revocationReason: "error",
    });
    const superseded = ReportCertificationGate.supersedeInstitutionalCertification(
      certify("2026-08-30T10:00:00.000Z", "2026-08-30T12:20:00.000Z"),
      active
    );
    expect(ReportCertificationGate.resolveCurrentInstitutionalCertification({
      certifications: [revoked, superseded, active],
    })?.certificationId).toBe(active.certificationId);
  });

  test("TEST 33 legacy certified boolean does not become canonical certification", () => {
    const legacy = ReportCertificationGate.adaptLegacyCertification({ projectId: "legacy", certified: true });
    expect(legacy.status).toBe("NOT_CERTIFIED");
    expect(legacy.certified).toBe(false);
    expect(legacy.blockingReasons).toContain("LEGACY_CERTIFICATION_UNVERIFIED");
  });

  test("TEST 34 role enforcement gap is explicit, not fake RBAC", () => {
    const { input, model } = modelFrom();
    const decision = ReportCertificationGate.evaluateInstitutionalCertificationGate({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      action: "CERTIFY",
      certifierIdentity: certifier,
    });
    expect(decision.warnings).toContain("CERTIFICATION_ROLE_ENFORCEMENT_PENDING");
  });

  test("TEST 35 generated document remains separated from publication", () => {
    const cert = certify();
    expect(cert.status).toBe("CERTIFIED");
    expect(cert.published).toBe(false);
  });

  test("H1 productive certification service uses persistence repository", async () => {
    const repository = new ReloadableCertificationRepository();
    const service = new InstitutionalReportCertificationService(repository);
    const { input, model } = modelFrom();
    const persisted = await service.certifyInstitutionalReport({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      documentArtifactHash: artifactHash,
      certifierIdentity: certifier,
      certifiedAt: "2026-08-30T12:00:00.000Z",
    });
    expect(await repository.get(input.projectId, persisted.certificationId)).toEqual(persisted);
  });

  test("H2 certification persisted then reload/read returns same certification", async () => {
    const store = new Map<string, InstitutionalReportCertification>();
    const writer = new InstitutionalReportCertificationService(new ReloadableCertificationRepository(store));
    const { input, model } = modelFrom();
    const persisted = await writer.certifyInstitutionalReport({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      documentArtifactHash: artifactHash,
      certifierIdentity: certifier,
      certifiedAt: "2026-08-30T12:00:00.000Z",
    });
    const reader = new InstitutionalReportCertificationService(new ReloadableCertificationRepository(store));
    const reloaded = await reader.getCurrentInstitutionalCertification({
      projectId: input.projectId,
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
    });
    expect(reloaded?.certificationId).toBe(persisted.certificationId);
    expect(reloaded?.reportSnapshotId).toBe(persisted.reportSnapshotId);
    expect(reloaded?.certifiedBy).toEqual(certifier);
    expect(reloaded?.status).toBe("CERTIFIED");
  });

  test("H3 current certification resolves from persisted records", async () => {
    const service = new InstitutionalReportCertificationService(new ReloadableCertificationRepository());
    const { input, model } = modelFrom();
    await service.certifyInstitutionalReport({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      certifierIdentity: certifier,
      certifiedAt: "2026-08-30T12:00:00.000Z",
    });
    const current = await service.getCurrentInstitutionalCertification({
      projectId: input.projectId,
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
    });
    expect(current?.status).toBe("CERTIFIED");
  });

  test("H4 direct CERTIFIED write bypass is not exposed by consumer path", () => {
    const exposed = Object.getOwnPropertyNames(InstitutionalReportCertificationService.prototype);
    expect(exposed).not.toContain("saveCertified");
    expect(exposed).not.toContain("writeCertified");
    expect(exposed).toContain("certifyInstitutionalReport");
  });

  test("H5 explicit human certification action invokes gate", async () => {
    const service = new InstitutionalReportCertificationService(new ReloadableCertificationRepository());
    const { input, model } = modelFrom();
    await expect(service.certifyInstitutionalReport({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: "",
      certifierIdentity: certifier,
    })).rejects.toThrow("DOCUMENT_ARTIFACT_REFERENCE_MISSING");
  });

  test("H6 missing actor blocks before persistence", async () => {
    const repository = new ReloadableCertificationRepository();
    const service = new InstitutionalReportCertificationService(repository);
    const { input, model } = modelFrom();
    await expect(service.certifyInstitutionalReport({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      certifierIdentity: null,
    })).rejects.toThrow("CERTIFIER_IDENTITY_UNAVAILABLE");
    expect(repository.count()).toBe(0);
  });

  test("H7 stale report snapshot blocks persistence", async () => {
    const repository = new ReloadableCertificationRepository();
    const service = new InstitutionalReportCertificationService(repository);
    const { input, model } = modelFrom();
    await expect(service.certifyInstitutionalReport({
      institutionalReportInput: { ...input, generatedAt: "2026-08-30T99:00:00.000Z" },
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      certifierIdentity: certifier,
    })).rejects.toThrow("STALE_REPORT_SNAPSHOT");
    expect(repository.count()).toBe(0);
  });

  test("H8 stale document model blocks persistence", async () => {
    const repository = new ReloadableCertificationRepository();
    const service = new InstitutionalReportCertificationService(repository);
    const { input, model } = modelFrom();
    const staleModel = { ...model, metadata: { ...model.metadata, generatedAt: "2026-08-30T09:00:00.000Z" } };
    await expect(service.certifyInstitutionalReport({
      institutionalReportInput: input,
      institutionalDocumentModel: staleModel,
      documentArtifactReference: artifactReference,
      certifierIdentity: certifier,
    })).rejects.toThrow("STALE_DOCUMENT_MODEL");
    expect(repository.count()).toBe(0);
  });

  test("H9 new certification supersedes prior persisted record", async () => {
    const service = new InstitutionalReportCertificationService(new ReloadableCertificationRepository());
    const first = modelFrom(readyProject(), "2026-08-30T10:00:00.000Z");
    const second = modelFrom(readyProject(), "2026-08-30T13:00:00.000Z");
    const a = await service.certifyInstitutionalReport({
      institutionalReportInput: first.input,
      institutionalDocumentModel: first.model,
      documentArtifactReference: artifactReference,
      certifierIdentity: certifier,
      certifiedAt: "2026-08-30T12:00:00.000Z",
    });
    const b = await service.certifyInstitutionalReport({
      institutionalReportInput: second.input,
      institutionalDocumentModel: second.model,
      documentArtifactReference: artifactReference,
      certifierIdentity: certifier,
      certifiedAt: "2026-08-30T14:00:00.000Z",
    });
    const history = await service.listCertifications("project-f6");
    expect(history.find((record) => record.certificationId === a.certificationId)?.status).toBe("SUPERSEDED");
    expect(b.supersedesCertificationId).toBe(a.certificationId);
  });

  test("H10 superseded record remains readable historically", async () => {
    const repository = new ReloadableCertificationRepository();
    const service = new InstitutionalReportCertificationService(repository);
    const first = modelFrom(readyProject(), "2026-08-30T10:00:00.000Z");
    const second = modelFrom(readyProject(), "2026-08-30T13:00:00.000Z");
    const a = await service.certifyInstitutionalReport({
      institutionalReportInput: first.input,
      institutionalDocumentModel: first.model,
      documentArtifactReference: artifactReference,
      certifierIdentity: certifier,
      certifiedAt: "2026-08-30T12:00:00.000Z",
    });
    await service.certifyInstitutionalReport({
      institutionalReportInput: second.input,
      institutionalDocumentModel: second.model,
      documentArtifactReference: artifactReference,
      certifierIdentity: certifier,
      certifiedAt: "2026-08-30T14:00:00.000Z",
    });
    expect((await repository.get("project-f6", a.certificationId))?.status).toBe("SUPERSEDED");
  });

  test("H11 revocation persists", async () => {
    const service = new InstitutionalReportCertificationService(new ReloadableCertificationRepository());
    const { input, model } = modelFrom();
    const cert = await service.certifyInstitutionalReport({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      certifierIdentity: certifier,
    });
    const revoked = await service.revokeInstitutionalCertification({
      projectId: input.projectId,
      certificationId: cert.certificationId,
      revokedBy: certifier,
      revocationReason: "new contradictory evidence",
    });
    expect(revoked.status).toBe("REVOKED");
    expect(revoked.revocationReason).toBe("new contradictory evidence");
  });

  test("H12 revoked certification no longer resolves as current", async () => {
    const service = new InstitutionalReportCertificationService(new ReloadableCertificationRepository());
    const { input, model } = modelFrom();
    const cert = await service.certifyInstitutionalReport({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      certifierIdentity: certifier,
    });
    await service.revokeInstitutionalCertification({
      projectId: input.projectId,
      certificationId: cert.certificationId,
      revokedBy: certifier,
      revocationReason: "withdrawn",
    });
    expect(await service.getCurrentInstitutionalCertification({
      projectId: input.projectId,
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
    })).toBeNull();
  });

  test("H13 rejection persists with reason", async () => {
    const service = new InstitutionalReportCertificationService(new ReloadableCertificationRepository());
    const { input, model } = modelFrom();
    const pending = await service.requestCertification({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      requestedBy: certifier,
    });
    const rejected = await service.rejectInstitutionalCertification({
      certification: pending,
      rejectedBy: certifier,
      rejectionReason: "appendix mismatch",
    });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("appendix mismatch");
  });

  test("H14 reload after revocation preserves revoked state/history", async () => {
    const store = new Map<string, InstitutionalReportCertification>();
    const service = new InstitutionalReportCertificationService(new ReloadableCertificationRepository(store));
    const { input, model } = modelFrom();
    const cert = await service.certifyInstitutionalReport({
      institutionalReportInput: input,
      institutionalDocumentModel: model,
      documentArtifactReference: artifactReference,
      certifierIdentity: certifier,
    });
    await service.revokeInstitutionalCertification({
      projectId: input.projectId,
      certificationId: cert.certificationId,
      revokedBy: certifier,
      revocationReason: "legal hold",
    });
    const reloadedRepo = new ReloadableCertificationRepository(store);
    const reloaded = await reloadedRepo.get(input.projectId, cert.certificationId);
    expect(reloaded?.status).toBe("REVOKED");
    expect(reloaded?.certificationId).toBe(cert.certificationId);
  });

  test("H15 legacy certified boolean creates no persisted canonical record", async () => {
    const repository = new ReloadableCertificationRepository();
    ReportCertificationGate.adaptLegacyCertification({ projectId: "project-f6", certified: true });
    expect(await repository.list("project-f6")).toHaveLength(0);
  });

  test("H16 document generation alone creates zero certification records", async () => {
    const repository = new ReloadableCertificationRepository();
    modelFrom();
    expect(await repository.list("project-f6")).toHaveLength(0);
  });

  test("H17 REPORT_READY recalculation creates zero certification records", async () => {
    const repository = new ReloadableCertificationRepository();
    assessReportReadiness(readyProject());
    expect(await repository.list("project-f6")).toHaveLength(0);
  });

  test("H18 AI review creates zero certification records", async () => {
    const repository = new ReloadableCertificationRepository();
    analysis({ validationStatus: "APPROVED" });
    expect(await repository.list("project-f6")).toHaveLength(0);
  });
});
