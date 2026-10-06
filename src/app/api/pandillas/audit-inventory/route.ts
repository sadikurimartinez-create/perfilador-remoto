import { NextResponse, type NextRequest } from 'next/server';
import { readInstitutionalCollection } from '@/lib/institutionalCollectionActions';
import { ProjectAccessError } from '@/types/institutionalProjectAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Cookie',
  'X-Content-Type-Options': 'nosniff',
};
function failure(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers });
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
class InvalidInventoryData extends Error {}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.size > 0) return failure(400, 'AUDIT_INVENTORY_QUERY_NOT_ALLOWED');
  try {
    const records: unknown = await readInstitutionalCollection('pandillas');
    if (!Array.isArray(records)) throw new InvalidInventoryData();
    // Validate the whole inventory; never substitute or omit malformed records.
    const inventory = Array.from(records, record => {
      if (!object(record) || !text(record.id) || !text(record.projectId) || !text(record.nombre)
        || !Array.isArray(record.integrantes)) throw new InvalidInventoryData();
      const integrantes = Array.from(record.integrantes, member => {
        if (!object(member) || !text(member.nombre)) throw new InvalidInventoryData();
        return { nombre: member.nombre };
      });
      return { id: record.id, projectId: record.projectId, nombre: record.nombre, integrantes };
    });
    inventory.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return NextResponse.json(inventory, { headers });
  } catch (error) {
    if (error instanceof InvalidInventoryData) return failure(500, 'INVENTORY_DATA_INVALID');
    if (error instanceof ProjectAccessError) {
      if (error.code === 'PROJECT_ACCESS_UNAUTHENTICATED' || error.code === 'PROJECT_ACCESS_IDENTITY_NOT_FOUND') {
        return failure(401, 'UNAUTHENTICATED');
      }
      if (error.code === 'PROJECT_ACCESS_ROLE_UNSUPPORTED') return failure(403, 'FORBIDDEN');
      if (error.code === 'PROJECT_ACCESS_UNAVAILABLE') return failure(503, 'INVENTORY_UNAVAILABLE');
    }
    // These existing helpers emit plain Error instances, not ProjectAccessError.
    if (error instanceof Error) {
      if (error.message === 'INSTITUTIONAL_COLLECTION_CAPACITY_EXCEEDED') return failure(503, 'INVENTORY_CAPACITY_EXCEEDED');
      if (error.message === 'AUTHORIZATION_SNAPSHOT_INVALID' || error.message === 'AUTHORIZATION_RELATION_INVALID'
        || error.message === 'AUTHORIZATION_REVOCATION_INVALID') return failure(503, 'INVENTORY_UNAVAILABLE');
    }
    return failure(500, 'INVENTORY_INTERNAL_ERROR');
  }
}
