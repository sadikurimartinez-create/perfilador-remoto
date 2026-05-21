import axios from 'axios';

const SERPAPI_KEY =
  process.env.PGP_SERPAPI_API_KEY || process.env.NEXT_PUBLIC_PGP_SERPAPI_API_KEY || "";

const NEWSAPI_KEY =
  process.env.PGP_NEWS_API_KEY || process.env.NEXT_PUBLIC_PGP_NEWS_API_KEY || "";

const GNEWS_KEY =
  process.env.PGP_GNEWS_API_KEY || process.env.NEXT_PUBLIC_PGP_GNEWS_API_KEY || "";

const NEWSDATA_KEY =
  process.env.PGP_NEWSDATA_API_KEY || process.env.NEXT_PUBLIC_PGP_NEWSDATA_API_KEY || "";

const THENEWS_KEY =
  process.env.PGP_THE_NEWS_API_KEY || process.env.NEXT_PUBLIC_PGP_THE_NEWS_API_KEY || "";

const DENUE_KEY =
  process.env.PGP_INEGI_DENUE_TOKEN || process.env.NEXT_PUBLIC_PGP_INEGI_DENUE_TOKEN || "";

export const searchSerpAPI = async (
  query: string
) => {

  if (!SERPAPI_KEY) {
    console.warn("SERPAPI_KEY no configurada. Omitiendo búsqueda.");
    return [];
  }

  try {

    const response =
      await axios.get(
        'https://serpapi.com/search.json',
        {
          params: {
            q: query,
            api_key: SERPAPI_KEY,
          },
        }
      );

    return (
      response.data?.organic_results || []
    );

  } catch (error) {

    console.error(
      'SERPAPI ERROR',
      error
    );

    return [];

  }

};

export const searchNewsAPI = async (
  query: string
) => {

  if (!NEWSAPI_KEY) {
    console.warn("NEWSAPI_KEY no configurada. Omitiendo búsqueda.");
    return [];
  }

  try {

    const response =
      await axios.get(
        'https://newsapi.org/v2/everything',
        {
          params: {
            q: query,
            apiKey: NEWSAPI_KEY,
            language: 'es',
          },
        }
      );

    return (
      response.data?.articles || []
    );

  } catch (error) {

    console.error(
      'NEWSAPI ERROR',
      error
    );

    return [];

  }

};

export const searchGNews = async (
  query: string
) => {

  if (!GNEWS_KEY) {
    console.warn("GNEWS_KEY no configurada. Omitiendo búsqueda.");
    return [];
  }

  try {

    const response =
      await axios.get(
        'https://gnews.io/api/v4/search',
        {
          params: {
            q: query,
            token: GNEWS_KEY,
            lang: 'es',
          },
        }
      );

    return (
      response.data?.articles || []
    );

  } catch (error) {

    console.error(
      'GNEWS ERROR',
      error
    );

    return [];

  }

};

export const searchNewsData = async (
  query: string
) => {

  if (!NEWSDATA_KEY) {
    console.warn("NEWSDATA_KEY no configurada. Omitiendo búsqueda.");
    return [];
  }

  try {

    const response =
      await axios.get(
        'https://newsdata.io/api/1/news',
        {
          params: {
            q: query,
            apikey: NEWSDATA_KEY,
            language: 'es',
          },
        }
      );

    return (
      response.data?.results || []
    );

  } catch (error) {

    console.error(
      'NEWSDATA ERROR',
      error
    );

    return [];

  }

};

export const searchTheNewsAPI = async (
  query: string
) => {

  if (!THENEWS_KEY) {
    console.warn("THENEWS_KEY no configurada. Omitiendo búsqueda.");
    return [];
  }

  try {

    const response =
      await axios.get(
        'https://api.thenewsapi.com/v1/news/all',
        {
          params: {
            api_token: THENEWS_KEY,
            search: query,
            language: 'es',
          },
        }
      );

    return (
      response.data?.data || []
    );

  } catch (error) {

    console.error(
      'THENEWSAPI ERROR',
      error
    );

    return [];

  }

};

export const searchDENUE = async (
  lat: number,
  lng: number
) => {

  if (!DENUE_KEY) {
    console.warn("DENUE_KEY no configurada. Omitiendo búsqueda.");
    return [];
  }

  try {

    const response =
      await axios.get(
        `https://www.inegi.org.mx/app/api/denue/v1/consulta/buscar/restaurant/${lat},${lng}/500/${DENUE_KEY}`
      );

    return response.data || [];

  } catch (error) {

    console.error(
      'DENUE ERROR',
      error
    );

    return [];

  }

};