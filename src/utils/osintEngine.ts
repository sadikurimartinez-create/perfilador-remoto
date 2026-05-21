import {

  searchSerpAPI,

  searchNewsAPI,

  searchGNews,

  searchNewsData,

  searchTheNewsAPI,

  searchDENUE,

} from './osintProviders';

export const runOSINTScan = async (
  project: any
) => {

  const location =
    project?.locationName ||
    'Aguascalientes';

  const query = `
    ${location}
    crimen OR violencia OR droga
    OR homicidio OR robo
  `;

  const serp =
    await searchSerpAPI(query);

  const news =
    await searchNewsAPI(query);

  const gnews =
    await searchGNews(query);

  const newsdata =
    await searchNewsData(query);

  const thenews =
    await searchTheNewsAPI(query);

  let denue: any[] = [];

  if (
    project?.latitude &&
    project?.longitude
  ) {

    denue =
      await searchDENUE(
        project.latitude,
        project.longitude
      );

  }

  return {

    serp,

    news,

    gnews,

    newsdata,

    thenews,

    denue,

    totalResults:
      serp.length +
      news.length +
      gnews.length +
      newsdata.length +
      thenews.length +
      denue.length,

  };

};