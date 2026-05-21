export const classifyCriminology = (findings: any[], geometryType: string) => {
  const riskLevels = findings.map(f => (f.riskLevel || '').toLowerCase());
  const highRiskCount = riskLevels.filter(r => r === 'alto' || r === 'high').length;
  
  let category = 'Entorno de Bajo Riesgo Situacional';
  let interpretation = 'Las condiciones ambientales y espaciales analizadas no presentan indicadores significativos de deterioro urbano o atractores delictivos que faciliten la comisión de conductas antisociales.';

  // Si hay alta densidad de riesgos o es un polígono complejo con algún riesgo alto
  if (highRiskCount >= 3 || (highRiskCount >= 1 && geometryType === 'poligono')) {
    category = 'Zona de Alta Vulnerabilidad Criminógena';
    interpretation = 'El entorno analizado presenta múltiples factores de riesgo, incluyendo signos de deterioro (Ventanas Rotas) y/o atractores que incrementan significativamente la oportunidad criminal según la teoría de las Actividades Rutinarias.';
  } 
  // Si hay riesgos moderados o algunos focos rojos aislados
  else if (highRiskCount > 0 || findings.length >= 4) {
    category = 'Área de Riesgo Moderado con Focos de Oportunidad';
    interpretation = 'Se identifican elementos puntuales de deterioro o desorganización social que, de no atenderse de manera preventiva, podrían escalar hacia problemas de seguridad mayores, favoreciendo la elección racional del infractor.';
  }

  return {
    category,
    interpretation
  };
};