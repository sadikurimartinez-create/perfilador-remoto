"use server";

import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_GCP_PROJECT_ID || "";
const GCP_LOCATION = process.env.GCP_LOCATION || "us-central1";
const GCP_CLIENT_EMAIL = process.env.GCP_CLIENT_EMAIL || "";
const GCP_PRIVATE_KEY = process.env.GCP_PRIVATE_KEY ? process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n') : "";

/**
 * FASE 1 & 4: Fusión Sensorial Multimodal y Automatización de Inteligencia (Grounding)
 * Utiliza gemini-1.5-pro para analizar la consistencia e inyecta Google Search en tiempo real.
 */
export const runMultimodalFusionWithGrounding = async (imageBase64: string, userDescription: string, lat: number, lng: number) => {
  if (!GCP_PROJECT_ID || !GCP_CLIENT_EMAIL) throw new Error("GCP Credentials missing");

  const auth = new GoogleAuth({
    credentials: { client_email: GCP_CLIENT_EMAIL, private_key: GCP_PRIVATE_KEY },
    projectId: GCP_PROJECT_ID,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const token = (await (await auth.getClient()).getAccessToken()).token;

  const url = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/gemini-1.5-pro:generateContent`;

  const prompt = `
INSTRUCCIÓN DE SISTEMA: Valida la consistencia entre el contenido visual detectado en la imagen adjunta y la descripción del usuario ("${userDescription}"). Reporta discrepancias evidentes como posibles falsos positivos o intentos de desinformación.

QUERY DINÁMICA DE GROUNDING: Busca noticias de seguridad, incidentes reportados y cambios urbanos en un radio de 1km de las coordenadas ${lat}, ${lng} en los últimos 30 días.

ESTRUCTURA JSON REQUERIDA: { "discrepancia_detectada": boolean, "reporte_ia": "Análisis de consistencia...", "contexto_externo": "Resumen del grounding de Google Search...", "categoria_entidad": "Ej: Grafiti, Abandono, etc." }
  `;

  const payload = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
      ]
    }],
    tools: [{
      googleSearchRetrieval: { dynamicRetrievalConfig: { mode: "MODE_DYNAMIC", dynamicThreshold: 0.3 } }
    }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
  };

  const response = await axios.post(url, payload, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });

  const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim());
};

/**
 * FASE 2: Arquitectura de ADN Vectorial
 * Genera el Vector (Embedding) Multimodal vía API REST para guardarlo en BigQuery.
 */
export const generateMultimodalVector = async (imageBase64: string, userDescription: string): Promise<number[]> => {
  const auth = new GoogleAuth({
    credentials: { client_email: GCP_CLIENT_EMAIL, private_key: GCP_PRIVATE_KEY },
    projectId: GCP_PROJECT_ID,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const token = (await (await auth.getClient()).getAccessToken()).token;

  const url = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/multimodalembedding@001:predict`;

  const payload = {
    instances: [
      {
        image: { bytesBase64Encoded: imageBase64 },
        text: userDescription
      }
    ]
  };

  const response = await axios.post(url, payload, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });

  // Retorna un arreglo de floats (ej. [0.012, -0.054, ...]) correspondiente al ADN de la imagen
  return response.data?.predictions?.[0]?.imageEmbedding || [];
};

/**
 * FLUJO DE INGESTA MAESTRO (Orquestador)
 */
export const ingestAdvancedIntelligence = async (reportId: string, imageBase64: string, userDescription: string, lat: number, lng: number) => {
  console.log("[🧠 AI ARCHITECT] Iniciando extracción de ADN Vectorial y Fusión Sensorial...");
  
  // 1. Ejecutar análisis multimodal y grounding (Gemini 1.5 Pro)
  const fusionData = await runMultimodalFusionWithGrounding(imageBase64, userDescription, lat, lng);
  
  // 2. Extraer el Embedding Vectorial
  const vectorArray = await generateMultimodalVector(imageBase64, userDescription);

  // 3. (Mock) Aquí ejecutarías el INSERT a BigQuery usando la librería @google-cloud/bigquery
  // INSERT INTO adn_multimodal (vector_id, ubicacion_geografica, descripcion_usuario, categoria_entidad, embedding_visual, contexto_externo_grounding, alerta_discrepancia)
  // VALUES (reportId, ST_GEOGPOINT(lng, lat), userDescription, fusionData.categoria_entidad, vectorArray, fusionData.contexto_externo, fusionData.discrepancia_detectada)

  console.log("[🧠 AI ARCHITECT] Procesamiento exitoso. ADN Vectorial generado y Grounding inyectado.");
  
  return {
    status: "success",
    vectorDimensions: vectorArray.length,
    intelligence: fusionData
  };
};