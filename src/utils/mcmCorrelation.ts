"use server";

export interface CorrelatedEntity {
  id: string;
  value: string;
  type: "PERSONA" | "TELEFONO" | "VEHICULO" | "DOMICILIO" | "LUGAR_MENCIONADO" | "COMERCIO" | "PANDILLA" | "HASHTAG" | "COORDENADAS" | "EVENTO";
  confidence: number;
  sources: string[];
  occurrences: Array<{
    source: string;
    date: string | null;
    engine: string;
    contextText: string;
    providerId?: string | null;
    sourceReference?: string | null;
    sourceUrl?: string | null;
    acquisitionMode?: string | null;
  }>;
  reason: string;
}

export interface MCMResult {
  success: boolean;
  correlatedEntities: CorrelatedEntity[];
  deduplicatedCount: number;
  updatedHypothesis: string;
  graphData: {
    nodes: Array<{ id: string; group: string; label: string; details?: string }>;
    links: Array<{ source: string; target: string; label: string }>;
  };
  chronology: Array<{
    date: string | null;
    source: string;
    content: string;
    riskLevel: string;
  }>;
}

const COMMON_NAMES_IGNORE = new Set(["aguascalientes", "ceipol", "mexico", "noticias", "policia", "municipal", "ministerial", "seguridad"]);

// Helper to extract Mexican phones
function extractPhones(text: string): string[] {
  const phoneRegex = /\b(?:\+?52)?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
  const matches = text.match(phoneRegex) || [];
  return [...new Set(matches.map(p => p.replace(/[\s().-]/g, "").slice(-10)))].filter(p => p.startsWith("449") || p.length === 10);
}

// Helper to extract plates / vehicles
function extractPlates(text: string): string[] {
  const plateRegex = /\b(?:[A-Z]{3}-\d{4}-[A-Z\d]|[A-Z]{3}-\d{2}-\d{2}|\d-[A-Z]{3}-\d{2})\b/gi;
  const matches = text.match(plateRegex) || [];
  return [...new Set(matches.map(p => p.toUpperCase()))];
}

// Helper to extract hashtags
function extractHashtags(text: string): string[] {
  const hashRegex = /#[a-zA-Z0-9_ñÑ]+/g;
  const matches = text.match(hashRegex) || [];
  return [...new Set(matches.map(h => h.toLowerCase()))];
}

// Helper to scan for known aliases and gangs
const KNOWN_ALIASES = ["El Cholo", "El Comandante", "El Muerto", "El Muletas", "El Tripa", "El Diablo", "El Mencho", "El Chapo", "El Mayo", "El 13", "El 3G"];
const KNOWN_GANGS = ["Los Cholos 13", "Monstruos de VNSA", "La Oficina", "CJNG", "CDS", "Cartel de Sinaloa", "Cártel de Jalisco"];

