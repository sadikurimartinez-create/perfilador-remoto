import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { readInstitutionalR4PpcPhoto } from '@/services/institutionalR4PpcPhotoRead';
import { ProjectAccessError } from '@/types/institutionalProjectAccess';
import { photoId } from '@/modules/pandillas/photo-evidence/storagePaths';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' };
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  if ([...query.keys()].some(key => !['projectId', 'documentId'].includes(key)) || ['projectId', 'documentId'].some(key => query.getAll(key).length !== 1)) return NextResponse.json({ error: 'INVALID_SCOPE' }, { status: 400, headers });
  const projectId = query.get('projectId')!, documentId = query.get('documentId')!;
  try { photoId(projectId); photoId(documentId); } catch { return NextResponse.json({ error: 'INVALID_SCOPE' }, { status: 400, headers }); }
  try { return NextResponse.json(await readInstitutionalR4PpcPhoto(cookies().get('ceipol_session')?.value, projectId, documentId), { headers }); }
  catch (error) {
    const code = error instanceof ProjectAccessError ? error.code : null;
    const status = code === 'PROJECT_ACCESS_UNAUTHENTICATED' || code === 'PROJECT_ACCESS_IDENTITY_NOT_FOUND' ? 401 : code && code !== 'PROJECT_ACCESS_UNAVAILABLE' ? 403 : 503;
    return NextResponse.json({ error: 'PHOTO_UNAVAILABLE' }, { status, headers });
  }
}
