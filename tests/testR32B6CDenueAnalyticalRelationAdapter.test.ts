import { GeointGovernanceStatus } from "../src/types/geointGovernance";
import type { GeoEvidence } from "../src/types/geointEvidence";
import type { EvidenceRelationship } from "../src/utils/evidenceRelationshipEngine";
import type { ExecutiveFinding } from "../src/utils/executiveGeointReportModel";
import {
  adaptDenueFindingCandidates,
  adaptDenueGeoEvidenceCandidate,
  adaptDenueMultisourceCandidate,
  adaptDenueStreetViewCandidate,
  deduplicateDenueAnalyticalCandidates,
  rejectAdr022AggregateForDenueRelation,
  rejectUnsupportedDenueAnalyticalSource,
  type GovernedDenueAnalyticalObservation,
} from "../src/utils/denueAnalyticalRelationAdapter";
import { canonicalizeDenuePoisForInstitutionalAnalysis } from "../src/utils/denueCanonicalPoi";
import { adaptDenueObservationToGovernedMapLayer } from "../src/utils/denueGovernedMapAdapter";
import {
  buildCanonicalProjectGeography,
  type CanonicalProjectGeography,
} from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage } from "../src/utils/evidenceLineage";
import type { ConvergenceSourceEntry } from "../src/utils/institutionalMultisourceConvergence";
import {
  measureDenueAgainstCanonicalGeography,
  measureDenuePointDistance,
} from "../src/utils/denueSpatialRelationMetrics";

const EXPEDIENTE_ID = "exp-r32b6c";
const METHODOLOGY = "ADR-026:R3.2B.6C:v1";
const DENUE_POINT = { lat: 21.88182, lng: -102.29163 };

function geography(
  type: "INDIVIDUAL" | "CORRIDOR" | "POLYGON" = "INDIVIDUAL"
): CanonicalProjectGeography {
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
    projectId: EXPEDIENTE_ID,
    type,
    geographyId: `geo-${type.toLowerCase()}`,
    points,
    now: 1,
  });
}

function denue(canonicalGeography = geography()): GovernedDenueAnalyticalObservation {
  const canonicalized = canonicalizeDenuePoisForInstitutionalAnalysis([{
    Id: "010010001234",
    Nombre: "Unidad economica observada",
    Clase_actividad: "Comercio observado",
    Domicilio: "Calle institucional 100",
    Latitud: String(DENUE_POINT.lat),
    Longitud: String(DENUE_POINT.lng),
  }], {
    expedienteId: EXPEDIENTE_ID,
    canonicalGeography,
    radiusMeters: 500,
    acquiredAt: "2026-09-29T12:00:00.000Z",
    query: "DENUE governed query",
  });
  const poi = canonicalized.institutionalPois[0];
  const adapted = adaptDenueObservationToGovernedMapLayer(poi, { productId: "denue-context-product" });
  if (adapted.status !== "ADAPTED") throw new Error(adapted.reasons.join(","));
  return { poi, layer: adapted.layer };
}

function evidence(
  canonicalGeography = geography(),
  overrides: Partial<GeoEvidence> = {}
): GeoEvidence {
  const sourceEvidenceId = overrides.sourceEvidenceId ?? "field:evidence:24m";
  return {
    id: sourceEvidenceId,
    expedienteId: EXPEDIENTE_ID,
    traceabilityId: "trace-field-24m",
    sourceEvidenceId,
    geographyId: canonicalGeography.geographyId,
    source: "FIELD_PHOTO",
    coordinates: { lat: DENUE_POINT.lat, lng: DENUE_POINT.lng + 0.000232 },
    captureDate: "2026-09-29T12:05:00.000Z",
    imageReference: "evidence://field-24m",
    metadata: { sourceProvider: "CEIPOL_FIELD" },
    status: GeointGovernanceStatus.APPROVED_EVIDENCE,
    lineage: buildEvidenceLineage({
      sourceId: "CEIPOL_FIELD",
      sourceReference: "evidence://field-24m",
      evidenceId: sourceEvidenceId,
      geographyId: canonicalGeography.geographyId,
      geographyType: canonicalGeography.type,
    }),
    lineageStatus: "SUPPORTED",
    ...overrides,
  };
}

