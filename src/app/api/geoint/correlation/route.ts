import { NextResponse } from "next/server";
import { MultiSourceCorrelationEngine } from "@/lib/geoint/multiSourceCorrelationEngine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const moduleName = (searchParams.get("module") || "perfil") as "pandillas" | "inundaciones" | "perfil";
    const query = searchParams.get("query") || "";
    const lat = parseFloat(searchParams.get("lat") || "21.8853");
    const lng = parseFloat(searchParams.get("lng") || "-102.2916");

    const report = MultiSourceCorrelationEngine.correlate(moduleName, { lat, lng, query });
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
