import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let url = searchParams.get("url");

  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  // Si se proveen parámetros individuales, construimos la URL en el servidor de forma segura sin exponer la API Key
  if (lat && lng) {
    const heading = searchParams.get("heading") || "0";
    const pitch = searchParams.get("pitch") || "0";
    const fov = searchParams.get("fov") || "90";
    const size = searchParams.get("size") || "800x600";
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    
    url = `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${apiKey}`;
  }

  if (!url) {
    return new NextResponse("Missing url, or lat/lng parameters", { status: 400 });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return new NextResponse(`Failed to fetch remote image: ${response.statusText}`, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("[PROXY IMAGE ERROR]", error);
    return new NextResponse(`Error proxying image: ${error.message}`, { status: 500 });
  }
}

