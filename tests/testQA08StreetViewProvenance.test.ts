import { PhotoEvidenceGovernanceEngine } from "../src/utils/photoEvidenceGovernanceEngine";
import { VisualEvidenceEngine } from "../src/utils/visualEvidenceEngine/visualEvidenceEngine";
import { hasStreetViewProvenance, StreetViewCollector } from "../src/utils/visualEvidenceEngine/streetViewCollector";

const lat = 21.88;
const lng = -102.29;

function fieldPhoto(id: string) {
  return {
    id,
    evidenceId: id,
    tipo: "PHOTO_FIELD",
    fuente: "Inspeccion de Campo",
    previewUrl: `https://images.example.test/streetview-sector-${id}.jpg`,
    comentario: `Barda en calle ${id}; referencia textual a Street View`,
    lat,
    lng,
    coordinates: { lat, lng },
    lineage: [{ sourceId: id }],
    evidenceOrigin: "FIELD",
  };
}

function realStreetView(id: string) {
  return {
    id,
    tipo: "REMOTE_STREET_VIEW",
    evidenceType: "VIRTUAL_STREET_VIEW",
    sourceProvider: "GOOGLE_STREET_VIEW",
    previewUrl: `https://images.example.test/panorama-${id}.jpg`,
    comentario: "Vista panoramica confirmada",
    lat,
    lng,
    streetViewMetadata: { panoId: `pano-${id}`, provider: "GOOGLE_STREET_VIEW" },
  };
}

function process(photos: any[]) {
  return VisualEvidenceEngine.process("qa08-project", photos, lat, lng, 500, []);
}

describe("QA-08 Street View provenance", () => {
  test("three field photos and no capture produce zero Street View without losing field evidence", () => {
    const photos = [fieldPhoto("field-1"), fieldPhoto("field-2"), fieldPhoto("field-3")];
    const before = JSON.stringify(photos);
    const result = process(photos);

    expect(StreetViewCollector.collect(photos, lat, lng, 500)).toEqual([]);
    expect(result.streetViewEvidence).toHaveLength(0);
    expect(result.analystPhotos).toHaveLength(3);
    expect(PhotoEvidenceGovernanceEngine.process(photos).primaryPhotos).toEqual(
      expect.arrayContaining(photos.map((photo) => expect.objectContaining({
        id: photo.id,
        evidenceId: photo.evidenceId,
        fuente: photo.fuente,
        coordinates: photo.coordinates,
        lineage: photo.lineage,
        tipo: photo.tipo,
      })))
    );
    expect(JSON.stringify(photos)).toBe(before);
  });

  test("a genuine Google Street View capture remains Street View", () => {
    const capture = realStreetView("sv-1");
    expect(process([capture]).streetViewEvidence).toHaveLength(1);
    expect(process([capture]).analystPhotos).toHaveLength(0);
    expect(StreetViewCollector.collect([capture], lat, lng, 500)[0]).toEqual(
      expect.objectContaining({ id: capture.id, source: "STREET_VIEW", image: capture.previewUrl })
    );
  });

  test("three field photos plus two genuine captures produce exactly two Street View items", () => {
    const result = process([
      fieldPhoto("field-1"), fieldPhoto("field-2"), fieldPhoto("field-3"),
      realStreetView("sv-1"), realStreetView("sv-2"),
    ]);
    expect(result.analystPhotos).toHaveLength(3);
    expect(result.streetViewEvidence).toHaveLength(2);
  });

  test("legacy text, URL, generic remote flags and an unverified boolean do not prove provenance", () => {
    const legacy = {
      ...fieldPhoto("legacy"),
      isStreetView: true,
      evidenceOrigin: "REMOTE",
      evidenceCategoryClass: "REMOTE_VISUAL",
      collectionMethod: "DESKTOP_ANALYSIS",
    };
    expect(hasStreetViewProvenance(legacy)).toBe(false);
    expect(process([legacy]).streetViewEvidence).toHaveLength(0);
    expect(process([legacy]).analystPhotos).toHaveLength(1);
  });

  test("legacy capture with explicit source metadata stays eligible", () => {
    const legacy = { ...fieldPhoto("legacy-sv"), tipo: "STREET_VIEW", fuente: "Google Street View" };
    expect(hasStreetViewProvenance(legacy)).toBe(true);
    expect(process([legacy]).streetViewEvidence).toHaveLength(1);
  });
});
