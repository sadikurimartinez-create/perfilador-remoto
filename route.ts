import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { placa } = body;

    if (!placa) {
      return NextResponse.json({ error: "La placa o NIV es requerida." }, { status: 400 });
    }

    // ============================================================================
    // ⚠️ ZONA DE AUTOMATIZACIÓN (WEB SCRAPING) ⚠️
    // Para conectar esto a REPUVE o CheckAuto real, aquí se implementa Puppeteer
    // (o Playwright) para abrir un navegador invisible, llenar el formulario y
    // resolver el CAPTCHA con un servicio como 2Captcha o AntiCaptcha.
    // ============================================================================
    
    // Simulación de retraso de red (como si el robot estuviera consultando la página pública)
    await new Promise(resolve => setTimeout(resolve, 2500));

    // DATO SIMULADO (Prueba de Concepto). 
    // En producción, estos datos son extraídos leyendo el DOM de la página del gobierno.
    const isStolen = placa.includes("ROBO") || Math.random() > 0.8; // Simulación (20% probabilidad de robo)

    const mockResult = {
      placa: placa,
      estatus: isStolen ? "REPORTE DE ROBO VIGENTE" : "SIN REPORTE DE ROBO",
      marca: "VEHÍCULO SOSPECHOSO",
      modelo: "MODELO NO ESPECIFICADO",
      fechaConsulta: new Date().toISOString()
    };

    return NextResponse.json(mockResult, { status: 200 });
  } catch (error: any) {
    console.error("[api/checkauto] Error:", error);
    return NextResponse.json(
      { error: "Error interno al procesar la consulta vehicular." },
      { status: 500 }
    );
  }
}