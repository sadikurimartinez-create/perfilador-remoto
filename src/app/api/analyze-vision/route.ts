import { NextResponse } from "next/server";
import { analyzeBrokenWindowsWithVision } from "@/lib/googleVision";

type VisionRequestBody = {
  imageBase64?: string;
  imageUrl?: string;
  expedienteId?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VisionRequestBody;
    const { imageBase64, imageUrl, expedienteId } = body;

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: "Se requiere imageBase64 o imageUrl para analizar la imagen." },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

    // Intentar delegar el análisis de visión al backend gobernado FastAPI v2.5.0
    try {
      const fastApiRes = await fetch(`${backendUrl}/api/analyze-vision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, imageUrl, expedienteId }),
        cache: "no-store",
      });

      if (fastApiRes.ok) {
        const data = await fastApiRes.json();
        return NextResponse.json(data, { status: 200 });
      }
    } catch (fastApiErr) {
      console.warn("[api/analyze-vision] FastAPI backend no disponible, procesando visión local neutra:", fastApiErr);
    }

    // Fallback local neutro en caso de desconexión (únicamente características físicas)
    const visionResult = await analyzeBrokenWindowsWithVision({
      imageBase64,
      imageGcsUri: imageUrl,
    });

    if (!visionResult) {
      return NextResponse.json(
        { faces: { count: 0, headwear: false }, extractedText: "", observacion_visual: "No se detectaron anomalías físicas." },
        { status: 200 }
      );
    }

    const extractedText = visionResult.textoDetectado?.join(" ").replace(/\s+/g, " ").trim() ?? "";

    return NextResponse.json(
      {
        observacion_visual: `Estructuras físicas detectadas: ${visionResult.etiquetasRelevantes?.join(", ") || "Terreno/Edificación sin marcar"}`,
        etiquetas: visionResult.etiquetasRelevantes || [],
        extractedText,
        indicadores: visionResult.indicadoresVentanasRotas,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/analyze-vision] Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno al analizar imagen con Vision API." },
      { status: 500 }
    );
  }
}

