import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import { createComputedFileIntegrity } from "../src/utils/forensicFileIntegrity";
import { formulateHumanHypothesis } from "../src/utils/hypothesisGovernance";
import { createAiAnalyticalOutput } from "../src/utils/aiAnalysisGovernance";
import {
  ADDITIONAL_PHOTO_EVIDENCE_TYPE,
  NON_GEOMETRIC_PHOTO_ROLE,
  adaptDocumentToAdditionalPhotoEvidence,
  buildInstitutionalProductExportPayload,
  mergeAdditionalPhotoEvidence,
} from "../src/utils/institutionalProductsUi";
import {
  assessReportItemEligibility,
  buildInstitutionalReportInput,
} from "../src/utils/institutionalReportPublicationContract";
import { PhotoEvidenceGovernanceEngine } from "../src/utils/photoEvidenceGovernanceEngine";
import { assessReportReadiness } from "../src/utils/reportReadyGovernance";

const projectContextPath = path.join(process.cwd(), "src", "context", "ProjectContext.tsx");
const projectContextSource = fs.readFileSync(projectContextPath, "utf8");

function loadRollbackHelper(): (params: {
  persistMetadata: () => Promise<unknown>;
  cleanupStorage: () => Promise<void>;
}) => Promise<unknown> {
  const sourceFile = ts.createSourceFile(projectContextPath, projectContextSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let match: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "persistPhotoMetadataWithStorageRollback") match = node;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!match) throw new Error("No se encontró persistPhotoMetadataWithStorageRollback");
  const compiled = ts.transpileModule(`export ${match.getText(sourceFile)}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} as Record<string, unknown> };
  new Function("module", "exports", compiled)(moduleRef, moduleRef.exports);
  return moduleRef.exports.persistPhotoMetadataWithStorageRollback as any;
}

const geography = buildCanonicalProjectGeography({
  projectId: "project-additional",
  type: "POLYGON",
  points: [
    { lat: 21.88, lng: -102.29 },
    { lat: 21.89, lng: -102.29 },
    { lat: 21.89, lng: -102.28 },
  ],
  now: 1,
});
const goodHash = "a".repeat(64);

function historicalDocument(id: string, status = "PENDING_REVIEW") {
  return {
    id,
    name: `${id}.jpg`,
    type: "image/jpeg",
    url: `https://storage.example/${id}.jpg`,
    context: "Fotografía adicional de contexto operativo.",
    createdAt: 10,
    multimodalEvidence: {
      evidenceId: `evidence-${id}`,
      expedienteId: "O46PhhhYzIohBJlNg7G3",
      documentId: id,
      fileName: `${id}.jpg`,
      mimeType: "image/jpeg",
      size: 100,
      storageReference: `projects/O46PhhhYzIohBJlNg7G3/documents/${id}.jpg`,
      ingestionSource: "USER_UPLOAD",
      geographyId: "geo-O46PhhhYzIohBJlNg7G3-polygon",
      ingestionStatus: "STORED_RAW",
      extractionStatus: "EXTRACTION_PENDING",
      analysisStatus: "NOT_ANALYZED",
      humanValidationStatus: status,
      rawContentReference: `projects/O46PhhhYzIohBJlNg7G3/documents/${id}.jpg`,
      forensicIntegrity: createComputedFileIntegrity({ rawSha256: goodHash, declaredMimeType: "image/jpeg" }),
    },
  };
}

function approvedAdditionalPhoto() {
  const evidenceId = "additional-approved";
  const lineage = buildEvidenceLineage({
    geographyId: geography.geographyId,
    sourceId: evidenceId,
    sourceReference: "projects/project-additional/documents/additional-approved.jpg",
    evidenceId,
  });
  return {
    id: "document-approved",
    sourceDocumentId: "document-approved",
    evidenceId,
    sourceEvidenceId: evidenceId,
    traceabilityId: "trace-additional-approved",
    expedienteId: "project-additional",
    projectId: "project-additional",
    geographyId: geography.geographyId,
    evidenceType: ADDITIONAL_PHOTO_EVIDENCE_TYPE,
    geometryRole: NON_GEOMETRIC_PHOTO_ROLE,
    isGeometry: false,
    lat: null,
    lng: null,
    coordinates: null,
    previewUrl: "https://storage.example/additional-approved.jpg",
    url: "https://storage.example/additional-approved.jpg",
    tipo: "Evidencia Fotográfica Adicional",
    comentario: "Contexto validado por una persona analista.",
    humanValidationStatus: "APPROVED",
    lineage,
    lineageStatus: "SUPPORTED",
    forensicIntegrity: createComputedFileIntegrity({ rawSha256: goodHash, declaredMimeType: "image/jpeg" }),
    multimodalEvidence: {
      evidenceId,
      expedienteId: "project-additional",
      mimeType: "image/jpeg",
      storageReference: "projects/project-additional/documents/additional-approved.jpg",
      humanValidationStatus: "APPROVED",
      forensicIntegrity: createComputedFileIntegrity({ rawSha256: goodHash, declaredMimeType: "image/jpeg" }),
    },
  };
}

