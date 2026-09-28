import { getVercelOidcToken } from "@vercel/oidc";
import { IdentityPoolClient } from "google-auth-library";
import { createHash } from "node:crypto";

const DEFAULT_BUCKET = "perfilador-remoto-pandillas-dataset";
const DEFAULT_OBJECT = "INVENTARIO PANDILLAS.xlsx";
const DEFAULT_SHA256 =
  "D4584B334624748C0F4D31592FFFAD2DD2507163102B18882094C613DECF0D62";

const SUBJECT_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:jwt";
const STS_TOKEN_URL = "https://sts.googleapis.com/v1/token";

export type PandillasDatasetProvenance = {
  datasetAvailable: boolean;
  source: "GCS_PRIVATE_BUCKET";
  bucket: string;
  object: string;
  version: string;
  hash: string | null;
  expectedHash: string;
  loadedAt: string;
  recordCount: number | null;
};

export type LoadedPandillasDataset = {
  buffer: Buffer;
  provenance: PandillasDatasetProvenance;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`PANDILLAS_DATASET_CONFIG_MISSING:${name}`);
  }

  return value;
}

function buildWorkloadAudience(): string {
  const projectNumber = requiredEnv("GCP_PROJECT_NUMBER");
  const poolId = requiredEnv("GCP_WORKLOAD_IDENTITY_POOL_ID");
  const providerId = requiredEnv("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID");

  return `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
}

function buildServiceAccountImpersonationUrl(): string {
  const serviceAccountEmail = requiredEnv("GCP_SERVICE_ACCOUNT_EMAIL");

  return `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(
    serviceAccountEmail
  )}:generateAccessToken`;
}

class VercelOidcSubjectTokenSupplier {
  async getSubjectToken(): Promise<string> {
    const token = await getVercelOidcToken();

    if (!token || !token.trim()) {
      throw new Error("PANDILLAS_DATASET_OIDC_TOKEN_UNAVAILABLE");
    }

    return token;
  }
}

async function getFederatedAccessToken(): Promise<string> {
  const audience = buildWorkloadAudience();

  const authClient = new IdentityPoolClient({
    audience,
    subject_token_type: SUBJECT_TOKEN_TYPE,
    token_url: STS_TOKEN_URL,
    subject_token_supplier: new VercelOidcSubjectTokenSupplier(),
    service_account_impersonation_url: buildServiceAccountImpersonationUrl(),
  });

  const tokenResponse = await authClient.getAccessToken();
  const token = tokenResponse?.token;

  if (!token) {
    throw new Error("PANDILLAS_DATASET_GOOGLE_TOKEN_UNAVAILABLE");
  }

  return token;
}

function buildStorageMediaUrl(bucket: string, object: string): string {
  return (
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}` +
    `/o/${encodeURIComponent(object)}?alt=media`
  );
}

export async function loadPandillasDatasetBuffer(): Promise<LoadedPandillasDataset> {
  const bucket = process.env.PANDILLAS_DATASET_BUCKET?.trim() || DEFAULT_BUCKET;
  const object = process.env.PANDILLAS_DATASET_OBJECT?.trim() || DEFAULT_OBJECT;

  const token = await getFederatedAccessToken();

  const response = await fetch(buildStorageMediaUrl(bucket, object), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const diagnostic = await response.text().catch(() => "");

    throw new Error(
      `PANDILLAS_DATASET_GCS_READ_FAILED:${response.status}:${diagnostic.slice(0, 300)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new Error("PANDILLAS_DATASET_EMPTY_OBJECT");
  }

  const expectedHash = (
    process.env.PANDILLAS_DATASET_SHA256?.trim() || DEFAULT_SHA256
  ).toUpperCase();

  const actualHash = createHash("sha256")
    .update(buffer)
    .digest("hex")
    .toUpperCase();

  if (actualHash !== expectedHash) {
    throw new Error(
      `PANDILLAS_DATASET_INTEGRITY_MISMATCH:expected=${expectedHash}:actual=${actualHash}`
    );
  }

  return {
    buffer,
    provenance: {
      datasetAvailable: true,
      source: "GCS_PRIVATE_BUCKET",
      bucket,
      object,
      version:
        process.env.PANDILLAS_DATASET_VERSION?.trim() ||
        "INVENTARIO_PANDILLAS_R6.2",
      hash: actualHash,
      expectedHash,
      loadedAt: new Date().toISOString(),
      recordCount: null,
    },
  };
}