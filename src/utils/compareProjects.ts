interface CorrelationResult {
  similarityScore: number;
  territorialCoincidence: boolean;
  riskPattern: string;
  interpretation: string;
}

export const compareProjects = (
  currentProject: any,
  otherProjects: any[]
): CorrelationResult[] => {

  if (!otherProjects || otherProjects.length === 0) {
    return [];
  }

  return otherProjects.map(project => {

    let similarityScore = 0;

    const currentFindings =
      currentProject.iaAnalysis || [];

    const otherFindings =
      project.iaAnalysis || [];

    const currentHigh =
      currentFindings.filter(
        (f: any) =>
          f.riskLevel === 'high' ||
          f.riskLevel === 'alto'
      ).length;

    const otherHigh =
      otherFindings.filter(
        (f: any) =>
          f.riskLevel === 'high' ||
          f.riskLevel === 'alto'
      ).length;

    if (
      currentProject.geometryType ===
      project.geometryType
    ) {
      similarityScore += 30;
    }

    if (
      Math.abs(currentHigh - otherHigh) <= 2
    ) {
      similarityScore += 30;
    }

    if (
      currentFindings.length ===
      otherFindings.length
    ) {
      similarityScore += 20;
    }

    const territorialCoincidence =
      similarityScore >= 60;

    let riskPattern =
      'Actividad criminológica emergente';

    if (similarityScore >= 80) {
      riskPattern =
        'Patrón territorial altamente coincidente';
    } else if (
      similarityScore >= 60
    ) {
      riskPattern =
        'Posible reincidencia territorial';
    }

    return {

      similarityScore,

      territorialCoincidence,

      riskPattern,

      interpretation:
        `El proyecto "${project.name}" presenta un nivel de similitud criminológica del ${similarityScore}% respecto al proyecto analizado.`,

    };

  });

};