function readyProject(additional: any) {
  const baseLineage = buildEvidenceLineage({
    geographyId: geography.geographyId,
    sourceId: "source-base",
    evidenceId: "evidence-base",
    findingId: "finding-base",
    analysisId: "analysis-base",
    conclusionId: "conclusion-base",
  });
  return {
    id: "project-additional",
    nombre: "Expediente adicional",
    numeroExpediente: "24092026-0048-DPU",
    canonicalGeography: geography,
    canonicalHypothesis: formulateHumanHypothesis({
      projectId: "project-additional",
      text: "Hipótesis humana validada.",
      geographyId: geography.geographyId,
      supportingEvidenceIds: ["evidence-base"],
      supportingFindingIds: ["finding-base"],
      lineage: baseLineage,
    }),
    evidence: [{
      evidenceId: "evidence-base",
      sourceEvidenceId: "source-base",
      traceabilityId: "trace-base",
      expedienteId: "project-additional",
      geographyId: geography.geographyId,
      lat: 21.885,
      lng: -102.285,
      coordinates: { lat: 21.885, lng: -102.285 },
      humanValidationStatus: "APPROVED",
      forensicIntegrity: createComputedFileIntegrity({ rawSha256: goodHash, declaredMimeType: "image/jpeg" }),
      lineage: baseLineage,
      lineageStatus: "SUPPORTED",
    }],
    findings: [{ findingId: "finding-base", usedInReport: true, humanValidationStatus: "APPROVED", lineage: baseLineage, lineageStatus: "SUPPORTED" }],
    analysisOutputs: [createAiAnalyticalOutput({
      outputId: "analysis-base",
      outputType: "ANALYSIS",
      evidenceIds: ["evidence-base"],
      findingIds: ["finding-base"],
      lineage: baseLineage,
      validationStatus: "APPROVED",
    })],
    conclusions: [{ conclusionId: "conclusion-base", humanValidationStatus: "APPROVED", lineage: baseLineage, lineageStatus: "SUPPORTED", analysisIds: ["analysis-base"] }],
    sources: [{ id: "source-base", sourceStatus: "AUTHORITATIVE" }],
    sweeps: [{ id: "sweep-base", lifecycleStatus: "CERTIFIED", outputEvidenceIds: ["evidence-base"], outputFindingIds: ["finding-base"] }],
    photoEvidence: [additional],
  };
}

