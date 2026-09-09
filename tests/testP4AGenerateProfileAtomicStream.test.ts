import fs from "node:fs";
import path from "node:path";
import {
  GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE,
  assertGenerateProfileChapterAccepted,
  buildGenerateProfileCompleteEvent,
  buildGenerateProfileErrorEvent,
  createGenerateProfileStreamJsonFinalizer,
  safeGenerateProfileJsonStringify,
} from "../src/utils/generateProfileChapterProtocol";

function createMockController(failOnEnqueueAt?: number) {
  const chunks: Uint8Array[] = [];
  let enqueueCount = 0;
  let closeCount = 0;
  const decoder = new TextDecoder();

  return {
    controller: {
      enqueue(chunk: Uint8Array) {
        enqueueCount++;
        if (failOnEnqueueAt === enqueueCount) {
          throw new Error("MOCK_ENQUEUE_FAILURE");
        }
        chunks.push(chunk);
      },
      close() {
        closeCount++;
      },
    },
    body() {
      return chunks.map((chunk) => decoder.decode(chunk)).join("");
    },
    closeCount() {
      return closeCount;
    },
    enqueueCount() {
      return enqueueCount;
    },
  };
}

describe("P4-A generate-profile atomic stream finalizer", () => {
  test("T1 success normal produce JSON valido y COMPLETE", () => {
    const mock = createMockController();
    const finalizer = createGenerateProfileStreamJsonFinalizer(mock.controller);

    finalizer.open({ riskLevel: "medio" });
    finalizer.writeMarkdownChunk("## 1\nContenido institucional.");
    finalizer.finalize({
      generationStatus: "GENERATED",
      terminalEvent: buildGenerateProfileCompleteEvent("## 1"),
      aiAnalyticalOutput: { promptId: "generate-profile:chapter-1" },
    });

    const parsed = JSON.parse(mock.body());
    expect(parsed.terminalEvent.type).toBe("COMPLETE");
    expect(parsed.generationStatus).toBe("GENERATED");
    expect(assertGenerateProfileChapterAccepted(parsed)).toContain("Contenido institucional");
  });

  test("T2 provider falla antes de primer chunk y produce ERROR gobernado", () => {
    const mock = createMockController();
    const finalizer = createGenerateProfileStreamJsonFinalizer(mock.controller);

    finalizer.open({ riskLevel: "medio" });
    finalizer.finalize({
      generationStatus: "PROVIDER_ERROR",
      terminalEvent: buildGenerateProfileErrorEvent("PROVIDER_ERROR"),
      aiAnalyticalOutput: { limitations: ["GENERATION_ERROR:PROVIDER_ERROR"] },
    });

    const parsed = JSON.parse(mock.body());
    expect(parsed.markdown).toBe("");
    expect(parsed.terminalEvent.type).toBe("ERROR");
    expect(() => assertGenerateProfileChapterAccepted(parsed)).toThrow(GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE);
  });

  test("T3 provider falla despues de chunk parcial y el parcial no se acepta", () => {
    const mock = createMockController();
    const finalizer = createGenerateProfileStreamJsonFinalizer(mock.controller);

    finalizer.open({ riskLevel: "medio" });
    finalizer.writeMarkdownChunk("## parcial\nTexto incompleto");
    finalizer.finalize({
      generationStatus: "TIMEOUT",
      terminalEvent: buildGenerateProfileErrorEvent("TIMEOUT"),
      aiAnalyticalOutput: { limitations: ["GENERATION_ERROR:TIMEOUT"] },
    });

    const parsed = JSON.parse(mock.body());
    expect(parsed.markdown).toContain("Texto incompleto");
    expect(parsed.terminalEvent.type).toBe("ERROR");
    expect(() => assertGenerateProfileChapterAccepted(parsed)).toThrow(GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE);
  });

  test("T4 excepcion construyendo metaPart queda contenida por serializacion segura", () => {
    const circular: any = { riskLevel: "medio" };
    circular.self = circular;
    const mock = createMockController();
    const finalizer = createGenerateProfileStreamJsonFinalizer(mock.controller);

    finalizer.open(circular);
    finalizer.finalize({
      generationStatus: "GENERATED",
      terminalEvent: buildGenerateProfileCompleteEvent("ok"),
      aiAnalyticalOutput: { ok: true },
    });

    const parsed = JSON.parse(mock.body());
    expect(parsed.meta.self).toBe("[Circular]");
  });

  test("T5 excepcion construyendo outputTrace no trunca JSON", () => {
    const circular: any = { promptId: "generate-profile:chapter-1" };
    circular.self = circular;
    const mock = createMockController();
    const finalizer = createGenerateProfileStreamJsonFinalizer(mock.controller);

    finalizer.open({});
    finalizer.writeMarkdownChunk("parcial");
    finalizer.finalize({
      generationStatus: "INTERNAL_ERROR",
      terminalEvent: buildGenerateProfileErrorEvent("INTERNAL_ERROR"),
      aiAnalyticalOutput: circular,
    });

    const parsed = JSON.parse(mock.body());
    expect(parsed.aiAnalyticalOutput.self).toBe("[Circular]");
    expect(parsed.terminalEvent.type).toBe("ERROR");
  });

  test("T6 controller enqueue falla sin doble cierre", () => {
    const mock = createMockController(2);
    const finalizer = createGenerateProfileStreamJsonFinalizer(mock.controller);

    finalizer.open({});
    finalizer.finalize({
      generationStatus: "INTERNAL_ERROR",
      terminalEvent: buildGenerateProfileErrorEvent("INTERNAL_ERROR"),
      aiAnalyticalOutput: null,
    });
    finalizer.finalize({
      generationStatus: "INTERNAL_ERROR",
      terminalEvent: buildGenerateProfileErrorEvent("INTERNAL_ERROR"),
      aiAnalyticalOutput: null,
    });

    expect(mock.closeCount()).toBe(1);
    expect(finalizer.getState().finalized).toBe(true);
  });

  test("T7 terminal finalizer solo se ejecuta una vez", () => {
    const mock = createMockController();
    const finalizer = createGenerateProfileStreamJsonFinalizer(mock.controller);

    finalizer.open({});
    expect(finalizer.finalize({
      generationStatus: "PROVIDER_ERROR",
      terminalEvent: buildGenerateProfileErrorEvent("PROVIDER_ERROR"),
      aiAnalyticalOutput: null,
    })).toBe(true);
    expect(finalizer.finalize({
      generationStatus: "PROVIDER_ERROR",
      terminalEvent: buildGenerateProfileErrorEvent("PROVIDER_ERROR"),
      aiAnalyticalOutput: null,
    })).toBe(false);
    expect(mock.closeCount()).toBe(1);
  });

  test("T8 JSON.parse del body completo no falla en rutas terminales manejadas", () => {
    const statuses = ["GENERATED", "PROVIDER_ERROR", "TIMEOUT", "INVALID_PROVIDER_RESPONSE"] as const;

    for (const status of statuses) {
      const mock = createMockController();
      const finalizer = createGenerateProfileStreamJsonFinalizer(mock.controller);
      finalizer.open({ status });
      finalizer.writeMarkdownChunk(status === "GENERATED" ? "ok" : "parcial");
      finalizer.finalize({
        generationStatus: status,
        terminalEvent: status === "GENERATED"
          ? buildGenerateProfileCompleteEvent("ok")
          : buildGenerateProfileErrorEvent(status),
        aiAnalyticalOutput: { status },
      });

      expect(() => JSON.parse(mock.body())).not.toThrow();
    }
  });

  test("T9 cliente P3-B sigue rechazando terminalEvent ERROR", () => {
    expect(() => assertGenerateProfileChapterAccepted({
      markdown: "## parcial",
      generationStatus: "PROVIDER_ERROR",
      terminalEvent: buildGenerateProfileErrorEvent("PROVIDER_ERROR"),
    })).toThrow(GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE);
  });

  test("T10 no reaparece marcador Error de generacion", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/generate-profile/route.ts"), "utf8");

    expect(source).not.toContain("[Error de generación:");
    expect(source).not.toContain("accumulatedText += \"\\n\\n[Error de generación:");
  });

  test("T11 error tecnico no se incorpora a markdown", () => {
    const mock = createMockController();
    const finalizer = createGenerateProfileStreamJsonFinalizer(mock.controller);

    finalizer.open({});
    finalizer.finalize({
      generationStatus: "PROVIDER_ERROR",
      terminalEvent: buildGenerateProfileErrorEvent("PROVIDER_ERROR"),
      aiAnalyticalOutput: { message: "stacktrace token=secret" },
    });

    const parsed = JSON.parse(mock.body());
    expect(parsed.markdown).toBe("");
    expect(parsed.markdown).not.toContain("stacktrace");
    expect(parsed.markdown).not.toContain("secret");
  });

  test("T12 no se filtran stack ni secrets en terminalEvent", () => {
    const event = buildGenerateProfileErrorEvent("PROVIDER_ERROR");
    const serialized = safeGenerateProfileJsonStringify(event);

    expect(serialized).not.toContain("secret-token");
    expect(serialized.toLowerCase()).not.toContain("stacktrace");
    expect(event.message).toBe(GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE);
  });

  test("route usa finalizador atomico y no concatena cierre terminal manual", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/generate-profile/route.ts"), "utf8");

    expect(source).toContain("createGenerateProfileStreamJsonFinalizer");
    expect(source).toContain("finalizer.finalize({");
    expect(source).not.toContain("`\",\"generationStatus\":${JSON.stringify(generationStatus)}");
  });
});
