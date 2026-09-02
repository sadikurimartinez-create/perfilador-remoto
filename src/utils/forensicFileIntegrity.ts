export type ForensicHashStatus =
  | "REAL_FILE_HASH"
  | "HASH_UNAVAILABLE"
  | "HASH_PENDING"
  | "HASH_MISMATCH"
  | "DUPLICATE_CONTENT"
  | "UNVERIFIED_CONTENT"
  | "LEGACY_UNVERIFIED";

export type ForensicHashSource =
  | "COMPUTED_FROM_BYTES"
  | "PROVIDER_CHECKSUM"
  | "LEGACY_UNVERIFIED"
  | "UNAVAILABLE";

export type MimeIntegrityStatus =
  | "MIME_MATCH"
  | "MIME_MISMATCH"
  | "MIME_UNVERIFIED";

export interface ForensicFileIntegrity {
  rawSha256: string | null;
  hashAlgorithm: "SHA-256" | null;
  hashStatus: ForensicHashStatus;
  hashComputedAt: string | null;
  hashSource: ForensicHashSource;
  providerChecksum?: string | null;
  providerChecksumAlgorithm?: string | null;
  fileId?: string | null;
  duplicateCandidate?: boolean;
  duplicateOfSha256?: string | null;
  mimeStatus: MimeIntegrityStatus;
  declaredMimeType?: string | null;
  detectedMimeType?: string | null;
  fileExtension?: string | null;
}

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

export function isValidSha256Hex(value: string | null | undefined): value is string {
  return typeof value === "string" && SHA256_HEX_RE.test(value);
}

function toUint8Array(bytes: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeSha256FromBytes(bytes: ArrayBuffer | ArrayBufferView): Promise<string> {
  const input = toUint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return bytesToHex(digest);
}

function extensionOf(fileName?: string | null): string | null {
  if (!fileName || !fileName.includes(".")) return null;
  const ext = fileName.split(".").pop()?.trim().toLowerCase();
  return ext ? `.${ext}` : null;
}

export function detectMimeFromMagicBytes(bytes?: ArrayBuffer | ArrayBufferView | null): string | null {
  if (!bytes) return null;
  const b = toUint8Array(bytes);
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6) {
    const sig = String.fromCharCode(...b.slice(0, 6));
    if (sig === "GIF87a" || sig === "GIF89a") return "image/gif";
  }
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "application/zip";
  return null;
}

export function evaluateMimeIntegrity(input: {
  declaredMimeType?: string | null;
  fileName?: string | null;
  bytes?: ArrayBuffer | ArrayBufferView | null;
}): Pick<ForensicFileIntegrity, "mimeStatus" | "declaredMimeType" | "detectedMimeType" | "fileExtension"> {
  const declaredMimeType = input.declaredMimeType || null;
  const detectedMimeType = detectMimeFromMagicBytes(input.bytes);
  const mimeStatus = detectedMimeType && declaredMimeType
    ? (detectedMimeType === declaredMimeType ? "MIME_MATCH" : "MIME_MISMATCH")
    : "MIME_UNVERIFIED";

  return {
    mimeStatus,
    declaredMimeType,
    detectedMimeType,
    fileExtension: extensionOf(input.fileName),
  };
}

export function createHashUnavailableIntegrity(input: {
  status?: Extract<ForensicHashStatus, "HASH_UNAVAILABLE" | "HASH_PENDING" | "HASH_MISMATCH" | "LEGACY_UNVERIFIED" | "UNVERIFIED_CONTENT">;
  providerChecksum?: string | null;
  providerChecksumAlgorithm?: string | null;
  fileId?: string | null;
  declaredMimeType?: string | null;
  fileName?: string | null;
  bytes?: ArrayBuffer | ArrayBufferView | null;
} = {}): ForensicFileIntegrity {
  return {
    rawSha256: null,
    hashAlgorithm: null,
    hashStatus: input.status ?? "HASH_UNAVAILABLE",
    hashComputedAt: null,
    hashSource: input.status === "LEGACY_UNVERIFIED" ? "LEGACY_UNVERIFIED" : "UNAVAILABLE",
    providerChecksum: input.providerChecksum ?? null,
    providerChecksumAlgorithm: input.providerChecksumAlgorithm ?? null,
    fileId: input.fileId ?? null,
    duplicateCandidate: false,
    duplicateOfSha256: null,
    ...evaluateMimeIntegrity(input),
  };
}

