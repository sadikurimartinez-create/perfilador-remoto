import fs from "fs";
import path from "path";

function readPromptFile(fileName: string): string {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), "src/prompts", fileName),
      "utf8"
    );
  } catch (err) {
    console.error(`Error leyendo prompt ${fileName}`, err);
    return "";
  }
}

export function buildSystemPrompt(): string {
  const master = readPromptFile("master-system-prompt.txt");
  const adr = readPromptFile("adr-core.txt");
  const governance = readPromptFile("governance-core.txt");
  const criminologia = readPromptFile("criminologia-ambiental-core.txt");

  return `
${master}

==============================
ADR DEL PERFILADOR
==============================

${adr}

==============================
GOBERNANZA OPERACIONAL
==============================

${governance}

==============================
CRIMINOLOGÍA AMBIENTAL
==============================

${criminologia}
`;
}