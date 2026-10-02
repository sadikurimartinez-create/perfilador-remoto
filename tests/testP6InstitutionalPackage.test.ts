import { preP7Fixture } from "./helpers/preP7InstitutionalFixture";
import fs from "fs";
import path from "path";
jest.mock("@/lib/institutionalReportSourceActions", () => ({ getAuthorizedInstitutionalReportSource: jest.fn() }));
import {
  buildInstitutionalSnapshotHash,
  sha256Blob,
  isCompleteInstitutionalReportPackage,
  getReportPackageErrorDiagnostic,
  InstitutionalReportPackageService,
  toExactArrayBuffer,
  type InstitutionalReportPackageArtifact,
  type InstitutionalReportPackageManifest,
  type InstitutionalReportPackageRepository,
  type InstitutionalReportPackageStorage,
} from "../src/services/institutionalReportPackageService";

class MemoryRepository implements InstitutionalReportPackageRepository {
  readonly records = new Map<string, InstitutionalReportPackageManifest>();
  private readonly versions = new Map<string, number>();
  failReserve = false;
  failMarkGenerated = false;
  failMarkFailed = false;

  async reserve(projectId: string, packageId: string, createManifest: (version: number) => InstitutionalReportPackageManifest) {
    if (this.failReserve) throw new Error("RESERVE_TEST_FAILURE");
    const key = `${projectId}/${packageId}`;
    const existing = this.records.get(key);
    if (existing) return existing;
    const version = (this.versions.get(projectId) || 0) + 1;
    this.versions.set(projectId, version);
    const manifest = createManifest(version);
    this.records.set(key, manifest);
    return manifest;
  }

  async get(projectId: string, packageId: string) {
    return this.records.get(`${projectId}/${packageId}`) || null;
  }

  async list(projectId: string) {
    return Array.from(this.records.values()).filter((item) => item.projectId === projectId).sort((a, b) => b.version - a.version);
  }

  async saveArtifact(projectId: string, packageId: string, key: "executiveReport" | "technicalAnnex" | "executivePdf" | "technicalAnnexPdf", artifact: InstitutionalReportPackageArtifact, updatedAt: string) {
    const manifest = await this.required(projectId, packageId);
    const saved = { ...manifest, artifacts: { ...manifest.artifacts, [key]: artifact }, updatedAt };
    this.records.set(`${projectId}/${packageId}`, saved);
    return saved;
  }

  async markGenerated(projectId: string, packageId: string, updatedAt: string) {
    if (this.failMarkGenerated) throw new Error("MARK_GENERATED_TEST_FAILURE");
    const manifest = await this.required(projectId, packageId);
    if (manifest.artifacts.executiveReport.state !== "STORED" || manifest.artifacts.technicalAnnex.state !== "STORED") {
      throw new Error("REPORT_PACKAGE_INCOMPLETE");
    }
    const saved = { ...manifest, state: "GENERATED" as const, updatedAt, failureReason: null };
    this.records.set(`${projectId}/${packageId}`, saved);
    return saved;
  }

  async markFailed(projectId: string, packageId: string, reason: string, updatedAt: string) {
    if (this.failMarkFailed) throw new Error("MARK_FAILED_TEST_FAILURE");
    const manifest = await this.required(projectId, packageId);
    const saved = { ...manifest, state: "FAILED" as const, failureReason: reason, updatedAt };
    this.records.set(`${projectId}/${packageId}`, saved);
    return saved;
  }

  private async required(projectId: string, packageId: string) {
    const manifest = await this.get(projectId, packageId);
    if (!manifest) throw new Error("REPORT_PACKAGE_NOT_FOUND");
    return manifest;
  }
}

class MemoryStorage implements InstitutionalReportPackageStorage {
  readonly objects = new Map<string, { blob: Blob; sha256: string }>();
  readonly writes: string[] = [];
  failAnnex = false;
  failExecutive = false;

  async storeImmutable(pathValue: string, blob: Blob, metadata: { sha256: string }) {
    if (this.failExecutive && pathValue.includes("_INFORME_")) throw new Error("REPORT_STORAGE_FAILED");
    if (this.failAnnex && pathValue.includes("ANEXO_TECNICO")) throw new Error("ANNEX_STORAGE_FAILED");
    const existing = this.objects.get(pathValue);
    if (existing && existing.sha256 !== metadata.sha256) throw new Error("REPORT_PACKAGE_IMMUTABILITY_VIOLATION");
    if (!existing) {
      this.objects.set(pathValue, { blob, sha256: metadata.sha256 });
      this.writes.push(pathValue);
    }
  }

