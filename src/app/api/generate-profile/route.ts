export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { VertexAI } from "@google-cloud/vertexai";
import { analyzeBrokenWindowsWithVision } from "@/lib/googleVision";
import { searchPlacesAround } from "@/lib/googlePlaces";
import { searchDenueAround } from "@/lib/denueInegi";
import { buildIrregularBusinesses } from "@/lib/environmentProfile";
import { getStreetViewComparison } from "@/lib/googleStreetView";
import { getPool } from "@/lib/db";
import { getInegiDemographics, type InegiDemographics } from "@/lib/inegiIndicators";
import { searchXTweets, type XOsintResult } from "./xOsint";
import { searchNewsOsint, type NewsOsintResult } from "@/lib/newsOsint";
import { searchTelegram } from "@/utils/socialProviders";
import { buildStrategiesSummaryForTags } from "@/lib/tagStrategies";
import { getNearbyCrimes } from "@/lib/crimeData";
import { mergeAndDeduplicatePOIs, type PointOfInterest } from "@/lib/poiDedup";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL } from "@/lib/geminiEnv";
import { buildSystemPrompt } from "@/lib/promptBuilder";



type PhotoInput = {
  id: string;
  lat: number | null;
  lng: number | null;
  tipo: string;
  comentario: string;
  imageBase64?: string;
};

/** Evita "Cannot read properties of null (reading toFixed)" cuando lat/lng vienen sin GPS (ej. galería). */
function formatCoord(n: number | null | undefined): string {
  if (n == null || typeof n !== "number" || Number.isNaN(n)) return "N/A";
  return n.toFixed(5);
}

/** Tipos de delito que se consideran de mayor peso para el semáforo de riesgo */
const DELITOS_PESO_ALTO = [
  "homicidio",
  "secuestro",
  "violencia",
  "lesiones",
  "robo",
  "asalto",
  "agresión",
  "amenaza",
  "narco",
  "arma",
  "extorsión",
  "feminicidio",
];

function normalizeTipo(tipo: string): string {
  return tipo.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}

/**
 * Calcula el nivel de riesgo (semáforo) con reglas afinadas:
 * - Incidencia estadística (DB) y archivos CSV
 * - Peso por tipo de delito (graves suman más)
 * - Comercios irregulares y densidad de POIs como atractores de riesgo
 */
function computeRiskLevel(params: {
  totalIncidenciaDB: number;
  totalIncidenciaCSV: number;
  porDelito: Array<{ tipo: string; cantidad: number }>;
  numIrregulares: number;
  numPois: number;
  radioMetros: number;
}): "bajo" | "medio" | "alto" {
  const {
    totalIncidenciaDB,
    totalIncidenciaCSV,
    porDelito,
    numIrregulares,
    numPois,
    radioMetros,
  } = params;

  let puntos = 0;

  const totalIncidencia = totalIncidenciaDB + totalIncidenciaCSV;

  if (totalIncidencia === 0) {
    puntos = 0;
  } else {
    const porMilMetros = radioMetros <= 0 ? 0 : totalIncidencia / (radioMetros / 1000);
    if (porMilMetros >= 15) puntos += 3;
    else if (porMilMetros >= 6) puntos += 2;
    else if (porMilMetros >= 1) puntos += 1;
  }

  const hayDelitosGraves = porDelito.some((d) =>
    DELITOS_PESO_ALTO.some((kw) => normalizeTipo(d.tipo).includes(kw))
  );
  const cantidadDelitosGraves = porDelito
    .filter((d) =>
      DELITOS_PESO_ALTO.some((kw) => normalizeTipo(d.tipo).includes(kw))
    )
    .reduce((acc, d) => acc + d.cantidad, 0);
  if (cantidadDelitosGraves >= 5) puntos += 2;
  else if (cantidadDelitosGraves >= 1 || hayDelitosGraves) puntos += 1;

  if (numIrregulares >= 5) puntos += 2;
  else if (numIrregulares >= 1) puntos += 1;

  if (numPois >= 15) puntos += 2;
  else if (numPois >= 8) puntos += 1;

  const puntuacion = Math.round(puntos);

  if (puntuacion <= 1) return "bajo";
  if (puntuacion <= 3) return "medio";
  return "alto";
}

type GenerateProfileBody = {
  photos: PhotoInput[];
  analysisContext?: string;
  analysisRadius?: number;
  focusAreas?: string[];
  /** Inteligencia visual táctica opcional enviada desde el frontend (OCR y rostros). */
  visionDataTactica?: {
    texto: string;
    rostros: number;
  };
  /** Incidencia adicional (filtrada a 1KM) enviada desde el endpoint /api/incidencia (auditoría). */
  incidenciaLocal?: any[];
  /** Bibliografía adicional (concatenada desde carpetas protegidas) enviada desde /api/incidencia (auditoría). */
  bibliografiaLocal?: string;
  /** Contexto y directrices de las evidencias multimodales adjuntas. */
  multimodalContext?: string;
  geometryType?: "individual" | "lineal" | "poligono";
  projectDescription?: string;
  tacticalStreetViews?: any[];
};

