import {
  buildDenueAnalyticalPublicationProduct,
  type DenueAnalyticalPublicationProductRequest,
} from "@/services/denueAnalyticalPublicationService";
import {
  InMemoryDenueAnalyticalWorkflowRepository,
  type DenueAnalyticalWorkflowSnapshot,
} from "@/services/denueAnalyticalWorkflowRepository";
import { buildCanonicalProjectGeography, type CanonicalGeographyType } from "@/utils/canonicalProjectGeography";
import { canonicalizeDenuePoisForInstitutionalAnalysis } from "@/utils/denueCanonicalPoi";
import type { DenueAnalyticalRelation, DenueHumanValidationStatus } from "@/utils/denueAnalyticalRelation";
import { buildDenueAnalyticalReviewEvent } from "@/utils/denueAnalyticalReviewLedger";
import {
  adaptDenueObservationToGovernedMapLayer,
  type DenueGovernedMapLayer,
} from "@/utils/denueGovernedMapAdapter";

const PROJECT_ID = "exp-r32b6h2d";
const METHODOLOGY = "ADR-026:R3.2B.6H.2D:v1";
const REVIEWED_AT = "2026-09-30T17:00:00.000Z";

function geography(type: CanonicalGeographyType) {
  const points = type === "INDIVIDUAL"
    ? [{ lat: 21.88, lng: -102.30 }]
    : type === "CORRIDOR"
      ? [{ lat: 21.87, lng: -102.31 }, { lat: 21.92, lng: -102.26 }]
      : [
          { lat: 21.86, lng: -102.32 },
          { lat: 21.86, lng: -102.25 },
          { lat: 21.93, lng: -102.25 },
          { lat: 21.93, lng: -102.32 },
        ];
  return buildCanonicalProjectGeography({
    projectId: PROJECT_ID,
    type,
    geographyId: `geo-r32b6h2d-${type.toLowerCase()}`,
    points,
    now: 1,
  });
}

function denueLayer(
  canonicalGeography: ReturnType<typeof geography>,
  id: string,
  lat = 21.88,
  lng = -102.30
): DenueGovernedMapLayer {
  const pois = canonicalizeDenuePoisForInstitutionalAnalysis([{
    Id: id,
    Nombre: `Establecimiento ${id}`,
    Clase_actividad: `Actividad ${id}`,
    Domicilio: `Domicilio ${id}`,
    Latitud: lat,
    Longitud: lng,
  }], {
    expedienteId: PROJECT_ID,
    canonicalGeography,
    radiusMeters: canonicalGeography.type === "POLYGON" ? null : 10_000,
    acquiredAt: "2026-09-30T16:00:00.000Z",
    query: "DENUE H.2D publication fixture",
  }).institutionalPois;
  const adapted = adaptDenueObservationToGovernedMapLayer(pois[0], {
    productId: "contextual-denue-product",
  });
  if (adapted.status !== "ADAPTED") throw new Error(adapted.reasons.join(","));
  return adapted.layer;
}