function candidate(canonicalGeography = geography(), evidenceOverrides: Partial<GeoEvidence> = {}) {
  return adaptDenueGeoEvidenceCandidate({
    denue: denue(canonicalGeography),
    canonicalGeography,
    evidence: evidence(canonicalGeography, evidenceOverrides),
    maxCandidateDistanceMeters: 100,
    methodologyVersion: METHODOLOGY,
  });
}

function expectRejected(result: ReturnType<typeof candidate>, reason: string) {
  expect(result.status).toBe("REJECTED");
  expect(result.reasons).toContain(reason);
}

describe("R3.2B.6C DENUE analytical relation adapters", () => {
  test("evidencia gobernada a aproximadamente 24 m produce candidato medido y no publicable", () => {
    const result = candidate();
    expect(result.status).toBe("CANDIDATE");
    if (result.status !== "CANDIDATE") throw new Error(result.reasons.join(","));
    expect(result.relation.relationTypes).toEqual(["SPATIAL_PROXIMITY"]);
    expect(result.relation.spatialMetrics?.distanceMeters).toBeGreaterThan(23);
    expect(result.relation.spatialMetrics?.distanceMeters).toBeLessThan(25);
    expect(result.relation.spatialMetrics?.unit).toBe("METERS");
    expect(result.relation.machineAssessment.status).toBe("DETECTED");
    expect(result.relation.humanValidation).toEqual({ status: "PENDING", validatedBy: null, validatedAt: null, rationale: null });
    expect(result.relation.publicationEligibility).toBe("INELIGIBLE");
    expect(result.relation.proposedInterpretations).toEqual([]);
    expect(JSON.stringify(result.relation)).not.toMatch(/risk|vulnerab|criminogenic|ranking|ipt/i);
  });

  test("vinculo ERG formal agrega EXPLICIT_SOURCE_LINK y EVIDENCE_COINCIDENCE sin usar inferencias legacy", () => {
    const canonicalGeography = geography();
    const fieldEvidence = evidence(canonicalGeography);
    const relationship: EvidenceRelationship = {
      id: "erg-link-1",
      evidenceId: fieldEvidence.id,
      projectId: EXPEDIENTE_ID,
      source: "FIELD_CAPTURE",
      geography: { type: "POINT", latitude: fieldEvidence.coordinates.lat!, longitude: fieldEvidence.coordinates.lng! },
      criminogenicFactors: ["legacy-ignored"],
      hypothesisLinks: ["legacy-ignored"],
      confidence: "HIGH",
      createdAt: "2026-09-29T12:10:00.000Z",
    };
    const result = adaptDenueGeoEvidenceCandidate({
      denue: denue(canonicalGeography),
      canonicalGeography,
      evidence: fieldEvidence,
      maxCandidateDistanceMeters: 100,
      methodologyVersion: METHODOLOGY,
      explicitErgLink: { relationship, reference: "erg://erg-link-1" },
    });
    expect(result.status).toBe("CANDIDATE");
    if (result.status !== "CANDIDATE") throw new Error(result.reasons.join(","));
    expect(result.relation.relationTypes).toEqual(expect.arrayContaining([
      "SPATIAL_PROXIMITY", "EXPLICIT_SOURCE_LINK", "EVIDENCE_COINCIDENCE",
    ]));
    expect(result.relation.linkedSourceRefs).toContain("erg://erg-link-1");
    expect(JSON.stringify(result.relation)).not.toContain("legacy-ignored");
  });

  test("Street View aprobado conserva trazabilidad y lineage", () => {
    const canonicalGeography = geography();
    const streetEvidence = evidence(canonicalGeography, { sourceEvidenceId: "street:evidence:1", source: "STREET_VIEW_MANUAL" });
    const result = adaptDenueStreetViewCandidate({
      denue: denue(canonicalGeography),
      canonicalGeography,
      maxCandidateDistanceMeters: 100,
      methodologyVersion: METHODOLOGY,
      finding: {
        id: "street-finding-1",
        expedienteId: EXPEDIENTE_ID,
        traceabilityId: "street-trace-1",
        sourceEvidenceId: streetEvidence.sourceEvidenceId,
        categoria: "sin_hallazgo",
        coordenadas: { lat: streetEvidence.coordinates.lat!, lng: streetEvidence.coordinates.lng! },
        estado: GeointGovernanceStatus.APPROVED_EVIDENCE,
        fechaCreacion: streetEvidence.captureDate,
        geographyId: canonicalGeography.geographyId,
        lineage: streetEvidence.lineage,
        lineageStatus: "SUPPORTED",
      },
    });
    expect(result.status).toBe("CANDIDATE");
    if (result.status !== "CANDIDATE") throw new Error(result.reasons.join(","));
    expect(result.relation.linkedEvidenceIds).toEqual([streetEvidence.sourceEvidenceId]);
    expect(result.relation.lineage.some((node) => node.evidenceId === streetEvidence.sourceEvidenceId)).toBe(true);
    expect(result.relation.spatialMetrics?.distanceMeters).toBeGreaterThan(0);
  });

  test("hallazgo sin coordenada propia se relaciona solo por evidencia georreferenciada formal", () => {
    const canonicalGeography = geography();
    const linkedEvidence = evidence(canonicalGeography);
    const finding: ExecutiveFinding = {
      findingId: "finding-mediated-1",
      title: "Texto no usado para correlacion",
      summary: "Texto no usado para correlacion",
      evidenceReferences: [linkedEvidence.id],
      sourceTypes: ["FIELD_PHOTO"],
      supportingFactors: [],
      contradictingFactors: [],
      interpretation: "",
      implication: "",
      confidence: "MEDIA",
      limitations: [],
      traceabilityIds: [linkedEvidence.traceabilityId],
      technicalMetadata: { sourceFindingIds: [], sourceEvidenceIds: [linkedEvidence.sourceEvidenceId], sourceAnalysisIds: [] },
    };
    const batch = adaptDenueFindingCandidates({
      denue: denue(canonicalGeography),
      canonicalGeography,
      finding,
      evidenceRegistry: [linkedEvidence],
      maxCandidateDistanceMeters: 100,
      methodologyVersion: METHODOLOGY,
    });
    expect(batch.rejected).toEqual([]);
    expect(batch.conflicts).toEqual([]);
    expect(batch.candidates).toHaveLength(1);
    expect(batch.candidates[0].relationTypes).toEqual(expect.arrayContaining(["SPATIAL_PROXIMITY", "FINDING_RELATION"]));
    expect(batch.candidates[0].linkedFindingIds).toEqual([finding.findingId]);
    expect(batch.candidates[0].lineage).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "FINDING", findingId: finding.findingId, supportingEvidenceIds: [linkedEvidence.id] }),
    ]));
  });

  test("multifuente requiere independencia calculada por institutionalMultisourceConvergence", () => {
    const canonicalGeography = geography();
    const source = (sourceKind: "PLACES" | "FIELD_OBSERVATION", id: string): ConvergenceSourceEntry => ({
      sourceKind,
      sourceId: id,
      sourceEvidenceId: `${id}:evidence`,
      traceabilityId: `${id}:trace`,
      expedienteId: EXPEDIENTE_ID,
      geographyId: canonicalGeography.geographyId,
      coordinates: DENUE_POINT,
      timestamp: "2026-09-29T12:00:00.000Z",
      epistemicRole: "OBSERVED",
      validationStatus: "HUMAN_REVIEWED",
      lineage: buildEvidenceLineage({
        sourceId: id,
        sourceReference: `${id}://source`,
        evidenceId: `${id}:evidence`,
        geographyId: canonicalGeography.geographyId,
        geographyType: canonicalGeography.type,
      }),
      sourceReferences: [`${id}://source`],
      phenomenonTags: ["OBSERVED_CONTEXT"],
      acquisitionMode: "OBSERVED",
    });
    const result = adaptDenueMultisourceCandidate({
      denue: denue(canonicalGeography),
      canonicalGeography,
      sources: [source("PLACES", "places-1"), source("FIELD_OBSERVATION", "field-1")],
      methodologyVersion: METHODOLOGY,
    });
    expect(result.status).toBe("CANDIDATE");
    if (result.status !== "CANDIDATE") throw new Error(result.reasons.join(","));
    expect(result.relation.relationTypes).toEqual(["MULTISOURCE_CORROBORATION"]);
    expect(result.relation.sourceIndependence.status).toBe("INDEPENDENT");
    expect(result.relation.sourceIndependence.independentSourceRefs).toHaveLength(2);
    expect(result.relation.measuredFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: "sourceCount", value: 2 }),
      expect.objectContaining({ metric: "independentSourceCount", value: 2 }),
    ]));
    expect(result.relation.publicationEligibility).toBe("INELIGIBLE");
  });

  test("INDIVIDUAL mide contra Point canonico", () => {
    const result = measureDenueAgainstCanonicalGeography(DENUE_POINT, geography("INDIVIDUAL"));
    expect(result.status).toBe("MEASURED");
    if (result.status !== "MEASURED") throw new Error(result.reasons.join(","));
    expect(result.measurement.distanceToCanonicalPointMeters).toBeGreaterThan(0);
    expect(result.measurement.method).toContain("getDistance:CANONICAL_POINT");
  });

  test("CORRIDOR usa distancia minima a LineString y no centroide", () => {
    const canonicalGeography = geography("CORRIDOR");
    const point = { lat: 21.8802, lng: -102.3098 };
    const result = measureDenueAgainstCanonicalGeography(point, canonicalGeography);
    expect(result.status).toBe("MEASURED");
    if (result.status !== "MEASURED") throw new Error(result.reasons.join(","));
    expect(result.measurement.distanceToCorridorMeters).toBeLessThan(30);
    expect(result.measurement.method).toContain("distToPolyline:CANONICAL_LINESTRING");
    expect(JSON.stringify(result.measurement)).not.toContain("centroid");
  });

  test("POLYGON distingue interior, exterior y distancia al limite", () => {
    const canonicalGeography = geography("POLYGON");
    const inside = measureDenueAgainstCanonicalGeography({ lat: 21.89, lng: -102.29 }, canonicalGeography);
    const outside = measureDenueAgainstCanonicalGeography({ lat: 21.92, lng: -102.29 }, canonicalGeography);
    expect(inside.status).toBe("MEASURED");
    expect(outside.status).toBe("MEASURED");
    if (inside.status !== "MEASURED" || outside.status !== "MEASURED") throw new Error("polygon measurement failed");
    expect(inside.measurement.insideCanonicalGeography).toBe(true);
    expect(outside.measurement.insideCanonicalGeography).toBe(false);
    expect(inside.measurement.distanceToBoundaryMeters).toBeGreaterThan(0);
    expect(outside.measurement.distanceToBoundaryMeters).toBeGreaterThan(0);
    expect(inside.measurement.method).not.toContain("centroid");
  });

  test("rechaza expediente y geographyId incompatibles", () => {
    expectRejected(candidate(geography(), { expedienteId: "exp-other" }), "EXPEDIENTE_MISMATCH");
    expectRejected(candidate(geography(), { geographyId: "geo-other" }), "GEOGRAPHY_MISMATCH");
  });

  test.each([
    ["DENUE sin coordinates", () => {
      const canonicalGeography = geography();
      const observation = denue(canonicalGeography);
      return adaptDenueGeoEvidenceCandidate({
        denue: { ...observation, poi: { ...observation.poi, coordinates: undefined as any } },
        canonicalGeography,
        evidence: evidence(canonicalGeography),
        maxCandidateDistanceMeters: 100,
        methodologyVersion: METHODOLOGY,
      });
    }, "DENUE_COORDINATES_INVALID"],
    ["source sin coordinates", () => candidate(geography(), { coordinates: undefined as any }), "SOURCE_COORDINATES_INVALID"],
    ["lat invalida", () => candidate(geography(), { coordinates: { lat: 91, lng: -102.2 } }), "SOURCE_COORDINATES_INVALID"],
    ["lng invalida", () => candidate(geography(), { coordinates: { lat: 21.8, lng: -181 } }), "SOURCE_COORDINATES_INVALID"],
    ["NaN", () => candidate(geography(), { coordinates: { lat: Number.NaN, lng: -102.2 } }), "SOURCE_COORDINATES_INVALID"],
    ["Infinity", () => candidate(geography(), { coordinates: { lat: 21.8, lng: Number.POSITIVE_INFINITY } }), "SOURCE_COORDINATES_INVALID"],
    ["sourceEvidenceId vacio", () => candidate(geography(), { sourceEvidenceId: "" }), "SOURCE_EVIDENCE_ID_REQUIRED"],
    ["traceability faltante", () => candidate(geography(), { traceabilityId: "" }), "SOURCE_TRACEABILITY_ID_REQUIRED"],
    ["lineage invalido", () => candidate(geography(), { lineage: [] }), "SOURCE_LINEAGE_INVALID"],
  ])("rechazo fail-closed: %s", (_label, run, reason) => {
    expectRejected(run(), reason);
  });

  test("hallazgo sin evidencia georreferenciada no crea candidato", () => {
    const canonicalGeography = geography();
    const finding = {
      findingId: "finding-without-evidence",
      evidenceReferences: ["missing"],
      technicalMetadata: { sourceEvidenceIds: ["missing"] },
    } as ExecutiveFinding;
    const result = adaptDenueFindingCandidates({
      denue: denue(canonicalGeography),
      canonicalGeography,
      finding,
      evidenceRegistry: [],
      maxCandidateDistanceMeters: 100,
      methodologyVersion: METHODOLOGY,
    });
    expect(result.candidates).toEqual([]);
    expect(result.rejected[0].reasons).toContain("FINDING_WITHOUT_GEOREFERENCED_EVIDENCE");
  });

  test("ADR-022 agregado y OSINT solo por nombre no crean candidato", () => {
    expect(rejectAdr022AggregateForDenueRelation({ totalRecords: 5 }).reasons).toEqual(["ADR022_AGGREGATE_NOT_INDIVIDUALIZED"]);
    expect(rejectUnsupportedDenueAnalyticalSource("OSINT_NAME_ONLY").reasons).toEqual(["OSINT_NAME_ONLY_FORBIDDEN"]);
  });

  test("fuentes multifuent e duplicadas se rechazan", () => {
    const canonicalGeography = geography();
    const source: ConvergenceSourceEntry = {
      sourceKind: "PLACES",
      sourceId: "places-1",
      sourceEvidenceId: "places-evidence-1",
      traceabilityId: "places-trace-1",
      expedienteId: EXPEDIENTE_ID,
      geographyId: canonicalGeography.geographyId,
      coordinates: DENUE_POINT,
      timestamp: "2026-09-29T12:00:00.000Z",
      epistemicRole: "OBSERVED",
      lineage: buildEvidenceLineage({ evidenceId: "places-evidence-1", geographyId: canonicalGeography.geographyId }),
      sourceReferences: ["places://1"],
      phenomenonTags: ["OBSERVED_CONTEXT"],
      acquisitionMode: "OBSERVED",
    };
    const result = adaptDenueMultisourceCandidate({
      denue: denue(canonicalGeography), canonicalGeography, sources: [source, { ...source }], methodologyVersion: METHODOLOGY,
    });
    expect(result.status).toBe("REJECTED");
    expect(result.reasons).toContain("MULTISOURCE_DUPLICATED_SOURCE");
  });

  test("identidad es determinista y duplicados logicos se colapsan", () => {
    const first = candidate();
    const second = candidate();
    expect(first.status).toBe("CANDIDATE");
    expect(second.status).toBe("CANDIDATE");
    if (first.status !== "CANDIDATE" || second.status !== "CANDIDATE") throw new Error("candidate failed");
    expect(first.relation.relationId).toBe(second.relation.relationId);
    const batch = deduplicateDenueAnalyticalCandidates([
      { sourceId: "first", result: first },
      { sourceId: "second", result: second },
    ]);
    expect(batch.candidates).toHaveLength(1);
    expect(batch.conflicts).toEqual([]);
  });

  test("conflicto bajo la misma identidad falla cerrado", () => {
    const first = candidate();
    if (first.status !== "CANDIDATE") throw new Error(first.reasons.join(","));
    const conflicting = {
      status: "CANDIDATE" as const,
      reasons: [] as [],
      relation: {
        ...first.relation,
        measuredFacts: first.relation.measuredFacts.map((fact, index) => index === 0 ? { ...fact, value: 99 } : fact),
      },
    };
    const batch = deduplicateDenueAnalyticalCandidates([
      { sourceId: "first", result: first },
      { sourceId: "conflict", result: conflicting },
    ]);
    expect(batch.candidates).toEqual([]);
    expect(batch.conflicts).toEqual([{ relationId: first.relation.relationId, reason: "RELATION_ID_CONFLICT" }]);
  });

  test("distancias invalidas nunca se propagan", () => {
    expect(measureDenuePointDistance({ lat: Number.NaN, lng: -102 }, DENUE_POINT)).toBeNull();
    expect(measureDenuePointDistance({ lat: 21, lng: Number.POSITIVE_INFINITY }, DENUE_POINT)).toBeNull();
  });
});
