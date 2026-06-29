"use server";

export interface CorrelatedEntity {
  id: string;
  value: string;
  type: "PERSONA" | "TELEFONO" | "VEHICULO" | "DOMICILIO" | "COMERCIO" | "PANDILLA" | "HASHTAG" | "COORDENADAS" | "EVENTO";
  confidence: number;
  sources: string[];
  occurrences: Array<{
    source: string;
    date: string;
    engine: string;
    contextText: string;
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
    date: string;
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
    date: string,
    engine: string,
    contextText: string,
    baseConfidence = 60
  ) => {
    if (!value || value.trim().length < 3) return;
    const cleanValue = value.trim();
    if (COMMON_NAMES_IGNORE.has(cleanValue.toLowerCase())) return;

    const key = `${type}_${cleanValue.toLowerCase()}`;
    const dateStr = date ? new Date(date).toLocaleString("es-MX") : new Date().toLocaleString("es-MX");

    if (correlatedMap.has(key)) {
      const entity = correlatedMap.get(key)!;
      entity.occurrences.push({ source, date: dateStr, engine, contextText });
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
        occurrences: [{ source, date: dateStr, engine, contextText }],
        reason: `Mención de ${type.toLowerCase()} en ${source}.`
      });
    }
  };

  // Process all sources into a raw flat array of data items
  const rawItems: Array<{ source: string; platform: string; content: string; date: string; engine: string }> = [];

  // 1. YouTube
  if (Array.isArray(rawResults?.youtube)) {
    rawResults.youtube.forEach((yt: any) => {
      rawItems.push({
        source: `YouTube - Canal: ${yt.channelTitle || "Desconocido"}`,
        platform: "YouTube",
        content: `${yt.title || ""} ${yt.description || ""} ${yt.comments?.join(" ") || ""}`,
        date: yt.publishedAt || new Date().toISOString(),
        engine: "YouTube Engine"
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
        date: tg.fecha ? new Date(tg.fecha).toISOString() : new Date().toISOString(),
        engine: "Telegram Monitor"
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
        date: tweet.created_at || new Date().toISOString(),
        engine: "X API v2"
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
        date: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : new Date().toISOString(),
        engine: "Reddit Engine"
      });
    });
  }

  // 5. RSS (Radar) & News APIs (Serp, News, GNews)
  const newsCollections = [
    ...(rawResults?.news || []),
    ...(rawResults?.gnews || []),
    ...(rawResults?.newsdata || []),
    ...(rawResults?.thenews || []),
    ...(rawResults?.serp || []),
    ...(rawResults?.rssData || [])
  ];

  newsCollections.forEach((n: any) => {
    const title = n.title || n.titular || n.snippet || "";
    const desc = n.description || n.resumenTactico || "";
    const sourceName = n.source?.name || n.source || "Prensa Abierta";
    rawItems.push({
      source: sourceName,
      platform: "RSS/Noticias",
      content: `${title} ${desc}`,
      date: n.publishedAt || n.date || new Date().toISOString(),
      engine: "Radar OSINT Regional"
    });
  });

  // 6. Google Drive Ingested Data
  if (Array.isArray(rawResults?.driveData)) {
    rawResults.driveData.forEach((file: any) => {
      rawItems.push({
        source: `Google Drive: [${file.logicalCategory}] ${file.fileName}`,
        platform: "Google Drive",
        content: `${file.summary || ""} ${file.extractedText || ""}`,
        date: file.createdAt || new Date().toISOString(),
        engine: "Perfilador_Ingesta"
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
    phones.forEach(p => registerOccurrence(p, "TELEFONO", item.source, item.date, item.engine, `Mención de teléfono: ${p}`, 75));

    // Extract license plates
    const plates = extractPlates(item.content);
    plates.forEach(pl => registerOccurrence(pl, "VEHICULO", item.source, item.date, item.engine, `Vehículo sospechoso detectado con placa: ${pl}`, 80));

    // Extract hashtags
    const hashtags = extractHashtags(item.content);
    hashtags.forEach(h => registerOccurrence(h, "HASHTAG", item.source, item.date, item.engine, `Hashtag activo en la red: ${h}`, 50));

    // Extract known aliases
    KNOWN_ALIASES.forEach(alias => {
      if (item.content.includes(alias)) {
        registerOccurrence(alias, "PERSONA", item.source, item.date, item.engine, `Mención del alias criminológico: ${alias}`, 70);
      }
    });

    // Extract known gangs
    KNOWN_GANGS.forEach(gang => {
      if (new RegExp(`\\b${gang}\\b`, "i").test(item.content)) {
        registerOccurrence(gang, "PANDILLA", item.source, item.date, item.engine, `Mención de grupo / pandilla: ${gang}`, 75);
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
    updatedHypothesis = `Fusión OSINT CEIPOL: Se confirma la incidencia de ${gangMatches.length} organizaciones (${gangMatches.map(g => g.value).join(", ")}) en el cuadrante. `;
  }
  if (phoneMatches.length > 0 || vehicleMatches.length > 0) {
    updatedHypothesis += `Se identificaron correlaciones multifuente sólidas que vinculan ${phoneMatches.length} teléfonos de contacto y ${vehicleMatches.length} placas vehiculares sospechosas.`;
  }

  // Sort chronology
  chronology.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    success: true,
    correlatedEntities,
    deduplicatedCount,
    updatedHypothesis,
    graphData: { nodes, links },
    chronology: chronology.slice(0, 20)
  };
};
