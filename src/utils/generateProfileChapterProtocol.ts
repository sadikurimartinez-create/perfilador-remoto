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

type StreamControllerLike = {
  enqueue: (chunk: Uint8Array) => void;
  close: () => void;
};

export function safeGenerateProfileJsonStringify(value: unknown, fallback: unknown = null): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, current) => {
      if (typeof current === "bigint") return current.toString();
      if (current instanceof Error) {
        return {
          name: current.name,
          message: current.message,
        };
      }
      if (current && typeof current === "object") {
        if (seen.has(current)) return "[Circular]";
        seen.add(current);
      }
      return current;
    });
  } catch {
    return JSON.stringify(fallback);
  }
}

export function buildGenerateProfileTerminalJsonSuffix(input: {
  generationStatus: GenerateProfileChapterStatus;
  terminalEvent: GenerateProfileTerminalEvent;
  aiAnalyticalOutput: unknown;
}): string {
  return `","generationStatus":${safeGenerateProfileJsonStringify(input.generationStatus, "INTERNAL_ERROR")},"terminalEvent":${safeGenerateProfileJsonStringify(input.terminalEvent, buildGenerateProfileErrorEvent("INTERNAL_ERROR"))},"aiAnalyticalOutput":${safeGenerateProfileJsonStringify(input.aiAnalyticalOutput, null)}}`;
}

export function createGenerateProfileStreamJsonFinalizer(
  controller: StreamControllerLike,
  encoder = new TextEncoder()
) {
  let closed = false;
  let opened = false;
  let finalized = false;

  const enqueueRaw = (raw: string) => {
    if (closed) return false;
    controller.enqueue(encoder.encode(raw));
    return true;
  };

  const closeOnce = () => {
    if (closed) return false;
    closed = true;
    try {
      controller.close();
    } catch {}
    return true;
  };

  return {
    open(meta: unknown) {
      if (opened || closed) return false;
      const metaPart = safeGenerateProfileJsonStringify(meta, {});
      enqueueRaw(`{"meta":${metaPart},"markdown":"`);
      opened = true;
      return true;
    },
    writeKeepAlive() {
      return enqueueRaw(" ");
    },
    writeMarkdownChunk(text: string) {
      if (!opened) this.open({});
      const escapedText = JSON.stringify(text).slice(1, -1);
      return enqueueRaw(escapedText);
    },
    finalize(input: {
      generationStatus: GenerateProfileChapterStatus;
      terminalEvent: GenerateProfileTerminalEvent;
      aiAnalyticalOutput: unknown;
    }) {
      if (finalized) return false;
      finalized = true;
      try {
        if (!opened) {
          enqueueRaw(
            `{"meta":{},"markdown":""${buildGenerateProfileTerminalJsonSuffix(input).slice(1)}`
          );
        } else {
          enqueueRaw(buildGenerateProfileTerminalJsonSuffix(input));
        }
      } catch {
        // If the transport is already closed by the runtime, only prevent double-close/enqueue.
      } finally {
        closeOnce();
      }
      return true;
    },
    getState() {
      return { closed, opened, finalized };
    },
  };
}

export const GENERATE_PROFILE_PROVIDER_MAX_ATTEMPTS = 3;

export function shouldRetryGenerateProfileProviderHttpStatus(
  status: number,
  attempt: number,
  maxAttempts: number = GENERATE_PROFILE_PROVIDER_MAX_ATTEMPTS,
): boolean {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt >= maxAttempts) {
    return false;
  }

  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export function getGenerateProfileProviderRetryDelayMs(attempt: number): number {
  if (attempt <= 1) return 1000;
  return 2000;
}
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
