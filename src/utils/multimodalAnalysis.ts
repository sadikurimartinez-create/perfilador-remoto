interface MultimodalResult {
  contextualRisk: 'Bajo' | 'Medio' | 'Alto';
  consistencyScore: number;
  interpretation: string;
  indicators: string[];
}

export const analyzeMultimodalContext = (
  project: any
): MultimodalResult => {

  const findings =
    project?.iaAnalysis || [];

  const textNotes =
    project?.textNotes || [];

  const voiceNotes =
    project?.voiceNotes || [];

  const objectives =
    project?.objectives || [];

  let score = 0;

  const indicators: string[] = [];

  const highRisk =
    findings.filter(
      (f: any) =>
        f.riskLevel === 'high' ||
        f.riskLevel === 'alto'
    ).length;

  if (highRisk >= 3) {

    score += 35;

    indicators.push(
      'Concentración de hallazgos de riesgo alto'
    );
  }

  if (textNotes.length >= 3) {

    score += 15;

    indicators.push(
      'Amplia narrativa contextual registrada'
    );
  }

  if (voiceNotes.length >= 2) {

    score += 15;

    indicators.push(
      'Múltiples dictados operacionales detectados'
    );
  }

  if (objectives.length >= 3) {

    score += 15;

    indicators.push(
      'Diversidad de objetivos investigativos'
    );
  }

  if (
    project.geometryType === 'polygon'
  ) {

    score += 20;

    indicators.push(
      'Cobertura territorial amplia'
    );
  }

  let contextualRisk:
    | 'Bajo'
    | 'Medio'
    | 'Alto' = 'Bajo';

  if (score >= 70) {
    contextualRisk = 'Alto';
  } else if (score >= 40) {
    contextualRisk = 'Medio';
  }

  let interpretation =
    'La integración multimodal no muestra patrones criminológicos significativos.';

  if (contextualRisk === 'Alto') {

    interpretation =
      'La correlación multimodal entre hallazgos IA, narrativa contextual, dictados operacionales y distribución territorial sugiere un entorno criminológico complejo compatible con dinámicas territoriales de alto riesgo.';
  }

  else if (
    contextualRisk === 'Medio'
  ) {

    interpretation =
      'La evidencia multimodal presenta coincidencias contextuales relevantes que sugieren actividad criminológica emergente y necesidad de monitoreo continuo.';
  }

  return {

    contextualRisk,

    consistencyScore: score,

    interpretation,

    indicators,

  };
};