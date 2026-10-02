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
import type { GovernedCartographicScale } from "@/utils/governedCartographicScale";
import { getAuthorizedInstitutionalReportSource } from "@/lib/institutionalReportSourceActions";
import type { AuthorizedInstitutionalReportSource } from "@/services/institutionalReportSourceService";
import { buildInstitutionalGenerationModels } from "@/utils/institutionalGenerationModels";
import { enrichInstitutionalPayloadWithCrimeIncidenceVisuals } from "@/utils/crimeIncidenceInstitutionalPayloadBridge";
import { assertReconciledDocumentSemanticAudit, reconcileDocumentSemanticAudit, reconcileMaterializedDocument, canonicalSemanticValue } from "@/utils/institutionalDocumentSemanticIntegrity";
import { buildExecutiveGeointTechnicalAnnexModel } from "@/utils/executiveGeointTechnicalAnnexModel";
import { renderExecutiveGeointWordDocument } from "@/utils/executiveGeointWordRenderer";
import { renderExecutiveGeointTechnicalAnnexWordDocument } from "@/utils/executiveGeointTechnicalAnnexWordRenderer";
import { assertInstitutionalDocxPhysicalParity, renderInstitutionalPdfFromDocx, institutionalAnnexRequiredVisualIds } from "@/utils/institutionalPdfRenderer";
import { Packer } from "docx";

export type InstitutionalReportPackageState = "GENERATING" | "GENERATED" | "FAILED" | "CERTIFIED" | "PUBLISHED";
export type InstitutionalReportArtifactState = "PENDING" | "STORED" | "FAILED";
export type InstitutionalReportArtifactKind = "EXECUTIVE_REPORT" | "TECHNICAL_ANNEX" | "EXECUTIVE_PDF" | "TECHNICAL_ANNEX_PDF";
export type InstitutionalReportArtifactKey = "executiveReport" | "technicalAnnex" | "executivePdf" | "technicalAnnexPdf";
export type ReportPackageStage =
  | "RESOLVE_ACTOR"
  | "BUILD_SNAPSHOT_HASHES"
  | "RESERVE_PACKAGE"
  | "STORE_EXECUTIVE_REPORT"
  | "SAVE_EXECUTIVE_REPORT_STATE"
  | "STORE_TECHNICAL_ANNEX"
  | "SAVE_TECHNICAL_ANNEX_STATE"
  | "MARK_GENERATED"
  | "MARK_FAILED"
  | "DOWNLOAD_EXECUTIVE"
  | "DOWNLOAD_TECHNICAL_ANNEX"
  | "VERIFY_DOWNLOAD_HASHES";

export interface ReportPackageErrorDiagnostic {
  stage: ReportPackageStage | null;
  code: string;
  message: string;
}

const REPORT_PACKAGE_ERROR_PREFIX = "REPORT_PACKAGE_STAGE_FAILED";
const REPORT_PACKAGE_STAGES = new Set<ReportPackageStage>([
  "RESOLVE_ACTOR",
  "BUILD_SNAPSHOT_HASHES",
  "RESERVE_PACKAGE",
  "STORE_EXECUTIVE_REPORT",
  "SAVE_EXECUTIVE_REPORT_STATE",
  "STORE_TECHNICAL_ANNEX",
  "SAVE_TECHNICAL_ANNEX_STATE",
  "MARK_GENERATED",
  "MARK_FAILED",
  "DOWNLOAD_EXECUTIVE",
  "DOWNLOAD_TECHNICAL_ANNEX",
  "VERIFY_DOWNLOAD_HASHES",
]);

