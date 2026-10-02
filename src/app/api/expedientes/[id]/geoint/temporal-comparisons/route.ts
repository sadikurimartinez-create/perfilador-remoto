import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { executeInstitutionalTemporal } from "@/services/geoint/institutionalTemporalBoundary";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (req.headers.get('origin') !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  try { const comparison = await executeInstitutionalTemporal({ session: cookies().get('ceipol_session')?.value, projectId: params.id, operation: 'SAVE', record: await req.json() });
    return NextResponse.json({ comparison }, { status: 201 });
  } catch { return NextResponse.json({ error: 'TEMPORAL_BOUNDARY_DENIED' }, { status: 403 }); }
}
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try { const comparisons = await executeInstitutionalTemporal({ session: cookies().get('ceipol_session')?.value, projectId: params.id, operation: 'LIST', status: req.nextUrl.searchParams.get('status') || undefined });
    return NextResponse.json({ expedienteId: params.id, comparisons }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'TEMPORAL_BOUNDARY_DENIED' }, { status: 403 }); }
}
