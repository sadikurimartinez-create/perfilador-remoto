const mockSearchOverpass = jest.fn();
const mockSearchGooglePlaces = jest.fn();
const mockAnalyzeStreetView = jest.fn();
const mockGetDenueData = jest.fn();

jest.mock("../src/utils/urbanProviders", () => ({
  getOverpassSourceReference: () => "https://overpass.test/api/interpreter",
  searchGooglePlaces: mockSearchGooglePlaces,
  searchOverpass: mockSearchOverpass,
}));

jest.mock("../src/utils/osintProviders", () => ({
  searchSerpAPI: jest.fn(),
  searchYouTubeOSINT: jest.fn(),
}));

jest.mock("../src/utils/socialProviders", () => ({
  analyzeStreetViewWithGemini: mockAnalyzeStreetView,
  buscarEnWebOSINT: jest.fn(),
  searchReddit: jest.fn(),
  searchTelegram: jest.fn(),
  searchX: jest.fn(),
}));

jest.mock("../src/modules/drive-ingestion/drive-ingestion.engine", () => ({
  DriveIngestionEngine: { getIngestedIntelligence: jest.fn() },
}));

jest.mock("../src/utils/mcmCorrelation", () => ({
  runMultiSourceCorrelation: jest.fn().mockResolvedValue({
    correlatedEntities: [],
    updatedHypothesis: null,
  }),
}));

