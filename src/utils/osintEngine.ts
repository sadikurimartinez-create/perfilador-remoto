import {

  searchSerpAPI,

  searchNewsAPI,

  searchGNews,

  searchNewsData,

  searchTheNewsAPI,

  searchDENUE,

} from './osintProviders';

import {
  searchReddit,
  searchX,
} from './socialProviders';

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

  const reddit =
    await searchReddit(query);

  const x =
    await searchX(query);

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

    reddit,

    x,

    totalResults:
      serp.length +
      news.length +
      gnews.length +
      newsdata.length +
      thenews.length +
      denue.length +
      reddit.length +
      x.length,

  };

};