import { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, ShadingType, BorderStyle } from "docx";

// OBSERVACIÓN CRÍTICA #4: No hardcodear colores institucionales. Usar tema CEIPOL.
export const CEIPOL_DOCUMENT_THEME = {
  headerBackground: "0D2B52",
  headerText: "FFFFFF",
  bodyAlternate: "F8FAFC",
  bodyText: "222222",
  borderOuter: "0D2B52",
  borderInner: "E2E8F0"
};

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  alignments: any[];
}

/**
 * TableParser - Módulo independiente encargado del análisis sintáctico de tablas Markdown.
 */
export class TableParser {
  /**
   * Limpia las marcas de formato internas de Markdown (Caso 6) para evitar fugas en el Word.
   */
  public static cleanCellMarkdown(text: string): string {
    return text
      .trim()
      .replace(/\*\*([^*]+)\*\*/g, "$1") // Strip bold **
      .replace(/\*([^*]+)\*/g, "$1")     // Strip italic *
      .replace(/__([^_]+)__/g, "$1")     // Strip bold __
      .replace(/_([^_]+)_/g, "$1");      // Strip italic _
  }

  /**
   * Divide una línea de tabla Markdown en celdas individuales respetando los separadores "|".
   */
  private static splitLineToCells(line: string): string[] {
    let cells = line.split("|").map(c => {
      if (c === null || c === undefined) return "N/D";
      const trimmed = c.trim();
      if (trimmed.length === 0 || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined") {
        return "N/D";
      }
      return trimmed;
    });
    if (line.startsWith("|")) cells.shift();
    if (line.endsWith("|")) cells.pop();
    return cells;
  }

  /**
   * Parsear alineaciones a partir del separador de tabla de markdown (Línea 2).
   */
  private static parseAlignments(separatorLine: string): any[] {
    const cells = this.splitLineToCells(separatorLine);
    return cells.map(sep => {
      const left = sep.startsWith(":");
      const right = sep.endsWith(":");
      if (left && right) return AlignmentType.CENTER;
      if (right) return AlignmentType.RIGHT;
      return AlignmentType.LEFT;
    });
  }

  /**
   * Convierte un texto markdown a una estructura ParsedTable.
   */
  public static parse(markdown: string): ParsedTable {
    const lines = markdown.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      throw new Error("Estructura de tabla Markdown insuficiente.");
    }

    const headers = this.splitLineToCells(lines[0]);
    const alignments = this.parseAlignments(lines[1]);

    const rows: string[][] = [];
    for (let i = 2; i < lines.length; i++) {
      rows.push(this.splitLineToCells(lines[i]));
    }

    return { headers, rows, alignments };
  }
}

/**
 * TableValidator - Módulo encargado de asegurar la integridad y consistencia estructural de las celdas.
 */
export class TableValidator {
  /**
   * Valida que la estructura parseada sea consistente y no tenga filas corruptas.
   */
  public static validate(parsed: ParsedTable): boolean {
    if (!parsed.headers || parsed.headers.length === 0) {
      return false;
    }
    
    // Caso 5: Tabla vacía (solo cabecera y separador, o sin filas)
    if (!parsed.rows || parsed.rows.length === 0) {
      return false;
    }

    const colCount = parsed.headers.length;
    for (const row of parsed.rows) {
      if (row.length !== colCount) {
        return false; // Colcount mismatch = corrupt table
      }
    }

    return true;
  }
}

/**
 * TableStyleProvider - Generador de hojas de estilo e identidad institucional CEIPOL.
 */
export class TableStyleProvider {
  /**
   * Obtiene la configuración de bordes institucional para la tabla.
   */
  public static getTableBorders() {
    return {
      top: { style: BorderStyle.SINGLE, size: 8, color: CEIPOL_DOCUMENT_THEME.borderOuter },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: CEIPOL_DOCUMENT_THEME.borderOuter },
      left: { style: BorderStyle.SINGLE, size: 8, color: CEIPOL_DOCUMENT_THEME.borderOuter },
      right: { style: BorderStyle.SINGLE, size: 8, color: CEIPOL_DOCUMENT_THEME.borderOuter },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: CEIPOL_DOCUMENT_THEME.borderInner },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: CEIPOL_DOCUMENT_THEME.borderInner }
    };
  }

  /**
   * Obtiene el margen (padding) predeterminado para cada celda.
   */
  public static getCellMargins() {
    return {
      top: 100, // dxa
      bottom: 100,
      left: 150,
      right: 150
    };
  }
}

/**
 * TableRenderer - Motor principal de generación de componentes docx nativos.
 */