function relation(
  layer: DenueGovernedMapLayer,
  geographyId: string,
  relationId = `relation:${layer.layerId}`
): DenueAnalyticalRelation {
  return {
    relationId,
    denueLayerId: layer.layerId,
    sourceEvidenceId: layer.layerId,
    expedienteId: PROJECT_ID,
    geographyId,
    relationTypes: ["SPATIAL_PROXIMITY"],
    linkedEvidenceIds: [],
    linkedFindingIds: [],
    linkedHypothesisRefs: [],
    linkedSourceRefs: [layer.layerId, `field:${relationId}`],
    spatialMetrics: {
      unit: "METERS",
      method: "SpatialLayerEngine.getDistance",
      distanceMeters: 24,
    },
    temporalCompatibility: "COMPATIBLE",
    sourceIndependence: {
      status: "UNKNOWN",
      assessedSourceRefs: [layer.layerId, `field:${relationId}`],
      independentSourceRefs: [],
      rationale: ["SIMPLE_RELATION_INDEPENDENCE_NOT_ASSERTED"],
    },
    lineage: layer.lineage,
    measuredFacts: [{
      factId: `fact:${relationId}`,
      metric: "distanceMeters",
      value: 24,
      unit: "METERS",
      sourceRefs: [layer.layerId, `field:${relationId}`],
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
    methodologyVersion: METHODOLOGY,
  };
}

function request(
  canonicalGeography: ReturnType<typeof geography>,
  layers: DenueGovernedMapLayer[],
  contextualUniverseCount = layers.length
): DenueAnalyticalPublicationProductRequest {
  return {
    geographyId: canonicalGeography.geographyId,
    methodologyVersion: METHODOLOGY,
    canonicalGeography,
    canonicalGeographyReference: {
      geographyId: canonicalGeography.geographyId,
      geographyType: canonicalGeography.type,
      geometryType: canonicalGeography.geometry.type,
      sourceReference: `project://${canonicalGeography.geographyId}`,
    },
    contextualUniverseCount,
    contextualDisplayedCount: layers.length,
    denueLayers: layers,
    createdAtReference: "snapshot://2026-09-30T17:00:00.000Z",
  };
}

async function repositoryWith(
  canonicalGeography: ReturnType<typeof geography>,
  entries: Array<{ layer: DenueGovernedMapLayer; status: DenueHumanValidationStatus; id?: string }>
) {
  const repository = new InMemoryDenueAnalyticalWorkflowRepository();
  const baseRelations = entries.map((entry, index) =>
    relation(entry.layer, canonicalGeography.geographyId, entry.id || `relation:${index}`)
  );
  await repository.saveRelations(PROJECT_ID, baseRelations);
  for (let index = 0; index < entries.length; index += 1) {
    const status = entries[index].status;
    if (status === "PENDING") continue;
    const event = buildDenueAnalyticalReviewEvent(baseRelations[index], {
      nextStatus: status,
      reviewedBy: "user:ppc-h2d",
      reviewedAt: REVIEWED_AT,
      rationale: `Decision PPC ${status} para ${baseRelations[index].relationId}.`,
    });
    await repository.appendReviewEvent(PROJECT_ID, event);
  }
  return repository;
}

function dependencies(repository: InMemoryDenueAnalyticalWorkflowRepository) {
  return { loadWorkflow: (projectId: string) => repository.load(projectId) };
}

describe("R3.2B.6H.2D DENUE analytical publication service", () => {
  test("workflow vacio y 263 DENUE contextuales producen EMPTY sin fallback", async () => {
    const canonical = geography("POLYGON");
    const layers = Array.from({ length: 263 }, (_, index) =>
      denueLayer(canonical, String(index), 21.87 + (index % 20) * 0.001, -102.31 + (index % 17) * 0.001)
    );
    const repository = new InMemoryDenueAnalyticalWorkflowRepository();
    const result = await buildDenueAnalyticalPublicationProduct(
      PROJECT_ID,
      request(canonical, layers, 263),
      dependencies(repository)
    );
    expect(result).toMatchObject({
      relationCount: 0,
      acceptedCount: 0,
      eligibleCount: 0,
      excludedCount: 0,
      productStatus: "EMPTY",
      product: null,
    });
  });

  test.each(["PENDING", "REJECTED", "REQUIRES_REVISION"] as const)(
    "%s queda excluida y produce EMPTY",
    async (status) => {
      const canonical = geography("INDIVIDUAL");
      const layerId = {
        PENDING: "1001",
        REJECTED: "1002",
        REQUIRES_REVISION: "1003",
      }[status];
      const layer = denueLayer(canonical, layerId);
      const repository = await repositoryWith(canonical, [{ layer, status }]);
      const result = await buildDenueAnalyticalPublicationProduct(
        PROJECT_ID,
        request(canonical, [layer]),
        dependencies(repository)
      );
      expect(result.productStatus).toBe("EMPTY");
      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(1);
      expect(result.exclusionReasons[0].reasons).toContain(`HUMAN_VALIDATION_NOT_ACCEPTED:${status}`);
    }
  );

  test("ACCEPTED valida pasa el gate y B.6E produce BUILT con trazabilidad", async () => {
    const canonical = geography("POLYGON");
    const layer = denueLayer(canonical, "accepted");
    const repository = await repositoryWith(canonical, [{ layer, status: "ACCEPTED" }]);
    const result = await buildDenueAnalyticalPublicationProduct(
      PROJECT_ID,
      request(canonical, [layer]),
      dependencies(repository)
    );
    expect(result).toMatchObject({
      relationCount: 1,
      acceptedCount: 1,
      eligibleCount: 1,
      excludedCount: 0,
      productStatus: "BUILT",
    });
    expect(result.product?.mapItems).toHaveLength(1);
    expect(result.product?.eligibleRelations[0].humanValidation).toMatchObject({
      status: "ACCEPTED",
      validatedBy: "user:ppc-h2d",
      validatedAt: REVIEWED_AT,
    });
    expect(result.product?.layers[0].lineage).toHaveLength(layer.lineage.length);
    expect(result.product?.layers[0].lineage).toEqual(expect.arrayContaining(layer.lineage));
    expect(result.product?.layers[0].traceabilityIds).toEqual(layer.traceabilityIds);
  });

  test("deriva methodologyVersion del workflow persistido durante generación", async () => {
    const canonical = geography("POLYGON");
    const layer = denueLayer(canonical, "methodology-derived");
    const repository = await repositoryWith(canonical, [{ layer, status: "ACCEPTED" }]);
    const { methodologyVersion: _methodologyVersion, ...generationRequest } = request(canonical, [layer]);
    const result = await buildDenueAnalyticalPublicationProduct(
      PROJECT_ID,
      generationRequest,
      dependencies(repository)
    );
    expect(result.productStatus).toBe("BUILT");
    expect(result.product?.methodologyVersion).toBe(METHODOLOGY);
  });

  test("ACCEPTED con fingerprint de ledger inconsistente queda excluida", async () => {
    const canonical = geography("POLYGON");
    const layer = denueLayer(canonical, "invalid-ledger");
    const repository = await repositoryWith(canonical, [{ layer, status: "ACCEPTED" }]);
    const snapshot = await repository.load(PROJECT_ID);
    const invalidSnapshot: DenueAnalyticalWorkflowSnapshot = {
      relations: snapshot.relations,
      reviewLedgers: [{ ...snapshot.reviewLedgers[0], relationFingerprint: "tampered" }],
    };
    const result = await buildDenueAnalyticalPublicationProduct(PROJECT_ID, request(canonical, [layer]), {
      loadWorkflow: async () => invalidSnapshot,
    });
    expect(result.productStatus).toBe("EMPTY");
    expect(result.acceptedCount).toBe(0);
    expect(result.eligibleCount).toBe(0);
    expect(result.exclusionReasons[0].reasons).toEqual(expect.arrayContaining([
      "LEDGER_INVALID",
      "LEDGER:LEDGER_FINGERPRINT_MISMATCH",
    ]));
  });

  test("mezcla estados y entrega exclusivamente dos ACCEPTED elegibles", async () => {
    const canonical = geography("CORRIDOR");
    const statuses = ["ACCEPTED", "PENDING", "REJECTED", "REQUIRES_REVISION", "ACCEPTED"] as const;
    const layers = statuses.map((_status, index) => denueLayer(canonical, String(2000 + index), 21.87 + index * 0.01, -102.31 + index * 0.01));
    const repository = await repositoryWith(canonical, statuses.map((status, index) => ({
      layer: layers[index],
      status,
      id: `relation:mixed:${index}`,
    })));
    const result = await buildDenueAnalyticalPublicationProduct(
      PROJECT_ID,
      request(canonical, layers),
      dependencies(repository)
    );
    expect(result).toMatchObject({
      relationCount: 5,
      acceptedCount: 2,
      eligibleCount: 2,
      excludedCount: 3,
      productStatus: "BUILT",
    });
    expect(result.product?.eligibleRelations.map((item) => item.relationId)).toEqual([
      "relation:mixed:0",
      "relation:mixed:4",
    ]);
  });

  test.each(["INDIVIDUAL", "CORRIDOR", "POLYGON"] as const)(
    "preserva geografia canonica %s",
    async (type) => {
      const canonical = geography(type);
      const layerId = { INDIVIDUAL: "3001", CORRIDOR: "3002", POLYGON: "3003" }[type];
      const layer = denueLayer(canonical, layerId);
      const repository = await repositoryWith(canonical, [{ layer, status: "ACCEPTED" }]);
      const result = await buildDenueAnalyticalPublicationProduct(
        PROJECT_ID,
        request(canonical, [layer]),
        dependencies(repository)
      );
      expect(result.productStatus).toBe("BUILT");
      expect(result.product?.canonicalGeography).toEqual(canonical);
      expect(result.product?.canonicalGeography.type).toBe(type);
      expect(result.product?.canonicalGeography.geometry.type).toBe(canonical.geometry.type);
    }
  );

  test("delega a B.6E la deduplicacion de relaciones identicas", async () => {
    const canonical = geography("POLYGON");
    const layer = denueLayer(canonical, "duplicate");
    const repository = await repositoryWith(canonical, [{ layer, status: "ACCEPTED", id: "relation:duplicate" }]);
    const snapshot = await repository.load(PROJECT_ID);
    const result = await buildDenueAnalyticalPublicationProduct(PROJECT_ID, request(canonical, [layer]), {
      loadWorkflow: async () => ({
        relations: [snapshot.relations[0], snapshot.relations[0]],
        reviewLedgers: snapshot.reviewLedgers,
      }),
    });
    expect(result.productStatus).toBe("BUILT");
    expect(result.product?.eligibleRelations).toHaveLength(1);
    expect(result.product?.mapItems).toHaveLength(1);
  });

  test("es read-only, no muta inputs y es determinista", async () => {
    const canonical = geography("POLYGON");
    const layer = denueLayer(canonical, "immutable");
    const repository = await repositoryWith(canonical, [{ layer, status: "ACCEPTED" }]);
    const workflowBefore = await repository.load(PROJECT_ID);
    const publicationRequest = request(canonical, [layer]);
    const requestBefore = JSON.stringify(publicationRequest);
    const first = await buildDenueAnalyticalPublicationProduct(
      PROJECT_ID,
      publicationRequest,
      dependencies(repository)
    );
    const second = await buildDenueAnalyticalPublicationProduct(
      PROJECT_ID,
      publicationRequest,
      dependencies(repository)
    );
    expect(second).toEqual(first);
    expect(JSON.stringify(publicationRequest)).toBe(requestBefore);
    expect(await repository.load(PROJECT_ID)).toEqual(workflowBefore);
    expect(JSON.stringify(first)).not.toMatch(/riskScore|vulnerabilityScore|dangerLevel|criminogenicity|priorityRank/);
  });
});
