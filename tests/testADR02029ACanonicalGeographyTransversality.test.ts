import fs from "node:fs";
import path from "node:path";
import {
  adaptLegacyProjectGeography,
  attachGeographyToEvidence,
  attachGeographyToFinding,
  buildCanonicalProjectGeography,
  buildCrimeIncidenceGeographyContext,
  buildDenueQueryContext,
  buildStableGeographyId,
  buildSweepGeographyContext,
  getCanonicalGeographyCoordinates,
  getCanonicalMapViewport,
  rehydrateCanonicalProjectGeography,
} from "../src/utils/canonicalProjectGeography";
import { buildEvidenceLineage, buildStreetViewFindingLineage, validateLineage } from "../src/utils/evidenceLineage";
import {
  createStoredRawMultimodalEvidence,
  markHumanApproved,
  markReadyForHumanReview,
} from "../src/utils/multimodalEvidenceContract";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const points = [
  { lat: 21.881, lng: -102.291 },
  { lat: 21.882, lng: -102.292 },
  { lat: 21.883, lng: -102.293 },
];

describe("ADR-020.29A - Canonical geography transversality", () => {
  test("TEST 001 - stable geographyId is independent from photo, file, sweep, checksum and traceability identifiers", () => {
    expect(buildStableGeographyId("EXP-001", "POLYGON")).toBe("geo-EXP-001-polygon");
    expect(buildStableGeographyId("EXP-001", "POLYGON")).not.toContain("photo");
    expect(buildStableGeographyId("EXP-001", "POLYGON")).not.toContain("checksum");
  });

  test("TEST 002 - individual geography requires exactly one point", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-001", type: "individual", points: [points[0]], now: 10 });
    expect(geography.type).toBe("INDIVIDUAL");
    expect(geography.geometry.type).toBe("Point");
    expect(geography.validationStatus).toBe("VALID");
  });

  test("TEST 003 - corridor geography preserves ordered nodes as LineString", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-002", type: "lineal", points: points.slice(0, 2), now: 20 });
    expect(geography.type).toBe("CORRIDOR");
    expect(geography.geometry.type).toBe("LineString");
    expect(getCanonicalGeographyCoordinates(geography)).toEqual(points.slice(0, 2));
  });

  test("TEST 004 - polygon geography stores a logically closed GeoJSON ring without inventing a new vertex", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-003", type: "poligono", points, now: 30 });
    expect(geography.type).toBe("POLYGON");
    expect(geography.geometry.type).toBe("Polygon");
    const ring = geography.geometry.type === "Polygon" ? geography.geometry.coordinates[0] : [];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(getCanonicalGeographyCoordinates(geography)).toEqual(points);
  });

  test("TEST 005 - only photos do not fabricate canonical geography", () => {
    const geography = adaptLegacyProjectGeography({ id: "EXP-004", geometryType: "poligono" }, { geographicEntities: [], now: 40 });
    expect(geography).toBeNull();
  });

  test("TEST 006 - legacy project coordinates adapt only to individual point geography", () => {
    const geography = adaptLegacyProjectGeography({ id: "EXP-005", geometryType: "individual", latitude: 21.88, longitude: -102.29 }, { now: 50 });
    expect(geography?.source).toBe("LEGACY_PROJECT_FIELDS");
    expect(geography?.type).toBe("INDIVIDUAL");
  });

  test("TEST 007 - legacy geographic vertices adapt to corridor without using photo pins", () => {
    const geography = adaptLegacyProjectGeography(
      { id: "EXP-006", geometryType: "lineal" },
      { geographicEntities: points.slice(0, 2).map((point, index) => ({ ...point, type: "VERTEX", createdAt: index })), now: 60 }
    );
    expect(geography?.source).toBe("LEGACY_GEOGRAPHIC_ENTITIES");
    expect(geography?.validationStatus).toBe("VALID");
  });

  test("TEST 008 - existing canonical geography rehydrates without timestamp mutation", () => {
    const original = buildCanonicalProjectGeography({ projectId: "EXP-007", type: "POLYGON", points, now: 70 });
    const rehydrated = rehydrateCanonicalProjectGeography(original);
    expect(rehydrated?.createdAt).toBe(70);
    expect(rehydrated?.updatedAt).toBe(70);
  });

  test("TEST 009 - incomplete corridor is partial, not silently valid", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-008", type: "CORRIDOR", points: [points[0]], now: 80 });
    expect(geography.validationStatus).toBe("PARTIAL");
  });

  test("TEST 010 - incomplete polygon is partial, not autocorrected to valid", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-009", type: "POLYGON", points: points.slice(0, 2), now: 90 });
    expect(geography.validationStatus).toBe("PARTIAL");
  });

  test("TEST 011 - derived centroid and bounds are marked derived", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-010", type: "POLYGON", points, now: 100 });
    expect(geography.derived?.centroid?.derivation).toBe("DERIVED_FROM_POLYGON");
    expect(geography.derived?.bounds?.derivation).toBe("DERIVED_FROM_GEOMETRY");
  });

  test("TEST 012 - map viewport is based on canonical geometry bounds", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-011", type: "POLYGON", points, now: 110 });
    const viewport = getCanonicalMapViewport(geography);
    expect(viewport.fitMode).toBe("BOUNDS");
    expect(viewport.bounds?.north).toBe(points[2].lat);
  });

  test("TEST 013 - point sweep context uses explicit point radius", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-012", type: "INDIVIDUAL", points: [points[0]], now: 120 });
    const context = buildSweepGeographyContext(geography, 250);
    expect(context.queryMode).toBe("POINT_RADIUS");
    expect(context.radiusMeters).toBe(250);
  });

  test("TEST 014 - corridor sweep context preserves LineString, not centroid collapse", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-013", type: "CORRIDOR", points: points.slice(0, 2), now: 130 });
    const context = buildSweepGeographyContext(geography, 250);
    expect(context.queryMode).toBe("CORRIDOR_COVERAGE");
    expect(context.geometry.type).toBe("LineString");
    expect(context.centroid?.derived).toBe(true);
  });

  test("TEST 015 - polygon sweep context preserves boundary semantics", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-014", type: "POLYGON", points, now: 140 });
    const context = buildSweepGeographyContext(geography);
    expect(context.queryMode).toBe("POLYGON_BOUNDARY");
    expect(context.geometry.type).toBe("Polygon");
  });

  test("TEST 016 - DENUE context documents corridor and polygon approximations", () => {
    const corridor = buildCanonicalProjectGeography({ projectId: "EXP-015", type: "CORRIDOR", points: points.slice(0, 2), now: 150 });
    const polygon = buildCanonicalProjectGeography({ projectId: "EXP-016", type: "POLYGON", points, now: 160 });
    expect(buildDenueQueryContext(corridor).denueMode).toBe("CORRIDOR_SEGMENTS_IF_AVAILABLE");
    expect(buildDenueQueryContext(polygon).approximations[0]).toContain("bounds");
  });

  test("TEST 017 - incidencia context keeps real incident coordinates out of relocation semantics", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-017", type: "POLYGON", points, now: 170 });
    expect(buildCrimeIncidenceGeographyContext(geography).doesNotRelocateIncidentCoordinates).toBe(true);
  });

  test("TEST 018 - evidence association conserves geographyId without fabricating traceabilityId", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-018", type: "INDIVIDUAL", points: [points[0]], now: 180 });
    const evidence = attachGeographyToEvidence({ evidenceId: "EVI-1", traceabilityId: null }, geography);
    expect(evidence.geographyId).toBe(geography.geographyId);
    expect(evidence.traceabilityId).toBeNull();
  });

  test("TEST 019 - finding association conserves geographyId and no synthetic sector is added", () => {
    const geography = buildCanonicalProjectGeography({ projectId: "EXP-019", type: "CORRIDOR", points: points.slice(0, 2), now: 190 });
    const finding = attachGeographyToFinding({ findingId: "FND-1" }, geography);
    expect(finding.geographyType).toBe("CORRIDOR");
    expect((finding as any).sectorId).toBeUndefined();
  });

  test("TEST 020 - multimodal evidence preserves documentId/fileId/checksum separate from traceabilityId", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "EVI-DOC",
      expedienteId: "EXP-020",
      documentId: "DOC-1",
      fileId: "FILE-1",
      checksum: "sha256:abc",
      fileName: "a.pdf",
      mimeType: "application/pdf",
      storageReference: "projects/EXP-020/documents/a.pdf",
      ingestionSource: "USER_UPLOAD",
    });
    expect(evidence.traceabilityId).toBeNull();
    expect(evidence.fileId).toBe("FILE-1");
    expect(evidence.checksum).toBe("sha256:abc");
  });

  test("TEST 021 - upstream traceabilityId is preserved when actually supplied", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "EVI-DOC",
      expedienteId: "EXP-021",
      fileName: "a.pdf",
      mimeType: "application/pdf",
      storageReference: "projects/EXP-021/documents/a.pdf",
      ingestionSource: "GOOGLE_DRIVE",
      traceabilityId: "TRACE-UPSTREAM-1",
    });
    expect(evidence.traceabilityId).toBe("TRACE-UPSTREAM-1");
  });

  test("TEST 022 - AI high score reaches READY_FOR_HUMAN_REVIEW but never APPROVED", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "EVI-AI",
      expedienteId: "EXP-022",
      fileName: "a.jpg",
      mimeType: "image/jpeg",
      storageReference: "projects/EXP-022/photos/a.jpg",
      ingestionSource: "USER_UPLOAD",
    });
    const ready = markReadyForHumanReview(evidence, 0.98);
    expect(ready.analysisStatus).toBe("READY_FOR_HUMAN_REVIEW");
    expect(ready.humanValidationStatus).toBe("PENDING_REVIEW");
  });

  test("TEST 023 - human approval persists validator identity when real and reloads from stored object", () => {
    const approved = markHumanApproved(
      createStoredRawMultimodalEvidence({
        evidenceId: "EVI-HUMAN",
        expedienteId: "EXP-023",
        fileName: "a.jpg",
        mimeType: "image/jpeg",
        storageReference: "projects/EXP-023/photos/a.jpg",
        ingestionSource: "USER_UPLOAD",
      }),
      { validatedAt: "2026-08-30T10:00:00.000Z", validatedBy: { username: "real.analyst" } }
    );
    const reloaded = JSON.parse(JSON.stringify(approved));
    expect(reloaded.humanValidationStatus).toBe("APPROVED");
    expect(reloaded.validatedBy.username).toBe("real.analyst");
    expect(reloaded.validatedAt).toBe("2026-08-30T10:00:00.000Z");
  });

  test("TEST 024 - geography lineage precedes source/evidence/finding/analysis/conclusion", () => {
    const lineage = buildEvidenceLineage({
      geographyId: "geo-EXP-024-polygon",
      geographyType: "POLYGON",
      sourceId: "DENUE",
      evidenceId: "EVI-24",
      findingId: "FND-24",
      analysisId: "AN-24",
      conclusionId: "CON-24",
    });
    expect(lineage.map((node) => node.type)).toEqual(["GEOGRAPHY", "SOURCE", "EVIDENCE", "FINDING", "ANALYSIS", "CONCLUSION"]);
    expect(validateLineage(lineage).status).toBe("SUPPORTED");
    expect(buildStreetViewFindingLineage({ findingId: "FND-SV", evidenceId: "SV-1", geographyId: "geo-EXP-024-polygon" })[0].type).toBe("GEOGRAPHY");
    const projectMap = readSource("src/components/ProjectMap.tsx");
    const workspace = readSource("src/components/GeographicWorkspace.tsx");
    const sweepEngine = readSource("src/modules/geoint/GeointControlledSweepEngine.tsx");
    expect(projectMap).toContain("canonicalGeography");
    expect(projectMap).toContain("Capa geográfica rectora");
    expect(workspace).toContain("NO_VALID_CANONICAL_GEOGRAPHY");
    expect(sweepEngine).toContain("Defina y confirme una geografía canónica válida");
  });
});
