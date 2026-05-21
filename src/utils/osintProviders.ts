import axios from 'axios';

const SERPAPI_KEY =
  import.meta.env.VITE_SERPAPI_API_KEY;

const NEWSAPI_KEY =
  import.meta.env.VITE_NEWS_API_KEY;

const GNEWS_KEY =
  import.meta.env.VITE_GNEWS_API_KEY;

const NEWSDATA_KEY =
  import.meta.env.VITE_NEWSDATA_API_KEY;

const THENEWS_KEY =
  import.meta.env.VITE_THE_NEWS_API_KEY;

const DENUE_KEY =
  import.meta.env.VITE_INEGI_DENUE_TOKEN;

export const searchSerpAPI = async (
  query: string
) => {

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