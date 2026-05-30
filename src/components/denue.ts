import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { lat, lng, radio = 250 } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: "Faltan coordenadas (lat, lng) para consultar DENUE." });
    }

    const token = process.env.INEGI_DENUE_TOKEN || "dbf9098a-165e-4938-a5fc-841bd476e357";
    const url = `https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/todos/${lat},${lng}/${radio}/${token}`;

    const inegiRes = await fetch(url);
    
    if (!inegiRes.ok) {
      return res.status(500).json({ error: `Error de la API de INEGI: ${inegiRes.status}` });
    }

    const data = await inegiRes.json();

    if (!Array.isArray(data)) {
      return res.status(200).json({ 
        total: 0, 
        resumen: "No se encontraron negocios o la API devolvió un formato no esperado." 
      });
    }

    const negocios = data.map((n: any) => `${n.Nombre} (${n.Clase_actividad})`);
    const topNegocios = negocios.slice(0, 8).join(" | ");
    
    return res.status(200).json({
      total: data.length,
      resumen: data.length > 0 ? `${topNegocios}${data.length > 8 ? `... y ${data.length - 8} más` : ""}` : "Ninguno."
    });
  } catch (error: any) {
    console.error("[API DENUE] Error:", error);
    return res.status(500).json({ error: "Error interno del servidor al consultar DENUE." });
  }
}