function sanitizeDiagnosticText(value: unknown, fallback: string): string {
  const text = String(value ?? fallback)
    .replace(/https?:\/\/\S+/gi, "[REDACTED_URL]")
    .replace(/\b(token|cookie|credential|authorization|password|api[_ -]?key)\s*[=:]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return (text || fallback).slice(0, 300);
}

function errorCode(error: unknown): string {
  const source = error && typeof error === "object" ? error as Record<string, unknown> : null;
  const explicit = source?.code;
  if (typeof explicit === "string" && explicit.trim()) {
    return sanitizeDiagnosticText(explicit, "UNKNOWN").replace(/[^a-zA-Z0-9_./-]/g, "_").slice(0, 80);
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /^[A-Z][A-Z0-9_/-]+$/.test(message) ? message.slice(0, 80) : "UNKNOWN";
}

export class ReportPackageStageError extends Error {
  readonly name = "ReportPackageStageError";

  constructor(
    readonly stage: ReportPackageStage,
    readonly code: string,
    readonly originalMessage: string
  ) {
    super(`${REPORT_PACKAGE_ERROR_PREFIX}:${stage}:${code}:${originalMessage}`);
  }
}

function toStageError(stage: ReportPackageStage, error: unknown): ReportPackageStageError {
  if (error instanceof ReportPackageStageError) return error;
  const message = error instanceof Error ? error.message : String(error ?? "UNKNOWN_ERROR");
  return new ReportPackageStageError(
    stage,
    errorCode(error),
    sanitizeDiagnosticText(message, "UNKNOWN_ERROR")
  );
}

function logStageError(error: ReportPackageStageError, secondary = false) {
  console.error(secondary ? "[REPORT PACKAGE SECONDARY ERROR]" : "[REPORT PACKAGE ERROR]", {
    stage: error.stage,
    code: error.code,
    message: error.originalMessage,
  });
}

async function runReportPackageStage<T>(stage: ReportPackageStage, operation: () => Promise<T> | T): Promise<T> {
  console.info(`[REPORT PACKAGE] stage=${stage} status=START`);
  try {
    const result = await operation();
    console.info(`[REPORT PACKAGE] stage=${stage} status=OK`);
    return result;
  } catch (error) {
    const stageError = toStageError(stage, error);
    logStageError(stageError);
    throw stageError;
  }
}

export function getReportPackageErrorDiagnostic(error: unknown): ReportPackageErrorDiagnostic {
  if (error instanceof ReportPackageStageError) {
    return { stage: error.stage, code: error.code, message: error.originalMessage };
  }
  const rawMessage = error instanceof Error ? error.message : String(error ?? "UNKNOWN_ERROR");
  const sanitized = sanitizeDiagnosticText(rawMessage, "UNKNOWN_ERROR");
  const match = sanitized.match(/REPORT_PACKAGE_STAGE_FAILED:([^:]+):([^:]+):(.+)$/);
  const stage = match?.[1] && REPORT_PACKAGE_STAGES.has(match[1] as ReportPackageStage)
    ? match[1] as ReportPackageStage
    : null;
  return {
    stage,
    code: match?.[2] || errorCode(error),
    message: match?.[3] || sanitized,
  };
}

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
    executivePdf?: InstitutionalReportPackageArtifact;
    technicalAnnexPdf?: InstitutionalReportPackageArtifact;
  };
  formatContract?: "DOCX_ONLY" | "DOCX_PDF";
  pdfParity?: { status: "PASS" | "FAILED"; sourceDocxHashes: string[]; reason?: string };
  lineage: {
    contract?: Awaited<ReturnType<typeof buildInstitutionalPackageLineage>>;
    reportSnapshotId: string | null;
    institutionalReportInputId: string | null;
    documentModelId: string | null;
  };
  cartographicSnapshot?: {
    algorithmVersion: string;
    mapSpecHash: string;
    geographyId: string;
    geometryType: string;
    center: { lat: number; lng: number };
    bounds: unknown;
    zoom: number;
    logicalWidth: number;
    logicalHeight: number;
    staticMapScale: number;
    cartographicScale: GovernedCartographicScale;
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
    key: InstitutionalReportArtifactKey,
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

  async saveArtifact(projectId: string, packageId: string, key: InstitutionalReportArtifactKey, artifact: InstitutionalReportPackageArtifact, updatedAt: string) {
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
      const pdfComplete = manifest.formatContract !== "DOCX_PDF" || (manifest.pdfParity?.status === "PASS" &&
        manifest.artifacts.executivePdf?.state === "STORED" && manifest.artifacts.technicalAnnexPdf?.state === "STORED" &&
        Boolean(manifest.artifacts.executivePdf.sha256) && Boolean(manifest.artifacts.technicalAnnexPdf.sha256));
      if (!complete || !pdfComplete || (manifest.formatContract === "DOCX_PDF" && !isCompleteInstitutionalReportPackage({ ...manifest, state: "GENERATED" }))) throw new Error("REPORT_PACKAGE_INCOMPLETE");
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

export async function buildInstitutionalContractFingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  return `sha256:${await sha256Bytes(bytes.buffer as ArrayBuffer)}`;
}

export async function buildInstitutionalPackageLineage(authorized: AuthorizedInstitutionalReportSource, context: any) {
  return {
    projectId: authorized.projectId, expedienteId: authorized.projectId,
    authorizedSourceFingerprint: authorized.sourceFingerprint,
    sourceProjectionFingerprint: await buildInstitutionalContractFingerprint(authorized.project),
    semanticIntegrityFingerprint: await buildInstitutionalContractFingerprint(context.documentModel.semanticIntegrity),
    documentModelFingerprint: await buildInstitutionalContractFingerprint({ executive: context.documentModel, annex: context.annexModel }),
  };
}

/** Recompute from the server-authorized projection, rather than trusting client seals. */
async function validateInstitutionalPackageLineage(authorized: AuthorizedInstitutionalReportSource, input: any) {
  const context = input.generationContext;
  if (context?.projectId !== authorized.projectId || context?.numeroExpediente !== input.numeroExpediente ||
    context?.generatedAt !== input.generatedAt || context?.institutionalReportInput?.projectId !== authorized.projectId ||
    (context?.institutionalReportInput?.expedienteId && context.institutionalReportInput.expedienteId !== authorized.projectId)) throw new Error("REPORT_PACKAGE_IDENTITY_CONFLICT");
  assertReconciledDocumentSemanticAudit(context?.documentModel?.semanticIntegrity);
  assertReconciledDocumentSemanticAudit(context?.annexModel?.technicalMetadata?.semanticIntegrity);
  if (!input.pdfArtifacts?.executive || !input.pdfArtifacts?.annex || input.pdfArtifacts.parity.status !== "PASS") throw new Error("REPORT_PACKAGE_COMPLETE_PRODUCT_REQUIRED");
  const supplied = context.lineage;
  if (!supplied || canonicalSemanticValue(supplied) !== canonicalSemanticValue(await buildInstitutionalPackageLineage(authorized, context))) throw new Error("REPORT_PACKAGE_LINEAGE_MISMATCH");
  const payload = await enrichInstitutionalPayloadWithCrimeIncidenceVisuals({ ...authorized.project,
    projectId: authorized.projectId, expedienteId: authorized.projectId, personaPerfiladora: authorized.actor.displayName });
  const expected = await buildInstitutionalGenerationModels(payload, authorized.project.nombre || "Expediente", authorized.project.numeroExpediente, authorized.actor, input.generatedAt);
  const same = (a: unknown, b: unknown, code: string) => { if (canonicalSemanticValue(a) !== canonicalSemanticValue(b)) throw new Error(`REPORT_PACKAGE_LINEAGE_MISMATCH:${code}`); };
  same(expected.institutionalReportInput, context.institutionalReportInput, "P2_INPUT");
  same(expected.executiveModel, context.executiveModel, "P4_MODEL");
  same(expected.principalTerritorialMapSpec, context.principalTerritorialMapSpec, "P3_MAP");
  expected.documentModel.visualPlacements = expected.documentModel.visualPlacements.map(placement => ({ ...placement,
    ...(context.documentModel.visualPlacements.find((item: any) => item.visualId === placement.visualId)?.assetState !== undefined
      ? { assetState: context.visualAssetsById[placement.visualId]?.data?.byteLength ? "ASSET_RENDERED" : "ASSET_MISSING" } : {}) }));
  expected.documentModel.semanticIntegrity = reconcileMaterializedDocument(expected.documentModel, context.visualAssetsById);
  const report = renderExecutiveGeointWordDocument(expected.documentModel, { visualAssetsById: context.visualAssetsById, institutionalLogos: context.institutionalLogos });
  expected.documentModel.semanticIntegrity = reconcileDocumentSemanticAudit(expected.documentModel.semanticIntegrity!, report.renderAudit, expected.documentModel.sections, expected.documentModel.visualPlacements);
  same(expected.documentModel, context.documentModel, "P5_DOCUMENT");
  const audit = expected.principalTerritorialMapSpec?.denueRenderAudit;
  const annex = buildExecutiveGeointTechnicalAnnexModel(expected.institutionalReportInput, expected.executiveModel, expected.visualComposition, expected.documentModel, {
    denueContextualSummary: audit ? { contextualUniverseCount: audit.denueAvailableCount, contextualDisplayedCount: audit.denueRenderedCount,
      selectionPolicy: audit.displayPolicy, methodology: "B.4/B.5 governed contextual cartography", limitations: audit.disclosures,
      sourceReferences: audit.sourceReferences, traceabilityIds: audit.traceabilityIds } : null });
  same(annex, context.annexModel, "P5_ANNEX");
  const annexRender = renderExecutiveGeointTechnicalAnnexWordDocument(annex, { visualAssetsById: context.visualAssetsById, institutionalLogos: context.institutionalLogos });
  for (const [blob, rendered, model, kind] of [[input.reportBlob, report, expected.documentModel, "EXECUTIVE_REPORT"], [input.annexBlob, annexRender, annex, "TECHNICAL_ANNEX"]] as const) {
    const actualBytes = new Uint8Array(await blob.arrayBuffer());
    const expectedBytes = await Packer.toBuffer(rendered.document);
    await assertInstitutionalDocxPhysicalParity(actualBytes, expectedBytes);
    const pdf = await renderInstitutionalPdfFromDocx(actualBytes, { kind, projectId: authorized.projectId, numeroExpediente: input.numeroExpediente,
      documentModel: model, semanticIntegrity: expected.documentModel.semanticIntegrity,
      requiredVisualIds: kind === "EXECUTIVE_REPORT" ? expected.documentModel.semanticIntegrity!.requiredVisualIds : institutionalAnnexRequiredVisualIds(annex, expected.documentModel.semanticIntegrity!.requiredVisualIds),
      renderedVisualIds: rendered.renderAudit.renderedVisualIds, missingVisualAssetIds: rendered.renderAudit.missingVisualAssetIds,
      state: "GENERATED", certified: false, published: false });
    if (await sha256Blob(kind === "EXECUTIVE_REPORT" ? input.pdfArtifacts.executive : input.pdfArtifacts.annex) !== pdf.parity.pdfSha256) throw new Error("REPORT_PACKAGE_LINEAGE_MISMATCH:P6_PDF_BYTES");
  }
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
    sourceAuthority: context.sourceAuthority,
    institutionalReportInput: context.institutionalReportInput,
    generatedAt: context.generatedAt,
    executiveModel: context.executiveModel,
    visualComposition: context.visualComposition,
    documentModel: context.documentModel,
    ...(context.principalTerritorialMapSpec ? { principalTerritorialMapSpec: context.principalTerritorialMapSpec } : {}),
    visualAssets: visualAssets.sort((a, b) => a.id.localeCompare(b.id)),
  });
  const canonicalBytes = new TextEncoder().encode(JSON.stringify(canonical));
  return `sha256:${await sha256Bytes(canonicalBytes.buffer as ArrayBuffer)}`;
}

