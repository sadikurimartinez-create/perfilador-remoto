export type DynamicModuleFailureType =
  | "ASSET_HTTP_OR_NETWORK_FAILURE"
  | "ASSET_LOAD_TIMEOUT"
  | "WEBPACK_CHUNK_REGISTRATION_FAILURE"
  | "MODULE_INITIALIZATION_OR_RENDER_FAILURE";

export function classifyDynamicModuleFailure(error: unknown): {
  failureType: DynamicModuleFailureType;
  errorName: string;
  requestPath: string | null;
} {
  const candidate = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const errorName = typeof candidate.name === "string" ? candidate.name : "Error";
  const errorType = typeof candidate.type === "string" ? candidate.type : "";
  const request = typeof candidate.request === "string" ? candidate.request : "";
  let requestPath: string | null = null;

  if (request) {
    try {
      requestPath = new URL(request, "https://runtime.invalid").pathname;
    } catch {
      requestPath = null;
    }
  }

  let failureType: DynamicModuleFailureType = "MODULE_INITIALIZATION_OR_RENDER_FAILURE";
  if (errorName === "ChunkLoadError" && errorType === "missing") {
    failureType = "WEBPACK_CHUNK_REGISTRATION_FAILURE";
  } else if (errorName === "ChunkLoadError" && errorType === "timeout") {
    failureType = "ASSET_LOAD_TIMEOUT";
  } else if (errorName === "ChunkLoadError") {
    failureType = "ASSET_HTTP_OR_NETWORK_FAILURE";
  }

  return { failureType, errorName, requestPath };
}
