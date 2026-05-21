interface ClassificationResult {
  category: string;
  interpretation: string;
  operationalRisk: 'Bajo' | 'Medio' | 'Alto';
}

export const classifyCriminology = (
  findings: any[],
  geometryType: string
): ClassificationResult => {

  const total = findings.length;

  const highRisk =
    findings.filter(
      f =>
        f.riskLevel === 'high' ||
        f.riskLevel === 'alto'
    ).length;

  const mediumRisk =
    findings.filter(
      f =>
        f.riskLevel === 'medium' ||
        f.riskLevel === 'medio'
    ).length;

  if (
    geometryType === 'polygon' &&
    highRisk >= 5
  ) {

    return {
      category:
        'Zona de posible concentración criminal',

      interpretation:
        'Se identifican múltiples hallazgos de riesgo alto distribuidos espacialmente dentro de un polígono geográfico, sugiriendo patrones compatibles con concentración territorial de actividad delictiva.',

      operationalRisk: 'Alto',
    };
  }

  if (
    geometryType === 'linear' &&
    highRisk >= 3
  ) {

    return {
      category:
        'Corredor de riesgo criminológico',

      interpretation:
        'La distribución lineal de eventos de riesgo alto sugiere movilidad territorial, tránsito operativo o posible corredor utilizado para actividades ilícitas.',

      operationalRisk: 'Alto',
    };
  }

  if (
    mediumRisk >= 3
  ) {

    return {
      category:
        'Zona de vulnerabilidad social y ambiental',

      interpretation:
        'Los hallazgos reflejan deterioro ambiental y factores de vulnerabilidad que pueden favorecer dinámicas criminógenas.',

      operationalRisk: 'Medio',
    };
  }

  if (
    total <= 2
  ) {

    return {
      category:
        'Punto focal aislado',

      interpretation:
        'La evidencia disponible muestra un evento focalizado sin suficiente densidad territorial para establecer patrones espaciales consolidados.',

      operationalRisk: 'Bajo',
    };
  }

  return {

    category:
      'Zona con actividad criminológica emergente',

    interpretation:
      'La distribución espacial de hallazgos sugiere actividad criminológica en desarrollo que requiere monitoreo territorial continuo.',

    operationalRisk: 'Medio',
  };
};