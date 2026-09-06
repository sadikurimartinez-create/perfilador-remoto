"use server";

import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_GCP_PROJECT_ID || "";
const GCP_CLIENT_EMAIL = process.env.GCP_CLIENT_EMAIL || "";
const GCP_PRIVATE_KEY = process.env.GCP_PRIVATE_KEY ? process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n') : "";
const VISION_API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const BUCKET_NAME = 'evidencias-perfilador-cecosai';

export const processEvidences = async (photos: any[]) => {
  if (!photos || photos.length === 0) return [];

  let token = "";
  if (GCP_CLIENT_EMAIL && GCP_PRIVATE_KEY) {
    try {
      const auth = new GoogleAuth({
        credentials: { client_email: GCP_CLIENT_EMAIL, private_key: GCP_PRIVATE_KEY },
        projectId: GCP_PROJECT_ID,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      token = tokenResponse.token || "";
    } catch (error) {
      console.error("[EVIDENCE] Error obteniendo token para Cloud Storage:", error);
    }
  }

  const processed = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    // Adaptación para extraer base64 ya sea que venga como string directo o dentro de la propiedad url
    const base64Data = photo.url?.split(',')[1] || photo.url || photo; 
    
    // Si es una URL externa (http) y no base64, habría que descargarla primero (por simplicidad aquí saltamos o pasamos directo a Vision)
    if (!base64Data || base64Data.startsWith('http')) continue; 

    const filename = `evidencia_${Date.now()}_${i}.jpg`;
    let isHighPriority = false;
    let extractedText = "";
    let labels: string[] = [];

    // 1. ANÁLISIS CON GOOGLE CLOUD VISION API
    if (VISION_API_KEY) {
      try {
        const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;
        const visionRes = await axios.post(visionUrl, {
          requests: [{
            image: { content: base64Data },
            features: [
              { type: "TEXT_DETECTION" }, 
              { type: "LABEL_DETECTION" },
              { type: "OBJECT_LOCALIZATION" }
            ]
          }]
        });
        
        const data = visionRes.data.responses[0];
        extractedText = data.textAnnotations?.[0]?.description || "";
        labels = data.labelAnnotations?.map((l: any) => l.description) || [];

        const textUpper = extractedText.toUpperCase();
        const judicialKeywords = ['FISCALÍA', 'PODER JUDICIAL', 'JUZGADO', 'AMPARO', 'MINISTERIO PÚBLICO', 'AVERIGUACIÓN', 'EXPEDIENTE', 'JUEZ', 'POLICÍA'];
        const hasJudicialText = judicialKeywords.some(kw => textUpper.includes(kw));

        if (hasJudicialText) {
          isHighPriority = true;
        }
      } catch (e) {
        console.error("[EVIDENCE] Error en Vision API:", e);
      }
    }

    // 2. SUBIDA AL BUCKET DE CLOUD STORAGE
    let storageUrl = "";
    if (token) {
      try {
        // Subida directa por REST a Cloud Storage sin necesidad de librería de Node (ideal para Next.js)
        const buffer = Buffer.from(base64Data, 'base64');
        const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=${filename}`;
        await axios.post(uploadUrl, buffer, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'image/jpeg'
          }
        });
        storageUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`;
      } catch (e) {
        console.error("[EVIDENCE] Error subiendo archivo a Cloud Storage:", e);
      }
    }

    processed.push({ id: filename, storageUrl, extractedText, labels, isHighPriority });
  }
  return processed;
};
