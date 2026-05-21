interface VisualFinding {

  indicator: string;

  risk:
    | 'BAJO'
    | 'MEDIO'
    | 'ALTO';

  score: number;

}

interface VisualResult {

  totalIndicators: number;

  visualScore: number;

  visualRisk:
    | 'BAJO'
    | 'MEDIO'
    | 'ALTO';

  findings: VisualFinding[];

}

export const runVisualClassifier = (
  project: any
): VisualResult => {

  const findings:
    VisualFinding[] = [];

  let score = 0;

  const photos =
    project?.photos || [];

  photos.forEach(
    (photo: any) => {

      const text =
        JSON.stringify(photo)
          .toLowerCase();

      const indicators = [

        {
          keyword: 'grafiti',
          risk: 'MEDIO',
          points: 8,
        },

        {
          keyword: 'basura',
          risk: 'MEDIO',
          points: 6,
        },

        {
          keyword: 'abandono',
          risk: 'ALTO',
          points: 10,
        },

        {
          keyword: 'vehículo',
          risk: 'MEDIO',
          points: 7,
        },

        {
          keyword: 'oscuridad',
          risk: 'ALTO',
          points: 9,
        },

        {
          keyword: 'lote',
          risk: 'ALTO',
          points: 10,
        },

        {
          keyword: 'vigilancia',
          risk: 'MEDIO',
          points: 7,
        },

      ];

      indicators.forEach(item => {

        if (
          text.includes(
            item.keyword
          )
        ) {

          score += item.points;

          findings.push({

            indicator:
              item.keyword,

            risk:
              item.risk as
                | 'BAJO'
                | 'MEDIO'
                | 'ALTO',

            score:
              item.points,

          });

        }

      });

    }
  );

  let visualRisk:
    | 'BAJO'
    | 'MEDIO'
    | 'ALTO' = 'BAJO';

  if (score >= 40) {

    visualRisk = 'ALTO';

  }

  else if (
    score >= 20
  ) {

    visualRisk = 'MEDIO';

  }

  return {

    totalIndicators:
      findings.length,

    visualScore: score,

    visualRisk,

    findings,

  };

};