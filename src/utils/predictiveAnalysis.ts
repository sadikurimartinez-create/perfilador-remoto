interface PredictiveResult {

  projectedRisk:
    | 'Bajo'
    | 'Medio'
    | 'Alto';

  escalationProbability: number;

  territorialTrend: string;

  interpretation: string;

  indicators: string[];

}

export const runPredictiveAnalysis = (
  project: any
): PredictiveResult => {

  const findings =
    project?.iaAnalysis || [];

  const geometryType =
    project?.geometryType || 'individual';

  let score = 0;

  const indicators: string[] = [];

  const highRisk =
    findings.filter(
      (f: any) =>
        f.riskLevel === 'high' ||
        f.riskLevel === 'alto'
    ).length;

  const mediumRisk =
    findings.filter(
      (f: any) =>
        f.riskLevel === 'medium' ||
        f.riskLevel === 'medio'
    ).length;

  if (highRisk >= 4) {

    score += 40;

    indicators.push(
      'Persistencia de hallazgos de riesgo alto'
    );
  }

  if (mediumRisk >= 3) {

    score += 20;

    indicators.push(
      'Concentración de riesgo medio'
    );
  }

  if (
    geometryType === 'polygon'
  ) {

    score += 20;

    indicators.push(
      'Cobertura territorial amplia'
    );
  }

  if (
    findings.length >= 6
  ) {

    score += 20;

    indicators.push(
      'Alta densidad criminológica'
    );
  }

  let projectedRisk:
    | 'Bajo'
    | 'Medio'
    | 'Alto' = 'Bajo';

  if (score >= 70) {
    projectedRisk = 'Alto';
  }

  else if (score >= 40) {
    projectedRisk = 'Medio';
  }

  let territorialTrend =
    'Actividad territorial estable';

  if (projectedRisk === 'Alto') {

    territorialTrend =
      'Posible expansión criminológica territorial';
  }

  else if (
    projectedRisk === 'Medio'
  ) {

    territorialTrend =
      'Actividad criminológica emergente';
  }

  let interpretation =
    'No se detectan indicadores suficientes para inferir expansión territorial significativa.';

  if (projectedRisk === 'Alto') {

    interpretation =
      'La persistencia espacial y temporal de hallazgos de riesgo alto sugiere probabilidad elevada de escalamiento criminológico y expansión territorial.';
  }

  else if (
    projectedRisk === 'Medio'
  ) {

    interpretation =
      'Los patrones espaciales identificados sugieren evolución criminológica emergente que requiere monitoreo operativo continuo.';
  }

  return {

    projectedRisk,

    escalationProbability: score,

    territorialTrend,

    interpretation,

    indicators,

  };
};