import fs from "fs";
import path from "path";
import {
  buildInstitutionalSnapshotHash,
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

  async reserve(projectId: string, packageId: string, createManifest: (version: number) => InstitutionalReportPackageManifest) {
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

  async saveArtifact(projectId: string, packageId: string, key: "executiveReport" | "technicalAnnex", artifact: InstitutionalReportPackageArtifact, updatedAt: string) {
    const manifest = await this.required(projectId, packageId);
    const saved = { ...manifest, artifacts: { ...manifest.artifacts, [key]: artifact }, updatedAt };
    this.records.set(`${projectId}/${packageId}`, saved);
    return saved;
  }

  async markGenerated(projectId: string, packageId: string, updatedAt: string) {
    const manifest = await this.required(projectId, packageId);
    if (manifest.artifacts.executiveReport.state !== "STORED" || manifest.artifacts.technicalAnnex.state !== "STORED") {
      throw new Error("REPORT_PACKAGE_INCOMPLETE");
    }
    const saved = { ...manifest, state: "GENERATED" as const, updatedAt, failureReason: null };
    this.records.set(`${projectId}/${packageId}`, saved);
    return saved;
  }

  async markFailed(projectId: string, packageId: string, reason: string, updatedAt: string) {
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

  async storeImmutable(pathValue: string, blob: Blob, metadata: { sha256: string }) {
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

function fixture(repository = new MemoryRepository(), storage = new MemoryStorage()) {
  let tick = 0;
  const service = new InstitutionalReportPackageService(repository, storage, () => `2026-09-23T10:00:0${tick++}.000Z`);
  const generationContext = {
    generatedAt: "2026-09-23T09:00:00.000Z",
    institutionalReportInput: { projectId: "project-3f", generatedAt: "2026-09-23T09:00:00.000Z", evidence: [{ id: "ev-1" }] },
    executiveModel: { title: "Informe" },
    visualComposition: { blocks: [{ id: "map-1" }] },
    documentModel: { modelId: "document-model-1", reportSnapshotId: "snapshot-1" },
    visualAssetsById: {},
  };
  const base = {
    projectId: "project-3f",
    numeroExpediente: "23092026-0001-ABC",
    generatedAt: generationContext.generatedAt,
    generatedBy: { id: "user-1", name: "Analista Uno", email: "analista@ceipol.example" },
    generationContext,
    reportBlob: new Blob(["report-bytes"]),
    annexBlob: new Blob(["annex-bytes"]),
  };
  return { service, repository, storage, base };
}

function visualContext(data: ArrayBuffer | ArrayBufferView) {
  return {
    generatedAt: "2026-09-23T09:00:00.000Z",
    institutionalReportInput: { projectId: "project-3f" },
    executiveModel: { title: "Informe" },
    visualComposition: { blocks: [{ id: "visual-1" }] },
    documentModel: { modelId: "document-model-1" },
    visualAssetsById: { "visual-1": { data, width: 10, height: 10, type: "png" } },
  };
}

describe("QA-08 FASE 3F - immutable report package versioning", () => {
  test("1 primera generación crea v1", async () => {
    const { service, base } = fixture();
    expect((await service.persistGeneratedPackage({ ...base, packageId: "pkg-1" })).version).toBe(1);
  });

  test("2 segunda acción humana crea v2", async () => {
    const { service, base } = fixture();
    await service.persistGeneratedPackage({ ...base, packageId: "pkg-1" });
    expect((await service.persistGeneratedPackage({ ...base, packageId: "pkg-2" })).version).toBe(2);
  });

  test("3 v1 permanece inmutable después de v2", async () => {
    const { service, repository, base } = fixture();
    const first = await service.persistGeneratedPackage({ ...base, packageId: "pkg-1" });
    await service.persistGeneratedPackage({ ...base, packageId: "pkg-2" });
    expect(await repository.get(base.projectId, "pkg-1")).toEqual(first);
  });

  test("4 Informe y Anexo comparten packageId y version", async () => {
    const { service, base } = fixture();
    const manifest = await service.persistGeneratedPackage({ ...base, packageId: "pkg-pair" });
    expect(manifest.artifacts.executiveReport.storagePath).toContain(`/pkg-pair/v${manifest.version}/`);
    expect(manifest.artifacts.technicalAnnex.storagePath).toContain(`/pkg-pair/v${manifest.version}/`);
  });

  test("5 registra SHA-256 del Informe", async () => {
    const { service, base } = fixture();
    expect((await service.persistGeneratedPackage({ ...base, packageId: "pkg-h1" })).artifacts.executiveReport.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test("6 registra SHA-256 del Anexo", async () => {
    const { service, base } = fixture();
    expect((await service.persistGeneratedPackage({ ...base, packageId: "pkg-h2" })).artifacts.technicalAnnex.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test("7 almacena ambos artefactos", async () => {
    const { service, storage, base } = fixture();
    await service.persistGeneratedPackage({ ...base, packageId: "pkg-store" });
    expect(storage.objects.size).toBe(2);
  });

  test("8 GENERATED se asigna sólo después de ambos STORED", async () => {
    const { service, base } = fixture();
    const manifest = await service.persistGeneratedPackage({ ...base, packageId: "pkg-generated" });
    expect([manifest.state, manifest.artifacts.executiveReport.state, manifest.artifacts.technicalAnnex.state]).toEqual(["GENERATED", "STORED", "STORED"]);
  });

  test("9 fallo del Anexo deja FAILED y no GENERATED", async () => {
    const setup = fixture();
    setup.storage.failAnnex = true;
    await expect(setup.service.persistGeneratedPackage({ ...setup.base, packageId: "pkg-failed" })).rejects.toThrow("ANNEX_STORAGE_FAILED");
    expect((await setup.repository.get(setup.base.projectId, "pkg-failed"))?.state).toBe("FAILED");
  });

  test("10 retry del mismo packageId no crea nueva versión", async () => {
    const { service, repository, base } = fixture();
    const first = await service.persistGeneratedPackage({ ...base, packageId: "pkg-retry" });
    const retry = await service.persistGeneratedPackage({ ...base, packageId: "pkg-retry" });
    expect(retry.version).toBe(first.version);
    expect((await repository.list(base.projectId))).toHaveLength(1);
  });

  test("11 nueva acción humana obtiene la siguiente versión", async () => {
    const { service, base } = fixture();
    const versions = await Promise.all(["human-1", "human-2", "human-3"].map((packageId) => service.persistGeneratedPackage({ ...base, packageId })));
    expect(versions.map((item) => item.version).sort()).toEqual([1, 2, 3]);
  });

  test("12 historial se ordena por versión descendente", async () => {
    const { service, base } = fixture();
    await service.persistGeneratedPackage({ ...base, packageId: "pkg-1" });
    await service.persistGeneratedPackage({ ...base, packageId: "pkg-2" });
    expect((await service.listPackages(base.projectId)).map((item) => item.version)).toEqual([2, 1]);
  });

  test("13 descarga histórica recupera el par exacto", async () => {
    const { service, base } = fixture();
    const manifest = await service.persistGeneratedPackage({ ...base, packageId: "pkg-download" });
    const pair = await service.downloadPackage(base.projectId, manifest.packageId);
    expect(await pair.executiveReport.text()).toBe("report-bytes");
    expect(await pair.technicalAnnex.text()).toBe("annex-bytes");
  });

  test("14 historial institucional no reutiliza la colección legacy dossiers", () => {
    const serviceSource = fs.readFileSync(path.join(process.cwd(), "src/services/institutionalReportPackageService.ts"), "utf8");
    const uiSource = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoAlbum.tsx"), "utf8");
    expect(serviceSource).toContain('"reportPackages"');
    expect(serviceSource).not.toContain('"dossiers"');
    expect(uiSource).toContain("Historial de informes institucionales");
    expect(uiSource).toContain('collection(db, "dossiers")');
  });

  test("15 nombres visibles incluyen vN", async () => {
    const { service, base } = fixture();
    const manifest = await service.persistGeneratedPackage({ ...base, packageId: "pkg-name" });
    expect(manifest.artifacts.executiveReport.filename).toBe("23092026-0001-ABC_INFORME_v1.docx");
    expect(manifest.artifacts.technicalAnnex.filename).toBe("23092026-0001-ABC_ANEXO_TECNICO_v1.docx");
  });

  test("16 una versión previa nunca reutiliza su ruta", async () => {
    const { service, storage, base } = fixture();
    await service.persistGeneratedPackage({ ...base, packageId: "pkg-old" });
    await service.persistGeneratedPackage({ ...base, packageId: "pkg-new" });
    expect(new Set(storage.writes).size).toBe(4);
    expect(storage.writes.some((item) => item.includes("/pkg-old/v1/"))).toBe(true);
    expect(storage.writes.some((item) => item.includes("/pkg-new/v2/"))).toBe(true);
  });

  test("17 la asignación productiva de versión está protegida por transacción", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/services/institutionalReportPackageService.ts"), "utf8");
    const reserve = source.slice(source.indexOf("async reserve"), source.indexOf("async get(projectId"));
    expect(reserve).toContain("runTransaction");
    expect(reserve).toContain("lastVersion");
    expect(reserve).not.toContain("getDocs(packageCollection");
  });

  test("18 Uint8Array participa realmente en snapshotHash", async () => {
    const withBinary = await buildInstitutionalSnapshotHash(visualContext(new Uint8Array([10, 20, 30])));
    const withoutBinary = await buildInstitutionalSnapshotHash(visualContext(new Uint8Array(0)));
    expect(withBinary).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(withBinary).not.toBe(withoutBinary);
  });

  test("19 cambiar un byte del activo cambia snapshotHash", async () => {
    const first = await buildInstitutionalSnapshotHash(visualContext(new Uint8Array([1, 2, 3, 4])));
    const changed = await buildInstitutionalSnapshotHash(visualContext(new Uint8Array([1, 2, 3, 5])));
    expect(first).not.toBe(changed);
  });

  test("20 ArrayBuffer y Uint8Array equivalentes producen el mismo fingerprint", async () => {
    const backing = new Uint8Array([99, 7, 8, 9, 88]);
    const exactView = new Uint8Array(backing.buffer, 1, 3);
    const exactDataView = new DataView(backing.buffer, 1, 3);
    const exactBuffer = new Uint8Array([7, 8, 9]).buffer;
    expect(Array.from(new Uint8Array(toExactArrayBuffer(exactView)!))).toEqual([7, 8, 9]);
    expect(await buildInstitutionalSnapshotHash(visualContext(exactView))).toBe(
      await buildInstitutionalSnapshotHash(visualContext(exactBuffer))
    );
    expect(await buildInstitutionalSnapshotHash(visualContext(exactDataView))).toBe(
      await buildInstitutionalSnapshotHash(visualContext(exactBuffer))
    );
  });

  test("21 descarga histórica válida pasa verificación SHA", async () => {
    const { service, base } = fixture();
    const manifest = await service.persistGeneratedPackage({ ...base, packageId: "pkg-valid-download" });
    await expect(service.downloadPackage(base.projectId, manifest.packageId)).resolves.toMatchObject({ manifest });
  });

  test("22 Informe alterado bloquea descarga histórica", async () => {
    const { service, storage, base } = fixture();
    const manifest = await service.persistGeneratedPackage({ ...base, packageId: "pkg-report-corrupt" });
    storage.objects.set(manifest.artifacts.executiveReport.storagePath, { blob: new Blob(["altered-report"]), sha256: manifest.artifacts.executiveReport.sha256 });
    await expect(service.downloadPackage(base.projectId, manifest.packageId)).rejects.toThrow("REPORT_PACKAGE_INTEGRITY_VIOLATION");
  });

  test("23 Anexo alterado bloquea descarga histórica", async () => {
    const { service, storage, base } = fixture();
    const manifest = await service.persistGeneratedPackage({ ...base, packageId: "pkg-annex-corrupt" });
    storage.objects.set(manifest.artifacts.technicalAnnex.storagePath, { blob: new Blob(["altered-annex"]), sha256: manifest.artifacts.technicalAnnex.sha256 });
    await expect(service.downloadPackage(base.projectId, manifest.packageId)).rejects.toThrow("REPORT_PACKAGE_INTEGRITY_VIOLATION");
  });

  test("24 auditoría de descarga no modifica manifest ni elimina objetos", async () => {
    const { service, repository, storage, base } = fixture();
    const manifest = await service.persistGeneratedPackage({ ...base, packageId: "pkg-read-audit" });
    const beforeManifest = JSON.stringify(await repository.get(base.projectId, manifest.packageId));
    const beforePaths = Array.from(storage.objects.keys()).sort();
    storage.objects.set(manifest.artifacts.executiveReport.storagePath, { blob: new Blob(["corrupt"]), sha256: manifest.artifacts.executiveReport.sha256 });
    await expect(service.downloadPackage(base.projectId, manifest.packageId)).rejects.toThrow("REPORT_PACKAGE_INTEGRITY_VIOLATION");
    expect(JSON.stringify(await repository.get(base.projectId, manifest.packageId))).toBe(beforeManifest);
    expect(Array.from(storage.objects.keys()).sort()).toEqual(beforePaths);
    expect((await repository.get(base.projectId, manifest.packageId))?.state).toBe("GENERATED");
  });
});
