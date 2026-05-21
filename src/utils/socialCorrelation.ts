export const correlateSocialIntel = (
  redditResults: any[],
  xResults: any[]
) => {

  const combined = [

    ...redditResults,

    ...xResults,

  ];

  const socialKeywords = [

    'balacera',
    'sicario',
    'droga',
    'violencia',
    'robo',
    'narco',
    'cartel',
    'levantón',
    'asesinato',
    'ejecución',
    'arma',
    'disparos',

  ];

  let socialScore = 0;

  const detectedKeywords:
    string[] = [];

  const relevantPosts =
    combined.filter((item: any) => {

      const text =
        JSON.stringify(item)
          .toLowerCase();

      let matched = false;

      socialKeywords.forEach(keyword => {

        if (
          text.includes(keyword)
        ) {

          matched = true;

          socialScore += 4;

          if (
            !detectedKeywords.includes(
              keyword
            )
          ) {

            detectedKeywords.push(
              keyword
            );

          }

        }

      });

      return matched;

    });

  return {

    totalPosts:
      combined.length,

    relevantPosts,

    socialScore,

    detectedKeywords,

    threatLevel:
      socialScore >= 30
        ? 'ALTO'
        : socialScore >= 15
        ? 'MEDIO'
        : 'BAJO',

  };

};