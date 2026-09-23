import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  type Firestore,
} from "firebase/firestore";
import {
  getBlob,
  getMetadata,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";
import { getDb, getStorageInstance } from "@/lib/firebase";
import { sanitizeExpedienteFilePart } from "@/utils/documentIdentity";

export type InstitutionalReportPackageState = "GENERATING" | "GENERATED" | "FAILED" | "CERTIFIED" | "PUBLISHED";
export type InstitutionalReportArtifactState = "PENDING" | "STORED" | "FAILED";
export type InstitutionalReportArtifactKind = "EXECUTIVE_REPORT" | "TECHNICAL_ANNEX";

export interface InstitutionalReportPackageActor {
  uid: string;
  displayName?: string | null;
  email?: string | null;
}

export interface InstitutionalReportPackageArtifact {
  kind: InstitutionalReportArtifactKind;
  filename: string;
  storagePath: string;
  sha256: string;
  sizeBytes: number;
  state: InstitutionalReportArtifactState;
}

export interface InstitutionalReportPackageManifest {
  packageId: string;
  projectId: string;
  numeroExpediente: string;
  version: number;
  generatedAt: string;
  generatedBy: InstitutionalReportPackageActor;
  state: InstitutionalReportPackageState;
  snapshotHash: string;
  createdAt: string;
  updatedAt: string;
  artifacts: {
    executiveReport: InstitutionalReportPackageArtifact;
    technicalAnnex: InstitutionalReportPackageArtifact;
  };
  lineage: {
    reportSnapshotId: string | null;
    institutionalReportInputId: string | null;
    documentModelId: string | null;
  };
  failureReason?: string | null;
}

export interface InstitutionalReportPackageRepository {
  reserve(
    projectId: string,
    packageId: string,
    createManifest: (version: number) => InstitutionalReportPackageManifest
  ): Promise<InstitutionalReportPackageManifest>;
  get(projectId: string, packageId: string): Promise<InstitutionalReportPackageManifest | null>;
  list(projectId: string): Promise<InstitutionalReportPackageManifest[]>;
  saveArtifact(
    projectId: string,
    packageId: string,
    key: "executiveReport" | "technicalAnnex",
    artifact: InstitutionalReportPackageArtifact,
    updatedAt: string
  ): Promise<InstitutionalReportPackageManifest>;
  markGenerated(projectId: string, packageId: string, updatedAt: string): Promise<InstitutionalReportPackageManifest>;
  markFailed(projectId: string, packageId: string, reason: string, updatedAt: string): Promise<InstitutionalReportPackageManifest>;
}

export interface InstitutionalReportPackageStorage {
  storeImmutable(path: string, blob: Blob, metadata: { sha256: string; packageId: string; version: number; kind: InstitutionalReportArtifactKind }): Promise<void>;
  get(path: string): Promise<Blob>;
}

function packageCollection(db: Firestore, projectId: string) {
  return collection(db, "projects", projectId, "reportPackages");
}

function packageDoc(db: Firestore, projectId: string, packageId: string) {
  return doc(db, "projects", projectId, "reportPackages", packageId);
}

function versionAllocatorDoc(db: Firestore, projectId: string) {
  return doc(db, "projects", projectId, "reportPackageSystem", "versionAllocator");
}

export class FirestoreInstitutionalReportPackageRepository implements InstitutionalReportPackageRepository {
  constructor(private readonly db: Firestore = getDb()) {}

  async reserve(projectId: string, packageId: string, createManifest: (version: number) => InstitutionalReportPackageManifest) {
    return runTransaction(this.db, async (transaction) => {
      const manifestRef = packageDoc(this.db, projectId, packageId);
      const existing = await transaction.get(manifestRef);
      if (existing.exists()) return existing.data() as InstitutionalReportPackageManifest;

      const allocatorRef = versionAllocatorDoc(this.db, projectId);
      const allocator = await transaction.get(allocatorRef);
      const version = Number(allocator.data()?.lastVersion || 0) + 1;
      const manifest = createManifest(version);
      transaction.set(allocatorRef, { lastVersion: version, updatedAt: manifest.createdAt }, { merge: true });
      transaction.set(manifestRef, manifest);
      return manifest;
    });
  }

  async get(projectId: string, packageId: string) {
    const snapshot = await getDoc(packageDoc(this.db, projectId, packageId));
    return snapshot.exists() ? snapshot.data() as InstitutionalReportPackageManifest : null;
  }

  async list(projectId: string) {
    const snapshot = await getDocs(packageCollection(this.db, projectId));
    return snapshot.docs
      .map((item) => item.data() as InstitutionalReportPackageManifest)
      .sort((a, b) => b.version - a.version);
  }

  async saveArtifact(projectId: string, packageId: string, key: "executiveReport" | "technicalAnnex", artifact: InstitutionalReportPackageArtifact, updatedAt: string) {
    return runTransaction(this.db, async (transaction) => {
      const refValue = packageDoc(this.db, projectId, packageId);
      const snapshot = await transaction.get(refValue);
      if (!snapshot.exists()) throw new Error("REPORT_PACKAGE_NOT_FOUND");
      const manifest = snapshot.data() as InstitutionalReportPackageManifest;
      const saved = {
        ...manifest,
        artifacts: { ...manifest.artifacts, [key]: artifact },
        updatedAt,
      };
      transaction.set(refValue, saved);
      return saved;
    });
  }

  async markGenerated(projectId: string, packageId: string, updatedAt: string) {
    return runTransaction(this.db, async (transaction) => {
      const refValue = packageDoc(this.db, projectId, packageId);
      const snapshot = await transaction.get(refValue);
      if (!snapshot.exists()) throw new Error("REPORT_PACKAGE_NOT_FOUND");
      const manifest = snapshot.data() as InstitutionalReportPackageManifest;
      const complete = manifest.artifacts.executiveReport.state === "STORED"
        && manifest.artifacts.technicalAnnex.state === "STORED"
        && Boolean(manifest.artifacts.executiveReport.sha256)
        && Boolean(manifest.artifacts.technicalAnnex.sha256);
      if (!complete) throw new Error("REPORT_PACKAGE_INCOMPLETE");
      const generated = { ...manifest, state: "GENERATED" as const, updatedAt, failureReason: null };
      transaction.set(refValue, generated);
      return generated;
    });
  }

  async markFailed(projectId: string, packageId: string, reason: string, updatedAt: string) {
    return runTransaction(this.db, async (transaction) => {
      const refValue = packageDoc(this.db, projectId, packageId);
      const snapshot = await transaction.get(refValue);
      if (!snapshot.exists()) throw new Error("REPORT_PACKAGE_NOT_FOUND");
      const manifest = snapshot.data() as InstitutionalReportPackageManifest;
      if (manifest.state === "GENERATED" || manifest.state === "CERTIFIED" || manifest.state === "PUBLISHED") return manifest;
      const failed = { ...manifest, state: "FAILED" as const, updatedAt, failureReason: reason.slice(0, 500) };
      transaction.set(refValue, failed);
      return failed;
    });
  }
}

export class FirebaseInstitutionalReportPackageStorage implements InstitutionalReportPackageStorage {
  constructor(private readonly storage: FirebaseStorage = getStorageInstance()) {}

  async storeImmutable(path: string, blob: Blob, metadata: { sha256: string; packageId: string; version: number; kind: InstitutionalReportArtifactKind }) {
    const objectRef = ref(this.storage, path);
    try {
      const existing = await getMetadata(objectRef);
      if (existing.customMetadata?.sha256 === metadata.sha256) return;
      throw new Error("REPORT_PACKAGE_IMMUTABILITY_VIOLATION");
    } catch (error: any) {
      if (error?.message === "REPORT_PACKAGE_IMMUTABILITY_VIOLATION") throw error;
      if (error?.code !== "storage/object-not-found") throw error;
    }
    await uploadBytes(objectRef, blob, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      customMetadata: {
        sha256: metadata.sha256,
        packageId: metadata.packageId,
        version: String(metadata.version),
        kind: metadata.kind,
      },
    });
  }

  get(path: string) {
    return getBlob(ref(this.storage, path));
  }
}

