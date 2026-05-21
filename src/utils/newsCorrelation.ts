export const correlateNews = (
  osintResults: any
) => {

  const allNews = [

    ...(osintResults?.news || []),

    ...(osintResults?.gnews || []),

    ...(osintResults?.newsdata || []),

    ...(osintResults?.thenews || []),

    ...(osintResults?.serp || []),

  ];

  const criminalKeywords = [

    'homicidio',
    'droga',
    'narcomenudeo',
    'violencia',
    'robo',
    'arma',
    'asesinato',
    'cartel',
    'gdo',
    'levantón',
    'ejecución',
    'secuestro',

  ];

  let relevanceScore = 0;

  const matchedKeywords: string[] = [];

  const relevantNews =
    allNews.filter((item: any) => {

      const text = JSON.stringify(item)
        .toLowerCase();

      let matched = false;

      criminalKeywords.forEach(keyword => {

        if (text.includes(keyword)) {

          matched = true;

          relevanceScore += 5;

          if (
            !matchedKeywords.includes(
              keyword
            )
          ) {

            matchedKeywords.push(keyword);

          }

        }

      });

      return matched;

    });

  return {

    totalNews:
      allNews.length,

    relevantNews,

    relevanceScore,

    matchedKeywords,

    threatLevel:
      relevanceScore >= 40
        ? 'ALTO'
        : relevanceScore >= 20
        ? 'MEDIO'
        : 'BAJO',

  };

};