  async get(pathValue: string) {
    const stored = this.objects.get(pathValue);
    if (!stored) throw new Error("OBJECT_NOT_FOUND");
    return stored.blob;
  }
}

let prepared: Awaited<ReturnType<typeof preP7Fixture>>;
beforeAll(async () => { prepared = await preP7Fixture(); }, 180000);
function fixture(repository = new MemoryRepository(), storage = new MemoryStorage()) {
  const service = new InstitutionalReportPackageService(repository, storage, () => "2026-10-01T00:00:00.000Z", async () => prepared.authorized);
  const base: any = { ...prepared.base, generationContext: structuredClone(prepared.context), pdfArtifacts: structuredClone(prepared.base.pdfArtifacts) };
  return { service, repository, storage, base };
}
async function complete() { const f = fixture(); return { ...f, input: f.base }; }

describe("P6 four artifact package offline",()=>{
 test("archives four immutable artifacts, same version and identity",async()=>{ const f=await complete(),m=await f.service.persistGeneratedPackage(f.input); expect(Object.keys(m.artifacts)).toHaveLength(4); expect(f.storage.writes).toHaveLength(4); expect(isCompleteInstitutionalReportPackage(m)).toBe(true); for(const a of Object.values(m.artifacts)){expect(a!.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);expect(a!.storagePath).toContain(`/v${m.version}/`);} });
 test("generation is not certification or publication",async()=>{const f=await complete(),m=await f.service.persistGeneratedPackage(f.input);expect(m.state).toBe("GENERATED");});
 test("downloads four artifacts and verifies PDF hashes",async()=>{const f=await complete(),m=await f.service.persistGeneratedPackage(f.input);const d=await f.service.downloadPackage(m.projectId,m.packageId);expect(d.executivePdf).toBe(f.input.pdfArtifacts.executive);expect(d.technicalAnnexPdf).toBe(f.input.pdfArtifacts.annex);});
 test.each(["executivePdf","technicalAnnexPdf"] as const)("tampered %s blocks download",async key=>{const f=await complete(),m=await f.service.persistGeneratedPackage(f.input);f.storage.objects.set(m.artifacts[key]!.storagePath,{blob:new Blob(["tampered"]),sha256:"changed"});await expect(f.service.downloadPackage(m.projectId,m.packageId)).rejects.toThrow("INTEGRITY_VIOLATION");});
 test("failed conversion rejects before reservation or storage", async()=>{const f=await complete(); f.input.pdfArtifacts={executive:null,annex:null,parity:{status:"FAILED",sourceDocxHashes:[],reason:"PDF failure"}};await expect(f.service.persistGeneratedPackage(f.input)).rejects.toThrow("COMPLETE_PRODUCT_REQUIRED");expect(f.storage.writes).toEqual([]);expect(f.repository.records.size).toBe(0);});
 test("PDF source mismatch blocks before storage",async()=>{const f=await complete();f.input.pdfArtifacts.parity.sourceDocxHashes[0]="wrong";await expect(f.service.persistGeneratedPackage(f.input)).rejects.toThrow("PDF_SOURCE_HASH_MISMATCH");expect(f.storage.writes).toHaveLength(0);});
 test("PDF storage failure preserves DOCX and marks pending PDF failed",async()=>{const f=await complete(),store=f.storage.storeImmutable.bind(f.storage);f.storage.storeImmutable=async(p,b,m)=>{if(p.endsWith(".pdf"))throw Error("offline storage failure");return store(p,b,m);};await expect(f.service.persistGeneratedPackage({...f.input,packageId:"storage-failure"})).rejects.toThrow();const m=(await f.repository.get(f.base.projectId,"storage-failure"))!;expect(m.artifacts.executiveReport.state).toBe("STORED");expect(m.artifacts.executivePdf!.state).toBe("FAILED");expect(m.state).toBe("FAILED");});
 test("P2 server snapshot remains authoritative",async()=>{const f=await complete();f.input.generationContext.sourceAuthority.sourceFingerprint="client";await expect(f.service.persistGeneratedPackage(f.input)).rejects.toThrow("SOURCE_AUTHORIZATION_REQUIRED");expect(f.storage.writes).toHaveLength(0);});
 test("new DOCX-only package is rejected",async()=>{const f=fixture();delete f.base.pdfArtifacts;await expect(f.service.persistGeneratedPackage(f.base)).rejects.toThrow("COMPLETE_PRODUCT_REQUIRED");expect(f.storage.writes).toEqual([]);});
});
