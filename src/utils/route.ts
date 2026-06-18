import { NextResponse } from 'next/server';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_GCP_PROJECT_ID || "";
const GCP_CLIENT_EMAIL = process.env.GCP_CLIENT_EMAIL || "";
const GCP_PRIVATE_KEY = process.env.GCP_PRIVATE_KEY ? process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n') : "";

export async function GET() {
  if (!GCP_PROJECT_ID || !GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY) {
    return NextResponse.json({ error: "Credenciales de GCP no configuradas." }, { status: 500 });
  }

  try {
    const auth = new GoogleAuth({
      credentials: { client_email: GCP_CLIENT_EMAIL, private_key: GCP_PRIVATE_KEY },
      projectId: GCP_PROJECT_ID,
      scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/bigquery']
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token || "";

    // Agrupamos por objetivo y entidad para encontrar relaciones pesadas (reincidentes)
    const query = `
      SELECT 
        nombre_objetivo as source, 
        entidad_detectada as target, 
        tipo_entidad as type, 
        COUNT(*) as weight 
      FROM \`inteligencia_osint_cecosai.hallazgos_perfilador\`
      GROUP BY source, target, type 
      ORDER BY weight DESC 
      LIMIT 250
    `;

    const bqUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${GCP_PROJECT_ID}/queries`;
    const bqRes = await axios.post(bqUrl, { query, useLegacySql: false }, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    // Formatear filas de respuesta de la API REST de BigQuery
    const rows = bqRes.data.rows || [];
    const formattedData = rows.map((row: any) => ({ source: row.f[0].v, target: row.f[1].v, type: row.f[2].v, weight: parseInt(row.f[3].v, 10) }));

    return NextResponse.json({ data: formattedData });
  } catch (error: any) {
    console.error("Error consultando BigQuery:", error.response?.data || error.message);
    return NextResponse.json({ error: "Error consultando BigQuery." }, { status: 500 });
  }
}