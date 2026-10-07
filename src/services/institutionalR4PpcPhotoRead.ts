import 'server-only';
import { getInstitutionalAdminDb } from '@/lib/firebaseAdmin';
import { authorizeInstitutionalProjectAccess } from './institutionalProjectAccessService';
import { resolveGangPrimaryPhotoUrls } from './institutionalPandillasPhotoBoundary';
import { photoId } from '@/modules/pandillas/photo-evidence/storagePaths';
import { isCertifiedR4FinalReview } from '@/utils/certifiedR4PhotoReview';
import { ProjectAccessError } from '@/types/institutionalProjectAccess';

const defaults = { authorize: authorizeInstitutionalProjectAccess, database: getInstitutionalAdminDb, resolve: resolveGangPrimaryPhotoUrls };
export async function readInstitutionalR4PpcPhoto(session: unknown, projectId: string, documentId: string, deps = defaults) {
  photoId(projectId); photoId(documentId);
  const access = await deps.authorize({ sessionToken: session, projectId, action: 'READ' });
  if (!access.allowed) throw new ProjectAccessError(access.code);
  if (access.projectId !== projectId) throw new ProjectAccessError('PROJECT_ACCESS_DENIED');
  const db = deps.database();
  const snapshot = await db.doc(`projects/${projectId}/documents/${documentId}`).get();
  const document: Record<string, any> = { ...snapshot.data(), id: snapshot.id };
  if (!isCertifiedR4FinalReview(document) || document.projectId !== projectId) throw new Error('R4_PPC_UNAVAILABLE');
  const associations = await db.collection(`projects/${projectId}/pandillasPhotoAssociations`).where('documentId', '==', documentId).limit(201).get();
  if (associations.docs.length > 200) throw new Error('R4_PPC_UNAVAILABLE');
  const gangs = [...new Set(associations.docs.map(row => row.data()).filter(row => row.projectId === projectId && row.documentId === documentId && row.status === 'ACTIVE' && row.associationLevel === 'EXACT' && row.imageType === 'MEMBER_PRIMARY_PHOTO').map(row => row.gangId))];
  if (gangs.length !== 1) throw new Error('R4_PPC_UNAVAILABLE');
  const result = await deps.resolve(session, { projectId, gangId: gangs[0] });
  const matches = result.items.flatMap(row => row.primaryPhoto?.assetId === documentId ? [row.primaryPhoto] : []);
  if (matches.length !== 1 || result.expiresAt <= Date.now()) throw new Error('R4_PPC_UNAVAILABLE');
  return { url: matches[0].derivedUrl, expiresAt: result.expiresAt };
}
