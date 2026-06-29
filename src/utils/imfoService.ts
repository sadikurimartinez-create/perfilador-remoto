"use server";

import { getDb } from "@/lib/firebase";
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  addDoc,
  orderBy
} from "firebase/firestore";

export interface ImfoSource {
  id: string;
  name: string;
  platform: string; // "Telegram" | "X" | "Reddit" | "Facebook" | "Instagram" | "YouTube" | "RSS" | "Google Drive"
  type: string; // "Bot" | "Canal" | "Grupo" | "Cuenta" | "Hashtag" | "Carpeta" | "Feed RSS" | "API"
  coverage: string; // "Local" | "Regional" | "Nacional"
  state: string; // e.g. "Aguascalientes"
  municipality: string;
  neighborhood: string;
  zone: string;
  category: string; // "Seguridad" | "General" | "Prensa" | "Narcotráfico" | "Accidentes"
  trustworthiness: "Alta" | "Media" | "Baja";
  priority: number; // 1-5
  updateFrequency: string; // "Streaming" | "Diario" | "Semanal"
  discoveryDate: string;
  lastValidationDate: string;
  operationalStatus: "Activa" | "Suspendida" | "Pendiente Autorización";
  observations: string;
  utilityIndex?: number; // 0-100 (Motor de Aprendizaje)
  useCount?: number;
  avgResponseTimeMs?: number;
  precisionScore?: number; // 0-100
}

export interface LearningLog {
  id?: string;
  sourceId: string;
  sourceName: string;
  timestamp: string;
  responseTimeMs: number;
  success: boolean;
  resultCount: number;
  feedback?: "Util" | "No Util" | "Neutro";
}

// Initial seed sources catalog for IMFO (in case database is empty)
const SEED_SOURCES: ImfoSource[] = [
  {
    id: "tg_ceipol_bot",
    name: "Bot Telegram Oficial CEIPOL",
    platform: "Telegram",
    type: "Bot",
    coverage: "Local",
    state: "Aguascalientes",
    municipality: "Aguascalientes",
    neighborhood: "Centro",
    zone: "Norte",
    category: "Seguridad",
    trustworthiness: "Alta",
    priority: 1,
    updateFrequency: "Streaming",
    discoveryDate: "2026-01-10",
    lastValidationDate: "2026-06-25",
    operationalStatus: "Activa",
    observations: "Monitorea reportes directos y alertas de seguridad pública."
  },
  {
    id: "tg_leaks_ags",
    name: "Canal Leaks Aguascalientes",
    platform: "Telegram",
    type: "Canal",
    coverage: "Regional",
    state: "Aguascalientes",
    municipality: "Aguascalientes",
    neighborhood: "Villas de Nuestra Señora de la Asunción",
    zone: "Norte",
    category: "Narcotráfico",
    trustworthiness: "Media",
    priority: 2,
    updateFrequency: "Streaming",
    discoveryDate: "2026-03-12",
    lastValidationDate: "2026-06-28",
    operationalStatus: "Activa",
    observations: "Filtraciones locales sobre disputas y movimiento de cárteles."
  },
  {
    id: "rss_sol_centro",
    name: "El Sol del Centro RSS",
    platform: "RSS",
    type: "Feed RSS",
    coverage: "Regional",
    state: "Aguascalientes",
    municipality: "Aguascalientes",
    neighborhood: "Centro",
    zone: "Centro",
    category: "Prensa",
    trustworthiness: "Alta",
    priority: 1,
    updateFrequency: "Diario",
    discoveryDate: "2025-05-01",
    lastValidationDate: "2026-06-29",
    operationalStatus: "Activa",
    observations: "Prensa local tradicional con nota roja relevante."
  },
  {
    id: "yt_ags_noticias",
    name: "Aguascalientes Digital YT",
    platform: "YouTube",
    type: "Cuenta",
    coverage: "Regional",
    state: "Aguascalientes",
    municipality: "Aguascalientes",
    neighborhood: "Centro",
    zone: "Centro",
    category: "Prensa",
    trustworthiness: "Alta",
    priority: 2,
    updateFrequency: "Diario",
    discoveryDate: "2026-02-14",
    lastValidationDate: "2026-06-20",
    operationalStatus: "Activa",
    observations: "Transmisiones en vivo de operativos y accidentes."
  },
  {
    id: "fb_vecinos_vigilantes",
    name: "Vecinos Vigilantes VNSA",
    platform: "Facebook",
    type: "Grupo",
    coverage: "Local",
    state: "Aguascalientes",
    municipality: "Aguascalientes",
    neighborhood: "Villas de Nuestra Señora de la Asunción",
    zone: "Norte",
    category: "Seguridad",
    trustworthiness: "Media",
    priority: 3,
    updateFrequency: "Streaming",
    discoveryDate: "2026-05-20",
    lastValidationDate: "2026-06-27",
    operationalStatus: "Activa",
    observations: "Alertas comunitarias de robos y vehículos sospechosos."
  }
];

/**
 * Gets all authorized sources from IMFO database.
 */
export const getAuthorizedSources = async (): Promise<ImfoSource[]> => {
  try {
    const db = getDb();
    const sourcesCol = collection(db, "imfo_sources");
    const snap = await getDocs(sourcesCol);
    
    if (snap.empty) {
      // Seed initial data if database is empty
      for (const src of SEED_SOURCES) {
        await setDoc(doc(db, "imfo_sources", src.id), src);
      }
      return SEED_SOURCES;
    }

    const list = snap.docs.map(d => d.data() as ImfoSource);
    return list.filter(s => s.operationalStatus === "Activa" || s.operationalStatus === "Suspendida");
  } catch (err) {
    console.error("Error getting authorized sources from IMFO:", err);
    return SEED_SOURCES;
  }
};

