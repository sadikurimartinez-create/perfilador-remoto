import {
  Paragraph,
  TextRun,
  AlignmentType,
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
 * renderHypothesisTrajectory
 * Construye dinámicamente las secciones lineales nativas del Capítulo 0.
 * Eliminando tablas y matrices para apego estricto a las normas de gobernanza editorial v1.0.9.
 */
export function renderHypothesisTrajectory(input: HypothesisTrajectoryInput): any[] {
  const elements: any[] = [];

  const createSubSectionTitle = (text: string) => new Paragraph({
    keepNext: true,
    children: [new TextRun({ text, size: 18, bold: true, color: "0D2B52", font: "Calibri" })],
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

  // 0.2 Hipótesis Inicial
  elements.push(createSubSectionTitle("0.2 Hipótesis Inicial"));
  const initialHyp = input.hypothesisInitial && input.hypothesisInitial.trim().length > 0
    ? input.hypothesisInitial.trim()
    : "Expediente sin hipótesis formalizada. Estado exploratorio inicial.";
  elements.push(createNormalText(initialHyp, false));

  // 0.3 Evidencia Incorporada
  elements.push(createSubSectionTitle("0.3 Evidencia Incorporada"));
  if (input.evidenceLinks && input.evidenceLinks.length > 0) {
    input.evidenceLinks.forEach((e) => {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: `• [${e.evidence}] `, bold: true, color: "1F4E79", font: "Calibri", size: 16 }),
            new TextRun({ text: `${e.type}: `, bold: true, font: "Calibri", size: 16 }),
            new TextRun({ text: e.result, font: "Calibri", size: 16, italics: true })
          ],
          spacing: { after: 60 },
          indent: { left: 240 }
        })
      );
    });
  } else {
    elements.push(createNormalText("No se han incorporado evidencias formales en esta fase.", true));
  }

  // 0.4 Evolución de Hipótesis
  elements.push(createSubSectionTitle("0.4 Evolución de Hipótesis"));
  if (input.hypothesisEvolution && input.hypothesisEvolution.length > 0) {
    input.hypothesisEvolution.forEach((ev, idx) => {
      const action = ev.tipoChange || ev.tipoCambio || "Transición Analítica";
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Step #${idx + 1} [${action}]: `, bold: true, color: "0D2B52", font: "Calibri", size: 16 }),
            new TextRun({ text: `Estado: ${ev.estadoAnterior} → ${ev.estadoNuevo}. `, font: "Calibri", size: 16, bold: true }),
            new TextRun({ text: ev.justificacionAnalitica, font: "Calibri", size: 16, italics: true })
          ],
          spacing: { after: 60 },
          indent: { left: 240 }
        })
      );
    });
  } else {
    const defaultEvolutionText = `La hipótesis evolucionó desde su planteamiento inicial exploratorio conforme se integraron los datos espaciales y de campo del polígono analizado, permitiendo refinar los focos de oportunidad e interés táctico.`;
    elements.push(createNormalText(defaultEvolutionText, false));
  }

  // 0.5 Estado Final
  elements.push(createSubSectionTitle("0.5 Estado Final"));
  const statusMap: Record<string, string> = {
    "INICIAL": "Formulación Inicial",
    "EN_ANALISIS": "En Análisis",
    "HIPOTESIS_SUSTENTADA_POR_CONVERGENCIA": "Sustentada por Convergencia",
    "CONFIRMADA": "Confirmada con Certidumbre",
    "REFUTADA": "Refutada por Evidencia",
    "MODIFICADA": "Modificada bajo Ajuste",
    "FENOMENO_CONFIRMADO": "Fenómeno Confirmado",
  };
  const finalState = input.validationStatus && statusMap[input.validationStatus]
    ? statusMap[input.validationStatus]
    : (input.validationStatus || "En proceso de análisis");
  
  const justification = input.justificacionActual || "Análisis conclusivo estructurado bajo convergencia de evidencia física y espacial.";
  elements.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Estatus Analítico: `, bold: true, color: "2E7D32", font: "Calibri", size: 18 }),
        new TextRun({ text: `${finalState} `, bold: true, color: "2E7D32", font: "Calibri", size: 18 }),
        new TextRun({ text: `| Nivel de Confianza: ${input.confidenceLevel || "MEDIO"}\n`, bold: true, color: "0D2B52", font: "Calibri", size: 16 }),
        new TextRun({ text: `Justificación Técnica: `, bold: true, color: "5B6573", font: "Calibri", size: 14 }),
        new TextRun({ text: justification, font: "Calibri", size: 16, italics: true })
      ],
      spacing: { after: 120 },
      indent: { left: 240 }
    })
  );

  return elements;
}
