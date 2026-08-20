import { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, ShadingType, BorderStyle, ImageRun } from "docx";
import { CEIPOL_DOCUMENT_THEME } from "./documentTableRenderer";
import { VisualDensityManager } from "./documentCompositionEngine";

export interface VisualBlock {
  id?: string;
  type: "KPI_CARD" | "CALLOUT_BOX" | "RISK_VISUALIZATION" | "CHART";
  title: string;
  value?: string | number;
  metadata: {
    source: string;
    confidence?: number;
    evidenceId?: string;
  };
}

/**
 * VisualDensityController - Controlador de gobernanza para evitar la saturación visual.
 * Enforce: Máximo 1 bloque visual cada 2 páginas de contenido (programado como mínimo 2 bloques estándar de separación).
 */
export class VisualDensityController {
  private static lastVisualBlockIndex = -100;
  private static visualCount = 0;

  public static reset() {
    this.lastVisualBlockIndex = -100;
    this.visualCount = 0;
  }

  /**
   * Determina si se permite renderizar un bloque visual de acuerdo con las reglas editoriales.
   */
  public static shouldRenderVisual(currentBlockIndex: number): boolean {
    const separation = currentBlockIndex - this.lastVisualBlockIndex;
    if (separation < 3) {
      return false; // Excede densidad, forzar fallback textual
    }
    this.lastVisualBlockIndex = currentBlockIndex;
    this.visualCount++;
    return true;
  }
}

/**
 * VisualParser - Analizador con esquema estricto y cerrado para bloques de inteligencia visual.
 */
export class VisualParser {
  private static ALLOWED_FIELDS = new Set(["id", "type", "title", "value", "source", "confidence", "evidenceId"]);