/**
 * Gets all pending/automatically discovered sources from IMFO.
 */
export const getDiscoveredSources = async (): Promise<ImfoSource[]> => {
  try {
    const db = getDb();
    const sourcesCol = collection(db, "imfo_sources");
    const snap = await getDocs(sourcesCol);
    const list = snap.docs.map(d => d.data() as ImfoSource);
    return list.filter(s => s.operationalStatus === "Pendiente Autorización");
  } catch (err) {
    console.error("Error getting discovered sources from IMFO:", err);
    return [];
  }
};

/**
 * Updates a source details or status (operationalStatus).
 */
export const updateSource = async (source: ImfoSource): Promise<void> => {
  const db = getDb();
  await setDoc(doc(db, "imfo_sources", source.id), source, { merge: true });
};

/**
 * Super Admin authorization trigger to activate a discovered source.
 */
export const authorizeSource = async (id: string): Promise<void> => {
  const db = getDb();
  await updateDoc(doc(db, "imfo_sources", id), {
    operationalStatus: "Activa",
    lastValidationDate: new Date().toISOString().split("T")[0]
  });
};

/**
 * Discard / delete a source.
 */
export const deleteSource = async (id: string): Promise<void> => {
  const db = getDb();
  // We can do physical deletion from Firebase
  // Import deleteDoc from firestore
  const { deleteDoc: fDeleteDoc } = await import("firebase/firestore");
  await fDeleteDoc(doc(db, "imfo_sources", id));
};

/**
 * Register a search event for the Learning Engine (Motor de Aprendizaje).
 */
export const logLearningAction = async (
  sourceId: string,
  sourceName: string,
  responseTimeMs: number,
  success: boolean,
  resultCount: number,
  feedback?: "Util" | "No Util" | "Neutro"
): Promise<void> => {
  try {
    const db = getDb();
    const log: LearningLog = {
      sourceId,
      sourceName,
      timestamp: new Date().toISOString(),
      responseTimeMs,
      success,
      resultCount,
      feedback: feedback || "Neutro"
    };
    await addDoc(collection(db, "learning_logs"), log);

    // Update utility index metrics in source record
    const srcDocRef = doc(db, "imfo_sources", sourceId);
    // Fetch current source metadata
    const snap = await getDocs(query(collection(db, "imfo_sources")));
    const list = snap.docs.map(d => d.data() as ImfoSource);
    const targetSrc = list.find(s => s.id === sourceId);

    if (targetSrc) {
      const useCount = (targetSrc.useCount || 0) + 1;
      const currentAvgTime = targetSrc.avgResponseTimeMs || 0;
      const newAvgTime = Math.round((currentAvgTime * (useCount - 1) + responseTimeMs) / useCount);
      
      const successPoints = success ? 100 : 0;
      const countBonus = Math.min(25, resultCount * 2);
      const precisionScore = targetSrc.precisionScore || 80;
      const newPrecision = success ? Math.min(100, Math.round((precisionScore * 4 + precisionScore + countBonus) / 5)) : Math.max(20, precisionScore - 15);

      // Utility index calculation formula (0 - 100)
      const utilityIndex = Math.min(99, Math.round(
        (success ? 40 : 0) +
        (newPrecision * 0.4) +
        (Math.max(0, 100 - (newAvgTime / 150)) * 0.2)
      ));

      await setDoc(srcDocRef, {
        useCount,
        avgResponseTimeMs: newAvgTime,
        precisionScore: newPrecision,
        utilityIndex
      }, { merge: true });
    }
  } catch (err) {
    console.error("Error logging learning action:", err);
  }
};

/**
 * Automatically discovers a new source through parsing.
 * Discovered sources must start in "Pendiente Autorización" state.
 */
export const autoDiscoverSource = async (
  name: string,
  platform: string,
  type: string,
  url: string,
  neighborhood?: string,
  category?: string
): Promise<void> => {
  try {
    const db = getDb();
    const id = `auto_${platform.toLowerCase()}_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    
    // Check if it already exists
    const sourcesCol = collection(db, "imfo_sources");
    const snap = await getDocs(sourcesCol);
    const list = snap.docs.map(d => d.data() as ImfoSource);
    if (list.some(s => s.id === id)) return; // Already exists

    const newSource: ImfoSource = {
      id,
      name,
      platform,
      type,
      coverage: "Local",
      state: "Aguascalientes",
      municipality: "Aguascalientes",
      neighborhood: neighborhood || "Sin catalogar",
      zone: "Sin catalogar",
      category: category || "General",
      trustworthiness: "Media",
      priority: 3,
      updateFrequency: "Diario",
      discoveryDate: new Date().toISOString().split("T")[0],
      lastValidationDate: new Date().toISOString().split("T")[0],
      operationalStatus: "Pendiente Autorización", // Mandatory security rule
      observations: `Fuente descubierta automáticamente por el orquestador CIFA. Dirección de acceso: ${url}`
    };

    await setDoc(doc(db, "imfo_sources", id), newSource);
    console.log(`📡 [IMFO] Nueva fuente descubierta y en espera de autorización: ${name}`);
  } catch (err) {
    console.error("Error discovering new source automatically:", err);
  }
};
