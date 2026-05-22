import fs from "fs";
import path from "path";

function readPromptFile(fileName: string): string {
  try {
    // Rutas explícitas para forzar a Vercel a empacar los archivos .txt
    let filePath = "";
    switch (fileName) {
      case "master-system-prompt.txt":
        filePath = path.join(process.cwd(), "src/prompts/master-system-prompt.txt");
        break;
      case "adr-core.txt":
        filePath = path.join(process.cwd(), "src/prompts/adr-core.txt");
        break;
      case "governance-core.txt":
        filePath = path.join(process.cwd(), "src/prompts/governance-core.txt");
        break;
      case "criminologia-ambiental-core.txt":
        filePath = path.join(process.cwd(), "src/prompts/criminologia-ambiental-core.txt");
        break;
      default:
        filePath = path.join(process.cwd(), "src/prompts", fileName);
    }
    return fs.readFileSync(filePath, "utf8");
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