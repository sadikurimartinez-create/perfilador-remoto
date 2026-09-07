type StoreDoc = Record<string, any>;

const store = new Map<string, StoreDoc>();
const updateDocMock = jest.fn(async (ref: { path: string }, value: StoreDoc) => {
  store.set(ref.path, { ...(store.get(ref.path) || {}), ...value });
});

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_firestore: unknown, ...segments: string[]) => ({ path: segments.join("/") })),
  getDoc: jest.fn(async (ref: { path: string }) => ({
    exists: () => store.has(ref.path),
    data: () => store.get(ref.path),
  })),
  updateDoc: (...args: any[]) => updateDocMock(...args),
}));

jest.mock("../src/lib/firebase", () => ({
  getDb: jest.fn(() => ({ kind: "mock-firestore" })),
}));

import {
  adaptLegacyProjectGeography,
  buildCanonicalProjectGeography,
  getCanonicalGeographyCoordinates,
} from "../src/utils/canonicalProjectGeography";
import {
  buildHistoricalGeographyCandidatesFromEvidence,
  canonicalizeConfirmedHistoricalGeographyReconciliation,
  confirmHistoricalGeographyReconciliation,
  createHistoricalGeographyReconciliation,
  deduplicateHistoricalGeographyCandidates,
  selectHistoricalGeographyCandidates,
} from "../src/utils/historicalGeographyReconciliation";
import {
  buildHistoricalGeographyReconciliationAuditDetails,
  buildHistoricalGeographyReconciliationPersistencePatch,
  persistHistoricalGeographyReconciliation,
} from "../src/services/historicalGeographyReconciliationService";

const projectId = "XLeeM0Xz5bemDlwgn8eP";

const historicalPhotoEvidence = [
  {
    projectId,
    lat: 21.8053055556,
    lng: -102.2704138889,
    sourceType: "IN_SITU_PHOTO_GPS" as const,
    sourceObjectPath: "projects/XLeeM0Xz5bemDlwgn8eP/photo-1.jpg",
    sourcePhotoId: "photo-1",
    sourceEvidenceId: "evi-1",
    capturedAt: "2026-05-27T10:00:00.000Z",
    confidence: "HIGH" as const,
  },
  {
    projectId,
    lat: 21.8055277778,
    lng: -102.2707416667,
    sourceType: "IN_SITU_PHOTO_GPS" as const,
    sourceObjectPath: "projects/XLeeM0Xz5bemDlwgn8eP/photo-2.jpg",
    sourcePhotoId: "photo-2",
    sourceEvidenceId: "evi-2",
    capturedAt: "2026-05-27T10:03:00.000Z",
    confidence: "HIGH" as const,
  },
  {
    projectId,
    lat: 21.8055277778,
    lng: -102.2707416667,
    sourceType: "IN_SITU_PHOTO_GPS" as const,
    sourceObjectPath: "projects/XLeeM0Xz5bemDlwgn8eP/photo-3.jpg",
    sourcePhotoId: "photo-3",
    sourceEvidenceId: "evi-3",
    capturedAt: "2026-05-27T10:01:00.000Z",
    confidence: "HIGH" as const,
  },
];

const confirmation = {
  confirmedBy: { username: "perfilador.qa" },
  confirmedAt: "2026-09-07T12:00:00.000Z",
};

