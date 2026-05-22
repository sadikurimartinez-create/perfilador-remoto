export type NewsOsintResult = {
  exito: boolean;
  resumen: string;
  noticiasRelevantes: { titular: string; fuente: string; fecha: string; url: string }[];
};

// Utilizamos News API por defecto (el token principal que proporcionaste)
const NEWS_API_KEY = process.env.NEWS_API_TOKEN || "ec9ae852706040efa3a92fea10feb23f";

export async function searchNewsOsint(
  colonia: string | null,
  municipio: string | null,
  estado: string | null
): Promise<NewsOsintResult> {
  if (!municipio && !estado) {
    return { exito: false, resumen: "Sin ubicación suficiente para el rastreo de noticias.", noticiasRelevantes: [] };
  }

  // Construimos una ecuación de búsqueda OSINT (Ej. "Centro" AND ("robo" OR "homicidio"...))
  const loc = colonia ? `"${colonia}" OR "${municipio}"` : `"${municipio}"`;
  const keywords = "robo OR asalto OR homicidio OR asesinato OR balacera OR cateo OR operativo OR cártel OR narcomenudeo OR riña OR detenido";
  const query = `(${loc}) AND (${keywords})`;

  // Endpoint de News API para buscar en todo internet en español
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=es&sortBy=publishedAt&pageSize=5&apiKey=${NEWS_API_KEY}`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": "PerfiladorRemoto/1.0" } });
    if (!res.ok) {
      console.warn("[newsOsint] Error API Noticias:", res.status);
      return { exito: false, resumen: "No se pudo conectar con los satélites de noticias.", noticiasRelevantes: [] };
    }

    const data = await res.json();

    if (!data.articles || data.articles.length === 0) {
      return { exito: true, resumen: "No se encontró nota roja reciente ni reportes periodísticos de alto impacto para esta zona.", noticiasRelevantes: [] };
    }

    const noticias = data.articles.map((art: any) => ({
      titular: art.title,
      fuente: art.source?.name || "Desconocida",
      fecha: art.publishedAt ? new Date(art.publishedAt).toLocaleDateString("es-MX") : "Reciente",
      url: art.url
    }));

    return {
      exito: true,
      resumen: `Se extrajeron ${noticias.length} notas periodísticas recientes de alto impacto vinculadas a la zona.`,
      noticiasRelevantes: noticias
    };

  } catch (err) {
    console.error("[newsOsint] Fallo en barrido de noticias:", err);
    return { exito: false, resumen: "Error interno al ejecutar el barrido hemerográfico.", noticiasRelevantes: [] };
  }
}