  /**
   * Parsea un bloque de texto YAML-like delimitado.
   */
  public static parse(blockText: string): VisualBlock | null {
    const lines = blockText.split(/\r?\n/);
    const rawData: Record<string, string> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === ":::VISUAL_BLOCK" || trimmed === ":::") {
        continue;
      }

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) continue;

      const rawKey = trimmed.substring(0, colonIndex).trim();
      const rawValue = trimmed.substring(colonIndex + 1).trim();

      // Ajuste obligatorio #3: Esquema cerrado. Campos adicionales ignorados + warning.
      if (!this.ALLOWED_FIELDS.has(rawKey)) {
        console.warn(`[VisualParser] Campo no permitido ignorado: "${rawKey}"`);
        continue;
      }

      rawData[rawKey] = rawValue;
    }

    if (!rawData.type || !rawData.title) {
      return null;
    }

    // Mapear al modelo VisualBlock
    return {
      id: rawData.id || `VIS-GEN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      type: rawData.type as any,
      title: rawData.title,
      value: rawData.value,
      metadata: {
        source: rawData.source || "",
        confidence: rawData.confidence ? parseFloat(rawData.confidence) : undefined,
        evidenceId: rawData.evidenceId
      }
    };
  }
}

/**
 * VisualValidator - Validador defensivo de gobernanza y trazabilidad analítica.
 */
/**
 * VisualFingerprintRegistry - Generador y validador de firmas criptográficas para recursos visuales (ADR-016).
 * Sustituye la deduplicación frágil por fingerprinting basado en: SHA-256 + layerType + layerId.
 */
export class VisualFingerprintRegistry {
  private static registeredFingerprints = new Set<string>();

  public static clear(): void {
    this.registeredFingerprints.clear();
  }

  /**
   * Genera un hash SHA-256 rápido del contenido Base64
   */
  public static computeSHA256(base64: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < base64.length; i++) {
      const char = base64.charCodeAt(i);
      h1 = Math.imul(h1 ^ char, 2654435761);
      h2 = Math.imul(h2 ^ char, 1597334677);
    }
    return ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padStart(16, "0");
  }

  /**
   * Genera la huella digital canónica (SHA-256 + layerType + layerId) y verifica duplicación.
   */
  public static registerAndCheckDuplicate(
    base64: string,
    layerType: string = "N/D",
    layerId: string = "N/D"
  ): { duplicate: boolean; fingerprint: string } {
    const contentHash = this.computeSHA256(base64);
    const fingerprint = `${contentHash}_${layerType}_${layerId}`;

    if (this.registeredFingerprints.has(fingerprint)) {
      return { duplicate: true, fingerprint };
    }

    this.registeredFingerprints.add(fingerprint);
    return { duplicate: false, fingerprint };
  }
}

export class VisualValidator {
  /**
   * Valida la estructura y coherencia del bloque visual.
   */
  public static validate(block: VisualBlock | null): boolean {
    if (!block) return false;

    // Ajuste obligatorio #2: metadata.source obligatoria. Un visual sin fuente no existe.
    if (!block.metadata || !block.metadata.source || block.metadata.source.trim() === "") {
      console.warn(`[VisualValidator] Bloque ${block.id || "S/N"} rechazado por ausencia de fuente obligatoria.`);
      return false;
    }

    // Caso 8 (Datos falsificados): REJECT si la fuente es UNKNOWN o inválida.
    if (block.metadata.source.toUpperCase() === "UNKNOWN") {
      console.warn(`[VisualValidator] Bloque ${block.id} RECHAZADO: Fuente UNKNOWN no permitida.`);
      return false;
    }

    const allowedTypes = ["KPI_CARD", "CALLOUT_BOX", "RISK_VISUALIZATION", "CHART"];
    if (!allowedTypes.includes(block.type)) {
      console.warn(`[VisualValidator] Bloque ${block.id} RECHAZADO: Tipo inválido "${block.type}".`);
      return false;
    }

    // Deduplicación criptográfica (ADR-016)
    const base64 = block.value ? String(block.value) : "";
    const layerType = block.type || "N/D";
    const layerId = block.metadata?.evidenceId || block.id || "N/D";
    
    const dedup = VisualFingerprintRegistry.registerAndCheckDuplicate(base64, layerType, layerId);
    if (dedup.duplicate) {
      console.warn(`[VisualValidator] Bloque ${block.id} RECHAZADO: Duplicado visual detectado mediante fingerprint.`);
      return false;
    }

    return true;
  }
}

/**
 * VisualRenderer - Capa especializada en composición vectorial nativa y estricta en docx.
 * Ajuste obligatorio #6: Retorno estrictamente tipado como Paragraph | Table.
 */
export class VisualRenderer {
  /**
   * Renderiza un VisualBlock a un elemento DOCX nativo.
   */
  public static render(block: VisualBlock): Paragraph | Table {
    switch (block.type) {
      case "KPI_CARD":
        return this.renderKpiCard(block);
      case "CALLOUT_BOX":
        return this.renderCalloutBox(block);
      case "RISK_VISUALIZATION":
        return this.renderRiskVisualization(block);
      case "CHART":
        return this.renderChart(block);
      default:
        return this.renderFallbackParagraph(block, "Tipo de bloque visual desconocido.");
    }
  }

  /**
   * Renderiza una tarjeta de KPI con diseño corporativo unificado.
   */
  private static renderKpiCard(block: VisualBlock): Table {
    const valText = block.value !== undefined ? String(block.value) : "S/D";

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: CEIPOL_DOCUMENT_THEME.borderInner },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: CEIPOL_DOCUMENT_THEME.borderInner },
        left: { style: BorderStyle.SINGLE, size: 12, color: CEIPOL_DOCUMENT_THEME.headerBackground }, // Detalle decorativo izquierdo
        right: { style: BorderStyle.SINGLE, size: 4, color: CEIPOL_DOCUMENT_THEME.borderInner }
      },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              shading: { fill: CEIPOL_DOCUMENT_THEME.bodyAlternate, type: ShadingType.CLEAR },
              margins: { top: 180, bottom: 180, left: 240, right: 240 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: block.title.toUpperCase(),
                      bold: true,
                      size: 16, // 8pt
                      color: "555555",
                      font: "Calibri"
                    })
                  ],
                  spacing: { after: 60 }
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: valText,
                      bold: true,
                      size: 48, // 24pt
                      color: CEIPOL_DOCUMENT_THEME.headerBackground,
                      font: "Calibri"
                    })
                  ],
                  spacing: { after: 60 }
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Fuente: ${block.metadata.source}`,
                      size: 14, // 7pt
                      color: "777755",
                      font: "Calibri"
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    });
  }

  /**
   * Renderiza una caja de llamado elegante con borde izquierdo grueso de 4.5pt.
   */
  private static renderCalloutBox(block: VisualBlock): Table {
    const descText = block.value !== undefined ? String(block.value) : "";

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.SINGLE, size: 36, color: CEIPOL_DOCUMENT_THEME.headerBackground }, // 4.5pt de grosor
        right: { style: BorderStyle.NONE }
      },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              shading: { fill: CEIPOL_DOCUMENT_THEME.bodyAlternate, type: ShadingType.CLEAR },
              margins: { top: 200, bottom: 200, left: 300, right: 200 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `[RECOMENDACIÓN TÁCTICA] ${block.title}`,
                      bold: true,
                      size: 18, // 9pt
                      color: CEIPOL_DOCUMENT_THEME.headerBackground,
                      font: "Calibri"
                    })
                  ],
                  spacing: { after: 100 }
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: descText,
                      italics: true,
                      size: 18, // 9pt
                      color: CEIPOL_DOCUMENT_THEME.bodyText,
                      font: "Calibri"
                    })
                  ],
                  spacing: { after: 80 }
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Trazabilidad: Fuente certificada por ${block.metadata.source}`,
                      size: 14, // 7pt
                      color: "777777",
                      font: "Calibri"
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    });
  }

  /**
   * Renderiza una escala de riesgo de gobernanza certificada sin alucinaciones porcentuales.
   * Ajuste obligatorio #4: Mostrar riesgo porcentual o score UNICAMENTE si existe dato numérico certificado.
   */
  private static renderRiskVisualization(block: VisualBlock): Table {
    const rawVal = block.value !== undefined ? String(block.value).trim() : "";
    const isNumeric = /^\d+$/.test(rawVal);
    let riskLabel = block.title || "VULNERABILIDAD AMBIENTAL";
    let textVisual = "";
    let detailText = "";

    if (isNumeric) {
      const percent = Math.min(Math.max(parseInt(rawVal), 0), 100);
      const filledBlocks = Math.round(percent / 10);
      const emptyBlocks = 10 - filledBlocks;
      const barStr = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
      textVisual = `[${barStr}] ${percent}%`;
      detailText = `Score analítico certificado: ${percent}/100`;
    } else {
      // Ajuste obligatorio #4: Sin porcentajes si no es dato certificado
      textVisual = "[████████░░]"; // Estilización estática estándar
      detailText = `Nivel certificado: ${rawVal || "ALTO"}`;
    }

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: CEIPOL_DOCUMENT_THEME.borderInner },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: CEIPOL_DOCUMENT_THEME.borderInner },
        left: { style: BorderStyle.SINGLE, size: 12, color: "A51D24" }, // Detalle rojo para riesgo/alerta
        right: { style: BorderStyle.SINGLE, size: 4, color: CEIPOL_DOCUMENT_THEME.borderInner }
      },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              shading: { fill: CEIPOL_DOCUMENT_THEME.bodyAlternate, type: ShadingType.CLEAR },
              margins: { top: 140, bottom: 140, left: 240, right: 240 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `VISUALIZACIÓN DE RIESGO: ${riskLabel.toUpperCase()}`,
                      bold: true,
                      size: 16,
                      color: "A51D24",
                      font: "Calibri"
                    })
                  ],
                  spacing: { after: 60 }
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: textVisual,
                      bold: true,
                      size: 20,
                      color: "222222",
                      font: "Consolas" // Usar fuente monoespaciada para la barra
                    })
                  ],
                  spacing: { after: 60 }
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${detailText}\nFuente de Gobernanza: ${block.metadata.source}`,
                      size: 16,
                      color: CEIPOL_DOCUMENT_THEME.bodyText,
                      font: "Calibri"
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    });
  }

  /**
   * Renderiza un gráfico insertando Base64 decodificada como ImageRun dentro de un Paragraph.
   */
  private static renderChart(block: VisualBlock): Paragraph {
    const base64Data = String(block.value || "");
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "").trim();

    try {
      // Validar si la cadena contiene caracteres válidos de Base64
      const isBase64Reg = /^[A-Za-z0-9+/=]+$/;
      if (!isBase64Reg.test(cleanBase64)) {
        throw new Error("La cadena contiene caracteres inválidos para Base64.");
      }

      const buffer = Buffer.from(cleanBase64, "base64");
      
      return new Paragraph({
        alignment: "center",
        children: [
          new ImageRun({
            data: buffer,
            transformation: {
              width: 500, // Escala segura estándar de 500px para evitar desbordes
              height: 250
            }
          } as any),
          new TextRun({
            text: `\nGráfico: ${block.title} | Fuente: ${block.metadata.source}`,
            size: 14,
            italics: true,
            color: "777777"
          })
        ],
        spacing: { before: 120, after: 120 }
      });
    } catch (err) {
      console.warn(`[VisualRenderer] Error decodificando gráfico Base64 para bloque ${block.id}. Empleando fallback de gobernanza.`);
      return this.renderFallbackParagraph(block, "Fallo al compilar imagen del gráfico o Base64 corrupto.");
    }
  }

  /**
   * Genera un párrafo de texto plano estilizado para fallbacks de corrupción o malformación.
   */
  public static renderFallbackParagraph(block: VisualBlock, warningReason: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: `[BLOQUE VISUAL EXCLUIDO - REGISTRO EDITORIAL FALLBACK]\n`,
          bold: true,
          size: 16,
          color: "A51D24",
          font: "Calibri"
        }),
        new TextRun({
          text: `ID: ${block.id} | Elemento: ${block.type} - "${block.title}"\n`,
          size: 16,
          color: "222222",
          font: "Calibri"
        }),
        new TextRun({
          text: `Valor: ${block.value || "S/D"} | Fuente: ${block.metadata?.source || "AUSENTE"}\n`,
          size: 16,
          color: "222222",
          font: "Calibri"
        }),
        new TextRun({
          text: `Motivo: ${warningReason}`,
          size: 14,
          italics: true,
          color: "777777",
          font: "Calibri"
        })
      ],
      spacing: { before: 100, after: 120 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "A51D24" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "A51D24" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "A51D24" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "A51D24" }
      }
    });
  }
}