type GeocodingResult = {
  formattedAddress: string | null;
  colonia: string | null;
  municipio: string | null;
  estado: string | null;
};

type HistoricalSummary = {
  total: number;
  porDelito: Array<{ tipo: string; cantidad: number }>;
  porRango: Array<{ rango: string; cantidad: number }>;
};

async function readBibliographyContext(): Promise<string> {
  try {
    const baseDir = path.join(process.cwd(), "Bibliografía");
    const entries = await fs.readdir(baseDir, { withFileTypes: true });

    const textos: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext !== ".md" && ext !== ".txt") continue;

      const filePath = path.join(baseDir, entry.name);
      const content = await fs.readFile(filePath, "utf8");
      textos.push(`---\nFuente: ${entry.name}\n${content}`);
    }

    return textos.join("\n\n");
  } catch (err) {
    console.warn(
      "[generate-profile] No se pudo leer la carpeta Bibliografía (se continuará sin contexto teórico adicional):",
      err
    );
    return "";
  }
}

function getGeminiModel(
  bibliographyContext: string,
  marcoTeoriaReglas?: string
) {
  if (!GCP_PROJECT_ID) {
    throw new Error("Falta la variable de entorno GCP_PROJECT_ID para inicializar Vertex AI.");
  }

  // Inicialización segura mediante IAM / Application Default Credentials
  const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION });
  
  return vertexAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction:
      "Eres un Analista de Inteligencia y Criminólogo experto en Ecología Ambiental adscrito al Centro de Estudios y Política Criminal (CEIPOL). " +
      "Redactas dictámenes técnicos EXHAUSTIVOS, PROFUNDOS Y SEVEROS denominados 'Perfil Criminológico Ambiental', empleando un lenguaje policial avanzado, táctico y objetivo. " +
      "Fundamentas el análisis en la integración de Inteligencia de Fuentes Abiertas (OSINT), cartografía criminal y cuatro marcos: Actividades Rutinarias, Patrón Delictivo, Elección Racional y Teoría de Ventanas Rotas. " +
      "Basa la terminología en la bibliografía institucional y fundamenta el nivel de severidad del entorno empíricamente.\n\n" +
      "Reglas de redacción: (1) Desarrolla un análisis exhaustivo y pormenorizado. (2) Integra explícitamente los hallazgos de OSINT (DENUE, Google Places, Street View) y su impacto táctico. (3) FLEXIBILIDAD Y COLABORACIÓN: Toma la 'Hipótesis del Analista' como eje central válido. (4) Las recomendaciones deben ser claras y accionables. (5) El capítulo LÍNEAS CRONOLÓGICAS GEOESPACIALES debe ser predictivo, contundente, agresivo y prospectivo sobre la escalada criminal.\n\n" +
      `${marcoTeoriaReglas || ""}\n\n` + (bibliographyContext || "[No se proporcionó bibliografía adicional.]"),
  });
}

async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodingResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  if (!key) {
    console.warn(
      "[generate-profile] Falta GOOGLE_MAPS_API_KEY o NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para Geocoding."
    );
    return { formattedAddress: null, colonia: null, municipio: null, estado: null };
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn("[generate-profile] Geocoding status:", res.status);
      return { formattedAddress: null, colonia: null, municipio: null, estado: null };
    }
    const json = (await res.json()) as any;
    const result = json.results?.[0];
    if (!result) return { formattedAddress: null, colonia: null, municipio: null, estado: null };

    const formattedAddress = result.formatted_address ?? null;
    let colonia: string | null = null;
    let municipio: string | null = null;
    let estado: string | null = null;
    const components: any[] = result.address_components ?? [];
    for (const c of components) {
      const types: string[] = c.types ?? [];
      if (types.includes("sublocality_level_1")) {
        colonia = c.long_name;
        break;
      }
      if (types.includes("neighborhood") && !colonia) {
        colonia = c.long_name;
      }
      if (types.includes("locality") || types.includes("administrative_area_level_2")) {
        municipio = c.long_name;
      }
      if (types.includes("administrative_area_level_1")) {
        estado = c.long_name;
      }
    }

    return { formattedAddress, colonia, municipio, estado };
  } catch (err) {
    console.error("[generate-profile] Error en Geocoding:", err);
    return { formattedAddress: null, colonia: null, municipio: null, estado: null };
  }
}

