import "server-only";
import { createHash } from "crypto";
import { canonicalSemanticValue } from "@/utils/institutionalDocumentSemanticIntegrity";
import { getInstitutionalAdminDb, getInstitutionalAdminBucket } from "@/lib/firebaseAdmin";
import { isCompleteInstitutionalReportPackage, type InstitutionalReportPackageRepository, type InstitutionalReportPackageStorage,
  type InstitutionalReportPackageManifest, type InstitutionalReportArtifactKey, type InstitutionalReportPackageArtifact } from "./institutionalReportPackageService";
export class AdminInstitutionalReportPackageRepository implements InstitutionalReportPackageRepository {
  constructor(private readonly generationContext?: any) {}
  private db = getInstitutionalAdminDb();
  private ref(projectId: string, packageId: string) { return this.db.collection("projects").doc(projectId).collection("reportPackages").doc(packageId); }
  async reserve(projectId: string, packageId: string, create: (version: number) => InstitutionalReportPackageManifest) {
    return this.db.runTransaction(async transaction => {
      const ref = this.ref(projectId, packageId);
      const existing = await transaction.get(ref);
      if (existing.exists) return existing.data() as InstitutionalReportPackageManifest;
      const allocator = this.db.collection("projects").doc(projectId).collection("reportPackageSystem").doc("versionAllocator");
      const version = ((await transaction.get(allocator)).data()?.lastVersion ?? 0) + 1;
      if (!Number.isSafeInteger(version) || version < 1) throw new Error("REPORT_PACKAGE_VERSION_INVALID");
      const manifest = create(version);
      transaction.set(allocator, { lastVersion: version, updatedAt: manifest.createdAt });
      transaction.create(ref, manifest);
      if (this.generationContext) transaction.create(this.db.collection("projects").doc(projectId).collection("reportPackageInputs").doc(packageId), {
        packageId, projectId,
        inputHash: createHash("sha256").update(canonicalSemanticValue(this.generationContext.institutionalReportInput)).digest("hex"),
        modelHash: createHash("sha256").update(canonicalSemanticValue(this.generationContext.documentModel)).digest("hex"),
        sourceFingerprint: this.generationContext.sourceAuthority.sourceFingerprint,
      });
      transaction.create(this.db.collection("audit_logs").doc(), { projectId, action: "REPORT_PACKAGE_RESERVED", packageId,
        actorUid: manifest.generatedBy.uid, timestamp: manifest.createdAt, source: "SERVER" });
      return manifest;
    });
  }
  async get(projectId: string, packageId: string) {
    const snap = await this.ref(projectId, packageId).get();
    return snap.exists ? snap.data() as InstitutionalReportPackageManifest : null;
  }
  async list(projectId: string) {
    return (await this.db.collection("projects").doc(projectId).collection("reportPackages").get()).docs
      .map(doc => doc.data() as InstitutionalReportPackageManifest).sort((a,b) => b.version-a.version);
  }
  private async change(projectId: string, packageId: string, apply: (manifest: InstitutionalReportPackageManifest) => InstitutionalReportPackageManifest) {
    return this.db.runTransaction(async transaction => {
      const ref = this.ref(projectId, packageId); const snap = await transaction.get(ref);
      if (!snap.exists) throw new Error("REPORT_PACKAGE_NOT_FOUND");
      const prior = snap.data() as InstitutionalReportPackageManifest;
      const next = apply(prior);
      if (next !== prior) {
        transaction.set(ref, next);
        transaction.create(this.db.collection("audit_logs").doc(), { projectId, packageId, action: "REPORT_PACKAGE_TRANSITION",
          previousState: prior.state, state: next.state, timestamp: next.updatedAt, source: "SERVER", actorUid: next.generatedBy.uid });
      }
      return next;
    });
  }
  async saveArtifact(projectId: string, packageId: string, key: InstitutionalReportArtifactKey, artifact: InstitutionalReportPackageArtifact, updatedAt: string) {
    return this.change(projectId, packageId, prior => {
      if (prior.state !== "GENERATING") {
        if (JSON.stringify(prior.artifacts[key]) === JSON.stringify(artifact)) return prior;
        throw new Error("REPORT_PACKAGE_IMMUTABILITY_VIOLATION");
      }
      return { ...prior, artifacts: { ...prior.artifacts, [key]: artifact }, updatedAt };
    });
  }
  async markGenerated(projectId: string, packageId: string, updatedAt: string) {
    return this.change(projectId, packageId, prior => {
      if (["GENERATED", "CERTIFIED", "PUBLISHED"].includes(prior.state)) return prior;
      const next = { ...prior, state: "GENERATED" as const, updatedAt, failureReason: null };
      if (!isCompleteInstitutionalReportPackage(next)) throw new Error("REPORT_PACKAGE_INCOMPLETE");
      return next;
    });
  }
  async markFailed(projectId: string, packageId: string, reason: string, updatedAt: string) {
    return this.change(projectId, packageId, prior => ["GENERATED", "CERTIFIED", "PUBLISHED"].includes(prior.state)
      ? prior : { ...prior, state: "FAILED", failureReason: reason.slice(0,500), updatedAt });
  }
}
export class AdminInstitutionalReportPackageStorage implements InstitutionalReportPackageStorage {
  async storeImmutable(path: string, blob: Blob, metadata: { sha256: string; packageId: string; version: number; kind: string }) {
    const bytes = Buffer.from(await blob.arrayBuffer());
    if (`sha256:${createHash("sha256").update(bytes).digest("hex")}` !== metadata.sha256) throw new Error("REPORT_PACKAGE_HASH_MISMATCH");
    const file = getInstitutionalAdminBucket().file(path);
    try {
      await file.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: blob.type || (path.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
          metadata: { sha256: metadata.sha256, packageId: metadata.packageId, version: String(metadata.version), kind: metadata.kind } } });
    } catch (error: any) {
      if (![409,412].includes(Number(error?.code))) throw error;
      const [existing] = await file.download();
      if (`sha256:${createHash("sha256").update(existing).digest("hex")}` !== metadata.sha256) throw new Error("REPORT_PACKAGE_IMMUTABILITY_VIOLATION");
    }
  }
  async get(path: string) { const [bytes] = await getInstitutionalAdminBucket().file(path).download(); return new Blob([new Uint8Array(bytes)]); }
}
