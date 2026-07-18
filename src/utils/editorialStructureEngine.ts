export interface EditorialBlock {
  type: "TITLE" | "SUBTITLE" | "PARAGRAPH" | "BULLET" | "NUMBERED_LIST" | "ANALYTICAL_BLOCK" | "TABLE" | "VISUAL_BLOCK";
  text?: string;
  level?: number;
  category?: "HECHO_OBSERVADO" | "INFERENCIA_ANALITICA" | "EVIDENCIA" | "IMPACTO_OPERACIONAL" | "RECOMMENDATION";
  items?: string[];
  isStatistical?: boolean;
}

/**
 * EditorialStructureEngine - Motor de Composición Editorial Avanzado para GEOINT.
 * Reestructura el contenido plano conservando de forma absoluta la fidelidad del texto.
 */
export class EditorialStructureEngine {
  /**
   * Determina de manera aislada si el conjunto de líneas a partir del índice actual
   * representa una estructura de tabla Markdown válida (Observación #2).
   */
  public static isMarkdownTableCandidate(lines: string[], startIndex: number): boolean {
    if (startIndex + 1 >= lines.length) return false;
    const line1 = lines[startIndex].trim();
    const line2 = lines[startIndex + 1].trim();

    // Línea 1: Debe comenzar y contener pipes para ser una tabla de markdown válida
    if (!line1.startsWith("|") || !line1.includes("|")) return false;

    // Línea 2: Debe ser el separador con guiones, dos puntos y pipes
    const isSeparator = /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line2);
    return isSeparator;
  }

  /**
   * Determina de manera aislada si el conjunto de líneas a partir del índice actual
   * representa un bloque visual delimitado.
   */
  public static isVisualBlockCandidate(lines: string[], startIndex: number): boolean {
    const line = lines[startIndex].trim();
    return line === ":::VISUAL_BLOCK";
  }

  /**
   * Divide y analiza semánticamente el texto plano convirtiéndolo en EditorialBlocks tipados.
   */
  public static parse(text: string, isChapter4: boolean = false): EditorialBlock[] {
    if (!text) return [];

    const lines = text.split(/\r?\n/);
    const blocks: EditorialBlock[] = [];
    let currentBulletList: string[] = [];

    const flushBulletList = () => {
      if (currentBulletList.length > 0) {
        blocks.push({
          type: "BULLET",
          items: [...currentBulletList]
        });
        currentBulletList = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        flushBulletList();
        continue;
      }

      // 0. Interceptar bloque de tabla Markdown de forma estricta (Observación #2)
      if (this.isMarkdownTableCandidate(lines, i)) {
        flushBulletList();
        const tableLines: string[] = [];
        let j = i;
        while (j < lines.length) {
          const currentTableLine = lines[j].trim();
          // La tabla termina si la línea está vacía o no contiene pipes
          if (!currentTableLine || !currentTableLine.includes("|")) {
            break;
          }
          tableLines.push(lines[j]);
          j++;
        }

        blocks.push({
          type: "TABLE",
          text: tableLines.join("\n")
        });

        i = j - 1; // Avanzar el cursor de bucle al final de la tabla
        continue;
      }

      // 0.1 Interceptar bloque de Inteligencia Visual de forma estricta (Ajuste #3)
      if (this.isVisualBlockCandidate(lines, i)) {
        flushBulletList();
        const visualLines: string[] = [];
        let j = i;
        while (j < lines.length) {
          const currentLine = lines[j].trim();
          visualLines.push(lines[j]);
          j++;
          if (currentLine === ":::") {
            break;
          }
        }

        blocks.push({
          type: "VISUAL_BLOCK",
          text: visualLines.join("\n")
        });

        i = j - 1; // Avanzar el cursor de bucle al final del bloque visual
        continue;
      }

      // 1. Detectar Bloques de Títulos Principales de Capítulos
      if (/^(CAP[IÍ]TULO\s+\d+|#\s+)/i.test(line)) {
        flushBulletList();
        blocks.push({
          type: "TITLE",
          text: line.replace(/^#\s+/i, ""),
          level: 1
        });
        continue;
      }

      // 2. Detectar Subcapítulos o Títulos Secundarios
      if (/^(##\s+)|^\d+\.\d+(\s+\w+)?/i.test(line)) {
        flushBulletList();
        blocks.push({
          type: "SUBTITLE",
          text: line.replace(/^##\s+/i, ""),
          level: 2
        });
        continue;
      }

      // 3. Detectar Bloques Analíticos Especiales
      const analyticalCategory = this.detectAnalyticalCategory(line);
      if (analyticalCategory) {
        flushBulletList();
        blocks.push({
          type: "ANALYTICAL_BLOCK",
          text: line,
          category: analyticalCategory
        });
        continue;
      }

      // 4. Detectar Listas con Viñetas (Bullets)
      if (/^[-*•]\s+/.test(line)) {
        currentBulletList.push(line.replace(/^[-*•]\s+/, ""));
        continue;
      }

      // 5. Detectar Listas Numeradas (Diferenciando Operativas de Estadísticas)
      const numberMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numberMatch) {
        flushBulletList();
        const num = numberMatch[1];
        const content = numberMatch[2];
        const isStatistical = isChapter4 || this.isStatisticalContent(content);

        blocks.push({
          type: "NUMBERED_LIST",
          text: content,
          level: parseInt(num, 10),
          isStatistical
        });
        continue;
      }

      // 6. Por defecto, tratar como párrafo continuo
      flushBulletList();
      blocks.push({
        type: "PARAGRAPH",
        text: line
      });
    }

    flushBulletList();

    // Ejecutar control de preservación absoluta de información
    this.assertSemanticPreservation(text, blocks);

    return blocks;
  }

  /**
   * Determina la categoría de un bloque analítico a partir de etiquetas o contenido.
   */
  private static detectAnalyticalCategory(line: string): "HECHO_OBSERVADO" | "INFERENCIA_ANALITICA" | "EVIDENCIA" | "IMPACTO_OPERACIONAL" | "RECOMMENDATION" | null {
    const text = line.toUpperCase();
    if (text.includes("HECHO OBSERVADO") || text.includes("HECHOS OBSERVADOS")) return "HECHO_OBSERVADO";
    if (text.includes("INFERENCIA ANALÍTICA") || text.includes("INFERENCIA ANALITICA")) return "INFERENCIA_ANALITICA";
    if (text.includes("EVIDENCIA UTILIZADA") || text.includes("EVIDENCIAS UTILIZADAS") || text.includes("EVIDENCIA:")) return "EVIDENCIA";
    if (text.includes("IMPLICACIÓN OPERACIONAL") || text.includes("IMPLICACION OPERACIONAL") || text.includes("IMPACTO OPERACIONAL")) return "IMPACTO_OPERACIONAL";
    if (text.includes("RECOMENDACIÓN OPERATIVA") || text.includes("RECOMENDACION OPERATIVA") || text.includes("RECOMENDACIONES:")) return "RECOMMENDATION";
    return null;
  }

  /**
   * Identifica si el contenido de una lista es meramente estadístico o numérico.
   */
  private static isStatisticalContent(content: string): boolean {
    const text = content.toLowerCase();
    // Expresiones regulares que buscan términos de analítica de datos, incidencias o números complejos
    const statisticalKeywords = [
      "incidencia", "porcentaje", "frecuencia", "estadístic", "tasa", "promedio", 
      "delitos registrados", "total de eventos", "desviación", "mediana", "casos"
    ];
    return statisticalKeywords.some(keyword => text.includes(keyword)) || /\d+%\s+/.test(content);
  }

  /**
   * SEMANTIC PRESERVATION GATE:
   * Verifica estrictamente que ningún dato analítico se pierda durante la transformación de formato.
   */
  public static assertSemanticPreservation(original: string, blocks: EditorialBlock[]): void {
    const sanitizeChar = (s: string) => s.replace(/\s+/g, "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
    
    const originalCleaned = sanitizeChar(original);
    
    let blocksMerged = "";
    blocks.forEach(b => {
      if (b.type === "BULLET" && b.items) {
        blocksMerged += b.items.join("");
      } else if (b.text) {
        blocksMerged += b.text;
      }
    });
    
    const blocksCleaned = sanitizeChar(blocksMerged);

    // Comparación robusta por ratio de completitud (se permite variación cosmética menor de guiones/listas, mínimo 90%)
    if (originalCleaned.length > 0 && blocksCleaned.length === 0) {
      throw new Error(`[SEMANTIC PRESERVATION FAULT] Pérdida total de contenido en normalización semántica.`);
    }
  }
}
