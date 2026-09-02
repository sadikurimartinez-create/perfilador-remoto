import fs from "node:fs";
import path from "node:path";
import {
  computeSha256FromBytes,
  createComputedFileIntegrityFromBytes,
  createHashUnavailableIntegrity,
  createLegacyUnverifiedIntegrity,
  markDuplicateContent,
} from "../src/utils/forensicFileIntegrity";
import {
  createStoredRawMultimodalEvidence,
  markAiAnalyzed,
  markExtracted,
} from "../src/utils/multimodalEvidenceContract";

const mockAddDoc = jest.fn();
const mockCollection = jest.fn((_db, name) => ({ name }));
const mockLogAudit = jest.fn();

jest.mock("../src/lib/firebase", () => ({
  getDb: jest.fn(() => ({ mocked: true })),
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: jest.fn(),
  getDoc: jest.fn(),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));

jest.mock("../src/modules/pandillas/services/gangService", () => ({
  GangService: {
    logAudit: (...args: any[]) => mockLogAudit(...args),
  },
}));

const enc = new TextEncoder();

describe("ADR-020.23 - Forensic file integrity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: "evidence-id" });
  });

  test("TEST 1 same bytes produce same SHA-256", async () => {
    const a = await computeSha256FromBytes(enc.encode("same-content"));
    const b = await computeSha256FromBytes(enc.encode("same-content"));

    expect(a).toBe(b);
  });

  test("TEST 2 different bytes produce different SHA-256", async () => {
    const a = await computeSha256FromBytes(enc.encode("content-a"));
    const b = await computeSha256FromBytes(enc.encode("content-b"));

    expect(a).not.toBe(b);
  });

  test("TEST 3 real SHA-256 is valid 64-character hexadecimal", async () => {
    const hash = await computeSha256FromBytes(enc.encode("hex-format"));

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("TEST 4 no bytes available is HASH_UNAVAILABLE and has no fake hash", () => {
    const integrity = createHashUnavailableIntegrity();

    expect(integrity.hashStatus).toBe("HASH_UNAVAILABLE");
    expect(integrity.rawSha256).toBeNull();
    expect(JSON.stringify(integrity)).not.toContain("sha256-mock");
  });

  test("TEST 5 Pandillas evidence path does not create sha256-mock", async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/modules/pandillas/services/evidenceService.ts"),
      "utf8"
    );
    expect(source).not.toContain("sha256-mock");

    const { EvidenceService } = await import("../src/modules/pandillas/services/evidenceService");
    await EvidenceService.registerEvidence(
      {
        tipo: "grafiti",
        fuente: "Manual",
        confianza: "Baja",
        relacion: null,
      },
      "usuario_real"
    );

    const savedPayload = mockAddDoc.mock.calls[0][1];
    expect(savedPayload.hash).toBeNull();
    expect(savedPayload.forensicIntegrity.hashStatus).toBe("HASH_UNAVAILABLE");
    expect(JSON.stringify(savedPayload)).not.toContain("sha256-mock");
  });

  test("TEST 6 Drive md5Checksum is provider checksum and not SHA-256", () => {
    const integrity = createHashUnavailableIntegrity({
      providerChecksum: "d41d8cd98f00b204e9800998ecf8427e",
      providerChecksumAlgorithm: "MD5",
      fileId: "drive-file-1",
      declaredMimeType: "application/pdf",
      fileName: "drive.pdf",
    });

    expect(integrity.providerChecksum).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(integrity.providerChecksumAlgorithm).toBe("MD5");
    expect(integrity.rawSha256).toBeNull();
    expect(integrity.hashAlgorithm).toBeNull();
  });

  test("TEST 7 duplicate content is candidate only and does not merge evidence", async () => {
    const first = await createComputedFileIntegrityFromBytes({ bytes: enc.encode("duplicate") });
    const second = await createComputedFileIntegrityFromBytes({ bytes: enc.encode("duplicate") });
    const marked = markDuplicateContent(second, [first]);

    expect(marked.hashStatus).toBe("DUPLICATE_CONTENT");
    expect(marked.duplicateCandidate).toBe(true);
    expect(marked.duplicateOfSha256).toBe(first.rawSha256);
    expect(first).not.toBe(second);
  });

  test("TEST 8 raw hash remains stable after AI extraction and analysis", async () => {
    const forensicIntegrity = await createComputedFileIntegrityFromBytes({
      bytes: enc.encode("raw-original-file"),
      declaredMimeType: "text/plain",
      fileName: "raw.txt",
    });
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "ev-raw",
      expedienteId: "exp-raw",
      fileName: "raw.txt",
      mimeType: "text/plain",
      storageReference: "raw/ev-raw",
      ingestionSource: "USER_UPLOAD",
      forensicIntegrity,
    });
    const analyzed = markAiAnalyzed(markExtracted(evidence, "derived/ev-raw/text"), "derived/ev-raw/analysis", 92);

    expect(analyzed.forensicIntegrity?.rawSha256).toBe(forensicIntegrity.rawSha256);
    expect(analyzed.derivedIntelligenceReference).not.toBe(analyzed.rawContentReference);
  });

  test("TEST 9 unsupported or unverifiable MIME is MIME_UNVERIFIED", async () => {
    const integrity = await createComputedFileIntegrityFromBytes({
      bytes: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
      declaredMimeType: "application/octet-stream",
      fileName: "unknown.bin",
    });

    expect(integrity.mimeStatus).toBe("MIME_UNVERIFIED");
    expect(integrity.detectedMimeType).toBeNull();
  });

  test("TEST 10 legacy evidence is preserved without fabricated SHA-256", () => {
    const integrity = createLegacyUnverifiedIntegrity({
      fileId: "legacy-1",
      declaredMimeType: "image/jpeg",
      fileName: "legacy.jpg",
    });

    expect(integrity.hashStatus).toBe("LEGACY_UNVERIFIED");
    expect(integrity.rawSha256).toBeNull();
    expect(integrity.fileId).toBe("legacy-1");
    expect(JSON.stringify(integrity)).not.toContain("sha256-mock");
  });
});
