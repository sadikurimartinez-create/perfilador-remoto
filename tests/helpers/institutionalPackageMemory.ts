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
} from "../../src/services/institutionalReportPackageService";

export class MemoryRepository implements InstitutionalReportPackageRepository {
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

export class MemoryStorage implements InstitutionalReportPackageStorage {
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
