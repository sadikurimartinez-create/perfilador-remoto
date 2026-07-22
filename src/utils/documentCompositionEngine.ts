import { Table, TableRow, TableCell, Paragraph, TextRun, AlignmentType, ShadingType, BorderStyle, ImageRun, Header, Footer, PageNumber } from "docx";
import { CEIPOL_DOCUMENT_THEME } from "./documentTableRenderer";

export interface DocumentCompositionConfig {
  pageSize: "LETTER";
  headerAlignment: "LEFT" | "CENTER" | "RIGHT";
  footerAlignment: "LEFT" | "CENTER" | "RIGHT";
  allowChapterBreaks: boolean;
  watermarkEnabled: boolean;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export const DEFAULT_COMPOSITION_CONFIG: DocumentCompositionConfig = {
  pageSize: "LETTER",
  headerAlignment: "LEFT",
  footerAlignment: "RIGHT",
  allowChapterBreaks: false, // Regla definitiva: No separar capítulos automáticamente
  watermarkEnabled: true,
  margins: {
    top: 1134,    // 2.0 cm (Aprobado)
    bottom: 1134, // 2.0 cm (Aprobado)
    left: 1417,   // 2.5 cm (Aprobado)
    right: 1134,  // 2.0 cm (Aprobado)
  }
};

/**
 * PageFormatManager - Administrador oficial de dimensiones de papel y márgenes institucionales.
 */
export class PageFormatManager {
  public static get width(): number {
    return 12240; // 8.5" en twips
  }

  public static get height(): number {
    return 15840; // 11" en twips
  }

  public static get margins() {
    return {
      top: DEFAULT_COMPOSITION_CONFIG.margins.top,
      bottom: DEFAULT_COMPOSITION_CONFIG.margins.bottom,
      left: DEFAULT_COMPOSITION_CONFIG.margins.left,
      right: DEFAULT_COMPOSITION_CONFIG.margins.right,
    };
  }
}

/**
 * Base64 helper compatible con Node.js y el Navegador
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * InstitutionalBrandManager - Marca de agua institucional "SSPE - CEIPOL" transparente y no invasiva.
 */
export class InstitutionalBrandManager {
  // Transparente 1x1 pixel PNG para fallback de Node.js / pruebas unitarias
  private static FALLBACK_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  public static generateWatermarkBuffer(): ArrayBuffer {
    if (typeof document === "undefined") {
      return base64ToArrayBuffer(this.FALLBACK_PNG);
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return base64ToArrayBuffer(this.FALLBACK_PNG);
      }

      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, 600, 600);

      ctx.save();
      ctx.translate(300, 300);
      ctx.rotate(-45 * Math.PI / 180);
      ctx.fillStyle = "rgba(226, 232, 240, 0.12)"; // Muy claro, alta transparencia (#E2E8F0)
      ctx.font = "bold 38px Calibri, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SSPE - CEIPOL", 0, 0);
      ctx.restore();

      const dataUrl = canvas.toDataURL("image/png");
      const base64Data = dataUrl.split(",")[1];
      return base64ToArrayBuffer(base64Data);
    } catch (e) {
      console.warn("[InstitutionalBrandManager] Error generando watermark en canvas, usando fallback.");
      return base64ToArrayBuffer(this.FALLBACK_PNG);
    }
  }
}

/**
 * HeaderFooterManager - Ensamblado premium de encabezados y pies de página sin justificaciones artificiales.
 */
export class HeaderFooterManager {
  private static getAlignment(align: "LEFT" | "CENTER" | "RIGHT"): any {
    if (align === "CENTER") return AlignmentType.CENTER;
    if (align === "RIGHT") return AlignmentType.RIGHT;
    return AlignmentType.LEFT;
  }

  public static createFirstPageHeader(): Header {
    return new Header({
      children: [] // Portada libre de cabeceras
    });
  }

  public static createFirstPageFooter(): Footer {
    return new Footer({
      children: [] // Portada libre de pies de página
    });
  }

  public static createDefaultHeader(watermarkBuffer: ArrayBuffer): Header {
    const children: any[] = [];
    const runs: any[] = [];

    // Inyectar marca de agua flotante de fondo si está activa (mismo párrafo para evitar bloque/cuadro vacío)
    if (DEFAULT_COMPOSITION_CONFIG.watermarkEnabled) {
      try {
        runs.push(
          new ImageRun({
            data: watermarkBuffer,
            transformation: { width: 500, height: 500 },
            floating: {
              horizontalPosition: { offset: 1000 },
              verticalPosition: { offset: 1200 },
              wrap: { type: 1 } // TextWrappingType.NONE
            }
          } as any)
        );
      } catch (err) {
        console.warn("[HeaderFooterManager] No se pudo inyectar watermark flotante en Header. Usando fallback de imagen tenue.");
      }
    }

    runs.push(
      new TextRun({ text: "CEIPOL - SSPE | ", bold: true, color: "5B6573", size: 15, font: "Calibri" }),
      new TextRun({ text: "DICTAMEN TÉCNICO DE INTELIGENCIA TERRITORIAL", color: "5B6573", size: 15, font: "Calibri" })
    );

    // Cabecera institucional limpia
    const headerAlign = this.getAlignment(DEFAULT_COMPOSITION_CONFIG.headerAlignment);
    children.push(
      new Paragraph({
        alignment: headerAlign,
        children: runs,
        border: { bottom: { color: "D9DEE5", space: 1, style: BorderStyle.SINGLE, size: 6 } },
        spacing: { after: 120 }
      })
    );

    return new Header({
      children
    });
  }

