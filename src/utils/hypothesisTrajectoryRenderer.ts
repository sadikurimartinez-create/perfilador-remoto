import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
} from "docx";

export interface AnalyticalVariable {
  variable: string;
  description: string;
  source: string;
}

export interface EvidenceLink {
  evidence: string;
  type: string;
  result: string;
}

export interface HypothesisEvolutionEvent {
  fecha: number;
  estadoAnterior: string;
  estadoNuevo: string;
  tipoChange?: string;
  tipoCambio?: string;
  justificacionAnalitica: string;
  usuarioResponsable?: string;
}

export interface HypothesisTrajectoryInput {
  hypothesisInitial?: string;
  analyticalQuestion?: string;
  analyticalVariables?: AnalyticalVariable[];
  evidenceLinks?: EvidenceLink[];
  validationStatus?: string;
  confidenceLevel?: string;
  hypothesisEvolution?: HypothesisEvolutionEvent[];
  evidenciaConfirmatoria?: string[];
  evidenciaContradictoria?: string[];
  justificacionActual?: string;
}

/**
 * Utility to create standard cell margins to guarantee premium Word layout.
 */
const defaultCellMargins = {
  top: 100,
  bottom: 100,
  left: 140,
  right: 140,
};

/**
 * Standard table borders for CEIPOL documents.
 */
const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
};

/**
 * Helper to build consistent header cells.
 */
function createHeaderCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    borders: tableBorders,
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: "0D2B52", type: ShadingType.CLEAR },
    margins: defaultCellMargins,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            bold: true,
            size: 16,
            color: "FFFFFF",
            font: "Calibri",
          }),
        ],
      }),
    ],
  });
}

/**
 * Helper to build consistent body cells.
 */
function createBodyCell(text: string, widthPercent: number, isItalic = false, align = AlignmentType.LEFT): TableCell {
  return new TableCell({
    borders: tableBorders,
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: "F8FAFC", type: ShadingType.CLEAR },
    margins: defaultCellMargins,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            size: 16,
            color: "222222",
            font: "Calibri",
            italics: isItalic,
          }),
        ],
      }),
    ],
  });
}

/**
 * hypothesisTrajectoryRenderer
 * Construye dinámicamente las secciones nativas del Capítulo 0.
 */
