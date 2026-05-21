export const calculateExecutiveMetrics = (
  projects: any[]
) => {

  const totalProjects =
    projects.length;

  let totalFindings = 0;

  let highRisk = 0;

  let mediumRisk = 0;

  let lowRisk = 0;

  projects.forEach(project => {

    const findings =
      project.iaAnalysis || [];

    totalFindings += findings.length;

    findings.forEach((finding: any) => {

      if (
        finding.riskLevel === 'high' ||
        finding.riskLevel === 'alto'
      ) {
        highRisk += 1;
      }

      else if (
        finding.riskLevel === 'medium' ||
        finding.riskLevel === 'medio'
      ) {
        mediumRisk += 1;
      }

      else {
        lowRisk += 1;
      }

    });

  });

  const averageRisk =
    totalFindings === 0
      ? 0
      : (
          (
            highRisk * 3 +
            mediumRisk * 2 +
            lowRisk
          ) / totalFindings
        ).toFixed(2);

  return {

    totalProjects,

    totalFindings,

    highRisk,

    mediumRisk,

    lowRisk,

    averageRisk,

  };
};