export function createComputedFileIntegrity(input: {
  rawSha256: string;
  computedAt?: string;
  providerChecksum?: string | null;
  providerChecksumAlgorithm?: string | null;
  fileId?: string | null;
  declaredMimeType?: string | null;
  fileName?: string | null;
  bytes?: ArrayBuffer | ArrayBufferView | null;
}): ForensicFileIntegrity {
  if (!isValidSha256Hex(input.rawSha256)) {
    return createHashUnavailableIntegrity({
      status: "HASH_MISMATCH",
      providerChecksum: input.providerChecksum,
      providerChecksumAlgorithm: input.providerChecksumAlgorithm,
      fileId: input.fileId,
      declaredMimeType: input.declaredMimeType,
      fileName: input.fileName,
      bytes: input.bytes,
    });
  }

  return {
    rawSha256: input.rawSha256.toLowerCase(),
    hashAlgorithm: "SHA-256",
    hashStatus: "REAL_FILE_HASH",
    hashComputedAt: input.computedAt ?? new Date().toISOString(),
    hashSource: "COMPUTED_FROM_BYTES",
    providerChecksum: input.providerChecksum ?? null,
    providerChecksumAlgorithm: input.providerChecksumAlgorithm ?? null,
    fileId: input.fileId ?? null,
    duplicateCandidate: false,
    duplicateOfSha256: null,
    ...evaluateMimeIntegrity(input),
  };
}

export function createProvidedSha256Integrity(input: {
  rawSha256: string;
  providerChecksum?: string | null;
  providerChecksumAlgorithm?: string | null;
  fileId?: string | null;
  declaredMimeType?: string | null;
  fileName?: string | null;
}): ForensicFileIntegrity {
  if (!isValidSha256Hex(input.rawSha256)) {
    return createHashUnavailableIntegrity({
      status: "UNVERIFIED_CONTENT",
      providerChecksum: input.providerChecksum,
      providerChecksumAlgorithm: input.providerChecksumAlgorithm,
      fileId: input.fileId,
      declaredMimeType: input.declaredMimeType,
      fileName: input.fileName,
    });
  }

  return {
    rawSha256: input.rawSha256.toLowerCase(),
    hashAlgorithm: "SHA-256",
    hashStatus: "UNVERIFIED_CONTENT",
    hashComputedAt: null,
    hashSource: "LEGACY_UNVERIFIED",
    providerChecksum: input.providerChecksum ?? null,
    providerChecksumAlgorithm: input.providerChecksumAlgorithm ?? null,
    fileId: input.fileId ?? null,
    duplicateCandidate: false,
    duplicateOfSha256: null,
    ...evaluateMimeIntegrity(input),
  };
}

export async function createComputedFileIntegrityFromBytes(input: {
  bytes: ArrayBuffer | ArrayBufferView;
  computedAt?: string;
  providerChecksum?: string | null;
  providerChecksumAlgorithm?: string | null;
  fileId?: string | null;
  declaredMimeType?: string | null;
  fileName?: string | null;
}): Promise<ForensicFileIntegrity> {
  const rawSha256 = await computeSha256FromBytes(input.bytes);
  return createComputedFileIntegrity({ ...input, rawSha256 });
}

export function markDuplicateContent(
  integrity: ForensicFileIntegrity,
  existing: Array<ForensicFileIntegrity | null | undefined>
): ForensicFileIntegrity {
  if (!integrity.rawSha256) return integrity;
  const duplicate = existing.find((item) => item?.rawSha256 === integrity.rawSha256);
  if (!duplicate) return integrity;
  return {
    ...integrity,
    hashStatus: "DUPLICATE_CONTENT",
    duplicateCandidate: true,
    duplicateOfSha256: duplicate.rawSha256,
  };
}

export function createLegacyUnverifiedIntegrity(input: {
  providerChecksum?: string | null;
  providerChecksumAlgorithm?: string | null;
  fileId?: string | null;
  declaredMimeType?: string | null;
  fileName?: string | null;
} = {}): ForensicFileIntegrity {
  return createHashUnavailableIntegrity({ ...input, status: "LEGACY_UNVERIFIED" });
}