async function getHistoricalSummary(
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): Promise<{ resumen: HistoricalSummary; detalles: any[] }> {
  try {
    const { rows } = await getPool().query(
      `
      SELECT
        incidente,
        rango_horario,
        fecha,
        hora,
        ST_Y(geometria::geometry) as lat,
        ST_X(geometria::geometry) as lng
      FROM incidencia_estadistica
      WHERE ST_DWithin(
        geometria,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
    `,
      [centerLng, centerLat, radiusMeters]
    );

    const porDelitoMap = new Map<string, number>();
    const porRangoMap = new Map<string, number>();

    for (const row of rows) {
      const tipo = row.incidente as string;
      const rango = (row.rango_horario as string) ?? "Sin rango definido";

      porDelitoMap.set(tipo, (porDelitoMap.get(tipo) ?? 0) + 1);
      porRangoMap.set(rango, (porRangoMap.get(rango) ?? 0) + 1);
    }

    const resumen: HistoricalSummary = {
      total: rows.length,
      porDelito: Array.from(porDelitoMap.entries()).map(([tipo, cantidad]) => ({
        tipo,
        cantidad,
      })),
      porRango: Array.from(porRangoMap.entries()).map(
        ([rango, cantidad]) => ({
          rango,
          cantidad,
        })
      ),
    };

    return { resumen, detalles: rows };
  } catch (err) {
    console.error("[generate-profile] Error en consulta histórica:", err);
    const vacio: HistoricalSummary = { total: 0, porDelito: [], porRango: [] };
    return { resumen: vacio, detalles: [] };
  }
}

