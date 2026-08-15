export interface NarrativeBlock {
  type: "TITLE" | "SUBTITLE" | "PARAGRAPH" | "BULLET" | "NUMBERED_LIST" | "ANALYTICAL_BLOCK";
  text: string;
}

export class NarrativeRenderer {
  static buildBlock(type: NarrativeBlock["type"], text: string): NarrativeBlock {
    return { type, text };
  }

  static renderMarkdownToBlocks(markdown: string): NarrativeBlock[] {
    const lines = markdown.split("\n");
    const blocks: NarrativeBlock[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.startsWith("# ")) {
        blocks.push({ type: "TITLE", text: trimmed.slice(2) });
      } else if (trimmed.startsWith("## ")) {
        blocks.push({ type: "SUBTITLE", text: trimmed.slice(3) });
      } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        blocks.push({ type: "BULLET", text: trimmed.slice(2) });
      } else if (/^\d+\.\s+/.test(trimmed)) {
        blocks.push({ type: "NUMBERED_LIST", text: trimmed.replace(/^\d+\.\s+/, "") });
      } else {
        blocks.push({ type: "PARAGRAPH", text: trimmed });
      }
    });

    return blocks;
  }
}
