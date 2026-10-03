jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "SERVER_TIME" } }));
jest.mock("@/lib/firebaseAdmin", () => ({ getInstitutionalAdminDb: () => { throw new Error("LIVE_FORBIDDEN"); } }));
jest.mock("@/lib/firebase", () => ({ getDb: () => { throw new Error("LIVE_FORBIDDEN"); } }));
jest.mock("@/lib/firebaseServer", () => ({ getFirebaseServerDb: () => { throw new Error("LIVE_FORBIDDEN"); } }));
import { executeInstitutionalGeointEntity } from "../src/services/institutionalGeointEntityBoundary";
import { adminFixture } from "./helpers/p8InstitutionalAdminFixture";
import { createEvidenceReviewSubmission, evidenceReviewLocatorId, ppcReviewDisplayStatus, reconcileStreetViewReviewItems, reviewVersion } from "../src/utils/institutionalEvidenceReview";
import { evaluateHumanValidation } from "../src/utils/humanValidationPolicy";
import { PhotoEvidenceGovernanceEngine } from "../src/utils/photoEvidenceGovernanceEngine";

const photo = { id: "photo1", lat: 21, lng: -102, tipo: "PHOTO_FIELD", createdAt: 100,
  previewUrl: "https://fixture.test/photo", provenance: { provider: "FIELD" },
  storagePath: "projects/A/photo1.jpg", comentario: "Original", lineage: [{ id: "photo1", type: "EVIDENCE" }] };
const tactical = { ...photo, id: "sv1", tipo: "STREET_VIEW", captureId: "capture1",
  sourceEvidenceId: "ev1", streetViewMetadata: { heading: 20, pitch: 0, fov: 90, captureDate: "2024-01" } };
function fixture() {
  const f = adminFixture({ "projects/A": { deleted: false, hipotesis: "DO_NOT_CHANGE", osint: { preserved: true },
    approvedFindingRefs: [{ findingId: "historical" }], tacticalStreetViews: [tactical] }, "projects/A/photos/photo1": photo });
  const authorize = jest.fn(async () => ({ allowed: true, projectId: "A",
    actor: { institutionalUserId: "1", username: "PPC", role: "USER" } } as any));
  return { ...f, authorize, deps: { authorize, database: () => f.db } };
}
function input(source: "PHOTO" | "TACTICAL_STREET_VIEW" | "STREETVIEW_FINDING", id: string, prior: any, action = "APPROVE") {
  return { projectId: "A", kind: source === "PHOTO" ? "PHOTO" as const : "STREETVIEW" as const,
    operation: "REVIEW" as const, id, data: { projectId: "A", source, id, action,
      comment: "Decisión humana motivada", expectedReview: reviewVersion(prior), validatedBy: "FORGED", validatedAt: "FORGED" } };
}
test("legacy photo remains unreviewed and editorial ranking cannot approve it", () => {
  expect(evaluateHumanValidation(photo).status).toBe("UNREVIEWED");
  const ranked = PhotoEvidenceGovernanceEngine.process([photo]);
  expect(ranked.primaryPhotos).toHaveLength(1);
  expect(evaluateHumanValidation(ranked.primaryPhotos[0]).isInstitutionalApproval).toBe(false);
  expect(ppcReviewDisplayStatus({ estado: "APPROVED_EVIDENCE" })).toBe("PENDING_REVIEW");
  expect(ppcReviewDisplayStatus({ humanValidationStatus: "APPROVED" })).toBe("APPROVED");
});
test.each([["APPROVE", "APPROVED"], ["REJECT", "REJECTED"], ["RETURN_FOR_REANALYSIS", "RETURNED_FOR_REANALYSIS"]])(
  "photo %s persists the canonical decision with server identity/time and preserves evidence", async (action, expected) => {
    const f = fixture(); const before = f.get("projects/A");
    const record = await executeInstitutionalGeointEntity("session", input("PHOTO", "photo1", photo, action), f.deps);
    expect(record.humanValidationStatus).toBe(expected);
    expect(record.validatedBy).toMatchObject({ id: "1", name: "PPC" });
    expect(Number.isFinite(Date.parse(record.validatedAt))).toBe(true);
    expect(record.validationSource).toBe("ADR_020_24_HUMAN_ACTION");
    expect(record).toMatchObject(photo);
    expect(f.get("projects/A")).toMatchObject(before);
    expect(f.get("projects/A").tacticalStreetViews).toEqual(before.tacticalStreetViews);
    expect(f.get("projects/A").institutionalSourceRevision).toBe(1);
    expect(f.entries().filter(([path]) => path.startsWith("audit_logs/"))).toHaveLength(1);
    expect(f.entries().filter(([path]) => path.startsWith("geoint_event_outbox/"))).toHaveLength(1);
    expect(f.authorize).toHaveBeenCalledWith({ sessionToken: "session", projectId: "A", action: "WRITE" });
  });