describe("QA-06.03 historical geography reconciliation", () => {
  beforeEach(() => {
    store.clear();
    updateDocMock.mockClear();
  });

  test("GPS photo evidence becomes candidates, never VERTEX entities", () => {
    const candidates = buildHistoricalGeographyCandidatesFromEvidence(historicalPhotoEvidence);

    expect(candidates).toHaveLength(3);
    expect(candidates[0].sourceType).toBe("IN_SITU_PHOTO_GPS");
    expect(candidates[0].status).toBe("DISCOVERED");
    expect((candidates[0] as any).type).toBeUndefined();
    expect((candidates[0] as any).metadata?.isVertex).toBeUndefined();
  });

  test("STREET_VIEW, POI, EXTERNAL and UNKNOWN candidates are review-only until explicit human choice", () => {
    const candidates = buildHistoricalGeographyCandidatesFromEvidence([
      { projectId, lat: 21.805, lng: -102.27, sourceType: "STREET_VIEW" },
      { projectId, lat: 21.806, lng: -102.271, sourceType: "POI" },
      { projectId, lat: 21.807, lng: -102.272, sourceType: "EXTERNAL" },
      { projectId, lat: 21.808, lng: -102.273, sourceType: "UNKNOWN" },
    ]);
    const reconciliation = createHistoricalGeographyReconciliation({
      reconciliationId: "rec-non-aptas",
      projectId,
      candidates,
    });

    expect(reconciliation.selectedCandidateIds).toEqual([]);
    expect(reconciliation.confirmedCandidateIds).toEqual([]);
    expect(reconciliation.candidates.every((candidate) => candidate.status === "DISCOVERED")).toBe(true);
    expect(() => canonicalizeConfirmedHistoricalGeographyReconciliation({ reconciliation })).toThrow(
      "HISTORICAL_GEOGRAPHY_NOT_CONFIRMED"
    );
  });

  test("candidate discovery and selection do not auto-sort or auto-select by timestamp", () => {
    const candidates = buildHistoricalGeographyCandidatesFromEvidence(historicalPhotoEvidence);
    const reconciliation = createHistoricalGeographyReconciliation({
      reconciliationId: "rec-1",
      projectId,
      candidates,
    });

    expect(reconciliation.status).toBe("CANDIDATES_READY");
    expect(reconciliation.selectedCandidateIds).toEqual([]);

    const selected = selectHistoricalGeographyCandidates(reconciliation, [
      candidates[1].candidateId,
      candidates[0].candidateId,
    ]);
    const confirmed = confirmHistoricalGeographyReconciliation({
      reconciliation: selected,
      confirmedCandidateIds: [candidates[1].candidateId, candidates[0].candidateId],
      confirmation,
    });
    const geography = canonicalizeConfirmedHistoricalGeographyReconciliation({ reconciliation: confirmed, now: 100 });

    expect(confirmed.confirmedCandidateIds).toEqual([candidates[1].candidateId, candidates[0].candidateId]);
    expect(getCanonicalGeographyCoordinates(geography)).toEqual([
      { lat: candidates[1].lat, lng: candidates[1].lng },
      { lat: candidates[0].lat, lng: candidates[0].lng },
    ]);
  });

  test("canonicalization requires human confirmation", () => {
    const candidates = buildHistoricalGeographyCandidatesFromEvidence(historicalPhotoEvidence);
    const reconciliation = createHistoricalGeographyReconciliation({
      reconciliationId: "rec-2",
      projectId,
      candidates,
    });

    expect(() => canonicalizeConfirmedHistoricalGeographyReconciliation({ reconciliation })).toThrow(
      "HISTORICAL_GEOGRAPHY_NOT_CONFIRMED"
    );
    expect(() => confirmHistoricalGeographyReconciliation({
      reconciliation,
      confirmedCandidateIds: [candidates[0].candidateId, candidates[1].candidateId],
      confirmation: { confirmedBy: {}, confirmedAt: "2026-09-07T12:00:00.000Z" },
    })).toThrow("HISTORICAL_GEOGRAPHY_HUMAN_CONFIRMATION_REQUIRED");
  });

  test("corridor rejects fewer than two distinct valid coordinates", () => {
    const candidates = buildHistoricalGeographyCandidatesFromEvidence(historicalPhotoEvidence);
    const reconciliation = createHistoricalGeographyReconciliation({
      reconciliationId: "rec-3",
      projectId,
      candidates,
    });

    expect(() => confirmHistoricalGeographyReconciliation({
      reconciliation,
      confirmedCandidateIds: [candidates[0].candidateId],
      confirmation,
    })).toThrow("HISTORICAL_GEOGRAPHY_INSUFFICIENT_POINTS");

    expect(() => confirmHistoricalGeographyReconciliation({
      reconciliation,
      confirmedCandidateIds: [candidates[1].candidateId, candidates[2].candidateId],
      confirmation,
    })).toThrow("HISTORICAL_GEOGRAPHY_INSUFFICIENT_POINTS");
  });

  test("duplicate confirmed ids and unknown candidate ids are blocked deterministically", () => {
    const candidates = buildHistoricalGeographyCandidatesFromEvidence(historicalPhotoEvidence);
    const reconciliation = createHistoricalGeographyReconciliation({
      reconciliationId: "rec-ids",
      projectId,
      candidates,
    });

    expect(() => confirmHistoricalGeographyReconciliation({
      reconciliation,
      confirmedCandidateIds: [candidates[0].candidateId, candidates[0].candidateId],
      confirmation,
    })).toThrow("HISTORICAL_GEOGRAPHY_DUPLICATE_CONFIRMED_IDS");

    expect(() => confirmHistoricalGeographyReconciliation({
      reconciliation,
      confirmedCandidateIds: [candidates[0].candidateId, "missing-candidate"],
      confirmation,
    })).toThrow("HISTORICAL_GEOGRAPHY_UNKNOWN_CANDIDATE_ID");
  });

  test("duplicate GPS candidates preserve provenance without auto-selecting duplicate rector points", () => {
    const candidates = buildHistoricalGeographyCandidatesFromEvidence(historicalPhotoEvidence);
    const deduped = deduplicateHistoricalGeographyCandidates(candidates);

    expect(deduped).toHaveLength(2);
    expect(deduped.every((candidate) => candidate.status === "DISCOVERED")).toBe(true);
    expect(deduped[1].sourceRefs.map((ref) => ref.sourcePhotoId)).toEqual(["photo-2", "photo-3"]);
  });

  test("confirmed source photo lineage is preserved in persistence patch and audit details", () => {
    const candidates = deduplicateHistoricalGeographyCandidates(buildHistoricalGeographyCandidatesFromEvidence(historicalPhotoEvidence));
    const reconciliation = createHistoricalGeographyReconciliation({
      reconciliationId: "rec-4",
      projectId,
      candidates,
      limitations: ["Historical Storage evidence; no original project root document."],
    });
    const confirmed = confirmHistoricalGeographyReconciliation({
      reconciliation,
      confirmedCandidateIds: [candidates[0].candidateId, candidates[1].candidateId],
      confirmation,
    });
    const patch = buildHistoricalGeographyReconciliationPersistencePatch({ reconciliation: confirmed, now: 200 });
    const auditDetails = buildHistoricalGeographyReconciliationAuditDetails({ reconciliation: confirmed });

    expect(patch.canonicalGeography.source).toBe("HISTORICAL_RECONCILIATION");
    expect(patch.canonicalGeography.type).toBe("CORRIDOR");
    expect(patch.canonicalGeography.geometry.type).toBe("LineString");
    expect(patch.geographyValidationStatus).toBe("VALID");
    expect(patch.historicalGeographyReconciliation.status).toBe("CONFIRMED");
    expect(patch.historicalGeographyReconciliation.confirmedPoints[0].sourcePhotoId).toBe("photo-1");
    expect(patch).not.toHaveProperty("latitude");
    expect(patch).not.toHaveProperty("longitude");
    expect(patch).not.toHaveProperty("geographicEntities");
    expect(JSON.stringify(patch)).not.toContain("\"VERTEX\"");
    expect(auditDetails.forensicDeclaration).toContain("not VERTEX");
    expect(auditDetails.confirmedPoints[1].sourceObjectPath).toBe("projects/XLeeM0Xz5bemDlwgn8eP/photo-2.jpg");
    expect(auditDetails.confirmedPoints[1].sourceRefs.map((ref) => ref.sourcePhotoId)).toEqual(["photo-2", "photo-3"]);
  });

  test("adaptLegacyProjectGeography remains isolated from photo candidates", () => {
    const geography = adaptLegacyProjectGeography(
      { id: projectId, geometryType: "lineal" },
      {
        geographicEntities: [
          {
            id: "photo-like-entity",
            lat: 21.8053055556,
            lng: -102.2704138889,
            type: "PHOTO",
            metadata: { isIndependentPoi: false },
          },
        ],
      }
    );

    expect(geography).toBeNull();
  });

  test("modern project creation canonical source remains unchanged", () => {
    const geography = buildCanonicalProjectGeography({
      projectId,
      type: "lineal",
      points: [
        { lat: 21.8053055556, lng: -102.2704138889 },
        { lat: 21.8055277778, lng: -102.2707416667 },
      ],
      now: 300,
    });

    expect(geography.source).toBe("PROJECT_CREATION");
    expect(geography.validationStatus).toBe("VALID");
  });

  test("project not found blocks persistence before updateDoc", async () => {
    const candidates = buildHistoricalGeographyCandidatesFromEvidence(historicalPhotoEvidence);
    const confirmed = confirmHistoricalGeographyReconciliation({
      reconciliation: createHistoricalGeographyReconciliation({ reconciliationId: "rec-missing", projectId, candidates }),
      confirmedCandidateIds: [candidates[0].candidateId, candidates[1].candidateId],
      confirmation,
    });

    await expect(persistHistoricalGeographyReconciliation({ projectId, reconciliation: confirmed, now: 400 }))
      .rejects.toThrow("HISTORICAL_GEOGRAPHY_PROJECT_NOT_FOUND");
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  test("existing valid canonical geography blocks overwrite before updateDoc", async () => {
    const candidates = buildHistoricalGeographyCandidatesFromEvidence(historicalPhotoEvidence);
    const confirmed = confirmHistoricalGeographyReconciliation({
      reconciliation: createHistoricalGeographyReconciliation({ reconciliationId: "rec-existing", projectId, candidates }),
      confirmedCandidateIds: [candidates[0].candidateId, candidates[1].candidateId],
      confirmation,
    });
    store.set(`projects/${projectId}`, {
      canonicalGeography: buildCanonicalProjectGeography({
        projectId,
        type: "lineal",
        points: [
          { lat: 21.1, lng: -102.1 },
          { lat: 21.2, lng: -102.2 },
        ],
      }),
    });

    await expect(persistHistoricalGeographyReconciliation({ projectId, reconciliation: confirmed, now: 500 }))
      .rejects.toThrow("HISTORICAL_GEOGRAPHY_EXISTING_CANONICAL_VALID");
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  test("valid confirmed reconciliation persists only allowed fields and returns PERSISTED after write", async () => {
    const candidates = deduplicateHistoricalGeographyCandidates(buildHistoricalGeographyCandidatesFromEvidence(historicalPhotoEvidence));
    const confirmed = confirmHistoricalGeographyReconciliation({
      reconciliation: createHistoricalGeographyReconciliation({ reconciliationId: "rec-persist", projectId, candidates }),
      confirmedCandidateIds: [candidates[0].candidateId, candidates[1].candidateId],
      confirmation,
    });
    store.set(`projects/${projectId}`, { name: "Hacienda San Marcos Lineal", canonicalGeography: null });

    const result = await persistHistoricalGeographyReconciliation({ projectId, reconciliation: confirmed, now: 600 });
    const persistedPatch = updateDocMock.mock.calls[0][1];

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    expect(Object.keys(persistedPatch).sort()).toEqual([
      "canonicalGeography",
      "geographyId",
      "geographyValidationStatus",
      "historicalGeographyReconciliation",
    ]);
    expect(persistedPatch).not.toHaveProperty("latitude");
    expect(persistedPatch).not.toHaveProperty("longitude");
    expect(persistedPatch).not.toHaveProperty("geographicEntities");
    expect(JSON.stringify(persistedPatch)).not.toContain("\"VERTEX\"");
    expect(persistedPatch.historicalGeographyReconciliation.status).toBe("CONFIRMED");
    expect(result.historicalGeographyReconciliation.status).toBe("PERSISTED");
    expect(result.sourceRefs.map((ref) => ref.sourcePhotoId)).toEqual(["photo-1", "photo-2", "photo-3"]);
  });

  test("write failure does not return PERSISTED", async () => {
    const candidates = buildHistoricalGeographyCandidatesFromEvidence(historicalPhotoEvidence);
    const confirmed = confirmHistoricalGeographyReconciliation({
      reconciliation: createHistoricalGeographyReconciliation({ reconciliationId: "rec-write-fail", projectId, candidates }),
      confirmedCandidateIds: [candidates[0].candidateId, candidates[1].candidateId],
      confirmation,
    });
    store.set(`projects/${projectId}`, { canonicalGeography: null });
    updateDocMock.mockRejectedValueOnce(new Error("WRITE_FAILED"));

    await expect(persistHistoricalGeographyReconciliation({ projectId, reconciliation: confirmed, now: 700 }))
      .rejects.toThrow("WRITE_FAILED");
  });
});
