import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("H4.3B.5A - Cabinet Individual expediente bridge", () => {
  const contract = read(
    "src/components/cabinet/cabinetCompletionContract.ts"
  );

  const workspace = read(
    "src/components/cabinet/CabinetIndividualWorkspace.tsx"
  );

  const projectList = read(
    "src/components/ProjectList.tsx"
  );

  const consumer = read(
    "src/components/CaptureAndAddPhoto.tsx"
  );

  const context = read(
    "src/context/ProjectContext.tsx"
  );

  const photoAlbum = read(
    "src/components/PhotoAlbum.tsx"
  );

  test("1. completion contract carries canonical draft, Street View evidence and contextual POIs", () => {
    expect(contract).toContain(
      "export interface CabinetCompletionResult"
    );
    expect(contract).toContain(
      "draftGeography: DraftProjectGeography;"
    );
    expect(contract).toContain(
      "streetViewEvidence: CabinetStreetViewEvidence[];"
    );
    expect(contract).toContain(
      "contextPois: CabinetContextPoi[];"
    );
    expect(contract).toContain(
      "territorialRef: CabinetTerritorialReference;"
    );
    expect(contract).toContain(
      "capture: StreetViewCapturePayload;"
    );
  });

  test("2. Individual workspace emits a confirmed individual completion result", () => {
    expect(workspace).toContain(
      'geometryType: "individual"'
    );
    expect(workspace).toContain(
      "draftGeography: confirmedDraft"
    );
    expect(workspace).toContain(
      "streetViewEvidence:"
    );
    expect(workspace).toContain(
      'nodeId: "INDIVIDUAL"'
    );
    expect(workspace).toContain(
      'role: "POINT"'
    );
    expect(workspace).toContain(
      "contextPois: [...contextPois]"
    );
    expect(workspace).toContain(
      "onComplete({"
    );
  });

  test("3. ProjectList uses the existing createProject route and writes the transient Cabinet bridge", () => {
    expect(projectList).toContain(
      "pendingCabinetResult"
    );
    expect(projectList).toContain(
      "const effectiveDraftGeography = pendingCabinetResult?.draftGeography ?? draftGeography;"
    );
    expect(projectList).toContain(
      "const confirmedDraftGeography = effectiveDraftGeography;"
    );
    expect(projectList).toContain(
      "draftGeography: confirmedDraftGeography"
    );
    expect(projectList).toContain(
      "const newId = await createProject("
    );
    expect(projectList).toContain(
      "(window as any).pendingCabinetProjectData = {"
    );
    expect(projectList).toContain(
      "projectId: newId"
    );
    expect(projectList).toContain(
      "result: pendingCabinetResult"
    );
    expect(projectList).toContain(
      "router.push(`/project/${newId}`)"
    );
  });

  test("4. consumer waits for the active matching project and enables only Individual", () => {
    expect(consumer).toContain(
      "if (!project || cabinetProcessing.current) return;"
    );
    expect(consumer).toContain(
      "if (pending.projectId !== project.id) return;"
    );
    expect(consumer).toContain(
      'pending.result.geometryType !== "individual"'
    );
    expect(consumer).toContain(
      "cabinetProcessing.current = true;"
    );
  });

  test("5. Street View evidence reuses the governed mapper and rector upload route", () => {
    expect(consumer).toContain(
      "mapStreetViewToAlbumPhoto(capture)"
    );
    expect(consumer).toContain(
      "await fetch(albumPhoto.previewUrl)"
    );
    expect(consumer).toContain(
      "await blobResponse.blob()"
    );
    expect(consumer).toContain(
      "await uploadAndAddPhoto("
    );
    expect(consumer).toContain(
      "territorialRef: evidence.territorialRef"
    );
  });

  test("6. consumer forwards complete governed Street View metadata", () => {
    const required = [
      "evidenceOrigin: albumPhoto.evidenceOrigin",
      "collectionMethod: albumPhoto.collectionMethod",
      "evidenceCategoryClass: albumPhoto.evidenceCategoryClass",
      "sourceProvider: albumPhoto.sourceProvider",
      "confidenceLevel: albumPhoto.confidenceLevel",
      "confidencePercentage: albumPhoto.confidencePercentage",
      "confidenceFactors: albumPhoto.confidenceFactors",
      "streetViewCategory: albumPhoto.streetViewCategory",
      "streetViewSource: albumPhoto.streetViewSource",
      "streetViewMetadata: albumPhoto.streetViewMetadata",
      "humanValidationStatus: albumPhoto.humanValidationStatus",
      "validationSource: albumPhoto.validationSource",
      "lineage: albumPhoto.lineage",
      "lineageStatus: albumPhoto.lineageStatus",
      "aiAnalyticalOutput: albumPhoto.aiAnalyticalOutput",
    ];

    for (const field of required) {
      expect(consumer).toContain(field);
    }
  });

  test("7. contextual POIs persist through createGeographicEntity and never become territorial vertices", () => {
    expect(consumer).toContain(
      "await createGeographicEntity({"
    );
    expect(consumer).toContain(
      'type: "POI"'
    );
    expect(consumer).toContain(
      "isIndependentPoi: true"
    );
    expect(consumer).toContain(
      "isVertex: false"
    );
    expect(consumer).toContain(
      "lat: poi.point.lat"
    );
    expect(consumer).toContain(
      "lng: poi.point.lng"
    );
  });

  test("8. partial progress is retained and automatic retry is bounded", () => {
    expect(consumer).toContain(
      "completedEvidenceIndexes?: number[];"
    );
    expect(consumer).toContain(
      "completedPoiIds?: string[];"
    );
    expect(consumer).toContain(
      "completedEvidenceIndexes.includes(index)"
    );
    expect(consumer).toContain(
      "completedEvidenceIndexes.push(index)"
    );
    expect(consumer).toContain(
      "completedPoiIds.includes(poi.id)"
    );
    expect(consumer).toContain(
      "completedPoiIds.push(poi.id)"
    );
    expect(consumer).toContain(
      "const nextRetryCount = (pending.retryCount ?? 0) + 1;"
    );
    expect(consumer).toContain(
      "if (nextRetryCount < 3)"
    );
    expect(consumer).toContain(
      "setCabinetRetryNonce((value) => value + 1)"
    );
  });

  test("9. transient bridge is deleted only from the success path", () => {
    const deleteToken =
      "delete (window as any).pendingCabinetProjectData;";

    expect(
      consumer.split(deleteToken).length - 1
    ).toBe(1);

    const deleteIndex = consumer.indexOf(deleteToken);
    const evidenceProgressIndex = consumer.indexOf(
      "completedEvidenceIndexes.push(index)"
    );
    const poiProgressIndex = consumer.indexOf(
      "completedPoiIds.push(poi.id)"
    );

    expect(deleteIndex).toBeGreaterThan(evidenceProgressIndex);
    expect(deleteIndex).toBeGreaterThan(poiProgressIndex);
  });

  test("10. legacy IN SITU bridge remains independent", () => {
    expect(consumer).toContain(
      "const pending = (window as any).pendingProjectPhotos;"
    );
    expect(consumer).toContain(
      "const pendingProcessed = useRef(false);"
    );
    expect(consumer).toContain(
      "}, [project]);"
    );
  });

  test("11. ProjectContext persists territorial reference and advanced governance", () => {
    const required = [
      "territorialRef: metadata?.territorialRef ?? null",
      "evidenceOrigin: metadata?.evidenceOrigin ?? null",
      "collectionMethod: metadata?.collectionMethod ?? null",
      "evidenceCategoryClass: metadata?.evidenceCategoryClass ?? null",
      "confidenceLevel: metadata?.confidenceLevel ?? null",
      "confidencePercentage: metadata?.confidencePercentage ?? null",
      "confidenceFactors: metadata?.confidenceFactors ?? null",
      "streetViewMetadata: metadata?.streetViewMetadata ?? null",
      "aiAnalyticalOutput: metadata?.aiAnalyticalOutput ?? null",
      "lineage: metadata?.lineage ?? normalizedBaseEvidence.fields.lineage",
      "lineageStatus: metadata?.lineageStatus ?? normalizedBaseEvidence.fields.lineageStatus",
    ];

    for (const field of required) {
      expect(context).toContain(field);
    }
  });

  test("12. productive PhotoAlbum routes forward advanced governance to the rector", () => {
    const required = [
      "humanValidationStatus: albumPhoto.humanValidationStatus",
      "validationSource: albumPhoto.validationSource",
      "lineage: albumPhoto.lineage",
      "lineageStatus: albumPhoto.lineageStatus",
      "aiAnalyticalOutput: albumPhoto.aiAnalyticalOutput",
    ];

    for (const field of required) {
      expect(
        photoAlbum.split(field).length - 1
      ).toBe(2);
    }
  });
});