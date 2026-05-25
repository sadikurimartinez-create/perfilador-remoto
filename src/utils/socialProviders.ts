import axios from 'axios';

const REDDIT_USER_AGENT =
  process.env.PGP_REDDIT_USER_AGENT || process.env.NEXT_PUBLIC_PGP_REDDIT_USER_AGENT || "";

const X_BEARER =
  process.env.PGP_X_BEARER_TOKEN || process.env.NEXT_PUBLIC_PGP_X_BEARER_TOKEN || process.env.PGP_X_ACCESS_TOKEN || process.env.NEXT_PUBLIC_PGP_X_ACCESS_TOKEN || "";

const TELEGRAM_TOKEN =
  process.env.PGP_TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_PGP_TELEGRAM_BOT_TOKEN || "";

export const searchReddit = async (
  query: string
) => {

  if (!REDDIT_USER_AGENT) {
    console.warn("REDDIT_USER_AGENT no configurado. Omitiendo búsqueda en Reddit.");
    return [];
  }

  try {

    const response =
      await axios.get(
        `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent':
              REDDIT_USER_AGENT,
          },
        }
      );

    return (
      response.data?.data?.children || []
    );

  } catch (error) {

    console.error(
      'REDDIT ERROR',
      error
    );

    return [];

  }

};

export const searchTelegram = async (
  query: string
) => {

  if (!TELEGRAM_TOKEN) {
    console.warn("Token de Telegram no configurado. Omitiendo búsqueda en Telegram.");
    return [];
  }

  try {
    // Nota: La API oficial de Bots de Telegram lee mensajes de grupos/canales donde el bot es miembro.
    // Utilizamos getUpdates para recuperar los mensajes recientes que el bot ha captado.
    const response = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`
    );

    const updates = response.data?.result || [];

    // Filtramos localmente por la palabra clave (query) proporcionada
    return updates.filter((update: any) => {
      const text = update.message?.text || update.channel_post?.text || "";
      return text.toLowerCase().includes(query.toLowerCase());
    });

  } catch (error) {
    console.error(
      'TELEGRAM ERROR',
      error
    );
    return [];
  }

};

export const searchX = async (
  query: string
) => {

  if (!X_BEARER) {
    console.warn("Tokens de X no configurados. Omitiendo búsqueda en X.");
    return [];
  }

  try {

    const response =
      await axios.get(
        'https://api.twitter.com/2/tweets/search/recent',
        {
          headers: {
            Authorization:
              `Bearer ${X_BEARER}`,
          },

          params: {
            query,
            max_results: 10,
          },
        }
      );

    return (
      response.data?.data || []
    );

  } catch (error) {

    console.error(
      'X/TWITTER ERROR',
      error
    );

    return [];

  }

};