// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Parser from "rss-parser";

export type NewsOsintResult = {
  exito: boolean;
  resumen: string;
  noticiasRelevantes: { titular: string; fuente: string; fecha: string; url: string }[];
};

const NEWS_API_KEY = process.env.NEWS_API_TOKEN || "ec9ae852706040efa3a92fea10feb23f";

// Canales RSS hiperlocales y nacionales de nota roja
const RSS_FEEDS = [
  // Nacionales y Aguascalientes (Existentes)
  { nombre: "El Heraldo de Ags", url: "https://www.heraldo.mx/feed/" },
  { nombre: "El Sol del Centro", url: "https://www.elsoldelcentro.com.mx/policiaca/rss.xml" },
  { nombre: "BI Noticias", url: "https://www.binoticias.com/rss.xml" },
  { nombre: "Milenio Policía", url: "https://www.milenio.com/rss/policia" },
  // Aguascalientes (Nuevos)
  { nombre: "Hidrocálido Digital", url: "https://www.hidrocalidodigital.com/feed/" },
  { nombre: "Página 24", url: "https://pagina24.com.mx/feed/" },
  { nombre: "LJA.mx", url: "https://www.lja.mx/feed/" },
  // Zacatecas
  { nombre: "El Sol de Zacatecas", url: "https://www.elsoldezacatecas.com.mx/rss.xml" },
  { nombre: "NTR Zacatecas", url: "https://ntrzacatecas.com/feed/" },
  { nombre: "Página 24 Zacatecas", url: "https://pagina24zacatecas.com.mx/feed/" },
  { nombre: "Imagen Zacatecas", url: "https://imagenzac.com.mx/feed/" },
  { nombre: "La Jornada Zacatecas", url: "https://ljz.mx/feed/" },
  // Jalisco
  { nombre: "El Informador", url: "https://www.informador.mx/rss/informador.xml" },
  { nombre: "El Occidental", url: "https://www.eloccidental.com.mx/rss.xml" },
  { nombre: "Notisistema", url: "https://www.notisistema.com/noticias/feed/" },
  { nombre: "Tráfico ZMG", url: "https://traficozmg.com/feed/" },
  { nombre: "UDG TV", url: "https://udgtv.com/feed/" },
  { nombre: "Líder Informativo", url: "https://lider919.com/feed/" },
  // San Luis Potosí
  { nombre: "El Sol de San Luis", url: "https://www.elsoldesanluis.com.mx/rss.xml" },
  { nombre: "Plano Informativo", url: "https://planoinformativo.com/rss.xml" },
  { nombre: "Pulso Diario de San Luis", url: "https://pulsoslp.com.mx/feed/" },
  { nombre: "Astrolabio Diario Digital", url: "https://www.astrolabio.com.mx/feed/" },
  { nombre: "La Orquesta", url: "https://laorquesta.mx/feed/" },
  // Guanajuato
  { nombre: "Periódico AM (León)", url: "https://www.am.com.mx/rss.xml" },
  { nombre: "El Sol de León", url: "https://www.elsoldeleon.com.mx/rss.xml" },
  { nombre: "El Sol de Irapuato", url: "https://www.elsoldeirapuato.com.mx/rss.xml" },
  { nombre: "Periódico Correo", url: "https://periodicocorreo.com.mx/feed/" },
  { nombre: "Zona Franca", url: "https://zonafranca.mx/feed/" }
];

export async function searchNewsOsint(
  colonia: string | null,
  municipio: string | null,
  estado: string | null
): Promise<NewsOsintResult> {
  if (!municipio && !estado) {
    return { exito: false, resumen: "Sin ubicación suficiente para el rastreo de noticias.", noticiasRelevantes: [] };
  }

  const keywords = ["robo", "asalto", "homicidio", "asesinato", "balacera", "cateo", "operativo", "cártel", "narcomenudeo", "riña", "detenido", "violencia", "sicarios", "ejecutado", "feminicidio", "secuestro", "extorsión", "arma", "crimen", "policía"];
  const locationKeywords = [colonia, municipio, estado]
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .map((k) => k.toLowerCase());
  const stateKeyword = estado ? estado.toLowerCase() : "";

  let noticias: { titular: string; fuente: string; fecha: string; url: string }[] = [];

  try {
    // 1. Búsqueda con News API (Satélite Global)
    const loc = colonia ? `"${colonia}" OR "${municipio}"` : `"${municipio}"`;
    const query = `(${loc}) AND (${keywords.join(" OR ")})`;
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=es&sortBy=publishedAt&pageSize=5&apiKey=${NEWS_API_KEY}`;

    const res = await fetch(url, { headers: { "User-Agent": "PerfiladorRemoto/1.0" } }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data.articles && data.articles.length > 0) {
        const apiNoticias = data.articles.map((art: { title: string; source?: { name: string }; publishedAt?: string; url: string }) => ({
          titular: art.title,
          fuente: art.source?.name || "News API",
          fecha: art.publishedAt ? new Date(art.publishedAt).toLocaleDateString("es-MX") : "Reciente",
          url: art.url
        }));
        noticias = [...noticias, ...apiNoticias];
      }
    }
  } catch (err) {
    console.warn("[newsOsint] Error en API Global:", err);
  }

  try {
    // 2. Búsqueda con RSS (Satélites Hiperlocales)
    const parser = new Parser({ timeout: 5000 });
    const rssPromises = RSS_FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        const articulosLocales = parsed.items.filter((item: { title?: string; contentSnippet?: string; pubDate?: string; link?: string }) => {
          if (!item.title) return false;
          const fullText = (item.title + " " + (item.contentSnippet || "")).toLowerCase();
          const hasLocation = locationKeywords.some(lk => fullText.includes(lk));
          const hasCrime = keywords.some(kw => fullText.includes(kw));
        const hasState = stateKeyword ? fullText.includes(stateKeyword) : false;
        return (hasLocation && hasCrime) || (hasCrime && hasState);
        });

        return articulosLocales.map((art: { title?: string; contentSnippet?: string; pubDate?: string; link?: string }) => ({
          titular: art.title || "Sin título",
          fuente: feed.nombre,
          fecha: art.pubDate ? new Date(art.pubDate).toLocaleDateString("es-MX") : "Reciente",
          url: art.link || ""
        }));
      } catch (e) {
        return [];
      }
    });

    const rssResults = await Promise.all(rssPromises);
    for (const group of rssResults) {
      for (const rssArt of group) {
        if (!noticias.some((n) => n.titular === rssArt.titular)) {
          noticias.push(rssArt);
        }
      }
    }
  } catch (err) {
    console.error("[newsOsint] Error en rastreo RSS:", err);
  }

  if (noticias.length === 0) {
    return { exito: true, resumen: "No se encontró nota roja reciente ni reportes periodísticos de alto impacto para esta zona.", noticiasRelevantes: [] };
  }

  noticias = noticias.slice(0, 10); // Limitamos a las 10 más relevantes
  return {
    exito: true,
    resumen: `Se extrajeron ${noticias.length} notas periodísticas de alto impacto vinculadas a la zona (fusionando satélites globales y prensa local).`,
    noticiasRelevantes: noticias
  };
}