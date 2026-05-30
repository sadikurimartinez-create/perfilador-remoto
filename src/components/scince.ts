import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: "Faltan las coordenadas (lat, lng) para consultar SCINCE." });
    }

    const token = process.env.INEGI_API_TOKEN;

    // TODO: Aquí debes realizar la petición real HTTP (fetch) a los servidores de INEGI SCINCE 
    // utilizando la variable 'token' y las coordenadas (lat, lng).
    
    const data = {
      coordenadas: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
      poblacionTotal: "Pendiente API", 
      viviendasTotales: "Pendiente API",
      viviendasDeshabitadas: "Pendiente API",
      gradoMarginacion: "Pendiente API",
    };

    return res.status(200).json(data);
  } catch (error: any) {
    console.error("[API SCINCE] Error:", error);
    return res.status(500).json({ error: "Error interno del servidor al consultar INEGI SCINCE." });
  }
}