test.each(["APPROVE", "REJECT", "RETURN_FOR_REANALYSIS"])("historical tactical Street View %s needs no recapture or finding creation", async action => {
  const f = fixture();
  const record = await executeInstitutionalGeointEntity("session", input("TACTICAL_STREET_VIEW", "sv1", tactical, action), f.deps);
  expect(record).toMatchObject(tactical);
  expect(record.estado).toBe(action === "APPROVE" ? "APPROVED_EVIDENCE" : action === "REJECT" ? "REJECTED_FINDING" : "RETURNED_FOR_REANALYSIS");
  expect(record.humanValidationStatus).toBe(action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : "RETURNED_FOR_REANALYSIS");
  expect(f.get("projects/A").tacticalStreetViews[0].humanValidationStatus).toBe(record.humanValidationStatus);
  expect(f.entries().some(([path]) => path.includes("streetview_findings/"))).toBe(false);
});
test.each(["audit_logs/", "geoint_event_outbox/", "geoint_event_fingerprints/", "projects/A/photos/", "projects/A"])(
  "failure at %s rolls back decision, parent, audit and outbox", async path => {
    const f = fixture(); const before = f.entries(); f.failWrite(path);
    await expect(executeInstitutionalGeointEntity("session", input("PHOTO", "photo1", photo), f.deps)).rejects.toThrow();
    expect(f.entries()).toEqual(before);
  });
