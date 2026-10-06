import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { resolveGangPrimaryPhotoUrls } from '@/services/institutionalPandillasPhotoBoundary';
import { ProjectAccessError } from '@/types/institutionalProjectAccess';
import { photoId } from '@/modules/pandillas/photo-evidence/storagePaths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: NextRequest) {
  const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
  const query = request.nextUrl.searchParams;
  if ([...query.keys()].some(key => !['projectId', 'gangId'].includes(key)) || ['projectId', 'gangId'].some(key => query.getAll(key).length !== 1)) return respond({ error: 'INVALID_SCOPE' }, 400);
  const projectId = query.get('projectId')!, gangId = query.get('gangId')!;
  try { photoId(projectId); photoId(gangId); } catch { return respond({ error: 'INVALID_SCOPE' }, 400); }
  try {
    return respond(await resolveGangPrimaryPhotoUrls(cookies().get('ceipol_session')?.value, { projectId, gangId }));
  } catch (error) {
    const code = error instanceof ProjectAccessError ? error.code : null;
    const status = code === 'PROJECT_ACCESS_UNAUTHENTICATED' || code === 'PROJECT_ACCESS_IDENTITY_NOT_FOUND' ? 401
      : code && code !== 'PROJECT_ACCESS_UNAVAILABLE' ? 403 : 503;
    return respond({ error: status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'PRIMARY_PHOTOS_UNAVAILABLE' }, status);
  }
}
