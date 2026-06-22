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

export const searchYouTubeOSINT = async (query: string) => {
  const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY || "";
  if (!YOUTUBE_KEY) {
    console.warn("YOUTUBE_API_KEY no configurada. Omitiendo búsqueda de YouTube.");
    return [];
  }

  try {
    console.log(`[YOUTUBE OSINT] 🚀 Buscando videos para: "${query}"`);
    // 1. Ejecutar búsqueda
    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 5,
        relevanceLanguage: 'es',
        key: YOUTUBE_KEY
      }
    });

    const searchItems = searchRes.data?.items || [];
    if (searchItems.length === 0) return [];

    const videoIds = searchItems.map((item: any) => item.id?.videoId).filter(Boolean);

    // 2. Obtener estadísticas e información adicional de los videos
    const detailsMap: Record<string, any> = {};
    if (videoIds.length > 0) {
      try {
        const videosRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
          params: {
            part: 'snippet,statistics,recordingDetails',
            id: videoIds.join(','),
            key: YOUTUBE_KEY
          }
        });
        const videoDetails = videosRes.data?.items || [];
        videoDetails.forEach((detail: any) => {
          detailsMap[detail.id] = detail;
        });
      } catch (err) {
        console.error("Error obteniendo detalles de videos de YouTube:", err);
      }
    }

    // 3. Obtener hilos de comentarios para cada video
    const results = [];
    for (const item of searchItems) {
      const videoId = item.id?.videoId;
      if (!videoId) continue;

      const detail = detailsMap[videoId] || {};
      const snippet = item.snippet || {};

      let comments: string[] = [];
      try {
        const commentsRes = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', {
          params: {
            part: 'snippet',
            videoId: videoId,
            maxResults: 3,
            order: 'relevance',
            key: YOUTUBE_KEY
          }
        });
        const commentItems = commentsRes.data?.items || [];
        comments = commentItems.map((cmt: any) => {
          return cmt.snippet?.topLevelComment?.snippet?.textDisplay || "";
        }).filter(Boolean);
      } catch (err) {
        // Ignorar si los comentarios están desactivados
        console.warn(`No se pudieron obtener comentarios para el video ${videoId}`);
      }

      // 4. Ubicación (recordingDetails)
      let location = null;
      if (detail.recordingDetails?.location) {
        const loc = detail.recordingDetails.location;
        location = {
          type: "Point",
          coordinates: [parseFloat(loc.longitude), parseFloat(loc.latitude)]
        };
      }

      results.push({
        videoId,
        title: snippet.title || "",
        description: snippet.description || "",
        channelTitle: snippet.channelTitle || "",
        channelId: snippet.channelId || "",
        publishedAt: snippet.publishedAt || "",
        views: detail.statistics?.viewCount ? parseInt(detail.statistics.viewCount) : 0,
        likes: detail.statistics?.likeCount ? parseInt(detail.statistics.likeCount) : 0,
        commentCount: detail.statistics?.commentCount ? parseInt(detail.statistics.commentCount) : 0,
        comments,
        location
      });
    }

    return results;
  } catch (error: any) {
    console.error('YOUTUBE DATA API ERROR:', error.response?.data?.error?.message || error.message);
    return [];
  }
};