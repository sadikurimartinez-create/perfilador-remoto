jest.mock('server-only',()=>({}),{virtual:true});
jest.mock('@/lib/firebaseAdmin',()=>({getInstitutionalAdminDb:()=>{throw new Error('REAL_FORBIDDEN');}}));
import { buildEvidenceLineage } from '@/utils/evidenceLineage';
import type { DenueAnalyticalRelation } from '@/utils/denueAnalyticalRelation';
import { executeInstitutionalDenue } from '../src/services/institutionalDenueBoundary';
import { buildDenueAnalyticalReviewEvent } from '@/utils/denueAnalyticalReviewLedger';
import { adminFixture } from './helpers/p8InstitutionalAdminFixture';
const PROJECT_ID='A';
function relation(overrides: Partial<DenueAnalyticalRelation> = {}): DenueAnalyticalRelation {
  return {
    relationId: "denue-relation-persistent-1",
    denueLayerId: "denue:layer:1",
    sourceEvidenceId: "denue:evidence:1",
    expedienteId: PROJECT_ID,
    geographyId: "geo-r32b6h2a",
    relationTypes: ["SPATIAL_PROXIMITY"],
    linkedEvidenceIds: ["field:evidence:1"],
    linkedFindingIds: [],
    linkedHypothesisRefs: [],
    linkedSourceRefs: ["denue:evidence:1", "field:evidence:1"],
    spatialMetrics: {
      unit: "METERS",
      method: "SpatialLayerEngine.getDistance",
      distanceMeters: 24,
    },
    temporalCompatibility: "COMPATIBLE",
    sourceIndependence: {
      status: "UNKNOWN",
      assessedSourceRefs: ["denue:evidence:1", "field:evidence:1"],
      independentSourceRefs: [],
      rationale: ["SIMPLE_RELATION_INDEPENDENCE_NOT_ASSERTED"],
    },
    lineage: buildEvidenceLineage({
      sourceId: "INEGI_DENUE",
      sourceReference: "denue://query/persistent-1",
      evidenceId: "denue:evidence:1",
      geographyId: "geo-r32b6h2a",
      geographyType: "INDIVIDUAL",
    }),
    measuredFacts: [{
      factId: "fact-distance-1",
      metric: "distanceMeters",
      value: 24,
      unit: "METERS",
      sourceRefs: ["denue:evidence:1", "field:evidence:1"],
    }],
    proposedInterpretations: [],
    limitations: [
      { code: "DENUE_NOT_CRIMINAL_EVIDENCE" },
      { code: "PROXIMITY_NOT_CAUSALITY" },
      { code: "HUMAN_VALIDATION_REQUIRED" },
    ],
    machineAssessment: { status: "DETECTED", reasonCodes: ["MEASURED_SPATIAL_RELATION"] },
    humanValidation: { status: "PENDING", validatedBy: null, validatedAt: null, rationale: null },
    publicationEligibility: "INELIGIBLE",
    methodologyVersion: "ADR-026:R3.2B.6H.2A:v1",
    ...overrides,
  };
}


function fixture(){const f=adminFixture({'projects/A':{deleted:false,estado:'ABIERTO'}});const authorize=jest.fn(async()=>({allowed:true,projectId:'A',actor:{institutionalUserId:'1',username:'Server actor',role:'USER'}} as any));return{...f,authorize,deps:{authorize,database:()=>f.db}};}
test('base relations and audit persist atomically through unchanged DENUE engine',async()=>{const f=fixture();const result=await executeInstitutionalDenue('session','A','SAVE',[relation()],f.deps);expect(result.relations).toHaveLength(1);expect(result.relations[0].humanValidation.status).toBe('PENDING');expect(f.entries().filter(([path])=>path.startsWith('audit_logs/'))).toHaveLength(1);});
test('human review replaces fabricated reviewer and date with server actor',async()=>{const f=fixture();await executeInstitutionalDenue('session','A','SAVE',[relation()],f.deps);const proposed=buildDenueAnalyticalReviewEvent(relation(),{nextStatus:'ACCEPTED',reviewedBy:'forged',reviewedAt:'2026-01-01T00:00:00Z',rationale:'Explicit human review'});const result=await executeInstitutionalDenue('session','A','REVIEW',proposed,f.deps);expect(result.relations[0].humanValidation.validatedBy).toBe('user:1');expect(result.reviewLedgers[0].events[0].reviewedBy).toBe('user:1');expect(result.reviewLedgers[0].events[0].reviewedAt).not.toBe(proposed.reviewedAt);});
test('audit failure rolls back review head and immutable event',async()=>{const f=fixture();await executeInstitutionalDenue('session','A','SAVE',[relation()],f.deps);const before=f.entries();f.failWrite('audit_logs/');const proposed=buildDenueAnalyticalReviewEvent(relation(),{nextStatus:'ACCEPTED',reviewedBy:'forged',reviewedAt:'2026-01-01T00:00:00Z',rationale:'Explicit human review'});await expect(executeInstitutionalDenue('session','A','REVIEW',proposed,f.deps)).rejects.toThrow();expect(f.entries()).toEqual(before);});
test('revoked grant denies before persistence',async()=>{const f=fixture();f.authorize.mockResolvedValue({allowed:false} as any);const database=jest.fn();await expect(executeInstitutionalDenue('session','A','SAVE',[relation()],{authorize:f.authorize,database})).rejects.toThrow('ACCESS_DENIED');expect(database).not.toHaveBeenCalled();});
test('cross project base relation is rejected',async()=>{const f=fixture();await expect(executeInstitutionalDenue('session','A','SAVE',[relation({expedienteId:'B'})],f.deps)).rejects.toThrow('PROJECT_MISMATCH');expect(f.entries()).toHaveLength(1);});
test('client approved base relation cannot fabricate a human decision',async()=>{const f=fixture();await expect(executeInstitutionalDenue('session','A','SAVE',[relation({humanValidation:{status:'ACCEPTED',validatedBy:'forged',validatedAt:'2026-01-01T00:00:00Z',rationale:'forged'}})],f.deps)).rejects.toThrow();expect(f.entries()).toHaveLength(1);});