test("READ-only denies review before any database access; no role bypass", async () => {
  const f = fixture(); f.authorize.mockResolvedValue({ allowed: false, actor: { role: "SUPER_ADMIN" } } as any);
  const database = jest.fn();
  await expect(executeInstitutionalGeointEntity("session", input("PHOTO", "photo1", photo), { authorize: f.authorize, database })).rejects.toThrow("ACCESS_DENIED");
  expect(database).not.toHaveBeenCalled();
});
test("stale/concurrent second decision fails closed and cannot append a second audit", async () => {
  const f = fixture(); const request = input("PHOTO", "photo1", photo);
  await executeInstitutionalGeointEntity("session", request, f.deps); const before = f.entries();
  await expect(executeInstitutionalGeointEntity("session", request, f.deps)).rejects.toThrow("STALE");
  expect(f.entries()).toEqual(before);
});
test("existing finding gets one coherent final revision and preserves provenance, refs and mirrors", async () => {
  const f = fixture(); const finding = { id: "finding1", expedienteId: "A", traceabilityId: "trace1",
    sourceEvidenceId: "ev1", captureId: "capture1", geographyId: "geo1", lineageStatus: "SUPPORTED",
    coordenadas: { lat: 21, lng: -102 }, imagen: photo.previewUrl, estado: "PENDING_REVIEW",
    humanValidationStatus: "UNREVIEWED", provenance: { provider: "GOOGLE" }, supportingEvidenceIds: ["ev1"] };
  f.seed("projects/A/streetview_findings/finding1", finding);
  const record = await executeInstitutionalGeointEntity("session", input("STREETVIEW_FINDING", "finding1", finding), f.deps);
  expect(record.humanValidationStatus).toBe("APPROVED"); expect(record.estado).toBe("APPROVED_EVIDENCE");
  expect(record).toMatchObject({ provenance: finding.provenance, supportingEvidenceIds: ["ev1"], captureId: "capture1" });
  expect(f.get("streetview_findings/finding1")).toEqual(f.get("projects/A/streetview_findings/finding1"));
  expect(f.get("projects/A").tacticalStreetViews[0].humanValidationStatus).toBe("APPROVED");
});
test("missing/cross-project/deleted resources cannot be reviewed", async () => {
  const f = fixture(); f.seed("projects/A/photos/photo1", { ...photo, projectId: "B" });
  await expect(executeInstitutionalGeointEntity("session", input("PHOTO", "photo1", photo), f.deps)).rejects.toThrow("CROSS_PROJECT");
  f.seed("projects/A/photos/photo1", { ...photo, deleted: true });
  await expect(executeInstitutionalGeointEntity("session", input("PHOTO", "photo1", photo), f.deps)).rejects.toThrow("NOT_FOUND");
});
test("hydration joins historical representations deterministically without auto-approval", () => {
  const album = { ...tactical, id: "photo-sv", evidenceId: "ev1" };
  const items = reconcileStreetViewReviewItems([album], [tactical], [{ ...tactical, id: "finding1" }]);
  expect(items).toHaveLength(1);
  expect(items[0].reviewTarget.source).toBe("STREETVIEW_FINDING");
  expect(evaluateHumanValidation(items[0]).isInstitutionalApproval).toBe(false);
  expect(reconcileStreetViewReviewItems([], [tactical], [])).toHaveLength(1);
});
test("historical capture identified only by reference can be reviewed without inventing evidence identity", async () => {
  const f = fixture(); const legacy: any = { ...tactical }; delete legacy.id; delete legacy.captureId; delete legacy.evidenceId;
  f.seed("projects/A", { deleted: false, tacticalStreetViews: [legacy] });
  const id = evidenceReviewLocatorId(legacy)!;
  expect(reconcileStreetViewReviewItems([], [legacy], [])[0].reviewTarget.id).toBe(id);
  await executeInstitutionalGeointEntity("session", input("TACTICAL_STREET_VIEW", id, legacy), f.deps);
  const persisted = f.get("projects/A").tacticalStreetViews[0];
  expect(persisted.humanValidationStatus).toBe("APPROVED"); expect(persisted.id).toBeUndefined(); expect(persisted.evidenceId).toBeUndefined();
});
test("ambiguous legacy locator cannot review multiple distinct records accidentally", async () => {
  const f = fixture(); f.seed("projects/A", { deleted: false, tacticalStreetViews: [tactical, { ...tactical, comentario: "Other" }] });
  const before = f.entries();
  await expect(executeInstitutionalGeointEntity("session", input("TACTICAL_STREET_VIEW", "sv1", tactical), f.deps)).rejects.toThrow("AMBIGUOUS");
  expect(f.entries()).toEqual(before);
});
test("finding mirror failure cannot leave a partially approved finding or tactical capture", async () => {
  const f = fixture(); const finding = { ...tactical, id: "finding1", expedienteId: "A", traceabilityId: "trace1", geographyId: "geo1",
    lineageStatus: "SUPPORTED", coordenadas: { lat: 21, lng: -102 }, estado: "PENDING_REVIEW" };
  f.seed("projects/A/streetview_findings/finding1", finding); f.failWrite("streetview_findings/finding1"); const before = f.entries();
  await expect(executeInstitutionalGeointEntity("session", input("STREETVIEW_FINDING", "finding1", finding), f.deps)).rejects.toThrow();
  expect(f.entries()).toEqual(before);
});
test("submission blocks double-click, invokes callback only with final server record, and never retries errors", async () => {
  let finish!: (record: any) => void;
  const save = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  const flow = createEvidenceReviewSubmission(save); const callback = jest.fn(); const request = input("PHOTO", "photo1", photo).data as any;
  const pending = flow.submit(request, callback);
  expect(await flow.submit(request, callback)).toBe(false); expect(save).toHaveBeenCalledTimes(1);
  expect(callback).not.toHaveBeenCalled();
  const final = { ...photo, humanValidationStatus: "APPROVED" }; finish(final); await pending;
  expect(callback).toHaveBeenCalledWith(final); expect(flow.isPending()).toBe(false);
  const reject = jest.fn().mockRejectedValue(new Error("SERVER_DENIED")); const failed = createEvidenceReviewSubmission(reject);
  const failureCallback = jest.fn(); await expect(failed.submit(request, failureCallback)).rejects.toThrow("SERVER_DENIED");
  expect(failureCallback).not.toHaveBeenCalled(); expect(reject).toHaveBeenCalledTimes(1); expect(failed.isPending()).toBe(false);
});
