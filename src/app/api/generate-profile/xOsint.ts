import { TwitterApi } from 'twitter-api-v2';

let client: TwitterApi | null = null;

function getClient() {
  if (client) return client;
  if (process.env.X_API_KEY && process.env.X_API_SECRET && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET) {
    client = new TwitterApi({
      appKey: process.env.X_API_KEY,
      appSecret: process.env.X_API_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
    });
    return client;
  }
  return null;
}

export type XOsintResult = {
  exito: boolean;
  resumen: string;
  tweetsRelevantes: { texto: string; autor: string; url: string }[];
};

/**
 * Realiza una búsqueda de tuits recientes relacionados con una ubicación y palabras clave.
 */
export async function searchXTweets(colonia: string | null, municipio: string | null): Promise<XOsintResult> {
  const twitterClient = getClient();
  if (!twitterClient) {
    console.warn("[xOsint] Faltan credenciales de la API de X/Twitter. Se omitirá el barrido.");
    return { exito: false, resumen: "Barrido OSINT en X/Twitter no configurado (faltan credenciales).", tweetsRelevantes: [] };
  }

  if (!colonia && !municipio) {
    return { exito: false, resumen: "No se proporcionó ubicación para el barrido en X/Twitter.", tweetsRelevantes: [] };
  }

  const keywords = [
    "balazos", "disparos", "asalto", "robo", "inseguridad", "operativo",
    "patrullas", "detenido", "pleito", "riña", "bloqueo", "alerta", "ayuda"
  ];
  
  const locationQuery = [colonia, municipio].filter(Boolean).map(loc => `"${loc}"`).join(' OR ');
  const keywordQuery = keywords.join(' OR ');
  
  const query = `(${locationQuery}) (${keywordQuery}) -is:retweet lang:es`;

  try {
    const searchResult = await twitterClient.readOnly.v2.search(query, {
      'tweet.fields': ['created_at', 'author_id', 'text'],
      'user.fields': ['username'],
      'expansions': ['author_id'],
      'max_results': 15,
    });

    if (searchResult.meta.result_count === 0) {
      return { exito: true, resumen: "No se encontraron reportes ciudadanos relevantes recientes en X/Twitter para la zona.", tweetsRelevantes: [] };
    }

    const tweets = searchResult.includes.users ? searchResult.data.data.map(tweet => {
        const author = searchResult.includes.users!.find(user => user.id === tweet.author_id);
        return {
            texto: tweet.text.replace(/https:\/\/\S+/g, '').trim(), // Limpiar URLs
            autor: author ? author.username : 'Desconocido',
            url: `https://twitter.com/${author?.username ?? 'i'}/status/${tweet.id}`
        };
    }) : [];

    return { exito: true, resumen: `Se encontraron ${tweets.length} reportes ciudadanos recientes en X/Twitter.`, tweetsRelevantes: tweets };
  } catch (err) {
    console.error("[xOsint] Error al realizar la búsqueda en X/Twitter:", err);
    return { exito: false, resumen: `Fallo en la conexión con la API de X/Twitter.`, tweetsRelevantes: [] };
  }
}