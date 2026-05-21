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

import {
  searchOverpass,
  searchGooglePlaces,
} from './urbanProviders';

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

  let overpass: any[] = [];

  let googlePlaces: any[] = [];

  if (
    project?.latitude &&
    project?.longitude
  ) {

    denue =
      await searchDENUE(
        project.latitude,
        project.longitude
      );

    overpass =
      await searchOverpass(
        project.latitude,
        project.longitude
      );

    googlePlaces =
      await searchGooglePlaces(
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

    overpass,

    googlePlaces,

    totalResults:
      (serp?.length || 0) +
      (news?.length || 0) +
      (gnews?.length || 0) +
      (newsdata?.length || 0) +
      (thenews?.length || 0) +
      (denue?.length || 0) +
      (reddit?.length || 0) +
      (x?.length || 0) +
      (overpass?.length || 0) +
      (googlePlaces?.length || 0),

  };

};