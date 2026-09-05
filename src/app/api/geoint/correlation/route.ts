import { NextResponse } from "next/server";
import { MultiSourceCorrelationEngine } from "@/lib/geoint/multiSourceCorrelationEngine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const moduleName = (searchParams.get("module") || "perfil") as "pandillas" | "inundaciones" | "perfil";
    const query = searchParams.get("query") || "";

    // ADR-020.34: diagnostic provider correlation must not fabricate geography.
    // Geographic context is optional for MultiSourceCorrelationEngine and must
    // only be supplied by callers when it is explicit and source-grounded.
    const report = MultiSourceCorrelationEngine.correlate(moduleName, { query });
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const moduleName = (body?.module || "perfil") as "pandillas" | "perfil";
    const items = Array.isArray(body?.items) ? body.items : [];
    const report = MultiSourceCorrelationEngine.correlateInstitutionalEvidence(moduleName, items);
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
