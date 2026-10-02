import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { executeInstitutionalTemporal } from "@/services/geoint/institutionalTemporalBoundary";
export async function PATCH(req: NextRequest, { params }: { params: { id: string; comparisonId: string } }) {
  if (req.headers.get('origin') !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  try { const body = await req.json();
    const comparison = await executeInstitutionalTemporal({ session: cookies().get('ceipol_session')?.value, projectId: params.id, operation: 'REVIEW', comparisonId: params.comparisonId, status: body.status, comments: body.comments || body.validationComment });
    if (!comparison) return NextResponse.json({ error: 'TEMPORAL_COMPARISON_NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ comparison });
  } catch { return NextResponse.json({ error: 'TEMPORAL_BOUNDARY_DENIED' }, { status: 403 }); }
}