export class TableRenderer {
  /**
   * Renderiza una estructura tabular parseada y validada a un objeto docx.Table formal.
   */
  public static render(parsed: ParsedTable): Table {
    const colCount = parsed.headers.length;
    const colWidthPercent = Math.floor(100 / colCount);

    const rows: TableRow[] = [];

    // 1. Generar encabezado institucional
    const headerCells = parsed.headers.map((h, idx) => {
      const align = parsed.alignments[idx] || AlignmentType.LEFT;
      return new TableCell({
        width: { size: colWidthPercent, type: WidthType.PERCENTAGE },
        shading: { fill: CEIPOL_DOCUMENT_THEME.headerBackground, type: ShadingType.CLEAR },
        margins: TableStyleProvider.getCellMargins(),
        children: [
          new Paragraph({
            alignment: align,
            children: [
              new TextRun({
                text: TableParser.cleanCellMarkdown(h),
                bold: true,
                size: 18, // 9pt para tablas institucionales
                color: CEIPOL_DOCUMENT_THEME.headerText,
                font: "Calibri"
              })
            ]
          })
        ]
      });
    });

    // Añadir encabezado con repetición (tableHeader: true) e impedir división (cantSplit: true)
    rows.push(
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headerCells
      })
    );

    // 2. Generar cuerpo de la tabla con Zebra Striping y auto-alineación
    parsed.rows.forEach((row, rowIndex) => {
      const isAlternate = rowIndex % 2 === 1;
      const bgFill = isAlternate ? CEIPOL_DOCUMENT_THEME.bodyAlternate : "FFFFFF";

      const bodyCells = row.map((cellText, colIdx) => {
        const align = parsed.alignments[colIdx] || AlignmentType.LEFT;
        
        // Determinar contexto para el placeholder (ADR-016)
        const headerTitle = (parsed.headers[colIdx] || "").toLowerCase();
        let fallbackVal = "N/D";
        if (
          headerTitle.includes("nombre") || 
          headerTitle.includes("comentario") || 
          headerTitle.includes("descrip") || 
          headerTitle.includes("observa") || 
          headerTitle.includes("registro") ||
          headerTitle.includes("detalles")
        ) {
          fallbackVal = "Sin Registro";
        }

        let sanitizedText = cellText === null || cellText === undefined ? fallbackVal : String(cellText).trim();
        if (sanitizedText.length === 0 || sanitizedText.toLowerCase() === "null" || sanitizedText.toLowerCase() === "undefined" || sanitizedText === "N/D") {
          sanitizedText = fallbackVal;
        }

        return new TableCell({
          width: { size: colWidthPercent, type: WidthType.PERCENTAGE },
          shading: { fill: bgFill, type: ShadingType.CLEAR },
          margins: TableStyleProvider.getCellMargins(),
          children: [
            new Paragraph({
              alignment: align,
              children: [
                new TextRun({
                  text: TableParser.cleanCellMarkdown(sanitizedText),
                  size: 18, // 9pt
                  color: CEIPOL_DOCUMENT_THEME.bodyText,
                  font: "Calibri"
                })
              ]
            })
          ]
        });
      });

      // Añadir fila impidiendo división (cantSplit: true)
      rows.push(
        new TableRow({
          cantSplit: true,
          children: bodyCells
        })
      );
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TableStyleProvider.getTableBorders(),
      rows: rows
    });
  }
}

/**
 * Función principal y única de exportación: renderMarkdownTable.
 * Orquesta la tubería y aplica el Fallback de Texto Seguro con trazabilidad si es inválido (Observaciones 3 y 6).
 */
export function renderMarkdownTable(markdown: string): Table | Paragraph {
  try {
    const parsed = TableParser.parse(markdown);
    if (TableValidator.validate(parsed)) {
      return TableRenderer.render(parsed);
    }
  } catch (err: any) {
    // Trazabilidad de fallo sin bloquear producción
    console.warn(`[DocumentTableRenderer] Error parsing markdown table: ${err.message}`);
  }

  // OBSERVACIÓN CRÍTICA #6: Fallback de texto seguro con log de trazabilidad
  console.warn("[DocumentTableRenderer] Invalid markdown table fallback applied.");
  
  // Renderizar como párrafo limpio quitando marcas de tubería para mantener legibilidad premium
  const cleanFallbackText = markdown
    .trim()
    .split(/\r?\n/)
    .map(line => {
      return line
        .split("|")
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0)
        .join("   |   "); // Formatear sutilmente con espaciado
    })
    .join("\n");

  return new Paragraph({
    children: [
      new TextRun({
        text: `[REGISTRO TABULAR - FORMATO ALTERNATIVO]\n${cleanFallbackText}`,
        size: 18,
        font: "Calibri",
        italics: true,
        color: "555555"
      })
    ],
    spacing: { before: 100, after: 120 }
  });
}