function canonicalize(value: any): any {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value) || value instanceof Blob) return undefined;
  if (typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      const normalized = canonicalize(value[key]);
      if (normalized !== undefined) result[key] = normalized;
      return result;
    }, {} as Record<string, any>);
  }
  return undefined;
}

async function sha256Bytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toExactArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (!ArrayBuffer.isView(value)) return null;
  const view = value as ArrayBufferView;
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice().buffer as ArrayBuffer;
}

export async function sha256Blob(blob: Blob): Promise<string> {
  return `sha256:${await sha256Bytes(await blob.arrayBuffer())}`;
}

export async function buildInstitutionalSnapshotHash(context: any): Promise<string> {
  const visualAssets = await Promise.all(Object.entries(context.visualAssetsById || {}).map(async ([id, asset]: [string, any]) => {
    const binary = toExactArrayBuffer(asset?.data);
    return {
      id,
      width: asset?.width ?? null,
      height: asset?.height ?? null,
      type: asset?.type ?? null,
      sha256: binary ? `sha256:${await sha256Bytes(binary)}` : null,
    };
  }));
  const canonical = canonicalize({
    institutionalReportInput: context.institutionalReportInput,
    generatedAt: context.generatedAt,
    executiveModel: context.executiveModel,
    visualComposition: context.visualComposition,
    documentModel: context.documentModel,
    visualAssets: visualAssets.sort((a, b) => a.id.localeCompare(b.id)),
  });
  const canonicalBytes = new TextEncoder().encode(JSON.stringify(canonical));
  return `sha256:${await sha256Bytes(canonicalBytes.buffer as ArrayBuffer)}`;
}