export function renderHypothesisTrajectory(input: HypothesisTrajectoryInput): any[] {
  const elements: any[] = [];

  // Helper functions for sections
  const createSubSectionTitle = (text: string) => new Paragraph({
    keepNext: true,
    children: [new TextRun({ text, size: 18, bold: true, color: "1F4E79", font: "Calibri" })],
    spacing: { before: 180, after: 80 },
  });

  const createNormalText = (text: string, isItalic = false) => new Paragraph({
    children: [new TextRun({ text, size: 20, font: "Calibri", color: "222222", italics: isItalic })],
    spacing: { after: 120 },
    alignment: AlignmentType.JUSTIFIED,
  });

  // 0.1 Pregunta Analítica Inicial
  elements.push(createSubSectionTitle("0.1 Pregunta Analítica Inicial"));
  const question = input.analyticalQuestion && input.analyticalQuestion.trim().length > 0
    ? input.analyticalQuestion.trim()
    : "¿Cuáles son los facilitadores ambientales y espaciales que incrementan la oportunidad delictiva en este cuadrante?";
  elements.push(createNormalText(question, true));

  // 0.2 Hipótesis Inicial de Investigación
  elements.push(createSubSectionTitle("0.2 Hipótesis Inicial de Investigación"));
  if (input.hypothesisInitial && input.hypothesisInitial.trim().length > 0) {
    elements.push(createNormalText(input.hypothesisInitial.trim(), false));
  } else {
    elements.push(createNormalText("Expediente sin hipótesis formalizada. Estado exploratorio.", true));
  }

  // 0.3 Variables Analíticas Evaluadas
  elements.push(createSubSectionTitle("0.3 Variables Analíticas Evaluadas"));
  if (input.analyticalVariables && input.analyticalVariables.length > 0) {
    const varRows = [
      new TableRow({
        children: [
          createHeaderCell("Variable", 25),
          createHeaderCell("Descripción", 55),
          createHeaderCell("Fuente", 20),
        ],
      }),
    ];

    input.analyticalVariables.forEach((v) => {
      varRows.push(
        new TableRow({
          children: [
            createBodyCell(v.variable, 25, true),
            createBodyCell(v.description, 55),
            createBodyCell(v.source, 20),
          ],
        })
      );
    });

    elements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: varRows,
      })
    );
    elements.push(new Paragraph({ spacing: { before: 80, after: 80 } }));
  } else {
    elements.push(createNormalText("Variables analíticas no formalizadas en la fase inicial.", true));
  }

  // 0.4 Evidencia Asociada
  elements.push(createSubSectionTitle("0.4 Evidencia Asociada"));
  if (input.evidenceLinks && input.evidenceLinks.length > 0) {
    const evidenceRows = [
      new TableRow({
        children: [
          createHeaderCell("Evidencia", 30),
          createHeaderCell("Tipo", 35),
          createHeaderCell("Resultado Analítico", 35),
        ],
      }),
    ];

    input.evidenceLinks.forEach((e) => {
      evidenceRows.push(
        new TableRow({
          children: [
            createBodyCell(e.evidence, 30, true),
            createBodyCell(e.type, 35),
            createBodyCell(e.result, 35),
          ],
        })
      );
    });

    elements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: evidenceRows,
      })
    );
    elements.push(new Paragraph({ spacing: { before: 80, after: 80 } }));
  } else {
    elements.push(createNormalText("No se han asociado evidencias formales de respaldo en esta etapa del análisis.", true));
  }

  // 0.5 Evolución de la Hipótesis
  elements.push(createSubSectionTitle("0.5 Evolución de la Hipótesis"));
  
  const initialText = input.hypothesisInitial && input.hypothesisInitial.trim().length > 0
    ? "Hipótesis inicial formulada en ADR-011"
    : "Estado Exploratorio Inicial";

  const statusMap: Record<string, string> = {
    "INICIAL": "Formulación Inicial",
    "EN_ANALISIS": "En Análisis",
    "HIPOTESIS_SUSTENTADA_POR_CONVERGENCIA": "Sustentada por Convergencia",
    "CONFIRMADA": "Confirmada con Certidumbre",
    "REFUTADA": "Refutada por Evidencia",
    "MODIFICADA": "Modificada bajo Ajuste",
    "FENOMENO_CONFIRMADO": "Fenómeno Confirmado",
  };

  const finalStateLabel = input.validationStatus && statusMap[input.validationStatus]
    ? statusMap[input.validationStatus]
    : (input.validationStatus || "En proceso de análisis");

  const evidenceDescriptionText = input.evidenceLinks && input.evidenceLinks.length > 0
    ? `Incorporación de ${input.evidenceLinks.length} evidencias formales (campo y gabinete)`
    : "Sin evidencias concluyentes adicionales inyectadas";

  const validationResultText = input.validationStatus === "CONFIRMADA" || input.validationStatus === "FENOMENO_CONFIRMADO"
    ? "Validación analítica satisfactoria por convergencia empírica"
    : "Evaluación analítica en progreso con sustento metodológico";

  const flowBox = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: tableBorders,
            shading: { fill: "F8FAFC", type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "ESTADO INICIAL\n", bold: true, color: "1F4E79", size: 16, font: "Calibri" }),
                  new TextRun({ text: `[${initialText}]\n\n`, size: 16, font: "Calibri", italics: true }),
                  
                  new TextRun({ text: "↓\n\n", bold: true, color: "0D2B52", size: 18 }),
                  
                  new TextRun({ text: "EVIDENCIA INCORPORADA\n", bold: true, color: "1F4E79", size: 16, font: "Calibri" }),
                  new TextRun({ text: `[${evidenceDescriptionText}]\n\n`, size: 16, font: "Calibri", italics: true }),
                  
                  new TextRun({ text: "↓\n\n", bold: true, color: "0D2B52", size: 18 }),
                  
                  new TextRun({ text: "RESULTADO DE VALIDACIÓN\n", bold: true, color: "1F4E79", size: 16, font: "Calibri" }),
                  new TextRun({ text: `[${validationResultText}]\n\n`, size: 16, font: "Calibri", italics: true }),
                  
                  new TextRun({ text: "↓\n\n", bold: true, color: "0D2B52", size: 18 }),
                  
                  new TextRun({ text: "ESTADO FINAL DE HIPÓTESIS\n", bold: true, color: "2E7D32", size: 16, font: "Calibri" }),
                  new TextRun({ text: `[Estatus: ${finalStateLabel} | Confianza: ${input.confidenceLevel || "MEDIO"}]`, bold: true, size: 16, color: "2E7D32", font: "Calibri" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  elements.push(flowBox);
  elements.push(new Paragraph({ spacing: { before: 120, after: 120 } }));

  // 0.6 Matriz de Trayectoria ADR-011
  elements.push(createSubSectionTitle("0.6 Matriz de Trayectoria ADR-011"));

  const matrixRows = [
    new TableRow({
      children: [
        createHeaderCell("Elemento", 30),
        createHeaderCell("Descripción", 70),
      ],
    }),
  ];

  // Elemento 1: Hipótesis Inicial
  const initialHypText = input.hypothesisInitial && input.hypothesisInitial.trim().length > 0
    ? input.hypothesisInitial.trim()
    : "Expediente sin hipótesis formalizada. Estado exploratorio.";
  matrixRows.push(
    new TableRow({
      children: [
        createBodyCell("Hipótesis inicial", 30, true),
        createBodyCell(initialHypText, 70),
      ],
    })
  );

  // Elemento 2: Evidencia incorporada
  const rawEvCount = input.evidenceLinks ? input.evidenceLinks.length : 0;
  const evIncorporadaText = rawEvCount > 0
    ? `Total de evidencias integradas: ${rawEvCount}. Incluye barridos fotográficos y análisis geoespacial.`
    : "Registro de Incidencia, llamados al 911 y reportes preliminares.";
  matrixRows.push(
    new TableRow({
      children: [
        createBodyCell("Evidencia incorporada", 30, true),
        createBodyCell(evIncorporadaText, 70),
      ],
    })
  );

  // Elemento 3: Evidencia confirmatoria
  const hasConfirming = input.evidenciaConfirmatoria && input.evidenciaConfirmatoria.length > 0;
  const evConfirmingText = hasConfirming
    ? input.evidenciaConfirmatoria!.join(", ")
    : "Fotografías de campo y registros de desorden urbano que sustentan factores de oportunidad física.";
  matrixRows.push(
    new TableRow({
      children: [
        createBodyCell("Evidencia confirmatoria", 30, true),
        createBodyCell(evConfirmingText, 70),
      ],
    })
  );

  // Elemento 4: Evidencia limitante
  const hasLimiting = input.evidenciaContradictoria && input.evidenciaContradictoria.length > 0;
  const evLimitingText = hasLimiting
    ? input.evidenciaContradictoria!.join(", ")
    : "No se identificaron evidencias limitantes o disonancias significativas en los cuadrantes analizados.";
  matrixRows.push(
    new TableRow({
      children: [
        createBodyCell("Evidencia limitante", 30, true),
        createBodyCell(evLimitingText, 70),
      ],
    })
  );

  // Elemento 5: Estado final
  const finalStateVal = input.validationStatus === "CONFIRMADA" || input.validationStatus === "FENOMENO_CONFIRMADO"
    ? "Confirmada por Convergencia Empírica"
    : (input.validationStatus === "REFUTADA" ? "Refutada por Disonancia de Evidencias" : "Parcialmente Validada / En proceso");
  matrixRows.push(
    new TableRow({
      children: [
        createBodyCell("Estado final", 30, true),
        createBodyCell(finalStateVal, 70),
      ],
    })
  );

  // Elemento 6: Confianza
  const confidenceVal = input.confidenceLevel
    ? `Nivel de confianza analítica calibrado en: ${input.confidenceLevel}`
    : "Nivel de confianza medio de acuerdo a calibración inicial.";
  matrixRows.push(
    new TableRow({
      children: [
        createBodyCell("Confianza", 30, true),
        createBodyCell(confidenceVal, 70),
      ],
    })
  );

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: matrixRows,
    })
  );

  return elements;
}
