import fs from "node:fs";
import path from "node:path";
import {
  createStoredRawMultimodalEvidence,
  markAiAnalyzed,
  markExtracted,
  markHumanApproved,
  markReadyForHumanReview,
} from "../src/utils/multimodalEvidenceContract";

const mockQuery = jest.fn();

jest.mock("../src/lib/db", () => ({
  getPool: jest.fn(() => ({
    query: mockQuery,
  })),
}));

describe("ADR-020.22 - Multimodal evidence contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  test("TEST 1 local stored file without parser is STORED_RAW and not extracted", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "doc-1",
      expedienteId: "exp-1",
      documentId: "doc-1",
      fileName: "anexo.pdf",
      mimeType: "application/pdf",
      size: 100,
      storageReference: "projects/exp-1/documents/doc-1_anexo.pdf",
      ingestionSource: "USER_UPLOAD",
      analystContext: "Analizar en gabinete",
    });

    expect(evidence.ingestionStatus).toBe("STORED_RAW");
    expect(evidence.documentId).toBe("doc-1");
    expect(evidence.traceabilityId).toBeNull();
    expect(evidence.extractionStatus).toBe("EXTRACTION_PENDING");
    expect(evidence.analysisStatus).toBe("NOT_ANALYZED");
    expect(evidence.humanValidationStatus).toBe("PENDING_REVIEW");
    expect(evidence.contextSemantics).toEqual(["FILE_METADATA", "ANALYST_CONTEXT"]);
  });

  test("TEST 2 really extracted file is EXTRACTED and preserves raw reference", () => {
    const stored = createStoredRawMultimodalEvidence({
      evidenceId: "doc-2",
      expedienteId: "exp-1",
      fileName: "acta.txt",
      mimeType: "text/plain",
      storageReference: "raw/doc-2",
      ingestionSource: "USER_UPLOAD",
    });

    const extracted = markExtracted(stored, "derived/doc-2/extracted.txt");

    expect(extracted.extractionStatus).toBe("EXTRACTED");
    expect(extracted.rawContentReference).toBe("raw/doc-2");
    expect(extracted.extractedContentReference).toBe("derived/doc-2/extracted.txt");
  });

  test("TEST 3 AI analysis is AI_ANALYZED and not human approved", () => {
    const stored = createStoredRawMultimodalEvidence({
      evidenceId: "doc-3",
      expedienteId: "exp-1",
      fileName: "foto.jpg",
      mimeType: "image/jpeg",
      storageReference: "raw/doc-3",
      ingestionSource: "USER_UPLOAD",
    });

    const analyzed = markAiAnalyzed(markExtracted(stored, "derived/doc-3/ocr"), "derived/doc-3/analysis", 70);

    expect(analyzed.analysisStatus).toBe("AI_ANALYZED");
    expect(analyzed.humanValidationStatus).toBe("PENDING_REVIEW");
    expect(analyzed.derivedIntelligenceReference).toBe("derived/doc-3/analysis");
  });

  test("TEST 4 high AI score reaches READY_FOR_HUMAN_REVIEW but not human approval", () => {
    const stored = createStoredRawMultimodalEvidence({
      evidenceId: "doc-4",
      expedienteId: "exp-1",
      fileName: "audio.mp3",
      mimeType: "audio/mpeg",
      storageReference: "raw/doc-4",
      ingestionSource: "USER_UPLOAD",
    });

    const ready = markReadyForHumanReview(markAiAnalyzed(stored, "derived/doc-4/analysis", 95), 95);

    expect(ready.analysisStatus).toBe("READY_FOR_HUMAN_REVIEW");
    expect(ready.aiQualityScore).toBe(95);
    expect(ready.humanValidationStatus).toBe("PENDING_REVIEW");
  });

  test("TEST A documentId without upstream traceability does not fabricate traceabilityId", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "ev-doc-a",
      expedienteId: "exp-a",
      documentId: "document-a",
      fileName: "documento.pdf",
      mimeType: "application/pdf",
      storageReference: "projects/exp-a/documents/document-a_documento.pdf",
      ingestionSource: "USER_UPLOAD",
    });

    expect(evidence.documentId).toBe("document-a");
    expect(evidence.evidenceId).toBe("ev-doc-a");
    expect(evidence.traceabilityId).toBeNull();
    expect(evidence.traceabilityId).not.toBe(evidence.documentId);
    expect(evidence.traceabilityId).not.toBe(evidence.evidenceId);
  });

  test("TEST B Drive fileId and checksum without upstream traceability are not converted into traceabilityId", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "drive-file-b",
      expedienteId: "GOOGLE_DRIVE",
      fileId: "drive-file-b",
      checksum: "md5-checksum-b",
      fileName: "drive.pdf",
      mimeType: "application/pdf",
      storageReference: "drive://drive-file-b",
      ingestionSource: "GOOGLE_DRIVE",
    });

    expect(evidence.fileId).toBe("drive-file-b");
    expect(evidence.checksum).toBe("md5-checksum-b");
    expect(evidence.traceabilityId).toBeNull();
    expect(evidence.traceabilityId).not.toBe(evidence.fileId);
    expect(evidence.traceabilityId).not.toBe(evidence.checksum);
  });

  test("TEST C real upstream traceabilityId is preserved end-to-end", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "drive-file-c",
      expedienteId: "GOOGLE_DRIVE",
      fileId: "drive-file-c",
      checksum: "md5-checksum-c",
      fileName: "drive-trace.pdf",
      mimeType: "application/pdf",
      storageReference: "drive://drive-file-c",
      ingestionSource: "GOOGLE_DRIVE",
      traceabilityId: "trace-upstream-c",
    });

    const ready = markReadyForHumanReview(
      markAiAnalyzed(
        markExtracted(evidence, "drive_ingested_intelligence/drive-file-c/extracted_text"),
        "drive_ingested_intelligence/drive-file-c",
        91
      )
    );

    expect(ready.traceabilityId).toBe("trace-upstream-c");
    expect(ready.fileId).toBe("drive-file-c");
    expect(ready.checksum).toBe("md5-checksum-c");
  });

  test("TEST 5 Drive processed means technically processed and not approved automatically", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            file_id: "drive-1",
            file_name: "drive.pdf",
            logical_category: "Evidencia",
            extracted_text: "texto",
            entities: {},
            risk_level: "Medio",
            summary: "resumen",
            correlation_suggestions: [],
          },
        ],
      });
    const { DriveIngestionEngine } = await import("../src/modules/drive-ingestion/drive-ingestion.engine");

    const [item] = await DriveIngestionEngine.getIngestedIntelligence();

    expect(item.multimodalEvidence?.ingestionStatus).toBe("TECHNICALLY_PROCESSED");
    expect(item.multimodalEvidence?.analysisStatus).toBe("READY_FOR_HUMAN_REVIEW");
    expect(item.multimodalEvidence?.humanValidationStatus).toBe("PENDING_REVIEW");
    expect(item.multimodalEvidence?.fileId).toBe("drive-1");
    expect(item.multimodalEvidence?.traceabilityId).toBeNull();
  });

  test("TEST 6 metadata-only context is not EXTRACTED_CONTENT", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "doc-6",
      expedienteId: "exp-1",
      fileName: "tabla.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      storageReference: "raw/doc-6",
      ingestionSource: "USER_UPLOAD",
      analystContext: "Cruzar columnas",
    });

    expect(evidence.contextSemantics).toEqual(["FILE_METADATA", "ANALYST_CONTEXT"]);
    expect(evidence.contextSemantics).not.toContain("EXTRACTED_CONTENT");
    expect(evidence.extractionStatus).toBe("EXTRACTION_PENDING");
  });

  test("TEST E human approved evidence is explicitly APPROVED and timestamp is persisted in the contract", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "doc-7",
      expedienteId: "exp-1",
      fileName: "dictamen.txt",
      mimeType: "text/plain",
      storageReference: "raw/doc-7",
      ingestionSource: "USER_UPLOAD",
    });

    const approved = markHumanApproved(evidence, { validatedAt: "2026-08-29T12:00:00.000Z", validatedBy: null });

    expect(approved.humanValidationStatus).toBe("APPROVED");
    expect(approved.validatedAt).toBe("2026-08-29T12:00:00.000Z");
    expect(approved.validatedBy).toBeNull();
  });

  test("TEST F persisted APPROVED state is recoverable after reload/read", async () => {
    const approvedEvidence = markHumanApproved(
      markReadyForHumanReview(
        markAiAnalyzed(
          createStoredRawMultimodalEvidence({
            evidenceId: "drive-approved-f",
            expedienteId: "GOOGLE_DRIVE",
            fileId: "drive-approved-f",
            fileName: "approved.pdf",
            mimeType: "application/pdf",
            storageReference: "drive://drive-approved-f",
            ingestionSource: "GOOGLE_DRIVE",
          }),
          "drive_ingested_intelligence/drive-approved-f",
          97
        )
      ),
      { validatedAt: "2026-08-29T12:30:00.000Z", validatedBy: { id: "u-123", username: "validador_real" } }
    );

    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            file_id: "drive-approved-f",
            file_name: "approved.pdf",
            logical_category: "Evidencia",
            extracted_text: "texto",
            entities: {},
            risk_level: "Medio",
            summary: "resumen",
            correlation_suggestions: [],
            metadata: { multimodalEvidence: approvedEvidence },
          },
        ],
      });
    const { DriveIngestionEngine } = await import("../src/modules/drive-ingestion/drive-ingestion.engine");

    const [item] = await DriveIngestionEngine.getIngestedIntelligence();

    expect(item.multimodalEvidence?.humanValidationStatus).toBe("APPROVED");
    expect(item.multimodalEvidence?.validatedAt).toBe("2026-08-29T12:30:00.000Z");
    expect(item.multimodalEvidence?.validatedBy?.username).toBe("validador_real");
  });

  test("TEST G validator identity is preserved when real, and not fabricated when absent", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "doc-g",
      expedienteId: "exp-g",
      fileName: "dictamen-g.txt",
      mimeType: "text/plain",
      storageReference: "raw/doc-g",
      ingestionSource: "USER_UPLOAD",
    });

    const withIdentity = markHumanApproved(evidence, {
      validatedAt: "2026-08-29T13:00:00.000Z",
      validatedBy: { id: "real-user-g", username: "maria.validadora", name: "Maria Validadora" },
    });
    const withoutIdentity = markHumanApproved(evidence, {
      validatedAt: "2026-08-29T13:05:00.000Z",
      validatedBy: null,
    });

    expect(withIdentity.validatedBy).toEqual({
      id: "real-user-g",
      username: "maria.validadora",
      name: "Maria Validadora",
    });
    expect(withoutIdentity.validatedBy).toBeNull();
    expect(JSON.stringify(withoutIdentity)).not.toContain("admin");
    expect(JSON.stringify(withoutIdentity)).not.toContain("analyst");
    expect(JSON.stringify(withoutIdentity)).not.toContain("system");
    expect(JSON.stringify(withoutIdentity)).not.toContain("unknown-user");
  });

  test("TEST 8 raw file reference remains intact after analysis", () => {
    const stored = createStoredRawMultimodalEvidence({
      evidenceId: "doc-8",
      expedienteId: "exp-1",
      fileName: "video.mp4",
      mimeType: "video/mp4",
      storageReference: "raw/doc-8",
      ingestionSource: "USER_UPLOAD",
    });

    const analyzed = markReadyForHumanReview(markAiAnalyzed(stored, "derived/doc-8/analysis", 88), 88);

    expect(analyzed.rawContentReference).toBe(stored.rawContentReference);
    expect(analyzed.derivedIntelligenceReference).toBe("derived/doc-8/analysis");
  });

  test("TEST 9 unsupported format remains stored only or unsupported for extraction", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "doc-9",
      expedienteId: "exp-1",
      fileName: "archivo.bin",
      mimeType: "application/octet-stream",
      storageReference: "raw/doc-9",
      ingestionSource: "USER_UPLOAD",
    });

    expect(evidence.ingestionStatus).toBe("STORED_RAW");
    expect(evidence.extractionStatus).toBe("UNSUPPORTED_FOR_EXTRACTION");
    expect(evidence.analysisStatus).toBe("NOT_ANALYZED");
  });

  test("TEST 10 existing traceability is preserved", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "doc-10",
      expedienteId: "exp-1",
      fileName: "nota.txt",
      mimeType: "text/plain",
      storageReference: "raw/doc-10",
      ingestionSource: "GOOGLE_DRIVE",
      traceabilityId: "existing-trace",
    });

    expect(markAiAnalyzed(evidence, "derived/doc-10/analysis").traceabilityId).toBe("existing-trace");
  });

  test("PendingEvidenceEditor source does not auto-approve on AI score threshold", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoAlbum.tsx"), "utf8");

    expect(source).not.toMatch(/scVal\s*>=\s*80\)\s*setIsAudited\(true\)/);
    expect(source).toMatch(/setIsReadyForHumanReview\(true\)/);
    expect(source).toMatch(/markHumanApproved\(d\.multimodalEvidence/);
    expect(source).toMatch(/updateDoc\(doc\(firestore,\s*"projects",\s*projectId,\s*"documents",\s*d\.id\),\s*\{\s*multimodalEvidence: approvedEvidence/s);
  });
});