jest.mock("../src/utils/imfoService", () => ({
  autoDiscoverSource: jest.fn().mockResolvedValue(undefined),
  logLearningAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/lib/osintSources", () => ({ getRegionalRSSFeeds: jest.fn().mockReturnValue([]) }));
jest.mock("../src/lib/osintActions", () => ({ getDenueData: mockGetDenueData }));

import { runUnifiedCifaScan } from "../src/utils/cifaEngine";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";

describe("CIFA geographic provider orchestration", () => {
  const originalMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const originalDenueToken = process.env.INEGI_DENUE_TOKEN;

  beforeEach(() => {
    mockSearchOverpass.mockReset();
    mockSearchGooglePlaces.mockReset();
    mockAnalyzeStreetView.mockReset();
    mockGetDenueData.mockReset();
  });

  afterAll(() => {
    if (originalMapsKey === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalMapsKey;
    if (originalDenueToken === undefined) delete process.env.INEGI_DENUE_TOKEN;
    else process.env.INEGI_DENUE_TOKEN = originalDenueToken;
  });

  test.each([
    ["INDIVIDUAL", [{ lat: 21.886, lng: -102.292 }], [21.886, -102.292], "CANONICAL_POINT"],
    ["CORRIDOR", [
      { lat: 21.88, lng: -102.30 },
      { lat: 21.89, lng: -102.29 },
      { lat: 21.90, lng: -102.28 },
    ], [21.89, -102.29], "CORRIDOR_NODE"],
    ["POLYGON", [
      { lat: 21.88, lng: -102.30 },
      { lat: 21.90, lng: -102.30 },
      { lat: 21.90, lng: -102.28 },
      { lat: 21.88, lng: -102.28 },
    ], [21.89, -102.29], "POLYGON_CENTROID"],
  ])("passes real %s coordinates and provenance to Overpass", async (type, points, expected, derivation) => {
    const canonicalGeography = buildCanonicalProjectGeography({
      projectId: `provider-${String(type).toLowerCase()}`,
      type: type as string,
      points: points as Array<{ lat: number; lng: number }>,
      now: 1,
    });
    mockSearchOverpass.mockResolvedValueOnce([{ id: 1, lat: expected[0], lon: expected[1] }]);

    const result = await runUnifiedCifaScan({
      id: "project",
      locationName: "Aguascalientes",
      canonicalGeography,
    }, ["openstreetmap"]);

    const [calledLat, calledLng] = mockSearchOverpass.mock.calls[0];
    expect(calledLat).toBeCloseTo(expected[0] as number, 8);
    expect(calledLng).toBeCloseTo(expected[1] as number, 8);
    expect(result.sourceResults[0]).toMatchObject({
      acquisitionStatus: "ACQUIRED",
      resultCount: 1,
      isSimulated: false,
      geographyContext: {
        geographyType: type,
        queryPointDerivation: derivation,
        queryPoint: {
          lat: expect.closeTo(expected[0] as number, 8),
          lng: expect.closeTo(expected[1] as number, 8),
        },
      },
    });
    expect(result.coveragePanel).toMatchObject({
      sourcesExecuted: 1,
      sourcesResponded: 1,
      sourcesWithData: 1,
      georeferencedResults: 1,
    });
  });

  test("valid empty provider response is executed and healthy without being data", async () => {
    const canonicalGeography = buildCanonicalProjectGeography({
      projectId: "empty",
      type: "INDIVIDUAL",
      points: [{ lat: 21.886, lng: -102.292 }],
      now: 1,
    });
    mockSearchOverpass.mockResolvedValueOnce([]);

    const result = await runUnifiedCifaScan({ id: "project", canonicalGeography }, ["openstreetmap"]);

    expect(result).toMatchObject({ success: true, institutionalUse: "NO_DATA" });
    expect(result.coveragePanel).toMatchObject({
      sourcesExecuted: 1,
      sourcesResponded: 1,
      sourcesWithData: 0,
      sourcesNoData: 1,
    });
  });

  test("passes the same canonical point to Maps, DENUE, Overpass and Street View", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";
    process.env.INEGI_DENUE_TOKEN = "test-denue-token";
    const canonicalGeography = buildCanonicalProjectGeography({
      projectId: "all-territorial",
      type: "INDIVIDUAL",
      points: [{ lat: 21.886, lng: -102.292 }],
      now: 1,
    });
    mockSearchGooglePlaces.mockResolvedValueOnce([]);
    mockGetDenueData.mockResolvedValueOnce({ exito: true, denueStatus: "EMPTY", pois: [] });
    mockSearchOverpass.mockResolvedValueOnce([]);
    mockAnalyzeStreetView.mockResolvedValueOnce({ analisis: null, imagenesBase64: [] });

    const result = await runUnifiedCifaScan({ id: "project", canonicalGeography }, [
      "google_maps",
      "apis_gubernamentales",
      "openstreetmap",
      "street_view",
    ]);

    expect(mockSearchGooglePlaces).toHaveBeenCalledWith(21.886, -102.292);
    expect(mockGetDenueData).toHaveBeenCalledWith(21.886, -102.292);
    expect(mockSearchOverpass).toHaveBeenCalledWith(21.886, -102.292);
    expect(mockAnalyzeStreetView).toHaveBeenCalledWith(21.886, -102.292);
    expect(result.sourceResults).toHaveLength(4);
    expect(result.sourceResults.every((source) => source.acquisitionStatus === "NO_DATA")).toBe(true);
    expect(result.sourceResults.every((source) => source.geographyContext === result.orchestrator.geographyContext)).toBe(true);
  });

  test("does not use scalar fallback coordinates for a corridor without canonical geometry", async () => {
    const result = await runUnifiedCifaScan({
      id: "lineal-no-canonical",
      geometryType: "LINEAL",
      latitude: 21.885,
      longitude: -102.291,
    }, ["openstreetmap"]);

    expect(mockSearchOverpass).not.toHaveBeenCalled();
    expect(result.sourceResults[0]).toMatchObject({
      acquisitionStatus: "UNAVAILABLE",
      errorCode: "INVALID_COORDINATES",
      selectedForProductiveAcquisition: false,
    });
    expect(result.orchestrator.geographyContext).toBeNull();
  });

  test("keeps aggregators and unsupported public providers outside the applicable denominator", async () => {
    const result = await runUnifiedCifaScan({ id: "non-applicable" }, [
      "osint_territorial",
      "facebook_public",
    ]);

    expect(result).toMatchObject({ success: false, institutionalUse: "UNAVAILABLE" });
    expect(result.sourceResults).toEqual([
      expect.objectContaining({
        sourceKey: "osint_territorial",
        acquisitionStatus: "UNAVAILABLE",
        errorCode: "NOT_APPLICABLE_AGGREGATOR",
        applicable: false,
        selectedForProductiveAcquisition: false,
      }),
      expect.objectContaining({
        sourceKey: "facebook_public",
        acquisitionStatus: "UNAVAILABLE",
        errorCode: "UNSUPPORTED_PROVIDER",
        applicable: false,
        selectedForProductiveAcquisition: false,
      }),
    ]);
    expect(result.coveragePanel).toMatchObject({
      sourcesRequested: 2,
      sourcesApplicable: 0,
      sourcesNotApplicable: 2,
      sourcesConfigured: 0,
      sourcesExecuted: 0,
      sourcesResponded: 0,
      sourcesUnavailable: 0,
    });
  });
});
