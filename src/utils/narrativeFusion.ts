interface NarrativeResult {

  narrative: string;

  operationalAssessment: string;

  territorialInterpretation: string;

  sources: string[];

}

export const buildNarrativeFusion = (

  project: any,

  osintResults: any,

) : NarrativeResult => {

  const findings =
    project?.iaAnalysis || [];

  const photos =
    project?.photos || [];

  const riskHigh =
    findings.filter(
      (f: any) =>
        f.riskLevel === 'high' ||
        f.riskLevel === 'alto'
    ).length;

  const socialSignals =
    (
      osintResults?.reddit
        ?.length || 0
    ) +
    (
      osintResults?.x
        ?.length || 0
    ) +
    (
      osintResults?.telegram
        ?.length || 0
    );

  const urbanSignals =
    (
      osintResults?.googlePlaces
        ?.length || 0
    ) +
    (
      osintResults?.denue
        ?.length || 0
    );

  const newsSignals =
    (
      osintResults?.news
        ?.length || 0
    ) +
    (
      osintResults?.gnews
        ?.length || 0
    ) +
    (
      osintResults?.newsdata
        ?.length || 0
    );

  let narrative =
    'El análisis criminológico ambiental realizado por CEIPOL permitió identificar patrones territoriales compatibles con dinámicas de riesgo operacional.';

  if (riskHigh >= 3) {

    narrative +=
      ' La persistencia de hallazgos clasificados como riesgo alto sugiere actividad criminológica consolidada en el polígono analizado.';

  }

  if (urbanSignals >= 15) {

    narrative +=
      ' El contexto urbano detectado evidencia infraestructura potencialmente asociada a vulnerabilidad criminógena y movilidad territorial.';

  }

  if (socialSignals >= 10) {

    narrative +=
      ' La narrativa social OSINT detectó referencias compatibles con percepción comunitaria de inseguridad y actividad criminal emergente.';

  }

  if (newsSignals >= 10) {

    narrative +=
      ' La correlación noticiosa identificó incidencia territorial consistente con eventos violentos y actividad delictiva regional.';

  }

  let territorialInterpretation =
    'El territorio presenta comportamiento operacional estable.';

  if (
    riskHigh >= 3 &&
    newsSignals >= 10
  ) {

    territorialInterpretation =
      'El territorio analizado presenta características compatibles con corredor criminológico de riesgo medio-alto con persistencia espacial detectable.';

  }

  let operationalAssessment =
    'Se recomienda monitoreo preventivo.';

  if (
    socialSignals >= 10 ||
    riskHigh >= 4
  ) {

    operationalAssessment =
      'Se recomienda vigilancia territorial reforzada, monitoreo OSINT continuo y análisis geoespacial permanente.';

  }

  const sources: string[] = [];

  if (
    osintResults?.news?.length
  ) {

    sources.push(
      'NewsAPI'
    );

  }

  if (
    osintResults?.gnews?.length
  ) {

    sources.push(
      'GNews'
    );

  }

  if (
    osintResults?.newsdata
      ?.length
  ) {

    sources.push(
      'NewsData.io'
    );

  }

  if (
    osintResults?.thenews
      ?.length
  ) {

    sources.push(
      'TheNewsAPI'
    );

  }

  if (
    osintResults?.reddit
      ?.length
  ) {

    sources.push(
      'Reddit'
    );

  }

  if (
    osintResults?.x?.length
  ) {

    sources.push(
      'X/Twitter'
    );

  }

  if (
    osintResults?.denue
      ?.length
  ) {

    sources.push(
      'DENUE INEGI'
    );

  }

  if (
    osintResults?.googlePlaces
      ?.length
  ) {

    sources.push(
      'Google Places'
    );

  }

  if (
    osintResults?.overpass
      ?.length
  ) {

    sources.push(
      'OpenStreetMap Overpass'
    );

  }

  if (
    osintResults?.telegram
      ?.length
  ) {

    sources.push(
      'Telegram'
    );

  }

  return {

    narrative,

    operationalAssessment,

    territorialInterpretation,

    sources,

  };

};