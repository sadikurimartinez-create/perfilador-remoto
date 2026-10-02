import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { buildExecutiveCanonicalTerritorialMapSpec } from "../src/utils/executiveCanonicalTerritorialMap";
import { coordinatesFitGovernedViewport, metersPerLogicalPixel } from "../src/utils/governedCartographicScale";
import { buildCrimeIncidenceInstitutionalVisualSpecifications as charts } from "../src/utils/crimeIncidenceInstitutionalVisualProducer";
import { buildExecutiveGeointWordVisualAssets, renderExecutiveGeointWordDocument as renderExecutiveGeointWordDocumentDraft, assertExecutiveGeointPrincipalMapRendered } from "../src/utils/executiveGeointWordRenderer";
import { buildStreetViewCaptureSnapshot, mapStreetViewToAlbumPhoto } from "../src/modules/streetView/streetViewMapper";
import { Packer } from "docx";
import JSZip from "jszip";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
function geography(type: "INDIVIDUAL" | "CORRIDOR" | "POLYGON" = "INDIVIDUAL"): any {
  return buildCanonicalProjectGeography({ projectId: "exp", geographyId: "geo", type, now: 1,
    points: type === "INDIVIDUAL" ? [{ lat: 22, lng: -102 }] : type === "CORRIDOR" ? [{ lat: 22, lng: -102 }, { lat: 22.1, lng: -101.9 }, { lat: 22.2, lng: -102 }] :
      [{ lat: 22, lng: -102 }, { lat: 22, lng: -101.9 }, { lat: 22.1, lng: -101.9 }, { lat: 22.1, lng: -102 }] });
}
function projection(): any { return { sourceQuery: { status: "EXECUTED", admission: { accepted: true }, request: { datasetIdentity: { datasetId: "ds", source: "OBSERVED" },
  requestProvenance: { sourceReference: "Registro admitido" }, crimeFilters: { incidentTypes: ["A", "B"] }, temporalFilters: { start: "2026-01-01", end: "2026-01-03" }, queryGeometry: { geographyId: "geo" } } },
  datasetReference: { datasetId: "ds" }, lineage: { dataset: "ds", filters: { municipality: "M" } }, geographicReference: { expediente: { geographyId: "geo" } },
  temporalReference: { query: { start: "2026-01-01", end: "2026-01-03" } }, limitations: ["Descriptivo"], metrics: {
    frequency: { totalRecords: 4, byIncidentType: [{ value: "A", count: 3 }, { value: "B", count: 1 }] },
    percentage: { basis: 4, byIncidentType: [{ value: "A", count: 3, percentage: 75 }, { value: "B", count: 1, percentage: 25 }] },
    distribution: { byOccurredDate: [{ value: "2026-01-01", count: 3 }, { value: "2026-01-03", count: 1 }] } } }; }
function composition(reference: string | null = png): any { return { principalTerritorialMap: { mapId: "principal-territorial-map", status: "NO_CANONICAL_GEOGRAPHY", technicalMetadata: { geographyId: "geo" } },
  secondaryVisuals: [{ visualId: "photo", visualReference: reference, caption: "Captura gobernada" }], selectionAudit: { excludedItems: [{ itemId: "excluded" }] } }; }