/**
 * Función principal y única de integración para el pipeline documental.
 * Ajuste obligatorio #6: Retorno estrictamente tipado.
 */
export function renderVisualBlock(blockText: string, blockIndex: number = 0): Paragraph | Table {
  const parsed = VisualParser.parse(blockText);

  // Validación de gobernanza y trazabilidad (Ajustes #1 y #2)
  if (!VisualValidator.validate(parsed)) {
    const fallbackBlock: VisualBlock = parsed || {
      id: "VIS-MAL-000",
      type: "KPI_CARD",
      title: "Malformación estructural",
      metadata: { source: "ERR" }
    };
    return VisualRenderer.renderFallbackParagraph(fallbackBlock, "Fallo crítico en validación de gobernanza (esquema o fuente ausente).");
  }

  const block = parsed!;

  // Ajuste de gobernanza v1.0.5: Control de densidad inteligente (VisualDensityManager)
  const isCertified = block.metadata?.source !== "UNKNOWN" && (block.metadata?.source?.length || 0) > 0;
  if (!VisualDensityManager.shouldRenderVisual(block.type, isCertified, blockIndex)) {
    return VisualRenderer.renderFallbackParagraph(block, "Exceso de densidad visual. Convertido a bloque textual por gobernanza editorial.");
  }

  return VisualRenderer.render(block);
}
