export const GENERATE_PROFILE_SESSION_EXPIRED_MESSAGE =
  "SESIÓN EXPIRADA: vuelva a iniciar sesión para generar el informe institucional.";

export function isGenerateProfileNonRetryableStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 422;
}

export function shouldRetryGenerateProfileRequest(status: number, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false;
  if (isGenerateProfileNonRetryableStatus(status)) return false;
  return status === 429 || status >= 500;
}

export async function assertGenerateProfileServerSession(
  fetcher: typeof fetch = fetch
): Promise<void> {
  const response = await fetcher("/api/auth/me", { cache: "no-store" });
  if (response.ok) return;

  let serverError = "";
  try {
    const payload = await response.json();
    serverError = typeof payload?.error === "string" ? payload.error : "";
  } catch {
    serverError = "";
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(GENERATE_PROFILE_SESSION_EXPIRED_MESSAGE);
  }

  throw new Error(serverError || `No fue posible verificar la sesión activa (${response.status}).`);
}
