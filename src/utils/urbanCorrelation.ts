export const correlateUrbanContext = (

  denue: any[],

  overpass: any[],

  googlePlaces: any[],

) => {

  const indicators: string[] = [];

  let urbanScore = 0;

  const all = [

    ...denue,

    ...overpass,

    ...googlePlaces,

  ];

  const riskyKeywords = [

    'bar',
    'cantina',
    'hotel',
    'motel',
    'casino',
    'night_club',
    'liquor',
    'gas_station',
    'yonke',
    'taller',

  ];

  const matches =
    all.filter((item: any) => {

      const text =
        JSON.stringify(item)
          .toLowerCase();

      let matched = false;

      riskyKeywords.forEach(keyword => {

        if (
          text.includes(keyword)
        ) {

          matched = true;

          urbanScore += 5;

          if (
            !indicators.includes(
              keyword
            )
          ) {

            indicators.push(keyword);

          }

        }

      });

      return matched;

    });

  return {

    totalPlaces:
      all.length,

    riskyPlaces:
      matches.length,

    urbanScore,

    indicators,

    riskLevel:
      urbanScore >= 40
        ? 'ALTO'
        : urbanScore >= 20
        ? 'MEDIO'
        : 'BAJO',

  };

};