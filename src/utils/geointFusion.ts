interface GeointFusionResult {

  territorialScore: number;

  hotspotDensity: number;

  environmentalRisk:
    | 'BAJO'
    | 'MEDIO'
    | 'ALTO';

  territorialPattern: string;

  indicators: string[];

}

export const runGeointFusion = (
  project: any,
  osintResults: any
): GeointFusionResult => {

  const findings =
    project?.iaAnalysis || [];

  const heatmapPoints =
    project?.photos || [];

  const indicators: string[] = [];

  let score = 0;

  const highRisk =
    findings.filter(
      (f: any) =>
        f.riskLevel === 'high' ||
        f.riskLevel === 'alto'
    ).length;

  if (highRisk >= 3) {

    score += 30;

    indicators.push(
      'Persistencia de hallazgos de riesgo alto'
    );

  }

  if (
    heatmapPoints.length >= 5
  ) {

    score += 20;

    indicators.push(
      'Alta concentración geoespacial'
    );

  }

  const urbanPlaces =
    (
      osintResults?.denue?.length || 0
    ) +
    (
      osintResults?.googlePlaces
        ?.length || 0
    );

  if (urbanPlaces >= 15) {

    score += 25;

    indicators.push(
      'Entorno urbano criminógeno'
    );

  }

  const osintNews =
    (
      osintResults?.news?.length || 0
    ) +
    (
      osintResults?.gnews?.length || 0
    );

  if (osintNews >= 10) {

    score += 25;

    indicators.push(
      'Alta actividad OSINT territorial'
    );

  }

  let environmentalRisk:
    | 'BAJO'
    | 'MEDIO'
    | 'ALTO' = 'BAJO';

  if (score >= 70) {

    environmentalRisk = 'ALTO';

  }

  else if (
    score >= 40
  ) {

    environmentalRisk = 'MEDIO';

  }

  let territorialPattern =
    'Actividad territorial estable';

  if (
    environmentalRisk === 'ALTO'
  ) {

    territorialPattern =
      'Corredor criminológico consolidado';

  }

  else if (
    environmentalRisk === 'MEDIO'
  ) {

    territorialPattern =
      'Zona de riesgo emergente';

  }

  return {

    territorialScore: score,

    hotspotDensity:
      heatmapPoints.length,

    environmentalRisk,

    territorialPattern,

    indicators,

  };

};