export const runMultiSourceCorrelation = async (
  rawResults: any,
  project: any
): Promise<MCMResult> => {
  const correlatedMap = new Map<string, CorrelatedEntity>();
  let deduplicatedCount = 0;
  const seenContents = new Set<string>();
  const chronology: any[] = [];

  // Helper to normalize and add occurrences
  const registerOccurrence = (
    value: string,
    type: CorrelatedEntity["type"],
    source: string,
    date: string | null,
    engine: string,
    contextText: string,
    baseConfidence = 60,
    lineage?: { providerId?: string | null; sourceReference?: string | null; sourceUrl?: string | null; acquisitionMode?: string | null }
  ) => {
    if (!value || value.trim().length < 3) return;
    const cleanValue = value.trim();
    if (COMMON_NAMES_IGNORE.has(cleanValue.toLowerCase())) return;

    const key = `${type}_${cleanValue.toLowerCase()}`;
    const parsedDate = date ? Date.parse(date) : Number.NaN;
    const dateStr = Number.isFinite(parsedDate) ? new Date(parsedDate).toLocaleString("es-MX") : null;

    if (correlatedMap.has(key)) {
      const entity = correlatedMap.get(key)!;
      entity.occurrences.push({ source, date: dateStr, engine, contextText, ...lineage });
      if (!entity.sources.includes(source)) {
        entity.sources.push(source);
      }
      // Incremental confidence for multi-source matches
      entity.confidence = Math.min(98, entity.confidence + 15);
      entity.reason = `Entidad detectada en múltiples plataformas (${entity.sources.join(", ")}).`;
    } else {
      correlatedMap.set(key, {
        id: key,
        value: cleanValue,
        type,
        confidence: baseConfidence,
        sources: [source],
        occurrences: [{ source, date: dateStr, engine, contextText, ...lineage }],
        reason: `Mención de ${type.toLowerCase()} en ${source}.`
      });
    }
  };

  // Process all sources into a raw flat array of data items
  const rawItems: Array<{
    source: string;
    platform: string;
    content: string;
    date: string | null;
    engine: string;
    providerId?: string | null;
    sourceReference?: string | null;
    sourceUrl?: string | null;
    acquisitionMode?: string | null;
  }> = [];

  const lineage = (item: any, directUrl?: string | null) => ({
    providerId: item?.providerId ?? item?.epistemicIntegrity?.providerId ?? null,
    sourceReference: item?.sourceReference ?? item?.epistemicIntegrity?.sourceReference ?? null,
    sourceUrl: directUrl ?? item?.sourceUrl ?? item?.epistemicIntegrity?.sourceUrl ?? null,
    acquisitionMode: item?.acquisitionMode ?? item?.epistemicIntegrity?.acquisitionMode ?? null,
  });

  // 1. YouTube
  if (Array.isArray(rawResults?.youtube)) {
    rawResults.youtube.forEach((yt: any) => {
      rawItems.push({
        source: `YouTube - Canal: ${yt.channelTitle || "Desconocido"}`,
        platform: "YouTube",
        content: `${yt.title || ""} ${yt.description || ""} ${yt.comments?.join(" ") || ""}`,
        date: yt.publishedAt || null,
        engine: "YouTube Engine",
        ...lineage(yt, yt.videoId ? `https://www.youtube.com/watch?v=${yt.videoId}` : null),
      });
    });
  }

  // 2. Telegram
  if (Array.isArray(rawResults?.telegram)) {
    rawResults.telegram.forEach((tg: any) => {
      rawItems.push({
        source: `Telegram: ${tg.chat || "Monitorizado"}`,
        platform: "Telegram",
        content: tg.texto || "",
        date: tg.fecha ? new Date(tg.fecha).toISOString() : null,
        engine: "Telegram Monitor",
        ...lineage(tg),
      });
    });
  }

  // 3. X (Twitter)
  if (Array.isArray(rawResults?.x)) {
    rawResults.x.forEach((tweet: any) => {
      rawItems.push({
        source: "Twitter Search",
        platform: "X",
        content: tweet.text || "",
        date: tweet.created_at || null,
        engine: "X API v2",
        ...lineage(tweet, tweet.id ? `https://x.com/i/web/status/${tweet.id}` : null),
      });
    });
  }

  // 4. Reddit
  if (Array.isArray(rawResults?.reddit)) {
    rawResults.reddit.forEach((rd: any) => {
      const data = rd.data || {};
      rawItems.push({
        source: `Reddit: r/${data.subreddit || "Mexico"}`,
        platform: "Reddit",
        content: `${data.title || ""} ${data.selftext || ""}`,
        date: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : null,
        engine: "Reddit Engine",
        ...lineage(rd, data.permalink ? `https://www.reddit.com${data.permalink}` : null),
      });
    });
  }

  // 5. RSS (Radar) & News APIs (Serp, News, GNews)
  const newsCollections = Array.isArray(rawResults?.deduplicatedNews)
    ? rawResults.deduplicatedNews
    : [
        ...(rawResults?.news || []),
        ...(rawResults?.gnews || []),
        ...(rawResults?.newsdata || []),
        ...(rawResults?.thenews || []),
        ...(rawResults?.serp || []),
        ...(rawResults?.rssData || []),
      ];

  newsCollections.forEach((n: any) => {
    const title = n.title || n.titular || n.snippet || "";
    const desc = n.description || n.resumenTactico || "";
    const sourceName = n.source?.name || n.source || "Prensa Abierta";
    rawItems.push({
      source: sourceName,
      platform: "RSS/Noticias",
      content: `${title} ${desc}`,
      date: n.publishedAt || n.date || null,
      engine: "Radar OSINT Regional",
      ...lineage(n, n.link || null),
    });
  });

  if (Array.isArray(rawResults?.expandedSocial)) {
    rawResults.expandedSocial.forEach((post: any) => {
      rawItems.push({
        source: post.sourceName || post.source || "Red social abierta",
        platform: post.instance ? "Fediverse" : "Bluesky",
        content: post.text || post.description || "",
        date: post.publishedAt || null,
        engine: post.instance ? "Fediverse Intelligence" : "Bluesky Public Intelligence",
        ...lineage(post, post.sourceUrl || null),
      });
    });
  }

  if (Array.isArray(rawResults?.gdeltGeo)) {
    rawResults.gdeltGeo.forEach((geo: any) => {
      const locationName = typeof geo.locationName === "string" ? geo.locationName : "";
      rawItems.push({
        source: geo.sourceName || "GDELT GEO",
        platform: "GDELT GEO",
        content: `${locationName} ${geo.description || geo.text || ""}`.trim(),
        date: geo.publishedAt || geo.observedAt || null,
        engine: "GDELT GEO Intelligence (MENTIONED_LOCATION)",
        ...lineage(geo, geo.sourceUrl || null),
      });
      if (locationName) {
        registerOccurrence(
          locationName,
          "LUGAR_MENCIONADO",
          geo.sourceName || "GDELT GEO",
          geo.publishedAt || geo.observedAt || null,
          "GDELT GEO Intelligence",
          `Ubicación mencionada en cobertura; no equivale a ubicación del hecho: ${locationName}`,
          45,
          lineage(geo, geo.sourceUrl || null)
        );
      }
    });
  }

  // 6. Google Drive Ingested Data
  if (Array.isArray(rawResults?.driveData)) {
    rawResults.driveData.forEach((file: any) => {
      rawItems.push({
        source: `Google Drive: [${file.logicalCategory}] ${file.fileName}`,
        platform: "Google Drive",
        content: `${file.summary || ""} ${file.extractedText || ""}`,
        date: file.createdAt || null,
        engine: "Perfilador_Ingesta",
        ...lineage(file),
      });
    });
  }

  // Deduplication & Extraction Pipeline
  rawItems.forEach(item => {
    // Normalizar texto para duplicidad
    const cleanContent = item.content.trim().toLowerCase().substring(0, 200);
    if (!cleanContent) return;
    if (seenContents.has(cleanContent)) {
      deduplicatedCount++;
      return;
    }
    seenContents.add(cleanContent);

    // Add to chronology
    let risk = "Bajo";
    if (cleanContent.includes("balacera") || cleanContent.includes("asesinato") || cleanContent.includes("ejecutado")) {
      risk = "Crítico";
    } else if (cleanContent.includes("narco") || cleanContent.includes("detenido") || cleanContent.includes("arma")) {
      risk = "Alto";
    }

    chronology.push({
      date: item.date,
      source: item.source,
      content: item.content.substring(0, 180) + (item.content.length > 180 ? "..." : ""),
      riskLevel: risk
    });

    // Extract Mexican phones
    const phones = extractPhones(item.content);
    const itemLineage = {
      providerId: item.providerId,
      sourceReference: item.sourceReference,
      sourceUrl: item.sourceUrl,
      acquisitionMode: item.acquisitionMode,
    };
    phones.forEach(p => registerOccurrence(p, "TELEFONO", item.source, item.date, item.engine, `Mención de teléfono: ${p}`, 75, itemLineage));

    // Extract license plates
    const plates = extractPlates(item.content);
    plates.forEach(pl => registerOccurrence(pl, "VEHICULO", item.source, item.date, item.engine, `Mención de placa vehicular: ${pl}`, 80, itemLineage));

    // Extract hashtags
    const hashtags = extractHashtags(item.content);
    hashtags.forEach(h => registerOccurrence(h, "HASHTAG", item.source, item.date, item.engine, `Hashtag observado en la fuente: ${h}`, 50, itemLineage));

    // Extract known aliases
    KNOWN_ALIASES.forEach(alias => {
      if (item.content.includes(alias)) {
        registerOccurrence(alias, "PERSONA", item.source, item.date, item.engine, `Mención textual del alias: ${alias}`, 70, itemLineage);
      }
    });

    // Extract known gangs
    KNOWN_GANGS.forEach(gang => {
      if (new RegExp(`\\b${gang}\\b`, "i").test(item.content)) {
        registerOccurrence(gang, "PANDILLA", item.source, item.date, item.engine, `Mención textual de grupo: ${gang}`, 75, itemLineage);
      }
    });
  });

  const correlatedEntities = Array.from(correlatedMap.values());

  // Graph Data builder
  const nodes: Array<{ id: string; group: string; label: string; details?: string }> = [];
  const links: Array<{ source: string; target: string; label: string }> = [];

  const mainNodeId = project?.locationName?.substring(0, 25) || "Aguascalientes";
  nodes.push({ id: mainNodeId, group: "TARGET", label: `Objetivo: ${mainNodeId}`, details: `Área de investigación del expediente: ${project?.nombre}` });

  correlatedEntities.forEach(ent => {
    nodes.push({
      id: ent.id,
      group: ent.type,
      label: `${ent.value} (${ent.type})`,
      details: `${ent.reason} Coherencia: ${ent.confidence}%`
    });

    links.push({
      source: mainNodeId,
      target: ent.id,
      label: `Vínculo OSINT (${ent.confidence}%)`
    });

    // Inter-correlate: If a gang is mentioned and a person has high confidence, link them
    if (ent.type === "PERSONA") {
      const associatedGangs = correlatedEntities.filter(e => e.type === "PANDILLA");
      associatedGangs.forEach(g => {
        links.push({
          source: ent.id,
          target: g.id,
          label: "Presunto Integrante"
        });
      });
    }
  });

  // Propose a revised hypothesis
  let updatedHypothesis = project?.hipotesis || "Actividad delictiva territorial local.";
  const gangMatches = correlatedEntities.filter(e => e.type === "PANDILLA");
  const phoneMatches = correlatedEntities.filter(e => e.type === "TELEFONO");
  const vehicleMatches = correlatedEntities.filter(e => e.type === "VEHICULO");

  if (gangMatches.length > 0) {
    updatedHypothesis = `Fusión OSINT CEIPOL: Se observaron menciones de ${gangMatches.length} organizaciones (${gangMatches.map(g => g.value).join(", ")}) en las fuentes consultadas; requieren validación analista. `;
  }
  if (phoneMatches.length > 0 || vehicleMatches.length > 0) {
    updatedHypothesis += `Se identificaron menciones potencialmente correlacionadas de ${phoneMatches.length} teléfonos y ${vehicleMatches.length} placas; no constituyen atribución confirmada.`;
  }

  // Sort chronology
  chronology.sort((a, b) => {
    const aTime = a.date ? Date.parse(a.date) : Number.NEGATIVE_INFINITY;
    const bTime = b.date ? Date.parse(b.date) : Number.NEGATIVE_INFINITY;
    return bTime - aTime;
  });

  return {
    success: true,
    correlatedEntities,
    deduplicatedCount,
    updatedHypothesis,
    graphData: { nodes, links },
    chronology: chronology.slice(0, 20)
  };
};