  public static createDefaultFooter(dateText: string, safeName: string): Footer {
    const footerAlign = this.getAlignment(DEFAULT_COMPOSITION_CONFIG.footerAlignment);
    return new Footer({
      children: [
        new Paragraph({
          alignment: footerAlign,
          border: { top: { color: "D9DEE5", space: 1, style: BorderStyle.SINGLE, size: 6 } },
          spacing: { before: 80 },
          children: [
            new TextRun({ text: `${dateText} | Página `, color: "5B6573", size: 14, font: "Calibri" }),
            new TextRun({ children: [PageNumber.CURRENT], color: "5B6573", size: 14, font: "Calibri" }),
            new TextRun({ text: " de ", color: "5B6573", size: 14, font: "Calibri" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], color: "5B6573", size: 14, font: "Calibri" }),
            new TextRun({ text: ` | EXP: ${safeName.slice(0, 30)}`, color: "5B6573", size: 14, font: "Calibri" })
          ]
        })
      ]
    });
  }
}

/**
 * FlowControlManager - Gestión fluida y orgánica de saltos de página y prevención de orfandad tipográfica.
 */
export class FlowControlManager {
  private static lastWasTitle = false;

  public static reset() {
    this.lastWasTitle = false;
  }

  /**
   * Determina si se requiere un salto de página manual para una sección documental autorizada.
   */
  public static shouldPageBreakBefore(sectionName: string): boolean {
    const norm = sectionName.toUpperCase();
    // Permitido únicamente para Portada y Anexos mayores
    return norm.includes("PORTADA") || norm.includes("ANEXO CARTOGRÁFICO") || norm.includes("ANEXO TÉCNICO B");
  }

  /**
   * Vincula un párrafo o título con su siguiente bloque para evitar orfandad tipográfica.
   */
  public static applyFlowRules(paragraphOptions: any, blockType: string): any {
    const options = { ...paragraphOptions };

    if (blockType === "TITLE" || blockType === "SUBTITLE") {
      options.keepWithNext = true;
      this.lastWasTitle = true;
    } else {
      // Si el elemento previo fue un título, forzamos keepWithNext en el primer párrafo de contenido
      if (this.lastWasTitle) {
        options.keepWithNext = true;
      }
      this.lastWasTitle = false;
    }

    return options;
  }
}

/**
 * VisualDensityManager - Regulador inteligente para prevenir saturación visual sin degradar contenido analítico crítico.
 */
export class VisualDensityManager {
  private static accumulatedBlocks = 0;
  private static kpiCountOnCurrentPage = 0;
  private static tableSequenceCount = 0;
  private static lastVisualBlockIndex = -100;

  public static reset() {
    this.accumulatedBlocks = 0;
    this.kpiCountOnCurrentPage = 0;
    this.tableSequenceCount = 0;
    this.lastVisualBlockIndex = -100;
  }

  /**
   * Evalúa la densidad visual por página equivalente (aprox. 4 bloques narrativos estándar).
   * Prioridad de Gobernanza:
   * 1. Gráficos analíticos (CHART) -> Alta prioridad, NUNCA se degradan si tienen fuente certificada.
   * 2. Visualización de Riesgo (RISK_VISUALIZATION) -> Alta prioridad, heredan datos certificados.
   * 3. KPI certificado -> Prioridad media, se renderizan si hay origen trazable.
   * 4. Callout / Decorativo -> Prioridad baja, se degradan preferentemente ante saturación.
   */
  public static shouldRenderVisual(type: string, isCertified: boolean, currentBlockIndex: number): boolean {
    this.accumulatedBlocks++;
    const pageEquivalent = Math.floor(this.accumulatedBlocks / 4);

    // Resetear contador de KPI por página equivalente
    if (pageEquivalent > 0 && this.accumulatedBlocks % 4 === 0) {
      this.kpiCountOnCurrentPage = 0;
    }

    // Regla Prioridad 1: Gráficos y visualizaciones críticas con origen certificado
    if (type === "CHART" || type === "RISK_VISUALIZATION") {
      if (isCertified) return true; // NUNCA degradar contenido analítico real
    }

    // Regla Prioridad 3: Tarjetas de KPI
    if (type === "KPI_CARD") {
      const spacingOk = (currentBlockIndex - this.lastVisualBlockIndex) >= 3;
      if (!spacingOk || this.kpiCountOnCurrentPage >= 1) {
        // Reducir decorativo/exceso si ya hay una tarjeta en esta página equivalente o están consecutivas
        return false;
      }
      this.kpiCountOnCurrentPage++;
      this.lastVisualBlockIndex = currentBlockIndex;
      return true;
    }

    // Regla Prioridad 4: Callouts decorativos
    if (type === "CALLOUT_BOX") {
      const spacingOk = (currentBlockIndex - this.lastVisualBlockIndex) >= 3;
      if (!spacingOk) {
        return false;
      }
      this.lastVisualBlockIndex = currentBlockIndex;
      return true;
    }

    return true;
  }

  /**
   * Monitorea la acumulación de tablas grandes consecutivas.
   */
  public static registerTableBlock(): boolean {
    this.tableSequenceCount++;
    if (this.tableSequenceCount > 2) {
      // Prevenir más de 2 tablas grandes continuas aplicando fallback de espaciado estructurado
      return false;
    }
    return true;
  }

  public static registerNonTableBlock() {
    this.tableSequenceCount = 0;
  }
}