describe("ADR-011 additional non-geometric photographic evidence", () => {
  test("historical 0048 documents are projected without mutation or duplication", () => {
    const ids = ["tNzBRcO9aEMZm3opLXYU", "i5EsvdiyLzrKvAQQS6o1"];
    const documents = ids.map((id) => historicalDocument(id));
    const before = JSON.stringify(documents);
    const merged = mergeAdditionalPhotoEvidence([], [...documents, documents[0]], {
      projectId: "O46PhhhYzIohBJlNg7G3",
      geographyId: "geo-O46PhhhYzIohBJlNg7G3-polygon",
      geographyType: "POLYGON",
    });

    expect(merged.map((item) => item.id)).toEqual(ids);
    expect(merged.every((item) => item.evidenceType === ADDITIONAL_PHOTO_EVIDENCE_TYPE)).toBe(true);
    expect(merged.every((item) => item.geometryRole === NON_GEOMETRIC_PHOTO_ROLE)).toBe(true);
    expect(merged.every((item) => item.lat === null && item.lng === null && item.coordinates === null)).toBe(true);
    expect(merged.map((item) => item.forensicIntegrity.rawSha256)).toEqual([goodHash, goodHash]);
    expect(JSON.stringify(documents)).toBe(before);
  });

  test.each(["INDIVIDUAL", "CORRIDOR", "POLYGON"])("%s keeps canonical geography unchanged", (geometryType) => {
    const canonical = { ...geography, type: geometryType };
    const before = JSON.stringify(canonical);
    const adapted = adaptDocumentToAdditionalPhotoEvidence(historicalDocument("geometry-invariant"), {
      projectId: "project-additional",
      geographyId: geography.geographyId,
      geographyType: geometryType,
    });
    expect(adapted).toMatchObject({ geometryRole: "NONE", isGeometry: false, lat: null, lng: null });
    expect(JSON.stringify(canonical)).toBe(before);
  });

  test("non-image documents remain documents and Street View/MAP_CAPTURE are preserved", () => {
    expect(adaptDocumentToAdditionalPhotoEvidence({ id: "pdf", type: "application/pdf" })).toBeNull();
    const existing = [
      { id: "street", evidenceType: "VIRTUAL_STREET_VIEW" },
      { id: "map", evidenceType: "MAP_CAPTURE" },
      { id: "field", evidenceType: "ANALYST_PHOTO" },
    ];
    expect(mergeAdditionalPhotoEvidence(existing, [])).toEqual(existing);
  });

  test("approved additional photo reaches institutional photoEvidence and ADR-011", () => {
    const additional = approvedAdditionalPhoto();
    const project = readyProject(additional);
    const payload = buildInstitutionalProductExportPayload(project, {
      reportReadyAssessment: assessReportReadiness(project),
      album: [],
      documents: [],
    });
    const input = buildInstitutionalReportInput(payload);
    expect(input.evidence.some((item) => item.evidenceId === additional.evidenceId)).toBe(true);
    const governed = PhotoEvidenceGovernanceEngine.process(input.evidence);
    expect(governed.primaryPhotos.some((item) => item.evidenceId === additional.evidenceId)).toBe(true);
  });

  test("pending additional photo is excluded from institutional publication", () => {
    const pending = {
      ...approvedAdditionalPhoto(),
      humanValidationStatus: "PENDING_REVIEW",
      multimodalEvidence: { ...approvedAdditionalPhoto().multimodalEvidence, humanValidationStatus: "PENDING_REVIEW" },
    };
    expect(assessReportItemEligibility(pending, { itemType: "EVIDENCE" })).toMatchObject({
      eligibility: "INELIGIBLE",
      exclusions: [{ reasonCode: "ADDITIONAL_PHOTO_HUMAN_REVIEW_REQUIRED" }],
    });
  });

  test("Firestore failure rolls Storage back and never reaches local album update", async () => {
    const helper = loadRollbackHelper();
    const cleanupStorage = jest.fn().mockResolvedValue(undefined);
    await expect(helper({
      persistMetadata: jest.fn().mockRejectedValue(new Error("Firestore unavailable")),
      cleanupStorage,
    })).rejects.toThrow("PHOTO_METADATA_PERSISTENCE_FAILED");
    expect(cleanupStorage).toHaveBeenCalledTimes(1);

    const persistenceCall = projectContextSource.indexOf("const photoDocRef = await persistPhotoMetadataWithStorageRollback");
    const localAlbumUpdate = projectContextSource.indexOf("addPhotoToAlbum({", persistenceCall);
    expect(persistenceCall).toBeGreaterThan(-1);
    expect(localAlbumUpdate).toBeGreaterThan(persistenceCall);
  });

  test("successful metadata persistence does not remove the Storage object", async () => {
    const helper = loadRollbackHelper();
    const cleanupStorage = jest.fn().mockResolvedValue(undefined);
    await expect(helper({
      persistMetadata: jest.fn().mockResolvedValue({ id: "firestore-document" }),
      cleanupStorage,
    })).resolves.toEqual({ id: "firestore-document" });
    expect(cleanupStorage).not.toHaveBeenCalled();
  });

  test("cleanup failure is explicit and the new image contract is wired to uploadDocument", async () => {
    const helper = loadRollbackHelper();
    await expect(helper({
      persistMetadata: jest.fn().mockRejectedValue(new Error("Firestore unavailable")),
      cleanupStorage: jest.fn().mockRejectedValue(new Error("Storage cleanup unavailable")),
    })).rejects.toThrow("PHOTO_METADATA_PERSISTENCE_FAILED_STORAGE_CLEANUP_FAILED");

    const uploadStart = projectContextSource.indexOf("const uploadDocument = useCallback");
    const uploadEnd = projectContextSource.indexOf("const saveCustomDocument", uploadStart);
    const uploadBlock = projectContextSource.slice(uploadStart, uploadEnd);
    expect(uploadBlock).toContain("isImageEvidenceMimeType(file.type)");
    expect(uploadBlock).toContain("evidenceType: ADDITIONAL_PHOTO_EVIDENCE_TYPE");
    expect(uploadBlock).toContain("geometryRole: NON_GEOMETRIC_PHOTO_ROLE");
    expect(uploadBlock).toContain("persistPhotoMetadataWithStorageRollback");
  });

  test("UI keeps additional evidence outside geometric groups and auto-selection", () => {
    const photoAlbum = fs.readFileSync(path.join(process.cwd(), "src", "components", "PhotoAlbum.tsx"), "utf8");
    expect(photoAlbum).toContain("Evidencias Fotográficas Adicionales");
    expect(photoAlbum).toContain("album.filter((photo) => !isAdditionalPhotoEvidence(photo))");
    expect(projectContextSource).toContain("governedAlbumPhotos.filter((photo) => !isAdditionalPhotoEvidence(photo))");
  });
});
