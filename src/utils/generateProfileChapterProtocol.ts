export type GenerateProfileChapterStatus =
  | "GENERATED"
  | "EMPTY_VALID"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "AUTH_ERROR"
  | "INVALID_PROVIDER_RESPONSE"
  | "INTERNAL_ERROR";

export type GenerateProfileTerminalEvent =
  | {
      type: "COMPLETE";
      status: "GENERATED" | "EMPTY_VALID";
    }
  | {
      type: "ERROR";
      status: Exclude<GenerateProfileChapterStatus, "GENERATED" | "EMPTY_VALID">;
      message: string;
    };

export const GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE =
  "No fue posible generar el capítulo con el proveedor de inteligencia artificial. El informe no incorporó contenido parcial.";

const ERROR_MARKER = "[Error de generación:";

export function classifyGenerateProfileProviderError(error: unknown): Exclude<GenerateProfileChapterStatus, "GENERATED" | "EMPTY_VALID"> {
  const raw = error instanceof Error ? error.message : String(error || "");
  const message = raw.toLowerCase();

  if (message.includes("429") || message.includes("quota") || message.includes("rate limit")) {
    return "RATE_LIMITED";
  }
  if (message.includes("timeout") || message.includes("abort")) {
    return "TIMEOUT";
  }
  if (message.includes("401") || message.includes("403") || message.includes("unauthorized") || message.includes("auth")) {
    return "AUTH_ERROR";
  }
  if (message.includes("no text") || message.includes("invalid") || message.includes("incompleta") || message.includes("empty")) {
    return "INVALID_PROVIDER_RESPONSE";
  }
  return "PROVIDER_ERROR";
}

export function buildGenerateProfileCompleteEvent(markdown: unknown): GenerateProfileTerminalEvent {
  const text = typeof markdown === "string" ? markdown : "";
  return {
    type: "COMPLETE",
    status: text.trim() ? "GENERATED" : "EMPTY_VALID",
  };
}

export function buildGenerateProfileErrorEvent(
  status: Exclude<GenerateProfileChapterStatus, "GENERATED" | "EMPTY_VALID">,
): GenerateProfileTerminalEvent {
  return {
    type: "ERROR",
    status,
    message: GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE,
  };
}

export function assertGenerateProfileChapterAccepted(payload: any): string {
  const markdown = typeof payload?.markdown === "string" ? payload.markdown : "";
  const terminal = payload?.terminalEvent;
  const status = payload?.generationStatus || terminal?.status;

  if (markdown.includes(ERROR_MARKER)) {
    throw new Error(GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE);
  }

  if (!terminal || terminal.type !== "COMPLETE" || (status !== "GENERATED" && status !== "EMPTY_VALID")) {
    throw new Error(
      typeof terminal?.message === "string" && terminal.message
        ? terminal.message
        : GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE
    );
  }

  return markdown;
}
