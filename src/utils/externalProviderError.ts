export type ExternalFailureReason =
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "TLS_CERTIFICATE_ERROR"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "PROVIDER_UNAVAILABLE"
  | "UNKNOWN_FAILURE";

export interface SanitizedProviderFailure {
  reason: ExternalFailureReason;
  message: string;
  httpStatus?: number;
  technicalCode?: string;
  nativeErrorCode?: string;
  nativeCauseCode?: string;
}

const PUBLIC_MESSAGES: Record<ExternalFailureReason, string> = {
  AUTH_FAILED: "El proveedor rechazó las credenciales configuradas.",
  RATE_LIMITED: "El proveedor alcanzó su límite temporal de consultas.",
  INVALID_REQUEST: "El proveedor rechazó los parámetros de la consulta.",
  HTTP_ERROR: "El proveedor devolvió un error HTTP.",
  NETWORK_ERROR: "No fue posible establecer una conexión segura con el proveedor.",
  TLS_CERTIFICATE_ERROR: "El certificado TLS presentado por el proveedor no pudo validarse.",
  TIMEOUT: "El proveedor excedió el tiempo máximo de respuesta.",
  INVALID_RESPONSE: "El proveedor devolvió una respuesta con formato inesperado.",
  PROVIDER_UNAVAILABLE: "El proveedor está temporalmente no disponible.",
  UNKNOWN_FAILURE: "El proveedor no pudo completar la adquisición.",
};

const TLS_ERROR_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

const SAFE_NETWORK_CODES: Record<string, string> = {
  ECONNABORTED: "REQUEST_TIMEOUT",
  ETIMEDOUT: "REQUEST_TIMEOUT",
  UND_ERR_CONNECT_TIMEOUT: "REQUEST_TIMEOUT",
  ECONNRESET: "CONNECTION_RESET",
  ECONNREFUSED: "CONNECTION_REFUSED",
  EHOSTUNREACH: "HOST_UNREACHABLE",
  ENETUNREACH: "NETWORK_UNREACHABLE",
  ENOTFOUND: "DNS_ERROR",
  EAI_AGAIN: "DNS_TEMPORARY_ERROR",
};

function sanitizedNativeCode(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.:-]{1,96}$/.test(value)) return undefined;
  return value;
}

export class ExternalProviderError extends Error {
  readonly failure: SanitizedProviderFailure;

  constructor(failure: Omit<SanitizedProviderFailure, "message"> & { message?: string }) {
    const normalized = { ...failure, message: failure.message ?? PUBLIC_MESSAGES[failure.reason] };
    super(normalized.message);
    this.name = "ExternalProviderError";
    this.failure = normalized;
  }
}

export function classifyHttpFailure(status: number): ExternalProviderError {
  if (status === 401 || status === 403) {
    return new ExternalProviderError({ reason: "AUTH_FAILED", httpStatus: status, technicalCode: `HTTP_${status}` });
  }
  if (status === 429) {
    return new ExternalProviderError({ reason: "RATE_LIMITED", httpStatus: status, technicalCode: "HTTP_429" });
  }
  if (status === 400 || status === 404 || status === 422) {
    return new ExternalProviderError({ reason: "INVALID_REQUEST", httpStatus: status, technicalCode: `HTTP_${status}` });
  }
  if (status >= 500) {
    return new ExternalProviderError({ reason: "PROVIDER_UNAVAILABLE", httpStatus: status, technicalCode: `HTTP_${status}` });
  }
  return new ExternalProviderError({ reason: "HTTP_ERROR", httpStatus: status, technicalCode: `HTTP_${status}` });
}

export function classifyExternalFailure(error: unknown): ExternalProviderError {
  if (error instanceof ExternalProviderError) return error;

  const candidate = error as {
    code?: string;
    name?: string;
    response?: { status?: number };
    cause?: { code?: string; name?: string };
  } | null;
  const nativeErrorCode = sanitizedNativeCode(candidate?.code);
  const nativeCauseCode = sanitizedNativeCode(candidate?.cause?.code);
  const status = Number(candidate?.response?.status);
  if (Number.isFinite(status) && status > 0) {
    const httpFailure = classifyHttpFailure(status).failure;
    return new ExternalProviderError({ ...httpFailure, nativeErrorCode, nativeCauseCode });
  }

  const nativeCodes = [nativeErrorCode, nativeCauseCode].filter((code): code is string => Boolean(code));
  if (nativeCodes.some((code) => TLS_ERROR_CODES.has(code))) {
    return new ExternalProviderError({
      reason: "TLS_CERTIFICATE_ERROR",
      technicalCode: "TLS_CERTIFICATE_ERROR",
      nativeErrorCode,
      nativeCauseCode,
    });
  }
  const networkCode = nativeCodes.find((code) => SAFE_NETWORK_CODES[code]);
  const technicalCode = networkCode ? SAFE_NETWORK_CODES[networkCode] : undefined;
  if (technicalCode === "REQUEST_TIMEOUT" || candidate?.name === "TimeoutError") {
    return new ExternalProviderError({
      reason: "TIMEOUT",
      technicalCode: "REQUEST_TIMEOUT",
      nativeErrorCode,
      nativeCauseCode,
    });
  }
  if (technicalCode) {
    return new ExternalProviderError({ reason: "NETWORK_ERROR", technicalCode, nativeErrorCode, nativeCauseCode });
  }
  if (candidate?.name === "AbortError" || nativeErrorCode === "ABORT_ERR") {
    return new ExternalProviderError({
      reason: "TIMEOUT",
      technicalCode: "REQUEST_TIMEOUT",
      nativeErrorCode,
      nativeCauseCode,
    });
  }
  return new ExternalProviderError({
    reason: "UNKNOWN_FAILURE",
    technicalCode: "UNCLASSIFIED_PROVIDER_ERROR",
    nativeErrorCode,
    nativeCauseCode,
  });
}

export function invalidProviderResponse(): ExternalProviderError {
  return new ExternalProviderError({ reason: "INVALID_RESPONSE", technicalCode: "INVALID_RESPONSE_SCHEMA" });
}
