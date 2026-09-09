import fs from "fs";
import path from "path";
import {
  GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE,
  assertGenerateProfileChapterAccepted,
  buildGenerateProfileCompleteEvent,
  buildGenerateProfileErrorEvent,
  classifyGenerateProfileProviderError,
} from "../src/utils/generateProfileChapterProtocol";
import { shouldRetryGenerateProfileRequest } from "../src/utils/generateProfileAuthPolicy";

const routeSource = () =>
  fs.readFileSync(path.join(process.cwd(), "src/app/api/generate-profile/route.ts"), "utf8");

const photoAlbumSource = () =>
  fs.readFileSync(path.join(process.cwd(), "src/components/PhotoAlbum.tsx"), "utf8");

describe("P3-B generate-profile fail-closed chapter protocol", () => {
  test("T1 provider genera capitulo valido y SUCCESS terminal acepta markdown", () => {
    const markdown = "## 1. CAPITULO\nContenido institucional.";
    const payload = {
      markdown,
      generationStatus: "GENERATED",
      terminalEvent: buildGenerateProfileCompleteEvent(markdown),
    };

    expect(assertGenerateProfileChapterAccepted(payload)).toBe(markdown);
  });

  test("T2 provider lanza antes de iniciar stream y el capitulo no se acepta", () => {
    const status = classifyGenerateProfileProviderError(new Error("Vertex initialization failed"));
    const payload = {
      markdown: "",
      generationStatus: status,
      terminalEvent: buildGenerateProfileErrorEvent(status),
    };

    expect(status).toBe("PROVIDER_ERROR");
    expect(() => assertGenerateProfileChapterAccepted(payload)).toThrow(
      GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE
    );
  });

  test("T3 provider falla despues de contenido parcial y el parcial no se acepta", () => {
    const status = classifyGenerateProfileProviderError(new Error("Timeout en stream"));
    const payload = {
      markdown: "## parcial\nTexto incompleto",
      generationStatus: status,
      terminalEvent: buildGenerateProfileErrorEvent(status),
    };

    expect(status).toBe("TIMEOUT");
    expect(() => assertGenerateProfileChapterAccepted(payload)).toThrow(
      GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE
    );
  });

  test("T4 marcador Error de generacion nunca se interpreta como success", () => {
    const payload = {
      markdown: "## 1\n[Error de generación: quota exceeded]",
      generationStatus: "GENERATED",
      terminalEvent: buildGenerateProfileCompleteEvent("## 1"),
    };

    expect(() => assertGenerateProfileChapterAccepted(payload)).toThrow(
      GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE
    );
  });

  test("T5 429 permanece retryable", () => {
    expect(shouldRetryGenerateProfileRequest(429, 1, 3)).toBe(true);
  });

  test("T6 500 y 503 son retryable hasta el limite", () => {
    expect(shouldRetryGenerateProfileRequest(500, 1, 3)).toBe(true);
    expect(shouldRetryGenerateProfileRequest(503, 2, 3)).toBe(true);
    expect(shouldRetryGenerateProfileRequest(503, 3, 3)).toBe(false);
  });

  test("T7 401 no es retryable", () => {
    expect(shouldRetryGenerateProfileRequest(401, 1, 3)).toBe(false);
  });

  test("T8 422 no es retryable", () => {
    expect(shouldRetryGenerateProfileRequest(422, 1, 3)).toBe(false);
  });

  test("T9 tras error IA no se ejecuta siguiente paso como capitulo exitoso", () => {
    const nextStep = jest.fn();
    const consumeChapter = (payload: any) => {
      const markdown = assertGenerateProfileChapterAccepted(payload);
      nextStep(markdown);
    };

    expect(() =>
      consumeChapter({
        markdown: "## parcial",
        generationStatus: "PROVIDER_ERROR",
        terminalEvent: buildGenerateProfileErrorEvent("PROVIDER_ERROR"),
      })
    ).toThrow(GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE);
    expect(nextStep).not.toHaveBeenCalled();
  });

  test("T10 error tecnico no entra como markdown institucional aceptado", () => {
    const status = classifyGenerateProfileProviderError(new Error("Gemini REST API returned 503: stacktrace token=secret"));
    const payload = {
      markdown: "",
      generationStatus: status,
      terminalEvent: buildGenerateProfileErrorEvent(status),
    };

    expect(() => assertGenerateProfileChapterAccepted(payload)).toThrow(
      GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE
    );
  });

  test("T11 success solo ocurre con senal terminal inequivoca", () => {
    expect(() =>
      assertGenerateProfileChapterAccepted({
        markdown: "## texto sin terminal",
        generationStatus: "GENERATED",
      })
    ).toThrow(GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE);
  });

  test("T12 no se filtran secretos ni stack al mensaje terminal de error", () => {
    const raw = new Error("stacktrace at line 1 API_KEY=secret-token");
    const status = classifyGenerateProfileProviderError(raw);
    const event = buildGenerateProfileErrorEvent(status);

    expect(event.type).toBe("ERROR");
    expect(event.message).toBe(GENERATE_PROFILE_CHAPTER_ERROR_MESSAGE);
    expect(event.message).not.toContain("secret-token");
    expect(event.message.toLowerCase()).not.toContain("stacktrace");
  });

  test("route emite terminalEvent y no escribe marcador de error en markdown", () => {
    const source = routeSource();

    expect(source).toContain("terminalEvent");
    expect(source).toContain("buildGenerateProfileErrorEvent");
    expect(source).not.toContain("const errorMsg = \"\\\\n\\\\n[Error de generación:");
    expect(source).not.toContain("accumulatedText += \"\\n\\n[Error de generación:");
  });

  test("PhotoAlbum valida el contrato terminal antes de acumular capitulo", () => {
    const source = photoAlbumSource();
    const assertIndex = source.indexOf("assertGenerateProfileChapterAccepted(chapterData)");
    const appendIndex = source.indexOf("finalMarkdown += chunkMarkdown");

    expect(assertIndex).toBeGreaterThan(-1);
    expect(appendIndex).toBeGreaterThan(assertIndex);
    expect(source).toContain("setAiProfile(safeMarkdown)");
    expect(source).toContain("setEditableProfile(safeMarkdown)");
  });
});