export async function buildInstitutionalMapSpecHash(mapSpec: unknown): Promise<string | null> {
  if (!mapSpec) return null;
  const canonicalBytes = new TextEncoder().encode(JSON.stringify(canonicalize(mapSpec)));
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
    executivePdf: `${safeNumber}_INFORME_v${version}.pdf`,
    technicalAnnexPdf: `${safeNumber}_ANEXO_TECNICO_v${version}.pdf`,
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
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly authorizeGeneration: (projectId: string) => Promise<AuthorizedInstitutionalReportSource> = getAuthorizedInstitutionalReportSource
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
    pdfArtifacts?: { executive: Blob | null; annex: Blob | null; parity: { status: "PASS" | "FAILED"; sourceDocxHashes: string[]; reason?: string } };
  }): Promise<InstitutionalReportPackageManifest> {
    const packageId = input.packageId || createInstitutionalReportPackageId();
    const actor = await runReportPackageStage("RESOLVE_ACTOR", async () => {
      const authorized = await this.authorizeGeneration(input.projectId);
      const authority = input.generationContext?.sourceAuthority;
      if (authorized.action !== "GENERATE_REPORT" || authorized.projectId !== input.projectId ||
        authority?.projectId !== input.projectId || authority?.action !== "GENERATE_REPORT" ||
        authority?.sourceFingerprint !== authorized.sourceFingerprint) throw new Error("REPORT_PACKAGE_SOURCE_AUTHORIZATION_REQUIRED");
      if (input.numeroExpediente !== authorized.project.numeroExpediente) throw new Error("REPORT_PACKAGE_IDENTITY_CONFLICT");
      await validateInstitutionalPackageLineage(authorized, input);
      return resolveActor(authorized.actor);
    });
    const [snapshotHash, reportHash, annexHash, mapSpecHash] = await runReportPackageStage(
      "BUILD_SNAPSHOT_HASHES",
      () => Promise.all([
        buildInstitutionalSnapshotHash(input.generationContext),
        sha256Blob(input.reportBlob),
        sha256Blob(input.annexBlob),
        buildInstitutionalMapSpecHash(input.generationContext.principalTerritorialMapSpec),
      ])
    );
    const createdAt = this.now();
    const pdfHashes = input.pdfArtifacts ? await Promise.all([
      input.pdfArtifacts.executive ? sha256Blob(input.pdfArtifacts.executive) : Promise.resolve(""),
      input.pdfArtifacts.annex ? sha256Blob(input.pdfArtifacts.annex) : Promise.resolve(""),
    ]) : null;
    if (input.pdfArtifacts?.parity.status === "PASS" && (input.pdfArtifacts.parity.sourceDocxHashes[0] !== reportHash || input.pdfArtifacts.parity.sourceDocxHashes[1] !== annexHash)) {
      throw new Error("REPORT_PACKAGE_PDF_SOURCE_HASH_MISMATCH");
    }
    let manifest = await runReportPackageStage("RESERVE_PACKAGE", () =>
      this.repository.reserve(input.projectId, packageId, (version) => {
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
            ...(input.pdfArtifacts && pdfHashes ? {
              executivePdf: { kind: "EXECUTIVE_PDF" as const, filename: filenames.executivePdf, storagePath: `${root}/${filenames.executivePdf}`, sha256: pdfHashes[0], sizeBytes: input.pdfArtifacts.executive?.size || 0, state: input.pdfArtifacts.executive ? "PENDING" as const : "FAILED" as const },
              technicalAnnexPdf: { kind: "TECHNICAL_ANNEX_PDF" as const, filename: filenames.technicalAnnexPdf, storagePath: `${root}/${filenames.technicalAnnexPdf}`, sha256: pdfHashes[1], sizeBytes: input.pdfArtifacts.annex?.size || 0, state: input.pdfArtifacts.annex ? "PENDING" as const : "FAILED" as const },
            } : {}),
          },
          formatContract: input.pdfArtifacts ? "DOCX_PDF" : "DOCX_ONLY",
          ...(input.pdfArtifacts ? { pdfParity: input.pdfArtifacts.parity } : {}),
          lineage: {
            contract: input.generationContext.lineage,
            reportSnapshotId: input.generationContext.documentModel?.reportSnapshotId || input.generationContext.institutionalReportInput?.reportSnapshotId || null,
            institutionalReportInputId: input.generationContext.institutionalReportInput?.institutionalReportInputId || null,
            documentModelId: input.generationContext.documentModel?.modelId || null,
          },
          ...(mapSpecHash && input.generationContext.principalTerritorialMapSpec ? {
            cartographicSnapshot: {
              algorithmVersion: input.generationContext.principalTerritorialMapSpec.cartographicScale.algorithmVersion,
              mapSpecHash,
              geographyId: input.generationContext.principalTerritorialMapSpec.technicalMetadata.geographyId,
              geometryType: input.generationContext.principalTerritorialMapSpec.geometryType,
              center: input.generationContext.principalTerritorialMapSpec.viewport.center,
              bounds: input.generationContext.principalTerritorialMapSpec.viewport.bounds ?? null,
              zoom: input.generationContext.principalTerritorialMapSpec.viewport.zoom,
              logicalWidth: input.generationContext.principalTerritorialMapSpec.viewport.logicalWidth,
              logicalHeight: input.generationContext.principalTerritorialMapSpec.viewport.logicalHeight,
              staticMapScale: input.generationContext.principalTerritorialMapSpec.viewport.staticMapScale,
              cartographicScale: input.generationContext.principalTerritorialMapSpec.cartographicScale,
            },
          } : {}),
          failureReason: null,
        };
      })
    );

    if (manifest.snapshotHash !== snapshotHash
      || manifest.artifacts.executiveReport.sha256 !== reportHash
      || manifest.artifacts.technicalAnnex.sha256 !== annexHash
      || (pdfHashes && (manifest.artifacts.executivePdf?.sha256 !== pdfHashes[0] || manifest.artifacts.technicalAnnexPdf?.sha256 !== pdfHashes[1]))
      || (mapSpecHash && manifest.cartographicSnapshot?.mapSpecHash !== mapSpecHash)) {
      throw new Error("REPORT_PACKAGE_IDEMPOTENCY_CONFLICT");
    }
    if (manifest.state === "GENERATED") return manifest;

    try {
      await runReportPackageStage("STORE_EXECUTIVE_REPORT", () =>
        this.storage.storeImmutable(manifest.artifacts.executiveReport.storagePath, input.reportBlob, {
          sha256: reportHash, packageId, version: manifest.version, kind: "EXECUTIVE_REPORT",
        })
      );
      manifest = await runReportPackageStage("SAVE_EXECUTIVE_REPORT_STATE", () =>
        this.repository.saveArtifact(input.projectId, packageId, "executiveReport", { ...manifest.artifacts.executiveReport, state: "STORED" }, this.now())
      );
      await runReportPackageStage("STORE_TECHNICAL_ANNEX", () =>
        this.storage.storeImmutable(manifest.artifacts.technicalAnnex.storagePath, input.annexBlob, {
          sha256: annexHash, packageId, version: manifest.version, kind: "TECHNICAL_ANNEX",
        })
      );
      manifest = await runReportPackageStage("SAVE_TECHNICAL_ANNEX_STATE", () =>
        this.repository.saveArtifact(input.projectId, packageId, "technicalAnnex", { ...manifest.artifacts.technicalAnnex, state: "STORED" }, this.now())
      );
      if (input.pdfArtifacts) {
        if (input.pdfArtifacts.parity.status !== "PASS" || !input.pdfArtifacts.executive || !input.pdfArtifacts.annex) {
          throw new Error("REPORT_PACKAGE_PDF_FAILED:COMPLETE_PRODUCT_NOT_READY");
        }
        for (const [key, blob] of [["executivePdf", input.pdfArtifacts.executive], ["technicalAnnexPdf", input.pdfArtifacts.annex]] as const) {
          const artifact = manifest.artifacts[key]!;
          await this.storage.storeImmutable(artifact.storagePath, blob, { sha256: artifact.sha256, packageId, version: manifest.version, kind: artifact.kind });
          manifest = await this.repository.saveArtifact(input.projectId, packageId, key, { ...artifact, state: "STORED" }, this.now());
        }
      }
      return await runReportPackageStage("MARK_GENERATED", () =>
        this.repository.markGenerated(input.projectId, packageId, this.now())
      );
    } catch (error) {
      for (const key of ["executivePdf", "technicalAnnexPdf"] as const) {
        const artifact = manifest.artifacts[key];
        if (artifact?.state === "PENDING") {
          try { manifest = await this.repository.saveArtifact(input.projectId, packageId, key, { ...artifact, state: "FAILED" }, this.now()); }
          catch { /* The primary failure remains authoritative. */ }
        }
      }
      const primaryError = error instanceof ReportPackageStageError
        ? error
        : toStageError("MARK_GENERATED", error);
      console.info("[REPORT PACKAGE] stage=MARK_FAILED status=START");
      try {
        await this.repository.markFailed(input.projectId, packageId, primaryError.message, this.now());
        console.info("[REPORT PACKAGE] stage=MARK_FAILED status=OK");
      } catch (markFailedError) {
        logStageError(toStageError("MARK_FAILED", markFailedError), true);
      }
      throw primaryError;
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
      runReportPackageStage("DOWNLOAD_EXECUTIVE", () => this.storage.get(manifest.artifacts.executiveReport.storagePath)),
      runReportPackageStage("DOWNLOAD_TECHNICAL_ANNEX", () => this.storage.get(manifest.artifacts.technicalAnnex.storagePath)),
    ]);
    await runReportPackageStage("VERIFY_DOWNLOAD_HASHES", async () => {
      const [executiveReportHash, technicalAnnexHash] = await Promise.all([
        sha256Blob(executiveReport),
        sha256Blob(technicalAnnex),
      ]);
      if (executiveReportHash !== manifest.artifacts.executiveReport.sha256
        || technicalAnnexHash !== manifest.artifacts.technicalAnnex.sha256) {
        throw new Error("REPORT_PACKAGE_INTEGRITY_VIOLATION");
      }
    });
    if (manifest.formatContract !== "DOCX_PDF") return { manifest, executiveReport, technicalAnnex };
    if (!isCompleteInstitutionalReportPackage(manifest)) throw new Error("REPORT_PACKAGE_COMPLETE_PRODUCT_REQUIRED");
    const executivePdf = await this.storage.get(manifest.artifacts.executivePdf!.storagePath);
    const technicalAnnexPdf = await this.storage.get(manifest.artifacts.technicalAnnexPdf!.storagePath);
    const pdfHashes = await Promise.all([sha256Blob(executivePdf), sha256Blob(technicalAnnexPdf)]);
    if (pdfHashes[0] !== manifest.artifacts.executivePdf!.sha256 || pdfHashes[1] !== manifest.artifacts.technicalAnnexPdf!.sha256) {
      throw new Error("REPORT_PACKAGE_INTEGRITY_VIOLATION");
    }
    return { manifest, executiveReport, technicalAnnex, executivePdf, technicalAnnexPdf };
  }
}

export function isCompleteInstitutionalReportPackage(manifest: InstitutionalReportPackageManifest): boolean {
  return manifest.formatContract === "DOCX_PDF" && ["GENERATED", "CERTIFIED", "PUBLISHED"].includes(manifest.state)
    && manifest.pdfParity?.status === "PASS"
    && ["executiveReport", "technicalAnnex", "executivePdf", "technicalAnnexPdf"].every(key => {
      const artifact = manifest.artifacts[key as InstitutionalReportArtifactKey];
      return artifact?.state === "STORED" && /^sha256:[a-f0-9]{64}$/i.test(artifact.sha256) && artifact.sizeBytes > 0;
    })
    && manifest.pdfParity.sourceDocxHashes[0] === manifest.artifacts.executiveReport.sha256
    && manifest.pdfParity.sourceDocxHashes[1] === manifest.artifacts.technicalAnnex.sha256;
}

export const institutionalReportPackageService = new InstitutionalReportPackageService();