export function createInstitutionalReportPackageId(): string {
  return crypto.randomUUID();
}

export function buildVersionedReportPackageFilenames(numeroExpediente: string, version: number) {
  const safeNumber = sanitizeExpedienteFilePart(numeroExpediente, "NO_ASIGNADO");
  return {
    executiveReport: `${safeNumber}_INFORME_v${version}.docx`,
    technicalAnnex: `${safeNumber}_ANEXO_TECNICO_v${version}.docx`,
  };
}

function resolveActor(user: any): InstitutionalReportPackageActor {
  const uid = String(user?.uid ?? user?.id ?? "").trim();
  if (!uid) throw new Error("REPORT_PACKAGE_ACTOR_REQUIRED");
  return {
    uid,
    displayName: user?.displayName || user?.name || user?.username || null,
    email: user?.email || null,
  };
}

export class InstitutionalReportPackageService {
  constructor(
    private readonly repository: InstitutionalReportPackageRepository = new FirestoreInstitutionalReportPackageRepository(),
    private readonly storage: InstitutionalReportPackageStorage = new FirebaseInstitutionalReportPackageStorage(),
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async persistGeneratedPackage(input: {
    packageId?: string;
    projectId: string;
    numeroExpediente: string;
    generatedAt: string;
    generatedBy: any;
    generationContext: any;
    reportBlob: Blob;
    annexBlob: Blob;
  }): Promise<InstitutionalReportPackageManifest> {
    const packageId = input.packageId || createInstitutionalReportPackageId();
    const actor = resolveActor(input.generatedBy);
    const [snapshotHash, reportHash, annexHash] = await Promise.all([
      buildInstitutionalSnapshotHash(input.generationContext),
      sha256Blob(input.reportBlob),
      sha256Blob(input.annexBlob),
    ]);
    const createdAt = this.now();
    let manifest = await this.repository.reserve(input.projectId, packageId, (version) => {
      const filenames = buildVersionedReportPackageFilenames(input.numeroExpediente, version);
      const root = `projects/${input.projectId}/reports/${packageId}/v${version}`;
      return {
        packageId,
        projectId: input.projectId,
        numeroExpediente: input.numeroExpediente,
        version,
        generatedAt: input.generatedAt,
        generatedBy: actor,
        state: "GENERATING",
        snapshotHash,
        createdAt,
        updatedAt: createdAt,
        artifacts: {
          executiveReport: { kind: "EXECUTIVE_REPORT", filename: filenames.executiveReport, storagePath: `${root}/${filenames.executiveReport}`, sha256: reportHash, sizeBytes: input.reportBlob.size, state: "PENDING" },
          technicalAnnex: { kind: "TECHNICAL_ANNEX", filename: filenames.technicalAnnex, storagePath: `${root}/${filenames.technicalAnnex}`, sha256: annexHash, sizeBytes: input.annexBlob.size, state: "PENDING" },
        },
        lineage: {
          reportSnapshotId: input.generationContext.documentModel?.reportSnapshotId || input.generationContext.institutionalReportInput?.reportSnapshotId || null,
          institutionalReportInputId: input.generationContext.institutionalReportInput?.institutionalReportInputId || null,
          documentModelId: input.generationContext.documentModel?.modelId || null,
        },
        failureReason: null,
      };
    });

    if (manifest.snapshotHash !== snapshotHash
      || manifest.artifacts.executiveReport.sha256 !== reportHash
      || manifest.artifacts.technicalAnnex.sha256 !== annexHash) {
      throw new Error("REPORT_PACKAGE_IDEMPOTENCY_CONFLICT");
    }
    if (manifest.state === "GENERATED") return manifest;

    try {
      await this.storage.storeImmutable(manifest.artifacts.executiveReport.storagePath, input.reportBlob, {
        sha256: reportHash, packageId, version: manifest.version, kind: "EXECUTIVE_REPORT",
      });
      manifest = await this.repository.saveArtifact(input.projectId, packageId, "executiveReport", { ...manifest.artifacts.executiveReport, state: "STORED" }, this.now());
      await this.storage.storeImmutable(manifest.artifacts.technicalAnnex.storagePath, input.annexBlob, {
        sha256: annexHash, packageId, version: manifest.version, kind: "TECHNICAL_ANNEX",
      });
      manifest = await this.repository.saveArtifact(input.projectId, packageId, "technicalAnnex", { ...manifest.artifacts.technicalAnnex, state: "STORED" }, this.now());
      return await this.repository.markGenerated(input.projectId, packageId, this.now());
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.repository.markFailed(input.projectId, packageId, reason, this.now());
      throw error;
    }
  }

  listPackages(projectId: string) {
    return this.repository.list(projectId);
  }

  async downloadPackage(projectId: string, packageId: string) {
    const manifest = await this.repository.get(projectId, packageId);
    if (!manifest) throw new Error("REPORT_PACKAGE_NOT_FOUND");
    if (manifest.state !== "GENERATED" && manifest.state !== "CERTIFIED" && manifest.state !== "PUBLISHED") {
      throw new Error("REPORT_PACKAGE_NOT_DOWNLOADABLE");
    }
    const [executiveReport, technicalAnnex] = await Promise.all([
      this.storage.get(manifest.artifacts.executiveReport.storagePath),
      this.storage.get(manifest.artifacts.technicalAnnex.storagePath),
    ]);
    const [executiveReportHash, technicalAnnexHash] = await Promise.all([
      sha256Blob(executiveReport),
      sha256Blob(technicalAnnex),
    ]);
    if (executiveReportHash !== manifest.artifacts.executiveReport.sha256
      || technicalAnnexHash !== manifest.artifacts.technicalAnnex.sha256) {
      throw new Error("REPORT_PACKAGE_INTEGRITY_VIOLATION");
    }
    return { manifest, executiveReport, technicalAnnex };
  }
}

export const institutionalReportPackageService = new InstitutionalReportPackageService();