function buildPromptForGemini(params: {
  photos: PhotoInput[];
  geocoding: GeocodingResult;
  visionPorFoto: Array<{
    photoId: string;
    etiquetas: string[];
    texto: string[];
  }>;
  irregularidadesTexto: string;
  inegiDemographics?: InegiDemographics;
  incidencia: HistoricalSummary;
  incidenciaArchivosTexto: string;
  streetViewUrl: string | null;
  strategySummary: string;
  xOsintResult: XOsintResult;
  newsOsintResult: NewsOsintResult;
  osintReviewsTexto: string;
  telegramOsintTexto: string;
  analysisContext?: string;
  multimodalContext?: string;
  analysisRadius: number;
  focusAreas: string[];
  poiImages: Array<{ name: string; category: string; streetViewUrl: string }>;
  visionDataTactica?: { texto: string; rostros: number };
  geometryType?: "individual" | "lineal" | "poligono";
  projectDescription?: string;
  tacticalStreetViews?: any[];
}): string {
  const {
    photos,
    geocoding,
    visionPorFoto,
    irregularidadesTexto,
    inegiDemographics,
    incidencia,
    incidenciaArchivosTexto,
    streetViewUrl,
    strategySummary,
    xOsintResult,
    newsOsintResult,
    osintReviewsTexto,
    telegramOsintTexto,
    analysisContext,
    multimodalContext,
    analysisRadius,
    focusAreas,
    poiImages,
    visionDataTactica,
    geometryType,
    projectDescription,
    tacticalStreetViews = [],
  } = params;

  const comentariosInvestigador = photos
    .map(
      (p) =>
        `- [${p.tipo}] Comentario: ${p.comentario || "(sin comentario)"} ` +
        `Coordenadas: (${formatCoord(p.lat)}, ${formatCoord(p.lng)})`
    )
    .join("\n");

  const visionResumen = visionPorFoto
    .map(
      (v) =>
        `Foto ${v.photoId}: Etiquetas Ventanas Rotas: ${
          v.etiquetas.join(", ") || "sin etiquetas relevantes"
        }. Texto detectado: ${
          v.texto.join(" | ") || "sin texto relevante"
        }`
    )
    .join("\n");

  const direccionTexto =
    geocoding.formattedAddress
      ? `Polígono centrado en: ${geocoding.formattedAddress}. ` + (geocoding.colonia ? `FOCALIZAR ANÁLISIS ESTRICTAMENTE EN: Colonia/Sector ${geocoding.colonia}.` : "")
      : "Dirección exacta no disponible (solo coordenadas GPS).";

  const radioTexto =
    analysisRadius >= 1000
      ? `${(analysisRadius / 1000).toFixed(1)} km`
      : `${analysisRadius} m`;
  const incidenciaTexto =
    incidencia.total === 0
      ? `En un radio de ${radioTexto} no se registran incidentes históricos en la base de incidencia.`
      : `En un radio de ${radioTexto} se registran ${incidencia.total} incidentes históricos. ` +
        `Por tipo: ${incidencia.porDelito
          .map((d) => `${d.cantidad} × ${d.tipo}`)
          .join(", ")}. ` +
        `Por rango horario: ${incidencia.porRango
          .map((r) => `${r.cantidad} × ${r.rango}`)
          .join(", ")}.`;

  const streetViewTexto = streetViewUrl
    ? `Imagen de referencia de Street View (histórica/visual): ${streetViewUrl}`
    : "No se cuenta con imagen de Street View para este punto.";

  const inegiTexto = inegiDemographics && inegiDemographics.exito
    ? `Municipio: ${inegiDemographics.municipioNombre} | Población Total: ${inegiDemographics.poblacionTotal} habitantes.\nContexto Estructural: ${inegiDemographics.datosExtra}`
    : "Datos sociodemográficos a nivel municipal no extraídos. Aterriza las inferencias económicas basándote exclusivamente en el deterioro visual.";

  const xOsintTexto = xOsintResult.exito
    ? `${xOsintResult.resumen}\n` + xOsintResult.tweetsRelevantes.map(t => ` - [${t.autor}]: "${t.texto}"`).join('\n')
    : `Análisis OSINT en X/Twitter: ${xOsintResult.resumen}`;

  const newsOsintTexto = newsOsintResult.exito
    ? `${newsOsintResult.resumen}\n` + newsOsintResult.noticiasRelevantes.map(n => ` - [${n.fecha} | ${n.fuente}]: "${n.titular}"`).join('\n')
    : `Análisis Hemerográfico: ${newsOsintResult.resumen}`;

  const focusAreasTexto =
    focusAreas && focusAreas.length > 0
      ? focusAreas.join(", ")
      : "no se marcaron objetivos prioritarios específicos; debes evaluar integralmente todos los elementos disponibles.";

  const hipotesisTexto = analysisContext?.trim() || "No se proporcionó una hipótesis u observaciones previas por el analista.";
  
  const multimodalTexto = multimodalContext?.trim() || "No se adjuntaron evidencias documentales o multimodales.";
  
  const clasificacionesTexto = photos
    .map((p) => `- Foto ${p.id}: ${p.tipo}`)
    .join("\n");
    
  const visionTacticaTexto = visionDataTactica
    ? `Análisis visual táctico detectado por IA: ${visionDataTactica.texto}. Rostros detectados: ${visionDataTactica.rostros}.`
    : "Sin inteligencia visual táctica adjunta.";

  let geoInstruction = "";
  if (geometryType === "individual") {
    geoInstruction = "MANDATO OPERACIONAL DE GEOMETRÍA: ANÁLISIS INDIVIDUAL (NODAL).\nTodo tu análisis, la aplicación de teorías de la Criminología Ambiental y deducciones DEBEN CONCENTRARSE ESTRICTAMENTE en el NODO principal analizado. Busca de manera incisiva los atractores del nodo, las rutas y senderos hacia y desde el nodo, rutas de escape, lugares de acecho, fronteras y todo aquello que relacione al entorno con este punto focal.";
  } else if (geometryType === "lineal") {
    geoInstruction = "MANDATO OPERACIONAL DE GEOMETRÍA: ANÁLISIS LINEAL (CORREDOR).\nEstás analizando un TRAYECTO entre nodos (ej. un nodo inicial y uno final). Tu misión es detectar TODOS los RIESGOS que pudieran existir en ese trayecto. Realiza un barrido implacable para detectar amenazas en el desplazamiento: bares, cantinas, moteles, terrenos baldíos, concentración de incidencia, presencia de pandillas, y correlaciona los horarios de movilidad con las vulnerabilidades a lo largo del corredor.";
  } else if (geometryType === "poligono") {
    geoInstruction = "MANDATO OPERACIONAL DE GEOMETRÍA: ANÁLISIS DE POLÍGONO (ZONA).\nSe ha establecido un PERÍMETRO a partir de las imágenes de sus límites y su interior. Realiza un BARRIDO INTENSIVO Y EXHAUSTIVO para establecer de manera particular los riesgos, vulnerabilidades y focos de infección criminal que existen al INTERIOR de dicho polígono y en sus dinámicas fronterizas.";
  }

  const descContext = projectDescription
    ? `\n## EXPLICACIÓN DEL PROYECTO (DICTADO DE VOZ - DIRECTRIZ OBLIGATORIA E INELUDIBLE)\n"${projectDescription}"\nESTA EXPLICACIÓN Y LAS CONTEXTUALIZACIONES SON TU PUNTO DE PARTIDA OBLIGATORIO. TODO TU ANÁLISIS Y SUGERENCIAS DEBEN ESTAR ENFOCADAS EN ESTOS PARÁMETROS.\n`
    : "";

  const lugaresAcechoTexto = tacticalStreetViews && tacticalStreetViews.length > 0
    ? `\n## ANÁLISIS DE STREET VIEW Y LUGARES DE ACECHO\nSe utilizaron coordenadas y Google Street View con Vision API para ubicar rutas de acceso/escape y lugares de acecho en los principales atractores:\n` +
      (tacticalStreetViews || []).map((sv: any) => `- ${sv.name} (${sv.category}): Etiquetas de vulnerabilidad detectadas: ${sv.vision?.etiquetasRelevantes?.join(", ") || "Ninguna"}.`).join("\n") +
      `\nUtiliza explícitamente esta información para señalar POR QUÉ fungen como atractores, rutas de acceso, de escape o lugares de acecho en tu dictamen.\n`
    : "";

  const prompt = `
${descContext}

## DATOS DEL INVESTIGADOR (fotos y comentarios)
${comentariosInvestigador}

## HIPÓTESIS O CONTEXTO DEL ANALISTA (incorporar en el análisis)
${hipotesisTexto}

## EVIDENCIAS MULTIMODALES Y DE GABINETE (Analizar e integrar al dictamen)
${multimodalTexto}

## CLASIFICACIÓN HUMANA DE LA EVIDENCIA
${clasificacionesTexto}

## UBICACIÓN (Geocoding)
${direccionTexto}
Radio de análisis utilizado: ${analysisRadius} metros.

## DEMOGRAFÍA Y VULNERABILIDAD SOCIAL (INEGI)
${inegiTexto}

## INTELIGENCIA DE FUENTES ABIERTAS (OSINT - X/Twitter)
${xOsintTexto}

## INTELIGENCIA HEMEROGRÁFICA (OSINT - Noticias y Nota Roja)
${newsOsintTexto}

## INTELIGENCIA DE FUENTES ABIERTAS (OSINT - Comentarios Ciudadanos)
${osintReviewsTexto}

## INTELIGENCIA DE FUENTES ABIERTAS (OSINT - Telegram)
${telegramOsintTexto}

## DETERIORO URBANO (Vision API - Ventanas Rotas)
${visionResumen}

## ANÁLISIS MICRO-ECONÓMICO Y DE ATRACTORES (DENUE INEGI Y PLACES - BARRIDO A 1KM)
${irregularidadesTexto || "No se identificaron unidades económicas registradas ni atractores relevantes en el perímetro de 1 kilómetro."}

[MANDATO TÁCTICO MULTIDIMENSIONAL Y FLEXIBILIDAD ANALÍTICA]:
0. REGLA FUNDAMENTAL: LAS IMÁGENES INYECTADAS POR EL USUARIO NO SON LIMITATIVAS. Tómalas SOLO como punto de partida, pero DEBES APOYARTE DE MANERA AGRESIVA Y PROFUNDA en TODOS los medios proporcionados (OSINT, DENUE, Incidencia, Textos) para construir tu análisis. Se exige profundidad y amplitud.
1. ${geoInstruction}\nCORRELACIÓN TRANSVERSAL: Es OBLIGATORIO cruzar la "Explicación del Proyecto" y la "Hipótesis del Analista" con los datos de las APIs. Da peso y credibilidad a las inferencias humanas del analista de campo; usa la Inteligencia Artificial para enriquecerlas y sostenerlas, no para contradecirlas.
2. TEORÍA DEL PATRÓN DELICTIVO: Clasifica los comercios en "Generadores de Delitos", "Atractores" o "Nodos de Miedo".
3. ECONOMÍA INFORMAL Y ZONAS GRISES: Identifica discrepancias entre Google Places y DENUE. Argumenta cómo la irregularidad debilita el control social formal y fomenta "ventanas rotas".
4. CORRELACIÓN ESTADÍSTICA: Cruza los giros comerciales con la estadística delictiva. (Ej. Robo de autopartes + talleres irregulares = mercados ilícitos).
5. OSINT Y SENTIMIENTO CIUDADANO: Analiza minuciosamente las reseñas de Google y los tuits de X/Twitter para detectar focos de conflicto social, narcomenudeo o tensión comunitaria. Correlaciónalos con la estadística oficial.
6. HEMEROTECA Y NOTA ROJA: Cruza las noticias detectadas en los medios con la Hipótesis del Analista. Si hay cateos u homicidios reportados recientemente, correlaciónalo con la desorganización social.
7. ACTIVIDADES RUTINARIAS: Relaciona la tipología del comercio con la previsibilidad de las víctimas en horarios específicos.

## ESTRATEGIA ANALÍTICA SEGÚN TIPO DE PUNTO
${strategySummary || "Aplicar análisis general conforme a las cuatro teorías indicadas."}

## INCIDENCIA ESTADÍSTICA (base PostGIS/CSV)
${incidenciaTexto}

## INCIDENCIA ADICIONAL (archivos CSV locales)
${incidenciaArchivosTexto || "No se encontraron delitos adicionales en archivos CSV dentro del radio."}

## CONTEXTO VISUAL (Street View)
${streetViewTexto}

## INTELIGENCIA VISUAL AUTOMATIZADA (OCR y Rostros)
${visionTacticaTexto}

${lugaresAcechoTexto}

## OBJETIVOS PRIORITARIOS MARCADOS POR EL ANALISTA
${focusAreasTexto}

---
INSTRUCCIÓN FINAL (FORMATO ESTRICTAMENTE EJECUTIVO):
Redacta un PERFIL CRIMINOLÓGICO AMBIENTAL SUMAMENTE EJECUTIVO, DIRECTO Y CONCISO. 
REGLA DE ORO: NO DEBE EXCEDER 2 CUARTILLAS. Utiliza viñetas (bullet points) para listar hallazgos de forma contundente y elimina cualquier texto de relleno o redundancia.

Estructura OBLIGATORIAMENTE en estas 5 secciones breves:
1. OBJETIVO Y CONTEXTO ESPACIAL (Máx. 1 párrafo cruzando INEGI y la hipótesis del analista).
2. DETERIORO FÍSICO Y VENTANAS ROTAS (Viñetas con hallazgos clave de fotos y Vision API).
3. ATRACTORES Y DINÁMICA DELICTIVA (Viñetas cruzando DENUE, OSINT y CSV, identificando riesgos directos).
4. LÍNEAS CRONOLÓGICAS GEOESPACIALES (Información predictiva implacable y muy puntual: establece clara y circunstanciadamente el escalamiento de los fenómenos criminales, su continuidad espacial, la proyección de riesgos inminentes y tu interpretación prospectiva).
5. CONCLUSIONES TÁCTICAS (Riesgo a 6 meses expuesto en puntos de acción y recomendaciones operativas directas).
`.trim();

  return prompt;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateProfileBody;
    const { photos } = body;
    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array 'photos' con al menos una fotografía." },
        { status: 400 }
      );
    }

    const photosWithCoords = photos.filter(
      (p) =>
        p.lat != null &&
        p.lng != null &&
        !Number.isNaN(p.lat) &&
        !Number.isNaN(p.lng)
    );
    if (photosWithCoords.length === 0) {
      return NextResponse.json(
        {
          error:
            "Ninguna foto tiene coordenadas GPS. Añade fotos con ubicación (cámara con GPS o imágenes con EXIF) o usa al menos una foto con coordenadas para el análisis.",
        },
        { status: 400 }
      );
    }
    const centerLat =
      photosWithCoords.reduce((acc, p) => acc + (p.lat as number), 0) /
      photosWithCoords.length;
    const centerLng =
      photosWithCoords.reduce((acc, p) => acc + (p.lng as number), 0) /
      photosWithCoords.length;

    const radiusMeters =
      typeof body.analysisRadius === "number" && body.analysisRadius > 0
        ? body.analysisRadius
        : 500;

    const geocodingPromise = reverseGeocode(centerLat, centerLng);
    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
      new Promise((resolve, reject) => {
        const id = setTimeout(
          () => reject(new Error(`Timeout ${ms}ms en DENUE`)),
          ms
        );
        p.then(
          (v) => {
            clearTimeout(id);
            resolve(v);
          },
          (e) => {
            clearTimeout(id);
            reject(e);
          }
        );
      });

    const placesPromise = searchPlacesAround(
      centerLat,
      centerLng,
      radiusMeters
    );

    const denueTimedPromise = withTimeout(
      searchDenueAround(centerLat, centerLng, Math.max(radiusMeters, 1000)),
      4000
    );

    const streetViewPromise = (async () => {
      try {
        const cmp = getStreetViewComparison(centerLat, centerLng);
        return cmp.streetViewImageUrl ?? null;
      } catch (e) {
        console.error("[generate-profile] Street View error:", e);
        return null;
      }
    })();

    const historialPromise = getHistoricalSummary(
      centerLat,
      centerLng,
      radiusMeters
    );

    const inegiPromise = geocodingPromise.then((geo) => getInegiDemographics(geo.municipio, geo.estado));
    const xOsintPromise = geocodingPromise.then((geo) => searchXTweets(geo.colonia, geo.municipio));
    const newsOsintPromise = geocodingPromise.then((geo) => searchNewsOsint(geo.colonia, geo.municipio, geo.estado));
    const telegramOsintPromise = geocodingPromise.then((geo) => searchTelegram(geo.colonia || geo.municipio || ""));

    const bibliographyPromise = readBibliographyContext();

    const [
      geocoding,
      placesAndDenueSettled,
      streetViewUrl,
      { resumen: incidenciaResumen, detalles: incidenciaDetalles },
      inegiDemographics,
      xOsintResult,
      newsOsintResult,
      telegramOsintResult,
      bibliographyContext,
    ] = await Promise.all([
      geocodingPromise,
      Promise.allSettled([denueTimedPromise, placesPromise]),
      streetViewPromise,
      historialPromise,
      inegiPromise,
      xOsintPromise,
      newsOsintPromise,
      telegramOsintPromise,
      bibliographyPromise,
    ]);

    const denueResult =
      placesAndDenueSettled[0].status === "fulfilled"
        ? placesAndDenueSettled[0].value
        : null;
    const placesResult =
      placesAndDenueSettled[1].status === "fulfilled"
        ? placesAndDenueSettled[1].value
        : null;
        
    let osintReviewsTexto = "";
    if (placesResult) {
      const allPlaces = [
        ...placesResult.escuelas,
        ...placesResult.expendiosAlcohol,
        ...placesResult.chatarrerasOTalleres,
        ...placesResult.otros,
      ];
      const placesWithReviews = allPlaces.filter(p => p.resenasOsint && p.resenasOsint.length > 0);
      if (placesWithReviews.length > 0) {
        osintReviewsTexto = placesWithReviews.map(p => {
          return `Lugar: ${p.nombre} (${p.categoria})\nComentarios (OSINT):\n` +
                 p.resenasOsint!.map(r => ` - "${r}"`).join("\n");
        }).join("\n\n");
      }
    }
    if (!osintReviewsTexto) osintReviewsTexto = "No se encontraron reseñas o quejas ciudadanas relevantes en fuentes abiertas.";

    let incidenciaArchivosTexto = "";
    let totalIncidenciaCSV = 0;
    try {
      const nearbyCrimes = await getNearbyCrimes(
        centerLat,
        centerLng,
        radiusMeters
      );
      totalIncidenciaCSV = nearbyCrimes.length;
      incidenciaArchivosTexto =
        nearbyCrimes.length === 0
          ? "No se encontraron delitos en los archivos CSV locales dentro del radio analizado."
          : nearbyCrimes
              .slice(0, 50)
              .map(
                (c, idx) =>
                  `${idx + 1}. ${c.tipo} en (${formatCoord(c.lat)}, ${formatCoord(c.lng)}) – archivo: ${c.fuente}`
              )
              .join("\n");
    } catch (e) {
      console.error("[generate-profile] Error al leer archivos de incidencia:", e);
      incidenciaArchivosTexto =
        "No fue posible leer los archivos CSV de incidencia local en este momento.";
    }

    let irregularidadesTexto = "";
    let poiImages: Array<{ name: string; category: string; streetViewUrl: string }> = [];
    let numIrregulares = 0;
    let numPois = 0;
    const tacticalStreetViews: any[] = [];
    let mergedPoisResult: PointOfInterest[] = [];
    try {
      const irregs = buildIrregularBusinesses(placesResult, denueResult);
      numIrregulares = irregs.posiblesIrregulares.length;
      if (irregs.posiblesIrregulares.length > 0) {
        irregularidadesTexto =
          "Se identifican los siguientes comercios potencialmente irregulares (Google Places sin correspondencia clara en DENUE):\n" +
          irregs.posiblesIrregulares
            .map(
              (c, idx) =>
                `${idx + 1}. ${c.lugarGoogle.nombre} – ${c.lugarGoogle.direccion}. Motivo: ${c.motivo}`
            )
            .join("\n");
      }
      const denuePois: PointOfInterest[] =
        denueResult?.unidades.map((u) => ({
          name: u.nombre,
          category: u.actividad ?? "desconocido",
          lat: u.lat,
          lng: u.lng,
          source: "DENUE",
        })) ?? [];
      const placesPois: PointOfInterest[] = placesResult
        ? [
            ...placesResult.escuelas,
            ...placesResult.expendiosAlcohol,
            ...placesResult.chatarrerasOTalleres,
            ...placesResult.otros,
          ].map((p) => ({
            name: p.nombre,
            category: p.categoria,
            lat: p.lat,
            lng: p.lng,
            source: "GOOGLE" as const,
          }))
        : [];
      const mergedPois = mergeAndDeduplicatePOIs(denuePois, placesPois);
      numPois = mergedPois.length;
      mergedPoisResult = mergedPois;
      if (mergedPois.length > 0) {
        const resumenPOI = mergedPois
          .slice(0, 50)
          .map(
            (p, idx) =>
              `${idx + 1}. ${p.name} (${p.category}) en (${formatCoord(p.lat)}, ${formatCoord(p.lng)}) – fuente: ${p.source}`
          )
          .join("\n");
        irregularidadesTexto +=
          (irregularidadesTexto ? "\n\n" : "") +
          "Puntos de interés y unidades económicas fusionadas (DENUE a 1KM + Google Places):\n" +
          resumenPOI;

        const mapsKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
        if (mapsKey) {
          poiImages = mergedPois.slice(0, 12).map((p) => ({
            name: p.name,
            category: p.category,
            streetViewUrl: `https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${p.lat},${p.lng}&key=${mapsKey}`,
          }));

          // Extraer imágenes de Street View para Rutas y Acecho
          for (const poi of poiImages.slice(0, 2)) {
            try {
              const svRes = await fetch(poi.streetViewUrl);
              if (svRes.ok) {
                const arrayBuffer = await svRes.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString("base64");
                const visionRes = await analyzeBrokenWindowsWithVision({ imageBase64: base64 });
                tacticalStreetViews.push({ ...poi, vision: visionRes });
              }
            } catch (e) {
              console.error("[generate-profile] Error Vision en StreetView", e);
            }
          }
        }
      }
    } catch (e) {
      console.error(
        "[generate-profile] Error al construir irregularidades:",
        e
      );
      irregularidadesTexto = "";
    }

    const telegramOsintTexto = telegramOsintResult && telegramOsintResult.length > 0
      ? `Se detectaron ${telegramOsintResult.length} mensajes relevantes en grupos/canales monitorizados:\n` + telegramOsintResult.map((m: any) => ` - [${m.fecha} | ${m.chat}]: "${m.texto}"`).join('\n')
      : "No se detectaron mensajes relevantes en Telegram para la zona en el monitoreo actual.";

    const visionPorFoto = await Promise.all(
      photos.map(async (p) => {
        if (!p.imageBase64) {
          return { photoId: p.id, etiquetas: [] as string[], texto: [] };
        }
        try {
          const res = await analyzeBrokenWindowsWithVision({
            imageBase64: p.imageBase64,
          });
          const etiquetas = res?.etiquetasRelevantes ?? [];
          const texto = res?.textoDetectado ?? [];
          return {
            photoId: p.id,
            etiquetas,
            texto,
          };
        } catch (e) {
          console.error(
            "[generate-profile] Vision error para foto",
            p.id,
            e
          );
          return { photoId: p.id, etiquetas: [] as string[], texto: [] };
        }
      })
    );

    const strategySummary = buildStrategiesSummaryForTags(
      photos.map((p) => p.tipo)
    );

    const prompt = buildPromptForGemini({
      photos,
      geocoding,
      visionPorFoto,
      irregularidadesTexto,
      inegiDemographics,
      incidencia: incidenciaResumen,
      incidenciaArchivosTexto,
      streetViewUrl,
      strategySummary,
      xOsintResult,
      newsOsintResult,
      osintReviewsTexto,
      telegramOsintTexto,
      analysisContext: body.analysisContext,
      multimodalContext: body.multimodalContext,
      analysisRadius: radiusMeters,
      focusAreas: body.focusAreas ?? [],
      poiImages,
      visionDataTactica: (body as any).visionDataTactica ?? undefined,
      geometryType: body.geometryType,
      projectDescription: body.projectDescription,
      tacticalStreetViews,
    });

    const marcoTeoriaReglas =
      body.bibliografiaLocal?.trim() && Array.isArray(body.incidenciaLocal)
        ? "MARCO TEÓRICO Y REGLAS PERICIALES: Ten en cuenta la siguiente bibliografía oficial para fundamentar tu dictamen: \n" +
          `${body.bibliografiaLocal}\n\n` +
          "BASE DE DATOS POLICIAL (Radio 1KM): Se han registrado los siguientes incidentes en la zona extraídos de múltiples fuentes: " +
          `${JSON.stringify(body.incidenciaLocal)}. ` +
          "Tienes la obligación de cruzar esta información táctica con los hallazgos visuales de las fotos y la teoría criminológica para tu dictamen."
        : "";

    const systemPrompt = buildSystemPrompt();
    const finalPrompt = `
    ${systemPrompt}

    ==================================================
    CONTEXTO OPERACIONAL DEL PERFILADOR
    ==================================================

    ${prompt}

    ==================================================
    REGLAS OBLIGATORIAS
    ==================================================

    - Mantén narrativa analítica profesional.
    - REGLA DE ESCALA ESPACIAL: Prohibido generalizar a nivel municipal o estatal. Centra tus inferencias ESTRICTAMENTE en las manzanas y cuadras que componen el radio de ${radiusMeters} metros alrededor de la evidencia.
    - Diferencia hechos de inferencias.
    - No emitas conclusiones absolutas.
    - Prioriza análisis contextual.
    - Mantén supervisión humana implícita.
    - Utiliza lenguaje criminológico contextual.
    - Evita lenguaje especulativo.
    - No actúes como chatbot general.
    `;
    const model = getGeminiModel(bibliographyContext, marcoTeoriaReglas);
    let markdown = "";
    try {
      const result = await model.generateContent(finalPrompt);
      const response = result.response;
      // En Vertex AI extraemos el texto directamente de los 'candidates'
      markdown = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (err) {
      console.error(
        "[api/generate-profile] Error detallado al llamar a Gemini:",
        err
      );
      throw err;
    }

    const riskLevel = computeRiskLevel({
      totalIncidenciaDB: incidenciaResumen.total,
      totalIncidenciaCSV,
      porDelito: incidenciaResumen.porDelito,
      numIrregulares,
      numPois,
      radioMetros: radiusMeters,
    });

    return NextResponse.json(
      {
        markdown,
        meta: {
          center: { lat: centerLat, lng: centerLng },
          incidencia: incidenciaResumen,
          incidenciaDetalles,
          pois: mergedPoisResult,
          riskLevel,
          inegiDemographics,
          tacticalStreetViews,
        },
      },
      { status: 200 }
    );
    } catch (error: any) {
      console.error("[api/generate-profile] Error inesperado:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Error interno al generar el perfil criminológico.";
      const status =
        typeof error?.status === "number" && error.status >= 400 && error.status < 600
          ? error.status
          : 500;
      return NextResponse.json({ error: message }, { status });
    }
}