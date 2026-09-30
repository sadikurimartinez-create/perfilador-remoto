import { DenueAnalyticalCandidateService } from "@/services/denueAnalyticalCandidateService";
import { InMemoryDenueAnalyticalWorkflowRepository } from "@/services/denueAnalyticalWorkflowRepository";
import type { StreetViewFinding } from "@/services/streetViewFindingService";
import { GeointGovernanceStatus } from "@/types/geointGovernance";
import type { GeoEvidence } from "@/types/geointEvidence";
import { buildCanonicalProjectGeography, type CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { canonicalizeDenuePoisForInstitutionalAnalysis } from "@/utils/denueCanonicalPoi";
import { buildEvidenceLineage } from "@/utils/evidenceLineage";
import type { EvidenceRelationship } from "@/utils/evidenceRelationshipEngine";
import type { ExecutiveFinding } from "@/utils/executiveGeointReportModel";
import type { PersistedDenuePoi } from "@/utils/institutionalStructuredPersistence";
import type { ConvergenceSourceEntry } from "@/utils/institutionalMultisourceConvergence";
import { buildDenueAnalyticalReviewEvent } from "@/utils/denueAnalyticalReviewLedger";

const PROJECT_ID = "exp-r32b6h2b";
const METHODOLOGY = "ADR-026:R3.2B.6H.2B:v1";
const DENUE_POINT = { lat: 21.88182, lng: -102.29163 };

function geography(type: "INDIVIDUAL" | "CORRIDOR" | "POLYGON" = "INDIVIDUAL"): CanonicalProjectGeography {
  const points = type === "INDIVIDUAL"
    ? [{ lat: 21.8818, lng: -102.2917 }]
    : type === "CORRIDOR"
      ? [{ lat: 21.88, lng: -102.31 }, { lat: 21.88, lng: -102.27 }]
      : [
          { lat: 21.87, lng: -102.31 },
          { lat: 21.87, lng: -102.27 },
          { lat: 21.91, lng: -102.27 },
          { lat: 21.91, lng: -102.31 },
        ];
  return buildCanonicalProjectGeography({
    projectId: PROJECT_ID,
    type,
    geographyId: `geo-${type.toLowerCase()}`,
    points,
    now: 1,
  });
}

function denuePoi(canonicalGeography: CanonicalProjectGeography): PersistedDenuePoi {
  const result = canonicalizeDenuePoisForInstitutionalAnalysis([{
    Id: "010010001234",
    Nombre: "Unidad economica observada",
    Clase_actividad: "Comercio observado",
    Domicilio: "Calle institucional 100",
    Latitud: String(DENUE_POINT.lat),
    Longitud: String(DENUE_POINT.lng),
  }], {
    expedienteId: PROJECT_ID,
    canonicalGeography,
    radiusMeters: 500,
    acquiredAt: "2026-09-30T12:00:00.000Z",
    query: "DENUE governed query",
  });
  return { ...result.institutionalPois[0], distanceMeters: null };
}

function evidence(canonicalGeography: CanonicalProjectGeography, overrides: Partial<GeoEvidence> = {}): GeoEvidence {
  const sourceEvidenceId = overrides.sourceEvidenceId || "field:evidence:24m";
  return {
    id: sourceEvidenceId,
    expedienteId: PROJECT_ID,
    traceabilityId: `${sourceEvidenceId}:trace`,
    sourceEvidenceId,
    geographyId: canonicalGeography.geographyId,
    source: "FIELD_PHOTO",
    coordinates: { lat: DENUE_POINT.lat, lng: DENUE_POINT.lng + 0.000232 },
    captureDate: "2026-09-30T12:05:00.000Z",
    imageReference: `evidence://${sourceEvidenceId}`,
    metadata: { sourceProvider: "CEIPOL_FIELD" },
    status: GeointGovernanceStatus.APPROVED_EVIDENCE,
    lineage: buildEvidenceLineage({
      sourceId: "CEIPOL_FIELD",
      sourceReference: `evidence://${sourceEvidenceId}`,
      evidenceId: sourceEvidenceId,
      geographyId: canonicalGeography.geographyId,
      geographyType: canonicalGeography.type,
    }),
    lineageStatus: "SUPPORTED",
    ...overrides,
  };
}

function baseInput(canonicalGeography = geography()) {
  return {
    projectId: PROJECT_ID,
    canonicalGeography,
    denuePois: [denuePoi(canonicalGeography)],
    geoEvidence: [evidence(canonicalGeography)],
    maxCandidateDistanceMeters: 100,
    methodologyVersion: METHODOLOGY,
  };
}

function multisource(canonicalGeography: CanonicalProjectGeography): ConvergenceSourceEntry[] {
  return ([
    ["PLACES", "places-1"],
    ["FIELD_OBSERVATION", "field-1"],
  ] as const).map(([sourceKind, sourceId]) => ({
    sourceKind,
    sourceId,
    sourceEvidenceId: `${sourceId}:evidence`,
    traceabilityId: `${sourceId}:trace`,
    expedienteId: PROJECT_ID,
    geographyId: canonicalGeography.geographyId,
    coordinates: DENUE_POINT,
    timestamp: "2026-09-30T12:00:00.000Z",
    epistemicRole: "OBSERVED",
    validationStatus: "HUMAN_REVIEWED",
    lineage: buildEvidenceLineage({
      sourceId,
      sourceReference: `${sourceId}://source`,
      evidenceId: `${sourceId}:evidence`,
      geographyId: canonicalGeography.geographyId,
      geographyType: canonicalGeography.type,
    }),
    sourceReferences: [`${sourceId}://source`],
    phenomenonTags: ["OBSERVED_CONTEXT"],
    acquisitionMode: "OBSERVED",
  }));
}

describe("R3.2B.6H.2B DENUE analytical candidate service", () => {
  test("explicit trigger with no relational sources returns zero candidates", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const service = new DenueAnalyticalCandidateService(repository);
    const canonicalGeography = geography();
    const result = await service.generate({
      ...baseInput(canonicalGeography),
      geoEvidence: [],
    });
    expect(result.candidateCount).toBe(0);
    expect(result.newCandidateCount).toBe(0);
    expect((await repository.load(PROJECT_ID)).relations).toEqual([]);
  });

  test("governed sources produce only DETECTED PENDING INELIGIBLE candidates", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const service = new DenueAnalyticalCandidateService(repository);
    const result = await service.generate(baseInput());
    const workflow = await repository.load(PROJECT_ID);
    expect(result.candidateCount).toBeGreaterThan(0);
    expect(result.newCandidateCount).toBe(result.candidateCount);
    workflow.relations.forEach((relation) => {
      expect(relation.machineAssessment.status).toBe("DETECTED");
      expect(relation.humanValidation.status).toBe("PENDING");
      expect(relation.publicationEligibility).toBe("INELIGIBLE");
    });
    expect(workflow.reviewLedgers.every((ledger) => ledger.events.length === 0)).toBe(true);
  });

  test("repeating the same trigger is idempotent and creates no duplicates", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const service = new DenueAnalyticalCandidateService(repository);
    const first = await service.generate(baseInput());
    const second = await service.generate(baseInput());
    const workflow = await repository.load(PROJECT_ID);
    expect(first.newCandidateCount).toBe(1);
    expect(second.newCandidateCount).toBe(0);
    expect(second.existingCandidateCount).toBe(1);
    expect(workflow.relations).toHaveLength(1);
  });

  test("equivalent regeneration preserves ACCEPTED relation and ledger", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const service = new DenueAnalyticalCandidateService(repository);
    await service.generate(baseInput());
    const pending = (await repository.load(PROJECT_ID)).relations[0];
    const accepted = buildDenueAnalyticalReviewEvent(pending, {
      nextStatus: "ACCEPTED",
      reviewedBy: "user:perfilador-42",
      reviewedAt: "2026-09-30T13:00:00.000Z",
      rationale: "Decision PPC expresa.",
    });
    await repository.appendReviewEvent(PROJECT_ID, accepted);
    const ledgerBefore = (await repository.load(PROJECT_ID)).reviewLedgers[0];

    const result = await service.generate(baseInput());
    const workflow = await repository.load(PROJECT_ID);
    expect(result.existingCandidateCount).toBe(1);
    expect(result.newCandidateCount).toBe(0);
    expect(workflow.relations[0].humanValidation.status).toBe("ACCEPTED");
    expect(workflow.reviewLedgers[0]).toEqual(ledgerBefore);
  });

  test("invalid adapter output is reported and not persisted", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const service = new DenueAnalyticalCandidateService(repository);
    const canonicalGeography = geography();
    const result = await service.generate({
      ...baseInput(canonicalGeography),
      geoEvidence: [evidence(canonicalGeography, { status: GeointGovernanceStatus.CANDIDATE })],
    });
    expect(result.invalidCandidateCount).toBe(1);
    expect(result.candidateCount).toBe(0);
    expect(result.warnings.join("|")).toContain("EVIDENCE_NOT_GOVERNED_APPROVED");
    expect((await repository.load(PROJECT_ID)).relations).toEqual([]);
  });

  test("input remains immutable", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const service = new DenueAnalyticalCandidateService(repository);
    const input = baseInput();
    const snapshot = JSON.stringify(input);
    await service.generate(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  test.each(["INDIVIDUAL", "CORRIDOR", "POLYGON"] as const)(
    "%s canonical geography is preserved by candidate metrics",
    async (type) => {
      const repository = new InMemoryDenueAnalyticalWorkflowRepository();
      const service = new DenueAnalyticalCandidateService(repository);
      const canonicalGeography = geography(type);
      const result = await service.generate(baseInput(canonicalGeography));
      const relation = (await repository.load(PROJECT_ID)).relations[0];
      expect(result.candidateCount).toBe(1);
      expect(relation.geographyId).toBe(canonicalGeography.geographyId);
      expect(relation.spatialMetrics?.method).toContain(
        type === "INDIVIDUAL" ? "CANONICAL_POINT" : type === "CORRIDOR" ? "CANONICAL_LINESTRING" : "CANONICAL_POLYGON"
      );
      expect(relation.spatialMetrics?.method).not.toContain("centroid");
    }
  );

  test("all currently supported relation types come only from existing adapters", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const service = new DenueAnalyticalCandidateService(repository);
    const canonicalGeography = geography();
    const fieldEvidence = evidence(canonicalGeography);
    const streetEvidence = evidence(canonicalGeography, {
      id: "street:evidence:1",
      sourceEvidenceId: "street:evidence:1",
      source: "STREET_VIEW_MANUAL",
    });
    const streetFinding: StreetViewFinding = {
      id: "street-finding-1",
      expedienteId: PROJECT_ID,
      traceabilityId: streetEvidence.traceabilityId,
      sourceEvidenceId: streetEvidence.sourceEvidenceId,
      categoria: "sin_hallazgo",
      coordenadas: streetEvidence.coordinates as { lat: number; lng: number },
      estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
      geographyId: canonicalGeography.geographyId,
      lineage: streetEvidence.lineage,
    };
    const finding: ExecutiveFinding = {
      findingId: "finding-1",
      title: "Hallazgo gobernado",
      summary: "Hallazgo enlazado a evidencia formal",
      evidenceReferences: [fieldEvidence.id],
      sourceTypes: ["FIELD_PHOTO"],
      supportingFactors: [],
      contradictingFactors: [],
      interpretation: "",
      implication: "",
      confidence: "MEDIA",
      limitations: [],
      traceabilityIds: [fieldEvidence.traceabilityId],
      technicalMetadata: {
        sourceFindingIds: [],
        sourceEvidenceIds: [fieldEvidence.sourceEvidenceId],
        sourceAnalysisIds: [],
      },
    };
    const relationship: EvidenceRelationship = {
      id: "erg-link-1",
      evidenceId: fieldEvidence.id,
      projectId: PROJECT_ID,
      source: "FIELD_CAPTURE",
      geography: {
        type: "POINT",
        latitude: fieldEvidence.coordinates.lat!,
        longitude: fieldEvidence.coordinates.lng!,
      },
      criminogenicFactors: ["ignored-legacy-value"],
      hypothesisLinks: [],
      confidence: "HIGH",
      createdAt: "2026-09-30T12:10:00.000Z",
    };
    const result = await service.generate({
      ...baseInput(canonicalGeography),
      geoEvidence: [fieldEvidence],
      streetViewFindings: [streetFinding],
      findings: [finding],
      multisourceGroups: [multisource(canonicalGeography)],
      verifiedErgLinks: [{
        sourceEvidenceId: fieldEvidence.sourceEvidenceId,
        link: { relationship, reference: "erg://erg-link-1" },
      }],
    });
    expect(result.relationTypes).toEqual([
      "EVIDENCE_COINCIDENCE",
      "EXPLICIT_SOURCE_LINK",
      "FINDING_RELATION",
      "MULTISOURCE_CORROBORATION",
      "SPATIAL_PROXIMITY",
    ]);
    expect(result.relationTypes).not.toEqual(expect.arrayContaining([
      "HYPOTHESIS_SUPPORT",
      "HYPOTHESIS_CONTRADICTION",
      "CONTEXTUAL_ASSOCIATION",
    ]));
  });

  test("result and persisted candidates expose no automatic risk semantics", async () => {
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const service = new DenueAnalyticalCandidateService(repository);
    const result = await service.generate(baseInput());
    const workflow = await repository.load(PROJECT_ID);
    expect(JSON.stringify({ result, workflow })).not.toMatch(/"(?:risk|danger|vulnerability|crimePropensity|priorityScore)"/i);
  });
});