describe("P3 operational visuals offline", () => {
  test.each(["INDIVIDUAL", "CORRIDOR", "POLYGON"] as const)("%s preserves canonical geometry", type => { const geo = geography(type); const before = JSON.stringify(geo); const spec = buildExecutiveCanonicalTerritorialMapSpec(geo); expect(spec.technicalMetadata.geographyId).toBe("geo"); expect(JSON.stringify(geo)).toBe(before); expect(spec.geometryType).toBe(geo.geometry.type); });
  test("Point marker uses actual coordinate", () => expect(buildExecutiveCanonicalTerritorialMapSpec(geography()).markers).toEqual([{ lat: 22, lng: -102 }]));
  test("Corridor preserves every vertex", () => expect(buildExecutiveCanonicalTerritorialMapSpec(geography("CORRIDOR")).paths[0]).toHaveLength(3));
  test("Polygon closes its ring", () => { const ring = buildExecutiveCanonicalTerritorialMapSpec(geography("POLYGON")).paths[0]; expect(ring[0]).toEqual(ring[ring.length - 1]); });
  test("holes are preserved without fill", () => { const geo = geography("POLYGON"); geo.geometry.coordinates.push([[-101.98,22.02],[-101.96,22.02],[-101.96,22.04],[-101.98,22.02]]); const spec = buildExecutiveCanonicalTerritorialMapSpec(geo); expect(spec.pathMetadata[1].role).toBe("INTERIOR_RING"); expect(spec.imageUrl).not.toContain("fillcolor"); });
  test("MultiPolygon preserves components", () => { const geo = geography("POLYGON"); geo.geometry = { type: "MultiPolygon", coordinates: [geo.geometry.coordinates, geo.geometry.coordinates] }; expect(buildExecutiveCanonicalTerritorialMapSpec(geo).pathMetadata.map(item => item.componentIndex)).toEqual([0, 1]); });
  test("invalid coordinate cannot use fallback", () => { const geo = geography(); geo.geometry.coordinates = [NaN, 22]; expect(() => buildExecutiveCanonicalTerritorialMapSpec(geo)).toThrow(); });
  test("presentation center does not replace geometry", () => { const spec = buildExecutiveCanonicalTerritorialMapSpec(geography("CORRIDOR")); expect(spec.paths[0]).toHaveLength(3); expect(spec.markers).toHaveLength(0); });
  test("bounds encompass complete corridor", () => { const spec = buildExecutiveCanonicalTerritorialMapSpec(geography("CORRIDOR")); expect(spec.viewport.bounds).toMatchObject({ north: 22.2, south: 22, west: -102, east: -101.9 }); });
  test("all vertices fit the governed viewport", () => { const spec = buildExecutiveCanonicalTerritorialMapSpec(geography("CORRIDOR")); expect(coordinatesFitGovernedViewport(spec.viewport.center!, spec.paths.flat(), spec.viewport.zoom)).toBe(true); });
  test("no absent DENUE legend", () => expect(buildExecutiveCanonicalTerritorialMapSpec(geography()).legend).toBeNull());
  test("scale corresponds to current zoom and latitude", () => { const spec = buildExecutiveCanonicalTerritorialMapSpec(geography()); expect(spec.cartographicScale.metersPerLogicalPixel).toBe(metersPerLogicalPixel(spec.viewport.center!.lat, spec.viewport.zoom)); expect(spec.cartographicScale.distanceMeters).toBeCloseTo(spec.cartographicScale.logicalPixels * spec.cartographicScale.metersPerLogicalPixel); });
  test("BAR uses exact dataset and total", () => { const chart = charts(projection()).charts[0]; expect(chart.metadata.datasetReference).toBe("ds"); expect(chart.data.reduce((sum, datum) => sum + datum.value, 0)).toBe(chart.metadata.total); });
  test("BAR percentages are coherent", () => expect(charts(projection()).charts[0].data.map(item => item.percentage)).toEqual([75,25]));
  test("LINE does not manufacture missing dates", () => expect(charts(projection()).charts[1].data.map(item => item.label)).toEqual(["2026-01-01","2026-01-03"]));
  test.each(["filters", "period", "geography", "sourceIdentity", "lineage"])("%s survives into chart provenance", key => expect((charts(projection()).charts[0].metadata as any)[key]).toBeDefined());
  test("source label comes from admitted request", () => expect(charts(projection()).charts[0].metadata.sourceReference).toBe("Registro admitido"));
  test("LINE reports count, never a rate", () => expect(charts(projection()).charts[1].yAxisLabel).toBe("Número de registros"));
  test("simulated dataset cannot generate charts", () => { const data = projection(); data.sourceQuery.request.datasetIdentity.source = "SIMULATED"; expect(() => charts(data)).toThrow("NOT_ADMITTED"); });
  test("unaccepted query cannot generate charts", () => { const data = projection(); data.sourceQuery.admission.accepted = false; expect(() => charts(data)).toThrow("NOT_ADMITTED"); });
  test("inconsistent counts fail closed", () => { const data = projection(); data.metrics.frequency.totalRecords = 9; expect(() => charts(data)).toThrow("COUNTS_INCONSISTENT"); });
  test("inconsistent percentages fail closed", () => { const data = projection(); data.metrics.percentage.byIncidentType[0].percentage = 85; expect(() => charts(data)).toThrow("PERCENTAGES_INCONSISTENT"); });
  test("source projection remains unchanged", () => { const data = projection(); const before = JSON.stringify(data); charts(data); expect(JSON.stringify(data)).toBe(before); });
  test("selected photograph hydrates", async () => { const assets = await buildExecutiveGeointWordVisualAssets(composition()); expect(assets.photo.data.byteLength).toBeGreaterThan(0); });
  test.each([[null,"ASSET_MISSING"],["asset://invalid","ASSET_INVALID"],["https://example.test/image","ASSET_UNAVAILABLE"]])("%s reports %s", async (reference, expected) => { const states: any = {}; await buildExecutiveGeointWordVisualAssets(composition(reference), { onAssetState: (id, state) => { states[id] = state; } }); expect(states.photo).toBe(expected); expect(states.excluded).toBe("ASSET_EXCLUDED"); });
  test("unavailable resolver does not substitute image", async () => { const states: any = {}; const assets = await buildExecutiveGeointWordVisualAssets(composition("https://example.test/photo"), { resolveImage: async () => { throw new Error("offline unavailable"); }, onAssetState: (id, state) => { states[id] = state; } }); expect(assets.photo).toBeUndefined(); expect(states.photo).toBe("ASSET_UNAVAILABLE"); });
  test("map geography mismatch blocks before fetching", async () => { const fetcher = jest.fn(); await expect(buildExecutiveGeointWordVisualAssets(composition(), { principalMapSpec: buildExecutiveCanonicalTerritorialMapSpec({ ...geography(), geographyId: "other" }), resolveImage: fetcher })).rejects.toThrow("GEOGRAPHY_MISMATCH"); expect(fetcher).not.toHaveBeenCalled(); });
  test("missing principal blocks", () => expect(() => assertExecutiveGeointPrincipalMapRendered({ renderAudit: { renderedVisualIds: [], missingVisualAssetIds: ["principal-territorial-map"] } } as any)).toThrow("REQUIRED"));
  test("missing secondary publishes neither image nor caption", async () => { const result = renderExecutiveGeointWordDocument({ identity: { numeroExpediente: "QA-1" }, sections: [{ sectionId: "key-evidence", order: 1, title: "Evidencia", content: [], densityPolicy: { targetPages: "1" }, status: "READY" }], visualPlacements: [{ visualId: "photo", sectionId: "key-evidence", headline: "FOTO CITADA", caption: "CAPTION AUSENTE" }], annexReferences: [], presentation: { documentTitle: "QA visual" } } as any); const zip = await JSZip.loadAsync(await Packer.toBuffer(result.document)); const xml = await zip.file("word/document.xml")!.async("string"); expect(xml).not.toContain("CAPTION AUSENTE"); expect(result.renderAudit.missingVisualAssetIds).toEqual(["photo"]); expect(result.renderAudit.renderedVisualIds).toEqual([]); });
  test("Street View snapshot preserves panorama and zero coordinates", () => { const snap = buildStreetViewCaptureSnapshot({ lat: 0, lng: 0, panoId: "pano", heading: 10.5, pitch: 0, zoom: 2 }); expect(snap).toMatchObject({ lat: 0, lng: 0, panoId: "pano", heading: 10.5, pitch: 0, fov: 45 }); expect(new URL(snap.proxyUrl,"https://local.test").searchParams.get("pano")).toBe("pano"); });
  test.each(["lat", "lng", "heading", "pitch", "zoom"])("invalid %s blocks capture", key => expect(() => buildStreetViewCaptureSnapshot({ lat: 22, lng: -102, panoId: "pano", heading: 0, pitch: 0, zoom: 1, [key]: NaN })).toThrow("REQUIRED"));
  test("missing panorama blocks capture", () => expect(() => buildStreetViewCaptureSnapshot({ lat: 22, lng: -102, panoId: "", heading: 0, pitch: 0, zoom: 1 })).toThrow("REQUIRED"));
  test("Street View mapping preserves orientation and pending review", () => { const photo = mapStreetViewToAlbumPhoto({ dataUrl: png, poiLat: 22, poiLng: -102, panoramaLat: 22.01, panoramaLng: -102.01, heading: 10.5, pitch: 0, fov: 45.5, panoId: "pano", geographyId: "geo" }); expect(photo.streetViewMetadata).toMatchObject({ panoId: "pano", heading: 10.5, pitch: 0, fov: 45.5, panoramaLat: 22.01, panoramaLng: -102.01 }); expect(photo.evidenceOrigin).toBe("REMOTE"); expect(photo.humanValidationStatus).toBe("PENDING_REVIEW"); expect((photo as any).findingId).toBeUndefined(); expect(JSON.parse(JSON.stringify(photo)).id).toBe(photo.id); });
});

// Composition-only fixtures are explicit drafts; final guards are tested in PRE-P7.
const renderExecutiveGeointWordDocument = (model: Parameters<typeof renderExecutiveGeointWordDocumentDraft>[0], options: Parameters<typeof renderExecutiveGeointWordDocumentDraft>[1] = {}) => renderExecutiveGeointWordDocumentDraft(model, { ...options, exportMode: "DRAFT" });
