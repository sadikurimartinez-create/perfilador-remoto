interface ThreatResult {

  threatScore: number;

  threatLevel:
    | 'BAJO'
    | 'MEDIO'
    | 'ALTO'
    | 'CRÍTICO';

  escalationRisk:
    | 'ESTABLE'
    | 'EMERGENTE'
    | 'CONSOLIDADO';

  interpretation: string;

  indicators: string[];

}

export const runThreatIntelligence = (

  project: any,

  osintResults: any,

) : ThreatResult => {

  const indicators: string[] = [];

  let score = 0;

  const findings =
    project?.iaAnalysis || [];

  const highRisk =
    findings.filter(
      (f: any) =>
        f.riskLevel === 'high' ||
        f.riskLevel === 'alto'
    ).length;

  if (highRisk >= 4) {

    score += 30;

    indicators.push(
      'Alta concentración de hallazgos críticos'
    );

  }

  const socialSignals =
    (
      osintResults?.reddit?.length || 0
    ) +
    (
      osintResults?.x?.length || 0
    );

  if (socialSignals >= 10) {

    score += 20;

    indicators.push(
      'Actividad social OSINT significativa'
    );

  }

  const urbanSignals =
    (
      osintResults?.googlePlaces
        ?.length || 0
    ) +
    (
      osintResults?.denue
        ?.length || 0
    );

  if (urbanSignals >= 20) {

    score += 20;

    indicators.push(
      'Entorno urbano criminógeno'
    );

  }

  const newsSignals =
    (
      osintResults?.news?.length || 0
    ) +
    (
      osintResults?.gnews?.length || 0
    ) +
    (
      osintResults?.newsdata?.length || 0
    );

  if (newsSignals >= 15) {

    score += 30;

    indicators.push(
      'Alta incidencia noticiosa criminal'
    );

  }

  let threatLevel:
    | 'BAJO'
    | 'MEDIO'
    | 'ALTO'
    | 'CRÍTICO' = 'BAJO';

  if (score >= 80) {

    threatLevel = 'CRÍTICO';

  }

  else if (score >= 60) {

    threatLevel = 'ALTO';

  }

  else if (score >= 35) {

    threatLevel = 'MEDIO';

  }

  let escalationRisk:
    | 'ESTABLE'
    | 'EMERGENTE'
    | 'CONSOLIDADO' =
      'ESTABLE';

  if (
    threatLevel === 'CRÍTICO'
  ) {

    escalationRisk =
      'CONSOLIDADO';

  }

  else if (
    threatLevel === 'ALTO'
  ) {

    escalationRisk =
      'EMERGENTE';

  }

  let interpretation =
    'La actividad territorial no presenta indicadores suficientes para inferir amenaza consolidada.';

  if (
    threatLevel === 'CRÍTICO'
  ) {

    interpretation =
      'La correlación entre hallazgos criminológicos, señales OSINT, narrativa social y contexto urbano indica una amenaza territorial consolidada compatible con dinámica criminal persistente.';

  }

  else if (
    threatLevel === 'ALTO'
  ) {

    interpretation =
      'Los indicadores territoriales y OSINT muestran riesgo criminológico elevado y posible escalamiento operativo.';

  }

  return {

    threatScore: score,

    threatLevel,

    escalationRisk,

    interpretation,

    indicators,

  };

};