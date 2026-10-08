import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash, randomUUID } from "crypto";
import { authorizeInstitutionalProjectAccess } from "@/services/institutionalProjectAccessService";
import { InstitutionalPandillasRepository } from "@/services/institutionalPandillasRepository";
import { GangGISAnalysisLayer } from "@/lib/providers/gangGISAnalysisLayer";
import { GeoIntAnalyticsEngine } from "@/lib/geoint/geoIntAnalyticsEngine";
import { CriminalIntelligenceCorrelationEngine } from "@/lib/criminal/correlation/criminalCorrelationEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const layers = ['domiciles', 'influence_zones', 'corridors', 'graffiti', 'history'];
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,1500}$/.test(v);
const exact = (v: Record<string, any>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
// Same canonical JSON as the UI: digest is a concurrency precondition, never authorization.
function canonical(v: any): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (object(v)) return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
const digest = (gangs: any[]) => '"' + createHash('sha256').update(canonical([...gangs].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0))).digest('hex') + '"';
const coordinate = (p: any) => object(p) && typeof p.lat === 'number' && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && typeof p.lng === 'number' && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);

export async function POST(req: Request) {
  const correlationId = randomUUID();
  let audit: Record<string, unknown> = { correlationId, operation: 'PANDILLAS_GIS', timestamp: new Date().toISOString() };
  const reply = (body: any, status: number) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' } });
  const reject = (status: number, code: string) => {
    console.info('[PANDILLAS_GIS_AUDIT]', { ...audit, outcome: 'DENY', code });
    return reply({ error: code }, status);
  };
  try {
    if (req.headers.get('origin') !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site') return reject(403, 'PANDILLAS_ACCESS_DENIED');
    if (Number(req.headers.get('content-length')) > 65536) return reject(413, 'PANDILLAS_GIS_INVALID_REQUEST');
    const text = await req.text();
    if (Buffer.byteLength(text, 'utf8') > 65536) return reject(413, 'PANDILLAS_GIS_INVALID_REQUEST');
    let body: any;
    try { body = JSON.parse(text); } catch { return reject(400, 'PANDILLAS_GIS_INVALID_REQUEST'); }
    if (!object(body) || !exact(body, ['projectId', 'selectedGangIds', 'activeLayers', 'geometryRefs']) || !id(body.projectId)) return reject(400, 'PANDILLAS_GIS_INVALID_REQUEST');
    const sessionToken = cookies().get('ceipol_session')?.value;
    const access = await authorizeInstitutionalProjectAccess({ sessionToken, projectId: body.projectId, action: 'WRITE' });
    if (!access.allowed) return reject(access.code === 'PROJECT_ACCESS_UNAUTHENTICATED' ? 401 : 403, 'PANDILLAS_ACCESS_DENIED');
    audit = { ...audit, actor: access.actor.institutionalUserId, projectId: access.projectId, authorization: 'WRITE_CONTEXT_AND_READ_CUSTODY' };
    const { selectedGangIds, activeLayers, geometryRefs } = body;
    if (!Array.isArray(selectedGangIds) || !selectedGangIds.length || selectedGangIds.length > 100 || !selectedGangIds.every(id) || new Set(selectedGangIds).size !== selectedGangIds.length ||
        !Array.isArray(activeLayers) || activeLayers.length > layers.length || !activeLayers.every(v => layers.includes(v)) || new Set(activeLayers).size !== activeLayers.length ||
        !Array.isArray(geometryRefs) || geometryRefs.length > 500 || !geometryRefs.every(r => object(r) && exact(r, ['gangId', 'geometryId']) && id(r.gangId) && id(r.geometryId) && selectedGangIds.includes(r.gangId)) || new Set(geometryRefs.map(r => r.gangId + '/' + r.geometryId)).size !== geometryRefs.length) return reject(400, 'PANDILLAS_GIS_INVALID_REQUEST');
    const match = req.headers.get('if-match');
    if (!match || !/^"[a-f0-9]{64}"$/.test(match)) return reject(428, 'PANDILLAS_GIS_SNAPSHOT_REQUIRED');
    const repository = new InstitutionalPandillasRepository();
    const resolve = async () => {
      const records = await repository.listMasterGangs();
      const selected = selectedGangIds.map(gangId => records.filter(g => g.id === gangId));
      if (selected.some(matches => matches.length !== 1)) return null;
      return selected.map(matches => {
        const { scope, custody, ...gang } = matches[0];
        return { ...gang, projectId: custody.custodyProjectId };
      });
    };
    const gangs = await resolve();
    if (!gangs) return reject(403, 'PANDILLAS_ACCESS_DENIED');
    if (new Set(gangs.map(g => g.nombre)).size !== gangs.length) return reject(409, 'PANDILLAS_GIS_CONTEXT_CHANGED');
    for (const custody of new Set(gangs.map(g => g.projectId))) {
      const read = await authorizeInstitutionalProjectAccess({ sessionToken, projectId: custody, action: 'READ' });
      if (!read.allowed) return reject(403, 'PANDILLAS_ACCESS_DENIED');
    }
    if (digest(gangs) !== match) return reject(409, 'PANDILLAS_GIS_CONTEXT_CHANGED');
    const drawings = [];
    for (const ref of geometryRefs) {
      const shapes = gangs.find(g => g.id === ref.gangId)!.geometrias?.filter(g => g.id === ref.geometryId) || [];
      if (shapes.length !== 1) return reject(409, 'PANDILLAS_GIS_CONTEXT_CHANGED');
      const shape = shapes[0];
      const type = shape.tipo === 'zona_riesgo' ? 'buffer' : shape.tipo === 'poligono' ? 'polygon' : shape.tipo;
      if (!['polygon', 'corridor', 'buffer', 'corredor'].includes(type) || !Array.isArray(shape.puntos) || !shape.puntos.length || !shape.puntos.every(coordinate)) return reject(409, 'PANDILLAS_GIS_CONTEXT_CHANGED');
      drawings.push({ geometry_type: type, coordinates: shape.puntos, radio: shape.radio, risk_level: (shape as any).riskLevel || 'medium', label: shape.nombre, timestamp: shape.fechaActualizacion || '' });
    }
    const gis = GangGISAnalysisLayer.processGISData(gangs);
    if (!gis.nodes.every(n => coordinate(n.location)) || !gis.zones.every(z => z.points.length && z.points.every(coordinate))) return reject(409, 'PANDILLAS_GIS_CONTEXT_CHANGED');
    // Fresh authorization and snapshot immediately before the model; no transaction spans an external model.
    const fresh = await resolve();
    if (!fresh || digest(fresh) !== match) return reject(409, 'PANDILLAS_GIS_CONTEXT_CHANGED');
    for (const [projectId, action] of [[access.projectId, 'WRITE'], ...Array.from(new Set(gangs.map(g => g.projectId))).map(p => [p, 'READ'])]) {
      if (!(await authorizeInstitutionalProjectAccess({ sessionToken, projectId, action })).allowed) return reject(403, 'PANDILLAS_ACCESS_DENIED');
    }
    audit = { ...audit, selectedGangIds, sources: gangs.map(g => ({ gangId: g.id, custodyProjectId: g.projectId, updatedAt: g.updatedAt ?? null })), geometryRefs, snapshot: match };
    console.info('[PANDILLAS_GIS_AUDIT]', { ...audit, outcome: 'ALLOW' });
    const selectedGangs = gangs.map(g => g.nombre);
    const result = await GeoIntAnalyticsEngine.analyze({ selectedGangs, activeLayers, domiciles: gis.nodes, influenceZones: gis.zones, manualDrawings: drawings, allGangs: gangs });
    const cice = CriminalIntelligenceCorrelationEngine.correlate({ selectedGangs, incidentsCount: 0, domicilesCount: gis.nodes.length, zonesCount: gis.zones.length, rssCount: 0, hasGoogleMaps: false, hasScince: false, hasDenue: false });
    console.info('[PANDILLAS_GIS_AUDIT]', { ...audit, outcome: 'SUCCESS', completedAt: new Date().toISOString(), isAiGenerated: result.isAiGenerated });
    return reply({ report: result.report, structuredOutput: { ...result.structuredOutput, cice_report: cice }, isAiGenerated: result.isAiGenerated }, 200);
  } catch {
    return reject(503, 'PANDILLAS_GIS_UNAVAILABLE');
  }
}
